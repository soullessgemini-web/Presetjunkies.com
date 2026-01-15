// ===== FILTERS & TAGS =====

function updateDynamicFilters(category) {
    // Check if filterConfigs exists before accessing
    if (typeof filterConfigs === 'undefined' || !filterConfigs) return;
    const config = filterConfigs[category];
    if (!config) return;

    const filter1 = document.getElementById('dynamic-filter-1');
    const filter2 = document.getElementById('dynamic-filter-2');
    const filter3 = document.getElementById('dynamic-filter-3');
    const filter4 = document.getElementById('dynamic-filter-4');

    if (!filter1) return;

    const filter3Group = document.getElementById('filter-3-group');
    const filter4Group = document.getElementById('filter-4-group');

    [filter1, filter2, filter3, filter4].forEach((f, i) => {
        if (!f) return;
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
    const filter1Value = document.getElementById('dynamic-filter-1')?.value?.toLowerCase() || '';
    const filter2Value = document.getElementById('dynamic-filter-2')?.value?.toLowerCase() || '';
    const filter3Value = document.getElementById('dynamic-filter-3')?.value?.toLowerCase() || '';
    const filter4Value = document.getElementById('dynamic-filter-4')?.value?.toLowerCase() || '';
    const search = document.getElementById('tag-search')?.value?.toLowerCase()?.trim() || '';

    const grid = document.getElementById(`${currentTab}-grid`);
    if (!grid) return;

    const cards = grid.querySelectorAll('[data-item-id]');
    cards.forEach(card => {
        // Check if items and currentTab data exist
        if (typeof items === 'undefined' || !items || !items[currentTab]) return;
        const item = items[currentTab].find(i => i.id === parseInt(card.dataset.itemId));
        if (!item) return;

        let matches = true;

        if (currentTab === 'presets') {
            if (filter1Value && item.vst?.toLowerCase() !== filter1Value) matches = false;
            if (filter2Value && item.type?.toLowerCase() !== filter2Value) matches = false;
            if (selectedTypes.size > 0) {
                const itemType = item.type?.charAt(0).toUpperCase() + item.type?.slice(1).toLowerCase();
                if (!selectedTypes.has(itemType) && !selectedTypes.has(item.type)) matches = false;
            }
            if (selectedTags.size > 0) {
                const itemTagsUpper = (item.tags || []).map(t => t.toUpperCase());
                const hasAllTags = [...selectedTags].every(tag => itemTagsUpper.includes(tag.toUpperCase()));
                if (!hasAllTags) matches = false;
            }
        } else if (currentTab === 'samples') {
            if (filter1Value && item.type?.toLowerCase() !== filter1Value) matches = false;
            if (filter2Value && item.key?.toLowerCase() !== filter2Value) matches = false;
            if (selectedSampleTypes.size > 0) {
                const itemType = item.type?.charAt(0).toUpperCase() + item.type?.slice(1).toLowerCase();
                if (!selectedSampleTypes.has(itemType) && !selectedSampleTypes.has(item.type)) matches = false;
            }
            if (selectedLoopTypes.size > 0) {
                if (!selectedLoopTypes.has(item.loopType)) matches = false;
            }
            if (selectedTags.size > 0) {
                const itemTagsUpper = (item.tags || []).map(t => t.toUpperCase());
                const hasAllTags = [...selectedTags].every(tag => itemTagsUpper.includes(tag.toUpperCase()));
                if (!hasAllTags) matches = false;
            }
        } else if (currentTab === 'midi') {
            if (filter1Value && item.key?.toLowerCase() !== filter1Value) matches = false;
            if (filter2Value && item.scale?.toLowerCase() !== filter2Value) matches = false;
            if (selectedMidiKeys.size > 0) {
                if (!selectedMidiKeys.has(item.key)) matches = false;
            }
            if (selectedMidiScales.size > 0) {
                if (!selectedMidiScales.has(item.scale)) matches = false;
            }
            if (selectedTags.size > 0) {
                const itemTagsUpper = (item.tags || []).map(t => t.toUpperCase());
                const hasAllTags = [...selectedTags].every(tag => itemTagsUpper.includes(tag.toUpperCase()));
                if (!hasAllTags) matches = false;
            }
        } else if (currentTab === 'projects') {
            if (filter1Value && item.daw?.toLowerCase() !== filter1Value) matches = false;
            if (filter2Value && item.key?.toLowerCase() !== filter2Value) matches = false;
            if (filter3Value && item.scale?.toLowerCase() !== filter3Value) matches = false;
            if (filter4Value && item.genre?.toLowerCase() !== filter4Value) matches = false;
            if (selectedDaw && item.daw?.toLowerCase() !== selectedDaw) matches = false;
            if (selectedGenres.size > 0) {
                const itemGenre = item.genre?.charAt(0).toUpperCase() + item.genre?.slice(1).toLowerCase();
                if (!selectedGenres.has(itemGenre) && !selectedGenres.has(item.genre)) matches = false;
            }
            if (selectedTags.size > 0) {
                const itemTagsUpper = (item.tags || []).map(t => t.toUpperCase());
                const hasAllTags = [...selectedTags].every(tag => itemTagsUpper.includes(tag.toUpperCase()));
                if (!hasAllTags) matches = false;
            }
        }

        if (search) {
            const tagMatch = item.tags?.some(t => t.toLowerCase().includes(search)) || false;
            const titleMatch = item.title.toLowerCase().includes(search);
            if (!tagMatch && !titleMatch) matches = false;
        }

        card.style.display = matches ? 'block' : 'none';
    });
}

function updateInstrumentDisplay() {
    const vstImg = document.getElementById('vst-banner-img');
    const dawImg = document.getElementById('daw-display-img');
    const filter1Value = document.getElementById('dynamic-filter-1')?.value?.toLowerCase() || '';

    if (vstImg && vstImages[filter1Value]) {
        const safeVstSrc = sanitizeURL(vstImages[filter1Value]);
        vstImg.src = safeVstSrc || '';
        vstImg.alt = filter1Value;
    } else if (vstImg) {
        vstImg.src = '';
        vstImg.alt = '';
    }

    if (dawImg && dawImages[filter1Value]) {
        const safeDawSrc = sanitizeURL(dawImages[filter1Value]);
        dawImg.src = safeDawSrc || '';
        dawImg.alt = filter1Value;
    } else if (dawImg) {
        dawImg.src = '';
        dawImg.alt = '';
    }
}

// Set-based tag toggle handler
function setupSetTagHandler(selector, dataAttr, set, afterToggle) {
    document.querySelectorAll(selector).forEach(tag => {
        tag.addEventListener('click', () => {
            const value = tag.dataset[dataAttr];
            if (set.has(value)) {
                set.delete(value);
                tag.classList.remove('selected');
            } else {
                set.add(value);
                tag.classList.add('selected');
            }
            filterItems();
            if (afterToggle) afterToggle();
        });
    });
}

// Setup search filter for tags
function setupTagSearch(inputId, tagSelector, dataAttr) {
    document.getElementById(inputId)?.addEventListener('input', (e) => {
        const search = e.target.value.toLowerCase();
        document.querySelectorAll(tagSelector).forEach(tag => {
            const value = tag.dataset[dataAttr].toLowerCase();
            tag.style.display = value.includes(search) ? '' : 'none';
        });
    });
}

// Render trending tags with counts
function renderTrendingTags(category, containerId, set) {
    const tagCounts = {};
    (items[category] || []).forEach(item => {
        (item.tags || []).forEach(tag => {
            const upperTag = tag.toUpperCase();
            tagCounts[upperTag] = (tagCounts[upperTag] || 0) + 1;
        });
    });
    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = sorted.map(([tag, count]) =>
        `<button class="filter-list-item trending-tag ${set.has(tag) ? 'selected' : ''}" data-tag="${escapeAttr(tag)}"><span class="filter-checkbox"></span><span>${escapeHTML(tag)}</span><span class="filter-count"><span class="filter-count-num">${count}</span></span></button>`
    ).join('');
    container.querySelectorAll('.trending-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;
            if (set.has(tag)) {
                set.delete(tag);
                btn.classList.remove('selected');
            } else {
                set.add(tag);
                btn.classList.add('selected');
            }
            filterItems();
            updateFilterTabIndicators?.();
        });
    });
}

