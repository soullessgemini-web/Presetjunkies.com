// ===== GLOBAL STATE =====

// Emoji list - add new emojis here
const emojiList = [
    { code: 'pepeheart', file: '1211-pepeheart.png' },
    { code: 'pepeblunt', file: '1222-pepeblunt.png' },
    { code: 'pepeban', file: '1650-pepeban.png' },
    { code: 'pepehmmmm', file: '4008-pepehmmmm.png' },
    { code: 'pepe-king', file: '11998-pepe-king.png' },
    { code: 'nerd-pepe', file: '30945-nerd-pepe.gif' },
    { code: 'peepoyikes', file: '39782-peepoyikes-enh.png' },
    { code: 'peepo-wonder', file: '43717-peepo-old-wonder.gif' },
    { code: 'pepeyes', file: '44680-pepeyes.png' },
    { code: 'clownpepe', file: '48301-clownpepe.png' },
    { code: 'pepedaddy', file: '52925-pepedaddy.gif' },
    { code: 'laugh', file: '58730-laugh.png' },
    { code: 'pepefinger', file: '66904-pepefinger.png' },
    { code: 'binary', file: '67734-binary.gif' },
    { code: 'pepejam', file: '67908-pepejam.gif' },
    { code: 'no', file: '73309-no.png' },
    { code: 'judgepepe', file: '73508-judgepepe.png' },
    { code: 'pepethumbdown', file: '75385-pepethumbdown.png' },
    { code: 'angrypepe', file: '76015-angrypepe.png' },
    { code: 'okpepe', file: '79964-okpepe.png' },
    { code: 'pepepunch', file: '84760-pepepunch.png' },
    { code: 'stronge', file: '86523-stronge.png' },
    { code: 'pepe-disappear', file: '94864-pepe-disappear.gif' },
    { code: 'gasm', file: '96985-gasm.gif' },
    { code: 'pepejam2', file: '9812-pepejam2.gif' },
    { code: 'tears', file: '98212-tears.png' },
    { code: 'wtfpepe', file: '98318-wtfpepe.png' },
    { code: 'pepecringe', file: '98807-pepecringeeffect.gif' },
    { code: 'pic1', file: '117538-pic1.png' },
    { code: 'pepe-rockstar', file: '18075-pepe-rockstar.gif' },
    { code: 'pepes', file: '269965-pepes.gif' },
    { code: 'pepetyping', file: '291042-pepetyping.gif' },
    { code: 'pepeee', file: '313518-pepeee.png' },
    { code: 's4ic1d4', file: '371760-s4ic1d4.png' },
    { code: 'simp', file: '550567-simp.gif' },
    { code: 'pepeclowntrain', file: '59958-pepeclownblobtrain.gif' },
    { code: 'sleepypepe', file: '733056-sleepypepe.png' },
    { code: 'idk', file: '799926-idk.png' },
    { code: 'ok', file: '829312-ok.png' }
];

// Data storage - load from cache immediately for instant display
const itemsCache = safeJSONParse(localStorage.getItem('presetJunkiesItems'), null);
const items = itemsCache || { presets: [], samples: [], midi: [], projects: [], originals: [] };
let library = safeJSONParse(localStorage.getItem('presetJunkiesLibrary'), []);
let roomImagesCache = safeJSONParse(localStorage.getItem('roomImagesCache'), {});
let itemsLoaded = !!itemsCache; // Mark as loaded if cache exists

