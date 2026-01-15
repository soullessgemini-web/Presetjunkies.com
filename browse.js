// ===== BROWSE - Cards, Grid, Pagination =====

// DAW value to display label mapping
const dawLabels = {
    'ableton': 'Ableton',
    'bitwig': 'Bitwig',
    'cakewalk': 'Cakewalk',
    'cubase': 'Cubase',
    'flstudio': 'FL Studio',
    'logic': 'Logic',
    'protools': 'Pro Tools',
    'reaper': 'Reaper',
    'reason': 'Reason',
    'studioone': 'Studio One'
};

function formatDawLabel(daw) {
    if (!daw) return 'Unknown';
    return dawLabels[daw.toLowerCase()] || daw;
}

// Make globally available
window.formatDawLabel = formatDawLabel;

// Helper to find item from global items or currentProfileGroup (for profile views)
// Uses loose equality (==) to handle both string and number IDs from Supabase
function findItemById(id, cat) {
    // First check global items
    let item = items[cat]?.find(i => i.id == id);

    // Fallback to currentProfileGroup (when viewing other user's profile)
    if (!item && window.currentProfileGroup && window.currentProfileGroup.items) {
        item = window.currentProfileGroup.items.find(i => i.id == id);
    }

    return item;
}
window.findItemById = findItemById;

// Card flip overlay
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
    // Validate itemId is a number to prevent selector injection
    const safeId = Number.isInteger(itemId) ? itemId : parseInt(itemId, 10);
    if (isNaN(safeId)) return;

    const cardBack = document.querySelector(`[data-item-id="${safeId}"] .item-card-back`);

    if (flippedCards.has(itemId)) {
        cardBack?.classList.remove('show');
        flippedCards.delete(itemId);
    } else {
        closeAllCardInfo();
        cardBack?.classList.add('show');
        flippedCards.add(itemId);
    }
}

function closeAllCardInfo() {
    flippedCards.forEach(id => {
        // Validate id is a number
        const safeId = Number.isInteger(id) ? id : parseInt(id, 10);
        if (isNaN(safeId)) return;
        const cardBack = document.querySelector(`[data-item-id="${safeId}"] .item-card-back`);
        cardBack?.classList.remove('show');
    });
    flippedCards.clear();
}

window.toggleCardFlip = toggleCardInfo;
window.toggleCardInfo = toggleCardInfo;
window.closeAllFlippedCards = closeAllCardInfo;
window.closeAllCardInfo = closeAllCardInfo;

// Library Functions
window.addToLibraryFromCard = async (id, category) => {
    const item = findItemById(id, category);
    if (!item) return;

    // Validate id is a number to prevent selector injection
    const safeId = Number.isInteger(id) ? id : parseInt(id, 10);
    if (isNaN(safeId)) return;

    const index = library.findIndex(l => l.id == id);
    const btn = document.querySelector(`[data-item-id="${safeId}"] .row-info-btn`);

    if (index === -1) {
        // Add to library
        library.push({ id: item.id, title: item.title, vst: item.vst, type: item.type, category: category });
        localStorage.setItem('presetJunkiesLibrary', JSON.stringify(library));

        if (btn) {
            btn.classList.add('saved');
            btn.textContent = 'Saved';
        }

        // Sync with Supabase
        try {
            const { user } = await supabaseGetUser();
            if (user && typeof supabaseAddToLibrary === 'function') {
                const { error } = await supabaseAddToLibrary(user.id, item.id);
                if (error) console.error('Error adding to Supabase library:', error);
            }
            // Increment saves count
            if (typeof supabaseIncrementCounter === 'function') {
                await supabaseIncrementCounter(item.id, 'saves');
            }
        } catch (err) {
            console.error('Error syncing library add to Supabase:', err);
        }
    } else {
        // Remove from library
        library.splice(index, 1);
        localStorage.setItem('presetJunkiesLibrary', JSON.stringify(library));

        if (btn) {
            btn.classList.remove('saved');
            btn.textContent = 'Save';
        }

        // Sync with Supabase
        try {
            const { user } = await supabaseGetUser();
            if (user && typeof supabaseRemoveFromLibrary === 'function') {
                const { error } = await supabaseRemoveFromLibrary(user.id, item.id);
                if (error) console.error('Error removing from Supabase library:', error);
            }
            // Decrement saves count
            if (typeof supabaseDecrementCounter === 'function') {
                await supabaseDecrementCounter(item.id, 'saves');
            }
        } catch (err) {
            console.error('Error syncing library remove to Supabase:', err);
        }
    }
};

