// ===== UPLOAD SYSTEM =====

// ===== GLOBAL TAG TRACKING =====
// Stores all user-created tags with their usage counts
function getGlobalTags() {
    try {
        return JSON.parse(localStorage.getItem('globalTags') || '{}');
    } catch (e) {
        return {};
    }
}

function saveGlobalTags(tags) {
    try {
        localStorage.setItem('globalTags', JSON.stringify(tags));
    } catch (e) {
        // Ignore storage errors
    }
}

// Increment tag count (called when tag is used in an upload)
function incrementTagCount(tag) {
    if (!tag) return;
    const normalizedTag = tag.toUpperCase().trim();
    const tags = getGlobalTags();
    tags[normalizedTag] = (tags[normalizedTag] || 0) + 1;
    saveGlobalTags(tags);
}

// Decrement tag count (called when an item with tags is deleted)
function decrementTagCount(tag) {
    if (!tag) return;
    const normalizedTag = tag.toUpperCase().trim();
    const tags = getGlobalTags();
    if (tags[normalizedTag]) {
        tags[normalizedTag] = Math.max(0, tags[normalizedTag] - 1);
        // Remove tag entirely if count reaches 0
        if (tags[normalizedTag] === 0) {
            delete tags[normalizedTag];
        }
        saveGlobalTags(tags);
    }
}

// Decrement counts for multiple tags (used when deleting an item)
function decrementTagCounts(tagsArray) {
    if (!tagsArray || !Array.isArray(tagsArray)) return;
    tagsArray.forEach(tag => decrementTagCount(tag));
}

// Make decrement function globally available
window.decrementTagCounts = decrementTagCounts;

// Get tag suggestions based on input (returns array sorted by count)
function getTagSuggestions(query) {
    const tags = getGlobalTags();
    const normalizedQuery = (query || '').toUpperCase().trim();

    // Convert to array with counts
    const tagArray = Object.entries(tags).map(([tag, count]) => ({
        tag,
        count
    }));

    // Filter by query if provided
    const filtered = normalizedQuery
        ? tagArray.filter(t => t.tag.includes(normalizedQuery))
        : tagArray;

    // Sort by count (highest first)
    filtered.sort((a, b) => b.count - a.count);

    // Return top 10
    return filtered.slice(0, 10);
}

// Current upload state
let currentUploadCategory = 'presets';
let uploadTags = [];
window.uploadPreviewItem = null;
let uploadMidiNotes = null;
let uploadFiles = {
    main: null,
    audio: null,
    cover: null,
    video: null
};

// Multi-upload state
let uploadItems = []; // Array of upload item states
let activeUploadIndex = 0;

// Create empty upload item state
function createEmptyUploadItem() {
    return {
        title: '',
        vst: '',
        vstLabel: '',
        type: '',
        typeLabel: '',
        loopType: '',
        sampleType: '',
        sampleTypeLabel: '',
        key: '',
        keyLabel: '',
        bpm: '',
        daw: '',
        dawLabel: '',
        tempo: '',
        projectKey: '',
        projectKeyLabel: '',
        scale: '',
        scaleLabel: '',
        midiKey: '',
        midiKeyLabel: '',
        midiScale: '',
        midiScaleLabel: '',
        genre: '',
        description: '',
        tags: [],
        midiNotes: null,
        files: {
            main: null,
            audio: null,
            cover: null,
            video: null
        }
    };
}

// Initialize upload items with one empty item
function initUploadItems() {
    uploadItems = [createEmptyUploadItem()];
    activeUploadIndex = 0;
    // Sync current form state with the empty item
    uploadTags = [];
    uploadFiles = { main: null, audio: null, cover: null, video: null };
    renderUploadTabs();
}

// Save current form state to active item
function saveCurrentItemState() {
    if (!uploadItems[activeUploadIndex]) return;

    const item = uploadItems[activeUploadIndex];
    item.title = document.getElementById('upload-title')?.value || '';
    item.vst = document.getElementById('upload-vst')?.dataset.selectedValue || '';
    item.vstLabel = document.getElementById('upload-vst')?.value || '';
    item.type = document.getElementById('upload-type')?.dataset.selectedValue || '';
    item.typeLabel = document.getElementById('upload-type')?.value || '';
    item.loopType = document.getElementById('upload-loop-type')?.value || '';
    item.sampleType = document.getElementById('upload-sample-type')?.dataset.selectedValue || '';
    item.sampleTypeLabel = document.getElementById('upload-sample-type')?.value || '';
    item.key = document.getElementById('upload-key')?.dataset.selectedValue || '';
    item.keyLabel = document.getElementById('upload-key')?.value || '';
    const bpmValue = document.getElementById('upload-bpm')?.value || '';
    item.bpm = /^\d{1,3}$/.test(bpmValue) ? bpmValue : '';
    item.daw = document.getElementById('upload-daw')?.dataset.selectedValue || '';
    item.dawLabel = document.getElementById('upload-daw')?.value || '';
    item.tempo = document.getElementById('upload-tempo')?.value || '';
    item.projectKey = document.getElementById('upload-project-key')?.dataset.selectedValue || '';
    item.projectKeyLabel = document.getElementById('upload-project-key')?.value || '';
    item.scale = document.getElementById('upload-scale')?.dataset.selectedValue || '';
    item.scaleLabel = document.getElementById('upload-scale')?.value || '';
    // MIDI-specific key and scale
    item.midiKey = document.getElementById('upload-midi-key')?.dataset.selectedValue || '';
    item.midiKeyLabel = document.getElementById('upload-midi-key')?.value || '';
    item.midiScale = document.getElementById('upload-midi-scale')?.dataset.selectedValue || '';
    item.midiScaleLabel = document.getElementById('upload-midi-scale')?.value || '';
    item.genre = document.getElementById('upload-genre')?.dataset.selectedValue || document.getElementById('upload-genre')?.value ||
                 document.getElementById('upload-originals-genre')?.dataset.selectedValue || document.getElementById('upload-originals-genre')?.value || '';
    item.description = document.getElementById('upload-description')?.value || '';
    item.tags = [...uploadTags];
    item.files = { ...uploadFiles };
}

// Load item state into form
function loadItemState(index) {
    const item = uploadItems[index];
    if (!item) return;

    const titleEl = document.getElementById('upload-title');
    if (titleEl) titleEl.value = item.title;

    const vstInput = document.getElementById('upload-vst');
    if (vstInput) {
        vstInput.value = item.vstLabel;
        vstInput.dataset.selectedValue = item.vst;
    }

    const typeInput = document.getElementById('upload-type');
    if (typeInput) {
        typeInput.value = item.typeLabel;
        typeInput.dataset.selectedValue = item.type;
    }

    const loopTypeSelect = document.getElementById('upload-loop-type');
    const sampleTypeLabel = document.getElementById('upload-sample-type-label');
    const sampleSubtypeGroup = document.getElementById('upload-sample-subtype-group');
    if (loopTypeSelect) {
        loopTypeSelect.value = item.loopType || '';
        // Update label and visibility based on selection
        if (sampleTypeLabel) {
            if (item.loopType === 'Loop') {
                sampleTypeLabel.innerHTML = 'Loop <span class="required">*</span>';
                if (sampleSubtypeGroup) sampleSubtypeGroup.style.display = '';
            } else if (item.loopType === 'One Shot') {
                sampleTypeLabel.innerHTML = 'One Shot <span class="required">*</span>';
                if (sampleSubtypeGroup) sampleSubtypeGroup.style.display = '';
            } else {
                sampleTypeLabel.innerHTML = '&nbsp;<span class="required">*</span>';
                if (sampleSubtypeGroup) sampleSubtypeGroup.style.display = 'none';
            }
        }
    }

    const sampleTypeInput = document.getElementById('upload-sample-type');
    if (sampleTypeInput) {
        sampleTypeInput.value = item.sampleTypeLabel;
        sampleTypeInput.dataset.selectedValue = item.sampleType;
    }

    const keyInput = document.getElementById('upload-key');
    if (keyInput) {
        keyInput.value = item.keyLabel;
        keyInput.dataset.selectedValue = item.key;
    }

    const bpmEl = document.getElementById('upload-bpm');
    if (bpmEl) bpmEl.value = item.bpm;

    const dawInput = document.getElementById('upload-daw');
    if (dawInput) {
        dawInput.value = item.dawLabel;
        dawInput.dataset.selectedValue = item.daw;
    }

    const tempoEl = document.getElementById('upload-tempo');
    if (tempoEl) tempoEl.value = item.tempo;

    const projectKeyInput = document.getElementById('upload-project-key');
    if (projectKeyInput) {
        projectKeyInput.value = item.projectKeyLabel;
        projectKeyInput.dataset.selectedValue = item.projectKey;
    }

    const scaleInput = document.getElementById('upload-scale');
    if (scaleInput) {
        scaleInput.value = item.scaleLabel;
        scaleInput.dataset.selectedValue = item.scale;
    }

    // MIDI-specific key and scale
    const midiKeyInput = document.getElementById('upload-midi-key');
    if (midiKeyInput) {
        midiKeyInput.value = item.midiKeyLabel || '';
        midiKeyInput.dataset.selectedValue = item.midiKey || '';
    }

    const midiScaleInput = document.getElementById('upload-midi-scale');
    if (midiScaleInput) {
        midiScaleInput.value = item.midiScaleLabel || '';
        midiScaleInput.dataset.selectedValue = item.midiScale || '';
    }

    const genreEl = document.getElementById('upload-genre');
    const descEl = document.getElementById('upload-description');
    if (genreEl) genreEl.value = item.genre;
    if (descEl) descEl.value = item.description;

    uploadTags = [...item.tags];
    renderUploadTags();

    uploadFiles = { ...item.files };
    updateFileButtonStates();

    updateUploadPreview();
}

