// ===== GLOBAL STATE =====
const items = { presets: [], samples: [], midi: [], projects: [] };
const audioElements = {};
const library = safeJSONParse(localStorage.getItem('presetJunkiesLibrary'), []);
let currentlyPlaying = null;
let currentPlayingCategory = null;
let globalAudio = null;
let currentTab = 'presets';
let audioContexts = {};
let analysers = {};
let dataArrays = {};
let sources = {};
let spectralAnimations = {};
let pianoRollAnimations = {};
let selectedLibraryItems = new Set();
let flipOverlay = null;
const flippedCards = new Set();

let playbackState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.7,
    isLooping: false
};

let isViewingOwnProfile = true;
let previousState = {
    tab: 'presets',
    category: 'presets'
};

// Function to close profile view and return to previous state
function closeProfileView() {
    document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
    document.getElementById(`${previousState.category}-content`).classList.add('active');

    // Remove profile-active class
    document.body.classList.remove('profile-active');

    // Show filter panel
    const filterPanel = document.getElementById('filter-panel');
    if (filterPanel) filterPanel.style.display = 'flex';
    const contentArea = document.querySelector('.content-area');
    if (contentArea) contentArea.style.marginLeft = '200px';

    // Update current tab
    currentTab = previousState.category;

    // Update filters without re-rendering
    updateDynamicFilters(previousState.category);
    filterItems();
}

// Function to view another user's profile
function viewUserProfile(userId) {
    // Save current state before navigating
    previousState.category = currentTab;

    isViewingOwnProfile = false;
    document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
    const profileContent = document.getElementById('profile-content');
    if (profileContent) profileContent.classList.add('active');
    const sidebarDownloadBtn = document.getElementById('sidebar-download-btn');
    if (sidebarDownloadBtn) sidebarDownloadBtn.classList.add('hidden');

    // Add profile-active class to hide container background
    document.body.classList.add('profile-active');

    // Hide filter panel for profile
    const filterPanel = document.getElementById('filter-panel');
    if (filterPanel) filterPanel.style.display = 'none';
    const contentArea = document.querySelector('.content-area');
    if (contentArea) contentArea.style.marginLeft = '0';

    // Hide change background button when viewing other profiles
    const profileBgUpload = document.querySelector('.profile-bg-upload');
    if (profileBgUpload) profileBgUpload.style.display = 'none';

    // Show close button
    const profileCloseBtn = document.getElementById('profile-close-btn');
    if (profileCloseBtn) profileCloseBtn.style.display = 'flex';

    // Update username display
    document.querySelector('.banner-username').textContent = userId;

    // TODO: Load the user's profile data based on userId
}

// ===== HELPER FUNCTIONS =====
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

// ===== MOBILE SIDEBAR TOGGLE =====
document.getElementById('side-nav-toggle').addEventListener('click', () => {
    document.getElementById('side-nav').classList.toggle('active');
});

// ===== SIDEBAR NAVIGATION =====
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

        // Stop any playing audio
        if (currentlyPlaying && audioElements[currentlyPlaying]) {
            audioElements[currentlyPlaying].pause();
            audioElements[currentlyPlaying].currentTime = 0;
        }

        // Update active state
        document.querySelectorAll('.side-nav-item').forEach(x => x.classList.remove('active'));
        this.classList.add('active');

        const downloadBtn = document.getElementById('sidebar-download-btn');
        const filterPanel = document.getElementById('filter-panel');
        const contentArea = document.querySelector('.content-area');
        const presetsBgBtn = document.getElementById('presets-bg-btn');
        const presetsBgOverlay = document.getElementById('presets-bg-overlay');

        if (this.dataset.view === 'library') {
            document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
            const libraryContent = document.getElementById('library-content');
            if (libraryContent) libraryContent.classList.add('active');
            renderUnifiedLibrary();
            if (downloadBtn) downloadBtn.classList.remove('hidden');
            // Remove profile-active class to show container background
            document.body.classList.remove('profile-active');
            // Hide filter panel for library
            if (filterPanel) filterPanel.style.display = 'none';
            if (contentArea) contentArea.style.marginLeft = '0';
        } else if (this.dataset.view === 'profile') {
            isViewingOwnProfile = true;
            document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
            const profileContent = document.getElementById('profile-content');
            if (profileContent) profileContent.classList.add('active');
            if (downloadBtn) downloadBtn.classList.add('hidden');

            // Add profile-active class to hide container background
            document.body.classList.add('profile-active');

            // Show change background button for own profile
            const profileBgUpload = document.querySelector('.profile-bg-upload');
            if (profileBgUpload) profileBgUpload.style.display = 'flex';

            // Hide close button for own profile
            const profileCloseBtn = document.getElementById('profile-close-btn');
            if (profileCloseBtn) profileCloseBtn.style.display = 'none';

            // Hide filter panel for profile
            if (filterPanel) filterPanel.style.display = 'none';
            if (contentArea) contentArea.style.marginLeft = '0';
            if (presetsBgBtn) presetsBgBtn.style.display = 'none';
            if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';

            // Reset username to own profile
            const bannerUsername = document.querySelector('.banner-username');
            if (bannerUsername) bannerUsername.textContent = 'Username';

            const category = this.dataset.category;
            currentTab = category;

        } else {
            const category = this.dataset.category;
            currentTab = category;

            // Hide filter panel for presets, samples, and midi (they have their own tag systems)
            if (category === 'presets' || category === 'samples' || category === 'midi') {
                if (filterPanel) filterPanel.style.display = 'none';
                if (contentArea) contentArea.style.marginLeft = '0';
                if (category === 'presets') {
                    if (presetsBgBtn) presetsBgBtn.style.display = 'flex';
                    if (presetsBgOverlay) presetsBgOverlay.style.display = 'block';
                } else {
                    if (presetsBgBtn) presetsBgBtn.style.display = 'none';
                    if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';
                }
            } else {
                if (filterPanel) filterPanel.style.display = 'flex';
                if (contentArea) contentArea.style.marginLeft = '200px';
                if (presetsBgBtn) presetsBgBtn.style.display = 'none';
                if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';
            }

            // Remove profile-active class to show container background
            document.body.classList.remove('profile-active');

            updateDynamicFilters(category);

            document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
            const categoryContent = document.getElementById(`${category}-content`);
            if (categoryContent) categoryContent.classList.add('active');

            renderItems(category);
            filterItems();

            // Refresh trending tags for this category
            if (typeof refreshAllTrendingTags === 'function') {
                refreshAllTrendingTags();
            }
            if (downloadBtn) downloadBtn.classList.add('hidden');
        }
    });
});


