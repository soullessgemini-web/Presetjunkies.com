// ===== AUTHENTICATION =====

// Auth state
let isAuthenticated = false;
let currentUserData = null;
let activityInterval = null;

// Login attempt tracking (per email)
// Structure: { email: { attempts: number, lockedUntil: timestamp } }
const loginAttempts = {};
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Check if email is locked out
function isEmailLockedOut(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const record = loginAttempts[normalizedEmail];

    if (!record) return false;

    if (record.lockedUntil && Date.now() < record.lockedUntil) {
        return true;
    }

    // Lockout expired, reset the record
    if (record.lockedUntil && Date.now() >= record.lockedUntil) {
        delete loginAttempts[normalizedEmail];
    }

    return false;
}

// Record a failed login attempt
function recordFailedAttempt(email) {
    const normalizedEmail = email.toLowerCase().trim();

    if (!loginAttempts[normalizedEmail]) {
        loginAttempts[normalizedEmail] = { attempts: 0, lockedUntil: null };
    }

    loginAttempts[normalizedEmail].attempts++;

    // Lock out after MAX_LOGIN_ATTEMPTS
    if (loginAttempts[normalizedEmail].attempts >= MAX_LOGIN_ATTEMPTS) {
        loginAttempts[normalizedEmail].lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        return true; // Returns true if now locked out
    }

    return false;
}

// Clear login attempts on successful login
function clearLoginAttempts(email) {
    const normalizedEmail = email.toLowerCase().trim();
    delete loginAttempts[normalizedEmail];
}

// Get remaining attempts for an email
function getRemainingAttempts(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const record = loginAttempts[normalizedEmail];
    if (!record) return MAX_LOGIN_ATTEMPTS;
    return Math.max(0, MAX_LOGIN_ATTEMPTS - record.attempts);
}

// Initialize auth on page load
async function initAuth() {
    await checkAuthState();

    // Listen for auth state changes (login, logout, token refresh)
    supabaseOnAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
            // User signed in
            const { data: profile } = await supabaseGetProfile(session.user.id);

            const userData = {
                id: session.user.id,
                username: profile?.username || session.user.email.split('@')[0],
                email: session.user.email,
                avatar: profile?.avatar_url || null
            };

            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('supabaseUserId', session.user.id);
            localStorage.setItem('profileUsername', userData.username);
            localStorage.setItem('userEmail', userData.email);
            if (userData.avatar) {
                localStorage.setItem('profileAvatar', userData.avatar);
            }

            isAuthenticated = true;
            currentUserData = userData;
            updateAuthUI(true, userData);

        } else if (event === 'SIGNED_OUT') {
            // User signed out
            isAuthenticated = false;
            currentUserData = null;
            clearSensitiveData();
            updateAuthUI(false, null);

        } else if (event === 'PASSWORD_RECOVERY') {
            // User clicked password reset link - clear any lockout and show password update modal
            if (session?.user?.email) {
                clearLoginAttempts(session.user.email);
            }
            // Show password update modal
            showPasswordUpdateModal();
        }
    });
}

// Check if user is logged in (from Supabase session)
async function checkAuthState() {
    try {
        // Check Supabase session first
        const { session } = await supabaseGetSession();

        if (session?.user) {
            // Valid Supabase session - get profile
            const { data: profile } = await supabaseGetProfile(session.user.id);

            const userData = {
                id: session.user.id,
                username: profile?.username || session.user.email.split('@')[0],
                email: session.user.email,
                avatar: profile?.avatar_url || null
            };

            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('supabaseUserId', session.user.id);
            localStorage.setItem('profileUsername', userData.username);
            localStorage.setItem('userEmail', userData.email);
            if (userData.avatar) {
                localStorage.setItem('profileAvatar', userData.avatar);
            }
            if (profile?.bio) {
                localStorage.setItem('profileBio', profile.bio);
            }
            if (profile?.banner_url) {
                localStorage.setItem('profileBanner', profile.banner_url);
            }

            isAuthenticated = true;
            currentUserData = userData;
            updateAuthUI(true, userData);
            return;
        }
    } catch (e) {
        console.error('Error checking auth state:', e);
    }

    // No valid session - clear login flag and set guest mode
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('supabaseUserId');
    document.body.classList.add('guest-mode');
}

// Update sidebar UI based on auth state
function updateAuthUI(isLoggedIn, userData) {
    if (isLoggedIn && userData) {
        // Update currentUser global variable
        if (typeof currentUser !== 'undefined') {
            currentUser = userData.username;
        }

        // Set isLoggedIn flag
        localStorage.setItem('isLoggedIn', 'true');

        // Remove guest mode - user is logged in
        document.body.classList.remove('guest-mode');
    } else {
        // Reset currentUser to default when logged out
        if (typeof currentUser !== 'undefined') {
            currentUser = 'You';
        }

        // Clear isLoggedIn flag
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('supabaseUserId');

        // Add guest mode - user is not logged in
        document.body.classList.add('guest-mode');
    }

    // Update nav section (handles "Preset Junkies" vs username dropdown)
    if (typeof updateUserNavSection === 'function') {
        updateUserNavSection();
    }
}

