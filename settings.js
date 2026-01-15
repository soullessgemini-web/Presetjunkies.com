// ===== SETTINGS PAGE =====

// Initialize settings page
function initSettings() {
    loadSettingsValues();
    initSettingsEventListeners();
}

// Mask email address (show first 2 chars, rest as asterisks)
function maskEmail(email) {
    if (!email || email === 'Not set') return 'Not set';

    const [localPart, domain] = email.split('@');
    if (!domain) return email;

    // Show first 2 characters, mask the rest
    const visibleChars = Math.min(2, localPart.length);
    const maskedLocal = localPart.substring(0, visibleChars) + '*'.repeat(Math.max(0, localPart.length - visibleChars));

    return `${maskedLocal}@${domain}`;
}

// Load current settings values
async function loadSettingsValues() {
    // Load username
    const username = localStorage.getItem('profileUsername') || 'Username';
    const usernameDisplay = document.getElementById('settings-current-username');
    if (usernameDisplay) usernameDisplay.textContent = username;

    // Load email (masked)
    const email = localStorage.getItem('userEmail') || 'Not set';
    const emailDisplay = document.getElementById('settings-current-email');
    if (emailDisplay) emailDisplay.textContent = maskEmail(email);

    // Load settings from Supabase
    let bio = localStorage.getItem('profileBio') || '';

    try {
        const { user } = await supabaseGetUser();
        if (user) {
            const { data: profile } = await supabaseGetProfile(user.id);
            if (profile) {
                if (profile.bio !== undefined) {
                    bio = profile.bio || '';
                    localStorage.setItem('profileBio', bio);
                }
            }
        }
    } catch (err) {
        console.error('Error loading settings from Supabase:', err);
    }

    // Set bio
    const bioInput = document.getElementById('settings-bio-input');
    const bioCount = document.getElementById('settings-bio-count');
    if (bioInput) {
        bioInput.value = bio;
        if (bioCount) bioCount.textContent = bio.length;
    }
}

// Initialize event listeners
function initSettingsEventListeners() {
    // Change Username
    document.getElementById('settings-change-username-btn')?.addEventListener('click', openUsernameModal);
    document.getElementById('close-username-modal')?.addEventListener('click', closeUsernameModal);
    document.getElementById('save-username-btn')?.addEventListener('click', saveNewUsername);

    // Change Email
    document.getElementById('settings-change-email-btn')?.addEventListener('click', openEmailModal);
    document.getElementById('close-email-modal')?.addEventListener('click', closeEmailModal);
    document.getElementById('save-email-btn')?.addEventListener('click', saveNewEmail);

    // Change Password
    document.getElementById('settings-change-password-btn')?.addEventListener('click', openPasswordModal);
    document.getElementById('close-password-modal')?.addEventListener('click', closePasswordModal);
    document.getElementById('save-password-btn')?.addEventListener('click', saveNewPassword);

    // Delete Account - Warning Modal
    document.getElementById('settings-delete-account-btn')?.addEventListener('click', openDeleteWarningModal);
    document.getElementById('close-delete-warning-modal')?.addEventListener('click', closeDeleteWarningModal);
    document.getElementById('cancel-delete-btn')?.addEventListener('click', closeDeleteWarningModal);
    document.getElementById('proceed-delete-btn')?.addEventListener('click', proceedToDeletePassword);

    // Delete Account - Password Modal
    document.getElementById('close-delete-modal')?.addEventListener('click', closeDeleteModal);
    document.getElementById('confirm-delete-btn')?.addEventListener('click', confirmDeleteAccount);

    // Report Bug
    document.getElementById('settings-report-bug-btn')?.addEventListener('click', openReportBugModal);
    document.getElementById('close-report-bug-modal')?.addEventListener('click', closeReportBugModal);
    document.getElementById('submit-bug-report-btn')?.addEventListener('click', submitBugReport);
    document.getElementById('bug-report-ok-btn')?.addEventListener('click', closeBugReportSentModal);

    // Bio
    document.getElementById('settings-bio-input')?.addEventListener('input', updateBioCount);
    document.getElementById('settings-save-bio-btn')?.addEventListener('click', saveBio);

    // Close modals on backdrop click
    ['change-username-modal', 'change-email-modal', 'change-password-modal', 'delete-warning-modal', 'delete-account-modal', 'report-bug-modal', 'bug-report-sent-modal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }
    });

    // Clear errors on input focus
    document.getElementById('new-username-input')?.addEventListener('focus', () => {
        const errorEl = document.getElementById('new-username-error');
        const inputEl = document.getElementById('new-username-input');
        if (errorEl) errorEl.textContent = '';
        if (inputEl) inputEl.classList.remove('error');
    });

    document.getElementById('new-email-input')?.addEventListener('focus', () => {
        const errorEl = document.getElementById('new-email-error');
        const inputEl = document.getElementById('new-email-input');
        if (errorEl) errorEl.textContent = '';
        if (inputEl) inputEl.classList.remove('error');
    });

    document.getElementById('email-verify-password')?.addEventListener('focus', () => {
        const errorEl = document.getElementById('new-email-error');
        const inputEl = document.getElementById('email-verify-password');
        if (errorEl) errorEl.textContent = '';
        if (inputEl) inputEl.classList.remove('error');
    });

    // Clear password errors on focus
    ['current-password-input', 'new-password-input', 'confirm-password-input'].forEach(id => {
        document.getElementById(id)?.addEventListener('focus', () => {
            const errorEl = document.getElementById('password-error');
            const inputEl = document.getElementById(id);
            if (errorEl) errorEl.textContent = '';
            if (inputEl) inputEl.classList.remove('error');
        });
    });
}