// ===== PROFILE BACKGROUND UPLOAD =====
document.getElementById('profile-bg-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const profileContent = document.getElementById('profile-content');
            profileContent.style.backgroundImage = `url(${event.target.result})`;
            localStorage.setItem('profileBackground', event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

// Load saved background on page load
const savedBg = localStorage.getItem('profileBackground');
if (savedBg) {
    document.getElementById('profile-content').style.backgroundImage = `url(${savedBg})`;
}

// ===== DYNAMIC FILTERS =====

const filterConfigs = {
    presets: {
        filter1: { label: 'All VSTs', options: ['Serum', 'Serum 2', 'Sylenth1', 'Massive', 'Diva', 'Vital', 'Omnisphere'] },
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

function updateDynamicFilters(category) {
    const config = filterConfigs[category];
    if (!config) return;

    const filter1 = document.getElementById('dynamic-filter-1');
    const filter2 = document.getElementById('dynamic-filter-2');
    const filter3 = document.getElementById('dynamic-filter-3');
    const filter4 = document.getElementById('dynamic-filter-4');

    const filter3Group = document.getElementById('filter-3-group');
    const filter4Group = document.getElementById('filter-4-group');

    const label1 = document.getElementById('filter-1-label');
    const label2 = document.getElementById('filter-2-label');
    const label3 = document.getElementById('filter-3-label');
    const label4 = document.getElementById('filter-4-label');

    [filter1, filter2, filter3, filter4].forEach((f, i) => {
        const cfg = config[`filter${i+1}`];
        const label = document.getElementById(`filter-${i+1}-label`);
        const group = document.getElementById(`filter-${i+1}-group`);

        if (cfg) {
            f.innerHTML = `<option value="">${escapeHTML(cfg.label)}</option>`;
            cfg.options.forEach(opt => f.innerHTML += `<option value="${escapeAttr(opt)}">${escapeHTML(opt)}</option>`);
            f.style.display = 'block';
            if (label) label.textContent = cfg.label.replace('All ', '');
            if (group) group.style.display = 'flex';
        } else {
            f.style.display = 'none';
            if (group) group.style.display = 'none';
        }
    });
}

function filterItems() {
    const filter1Value = document.getElementById('dynamic-filter-1').value.toLowerCase();
    const filter2Value = document.getElementById('dynamic-filter-2').value.toLowerCase();
    const filter3Value = document.getElementById('dynamic-filter-3').value.toLowerCase();
    const filter4Value = document.getElementById('dynamic-filter-4').value.toLowerCase();
    const search = document.getElementById('tag-search').value.toLowerCase().trim();

    const grid = document.getElementById(`${currentTab}-grid`);
    if (!grid) return;

    const cards = grid.querySelectorAll('[data-item-id]');
    cards.forEach(card => {
        const item = items[currentTab].find(i => i.id === parseInt(card.dataset.itemId));
        if (!item) return;

        let matches = true;

        if (currentTab === 'presets') {
            if (filter1Value && item.vst?.toLowerCase() !== filter1Value) matches = false;
            if (filter2Value && item.type?.toLowerCase() !== filter2Value) matches = false;
            // Check selected type tags (multi-select) - case insensitive
            if (selectedTypes.size > 0) {
                const itemType = item.type?.charAt(0).toUpperCase() + item.type?.slice(1).toLowerCase();
                if (!selectedTypes.has(itemType) && !selectedTypes.has(item.type)) matches = false;
            }
            // Check selected trending tags (multi-select - item must have ALL selected tags)
            if (selectedTags.size > 0) {
                const hasAllTags = [...selectedTags].every(tag => item.tags.includes(tag));
                if (!hasAllTags) matches = false;
            }
        } else if (currentTab === 'samples') {
            if (filter1Value && item.type?.toLowerCase() !== filter1Value) matches = false;
            if (filter2Value && item.key?.toLowerCase() !== filter2Value) matches = false;
            // Check selected sample type tags (multi-select)
            if (selectedSampleTypes.size > 0) {
                const itemType = item.type?.charAt(0).toUpperCase() + item.type?.slice(1).toLowerCase();
                if (!selectedSampleTypes.has(itemType) && !selectedSampleTypes.has(item.type)) matches = false;
            }
            // Check selected trending tags for samples
            if (selectedTags.size > 0) {
                const hasAllTags = [...selectedTags].every(tag => item.tags.includes(tag));
                if (!hasAllTags) matches = false;
            }
        } else if (currentTab === 'midi') {
            if (filter1Value && item.key?.toLowerCase() !== filter1Value) matches = false;
            if (filter2Value && item.scale?.toLowerCase() !== filter2Value) matches = false;
            // Check selected MIDI key tags
            if (selectedMidiKeys.size > 0) {
                if (!selectedMidiKeys.has(item.key)) matches = false;
            }
            // Check selected MIDI scale tags
            if (selectedMidiScales.size > 0) {
                if (!selectedMidiScales.has(item.scale)) matches = false;
            }
            // Check selected trending tags for MIDI
            if (selectedTags.size > 0) {
                const hasAllTags = [...selectedTags].every(tag => item.tags.includes(tag));
                if (!hasAllTags) matches = false;
            }
        } else if (currentTab === 'projects') {
            if (filter1Value && item.daw?.toLowerCase() !== filter1Value) matches = false;
            if (filter2Value && item.key?.toLowerCase() !== filter2Value) matches = false;
            if (filter3Value && item.scale?.toLowerCase() !== filter3Value) matches = false;
            if (filter4Value && item.genre?.toLowerCase() !== filter4Value) matches = false;
        }

        if (search) {
            const tagMatch = item.tags.some(t => t.toLowerCase().includes(search));
            const titleMatch = item.title.toLowerCase().includes(search);
            if (!tagMatch && !titleMatch) matches = false;
        }

        card.style.display = matches ? 'block' : 'none';
    });
}

document.getElementById('dynamic-filter-1').addEventListener('change', filterItems);
document.getElementById('dynamic-filter-2').addEventListener('change', filterItems);
document.getElementById('dynamic-filter-3').addEventListener('change', filterItems);
document.getElementById('dynamic-filter-4').addEventListener('change', filterItems);
document.getElementById('tag-search').addEventListener('input', filterItems);
document.getElementById('sort-filter').addEventListener('change', filterItems);

// ===== VST/DAW DISPLAY IMAGES =====
const vstImages = {
    'serum': 'VST Images/Serum.png',
    'serum 2': 'VST Images/Serum 2.png',
    'sylenth1': 'VST Images/Synlenth1.png',
    'massive': 'VST Images/MASSIVE.png',
    'diva': 'VST Images/DIVA.png',
    'vital': 'VST Images/Vital.png',
    'omnisphere': 'VST Images/Omnipshere.png'
};

const dawImages = {
    'fl studio': '../DAW Images/flstudio.png',
    'ableton': '../DAW Images/ableton.png',
    'logic pro': '../DAW Images/logic.png',
    'pro tools': '../DAW Images/protools.png',
    'studio one': '../DAW Images/studioone.png',
    'cubase': '../DAW Images/cubase.png',
    'reason': '../DAW Images/reason.png',
    'bitwig': '../DAW Images/bitwig.png'
};

function updateInstrumentDisplay() {
    const vstImg = document.getElementById('vst-banner-img');
    const dawImg = document.getElementById('daw-display-img');
    const filter1Value = document.getElementById('dynamic-filter-1').value.toLowerCase();

    // Update VST display (presets tab)
    if (vstImg && vstImages[filter1Value]) {
        vstImg.src = vstImages[filter1Value];
        vstImg.alt = filter1Value;
    } else if (vstImg) {
        vstImg.src = '';
        vstImg.alt = '';
    }

    // Update DAW display (projects tab)
    if (dawImg && dawImages[filter1Value]) {
        dawImg.src = dawImages[filter1Value];
        dawImg.alt = filter1Value;
    } else if (dawImg) {
        dawImg.src = '';
        dawImg.alt = '';
    }
}

document.getElementById('dynamic-filter-1').addEventListener('change', updateInstrumentDisplay);

// Generate neon glow color for tags
function getRandomNeonColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = Math.floor(Math.random() * 20) + 80; // 80-100% (bright neon)
    const lightness = Math.floor(Math.random() * 15) + 55; // 55-70% (vibrant)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Apply neon glow effect to tag
function applyTagGlow(element) {
    const hue = Math.floor(Math.random() * 360);
    const saturation = Math.floor(Math.random() * 20) + 80;
    const lightness = Math.floor(Math.random() * 15) + 55;
    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    element.style.boxShadow = `0 0 8px hsla(${hue}, ${saturation}%, ${lightness}%, 0.6), 0 0 16px hsla(${hue}, ${saturation}%, ${lightness}%, 0.4)`;
    element.style.borderColor = color;
}

// Remove glow effect from tag
function removeTagGlow(element) {
    element.style.boxShadow = '';
    element.style.borderColor = '';
}

// VST Tags click handler
let selectedVst = null;

document.querySelectorAll('.vst-tag').forEach(tag => {
    tag.addEventListener('click', () => {
        const vst = tag.dataset.vst;

        // Toggle selection
        if (selectedVst === vst) {
            selectedVst = null;
            tag.classList.remove('selected');
            removeTagGlow(tag);
        } else {
            // Remove selected from all and clear glows
            document.querySelectorAll('.vst-tag').forEach(t => {
                t.classList.remove('selected');
                removeTagGlow(t);
            });
            selectedVst = vst;
            tag.classList.add('selected');
            applyTagGlow(tag);
        }

        // Update the VST display image
        const vstImg = document.getElementById('vst-banner-img');
        if (vstImg && selectedVst && vstImages[selectedVst]) {
            vstImg.src = vstImages[selectedVst];
            vstImg.alt = selectedVst;
        } else if (vstImg) {
            vstImg.src = '';
            vstImg.alt = '';
        }

        // Sync with main filter and trigger filtering
        document.getElementById('dynamic-filter-1').value = selectedVst || '';
        filterItems();
        updateFilterTabIndicators();
    });
});

// ===== SOUND TYPE TAGS =====
let selectedTypes = new Set();

document.querySelectorAll('.type-tag').forEach(tag => {
    tag.addEventListener('click', () => {
        const type = tag.dataset.type;

        if (selectedTypes.has(type)) {
            selectedTypes.delete(type);
            tag.classList.remove('selected');
            removeTagGlow(tag);
        } else {
            selectedTypes.add(type);
            tag.classList.add('selected');
            applyTagGlow(tag);
        }

        filterItems();
        updateFilterTabIndicators();
    });
});

// ===== SAMPLE TYPE TAGS =====
let selectedSampleTypes = new Set();

document.querySelectorAll('.sample-type-tag').forEach(tag => {
    tag.addEventListener('click', () => {
        const type = tag.dataset.type;

        if (selectedSampleTypes.has(type)) {
            selectedSampleTypes.delete(type);
            tag.classList.remove('selected');
            removeTagGlow(tag);
        } else {
            selectedSampleTypes.add(type);
            tag.classList.add('selected');
            applyTagGlow(tag);
        }

        filterItems();
    });
});

// ===== MIDI KEY TAGS =====
let selectedMidiKeys = new Set();

document.querySelectorAll('.midi-key-tag').forEach(tag => {
    tag.addEventListener('click', () => {
        const key = tag.dataset.key;

        if (selectedMidiKeys.has(key)) {
            selectedMidiKeys.delete(key);
            tag.classList.remove('selected');
            removeTagGlow(tag);
        } else {
            selectedMidiKeys.add(key);
            tag.classList.add('selected');
            applyTagGlow(tag);
        }

        filterItems();
    });
});

// ===== MIDI SCALE TAGS =====
let selectedMidiScales = new Set();

document.querySelectorAll('.midi-scale-tag').forEach(tag => {
    tag.addEventListener('click', () => {
        const scale = tag.dataset.scale;

        if (selectedMidiScales.has(scale)) {
            selectedMidiScales.delete(scale);
            tag.classList.remove('selected');
            removeTagGlow(tag);
        } else {
            selectedMidiScales.add(scale);
            tag.classList.add('selected');
            applyTagGlow(tag);
        }

        filterItems();
    });
});

// ===== TRENDING TAGS =====
let selectedTags = new Set();

function getTrendingTags(category) {
    const tagCounts = {};
    items[category].forEach(item => {
        item.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    // Sort by count and return top 20
    const tags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([tag]) => tag);

    // If no tags exist yet, show placeholder trending tags
    if (tags.length === 0 && category === 'presets') {
        return ['dark', 'aggressive', 'chill', 'melodic', 'hard', 'ambient', 'heavy', 'soft', 'punchy', 'warm', 'bright', 'deep'];
    }
    if (tags.length === 0 && category === 'samples') {
        return ['hard', 'trap', '808', 'drill', 'bounce', 'dark', 'punchy', 'crisp', 'heavy', 'lofi', 'booming', 'clean'];
    }
    if (tags.length === 0 && category === 'midi') {
        return ['melodic', 'dark', 'emotional', 'uplifting', 'chill', 'aggressive', 'ambient', 'progressive', 'dreamy', 'sad', 'epic', 'minimal'];
    }

    return tags;
}

function renderTrendingTags() {
    const container = document.getElementById('preset-trending-tags');
    if (!container) return;

    const trendingTags = getTrendingTags('presets');
    container.innerHTML = trendingTags.map(tag =>
        `<button class="trending-tag ${selectedTags.has(tag) ? 'selected' : ''}" data-tag="${tag}">${tag.toUpperCase()}</button>`
    ).join('');

    // Add click handlers
    container.querySelectorAll('.trending-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;

            if (selectedTags.has(tag)) {
                selectedTags.delete(tag);
                btn.classList.remove('selected');
                removeTagGlow(btn);
            } else {
                selectedTags.add(tag);
                btn.classList.add('selected');
                applyTagGlow(btn);
            }

            filterItems();
            updateFilterTabIndicators();
        });
    });
}

// Tag search filter
document.getElementById('preset-tags-search')?.addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    const container = document.getElementById('preset-trending-tags');

    container.querySelectorAll('.trending-tag').forEach(btn => {
        const tag = btn.dataset.tag.toLowerCase();
        btn.style.display = tag.includes(search) ? '' : 'none';
    });
});