// Open auth modal
function openAuthModal(type = 'login') {
    const modal = document.getElementById('auth-modal');
    const content = modal?.querySelector('.modal-content');

    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => content?.classList.add('show'), 10);

        // Show the correct panel
        showAuthPanel(type);

        // Clear any previous errors
        clearAuthMessages();
    }
}

// Close auth modal
function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    const content = modal?.querySelector('.modal-content');

    if (content) {
        content.classList.remove('show');
        setTimeout(() => modal?.classList.add('hidden'), 300);
    }

    // Reset form inputs (elements are divs, not forms)
    const inputs = modal?.querySelectorAll('input');
    if (inputs) {
        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
    }

    clearAuthMessages();
    clearSignupValidation();
}

// Show password update modal (after clicking reset link)
function showPasswordUpdateModal() {
    const modal = document.getElementById('password-update-modal');
    const content = modal?.querySelector('.modal-content');

    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => content?.classList.add('show'), 10);
    }

    // Clear any previous values
    const passwordInput = document.getElementById('update-password');
    const confirmInput = document.getElementById('update-password-confirm');
    if (passwordInput) passwordInput.value = '';
    if (confirmInput) confirmInput.value = '';

    // Clear error messages
    const errorEl = document.getElementById('password-update-error');
    const successEl = document.getElementById('password-update-success');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
        errorEl.style.display = 'none';
    }
    if (successEl) {
        successEl.textContent = '';
        successEl.classList.remove('show');
        successEl.style.display = 'none';
    }
}

// Close password update modal
function closePasswordUpdateModal() {
    const modal = document.getElementById('password-update-modal');
    const content = modal?.querySelector('.modal-content');

    if (content) {
        content.classList.remove('show');
        setTimeout(() => modal?.classList.add('hidden'), 300);
    }
}

// Handle password update submission
async function handlePasswordUpdate(event) {
    if (event) event.preventDefault();

    const password = document.getElementById('update-password')?.value;
    const confirmPassword = document.getElementById('update-password-confirm')?.value;
    const errorEl = document.getElementById('password-update-error');
    const successEl = document.getElementById('password-update-success');

    // Clear previous messages
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
        errorEl.style.display = 'none';
    }

    // Validation
    if (!password) {
        if (errorEl) {
            errorEl.textContent = 'Please enter a new password';
            errorEl.classList.add('show');
            errorEl.style.display = 'block';
        }
        return;
    }

    if (password.length < 8) {
        if (errorEl) {
            errorEl.textContent = 'Password must be at least 8 characters';
            errorEl.classList.add('show');
            errorEl.style.display = 'block';
        }
        return;
    }

    // Check for special character
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
    if (!specialCharRegex.test(password)) {
        if (errorEl) {
            errorEl.textContent = 'Password must contain at least 1 special character (!@#$%^&*)';
            errorEl.classList.add('show');
            errorEl.style.display = 'block';
        }
        return;
    }

    if (password !== confirmPassword) {
        if (errorEl) {
            errorEl.textContent = 'Passwords do not match';
            errorEl.classList.add('show');
            errorEl.style.display = 'block';
        }
        return;
    }

    // Show loading state
    const submitBtn = document.querySelector('#password-update-form .auth-submit-btn');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.textContent = 'Updating...';
        submitBtn.disabled = true;
    }

    try {
        const { data, error } = await supabaseUpdatePassword(password);

        // Reset button
        if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }

        if (error) {
            if (errorEl) {
                errorEl.textContent = error.message || 'Failed to update password';
                errorEl.classList.add('show');
                errorEl.style.display = 'block';
            }
            return;
        }

        // Success - show message and close modal after delay
        if (successEl) {
            successEl.textContent = 'Password updated successfully! Redirecting...';
            successEl.classList.add('show');
            successEl.style.display = 'block';
        }

        setTimeout(() => {
            closePasswordUpdateModal();
            // Redirect to login or home
            if (typeof showToast === 'function') {
                showToast('Password updated successfully!', 'success');
            }
        }, 2000);

    } catch (err) {
        // Reset button
        if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
        if (errorEl) {
            errorEl.textContent = 'An error occurred. Please try again.';
            errorEl.classList.add('show');
            errorEl.style.display = 'block';
        }
        console.error('Password update error:', err);
    }
}

