// ===== USER & PROFILE =====

// Profile navigation history (like browser history)
let profileHistory = [];
let profileHistoryIndex = -1;

// Stack of parent profiles for "Back to X's profile" navigation
// Each entry: { username: string, activeTab: string }
let parentProfileStack = [];

// Update the "Back to X's profile" button visibility and text
function updateBackToButton() {
    const backBtn = document.getElementById('profile-back-to-btn');
    const backText = document.getElementById('profile-back-to-text');
    const closeBtn = document.getElementById('profile-close-btn');

    if (!backBtn) return;

    // Only show when in overlay mode and have parent profiles
    if (parentProfileStack.length > 0 && previousState.wasProfileOverlay) {
        // Show button with parent's username
        const parentEntry = parentProfileStack[parentProfileStack.length - 1];
        if (backText) backText.textContent = `Back to ${parentEntry.username}'s profile`;
        backBtn.classList.remove('hidden');

        // Hide X button when showing back-to button
        if (closeBtn) closeBtn.classList.add('hidden');
    } else {
        // Hide button when no parent profiles or not in overlay mode
        backBtn.classList.add('hidden');

        // Show X button if in overlay mode (and no parent to go back to)
        if (closeBtn && previousState.wasProfileOverlay) {
            closeBtn.classList.remove('hidden');
        }
    }
}

// Navigate back to parent profile
function goBackToParentProfile() {
    if (parentProfileStack.length === 0) return;

    // Pop the parent entry (username + activeTab)
    const parentEntry = parentProfileStack.pop();
    const parentUsername = parentEntry.username;
    const parentTab = parentEntry.activeTab;

    // Update back button before loading (will show next parent or hide)
    updateBackToButton();

    // Set viewing profile to parent
    viewingProfileUsername = parentUsername;

    // Update UI for this profile
    const currentUser = localStorage.getItem('profileUsername');
    isViewingOwnProfile = (parentUsername.toLowerCase() === (currentUser || '').toLowerCase());

    // Load profile data
    if (typeof loadUserProfileData === 'function') {
        loadUserProfileData(parentUsername);
    }

    // Restore the active tab they were on
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    const tabToActivate = document.querySelector(`.profile-tab[data-tab="${parentTab}"]`);
    if (tabToActivate) tabToActivate.classList.add('active');

    document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('active'));
    const panelToActivate = document.getElementById(`profile-${parentTab}-panel`);
    if (panelToActivate) panelToActivate.classList.add('active');

    // Re-render the tab content if needed
    if (parentTab === 'followers') {
        renderFollowersList();
    } else if (parentTab === 'following') {
        renderFollowingList();
    }

    updateProfileActionButtons();
    updateProfileEditVisibility();
}

window.goBackToParentProfile = goBackToParentProfile;
window.updateBackToButton = updateBackToButton;

// Profile view state
function updateProfileEditVisibility() {
    const editAboutBtn = document.getElementById('edit-about-btn');
    const bannerUpload = document.getElementById('profile-banner-upload');
    const avatarUpload = document.querySelector('.profile-avatar-upload');

    if (editAboutBtn) {
        if (isViewingOwnProfile) {
            editAboutBtn.classList.remove('hidden');
        } else {
            editAboutBtn.classList.add('hidden');
        }
    }

    // Hide banner/avatar upload buttons when viewing other profiles
    if (bannerUpload) {
        bannerUpload.style.display = isViewingOwnProfile ? '' : 'none';
    }
    if (avatarUpload) {
        avatarUpload.style.display = isViewingOwnProfile ? '' : 'none';
    }
}

function closeProfileView() {
    document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
    const prevContent = document.getElementById(`${previousState.category}-content`);
    if (prevContent) prevContent.classList.add('active');

    document.body.classList.remove('profile-active');

    currentTab = previousState.category;

    // Clear profile navigation history
    profileHistory = [];
    profileHistoryIndex = -1;
    updateProfileNavButtons();

    updateDynamicFilters(previousState.category);
    filterItems();
}

function viewUserProfile(username, fromNavigation = false, asOverlay = false) {
    previousState.category = currentTab;

    // Track parent profile for "Back to X's profile" navigation
    // Only track if we're already viewing a profile (nested navigation)
    if (viewingProfileUsername && viewingProfileUsername.toLowerCase() !== username.toLowerCase()) {
        // Find current active tab
        const activeTabEl = document.querySelector('.profile-tab.active');
        const activeTab = activeTabEl ? activeTabEl.dataset.tab : 'uploads';

        // Push current profile with tab state to stack before navigating away
        parentProfileStack.push({
            username: viewingProfileUsername,
            activeTab: activeTab
        });
    }

    // Update the back button visibility and text
    updateBackToButton();

    // If opening as overlay, save scroll position and set flag
    if (asOverlay && !previousState.wasProfileOverlay) {
        const contentArea = document.querySelector('.content-area');
        previousState.scrollTop = contentArea ? contentArea.scrollTop : 0;

        // Detect actual active view (not just currentTab which is for browse tabs)
        let activeView = currentTab;
        if (document.getElementById('profile-content')?.classList.contains('active')) {
            activeView = 'profile';
        } else if (document.getElementById('junkies-content')?.classList.contains('active')) {
            activeView = 'junkies';
        } else if (document.getElementById('lounge-content')?.classList.contains('active')) {
            activeView = 'lounge';
        } else if (document.getElementById('notifications-content')?.classList.contains('active')) {
            activeView = 'notifications';
        } else if (document.getElementById('originals-content')?.classList.contains('active')) {
            activeView = 'originals';
        } else if (document.getElementById('settings-content')?.classList.contains('active')) {
            activeView = 'settings';
        } else if (document.getElementById('manage-sounds-content')?.classList.contains('active')) {
            activeView = 'manage-sounds';
        }

        previousState.tab = activeView;
        previousState.wasProfileOverlay = true;
    }

    // Add to history if not navigating via back/forward
    if (!fromNavigation) {
        // If we're not at the end of history, truncate forward history
        if (profileHistoryIndex < profileHistory.length - 1) {
            profileHistory = profileHistory.slice(0, profileHistoryIndex + 1);
        }
        // Only add if different from current
        if (profileHistory.length === 0 || profileHistory[profileHistoryIndex]?.toLowerCase() !== username.toLowerCase()) {
            profileHistory.push(username);
            profileHistoryIndex = profileHistory.length - 1;
        }
    }

    // Update navigation buttons
    updateProfileNavButtons();

    // Check if viewing own profile
    const currentUser = localStorage.getItem('profileUsername');
    isViewingOwnProfile = (username.toLowerCase() === (currentUser || '').toLowerCase());

    // Show/hide X button - only show when in overlay mode AND no parent profiles
    // When there are parent profiles, only the "Back to X's profile" button should show
    const closeBtn = document.getElementById('profile-close-btn');
    if (closeBtn) {
        if (parentProfileStack.length > 0) {
            // Has parent profiles - hide X, back-to button handles navigation
            closeBtn.classList.add('hidden');
        } else if (previousState.wasProfileOverlay) {
            // First-level overlay with no parents - show X
            closeBtn.classList.remove('hidden');
        } else if (isViewingOwnProfile) {
            closeBtn.classList.add('hidden');
        } else {
            closeBtn.classList.remove('hidden');
        }
    }

    const profileContent = document.getElementById('profile-content');
    const sidebarDownloadBtn = document.getElementById('sidebar-download-btn');

    // Different behavior for overlay vs full navigation
    if (previousState.wasProfileOverlay) {
        // Overlay mode: don't hide current tab panels, just overlay profile on top
        if (profileContent) {
            profileContent.classList.add('active');
            profileContent.classList.add('overlay-active');
        }
        document.body.classList.add('profile-overlay-active');
        document.body.classList.remove('profile-active');
    } else {
        // Full navigation mode: hide other panels, show profile
        document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
        if (profileContent) profileContent.classList.add('active');
        document.body.classList.add('profile-active');
        document.body.classList.remove('profile-overlay-active');
    }

    if (sidebarDownloadBtn) sidebarDownloadBtn.classList.add('hidden');

    // Reset to Uploads tab and hide Comments tab
    const commentsTab = document.getElementById('profile-comments-tab');
    if (commentsTab) commentsTab.classList.add('hidden');

    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.profile-tab[data-tab="uploads"]')?.classList.add('active');

    document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('profile-uploads-panel')?.classList.add('active');

    // Clear selected item for comments
    profileCommentsItem = null;
    profileCommentsCategory = null;

    // Set the profile being viewed BEFORE loading data (needed for getUserUploadGroups)
    if (typeof setViewingProfile === 'function') {
        setViewingProfile(username);
    }

    // Load the user's profile data
    loadUserProfileData(username);

    updateProfileEditVisibility();

    // Ensure Follow/Message buttons are visible when viewing other profiles
    const actionsContainer = document.getElementById('profile-actions');
    const followBtn = document.getElementById('profile-follow-btn');
    const messageBtn = document.getElementById('profile-message-btn');

    if (!isViewingOwnProfile) {
        // Show the actions container for other users
        if (actionsContainer) {
            actionsContainer.classList.remove('hidden-own-profile');
        }
        if (followBtn) {
            followBtn.style.display = '';
            // Update follow button state
            if (typeof updateFollowButtonState === 'function') {
                updateFollowButtonState();
            }
        }
        if (messageBtn) {
            // Check DM privacy before showing message button
            const canMessage = typeof canSendDmToUser === 'function' ? canSendDmToUser(username) : true;
            messageBtn.style.display = canMessage ? '' : 'none';
        }
    } else {
        // Hide on own profile
        if (actionsContainer) {
            actionsContainer.classList.add('hidden-own-profile');
        }
    }

    // Final check: ensure X button is hidden when there are parent profiles
    if (parentProfileStack.length > 0) {
        const closeBtnFinal = document.getElementById('profile-close-btn');
        if (closeBtnFinal) closeBtnFinal.classList.add('hidden');
    }
}

// Close profile overlay and return to previous state
function closeProfileOverlay() {
    // Check if we're actually in overlay mode
    if (!previousState.wasProfileOverlay) {
        // Not in overlay mode, use original behavior
        returnToOwnProfile();
        return;
    }

    // Get the previous tab before clearing state
    const previousTab = previousState.tab || 'presets';

    // Remove overlay classes from body
    document.body.classList.remove('profile-overlay-active');

    // If we were on our own profile before, return to it
    if (previousTab === 'profile') {
        // Load own profile
        const currentUsername = localStorage.getItem('profileUsername');
        if (currentUsername) {
            // Reset overlay state first
            previousState.wasProfileOverlay = false;
            previousState.scrollTop = 0;
            profileHistory = [];
            profileHistoryIndex = -1;
            parentProfileStack = [];
            updateBackToButton();

            // Hide close button
            const closeBtn = document.getElementById('profile-close-btn');
            if (closeBtn) closeBtn.classList.add('hidden');

            // Load own profile data
            if (typeof setViewingProfile === 'function') {
                setViewingProfile(currentUsername);
            }
            if (typeof loadUserProfileData === 'function') {
                loadUserProfileData(currentUsername);
            }

            // Ensure profile content is active
            const profileContent = document.getElementById('profile-content');
            if (profileContent) {
                profileContent.classList.add('active');
                profileContent.classList.remove('overlay-active');
            }
        }
        return;
    }

    // Map tab names to content element IDs
    const tabContentMap = {
        'presets': 'browse-content',
        'samples': 'browse-content',
        'midi': 'browse-content',
        'projects': 'browse-content',
        'browse': 'browse-content',
        'lounge': 'lounge-content',
        'junkies': 'junkies-content',
        'originals': 'originals-content',
        'notifications': 'notifications-content',
        'settings': 'settings-content',
        'manage-sounds': 'manage-sounds-content'
    };

    // First, ensure the previous content has active class (it should, but just in case)
    const contentId = tabContentMap[previousTab];
    if (contentId) {
        const contentEl = document.getElementById(contentId);
        if (contentEl && !contentEl.classList.contains('active')) {
            contentEl.classList.add('active');
        }
    }

    // Remove active/overlay classes from profile content
    const profileContent = document.getElementById('profile-content');
    if (profileContent) {
        profileContent.classList.remove('active');
        profileContent.classList.remove('overlay-active');
    }

    // Hide the close button
    const closeBtn = document.getElementById('profile-close-btn');
    if (closeBtn) closeBtn.classList.add('hidden');

    // Restore scroll position
    const contentArea = document.querySelector('.content-area');
    if (contentArea && previousState.scrollTop) {
        setTimeout(() => {
            contentArea.scrollTop = previousState.scrollTop;
        }, 10);
    }

    // Clear overlay flag and history
    previousState.wasProfileOverlay = false;
    previousState.scrollTop = 0;
    profileHistory = [];
    profileHistoryIndex = -1;
    parentProfileStack = [];
    updateBackToButton();
}

