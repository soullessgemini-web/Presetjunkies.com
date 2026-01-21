// ===== MANAGE SOUNDS PAGE =====

// State
let manageCurrentPage = 1;
// Uses global itemsPerPageSetting from state.js
let manageSelectedItems = new Set();
let manageEditingItem = null;
let manageEditCategory = null;
let manageEditTags = [];
let manageDeleteMode = null; // 'single' or 'multi'
let manageDeleteTarget = null; // item or array of items
let manageActiveTab = 'uploads'; // 'uploads' or 'saved'

// Get current user's uploads across all categories
function getUserUploads() {
    const currentUser = localStorage.getItem('profileUsername') || 'Username';
    const currentUserId = localStorage.getItem('supabaseUserId') || null;
    const categories = ['presets', 'samples', 'midi', 'projects', 'originals'];
    const uploads = [];

    categories.forEach(category => {
        if (items[category]) {
            items[category].forEach(item => {
                // Match by username OR userId (for Supabase items)
                if (item.uploader === currentUser ||
                    (currentUserId && item.uploaderId === currentUserId)) {
                    uploads.push({ ...item, category });
                }
            });
        }
    });

    // Sort by upload date (newest first)
    return uploads.sort((a, b) => new Date(b.createdAt || b.uploadDate) - new Date(a.createdAt || a.uploadDate));
}

// Get user's saved sounds from library
function getUserSavedSounds() {
    const savedLibrary = safeJSONParse(localStorage.getItem('presetJunkiesLibrary'), []);
    const savedSounds = [];

    savedLibrary.forEach(libItem => {
        const category = libItem.category;
        if (items[category]) {
            const item = items[category].find(i => i.id === libItem.id);
            if (item) {
                savedSounds.push({ ...item, category });
            }
        }
    });

    return savedSounds;
}

// Get filtered uploads based on current filter selections
function getFilteredUploads() {
    let uploads = getUserUploads();

    const categoryFilter = document.getElementById('manage-filter-category')?.value || 'all';

    // Filter by category first
    if (categoryFilter !== 'all') {
        uploads = uploads.filter(u => u.category === categoryFilter);
    }

    // Apply category-specific filters
    if (categoryFilter === 'presets') {
        const vstFilter = document.getElementById('manage-filter-vst')?.value || 'all';
        const typeFilter = document.getElementById('manage-filter-type')?.value || 'all';
        if (vstFilter !== 'all') uploads = uploads.filter(u => u.vst === vstFilter);
        if (typeFilter !== 'all') uploads = uploads.filter(u => u.type === typeFilter);
    } else if (categoryFilter === 'samples') {
        const loopTypeFilter = document.getElementById('manage-filter-looptype')?.value || 'all';
        const keyFilter = document.getElementById('manage-filter-key')?.value || 'all';
        if (loopTypeFilter !== 'all') uploads = uploads.filter(u => u.loopType === loopTypeFilter);
        if (keyFilter !== 'all') uploads = uploads.filter(u => u.key === keyFilter);
    } else if (categoryFilter === 'midi') {
        // MIDI has no category-specific filters
    } else if (categoryFilter === 'projects') {
        const dawFilter = document.getElementById('manage-filter-daw')?.value || 'all';
        const genreFilter = document.getElementById('manage-filter-genre')?.value || 'all';
        if (dawFilter !== 'all') uploads = uploads.filter(u => u.daw === dawFilter);
        if (genreFilter !== 'all') uploads = uploads.filter(u => u.genre === genreFilter);
    }

    return uploads;
}

// Get filtered saved sounds based on current filter selections
function getFilteredSavedSounds() {
    let saved = getUserSavedSounds();

    const categoryFilter = document.getElementById('manage-filter-category')?.value || 'all';

    // Filter by category first
    if (categoryFilter !== 'all') {
        saved = saved.filter(u => u.category === categoryFilter);
    }

    // Apply category-specific filters
    if (categoryFilter === 'presets') {
        const vstFilter = document.getElementById('manage-filter-vst')?.value || 'all';
        const typeFilter = document.getElementById('manage-filter-type')?.value || 'all';
        if (vstFilter !== 'all') saved = saved.filter(u => u.vst === vstFilter);
        if (typeFilter !== 'all') saved = saved.filter(u => u.type === typeFilter);
    } else if (categoryFilter === 'samples') {
        const loopTypeFilter = document.getElementById('manage-filter-looptype')?.value || 'all';
        const keyFilter = document.getElementById('manage-filter-key')?.value || 'all';
        if (loopTypeFilter !== 'all') saved = saved.filter(u => u.loopType === loopTypeFilter);
        if (keyFilter !== 'all') saved = saved.filter(u => u.key === keyFilter);
    } else if (categoryFilter === 'midi') {
        // MIDI has no category-specific filters
    } else if (categoryFilter === 'projects') {
        const dawFilter = document.getElementById('manage-filter-daw')?.value || 'all';
        const genreFilter = document.getElementById('manage-filter-genre')?.value || 'all';
        if (dawFilter !== 'all') saved = saved.filter(u => u.daw === dawFilter);
        if (genreFilter !== 'all') saved = saved.filter(u => u.genre === genreFilter);
    }

    return saved;
}