// Switch between auth panels (login, signup, forgot)
function showAuthPanel(panel) {
    // Hide all auth forms
    const forms = document.querySelectorAll('#auth-modal .auth-form');
    forms.forEach(f => f.classList.add('hidden'));

    // Show the target form
    const targetForm = document.getElementById(`${panel}-form`);
    if (targetForm) {
        targetForm.classList.remove('hidden');
    }

    // Toggle modal size for signup
    const modalContent = document.querySelector('.auth-modal-content');
    if (panel === 'signup') {
        modalContent?.classList.add('signup-active');
        // Reset terms scroll state and validation
        resetTermsState();
        clearSignupValidation();
    } else {
        modalContent?.classList.remove('signup-active');
    }

    // Update header
    const titles = {
        'login': 'Welcome Back',
        'signup': 'Create Account',
        'forgot-password': 'Reset Password'
    };
    const subtitles = {
        'login': 'Sign in to your account',
        'signup': 'Join the Preset Junkies community',
        'forgot-password': ''
    };

    const titleEl = document.querySelector('.auth-form-title');
    const subtitleEl = document.querySelector('.auth-form-subtitle');

    if (titleEl) titleEl.textContent = titles[panel] || 'Welcome';
    if (subtitleEl) subtitleEl.textContent = subtitles[panel] || '';
}

// Clear auth messages
function clearAuthMessages() {
    document.querySelectorAll('.auth-error-message, .auth-success-message').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
        el.style.display = 'none';
    });
}

// Clear validation states on signup form
function clearSignupValidation() {
    const inputs = ['signup-username', 'signup-email', 'signup-password', 'signup-confirm-password'];
    const errors = ['signup-username-error', 'signup-email-error', 'signup-password-error', 'signup-confirm-error'];

    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.classList.remove('valid', 'invalid');
        }
    });

    errors.forEach(id => {
        const error = document.getElementById(id);
        if (error) {
            error.textContent = '';
            error.classList.remove('show');
        }
    });
}

// Show error message
function showAuthError(message, formId = 'login') {
    // Validate formId to prevent selector injection
    const validFormIds = ['login', 'signup'];
    const safeFormId = validFormIds.includes(formId) ? formId : 'login';

    // Try the specific error element first, then fall back to general selector
    const errorEl = document.getElementById(`${safeFormId}-error`) ||
                    document.querySelector(`#${safeFormId}-form .auth-error-message`) ||
                    document.querySelector('.auth-error-message');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
        errorEl.style.display = 'block';
    }
    console.log('Auth error:', message, 'Element found:', !!errorEl);
}

// Show success message
function showAuthSuccess(message, formId = 'login') {
    // Validate formId to prevent selector injection
    const validFormIds = ['login', 'register'];
    const safeFormId = validFormIds.includes(formId) ? formId : 'login';

    const successEl = document.querySelector(`#${safeFormId}-panel .auth-success-message`) ||
                      document.querySelector('.auth-success-message');
    if (successEl) {
        successEl.textContent = message;
        successEl.classList.add('show');
    }
}

// Handle login form submission
function handleLogin(event) {
    if (event) event.preventDefault();
    clearAuthMessages();

    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    const rememberMe = document.getElementById('remember-me')?.checked;

    // Validation
    if (!email) {
        showAuthError('Please enter your email address', 'login');
        return;
    }

    if (!isValidEmail(email)) {
        showAuthError('Please enter a valid email address', 'login');
        return;
    }

    if (!password) {
        showAuthError('Please enter your password', 'login');
        return;
    }

    // Simulate login (replace with actual API call)
    simulateLogin(email, password, rememberMe);
}

// Handle signup form submission
function handleSignup(event) {
    if (event) event.preventDefault();
    clearAuthMessages();

    const username = document.getElementById('signup-username')?.value?.trim();
    const email = document.getElementById('signup-email')?.value?.trim();
    const password = document.getElementById('signup-password')?.value;
    const confirmPassword = document.getElementById('signup-confirm-password')?.value;

    // Validate all fields and show visual feedback
    validateUsernameField();
    validateEmailField();
    validatePasswordField();
    validateConfirmPasswordField();

    // Username validation
    if (!username) {
        showAuthError('Please enter a username', 'signup');
        return;
    }

    const usernameCheck = isUsernameAvailable(username);
    if (!usernameCheck.available) {
        showAuthError(usernameCheck.reason === 'taken' ? `"${username}" is already taken` : 'Invalid username', 'signup');
        return;
    }

    // Email validation
    if (!email) {
        showAuthError('Please enter your email address', 'signup');
        return;
    }

    if (!isValidEmail(email)) {
        showAuthError('Please enter a valid email address', 'signup');
        return;
    }

    if (!isValidEmailDomain(email)) {
        showAuthError('Please use a valid email provider (Gmail, Yahoo, Outlook, etc.)', 'signup');
        return;
    }

    // Check if email is already in use
    if (isEmailTaken(email)) {
        showAuthError('This email is already in use', 'signup');
        return;
    }

    // Password validation
    if (!password) {
        showAuthError('Please enter a password', 'signup');
        return;
    }

    const passwordCheck = isValidPassword(password);
    if (!passwordCheck.minLength) {
        showAuthError('Password must be at least 8 characters', 'signup');
        return;
    }

    if (!passwordCheck.hasSpecialChar) {
        showAuthError('Password must include at least 1 special character', 'signup');
        return;
    }

    // Confirm password validation
    if (password !== confirmPassword) {
        showAuthError('Passwords do not match', 'signup');
        return;
    }

    // Simulate signup (replace with actual API call)
    simulateSignup(username, email, password);
}

