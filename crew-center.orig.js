// Crew Center – Merged Script with Pilot Stats Card & Upgraded PFD
document.addEventListener('DOMContentLoaded', async () => {
    // --- Global Configuration ---
    const API_BASE_URL = 'https://indgo-backend.onrender.com';
    const LIVE_FLIGHTS_API_URL = 'https://acars-backend-uxln.onrender.com/flights';
    const ACARS_USER_API_URL = 'https://acars-backend-uxln.onrender.com/users'; // NEW: For user stats
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
    let runwaysData = {}; // NEW: To store runway data indexed by airport ICAO

    // --- Map-related State ---
    let liveFlightsMap = null;
    let pilotMarkers = {};
    let liveFlightsInterval = null;
    let sectorOpsMap = null;
    let airportAndAtcMarkers = {}; // Holds all airport markers (blue dots and red ATC dots)
    let sectorOpsMapRouteLayers = [];
    let sectorOpsLiveFlightPathLayers = {}; // NEW: To track multiple flight trails
    let sectorOpsLiveFlightsInterval = null;
    let activeAtcFacilities = []; // To store fetched ATC data
    let activeNotams = []; // To store fetched NOTAMs data
    let atcPopup = null; // To manage a single, shared popup instance
    // State for the airport info window
    let airportInfoWindow = null;
    let airportInfoWindowRecallBtn = null;
    let currentAirportInWindow = null;
    // NEW: State for the aircraft info window
    let aircraftInfoWindow = null;
    let aircraftInfoWindowRecallBtn = null;
    let currentFlightInWindow = null; // Stores the flightId of the last selected aircraft
    let activePfdUpdateInterval = null; // Interval for updating the PFD display
    // --- FIX: Added roll_deg to state to prevent flickering ---
    let lastPfdState = { track_deg: 0, timestamp: 0, roll_deg: 0 };
    // --- NEW: To cache flight data when switching to stats view ---
    let cachedFlightDataForStatsView = { flightProps: null, plan: null };


    // --- Helper: Fetch Mapbox Token from Netlify Function ---
    async function fetchMapboxToken() {
        try {/* Lines 114-120 omitted */} catch (error) {/* Lines 121-123 omitted */}
    }

    
    // --- [REHAULED] Helper to inject custom CSS for new features ---
function injectCustomStyles() {
    const styleId = 'sector-ops-custom-styles';
    if (document.getElementById(styleId)) /* Line 130 omitted */
    /* Lines 131-894 omitted */
}

    // --- NEW: Fetch Airport Coordinate Data ---
    async function fetchAirportsData() {/* Lines 898-907 omitted */}

    // --- NEW: Fetch Runway Data ---
async function fetchRunwaysData() {/* Lines 911-931 omitted */}


    // --- Fetch Routes from Backend ---
    async function fetchRoutes(params = {}) {/* Lines 936-950 omitted */}

    // --- Helper Functions ---

function getAircraftCategory(aircraftName) {/* Lines 955-990 omitted */}

    /**
     * Calculates the distance between two coordinates in kilometers using the Haversine formula.
     */
    function getDistanceKm(lat1, lon1, lat2, lon2) {/* Lines 996-1005 omitted */}

/**
 * Calculates an intermediate point along a great-circle path.
 * @param {number} lat1 - Latitude of the starting point in degrees.
 * @param {number} lon1 - Longitude of the starting point in degrees.
 * @param {number} lat2 - Latitude of the ending point in degrees.
 * @param {number} lon2 - Longitude of the ending point in degrees.
 * @param {number} fraction - The fraction of the distance along the path (0.0 to 1.0).
 * @returns {{lat: number, lon: number}} The intermediate point's coordinates.
 */
function getIntermediatePoint(lat1, lon1, lat2, lon2, fraction) {/* Lines 1017-1038 omitted */}

/**
 * Densifies a route by adding intermediate points between each coordinate pair.
 * @param {Array<[number, number]>} coordinates - The original array of [lon, lat] points.
 * @param {number} numPoints - The number of intermediate points to add between each original point.
 * @returns {Array<[number, number]>} The new, densified array of [lon, lat] points.
 */
function densifyRoute(coordinates, numPoints = 20) {/* Lines 1047-1071 omitted */}


    /**
 * --- NEW HELPER FUNCTION ---
 * Finds the closest runway end to a given aircraft position and track.
 * @param {object} aircraftPos - { lat, lon, track_deg }
 * @param {string} airportIcao - The ICAO of the airport to check.
 * @param {number} maxDistanceNM - The maximum search radius in nautical miles.
 * @returns {object|null} - The runway end details (including distance and heading difference) or null if none are close enough.
 */
function getNearestRunway(aircraftPos, airportIcao, maxDistanceNM = 2.0) {/* Lines 1083-1125 omitted */}
    
    function getRankBadgeHTML(rankName, options = {}) {/* Lines 1128-1162 omitted */}

    function formatTime(ms) {/* Lines 1165-1172 omitted */}

    function formatDuration(seconds) {/* Lines 1175-1179 omitted */}

    function formatTimeFromTimestamp(timestamp) {/* Lines 1182-1188 omitted */}

    function formatWeight(kg) {/* Lines 1191-1193 omitted */}

    function extractAirlineCode(flightNumber) {/* Lines 1196-1203 omitted */}

    /**
     * Determines the CSS class for manufacturer color-coding based on aircraft name.
     */
    function getAircraftManufacturerClass(aircraftName) {/* Lines 1209-1220 omitted */}

    const populateDispatchPass = (container, plan, options = {}) => {/* Lines 1223-1444 omitted */};

    function atcTypeToString(typeId) {/* Lines 1447-1453 omitted */}

    function formatAtcDuration(startTime) {/* Lines 1456-1463 omitted */}

    // --- [NEW] PFD Constants and Functions ---
    const PFD_PITCH_SCALE = 8;
    const PFD_SPEED_SCALE = 7;
    const PFD_SPEED_CENTER_Y = 238;
    const PFD_SPEED_REF_VALUE = 120;
    const PFD_ALTITUDE_SCALE = 0.7;
    const PFD_ALTITUDE_CENTER_Y = 234;
    const PFD_ALTITUDE_REF_VALUE = 0;
    const PFD_REEL_SPACING = 30;
    const PFD_HEADING_SCALE = 5;
    const PFD_HEADING_CENTER_X = 406;
    const PFD_HEADING_REF_VALUE = 0;

    /**
     * Initializes the SVG PFD by generating its static elements like tapes and ladders.
     * This function should only be called ONCE when the PFD container is first created.
     */
    function createPfdDisplay() {/* Lines 1483-1623 omitted */}
    
/**
 * Stable PFD update:
 * - Sample-and-hold last turn-rate between API packets (no snap-back).
 * - Linear regression w/ fallback dH/dt, heading unwrap, and EMA smoothing.
 * - Sign stickiness (won’t flip L/R for brief jitters).
 * - Hysteresis + stale logic so roll only decays when data is truly old.
 */
function updatePfdDisplay(pfdData) {
  /* Lines 1633-1820 omitted */
  {/* Lines 1821-1825 omitted */}
  /* Lines 1826-1870 omitted */
}

    /**
     * --- [NEW] Resets the PFD state and visuals to neutral. ---
     * Call this when selecting a new aircraft to prevent displaying stale data.
     */
    function resetPfdState() {/* Lines 1877-1904 omitted */}


/**
 * --- [REVAMPED] Creates the rich HTML content for the airport information window.
 * This now includes a live weather widget and a tabbed interface.
 */
    async function createAirportInfoWindowHTML(icao) {/* Lines 1912-2033 omitted */}

    // --- Rank & Fleet Models ---
    const PILOT_RANKS = [
        'IndGo Cadet', 'Skyline Observer', 'Route Explorer', 'Skyline Officer',
        'Command Captain', 'Elite Captain', 'Blue Eagle', 'Line Instructor',
        'Chief Flight Instructor', 'IndGo SkyMaster', 'Blue Legacy Commander'
    ];
    const rankIndex = (r) => PILOT_RANKS.indexOf(String(r || '').trim());

    const deduceRankFromAircraftFE = (acStr) => {/* Lines 2044-2054 omitted */};

    const userCanFlyAircraft = (userRank, aircraftIcao) => {/* Lines 2057-2062 omitted */};

    const getAllowedFleet = (userRank) => {/* Lines 2065-2070 omitted */};

    // --- Notifications ---
    function showNotification(message, type) {/* Lines 2074-2083 omitted */}

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
    if (!token) {/* Lines 2105-2107 omitted */}

    // --- Mapbox Plotting Functions ---

    /**
     * Plots a static route map for a dispatch pass using Mapbox GL JS.
     */
    const plotDispatchMap = (mapContainerId, origin, dest, navlogFixes) => {/* Lines 2115-2159 omitted */};

    /**
     * Initializes the live operations map.
     */
    function initializeLiveMap() {/* Lines 2165-2178 omitted */}

    /**
     * Starts or restarts the live flight update interval.
     */
    function startLiveLoop() {/* Lines 2184-2188 omitted */}

    /**
     * Helper to remove dynamic flight path layers from the map.
     */
    function removeFlightPathLayers(map) {/* Lines 2194-2198 omitted */}

    /**
     * Fetches live flight data and updates the map.
     */
    async function updateLiveFlights() {/* Lines 2204-2295 omitted */}


    // ==========================================================
    // START: SECTOR OPS / ROUTE EXPLORER LOGIC (INTERACTIVE AIRPORT MAP)
    // ==========================================================
    
    // NEW: Function to set up event listeners for the Airport Info Window
    function setupAirportWindowEvents() {/* Lines 2304-2336 omitted */}
    
    // --- [MODIFIED] Event listener setup using Event Delegation ---
    function setupAircraftWindowEvents() {/* Lines 2340-2401 omitted */}


    /**
     * Main orchestrator for the Sector Ops view.
     * Manages fetching data and orchestrating map and list updates.
     */
    async function initializeSectorOpsView() {/* Lines 2409-2506 omitted */}

    // --- MODIFY THIS FUNCTION ---
async function initializeSectorOpsMap(centerICAO) {/* Lines 2510-2566 omitted */}

    /**
     * (REFACTORED) Clears only the route line layers from the map.
     */
    function clearRouteLayers() {/* Lines 2572-2577 omitted */}

    // NEW: Helper to clear the live flight trail from the map
    function clearLiveFlightPath(flightId) {/* Lines 2581-2589 omitted */}


    /**
     * --- [MODIFIED] Centralized handler for clicking any airport marker.
     * This now opens the persistent info window instead of a popup.
     */
    async function handleAirportClick(icao) {/* Lines 2597-2640 omitted */}
    
    /**
     * --- [FIXED HELPER] ---
     * Recursively flattens the nested flightPlanItems from the SimBrief API plan
     * into a single, clean array of [longitude, latitude] coordinates.
     * This version correctly handles nested procedures like SIDs and STARs.
     * @param {Array} items - The flightPlanItems array from the API response.
     * @returns {Array<[number, number]>} A flat array of coordinates.
     */
    function flattenWaypointsFromPlan(items) {/* Lines 2651-2670 omitted */}

    /**
 * --- [REMODEL V4 - FULL SYNC WITH PATH DENSIFICATION] Handles aircraft clicks, data fetching, map plotting, and window population.
 */
async function handleAircraftClick(flightProps, sessionId) {/* Lines 2676-2832 omitted */}

    /**
     * --- [REDESIGNED & UPDATED] Generates the "Unified Flight Display" with image overlay and aircraft type.
     */
    function populateAircraftInfoWindow(baseProps, plan) {/* Lines 2838-3047 omitted */}

    // --- [NEW - CORRECTED] Renders the creative Pilot Stats view inside the info window ---
/**
 * --- [REHAULED v2.1] Renders the Pilot Report with collapsible sections and a case-sensitive profile link.
 */
function renderPilotStatsHTML(stats, username) {/* Lines 3054-3157 omitted */}

// --- [NEW & FIXED] Fetches and displays the pilot stats, and attaches its own event listeners ---
    async function displayPilotStats(userId, username) {/* Lines 3161-3229 omitted */}

/**
 * --- [MAJOR REVISION V4.3 - Refactored State Machine] Updates the non-PFD parts of the Aircraft Info Window.
 * This version uses a fully refactored state machine for more robust and reliable phase detection.
*/
function updateAircraftInfoWindow(baseProps, plan) {/* Lines 3236-3469 omitted */}

    /**
     * (NEW) Clears old routes and draws all new routes originating from a selected airport.
     */
    function plotRoutesFromAirport(departureICAO) {/* Lines 3475-3527 omitted */}

    /**
     * Fetches and renders the curated rosters for the selected hub.
     */
    async function fetchAndRenderRosters(departureICAO) {/* Lines 3533-3596 omitted */}

    /**
     * Fetches ALL available routes from the backend.
     */
    async function fetchAndRenderRoutes() {/* Lines 3602-3648 omitted */}

    /**
     * MODIFIED: Sets up event listeners for the Sector Ops view, including the new toolbar.
     */
    function setupSectorOpsEventListeners() {/* Lines 3654-3724 omitted */}

    // ==========================================================
    // END: SECTOR OPS / ROUTE EXPLORER LOGIC
    // ==========================================================

    // ====================================================================
    // START: NEW LIVE FLIGHTS & ATC/NOTAM LOGIC FOR SECTOR OPS MAP
    // ====================================================================

    /**
     * Starts the polling loop for live flights specifically for the Sector Ops map.
     */
    function startSectorOpsLiveLoop() {/* Lines 3738-3741 omitted */}

    /**
     * Stops the polling loop for Sector Ops live flights to save resources.
     */
    function stopSectorOpsLiveLoop() {/* Lines 3747-3751 omitted */}

    /**
     * NEW / REFACTORED: Renders all airport markers based on current route and ATC data.
     * This single, efficient function replaces the previous separate functions.
     */
    function renderAirportMarkers() {/* Lines 3758-3816 omitted */}

    // --- MODIFY THIS FUNCTION ---
async function updateSectorOpsLiveFlights() {/* Lines 3820-3924 omitted */}
    // ====================================================================
    // END: NEW LIVE FLIGHTS & ATC/NOTAM LOGIC FOR SECTOR OPS MAP
    // ====================================================================

    /**
     * Main view switching logic.
     */
    const switchView = (viewId) => {/* Lines 3933-3986 omitted */};


    // --- New function to fetch fleet data ---
    async function fetchFleetData() {/* Lines 3991-4004 omitted */}


    // --- Main Data Fetch & Render Cycle ---
    const fetchPilotData = async () => {/* Lines 4009-4058 omitted */};

    const showPromotionModal = (newRank) => {/* Lines 4061-4083 omitted */};

    // --- View Rendering Logic ---
    const renderAllViews = async (pilot) => {/* Lines 4087-4092 omitted */};

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

    const renderPilotHubView = async (pilot, leaderboardsHTML) => {/* Lines 4119-4164 omitted */};

    const renderOnRestContent = async (pilot) => {/* Lines 4167-4258 omitted */};

    const renderOnDutyContent = async (pilot) => {/* Lines 4261-4324 omitted */};


    // --- Flight Plan View ---
    const renderFlightPlanView = async (pilot) => {/* Lines 4329-4350 omitted */};

    const renderActiveFlights = () => {/* Lines 4353-4382 omitted */};

    const updateDispatchFormState = () => {/* Lines 4385-4398 omitted */};

    // --- Other Data Display Functions ---
    const renderLeaderboardList = (title, data, valueKey) => {/* Lines 4402-4428 omitted */};

    const fetchAndDisplayLeaderboards = async () => {/* Lines 4431-4459 omitted */};

    const fetchPirepHistory = async () => {/* Lines 4462-4494 omitted */};

    // --- Navigation ---
    sidebarNav.addEventListener('click', (e) => {/* Lines 4498-4506 omitted */});

    // --- Global Event Listeners for Actions ---
    mainContentContainer.addEventListener('submit', async (e) => {/* Lines 4510-4551 omitted */});

    mainContentContainer.addEventListener('click', async (e) => {/* Lines 4554-4903 omitted */});

    // --- Modal Handlers ---
    document.getElementById('arrive-flight-form').addEventListener('submit', async (e) => {/* Lines 4907-4942 omitted */});

    document.body.addEventListener('click', e => {/* Lines 4945-4948 omitted */});

    // Notifications Modal Logic
    notificationsBell.addEventListener('click', async (e) => {/* Lines 4952-4999 omitted */});

    // --- SimBrief Return Handler ---
    const handleSimbriefReturn = async () => {/* Lines 5003-5068 omitted */};

    // --- Initial Load ---
    // --- Initial Load ---
async function initializeApp() {/* Lines 5073-5149 omitted */}

    // Start the application
    initializeApp();
});
