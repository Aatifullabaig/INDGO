// Crew Center – Merged Script with Notifications, View-Switching, Flight Plan Workflow & Promotion Lockout
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const API_BASE_URL = 'https://indgo-backend.onrender.com';

    let crewRestInterval = null; // To manage the countdown timer

    // --- Helper Functions ---
    function formatTime(ms) {
        if (ms < 0) ms = 0;
        let seconds = Math.floor(ms / 1000);
        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);
        seconds = seconds % 60;
        minutes = minutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function formatDuration(seconds) {
        if (isNaN(seconds) || seconds < 0) return '00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    function formatTimeFromTimestamp(timestamp) {
        if (!timestamp) return '----';
        const date = (typeof timestamp === 'number' && timestamp.toString().length === 10) 
            ? new Date(timestamp * 1000) 
            : new Date(timestamp);
        if (isNaN(date.getTime())) return '----';
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    }
    
    function formatWeight(kg) {
        if (isNaN(kg)) return '--- kg';
        return `${Number(kg).toLocaleString()} kg`;
    }
    
    const parseMetar = (metarString) => {
        if (!metarString || typeof metarString !== 'string') {
            return { wind: '---', temp: '---', condition: '---' };
        }
        const parts = metarString.split(' ');
        const wind = parts.find(p => p.endsWith('KT'));
        const temp = parts.find(p => p.includes('/') && !p.startsWith('A') && !p.startsWith('Q'));
        const condition = parts.filter(p => /^(FEW|SCT|BKN|OVC|SKC|CLR|NSC)/.test(p)).join(' ');
        return {
            wind: wind || '---',
            temp: temp ? `${temp.split('/')[0]}°C` : '---',
            condition: condition || '---'
        };
    };

    function extractAirlineCode(flightNumber) {
        if (!flightNumber || typeof flightNumber !== 'string') return 'UNKNOWN';
        const cleanedFlightNumber = flightNumber.trim().toUpperCase();
        const match = cleanedFlightNumber.match(/^([A-Z0-9]{2,3})([0-9]{1,4})([A-Z]?)$/);
        if (match && match[1]) return match[1].substring(0, 2);
        const fallbackMatch = cleanedFlightNumber.match(/^(\D+)/);
        if (fallbackMatch && fallbackMatch[1]) return fallbackMatch[1].substring(0, 2);
        return 'UNKNOWN';
    }

    // --- Rank & Fleet Models ---
    const PILOT_RANKS = [
        'IndGo Cadet', 'Skyline Observer', 'Route Explorer', 'Skyline Officer',
        'Command Captain', 'Elite Captain', 'Blue Eagle', 'Line Instructor',
        'Chief Flight Instructor', 'IndGo SkyMaster', 'Blue Legacy Commander'
    ];
    const rankIndex = (r) => PILOT_RANKS.indexOf(String(r || '').trim());
    
    const FLEET = [
        { code:'DH8D', name:'De Havilland Dash 8 Q400', minRank:'IndGo Cadet', operator:'IndGo Air Virtual' },
        { code:'A320', name:'Airbus A320',              minRank:'IndGo Cadet', operator:'IndGo Air Virtual' },
        { code:'B738', name:'Boeing 737-800',           minRank:'IndGo Cadet', operator:'IndGo Air Virtual' },
        { code:'A321', name:'Airbus A321',              minRank:'Skyline Observer', operator:'IndGo Air Virtual' },
        { code:'B739', name:'Boeing 737-900',      minRank:'Skyline Observer', operator:'IndGo Air Virtual' },
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

    const deduceRankFromAircraftFE = (acStr) => {
        const s = String(acStr || '').toUpperCase();
        const has = (pat) => new RegExp(pat, 'i').test(s);
        if (has('(DH8D|Q400|A320|B738)')) return 'IndGo Cadet';
        if (has('(A321|B737|B739)')) return 'Skyline Observer';
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
    const mainContentLoader = document.getElementById('main-content-loader'); // <-- ADDED
    const sidebarNav = document.querySelector('.sidebar-nav');
    const dashboardContainer = document.querySelector('.dashboard-container');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const notificationsBell = document.getElementById('notifications-bell');
    const notificationsModal = document.getElementById('notifications-modal');

    // Modals
    const promotionModal = document.getElementById('promotion-modal');
    const arriveFlightModal = document.getElementById('arrive-flight-modal');

    // Global state
    let CURRENT_PILOT = null;
    let ACTIVE_FLIGHT_PLAN = null;
    let CURRENT_OFP_DATA = null; // To hold SimBrief data temporarily

    // --- Auth & Initial Setup ---
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Function to switch views
    const switchView = (viewId) => {
        sidebarNav.querySelector('.nav-link.active')?.classList.remove('active');
        mainContentContainer.querySelector('.content-view.active')?.classList.remove('active');

        const newLink = sidebarNav.querySelector(`.nav-link[data-view="${viewId}"]`);
        const newView = document.getElementById(viewId);

        if (newLink && newView) {
            newLink.classList.add('active');
            newView.classList.add('active');
        }
    };
    
    // Check for URL parameters to set the initial view
    const urlParams = new URLSearchParams(window.location.search);
    const initialView = urlParams.get('view');
    if (initialView) {
        switchView(initialView);
    }

    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('authToken');
        showNotification('You have been logged out.', 'success');
        setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    });

    if (localStorage.getItem('sidebarState') === 'collapsed') {
        dashboardContainer.classList.add('sidebar-collapsed');
    }
    sidebarToggleBtn.addEventListener('click', () => {
        dashboardContainer.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarState', dashboardContainer.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded');
    });

    // --- Main Data Fetch & Render Cycle ---
    const fetchPilotData = async () => {
        try {
            const oldRank = CURRENT_PILOT ? CURRENT_PILOT.rank : null;

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

            // Update notification bell
            const badge = notificationsBell.querySelector('.notification-badge');
            if (pilot.unreadNotifications && pilot.unreadNotifications.length > 0) {
                badge.textContent = pilot.unreadNotifications.length;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        
            await renderAllViews(pilot);

            if (oldRank && pilot.rank !== oldRank && rankIndex(pilot.rank) > rankIndex(oldRank)) {
                showPromotionModal(pilot.rank);
            }

            await handleSimbriefReturn();

        } catch (error) {
            console.error('Error fetching pilot data:', error);
            showNotification(error.message, 'error');
        } finally { // <-- ADDED finally block
            // Hide the loader regardless of success or failure
            if (mainContentLoader) {
                mainContentLoader.classList.remove('active');
            }
        }
    };
    
    const showPromotionModal = (newRank) => {
        const rankNameElem = document.getElementById('promo-rank-name');
        const perksListElem = document.getElementById('promo-perks-list');
        const confirmBtn = document.getElementById('modal-confirm-btn');

        if (!rankNameElem || !perksListElem || !promotionModal) return;

        rankNameElem.textContent = newRank;

        const newAircraft = FLEET.filter(ac => ac.minRank === newRank);
        if (newAircraft.length > 0) {
            perksListElem.innerHTML = newAircraft.map(ac => `<li><i class="fa-solid fa-plane-circle-check"></i> <strong>${ac.name}</strong> (${ac.code})</li>`).join('');
        } else {
            perksListElem.innerHTML = '<li>More perks and features will be available as you advance.</li>';
        }

        promotionModal.classList.add('visible');

        const closeHandler = () => {
            promotionModal.classList.remove('visible');
            confirmBtn.removeEventListener('click', closeHandler);
        };
        confirmBtn.addEventListener('click', closeHandler);
    };

    // --- View Rendering Logic ---
    const renderAllViews = async (pilot) => {
        const leaderboardsHTML = await fetchAndDisplayLeaderboards();
        
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

    const createHubHeaderHTML = (pilot, title) => `
        <div class="hub-header">
            <h2>${title}</h2>
            <div class="hub-stats-grid">
                <div class="hub-stat-item">
                    <strong>Rank</strong>
                    <span>${pilot.rank || '---'}</span>
                </div>
                <div class="hub-stat-item">
                    <strong>Flight Hours</strong>
                    <span>${(pilot.flightHours || 0).toFixed(1)}</span>
                </div>
            </div>
        </div>
    `;

    const renderPilotHubView = async (pilot, leaderboardsHTML) => {
        const dutyStatusView = document.getElementById('view-duty-status');
        if (crewRestInterval) clearInterval(crewRestInterval);

        const pendingBanner = pilot.promotionStatus === 'PENDING_TEST' ? getPendingTestBannerHTML() : '';
        let dutyStatusHTML = '';

        if (pilot.dutyStatus === 'ON_DUTY') {
            dutyStatusHTML = await renderOnDutyContent(pilot);
        } else {
            dutyStatusHTML = renderOnRestContent(pilot);
        }

        dutyStatusView.innerHTML = `${pendingBanner}${dutyStatusHTML}${leaderboardsHTML}`;

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
        let content = '';
        let title = '';

        if (pilot.timeUntilNextDutyMs > 0) {
            title = '<i class="fa-solid fa-bed"></i> Current Status: 🔴 On Rest (Mandatory)';
            content = `
                <div class="crew-rest-notice">
                    <p>A minimum <strong>8-hour rest period</strong> is required after completing a duty. You may go on duty again after this period has elapsed.</p>
                    <p>Time remaining until next duty:</p>
                    <div class="crew-rest-timer-display" id="crew-rest-timer">--:--:--</div>
                </div>`;
        } else {
            title = '<i class="fa-solid fa-user-clock"></i> Current Status: 🔴 On Rest';
            content = `<p>You are eligible for your next assignment. To begin, please select a roster from the Sector Ops page.</p>`;
        }
        
        return `
            <div class="pilot-hub-card">
                ${createHubHeaderHTML(pilot, title)}
                ${content}
            </div>`;
    };

    const renderOnDutyContent = async (pilot) => {
        if (!pilot.currentRoster) return `<div class="content-card"><p>Error: On duty but no roster data found.</p></div>`;

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

            const headerTitle = '<i class="fa-solid fa-plane-departure"></i> Current Status: 🟢 On Duty';

            return `
                <div class="pilot-hub-card">
                    ${createHubHeaderHTML(pilot, headerTitle)}
                    <div class="on-duty-header">
                        <div>
                            <p style="margin: 0;"><strong>Active Roster:</strong> ${currentRoster.name}</p>
                            <p class="muted" style="margin: 0;">Complete your assigned flights via the <strong>Flight Plan</strong> page.</p>
                        </div>
                        <button id="end-duty-btn" class="end-duty-btn">Complete Duty Day</button>
                    </div>
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
            return `<div class="content-card"><p class="error-text">${error.message}</p></div>`;
        }
    };

    // --- Flight Plan View ---
    const renderFlightPlanView = (pilot) => {
        const formContainer = document.getElementById('file-flight-plan-container');
        const dispatchDisplay = document.getElementById('dispatch-pass-display');

        dispatchDisplay.style.display = 'none';
        formContainer.style.display = 'block';

        // Global restrictions still apply
        if (pilot.promotionStatus === 'PENDING_TEST') {
            formContainer.innerHTML = `<div class="content-card">${getPendingTestBannerHTML()}</div>`;
            return;
        }

        // If there's an active plan, show it
        if (ACTIVE_FLIGHT_PLAN) {
            populateDispatchFromActivePlan(ACTIVE_FLIGHT_PLAN);
        } else {
            // Otherwise, show the form to file a new plan, regardless of duty status
            const planHTML = getFileFlightPlanHTML(pilot);
            const onDutyMessage = pilot.dutyStatus === 'ON_DUTY' 
                ? `<p>You are <strong>On Duty</strong>. If your flight number matches a leg in your active roster, it will be automatically linked.</p>`
                : `<p>You are currently <strong>Off Duty</strong>. This flight will be logged as a non-roster flight and will not affect your duty time limits.</p>`;
            
            formContainer.innerHTML = planHTML.replace(
                '<form id="file-flight-plan-form">', 
                `${onDutyMessage}<form id="file-flight-plan-form">`
            );
        }
    };
    
    const populateDispatchFromActivePlan = (plan) => {
        const dispatchDisplay = document.getElementById('dispatch-pass-display');
        const formContainer = document.getElementById('file-flight-plan-container');

        document.getElementById('dispatch-flight-number').textContent = plan.flightNumber || 'N/A';
        document.getElementById('dispatch-route-short').textContent = `${plan.departure} → ${plan.arrival}`;
        document.getElementById('dispatch-date').textContent = new Date(plan.etd).toLocaleDateString();

        document.getElementById('dispatch-callsign').textContent = CURRENT_PILOT?.callsign || 'N/A';
        document.getElementById('dispatch-aircraft').textContent = plan.aircraft || 'N/A';
        document.getElementById('dispatch-etd').textContent = formatTimeFromTimestamp(plan.etd);
        document.getElementById('dispatch-eta').textContent = formatTimeFromTimestamp(plan.eta);
        document.getElementById('dispatch-duration').textContent = formatDuration(plan.eet * 3600);

        document.getElementById('dispatch-zfw').textContent = formatWeight(plan.zfw);
        document.getElementById('dispatch-tow').textContent = formatWeight(plan.tow);
        document.getElementById('dispatch-pax').textContent = plan.pob || '---';
        document.getElementById('dispatch-cargo').textContent = formatWeight(plan.cargo);
        document.getElementById('dispatch-fuel-taxi').textContent = formatWeight(plan.fuelTaxi);
        document.getElementById('dispatch-fuel-trip').textContent = formatWeight(plan.fuelTrip);
        document.getElementById('dispatch-fuel-total').textContent = formatWeight(plan.fuelTotal);
        
        document.getElementById('dispatch-v1').textContent = plan.v1 || '--- kts';
        document.getElementById('dispatch-v2').textContent = plan.v2 || '--- kts';
        document.getElementById('dispatch-vr').textContent = plan.vr || '--- kts';
        document.getElementById('dispatch-vref').textContent = plan.vref || '--- kts';
        
        const departureWeather = parseMetar(plan.departureWeather);
        const arrivalWeather = parseMetar(plan.arrivalWeather);

        document.getElementById('dispatch-dep-cond').textContent = departureWeather.condition;
        document.getElementById('dispatch-dep-temp').textContent = departureWeather.temp;
        document.getElementById('dispatch-dep-wind').textContent = departureWeather.wind;
        
        document.getElementById('dispatch-arr-cond').textContent = arrivalWeather.condition;
        document.getElementById('dispatch-arr-temp').textContent = arrivalWeather.temp;
        document.getElementById('dispatch-arr-wind').textContent = arrivalWeather.wind;

        document.getElementById('dispatch-fic').textContent = plan.ficNumber || 'N/A';
        document.getElementById('dispatch-adc').textContent = plan.adcNumber || 'N/A';
        document.getElementById('dispatch-squawk').textContent = plan.squawkCode || '----';

        document.getElementById('dispatch-route-full').textContent = plan.route;
        document.getElementById('dispatch-alternates').textContent = plan.alternate || 'None';

        const actionsContainer = document.getElementById('dispatch-actions');
        let actionsHTML = '';
        if (plan.status === 'PLANNED') {
            actionsHTML = `
                <button id="depart-btn" class="cta-button" data-plan-id="${plan._id}">Depart</button>
                <button id="cancel-btn" class="end-duty-btn" data-plan-id="${plan._id}">Cancel Flight Plan</button>`;
        } else if (plan.status === 'FLYING') {
            actionsHTML = `<button id="arrive-btn" class="cta-button" data-plan-id="${plan._id}">Arrive & File PIREP</button>`;
        }
        actionsContainer.innerHTML = actionsHTML;

        formContainer.style.display = 'none';
        dispatchDisplay.style.display = 'block';
    };

    const getFileFlightPlanHTML = (pilot) => {
        const allowed = getAllowedFleet(pilot.rank);
        return `
        <div class="content-card">
            <h2><i class="fa-solid fa-file-pen"></i> File New Flight Plan</h2>
            <p>Your aircraft list is filtered to what <strong>${pilot.rank}</strong> is allowed to fly. Use SimBrief to generate and populate the fields below.</p>
            
            <form id="file-flight-plan-form">
                <div class="form-group-row">
                    <div class="form-group">
                        <label>Flight Number</label>
                        <input type="text" id="fp-flightNumber" required>
                    </div>
                    <div class="form-group">
                        <label>Aircraft</label>
                        <select id="fp-aircraft" required>
                            <option value="" disabled selected>-- Select Aircraft --</option>
                            ${allowed.map(ac => `<option value="${ac.code}">${ac.name} (${ac.code})</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Departure (ICAO)</label><input type="text" id="fp-departure" required maxlength="4"></div>
                    <div class="form-group"><label>Arrival (ICAO)</label><input type="text" id="fp-arrival" required maxlength="4"></div>
                    <div class="form-group"><label>Alternate (ICAO)</label><input type="text" id="fp-alternate" maxlength="4"></div>
                </div>
                <div class="form-group">
                    <label>Route</label>
                    <textarea id="fp-route" rows="3" required></textarea>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>ETD (Your Local Time)</label><input type="datetime-local" id="fp-etd" required></div>
                    <div class="form-group"><label>EET (Hours)</label><input type="number" step="0.1" id="fp-eet" required></div>
                    <div class="form-group"><label>Persons on Board</label><input type="number" id="fp-pob" required></div>
                </div>
                <div class="form-actions" style="display: flex; gap: 10px; margin-top: 1rem;">
                    <button type="submit" class="cta-button">File Flight Plan</button>
                    <button type="button" id="generate-with-simbrief-btn" class="secondary-button">Generate with SimBrief</button>
                </div>
            </form>
        </div>`;
    };

    // --- Other Data Display Functions ---
    const renderLeaderboardList = (title, data, valueKey) => {
        if (!data || data.length === 0) return `<h4>Top by ${title}</h4><p class="muted">No data available yet.</p>`;
        
        const unit = title === 'Hours' ? 'hrs' : 'flights';

        return `
            <h4><i class="fa-solid ${title === 'Hours' ? 'fa-stopwatch' : 'fa-plane-arrival'}"></i> Top by ${title}</h4>
            <div class="leaderboard-list">
                ${data.map((pilot, index) => {
                    const rankClass = index === 0 ? 'rank-1' : '';
                    const rankContent = index === 0 ? '<i class="fas fa-crown"></i>' : index + 1;
                    
                    return `
                    <div class="leaderboard-entry ${rankClass}">
                        <span class="rank-position">${rankContent}</span>
                        <div class="pilot-info">
                            <strong>${pilot.name}</strong>
                            <small>${pilot.callsign || 'N/A'}</small>
                        </div>
                        <div class="score">
                            ${Number(pilot[valueKey] || 0).toFixed(1)}
                            <span class="unit">${unit}</span>
                        </div>
                    </div>
                    `;
                }).join('')}
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
            return `
                <div class="content-card">
                    <h2><i class="fa-solid fa-trophy"></i> Leaderboards</h2>
                    <div class="leaderboards-container">
                        <div class="leaderboard-card redesigned">
                            <h3>This Week</h3>
                            ${renderLeaderboardList('Hours', weeklyData.topByHours, 'weeklyFlightHours')}
                            ${renderLeaderboardList('Sectors', weeklyData.topBySectors, 'weeklySectors')}
                        </div>
                        <div class="leaderboard-card redesigned">
                            <h3>This Month</h3>
                            ${renderLeaderboardList('Hours', monthlyData.topByHours, 'leaderboardMonthlyFlightHours')}
                            ${renderLeaderboardList('Sectors', monthlyData.topBySectors, 'monthlySectors')}
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
        header.innerHTML = '<p>Finding rosters for your location...</p>';
        try {
            const response = await fetch(`${API_BASE_URL}/api/rosters/my-rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Could not fetch personalized rosters.');
            const data = await response.json();
            const rosters = data.rosters || [];
            const criteria = data.searchCriteria || {};

            if (criteria.searched?.length > 0) {
                header.innerHTML = `
                    <div class="roster-header-info">
                        Showing rosters for <strong>${criteria.searched.join(' & ')}</strong>
                        <span class="badge badge-rank ml-8">Your rank: ${CURRENT_PILOT?.rank || 'Unknown'}</span>
                    </div>
                `;
                if (window.plotRosters) window.plotRosters(criteria.searched[0], rosters);
            } else {
                header.innerHTML = 'No location data found. Showing rosters from primary hubs.';
            }

            if (rosters.length === 0) {
                container.innerHTML = '<p>There are no rosters available from your current location(s).</p>';
                return;
            }

            container.innerHTML = rosters.map(roster => {
                const dutyDisabled = CURRENT_PILOT?.promotionStatus === 'PENDING_TEST' ? 'disabled' : '';
                const uniqueAirlines = [...new Set(roster.legs.map(leg => extractAirlineCode(leg.flightNumber)))];
                const airlineLogosHTML = uniqueAirlines.map(code => {
                    if (!code || code === 'UNKNOWN') return '';
                    const logoPath = `Images/vas/${code}.png`;
                    return `<img src="${logoPath}" alt="${code}" class="roster-airline-logo" onerror="this.style.display='none'">`;
                }).join('');

                const firstLeg = roster.legs[0];
                const lastLeg = roster.legs[roster.legs.length - 1];
                const pathString = [roster.legs[0].departure, ...roster.legs.map(leg => leg.arrival)].join(' → ');

                return `
                <div class="roster-item" data-roster-id="${roster._id}">
                    <div class="roster-card-header">
                        <div class="roster-airlines">${airlineLogosHTML}</div>
                        <div class="roster-title-info">
                            <span class="roster-name">${roster.name}</span>
                            <span class="roster-meta">Total: ${Number(roster.totalFlightTime || 0).toFixed(1)} hrs</span>
                        </div>
                    </div>
                    <div class="roster-flight-info">
                        <div class="flight-segment departure">
                            <span class="segment-label">Departs</span>
                            <span class="segment-icao">${firstLeg.departure}</span>
                            <span class="segment-time">TBA</span>
                        </div>
                        <div class="flight-divider"><i class="fa-solid fa-plane"></i></div>
                        <div class="flight-segment arrival">
                            <span class="segment-label">Arrives</span>
                            <span class="segment-icao">${lastLeg.arrival}</span>
                            <span class="segment-time">TBA</span>
                        </div>
                    </div>
                    <div class="roster-card-footer">
                        <div class="roster-path-display">${pathString}</div>
                        <div class="roster-actions">
                            <button class="details-button" data-roster-id="${roster._id}" aria-expanded="false">Details</button>
                            <button class="cta-button go-on-duty-btn" data-roster-id="${roster._id}" ${dutyDisabled}>Go On Duty</button>
                        </div>
                    </div>
                    <div class="roster-leg-details" id="details-${roster._id}"></div>
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
            container.innerHTML = pireps.map(p => {
                const created = new Date(p.createdAt).toLocaleDateString();
                const reqRank = deduceRankFromAircraftFE(p.aircraft);
                return `
                <div class="pirep-history-item status-${p.status.toLowerCase()}">
                    <div class="pirep-info">
                        <strong>${p.flightNumber}</strong> (${p.departure} - ${p.arrival})
                        <small>${created}</small>
                        <div class="pirep-chips">
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

    // --- Navigation ---
    sidebarNav.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (!link) return;
        e.preventDefault();

        const viewId = link.dataset.view;
        if (viewId) {
            switchView(viewId);
            if (viewId === 'view-rosters' && window.leafletMap) {
                setTimeout(() => window.leafletMap.invalidateSize(), 150);
            }
        }
    });

    // --- Global Event Listeners for Actions ---
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
                if (!res.ok) throw new Error(result.message || 'Failed to file flight plan.');
                showNotification(result.message, 'success');
                await fetchPilotData();
            } catch(err) {
                showNotification(`Error: ${err.message}`, 'error');
                btn.disabled = false;
                btn.textContent = 'File Flight Plan';
            }
        }
    });

    mainContentContainer.addEventListener('click', async (e) => {
        const target = e.target;
        
        if (target.classList.contains('details-button') && target.dataset.rosterId && !target.classList.contains('view-roster-on-map-btn')) {
            const rosterId = target.dataset.rosterId;
            const detailsContainer = document.getElementById(`details-${rosterId}`);

            document.querySelectorAll('.roster-leg-details.visible').forEach(openDetail => {
                if (openDetail.id !== `details-${rosterId}`) {
                    openDetail.classList.remove('visible');
                    const otherId = openDetail.id.replace('details-', '');
                    document.querySelector(`.details-button[data-roster-id="${otherId}"]`).setAttribute('aria-expanded', 'false');
                }
            });

            const isVisible = detailsContainer.classList.toggle('visible');
            target.setAttribute('aria-expanded', isVisible);

            if (isVisible) {
                if (window.focusOnRoster) window.focusOnRoster(rosterId);
            } else {
                if (window.showAllRosters) window.showAllRosters();
            }

            if (isVisible && !detailsContainer.innerHTML.trim()) {
                detailsContainer.innerHTML = '<p>Loading details...</p>';
                try {
                    const res = await fetch(`${API_BASE_URL}/api/rosters/my-rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (!res.ok) throw new Error('Could not fetch roster details.');
                    const rosterData = await res.json();
                    const allRosters = rosterData.rosters || [];
                    const roster = allRosters.find(r => r._id === rosterId);
                    const isMultiAircraft = roster.legs.some((leg, i, arr) => i > 0 && leg.aircraft !== arr[0].aircraft);

                    if (roster && roster.legs) {
                        detailsContainer.innerHTML = `
                            <div class="roster-details-actions">
                                <button class="details-button view-roster-on-map-btn" data-roster-id="${rosterId}">
                                    <i class="fa-solid fa-map-location-dot"></i> View Route on Map
                                </button>
                            </div>
                            <ul>
                                ${roster.legs.map(leg => {
                                    const airlineCode = extractAirlineCode(leg.flightNumber);
                                    const logoPath = airlineCode ? `Images/vas/${airlineCode}.png` : 'images/default-airline.png';
                                    let legAircraftImageHTML = '';
                                    if (isMultiAircraft) {
                                        const legAircraftCode = leg.aircraft;
                                        const legAirlineCode = extractAirlineCode(leg.flightNumber);
                                        const liveryImagePath = `Images/liveries/${legAirlineCode}_${legAircraftCode}.png`;
                                        const genericImagePath = `Images/planesForCC/${legAircraftCode}.png`;
                                        legAircraftImageHTML = `
                                        <div class="leg-aircraft-image-container">
                                            <img src="${liveryImagePath}" 
                                                 alt="${legAirlineCode} ${legAircraftCode}" 
                                                 class="leg-aircraft-image"
                                                 onerror="this.onerror=null; this.src='${genericImagePath}'; this.alt='${legAircraftCode}';">
                                        </div>`;
                                    }
                                    return `
                                    <li class="${isMultiAircraft ? 'multi-aircraft-leg' : ''}">
                                        <div class="leg-main-content">
                                            <div class="leg-header">
                                                <img src="${logoPath}" class="leg-airline-logo" alt="${airlineCode}" onerror="this.style.display='none'">
                                                <span class="leg-airline-name">${leg.operator} (${leg.flightNumber})</span>
                                            </div>
                                            <div class="leg-body">
                                                <div class="leg-departure">
                                                    <span class="leg-label">Departure</span>
                                                    <div class="leg-airport">
                                                        ${leg.departureCountry ? `<img src="https://flagcdn.com/w20/${leg.departureCountry.toLowerCase()}.png" class="country-flag" alt="${leg.departureCountry}">` : ''}
                                                        <span class="leg-icao">${leg.departure}</span>
                                                    </div>
                                                    <small class="leg-details-meta">Aircraft: ${leg.aircraft}</small>
                                                </div>
                                                <div class="leg-icon"><i class="fa-solid fa-plane"></i></div>
                                                <div class="leg-arrival">
                                                    <span class="leg-label">Arrival</span>
                                                    <div class="leg-airport">
                                                        ${leg.arrivalCountry ? `<img src="https://flagcdn.com/w20/${leg.arrivalCountry.toLowerCase()}.png" class="country-flag" alt="${leg.arrivalCountry}">` : ''}
                                                        <span class="leg-icao">${leg.arrival}</span>
                                                    </div>
                                                    <small class="leg-details-meta">EET: ${Number(leg.flightTime || 0).toFixed(1)} hrs</small>
                                                </div>
                                            </div>
                                            <div class="leg-badges-footer">
                                                <span class="badge badge-rank" title="Minimum Rank">Req: ${leg.rankUnlock || deduceRankFromAircraftFE(leg.aircraft)}</span>
                                            </div>
                                        </div>
                                        ${legAircraftImageHTML}
                                    </li>
                                    `;
                                }).join('')}
                            </ul>`;
                    } else {
                        detailsContainer.innerHTML = '<p>Details could not be loaded.</p>';
                    }
                } catch (error) {
                    console.error('Failed to fetch roster details:', error);
                    detailsContainer.innerHTML = `<p class="error-text">${error.message}</p>`;
                }
            }
        }

        if (target.classList.contains('view-roster-on-map-btn') || target.closest('.view-roster-on-map-btn')) {
            const button = target.closest('.view-roster-on-map-btn');
            const rosterId = button.dataset.rosterId;
            if (window.focusOnRoster) {
                window.focusOnRoster(rosterId);
                document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        if (target.classList.contains('go-on-duty-btn')) {
            const rosterId = target.dataset.rosterId;
            target.disabled = true;
            target.textContent = 'Starting...';
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
                target.disabled = false;
                target.textContent = 'Go On Duty';
            }
        }

        if (target.id === 'end-duty-btn') {
            if (confirm('Are you sure you want to complete your duty day? This will put you on mandatory crew rest.')) {
                target.disabled = true;
                target.textContent = 'Completing...';
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
                    target.disabled = false;
                    target.textContent = 'Complete Duty Day';
                }
            }
        }

        const planId = target.dataset.planId;
        if (target.id === 'depart-btn') {
            target.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/flightplans/${planId}/depart`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
                const result = await res.json();
                if (!res.ok) throw new Error(result.message);
                showNotification(result.message, 'success');
                await fetchPilotData();
            } catch (err) { showNotification(err.message, 'error'); target.disabled = false; }
        }
        if (target.id === 'cancel-btn') {
            target.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/flightplans/${planId}/cancel`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
                const result = await res.json();
                if (!res.ok) throw new Error(result.message);
                showNotification(result.message, 'success');
                await fetchPilotData();
            } catch (err) { showNotification(err.message, 'error'); target.disabled = false; }
        }
        if (target.id === 'arrive-btn') {
            document.getElementById('arrive-flight-form').dataset.planId = planId;
            arriveFlightModal.classList.add('visible');
        }

        if (target.id === 'generate-with-simbrief-btn') {
            e.preventDefault();

            const flightNumber = document.getElementById('fp-flightNumber').value.toUpperCase();
            const departure = document.getElementById('fp-departure').value.toUpperCase();
            const arrival = document.getElementById('fp-arrival').value.toUpperCase();
            const aircraft = document.getElementById('fp-aircraft').value;

            if (!flightNumber || !departure || !arrival || !aircraft) {
                showNotification('Please fill in Flight Number, Departure, Arrival, and Aircraft before generating.', 'error');
                return;
            }

            const sbForm = document.getElementById('sbapiform');
            sbForm.querySelector('input[name="orig"]').value = departure;
            sbForm.querySelector('input[name="dest"]').value = arrival;
            sbForm.querySelector('input[name="type"]').value = aircraft;
            sbForm.querySelector('input[name="fltnum"]').value = flightNumber;

            showNotification('Opening SimBrief planner...', 'info');

            // Add a URL parameter to remember the view on redirect
            const redirectUrl = window.location.origin + window.location.pathname + '?view=view-flight-plan';
            simbriefsubmit(redirectUrl);
        }

        if (target.id === 'dispatch-close-btn') {
            document.getElementById('dispatch-pass-display').style.display = 'none';
            document.getElementById('file-flight-plan-container').style.display = 'block';
            CURRENT_OFP_DATA = null;
        }

        if (target.id === 'file-from-simbrief-btn') {
            e.preventDefault();
            if (!CURRENT_OFP_DATA) {
                showNotification('Error: SimBrief data not found. Please regenerate the flight plan.', 'error');
                return;
            }

            target.disabled = true;
            target.textContent = 'Filing...';

            try {
                const ofpData = CURRENT_OFP_DATA;
                const plannedRunway = ofpData.tlr?.takeoff?.conditions?.planned_runway;
                const runwayData = ofpData.tlr?.takeoff?.runway?.find(r => r.identifier === plannedRunway);
                const v1 = runwayData?.speeds_v1 ?? '---';
                const vr = runwayData?.speeds_vr ?? '---';
                const v2 = runwayData?.speeds_v2 ?? '---';
                const vref = ofpData.tlr?.landing?.distance_dry?.speeds_vref ?? '---';
                const cargoWeight = ofpData.weights.payload - (ofpData.general.passengers * ofpData.weights.pax_weight);
                
                const body = {
                    flightNumber: ofpData.general.flight_number,
                    aircraft: ofpData.aircraft.icaocode,
                    departure: ofpData.origin.icao_code,
                    arrival: ofpData.destination.icao_code,
                    alternate: ofpData.alternate.icao_code,
                    route: ofpData.general.route,
                    etd: new Date(ofpData.times.sched_out * 1000).toISOString(),
                    eet: ofpData.times.est_time_enroute / 3600, 
                    pob: parseInt(ofpData.general.passengers, 10),
                    squawkCode: ofpData.atc.squawk,
                    zfw: ofpData.weights.est_zfw,
                    tow: ofpData.weights.est_tow,
                    cargo: cargoWeight,
                    fuelTaxi: ofpData.fuel.taxi,
                    fuelTrip: ofpData.fuel.enroute_burn,
                    fuelTotal: ofpData.fuel.plan_ramp,
                    v1: `${v1} kts`,
                    vr: `${vr} kts`,
                    v2: `${v2} kts`,
                    vref: `${vref} kts`,
                    departureWeather: ofpData.weather.orig_metar,
                    arrivalWeather: ofpData.weather.dest_metar
                };

                const res = await fetch(`${API_BASE_URL}/api/flightplans`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(body)
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.message || 'Failed to file flight plan.');
                
                showNotification(result.message, 'success');
                CURRENT_OFP_DATA = null;
                await fetchPilotData();
                
            } catch (err) {
                showNotification(`Error: ${err.message}`, 'error');
                target.disabled = false;
                target.textContent = 'File This Flight Plan';
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
        const imageInput = document.getElementById('arrival-verification-image');
        if (imageInput.files.length > 0) {
            formData.append('verificationImage', imageInput.files[0]);
        } else {
             showNotification('Error: You must upload a verification image.', 'error');
             btn.disabled = false;
             btn.textContent = 'Complete Flight';
             return;
        }

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
            btn.disabled = false;
            btn.textContent = 'Complete Flight';
        }
    });

    document.body.addEventListener('click', e => {
        if (e.target.hasAttribute('data-close-modal')) {
            e.target.closest('.modal-overlay').classList.remove('visible');
        }
    });

    // Notifications Modal Logic
    notificationsBell.addEventListener('click', async (e) => {
        e.preventDefault();
        const container = document.getElementById('notifications-list-container');
        container.innerHTML = `<p>Loading notifications...</p>`;
        notificationsModal.classList.add('visible');

        try {
            const response = await fetch(`${API_BASE_URL}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } });
            const pilot = await response.json();
            const notifications = pilot.notifications || [];

            if (notifications.length === 0) {
                container.innerHTML = '<p>You have no notifications.</p>';
                return;
            }
            
            const unreadIds = notifications.filter(n => !n.read).map(n => n._id);

            container.innerHTML = `
                <div class="notifications-list">
                    ${notifications.map(n => `
                        <div class="notification-item ${n.read ? 'read' : 'unread'}">
                            <div class="notification-dot"></div>
                            <div class="notification-content">
                                <p>${n.message}</p>
                                <small>${new Date(n.createdAt).toLocaleString()}</small>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${unreadIds.length > 0 ? '<button id="mark-all-read-btn" class="cta-button">Mark All as Read</button>' : ''}
            `;

            if (unreadIds.length > 0) {
                document.getElementById('mark-all-read-btn').addEventListener('click', async () => {
                    await fetch(`${API_BASE_URL}/api/me/notifications/read`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ notificationIds: unreadIds })
                    });
                    notificationsModal.classList.remove('visible');
                    fetchPilotData(); // Refresh to update the badge
                });
            }

        } catch (err) {
            container.innerHTML = '<p class="error-text">Could not load notifications.</p>';
        }
    });
    
    // --- SimBrief Return Handler ---
    const handleSimbriefReturn = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const ofpId = urlParams.get('ofp_id');

        if (ofpId) {
            showNotification('Fetching flight plan from SimBrief...', 'info');

            try {
                const response = await fetch(`/.netlify/functions/simbrief?fetch_ofp=true&ofp_id=${ofpId}`);
                if (!response.ok) {
                    throw new Error('Could not retrieve flight plan from SimBrief.');
                }
                const data = await response.json();
                
                CURRENT_OFP_DATA = data.OFP;
                const ofpData = CURRENT_OFP_DATA;
                
                const dispatchDisplay = document.getElementById('dispatch-pass-display');
                const formContainer = document.getElementById('file-flight-plan-container');

                if (!dispatchDisplay || !formContainer) {
                    throw new Error('Dispatch or form container not found in the DOM.');
                }

                document.getElementById('dispatch-flight-number').textContent = ofpData.general.flight_number || 'N/A';
                document.getElementById('dispatch-route-short').textContent = `${ofpData.origin.icao_code} → ${ofpData.destination.icao_code}`;
                document.getElementById('dispatch-date').textContent = new Date().toLocaleDateString();

                document.getElementById('dispatch-callsign').textContent = ofpData.atc.callsign || 'N/A';
                document.getElementById('dispatch-aircraft').textContent = ofpData.aircraft.icaocode || 'N/A';
                document.getElementById('dispatch-etd').textContent = formatTimeFromTimestamp(ofpData.times.sched_out);
                document.getElementById('dispatch-eta').textContent = formatTimeFromTimestamp(ofpData.times.sched_in);
                document.getElementById('dispatch-duration').textContent = formatDuration(ofpData.times.est_time_enroute);

                document.getElementById('dispatch-fuel-taxi').textContent = formatWeight(ofpData.fuel.taxi);
                document.getElementById('dispatch-fuel-trip').textContent = formatWeight(ofpData.fuel.enroute_burn);
                document.getElementById('dispatch-fuel-total').textContent = formatWeight(ofpData.fuel.plan_ramp);
                document.getElementById('dispatch-zfw').textContent = formatWeight(ofpData.weights.est_zfw);
                document.getElementById('dispatch-tow').textContent = formatWeight(ofpData.weights.est_tow);

                document.getElementById('dispatch-fic').textContent = 'Pending File';
                document.getElementById('dispatch-adc').textContent = 'Pending File';
                document.getElementById('dispatch-squawk').textContent = ofpData.atc.squawk || '----';

                document.getElementById('dispatch-pax').textContent = ofpData.general.passengers || '0';
                const cargoWeight = ofpData.weights.payload - (ofpData.general.passengers * ofpData.weights.pax_weight);
                document.getElementById('dispatch-cargo').textContent = formatWeight(cargoWeight);
                
                const departureWeather = parseMetar(ofpData.weather.orig_metar);
                const arrivalWeather = parseMetar(ofpData.weather.dest_metar);

                document.getElementById('dispatch-dep-cond').textContent = departureWeather.condition;
                document.getElementById('dispatch-dep-temp').textContent = departureWeather.temp;
                document.getElementById('dispatch-dep-wind').textContent = departureWeather.wind;
                
                document.getElementById('dispatch-arr-cond').textContent = arrivalWeather.condition;
                document.getElementById('dispatch-arr-temp').textContent = arrivalWeather.temp;
                document.getElementById('dispatch-arr-wind').textContent = arrivalWeather.wind;

                try {
                    const plannedRunway = ofpData.tlr?.takeoff?.conditions?.planned_runway;
                    const runwayData = ofpData.tlr?.takeoff?.runway?.find(r => r.identifier === plannedRunway);
                    
                    const v1 = runwayData?.speeds_v1 ?? '---';
                    const vr = runwayData?.speeds_vr ?? '---';
                    const v2 = runwayData?.speeds_v2 ?? '---';
                    const vref = ofpData.tlr?.landing?.distance_dry?.speeds_vref ?? '---';
                    
                    document.getElementById('dispatch-v1').textContent = `${v1} kts`;
                    document.getElementById('dispatch-vr').textContent = `${vr} kts`;
                    document.getElementById('dispatch-v2').textContent = `${v2} kts`;
                    document.getElementById('dispatch-vref').textContent = `${vref} kts`;
                } catch (speedError) {
                    console.error("Could not parse V-Speeds:", speedError);
                    document.getElementById('dispatch-v1').textContent = '---';
                    document.getElementById('dispatch-vr').textContent = '---';
                    document.getElementById('dispatch-v2').textContent = '---';
                    document.getElementById('dispatch-vref').textContent = '---';
                }

                document.getElementById('dispatch-route-full').textContent = ofpData.general.route;
                const alternates = [ofpData.alternate?.icao_code, ofpData.alternate2?.icao_code, ofpData.alternate3?.icao_code, ofpData.alternate4?.icao_code]
                    .filter(Boolean)
                    .join(', ');
                document.getElementById('dispatch-alternates').textContent = alternates || 'None';

                const dispatchActionsContainer = document.getElementById('dispatch-actions');
                if (dispatchActionsContainer) {
                    dispatchActionsContainer.innerHTML = `
                        <button id="file-from-simbrief-btn" class="cta-button">File This Flight Plan</button>
                        <button id="dispatch-close-btn" class="end-duty-btn">Close</button>
                    `;
                }

                formContainer.style.display = 'none';
                dispatchDisplay.style.display = 'block';

                showNotification('Dispatch Pass generated successfully!', 'success');
                window.history.replaceState({}, document.title, window.location.pathname);

            } catch (error) {
                showNotification(error.message, 'error');
                CURRENT_OFP_DATA = null;
            }
        }
    };
    
    // --- Initial Load ---
    fetchPilotData();
});