// Show/hide filter sections based on category
function updateManageFilterVisibility() {
    const category = document.getElementById('manage-filter-category')?.value || 'all';

    // Hide all category-specific filters first
    const allFilterSections = [
        'manage-vst-filter-section',
        'manage-type-filter-section',
        'manage-looptype-filter-section',
        'manage-key-filter-section',
        'manage-daw-filter-section',
        'manage-genre-filter-section'
    ];
    allFilterSections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Show relevant filters based on category
    if (category === 'all') {
        // Show no additional filters for "All Categories"
    } else if (category === 'presets') {
        document.getElementById('manage-vst-filter-section')?.classList.remove('hidden');
        document.getElementById('manage-type-filter-section')?.classList.remove('hidden');
    } else if (category === 'samples') {
        document.getElementById('manage-looptype-filter-section')?.classList.remove('hidden');
        document.getElementById('manage-key-filter-section')?.classList.remove('hidden');
    } else if (category === 'midi') {
        // MIDI has no category-specific filters
    } else if (category === 'projects') {
        document.getElementById('manage-daw-filter-section')?.classList.remove('hidden');
        document.getElementById('manage-genre-filter-section')?.classList.remove('hidden');
    }

    // Populate filters for the selected category
    populateManageFiltersForCategory(category);
}

// Populate filter dropdowns based on category
function populateManageFiltersForCategory(category) {
    const uploads = getUserUploads().filter(u => category === 'all' || u.category === category);

    if (category === 'presets') {
        // Populate VST filter
        const vsts = new Set();
        uploads.forEach(item => { if (item.vst) vsts.add(item.vst); });

        const vstSelect = document.getElementById('manage-filter-vst');
        if (vstSelect) {
            vstSelect.innerHTML = '<option value="all">All Synthesizers</option>';
            Array.from(vsts).sort().forEach(vst => {
                vstSelect.innerHTML += `<option value="${escapeAttr(vst)}">${escapeHTML(vst)}</option>`;
            });
        }
    }

    if (category === 'presets') {
        // Populate Sound Type filter
        const types = new Set();
        uploads.forEach(item => { if (item.type) types.add(item.type); });

        const typeSelect = document.getElementById('manage-filter-type');
        if (typeSelect) {
            typeSelect.innerHTML = '<option value="all">All Types</option>';
            Array.from(types).sort().forEach(type => {
                typeSelect.innerHTML += `<option value="${escapeAttr(type)}">${escapeHTML(type)}</option>`;
            });
        }
    }

    if (category === 'samples') {
        // Populate Key filter
        const keys = new Set();
        uploads.forEach(item => { if (item.key) keys.add(item.key); });

        const keySelect = document.getElementById('manage-filter-key');
        if (keySelect) {
            keySelect.innerHTML = '<option value="all">All Keys</option>';
            Array.from(keys).sort().forEach(key => {
                keySelect.innerHTML += `<option value="${escapeAttr(key)}">${escapeHTML(key)}</option>`;
            });
        }
    }

    if (category === 'projects') {
        // Populate DAW filter
        const daws = new Set();
        uploads.forEach(item => { if (item.daw) daws.add(item.daw); });

        const dawSelect = document.getElementById('manage-filter-daw');
        if (dawSelect) {
            dawSelect.innerHTML = '<option value="all">All DAWs</option>';
            Array.from(daws).sort().forEach(daw => {
                dawSelect.innerHTML += `<option value="${escapeAttr(daw)}">${escapeHTML(daw)}</option>`;
            });
        }

        // Populate Genre filter
        const genres = new Set();
        uploads.forEach(item => { if (item.genre) genres.add(item.genre); });

        const genreSelect = document.getElementById('manage-filter-genre');
        if (genreSelect) {
            genreSelect.innerHTML = '<option value="all">All Genres</option>';
            Array.from(genres).sort().forEach(genre => {
                genreSelect.innerHTML += `<option value="${escapeAttr(genre)}">${escapeHTML(genre)}</option>`;
            });
        }
    }
}

// Populate filter dropdowns with user's data (legacy wrapper)
function populateManageFilters() {
    updateManageFilterVisibility();
}