// Handle forgot password form submission
function handleForgotPassword(event) {
    if (event) event.preventDefault();
    clearAuthMessages();

    const email = document.getElementById('forgot-email')?.value?.trim();

    if (!email) {
        showAuthError('Please enter your email address', 'forgot-password');
        return;
    }

    if (!isValidEmail(email)) {
        showAuthError('Please enter a valid email address', 'forgot-password');
        return;
    }

    // Simulate password reset (replace with actual API call)
    simulateForgotPassword(email);
}

// Validate email format
function isValidEmail(email) {
    // More robust email regex:
    // - Local part: alphanumeric, dots, hyphens, underscores, plus signs (max 64 chars)
    // - Domain: alphanumeric and hyphens, at least 2 char TLD
    // - Total max length 254 chars (RFC 5321)
    if (!email || email.length > 254) return false;
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

// List of valid email domains (popular worldwide providers)
const validEmailDomains = [
    // US/International
    'gmail.com', 'googlemail.com',
    'yahoo.com', 'yahoo.co.uk', 'yahoo.ca', 'yahoo.com.au', 'yahoo.co.in', 'yahoo.fr', 'yahoo.de', 'yahoo.es', 'yahoo.it', 'yahoo.co.jp',
    'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.es', 'hotmail.it',
    'outlook.com', 'outlook.co.uk', 'outlook.fr', 'outlook.de', 'outlook.es', 'outlook.it',
    'live.com', 'live.co.uk', 'live.fr', 'live.de', 'live.nl',
    'msn.com',
    'aol.com', 'aol.co.uk',
    'icloud.com', 'me.com', 'mac.com',
    'protonmail.com', 'proton.me', 'pm.me',
    'zoho.com', 'zohomail.com',
    'fastmail.com', 'fastmail.fm',
    'tutanota.com', 'tutanota.de', 'tutamail.com',
    'yandex.com', 'yandex.ru',
    'mail.com', 'email.com',
    'gmx.com', 'gmx.net', 'gmx.de', 'gmx.at', 'gmx.ch',
    // Germany
    'web.de', 't-online.de', 'freenet.de', 'arcor.de',
    // France
    'orange.fr', 'wanadoo.fr', 'laposte.net', 'sfr.fr', 'free.fr',
    // UK
    'btinternet.com', 'virginmedia.com', 'sky.com', 'talktalk.net',
    // Italy
    'libero.it', 'virgilio.it', 'tin.it', 'alice.it',
    // Spain
    'telefonica.net', 'terra.es',
    // Netherlands
    'ziggo.nl', 'kpnmail.nl', 'hetnet.nl',
    // Brazil
    'uol.com.br', 'bol.com.br', 'globo.com', 'terra.com.br',
    // Russia
    'mail.ru', 'inbox.ru', 'list.ru', 'bk.ru',
    // China
    'qq.com', '163.com', '126.com', 'sina.com', 'sohu.com', 'aliyun.com',
    // Japan
    'docomo.ne.jp', 'ezweb.ne.jp', 'softbank.ne.jp',
    // India
    'rediffmail.com',
    // Australia
    'bigpond.com', 'optusnet.com.au',
    // Canada
    'rogers.com', 'shaw.ca', 'bell.net',
    // Educational/Work (common)
    'edu', 'ac.uk', 'edu.au',
    // Other popular
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', // temp emails - you might want to block these
    'duck.com', 'duckduckgo.com',
    // Custom domains
    'presetjunkies.com'
];

// Validate email domain
function isValidEmailDomain(email) {
    if (!isValidEmail(email)) return false;

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;

    // Check exact match or if ends with valid domain (for subdomains and edu domains)
    return validEmailDomains.some(valid =>
        domain === valid ||
        domain.endsWith('.' + valid) ||
        domain.endsWith('.edu') ||
        domain.endsWith('.ac.uk') ||
        domain.endsWith('.edu.au')
    );
}

// Validate password requirements (at least 8 chars and 1 special character)
function isValidPassword(password) {
    const minLength = password.length >= 8;
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
    return { valid: minLength && hasSpecialChar, minLength, hasSpecialChar };
}

// Check if username is available (constant-time to prevent timing attacks)
function isUsernameAvailable(username) {
    if (!username || username.length < 3) return { available: false, reason: 'too_short' };
    if (username.length > 18) return { available: false, reason: 'too_long' };

    // Check against taken usernames
    const takenUsernames = safeJSONParse(localStorage.getItem('takenUsernames'), []);

    // Use global reserved names list
    const reservedNames = window.RESERVED_USERNAMES || ['admin', 'moderator', 'system', 'support', 'preset', 'junkies', 'presetjunkies'];

    // Normalize input username
    const normalizedInput = typeof normalizeUsername === 'function'
        ? normalizeUsername(username)
        : username.toLowerCase();

    // Constant-time check - always check all usernames to prevent timing leak
    let isTaken = false;
    for (const taken of takenUsernames) {
        const normalizedTaken = typeof normalizeUsername === 'function'
            ? normalizeUsername(taken)
            : taken.toLowerCase();
        if (typeof constantTimeCompare === 'function') {
            if (constantTimeCompare(normalizedTaken, normalizedInput)) {
                isTaken = true;
            }
        } else if (normalizedTaken === normalizedInput) {
            isTaken = true;
        }
    }

    // Check reserved names (also constant-time)
    let isReserved = false;
    for (const reserved of reservedNames) {
        if (typeof constantTimeCompare === 'function') {
            if (constantTimeCompare(reserved, normalizedInput)) {
                isReserved = true;
            }
        } else if (reserved === normalizedInput) {
            isReserved = true;
        }
    }

    if (isTaken || isReserved) {
        return { available: false, reason: 'taken' };
    }

    return { available: true, reason: null };
}

// Check if email is already taken
function isEmailTaken(email) {
    if (!email) return false;

    // Get taken emails from storage
    let takenEmails = [];
    try {
        const stored = localStorage.getItem('takenEmails');
        if (stored) {
            takenEmails = JSON.parse(stored) || [];
        }
    } catch (e) {
        takenEmails = [];
    }

    const normalizedInput = email.toLowerCase().trim();

    // Check if email exists in taken list
    for (const taken of takenEmails) {
        if (taken && taken.toLowerCase().trim() === normalizedInput) {
            return true;
        }
    }

    return false;
}

// Real-time validation for username
function validateUsernameField() {
    const input = document.getElementById('signup-username');
    const error = document.getElementById('signup-username-error');
    if (!input || !error) return;

    const username = input.value.trim();

    if (!username) {
        input.classList.remove('valid', 'invalid');
        error.textContent = '';
        error.classList.remove('show');
        return;
    }

    if (username.length < 3) {
        input.classList.remove('valid');
        input.classList.add('invalid');
        error.textContent = 'Username must be at least 3 characters';
        error.classList.add('show');
        return;
    }

    const availability = isUsernameAvailable(username);

    if (availability.available) {
        input.classList.remove('invalid');
        input.classList.add('valid');
        error.textContent = '';
        error.classList.remove('show');
    } else {
        input.classList.remove('valid');
        input.classList.add('invalid');
        error.textContent = availability.reason === 'taken' ? `"${username}" is already taken` : 'Invalid username';
        error.classList.add('show');
    }
}

// Real-time validation for email
function validateEmailField() {
    const input = document.getElementById('signup-email');
    const error = document.getElementById('signup-email-error');
    if (!input || !error) return;

    const email = input.value.trim();

    if (!email) {
        input.classList.remove('valid', 'invalid');
        error.textContent = '';
        error.classList.remove('show');
        return;
    }

    if (!isValidEmail(email)) {
        input.classList.remove('valid');
        input.classList.add('invalid');
        error.textContent = 'Please enter a valid email address';
        error.classList.add('show');
        return;
    }

    if (!isValidEmailDomain(email)) {
        input.classList.remove('valid');
        input.classList.add('invalid');
        error.textContent = 'Please use a valid email provider (Gmail, Yahoo, Outlook, etc.)';
        error.classList.add('show');
        return;
    }

    input.classList.remove('invalid');
    input.classList.add('valid');
    error.textContent = '';
    error.classList.remove('show');
}

// Real-time validation for password
function validatePasswordField() {
    const input = document.getElementById('signup-password');
    const error = document.getElementById('signup-password-error');
    if (!input || !error) return;

    const password = input.value;

    if (!password) {
        input.classList.remove('valid', 'invalid');
        error.textContent = '';
        error.classList.remove('show');
        // Also clear confirm password validation
        validateConfirmPasswordField();
        return;
    }

    const validation = isValidPassword(password);

    if (!validation.minLength) {
        input.classList.remove('valid');
        input.classList.add('invalid');
        error.textContent = 'Password must be at least 8 characters';
        error.classList.add('show');
    } else if (!validation.hasSpecialChar) {
        input.classList.remove('valid');
        input.classList.add('invalid');
        error.textContent = 'Password must include at least 1 special character';
        error.classList.add('show');
    } else {
        input.classList.remove('invalid');
        input.classList.add('valid');
        error.textContent = '';
        error.classList.remove('show');
    }

    // Also validate confirm password when password changes
    validateConfirmPasswordField();
}

// Real-time validation for confirm password
function validateConfirmPasswordField() {
    const passwordInput = document.getElementById('signup-password');
    const confirmInput = document.getElementById('signup-confirm-password');
    const error = document.getElementById('signup-confirm-error');
    if (!confirmInput || !error) return;

    const password = passwordInput?.value || '';
    const confirmPassword = confirmInput.value;

    if (!confirmPassword) {
        confirmInput.classList.remove('valid', 'invalid');
        error.textContent = '';
        error.classList.remove('show');
        return;
    }

    if (confirmPassword !== password) {
        confirmInput.classList.remove('valid');
        confirmInput.classList.add('invalid');
        error.textContent = 'Passwords do not match';
        error.classList.add('show');
    } else if (password && isValidPassword(password).valid) {
        confirmInput.classList.remove('invalid');
        confirmInput.classList.add('valid');
        error.textContent = '';
        error.classList.remove('show');
    } else {
        confirmInput.classList.remove('valid', 'invalid');
        error.textContent = '';
        error.classList.remove('show');
    }
}

// Initialize signup validation listeners
function initSignupValidation() {
    const usernameInput = document.getElementById('signup-username');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const confirmInput = document.getElementById('signup-confirm-password');

    if (usernameInput) {
        usernameInput.addEventListener('input', validateUsernameField);
        usernameInput.addEventListener('blur', validateUsernameField);
    }

    if (emailInput) {
        emailInput.addEventListener('input', validateEmailField);
        emailInput.addEventListener('blur', validateEmailField);
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', validatePasswordField);
        passwordInput.addEventListener('blur', validatePasswordField);
    }

    if (confirmInput) {
        confirmInput.addEventListener('input', validateConfirmPasswordField);
        confirmInput.addEventListener('blur', validateConfirmPasswordField);
    }
}

// Toggle password visibility
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input?.parentElement?.querySelector('.password-toggle');

    if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        // Update icon
        if (button) {
            button.innerHTML = isPassword ?
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>` :
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>`;
        }
    }
}

