/**
 * Sector Ops Mobile View Manager v1.0
 *
 * This script replaces the old 'sector-ops-mobile-ui.js'.
 * It provides a single, unified, app-like drawer interface for ALL
 * interactive map elements on mobile (Aircraft, Airports, Weather, Filters).
 *
 * It no longer "hijacks" or clones the desktop DOM. Instead, it receives
 * data from crew-center.js and renders its own mobile-first templates.
 */
const MobileViewManager = {
    // --- Configuration ---
    CONFIG: {
        breakpoint: 992, // The max-width to trigger mobile view
        peekHeight: 280, // Height of the "Peek" state
    },

    // --- State ---
    isInitialized: false,
    drawerState: 'CLOSED', // CLOSED, PEEK, EXPANDED
    activeView: null, // 'aircraft', 'airport', 'weather', 'filters'
    activeData: {}, // Holds data for the current view
    swipeState: {
        isDragging: false,
        isClick: true,
        startY: 0,
        deltaY: 0,
    },
    updateIntervals: {
        aircraftPfd: null,
        geocode: null,
    },

    // --- DOM Elements ---
    dom: {
        container: null,
        overlay: null,
        sheet: null,
        handle: null,
        peekContent: null,
        expandedContentWrapper: null,
        expandedContent: null,
    },

    /**
     * Public: Checks if we are in mobile view.
     */
    isMobile: () => window.innerWidth <= MobileViewManager.CONFIG.breakpoint,

    /**
     * Public: Initializes the manager.
     * Called by crew-center.js on load.
     */
    init() {
        if (!this.isMobile() || this.isInitialized) {
            return;
        }
        console.log("Mobile View Manager: Initializing...");
        this.injectCSS();
        this.createDOM();
        this.attachListeners();
        this.isInitialized = true;
        console.log("Mobile View Manager: Ready.");
    },

    /**
     * Public: The main entry point for crew-center.js to show a window.
     * @param {string} type - 'aircraft', 'airport', 'weather', 'filters'
     * @param {object} data - The data needed for that view
     */
    async showWindow(type, data = {}) {
        if (!this.isMobile()) return;

        // Clear any old content and intervals
        this.clearUpdateIntervals();
        this.dom.peekContent.innerHTML = '';
        this.dom.expandedContent.innerHTML = '<div class="spinner-small" style="margin-top: 40px;"></div>';

        this.activeView = type;
        this.activeData = data;

        // Hide main map UI
        this.toggleMapControls(false);

        try {
            // Render the "Peek" (handle) content
            await this.renderPeekContent(type, data);

            // Render the "Expanded" (main) content
            await this.renderExpandedContent(type, data);

            // Set the initial state
            if (type === 'aircraft') {
                this.setDrawerState('PEEK');
            } else {
                this.setDrawerState('EXPANDED');
            }
        } catch (error) {
            console.error(`MobileViewManager: Failed to render ${type}`, error);
            this.dom.expandedContent.innerHTML = `<p class="error-text">${error.message}</p>`;
            this.setDrawerState('EXPANDED');
        }
    },

    /**
     * Public: Closes the drawer.
     */
    closeWindow() {
        this.setDrawerState('CLOSED');
        this.clearUpdateIntervals();
        this.toggleMapControls(true);

        // Clear content after animation
        setTimeout(() => {
            this.dom.peekContent.innerHTML = '';
            this.dom.expandedContent.innerHTML = '';
            this.activeView = null;
            this.activeData = {};
        }, 500);
    },

    /**
     * Internal: Renders the content for the "Peek" state (the handle).
     */
    async renderPeekContent(type, data) {
        let html = '';
        switch (type) {
            case 'aircraft':
                const props = data.flightProps;
                const plan = await this.fetchPlan(data.sessionId, props.flightId);
                data.plan = plan; // Cache plan for expanded view

                const [dep, arr] = this.getDepArr(plan);
                html = `
                    <div class="peek-view-aircraft">
                        <div class="peek-route">
                            <span id="mobile-peek-dep">${dep}</span>
                            <i class="fa-solid fa-plane"></i>
                            <span id="mobile-peek-arr">${arr}</span>
                        </div>
                        <div class="peek-callsign">${props.callsign}</div>
                    </div>
                `;
                break;
            case 'airport':
                html = `<div class="peek-view-title"><i class="fa-solid fa-location-dot"></i> ${data.icao}</div>`;
                break;
            case 'weather':
                html = `<div class="peek-view-title"><i class="fa-solid fa-cloud-sun"></i> Weather Settings</div>`;
                break;
            case 'filters':
                html = `<div class="peek-view-title"><i class="fa-solid fa-filter"></i> Map Filters</div>`;
                break;
        }
        this.dom.peekContent.innerHTML = html;
    },

    /**
     * Internal: Renders the content for the "Expanded" state.
     */
    async renderExpandedContent(type, data) {
        switch (type) {
            case 'aircraft':
                this.dom.expandedContent.innerHTML = this.getAircraftTemplate();
                // Manually call the PFD creator from the main script
                if (typeof createPfdDisplay === 'function') {
                    createPfdDisplay();
                }
                // Start the live update loop
                this.startAircraftUpdateLoop(data.sessionId, data.flightProps.flightId, data.plan);
                break;
            case 'airport':
                this.dom.expandedContent.innerHTML = await this.getAirportTemplate(data.icao);
                this.attachAirportTabListeners();
                break;
            case 'weather':
                this.dom.expandedContent.innerHTML = this.getWeatherTemplate();
                this.attachSettingsListeners('weather');
                break;
            case 'filters':
                this.dom.expandedContent.innerHTML = this.getFiltersTemplate();
                this.attachSettingsListeners('filters');
                break;
        }
    },

    /**
     * Internal: Toggles the main map controls (burger, toolbar).
     */
    toggleMapControls(show) {
        const burgerMenu = document.getElementById('mobile-sidebar-toggle');
        const mapToolbar = document.getElementById('toolbar-toggle-panel-btn')?.parentElement;
        const display = show ? '' : 'none';

        if (burgerMenu) burgerMenu.style.display = display;
        if (mapToolbar) mapToolbar.style.display = display;
    },

    /**
     * Internal: Changes the drawer state and applies CSS classes.
     */
    setDrawerState(newState) {
        if (newState === this.drawerState) return;

        this.dom.container.classList.remove('drawer-state-closed', 'drawer-state-peek', 'drawer-state-expanded');
        this.dom.container.classList.add(`drawer-state-${newState.toLowerCase()}`);

        this.drawerState = newState;
    },

    //==================================================================
    // AIRCRAFT VIEW LOGIC
    //==================================================================

    /**
     * Starts the interval to fetch live data for the aircraft.
     */
    startAircraftUpdateLoop(sessionId, flightId, initialPlan) {
        this.clearUpdateIntervals();

        const LIVE_FLIGHTS_API_URL = 'https://site--acars-backend--6dmjph8ltlhv.code.run/flights';

        const update = async () => {
            try {
                const [freshDataRes, routeRes] = await Promise.all([
                    fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}`),
                    fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}/${flightId}/route`)
                ]);

                if (!freshDataRes.ok || !routeRes.ok) throw new Error("Flight data update failed.");

                const allFlights = await freshDataRes.json();
                const routeData = await routeRes.json();
                const updatedFlight = allFlights.flights.find(f => f.flightId === flightId);

                let sortedRoutePoints = [];
                if (routeData && routeData.ok && Array.isArray(routeData.route) && routeData.route.length > 0) {
                    sortedRoutePoints = routeData.route.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                }

                if (updatedFlight && updatedFlight.position) {
                    // Update PFD (requires main script function)
                    if (typeof updatePfdDisplay === 'function') {
                        updatePfdDisplay(updatedFlight.position);
                    }
                    // Update the rest of the UI
                    this.updateAircraftView(updatedFlight, initialPlan, sortedRoutePoints);
                } else {
                    this.clearUpdateIntervals(); // Flight ended
                }
            } catch (error) {
                console.error("Stopping mobile PFD update due to error:", error);
                this.clearUpdateIntervals();
            }
        };

        // Initial call
        update();
        // Start loop
        this.updateIntervals.aircraftPfd = setInterval(update, 3000);

        // Start slower geocode loop
        this.updateIntervals.geocode = setInterval(() => {
            const lat = this.activeData.flightProps?.position?.lat;
            const lon = this.activeData.flightProps?.position?.lon;
            if (lat && lon && typeof fetchAndDisplayGeocode === 'function') {
                // We call the main script's function, but tell it where to render
                fetchAndDisplayGeocode(lat, lon, '#mobile-ac-location');
            }
        }, 60000);
    },

    /**
     * Clears all active update intervals.
     */
    clearUpdateIntervals() {
        if (this.updateIntervals.aircraftPfd) {
            clearInterval(this.updateIntervals.aircraftPfd);
            this.updateIntervals.aircraftPfd = null;
        }
        if (this.updateIntervals.geocode) {
            clearInterval(this.updateIntervals.geocode);
            this.updateIntervals.geocode = null;
        }
    },

    /**
     * Updates the aircraft view with new live data.
     * This is a mobile-specific version of updateAircraftInfoWindow.
     */
    updateAircraftView(flightProps, plan, sortedRoutePoints) {
        this.activeData.flightProps = flightProps; // Update state

        // PFD is updated by the global function
        // VSD and other elements are updated here
        try {
            // --- Get all DOM elements ---
            const progressBarFill = document.getElementById('mobile-ac-progress-bar');
            const phaseIndicator = document.getElementById('mobile-ac-phase-indicator');
            const vsdPanel = document.getElementById('mobile-vsd-panel');
            const vsdAircraftIcon = document.getElementById('mobile-vsd-aircraft-icon');
            const vsdGraphWindow = document.getElementById('mobile-vsd-graph-window');
            const vsdGraphContent = document.getElementById('mobile-vsd-graph-content');
            const vsdProfilePath = document.getElementById('mobile-vsd-profile-path');
            const vsdFlownPath = document.getElementById('mobile-vsd-flown-path');
            const vsdWpLabels = document.getElementById('mobile-vsd-waypoint-labels');
            const nextWpEl = document.getElementById('mobile-ac-next-wp');
            const nextWpDistValEl = document.getElementById('mobile-ac-next-wp-dist');
            const distTextEl = document.getElementById('mobile-ac-dist');
            const eteEl = document.getElementById('mobile-ac-ete');
            const vsdSummaryVS = document.getElementById('mobile-ac-vs');
            const atdEl = document.getElementById('mobile-ac-bar-atd');
            const etaEl = document.getElementById('mobile-ac-bar-eta');
            const overviewPanel = document.getElementById('mobile-ac-overview-panel');

            // --- VSD Logic (Adapted from crew-center.js) ---
            const originalFlatWaypointObjects = (plan && plan.flightPlanItems) ? getFlatWaypointObjects(plan.flightPlanItems) : [];
            const hasPlan = originalFlatWaypointObjects.length >= 2;
            let totalDistanceNM = 0;
            let distanceToDestNM = 0;
            let progressAlongRouteNM = 0;
            let nextWpName = '---';
            let nextWpDistNM = '---';
            let ete = '--:--';

            if (hasPlan) {
                let cumulativeDistNM = 0;
                let lastLat = originalFlatWaypointObjects[0].location.latitude;
                let lastLon = originalFlatWaypointObjects[0].location.longitude;
                for (let i = 0; i < originalFlatWaypointObjects.length; i++) {
                    const wp = originalFlatWaypointObjects[i];
                    if (!wp.location) continue;
                    const wpLat = wp.location.latitude;
                    const wpLon = wp.location.longitude;
                    const segmentDistNM = (i === 0) ? 0 : getDistanceKm(lastLat, lastLon, wpLat, wpLon) / 1.852;
                    cumulativeDistNM += segmentDistNM;
                    wp.cumulativeNM = cumulativeDistNM;
                    lastLat = wpLat;
                    lastLon = wpLon;
                }
                totalDistanceNM = cumulativeDistNM;

                const [destLon, destLat] = [lastLon, lastLat];
                const remainingDistanceKm = getDistanceKm(flightProps.position.lat, flightProps.position.lon, destLat, destLon);
                distanceToDestNM = remainingDistanceKm / 1.852;
                
                if (flightProps.position.gs_kt > 50) {
                    const timeHours = distanceToDestNM / flightProps.position.gs_kt;
                    const hours = Math.floor(timeHours);
                    const minutes = Math.round((timeHours - hours) * 60);
                    ete = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                }

                let bestWpIndex = -1, minScore = Infinity;
                const currentPos = flightProps.position;
                const currentTrack = currentPos.heading_deg;
                if (typeof currentTrack === 'number') {
                    for (let i = 1; i < originalFlatWaypointObjects.length; i++) {
                        const wp = originalFlatWaypointObjects[i];
                        if (!wp.location) continue;
                        const distanceToWpKm = getDistanceKm(currentPos.lat, currentPos.lon, wp.location.latitude, wp.location.longitude);
                        const bearingToWp = getBearing(currentPos.lat, currentPos.lon, wp.location.latitude, wp.location.longitude);
                        const bearingDiff = Math.abs(normalizeBearingDiff(currentTrack - bearingToWp));
                        if (bearingDiff <= 95 && distanceToWpKm < minScore) {
                            minScore = distanceToWpKm;
                            bestWpIndex = i;
                        }
                    }
                }
                if (bestWpIndex !== -1) {
                    const nextWp = originalFlatWaypointObjects[bestWpIndex];
                    nextWpName = nextWp.identifier || nextWp.name || 'N/A';
                    nextWpDistNM = (minScore / 1.852).toFixed(0);

                    const prevWp = originalFlatWaypointObjects[bestWpIndex - 1];
                    if (prevWp && nextWp.cumulativeNM != null && prevWp.cumulativeNM != null) {
                        const segmentTotalNM = nextWp.cumulativeNM - prevWp.cumulativeNM;
                        const distToNextNM = minScore / 1.852;
                        const segmentProgressNM = Math.max(0, segmentTotalNM - distToNextNM);
                        progressAlongRouteNM = prevWp.cumulativeNM + segmentProgressNM;
                    } else {
                        progressAlongRouteNM = Math.max(0.01, totalDistanceNM - distanceToDestNM);
                    }
                } else {
                    progressAlongRouteNM = Math.max(0.01, totalDistanceNM - distanceToDestNM);
                }
            }

            // --- Update Data Bar ---
            if (nextWpEl) nextWpEl.textContent = nextWpName;
            if (nextWpDistValEl) nextWpDistValEl.innerHTML = `${(nextWpDistNM === '---' || isNaN(parseFloat(nextWpDistNM))) ? '--.-' : Number(nextWpDistNM).toFixed(1)}<span class="unit">NM</span>`;
            if (distTextEl) distTextEl.innerHTML = `${Math.round(distanceToDestNM)}<span class="unit">NM</span>`;
            if (eteEl) eteEl.textContent = ete;
            if (vsdSummaryVS) vsdSummaryVS.innerHTML = `<i class="fa-solid ${flightProps.position.vs_fpm > 100 ? 'fa-arrow-up' : flightProps.position.vs_fpm < -100 ? 'fa-arrow-down' : 'fa-minus'}"></i> ${Math.round(flightProps.position.vs_fpm)}<span class="unit">fpm</span>`;

            // --- Update Flight Phase & Progress Bar (Simplified) ---
            // (A full phase logic implementation would also be copied from crew-center.js)
            const progress = totalDistanceNM > 0 ? Math.max(0, Math.min(100, (1 - (distanceToDestNM / totalDistanceNM)) * 100)) : 0;
            if (progressBarFill) progressBarFill.style.width = `${progress.toFixed(1)}%`;
            if (phaseIndicator) {
                // This is a simplified logic. For full logic, copy from crew-center.js
                const vs = flightProps.position.vs_fpm;
                let phase = 'CRUISE', phaseClass = 'phase-cruise', icon = 'fa-minus';
                if (vs > 500) { phase = 'CLIMB'; phaseClass = 'phase-climb'; icon = 'fa-arrow-trend-up'; }
                if (vs < -500) { phase = 'DESCENT'; phaseClass = 'phase-descent'; icon = 'fa-arrow-trend-down'; }
                phaseIndicator.className = `flight-phase-indicator ${phaseClass}`;
                phaseIndicator.innerHTML = `<i class="fa-solid ${icon}"></i> ${phase}`;
            }

            // --- Update Times ---
            const atdTimestamp = (sortedRoutePoints && sortedRoutePoints.length > 0) ? sortedRoutePoints[0].date : null;
            if (atdEl) atdEl.textContent = `${atdTimestamp ? formatTimeFromTimestamp(atdTimestamp) : '--:--'} Z`;
            if (etaEl) {
                let etaTime = '--:--';
                if (flightProps.position.gs_kt > 50 && totalDistanceNM > 0) {
                    const eteHours = distanceToDestNM / flightProps.position.gs_kt;
                    if (eteHours > 0 && eteHours < 48) {
                        const etaTimestamp = new Date(Date.now() + (eteHours * 3600 * 1000));
                        etaTime = formatTimeFromTimestamp(etaTimestamp);
                    }
                }
                etaEl.textContent = `${etaTime} Z`;
            }

            // --- Update Aircraft Image ---
            if (overviewPanel) {
                const acName = flightProps.aircraft?.aircraftName || 'Generic';
                const liveryName = flightProps.aircraft?.liveryName || 'Default';
                const s_ac = acName.trim().toLowerCase().replace(/[^a-z0-j-9-]/g, '_');
                const s_livery = liveryName.trim().toLowerCase().replace(/[^a-z0-j-9-]/g, '_');
                const imagePath = `/CommunityPlanes/${s_ac}/${s_livery}.png`;
                const fallbackPath = '/CommunityPlanes/default.png';
                const newImageUrl = `url('${imagePath}')`;

                if (overviewPanel.dataset.currentPath !== imagePath) {
                    const img = new Image();
                    img.src = imagePath;
                    img.onload = () => {
                        overviewPanel.style.backgroundImage = newImageUrl;
                        overviewPanel.dataset.currentPath = imagePath;
                    };
                    img.onerror = () => {
                        overviewPanel.style.backgroundImage = `url('${fallbackPath}')`;
                        overviewPanel.dataset.currentPath = fallbackPath;
                    };
                }
            }

            // --- Update VSD (Adapted from crew-center.js) ---
            if (vsdPanel && hasPlan && vsdGraphContent && vsdAircraftIcon) {
                const VSD_HEIGHT_PX = vsdGraphContent.clientHeight || 200;
                const MAX_ALT_FT = 45000;
                const Y_SCALE_PX_PER_FT = VSD_HEIGHT_PX / MAX_ALT_FT;
                const FIXED_X_SCALE_PX_PER_NM = 4;
                const planId = plan.flightPlanId || plan.id || 'unknown';

                if (vsdPanel.dataset.profileBuilt !== 'true' || vsdPanel.dataset.planId !== planId) {
                    // Build Y-Axis
                    if (vsdGraphWindow && !vsdGraphWindow.querySelector('#mobile-vsd-y-axis')) {
                        let yAxisHtml = '<div id="mobile-vsd-y-axis" class="vsd-y-axis">';
                        [10000, 20000, 30000, 40000].forEach(alt => {
                            const yPos = VSD_HEIGHT_PX - (alt * Y_SCALE_PX_PER_FT);
                            yAxisHtml += `<div class="y-axis-label" style="top: ${yPos}px;">${alt / 1000}K</div>`;
                        });
                        vsdGraphWindow.insertAdjacentHTML('afterbegin', yAxisHtml + '</div>');
                    }

                    // Build Profile Path & Staggered Labels
                    let path_d = "", labels_html = "", current_x_px = 0, last_label_x_px = -1000, stagger_level = 0;
                    const MIN_LABEL_SPACING_PX = 80;
                    
                    let flatWaypointsCopy = JSON.parse(JSON.stringify(originalFlatWaypointObjects)); // Deep copy
                    // (Insert altitude interpolation logic from crew-center.js's updateAircraftInfoWindow if needed)
                    // ...
                    
                    for (let i = 0; i < flatWaypointsCopy.length; i++) {
                        const wp = flatWaypointsCopy[i];
                        const wpAltFt = wp.altitude || 0;
                        const wpAltPx = VSD_HEIGHT_PX - (wpAltFt * Y_SCALE_PX_PER_FT);
                        current_x_px = wp.cumulativeNM * FIXED_X_SCALE_PX_PER_NM;

                        if (i === 0) path_d = `M ${current_x_px} ${wpAltPx}`;
                        else path_d += ` L ${current_x_px} ${wpAltPx}`;

                        let label_top_px, label_class = '';
                        if (current_x_px - last_label_x_px < MIN_LABEL_SPACING_PX) stagger_level = 1 - stagger_level;
                        else stagger_level = 0;
                        
                        if (stagger_level === 1) { label_class = 'low-label'; label_top_px = wpAltPx + 12; }
                        else { label_class = 'high-label'; label_top_px = wpAltPx - 42; }
                        last_label_x_px = current_x_px;

                        labels_html += `<div class="vsd-wp-label ${label_class}" style="left: ${current_x_px}px; top: ${label_top_px}px;"><span class="wp-name">${wp.identifier}</span><span class="wp-alt">${Math.round(wpAltFt)}ft</span></div>`;
                    }
                    
                    vsdGraphContent.style.width = `${current_x_px + 100}px`;
                    vsdProfilePath.closest('svg').style.width = `${current_x_px + 100}px`;
                    vsdProfilePath.setAttribute('d', path_d);
                    vsdWpLabels.innerHTML = labels_html;
                    vsdPanel.dataset.profileBuilt = 'true';
                    vsdPanel.dataset.planId = planId;
                }

                // Update Flown Path
                if (vsdFlownPath && hasPlan) {
                    let flown_path_d = "";
                    const fullFlownRoute = [...sortedRoutePoints, {
                        latitude: flightProps.position.lat,
                        longitude: flightProps.position.lon,
                        altitude: flightProps.position.alt_ft
                    }];
                    const flownPathPoints = [];
                    let totalActualFlownNM = 0;
                    let lastFlownLat = fullFlownRoute[0].latitude, lastFlownLon = fullFlownRoute[0].longitude;

                    for (let i = 0; i < fullFlownRoute.length; i++) {
                        const point = fullFlownRoute[i];
                        const wpAltFt = typeof point.altitude === 'number' ? point.altitude : 0;
                        const wpAltPx = VSD_HEIGHT_PX - (wpAltFt * Y_SCALE_PX_PER_FT);
                        let segmentDistNM = (i === 0) ? 0 : getDistanceKm(lastFlownLat, lastFlownLon, point.latitude, point.longitude) / 1.852;
                        totalActualFlownNM += segmentDistNM;
                        flownPathPoints.push({ x_nm: totalActualFlownNM, y_px: wpAltPx });
                        lastFlownLat = point.latitude; lastFlownLon = point.longitude;
                    }
                    
                    const scaleFactor = (totalActualFlownNM > 0.1 && progressAlongRouteNM > 0.01) ? (progressAlongRouteNM / totalActualFlownNM) : 1;
                    for (let i = 0; i < flownPathPoints.length; i++) {
                        const scaled_x_px = flownPathPoints[i].x_nm * scaleFactor * FIXED_X_SCALE_PX_PER_NM;
                        if (i === 0) flown_path_d = `M 0 ${flownPathPoints[i].y_px}`;
                        flown_path_d += ` L ${scaled_x_px} ${flownPathPoints[i].y_px}`;
                    }
                    vsdFlownPath.setAttribute('d', flown_path_d);
                }

                // Update Aircraft Icon & Scroll
                const currentAltPx = VSD_HEIGHT_PX - (flightProps.position.alt_ft * Y_SCALE_PX_PER_FT);
                vsdAircraftIcon.style.top = `${currentAltPx}px`;

                if (vsdGraphWindow && vsdGraphWindow.clientWidth > 0) {
                    const scrollOffsetPx = (progressAlongRouteNM * FIXED_X_SCALE_PX_PER_NM);
                    const centerOffset = (vsdGraphWindow.clientWidth / 2) + 35; // 35px is Y-axis
                    const desiredTranslateX = centerOffset - scrollOffsetPx;
                    const maxTranslateX = 0;
                    const minTranslateX = Math.min(0, vsdGraphWindow.clientWidth - vsdGraphContent.scrollWidth);
                    const finalTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, desiredTranslateX));

                    vsdGraphContent.style.transform = `translateX(${finalTranslateX - 35}px)`;
                    vsdAircraftIcon.style.left = `${scrollOffsetPx + finalTranslateX}px`;
                }
            }
        } catch (e) {
            // Silently fail on update, as the loop will try again
            console.warn("Error during mobile UI update:", e);
        }
    },

    /**
     * Fetches the plan for the peek view.
     */
    async fetchPlan(sessionId, flightId) {
        try {
            const LIVE_FLIGHTS_API_URL = 'https://site--acars-backend--6dmjph8ltlhv.code.run/flights';
            const planRes = await fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}/${flightId}/plan`);
            if (!planRes.ok) return null;
            const planData = await planRes.json();
            return (planData && planData.ok) ? planData.plan : null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Gets Departure and Arrival ICAOs from a plan.
     */
    getDepArr(plan) {
        if (plan && plan.flightPlanItems && plan.flightPlanItems.length >= 2) {
            const dep = plan.flightPlanItems[0]?.name || 'N/A';
            const arr = plan.flightPlanItems[plan.flightPlanItems.length - 1]?.name || 'N/A';
            return [dep, arr];
        }
        return ['N/A', 'N/A'];
    },

    //==================================================================
    // AIRPORT VIEW LOGIC
    //==================================================================

    async getAirportTemplate(icao) {
        let weatherHtml = '', atcHtml = '', routesHtml = '';
        const API_BASE_URL = 'https://site--indgo-backend--6dmjph8ltlhv.code.run';

        try {
            // Fetch Weather
            const weatherRes = await fetch(`https://indgo-va.netlify.app/.netlify/functions/weather?icao=${icao}`);
            if (weatherRes.ok) {
                const metar = (await weatherRes.json()).data?.[0];
                if (metar) {
                    const cat = metar.flight_category || 'N/A';
                    weatherHtml = `
                    <div class="mobile-metar-card">
                        <span class="mobile-flight-rules flight-rules-${cat.toLowerCase()}">${cat}</span>
                        <div class="mobile-metar-details">
                            <span><i class="fa-solid fa-temperature-half"></i> ${metar.temperature?.celsius || '--'}°C</span>
                            <span><i class="fa-solid fa-wind"></i> ${metar.wind?.degrees || '---'}° @ ${metar.wind?.speed_kts || '--'} kts</span>
                            <span><i class="fa-solid fa-gauge"></i> ${metar.barometer?.hpa || '----'} hPa</span>
                            <span><i class="fa-solid fa-eye"></i> ${metar.visibility?.miles || '--'} SM</span>
                        </div>
                        <code class="mobile-metar-code">${metar.raw_text}</code>
                    </div>`;
                }
            }
        } catch (e) { console.error("Mobile Weather Fetch Error", e); }

        try {
            // Fetch Routes
            // These global variables are set by crew-center.js
            const routesFromAirport = (window.ALL_AVAILABLE_ROUTES || []).filter(r => r.departure === icao);
            if (routesFromAirport.length > 0) {
                routesHtml = routesFromAirport.map(route => {
                    const airlineCode = extractAirlineCode(route.flightNumber);
                    return `
                    <li class="mobile-route-item">
                        <img src="Images/vas/${airlineCode}.png" class="mobile-route-logo" alt="${airlineCode}" onerror="this.style.display='none'">
                        <div class="mobile-route-info">
                            <strong>${route.flightNumber}</strong>
                            <span>to ${route.arrival} (${route.aircraft})</span>
                        </div>
                        ${getRankBadgeHTML(route.rankUnlock || deduceRankFromAircraftFE(route.aircraft), { showImage: true, imageClass: 'roster-req-rank-badge' })}
                    </li>`;
                }).join('');
            } else {
                routesHtml = '<p class="muted-text">No routes found from this airport.</p>';
            }
        } catch (e) { console.error("Mobile Route Render Error", e); }

        try {
            // Fetch ATC
            // These global variables are set by crew-center.js
            const atcForAirport = (window.activeAtcFacilities || []).filter(f => f.airportName === icao);
            if (atcForAirport.length > 0) {
                atcHtml = atcForAirport.map(f => `
                    <li class="mobile-atc-item">
                        <span class="mobile-atc-type">${atcTypeToString(f.type)}</span>
                        <span class="mobile-atc-user">${f.username || 'N/A'}</span>
                        <span class="mobile-atc-time">${formatAtcDuration(f.startTime)}</span>
                    </li>
                `).join('');
            } else {
                atcHtml = '<p class="muted-text">No active ATC reported.</p>';
            }
        } catch (e) { console.error("Mobile ATC Render Error", e); }

        return `
            <div class="mobile-airport-view">
                ${weatherHtml}
                <div class="mobile-info-tabs">
                    <button class="mobile-tab-btn active" data-tab="mobile-airport-routes">Routes</button>
                    <button class="mobile-tab-btn" data-tab="mobile-airport-atc">ATC</button>
                </div>
                <div id="mobile-airport-routes" class="mobile-tab-content active">
                    <ul class="mobile-content-list">${routesHtml}</ul>
                </div>
                <div id="mobile-airport-atc" class="mobile-tab-content">
                    <ul class="mobile-content-list">${atcHtml}</ul>
                </div>
            </div>
        `;
    },

    attachAirportTabListeners() {
        const view = this.dom.expandedContent.querySelector('.mobile-airport-view');
        if (!view) return;

        view.querySelector('.mobile-info-tabs').addEventListener('click', (e) => {
            const btn = e.target.closest('.mobile-tab-btn');
            if (!btn || btn.classList.contains('active')) return;

            view.querySelector('.mobile-tab-btn.active').classList.remove('active');
            view.querySelector('.mobile-tab-content.active').classList.remove('active');

            btn.classList.add('active');
            view.querySelector(`#${btn.dataset.tab}`).classList.add('active');
        });
    },

    //==================================================================
    // SETTINGS VIEW LOGIC (Weather & Filters)
    //==================================================================

    getWeatherTemplate() {
        // These global variables are set by crew-center.js
        const precip = document.getElementById('weather-toggle-precip')?.checked || false;
        const clouds = document.getElementById('weather-toggle-clouds')?.checked || false;
        const wind = document.getElementById('weather-toggle-wind')?.checked || false;

        return `
            <div class="mobile-settings-view">
                <ul class="mobile-settings-list">
                    <li class="mobile-toggle-item">
                        <span class="mobile-toggle-label"><i class="fa-solid fa-cloud-rain"></i> Precipitation</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="mobile-weather-precip" ${precip ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </li>
                    <li class="mobile-toggle-item">
                        <span class="mobile-toggle-label"><i class="fa-solid fa-cloud"></i> Cloud Cover</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="mobile-weather-clouds" ${clouds ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </li>
                    <li class="mobile-toggle-item">
                        <span class="mobile-toggle-label"><i class="fa-solid fa-wind"></i> Wind Speed</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="mobile-weather-wind" ${wind ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </li>
                </ul>
                <div class="mobile-settings-note">
                    <i class="fa-solid fa-server"></i>
                    <strong>Note:</strong> These layers are provided by a free service.
                </div>
            </div>
        `;
    },

    getFiltersTemplate() {
        // These global variables are set by crew-center.js
        const mapFilters = window.mapFilters || {};
        const light = window.currentMapStyle === window.MAP_STYLE_LIGHT;
        const sat = window.currentMapStyle === window.MAP_STYLE_SATELLITE;

        return `
            <div class="mobile-settings-view">
                <div class="mobile-settings-section-title">Aircraft Filters</div>
                <ul class="mobile-settings-list">
                    <li class="mobile-toggle-item">
                        <span class="mobile-toggle-label"><i class="fa-solid fa-plane-circle-check"></i> VA Members Only</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="mobile-filter-members-only" ${mapFilters.showVaOnly ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </li>
                </ul>
                <div class="mobile-settings-section-title">Airport Filters</div>
                <ul class="mobile-settings-list">
                    <li class="mobile-toggle-item">
                        <span class="mobile-toggle-label"><i class="fa-solid fa-tower-broadcast"></i> Hide Staffed Airports</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="mobile-filter-atc" ${mapFilters.hideAtcMarkers ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </li>
                    <li class="mobile-toggle-item">
                        <span class="mobile-toggle-label"><i class="fa-solid fa-location-dot"></i> Hide Unstaffed Airports</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="mobile-filter-no-atc" ${mapFilters.hideNoAtcMarkers ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </li>
                </ul>
                <div class="mobile-settings-section-title">Map Style</div>
                <ul class="mobile-settings-list">
                    <li class="mobile-toggle-item">
                        <span class="mobile-toggle-label"><i class="fa-solid fa-sun"></i> Light Mode</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="mobile-filter-light-mode" ${light ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </li>
                    <li class="mobile-toggle-item">
                        <span class="mobile-toggle-label"><i class="fa-solid fa-satellite"></i> Satellite Mode</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="mobile-filter-satellite-mode" ${sat ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </li>
                </ul>
            </div>
        `;
    },

    attachSettingsListeners(type) {
        const view = this.dom.expandedContent.querySelector('.mobile-settings-view');
        if (!view) return;

        view.addEventListener('change', (e) => {
            if (e.target.type !== 'checkbox') return;

            if (type === 'weather') {
                const precip = document.getElementById('mobile-weather-precip').checked;
                const clouds = document.getElementById('mobile-weather-clouds').checked;
                const wind = document.getElementById('mobile-weather-wind').checked;

                // Sync with desktop toggles so state is preserved
                document.getElementById('weather-toggle-precip').checked = precip;
                document.getElementById('weather-toggle-clouds').checked = clouds;
                document.getElementById('weather-toggle-wind').checked = wind;

                // Call main script functions
                toggleWeatherLayer(precip);
                toggleCloudLayer(clouds);
                toggleWindLayer(wind);
                updateToolbarButtonStates();

            } else if (type === 'filters') {
                // Sync map style
                const lightToggle = document.getElementById('mobile-filter-light-mode');
                const satToggle = document.getElementById('mobile-filter-satellite-mode');
                
                if (e.target.id === 'mobile-filter-light-mode' && e.target.checked) satToggle.checked = false;
                if (e.target.id === 'mobile-filter-satellite-mode' && e.target.checked) lightToggle.checked = false;

                const light = lightToggle.checked;
                const sat = satToggle.checked;
                
                document.getElementById('filter-toggle-light-mode').checked = light;
                document.getElementById('filter-toggle-satellite-mode').checked = sat;

                let newStyle = light ? window.MAP_STYLE_LIGHT : (sat ? window.MAP_STYLE_SATELLITE : window.MAP_STYLE_DARK);
                if (newStyle !== window.currentMapStyle) {
                    window.currentMapStyle = newStyle;
                    window.sectorOpsMap.setStyle(newStyle);
                }
                
                // Sync filters
                window.mapFilters.showVaOnly = document.getElementById('mobile-filter-members-only').checked;
                window.mapFilters.hideAtcMarkers = document.getElementById('mobile-filter-atc').checked;
                window.mapFilters.hideNoAtcMarkers = document.getElementById('mobile-filter-no-atc').checked;

                // Sync with desktop toggles
                document.getElementById('filter-toggle-members-only').checked = window.mapFilters.showVaOnly;
                document.getElementById('filter-toggle-atc').checked = window.mapFilters.hideAtcMarkers;
                document.getElementById('filter-toggle-no-atc').checked = window.mapFilters.hideNoAtcMarkers;
                
                // Call main script function
                updateMapFilters();
            }
        });
    },

    //==================================================================
    // DOM & CSS INJECTION
    //==================================================================

    /**
     * Injects the CSS for the unified mobile drawer.
     * This *replaces* the @media query in crew-center.js.
     */
    injectCSS() {
        const styleId = 'mobile-view-manager-styles';
        if (document.getElementById(styleId)) return;

        const css = `
            /* --- 1. Base Mobile Overrides (Replaces @media query) --- */
            @media (max-width: ${this.CONFIG.breakpoint}px) {
                /* --- Hide Desktop Elements --- */
                #sidebar-toggle,
                .info-window {
                    display: none !important;
                }

                /* --- Mobile Sidebar --- */
                .mobile-sidebar-toggle-btn { display: grid; }
                .sidebar {
                    transform: translateX(-100%);
                    transition: transform 0.3s ease-in-out;
                    z-index: 2000; /* Above everything */
                }
                .dashboard-container.sidebar-mobile-open .sidebar {
                    transform: translateX(0);
                }
                .dashboard-container.sidebar-mobile-open .mobile-nav-overlay {
                    display: block;
                    z-index: 1999;
                }

                /* --- Mobile Search Bar --- */
                .sector-ops-search {
                    top: 70px;
                    left: 15px;
                    right: 15px;
                    width: auto;
                }
                .search-bar-container,
                .sector-ops-search:not(:focus-within) .search-bar-container,
                .sector-ops-search:focus-within .search-bar-container,
                .search-results-dropdown {
                    width: 100%;
                }
                .sector-ops-search #sector-ops-search-input,
                .sector-ops-search:focus-within #sector-ops-search-input {
                    width: calc(100% - 88px);
                }
            }

            /* --- 2. Mobile Drawer System --- */
            :root {
                --drawer-handle-height: 80px;
                --drawer-peek-height: ${this.CONFIG.peekHeight}px;
                --drawer-bg: rgba(20, 22, 38, 0.85);
                --drawer-border: rgba(0, 168, 255, 0.3);
                --drawer-shadow: 0 -5px 30px rgba(0,0,0,0.4);
                --drawer-radius: 20px;
            }

            #mobile-drawer-container {
                position: absolute;
                inset: 0;
                z-index: 1050;
                pointer-events: none;
                overflow: hidden;
            }

            #mobile-drawer-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(3px);
                opacity: 0;
                transition: opacity 0.4s ease;
            }

            #mobile-drawer-sheet {
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                width: 100%;
                max-height: calc(100% - 60px); /* 60px from top */
                
                background: var(--drawer-bg);
                backdrop-filter: blur(15px);
                -webkit-backdrop-filter: blur(15px);
                border-top: 1px solid var(--drawer-border);
                box-shadow: var(--drawer-shadow);
                border-top-left-radius: var(--drawer-radius);
                border-top-right-radius: var(--drawer-radius);

                display: flex;
                flex-direction: column;
                pointer-events: auto;
                
                transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                will-change: transform;
            }

            /* --- Drawer States --- */
            .drawer-state-closed #mobile-drawer-sheet {
                transform: translateY(100%);
            }
            .drawer-state-peek #mobile-drawer-sheet {
                transform: translateY(0);
                height: var(--drawer-peek-height);
            }
            .drawer-state-expanded #mobile-drawer-sheet {
                transform: translateY(0);
                height: calc(100% - 60px);
            }
            .drawer-state-expanded #mobile-drawer-overlay {
                opacity: 1;
                pointer-events: auto;
            }

            /* --- Drawer Content --- */
            #mobile-drawer-handle {
                flex-shrink: 0;
                height: var(--drawer-handle-height);
                cursor: grab;
                touch-action: none;
                user-select: none;
                position: relative;
                padding-top: 15px; /* Space for pill */
                box-sizing: border-box;
            }
            /* Pill */
            #mobile-drawer-handle::before {
                content: '';
                position: absolute;
                top: 6px;
                left: 50%;
                transform: translateX(-50%);
                width: 40px;
                height: 4px;
                background: var(--drawer-border);
                border-radius: 2px;
                opacity: 0.5;
            }

            #mobile-drawer-content-wrapper {
                flex-grow: 1;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }
            /* Hide expanded content when in peek state */
            .drawer-state-peek #mobile-drawer-content-wrapper {
                overflow: hidden;
                visibility: hidden;
            }

            /* --- 3. Peek View Templates --- */
            .peek-view-title {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                font-size: 1.1rem;
                font-weight: 600;
                color: #fff;
                height: 100%;
                padding-bottom: 15px; /* Align with pill */
            }
            .peek-view-aircraft {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                padding-bottom: 15px;
            }
            .peek-route {
                display: flex;
                align-items: center;
                gap: 15px;
                font-size: 1.3rem;
                font-weight: 700;
                font-family: 'Courier New', monospace;
                color: #fff;
            }
            .peek-callsign {
                font-size: 0.9rem;
                color: #c5cae9;
                margin-top: 4px;
            }

            /* --- 4. Expanded View: Aircraft Template --- */
            /* (This is a mobile-first version of the desktop styles) */
            .mobile-aircraft-view {
                padding: 0 16px 16px 16px;
                color: #e8eaf6;
            }
            #mobile-ac-overview-panel {
                position: relative;
                height: 150px;
                background-size: cover;
                background-position: center;
                border-radius: 12px;
                margin-top: 16px;
                -webkit-mask-image: linear-gradient(180deg, black 65%, transparent 100%);
                mask-image: linear-gradient(180deg, black 65%, transparent 100%);
            }
            #mobile-ac-overview-panel::before {
                content: '';
                position: absolute;
                inset: 0;
                z-index: 1;
                background: linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 35%);
            }
            .mobile-ac-overview-content {
                position: relative; z-index: 2; padding: 12px;
            }
            .mobile-ac-overview-content h3 {
                margin: 0; font-size: 1.3rem; font-weight: 700;
                text-shadow: 0 2px 5px rgba(0,0,0,0.7); color: #fff;
                display: flex; align-items: center; gap: 8px;
            }
            .mobile-ac-overview-content p {
                margin: 4px 0 0 0; font-size: 0.9rem; color: #e8eaf6;
                text-shadow: 0 2px 5px rgba(0,0,0,0.6);
            }
            .ac-header-logo { height: 1.5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.7)); }

            /* Route Summary (Copied from desktop, simplified) */
            .mobile-route-summary {
                display: grid;
                grid-template-columns: auto 1fr auto;
                align-items: center;
                gap: 12px;
                padding: 16px 0;
                margin-top: -30px; /* Overlap image */
                position: relative;
            }
            .mobile-route-summary .airport-line { display: flex; align-items: center; gap: 8px; }
            .mobile-route-summary .icao { font-size: 1.1rem; font-weight: 700; color: #fff; }
            .mobile-route-summary .time { font-size: 0.8rem; color: #c5cae9; margin-top: 2px; }
            .mobile-route-summary .country-flag { width: 16px; border-radius: 3px; }
            .mobile-route-summary .route-progress-container { display: grid; grid-template-columns: 1fr; grid-template-rows: 1fr; align-items: center; justify-items: center; position: relative; min-height: 28px; }
            .mobile-route-summary .route-progress-bar-container { width: 100%; height: 6px; background: rgba(10, 12, 26, 0.7); border-radius: 3px; grid-row: 1/1; grid-column: 1/1; z-index: 1; }
            .mobile-route-summary .progress-bar-fill { height: 100%; width: 0%; background: #00a8ff; border-radius: 3px; }
            .mobile-route-summary .flight-phase-indicator { padding: 3px 10px; font-size: 0.7rem; font-weight: 700; color: #fff; border-radius: 20px; grid-row: 1/1; grid-column: 1/1; z-index: 2; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); }
            /* (Phase colors are already defined globally) */

            /* PFD & Data Grid (Copied from desktop, simplified) */
            .mobile-pfd-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 16px; }
            .mobile-pfd-grid #pfd-container { background: rgba(10, 12, 26, 0.5); border-radius: 12px; overflow: hidden; }
            .mobile-pfd-grid #pfd-container svg { width: 100%; height: auto; max-width: 100%; aspect-ratio: 787 / 635; background-color: #1a1a1a; }
            .mobile-pfd-grid .data-bar-item { background: rgba(10, 12, 26, 0.5); border-radius: 12px; padding: 16px; border-top: 3px solid #28a745; display: flex; flex-direction: column; text-align: center; gap: 4px; }
            .mobile-pfd-grid .data-label { font-size: 0.8rem; color: #c5cae9; }
            .mobile-pfd-grid .data-value { font-size: 1.1rem; font-weight: 600; line-height: 1.3; margin-top: 8px; color: #e8eaf6; }

            .mobile-data-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; background: rgba(10, 12, 26, 0.5); border-radius: 12px; border-top: 3px solid #00a8ff; padding: 16px; margin-top: 12px; }
            .mobile-data-bar .data-bar-item { display: flex; flex-direction: column; text-align: center; gap: 4px; }
            .mobile-data-bar .data-label { font-size: 0.7rem; color: #c5cae9; text-transform: uppercase; }
            .mobile-data-bar .data-value { font-size: 1.5rem; color: #fff; font-weight: 600; line-height: 1.1; }
            .mobile-data-bar .data-value .unit { font-size: 0.8rem; color: #9fa8da; margin-left: 3px; }
            .mobile-data-bar .data-value .fa-solid { font-size: 0.9rem; margin-right: 4px; color: #00a8ff; }
            
            /* VSD (Copied from desktop, simplified) */
            .mobile-vsd-card { background: rgba(10, 12, 26, 0.5); border-radius: 12px; padding: 10px; border-top: 3px solid #a33ea3; margin-top: 12px; }
            .mobile-vsd-card h4 { margin: 0 0 10px 0; font-size: 0.9rem; font-weight: 600; color: #e8eaf6; text-align: center; }
            #mobile-vsd-panel { position: relative; display: flex; flex-direction: column; border-radius: 12px; min-height: 200px; max-height: 200px; overflow: hidden; font-family: 'Courier New', monospace; width: 100%; }
            #mobile-vsd-graph-window { position: relative; width: 100%; flex-grow: 1; overflow: hidden; border-radius: 12px; padding-left: 35px; box-sizing: border-box; background: linear-gradient(rgba(0, 168, 255, 0.1) 1px, transparent 1px); background-size: 100% 50px; }
            .vsd-y-axis { position: absolute; left: 0; top: 0; bottom: 0; width: 35px; font-size: 0.7rem; color: #9fa8da; padding: 5px 0; box-sizing: border-box; border-right: 1px solid rgba(0, 168, 255, 0.1); }
            .y-axis-label { position: absolute; left: 5px; transform: translateY(-50%); }
            #mobile-vsd-aircraft-icon { position: absolute; left: 0px; top: 50%; width: 30px; height: 20px; z-index: 10; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 20' fill='%2300a8ff'%3E%3Cpath d='M2,10 L10,2 L10,7 L28,7 L28,13 L10,13 L10,18 L2,10 Z' /%3E%3C/svg%3E"); background-size: contain; background-repeat: no-repeat; transform: translateY(-50%); transition: top 0.5s ease-out, left 1s linear; }
            #mobile-vsd-aircraft-icon::before { content: ''; position: absolute; top: 50%; left: 10px; width: 2px; height: 500px; background: linear-gradient(to bottom, #00a8ff, transparent 80%); opacity: 0.7; }
            #mobile-vsd-graph-content { position: absolute; top: 0; left: 35px; height: 100%; width: 1px; will-change: transform; transition: transform 1s linear; }
            #mobile-vsd-profile-svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: visible; }
            #mobile-vsd-profile-path { fill: none; stroke: #00a8ff; stroke-width: 3; }
            #mobile-vsd-flown-path { fill: none; stroke: #dc3545; stroke-width: 4; opacity: 0.9; }
            #mobile-vsd-waypoint-labels { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
            .vsd-wp-label { position: absolute; transform: translateX(-50%); color: #fff; font-size: 0.8rem; text-align: center; line-height: 1.2; padding: 2px 4px; background: rgba(10, 12, 26, 0.5); border-radius: 3px; white-space: nowrap; }
            .vsd-wp-label .wp-name { font-weight: 700; font-size: 0.9rem; color: #89f7fe; }
            .vsd-wp-label .wp-alt { font-size: 0.75rem; color: #c5cae9; }
            .vsd-wp-label::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); width: 1px; height: 12px; background: rgba(255, 255, 255, 0.3); }
            .vsd-wp-label.high-label::after { top: 100%; }
            .vsd-wp-label.low-label::after { bottom: 100%; }

            /* --- 5. Expanded View: Airport Template --- */
            .mobile-airport-view {
                padding: 16px;
            }
            .mobile-metar-card {
                padding: 16px;
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 12px 16px;
                align-items: center;
                background: linear-gradient(135deg, rgba(0, 168, 255, 0.1), rgba(0, 100, 200, 0.2));
                border-radius: 12px;
                color: #e8eaf6;
            }
            .mobile-flight-rules { font-size: 1.5rem; font-weight: 700; padding: 10px 14px; border-radius: 8px; grid-row: 1 / 3; }
            /* (Flight rule colors are defined globally) */
            .mobile-metar-details { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; font-size: 0.9rem; }
            .mobile-metar-details span { display: flex; align-items: center; gap: 8px; }
            .mobile-metar-details .fa-solid { color: #00a8ff; }
            .mobile-metar-code { grid-column: 1 / -1; font-family: 'Courier New', monospace; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; font-size: 0.8rem; color: #e0e0e0; margin-top: 5px; }
            
            .mobile-info-tabs { display: flex; background: rgba(10, 12, 26, 0.4); border-radius: 8px; margin-top: 16px; overflow: hidden; }
            .mobile-tab-btn { flex-grow: 1; padding: 14px; border: none; background: none; color: #c5cae9; cursor: pointer; font-size: 0.9rem; font-weight: 600; border-bottom: 3px solid transparent; }
            .mobile-tab-btn.active { color: #00a8ff; border-bottom-color: #00a8ff; }
            .mobile-tab-content { display: none; margin-top: 16px; }
            .mobile-tab-content.active { display: block; }
            
            .mobile-content-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
            .mobile-route-item { display: flex; align-items: center; gap: 12px; background: rgba(10, 12, 26, 0.4); padding: 12px; border-radius: 8px; }
            .mobile-route-logo { height: 32px; width: 32px; object-fit: contain; border-radius: 4px; }
            .mobile-route-info { flex-grow: 1; }
            .mobile-route-info strong { display: block; color: #fff; }
            .mobile-route-info span { font-size: 0.85rem; color: #c5cae9; }
            .mobile-atc-item { display: flex; justify-content: space-between; background: rgba(10, 12, 26, 0.4); padding: 12px; border-radius: 8px; font-size: 0.9rem; }
            .mobile-atc-type { font-weight: 600; color: #00a8ff; }
            .mobile-atc-user { color: #fff; }
            .mobile-atc-time { color: #c5cae9; }

            /* --- 6. Expanded View: Settings Template --- */
            .mobile-settings-view { padding: 16px; }
            .mobile-settings-section-title { font-size: 0.8rem; font-weight: 600; color: #9fa8da; text-transform: uppercase; margin: 16px 0 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; }
            .mobile-settings-section-title:first-child { margin-top: 0; }
            .mobile-settings-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
            .mobile-toggle-item { display: flex; justify-content: space-between; align-items: center; }
            .mobile-toggle-label { font-size: 1rem; font-weight: 600; color: #e8eaf6; display: flex; align-items: center; gap: 12px; }
            .mobile-toggle-label .fa-solid { width: 20px; text-align: center; color: #00a8ff; }
            .mobile-settings-note { padding: 16px; margin-top: 24px; background: rgba(0, 0, 0, 0.2); border-radius: 8px; font-size: 0.8rem; color: #c5cae9; }
            /* (Toggle switch styles are defined globally) */
        `;
        const style = document.createElement('style');
        style.id = styleId;
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    },

    /**
     * Injects the empty drawer DOM into the page.
     */
    createDOM() {
        const viewContainer = document.getElementById('view-rosters');
        if (!viewContainer) return;

        const drawerHtml = `
            <div id="mobile-drawer-container" class="drawer-state-closed">
                <div id="mobile-drawer-overlay"></div>
                <div id="mobile-drawer-sheet">
                    <div id="mobile-drawer-handle">
                        <div id="mobile-drawer-peek-content">
                            </div>
                    </div>
                    <div id="mobile-drawer-content-wrapper">
                        <div id="mobile-drawer-expanded-content">
                            </div>
                    </div>
                </div>
            </div>
        `;
        viewContainer.insertAdjacentHTML('beforeend', drawerHtml);

        // Store references
        this.dom.container = document.getElementById('mobile-drawer-container');
        this.dom.overlay = document.getElementById('mobile-drawer-overlay');
        this.dom.sheet = document.getElementById('mobile-drawer-sheet');
        this.dom.handle = document.getElementById('mobile-drawer-handle');
        this.dom.peekContent = document.getElementById('mobile-drawer-peek-content');
        this.dom.expandedContentWrapper = document.getElementById('mobile-drawer-content-wrapper');
        this.dom.expandedContent = document.getElementById('mobile-drawer-expanded-content');
    },

    /**
     * Attaches all base event listeners for the drawer.
     */
    attachListeners() {
        this.dom.handle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.dom.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.dom.container.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        this.dom.overlay.addEventListener('click', () => this.setDrawerState('CLOSED'));
        
        // Handle clicks on the handle
        this.dom.handle.addEventListener('click', () => {
            if (!this.swipeState.isClick) return;

            if (this.drawerState === 'PEEK') {
                this.setDrawerState('EXPANDED');
            } else if (this.drawerState === 'EXPANDED') {
                this.setDrawerState('PEEK');
            }
        });
    },

    // --- Swipe Handlers ---
    handleTouchStart(e) {
        this.swipeState.isClick = true;
        this.swipeState.isDragging = true;
        this.swipeState.startY = e.touches[0].clientY;
        this.dom.sheet.style.transition = 'none'; // Allow 1:1 drag
    },

    handleTouchMove(e) {
        if (!this.swipeState.isDragging) return;

        const currentY = e.touches[0].clientY;
        this.swipeState.deltaY = currentY - this.swipeState.startY;

        // If moved more than 10px, it's not a click
        if (Math.abs(this.swipeState.deltaY) > 10) {
            this.swipeState.isClick = false;
        }

        // Prevent pulling down past the "expanded" state
        if (this.drawerState === 'EXPANDED' && this.swipeState.deltaY < 0) {
            return;
        }
        // Prevent pulling up past the "peek" state (when starting from peek)
        if (this.drawerState === 'PEEK' && this.swipeState.deltaY < 0) {
            return;
        }

        const newY = this.calculateDragY(this.swipeState.deltaY);
        this.dom.sheet.style.transform = `translateY(${newY}px)`;
    },

    handleTouchEnd(e) {
        if (!this.swipeState.isDragging) return;
        this.swipeState.isDragging = false;
        this.dom.sheet.style.transition = ''; // Restore animation

        const velocity = this.swipeState.deltaY; // Simple velocity check

        if (this.swipeState.isClick) {
            // It was a click, let the click handler manage it
            return;
        }

        if (this.drawerState === 'EXPANDED') {
            if (velocity > 50) this.setDrawerState('PEEK');
            else this.setDrawerState('EXPANDED'); // Snap back
        } else if (this.drawerState === 'PEEK') {
            if (velocity < -50) this.setDrawerState('EXPANDED');
            else if (velocity > 50) this.setDrawerState('CLOSED');
            else this.setDrawerState('PEEK'); // Snap back
        }
    },

    calculateDragY(deltaY) {
        const expandedY = this.dom.container.clientHeight - this.dom.sheet.clientHeight;
        const peekY = this.dom.container.clientHeight - this.CONFIG.peekHeight;

        if (this.drawerState === 'EXPANDED') {
            return Math.max(expandedY, expandedY + deltaY);
        }
        if (this.drawerState === 'PEEK') {
            return Math.max(expandedY, peekY + deltaY);
        }
        return 0;
    },

    // --- Aircraft Template ---
    getAircraftTemplate() {
        // This is the mobile-first HTML structure.
        // Note the `mobile-` prefixes on IDs to prevent conflicts with desktop.
        return `
            <div class="mobile-aircraft-view">
                <div id="mobile-ac-overview-panel">
                    <div class="mobile-ac-overview-content">
                        <h3 id="mobile-ac-callsign"></h3>
                        <p id="mobile-ac-username"></p>
                    </div>
                </div>
                
                <div class="mobile-route-summary">
                    <div style="text-align: left;">
                        <div class="airport-line">
                            <img src="" class="country-flag" id="mobile-ac-bar-dep-flag" style="display: none;">
                            <span class="icao" id="mobile-ac-bar-dep">N/A</span>
                        </div>
                        <span class="time" id="mobile-ac-bar-atd">--:-- Z</span>
                    </div>
                    <div class="route-progress-container">
                        <div class="route-progress-bar-container">
                            <div class="progress-bar-fill" id="mobile-ac-progress-bar"></div>
                        </div>
                        <div class="flight-phase-indicator" id="mobile-ac-phase-indicator">ENROUTE</div>
                    </div>
                    <div style="text-align: right;">
                        <div class="airport-line" style="justify-content: flex-end;">
                            <span class="icao" id="mobile-ac-bar-arr">N/A</span>
                            <img src="" class="country-flag" id="mobile-ac-bar-arr-flag" style="display: none;">
                        </div>
                        <span class="time" id="mobile-ac-bar-eta">--:-- Z</span>
                    </div>
                </div>

                <div class="mobile-pfd-grid">
                    <div id="pfd-container"></div>
                    <div class="data-bar-item">
                        <span class="data-label">CURRENTLY OVER</span>
                        <span class="data-value" id="mobile-ac-location">---</span>
                    </div>
                </div>

                <div class="mobile-data-bar">
                    <div class="data-bar-item"><span class="data-label">NEXT WP</span><span class="data-value" id="mobile-ac-next-wp">---</span></div>
                    <div class="data-bar-item"><span class="data-label">DIST. TO WP</span><span class="data-value" id="mobile-ac-next-wp-dist">--.-<span class="unit">NM</span></span></div>
                    <div class="data-bar-item"><span class="data-label">DIST. TO DEST.</span><span class="data-value" id="mobile-ac-dist">---<span class="unit">NM</span></span></div>
                    <div class="data-bar-item"><span class="data-label">ETE TO DEST.</span><span class="data-value" id="mobile-ac-ete">--:--</span></div>
                    <div class="data-bar-item"><span class="data-label">VERTICAL SPEED</span><span class="data-value" id="mobile-ac-vs">---<span class="unit">fpm</span></span></div>
                </div>

                <div class="mobile-vsd-card">
                    <h4>Vertical Profile</h4>
                    <div id="mobile-vsd-panel" class="vsd-panel" data-profile-built="false">
                        <div id="mobile-vsd-graph-window" class="vsd-graph-window">
                            <div id="mobile-vsd-aircraft-icon"></div>
                            <div id="mobile-vsd-graph-content">
                                <svg id="mobile-vsd-profile-svg" xmlns="http://www.w3.org/2000/svg">
                                    <path id="mobile-vsd-flown-path" d="" />
                                    <path id="mobile-vsd-profile-path" d="" />
                                </svg>
                                <div id="mobile-vsd-waypoint-labels"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};

// --- Global Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Make the manager globally accessible *before* init
    window.MobileViewManager = MobileViewManager;
    
    // Defer init slightly to ensure main script variables are available
    setTimeout(() => {
        MobileViewManager.init();
    }, 100);
});