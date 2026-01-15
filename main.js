// ===== MAIN - Initialization & Navigation =====

// Save current view to localStorage
function saveCurrentView(viewOrCategory, type = 'view') {
    localStorage.setItem('lastViewedSection', JSON.stringify({ value: viewOrCategory, type }));
}

// Get saved view from localStorage
function getSavedView() {
    try {
        const saved = localStorage.getItem('lastViewedSection');
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
}

// Mobile sidebar toggle
document.getElementById('side-nav-toggle')?.addEventListener('click', () => {
    const sideNav = document.getElementById('side-nav');
    if (sideNav) sideNav.classList.toggle('active');
});

// Helper for safe element class/style updates
const safeEl = (id) => document.getElementById(id);
const safeSetDisplay = (id, value) => { const el = safeEl(id); if (el) el.style.display = value; };
const safeAddClass = (id, cls) => { const el = safeEl(id); if (el) el.classList.add(cls); };

// Global navigation function - can be called from anywhere
function navigateToView(view) {
    // Stop any playing audio
    if (typeof currentlyPlaying !== 'undefined' && currentlyPlaying && typeof globalAudio !== 'undefined' && globalAudio) {
        globalAudio.pause();
        globalAudio.currentTime = 0;
    }

    // Update active state on sidebar
    document.querySelectorAll('.side-nav-item').forEach(x => x.classList.remove('active'));
    const activeItem = document.querySelector(`.side-nav-item[data-view="${view}"]`);
    if (activeItem) activeItem.classList.add('active');

    const downloadBtn = document.getElementById('sidebar-download-btn');
    const uploadBtn = document.getElementById('sidebar-upload-btn');
    const presetsBgBtn = document.getElementById('presets-bg-btn');
    const presetsBgOverlay = document.getElementById('presets-bg-overlay');

    // Hide common elements
    if (downloadBtn) downloadBtn.classList.add('hidden');
    if (uploadBtn) uploadBtn.classList.remove('active');
    if (presetsBgBtn) presetsBgBtn.style.display = 'none';
    if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';

    // Hide all tab panels first
    document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));

    // Reset body classes
    document.body.classList.remove('profile-active', 'lounge-active', 'browse-active', 'upload-active');

    if (view === 'profile') {
        if (typeof isViewingOwnProfile !== 'undefined') isViewingOwnProfile = true;

        // Reset overlay state
        if (typeof previousState !== 'undefined') {
            previousState.wasProfileOverlay = false;
        }
        document.body.classList.remove('profile-overlay-active');
        const profileContent = safeEl('profile-content');
        if (profileContent) profileContent.classList.remove('overlay-active');

        // Hide the close button for own profile
        const closeBtn = document.getElementById('profile-close-btn');
        if (closeBtn) closeBtn.classList.add('hidden');

        // Load own profile data
        const currentUsername = localStorage.getItem('profileUsername');
        if (currentUsername) {
            if (typeof setViewingProfile === 'function') {
                setViewingProfile(currentUsername);
            }
            if (typeof loadUserProfileData === 'function') {
                loadUserProfileData(currentUsername);
            }
        }

        safeAddClass('profile-content', 'active');
        document.body.classList.add('profile-active');
        safeSetDisplay('center-panel', 'none');
        if (typeof updateProfileEditVisibility === 'function') updateProfileEditVisibility();
        if (typeof updateProfileActionButtons === 'function') updateProfileActionButtons();
        if (typeof renderUploadCards === 'function') renderUploadCards();
    } else if (view === 'notifications') {
        safeAddClass('notifications-content', 'active');
        document.body.classList.add('lounge-active');
        safeSetDisplay('center-panel', 'none');
    } else if (view === 'manage-sounds') {
        safeAddClass('manage-sounds-content', 'active');
        safeSetDisplay('center-panel', 'none');
        if (typeof loadManageSoundsPage === 'function') loadManageSoundsPage();
    } else if (view === 'settings') {
        safeAddClass('settings-content', 'active');
        safeSetDisplay('center-panel', 'none');
        if (typeof loadSettingsValues === 'function') loadSettingsValues();
    } else if (view === 'junkies') {
        safeAddClass('junkies-content', 'active');
        document.body.classList.add('lounge-active');
        safeSetDisplay('center-panel', 'none');
        if (typeof initJunkiesPage === 'function') initJunkiesPage();
    } else if (view === 'originals') {
        if (typeof currentTab !== 'undefined') currentTab = 'originals';
        safeAddClass('originals-content', 'active');
        document.body.classList.add('browse-active');
        safeSetDisplay('center-panel', 'flex');
    } else if (view === 'lounge') {
        safeAddClass('lounge-content', 'active');
        document.body.classList.add('lounge-active');
        safeSetDisplay('center-panel', 'none');
        // Show intro splash if first time
        if (typeof checkAndShowLoungeIntro === 'function') {
            checkAndShowLoungeIntro();
        }
    }
}