// ===== USERNAME MODAL =====
function openUsernameModal() {
    const modal = document.getElementById('change-username-modal');
    const content = modal?.querySelector('.modal-content');
    const input = document.getElementById('new-username-input');
    const error = document.getElementById('new-username-error');

    if (input) {
        input.value = '';
        input.classList.remove('error');
    }
    if (error) error.textContent = '';
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            content?.classList.add('show');
            input?.focus();
        }, 10);
    }
}

function closeUsernameModal() {
    const modal = document.getElementById('change-username-modal');
    const content = modal?.querySelector('.modal-content');
    if (content) content.classList.remove('show');
    setTimeout(() => modal?.classList.add('hidden'), 200);
}

function saveNewUsername() {
    const input = document.getElementById('new-username-input');
    const error = document.getElementById('new-username-error');
    const username = input?.value?.trim();

    if (!username) {
        if (error) error.textContent = 'Please enter a username';
        if (input) input.classList.add('error');
        return;
    }

    // Use existing validation
    if (typeof validateUsername === 'function') {
        const validation = validateUsername(username);
        if (!validation.valid) {
            error.textContent = validation.error;
            input.classList.add('error');
            return;
        }
    }

    // Check if username is taken
    let takenUsernames = safeJSONParse(localStorage.getItem('takenUsernames'), []);

    const currentUsername = localStorage.getItem('profileUsername');
    const usernameLower = username.toLowerCase();

    if (currentUsername?.toLowerCase() !== usernameLower) {
        const isDuplicate = takenUsernames.some(u => u.toLowerCase() === usernameLower);
        if (isDuplicate) {
            error.textContent = `"${username}" is already taken`;
            input.classList.add('error');
            return;
        }
    }

    // Update taken usernames list
    if (currentUsername && currentUsername.toLowerCase() !== usernameLower) {
        takenUsernames = takenUsernames.filter(u => u.toLowerCase() !== currentUsername.toLowerCase());
    }
    if (!takenUsernames.some(u => u.toLowerCase() === usernameLower)) {
        takenUsernames.push(username);
    }
    localStorage.setItem('takenUsernames', JSON.stringify(takenUsernames));

    // Save new username
    localStorage.setItem('profileUsername', username);

    // Update displays
    const settingsUsername = document.getElementById('settings-current-username');
    if (settingsUsername) settingsUsername.textContent = username;
    const profileUsername = document.getElementById('profile-username');
    if (profileUsername) profileUsername.textContent = username;

    // Update lounge currentUser
    if (typeof currentUser !== 'undefined') {
        window.currentUser = username;
    }

    closeUsernameModal();
}