// Update file button visual states
function updateFileButtonStates() {
    ['main', 'audio', 'cover', 'video'].forEach(type => {
        const btn = document.getElementById(`upload-file-${type}-btn`);
        const status = document.getElementById(`upload-file-${type}-status`);

        if (uploadFiles[type]) {
            btn?.classList.add('has-file');
            if (status) {
                const name = uploadFiles[type].name;
                status.textContent = name.length > 20 ? name.substring(0, 17) + '...' : name;
            }
        } else {
            btn?.classList.remove('has-file');
            if (status) {
                // Main and video are required, audio required for presets/samples
                if (type === 'main' || type === 'video') {
                    status.textContent = 'Required';
                } else if (type === 'audio' && (currentUploadCategory === 'presets' || currentUploadCategory === 'samples' || currentUploadCategory === 'midi')) {
                    status.textContent = 'Required';
                } else {
                    status.textContent = 'Optional';
                }
            }
        }
    });
}

// Render upload tabs
function renderUploadTabs() {
    const container = document.getElementById('upload-items-tabs');
    if (!container) return;

    const categoryLabels = {
        presets: 'Preset',
        samples: 'Sample',
        midi: 'MIDI',
        projects: 'Project',
        originals: 'Original'
    };
    const label = categoryLabels[currentUploadCategory] || 'Item';

    container.innerHTML = uploadItems.map((item, index) => {
        const hasContent = item.title || item.files.main || item.files.audio;
        // Show title if it exists, otherwise show "Preset 1", "Sample 2", etc.
        const tabLabel = item.title ? item.title : `${label} ${index + 1}`;
        return `
            <button class="upload-item-tab ${index === activeUploadIndex ? 'active' : ''} ${hasContent ? 'has-content' : ''}" data-index="${index}">
                <span class="upload-item-tab-label">${escapeHTML(tabLabel)}</span>
                ${uploadItems.length > 1 ? `
                    <button class="upload-item-tab-remove" data-index="${index}">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                ` : ''}
            </button>
        `;
    }).join('');

    // Add click listeners
    container.querySelectorAll('.upload-item-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            if (e.target.closest('.upload-item-tab-remove')) return;
            switchToUploadItem(parseInt(tab.dataset.index));
        });
    });

    container.querySelectorAll('.upload-item-tab-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeUploadItem(parseInt(btn.dataset.index));
        });
    });

    // Update "Add New" button text
    updateAddButtonText();
}

// Update the "Add New" button text based on category
function updateAddButtonText() {
    const textEl = document.getElementById('upload-add-item-text');
    if (!textEl) return;

    const categoryLabels = {
        presets: 'Add New Preset',
        samples: 'Add New Sample',
        midi: 'Add New MIDI',
        projects: 'Add New Project',
        originals: 'Add New Original'
    };
    textEl.textContent = categoryLabels[currentUploadCategory] || 'Add New Item';
}

// Switch to upload item
function switchToUploadItem(index) {
    if (index === activeUploadIndex) return;
    if (index < 0 || index >= uploadItems.length) return;

    saveCurrentItemState();
    activeUploadIndex = index;
    loadItemState(index);
    renderUploadTabs();
}

// Add new upload item
function addUploadItem() {
    saveCurrentItemState();
    uploadItems.push(createEmptyUploadItem());
    activeUploadIndex = uploadItems.length - 1;
    loadItemState(activeUploadIndex);
    renderUploadTabs();
}

// Remove upload item
function removeUploadItem(index) {
    if (uploadItems.length <= 1) return;

    uploadItems.splice(index, 1);

    if (activeUploadIndex >= uploadItems.length) {
        activeUploadIndex = uploadItems.length - 1;
    } else if (activeUploadIndex > index) {
        activeUploadIndex--;
    }

    loadItemState(activeUploadIndex);
    renderUploadTabs();
}

// Open upload page (replaces modal)
function openUploadModal() {
    // Stop any playing audio
    if (typeof currentlyPlaying !== 'undefined' && currentlyPlaying && typeof globalAudio !== 'undefined' && globalAudio) {
        globalAudio.pause();
        globalAudio.currentTime = 0;
    }

    // Update sidebar active states
    document.querySelectorAll('.side-nav-item').forEach(x => x.classList.remove('active'));
    document.getElementById('sidebar-upload-btn')?.classList.add('active');

    // Switch to upload view
    document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));
    const uploadContent = document.getElementById('upload-content');
    if (uploadContent) uploadContent.classList.add('active');

    // Update body classes
    document.body.classList.remove('profile-active', 'lounge-active', 'browse-active');
    document.body.classList.add('upload-active');

    // Hide center panel and presets bg
    const centerPanel = document.getElementById('center-panel');
    if (centerPanel) centerPanel.style.display = 'none';
    const presetsBgBtn = document.getElementById('presets-bg-btn');
    const presetsBgOverlay = document.getElementById('presets-bg-overlay');
    if (presetsBgBtn) presetsBgBtn.style.display = 'none';
    if (presetsBgOverlay) presetsBgOverlay.style.display = 'none';

    // Set avatar from profile
    const avatar = localStorage.getItem('profileAvatar');
    const avatarEl = document.getElementById('upload-sidebar-avatar');
    if (avatar && avatarEl) {
        const safeCssUrl = sanitizeCSSUrl(avatar);
        if (safeCssUrl) {
            avatarEl.style.backgroundImage = `url('${safeCssUrl}')`;
            avatarEl.innerHTML = '';
        }
    }

    // Reset form and set initial category
    resetUploadForm();
    initUploadItems();
    switchUploadCategory(currentUploadCategory);
    updateUploadPreview();
}

function closeUploadModal() {
    // This is kept for compatibility - switches back to browse
    document.body.classList.remove('upload-active');
    document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));

    // Go back to presets (default browse)
    document.getElementById('presets-content')?.classList.add('active');
    document.body.classList.add('browse-active');
    document.getElementById('center-panel').style.display = 'flex';

    // Update sidebar
    document.querySelectorAll('.side-nav-item').forEach(x => x.classList.remove('active'));
    document.querySelector('.side-nav-item[data-category="presets"]')?.classList.add('active');
}
window.closeUploadModal = closeUploadModal;

// Category switching
function switchUploadCategory(category) {
    currentUploadCategory = category;

    // Reset form completely when switching categories
    resetUploadForm();

    // Reset items for new category (clears all items when changing category)
    uploadItems = [createEmptyUploadItem()];
    activeUploadIndex = 0;
    uploadTags = [];
    uploadFiles = { main: null, audio: null, cover: null, video: null };
    uploadMidiNotes = null;
    renderUploadTabs();

    // Update category tabs
    document.querySelectorAll('.upload-category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === category);
    });

    // Update file button label
    const fileLabels = {
        presets: 'Preset File',
        samples: 'Sample File',
        midi: 'MIDI File',
        projects: 'Project File',
        originals: 'Audio File'
    };
    const mainLabel = document.getElementById('upload-file-main-label');
    if (mainLabel) mainLabel.textContent = fileLabels[category] || 'File';

    // Show/hide category-specific fields
    const showPreset = category === 'presets';
    const showSample = category === 'samples';
    const showMidi = category === 'midi';
    const showProject = category === 'projects';
    const showOriginal = category === 'originals';

    // Preset fields (VST row contains both VST and Type)
    document.querySelectorAll('.upload-field-vst').forEach(el => el.style.display = showPreset ? '' : 'none');
    document.querySelectorAll('.upload-field-type').forEach(el => el.style.display = showPreset ? '' : 'none');

    // Sample fields (Sample Type, Key, BPM in one row)
    document.querySelectorAll('.upload-field-sample-meta').forEach(el => el.style.display = showSample ? '' : 'none');

    // MIDI fields (Key, Scale in one row)
    document.querySelectorAll('.upload-field-midi-meta').forEach(el => el.style.display = showMidi ? '' : 'none');

    // Project fields (DAW, Tempo, Key, Scale, Genre in one row)
    document.querySelectorAll('.upload-field-project-meta').forEach(el => el.style.display = showProject ? '' : 'none');

    // Originals fields (just genre)
    document.querySelectorAll('.upload-field-originals-meta').forEach(el => el.style.display = showOriginal ? '' : 'none');

    // Show/hide file buttons based on category
    const mainBtn = document.getElementById('upload-file-main-btn');
    const videoBtn = document.getElementById('upload-file-video-btn');
    const coverBtn = document.getElementById('upload-file-cover-btn');
    const audioBtn = document.getElementById('upload-file-audio-btn');

    // Originals: hide main, show audio (required) + cover (optional), hide video
    // Projects: show main + video (required), hide cover and audio
    // MIDI: show main + audio, hide cover and video
    // Others: show main + audio + cover, hide video
    if (mainBtn) mainBtn.style.display = showOriginal ? 'none' : '';
    if (videoBtn) videoBtn.style.display = showProject ? '' : 'none';
    if (coverBtn) coverBtn.style.display = (showProject || showMidi) ? 'none' : '';
    if (audioBtn) audioBtn.style.display = showProject ? 'none' : '';

    // Update audio status text based on category
    const audioStatus = document.getElementById('upload-file-audio-status');
    if (audioStatus && !uploadFiles.audio) {
        audioStatus.textContent = (showPreset || showSample || showMidi || showOriginal) ? 'Required' : 'Optional';
    }

    // Update sidebar button text
    const uploadBtn = document.getElementById('sidebar-upload-btn');
    if (uploadBtn) {
        uploadBtn.textContent = 'Upload';
    }

    updateUploadPreview();
}

