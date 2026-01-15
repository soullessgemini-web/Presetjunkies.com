// =============================================
// SUPABASE CLIENT - Preset Junkies
// =============================================

const SUPABASE_URL = 'https://unevbodorwwqrfzuigpu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuZXZib2Rvcnd3cXJmenVpZ3B1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjkxNTQsImV4cCI6MjA4MjcwNTE1NH0.rgDiapV2kAAhwTaXEHl3ScZVfubAJjm_NO6mEPswv8o';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// =============================================
// CENTRAL AUTH HELPER - Single Source of Truth
// =============================================

// Get current auth session from Supabase (THE authority for login state)
async function getAuthSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

// Check if user is authenticated (async - uses Supabase session)
async function checkAuthStatus() {
    const session = await getAuthSession();
    return !!session;
}

// Rehydrate auth state from Supabase on page load
async function rehydrateAuthState() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
        // User is authenticated - sync localStorage cache
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('supabaseUserId', session.user.id);
        document.body.classList.remove('guest-mode');

        // Load profile data from Supabase
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('username, avatar_url, banner_url, bio')
            .eq('id', session.user.id)
            .single();

        if (profile) {
            localStorage.setItem('profileUsername', profile.username || '');
            localStorage.setItem('profileAvatar', profile.avatar_url || '');
            localStorage.setItem('profileBanner', profile.banner_url || '');
            localStorage.setItem('profileBio', profile.bio || '');
        }
    } else {
        // No session - clear all auth-related localStorage
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('supabaseUserId');
        document.body.classList.add('guest-mode');
    }
}

// Listen for auth state changes
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('supabaseUserId', session.user.id);
        document.body.classList.remove('guest-mode');
    } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('supabaseUserId');
        document.body.classList.add('guest-mode');
    } else if (event === 'TOKEN_REFRESHED' && session) {
        // Token refreshed - ensure we're still marked as logged in
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('supabaseUserId', session.user.id);
    }
});

// Rehydrate on load
document.addEventListener('DOMContentLoaded', () => {
    rehydrateAuthState();
});

// Make auth helpers globally available
window.getAuthSession = getAuthSession;
window.checkAuthStatus = checkAuthStatus;
window.rehydrateAuthState = rehydrateAuthState;

// =============================================
// UI UTILITIES - Loading States & Toasts
// =============================================

// Show loading overlay on an element
function showLoading(elementOrSelector, message = 'Loading...') {
    const el = typeof elementOrSelector === 'string'
        ? document.querySelector(elementOrSelector)
        : elementOrSelector;
    if (!el) return;

    // Create loading overlay if it doesn't exist
    let overlay = el.querySelector('.supabase-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'supabase-loading-overlay';
        overlay.innerHTML = `
            <div class="supabase-loading-spinner"></div>
            <span class="supabase-loading-text">${message}</span>
        `;
        el.style.position = el.style.position || 'relative';
        el.appendChild(overlay);
    } else {
        overlay.querySelector('.supabase-loading-text').textContent = message;
        overlay.classList.remove('hidden');
    }
}

// Hide loading overlay
function hideLoading(elementOrSelector) {
    const el = typeof elementOrSelector === 'string'
        ? document.querySelector(elementOrSelector)
        : elementOrSelector;
    if (!el) return;

    const overlay = el.querySelector('.supabase-loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Show a toast notification
function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.supabase-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `supabase-toast supabase-toast-${type}`;

    const icons = {
        success: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>',
        error: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
        warning: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
        info: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
    };

    toast.innerHTML = `
        <span class="supabase-toast-icon">${icons[type] || icons.info}</span>
        <span class="supabase-toast-message">${message}</span>
        <button class="supabase-toast-close">&times;</button>
    `;

    document.body.appendChild(toast);

    // Close button handler
    toast.querySelector('.supabase-toast-close').addEventListener('click', () => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    });

    // Show animation
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto-hide
    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }

    return toast;
}

// Inject loading/toast styles if not present
function injectSupabaseStyles() {
    // Remove old styles if they exist to ensure updates are applied
    const existing = document.getElementById('supabase-ui-styles');
    if (existing) existing.remove();

    const styles = document.createElement('style');
    styles.id = 'supabase-ui-styles';
    styles.textContent = `
        .supabase-loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            border-radius: inherit;
        }
        .supabase-loading-overlay.hidden { display: none; }
        .supabase-loading-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid rgba(255,255,255,0.2);
            border-top-color: #a855f7;
            border-radius: 50%;
            animation: supabase-spin 0.8s linear infinite;
        }
        .supabase-loading-text {
            margin-top: 12px;
            color: #fff;
            font-size: 14px;
        }
        @keyframes supabase-spin {
            to { transform: rotate(360deg); }
        }
        .supabase-toast {
            position: fixed;
            top: 24px;
            right: 24px;
            transform: translateY(-100px);
            background: #1a1a1a;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 12px;
            padding: 16px 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            z-index: 10000;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            opacity: 0;
            transition: all 0.3s ease;
            width: 350px;
        }
        .supabase-toast.show { transform: translateY(0); opacity: 1; }
        .supabase-toast.hiding { transform: translateY(-100px); opacity: 0; }
        .supabase-toast-success { border-left: 4px solid #22c55e; }
        .supabase-toast-error { border-left: 4px solid #ef4444; }
        .supabase-toast-warning { border-left: 4px solid #f59e0b; }
        .supabase-toast-info { border-left: 4px solid #3b82f6; }
        .supabase-toast-icon { display: flex; }
        .supabase-toast-icon svg { width: 28px; height: 28px; }
        .supabase-toast-success .supabase-toast-icon { color: #22c55e; }
        .supabase-toast-error .supabase-toast-icon { color: #ef4444; }
        .supabase-toast-warning .supabase-toast-icon { color: #f59e0b; }
        .supabase-toast-info .supabase-toast-icon { color: #3b82f6; }
        .supabase-toast-message { color: #fff; font-size: 16px; flex: 1; font-weight: 500; }
        .supabase-toast-close {
            background: none;
            border: none;
            color: rgba(255,255,255,0.5);
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
        }
        .supabase-toast-close:hover { color: #fff; }
    `;
    document.head.appendChild(styles);
}

