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
    if (document.getElementById('supabase-ui-styles')) return;

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
            bottom: 24px;
            right: 24px;
            background: #1c1c1e;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s ease;
            max-width: 400px;
        }
        .supabase-toast.show { transform: translateY(0); opacity: 1; }
        .supabase-toast.hiding { transform: translateY(100px); opacity: 0; }
        .supabase-toast-success { border-left: 3px solid #22c55e; }
        .supabase-toast-error { border-left: 3px solid #ef4444; }
        .supabase-toast-warning { border-left: 3px solid #f59e0b; }
        .supabase-toast-info { border-left: 3px solid #3b82f6; }
        .supabase-toast-icon { display: flex; }
        .supabase-toast-success .supabase-toast-icon { color: #22c55e; }
        .supabase-toast-error .supabase-toast-icon { color: #ef4444; }
        .supabase-toast-warning .supabase-toast-icon { color: #f59e0b; }
        .supabase-toast-info .supabase-toast-icon { color: #3b82f6; }
        .supabase-toast-message { color: #fff; font-size: 14px; flex: 1; }
        .supabase-toast-close {
            background: none;
            border: none;
            color: rgba(255,255,255,0.5);
            font-size: 20px;
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

// Get current session
async function supabaseGetSession() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    return { session, error };
}

// Get current user
async function supabaseGetUser() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    return { user, error };
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

// Get profile by username
async function supabaseGetProfileByUsername(username) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .ilike('username', username)
        .single();

    return { data, error };
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

// Get all profiles (for junkies page)
async function supabaseGetAllProfiles() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
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

// Increment a counter field on an item (downloads, saves, shares, etc.)
async function supabaseIncrementCounter(itemId, field) {
    // First get the current value
    const { data: item, error: fetchError } = await supabaseClient
        .from('items')
        .select(field)
        .eq('id', itemId)
        .single();

    if (fetchError) {
        console.error('Error fetching item for increment:', fetchError);
        return { error: fetchError };
    }

    const currentValue = item?.[field] || 0;
    const newValue = currentValue + 1;

    // Update with the incremented value
    const { data, error } = await supabaseClient
        .from('items')
        .update({ [field]: newValue })
        .eq('id', itemId)
        .select()
        .single();

    if (error) {
        console.error('Error incrementing counter:', error);
    }

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
            follower:profiles!follower_id(id, username, avatar_url)
        `)
        .eq('following_id', userId);

    return { data: data?.map(f => f.follower) || [], error };
}

// Get following
async function supabaseGetFollowing(userId) {
    const { data, error } = await supabaseClient
        .from('follows')
        .select(`
            following:profiles!following_id(id, username, avatar_url)
        `)
        .eq('follower_id', userId);

    return { data: data?.map(f => f.following) || [], error };
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

// Delete comment
async function supabaseDeleteComment(commentId) {
    const { error } = await supabaseClient
        .from('comments')
        .delete()
        .eq('id', commentId);

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
    const { error } = await supabaseClient
        .from('room_members')
        .insert({ room_id: roomId, user_id: userId, role });

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
            user:profiles!user_id(id, username, avatar_url)
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
        reply_to_id: replyToId
    };

    // Only add image/audio if provided (columns may not exist in all setups)
    if (imageUrl) insertData.image_url = imageUrl;
    if (audioUrl) insertData.audio_url = audioUrl;
    if (audioFilename) insertData.audio_filename = audioFilename;

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
// DIRECT MESSAGES
// =============================================

// Get or create a DM conversation between two users
async function supabaseGetOrCreateDmConversation(userId1, userId2) {
    // First try to find existing conversation
    const { data: existing, error: findError } = await supabaseClient
        .from('dm_participants')
        .select('conversation_id')
        .eq('user_id', userId1);

    if (!findError && existing) {
        for (const p of existing) {
            const { data: other } = await supabaseClient
                .from('dm_participants')
                .select('user_id')
                .eq('conversation_id', p.conversation_id)
                .eq('user_id', userId2)
                .single();

            if (other) {
                return { conversationId: p.conversation_id, error: null };
            }
        }
    }

    // Create new conversation
    const { data: newConv, error: createError } = await supabaseClient
        .from('dm_conversations')
        .insert({})
        .select()
        .single();

    if (createError) return { conversationId: null, error: createError };

    // Add both participants
    const { error: partError } = await supabaseClient
        .from('dm_participants')
        .insert([
            { conversation_id: newConv.id, user_id: userId1 },
            { conversation_id: newConv.id, user_id: userId2 }
        ]);

    if (partError) return { conversationId: null, error: partError };

    return { conversationId: newConv.id, error: null };
}

// Get user's DM conversations
async function supabaseGetDmConversations(userId) {
    const { data, error } = await supabaseClient
        .from('dm_participants')
        .select(`
            conversation_id,
            last_read_at,
            conversation:dm_conversations(id, updated_at)
        `)
        .eq('user_id', userId)
        .order('conversation(updated_at)', { ascending: false });

    if (error) return { data: null, error };

    // Get other participants for each conversation
    const conversations = [];
    for (const p of data || []) {
        const { data: others } = await supabaseClient
            .from('dm_participants')
            .select('user:profiles!user_id(id, username, avatar_url)')
            .eq('conversation_id', p.conversation_id)
            .neq('user_id', userId);

        const otherUser = others?.[0]?.user;
        conversations.push({
            id: p.conversation_id,
            otherUser,
            lastReadAt: p.last_read_at,
            updatedAt: p.conversation?.updated_at
        });
    }

    return { data: conversations, error: null };
}

// Get DM messages for a conversation
async function supabaseGetDmMessages(conversationId, limit = 100) {
    const { data, error } = await supabaseClient
        .from('dm_messages')
        .select(`
            *,
            sender:profiles!sender_id(id, username, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

    return { data, error };
}

// Send a DM message
async function supabaseSendDmMessage(conversationId, senderId, content, imageUrl = null) {
    const { data, error } = await supabaseClient
        .from('dm_messages')
        .insert({
            conversation_id: conversationId,
            sender_id: senderId,
            content,
            image_url: imageUrl
        })
        .select()
        .single();

    if (!error) {
        // Update conversation timestamp
        await supabaseClient
            .from('dm_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
    }

    return { data, error };
}

// Mark DM conversation as read
async function supabaseMarkDmRead(conversationId, userId) {
    const { error } = await supabaseClient
        .from('dm_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

    return { error };
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

// Subscribe to DM messages for a conversation
function supabaseSubscribeToDM(conversationId, onMessage) {
    console.log('Setting up DM subscription for:', conversationId);

    const channel = supabaseClient
        .channel(`dm:${conversationId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'dm_messages',
            filter: `conversation_id=eq.${conversationId}`
        }, async (payload) => {
            console.log('DM realtime event received:', payload);
            // Fetch full message with sender info
            const { data, error } = await supabaseClient
                .from('dm_messages')
                .select(`
                    *,
                    sender:profiles!sender_id(id, username, avatar_url)
                `)
                .eq('id', payload.new.id)
                .single();

            if (error) {
                console.error('Error fetching DM message details:', error);
            }
            if (data) {
                console.log('DM message fetched:', data);
                onMessage(data);
            }
        })
        .subscribe((status) => {
            console.log('DM subscription status:', status);
        });

    return channel;
}

// Unsubscribe from channel
function supabaseUnsubscribe(channel) {
    supabaseClient.removeChannel(channel);
}

// =============================================
// USERS DIRECTORY (JUNKIES)
// =============================================

// Get all users with stats
async function supabaseGetAllUsers() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select(`
            id,
            username,
            avatar_url,
            created_at
        `)
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

// =============================================
// EXPORT FOR GLOBAL ACCESS
// =============================================

window.supabaseClient = supabaseClient;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showToast = showToast;
window.supabaseSignUp = supabaseSignUp;
window.supabaseSignIn = supabaseSignIn;
window.supabaseSignOut = supabaseSignOut;
window.supabaseGetSession = supabaseGetSession;
window.supabaseGetUser = supabaseGetUser;
window.supabaseGetProfile = supabaseGetProfile;
window.supabaseGetProfileByUsername = supabaseGetProfileByUsername;
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
window.supabaseGetOrCreateDmConversation = supabaseGetOrCreateDmConversation;
window.supabaseGetDmConversations = supabaseGetDmConversations;
window.supabaseGetDmMessages = supabaseGetDmMessages;
window.supabaseSendDmMessage = supabaseSendDmMessage;
window.supabaseMarkDmRead = supabaseMarkDmRead;
window.supabaseGetNotifications = supabaseGetNotifications;
window.supabaseMarkNotificationRead = supabaseMarkNotificationRead;
window.supabaseMarkAllNotificationsRead = supabaseMarkAllNotificationsRead;
window.supabaseGetUnreadCount = supabaseGetUnreadCount;
window.supabaseCreateNotification = supabaseCreateNotification;
window.supabaseSubscribeToRoom = supabaseSubscribeToRoom;
window.supabaseSubscribeToNotifications = supabaseSubscribeToNotifications;
window.supabaseSubscribeToDM = supabaseSubscribeToDM;
window.supabaseUnsubscribe = supabaseUnsubscribe;
window.supabaseGetAllUsers = supabaseGetAllUsers;
window.migrateLocalStorageToSupabase = migrateLocalStorageToSupabase;
window.hasLocalDataToMigrate = hasLocalDataToMigrate;

console.log('Supabase client initialized');

