// ===== COMMENTS SYSTEM =====

// Comment modal state
let currentCommentItem = null;
let currentCommentCategory = null;

// Create reactions HTML for a comment
function createCommentReactionsHTML(reactions) {
    if (!reactions || Object.keys(reactions).length === 0) {
        return '';
    }

    const reactionEmojis = [
        { code: 'pepeyes', file: '44680-pepeyes.png' },
        { code: 'no', file: '73309-no.png' },
        { code: 'pepeheart', file: '1211-pepeheart.png' },
        { code: 'wtfpepe', file: '98318-wtfpepe.png' },
        { code: 'pepefinger', file: '66904-pepefinger.png' },
        { code: 'ok', file: '829312-ok.png' }
    ];

    const buttonsHTML = Object.entries(reactions).map(([emojiCode, users]) => {
        const emoji = reactionEmojis.find(e => e.code === emojiCode);
        if (!emoji || users.length === 0) return '';
        const isActive = users.includes(currentUser || 'You');
        return `
            <span class="comment-reaction ${isActive ? 'active' : ''}">
                <img src="Emojies/${emoji.file}" alt="${emojiCode}" width="16" height="16">
                <span class="comment-reaction-count">${users.length}</span>
            </span>
        `;
    }).join('');

    return buttonsHTML ? `<div class="comment-reactions">${buttonsHTML}</div>` : '';
}

// Global handler for comment reaction clicks
window.handleCommentReaction = function(emojiCode, element, commentIndex, parentIndex) {
    const popup = element.closest('.comment-reaction-popup');
    if (popup) popup.remove();

    // Get the comment to add reaction to
    if (!centerPanelItem || !centerPanelItem.comments) return;

    let comment;
    if (parentIndex !== undefined && parentIndex !== null) {
        // This is a reply
        const parent = centerPanelItem.comments[parentIndex];
        if (parent && parent.replies && parent.replies[commentIndex]) {
            comment = parent.replies[commentIndex];
        }
    } else if (commentIndex !== undefined && commentIndex !== null) {
        // This is a parent comment
        comment = centerPanelItem.comments[commentIndex];
    }

    if (!comment) return;

    // Initialize reactions if not exists
    if (!comment.reactions) {
        comment.reactions = {};
    }

    // Toggle user's reaction
    const user = currentUser || 'You';
    if (!comment.reactions[emojiCode]) {
        comment.reactions[emojiCode] = [];
    }

    const userIndex = comment.reactions[emojiCode].indexOf(user);
    if (userIndex === -1) {
        comment.reactions[emojiCode].push(user);
    } else {
        comment.reactions[emojiCode].splice(userIndex, 1);
        if (comment.reactions[emojiCode].length === 0) {
            delete comment.reactions[emojiCode];
        }
    }

    // Re-render the center panel to show updated reactions
    if (typeof updateCenterPanel === 'function') {
        updateCenterPanel(centerPanelItem, centerPanelCategory, true);
    }
};

// ===== LINK DETECTION FOR COMMENTS =====
// Block links in comments (allowed only in lounge and DMs)
function containsLink(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();

    // Check for http:// or https://
    if (/https?:\/\//i.test(text)) return true;

    // Check for www.
    if (/www\./i.test(text)) return true;

    // Check for common TLDs (with word boundary to avoid false positives)
    const tldPattern = /\b[\w-]+\.(com|org|net|io|ai|co|gg|me|tv|info|biz|xyz|dev|app|live|online|site|tech|cloud|shop|store|blog|edu|gov|mil)\b/i;
    if (tldPattern.test(text)) return true;

    return false;
}

// Make it globally available
window.containsLink = containsLink;
window.isUserLoggedIn = isUserLoggedIn;
window.showAuthRequiredModal = showAuthRequiredModal;

// Track timeout for link error
let commentLinkErrorTimeout = null;

// Show link error on comment input (called on submit attempt)
function showCommentLinkError(input) {
    if (!input) return;

    // Clear any existing timeout so error resets each submit attempt
    if (commentLinkErrorTimeout) {
        clearTimeout(commentLinkErrorTimeout);
    }

    // Add error class for red border
    input.classList.add('comment-link-error');

    // Remove any existing tooltip
    const existingTooltip = document.getElementById('comment-link-tooltip');
    if (existingTooltip) existingTooltip.remove();

    // Create tooltip and append to body with fixed positioning
    const tooltip = document.createElement('div');
    tooltip.id = 'comment-link-tooltip';
    tooltip.className = 'comment-link-tooltip';
    tooltip.textContent = 'Links are not allowed in comments';
    document.body.appendChild(tooltip);

    // Position tooltip above the input
    const rect = input.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - 8) + 'px';
    tooltip.style.transform = 'translate(-50%, -100%)';

    // Show tooltip
    requestAnimationFrame(() => tooltip.classList.add('visible'));

    // Auto-hide after 3 seconds
    commentLinkErrorTimeout = setTimeout(() => {
        hideCommentLinkError(input);
    }, 3000);
}

function hideCommentLinkError(input) {
    if (!input) return;
    input.classList.remove('comment-link-error');
    const tooltip = document.getElementById('comment-link-tooltip');
    if (tooltip) {
        tooltip.classList.remove('visible');
    }
}

// ===== AUTH REQUIRED MODAL =====

// Check if user is logged in
function isUserLoggedIn() {
    return localStorage.getItem('isLoggedIn') === 'true';
}

