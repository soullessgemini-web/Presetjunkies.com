// Centralized Event Handlers - Replaces inline onclick handlers
// Uses event delegation for better security and performance

(function() {
    'use strict';

    // Event handler registry
    const handlers = {
        // Auth handlers
        'openAuthModal': (el) => {
            const modal = el.dataset.modal || 'login';
            if (typeof openAuthModal === 'function') openAuthModal(modal);
        },
        'closeAuthModal': () => {
            if (typeof closeAuthModal === 'function') closeAuthModal();
        },
        'showAuthRequiredModal': () => {
            if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        },
        'logout': () => {
            if (typeof logout === 'function') logout();
        },
        'showAuthPanel': (el) => {
            const panel = el.dataset.panel;
            if (typeof showAuthPanel === 'function') showAuthPanel(panel);
        },
        'handleLogin': (el, e) => {
            e.preventDefault();
            if (typeof handleLogin === 'function') handleLogin(e);
        },
        'handleSignup': (el, e) => {
            e.preventDefault();
            if (typeof handleSignup === 'function') handleSignup(e);
        },
        'handleForgotPassword': (el, e) => {
            e.preventDefault();
            if (typeof handleForgotPassword === 'function') handleForgotPassword(e);
        },
        'handlePasswordUpdate': (el, e) => {
            e.preventDefault();
            if (typeof handlePasswordUpdate === 'function') handlePasswordUpdate(e);
        },
        'togglePasswordVisibility': (el) => {
            const inputId = el.dataset.input;
            if (typeof togglePasswordVisibility === 'function') togglePasswordVisibility(inputId);
        },

        // Profile handlers
        'closeProfileOverlay': () => {
            if (typeof closeProfileOverlay === 'function') closeProfileOverlay();
        },
        'goBackToParentProfile': () => {
            if (typeof goBackToParentProfile === 'function') goBackToParentProfile();
        },
        'showProfileFollowers': () => {
            if (typeof showProfileFollowers === 'function') showProfileFollowers();
        },
        'showProfileFollowing': () => {
            if (typeof showProfileFollowing === 'function') showProfileFollowing();
        },
        'followUser': () => {
            if (typeof followUser === 'function') followUser();
        },

        // Notification handlers
        'clearReadNotifications': () => {
            if (typeof clearReadNotifications === 'function') clearReadNotifications();
        },
        'closeNotificationDetailView': () => {
            if (typeof closeDetailView === 'function') closeDetailView();
            else if (typeof closeNotificationDetailView === 'function') closeNotificationDetailView();
        },
        'closeDetailView': () => {
            if (typeof closeDetailView === 'function') closeDetailView();
        },
        'declineRoomInvite': () => {
            if (typeof declineRoomInvite === 'function') declineRoomInvite();
        },
        'acceptRoomInvite': () => {
            if (typeof acceptRoomInvite === 'function') acceptRoomInvite();
        },

        // Play bar handlers
        'toggleAutoplay': () => {
            if (typeof toggleAutoplay === 'function') toggleAutoplay();
        },
        'togglePlayBarLoop': () => {
            if (typeof togglePlayBarLoop === 'function') togglePlayBarLoop();
        },
        'togglePlayBarLike': () => {
            if (typeof togglePlayBarLike === 'function') togglePlayBarLike();
        },
        'sharePlayBarTrack': () => {
            if (typeof sharePlayBarTrack === 'function') sharePlayBarTrack();
        },
        'downloadPlayBarTrack': () => {
            if (typeof downloadPlayBarTrack === 'function') downloadPlayBarTrack();
        },
        'savePlayBarTrack': () => {
            if (typeof savePlayBarTrack === 'function') savePlayBarTrack();
        },

        // Share modal handlers
        'closeShareModal': () => {
            if (typeof closeShareModal === 'function') closeShareModal();
        },
        'submitShare': () => {
            if (typeof submitShare === 'function') submitShare();
        },

        // Upload modal handlers
        'closeUploadModal': () => {
            if (typeof closeUploadModal === 'function') closeUploadModal();
        },
        'triggerFileInput': (el) => {
            const inputId = el.dataset.input;
            const input = document.getElementById(inputId);
            if (input) input.click();
        },

        // Download modal handlers
        'closeDownloadModal': () => {
            if (typeof closeDownloadModal === 'function') closeDownloadModal();
        },
        'confirmDownload': () => {
            if (typeof confirmDownload === 'function') confirmDownload();
        },

        // Comment modal handlers
        'closeCommentModal': () => {
            if (typeof closeCommentModal === 'function') closeCommentModal();
        },
        'submitComment': () => {
            if (typeof submitComment === 'function') submitComment();
        },

        // Delete conversation modal handlers
        'closeDeleteConversationModal': () => {
            if (typeof closeDeleteConversationModal === 'function') closeDeleteConversationModal();
        },
        'confirmDeleteConversation': () => {
            if (typeof confirmDeleteConversation === 'function') confirmDeleteConversation();
        },

        // External link modal handlers
        'closeExternalLinkModal': () => {
            if (typeof closeExternalLinkModal === 'function') closeExternalLinkModal();
        },
        'continueToExternalLink': () => {
            if (typeof continueToExternalLink === 'function') continueToExternalLink();
        },

        // Browse/Card handlers
        'toggleVideoPlay': (el, e) => {
            e.stopPropagation();
            const rawId = el.dataset.id;
            const id = rawId.startsWith('preview-') ? rawId : parseInt(rawId, 10);
            if (id && typeof toggleVideoPlay === 'function') toggleVideoPlay(id);
        },
        'toggleVideoFullscreen': (el, e) => {
            e.stopPropagation();
            const rawId = el.dataset.id;
            const id = rawId.startsWith('preview-') ? rawId : parseInt(rawId, 10);
            if (id && typeof toggleVideoFullscreen === 'function') toggleVideoFullscreen(id);
        },
        'toggleCardLike': (el, e) => {
            e.stopPropagation();
            const id = parseInt(el.dataset.id, 10);
            const category = el.dataset.category;
            if (!isNaN(id) && category && typeof toggleCardLike === 'function') toggleCardLike(id, category);
        },
        'saveCardItem': (el, e) => {
            e.stopPropagation();
            const id = parseInt(el.dataset.id, 10);
            const category = el.dataset.category;
            if (!isNaN(id) && category && typeof saveCardItem === 'function') saveCardItem(id, category);
        },
        'openShareModal': (el, e) => {
            e.stopPropagation();
            const id = parseInt(el.dataset.id, 10);
            const category = el.dataset.category;
            if (!isNaN(id) && category && typeof openShareModal === 'function') openShareModal(id, category);
        },
        'downloadCardItem': (el, e) => {
            e.stopPropagation();
            const id = parseInt(el.dataset.id, 10);
            const category = el.dataset.category;
            if (!isNaN(id) && category && typeof downloadCardItem === 'function') downloadCardItem(id, category);
        },
        'togglePlay': (el, e) => {
            e.stopPropagation();
            const rawId = el.dataset.id;
            const category = el.dataset.category;
            // Handle preview items (string IDs starting with 'preview-')
            const id = rawId && rawId.startsWith('preview-') ? rawId : parseInt(rawId, 10);
            if ((typeof id === 'string' || !isNaN(id)) && category && typeof togglePlay === 'function') togglePlay(id, category);
        },
        'toggleCardInfo': (el, e) => {
            e.stopPropagation();
            const id = parseInt(el.dataset.id, 10);
            if (!isNaN(id) && typeof toggleCardInfo === 'function') toggleCardInfo(id);
        },
        'changePage': (el, e) => {
            e.stopPropagation();
            const category = el.dataset.category;
            const page = parseInt(el.dataset.page, 10);
            if (category && !isNaN(page) && typeof changePage === 'function') changePage(category, page);
        },
        'viewUserProfile': (el, e) => {
            e.stopPropagation();
            const username = el.dataset.username;
            if (username && typeof viewUserProfile === 'function') viewUserProfile(username);
        },
        'view-profile': (el, e) => {
            e.stopPropagation();
            const username = el.dataset.username;
            if (username && typeof viewUserProfile === 'function') viewUserProfile(username);
        },
        'toggleLike': (el, e) => {
            e.stopPropagation();
            const id = parseInt(el.dataset.id, 10);
            const category = el.dataset.category;
            if (!isNaN(id) && category && typeof toggleLike === 'function') toggleLike(id, category);
        },
        'openCommentModal': (el, e) => {
            e.stopPropagation();
            const id = parseInt(el.dataset.id, 10);
            const category = el.dataset.category;
            if (!isNaN(id) && category && typeof openCommentModal === 'function') openCommentModal(id, category);
        }
    };

    // Centralized click handler using event delegation
    document.addEventListener('click', function(e) {
        // Find closest element with data-action
        const actionElement = e.target.closest('[data-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.action;
        const handler = handlers[action];

        if (handler) {
            // Prevent default for links
            if (actionElement.tagName === 'A') {
                e.preventDefault();
            }
            handler(actionElement, e);
        }
    });

    // Comment input Enter key handler
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.target.id === 'comment-input') {
            e.preventDefault();
            if (typeof submitComment === 'function') submitComment();
        }
    });

    // Terms box scroll handler
    document.addEventListener('DOMContentLoaded', function() {
        const termsBox = document.getElementById('terms-box');
        if (termsBox) {
            termsBox.addEventListener('scroll', function() {
                if (typeof checkTermsScroll === 'function') checkTermsScroll();
            });
        }
    });

    // Per-page select change handler
    document.addEventListener('change', function(e) {
        // Browse items per page
        const browseSelect = e.target.closest('[data-action="setItemsPerPage"]');
        if (browseSelect) {
            const category = browseSelect.dataset.category;
            const value = parseInt(browseSelect.value, 10);
            if (category && !isNaN(value) && typeof setItemsPerPage === 'function') {
                setItemsPerPage(category, value);
            }
            return;
        }

        // Manage sounds items per page
        const manageSelect = e.target.closest('[data-action="setManageItemsPerPage"]');
        if (manageSelect) {
            const value = parseInt(manageSelect.value, 10);
            if (!isNaN(value) && typeof setManageItemsPerPage === 'function') {
                setManageItemsPerPage(value);
            }
        }
    });

    // Make handlers available globally for debugging
    window._eventHandlers = handlers;
})();