// Inject styles on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSupabaseStyles);
} else {
    injectSupabaseStyles();
}

// =============================================
// AUTH FUNCTIONS
// =============================================

// Sign up new user
async function supabaseSignUp(email, password, username) {
    // Check if username is taken
    const { data: existing } = await supabaseClient
        .from('profiles')
        .select('username')
        .ilike('username', username)
        .single();

    if (existing) {
        return { data: null, error: { message: 'Username already taken' } };
    }

    // Sign up with Supabase Auth
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { username }
        }
    });

    return { data, error };
}

// Sign in existing user
async function supabaseSignIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (!error && data.user) {
        // Update last active
        await supabaseClient
            .from('profiles')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', data.user.id);
    }

    return { data, error };
}

// Sign out
async function supabaseSignOut() {
    const { error } = await supabaseClient.auth.signOut();
    return { error };
}

// Update user's last active timestamp
async function supabaseUpdateLastActive() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    await supabaseClient
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', user.id);
}

// Get current session
async function supabaseGetSession() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    return { session, error };
}

// Get current user (uses getSession to avoid network calls that can cause logout)
async function supabaseGetUser() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    return { user: session?.user || null, error };
}

// Get user profile
async function supabaseGetProfile(userId) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    return { data, error };
}

// Get profile by username (only verified profiles are public)
async function supabaseGetProfileByUsername(username) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .ilike('username', username)
        .eq('email_verified', true)
        .single();

    return { data, error };
}

// Get profile by username for auth (doesn't filter by email_verified - needed for login)
async function supabaseGetProfileByUsernameForAuth(username) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, email, username')
        .ilike('username', username)
        .single();

    return { data, error };
}

// Check if username is taken (includes deleted accounts - usernames are permanently reserved)
async function supabaseCheckUsernameTaken(username) {
    // Check both current usernames and deleted_username (reserved from deleted accounts)
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id')
        .or(`username.ilike.${username},deleted_username.ilike.${username}`)
        .maybeSingle();

    if (error) {
        console.error('Error checking username:', error);
        return { taken: false, error };
    }

    return { taken: !!data, error: null };
}

// Check if email is taken (includes deleted accounts - emails are permanently reserved)
async function supabaseCheckEmailTaken(email) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle();

    if (error) {
        console.error('Error checking email:', error);
        return { taken: false, error };
    }

    return { taken: !!data, error: null };
}

// Update profile
async function supabaseUpdateProfile(userId, updates) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

    return { data, error };
}

// Get all profiles (for junkies page - only verified)
async function supabaseGetAllProfiles() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email_verified', true)
        .order('created_at', { ascending: false });

    return { data, error };
}

// Password reset
async function supabaseResetPassword(email) {
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
    });

    return { data, error };
}

// Update password (used after password recovery)
async function supabaseUpdatePassword(newPassword) {
    const { data, error } = await supabaseClient.auth.updateUser({
        password: newPassword
    });

    return { data, error };
}

// Listen for auth state changes
function supabaseOnAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

// =============================================
// STORAGE FUNCTIONS
// =============================================

// Upload file to storage
async function supabaseUploadFile(bucket, path, file) {
    console.log('supabaseUploadFile:', { bucket, path, fileName: file?.name, fileSize: file?.size });

    try {
        const { data, error } = await supabaseClient.storage
            .from(bucket)
            .upload(path, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) {
            console.error('Supabase storage upload error:', error);
            return { url: null, error };
        }

        console.log('Upload data:', data);

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from(bucket)
            .getPublicUrl(path);

        console.log('Public URL:', publicUrl);
        return { url: publicUrl, error: null };
    } catch (err) {
        console.error('supabaseUploadFile exception:', err);
        return { url: null, error: err };
    }
}

// Delete file from storage
async function supabaseDeleteFile(bucket, path) {
    const { error } = await supabaseClient.storage
        .from(bucket)
        .remove([path]);

    return { error };
}

