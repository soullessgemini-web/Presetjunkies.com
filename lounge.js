// ===== THE LOUNGE =====

// Current room realtime subscription
let currentRoomSubscription = null;

// Room changes subscription (for syncing room deletions across browsers)
let roomChangesSubscription = null;

// Helper to get current username consistently
function getCurrentUsername() {
    // Prefer localStorage as source of truth, fall back to global
    return localStorage.getItem('profileUsername') || currentUser || 'You';
}

// Check and show lounge intro splash (one-time)
function checkAndShowLoungeIntro() {
    const hasSeenIntro = localStorage.getItem('loungeIntroSeen');
    if (hasSeenIntro) return;

    const modal = document.getElementById('lounge-intro-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Mark as seen immediately so it won't show again even if user navigates away
        localStorage.setItem('loungeIntroSeen', 'true');
    }
}

// Dismiss lounge intro and mark as seen
function dismissLoungeIntro() {
    const modal = document.getElementById('lounge-intro-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    localStorage.setItem('loungeIntroSeen', 'true');
}

// Initialize intro dismiss button
function initLoungeIntro() {
    const dismissBtn = document.getElementById('lounge-intro-dismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', dismissLoungeIntro);
    }

    // Also allow clicking outside to dismiss
    const modal = document.getElementById('lounge-intro-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                dismissLoungeIntro();
            }
        });
    }
}

// Render My Rooms (only user-created community rooms)
function renderMyRooms() {
    const container = document.getElementById('my-rooms-list');
    if (!container) return;

    // Filter to only show rooms that still exist in communityRooms
    const validJoinedRooms = joinedRooms.filter(roomId => {
        return communityRooms.some(r => r.id == roomId);
    });

    if (validJoinedRooms.length !== joinedRooms.length) {
        joinedRooms = validJoinedRooms;
        localStorage.setItem('joinedRooms', JSON.stringify(joinedRooms));
    }

    // Filter based on selected tab
    let roomsToShow = joinedRooms;
    if (myRoomsFilter === 'favorites') {
        roomsToShow = joinedRooms.filter(roomId => favoriteRooms.some(fav => String(fav) === String(roomId)));
    } else if (myRoomsFilter === 'myroom') {
        // Only show rooms created by current user
        const profileUsername = localStorage.getItem('profileUsername');
        roomsToShow = communityRooms
            .filter(r => r.creator === currentUser || r.creator === profileUsername || r.creator === 'You')
            .map(r => r.id);
    }

    // Show empty state if no rooms match filter
    let emptyMessage = 'No rooms joined yet';
    if (myRoomsFilter === 'favorites') emptyMessage = 'No favorite rooms yet';
    if (myRoomsFilter === 'myroom') emptyMessage = 'You haven\'t created a room yet';

    if (roomsToShow.length === 0) {
        container.innerHTML = `<div class="my-rooms-empty">${escapeHTML(emptyMessage)}</div>`;
        return;
    }

    container.innerHTML = roomsToShow.map(roomId => {
        const room = communityRooms.find(r => r.id == roomId);
        if (!room) return '';

        const isFavorite = favoriteRooms.includes(roomId);
        const starIcon = `<button class="favorite-btn ${isFavorite ? 'active' : ''}" data-room="${roomId}" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
        </button>`;

        const cachedImages = roomImagesCache[roomId] || {};
        const iconImage = cachedImages.icon || room.image || room.icon;
        const unreadCount = getUnreadCount(roomId);
        return `
            <div class="lounge-room-item ${currentRoom === roomId ? 'active' : ''}" data-room="${roomId}" data-type="community">
                <div class="room-icon ${iconImage ? 'has-image' : ''}" style="${iconImage && sanitizeCSSUrl(iconImage) ? `background-image: url('${sanitizeCSSUrl(iconImage)}')` : ''}">${iconImage ? '' : '💬'}</div>
                <span class="room-name">${escapeHTML(room.name)}</span>
                <span class="room-unread-badge ${unreadCount > 0 ? 'show' : ''}" data-room="${roomId}">${unreadCount > 99 ? '99+' : unreadCount}</span>
                ${starIcon}
            </div>
        `;
    }).join('');
    // Event listeners handled via delegation in initLounge()
}

// Toggle room favorite status
function toggleFavorite(roomId) {
    const index = favoriteRooms.indexOf(roomId);
    if (index === -1) {
        favoriteRooms.push(roomId);
    } else {
        favoriteRooms.splice(index, 1);
    }
    localStorage.setItem('favoriteRooms', JSON.stringify(favoriteRooms));
    renderMyRooms();
}

// Join a room
async function joinRoom(roomId) {
    // Auth gate - must be logged in to join rooms
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    // Use string comparison for UUID compatibility
    if (isRoomJoined(roomId)) return;

    // Check if user is banned from this room
    if (isUserBanned(roomId, currentUser)) {
        return; // Silently fail - room won't show for banned users anyway
    }

    // Add to top of joined rooms
    joinedRooms.unshift(roomId);
    localStorage.setItem('joinedRooms', JSON.stringify(joinedRooms));
    renderMyRooms(); // Add to My Rooms
    renderCommunityRooms(); // Re-render to update join button state

    // Sync with Supabase
    if (typeof supabaseGetUser === 'function' && typeof supabaseJoinRoom === 'function') {
        try {
            const { user } = await supabaseGetUser();
            if (user) {
                await supabaseJoinRoom(roomId, user.id);
            }
        } catch (err) {
            console.error('Error joining room in Supabase:', err);
        }
    }
}

// Leave a room
async function leaveRoom(roomId) {
    const roomIdStr = String(roomId);
    const index = joinedRooms.findIndex(id => String(id) === roomIdStr);
    if (index === -1) return;

    joinedRooms.splice(index, 1);
    localStorage.setItem('joinedRooms', JSON.stringify(joinedRooms));

    // Also remove from favorites if it was favorited
    const favIndex = favoriteRooms.findIndex(id => String(id) === roomIdStr);
    if (favIndex !== -1) {
        favoriteRooms.splice(favIndex, 1);
        localStorage.setItem('favoriteRooms', JSON.stringify(favoriteRooms));
    }

    renderMyRooms(); // Remove from My Rooms
    renderCommunityRooms(); // Re-render to update join button state

    // If we left the current room, switch to a default room
    if (currentRoom === roomId) {
        // Select first available room or show empty state
        if (communityRooms.length > 0) {
            selectRoom(communityRooms[0].id, 'community');
        }
    }

    // Sync with Supabase
    if (typeof supabaseGetUser === 'function' && typeof supabaseLeaveRoom === 'function') {
        try {
            const { user } = await supabaseGetUser();
            if (user) {
                await supabaseLeaveRoom(roomId, user.id);
            }
        } catch (err) {
            console.error('Error leaving room in Supabase:', err);
        }
    }
}

// Show leave room confirmation modal
function showLeaveRoomModal(roomId) {
    const modal = document.getElementById('leave-room-modal');
    if (modal) {
        modal.dataset.roomId = roomId;
        modal.style.display = 'flex';
    }
}

// Hide leave room confirmation modal
function hideLeaveRoomModal() {
    const modal = document.getElementById('leave-room-modal');
    if (modal) {
        modal.style.display = 'none';
        delete modal.dataset.roomId;
    }
}

// Check if room is joined (use string comparison for UUID compatibility)
function isRoomJoined(roomId) {
    const roomIdStr = String(roomId);
    return joinedRooms.some(id => String(id) === roomIdStr);
}

// Filter community rooms based on search
function filterRooms(searchTerm) {
    const container = document.getElementById('community-rooms-list');
    const noRoomsFound = document.getElementById('no-rooms-found');
    if (!container) return;

    const term = searchTerm.toLowerCase().trim();
    const roomItems = container.querySelectorAll('.lounge-community-room');
    let visibleCount = 0;

    roomItems.forEach(room => {
        const roomName = room.querySelector('.lounge-community-room-name')?.textContent.toLowerCase() || '';
        const matches = !term || roomName.includes(term);
        room.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
    });

    // Show/hide no results message
    if (noRoomsFound) {
        noRoomsFound.style.display = (term && visibleCount === 0) ? 'block' : 'none';
    }
}

// Render community rooms
function renderCommunityRooms() {
    const container = document.getElementById('community-rooms-list');
    if (!container) return;

    const username = getCurrentUsername();
    // Filter out rooms the user is banned from or has already joined
    const visibleRooms = communityRooms.filter(room => !isUserBanned(room.id, username) && !isRoomJoined(room.id));

    container.innerHTML = visibleRooms.map((room, index) => {
        const cachedImages = roomImagesCache[room.id] || {};
        const iconImage = cachedImages.icon || room.image || room.icon;
        const unreadCount = getUnreadCount(room.id);
        return `
            <div class="lounge-community-room ${currentRoom === room.id ? 'active' : ''}" data-room="${room.id}" data-index="${index}" data-type="community">
                <div class="lounge-community-room-icon" style="${iconImage && sanitizeCSSUrl(iconImage) ? `background-image: url('${sanitizeCSSUrl(iconImage)}')` : ''}">${iconImage ? '' : escapeHTML(room.icon || '💬')}</div>
                <div class="lounge-community-room-info">
                    <div class="lounge-community-room-name">${escapeHTML(room.name)}</div>
                    <div class="lounge-community-room-members">${room.members || 0} members</div>
                </div>
                <span class="room-unread-badge ${unreadCount > 0 ? 'show' : ''}" data-room="${room.id}">${unreadCount > 99 ? '99+' : unreadCount}</span>
                <div class="room-action-btns">
                    <button class="join-room-btn" data-room="${room.id}">Join</button>
                </div>
            </div>
        `;
    }).join('');

    // Event listeners handled via delegation in initLounge()

    // Update create room button state
    updateCreateRoomButton();

    // Update edit room tab state
    updateEditRoomTab();
}

// Select room function
function selectRoom(roomId, type = 'static') {
    currentRoom = roomId;

    // Save current room to localStorage for persistence
    localStorage.setItem('lastLoungeRoom', roomId);

    // Clear unread count when entering room
    clearUnreadCount(roomId);

    // Remove active from all room items
    document.querySelectorAll('.lounge-room-item').forEach(r => r.classList.remove('active'));
    document.querySelectorAll('.lounge-community-room').forEach(r => r.classList.remove('active'));

    // Set active on selected room
    document.querySelector(`.lounge-room-item[data-room="${escapeSelector(roomId)}"]`)?.classList.add('active');
    document.querySelector(`.lounge-community-room[data-room="${escapeSelector(roomId)}"]`)?.classList.add('active');

    const loungeContent = document.getElementById('lounge-content');
    const chatArea = document.querySelector('.lounge-chat-area');
    const rightPanel = document.querySelector('.lounge-right-panel');

    // Apply room styles
    const settings = roomImagesCache[roomId] || {};
    applyRoomStyles(roomId, settings);

    const messagesContainer = document.getElementById('lounge-messages');
    if (messagesContainer) {
        const room = communityRooms.find(r => r.id == roomId);
        const roomName = room?.name || 'Room';

        // Always load messages (will fetch from Supabase if no local cache)
        loadRoomMessages(roomId);

        const chatRoomName = document.getElementById('chat-room-name');
        if (chatRoomName) chatRoomName.textContent = roomName || 'Room';

        // Update chat header icon
        const chatRoomIcon = document.getElementById('chat-room-icon');
        if (chatRoomIcon) {
            const cachedImages = roomImagesCache[roomId] || {};
            const iconImage = cachedImages.icon || room?.image;
            const cssIconUrl = sanitizeCSSUrl(iconImage);
            if (cssIconUrl) {
                chatRoomIcon.style.backgroundImage = `url('${cssIconUrl}')`;
                chatRoomIcon.innerHTML = '';
            } else {
                chatRoomIcon.style.backgroundImage = '';
                if (room?.icon) {
                    chatRoomIcon.textContent = room.icon;
                } else {
                    chatRoomIcon.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/></svg>';
                }
            }
        }

        const loungeInput = document.getElementById('lounge-input');
        if (loungeInput) loungeInput.placeholder = `Message #${roomName || 'Room'}`;

        // Update right panel - room info and rules
        updateRoomInfoPanel(roomId);

        // Update members list for the room
        updateMembersList(roomId);
    }

    // Subscribe to realtime updates for this room
    subscribeToRoomRealtime(roomId);
}
window.selectRoom = selectRoom;

// Subscribe to realtime messages for a room
function subscribeToRoomRealtime(roomId) {
    // Unsubscribe from previous room
    if (currentRoomSubscription) {
        if (typeof supabaseUnsubscribe === 'function') {
            supabaseUnsubscribe(currentRoomSubscription);
        }
        currentRoomSubscription = null;
    }

    // Subscribe to new room
    if (typeof supabaseSubscribeToRoom === 'function') {
        currentRoomSubscription = supabaseSubscribeToRoom(roomId, (newMessage) => {
            console.log('Realtime message received:', newMessage);
            // Only add if it's not from the current user (to avoid duplicates)
            const currentUsername = localStorage.getItem('profileUsername');
            if (newMessage.author?.username !== currentUsername) {
                addRealtimeMessage(roomId, newMessage);
            }
        });
        console.log('Subscribed to room:', roomId);
    }
}

// Add a realtime message to the chat
function addRealtimeMessage(roomId, message) {
    // Only add to current room
    if (roomId !== currentRoom) {
        // Increment unread count for other rooms
        incrementUnreadCount(roomId);
        return;
    }

    const messagesContainer = document.getElementById('lounge-messages');
    if (!messagesContainer) return;

    const username = message.author?.username || 'Unknown';
    const time = new Date(message.created_at);
    const content = message.content || '';
    const isGrouped = shouldGroupMessage(username, time);

    // Format the message for local storage
    const messageData = {
        id: message.id,
        author: username,
        avatar: message.author?.avatar_url || null,
        content: content,
        text: content,
        timestamp: message.created_at,
        type: message.image_url ? 'image' : 'text'
    };

    // Add to local storage
    if (!roomMessages[roomId]) {
        roomMessages[roomId] = [];
    }
    roomMessages[roomId].push(messageData);

    // Create and render the message element
    const messageEl = document.createElement('div');
    messageEl.className = 'lounge-message message-group-end';
    messageEl.classList.add(isGrouped ? 'message-continuation' : 'message-start');
    messageEl.dataset.author = username;
    messageEl.dataset.userColor = getUserColor(username);
    messageEl.dataset.msgIndex = roomMessages[roomId].length - 1;
    if (message.id) messageEl.dataset.msgId = message.id;

    if (message.image_url) {
        messageEl.innerHTML = createImageMessageHTML(message.image_url, username, time, isGrouped);
    } else {
        messageEl.innerHTML = createMessageHTML(content, username, time, isGrouped);
        // Add reactions container
        const msgBody = messageEl.querySelector('.message-body');
        if (msgBody) {
            msgBody.insertAdjacentHTML('beforeend', createReactionsHTML({}));
        }
    }

    // Check for self-mention
    if (messageContainsSelfMention(content)) {
        messageEl.classList.add('has-mention');
    }

    messagesContainer.appendChild(messageEl);

    // Update tracking for message grouping
    lastMessageAuthor = username;
    lastMessageTime = time;

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Update mention badge
    updateMentionBadge();
}

// Update members list for a room
async function updateMembersList(roomId, type) {
    const membersList = document.getElementById('room-members-list');
    const creatorList = document.getElementById('room-creator-list');
    const memberCount = document.getElementById('room-member-count');
    if (!membersList) return;

    // Get the room to find the creator
    const room = communityRooms.find(r => r.id === roomId);
    const roomCreator = room?.creator || null;

    let members = [];

    // Try local cache first
    if (roomMembers[roomId] && roomMembers[roomId].length > 0) {
        members = [...roomMembers[roomId]];
    }

    // Fetch actual room members from Supabase (if logged in)
    if (typeof supabaseGetRoomMembers === 'function' && typeof isUserLoggedIn === 'function' && isUserLoggedIn()) {
        try {
            const { data, error } = await supabaseGetRoomMembers(roomId);
            if (!error && data && data.length > 0) {
                const fifteenMinsAgo = Date.now() - (15 * 60 * 1000);
                members = data.map(m => {
                    const lastActive = m.user?.last_active_at ? new Date(m.user.last_active_at).getTime() : 0;
                    return {
                        username: m.user?.username || 'Unknown',
                        avatar: m.user?.avatar_url || null,
                        status: lastActive > fifteenMinsAgo ? 'online' : 'offline'
                    };
                });
                // Update local cache
                roomMembers[roomId] = members;
                localStorage.setItem('roomMembers', JSON.stringify(roomMembers));
            }
        } catch (err) {
            console.error('Error fetching room members:', err);
        }
    }

    // Fallback: create default entry if still empty and user is logged in
    if (members.length === 0 && currentUser) {
        const currentUserAvatar = localStorage.getItem('profileAvatar') || null;
        roomMembers[roomId] = [
            { username: currentUser, status: 'online', avatar: currentUserAvatar }
        ];
        localStorage.setItem('roomMembers', JSON.stringify(roomMembers));
        members = [...roomMembers[roomId]];
    }

    // Separate creator from other members
    const creatorMember = members.find(m => m.username === roomCreator);
    const otherMembers = members.filter(m => m.username !== roomCreator);

    // Update member count (excluding creator)
    if (memberCount) {
        memberCount.textContent = otherMembers.length;
    }

    // Render room creator
    if (creatorList) {
        if (creatorMember) {
            creatorList.innerHTML = `
                <div class="member-item" data-username="${escapeAttr(creatorMember.username)}">
                    <div class="member-avatar ${creatorMember.status === 'online' ? 'online' : ''}">
                        ${creatorMember.avatar && sanitizeURL(creatorMember.avatar)
                            ? `<img src="${escapeAttr(sanitizeURL(creatorMember.avatar))}" alt="${escapeAttr(creatorMember.username)}">`
                            : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
                        }
                    </div>
                    <div class="member-info">
                        <span class="member-name lounge-clickable-user" data-action="view-profile" data-username="${escapeAttr(creatorMember.username)}">${escapeHTML(creatorMember.username)}</span>
                    </div>
                </div>
            `;
        } else if (roomCreator) {
            // Creator not in members list yet, show with default avatar
            creatorList.innerHTML = `
                <div class="member-item" data-username="${escapeAttr(roomCreator)}">
                    <div class="member-avatar">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                    <div class="member-info">
                        <span class="member-name lounge-clickable-user" data-action="view-profile" data-username="${escapeAttr(roomCreator)}">${escapeHTML(roomCreator)}</span>
                    </div>
                </div>
            `;
        } else {
            creatorList.innerHTML = '';
        }
    }

    // Sort other members: online first, then alphabetically
    const sortedMembers = [...otherMembers].sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return a.username.localeCompare(b.username);
    });

    // Render other members
    membersList.innerHTML = sortedMembers.map(member => `
        <div class="member-item" data-username="${escapeAttr(member.username)}">
            <div class="member-avatar ${member.status === 'online' ? 'online' : ''}">
                ${member.avatar && sanitizeURL(member.avatar)
                    ? `<img src="${escapeAttr(sanitizeURL(member.avatar))}" alt="${escapeAttr(member.username)}">`
                    : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
                }
            </div>
            <div class="member-info">
                <span class="member-name lounge-clickable-user" data-action="view-profile" data-username="${escapeAttr(member.username)}">${escapeHTML(member.username)}</span>
            </div>
        </div>
    `).join('');
}