// Load items from Supabase
async function loadItemsFromSupabase() {
    console.log('Loading items from Supabase...');
    try {
        const categories = ['presets', 'samples', 'midi', 'projects', 'originals'];

        for (const category of categories) {
            const { data, error } = await supabaseGetItems(category, { limit: 100 });

            if (error) {
                console.error(`Error loading ${category}:`, error);
                continue;
            }

            console.log(`Loaded ${category} from Supabase:`, data?.length || 0);

            if (data) {
                // Transform Supabase items to match local format (handles empty array too)
                items[category] = data.map(item => ({
                    id: item.id,
                    title: item.title,
                    description: item.description || '',
                    type: item.metadata?.type || '',
                    vst: item.metadata?.vst || '',
                    daw: item.metadata?.daw || '',
                    key: item.metadata?.key || '',
                    scale: item.metadata?.scale || '',
                    bpm: item.metadata?.bpm || '',
                    tempo: item.metadata?.tempo || '',
                    genre: item.metadata?.genre || '',
                    loopType: item.metadata?.loop_type || '',
                    sampleType: item.metadata?.sample_type || '',
                    tags: item.metadata?.tags || [],
                    midiNotes: item.metadata?.midi_notes || null,
                    hearts: item.hearts || 0,
                    downloads: item.downloads || 0,
                    saves: item.saves || 0,
                    shares: item.shares || 0,
                    plays: 0,
                    liked: false,
                    audioBlob: item.audio_url,
                    coverArt: item.cover_url,
                    presetData: item.file_url,
                    presetName: item.metadata?.file_name || '',
                    videoBlob: item.metadata?.video_url || null,
                    uploader: item.uploader?.username || 'Unknown',
                    uploaderId: item.uploader_id,
                    uploaderAvatar: item.uploader?.avatar_url || null,
                    uploaderBanner: item.uploader?.banner_url || null,
                    uploaderBio: item.uploader?.bio || null,
                    createdAt: item.created_at,
                    comments: []
                }));
            }
        }

        itemsLoaded = true;

        // Cache items to localStorage for instant load on next refresh
        try {
            localStorage.setItem('presetJunkiesItems', JSON.stringify(items));
        } catch (e) {
            console.warn('Could not cache items to localStorage:', e);
        }

        // Rebuild globalTags from loaded items to keep in sync
        const rebuiltTags = {};
        const allCategories = ['presets', 'samples', 'midi', 'projects', 'originals'];
        allCategories.forEach(cat => {
            (items[cat] || []).forEach(item => {
                (item.tags || []).forEach(tag => {
                    const upperTag = tag.toUpperCase().trim();
                    if (upperTag) {
                        rebuiltTags[upperTag] = (rebuiltTags[upperTag] || 0) + 1;
                    }
                });
            });
        });
        try {
            localStorage.setItem('globalTags', JSON.stringify(rebuiltTags));
        } catch (e) {
            console.warn('Could not save globalTags:', e);
        }

        console.log('Items loaded from Supabase');

        // Load library from Supabase
        await loadLibraryFromSupabase();

        // Re-render current tab with fresh data
        if (typeof renderItems === 'function') {
            renderItems(currentTab);
        }

        // Refresh trending tags with new item data
        if (typeof refreshAllTrendingTags === 'function') {
            refreshAllTrendingTags();
        }

    } catch (err) {
        console.error('Error loading items from Supabase:', err);
    }
}

// Load user's library from Supabase
async function loadLibraryFromSupabase() {
    try {
        const { user } = await supabaseGetUser();
        if (!user) return;

        const { data, error } = await supabaseGetLibrary(user.id);
        if (error) {
            console.error('Error loading library from Supabase:', error);
            return;
        }

        if (data && data.length > 0) {
            // Transform Supabase format to local format
            const supabaseLibrary = data.map(entry => ({
                id: entry.item?.id,
                title: entry.item?.title || '',
                vst: entry.item?.metadata?.vst || '',
                type: entry.item?.metadata?.type || '',
                category: entry.item?.category || 'presets'
            })).filter(item => item.id); // Filter out any null entries

            // Merge with existing localStorage to preserve unsynced local saves
            // Use string comparison to avoid type mismatches between Supabase (number) and localStorage (string)
            const existingIds = new Set(supabaseLibrary.map(item => String(item.id)));
            const localOnly = library.filter(item => !existingIds.has(String(item.id)));

            // Combine: Supabase data + local items not yet in Supabase
            library = [...supabaseLibrary, ...localOnly];

            // Update localStorage cache
            localStorage.setItem('presetJunkiesLibrary', JSON.stringify(library));

            // Re-render library if function exists
            if (typeof renderUnifiedLibrary === 'function') {
                renderUnifiedLibrary();
            }
        }
    } catch (err) {
        console.error('Error loading library from Supabase:', err);
    }
}