// Make closeProfileOverlay globally available
window.closeProfileOverlay = closeProfileOverlay;

// Update back/forward button visibility and text
function updateProfileNavButtons() {
    const backBtn = document.getElementById('profile-back-btn');
    const forwardBtn = document.getElementById('profile-forward-btn');

    // Back button - show if there's history behind us
    if (backBtn) {
        if (profileHistoryIndex > 0) {
            const prevUsername = profileHistory[profileHistoryIndex - 1];
            backBtn.textContent = `← ${prevUsername}`;
            backBtn.title = `Back to ${prevUsername}'s profile`;
            backBtn.classList.remove('hidden');
        } else {
            backBtn.classList.add('hidden');
        }
    }

    // Forward button - show if there's history ahead of us
    if (forwardBtn) {
        if (profileHistoryIndex < profileHistory.length - 1) {
            const nextUsername = profileHistory[profileHistoryIndex + 1];
            forwardBtn.textContent = `${nextUsername} →`;
            forwardBtn.title = `Forward to ${nextUsername}'s profile`;
            forwardBtn.classList.remove('hidden');
        } else {
            forwardBtn.classList.add('hidden');
        }
    }
}

// Go back to previous profile in history
function goBackProfile() {
    if (profileHistoryIndex > 0) {
        profileHistoryIndex--;
        const username = profileHistory[profileHistoryIndex];
        navigateToProfileFromHistory(username);
    }
}

// Go forward to next profile in history
function goForwardProfile() {
    if (profileHistoryIndex < profileHistory.length - 1) {
        profileHistoryIndex++;
        const username = profileHistory[profileHistoryIndex];
        navigateToProfileFromHistory(username);
    }
}

// Navigate to profile from history (without adding to history)
function navigateToProfileFromHistory(username) {
    updateProfileNavButtons();
    loadUserProfileData(username);

    // Update profile view state
    const currentUser = localStorage.getItem('profileUsername');
    isViewingOwnProfile = (username.toLowerCase() === (currentUser || '').toLowerCase());
    updateProfileEditVisibility();

    // Reset to Uploads tab
    const commentsTab = document.getElementById('profile-comments-tab');
    if (commentsTab) commentsTab.classList.add('hidden');

    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.profile-tab[data-tab="uploads"]')?.classList.add('active');

    document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('profile-uploads-panel')?.classList.add('active');

    profileCommentsItem = null;
    profileCommentsCategory = null;

    if (typeof setViewingProfile === 'function') {
        setViewingProfile(username);
    }
}

// Return to own profile (X button)
function returnToOwnProfile() {
    const ownUsername = localStorage.getItem('profileUsername');
    if (ownUsername) {
        // Clear history completely
        profileHistory = [];
        profileHistoryIndex = -1;
        parentProfileStack = [];

        // Hide all nav buttons immediately
        const backBtn = document.getElementById('profile-back-btn');
        const forwardBtn = document.getElementById('profile-forward-btn');
        const closeBtn = document.getElementById('profile-close-btn');
        const backToBtn = document.getElementById('profile-back-to-btn');
        if (backBtn) backBtn.classList.add('hidden');
        if (forwardBtn) forwardBtn.classList.add('hidden');
        if (closeBtn) closeBtn.classList.add('hidden');
        if (backToBtn) backToBtn.classList.add('hidden');

        // Load own profile data
        loadUserProfileData(ownUsername);

        // Update state
        isViewingOwnProfile = true;
        updateProfileEditVisibility();

        // Reset to Uploads tab
        const commentsTab = document.getElementById('profile-comments-tab');
        if (commentsTab) commentsTab.classList.add('hidden');

        document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.profile-tab[data-tab="uploads"]')?.classList.add('active');

        document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('profile-uploads-panel')?.classList.add('active');

        profileCommentsItem = null;
        profileCommentsCategory = null;

        if (typeof setViewingProfile === 'function') {
            setViewingProfile(ownUsername);
        }
    }
}

// Load another user's profile data
async function loadUserProfileData(username) {
    // Check if loading own profile
    const currentUser = localStorage.getItem('profileUsername');
    const isOwnProfile = username.toLowerCase() === (currentUser || '').toLowerCase();

    let userProfile = { avatar: null, banner: null, bio: '' };
    let followerCount = 0;
    let followingCount = 0;

    // Try to fetch from Supabase first
    try {
        const { data: profile } = await supabaseGetProfileByUsername(username);
        if (profile) {
            userProfile = {
                avatar: profile.avatar_url,
                banner: profile.banner_url,
                bio: profile.bio || ''
            };

            // Get follower/following counts from Supabase
            const { count: followers } = await supabaseGetFollowerCount(profile.id);
            const { count: following } = await supabaseGetFollowingCount(profile.id);
            followerCount = followers || 0;
            followingCount = following || 0;
        }
    } catch (e) {
        console.log('Supabase profile fetch failed, using localStorage fallback');
        // Fallback to localStorage
        const allUserProfiles = safeJSONParse(localStorage.getItem('allUserProfiles'), {});
        const allUserFollowers = safeJSONParse(localStorage.getItem('allUserFollowers'), {});

        if (isOwnProfile) {
            userProfile = {
                avatar: localStorage.getItem('profileAvatar'),
                banner: localStorage.getItem('profileBanner'),
                bio: localStorage.getItem('profileBio')
            };
        } else {
            userProfile = allUserProfiles[username] || {};
        }
        followerCount = allUserFollowers[username] || 0;

        const userFollowingLists = safeJSONParse(localStorage.getItem('userFollowingLists'), {});
        followingCount = (userFollowingLists[username] || []).length;
    }

    // Update profile username
    const profileUsername = document.getElementById('profile-username');
    if (profileUsername) profileUsername.textContent = username;

    // Update profile avatar
    const profileAvatar = document.getElementById('profile-avatar');
    if (profileAvatar) {
        const avatarCssUrl = sanitizeCSSUrl(userProfile.avatar);
        if (avatarCssUrl) {
            profileAvatar.style.backgroundImage = `url('${avatarCssUrl}')`;
            profileAvatar.classList.add('has-image');
        } else {
            profileAvatar.style.backgroundImage = '';
            profileAvatar.classList.remove('has-image');
        }
    }

    // Update profile banner
    const profileBanner = document.getElementById('profile-banner-section');
    if (profileBanner) {
        const bannerCssUrl = sanitizeCSSUrl(userProfile.banner);
        if (bannerCssUrl) {
            profileBanner.style.backgroundImage = `url('${bannerCssUrl}')`;
        } else {
            profileBanner.style.backgroundImage = '';
        }
    }

    // Update profile bio
    const profileBio = document.getElementById('profile-about');
    if (profileBio) {
        const bio = userProfile.bio || '';
        if (bio) {
            profileBio.textContent = bio;
        } else {
            profileBio.textContent = isOwnProfile ? 'Change bio in settings.' : 'No bio available.';
        }
    }

    // Calculate stats from items (still using local items for now)
    const allItems = [];
    if (typeof items !== 'undefined') {
        ['presets', 'samples', 'midi', 'projects', 'originals'].forEach(category => {
            if (items[category]) {
                items[category].forEach(item => {
                    allItems.push({ ...item, category });
                });
            }
        });
    }

    // Count uploads and downloads for this user
    const userUploads = allItems.filter(item =>
        item.uploader && item.uploader.toLowerCase() === username.toLowerCase()
    );
    const uploadCount = userUploads.length;
    const totalDownloads = userUploads.reduce((sum, item) => sum + (item.downloads || 0), 0);

    // Update stats display
    const uploadsEl = document.getElementById('profile-uploads');
    const downloadsEl = document.getElementById('profile-downloads');
    const followersEl = document.getElementById('profile-followers');
    const followingEl = document.getElementById('profile-following');

    if (uploadsEl) uploadsEl.textContent = uploadCount;
    if (downloadsEl) downloadsEl.textContent = totalDownloads;
    if (followersEl) followersEl.textContent = followerCount;
    if (followingEl) followingEl.textContent = followingCount;

    // Load user's uploads in the profile grid
    loadUserUploadsGrid(username);

    // Reset upload filter to 'all' and re-render category cards
    currentUploadFilter = 'all';
    document.querySelectorAll('.profile-upload-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === 'all');
    });
    renderUploadCards('all');
}

// Load user's uploads into the profile grid
function loadUserUploadsGrid(username) {
    const grid = document.getElementById('profile-content-grid');
    const title = document.getElementById('profile-content-title');
    if (!grid) return;

    if (title) title.textContent = 'Uploads';

    // Get all uploads by this user
    const userUploads = [];
    if (typeof items !== 'undefined') {
        ['presets', 'samples', 'midi', 'projects', 'originals'].forEach(category => {
            if (items[category]) {
                items[category].forEach(item => {
                    if (item.uploader && item.uploader.toLowerCase() === username.toLowerCase()) {
                        userUploads.push({ ...item, category });
                    }
                });
            }
        });
    }

    if (userUploads.length === 0) {
        grid.innerHTML = `
            <div class="profile-empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>No uploads yet</span>
            </div>
        `;
        return;
    }

    // Render uploads using createCardHTML
    grid.innerHTML = '';
    userUploads.forEach(item => {
        const wrap = document.createElement('div');
        wrap.dataset.itemId = item.id;
        wrap.dataset.category = item.category;
        wrap.className = 'profile-item-card-wrap';
        wrap.addEventListener('click', (e) => {
            if (typeof handleProfileCardClick === 'function') {
                handleProfileCardClick(e, item.id, item.category);
            }
        });
        if (typeof createCardHTML === 'function') {
            wrap.innerHTML = createCardHTML(item, item.category);
        } else {
            // Ultimate fallback
            wrap.innerHTML = `<div class="profile-upload-card"><div class="upload-title">${escapeHTML(item.title || 'Untitled')}</div></div>`;
        }
        grid.appendChild(wrap);

        // Initialize audio features
        if (typeof setupCardAudio === 'function') {
            setupCardAudio(item, item.category);
        }
    });
}

// Update all profile avatars across the page
function updateAllProfileAvatars(avatarUrl) {
    const safeUrl = sanitizeCSSUrl(avatarUrl);
    if (!safeUrl) return;

    const profileAvatar = document.getElementById('profile-avatar');
    if (profileAvatar) {
        profileAvatar.style.backgroundImage = `url('${safeUrl}')`;
        profileAvatar.classList.add('has-image');
    }

    document.querySelectorAll('.user-avatar, .message-avatar, .center-panel-avatar, .center-panel-input-avatar, .center-panel-comment-avatar').forEach(el => {
        if (el.dataset.isCurrentUser !== 'false') {
            el.style.backgroundImage = `url('${safeUrl}')`;
            el.classList.add('has-image');
            const svg = el.querySelector('svg');
            if (svg) svg.style.display = 'none';
        }
    });
}