// Reset upload form
function resetUploadForm() {
    // Helper for safe element reset
    const resetInput = (id, value = '') => {
        const el = document.getElementById(id);
        if (el) {
            el.value = value;
            if (el.dataset) el.dataset.selectedValue = '';
        }
    };
    const resetText = (id, text = '') => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    // Clear all inputs
    resetInput('upload-title');
    resetInput('upload-vst');
    resetInput('upload-type');
    resetInput('upload-loop-type');
    const sampleTypeLabel = document.getElementById('upload-sample-type-label');
    if (sampleTypeLabel) sampleTypeLabel.innerHTML = '&nbsp;<span class="required">*</span>';
    const sampleSubtypeGroup = document.getElementById('upload-sample-subtype-group');
    if (sampleSubtypeGroup) sampleSubtypeGroup.style.display = 'none';
    resetInput('upload-sample-type');
    resetInput('upload-key');
    resetInput('upload-bpm');
    resetInput('upload-daw');
    resetInput('upload-tempo');
    resetInput('upload-project-key');
    resetInput('upload-scale');
    resetInput('upload-genre');
    resetInput('upload-description');
    resetInput('upload-tag-input');

    // Clear tags
    uploadTags = [];
    renderUploadTags();

    // Clear files
    uploadFiles = { main: null, audio: null, cover: null, video: null };
    resetInput('upload-file-main');
    resetInput('upload-file-audio');
    resetInput('upload-file-cover');
    resetInput('upload-file-video');
    resetText('upload-file-main-status');
    resetText('upload-file-audio-status');
    resetText('upload-file-cover-status');
    resetText('upload-file-video-status');
    document.getElementById('upload-file-main-btn')?.classList.remove('has-file');
    document.getElementById('upload-file-audio-btn')?.classList.remove('has-file');
    document.getElementById('upload-file-cover-btn')?.classList.remove('has-file');
    document.getElementById('upload-file-video-btn')?.classList.remove('has-file');

    // Reset status text
    const mainStatus = document.getElementById('upload-file-main-status');
    const audioStatus = document.getElementById('upload-file-audio-status');
    const coverStatus = document.getElementById('upload-file-cover-status');
    const videoStatus = document.getElementById('upload-file-video-status');
    if (mainStatus) mainStatus.textContent = 'Required';
    if (audioStatus) audioStatus.textContent = 'Optional';
    if (coverStatus) coverStatus.textContent = 'Optional';
    if (videoStatus) videoStatus.textContent = 'Required';

    // Reset preview
    window.uploadPreviewItem = null;
}

// Tag management
function addUploadTag(tag) {
    tag = tag.trim();
    if (!tag) return;

    // Limit to 3 tags
    if (uploadTags.length >= 3) {
        alert('Maximum 3 tags allowed per item');
        return;
    }

    // Lowercase the tag
    tag = tag.toLowerCase();

    // Validate tag
    const validation = validateTag(tag);
    if (!validation.valid) {
        alert(validation.error);
        return;
    }

    if (!uploadTags.includes(tag)) {
        uploadTags.push(tag);
        renderUploadTags();
        saveCurrentItemState();
        updateUploadPreview();
    }

    // Hide autocomplete dropdown
    hideTagAutocomplete();
}

function removeUploadTag(tag) {
    uploadTags = uploadTags.filter(t => t !== tag);
    renderUploadTags();
    saveCurrentItemState();
    updateUploadPreview();
}

function renderUploadTags() {
    const container = document.getElementById('upload-tags-container');
    const input = document.getElementById('upload-tag-input');
    if (!container || !input) return;

    // Remove existing tags (but keep the input)
    container.querySelectorAll('.upload-tag').forEach(el => el.remove());

    // Insert tags before the input (display in uppercase)
    uploadTags.forEach(tag => {
        const tagEl = document.createElement('div');
        tagEl.className = 'upload-tag';
        tagEl.innerHTML = `
            <span>${escapeHTML(tag.toUpperCase())}</span>
            <button type="button" class="upload-tag-remove" data-action="remove-tag" data-tag="${escapeAttr(tag)}">&times;</button>
        `;
        container.insertBefore(tagEl, input);
    });
}

// ===== TAG AUTOCOMPLETE =====
let tagAutocompleteHighlightIndex = 0;

function showTagAutocomplete(query) {
    const input = document.getElementById('upload-tag-input');
    if (!input) return;

    let dropdown = document.getElementById('tag-autocomplete-dropdown');

    // Create dropdown if it doesn't exist
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'tag-autocomplete-dropdown';
        dropdown.className = 'tag-autocomplete-dropdown';
        input.parentElement.appendChild(dropdown);
    }

    // Get suggestions
    const suggestions = getTagSuggestions(query);

    if (suggestions.length === 0) {
        hideTagAutocomplete();
        return;
    }

    tagAutocompleteHighlightIndex = 0;

    // Render suggestions
    dropdown.innerHTML = suggestions.map((item, index) => `
        <div class="tag-autocomplete-item ${index === 0 ? 'highlighted' : ''}" data-tag="${escapeAttr(item.tag)}">
            <span class="tag-autocomplete-name">${escapeHTML(item.tag)}</span>
            <span class="tag-autocomplete-count">${item.count}</span>
        </div>
    `).join('');

    // Click handler for items
    dropdown.querySelectorAll('.tag-autocomplete-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const tag = item.dataset.tag;
            if (tag) {
                addUploadTag(tag);
                input.value = '';
                input.focus();
            }
        });
    });

    dropdown.style.display = 'block';
}