// Make it globally available
window.navigateToView = navigateToView;

// Sidebar navigation
document.querySelectorAll('.side-nav-item').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.preventDefault();

        if (this.id === 'sidebar-upload-btn') {
            openUploadModal();
            return;
        }

        if (this.id === 'sidebar-download-btn') {
            openDownloadModal();
            return;
        }

        // Close profile overlay if open when navigating to browse/community tabs
        const targetView = this.dataset.view || this.dataset.category;
        const browseOrCommunityViews = ['presets', 'samples', 'midi', 'projects', 'originals', 'lounge'];
        if (browseOrCommunityViews.includes(targetView)) {
            // Check if profile overlay is active and close it
            if (document.body.classList.contains('profile-overlay-active')) {
                document.body.classList.remove('profile-overlay-active');
                const profileContent = document.getElementById('profile-content');
                if (profileContent) profileContent.classList.remove('overlay-active', 'active');
                const closeBtn = document.getElementById('profile-close-btn');
                if (closeBtn) closeBtn.classList.add('hidden');
                // Reset overlay state
                if (typeof previousState !== 'undefined') {
                    previousState.wasProfileOverlay = false;
                    previousState.scrollTop = 0;
                }
                if (typeof profileHistory !== 'undefined') {
                    profileHistory = [];
                    profileHistoryIndex = -1;
                }
            }
        }

        // Stop any playing audio
        if (currentlyPlaying && globalAudio) {
            globalAudio.pause();
            globalAudio.currentTime = 0;
        }

        // Update active state
        document.querySelectorAll('.side-nav-item').forEach(x => x.classList.remove('active'));
        this.classList.add('active');

        const downloadBtn = document.getElementById('sidebar-download-btn');
        const uploadBtn = document.getElementById('sidebar-upload-btn');

        if (this.dataset.view === 'originals') {
            if (uploadBtn) uploadBtn.classList.remove('active');
            currentTab = 'originals';
            document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
            safeAddClass('originals-content', 'active');
            if (downloadBtn) downloadBtn.classList.add('hidden');
            document.body.classList.remove('profile-active');
            document.body.classList.remove('lounge-active');
            document.body.classList.remove('upload-active');
            document.body.classList.add('browse-active');
            const presetsBgBtn = document.getElementById('presets-bg-btn');
            const presetsBgOverlay = document.getElementById('presets-bg-overlay');
            if (presetsBgBtn) presetsBgBtn.style.display = 'none';
            if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';
            safeSetDisplay('center-panel', 'flex');
            saveCurrentView('originals', 'view');
        } else if (this.dataset.view === 'lounge') {
            if (uploadBtn) uploadBtn.classList.remove('active');
            document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
            safeAddClass('lounge-content', 'active');
            if (downloadBtn) downloadBtn.classList.add('hidden');
            document.body.classList.remove('profile-active');
            document.body.classList.remove('browse-active');
            document.body.classList.remove('upload-active');
            document.body.classList.add('lounge-active');
            const presetsBgBtn = document.getElementById('presets-bg-btn');
            const presetsBgOverlay = document.getElementById('presets-bg-overlay');
            if (presetsBgBtn) presetsBgBtn.style.display = 'none';
            if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';
            safeSetDisplay('center-panel', 'none');
            saveCurrentView('lounge', 'view');
            // Show intro splash if first time
            if (typeof checkAndShowLoungeIntro === 'function') {
                checkAndShowLoungeIntro();
            }
        } else if (this.dataset.view === 'profile') {
            if (uploadBtn) uploadBtn.classList.remove('active');
            isViewingOwnProfile = true;
            document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
            safeAddClass('profile-content', 'active');
            if (downloadBtn) downloadBtn.classList.add('hidden');

            document.body.classList.add('profile-active');
            document.body.classList.remove('lounge-active');
            document.body.classList.remove('browse-active');
            document.body.classList.remove('upload-active');

            const presetsBgBtn = document.getElementById('presets-bg-btn');
            const presetsBgOverlay = document.getElementById('presets-bg-overlay');
            if (presetsBgBtn) presetsBgBtn.style.display = 'none';
            if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';
            safeSetDisplay('center-panel', 'none');

            updateProfileEditVisibility();

            // Hide Follow/Message buttons on own profile
            if (typeof updateProfileActionButtons === 'function') updateProfileActionButtons();

            // Refresh profile upload cards
            if (typeof renderUploadCards === 'function') renderUploadCards();
            saveCurrentView('profile', 'view');

        } else if (this.dataset.view === 'notifications') {
            if (uploadBtn) uploadBtn.classList.remove('active');
            document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
            safeAddClass('notifications-content', 'active');
            if (downloadBtn) downloadBtn.classList.add('hidden');
            document.body.classList.remove('profile-active');
            document.body.classList.remove('browse-active');
            document.body.classList.remove('upload-active');
            document.body.classList.add('lounge-active');
            const presetsBgBtn = document.getElementById('presets-bg-btn');
            const presetsBgOverlay = document.getElementById('presets-bg-overlay');
            if (presetsBgBtn) presetsBgBtn.style.display = 'none';
            if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';
            safeSetDisplay('center-panel', 'none');
            saveCurrentView('notifications', 'view');

        } else if (this.dataset.view === 'manage-sounds') {
            if (uploadBtn) uploadBtn.classList.remove('active');
            document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
            safeAddClass('manage-sounds-content', 'active');
            if (downloadBtn) downloadBtn.classList.add('hidden');
            document.body.classList.remove('profile-active');
            document.body.classList.remove('browse-active');
            document.body.classList.remove('upload-active');
            document.body.classList.remove('lounge-active');
            const presetsBgBtn = document.getElementById('presets-bg-btn');
            const presetsBgOverlay = document.getElementById('presets-bg-overlay');
            if (presetsBgBtn) presetsBgBtn.style.display = 'none';
            if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';
            safeSetDisplay('center-panel', 'none');
            // Load manage sounds page
            if (typeof loadManageSoundsPage === 'function') loadManageSoundsPage();
            saveCurrentView('manage-sounds', 'view');

        } else if (this.dataset.view === 'settings') {
            if (uploadBtn) uploadBtn.classList.remove('active');
            document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
            safeAddClass('settings-content', 'active');
            if (downloadBtn) downloadBtn.classList.add('hidden');
            document.body.classList.remove('profile-active');
            document.body.classList.remove('browse-active');
            document.body.classList.remove('upload-active');
            document.body.classList.remove('lounge-active');
            const presetsBgBtn = document.getElementById('presets-bg-btn');
            const presetsBgOverlay = document.getElementById('presets-bg-overlay');
            if (presetsBgBtn) presetsBgBtn.style.display = 'none';
            if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';
            safeSetDisplay('center-panel', 'none');
            // Reload settings values
            if (typeof loadSettingsValues === 'function') loadSettingsValues();
            saveCurrentView('settings', 'view');

        } else if (this.dataset.view === 'junkies') {
            if (uploadBtn) uploadBtn.classList.remove('active');
            document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
            safeAddClass('junkies-content', 'active');
            if (downloadBtn) downloadBtn.classList.add('hidden');
            document.body.classList.remove('profile-active');
            document.body.classList.remove('browse-active');
            document.body.classList.remove('upload-active');
            document.body.classList.add('lounge-active');
            const presetsBgBtn = document.getElementById('presets-bg-btn');
            const presetsBgOverlay = document.getElementById('presets-bg-overlay');
            if (presetsBgBtn) presetsBgBtn.style.display = 'none';
            if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';
            safeSetDisplay('center-panel', 'none');
            // Initialize junkies page
            if (typeof initJunkiesPage === 'function') initJunkiesPage();
            saveCurrentView('junkies', 'view');

        } else {
            const category = this.dataset.category;
            currentTab = category;

            if (uploadBtn) {
                uploadBtn.textContent = 'Upload';
                uploadBtn.classList.add('active');
            }

            const presetsBgBtn = document.getElementById('presets-bg-btn');
            const presetsBgOverlay = document.getElementById('presets-bg-overlay');
            if (category === 'presets') {
                if (presetsBgBtn) presetsBgBtn.style.display = 'flex';
                if (presetsBgOverlay) presetsBgOverlay.style.display = 'block';
            } else {
                if (presetsBgBtn) presetsBgBtn.style.display = 'none';
                if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';
            }

            document.body.classList.remove('profile-active');
            document.body.classList.remove('lounge-active');
            document.body.classList.remove('upload-active');
            document.body.classList.add('browse-active');
            safeSetDisplay('center-panel', 'flex');

            updateDynamicFilters(category);
            updateFilterCounts();

            document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
            safeAddClass(`${category}-content`, 'active');

            renderItems(category);
            filterItems();
            if (downloadBtn) downloadBtn.classList.add('hidden');
            saveCurrentView(category, 'category');
        }
    });
});