// Handle click on member - open their profile
function handleMemberClick(username) {
    if (typeof viewUserProfile === 'function') {
        viewUserProfile(username);
    }
}

// Add member to room
function addMemberToRoom(roomId, username) {
    if (!roomMembers[roomId]) {
        roomMembers[roomId] = [];
    }

    const exists = roomMembers[roomId].some(m => m.username === username);
    if (!exists) {
        // Add member without avatar - updateMembersList will fetch it
        roomMembers[roomId].push({
            username: username,
            status: 'online',
            avatar: null
        });
        localStorage.setItem('roomMembers', JSON.stringify(roomMembers));
    }

    // Refresh the list to fetch avatars
    if (currentRoom === roomId) {
        updateMembersList(roomId, 'community');
    }
}

// Remove member from room
function removeMemberFromRoom(roomId, username) {
    if (!roomMembers[roomId]) return;

    roomMembers[roomId] = roomMembers[roomId].filter(m => m.username !== username);
    localStorage.setItem('roomMembers', JSON.stringify(roomMembers));
    if (currentRoom === roomId) {
        updateMembersList(roomId, 'community');
    }
}

// Get user avatar from roomMembers or localStorage cache
function getMemberAvatar(username) {
    // Check current room members first
    if (currentRoom && roomMembers[currentRoom]) {
        const member = roomMembers[currentRoom].find(m => m.username === username);
        if (member?.avatar) return member.avatar;
    }

    // Check all rooms for this user's avatar
    for (const roomId in roomMembers) {
        const member = roomMembers[roomId]?.find(m => m.username === username);
        if (member?.avatar) return member.avatar;
    }

    // Check if it's the current user
    if (username === currentUser || username === getCurrentUsername()) {
        const myAvatar = localStorage.getItem('profileAvatar');
        if (myAvatar) return myAvatar;
    }

    return null;
}

// Update member status (online/offline)
function updateMemberStatus(username, status) {
    Object.keys(roomMembers).forEach(roomId => {
        const member = roomMembers[roomId]?.find(m => m.username === username);
        if (member) {
            member.status = status;
        }
    });
    localStorage.setItem('roomMembers', JSON.stringify(roomMembers));

    // Refresh current room members if needed
    if (currentRoom && roomMembers[currentRoom]) {
        updateMembersList(currentRoom, 'community');
    }
}