// =============================================
// ITEMS FUNCTIONS
// =============================================

// Get items by category
async function supabaseGetItems(category, options = {}) {
    let query = supabaseClient
        .from('items')
        .select(`
            *,
            uploader:profiles!uploader_id(id, username, avatar_url, banner_url, bio)
        `)
        .eq('category', category)
        .order('created_at', { ascending: false });

    if (options.limit) {
        query = query.limit(options.limit);
    }
    if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;
    return { data, error };
}

// Get single item
async function supabaseGetItem(itemId) {
    const { data, error } = await supabaseClient
        .from('items')
        .select(`
            *,
            uploader:profiles!uploader_id(id, username, avatar_url, banner_url, bio)
        `)
        .eq('id', itemId)
        .single();

    return { data, error };
}

// Create item
async function supabaseCreateItem(item) {
    console.log('supabaseCreateItem:', item);

    try {
        const { data, error } = await supabaseClient
            .from('items')
            .insert(item)
            .select()
            .single();

        if (error) {
            console.error('supabaseCreateItem error:', error);
        } else {
            console.log('supabaseCreateItem success:', data);
        }

        return { data, error };
    } catch (err) {
        console.error('supabaseCreateItem exception:', err);
        return { data: null, error: err };
    }
}

// Update item
async function supabaseUpdateItem(itemId, updates) {
    const { data, error } = await supabaseClient
        .from('items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();

    return { data, error };
}

// Delete item
async function supabaseDeleteItem(itemId) {
    const { error } = await supabaseClient
        .from('items')
        .delete()
        .eq('id', itemId);

    return { error };
}

// Increment item counter (saves, shares, downloads)
async function supabaseIncrementCounter(itemId, field) {
    const { data, error } = await supabaseClient.rpc('increment_counter', {
        item_id: itemId,
        field_name: field
    });
    return { data, error };
}

// Decrement item counter (saves, shares, downloads)
async function supabaseDecrementCounter(itemId, field) {
    const { data, error } = await supabaseClient.rpc('decrement_counter', {
        item_id: itemId,
        field_name: field
    });
    return { data, error };
}

// =============================================
// LIKES FUNCTIONS
// =============================================

// Like an item
async function supabaseLikeItem(userId, itemId) {
    const { error } = await supabaseClient
        .from('item_likes')
        .insert({ user_id: userId, item_id: itemId });

    return { error };
}

// Unlike an item
async function supabaseUnlikeItem(userId, itemId) {
    const { error } = await supabaseClient
        .from('item_likes')
        .delete()
        .eq('user_id', userId)
        .eq('item_id', itemId);

    return { error };
}

// Check if user liked item
async function supabaseHasLiked(userId, itemId) {
    const { data, error } = await supabaseClient
        .from('item_likes')
        .select('user_id')
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .single();

    return { liked: !!data, error };
}

// Get user's liked items
async function supabaseGetUserLikes(userId) {
    const { data, error } = await supabaseClient
        .from('item_likes')
        .select('item_id')
        .eq('user_id', userId);

    return { data: data?.map(l => l.item_id) || [], error };
}

// =============================================
// LIBRARY FUNCTIONS
// =============================================

// Add to library
async function supabaseAddToLibrary(userId, itemId) {
    const { error } = await supabaseClient
        .from('user_library')
        .insert({ user_id: userId, item_id: itemId });

    return { error };
}

// Remove from library
async function supabaseRemoveFromLibrary(userId, itemId) {
    const { error } = await supabaseClient
        .from('user_library')
        .delete()
        .eq('user_id', userId)
        .eq('item_id', itemId);

    return { error };
}

// Get user's library
async function supabaseGetLibrary(userId) {
    const { data, error } = await supabaseClient
        .from('user_library')
        .select(`
            saved_at,
            item:items(*)
        `)
        .eq('user_id', userId)
        .order('saved_at', { ascending: false });

    return { data, error };
}

// =============================================
// FOLLOW FUNCTIONS
// =============================================

// Follow user
async function supabaseFollow(followerId, followingId) {
    const { error } = await supabaseClient
        .from('follows')
        .insert({ follower_id: followerId, following_id: followingId });

    return { error };
}

// Unfollow user
async function supabaseUnfollow(followerId, followingId) {
    const { error } = await supabaseClient
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);

    return { error };
}

// Check if following
async function supabaseIsFollowing(followerId, followingId) {
    const { data } = await supabaseClient
        .from('follows')
        .select('follower_id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .single();

    return !!data;
}

// Get followers
async function supabaseGetFollowers(userId) {
    const { data, error } = await supabaseClient
        .from('follows')
        .select(`
            follower:profiles!follower_id(id, username, avatar_url, is_deleted)
        `)
        .eq('following_id', userId);

    // Filter out deleted users
    const filtered = data?.map(f => f.follower).filter(f => {
        if (!f) return false;
        if (f.is_deleted) return false;
        if (f.username?.startsWith('[Deleted')) return false;
        return true;
    }) || [];
    return { data: filtered, error };
}

// Get following
async function supabaseGetFollowing(userId) {
    const { data, error } = await supabaseClient
        .from('follows')
        .select(`
            following:profiles!following_id(id, username, avatar_url, is_deleted)
        `)
        .eq('follower_id', userId);

    // Filter out deleted users
    const filtered = data?.map(f => f.following).filter(f => {
        if (!f) return false;
        if (f.is_deleted) return false;
        if (f.username?.startsWith('[Deleted')) return false;
        return true;
    }) || [];
    return { data: filtered, error };
}

// Get follower count
async function supabaseGetFollowerCount(userId) {
    const { count, error } = await supabaseClient
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);

    return { count: count || 0, error };
}

