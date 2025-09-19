// dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://indgo-backend.onrender.com';

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
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');


    // --- TAB LINKS ---
    const adminTabLink = document.getElementById('admin-tab-link');
    const communityTabLink = document.getElementById('community-tab-link');
    const pilotManagementTabLink = document.getElementById('pilot-management-tab-link');
    const pirepTabLink = document.getElementById('pirep-tab-link');
    const rosterTabLink = document.getElementById('roster-tab-link');
    const pilotTabLink = document.getElementById('pilot-tab-link');

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

    // --- NEW: NOTIFICATION ELEMENTS ---
    const notificationBell = document.getElementById('notification-bell');
    const notificationBadge = document.getElementById('notification-badge');
    const notificationPanel = document.getElementById('notification-panel');
    const notificationList = document.getElementById('notification-list');
    let unreadNotifications = [];

    // --- APP STATE & CONFIG ---
    const token = localStorage.getItem('authToken');
    let currentUserId = null;
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

    // --- SIDEBAR TOGGLE LOGIC ---
    if (sidebarToggleBtn && dashboardContainer) {
        const sidebarState = localStorage.getItem('sidebarState');
        if (sidebarState === 'collapsed') {
            dashboardContainer.classList.add('sidebar-collapsed');
        }
        sidebarToggleBtn.addEventListener('click', () => {
            dashboardContainer.classList.toggle('sidebar-collapsed');
            if (dashboardContainer.classList.contains('sidebar-collapsed')) {
                localStorage.setItem('sidebarState', 'collapsed');
            } else {
                localStorage.setItem('sidebarState', 'expanded');
            }
        });
    }

    // --- SAFE FETCH WRAPPER ---
    async function safeFetch(url, options = {}) {
        options.headers = options.headers || {};
        if (!options.headers.Authorization && token) {
            options.headers.Authorization = `Bearer ${token}`;
        }

        if (!(options.body instanceof FormData) && !options.headers['Content-Type']) {
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
                message: text
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
        // These functions are called without 'await' to run in the background.
        // They will fetch data and render it when ready, replacing the skeletons.
        if (adminTabLink && adminTabLink.style.display !== 'none') {
            populateAdminTools();
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
    }


    // --- FETCH USER DATA & SETUP UI ---
    async function fetchUserData() {
        try {
            const user = await safeFetch(`${API_BASE_URL}/api/me`);
            currentUserId = user._id;

            if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${user.name || 'Pilot'}!`;

            if (pilotNameElem) pilotNameElem.textContent = user.name;
            if (pilotCallsignElem) pilotCallsignElem.textContent = user.role ? user.role.toUpperCase() : 'USER';
            if (profilePictureElem) profilePictureElem.src = user.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff&size=120`;

            // Populate form fields
            document.getElementById('profile-name').value = user.name;
            document.getElementById('profile-bio').value = user.bio || '';
            document.getElementById('profile-simbrief-userid').value = user.simbriefUserId || '';
            document.getElementById('profile-discord').value = user.discord || '';
            document.getElementById('profile-ifc').value = user.ifc || '';
            document.getElementById('profile-youtube').value = user.youtube || '';
            document.getElementById('profile-preferred').value = user.preferredContact || 'none';

            // --- NEW: Handle notifications from backend ---
            if (user.unreadNotifications && user.unreadNotifications.length > 0) {
                unreadNotifications = user.unreadNotifications;
                updateNotificationUI();
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
            }
            
            // *** NEW: Start pre-loading all necessary data after UI is ready ***
            preloadDashboardData();

        } catch (error) {
            console.error('Error fetching user data:', error);
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        }
    }
    
    // --- PERFORMANCE OPTIMIZATION: Generic function to render lists efficiently ---
    function renderList(container, items, itemRenderer, emptyMessage) {
        if (!container) return;
        container.innerHTML = ''; // Clear previous content (including skeletons)

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

    // --- NEW: NOTIFICATION HANDLING ---
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

            // If panel is opened and there are unread notifications, mark them as read
            if (notificationPanel.classList.contains('active') && unreadNotifications.length > 0) {
                const idsToMarkRead = unreadNotifications.map(n => n._id);
                try {
                    await safeFetch(`${API_BASE_URL}/api/me/notifications/read`, {
                        method: 'POST',
                        body: JSON.stringify({ notificationIds: idsToMarkRead })
                    });
                    unreadNotifications = [];
                    // Delay hiding the badge for a better user experience
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

        const verificationLinkHtml = p.verificationImageUrl
            ? `<p><strong>Verification:</strong> <a href="${p.verificationImageUrl}" target="_blank" class="view-image-btn">View Submitted Image</a></p>`
            : '<p><strong>Verification:</strong> No image submitted.</p>';

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
                <p><small>Filed on: ${new Date(p.createdAt).toLocaleString()}</small></p>
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
                
                // **UPDATED**: Get corrected flight time from input
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

                    // The backend now sends a more detailed message, including potential HTML for promotions
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
            const url = fetchAll 
                ? `${API_BASE_URL}/api/rosters?all=true`
                : `${API_BASE_URL}/api/rosters`;
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
                
                // Data is now pre-loaded, so we no longer need the
                // conditional fetching logic here.
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

            // ---- FIX: PREVENT ACCORDION FROM WORKING WHEN SIDEBAR IS COLLAPSED ----
            if (dashboardContainer.classList.contains('sidebar-collapsed')) {
                e.preventDefault();
                return;
            }

            e.preventDefault();
            const parentCategory = header.parentElement;
            const currentlyOpen = sidebarNav.querySelector('.nav-category.category-open');

            // If there is an open category and it's not the one we clicked, close it
            if (currentlyOpen && currentlyOpen !== parentCategory) {
                currentlyOpen.classList.remove('category-open');
            }

            // Toggle the clicked category
            parentCategory.classList.toggle('category-open');
        });
    }

    // --- ADMIN: POPULATE USERS & LOGS (OPTIMIZED) ---
    async function populateAdminTools() {
        try {
            // OPTIMIZED: Start both network requests in parallel
            const [users, logs] = await Promise.all([
                safeFetch(`${API_BASE_URL}/api/users`),
                safeFetch(`${API_BASE_URL}/api/logs`)
            ]);

            // Now that both have finished, render the results
            renderUserList(users);
            renderLiveOperations(users);
            renderLogList(logs);
        } catch (error)
        {
            console.error('Failed to populate admin tools:', error);
            if (userListContainer) userListContainer.innerHTML = '<p style="color: red;">Could not load users.</p>';
            if (logContainer) logContainer.innerHTML = '<p style="color: red;">Could not load logs.</p>';
        }
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
        
        // **UPDATED**: Add FTPL toggle button
        const ftplButtonText = user.isFtplExempt ? 'Enable FTPL' : 'Disable FTPL';

        card.innerHTML = `
            <div class="user-info">
                <strong>${user.name}</strong>
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
        // NOTE: The backend /api/users endpoint needs to be updated to return the 'isFtplExempt' field for each user
        // for the FTPL toggle button to display the correct initial state. Assuming it does for this implementation.
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

        safeFetch(`${API_BASE_URL}/api/rosters`).then(rosters => {
            const rosterMap = new Map(rosters.map(r => [r._id.toString(), r.name]));
            container.innerHTML = onDutyPilots.map(pilot => `
                <div class="live-ops-item" style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <strong>${pilot.name} (${pilot.callsign || 'N/A'})</strong> is ON DUTY.
                    <small style="display: block; color: var(--dashboard-text-muted);">Roster: ${rosterMap.get(pilot.currentRoster) || 'N/A'}</small>
                </div>
            `).join('');
        }).catch(err => {
            container.innerHTML = '<p style="color: red;">Could not load roster data for live ops.</p>';
        });
    }

    // --- COMMUNITY: EVENTS & HIGHLIGHTS ---
    async function populateCommunityManagement() {
        if (!manageEventsContainer || !manageHighlightsContainer) return;
        try {
            // Run in parallel for speed
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
            // UPDATED: Fetch all users to get promotionStatus
            const users = await safeFetch(`${API_BASE_URL}/api/users`);
            const pilots = users.filter(u => u.role === 'pilot');
            renderPilotList(pilots);
        } catch (error) {
            pilotManagementContainer.innerHTML = `<p style="color:red;">Could not load pilot roster: ${error.message}</p>`;
        }
    }

    // **UPDATED**: renderPilotList to show promotion status
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

             // **NEW**: Add a badge if pilot is pending a test
             const statusBadge = pilot.promotionStatus === 'PENDING_TEST'
                ? '<span class="status-badge warning">Pending Test</span>'
                : '';

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
            formData.append('simbriefUserId', document.getElementById('profile-simbrief-userid').value || '');
            formData.append('discord', document.getElementById('profile-discord').value || '');
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

    // --- EVENT DELEGATION: ADMIN USER ACTIONS ---
    if (userListContainer) {
        userListContainer.addEventListener('click', async (e) => {
            const target = e.target;
            const deleteBtn = target.closest('.delete-user-btn');
            const ftplBtn = target.closest('.ftpl-toggle-btn');
            
            if (deleteBtn) {
                e.preventDefault();
                const userId = deleteBtn.dataset.userid;
                const userName = deleteBtn.dataset.username;
                if (!userId || !confirm(`WARNING: Are you sure you want to delete ${userName}? This action cannot be undone.`)) return;

                try {
                    await safeFetch(`${API_BASE_URL}/api/users/${userId}`, {
                        method: 'DELETE'
                    });
                    showNotification('User deleted successfully.', 'success');
                    deleteBtn.closest('.user-manage-card').remove();
                } catch (error) {
                    showNotification(`Failed to delete user: ${error.message}`, 'error');
                }
                return;
            }

            // **NEW**: Handle FTPL Toggle
            if (ftplBtn) {
                e.preventDefault();
                const userId = ftplBtn.dataset.userid;
                if (!userId || !confirm('Are you sure you want to change the FTPL status for this user?')) return;
                
                try {
                    const result = await safeFetch(`${API_BASE_URL}/api/users/${userId}/toggle-ftpl`, { method: 'PUT' });
                    showNotification(result.message, 'success');
                    // Update the button UI
                    ftplBtn.dataset.exempt = result.isFtplExempt;
                    ftplBtn.textContent = `FTPL: ${result.isFtplExempt ? 'Exempt' : 'Active'}`;
                } catch (error) {
                    showNotification(`Failed to toggle FTPL: ${error.message}`, 'error');
                }
                return;
            }

            const setCsBtn = target.closest('.set-callsign-btn');
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
                    // Re-populate relevant lists if they are loaded
                    if (document.getElementById('pilot-db-container')) populatePilotDatabase();
                } catch (error) {
                    showNotification(`Failed to set callsign: ${error.message}`, 'error');
                }
                return;
            }
        });

        userListContainer.addEventListener('change', async (e) => {
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

                if (!confirm(`Are you sure you want to change this pilot's rank to ${newRank}?`)) {
                    selectElement.value = originalRank; // Revert on cancel
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
                    // **UPDATED**: Refresh pilot list and admin notifications
                    populatePilotManagement(); 
                    fetchUserData();
                } catch (error) {
                    showNotification(`Failed to update rank: ${error.message}`, 'error');
                    selectElement.value = originalRank; // Revert on error
                }
            }
        });
    }

    // --- BODY-WIDE EVENT LISTENER FOR DYNAMICALLY CREATED BUTTONS ---
    document.body.addEventListener('click', async (e) => {
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
    attachCategoryListeners(); // <-- ADD THIS LINE
    fetchUserData();
});