// VST search filter
document.getElementById('preset-vst-search')?.addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    document.querySelectorAll('.vst-tag').forEach(btn => {
        const vst = btn.dataset.vst.toLowerCase();
        btn.style.display = vst.includes(search) ? '' : 'none';
    });
});

// Sound type search filter
document.getElementById('preset-type-search')?.addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    document.querySelectorAll('.type-tag').forEach(btn => {
        const type = btn.dataset.type.toLowerCase();
        btn.style.display = type.includes(search) ? '' : 'none';
    });
});

// ===== FILTER TAB SWITCHING =====
document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.filterTab;

        // Update active tab
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show corresponding panel
        document.querySelectorAll('.filter-content').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`filter-content-${tabName}`)?.classList.add('active');
    });
});

// Update tab indicators when selections change
function updateFilterTabIndicators() {
    const vstsTab = document.querySelector('[data-filter-tab="vsts"]');
    const typesTab = document.querySelector('[data-filter-tab="types"]');
    const tagsTab = document.querySelector('[data-filter-tab="tags"]');

    // Check VST selections
    const hasVstSelection = document.querySelector('.vst-tag.selected') !== null;
    vstsTab?.classList.toggle('has-selection', hasVstSelection);

    // Check type selections
    const hasTypeSelection = document.querySelector('.type-tag.selected') !== null;
    typesTab?.classList.toggle('has-selection', hasTypeSelection);

    // Check tag selections
    const hasTagSelection = document.querySelector('.trending-tag.selected') !== null;
    tagsTab?.classList.toggle('has-selection', hasTagSelection);
}

// Initial render - disabled, using filters.js version with counts
// setTimeout(renderTrendingTags, 100);

// ===== SAMPLE TRENDING TAGS =====
function renderSampleTrendingTags() {
    const container = document.getElementById('sample-trending-tags');
    if (!container) return;

    const trendingTags = getTrendingTags('samples');
    container.innerHTML = trendingTags.map(tag =>
        `<button class="trending-tag ${selectedTags.has(tag) ? 'selected' : ''}" data-tag="${tag}">${tag.toUpperCase()}</button>`
    ).join('');

    // Add click handlers
    container.querySelectorAll('.trending-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;

            if (selectedTags.has(tag)) {
                selectedTags.delete(tag);
                btn.classList.remove('selected');
                removeTagGlow(btn);
            } else {
                selectedTags.add(tag);
                btn.classList.add('selected');
                applyTagGlow(btn);
            }

            filterItems();
        });
    });
}

// Sample tag search filter
document.getElementById('sample-tags-search')?.addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    const container = document.getElementById('sample-trending-tags');

    container.querySelectorAll('.trending-tag').forEach(btn => {
        const tag = btn.dataset.tag.toLowerCase();
        btn.style.display = tag.includes(search) ? '' : 'none';
    });
});

// setTimeout(renderSampleTrendingTags, 100);

// ===== MIDI TRENDING TAGS =====
function renderMidiTrendingTags() {
    const container = document.getElementById('midi-trending-tags');
    if (!container) return;

    const trendingTags = getTrendingTags('midi');
    container.innerHTML = trendingTags.map(tag =>
        `<button class="trending-tag ${selectedTags.has(tag) ? 'selected' : ''}" data-tag="${tag}">${tag.toUpperCase()}</button>`
    ).join('');

    // Add click handlers
    container.querySelectorAll('.trending-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;

            if (selectedTags.has(tag)) {
                selectedTags.delete(tag);
                btn.classList.remove('selected');
                removeTagGlow(btn);
            } else {
                selectedTags.add(tag);
                btn.classList.add('selected');
                applyTagGlow(btn);
            }

            filterItems();
        });
    });
}

// MIDI tag search filter
document.getElementById('midi-tags-search')?.addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    const container = document.getElementById('midi-trending-tags');

    container.querySelectorAll('.trending-tag').forEach(btn => {
        const tag = btn.dataset.tag.toLowerCase();
        btn.style.display = tag.includes(search) ? '' : 'none';
    });
});

// setTimeout(renderMidiTrendingTags, 100);

// ===== FLIP OVERLAY =====
function createFlipOverlay() {
    if (!flipOverlay) {
        flipOverlay = document.createElement('div');
        flipOverlay.className = 'flip-overlay';
        flipOverlay.addEventListener('click', closeAllFlippedCards);
        document.body.appendChild(flipOverlay);
    }
    return flipOverlay;
}

function toggleCardInfo(itemId) {
    const cardBack = document.querySelector(`[data-item-id="${itemId}"] .item-card-back`);

    if (flippedCards.has(itemId)) {
        cardBack?.classList.remove('show');
        flippedCards.delete(itemId);
    } else {
        // Close any other open info panels
        closeAllCardInfo();
        cardBack?.classList.add('show');
        flippedCards.add(itemId);
    }
}

function closeAllCardInfo() {
    flippedCards.forEach(id => {
        const cardBack = document.querySelector(`[data-item-id="${id}"] .item-card-back`);
        cardBack?.classList.remove('show');
    });
    flippedCards.clear();
}

window.toggleCardFlip = toggleCardInfo;
window.toggleCardInfo = toggleCardInfo;
window.closeAllFlippedCards = closeAllCardInfo;
window.closeAllCardInfo = closeAllCardInfo;

// ===== UPLOAD MODAL =====
function openUploadModal() {
    const modal = document.getElementById('upload-modal');
    const modalContent = modal.querySelector('.modal-content');

    // Update modal title based on current tab
    const titles = {
        presets: 'Upload Preset',
        samples: 'Upload Sample',
        midi: 'Upload MIDI',
        projects: 'Upload Project File'
    };
    modal.querySelector('.modal-title').textContent = titles[currentTab] || 'Upload Content';

    // Show only the relevant form
    document.querySelectorAll('.modal-body .tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`upload-${currentTab}`).classList.add('active');

    modal.classList.remove('hidden');
    setTimeout(() => modalContent.classList.add('show'), 10);
}

function closeUploadModal() {
    const modal = document.getElementById('upload-modal');
    const modalContent = modal.querySelector('.modal-content');
    modalContent.classList.remove('show');
    setTimeout(() => modal.classList.add('hidden'), 300);
}
window.closeUploadModal = closeUploadModal;

document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.uploadTab;
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.modal-body .tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`upload-${tabName}`).classList.add('active');
    });
});

document.querySelectorAll('.file-upload-area input[type="file"]').forEach(input => {
    input.addEventListener('change', (e) => {
        const area = e.target.closest('.file-upload-area');
        if (e.target.files.length > 0) {
            area.classList.add('has-file');
            area.querySelector('p').textContent = `Selected: ${e.target.files[0].name}`;
        }
    });
});

// ===== DOWNLOAD MODAL =====
function openDownloadModal() {
    if (selectedLibraryItems.size === 0) return;
    const modal = document.getElementById('download-modal');
    const modalContent = modal.querySelector('.modal-content');
    document.getElementById('download-count').textContent = selectedLibraryItems.size === 1 ? '1 file' : `${selectedLibraryItems.size} files`;
    document.getElementById('download-filename').value = `PresetJunkies_${new Date().toISOString().split('T')[0]}`;
    modal.classList.remove('hidden');
    setTimeout(() => modalContent.classList.add('show'), 10);
}

function closeDownloadModal() {
    const modal = document.getElementById('download-modal');
    const modalContent = modal.querySelector('.modal-content');
    modalContent.classList.remove('show');
    setTimeout(() => modal.classList.add('hidden'), 300);
}
window.closeDownloadModal = closeDownloadModal;

async function confirmDownload() {
    const itemsToDownload = [];
    const filename = document.getElementById('download-filename').value.trim() || 'PresetJunkies_Package';

    selectedLibraryItems.forEach(id => {
        const libItem = library.find(l => l.id === id);
        if (!libItem) return;
        const item = items[libItem.category].find(i => i.id === id);
        if (item && item.presetData) itemsToDownload.push(item);
    });

    if (itemsToDownload.length === 0) {
        closeDownloadModal();
        return;
    }

    if (itemsToDownload.length === 1) {
        const item = itemsToDownload[0];
        const a = document.createElement('a');
        a.href = item.presetData;
        a.download = item.presetName;
        a.click();
        item.downloads++;
    } else {
        const zip = new JSZip();
        for (const item of itemsToDownload) {
            try {
                const response = await fetch(item.presetData);
                const blob = await response.blob();
                zip.file(item.presetName, blob);
                item.downloads++;
            } catch (e) {
                // Skip file on error
            }
        }
        try {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Error creating download package. Please try again.');
        }
    }

    closeDownloadModal();
    selectedLibraryItems.clear();
    renderUnifiedLibrary();
}
window.confirmDownload = confirmDownload;