function renderUnifiedLibrary() {
    const grid = document.getElementById('library-grid');
    if (!grid) return; // Library tab not visible
    grid.innerHTML = '';

    if (library.length === 0) {
        grid.innerHTML = '<div style="color: var(--text-tertiary); padding: 40px 0; text-align: center;">Your library is empty. Add items by clicking the + button on cards.</div>';
        return;
    }

    library.forEach(libItem => {
        const item = items[libItem.category]?.find(i => i.id == libItem.id);
        if (!item) return;

        const wrap = document.createElement('div');
        wrap.dataset.itemId = item.id;
        wrap.innerHTML = createCardHTML(item, libItem.category);
        grid.appendChild(wrap);

        setupCardAudio(item, libItem.category);
    });
}

// Download handling
window.handleDownload = async (id, cat) => {
    const item = findItemById(id, cat);
    if (item && item.presetData) {
        item.downloads++;
        const countEl = document.getElementById(`downloads-count-${id}`);
        if (countEl) countEl.textContent = formatCount(item.downloads);

        // Also update card count
        const cardCountEl = document.getElementById(`card-downloads-${id}`);
        if (cardCountEl) cardCountEl.textContent = formatCount(item.downloads);

        const a = document.createElement('a');
        a.href = item.presetData;
        a.download = item.presetName;
        a.click();

        // Sync to Supabase
        if (typeof supabaseIncrementCounter === 'function') {
            try {
                await supabaseIncrementCounter(id, 'downloads');
            } catch (err) {
                console.error('Error syncing download count:', err);
            }
        }
    }
};

// Like toggle (with action locking to prevent race conditions)
window.toggleLike = async (id, cat) => {
    const lockId = `like-${id}`;
    if (typeof isActionLocked === 'function' && isActionLocked(lockId)) return;

    const doToggle = async () => {
        const item = findItemById(id, cat);
        if (!item) return;

        const wasLiked = item.liked;
        item.liked = !item.liked;
        if (item.liked) {
            item.hearts++;
        } else {
            item.hearts = Math.max(0, item.hearts - 1);
        }

        // Update UI immediately
        const heartIcon = document.getElementById(`heart-icon-${id}`);
        if (heartIcon) {
            heartIcon.setAttribute('fill', item.liked ? '#ff4757' : 'none');
            heartIcon.setAttribute('stroke', item.liked ? '#ff4757' : '#dedede');
        }

        const countEl = document.getElementById(`hearts-count-${id}`);
        if (countEl) countEl.textContent = formatCount(item.hearts);

        // Save to Supabase if authenticated
        if (typeof supabaseGetUser === 'function') {
            try {
                const { user } = await supabaseGetUser();
                if (user && typeof id === 'number') {
                    if (item.liked) {
                        await supabaseLikeItem(user.id, id);
                    } else {
                        await supabaseUnlikeItem(user.id, id);
                    }
                }
            } catch (err) {
                console.error('Error syncing like to Supabase:', err);
                // Revert on error
                item.liked = wasLiked;
                item.hearts = wasLiked ? item.hearts + 1 : Math.max(0, item.hearts - 1);
            }
        }
    };

    if (typeof withActionLock === 'function') {
        withActionLock(lockId, doToggle, 300)();
    } else {
        doToggle();
    }
};

// Card action buttons
window.toggleCardLike = (id, cat) => {
    // Check if user is logged in
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    // Prevent liking own sounds
    let item = findItemById(id, cat);
    if (item) {
        const currentUser = localStorage.getItem('profileUsername');
        if (currentUser && item.uploader && item.uploader.toLowerCase() === currentUser.toLowerCase()) {
            return; // Can't like your own sound
        }
    }

    toggleLike(id, cat);
    item = findItemById(id, cat);
    const heartIcon = document.getElementById(`heart-${id}`);
    if (heartIcon && item) {
        heartIcon.classList.toggle('liked', item.liked);
        heartIcon.setAttribute('fill', item.liked ? 'currentColor' : 'none');
    }
    const countEl = document.getElementById(`card-likes-${id}`);
    if (countEl && item) countEl.textContent = formatCount(item.hearts || 0);
    if (centerPanelItem && centerPanelItem.id == id) {
        updateMetricsPanel(item);
    }
    // Add notification when liked (not unliked)
    if (item && item.liked && window.addNotification) {
        window.addNotification('like', item.title || item.name, id, cat, 'You');
    }
};