// Profile upload handlers
function initProfileUploads() {
    // Profile banner upload
    document.getElementById('profile-banner-input')?.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // 5MB cap
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('Image must be under 5MB. Please use a smaller image.');
            return;
        }

        // Get current user ID from Supabase
        const { user } = await supabaseGetUser();
        if (!user) {
            alert('Please log in to update your banner.');
            return;
        }

        try {
            // Upload to Supabase Storage (using 'uploads' bucket with folder path)
            const fileExt = file.name.split('.').pop();
            const filePath = `banners/${user.id}/banner_${Date.now()}.${fileExt}`;
            const { url, error } = await supabaseUploadFile('uploads', filePath, file);

            if (error) {
                alert('Failed to upload banner. Please try again.');
                console.error('Banner upload error:', error);
                return;
            }

            // Update visual
            const bannerSection = document.getElementById('profile-banner-section');
            if (bannerSection) {
                bannerSection.style.backgroundImage = `url('${url}')`;
            }

            // Update profile in Supabase
            await supabaseUpdateProfile(user.id, { banner_url: url });

            // Update localStorage for compatibility
            localStorage.setItem('profileBanner', url);

        } catch (err) {
            alert('Failed to upload banner. Please try again.');
            console.error('Banner upload error:', err);
        }
    });

    // Profile avatar upload
    document.getElementById('profile-avatar-input')?.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Get current user ID from Supabase
        const { user } = await supabaseGetUser();
        if (!user) {
            alert('Please log in to update your avatar.');
            return;
        }

        try {
            // Upload to Supabase Storage (using 'uploads' bucket with folder path)
            const fileExt = file.name.split('.').pop();
            const filePath = `avatars/${user.id}/avatar_${Date.now()}.${fileExt}`;
            const { url, error } = await supabaseUploadFile('uploads', filePath, file);

            if (error) {
                alert('Failed to upload avatar. Please try again.');
                console.error('Avatar upload error:', error);
                return;
            }

            // Update all avatar displays
            updateAllProfileAvatars(url);

            // Update profile in Supabase
            await supabaseUpdateProfile(user.id, { avatar_url: url });

            // Update localStorage for compatibility
            localStorage.setItem('profileAvatar', url);

        } catch (err) {
            alert('Failed to upload avatar. Please try again.');
            console.error('Avatar upload error:', err);
        }
    });

    // Presets background upload
    document.getElementById('presets-bg-input')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const overlay = document.getElementById('presets-bg-overlay');
                const cssUrl = sanitizeCSSUrl(e.target.result);
                if (cssUrl && overlay) {
                    overlay.style.backgroundImage = `url('${cssUrl}')`;
                    localStorage.setItem('presetsBg', e.target.result);
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

// Save user profile data to global storage (for Junkies page)
function saveUserProfileData(field, value) {
    const username = localStorage.getItem('profileUsername');
    if (!username) return;

    let allUserProfiles = {};
    try {
        allUserProfiles = safeJSONParse(localStorage.getItem('allUserProfiles'), {});
    } catch (e) {
        // Silent fail - use empty object
    }

    if (!allUserProfiles[username]) {
        allUserProfiles[username] = {};
    }

    allUserProfiles[username][field] = value;
    localStorage.setItem('allUserProfiles', JSON.stringify(allUserProfiles));
}
window.saveUserProfileData = saveUserProfileData;

// Load saved profile data
function loadProfileData() {
    const savedPresetsBg = localStorage.getItem('presetsBg');
    const presetsCssUrl = sanitizeCSSUrl(savedPresetsBg);
    if (presetsCssUrl) {
        const presetsOverlay = document.getElementById('presets-bg-overlay');
        if (presetsOverlay) presetsOverlay.style.backgroundImage = `url('${presetsCssUrl}')`;
    }

    const savedProfileBanner = localStorage.getItem('profileBanner');
    const bannerCssUrl = sanitizeCSSUrl(savedProfileBanner);
    if (bannerCssUrl) {
        const bannerSection = document.getElementById('profile-banner-section');
        if (bannerSection) bannerSection.style.backgroundImage = `url('${bannerCssUrl}')`;
    }

    const savedProfileAvatar = localStorage.getItem('profileAvatar');
    if (savedProfileAvatar) {
        updateAllProfileAvatars(savedProfileAvatar);
    }

    // Load username and bio
    const savedUsername = localStorage.getItem('profileUsername');
    const savedBio = localStorage.getItem('profileBio');

    if (savedUsername) {
        const profileUsername = document.getElementById('profile-username');
        if (profileUsername) profileUsername.textContent = savedUsername;
        // If username exists, consider user logged in
        localStorage.setItem('isLoggedIn', 'true');
    }

    const profileBio = document.getElementById('profile-about');
    if (profileBio) {
        profileBio.textContent = savedBio || 'Change bio in settings.';
    }

    // Update user nav section visibility
    updateUserNavSection();
}

// Calculate responsive font size based on username length
function getResponsiveUsernameSize(username) {
    const len = username.length;
    const maxSize = 1.1;  // rem - full size for short names
    const minSize = 0.7;  // rem - minimum readable size

    // Thresholds for scaling
    if (len <= 8) return maxSize;           // Short names: full size
    if (len <= 12) return 0.95;             // Medium names: slightly smaller
    if (len <= 16) return 0.85;             // Longer names: smaller
    if (len <= 20) return 0.75;             // Very long names: even smaller
    return minSize;                          // Extra long names: minimum size
}

// Update user nav section based on login status
function updateUserNavSection() {
    const userNavSection = document.getElementById('user-nav-section');
    const userNavTitle = document.getElementById('user-nav-title');
    const userProfileSection = document.getElementById('user-profile-section');
    const authSection = document.getElementById('auth-section');
    const savedUsername = localStorage.getItem('profileUsername');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    // Update header title (Preset Junkies vs Username dropdown)
    const navTitleText = document.getElementById('nav-title-text');
    const navTitleUser = document.getElementById('nav-title-user');
    const navTitleUsername = document.getElementById('nav-title-username');

    if (isLoggedIn && savedUsername) {
        // Show username dropdown, hide "Preset Junkies"
        if (navTitleText) navTitleText.style.display = 'none';
        if (navTitleUser) navTitleUser.style.display = 'flex';
        if (navTitleUsername) {
            navTitleUsername.textContent = savedUsername;
            // Apply responsive font size
            const fontSize = getResponsiveUsernameSize(savedUsername);
            navTitleUsername.style.fontSize = `${fontSize}rem`;
        }

        // Hide the old HOME section since items are now in dropdown
        if (userNavSection) userNavSection.style.display = 'none';

        // Hide the bottom user section (avatar + logout) - now in dropdown
        if (userProfileSection) userProfileSection.style.display = 'none';
        if (authSection) authSection.style.display = 'none';
    } else {
        // Show "Preset Junkies", hide username dropdown
        if (navTitleText) navTitleText.style.display = 'block';
        if (navTitleUser) navTitleUser.style.display = 'none';
        if (userNavSection) userNavSection.style.display = 'none';

        // Show login button, hide user section
        if (userProfileSection) userProfileSection.style.display = 'none';
        if (authSection) authSection.style.display = 'block';
    }
}
window.updateUserNavSection = updateUserNavSection;

// Initialize the user dropdown menu
function initUserDropdown() {
    const navTitleUser = document.getElementById('nav-title-user');
    const dropdown = document.getElementById('nav-user-dropdown');

    if (!navTitleUser || !dropdown) return;

    // Toggle dropdown on click
    navTitleUser.addEventListener('click', (e) => {
        e.stopPropagation();
        navTitleUser.classList.toggle('active');
        dropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!navTitleUser.contains(e.target) && !dropdown.contains(e.target)) {
            navTitleUser.classList.remove('active');
            dropdown.classList.remove('show');
        }
    });

    // Handle dropdown item clicks
    dropdown.querySelectorAll('.nav-dropdown-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;

            // Close dropdown
            navTitleUser.classList.remove('active');
            dropdown.classList.remove('show');

            // Navigate using global function
            if (typeof navigateToView === 'function') {
                navigateToView(view);
            }
        });
    });

    // Handle upload button
    const uploadBtn = document.getElementById('dropdown-upload-btn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navTitleUser.classList.remove('active');
            dropdown.classList.remove('show');

            if (typeof openUploadModal === 'function') {
                openUploadModal();
            }
        });
    }

    // Handle logout button
    const logoutBtn = document.getElementById('dropdown-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navTitleUser.classList.remove('active');
            dropdown.classList.remove('show');

            if (typeof logout === 'function') {
                logout();
            }
        });
    }
}

// Current profile selection
let currentProfileGroup = null;
let currentUploadFilter = 'all';
let profileCurrentPage = 1;
const PROFILE_ITEMS_PER_PAGE_OPTIONS = [12, 24, 36, 48];
let profileItemsPerPage = 12; // 3 columns x 4 rows (default)

// Stored usernames (simulating a database of taken usernames)
let takenUsernames = window.RESERVED_USERNAMES || ["admin", "moderator", "system", "support"];
try {
    const stored = safeJSONParse(localStorage.getItem('takenUsernames'), []);
    // Merge with reserved names
    const reserved = window.RESERVED_USERNAMES || ["admin", "moderator", "system", "support"];
    takenUsernames = [...new Set([...reserved, ...stored])];
} catch (e) {
    // Silent fail - use reserved names only
}

// Get current username (same as upload system)
function getCurrentUsername() {
    return localStorage.getItem('profileUsername') || 'Username';
}

// Profile Edit Modal Functions
function initProfileEdit() {
    const editBtn = document.getElementById('profile-bio-edit-btn');
    const modal = document.getElementById('profile-edit-modal');
    const closeBtn = document.getElementById('profile-edit-close');
    const cancelBtn = document.getElementById('profile-edit-cancel');
    const saveBtn = document.getElementById('profile-edit-save');
    const usernameInput = document.getElementById('profile-edit-username');
    const bioInput = document.getElementById('profile-edit-bio');
    const bioCharCount = document.getElementById('bio-char-count');

    if (editBtn) {
        editBtn.addEventListener('click', openProfileEditModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeProfileEditModal);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeProfileEditModal);
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfileChanges);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeProfileEditModal();
        });
    }

    // Username validation on input
    if (usernameInput) {
        usernameInput.addEventListener('input', validateUsernameInput);
    }

    // Bio character count
    if (bioInput && bioCharCount) {
        bioInput.addEventListener('input', () => {
            bioCharCount.textContent = `${bioInput.value.length}/100`;
        });
    }
}

function openProfileEditModal() {
    const modal = document.getElementById('profile-edit-modal');
    const usernameInput = document.getElementById('profile-edit-username');
    const bioInput = document.getElementById('profile-edit-bio');
    const bioCharCount = document.getElementById('bio-char-count');
    const usernameError = document.getElementById('username-error');

    // Load current values
    const currentUsername = localStorage.getItem('profileUsername') || '';
    const currentBio = localStorage.getItem('profileBio') || '';

    if (usernameInput) {
        usernameInput.value = currentUsername;
        usernameInput.classList.remove('error');
    }
    if (bioInput) bioInput.value = currentBio;
    if (bioCharCount) bioCharCount.textContent = `${currentBio.length}/150`;
    if (usernameError) usernameError.textContent = '';

    if (modal) modal.style.display = 'flex';
}
window.openProfileEditModal = openProfileEditModal;

function closeProfileEditModal() {
    const modal = document.getElementById('profile-edit-modal');
    if (modal) modal.style.display = 'none';
}