// ===== VISUALIZERS =====
// Track which audio elements have been connected to avoid "already connected" error
const connectedAudioElements = new WeakSet();

function animateSpectralBars(itemId, audioElement) {
    if (spectralAnimations[itemId]) cancelAnimationFrame(spectralAnimations[itemId]);

    const ripples = [];
    for (let i = 0; i < 5; i++) {
        const ripple = document.getElementById(`ripple-${itemId}-${i}`);
        if (ripple) ripples.push(ripple);
    }
    if (ripples.length === 0) return;

    let useAudioAnalysis = false;

    try {
        // Create or reuse AudioContext
        if (!audioContexts[itemId] || audioContexts[itemId].state === 'closed') {
            audioContexts[itemId] = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Resume AudioContext if it's suspended (browser autoplay policy)
        if (audioContexts[itemId].state === 'suspended') {
            audioContexts[itemId].resume();
        }

        // Only connect audio element if it hasn't been connected before
        if (!connectedAudioElements.has(audioElement)) {
            analysers[itemId] = audioContexts[itemId].createAnalyser();
            analysers[itemId].fftSize = 256;
            dataArrays[itemId] = new Uint8Array(analysers[itemId].frequencyBinCount);

            const source = audioContexts[itemId].createMediaElementSource(audioElement);
            source.connect(analysers[itemId]);
            analysers[itemId].connect(audioContexts[itemId].destination);
            sources[itemId] = source;
            connectedAudioElements.add(audioElement);
        }

        useAudioAnalysis = analysers[itemId] && dataArrays[itemId];
    } catch (e) {
        useAudioAnalysis = false;
    }

    function updateRipples() {
        if (!spectralAnimations[itemId]) return;

        if (useAudioAnalysis && analysers[itemId]) {
            try {
                analysers[itemId].getByteFrequencyData(dataArrays[itemId]);
                let sum = 0;
                for (let i = 0; i < dataArrays[itemId].length; i++) sum += dataArrays[itemId][i];
                const average = sum / dataArrays[itemId].length / 255;

                ripples.forEach((ripple, index) => {
                    const baseSize = 50 + (index * 60);
                    const freqIndex = Math.floor((index / ripples.length) * dataArrays[itemId].length);
                    const freqValue = dataArrays[itemId][freqIndex] / 255;
                    const size = baseSize + (freqValue * 180);
                    ripple.style.width = size + 'px';
                    ripple.style.height = size + 'px';
                    ripple.style.opacity = 0.3 + (average * 0.3);
                });
            } catch (e) {
                // Fall back to simple animation
                useAudioAnalysis = false;
            }
        } else {
            // Simple pulsing animation when audio analysis isn't available
            const time = Date.now() / 1000;
            ripples.forEach((ripple, index) => {
                const baseSize = 50 + (index * 60);
                const pulse = Math.sin(time * 3 + index) * 0.5 + 0.5;
                const size = baseSize + (pulse * 100);
                ripple.style.width = size + 'px';
                ripple.style.height = size + 'px';
                ripple.style.opacity = 0.2 + (pulse * 0.3);
            });
        }
        spectralAnimations[itemId] = requestAnimationFrame(updateRipples);
    }
    spectralAnimations[itemId] = requestAnimationFrame(updateRipples);
}

function stopSpectralBars(itemId) {
    if (spectralAnimations[itemId]) {
        cancelAnimationFrame(spectralAnimations[itemId]);
        spectralAnimations[itemId] = null;
    }
    for (let i = 0; i < 5; i++) {
        const ripple = document.getElementById(`ripple-${itemId}-${i}`);
        if (ripple) {
            ripple.style.width = '0px';
            ripple.style.height = '0px';
            ripple.style.opacity = '0';
        }
    }
}

// Piano roll functions are in audio.js

// ===== PLAYBACK =====
// REMOVED: Duplicate playItemInGlobalBar - use the one in audio.js instead
/* function playItemInGlobalBar(item, category) {
    if (!item) return;

    // Stop current playback first
    if (globalAudio) {
        globalAudio.pause();
        globalAudio.currentTime = 0;
    }

    // Stop visualizations for previous item
    if (currentlyPlaying) {
        stopSpectralBars(currentlyPlaying);
        stopPianoRollAnimation(currentlyPlaying);
        const prevPlayBtn = document.getElementById(`play-btn-${currentlyPlaying}`);
        if (prevPlayBtn) prevPlayBtn.textContent = '▶';
    }

    document.querySelectorAll('.item-card').forEach(c => c.classList.remove('playing'));

    currentlyPlaying = item.id;
    currentPlayingCategory = category;

    const card = document.querySelector(`[data-item-id="${item.id}"]`);
    if (card) {
        const itemCard = card.querySelector('.item-card');
        if (itemCard) itemCard.classList.add('playing');
    }

    document.getElementById('play-bar-track-title').textContent = item.title;
    document.getElementById('play-bar-track-artist').textContent = item.vst || item.type || 'Unknown';
    document.getElementById('play-bar-album-art').textContent = item.title[0].toUpperCase();

    document.querySelectorAll('.play-bar-btn').forEach(btn => btn.disabled = false);
    document.querySelectorAll('.play-bar-action-btn').forEach(btn => btn.disabled = false);
    document.getElementById('mute-btn').disabled = false;
    updatePlayBarActionStates(item, category);

    if (item.audioBlob) {
        const playBtn = document.getElementById(`play-btn-${item.id}`);
        const scrubProgress = document.getElementById(`scrub-progress-${item.id}`);

        // Reuse single global audio element to prevent memory buildup
        if (!globalAudio) {
            globalAudio = new Audio();
        }
        globalAudio.src = item.audioBlob;
        audioElements[item.id] = globalAudio;

        // Reset to beginning
        globalAudio.currentTime = 0;
        globalAudio.volume = playbackState.volume;
        globalAudio.loop = playbackState.isLooping;

        // Use a unique handler key to avoid duplicate listeners
        const handlerKey = `_playbarHandlers_${item.id}`;

        // Remove old handlers if they exist
        if (globalAudio[handlerKey]) {
            globalAudio.removeEventListener('loadedmetadata', globalAudio[handlerKey].loadedmetadata);
            globalAudio.removeEventListener('timeupdate', globalAudio[handlerKey].timeupdate);
            globalAudio.removeEventListener('ended', globalAudio[handlerKey].ended);
            globalAudio.removeEventListener('pause', globalAudio[handlerKey].pause);
            globalAudio.removeEventListener('play', globalAudio[handlerKey].play);
        }

        // Store reference to the audio element for handlers
        const audioEl = globalAudio;

        // Create new handlers
        const handlers = {
            loadedmetadata: () => {
                playbackState.duration = audioEl.duration;
                document.getElementById('total-time').textContent = formatTime(audioEl.duration);
            },
            timeupdate: () => {
                if (!audioEl.duration) return;
                playbackState.currentTime = audioEl.currentTime;
                const percent = (audioEl.currentTime / audioEl.duration) * 100;
                document.getElementById('play-bar-progress-filled').style.width = percent + '%';
                document.getElementById('current-time').textContent = formatTime(audioEl.currentTime);
                if (scrubProgress) scrubProgress.style.width = percent + '%';
                const scrubTime = document.getElementById(`scrub-time-${item.id}`);
                if (scrubTime) scrubTime.textContent = `${formatTime(audioEl.currentTime)} / ${formatTime(audioEl.duration)}`;
            },
            ended: () => {
                if (playBtn) playBtn.textContent = '▶';
                updatePlayButton(false);
                playbackState.isPlaying = false;
                stopSpectralBars(item.id);
                stopPianoRollAnimation(item.id);
                if (!playbackState.isLooping) playNext();
            },
            pause: () => {
                if (playBtn) playBtn.textContent = '▶';
                stopSpectralBars(item.id);
                stopPianoRollAnimation(item.id);
            },
            play: () => {
                if (playBtn) playBtn.textContent = '❚❚';
                if (category === 'midi' && item.midiNotes) {
                    startPianoRollAnimation(item.id, item.midiNotes, audioEl, item.themeColor || '#0066FF');
                } else {
                    animateSpectralBars(item.id, audioEl);
                }
            }
        };

        // Store handlers reference for later removal
        audioEl[handlerKey] = handlers;

        // Add event listeners
        audioEl.addEventListener('loadedmetadata', handlers.loadedmetadata);
        audioEl.addEventListener('timeupdate', handlers.timeupdate);
        audioEl.addEventListener('ended', handlers.ended);
        audioEl.addEventListener('pause', handlers.pause);
        audioEl.addEventListener('play', handlers.play);

        // If metadata already loaded, update immediately
        if (audioEl.duration) {
            handlers.loadedmetadata();
        }

        // Play the audio - ensure it's ready first
        if (globalAudio.readyState >= 2) {
            globalAudio.play().then(() => {
                updatePlayButton(true);
                playbackState.isPlaying = true;
            }).catch(() => {
                updatePlayButton(false);
                playbackState.isPlaying = false;
            });
        } else {
            const itemId = item.id;
            globalAudio.addEventListener('canplay', function onCanPlay() {
                globalAudio.removeEventListener('canplay', onCanPlay);
                if (currentlyPlaying !== itemId) return; // Skip if navigated away
                globalAudio.play().then(() => {
                    updatePlayButton(true);
                    playbackState.isPlaying = true;
                }).catch(() => {
                    updatePlayButton(false);
                    playbackState.isPlaying = false;
                });
            }, { once: true });
            globalAudio.load();
        }
    }
} */

function updatePlayButton(isPlaying) {
    const btn = document.getElementById('global-play-btn');
    if (isPlaying) {
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    } else {
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    }
}

function getNavigableItems() {
    return items[currentTab];
}

function playNext() {
    const navItems = getNavigableItems();
    if (navItems.length === 0) return;
    const currentIndex = navItems.findIndex(i => i.id === currentlyPlaying);
    const nextIndex = (currentIndex + 1) % navItems.length;
    playItemInGlobalBar(navItems[nextIndex], currentTab);
    currentFocusIndex = nextIndex;
    document.querySelector(`[data-item-id="${navItems[nextIndex].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function playPrevious() {
    const navItems = getNavigableItems();
    if (navItems.length === 0) return;
    const currentIndex = navItems.findIndex(i => i.id === currentlyPlaying);
    const prevIndex = currentIndex <= 0 ? navItems.length - 1 : currentIndex - 1;
    playItemInGlobalBar(navItems[prevIndex], currentTab);
    currentFocusIndex = prevIndex;
    document.querySelector(`[data-item-id="${navItems[prevIndex].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Play bar controls
document.getElementById('global-play-btn').addEventListener('click', () => {
    if (!globalAudio) return;
    if (playbackState.isPlaying) {
        globalAudio.pause();
        updatePlayButton(false);
        playbackState.isPlaying = false;
    } else {
        globalAudio.play();
        updatePlayButton(true);
        playbackState.isPlaying = true;
    }
});

document.getElementById('next-btn').addEventListener('click', playNext);
document.getElementById('prev-btn').addEventListener('click', playPrevious);

// Play bar progress scrubbing with drag support
const playBarProgressBar = document.getElementById('play-bar-progress-bar');
let isScrubbingPlayBar = false;

function updatePlayBarProgress(e) {
    if (!globalAudio || !globalAudio.duration) return;
    const rect = playBarProgressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    globalAudio.currentTime = percent * globalAudio.duration;
}

playBarProgressBar.addEventListener('mousedown', (e) => {
    isScrubbingPlayBar = true;
    updatePlayBarProgress(e);
});

document.addEventListener('mousemove', (e) => {
    if (isScrubbingPlayBar) {
        updatePlayBarProgress(e);
    }
});

document.addEventListener('mouseup', () => {
    isScrubbingPlayBar = false;
});

document.getElementById('volume-slider').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    playbackState.volume = percent;
    document.getElementById('volume-filled').style.width = (percent * 100) + '%';
    if (globalAudio) globalAudio.volume = percent;
});

document.getElementById('mute-btn').addEventListener('click', () => {
    if (playbackState.volume > 0) {
        playbackState.previousVolume = playbackState.volume;
        playbackState.volume = 0;
        document.getElementById('volume-filled').style.width = '0%';
    } else {
        playbackState.volume = playbackState.previousVolume || 0.7;
        document.getElementById('volume-filled').style.width = (playbackState.volume * 100) + '%';
    }
    if (globalAudio) globalAudio.volume = playbackState.volume;
});

// ===== TOGGLE PLAY ON CARD =====
// REMOVED: Duplicate togglePlay - use the one in audio.js instead
/* window.togglePlay = (id, cat) => {
    const item = items[cat].find(i => i.id === id);
    if (!item) return;

    // If this item is currently playing, toggle pause/play
    if (currentlyPlaying === id && globalAudio) {
        if (!globalAudio.paused) {
            globalAudio.pause();
            updatePlayButton(false);
            playbackState.isPlaying = false;
            const playBtn = document.getElementById(`play-btn-${id}`);
            const playIcon = playBtn?.querySelector('.row-play-icon');
            if (playIcon) playIcon.textContent = '▶';
            else if (playBtn) playBtn.textContent = '▶';
        } else {
            globalAudio.play().catch(() => {});
            updatePlayButton(true);
            playbackState.isPlaying = true;
            const playBtn = document.getElementById(`play-btn-${id}`);
            const playIcon = playBtn?.querySelector('.row-play-icon');
            if (playIcon) playIcon.textContent = '❚❚';
            else if (playBtn) playBtn.textContent = '❚❚';
        }
    } else {
        // Play a different item
        playItemInGlobalBar(item, cat);
    }
}; */

// ===== LIBRARY FUNCTIONS =====
// Note: Main implementation is in browse.js with Supabase sync
// This is a fallback if browse.js hasn't loaded yet
if (typeof window.addToLibraryFromCard !== 'function') {
    window.addToLibraryFromCard = async (id, category) => {
        const item = items[category]?.find(i => i.id === id);
        if (!item) return;

        const safeId = Number.isInteger(id) ? id : parseInt(id, 10);
        if (isNaN(safeId)) return;

        const index = library.findIndex(l => l.id === id);
        const btn = document.querySelector(`[data-item-id="${safeId}"] .row-info-btn`);

        if (index === -1) {
            library.push({ id: item.id, title: item.title, vst: item.vst, type: item.type, category: category });
            localStorage.setItem('presetJunkiesLibrary', JSON.stringify(library));
            if (btn) { btn.classList.add('saved'); btn.textContent = 'Saved'; }

            // Sync with Supabase
            try {
                const { user } = await supabaseGetUser();
                if (user && typeof supabaseAddToLibrary === 'function') {
                    await supabaseAddToLibrary(user.id, item.id);
                }
            } catch (err) { console.error('Error syncing library:', err); }
        } else {
            library.splice(index, 1);
            localStorage.setItem('presetJunkiesLibrary', JSON.stringify(library));
            if (btn) { btn.classList.remove('saved'); btn.textContent = 'Save'; }

            // Sync with Supabase
            try {
                const { user } = await supabaseGetUser();
                if (user && typeof supabaseRemoveFromLibrary === 'function') {
                    await supabaseRemoveFromLibrary(user.id, item.id);
                }
            } catch (err) { console.error('Error syncing library:', err); }
        }
    };
}

function renderUnifiedLibrary() {
    const grid = document.getElementById('library-grid');
    grid.innerHTML = '';

    if (library.length === 0) {
        grid.innerHTML = '<div style="color: var(--text-tertiary); padding: 40px 0; text-align: center;">Your library is empty. Add items by clicking the + button on cards.</div>';
        return;
    }

    library.forEach(libItem => {
        const item = items[libItem.category]?.find(i => i.id === libItem.id);
        if (!item) return;

        const wrap = document.createElement('div');
        wrap.dataset.itemId = item.id;
        wrap.innerHTML = createCardHTML(item, libItem.category);
        grid.appendChild(wrap);

        setupCardAudio(item, libItem.category);
    });
}

// ===== HANDLE DOWNLOAD =====
window.handleDownload = (id, cat) => {
    const item = items[cat].find(i => i.id === id);
    if (item && item.presetData) {
        item.downloads++;
        const countEl = document.getElementById(`downloads-count-${id}`);
        if (countEl) countEl.textContent = formatCount(item.downloads);
        const a = document.createElement('a');
        a.href = item.presetData;
        a.download = item.presetName;
        a.click();
    }
};

// ===== TOGGLE LIKE =====
window.toggleLike = (id, cat) => {
    // Prevent race conditions with action lock
    if (typeof withActionLock === 'function') {
        withActionLock(`toggleLike_${id}`, () => toggleLikeInner(id, cat))();
    } else {
        toggleLikeInner(id, cat);
    }
};

function toggleLikeInner(id, cat) {
    const item = items[cat]?.find(i => i.id === id);
    if (!item) return;

    item.liked = !item.liked;
    if (item.liked) {
        item.hearts++;
    } else {
        item.hearts = Math.max(0, item.hearts - 1);
    }

    // Update the heart icon
    const heartIcon = document.getElementById(`heart-icon-${id}`);
    if (heartIcon) {
        heartIcon.setAttribute('fill', item.liked ? '#ff4757' : 'none');
        heartIcon.setAttribute('stroke', item.liked ? '#ff4757' : '#dedede');
    }

    // Update the count
    const countEl = document.getElementById(`hearts-count-${id}`);
    if (countEl) countEl.textContent = formatCount(item.hearts);
}

// ===== PLAY BAR ACTION BUTTONS =====
function updatePlayBarActionStates(item, category) {
    const heartBtn = document.getElementById('play-bar-heart-btn');
    const saveBtn = document.getElementById('play-bar-save-btn');

    // Update heart state
    if (heartBtn) {
        if (item.liked) {
            heartBtn.classList.add('liked');
        } else {
            heartBtn.classList.remove('liked');
        }
    }

    // Update save state
    if (saveBtn) {
        const inLibrary = library.some(l => l.id === item.id);
        if (inLibrary) {
            saveBtn.classList.add('saved');
        } else {
            saveBtn.classList.remove('saved');
        }
    }
}

window.togglePlayBarLike = () => {
    if (!currentlyPlaying || !currentPlayingCategory) return;
    toggleLike(currentlyPlaying, currentPlayingCategory);

    const item = items[currentPlayingCategory].find(i => i.id === currentlyPlaying);
    const heartBtn = document.getElementById('play-bar-heart-btn');
    if (heartBtn && item) {
        if (item.liked) {
            heartBtn.classList.add('liked');
        } else {
            heartBtn.classList.remove('liked');
        }
    }
};

window.openPlayBarComment = () => {
    if (!currentlyPlaying || !currentPlayingCategory) return;
    openCommentModal(currentlyPlaying, currentPlayingCategory);
};

window.downloadPlayBarTrack = () => {
    if (!currentlyPlaying || !currentPlayingCategory) return;
    const item = items[currentPlayingCategory].find(i => i.id === currentlyPlaying);
    if (item && item.presetData) {
        const a = document.createElement('a');
        a.href = item.presetData;
        a.download = item.presetName || item.title;
        a.click();
        item.downloads++;
    }
};

window.savePlayBarTrack = () => {
    if (!currentlyPlaying || !currentPlayingCategory) return;
    addToLibraryFromCard(currentlyPlaying, currentPlayingCategory);

    const item = items[currentPlayingCategory].find(i => i.id === currentlyPlaying);
    const saveBtn = document.getElementById('play-bar-save-btn');
    if (saveBtn && item) {
        const inLibrary = library.some(l => l.id === currentlyPlaying);
        if (inLibrary) {
            saveBtn.classList.add('saved');
        } else {
            saveBtn.classList.remove('saved');
        }
    }
};

// ===== COMMENT MODAL =====
let currentCommentItem = null;
let currentCommentCategory = null;

window.openCommentModal = (id, category) => {
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

    // Set header banner (use uploader's banner if available)
    if (item.uploaderBanner) {
        header.style.backgroundImage = `url('${item.uploaderBanner}')`;
    } else {
        header.style.backgroundImage = 'linear-gradient(135deg, #1a3a5c 0%, #2a5a8c 100%)';
    }

    // Set avatar
    if (item.uploaderAvatar) {
        avatar.style.backgroundImage = `url('${item.uploaderAvatar}')`;
    } else {
        avatar.style.backgroundImage = 'none';
        avatar.style.background = '#666';
    }

    username.textContent = uploaderName;
    morePresetsUsername.textContent = uploaderName;

    // Set follower and upload counts
    const uploaderPresets = items[category].filter(i => i.uploader === uploaderName);
    document.getElementById('comment-modal-followers').textContent = item.uploaderFollowers || 0;
    document.getElementById('comment-modal-uploads').textContent = uploaderPresets.length;

    // Render comments
    list.innerHTML = (item.comments || []).map(c => `
        <div class="comment-item">
            <div class="comment-avatar"></div>
            <div class="comment-content">
                <div class="comment-user">${c.user}</div>
                <div class="comment-text">${c.text}</div>
            </div>
        </div>
    `).join('') || '<div class="no-comments">No comments yet</div>';

    // Render more presets from same uploader
    const otherPresets = items[category].filter(i => i.uploader === uploaderName && i.id !== id).slice(0, 5);
    morePresetsList.innerHTML = otherPresets.length > 0
        ? otherPresets.map(p => createCardHTML(p, category)).join('')
        : '<div class="no-comments">No other presets</div>';

    modal.classList.add('show');
};

window.followUser = () => {
    // Placeholder for follow functionality
    alert('Follow feature coming soon!');
};

window.closeCommentModal = () => {
    document.getElementById('comment-modal').classList.remove('show');
    currentCommentItem = null;
    currentCommentCategory = null;
};

// submitComment is defined in comments.js

// ===== RENDER ITEMS =====
function createCardHTML(item, category) {
    const isProject = category === 'projects';
    const isMidi = category === 'midi';
    const isPreset = category === 'presets';
    const themeColor = '#0066FF';
    const inLibrary = library.some(l => l.id === item.id);

    let wrapperClass = 'item-card-wrapper';
    if (isPreset || isMidi) wrapperClass += ' preset-card';
    else if (isProject) wrapperClass += ' project-card';

    let cardClass = 'item-card item-card-front';
    if (isPreset) cardClass += ' preset-card';
    else if (isMidi) cardClass += ' preset-card midi-card';
    else if (isProject) cardClass += ' project-card';

    let frontContent = '';
    const uploaderName = item.uploader || 'username';

    if (isProject && item.videoBlob) {
        frontContent = `
            <div class="project-video-container">
                <video id="video-${item.id}" controls><source src="${item.videoBlob}" type="video/mp4"></video>
                <div class="project-title-corner">${item.title}</div>
                <div class="project-metadata-overlay">
                    <div class="project-meta-item"><span>Tempo:</span><span>${item.tempo ? item.tempo + ' BPM' : 'N/A'}</span></div>
                    <div class="project-meta-item"><span>Key:</span><span>${item.key || 'N/A'}</span></div>
                    ${item.scale ? `<div class="project-meta-item"><span>Scale:</span><span>${item.scale}</span></div>` : ''}
                    <div class="project-meta-item"><span>Genre:</span><span>${item.genre || 'N/A'}</span></div>
                </div>
            </div>
        `;
    } else {
        const soundType = item.type || item.vst || category;
        const tagsToShow = (item.tags || []).slice(0, 3);
        frontContent = `
            <div class="player-container" style="${item.coverArt ? `background-image: url('${item.coverArt}'); background-size: cover; background-position: center;` : ''}">
                <div class="item-title">${item.title}</div>
                <div class="card-meta-stack">
                    <div class="card-vst-badge">${item.vst || 'Unknown'}</div>
                    <div class="card-sound-type">${item.type || ''}</div>
                    <div class="card-tags-row">${tagsToShow.map(tag => `<span class="card-mini-tag">${tag}</span>`).join('')}</div>
                </div>
                <div class="card-uploader" data-action="viewUserProfile" data-username="${escapeAttr(uploaderName)}">
                    <div class="card-uploader-icon">👤</div>
                    <span class="card-uploader-name">${escapeHTML(uploaderName)}</span>
                </div>
            </div>
            <div class="card-icons-row">
                <div class="card-icon-item row-play-btn" id="play-btn-${item.id}" data-action="togglePlay" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}">
                    <span class="row-play-icon">▶</span>
                </div>
                <div class="card-icon-item" data-action="toggleLike" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${item.liked ? '#ff4757' : 'none'}" stroke="${item.liked ? '#ff4757' : '#dedede'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="card-icon heart-icon" id="heart-icon-${item.id}"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>
                    <span class="card-icon-count" id="hearts-count-${item.id}">${formatCount(item.hearts)}</span>
                </div>
                <div class="card-icon-item" data-action="openCommentModal" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dedede" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="card-icon message-icon"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 11h.01"/></svg>
                    <span class="card-icon-count" id="comments-count-${item.id}">${formatCount(item.comments?.length || 0)}</span>
                </div>
                <div class="card-icon-item" data-action="downloadCardItem" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dedede" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="card-icon download-icon"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>
                    <span class="card-icon-count" id="downloads-count-${item.id}">${formatCount(item.downloads)}</span>
                </div>
                <button class="row-info-btn" data-action="saveCardItem" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}">Save</button>
            </div>
        `;
    }

    const backContent = `
        <button class="card-back-close" data-action="toggleCardInfo" data-id="${escapeAttr(String(item.id))}">×</button>
        <div class="card-back-description">${escapeHTML(item.description || 'No description')}</div>
        <div class="card-back-tags">${(item.tags || []).map(tag => `<span class="card-back-tag">${escapeHTML(tag)}</span>`).join('')}</div>
    `;

    return `
        <div class="${wrapperClass}">
            <div class="item-card-inner">
                <div class="${cardClass}">${frontContent}</div>
                <div class="item-card-back">${backContent}</div>
            </div>
        </div>
    `;
}

function setupCardAudio(item, category) {
    if (!item.audioBlob || category === 'projects') return;

    // Use requestAnimationFrame for better timing than setTimeout
    requestAnimationFrame(() => {
        // Only create audio element if it doesn't exist
        if (!audioElements[item.id]) {
            audioElements[item.id] = new Audio(item.audioBlob);
        }

        const scrubBar = document.getElementById(`scrub-bar-${item.id}`);
        if (scrubBar && !scrubBar.dataset.initialized) {
            scrubBar.dataset.initialized = 'true';
            let isScrubbing = false;

            const updateScrub = (e) => {
                // Use globalAudio if this item is currently playing
                const audio = (currentlyPlaying === item.id && globalAudio) ? globalAudio : audioElements[item.id];
                if (!audio || !audio.duration) return;
                const rect = scrubBar.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                audio.currentTime = percent * audio.duration;
            };

            scrubBar.addEventListener('mousedown', (e) => {
                isScrubbing = true;
                updateScrub(e);
                e.stopPropagation();
            });

            const mouseMoveHandler = (e) => {
                if (isScrubbing) {
                    updateScrub(e);
                }
            };

            const mouseUpHandler = () => {
                isScrubbing = false;
            };

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        }

        // Piano roll rendering for MIDI
        if (category === 'midi' && item.midiNotes) {
            renderPianoRoll(item.id, item.midiNotes, item.themeColor || '#0066FF');
        }
    });
}

function renderItems(category) {
    const grid = document.getElementById(`${category}-grid`);
    if (!grid) return;

    grid.innerHTML = '';

    if (items[category].length === 0) {
        grid.innerHTML = `<div style="color: var(--text-tertiary); padding: 40px 0; text-align: center;">No ${category} uploaded yet</div>`;
        return;
    }

    items[category].forEach(item => {
        const wrap = document.createElement('div');
        wrap.dataset.itemId = item.id;
        wrap.dataset.vst = item.vst || '';
        wrap.dataset.type = item.type || '';
        wrap.dataset.tags = item.tags.join(',').toLowerCase();
        wrap.dataset.title = item.title.toLowerCase();

        wrap.innerHTML = createCardHTML(item, category);
        grid.appendChild(wrap);

        setupCardAudio(item, category);
    });
}

// ===== UPLOAD FORM HANDLERS =====
document.getElementById('preset-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('preset-title').value;
    const vst = getAutocompleteValue('preset-vst');
    const type = getAutocompleteValue('preset-type');
    const tags = document.getElementById('preset-tags').value.split(',').map(t => t.trim()).filter(t => t);
    const presetFile = document.getElementById('preset-file').files[0];
    const audioFile = document.getElementById('preset-audio').files[0];
    const coverFile = document.getElementById('preset-cover').files[0];

    if (!presetFile || !type || !vst) {
        alert('Please select preset file, type, and VST');
        return;
    }

    const reader = new FileReader();
    reader.onload = function() {
        const audioUrl = audioFile ? URL.createObjectURL(audioFile) : null;
        const coverUrl = coverFile ? URL.createObjectURL(coverFile) : null;

        const item = {
            id: Date.now(),
            hearts: 0, downloads: 0, plays: 0, liked: false,
            title, type, tags, vst,
            presetData: reader.result,
            presetName: presetFile.name,
            audioBlob: audioUrl,
            coverArt: coverUrl,
            themeColor: '#0066FF',
            comments: [],
            username: 'user' + Math.floor(Math.random() * 1000)
        };
        items.presets.push(item);

        renderItems('presets');
        closeUploadModal();
        document.getElementById('preset-form').reset();
        document.querySelectorAll('#upload-presets .file-upload-area').forEach(area => {
            area.classList.remove('has-file');
            area.querySelector('p').textContent = 'Click to upload';
        });
    };
    reader.readAsDataURL(presetFile);
});

document.getElementById('sample-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('sample-title').value;
    const type = getAutocompleteValue('sample-type');
    const key = getAutocompleteValue('sample-key');
    const bpm = document.getElementById('sample-bpm').value;
    const tags = document.getElementById('sample-tags').value.split(',').map(t => t.trim()).filter(t => t);
    const audioFile = document.getElementById('sample-audio').files[0];
    const coverFile = document.getElementById('sample-cover').files[0];

    if (!audioFile) {
        alert('Please select an audio file');
        return;
    }

    const reader = new FileReader();
    reader.onload = function() {
        const audioUrl = URL.createObjectURL(audioFile);
        const coverUrl = coverFile ? URL.createObjectURL(coverFile) : null;

        const item = {
            id: Date.now(),
            hearts: 0, downloads: 0, plays: 0, liked: false,
            title, key, bpm, type: type || 'sample',
            tags: [...tags, key, bpm].filter(t => t),
            presetData: reader.result,
            presetName: audioFile.name,
            audioBlob: audioUrl,
            coverArt: coverUrl,
            themeColor: '#0066FF',
            comments: [],
            username: 'user' + Math.floor(Math.random() * 1000),
            vst: ''
        };
        items.samples.push(item);

        renderItems('samples');
        closeUploadModal();
        document.getElementById('sample-form').reset();
    };
    reader.readAsDataURL(audioFile);
});