window.saveCardItem = (id, cat) => {
    // Check if user is logged in
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }
    // Action locking to prevent race conditions
    const lockId = `save-${id}`;
    if (typeof isActionLocked === 'function' && isActionLocked(lockId)) {
        return;
    }

    const doSave = () => {
        const alreadySaved = library.some(l => l.id == id);
        addToLibraryFromCard(id, cat); // This toggles save/unsave

        const item = findItemById(id, cat);
        if (item) {
            if (!item.saves) item.saves = 0;
            if (alreadySaved) {
                // Unsaving - decrement count
                item.saves = Math.max(0, item.saves - 1);
            } else {
                // Saving - increment count
                item.saves++;
                // Add notification when saved (not unsaved)
                if (window.addNotification) {
                    window.addNotification('save', item.title || item.name, id, cat, 'You');
                }
            }
            const countEl = document.getElementById(`card-saves-${id}`);
            if (countEl) countEl.textContent = formatCount(item.saves);

            // Update button visual state using safe ID-based lookup
            const cardEl = document.getElementById(`card-${id}`);
            if (cardEl) {
                const btn = cardEl.querySelector('.card-action-btn[data-tooltip="Save"]');
                if (btn) {
                    const svg = btn.querySelector('svg');
                    if (svg) {
                        svg.setAttribute('fill', alreadySaved ? 'none' : 'currentColor');
                    }
                }
            }
        }
    };

    if (typeof withActionLock === 'function') {
        withActionLock(lockId, doSave, 300)();
    } else {
        doSave();
    }
};

