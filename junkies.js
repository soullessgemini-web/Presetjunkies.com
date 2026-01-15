// Junkies Page - User Directory

let junkiesCurrentPage = 1;
let junkiesCurrentLetter = 'all';
const junkiesPerPage = 25;

// Dynamic users list - built from actual data
let junkiesUsers = [];

// Build user stats from Supabase data
async function buildJunkiesUserList() {
    // Try to get profiles from Supabase first
    if (typeof supabaseGetAllProfiles === 'function') {
        try {
            const { data: profiles, error } = await supabaseGetAllProfiles();

            if (!error && profiles && profiles.length > 0) {
                console.log('Loaded profiles from Supabase:', profiles.length);

                // Filter out reserved names and deleted users
                const reservedNames = window.RESERVED_USERNAMES || ['admin', 'moderator', 'system', 'support'];
                const filteredProfiles = profiles.filter(p =>
                    p.username &&
                    !reservedNames.includes(p.username.toLowerCase()) &&
                    !p.username.startsWith('[Deleted')
                );

                // Build user objects from Supabase profiles
                junkiesUsers = filteredProfiles.map((profile, index) => ({
                    id: index + 1,
                    oderId: profile.id,
                    username: profile.username,
                    avatar: profile.avatar_url || null,
                    uploads: 0, // Will be calculated from items
                    likes: 0,
                    followers: 0
                }));

                // Sort by created_at (newest first) or username
                junkiesUsers.sort((a, b) => a.username.localeCompare(b.username));

                // Re-assign IDs after sorting
                junkiesUsers.forEach((user, index) => {
                    user.id = index + 1;
                });

                return;
            }
        } catch (err) {
            console.error('Error loading profiles from Supabase:', err);
        }
    }

    // Fallback to localStorage if Supabase not available
    console.log('Using localStorage fallback for junkies');
    let registeredUsers = safeJSONParse(localStorage.getItem('takenUsernames'), []);

    // Filter out reserved names using global list
    const reservedNames = window.RESERVED_USERNAMES || ['admin', 'moderator', 'system', 'support'];
    registeredUsers = registeredUsers.filter(u => !reservedNames.includes(u.toLowerCase()));

    // Get all items to calculate stats
    const allItems = [];
    if (typeof items !== 'undefined') {
        ['presets', 'samples', 'midi', 'projects', 'originals'].forEach(category => {
            if (items[category]) {
                items[category].forEach(item => {
                    allItems.push({ ...item, category });
                });
            }
        });
    }

    // Also collect unique uploaders from items (in case they're not in takenUsernames)
    const uploadersFromItems = [...new Set(allItems.map(item => item.uploader).filter(Boolean))];
    uploadersFromItems.forEach(uploader => {
        if (!registeredUsers.some(u => u.toLowerCase() === uploader.toLowerCase())) {
            registeredUsers.push(uploader);
        }
    });

    // Get user profile data storage
    const userProfiles = safeJSONParse(localStorage.getItem('allUserProfiles'), {});
    const userFollowers = safeJSONParse(localStorage.getItem('allUserFollowers'), {});

    // Build user objects with stats
    junkiesUsers = registeredUsers.map((username, index) => {
        // Count uploads for this user
        const userUploads = allItems.filter(item =>
            item.uploader && item.uploader.toLowerCase() === username.toLowerCase()
        );
        const uploadCount = userUploads.length;

        // Sum likes (hearts) across all uploads
        const totalLikes = userUploads.reduce((sum, item) => sum + (item.hearts || 0), 0);

        // Get followers (from per-user storage or estimate)
        const followers = userFollowers[username] || 0;

        // Get avatar from profile data
        const profile = userProfiles[username] || {};
        const avatar = profile.avatar || null;

        return {
            id: index + 1,
            username: username,
            avatar: avatar,
            uploads: uploadCount,
            likes: totalLikes,
            followers: followers
        };
    });

    // Sort by total engagement (likes + followers) descending
    junkiesUsers.sort((a, b) => (b.likes + b.followers) - (a.likes + a.followers));

    // Re-assign IDs after sorting
    junkiesUsers.forEach((user, index) => {
        user.id = index + 1;
    });
}

async function initJunkiesPage() {
    await buildJunkiesUserList();
    renderJunkiesGrid();
    setupJunkiesListeners();
}