document.getElementById('midi-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('midi-title').value;
    const tags = document.getElementById('midi-tags').value.split(',').map(t => t.trim()).filter(t => t);
    const midiFile = document.getElementById('midi-file').files[0];
    const audioFile = document.getElementById('midi-audio').files[0];
    const coverFile = document.getElementById('midi-cover').files[0];

    if (!midiFile) {
        alert('Please select a MIDI file');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function() {
        let midiNotes = null;
        try {
            const midiData = await Midi.fromUrl(reader.result);
            midiNotes = {
                duration: midiData.duration,
                tracks: midiData.tracks.map(track => ({
                    notes: track.notes.map(note => ({
                        midi: note.midi,
                        time: note.time,
                        duration: note.duration,
                        velocity: note.velocity
                    }))
                }))
            };
        } catch (e) {
            // MIDI parsing failed - continue without notes
        }

        const audioUrl = audioFile ? URL.createObjectURL(audioFile) : null;
        const coverUrl = coverFile ? URL.createObjectURL(coverFile) : null;

        const item = {
            id: Date.now(),
            hearts: 0, downloads: 0, plays: 0, liked: false,
            title, type: 'midi', tags,
            presetData: reader.result,
            presetName: midiFile.name,
            audioBlob: audioUrl,
            coverArt: coverUrl,
            themeColor: '#0066FF',
            midiNotes: midiNotes,
            comments: [],
            username: 'user' + Math.floor(Math.random() * 1000),
            vst: ''
        };
        items.midi.push(item);

        renderItems('midi');
        closeUploadModal();
        document.getElementById('midi-form').reset();
    };
    reader.readAsDataURL(midiFile);
});

