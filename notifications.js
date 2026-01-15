// ===== NOTIFICATIONS SYSTEM =====
// Clean rewrite - no DM code

// State
let currentNotifFilter = 'unread';
let currentDetailView = null; // { type: 'follow'|'sound'|'room-invite', data: {...} }
let currentActivityFilter = 'all';
let currentActivityItem = null;
let currentItemNotifications = []; // Notifications for the current item (who liked/saved/etc)
let notificationSubscription = null;

// Icons for notification types
const notificationIcons = {
    like: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    save: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    follow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14" stroke="currentColor" stroke-width="2"/><line x1="23" y1="11" x2="17" y2="11" stroke="currentColor" stroke-width="2"/></svg>',
    'room-invite': '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
};

// ===== INITIALIZATION =====

function initNotifications() {
    initNotificationTabs();
    loadExistingNotifications();
    subscribeToRealtimeNotifications();
}

// ===== LOADING NOTIFICATIONS =====

async function loadExistingNotifications() {
    if (typeof supabaseGetUser !== 'function' || typeof supabaseGetNotifications !== 'function') {
        return;
    }

    const { user } = await supabaseGetUser();
    if (!user) {
        return;
    }

    const { data: notifications, error } = await supabaseGetNotifications(user.id);
    if (error) {
        console.error('Error loading notifications:', error);
        return;
    }

    if (!notifications || notifications.length === 0) {
        updateNotifEmptyState();
        return;
    }

    // Enrich room-invite notifications with room info
    for (const notification of notifications) {
        if (notification.type === 'room-invite' && notification.actor_id) {
            // Look up the room created by this actor
            const room = (typeof communityRooms !== 'undefined' ? communityRooms : [])
                .find(r => r.creatorId === notification.actor_id);
            if (room) {
                notification.room_id = room.id;
                notification.room_name = room.name;
            }
        }
    }

    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;

    notificationsList.innerHTML = '';

    notifications.forEach(notification => {
        const notifHTML = createNotificationHTML(notification);
        notificationsList.insertAdjacentHTML('beforeend', notifHTML);
    });

    updateNotificationBadge();
    filterNotifications();
    updateNotifEmptyState();
}

// ===== REALTIME SUBSCRIPTION =====

async function subscribeToRealtimeNotifications() {
    if (notificationSubscription) {
        if (typeof supabaseUnsubscribe === 'function') {
            supabaseUnsubscribe(notificationSubscription);
        }
        notificationSubscription = null;
    }

    if (typeof supabaseGetUser !== 'function' || typeof supabaseSubscribeToNotifications !== 'function') {
        return;
    }

    const { user } = await supabaseGetUser();
    if (!user) return;

    notificationSubscription = supabaseSubscribeToNotifications(user.id, (notification) => {
        console.log('Received notification:', notification);
        displayIncomingNotification(notification);
    });
}

// ===== NOTIFICATION RENDERING =====

function createNotificationHTML(notification) {
    const type = notification.type || 'like';
    const itemId = notification.item_id;
    const isRead = notification.is_read;

    // Handle nested actor data from Supabase join OR flat data from realtime
    const actorId = notification.actor_id || '';
    const actorUsername = notification.actor?.username || notification.actor_username || '';
    const actorAvatar = notification.actor?.avatar_url || notification.actor_avatar || '';

    // Room data
    const roomId = notification.room_id || '';
    const roomName = notification.room_name || '';
    const timeText = formatNotificationTime(notification.created_at);

    // Build message with clickable username
    const actionText = {
        like: 'liked',
        save: 'saved',
        comment: 'commented on',
        share: 'shared',
        download: 'downloaded',
        follow: 'started following you',
        'room-invite': 'invited you to'
    };

    // Get item title from notification
    const itemTitle = notification.item?.title || notification.item_title || 'your sound';

    // Build formatted message with clickable username
    let formattedMessage;
    const displayName = actorUsername || 'Someone';
    const usernameSpan = actorUsername
        ? `<span class="notif-username" data-username="${escapeAttr(actorUsername)}">${escapeHTML(actorUsername)}</span>`
        : 'Someone';

    if (type === 'follow') {
        formattedMessage = `${usernameSpan} started following you`;
    } else if (type === 'room-invite') {
        formattedMessage = `${usernameSpan} invited you to ${escapeHTML(roomName || 'a room')}`;
    } else {
        formattedMessage = `${usernameSpan} ${actionText[type] || 'interacted with'} ${escapeHTML(itemTitle)}`;
    }

    return `
        <div class="notification-item ${isRead ? '' : 'unread'}"
             data-type="${escapeAttr(type)}"
             data-item-id="${escapeAttr(String(itemId || ''))}"
             data-notification-id="${escapeAttr(String(notification.id || ''))}"
             data-actor-id="${escapeAttr(actorId)}"
             data-actor-username="${escapeAttr(actorUsername)}"
             data-actor-avatar="${escapeAttr(actorAvatar)}"
             data-room-id="${escapeAttr(roomId)}"
             data-room-name="${escapeAttr(roomName)}">
            <div class="notification-icon ${escapeAttr(type)}">
                ${notificationIcons[type] || notificationIcons.like}
            </div>
            <div class="notification-content">
                <span class="notification-text">${formattedMessage}</span>
                <span class="notification-time">${timeText}</span>
            </div>
        </div>
    `;
}