// Initialize items on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load fresh data from Supabase in background (cached data already displayed)
    setTimeout(loadItemsFromSupabase, 100);

    // Subscribe to realtime item changes (syncs across all browsers)
    setTimeout(() => {
        if (typeof supabaseSubscribeToItemChanges === 'function') {
            supabaseSubscribeToItemChanges(
                // onDelete handler
                (deletedItem) => {
                    console.log('Item deleted in realtime:', deletedItem);
                    // Reload all items from Supabase to get fresh data
                    loadItemsFromSupabase().then(() => {
                        // Re-render current category if function exists
                        if (typeof renderItems === 'function' && typeof currentCategory !== 'undefined') {
                            renderItems(currentCategory);
                        }
                    });
                },
                // onInsert handler
                (newItem) => {
                    console.log('Item inserted in realtime:', newItem);
                    if (newItem && newItem.id && newItem.category) {
                        const cat = newItem.category;
                        if (!items[cat]) items[cat] = [];

                        // Check if item already exists
                        const exists = items[cat].some(i => i.id === newItem.id);
                        if (!exists) {
                            // Transform to local format
                            const transformedItem = {
                                id: newItem.id,
                                title: newItem.title,
                                description: newItem.description || '',
                                type: newItem.metadata?.type || '',
                                vst: newItem.metadata?.vst || '',
                                daw: newItem.metadata?.daw || '',
                                key: newItem.metadata?.key || '',
                                scale: newItem.metadata?.scale || '',
                                bpm: newItem.metadata?.bpm || '',
                                tempo: newItem.metadata?.tempo || '',
                                genre: newItem.metadata?.genre || '',
                                loopType: newItem.metadata?.loop_type || '',
                                sampleType: newItem.metadata?.sample_type || '',
                                tags: newItem.metadata?.tags || [],
                                midiNotes: newItem.metadata?.midi_notes || null,
                                hearts: newItem.hearts || 0,
                                downloads: newItem.downloads || 0,
                                saves: newItem.saves || 0,
                                shares: newItem.shares || 0,
                                plays: 0,
                                liked: false,
                                audioBlob: newItem.audio_url,
                                coverArt: newItem.cover_url,
                                presetData: newItem.file_url,
                                presetName: newItem.metadata?.file_name || '',
                                videoBlob: newItem.metadata?.video_url || null,
                                uploader: newItem.uploader?.username || 'Unknown',
                                uploaderId: newItem.uploader_id,
                                uploaderAvatar: newItem.uploader?.avatar_url || null,
                                createdAt: newItem.created_at,
                                comments: []
                            };

                            // Add to beginning of array (newest first)
                            items[cat].unshift(transformedItem);

                            // Re-render if this category is active
                            if (typeof currentTab !== 'undefined' && currentTab === cat) {
                                if (typeof renderItems === 'function') {
                                    renderItems(cat);
                                }
                            }

                            console.log(`New ${cat} item added:`, transformedItem.title);
                        }
                    }
                }
            );
        }

        // Subscribe to profile changes (for deleted users)
        if (typeof supabaseSubscribeToProfileChanges === 'function') {
            supabaseSubscribeToProfileChanges((updatedProfile) => {
                // If username starts with [Deleted, user was deleted
                if (updatedProfile && updatedProfile.username && updatedProfile.username.startsWith('[Deleted')) {
                    console.log('User deleted in realtime:', updatedProfile);
                    // Reload junkies page if visible
                    if (typeof initJunkiesPage === 'function') {
                        initJunkiesPage();
                    }
                }
            });
        }
    }, 500);
});

// Export for global access
window.loadItemsFromSupabase = loadItemsFromSupabase;
window.loadLibraryFromSupabase = loadLibraryFromSupabase;

// Playback state
let currentlyPlaying = null;
let currentPlayingCategory = null;
let globalAudio = null;
let playbackState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.7,
    isLooping: false,
    previousVolume: 0.7
};

// Audio context and visualizer state
let audioContexts = {};

// Navigation state
let currentTab = 'presets';
let isViewingOwnProfile = true;
let previousState = {
    tab: 'presets',
    category: 'presets',
    scrollTop: 0,
    wasProfileOverlay: false
};

// Pagination state
const ITEMS_PER_PAGE_OPTIONS = [12, 24, 36, 48];
let itemsPerPageSetting = 12; // default
const currentPage = {
    presets: 1,
    samples: 1,
    midi: 1,
    projects: 1,
    originals: 1
};

function getItemsPerPage(category) {
    return itemsPerPageSetting;
}

function setItemsPerPage(count, category) {
    itemsPerPageSetting = count;
    currentPage[category] = 1;
    renderItems(category);
}

// Library selection state
let selectedLibraryItems = new Set();

// Card flip state
let flipOverlay = null;
const flippedCards = new Set();

// Filter selection state
let selectedVst = null;
let selectedDaw = null;
let selectedTypes = new Set();
let selectedSampleTypes = new Set();
let selectedLoopTypes = new Set(['Loop']);
let selectedGenres = new Set();
let selectedMidiKeys = new Set();
let selectedMidiScales = new Set();
let selectedTags = new Set();

// Center panel state
let centerPanelItem = null;
let centerPanelCategory = null;

// Keyboard navigation state
let currentFocusIndex = -1;