// Show auth required modal
function showAuthRequiredModal() {
    const modal = document.getElementById('auth-required-modal');
    const content = modal?.querySelector('.modal-content');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => content?.classList.add('show'), 10);
    }
}

// Close auth required modal
function closeAuthRequiredModal() {
    const modal = document.getElementById('auth-required-modal');
    const content = modal?.querySelector('.modal-content');
    if (content) {
        content.classList.remove('show');
        setTimeout(() => modal?.classList.add('hidden'), 300);
    }
}

// Initialize auth required modal listeners
function initAuthRequiredModal() {
    const createBtn = document.getElementById('auth-required-create-btn');
    const dismissBtn = document.getElementById('auth-required-dismiss-btn');
    const modal = document.getElementById('auth-required-modal');

    if (createBtn) {
        createBtn.addEventListener('click', () => {
            closeAuthRequiredModal();
            // Open signup modal
            if (typeof openAuthModal === 'function') {
                openAuthModal('signup');
            }
        });
    }

    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            closeAuthRequiredModal();
        });
    }

    // Close on background click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAuthRequiredModal();
            }
        });
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initAuthRequiredModal);

// Event delegation for reaction emoji buttons (in case inline onclick doesn't work)
document.addEventListener('click', function(e) {
    const reactionBtn = e.target.closest('.reaction-emoji-btn');
    if (reactionBtn) {
        e.stopPropagation();
        const img = reactionBtn.querySelector('img');
        const emojiCode = img ? img.alt : null;
        const commentEl = reactionBtn.closest('.center-panel-comment');

        if (emojiCode && commentEl) {
            const commentIndex = parseInt(commentEl.dataset.index);
            const parentIndex = commentEl.dataset.parent !== undefined ? parseInt(commentEl.dataset.parent) : null;
            const replyIndex = commentEl.dataset.reply !== undefined ? parseInt(commentEl.dataset.reply) : null;

            if (replyIndex !== null && parentIndex !== null) {
                // This is a reply
                window.handleCommentReaction(emojiCode, reactionBtn, replyIndex, parentIndex);
            } else if (!isNaN(commentIndex)) {
                // This is a parent comment
                window.handleCommentReaction(emojiCode, reactionBtn, commentIndex, null);
            }
        }

        // Remove the popup
        const popup = reactionBtn.closest('.comment-reaction-popup');
        if (popup) popup.remove();
    }
});

// Open comment modal
window.openCommentModal = (id, category) => {
    if (!items[category]) return;
    const item = items[category].find(i => i.id === id);
    if (!item) return;

    currentCommentItem = item;
    currentCommentCategory = category;

    const uploaderName = item.uploader || 'username';
    const modal = document.getElementById('comment-modal');
    const header = document.getElementById('comment-modal-header');
    const avatar = document.getElementById('comment-modal-avatar');
    const username = document.getElementById('comment-modal-username');
    const list = document.getElementById('comment-list');
    const morePresetsUsername = document.getElementById('more-presets-username');
    const morePresetsList = document.getElementById('more-presets-list');

    const bannerUrl = sanitizeCSSUrl(item.uploaderBanner);
    if (header) {
        if (bannerUrl) {
            header.style.backgroundImage = `url('${bannerUrl}')`;
        } else {
            header.style.backgroundImage = 'linear-gradient(135deg, #1a3a5c 0%, #2a5a8c 100%)';
        }
    }

    const avatarUrl = sanitizeCSSUrl(item.uploaderAvatar);
    if (avatar) {
        if (avatarUrl) {
            avatar.style.backgroundImage = `url('${avatarUrl}')`;
        } else {
            avatar.style.backgroundImage = 'none';
            avatar.style.background = '#666';
        }
    }

    if (username) username.textContent = uploaderName;
    if (morePresetsUsername) morePresetsUsername.textContent = uploaderName;

    const uploaderPresets = (items[category] || []).filter(i => i.uploader === uploaderName);
    const followersEl = document.getElementById('comment-modal-followers');
    const uploadsEl = document.getElementById('comment-modal-uploads');
    if (followersEl) followersEl.textContent = item.uploaderFollowers || 0;
    if (uploadsEl) uploadsEl.textContent = uploaderPresets.length;

    if (list) {
        list.innerHTML = (item.comments || []).map(c => `
            <div class="comment-item">
                <div class="comment-avatar"></div>
                <div class="comment-content">
                    <div class="comment-user">${escapeHTML(c.user)}</div>
                    <div class="comment-text">${typeof window.safeParseEmojis === 'function' ? window.safeParseEmojis(c.text) : escapeHTML(c.text)}</div>
                </div>
            </div>
        `).join('') || '<div class="no-comments">No comments yet</div>';
    }

    const otherPresets = (items[category] || []).filter(i => i.uploader === uploaderName && i.id !== id).slice(0, 5);
    if (morePresetsList) {
        morePresetsList.innerHTML = otherPresets.length > 0
            ? otherPresets.map(p => createCardHTML(p, category)).join('')
            : '<div class="no-comments">No other presets</div>';
    }

    // Update follow button state
    const followBtn = document.querySelector('.comment-modal-action');
    if (followBtn) {
        const followedUsers = safeJSONParse(localStorage.getItem('followedUsers'), []);
        const isFollowing = followedUsers.includes(uploaderName);
        followBtn.textContent = isFollowing ? 'Following' : 'Follow';
    }

    if (modal) modal.classList.add('show');
};