// Check if terms have been scrolled to the bottom
function checkTermsScroll() {
    const termsBox = document.getElementById('terms-box');
    const acceptCheckbox = document.getElementById('accept-terms');
    const scrollHint = document.getElementById('terms-scroll-hint');

    if (!termsBox || !acceptCheckbox) return;

    // Check if scrolled to near bottom (within 20px)
    const isAtBottom = termsBox.scrollHeight - termsBox.scrollTop - termsBox.clientHeight < 20;

    if (isAtBottom) {
        // Enable the checkbox
        acceptCheckbox.disabled = false;
        scrollHint?.classList.add('hidden');
    }
}

// Reset terms state when switching to signup
function resetTermsState() {
    const termsBox = document.getElementById('terms-box');
    const acceptCheckbox = document.getElementById('accept-terms');
    const submitBtn = document.getElementById('signup-submit-btn');
    const scrollHint = document.getElementById('terms-scroll-hint');

    if (termsBox) {
        termsBox.scrollTop = 0;
    }

    if (acceptCheckbox) {
        acceptCheckbox.checked = false;
        acceptCheckbox.disabled = true;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
    }

    scrollHint?.classList.remove('hidden');
}

// Handle terms checkbox change
function handleTermsCheckbox() {
    const acceptCheckbox = document.getElementById('accept-terms');
    const submitBtn = document.getElementById('signup-submit-btn');

    if (acceptCheckbox && submitBtn) {
        submitBtn.disabled = !acceptCheckbox.checked;
    }
}