function validateUsernameInput() {
    const input = document.getElementById('profile-edit-username');
    const errorEl = document.getElementById('username-error');
    if (!input || !errorEl) return true;

    const username = input.value;
    const currentUsername = localStorage.getItem('profileUsername') || '';

    // Clear previous error
    errorEl.textContent = '';
    input.classList.remove('error');

    if (!username) return true; // Empty is ok during typing

    // Check for spaces
    if (/\s/.test(username)) {
        errorEl.textContent = 'Username cannot contain spaces';
        input.classList.add('error');
        return false;
    }

    // Check if starts with _ or -
    if (/^[_-]/.test(username)) {
        errorEl.textContent = 'Username cannot start with _ or -';
        input.classList.add('error');
        return false;
    }

    // Check for valid characters (letters, numbers, _, -)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        errorEl.textContent = 'Only letters, numbers, _ and - allowed';
        input.classList.add('error');
        return false;
    }

    // Check for gibberish/keyboard mashing
    const gibberishCheck = validateUsername(username);
    if (!gibberishCheck.valid) {
        errorEl.textContent = gibberishCheck.error;
        input.classList.add('error');
        return false;
    }

    // Check for duplicate (case-insensitive), but allow keeping current username
    const usernameLower = username.toLowerCase();
    if (usernameLower !== currentUsername.toLowerCase()) {
        const isDuplicate = takenUsernames.some(u => u.toLowerCase() === usernameLower);
        if (isDuplicate) {
            errorEl.textContent = `"${username}" is already taken`;
            input.classList.add('error');
            return false;
        }
    }

    return true;
}

function saveProfileChanges() {
    const usernameInput = document.getElementById('profile-edit-username');
    const bioInput = document.getElementById('profile-edit-bio');
    const errorEl = document.getElementById('username-error');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const bio = bioInput ? bioInput.value.trim() : '';

    // Validate username
    if (!username) {
        if (errorEl) errorEl.textContent = 'Username is required';
        if (usernameInput) usernameInput.classList.add('error');
        return;
    }

    if (!validateUsernameInput()) {
        return;
    }

    // Validate bio if provided
    if (bio) {
        const bioValidation = validateDescription(bio);
        if (!bioValidation.valid) {
            if (bioInput) {
                bioInput.classList.add('error');
                bioInput.focus();
            }
            if (errorEl) errorEl.textContent = bioValidation.error;
            return;
        }
    }

    // Get old username to remove from taken list
    const oldUsername = localStorage.getItem('profileUsername');

    // Update taken usernames list
    if (oldUsername && oldUsername.toLowerCase() !== username.toLowerCase()) {
        // Remove old username
        takenUsernames = takenUsernames.filter(u => u.toLowerCase() !== oldUsername.toLowerCase());
    }

    // Add new username if not already there
    if (!takenUsernames.some(u => u.toLowerCase() === username.toLowerCase())) {
        takenUsernames.push(username);
    }

    localStorage.setItem('takenUsernames', JSON.stringify(takenUsernames));

    // Save profile data
    localStorage.setItem('profileUsername', username);
    localStorage.setItem('profileBio', bio);
    localStorage.setItem('isLoggedIn', 'true');

    // Update UI
    const profileUsername = document.getElementById('profile-username');
    const profileBio = document.getElementById('profile-about');

    if (profileUsername) profileUsername.textContent = username;
    if (profileBio) profileBio.textContent = bio || 'Change bio in settings.';

    // Update lounge currentUser
    if (typeof currentUser !== 'undefined') {
        currentUser = username;
    }

    // Update user nav section
    updateUserNavSection();

    closeProfileEditModal();
}

// Get user's uploads for a category
function getUserUploads(category) {
    const username = getCurrentUsername();

    if (category === 'presets') return (items.presets || []).filter(p => p.uploader === username);
    if (category === 'samples') return (items.samples || []).filter(s => s.uploader === username);
    if (category === 'midi') return (items.midi || []).filter(m => m.uploader === username);
    if (category === 'projects') return (items.projects || []).filter(p => p.uploader === username);
    if (category === 'likes') {
        return [
            ...(items.presets || []).filter(p => p.liked),
            ...(items.samples || []).filter(s => s.liked),
            ...(items.midi || []).filter(m => m.liked),
            ...(items.projects || []).filter(p => p.liked)
        ];
    }
    return [];
}

// Get category for a liked item
function getItemCategory(item) {
    if ((items.presets || []).includes(item)) return 'presets';
    if ((items.samples || []).includes(item)) return 'samples';
    if ((items.midi || []).includes(item)) return 'midi';
    if ((items.projects || []).includes(item)) return 'projects';
    if ((items.originals || []).includes(item)) return 'originals';
    return 'presets';
}

// Get all user uploads grouped dynamically
function getUserUploadGroups() {
    // Use viewingProfileUsername if viewing another profile, otherwise current user
    const username = viewingProfileUsername || getCurrentUsername();
    const usernameLower = username ? username.toLowerCase() : '';
    const groups = [];

    // Group presets by VST
    const userPresets = (items.presets || []).filter(p => p.uploader && p.uploader.toLowerCase() === usernameLower);
    const presetsByVst = {};
    userPresets.forEach(p => {
        const vst = p.vst || 'Other';
        if (!presetsByVst[vst]) presetsByVst[vst] = [];
        presetsByVst[vst].push(p);
    });
    Object.entries(presetsByVst).forEach(([vst, groupItems]) => {
        groups.push({
            id: `presets-${vst.toLowerCase().replace(/\s+/g, '-')}`,
            name: vst.toUpperCase(),
            category: 'presets',
            groupKey: vst,
            count: groupItems.length,
            items: groupItems
        });
    });

    // Group samples by type
    const userSamples = (items.samples || []).filter(s => s.uploader && s.uploader.toLowerCase() === usernameLower);
    const samplesByType = {};
    userSamples.forEach(s => {
        const type = s.type || 'Other';
        if (!samplesByType[type]) samplesByType[type] = [];
        samplesByType[type].push(s);
    });
    Object.entries(samplesByType).forEach(([type, groupItems]) => {
        groups.push({
            id: `samples-${type.toLowerCase().replace(/\s+/g, '-')}`,
            name: type.toUpperCase(),
            category: 'samples',
            groupKey: type,
            count: groupItems.length,
            items: groupItems
        });
    });

    // Group MIDI by VST
    const userMidi = (items.midi || []).filter(m => m.uploader && m.uploader.toLowerCase() === usernameLower);
    const midiByVst = {};
    userMidi.forEach(m => {
        const vst = m.vst || 'MIDI';
        if (!midiByVst[vst]) midiByVst[vst] = [];
        midiByVst[vst].push(m);
    });
    Object.entries(midiByVst).forEach(([vst, groupItems]) => {
        groups.push({
            id: `midi-${vst.toLowerCase().replace(/\s+/g, '-')}`,
            name: vst.toUpperCase(),
            category: 'midi',
            groupKey: vst,
            count: groupItems.length,
            items: groupItems
        });
    });

    // Group projects by DAW
    const userProjects = (items.projects || []).filter(p => p.uploader && p.uploader.toLowerCase() === usernameLower);
    const projectsByDaw = {};
    userProjects.forEach(p => {
        const daw = p.daw || 'Other';
        if (!projectsByDaw[daw]) projectsByDaw[daw] = [];
        projectsByDaw[daw].push(p);
    });
    Object.entries(projectsByDaw).forEach(([daw, groupItems]) => {
        const formattedDaw = typeof formatDawLabel === 'function' ? formatDawLabel(daw) : daw;
        groups.push({
            id: `projects-${daw.toLowerCase().replace(/\s+/g, '-')}`,
            name: formattedDaw.toUpperCase(),
            category: 'projects',
            groupKey: daw,
            count: groupItems.length,
            items: groupItems
        });
    });

    // Group originals by genre
    const userOriginals = (items.originals || []).filter(o => o.uploader && o.uploader.toLowerCase() === usernameLower);
    const originalsByGenre = {};
    userOriginals.forEach(o => {
        const genre = o.genre || 'Other';
        if (!originalsByGenre[genre]) originalsByGenre[genre] = [];
        originalsByGenre[genre].push(o);
    });
    Object.entries(originalsByGenre).forEach(([genre, groupItems]) => {
        groups.push({
            id: `originals-${genre.toLowerCase().replace(/\s+/g, '-')}`,
            name: genre.toUpperCase(),
            category: 'originals',
            groupKey: genre,
            count: groupItems.length,
            items: groupItems
        });
    });

    return groups;
}

// Render dynamic upload cards
function renderUploadCards(filter = currentUploadFilter) {
    const container = document.querySelector('.profile-category-cards');
    if (!container) return;

    currentUploadFilter = filter;

    const allGroups = getUserUploadGroups();
    // If filter is 'all', show all groups; otherwise filter by category
    const groups = filter === 'all' ? allGroups : allGroups.filter(g => g.category === filter);

    const filterLabel = filter === 'all' ? 'All Sounds' : filter;

    if (groups.length === 0) {
        container.innerHTML = `<span style="color: #666; font-size: 14px;">No ${filterLabel} uploads yet</span>`;
        // Clear right panel
        const grid = document.getElementById('profile-content-grid');
        const title = document.getElementById('profile-content-title');
        if (title) title.textContent = filterLabel.charAt(0).toUpperCase() + filterLabel.slice(1);
        if (grid) grid.innerHTML = `
            <div class="profile-empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>No ${filterLabel} yet</span>
            </div>
        `;
        return;
    }

    // Get VST/type image for the card background
    const getCardImage = (group) => {
        if (group.category === 'presets' || group.category === 'midi') {
            const vstKey = group.groupKey.toLowerCase();
            return vstImages[vstKey] || null;
        }
        if (group.category === 'projects') {
            const dawKey = group.groupKey.toLowerCase();
            return dawImages[dawKey] || null;
        }
        return null;
    };

    container.innerHTML = groups.map(group => {
        const bgImage = getCardImage(group);
        const safeBgImage = bgImage ? sanitizeURL(bgImage) : '';
        const bgStyle = safeBgImage ? `background-image: url('${safeBgImage}'); background-size: cover; background-position: center;` : '';
        const noImageClass = !safeBgImage ? 'no-image' : '';

        return `
            <div class="profile-category-card ${noImageClass}" data-group-id="${escapeAttr(String(group.id))}" data-category="${escapeAttr(group.category)}" data-group-key="${escapeAttr(group.groupKey)}" style="${bgStyle}">
                <div class="category-card-overlay"></div>
                <span class="category-card-name">${escapeHTML(group.name)}</span>
                <span class="category-card-count">${group.count}</span>
            </div>
        `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.profile-category-card').forEach(card => {
        card.addEventListener('click', function() {
            container.querySelectorAll('.profile-category-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');

            const groupId = this.dataset.groupId;
            const group = groups.find(g => g.id === groupId);
            if (group) {
                currentProfileGroup = group;
                renderProfileContentFromGroup(group);
            }
        });
    });

    // Auto-select first card
    const firstCard = container.querySelector('.profile-category-card');
    if (firstCard) {
        firstCard.click();
    }
}

// Get saved items grouped by VST/DAW (similar to getUserUploadGroups but for library)
let currentSavedFilter = 'presets';
let currentSavedGroup = null;