window.shareCardItem = (id, cat) => {
    // Check if user is logged in
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    const item = findItemById(id, cat);
    if (!item) return;

    // Update share count and notification immediately
    if (!item.shares) item.shares = 0;
    item.shares++;
    const countEl = document.getElementById(`card-shares-${id}`);
    if (countEl) countEl.textContent = formatCount(item.shares);

    // Add notification for share
    if (window.addNotification) {
        window.addNotification('share', item.title || item.name, id, cat, 'You');
    }

    // Copy URL to clipboard (best effort)
    const shareUrl = `${window.location.origin}?item=${id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
};

window.repostCardItem = (id, cat) => {
    const item = findItemById(id, cat);
    if (item) {
        item.reposted = !item.reposted;
        if (!item.reposts) item.reposts = 0;
        if (item.reposted) {
            item.reposts++;
        } else {
            item.reposts = Math.max(0, item.reposts - 1);
        }
        const repostIcon = document.getElementById(`repost-${id}`);
        if (repostIcon) {
            repostIcon.classList.toggle('reposted', item.reposted);
        }
        const countEl = document.getElementById(`card-reposts-${id}`);
        if (countEl) countEl.textContent = formatCount(item.reposts);
    }
};

window.downloadCardItem = (id, cat) => {
    // Check if user is logged in
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }
    // Action locking to prevent race conditions
    const lockId = `download-${id}`;
    if (typeof isActionLocked === 'function' && isActionLocked(lockId)) return;

    const doDownload = () => {
        handleDownload(id, cat);
        // Note: handleDownload already increments downloads count
        const item = findItemById(id, cat);
        if (item) {
            const countEl = document.getElementById(`card-downloads-${id}`);
            if (countEl) countEl.textContent = formatCount(item.downloads || 0);
            // Add notification for download
            if (window.addNotification) {
                window.addNotification('download', item.title || item.name, id, cat, 'You');
            }
        }
    };

    if (typeof withActionLock === 'function') {
        withActionLock(lockId, doDownload, 1000)();
    } else {
        doDownload();
    }
};

// Card HTML generation
function createCardHTML(item, category) {
    const isProject = category === 'projects';
    const isMidi = category === 'midi';
    const isPreset = category === 'presets';
    const inLibrary = typeof library !== 'undefined' && library.some(l => l.id == item.id);

    let wrapperClass = 'item-card-wrapper';
    if (isPreset || isMidi) wrapperClass += ' preset-card';
    else if (isProject) wrapperClass += ' project-card';

    let cardClass = 'item-card item-card-front';
    if (isPreset) cardClass += ' preset-card';
    else if (isMidi) cardClass += ' preset-card midi-card';
    else if (isProject) cardClass += ' project-card';

    let frontContent = '';
    const uploaderName = item.uploader || 'username';

    if (isProject) {
        // Projects require video
        frontContent = `
            <div class="player-container video-player-container">
                <video class="video-background" id="video-${item.id}" playsinline><source src="${escapeAttr(sanitizeURL(item.videoBlob) || '')}" type="video/mp4"></video>
                <div class="card-vst-corner">
                    <span class="card-vst-pill">${escapeHTML(formatDawLabel(item.daw).charAt(0).toUpperCase() + formatDawLabel(item.daw).slice(1).toLowerCase())}</span>
                </div>
                <div class="item-title">${escapeHTML(item.title)}</div>
                <div class="card-play-btn video-play-btn" id="play-btn-${item.id}" data-action="toggleVideoPlay" data-id="${escapeAttr(String(item.id))}">
                    <span class="card-play-icon">▶</span>
                </div>
                <div class="video-scrub-bar" id="video-scrub-${item.id}">
                    <div class="video-scrub-progress" id="video-progress-${item.id}"></div>
                    <span class="video-scrub-time" id="video-time-${item.id}">0:00 / 0:00</span>
                </div>
                <button class="video-fullscreen-btn" id="fullscreen-btn-${item.id}" data-action="toggleVideoFullscreen" data-id="${escapeAttr(String(item.id))}">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                    </svg>
                </button>
                <div class="card-actions">
                    <button class="card-action-btn" data-action="toggleCardLike" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}" data-tooltip="Like">
                        <svg class="card-action-icon ${item.liked ? 'liked' : ''}" id="heart-${item.id}" viewBox="0 0 24 24" fill="${item.liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span class="card-action-count" id="card-likes-${item.id}">${formatCount(item.hearts || 0)}</span>
                    </button>
                    <button class="card-action-btn${inLibrary ? ' saved' : ''}" data-action="saveCardItem" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}" data-tooltip="Save">
                        <svg class="card-action-icon" viewBox="0 0 24 24" fill="${inLibrary ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span class="card-action-count" id="card-saves-${item.id}">${formatCount(item.saves || 0)}</span>
                    </button>
                    <button class="card-action-btn" data-action="openShareModal" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}" data-tooltip="Share">
                        <svg class="card-action-icon" id="share-${item.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        <span class="card-action-count" id="card-shares-${item.id}">${formatCount(item.shares || 0)}</span>
                    </button>
                    <button class="card-action-btn" data-action="downloadCardItem" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}" data-tooltip="Download">
                        <svg class="card-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <span class="card-action-count" id="card-downloads-${item.id}">${formatCount(item.downloads || 0)}</span>
                    </button>
                </div>
            </div>
        `;
    } else {
        // Only show piano roll container for MIDI items
        const visualizerHTML = isMidi ? `
            <div class="piano-roll-container" id="piano-roll-${item.id}">
                <canvas class="piano-roll-canvas" id="canvas-${item.id}"></canvas>
                <div class="piano-roll-progress" id="progress-${item.id}"></div>
            </div>` : '';

        const tagsToShow = (item.tags || []).slice(0, 3);

        // Build card top section based on type
        let cardTopHTML = '';
        if (isProject) {
            // Project: only show DAW on card (uppercase)
            cardTopHTML = `
                <div class="card-vst-corner">
                    <span class="card-vst-pill">${escapeHTML(formatDawLabel(item.daw).charAt(0).toUpperCase() + formatDawLabel(item.daw).slice(1).toLowerCase())}</span>
                </div>`;
        } else if (isMidi) {
            // MIDI: always show "MIDI" as the tag
            cardTopHTML = `
                <div class="card-vst-corner">
                    <span class="card-vst-pill">Midi</span>
                </div>`;
        } else if (category === 'samples') {
            // Samples: show Loop/One Shot as main tag, subcategory as secondary (uppercase)
            const mainTag = item.loopType || 'Sample';
            const secondaryTag = (item.type && item.type !== 'sample') ? item.type : '';
            cardTopHTML = `
                <div class="card-vst-corner">
                    <span class="card-vst-pill">${escapeHTML(mainTag.charAt(0).toUpperCase() + mainTag.slice(1).toLowerCase())}</span>
                    ${secondaryTag ? `<span class="card-vst-pill card-secondary-pill">${escapeHTML(secondaryTag.charAt(0).toUpperCase() + secondaryTag.slice(1).toLowerCase())}</span>` : ''}
                </div>`;
        } else if (category === 'originals') {
            // Originals: show genre as the tag
            const genreTag = item.genre || (item.tags && item.tags[0]) || 'Original';
            cardTopHTML = `
                <div class="card-vst-corner">
                    <span class="card-vst-pill">${escapeHTML(genreTag.charAt(0).toUpperCase() + genreTag.slice(1).toLowerCase())}</span>
                </div>`;
        } else if (isPreset) {
            // Presets: show VST as main tag, sound type as secondary
            const mainTag = item.vst || 'Preset';
            const secondaryTag = item.type || '';
            cardTopHTML = `
                <div class="card-vst-corner">
                    <span class="card-vst-pill">${escapeHTML(mainTag.charAt(0).toUpperCase() + mainTag.slice(1).toLowerCase())}</span>
                    ${secondaryTag ? `<span class="card-vst-pill card-secondary-pill">${escapeHTML(secondaryTag.charAt(0).toUpperCase() + secondaryTag.slice(1).toLowerCase())}</span>` : ''}
                </div>`;
        } else {
            // Fallback for any other type
            const mainTag = item.vst || formatDawLabel(item.daw) || 'Unknown';
            cardTopHTML = `
                <div class="card-vst-corner">
                    <span class="card-vst-pill">${escapeHTML(mainTag.charAt(0).toUpperCase() + mainTag.slice(1).toLowerCase())}</span>
                </div>`;
        }

        frontContent = `
            <div class="player-container" style="${item.coverArt && sanitizeCSSUrl(item.coverArt) ? `background-image: url('${sanitizeCSSUrl(item.coverArt)}'); background-size: cover; background-position: center;` : ''}">
                ${!item.coverArt && !isMidi ? '<img src="./Emojies/pepe-disappointed-pepe.png" alt="" class="card-placeholder-img">' : ''}
                ${cardTopHTML}
                ${visualizerHTML}
                <div class="item-title">${escapeHTML(item.title)}</div>
                <div class="card-play-btn" id="play-btn-${item.id}" data-action="togglePlay" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}">
                    <span class="card-play-icon">▶</span>
                </div>
                <div class="card-actions">
                    <button class="card-action-btn" data-action="toggleCardLike" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}" data-tooltip="Like">
                        <svg class="card-action-icon ${item.liked ? 'liked' : ''}" id="heart-${item.id}" viewBox="0 0 24 24" fill="${item.liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span class="card-action-count" id="card-likes-${item.id}">${formatCount(item.hearts || 0)}</span>
                    </button>
                    <button class="card-action-btn${inLibrary ? ' saved' : ''}" data-action="saveCardItem" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}" data-tooltip="Save">
                        <svg class="card-action-icon" viewBox="0 0 24 24" fill="${inLibrary ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span class="card-action-count" id="card-saves-${item.id}">${formatCount(item.saves || 0)}</span>
                    </button>
                    <button class="card-action-btn" data-action="openShareModal" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}" data-tooltip="Share">
                        <svg class="card-action-icon" id="share-${item.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        <span class="card-action-count" id="card-shares-${item.id}">${formatCount(item.shares || 0)}</span>
                    </button>
                    <button class="card-action-btn" data-action="downloadCardItem" data-id="${escapeAttr(String(item.id))}" data-category="${escapeAttr(category)}" data-tooltip="Download">
                        <svg class="card-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <span class="card-action-count" id="card-downloads-${item.id}">${formatCount(item.downloads || 0)}</span>
                    </button>
                </div>
            </div>
        `;
    }

    const backContent = `
        <button class="card-back-close" data-action="toggleCardInfo" data-id="${escapeAttr(String(item.id))}">×</button>
        <div class="card-back-description">${escapeHTML(item.description || 'No description')}</div>
        <div class="card-back-tags">${(item.tags || []).map(tag => `<span class="card-back-tag">${escapeHTML(tag.toUpperCase())}</span>`).join('')}</div>
    `;

    return `
        <div class="${wrapperClass}" id="card-${escapeAttr(String(item.id))}" data-id="${escapeAttr(String(item.id))}">
            <div class="item-card-inner">
                <div class="${cardClass}" data-id="${escapeAttr(String(item.id))}">${frontContent}</div>
                <div class="item-card-back">${backContent}</div>
            </div>
        </div>
    `;
}
window.createCardHTML = createCardHTML;

function setupCardAudio(item, category) {
    // Skip projects, but allow MIDI even without audioBlob (they use presetData)
    if (category === 'projects') return;
    if (!item.audioBlob && category !== 'midi') return;

    requestAnimationFrame(() => {
        const scrubBar = document.getElementById(`scrub-bar-${item.id}`);
        if (scrubBar && !scrubBar.dataset.initialized) {
            scrubBar.dataset.initialized = 'true';
            let isScrubbing = false;

            const updateScrub = (e) => {
                if (currentlyPlaying !== item.id || !globalAudio || !globalAudio.duration) return;
                const rect = scrubBar.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                globalAudio.currentTime = percent * globalAudio.duration;
            };

            const mouseMoveHandler = (e) => {
                if (isScrubbing) {
                    updateScrub(e);
                }
            };

            const mouseUpHandler = () => {
                isScrubbing = false;
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };

            scrubBar.addEventListener('mousedown', (e) => {
                isScrubbing = true;
                updateScrub(e);
                e.stopPropagation();
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
            });
        }

        // Render piano roll for MIDI items
        if (category === 'midi') {
            if (item.midiNotes) {
                if (typeof renderPianoRoll === 'function') {
                    renderPianoRoll(item.id, item.midiNotes, '#e8e8e8');
                }
                if (typeof initPianoKeys === 'function') {
                    initPianoKeys(item.id, item.midiNotes);
                }
            } else if (item.presetData && typeof Midi !== 'undefined') {
                // Fetch and parse MIDI file on-the-fly if midiNotes not stored
                fetchAndParseMidi(item.id, item.presetData, '#e8e8e8');
            }
        }
    });
}
window.setupCardAudio = setupCardAudio;

// Fetch and parse MIDI file on-the-fly for items without stored midiNotes
async function fetchAndParseMidi(itemId, fileUrl, themeColor) {
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            console.error('Failed to fetch MIDI file:', response.status);
            return;
        }
        const arrayBuffer = await response.arrayBuffer();
        const parsedMidi = new Midi(arrayBuffer);

        const midiNotes = {
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

        // Store in the item for future use
        const category = 'midi';
        const item = items[category]?.find(i => i.id === itemId);
        if (item) {
            item.midiNotes = midiNotes;
        }

        // Render the piano roll
        if (typeof renderPianoRoll === 'function') {
            renderPianoRoll(itemId, midiNotes, themeColor);
        }
        if (typeof initPianoKeys === 'function') {
            initPianoKeys(itemId, midiNotes);
        }
    } catch (err) {
        console.error('Error fetching/parsing MIDI:', err);
    }
}

function renderItems(category) {
    const grid = document.getElementById(`${category}-grid`);
    if (!grid) return;

    grid.innerHTML = '';

    if (items[category].length === 0) {
        grid.innerHTML = `<div style="color: var(--text-tertiary); padding: 40px 0; text-align: center;">No ${escapeHTML(category)} uploaded yet</div>`;
        renderPagination(category, 0);
        return;
    }

    const totalItems = items[category].length;
    const perPage = getItemsPerPage(category);
    const totalPages = Math.ceil(totalItems / perPage);

    if (currentPage[category] > totalPages) {
        currentPage[category] = totalPages;
    }
    if (currentPage[category] < 1) {
        currentPage[category] = 1;
    }

    const startIndex = (currentPage[category] - 1) * perPage;
    const endIndex = startIndex + perPage;
    const pageItems = items[category].slice(startIndex, endIndex);

    pageItems.forEach(item => {
        const wrap = document.createElement('div');
        wrap.dataset.itemId = item.id;
        wrap.dataset.vst = item.vst || '';
        wrap.dataset.type = item.type || '';
        wrap.dataset.tags = (item.tags || []).join(',').toLowerCase();
        wrap.dataset.title = item.title.toLowerCase();

        wrap.innerHTML = createCardHTML(item, category);
        grid.appendChild(wrap);

        setupCardAudio(item, category);

        // Setup video player for project cards with video
        if (category === 'projects' && item.videoBlob && typeof setupVideoPlayer === 'function') {
            setupVideoPlayer(item.id);
        }
    });

    renderPagination(category, totalPages);
}

function renderPagination(category, totalPages) {
    const containerId = `${category}-pagination`;
    let paginationContainer = document.getElementById(containerId);

    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = containerId;
        paginationContainer.className = 'pagination-container';
        const grid = document.getElementById(`${category}-grid`);
        if (grid && grid.parentNode) {
            grid.parentNode.insertBefore(paginationContainer, grid.nextSibling);
        }
    }

    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';

    const page = currentPage[category];
    let paginationHTML = `
        <button class="pagination-btn pagination-prev ${page === 1 ? 'disabled' : ''}"
                data-action="changePage" data-category="${escapeAttr(category)}" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>
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
        paginationHTML += `<button class="pagination-page" data-action="changePage" data-category="${escapeAttr(category)}" data-page="1">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-page ${i === page ? 'active' : ''}"
                    data-action="changePage" data-category="${escapeAttr(category)}" data-page="${i}">${i}</button>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
        paginationHTML += `<button class="pagination-page" data-action="changePage" data-category="${escapeAttr(category)}" data-page="${totalPages}">${totalPages}</button>`;
    }

    paginationHTML += `
        </div>
        <button class="pagination-btn pagination-next ${page === totalPages ? 'disabled' : ''}"
                data-action="changePage" data-category="${escapeAttr(category)}" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>
            Next
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
            </svg>
        </button>
        <div class="pagination-per-page">
            <select class="per-page-select" data-action="setItemsPerPage" data-category="${escapeAttr(category)}">
                ${ITEMS_PER_PAGE_OPTIONS.map(opt => `<option value="${opt}" ${opt === itemsPerPageSetting ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
            <span class="per-page-label">per page</span>
        </div>
    `;

    paginationContainer.innerHTML = paginationHTML;
}

function changePage(category, page) {
    const totalPages = Math.ceil(items[category].length / getItemsPerPage(category));
    if (page < 1 || page > totalPages) return;

    currentPage[category] = page;
    renderItems(category);

    // Scroll to top
    window.scrollTo(0, 0);
}

// Keyboard navigation
let autoPlayEnabled = true;

function getVisibleItems() {
    // Check if profile is active first
    if (document.body.classList.contains('profile-active')) {
        const profileGrid = document.getElementById('profile-content-grid');
        if (profileGrid) {
            return Array.from(profileGrid.querySelectorAll('[data-item-id]')).filter(el => el.style.display !== 'none');
        }
    }

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

    if (flippedCards.size > 0) {
        const focusedItem = visibleItems[currentFocusIndex];
        const newItemId = parseInt(focusedItem.dataset.itemId, 10);
        closeAllFlippedCards();

        const item = findItemById(newItemId, currentTab);
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
        if (card) {
            card.style.transform = '';
            card.style.boxShadow = '';
        }
    });

    if (currentFocusIndex >= 0 && currentFocusIndex < visibleItems.length) {
        const focusedItem = visibleItems[currentFocusIndex];
        focusedItem.classList.add('focused');
        const card = focusedItem.querySelector('.item-card');
        if (card) {
            card.style.transform = 'translateY(-5px)';
            card.style.boxShadow = '0 0 25px var(--theme-color)';
        }
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
        const itemId = parseInt(focusedItem.dataset.itemId, 10);
        const item = findItemById(itemId, currentTab);
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

function initKeyboardNavigation() {
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
}