window.followUser = () => {
    if (!currentCommentItem) return;

    const uploaderName = currentCommentItem.uploader;
    if (!uploaderName) return;

    // Get current user
    const currentUser = localStorage.getItem('profileUsername') || 'You';
    if (uploaderName === currentUser) return; // Can't follow yourself

    // Get followed users list
    const followedUsers = safeJSONParse(localStorage.getItem('followedUsers'), []);
    const index = followedUsers.indexOf(uploaderName);

    const followBtn = document.querySelector('.comment-modal-action');

    if (index > -1) {
        // Unfollow
        followedUsers.splice(index, 1);
        if (followBtn) followBtn.textContent = 'Follow';
    } else {
        // Follow
        followedUsers.push(uploaderName);
        if (followBtn) followBtn.textContent = 'Following';
    }

    // Save to localStorage
    localStorage.setItem('followedUsers', JSON.stringify(followedUsers));

    // Update follower count display in modal
    const followersEl = document.getElementById('comment-modal-followers');
    if (followersEl) {
        let count = parseInt(followersEl.textContent) || 0;
        count = index > -1 ? count - 1 : count + 1;
        followersEl.textContent = Math.max(0, count);
    }
};

window.closeCommentModal = () => {
    const modal = document.getElementById('comment-modal');
    if (modal) modal.classList.remove('show');
    currentCommentItem = null;
    currentCommentCategory = null;
};

window.submitComment = () => {
    // Prevent race conditions with action lock
    if (typeof withActionLock === 'function') {
        withActionLock('submitComment', () => submitCommentInner())();
    } else {
        submitCommentInner();
    }
};

async function submitCommentInner() {
    // Rate limiting (5 seconds = max 12 comments/minute)
    if (typeof rateLimit === 'function' && !rateLimit('submitComment', 5000)) {
        return; // Too fast
    }

    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text || !currentCommentItem) return;

    // Block links in comments
    if (containsLink(text)) {
        showCommentLinkError(input);
        return;
    }

    // Length limit
    const maxLength = (typeof INPUT_LIMITS !== 'undefined') ? INPUT_LIMITS.COMMENT : 1000;
    if (text.length > maxLength) {
        alert(`Comment too long. Maximum ${maxLength} characters.`);
        return;
    }

    if (!currentCommentItem.comments) currentCommentItem.comments = [];
    currentCommentItem.comments.unshift({ user: 'You', text: text, time: Date.now() });

    input.value = '';
    openCommentModal(currentCommentItem.id, currentCommentCategory);

    const countEl = document.getElementById(`comments-count-${currentCommentItem.id}`);
    if (countEl) countEl.textContent = formatCount(currentCommentItem.comments.length);

    // Save to Supabase if available
    if (typeof supabaseGetUser === 'function' && typeof supabaseAddComment === 'function') {
        try {
            const { user } = await supabaseGetUser();
            if (user && typeof currentCommentItem.id === 'number') {
                const { error } = await supabaseAddComment(currentCommentItem.id, user.id, text);
                if (error) {
                    console.error('Error saving comment to Supabase:', error);
                }
            }
        } catch (err) {
            console.error('Error syncing comment to Supabase:', err);
        }
    }

    // Add notification for comment
    if (window.addNotification) {
        window.addNotification('comment', currentCommentItem.title || currentCommentItem.name, currentCommentItem.id, currentCommentCategory, 'You');
    }
}

