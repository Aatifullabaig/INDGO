// Crew Center – Merged Script with Flight Plan Workflow & Promotion Lockout
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const API_BASE_URL = 'https://indgo-backend.onrender.com';

    // --- Auth Check ---
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    let crewRestInterval = null; // To manage the countdown timer

    // --- Helper to format milliseconds into HH:MM:SS ---
    function formatTime(ms) {
        if (ms < 0) ms = 0;
        let seconds = Math.floor(ms / 1000);
        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);

        seconds %= 60;
        minutes %= 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // --- Rank and Fleet Models (keep in sync with backend) ---
    const PILOT_RANKS = [
        'IndGo Cadet', 'Skyline Observer', 'Route Explorer', 'Skyline Officer',
        'Command Captain', 'Elite Captain', 'Blue Eagle', 'Line Instructor',
        'Chief Flight Instructor', 'IndGo SkyMaster', 'Blue Legacy Commander'
    ];
    const rankIndex = (r) => PILOT_RANKS.indexOf(String(r || '').trim());

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
        if (has('Q400|A320|B738')) return 'IndGo Cadet';
        if (has('A321|B737')) return 'Skyline Observer';
        if (has('A330|B38M')) return 'Route Explorer';
        if (has('787-8|B788|777-200LR|B77L')) return 'Skyline Officer';
        if (has('787-9|B789|777-300ER|B77W')) return 'Command Captain';
        if (has('A350')) return 'Elite Captain';
        if (has('A380|747|744|B744')) return 'Blue Eagle';
        return 'Unknown';
    };

    const userCanFlyAircraft = (userRank, aircraftCode) => {
        const ac = FLEET.find(a => a.code === aircraftCode);
        if (!ac) return false;
        const ui = rankIndex(userRank);
        const ri = rankIndex(ac.minRank);
        return ui >= 0 && ri >= 0 && ri <= ui;
    };

    const getAllowedFleet = (userRank) => FLEET.filter(a => userCanFlyAircraft(userRank, a.code));

    // --- UI Helper ---
    function showNotification(message, type = 'info') {
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

    // --- DOM Elements ---
    const pilotNameElem = document.getElementById('pilot-name');
    const pilotCallsignElem = document.getElementById('pilot-callsign');
    const profilePictureElem = document.getElementById('profile-picture');
    const logoutButton = document.getElementById('logout-button');
    const mainContentContainer = document.querySelector('.main-content');
    const sidebarNav = document.querySelector('.sidebar-nav');
    const dashboardContainer = document.querySelector('.dashboard-container');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const arriveFlightModal = document.getElementById('arrive-flight-modal');

    // --- Global State ---
    let CURRENT_PILOT = null;

    // --- Main Data Fetch & Render Cycle ---
    const fetchPilotData = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    showNotification('Session expired. Please log in again.', 'error');
                    localStorage.removeItem('authToken');
                    window.location.href = 'login.html';
                }
                throw new Error('Failed to fetch pilot data.');
            }
            CURRENT_PILOT = await response.json();
            updateUI();
        } catch (error) {
            console.error('Error fetching pilot data:', error);
            showNotification(error.message, 'error');
        }
    };

    // --- Central UI Update Function ---
    const updateUI = async () => {
        if (!CURRENT_PILOT) return;

        // Update sidebar
        pilotNameElem.textContent = CURRENT_PILOT.name || 'N/A';
        pilotCallsignElem.textContent = CURRENT_PILOT.callsign || 'N/A';
        profilePictureElem.src = CURRENT_PILOT.imageUrl || 'images/default-avatar.png';

        // Update all views
        renderPilotHubView();
        renderFlightPlanView();
        await fetchAndDisplayRosters();
        await fetchPirepHistory();
    };

    // --- View Rendering Logic ---
    const getPendingTestBannerHTML = () => `
        <div class="pending-test-banner">
            <h3><i class="fa-solid fa-triangle-exclamation"></i> Promotion Pending</h3>
            <p>You have reached the flight hour requirement for the next rank! Staff has been notified to schedule your tests. Flight operations (starting new duties, filing flight plans) are suspended until your promotion is finalized.</p>
        </div>`;

    const createStatsCardHTML = () => `
        <div class="content-card">
            <h2><i class="fa-solid fa-chart-line"></i> Pilot Stats</h2>
            <div class="stats-grid">
                <div class="stat-item"><strong>Rank</strong><span>${CURRENT_PILOT.rank || '---'}</span></div>
                <div class="stat-item"><strong>Flight Hours</strong><span>${(CURRENT_PILOT.flightHours || 0).toFixed(1)}</span></div>
            </div>
        </div>`;

    const renderPilotHubView = async () => {
        const dutyStatusView = document.getElementById('view-duty-status');
        if (crewRestInterval) clearInterval(crewRestInterval);

        const pendingBanner = CURRENT_PILOT.promotionStatus === 'PENDING_TEST' ? getPendingTestBannerHTML() : '';
        const dutyStatusHTML = CURRENT_PILOT.dutyStatus === 'ON_DUTY' ? await renderOnDutyContent() : renderOnRestContent();
        const leaderboardsHTML = await fetchAndDisplayLeaderboards();

        dutyStatusView.innerHTML = `${pendingBanner}${dutyStatusHTML}${createStatsCardHTML()}${leaderboardsHTML}`;

        // Post-render actions
        if (CURRENT_PILOT.dutyStatus === 'ON_REST' && CURRENT_PILOT.timeUntilNextDutyMs > 0) {
            const timerElement = document.getElementById('crew-rest-timer');
            if (timerElement) {
                let remainingTime = CURRENT_PILOT.timeUntilNextDutyMs;
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

    const renderOnRestContent = () => {
        if (CURRENT_PILOT.timeUntilNextDutyMs > 0) {
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
    
    const renderOnDutyContent = async () => {
        if (!CURRENT_PILOT.currentRoster) return `<div class="content-card"><p>Error: On duty but no roster data found.</p></div>`;
    
        try {
            const [rosterRes, pirepsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/rosters?all=true`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/me/pireps`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
    
            if (!rosterRes.ok || !pirepsRes.ok) throw new Error('Could not load duty details.');
    
            const [allRosters, allPireps] = await Promise.all([rosterRes.json(), pirepsRes.json()]);
            // The roster object is nested inside the pilot object, so we use that.
            const currentRoster = CURRENT_PILOT.currentRoster; 
    
            const filedPirepsForRoster = allPireps.filter(p => p.rosterLeg?.rosterId === currentRoster._id);
            const filedFlightNumbers = new Set(filedPirepsForRoster.map(p => p.flightNumber));
    
            return `
                <div class="content-card">
                    <div class="on-duty-header">
                        <h2><i class="fa-solid fa-plane-departure"></i> Current Status: 🟢 On Duty</h2>
                        <button id="end-duty-btn" class="end-duty-btn">Complete Duty Day</button>
                    </div>
                    <p><strong>Active Roster:</strong> ${currentRoster.name}</p>
                    <p>Complete your assigned flights via the <strong>Flight Plan</strong> page. Once all legs are flown, you may complete your duty day here.</p>
                    <div class="roster-checklist">
                        ${currentRoster.legs.map(leg => {
                            const isCompleted = filedFlightNumbers.has(leg.flightNumber);
                            const reqRank = leg.rankUnlock || deduceRankFromAircraftFE(leg.aircraft);
                            return `
                              <div class="roster-leg-item ${isCompleted ? 'completed' : ''}">
                                <span class="status-icon">${isCompleted ? '✅' : '➡️'}</span>
                                <strong class="flight-number">${leg.flightNumber}</strong>
                                <span class="route">${leg.departure} - ${leg.arrival}</span>
                                <span class="leg-badges">
                                    <span class="badge badge-rank" title="Required Rank">Req: ${reqRank}</span>
                                </span>
                              </div>`;
                        }).join('')}
                    </div>
                </div>`;
        } catch (error) {
            console.error(error);
            return `<div class="content-card"><p class="error-text">${error.message}</p></div>`;
        }
    };

    const renderFlightPlanView = () => {
        const viewContainer = document.getElementById('view-flight-plan');

        if (CURRENT_PILOT.promotionStatus === 'PENDING_TEST') {
            viewContainer.innerHTML = `<div class="content-card">${getPendingTestBannerHTML()}</div>`;
            return;
        }

        if (CURRENT_PILOT.currentFlightPlan) {
            viewContainer.innerHTML = getActiveFlightPlanHTML(CURRENT_PILOT.currentFlightPlan);
        } else if (CURRENT_PILOT.dutyStatus === 'ON_DUTY') {
            viewContainer.innerHTML = getFileFlightPlanHTML();
        } else {
            viewContainer.innerHTML = `<div class="content-card"><h2><i class="fa-solid fa-file-pen"></i> File New Flight Plan</h2><p>You must be <strong>On Duty</strong> to file a flight plan for a roster leg. Please start a duty from the Sector Ops page.</p></div>`;
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
                <div class="fp-detail-item"><strong>Status</strong><span class="status-${plan.status.toLowerCase()}">${plan.status}</span></div>
                <div class="fp-detail-item"><strong>Flight No.</strong><span>${plan.flightNumber}</span></div>
                <div class="fp-detail-item"><strong>Aircraft</strong><span>${plan.aircraft}</span></div>
                <div class="fp-detail-item"><strong>Departure</strong><span>${plan.departure}</span></div>
                <div class="fp-detail-item"><strong>Arrival</strong><span>${plan.arrival}</span></div>
                <div class="fp-detail-item"><strong>Alternate</strong><span>${plan.alternate || 'N/A'}</span></div>
                <div class="fp-detail-item"><strong>ETD</strong><span>${etd}</span></div>
                <div class="fp-detail-item"><strong>ETA</strong><span>${eta}</span></div>
                <div class="fp-detail-item"><strong>EET</strong><span>${(plan.eet || 0).toFixed(1)} hrs</span></div>
                <div class="fp-detail-item"><strong>FIC #</strong><span>${plan.ficNumber || 'N/A'}</span></div>
                <div class="fp-detail-item"><strong>ADC #</strong><span>${plan.adcNumber || 'N/A'}</span></div>
                <div class="fp-detail-item"><strong>Persons on Board</strong><span>${plan.pob}</span></div>
                
                ${plan.dispatchData ? `
                    <h3 class="fp-section-header">Dispatch & Loadsheet</h3>
                    <div class="fp-detail-item"><strong>Cruise Alt.</strong><span>${plan.dispatchData.ofp?.general?.cruise_altitude_ft?.toLocaleString() || 'N/A'} ft</span></div>
                    <div class="fp-detail-item"><strong>Zero Fuel Wt.</strong><span>${plan.dispatchData.ofp?.weights?.zfw_kg?.toLocaleString() || 'N/A'} kg</span></div>
                    <div class="fp-detail-item"><strong>Takeoff Wt.</strong><span>${plan.dispatchData.ofp?.weights?.tow_kg?.toLocaleString() || 'N/A'} kg</span></div>
                    <div class="fp-detail-item"><strong>Trip Fuel</strong><span>${plan.dispatchData.ofp?.fuel_plan?.trip_kg?.toLocaleString() || 'N/A'} kg</span></div>
                    <div class="fp-detail-item"><strong>Total Fuel</strong><span>${plan.dispatchData.ofp?.fuel_plan?.total_kg?.toLocaleString() || 'N/A'} kg</span></div>
                ` : ''}

            </div>
            <div class="flight-plan-actions">${actions}</div>
        </div>`;
    };

    const getFileFlightPlanHTML = () => {
        const allowed = getAllowedFleet(CURRENT_PILOT.rank);
        return `
        <div class="content-card">
            <h2><i class="fa-solid fa-file-pen"></i> File New Flight Plan</h2>
            <p>Your aircraft list is filtered to what <strong>${CURRENT_PILOT.rank}</strong> is allowed to fly.</p>
            <form id="file-flight-plan-form">
                <div class="form-group-row">
                    <div class="form-group"><label>Flight Number</label><input type="text" id="fp-flightNumber" required></div>
                    <div class="form-group">
                        <label>Aircraft</label>
                        <select id="fp-aircraft" class="select-control" required>
                            <option value="">-- Select Aircraft --</option>
                            ${allowed.map(a => `<option value="${a.code}">${a.name} (${a.code})</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Departure (ICAO)</label><input type="text" id="fp-departure" required maxlength="4" pattern="[A-Z]{4}"></div>
                    <div class="form-group"><label>Arrival (ICAO)</label><input type="text" id="fp-arrival" required maxlength="4" pattern="[A-Z]{4}"></div>
                    <div class="form-group"><label>Alternate (ICAO)</label><input type="text" id="fp-alternate" maxlength="4" pattern="[A-Z]{4}"></div>
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

    const fetchAndDisplayLeaderboards = async () => {
        try {
            const [weeklyRes, monthlyRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/leaderboard/weekly`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/leaderboard/monthly`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (!weeklyRes.ok || !monthlyRes.ok) throw new Error('Could not load leaderboard data.');
            const weeklyData = await weeklyRes.json();
            const monthlyData = await monthlyRes.json();
            
            const renderLeaderboardTable = (title, data, valueKey) => {
                if (!data || data.length === 0) return `<h4>Top by ${title}</h4><p class="muted">No data available yet.</p>`;
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
        container.innerHTML = '<p>Loading available rosters...</p>';
        try {
            const response = await fetch(`${API_BASE_URL}/api/rosters/my-rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Could not fetch personalized rosters.');
            const data = await response.json();
            const { rosters = [], searchCriteria = {} } = data;

            if (searchCriteria.searched?.length > 0) {
                header.innerHTML = `<div>Showing rosters for <strong>${searchCriteria.searched.join(' & ')}</strong><span class="badge badge-rank ml-8">Your rank: ${CURRENT_PILOT?.rank || 'Unknown'}</span></div>`;
                if (window.plotRosters) window.plotRosters(searchCriteria.searched[0], rosters);
            } else {
                header.innerHTML = 'No location data found. Showing rosters from primary hubs.';
            }

            if (rosters.length === 0) {
                container.innerHTML = '<p>There are no rosters available for your rank and location.</p>';
                return;
            }

            container.innerHTML = rosters.map(roster => {
                const dutyDisabled = CURRENT_PILOT?.promotionStatus === 'PENDING_TEST' || CURRENT_PILOT?.dutyStatus === 'ON_DUTY' ? 'disabled' : '';
                const aircraftTypes = new Set(roster.legs.map(leg => leg.aircraft));
                const isMultiAircraft = aircraftTypes.size > 1;
                let aircraftImageHTML = '';

                if (!isMultiAircraft && roster.legs.length > 0) {
                    const { aircraft, flightNumber } = roster.legs[0];
                    const airlineCode = flightNumber.replace(/\d+$/, '').toUpperCase();
                    const liveryImagePath = `Images/liveries/${airlineCode}_${aircraft}.png`;
                    const genericImagePath = `Images/planesForCC/${aircraft}.png`;
                    aircraftImageHTML = `
                        <div class="roster-aircraft-container">
                            <img src="${liveryImagePath}" alt="${airlineCode} ${aircraft}" class="roster-aircraft-image" onerror="this.onerror=null; this.src='${genericImagePath}'; this.alt='${aircraft}';">
                        </div>`;
                }

                return `
                <div class="roster-item" data-multi-aircraft="${isMultiAircraft}">
                    <div class="roster-info">
                        <strong>${roster.name}</strong>
                        <small>Hub: ${roster.hub} | Total Time: ${Number(roster.totalFlightTime || 0).toFixed(1)} hrs</small>
                        <div class="roster-path">${roster.legs.map(l => l.departure).join(' → ')} → ${roster.legs.slice(-1)[0].arrival}</div>
                    </div>
                    <div class="roster-right-panel">
                        ${aircraftImageHTML}
                        <div class="roster-actions">
                            <button class="details-button" data-roster-id="${roster._id}" aria-expanded="false">Details</button>
                            <button class="cta-button go-on-duty-btn" data-roster-id="${roster._id}" ${dutyDisabled}>Go On Duty</button>
                        </div>
                    </div>
                    <div class="roster-leg-details" id="details-${roster._id}" style="display: none;"></div>
                </div>`;
            }).join('');
        } catch (error) {
            container.innerHTML = `<p class="error-text">${error.message}</p>`;
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
            container.innerHTML = pireps.map(p => `
                <div class="pirep-history-item status-${p.status.toLowerCase()}">
                    <div class="pirep-info">
                        <strong>${p.flightNumber}</strong> (${p.departure} - ${p.arrival})
                        <small>${new Date(p.createdAt).toLocaleDateString()}</small>
                        <div class="pirep-chips">
                           <span class="badge badge-rank">Req: ${deduceRankFromAircraftFE(p.aircraft)}</span>
                        </div>
                    </div>
                    <div class="pirep-details">
                        <span>${p.aircraft}</span>
                        <span>${Number(p.flightTime || 0).toFixed(1)} hrs</span>
                        <span class="status-badge status-${p.status.toLowerCase()}">${p.status}</span>
                    </div>
                </div>`).join('');
        } catch (error) { 
            container.innerHTML = `<p class="error-text">${error.message}</p>`;
        }
    };

    // --- Event Handlers ---
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        showNotification('You have been logged out.', 'info');
        window.location.href = 'login.html';
    };

    const handleNavClick = (e) => {
        const link = e.target.closest('.nav-link');
        if (!link) return;
        e.preventDefault();
        const activeLink = sidebarNav.querySelector('.nav-link.active');
        if (activeLink) activeLink.classList.remove('active');
        link.classList.add('active');

        const activeView = mainContentContainer.querySelector('.content-view.active');
        if (activeView) activeView.classList.remove('active');
        document.getElementById(link.dataset.view).classList.add('active');
        
        if (link.dataset.view === 'view-rosters' && window.leafletMap) {
            setTimeout(() => window.leafletMap.invalidateSize(), 150);
        }
    };

    const handleFormSubmit = async (e) => {
        if (e.target.id === 'file-flight-plan-form') {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Filing...';

            const body = {
                flightNumber: document.getElementById('fp-flightNumber').value.toUpperCase(),
                aircraft: document.getElementById('fp-aircraft').value,
                departure: document.getElementById('fp-departure').value.toUpperCase(),
                arrival: document.getElementById('fp-arrival').value.toUpperCase(),
                alternate: document.getElementById('fp-alternate').value.toUpperCase(),
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
                if (!res.ok) throw new Error(result.message || 'Failed to file flight plan.');
                showNotification(result.message, 'success');
                await fetchPilotData();
            } catch(err) {
                showNotification(`Error: ${err.message}`, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'File Flight Plan';
            }
        }
    };

    const handleMainContentClick = async (e) => {
        const target = e.target;
        const planId = target.dataset.planId;

        if (target.closest('.details-button')) {
            const button = target.closest('.details-button');
            const rosterId = button.dataset.rosterId;
            const detailsContainer = document.getElementById(`details-${rosterId}`);
            const isVisible = detailsContainer.style.display === 'block';

            button.setAttribute('aria-expanded', !isVisible);
            detailsContainer.style.display = isVisible ? 'none' : 'block';

            if (!isVisible && !detailsContainer.innerHTML.trim()) {
                await renderRosterDetails(rosterId, detailsContainer);
            }
        } else if (target.closest('.go-on-duty-btn')) {
            const button = target.closest('.go-on-duty-btn');
            await startDuty(button);
        } else if (target.id === 'end-duty-btn') {
            await endDuty(target);
        } else if (planId) {
            if (target.id === 'depart-btn') await handleFlightAction(target, 'depart');
            if (target.id === 'cancel-btn') await handleFlightAction(target, 'cancel');
            if (target.id === 'arrive-btn') {
                document.getElementById('arrive-flight-form').dataset.planId = planId;
                arriveFlightModal.classList.add('visible');
            }
        }
    };
    
    const renderRosterDetails = async (rosterId, container) => {
        container.innerHTML = '<p>Loading details...</p>';
        try {
            const res = await fetch(`${API_BASE_URL}/api/rosters/my-rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Could not fetch roster details.');
    
            const { rosters = [] } = await res.json();
            const roster = rosters.find(r => r._id === rosterId);
            const isMultiAircraft = new Set(roster.legs.map(leg => leg.aircraft)).size > 1;
    
            if (roster && roster.legs) {
                container.innerHTML = `<ul>${roster.legs.map(leg => {
                    const airlineCode = leg.flightNumber.replace(/\d+$/, '').toUpperCase();
                    let legAircraftImageHTML = '';
                    if (isMultiAircraft) {
                        const liveryPath = `Images/liveries/${airlineCode}_${leg.aircraft}.png`;
                        const genericPath = `Images/planesForCC/${leg.aircraft}.png`;
                        legAircraftImageHTML = `
                            <div class="leg-aircraft-image-container">
                                <img src="${liveryPath}" class="leg-aircraft-image" onerror="this.onerror=null; this.src='${genericPath}';">
                            </div>`;
                    }
                    return `<li class="${isMultiAircraft ? 'multi-aircraft-leg' : ''}">
                        <div class="leg-main-content">
                            <div class="leg-header">
                                <img src="Images/vas/${airlineCode}.png" class="leg-airline-logo" onerror="this.style.display='none'">
                                <span class="leg-airline-name">${leg.operator} (${leg.flightNumber})</span>
                            </div>
                            <div class="leg-body">
                                <div class="leg-departure">
                                    <span class="leg-label">Departure</span>
                                    <div class="leg-airport">
                                        ${leg.departureCountry ? `<img src="https://flagcdn.com/w20/${leg.departureCountry.toLowerCase()}.png" class="country-flag">` : ''}
                                        <span class="leg-icao">${leg.departure}</span>
                                    </div>
                                    <small class="leg-details-meta">Aircraft: ${leg.aircraft}</small>
                                </div>
                                <div class="leg-icon"><i class="fa-solid fa-plane"></i></div>
                                <div class="leg-arrival">
                                    <span class="leg-label">Arrival</span>
                                    <div class="leg-airport">
                                        ${leg.arrivalCountry ? `<img src="https://flagcdn.com/w20/${leg.arrivalCountry.toLowerCase()}.png" class="country-flag">` : ''}
                                        <span class="leg-icao">${leg.arrival}</span>
                                    </div>
                                    <small class="leg-details-meta">EET: ${Number(leg.flightTime || 0).toFixed(1)} hrs</small>
                                </div>
                            </div>
                            <div class="leg-badges-footer">
                                <span class="badge badge-rank">Req: ${leg.rankUnlock || deduceRankFromAircraftFE(leg.aircraft)}</span>
                            </div>
                        </div>
                        ${legAircraftImageHTML}
                    </li>`;
                }).join('')}</ul>`;
            } else {
                container.innerHTML = '<p>Details could not be loaded.</p>';
            }
        } catch (error) {
            console.error('Failed to fetch roster details:', error);
            container.innerHTML = `<p class="error-text">${error.message}</p>`;
        }
    };
    
    const startDuty = async (button) => {
        const rosterId = button.dataset.rosterId;
        button.disabled = true;
        button.textContent = 'Starting...';
        try {
            const res = await fetch(`${API_BASE_URL}/api/duty/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ rosterId })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message || 'Failed to start duty.');
            showNotification(result.message, 'success');
            await fetchPilotData();
        } catch (err) {
            showNotification(`Error: ${err.message}`, 'error');
            button.disabled = false;
            button.textContent = 'Go On Duty';
        }
    };

    const endDuty = async (button) => {
        button.disabled = true;
        button.textContent = 'Ending...';
        try {
            const res = await fetch(`${API_BASE_URL}/api/duty/end`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message || 'Failed to end duty.');
            showNotification(result.message, 'success');
            await fetchPilotData();
        } catch (err) {
            showNotification(`Error: ${err.message}`, 'error');
            button.disabled = false;
            button.textContent = 'Complete Duty Day';
        }
    };

    const handleFlightAction = async (button, action) => {
        button.disabled = true;
        try {
            const res = await fetch(`${API_BASE_URL}/api/flightplans/${button.dataset.planId}/${action}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            showNotification(result.message, 'success');
            await fetchPilotData();
        } catch (err) {
            showNotification(err.message, 'error');
            button.disabled = false;
        }
    };
    
    const handleArriveModalSubmit = async (e) => {
        e.preventDefault();
        const planId = e.target.dataset.planId;
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Completing...';

        const formData = new FormData();
        formData.append('remarks', document.getElementById('arrival-remarks').value);
        const imageInput = document.getElementById('arrival-verification-image');
        
        if (imageInput.files.length === 0) {
            showNotification('Error: You must upload a verification image.', 'error');
            btn.disabled = false;
            btn.textContent = 'Complete Flight';
            return;
        }
        formData.append('verificationImage', imageInput.files[0]);

        try {
            const res = await fetch(`${API_BASE_URL}/api/flightplans/${planId}/arrive`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message || 'Failed to complete flight.');
            showNotification(result.message, 'success');
            arriveFlightModal.classList.remove('visible');
            await fetchPilotData();
        } catch (err) {
            showNotification(`Error: ${err.message}`, 'error');
        } finally {
            e.target.reset();
            btn.disabled = false;
            btn.textContent = 'Complete Flight';
        }
    };

    // --- Initial Setup & Event Listeners ---
    if (localStorage.getItem('sidebarState') === 'collapsed') {
        dashboardContainer.classList.add('sidebar-collapsed');
    }
    sidebarToggleBtn.addEventListener('click', () => {
        dashboardContainer.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarState', dashboardContainer.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded');
    });
    
    logoutButton.addEventListener('click', handleLogout);
    sidebarNav.addEventListener('click', handleNavClick);
    mainContentContainer.addEventListener('click', handleMainContentClick);
    mainContentContainer.addEventListener('submit', handleFormSubmit);

    document.getElementById('arrive-flight-form').addEventListener('submit', handleArriveModalSubmit);
    document.body.addEventListener('click', e => {
        if (e.target.hasAttribute('data-close-modal')) {
            e.target.closest('.modal-overlay').classList.remove('visible');
        }
    });
    
    // --- Initial Load ---
    fetchPilotData();
});