function hideTagAutocomplete() {
    const dropdown = document.getElementById('tag-autocomplete-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

function navigateTagAutocomplete(direction) {
    const dropdown = document.getElementById('tag-autocomplete-dropdown');
    if (!dropdown || dropdown.style.display === 'none') return false;

    const items = dropdown.querySelectorAll('.tag-autocomplete-item');
    if (items.length === 0) return false;

    // Update highlight index
    items[tagAutocompleteHighlightIndex]?.classList.remove('highlighted');

    if (direction === 'down') {
        tagAutocompleteHighlightIndex = (tagAutocompleteHighlightIndex + 1) % items.length;
    } else {
        tagAutocompleteHighlightIndex = (tagAutocompleteHighlightIndex - 1 + items.length) % items.length;
    }

    items[tagAutocompleteHighlightIndex]?.classList.add('highlighted');
    items[tagAutocompleteHighlightIndex]?.scrollIntoView({ block: 'nearest' });

    return true;
}

function selectHighlightedTag() {
    const dropdown = document.getElementById('tag-autocomplete-dropdown');
    if (!dropdown || dropdown.style.display === 'none') return false;

    const highlighted = dropdown.querySelector('.tag-autocomplete-item.highlighted');
    if (highlighted) {
        const tag = highlighted.dataset.tag;
        if (tag) {
            const input = document.getElementById('upload-tag-input');
            addUploadTag(tag);
            if (input) {
                input.value = '';
                input.focus();
            }
            return true;
        }
    }
    return false;
}

// Live preview update
function updateUploadPreview() {
    const container = document.getElementById('upload-preview-container');
    if (!container) return;

    // Build preview item
    const title = document.getElementById('upload-title')?.value || 'Untitled';
    const vst = document.getElementById('upload-vst')?.dataset.selectedValue || document.getElementById('upload-vst')?.value || '';
    const type = document.getElementById('upload-type')?.dataset.selectedValue || document.getElementById('upload-type')?.value || '';
    const loopType = document.getElementById('upload-loop-type')?.value || '';
    const sampleType = document.getElementById('upload-sample-type')?.dataset.selectedValue || '';
    const key = document.getElementById('upload-key')?.dataset.selectedValue || '';
    const rawBpm = document.getElementById('upload-bpm')?.value || '';
    const bpm = /^\d{1,3}$/.test(rawBpm) ? rawBpm : '';
    const daw = document.getElementById('upload-daw')?.dataset.selectedValue || '';
    const rawTempo = document.getElementById('upload-tempo')?.value || '';
    const tempo = /^\d{1,3}$/.test(rawTempo) ? rawTempo : '';
    const projectKey = document.getElementById('upload-project-key')?.dataset.selectedValue || '';
    const scale = document.getElementById('upload-scale')?.dataset.selectedValue || '';
    const genre = document.getElementById('upload-genre')?.dataset.selectedValue || document.getElementById('upload-genre')?.value || '';

    window.uploadPreviewItem = {
        id: 'preview-' + Date.now(),
        title: title,
        type: currentUploadCategory === 'samples' ? (sampleType || 'sample') : (type || currentUploadCategory.slice(0, -1)),
        loopType: loopType,
        vst: vst,
        tags: [...uploadTags],
        hearts: 0,
        downloads: 0,
        plays: 0,
        liked: false,
        comments: [],
        uploader: getOrCreateUsername(),
        uploaderAvatar: localStorage.getItem('profileAvatar') || null,
        key: currentUploadCategory === 'samples' ? key : projectKey,
        bpm: currentUploadCategory === 'samples' ? bpm : tempo,
        daw: daw,
        scale: scale,
        genre: genre,
        audioBlob: uploadFiles.audio ? URL.createObjectURL(uploadFiles.audio) : null,
        coverArt: uploadFiles.cover ? URL.createObjectURL(uploadFiles.cover) : null,
        videoBlob: uploadFiles.video ? URL.createObjectURL(uploadFiles.video) : null,
        midiNotes: currentUploadCategory === 'midi' ? uploadMidiNotes : null
    };

    // Use createCardHTML if available
    if (typeof createCardHTML === 'function') {
        container.innerHTML = createCardHTML(uploadPreviewItem, currentUploadCategory);

        // Set up audio if we have it
        if (uploadPreviewItem.audioBlob && typeof setupCardAudio === 'function') {
            setTimeout(() => {
                setupCardAudio(uploadPreviewItem, currentUploadCategory);
            }, 100);
        }

        // Render MIDI piano roll if we have midi notes
        if (currentUploadCategory === 'midi' && uploadMidiNotes && typeof renderPianoRoll === 'function') {
            setTimeout(() => {
                renderPianoRoll(uploadPreviewItem.id, uploadMidiNotes, '#e8e8e8');
            }, 150);
        }

        // Set up video player for project preview
        if (currentUploadCategory === 'projects' && uploadPreviewItem.videoBlob && typeof setupVideoPlayer === 'function') {
            setTimeout(() => {
                setupVideoPlayer(uploadPreviewItem.id);
            }, 100);
        }

    } else {
        // Fallback placeholder
        container.innerHTML = `
            <div class="upload-preview-placeholder">
                <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>Preview will appear here</span>
            </div>
        `;
    }
}

// File handling
function handleFileSelect(type, file) {
    if (!file) return;

    // Audio file validation for samples, presets, midi (not projects)
    if (type === 'audio' && currentUploadCategory !== 'projects') {
        // Check file size (30MB limit)
        const maxSize = 30 * 1024 * 1024; // 30MB in bytes
        if (file.size > maxSize) {
            alert('Audio file must be under 30MB');
            document.getElementById('upload-file-audio').value = '';
            return;
        }

        // Check file type (MP3/WAV only) - require BOTH valid MIME type AND extension
        const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav'];
        const ext = file.name.toLowerCase().split('.').pop();
        const hasValidMime = validTypes.includes(file.type);
        const hasValidExt = ['mp3', 'wav'].includes(ext);
        // Require valid extension always, MIME type check if browser provides it
        if (!hasValidExt || (file.type && !hasValidMime)) {
            alert('Audio files must be MP3 or WAV format only');
            document.getElementById('upload-file-audio').value = '';
            return;
        }
    }

    // MIDI file validation - only .mid/.midi files allowed, max 30MB
    if (type === 'main' && currentUploadCategory === 'midi') {
        const maxSize = 30 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('MIDI file must be under 30MB');
            document.getElementById('upload-file-main').value = '';
            return;
        }

        const ext = file.name.toLowerCase().split('.').pop();
        if (ext !== 'mid' && ext !== 'midi') {
            alert('MIDI uploads must be .mid or .midi files only');
            document.getElementById('upload-file-main').value = '';
            return;
        }
    }

    // Sample file validation - max 30MB
    if (type === 'main' && currentUploadCategory === 'samples') {
        const maxSize = 30 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('Sample file must be under 30MB');
            document.getElementById('upload-file-main').value = '';
            return;
        }
    }

    // Preset file validation - check extension matches selected VST, max 30MB
    if (type === 'main' && currentUploadCategory === 'presets') {
        const maxSize = 30 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('Preset file must be under 30MB');
            document.getElementById('upload-file-main').value = '';
            return;
        }

        const selectedVst = document.getElementById('upload-vst')?.dataset.selectedValue || '';
        const ext = file.name.toLowerCase().split('.').pop();

        const vstExtensions = {
            'serum 2': ['serumpreset'],
            'serum': ['fxp'],
            'pigments': ['pgtx'],
            'harmor': ['fst'],
            'phaseplant': ['phaseplant'],
            'diva': ['h2p'],
            'sylenth1': ['fxp'],
            'vital': ['vital'],
            'massive': ['nmsv'],
            'surge xt': ['fxp'],
            'sytrus': ['fst'],
            'omnisphere': ['prt_omi', 'mlt_omi']
        };

        if (selectedVst && vstExtensions[selectedVst]) {
            const validExts = vstExtensions[selectedVst];
            if (!validExts.includes(ext)) {
                const extList = validExts.map(e => '.' + e).join(' or ');
                alert(`${selectedVst} presets must be ${extList} files`);
                document.getElementById('upload-file-main').value = '';
                return;
            }
        } else if (!selectedVst) {
            alert('Please select a VST first before uploading a preset file');
            document.getElementById('upload-file-main').value = '';
            return;
        }
    }

    // Video file validation for projects - only .mp4, .mov, .webm, max 100MB, 1080p max
    if (type === 'video' && currentUploadCategory === 'projects') {
        const ext = file.name.toLowerCase().split('.').pop();
        if (!['mp4', 'mov', 'webm'].includes(ext)) {
            alert('Videos must be .mp4, .mov, or .webm files only');
            document.getElementById('upload-file-video').value = '';
            return;
        }

        // Check file size (100MB limit)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('Video file must be under 100MB');
            document.getElementById('upload-file-video').value = '';
            return;
        }

        // Check video resolution (max 1080p)
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = function() {
            URL.revokeObjectURL(video.src);
            if (video.videoWidth > 1920 || video.videoHeight > 1080) {
                alert('Video resolution must be 1080p (1920x1080) or lower');
                uploadFiles.video = null;
                document.getElementById('upload-file-video').value = '';
                const btn = document.getElementById('upload-file-video-btn');
                const status = document.getElementById('upload-file-video-status');
                if (btn) btn.classList.remove('has-file');
                if (status) status.textContent = 'Required';
                return;
            }
        };
        video.src = URL.createObjectURL(file);
    }

    // Project file validation - check extension matches selected DAW, max 500MB
    if (type === 'main' && currentUploadCategory === 'projects') {
        // Check file size (500MB limit)
        const maxSize = 500 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('Project file must be under 500MB');
            document.getElementById('upload-file-main').value = '';
            return;
        }

        const selectedDaw = document.getElementById('upload-daw')?.dataset.selectedValue || '';
        const ext = file.name.toLowerCase().split('.').pop();

        // Allow zip/archive files for projects - skip DAW extension check
        const isArchive = ['zip', 'rar', '7z'].includes(ext);

        if (!isArchive) {
            const dawExtensions = {
                'ableton': ['als'],
                'bitwig': ['bwproject'],
                'cakewalk': ['cwp'],
                'cubase': ['cpr'],
                'flstudio': ['flp'],
                'logic': ['logicx'],
                'protools': ['ptx'],
                'reaper': ['rpp'],
                'reason': ['reason'],
                'studioone': ['song']
            };

            if (selectedDaw && dawExtensions[selectedDaw]) {
                const validExts = dawExtensions[selectedDaw];
                if (!validExts.includes(ext)) {
                    const extList = validExts.map(e => '.' + e).join(' or ');
                    alert(`${selectedDaw} projects must be ${extList} files`);
                    document.getElementById('upload-file-main').value = '';
                    return;
                }
            } else if (!selectedDaw) {
                alert('Please select a DAW first before uploading a project file');
                document.getElementById('upload-file-main').value = '';
                return;
            }
        }
    }

    // Cover/photo validation - only image files allowed, max 5MB
    if (type === 'cover') {
        const maxImageSize = (typeof MAX_IMAGE_SIZE !== 'undefined') ? MAX_IMAGE_SIZE : 5 * 1024 * 1024;
        if (file.size > maxImageSize) {
            alert('Cover image must be under 5MB');
            document.getElementById('upload-file-cover').value = '';
            return;
        }

        const ext = file.name.toLowerCase().split('.').pop();
        if (!['gif', 'png', 'jpeg', 'jpg', 'webp'].includes(ext)) {
            alert('Images must be .gif, .png, .jpeg, .jpg, or .webp only');
            document.getElementById('upload-file-cover').value = '';
            return;
        }

        // Block SVG by MIME type (can contain scripts even if renamed)
        const mimeType = file.type.toLowerCase();
        if (mimeType === 'image/svg+xml' || mimeType.includes('svg')) {
            alert('SVG files are not allowed for security reasons');
            document.getElementById('upload-file-cover').value = '';
            return;
        }
    }

    uploadFiles[type] = file;

    const typeKey = type === 'main' ? 'main' : type;
    const statusEl = document.getElementById(`upload-file-${typeKey}-status`);
    const btnEl = document.getElementById(`upload-file-${typeKey}-btn`);

    // Show filename (truncated if needed)
    if (statusEl) {
        const name = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
        statusEl.textContent = name;
    }
    if (btnEl) btnEl.classList.add('has-file');

    // Parse MIDI file for preview
    if (type === 'main' && currentUploadCategory === 'midi') {
        parseMidiForPreview(file);
    }

    // Save state and update tabs to show green dot
    saveCurrentItemState();
    renderUploadTabs();

    // Update preview for audio/cover changes
    if (type === 'audio' || type === 'cover' || type === 'main') {
        updateUploadPreview();
    }
}

