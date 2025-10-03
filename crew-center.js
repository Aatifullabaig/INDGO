// Crew Center – Merged Script with Sector Ops Command Revamp
document.addEventListener('DOMContentLoaded', async () => {
    // --- Global Configuration ---
    const API_BASE_URL = 'https://indgo-backend.onrender.com';
    const LIVE_FLIGHTS_API_URL = 'https://acars-backend-uxln.onrender.com/flights';
    const TARGET_SERVER_NAME = 'Expert Server';
    const AIRCRAFT_SELECTION_LIST = [
        // Airbus
        { value: 'A318', name: 'Airbus A318-100' },
        { value: 'A319', name: 'Airbus A319-100' },
        { value: 'A320', name: 'Airbus A320-200' },
        { value: 'A20N', name: 'Airbus A320neo' },
        { value: 'A321', name: 'Airbus A321-200' },
        { value: 'A21N', name: 'Airbus A321neo' },
        { value: 'A306', name: 'Airbus A300B4-600' },
        { value: 'A310', name: 'Airbus A310-304' },
        { value: 'A332', name: 'Airbus A330-200' },
        { value: 'A333', name: 'Airbus A330-300' },
        { value: 'A339', name: 'Airbus A330-900neo' },
        { value: 'A343', name: 'Airbus A340-300' },
        { value: 'A346', name: 'Airbus A340-600' },
        { value: 'A359', name: 'Airbus A350-900' },
        { value: 'A35K', name: 'Airbus A350-1000' },
        { value: 'A388', name: 'Airbus A380-800' },
        // Boeing
        { value: 'B712', name: 'Boeing 717-200' },
        { value: 'B722', name: 'Boeing 727-200' },
        { value: 'B732', name: 'Boeing 737-200' },
        { value: 'B733', name: 'Boeing 737-300' },
        { value: 'B734', name: 'Boeing 737-400' },
        { value: 'B735', name: 'Boeing 737-500' },
        { value: 'B736', name: 'Boeing 737-600' },
        { value: 'B737', name: 'Boeing 737-700' },
        { value: 'B738', name: 'Boeing 737-800' },
        { value: 'B739', name: 'Boeing 737-900' },
        { value: 'B38M', name: 'Boeing 737 MAX 8' },
        { value: 'B742', name: 'Boeing 747-200B' },
        { value: 'B744', name: 'Boeing 747-400' },
        { value: 'B748', name: 'Boeing 747-8' },
        { value: 'B752', name: 'Boeing 757-200' },
        { value: 'B753', name: 'Boeing 757-300' },
        { value: 'B762', name: 'Boeing 767-200ER' },
        { value: 'B763', name: 'Boeing 767-300ER' },
        { value: 'B772', name: 'Boeing 777-200ER' },
        { value: 'B77L', name: 'Boeing 777-200LR' },
        { value: 'B77W', name: 'Boeing 777-300ER' },
        { value: 'B788', name: 'Boeing 787-8' },
        { value: 'B789', name: 'Boeing 787-9' },
        { value: 'B78X', name: 'Boeing 787-10' },
        // Bombardier (CRJ)
        { value: 'CRJ2', name: 'Bombardier CRJ-200' },
        { value: 'CRJ7', name: 'Bombardier CRJ-700' },
        { value: 'CRJ9', name: 'Bombardier CRJ-900' },
        { value: 'CRJX', name: 'Bombardier CRJ-1000' },
        // De Havilland
        { value: 'DH8D', name: 'De Havilland Dash 8 Q400' },
        // Embraer
        { value: 'E135', name: 'Embraer ERJ-135' },
        { value: 'E145', name: 'Embraer ERJ-145' },
        { value: 'E170', name: 'Embraer E170' },
        { value: 'E175', name: 'Embraer E175' },
        { value: 'E190', name: 'Embraer E190' },
        { value: 'E195', name: 'Embraer E195' },
        // McDonnell Douglas
        { value: 'DC10', name: 'McDonnell Douglas DC-10' },
        { value: 'MD11', name: 'McDonnell Douglas MD-11' },
        { value: 'MD82', name: 'McDonnell Douglas MD-82' },
        { value: 'MD88', name: 'McDonnell Douglas MD-88' },
        { value: 'MD90', name: 'McDonnell Douglas MD-90' },
    ];

    // --- State Variables ---
    let MAPBOX_ACCESS_TOKEN = null;
    let DYNAMIC_FLEET = [];
    let CURRENT_PILOT = null;
    let ACTIVE_FLIGHT_PLANS = [];
    let CURRENT_OFP_DATA = null;
    let crewRestInterval = null;
    let airportsData = {};
    let ALL_AVAILABLE_ROUTES = []; // State variable to hold all routes for filtering

    // --- Map-related State ---
    let liveFlightsMap = null;
    let pilotMarkers = {};
    let liveFlightsInterval = null;
    let sectorOpsMap = null;
    let sectorOpsMapMarkers = [];
    let sectorOpsMapRouteLayers = [];
    let sectorOpsLiveFlightsInterval = null;


    // --- Helper: Fetch Mapbox Token from Netlify Function ---
    async function fetchMapboxToken() {
        try {
            const response = await fetch('https://indgo-va.netlify.app/.netlify/functions/config');
            if (!response.ok) throw new Error('Could not fetch server configuration.');
            const config = await response.json();
            if (!config.mapboxToken) throw new Error('Mapbox token is missing from server configuration.');
            MAPBOX_ACCESS_TOKEN = config.mapboxToken;
            mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
        } catch (error) {
            console.error('Failed to initialize maps:', error.message);
            showNotification('Could not load mapping services.', 'error');
        }
    }

    // --- NEW: Fetch Airport Coordinate Data ---
    async function fetchAirportsData() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/airports`);
            if (!response.ok) throw new Error('Could not load airport coordinate data.');
            airportsData = await response.json();
            console.log(`Successfully loaded data for ${Object.keys(airportsData).length} airports.`);
        } catch (error) {
            console.error('Failed to fetch airport data:', error);
            showNotification('Could not load airport location data; map features will be limited.', 'error');
        }
    }


    // --- Fetch Routes from Backend ---
    async function fetchRoutes(params = {}) {
        try {
            const query = new URLSearchParams(params).toString();
            const res = await fetch(`${API_BASE_URL}/api/routes${query ? `?${query}` : ''}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            if (!res.ok) throw new Error('Failed to fetch routes.');
            return await res.json();
        } catch (err) {
            console.error('Error fetching routes:', err);
            showNotification('Could not load routes from server.', 'error');
            return [];
        }
    }

    // --- Helper Functions ---
    function getRankBadgeHTML(rankName, options = {}) {
        const defaults = {
            showImage: true,
            showName: false,
            imageClass: 'rank-badge-img',
            containerClass: 'rank-badge',
        };
        const config = { ...defaults, ...options };

        if (!rankName) return `<span>Unknown Rank</span>`;

        const rankSlug = 'rank-' + rankName.toLowerCase().replace(/\s+/g, '-');
        const fileName = rankName.toLowerCase().replace(/\s+/g, '_') + '_badge.png';
        const imagePath = `images/badges/${fileName}`;

        let imageHtml = '';
        let nameHtml = '';

        if (config.showImage) {
            imageHtml = `<img src="${imagePath}" alt="${rankName}" title="${rankName}" class="${config.imageClass}" onerror="this.outerHTML='<span>${rankName}</span>'">`;
        }

        if (config.showName) {
            nameHtml = `<span class="rank-badge-name">${rankName}</span>`;
        }

        if (config.showImage && !config.showName) {
            return imageHtml;
        }

        if (config.showImage && config.showName) {
            return `<span class="${config.containerClass} ${rankSlug}">${imageHtml} ${nameHtml}</span>`;
        }

        return `<span>${rankName}</span>`; // Fallback
    }

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
        const date = (typeof timestamp === 'number' && timestamp.toString().length === 10) ?
            new Date(timestamp * 1000) :
            new Date(timestamp);
        if (isNaN(date.getTime())) return '----';
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    }

    function formatWeight(kg) {
        if (isNaN(kg) || kg === null) return '--- kg';
        return `${Number(kg).toLocaleString()} kg`;
    }

    function extractAirlineCode(flightNumber) {
        if (!flightNumber || typeof flightNumber !== 'string') return 'UNKNOWN';
        const cleanedFlightNumber = flightNumber.trim().toUpperCase();
        const match = cleanedFlightNumber.match(/^([A-Z0-9]{2,3})([0-9]{1,4})([A-Z]?)$/);
        if (match && match[1]) return match[1].substring(0, 2);
        const fallbackMatch = cleanedFlightNumber.match(/^(\D+)/);
        if (fallbackMatch && fallbackMatch[1]) return fallbackMatch[1].substring(0, 2);
        return 'UNKNOWN';
    }

    const populateDispatchPass = (container, plan, options = {}) => {
        if (!container || !plan) return;

        // --- Data Formatters & Converters ---
        const isSimbriefPlan = !!plan.tlr;
        const lbsToKg = (lbs) => {
            if (isNaN(lbs) || lbs === null) return null;
            return Math.round(Number(lbs) / 2.20462);
        };
        const formatWeightDisplay = (value) => {
            if (isNaN(value) || value === null) return '--- kg';
            const kgValue = isSimbriefPlan ? lbsToKg(value) : value;
            return `${kgValue.toLocaleString()} kg`;
        };
        const formatEET = (hours) => {
            if (isNaN(hours) || hours < 0) return '00:00';
            const h = Math.floor(hours);
            const m = Math.round((hours - h) * 60);
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };
        const formatSpeed = (kts) => (kts ? `${kts} kts` : '---');

        // --- Performance & Weather Data Extraction ---
        const plannedTakeoffRunway = plan.tlr?.takeoff?.conditions?.planned_runway;
        const takeoffRunwayData = plan.tlr?.takeoff?.runway?.find(r => r.identifier === plannedTakeoffRunway);
        const takeoffFlaps = takeoffRunwayData?.flap_setting ?? '---';
        const takeoffThrust = takeoffRunwayData?.thrust_setting ?? '---';
        const takeoffFlexTemp = takeoffRunwayData?.flex_temperature ? `${takeoffRunwayData.flex_temperature}°C` : '---';
        
        const v1 = takeoffRunwayData?.speeds_v1;
        const vr = takeoffRunwayData?.speeds_vr;
        const v2 = takeoffRunwayData?.speeds_v2;

        const landingFlaps = plan.tlr?.landing?.conditions?.flap_setting ?? '---';
        const landingWeight = formatWeightDisplay(plan.tlr?.landing?.conditions?.planned_weight);
        const landingWind = `${plan.tlr?.landing?.conditions?.wind_direction ?? '???'}° @ ${plan.tlr?.landing?.conditions?.wind_speed ?? '?'} kts`;
        const vref = plan.tlr?.landing?.distance_dry?.speeds_vref ?? 0;
        const vrefAdd = vref > 0 ? '+5 kts (min)' : '---';
        const vapp = vref > 0 ? `${parseInt(vref, 10) + 5} kts` : '---';
        const departureWeather = window.WeatherService.parseMetar(plan.departureWeather);
        const arrivalWeather = window.WeatherService.parseMetar(plan.arrivalWeather);

        // --- Redesigned HTML Structure ---
        container.innerHTML = `
            <div class="dispatch-header">
                <div class="header-left">
                    <img src="/images/indgo.png" alt="Indigo Air Logo" class="dispatch-header-logo">
                    <div class="header-flight-info">
                        <span class="flight-number">${plan.flightNumber}</span>
                        <h2 class="flight-route">${plan.departure} <i class="fa-solid fa-plane"></i> ${plan.arrival}</h2>
                    </div>
                </div>
                <div class="header-right">
                    <span class="flight-date">${new Date(plan.etd).toLocaleDateString()}</span>
                    <span class="dispatch-type">Performance Dispatch</span>
                </div>
            </div>

            <div class="dispatch-body">
                <div class="summary-grid">
                    <div class="summary-item">
                        <label><i class="fa-solid fa-plane-up"></i> Aircraft</label>
                        <span>${plan.aircraft || '---'}</span>
                    </div>
                    <div class="summary-item">
                        <label><i class="fa-solid fa-gauge-high"></i> Cruise</label>
                        <span>FL${plan.cruiseAltitude ? plan.cruiseAltitude / 100 : '---'} / M${plan.cruiseSpeed || '---'}</span>
                    </div>
                    <div class="summary-item">
                        <label><i class="fa-solid fa-clock"></i> Duration</label>
                        <span>${formatEET(plan.eet)}</span>
                    </div>
                    <div class="summary-item">
                        <label><i class="fa-solid fa-weight-hanging"></i> ZFW / TOW</label>
                        <span>${formatWeightDisplay(plan.zfw)} / ${formatWeightDisplay(plan.tow)}</span>
                    </div>
                     <div class="summary-item">
                        <label><i class="fa-solid fa-users"></i> POB / Cargo</label>
                        <span>${plan.pob || '0'} / ${formatWeightDisplay(plan.cargo)}</span>
                    </div>
                     <div class="summary-item">
                        <label><i class="fa-solid fa-gas-pump"></i> Total Fuel</label>
                        <span>${formatWeightDisplay(plan.fuelTotal)}</span>
                    </div>
                </div>

                <div class="dispatch-accordion">
                    <div class="accordion-item">
                        <button class="accordion-header" aria-expanded="false">
                            <h3><i class="fa-solid fa-route"></i> Route & Map</h3>
                            <i class="fa-solid fa-chevron-down toggle-icon"></i>
                        </button>
                        <div class="accordion-content">
                            <div id="dispatch-map-${plan._id}" class="dispatch-map-container"></div>
                            <div class="route-info">
                                <strong>Route:</strong> <span>${plan.route || 'Not Provided'}</span>
                            </div>
                            <div class="alternates-info">
                                <strong>Alternates:</strong> <span>${plan.alternate || 'None'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="accordion-item">
                        <button class="accordion-header" aria-expanded="false">
                            <h3><i class="fa-solid fa-plane-departure"></i> Performance</h3>
                            <i class="fa-solid fa-chevron-down toggle-icon"></i>
                        </button>
                        <div class="accordion-content">
                            <div class="performance-container">
                                <div class="perf-card">
                                    <h4>Takeoff</h4>
                                    <div class="data-item"><strong>Flaps:</strong> <span>${takeoffFlaps}</span></div>
                                    <div class="data-item"><strong>Thrust:</strong> <span>${takeoffThrust}</span></div>
                                    <div class="data-item"><strong>SEL/FLEX Temp:</strong> <span>${takeoffFlexTemp}</span></div>
                                    <div class="data-item"><strong>V1:</strong> <span>${formatSpeed(v1)}</span></div>
                                    <div class="data-item"><strong>Vr:</strong> <span>${formatSpeed(vr)}</span></div>
                                    <div class="data-item"><strong>V2:</strong> <span>${formatSpeed(v2)}</span></div>
                                </div>
                                <div class="perf-card">
                                    <h4>Landing</h4>
                                    <div class="data-item"><strong>Flaps:</strong> <span>${landingFlaps}</span></div>
                                    <div class="data-item"><strong>Weight:</strong> <span>${landingWeight}</span></div>
                                    <div class="data-item"><strong>Wind:</strong> <span>${landingWind}</span></div>
                                    <div class="data-item"><strong>Vref Additive:</strong> <span>${vrefAdd}</span></div>
                                    <div class="data-item"><strong>Vapp (min):</strong> <span>${vapp}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="accordion-item">
                        <button class="accordion-header" aria-expanded="false">
                            <h3><i class="fa-solid fa-cloud-sun"></i> Weather</h3>
                            <i class="fa-solid fa-chevron-down toggle-icon"></i>
                        </button>
                        <div class="accordion-content">
                             <div class="weather-container">
                                <div class="weather-sub-card">
                                    <h4><i class="fa-solid fa-location-dot"></i> Departure (${plan.departure})</h4>
                                    <div class="data-item"><span>Cond:</span> <span>${departureWeather.condition}</span></div>
                                    <div class="data-item"><span>Temp:</span> <span>${departureWeather.temp}</span></div>
                                    <div class="data-item"><span>Wind:</span> <span>${departureWeather.wind}</span></div>
                                    <code class="metar-raw">${departureWeather.raw}</code>
                                </div>
                                <div class="weather-sub-card">
                                    <h4><i class="fa-solid fa-location-dot"></i> Arrival (${plan.arrival})</h4>
                                    <div class="data-item"><span>Cond:</span> <span>${arrivalWeather.condition}</span></div>
                                    <div class="data-item"><span>Temp:</span> <span>${arrivalWeather.temp}</span></div>
                                    <div class="data-item"><span>Wind:</span> <span>${arrivalWeather.wind}</span></div>
                                    <code class="metar-raw">${arrivalWeather.raw}</code>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="dispatch-footer">
                <div class="dispatch-actions-wrapper" id="dispatch-actions-${plan._id}"></div>
            </div>
        `;

        // Add accordion functionality
        const accordionHeaders = container.querySelectorAll('.accordion-header');
        accordionHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const item = header.parentElement;
                const content = header.nextElementSibling;
                const isExpanded = header.getAttribute('aria-expanded') === 'true';

                header.setAttribute('aria-expanded', !isExpanded);
                item.classList.toggle('active');

                if (!isExpanded) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                } else {
                    content.style.maxHeight = '0px';
                }
            });
        });

        // Action Buttons & Map Plotting
        const actionsContainer = container.querySelector(`#dispatch-actions-${plan._id}`);
        if (options.isPreview) {
            actionsContainer.innerHTML = `
                <div class="dispatch-action-group">
                    <button id="dispatch-close-btn" class="details-button">Cancel</button>
                    <p class="dispatch-action-description">Discards this generated plan and returns to the filing form.</p>
                </div>
                <div class="dispatch-action-group">
                    <button id="file-from-simbrief-btn" class="cta-button">File This Flight Plan</button>
                    <p class="dispatch-action-description">Submits this flight plan to the airline and makes it your active flight.</p>
                </div>
            `;
        } else if (plan.status === 'PLANNED') {
            actionsContainer.innerHTML = `
                <button class="cta-button" id="depart-btn" data-plan-id="${plan._id}"><i class="fa-solid fa-plane-departure"></i> Depart</button>
                <button class="end-duty-btn" id="cancel-btn" data-plan-id="${plan._id}"><i class="fa-solid fa-ban"></i> Cancel Flight</button>
            `;
        } else if (plan.status === 'FLYING') {
            let actionsHTML = '';
            if (plan.mapData?.ifTracking?.status && plan.mapData.ifTracking.status !== 'stopped') {
                actionsHTML = `
                    <div class="acars-tracking-notice">
                        <i class="fa-solid fa-tower-broadcast"></i>
                        <div>
                            <strong>This flight is being tracked with ACARS.</strong>
                            <p>Your PIREP will be submitted automatically after landing.</p>
                        </div>
                    </div>
                `;
            }
            actionsHTML += `<button class="cta-button" id="arrive-btn" data-plan-id="${plan._id}"><i class="fa-solid fa-plane-arrival"></i> Arrive Manually</button>`;
            actionsContainer.innerHTML = actionsHTML;
        }

        if (plan.mapData && plan.mapData.origin && plan.mapData.destination) {
            setTimeout(() => {
                plotDispatchMap(`dispatch-map-${plan._id}`, plan.mapData.origin, plan.mapData.destination, plan.mapData.navlog);
            }, 100);
        }
    };

    // --- Rank & Fleet Models ---
    const PILOT_RANKS = [
        'IndGo Cadet', 'Skyline Observer', 'Route Explorer', 'Skyline Officer',
        'Command Captain', 'Elite Captain', 'Blue Eagle', 'Line Instructor',
        'Chief Flight Instructor', 'IndGo SkyMaster', 'Blue Legacy Commander'
    ];
    const rankIndex = (r) => PILOT_RANKS.indexOf(String(r || '').trim());

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

    const userCanFlyAircraft = (userRank, aircraftIcao) => {
        const ac = DYNAMIC_FLEET.find(a => a.icao === aircraftIcao);
        if (!ac) return false;
        const ui = rankIndex(userRank);
        const ri = rankIndex(ac.rankUnlock);
        return ui >= 0 && ri >= 0 && ri <= ui;
    };

    const getAllowedFleet = (userRank) => {
        return DYNAMIC_FLEET.filter(ac => {
            const userRankIndex = rankIndex(userRank);
            const aircraftRankIndex = rankIndex(ac.rankUnlock);
            return userRankIndex >= 0 && aircraftRankIndex >= 0 && aircraftRankIndex <= userRankIndex;
        });
    };

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
    const mainContentLoader = document.getElementById('main-content-loader');
    const sidebarNav = document.querySelector('.sidebar-nav');
    const dashboardContainer = document.querySelector('.dashboard-container');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const notificationsBell = document.getElementById('notifications-bell');
    const notificationsModal = document.getElementById('notifications-modal');

    // Modals
    const promotionModal = document.getElementById('promotion-modal');
    const arriveFlightModal = document.getElementById('arrive-flight-modal');

    // --- Auth Check ---
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // --- Mapbox Plotting Functions ---

    /**
     * Plots a static route map for a dispatch pass using Mapbox GL JS.
     */
    const plotDispatchMap = (mapContainerId, origin, dest, navlogFixes) => {
        const mapContainer = document.getElementById(mapContainerId);
        if (!mapContainer || !MAPBOX_ACCESS_TOKEN) return;

        if (mapContainer.mapInstance) {
            mapContainer.mapInstance.remove();
            mapContainer.mapInstance = null;
        }

        if (!origin || !dest || !navlogFixes || navlogFixes.length === 0) {
            mapContainer.innerHTML = '<p class="map-error-msg">Route data not available.</p>';
            return;
        }

        const newMap = new mapboxgl.Map({
            container: mapContainerId,
            style: 'mapbox://styles/mapbox/light-v11',
            scrollZoom: false,
            zoom: 3
        });
        mapContainer.mapInstance = newMap;

        newMap.on('load', () => {
            const routeCoords = navlogFixes.map(fix => [parseFloat(fix.pos_long), parseFloat(fix.pos_lat)]);

            newMap.addSource('route', {
                'type': 'geojson',
                'data': {
                    'type': 'Feature',
                    'geometry': { 'type': 'LineString', 'coordinates': routeCoords }
                }
            });
            newMap.addLayer({
                'id': 'route',
                'type': 'line',
                'source': 'route',
                'paint': { 'line-color': '#001B94', 'line-width': 3 }
            });

            new mapboxgl.Marker({ color: '#28a745' }).setLngLat([origin.pos_long, origin.pos_lat]).setPopup(new mapboxgl.Popup().setHTML(`<b>Departure:</b> ${origin.icao_code}`)).addTo(newMap);
            new mapboxgl.Marker({ color: '#dc3545' }).setLngLat([dest.pos_long, dest.pos_lat]).setPopup(new mapboxgl.Popup().setHTML(`<b>Arrival:</b> ${dest.icao_code}`)).addTo(newMap);

            const bounds = routeCoords.reduce((b, coord) => b.extend(coord), new mapboxgl.LngLatBounds(routeCoords[0], routeCoords[0]));
            newMap.fitBounds(bounds, { padding: 50 });
        });
    };

    /**
     * Initializes the live operations map.
     */
    function initializeLiveMap() {
        if (!MAPBOX_ACCESS_TOKEN) return;
        if (document.getElementById('live-flights-map-container') && !liveFlightsMap) {
            liveFlightsMap = new mapboxgl.Map({
                container: 'live-flights-map-container',
                style: 'mapbox://styles/mapbox/dark-v11',
                center: [78.9629, 22.5937],
                zoom: 4,
                minZoom: 2
            });
            liveFlightsMap.on('load', startLiveLoop);
        } else {
            startLiveLoop();
        }
    }

    /**
     * Starts or restarts the live flight update interval.
     */
    function startLiveLoop() {
        if (!liveFlightsInterval) {
            updateLiveFlights();
            liveFlightsInterval = setInterval(updateLiveFlights, 20000);
        }
    }

    /**
     * Helper to remove dynamic flight path layers from the map.
     */
    function removeFlightPathLayers(map) {
        if (map.getLayer('flown-path')) map.removeLayer('flown-path');
        if (map.getSource('flown-path-source')) map.removeSource('flown-path-source');
        if (map.getLayer('planned-path')) map.removeLayer('planned-path');
        if (map.getSource('planned-path-source')) map.removeSource('planned-path-source');
    }

    /**
     * Fetches live flight data and updates the map.
     */
    async function updateLiveFlights() {
        if (!liveFlightsMap || !liveFlightsMap.isStyleLoaded()) return;

        try {
            const sessionsRes = await fetch('https://acars-backend-uxln.onrender.com/if-sessions');
            const expertSession = (await sessionsRes.json()).sessions.find(s => s.name.toLowerCase().includes('expert'));
            if (!expertSession) {
                console.warn('No Expert Server session found for live flights.');
                return;
            }

            const response = await fetch(`${LIVE_FLIGHTS_API_URL}/${expertSession.id}?callsignEndsWith=GO`);
            const flights = (await response.json()).flights || [];
            const activeFlightIds = new Set();

            flights.forEach(f => {
                const { flightId, position: pos, callsign, username } = f;
                if (!flightId || !pos || pos.lat == null || pos.lon == null) return;

                activeFlightIds.add(flightId);
                const lngLat = [pos.lon, pos.lat];

                if (pilotMarkers[flightId]) {
                    // Update existing marker
                    const entry = pilotMarkers[flightId];
                    entry.marker.setLngLat(lngLat);
                    entry.marker.getElement().style.transform = `rotate(${pos.track_deg ?? 0}deg)`;
                } else {
                    // Create new marker
                    const el = document.createElement('div');
                    el.className = 'plane-marker';
                    const marker = new mapboxgl.Marker(el).setLngLat(lngLat).addTo(liveFlightsMap);
                    pilotMarkers[flightId] = { marker: marker };

                    // Add click event listener
                    marker.getElement().addEventListener('click', async () => {
                        removeFlightPathLayers(liveFlightsMap);
                        const popup = new mapboxgl.Popup({ closeButton: false, offset: 25 }).setLngLat(lngLat).setHTML(`<b>${callsign}</b><br><i>Loading flight data...</i>`).addTo(liveFlightsMap);

                        try {
                            const [planRes, routeRes] = await Promise.all([
                                fetch(`${LIVE_FLIGHTS_API_URL}/${expertSession.id}/${flightId}/plan`),
                                fetch(`${LIVE_FLIGHTS_API_URL}/${expertSession.id}/${flightId}/route`)
                            ]);
                            const planJson = await planRes.json();
                            const routeJson = await routeRes.json();
                            let allCoordsForBounds = [];

                            // Flown path
                            const flownCoords = (routeRes.ok && routeJson.ok && Array.isArray(routeJson.route)) ? routeJson.route.map(p => [p.lon, p.lat]) : [];
                            if (flownCoords.length > 1) {
                                allCoordsForBounds.push(...flownCoords);
                                liveFlightsMap.addSource('flown-path-source', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: flownCoords } } });
                                liveFlightsMap.addLayer({ id: 'flown-path', type: 'line', source: 'flown-path-source', paint: { 'line-color': '#00b894', 'line-width': 4 } });
                            }

                            // Planned path
                            if (planRes.ok && planJson.ok && planJson.plan?.waypoints?.length > 0) {
                                const plannedWps = planJson.plan.waypoints.map(wp => [wp.lon, wp.lat]);
                                const remainingPathCoords = [lngLat, ...plannedWps];
                                allCoordsForBounds.push(...remainingPathCoords);
                                liveFlightsMap.addSource('planned-path-source', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: remainingPathCoords } } });
                                liveFlightsMap.addLayer({ id: 'planned-path', type: 'line', source: 'planned-path-source', paint: { 'line-color': '#e84393', 'line-width': 3, 'line-dasharray': [2, 2] } });
                                popup.setHTML(`<b>${callsign}</b> (${username || 'N/A'})<br>Route and flight plan loaded.`);
                            } else {
                                popup.setHTML(`<b>${callsign}</b> (${username || 'N/A'})<br>No flight plan filed.`);
                            }

                            if (allCoordsForBounds.length > 0) {
                                const bounds = allCoordsForBounds.reduce((b, coord) => b.extend(coord), new mapboxgl.LngLatBounds(allCoordsForBounds[0], allCoordsForBounds[0]));
                                liveFlightsMap.fitBounds(bounds, { padding: 60, maxZoom: 10 });
                            }
                        } catch (err) {
                            console.error("Failed to fetch/render flight paths:", err);
                            popup.setHTML(`<b>${callsign}</b> (${username || 'N/A'})<br>Could not load flight data.`);
                        }
                    });
                }
            });

            // Remove inactive markers
            Object.keys(pilotMarkers).forEach(fid => {
                if (!activeFlightIds.has(String(fid))) {
                    pilotMarkers[fid].marker?.remove();
                    delete pilotMarkers[fid];
                }
            });
        } catch (err) {
            console.error('Error updating live flights:', err);
        }
    }


    // ==========================================================
    // START: SECTOR OPS / ROUTE EXPLORER LOGIC (INTERACTIVE AIRPORT MAP)
    // ==========================================================

    /**
     * Main orchestrator for the Sector Ops view.
     * Manages fetching data and orchestrating map and list updates.
     */
    async function initializeSectorOpsView() {
        const selector = document.getElementById('departure-hub-selector');
        const mapContainer = document.getElementById('sector-ops-map-fullscreen');
        if (!selector || !mapContainer) return;

        // Use the main content loader instead of a local one
        mainContentLoader.classList.add('active');

        try {
            // 1. Get pilot's available hubs
            const rosterRes = await fetch(`${API_BASE_URL}/api/rosters/my-rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!rosterRes.ok) throw new Error('Could not determine your current location.');
            const rosterData = await rosterRes.json();
            const departureHubs = rosterData.searchCriteria?.searched || ['VIDP'];

            // 2. Populate hub selector
            selector.innerHTML = departureHubs.map(h => `<option value="${h}">${airportsData[h]?.name || h}</option>`).join('');
            const selectedHub = selector.value;

            // 3. Initialize the Mapbox map
            await initializeSectorOpsMap(selectedHub);

            // After the map is initialized, start the live flight data loop for this specific map.
            startSectorOpsLiveLoop();

            // 4. Fetch data for both tabs in parallel
            const [rosters, routes] = await Promise.all([
                fetchAndRenderRosters(selectedHub),
                fetchAndRenderRoutes()
            ]);
            ALL_AVAILABLE_ROUTES = routes; // Store all routes for later use

            // 5. Plot all airports on the map as the default view
            plotAllAirportsOnMap();

            // 6. Set up all event listeners
            setupSectorOpsEventListeners();

        } catch (error) {
            console.error("Error initializing Sector Ops view:", error);
            showNotification(error.message, 'error');
            document.getElementById('roster-list-container').innerHTML = `<p class="error-text">${error.message}</p>`;
            document.getElementById('route-list-container').innerHTML = `<p class="error-text">${error.message}</p>`;
        } finally {
            mainContentLoader.classList.remove('active');
        }
    }

    /**
     * Initializes or resets the main Sector Ops Mapbox map.
     */
    async function initializeSectorOpsMap(centerICAO) {
        if (!MAPBOX_ACCESS_TOKEN) {
            document.getElementById('sector-ops-map-fullscreen').innerHTML = '<p class="map-error-msg">Map service not available.</p>';
            return;
        }
        if (sectorOpsMap) sectorOpsMap.remove();

        const centerCoords = airportsData[centerICAO] ? [airportsData[centerICAO].lon, airportsData[centerICAO].lat] : [77.2, 28.6]; // Default to Delhi

        sectorOpsMap = new mapboxgl.Map({
            container: 'sector-ops-map-fullscreen', // UPDATE: Target the new full-screen container
            style: 'mapbox://styles/mapbox/dark-v11',
            center: centerCoords,
            zoom: 4.5,
            interactive: true
        });

        return new Promise(resolve => {
            sectorOpsMap.on('load', () => {
                // Load the icon for live aircraft markers. Assumes an icon exists at this path.
                sectorOpsMap.loadImage(
                    '/images/whiteplane.png',
                    (error, image) => {
                        if (error) {
                            console.warn('Could not load plane icon for map.');
                        } else {
                            if (!sectorOpsMap.hasImage('plane-icon')) {
                                sectorOpsMap.addImage('plane-icon', image);
                            }
                        }
                        resolve(); // Resolve the promise once the image is loaded or fails
                    }
                );
            });
        });
    }

    /**
     * (REFACTORED) Clears only the route line layers from the map.
     */
    function clearRouteLayers() {
        sectorOpsMapRouteLayers.forEach(id => {
            if (sectorOpsMap.getLayer(id)) sectorOpsMap.removeLayer(id);
            if (sectorOpsMap.getSource(id)) sectorOpsMap.removeSource(id);
        });
        sectorOpsMapRouteLayers = [];
    }

    /**
     * (NEW) Plots all unique airports as clickable markers on the Sector Ops map.
     */
    function plotAllAirportsOnMap() {
        if (!sectorOpsMap || !sectorOpsMap.isStyleLoaded()) return;

        // Clear everything to start fresh
        clearRouteLayers();
        sectorOpsMapMarkers.forEach(marker => marker.remove());
        sectorOpsMapMarkers = [];

        // Find all unique airports from the global route list
        const uniqueAirports = new Set();
        ALL_AVAILABLE_ROUTES.forEach(route => {
            uniqueAirports.add(route.departure);
            uniqueAirports.add(route.arrival);
        });

        // Create a marker for each unique airport
        uniqueAirports.forEach(icao => {
            const airport = airportsData[icao];
            if (airport && airport.lon && airport.lat) {
                const el = document.createElement('div');
                el.className = 'destination-marker';
                el.title = `${icao}: ${airport.name || 'Unknown Airport'}`;

                const marker = new mapboxgl.Marker(el)
                    .setLngLat([airport.lon, airport.lat])
                    .addTo(sectorOpsMap);

                // Add the core functionality: click to show routes
                el.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevents map click event from firing
                    plotRoutesFromAirport(icao);
                });

                sectorOpsMapMarkers.push(marker);
            }
        });
    }

    /**
     * (NEW) Clears old routes and draws all new routes originating from a selected airport.
     */
    function plotRoutesFromAirport(departureICAO) {
        clearRouteLayers(); // Clear only the lines, not the airport markers

        const departureAirport = airportsData[departureICAO];
        if (!departureAirport) return;

        const departureCoords = [departureAirport.lon, departureAirport.lat];
        const routesFromHub = ALL_AVAILABLE_ROUTES.filter(r => r.departure === departureICAO);

        if (routesFromHub.length === 0) {
            new mapboxgl.Popup({ closeButton: false, anchor: 'bottom' })
                .setLngLat(departureCoords)
                .setHTML(`<strong>${departureICAO}</strong><br>No departures in database.`)
                .addTo(sectorOpsMap);
            return;
        }

        // Create line features for each route
        const routeLineFeatures = routesFromHub.map(route => {
            const arrivalAirport = airportsData[route.arrival];
            if (arrivalAirport) {
                return {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [departureCoords, [arrivalAirport.lon, arrivalAirport.lat]]
                    }
                };
            }
            return null;
        }).filter(Boolean); // Filter out any routes with missing arrival data

        const routeLinesId = `routes-from-${departureICAO}`;
        sectorOpsMap.addSource(routeLinesId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: routeLineFeatures }
        });

        sectorOpsMap.addLayer({
            id: routeLinesId,
            type: 'line',
            source: routeLinesId,
            paint: {
                'line-color': '#00a8ff', // A bright blue for visibility
                'line-width': 2,
                'line-opacity': 0.8
            }
        });

        sectorOpsMapRouteLayers.push(routeLinesId); // Track the new layer for cleanup

        // Fly to the selected airport
        sectorOpsMap.flyTo({
            center: departureCoords,
            zoom: 5,
            essential: true
        });
    }

    /**
     * Fetches and renders the curated rosters for the selected hub.
     */
    async function fetchAndRenderRosters(departureICAO) {
        const container = document.getElementById('roster-list-container');
        container.innerHTML = '<div class="spinner-small"></div><p>Loading recommended rosters...</p>';
        try {
            const res = await fetch(`${API_BASE_URL}/api/rosters/my-rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Could not fetch recommended rosters.');
            const data = await res.json();

            const relevantRosters = data.rosters.filter(r => r.hub === departureICAO || r.legs?.[0]?.departure === departureICAO);

            if (relevantRosters.length === 0) {
                container.innerHTML = `<p class="muted">No recommended multi-leg rosters found departing from ${departureICAO}.</p>`;
                return [];
            }

            container.innerHTML = relevantRosters.map(roster => {
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
                <div class="roster-item" data-roster-id="${roster.rosterId}">
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
                        </div>
                        <div class="flight-divider"><i class="fa-solid fa-plane"></i></div>
                        <div class="flight-segment arrival">
                            <span class="segment-label">Arrives</span>
                            <span class="segment-icao">${lastLeg.arrival}</span>
                        </div>
                    </div>
                    <div class="roster-card-footer">
                        <div class="roster-path-display">${pathString}</div>
                        <div class="roster-actions">
                            <button class="details-button" data-roster-id="${roster.rosterId}" aria-expanded="false">Details</button>
                            <button class="cta-button go-on-duty-btn" data-roster-id="${roster.rosterId}" ${dutyDisabled}>Go On Duty</button>
                        </div>
                    </div>
                    <div class="roster-leg-details" id="details-${roster.rosterId}"></div>
                </div>`;
            }).join('');
            return relevantRosters;

        } catch (error) {
            container.innerHTML = `<p class="error-text">${error.message}</p>`;
            return [];
        }
    }

    /**
     * Fetches ALL available routes from the backend.
     */
    async function fetchAndRenderRoutes() {
        const container = document.getElementById('route-list-container');
        container.innerHTML = '<div class="spinner-small"></div><p>Exploring all available routes...</p>';
        try {
            const res = await fetch(`${API_BASE_URL}/api/routes/all`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Could not fetch routes from the server.');
            const allRoutes = await res.json();

            if (allRoutes.length === 0) {
                container.innerHTML = `<p class="muted">No routes found in the database.</p>`;
                return [];
            }

            container.innerHTML = allRoutes.map(route => {
                const airlineCode = extractAirlineCode(route.flightNumber);
                const logoPath = airlineCode ? `Images/vas/${airlineCode}.png` : '';
                const requiredRank = route.rankUnlock || deduceRankFromAircraftFE(route.aircraft);

                return `
                <div class="route-card" 
                     data-departure="${route.departure}" 
                     data-arrival="${route.arrival}" 
                     data-aircraft="${route.aircraft}"
                     data-operator="${route.operator || ''}">
                    <div class="route-card-main">
                        <img src="${logoPath}" class="leg-airline-logo" alt="${airlineCode}" onerror="this.style.display='none'">
                        <div class="route-card-details">
                            <strong>${route.flightNumber}</strong>
                            <span>${route.departure} <i class="fa-solid fa-arrow-right-long"></i> ${route.arrival}</span>
                        </div>
                    </div>
                    <div class="route-card-actions">
                        ${getRankBadgeHTML(requiredRank, { showImage: true, imageClass: 'roster-req-rank-badge' })}
                        <button class="cta-button plan-flight-from-explorer-btn" data-route='${JSON.stringify(route)}'>Plan</button>
                    </div>
                </div>
                `;
            }).join('');
            return allRoutes;
        } catch (error) {
            container.innerHTML = `<p class="error-text">${error.message}</p>`;
            return [];
        }
    }

    /**
     * Sets up event listeners for the Sector Ops view.
     */
    function setupSectorOpsEventListeners() {
        const panel = document.getElementById('sector-ops-floating-panel');
        if (!panel || panel.dataset.listenersAttached === 'true') return;
        panel.dataset.listenersAttached = 'true';

        // --- START: MODIFICATION FOR COLLAPSIBLE PANEL ---
        const toggleBtn = document.getElementById('sector-ops-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const isCollapsed = panel.classList.toggle('panel-collapsed');
                toggleBtn.setAttribute('aria-expanded', !isCollapsed);

                // IMPORTANT: Resize the map after the transition to fill the space
                if (sectorOpsMap) {
                    setTimeout(() => {
                        sectorOpsMap.resize();
                    }, 400); // This duration should match the CSS transition duration
                }
            });
        }
        // --- END: MODIFICATION FOR COLLAPSIBLE PANEL ---

        // Tab switching now ONLY changes the panel content
        panel.querySelector('.panel-tabs')?.addEventListener('click', (e) => {
            const tabLink = e.target.closest('.tab-link');
            if (!tabLink) return;
            
            panel.querySelectorAll('.tab-link, .tab-content').forEach(el => el.classList.remove('active'));
            const tabId = tabLink.dataset.tab;
            tabLink.classList.add('active');
            panel.querySelector(`#${tabId}`).classList.add('active');
        });

        // Hub selector only updates the roster list. Map is independent.
        panel.querySelector('#departure-hub-selector')?.addEventListener('change', async (e) => {
            const selectedHub = e.target.value;
            await fetchAndRenderRosters(selectedHub);
        });

        // Route search/filter (for the global list)
        panel.querySelector('#route-search-input')?.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toUpperCase().trim();
            // UPDATE: Must query the whole document as the list is not a child of the input
            document.querySelectorAll('#route-list-container .route-card').forEach(card => {
                const departure = card.dataset.departure;
                const arrival = card.dataset.arrival;
                const aircraft = card.dataset.aircraft;
                const operator = card.dataset.operator.toUpperCase();
                
                const isMatch = (
                    departure.includes(searchTerm) ||
                    arrival.includes(searchTerm) ||
                    aircraft.includes(searchTerm) ||
                    operator.includes(searchTerm)
                );
                card.style.display = isMatch ? 'flex' : 'none';
            });
        });

        // "Plan Flight" button click from Route Explorer
        // NOTE: This listener is attached to the document for robustness, as content is dynamic.
        document.getElementById('routes-content').addEventListener('click', (e) => {
            const planButton = e.target.closest('.plan-flight-from-explorer-btn');
            if (planButton) {
                const routeData = JSON.parse(planButton.dataset.route);
                switchView('view-flight-plan');

                document.getElementById('fp-flightNumber').value = routeData.flightNumber;
                document.getElementById('fp-departure').value = routeData.departure;
                document.getElementById('fp-arrival').value = routeData.arrival;
                
                const aircraftSelect = document.getElementById('fp-aircraft');
                if (aircraftSelect) {
                    aircraftSelect.value = routeData.aircraft;
                }
                
                showNotification(`Pre-filled dispatch for ${routeData.flightNumber}. Please generate with SimBrief or file manually.`, 'info');
            }
        });
    }

    // ==========================================================
    // END: SECTOR OPS / ROUTE EXPLORER LOGIC
    // ==========================================================

    // ====================================================================
    // START: NEW LIVE FLIGHTS LOGIC FOR SECTOR OPS MAP
    // ====================================================================

    /**
     * Starts the polling loop for live flights specifically for the Sector Ops map.
     */
    function startSectorOpsLiveLoop() {
        stopSectorOpsLiveLoop(); // Ensure no duplicate intervals are running
        updateSectorOpsLiveFlights(); // Fetch immediately
        sectorOpsLiveFlightsInterval = setInterval(updateSectorOpsLiveFlights, 30000); // Then update every 30 seconds
    }

    /**
     * Stops the polling loop for Sector Ops live flights to save resources.
     */
    function stopSectorOpsLiveLoop() {
        if (sectorOpsLiveFlightsInterval) {
            clearInterval(sectorOpsLiveFlightsInterval);
            sectorOpsLiveFlightsInterval = null;
        }
    }

    /**
     * Fetches all live flights and plots them on the Sector Ops map using an optimized GeoJSON source.
     */
    async function updateSectorOpsLiveFlights() {
        if (!sectorOpsMap || !sectorOpsMap.isStyleLoaded()) return;

        const LIVE_FLIGHTS_BACKEND = 'https://acars-backend-uxln.onrender.com';

        try {
            // 1. Fetch the server session ID
            const sessionsRes = await fetch(`${LIVE_FLIGHTS_BACKEND}/if-sessions`);
            const sessionsData = await sessionsRes.json();
            const expertSession = sessionsData.sessions.find(s => s.name.toLowerCase().includes('expert'));

            if (!expertSession) {
                console.warn('Sector Ops Map: Expert Server session not found.');
                return;
            }

            // 2. Fetch ALL flights for the session (no callsign filter)
            const flightsRes = await fetch(`${LIVE_FLIGHTS_BACKEND}/flights/${expertSession.id}`);
            const flightsData = await flightsRes.json();

            if (!flightsData.ok || !Array.isArray(flightsData.flights)) {
                console.warn('Sector Ops Map: Could not fetch live flights.');
                return;
            }

            // 3. Convert flight data to a GeoJSON Feature Collection
            const flightFeatures = flightsData.flights.map(flight => {
                if (!flight.position || flight.position.lat == null || flight.position.lon == null) {
                    return null;
                }
                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [flight.position.lon, flight.position.lat]
                    },
                    properties: {
                        callsign: flight.callsign,
                        username: flight.username,
                        altitude: flight.position.alt_ft,
                        speed: flight.position.gs_kt,
                        heading: flight.position.track_deg || 0
                    }
                };
            }).filter(Boolean); // Remove any null entries

            const geojsonData = {
                type: 'FeatureCollection',
                features: flightFeatures
            };

            // 4. Update the map source and layer
            const sourceId = 'sector-ops-live-flights-source';
            const layerId = 'sector-ops-live-flights-layer';
            const source = sectorOpsMap.getSource(sourceId);

            if (source) {
                // If source exists, just update the data for high performance
                source.setData(geojsonData);
            } else {
                // Otherwise, create the source and the layer for the first time
                sectorOpsMap.addSource(sourceId, {
                    type: 'geojson',
                    data: geojsonData
                });

                sectorOpsMap.addLayer({
                    id: layerId,
                    type: 'symbol',
                    source: sourceId,
                    layout: {
                        'icon-image': 'plane-icon', // The name we added with map.addImage
                        'icon-size': 0.07,
                        'icon-rotate': ['get', 'heading'], // Rotate icon based on 'heading' property
                        'icon-rotation-alignment': 'map',
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true
                    }
                });

                // Add a popup on click for better UX
                sectorOpsMap.on('click', layerId, (e) => {
                    const coordinates = e.features[0].geometry.coordinates.slice();
                    const props = e.features[0].properties;

                    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                    }

                    new mapboxgl.Popup()
                        .setLngLat(coordinates)
                        .setHTML(`
                        <strong>${props.callsign}</strong><br>
                        <em>${props.username}</em><br>
                        Altitude: ${Math.round(props.altitude)} ft<br>
                        Speed: ${Math.round(props.speed)} kts
                    `)
                        .addTo(sectorOpsMap);
                });

                // Change cursor to pointer on hover
                sectorOpsMap.on('mouseenter', layerId, () => {
                    sectorOpsMap.getCanvas().style.cursor = 'pointer';
                });
                sectorOpsMap.on('mouseleave', layerId, () => {
                    sectorOpsMap.getCanvas().style.cursor = '';
                });
            }

        } catch (error) {
            console.error('Error updating Sector Ops live flights:', error);
        }
    }
    // ====================================================================
    // END: NEW LIVE FLIGHTS LOGIC FOR SECTOR OPS MAP
    // ====================================================================

    /**
     * Main view switching logic.
     */
    const switchView = (viewId) => {
        sidebarNav.querySelector('.nav-link.active')?.classList.remove('active');
        mainContentContainer.querySelector('.content-view.active')?.classList.remove('active');

        const newLink = sidebarNav.querySelector(`.nav-link[data-view="${viewId}"]`);
        const newView = document.getElementById(viewId);

        if (newLink && newView) {
            newLink.classList.add('active');
            newView.classList.add('active');
        }

        // Stop the dashboard live map loop
        if (liveFlightsInterval) {
            clearInterval(liveFlightsInterval);
            liveFlightsInterval = null;
        }
        
        // Stop the Sector Ops live map loop
        stopSectorOpsLiveLoop();

        if (sectorOpsMap) {
            // Ensure map is resized if sidebar state changes while view is inactive
            setTimeout(() => sectorOpsMap.resize(), 400); 
        }

        // Conditionally start the correct loop based on the new view
        if (viewId === 'view-duty-status') {
            initializeLiveMap();
        } else if (viewId === 'view-rosters') {
            initializeSectorOpsView();
        }
    };


    // --- New function to fetch fleet data ---
    async function fetchFleetData() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/aircrafts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error('Could not load fleet data from the server.');
            }
            DYNAMIC_FLEET = await response.json();
        } catch (error) {
            console.error('Error fetching dynamic fleet:', error);
            showNotification('Could not load the aircraft library. Some features may not work.', 'error');
            DYNAMIC_FLEET = [];
        }
    }


    // --- Main Data Fetch & Render Cycle ---
    const fetchPilotData = async () => {
        try {
            const oldRank = CURRENT_PILOT ? CURRENT_PILOT.rank : null;

            const [pilotResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetchFleetData()
            ]);

            if (!pilotResponse.ok) {
                localStorage.removeItem('authToken');
                window.location.href = 'login.html';
                throw new Error('Session invalid. Please log in again.');
            }
            const pilot = await pilotResponse.json();
            CURRENT_PILOT = pilot;
            ACTIVE_FLIGHT_PLANS = pilot.currentFlightPlans || [];

            if (typeof window.initializeGlobalDebugger === 'function') {
                window.initializeGlobalDebugger(pilot.role);
            }

            pilotNameElem.textContent = pilot.name || 'N/A';
            pilotCallsignElem.textContent = pilot.callsign || 'N/A';
            profilePictureElem.src = pilot.imageUrl || 'images/default-avatar.png';

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
        } finally {
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

        const newAircraft = DYNAMIC_FLEET.filter(ac => ac.rankUnlock === newRank);
        if (newAircraft.length > 0) {
            perksListElem.innerHTML = newAircraft.map(ac => `<li><i class="fa-solid fa-plane-circle-check"></i> <strong>${ac.name}</strong> (${ac.icao})</li>`).join('');
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
        await renderFlightPlanView(pilot);
        await fetchPirepHistory();
    };

    const getPendingTestBannerHTML = () => `
        <div class="pending-test-banner">
            <h3><i class="fa-solid fa-triangle-exclamation"></i> Promotion Pending</h3>
            <p>You have reached the flight hour requirement for the next rank! Staff has been notified to schedule your tests. Flight operations (starting new duties, filing flight plans) are suspended until your promotion is finalized.</p>
        </div>
    `;

    const createHubHeaderHTML = (pilot, statusText) => `
        <div class="hub-header redesigned">
            <div class="hub-main-info">
                <div class="hub-rank-display">
                    ${getRankBadgeHTML(pilot.rank, { showImage: true, showName: true, containerClass: 'rank-badge hub-rank-badge' })}
                </div>
                <div class="hub-hours-display">
                    <span class="hours-label">Flight Hours</span>
                    <span class="hours-value">${(pilot.flightHours || 0).toFixed(1)}</span>
                </div>
            </div>
            <div class="hub-status-bar">
                ${statusText}
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
            dutyStatusHTML = await renderOnRestContent(pilot);
        }

        dutyStatusView.innerHTML = `${pendingBanner}${dutyStatusHTML}${leaderboardsHTML}`;

        const dashboardContainer = document.querySelector('.dashboard-container');
        if (dashboardContainer && pilot.rank) {
            const rankSlug = 'rank-' + pilot.rank.toLowerCase().replace(/\s+/g, '-');

            const classList = Array.from(dashboardContainer.classList);
            for (const c of classList) {
                if (c.startsWith('rank-')) {
                    dashboardContainer.classList.remove(c);
                }
            }

            dashboardContainer.classList.add(rankSlug);
        }

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

    const renderOnRestContent = async (pilot) => {
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
            try {
                const rosterResponse = await fetch(`${API_BASE_URL}/api/rosters/my-rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (!rosterResponse.ok) throw new Error('Could not fetch recommended roster.');

                const rosterData = await rosterResponse.json();
                const topRoster = rosterData.rosters?.[0];
                const locationICAO = rosterData.searchCriteria?.searched?.[0];

                const weather = await window.WeatherService.fetchAndParseMetar(locationICAO);

                let locationCardHTML = '';
                if (locationICAO) {
                    locationCardHTML = `
                        <div class="location-card" style="flex: 1; min-width: 280px; background-color: rgba(13, 16, 28, 0.5); padding: 1.5rem; border-radius: 8px;">
                            <h4 style="margin-top:0; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-location-dot"></i> Current Location</h4>
                            <strong style="font-size: 1.8rem; font-family: monospace;">${locationICAO}</strong>
                            <div class="weather-details" style="margin-top: 1rem; font-size: 0.9rem;">
                                <p><strong>Wind:</strong> ${weather.wind}</p>
                                <p><strong>Temp:</strong> ${weather.temp}</p>
                                <p><strong>Cond:</strong> ${weather.condition}</p>
                                <p style="font-family: monospace; opacity: 0.7; margin-top: 0.5rem;">${weather.raw}</p>
                            </div>
                        </div>
                    `;
                }

                let rosterCardHTML = '';
                if (topRoster) {
                    const firstLeg = topRoster.legs[0];
                    const lastLeg = topRoster.legs[topRoster.legs.length - 1];
                    const fullRoute = `${firstLeg.departure} → ${lastLeg.arrival}`;

                    rosterCardHTML = `
                        <div class="next-step-card" style="flex: 1.5; min-width: 300px; background-color: rgba(0, 27, 148, 0.1); padding: 1.5rem; border-radius: 8px; border-left: 3px solid var(--rank-accent-color, var(--accent-color));">
                            <h4 style="margin-top: 0;">Ready for Your Next Assignment?</h4>
                            <p>Based on your location, we recommend this roster:</p>
                            <div class="featured-roster-summary" style="background-color: rgba(13, 16, 28, 0.5); padding: 1rem; border-radius: 5px; margin: 1rem 0; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong style="display: block; font-size: 1.2rem;">${topRoster.name}</strong>
                                    <span style="color: var(--dashboard-text-muted);">${fullRoute}</span>
                                </div>
                                <span style="font-size: 1.1rem; font-weight: bold;">${(topRoster.totalFlightTime || 0).toFixed(1)} hrs</span>
                            </div>
                            <button class="cta-button" id="go-to-roster-btn">View Roster</button>
                        </div>
                    `;
                } else {
                    rosterCardHTML = `<p>You are eligible for your next assignment. To begin, please select a roster from the Sector Ops page.</p>`;
                }

                content = `
                    <div class="hub-action-grid" style="display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 1.5rem;">
                        ${locationCardHTML}
                        ${rosterCardHTML}
                    </div>
                `;

            } catch (error) {
                console.error("Failed to fetch hub details:", error);
                content = `<p>You are eligible for your next assignment. To begin, please select a roster from the Sector Ops page.</p>`;
            }
        }

        const liveMapHTML = `
            <div class="content-card live-map-section" style="margin-top: 1.5rem;">
                <h2><i class="fa-solid fa-tower-broadcast"></i> Live Operations Map</h2>
                <div id="live-flights-map-container" style="height: 450px; border-radius: 8px; margin-top: 1rem; background-color: #191a1a;">
                    <p class="map-loader" style="text-align: center; padding-top: 2rem; color: #ccc;">Loading Live Map...</p>
                </div>
            </div>
        `;

        return `
            <div class="pilot-hub-card">
                ${createHubHeaderHTML(pilot, title)}
                ${content}
            </div>
            ${liveMapHTML}`;
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

            const filedPirepsForRoster = allPireps.filter(p => p.rosterLeg?.rosterId === currentRoster.rosterId);
            const filedFlightNumbers = new Set(filedPirepsForRoster.map(p => p.flightNumber));

            const headerTitle = '<i class="fa-solid fa-plane-departure"></i> Current Status: 🟢 On Duty';

            const liveMapHTML = `
                <div class="content-card live-map-section" style="margin-top: 1.5rem;">
                    <h2><i class="fa-solid fa-tower-broadcast"></i> Live Operations Map</h2>
                    <div id="live-flights-map-container" style="height: 450px; border-radius: 8px; margin-top: 1rem; background-color: #191a1a;">
                        <p class="map-loader" style="text-align: center; padding-top: 2rem; color: #ccc;">Loading Live Map...</p>
                    </div>
                </div>
            `;

            return `
                <div class="pilot-hub-card">
                    ${createHubHeaderHTML(pilot, headerTitle)}
                    <div class="on-duty-header">
                        <div>
                            <p style="margin: 0;"><strong>Active Roster:</strong> ${currentRoster.name}</p>
                            <p class="muted" style="margin: 0;">Complete your assigned flights via the <strong>Dispatch</strong> page.</p>
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
                                    ${getRankBadgeHTML(reqRank, { showImage: true, showName: false, imageClass: 'roster-req-rank-badge' })}
                                </span>
                              </div>`;
            }).join('')}
                    </div>
                </div>
                ${liveMapHTML}`;
        } catch (error) {
            return `<div class="content-card"><p class="error-text">${error.message}</p></div>`;
        }
    };


    // --- Flight Plan View ---
    const renderFlightPlanView = async (pilot) => {
        const viewContainer = document.getElementById('view-flight-plan');
        const manualDispatchContainer = document.getElementById('manual-dispatch-container');
        const simbriefDisplay = document.getElementById('dispatch-pass-display');

        simbriefDisplay.style.display = 'none';

        if (pilot.promotionStatus === 'PENDING_TEST') {
            viewContainer.innerHTML = `<div class="content-card">${getPendingTestBannerHTML()}</div>`;
            return;
        }

        renderActiveFlights();
        updateDispatchFormState();

        const aircraftSelect = document.getElementById('fp-aircraft');
        if (aircraftSelect) {
            aircraftSelect.innerHTML = `
                <option value="" disabled selected>-- Select Aircraft --</option>
                ${AIRCRAFT_SELECTION_LIST.map(ac => `<option value="${ac.value}">${ac.name} (${ac.value})</option>`).join('')}
            `;
        }
    };

    const renderActiveFlights = () => {
        const listContainer = document.getElementById('active-flights-list');
        const header = document.getElementById('active-flights-header');

        header.innerHTML = `<i class="fa-solid fa-plane-up"></i> Active Flights (${ACTIVE_FLIGHT_PLANS.length})`;

        if (ACTIVE_FLIGHT_PLANS.length === 0) {
            listContainer.innerHTML = '<p class="muted">You have no active flights.</p>';
            return;
        }

        listContainer.innerHTML = ACTIVE_FLIGHT_PLANS.map(plan => {
            const aircraft = DYNAMIC_FLEET.find(a => a.icao === plan.aircraft) || { name: plan.aircraft };
            return `
            <div class="active-flight-item" data-plan-id="${plan._id}">
                <div class="active-flight-summary">
                    <div class="flight-summary-info">
                        <strong>${plan.flightNumber}</strong>
                        <span>${plan.departure} → ${plan.arrival}</span>
                        <span>${aircraft.name}</span>
                    </div>
                    <div class="flight-summary-toggle">
                        <i class="fas fa-chevron-down"></i>
                    </div>
                </div>
                <div class="active-flight-details">
                    <div class="dispatch-pass-container"></div>
                </div>
            </div>`;
        }).join('');
    };

    const updateDispatchFormState = () => {
        const formContainer = document.getElementById('manual-dispatch-container');
        const formLockout = document.getElementById('dispatch-form-lockout');
        const form = document.getElementById('file-flight-plan-form');

        if (ACTIVE_FLIGHT_PLANS.length >= 2) {
            formLockout.style.display = 'flex';
            form.style.opacity = '0.3';
            form.style.pointerEvents = 'none';
        } else {
            formLockout.style.display = 'none';
            form.style.opacity = '1';
            form.style.pointerEvents = 'auto';
        }
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
                           ${getRankBadgeHTML(reqRank, { showImage: true, showName: false, imageClass: 'roster-req-rank-badge' })}
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
        }
    });

    // --- Global Event Listeners for Actions ---
    mainContentContainer.addEventListener('submit', async (e) => {
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
                route: document.getElementById('fp-route').value,
                etd: document.getElementById('fp-etd').value ? new Date(document.getElementById('fp-etd').value).toISOString() : null,
                eet: parseFloat(document.getElementById('fp-eet').value) || null,
                pob: parseInt(document.getElementById('fp-pob').value, 10) || null,
            };

            if (!body.flightNumber || !body.aircraft || !body.departure || !body.arrival) {
                showNotification('Please fill in all required Core Details.', 'error');
                btn.disabled = false;
                btn.textContent = 'File Manually';
                return;
            }

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
            } catch (err) {
                showNotification(`Error: ${err.message}`, 'error');
                btn.disabled = false;
                btn.textContent = 'File Manually';
            }
        }
    });

    mainContentContainer.addEventListener('click', async (e) => {
        const target = e.target;

        if (target.id === 'go-to-roster-btn') {
            switchView('view-rosters');
        }

        const summary = target.closest('.active-flight-summary');
        if (summary) {
            const item = summary.closest('.active-flight-item');
            if (!item) return;

            item.classList.toggle('expanded');
            const isNowExpanded = item.classList.contains('expanded');

            if (isNowExpanded) {
                const details = item.querySelector('.active-flight-details');
                const passContainer = details.querySelector('.dispatch-pass-container');

                if (!passContainer.hasChildNodes()) {
                    const planId = item.dataset.planId;
                    const plan = ACTIVE_FLIGHT_PLANS.find(p => p._id === planId);
                    if (plan) {
                        populateDispatchPass(passContainer, plan);
                    } else {
                        passContainer.innerHTML = '<p style="padding: 2rem; text-align: center; color: var(--error-color);">Error: Flight plan data not found.</p>';
                    }
                }
            }
        }

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

            if (isVisible && !detailsContainer.innerHTML.trim()) {
                detailsContainer.innerHTML = '<p>Loading details...</p>';
                try {
                    const res = await fetch(`${API_BASE_URL}/api/rosters/my-rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (!res.ok) throw new Error('Could not fetch roster details.');
                    const rosterData = await res.json();
                    const allRosters = rosterData.rosters || [];
                    const roster = allRosters.find(r => r.rosterId === rosterId);

                    if (roster && roster.legs) {
                        const isMultiAircraft = roster.legs.some((leg, i, arr) => i > 0 && leg.aircraft !== arr[0].aircraft);

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

                            const legAircraftIcao = leg.aircraft;
                            const legOperator = leg.operator;

                            const aircraftData = DYNAMIC_FLEET.find(ac => ac.icao === legAircraftIcao && ac.codeshare === legOperator);
                            const aircraftImageUrl = aircraftData?.imageUrl ||
                                `Images/planesForCC/${legAircraftIcao}.png`;

                            const legAircraftImageHTML = `
                                <div class="leg-aircraft-image-container">
                                    <img src="${aircraftImageUrl}" 
                                         alt="${legOperator} ${legAircraftIcao}" 
                                         class="leg-aircraft-image"
                                         onerror="this.onerror=null; this.src='images/default-aircraft.png'; this.alt='Image not available';">
                                </div>`;

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
                                                <div class="leg-badges-footer">
                                                    ${getRankBadgeHTML(leg.rankUnlock || deduceRankFromAircraftFE(leg.aircraft), { showImage: true, showName: false, imageClass: 'roster-req-rank-badge' })}
                                                </div>
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
            target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Departing...';
            try {
                const departRes = await fetch(`${API_BASE_URL}/api/flightplans/${planId}/depart`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const departResult = await departRes.json();
                if (!departRes.ok) throw new Error(departResult.message || 'Failed to mark flight as departed.');
                showNotification(departResult.message, 'info');

                const acarsRes = await fetch(`${API_BASE_URL}/api/acars/track/start/${planId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ server: TARGET_SERVER_NAME })
                });
                const acarsResult = await acarsRes.json();
                if (!acarsRes.ok) throw new Error(acarsResult.message || 'Could not start ACARS tracking.');

                showNotification('ACARS tracking initiated successfully.', 'success');

                await fetchPilotData();

            } catch (err) {
                showNotification(err.message, 'error');
                target.disabled = false;
                target.innerHTML = '<i class="fa-solid fa-plane-departure"></i> Depart';
            }
        }

        if (target.id === 'cancel-btn') {
            target.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/flightplans/${planId}/cancel`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
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

            const redirectUrl = window.location.origin + window.location.pathname + '?view=view-flight-plan';
            simbriefsubmit(redirectUrl);
        }

        if (target.id === 'dispatch-close-btn') {
            document.getElementById('dispatch-pass-display').style.display = 'none';
            document.getElementById('manual-dispatch-container').style.display = 'block';
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
                    departureWeather: ofpData.weather.orig_metar,
                    arrivalWeather: ofpData.weather.dest_metar,
                    tlr: ofpData.tlr,
                    cruiseAltitude: ofpData.general.initial_altitude,
                    cruiseSpeed: ofpData.general.cruise_mach,
                    mapData: {
                        origin: ofpData.origin,
                        destination: ofpData.destination,
                        navlog: ofpData.navlog?.fix || []
                    }
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
                document.getElementById('dispatch-pass-display').style.display = 'none';
                document.getElementById('manual-dispatch-container').style.display = 'block';
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
                    fetchPilotData();
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
                if (!response.ok) throw new Error('Could not retrieve flight plan from SimBrief.');
                const data = await response.json();

                CURRENT_OFP_DATA = data.OFP;
                const ofpData = CURRENT_OFP_DATA;

                const cargoWeight = ofpData.weights.payload - (ofpData.general.passengers * ofpData.weights.pax_weight);
                const previewPlan = {
                    _id: 'simbrief-preview',
                    flightNumber: ofpData.general.flight_number,
                    departure: ofpData.origin.icao_code,
                    arrival: ofpData.destination.icao_code,
                    etd: new Date(ofpData.times.sched_out * 1000),
                    eta: new Date(ofpData.times.sched_in * 1000),
                    eet: ofpData.times.est_time_enroute / 3600,
                    aircraft: ofpData.aircraft.icaocode,
                    route: ofpData.general.route,
                    alternate: ofpData.alternate.icao_code,
                    zfw: ofpData.weights.est_zfw,
                    tow: ofpData.weights.est_tow,
                    pob: ofpData.general.passengers,
                    cargo: cargoWeight,
                    fuelTaxi: ofpData.fuel.taxi,
                    fuelTrip: ofpData.fuel.enroute_burn,
                    fuelTotal: ofpData.fuel.plan_ramp,
                    squawkCode: ofpData.atc.squawk,
                    tlr: ofpData.tlr,
                    departureWeather: ofpData.weather.orig_metar,
                    arrivalWeather: ofpData.weather.dest_metar,
                    cruiseAltitude: ofpData.general.initial_altitude,
                    cruiseSpeed: ofpData.general.cruise_mach,
                    mapData: {
                        origin: ofpData.origin,
                        destination: ofpData.destination,
                        navlog: ofpData.navlog?.fix || []
                    }
                };

                const dispatchDisplay = document.getElementById('dispatch-pass-display');
                const manualDispatchContainer = document.getElementById('manual-dispatch-container');

                if (!dispatchDisplay || !manualDispatchContainer) {
                    throw new Error('Dispatch or form container not found in the DOM.');
                }

                populateDispatchPass(dispatchDisplay, previewPlan, { isPreview: true });

                manualDispatchContainer.style.display = 'none';
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
    async function initializeApp() {
        mainContentLoader.classList.add('active');

        // Fetch essential data in parallel
        await Promise.all([
            fetchMapboxToken(),
            fetchAirportsData()
        ]);

        await fetchPilotData();

        // Initial view setup
        const urlParams = new URLSearchParams(window.location.search);
        const initialView = urlParams.get('view') || 'view-duty-status';
        switchView(initialView);

        // Sidebar state
        if (localStorage.getItem('sidebarState') === 'collapsed') {
            dashboardContainer.classList.add('sidebar-collapsed');
        }
        sidebarToggleBtn.addEventListener('click', () => {
            dashboardContainer.classList.toggle('sidebar-collapsed');
            localStorage.setItem('sidebarState', dashboardContainer.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded');
            
            // Trigger map resize after sidebar transition
            if (sectorOpsMap) {
                setTimeout(() => sectorOpsMap.resize(), 400); 
            }
        });

        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            showNotification('You have been logged out.', 'success');
            setTimeout(() => { window.location.href = 'login.html'; }, 1000);
        });
    }

    // Start the application
    initializeApp();
});