// Render sound cards in the grid
function renderManageSoundsGrid() {
    const grid = document.getElementById('manage-sounds-grid');
    const emptyState = document.getElementById('manage-sounds-empty');
    const countEl = document.getElementById('manage-sounds-count');

    // Get data based on active tab
    const filteredItems = manageActiveTab === 'uploads' ? getFilteredUploads() : getFilteredSavedSounds();
    const totalCount = filteredItems.length;

    // Update count
    if (countEl) {
        countEl.textContent = `${totalCount} sound${totalCount !== 1 ? 's' : ''}`;
    }

    // Update empty state message based on tab
    const emptySpan = emptyState?.querySelector('span');
    const emptyP = emptyState?.querySelector('p');
    if (manageActiveTab === 'uploads') {
        if (emptySpan) emptySpan.textContent = 'No uploads yet';
        if (emptyP) emptyP.textContent = 'Sounds you upload will appear here';
    } else {
        if (emptySpan) emptySpan.textContent = 'No saved sounds';
        if (emptyP) emptyP.textContent = 'Sounds you save will appear here';
    }

    if (totalCount === 0) {
        if (grid) grid.innerHTML = '';
        if (grid) grid.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        const paginationEl = document.getElementById('manage-sounds-pagination');
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }

    if (grid) grid.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');

    // Render all cards (no pagination)
    if (grid) {
        grid.innerHTML = filteredItems.map(item => createManageSoundCard(item, manageActiveTab === 'saved')).join('');

        // Setup special card types after rendering
        filteredItems.forEach(item => {
            // Render piano rolls for MIDI items
            if (item.category === 'midi' && item.midiNotes && typeof renderPianoRoll === 'function') {
                setTimeout(() => {
                    renderPianoRoll(item.id, item.midiNotes, item.themeColor || '#e8e8e8');
                }, 50);
            }
            // Setup video players for project items
            if (item.category === 'projects' && item.videoBlob && typeof setupVideoPlayer === 'function') {
                setTimeout(() => {
                    setupVideoPlayer(item.id);
                }, 50);
            }
        });
    }

    // Hide pagination
    const paginationContainer = document.getElementById('manage-sounds-pagination');
    if (paginationContainer) paginationContainer.style.display = 'none';

    // Update select all checkbox
    updateSelectAllCheckbox();
}

// Create HTML for a sound card - uses actual browse card with management controls
function createManageSoundCard(item, isSaved = false) {
    const isSelected = manageSelectedItems.has(`${item.category}-${item.id}`);

    // Use the actual createCardHTML from browse.js
    let actualCard = typeof createCardHTML === 'function'
        ? createCardHTML(item, item.category)
        : `<div class="item-card">${escapeHTML(item.title)}</div>`;

    // Checkbox in top right of card - use data attributes for event delegation
    const checkboxHTML = `<label class="manage-card-checkbox">
        <input type="checkbox" ${isSelected ? 'checked' : ''} data-action="toggle-select" data-category="${escapeAttr(item.category)}" data-id="${escapeAttr(String(item.id))}">
    </label>`;

    // Different pills for saved vs uploaded items - use data attributes for event delegation
    const pillsHTML = isSaved
        ? `<div class="manage-card-pills">
               <button class="manage-pill unsave-pill" data-action="unsave" data-category="${escapeAttr(item.category)}" data-id="${escapeAttr(String(item.id))}">UNSAVE</button>
           </div>`
        : `<div class="manage-card-pills">
               <button class="manage-pill delete-pill" data-action="delete" data-category="${escapeAttr(item.category)}" data-id="${escapeAttr(String(item.id))}">DELETE</button>
           </div>`;

    // Insert checkbox into the item-card (the one with the border)
    actualCard = actualCard.replace(
        /(<div class="item-card item-card-front[^"]*"[^>]*>)/,
        `$1${checkboxHTML}`
    );

    // Insert pills into the player-container (where the image/cover is)
    actualCard = actualCard.replace(
        /(<div class="player-container[^"]*"[^>]*>)/,
        `$1${pillsHTML}`
    );

    return `
        <div class="manage-sound-wrapper ${isSelected ? 'selected' : ''}" data-item-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(item.category)}">
            ${actualCard}
        </div>
    `;
}