function getTrendingTagsWithCounts(category) {
    const tagCounts = {};
    // First count tags from uploaded items
    (items[category] || []).forEach(item => {
        (item.tags || []).forEach(tag => {
            const upperTag = tag.toUpperCase();
            tagCounts[upperTag] = (tagCounts[upperTag] || 0) + 1;
        });
    });

    // If no items, use global tags from localStorage
    if (Object.keys(tagCounts).length === 0) {
        const globalTags = safeJSONParse(localStorage.getItem('globalTags'), {});
        Object.entries(globalTags).forEach(([tag, count]) => {
            tagCounts[tag.toUpperCase()] = count;
        });
    }

    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
    return sorted;
}

function getTrendingTags(category) {
    return getTrendingTagsWithCounts(category).map(([tag]) => tag);
}

function renderCategoryTrendingTags(category, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const tagsWithCounts = getTrendingTagsWithCounts(category);
    console.log('renderCategoryTrendingTags', category, tagsWithCounts.map(([t,c]) => `${t}:${c}`));
    const html = tagsWithCounts.map((entry) => {
        const tag = entry[0];
        const count = entry[1];
        return `<button class="filter-list-item trending-tag ${selectedTags.has(tag) ? 'selected' : ''}" data-tag="${escapeAttr(tag)}"><span class="filter-checkbox"></span><span>${escapeHTML(tag)}</span><span class="filter-count">${count}</span></button>`;
    }).join('');
    container.innerHTML = html;
    container.querySelectorAll('.trending-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;
            if (selectedTags.has(tag)) {
                selectedTags.delete(tag);
                btn.classList.remove('selected');
            } else {
                selectedTags.add(tag);
                btn.classList.add('selected');
            }
            filterItems();
            updateFilterTabIndicators();
        });
    });
}