function formatNotificationTime(createdAt) {
    if (!createdAt) return 'Recently';

    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function displayIncomingNotification(notification) {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;

    // Enrich room-invite notifications with room info
    if (notification.type === 'room-invite' && notification.actor_id) {
        const room = (typeof communityRooms !== 'undefined' ? communityRooms : [])
            .find(r => r.creatorId === notification.actor_id);
        if (room) {
            notification.room_id = room.id;
            notification.room_name = room.name;
        }
    }

    // Remove empty state if present
    const emptyState = notificationsList.querySelector('.notif-empty-state');
    if (emptyState) emptyState.remove();

    const notifHTML = createNotificationHTML({ ...notification, is_read: false });
    notificationsList.insertAdjacentHTML('afterbegin', notifHTML);

    updateNotificationBadge();
    filterNotifications();

    // Show toast with appropriate message
    let toastMsg = 'New notification';
    if (notification.type === 'follow') {
        toastMsg = 'Someone started following you!';
    } else if (notification.type === 'room-invite') {
        toastMsg = `You've been invited to ${notification.room_name || 'a room'}!`;
    }

    if (typeof showToast === 'function') {
        showToast(toastMsg, 'info');
    }
}

// ===== TABS AND FILTERING =====

function initNotificationTabs() {
    const tabs = document.querySelectorAll('.notif-tab');
    const notificationsList = document.getElementById('notifications-list');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentNotifFilter = tab.dataset.filter;
            filterNotifications();
        });
    });

    if (notificationsList) {
        notificationsList.addEventListener('click', (e) => {
            // Check if clicking on username link
            const usernameLink = e.target.closest('.notif-username');
            if (usernameLink) {
                e.stopPropagation();
                const username = usernameLink.dataset.username;
                if (username && typeof viewUserProfile === 'function') {
                    viewUserProfile(username, false, true); // Open as overlay
                }
                return;
            }

            const notifItem = e.target.closest('.notification-item');
            if (notifItem) {
                handleNotificationClick(notifItem);
            }
        });
    }

    filterNotifications();
}

function filterNotifications() {
    const notifications = document.querySelectorAll('.notification-item');
    const clearBtn = document.getElementById('clear-notifications-btn');

    if (clearBtn) {
        clearBtn.style.display = currentNotifFilter === 'read' ? 'flex' : 'none';
        clearBtn.classList.toggle('hidden', currentNotifFilter !== 'read');
    }

    notifications.forEach(notif => {
        const isUnread = notif.classList.contains('unread');
        if (currentNotifFilter === 'unread') {
            notif.style.display = isUnread ? 'flex' : 'none';
        } else {
            notif.style.display = isUnread ? 'none' : 'flex';
        }
    });

    updateNotifEmptyState();
}

function updateNotifEmptyState() {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;

    const visibleCount = Array.from(notificationsList.querySelectorAll('.notification-item'))
        .filter(n => n.style.display !== 'none').length;

    const existingEmpty = notificationsList.querySelector('.notif-empty-state');
    if (existingEmpty) existingEmpty.remove();

    if (visibleCount === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'notif-empty-state';
        emptyState.innerHTML = `
            <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" opacity="0.3">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
            </svg>
            <p>No ${currentNotifFilter} notifications</p>
        `;
        notificationsList.appendChild(emptyState);
    }
}

// ===== NOTIFICATION BADGE =====

function updateNotificationBadge() {
    const badge = document.getElementById('notifications-badge');
    const dashboardBadge = document.getElementById('dashboard-notif-badge');
    const dashboardHeaderBadge = document.getElementById('dashboard-header-badge');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    if (!isLoggedIn) {
        if (badge) badge.classList.remove('show');
        if (dashboardBadge) dashboardBadge.classList.remove('show');
        if (dashboardHeaderBadge) dashboardHeaderBadge.classList.remove('show');
        return;
    }

    const unreadCount = document.querySelectorAll('.notification-item.unread').length;
    const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

    [badge, dashboardBadge, dashboardHeaderBadge].forEach(b => {
        if (b) {
            if (unreadCount > 0) {
                b.textContent = badgeText;
                b.classList.add('show');
            } else {
                b.classList.remove('show');
            }
        }
    });
}

