// ===== AUDIO & VISUALIZERS =====

// Track current video element for global playbar integration
let currentVideoElement = null;
let isPlayingVideo = false;

// Helper function to safely clean up audio event handlers
function cleanupAudioHandlers(audioEl) {
    if (audioEl && audioEl._handlers) {
        const events = ['loadedmetadata', 'timeupdate', 'ended', 'pause', 'play', 'canplay', 'error'];
        for (const event of events) {
            if (audioEl._handlers[event]) {
                try {
                    audioEl.removeEventListener(event, audioEl._handlers[event]);
                } catch (e) {
                    // Ignore errors during cleanup
                }
            }
        }
        delete audioEl._handlers;
    }
}

// Update playing backdrop with cover art - DISABLED
function updatePlayingBackdrop(item, category) {
    return;
}

// Clear playing backdrop
function clearPlayingBackdrop() {
    const backdrop = document.getElementById('playing-backdrop');
    const profileBackdrop = document.getElementById('profile-playing-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        backdrop.style.backgroundImage = '';
    }
    if (profileBackdrop) {
        profileBackdrop.classList.remove('active');
        profileBackdrop.style.backgroundImage = '';
    }
}

// Autoplay state
let autoplayEnabled = true;

// Preloaded audio cache - stores ready-to-play audio elements by URL
const preloadedAudioCache = new Map();
const MAX_PRELOAD_CACHE = 5; // Keep last 5 preloaded tracks

// Preload audio on hover to reduce playback delay
function preloadAudioForItem(item) {
    if (!item || !item.audioBlob) return;

    const audioUrl = sanitizeURL ? sanitizeURL(item.audioBlob) : item.audioBlob;
    if (!audioUrl) return;

    // Already preloaded or currently playing
    if (preloadedAudioCache.has(audioUrl)) return;
    if (globalAudio && globalAudio.src === audioUrl) return;

    // Create new audio element for preloading
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = audioUrl;

    // Store in cache once it has enough data to play
    audio.addEventListener('canplaythrough', () => {
        // Limit cache size
        if (preloadedAudioCache.size >= MAX_PRELOAD_CACHE) {
            const firstKey = preloadedAudioCache.keys().next().value;
            const oldAudio = preloadedAudioCache.get(firstKey);
            if (oldAudio) {
                oldAudio.src = '';
            }
            preloadedAudioCache.delete(firstKey);
        }
        preloadedAudioCache.set(audioUrl, audio);
    }, { once: true });
}

// Get preloaded audio element if available
function getPreloadedAudio(url) {
    if (preloadedAudioCache.has(url)) {
        const audio = preloadedAudioCache.get(url);
        preloadedAudioCache.delete(url); // Remove from cache since it's now in use
        return audio;
    }
    return null;
}

// Initialize hover preload event delegation
function initHoverPreload() {
    document.addEventListener('mouseover', (e) => {
        if (!e.target || !e.target.closest) return;
        const cardWrapper = e.target.closest('.item-card-wrapper');
        if (!cardWrapper) return;

        const itemId = cardWrapper.dataset.itemId;
        const category = cardWrapper.dataset.category;
        if (!itemId || !category) return;

        // Find the item data
        const item = typeof findItemById === 'function'
            ? findItemById(itemId, category)
            : (items && items[category] ? items[category].find(i => i.id == itemId) : null);

        if (item) {
            preloadAudioForItem(item);
        }
    }, true); // Use capture phase for delegation
}

// Initialize preload on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHoverPreload);
} else {
    initHoverPreload();
}

// Cleanup audio on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
    if (typeof globalAudio !== 'undefined' && globalAudio) {
        cleanupAudioHandlers(globalAudio);
        globalAudio.pause();
        globalAudio.src = '';
    }
    // Clean up preloaded audio cache
    preloadedAudioCache.forEach(audio => {
        audio.src = '';
    });
    preloadedAudioCache.clear();
});

// Play bar controls
function updatePlayButton(isPlaying) {
    const btn = document.getElementById('global-play-btn');
    const progressBar = document.getElementById('play-bar-progress-bar');
    if (isPlaying) {
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        progressBar?.classList.add('playing');
    } else {
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        progressBar?.classList.remove('playing');
    }
}

function updatePlayBarActionStates(item, category) {
    const heartBtn = document.getElementById('play-bar-heart-btn');
    const saveBtn = document.getElementById('play-bar-save-btn');
    const loopBtn = document.getElementById('play-bar-loop-btn');

    if (heartBtn) {
        heartBtn.classList.toggle('liked', !!item.liked);
        const heartSvg = heartBtn.querySelector('svg');
        if (heartSvg) {
            heartSvg.setAttribute('fill', item.liked ? 'currentColor' : 'none');
        }
    }

    if (saveBtn) {
        const inLibrary = library.some(l => l.id == item.id);
        saveBtn.classList.toggle('saved', inLibrary);
        const saveSvg = saveBtn.querySelector('svg');
        if (saveSvg) {
            saveSvg.setAttribute('fill', inLibrary ? 'currentColor' : 'none');
        }
    }

    if (loopBtn) {
        if (playbackState.isLooping) {
            loopBtn.classList.add('looping');
        } else {
            loopBtn.classList.remove('looping');
        }
    }
}