function getSavedItemGroups() {
    const groups = [];

    // Group saved presets by VST
    const savedPresets = library.filter(l => l.category === 'presets');
    const presetsByVst = {};
    savedPresets.forEach(libItem => {
        const item = items.presets?.find(i => i.id === libItem.id);
        if (!item) return;
        const vst = item.vst || 'Other';
        if (!presetsByVst[vst]) presetsByVst[vst] = [];
        presetsByVst[vst].push(item);
    });
    Object.entries(presetsByVst).forEach(([vst, groupItems]) => {
        groups.push({
            id: `saved-presets-${vst.toLowerCase().replace(/\s+/g, '-')}`,
            name: vst.toUpperCase(),
            category: 'presets',
            groupKey: vst,
            count: groupItems.length,
            items: groupItems
        });
    });

    // Group saved samples by type
    const savedSamples = library.filter(l => l.category === 'samples');
    const samplesByType = {};
    savedSamples.forEach(libItem => {
        const item = items.samples?.find(i => i.id === libItem.id);
        if (!item) return;
        const type = item.type || 'Other';
        if (!samplesByType[type]) samplesByType[type] = [];
        samplesByType[type].push(item);
    });
    Object.entries(samplesByType).forEach(([type, groupItems]) => {
        groups.push({
            id: `saved-samples-${type.toLowerCase().replace(/\s+/g, '-')}`,
            name: type.toUpperCase(),
            category: 'samples',
            groupKey: type,
            count: groupItems.length,
            items: groupItems
        });
    });

    // Group saved MIDI by VST
    const savedMidi = library.filter(l => l.category === 'midi');
    const midiByVst = {};
    savedMidi.forEach(libItem => {
        const item = items.midi?.find(i => i.id === libItem.id);
        if (!item) return;
        const vst = item.vst || 'MIDI';
        if (!midiByVst[vst]) midiByVst[vst] = [];
        midiByVst[vst].push(item);
    });
    Object.entries(midiByVst).forEach(([vst, groupItems]) => {
        groups.push({
            id: `saved-midi-${vst.toLowerCase().replace(/\s+/g, '-')}`,
            name: vst.toUpperCase(),
            category: 'midi',
            groupKey: vst,
            count: groupItems.length,
            items: groupItems
        });
    });

    // Group saved projects by DAW
    const savedProjects = library.filter(l => l.category === 'projects');
    const projectsByDaw = {};
    savedProjects.forEach(libItem => {
        const item = items.projects?.find(i => i.id === libItem.id);
        if (!item) return;
        const daw = item.daw || 'Other';
        if (!projectsByDaw[daw]) projectsByDaw[daw] = [];
        projectsByDaw[daw].push(item);
    });
    Object.entries(projectsByDaw).forEach(([daw, groupItems]) => {
        const formattedDaw = typeof formatDawLabel === 'function' ? formatDawLabel(daw) : daw;
        groups.push({
            id: `saved-projects-${daw.toLowerCase().replace(/\s+/g, '-')}`,
            name: formattedDaw.toUpperCase(),
            category: 'projects',
            groupKey: daw,
            count: groupItems.length,
            items: groupItems
        });
    });

    return groups;
}

// Render dynamic saved cards (similar to renderUploadCards)
function renderSavedCards(filter = currentSavedFilter) {
    const container = document.querySelector('.profile-saved-cards');
    if (!container) return;

    currentSavedFilter = filter;

    const allGroups = getSavedItemGroups();
    const groups = allGroups.filter(g => g.category === filter);

    if (groups.length === 0) {
        container.innerHTML = `<span style="color: #666; font-size: 14px;">No saved ${filter} yet</span>`;
        // Clear right panel
        const grid = document.getElementById('profile-content-grid');
        const title = document.getElementById('profile-content-title');
        if (title) title.textContent = 'Saved ' + filter.charAt(0).toUpperCase() + filter.slice(1);
        if (grid) grid.innerHTML = `
            <div class="profile-empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span>No saved ${filter} yet</span>
            </div>
        `;
        return;
    }

    // Get VST/type image for the card background
    const getCardImage = (group) => {
        if (group.category === 'presets' || group.category === 'midi') {
            const vstKey = group.groupKey.toLowerCase();
            return vstImages[vstKey] || null;
        }
        if (group.category === 'projects') {
            const dawKey = group.groupKey.toLowerCase();
            return dawImages[dawKey] || null;
        }
        return null;
    };

    container.innerHTML = groups.map(group => {
        const bgImage = getCardImage(group);
        const safeBgImage = bgImage ? sanitizeURL(bgImage) : '';
        const bgStyle = safeBgImage ? `background-image: url('${safeBgImage}'); background-size: cover; background-position: center;` : '';
        const noImageClass = !safeBgImage ? 'no-image' : '';

        return `
            <div class="profile-category-card ${noImageClass}" data-group-id="${escapeAttr(String(group.id))}" data-category="${escapeAttr(group.category)}" data-group-key="${escapeAttr(group.groupKey)}" style="${bgStyle}">
                <div class="category-card-overlay"></div>
                <span class="category-card-name">${escapeHTML(group.name)}</span>
                <span class="category-card-count">${group.count}</span>
            </div>
        `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.profile-category-card').forEach(card => {
        card.addEventListener('click', function() {
            container.querySelectorAll('.profile-category-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');

            const groupId = this.dataset.groupId;
            const group = groups.find(g => g.id === groupId);
            if (group) {
                currentSavedGroup = group;
                renderProfileContentFromGroup(group);
            }
        });
    });

    // Auto-select first card
    const firstCard = container.querySelector('.profile-category-card');
    if (firstCard) {
        firstCard.click();
    }
}

// Get liked items grouped by VST/DAW (similar to getSavedItemGroups but for liked items)
let currentLikesFilter = 'presets';
let currentLikesGroup = null;

function getLikedItemGroups() {
    const groups = [];

    // Group liked presets by VST
    const likedPresets = (items.presets || []).filter(p => p.liked);
    const presetsByVst = {};
    likedPresets.forEach(item => {
        const vst = item.vst || 'Other';
        if (!presetsByVst[vst]) presetsByVst[vst] = [];
        presetsByVst[vst].push(item);
    });
    Object.entries(presetsByVst).forEach(([vst, groupItems]) => {
        groups.push({
            id: `likes-presets-${vst.toLowerCase().replace(/\s+/g, '-')}`,
            name: vst.toUpperCase(),
            category: 'presets',
            groupKey: vst,
            count: groupItems.length,
            items: groupItems
        });
    });

    // Group liked samples by type
    const likedSamples = (items.samples || []).filter(s => s.liked);
    const samplesByType = {};
    likedSamples.forEach(item => {
        const type = item.type || 'Other';
        if (!samplesByType[type]) samplesByType[type] = [];
        samplesByType[type].push(item);
    });
    Object.entries(samplesByType).forEach(([type, groupItems]) => {
        groups.push({
            id: `likes-samples-${type.toLowerCase().replace(/\s+/g, '-')}`,
            name: type.toUpperCase(),
            category: 'samples',
            groupKey: type,
            count: groupItems.length,
            items: groupItems
        });
    });

    // Group liked MIDI by VST
    const likedMidi = (items.midi || []).filter(m => m.liked);
    const midiByVst = {};
    likedMidi.forEach(item => {
        const vst = item.vst || 'MIDI';
        if (!midiByVst[vst]) midiByVst[vst] = [];
        midiByVst[vst].push(item);
    });
    Object.entries(midiByVst).forEach(([vst, groupItems]) => {
        groups.push({
            id: `likes-midi-${vst.toLowerCase().replace(/\s+/g, '-')}`,
            name: vst.toUpperCase(),
            category: 'midi',
            groupKey: vst,
            count: groupItems.length,
            items: groupItems
        });
    });

    // Group liked projects by DAW
    const likedProjects = (items.projects || []).filter(p => p.liked);
    const projectsByDaw = {};
    likedProjects.forEach(item => {
        const daw = item.daw || 'Other';
        if (!projectsByDaw[daw]) projectsByDaw[daw] = [];
        projectsByDaw[daw].push(item);
    });
    Object.entries(projectsByDaw).forEach(([daw, groupItems]) => {
        const formattedDaw = typeof formatDawLabel === 'function' ? formatDawLabel(daw) : daw;
        groups.push({
            id: `likes-projects-${daw.toLowerCase().replace(/\s+/g, '-')}`,
            name: formattedDaw.toUpperCase(),
            category: 'projects',
            groupKey: daw,
            count: groupItems.length,
            items: groupItems
        });
    });

    return groups;
}

// Render dynamic liked cards (similar to renderSavedCards)
function renderLikedCards(filter = currentLikesFilter) {
    const container = document.querySelector('.profile-likes-cards');
    if (!container) return;

    currentLikesFilter = filter;

    const allGroups = getLikedItemGroups();
    const groups = allGroups.filter(g => g.category === filter);

    if (groups.length === 0) {
        container.innerHTML = `<span style="color: #666; font-size: 14px;">No liked ${filter} yet</span>`;
        // Clear right panel
        const grid = document.getElementById('profile-content-grid');
        const title = document.getElementById('profile-content-title');
        if (title) title.textContent = 'Liked ' + filter.charAt(0).toUpperCase() + filter.slice(1);
        if (grid) grid.innerHTML = `
            <div class="profile-empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span>No liked ${filter} yet</span>
            </div>
        `;
        return;
    }

    // Get VST/type image for the card background
    const getCardImage = (group) => {
        if (group.category === 'presets' || group.category === 'midi') {
            const vstKey = group.groupKey.toLowerCase();
            return vstImages[vstKey] || null;
        }
        if (group.category === 'projects') {
            const dawKey = group.groupKey.toLowerCase();
            return dawImages[dawKey] || null;
        }
        return null;
    };

    container.innerHTML = groups.map(group => {
        const bgImage = getCardImage(group);
        const safeBgImage = bgImage ? sanitizeURL(bgImage) : '';
        const bgStyle = safeBgImage ? `background-image: url('${safeBgImage}'); background-size: cover; background-position: center;` : '';
        const noImageClass = !safeBgImage ? 'no-image' : '';

        return `
            <div class="profile-category-card ${noImageClass}" data-group-id="${escapeAttr(String(group.id))}" data-category="${escapeAttr(group.category)}" data-group-key="${escapeAttr(group.groupKey)}" style="${bgStyle}">
                <div class="category-card-overlay"></div>
                <span class="category-card-name">${escapeHTML(group.name)}</span>
                <span class="category-card-count">${group.count}</span>
            </div>
        `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.profile-category-card').forEach(card => {
        card.addEventListener('click', function() {
            container.querySelectorAll('.profile-category-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');

            const groupId = this.dataset.groupId;
            const group = groups.find(g => g.id === groupId);
            if (group) {
                currentLikesGroup = group;
                renderProfileContentFromGroup(group);
            }
        });
    });

    // Auto-select first card
    const firstCard = container.querySelector('.profile-category-card');
    if (firstCard) {
        firstCard.click();
    }
}

// Render profile content from a group
function renderProfileContentFromGroup(group, page = 1) {
    const grid = document.getElementById('profile-content-grid');
    const title = document.getElementById('profile-content-title');
    if (!grid) return;

    const totalItems = group.items.length;
    const totalPages = Math.ceil(totalItems / profileItemsPerPage) || 1;

    // Bounds checking to prevent invalid page access
    page = Math.max(1, Math.min(page, totalPages));

    profileCurrentPage = page;
    currentProfileGroup = group;

    const startIndex = (page - 1) * profileItemsPerPage;
    const endIndex = startIndex + profileItemsPerPage;
    const pageItems = group.items.slice(startIndex, endIndex);

    // Format title as "Username's [GroupName] [Category] (count)"
    const categoryLabels = {
        presets: 'Presets',
        samples: 'Samples',
        midi: 'MIDI',
        projects: 'Projects'
    };
    const categoryLabel = categoryLabels[group.category] || '';
    const profileName = viewingProfileUsername || localStorage.getItem('profileUsername') || 'User';
    if (title) title.textContent = `${profileName}'s ${group.name} ${categoryLabel} (${group.count})`;

    if (group.items.length === 0) {
        grid.innerHTML = `
            <div class="profile-empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>No items found</span>
            </div>
        `;
        return;
    }

    // Clear grid and render item cards with proper wrappers
    grid.innerHTML = '';

    pageItems.forEach(item => {
        const wrap = document.createElement('div');
        wrap.dataset.itemId = item.id;
        wrap.dataset.category = group.category;
        wrap.className = 'profile-item-card-wrap';
        // Use event delegation instead of inline onclick
        wrap.addEventListener('click', (e) => handleProfileCardClick(e, item.id, group.category));
        wrap.innerHTML = createCardHTML(item, group.category);
        grid.appendChild(wrap);

        // Initialize audio features (waveform, scrubbing, etc.)
        if (typeof setupCardAudio === 'function') {
            setupCardAudio(item, group.category);
        }
    });

    // Add pagination if needed
    renderProfilePagination(grid, page, totalPages);
}