function setupJunkiesListeners() {
    // Alphabet filter buttons
    document.querySelectorAll('.alphabet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.alphabet-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            junkiesCurrentLetter = btn.dataset.letter;
            junkiesCurrentPage = 1;
            renderJunkiesGrid();
        });
    });

    // Event delegation for junkie cards
    const grid = document.getElementById('junkies-grid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.junkie-card');
            if (card) {
                const userId = parseInt(card.dataset.userId);
                if (!isNaN(userId)) {
                    viewJunkieProfile(userId);
                }
            }
        });
    }

    // Event delegation for pagination
    const pagination = document.getElementById('junkies-pagination');
    if (pagination) {
        pagination.addEventListener('click', (e) => {
            const btn = e.target.closest('.pagination-btn');
            if (btn && !btn.disabled) {
                const page = parseInt(btn.dataset.page, 10);
                if (!isNaN(page)) {
                    goToJunkiesPage(page);
                }
            }
        });
    }
}

function getFilteredUsers() {
    if (junkiesCurrentLetter === 'all') {
        return junkiesUsers;
    }
    return junkiesUsers.filter(user =>
        user.username.toUpperCase().startsWith(junkiesCurrentLetter)
    );
}

function renderJunkiesGrid() {
    const grid = document.getElementById('junkies-grid');
    const pagination = document.getElementById('junkies-pagination');
    if (!grid) return;

    const filteredUsers = getFilteredUsers();
    const totalPages = Math.ceil(filteredUsers.length / junkiesPerPage);
    const startIndex = (junkiesCurrentPage - 1) * junkiesPerPage;
    const endIndex = startIndex + junkiesPerPage;
    const usersToShow = filteredUsers.slice(startIndex, endIndex);

    if (usersToShow.length === 0) {
        grid.innerHTML = '<div class="no-users-found">No users found</div>';
        pagination.innerHTML = '';
        return;
    }

    grid.innerHTML = usersToShow.map(user => `
        <div class="junkie-card" data-user-id="${user.id}">
            <div class="junkie-avatar">
                ${user.avatar && sanitizeURL(user.avatar)
                    ? `<img src="${escapeAttr(sanitizeURL(user.avatar))}" alt="${escapeAttr(user.username)}">`
                    : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
                }
            </div>
            <div class="junkie-username">${escapeHTML(user.username)}</div>
        </div>
    `).join('');

    // Render pagination
    renderJunkiesPagination(totalPages);
}

function renderJunkiesPagination(totalPages) {
    const pagination = document.getElementById('junkies-pagination');
    if (!pagination || totalPages <= 1) {
        if (pagination) pagination.innerHTML = '';
        return;
    }

    let html = '';

    // Previous button
    html += `<button class="pagination-btn ${junkiesCurrentPage === 1 ? 'disabled' : ''}"
             data-page="${junkiesCurrentPage - 1}" ${junkiesCurrentPage === 1 ? 'disabled' : ''}>
             &lt;&lt;</button>`;

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, junkiesCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage <= maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        html += `<button class="pagination-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === junkiesCurrentPage ? 'active' : ''}"
                 data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }
        html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next button
    html += `<button class="pagination-btn ${junkiesCurrentPage === totalPages ? 'disabled' : ''}"
             data-page="${junkiesCurrentPage + 1}" ${junkiesCurrentPage === totalPages ? 'disabled' : ''}>
             &gt;&gt;</button>`;

    pagination.innerHTML = html;
}

function goToJunkiesPage(page) {
    const filteredUsers = getFilteredUsers();
    const totalPages = Math.ceil(filteredUsers.length / junkiesPerPage);

    if (page < 1 || page > totalPages) return;

    junkiesCurrentPage = page;
    renderJunkiesGrid();
}

function viewJunkieProfile(userId) {
    // Find the user
    const user = junkiesUsers.find(u => u.id === userId);
    if (!user) return;

    // Use the main viewUserProfile function from user.js with overlay mode
    if (typeof viewUserProfile === 'function') {
        viewUserProfile(user.username, false, true);
    }
}

// Make functions globally accessible
window.initJunkiesPage = initJunkiesPage;
window.goToJunkiesPage = goToJunkiesPage;
window.viewJunkieProfile = viewJunkieProfile;
