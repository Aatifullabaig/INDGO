// dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://indgo-backend.onrender.com';

    // --- NEW: DISCORD OAUTH CONFIGURATION ---
    // IMPORTANT: Replace this with your actual Discord Application Client ID.
    const DISCORD_CLIENT_ID = '1419795297101676654';
    // This must match EXACTLY what you've set in your Discord Developer Portal.
    const DISCORD_REDIRECT_URI = `${API_BASE_URL}/api/auth/discord/callback`;


    // --- NEW: LOADER ELEMENT ---
    const loadingOverlay = document.getElementById('loading-overlay');

    // --- CROPPER VARIABLES AND ELEMENTS ---
    const cropperModal = document.getElementById('cropper-modal');
    const imageToCrop = document.getElementById('image-to-crop');
    const cropAndSaveBtn = document.getElementById('crop-and-save-btn');
    const cancelCropBtn = document.getElementById('cancel-crop-btn');
    const pictureInput = document.getElementById('profile-picture-input');
    let cropper;
    let croppedImageBlob = null;

    // --- PAGE ELEMENTS (MERGED & UPDATED) ---
    const welcomeMessage = document.getElementById('welcome-message');
    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');
    const addMemberForm = document.getElementById('add-member-form');
    const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    // --- FIXED: Sidebar Toggle Buttons ---
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const desktopSidebarToggleBtn = document.getElementById('desktop-sidebar-toggle');


    // --- TAB LINKS ---
    const adminTabLink = document.getElementById('admin-tab-link');
    const communityTabLink = document.getElementById('community-tab-link');
    const pilotManagementTabLink = document.getElementById('pilot-management-tab-link');
    const pirepTabLink = document.getElementById('pirep-tab-link');
    const rosterTabLink = document.getElementById('roster-tab-link');
    const pilotTabLink = document.getElementById('pilot-tab-link');
    const routeManagerTabLink = document.getElementById('route-manager-tab-link');
    const aircraftManagerTabLink = document.getElementById('aircraft-manager-tab-link'); // NEW

    // --- PROFILE CARD ELEMENTS (UPDATED) ---
    const profilePictureElem = document.getElementById('profile-picture');
    const pilotNameElem = document.getElementById('pilot-name');
    const pilotCallsignElem = document.getElementById('pilot-callsign');

    // --- CONTAINERS & DYNAMIC ELEMENTS ---
    const pilotManagementContainer = document.getElementById('pilot-management-container');
    const userListContainer = document.getElementById('user-list-container');
    const logContainer = document.getElementById('log-container');
    const manageEventsContainer = document.getElementById('manage-events-container');
    const manageHighlightsContainer = document.getElementById('manage-highlights-container');
    const pendingPirepsContainer = document.getElementById('pending-pireps-container');
    const rosterManagementContainer = document.getElementById('tab-roster-management');
    const inviteListContainer = document.getElementById('invite-list-container');

    // --- NEW: NOTIFICATION ELEMENTS ---
    const notificationBell = document.getElementById('notification-bell');
    const notificationBadge = document.getElementById('notification-badge');
    const notificationPanel = document.getElementById('notification-panel');
    const notificationList = document.getElementById('notification-list');
    let unreadNotifications = [];

    // --- APP STATE & CONFIG ---
    const token = localStorage.getItem('authToken');
    let currentUserId = null;
    let codesharePartners = []; // For codeshare management, now fetched from API
    const allRoles = {
        "General Roles": ["staff", "pilot", "admin"],
        "Leadership & Management": ["Chief Executive Officer (CEO)", "Chief Operating Officer (COO)", "PIREP Manager (PM)", "Pilot Relations & Recruitment Manager (PR)", "Technology & Design Manager (TDM)", "Head of Training (COT)", "Chief Marketing Officer (CMO)", "Route Manager (RM)", "Events Manager (EM)"],
        "Flight Operations": ["Flight Instructor (FI)"]
    };
    const pilotRanks = [
        'IndGo Cadet', 'Skyline Observer', 'Route Explorer', 'Skyline Officer',
        'Command Captain', 'Elite Captain', 'Blue Eagle', 'Line Instructor',
        'Chief Flight Instructor', 'IndGo SkyMaster', 'Blue Legacy Commander'
    ];

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // --- FIXED: SIDEBAR TOGGLE LOGIC ---
    if (dashboardContainer) {
        const sidebarState = localStorage.getItem('sidebarState');
        if (sidebarState === 'collapsed') {
            dashboardContainer.classList.add('sidebar-collapsed');
        }

        // Reusable function to handle the toggle action
        const toggleSidebar = () => {
            dashboardContainer.classList.toggle('sidebar-collapsed');
            if (dashboardContainer.classList.contains('sidebar-collapsed')) {
                localStorage.setItem('sidebarState', 'collapsed');
            } else {
                localStorage.setItem('sidebarState', 'expanded');
            }
        };

        // Attach the event listener to BOTH buttons
        if (sidebarToggleBtn) {
            sidebarToggleBtn.addEventListener('click', toggleSidebar);
        }
        if (desktopSidebarToggleBtn) {
            desktopSidebarToggleBtn.addEventListener('click', toggleSidebar);
        }
    }


    const mobileLogo = document.getElementById('mobile-scroll-logo');

    // Only run this logic if the logo element exists
    if (mobileLogo) {
        window.addEventListener('scroll', () => {
            // Add 'scrolled' class if user scrolls down more than 10px, otherwise remove it
            if (window.scrollY > 10) {
                mobileLogo.classList.add('scrolled');
            } else {
                mobileLogo.classList.remove('scrolled');
            }
        });
    }

    // =========================================================
    // START: NEW FUNCTION TO APPLY RANK-BASED THEME
    // =========================================================
    /**
     * Applies the correct CSS class to the dashboard container based on the user's rank.
     * This function will remove any previous rank theme classes before applying the new one.
     * @param {string | null} rank - The rank of the user (e.g., "Blue Eagle").
     */
    function applyRankTheme(rank) {
        if (!dashboardContainer) return;

        // Remove any existing rank classes to prevent conflicts
        const existingClasses = Array.from(dashboardContainer.classList);
        for (const cls of existingClasses) {
            if (cls.startsWith('rank-')) {
                dashboardContainer.classList.remove(cls);
            }
        }

        // If a rank is provided, create and add the new theme class
        if (rank) {
            const rankClassName = 'rank-' + rank.toLowerCase().replace(/\s+/g, '-');
            dashboardContainer.classList.add(rankClassName);
        }
    }
    // =========================================================
    // END: NEW FUNCTION
    // =========================================================


    // --- SAFE FETCH WRAPPER ---
    async function safeFetch(url, options = {}) {
        options.headers = options.headers || {};
        if (!options.headers.Authorization && token) {
            options.headers.Authorization = `Bearer ${token}`;
        }

        if (!(options.body instanceof FormData) && !options.headers['Content-Type'] && options.method !== 'DELETE') {
            options.headers['Content-Type'] = 'application/json';
        }

        const res = await fetch(url, options);
        let data = null;
        const contentType = res.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            data = await res.json();
        } else {
            const text = await res.text();
            data = {
                message: text || (res.ok ? 'Success' : 'Error')
            };
        }

        if (!res.ok) {
            const msg = (data && (data.message || data.error)) || `Server error: ${res.status}`;
            const err = new Error(msg);
            err.status = res.status;
            err.body = data;
            throw err;
        }
        return data;
    }

    // --- UI NOTIFICATION HELPER ---
    function showNotification(message, type = 'info', duration = 3000) {
        Toastify({
            text: message,
            duration: duration,
            close: true,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: {
                background: type === 'success' ? "linear-gradient(to right, #00b09b, #96c93d)" :
                    type === 'error' ? "linear-gradient(to right, #ff5f6d, #ffc371)" :
                    "linear-gradient(to right, #4facfe, #00f2fe)",
            },
            escapeMarkup: false, // Allow HTML in notifications
        }).showToast();
    }

    // --- DATA PRELOADING FUNCTION ---
    function preloadDashboardData() {
        console.log("Pre-loading dashboard data...");
        if (adminTabLink && adminTabLink.style.display !== 'none') {
            populateAdminTools();
            populateInvites();
        }
        if (pilotTabLink && pilotTabLink.style.display !== 'none') {
            populatePilotDatabase();
        }
        if (pirepTabLink && pirepTabLink.style.display !== 'none') {
            loadPendingPireps();
        }
        if (rosterTabLink && rosterTabLink.style.display !== 'none') {
            populateRosterManagement();
        }
        if (pilotManagementTabLink && pilotManagementTabLink.style.display !== 'none') {
            populatePilotManagement();
        }
        if (communityTabLink && communityTabLink.style.display !== 'none') {
            populateCommunityManagement();
        }
        if (routeManagerTabLink && routeManagerTabLink.style.display !== 'none') {
            populateRouteManager();
        }
        // NEW: Preload Aircraft Manager
        if (aircraftManagerTabLink && aircraftManagerTabLink.style.display !== 'none') {
            populateAircraftManager();
        }
    }


    // --- FETCH USER DATA & SETUP UI ---
    async function fetchUserData() {
        try {
            const user = await safeFetch(`${API_BASE_URL}/api/me`);
            currentUserId = user._id;

            // Apply the dynamic rank-based theme to the entire dashboard
            applyRankTheme(user.rank);

            if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${user.name || 'Pilot'}!`;

            if (pilotNameElem) pilotNameElem.textContent = user.name;
            if (pilotCallsignElem) pilotCallsignElem.textContent = user.role ? user.role.toUpperCase() : 'USER';
            if (profilePictureElem) profilePictureElem.src = user.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff&size=120`;

            // Populate form fields
            document.getElementById('profile-name').value = user.name;
            document.getElementById('profile-bio').value = user.bio || '';
            document.getElementById('profile-infinite-flight-username').value = user.infiniteFlightUsername || '';
            document.getElementById('profile-ifc').value = user.ifc || '';
            document.getElementById('profile-youtube').value = user.youtube || '';
            document.getElementById('profile-preferred').value = user.preferredContact || 'none';

            // --- START: UPDATED DISCORD LINKING UI ---
            const discordStatus = document.getElementById('discord-status');
            const linkDiscordBtn = document.getElementById('link-discord-btn');

            const discordEntry = (user.connectedAccounts || []).find(
                a => a.provider === 'discord' && (a.verified === true || a.verified === undefined)
            );
            const discordName = discordEntry?.username || user.discord;

            if (discordName) {
                discordStatus.textContent = `Linked as ${discordName}`;
                discordStatus.style.color = 'var(--success-color)';
                linkDiscordBtn.textContent = 'Unlink';
                linkDiscordBtn.classList.add('unlink-btn');
            } else {
                discordStatus.textContent = 'Not Linked. Click to connect.';
                discordStatus.style.color = 'inherit';
                linkDiscordBtn.textContent = 'Link Discord';
                linkDiscordBtn.classList.remove('unlink-btn');
            }

            // --- ROLE-BASED TAB VISIBILITY ---
            const showTab = (element) => {
                if (element) element.style.display = 'list-item';
            };

            if (user.role === 'admin') {
                showTab(adminTabLink);
                showTab(pilotTabLink);
            }

            const communityRoles = ['Chief Executive Officer (CEO)', 'Chief Operating Officer (COO)', 'admin', 'Chief Marketing Officer (CMO)', 'Events Manager (EM)'];
            if (communityRoles.includes(user.role)) {
                showTab(communityTabLink);
            }

            const pilotManagerRoles = ['admin', 'Chief Executive Officer (CEO)', 'Chief Operating Officer (COO)', 'Head of Training (COT)'];
            if (pilotManagerRoles.includes(user.role)) {
                showTab(pilotManagementTabLink);
            }

            const pirepManagerRoles = ['admin', 'Chief Executive Officer (CEO)', 'Chief Operating Officer (COO)', 'PIREP Manager (PM)'];
            if (pirepManagerRoles.includes(user.role)) {
                showTab(pirepTabLink);
            }

            const routeManagerRoles = ['admin', 'Chief Executive Officer (CEO)', 'Chief Operating Officer (COO)', 'Route Manager (RM)'];
            if (routeManagerRoles.includes(user.role)) {
                showTab(rosterTabLink);
                showTab(routeManagerTabLink);
                showTab(aircraftManagerTabLink); // NEW: Show Aircraft Manager tab
            }

            // Hide the main loader now that the core UI is ready
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }

            preloadDashboardData();

        } catch (error) {
            console.error('Error fetching user data:', error);
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        }
    }

    // --- PERFORMANCE OPTIMIZATION: Generic function to render lists efficiently ---
    function renderList(container, items, itemRenderer, emptyMessage) {
        if (!container) return;
        container.innerHTML = '';

        if (!items || items.length === 0) {
            container.innerHTML = `<p>${emptyMessage}</p>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const element = itemRenderer(item);
            if (element) fragment.appendChild(element);
        });

        container.appendChild(fragment);
    }

    // --- NOTIFICATION HANDLING ---
    function updateNotificationUI() {
        if (unreadNotifications.length > 0) {
            notificationBadge.textContent = unreadNotifications.length;
            notificationBadge.style.display = 'block';
        } else {
            notificationBadge.style.display = 'none';
        }

        notificationList.innerHTML = '';
        if (unreadNotifications.length === 0) {
            notificationList.innerHTML = '<div class="notification-item">No new notifications.</div>';
        } else {
            unreadNotifications.forEach(n => {
                const item = document.createElement('div');
                item.className = 'notification-item';
                item.innerHTML = `<p>${n.message}</p><small>${new Date(n.createdAt).toLocaleString()}</small>`;
                notificationList.appendChild(item);
            });
        }
    }

    if (notificationBell) {
        notificationBell.addEventListener('click', async (e) => {
            e.preventDefault();
            notificationPanel.classList.toggle('active');

            if (notificationPanel.classList.contains('active') && unreadNotifications.length > 0) {
                const idsToMarkRead = unreadNotifications.map(n => n._id);
                try {
                    await safeFetch(`${API_BASE_URL}/api/me/notifications/read`, {
                        method: 'POST',
                        body: JSON.stringify({
                            notificationIds: idsToMarkRead
                        })
                    });
                    unreadNotifications = [];
                    setTimeout(() => {
                        notificationBadge.style.display = 'none';
                    }, 1500);
                } catch (error) {
                    console.error("Could not mark notifications as read:", error);
                }
            }
        });
    }

    // --- PIREP MANAGEMENT ---
    async function loadPendingPireps() {
        if (!pendingPirepsContainer) return;
        try {
            const pireps = await safeFetch(`${API_BASE_URL}/api/pireps/pending`);
            renderPireps(pireps);
        } catch (error) {
            pendingPirepsContainer.innerHTML = `<p style="color: #ff5f6d;">Error: ${error.message}</p>`;
        }
    }

    function createPirepCardElement(p) {
        const card = document.createElement('div');
        card.className = 'pirep-review-card';
        card.id = `pirep-${p._id}`;

        let verificationLinkHtml = '';
        if (p.source === 'ACARS') {
            verificationLinkHtml = '<p><strong>Verification:</strong> <span style="color: var(--success-color);">Not Required (ACARS)</span></p>';
        } else if (p.verificationImageUrl) {
            verificationLinkHtml = `<p><strong>Verification:</strong> <a href="${p.verificationImageUrl}" target="_blank" class="view-image-btn">View Submitted Image</a></p>`;
        } else {
            verificationLinkHtml = '<p><strong>Verification:</strong> No image submitted.</p>';
        }

        const sourceText = p.source === 'ACARS' ? 'ACARS' : 'Manual';

        card.innerHTML = `
            <div class="card-header">
                <h4>${p.flightNumber} (${p.departure} → ${p.arrival})</h4>
                <div class="pilot-info">
                    <strong>Pilot:</strong> ${p.pilot.name} (${p.pilot.callsign || 'N/A'})
                </div>
            </div>
            <div class="card-body">
                <p><strong>Aircraft:</strong> ${p.aircraft}</p>
                <p><strong>Flight Time:</strong> ${p.flightTime.toFixed(1)} hours</p>
                <p><strong>Remarks:</strong> ${p.remarks || 'None'}</p>
                ${verificationLinkHtml}
                <p><small>Filed on: ${new Date(p.createdAt).toLocaleString()} via <strong>${sourceText}</strong></small></p>
            </div>
            <div class="card-actions">
                <div class="pirep-actions-left">
                    <button class="btn-approve" data-id="${p._id}">Approve</button>
                    <button class="btn-reject" data-id="${p._id}">Reject</button>
                </div>
                <div class="pirep-actions-right">
                    <label for="correct-time-${p._id}">Correct Time (hrs):</label>
                    <input type="number" step="0.1" min="0.1" id="correct-time-${p._id}" placeholder="${p.flightTime.toFixed(1)}">
                </div>
            </div>
        `;
        return card;
    }

    function renderPireps(pireps) {
        renderList(pendingPirepsContainer, pireps, createPirepCardElement, 'There are no pending PIREPs to review. 🎉');
    }

    if (pendingPirepsContainer) {
        pendingPirepsContainer.addEventListener('click', async (e) => {
            const pirepId = e.target.dataset.id;
            if (!pirepId) return;

            if (e.target.classList.contains('btn-approve')) {
                e.target.disabled = true;
                e.target.textContent = 'Approving...';

                const correctedTimeInput = document.getElementById(`correct-time-${pirepId}`);
                const correctedFlightTime = correctedTimeInput ? correctedTimeInput.value : null;

                const body = {};
                if (correctedFlightTime && !isNaN(parseFloat(correctedFlightTime))) {
                    body.correctedFlightTime = parseFloat(correctedFlightTime);
                }

                try {
                    const result = await safeFetch(`${API_BASE_URL}/api/pireps/${pirepId}/approve`, {
                        method: 'PUT',
                        body: JSON.stringify(body)
                    });
                    showNotification(result.message, 'success', 10000);
                    const pirepCard = document.getElementById(`pirep-${pirepId}`);
                    if (pirepCard) pirepCard.remove();
                    if (pendingPirepsContainer.children.length === 0) {
                        pendingPirepsContainer.innerHTML = '<p>There are no pending PIREPs to review. 🎉</p>';
                    }
                } catch (error) {
                    showNotification(`Error: ${error.message}`, 'error');
                } finally {
                    e.target.disabled = false;
                    e.target.textContent = 'Approve';
                }
            }

            if (e.target.classList.contains('btn-reject')) {
                const reason = prompt('Please provide a reason for rejecting this PIREP:');
                if (!reason || reason.trim() === '') {
                    showNotification('Rejection cancelled. A reason is required.', 'info');
                    return;
                }
                e.target.disabled = true;
                e.target.textContent = 'Rejecting...';
                try {
                    const result = await safeFetch(`${API_BASE_URL}/api/pireps/${pirepId}/reject`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            reason
                        })
                    });
                    showNotification(result.message, 'success');
                    const pirepCard = document.getElementById(`pirep-${pirepId}`);
                    if (pirepCard) pirepCard.remove();
                    if (pendingPirepsContainer.children.length === 0) {
                        pendingPirepsContainer.innerHTML = '<p>There are no pending PIREPs to review. 🎉</p>';
                    }
                } catch (error) {
                    showNotification(`Error: ${error.message}`, 'error');
                } finally {
                    e.target.disabled = false;
                    e.target.textContent = 'Reject';
                }
            }
        });
    }

    // --- ROSTER MANAGEMENT ---
    function populateRosterManagement() {
        if (!rosterManagementContainer) return;

        rosterManagementContainer.innerHTML = `
            <h2><i class="fas fa-clipboard-list"></i> Roster Management</h2>
            <p>Create and manage daily rosters for the Sector Ops system.</p>
            
            <div id="roster-automation-panel" style="background: var(--secondary-bg); padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 2rem;">
                <h3>Automated Roster Generation</h3>
                <p>Automatically generate a new set of daily rosters from the master Google Sheet. This will delete all previously auto-generated rosters.</p>
                <button id="generate-rosters-btn" class="cta-button">Generate Rosters from Sheet</button>
            </div>
            
            <div id="create-roster-panel">
                <h3>Create New Roster (Manual)</h3>
                <form id="create-roster-form" class="dashboard-form">
                    <div class="form-group"><label for="roster-name">Roster Name</label><input type="text" id="roster-name" required></div>
                    <div class="form-group"><label for="roster-hub">Hub ICAO</label><input type="text" id="roster-hub" required maxlength="4"></div>
                    <h4>Roster Legs</h4>
                    <p style="font-size: 0.9em; color: var(--dashboard-text-muted); margin-bottom: 1rem;">Add at least one leg. The total flight time will be calculated automatically.</p>
                    <div id="roster-legs-container">
                        <div class="roster-leg-input" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; align-items: flex-end;">
                            <input type="text" placeholder="Flight #" required style="flex: 1 1 100px;">
                            <input type="text" placeholder="Aircraft" required style="flex: 1 1 100px;">
                            <input type="text" placeholder="Departure ICAO" required maxlength="4" style="flex: 1 1 120px;">
                            <input type="text" placeholder="Arrival ICAO" required maxlength="4" style="flex: 1 1 120px;">
                            <input type="number" step="0.1" min="0.1" placeholder="Time (hrs)" required style="flex: 1 1 80px;">
                        </div>
                    </div>
                    <button type="button" id="add-leg-btn" class="cta-button">Add Leg</button>
                    <hr style="margin: 1rem 0;">
                    <button type="submit" class="cta-button">Create Roster</button>
                </form>
            </div>
            <hr style="margin: 2rem 0;">
            <div id="manage-rosters-panel">
                <h3>Existing Rosters</h3>
                <div id="manage-rosters-container"><p>Loading rosters...</p></div>
            </div>
        `;

        loadAndRenderRosters(true);

        document.getElementById('add-leg-btn').addEventListener('click', () => {
            const legContainer = document.getElementById('roster-legs-container');
            const newLeg = document.createElement('div');
            newLeg.className = 'roster-leg-input';
            newLeg.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; align-items: flex-end;';
            newLeg.innerHTML = `
                <input type="text" placeholder="Flight #" required style="flex: 1 1 100px;">
                <input type="text" placeholder="Aircraft" required style="flex: 1 1 100px;">
                <input type="text" placeholder="Departure ICAO" required maxlength="4" style="flex: 1 1 120px;">
                <input type="text" placeholder="Arrival ICAO" required maxlength="4" style="flex: 1 1 120px;">
                <input type="number" step="0.1" min="0.1" placeholder="Time (hrs)" required style="flex: 1 1 80px;">
                <button type="button" class="remove-leg-btn" style="background: var(--error-color); border: none; color: white; border-radius: 5px; padding: 0.5rem 0.75rem;">&times;</button>`;
            legContainer.appendChild(newLeg);
        });

        document.getElementById('roster-legs-container').addEventListener('click', e => {
            if (e.target.classList.contains('remove-leg-btn')) {
                e.target.parentElement.remove();
            }
        });

        document.getElementById('create-roster-form').addEventListener('submit', async e => {
            e.preventDefault();
            let totalFlightTime = 0;
            const legs = Array.from(document.querySelectorAll('.roster-leg-input')).map(legDiv => {
                const inputs = legDiv.querySelectorAll('input');
                const legTime = parseFloat(inputs[4].value);
                totalFlightTime += legTime;
                return {
                    flightNumber: inputs[0].value.toUpperCase(),
                    aircraft: inputs[1].value,
                    departure: inputs[2].value.toUpperCase(),
                    arrival: inputs[3].value.toUpperCase(),
                    flightTime: legTime,
                };
            });

            if (legs.length === 0) {
                showNotification('You must add at least one leg to the roster.', 'error');
                return;
            }

            const rosterData = {
                name: document.getElementById('roster-name').value,
                hub: document.getElementById('roster-hub').value.toUpperCase(),
                totalFlightTime: totalFlightTime,
                legs: legs,
            };

            try {
                const newRoster = await safeFetch(`${API_BASE_URL}/api/rosters`, {
                    method: 'POST',
                    body: JSON.stringify(rosterData)
                });
                showNotification('Roster created successfully!', 'success');
                e.target.reset();
                document.getElementById('roster-legs-container').innerHTML = `<div class="roster-leg-input" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; align-items: flex-end;"><input type="text" placeholder="Flight #" required style="flex: 1 1 100px;"><input type="text" placeholder="Aircraft" required style="flex: 1 1 100px;"><input type="text" placeholder="Departure ICAO" required maxlength="4" style="flex: 1 1 120px;"><input type="text" placeholder="Arrival ICAO" required maxlength="4" style="flex: 1 1 120px;"><input type="number" step="0.1" min="0.1" placeholder="Time (hrs)" required style="flex: 1 1 80px;"></div>`;

                const rosterContainer = document.getElementById('manage-rosters-container');
                const rosterElement = createRosterCardElement(newRoster);
                rosterContainer.prepend(rosterElement);

            } catch (error) {
                showNotification(`Error creating roster: ${error.message}`, 'error');
            }
        });
    }

    async function loadAndRenderRosters(fetchAll = false) {
        const container = document.getElementById('manage-rosters-container');
        try {
            const url = fetchAll ?
                `${API_BASE_URL}/api/rosters?all=true` :
                `${API_BASE_URL}/api/rosters`;
            const rosters = await safeFetch(url);
            renderList(container, rosters, createRosterCardElement, 'No rosters have been created yet.');
        } catch (error) {
            if (container) container.innerHTML = `<p style="color:red;">Could not load rosters: ${error.message}</p>`;
        }
    }

    function createRosterCardElement(roster) {
        const card = document.createElement('div');
        card.className = 'user-manage-card';
        card.setAttribute('data-rosterid', roster._id);
        card.innerHTML = `
            <div class="user-info">
                <strong>${roster.name} ${roster.isGenerated ? ' <small>(Auto)</small>' : ''}</strong> (${roster.hub})
                <small>${roster.legs.length} legs, ${roster.totalFlightTime.toFixed(1)} hrs</small>
            </div>
            <div class="user-controls">
                <button class="delete-user-btn delete-roster-btn" data-id="${roster._id}" data-name="${roster.name}"><i class="fas fa-trash-alt"></i> Delete</button>
            </div>
        `;
        return card;
    }


    if (rosterManagementContainer) {
        rosterManagementContainer.addEventListener('click', async e => {
            const deleteButton = e.target.closest('.delete-roster-btn');
            const generateButton = e.target.closest('#generate-rosters-btn');

            if (deleteButton) {
                const rosterId = deleteButton.dataset.id;
                const rosterName = deleteButton.dataset.name;
                if (confirm(`Are you sure you want to delete the roster "${rosterName}"?`)) {
                    try {
                        await safeFetch(`${API_BASE_URL}/api/rosters/${rosterId}`, {
                            method: 'DELETE'
                        });
                        showNotification('Roster deleted successfully.', 'success');
                        deleteButton.closest('.user-manage-card').remove();
                    } catch (error) {
                        showNotification(`Error deleting roster: ${error.message}`, 'error');
                    }
                }
            }

            if (generateButton) {
                if (!confirm('Are you sure? This will replace all existing auto-generated rosters.')) return;

                generateButton.disabled = true;
                generateButton.textContent = 'Generating...';
                try {
                    const result = await safeFetch(`${API_BASE_URL}/api/rosters/generate`, {
                        method: 'POST'
                    });
                    showNotification(result.message, 'success');
                    loadAndRenderRosters(true);
                } catch (error) {
                    showNotification(`Generation failed: ${error.message}`, 'error');
                } finally {
                    generateButton.disabled = false;
                    generateButton.textContent = 'Generate Rosters from Sheet';
                }
            }
        });
    }

    // =========================================================
    // START: 🌟 REBUILT & REDESIGNED ROUTE MANAGER SECTION 🌟
    // =========================================================
    async function populateRouteManager() {
        const container = document.getElementById('tab-route-manager');
        if (!container) return;

        // --- STATE FOR PAGINATION ---
        let routeCurrentPage = 1;
        const routesPerPage = 15;
        let allFilteredRoutes = [];

        // --- SETUP INITIAL HTML LAYOUT ---
        container.innerHTML = `
            <h2><i class="fas fa-route"></i> Route Network Manager</h2>
            <p>Manage the airline's route network. Use the actions below to add routes manually, manage codeshare partners, or import routes in bulk.</p>
            
            <div class="route-manager-actions">
                <button id="add-route-btn" class="cta-button"><i class="fas fa-plus"></i> Add New Route</button>
                <button id="manage-codeshares-btn" class="cta-button secondary-btn"><i class="fas fa-handshake"></i> Manage Codeshares</button>
                <button id="import-routes-btn" class="cta-button secondary-btn"><i class="fas fa-file-import"></i> Import from Sheet</button>
            </div>

            <div class="content-card" style="margin-top: 1rem;">
                <h3><i class="fas fa-plane-departure"></i> Current Route Database</h3>
                <div id="route-filters" style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: flex-end;">
                    <div style="flex: 1;"><label for="filter-operator">Operator</label><select id="filter-operator" class="form-control"></select></div>
                    <div style="flex: 1;"><label for="filter-icao">ICAO (Dep/Arr)</label><input type="text" id="filter-icao" placeholder="e.g., VABB" class="form-control"></div>
                    <div style="flex: 1;"><label for="filter-aircraft-by-codeshare">Aircraft</label><select id="filter-aircraft-by-codeshare" class="form-control"><option value="">All Aircraft</option></select></div>
                </div>
                <div id="route-list-container"><p>Loading routes...</p></div>
                <div id="route-pagination-controls" class="pagination-container"></div>
            </div>
        `;

        // --- GET MODAL & FORM ELEMENTS ---
        const routeModal = document.getElementById('route-modal');
        const codeshareModal = document.getElementById('codeshare-modal');
        const importSheetModal = document.getElementById('import-sheet-modal');
        const addRouteForm = document.getElementById('add-route-form');
        const addCodeshareForm = document.getElementById('add-codeshare-form');
        const importSheetForm = document.getElementById('import-sheet-form');

        // --- MODAL CONTROL FUNCTIONS ---
        const openModal = (modal) => modal.classList.add('active');
        const closeModal = (modal) => modal.classList.remove('active');

        // --- HELPER TO POPULATE OPERATOR DROPDOWNS ---
        const populateOperatorSelects = () => {
            const selects = document.querySelectorAll('#route-operator, #filter-operator, #import-sheet-operator-select');
            let coreOptionsHtml = `<option value="IndGo Air Virtual">IndGo Air Virtual</option>`;
            codesharePartners.forEach(p => {
                coreOptionsHtml += `<option value="${p.name}">${p.name}</option>`;
            });

            selects.forEach(select => {
                if (select.id === 'filter-operator') {
                    select.innerHTML = `<option value="">All Operators</option>` + coreOptionsHtml;
                } else if (select.id === 'import-sheet-operator-select') {
                    select.innerHTML = `<option value="" disabled selected>Select an Operator</option>` + coreOptionsHtml;
                } else {
                    select.innerHTML = coreOptionsHtml;
                }
            });
        };

        // --- CODESHARE MANAGEMENT ---
        const loadAndRenderCodeshares = async () => {
            const container = document.getElementById('codeshare-list-container-modal');
            try {
                codesharePartners = await safeFetch(`${API_BASE_URL}/api/codeshares`);
                populateOperatorSelects();
                renderList(container, codesharePartners, item => {
                    const div = document.createElement('div');
                    div.className = 'codeshare-item-modal';
                    div.innerHTML = `
                        <div>
                            <img src="${item.logoUrl}" alt="${item.name} logo" style="height: 20px; width: auto; margin-right: 10px; vertical-align: middle;">
                            <span>${item.name}</span>
                        </div>
                        <button class="delete-user-btn delete-codeshare-btn" data-name="${item.name}" title="Delete">&times;</button>
                    `;
                    return div;
                }, 'No codeshare partners added.');
            } catch (error) {
                showNotification(`Error loading codeshares: ${error.message}`, 'error');
            }
        };

        const handleAddCodeshare = async (e) => {
            e.preventDefault();
            const name = document.getElementById('codeshare-name').value.trim();
            const logoUrl = document.getElementById('codeshare-logo').value.trim();
            if (!name || !logoUrl) return;

            try {
                await safeFetch(`${API_BASE_URL}/api/codeshares`, { method: 'POST', body: JSON.stringify({ name, logoUrl }) });
                showNotification('Codeshare partner added.', 'success');
                addCodeshareForm.reset();
                await loadAndRenderCodeshares();
            } catch (error) {
                showNotification(`Failed to add partner: ${error.message}`, 'error');
            }
        };

        const handleDeleteCodeshare = async (name) => {
            if (!name || !confirm(`Delete "${name}"? This will affect all routes and aircraft associated with it.`)) return;
            try {
                await safeFetch(`${API_BASE_URL}/api/codeshares/${encodeURIComponent(name)}`, { method: 'DELETE' });
                showNotification('Codeshare partner removed.', 'success');
                await loadAndRenderCodeshares();
            } catch (error) {
                showNotification(`Failed to remove partner: ${error.message}`, 'error');
            }
        };

        // --- PAGINATION & ROUTE RENDERING ---
        const renderPaginationControls = () => {
            const container = document.getElementById('route-pagination-controls');
            if (!container) return;
        
            const totalPages = Math.ceil(allFilteredRoutes.length / routesPerPage);
        
            if (totalPages <= 1) {
                container.innerHTML = '';
                return;
            }
        
            const pagesToShow = new Set();
            const context = 2; // Number of pages to show around the current page
        
            // Always add first and last page
            pagesToShow.add(1);
            pagesToShow.add(totalPages);
        
            // Add current page and surrounding pages
            for (let i = -context; i <= context; i++) {
                const page = routeCurrentPage + i;
                if (page > 0 && page <= totalPages) {
                    pagesToShow.add(page);
                }
            }
        
            const sortedPages = Array.from(pagesToShow).sort((a, b) => a - b);
            let html = '';
            let lastPage = 0;
        
            sortedPages.forEach(page => {
                if (lastPage !== 0 && page - lastPage > 1) {
                    // If there's a gap, add an ellipsis
                    html += `<span class="pagination-ellipsis" style="padding: 0.5rem 0.8rem;">...</span>`;
                }
                html += `<button data-page="${page}" class="${page === routeCurrentPage ? 'active' : ''}">${page}</button>`;
                lastPage = page;
            });
        
            container.innerHTML = `
                <button data-page="${routeCurrentPage - 1}" ${routeCurrentPage === 1 ? 'disabled' : ''}>&laquo; Prev</button>
                ${html}
                <button data-page="${routeCurrentPage + 1}" ${routeCurrentPage === totalPages ? 'disabled' : ''}>Next &raquo;</button>
            `;
        };

        const displayCurrentRoutePage = () => {
            const container = document.getElementById('route-list-container');
            const startIndex = (routeCurrentPage - 1) * routesPerPage;
            const endIndex = startIndex + routesPerPage;
            const routesToDisplay = allFilteredRoutes.slice(startIndex, endIndex);

            const partnerMap = new Map(codesharePartners.map(p => [p.name, p.logoUrl]));
            const defaultLogo = 'images/indgo.png';

            const renderer = (route) => {
                const card = document.createElement('div');
                card.className = 'route-card';
                card.style.cssText = 'display: grid; grid-template-columns: 50px 1fr 1fr 1fr auto; gap: 1rem; align-items: center; padding: 0.75rem; border-bottom: 1px solid var(--border-color);';
                const operatorLogoUrl = partnerMap.get(route.operator) || defaultLogo;
                card.innerHTML = `
                    <img src="${operatorLogoUrl}" alt="${route.operator}" class="operator-logo" title="${route.operator}" style="height: 24px; width: auto;">
                    <div><strong>${route.flightNumber}</strong><br><small style="color: var(--dashboard-text-muted);">${route.operator}</small></div>
                    <div>${route.departure} &rarr; ${route.arrival}<br><small style="color: var(--dashboard-text-muted);">${route.flightTime} hrs</small></div>
                    <div>${route.aircraft}<br><small style="color: var(--dashboard-text-muted);">Livery: ${route.livery || 'Standard'}</small></div>
                    <button class="delete-user-btn delete-route-btn" data-flightnumber="${route.flightNumber}"><i class="fas fa-trash-alt"></i></button>
                `;
                return card;
            };
            renderList(container, routesToDisplay, renderer, 'No routes match the current filters.');
            renderPaginationControls();
        };

        const fetchAndRenderRoutes = async () => {
            const container = document.getElementById('route-list-container');
            const operator = document.getElementById('filter-operator')?.value || '';
            const acPick = document.getElementById('filter-aircraft-by-codeshare')?.value || '';
            const icao = document.getElementById('filter-icao')?.value.trim() || '';

            const params = new URLSearchParams();
            if (operator) params.set('operator', operator);
            if (acPick) params.set('aircraft', acPick);
            if (icao) params.set('icao', icao.toUpperCase());

            try {
                if(container) container.innerHTML = `<p>Loading routes...</p>`;
                allFilteredRoutes = await safeFetch(`${API_BASE_URL}/api/routes?${params.toString()}`);
                allFilteredRoutes.sort((a, b) => a.flightNumber.localeCompare(b.flightNumber));
                routeCurrentPage = 1; // Reset to first page on new filter
                displayCurrentRoutePage();
            } catch (e) {
                showNotification(`Error loading routes: ${e.message}`, 'error');
                if(container) container.innerHTML = `<p style="color:red;">Error loading routes: ${e.message}</p>`;
            }
        };

        // --- ROUTE & IMPORT HANDLERS ---
        const handleAddRoute = async (e) => {
            e.preventDefault();
            const routeData = {
                flightNumber: document.getElementById('route-flightnumber').value.trim().toUpperCase(),
                departure: document.getElementById('route-departure').value.trim().toUpperCase(),
                arrival: document.getElementById('route-arrival').value.trim().toUpperCase(),
                aircraft: document.getElementById('route-aircraft').value.trim(),
                flightTime: parseFloat(document.getElementById('route-flighttime').value),
                operator: document.getElementById('route-operator').value,
                livery: document.getElementById('route-livery').value.trim()
            };
            try {
                await safeFetch(`${API_BASE_URL}/api/routes`, { method: 'POST', body: JSON.stringify(routeData) });
                showNotification(`Route ${routeData.flightNumber} added!`, 'success');
                addRouteForm.reset();
                closeModal(routeModal);
                fetchAndRenderRoutes();
            } catch (error) {
                showNotification(`Error adding route: ${error.message}`, 'error');
            }
        };
        
        const handleImportSheet = async (e) => {
            e.preventDefault();
            const button = document.getElementById('import-sheet-btn');
            const sheetUrl = document.getElementById('import-sheet-url').value.trim();
            const operator = document.getElementById('import-sheet-operator-select').value;
            if (!sheetUrl || !operator) return;

            button.disabled = true;
            button.textContent = 'Importing...';
            try {
                const result = await safeFetch(`${API_BASE_URL}/api/routes/import-sheet`, { method: 'POST', body: JSON.stringify({ sheetUrl, operator }) });
                showNotification(`${result.message} (Added: ${result.routesAdded}, New Aircraft: ${result.newAircraftCreated})`, 'success', 8000);
                importSheetForm.reset();
                closeModal(importSheetModal);
                fetchAndRenderRoutes();
                if (result.newAircraftCreated > 0 && aircraftManagerTabLink.style.display !== 'none') {
                    populateAircraftManager();
                }
            } catch (error) {
                showNotification(`Import failed: ${error.message}`, 'error');
            } finally {
                button.disabled = false;
                button.textContent = 'Import Routes';
            }
        };

        const handleDeleteRoute = async (flightNumber) => {
            if (!confirm(`Are you sure you want to delete route ${flightNumber}?`)) return;
            try {
                await safeFetch(`${API_BASE_URL}/api/routes/${flightNumber}`, { method: 'DELETE' });
                showNotification(`Route ${flightNumber} deleted.`, 'success');
                fetchAndRenderRoutes();
            } catch (error) {
                showNotification(`Error deleting route: ${error.message}`, 'error');
            }
        };
        
        const populateAircraftOptionsForOperator = async () => {
             const operator = (document.getElementById('filter-operator')?.value || '').trim();
            const sel = document.getElementById('filter-aircraft-by-codeshare');
            if (!sel) return;
            if (!operator) {
                sel.innerHTML = '<option value="">All aircraft</option>';
                return;
            }
            try {
                const ac = await safeFetch(`${API_BASE_URL}/api/aircrafts?codeshare=${encodeURIComponent(operator)}`);
                const opts = ['<option value="">All aircraft</option>'].concat(
                    (ac || []).map(a => `<option value="${a.icao}">${a.icao} — ${a.name}</option>`)
                );
                sel.innerHTML = opts.join('');
            } catch (error) {
                showNotification(`Could not load aircraft for operator: ${error.message}`, 'error');
                sel.innerHTML = '<option value="">All aircraft</option>';
            }
        };

        // --- ATTACH EVENT LISTENERS ---
        document.getElementById('add-route-btn').addEventListener('click', () => openModal(routeModal));
        document.getElementById('manage-codeshares-btn').addEventListener('click', () => openModal(codeshareModal));
        document.getElementById('import-routes-btn').addEventListener('click', () => openModal(importSheetModal));

        document.querySelectorAll('.modal-close-btn, .cta-button.secondary-btn[data-modal-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = document.getElementById(btn.dataset.modalId);
                if (modal) closeModal(modal);
            });
        });
        
        addRouteForm.addEventListener('submit', handleAddRoute);
        addCodeshareForm.addEventListener('submit', handleAddCodeshare);
        importSheetForm.addEventListener('submit', handleImportSheet);
        
        // Filter Listeners
        document.getElementById('filter-operator').addEventListener('change', () => { populateAircraftOptionsForOperator(); fetchAndRenderRoutes(); });
        document.getElementById('filter-icao').addEventListener('input', fetchAndRenderRoutes);
        document.getElementById('filter-aircraft-by-codeshare').addEventListener('change', fetchAndRenderRoutes);

        // Event Delegation for dynamic content
        container.addEventListener('click', e => {
            // Delete route
            const deleteRouteBtn = e.target.closest('.delete-route-btn');
            if (deleteRouteBtn) {
                handleDeleteRoute(deleteRouteBtn.dataset.flightnumber);
            }
            // Pagination
            const pageBtn = e.target.closest('#route-pagination-controls button[data-page]');
            if (pageBtn && !pageBtn.disabled) {
                routeCurrentPage = parseInt(pageBtn.dataset.page, 10);
                displayCurrentRoutePage();
            }
        });
        
        codeshareModal.addEventListener('click', e => {
             const deleteCodeshareBtn = e.target.closest('.delete-codeshare-btn');
            if (deleteCodeshareBtn) {
                handleDeleteCodeshare(deleteCodeshareBtn.dataset.name);
            }
        });

        // --- INITIAL DATA LOAD ---
        await loadAndRenderCodeshares();
        await populateAircraftOptionsForOperator();
        await fetchAndRenderRoutes();
    }
    // =========================================================
    // END: ROUTE MANAGER SECTION
    // =========================================================

    // =========================================================
    // START: 🌟 REBUILT & REDESIGNED AIRCRAFT MANAGER SECTION 🌟
    // =========================================================
    async function populateAircraftManager() {
        const container = document.getElementById('tab-aircraft-manager');
        if (!container) return;

        // State variable to hold fleet data, preventing re-fetches
        let aircraftFleet = [];

        // --- MODAL ELEMENTS ---
        const modal = document.getElementById('aircraft-modal');
        const modalForm = document.getElementById('aircraft-modal-form');
        const modalTitle = document.getElementById('aircraft-modal-title');
        const modalCloseBtn = document.getElementById('aircraft-modal-close-btn');
        const modalCancelBtn = document.getElementById('modal-ac-cancel-btn');

        // --- MODAL FORM FIELDS ---
        const editIdInput = document.getElementById('modal-ac-edit-id');
        const nameInput = document.getElementById('modal-ac-name');
        const icaoInput = document.getElementById('modal-ac-icao');
        const typeSelect = document.getElementById('modal-ac-type');
        const rankSelect = document.getElementById('modal-ac-rank');
        const codeshareSelect = document.getElementById('modal-ac-codeshare');
        const imageUrlInput = document.getElementById('modal-ac-image-url');
        const imageFileInput = document.getElementById('modal-ac-image-file');

        // --- INITIAL UI SETUP ---
        container.innerHTML = `
            <h2><i class="fas fa-plane"></i> Aircraft Fleet Manager</h2>
            <p>Add, update, and manage aircraft available to the airline and its codeshare partners. Each aircraft can be assigned a minimum rank required for pilots to fly it.</p>
            <div style="margin: 1.5rem 0;">
                <button id="add-new-aircraft-btn" class="cta-button"><i class="fas fa-plus"></i> Add New Aircraft</button>
            </div>
            <hr>
            <h3>Existing Aircraft Fleet</h3>
            <div id="aircraft-list"><p>Loading aircraft…</p></div>
        `;

        // --- HELPER FUNCTIONS ---
        const openAircraftModal = (aircraft = null) => {
            modalForm.reset();
            if (aircraft) {
                // EDIT MODE
                modalTitle.textContent = `Editing: ${aircraft.name}`;
                editIdInput.value = aircraft._id;
                nameInput.value = aircraft.name;
                icaoInput.value = aircraft.icao;
                typeSelect.value = aircraft.type;
                rankSelect.value = aircraft.rankUnlock;
                codeshareSelect.value = aircraft.codeshare;
                imageUrlInput.value = aircraft.imageUrl || '';
            } else {
                // ADD MODE
                modalTitle.textContent = 'Add New Aircraft';
                editIdInput.value = '';
            }
            modal.classList.add('active');
        };

        const closeAircraftModal = () => {
            modal.classList.remove('active');
        };

        const renderAircraftList = async () => {
            const listEl = document.getElementById('aircraft-list');
            try {
                aircraftFleet = await safeFetch(`${API_BASE_URL}/api/aircrafts`); // Refresh and store data
                
                if (!aircraftFleet || aircraftFleet.length === 0) {
                    listEl.innerHTML = '<p>No aircraft have been added to the fleet yet.</p>';
                    return;
                }
                const html = aircraftFleet.sort((a,b) => a.name.localeCompare(b.name)).map(a => `
                    <div class="aircraft-card" data-id="${a._id}">
                        <img src="${a.imageUrl || 'Images/aircraft-placeholder.png'}" alt="${a.name}" class="aircraft-card-image">
                        <div class="aircraft-card-info">
                            <strong>${a.name}</strong>
                            <small>ICAO: ${a.icao} | Type: ${a.type}</small>
                            <small>Operator: ${a.codeshare}</small>
                            <small>Rank Unlock: ${a.rankUnlock}</small>
                        </div>
                        <div class="aircraft-card-controls">
                            <button class="aircraft-card-btn edit-btn edit-aircraft-btn" data-id="${a._id}" title="Edit Aircraft">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="aircraft-card-btn delete-btn delete-aircraft-btn" data-id="${a._id}" data-name="${a.name}" title="Delete Aircraft">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
                listEl.innerHTML = html;
            } catch (error) {
                listEl.innerHTML = `<p style="color:red">Failed to load aircraft list: ${error.message}</p>`;
            }
        };

        const handleSaveAircraft = async (e) => {
            e.preventDefault();
            const editId = editIdInput.value;
            const isEditing = !!editId;

            const formData = new FormData();
            formData.append('name', nameInput.value.trim());
            formData.append('icao', icaoInput.value.trim().toUpperCase());
            formData.append('type', typeSelect.value);
            formData.append('rankUnlock', rankSelect.value);
            formData.append('codeshare', codeshareSelect.value);
            
            const file = imageFileInput.files[0];
            if (file) {
                formData.append('aircraftImage', file);
            } else if (imageUrlInput.value.trim()) {
                 formData.append('imageUrl', imageUrlInput.value.trim());
            }

            if (!formData.get('name') || !formData.get('icao')) {
                showNotification('Please fill in at least Name and ICAO.', 'error');
                return;
            }

            try {
                const url = isEditing ? `${API_BASE_URL}/api/aircrafts/${editId}` : `${API_BASE_URL}/api/aircrafts`;
                const method = isEditing ? 'PUT' : 'POST';

                await safeFetch(url, { method, body: formData });
                
                showNotification(`Aircraft ${isEditing ? 'updated' : 'saved'} successfully!`, 'success');
                closeAircraftModal();
                await renderAircraftList(); // Refresh list with new data

            } catch (error) {
                showNotification(`Failed to save aircraft: ${error.message}`, 'error');
            }
        };

        // --- EVENT LISTENERS ---
        document.getElementById('add-new-aircraft-btn').addEventListener('click', () => openAircraftModal());

        container.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-aircraft-btn');
            const editBtn = e.target.closest('.edit-aircraft-btn');

            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                const name = deleteBtn.dataset.name;
                if (confirm(`Are you sure you want to delete the aircraft "${name}"? This action cannot be undone.`)) {
                    try {
                        await safeFetch(`${API_BASE_URL}/api/aircrafts/${id}`, { method: 'DELETE' });
                        showNotification('Aircraft deleted.', 'success');
                        await renderAircraftList(); // Refresh the list
                    } catch (error) {
                        showNotification(`Error deleting aircraft: ${error.message}`, 'error');
                    }
                }
            }
            if (editBtn) {
                const id = editBtn.dataset.id;
                const aircraftToEdit = aircraftFleet.find(ac => ac._id === id);
                if (aircraftToEdit) {
                    openAircraftModal(aircraftToEdit);
                }
            }
        });

        // Modal-specific event listeners
        modalForm.addEventListener('submit', handleSaveAircraft);
        modalCloseBtn.addEventListener('click', closeAircraftModal);
        modalCancelBtn.addEventListener('click', closeAircraftModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { // Close if clicking on the overlay
                closeAircraftModal();
            }
        });

        // --- INITIAL DATA LOAD ---
        // Populate dropdowns in the modal
        rankSelect.innerHTML = pilotRanks.map(r => `<option value="${r}">${r}</option>`).join('');
        const partners = (codesharePartners.length > 0) ? codesharePartners : await safeFetch(`${API_BASE_URL}/api/codeshares`);
        const operators = [{ name: 'IndGo Air Virtual' }, ...partners];
        codeshareSelect.innerHTML = operators.map(p => `<option value="${p.name}">${p.name}</option>`).join('');

        // Render the initial list
        await renderAircraftList();
    }
    // =========================================================
    // END: AIRCRAFT MANAGER SECTION
    // =========================================================


    // --- TAB SWITCHING LOGIC ---
    function attachTabListeners() {
        const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
        const contentCards = document.querySelectorAll('.main-content .content-card');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();

                if (link.classList.contains('active')) return;

                navLinks.forEach(item => item.classList.remove('active'));
                contentCards.forEach(content => content.classList.remove('active'));

                link.classList.add('active');
                const viewId = link.dataset.view;
                const target = document.getElementById(viewId);
                if (target) {
                    target.classList.add('active');
                }
            });
        });
    }

    // --- SIDEBAR CATEGORY (ACCORDION) LOGIC ---
    function attachCategoryListeners() {
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (!sidebarNav) return;

        sidebarNav.addEventListener('click', (e) => {
            const header = e.target.closest('.nav-category-header');
            if (!header) return;

            if (dashboardContainer.classList.contains('sidebar-collapsed')) {
                e.preventDefault();
                return;
            }

            e.preventDefault();
            const parentCategory = header.parentElement;
            const currentlyOpen = sidebarNav.querySelector('.nav-category.category-open');

            if (currentlyOpen && currentlyOpen !== parentCategory) {
                currentlyOpen.classList.remove('category-open');
            }

            parentCategory.classList.toggle('category-open');
        });
    }

    // --- ADMIN: POPULATE USERS & LOGS ---
    async function populateAdminTools() {
        try {
            const [users, logs] = await Promise.all([
                safeFetch(`${API_BASE_URL}/api/users`),
                safeFetch(`${API_BASE_URL}/api/logs`)
            ]);
            renderUserList(users);
            renderLiveOperations(users);
            renderLogList(logs);
        } catch (error) {
            console.error('Failed to populate admin tools:', error);
            if (userListContainer) userListContainer.innerHTML = '<p style="color: red;">Could not load users.</p>';
            if (logContainer) logContainer.innerHTML = '<p style="color: red;">Could not load logs.</p>';
        }
    }

    // --- ADMIN: INVITATION MANAGEMENT ---
    async function populateInvites() {
        if (!inviteListContainer) return;
        try {
            const invites = await safeFetch(`${API_BASE_URL}/api/invites`);
            renderInviteList(invites);
        } catch (error) {
            console.error('Failed to load invites:', error);
            if (inviteListContainer) inviteListContainer.innerHTML = `<p style="color:red;">Could not load invites: ${error.message}</p>`;
        }
    }



function createInviteCardElement(invite) {
    const card = document.createElement('div');
    card.className = 'user-manage-card';
    card.setAttribute('data-inviteid', invite._id);

    // --- START: MODIFICATION ---
    // Define the base URL of your registration page.
    // IMPORTANT: Make sure this URL is correct for your live website.
    const registrationUrl = `https://indgo-va.netlify.app/register.html?invite=${invite.code}`;

    let statusHtml;
    switch (invite.status) {
        case 'PENDING':
            statusHtml = `Status: <span style="color: var(--warning-color);">Pending</span>`;
            break;
        case 'ACCEPTED':
            statusHtml = `Status: <span style="color: var(--success-color);">Accepted</span> by ${invite.usedBy?.name || 'N/A'}`;
            break;
        case 'EXPIRED':
            statusHtml = `Status: <span style="color: var(--dashboard-text-muted);">Expired</span>`;
            break;
        default:
            statusHtml = `Status: ${invite.status}`;
    }

    // Updated card layout with a "Copy Link" button
    card.innerHTML = `
        <div class="user-info">
            <strong>Invite Code: <code>${invite.code}</code></strong>
            <small>Expires: ${new Date(invite.expiresAt).toLocaleString()}</small>
            <div><small>${statusHtml}</small></div>
        </div>
        <div class="user-controls" style="flex-direction: column; align-items: flex-end; gap: 8px;">
            <button class="cta-button copy-invite-link-btn" data-link="${registrationUrl}" ${invite.status !== 'PENDING' ? 'disabled' : ''}>
                <i class="fas fa-copy"></i> Copy Link
            </button>
            <button class="delete-user-btn delete-invite-btn" data-id="${invite._id}" ${invite.status !== 'PENDING' ? 'disabled' : ''}>
                <i class="fas fa-trash-alt"></i> Delete Code
            </button>
        </div>
    `;

    // Add event listener for the new "Copy Link" button
    const copyBtn = card.querySelector('.copy-invite-link-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
            const linkToCopy = e.currentTarget.dataset.link;
            navigator.clipboard.writeText(linkToCopy).then(() => {
                showNotification('Registration link copied to clipboard!', 'success');
            }).catch(err => {
                showNotification('Failed to copy link.', 'error');
                console.error('Copy failed', err);
            });
        });
    }
    // --- END: MODIFICATION ---

    return card;
}

    function renderInviteList(invites) {
        renderList(inviteListContainer, invites, createInviteCardElement, 'No invite codes have been created yet.');
    }

    const createRoleOptions = (selectedRole) => {
        let optionsHtml = '';
        for (const group in allRoles) {
            optionsHtml += `<optgroup label="${group}">`;
            allRoles[group].forEach(role => {
                const selected = role === selectedRole ? 'selected' : '';
                optionsHtml += `<option value="${role}" ${selected}>${role}</option>`;
            });
            optionsHtml += `</optgroup>`;
        }
        return optionsHtml;
    };

    function createUserCardElement(user) {
        const isCurrentUser = user._id === currentUserId;
        const controlsDisabled = isCurrentUser ? 'disabled' : '';

        const card = document.createElement('div');
        card.className = 'user-manage-card';
        card.setAttribute('data-userid', user._id);

        const statusBadge = user.promotionStatus === 'PENDING_TEST' ?
            '<span class="status-badge warning">Pending Test</span>' :
            '';

        card.innerHTML = `
            <div class="user-info">
                <strong>${user.name}</strong> ${statusBadge}
                <small>${user.email}</small>
                <div><small>Rank: ${user.rank || '—'} • Hours: ${user.flightHours?.toFixed(1) ?? 0}</small></div>
            </div>
            <div class="user-controls">
                <label style="display:block;font-size:0.8rem;margin-bottom:6px;">
                    Callsign:
                    <input type="text" class="callsign-input" data-userid="${user._id}" value="${user.callsign || ''}" ${isCurrentUser ? 'readonly' : ''} placeholder="e.g. INDGO-01" style="margin-left:6px"/>
                    <button type="button" class="set-callsign-btn" data-userid="${user._id}" ${controlsDisabled}>Set</button>
                </label>
                <select class="role-select" data-userid="${user._id}" ${controlsDisabled}>
                    ${createRoleOptions(user.role)}
                </select>
                <button type="button" class="ftpl-toggle-btn" data-userid="${user._id}" data-exempt="${user.isFtplExempt || false}" ${controlsDisabled}>
                    ${user.isFtplExempt ? 'FTPL: Exempt' : 'FTPL: Active'}
                </button>
                <button type="button" class="delete-user-btn" data-userid="${user._id}" data-username="${user.name}" ${controlsDisabled}>
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>
        `;
        return card;
    }

    function renderUserList(users) {
        renderList(userListContainer, users, createUserCardElement, 'No users found.');
    }

    function createLogEntryElement(log) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
            <p><strong>Action:</strong> ${log.action.replace(/_/g, ' ')}</p>
            <p><strong>Admin:</strong> ${log.adminUser?.name || 'Unknown'} (${log.adminUser?.email || '—'})</p>
            <p><strong>Details:</strong> ${log.details}</p>
            <small>${new Date(log.timestamp).toLocaleString()}</small>
        `;
        return entry;
    }

    function renderLogList(logs) {
        renderList(logContainer, logs.slice(0, 50), createLogEntryElement, 'No administrative actions have been logged yet.');
    }

    function renderLiveOperations(users) {
        const container = document.getElementById('live-ops-container');
        if (!container) return;

        const onDutyPilots = users.filter(u => u.dutyStatus === 'ON_DUTY');
        if (onDutyPilots.length === 0) {
            container.innerHTML = '<p>No pilots are currently on duty.</p>';
            return;
        }

        safeFetch(`${API_BASE_URL}/api/rosters?all=true`).then(rosters => {
            const rosterMap = new Map(rosters.map(r => [r._id.toString(), r.name]));
            const renderer = pilot => {
                const item = document.createElement('div');
                item.className = 'live-ops-item';
                item.style.cssText = 'padding: 0.5rem; border-bottom: 1px solid var(--border-color);';
                item.innerHTML = `
                    <strong>${pilot.name} (${pilot.callsign || 'N/A'})</strong> is ON DUTY.
                    <small style="display: block; color: var(--dashboard-text-muted);">Roster: ${rosterMap.get(pilot.currentRoster) || 'Unknown Roster'}</small>
                `;
                return item;
            };
            renderList(container, onDutyPilots, renderer, 'No pilots are currently on duty.');
        }).catch(err => {
            container.innerHTML = '<p style="color: red;">Could not load roster data for live ops.</p>';
        });
    }

    // --- COMMUNITY: EVENTS & HIGHLIGHTS ---
    async function populateCommunityManagement() {
        if (!manageEventsContainer || !manageHighlightsContainer) return;
        try {
            const [events, highlights] = await Promise.all([
                safeFetch(`${API_BASE_URL}/api/events`),
                safeFetch(`${API_BASE_URL}/api/highlights`)
            ]);

            renderManagementList(events, manageEventsContainer, 'event');
            renderManagementList(highlights, manageHighlightsContainer, 'highlight');
        } catch (error) {
            console.error('Failed to populate community management lists:', error);
            if (manageEventsContainer) manageEventsContainer.innerHTML = '<p style="color:red;">Could not load events.</p>';
            if (manageHighlightsContainer) manageHighlightsContainer.innerHTML = '<p style="color:red;">Could not load highlights.</p>';
        }
    }

    function createManagementItemElement(item, type) {
        const card = document.createElement('div');
        card.className = 'user-manage-card';
        card.setAttribute('data-item-id', item._id);
        card.innerHTML = `
            <div class="user-info">
                <strong>${item.title}</strong>
                <small>${type === 'event' ? new Date(item.date).toLocaleDateString() : `Winner: ${item.winnerName}`}</small>
            </div>
            <div class="user-controls">
                <button type="button" class="delete-user-btn" data-id="${item._id}" data-type="${type}" data-title="${item.title}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>
        `;
        return card;
    }

    function renderManagementList(items, container, type) {
        const renderer = (item) => createManagementItemElement(item, type);
        renderList(container, items, renderer, `No ${type}s found.`);
    }

    // --- PILOT DATABASE & MANAGEMENT ---
    async function populatePilotDatabase() {
        const container = document.getElementById('pilot-db-container');
        if (!container) return;
        try {
            const users = await safeFetch(`${API_BASE_URL}/api/users`);
            const pilots = (users || []).filter(u => u.role === 'pilot' || Boolean(u.callsign));

            const renderer = (p) => {
                const card = document.createElement('div');
                card.className = 'user-manage-card';
                card.setAttribute('data-userid', p._id);
                card.innerHTML = `
                    <div class="user-info">
                        <strong>${p.name}</strong> <small>(${p.email})</small><br/>
                        <small>Rank: ${p.rank || '—'} • Hours: ${p.flightHours?.toFixed(1) ?? 0}</small>
                    </div>
                    <div class="user-controls">
                        <label>Callsign:
                            <input class="pilot-callsign-input" data-userid="${p._id}" value="${p.callsign || ''}" placeholder="e.g. INDGO-01" />
                        </label>
                        <button class="pilot-set-callsign-btn" data-userid="${p._id}">Update</button>
                    </div>
                `;
                return card;
            };

            renderList(container, pilots, renderer, 'No pilots found.');

        } catch (error) {
            console.error('Failed to load pilot database:', error);
            if (container) container.innerHTML = `<p style="color:red;">Could not load pilots: ${error.message}</p>`;
        }
    }

    async function populatePilotManagement() {
        if (!pilotManagementContainer) return;
        try {
            const users = await safeFetch(`${API_BASE_URL}/api/users`);
            const pilots = users.filter(u => u.role === 'pilot');
            renderPilotList(pilots);
        } catch (error) {
            pilotManagementContainer.innerHTML = `<p style="color:red;">Could not load pilot roster: ${error.message}</p>`;
        }
    }

    function renderPilotList(pilots) {
        const createRankOptions = (currentRank) => {
            return pilotRanks.map(rank =>
                `<option value="${rank}" ${rank === currentRank ? 'selected' : ''}>${rank}</option>`
            ).join('');
        };

        const renderer = (pilot) => {
            const card = document.createElement('div');
            card.className = 'user-manage-card';
            card.setAttribute('data-userid', pilot._id);

            const statusBadge = pilot.promotionStatus === 'PENDING_TEST' ?
                '<span class="status-badge warning">Pending Test</span>' :
                '';

            card.innerHTML = `
                <div class="user-info">
                    <strong>${pilot.name}</strong> (${pilot.callsign || 'No Callsign'}) ${statusBadge}
                    <small>${pilot.email}</small>
                </div>
                <div class="user-controls">
                    <label>
                        Rank:
                        <select class="rank-select" data-userid="${pilot._id}">
                            ${createRankOptions(pilot.rank)}
                        </select>
                    </label>
                </div>
            `;
            return card;
        };

        renderList(pilotManagementContainer, pilots, renderer, 'No pilots found in the roster.');
    }

    // --- CROPPER LOGIC ---
    if (pictureInput) {
        pictureInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                const reader = new FileReader();
                reader.onload = () => {
                    if (imageToCrop) imageToCrop.src = reader.result;
                    if (cropperModal) cropperModal.style.display = 'flex';
                    if (cropper) cropper.destroy();
                    if (imageToCrop) {
                        cropper = new Cropper(imageToCrop, {
                            aspectRatio: 1 / 1,
                            viewMode: 1,
                            background: false,
                        });
                    }
                };
                reader.readAsDataURL(files[0]);
            }
        });
    }

    if (cancelCropBtn) {
        cancelCropBtn.addEventListener('click', () => {
            if (cropperModal) cropperModal.style.display = 'none';
            if (cropper) cropper.destroy();
            if (pictureInput) pictureInput.value = '';
        });
    }

    if (cropAndSaveBtn) {
        cropAndSaveBtn.addEventListener('click', () => {
            if (cropper) {
                cropper.getCroppedCanvas({
                    width: 250,
                    height: 250
                }).toBlob((blob) => {
                    croppedImageBlob = blob;
                    const previewUrl = URL.createObjectURL(blob);
                    if (profilePictureElem) profilePictureElem.src = previewUrl;
                    if (cropperModal) cropperModal.style.display = 'none';
                    cropper.destroy();
                    if (pictureInput) pictureInput.value = '';
                    showNotification('Picture ready to be saved.', 'info');
                }, 'image/jpeg');
            }
        });
    }

    // --- PROFILE UPDATE ---
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('name', document.getElementById('profile-name').value);
            formData.append('bio', document.getElementById('profile-bio').value || '');
            formData.append('infiniteFlightUsername', document.getElementById('profile-infinite-flight-username').value || '');
            formData.append('ifc', document.getElementById('profile-ifc').value || '');
            formData.append('youtube', document.getElementById('profile-youtube').value || '');
            formData.append('preferredContact', document.getElementById('profile-preferred').value || 'none');

            if (croppedImageBlob) {
                formData.append('profilePicture', croppedImageBlob, 'profile.jpg');
            }

            try {
                const result = await safeFetch(`${API_BASE_URL}/api/me`, {
                    method: 'PUT',
                    body: formData
                });
                showNotification('Profile updated successfully!', 'success');
                if (result.token) localStorage.setItem('authToken', result.token);
                const user = result.user;
                if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${user.name}!`;

                if (pilotNameElem) pilotNameElem.textContent = user.name;
                if (user.imageUrl && profilePictureElem) {
                    profilePictureElem.src = `${user.imageUrl}?${new Date().getTime()}`;
                }
                croppedImageBlob = null;
            } catch (error) {
                showNotification(`Update failed: ${error.message}`, 'error');
            }
        });
    }

    // --- PASSWORD UPDATE ---
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (newPassword !== confirmPassword) {
                showNotification('New passwords do not match.', 'error');
                return;
            }

            try {
                await safeFetch(`${API_BASE_URL}/api/me/password`, {
                    method: 'POST',
                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                });
                showNotification('Password updated successfully!', 'success');
                passwordForm.reset();
            } catch (error) {
                showNotification(`Password update failed: ${error.message}`, 'error');
            }
        });
    }

    // --- ADD MEMBER (ADMIN) ---
    if (addMemberForm) {
        addMemberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-member-name').value;
            const email = document.getElementById('new-member-email').value;
            const password = document.getElementById('new-member-password').value;
            const role = document.getElementById('new-member-role').value;
            const callsignInput = document.getElementById('new-member-callsign');
            let callsign = callsignInput ? callsignInput.value.trim().toUpperCase() : null;
            if (callsign === '') callsign = null;

            try {
                const newUser = await safeFetch(`${API_BASE_URL}/api/users`, {
                    method: 'POST',
                    body: JSON.stringify({
                        name,
                        email,
                        password,
                        role,
                        callsign
                    })
                });
                showNotification('User created successfully!', 'success');
                addMemberForm.reset();

                const newUserCard = createUserCardElement(newUser);
                userListContainer.prepend(newUserCard);

            } catch (error) {
                showNotification(`Failed to create user: ${error.message}`, 'error');
            }
        });
    }

    // --- EVENT DELEGATION: ADMIN ACTIONS ---
    const adminTabContent = document.getElementById('tab-admin');
    if (adminTabContent) {
        adminTabContent.addEventListener('click', async (e) => {
            const target = e.target;
            const deleteUserBtn = target.closest('.delete-user-btn:not(.delete-invite-btn)');
            const ftplBtn = target.closest('.ftpl-toggle-btn');
            const setCsBtn = target.closest('.set-callsign-btn');
            const createInviteBtn = target.closest('#create-invite-btn');
            const deleteInviteBtn = target.closest('.delete-invite-btn');

            if (deleteUserBtn) {
                e.preventDefault();
                const userId = deleteUserBtn.dataset.userid;
                const userName = deleteUserBtn.dataset.username;
                if (!userId || !confirm(`WARNING: Are you sure you want to delete ${userName}? This action cannot be undone.`)) return;

                try {
                    await safeFetch(`${API_BASE_URL}/api/users/${userId}`, {
                        method: 'DELETE'
                    });
                    showNotification('User deleted successfully.', 'success');
                    deleteUserBtn.closest('.user-manage-card').remove();
                } catch (error) {
                    showNotification(`Failed to delete user: ${error.message}`, 'error');
                }
            }

            if (ftplBtn) {
                e.preventDefault();
                const userId = ftplBtn.dataset.userid;
                if (!userId || !confirm('Are you sure you want to change the FTPL status for this user?')) return;

                try {
                    const result = await safeFetch(`${API_BASE_URL}/api/users/${userId}/toggle-ftpl`, {
                        method: 'PUT'
                    });
                    showNotification(result.message, 'success');
                    ftplBtn.dataset.exempt = result.isFtplExempt;
                    ftplBtn.textContent = `FTPL: ${result.isFtplExempt ? 'Exempt' : 'Active'}`;
                } catch (error) {
                    showNotification(`Failed to toggle FTPL: ${error.message}`, 'error');
                }
            }

            if (setCsBtn) {
                e.preventDefault();
                const userId = setCsBtn.dataset.userid;
                const input = document.querySelector(`.callsign-input[data-userid="${userId}"]`);
                if (!input) return;
                let callsign = input.value.trim().toUpperCase();
                if (!callsign) {
                    showNotification('Please enter a non-empty callsign to set.', 'error');
                    return;
                }
                try {
                    await safeFetch(`${API_BASE_URL}/api/users/${userId}/callsign`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            callsign
                        })
                    });
                    showNotification(`Callsign ${callsign} assigned.`, 'success');
                    if (document.getElementById('pilot-db-container')) populatePilotDatabase();
                } catch (error) {
                    showNotification(`Failed to set callsign: ${error.message}`, 'error');
                }
            }

            if (createInviteBtn) {
                e.preventDefault();
                createInviteBtn.disabled = true;
                createInviteBtn.textContent = 'Creating...';
                try {
                    await safeFetch(`${API_BASE_URL}/api/invites`, {
                        method: 'POST'
                    });
                    showNotification('New invite code created successfully!', 'success');
                    populateInvites();
                } catch (error) {
                    showNotification(`Failed to create invite: ${error.message}`, 'error');
                } finally {
                    createInviteBtn.disabled = false;
                    createInviteBtn.textContent = 'Create New Invite Code';
                }
            }

            if (deleteInviteBtn) {
                e.preventDefault();
                const inviteId = deleteInviteBtn.dataset.id;
                if (!inviteId || !confirm('Are you sure you want to delete this invite code?')) return;

                try {
                    await safeFetch(`${API_BASE_URL}/api/invites/${inviteId}`, {
                        method: 'DELETE'
                    });
                    showNotification('Invite code deleted.', 'success');
                    deleteInviteBtn.closest('.user-manage-card').remove();
                } catch (error) {
                    showNotification(`Failed to delete invite: ${error.message}`, 'error');
                }
            }
        });

        adminTabContent.addEventListener('change', async (e) => {
            if (e.target.classList.contains('role-select')) {
                const select = e.target;
                const userId = select.dataset.userid;
                const newRole = select.value;
                const originalRole = Array.from(select.options).find(opt => opt.defaultSelected)?.value || select.options[0].value;

                try {
                    await safeFetch(`${API_BASE_URL}/api/users/${userId}/role`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            newRole
                        })
                    });
                    showNotification('User role updated successfully.', 'success');
                    Array.from(select.options).forEach(opt => opt.defaultSelected = false);
                    select.querySelector(`option[value="${newRole}"]`).defaultSelected = true;

                } catch (error) {
                    showNotification(`Failed to update role: ${error.message}`, 'error');
                    select.value = originalRole;
                }
            }
        });
    }

    // --- EVENT DELEGATION: COMMUNITY DELETION ---
    const communityTabContent = document.getElementById('tab-community');
    if (communityTabContent) {
        communityTabContent.addEventListener('click', async (e) => {
            const button = e.target.closest('.delete-user-btn[data-type]');
            if (!button) return;
            e.preventDefault();
            const postId = button.dataset.id;
            const postType = button.dataset.type;
            const postTitle = button.dataset.title;
            if (!confirm(`Are you sure you want to delete the ${postType}: "${postTitle}"?`)) return;
            try {
                await safeFetch(`${API_BASE_URL}/api/${postType}s/${postId}`, {
                    method: 'DELETE'
                });
                const successMessage = `${postType.charAt(0).toUpperCase() + postType.slice(1)} deleted successfully.`;
                showNotification(successMessage, 'success');
                button.closest('.user-manage-card').remove();
            } catch (error) {
                showNotification(`Failed to delete ${postType}: ${error.message}`, 'error');
            }
        });
    }

    // --- EVENT DELEGATION: PILOT MANAGEMENT ---
    if (pilotManagementContainer) {
        pilotManagementContainer.addEventListener('change', async (e) => {
            if (e.target.classList.contains('rank-select')) {
                const selectElement = e.target;
                const userId = selectElement.dataset.userid;
                const newRank = selectElement.value;
                const originalRank = Array.from(selectElement.options).find(opt => opt.defaultSelected)?.value;

                if (!confirm(`Are you sure you want to change this pilot's rank to ${newRank}? This is irreversible and will complete their promotion test if they are pending one.`)) {
                    selectElement.value = originalRank;
                    return;
                }
                try {
                    await safeFetch(`${API_BASE_URL}/api/users/${userId}/rank`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            newRank
                        })
                    });
                    showNotification('Pilot rank updated successfully!', 'success');
                    populatePilotManagement();
                    fetchUserData();
                } catch (error) {
                    showNotification(`Failed to update rank: ${error.message}`, 'error');
                    selectElement.value = originalRank;
                }
            }
        });
    }

    // --- BODY-WIDE EVENT LISTENER FOR DYNAMICALLY CREATED BUTTONS ---
    document.body.addEventListener('click', async (e) => {
        // --- START: NEW DISCORD LINKING EVENT HANDLER ---
        const linkDiscordBtn = e.target.closest('#link-discord-btn');
        if (linkDiscordBtn) {
            e.preventDefault();
            if (linkDiscordBtn.classList.contains('unlink-btn')) {
                // Handle Unlink
                if (confirm('Are you sure you want to unlink your Discord account?')) {
                    try {
                        await safeFetch(`${API_BASE_URL}/api/me/links/discord`, {
                            method: 'DELETE'
                        });
                        showNotification('Discord account unlinked successfully.', 'success');
                        fetchUserData(); // Refresh user data to update the UI
                    } catch (error) {
                        showNotification(`Failed to unlink Discord: ${error.message}`, 'error');
                    }
                }
            } else {
                try {
                    // 1. Make an authenticated call to the backend using safeFetch
                    const data = await safeFetch(`${API_BASE_URL}/auth/discord/start`);

                    // 2. If we get a URL back, redirect the user's browser to it
                    if (data.redirectUrl) {
                        window.location.href = data.redirectUrl;
                    } else {
                        showNotification('Could not start Discord linking process.', 'error');
                    }
                } catch (error) {
                    showNotification(`Error: ${error.message}`, 'error');
                }
            }
        }
        // --- END: NEW DISCORD LINKING EVENT HANDLER ---


        const pilotSetCsBtn = e.target.closest('.pilot-set-callsign-btn');
        if (pilotSetCsBtn) {
            const userId = pilotSetCsBtn.dataset.userid;
            const input = document.querySelector(`.pilot-callsign-input[data-userid="${userId}"]`);
            if (!input) return;
            const callsign = input.value.trim().toUpperCase();
            if (!callsign) {
                showNotification('Please enter a callsign before updating.', 'error');
                return;
            }
            try {
                await safeFetch(`${API_BASE_URL}/api/users/${userId}/callsign`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        callsign
                    })
                });
                showNotification('Callsign updated successfully.', 'success');
                if (document.getElementById('tab-admin')) populateAdminTools();
            } catch (error) {
                showNotification(`Failed to update callsign: ${error.message}`, 'error');
            }
        }
    });

    // --- COMMUNITY CONTENT FORMS (CREATE) ---
    const createEventForm = document.getElementById('create-event-form');
    if (createEventForm) {
        createEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(createEventForm);
            try {
                await safeFetch(`${API_BASE_URL}/api/events`, {
                    method: 'POST',
                    body: formData
                });
                showNotification('Event posted successfully!', 'success');
                createEventForm.reset();
                populateCommunityManagement();
            } catch (error) {
                showNotification(`Failed to post event: ${error.message}`, 'error');
            }
        });
    }

    const createHighlightForm = document.getElementById('create-highlight-form');
    if (createHighlightForm) {
        createHighlightForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(createHighlightForm);
            try {
                await safeFetch(`${API_BASE_URL}/api/highlights`, {
                    method: 'POST',
                    body: formData
                });
                showNotification('Highlight posted successfully!', 'success');
                createHighlightForm.reset();
                populateCommunityManagement();
            } catch (error) {
                showNotification(`Failed to post highlight: ${error.message}`, 'error');
            }
        });
    }

    // --- LOGOUT ---
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            window.location.href = 'index.html';
        });
    }

    // --- INITIALIZATION ---
    attachTabListeners();
    attachCategoryListeners();
    fetchUserData();
});