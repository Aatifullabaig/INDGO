// Crew Center – SimBrief (InfinityFree include) integration + existing features
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('authToken');
  const API_BASE_URL = 'https://indgo-backend.onrender.com';

  let crewRestInterval = null;

  // ---------- helpers ----------
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function formatTime(ms) {
    if (ms < 0) ms = 0;
    let s = Math.floor(ms / 1000);
    let m = Math.floor(s / 60);
    let h = Math.floor(m / 60);
    s = s % 60; m = m % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function extractAirlineCode(flightNumber) {
    if (!flightNumber || typeof flightNumber !== 'string') return 'UNKNOWN';
    const cleaned = flightNumber.trim().toUpperCase();
    const m = cleaned.match(/^([A-Z0-9]{2,3})([0-9]{1,4})([A-Z]?)$/);
    if (m && m[1]) return m[1].substring(0, 2);
    const f = cleaned.match(/^(\D+)/);
    if (f && f[1]) return f[1].substring(0, 2);
    return 'UNKNOWN';
  }

  const PILOT_RANKS = [
    'IndGo Cadet','Skyline Observer','Route Explorer','Skyline Officer',
    'Command Captain','Elite Captain','Blue Eagle','Line Instructor',
    'Chief Flight Instructor','IndGo SkyMaster','Blue Legacy Commander'
  ];
  const rankIndex = r => PILOT_RANKS.indexOf(String(r || '').trim());

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

  // ---------- DOM refs ----------
  const pilotNameElem = qs('#pilot-name');
  const pilotCallsignElem = qs('#pilot-callsign');
  const profilePictureElem = qs('#profile-picture');
  const mainContentContainer = qs('.main-content');
  const sidebarNav = qs('.sidebar-nav');
  const dashboardContainer = qs('.dashboard-container');
  const sidebarToggleBtn = qs('#sidebar-toggle');
  const arriveFlightModal = qs('#arrive-flight-modal');

  // ---------- state ----------
  let CURRENT_PILOT = null;
  let ACTIVE_FLIGHT_PLAN = null; // server-side SimBriefFlight if present
  let LAST_FETCHED_OFP = null;   // fetched OFP when returning from SimBrief

  // ---------- auth ----------
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  if (localStorage.getItem('sidebarState') === 'collapsed') {
    dashboardContainer.classList.add('sidebar-collapsed');
  }
  sidebarToggleBtn.addEventListener('click', () => {
    dashboardContainer.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebarState', dashboardContainer.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded');
  });

  // ---------- data boot ----------
  const fetchPilotData = async () => {
    const res = await fetch(`${API_BASE_URL}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) {
      localStorage.removeItem('authToken');
      window.location.href = 'login.html';
      throw new Error('Session invalid. Please log in again.');
    }
    const pilot = await res.json();
    CURRENT_PILOT = pilot;
    ACTIVE_FLIGHT_PLAN = pilot.currentSimbriefFlight;

    pilotNameElem.textContent = pilot.name || 'N/A';
    pilotCallsignElem.textContent = pilot.callsign || 'N/A';
    profilePictureElem.src = pilot.imageUrl || 'images/default-avatar.png';

    await renderAllViews(pilot);
  };

  const renderAllViews = async (pilot) => {
    const leaderboardsHTML = await fetchAndDisplayLeaderboards();
    await renderPilotHubView(pilot, leaderboardsHTML);
    renderFlightPlanView(pilot);
    await fetchAndDisplayRosters();
    await fetchPirepHistory();
  };

  const getPendingTestBannerHTML = () => `
    <div class="pending-test-banner">
      <h3><i class="fa-solid fa-triangle-exclamation"></i> Promotion Pending</h3>
      <p>You have reached the flight hour requirement for the next rank! Staff has been notified to schedule your tests. Flight operations are suspended until your promotion is finalized.</p>
    </div>
  `;

  const createStatsCardHTML = (pilot) => `
    <div class="content-card">
      <h2><i class="fa-solid fa-chart-line"></i> Pilot Stats</h2>
      <div class="stats-grid">
        <div class="stat-item"><strong>Rank</strong><span>${pilot.rank || '---'}</span></div>
        <div class="stat-item"><strong>Flight Hours</strong><span>${(pilot.flightHours || 0).toFixed(1)}</span></div>
      </div>
    </div>
  `;

  const renderOnRestContent = (pilot) => {
    if (pilot.timeUntilNextDutyMs > 0) {
      return `
      <div class="content-card">
        <h2><i class="fa-solid fa-bed"></i> Current Status: 🔴 On Rest (Mandatory)</h2>
        <div class="crew-rest-notice">
          <p>A minimum <strong>8-hour rest period</strong> is required after completing a duty.</p>
          <p>Time remaining until next duty:</p>
          <div class="crew-rest-timer-display" id="crew-rest-timer">--:--:--</div>
        </div>
      </div>`;
    }
    return `
      <div class="content-card">
        <h2><i class="fa-solid fa-user-clock"></i> Current Status: 🔴 On Rest</h2>
        <p>You are eligible for your next assignment. Select a roster or generate a flight with SimBrief.</p>
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

      return `
      <div class="content-card">
        <div class="on-duty-header">
          <h2><i class="fa-solid fa-plane-departure"></i> Current Status: 🟢 On Duty</h2>
          <button id="end-duty-btn" class="end-duty-btn">Complete Duty Day</button>
        </div>
        <p><strong>Active Roster:</strong> ${currentRoster.name}</p>
        <div class="roster-checklist">
          ${currentRoster.legs.map(leg => {
            const isCompleted = filedFlightNumbers.has(leg.flightNumber);
            const reqRank = leg.rankUnlock || deduceRankFromAircraftFE(leg.aircraft);
            return `
              <div class="roster-leg-item ${isCompleted ? 'completed' : ''}">
                <span class="status-icon">${isCompleted ? '✅' : '➡️'}</span>
                <strong class="flight-number">${leg.flightNumber}</strong>
                <span class="route">${leg.departure} - ${leg.arrival}</span>
                <span class="leg-badges"><span class="badge badge-rank">Req: ${reqRank}</span></span>
              </div>`;
          }).join('')}
        </div>
      </div>`;
    } catch (e) {
      return `<div class="content-card"><p class="error-text">${e.message}</p></div>`;
    }
  };

  const renderPilotHubView = async (pilot, leaderboardsHTML) => {
    const dutyStatusView = qs('#view-duty-status');
    if (crewRestInterval) clearInterval(crewRestInterval);

    const pendingBanner = pilot.promotionStatus === 'PENDING_TEST' ? getPendingTestBannerHTML() : '';
    let dutyStatusHTML = '';
    if (pilot.dutyStatus === 'ON_DUTY') {
      dutyStatusHTML = await renderOnDutyContent(pilot);
    } else {
      dutyStatusHTML = renderOnRestContent(pilot);
    }
    dutyStatusView.innerHTML = `${pendingBanner}${dutyStatusHTML}${createStatsCardHTML(pilot)}${leaderboardsHTML}`;

    if (pilot.dutyStatus === 'ON_REST' && pilot.timeUntilNextDutyMs > 0) {
      const timerElement = qs('#crew-rest-timer');
      if (timerElement) {
        let remainingTime = pilot.timeUntilNextDutyMs;
        timerElement.textContent = formatTime(remainingTime);
        crewRestInterval = setInterval(() => {
          remainingTime -= 1000;
          if (remainingTime <= 0) {
            clearInterval(crewRestInterval);
            fetchPilotData();
            showNotification('Crew rest complete. You are now eligible for duty.', 'success');
          } else {
            timerElement.textContent = formatTime(remainingTime);
          }
        }, 1000);
      }
    }
  };

  // ---------- Flight Plan tab ----------
  const renderFlightPlanView = (pilot) => {
    const viewContainer = qs('#view-flight-plan');
    if (pilot.promotionStatus === 'PENDING_TEST') {
      viewContainer.innerHTML = `<div class="content-card">${getPendingTestBannerHTML()}</div>`;
      return;
    }

    // 1) If we returned from SimBrief with an OFP fetched, show it:
    if (LAST_FETCHED_OFP?.summary) {
      const s = LAST_FETCHED_OFP.summary;
      viewContainer.innerHTML = `
        <div class="content-card">
          <h2><i class="fa-solid fa-file-import"></i> SimBrief OFP</h2>
          <div class="flight-plan-details">
            <div class="fp-detail-item"><strong>OFP ID</strong><span>${s.ofp_id}</span></div>
            <div class="fp-detail-item"><strong>Callsign</strong><span>${s.callsign || 'N/A'}</span></div>
            <div class="fp-detail-item"><strong>Flight No.</strong><span>${s.flightNumber || 'N/A'}</span></div>
            <div class="fp-detail-item"><strong>Aircraft</strong><span>${s.aircraft || 'N/A'}</span></div>
            <div class="fp-detail-item"><strong>Origin</strong><span>${s.origin || '----'}</span></div>
            <div class="fp-detail-item"><strong>Destination</strong><span>${s.destination || '----'}</span></div>
            <div class="fp-detail-item"><strong>Alternate</strong><span>${s.altn || 'N/A'}</span></div>
            <div class="fp-detail-item"><strong>EET</strong><span>${s.ete || 'N/A'}</span></div>
            <div class="fp-detail-item"><strong>Fuel (Planned)</strong><span>${s.fuelPlanned || 'N/A'}</span></div>
            <div class="fp-detail-item" style="grid-column: 1 / -1;"><strong>Route</strong><span>${s.route || ''}</span></div>
          </div>
          <div class="flight-plan-actions">
            ${s.pdfUrl ? `<a class="cta-button" href="${s.pdfUrl}" target="_blank" rel="noopener">Open PDF</a>` : ''}
          </div>
        </div>`;
      return;
    }

    // 2) Otherwise show active plan if one exists:
    if (ACTIVE_FLIGHT_PLAN) {
      viewContainer.innerHTML = getActiveFlightPlanHTML(ACTIVE_FLIGHT_PLAN);
      return;
    }

    // 3) Otherwise show the SimBrief generate form (include flow)
    viewContainer.innerHTML = getGenerateSimbriefHTML(pilot);
  };

  const getActiveFlightPlanHTML = (plan) => {
    const etd = new Date(plan.createdAt).toLocaleString();
    const eta = new Date(new Date(plan.createdAt).getTime() + (plan.flightTime * 60 * 60 * 1000)).toLocaleString();
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
        <div class="fp-detail-item"><strong>Filed At</strong><span>${etd}</span></div>
        <div class="fp-detail-item"><strong>ETA</strong><span>${eta}</span></div>
        <div class="fp-detail-item"><strong>EET</strong><span>${(plan.flightTime || 0).toFixed(1)} hrs</span></div>
        <div class="fp-detail-item"><strong>FIC #</strong><span>${plan.ficNumber || 'N/A'}</span></div>
        <div class="fp-detail-item"><strong>ADC #</strong><span>${plan.adcNumber || 'N/A'}</span></div>
        <div class="fp-detail-item" style="grid-column: 1 / -1;"><strong>Route</strong><span>${plan.route}</span></div>
      </div>
      <div class="flight-plan-actions">${actions}</div>
    </div>`;
  };

  // SimBrief include flow — form the include expects (id: sbapiform; fields: orig, dest, type, callsign)
  const getGenerateSimbriefHTML = (pilot) => {
    const simbriefUsernameSet = pilot.simbriefUserId && pilot.simbriefUserId.trim() !== '';
    if (!simbriefUsernameSet) {
      return `
      <div class="content-card">
        <h2><i class="fa-solid fa-file-import"></i> Generate with SimBrief</h2>
        <div class="pending-test-banner">
          <h3><i class="fa-solid fa-triangle-exclamation"></i> SimBrief Username Required</h3>
          <p>Set your SimBrief Username in your profile settings before generating plans.</p>
        </div>
      </div>`;
    }

    // IMPORTANT: id must be "sbapiform" because the include looks it up by id
    // (and it reads name="orig" | "dest" | "type" fields).
    // We’ll call simbriefsubmit() on submit; the include provides this function.
    return `
    <div class="content-card">
      <h2><i class="fa-solid fa-file-import"></i> Generate New Flight Plan with SimBrief</h2>
      <p>Enter your flight details below. A popup will open to generate the OFP. When it closes, you'll return here automatically.</p>

      <form id="sbapiform" class="flight-plan-form">
        <div class="form-grid">
          <div class="form-group">
            <label for="sb-orig">Departure ICAO</label>
            <input type="text" id="sb-orig" name="orig" placeholder="e.g., KJFK" maxlength="4" required />
          </div>
          <div class="form-group">
            <label for="sb-dest">Arrival ICAO</label>
            <input type="text" id="sb-dest" name="dest" placeholder="e.g., KLAX" maxlength="4" required />
          </div>
          <div class="form-group">
            <label for="sb-type">Aircraft Type</label>
            <input type="text" id="sb-type" name="type" placeholder="e.g., B738" required />
          </div>
          <div class="form-group">
            <label for="sb-callsign">Callsign</label>
            <input type="text" id="sb-callsign" name="callsign" placeholder="e.g., IND123" required />
          </div>
        </div>
        <div class="flight-plan-actions">
          <button type="submit" id="generate-simbrief-btn" class="cta-button">
            <i class="fa-solid fa-cogs"></i> Generate Flight Plan
          </button>
        </div>
      </form>
    </div>`;
  };

  // ---------- leaderboards / rosters / history ----------
  const renderLeaderboardTable = (title, data, valueKey) => {
    if (!data || data.length === 0) return `<h4>Top by ${title}</h4><p class="muted">No data available yet.</p>`;
    return `
      <h4>Top by ${title}</h4>
      <table class="leaderboard-table">
        <thead><tr><th>#</th><th>Pilot</th><th>${title === 'Hours' ? '<i class="fa-solid fa-stopwatch"></i>' : '<i class="fa-solid fa-plane-arrival"></i>'} ${title}</th></tr></thead>
        <tbody>
          ${data.map((p, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${p.name}<small>${p.callsign || 'N/A'}</small></td>
              <td>${Number(p[valueKey] || 0).toFixed(1)}</td>
            </tr>`).join('')}
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
    } catch {
      return `<div class="content-card"><h2><i class="fa-solid fa-trophy"></i> Leaderboards</h2><p>Could not load leaderboards.</p></div>`;
    }
  };

  const fetchAndDisplayRosters = async () => {
    const container = qs('#roster-list-container');
    const header = qs('#roster-list-header');
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
          </div>`;
        if (window.plotRosters) window.plotRosters(criteria.searched[0], rosters);
      } else {
        header.innerHTML = 'No location data found. Showing rosters from primary hubs.';
      }

      if (rosters.length === 0) {
        container.innerHTML = '<p>No rosters available from your current location(s).</p>';
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
        const pathString = [roster.legs[0].departure, ...roster.legs.map(l => l.arrival)].join(' → ');

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
    } catch (e) {
      container.innerHTML = `<p class="error-text">${e.message}</p>`;
    }
  };

  const fetchPirepHistory = async () => {
    const container = qs('#pirep-history-list');
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
            <div class="pirep-chips"><span class="badge badge-rank">Req: ${reqRank}</span></div>
          </div>
          <div class="pirep-details">
            <span>${p.aircraft}</span>
            <span>${Number(p.flightTime || 0).toFixed(1)} hrs</span>
            <span class="status-badge status-${p.status.toLowerCase()}">${p.status}</span>
          </div>
        </div>`;
      }).join('');
    } catch (e) {
      container.innerHTML = `<p class="error-text">${e.message}</p>`;
    }
  };

  // ---------- navigation ----------
  sidebarNav.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-link');
    if (!link) return;
    e.preventDefault();
    qs('.nav-link.active').classList.remove('active');
    link.classList.add('active');
    qs('.content-view.active').classList.remove('active');
    qs('#' + link.dataset.view).classList.add('active');
    if (link.dataset.view === 'view-rosters' && window.leafletMap) {
      setTimeout(() => window.leafletMap.invalidateSize(), 150);
    }
  });

  // ---------- global listeners ----------
  // SimBrief generation (include flow)
  mainContentContainer.addEventListener('submit', (e) => {
    if (e.target.id === 'sbapiform') {
      e.preventDefault();
      const btn = qs('#generate-simbrief-btn', e.target);
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

      // Output page = same page, we’ll detect ofp_id in URL and render
      const outputUrl = `${location.origin}${location.pathname}?view=view-flight-plan`;

      if (typeof window.simbriefsubmit !== 'function') {
        showNotification('SimBrief include not loaded. Check the script URL.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cogs"></i> Generate Flight Plan';
        return;
      }

      // Call the include’s submit helper (opens popup, closes when done)
      try {
        window.simbriefsubmit(outputUrl);
      } catch (err) {
        showNotification('Could not open SimBrief popup. Disable your popup blocker and try again.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cogs"></i> Generate Flight Plan';
      }
    }
  });

  // Plan actions
  mainContentContainer.addEventListener('click', async (e) => {
    const t = e.target;

    if (t.classList.contains('details-button') && t.dataset.rosterId && !t.classList.contains('view-roster-on-map-btn')) {
      const rosterId = t.dataset.rosterId;
      const detailsContainer = qs(`#details-${rosterId}`);

      qsa('.roster-leg-details.visible').forEach(open => {
        if (open.id !== `details-${rosterId}`) {
          open.classList.remove('visible');
          const otherId = open.id.replace('details-', '');
          qs(`.details-button[data-roster-id="${otherId}"]`).setAttribute('aria-expanded', 'false');
        }
      });

      const isVisible = detailsContainer.classList.toggle('visible');
      t.setAttribute('aria-expanded', isVisible);

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
          const isMultiAircraft = roster?.legs?.some((leg, i, arr) => i > 0 && leg.aircraft !== arr[0].aircraft);

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
                    <img src="${liveryImagePath}" alt="${legAirlineCode} ${legAircraftCode}"
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
                      <span class="badge badge-rank">Req: ${leg.rankUnlock || deduceRankFromAircraftFE(leg.aircraft)}</span>
                    </div>
                  </div>
                  ${legAircraftImageHTML}
                </li>`;
              }).join('')}
            </ul>`;
          } else {
            detailsContainer.innerHTML = '<p>Details could not be loaded.</p>';
          }
        } catch (err) {
          detailsContainer.innerHTML = `<p class="error-text">${err.message}</p>`;
        }
      }
    }

    if (t.classList.contains('view-roster-on-map-btn') || t.closest('.view-roster-on-map-btn')) {
      const btn = t.closest('.view-roster-on-map-btn');
      const rosterId = btn.dataset.rosterId;
      if (window.focusOnRoster) {
        window.focusOnRoster(rosterId);
        qs('#map').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    if (t.classList.contains('go-on-duty-btn')) {
      const rosterId = t.dataset.rosterId;
      t.disabled = true;
      t.textContent = 'Starting...';
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
        t.disabled = false;
        t.textContent = 'Go On Duty';
      }
    }

    const planId = t.dataset.planId;
    if (t.id === 'depart-btn') {
      t.disabled = true;
      try {
        const res = await fetch(`${API_BASE_URL}/api/simbrief/${planId}/depart`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
        const result = await res.json();
        if (!res.ok) throw new Error(result.message);
        showNotification(result.message, 'success');
        await fetchPilotData();
      } catch (err) {
        showNotification(err.message, 'error');
        t.disabled = false;
      }
    }
    if (t.id === 'cancel-btn') {
      t.disabled = true;
      try {
        const res = await fetch(`${API_BASE_URL}/api/simbrief/${planId}/cancel`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
        const result = await res.json();
        if (!res.ok) throw new Error(result.message);
        showNotification(result.message, 'success');
        await fetchPilotData();
      } catch (err) {
        showNotification(err.message, 'error');
        t.disabled = false;
      }
    }
    if (t.id === 'arrive-btn') {
      qs('#arrive-flight-form').dataset.planId = planId;
      arriveFlightModal.classList.add('visible');
    }
  });

  // arrive modal
  qs('#arrive-flight-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const planId = e.target.dataset.planId;
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Completing...';

    const formData = new FormData();
    formData.append('remarks', qs('#arrival-remarks').value);
    const imageInput = qs('#arrival-verification-image');
    if (imageInput.files.length > 0) {
      formData.append('verificationImage', imageInput.files[0]);
    } else {
      showNotification('Error: You must upload a verification image.', 'error');
      btn.disabled = false;
      btn.textContent = 'Complete Flight';
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/simbrief/${planId}/arrive`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to complete flight.');
      showNotification(result.message, 'success');
      qs('#arrive-flight-modal').classList.remove('visible');
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

  // ---------- OFP return handler ----------
  async function handleOfpFromUrl() {
    const params = new URLSearchParams(location.search);
    const ofpId = params.get('ofp_id');
    if (!ofpId) return;

    // When the SimBrief popup closes, their include redirects here with ofp_id.
    try {
      const res = await fetch(`${API_BASE_URL}/api/simbrief/ofp?ofp_id=${encodeURIComponent(ofpId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch OFP from backend.');
      LAST_FETCHED_OFP = await res.json();
      // Show the Flight Plan tab
      qs('.nav-link.active').classList.remove('active');
      qs('[data-view="view-flight-plan"]').classList.add('active');
      qs('.content-view.active').classList.remove('active');
      qs('#view-flight-plan').classList.add('active');
      renderFlightPlanView(CURRENT_PILOT);
      showNotification('SimBrief OFP loaded.', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    }
  }

  // ---------- boot ----------
  (async () => {
    await fetchPilotData();
    await handleOfpFromUrl();
  })();
});