document.getElementById('project-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('project-title').value;
    const daw = getAutocompleteValue('project-daw');
    const tempo = document.getElementById('project-tempo').value;
    const key = getAutocompleteValue('project-key');
    const scale = getAutocompleteValue('project-scale');
    const timeSignature = document.getElementById('project-time-signature').value;
    const genre = document.getElementById('project-genre').value;
    const tags = document.getElementById('project-tags').value.split(',').map(t => t.trim()).filter(t => t);
    const projectFile = document.getElementById('project-file').files[0];
    const demoFile = document.getElementById('project-demo').files[0];

    if (!projectFile || !daw) {
        alert('Please select project file and DAW');
        return;
    }

    const reader = new FileReader();
    reader.onload = function() {
        let videoUrl = null;
        let audioUrl = null;
        if (demoFile && demoFile.type.startsWith('video/')) {
            videoUrl = URL.createObjectURL(demoFile);
        } else if (demoFile) {
            audioUrl = URL.createObjectURL(demoFile);
        }

        const item = {
            id: Date.now(),
            hearts: 0, downloads: 0, plays: 0, liked: false,
            title, daw, tempo, key, scale, timeSignature, genre,
            type: 'project',
            tags: [...tags, genre, key, scale, timeSignature].filter(t => t),
            presetData: reader.result,
            presetName: projectFile.name,
            themeColor: '#0066FF',
            comments: [],
            username: 'user' + Math.floor(Math.random() * 1000)
        };

        if (videoUrl) {
            item.videoBlob = videoUrl;
        } else if (audioUrl) {
            item.audioBlob = audioUrl;
        }

        items.projects.push(item);

        renderItems('projects');
        closeUploadModal();
        document.getElementById('project-form').reset();
    };
    reader.readAsDataURL(projectFile);
});