function updateFilterTabIndicators() {
    document.querySelector('[data-filter-tab="vsts"]')?.classList.toggle('has-selection', !!document.querySelector('.vst-tag.selected'));
    document.querySelector('[data-filter-tab="types"]')?.classList.toggle('has-selection', !!document.querySelector('.type-tag.selected'));
    document.querySelector('[data-filter-tab="tags"]')?.classList.toggle('has-selection', !!document.querySelector('.trending-tag.selected'));
}

// Update filter counts based on uploaded items
function updateFilterCounts() {
    // Count presets by VST
    const vstCounts = {};
    items.presets.forEach(item => {
        const vst = item.vst?.toLowerCase();
        if (vst) vstCounts[vst] = (vstCounts[vst] || 0) + 1;
    });

    // Update VST tag counts (in presets panel)
    document.querySelectorAll('#vsts-section .vst-tag').forEach(tag => {
        const vst = tag.dataset.vst;
        const count = vstCounts[vst] || 0;
        updateTagCount(tag, count);
    });

    // Count presets by type (normalize to match filter tags - capitalize first letter, FX/Keys special cases)
    const typeCounts = {};
    items.presets.forEach(item => {
        const type = item.type;
        if (type) {
            // Normalize: 'lead' -> 'Lead', 'fx' -> 'FX', 'keys' -> 'Keys'
            let normalizedType;
            if (type.toLowerCase() === 'fx') {
                normalizedType = 'FX';
            } else {
                normalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
            }
            typeCounts[normalizedType] = (typeCounts[normalizedType] || 0) + 1;
        }
    });

    // Update sound type tag counts (in presets panel)
    document.querySelectorAll('#types-section .type-tag').forEach(tag => {
        const type = tag.dataset.type;
        const count = typeCounts[type] || 0;
        updateTagCount(tag, count);
    });

    // Count presets by tags
    const presetTagCounts = {};
    items.presets.forEach(item => {
        if (item.tags) {
            item.tags.forEach(tag => {
                presetTagCounts[tag] = (presetTagCounts[tag] || 0) + 1;
            });
        }
    });

    // Update preset trending tag counts
    document.querySelectorAll('#preset-trending-tags .trending-tag').forEach(tag => {
        const tagName = tag.dataset.tag;
        const count = presetTagCounts[tagName] || 0;
        updateTagCount(tag, count);
    });

    // Count samples by sample type (normalize to capitalized first letter to match filter tags)
    const sampleTypeCounts = {};
    items.samples.forEach(item => {
        const type = item.type;
        if (type) {
            // Normalize: 'bass' -> 'Bass', 'fx' -> 'FX' (special case for FX)
            const normalizedType = type.toUpperCase() === 'FX' ? 'FX' : type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
            sampleTypeCounts[normalizedType] = (sampleTypeCounts[normalizedType] || 0) + 1;
        }
    });

    // Update sample type tag counts
    document.querySelectorAll('#sample-type-tags .sample-type-tag').forEach(tag => {
        const type = tag.dataset.type;
        const count = sampleTypeCounts[type] || 0;
        updateTagCount(tag, count);
    });

    // Count samples by loop type (Loop vs One Shot)
    const loopTypeCounts = {};
    items.samples.forEach(item => {
        const loopType = item.loopType;
        if (loopType) loopTypeCounts[loopType] = (loopTypeCounts[loopType] || 0) + 1;
    });

    // Update loop type tag counts
    document.querySelectorAll('#loop-type-tags .loop-type-tag').forEach(tag => {
        const loopType = tag.dataset.loopType;
        const count = loopTypeCounts[loopType] || 0;
        updateTagCount(tag, count);
    });

    // Count samples by tags
    const sampleTagCounts = {};
    items.samples.forEach(item => {
        if (item.tags) {
            item.tags.forEach(tag => {
                sampleTagCounts[tag] = (sampleTagCounts[tag] || 0) + 1;
            });
        }
    });

    // Update sample trending tag counts
    document.querySelectorAll('#sample-trending-tags .trending-tag').forEach(tag => {
        const tagName = tag.dataset.tag;
        const count = sampleTagCounts[tagName] || 0;
        updateTagCount(tag, count);
    });

    // Count MIDI by key
    const midiKeyCounts = {};
    items.midi.forEach(item => {
        const key = item.key;
        if (key) midiKeyCounts[key] = (midiKeyCounts[key] || 0) + 1;
    });

    // Update MIDI key tag counts
    document.querySelectorAll('#midi-key-tags .midi-key-tag').forEach(tag => {
        const key = tag.dataset.key;
        const count = midiKeyCounts[key] || 0;
        updateTagCount(tag, count);
    });

    // Count MIDI by scale
    const midiScaleCounts = {};
    items.midi.forEach(item => {
        const scale = item.scale;
        if (scale) midiScaleCounts[scale] = (midiScaleCounts[scale] || 0) + 1;
    });

    // Update MIDI scale tag counts
    document.querySelectorAll('#midi-scale-tags .midi-scale-tag').forEach(tag => {
        const scale = tag.dataset.scale;
        const count = midiScaleCounts[scale] || 0;
        updateTagCount(tag, count);
    });

    // Count MIDI by tags
    const midiTagCounts = {};
    items.midi.forEach(item => {
        if (item.tags) {
            item.tags.forEach(tag => {
                midiTagCounts[tag] = (midiTagCounts[tag] || 0) + 1;
            });
        }
    });

    // Update MIDI trending tag counts
    document.querySelectorAll('#midi-trending-tags .trending-tag').forEach(tag => {
        const tagName = tag.dataset.tag;
        const count = midiTagCounts[tagName] || 0;
        updateTagCount(tag, count);
    });

    // Count projects by DAW
    const dawCounts = {};
    items.projects.forEach(item => {
        const daw = item.daw?.toLowerCase();
        if (daw) dawCounts[daw] = (dawCounts[daw] || 0) + 1;
    });

    // Update DAW tag counts
    document.querySelectorAll('#daw-tags .vst-tag').forEach(tag => {
        const daw = tag.dataset.daw;
        const count = dawCounts[daw] || 0;
        updateTagCount(tag, count);
    });

    // Count projects by genre
    const genreCounts = {};
    items.projects.forEach(item => {
        const genre = item.genre;
        if (genre) genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    });

    // Update genre tag counts
    document.querySelectorAll('#genre-tags .type-tag').forEach(tag => {
        const genre = tag.dataset.genre;
        const count = genreCounts[genre] || 0;
        updateTagCount(tag, count);
    });

    // Count projects by tags
    const projectTagCounts = {};
    items.projects.forEach(item => {
        if (item.tags) {
            item.tags.forEach(tag => {
                projectTagCounts[tag] = (projectTagCounts[tag] || 0) + 1;
            });
        }
    });

    // Update project trending tag counts
    document.querySelectorAll('#project-trending-tags .trending-tag').forEach(tag => {
        const tagName = tag.dataset.tag;
        const count = projectTagCounts[tagName] || 0;
        updateTagCount(tag, count);
    });

    // Count originals by genre
    const originalsGenreCounts = {};
    if (items.originals) {
        items.originals.forEach(item => {
            const genre = item.genre;
            if (genre) originalsGenreCounts[genre] = (originalsGenreCounts[genre] || 0) + 1;
        });
    }

    // Update originals genre tag counts
    document.querySelectorAll('.originals-genre-tag').forEach(tag => {
        const genre = tag.dataset.genre;
        const count = originalsGenreCounts[genre] || 0;
        updateTagCount(tag, count);
    });
}