// Center Panel Functions
async function updateCenterPanel(item, category, skipFetch = false) {
    if (!item) return;

    centerPanelItem = item;
    centerPanelCategory = category;

    const banner = document.getElementById('center-panel-banner');
    const avatar = document.getElementById('center-panel-avatar');
    const username = document.getElementById('center-panel-username');
    const list = document.getElementById('center-panel-list');

    const uploaderName = item.uploader || item.username || 'Unknown';
    const currentUser = localStorage.getItem('profileUsername') || '';

    // Determine if this is the current user's item (case-insensitive)
    const isOwnItem = uploaderName.toLowerCase() === currentUser.toLowerCase();

    let uploaderBanner = null;
    let uploaderAvatar = null;
    let uploaderBio = null;

    // PRIORITY 1: For own items, ALWAYS use current localStorage values
    if (isOwnItem && currentUser) {
        uploaderBanner = localStorage.getItem('profileBanner');
        uploaderAvatar = localStorage.getItem('profileAvatar');
        uploaderBio = localStorage.getItem('profileBio');
    }

    // PRIORITY 2: Try allUserProfiles with case-insensitive lookup
    if (!uploaderBanner || !uploaderAvatar || !uploaderBio) {
        const allUserProfiles = safeJSONParse(localStorage.getItem('allUserProfiles'), {});
        const profileKey = Object.keys(allUserProfiles).find(
            k => k.toLowerCase() === uploaderName.toLowerCase()
        );
        if (profileKey) {
            const profile = allUserProfiles[profileKey];
            if (!uploaderBanner && profile.banner) uploaderBanner = profile.banner;
            if (!uploaderAvatar && profile.avatar) uploaderAvatar = profile.avatar;
            if (!uploaderBio && profile.bio) uploaderBio = profile.bio;
        }
    }

    // PRIORITY 3: Fall back to item's cached values
    if (!uploaderBanner) uploaderBanner = item.uploaderBanner;
    if (!uploaderAvatar) uploaderAvatar = item.uploaderAvatar;
    if (!uploaderBio) uploaderBio = item.uploaderBio;

    // PRIORITY 4: Fetch from Supabase if still missing data
    if ((!uploaderBanner || !uploaderAvatar || !uploaderBio) && uploaderName !== 'Unknown') {
        if (typeof supabaseGetProfileByUsername === 'function') {
            try {
                const { data: profile } = await supabaseGetProfileByUsername(uploaderName);
                if (profile) {
                    if (!uploaderBanner && profile.banner_url) uploaderBanner = profile.banner_url;
                    if (!uploaderAvatar && profile.avatar_url) uploaderAvatar = profile.avatar_url;
                    if (!uploaderBio && profile.bio) uploaderBio = profile.bio;
                }
            } catch (err) {
                console.error('Error fetching uploader profile:', err);
            }
        }
    }

    if (banner) {
        const bannerCssUrl = sanitizeCSSUrl(uploaderBanner);
        if (bannerCssUrl) {
            banner.style.backgroundImage = `url('${bannerCssUrl}')`;
            banner.style.backgroundSize = 'cover';
            banner.style.backgroundPosition = 'center';
        } else {
            banner.style.backgroundImage = 'none';
        }
    }

    // Set user section background (using CSS-safe URL sanitization)
    const userSection = document.querySelector('.center-panel-user-section');
    if (userSection) {
        const safeBannerUrl = typeof sanitizeCSSUrl === 'function' ? sanitizeCSSUrl(uploaderBanner) : '';
        if (safeBannerUrl) {
            userSection.style.setProperty('--user-bg', `url('${safeBannerUrl}')`);
        } else {
            userSection.style.setProperty('--user-bg', 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)');
        }
    }

    if (avatar) {
        const avatarCssUrl = sanitizeCSSUrl(uploaderAvatar);
        if (avatarCssUrl) {
            avatar.style.backgroundImage = `url('${avatarCssUrl}')`;
            avatar.classList.add('has-image');
        } else {
            avatar.style.backgroundImage = 'none';
            avatar.style.background = '#333';
            avatar.classList.remove('has-image');
        }
    }

    if (username) {
        username.textContent = uploaderName;
    }

    // Set up View Profile button
    const viewProfileBtn = document.getElementById('center-panel-view-profile');
    if (viewProfileBtn) {
        viewProfileBtn.dataset.username = uploaderName;
        viewProfileBtn.onclick = function() {
            const targetUser = this.dataset.username;
            if (targetUser && typeof viewUserProfile === 'function') {
                viewUserProfile(targetUser, false, true); // asOverlay = true
            }
        };
    }

    const followers = document.getElementById('center-panel-followers');
    const uploads = document.getElementById('center-panel-uploads');

    if (followers) {
        followers.textContent = item.uploaderFollowers || 0;
    }

    if (uploads) {
        uploads.textContent = item.uploaderUploads || 0;
    }

    // Update user bio
    const description = document.getElementById('center-panel-description');
    if (description) {
        if (uploaderBio) {
            description.innerHTML = `<span class="description-label">Bio:</span> ${escapeHTML(uploaderBio)}`;
        } else {
            description.textContent = 'No Bio available.';
        }
    }

    // Update item section
    const itemArt = document.getElementById('center-panel-item-art');
    const itemTitle = document.getElementById('center-panel-item-title');
    const itemLikes = document.getElementById('center-panel-item-likes');
    const itemShares = document.getElementById('center-panel-item-shares');
    const itemSaves = document.getElementById('center-panel-item-saves');
    const itemDownloads = document.getElementById('center-panel-item-downloads');
    const itemDescription = document.getElementById('center-panel-item-description');

    if (itemArt) {
        const coverCssUrl = sanitizeCSSUrl(item.coverArt);
        if (coverCssUrl) {
            itemArt.style.backgroundImage = `url('${coverCssUrl}')`;
            itemArt.innerHTML = '';
        } else {
            itemArt.style.backgroundImage = 'none';
            itemArt.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
        }
    }

    if (itemTitle) {
        itemTitle.textContent = item.title || 'Untitled';
    }

    if (itemLikes) {
        itemLikes.textContent = item.hearts || 0;
    }

    if (itemShares) {
        itemShares.textContent = item.shares || 0;
    }

    if (itemSaves) {
        itemSaves.textContent = item.saves || 0;
    }

    if (itemDownloads) {
        itemDownloads.textContent = item.downloads || 0;
    }

    if (itemDescription) {
        if (item.description) {
            itemDescription.textContent = item.description;
        } else {
            itemDescription.textContent = 'No description provided.';
        }
    }

    // Update item tags (exclude VST/DAW since it's on the card)
    const itemTags = document.getElementById('center-panel-item-tags');
    if (itemTags) {
        const tags = [];
        if (item.type) tags.push(item.type);
        if (item.tempo) tags.push(`${item.tempo}bpm`);
        if (item.key && item.scale) {
            tags.push(`${item.key} ${item.scale}`);
        } else if (item.key) {
            tags.push(item.key);
        } else if (item.scale) {
            tags.push(item.scale);
        }
        if (item.genre) tags.push(item.genre);
        if (item.tags && item.tags.length > 0) {
            item.tags.forEach(tag => {
                // Skip if tag matches key, scale, key+scale combo, or genre (case-insensitive)
                const tagLower = tag.toLowerCase();
                if (item.key && tagLower === item.key.toLowerCase()) return;
                if (item.scale && tagLower === item.scale.toLowerCase()) return;
                if (item.genre && tagLower === item.genre.toLowerCase()) return;
                if (item.key && item.scale && tagLower === `${item.key} ${item.scale}`.toLowerCase()) return;
                tags.push(tag);
            });
        }
        // Remove duplicates and show all tags
        const uniqueTags = [...new Set(tags)];
        const tagsHTML = uniqueTags.map(tag => `<span class="info-card-tag">${escapeHTML(tag)}</span>`).join('');
        itemTags.innerHTML = tagsHTML;
    }

    // Update Now Playing container
    const nowPlayingCover = document.getElementById('center-panel-now-playing-cover');
    const nowPlayingTitle = document.getElementById('center-panel-now-playing-title');
    const nowPlayingDescription = document.getElementById('center-panel-now-playing-description');

    if (nowPlayingCover) {
        if (item.coverArt) {
            const safeImg = typeof createSafeImage === 'function' ? createSafeImage(item.coverArt, 'Cover') : '';
            nowPlayingCover.innerHTML = safeImg || `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
        } else {
            nowPlayingCover.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
        }
    }

    if (nowPlayingTitle) {
        nowPlayingTitle.textContent = item.title || 'Untitled';
    }

    if (nowPlayingDescription) {
        nowPlayingDescription.textContent = item.description || '';
    }

    updateMetricsPanel(item);

    // Fetch comments from Supabase if available (skip if just refreshing locally)
    if (!skipFetch && list && typeof supabaseGetComments === 'function' && typeof item.id === 'number') {
        try {
            const { data: supabaseComments, error } = await supabaseGetComments(item.id);
            if (!error && supabaseComments && supabaseComments.length > 0) {
                // Transform Supabase comments to local format (including nested replies)
                const currentUsername = localStorage.getItem('profileUsername') || '';
                item.comments = supabaseComments.map(c => ({
                    id: c.id, // Store Supabase ID for replies
                    user: c.user?.username === currentUsername ? 'You' : (c.user?.username || 'Unknown'),
                    text: c.content,
                    time: new Date(c.created_at).getTime(),
                    avatar: c.user?.avatar_url || null,
                    likes: 0,
                    replies: (c.replies || []).map(r => ({
                        id: r.id,
                        user: r.user?.username === currentUsername ? 'You' : (r.user?.username || 'Unknown'),
                        text: r.content,
                        time: new Date(r.created_at).getTime(),
                        avatar: r.user?.avatar_url || null
                    }))
                }));
            }
        } catch (err) {
            console.error('Error fetching comments from Supabase:', err);
        }
    }

    if (list) {
        if (item.comments && item.comments.length > 0) {
            list.innerHTML = item.comments.map((c, idx) => createCenterPanelCommentHTML(c, idx)).join('');
            list.querySelectorAll('.center-panel-comment').forEach(el => attachCenterPanelCommentListeners(el));
            // Re-apply current user's avatar to their comments
            if (typeof updateProfileAvatar === 'function') {
                updateProfileAvatar();
            }
        } else {
            list.innerHTML = `
                <div class="comments-empty-state" id="comments-empty-state">
                    <div class="empty-state-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                            <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                        </svg>
                    </div>
                    <div class="empty-state-text">No comments yet</div>
                    <div class="empty-state-subtext">Be the first to share your thoughts</div>
                </div>
            `;
        }
    }
}

function createCenterPanelCommentHTML(comment, index) {
    const timeAgo = comment.time ? formatTimeAgo(new Date(comment.time)) : 'just now';
    const likes = comment.likes || 0;
    const replies = comment.replies || [];
    const hasReplies = replies.length > 0;
    const isOwnComment = comment.user === 'You';

    return `
        <div class="center-panel-comment ${hasReplies ? 'has-replies' : ''}" data-index="${index}">
            <div class="center-panel-comment-avatar">
                ${comment.avatar && sanitizeURL(comment.avatar) ? `<img src="${escapeAttr(sanitizeURL(comment.avatar))}" alt="${escapeAttr(comment.user)}">` : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`}
            </div>
            <div class="center-panel-comment-body">
                <div class="center-panel-comment-header">
                    <span class="center-panel-comment-user">${escapeHTML(comment.user)}</span>
                    <span class="center-panel-comment-time">${timeAgo}</span>
                    ${isOwnComment ? `
                        <div class="center-panel-comment-menu-wrapper" style="position: relative; margin-left: auto;">
                            <button class="center-panel-comment-menu">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                            </button>
                            <div class="comment-menu-dropdown" style="display: none; position: absolute; right: 0; top: 100%; background: #2a2a2e; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 100; min-width: 100px;">
                                <button class="comment-edit-btn" data-index="${index}" style="display: block; width: 100%; padding: 8px 12px; background: none; border: none; color: white; text-align: left; cursor: pointer; font-size: 13px;">Edit</button>
                                <button class="comment-delete-btn" data-index="${index}" style="display: block; width: 100%; padding: 8px 12px; background: none; border: none; color: #e74c3c; text-align: left; cursor: pointer; font-size: 13px;">Delete</button>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="center-panel-comment-text">${typeof window.safeParseEmojis === 'function' ? window.safeParseEmojis(comment.text || '') : escapeHTML(comment.text || '')}</div>
                <div class="center-panel-comment-actions">
                    <button class="center-panel-comment-action center-panel-react-btn">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                    </button>
                    <button class="center-panel-comment-action center-panel-reply-btn">Reply</button>
                </div>
                ${createCommentReactionsHTML(comment.reactions)}
                ${hasReplies ? `
                    <button class="center-panel-comment-replies-toggle">
                        <span class="replies-count">${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                ` : ''}
                <div class="center-panel-comment-replies ${hasReplies ? '' : ''}" style="display: none;">
                    ${replies.map((r, rIdx) => createCenterPanelReplyHTML(r, index, rIdx)).join('')}
                </div>
            </div>
        </div>
    `;
}

function createCenterPanelReplyHTML(reply, parentIndex, replyIndex) {
    const timeAgo = reply.time ? formatTimeAgo(new Date(reply.time)) : 'just now';
    // Check if reply has a mention
    const mentionHTML = reply.replyTo ? `<span class="comment-mention">@${escapeHTML(reply.replyTo)}</span>` : '';
    const textContent = typeof window.safeParseEmojis === 'function' ? window.safeParseEmojis(reply.text) : escapeHTML(reply.text);
    return `
        <div class="center-panel-comment" data-parent="${parentIndex}" data-reply="${replyIndex}" data-reply-user="${escapeAttr(reply.user)}">
            <div class="center-panel-comment-avatar">
                ${reply.avatar && sanitizeURL(reply.avatar) ? `<img src="${escapeAttr(sanitizeURL(reply.avatar))}" alt="${escapeAttr(reply.user)}">` : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`}
            </div>
            <div class="center-panel-comment-body">
                <div class="center-panel-comment-header">
                    <span class="center-panel-comment-user">${escapeHTML(reply.user)}</span>
                    <span class="center-panel-comment-time">${timeAgo}</span>
                </div>
                <div class="center-panel-comment-text">${mentionHTML}${textContent}</div>
                <div class="center-panel-comment-actions">
                    <button class="center-panel-comment-action center-panel-react-btn">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                    </button>
                    <button class="center-panel-comment-action center-panel-reply-btn">Reply</button>
                </div>
                ${createCommentReactionsHTML(reply.reactions)}
            </div>
        </div>
    `;
}

function attachCenterPanelCommentListeners(commentEl) {
    const reactBtn = commentEl.querySelector('.center-panel-react-btn');
    const replyBtn = commentEl.querySelector('.center-panel-reply-btn');
    const repliesToggle = commentEl.querySelector('.center-panel-comment-replies-toggle');
    const repliesContainer = commentEl.querySelector('.center-panel-comment-replies');
    const commentIndex = commentEl.dataset.index;
    const parentIndex = commentEl.dataset.parent; // For replies
    const replyIndex = commentEl.dataset.reply; // For replies
    const menuBtn = commentEl.querySelector('.center-panel-comment-menu');
    const menuDropdown = commentEl.querySelector('.comment-menu-dropdown');
    const editBtn = commentEl.querySelector('.comment-edit-btn');
    const deleteBtn = commentEl.querySelector('.comment-delete-btn');

    // Menu toggle
    menuBtn?.addEventListener('click', function(e) {
        e.stopPropagation();
        document.querySelectorAll('.comment-menu-dropdown').forEach(d => d.style.display = 'none');
        if (menuDropdown) menuDropdown.style.display = menuDropdown.style.display === 'none' ? 'block' : 'none';
    });

    // Edit comment
    editBtn?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (menuDropdown) menuDropdown.style.display = 'none';
        const idx = parseInt(this.dataset.index);
        if (!centerPanelItem || !centerPanelItem.comments || !centerPanelItem.comments[idx]) return;
        const comment = centerPanelItem.comments[idx];
        if (comment.user !== 'You') return;
        const newText = prompt('Edit your comment:', comment.text || '');
        if (newText !== null && newText.trim() !== '') {
            comment.text = newText.trim();
            comment.edited = true;
            refreshCommentList();
        }
    });

    // Delete comment
    deleteBtn?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (menuDropdown) menuDropdown.style.display = 'none';
        const idx = parseInt(this.dataset.index);
        if (!centerPanelItem || !centerPanelItem.comments || !centerPanelItem.comments[idx]) return;
        if (centerPanelItem.comments[idx].user !== 'You') return;
        if (confirm('Delete this comment?')) {
            centerPanelItem.comments.splice(idx, 1);
            refreshCommentList();
        }
    });

    // React button - show emoji picker popup
    reactBtn?.addEventListener('click', function(e) {
        e.stopPropagation();
        // Remove any existing reaction popup
        document.querySelectorAll('.comment-reaction-popup').forEach(el => el.remove());

        const popup = document.createElement('div');
        popup.className = 'comment-reaction-popup';

        // Only these specific emojis with their actual filenames
        const reactionEmojis = [
            { code: 'pepeyes', file: '44680-pepeyes.png' },
            { code: 'no', file: '73309-no.png' },
            { code: 'pepeheart', file: '1211-pepeheart.png' },
            { code: 'wtfpepe', file: '98318-wtfpepe.png' },
            { code: 'pepefinger', file: '66904-pepefinger.png' },
            { code: 'ok', file: '829312-ok.png' }
        ];

        // Determine if this is a parent comment or a reply
        const isReply = parentIndex !== undefined;
        const idx = isReply ? replyIndex : commentIndex;
        const pIdx = isReply ? parentIndex : 'null';

        popup.innerHTML = reactionEmojis.map(emoji =>
            `<div class="reaction-emoji-btn" onclick="handleCommentReaction('${emoji.code}', this, ${idx}, ${pIdx}); event.stopPropagation();">
                <img src="Emojies/${emoji.file}" alt="${emoji.code}" width="24" height="24">
            </div>`
        ).join('');

        // Position popup near the button - append to actions container
        const actionsContainer = this.closest('.center-panel-comment-actions');
        if (actionsContainer) {
            actionsContainer.style.position = 'relative';
            actionsContainer.appendChild(popup);
        } else {
            this.parentElement.style.position = 'relative';
            this.parentElement.appendChild(popup);
        }

        // Close popup when clicking outside
        const closePopup = (ev) => {
            if (!popup.contains(ev.target) && !ev.target.closest('.center-panel-react-btn')) {
                popup.remove();
                document.removeEventListener('click', closePopup);
            }
        };
        setTimeout(() => document.addEventListener('click', closePopup), 10);
    });

    replyBtn?.addEventListener('click', function() {
        // Remove any existing reply input in the entire comments section
        document.querySelectorAll('.center-panel-reply-input-wrapper').forEach(el => el.remove());

        // Determine if this is a reply to a parent comment or to another reply
        const isReplyToReply = commentEl.dataset.parent !== undefined;
        const parentIndex = isReplyToReply ? parseInt(commentEl.dataset.parent) : commentIndex;
        const replyToUser = isReplyToReply ? (commentEl.dataset.replyUser || commentEl.querySelector('.center-panel-comment-user')?.textContent) : null;

        const replyInput = document.createElement('div');
        replyInput.className = 'center-panel-reply-input-wrapper';
        const placeholder = replyToUser ? `Reply to @${replyToUser}...` : 'Add a reply...';
        replyInput.innerHTML = `
            <input type="text" class="center-panel-reply-input" placeholder="${escapeAttr(placeholder)}">
            <div class="center-panel-reply-actions">
                <button class="center-panel-reply-cancel">Cancel</button>
                <button class="center-panel-reply-submit">Reply</button>
            </div>
        `;

        const actionsEl = commentEl.querySelector('.center-panel-comment-actions');
        actionsEl.after(replyInput);
        replyInput.querySelector('.center-panel-reply-input').focus();

        replyInput.querySelector('.center-panel-reply-cancel').addEventListener('click', () => {
            replyInput.remove();
        });

        replyInput.querySelector('.center-panel-reply-submit').addEventListener('click', async () => {
            const input = replyInput.querySelector('.center-panel-reply-input');
            const text = input.value.trim();
            if (!text || !centerPanelItem || parentIndex === undefined) return;

            // Block links in replies
            if (containsLink(text)) {
                showCommentLinkError(input);
                return;
            }

            // Always add to the parent comment's replies array
            if (!centerPanelItem?.comments?.[parentIndex]) return;
            const comment = centerPanelItem.comments[parentIndex];
            if (!comment.replies) comment.replies = [];
            const userAvatar = localStorage.getItem('profileAvatarUrl') || null;

            // Include replyTo if replying to another reply
            const newReply = {
                user: 'You',
                text: text,
                time: Date.now(),
                avatar: userAvatar
            };
            if (replyToUser) {
                newReply.replyTo = replyToUser;
            }
            comment.replies.push(newReply);

            // Save reply to Supabase
            if (typeof supabaseGetUser === 'function' && typeof supabaseAddComment === 'function' && comment.id) {
                try {
                    const { user } = await supabaseGetUser();
                    if (user && typeof centerPanelItem.id === 'number') {
                        const { error } = await supabaseAddComment(centerPanelItem.id, user.id, text, comment.id);
                        if (error) {
                            console.error('Error saving reply to Supabase:', error);
                        }
                    }
                } catch (err) {
                    console.error('Error syncing reply to Supabase:', err);
                }
            }

            updateCenterPanel(centerPanelItem, centerPanelCategory, true);
        });

        replyInput.querySelector('.center-panel-reply-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                replyInput.querySelector('.center-panel-reply-submit').click();
            }
        });
    });

    repliesToggle?.addEventListener('click', function() {
        this.classList.toggle('expanded');
        if (repliesContainer) {
            repliesContainer.style.display = this.classList.contains('expanded') ? 'block' : 'none';
            repliesContainer.classList.toggle('show');
        }
    });

    if (repliesContainer) {
        repliesContainer.querySelectorAll('.center-panel-comment').forEach(replyEl => {
            attachCenterPanelCommentListeners(replyEl);
        });
    }
}