// ===== CLICK HANDLER - ROUTES TO DETAIL VIEWS =====

function handleNotificationClick(notifItem) {
    const type = notifItem.dataset.type;
    const itemId = notifItem.dataset.itemId;
    const notificationId = notifItem.dataset.notificationId;

    // Mark as read
    if (notifItem.classList.contains('unread')) {
        notifItem.classList.remove('unread');
        markNotificationAsRead(notificationId);
        filterNotifications();
        updateNotificationBadge();
    }

    // Route to appropriate detail view
    if (type === 'follow') {
        // Go directly to the follower's profile
        const actorUsername = notifItem.dataset.actorUsername;
        if (actorUsername && typeof viewUserProfile === 'function') {
            viewUserProfile(actorUsername, false, true);
        }
        return;
    } else if (type === 'room-invite') {
        showRoomInviteView(notifItem);
    } else if (['like', 'comment', 'save', 'share', 'download'].includes(type)) {
        showSoundActivityView(itemId, type, notifItem);
    }
}

async function markNotificationAsRead(notificationId) {
    if (!notificationId || typeof supabaseMarkNotificationRead !== 'function') return;
    try {
        await supabaseMarkNotificationRead(notificationId);
    } catch (err) {
        console.error('Error marking notification as read:', err);
    }
}

// ===== FOLLOW DETAIL VIEW =====