// ===== KEYBOARD NAVIGATION =====
let currentFocusIndex = -1;
let autoPlayEnabled = true;

function getVisibleItems() {
    const activePanel = document.querySelector('.tab-panel.active');
    if (!activePanel) return [];
    const grid = activePanel.querySelector('.items-grid');
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('[data-item-id]')).filter(el => el.style.display !== 'none');
}

function getGridColumnsCount() {
    const grid = document.querySelector('.items-grid');
    if (!grid) return 3;
    const gridStyle = window.getComputedStyle(grid);
    const templateColumns = gridStyle.getPropertyValue('grid-template-columns');
    return templateColumns.split(' ').length;
}

function moveFocus(direction) {
    const visibleItems = getVisibleItems();
    if (visibleItems.length === 0) return;

    if (currentFocusIndex === -1) {
        currentFocusIndex = 0;
    } else {
        currentFocusIndex = (currentFocusIndex + direction + visibleItems.length) % visibleItems.length;
    }

    updateFocus(visibleItems);

    // If card is flipped, update to new item
    if (flippedCards.size > 0) {
        const focusedItem = visibleItems[currentFocusIndex];
        const newItemId = parseInt(focusedItem.dataset.itemId);
        closeAllFlippedCards();

        const item = items[currentTab].find(i => i.id === newItemId);
        if (item) {
            playItemInGlobalBar(item, currentTab);
            setTimeout(() => toggleCardFlip(newItemId), 100);
        }
    } else if (autoPlayEnabled) {
        setTimeout(() => activateFocusedItem(visibleItems), 300);
    }
}

function updateFocus(visibleItems) {
    visibleItems.forEach(item => {
        item.classList.remove('focused');
        const card = item.querySelector('.item-card');
        if (card) card.style.transform = '';
    });

    if (currentFocusIndex >= 0 && currentFocusIndex < visibleItems.length) {
        const focusedItem = visibleItems[currentFocusIndex];
        focusedItem.classList.add('focused');
        const card = focusedItem.querySelector('.item-card');
        if (card) {
            card.style.transform = 'translateY(-5px)';
            card.style.boxShadow = '0 0 25px var(--theme-color)';
        }
        focusedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function resetFocus() {
    currentFocusIndex = -1;
    getVisibleItems().forEach(item => {
        item.classList.remove('focused');
        const card = item.querySelector('.item-card');
        if (card) {
            card.style.transform = '';
            card.style.boxShadow = '';
        }
    });
}

function activateFocusedItem(visibleItems) {
    if (currentFocusIndex >= 0 && currentFocusIndex < visibleItems.length) {
        const focusedItem = visibleItems[currentFocusIndex];
        const itemId = parseInt(focusedItem.dataset.itemId);
        const item = items[currentTab].find(i => i.id === itemId);
        if (item) {
            playItemInGlobalBar(item, currentTab);
        }
    }
}

function navigateCardBack(direction) {
    const wasFlipped = flippedCards.size > 0;

    if (direction === 'next') {
        playNext();
    } else if (direction === 'prev') {
        playPrevious();
    }

    if (wasFlipped && currentlyPlaying) {
        closeAllFlippedCards();
        setTimeout(() => toggleCardFlip(currentlyPlaying), 100);
    }
}
window.navigateCardBack = navigateCardBack;

document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    const visibleItems = getVisibleItems();

    switch(e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            moveFocus(-1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            moveFocus(1);
            break;
        case 'ArrowUp':
            e.preventDefault();
            moveFocus(-getGridColumnsCount());
            break;
        case 'ArrowDown':
            e.preventDefault();
            moveFocus(getGridColumnsCount());
            break;
        case ' ':
            e.preventDefault();
            if (globalAudio) {
                if (playbackState.isPlaying) {
                    globalAudio.pause();
                    updatePlayButton(false);
                    playbackState.isPlaying = false;
                } else {
                    globalAudio.currentTime = 0;
                    globalAudio.play();
                    updatePlayButton(true);
                    playbackState.isPlaying = true;
                }
            }
            break;
        case 'Escape':
            e.preventDefault();
            if (flippedCards.size > 0) {
                closeAllFlippedCards();
            } else {
                resetFocus();
            }
            break;
    }
});

// ===== PROFILE TABS =====
document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        // Remove active from all tabs
        document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
        // Add active to clicked tab
        this.classList.add('active');

        // Hide all panels
        document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('active'));

        // Show the corresponding panel
        const tabName = this.getAttribute('data-profile-tab');
        const panelId = `profile-${tabName}-panel`;
        document.getElementById(panelId).classList.add('active');
    });
});

