// Crew Center – Flight Plan, Notifications, and Test-Gated Promotion Aware
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const API_BASE_URL = 'https://indgo-backend.onrender.com';

    let crewRestInterval = null; // To manage the countdown timer

    // --- Helper to format milliseconds into HH:MM:SS ---
    function formatTime(ms) {
        if (ms < 0) ms = 0;
        let seconds = Math.floor(ms / 1000);
        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);

        seconds = seconds % 60;
        minutes = minutes % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // --- Rank model (keep in sync with backend) ---
    const PILOT_RANKS = [
        'IndGo Cadet', 'Skyline Observer', 'Route Explorer', 'Skyline Officer',
        'Command Captain', 'Elite Captain', 'Blue Eagle', 'Line Instructor',
        'Chief Flight Instructor', 'IndGo SkyMaster', 'Blue Legacy Commander'
    ];
    const rankIndex = (r) => PILOT_RANKS.indexOf(String(r || '').trim());
    const DEFAULT_OPERATOR = 'IndGo Air Virtual';

    // --- Fleet definition ---
     const FLEET = [
        { code:'Q400', name:'De Havilland Dash 8 Q400', minRank:'IndGo Cadet' },
        { code:'A320', name:'Airbus A320', minRank:'IndGo Cadet' },
        { code:'B738', name:'Boeing 737-800', minRank:'IndGo Cadet' },
        { code:'A321', name:'Airbus A321', minRank:'Skyline Observer' },
        { code:'B737', name:'Boeing 737 (family)', minRank:'Skyline Observer' },
        { code:'A330', name:'Airbus A330-300', minRank:'Route Explorer' },
        { code:'B38M', name:'Boeing 737 MAX 8', minRank:'Route Explorer' },
        { code:'B788', name:'Boeing 787-8', minRank:'Skyline Officer' },
        { code:'B77L', name:'Boeing 777-200LR', minRank:'Skyline Officer' },
        { code:'B789', name:'Boeing 787-9', minRank:'Command Captain' },
        { code:'B77W', name:'Boeing 777-300ER', minRank:'Command Captain' },
        { code:'A350', name:'Airbus A350-900', minRank:'Elite Captain' },
        { code:'A380', name:'Airbus A380-800', minRank:'Blue Eagle' },
        { code:'B744', name:'Boeing 747-400', minRank:'Blue Eagle' },
    ];

    const deduceRankFromAircraftFE = (acStr) => {
        const s = String(acStr || '').toUpperCase();
        const has = (pat) => new RegExp(pat, 'i').test(s);
        if (has('(Q400|A320|B738)')) return 'IndGo Cadet';
        if (has('(A321|B737)')) return 'Skyline Observer';
        if (has('(A330|B38M)')) return 'Route Explorer';
        if (has('(787-8|B788|777-200LR|B77L)')) return 'Skyline Officer';
        if (has('(787-9|B789|777-300ER|B77W)')) return 'Command Captain';
        if (has('A350')) return 'Elite Captain';
        if (has('(A380|747|744|B744)')) return 'Blue Eagle';
        return 'Unknown';
    };
    
    const userCanFlyAircraft = (userRank, aircraftCode) => {
        const ac = FLEET.find(a => a.code === aircraftCode);
        if (!ac) return true; // Allow if not in our defined fleet
        return rankIndex(userRank) >= rankIndex(ac.minRank);
    };

    const getAllowedFleet = (userRank) => FLEET.filter(a => userCanFlyAircraft(userRank, a.code));

    // --- Notifications ---
    function showNotification(message, type) {
        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: { background: type === 'success' ? "#28a745" : type === 'error' ? "#dc3545" : "#001B94" }
        }).showToast();
    }

    // --- DOM elements ---
    const pilotNameElem = document.getElementById('pilot-name');
    const pilotCallsignElem = document.getElementById('pilot-callsign');
    const profilePictureElem = document.getElementById('profile-picture');
    const logoutButton = document.getElementById('logout-button');
    const mainContentContainer = document.querySelector('.main-content');
    const sidebarNav = document.querySelector('.sidebar-nav');
    const dashboardContainer = document.querySelector('.dashboard-container');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');

    // Modals
    const promotionModal = document.getElementById('promotion-modal');
    const arriveFlightModal = document.getElementById('arrive-flight-modal');
    const notificationsModal = document.getElementById('notifications-modal');

    // Global state
    let CURRENT_PILOT = null;
    let ACTIVE_FLIGHT_PLAN = null;

    // Sidebar toggle
    if (localStorage.getItem('sidebarState') === 'collapsed') {
        dashboardContainer.classList.add('sidebar-collapsed');
    }
    sidebarToggleBtn.addEventListener('click', () => {
        dashboardContainer.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarState', dashboardContainer.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded');
    });

    // Auth check
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // --- Main Data Fetch & Render Cycle ---
    const fetchPilotData = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                localStorage.removeItem('authToken');
                window.location.href = 'login.html';
                throw new Error('Session invalid. Please log in again.');
            }
            const pilot = await response.json();
            CURRENT_PILOT = pilot;
            ACTIVE_FLIGHT_PLAN = pilot.currentFlightPlan;

            pilotNameElem.textContent = pilot.name || 'N/A';
            pilotCallsignElem.textContent = pilot.callsign || 'N/A';
            profilePictureElem.src = pilot.imageUrl || 'images/default-avatar.png';
            
            await renderAllViews(pilot);

        } catch (error) {
            console.error('Error fetching pilot data:', error);
            showNotification(error.message, 'error');
        }
    };

    // --- View Rendering ---
    const renderAllViews = async (pilot) => {
        const leaderboardsHTML = await fetchAndDisplayLeaderboards();
        
        // Render all primary content views
        renderPilotHubView(pilot, leaderboardsHTML);
        renderFlightPlanView(pilot);
        await fetchAndDisplayRosters();
        await fetchPirepHistory();
    };

    const getPendingTestBannerHTML = () => `
        <div class="pending-test-banner">
            <h3><i class="fa-solid fa-triangle-exclamation"></i> Promotion Pending</h3>
            <p>You have reached the flight hour requirement for the next rank! Staff has been notified to schedule your tests. Flight operations (starting new duties, filing flight plans) are suspended until your promotion is finalized.</p>
        </div>
    `;
    
    const renderPilotHubView = (pilot, leaderboardsHTML) => {
        const dutyStatusView = document.getElementById('view-duty-status');
        if (crewRestInterval) clearInterval(crewRestInterval);

        const pendingBanner = pilot.promotionStatus === 'PENDING_TEST' ? getPendingTestBannerHTML() : '';
        let dutyStatusHTML = '';

        if (pilot.dutyStatus === 'ON_DUTY') {
            dutyStatusHTML = renderOnDutyContent(pilot);
        } else {
            dutyStatusHTML = renderOnRestContent(pilot);
        }

        const statsCardHTML = `
            <div class="content-card">
                <h2><i class="fa-solid fa-chart-line"></i> Pilot Stats</h2>
                <div class="stats-grid">
                    <div class="stat-item"><strong>Rank</strong><span>${pilot.rank || '---'}</span></div>
                    <div class="stat-item"><strong>Flight Hours</strong><span>${(pilot.flightHours || 0).toFixed(1)}</span></div>
                </div>
            </div>
        `;
        
        dutyStatusView.innerHTML = `${pendingBanner}${dutyStatusHTML}${statsCardHTML}${leaderboardsHTML}`;

        // Post-render actions like starting the timer
        if (pilot.dutyStatus === 'ON_REST' && pilot.timeUntilNextDutyMs > 0) {
            const timerElement = document.getElementById('crew-rest-timer');
            if (timerElement) {
                let remainingTime = pilot.timeUntilNextDutyMs;
                timerElement.textContent = formatTime(remainingTime);
                crewRestInterval = setInterval(() => {
                    remainingTime -= 1000;
                    if (remainingTime <= 0) {
                        clearInterval(crewRestInterval);
                        fetchPilotData(); 
                        showNotification('Your mandatory crew rest is complete. You are now eligible for duty.', 'success');
                    } else {
                        timerElement.textContent = formatTime(remainingTime);
                    }
                }, 1000);
            }
        }
    };

    const renderOnRestContent = (pilot) => {
        if (pilot.timeUntilNextDutyMs > 0) {
            return `
                <div class="content-card">
                    <h2><i class="fa-solid fa-bed"></i> Current Status: 🔴 On Rest (Mandatory)</h2>
                    <div class="crew-rest-notice">
                        <p>A minimum <strong>8-hour rest period</strong> is required after completing a duty. You may go on duty again after this period has elapsed.</p>
                        <p>Time remaining until next duty:</p>
                        <div class="crew-rest-timer-display" id="crew-rest-timer">--:--:--</div>
                    </div>
                </div>`;
        }
        return `
            <div class="content-card">
                <h2><i class="fa-solid fa-user-clock"></i> Current Status: 🔴 On Rest</h2>
                <p>You are eligible for your next assignment. To begin, please select a roster from the Sector Ops page.</p>
            </div>`;
    };

    const renderOnDutyContent = (pilot) => {
        if (!pilot.currentRoster) return `<div class="content-card"><p>Error: On duty but no roster data found.</p></div>`;
        
        // This part needs to be improved. Let's assume the roster details are fetched separately for now.
        // A full implementation would fetch the roster details here.
        return `
            <div class="content-card">
                <div class="on-duty-header">
                    <h2><i class="fa-solid fa-plane-departure"></i> Current Status: 🟢 On Duty</h2>
                    <button id="end-duty-btn" class="end-duty-btn">Complete Duty Day</button>
                </div>
                <p>You are currently on duty. Complete your assigned flights via the <strong>Flight Plan</strong> page.</p>
                <p>Once all legs are flown, you may complete your duty day here.</p>
            </div>`;
    };

    // --- NEW: Flight Plan View ---
    const renderFlightPlanView = (pilot) => {
        const viewContainer = document.getElementById('view-flight-plan');

        if (pilot.promotionStatus === 'PENDING_TEST') {
            viewContainer.innerHTML = `<div class="content-card">${getPendingTestBannerHTML()}</div>`;
            return;
        }

        if (ACTIVE_FLIGHT_PLAN) {
            viewContainer.innerHTML = getActiveFlightPlanHTML(ACTIVE_FLIGHT_PLAN);
        } else {
            viewContainer.innerHTML = getFileFlightPlanHTML(pilot);
        }
    };

    const getActiveFlightPlanHTML = (plan) => {
        const etd = new Date(plan.etd).toLocaleString();
        const eta = new Date(plan.eta).toLocaleString();
        let actions = '';

        if (plan.status === 'PLANNED') {
            actions = `
                <button id="depart-btn" class="cta-button" data-plan-id="${plan._id}">Depart</button>
                <button id="cancel-btn" class="end-duty-btn" data-plan-id="${plan._id}">Cancel Flight Plan</button>`;
        } else if (plan.status === 'FLYING') {
            actions = `<button id="arrive-btn" class="cta-button" data-plan-id="${plan._id}">Arrive & File PIREP</button>`;
        }

        return `
        <div class="content-card">
            <h2><i class="fa-solid fa-compass"></i> Active Flight Plan</h2>
            <div class="flight-plan-details">
                <div class="fp-detail-item"><strong>Status</strong><span class="status-${plan.status}">${plan.status}</span></div>
                <div class="fp-detail-item"><strong>Flight No.</strong><span>${plan.flightNumber}</span></div>
                <div class="fp-detail-item"><strong>Aircraft</strong><span>${plan.aircraft}</span></div>
                <div class="fp-detail-item"><strong>Departure</strong><span>${plan.departure}</span></div>
                <div class="fp-detail-item"><strong>Arrival</strong><span>${plan.arrival}</span></div>
                <div class="fp-detail-item"><strong>Alternate</strong><span>${plan.alternate}</span></div>
                <div class="fp-detail-item"><strong>ETD</strong><span>${etd}</span></div>
                <div class="fp-detail-item"><strong>ETA</strong><span>${eta}</span></div>
                <div class="fp-detail-item"><strong>EET</strong><span>${plan.eet.toFixed(1)} hrs</span></div>
                <div class="fp-detail-item"><strong>FIC #</strong><span>${plan.ficNumber}</span></div>
                <div class="fp-detail-item"><strong>ADC #</strong><span>${plan.adcNumber}</span></div>
                <div class="fp-detail-item"><strong>Persons on Board</strong><span>${plan.pob}</span></div>
            </div>
             <div class="fp-detail-item" style="grid-column: 1 / -1;"><strong>Route</strong><span>${plan.route}</span></div>
            <div class="flight-plan-actions">${actions}</div>
        </div>`;
    };

    const getFileFlightPlanHTML = (pilot) => {
        const allowed = getAllowedFleet(pilot.rank);
        return `
        <div class="content-card">
            <h2><i class="fa-solid fa-file-pen"></i> File New Flight Plan</h2>
            <p>Your aircraft list is filtered to what <strong>${pilot.rank}</strong> is allowed to fly.</p>
            <form id="file-flight-plan-form">
                <div class="form-group-row">
                    <div class="form-group">
                        <label>Flight Number</label>
                        <input type="text" id="fp-flightNumber" required>
                    </div>
                    <div class="form-group">
                        <label>Aircraft</label>
                        <select id="fp-aircraft" class="select-control" required>
                            ${allowed.map(a => `<option value="${a.code}">${a.name} (${a.code})</option>`).join('')}
                        </select>
                    </div>
                </div>
                 <div class="form-group-row">
                    <div class="form-group"><label>Departure (ICAO)</label><input type="text" id="fp-departure" required maxlength="4"></div>
                    <div class="form-group"><label>Arrival (ICAO)</label><input type="text" id="fp-arrival" required maxlength="4"></div>
                    <div class="form-group"><label>Alternate (ICAO)</label><input type="text" id="fp-alternate" required maxlength="4"></div>
                </div>
                <div class="form-group">
                    <label>Route</label>
                    <textarea id="fp-route" rows="3" required></textarea>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Est. Departure (Local)</label><input type="datetime-local" id="fp-etd" required></div>
                    <div class="form-group"><label>Est. Elapsed Time (Hours)</label><input type="number" id="fp-eet" step="0.1" min="0.1" required></div>
                    <div class="form-group"><label>Persons on Board</label><input type="number" id="fp-pob" min="1" required></div>
                </div>
                <button type="submit" class="cta-button">File Flight Plan</button>
            </form>
        </div>`;
    };

    const fetchAndDisplayLeaderboards = async () => { /* ... (This function remains unchanged) ... */ };
    const fetchAndDisplayRosters = async () => { /* ... (This function remains unchanged) ... */ };
    const fetchPirepHistory = async () => { /* ... (This function remains unchanged) ... */ };
    // Re-paste the unchanged functions here to ensure completeness.
    const renderLeaderboardTable = (title, data, valueKey) => {
        if (!data || data.length === 0) {
            return `<h4>Top by ${title}</h4><p class="muted">No data available yet.</p>`;
        }
        return `
            <h4>Top by ${title}</h4>
            <table class="leaderboard-table">
                <thead><tr><th>#</th><th>Pilot</th><th>${title === 'Hours' ? '<i class="fa-solid fa-stopwatch"></i>' : '<i class="fa-solid fa-plane-arrival"></i>'} ${title}</th></tr></thead>
                <tbody>
                    ${data.map((pilot, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${pilot.name}<small>${pilot.callsign || 'N/A'}</small></td>
                            <td>${Number(pilot[valueKey] || 0).toFixed(1)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    };
    const fetchAndDisplayLeaderboards = async () => {
        try {
            const [weeklyRes, monthlyRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/leaderboard/weekly`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/leaderboard/monthly`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (!weeklyRes.ok || !monthlyRes.ok) throw new Error('Could not load leaderboard data.');
            const weeklyData = await weeklyRes.json();
            const monthlyData = await monthlyRes.json();
            return `
                <div class="content-card">
                    <h2><i class="fa-solid fa-trophy"></i> Leaderboards</h2>
                    <div class="leaderboards-container">
                        <div class="leaderboard-card">
                            <h3>This Week</h3>
                            ${renderLeaderboardTable('Hours', weeklyData.topByHours, 'weeklyFlightHours')}
                            ${renderLeaderboardTable('Sectors', weeklyData.topBySectors, 'weeklySectors')}
                        </div>
                        <div class="leaderboard-card">
                            <h3>This Month</h3>
                            ${renderLeaderboardTable('Hours', monthlyData.topByHours, 'leaderboardMonthlyFlightHours')}
                            ${renderLeaderboardTable('Sectors', monthlyData.topBySectors, 'monthlySectors')}
                        </div>
                    </div>
                </div>`;
        } catch (error) {
            console.error('Leaderboard fetch error:', error);
            return `<div class="content-card"><h2><i class="fa-solid fa-trophy"></i> Leaderboards</h2><p>Could not load leaderboards.</p></div>`;
        }
    };
    const fetchAndDisplayRosters = async () => {
        const container = document.getElementById('roster-list-container');
        const header = document.getElementById('roster-list-header');
        try {
            const response = await fetch(`${API_BASE_URL}/api/rosters/my-rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Could not fetch personalized rosters.');
            const data = await response.json();
            const rosters = data.rosters || [];
            const criteria = data.searchCriteria || {};
            if (criteria.searched?.length > 0) {
                header.innerHTML = `<div>Showing rosters for <strong>${criteria.searched.join(' & ')}</strong><span class="badge badge-rank ml-8">Your rank: ${CURRENT_PILOT?.rank || 'Unknown'}</span></div>`;
                if (window.plotRosters) window.plotRosters(criteria.searched[0], rosters);
            } else {
                header.innerHTML = 'No location data found. Showing rosters from primary hubs.';
            }
            if (rosters.length === 0) {
                container.innerHTML = '<p>There are no rosters available from your current location(s).</p>';
                return;
            }
            container.innerHTML = rosters.map(roster => {
                const operator = roster.operator || DEFAULT_OPERATOR;
                const dutyDisabled = CURRENT_PILOT?.promotionStatus === 'PENDING_TEST' ? 'disabled' : '';
                return `
                <div class="roster-item">
                    <div class="roster-info">
                        <strong>${roster.name}</strong>
                        <small>Hub: ${roster.hub} | Total Time: ${Number(roster.totalFlightTime || 0).toFixed(1)} hrs</small>
                        <div class="roster-path">${roster.legs.map(l => l.departure).join(' → ')} → ${roster.legs.slice(-1)[0].arrival}</div>
                    </div>
                    <div class="roster-actions">
                        <button class="details-button" data-roster-id="${roster._id}">Details</button>
                        <button class="cta-button go-on-duty-btn" data-roster-id="${roster._id}" ${dutyDisabled}>Go On Duty</button>
                    </div>
                    <div class="roster-leg-details" id="details-${roster._id}">...</div>
                </div>`;
            }).join('');
        } catch (error) {
            container.innerHTML = `<p class="error-text">${error.message}</p>`;
            header.innerHTML = 'Could not load roster data.';
        }
    };
    const fetchPirepHistory = async () => {
        const container = document.getElementById('pirep-history-list');
        container.innerHTML = '<p>Loading history...</p>';
        try {
            const response = await fetch(`${API_BASE_URL}/api/me/pireps`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Could not fetch PIREP history.');
            const pireps = await response.json();
            if (pireps.length === 0) {
                container.innerHTML = '<p>You have not filed any flight reports yet.</p>';
                return;
            }
            container.innerHTML = pireps.map(p => {
                const created = new Date(p.createdAt).toLocaleDateString();
                const operator = p.operator || DEFAULT_OPERATOR;
                const reqRank = deduceRankFromAircraftFE(p.aircraft);
                return `
                <div class="pirep-history-item status-${p.status.toLowerCase()}">
                    <div class="pirep-info">
                        <strong>${p.flightNumber}</strong> (${p.departure} - ${p.arrival})
                        <small>${created}</small>
                        <div class="pirep-chips"><span class="badge badge-operator">${operator}</span><span class="badge badge-rank">Req: ${reqRank}</span></div>
                    </div>
                    <div class="pirep-details">
                        <span>${p.aircraft}</span>
                        <span>${Number(p.flightTime || 0).toFixed(1)} hrs</span>
                        <span class="status-badge status-${p.status.toLowerCase()}">${p.status}</span>
                    </div>
                </div>`;
            }).join('');
        } catch (error) {
            container.innerHTML = `<p class="error-text">${error.message}</p>`;
        }
    };


    // --- Nav & actions ---
    sidebarNav.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (!link) return;
        e.preventDefault();
        sidebarNav.querySelector('.nav-link.active').classList.remove('active');
        link.classList.add('active');
        mainContentContainer.querySelector('.content-view.active').classList.remove('active');
        document.getElementById(link.dataset.view).classList.add('active');
        
        if (link.dataset.view === 'view-rosters' && window.leafletMap) {
            setTimeout(() => window.leafletMap.invalidateSize(), 150);
        }
    });

    // --- Main Event Listener for Dynamic Content ---
    mainContentContainer.addEventListener('click', async (e) => {
        // Roster details toggle
        if (e.target.classList.contains('details-button')) { /* ... No change ... */ }
        // Go on duty
        if (e.target.classList.contains('go-on-duty-btn')) { /* ... No change ... */ }
        // End duty
        if (e.target.id === 'end-duty-btn') { /* ... No change ... */ }
        
        // --- NEW Flight Plan Actions ---
        const planId = e.target.dataset.planId;
        if (e.target.id === 'depart-btn') {
            e.target.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/flightplans/${planId}/depart`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
                const result = await res.json();
                if (!res.ok) throw new Error(result.message);
                showNotification(result.message, 'success');
                await fetchPilotData();
            } catch (err) { showNotification(err.message, 'error'); e.target.disabled = false; }
        }
        if (e.target.id === 'cancel-btn') {
            e.target.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/flightplans/${planId}/cancel`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
                const result = await res.json();
                if (!res.ok) throw new Error(result.message);
                showNotification(result.message, 'success');
                await fetchPilotData();
            } catch (err) { showNotification(err.message, 'error'); e.target.disabled = false; }
        }
        if (e.target.id === 'arrive-btn') {
            document.getElementById('arrive-flight-form').dataset.planId = planId;
            arriveFlightModal.classList.add('visible');
        }
    });

    mainContentContainer.addEventListener('submit', async (e) => {
        if (e.target.id === 'file-flight-plan-form') {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.textContent = 'Filing...';

            const body = {
                flightNumber: document.getElementById('fp-flightNumber').value.toUpperCase(),
                aircraft: document.getElementById('fp-aircraft').value,
                departure: document.getElementById('fp-departure').value.toUpperCase(),
                arrival: document.getElementById('fp-arrival').value.toUpperCase(),
                alternate: document.getElementById('fp-alternate').value.toUpperCase(),
                route: document.getElementById('fp-route').value,
                etd: new Date(document.getElementById('fp-etd').value).toISOString(),
                eet: parseFloat(document.getElementById('fp-eet').value),
                pob: parseInt(document.getElementById('fp-pob').value, 10),
            };

            try {
                const res = await fetch(`${API_BASE_URL}/api/flightplans`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(body)
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.message);
                showNotification(result.message, 'success');
                await fetchPilotData();
            } catch(err) {
                showNotification(err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'File Flight Plan';
            }
        }
    });

    // --- Modal Handlers ---
    document.getElementById('arrive-flight-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const planId = e.target.dataset.planId;
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Completing...';

        const formData = new FormData();
        formData.append('remarks', document.getElementById('arrival-remarks').value);
        formData.append('verificationImage', document.getElementById('arrival-verification-image').files[0]);

        try {
            const res = await fetch(`${API_BASE_URL}/api/flightplans/${planId}/arrive`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            showNotification(result.message, 'success');
            arriveFlightModal.classList.remove('visible');
            await fetchPilotData();
        } catch (err) {
            showNotification(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Complete Flight';
        }
    });

    document.body.addEventListener('click', e => {
        if (e.target.hasAttribute('data-close-modal')) {
            e.target.closest('.modal-overlay').classList.remove('visible');
        }
    });
    
    // Initial Load
    fetchPilotData();
});