function renderProfilePagination(grid, page, totalPages) {
    const containerId = 'profile-pagination';

    // Always remove old one and create fresh to avoid stale references
    let oldContainer = document.getElementById(containerId);
    if (oldContainer) oldContainer.remove();

    let paginationContainer = document.createElement('div');
    paginationContainer.id = containerId;
    paginationContainer.className = 'pagination-container';

    // Insert directly after grid
    if (grid) {
        grid.insertAdjacentElement('afterend', paginationContainer);
    }

    paginationContainer.style.display = 'flex';

    let paginationHTML = '';

    if (totalPages > 1) {
        paginationHTML += `
        <button class="pagination-btn pagination-prev ${page === 1 ? 'disabled' : ''}"
                data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 18l-6-6 6-6"/>
            </svg>
            Prev
        </button>
        <div class="pagination-pages">
        `;

        const maxVisiblePages = 5;
        let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            paginationHTML += `<button class="pagination-page" data-page="1">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-page ${i === page ? 'active' : ''}"
                        data-page="${i}">${i}</button>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
            paginationHTML += `<button class="pagination-page" data-page="${totalPages}">${totalPages}</button>`;
        }

        paginationHTML += `
            </div>
            <button class="pagination-btn pagination-next ${page === totalPages ? 'disabled' : ''}"
                    data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                </svg>
            </button>
        `;
    }

    paginationHTML += `
        <div class="pagination-per-page">
            <select class="per-page-select" id="profile-per-page-select">
                ${PROFILE_ITEMS_PER_PAGE_OPTIONS.map(opt => `<option value="${opt}" ${opt === profileItemsPerPage ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
            <span class="per-page-label">per page</span>
        </div>
    `;

    paginationContainer.innerHTML = paginationHTML;

    // Initialize pagination buttons
    paginationContainer.querySelectorAll('button:not(.disabled)').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetPage = parseInt(this.dataset.page);
            if (targetPage >= 1 && targetPage <= totalPages) {
                renderProfileContentFromGroup(currentProfileGroup, targetPage);
                const panel = document.querySelector('.profile-content-panel');
                if (panel) panel.scrollTop = 0;
            }
        });
    });

    // Initialize per-page select
    const perPageSelect = document.getElementById('profile-per-page-select');
    if (perPageSelect) {
        perPageSelect.addEventListener('change', function() {
            profileItemsPerPage = parseInt(this.value);
            renderProfileContentFromGroup(currentProfileGroup, 1);
        });
    }
}

