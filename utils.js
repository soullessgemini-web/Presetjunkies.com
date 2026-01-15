// ===== UTILITY FUNCTIONS =====

// ===== SECURITY FUNCTIONS =====

/**
 * Escapes HTML entities to prevent XSS attacks
 * @param {string} text - The text to escape
 * @returns {string} - Escaped text safe for innerHTML
 */
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Strips HTML tags from text
 * @param {string} text - The text to strip
 * @returns {string} - Text without HTML tags
 */
function stripHTML(text) {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, '');
}

/**
 * Checks if text contains HTML tags
 * @param {string} text - The text to check
 * @returns {boolean} - True if HTML tags found
 */
function containsHTML(text) {
    if (!text) return false;
    return /<[^>]*>/.test(text);
}

/**
 * Escapes a string for safe use in JavaScript string literals (onclick handlers, etc.)
 * Prevents breaking out of JS strings via quotes or backslashes
 * @param {string} text - The text to escape
 * @returns {string} - Escaped text safe for JS string context
 */
function escapeJSString(text) {
    if (!text) return '';
    return String(text)
        .replace(/\\/g, '\\\\')   // Escape backslashes first
        .replace(/'/g, "\\'")     // Escape single quotes
        .replace(/"/g, '\\"')     // Escape double quotes
        .replace(/\n/g, '\\n')    // Escape newlines
        .replace(/\r/g, '\\r')    // Escape carriage returns
        .replace(/\t/g, '\\t');   // Escape tabs
}

/**
 * Escapes a string for safe use in HTML attribute values
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string safe for attribute context
 */
function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Escapes special regex characters to prevent ReDoS attacks
 * @param {string} str - The string to escape for use in regex
 * @returns {string} - Escaped string safe for regex context
 */
function escapeRegex(str) {
    if (!str) return '';
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escapes a string for safe use in CSS selectors (querySelector)
 * Prevents selector injection attacks
 * @param {string} str - The string to escape for selector context
 * @returns {string} - Escaped string safe for selector attribute values
 */
function escapeSelector(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/["\\]/g, '\\$&');
}

/**
 * Validates a URL for safe use in src attributes
 * Rejects javascript:, data:, and other dangerous protocols
 * @param {string} url - The URL to validate
 * @returns {object} - { valid: boolean, error: string|null }
 */
function validateURL(url) {
    if (!url || typeof url !== 'string') {
        return { valid: false, error: 'Invalid URL' };
    }

    const trimmed = url.trim().toLowerCase();

    // Block dangerous protocols (data: allowed for FileReader uploads)
    const dangerousProtocols = ['javascript:', 'vbscript:', 'file:'];
    for (const protocol of dangerousProtocols) {
        if (trimmed.startsWith(protocol)) {
            return { valid: false, error: 'Invalid URL protocol' };
        }
    }

    // Allow relative URLs, http, https, blob, and data (for FileReader)
    if (trimmed.startsWith('/') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('blob:') ||
        trimmed.startsWith('data:')) {
        return { valid: true, error: null };
    }

    // Block anything else that looks like a protocol
    if (/^[a-z]+:/i.test(trimmed)) {
        return { valid: false, error: 'Invalid URL protocol' };
    }

    // Allow relative paths
    return { valid: true, error: null };
}

/**
 * Sanitizes a URL for use in src/href attributes
 * Returns empty string if invalid
 * @param {string} url - The URL to sanitize
 * @returns {string} - Safe URL or empty string
 */
function sanitizeURL(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();

    // Block javascript: and vbscript: URLs (case-insensitive)
    if (/^(javascript|vbscript):/i.test(trimmed)) {
        return '';
    }

    // Block data: URLs except safe base64 image/audio types (no SVG - can contain scripts)
    if (trimmed.toLowerCase().startsWith('data:')) {
        // Only allow specific safe image and audio types with base64 encoding
        if (!/^data:(image\/(png|jpeg|jpg|gif|webp)|audio\/(mpeg|wav|mp3|x-wav));base64,/i.test(trimmed)) {
            return '';
        }
    }

    const result = validateURL(url);
    return result.valid ? url : '';
}

/**
 * Sanitizes a CSS value to prevent CSS injection attacks
 * @param {string} value - The CSS value to sanitize
 * @returns {string} - Safe CSS value or empty string
 */
function sanitizeCSSValue(value) {
    if (!value || typeof value !== 'string') return '';
    // Remove dangerous CSS patterns
    let safe = value
        .replace(/expression\s*\(/gi, '')  // IE expression()
        .replace(/javascript\s*:/gi, '')
        .replace(/vbscript\s*:/gi, '')
        .replace(/behavior\s*:/gi, '')     // IE behaviors
        .replace(/@import/gi, '')
        .replace(/url\s*\(/gi, 'url(')     // Normalize url()
        .replace(/[<>'"]/g, '');           // Remove HTML chars
    return safe;
}

/**
 * Sanitizes a URL for use in CSS url() context
 * Escapes special characters that could break out of the url()
 * @param {string} url - The URL to sanitize
 * @returns {string} - Safe URL for CSS context or empty string
 */
function sanitizeCSSUrl(url) {
    const safeUrl = sanitizeURL(url);
    if (!safeUrl) return '';
    // Escape characters that could break CSS url() context
    return safeUrl.replace(/[()'"\\]/g, '\\$&');
}

/**
 * Creates a safe img element HTML string
 * @param {string} url - Image URL
 * @param {string} alt - Alt text
 * @returns {string} - Safe img HTML or empty string
 */
function createSafeImage(url, alt) {
    const safeUrl = sanitizeURL(url);
    const safeAlt = escapeAttr(alt || '');
    if (!safeUrl) return '';
    return `<img src="${escapeAttr(safeUrl)}" alt="${safeAlt}" loading="lazy">`
}

// ===== RESERVED USERNAMES =====
const RESERVED_USERNAMES = [
    'admin', 'administrator', 'moderator', 'mod', 'system', 'support',
    'preset', 'junkies', 'presetjunkies', 'presets', 'official',
    'help', 'info', 'contact', 'root', 'superuser', 'guest'
];

// ===== RATE LIMITING =====
const rateLimiters = {};

/**
 * Simple rate limiter for spam prevention
 * @param {string} key - Unique identifier for the action
 * @param {number} delayMs - Minimum delay between actions (default 1000ms)
 * @returns {boolean} - True if action is allowed, false if rate limited
 */
function rateLimit(key, delayMs = 1000) {
    const now = Date.now();
    if (rateLimiters[key] && now - rateLimiters[key] < delayMs) {
        return false;
    }
    rateLimiters[key] = now;
    return true;
}

// ===== SAFE JSON PARSING =====

/**
 * Safely parse JSON with prototype pollution protection
 * @param {string} str - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} - Parsed object or default value
 */
function safeJSONParse(str, defaultValue = null) {
    if (!str || typeof str !== 'string') return defaultValue;
    try {
        const parsed = JSON.parse(str);
        // Prevent prototype pollution by removing dangerous keys
        if (parsed && typeof parsed === 'object') {
            cleanPrototypePollution(parsed);
        }
        return parsed;
    } catch (e) {
        // Silent fail - return default
        return defaultValue;
    }
}

/**
 * Recursively clean prototype pollution keys from an object
 * Enhanced with circular reference protection and higher depth limit
 */
function cleanPrototypePollution(obj, depth = 0, seen = null) {
    // Initialize WeakSet on first call to track circular references
    if (seen === null) seen = new WeakSet();

    if (depth > 20 || !obj || typeof obj !== 'object') return;

    // Prevent infinite loops from circular references
    if (seen.has(obj)) return;
    seen.add(obj);

    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    for (const key of dangerousKeys) {
        if (key in obj) {
            try { delete obj[key]; } catch (e) { /* frozen object */ }
        }
    }

    // Also clean constructor.prototype pattern
    if (obj.constructor && obj.constructor !== Object && obj.constructor !== Array) {
        try { delete obj.constructor; } catch (e) { /* frozen object */ }
    }

    // Recursively clean nested objects and arrays
    const keys = Object.keys(obj);
    for (const key of keys) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            cleanPrototypePollution(obj[key], depth + 1, seen);
        }
    }
}

// ===== SAFE LOCALSTORAGE =====

/**
 * Safely set localStorage with quota error handling
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 * @returns {boolean} - True if successful
 */
function safeLocalStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            // Storage quota exceeded - fail silently
            return false;
        }
        throw e;
    }
}

// ===== USERNAME NORMALIZATION =====

/**
 * Normalize username for consistent comparison (prevents homograph attacks)
 * Enhanced: removes zero-width characters and other confusables
 * @param {string} username - Username to normalize
 * @returns {string} - Normalized username
 */
function normalizeUsername(username) {
    if (!username) return '';
    let normalized = username.normalize('NFKC').toLowerCase().trim();
    // Remove zero-width characters (used in homograph attacks)
    normalized = normalized.replace(/[\u200B-\u200D\u200E\u200F\uFEFF\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u2060-\u206F\u3164\uFFA0]/g, '');
    return normalized;
}

// ===== FILENAME SANITIZATION =====

/**
 * Sanitize filename to prevent CSV injection and path traversal
 * @param {string} filename - Filename to sanitize
 * @returns {string} - Safe filename
 */
function sanitizeFilename(filename) {
    if (!filename) return 'download';
    // Remove path traversal characters and dangerous chars
    let safe = String(filename)
        .replace(/\.\./g, '')
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .trim();
    // Prevent CSV injection - prefix if starts with =, +, -, @, tab, carriage return
    if (/^[=+\-@\t\r]/.test(safe)) {
        safe = '_' + safe;
    }
    return safe || 'download';
}

// ===== CONSTANT TIME COMPARISON =====

/**
 * Constant-time string comparison to prevent timing attacks
 * Fixed: No early return on length mismatch (prevents length leak)
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - True if equal
 */
function constantTimeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;

    // Pad shorter string to prevent length leak via timing
    const maxLen = Math.max(a.length, b.length);
    const paddedA = a.padEnd(maxLen, '\0');
    const paddedB = b.padEnd(maxLen, '\0');

    // Length difference contributes to result (ensures different lengths always fail)
    let result = a.length ^ b.length;
    for (let i = 0; i < maxLen; i++) {
        result |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i);
    }
    return result === 0;
}

// ===== ROOM ID VALIDATION =====

/**
 * Validate room ID to prevent path traversal and prototype pollution
 * @param {string} id - Room ID to validate
 * @returns {boolean} - True if valid
 */
function isValidRoomId(id) {
    if (!id || typeof id !== 'string') return false;
    // Only allow alphanumeric, dash, underscore (no dots, slashes, etc.)
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return false;
    // Block prototype pollution attempts
    const dangerous = ['__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'toString', 'valueOf'];
    if (dangerous.includes(id.toLowerCase())) return false;
    return true;
}

// ===== SECURE RANDOM ID =====

/**
 * Generate cryptographically secure random ID
 * @param {number} length - Number of bytes (output will be 2x in hex)
 * @returns {string} - Hex string
 */
function secureRandomId(length = 16) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// ===== DOM CLOBBERING PREVENTION =====

/**
 * Safe getElementById that prevents DOM clobbering attacks
 * Verifies the returned element is actually an Element with matching id
 * @param {string} id - Element ID
 * @returns {Element|null} - Element or null
 */
function safeGetElementById(id) {
    const el = document.getElementById(id);
    // Verify it's actually an Element (not a form/input with that name)
    if (el && el instanceof Element && el.id === id) {
        return el;
    }
    return null;
}

// ===== AUTH INTEGRITY =====

/**
 * Improved hash function for integrity checking
 * Uses multiple rounds and mixing for better tamper resistance
 * Note: Still not cryptographically secure - real security comes from backend
 * @param {string} str - String to hash
 * @returns {string} - Hash string
 */
function simpleHash(str) {
    if (!str) return '';

    // Use multiple hash values for better distribution
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        // MurmurHash3-like mixing
        h1 = Math.imul(h1 ^ char, 2654435761);
        h2 = Math.imul(h2 ^ char, 1597334677);
        // Rotate and mix
        h1 = (h1 << 13) | (h1 >>> 19);
        h2 = (h2 << 17) | (h2 >>> 15);
        h1 ^= h2;
        h2 ^= h1;
    }

    // Final mixing
    h1 ^= str.length;
    h2 ^= str.length;
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 = Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);

    // Combine into final hash
    const combined = (h1 >>> 0).toString(16).padStart(8, '0') +
                     (h2 >>> 0).toString(16).padStart(8, '0');
    return combined;
}

/**
 * Async SHA-256 hash for secure operations (use with backend)
 * @param {string} str - String to hash
 * @returns {Promise<string>} - SHA-256 hash as hex string
 */
async function sha256Hash(str) {
    if (!str) return '';
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.error('SHA-256 hash failed:', e);
        return '';
    }
}

// ===== ACTION LOCKING =====

/**
 * Prevents race conditions by locking actions temporarily
 */
const actionLocks = new Set();

/**
 * Execute function with lock to prevent race conditions
 * Returns a wrapped function that will only execute if not locked
 * @param {string} actionId - Unique action identifier
 * @param {Function} fn - Function to execute
 * @param {number} lockDuration - How long to maintain lock (ms)
 * @returns {Function} - Wrapped function that respects the lock
 */
function withActionLock(actionId, fn, lockDuration = 300) {
    return (...args) => {
        if (actionLocks.has(actionId)) {
            return; // Already locked, do nothing
        }
        actionLocks.add(actionId);
        try {
            return fn(...args);
        } finally {
            setTimeout(() => actionLocks.delete(actionId), lockDuration);
        }
    };
}

/**
 * Check if an action is currently locked
 * @param {string} actionId - Action identifier
 * @returns {boolean} - True if locked
 */
function isActionLocked(actionId) {
    return actionLocks.has(actionId);
}

// ===== FILE SIZE VALIDATION =====

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Validate file size
 * @param {File} file - File to validate
 * @param {number} maxSize - Maximum size in bytes
 * @returns {boolean} - True if valid
 */
function validateFileSize(file, maxSize = MAX_FILE_SIZE) {
    if (!file || !file.size) return false;
    if (file.size > maxSize) {
        alert(`File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`);
        return false;
    }
    return true;
}

// ===== INPUT LENGTH LIMITS =====
const INPUT_LIMITS = {
    MESSAGE: 2000,
    ROOM_NAME: 50,
    ROOM_DESCRIPTION: 500,
    USERNAME: 18,
    BIO: 500,
    COMMENT: 1000,
    TITLE: 100,
    TAG: 10
};

// ===== SESSION TOKEN (CSRF-like protection) =====

/**
 * Initialize session token on page load
 */
(function initSessionToken() {
    if (!sessionStorage.getItem('csrfToken')) {
        sessionStorage.setItem('csrfToken', secureRandomId(32));
    }
})();

/**
 * Get the current session token
 * @returns {string} - Session token
 */
function getSessionToken() {
    return sessionStorage.getItem('csrfToken') || '';
}

/**
 * Validate that a session exists
 * @returns {boolean} - True if session is valid
 */
function validateSession() {
    return !!sessionStorage.getItem('csrfToken');
}

// ===== SAFE EMOJI PARSING =====

/**
 * Safely parse emojis, ensuring output doesn't contain dangerous content
 * Defense-in-depth: escape HTML first, then parse emojis on safe text
 * Uses DOM parser for robust validation instead of regex
 * @param {string} text - Text to parse for emojis
 * @returns {string} - Text with emojis replaced with img tags, HTML escaped
 */
function safeParseEmojis(text) {
    // First escape all HTML to prevent XSS
    const escaped = escapeHTML(text);

    // If parseEmojis doesn't exist, return escaped text
    if (typeof window.parseEmojis !== 'function') return escaped;

    // Parse emojis on the already-escaped text
    const result = window.parseEmojis(escaped);

    // Use DOM parser for robust validation
    try {
        const temp = document.createElement('div');
        temp.innerHTML = result;

        // Check for any non-img elements (text nodes are ok)
        const allElements = temp.querySelectorAll('*');
        for (const el of allElements) {
            if (el.tagName !== 'IMG') {
                return escaped; // Non-img element found
            }
        }

        // Validate each img tag
        const imgs = temp.querySelectorAll('img');
        for (const img of imgs) {
            const src = img.getAttribute('src') || '';
            // Only allow images from Emojies folder
            if (!src.startsWith('Emojies/')) {
                return escaped;
            }
            // Check for dangerous attributes
            for (const attr of img.attributes) {
                const name = attr.name.toLowerCase();
                // Block event handlers and dangerous attributes
                if (name.startsWith('on') || name === 'onerror' || name === 'onload') {
                    return escaped;
                }
            }
        }

        return result;
    } catch (e) {
        // If DOM parsing fails, return escaped version
        return escaped;
    }
}

// Make security functions globally available
window.escapeHTML = escapeHTML;
window.stripHTML = stripHTML;
window.containsHTML = containsHTML;
window.validateURL = validateURL;
window.sanitizeURL = sanitizeURL;
window.escapeAttr = escapeAttr;
window.escapeRegex = escapeRegex;
window.escapeSelector = escapeSelector;
window.RESERVED_USERNAMES = RESERVED_USERNAMES;
window.rateLimit = rateLimit;
window.safeJSONParse = safeJSONParse;
window.safeLocalStorageSet = safeLocalStorageSet;
window.normalizeUsername = normalizeUsername;
window.sanitizeFilename = sanitizeFilename;
window.constantTimeCompare = constantTimeCompare;
window.isValidRoomId = isValidRoomId;
window.secureRandomId = secureRandomId;
window.safeGetElementById = safeGetElementById;
window.simpleHash = simpleHash;
window.withActionLock = withActionLock;
window.isActionLocked = isActionLocked;
window.validateFileSize = validateFileSize;
window.MAX_FILE_SIZE = MAX_FILE_SIZE;
window.MAX_IMAGE_SIZE = MAX_IMAGE_SIZE;
window.INPUT_LIMITS = INPUT_LIMITS;
window.sanitizeCSSValue = sanitizeCSSValue;
window.sanitizeCSSUrl = sanitizeCSSUrl;
window.createSafeImage = createSafeImage;
window.getSessionToken = getSessionToken;
window.validateSession = validateSession;
window.safeParseEmojis = safeParseEmojis;

function formatCount(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeAgo(date) {
    // Handle various input types
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return 'Unknown';

    const now = new Date();
    const diff = now - d;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return years === 1 ? '1 year ago' : `${years} years ago`;
    if (months > 0) return months === 1 ? '1 month ago' : `${months} months ago`;
    if (weeks > 0) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    if (days > 0) return days === 1 ? '1 day ago' : `${days} days ago`;
    if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    if (minutes > 0) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    return 'just now';
}

function darkenColor(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ===== INPUT VALIDATION =====

// Known music terms and abbreviations that should be allowed
const allowedMusicTerms = [
    '808', '303', '909', '707', '606', '727', '626', '505',
    'tr808', 'tr909', 'tr303', 'tb303', 'cr78', 'lm1', 'dmx',
    'mpc', 'sp1200', 'sp404', 'mc303', 'mc505', 'mc909',
    'vst', 'daw', 'bpm', 'edm', 'dnb', 'dj', 'eq', 'lfo', 'adsr',
    'midi', 'wav', 'mp3', 'flac', 'aiff', 'ogg',
    'synth', 'bass', 'kick', 'snare', 'hats', 'hihat', 'clap',
    'sfx', 'fx', 'vox', 'dj', 'mc', 'emcee', 'rap', 'rnb', 'r&b'
];

// Common keyboard patterns to block
const keyboardPatterns = [
    'qwerty', 'qwert', 'werty', 'asdf', 'asdfg', 'sdfgh', 'dfghj', 'fghjk', 'ghjkl',
    'zxcv', 'zxcvb', 'xcvbn', 'cvbnm',
    'qazwsx', 'wsxedc', 'edcrfv', 'rfvtgb', 'tgbyhn', 'yhnujm',
    '1234', '12345', '123456', '2345', '3456', '4567', '5678', '6789', '7890',
    'abcd', 'abcde', 'bcdef', 'cdefg', 'defgh', 'efghi', 'fghij',
    'aaaa', 'bbbb', 'cccc', 'dddd', 'eeee', 'ffff', 'gggg', 'hhhh', 'iiii',
    'jjjj', 'kkkk', 'llll', 'mmmm', 'nnnn', 'oooo', 'pppp', 'qqqq', 'rrrr',
    'ssss', 'tttt', 'uuuu', 'vvvv', 'wwww', 'xxxx', 'yyyy', 'zzzz',
    '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999'
];

/**
 * Validates input text to block keyboard mashing/gibberish
 * @param {string} text - The text to validate
 * @param {string} fieldType - Type of field: 'username', 'title', 'tag', 'description'
 * @returns {object} - { valid: boolean, error: string|null }
 */
function validateInput(text, fieldType = 'text') {
    if (!text || typeof text !== 'string') {
        return { valid: false, error: `Please enter a valid ${fieldType}` };
    }

    const trimmed = text.trim();

    // Empty check
    if (trimmed.length === 0) {
        return { valid: false, error: `Please enter a valid ${fieldType}` };
    }

    // No special characters in room names
    if (fieldType === 'room name') {
        const specialChars = /[!@#$%^&*()+=\[\]{};':"\\|,.<>\/?`~]/;
        if (specialChars.test(trimmed)) {
            return { valid: false, error: 'Room names cannot contain special characters' };
        }
    }

    // Short strings (under 4 chars) are allowed
    if (trimmed.length < 4) {
        return { valid: true, error: null };
    }

    const lower = trimmed.toLowerCase();

    // Check if it's a known music term (exact match or contains)
    for (const term of allowedMusicTerms) {
        if (lower === term || lower.includes(term)) {
            // Still do basic sanity checks on the rest
            const withoutTerm = lower.replace(new RegExp(term, 'g'), '');
            if (withoutTerm.length < 4) {
                return { valid: true, error: null };
            }
        }
    }

    // Split into words for word-by-word analysis
    const words = trimmed.split(/[\s\-_.,!?]+/).filter(w => w.length > 0);

    for (const word of words) {
        const wordLower = word.toLowerCase();

        // Skip short words
        if (wordLower.length < 4) continue;

        // Skip if it's a known music term
        if (allowedMusicTerms.includes(wordLower)) continue;

        // Check for keyboard patterns
        for (const pattern of keyboardPatterns) {
            if (wordLower.includes(pattern)) {
                return { valid: false, error: `Please enter a valid ${fieldType}` };
            }
        }

        // Check for more than 4 consonants in a row
        if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(wordLower)) {
            return { valid: false, error: `Please enter a valid ${fieldType}` };
        }

        // Check for more than 4 numbers in a row (unless it's a music term like 808)
        const numberMatches = wordLower.match(/\d{5,}/g);
        if (numberMatches) {
            // Check if any long number sequence isn't a known term
            for (const numSeq of numberMatches) {
                if (!allowedMusicTerms.some(term => term.includes(numSeq))) {
                    return { valid: false, error: `Please enter a valid ${fieldType}` };
                }
            }
        }

        // Check for no vowels in strings longer than 4 characters
        // Only check alphabetic portions
        const alphaOnly = wordLower.replace(/[^a-z]/g, '');
        if (alphaOnly.length > 4 && !/[aeiou]/i.test(alphaOnly)) {
            return { valid: false, error: `Please enter a valid ${fieldType}` };
        }

        // Check for excessive repeated characters (more than 3 of the same)
        if (/(.)\1{3,}/i.test(wordLower)) {
            return { valid: false, error: `Please enter a valid ${fieldType}` };
        }
    }

    return { valid: true, error: null };
}

/**
 * Validates username specifically
 */
function validateUsername(username) {
    // Reject HTML tags
    if (containsHTML(username)) {
        return { valid: false, error: 'Username cannot contain HTML' };
    }

    const trimmed = username.trim();

    // Check length (max 18 characters)
    if (trimmed.length > 18) {
        return { valid: false, error: 'Username cannot exceed 18 characters' };
    }

    // No spaces allowed
    if (/\s/.test(trimmed)) {
        return { valid: false, error: 'Username cannot contain spaces' };
    }

    // No special characters except _ and -
    const invalidChars = /[!@#$%^&*()+=\[\]{};':"\\|,.<>\/?`~]/;
    if (invalidChars.test(trimmed)) {
        return { valid: false, error: 'Username cannot contain special characters' };
    }

    // Cannot start or end with _ or -
    if (/^[-_]/.test(trimmed) || /[-_]$/.test(trimmed)) {
        return { valid: false, error: 'Username cannot start or end with - or _' };
    }

    return validateInput(username, 'username');
}

/**
 * Validates title specifically
 */
function validateTitle(title) {
    // Reject HTML tags
    if (containsHTML(title)) {
        return { valid: false, error: 'Title cannot contain HTML' };
    }
    return validateInput(title, 'title');
}

/**
 * Validates tag specifically
 */
function validateTag(tag) {
    // Reject HTML tags
    if (containsHTML(tag)) {
        return { valid: false, error: 'Tag cannot contain HTML' };
    }
    return validateInput(tag, 'tag');
}

/**
 * Validates description specifically
 */
function validateDescription(description) {
    // Reject HTML tags
    if (containsHTML(description)) {
        return { valid: false, error: 'Description cannot contain HTML' };
    }
    // Descriptions are more lenient - just check each word
    return validateInput(description, 'description');
}