// ===== EMAIL MODAL =====
function openEmailModal() {
    const modal = document.getElementById('change-email-modal');
    const content = modal?.querySelector('.modal-content');
    const passwordInput = document.getElementById('email-verify-password');
    const emailInput = document.getElementById('new-email-input');
    const error = document.getElementById('new-email-error');
    const maskedDisplay = document.getElementById('modal-current-email-masked');

    // Show current masked email
    const currentEmail = localStorage.getItem('userEmail') || 'Not set';
    if (maskedDisplay) maskedDisplay.textContent = maskEmail(currentEmail);

    // Clear inputs
    if (passwordInput) {
        passwordInput.value = '';
        passwordInput.classList.remove('error');
    }
    if (emailInput) {
        emailInput.value = '';
        emailInput.classList.remove('error');
    }
    if (error) error.textContent = '';

    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            content?.classList.add('show');
            passwordInput?.focus();
        }, 10);
    }
}

function closeEmailModal() {
    const modal = document.getElementById('change-email-modal');
    const content = modal?.querySelector('.modal-content');
    if (content) content.classList.remove('show');
    setTimeout(() => modal?.classList.add('hidden'), 200);
}

function saveNewEmail() {
    const emailInput = document.getElementById('new-email-input');
    const error = document.getElementById('new-email-error');

    const email = emailInput?.value?.trim();

    // Note: Password verification would require a backend
    // For this demo, we allow email changes directly

    if (!email) {
        error.textContent = 'Please enter an email';
        emailInput.classList.add('error');
        return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        error.textContent = 'Please enter a valid email address';
        emailInput.classList.add('error');
        return;
    }

    // Save email
    localStorage.setItem('userEmail', email);

    // Update display with masked version
    const settingsEmail = document.getElementById('settings-current-email');
    if (settingsEmail) settingsEmail.textContent = maskEmail(email);

    closeEmailModal();
}

// ===== PASSWORD MODAL =====
function openPasswordModal() {
    const modal = document.getElementById('change-password-modal');
    const content = modal?.querySelector('.modal-content');
    const inputs = ['current-password-input', 'new-password-input', 'confirm-password-input'];
    const error = document.getElementById('password-error');

    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.value = '';
            input.classList.remove('error');
        }
    });
    if (error) error.textContent = '';
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            content?.classList.add('show');
            document.getElementById('current-password-input')?.focus();
        }, 10);
    }
}

function closePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    const content = modal?.querySelector('.modal-content');
    if (content) content.classList.remove('show');
    setTimeout(() => modal?.classList.add('hidden'), 200);
}

function saveNewPassword() {
    const newInput = document.getElementById('new-password-input');
    const confirmInput = document.getElementById('confirm-password-input');
    const error = document.getElementById('password-error');

    const newPassword = newInput?.value;
    const confirmPassword = confirmInput?.value;

    // Note: Current password verification would require a backend
    // For this demo, we just validate the new password

    // Validate new password
    if (!newPassword) {
        error.textContent = 'Please enter a new password';
        newInput.classList.add('error');
        return;
    }

    // Use auth.js password validation if available
    if (typeof isValidPassword === 'function') {
        const validation = isValidPassword(newPassword);
        if (!validation.minLength) {
            error.textContent = 'Password must be at least 8 characters';
            newInput.classList.add('error');
            return;
        }
        if (!validation.hasSpecialChar) {
            error.textContent = 'Password must include at least 1 special character';
            newInput.classList.add('error');
            return;
        }
    } else if (newPassword.length < 8) {
        error.textContent = 'Password must be at least 8 characters';
        newInput.classList.add('error');
        return;
    }

    // Validate confirmation
    if (newPassword !== confirmPassword) {
        error.textContent = 'Passwords do not match';
        confirmInput.classList.add('error');
        return;
    }

    // Note: Password is NOT stored in localStorage for security
    // In production, this would be sent to a backend API

    closePasswordModal();
    alert('Password changed successfully (demo mode - no backend)');
}