// Get following count
async function supabaseGetFollowingCount(userId) {
    const { count, error } = await supabaseClient
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);

    return { count: count || 0, error };
}

// =============================================
// COMMENTS FUNCTIONS
// =============================================

// Get comments for item
async function supabaseGetComments(itemId) {
    const { data, error } = await supabaseClient
        .from('comments')
        .select(`
            *,
            user:profiles!user_id(id, username, avatar_url)
        `)
        .eq('item_id', itemId)
        .order('created_at', { ascending: true });

    return { data, error };
}

// Add comment
async function supabaseAddComment(itemId, userId, content) {
    const { data, error } = await supabaseClient
        .from('comments')
        .insert({ item_id: itemId, user_id: userId, content })
        .select(`
            *,
            user:profiles!user_id(id, username, avatar_url)
        `)
        .single();

    return { data, error };
}

// Update comment
async function supabaseUpdateComment(commentId, content) {
    const { data, error } = await supabaseClient
        .from('comments')
        .update({ content, is_edited: true })
        .eq('id', commentId)
        .select()
        .single();

    return { data, error };
}

// Delete comment (only owner can delete their own comment)
async function supabaseDeleteComment(commentId) {
    // Get current user
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user?.id) {
        return { error: { message: 'You must be logged in to delete comments' } };
    }

    const { error } = await supabaseClient
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', session.user.id);

    return { error };
}

// =============================================
// ROOMS FUNCTIONS
// =============================================

// Get all rooms
async function supabaseGetRooms() {
    const { data, error } = await supabaseClient
        .from('rooms')
        .select(`
            *,
            creator:profiles!creator_id(id, username, avatar_url)
        `)
        .order('created_at', { ascending: true });

    return { data, error };
}

// Get room by ID
async function supabaseGetRoom(roomId) {
    const { data, error } = await supabaseClient
        .from('rooms')
        .select(`
            *,
            creator:profiles!creator_id(id, username, avatar_url)
        `)
        .eq('id', roomId)
        .single();

    return { data, error };
}

// Create room
async function supabaseCreateRoom(room) {
    const { data, error } = await supabaseClient
        .from('rooms')
        .insert(room)
        .select()
        .single();

    return { data, error };
}

// Update room
async function supabaseUpdateRoom(roomId, updates) {
    const { data, error } = await supabaseClient
        .from('rooms')
        .update(updates)
        .eq('id', roomId)
        .select()
        .single();

    return { data, error };
}

// Delete room
async function supabaseDeleteRoom(roomId) {
    const { error } = await supabaseClient
        .from('rooms')
        .delete()
        .eq('id', roomId);

    return { error };
}

// Join room
async function supabaseJoinRoom(roomId, userId, role = 'member') {
    // Use upsert to avoid duplicate key errors if user is already a member
    const { error } = await supabaseClient
        .from('room_members')
        .upsert(
            { room_id: roomId, user_id: userId, role },
            { onConflict: 'room_id,user_id', ignoreDuplicates: true }
        );

    if (!error) {
        // Update member count
        await supabaseClient.rpc('increment_room_members', { room_id: roomId });
    }

    return { error };
}

// Leave room
async function supabaseLeaveRoom(roomId, userId) {
    const { error } = await supabaseClient
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId);

    return { error };
}

// Get room members
async function supabaseGetRoomMembers(roomId) {
    const { data, error } = await supabaseClient
        .from('room_members')
        .select(`
            *,
            user:profiles!user_id(id, username, avatar_url, last_active_at)
        `)
        .eq('room_id', roomId);

    return { data, error };
}