// Render profile content grid (right panel) - for likes/comments
function renderProfileContent(category) {
    const grid = document.getElementById('profile-content-grid');
    const title = document.getElementById('profile-content-title');
    if (!grid) return;

    const items = getUserUploads(category);
    const categoryLabels = {
        presets: 'Presets',
        samples: 'Samples',
        midi: 'MIDI',
        projects: 'Projects',
        likes: 'Liked Items'
    };

    if (title) title.textContent = `${categoryLabels[category]} (${items.length})`;

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="profile-empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>No ${categoryLabels[category].toLowerCase()} yet</span>
            </div>
        `;
        return;
    }

    // Render item cards
    grid.innerHTML = items.map(item => createCardHTML(item, category === 'likes' ? getItemCategory(item) : category)).join('');

    // Initialize card interactions
    initProfileCardInteractions(grid, category);
}

// Initialize card interactions in profile
function initProfileCardInteractions(container, category) {
    container.querySelectorAll('.item-card-wrapper').forEach(wrapper => {
        const itemId = wrapper.dataset.id;
        const itemCat = category === 'likes' ? (wrapper.dataset.category || 'presets') : category;

        let item;
        if (itemCat === 'presets') item = (items.presets || []).find(p => p.id == itemId);
        else if (itemCat === 'samples') item = (items.samples || []).find(s => s.id == itemId);
        else if (itemCat === 'midi') item = (items.midi || []).find(m => m.id == itemId);
        else if (itemCat === 'projects') item = (items.projects || []).find(p => p.id == itemId);

        if (!item) return;

        const playBtn = wrapper.querySelector('.card-play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof playItem === 'function') playItem(item, itemCat);
            });
        }

        const likeBtn = wrapper.querySelector('[data-action="like"]');
        if (likeBtn) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof toggleLike === 'function') toggleLike(item, itemCat);
            });
        }
    });
}

// Profile tabs handling (Uploads, Saved, Likes, Comments)
function initProfileTabs() {
    // Tab switching
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.dataset.tab;

            document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`profile-${targetTab}-panel`)?.classList.add('active');

            // Update right panel based on tab
            if (targetTab === 'uploads') {
                // Re-render upload cards and select first one
                renderUploadCards();
            } else if (targetTab === 'saved') {
                // Re-render saved cards and select first one
                renderSavedCards();
            } else if (targetTab === 'likes') {
                // Re-render liked cards and select first one
                renderLikedCards();
            } else if (targetTab === 'comments') {
                // Re-render comments for the selected item
                renderProfileComments();
            } else if (targetTab === 'followers') {
                // Render followers list
                renderFollowersList();
            } else if (targetTab === 'following') {
                // Render following list
                renderFollowingList();
            }
        });
    });

    // Upload filter buttons (Presets, Samples, MIDI, Projects)
    document.querySelectorAll('.profile-upload-filter').forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.dataset.filter;

            document.querySelectorAll('.profile-upload-filter').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            renderUploadCards(filter);
        });
    });

    // Saved filter buttons (Presets, Samples, MIDI, Projects)
    document.querySelectorAll('.profile-saved-filter').forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.dataset.filter;

            document.querySelectorAll('.profile-saved-filter').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            renderSavedCards(filter);
        });
    });

    // Likes filter buttons (Presets, Samples, MIDI, Projects)
    document.querySelectorAll('.profile-likes-filter').forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.dataset.filter;

            document.querySelectorAll('.profile-likes-filter').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            renderLikedCards(filter);
        });
    });

    // Initial render - show dynamic upload cards (default to 'all')
    renderUploadCards('all');
}

// Initialize profile on DOM ready
document.addEventListener('DOMContentLoaded', initProfileTabs);

// ===== PROFILE COMMENTS =====
let profileCommentsItem = null;
let profileCommentsCategory = null;

// Add listener for play button clicks in profile grid (uses capture phase to run first)
document.addEventListener('DOMContentLoaded', () => {
    const profileGrid = document.getElementById('profile-content-grid');
    if (profileGrid) {
        // Use capture phase to ensure this runs before the play button's onclick
        profileGrid.addEventListener('click', (e) => {
            const playBtn = e.target.closest('.card-play-btn');
            if (!playBtn) return;

            // Find the parent wrapper with item data
            const wrapper = playBtn.closest('[data-item-id]');
            if (!wrapper) return;

            const itemId = parseInt(wrapper.dataset.itemId);
            const category = wrapper.dataset.category;
            if (!category || !items[category]) return;

            const item = items[category].find(i => i.id === itemId);
            if (item) {
                // Select the item for comments and switch to comments tab
                // Use setTimeout to allow the play action to complete first
                setTimeout(() => {
                    if (typeof selectItemAndShowComments === 'function') {
                        selectItemAndShowComments(item, category);
                    }
                }, 50);
            }
        }, true); // true = capture phase
    }
});

// Handle card click in profile - called via onclick attribute
window.handleProfileCardClick = function(e, itemId, category) {
    // Don't handle if clicking on action buttons (play is handled by capture listener)
    if (e.target.closest('.card-action-btn') || e.target.closest('.card-play-btn')) {
        return;
    }

    const item = items[category]?.find(i => i.id === itemId);
    if (item) {
        selectItemAndShowComments(item, category);
    }
};

// Select an item and switch to Comments tab
window.selectItemAndShowComments = function(item, category) {
    if (!item) return;

    profileCommentsItem = item;
    profileCommentsCategory = category;

    // Show and switch to Comments tab
    const commentsTab = document.getElementById('profile-comments-tab');
    if (commentsTab) {
        commentsTab.classList.remove('hidden');
    }

    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    if (commentsTab) commentsTab.classList.add('active');

    document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('profile-comments-panel')?.classList.add('active');

    // Render comments
    renderProfileComments();
}

// Render comments in the Comments panel
function renderProfileComments() {
    if (!profileCommentsItem) return;

    const countEl = document.getElementById('profile-comments-count');
    const listEl = document.getElementById('profile-comments-list');

    // Update Now Playing container background with uploader's banner
    const nowPlayingContainer = document.getElementById('profile-now-playing-container');
    if (nowPlayingContainer) {
        const uploader = profileCommentsItem.uploader;
        const currentUser = localStorage.getItem('profileUsername');
        const isOwnItem = uploader && currentUser && uploader.toLowerCase() === currentUser.toLowerCase();
        let bannerUrl = null;

        // Check if uploader is current user - use fresh localStorage
        if (isOwnItem) {
            bannerUrl = localStorage.getItem('profileBanner');
        }

        // If no banner yet, try allUserProfiles
        if (!bannerUrl && uploader) {
            const allUserProfiles = safeJSONParse(localStorage.getItem('allUserProfiles'), {});
            bannerUrl = allUserProfiles[uploader]?.banner;
        }

        // Final fallback to item's stored value
        if (!bannerUrl) {
            bannerUrl = profileCommentsItem.uploaderBanner;
        }

        const safeBannerUrl = sanitizeCSSUrl(bannerUrl);
        if (safeBannerUrl) {
            nowPlayingContainer.style.backgroundImage = `linear-gradient(135deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.5) 100%), url('${safeBannerUrl}')`;
            nowPlayingContainer.style.backgroundSize = 'cover';
            nowPlayingContainer.style.backgroundPosition = 'center';
        } else {
            // Use default banner
            nowPlayingContainer.style.backgroundImage = `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)`;
            nowPlayingContainer.style.backgroundSize = 'cover';
            nowPlayingContainer.style.backgroundPosition = 'center';
        }
    }

    // Update Now Playing container
    const coverEl = document.getElementById('profile-now-playing-cover');
    const titleEl = document.getElementById('profile-now-playing-title');
    const usernameEl = document.getElementById('profile-now-playing-username');

    if (coverEl) {
        const safeImg = typeof createSafeImage === 'function' ? createSafeImage(profileCommentsItem.coverArt, 'Cover') : '';
        if (safeImg) {
            coverEl.innerHTML = safeImg;
        } else {
            // No cover art - show user's profile image instead
            const safeAvatarImg = typeof createSafeImage === 'function' ? createSafeImage(profileCommentsItem.uploaderAvatar, 'Avatar') : '';
            if (safeAvatarImg) {
                coverEl.innerHTML = safeAvatarImg;
            } else {
                coverEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            }
        }
        // Make cover clickable to navigate to user profile
        coverEl.style.cursor = 'pointer';
        coverEl.onclick = () => {
            const username = profileCommentsItem.uploader;
            if (username && typeof viewUserProfile === 'function') {
                viewUserProfile(username, false, true);
            }
        };
    }

    if (titleEl) {
        titleEl.textContent = profileCommentsItem.title || 'Untitled';
    }

    if (usernameEl) {
        usernameEl.textContent = profileCommentsItem.uploader || 'Unknown User';
        // Make username clickable to navigate to user profile
        usernameEl.style.cursor = 'pointer';
        usernameEl.onclick = () => {
            const username = profileCommentsItem.uploader;
            if (username && typeof viewUserProfile === 'function') {
                viewUserProfile(username, false, true);
            }
        };
    }

    const descriptionEl = document.getElementById('profile-now-playing-description');
    if (descriptionEl) {
        descriptionEl.textContent = profileCommentsItem.description || '';
    }

    const comments = profileCommentsItem.comments || [];
    if (countEl) countEl.textContent = comments.length;
    if (!listEl) return;

    if (comments.length === 0) {
        listEl.innerHTML = `
            <div class="profile-comments-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                    <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                </svg>
                <div class="profile-comments-empty-text">No comments yet</div>
                <div class="profile-comments-empty-subtext">Be the first to share your thoughts</div>
            </div>
        `;
    } else {
        listEl.innerHTML = comments.map((c, idx) => createProfileCommentHTML(c, idx)).join('');
        // Attach event listeners
        listEl.querySelectorAll('.profile-comment-item').forEach(el => {
            attachProfileCommentListeners(el);
        });
    }

    // Add event delegation for clicking usernames/avatars to navigate to profiles
    if (listEl) {
        listEl.addEventListener('click', (e) => {
            const userEl = e.target.closest('[data-action="view-profile"]');
            if (userEl) {
                e.stopPropagation();
                const username = userEl.dataset.username;
                if (username && typeof viewUserProfile === 'function') {
                    viewUserProfile(username, false, true);
                }
            }
        });
    }
}

// Create profile comment HTML
function createProfileCommentHTML(comment, index) {
    const replies = comment.replies || [];
    const hasReplies = replies.length > 0;
    const timeDisplay = comment.time || 'Just now';

    const repliesHTML = hasReplies ? replies.map((r, rIdx) => `
        <div class="profile-reply-item" data-reply-index="${rIdx}">
            <div class="profile-reply-avatar" data-action="view-profile" data-username="${escapeAttr(r.user || '')}" style="cursor:pointer;${r.avatar && sanitizeCSSUrl(r.avatar) ? `background-image: url('${sanitizeCSSUrl(r.avatar)}')` : ''}"></div>
            <div class="profile-reply-content">
                <div class="profile-reply-header">
                    <span class="profile-reply-user" data-action="view-profile" data-username="${escapeAttr(r.user || '')}" style="cursor:pointer">${escapeHTML(r.user || 'Anonymous')}</span>
                    <span class="profile-reply-time">${escapeHTML(r.time || 'Just now')}</span>
                </div>
                <div class="profile-reply-text">${typeof window.safeParseEmojis === 'function' ? window.safeParseEmojis(escapeHTML(r.text || '')) : escapeHTML(r.text || '')}</div>
            </div>
        </div>
    `).join('') : '';

    return `
        <div class="profile-comment-item" data-index="${index}">
            <div class="profile-comment-avatar" data-action="view-profile" data-username="${escapeAttr(comment.user || '')}" style="cursor:pointer;${comment.avatar && sanitizeCSSUrl(comment.avatar) ? `background-image: url('${sanitizeCSSUrl(comment.avatar)}')` : ''}"></div>
            <div class="profile-comment-content">
                <div class="profile-comment-header">
                    <span class="profile-comment-user" data-action="view-profile" data-username="${escapeAttr(comment.user || '')}" style="cursor:pointer">${escapeHTML(comment.user || 'Anonymous')}</span>
                    <span class="profile-comment-time">${escapeHTML(timeDisplay)}</span>
                </div>
                <div class="profile-comment-text">${typeof window.safeParseEmojis === 'function' ? window.safeParseEmojis(escapeHTML(comment.text || '')) : escapeHTML(comment.text || '')}</div>
                <div class="profile-comment-actions">
                    <button class="profile-react-btn" title="React">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                            <line x1="9" y1="9" x2="9.01" y2="9"/>
                            <line x1="15" y1="9" x2="15.01" y2="9"/>
                        </svg>
                    </button>
                    <button class="profile-reply-btn">Reply</button>
                </div>
                ${hasReplies ? `
                    <button class="profile-replies-toggle">
                        <span>${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}</span>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                    <div class="profile-replies-container" style="display: none;">
                        ${repliesHTML}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Attach event listeners to profile comment
function attachProfileCommentListeners(commentEl) {
    const index = parseInt(commentEl.dataset.index);
    const replyBtn = commentEl.querySelector('.profile-reply-btn');
    const reactBtn = commentEl.querySelector('.profile-react-btn');
    const repliesToggle = commentEl.querySelector('.profile-replies-toggle');
    const repliesContainer = commentEl.querySelector('.profile-replies-container');

    // Reply button
    replyBtn?.addEventListener('click', () => {
        // Remove any existing reply input
        const existingInput = commentEl.querySelector('.profile-reply-input-wrapper');
        if (existingInput) {
            existingInput.remove();
            return;
        }

        // Create reply input using DOM methods instead of insertAdjacentHTML
        const wrapper = document.createElement('div');
        wrapper.className = 'profile-reply-input-wrapper';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'profile-reply-input';
        input.placeholder = 'Write a reply...';
        input.autocomplete = 'off';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'profile-reply-cancel';
        cancelBtn.textContent = 'Cancel';

        const submitBtn = document.createElement('button');
        submitBtn.className = 'profile-reply-submit';
        submitBtn.textContent = 'Reply';

        wrapper.appendChild(input);
        wrapper.appendChild(cancelBtn);
        wrapper.appendChild(submitBtn);

        const actionsEl = commentEl.querySelector('.profile-comment-actions');
        actionsEl.insertAdjacentElement('afterend', wrapper);

        input.focus();

        cancelBtn.addEventListener('click', () => {
            wrapper.remove();
        });

        submitBtn.addEventListener('click', () => {
            const text = input.value.trim();
            if (text) {
                submitProfileReply(index, text);
            }
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = input.value.trim();
                if (text) {
                    submitProfileReply(index, text);
                }
            }
        });
    });

    // React button - show emoji picker
    reactBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        showProfileReactionPicker(commentEl, index);
    });

    // Replies toggle
    repliesToggle?.addEventListener('click', () => {
        repliesToggle.classList.toggle('expanded');
        if (repliesContainer) {
            repliesContainer.style.display = repliesToggle.classList.contains('expanded') ? 'block' : 'none';
        }
    });
}

// Submit a reply to a profile comment
function submitProfileReply(commentIndex, text) {
    if (!profileCommentsItem || !profileCommentsItem.comments) return;

    // Block links in replies
    if (typeof containsLink === 'function' && containsLink(text)) {
        alert('Links are not allowed in comments.');
        return;
    }

    const comment = profileCommentsItem.comments[commentIndex];
    if (!comment) return;

    if (!comment.replies) comment.replies = [];
    comment.replies.push({
        user: 'You',
        text: text,
        time: 'Just now'
    });

    renderProfileComments();
}

// Show reaction picker for profile comments
function showProfileReactionPicker(commentEl, commentIndex) {
    // Remove any existing picker
    document.querySelectorAll('.profile-reaction-picker').forEach(p => p.remove());

    const picker = document.createElement('div');
    picker.className = 'profile-reaction-picker';

    // Use emojis from emojiList if available
    const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

    picker.innerHTML = quickReactions.map(emoji => `
        <button class="profile-reaction-item" data-emoji="${emoji}">${emoji}</button>
    `).join('');

    const reactBtn = commentEl.querySelector('.profile-react-btn');
    reactBtn.parentElement.appendChild(picker);

    // Handle reaction clicks
    picker.querySelectorAll('.profile-reaction-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.dataset.emoji;
            addProfileReaction(commentIndex, emoji);
            picker.remove();
        });
    });

    // Close picker when clicking outside
    const closeHandler = (e) => {
        if (!picker.contains(e.target) && !reactBtn.contains(e.target)) {
            picker.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

// Add reaction to a profile comment
function addProfileReaction(commentIndex, emoji) {
    if (!profileCommentsItem || !profileCommentsItem.comments) return;

    const comment = profileCommentsItem.comments[commentIndex];
    if (!comment) return;

    if (!comment.reactions) comment.reactions = {};
    if (!comment.reactions[emoji]) comment.reactions[emoji] = [];

    // Toggle reaction
    const userIndex = comment.reactions[emoji].indexOf('You');
    if (userIndex > -1) {
        comment.reactions[emoji].splice(userIndex, 1);
        if (comment.reactions[emoji].length === 0) {
            delete comment.reactions[emoji];
        }
    } else {
        comment.reactions[emoji].push('You');
    }

    renderProfileComments();
}

window.submitProfileComment = () => {
    // Auth gate - must be logged in to comment
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    // Rate limiting - prevent double submissions
    if (typeof rateLimit === 'function' && !rateLimit('profileComment', 500)) {
        return;
    }

    const input = document.getElementById('profile-comments-input');
    const text = input.value.trim();
    if (!text || !profileCommentsItem) return;

    // Block links in profile comments
    if (typeof containsLink === 'function' && containsLink(text)) {
        alert('Links are not allowed in comments.');
        return;
    }

    if (!profileCommentsItem.comments) profileCommentsItem.comments = [];

    profileCommentsItem.comments.unshift({
        user: 'You',
        text: text,
        time: 'Just now'
    });

    input.value = '';
    input.style.height = 'auto';

    // Re-render comments to show the new one
    renderProfileComments();
};

// Allow Enter key to submit comment (Shift+Enter for new line)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement.id === 'profile-comments-input') {
        if (!e.shiftKey) {
            e.preventDefault();
            submitProfileComment();
        }
    }
});

// Auto-resize profile comment textarea
document.addEventListener('input', (e) => {
    if (e.target.id === 'profile-comments-input') {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 90) + 'px';
    }
});

// Auth check on focus for profile comment input
document.addEventListener('focus', (e) => {
    if (e.target.id === 'profile-comments-input') {
        if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
            e.target.blur();
            if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        }
    }
}, true);

// ===== FOLLOW & MESSAGE FUNCTIONALITY =====

// Get followed users from localStorage
let followedUsers = [];
try {
    followedUsers = safeJSONParse(localStorage.getItem('followedUsers'), []);
} catch (e) {
    // Silent fail - use empty array
}

// Current profile being viewed (set when viewing another user's profile)
let viewingProfileUsername = null;

// Update profile action buttons visibility and state
function updateProfileActionButtons() {
    const followBtn = document.getElementById('profile-follow-btn');
    const messageBtn = document.getElementById('profile-message-btn');
    const actionsContainer = document.getElementById('profile-actions');

    if (!actionsContainer) return;

    // Show buttons when viewing other profiles
    if (!isViewingOwnProfile) {
        actionsContainer.classList.remove('hidden-own-profile');
        updateFollowButtonState();

        // Check if message button should be visible based on DM privacy
        if (messageBtn && viewingProfileUsername) {
            const canMessage = canSendDmToUser(viewingProfileUsername);
            messageBtn.style.display = canMessage ? '' : 'none';
        }
    } else {
        // Hide on own profile - you can't follow/message yourself
        actionsContainer.classList.add('hidden-own-profile');
    }
}

// Check if current user can send DM to target user based on their privacy settings
function canSendDmToUser(targetUsername) {
    // Get target user's DM privacy setting
    const userPrivacySettings = safeJSONParse(localStorage.getItem('userPrivacySettings'), {});
    const targetPrivacy = userPrivacySettings[targetUsername] || 'everyone';

    if (targetPrivacy === 'everyone') return true;
    if (targetPrivacy === 'nobody') return false;

    // 'followers' - check if current user follows the target (is a follower of target)
    if (targetPrivacy === 'followers') {
        // Check if the current user has the target in their followed list
        const currentUserFollowing = safeJSONParse(localStorage.getItem('followedUsers'), []);
        return currentUserFollowing.includes(targetUsername);
    }

    return true;
}

// Update follow button text and style based on follow state
function updateFollowButtonState() {
    const followBtn = document.getElementById('profile-follow-btn');
    if (!followBtn || !viewingProfileUsername) return;

    const isFollowing = followedUsers.includes(viewingProfileUsername);

    if (isFollowing) {
        followBtn.textContent = 'Following';
        followBtn.classList.add('following');
    } else {
        followBtn.textContent = 'Follow';
        followBtn.classList.remove('following');
    }
}

// Toggle follow state
async function toggleFollow() {
    // Auth gate - must be logged in to follow
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    // Rate limiting
    if (typeof rateLimit === 'function' && !rateLimit('followAction', 1000)) {
        return; // Too fast
    }

    if (!viewingProfileUsername || isViewingOwnProfile) return;

    const index = followedUsers.indexOf(viewingProfileUsername);
    const isFollowing = index > -1;

    if (isFollowing) {
        // Unfollow
        followedUsers.splice(index, 1);
    } else {
        // Follow
        followedUsers.push(viewingProfileUsername);
    }

    // Save to localStorage
    localStorage.setItem('followedUsers', JSON.stringify(followedUsers));

    // Update global follower counts for Junkies page
    updateUserFollowerCount(viewingProfileUsername, isFollowing ? -1 : 1);

    // Update button state
    updateFollowButtonState();

    // Update follower count display
    const followersEl = document.getElementById('profile-followers');
    if (followersEl) {
        let count = parseInt(followersEl.textContent) || 0;
        count = isFollowing ? count - 1 : count + 1;
        followersEl.textContent = count;
    }

    // Sync with Supabase if available
    if (typeof supabaseGetUser === 'function' && typeof supabaseGetProfileByUsername === 'function') {
        try {
            const { user } = await supabaseGetUser();
            if (user) {
                // Get the target user's ID by username
                const { data: targetProfile } = await supabaseGetProfileByUsername(viewingProfileUsername);
                if (targetProfile && targetProfile.id) {
                    if (isFollowing) {
                        // Was following, now unfollow
                        await supabaseUnfollow(user.id, targetProfile.id);
                    } else {
                        // Was not following, now follow
                        await supabaseFollow(user.id, targetProfile.id);
                    }
                }
            }
        } catch (err) {
            console.error('Error syncing follow to Supabase:', err);
        }
    }
}

// Update follower count in global storage (for Junkies page)
function updateUserFollowerCount(username, delta) {
    let allUserFollowers = {};
    try {
        allUserFollowers = safeJSONParse(localStorage.getItem('allUserFollowers'), {});
    } catch (e) {
        // Silent fail - use empty object
    }

    const currentCount = allUserFollowers[username] || 0;
    allUserFollowers[username] = Math.max(0, currentCount + delta);

    localStorage.setItem('allUserFollowers', JSON.stringify(allUserFollowers));
}

// Store the last messaged user for navigation
let lastMessagedUser = null;
let lastMessagedConversationId = null;

// Open message/DM with the profile user
function openProfileMessage() {
    // Auth gate - must be logged in to message
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    if (!viewingProfileUsername || isViewingOwnProfile) return;

    // Show the message modal
    const modal = document.getElementById('profile-message-modal');
    const title = document.getElementById('profile-message-title');
    const input = document.getElementById('profile-message-input');

    if (modal) {
        if (title) title.textContent = `Message ${viewingProfileUsername}`;
        if (input) input.value = '';
        modal.style.display = 'flex';
        if (input) input.focus();
    }
}

function closeProfileMessageModal() {
    const modal = document.getElementById('profile-message-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function sendProfileMessage() {
    const input = document.getElementById('profile-message-input');
    const message = input ? input.value.trim() : '';

    if (!message) {
        return;
    }

    if (!viewingProfileUsername) {
        closeProfileMessageModal();
        return;
    }

    // Get existing DM conversations (same format as notifications.js)
    let dmConversations = safeJSONParse(localStorage.getItem('dmConversations'), []);

    // Find existing conversation with this user
    let conversation = dmConversations.find(c =>
        c.username && c.username.toLowerCase() === viewingProfileUsername.toLowerCase()
    );

    // Create new conversation if it doesn't exist
    if (!conversation) {
        conversation = {
            id: `dm_${viewingProfileUsername}_${Date.now()}`,
            oderId: dmConversations.length + 1,
            username: viewingProfileUsername,
            messages: []
        };
        dmConversations.push(conversation);
    }

    // Add the message
    conversation.messages.push({
        sender: 'You',
        text: message,
        time: Date.now(),
        status: 'delivered'
    });

    // Save to localStorage
    localStorage.setItem('dmConversations', JSON.stringify(dmConversations));

    // Store the messaged user for "Go to messages" navigation
    lastMessagedUser = viewingProfileUsername;
    lastMessagedConversationId = conversation.id;

    // Close the message modal
    closeProfileMessageModal();

    // Show the confirmation modal
    const sentModal = document.getElementById('message-sent-modal');
    if (sentModal) {
        sentModal.style.display = 'flex';
    }
}

function closeMessageSentModal() {
    const modal = document.getElementById('message-sent-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function goToMessages() {
    // Close the confirmation modal
    closeMessageSentModal();

    // Close profile overlay if active
    if (previousState.wasProfileOverlay) {
        closeProfileOverlay();
    }

    // Navigate to notifications
    document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
    document.getElementById('notifications-content')?.classList.add('active');

    document.querySelectorAll('.side-nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('.side-nav-item[data-view="notifications"]')?.classList.add('active');

    document.body.classList.remove('profile-active');
    document.body.classList.remove('profile-overlay-active');

    // Refresh the DM conversations list and select the conversation
    if (typeof renderDmConversations === 'function') {
        renderDmConversations();
    }

    // Select the conversation we just messaged
    if (lastMessagedConversationId && typeof selectDmConversation === 'function') {
        setTimeout(() => {
            selectDmConversation(lastMessagedConversationId);
        }, 100);
    }
}

// Make modal functions globally available
window.closeProfileMessageModal = closeProfileMessageModal;
window.sendProfileMessage = sendProfileMessage;
window.closeMessageSentModal = closeMessageSentModal;
window.goToMessages = goToMessages;

// Set the profile being viewed (call this when viewing another user's profile)
function setViewingProfile(username) {
    viewingProfileUsername = username;
    updateProfileActionButtons();
}

// Initialize profile action button event listeners
document.addEventListener('DOMContentLoaded', () => {
    const followBtn = document.getElementById('profile-follow-btn');
    const messageBtn = document.getElementById('profile-message-btn');

    if (followBtn) {
        followBtn.addEventListener('click', toggleFollow);
    }

    if (messageBtn) {
        messageBtn.addEventListener('click', openProfileMessage);
    }

    // Initialize the user dropdown menu in header
    initUserDropdown();
});

// Make functions globally available
window.setViewingProfile = setViewingProfile;
window.updateProfileActionButtons = updateProfileActionButtons;
window.toggleFollow = toggleFollow;
window.updateFollowButtonState = updateFollowButtonState;

// ===== FOLLOWERS / FOLLOWING =====

// Followers/following data (populated from real user interactions)
let userFollowers = [];
let userFollowing = [];

function showProfileFollowers() {
    // Switch to followers tab
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    const followersTab = document.getElementById('profile-followers-tab');
    if (followersTab) followersTab.classList.add('active');

    document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('active'));
    const followersPanel = document.getElementById('profile-followers-panel');
    if (followersPanel) followersPanel.classList.add('active');

    renderFollowersList();
}

function showProfileFollowing() {
    // Switch to following tab
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    const followingTab = document.getElementById('profile-following-tab');
    if (followingTab) followingTab.classList.add('active');

    document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('active'));
    const followingPanel = document.getElementById('profile-following-panel');
    if (followingPanel) followingPanel.classList.add('active');

    renderFollowingList();
}

// Get the first letter of a username, skipping leading numbers
function getUsernameLetter(username) {
    // Find the first letter (skip leading numbers)
    for (let i = 0; i < username.length; i++) {
        const char = username[i].toUpperCase();
        if (char >= 'A' && char <= 'Z') {
            return char;
        }
    }
    // If no letter found, return '#' for numeric-only usernames
    return '#';
}

// Current filter state
let currentFollowersFilter = 'all';
let currentFollowingFilter = 'all';

function renderFollowersList(filter = currentFollowersFilter) {
    currentFollowersFilter = filter;
    const grid = document.getElementById('profile-followers-grid');
    const countEl = document.getElementById('profile-followers-count');
    if (!grid) return;

    // Filter users based on selected letter
    let filteredUsers = userFollowers;
    if (filter !== 'all') {
        filteredUsers = userFollowers.filter(user => getUsernameLetter(user.username) === filter);
    }

    if (countEl) countEl.textContent = filteredUsers.length;

    if (filteredUsers.length === 0) {
        grid.innerHTML = `
            <div class="profile-users-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
                <div class="profile-users-empty-text">${filter === 'all' ? 'No followers yet' : 'No followers starting with ' + filter}</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredUsers.map(user => createUserCard(user)).join('');
}