function showFollowDetailView(notifItem) {
    const actorId = notifItem.dataset.actorId;
    const actorUsername = notifItem.dataset.actorUsername;
    const actorAvatar = notifItem.dataset.actorAvatar;

    currentDetailView = { type: 'follow', actorId, actorUsername, actorAvatar };

    // Hide all detail views
    hideAllDetailViews();

    // Show follow detail view
    const followView = document.getElementById('follow-detail-view');
    const detailPanel = document.getElementById('notif-detail-panel');

    if (followView) {
        followView.classList.remove('hidden');

        // Populate data
        const avatarEl = document.getElementById('follow-user-avatar');
        const nameEl = document.getElementById('follow-user-name');
        const profileBtn = document.getElementById('follow-view-profile-btn');

        if (avatarEl) {
            if (actorAvatar && typeof sanitizeURL === 'function' && sanitizeURL(actorAvatar)) {
                avatarEl.style.backgroundImage = `url('${sanitizeURL(actorAvatar)}')`;
                avatarEl.innerHTML = '';
            } else {
                avatarEl.style.backgroundImage = '';
                avatarEl.innerHTML = `<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" opacity="0.5"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            }
        }
        if (nameEl) nameEl.textContent = actorUsername || 'Unknown User';
        if (profileBtn) {
            profileBtn.onclick = () => {
                if (actorUsername && typeof showUserProfile === 'function') {
                    showUserProfile(actorUsername);
                    closeDetailView();
                }
            };
        }
    }

    if (detailPanel) detailPanel.classList.add('has-content');
}

// ===== SOUND ACTIVITY VIEW =====

async function showSoundActivityView(itemId, notifType, notifItem) {
    const result = findItemWithCategory(itemId);
    let item, category;

    if (result) {
        item = result.item;
        category = result.category;
    } else {
        // Create placeholder if item not found
        const notifText = notifItem?.querySelector('.notification-text')?.textContent || '';
        const titleMatch = notifText.match(/"([^"]+)"|'([^']+)'/) || notifText.match(/(?:liked|saved|commented on|shared|downloaded)\s+(.+)$/);
        const title = titleMatch ? (titleMatch[1] || titleMatch[2] || titleMatch[0]) : 'Unknown Sound';

        item = {
            id: itemId,
            title: title,
            uploader: 'Unknown',
            hearts: notifType === 'like' ? 1 : 0,
            likes: notifType === 'like' ? 1 : 0,
            comments: notifType === 'comment' ? [{ user: 'User', text: 'Comment', time: Date.now() }] : [],
            saves: notifType === 'save' ? 1 : 0,
            shares: notifType === 'share' ? 1 : 0,
            downloads: notifType === 'download' ? 1 : 0
        };
        category = 'presets';
    }

    currentActivityItem = item;
    currentDetailView = { type: 'sound', itemId, category };

    // Fetch notifications for this item to get who liked/saved/shared/downloaded
    currentItemNotifications = [];
    const numericItemId = itemId ? parseInt(itemId, 10) : null;
    if (typeof supabaseGetItemNotifications === 'function' && numericItemId) {
        try {
            const { data, error } = await supabaseGetItemNotifications(numericItemId);
            if (!error && data) {
                currentItemNotifications = data;
            }
        } catch (err) {
            console.error('Error fetching item notifications:', err);
        }
    }

    // Hide all detail views
    hideAllDetailViews();

    // Show sound activity view
    const soundView = document.getElementById('sound-activity-view');
    const detailPanel = document.getElementById('notif-detail-panel');

    if (soundView) {
        soundView.classList.remove('hidden');

        // Populate header
        const coverEl = document.getElementById('activity-sound-cover');
        const titleEl = document.getElementById('activity-sound-title');
        const uploaderEl = document.getElementById('activity-sound-uploader');

        if (coverEl) {
            if (item.coverArt && typeof sanitizeURL === 'function' && sanitizeURL(item.coverArt)) {
                coverEl.style.backgroundImage = `url('${sanitizeURL(item.coverArt)}')`;
                coverEl.style.backgroundSize = 'cover';
                coverEl.style.backgroundPosition = 'center';
                coverEl.innerHTML = '';
            } else {
                coverEl.style.backgroundImage = '';
                coverEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" opacity="0.5"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
            }
        }
        if (titleEl) titleEl.textContent = item.title || 'Untitled';
        if (uploaderEl) uploaderEl.textContent = `by ${item.uploader || 'Unknown'}`;

        // Update stats from fetched notifications
        const likes = currentItemNotifications.filter(n => n.type === 'like');
        const saves = currentItemNotifications.filter(n => n.type === 'save');
        const shares = currentItemNotifications.filter(n => n.type === 'share');
        const downloads = currentItemNotifications.filter(n => n.type === 'download');
        const comments = currentItemNotifications.filter(n => n.type === 'comment');

        const likesEl = document.getElementById('activity-likes');
        const commentsEl = document.getElementById('activity-comments');
        const savesEl = document.getElementById('activity-saves');
        const sharesEl = document.getElementById('activity-shares');
        const downloadsEl = document.getElementById('activity-downloads');

        if (likesEl) likesEl.textContent = likes.length || item.hearts || item.likes || 0;
        if (commentsEl) commentsEl.textContent = comments.length || (item.comments || []).length;
        if (savesEl) savesEl.textContent = saves.length || item.saves || 0;
        if (sharesEl) sharesEl.textContent = shares.length || item.shares || 0;
        if (downloadsEl) downloadsEl.textContent = downloads.length || item.downloads || 0;

        // Reset filter and render
        currentActivityFilter = 'all';
        initActivityTabs();
        renderActivityFeed(item);
    }

    if (detailPanel) detailPanel.classList.add('has-content');
}

function findItemWithCategory(itemId) {
    if (!itemId) return null;
    const id = parseInt(itemId);
    if (isNaN(id)) return null;

    const itemsRef = (typeof items !== 'undefined') ? items : (typeof window !== 'undefined' ? window.items : null);
    if (!itemsRef) return null;

    for (const category of ['presets', 'samples', 'midi', 'projects', 'originals']) {
        const categoryItems = itemsRef[category] || [];
        const found = categoryItems.find(i => i.id === id || i.id == id);
        if (found) {
            return { item: found, category };
        }
    }
    return null;
}

// ===== ROOM INVITE VIEW =====

function showRoomInviteView(notifItem) {
    const roomId = notifItem.dataset.roomId;
    const roomName = notifItem.dataset.roomName;
    const actorUsername = notifItem.dataset.actorUsername;
    const notificationId = notifItem.dataset.notificationId;

    currentDetailView = { type: 'room-invite', roomId, roomName, notificationId };

    // Hide all detail views
    hideAllDetailViews();

    // Show room invite view
    const inviteView = document.getElementById('room-invite-view');
    const detailPanel = document.getElementById('notif-detail-panel');

    if (inviteView) {
        inviteView.classList.remove('hidden');

        const roomNameEl = document.getElementById('invite-room-name');
        const fromUserEl = document.getElementById('invite-from-user');
        const acceptBtn = inviteView.querySelector('.invite-accept-btn');
        const declineBtn = inviteView.querySelector('.invite-decline-btn');
        const actionsEl = inviteView.querySelector('.invite-actions');

        if (roomNameEl) roomNameEl.textContent = roomName || 'Unknown Room';
        if (fromUserEl) fromUserEl.textContent = actorUsername || 'Someone';
        if (actionsEl) actionsEl.style.display = '';

        // Set up button handlers
        if (acceptBtn) {
            acceptBtn.onclick = () => acceptRoomInvite();
        }
        if (declineBtn) {
            declineBtn.onclick = () => declineRoomInvite();
        }
    }

    if (detailPanel) detailPanel.classList.add('has-content');
}

function acceptRoomInvite() {
    if (!currentDetailView || currentDetailView.type !== 'room-invite') return;

    const roomId = currentDetailView.roomId;
    const roomName = currentDetailView.roomName;

    // Join the room
    if (typeof joinRoom === 'function' && roomId) {
        joinRoom(roomId);
    }

    // Navigate to lounge
    document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
    document.getElementById('lounge-content')?.classList.add('active');
    document.querySelectorAll('.side-nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('.side-nav-item[data-view="lounge"]')?.classList.add('active');

    closeDetailView();

    if (typeof showToast === 'function') {
        showToast(`Joined ${roomName || 'room'}!`, 'success');
    }
}

function declineRoomInvite() {
    if (!currentDetailView || currentDetailView.type !== 'room-invite') return;

    closeDetailView();

    if (typeof showToast === 'function') {
        showToast('Invite declined', 'info');
    }
}

// ===== CLOSE DETAIL VIEW =====

function hideAllDetailViews() {
    const views = ['follow-detail-view', 'sound-activity-view', 'room-invite-view'];
    views.forEach(id => {
        const view = document.getElementById(id);
        if (view) view.classList.add('hidden');
    });
}

function closeDetailView() {
    hideAllDetailViews();

    const detailPanel = document.getElementById('notif-detail-panel');
    if (detailPanel) detailPanel.classList.remove('has-content');

    currentDetailView = null;
    currentActivityItem = null;
}

// ===== ACTIVITY TABS AND FEED =====

function initActivityTabs() {
    const tabs = document.querySelectorAll('.activity-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.filter === 'all') {
            tab.classList.add('active');
        }
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentActivityFilter = tab.dataset.filter;
            if (currentActivityItem) {
                renderActivityFeed(currentActivityItem);
            }
        };
    });
}

function renderActivityFeed(item) {
    const feed = document.getElementById('activity-feed');
    if (!feed) return;

    let html = '';
    const filter = currentActivityFilter;

    // Helper to create user row HTML (for likes, saves, shares, downloads)
    function createUserActivityRow(notification, actionText) {
        const username = notification.actor?.username || 'Someone';
        const avatar = notification.actor?.avatar_url || '';
        const timeAgo = formatNotificationTime(notification.created_at);

        const avatarHTML = avatar
            ? `<img src="${escapeAttr(avatar)}" alt="${escapeAttr(username)}" class="activity-user-avatar">`
            : `<div class="activity-user-avatar activity-user-avatar-placeholder">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
               </div>`;

        return `
            <div class="activity-user-row" data-username="${escapeAttr(username)}">
                ${avatarHTML}
                <div class="activity-user-info">
                    <span class="activity-user-name">${escapeHTML(username)}</span>
                    <span class="activity-user-action">${actionText}</span>
                </div>
                <span class="activity-user-time">${timeAgo}</span>
            </div>
        `;
    }

    // Helper to create comment row with reply button
    function createCommentRow(notification) {
        const username = notification.actor?.username || 'Someone';
        const avatar = notification.actor?.avatar_url || '';
        const timeAgo = formatNotificationTime(notification.created_at);
        const commentText = notification.comment_text || '';
        const itemId = notification.item_id || '';

        const avatarHTML = avatar
            ? `<img src="${escapeAttr(avatar)}" alt="${escapeAttr(username)}" class="activity-comment-avatar">`
            : `<div class="activity-comment-avatar activity-comment-avatar-placeholder">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
               </div>`;

        return `
            <div class="activity-comment-row" data-username="${escapeAttr(username)}" data-item-id="${escapeAttr(String(itemId))}">
                ${avatarHTML}
                <div class="activity-comment-content">
                    <div class="activity-comment-header">
                        <span class="activity-comment-username">${escapeHTML(username)}</span>
                        <span class="activity-comment-time">${timeAgo}</span>
                    </div>
                    <div class="activity-comment-text">${commentText ? escapeHTML(commentText) : '<em>commented on your sound</em>'}</div>
                    <button class="activity-reply-btn" data-item-id="${escapeAttr(String(itemId))}">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                        </svg>
                        Reply
                    </button>
                </div>
            </div>
        `;
    }

    // Comments - show with comment text and reply button
    if (filter === 'all' || filter === 'comments') {
        const comments = currentItemNotifications.filter(n => n.type === 'comment');
        if (comments.length > 0) {
            html += comments.map(n => createCommentRow(n)).join('');
        }
    }

    // Likes - show individual users
    if (filter === 'all' || filter === 'likes') {
        const likes = currentItemNotifications.filter(n => n.type === 'like');
        if (likes.length > 0) {
            html += likes.map(n => createUserActivityRow(n, 'liked')).join('');
        }
    }

    // Saves - show individual users
    if (filter === 'all' || filter === 'saves') {
        const saves = currentItemNotifications.filter(n => n.type === 'save');
        if (saves.length > 0) {
            html += saves.map(n => createUserActivityRow(n, 'saved')).join('');
        } else if (item.saves > 0 && filter === 'saves') {
            html += `<div class="activity-summary">${item.saves} user${item.saves > 1 ? 's' : ''} saved this sound</div>`;
        }
    }

    // Shares - show individual users
    if (filter === 'all' || filter === 'shares') {
        const shares = currentItemNotifications.filter(n => n.type === 'share');
        if (shares.length > 0) {
            html += shares.map(n => createUserActivityRow(n, 'shared')).join('');
        } else if (item.shares > 0 && filter === 'shares') {
            html += `<div class="activity-summary">${item.shares} user${item.shares > 1 ? 's' : ''} shared this sound</div>`;
        }
    }

    // Downloads - show individual users
    if (filter === 'all' || filter === 'downloads') {
        const downloads = currentItemNotifications.filter(n => n.type === 'download');
        if (downloads.length > 0) {
            html += downloads.map(n => createUserActivityRow(n, 'downloaded')).join('');
        } else if (item.downloads > 0 && filter === 'downloads') {
            html += `<div class="activity-summary">${item.downloads} user${item.downloads > 1 ? 's' : ''} downloaded this sound</div>`;
        }
    }

    if (html === '') {
        const filterName = filter === 'all' ? 'activity' : filter;
        feed.innerHTML = `
            <div class="activity-empty">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" opacity="0.3">
                    <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                </svg>
                <p>No ${filterName} yet</p>
            </div>
        `;
        return;
    }

    feed.innerHTML = html;
    // Event listeners handled via delegation in DOMContentLoaded
}

// Old attachActivityUserListeners removed - now using event delegation in DOMContentLoaded

function createActivityCommentHTML(comment, index) {
    const timeAgo = comment.time ? formatTimeAgo(new Date(comment.time)) : 'Just now';
    const replies = comment.replies || [];
    const hasReplies = replies.length > 0;

    const repliesHTML = hasReplies ? replies.map((r, rIdx) => `
        <div class="activity-reply" data-parent="${index}" data-reply="${rIdx}">
            <div class="activity-comment-avatar"></div>
            <div class="activity-comment-body">
                <div class="activity-comment-header">
                    <span class="activity-comment-user">${escapeHTML(r.user || 'Anonymous')}</span>
                    <span class="activity-comment-time">${r.time ? formatTimeAgo(new Date(r.time)) : 'Just now'}</span>
                </div>
                <div class="activity-comment-text">${escapeHTML(r.text || '')}</div>
            </div>
        </div>
    `).join('') : '';

    return `
        <div class="activity-comment" data-index="${index}">
            <div class="activity-comment-avatar"></div>
            <div class="activity-comment-body">
                <div class="activity-comment-header">
                    <span class="activity-comment-user">${escapeHTML(comment.user || 'Anonymous')}</span>
                    <span class="activity-comment-time">${timeAgo}</span>
                </div>
                <div class="activity-comment-text">${escapeHTML(comment.text || '')}</div>
                <div class="activity-comment-actions">
                    <button class="activity-like-btn ${comment.liked ? 'active' : ''}" data-index="${index}">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="${comment.liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span>${comment.likes || 0}</span>
                    </button>
                    <button class="activity-reply-btn" data-index="${index}">Reply</button>
                </div>
                ${hasReplies ? `
                    <button class="activity-replies-toggle" data-index="${index}">
                        <span>${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}</span>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                    <div class="activity-replies-container" style="display: none;">
                        ${repliesHTML}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Old attachActivityCommentListeners removed - now using event delegation in DOMContentLoaded

function toggleActivityCommentLike(commentIndex) {
    if (!currentActivityItem || !currentActivityItem.comments) return;

    const comment = currentActivityItem.comments[commentIndex];
    if (!comment) return;

    comment.liked = !comment.liked;
    comment.likes = (comment.likes || 0) + (comment.liked ? 1 : -1);
    if (comment.likes < 0) comment.likes = 0;

    renderActivityFeed(currentActivityItem);
}

function showActivityReplyInput(btn, commentIndex) {
    const existingInput = document.querySelector('.activity-reply-input-wrapper');
    if (existingInput) {
        existingInput.remove();
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'activity-reply-input-wrapper';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'activity-reply-input';
    input.placeholder = 'Write a reply...';
    input.autocomplete = 'off';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'activity-reply-cancel';
    cancelBtn.textContent = 'Cancel';

    const submitBtn = document.createElement('button');
    submitBtn.className = 'activity-reply-submit';
    submitBtn.textContent = 'Reply';

    wrapper.appendChild(input);
    wrapper.appendChild(cancelBtn);
    wrapper.appendChild(submitBtn);

    const commentEl = btn.closest('.activity-comment');
    if (!commentEl) return;
    const actionsEl = commentEl.querySelector('.activity-comment-actions');
    if (!actionsEl) return;
    actionsEl.insertAdjacentElement('afterend', wrapper);

    input.focus();

    cancelBtn.addEventListener('click', () => wrapper.remove());

    const submitReply = () => {
        const text = input.value.trim();
        if (text) {
            submitActivityReply(commentIndex, text);
        }
    };

    submitBtn.addEventListener('click', submitReply);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitReply();
    });
}

function submitActivityReply(commentIndex, text) {
    if (!currentActivityItem || !currentActivityItem.comments) return;

    const comment = currentActivityItem.comments[commentIndex];
    if (!comment) return;

    if (!comment.replies) comment.replies = [];
    comment.replies.push({
        user: localStorage.getItem('profileUsername') || 'You',
        text: text,
        time: Date.now()
    });

    renderActivityFeed(currentActivityItem);

    const commentsCountEl = document.getElementById('activity-comments');
    if (commentsCountEl) {
        commentsCountEl.textContent = (currentActivityItem.comments || []).length;
    }
}

// ===== CLEAR READ NOTIFICATIONS =====

function clearReadNotifications() {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;

    const readNotifs = notificationsList.querySelectorAll('.notification-item:not(.unread)');
    readNotifs.forEach(notif => notif.remove());

    updateNotifEmptyState();
}

// ===== ADD NOTIFICATION (called by other modules) =====

// Track which notifications have been created
function getNotificationHistory() {
    return safeJSONParse(localStorage.getItem('notificationHistory'), {});
}

function saveNotificationHistory(history) {
    try {
        localStorage.setItem('notificationHistory', JSON.stringify(history));
    } catch (e) {
        // Ignore storage errors
    }
}

function hasNotificationBeenCreated(type, itemId) {
    if (type === 'comment') return false; // Allow multiple comments
    const history = getNotificationHistory();
    return history[`${type}_${itemId}`] === true;
}

function markNotificationCreated(type, itemId) {
    if (type === 'comment') return;
    const history = getNotificationHistory();
    history[`${type}_${itemId}`] = true;
    saveNotificationHistory(history);
}

async function addNotification(type, itemTitle, itemId, category, username, commentText = null) {
    const actionText = {
        like: 'liked',
        save: 'saved',
        comment: 'commented on',
        share: 'shared',
        download: 'downloaded',
        follow: 'started following you'
    };

    // Check for duplicates (except comments)
    if (type !== 'comment' && type !== 'follow' && hasNotificationBeenCreated(type, itemId)) {
        return;
    }

    const currentUsername = localStorage.getItem('profileUsername');
    const currentUserId = localStorage.getItem('supabaseUserId');

    // Get item owner info
    let itemOwnerId = null;
    let itemOwnerUsername = null;

    if (category && type !== 'follow') {
        const localItem = typeof findItemById === 'function'
            ? findItemById(itemId, category)
            : items[category]?.find(i => i.id == itemId);
        if (localItem) {
            itemOwnerId = localItem.uploaderId;
            itemOwnerUsername = localItem.uploader;
        }
    }

    // Fallback to Supabase lookup
    if (!itemOwnerId && type !== 'follow' && typeof supabaseGetItem === 'function' && itemId) {
        try {
            const { data: itemData } = await supabaseGetItem(itemId);
            if (itemData) {
                itemOwnerId = itemData.uploader_id || (itemData.uploader && itemData.uploader.id);
                itemOwnerUsername = itemData.uploader && itemData.uploader.username;
            }
        } catch (err) {
            console.error('Error looking up item owner:', err);
        }
    }

    // Don't notify yourself
    if (itemOwnerId && itemOwnerId === currentUserId) {
        return;
    }
    if (itemOwnerUsername && currentUsername &&
        itemOwnerUsername.toLowerCase() === currentUsername.toLowerCase()) {
        return;
    }

    // Mark as created
    markNotificationCreated(type, itemId);

    // Save to Supabase
    if (typeof supabaseCreateNotification === 'function' && typeof supabaseGetUser === 'function') {
        try {
            const { user } = await supabaseGetUser();
            if (user && itemOwnerId) {
                const message = type === 'follow'
                    ? `${currentUsername || 'Someone'} started following you`
                    : `${currentUsername || 'Someone'} ${actionText[type] || 'interacted with'} ${itemTitle}`;

                const notificationData = {
                    user_id: itemOwnerId,
                    type,
                    actor_id: user.id,
                    item_id: itemId ? parseInt(itemId, 10) : null,
                    message
                };

                // Include comment text if this is a comment notification
                if (type === 'comment' && commentText) {
                    notificationData.comment_text = commentText;
                }

                await supabaseCreateNotification(notificationData);
            }
        } catch (err) {
            console.error('Error saving notification:', err);
        }
    }
}

// ===== HELPER: formatTimeAgo (if not globally available) =====

if (typeof formatTimeAgo !== 'function') {
    window.formatTimeAgo = function(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };
}

// ===== FOLLOW NOTIFICATION =====

async function addFollowNotification(targetUserId, targetUsername) {
    const currentUsername = localStorage.getItem('profileUsername');
    const currentUserId = localStorage.getItem('supabaseUserId');

    console.log('addFollowNotification called:', { targetUserId, targetUsername, currentUsername, currentUserId });

    // Don't notify yourself
    if (targetUserId === currentUserId) {
        console.log('Skipping self-notification');
        return;
    }

    if (!targetUserId) {
        console.error('No targetUserId provided for follow notification');
        return;
    }

    if (typeof supabaseCreateNotification === 'function') {
        try {
            const notificationData = {
                user_id: targetUserId,
                type: 'follow',
                actor_id: currentUserId
            };

            console.log('Creating follow notification:', notificationData);

            const { data, error } = await supabaseCreateNotification(notificationData);

            if (error) {
                console.error('Supabase error creating follow notification:', error);
            } else {
                console.log('Follow notification created successfully:', data);
            }
        } catch (err) {
            console.error('Error saving follow notification:', err);
        }
    } else {
        console.error('supabaseCreateNotification function not available');
    }
}

// ===== GLOBAL EXPORTS =====

window.initNotifications = initNotifications;
window.loadExistingNotifications = loadExistingNotifications;
window.subscribeToRealtimeNotifications = subscribeToRealtimeNotifications;
window.updateNotificationBadge = updateNotificationBadge;
window.addNotification = addNotification;
window.addFollowNotification = addFollowNotification;
window.closeDetailView = closeDetailView;
window.acceptRoomInvite = acceptRoomInvite;
window.declineRoomInvite = declineRoomInvite;
window.clearReadNotifications = clearReadNotifications;

// Initialize badge on page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateNotificationBadge, 200);

    // Event delegation for activity feed - handles all activity interactions
    const activityFeed = document.getElementById('activity-feed');
    if (activityFeed) {
        activityFeed.addEventListener('click', handleActivityFeedClick);
    }
});

// Delegated click handler for activity feed
function handleActivityFeedClick(e) {
    // User row click - view profile
    const userRow = e.target.closest('.activity-user-row');
    if (userRow) {
        const username = userRow.dataset.username;
        if (username && typeof viewUserProfile === 'function') {
            viewUserProfile(username, false, true);
        }
        return;
    }

    // Comment username click - view profile
    const usernameEl = e.target.closest('.activity-comment-username');
    if (usernameEl) {
        e.stopPropagation();
        const row = usernameEl.closest('.activity-comment-row');
        const username = row?.dataset.username;
        if (username && typeof viewUserProfile === 'function') {
            viewUserProfile(username, false, true);
        }
        return;
    }

    // Like button click
    const likeBtn = e.target.closest('.activity-like-btn');
    if (likeBtn) {
        const index = parseInt(likeBtn.dataset.index);
        toggleActivityCommentLike(index);
        return;
    }

    // Reply button click (activity comment reply, not item reply)
    const activityReplyBtn = e.target.closest('.activity-reply-btn[data-index]');
    if (activityReplyBtn) {
        const index = parseInt(activityReplyBtn.dataset.index);
        showActivityReplyInput(activityReplyBtn, index);
        return;
    }

    // Reply button for items (has item-id)
    const itemReplyBtn = e.target.closest('.activity-reply-btn[data-item-id]');
    if (itemReplyBtn) {
        e.stopPropagation();
        const itemId = itemReplyBtn.dataset.itemId;
        if (itemId && currentDetailView) {
            const result = findItemWithCategory(parseInt(itemId));
            if (result && result.item && typeof openCommentModal === 'function') {
                openCommentModal(result.item.id, result.category);
            }
        }
        return;
    }

    // Replies toggle click
    const repliesToggle = e.target.closest('.activity-replies-toggle');
    if (repliesToggle) {
        repliesToggle.classList.toggle('expanded');
        const repliesContainer = repliesToggle.nextElementSibling;
        if (repliesContainer) {
            repliesContainer.style.display = repliesToggle.classList.contains('expanded') ? 'block' : 'none';
        }
        return;
    }
}