// Check if user is member
async function supabaseIsRoomMember(roomId, userId) {
    const { data } = await supabaseClient
        .from('room_members')
        .select('user_id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .single();

    return !!data;
}

// =============================================
// ROOM MESSAGES FUNCTIONS
// =============================================

// Get room messages
async function supabaseGetRoomMessages(roomId, limit = 100) {
    const { data, error } = await supabaseClient
        .from('room_messages')
        .select(`
            *,
            author:profiles!author_id(id, username, avatar_url),
            reply_to:room_messages!reply_to_id(id, content, author:profiles!author_id(username))
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit);

    // Reverse to get chronological order
    return { data: data?.reverse() || [], error };
}

// Send room message
async function supabaseSendRoomMessage(roomId, authorId, content, replyToId = null, imageUrl = null, audioUrl = null, audioFilename = null) {
    const insertData = {
        room_id: roomId,
        author_id: authorId,
        content,
        reply_to_id: replyToId,
        image_url: imageUrl
    };

    // Add audio fields if present
    if (audioUrl) {
        insertData.audio_url = audioUrl;
        insertData.audio_filename = audioFilename;
    }

    const { data, error } = await supabaseClient
        .from('room_messages')
        .insert(insertData)
        .select(`
            *,
            author:profiles!author_id(id, username, avatar_url)
        `)
        .single();

    return { data, error };
}

// Edit room message
async function supabaseEditRoomMessage(messageId, content) {
    const { data, error } = await supabaseClient
        .from('room_messages')
        .update({ content, is_edited: true })
        .eq('id', messageId)
        .select()
        .single();

    return { data, error };
}

// Delete room message
async function supabaseDeleteRoomMessage(messageId) {
    const { error } = await supabaseClient
        .from('room_messages')
        .delete()
        .eq('id', messageId);

    return { error };
}

// =============================================
// MESSAGE REACTIONS
// =============================================

// Add reaction
async function supabaseAddReaction(messageId, userId, emoji) {
    const { error } = await supabaseClient
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: userId, emoji });

    return { error };
}

// Remove reaction
async function supabaseRemoveReaction(messageId, userId, emoji) {
    const { error } = await supabaseClient
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji);

    return { error };
}

// Get message reactions
async function supabaseGetReactions(messageId) {
    const { data, error } = await supabaseClient
        .from('message_reactions')
        .select(`
            emoji,
            user:profiles!user_id(id, username)
        `)
        .eq('message_id', messageId);

    return { data, error };
}


// =============================================
// NOTIFICATIONS
// =============================================

// Get user notifications
async function supabaseGetNotifications(userId, limit = 50) {
    const { data, error } = await supabaseClient
        .from('notifications')
        .select(`
            *,
            actor:profiles!actor_id(id, username, avatar_url),
            item:items(id, title, category)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    return { data, error };
}

// Get notifications for a specific item (to show who liked/saved/shared/downloaded)
async function supabaseGetItemNotifications(itemId) {
    const { data, error } = await supabaseClient
        .from('notifications')
        .select(`
            *,
            actor:profiles!actor_id(id, username, avatar_url)
        `)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });

    return { data, error };
}

// Mark notification as read
async function supabaseMarkNotificationRead(notificationId) {
    const { error } = await supabaseClient
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

    return { error };
}

// Mark all notifications as read
async function supabaseMarkAllNotificationsRead(userId) {
    const { error } = await supabaseClient
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    return { error };
}

// Get unread count
async function supabaseGetUnreadCount(userId) {
    const { count, error } = await supabaseClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    return { count: count || 0, error };
}

// Create notification
async function supabaseCreateNotification(notification) {
    const { data, error } = await supabaseClient
        .from('notifications')
        .insert(notification)
        .select()
        .single();

    return { data, error };
}

// =============================================
// REALTIME SUBSCRIPTIONS
// =============================================

// Subscribe to room messages
function supabaseSubscribeToRoom(roomId, onMessage) {
    return supabaseClient
        .channel(`room:${roomId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'room_messages',
            filter: `room_id=eq.${roomId}`
        }, async (payload) => {
            // Fetch full message with author info
            const { data } = await supabaseGetRoomMessages(roomId, 1);
            if (data && data.length > 0) {
                onMessage(data[data.length - 1]);
            }
        })
        .subscribe();
}

// Subscribe to notifications
function supabaseSubscribeToNotifications(userId, onNotification) {
    return supabaseClient
        .channel(`notifications:${userId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            onNotification(payload.new);
        })
        .subscribe();
}


// Subscribe to item changes (for realtime sync across browsers)
function supabaseSubscribeToItemChanges(onDelete, onInsert) {
    return supabaseClient
        .channel('items-changes')
        .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'items'
        }, (payload) => {
            if (onDelete) onDelete(payload.old);
        })
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'items'
        }, (payload) => {
            if (onInsert) onInsert(payload.new);
        })
        .subscribe();
}

// Subscribe to profile changes (for deleted users sync)
function supabaseSubscribeToProfileChanges(onUpdate) {
    return supabaseClient
        .channel('profiles-changes')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles'
        }, (payload) => {
            onUpdate(payload.new);
        })
        .subscribe();
}

// Subscribe to room changes (for room deletion sync across browsers)
function supabaseSubscribeToRoomChanges(onDelete, onUpdate) {
    return supabaseClient
        .channel('rooms-changes')
        .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'rooms'
        }, (payload) => {
            if (onDelete) onDelete(payload.old);
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms'
        }, (payload) => {
            if (onUpdate) onUpdate(payload.new);
        })
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'rooms'
        }, (payload) => {
            // Reload rooms when a new room is created
            if (typeof loadRoomsFromSupabase === 'function') {
                loadRoomsFromSupabase();
            }
        })
        .subscribe();
}

// Unsubscribe from channel
function supabaseUnsubscribe(channel) {
    supabaseClient.removeChannel(channel);
}

// =============================================
// USERS DIRECTORY (JUNKIES)
// =============================================