// Update right panel with room info and rules
function updateRoomInfoPanel(roomId) {
    const roomInfoName = document.getElementById('room-info-name');
    const roomInfoDesc = document.getElementById('room-info-description');
    const rulesList = document.getElementById('room-rules-list');

    const defaultRules = [
        'Be respectful to all members',
        'No spam or self-promotion',
        'Keep conversations on topic'
    ];

    const room = communityRooms.find(r => r.id == roomId);
    if (room) {
        if (roomInfoName) roomInfoName.textContent = room.name;
        if (roomInfoDesc) {
            roomInfoDesc.textContent = room.description || 'No description provided.';
            roomInfoDesc.style.display = room.description ? 'block' : 'none';
        }

        const rules = room.rules && room.rules.length > 0 ? room.rules : defaultRules;
        if (rulesList) {
            rulesList.innerHTML = rules.map((rule, i) => `
                <div class="rule-item">
                    <span class="rule-number">${i + 1}</span>
                    <span>${escapeHTML(rule)}</span>
                </div>
            `).join('');
        }

        // Show admin delete room button if admin
        let adminDeleteBtn = document.getElementById('admin-delete-room-btn');
        if (typeof isAdmin === 'function' && isAdmin()) {
            if (!adminDeleteBtn) {
                // Create the button if it doesn't exist
                adminDeleteBtn = document.createElement('button');
                adminDeleteBtn.id = 'admin-delete-room-btn';
                adminDeleteBtn.className = 'admin-delete-btn';
                adminDeleteBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Delete Room (Admin)
                `;
                const rulesContainer = rulesList?.parentElement;
                if (rulesContainer) {
                    rulesContainer.appendChild(adminDeleteBtn);
                }
            }
            adminDeleteBtn.style.display = 'flex';
            adminDeleteBtn.onclick = () => adminDeleteRoom(roomId);
        } else if (adminDeleteBtn) {
            adminDeleteBtn.style.display = 'none';
        }
    }
}

// Admin delete room function
async function adminDeleteRoom(roomId) {
    if (typeof isAdmin !== 'function' || !isAdmin()) {
        console.error('Admin access required');
        return;
    }

    const room = communityRooms.find(r => r.id == roomId);
    const roomName = room?.name || 'this room';

    if (!confirm(`Are you sure you want to delete "${roomName}"?\n\nThis will delete all messages and remove all members.\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        // Delete from Supabase
        if (typeof supabaseAdminDeleteRoom === 'function') {
            const { error } = await supabaseAdminDeleteRoom(roomId);
            if (error) {
                alert('Failed to delete room: ' + error.message);
                return;
            }
        }

        // Remove from local arrays
        const roomIndex = communityRooms.findIndex(r => r.id == roomId);
        if (roomIndex > -1) {
            communityRooms.splice(roomIndex, 1);
        }

        const joinedIndex = joinedRooms.findIndex(id => String(id) === String(roomId));
        if (joinedIndex > -1) {
            joinedRooms.splice(joinedIndex, 1);
        }

        // Clear cached images
        delete roomImagesCache[roomId];

        // Save to localStorage
        localStorage.setItem('communityRooms', JSON.stringify(communityRooms));
        localStorage.setItem('loungeJoinedRooms', JSON.stringify(joinedRooms));

        // Refresh room lists
        renderMyRooms();
        renderCommunityRooms();

        // Switch to first available room
        if (joinedRooms.length > 0) {
            selectRoom(joinedRooms[0], 'community');
        } else if (communityRooms.length > 0) {
            selectRoom(communityRooms[0].id, 'community');
        }

        if (typeof showToast === 'function') {
            showToast('Room deleted successfully', 'success');
        }
    } catch (err) {
        console.error('Error deleting room:', err);
        alert('Failed to delete room: ' + err.message);
    }
}

// Guidelines Modal Functions
function showGuidelinesModal() {
    // Auth gate - must be logged in to create rooms
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    // Double-check in case button state wasn't updated (admins bypass this)
    const isAdminUser = typeof isAdmin === 'function' && isAdmin();
    if (!isAdminUser) {
        const existingRoom = communityRooms.find(r => r.creator === currentUser);
        if (existingRoom) return;
    }

    const modal = document.getElementById('room-guidelines-modal');
    if (modal) modal.style.display = 'flex';

    // Reset checkbox and button state
    const checkbox = document.getElementById('guidelines-agree-checkbox');
    const agreeBtn = document.getElementById('guidelines-agree');
    if (checkbox) checkbox.checked = false;
    if (agreeBtn) {
        agreeBtn.disabled = true;
        agreeBtn.classList.add('disabled');
    }
}

// Update create room button based on whether user already has a room
function updateCreateRoomButton() {
    const btn = document.getElementById('create-room-btn');
    if (!btn) return;

    // Admins can create unlimited rooms
    const isAdminUser = typeof isAdmin === 'function' && isAdmin();
    if (isAdminUser) {
        btn.disabled = false;
        btn.classList.remove('disabled');
        btn.title = '';
        return;
    }

    const existingRoom = communityRooms.find(r => r.creator === currentUser);
    if (existingRoom) {
        btn.disabled = true;
        btn.classList.add('disabled');
        btn.title = 'You already have a room';
    } else {
        btn.disabled = false;
        btn.classList.remove('disabled');
        btn.title = '';
    }
}

function hideGuidelinesModal() {
    const modal = document.getElementById('room-guidelines-modal');
    if (modal) modal.style.display = 'none';
}

// Moderation Modal Functions
let pendingModAction = null;

function showModerationModal(message, action) {
    const modal = document.getElementById('moderation-modal');
    const messageEl = document.getElementById('moderation-message');
    if (modal && messageEl) {
        messageEl.textContent = message;
        pendingModAction = action;
        modal.style.display = 'flex';
    }
}

function hideModerationModal() {
    const modal = document.getElementById('moderation-modal');
    if (modal) modal.style.display = 'none';
    pendingModAction = null;
}

function confirmModerationAction() {
    if (pendingModAction) {
        pendingModAction();
    }
    hideModerationModal();
}

// Delete a message (admin/moderator)
async function deleteMessage(messageEl) {
    if (!messageEl) return;

    const msgId = messageEl.dataset.msgId;

    // Delete from Supabase if we have a message ID
    if (msgId && typeof supabaseDeleteRoomMessage === 'function') {
        const { error } = await supabaseDeleteRoomMessage(msgId);
        if (error) {
            console.error('Failed to delete message from Supabase:', error);
            alert('Failed to delete message: ' + error.message);
            return;
        }
    }

    messageEl.remove();
}

// Kick/ban a user from the room
function kickUser(username) {
    if (!currentRoom || !username) return;

    // Get room name before any changes
    const room = communityRooms.find(r => r.id === currentRoom);
    const roomName = room ? room.name : 'this room';

    // Add to banned list for this room
    if (!bannedFromRooms[currentRoom]) {
        bannedFromRooms[currentRoom] = [];
    }
    if (!bannedFromRooms[currentRoom].includes(username)) {
        bannedFromRooms[currentRoom].push(username);
        localStorage.setItem('bannedFromRooms', JSON.stringify(bannedFromRooms));
    }

    // Remove all messages from this user in current chat
    const messagesContainer = document.getElementById('lounge-messages');
    if (messagesContainer) {
        messagesContainer.querySelectorAll(`.lounge-message[data-author="${escapeSelector(username)}"]`).forEach(msg => {
            msg.remove();
        });
    }

    // If the kicked user is the current user, show banned popup
    if (username === currentUser) {
        showBannedPopup(roomName);
    }
}

// Show banned popup
function showBannedPopup(roomName) {
    let modal = document.getElementById('banned-popup-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'banned-popup-modal';
        modal.className = 'banned-popup-modal';
        modal.innerHTML = `
            <div class="banned-popup-content">
                <div class="banned-popup-icon">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                </div>
                <h3 class="banned-popup-title">You've Been Banned</h3>
                <p class="banned-popup-message"></p>
                <button class="banned-popup-btn" id="banned-popup-close">Look for a new room</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('banned-popup-close').addEventListener('click', () => {
            modal.style.display = 'none';
            // Leave the current room and go back to room list
            currentRoom = null;
            const chatView = document.getElementById('lounge-chat-view');
            const roomsView = document.getElementById('lounge-rooms-view');
            if (chatView) chatView.style.display = 'none';
            if (roomsView) roomsView.style.display = 'block';
        });
    }

    // Update message with room name
    modal.querySelector('.banned-popup-message').textContent =
        `You have been banned from ${roomName} and will no longer be able to participate.`;
    modal.style.display = 'flex';
}

// Check if a user is banned from a room
function isUserBanned(roomId, username) {
    return bannedFromRooms[roomId] && bannedFromRooms[roomId].includes(username);
}

// User message actions - Edit
function startEditMessage(messageEl) {
    const textEl = messageEl.querySelector('.message-text');
    const actionsEl = messageEl.querySelector('.message-user-actions');
    if (!textEl) return;

    // Get original text
    const originalText = textEl.dataset.originalText || textEl.textContent;

    // Use DOM API instead of innerHTML to safely set input value
    textEl.innerHTML = '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.value = originalText; // Direct assignment is safe - no HTML parsing

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'edit-actions';
    actionsDiv.innerHTML = '<button class="save-edit-btn">Save</button><button class="cancel-edit-btn">Cancel</button>';

    textEl.appendChild(input);
    textEl.appendChild(actionsDiv);

    // Hide user actions while editing
    if (actionsEl) actionsEl.style.display = 'none';

    // Focus the input
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
}

function saveEditMessage(messageEl) {
    const textEl = messageEl.querySelector('.message-text');
    const input = textEl.querySelector('.edit-input');
    const actionsEl = messageEl.querySelector('.message-user-actions');
    if (!input) return;

    const newText = input.value.trim();
    if (!newText) return;

    // Update the message
    textEl.dataset.originalText = newText;
    textEl.innerHTML = parseMessageContent(newText);

    // Add edited tag if not already present
    const header = messageEl.querySelector('.message-header');
    if (header && !header.querySelector('.message-edited')) {
        const editedSpan = document.createElement('span');
        editedSpan.className = 'message-edited';
        editedSpan.textContent = '(edited)';
        header.appendChild(editedSpan);
    }

    // Show user actions again
    if (actionsEl) actionsEl.style.display = '';
}

function cancelEditMessage(messageEl) {
    const textEl = messageEl.querySelector('.message-text');
    const actionsEl = messageEl.querySelector('.message-user-actions');
    if (!textEl) return;

    // Restore original text
    const originalText = textEl.dataset.originalText || '';
    textEl.innerHTML = parseMessageContent(originalText);

    // Show user actions again
    if (actionsEl) actionsEl.style.display = '';
}

// User message actions - Delete own message
async function deleteOwnMessage(messageEl) {
    if (!messageEl) return;

    const msgId = messageEl.dataset.msgId;

    // Delete from Supabase if we have a message ID
    if (msgId && typeof supabaseDeleteRoomMessage === 'function') {
        const { error } = await supabaseDeleteRoomMessage(msgId);
        if (error) {
            console.error('Failed to delete message from Supabase:', error);
            alert('Failed to delete message: ' + error.message);
            return;
        }
    }

    const textEl = messageEl.querySelector('.message-text');
    const imageEl = messageEl.querySelector('.message-image');
    const audioEl = messageEl.querySelector('.message-audio');
    const actionsEl = messageEl.querySelector('.message-user-actions');
    const msgBody = messageEl.querySelector('.message-body');

    // Remove image if present
    if (imageEl) {
        imageEl.remove();
    }

    // Remove audio if present
    if (audioEl) {
        audioEl.remove();
    }

    // Handle text element
    if (textEl) {
        textEl.innerHTML = '<span class="message-deleted">Message deleted</span>';
        textEl.removeAttribute('data-original-text');
    } else if (msgBody) {
        // If no text element exists (image/audio only), add deleted message
        const deletedSpan = document.createElement('div');
        deletedSpan.className = 'message-text';
        deletedSpan.innerHTML = '<span class="message-deleted">Message deleted</span>';
        msgBody.appendChild(deletedSpan);
    }

    // Remove the user actions
    if (actionsEl) actionsEl.remove();

    // Add deleted class
    messageEl.classList.add('deleted');
}

// Setup moderation event listeners (call this in initLounge)
function setupModerationListeners() {
    const messagesContainer = document.getElementById('lounge-messages');

    // Event delegation for mod buttons, user actions, and reactions
    if (messagesContainer) {
        messagesContainer.addEventListener('click', function(e) {
            const deleteBtn = e.target.closest('.delete-msg-btn');
            const kickBtn = e.target.closest('.kick-user-btn');
            const editBtn = e.target.closest('.edit-msg-btn');
            const deleteOwnBtn = e.target.closest('.delete-own-msg-btn');
            const saveEditBtn = e.target.closest('.save-edit-btn');
            const cancelEditBtn = e.target.closest('.cancel-edit-btn');
            const addReactionBtn = e.target.closest('.add-reaction-btn');
            const reactionBtn = e.target.closest('.reaction-btn');
            const reactionPickerItem = e.target.closest('.reaction-picker-item');

            // Handle reaction picker item click
            if (reactionPickerItem) {
                e.stopPropagation();
                const messageEl = reactionPickerItem.closest('.lounge-message');
                const img = reactionPickerItem.querySelector('img');
                const emojiCode = img ? img.alt : null;
                if (messageEl && emojiCode) {
                    toggleReaction(messageEl, emojiCode);
                }
                // Close the picker
                const picker = reactionPickerItem.closest('.reaction-picker');
                if (picker) picker.classList.remove('active');
                return;
            }

            // Handle reply button
            const replyBtn = e.target.closest('.reply-btn');
            if (replyBtn) {
                e.stopPropagation();
                const messageEl = replyBtn.closest('.lounge-message');
                if (messageEl) {
                    startReply(messageEl);
                }
                return;
            }

            // Handle add reaction button
            if (addReactionBtn) {
                e.stopPropagation();
                const picker = addReactionBtn.parentElement.querySelector('.reaction-picker');
                if (picker) {
                    // Close all other pickers
                    document.querySelectorAll('.reaction-picker.active').forEach(p => {
                        if (p !== picker) p.classList.remove('active');
                    });
                    // Populate picker if empty (onclick handlers are in the HTML)
                    if (!picker.innerHTML.trim()) {
                        picker.innerHTML = getReactionPickerHTML();
                    }
                    picker.classList.toggle('active');
                }
                return;
            }

            // Handle clicking existing reaction
            if (reactionBtn) {
                e.stopPropagation();
                const messageEl = reactionBtn.closest('.lounge-message');
                const emojiCode = reactionBtn.dataset.emoji;
                if (messageEl && emojiCode) {
                    toggleReaction(messageEl, emojiCode);
                }
                return;
            }

            if (deleteBtn) {
                const messageEl = deleteBtn.closest('.lounge-message');
                showModerationModal('Are you sure you want to delete this message?', () => {
                    deleteMessage(messageEl);
                });
            }

            if (kickBtn) {
                const username = kickBtn.dataset.user;
                const messageEl = kickBtn.closest('.lounge-message');
                showModerationModal(`Are you sure you want to kick ${username} from this room? They will no longer be able to join.`, () => {
                    kickUser(username);
                });
            }

            // User edit message
            if (editBtn) {
                const messageEl = editBtn.closest('.lounge-message');
                startEditMessage(messageEl);
            }

            // User delete own message
            if (deleteOwnBtn) {
                const messageEl = deleteOwnBtn.closest('.lounge-message');
                deleteOwnMessage(messageEl);
            }

            // Save edit
            if (saveEditBtn) {
                const messageEl = saveEditBtn.closest('.lounge-message');
                saveEditMessage(messageEl);
            }

            // Cancel edit
            if (cancelEditBtn) {
                const messageEl = cancelEditBtn.closest('.lounge-message');
                cancelEditMessage(messageEl);
            }
        });

        // Handle Enter key to save edit
        messagesContainer.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey && e.target.classList.contains('edit-input')) {
                e.preventDefault();
                const messageEl = e.target.closest('.lounge-message');
                saveEditMessage(messageEl);
            }
            if (e.key === 'Escape' && e.target.classList.contains('edit-input')) {
                const messageEl = e.target.closest('.lounge-message');
                cancelEditMessage(messageEl);
            }
        });
    }

    // Modal buttons
    const modCancel = document.getElementById('moderation-cancel');
    const modConfirm = document.getElementById('moderation-confirm');
    const modModal = document.getElementById('moderation-modal');

    if (modCancel) {
        modCancel.addEventListener('click', hideModerationModal);
    }

    if (modConfirm) {
        modConfirm.addEventListener('click', confirmModerationAction);
    }

    // Close on overlay click
    if (modModal) {
        modModal.addEventListener('click', function(e) {
            if (e.target === modModal) {
                hideModerationModal();
            }
        });
    }

    // Close reaction pickers when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.message-reactions') && !e.target.closest('.reaction-picker')) {
            document.querySelectorAll('.reaction-picker.active').forEach(p => {
                p.classList.remove('active');
            });
        }
    });
}

// Room Settings Panel Functions
function showRoomSettings() {
    isSettingsMode = true;

    const roomsView = document.getElementById('lounge-rooms-view');
    const settingsPanel = document.getElementById('room-settings');

    if (roomsView) roomsView.style.display = 'none';
    if (settingsPanel) settingsPanel.style.display = 'flex';

    resetPreviewSettings();
    updateLivePreview();

    const nameInput = document.getElementById('room-name-input');
    if (nameInput) nameInput.focus();
}

function hideRoomSettings() {
    isSettingsMode = false;
    isEditMode = false;
    editingRoomId = null;

    const roomsView = document.getElementById('lounge-rooms-view');
    const settingsPanel = document.getElementById('room-settings');

    if (roomsView) roomsView.style.display = 'flex';
    if (settingsPanel) settingsPanel.style.display = 'none';

    // Reset to create mode UI
    const settingsTitle = document.getElementById('settings-title');
    const settingsBtnText = document.getElementById('settings-btn-text');
    const nameInput = document.getElementById('room-name-input');

    if (settingsTitle) settingsTitle.textContent = 'Create Room';
    if (settingsBtnText) settingsBtnText.textContent = 'Create Room';
    if (nameInput) {
        nameInput.disabled = false;
        nameInput.title = '';
        nameInput.style.opacity = '1';
    }

    const deleteBtn = document.getElementById('delete-room-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';

    clearLivePreview();
    resetSettingsForm();
}

function resetPreviewSettings() {
    previewSettings = {
        name: '',
        icon: null,
        accentColor: '#e8e8e8',
        panelColor: '#101010'
    };
}

// Edit mode tracking
let isEditMode = false;
let editingRoomId = null;

// Open edit mode for user's room
function openEditRoom() {
    const userRoom = communityRooms.find(r => r.creator === currentUser);
    if (!userRoom) return;

    console.log('openEditRoom - Loading room:', userRoom);
    console.log('openEditRoom - Room rules:', userRoom.rules);
    console.log('openEditRoom - Room description:', userRoom.description);

    isEditMode = true;
    editingRoomId = userRoom.id;

    // Update UI for edit mode
    const settingsTitle = document.getElementById('settings-title');
    const settingsBtnText = document.getElementById('settings-btn-text');
    const nameInput = document.getElementById('room-name-input');

    if (settingsTitle) settingsTitle.textContent = 'Edit Room';
    if (settingsBtnText) settingsBtnText.textContent = 'Save Changes';

    const deleteBtn = document.getElementById('delete-room-btn');
    if (deleteBtn) deleteBtn.style.display = 'flex';

    // Populate form with existing room data
    if (nameInput) {
        nameInput.value = userRoom.name;
        // Disable name input if already changed once
        if (userRoom.nameChanged) {
            nameInput.disabled = true;
            nameInput.title = 'Room name can only be changed once';
            nameInput.style.opacity = '0.6';
        } else {
            nameInput.disabled = false;
            nameInput.title = '';
            nameInput.style.opacity = '1';
        }
    }

    const descInput = document.getElementById('room-description-input');
    if (descInput) {
        descInput.value = userRoom.description || '';
        const charCount = document.getElementById('desc-char-count');
        if (charCount) charCount.textContent = `${descInput.value.length}/300`;
    }

    // Populate rules
    const rules = userRoom.rules || [];
    for (let i = 1; i <= 5; i++) {
        const ruleInput = document.getElementById(`room-rule-${i}`);
        if (ruleInput) ruleInput.value = rules[i - 1] || '';
    }

    // Populate icon
    const cachedImages = roomImagesCache[userRoom.id] || {};
    const iconImage = cachedImages.icon || userRoom.image;
    if (iconImage) {
        previewSettings.icon = iconImage;
        const iconPreview = document.getElementById('room-icon-preview');
        const iconCard = document.getElementById('icon-upload-card');
        const cssIconUrl = sanitizeCSSUrl(iconImage);
        if (iconPreview && cssIconUrl) {
            iconPreview.style.backgroundImage = `url('${cssIconUrl}')`;
            iconPreview.innerHTML = '';
        }
        if (iconCard) {
            iconCard.classList.add('has-image');
            const textEl = iconCard.querySelector('.upload-card-text');
            if (textEl) textEl.textContent = 'Change icon';
        }
    }

    showRoomSettings();
}

// Save changes to existing room
async function saveRoomChanges() {
    try {
        console.log('saveRoomChanges called, editingRoomId:', editingRoomId);

        const userRoom = communityRooms.find(r => r.id === editingRoomId);
        if (!userRoom) {
            console.log('saveRoomChanges: No room found for id', editingRoomId);
            alert('Could not find room to save. editingRoomId: ' + editingRoomId);
            return;
        }

    console.log('saveRoomChanges: Found room:', userRoom.name);

    const nameInput = document.getElementById('room-name-input');
    const newName = nameInput ? nameInput.value.trim() : userRoom.name;

    console.log('saveRoomChanges: newName:', newName, 'userRoom.name:', userRoom.name, 'nameChanged:', userRoom.nameChanged);

    // Check if name is being changed for the first time
    // Compare trimmed names to avoid whitespace issues
    const namesMatch = newName.trim().toLowerCase() === userRoom.name.trim().toLowerCase();
    const isNameChanging = !userRoom.nameChanged && !namesMatch;

    console.log('saveRoomChanges: namesMatch:', namesMatch, 'isNameChanging:', isNameChanging);

    if (isNameChanging) {
        // Validate new name first
        if (!newName) {
            if (nameInput) {
                nameInput.focus();
                nameInput.style.borderColor = '#ff4444';
                setTimeout(() => nameInput.style.borderColor = '', 2000);
            }
            return;
        }

        // Validate room name for gibberish
        const nameValidation = validateInput(newName, 'room name');
        if (!nameValidation.valid) {
            if (nameInput) {
                nameInput.focus();
                nameInput.style.borderColor = '#ff4444';
                showNameError(nameValidation.error);
            }
            return;
        }

        // Check for duplicate room name
        const nameLower = newName.toLowerCase().replace(/\s+/g, '');
        const duplicateRoom = communityRooms.find(r => r.id !== editingRoomId && r.name.toLowerCase().replace(/\s+/g, '') === nameLower);
        if (duplicateRoom) {
            if (nameInput) {
                nameInput.focus();
                nameInput.style.borderColor = '#ff4444';
                showNameError(`"${newName}" is already taken`);
            }
            return;
        }
    }

    // Proceed with save (pass true if name is changing)
    console.log('saveRoomChanges: Calling performRoomSave...');
    await performRoomSave(isNameChanging);
    console.log('saveRoomChanges: performRoomSave completed');
    } catch (err) {
        console.error('saveRoomChanges error:', err);
        alert('Error saving room: ' + err.message);
    }
}

// Show name change confirmation modal
function showNameChangeModal() {
    console.log('showNameChangeModal called');
    const modal = document.getElementById('name-change-modal');
    const checkbox = document.getElementById('name-change-agree-checkbox');
    const saveBtn = document.getElementById('name-change-save');
    console.log('modal element:', modal);

    if (checkbox) {
        checkbox.checked = false;
    }
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add('disabled');
    }
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Hide name change confirmation modal
function hideNameChangeModal() {
    const modal = document.getElementById('name-change-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Delete user's room
async function deleteUserRoom() {
    const roomToDelete = editingRoomId;
    if (!roomToDelete) return;

    if (confirm('Are you sure you want to delete your room? This cannot be undone.')) {
        // Delete from Supabase first
        if (typeof supabaseDeleteRoom === 'function') {
            try {
                const { error } = await supabaseDeleteRoom(roomToDelete);
                if (error) {
                    console.error('Error deleting room from Supabase:', error);
                    alert('Failed to delete room. Please try again.');
                    return;
                }
            } catch (err) {
                console.error('Error deleting room:', err);
                alert('Failed to delete room. Please try again.');
                return;
            }
        }

        // Remove from communityRooms array
        const roomIndex = communityRooms.findIndex(r => r.id === roomToDelete);
        if (roomIndex > -1) {
            communityRooms.splice(roomIndex, 1);
        }

        // Remove from joinedRooms
        const joinedIndex = joinedRooms.indexOf(roomToDelete);
        if (joinedIndex > -1) {
            joinedRooms.splice(joinedIndex, 1);
        }

        // Clear cached images
        delete roomImagesCache[roomToDelete];

        // Save to localStorage
        localStorage.setItem('communityRooms', JSON.stringify(communityRooms));
        localStorage.setItem('joinedRooms', JSON.stringify(joinedRooms));
        localStorage.setItem('roomImagesCache', JSON.stringify(roomImagesCache));

        // Reset edit mode
        isEditMode = false;
        editingRoomId = null;

        // Hide settings panel and show rooms view
        const settingsPanel = document.getElementById('room-settings');
        const roomsView = document.getElementById('lounge-rooms-view');
        if (settingsPanel) settingsPanel.style.display = 'none';
        if (roomsView) roomsView.style.display = 'flex';

        // Refresh room lists
        renderMyRooms();
        renderCommunityRooms();

        // Switch to first available room
        if (joinedRooms.length > 0) {
            selectRoom(joinedRooms[0], 'community');
        }

        // Update edit room tab state (disabled since no room)
        updateEditRoomTab();

        // Reset the form
        resetSettingsForm();
    }
}

// Actually perform the room save
async function performRoomSave(nameIsChanging) {
    try {
        console.log('performRoomSave called, editingRoomId:', editingRoomId);

        const userRoom = communityRooms.find(r => r.id === editingRoomId);
        if (!userRoom) {
            console.log('performRoomSave: No room found for id', editingRoomId);
            alert('Could not find room to save. editingRoomId: ' + editingRoomId);
            return;
        }

        console.log('performRoomSave: Found room:', userRoom.name);

    const nameInput = document.getElementById('room-name-input');
    const descInput = document.getElementById('room-description-input');
    const newName = nameInput ? nameInput.value.trim() : userRoom.name;
    const newDescription = descInput ? descInput.value.trim() : '';

    // Collect rules
    const rules = [];
    for (let i = 1; i <= 5; i++) {
        const ruleInput = document.getElementById(`room-rule-${i}`);
        if (ruleInput && ruleInput.value.trim()) {
            rules.push(ruleInput.value.trim());
        }
    }
    console.log('performRoomSave - Rules being saved:', rules);
    console.log('performRoomSave - Description being saved:', newDescription);

    // Validate name if changing
    if (nameIsChanging) {
        const nameValidation = validateInput(newName, 'room name');
        if (!nameValidation.valid) {
            if (nameInput) {
                nameInput.focus();
                nameInput.style.borderColor = '#ff4444';
                showNameError(nameValidation.error);
            }
            return;
        }
    }

    // Validate description if provided
    if (newDescription) {
        const descValidation = validateDescription(newDescription);
        if (!descValidation.valid) {
            if (descInput) {
                descInput.focus();
                descInput.style.borderColor = '#ff4444';
                setTimeout(() => descInput.style.borderColor = '', 2000);
            }
            showNameError(descValidation.error);
            return;
        }
    }

    // Validate rules
    for (let i = 0; i < rules.length; i++) {
        const ruleValidation = validateInput(rules[i], 'rule');
        if (!ruleValidation.valid) {
            const ruleInput = document.getElementById(`room-rule-${i + 1}`);
            if (ruleInput) {
                ruleInput.focus();
                ruleInput.style.borderColor = '#ff4444';
                setTimeout(() => ruleInput.style.borderColor = '', 2000);
            }
            showNameError(ruleValidation.error);
            return;
        }
    }

    // Update name if changing
    let nameChanged = userRoom.nameChanged || false;
    if (nameIsChanging) {
        userRoom.name = newName;
        nameChanged = true;
    }

    // Update room data
    userRoom.description = newDescription;
    userRoom.rules = rules;
    userRoom.nameChanged = nameChanged;

    // Update icon if changed (with prototype pollution protection)
    if (previewSettings.icon) {
        // Validate editingRoomId to prevent prototype pollution
        if (editingRoomId === '__proto__' || editingRoomId === 'constructor' || editingRoomId === 'prototype') {
            return; // Invalid room ID - block silently
        }
        const existingCache = roomImagesCache[editingRoomId] || {};
        roomImagesCache[editingRoomId] = Object.assign(Object.create(null), existingCache, {
            icon: previewSettings.icon
        });
    }

    // Save to Supabase
    if (typeof supabaseUpdateRoom === 'function') {
        try {
            const updates = {
                name: userRoom.name,
                description: newDescription || null,
                rules: JSON.stringify(rules),  // Stringify for text column
                icon_url: previewSettings.icon || userRoom.icon || null,
                name_changed: nameChanged
            };
            console.log('performRoomSave - Saving to Supabase:', updates);

            const { error } = await supabaseUpdateRoom(editingRoomId, updates);
            if (error) {
                console.error('Error saving room to Supabase:', error);
                // Continue to save locally even if Supabase fails
            } else {
                console.log('performRoomSave - Supabase save successful');
            }
        } catch (err) {
            console.error('Error saving room:', err);
            // Continue to save locally even if Supabase fails
        }
    }

    // Save to localStorage
    console.log('performRoomSave - Saving to localStorage, room now has:', { rules: userRoom.rules, description: userRoom.description });
    localStorage.setItem('communityRooms', JSON.stringify(communityRooms));
    localStorage.setItem('roomImagesCache', JSON.stringify(roomImagesCache));

    // Reset edit mode and close panel FIRST (so screen doesn't stay blurry)
    const savedRoomId = userRoom.id;
    isEditMode = false;
    editingRoomId = null;
    hideRoomSettings();

    // Then re-render
    renderCommunityRooms();
    renderMyRooms();

    // Update room info panel if viewing this room
    if (currentRoom === savedRoomId) {
        updateRoomInfoPanel(savedRoomId, 'community');
    }
    } catch (err) {
        console.error('performRoomSave error:', err);
        alert('Error saving room: ' + err.message);
    }
}

// Update edit room tab and my room tab visibility
function updateEditRoomTab() {
    const editTab = document.getElementById('edit-room-tab');
    const myRoomTab = document.getElementById('my-room-tab');

    // Check for user's room using both currentUser and localStorage username
    const profileUsername = localStorage.getItem('profileUsername');
    const userRoom = communityRooms.find(r =>
        r.creator === currentUser ||
        r.creator === profileUsername ||
        r.creator === 'You'
    );

    if (editTab) {
        if (userRoom) {
            editTab.classList.remove('disabled');
            editTab.style.opacity = '1';
            editTab.style.cursor = 'pointer';
        } else {
            editTab.classList.add('disabled');
            editTab.style.opacity = '0.4';
            editTab.style.cursor = 'not-allowed';
        }
    }

    if (myRoomTab) {
        if (userRoom) {
            myRoomTab.classList.remove('disabled');
            myRoomTab.style.opacity = '1';
            myRoomTab.style.cursor = 'pointer';
        } else {
            myRoomTab.classList.add('disabled');
            myRoomTab.style.opacity = '0.4';
            myRoomTab.style.cursor = 'not-allowed';
        }
    }
}

function resetSettingsForm() {
    const nameInput = document.getElementById('room-name-input');
    const iconPreview = document.getElementById('room-icon-preview');
    const iconCard = document.getElementById('icon-upload-card');
    const iconInput = document.getElementById('room-icon-upload');

    if (nameInput) nameInput.value = '';

    if (iconPreview) {
        iconPreview.style.backgroundImage = '';
        iconPreview.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
            </svg>
        `;
    }
    if (iconCard) {
        iconCard.classList.remove('has-image');
        const textEl = iconCard.querySelector('.upload-card-text');
        if (textEl) textEl.textContent = 'Click to upload icon';
    }
    if (iconInput) iconInput.value = '';

    // Clear description
    const descInput = document.getElementById('room-description-input');
    const charCount = document.getElementById('desc-char-count');
    if (descInput) descInput.value = '';
    if (charCount) charCount.textContent = '0/300';

    // Clear rules
    for (let i = 1; i <= 5; i++) {
        const ruleInput = document.getElementById(`room-rule-${i}`);
        if (ruleInput) ruleInput.value = '';
    }

    resetPreviewSettings();
}

// Show error message under room name input
function showNameError(message, autoHide = false) {
    let errorEl = document.getElementById('room-name-error');
    if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.id = 'room-name-error';
        errorEl.className = 'input-error-message';
        const nameInput = document.getElementById('room-name-input');
        if (nameInput && nameInput.parentNode) {
            nameInput.parentNode.appendChild(errorEl);
        }
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';

    if (autoHide) {
        setTimeout(() => {
            errorEl.style.display = 'none';
            const nameInput = document.getElementById('room-name-input');
            if (nameInput) nameInput.style.borderColor = '';
        }, 3000);
    }
}

function hideNameError() {
    const errorEl = document.getElementById('room-name-error');
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

function updateLivePreview() {
    const chatArea = document.querySelector('.lounge-chat-area');
    const rightPanel = document.querySelector('.lounge-right-panel');
    const leftPanel = document.getElementById('lounge-display');
    const loungeContent = document.getElementById('lounge-content');

    // Fixed colors
    const accentColor = '#e8e8e8';
    const panelColor = '#101010';

    if (loungeContent) {
        loungeContent.style.setProperty('--room-accent', accentColor);
    }
    if (chatArea) chatArea.style.setProperty('--room-accent', accentColor);
    if (rightPanel) rightPanel.style.setProperty('--room-accent', accentColor);
    if (leftPanel) leftPanel.style.setProperty('--room-accent', accentColor);

    if (rightPanel) rightPanel.style.backgroundColor = panelColor;
    if (leftPanel) leftPanel.style.backgroundColor = panelColor;

    if (loungeContent) {
        loungeContent.style.backgroundImage = "linear-gradient(135deg, #101010 0%, #16213e 50%, #0f0f1a 100%)";
        loungeContent.classList.remove('has-wallpaper');
    }
    if (chatArea) chatArea.classList.remove('has-wallpaper');
}

function clearLivePreview() {
    const chatArea = document.querySelector('.lounge-chat-area');
    const rightPanel = document.querySelector('.lounge-right-panel');
    const leftPanel = document.getElementById('lounge-display');
    const loungeContent = document.getElementById('lounge-content');

    [chatArea, rightPanel, leftPanel].forEach(panel => {
        if (panel) {
            panel.classList.remove('has-wallpaper');
        }
    });

    if (loungeContent) {
        loungeContent.style.backgroundImage = "linear-gradient(135deg, #101010 0%, #16213e 50%, #0f0f1a 100%)";
        loungeContent.classList.remove('has-wallpaper');
    }

    if (currentRoom && currentRoom.startsWith('room_')) {
        const settings = roomImagesCache[currentRoom] || {};
        applyRoomStyles(currentRoom, settings);
    }
}

function applyRoomStyles(roomId, settings) {
    const chatArea = document.querySelector('.lounge-chat-area');
    const rightPanel = document.querySelector('.lounge-right-panel');
    const leftPanel = document.getElementById('lounge-display');
    const loungeContent = document.getElementById('lounge-content');

    // Fixed accent color - red
    const accentColor = '#e8e8e8';
    if (loungeContent) loungeContent.style.setProperty('--room-accent', accentColor);
    if (chatArea) chatArea.style.setProperty('--room-accent', accentColor);
    if (rightPanel) rightPanel.style.setProperty('--room-accent', accentColor);
    if (leftPanel) leftPanel.style.setProperty('--room-accent', accentColor);

    // Fixed panel color - light
    const panelColor = '#101010';
    if (rightPanel) rightPanel.style.backgroundColor = panelColor;
    if (leftPanel) leftPanel.style.backgroundColor = panelColor;

    if (loungeContent) {
        loungeContent.style.backgroundImage = "linear-gradient(135deg, #101010 0%, #16213e 50%, #0f0f1a 100%)";
        loungeContent.classList.remove('has-wallpaper');
    }
    if (chatArea) chatArea.classList.remove('has-wallpaper');
}

async function createRoomFromSettings() {
    // Check if user already has a room (limit one per user) - admins can create unlimited
    const isAdminUser = typeof isAdmin === 'function' && isAdmin();
    if (!isAdminUser) {
        const profileUsername = localStorage.getItem('profileUsername');
        const existingRoom = communityRooms.find(r => r.creator === currentUser || r.creator === profileUsername);
        if (existingRoom) {
            showNameError('You can only create one room. Delete your existing room first.');
            return;
        }
    }

    // Rate limiting - only applies to creation attempts
    if (typeof rateLimit === 'function' && !rateLimit('createRoom', 5000)) {
        showNameError('Please wait a moment before trying again.');
        return;
    }

    const nameInput = document.getElementById('room-name-input');
    const descInput = document.getElementById('room-description-input');
    const name = nameInput ? nameInput.value.trim() : '';
    const description = descInput ? descInput.value.trim() : '';

    // Length limits
    const maxNameLength = (typeof INPUT_LIMITS !== 'undefined') ? INPUT_LIMITS.ROOM_NAME : 50;
    const maxDescLength = (typeof INPUT_LIMITS !== 'undefined') ? INPUT_LIMITS.ROOM_DESCRIPTION : 500;

    if (name.length > maxNameLength) {
        showNameError(`Room name cannot exceed ${maxNameLength} characters.`);
        return;
    }

    if (description.length > maxDescLength) {
        showNameError(`Description cannot exceed ${maxDescLength} characters.`);
        return;
    }

    // Collect rules
    const rules = [];
    for (let i = 1; i <= 5; i++) {
        const ruleInput = document.getElementById(`room-rule-${i}`);
        if (ruleInput && ruleInput.value.trim()) {
            rules.push(ruleInput.value.trim());
        }
    }

    if (!name) {
        if (nameInput) {
            nameInput.focus();
            nameInput.style.borderColor = '#ff4444';
            setTimeout(() => nameInput.style.borderColor = '', 2000);
        }
        return;
    }

    // Validate room name for gibberish
    const nameValidation = validateInput(name, 'room name');
    if (!nameValidation.valid) {
        if (nameInput) {
            nameInput.focus();
            nameInput.style.borderColor = '#ff4444';
            showNameError(nameValidation.error);
        }
        return;
    }

    // Description is required
    if (!description) {
        if (descInput) {
            descInput.focus();
            descInput.style.borderColor = '#ff4444';
            setTimeout(() => descInput.style.borderColor = '', 2000);
        }
        showNameError('Room description is required.');
        return;
    }

    // Validate description content
    const descValidation = validateDescription(description);
    if (!descValidation.valid) {
        if (descInput) {
            descInput.focus();
            descInput.style.borderColor = '#ff4444';
            setTimeout(() => descInput.style.borderColor = '', 2000);
        }
        showNameError(descValidation.error);
        return;
    }

    // At least one rule is required
    if (rules.length === 0) {
        const firstRuleInput = document.getElementById('room-rule-1');
        if (firstRuleInput) {
            firstRuleInput.focus();
            firstRuleInput.style.borderColor = '#ff4444';
            setTimeout(() => firstRuleInput.style.borderColor = '', 2000);
        }
        showNameError('At least one room rule is required.');
        return;
    }

    // Validate rules
    for (let i = 0; i < rules.length; i++) {
        const ruleValidation = validateInput(rules[i], 'rule');
        if (!ruleValidation.valid) {
            const ruleInput = document.getElementById(`room-rule-${i + 1}`);
            if (ruleInput) {
                ruleInput.focus();
                ruleInput.style.borderColor = '#ff4444';
                setTimeout(() => ruleInput.style.borderColor = '', 2000);
            }
            showNameError(ruleValidation.error);
            return;
        }
    }

    // Check for duplicate room name (case-insensitive)
    const nameLower = name.toLowerCase().replace(/\s+/g, '');
    const duplicateRoom = communityRooms.find(r => r.name.toLowerCase().replace(/\s+/g, '') === nameLower);
    if (duplicateRoom) {
        if (nameInput) {
            nameInput.focus();
            nameInput.style.borderColor = '#ff4444';
            showNameError(`"${name}" is already taken`);
        }
        return;
    }

    if (!previewSettings.icon) {
        const iconCard = document.getElementById('icon-upload-card');
        if (iconCard) {
            iconCard.style.borderColor = '#ff4444';
            iconCard.style.animation = 'shake 0.3s ease';
            setTimeout(() => {
                iconCard.style.borderColor = '';
                iconCard.style.animation = '';
            }, 500);
        }
        return;
    }

    // Create room in Supabase first
    let roomId = 'room_' + Date.now();

    try {
        const { user } = await supabaseGetUser();
        if (user && typeof supabaseCreateRoom === 'function') {
            const { data: supabaseRoom, error } = await supabaseCreateRoom({
                id: roomId,
                name: name,
                description: description,
                rules: JSON.stringify(rules),  // Stringify for text column
                icon_url: previewSettings.icon,
                wallpaper_url: previewSettings.wallpaper || null,
                creator_id: user.id,
                member_count: 1
            });

            if (error) {
                console.error('Error creating room in Supabase:', error);
                showNameError('Failed to create room. Please try again.');
                return;
            }

            if (supabaseRoom) {
                roomId = supabaseRoom.id;
                // Auto-join the created room
                await supabaseJoinRoom(roomId, user.id, 'owner');
            }
        }
    } catch (err) {
        console.error('Error creating room:', err);
    }

    roomImagesCache[roomId] = {
        icon: previewSettings.icon
    };
    localStorage.setItem('roomImagesCache', JSON.stringify(roomImagesCache));

    const newRoom = {
        id: roomId,
        name: name,
        description: description,
        rules: rules,
        members: 1,
        image: previewSettings.icon || null,
        icon: previewSettings.icon || null,
        wallpaper: previewSettings.wallpaper || null,
        createdAt: Date.now(),
        creator: currentUser
    };

    communityRooms.unshift(newRoom);
    joinedRooms.unshift(roomId);
    localStorage.setItem('communityRooms', JSON.stringify(communityRooms));
    localStorage.setItem('joinedRooms', JSON.stringify(joinedRooms));

    renderCommunityRooms();
    renderMyRooms();
    hideRoomSettings();
    selectRoom(roomId, 'community');

    // Update edit room tab state (enabled since room created)
    updateEditRoomTab();
}

// Track last message author for grouping
let lastMessageAuthor = null;
let lastMessageTime = null;

// Reply state tracking
let replyingTo = null; // { messageIndex, author, content, timestamp }

// Pending media for message (image/audio to be posted with next message)
let pendingMedia = null; // { type: 'image'|'audio', data: base64, name?: string }

// Set pending media and show preview
function setPendingMedia(type, data, name = null) {
    pendingMedia = { type, data, name };
    showMediaPreview();
}

// Clear pending media
function clearPendingMedia() {
    pendingMedia = null;
    hideMediaPreview();
}

// Show media preview in input area
function showMediaPreview() {
    const inputContainer = document.querySelector('.chat-input-container');
    const inputWrapper = document.querySelector('.chat-input-wrapper');
    if (!inputContainer || !inputWrapper || !pendingMedia) return;

    // Remove existing preview
    hideMediaPreview();

    const previewEl = document.createElement('div');
    previewEl.className = 'media-preview';

    if (pendingMedia.type === 'image') {
        previewEl.innerHTML = `
            <div class="media-preview-content">
                <img src="${escapeAttr(sanitizeURL(pendingMedia.data) || '')}" alt="Preview">
                <button class="media-preview-remove" title="Remove">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;
    } else if (pendingMedia.type === 'audio') {
        previewEl.innerHTML = `
            <div class="media-preview-content audio">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                <span class="media-preview-name">${escapeHTML(pendingMedia.name || 'Audio file')}</span>
                <button class="media-preview-remove" title="Remove">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;
    }

    // Insert preview before the input wrapper
    inputContainer.insertBefore(previewEl, inputWrapper);

    // Add remove handler
    previewEl.querySelector('.media-preview-remove')?.addEventListener('click', clearPendingMedia);
}

// Hide media preview
function hideMediaPreview() {
    document.querySelector('.media-preview')?.remove();
}

// User color map for consistent colors
const userColors = {};
const colorOptions = ['green', 'blue', 'pink', 'cyan', 'emerald', 'purple'];

function getUserColor(username) {
    if (!userColors[username]) {
        userColors[username] = colorOptions[Object.keys(userColors).length % colorOptions.length];
    }
    return userColors[username];
}

// Check if message should be grouped with previous
function shouldGroupMessage(username, time) {
    if (!lastMessageAuthor) return false;
    if (lastMessageAuthor !== username) return false;

    // Group if within 5 minutes of last message
    const timeDiff = time - lastMessageTime;
    return timeDiff < 5 * 60 * 1000;
}

// Check if current user is room creator
function isRoomCreator() {
    if (!currentRoom) return false;
    const room = communityRooms.find(r => r.id === currentRoom);
    if (!room) return false;
    if (!room.creator) return false;
    const username = getCurrentUsername();
    return room.creator === username || room.creator === currentUser;
}

// Create message HTML
function createMessageHTML(text, username = 'You', time = new Date(), isGrouped = false, isEdited = false, reactions = {}, replyData = null) {
    const currentUsername = getCurrentUsername();
    const isOwnMessage = username === currentUsername || username === currentUser;
    const isAdminUser = typeof isAdmin === 'function' && isAdmin();
    const showModActions = (isRoomCreator() || isAdminUser) && !isOwnMessage;

    const modActionsHTML = showModActions ? `
        <div class="message-mod-actions">
            <button class="message-mod-btn delete-msg-btn" title="Delete message">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
            </button>
            <button class="message-mod-btn kick-user-btn" title="Kick user" data-user="${escapeAttr(username)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
                Kick
            </button>
        </div>
    ` : '';

    const userActionsHTML = isOwnMessage ? `
        <div class="message-user-actions">
            <button class="message-user-btn edit-msg-btn" title="Edit">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="message-user-btn delete-own-msg-btn" title="Delete">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        </div>
    ` : '';

    const editedTag = isEdited ? '<span class="message-edited">(edited)</span>' : '';

    const replyHTML = createReplyReferenceHTML(replyData);

    // For grouped messages, show compact layout without avatar and header
    if (isGrouped) {
        return `
            <div class="message-body">
                ${replyHTML}
                <div class="message-text" data-original-text="${escapeAttr(text)}">${parseMessageContent(escapeHTML(text))}${editedTag}</div>
            </div>
            ${userActionsHTML}
            ${modActionsHTML}
        `;
    }

    const avatar = getMemberAvatar(username);

    return `
        <div class="message-avatar">
            ${avatar && sanitizeURL(avatar)
                ? `<img src="${escapeAttr(sanitizeURL(avatar))}" alt="${escapeAttr(username)}">`
                : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
            }
        </div>
        <div class="message-body">
            <div class="message-header">
                <span class="message-author lounge-clickable-user" data-action="view-profile" data-username="${escapeAttr(username)}">${escapeHTML(username)}</span>
                <span class="message-time">${formatTimeAgo(time)}</span>
                ${editedTag}
            </div>
            ${replyHTML}
            <div class="message-text" data-original-text="${escapeAttr(text)}">${parseMentions(parseMessageContent(escapeHTML(text)))}</div>
        </div>
        ${userActionsHTML}
        ${modActionsHTML}
    `;
}

// Create reactions HTML for a message
function createReactionsHTML(reactions = {}, audioData = null) {
    const reactionEntries = Object.entries(reactions);

    // Sanitize audio URL - only allow data: URLs with audio MIME types or https URLs
    let safeAudioSrc = '';
    if (audioData && audioData.src) {
        const src = audioData.src;
        if (src.startsWith('data:audio/')) {
            safeAudioSrc = src; // Safe data URL for audio
        } else if (src.startsWith('https://')) {
            safeAudioSrc = src; // Safe HTTPS URL
        }
        // Block javascript:, http:, and other protocols
    }

    const downloadBtnHTML = (audioData && safeAudioSrc) ? `
        <a class="download-btn" href="${escapeAttr(safeAudioSrc)}" download="${escapeAttr(audioData.filename || 'audio.mp3')}" title="Download">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
        </a>
    ` : '';

    if (reactionEntries.length === 0) {
        // Still show add button on hover
        return `
            <div class="message-reactions">
                <button class="add-reaction-btn" title="Add reaction">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </button>
                <button class="reply-btn" title="Reply">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                </button>
                ${downloadBtnHTML}
                <div class="reaction-picker"></div>
            </div>
        `;
    }

    const buttonsHTML = reactionEntries.map(([emojiCode, users]) => {
        const emoji = emojiList.find(e => e.code === emojiCode);
        const isActive = users.includes(currentUser);
        const safeEmojiCode = escapeAttr(emojiCode);
        const safeFile = emoji ? escapeAttr(emoji.file) : 'default.png';
        return `
            <button class="reaction-btn ${isActive ? 'active' : ''}" data-emoji="${safeEmojiCode}">
                <img src="Emojies/${safeFile}" alt="${safeEmojiCode}">
                <span class="reaction-count">${users.length}</span>
            </button>
        `;
    }).join('');

    return `
        <div class="message-reactions">
            ${buttonsHTML}
            <button class="add-reaction-btn" title="Add reaction">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </button>
            <button class="reply-btn" title="Reply">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
            </button>
            ${downloadBtnHTML}
            <div class="reaction-picker"></div>
        </div>
    `;
}

// Create shared item message HTML
function createSharedItemMessageHTML(text, username = 'You', time = new Date(), isGrouped = false, sharedItem = null) {
    const sharedItemHTML = sharedItem ? `
        <div class="shared-item-message">
            <div class="mini-card" data-action="play-shared" data-item-id="${escapeAttr(String(sharedItem.id))}" data-category="${escapeAttr(sharedItem.category)}">
                <div class="shared-item-cover">
                    ${sharedItem.coverArt && sanitizeURL(sharedItem.coverArt) ? `<img src="${escapeAttr(sanitizeURL(sharedItem.coverArt))}" alt="">` : `
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                        </svg>
                    `}
                </div>
                <div class="shared-item-info">
                    <div class="shared-item-title">${escapeHTML(sharedItem.title)}</div>
                    <div class="shared-item-meta"><span class="shared-item-uploader" data-action="open-profile" data-username="${escapeAttr(sharedItem.uploader || sharedItem.artist || 'Unknown')}">${escapeHTML(sharedItem.uploader || sharedItem.artist || 'Unknown')}</span> • ${escapeHTML(sharedItem.mainTag || sharedItem.category)}</div>
                </div>
                <button class="shared-item-play">
                    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
            </div>
        </div>
    ` : '';

    if (isGrouped) {
        return `
            <div class="message-body">
                ${text ? `<div class="message-text">${parseMessageContent(escapeHTML(text))}</div>` : ''}
                ${sharedItemHTML}
            </div>
        `;
    }

    const avatar = getMemberAvatar(username);

    return `
        <div class="message-avatar">
            ${avatar && sanitizeURL(avatar)
                ? `<img src="${escapeAttr(sanitizeURL(avatar))}" alt="${escapeAttr(username)}">`
                : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
            }
        </div>
        <div class="message-body">
            <div class="message-header">
                <span class="message-author lounge-clickable-user" data-action="view-profile" data-username="${escapeAttr(username)}">${escapeHTML(username)}</span>
                <span class="message-time">${formatTimeAgo(time)}</span>
            </div>
            ${text ? `<div class="message-text">${parseMessageContent(escapeHTML(text))}</div>` : ''}
            ${sharedItemHTML}
        </div>
    `;
}

// Play a shared item from room chat
window.playSharedItem = function(itemId, category) {
    // Use findItemById helper (checks global items and currentProfileGroup)
    const item = typeof findItemById === 'function'
        ? findItemById(itemId, category)
        : items[category]?.find(i => i.id == itemId);
    if (item) {
        playItemInGlobalBar(item, category);
    }
};

// Global handler for lounge reaction clicks
window.handleLoungeReaction = function(emojiCode, element) {
    const picker = element.closest('.reaction-picker');
    const messageEl = element.closest('.lounge-message');
    if (messageEl && emojiCode) {
        toggleReaction(messageEl, emojiCode);
    }
    if (picker) picker.classList.remove('active');
};

// Generate reaction picker HTML
function getReactionPickerHTML() {
    // Use all emojis for reactions
    return emojiList.map(e => {
        const safeCode = escapeAttr(e.code);
        const safeFile = escapeAttr(e.file);
        return `<div class="reaction-picker-item" onclick="handleLoungeReaction('${safeCode}', this); event.stopPropagation();"><img src="Emojies/${safeFile}" alt="${safeCode}"></div>`;
    }).join('');
}

// Toggle reaction on a message
function toggleReaction(messageEl, emojiCode) {
    const msgIndex = parseInt(messageEl.dataset.msgIndex, 10);
    if (isNaN(msgIndex) || !currentRoom) return;

    // Get stored messages
    const messages = roomMessages[currentRoom] || [];
    if (!messages[msgIndex]) return;

    // Initialize reactions if not exists
    if (!messages[msgIndex].reactions) {
        messages[msgIndex].reactions = {};
    }

    const reactions = messages[msgIndex].reactions;

    // Toggle user's reaction
    if (!reactions[emojiCode]) {
        reactions[emojiCode] = [];
    }

    const userIndex = reactions[emojiCode].indexOf(currentUser);
    if (userIndex === -1) {
        reactions[emojiCode].push(currentUser);
    } else {
        reactions[emojiCode].splice(userIndex, 1);
        if (reactions[emojiCode].length === 0) {
            delete reactions[emojiCode];
        }
    }

    // Save to localStorage
    localStorage.setItem('roomMessages', JSON.stringify(roomMessages));

    // Update UI
    const reactionsContainer = messageEl.querySelector('.message-reactions');
    if (reactionsContainer) {
        reactionsContainer.outerHTML = createReactionsHTML(reactions);
    }
}

// Reply functions
function startReply(messageEl) {
    const author = messageEl.dataset.author;
    const textEl = messageEl.querySelector('.message-text');
    const content = textEl?.dataset.originalText || textEl?.textContent || '';
    const msgIndex = parseInt(messageEl.dataset.msgIndex, 10);

    replyingTo = {
        messageIndex: msgIndex,
        author: author,
        content: content,
        timestamp: new Date().toISOString()
    };

    // Show reply preview bar
    const previewBar = document.getElementById('reply-preview-bar');
    const usernameEl = document.getElementById('reply-to-username');
    const textPreview = document.getElementById('reply-preview-text');

    if (previewBar && usernameEl && textPreview) {
        usernameEl.textContent = author;
        // Truncate preview text
        const truncated = content.length > 100 ? content.substring(0, 100) + '...' : content;
        textPreview.textContent = truncated;
        previewBar.style.display = 'flex';
    }

    // Focus input and add @mention
    const input = document.getElementById('lounge-input');
    if (input) {
        input.focus();
    }
}

function cancelReply() {
    replyingTo = null;

    const previewBar = document.getElementById('reply-preview-bar');
    if (previewBar) {
        previewBar.style.display = 'none';
    }
}

// Create reply reference HTML for messages
function createReplyReferenceHTML(replyData) {
    if (!replyData) return '';

    const truncated = replyData.content.length > 60 ? replyData.content.substring(0, 60) + '...' : replyData.content;

    return `
        <div class="message-reply-reference">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
            <span class="reply-author">${escapeHTML(replyData.author)}</span>
            <span class="reply-text">${escapeHTML(truncated)}</span>
        </div>
    `;
}


// Save message to localStorage and Supabase
async function saveMessage(roomId, messageData) {
    if (!roomMessages[roomId]) {
        roomMessages[roomId] = [];
    }

    // For localStorage, don't store large base64 data (images/audio) - only store reference
    const localMessageData = { ...messageData };
    if (localMessageData.type === 'image' || localMessageData.type === 'audio') {
        // Store a placeholder for media - actual content is in Supabase
        if (localMessageData.content && localMessageData.content.startsWith('data:')) {
            localMessageData.content = '[media]';
        }
    }

    roomMessages[roomId].push(localMessageData);

    // Limit messages per room (keep last 100)
    if (roomMessages[roomId].length > 100) {
        roomMessages[roomId] = roomMessages[roomId].slice(-100);
    }

    // Try to save to localStorage with error handling for quota exceeded
    try {
        localStorage.setItem('roomMessages', JSON.stringify(roomMessages));
    } catch (err) {
        if (err.name === 'QuotaExceededError' || err.code === 22) {
            // Storage full - clear old messages from other rooms
            console.warn('localStorage quota exceeded, clearing old messages');
            const currentRoomMessages = roomMessages[roomId] || [];
            roomMessages = { [roomId]: currentRoomMessages.slice(-50) };
            try {
                localStorage.setItem('roomMessages', JSON.stringify(roomMessages));
            } catch (e) {
                console.error('Still cannot save to localStorage:', e);
            }
        }
    }

    // Save to Supabase if available
    if (typeof supabaseGetUser === 'function' && typeof supabaseSendRoomMessage === 'function') {
        try {
            const { user } = await supabaseGetUser();
            if (user) {
                let content = '';
                let imageUrl = null;
                let audioUrl = null;
                let audioFilename = null;

                if (messageData.type === 'image') {
                    // For images, content is the caption, image data goes in imageUrl
                    content = messageData.caption || '';
                    imageUrl = messageData.content;
                } else if (messageData.type === 'audio') {
                    // For audio, content is the caption, audio data goes in audioUrl
                    content = messageData.caption || '';
                    audioUrl = messageData.content;
                    audioFilename = messageData.filename || 'audio.mp3';
                } else {
                    // Text message
                    content = messageData.content || messageData.text || '';
                }

                await supabaseSendRoomMessage(
                    roomId,
                    user.id,
                    content,
                    null, // replyToId - would need to track this
                    imageUrl,
                    audioUrl,
                    audioFilename
                );
            }
        } catch (err) {
            console.error('Error saving message to Supabase:', err);
        }
    }
}

// Load messages for a room
async function loadRoomMessages(roomId) {
    const messagesContainer = document.getElementById('lounge-messages');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = '';
    lastMessageAuthor = null;
    lastMessageTime = null;

    // Try to load from Supabase first
    let messages = roomMessages[roomId] || [];

    if (typeof supabaseGetRoomMessages === 'function') {
        try {
            const { data, error } = await supabaseGetRoomMessages(roomId, 100);
            if (!error && data && data.length > 0) {
                // Transform Supabase messages to local format
                messages = data.map(msg => {
                    // Determine message type
                    let type = 'text';
                    let content = msg.content;
                    let filename = null;

                    if (msg.audio_url) {
                        type = 'audio';
                        content = msg.audio_url;
                        filename = msg.audio_filename || 'audio.mp3';
                    } else if (msg.image_url) {
                        type = 'image';
                        content = msg.image_url;
                    }

                    return {
                        id: msg.id,
                        type: type,
                        content: content,
                        caption: msg.content || '',
                        filename: filename,
                        author: msg.author?.username || 'Unknown',
                        timestamp: msg.created_at,
                        edited: msg.is_edited || false,
                        deleted: false,
                        reactions: {},
                        replyTo: msg.reply_to_id ? { id: msg.reply_to_id } : null
                    };
                });

                // Update local cache
                roomMessages[roomId] = messages;
            }
        } catch (err) {
            console.error('Error loading messages from Supabase:', err);
        }
    }

    messages.forEach((msg, index) => {
        const time = new Date(msg.timestamp);
        const isGrouped = shouldGroupMessage(msg.author, time);

        // Check if this is the last message in its group (next message is different author or doesn't exist)
        const nextMsg = messages[index + 1];
        const nextTime = nextMsg ? new Date(nextMsg.timestamp) : null;
        const isLastInGroup = !nextMsg || nextMsg.author !== msg.author ||
            (nextTime && (nextTime - time) > 5 * 60 * 1000);

        const messageEl = document.createElement('div');
        messageEl.className = 'lounge-message';
        messageEl.classList.add(isGrouped ? 'message-continuation' : 'message-start');
        if (isLastInGroup) messageEl.classList.add('message-group-end');
        messageEl.dataset.author = msg.author;
        messageEl.dataset.userColor = getUserColor(msg.author);
        messageEl.dataset.msgIndex = index;
        if (msg.id) messageEl.dataset.msgId = msg.id;

        if (msg.type === 'image') {
            messageEl.innerHTML = createImageMessageHTML(msg.content, msg.author, time, isGrouped);
        } else if (msg.type === 'audio') {
            messageEl.innerHTML = createAudioMessageHTML(msg.content, msg.filename || msg.fileName || 'audio.mp3', msg.author, time, isGrouped, msg.caption);
            // Set audio src via JavaScript to avoid HTML attribute escaping issues
            // Only allow data:audio/* or https:// URLs for security
            const audioEl = messageEl.querySelector('audio');
            if (audioEl && msg.content) {
                if (msg.content.startsWith('data:audio/') || msg.content.startsWith('https://')) {
                    audioEl.src = msg.content;
                }
            }
        } else if (msg.sharedItem) {
            messageEl.innerHTML = createSharedItemMessageHTML(msg.text || msg.content, msg.author, time, isGrouped, msg.sharedItem);
        } else {
            messageEl.innerHTML = createMessageHTML(msg.content, msg.author, time, isGrouped, msg.edited, {}, msg.replyTo);
        }

        // Add reactions only to last message in group
        if (isLastInGroup && msg.type !== 'image') {
            const msgBody = messageEl.querySelector('.message-body');
            if (msgBody) {
                const audioData = msg.type === 'audio' ? { src: msg.content, filename: msg.filename || msg.fileName || 'audio.mp3' } : null;
                msgBody.insertAdjacentHTML('beforeend', createReactionsHTML(msg.reactions || {}, audioData));
            }
        }

        if (msg.deleted) {
            messageEl.classList.add('deleted');
            const textEl = messageEl.querySelector('.message-text');
            if (textEl) textEl.innerHTML = '<span class="message-deleted">Message deleted</span>';
        }

        // Check for self-mention
        const msgContent = msg.content || msg.text || '';
        if (messageContainsSelfMention(msgContent)) {
            messageEl.classList.add('has-mention');
        }

        messagesContainer.appendChild(messageEl);

        lastMessageAuthor = msg.author;
        lastMessageTime = time;
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Update mention badge after loading messages
    updateMentionBadge();
}

// Post message function
function postLoungeMessage() {
    // Auth gate - must be logged in to post messages
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    // Rate limiting - prevent spam
    if (typeof rateLimit === 'function' && !rateLimit('loungeMessage', 500)) {
        return; // Too fast
    }

    const input = document.getElementById('lounge-input');
    if (!input) return;
    const text = input.value.trim();

    // Message length limit
    const maxLength = (typeof INPUT_LIMITS !== 'undefined') ? INPUT_LIMITS.MESSAGE : 2000;
    if (text.length > maxLength) {
        alert(`Message too long. Maximum ${maxLength} characters.`);
        return;
    }

    // Allow posting if there's text OR pending media
    if (!text && !pendingMedia) return;

    const messagesContainer = document.getElementById('lounge-messages');
    if (!messagesContainer) return;

    const username = getCurrentUsername();
    const now = new Date();

    // If we have pending media, post it first (or with text)
    if (pendingMedia) {
        if (pendingMedia.type === 'image') {
            // Post image with optional caption
            const isGrouped = shouldGroupMessage(username, now);

            const messageEl = document.createElement('div');
            messageEl.className = 'lounge-message';
            messageEl.classList.add(isGrouped ? 'message-continuation' : 'message-start');
            messageEl.dataset.author = username;
            messageEl.dataset.userColor = getUserColor(username);
            messageEl.innerHTML = createImageMessageHTML(pendingMedia.data, username, now, isGrouped, text);

            messagesContainer.appendChild(messageEl);

            // Save to localStorage
            if (currentRoom) {
                saveMessage(currentRoom, {
                    type: 'image',
                    content: pendingMedia.data,
                    caption: text || null,
                    author: username,
                    timestamp: now.toISOString()
                });
            }

            lastMessageAuthor = username;
            lastMessageTime = now;
        } else if (pendingMedia.type === 'audio') {
            // Post audio with optional caption
            const isGrouped = shouldGroupMessage(username, now);

            const messageEl = document.createElement('div');
            messageEl.className = 'lounge-message message-group-end';
            messageEl.classList.add(isGrouped ? 'message-continuation' : 'message-start');
            messageEl.dataset.author = username;
            messageEl.dataset.userColor = getUserColor(username);
            messageEl.innerHTML = createAudioMessageHTML(pendingMedia.data, pendingMedia.name, username, now, isGrouped, text);

            // Set audio src via JavaScript to avoid HTML attribute escaping issues
            // Only allow data:audio/* URLs for security
            const audioEl = messageEl.querySelector('audio');
            if (audioEl && pendingMedia.data && pendingMedia.data.startsWith('data:audio/')) {
                audioEl.src = pendingMedia.data;
            }

            // Add reactions with download button for audio
            const msgBody = messageEl.querySelector('.message-body');
            if (msgBody) {
                msgBody.insertAdjacentHTML('beforeend', createReactionsHTML({}, { src: pendingMedia.data, filename: pendingMedia.name }));
            }

            messagesContainer.appendChild(messageEl);

            // Save to localStorage
            if (currentRoom) {
                saveMessage(currentRoom, {
                    type: 'audio',
                    content: pendingMedia.data,
                    filename: pendingMedia.name,
                    caption: text || null,
                    author: username,
                    timestamp: now.toISOString()
                });
            }

            lastMessageAuthor = username;
            lastMessageTime = now;
        }

        // Clear pending media
        clearPendingMedia();
        input.value = '';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return;
    }

    // Text-only message (original logic)
    // If replying, don't group with previous messages
    const isGrouped = replyingTo ? false : shouldGroupMessage(username, now);

    // If continuing a group, remove reactions from previous message
    if (isGrouped) {
        const prevMessage = messagesContainer.lastElementChild;
        if (prevMessage) {
            const prevReactions = prevMessage.querySelector('.message-reactions');
            if (prevReactions) prevReactions.remove();
            prevMessage.classList.remove('message-group-end');
        }
    }

    // Capture reply data before clearing
    const replyData = replyingTo ? {
        author: replyingTo.author,
        content: replyingTo.content
    } : null;

    const messageEl = document.createElement('div');
    messageEl.className = 'lounge-message message-group-end';
    messageEl.classList.add(isGrouped ? 'message-continuation' : 'message-start');
    messageEl.dataset.author = username;
    messageEl.dataset.userColor = getUserColor(username);
    messageEl.dataset.msgIndex = (roomMessages[currentRoom] || []).length;
    messageEl.innerHTML = createMessageHTML(text, username, now, isGrouped, false, {}, replyData);

    // Add reactions to the new message (it's now the last in group)
    const msgBody = messageEl.querySelector('.message-body');
    if (msgBody) {
        msgBody.insertAdjacentHTML('beforeend', createReactionsHTML({}));
    }

    // Check for self-mention in new message
    if (messageContainsSelfMention(text)) {
        messageEl.classList.add('has-mention');
    }

    messagesContainer.appendChild(messageEl);

    // Save to localStorage
    if (currentRoom) {
        saveMessage(currentRoom, {
            type: 'text',
            content: text,
            author: username,
            timestamp: now.toISOString(),
            edited: false,
            deleted: false,
            replyTo: replyData
        });
    }

    // Update tracking
    lastMessageAuthor = username;
    lastMessageTime = now;

    // Clear reply state
    cancelReply();

    input.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Update mention badge
    updateMentionBadge();
}

// Post image message
function postLoungeImage(imageData) {
    const messagesContainer = document.getElementById('lounge-messages');
    if (!messagesContainer) return;

    const username = getCurrentUsername();
    const now = new Date();
    const isGrouped = shouldGroupMessage(username, now);

    const messageEl = document.createElement('div');
    messageEl.className = 'lounge-message';
    messageEl.classList.add(isGrouped ? 'message-continuation' : 'message-start');
    messageEl.dataset.author = username;
    messageEl.dataset.userColor = getUserColor(username);
    messageEl.dataset.msgIndex = (roomMessages[currentRoom] || []).length;
    messageEl.innerHTML = createImageMessageHTML(imageData, username, now, isGrouped);

    messagesContainer.appendChild(messageEl);

    // Save to localStorage (note: large images may exceed storage limits)
    if (currentRoom) {
        saveMessage(currentRoom, {
            type: 'image',
            content: imageData,
            author: username,
            timestamp: now.toISOString()
        });
    }

    lastMessageAuthor = username;
    lastMessageTime = now;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Post audio message
function postLoungeAudio(audioData, fileName) {
    const messagesContainer = document.getElementById('lounge-messages');
    if (!messagesContainer) return;

    const username = getCurrentUsername();
    const now = new Date();
    const isGrouped = shouldGroupMessage(username, now);

    const messageEl = document.createElement('div');
    messageEl.className = 'lounge-message';
    messageEl.classList.add(isGrouped ? 'message-continuation' : 'message-start');
    messageEl.dataset.author = username;
    messageEl.dataset.userColor = getUserColor(username);
    messageEl.dataset.msgIndex = (roomMessages[currentRoom] || []).length;
    messageEl.innerHTML = createAudioMessageHTML(audioData, fileName, username, now, isGrouped);

    messagesContainer.appendChild(messageEl);

    // Save to localStorage (note: large audio files may exceed storage limits)
    if (currentRoom) {
        saveMessage(currentRoom, {
            type: 'audio',
            content: audioData,
            fileName: fileName,
            author: username,
            timestamp: now.toISOString()
        });
    }

    lastMessageAuthor = username;
    lastMessageTime = now;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Create image message HTML
function createImageMessageHTML(imageData, username = 'You', time = new Date(), isGrouped = false, caption = '') {
    const currentUsername = getCurrentUsername();
    const isOwnMessage = username === currentUsername || username === currentUser;
    const isAdminUser = typeof isAdmin === 'function' && isAdmin();
    const showModActions = (isRoomCreator() || isAdminUser) && !isOwnMessage;

    const modActionsHTML = showModActions ? `
        <div class="message-mod-actions">
            <button class="message-mod-btn delete-msg-btn" title="Delete message">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
            </button>
            <button class="message-mod-btn kick-user-btn" title="Kick user" data-user="${escapeAttr(username)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
                Kick
            </button>
        </div>
    ` : '';

    // User's own message - only delete (can't edit images)
    const userActionsHTML = isOwnMessage ? `
        <div class="message-user-actions">
            <button class="message-user-btn delete-own-msg-btn" title="Delete">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        </div>
    ` : '';

    const captionHTML = caption ? `<div class="message-text">${escapeHTML(caption)}</div>` : '';

    const avatar = getMemberAvatar(username);

    return `
        <div class="message-avatar">
            ${avatar && sanitizeURL(avatar)
                ? `<img src="${escapeAttr(sanitizeURL(avatar))}" alt="${escapeAttr(username)}">`
                : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
            }
        </div>
        <div class="message-body">
            <div class="message-header">
                <span class="message-author">${escapeHTML(username)}</span>
                <span class="message-time">${formatTimeAgo(time)}</span>
            </div>
            ${captionHTML}
            <div class="message-image">
                <img src="${escapeAttr(sanitizeURL(imageData) || '')}" alt="Shared image" class="message-image-preview" data-action="open-image-preview">
            </div>
        </div>
        ${userActionsHTML}
        ${modActionsHTML}
    `;
}

// Create audio message HTML
function createAudioMessageHTML(audioData, fileName, username = 'You', time = new Date(), isGrouped = false, caption = '') {
    const currentUsername = getCurrentUsername();
    const isOwnMessage = username === currentUsername || username === currentUser;
    const isAdminUser = typeof isAdmin === 'function' && isAdmin();
    const showModActions = (isRoomCreator() || isAdminUser) && !isOwnMessage;

    const modActionsHTML = showModActions ? `
        <div class="message-mod-actions">
            <button class="message-mod-btn delete-msg-btn" title="Delete message">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
            </button>
            <button class="message-mod-btn kick-user-btn" title="Kick user" data-user="${escapeAttr(username)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
                Kick
            </button>
        </div>
    ` : '';

    // User's own message - only delete (can't edit audio)
    const userActionsHTML = isOwnMessage ? `
        <div class="message-user-actions">
            <button class="message-user-btn delete-own-msg-btn" title="Delete">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        </div>
    ` : '';

    const captionHTML = caption ? `<div class="message-text">${escapeHTML(caption)}</div>` : '';

    const avatar = getMemberAvatar(username);

    return `
        <div class="message-avatar">
            ${avatar && sanitizeURL(avatar)
                ? `<img src="${escapeAttr(sanitizeURL(avatar))}" alt="${escapeAttr(username)}">`
                : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
            }
        </div>
        <div class="message-body">
            <div class="message-header">
                <span class="message-author">${escapeHTML(username)}</span>
                <span class="message-time">${formatTimeAgo(time)}</span>
            </div>
            ${captionHTML}
            <div class="message-audio" data-audio-src="${escapeAttr(audioData)}" data-filename="${escapeAttr(fileName)}">
                <audio controls preload="metadata"></audio>
                <span class="audio-filename">${escapeHTML(fileName)}</span>
            </div>
        </div>
        ${userActionsHTML}
        ${modActionsHTML}
    `;
}

// Open image in preview modal
function openImagePreview(src) {
    let modal = document.getElementById('image-preview-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-preview-modal';
        modal.className = 'image-preview-modal';
        modal.innerHTML = `
            <div class="image-preview-content">
                <img src="" alt="Preview">
                <button class="image-preview-close">&times;</button>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('image-preview-close')) {
                modal.style.display = 'none';
            }
        });
    }

    const safeSrc = sanitizeURL(src);
    if (safeSrc) {
        modal.querySelector('img').src = safeSrc;
        modal.style.display = 'flex';
    }
}

// Setup room settings event listeners
function setupRoomSettingsListeners() {
    const createRoomBtn = document.getElementById('create-room-btn');
    const settingsCancel = document.getElementById('settings-cancel');
    const settingsCreate = document.getElementById('settings-create');
    const nameInput = document.getElementById('room-name-input');

    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', showGuidelinesModal);
    }

    // Guidelines modal handlers
    const guidelinesModal = document.getElementById('room-guidelines-modal');
    const guidelinesCancel = document.getElementById('guidelines-cancel');
    const guidelinesAgree = document.getElementById('guidelines-agree');
    const guidelinesCheckbox = document.getElementById('guidelines-agree-checkbox');

    if (guidelinesCancel) {
        guidelinesCancel.addEventListener('click', hideGuidelinesModal);
    }

    // Checkbox enables/disables agree button
    if (guidelinesCheckbox && guidelinesAgree) {
        guidelinesCheckbox.addEventListener('change', function() {
            if (this.checked) {
                guidelinesAgree.disabled = false;
                guidelinesAgree.classList.remove('disabled');
            } else {
                guidelinesAgree.disabled = true;
                guidelinesAgree.classList.add('disabled');
            }
        });
    }

    if (guidelinesAgree) {
        guidelinesAgree.addEventListener('click', function() {
            if (this.disabled) return;
            hideGuidelinesModal();
            showRoomSettings();
        });
    }

    // Close modal on overlay click
    if (guidelinesModal) {
        guidelinesModal.addEventListener('click', function(e) {
            if (e.target === guidelinesModal) {
                hideGuidelinesModal();
            }
        });
    }

    if (settingsCancel) {
        settingsCancel.addEventListener('click', hideRoomSettings);
    }

    if (settingsCreate) {
        settingsCreate.addEventListener('click', function() {
            console.log('Settings button clicked, isEditMode:', isEditMode);
            if (isEditMode) {
                saveRoomChanges();
            } else {
                createRoomFromSettings();
            }
        });
    } else {
        console.error('settings-create button not found!');
    }

    const deleteRoomBtn = document.getElementById('delete-room-btn');
    if (deleteRoomBtn) {
        deleteRoomBtn.addEventListener('click', deleteUserRoom);
    }

    if (nameInput) {
        nameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                if (isEditMode) {
                    saveRoomChanges();
                } else {
                    createRoomFromSettings();
                }
            }
        });

        // Real-time duplicate name check
        nameInput.addEventListener('input', function() {
            const name = this.value.trim();
            if (!name) {
                hideNameError();
                this.style.borderColor = '';
                return;
            }

            // Check for duplicate room name (case-insensitive, ignore spaces)
            const nameLower = name.toLowerCase().replace(/\s+/g, '');
            const currentUserRoom = isEditMode ? communityRooms.find(r => r.id === editingRoomId) : null;
            const duplicateRoom = communityRooms.find(r => {
                // Skip current room if editing
                if (isEditMode && currentUserRoom && r.id === currentUserRoom.id) return false;
                return r.name.toLowerCase().replace(/\s+/g, '') === nameLower;
            });

            if (duplicateRoom) {
                this.style.borderColor = '#ff4444';
                showNameError(`"${name}" is already taken`);
            } else {
                this.style.borderColor = '';
                hideNameError();
            }
        });
    }

    // Description character count
    const descInput = document.getElementById('room-description-input');
    const charCount = document.getElementById('desc-char-count');
    if (descInput && charCount) {
        descInput.addEventListener('input', function() {
            charCount.textContent = `${this.value.length}/300`;
        });
    }

    // Icon upload
    const iconUploadCard = document.getElementById('icon-upload-card');
    const iconUpload = document.getElementById('room-icon-upload');
    const iconPreview = document.getElementById('room-icon-preview');

    if (iconUploadCard) {
        iconUploadCard.addEventListener('click', () => iconUpload?.click());
    }
    if (iconUpload) {
        iconUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // File size validation - max 5MB for images
            const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
            if (file.size > MAX_FILE_SIZE) {
                alert('File too large. Maximum size is 5MB.');
                e.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                previewSettings.icon = event.target.result;
                const cssUrl = sanitizeCSSUrl(event.target.result);
                if (iconPreview && cssUrl) {
                    iconPreview.style.backgroundImage = `url('${cssUrl}')`;
                    iconPreview.innerHTML = '';
                }
                if (iconUploadCard) {
                    iconUploadCard.classList.add('has-image');
                    const textEl = iconUploadCard.querySelector('.upload-card-text');
                    if (textEl) textEl.textContent = 'Click to change icon';
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // Name change confirmation modal handlers
    const nameChangeModal = document.getElementById('name-change-modal');
    const nameChangeCheckbox = document.getElementById('name-change-agree-checkbox');
    const nameChangeSaveBtn = document.getElementById('name-change-save');
    const nameChangeCancelBtn = document.getElementById('name-change-cancel');

    if (nameChangeCheckbox && nameChangeSaveBtn) {
        nameChangeCheckbox.addEventListener('change', function() {
            if (this.checked) {
                nameChangeSaveBtn.disabled = false;
                nameChangeSaveBtn.classList.remove('disabled');
            } else {
                nameChangeSaveBtn.disabled = true;
                nameChangeSaveBtn.classList.add('disabled');
            }
        });
    }

    if (nameChangeSaveBtn) {
        nameChangeSaveBtn.addEventListener('click', async function() {
            hideNameChangeModal();
            await performRoomSave(true);
        });
    }

    if (nameChangeCancelBtn) {
        nameChangeCancelBtn.addEventListener('click', hideNameChangeModal);
    }

    if (nameChangeModal) {
        nameChangeModal.addEventListener('click', function(e) {
            if (e.target === nameChangeModal) {
                hideNameChangeModal();
            }
        });
    }

}

// Typing indicator functions
let typingTimeout = null;
let typingUsers = new Set();

function showTypingIndicator(username) {
    const indicator = document.getElementById('lounge-typing-indicator');
    if (!indicator) return;

    typingUsers.add(username);
    updateTypingText();
    indicator.classList.add('active');
}

function hideTypingIndicator(username) {
    const indicator = document.getElementById('lounge-typing-indicator');
    if (!indicator) return;

    if (username) {
        typingUsers.delete(username);
    } else {
        typingUsers.clear();
    }

    if (typingUsers.size === 0) {
        indicator.classList.remove('active');
    } else {
        updateTypingText();
    }
}

function updateTypingText() {
    const indicator = document.getElementById('lounge-typing-indicator');
    if (!indicator) return;

    const textEl = indicator.querySelector('.typing-text');
    if (!textEl) return;

    const users = Array.from(typingUsers);

    if (users.length === 1) {
        textEl.innerHTML = `<strong>${escapeHTML(users[0])}</strong> is typing...`;
    } else if (users.length === 2) {
        textEl.innerHTML = `<strong>${escapeHTML(users[0])}</strong> and <strong>${escapeHTML(users[1])}</strong> are typing...`;
    } else if (users.length === 3) {
        textEl.innerHTML = `<strong>${escapeHTML(users[0])}</strong>, <strong>${escapeHTML(users[1])}</strong>, and <strong>${escapeHTML(users[2])}</strong> are typing...`;
    } else if (users.length > 3) {
        textEl.innerHTML = `<strong>${escapeHTML(users[0])}</strong>, <strong>${escapeHTML(users[1])}</strong>, and ${users.length - 2} others are typing...`;
    }
}

// Emoji Picker Functions
function setupEmojiPicker() {
    // Define all emoji picker configurations
    const emojiPickerConfigs = [
        { btnId: 'lounge-emoji-btn', pickerId: 'lounge-emoji-picker', inputId: 'lounge-input' },
        { btnId: 'profile-emoji-btn', pickerId: 'profile-emoji-picker', inputId: 'profile-comments-input' },
        { btnId: 'center-panel-emoji-btn', pickerId: 'center-panel-emoji-picker', inputId: 'center-panel-input' },
        { btnId: 'comment-modal-emoji-btn', pickerId: 'comment-modal-emoji-picker', inputId: 'comment-input' }
    ];

    // Store all pickers and buttons for global close handling
    const allPickers = [];
    const allButtons = [];

    emojiPickerConfigs.forEach(config => {
        const emojiBtn = document.getElementById(config.btnId);
        const emojiPicker = document.getElementById(config.pickerId);
        const targetInput = document.getElementById(config.inputId);

        if (emojiBtn && emojiPicker) {
            allPickers.push(emojiPicker);
            allButtons.push(emojiBtn);

            // Toggle picker on button click
            emojiBtn.addEventListener('click', function(e) {
                e.stopPropagation();

                // Auth gate for lounge emoji button
                if (config.btnId === 'lounge-emoji-btn') {
                    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
                        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
                        return;
                    }
                }

                // Close all other pickers first
                allPickers.forEach(p => {
                    if (p !== emojiPicker) p.style.display = 'none';
                });

                const isVisible = emojiPicker.style.display === 'block';
                emojiPicker.style.display = isVisible ? 'none' : 'block';
            });

            // Handle emoji selection
            emojiPicker.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent document click from closing picker prematurely
                const emojiItem = e.target.closest('.emoji-item');
                if (emojiItem) {
                    const emojiAlt = emojiItem.alt;

                    // Insert emoji code to the input - get fresh reference
                    const input = document.getElementById(config.inputId);
                    if (input) {
                        input.value += `:${emojiAlt}:`;
                        input.focus();
                    }

                    // Close picker
                    emojiPicker.style.display = 'none';
                }
            });
        }
    });

    // Close all pickers when clicking outside
    document.addEventListener('click', function(e) {
        allPickers.forEach((picker, index) => {
            if (!picker.contains(e.target) && e.target !== allButtons[index]) {
                picker.style.display = 'none';
            }
        });
    });
}

// Convert emoji codes to images in message text
function parseEmojis(text) {
    return text.replace(/:([a-zA-Z0-9_-]+):/g, (match, code) => {
        const emoji = emojiList.find(e => e.code === code);
        if (emoji) {
            // Escape file path and alt to prevent injection
            const safeFile = escapeAttr(emoji.file);
            const safeCode = escapeAttr(code);
            return `<img src="Emojies/${safeFile}" alt="${safeCode}" class="chat-emoji">`;
        }
        return match;
    });
}
window.parseEmojis = parseEmojis;

// Decode HTML entities for URL processing (safe version using DOMParser)
function decodeHTMLEntities(text) {
    if (!text || typeof text !== 'string') return '';
    // Use DOMParser which is safer than innerHTML - it won't execute scripts
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.documentElement.textContent || '';
}

// Parse URLs and create link preview cards
function parseLinkPreviews(text) {
    // URL regex pattern - more restrictive to prevent ReDoS
    // Limits URL length and uses possessive-like matching with specific character classes
    const urlRegex = /(https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(?:\/[^\s<]{0,500})?)/g;

    return text.replace(urlRegex, (matchedUrl) => {
        try {
            // Don't decode - input is already escaped, work with the URL as-is
            // Only allow http/https URLs (already enforced by regex)
            const urlObj = new URL(matchedUrl);

            // Extra validation - only allow http/https protocols
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                return escapeHTML(matchedUrl);
            }

            const domain = urlObj.hostname.replace('www.', '');
            const favicon = `https://www.google.com/s2/favicons?domain=${escapeAttr(domain)}&sz=32`;
            const displayUrl = matchedUrl.length > 50 ? matchedUrl.substring(0, 50) + '...' : matchedUrl;

            return `<a href="${escapeAttr(matchedUrl)}" class="link-preview-card" target="_blank" rel="noopener noreferrer">
                <img src="${escapeAttr(favicon)}" class="link-preview-favicon" alt="">
                <div class="link-preview-info">
                    <span class="link-preview-domain">${escapeHTML(domain)}</span>
                    <span class="link-preview-url">${escapeHTML(displayUrl)}</span>
                </div>
                <svg class="link-preview-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
            </a>`;
        } catch {
            // If URL parsing fails, just return the escaped text (no link)
            return escapeHTML(matchedUrl);
        }
    });
}

// Combined parser for messages - emojis first, then links
function parseMessageContent(text) {
    let parsed = parseEmojis(text);
    parsed = parseLinkPreviews(parsed);
    return parsed;
}

// Populate all emoji picker grids from emojiList
function populateEmojiPickers() {
    const grids = document.querySelectorAll('.emoji-picker-grid');
    const html = emojiList.map(e => {
        const safeFile = escapeAttr(e.file);
        const safeCode = escapeAttr(e.code);
        return `<img src="Emojies/${safeFile}" alt="${safeCode}" class="emoji-item">`;
    }).join('');

    grids.forEach(grid => {
        grid.innerHTML = html;
    });
}

// Invite system - stored codes with room mappings
let roomInviteCodes = safeJSONParse(localStorage.getItem('roomInviteCodes'), {});

// Generate a random invite code using cryptographically secure randomness
function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    // Use crypto.getRandomValues for secure randomness
    const randomValues = new Uint32Array(8);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < 8; i++) {
        code += chars[randomValues[i] % chars.length];
        if (i === 3) code += '-';
    }
    return code;
}

// Get or create invite code for a room
function getInviteCode(roomId) {
    // Check if valid code exists
    if (roomInviteCodes[roomId]) {
        const codeData = roomInviteCodes[roomId];
        // Check if expired (24 hours)
        if (Date.now() - codeData.created < 24 * 60 * 60 * 1000) {
            return codeData.code;
        }
    }

    // Generate new code
    const code = generateInviteCode();
    roomInviteCodes[roomId] = {
        code: code,
        created: Date.now()
    };
    localStorage.setItem('roomInviteCodes', JSON.stringify(roomInviteCodes));
    return code;
}

// Find room by invite code
function findRoomByInviteCode(code) {
    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');

    for (const [roomId, codeData] of Object.entries(roomInviteCodes)) {
        const storedCode = codeData.code.replace('-', '');
        // Check if code matches and not expired
        if (storedCode === normalizedCode && Date.now() - codeData.created < 24 * 60 * 60 * 1000) {
            return roomId;
        }
    }
    return null;
}

// Open invite modal
function openInviteModal() {
    if (!currentRoom) return;

    const modal = document.getElementById('invite-modal');
    const codeInput = document.getElementById('invite-code');
    const joinInput = document.getElementById('join-code-input');
    const joinError = document.getElementById('join-error');

    if (modal && codeInput) {
        const code = getInviteCode(currentRoom);
        codeInput.value = code;
        if (joinInput) joinInput.value = '';
        if (joinError) joinError.style.display = 'none';
        modal.style.display = 'flex';
    }
}

// Close invite modal
function closeInviteModal() {
    const modal = document.getElementById('invite-modal');
    if (modal) modal.style.display = 'none';
}

// Copy invite code to clipboard
function copyInviteCode() {
    const codeInput = document.getElementById('invite-code');
    const copyBtn = document.getElementById('copy-invite-btn');

    if (codeInput && copyBtn) {
        navigator.clipboard.writeText(codeInput.value).then(() => {
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                Copied!
            `;

            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy
                `;
            }, 2000);
        });
    }
}

// Join room with invite code
function joinWithInviteCode() {
    const codeInput = document.getElementById('join-code-input');
    const errorEl = document.getElementById('join-error');

    if (!codeInput) return;

    const code = codeInput.value.trim();
    if (!code) {
        if (errorEl) {
            errorEl.textContent = 'Please enter an invite code';
            errorEl.style.display = 'block';
        }
        return;
    }

    const roomId = findRoomByInviteCode(code);

    if (!roomId) {
        if (errorEl) {
            errorEl.textContent = 'Invalid or expired invite code';
            errorEl.style.display = 'block';
        }
        return;
    }

    // Check if already joined
    if (joinedRooms.includes(roomId)) {
        closeInviteModal();
        selectRoom(roomId, 'community');
        return;
    }

    // Join the room
    joinRoom(roomId);
    closeInviteModal();
    selectRoom(roomId, 'community');
}

// Setup invite listeners
function setupInviteListeners() {
    const inviteBtn = document.getElementById('invite-to-room-btn');
    const closeBtn = document.getElementById('invite-modal-close');
    const copyBtn = document.getElementById('copy-invite-btn');
    const joinBtn = document.getElementById('join-with-code-btn');
    const modal = document.getElementById('invite-modal');
    const joinInput = document.getElementById('join-code-input');

    if (inviteBtn) {
        inviteBtn.addEventListener('click', openInviteModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeInviteModal);
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', copyInviteCode);
    }

    if (joinBtn) {
        joinBtn.addEventListener('click', joinWithInviteCode);
    }

    // Close on overlay click
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeInviteModal();
            }
        });
    }

    // Join on Enter key
    if (joinInput) {
        joinInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                joinWithInviteCode();
            }
        });

        // Clear error on input
        joinInput.addEventListener('input', function() {
            const errorEl = document.getElementById('join-error');
            if (errorEl) errorEl.style.display = 'none';
        });
    }

    // User invite modal listeners
    const userInviteCloseBtn = document.getElementById('user-invite-modal-close');
    const userInviteModal = document.getElementById('user-invite-modal');
    const userInviteSearch = document.getElementById('user-invite-search');

    if (userInviteCloseBtn) {
        userInviteCloseBtn.addEventListener('click', closeUserInviteModal);
    }

    if (userInviteModal) {
        userInviteModal.addEventListener('click', function(e) {
            if (e.target === userInviteModal) {
                closeUserInviteModal();
            }
        });
    }

    if (userInviteSearch) {
        userInviteSearch.addEventListener('input', function() {
            renderUserInviteList(this.value);
        });
    }
}

