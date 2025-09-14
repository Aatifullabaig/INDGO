// Crew Center – Rank-aware UI + nicer Sector Ops + gated PIREP aircraft chooser
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
        'IndGo Cadet',
        'Skyline Observer',
        'Route Explorer',
        'Skyline Officer',
        'Command Captain',
        'Elite Captain',
        'Blue Eagle',
        'Line Instructor',
        'Chief Flight Instructor',
        'IndGo SkyMaster',
        'Blue Legacy Commander'
    ];
    const rankIndex = (r) => {
        const i = PILOT_RANKS.indexOf(String(r || '').trim());
        return i >= 0 ? i : -1;
    };

    // --- Fleet definition (can expand later; maps min allowed rank per type) ---
    // Codes match typical strings you use in PIREPs/rosters.
    const FLEET = [
        { code:'Q400', name:'De Havilland Dash 8 Q400', minRank:'IndGo Cadet', operator:'IndGo Air Virtual' },
        { code:'A320', name:'Airbus A320',              minRank:'IndGo Cadet', operator:'IndGo Air Virtual' },
        { code:'B738', name:'Boeing 737-800',           minRank:'IndGo Cadet', operator:'IndGo Air Virtual' },

        { code:'A321', name:'Airbus A321',              minRank:'Skyline Observer', operator:'IndGo Air Virtual' },
        { code:'B737', name:'Boeing 737 (family)',      minRank:'Skyline Observer', operator:'IndGo Air Virtual' },

        { code:'A330', name:'Airbus A330-300',          minRank:'Route Explorer', operator:'IndGo Air Virtual' },
        { code:'B38M', name:'Boeing 737 MAX 8',         minRank:'Route Explorer', operator:'IndGo Air Virtual' },

        { code:'B788', name:'Boeing 787-8',             minRank:'Skyline Officer', operator:'IndGo Air Virtual' },
        { code:'B77L', name:'Boeing 777-200LR',         minRank:'Skyline Officer', operator:'IndGo Air Virtual' },

        { code:'B789', name:'Boeing 787-9',             minRank:'Command Captain', operator:'IndGo Air Virtual' },
        { code:'B77W', name:'Boeing 777-300ER',         minRank:'Command Captain', operator:'IndGo Air Virtual' },

        { code:'A350', name:'Airbus A350-900',          minRank:'Elite Captain', operator:'IndGo Air Virtual' },

        { code:'A380', name:'Airbus A380-800',          minRank:'Blue Eagle', operator:'IndGo Air Virtual' },
        { code:'B744', name:'Boeing 747-400',           minRank:'Blue Eagle', operator:'IndGo Air Virtual' },
    ];
    const DEFAULT_OPERATOR = 'IndGo Air Virtual';

    // Mirror of backend aircraft→rank deduction (used for history chips & leg badges)
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
        if (!ac) return false;
        const ui = rankIndex(userRank);
        const ri = rankIndex(ac.minRank);
        return ui >= 0 && ri >= 0 && ri <= ui;
    };

    const getAllowedFleet = (userRank) =>
        FLEET.filter(a => userCanFlyAircraft(userRank, a.code));

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

    // Promotion modal
    const promotionModal = document.getElementById('promotion-modal');
    const promoRankName = document.getElementById('promo-rank-name');
    const promoHoursRequired = document.getElementById('promo-hours-required');
    const promoPerksList = document.getElementById('promo-perks-list');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');

    // Keep current pilot in memory so other views can read rank/operator
    let CURRENT_PILOT = null;

    // Sidebar toggle
    const sidebarState = localStorage.getItem('sidebarState');
    if (sidebarState === 'collapsed') {
        dashboardContainer.classList.add('sidebar-collapsed');
    }
    sidebarToggleBtn.addEventListener('click', () => {
        dashboardContainer.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarState', dashboardContainer.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded');
    });

    // Auth
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Promotion modal helpers
    function showPromotionModal(details) {
        promoRankName.textContent = details.newRank;
        promoHoursRequired.textContent = `${details.flightHoursRequired} hrs`;
        promoPerksList.innerHTML = details.perks.map(perk => `<li>${perk}</li>`).join('');
        promotionModal.classList.add('visible');
    }
    function hidePromotionModal() { promotionModal.classList.remove('visible'); }

    // Fetch pilot
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

            pilotNameElem.textContent = pilot.name || 'N/A';
            pilotCallsignElem.textContent = pilot.callsign || 'N/A';
            profilePictureElem.src = pilot.imageUrl || 'images/default-avatar.png';
            
            const leaderboardsHTML = await fetchAndDisplayLeaderboards();
            await renderAllViews(pilot, leaderboardsHTML);

        } catch (error) {
            console.error('Error fetching pilot data:', error);
            showNotification(error.message, 'error');
        }
    };

    // Stats card
    const createStatsCardHTML = (pilot) => `
        <div class="content-card">
            <h2><i class="fa-solid fa-chart-line"></i> Pilot Stats</h2>
            <div class="stats-grid">
                <div class="stat-item">
                    <strong>Rank</strong>
                    <span>${pilot.rank || '---'}</span>
                </div>
                <div class="stat-item">
                    <strong>Flight Hours</strong>
                    <span>${(pilot.flightHours || 0).toFixed(1)}</span>
                </div>
            </div>
        </div>
    `;

    // Leaderboard rendering
    const renderLeaderboardTable = (title, data, valueKey) => {
        if (!data || data.length === 0) {
            return `<h4>Top by ${title}</h4><p class="muted">No data available yet.</p>`;
        }
        return `
            <h4>Top by ${title}</h4>
            <table class="leaderboard-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Pilot</th>
                        <th>${title === 'Hours' ? '<i class="fa-solid fa-stopwatch"></i>' : '<i class="fa-solid fa-plane-arrival"></i>'} ${title}</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((pilot, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>
                                ${pilot.name}
                                <small>${pilot.callsign || 'N/A'}</small>
                            </td>
                            <td>${Number(pilot[valueKey] || 0).toFixed(1)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
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
                </div>
            `;
        } catch (error) {
            console.error('Leaderboard fetch error:', error);
            return `<div class="content-card"><h2><i class="fa-solid fa-trophy"></i> Leaderboards</h2><p>Could not load leaderboards at this time.</p></div>`;
        }
    };
    

    // Build PIREP form (rank-aware)
    const getPirepFormHTML = (pilot) => {
        const allowed = getAllowedFleet(pilot.rank);
        const operatorOptions = [...new Set(allowed.map(a => a.operator || DEFAULT_OPERATOR))];

        return `
        <div class="content-card">
            <h2><i class="fa-solid fa-file-signature"></i> File Flight Report (PIREP)</h2>
            <p>Your aircraft list is filtered to what <strong>${pilot.rank}</strong> is allowed to fly.</p>

            <form id="pirep-form">
                <div class="form-group">
                    <label for="flight-number">Flight Number</label>
                    <input type="text" id="flight-number" required>
                </div>

                <div class="form-group-row">
                    <div class="form-group">
                        <label for="departure-icao">Departure (ICAO)</label>
                        <input type="text" id="departure-icao" required maxlength="4">
                    </div>
                    <div class="form-group">
                        <label for="arrival-icao">Arrival (ICAO)</label>
                        <input type="text" id="arrival-icao" required maxlength="4">
                    </div>
                </div>

                <div class="form-group-row">
                    <div class="form-group">
                        <label for="aircraft-select">Aircraft</label>
                        <select id="aircraft-select" class="select-control" required>
                            ${allowed.map(a => `<option value="${a.code}">${a.name} (${a.code})</option>`).join('')}
                        </select>
                        <small class="muted">Only aircraft at or below your rank are shown.</small>
                    </div>
                    <div class="form-group">
                        <label for="operator-select">Operator</label>
                        <select id="operator-select" class="select-control">
                            ${operatorOptions.map(op => `<option value="${op}">${op}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label for="flight-time">Flight Time (hours)</label>
                    <input type="number" id="flight-time" step="0.1" min="0.1" required>
                </div>

                <div class="form-group">
                    <label for="verification-image">Verification Image (e.g., flight summary screenshot)</label>
                    <input type="file" id="verification-image" class="file-input" accept="image/*" required>
                </div>

                <div class="form-group">
                    <label for="remarks">Remarks (Optional)</label>
                    <textarea id="remarks" rows="3"></textarea>
                </div>

                <button type="submit" class="cta-button">File Report</button>
            </form>
        </div>`;
    };

    // Views
    const renderAllViews = async (pilot, leaderboardsHTML) => {
    if (pilot.dutyStatus === 'ON_DUTY') {
        await renderOnDutyViews(pilot, leaderboardsHTML);
    } else {
        await renderOnRestViews(pilot, leaderboardsHTML);
    }

    await fetchAndDisplayRosters();
    await fetchPirepHistory();

    // Always populate the File PIREP tab regardless of duty status
    const filePirepView = document.getElementById('view-file-pirep');
    if (filePirepView) {
        filePirepView.innerHTML = getPirepFormHTML(pilot);
    }
};

    const renderOnRestViews = async (pilot, leaderboardsHTML) => {
        const dutyStatusView = document.getElementById('view-duty-status');
        
        // Clear any previous timer when re-rendering the view
        if (crewRestInterval) {
            clearInterval(crewRestInterval);
            crewRestInterval = null;
        }

        let dutyStatusHTML = '';

        if (pilot.timeUntilNextDutyMs > 0) {
            // Pilot is on MANDATORY crew rest
            dutyStatusHTML = `
                <div class="content-card">
                    <h2><i class="fa-solid fa-bed"></i> Current Status: 🔴 On Rest (Mandatory)</h2>
                    <div class="crew-rest-notice">
                        <p>In accordance with Flight & Duty Time Limitations (FTPL), a minimum <strong>8-hour rest period</strong> is required after completing a duty. You may go on duty again after this period has elapsed.</p>
                        <p>Time remaining until next duty:</p>
                        <div class="crew-rest-timer-display" id="crew-rest-timer">--:--:--</div>
                    </div>
                </div>
            `;
        } else {
            // Pilot is on rest but ELIGIBLE for duty
            dutyStatusHTML = `
                <div class="content-card">
                    <h2><i class="fa-solid fa-user-clock"></i> Current Status: 🔴 On Rest</h2>
                    <p>You have completed your mandatory rest period and are eligible for your next assignment. To begin, please select a roster from the Sector Ops page.</p>
                </div>
            `;
        }

        dutyStatusView.innerHTML = `
            ${dutyStatusHTML}
            ${createStatsCardHTML(pilot)}
            ${leaderboardsHTML}
        `;

        // After the HTML is in the DOM, start the timer if necessary
        if (pilot.timeUntilNextDutyMs > 0) {
            const timerElement = document.getElementById('crew-rest-timer');
            let remainingTime = pilot.timeUntilNextDutyMs;

            if(timerElement) {
                timerElement.textContent = formatTime(remainingTime); // Initial display
    
                crewRestInterval = setInterval(() => {
                    remainingTime -= 1000;
                    if (remainingTime <= 0) {
                        clearInterval(crewRestInterval);
                        // Re-fetch all data to ensure the UI is fully updated
                        fetchPilotData(); 
                        showNotification('Your mandatory crew rest is complete. You are now eligible for duty.', 'success');
                    } else {
                        timerElement.textContent = formatTime(remainingTime);
                    }
                }, 1000);
            }
        }
    };

    const renderOnDutyViews = async (pilot, leaderboardsHTML) => {
        const dutyStatusView = document.getElementById('view-duty-status');
        const filePirepView = document.getElementById('view-file-pirep');

        // Ensure any stray rest timer is cleared when switching to duty view
        if (crewRestInterval) {
            clearInterval(crewRestInterval);
            crewRestInterval = null;
        }

        try {
            const [rosterRes, pirepsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/rosters`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/me/pireps`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (!rosterRes.ok || !pirepsRes.ok) throw new Error('Could not load duty details.');

            const [allRosters, allPireps] = await Promise.all([rosterRes.json(), pirepsRes.json()]);
            const currentRoster = allRosters.find(r => r._id === pilot.currentRoster);
            if (!currentRoster) throw new Error('Could not find your assigned roster.');

            const filedPirepsForRoster = allPireps.filter(p => p.rosterLeg?.rosterId === currentRoster._id);
            const filedFlightNumbers = new Set(filedPirepsForRoster.map(p => p.flightNumber));

            dutyStatusView.innerHTML = `
                <div class="content-card">
                    <div class="on-duty-header">
                        <h2><i class="fa-solid fa-plane-departure"></i> Current Status: 🟢 On Duty</h2>
                        <button id="end-duty-btn" class="end-duty-btn">Complete Duty Day</button>
                    </div>
                    <p style="margin-bottom: 1.5rem;"><strong>Active Roster:</strong> ${currentRoster.name}</p>
                    <div class="roster-checklist">
                        ${currentRoster.legs.map(leg => {
                            const isCompleted = filedFlightNumbers.has(leg.flightNumber);
                            const reqRank = leg.rankUnlock || deduceRankFromAircraftFE(leg.aircraft);
                            const operator = leg.operator || currentRoster.operator || DEFAULT_OPERATOR;
                            return `
                              <div class="roster-leg-item ${isCompleted ? 'completed' : ''}">
                                <span class="status-icon">${isCompleted ? '✅' : '➡️'}</span>
                                <strong class="flight-number">${leg.flightNumber}</strong>
                                <span class="route">${leg.departure} - ${leg.arrival}</span>
                                <span class="leg-badges">
                                    <span class="badge badge-operator" title="Operator">${operator}</span>
                                    <span class="badge badge-rank" title="Required Rank">Req: ${reqRank}</span>
                                </span>
                              </div>`;
                        }).join('')}
                    </div>
                </div>
                ${createStatsCardHTML(pilot)}
                ${leaderboardsHTML}
            `;
            filePirepView.innerHTML = getPirepFormHTML(pilot);

        } catch (error) {
            dutyStatusView.innerHTML = `<div class="content-card"><p class="error-text">${error.message}</p></div>`;
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
                header.innerHTML = `
                    <div>
                        Showing rosters for <strong>${criteria.searched.join(' & ')}</strong>
                        <span class="badge badge-rank ml-8">Your rank: ${CURRENT_PILOT?.rank || 'Unknown'}</span>
                    </div>`;
                if (window.plotRosters) {
                    window.plotRosters(criteria.searched[0], rosters);
                }
            } else {
                header.innerHTML = 'No location data found. Showing rosters from primary hubs.';
            }

            if (rosters.length === 0) {
                container.innerHTML = '<p>There are no rosters available from your current location(s). Please complete a flight or check back later.</p>';
                return;
            }

            container.innerHTML = rosters.map(roster => {
                const operator = roster.operator || DEFAULT_OPERATOR;
                return `
                <div class="roster-item">
                    <div class="roster-info">
                        <strong>${roster.name}</strong>
                        <small>
                            Hub: ${roster.hub} |
                            Operator: <span class="badge badge-operator">${operator}</span> |
                            Allowed up to: <span class="badge badge-rank">${CURRENT_PILOT?.rank || 'Unknown'}</span> |
                            Total Time: ${Number(roster.totalFlightTime || 0).toFixed(1)} hrs
                        </small>
                        <div class="roster-path">${roster.legs.map(l => l.departure).join(' → ')} → ${roster.legs.slice(-1)[0].arrival}</div>
                    </div>

                    <div class="roster-actions">
                        <button class="details-button" data-roster-id="${roster._id}" aria-expanded="false">Details</button>
                        <button class="cta-button go-on-duty-btn" data-roster-id="${roster._id}">Go On Duty</button>
                    </div>

                    <div class="roster-leg-details" id="details-${roster._id}">
                        <ul>
                            ${roster.legs.map(leg => {
                                const reqRank = leg.rankUnlock || deduceRankFromAircraftFE(leg.aircraft);
                                const legOperator = leg.operator || operator;
                                return `
                                  <li>
                                    <div class="leg-main">
                                        <span class="leg-flight-number">${leg.flightNumber} (${leg.departure} → ${leg.arrival})</span>
                                        <span class="leg-meta">
                                            <span class="leg-aircraft">${leg.aircraft}</span>
                                            <span class="leg-time">${Number(leg.flightTime || 0).toFixed(1)} hrs</span>
                                        </span>
                                    </div>
                                    <div class="leg-badges">
                                        <span class="badge badge-operator" title="Operator">${legOperator}</span>
                                        <span class="badge badge-rank" title="Required Rank">Req: ${reqRank}</span>
                                    </div>
                                  </li>`;
                            }).join('')}
                        </ul>
                    </div>
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
                        <div class="pirep-chips">
                            <span class="badge badge-operator">${operator}</span>
                            <span class="badge badge-rank">Req: ${reqRank}</span>
                        </div>
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
        const viewId = link.dataset.view;
        mainContentContainer.querySelector('.content-view.active').classList.remove('active');
        document.getElementById(viewId).classList.add('active');
        
        if (viewId === 'view-rosters' && window.leafletMap) {
            // A brief timeout ensures the browser has rendered the container before resizing the map.
            setTimeout(() => {
                window.leafletMap.invalidateSize();
            }, 150);
        }
    });

    // PIREP submit (FormData for image)
    mainContentContainer.addEventListener('submit', async (e) => {
        if (e.target.id === 'pirep-form') {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.textContent = 'Filing...';

            const formData = new FormData();
            formData.append('flightNumber', document.getElementById('flight-number').value.toUpperCase());
            formData.append('departure', document.getElementById('departure-icao').value.toUpperCase());
            formData.append('arrival', document.getElementById('arrival-icao').value.toUpperCase());
            formData.append('aircraft', document.getElementById('aircraft-select').value);
            formData.append('operator', document.getElementById('operator-select').value);
            formData.append('flightTime', document.getElementById('flight-time').value);
            formData.append('remarks', document.getElementById('remarks').value);

            const imageInput = document.getElementById('verification-image');
            if (imageInput.files.length > 0) {
                formData.append('verificationImage', imageInput.files[0]);
            } else {
                showNotification('Error: You must upload a verification image.', 'error');
                btn.disabled = false;
                btn.textContent = 'File Report';
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/pireps`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Failed to file report.');
                showNotification('Report submitted successfully!', 'success');
                fetchPilotData();
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                btn.disabled = false;
                btn.textContent = 'File Report';
            }
        }
    });

    mainContentContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('details-button')) {
            const rosterId = e.target.dataset.rosterId;
            const detailsPanel = document.getElementById(`details-${rosterId}`);
            if (detailsPanel) {
                const nowVisible = !detailsPanel.classList.contains('visible');
                detailsPanel.classList.toggle('visible', nowVisible);
                e.target.setAttribute('aria-expanded', String(nowVisible));
                e.target.textContent = nowVisible ? 'Hide' : 'Details';

                if (nowVisible) { window.highlightRoster?.(rosterId); }
                else { window.resetHighlights?.(); }
            }
        }

        if (e.target.classList.contains('go-on-duty-btn')) {
            const rosterId = e.target.dataset.rosterId;
            e.target.disabled = true;
            e.target.textContent = 'Starting...';
            try {
                const response = await fetch(`${API_BASE_URL}/api/duty/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ rosterId })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Failed to start duty.');
                showNotification(result.message, 'success');
                await fetchPilotData();
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                document.querySelectorAll(`.go-on-duty-btn[data-roster-id="${rosterId}"]`).forEach(btn => {
                    btn.disabled = false;
                    btn.textContent = 'Go On Duty';
                });
            }
        }

        if (e.target.id === 'end-duty-btn') {
            e.target.disabled = true;
            e.target.textContent = 'Completing...';
            try {
                const response = await fetch(`${API_BASE_URL}/api/duty/end`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Failed to end duty.');

                if (result.promotionDetails) { showPromotionModal(result.promotionDetails); }
                else { showNotification(result.message, 'success'); }

                await fetchPilotData();
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
                e.target.disabled = false;
                e.target.textContent = 'Complete Duty Day';
            }
        }
    });

    // Modal close
    modalCloseBtn.addEventListener('click', hidePromotionModal);
    modalConfirmBtn.addEventListener('click', hidePromotionModal);
    promotionModal.addEventListener('click', (e) => { if (e.target === promotionModal) hidePromotionModal(); });

    // Initial load
    fetchPilotData();
});