// Initialize terms checkbox listener and signup validation
document.addEventListener('DOMContentLoaded', () => {
    const acceptCheckbox = document.getElementById('accept-terms');
    if (acceptCheckbox) {
        acceptCheckbox.addEventListener('change', handleTermsCheckbox);
    }

    // Initialize signup field validation
    initSignupValidation();
});

// Simulate login (replace with actual API)
async function simulateLogin(email, password, rememberMe) {
    // Check if email is locked out (5 failed attempts = 15 min lockout)
    if (isEmailLockedOut(email)) {
        showAuthError('Too many failed attempts, please wait or reset password', 'login');
        return;
    }

    // Check if Supabase is available
    if (typeof supabaseSignIn !== 'function') {
        showAuthError('Authentication service unavailable. Please refresh the page.', 'login');
        console.error('supabaseSignIn is not defined');
        return;
    }

    // Show loading state
    const submitBtn = document.querySelector('#login-form .auth-submit-btn');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.textContent = 'Signing in...';
        submitBtn.disabled = true;
    }

    try {
        // Call Supabase Auth
        const { data, error } = await supabaseSignIn(email, password);

        // Reset button
        if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }

        if (error) {
            // Record failed attempt
            const nowLockedOut = recordFailedAttempt(email);

            if (nowLockedOut) {
                showAuthError('Too many failed attempts, please wait or reset password', 'login');
            } else if (error.message.includes('Email not confirmed')) {
                showAuthError('Please check your email and confirm your account first', 'login');
            } else {
                // Show remaining attempts warning if getting close
                const remaining = getRemainingAttempts(email);
                if (remaining <= 2 && remaining > 0) {
                    showAuthError(`Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, 'login');
                } else {
                    showAuthError('Invalid email or password', 'login');
                }
            }
            return;
        }

        // IMPORTANT: Only proceed if we have a valid user from Supabase
        if (!data || !data.user || !data.user.id) {
            // Record failed attempt
            const nowLockedOut = recordFailedAttempt(email);

            if (nowLockedOut) {
                showAuthError('Too many failed attempts, please wait or reset password', 'login');
            } else {
                const remaining = getRemainingAttempts(email);
                if (remaining <= 2 && remaining > 0) {
                    showAuthError(`Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, 'login');
                } else {
                    showAuthError('Invalid email or password', 'login');
                }
            }
            return;
        }

        // Successful login - clear any failed attempts
        clearLoginAttempts(email);

        if (data.user) {
            // Get user profile from Supabase
            const { data: profile } = await supabaseGetProfile(data.user.id);

            const userData = {
                id: data.user.id,
                username: profile?.username || email.split('@')[0],
                email: data.user.email,
                avatar: profile?.avatar_url || null
            };

            // Save to localStorage for compatibility with existing code
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('supabaseUserId', data.user.id);
            localStorage.setItem('profileUsername', userData.username);
            localStorage.setItem('userEmail', userData.email);
            if (userData.avatar) {
                localStorage.setItem('profileAvatar', userData.avatar);
            }

            isAuthenticated = true;
            currentUserData = userData;

            // Track user's last active time
            updateUserLastActive(userData.username);

            // Update UI
            updateAuthUI(true, userData);

            // Close modal
            closeAuthModal();

            // Show success toast
            if (typeof showToast === 'function') {
                showToast(`Welcome back, ${userData.username}!`, 'success');
            }

            // Navigate to profile and open dropdown on login
            if (typeof window.navigateToView === 'function') {
                window.navigateToView('profile');
            }

            // Open the user dropdown after navigation completes
            setTimeout(() => {
                const navTitleUser = document.getElementById('nav-title-user');
                const dropdown = document.getElementById('nav-user-dropdown');
                if (navTitleUser) {
                    navTitleUser.classList.add('active');
                }
                if (dropdown) {
                    dropdown.classList.add('show');
                }
            }, 500);
        }
    } catch (err) {
        // Reset button
        if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
        showAuthError('An error occurred. Please try again.', 'login');
        console.error('Login error:', err);
    }
}