function playItemInGlobalBar(item, category) {
    if (!item) return;

    // Stop any playing video when starting audio
    if (typeof stopCurrentVideo === 'function') {
        stopCurrentVideo();
    }

    if (globalAudio) {
        globalAudio.pause();
        globalAudio.currentTime = 0;
    }

    if (currentlyPlaying) {
        // Stop piano roll animation for previous track
        if (typeof stopPianoRollAnimation === 'function') {
            stopPianoRollAnimation(currentlyPlaying);
        }
        document.querySelectorAll(`#play-btn-${currentlyPlaying}`).forEach(prevPlayBtn => {
            const icon = prevPlayBtn.querySelector('.card-play-icon');
            if (icon) icon.textContent = '▶';
        });
    }

    document.querySelectorAll('.item-card').forEach(c => c.classList.remove('playing'));

    currentlyPlaying = item.id;
    currentPlayingCategory = category;

    document.querySelectorAll(`[data-item-id="${item.id}"]`).forEach(card => {
        const itemCard = card.querySelector('.item-card');
        if (itemCard) itemCard.classList.add('playing');
    });

    const trackTitleEl = document.getElementById('play-bar-track-title');
    const trackArtistEl = document.getElementById('play-bar-track-artist');
    const albumArtEl = document.getElementById('play-bar-album-art');
    if (trackTitleEl) trackTitleEl.textContent = item.title || 'Unknown';
    if (trackArtistEl) trackArtistEl.textContent = item.vst || item.type || 'Unknown';
    if (albumArtEl) albumArtEl.textContent = (item.title && item.title.length > 0) ? item.title[0].toUpperCase() : '?';

    updateCenterPanel(item, category);
    updateNowPlaying(item);
    updatePlayingBackdrop(item, category);

    // If on profile page, also update via selectItemAndShowComments
    if (document.body.classList.contains('profile-active') && typeof selectItemAndShowComments === 'function') {
        selectItemAndShowComments(item, category);
    }

    document.querySelectorAll('.play-bar-btn').forEach(btn => btn.disabled = false);
    document.querySelectorAll('.play-bar-action-btn').forEach(btn => btn.disabled = false);
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) muteBtn.disabled = false;
    updatePlayBarActionStates(item, category);

    if (item.audioBlob) {
        const playBtns = document.querySelectorAll(`#play-btn-${item.id}`);
        const scrubProgress = document.getElementById(`scrub-progress-${item.id}`);

        const safeAudioSrc = sanitizeURL(item.audioBlob);

        // Check for preloaded audio element first (zero delay)
        const preloaded = getPreloadedAudio(safeAudioSrc);
        if (preloaded) {
            // Clean up old globalAudio
            if (globalAudio) {
                cleanupAudioHandlers(globalAudio);
                globalAudio.pause();
                globalAudio.src = '';
            }
            // Use the preloaded element
            globalAudio = preloaded;
            isAudioConnected = false;
            sharedAnalyser = null;
        } else if (!globalAudio || (isAudioConnected && (!audioContext || audioContext.state === 'closed'))) {
            globalAudio = new Audio();
            isAudioConnected = false;
            sharedAnalyser = null;
            globalAudio.src = safeAudioSrc || '';
        } else {
            globalAudio.src = safeAudioSrc || '';
        }

        globalAudio.currentTime = 0;
        globalAudio.volume = playbackState.volume;
        globalAudio.loop = playbackState.isLooping;

        cleanupAudioHandlers(globalAudio);

        const audioEl = globalAudio;

        const handlers = {
            loadedmetadata: () => {
                playbackState.duration = audioEl.duration;
                const totalTimeEl = document.getElementById('total-time');
                if (totalTimeEl) totalTimeEl.textContent = formatTime(audioEl.duration);
            },
            timeupdate: () => {
                const duration = audioEl.duration || playbackState.duration || 0;
                playbackState.currentTime = audioEl.currentTime;
                const currentTimeEl = document.getElementById('current-time');
                if (currentTimeEl) currentTimeEl.textContent = formatTime(audioEl.currentTime);
                if (duration > 0) {
                    const percent = (audioEl.currentTime / duration) * 100;
                    const progressEl = document.getElementById('play-bar-progress-filled');
                    if (progressEl) progressEl.style.width = percent + '%';
                    if (scrubProgress) scrubProgress.style.width = percent + '%';
                    const scrubTime = document.getElementById(`scrub-time-${item.id}`);
                    if (scrubTime) scrubTime.textContent = `${formatTime(audioEl.currentTime)} / ${formatTime(duration)}`;
                }
            },
            ended: () => {
                playBtns.forEach(btn => {
                    const icon = btn?.querySelector('.card-play-icon');
                    if (icon) icon.textContent = '▶';
                });
                updatePlayButton(false);
                playbackState.isPlaying = false;
                clearAllCardStyles();
                if (category === 'midi') {
                    stopPianoRollAnimation(item.id);
                }
                if (!playbackState.isLooping) {
                    if (autoplayEnabled) {
                        playNext();
                    } else {
                        highlightNextCard();
                    }
                }
            },
            pause: () => {
                playBtns.forEach(btn => {
                    const icon = btn?.querySelector('.card-play-icon');
                    if (icon) icon.textContent = '▶';
                });
                if (category === 'midi') {
                    stopPianoRollAnimation(item.id);
                }
            },
            play: () => {
                playBtns.forEach(btn => {
                    const icon = btn?.querySelector('.card-play-icon');
                    if (icon) icon.textContent = '❚❚';
                });
                if (category === 'midi' && item.midiNotes) {
                    startPianoRollAnimation(item.id, item.midiNotes, audioEl, item.themeColor || '#e8e8e8');
                }
            }
        };

        globalAudio._handlers = handlers;

        audioEl.addEventListener('loadedmetadata', handlers.loadedmetadata);
        audioEl.addEventListener('timeupdate', handlers.timeupdate);
        audioEl.addEventListener('ended', handlers.ended);
        audioEl.addEventListener('pause', handlers.pause);
        audioEl.addEventListener('play', handlers.play);

        if (audioEl.duration) {
            handlers.loadedmetadata();
        }

        globalAudio.play().then(() => {
            updatePlayButton(true);
            playbackState.isPlaying = true;
        }).catch(() => {
            updatePlayButton(false);
            playbackState.isPlaying = false;
        });
    } else if (category === 'projects' && item.videoBlob) {
        // Handle project video playback through global playbar
        isPlayingVideo = true;

        // Get the video element from the card
        const video = document.getElementById(`video-${item.id}`);
        if (!video) return;

        currentVideoElement = video;
        currentVideoPlaying = item.id;

        const playBtns = document.querySelectorAll(`#play-btn-${item.id}`);
        const container = video.closest('.video-player-container');

        // Set up video event handlers for playbar
        const videoHandlers = {
            loadedmetadata: () => {
                playbackState.duration = video.duration;
                const totalTimeEl = document.getElementById('total-time');
                if (totalTimeEl) totalTimeEl.textContent = formatTime(video.duration);
            },
            timeupdate: () => {
                const duration = video.duration || playbackState.duration || 0;
                playbackState.currentTime = video.currentTime;
                const currentTimeEl = document.getElementById('current-time');
                if (currentTimeEl) currentTimeEl.textContent = formatTime(video.currentTime);
                if (duration > 0) {
                    const percent = (video.currentTime / duration) * 100;
                    const progressEl = document.getElementById('play-bar-progress-filled');
                    if (progressEl) progressEl.style.width = percent + '%';
                    // Also update card scrub bar
                    const videoProgress = document.getElementById(`video-progress-${item.id}`);
                    if (videoProgress) videoProgress.style.width = percent + '%';
                    const videoTime = document.getElementById(`video-time-${item.id}`);
                    if (videoTime) videoTime.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
                }
            },
            ended: () => {
                playBtns.forEach(btn => {
                    const icon = btn?.querySelector('.card-play-icon');
                    if (icon) icon.textContent = '▶';
                });
                container?.classList.remove('playing');
                updatePlayButton(false);
                playbackState.isPlaying = false;
                isPlayingVideo = false;
                currentVideoElement = null;
                currentVideoPlaying = null;
                clearAllCardStyles();
                if (!playbackState.isLooping) {
                    if (autoplayEnabled) {
                        playNext();
                    } else {
                        highlightNextCard();
                    }
                }
            },
            pause: () => {
                playBtns.forEach(btn => {
                    const icon = btn?.querySelector('.card-play-icon');
                    if (icon) icon.textContent = '▶';
                });
                container?.classList.remove('playing');
            },
            play: () => {
                playBtns.forEach(btn => {
                    const icon = btn?.querySelector('.card-play-icon');
                    if (icon) icon.textContent = '❚❚';
                });
                container?.classList.add('playing');
            }
        };

        // Clean up any existing handlers
        if (video._handlers) {
            ['loadedmetadata', 'timeupdate', 'ended', 'pause', 'play'].forEach(event => {
                if (video._handlers[event]) {
                    video.removeEventListener(event, video._handlers[event]);
                }
            });
        }

        video._handlers = videoHandlers;
        video.addEventListener('loadedmetadata', videoHandlers.loadedmetadata);
        video.addEventListener('timeupdate', videoHandlers.timeupdate);
        video.addEventListener('ended', videoHandlers.ended);
        video.addEventListener('pause', videoHandlers.pause);
        video.addEventListener('play', videoHandlers.play);

        if (video.duration) {
            videoHandlers.loadedmetadata();
        }

        video.volume = playbackState.volume;
        video.loop = playbackState.isLooping;

        video.play().then(() => {
            updatePlayButton(true);
            playbackState.isPlaying = true;
            container?.classList.add('playing');
        }).catch(() => {
            updatePlayButton(false);
            playbackState.isPlaying = false;
        });
    }
}