// Room invites storage
let roomInvites = safeJSONParse(localStorage.getItem('roomInvites'), []);
let currentInviteRoomId = null;

// Users available to invite (followers + following)
let invitableUsers = [];

// Open user invite modal
async function openUserInviteModal(roomId) {
    currentInviteRoomId = roomId;
    const modal = document.getElementById('user-invite-modal');
    const searchInput = document.getElementById('user-invite-search');
    const container = document.getElementById('user-invite-list');

    if (modal) {
        modal.style.display = 'flex';
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }

        // Show loading state
        if (container) {
            container.innerHTML = '<div class="user-invite-empty"><p>Loading...</p></div>';
        }

        // Fetch followers and following from Supabase
        invitableUsers = [];
        try {
            const { user } = await supabaseGetUser();
            if (user) {
                const [followersRes, followingRes] = await Promise.all([
                    supabaseGetFollowers(user.id),
                    supabaseGetFollowing(user.id)
                ]);

                // Data is already flattened by Supabase functions
                const followers = (followersRes.data || []).map(f => ({
                    username: f?.username,
                    id: f?.id,
                    avatar: f?.avatar_url
                })).filter(u => u.username);

                const following = (followingRes.data || []).map(f => ({
                    username: f?.username,
                    id: f?.id,
                    avatar: f?.avatar_url
                })).filter(u => u.username);

                // Combine and deduplicate
                const userMap = new Map();
                [...followers, ...following].forEach(u => {
                    if (!userMap.has(u.username)) {
                        userMap.set(u.username, u);
                    }
                });
                invitableUsers = Array.from(userMap.values());
            }
        } catch (err) {
            console.error('Error fetching followers/following:', err);
        }

        renderUserInviteList('');
    }
}