// Signup with Supabase Auth
async function simulateSignup(username, email, password) {
    // Check if Supabase is available
    if (typeof supabaseSignUp !== 'function') {
        showAuthError('Authentication service unavailable. Please refresh the page.', 'signup');
        console.error('supabaseSignUp is not defined');
        return;
    }

    // Show loading state
    const submitBtn = document.querySelector('#signup-panel .auth-submit-btn');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.textContent = 'Creating account...';
        submitBtn.disabled = true;
    }

    try {
        // Call Supabase Auth
        const { data, error } = await supabaseSignUp(email, password, username);

        // Reset button
        if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }

        if (error) {
            if (error.message.includes('already taken')) {
                showAuthError('Username already taken', 'signup');
            } else if (error.message.includes('already registered')) {
                showAuthError('This email is already registered', 'signup');
            } else {
                showAuthError(error.message || 'Signup failed. Please try again.', 'signup');
            }
            return;
        }

        if (data.user) {
            // Check if email confirmation is required
            if (data.user.identities && data.user.identities.length === 0) {
                // Email already exists
                showAuthError('This email is already registered', 'signup');
                return;
            }

            // Show success message - email confirmation required
            showAuthSuccess('Account created! Please check your email to confirm your account.', 'signup');

            // Also show a toast for visibility
            if (typeof showToast === 'function') {
                showToast('Check your email to confirm your account!', 'success', 5000);
            }

            // Close modal after delay
            setTimeout(() => {
                closeAuthModal();
            }, 3000);
        }
    } catch (err) {
        // Reset button
        if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
        showAuthError('An error occurred. Please try again.', 'signup');
        console.error('Signup error:', err);
    }
}