function updateNowPlaying(item) {
    const titleEl = document.getElementById('now-playing-title');
    const artistEl = document.getElementById('now-playing-artist');
    const artworkEl = document.getElementById('now-playing-artwork');
    const bpmEl = document.getElementById('now-playing-bpm');
    const keyEl = document.getElementById('now-playing-key');

    if (titleEl) titleEl.textContent = item.title || 'Unknown Track';
    if (artistEl) artistEl.textContent = item.vst || item.type || 'Unknown Artist';

    if (artworkEl) {
        const coverUrl = item.coverArt || item.coverBlob || '';
        const safeCoverUrl = typeof sanitizeCSSUrl === 'function' ? sanitizeCSSUrl(coverUrl) : '';
        if (safeCoverUrl) {
            artworkEl.style.backgroundImage = `url('${safeCoverUrl}')`;
            artworkEl.innerHTML = '';
        } else {
            artworkEl.style.backgroundImage = '';
            artworkEl.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>`;
        }
    }

    if (bpmEl) bpmEl.textContent = item.bpm ? `${item.bpm} BPM` : '';
    if (keyEl) keyEl.textContent = item.key || '';
}

function getNavigableItems() {
    const visibleElements = getVisibleItems();

    // Check if profile is active and has a current group
    if (document.body.classList.contains('profile-active') && typeof currentProfileGroup !== 'undefined' && currentProfileGroup) {
        return visibleElements.map(el => {
            const id = parseInt(el.dataset.itemId);
            return currentProfileGroup.items.find(i => i.id === id);
        }).filter(Boolean);
    }

    return visibleElements.map(el => {
        const id = parseInt(el.dataset.itemId);
        return items[currentTab]?.find(i => i.id === id);
    }).filter(Boolean);
}

function clearAllCardStyles() {
    document.querySelectorAll('.item-card').forEach(card => {
        card.classList.remove('playing', 'focused');
        card.style.transform = '';
        card.style.boxShadow = '';
    });
}

function playNext() {
    const navItems = getNavigableItems();
    if (navItems.length === 0) return;
    const currentIndex = navItems.findIndex(i => i.id === currentlyPlaying);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % navItems.length;
    clearAllCardStyles();

    const nextItem = navItems[nextIndex];
    // Use item's actual category (for "all" view), then profile group category, then current tab
    const category = nextItem._category
        || (document.body.classList.contains('profile-active') && currentProfileGroup ? currentProfileGroup.category : null)
        || currentTab;

    playItemInGlobalBar(nextItem, category);
    currentFocusIndex = nextIndex;
    scrollToCard(nextItem.id);
}

function playPrevious() {
    const navItems = getNavigableItems();
    if (navItems.length === 0) return;
    const currentIndex = navItems.findIndex(i => i.id === currentlyPlaying);
    const prevIndex = currentIndex <= 0 ? navItems.length - 1 : currentIndex - 1;
    clearAllCardStyles();

    const prevItem = navItems[prevIndex];
    // Use item's actual category (for "all" view), then profile group category, then current tab
    const category = prevItem._category
        || (document.body.classList.contains('profile-active') && currentProfileGroup ? currentProfileGroup.category : null)
        || currentTab;

    playItemInGlobalBar(prevItem, category);
    currentFocusIndex = prevIndex;
    scrollToCard(prevItem.id);
}

// Scroll to a card by its ID
function scrollToCard(itemId) {
    const card = document.querySelector(`.item-card[data-id="${itemId}"]`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Toggle autoplay on/off
function toggleAutoplay() {
    autoplayEnabled = !autoplayEnabled;
    const btn = document.getElementById('autoplay-btn');
    if (btn) {
        btn.classList.toggle('active', autoplayEnabled);
    }
}

// Highlight next card without playing (when autoplay is off)
function highlightNextCard() {
    const navItems = getNavigableItems();
    if (navItems.length === 0) return;

    const currentIndex = navItems.findIndex(i => i.id === currentlyPlaying);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % navItems.length;
    const nextItem = navItems[nextIndex];

    // Update the play bar info without playing
    const category = (document.body.classList.contains('profile-active') && currentProfileGroup)
        ? currentProfileGroup.category
        : currentTab;

    // Update play bar display
    const playBarTitle = document.getElementById('play-bar-track-title');
    const playBarArtist = document.getElementById('play-bar-track-artist');
    if (playBarTitle) playBarTitle.textContent = nextItem.title || 'Unknown';
    if (playBarArtist) playBarArtist.textContent = nextItem.uploader || 'Unknown';

    // Highlight the card and scroll to it
    const card = document.querySelector(`.item-card[data-id="${nextItem.id}"]`);
    if (card) {
        card.classList.add('focused');
    }
    scrollToCard(nextItem.id);

    // Update current focus
    currentFocusIndex = nextIndex;
    currentlyPlaying = nextItem.id;

    // Reset progress bar
    const progressBar = document.getElementById('play-bar-progress');
    const currentTimeEl = document.getElementById('current-time');
    if (progressBar) progressBar.style.width = '0%';
    if (currentTimeEl) currentTimeEl.textContent = '0:00';
}

window.toggleAutoplay = toggleAutoplay;

// Toggle play on card
window.togglePlay = (id, cat) => {
    // Check if this is a preview item
    let item;
    if (typeof id === 'string' && id.startsWith('preview-')) {
        item = window.uploadPreviewItem || null;
    } else {
        // Try items[cat] first (browse mode)
        item = items[cat]?.find(i => i.id === id);
        // If not found and in profile mode, check currentProfileGroup.items
        if (!item && document.body.classList.contains('profile-active') && typeof currentProfileGroup !== 'undefined' && currentProfileGroup?.items) {
            item = currentProfileGroup.items.find(i => i.id === id);
            // Use item's actual category if available
            if (item && item._category) {
                cat = item._category;
            }
        }
    }
    if (!item) return;

    if (currentlyPlaying === id) {
        // Handle video playback
        if (isPlayingVideo && currentVideoElement) {
            if (!currentVideoElement.paused) {
                currentVideoElement.pause();
                updatePlayButton(false);
                playbackState.isPlaying = false;
                document.querySelectorAll(`#play-btn-${id}`).forEach(playBtn => {
                    const playIcon = playBtn?.querySelector('.card-play-icon');
                    if (playIcon) playIcon.textContent = '▶';
                });
            } else {
                currentVideoElement.play().catch(() => {});
                updatePlayButton(true);
                playbackState.isPlaying = true;
                document.querySelectorAll(`#play-btn-${id}`).forEach(playBtn => {
                    const playIcon = playBtn?.querySelector('.card-play-icon');
                    if (playIcon) playIcon.textContent = '❚❚';
                });
            }
            return;
        }
        // Handle audio playback
        if (globalAudio) {
            if (!globalAudio.paused) {
                globalAudio.pause();
                updatePlayButton(false);
                playbackState.isPlaying = false;
                // Update ALL play buttons for this item
                document.querySelectorAll(`#play-btn-${id}`).forEach(playBtn => {
                    const playIcon = playBtn?.querySelector('.card-play-icon');
                    if (playIcon) playIcon.textContent = '▶';
                });
            } else {
                globalAudio.play().catch(() => {});
                updatePlayButton(true);
                playbackState.isPlaying = true;
                // Update ALL play buttons for this item
                document.querySelectorAll(`#play-btn-${id}`).forEach(playBtn => {
                    const playIcon = playBtn?.querySelector('.card-play-icon');
                    if (playIcon) playIcon.textContent = '❚❚';
                });
            }
        }
    } else {
        clearAllCardStyles();
        playItemInGlobalBar(item, cat);
        const visibleItems = getVisibleItems();
        currentFocusIndex = visibleItems.findIndex(el => parseInt(el.dataset.itemId) === id);

        // If on profile page, switch to Comments tab
        if (document.body.classList.contains('profile-active') && typeof selectItemAndShowComments === 'function') {
            selectItemAndShowComments(item, cat);
        }
    }
};