// ===== DELETE ACCOUNT WARNING MODAL =====
function openDeleteWarningModal() {
    const modal = document.getElementById('delete-warning-modal');
    const content = modal?.querySelector('.modal-content');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => content?.classList.add('show'), 10);
    }
}

function closeDeleteWarningModal() {
    const modal = document.getElementById('delete-warning-modal');
    const content = modal?.querySelector('.modal-content');
    if (content) content.classList.remove('show');
    setTimeout(() => modal?.classList.add('hidden'), 200);
}

function proceedToDeletePassword() {
    closeDeleteWarningModal();
    setTimeout(() => openDeleteModal(), 250);
}

// ===== DELETE ACCOUNT PASSWORD MODAL =====
function openDeleteModal() {
    const modal = document.getElementById('delete-account-modal');
    const content = modal?.querySelector('.modal-content');
    const input = document.getElementById('delete-confirm-input');
    const error = document.getElementById('delete-error');
    const confirmBtn = document.getElementById('confirm-delete-btn');

    if (input) {
        input.value = '';
        input.classList.remove('error');
    }
    if (error) error.textContent = '';
    if (confirmBtn) {
        confirmBtn.textContent = 'Delete My Account';
        confirmBtn.disabled = false;
    }
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            content?.classList.add('show');
            input?.focus();
        }, 10);
    }
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-account-modal');
    const content = modal?.querySelector('.modal-content');
    if (content) content.classList.remove('show');
    setTimeout(() => modal?.classList.add('hidden'), 200);
}

async function confirmDeleteAccount() {
    const input = document.getElementById('delete-confirm-input');
    const error = document.getElementById('delete-error');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const password = input?.value;

    if (!password) {
        error.textContent = 'Please enter your password';
        input.classList.add('error');
        return;
    }

    // Show loading state
    if (confirmBtn) {
        confirmBtn.textContent = 'Verifying...';
        confirmBtn.disabled = true;
    }

    // Verify password with Supabase
    const email = localStorage.getItem('userEmail');
    if (!email) {
        error.textContent = 'Could not verify account. Please try logging in again.';
        if (confirmBtn) {
            confirmBtn.textContent = 'Delete My Account';
            confirmBtn.disabled = false;
        }
        return;
    }

    try {
        // Re-authenticate to verify password
        const { error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            error.textContent = 'Incorrect password';
            input.classList.add('error');
            if (confirmBtn) {
                confirmBtn.textContent = 'Delete My Account';
                confirmBtn.disabled = false;
            }
            return;
        }
    } catch (err) {
        error.textContent = 'Failed to verify password';
        if (confirmBtn) {
            confirmBtn.textContent = 'Delete My Account';
            confirmBtn.disabled = false;
        }
        return;
    }

    // Update button to show deletion in progress
    if (confirmBtn) {
        confirmBtn.textContent = 'Deleting...';
    }

    // Delete from Supabase
    if (typeof supabaseDeleteUserAccount === 'function') {
        const { error: deleteError } = await supabaseDeleteUserAccount();
        if (deleteError) {
            error.textContent = deleteError.message || 'Failed to delete account';
            if (confirmBtn) {
                confirmBtn.textContent = 'Delete My Account';
                confirmBtn.disabled = false;
            }
            return;
        }
    }

    // Clear all local data
    const keysToRemove = [
        'profileUsername',
        'profileBio',
        'profileAvatar',
        'profileBanner',
        'userEmail',
        'takenUsernames',
        'followedUsers',
        'likedItems',
        'savedItems',
        'profileFollowers',
        'profileFollowing',
        'profileUploads',
        'profileDownloads',
        'communityRooms',
        'joinedRooms',
        'isLoggedIn',
        'supabaseUserId',
        'favoriteRooms',
        'lastLoungeRoom'
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Close delete modal and show success modal
    closeDeleteModal();
    showAccountDeletedModal();
}

function showAccountDeletedModal() {
    const modal = document.getElementById('account-deleted-modal');
    const content = modal?.querySelector('.modal-content');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => content?.classList.add('show'), 10);
    }

    // Set up OK button to reload page
    const okBtn = document.getElementById('account-deleted-ok-btn');
    if (okBtn) {
        okBtn.onclick = () => {
            location.reload();
        };
    }
}