// Password reset with Supabase Auth
async function simulateForgotPassword(email) {
    // Show loading state
    const submitBtn = document.querySelector('#forgot-password-panel .auth-submit-btn');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
    }

    try {
        const { error } = await supabaseResetPassword(email);

        // Reset button
        if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }

        if (error) {
            showAuthError(error.message || 'Failed to send reset email', 'forgot-password');
            return;
        }

        // Clear any login lockout for this email - they'll be able to log in after resetting
        clearLoginAttempts(email);

        // Show success message
        showAuthSuccess('If an account exists with this email, you will receive a password reset link.', 'forgot-password');
    } catch (err) {
        // Reset button
        if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
        showAuthError('An error occurred. Please try again.', 'forgot-password');
        console.error('Password reset error:', err);
    }
}

// Clear sensitive data from localStorage on logout
function clearSensitiveData() {
    const sensitiveKeys = [
        'isLoggedIn', 'profileUsername', 'profileAvatar', 'profileBanner',
        'profileBio', 'followedUsers', 'dmConversations',
        'userFollowingLists', 'allUserProfiles', 'userEmail'
    ];
    sensitiveKeys.forEach(key => localStorage.removeItem(key));
}

// Logout
async function logout() {
    // Clear activity tracking interval
    if (activityInterval) {
        clearInterval(activityInterval);
        activityInterval = null;
    }

    // Sign out from Supabase
    try {
        await supabaseSignOut();
    } catch (err) {
        console.error('Supabase signout error:', err);
    }

    // Clear auth data and integrity hash
    localStorage.removeItem('psjAuth');
    localStorage.removeItem('psjAuthHash');

    // Clear sensitive user data
    clearSensitiveData();

    isAuthenticated = false;
    currentUserData = null;

    // Update UI
    updateAuthUI(false, null);

    // Update nav section (shows "Preset Junkies", hides username dropdown)
    if (typeof updateUserNavSection === 'function') {
        updateUserNavSection();
    }

    // Clear notification badges
    if (typeof updateNotificationBadge === 'function') {
        updateNotificationBadge();
    }
}

// Track user's last active time
function updateUserLastActive(username) {
    if (!username) return;
    const userLastActive = safeJSONParse(localStorage.getItem('userLastActive'), {});
    userLastActive[username] = Date.now();
    localStorage.setItem('userLastActive', JSON.stringify(userLastActive));
}

// Update current user's activity periodically (every 5 minutes while logged in)
function startActivityTracking() {
    const username = localStorage.getItem('profileUsername');
    if (username && localStorage.getItem('isLoggedIn') === 'true') {
        updateUserLastActive(username);
    }

    // Update every 5 minutes
    activityInterval = setInterval(() => {
        const currentUser = localStorage.getItem('profileUsername');
        if (currentUser && localStorage.getItem('isLoggedIn') === 'true') {
            updateUserLastActive(currentUser);
        }
    }, 5 * 60 * 1000);
}

// Start activity tracking on page load
document.addEventListener('DOMContentLoaded', startActivityTracking);

// Make function globally available
window.updateUserLastActive = updateUserLastActive;

// Social login handlers (placeholder - would integrate with OAuth)
function loginWithGoogle() {
    // TODO: Integrate with Google OAuth
    alert('Google login coming soon!');
}

function loginWithDiscord() {
    // TODO: Integrate with Discord OAuth
    alert('Discord login coming soon!');
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('auth-modal');
    if (e.target === modal) {
        closeAuthModal();
    }
});

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('auth-modal');
        if (modal && !modal.classList.contains('hidden')) {
            closeAuthModal();
        }
    }
});

// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', initAuth);

// Make functions globally available
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.showPasswordUpdateModal = showPasswordUpdateModal;
window.closePasswordUpdateModal = closePasswordUpdateModal;
window.handlePasswordUpdate = handlePasswordUpdate;
window.showAuthPanel = showAuthPanel;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleForgotPassword = handleForgotPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.logout = logout;
window.loginWithGoogle = loginWithGoogle;
window.loginWithDiscord = loginWithDiscord;
window.checkTermsScroll = checkTermsScroll;