// Parse MIDI file for preview visualization
async function parseMidiForPreview(file) {
    uploadMidiNotes = null;

    if (typeof Midi === 'undefined') {
        return; // MIDI library not available
    }

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                const parsedMidi = new Midi(arrayBuffer);
                uploadMidiNotes = {
                    duration: parsedMidi.duration,
                    tracks: parsedMidi.tracks.map(track => ({
                        notes: track.notes.map(note => ({
                            midi: note.midi,
                            time: note.time,
                            duration: note.duration,
                            velocity: note.velocity
                        }))
                    }))
                };
                // Also set on the current upload item so it gets saved to Supabase
                if (uploadItems[activeUploadIndex]) {
                    uploadItems[activeUploadIndex].midiNotes = uploadMidiNotes;
                }
                updateUploadPreview();
            } catch (err) {
                console.error('MIDI parsing failed:', err);
            }
        };
        reader.onerror = (err) => {
            console.error('File read failed:', err);
        };
        reader.readAsArrayBuffer(file);
    } catch (err) {
        console.error('parseMidiForPreview error:', err);
    }
}

// Upload helpers
function getOrCreateUsername() {
    let username = localStorage.getItem('profileUsername');
    if (!username) {
        const randomNum = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
        username = 'User' + randomNum;
        localStorage.setItem('profileUsername', username);
    }
    return username;
}

const createBaseItem = (id, userId = null) => {
    return {
        id,
        hearts: 0, downloads: 0, plays: 0, saves: 0, shares: 0, liked: false,
        comments: [],
        uploader: getOrCreateUsername(),
        uploaderId: userId,
        uploaderBanner: localStorage.getItem('profileBanner') || null,
        uploaderAvatar: localStorage.getItem('profileAvatar') || null,
        uploaderFollowers: parseInt(localStorage.getItem('profileFollowers')) || 0,
        uploaderUploads: parseInt(localStorage.getItem('profileUploads')) || 0
    };
};

// Helper function to upload files to Supabase Storage
// Uses single 'uploads' bucket with folder paths for organization
async function uploadToSupabaseStorage(file, folder, userId, itemId) {
    console.log('uploadToSupabaseStorage called:', { fileName: file?.name, folder, userId, itemId });

    if (!file) {
        console.error('No file provided to upload');
        return null;
    }

    if (typeof supabaseUploadFile !== 'function') {
        console.error('supabaseUploadFile function not available');
        return null;
    }

    const ext = file.name.split('.').pop();
    // Path structure: {folder}/{userId}/{itemId}_{timestamp}.{ext}
    const path = `${folder}/${userId}/${itemId}_${Date.now()}.${ext}`;
    console.log('Upload path:', path);

    const { url, error } = await supabaseUploadFile('uploads', path, file);
    if (error) {
        console.error(`Error uploading to uploads/${folder}:`, error);
        return null;
    }
    console.log('Upload successful, URL:', url);
    return url;
}

// Helper function to save item to Supabase
async function saveItemToSupabase(category, item, files, userId) {
    console.log('saveItemToSupabase called:', { category, item, files, userId });

    if (typeof supabaseCreateItem !== 'function') {
        console.error('supabaseCreateItem not available');
        return null;
    }

    try {
        const itemId = Date.now();

        // Upload files to storage
        let audioUrl = null;
        let coverUrl = null;
        let fileUrl = null;
        let videoUrl = null;

        // Determine correct folder based on category
        const fileFolder = category === 'presets' ? 'presets' :
                          category === 'samples' ? 'samples' :
                          category === 'midi' ? 'midi' :
                          category === 'projects' ? 'projects' : 'files';

        console.log('Uploading files to folder:', fileFolder);

        // Upload audio file (preview)
        if (files.audio) {
            console.log('Uploading audio file:', files.audio.name);
            audioUrl = await uploadToSupabaseStorage(files.audio, 'audio', userId, itemId);
            console.log('Audio URL:', audioUrl);
        }

        // Upload cover art
        if (files.cover) {
            console.log('Uploading cover file:', files.cover.name);
            coverUrl = await uploadToSupabaseStorage(files.cover, 'covers', userId, itemId);
            console.log('Cover URL:', coverUrl);
        }

        // Upload main file (preset, midi, project, sample)
        if (files.main) {
            console.log('Uploading main file:', files.main.name);
            fileUrl = await uploadToSupabaseStorage(files.main, fileFolder, userId, itemId);
            console.log('File URL:', fileUrl);
        }

        // Upload video (for projects)
        if (files.video) {
            console.log('Uploading video file:', files.video.name);
            videoUrl = await uploadToSupabaseStorage(files.video, 'videos', userId, itemId);
            console.log('Video URL:', videoUrl);
        }

        // Build metadata object based on category
        const metadata = {
            file_name: files.main?.name || files.audio?.name || '',
            tags: item.tags || []
        };

        if (category === 'presets') {
            metadata.type = item.type || '';
            metadata.vst = item.vst || '';
        } else if (category === 'samples') {
            metadata.sample_type = item.sampleType || '';
            metadata.loop_type = item.loopType || '';
            metadata.key = item.key || '';
            metadata.bpm = item.bpm || '';
        } else if (category === 'midi') {
            metadata.vst = item.vst || '';
            metadata.key = item.midiKey || '';
            metadata.scale = item.midiScale || '';
            metadata.bpm = item.bpm || '';
            metadata.midi_notes = item.midiNotes || null;
        } else if (category === 'projects') {
            metadata.daw = item.daw || '';
            metadata.tempo = item.tempo || '';
            metadata.key = item.projectKey || '';
            metadata.scale = item.scale || '';
            metadata.genre = item.genre || '';
            metadata.video_url = videoUrl;
        } else if (category === 'originals') {
            metadata.genre = item.genre || '';
        }

        // Create the database record
        const dbItem = {
            category,
            title: item.title,
            description: item.description || '',
            uploader_id: userId,
            audio_url: audioUrl,
            cover_url: coverUrl,
            file_url: fileUrl,
            metadata
        };

        const { data, error } = await supabaseCreateItem(dbItem);

        if (error) {
            console.error('Error saving item to Supabase:', error);
            return null;
        }

        console.log('Item saved to Supabase:', data);
        return data;

    } catch (err) {
        console.error('Error in saveItemToSupabase:', err);
        return null;
    }
}

// Helper to mark field as error
function markFieldError(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.classList.add('error');
        // Remove error on focus/click
        const removeError = () => {
            el.classList.remove('error');
            el.removeEventListener('focus', removeError);
            el.removeEventListener('click', removeError);
        };
        el.addEventListener('focus', removeError);
        el.addEventListener('click', removeError);
    }
}

// Helper to mark file upload as error
function markFileError(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.classList.add('error');
        const removeError = () => {
            el.classList.remove('error');
            el.removeEventListener('click', removeError);
        };
        el.addEventListener('click', removeError);
    }
}

// Clear all error highlights
function clearAllErrors() {
    document.querySelectorAll('#upload-content .error').forEach(el => {
        el.classList.remove('error');
    });
}