// Initialize play bar controls
function initPlayBarControls() {
    const globalPlayBtn = document.getElementById('global-play-btn');
    if (globalPlayBtn) {
        globalPlayBtn.addEventListener('click', () => {
            // Handle video playback
            if (isPlayingVideo && currentVideoElement) {
                if (playbackState.isPlaying) {
                    currentVideoElement.pause();
                    updatePlayButton(false);
                    playbackState.isPlaying = false;
                } else {
                    currentVideoElement.play();
                    updatePlayButton(true);
                    playbackState.isPlaying = true;
                }
                return;
            }
            // Handle audio playback
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
    }

    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    if (nextBtn) nextBtn.addEventListener('click', playNext);
    if (prevBtn) prevBtn.addEventListener('click', playPrevious);

    // Play bar progress scrubbing
    const playBarProgressBar = document.getElementById('play-bar-progress-bar');
    let isScrubbingPlayBar = false;

    function updatePlayBarProgress(e) {
        const rect = playBarProgressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

        // Handle video seeking
        if (isPlayingVideo && currentVideoElement && currentVideoElement.duration) {
            currentVideoElement.currentTime = percent * currentVideoElement.duration;
            return;
        }
        // Handle audio seeking
        if (!globalAudio || !globalAudio.duration) return;
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

    // Volume slider scrubbing
    let isScrubbingVolume = false;
    const volumeSlider = document.getElementById('volume-slider');

    function updateVolume(e) {
        if (!volumeSlider) return;
        const rect = volumeSlider.getBoundingClientRect();
        let percent = (e.clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent)); // Clamp between 0 and 1
        playbackState.volume = percent;
        const volumeFilled = document.getElementById('volume-filled');
        if (volumeFilled) volumeFilled.style.width = (percent * 100) + '%';
        if (globalAudio) globalAudio.volume = percent;
        if (currentVideoElement) currentVideoElement.volume = percent;
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('mousedown', (e) => {
            isScrubbingVolume = true;
            updateVolume(e);
        });

        volumeSlider.addEventListener('click', (e) => {
            updateVolume(e);
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (isScrubbingVolume) {
            updateVolume(e);
        }
    });

    document.addEventListener('mouseup', () => {
        isScrubbingVolume = false;
    });

    const muteBtnEl = document.getElementById('mute-btn');
    if (muteBtnEl) {
        muteBtnEl.addEventListener('click', () => {
            const volumeFilledEl = document.getElementById('volume-filled');
            if (playbackState.volume > 0) {
                playbackState.previousVolume = playbackState.volume;
                playbackState.volume = 0;
                if (volumeFilledEl) volumeFilledEl.style.width = '0%';
            } else {
                playbackState.volume = playbackState.previousVolume || 0.7;
                if (volumeFilledEl) volumeFilledEl.style.width = (playbackState.volume * 100) + '%';
            }
            if (globalAudio) globalAudio.volume = playbackState.volume;
            if (currentVideoElement) currentVideoElement.volume = playbackState.volume;
        });
    }
}

// Play bar action buttons
window.togglePlayBarLike = async () => {
    if (!currentlyPlaying || !currentPlayingCategory) return;

    // Check if user is logged in
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    const item = typeof findItemById === 'function'
        ? findItemById(currentlyPlaying, currentPlayingCategory)
        : items[currentPlayingCategory]?.find(i => i.id == currentlyPlaying);

    if (!item) return;

    // Toggle like
    await toggleLike(currentlyPlaying, currentPlayingCategory);

    // Update play bar heart button
    const heartBtn = document.getElementById('play-bar-heart-btn');
    if (heartBtn) {
        heartBtn.classList.toggle('liked', item.liked);
        const heartSvg = heartBtn.querySelector('svg');
        if (heartSvg) {
            heartSvg.setAttribute('fill', item.liked ? 'currentColor' : 'none');
        }
    }

    // Update item card heart icon
    const heartIcon = document.getElementById(`heart-icon-${currentlyPlaying}`);
    if (heartIcon) {
        heartIcon.setAttribute('fill', item.liked ? '#ff4757' : 'none');
        heartIcon.setAttribute('stroke', item.liked ? '#ff4757' : '#dedede');
    }
    const cardHeart = document.getElementById(`heart-${currentlyPlaying}`);
    if (cardHeart) {
        cardHeart.classList.toggle('liked', item.liked);
        cardHeart.setAttribute('fill', item.liked ? 'currentColor' : 'none');
    }
    const countEl = document.getElementById(`hearts-count-${currentlyPlaying}`);
    if (countEl) countEl.textContent = typeof formatCount === 'function' ? formatCount(item.hearts) : item.hearts;
    const cardCountEl = document.getElementById(`card-likes-${currentlyPlaying}`);
    if (cardCountEl) cardCountEl.textContent = typeof formatCount === 'function' ? formatCount(item.hearts) : item.hearts;
};

window.togglePlayBarLoop = () => {
    const loopBtn = document.getElementById('play-bar-loop-btn');
    if (!loopBtn) return;

    playbackState.isLooping = !playbackState.isLooping;

    if (playbackState.isLooping) {
        loopBtn.classList.add('looping');
        if (globalAudio) globalAudio.loop = true;
        if (currentVideoElement) currentVideoElement.loop = true;
    } else {
        loopBtn.classList.remove('looping');
        if (globalAudio) globalAudio.loop = false;
        if (currentVideoElement) currentVideoElement.loop = false;
    }
};

window.downloadPlayBarTrack = async () => {
    if (!currentlyPlaying || !currentPlayingCategory) return;

    // Check if user is logged in
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    const item = typeof findItemById === 'function'
        ? findItemById(currentlyPlaying, currentPlayingCategory)
        : items[currentPlayingCategory]?.find(i => i.id == currentlyPlaying);

    if (!item) return;

    // Use downloadCardItem if available (handles Supabase properly)
    if (typeof downloadCardItem === 'function') {
        downloadCardItem(currentlyPlaying, currentPlayingCategory);
    } else if (item.presetData) {
        const a = document.createElement('a');
        a.href = item.presetData;
        a.download = item.presetName || item.title;
        a.click();
        item.downloads++;
    }
};

window.savePlayBarTrack = async () => {
    if (!currentlyPlaying || !currentPlayingCategory) return;

    // Check if user is logged in
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    const item = typeof findItemById === 'function'
        ? findItemById(currentlyPlaying, currentPlayingCategory)
        : items[currentPlayingCategory]?.find(i => i.id == currentlyPlaying);

    if (!item) return;

    // Use saveCardItem if available (handles toggle and UI updates)
    if (typeof saveCardItem === 'function') {
        saveCardItem(currentlyPlaying, currentPlayingCategory);
    } else {
        addToLibraryFromCard(currentlyPlaying, currentPlayingCategory);
    }

    // Update play bar save button
    const saveBtn = document.getElementById('play-bar-save-btn');
    if (saveBtn) {
        setTimeout(() => {
            const inLibrary = library.some(l => l.id == currentlyPlaying);
            saveBtn.classList.toggle('saved', inLibrary);
            const svg = saveBtn.querySelector('svg');
            if (svg) {
                svg.setAttribute('fill', inLibrary ? 'currentColor' : 'none');
            }
        }, 100);
    }
};

window.sharePlayBarTrack = () => {
    if (!currentlyPlaying || !currentPlayingCategory) return;

    // Check if user is logged in for share modal
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        if (typeof showAuthRequiredModal === 'function') showAuthRequiredModal();
        return;
    }

    if (typeof openShareModal === 'function') {
        openShareModal(currentlyPlaying, currentPlayingCategory);
    }
};

// ===== VIDEO PLAYBACK CONTROLS =====

let currentVideoPlaying = null;

// Stop any currently playing video
function stopCurrentVideo() {
    if (currentVideoPlaying || currentVideoElement) {
        const video = currentVideoElement || document.getElementById(`video-${currentVideoPlaying}`);
        if (video) {
            video.pause();
            const container = video.closest('.video-player-container');
            container?.classList.remove('playing');
            const playBtn = document.getElementById(`play-btn-${currentVideoPlaying}`);
            const playIcon = playBtn?.querySelector('.card-play-icon');
            if (playIcon) playIcon.textContent = '▶';
        }
        currentVideoPlaying = null;
        currentVideoElement = null;
        isPlayingVideo = false;
    }
}
window.stopCurrentVideo = stopCurrentVideo;

function formatVideoTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Legacy function - now delegates to unified togglePlay
window.toggleVideoPlay = (id) => {
    // Use the unified play system for projects
    if (typeof togglePlay === 'function') {
        togglePlay(id, 'projects');
    }
};

window.toggleVideoFullscreen = (id) => {
    const video = document.getElementById(`video-${id}`);
    if (!video) {
        console.error('toggleVideoFullscreen: video not found for id', id);
        return;
    }

    try {
        if (document.fullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        } else {
            if (video.requestFullscreen) {
                video.requestFullscreen();
            } else if (video.webkitRequestFullscreen) {
                video.webkitRequestFullscreen();
            } else if (video.webkitEnterFullscreen) {
                video.webkitEnterFullscreen();
            }
        }
    } catch (err) {
        console.error('Fullscreen error:', err);
    }
};

function setupVideoTimeUpdate(id) {
    const video = document.getElementById(`video-${id}`);
    if (!video || video.dataset.timeUpdateSetup) return;

    video.dataset.timeUpdateSetup = 'true';

    // Note: Main playback handlers are set up in playItemInGlobalBar
    // This only sets up the card's local scrub bar UI (not used when playbar controls video)

    // Setup scrub bar
    const scrubBar = document.getElementById(`video-scrub-${id}`);
    if (scrubBar && !scrubBar.dataset.scrubSetup) {
        scrubBar.dataset.scrubSetup = 'true';
        let isScrubbing = false;

        const updateScrub = (e) => {
            if (!video.duration) return;
            const rect = scrubBar.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            video.currentTime = percent * video.duration;
        };

        scrubBar.addEventListener('mousedown', (e) => {
            isScrubbing = true;
            updateScrub(e);
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (isScrubbing) updateScrub(e);
        });

        document.addEventListener('mouseup', () => {
            isScrubbing = false;
        });
    }
}

// Initialize video player when card is rendered
window.setupVideoPlayer = (id) => {
    const video = document.getElementById(`video-${id}`);
    if (!video) return;

    // Setup scrub bar for card (if not already set up)
    setupVideoTimeUpdate(id);

    // Load metadata to get duration (only if not already set up)
    if (!video.dataset.metadataSetup) {
        video.dataset.metadataSetup = 'true';
        video.addEventListener('loadedmetadata', () => {
            const timeDisplay = document.getElementById(`video-time-${id}`);
            if (timeDisplay && !isPlayingVideo) {
                timeDisplay.textContent = `0:00 / ${formatVideoTime(video.duration)}`;
            }
        });
    }
};

// ===== PIANO ROLL VISUALIZATION =====
const midiNotesCache = {};
const pianoRollAnimations = {};

function renderPianoRoll(itemId, midiNotes, themeColor) {
    // Find ALL canvases with this ID (there might be duplicates in browse vs profile)
    const allCanvases = document.querySelectorAll(`#canvas-${itemId}`);

    if (allCanvases.length === 0 || !midiNotes) {
        return;
    }

    midiNotesCache[itemId] = { notes: midiNotes, color: themeColor };

    // Render on ALL matching canvases
    allCanvases.forEach(canvas => {
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        // Use container dimensions, fallback to card dimensions if container not ready
        canvas.width = container.offsetWidth || 408;
        canvas.height = container.offsetHeight || 180;

        const allNotes = [];
        midiNotes.tracks.forEach(track => track.notes.forEach(note => allNotes.push(note)));

        if (allNotes.length > 0) {
            let minMidi = Math.min(...allNotes.map(n => n.midi));
            let maxMidi = Math.max(...allNotes.map(n => n.midi));
            const range = Math.max(maxMidi - minMidi, 12);
            minMidi = minMidi - 2;
            maxMidi = minMidi + range + 4;

            canvas.dataset.minMidi = minMidi;
            canvas.dataset.maxMidi = maxMidi;
        }

        const duration = midiNotes.duration;
        const pixelsPerSecond = canvas.width / duration;

        canvas.dataset.duration = duration;
        canvas.dataset.pixelsPerSecond = pixelsPerSecond;
        canvas.dataset.themeColor = themeColor;

        drawPianoRoll(canvas, midiNotes, 0, themeColor);
    });
}
window.renderPianoRoll = renderPianoRoll;

function drawPianoRoll(canvas, midiNotes, currentTime, themeColor) {
    const ctx = canvas.getContext('2d');

    const container = canvas.parentElement;
    // Only resize if container has valid dimensions, otherwise keep existing canvas size
    if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
    }

    const width = canvas.width || 408;
    const height = canvas.height || 180;

    ctx.clearRect(0, 0, width, height);

    const allNotes = [];
    midiNotes.tracks.forEach(track => track.notes.forEach(note => allNotes.push(note)));
    if (allNotes.length === 0) return;

    let minMidi = Math.min(...allNotes.map(n => n.midi));
    let maxMidi = Math.max(...allNotes.map(n => n.midi));

    const noteRange = maxMidi - minMidi;
    const padding = Math.max(2, Math.floor(noteRange * 0.1));
    minMidi = minMidi - padding;
    maxMidi = maxMidi + padding + 1;

    const numKeys = maxMidi - minMidi;
    const rowHeight = height / numKeys;

    canvas.dataset.minMidi = minMidi;
    canvas.dataset.maxMidi = maxMidi;

    const playheadX = 15;
    const pixelsPerSecond = 100;
    const scrollOffset = currentTime * pixelsPerSecond;

    const blackKeys = [1, 3, 6, 8, 10];

    // Draw grid background
    for (let i = 0; i < numKeys; i++) {
        const midi = minMidi + i;
        const y = height - (i + 1) * rowHeight;
        const semitone = ((midi % 12) + 12) % 12;
        const isBlack = blackKeys.includes(semitone);

        ctx.fillStyle = isBlack ? 'rgba(20, 20, 20, 0.9)' : 'rgba(35, 35, 35, 0.9)';
        ctx.fillRect(0, y, width, rowHeight);

        ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        if (semitone === 0) {
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y + rowHeight);
            ctx.lineTo(width, y + rowHeight);
            ctx.stroke();
        }
    }

    // Draw vertical grid lines
    const beatInterval = 0.5;
    const startBeat = Math.floor((scrollOffset / pixelsPerSecond) / beatInterval) * beatInterval;
    for (let t = startBeat; t < (scrollOffset / pixelsPerSecond) + (width / pixelsPerSecond) + beatInterval; t += beatInterval) {
        const x = playheadX + (t * pixelsPerSecond) - scrollOffset;
        if (x >= 0 && x <= width) {
            ctx.strokeStyle = 'rgba(60, 60, 60, 0.4)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }

    // Draw notes
    allNotes.forEach(note => {
        const noteStartX = playheadX + (note.time * pixelsPerSecond) - scrollOffset;
        const noteWidth = Math.max(note.duration * pixelsPerSecond, 3);
        const noteEndX = noteStartX + noteWidth;

        if (noteEndX < 0 || noteStartX > width) return;

        const rowIndex = note.midi - minMidi;
        const y = height - (rowIndex + 1) * rowHeight;
        const noteH = Math.max(rowHeight - 1, 2);

        const isPlaying = currentTime >= note.time && currentTime <= (note.time + note.duration);

        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        if (isPlaying) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = themeColor;
            ctx.fillStyle = themeColor;
        } else if (noteStartX < playheadX) {
            ctx.fillStyle = 'rgba(232, 232, 232, 0.4)';
        } else {
            ctx.fillStyle = themeColor;
            ctx.globalAlpha = 0.7;
        }

        const radius = 2;
        ctx.beginPath();
        ctx.roundRect(noteStartX, y, noteWidth, noteH, radius);
        ctx.fill();

        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = isPlaying ? '#fff' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = isPlaying ? 1.5 : 0.5;
        ctx.stroke();
    });

    // Draw playhead
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.fillRect(playheadX - 1, 0, 2, height);

    ctx.shadowBlur = 8;
    ctx.shadowColor = '#fff';
    ctx.fillRect(playheadX - 1, 0, 2, height);
    ctx.shadowBlur = 0;
}

function startPianoRollAnimation(itemId, midiNotes, audioElement, themeColor) {
    if (pianoRollAnimations[itemId]) cancelAnimationFrame(pianoRollAnimations[itemId]);

    // Find ALL canvases and progress bars (browse + profile may have duplicates)
    const allCanvases = document.querySelectorAll(`#canvas-${itemId}`);
    const allProgressBars = document.querySelectorAll(`#progress-${itemId}`);
    if (allCanvases.length === 0) return;

    function animate() {
        if (!pianoRollAnimations[itemId]) return;
        const currentTime = audioElement.currentTime;
        const duration = audioElement.duration;
        const percentage = (currentTime / duration) * 100;

        // Update ALL progress bars and canvases
        allProgressBars.forEach(progressBar => {
            progressBar.style.left = percentage + '%';
        });
        allCanvases.forEach(canvas => {
            drawPianoRoll(canvas, midiNotes, currentTime, themeColor);
        });
        updatePianoKeys(itemId, midiNotes, currentTime, themeColor);
        pianoRollAnimations[itemId] = requestAnimationFrame(animate);
    }
    pianoRollAnimations[itemId] = requestAnimationFrame(animate);
}
window.startPianoRollAnimation = startPianoRollAnimation;

function stopPianoRollAnimation(itemId) {
    if (pianoRollAnimations[itemId]) {
        cancelAnimationFrame(pianoRollAnimations[itemId]);
        pianoRollAnimations[itemId] = null;
    }
    const progressBar = document.getElementById(`progress-${itemId}`);
    if (progressBar) progressBar.style.left = '0%';

    const cached = midiNotesCache[itemId];
    if (cached) {
        const canvas = document.getElementById(`canvas-${itemId}`);
        if (canvas) {
            drawPianoRoll(canvas, cached.notes, 0, cached.color);
        }
    }

    const keysCanvas = document.getElementById(`keys-canvas-${itemId}`);
    if (keysCanvas) {
        drawPianoKeys(keysCanvas, [], '#e8e8e8', itemId);
    }
}
window.stopPianoRollAnimation = stopPianoRollAnimation;

// Piano Keys Visualization
function initPianoKeys(itemId, midiNotes) {
    const canvas = document.getElementById(`keys-canvas-${itemId}`);
    if (!canvas || !midiNotes) return;
    drawPianoKeys(canvas, [], '#e8e8e8', itemId);
}
window.initPianoKeys = initPianoKeys;

function drawPianoKeys(canvas, activeNotes, themeColor, itemId) {
    const ctx = canvas.getContext('2d');

    const container = canvas.parentElement;
    if (container) {
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
    }

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const rollCanvas = document.getElementById(`canvas-${itemId}`);
    const minMidi = rollCanvas ? parseInt(rollCanvas.dataset.minMidi) || 48 : 48;
    const maxMidi = rollCanvas ? parseInt(rollCanvas.dataset.maxMidi) || 72 : 72;
    const numKeys = maxMidi - minMidi;
    const rowHeight = height / numKeys;

    const blackKeys = [1, 3, 6, 8, 10];
    const activeMidiSet = new Set(activeNotes.map(n => n.midi));

    for (let i = 0; i < numKeys; i++) {
        const midi = minMidi + i;
        const y = height - (i + 1) * rowHeight;
        const semitone = ((midi % 12) + 12) % 12;
        const isBlack = blackKeys.includes(semitone);
        const isActive = activeMidiSet.has(midi);

        if (isActive) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = themeColor;
            ctx.fillStyle = themeColor;
        } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = isBlack ? '#1a1a1a' : '#e8e8e8';
        }

        const keyWidth = isBlack ? width * 0.7 : width;
        ctx.fillRect(0, y, keyWidth, rowHeight - 1);

        ctx.shadowBlur = 0;

        ctx.strokeStyle = isBlack ? '#333' : '#999';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(0, y, keyWidth, rowHeight - 1);

        if (semitone === 0) {
            ctx.fillStyle = isActive ? '#fff' : '#666';
            ctx.font = `${Math.min(rowHeight - 2, 10)}px Arial`;
            ctx.fillText('C', 2, y + rowHeight - 2);
        }
    }
}

function updatePianoKeys(itemId, midiNotes, currentTime, themeColor) {
    const canvas = document.getElementById(`keys-canvas-${itemId}`);
    if (!canvas || !midiNotes) return;

    const activeNotes = [];
    midiNotes.tracks.forEach(track => {
        track.notes.forEach(note => {
            if (currentTime >= note.time && currentTime <= (note.time + note.duration)) {
                activeNotes.push(note);
            }
        });
    });

    drawPianoKeys(canvas, activeNotes, themeColor, itemId);
}