// Close user invite modal
function closeUserInviteModal() {
    const modal = document.getElementById('user-invite-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentInviteRoomId = null;
}

// Render user invite list
function renderUserInviteList(searchTerm = '') {
    const container = document.getElementById('user-invite-list');
    if (!container) return;

    const term = searchTerm.toLowerCase().trim();

    // Filter users - exclude current user and already invited users
    const pendingInvites = roomInvites.filter(inv => inv.roomId === currentInviteRoomId && inv.status === 'pending');
    const pendingUsernames = pendingInvites.map(inv => inv.toUser);

    // Get room members to exclude them
    const roomMembersList = roomMembers[currentInviteRoomId] || [];
    const memberUsernames = roomMembersList.map(m => m.username);

    const filteredUsers = invitableUsers.filter(user => {
        if (user.username === currentUser) return false; // Exclude self
        if (memberUsernames.includes(user.username)) return false; // Exclude existing members
        if (term && !user.username.toLowerCase().includes(term)) return false; // Search filter
        return true;
    });

    // Show appropriate empty message
    if (invitableUsers.length === 0) {
        container.innerHTML = `
            <div class="user-invite-empty">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" opacity="0.3">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
                <p>No one to invite yet</p>
                <span style="font-size: 12px; opacity: 0.6;">Follow someone or get followers to invite them to rooms</span>
            </div>
        `;
        return;
    }

    if (filteredUsers.length === 0) {
        container.innerHTML = `
            <div class="user-invite-empty">
                <p>${term ? 'No users found matching "' + escapeHTML(term) + '"' : 'All your connections are already in this room'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredUsers.map(user => {
        const isPending = pendingUsernames.includes(user.username);
        const avatarStyle = user.avatar ? `background-image: url('${escapeAttr(user.avatar)}'); background-size: cover;` : '';
        const avatarContent = user.avatar ? '' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
        return `
            <div class="user-invite-item ${isPending ? 'invited' : ''}" data-username="${escapeAttr(user.username)}">
                <div class="user-invite-avatar" style="${avatarStyle}">
                    ${avatarContent}
                </div>
                <div class="user-invite-info">
                    <span class="user-invite-name">${escapeHTML(user.username)}</span>
                </div>
                <button class="user-invite-btn ${isPending ? 'cancel' : ''}" data-username="${escapeAttr(user.username)}">
                    ${isPending ? 'Cancel' : 'Invite'}
                </button>
            </div>
        `;
    }).join('');

    // Event listeners handled via delegation in initLounge()
}

// Cancel a pending room invite
function cancelRoomInvite(roomId, username) {
    // Remove from local invites
    const index = roomInvites.findIndex(inv => inv.roomId === roomId && inv.toUser === username && inv.status === 'pending');
    if (index !== -1) {
        roomInvites.splice(index, 1);
        localStorage.setItem('roomInvites', JSON.stringify(roomInvites));
    }

    // Re-render the list
    renderUserInviteList(document.getElementById('user-invite-search')?.value || '');

    if (typeof showToast === 'function') {
        showToast(`Invite to ${username} cancelled`, 'info');
    }
}

// Send room invite
async function sendRoomInvite(roomId, username) {
    const room = communityRooms.find(r => r.id === roomId);
    if (!room) return;

    const currentUserId = localStorage.getItem('supabaseUserId');
    const currentUsername = localStorage.getItem('profileUsername');

    // Send notification via Supabase
    if (typeof supabaseClient !== 'undefined') {
        try {
            // Look up the target user's ID (only verified users)
            const { data: targetProfile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('id')
                .ilike('username', username)
                .eq('email_verified', true)
                .single();

            console.log('Room invite - target profile lookup:', { username, targetProfile, profileError });

            if (profileError) {
                console.error('Error looking up target user:', profileError);
                if (typeof showToast === 'function') {
                    showToast(`User "${username}" not found`, 'error');
                }
                return;
            }

            if (targetProfile) {
                const notificationData = {
                    user_id: targetProfile.id,
                    type: 'room-invite',
                    actor_id: currentUserId
                };

                console.log('Creating room invite notification:', notificationData);

                // Create notification in Supabase
                const { data, error } = await supabaseClient.from('notifications').insert(notificationData).select().single();

                if (error) {
                    console.error('Supabase error creating room invite notification:', error);
                    if (typeof showToast === 'function') {
                        showToast('Failed to send invite: ' + error.message, 'error');
                    }
                    return;
                }

                console.log('Room invite notification created successfully:', data);

                // Only save to local state after Supabase succeeds
                const invite = {
                    id: 'invite_' + Date.now(),
                    roomId: roomId,
                    roomName: room.name,
                    fromUser: currentUser,
                    toUser: username,
                    status: 'pending',
                    createdAt: Date.now()
                };

                roomInvites.push(invite);
                localStorage.setItem('roomInvites', JSON.stringify(roomInvites));

                // Re-render the list to show pending state
                renderUserInviteList(document.getElementById('user-invite-search')?.value || '');

                if (typeof showToast === 'function') {
                    showToast(`Invite sent to ${username}`, 'success');
                }
            }
        } catch (err) {
            console.error('Error sending room invite notification:', err);
            if (typeof showToast === 'function') {
                showToast('Failed to send invite', 'error');
            }
        }
    }
}

// Add room invite notification
function addRoomInviteNotification(invite) {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;

    // Remove empty state if present
    const emptyState = notificationsList.querySelector('.notif-empty-state');
    if (emptyState) emptyState.remove();

    // Create notification HTML (no buttons - they show in detail view when clicked)
    // Escape user input to prevent XSS
    const safeFromUser = escapeHTML(invite.fromUser);
    const safeRoomName = escapeHTML(invite.roomName);
    const safeAttrRoomName = escapeAttr(invite.roomName);
    const safeAttrFromUser = escapeAttr(invite.fromUser);

    const notifHTML = `
        <div class="notification-item unread room-invite" data-type="room-invite" data-invite-id="${invite.id}" data-room-name="${safeAttrRoomName}" data-from-user="${safeAttrFromUser}">
            <div class="notification-icon invite">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
            </div>
            <div class="notification-content">
                <span class="notification-text"><strong>${safeFromUser}</strong> invited you to join <strong>${safeRoomName}</strong></span>
                <span class="notification-time">Just now</span>
            </div>
        </div>
    `;

    // Insert at the top
    notificationsList.insertAdjacentHTML('afterbegin', notifHTML);
}

// Accept room invite
function acceptRoomInvite(inviteId) {
    const invite = roomInvites.find(inv => inv.id === inviteId);
    if (!invite) return;

    // Update invite status
    invite.status = 'accepted';
    localStorage.setItem('roomInvites', JSON.stringify(roomInvites));

    // Join the room
    joinRoom(invite.roomId);

    // Update notification UI
    const notifItem = document.querySelector(`.notification-item[data-invite-id="${escapeSelector(inviteId)}"]`);
    if (notifItem) {
        notifItem.classList.remove('unread');
        const actionsDiv = notifItem.querySelector('.invite-actions');
        if (actionsDiv) {
            actionsDiv.innerHTML = '<span class="invite-response accepted">Accepted</span>';
        }
    }

    // Select the room
    selectRoom(invite.roomId, 'community');
}

// Decline room invite
function declineRoomInvite(inviteId) {
    const invite = roomInvites.find(inv => inv.id === inviteId);
    if (!invite) return;

    // Update invite status
    invite.status = 'declined';
    localStorage.setItem('roomInvites', JSON.stringify(roomInvites));

    // Update notification UI
    const notifItem = document.querySelector(`.notification-item[data-invite-id="${escapeSelector(inviteId)}"]`);
    if (notifItem) {
        notifItem.classList.remove('unread');
        const actionsDiv = notifItem.querySelector('.invite-actions');
        if (actionsDiv) {
            actionsDiv.innerHTML = '<span class="invite-response declined">Declined</span>';
        }
    }
}

// Initialize lounge
function initLounge() {
    // Initialize intro splash modal event listeners
    initLoungeIntro();

    // Load rooms from Supabase
    if (typeof loadRoomsFromSupabase === 'function') {
        loadRoomsFromSupabase();
    }
    if (typeof loadJoinedRoomsFromSupabase === 'function') {
        loadJoinedRoomsFromSupabase();
    }

    // Subscribe to room changes for realtime sync across browsers
    if (typeof supabaseSubscribeToRoomChanges === 'function' && !roomChangesSubscription) {
        roomChangesSubscription = supabaseSubscribeToRoomChanges(
            // onDelete - room was deleted
            (deletedRoom) => {
                console.log('Room deleted (realtime):', deletedRoom);
                // Reload rooms from Supabase to get fresh list
                if (typeof loadRoomsFromSupabase === 'function') {
                    loadRoomsFromSupabase();
                }
                if (typeof loadJoinedRoomsFromSupabase === 'function') {
                    loadJoinedRoomsFromSupabase();
                }
            },
            // onUpdate - room was updated
            (updatedRoom) => {
                console.log('Room updated (realtime):', updatedRoom);
                // Reload rooms to get fresh data
                if (typeof loadRoomsFromSupabase === 'function') {
                    loadRoomsFromSupabase();
                }
            }
        );
    }

    // Initialize edit room tab state (disabled by default until room is found)
    updateEditRoomTab();

    // Event delegation for members lists (handles both creator and members lists)
    const membersList = document.getElementById('room-members-list');
    const creatorList = document.getElementById('room-creator-list');

    const handleMemberListClick = (e) => {
        // If clicking on username, open profile
        const clickedUsername = e.target.closest('[data-action="view-profile"]');
        if (clickedUsername) {
            const username = clickedUsername.dataset.username;
            if (username && typeof viewUserProfile === 'function') {
                viewUserProfile(username, false, true);
            }
        }
    };

    if (membersList) {
        membersList.addEventListener('click', handleMemberListClick);
    }
    if (creatorList) {
        creatorList.addEventListener('click', handleMemberListClick);
    }

    // Event delegation for community rooms list (rooms to join)
    const communityRoomsList = document.getElementById('community-rooms-list');
    if (communityRoomsList) {
        communityRoomsList.addEventListener('click', (e) => {
            const joinBtn = e.target.closest('.join-room-btn');
            if (joinBtn) {
                e.stopPropagation();
                joinRoom(joinBtn.dataset.room);
                return;
            }
            const room = e.target.closest('.lounge-community-room');
            if (room) {
                selectRoom(room.dataset.room, room.dataset.type || 'community');
            }
        });
    }

    // Event delegation for my rooms list (handles room clicks and favorites)
    const myRoomsList = document.getElementById('my-rooms-list');
    if (myRoomsList) {
        myRoomsList.addEventListener('click', (e) => {
            // Handle favorite button clicks
            const favBtn = e.target.closest('.favorite-btn');
            if (favBtn) {
                e.stopPropagation();
                toggleFavorite(favBtn.dataset.room);
                return;
            }
            // Handle room item clicks
            const roomItem = e.target.closest('.lounge-room-item');
            if (roomItem) {
                selectRoom(roomItem.dataset.room, roomItem.dataset.type);
            }
        });
    }

    // My Rooms tabs (Joined / Favorites / My Room / Edit Room)
    document.querySelectorAll('.my-rooms-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Handle Edit Room tab separately
            if (this.id === 'edit-room-tab') {
                const userRoom = communityRooms.find(r => r.creator === currentUser);
                if (userRoom) {
                    openEditRoom();
                }
                return;
            }

            // Handle My Room tab - only allow if user has created a room
            if (this.id === 'my-room-tab') {
                const userRoom = communityRooms.find(r => r.creator === currentUser);
                if (!userRoom) {
                    return; // Don't switch if no room created
                }
            }

            document.querySelectorAll('.my-rooms-tab:not(.edit-room-tab)').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            myRoomsFilter = this.dataset.filter;
            renderMyRooms();
        });
    });

    // Initialize edit room tab state
    updateEditRoomTab();

    // Room search
    const roomSearchInput = document.getElementById('room-search-input');
    if (roomSearchInput) {
        roomSearchInput.addEventListener('input', function() {
            filterRooms(this.value);
        });
    }

    // Message posting
    const loungePostBtn = document.getElementById('lounge-post-btn');
    const loungeInput = document.getElementById('lounge-input');

    if (loungePostBtn) {
        loungePostBtn.addEventListener('click', postLoungeMessage);
    }

    // Reply cancel button
    const replyCancelBtn = document.getElementById('reply-cancel-btn');
    if (replyCancelBtn) {
        replyCancelBtn.addEventListener('click', cancelReply);
    }

    if (loungeInput) {
        loungeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                postLoungeMessage();
            }
        });

        // Cancel reply with Escape key
        loungeInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && replyingTo) {
                cancelReply();
            }
        });
    }

    // File upload triggers
    document.getElementById('lounge-image-btn')?.addEventListener('click', () => {
        // Auth gate
        if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
            if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
            return;
        }
        document.getElementById('lounge-image-input')?.click();
    });

    document.getElementById('lounge-audio-btn')?.addEventListener('click', () => {
        // Auth gate
        if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
            if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
            return;
        }
        document.getElementById('lounge-audio-input')?.click();
    });

    // Image upload handler - show preview instead of auto-posting
    document.getElementById('lounge-image-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // File size validation - max 5MB for images
            const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
            if (file.size > MAX_IMAGE_SIZE) {
                alert('Image too large. Maximum size is 5MB.');
                e.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                setPendingMedia('image', event.target.result);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = ''; // Reset input for same file selection
    });

    // Audio upload handler - show preview instead of auto-posting
    document.getElementById('lounge-audio-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // File size validation - max 30MB for audio
            const MAX_AUDIO_SIZE = 30 * 1024 * 1024; // 30MB
            if (file.size > MAX_AUDIO_SIZE) {
                alert('Audio file too large. Maximum size is 30MB.');
                e.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                setPendingMedia('audio', event.target.result, file.name);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    });

    // Chat header Invite button
    document.getElementById('invite-to-room-btn')?.addEventListener('click', () => {
        // Auth gate
        if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
            if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
            return;
        }
        if (currentRoom) {
            openUserInviteModal(currentRoom);
        }
    });

    // Chat header Leave button - show confirmation modal
    document.getElementById('leave-room-btn')?.addEventListener('click', () => {
        // Auth gate
        if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
            if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
            return;
        }
        if (currentRoom) {
            showLeaveRoomModal(currentRoom);
        }
    });

    // Leave room modal handlers
    document.getElementById('leave-room-cancel')?.addEventListener('click', () => {
        hideLeaveRoomModal();
    });

    document.getElementById('leave-room-confirm')?.addEventListener('click', () => {
        const roomToLeave = document.getElementById('leave-room-modal')?.dataset.roomId;
        if (roomToLeave) {
            leaveRoom(roomToLeave);
            hideLeaveRoomModal();
        }
    });

    // Close modal when clicking overlay
    document.getElementById('leave-room-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'leave-room-modal') {
            hideLeaveRoomModal();
        }
    });

    // Setup room settings
    setupRoomSettingsListeners();

    // Setup moderation
    setupModerationListeners();

    // Populate and setup emoji pickers
    populateEmojiPickers();
    setupEmojiPicker();

    // Setup invite system
    setupInviteListeners();

    // Event delegation for dynamically created elements
    const loungeContainer = document.getElementById('lounge-container') || document.body;

    loungeContainer.addEventListener('click', (e) => {
        // Handle shared item play
        const playSharedBtn = e.target.closest('[data-action="play-shared"]');
        if (playSharedBtn) {
            const itemId = parseInt(playSharedBtn.dataset.itemId, 10);
            const category = playSharedBtn.dataset.category;
            if (!isNaN(itemId) && category) {
                playSharedItem(itemId, category);
            }
            return;
        }

        // Handle open profile
        const openProfileBtn = e.target.closest('[data-action="open-profile"]');
        if (openProfileBtn) {
            const username = openProfileBtn.dataset.username;
            if (username) {
                openUserProfile(username);
            }
            return;
        }

        // Handle view profile (clickable usernames)
        const viewProfileBtn = e.target.closest('[data-action="view-profile"]');
        if (viewProfileBtn) {
            const username = viewProfileBtn.dataset.username;
            if (username) {
                openUserProfile(username);
            }
            return;
        }

        // Handle mention autocomplete selection
        const selectMentionBtn = e.target.closest('[data-action="select-mention"]');
        if (selectMentionBtn) {
            const username = selectMentionBtn.dataset.username;
            if (username) {
                selectMention(username);
            }
            return;
        }

        // Handle image preview
        const imagePreview = e.target.closest('[data-action="open-image-preview"]');
        if (imagePreview) {
            openImagePreview(imagePreview.src);
            return;
        }
    });

    // Event delegation for user invite list
    const userInviteList = document.getElementById('user-invite-list');
    if (userInviteList) {
        userInviteList.addEventListener('click', (e) => {
            const btn = e.target.closest('.user-invite-btn');
            if (btn) {
                e.stopPropagation();
                if (btn.classList.contains('cancel')) {
                    cancelRoomInvite(currentInviteRoomId, btn.dataset.username);
                } else {
                    sendRoomInvite(currentInviteRoomId, btn.dataset.username);
                }
            }
        });
    }

    // Event delegation for share rooms list
    const shareRoomsList = document.getElementById('share-rooms-list');
    if (shareRoomsList) {
        shareRoomsList.addEventListener('click', (e) => {
            const item = e.target.closest('.share-room-item');
            if (item) {
                const roomId = item.dataset.roomId;
                const submitBtn = document.getElementById('share-submit-btn');

                if (shareModalState.selectedRoom === roomId) {
                    item.classList.remove('selected');
                    shareModalState.selectedRoom = null;
                    if (submitBtn) submitBtn.disabled = true;
                } else {
                    shareRoomsList.querySelectorAll('.share-room-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    shareModalState.selectedRoom = roomId;
                    if (submitBtn) submitBtn.disabled = false;
                }
            }
        });
    }

    // Render rooms
    renderMyRooms();
    renderCommunityRooms();

    // Restore last room or select first joined room
    const savedRoom = localStorage.getItem('lastLoungeRoom');
    // Check if saved room is in joined rooms or community rooms
    const savedRoomInJoined = savedRoom && joinedRooms.some(r => String(r) === String(savedRoom));
    const savedRoomInCommunity = savedRoom && communityRooms.some(r => String(r.id) === String(savedRoom));

    if (savedRoomInJoined || savedRoomInCommunity) {
        // Restore saved room
        const roomData = communityRooms.find(r => String(r.id) === String(savedRoom));
        selectRoom(savedRoom, roomData ? 'community' : 'static');
    } else if (joinedRooms.length > 0) {
        // Fallback to first joined room
        const firstRoom = joinedRooms[0];
        const roomData = communityRooms.find(r => r.id == firstRoom);
        selectRoom(firstRoom, roomData ? 'community' : 'static');
    } else if (communityRooms.length > 0) {
        // Fallback to first community room (for logged out users)
        selectRoom(communityRooms[0].id, 'community');
    }
}

// ===== SHARE TO ROOM MODAL =====
let shareModalState = {
    itemId: null,
    category: null,
    selectedRoom: null
};

window.openShareModal = function(itemId, category) {
    // Check if user is logged in
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    const modal = document.getElementById('share-modal');
    if (!modal) return;

    shareModalState.itemId = itemId;
    shareModalState.category = category;
    shareModalState.selectedRoom = null;

    // Get the item using findItemById helper (checks global items and currentProfileGroup)
    const item = typeof findItemById === 'function'
        ? findItemById(itemId, category)
        : items[category]?.find(i => i.id == itemId);
    if (!item) return;

    // Render item preview
    const previewContainer = document.getElementById('share-item-preview');
    if (previewContainer) {
        // Safely handle cover art - only use if it's a valid HTTP(S) URL
        const coverUrl = item.coverArt && typeof item.coverArt === 'string' &&
            (item.coverArt.startsWith('http://') || item.coverArt.startsWith('https://'))
            ? item.coverArt : null;

        previewContainer.innerHTML = `
            <div class="mini-card">
                <div class="shared-item-cover">
                    ${coverUrl ? `<img src="${escapeAttr(coverUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                        <svg viewBox="0 0 24 24" fill="currentColor" style="display:none;">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                        </svg>` : `
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                        </svg>
                    `}
                </div>
                <div class="shared-item-info">
                    <div class="shared-item-title">${escapeHTML(item.title || item.name)}</div>
                    <div class="shared-item-meta">${escapeHTML(item.uploader || 'Unknown')} • ${escapeHTML(item.vst || (typeof formatDawLabel === 'function' ? formatDawLabel(item.daw) : item.daw) || (item.tags && item.tags[0]) || category)}</div>
                </div>
            </div>
        `;
    }

    // Render rooms list
    renderShareRoomsList();
    initShareTabs();

    // Reset comment
    const commentInput = document.getElementById('share-comment-input');
    if (commentInput) commentInput.value = '';

    // Disable submit button
    const submitBtn = document.getElementById('share-submit-btn');
    if (submitBtn) submitBtn.disabled = true;

    // Show modal
    modal.classList.remove('hidden');
    // Add show class to modal content for animation
    setTimeout(() => {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('show');
    }, 10);
};

window.closeShareModal = function() {
    const modal = document.getElementById('share-modal');
    if (modal) {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 200);
    }
    shareModalState = { itemId: null, category: null, selectedRoom: null };
};

function renderShareRoomsList() {
    const container = document.getElementById('share-rooms-list');
    if (!container) return;

    // Get all joined community rooms + rooms created by user
    const allRooms = [];
    const addedIds = new Set();
    const profileUsername = localStorage.getItem('profileUsername');

    // Add joined rooms
    joinedRooms.forEach(roomId => {
        const room = communityRooms.find(r => r.id == roomId);
        if (room && !addedIds.has(room.id)) {
            addedIds.add(room.id);
            allRooms.push({
                id: room.id,
                name: room.name,
                icon: room.icon || '💬',
                image: room.image || null,
                members: room.members || 1
            });
        }
    });

    // Add rooms created by user (in case they're not in joinedRooms)
    communityRooms.forEach(room => {
        if (!addedIds.has(room.id) && (room.creator === currentUser || room.creator === profileUsername || room.creator === 'You')) {
            addedIds.add(room.id);
            allRooms.push({
                id: room.id,
                name: room.name,
                icon: room.icon || '💬',
                image: room.image || null,
                members: room.members || 1
            });
        }
    });

    if (allRooms.length === 0) {
        container.innerHTML = '<div class="share-empty-rooms">Join a room first to share content</div>';
        return;
    }

    container.innerHTML = allRooms.map(room => {
        const iconImage = room.image || room.icon;
        const isImageUrl = iconImage && typeof iconImage === 'string' && (iconImage.startsWith('http') || iconImage.startsWith('data:') || iconImage.startsWith('Emojies/'));
        return `
        <div class="share-room-item" data-room-id="${escapeAttr(room.id)}">
            <div class="share-room-icon" style="${isImageUrl && sanitizeCSSUrl(iconImage) ? `background-image: url('${sanitizeCSSUrl(iconImage)}'); background-size: cover; background-position: center;` : ''}">${isImageUrl ? '' : escapeHTML(room.icon || '💬')}</div>
            <div class="share-room-info">
                <div class="share-room-name">${escapeHTML(room.name)}</div>
                <div class="share-room-members">${room.members} members</div>
            </div>
            <div class="share-room-check">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>
        </div>`;
    }).join('');

    // Event listeners handled via delegation in initLounge()
}

// Initialize share modal (simplified - room only)
function initShareTabs() {
    // No tabs needed - only room sharing now
}

window.submitShare = function() {
    const roomId = shareModalState.selectedRoom;

    if (!roomId || !shareModalState.itemId || !shareModalState.category) {
        if (typeof showToast === 'function') showToast('Please select a room', 'error');
        return;
    }

    // Use findItemById helper (checks global items and currentProfileGroup)
    const item = typeof findItemById === 'function'
        ? findItemById(shareModalState.itemId, shareModalState.category)
        : items[shareModalState.category]?.find(i => i.id == shareModalState.itemId);
    if (!item) return;

    const rawComment = document.getElementById('share-comment-input')?.value?.trim() || '';
    // Sanitize comment - limit length and ensure it's a string
    const comment = typeof rawComment === 'string' ? rawComment.substring(0, 500) : '';

    // Validate and sanitize shared item data
    const safeString = (val, maxLen = 200) => {
        if (!val || typeof val !== 'string') return '';
        return String(val).substring(0, maxLen);
    };

    const safeCoverArt = item.coverArt && typeof sanitizeURL === 'function'
        ? sanitizeURL(item.coverArt)
        : null;

    // Create shared item data with validated values
    const sharedItemData = {
        id: safeString(String(item.id), 100),
        category: safeString(shareModalState.category, 50),
        title: safeString(item.title || item.name, 200) || 'Untitled',
        uploader: safeString(item.uploader, 100) || 'Unknown',
        mainTag: safeString(item.vst || (typeof formatDawLabel === 'function' ? formatDawLabel(item.daw) : item.daw) || (item.tags && item.tags[0]) || shareModalState.category, 50),
        coverArt: safeCoverArt
    };

    // Share to room
    const username = getCurrentUsername();
    const sharedMessage = {
        id: Date.now(),
        author: username,
        authorColor: getUserColor(username),
        text: comment,
        time: Date.now(),
        sharedItem: sharedItemData
    };

    // Add to room messages
    if (!roomMessages[roomId]) {
        roomMessages[roomId] = [];
    }
    roomMessages[roomId].push(sharedMessage);
    localStorage.setItem('roomMessages', JSON.stringify(roomMessages));

    // If currently in this room, refresh messages
    if (currentRoom === roomId) {
        loadRoomMessages(roomId);
    }

    // Update share count on item
    if (!item.shares) item.shares = 0;
    item.shares++;
    const countEl = document.getElementById(`card-shares-${item.id}`);
    if (countEl) countEl.textContent = formatCount(item.shares);

    // Sync share count to Supabase
    if (typeof supabaseIncrementCounter === 'function') {
        supabaseIncrementCounter(item.id, 'shares').catch(err => {
            console.error('Error syncing share count:', err);
        });
    }

    // Add notification for share
    if (window.addNotification) {
        window.addNotification('share', item.title || item.name, item.id, shareModalState.category, 'You');
    }

    // Close modal and show confirmation
    closeShareModal();

    // Show toast confirmation
    if (typeof showToast === 'function') {
        const foundRoom = communityRooms.find(r => r.id == roomId);
        const roomName = foundRoom ? foundRoom.name : roomId;
        showToast(`Shared to ${roomName}`, 'success', 3000);
    }
};

// ===== @MENTION SYSTEM =====
let mentionState = {
    isActive: false,
    startIndex: -1,
    query: '',
    highlightedIndex: 0,
    mentions: [], // Array of message elements with mentions for current user
    currentMentionIndex: 0
};

// Initialize mention system
function initMentionSystem() {
    const input = document.getElementById('lounge-input');
    if (!input) return;

    // Create autocomplete dropdown
    const inputWrapper = input.closest('.chat-input-wrapper');
    if (inputWrapper && !document.getElementById('mention-autocomplete')) {
        const autocomplete = document.createElement('div');
        autocomplete.id = 'mention-autocomplete';
        autocomplete.className = 'mention-autocomplete';
        inputWrapper.style.position = 'relative';
        inputWrapper.appendChild(autocomplete);
    }

    // Add mention badge to header
    addMentionBadge();

    // Input event listeners
    input.addEventListener('input', handleMentionInput);
    input.addEventListener('keydown', handleMentionKeydown);
    input.addEventListener('blur', () => {
        // Delay to allow click on autocomplete items
        setTimeout(() => hideMentionAutocomplete(), 150);
    });
}

// Add mention badge to chat header
function addMentionBadge() {
    const headerActions = document.querySelector('.chat-header-actions');
    if (!headerActions || document.getElementById('mention-badge')) return;

    const badge = document.createElement('div');
    badge.id = 'mention-badge';
    badge.className = 'mention-badge';
    badge.innerHTML = `
        <svg class="mention-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="4"/>
            <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
        </svg>
        <span class="mention-badge-count">0</span>
    `;
    badge.onclick = scrollToNextMention;
    headerActions.insertBefore(badge, headerActions.firstChild);
}

// Handle input for @mentions
function handleMentionInput(e) {
    const input = e.target;
    const value = input.value;
    const cursorPos = input.selectionStart;

    // Find @ symbol before cursor
    let atIndex = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
        if (value[i] === '@') {
            atIndex = i;
            break;
        }
        if (value[i] === ' ') break;
    }

    if (atIndex >= 0) {
        const query = value.substring(atIndex + 1, cursorPos).toLowerCase();
        mentionState.isActive = true;
        mentionState.startIndex = atIndex;
        mentionState.query = query;
        mentionState.highlightedIndex = 0;
        showMentionAutocomplete(query);
    } else {
        hideMentionAutocomplete();
    }
}

// Handle keyboard navigation in autocomplete
function handleMentionKeydown(e) {
    if (!mentionState.isActive) return;

    const autocomplete = document.getElementById('mention-autocomplete');
    const items = autocomplete?.querySelectorAll('.mention-autocomplete-item');
    if (!items || items.length === 0) return;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            mentionState.highlightedIndex = (mentionState.highlightedIndex + 1) % items.length;
            updateHighlightedItem(items);
            break;
        case 'ArrowUp':
            e.preventDefault();
            mentionState.highlightedIndex = (mentionState.highlightedIndex - 1 + items.length) % items.length;
            updateHighlightedItem(items);
            break;
        case 'Enter':
        case 'Tab':
            if (mentionState.isActive && items.length > 0) {
                e.preventDefault();
                const selectedItem = items[mentionState.highlightedIndex];
                if (selectedItem) {
                    selectMention(selectedItem.dataset.username);
                }
            }
            break;
        case 'Escape':
            hideMentionAutocomplete();
            break;
    }
}

// Update highlighted item in autocomplete
function updateHighlightedItem(items) {
    items.forEach((item, idx) => {
        item.classList.toggle('highlighted', idx === mentionState.highlightedIndex);
    });
}

// Show mention autocomplete dropdown
function showMentionAutocomplete(query) {
    const autocomplete = document.getElementById('mention-autocomplete');
    if (!autocomplete || !currentRoom) return;

    const members = roomMembers[currentRoom] || [];
    const filtered = members.filter(m =>
        m.username.toLowerCase().startsWith(query) && m.username !== currentUser
    );

    if (filtered.length === 0) {
        autocomplete.innerHTML = `
            <div class="mention-autocomplete-header">Members</div>
            <div class="mention-autocomplete-empty">No users found</div>
        `;
    } else {
        autocomplete.innerHTML = `
            <div class="mention-autocomplete-header">Members matching "${escapeHTML(query) || '...'}"</div>
            ${filtered.map((member, idx) => `
                <div class="mention-autocomplete-item ${idx === 0 ? 'highlighted' : ''}"
                     data-username="${escapeAttr(member.username)}"
                     data-action="select-mention">
                    <div class="mention-autocomplete-avatar">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                    </div>
                    <span class="mention-autocomplete-name">${escapeHTML(member.username)}</span>
                    <span class="mention-autocomplete-status ${member.status}">${member.status}</span>
                </div>
            `).join('')}
        `;
    }

    autocomplete.classList.add('show');
}

// Hide mention autocomplete
function hideMentionAutocomplete() {
    const autocomplete = document.getElementById('mention-autocomplete');
    if (autocomplete) {
        autocomplete.classList.remove('show');
    }
    mentionState.isActive = false;
    mentionState.startIndex = -1;
    mentionState.query = '';
}

// Select a mention from autocomplete
window.selectMention = function(username) {
    const input = document.getElementById('lounge-input');
    if (!input) return;

    const value = input.value;
    const before = value.substring(0, mentionState.startIndex);
    const after = value.substring(input.selectionStart);

    input.value = before + '@' + username + ' ' + after;
    input.focus();

    // Set cursor after the inserted mention
    const newPos = mentionState.startIndex + username.length + 2;
    input.setSelectionRange(newPos, newPos);

    hideMentionAutocomplete();
};

// Parse message text to highlight @mentions
function parseMentions(text) {
    if (!text) return text;

    // Match @username patterns (username can contain letters, numbers, underscores)
    return text.replace(/@(\w+)/g, (match, username) => {
        const isSelf = username.toLowerCase() === currentUser.toLowerCase();
        const safeUsername = escapeHTML(username);
        const safeAttrUsername = escapeAttr(username);
        return `<span class="mention-highlight ${isSelf ? 'mention-self' : ''}" data-mention="${safeAttrUsername}">@${safeUsername}</span>`;
    });
}

// Check if message contains mention of current user
function messageContainsSelfMention(text) {
    if (!text || !currentUser) return false;
    // Escape regex special characters to prevent ReDoS
    const safeUser = escapeRegex(currentUser);
    const regex = new RegExp(`@${safeUser}\\b`, 'i');
    return regex.test(text);
}

// Update mention badge count
function updateMentionBadge() {
    const badge = document.getElementById('mention-badge');
    if (!badge) return;

    const messagesContainer = document.getElementById('lounge-messages');
    if (!messagesContainer) return;

    // Find all messages with mentions of current user
    mentionState.mentions = Array.from(messagesContainer.querySelectorAll('.lounge-message.has-mention'));
    const count = mentionState.mentions.length;

    const countEl = badge.querySelector('.mention-badge-count');
    if (countEl) countEl.textContent = count;

    badge.classList.toggle('show', count > 0);
    mentionState.currentMentionIndex = 0;
}

// Scroll to next mention
function scrollToNextMention() {
    if (mentionState.mentions.length === 0) return;

    // Always get the first mention (since we remove them after reading)
    const messageEl = mentionState.mentions[0];
    if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Flash effect
        messageEl.style.transition = 'background 0.3s ease';
        messageEl.style.background = 'rgba(255, 59, 48, 0.2)';
        setTimeout(() => {
            messageEl.style.background = '';
        }, 1000);

        // Mark as read - remove has-mention class
        messageEl.classList.remove('has-mention');

        // Remove from mentions array
        mentionState.mentions.shift();

        // Update the badge
        updateMentionBadge();
    }
}

// Call init when lounge loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initMentionSystem, 100);
});

// ===== ROOM UNREAD MESSAGE COUNTS =====
let roomUnreadCounts = safeJSONParse(localStorage.getItem('roomUnreadCounts'), {});

// Get unread count for a room
function getUnreadCount(roomId) {
    return roomUnreadCounts[roomId] || 0;
}

// Increment unread count for a room (when message arrives and not in that room)
function incrementUnreadCount(roomId) {
    if (currentRoom === roomId) return; // Don't increment if we're in the room
    if (!isRoomJoined(roomId)) return; // Only track for joined rooms

    roomUnreadCounts[roomId] = (roomUnreadCounts[roomId] || 0) + 1;
    localStorage.setItem('roomUnreadCounts', JSON.stringify(roomUnreadCounts));
    updateRoomUnreadBadge(roomId);
}

// Clear unread count when entering a room
function clearUnreadCount(roomId) {
    if (roomUnreadCounts[roomId]) {
        roomUnreadCounts[roomId] = 0;
        localStorage.setItem('roomUnreadCounts', JSON.stringify(roomUnreadCounts));
        updateRoomUnreadBadge(roomId);
    }
}

// Update the badge display for a specific room
function updateRoomUnreadBadge(roomId) {
    const badge = document.querySelector(`.room-unread-badge[data-room="${escapeSelector(roomId)}"]`);
    if (!badge) return;

    const count = roomUnreadCounts[roomId] || 0;
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.toggle('show', count > 0);
}

// Update all room badges
function updateAllRoomBadges() {
    document.querySelectorAll('.room-unread-badge').forEach(badge => {
        const roomId = badge.dataset.room;
        const count = roomUnreadCounts[roomId] || 0;
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.toggle('show', count > 0);
    });
}

// ===== USER PROFILE VIEW =====
// Open a user's profile when clicking their name
function openUserProfile(username) {
    if (!username || username === 'Unknown') return;

    // Open user profile as overlay
    if (typeof viewUserProfile === 'function') {
        viewUserProfile(username, false, true);
    }
}

window.openUserProfile = openUserProfile;

// ===== EXTERNAL LINK WARNING =====
let pendingExternalUrl = null;

function isExternalLink(url) {
    try {
        const linkUrl = new URL(url, window.location.origin);
        return linkUrl.origin !== window.location.origin;
    } catch {
        return false;
    }
}

function openExternalLinkModal(url) {
    pendingExternalUrl = url;
    const modal = document.getElementById('external-link-modal');
    const urlDisplay = document.getElementById('external-link-url');
    const content = modal?.querySelector('.modal-content');

    if (urlDisplay) {
        urlDisplay.textContent = url;
    }

    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => content?.classList.add('show'), 10);
    }
}

function closeExternalLinkModal() {
    const modal = document.getElementById('external-link-modal');
    const content = modal?.querySelector('.modal-content');

    if (content) {
        content.classList.remove('show');
        setTimeout(() => modal?.classList.add('hidden'), 300);
    }
    pendingExternalUrl = null;
}

function continueToExternalLink() {
    if (pendingExternalUrl) {
        window.open(pendingExternalUrl, '_blank', 'noopener,noreferrer');
    }
    closeExternalLinkModal();
}

// Intercept external link clicks in Lounge
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Check if click is within lounge areas
    const isInLounge = link.closest('#lounge-content, #notifications-content, .lounge-chat-messages, .room-messages');

    if (isInLounge && isExternalLink(href)) {
        e.preventDefault();
        openExternalLinkModal(href);
    }
});

// Close modal on outside click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('external-link-modal');
    if (e.target === modal) {
        closeExternalLinkModal();
    }
});

window.openExternalLinkModal = openExternalLinkModal;
window.closeExternalLinkModal = closeExternalLinkModal;
window.continueToExternalLink = continueToExternalLink;