// Submit upload - handles all items at once
async function submitUpload() {
    // Rate limiting
    if (typeof rateLimit === 'function' && !rateLimit('submitUpload', 5000)) {
        alert('Please wait before uploading again.');
        return;
    }

    // Save current form state first
    saveCurrentItemState();

    // Clear previous errors
    clearAllErrors();

    // Validate all items
    const validItems = [];
    const errors = [];
    let hasErrors = false;

    for (let i = 0; i < uploadItems.length; i++) {
        const item = uploadItems[i];
        const itemNum = i + 1;
        let itemHasError = false;

        // Check title
        if (!item.title?.trim()) {
            errors.push(`Item ${itemNum}: Please enter a title`);
            markFieldError('upload-title');
            itemHasError = true;
        }

        // Validate title length
        const maxTitleLength = (typeof INPUT_LIMITS !== 'undefined') ? INPUT_LIMITS.TITLE : 100;
        if (item.title && item.title.length > maxTitleLength) {
            errors.push(`Item ${itemNum}: Title too long (max ${maxTitleLength} characters)`);
            markFieldError('upload-title');
            itemHasError = true;
        }

        // Validate title for gibberish
        if (item.title?.trim()) {
            const titleValidation = validateTitle(item.title);
            if (!titleValidation.valid) {
                errors.push(`Item ${itemNum}: ${titleValidation.error}`);
                markFieldError('upload-title');
                itemHasError = true;
            }
        }

        // Validate description length
        const maxDescLength = (typeof INPUT_LIMITS !== 'undefined') ? INPUT_LIMITS.ROOM_DESCRIPTION : 500;
        if (item.description && item.description.length > maxDescLength) {
            errors.push(`Item ${itemNum}: Description too long (max ${maxDescLength} characters)`);
            markFieldError('upload-description');
            itemHasError = true;
        }

        // Validate description if provided
        if (item.description?.trim()) {
            const descValidation = validateDescription(item.description);
            if (!descValidation.valid) {
                errors.push(`Item ${itemNum}: ${descValidation.error}`);
                markFieldError('upload-description');
                itemHasError = true;
            }
        }

        // Validate tags
        for (const tag of item.tags || []) {
            const tagValidation = validateTag(tag);
            if (!tagValidation.valid) {
                errors.push(`Item ${itemNum}: Invalid tag "${tag}"`);
                itemHasError = true;
                break;
            }
        }

        // Validate by category
        if (currentUploadCategory === 'presets') {
            if (!item.files.main) {
                errors.push(`Item ${itemNum}: Please select a preset file`);
                markFileError('upload-file-main-btn');
                itemHasError = true;
            }
            if (!item.files.audio) {
                errors.push(`Item ${itemNum}: Please select an audio file`);
                markFileError('upload-file-audio-btn');
                itemHasError = true;
            }
            if (!item.vst) {
                errors.push(`Item ${itemNum}: Please select a Synthesizer`);
                markFieldError('upload-vst');
                itemHasError = true;
            }
            if (!item.type) {
                errors.push(`Item ${itemNum}: Please select a Sound Type`);
                markFieldError('upload-type');
                itemHasError = true;
            }
        } else if (currentUploadCategory === 'samples') {
            if (!item.files.audio) {
                errors.push(`Item ${itemNum}: Please select an audio file`);
                markFileError('upload-file-audio-btn');
                itemHasError = true;
            }
            if (!item.loopType) {
                errors.push(`Item ${itemNum}: Please select Sample Type`);
                markFieldError('upload-loop-type');
                itemHasError = true;
            }
            if (item.loopType && !item.sampleType) {
                errors.push(`Item ${itemNum}: Please select a ${item.loopType} type`);
                markFieldError('upload-sample-type');
                itemHasError = true;
            }
            // Key is optional for samples
            // BPM is only required for Loops, not One Shots
            if (item.loopType !== 'One Shot' && !item.bpm) {
                errors.push(`Item ${itemNum}: Please enter BPM`);
                markFieldError('upload-bpm');
                itemHasError = true;
            }
        } else if (currentUploadCategory === 'midi') {
            if (!item.files.main) {
                errors.push(`Item ${itemNum}: Please select a MIDI file`);
                markFileError('upload-file-main-btn');
                itemHasError = true;
            }
            if (!item.files.audio) {
                errors.push(`Item ${itemNum}: Please select an audio file`);
                markFileError('upload-file-audio-btn');
                itemHasError = true;
            }
            if (!item.midiKey) {
                errors.push(`Item ${itemNum}: Please select a Key`);
                markFieldError('upload-midi-key');
                itemHasError = true;
            }
            if (!item.midiScale) {
                errors.push(`Item ${itemNum}: Please select a Scale`);
                markFieldError('upload-midi-scale');
                itemHasError = true;
            }
        } else if (currentUploadCategory === 'projects') {
            if (!item.files.main) {
                errors.push(`Item ${itemNum}: Please select a project file`);
                markFileError('upload-file-main-btn');
                itemHasError = true;
            }
            if (!item.daw) {
                errors.push(`Item ${itemNum}: Please select a DAW`);
                markFieldError('upload-daw');
                itemHasError = true;
            }
            if (!item.tempo) {
                errors.push(`Item ${itemNum}: Please enter Tempo`);
                markFieldError('upload-tempo');
                itemHasError = true;
            }
            if (!item.projectKey) {
                errors.push(`Item ${itemNum}: Please select a Key`);
                markFieldError('upload-project-key');
                itemHasError = true;
            }
            if (!item.scale) {
                errors.push(`Item ${itemNum}: Please select a Scale`);
                markFieldError('upload-scale');
                itemHasError = true;
            }
            if (!item.genre) {
                errors.push(`Item ${itemNum}: Please select a Genre`);
                markFieldError('upload-genre');
                itemHasError = true;
            }
            if (!item.files.video) {
                errors.push(`Item ${itemNum}: Please select a demo video`);
                markFileError('upload-file-video-btn');
                itemHasError = true;
            }
        } else if (currentUploadCategory === 'originals') {
            if (!item.files.audio) {
                errors.push(`Item ${itemNum}: Please select an audio file`);
                markFileError('upload-file-audio-btn');
                itemHasError = true;
            }
            if (!item.genre) {
                errors.push(`Item ${itemNum}: Please select a Genre`);
                markFieldError('upload-originals-genre');
                itemHasError = true;
            }
        }

        if (itemHasError) {
            hasErrors = true;
        } else {
            validItems.push(item);
        }
    }

    if (validItems.length === 0) {
        alert(errors.length > 0 ? errors.join('\n') : 'No valid items to upload');
        return;
    }

    // Get current user for Supabase uploads
    let userId = null;
    if (typeof supabaseGetUser === 'function') {
        try {
            const { user } = await supabaseGetUser();
            userId = user?.id || null;
            console.log('Upload - User ID:', userId);
        } catch (e) {
            console.error('Could not get Supabase user:', e);
        }
    } else {
        console.warn('supabaseGetUser function not available');
    }

    // Upload all valid items
    let uploadedCount = 0;

    for (const item of validItems) {
        const id = Date.now() + uploadedCount;
        const baseItem = createBaseItem(id, userId);

        let newItem;

        // Save to Supabase first (if authenticated)
        if (userId) {
            const supabaseResult = await saveItemToSupabase(
                currentUploadCategory,
                item,
                item.files,
                userId
            );
            if (supabaseResult) {
                // Use the Supabase ID for consistency
                baseItem.id = supabaseResult.id;
            }
        }

        if (currentUploadCategory === 'presets') {
            const presetData = await readFileAsDataURL(item.files.main);
            newItem = {
                ...baseItem,
                title: item.title,
                type: item.type,
                vst: item.vst,
                description: item.description || '',
                tags: [...item.tags],
                presetData,
                presetName: item.files.main.name,
                audioBlob: item.files.audio ? URL.createObjectURL(item.files.audio) : null,
                coverArt: item.files.cover ? URL.createObjectURL(item.files.cover) : null
            };
            items.presets.unshift(newItem);

        } else if (currentUploadCategory === 'samples') {
            const audioFile = item.files.audio || item.files.main;
            const audioData = await readFileAsDataURL(audioFile);

            newItem = {
                ...baseItem,
                title: item.title,
                type: item.sampleType || 'sample',
                loopType: item.loopType || '',
                vst: '',
                key: item.key,
                bpm: item.bpm,
                description: item.description || '',
                tags: [...item.tags].filter(t => t),
                presetData: audioData,
                presetName: audioFile.name,
                audioBlob: URL.createObjectURL(audioFile),
                coverArt: item.files.cover ? URL.createObjectURL(item.files.cover) : null
            };
            items.samples.unshift(newItem);

        } else if (currentUploadCategory === 'midi') {
            const midiData = await readFileAsDataURL(item.files.main);

            let midiNotes = null;
            try {
                if (typeof Midi !== 'undefined') {
                    const parsedMidi = await Midi.fromUrl(midiData);
                    midiNotes = {
                        duration: parsedMidi.duration,
                        tracks: parsedMidi.tracks.map(track => ({
                            notes: track.notes.map(note => ({
                                midi: note.midi,
                                time: note.time,
                                duration: note.duration,
                                velocity: note.velocity
                            }))
                        }))
                    };
                }
            } catch (err) {
                // MIDI parsing failed - continue without notes
            }

            newItem = {
                ...baseItem,
                title: item.title,
                type: 'midi',
                vst: item.vst || '',
                description: item.description || '',
                tags: [...item.tags],
                midiNotes,
                presetData: midiData,
                presetName: item.files.main.name,
                audioBlob: item.files.audio ? URL.createObjectURL(item.files.audio) : null,
                coverArt: item.files.cover ? URL.createObjectURL(item.files.cover) : null
            };
            items.midi.unshift(newItem);

        } else if (currentUploadCategory === 'projects') {
            const projectData = await readFileAsDataURL(item.files.main);

            newItem = {
                ...baseItem,
                title: item.title,
                type: 'project',
                daw: item.daw,
                tempo: item.tempo,
                key: item.projectKey,
                scale: item.scale,
                genre: item.genre,
                description: item.description || '',
                tags: [...item.tags].filter(t => t),
                presetData: projectData,
                presetName: item.files.main.name,
                videoBlob: item.files.video ? URL.createObjectURL(item.files.video) : null
            };
            items.projects.unshift(newItem);

        } else if (currentUploadCategory === 'originals') {
            const audioData = await readFileAsDataURL(item.files.audio);
            const originalsGenre = document.getElementById('upload-originals-genre')?.dataset.selectedValue ||
                                   document.getElementById('upload-originals-genre')?.value || '';

            newItem = {
                ...baseItem,
                title: item.title,
                type: 'original',
                genre: originalsGenre,
                description: item.description || '',
                tags: [...item.tags].filter(t => t),
                presetData: audioData,
                presetName: item.files.audio.name,
                audioBlob: URL.createObjectURL(item.files.audio),
                coverArt: item.files.cover ? URL.createObjectURL(item.files.cover) : null
            };
            if (!items.originals) items.originals = [];
            items.originals.unshift(newItem);
        }

        uploadedCount++;

        // Increment global tag counts for this item's tags
        if (item.tags && item.tags.length > 0) {
            item.tags.forEach(tag => incrementTagCount(tag));
        }
    }

    // Render items
    if (typeof renderItems === 'function') {
        renderItems(currentUploadCategory);
    }

    // Update filter counts after upload
    if (typeof updateFilterCounts === 'function') {
        updateFilterCounts();
    }

    // Reset and reinitialize
    resetUploadForm();
    initUploadItems();
    updateUploadPreview();

    // Show success feedback
    const itemWord = uploadedCount === 1 ? 'item' : 'items';
    if (typeof showToast === 'function') {
        showToast(`Successfully uploaded ${uploadedCount} ${itemWord}!`, 'success');
    } else {
        alert(`Successfully uploaded ${uploadedCount} ${itemWord}!`);
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Download modal functions (kept from original)
function openDownloadModal() {
    if (typeof selectedLibraryItems === 'undefined' || selectedLibraryItems.size === 0) return;
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
    if (typeof selectedLibraryItems === 'undefined' || typeof library === 'undefined') return;

    const itemsToDownload = [];
    let filename = document.getElementById('download-filename').value.trim() || 'PresetJunkies_Package';
    // Sanitize filename to prevent CSV injection and path traversal
    if (typeof sanitizeFilename === 'function') {
        filename = sanitizeFilename(filename);
    } else {
        // Fallback sanitization: remove dangerous characters and path traversal
        filename = filename
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove illegal filename chars
            .replace(/^[=+\-@\t\r]/g, '_')         // Prevent CSV injection
            .replace(/\.{2,}/g, '.')               // Prevent path traversal
            .slice(0, 200) || 'PresetJunkies_Package';
    }

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
    if (typeof renderUnifiedLibrary === 'function') renderUnifiedLibrary();
}
window.confirmDownload = confirmDownload;

// Autocomplete options
const autocompleteOptions = {
    vst: [
        { value: 'diva', label: 'Diva' },
        { value: 'harmor', label: 'Harmor' },
        { value: 'massive', label: 'Massive' },
        { value: 'omnisphere', label: 'Omnisphere' },
        { value: 'phaseplant', label: 'Phaseplant' },
        { value: 'pigments', label: 'Pigments' },
        { value: 'serum', label: 'Serum' },
        { value: 'serum 2', label: 'Serum 2' },
        { value: 'surge xt', label: 'Surge XT' },
        { value: 'sylenth1', label: 'Sylenth1' },
        { value: 'sytrus', label: 'Sytrus' },
        { value: 'vital', label: 'Vital' }
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
        { value: 'bass', label: 'Bass' },
        { value: 'drum', label: 'Drum' },
        { value: 'fx', label: 'FX' },
        { value: 'keys', label: 'Keys' },
        { value: 'melody', label: 'Melody' },
        { value: 'other', label: 'Other' },
        { value: 'percussion', label: 'Percussion' },
        { value: 'strings', label: 'Strings' },
        { value: 'synth', label: 'Synth' },
        { value: 'vocal', label: 'Vocal' }
    ],
    daw: [
        { value: 'ableton', label: 'Ableton' },
        { value: 'bitwig', label: 'Bitwig' },
        { value: 'cakewalk', label: 'Cakewalk' },
        { value: 'cubase', label: 'Cubase' },
        { value: 'flstudio', label: 'FL Studio' },
        { value: 'logic', label: 'Logic' },
        { value: 'protools', label: 'Pro Tools' },
        { value: 'reaper', label: 'Reaper' },
        { value: 'reason', label: 'Reason' },
        { value: 'studioone', label: 'Studio One' }
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
        { value: 'Blues', label: 'Blues' },
        { value: 'Dorian', label: 'Dorian' },
        { value: 'Harmonic Minor', label: 'Harmonic Minor' },
        { value: 'Lydian', label: 'Lydian' },
        { value: 'Major', label: 'Major' },
        { value: 'Melodic Minor', label: 'Melodic Minor' },
        { value: 'Minor', label: 'Minor' },
        { value: 'Mixolydian', label: 'Mixolydian' },
        { value: 'Pentatonic', label: 'Pentatonic' },
        { value: 'Phrygian', label: 'Phrygian' }
    ],
    genre: [
        { value: 'Afrobeats', label: 'Afrobeats' },
        { value: 'Alternative', label: 'Alternative' },
        { value: 'Ambient', label: 'Ambient' },
        { value: 'Boom Bap', label: 'Boom Bap' },
        { value: 'Breakbeat', label: 'Breakbeat' },
        { value: 'Dancehall', label: 'Dancehall' },
        { value: 'Deep House', label: 'Deep House' },
        { value: 'Downtempo', label: 'Downtempo' },
        { value: 'Drum & Bass', label: 'Drum & Bass' },
        { value: 'Dubstep', label: 'Dubstep' },
        { value: 'EDM', label: 'EDM' },
        { value: 'Electro', label: 'Electro' },
        { value: 'Experimental', label: 'Experimental' },
        { value: 'Future Bass', label: 'Future Bass' },
        { value: 'Future House', label: 'Future House' },
        { value: 'Garage', label: 'Garage' },
        { value: 'Hardstyle', label: 'Hardstyle' },
        { value: 'Hip-Hop', label: 'Hip-Hop' },
        { value: 'House', label: 'House' },
        { value: 'Hyperpop', label: 'Hyperpop' },
        { value: 'IDM', label: 'IDM' },
        { value: 'Jersey Club', label: 'Jersey Club' },
        { value: 'Jpop', label: 'Jpop' },
        { value: 'Jungle', label: 'Jungle' },
        { value: 'Kpop', label: 'Kpop' },
        { value: 'Lo-Fi', label: 'Lo-Fi' },
        { value: 'Melodic House', label: 'Melodic House' },
        { value: 'Phonk', label: 'Phonk' },
        { value: 'Pop', label: 'Pop' },
        { value: 'Progressive House', label: 'Progressive House' },
        { value: 'R&B', label: 'R&B' },
        { value: 'Reggaeton', label: 'Reggaeton' },
        { value: 'Riddim', label: 'Riddim' },
        { value: 'Synthwave', label: 'Synthwave' },
        { value: 'Tech House', label: 'Tech House' },
        { value: 'Techno', label: 'Techno' },
        { value: 'Trance', label: 'Trance' },
        { value: 'Trap', label: 'Trap' },
        { value: 'UK Drill', label: 'UK Drill' },
        { value: 'UK Garage', label: 'UK Garage' }
    ]
};

// Initialize upload page autocomplete
function initUploadAutocomplete() {
    document.querySelectorAll('#upload-content .upload-autocomplete').forEach(input => {
        const type = input.dataset.autocomplete;
        const options = autocompleteOptions[type];
        if (!options) return;

        const dropdown = input.nextElementSibling;
        if (!dropdown || !dropdown.classList.contains('upload-autocomplete-dropdown')) return;

        let highlightedIndex = -1;
        let selectedValue = null;

        function showDropdown(filteredOptions) {
            dropdown.innerHTML = '';
            highlightedIndex = -1;

            if (filteredOptions.length === 0) {
                dropdown.innerHTML = '<div class="upload-autocomplete-no-results">No matches found</div>';
                dropdown.classList.add('show');
                return;
            }

            filteredOptions.forEach((opt, index) => {
                const item = document.createElement('div');
                item.className = 'upload-autocomplete-item';
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
            hideDropdown();
            updateUploadPreview();
        }

        function updateHighlight() {
            dropdown.querySelectorAll('.upload-autocomplete-item').forEach((item, index) => {
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

        input.addEventListener('focus', () => {
            showDropdown(filterOptions(input.value));
        });

        input.addEventListener('click', () => {
            // Show full dropdown on click to allow changing selection
            showDropdown(options);
        });

        // Prevent typing - only allow selection from dropdown
        input.addEventListener('keydown', (e) => {
            // Allow navigation keys
            if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
                return; // Let the other keydown handler deal with these
            }
            // Block all other keys
            e.preventDefault();
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                const matchedOption = options.find(opt =>
                    opt.label.toLowerCase() === input.value.toLowerCase()
                );
                if (matchedOption) {
                    input.value = matchedOption.label;
                    input.dataset.selectedValue = matchedOption.value;
                    selectedValue = matchedOption.value;
                } else if (!selectedValue) {
                    input.value = '';
                    input.dataset.selectedValue = '';
                }
                hideDropdown();
                updateUploadPreview();
            }, 150);
        });

        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.upload-autocomplete-item');
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

// Initialize autocomplete for modal forms (kept for compatibility)
function initAutocomplete() {
    document.querySelectorAll('.autocomplete-input').forEach(input => {
        const type = input.dataset.autocomplete;
        const options = autocompleteOptions[type];
        if (!options) return;

        const dropdown = input.nextElementSibling;
        let highlightedIndex = -1;
        let selectedValue = null;

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

        input.addEventListener('focus', () => {
            showDropdown(filterOptions(input.value));
        });

        input.addEventListener('input', () => {
            if (input.value !== options.find(o => o.value === selectedValue)?.label) {
                input.dataset.selectedValue = '';
                selectedValue = null;
                input.classList.remove('has-value');
            }
            showDropdown(filterOptions(input.value));
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
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

function getAutocompleteValue(inputId) {
    const input = document.getElementById(inputId);
    return input?.dataset.selectedValue || input?.value || '';
}

// Initialize upload page event listeners
function initUploadPage() {
    // Category tab switching
    document.querySelectorAll('.upload-category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchUploadCategory(tab.dataset.category);
        });
    });

    // Add item button
    document.getElementById('upload-add-item-btn')?.addEventListener('click', addUploadItem);

    // Title input - update preview and tab on change
    const titleInput = document.getElementById('upload-title');
    const titleCharCount = document.getElementById('upload-title-count');
    if (titleInput) {
        titleInput.addEventListener('input', () => {
            saveCurrentItemState();
            renderUploadTabs();
            updateUploadPreview();
            if (titleCharCount) {
                titleCharCount.textContent = `${titleInput.value.length}/25`;
            }
        });
    }

    // Description input with character count
    const descInput = document.getElementById('upload-description');
    const descCharCount = document.getElementById('description-char-count');
    if (descInput) {
        descInput.addEventListener('input', () => {
            updateUploadPreview();
            if (descCharCount) {
                descCharCount.textContent = `${descInput.value.length}/100`;
            }
        });
    }

    // File button clicks
    document.getElementById('upload-file-main-btn')?.addEventListener('click', () => {
        document.getElementById('upload-file-main')?.click();
    });
    document.getElementById('upload-file-audio-btn')?.addEventListener('click', () => {
        document.getElementById('upload-file-audio')?.click();
    });
    document.getElementById('upload-file-cover-btn')?.addEventListener('click', () => {
        document.getElementById('upload-file-cover')?.click();
    });
    document.getElementById('upload-file-video-btn')?.addEventListener('click', () => {
        document.getElementById('upload-file-video')?.click();
    });

    // File input changes
    document.getElementById('upload-file-main')?.addEventListener('change', (e) => {
        handleFileSelect('main', e.target.files[0]);
    });
    document.getElementById('upload-file-audio')?.addEventListener('change', (e) => {
        handleFileSelect('audio', e.target.files[0]);
    });
    document.getElementById('upload-file-cover')?.addEventListener('change', (e) => {
        handleFileSelect('cover', e.target.files[0]);
    });
    document.getElementById('upload-file-cover-remove')?.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadFiles.cover = null;
        document.getElementById('upload-file-cover').value = '';
        document.getElementById('upload-file-cover-btn')?.classList.remove('has-file');
        document.getElementById('upload-file-cover-status').textContent = 'Optional';
    });
    document.getElementById('upload-file-video')?.addEventListener('change', (e) => {
        handleFileSelect('video', e.target.files[0]);
    });

    // Tag input - comma + space to add, backspace to delete
    const tagInput = document.getElementById('upload-tag-input');
    const tagsContainer = document.getElementById('upload-tags-container');

    // Click on container focuses input or removes tag
    tagsContainer?.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('[data-action="remove-tag"]');
        if (removeBtn) {
            const tag = removeBtn.dataset.tag;
            if (tag) {
                removeUploadTag(tag);
            }
            return;
        }
        tagInput?.focus();
    });

    tagInput?.addEventListener('input', (e) => {
        const val = tagInput.value;
        // Check for comma followed by space at the end
        if (val.endsWith(', ') || val.endsWith(',')) {
            const tag = val.replace(/,\s*$/, '').trim();
            if (tag) {
                addUploadTag(tag);
            }
            tagInput.value = '';
            hideTagAutocomplete();
        } else if (val.trim().length > 0) {
            // Show autocomplete suggestions
            showTagAutocomplete(val.trim());
        } else {
            hideTagAutocomplete();
        }
    });

    tagInput?.addEventListener('keydown', (e) => {
        // Arrow keys for autocomplete navigation
        if (e.key === 'ArrowDown') {
            if (navigateTagAutocomplete('down')) {
                e.preventDefault();
                return;
            }
        }
        if (e.key === 'ArrowUp') {
            if (navigateTagAutocomplete('up')) {
                e.preventDefault();
                return;
            }
        }
        // Tab or Enter to select highlighted autocomplete item
        if (e.key === 'Tab' || e.key === 'Enter') {
            if (selectHighlightedTag()) {
                e.preventDefault();
                return;
            }
        }
        // Escape to close autocomplete
        if (e.key === 'Escape') {
            hideTagAutocomplete();
            return;
        }
        // Backspace when input is empty - delete last tag
        if (e.key === 'Backspace' && tagInput.value === '' && uploadTags.length > 0) {
            e.preventDefault();
            const lastTag = uploadTags[uploadTags.length - 1];
            removeUploadTag(lastTag);
        }
        // Enter also adds tag (if no autocomplete selection)
        if (e.key === 'Enter') {
            e.preventDefault();
            if (tagInput.value.trim()) {
                addUploadTag(tagInput.value.trim());
                tagInput.value = '';
            }
        }
    });

    // Hide autocomplete when clicking outside
    tagInput?.addEventListener('blur', () => {
        // Delay to allow click on dropdown item
        setTimeout(hideTagAutocomplete, 200);
    });

    // Show autocomplete when focusing on empty input (show all popular tags)
    tagInput?.addEventListener('focus', () => {
        if (tagInput.value.trim() === '') {
            showTagAutocomplete('');
        }
    });

    // Submit button
    document.getElementById('upload-submit-btn')?.addEventListener('click', submitUpload);

    // Sample type dropdown - update label dynamically and show/hide subtype and BPM
    const loopTypeSelect = document.getElementById('upload-loop-type');
    const sampleTypeLabel = document.getElementById('upload-sample-type-label');
    const sampleSubtypeGroup = document.getElementById('upload-sample-subtype-group');
    const bpmGroup = document.getElementById('upload-bpm-group');
    if (loopTypeSelect && sampleTypeLabel) {
        loopTypeSelect.addEventListener('change', () => {
            const value = loopTypeSelect.value;
            if (value === 'Loop') {
                sampleTypeLabel.innerHTML = 'Loop <span class="required">*</span>';
                if (sampleSubtypeGroup) sampleSubtypeGroup.style.display = '';
                if (bpmGroup) bpmGroup.style.display = '';
            } else if (value === 'One Shot') {
                sampleTypeLabel.innerHTML = 'One Shot <span class="required">*</span>';
                if (sampleSubtypeGroup) sampleSubtypeGroup.style.display = '';
                // Hide BPM for One Shots
                if (bpmGroup) bpmGroup.style.display = 'none';
            } else {
                sampleTypeLabel.innerHTML = '&nbsp;<span class="required">*</span>';
                if (sampleSubtypeGroup) sampleSubtypeGroup.style.display = 'none';
                if (bpmGroup) bpmGroup.style.display = '';
            }
            updateUploadPreview();
        });
    }

    // Initialize autocomplete for upload page
    initUploadAutocomplete();
}

// Initialize upload form handlers (kept for modal compatibility)
function initUploadForms() {
    // Modal tabs
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.uploadTab;
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.modal-body .tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(`upload-${tabName}`).classList.add('active');
        });
    });

    // File upload area visual feedback
    document.querySelectorAll('.file-upload-area input[type="file"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const area = e.target.closest('.file-upload-area');
            if (e.target.files.length > 0) {
                area.classList.add('has-file');
                area.querySelector('p').textContent = `Selected: ${e.target.files[0].name}`;
            }
        });
    });

    // Initialize upload page
    initUploadPage();
}

// Make functions globally accessible
window.openUploadModal = openUploadModal;
window.removeUploadTag = removeUploadTag;
window.addUploadTag = addUploadTag;