// Get all users with stats (only verified)
async function supabaseGetAllUsers() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select(`
            id,
            username,
            avatar_url,
            created_at
        `)
        .eq('email_verified', true)
        .order('created_at', { ascending: false });

    return { data, error };
}

// =============================================
// DATA MIGRATION HELPER
// =============================================

// Migrate localStorage data to Supabase for existing users
async function migrateLocalStorageToSupabase() {
    const { user, error: authError } = await supabaseGetUser();
    if (authError || !user) {
        console.log('Migration requires authenticated user');
        return { success: false, error: 'Not authenticated' };
    }

    const results = {
        profile: false,
        follows: 0,
        library: 0,
        errors: []
    };

    try {
        // 1. Migrate profile data
        const profileUsername = localStorage.getItem('profileUsername');
        const profileBio = localStorage.getItem('profileBio');
        const profileAvatar = localStorage.getItem('profileAvatar');
        const profileBanner = localStorage.getItem('profileBanner');

        if (profileUsername || profileBio) {
            const updates = {};
            if (profileBio) updates.bio = profileBio;
            // Note: Avatar/Banner URLs from localStorage are local blob URLs, can't migrate those
            // User would need to re-upload

            const { error } = await supabaseUpdateProfile(user.id, updates);
            if (!error) results.profile = true;
            else results.errors.push('Profile: ' + error.message);
        }

        // 2. Migrate followed users
        const followedUsers = JSON.parse(localStorage.getItem('followedUsers') || '[]');
        for (const username of followedUsers) {
            try {
                const { data: targetProfile } = await supabaseGetProfileByUsername(username);
                if (targetProfile && targetProfile.id) {
                    const { error } = await supabaseFollow(user.id, targetProfile.id);
                    if (!error) results.follows++;
                }
            } catch (e) {
                results.errors.push('Follow ' + username + ': ' + e.message);
            }
        }

        // 3. Migrate library items (if they exist in Supabase)
        const library = JSON.parse(localStorage.getItem('presetJunkiesLibrary') || '[]');
        for (const item of library) {
            try {
                // Only migrate if item ID is numeric (Supabase item)
                if (typeof item.id === 'number') {
                    const { error } = await supabaseAddToLibrary(user.id, item.id);
                    if (!error) results.library++;
                }
            } catch (e) {
                results.errors.push('Library item: ' + e.message);
            }
        }

        console.log('Migration results:', results);

        // Show summary toast
        if (typeof showToast === 'function') {
            const parts = [];
            if (results.profile) parts.push('profile');
            if (results.follows > 0) parts.push(`${results.follows} follows`);
            if (results.library > 0) parts.push(`${results.library} library items`);

            if (parts.length > 0) {
                showToast(`Migrated: ${parts.join(', ')}`, 'success', 5000);
            } else {
                showToast('No data to migrate', 'info');
            }
        }

        return { success: true, results };

    } catch (err) {
        console.error('Migration error:', err);
        results.errors.push(err.message);
        return { success: false, error: err.message, results };
    }
}

// Check if user has localStorage data that could be migrated
function hasLocalDataToMigrate() {
    const checks = [
        localStorage.getItem('profileBio'),
        localStorage.getItem('followedUsers'),
        localStorage.getItem('presetJunkiesLibrary')
    ];

    return checks.some(data => {
        if (!data) return false;
        if (data === '[]' || data === '{}') return false;
        return true;
    });
}

// Delete user account - anonymize profile but keep content
async function supabaseDeleteUserAccount() {
    try {
        const { user } = await supabaseGetUser();
        console.log('Delete account - user:', user?.id);

        if (!user) {
            return { error: { message: 'Not logged in' } };
        }

        const userId = user.id;

        // 1. Get current username before deleting
        const { data: currentProfile } = await supabaseClient
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .single();

        // 2. Anonymize the profile and mark as deleted
        // Store original username in deleted_username to keep it reserved
        console.log('Anonymizing profile...');
        const { error: profileError } = await supabaseClient
            .from('profiles')
            .update({
                username: '[Deleted]',
                deleted_username: currentProfile?.username || null,
                bio: null,
                avatar_url: null,
                banner_url: null,
                email_verified: false,
                is_deleted: true
            })
            .eq('id', userId);

        if (profileError) {
            console.error('Error anonymizing profile:', profileError);
            return { error: { message: 'Failed to anonymize profile: ' + profileError.message } };
        }
        console.log('Profile anonymized successfully');

        // 2. Delete private data that shouldn't persist
        console.log('Deleting room memberships...');
        await supabaseClient.from('room_members').delete().eq('user_id', userId);

        console.log('Deleting notifications...');
        await supabaseClient.from('notifications').delete().eq('user_id', userId);

        console.log('Deleting library...');
        await supabaseClient.from('library').delete().eq('user_id', userId);

        console.log('Deleting follows...');
        await supabaseClient.from('follows').delete().eq('follower_id', userId);
        await supabaseClient.from('follows').delete().eq('following_id', userId);

        console.log('Deleting likes...');
        await supabaseClient.from('likes').delete().eq('user_id', userId);

        // 3. Keep but anonymize:
        // - Items (uploads) - kept, will show "[Deleted]" as uploader
        // - Comments - kept, will show "[Deleted]" as author
        // - Room messages - kept, will show "[Deleted]" as author

        // 4. Sign out
        console.log('Signing out...');
        await supabaseClient.auth.signOut();

        console.log('Account deletion complete');
        return { error: null };
    } catch (err) {
        console.error('Error deleting user account:', err);
        return { error: { message: err.message || 'Failed to delete account' } };
    }
}