// ===== BANNER IMAGE UPLOAD =====
document.getElementById('banner-img-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const banner = document.querySelector('.profile-banner');
            banner.style.backgroundImage = `url(${event.target.result})`;
            localStorage.setItem('profileBanner', event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

// Load saved banner on page load
const savedBanner = localStorage.getItem('profileBanner');
if (savedBanner) {
    document.querySelector('.profile-banner').style.backgroundImage = `url(${savedBanner})`;
}

// Remove banner background
document.getElementById('banner-remove-btn').addEventListener('click', function() {
    const banner = document.querySelector('.profile-banner');
    banner.style.backgroundImage = '';
    localStorage.removeItem('profileBanner');
});

// ===== AUTOCOMPLETE FUNCTIONALITY =====
const autocompleteOptions = {
    vst: [
        { value: 'serum', label: 'Serum' },
        { value: 'serum 2', label: 'Serum 2' },
        { value: 'sylenth1', label: 'Sylenth1' },
        { value: 'massive', label: 'Massive' },
        { value: 'diva', label: 'Diva' },
        { value: 'vital', label: 'Vital' },
        { value: 'omnisphere', label: 'Omnisphere' }
    ],
    soundType: [
        { value: 'arp', label: 'Arp' },
        { value: 'atmosphere', label: 'Atmosphere' },
        { value: 'bass', label: 'Bass' },
        { value: 'bell', label: 'Bell' },
        { value: 'brass', label: 'Brass' },
        { value: 'chord', label: 'Chord' },
        { value: 'drone', label: 'Drone' },
        { value: 'fx', label: 'FX' },
        { value: 'keys', label: 'Keys' },
        { value: 'lead', label: 'Lead' },
        { value: 'pad', label: 'Pad' },
        { value: 'piano', label: 'Piano' },
        { value: 'pluck', label: 'Pluck' },
        { value: 'soundscape', label: 'Soundscape' },
        { value: 'string', label: 'String' },
        { value: 'synth', label: 'Synth' },
        { value: 'vocal', label: 'Vocal' }
    ],
    sampleType: [
        { value: 'drum', label: 'Drum' },
        { value: 'bass', label: 'Bass' },
        { value: 'melody', label: 'Melody' },
        { value: 'vocal', label: 'Vocal' },
        { value: 'fx', label: 'FX' },
        { value: 'percussion', label: 'Percussion' },
        { value: 'synth', label: 'Synth' },
        { value: 'guitar', label: 'Guitar' },
        { value: 'piano', label: 'Piano' }
    ],
    daw: [
        { value: 'flstudio', label: 'FL Studio' },
        { value: 'ableton', label: 'Ableton' },
        { value: 'studioone', label: 'Studio One' },
        { value: 'protools', label: 'Pro Tools' },
        { value: 'logic', label: 'Logic' },
        { value: 'reaper', label: 'Reaper' },
        { value: 'reason', label: 'Reason' },
        { value: 'cubase', label: 'Cubase' },
        { value: 'cakewalk', label: 'Cakewalk' },
        { value: 'bitwig', label: 'Bitwig' }
    ],
    key: [
        { value: 'A', label: 'A' },
        { value: 'A#', label: 'A#' },
        { value: 'B', label: 'B' },
        { value: 'C', label: 'C' },
        { value: 'C#', label: 'C#' },
        { value: 'D', label: 'D' },
        { value: 'D#', label: 'D#' },
        { value: 'E', label: 'E' },
        { value: 'F', label: 'F' },
        { value: 'F#', label: 'F#' },
        { value: 'G', label: 'G' },
        { value: 'G#', label: 'G#' },
        { value: 'Am', label: 'Am' },
        { value: 'Bm', label: 'Bm' },
        { value: 'Cm', label: 'Cm' },
        { value: 'Dm', label: 'Dm' },
        { value: 'Em', label: 'Em' },
        { value: 'Fm', label: 'Fm' },
        { value: 'Gm', label: 'Gm' }
    ],
    scale: [
        { value: 'Major', label: 'Major' },
        { value: 'Minor', label: 'Minor' },
        { value: 'Harmonic Minor', label: 'Harmonic Minor' },
        { value: 'Melodic Minor', label: 'Melodic Minor' },
        { value: 'Dorian', label: 'Dorian' },
        { value: 'Phrygian', label: 'Phrygian' },
        { value: 'Lydian', label: 'Lydian' },
        { value: 'Mixolydian', label: 'Mixolydian' },
        { value: 'Pentatonic', label: 'Pentatonic' },
        { value: 'Blues', label: 'Blues' }
    ]
};

function initAutocomplete() {
    document.querySelectorAll('.autocomplete-input').forEach(input => {
        const type = input.dataset.autocomplete;
        const options = autocompleteOptions[type];
        if (!options) return;

        const dropdown = input.nextElementSibling;
        let highlightedIndex = -1;
        let selectedValue = null;

        // Store selected value on the input
        input.dataset.selectedValue = '';

        function showDropdown(filteredOptions) {
            dropdown.innerHTML = '';
            highlightedIndex = -1;

            if (filteredOptions.length === 0) {
                dropdown.innerHTML = '<div class="autocomplete-no-results">No matches found</div>';
                dropdown.classList.add('show');
                return;
            }

            filteredOptions.forEach((opt, index) => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                if (opt.value === selectedValue) {
                    item.classList.add('selected');
                }
                item.textContent = opt.label;
                item.dataset.value = opt.value;
                item.dataset.index = index;

                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectOption(opt);
                });

                item.addEventListener('mouseenter', () => {
                    highlightedIndex = index;
                    updateHighlight();
                });

                dropdown.appendChild(item);
            });

            dropdown.classList.add('show');
        }

        function hideDropdown() {
            dropdown.classList.remove('show');
            highlightedIndex = -1;
        }

        function selectOption(opt) {
            input.value = opt.label;
            input.dataset.selectedValue = opt.value;
            selectedValue = opt.value;
            input.classList.add('has-value');
            hideDropdown();
        }

        function updateHighlight() {
            dropdown.querySelectorAll('.autocomplete-item').forEach((item, index) => {
                item.classList.toggle('highlighted', index === highlightedIndex);
            });
        }

        function filterOptions(query) {
            if (!query) return options;
            const lower = query.toLowerCase();
            return options.filter(opt =>
                opt.label.toLowerCase().includes(lower) ||
                opt.value.toLowerCase().includes(lower)
            );
        }

        // Input events
        input.addEventListener('focus', () => {
            showDropdown(filterOptions(input.value));
        });

        input.addEventListener('input', () => {
            // Clear selected value if user is typing
            if (input.value !== options.find(o => o.value === selectedValue)?.label) {
                input.dataset.selectedValue = '';
                selectedValue = null;
                input.classList.remove('has-value');
            }
            showDropdown(filterOptions(input.value));
        });

        input.addEventListener('blur', () => {
            // Small delay to allow click on dropdown item
            setTimeout(() => {
                // If input doesn't match a valid option, clear it
                const matchedOption = options.find(opt =>
                    opt.label.toLowerCase() === input.value.toLowerCase()
                );
                if (matchedOption) {
                    input.value = matchedOption.label;
                    input.dataset.selectedValue = matchedOption.value;
                    selectedValue = matchedOption.value;
                    input.classList.add('has-value');
                } else if (!selectedValue) {
                    input.value = '';
                    input.dataset.selectedValue = '';
                    input.classList.remove('has-value');
                }
                hideDropdown();
            }, 150);
        });

        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.autocomplete-item');
            const filteredOptions = filterOptions(input.value);

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
                    updateHighlight();
                    if (items[highlightedIndex]) {
                        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    highlightedIndex = Math.max(highlightedIndex - 1, 0);
                    updateHighlight();
                    if (items[highlightedIndex]) {
                        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
                    }
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                        selectOption(filteredOptions[highlightedIndex]);
                    } else if (filteredOptions.length === 1) {
                        selectOption(filteredOptions[0]);
                    }
                    break;
                case 'Escape':
                    hideDropdown();
                    input.blur();
                    break;
                case 'Tab':
                    if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                        selectOption(filteredOptions[highlightedIndex]);
                    }
                    hideDropdown();
                    break;
            }
        });
    });
}

// Helper function to get autocomplete value (use this instead of .value for autocomplete inputs)
function getAutocompleteValue(inputId) {
    const input = document.getElementById(inputId);
    return input?.dataset.selectedValue || input?.value || '';
}

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
    updateDynamicFilters('presets');
    ['presets', 'samples', 'midi', 'projects'].forEach(cat => renderItems(cat));

    // Hide filter panel on initial load (presets is default)
    const filterPanel = document.getElementById('filter-panel');
    const contentArea = document.querySelector('.content-area');
    if (filterPanel) filterPanel.style.display = 'none';
    if (contentArea) contentArea.style.marginLeft = '0';

    // Load saved presets background
    const savedPresetsBg = localStorage.getItem('presetsBg');
    if (savedPresetsBg) {
        const presetsBgOverlay = document.getElementById('presets-bg-overlay');
        if (presetsBgOverlay) presetsBgOverlay.style.backgroundImage = `url('${savedPresetsBg}')`;
    }

    // Initialize autocomplete fields
    initAutocomplete();
});

// ===== PRESETS BACKGROUND UPLOAD =====
const presetsBgInput = document.getElementById('presets-bg-input');
if (presetsBgInput) {
    presetsBgInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const overlay = document.getElementById('presets-bg-overlay');
                if (overlay) {
                    overlay.style.backgroundImage = `url('${e.target.result}')`;
                    localStorage.setItem('presetsBg', e.target.result);
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