// VST/DAW display images
const vstImages = {
    'serum': 'VST Images/Serum.png',
    'serum 2': 'VST Images/Serum 2.png',
    'sylenth1': 'VST Images/Synlenth1.png',
    'massive': 'VST Images/MASSIVE.png',
    'diva': 'VST Images/DIVA.png',
    'vital': 'VST Images/Vital.png',
    'omnisphere': 'VST Images/Omnipshere.png',
    'surge xt': 'VST Images/surge xt.png',
    'pigments': 'VST Images/pigments.png',
    'harmor': 'VST Images/harmor.png',
    'phaseplant': 'VST Images/phaseplant.png',
    'sytrus': 'VST Images/sytrus.png'
};

const dawImages = {
    'fl studio': 'VST Images/FL studio.png',
    'ableton': 'VST Images/ableton.png',
    'logic pro': 'VST Images/logic pro.png',
    'pro tools': 'VST Images/pro tools.png',
    'studio one': 'VST Images/studio one.png',
    'cubase': 'VST Images/cubase.png',
    'reason': 'VST Images/reason.png',
    'bitwig': 'VST Images/bitwig.png',
    'reaper': 'VST Images/reaper.png',
    'cakewalk': 'VST Images/cakewalk.png'
};

// Filter configurations
const filterConfigs = {
    presets: {
        filter1: { label: 'All Synthesizers', options: ['Serum', 'Serum 2', 'Sylenth1', 'Massive', 'Diva', 'Vital', 'Omnisphere', 'Pigments', 'Harmor', 'Phaseplant'] },
        filter2: { label: 'All Types', options: ['Arp', 'Atmosphere', 'Bass', 'Bell', 'Brass', 'Chord', 'Drone', 'FX', 'Keys', 'Lead', 'Pad', 'Piano', 'Pluck', 'Soundscape', 'String', 'Synth'] },
        filter3: null, filter4: null
    },
    samples: {
        filter1: { label: 'All Types', options: ['Drum', 'Bass', 'Melody', 'Vocal', 'FX', 'Percussion', 'Synth', 'Guitar', 'Piano'] },
        filter2: { label: 'All Keys', options: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'Am', 'Bm', 'Cm', 'Dm', 'Em', 'Fm', 'Gm'] },
        filter3: { label: 'All BPMs', options: ['60-80', '80-100', '100-120', '120-140', '140-160', '160-180', '180+'] },
        filter4: null
    },
    midi: {
        filter1: { label: 'All Keys', options: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'] },
        filter2: { label: 'All Scales', options: ['Major', 'Minor', 'Harmonic Minor', 'Melodic Minor', 'Dorian', 'Phrygian', 'Pentatonic', 'Blues'] },
        filter3: null, filter4: null
    },
    projects: {
        filter1: { label: 'All DAWs', options: ['FL Studio', 'Ableton', 'Studio One', 'Pro Tools', 'Logic', 'Reaper', 'Reason', 'Cubase', 'Cakewalk', 'Bitwig'] },
        filter2: { label: 'All Keys', options: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'] },
        filter3: { label: 'All Scales', options: ['Major', 'Minor', 'Harmonic Minor', 'Melodic Minor', 'Dorian', 'Phrygian', 'Pentatonic', 'Blues'] },
        filter4: { label: 'All Genres', options: ['EDM', 'Hip-Hop', 'Trap', 'House', 'Techno', 'Dubstep', 'Future Bass', 'Lo-Fi', 'Pop', 'Rock', 'Ambient'] }
    }
};

// Default tags when no items exist (empty - tags come from user uploads)
const defaultTags = {
    presets: [],
    samples: [],
    midi: [],
    projects: [],
    originals: []
};

// Lounge state
let communityRooms = safeJSONParse(localStorage.getItem('communityRooms'), []);

// Fix any corrupted rules in localStorage cache
communityRooms.forEach(room => {
    if (room.rules && Array.isArray(room.rules) && room.rules.length > 0) {
        // If all rules are single/double chars, it's corrupted
        if (room.rules.every(r => typeof r === 'string' && r.length <= 2)) {
            console.warn('Fixing corrupted rules for room:', room.name);
            room.rules = [];
        }
    }
});

// Load rooms from Supabase
async function loadRoomsFromSupabase() {
    try {
        if (typeof supabaseGetRooms !== 'function') {
            console.warn('supabaseGetRooms not available');
            return;
        }

        console.log('Loading rooms from Supabase...');
        const { data, error } = await supabaseGetRooms();

        if (error) {
            console.error('Error loading rooms from Supabase:', error);
            return;
        }

        console.log('Rooms received from Supabase:', data?.length || 0, data);

        if (data) {
            // Transform Supabase format to local format (handles empty array too)
            communityRooms = data.map(room => {
                // Parse rules if it's a string (Supabase returns JSON as string)
                let parsedRules = room.rules || [];
                if (typeof parsedRules === 'string') {
                    try {
                        parsedRules = JSON.parse(parsedRules);
                    } catch (e) {
                        parsedRules = [];
                    }
                }
                if (!Array.isArray(parsedRules)) {
                    parsedRules = [];
                }
                // Fix corrupted rules (single character strings indicate corruption)
                if (parsedRules.length > 0 && parsedRules.every(r => typeof r === 'string' && r.length <= 2)) {
                    console.warn('Detected corrupted rules, clearing:', parsedRules);
                    parsedRules = [];
                }

                return {
                    id: room.id,
                    name: room.name,
                    description: room.description || '',
                    rules: parsedRules,
                    image: room.icon_url || null,
                    icon: room.icon_url || null,
                    wallpaper: room.wallpaper_url || null,
                    creator: room.creator?.username || 'Unknown',
                    creatorId: room.creator_id,
                    members: room.member_count || 1,
                    createdAt: room.created_at,
                    nameChanged: room.name_changed || false
                };
            });

            // Update localStorage cache
            localStorage.setItem('communityRooms', JSON.stringify(communityRooms));
            console.log('Rooms loaded from Supabase:', communityRooms.length);

            // Re-render room lists if function exists
            if (typeof renderCommunityRooms === 'function') {
                renderCommunityRooms();
            }
            if (typeof renderMyRooms === 'function') {
                renderMyRooms();
            }
        }
    } catch (err) {
        console.error('Error loading rooms from Supabase:', err);
    }
}

// Load user's joined rooms from Supabase
async function loadJoinedRoomsFromSupabase() {
    try {
        const { user } = await supabaseGetUser();
        if (!user) return;

        // Get rooms where user is a member
        const { data, error } = await supabaseClient
            .from('room_members')
            .select('room_id')
            .eq('user_id', user.id);

        if (error) {
            console.error('Error loading joined rooms:', error);
            return;
        }

        if (data) {
            const supabaseJoinedRooms = data.map(r => r.room_id);
            // Merge with default static rooms
            joinedRooms = [...new Set([...defaultStaticRooms, ...supabaseJoinedRooms])];
            localStorage.setItem('joinedRooms', JSON.stringify(joinedRooms));
            console.log('Joined rooms loaded from Supabase:', joinedRooms.length);

            if (typeof renderMyRooms === 'function') {
                renderMyRooms();
            }
            // Also re-render community rooms to hide joined ones
            if (typeof renderCommunityRooms === 'function') {
                renderCommunityRooms();
            }
        }
    } catch (err) {
        console.error('Error loading joined rooms:', err);
    }
}

// Reset joined rooms (called on logout)
function resetJoinedRooms() {
    joinedRooms = [];
    favoriteRooms = [];
    if (typeof renderMyRooms === 'function') {
        renderMyRooms();
    }
    if (typeof renderCommunityRooms === 'function') {
        renderCommunityRooms();
    }
}

window.loadRoomsFromSupabase = loadRoomsFromSupabase;
window.loadJoinedRoomsFromSupabase = loadJoinedRoomsFromSupabase;
window.resetJoinedRooms = resetJoinedRooms;
// Default rooms all users are auto-subscribed to
const defaultStaticRooms = [];
let joinedRooms = safeJSONParse(localStorage.getItem('joinedRooms'), null);
// Auto-subscribe new users to default rooms
if (joinedRooms === null) {
    joinedRooms = [...defaultStaticRooms];
    localStorage.setItem('joinedRooms', JSON.stringify(joinedRooms));
} else {
    // Ensure existing users have default rooms
    let updated = false;
    defaultStaticRooms.forEach(roomId => {
        if (!joinedRooms.includes(roomId)) {
            joinedRooms.push(roomId);
            updated = true;
        }
    });
    if (updated) {
        localStorage.setItem('joinedRooms', JSON.stringify(joinedRooms));
    }
}
let bannedFromRooms = safeJSONParse(localStorage.getItem('bannedFromRooms'), {});
let roomMessages = safeJSONParse(localStorage.getItem('roomMessages'), {});
let roomMembers = safeJSONParse(localStorage.getItem('roomMembers'), {});
let favoriteRooms = safeJSONParse(localStorage.getItem('favoriteRooms'), []);
let myRoomsFilter = 'all'; // 'all' or 'favorites'
let currentRoom = null;
let currentUser = 'You'; // Current logged in user
let isSettingsMode = false;
let previewSettings = {
    name: '',
    icon: null,
    wallpaper: null,
    containerStyle: 'glass',
    glassOpacity: 50,
    bgColor: '#101010',
    panelColor: '#101010'
};