// =============================================
// EXPORT FOR GLOBAL ACCESS
// =============================================

window.supabaseClient = supabaseClient;
window.supabaseDeleteUserAccount = supabaseDeleteUserAccount;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showToast = showToast;
window.supabaseSignUp = supabaseSignUp;
window.supabaseSignIn = supabaseSignIn;
window.supabaseSignOut = supabaseSignOut;
window.supabaseUpdateLastActive = supabaseUpdateLastActive;
window.supabaseGetSession = supabaseGetSession;
window.supabaseGetUser = supabaseGetUser;
window.supabaseGetProfile = supabaseGetProfile;
window.supabaseGetProfileByUsername = supabaseGetProfileByUsername;
window.supabaseGetProfileByUsernameForAuth = supabaseGetProfileByUsernameForAuth;
window.supabaseCheckUsernameTaken = supabaseCheckUsernameTaken;
window.supabaseCheckEmailTaken = supabaseCheckEmailTaken;
window.supabaseUpdateProfile = supabaseUpdateProfile;
window.supabaseGetAllProfiles = supabaseGetAllProfiles;
window.supabaseResetPassword = supabaseResetPassword;
window.supabaseUpdatePassword = supabaseUpdatePassword;
window.supabaseOnAuthStateChange = supabaseOnAuthStateChange;
window.supabaseUploadFile = supabaseUploadFile;
window.supabaseDeleteFile = supabaseDeleteFile;
window.supabaseGetItems = supabaseGetItems;
window.supabaseGetItem = supabaseGetItem;
window.supabaseCreateItem = supabaseCreateItem;
window.supabaseUpdateItem = supabaseUpdateItem;
window.supabaseDeleteItem = supabaseDeleteItem;
window.supabaseIncrementCounter = supabaseIncrementCounter;
window.supabaseDecrementCounter = supabaseDecrementCounter;
window.supabaseLikeItem = supabaseLikeItem;
window.supabaseUnlikeItem = supabaseUnlikeItem;
window.supabaseHasLiked = supabaseHasLiked;
window.supabaseGetUserLikes = supabaseGetUserLikes;
window.supabaseAddToLibrary = supabaseAddToLibrary;
window.supabaseRemoveFromLibrary = supabaseRemoveFromLibrary;
window.supabaseGetLibrary = supabaseGetLibrary;
window.supabaseFollow = supabaseFollow;
window.supabaseUnfollow = supabaseUnfollow;
window.supabaseIsFollowing = supabaseIsFollowing;
window.supabaseGetFollowers = supabaseGetFollowers;
window.supabaseGetFollowing = supabaseGetFollowing;
window.supabaseGetFollowerCount = supabaseGetFollowerCount;
window.supabaseGetFollowingCount = supabaseGetFollowingCount;
window.supabaseGetComments = supabaseGetComments;
window.supabaseAddComment = supabaseAddComment;
window.supabaseUpdateComment = supabaseUpdateComment;
window.supabaseDeleteComment = supabaseDeleteComment;
window.supabaseGetRooms = supabaseGetRooms;
window.supabaseGetRoom = supabaseGetRoom;
window.supabaseCreateRoom = supabaseCreateRoom;
window.supabaseUpdateRoom = supabaseUpdateRoom;
window.supabaseDeleteRoom = supabaseDeleteRoom;
window.supabaseJoinRoom = supabaseJoinRoom;
window.supabaseLeaveRoom = supabaseLeaveRoom;
window.supabaseGetRoomMembers = supabaseGetRoomMembers;
window.supabaseIsRoomMember = supabaseIsRoomMember;
window.supabaseGetRoomMessages = supabaseGetRoomMessages;
window.supabaseSendRoomMessage = supabaseSendRoomMessage;
window.supabaseEditRoomMessage = supabaseEditRoomMessage;
window.supabaseDeleteRoomMessage = supabaseDeleteRoomMessage;
window.supabaseAddReaction = supabaseAddReaction;
window.supabaseRemoveReaction = supabaseRemoveReaction;
window.supabaseGetReactions = supabaseGetReactions;
window.supabaseGetNotifications = supabaseGetNotifications;
window.supabaseGetItemNotifications = supabaseGetItemNotifications;
window.supabaseMarkNotificationRead = supabaseMarkNotificationRead;
window.supabaseMarkAllNotificationsRead = supabaseMarkAllNotificationsRead;
window.supabaseGetUnreadCount = supabaseGetUnreadCount;
window.supabaseCreateNotification = supabaseCreateNotification;
window.supabaseSubscribeToRoom = supabaseSubscribeToRoom;
window.supabaseSubscribeToNotifications = supabaseSubscribeToNotifications;
window.supabaseSubscribeToItemChanges = supabaseSubscribeToItemChanges;
window.supabaseSubscribeToProfileChanges = supabaseSubscribeToProfileChanges;
window.supabaseSubscribeToRoomChanges = supabaseSubscribeToRoomChanges;
window.supabaseUnsubscribe = supabaseUnsubscribe;
window.supabaseGetAllUsers = supabaseGetAllUsers;
window.migrateLocalStorageToSupabase = migrateLocalStorageToSupabase;
window.hasLocalDataToMigrate = hasLocalDataToMigrate;