// Render pagination controls - matches browse page style
function renderManagePagination(totalPages) {
    const container = document.getElementById('manage-sounds-pagination');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    const page = manageCurrentPage;

    let html = `
        <button class="pagination-btn pagination-prev ${page === 1 ? 'disabled' : ''}"
                data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 18l-6-6 6-6"/>
            </svg>
            Prev
        </button>
        <div class="pagination-pages">
    `;

    const maxVisiblePages = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        html += `<button class="pagination-page" data-page="1">1</button>`;
        if (startPage > 2) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-page ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }
        html += `<button class="pagination-page" data-page="${totalPages}">${totalPages}</button>`;
    }

    html += `
        </div>
        <button class="pagination-btn pagination-next ${page === totalPages ? 'disabled' : ''}"
                data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>
            Next
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
            </svg>
        </button>
        <div class="pagination-per-page">
            <select class="per-page-select" data-action="setManageItemsPerPage">
                ${ITEMS_PER_PAGE_OPTIONS.map(opt => `<option value="${opt}" ${opt === itemsPerPageSetting ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
            <span class="per-page-label">per page</span>
        </div>
    `;

    container.innerHTML = html;
}

// Set items per page for manage sounds
function setManageItemsPerPage(count) {
    itemsPerPageSetting = count;
    manageCurrentPage = 1;
    renderManageSoundsGrid();
}

// Go to specific page
function goToManagePage(page) {
    const filteredUploads = getFilteredUploads();
    const totalPages = Math.ceil(filteredUploads.length / itemsPerPageSetting);

    if (page < 1 || page > totalPages) return;

    manageCurrentPage = page;
    renderManageSoundsGrid();
}

// Toggle item selection
function toggleManageSelect(category, id) {
    const key = `${category}-${id}`;

    if (manageSelectedItems.has(key)) {
        manageSelectedItems.delete(key);
    } else {
        manageSelectedItems.add(key);
    }

    // Update card visual
    const card = document.querySelector(`.manage-sound-wrapper[data-item-id="${escapeSelector(id)}"][data-category="${escapeSelector(category)}"]`);
    if (card) {
        card.classList.toggle('selected', manageSelectedItems.has(key));
    }

    updateSelectionUI();
}

// Select/deselect all visible items
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('manage-select-all');
    const isChecked = selectAllCheckbox?.checked || false;

    const filteredUploads = getFilteredUploads();

    filteredUploads.forEach(item => {
        const key = `${item.category}-${item.id}`;
        if (isChecked) {
            manageSelectedItems.add(key);
        } else {
            manageSelectedItems.delete(key);
        }
    });

    renderManageSoundsGrid();
    updateSelectionUI();
}

// Update select all checkbox state
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('manage-select-all');
    if (!selectAllCheckbox) return;

    const filteredUploads = getFilteredUploads();

    const allSelected = filteredUploads.every(item =>
        manageSelectedItems.has(`${item.category}-${item.id}`)
    );

    selectAllCheckbox.checked = filteredUploads.length > 0 && allSelected;
}

// Update selection UI (delete button, count)
function updateSelectionUI() {
    const deleteBtn = document.getElementById('manage-delete-selected');
    const countSpan = document.getElementById('manage-selected-count');

    const count = manageSelectedItems.size;

    if (deleteBtn) {
        if (count > 0) {
            deleteBtn.classList.remove('hidden');
        } else {
            deleteBtn.classList.add('hidden');
        }
    }

    if (countSpan) {
        countSpan.textContent = count;
    }

    updateSelectAllCheckbox();
}

// ===== EDIT PANEL =====

// Open edit panel for an item
function openManageEdit(category, id) {
    const item = items[category]?.find(i => i.id === id);
    if (!item) return;

    manageEditingItem = item;
    manageEditCategory = category;
    manageEditTags = [...(item.tags || [])];

    // Show form, hide empty state
    document.getElementById('manage-edit-empty')?.classList.add('hidden');
    document.getElementById('manage-edit-form')?.classList.remove('hidden');

    // Populate form fields
    const titleEl = document.getElementById('manage-edit-title');
    if (titleEl) titleEl.value = item.title || '';
    updateManageEditTitleCount();

    // Show/hide category-specific fields
    hideAllManageEditFields();

    if (category === 'presets') {
        showManageEditField('vst-group');
        showManageEditField('type-group');
        const vstEl = document.getElementById('manage-edit-vst');
        const typeEl = document.getElementById('manage-edit-type');
        if (vstEl) vstEl.value = item.vst || '';
        if (typeEl) typeEl.value = item.type || '';
    } else if (category === 'samples') {
        showManageEditField('sample-type-group');
        showManageEditField('key-group');
        showManageEditField('bpm-group');
        const loopTypeEl = document.getElementById('manage-edit-loop-type');
        const keyEl = document.getElementById('manage-edit-key');
        const bpmEl = document.getElementById('manage-edit-bpm');
        if (loopTypeEl) loopTypeEl.value = item.loopType || '';
        if (keyEl) keyEl.value = item.key || '';
        if (bpmEl) bpmEl.value = item.bpm || '';
    } else if (category === 'midi') {
        showManageEditField('vst-group');
        const vstEl = document.getElementById('manage-edit-vst');
        if (vstEl) vstEl.value = item.vst || '';
    } else if (category === 'projects') {
        showManageEditField('daw-group');
        showManageEditField('tempo-group');
        showManageEditField('scale-group');
        showManageEditField('genre-group');
        const dawEl = document.getElementById('manage-edit-daw');
        const tempoEl = document.getElementById('manage-edit-tempo');
        const scaleEl = document.getElementById('manage-edit-scale');
        const genreEl = document.getElementById('manage-edit-genre');
        if (dawEl) dawEl.value = item.daw || '';
        if (tempoEl) tempoEl.value = item.tempo || '';
        if (scaleEl) scaleEl.value = item.scale || '';
        if (genreEl) genreEl.value = item.genre || '';
    }

    // Tags
    renderManageEditTags();

    // Description
    const descEl = document.getElementById('manage-edit-description');
    if (descEl) descEl.value = item.description || '';
    updateManageEditDescCount();

    // Highlight the card being edited
    document.querySelectorAll('.manage-sound-wrapper').forEach(card => {
        card.classList.remove('editing');
    });
    const editingCard = document.querySelector(`.manage-sound-wrapper[data-item-id="${escapeSelector(id)}"][data-category="${escapeSelector(category)}"]`);
    if (editingCard) {
        editingCard.classList.add('editing');
    }
}

// Hide all category-specific fields
function hideAllManageEditFields() {
    const groups = [
        'manage-edit-vst-group',
        'manage-edit-type-group',
        'manage-edit-sample-type-group',
        'manage-edit-key-group',
        'manage-edit-bpm-group',
        'manage-edit-daw-group',
        'manage-edit-tempo-group',
        'manage-edit-scale-group',
        'manage-edit-genre-group'
    ];

    groups.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

// Show a specific edit field
function showManageEditField(fieldName) {
    const el = document.getElementById(`manage-edit-${fieldName}`);
    if (el) el.classList.remove('hidden');
}

// Render tags in edit panel
function renderManageEditTags() {
    const container = document.getElementById('manage-edit-tags-container');
    if (!container) return;

    // Keep the input, clear tags
    const input = document.getElementById('manage-edit-tag-input');
    container.innerHTML = '';

    manageEditTags.forEach((tag, index) => {
        const tagEl = document.createElement('span');
        tagEl.className = 'manage-edit-tag';
        tagEl.innerHTML = `
            ${escapeHTML(tag)}
            <button class="manage-edit-tag-remove" data-action="remove-tag" data-index="${index}">&times;</button>
        `;
        container.appendChild(tagEl);
    });

    container.appendChild(input);
}

// Remove a tag from edit
function removeManageEditTag(index) {
    manageEditTags.splice(index, 1);
    renderManageEditTags();
}

// Add tag on comma+space or enter
function handleManageEditTagInput(e) {
    const input = e.target;
    const value = input.value;

    if (value.endsWith(', ') || e.key === 'Enter') {
        e.preventDefault();
        const tag = value.replace(/,\s*$/, '').trim();

        if (tag && manageEditTags.length < 5 && !manageEditTags.includes(tag)) {
            const validation = validateTag ? validateTag(tag) : { valid: true };
            if (validation.valid) {
                manageEditTags.push(tag);
                renderManageEditTags();
            }
        }
        input.value = '';
    }
}

// Update title character count
function updateManageEditTitleCount() {
    const input = document.getElementById('manage-edit-title');
    const count = document.getElementById('manage-edit-title-count');
    if (input && count) {
        count.textContent = `${input.value.length}/25`;
    }
}

// Update description character count
function updateManageEditDescCount() {
    const input = document.getElementById('manage-edit-description');
    const count = document.getElementById('manage-edit-desc-count');
    if (input && count) {
        count.textContent = `${input.value.length}/100`;
    }
}

// Save edit changes
async function saveManageEdit() {
    if (!manageEditingItem || !manageEditCategory) return;

    const title = document.getElementById('manage-edit-title')?.value?.trim();

    // Validate title
    if (!title) {
        document.getElementById('manage-edit-title')?.classList.add('error');
        return;
    }

    const titleValidation = validateTitle ? validateTitle(title) : { valid: true };
    if (!titleValidation.valid) {
        document.getElementById('manage-edit-title')?.classList.add('error');
        return;
    }

    // Find the item in the items array and update it
    const item = items[manageEditCategory]?.find(i => i.id === manageEditingItem.id);
    if (!item) return;

    // Update common fields
    item.title = title;
    item.description = document.getElementById('manage-edit-description')?.value?.trim() || '';
    item.tags = [...manageEditTags];

    // Update category-specific fields
    const metadata = { tags: item.tags };

    if (manageEditCategory === 'presets') {
        item.vst = document.getElementById('manage-edit-vst')?.value || '';
        item.type = document.getElementById('manage-edit-type')?.value || '';
        metadata.vst = item.vst;
        metadata.type = item.type;
    } else if (manageEditCategory === 'samples') {
        item.loopType = document.getElementById('manage-edit-loop-type')?.value || '';
        item.key = document.getElementById('manage-edit-key')?.value || '';
        item.bpm = document.getElementById('manage-edit-bpm')?.value || '';
        metadata.loop_type = item.loopType;
        metadata.key = item.key;
        metadata.bpm = item.bpm;
    } else if (manageEditCategory === 'midi') {
        item.vst = document.getElementById('manage-edit-vst')?.value || '';
        metadata.vst = item.vst;
    } else if (manageEditCategory === 'projects') {
        item.daw = document.getElementById('manage-edit-daw')?.value || '';
        item.tempo = document.getElementById('manage-edit-tempo')?.value || '';
        item.scale = document.getElementById('manage-edit-scale')?.value || '';
        item.genre = document.getElementById('manage-edit-genre')?.value || '';
        metadata.daw = item.daw;
        metadata.tempo = item.tempo;
        metadata.scale = item.scale;
        metadata.genre = item.genre;
    }

    // Save to Supabase if available and item has a numeric ID (Supabase item)
    if (typeof supabaseUpdateItem === 'function' && typeof item.id === 'number') {
        try {
            const { error } = await supabaseUpdateItem(item.id, {
                title: item.title,
                description: item.description,
                metadata
            });
            if (error) {
                console.error('Error updating item in Supabase:', error);
            } else {
                console.log('Item updated in Supabase');
            }
        } catch (err) {
            console.error('Error saving to Supabase:', err);
        }
    }

    // Re-render grid
    renderManageSoundsGrid();
    populateManageFilters();

    // Close edit panel
    closeManageEdit();
}

// Close edit panel
function closeManageEdit() {
    manageEditingItem = null;
    manageEditCategory = null;
    manageEditTags = [];

    document.getElementById('manage-edit-form')?.classList.add('hidden');
    document.getElementById('manage-edit-empty')?.classList.remove('hidden');

    document.querySelectorAll('.manage-sound-wrapper').forEach(card => {
        card.classList.remove('editing');
    });
}

// ===== DELETE FUNCTIONALITY =====

// Open delete modal for single item
function openManageDeleteSingle(category, id) {
    const item = items[category]?.find(i => i.id === id);
    if (!item) return;

    manageDeleteMode = 'single';
    manageDeleteTarget = { category, id, title: item.title };

    const message = document.getElementById('manage-delete-message');
    if (message) {
        message.textContent = `Are you sure you want to delete this sound?`;
    }

    const modal = document.getElementById('manage-delete-modal');
    const content = modal?.querySelector('.modal-content');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => content?.classList.add('show'), 10);
    }
}

// Open delete modal for multiple items
function openManageDeleteMultiple() {
    if (manageSelectedItems.size === 0) return;

    manageDeleteMode = 'multi';
    manageDeleteTarget = Array.from(manageSelectedItems).map(key => {
        const parts = key.split('-');
        if (parts.length < 2) return null;
        const category = parts[0];
        const id = parseInt(parts.slice(1).join('-')); // Handle IDs that might contain hyphens
        if (isNaN(id)) return null;
        return { category, id };
    }).filter(item => item !== null);

    const message = document.getElementById('manage-delete-message');
    if (message) {
        message.textContent = `Are you sure you want to delete ${manageSelectedItems.size} sound${manageSelectedItems.size !== 1 ? 's' : ''}?`;
    }

    const modal = document.getElementById('manage-delete-modal');
    const content = modal?.querySelector('.modal-content');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => content?.classList.add('show'), 10);
    }
}

// Close delete modal
function closeManageDeleteModal() {
    manageDeleteMode = null;
    manageDeleteTarget = null;
    const modal = document.getElementById('manage-delete-modal');
    const content = modal?.querySelector('.modal-content');
    if (content) content.classList.remove('show');
    setTimeout(() => modal?.classList.add('hidden'), 200);
}

// Confirm delete
async function confirmManageDelete() {
    if (manageDeleteMode === 'single' && manageDeleteTarget) {
        await deleteManageItem(manageDeleteTarget.category, manageDeleteTarget.id);
    } else if (manageDeleteMode === 'multi' && manageDeleteTarget) {
        for (const item of manageDeleteTarget) {
            await deleteManageItem(item.category, item.id);
        }
        manageSelectedItems.clear();
    }

    // If we deleted the item being edited, close edit panel
    if (manageEditingItem && manageDeleteMode === 'single') {
        if (manageDeleteTarget.category === manageEditCategory &&
            manageDeleteTarget.id === manageEditingItem.id) {
            closeManageEdit();
        }
    } else if (manageDeleteMode === 'multi') {
        closeManageEdit();
    }

    closeManageDeleteModal();
    renderManageSoundsGrid();
    populateManageFilters();
    updateSelectionUI();

    // Update standard filter counts (VST, DAW, Type, Genre, etc.) on browse page
    if (typeof updateFilterCounts === 'function') {
        updateFilterCounts();
    }

    // Re-render trending tags to reflect updated counts
    if (typeof renderCategoryTrendingTags === 'function') {
        renderCategoryTrendingTags('presets', 'preset-trending-tags');
        renderCategoryTrendingTags('samples', 'sample-trending-tags');
        renderCategoryTrendingTags('midi', 'midi-trending-tags');
        renderCategoryTrendingTags('projects', 'project-trending-tags');
    }

    // Update profile uploads count
    const currentUploads = parseInt(localStorage.getItem('profileUploads') || '0');
    const deletedCount = manageDeleteMode === 'single' ? 1 : manageDeleteTarget.length;
    localStorage.setItem('profileUploads', Math.max(0, currentUploads - deletedCount));

    if (typeof updateUserStats === 'function') {
        updateUserStats();
    }
}

// Delete a single item from items array
async function deleteManageItem(category, id) {
    if (!items[category]) return;

    const index = items[category].findIndex(i => i.id === id);
    if (index !== -1) {
        const item = items[category][index];

        // Delete from Supabase if available
        if (typeof supabaseDeleteItem === 'function' && typeof id === 'number') {
            try {
                const { error } = await supabaseDeleteItem(id);
                if (error) {
                    console.error('Error deleting item from Supabase:', error);
                } else {
                    console.log('Item deleted from Supabase');
                }
            } catch (err) {
                console.error('Error deleting from Supabase:', err);
            }
        }

        // Decrement tag counts for the deleted item's tags
        if (item.tags && Array.isArray(item.tags) && window.decrementTagCounts) {
            window.decrementTagCounts(item.tags);
        }

        items[category].splice(index, 1);
    }

    // Also remove from library if present
    const libIndex = library.findIndex(l => l.id === id && l.category === category);
    if (libIndex !== -1) {
        library.splice(libIndex, 1);
    }
}

// ===== AUTOCOMPLETE FOR EDIT PANEL =====

function initManageEditAutocomplete() {
    const autocompleteInputs = document.querySelectorAll('.manage-edit-autocomplete');

    autocompleteInputs.forEach(input => {
        const type = input.dataset.autocomplete;
        const dropdownId = input.id + '-dropdown';
        const dropdown = document.getElementById(dropdownId);

        if (!dropdown) return;

        // Show dropdown on click
        input.addEventListener('click', () => {
            showManageAutocomplete(input, dropdown, type);
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    });
}

function showManageAutocomplete(input, dropdown, type) {
    let options = [];

    switch (type) {
        case 'vst':
            options = typeof autocompleteData !== 'undefined' ? autocompleteData.vst || [] : [];
            break;
        case 'soundType':
            options = typeof autocompleteData !== 'undefined' ? autocompleteData.soundType || [] : [];
            break;
        case 'key':
            options = typeof autocompleteData !== 'undefined' ? autocompleteData.key || [] : [];
            break;
        case 'daw':
            options = typeof autocompleteData !== 'undefined' ? autocompleteData.daw || [] : [];
            break;
        case 'scale':
            options = typeof autocompleteData !== 'undefined' ? autocompleteData.scale || [] : [];
            break;
        case 'genre':
            options = typeof autocompleteData !== 'undefined' ? autocompleteData.genre || [] : [];
            break;
    }

    dropdown.innerHTML = options.map(opt => `
        <div class="manage-edit-autocomplete-option" data-action="select-autocomplete" data-input-id="${escapeAttr(input.id)}" data-value="${escapeAttr(opt)}">${escapeHTML(opt)}</div>
    `).join('');

    dropdown.classList.add('active');
}

function selectManageAutocomplete(inputId, value) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(inputId + '-dropdown');

    if (input) input.value = value;
    if (dropdown) dropdown.classList.remove('active');
}

// Unsave a sound from the library
function unsaveManagedSound(category, id) {
    const savedLibrary = safeJSONParse(localStorage.getItem('presetJunkiesLibrary'), []);
    const index = savedLibrary.findIndex(item => item.id === id && item.category === category);

    if (index !== -1) {
        savedLibrary.splice(index, 1);
        localStorage.setItem('presetJunkiesLibrary', JSON.stringify(savedLibrary));

        // Re-render the grid
        renderManageSoundsGrid();
    }
}

// ===== INITIALIZATION =====

function initManageSounds() {
    // Event delegation for manage sounds grid actions
    const grid = document.getElementById('manage-sounds-grid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const target = e.target;
            const action = target.dataset.action;

            if (!action) return;

            e.stopPropagation();
            const category = target.dataset.category;
            const id = parseInt(target.dataset.id);

            if (!category || isNaN(id)) return;

            switch (action) {
                case 'delete':
                    openManageDeleteSingle(category, id);
                    break;
                case 'unsave':
                    unsaveManagedSound(category, id);
                    break;
            }
        });

        grid.addEventListener('change', (e) => {
            const target = e.target;
            if (target.dataset.action === 'toggle-select') {
                e.stopPropagation();
                const category = target.dataset.category;
                const id = parseInt(target.dataset.id);
                if (category && !isNaN(id)) {
                    toggleManageSelect(category, id);
                }
            }
        });
    }

    // Tab switching
    document.querySelectorAll('.manage-sounds-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            if (targetTab === manageActiveTab) return;

            // Update active tab state
            manageActiveTab = targetTab;
            document.querySelectorAll('.manage-sounds-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Clear selections when switching tabs
            manageSelectedItems.clear();
            updateSelectionUI();

            // Re-render grid
            manageCurrentPage = 1;
            renderManageSoundsGrid();
        });
    });

    // Category filter - updates which filters are visible
    document.getElementById('manage-filter-category')?.addEventListener('change', () => {
        manageCurrentPage = 1;
        updateManageFilterVisibility();
        renderManageSoundsGrid();
    });

    // All filter dropdowns trigger re-render
    const filterIds = [
        'manage-filter-vst',
        'manage-filter-type',
        'manage-filter-looptype',
        'manage-filter-key',
        'manage-filter-daw',
        'manage-filter-genre'
    ];
    filterIds.forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            manageCurrentPage = 1;
            renderManageSoundsGrid();
        });
    });

    document.getElementById('manage-clear-filters')?.addEventListener('click', () => {
        const filterIds = ['manage-filter-category', 'manage-filter-vst', 'manage-filter-type',
                           'manage-filter-looptype', 'manage-filter-key', 'manage-filter-daw', 'manage-filter-genre'];
        filterIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = 'all';
        });
        manageCurrentPage = 1;
        updateManageFilterVisibility();
        renderManageSoundsGrid();
    });

    // Select all
    document.getElementById('manage-select-all')?.addEventListener('change', toggleSelectAll);

    // Delete selected
    document.getElementById('manage-delete-selected')?.addEventListener('click', openManageDeleteMultiple);

    // Delete modal
    document.getElementById('close-manage-delete-modal')?.addEventListener('click', closeManageDeleteModal);
    document.getElementById('manage-delete-cancel')?.addEventListener('click', closeManageDeleteModal);
    document.getElementById('manage-delete-confirm')?.addEventListener('click', confirmManageDelete);

    // Close modal on backdrop click
    document.getElementById('manage-delete-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'manage-delete-modal') {
            closeManageDeleteModal();
        }
    });

    // Event delegation for pagination
    const paginationContainer = document.getElementById('manage-pagination');
    if (paginationContainer) {
        paginationContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-page]');
            if (btn && !btn.disabled) {
                const page = parseInt(btn.dataset.page, 10);
                if (!isNaN(page)) {
                    goToManagePage(page);
                }
            }
        });
    }

    // Event delegation for edit tags container
    const tagsContainer = document.getElementById('manage-edit-tags-container');
    if (tagsContainer) {
        tagsContainer.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-action="remove-tag"]');
            if (removeBtn) {
                const index = parseInt(removeBtn.dataset.index, 10);
                if (!isNaN(index)) {
                    removeManageEditTag(index);
                }
            }
        });
    }

    // Event delegation for autocomplete dropdowns
    document.addEventListener('click', (e) => {
        const autocompleteOption = e.target.closest('[data-action="select-autocomplete"]');
        if (autocompleteOption) {
            const inputId = autocompleteOption.dataset.inputId;
            const value = autocompleteOption.dataset.value;
            if (inputId && value) {
                selectManageAutocomplete(inputId, value);
            }
        }
    });

    // Initialize autocomplete
    initManageEditAutocomplete();
}

// Load manage sounds page
async function loadManageSoundsPage() {
    // Ensure items are loaded from Supabase
    if (typeof loadItemsFromSupabase === 'function') {
        await loadItemsFromSupabase();
    }

    populateManageFilters();
    renderManageSoundsGrid();
    updateSelectionUI();
    closeManageEdit();
    manageSelectedItems.clear();
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initManageSounds);

// Make functions globally accessible
window.toggleManageSelect = toggleManageSelect;
window.openManageDeleteSingle = openManageDeleteSingle;
window.goToManagePage = goToManagePage;
window.setManageItemsPerPage = setManageItemsPerPage;
window.unsaveManagedSound = unsaveManagedSound;
window.loadManageSoundsPage = loadManageSoundsPage;