// ===== REPORT BUG MODAL =====
function openReportBugModal() {
    const modal = document.getElementById('report-bug-modal');
    const content = modal?.querySelector('.modal-content');
    const textarea = document.getElementById('report-bug-textarea');

    if (textarea) {
        textarea.value = '';
    }
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            content?.classList.add('show');
            textarea?.focus();
        }, 10);
    }
}

function closeReportBugModal() {
    const modal = document.getElementById('report-bug-modal');
    const content = modal?.querySelector('.modal-content');
    if (content) content.classList.remove('show');
    setTimeout(() => modal?.classList.add('hidden'), 200);
}

function submitBugReport() {
    const textarea = document.getElementById('report-bug-textarea');
    const message = textarea?.value?.trim();

    if (!message) {
        return;
    }

    // TODO: Send to backend API when ready
    // Bug report data is in 'message' variable

    // Close report modal
    closeReportBugModal();

    // Show confirmation modal
    setTimeout(() => {
        const sentModal = document.getElementById('bug-report-sent-modal');
        const content = sentModal?.querySelector('.modal-content');
        if (sentModal) {
            sentModal.classList.remove('hidden');
            setTimeout(() => content?.classList.add('show'), 10);
        }
    }, 250);
}

function closeBugReportSentModal() {
    const modal = document.getElementById('bug-report-sent-modal');
    const content = modal?.querySelector('.modal-content');
    if (content) content.classList.remove('show');
    setTimeout(() => modal?.classList.add('hidden'), 200);
}

// ===== BIO =====
function updateBioCount() {
    const input = document.getElementById('settings-bio-input');
    const count = document.getElementById('settings-bio-count');
    if (input && count) {
        count.textContent = input.value.length;
    }
}

async function saveBio() {
    const input = document.getElementById('settings-bio-input');
    if (input) {
        const bio = input.value.trim();
        const btn = document.getElementById('settings-save-bio-btn');

        // Show saving state
        if (btn) {
            btn.textContent = 'Saving...';
            btn.disabled = true;
        }

        try {
            // Save to Supabase
            const { user } = await supabaseGetUser();
            if (user) {
                await supabaseUpdateProfile(user.id, { bio });
            }

            // Save to localStorage for compatibility
            localStorage.setItem('profileBio', bio);

            // Update profile bio display
            const profileBio = document.getElementById('profile-about');
            if (profileBio) {
                profileBio.textContent = bio || 'Change bio in settings.';
            }

            // Visual feedback - success
            if (btn) {
                btn.textContent = 'Saved!';
                btn.disabled = false;
                btn.style.background = 'rgba(103, 232, 249, 0.3)';
                setTimeout(() => {
                    btn.textContent = 'Save Bio';
                    btn.style.background = '';
                }, 1500);
            }
        } catch (err) {
            console.error('Error saving bio:', err);
            // Visual feedback - error
            if (btn) {
                btn.textContent = 'Error!';
                btn.disabled = false;
                btn.style.background = 'rgba(239, 68, 68, 0.3)';
                setTimeout(() => {
                    btn.textContent = 'Save Bio';
                    btn.style.background = '';
                }, 1500);
            }
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initSettings);