// =============================================
// ADMIN FUNCTIONS - Moderation
// =============================================

// Admin delete item (sound, preset, etc.)
async function supabaseAdminDeleteItem(itemId, category) {
    // Check if user is admin
    if (typeof isAdmin !== 'function' || !isAdmin()) {
        return { error: { message: 'Admin access required' } };
    }

    try {
        console.log('Admin deleting item:', itemId, category);

        // Delete associated data first (likes, comments, library entries)
        // Use correct table names
        const likesResult = await supabaseClient.from('item_likes').delete().eq('item_id', itemId);
        console.log('Deleted likes:', likesResult);

        const commentsResult = await supabaseClient.from('comments').delete().eq('item_id', itemId);
        console.log('Deleted comments:', commentsResult);

        const libraryResult = await supabaseClient.from('user_library').delete().eq('item_id', itemId);
        console.log('Deleted library entries:', libraryResult);

        // Delete the item itself
        const { error } = await supabaseClient
            .from('items')
            .delete()
            .eq('id', itemId);

        console.log('Delete item result:', { error });

        if (error) {
            console.error('Error deleting item:', error);
            return { error };
        }

        // Also remove from local items array if it exists
        if (typeof items !== 'undefined' && category && items[category]) {
            const idx = items[category].findIndex(item => String(item.id) === String(itemId));
            if (idx > -1) {
                items[category].splice(idx, 1);
            }
        }

        return { error: null };
    } catch (err) {
        console.error('Error in supabaseAdminDeleteItem:', err);
        return { error: { message: err.message } };
    }
}

// Admin delete user profile (full deletion including content)
async function supabaseAdminDeleteUser(userId) {
    // Check if user is admin
    if (typeof isAdmin !== 'function' || !isAdmin()) {
        return { error: { message: 'Admin access required' } };
    }

    try {
        // Delete all user's data - use correct table names
        await supabaseClient.from('room_members').delete().eq('user_id', userId);
        await supabaseClient.from('notifications').delete().eq('user_id', userId);
        await supabaseClient.from('user_library').delete().eq('user_id', userId);
        await supabaseClient.from('follows').delete().eq('follower_id', userId);
        await supabaseClient.from('follows').delete().eq('following_id', userId);
        await supabaseClient.from('item_likes').delete().eq('user_id', userId);
        await supabaseClient.from('comments').delete().eq('user_id', userId);

        // Anonymize profile instead of deleting (to preserve content integrity)
        // Use unique deleted username to avoid constraint violation
        const deletedUsername = `[Deleted_${Date.now()}]`;
        const { error } = await supabaseClient
            .from('profiles')
            .update({
                username: deletedUsername,
                bio: null,
                avatar_url: null,
                banner_url: null
            })
            .eq('id', userId);

        if (error) {
            console.error('Error anonymizing profile:', error);
            return { error };
        }

        return { error: null };
    } catch (err) {
        console.error('Error in supabaseAdminDeleteUser:', err);
        return { error: { message: err.message } };
    }
}

// Admin delete room
async function supabaseAdminDeleteRoom(roomId) {
    // Check if user is admin
    if (typeof isAdmin !== 'function' || !isAdmin()) {
        return { error: { message: 'Admin access required' } };
    }

    try {
        // Delete room messages first
        await supabaseClient.from('room_messages').delete().eq('room_id', roomId);
        // Delete room members
        await supabaseClient.from('room_members').delete().eq('room_id', roomId);
        // Delete the room
        const { error } = await supabaseClient.from('rooms').delete().eq('id', roomId);

        if (error) {
            console.error('Error deleting room:', error);
            return { error };
        }

        return { error: null };
    } catch (err) {
        console.error('Error in supabaseAdminDeleteRoom:', err);
        return { error: { message: err.message } };
    }
}

// Admin delete any comment
async function supabaseAdminDeleteComment(commentId) {
    // Check if user is admin
    if (typeof isAdmin !== 'function' || !isAdmin()) {
        return { error: { message: 'Admin access required' } };
    }

    const { error } = await supabaseClient
        .from('comments')
        .delete()
        .eq('id', commentId);

    return { error };
}

window.supabaseAdminDeleteItem = supabaseAdminDeleteItem;
window.supabaseAdminDeleteUser = supabaseAdminDeleteUser;
window.supabaseAdminDeleteRoom = supabaseAdminDeleteRoom;
window.supabaseAdminDeleteComment = supabaseAdminDeleteComment;

console.log('Supabase client initialized');