// Migration: Remove @ prefix from usernames in stored data
function migrateRemoveAtPrefix() {
    // Clean up items comments
    ['presets', 'samples', 'midi', 'projects', 'originals'].forEach(cat => {
        if (items[cat]) {
            items[cat].forEach(item => {
                if (item.comments) {
                    item.comments.forEach(comment => {
                        if (comment.user && comment.user.startsWith('@')) {
                            comment.user = comment.user.substring(1);
                        }
                        if (comment.replies) {
                            comment.replies.forEach(reply => {
                                if (reply.user && reply.user.startsWith('@')) {
                                    reply.user = reply.user.substring(1);
                                }
                            });
                        }
                    });
                }
            });
        }
    });

    // Clean up room messages
    const localRoomMessages = safeJSONParse(localStorage.getItem('roomMessages'), {});
    Object.keys(localRoomMessages).forEach(roomId => {
        if (!localRoomMessages[roomId]) return;
        localRoomMessages[roomId].forEach(msg => {
            if (msg.username && msg.username.startsWith('@')) {
                msg.username = msg.username.substring(1);
            }
            if (msg.author && msg.author.startsWith('@')) {
                msg.author = msg.author.substring(1);
            }
            if (msg.replyData && msg.replyData.author && msg.replyData.author.startsWith('@')) {
                msg.replyData.author = msg.replyData.author.substring(1);
            }
        });
    });
    localStorage.setItem('roomMessages', JSON.stringify(localRoomMessages));

    // Clean up currentUser in localStorage if needed
    const storedUser = localStorage.getItem('profileUsername');
    if (storedUser && storedUser.startsWith('@')) {
        localStorage.setItem('profileUsername', storedUser.substring(1));
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Run migration to remove @ prefix from usernames
    migrateRemoveAtPrefix();

    // Initialize filters first
    initFilterListeners();

    // Render initial items
    ['presets', 'samples', 'midi', 'projects', 'originals'].forEach(cat => renderItems(cat));

    // Load saved profile data
    loadProfileData();

    // Initialize profile uploads
    initProfileUploads();

    // Initialize profile edit modal
    initProfileEdit();

    // Initialize autocomplete
    initAutocomplete();

    // Initialize upload forms
    initUploadForms();

    // Initialize play bar controls
    initPlayBarControls();

    // Initialize keyboard navigation
    initKeyboardNavigation();

    // Initialize center panel comments
    initCenterPanelComments();

    // Initialize lounge
    initLounge();

    // Initialize notifications system
    initNotifications();

    // Restore last viewed section or default to presets
    const savedView = getSavedView();
    if (savedView && savedView.value) {
        // Find and click the corresponding nav item
        let navItem;
        if (savedView.type === 'category') {
            navItem = document.querySelector(`.side-nav-item[data-category="${savedView.value}"]`);
        } else {
            navItem = document.querySelector(`.side-nav-item[data-view="${savedView.value}"]`);
        }
        if (navItem) {
            navItem.click();
        } else {
            // Fallback to presets
            document.body.classList.add('browse-active');
            safeSetDisplay('center-panel', 'flex');
            updateDynamicFilters('presets');
        }
    } else {
        // Default to presets
        document.body.classList.add('browse-active');
        safeSetDisplay('center-panel', 'flex');
        updateDynamicFilters('presets');
    }

    // UI VISIBILITY FAILSAFE - Ensure UI is always visible
    // This runs after all init functions to guarantee the UI shows
    const hasActivePanel = document.querySelector('.tab-panel.active');
    if (!hasActivePanel) {
        // Force show presets panel if nothing is active
        const presetsPanel = document.getElementById('presets-content');
        if (presetsPanel) presetsPanel.classList.add('active');
    }

    // Ensure sidebar is visible
    const sideNav = document.getElementById('side-nav');
    if (sideNav) {
        sideNav.style.display = '';
        sideNav.style.visibility = 'visible';
        sideNav.style.opacity = '1';
    }

    // Ensure body is not hidden
    document.body.style.display = '';
    document.body.style.visibility = 'visible';
    document.body.style.opacity = '1';

    // Track user activity for online status (update every 5 mins on activity)
    let lastActivityUpdate = 0;
    const updateActivity = () => {
        const now = Date.now();
        if (now - lastActivityUpdate > 5 * 60 * 1000) {
            lastActivityUpdate = now;
            if (typeof supabaseUpdateLastActive === 'function') {
                supabaseUpdateLastActive();
            }
        }
    };
    ['click', 'keydown', 'scroll', 'mousemove'].forEach(evt => {
        document.addEventListener(evt, updateActivity, { passive: true });
    });
    // Initial update on load
    if (typeof supabaseUpdateLastActive === 'function') {
        supabaseUpdateLastActive();
    }
});