// Metrics Panel
function updateMetricsPanel(item) {
    if (!item) return;

    const panelLikes = document.getElementById('panel-likes');
    const panelSaves = document.getElementById('panel-saves');
    const panelShares = document.getElementById('panel-shares');
    const panelDownloads = document.getElementById('panel-downloads');
    const heartIcon = document.getElementById('panel-heart-icon');

    if (panelLikes) panelLikes.textContent = formatCount(item.hearts || 0);
    if (panelSaves) panelSaves.textContent = formatCount(item.saves || 0);
    if (panelShares) panelShares.textContent = formatCount(item.shares || 0);
    if (panelDownloads) panelDownloads.textContent = formatCount(item.downloads || 0);

    const likeBtn = heartIcon?.closest('.metric-btn');
    if (likeBtn) {
        if (item.liked) {
            likeBtn.classList.add('active');
        } else {
            likeBtn.classList.remove('active');
        }
    }
}

function toggleLikeFromPanel() {
    // Check if user is logged in
    if (!isUserLoggedIn()) {
        showAuthRequiredModal();
        return;
    }
    if (!centerPanelItem || !centerPanelCategory) return;
    toggleLike(centerPanelItem.id, centerPanelCategory);
    updateMetricsPanel(centerPanelItem);
}

function saveFromPanel() {
    // Check if user is logged in
    if (!isUserLoggedIn()) {
        showAuthRequiredModal();
        return;
    }
    if (!centerPanelItem || !centerPanelCategory) return;
    // Check if already saved (don't allow saving twice)
    if (typeof library !== 'undefined' && library.some(l => l.id === centerPanelItem.id)) {
        return; // Already saved, do nothing
    }
    addToLibraryFromCard(centerPanelItem.id, centerPanelCategory);
    if (!centerPanelItem.saves) centerPanelItem.saves = 0;
    centerPanelItem.saves++;
    updateMetricsPanel(centerPanelItem);
}