function renderFollowingList(filter = currentFollowingFilter) {
    currentFollowingFilter = filter;
    const grid = document.getElementById('profile-following-grid');
    const countEl = document.getElementById('profile-following-count');
    if (!grid) return;

    // Filter users based on selected letter
    let filteredUsers = userFollowing;
    if (filter !== 'all') {
        filteredUsers = userFollowing.filter(user => getUsernameLetter(user.username) === filter);
    }

    if (countEl) countEl.textContent = filteredUsers.length;

    if (filteredUsers.length === 0) {
        grid.innerHTML = `
            <div class="profile-users-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
                <div class="profile-users-empty-text">${filter === 'all' ? 'Not following anyone yet' : 'No following starting with ' + filter}</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredUsers.map(user => createUserCard(user)).join('');
}

// Initialize A-Z filter event listeners
function initAZFilters() {
    // Followers A-Z filter
    const followersFilter = document.getElementById('followers-az-filter');
    if (followersFilter) {
        followersFilter.addEventListener('click', (e) => {
            if (e.target.classList.contains('az-filter-btn')) {
                const letter = e.target.dataset.letter;
                followersFilter.querySelectorAll('.az-filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                renderFollowersList(letter);
            }
        });
    }

    // Following A-Z filter
    const followingFilter = document.getElementById('following-az-filter');
    if (followingFilter) {
        followingFilter.addEventListener('click', (e) => {
            if (e.target.classList.contains('az-filter-btn')) {
                const letter = e.target.dataset.letter;
                followingFilter.querySelectorAll('.az-filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                renderFollowingList(letter);
            }
        });
    }

    // Event delegation for user cards (followers and following)
    const followersGrid = document.getElementById('profile-followers-grid');
    if (followersGrid) {
        followersGrid.addEventListener('click', (e) => {
            const card = e.target.closest('[data-action="view-profile"]');
            if (card) {
                const username = card.dataset.username;
                if (username) {
                    viewUserProfile(username, false, true);
                }
            }
        });
    }

    const followingGrid = document.getElementById('profile-following-grid');
    if (followingGrid) {
        followingGrid.addEventListener('click', (e) => {
            const card = e.target.closest('[data-action="view-profile"]');
            if (card) {
                const username = card.dataset.username;
                if (username) {
                    viewUserProfile(username, false, true);
                }
            }
        });
    }
}

// Call initAZFilters on DOM ready
document.addEventListener('DOMContentLoaded', initAZFilters);

function createUserCard(user) {
    return `
        <div class="profile-user-card" data-action="view-profile" data-username="${escapeAttr(user.username)}">
            <div class="profile-user-avatar">
                ${user.avatar && sanitizeURL(user.avatar)
                    ? `<img src="${escapeAttr(sanitizeURL(user.avatar))}" alt="${escapeAttr(user.username)}">`
                    : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
                }
            </div>
            <div class="profile-user-username">${escapeHTML(user.username)}</div>
            <div class="profile-user-stats">
                <span class="profile-user-stat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span class="profile-user-stat-value">${formatCount(user.uploads)}</span>
                </span>
                <span class="profile-user-stat">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14" stroke="currentColor" stroke-width="2"/><line x1="23" y1="11" x2="17" y2="11" stroke="currentColor" stroke-width="2"/></svg>
                    <span class="profile-user-stat-value">${formatCount(user.followers)}</span>
                </span>
            </div>
        </div>
    `;
}

// Make followers/following functions globally available
window.showProfileFollowers = showProfileFollowers;
window.showProfileFollowing = showProfileFollowing;
window.canSendDmToUser = canSendDmToUser;