// Helper function to update or add count span to a tag
function updateTagCount(tag, count) {
    let countSpan = tag.querySelector('.filter-count');
    if (!countSpan) {
        countSpan = document.createElement('span');
        countSpan.className = 'filter-count';
        tag.appendChild(countSpan);
    }
    countSpan.innerHTML = `<span class="filter-count-num">${count}</span>`;
}

// Initialize filter event listeners
function initFilterListeners() {
    document.getElementById('dynamic-filter-1')?.addEventListener('change', filterItems);
    document.getElementById('dynamic-filter-2')?.addEventListener('change', filterItems);
    document.getElementById('dynamic-filter-3')?.addEventListener('change', filterItems);
    document.getElementById('dynamic-filter-4')?.addEventListener('change', filterItems);
    document.getElementById('tag-search')?.addEventListener('input', filterItems);
    document.getElementById('sort-filter')?.addEventListener('change', filterItems);
    document.getElementById('dynamic-filter-1')?.addEventListener('change', updateInstrumentDisplay);

    // VST Tags (single-select with image update)
    document.querySelectorAll('.vst-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const vst = tag.dataset.vst;
            if (selectedVst === vst) {
                selectedVst = null;
                tag.classList.remove('selected');
            } else {
                document.querySelectorAll('.vst-tag').forEach(t => {
                    t.classList.remove('selected');
                });
                selectedVst = vst;
                tag.classList.add('selected');
            }
            const vstImg = document.getElementById('vst-banner-img');
            if (vstImg) {
                const safeVstSrc = selectedVst && vstImages[selectedVst] ? sanitizeURL(vstImages[selectedVst]) : '';
                vstImg.src = safeVstSrc || '';
                vstImg.alt = selectedVst || '';
            }
            const filter1El = document.getElementById('dynamic-filter-1');
            if (filter1El) filter1El.value = selectedVst || '';
            filterItems();
            updateFilterTabIndicators();
        });
    });

    // DAW Tags (single-select with image update) for Projects
    document.querySelectorAll('#daw-tags .vst-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const daw = tag.dataset.daw;
            if (selectedDaw === daw) {
                selectedDaw = null;
                tag.classList.remove('selected');
            } else {
                document.querySelectorAll('#daw-tags .vst-tag').forEach(t => {
                    t.classList.remove('selected');
                });
                selectedDaw = daw;
                tag.classList.add('selected');
            }
            const dawImg = document.getElementById('daw-banner-img');
            if (dawImg) {
                const safeDawSrc = selectedDaw && dawImages[selectedDaw] ? sanitizeURL(dawImages[selectedDaw]) : '';
                dawImg.src = safeDawSrc || '';
                dawImg.alt = selectedDaw || '';
            }
            filterItems();
        });
    });

    // Set-based tag handlers
    setupSetTagHandler('.type-tag', 'type', selectedTypes, updateFilterTabIndicators);

    // Loop type - radio button style (only one at a time)
    const loopTypes = ['Drum', 'Bass', 'Melody', 'Vocal', 'FX', 'Percussion', 'Synth', 'Strings', 'Keys', 'Other'];
    const oneShotTypes = ['Drum', 'Foley', 'Vocal', 'Synth', 'FX', 'Keys', 'Bass', 'Strings', 'Other'];

    function updateSampleTypesList(isLoop) {
        const container = document.getElementById('sample-type-tags');
        if (!container) return;

        const types = isLoop ? loopTypes : oneShotTypes;
        const loopTypeValue = isLoop ? 'Loop' : 'One Shot';

        // Count samples by type for the current loop type
        const typeCounts = {};
        items.samples.forEach(item => {
            if (item.loopType === loopTypeValue && item.type) {
                typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
            }
        });

        // Clear current selections when switching
        selectedSampleTypes.clear();

        container.innerHTML = types.map(type => {
            const count = typeCounts[type] || 0;
            return `
                <button class="filter-list-item sample-type-tag" data-type="${escapeAttr(type)}"><span class="filter-checkbox"></span><span>${escapeHTML(type.toUpperCase())}</span><span class="filter-count"><span class="filter-count-num">${count}</span></span></button>
            `;
        }).join('');

        // Re-attach click handlers
        container.querySelectorAll('.sample-type-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                const value = tag.dataset.type;
                tag.classList.toggle('selected');
                if (tag.classList.contains('selected')) {
                    selectedSampleTypes.add(value);
                } else {
                    selectedSampleTypes.delete(value);
                }
                filterItems();
            });
        });
    }

    document.querySelectorAll('.loop-type-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const value = tag.dataset.loopType;

            // Remove selected from all loop-type-tags
            document.querySelectorAll('.loop-type-tag').forEach(t => t.classList.remove('selected'));

            // Select this one
            tag.classList.add('selected');

            // Update the set (clear and add new value)
            selectedLoopTypes.clear();
            selectedLoopTypes.add(value);

            // Update the Loops section label
            const loopsLabel = document.querySelector('[data-section="sample-types"] .filter-section-label');
            if (loopsLabel) {
                loopsLabel.textContent = value === 'Loop' ? 'Loops' : 'One Shots';
            }

            // Update the sample types list
            updateSampleTypesList(value === 'Loop');

            filterItems();
        });
    });

    setupSetTagHandler('.sample-type-tag', 'type', selectedSampleTypes);
    setupSetTagHandler('#genre-tags .type-tag', 'genre', selectedGenres);
    setupSetTagHandler('.midi-key-tag', 'key', selectedMidiKeys);
    setupSetTagHandler('.midi-scale-tag', 'scale', selectedMidiScales);

    // Setup all search filters
    setupTagSearch('preset-tags-search', '#preset-trending-tags .trending-tag', 'tag');
    setupTagSearch('preset-vst-search', '#filter-content-vsts .vst-tag', 'vst');
    setupTagSearch('preset-type-search', '#filter-content-types .type-tag', 'type');
    setupTagSearch('sample-type-search', '#sample-type-tags .sample-type-tag', 'type');
    setupTagSearch('sample-tags-search', '#sample-trending-tags .trending-tag', 'tag');
    setupTagSearch('midi-key-search', '#midi-key-tags .midi-key-tag', 'key');
    setupTagSearch('midi-scale-search', '#midi-scale-tags .midi-scale-tag', 'scale');
    setupTagSearch('midi-tags-search', '#midi-trending-tags .trending-tag', 'tag');
    setupTagSearch('project-daw-search', '#daw-tags .vst-tag', 'daw');
    setupTagSearch('project-genre-search', '#genre-tags .type-tag', 'genre');
    setupTagSearch('project-tags-search', '#project-trending-tags .trending-tag', 'tag');

    // Filter tab switching
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.filterTab;
            const parentPanel = tab.closest('.instrument-display');
            parentPanel.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            parentPanel.querySelectorAll('.filter-content').forEach(panel => panel.classList.remove('active'));
            document.getElementById(`filter-content-${tabName}`)?.classList.add('active');
        });
    });

    // Collapsible filter sections
    document.querySelectorAll('.filter-section-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.filter-section');
            section.classList.toggle('collapsed');
        });
    });

    // Initial render of all trending tags and filter counts
    setTimeout(() => {
        refreshAllTrendingTags();
    }, 100);
}

// Refresh all trending tags - call this after items are loaded
function refreshAllTrendingTags() {
    console.log('refreshAllTrendingTags called');
    renderCategoryTrendingTags('presets', 'preset-trending-tags');
    renderCategoryTrendingTags('samples', 'sample-trending-tags');
    renderCategoryTrendingTags('midi', 'midi-trending-tags');
    renderCategoryTrendingTags('projects', 'project-trending-tags');
    updateFilterCounts();
}
window.refreshAllTrendingTags = refreshAllTrendingTags;