function shareFromPanel() {
    // Check if user is logged in
    if (!isUserLoggedIn()) {
        showAuthRequiredModal();
        return;
    }
    if (!centerPanelItem) return;
    const shareUrl = `${window.location.origin}?item=${centerPanelItem.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Link copied to clipboard!');
        if (!centerPanelItem.shares) centerPanelItem.shares = 0;
        centerPanelItem.shares++;
        updateMetricsPanel(centerPanelItem);
    }).catch(() => {
        alert('Failed to copy link');
    });
}

function downloadFromPanel() {
    // Check if user is logged in
    if (!isUserLoggedIn()) {
        showAuthRequiredModal();
        return;
    }
    if (!centerPanelItem || !centerPanelCategory) return;
    handleDownload(centerPanelItem.id, centerPanelCategory);
    updateMetricsPanel(centerPanelItem);
}

// Center panel comment posting
function postCenterPanelComment() {
    // Prevent race conditions with action lock
    if (typeof withActionLock === 'function') {
        withActionLock('postCenterPanelComment', () => postCenterPanelCommentInner())();
    } else {
        postCenterPanelCommentInner();
    }
}

async function postCenterPanelCommentInner() {
    // Auth gate - must be logged in to comment
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    const input = document.getElementById('center-panel-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    // Block links in comments
    if (containsLink(text)) {
        showCommentLinkError(input);
        return;
    }

    // Validate comment length
    const maxLength = (typeof INPUT_LIMITS !== 'undefined') ? INPUT_LIMITS.COMMENT : 1000;
    if (text.length > maxLength) {
        alert(`Comment too long. Maximum ${maxLength} characters.`);
        return;
    }

    // Rate limiting (5 seconds = max 12 comments/minute)
    if (typeof rateLimit === 'function' && !rateLimit('centerPanelComment', 5000)) {
        return;
    }

    if (!centerPanelItem) {
        return;
    }

    if (!centerPanelItem.comments) centerPanelItem.comments = [];
    const userAvatar = localStorage.getItem('profileAvatarUrl') || null;
    centerPanelItem.comments.unshift({
        user: 'You',
        text: text,
        time: Date.now(),
        likes: 0,
        replies: [],
        avatar: userAvatar
    });

    input.value = '';
    input.style.height = 'auto';

    const countEl = document.getElementById('comment-count');
    if (countEl) countEl.textContent = centerPanelItem.comments.length;

    const list = document.getElementById('center-panel-list');
    if (list) {
        list.innerHTML = centerPanelItem.comments.map((c, idx) => createCenterPanelCommentHTML(c, idx)).join('');
        list.querySelectorAll('.center-panel-comment').forEach(el => attachCenterPanelCommentListeners(el));
    }

    // Save to Supabase if available
    if (typeof supabaseGetUser === 'function' && typeof supabaseAddComment === 'function') {
        try {
            const { user } = await supabaseGetUser();
            if (user && typeof centerPanelItem.id === 'number') {
                const { error } = await supabaseAddComment(centerPanelItem.id, user.id, text);
                if (error) {
                    console.error('Error saving comment to Supabase:', error);
                }
            }
        } catch (err) {
            console.error('Error syncing comment to Supabase:', err);
        }
    }

    // Add notification for comment
    if (window.addNotification) {
        window.addNotification('comment', centerPanelItem.title || centerPanelItem.name, centerPanelItem.id, centerPanelCategory, 'You');
    }
}

function initCenterPanelComments() {
    // Auth check on focus for center panel input
    const centerPanelInput = document.getElementById('center-panel-input');
    if (centerPanelInput) {
        centerPanelInput.addEventListener('focus', () => {
            if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
                centerPanelInput.blur();
                if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#center-panel-post')) {
            postCenterPanelComment();
        }
    });

    // Handle Enter key for textarea
    document.addEventListener('keydown', (e) => {
        const textarea = document.getElementById('center-panel-input');
        if (e.target === textarea && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            postCenterPanelComment();
        }
    });

    // Auto-resize textarea
    document.addEventListener('input', (e) => {
        if (e.target.id === 'center-panel-input') {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
        }
    });

}

// Refresh comment list after edit/delete
function refreshCommentList() {
    const list = document.getElementById('center-panel-list');
    const countEl = document.getElementById('comment-count');
    if (list && centerPanelItem && centerPanelItem.comments) {
        list.innerHTML = centerPanelItem.comments.map((c, idx) => createCenterPanelCommentHTML(c, idx)).join('');
        list.querySelectorAll('.center-panel-comment').forEach(el => attachCenterPanelCommentListeners(el));
    }
    if (countEl && centerPanelItem) {
        countEl.textContent = (centerPanelItem.comments || []).length;
    }
}

// Close comment menus when clicking outside
document.addEventListener('click', function() {
    document.querySelectorAll('.comment-menu-dropdown').forEach(d => d.style.display = 'none');
});
