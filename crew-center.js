// Crew Center – Merged Script with Pilot Stats Card & Upgraded PFD
document.addEventListener('DOMContentLoaded', async () => {
    // --- Global Configuration ---
    const API_BASE_URL = 'https://site--indgo-backend--6dmjph8ltlhv.code.run';
    const LIVE_FLIGHTS_API_URL = 'https://site--acars-backend--6dmjph8ltlhv.code.run/flights';
    const ACARS_USER_API_URL = 'https://site--acars-backend--6dmjph8ltlhv.code.run/users'; // NEW: For user stats
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
    let currentMapFeatures = {}; // Key: flightId, Value: GeoJSON Feature
    const DATA_REFRESH_INTERVAL_MS = 50000; // Your current refresh interval
    const ACARS_SOCKET_URL = 'https://site--acars-backend--6dmjph8ltlhv.code.run'; // <-- NEW: For WebSocket
    let isAircraftWindowLoading = false;

    // --- Map-related State ---
    let liveFlightsMap = null;
    let pilotMarkers = {};
    let liveFlightsInterval = null;
    let sectorOpsMap = null;
    let sectorOpsAnimationInterval = null; // Add this new variable
    let airportAndAtcMarkers = {}; // Holds all airport markers (blue dots and red ATC dots)
    let sectorOpsMapRouteLayers = [];
    let sectorOpsLiveFlightPathLayers = {}; // NEW: To track multiple flight trails
    let sectorOpsAtcNotamInterval = null; // <-- MODIFIED: Renamed from sectorOpsLiveFlightsInterval
    let sectorOpsSocket = null; // <-- NEW: Socket.IO client instance
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

    

// --- [REHAULED] Helper to inject custom CSS for new features ---
function injectCustomStyles() {
    const styleId = 'sector-ops-custom-styles';
    if (document.getElementById(styleId)) return;

    const css = `
        /* --- [FIX] Sector Ops View Layout --- */
        #view-rosters.active {
            position: absolute;
            inset: 0; /* Sets top, right, bottom, left to 0 */
            width: 100%;
            height: 100%;
            padding: 0;
            overflow: hidden;

            /* Use Grid to layer the map and floating panel */
            display: grid;
            grid-template-columns: 1fr;
            grid-template-rows: 1fr;
        }

        /* This places the map into the grid, filling the entire space */
        #sector-ops-map-fullscreen {
            grid-column: 1 / -1;
            grid-row: 1 / -1;
        }

        /* * --- [ - MOVED!] ---
         * This rule is now GLOBAL (for desktop + mobile).
         * It makes the main content area fill the entire viewport 
         * ONLY when the Sector Ops map is active.
        */
        .main-content:has(#view-rosters.active) {
            padding: 0; /* Remove ALL padding (top, right, bottom, left) */
            height: 100dvh; /* Set height to 100% of the viewport height */
            overflow: hidden; /* Prevent the main container from scrolling */
        }
        
        /* --- [OVERHAUL] Base Info Window Styles (Refined Glassmorphism) --- */
        .info-window {
            position: absolute;
            top: 20px;
            right: 20px;
            /* --- REDESIGN: Wider for new layout --- */
            width: 540px; 
            max-width: 90vw;
            max-height: calc(100vh - 40px);
            background: rgba(18, 20, 38, 0.75);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
            z-index: 1050;
            /* --- [FIX] Changed 'display: none' to 'display: flex' for fade-out --- */
            display: flex;
            flex-direction: column;
            overflow: hidden;
            color: #e8eaf6;
            transition: opacity 0.3s ease, transform 0.3s ease;
            opacity: 0;
            transform: translateX(20px);
            /* --- [FIX] Add pointer-events to prevent interaction when hidden --- */
            pointer-events: none; 
        }
        .info-window.visible { 
            /* --- [FIX] Removed 'display: flex' (now in base) --- */
            opacity: 1;
            transform: translateX(0);
            /* --- [FIX] Allow interaction only when visible --- */
            pointer-events: auto;
        }
        .info-window-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: rgba(10, 12, 26, 0.6);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        }
        .info-window-header h3 {
            margin: 0; 
            font-size: 1.3rem; 
            color: #fff;
            font-weight: 600;
            text-shadow: 0 2px 5px rgba(0,0,0,0.4);
        }
        .info-window-header h3 small { 
            font-weight: 300; 
            color: #c5cae9; 
            font-size: 0.9rem; 
            margin-left: 5px; 
        }
        .info-window-actions button {
            background: rgba(255,255,255,0.05); 
            border: 1px solid rgba(255,255,255,0.1);
            color: #c5cae9; 
            cursor: pointer;
            font-size: 1rem; 
            width: 32px; height: 32px;
            border-radius: 50%;
            margin-left: 8px;
            line-height: 1; 
            display: grid;
            place-items: center;
            transition: all 0.2s ease-in-out;
        }
        .info-window-actions button:hover { 
            background: #00a8ff;
            color: #fff; 
            transform: scale(1.1) rotate(90deg);
            border-color: #00a8ff;
        }
        .info-window-content { 
            overflow-y: auto; 
            flex-grow: 1; 
            padding: 0;
        }
        /* Custom Scrollbar */
        .info-window-content::-webkit-scrollbar { width: 8px; }
        .info-window-content::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        .info-window-content::-webkit-scrollbar-thumb { background-color: #00a8ff; border-radius: 10px; border: 2px solid transparent; background-clip: content-box; }
        .info-window-content::-webkit-scrollbar-thumb:hover { background-color: #33c1ff; }

        /* --- [OVERHAUL] Airport Window: Weather & Tabs --- */
        .airport-info-weather {
            padding: 20px;
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 15px 20px;
            align-items: center;
            background: linear-gradient(135deg, rgba(0, 168, 255, 0.15), rgba(0, 100, 200, 0.25));
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .weather-flight-rules { 
            font-size: 1.8rem; font-weight: 700; 
            padding: 12px 18px; border-radius: 10px;
            grid-row: 1 / 3;
            text-shadow: 1px 1px 3px rgba(0,0,0,0.3);
        }
        .flight-rules-vfr { background-color: #28a745; color: white; }
        .flight-rules-mvfr { background-color: #007bff; color: white; }
        .flight-rules-ifr { background-color: #dc3545; color: white; }
        .flight-rules-lifr { background-color: #a33ea3; color: white; }
        .weather-details-grid { 
            display: grid; grid-template-columns: 1fr 1fr; 
            gap: 10px 15px; text-align: left;
        }
        .weather-details-grid span { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; }
        .weather-details-grid .fa-solid { color: #00a8ff; width: 16px; text-align: center; }
        .metar-code {
            grid-column: 1 / -1; font-family: 'Courier New', Courier, monospace;
            background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px;
            font-size: 0.8rem; color: #e0e0e0; margin-top: 5px;
        }
        
        .info-window-tabs { display: flex; background: rgba(10, 12, 26, 0.4); padding: 5px 15px 0 15px; }
        .info-tab-btn {
            padding: 14px 18px; border: none; background: none; color: #c5cae9;
            cursor: pointer; font-size: 0.9rem; font-weight: 600;
            border-bottom: 3px solid transparent; transition: all 0.25s;
            display: flex; align-items: center; gap: 8px;
        }
        .info-tab-btn:hover { color: #fff; }
        .info-tab-btn.active { color: #00a8ff; border-bottom-color: #00a8ff; }
        .info-tab-content { display: none; animation: fadeIn 0.4s; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .info-tab-content.active { display: block; }
        .info-tab-content ul { list-style: none; padding: 0; margin: 0; }
        .info-tab-content li { padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .info-tab-content li:last-child { border-bottom: none; }
        .muted-text { color: #9fa8da; text-align: center; padding: 2rem; }


        /* --- [NEW DESIGN] AIRCRAFT FLIGHT DISPLAY --- */
        #aircraft-info-window .info-window-content {
            background: #1C1E2A; /* Solid dark background for content area */
        }
        
        /* 1. Overview Panel (Image + Top Info) */
        .aircraft-overview-panel {
            position: relative;
            height: 200px;
            background-size: cover;
            background-position: center;
            border-radius: 0; /* Top window corners are already rounded */
            color: #fff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        /* Darkening overlay for text readability */
        .aircraft-overview-panel::before {
            content: '';
            position: absolute;
            inset: 0;
            /* --- [FIX] Removed redundant background gradient --- */
            /* This is now handled *only* by the JS function */
            z-index: 1;
        }
        
        /* Container for top-left/right text */
        .overview-content {
            position: relative;
            z-index: 2;
            padding: 16px 20px 0 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .overview-col-left h3 {
            margin: 0;
            /* --- [MODIFIED] "Show-ish" text, callsign made smaller --- */
            /* ⬇️ MODIFIED: Restored to 1.6rem for desktop base */
            font-size: 1.6rem; 
            font-weight: 700; 
            letter-spacing: 0.5px;
            text-shadow: 0 4px 10px rgba(0, 0, 0, 0.7), 0 0 2px rgba(255, 255, 255, 0.2);
            /* --- [NEW] Convert to flex to align logo and text --- */
            display: flex;
            align-items: center;
            gap: 12px;
        }

        /* --- [NEW] Style for Airline Logo in Header --- */
        .ac-header-logo {
            /* ⬇️ MODIFIED: Restored to 1.8rem for desktop base */
            height: 1.8rem; 
            width: auto;
            max-width: 100px; /* Prevent huge logos */
            object-fit: contain;
            /* ---
              [USER REQUEST FIX]: This adds a subtle white glow for dark-on-dark,
              while keeping a dark shadow for light-on-light.
              ---
            */
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.7)) drop-shadow(0 0 5px rgba(255, 255, 255, 0.3));
        }
        
        /* --- [MODIFIED] Container for animating subtext --- */
        .overview-col-left p {
            /* --- [NEW] Make it a relative container --- */
            position: relative; 
            margin: 0;
            /* --- [FIX] "Show-ish" text --- */
            font-size: 1.0rem; 
            color: #e8eaf6; 
            font-weight: 400;
            text-shadow: 0 2px 5px rgba(0, 0, 0, 0.6);
            /* --- [NEW] Set height to prevent jump --- */
            min-height: 1.2em; /* 1.0rem * 1.2 line-height */
            /* --- [NEW] Add margin to account for logo --- */
            margin-top: 4px; 
        }

        /* --- [NEW] Keyframes for subtext animation --- */
        @keyframes primarySubtextAnimation {
            0%   { opacity: 1; transform: translateY(0); }
            60%  { opacity: 1; transform: translateY(0); } /* Hold Username (6s) */
            65%  { opacity: 0; transform: translateY(10px); } /* Fade Out (0.5s) */
            95%  { opacity: 0; transform: translateY(-10px); } /* Stay Hidden (3s) */
            100% { opacity: 1; transform: translateY(0); } /* Fade In (0.5s) */
        }
        @keyframes secondarySubtextAnimation {
            0%   { opacity: 0; transform: translateY(-10px); } /* Start Hidden (6.5s) */
            65%  { opacity: 0; transform: translateY(-10px); }
            70%  { opacity: 1; transform: translateY(0); } /* Fade In (0.5s) */
            90%  { opacity: 1; transform: translateY(0); } /* Hold Aircraft (2s) */
            95%  { opacity: 0; transform: translateY(10px); } /* Fade Out (0.5s) */
            100% { opacity: 0; transform: translateY(-10px); } /* Stay Hidden (0.5s) */
        }
        
        /* --- [NEW] Individual subtext items --- */
        .ac-header-subtext {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            animation-name: primarySubtextAnimation; /* Default to primary */
            animation-iteration-count: infinite;
            animation-duration: 10s;
            animation-timing-function: ease-in-out;
            opacity: 0; /* Start hidden, animation will show it */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        #ac-header-username {
            animation-name: primarySubtextAnimation;
        }
        
        #ac-header-actype {
            animation-name: secondarySubtextAnimation;
        }

        .overview-col-right {
            text-align: right;
            /* --- [MODIFIED] --- */
            display: none; /* Hide the top-right ICAOs */
        }
        .overview-col-right .route-icao {
            font-size: 1.5rem;
            font-weight: 700;
            font-family: 'Courier New', monospace;
            display: block;
        }
        .overview-col-right .route-subtext {
            font-size: 0.85rem;
            color: #c5cae9;
        }
        
        /* Action buttons (Hide/Close) */
        .overview-actions {
            position: absolute;
            top: 16px;
            right: 16px;
            z-index: 3;
            display: flex;
            gap: 8px;
        }
        .overview-actions button {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #e8eaf6;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            display: grid;
            place-items: center;
            transition: all 0.2s ease-in-out;
            backdrop-filter: blur(5px);
        }
        .overview-actions button:hover {
            background: #00a8ff;
            color: #fff;
            transform: scale(1.1);
            border-color: transparent;
        }

        /* 2. Route Summary Overlay (User Request) */
        .route-summary-overlay {
            position: relative; 
            z-index: 2;
            padding: 12px 20px;
            /* --- [USER REQUEST FIX] Fade from transparent to solid --- */
            background: linear-gradient(180deg, rgba(28, 30, 42, 0.0) 0%, #1C1E2A 100%);
            backdrop-filter: blur(10px);
            /* --- REMOVED: border-top --- */
            
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: center;
            gap: 16px;
            width: 100%;
            box-sizing: border-box; 
        }
        .route-summary-overlay .icao {
            font-family: 'Courier New', monospace;
            font-size: 1.2rem;
            font-weight: 700;
            color: #fff;
        }
        .route-progress-container {
            /* --- MODIFIED: Use Grid for layering --- */
            display: grid;
            grid-template-columns: 1fr;
            grid-template-rows: 1fr;
            align-items: center;
            justify-items: center;
            position: relative;
            min-height: 28px; /* Space for the pill indicator */
        }
        .route-progress-bar-container {
            width: 100%;
            height: 6px;
            background: rgba(10, 12, 26, 0.7);
            border-radius: 3px;
            overflow: hidden;
            /* --- MODIFIED: Layering --- */
            grid-row: 1 / 1;
            grid-column: 1 / 1;
            z-index: 1;
        }
        .progress-bar-fill {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #00a8ff, #89f7fe);
            transition: width 0.5s ease-out;
            border-radius: 3px;
        }
        .flight-phase-indicator {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 700;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 6px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.4s ease-out;
            /* --- MODIFIED: Layering & Shadow --- */
            grid-row: 1 / 1;
            grid-column: 1 / 1;
            z-index: 2;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
        }
        .flight-phase-indicator .fa-solid { font-size: 0.8rem; }
        /* --- [MODIFIED] --- Opacity increased from 0.7 to 0.9 --- */
        .phase-climb { background: rgba(34, 139, 34, 0.9); box-shadow: 0 0 10px rgba(34, 139, 34, 0.7); }
        .phase-cruise { background: rgba(0, 119, 255, 0.9); box-shadow: 0 0 10px rgba(0, 119, 255, 0.7); }
        .phase-descent { background: rgba(255, 140, 0, 0.9); box-shadow: 0 0 10px rgba(255, 140, 0, 0.7); }
        .phase-approach { background: rgba(138, 43, 226, 0.9); box-shadow: 0 0 10px rgba(138, 43, 226, 0.7); }
        .phase-enroute { background: rgba(100, 110, 130, 0.9); box-shadow: 0 0 10px rgba(100, 110, 130, 0.7); }

        /* 3. Main Content (PFD + Grids) */
        .unified-display-main-content {
            padding: 16px;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        /* ====================================================================
        --- [START] NEW (PFD | Data) + VSD LAYOUT (USER REQUEST) ---
        ====================================================================
        */
        
        /* --- [REMOVED] Tab styles --- */

        /* --- [NEW] Simple Pane switching --- */
        .ac-tab-pane {
            display: none;
            flex-direction: column;
            gap: 16px; /* <-- Matches gap of .unified-display-main-content */
            animation: fadeIn 0.4s;
        }
        .ac-tab-pane.active {
            display: flex;
        }
        
        /* [NEW] This is the full-width VSD card at the bottom */
        .ac-profile-card-new {
            background: rgba(10, 12, 26, 0.5);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 10px;
            border-top: 3px solid #a33ea3; /* Colorful accent */
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .ac-profile-card-new h4 { /* Title for VSD */
            margin: 0 0 5px 0;
            font-size: 0.9rem;
            font-weight: 600;
            color: #e8eaf6;
            text-align: center;
        }
        
        /* ====================================================================
        --- [END] NEW (PFD | Data) + VSD LAYOUT ---
        ====================================================================
        */

        #aircraft-display-main {
            /* --- [REMOVED] --- This ID is no longer used for layout --- */
        }
        .unified-display-main {
            /* --- [REMOVED] --- Replaced by .pfd-data-grid --- */
        }


        /* ====================================================================
        --- [START] FDC REDESIGN (PFD + DATA BLOCKS) ---
        ==================================================================== */

        /* [NEW] This is the new 2-column grid container */
        .fdc-layout-grid {
            display: grid;
            grid-template-columns: 240px 1fr; /* PFD Left, Data Right */
            gap: 12px;
            min-height: 0;
            overflow: hidden;
            
            /* Main card styling */
            background: rgba(10, 12, 26, 0.5);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 10px;
            border-top: 3px solid #00a8ff; /* Blue accent */
        }

        /* [MODIFIED] Column 1: PFD Panel */
        .fdc-pfd-panel {
            display: flex;
            min-width: 0;
        }

        /* [MODIFIED] PFD Instrument Container */
        .fdc-pfd-instrument {
            display: grid;
            place-items: center;
            background: rgba(10, 12, 26, 0.5);
            border-radius: 12px; /* [FIX] Now has rounded corners on all sides */
            overflow: hidden;
            width: 100%;
        }
        #pfd-container { /* This is the new ID for the fdc-pfd-instrument */
             display: grid;
            place-items: center;
            background: rgba(10, 12, 26, 0.5);
            border-radius: 12px; /* [FIX] Now has rounded corners on all sides */
            overflow: hidden;
            width: 100%;
        }
        .fdc-pfd-instrument svg {
            width: 100%;
            height: auto;
            max-width: 350px;
            aspect-ratio: 787 / 635; 
            background-color: #1a1a1a;
            font-family: monospace, sans-serif;
            color: white;
            overflow: hidden;
            position: relative;
            border-radius: 8px; /* Inner radius for the SVG itself */
        }
        #pfd-container svg {
            width: 100%;
            height: auto;
            max-width: 350px;
            aspect-ratio: 787 / 635; 
            background-color: #1a1a1a;
            font-family: monospace, sans-serif;
            color: white;
            overflow: hidden;
            position: relative;
            border-radius: 8px; /* Inner radius for the SVG itself */
        }
        .fdc-pfd-instrument svg #attitude_group {
            transition: transform 0.5s ease-out;
        }
         #pfd-container svg #attitude_group {
            transition: transform 0.5s ease-out;
        }

        /* [REMOVED] All styles for .pfd-footer-display are gone */


        /* [REDESIGNED] Column 2: Flight Data Computer */
        .fdc-data-panel {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 10px;
        }

        /* [NEW] Primary (VS) Readout */
        .fdc-primary-readout {
            background: rgba(0,0,0,0.3);
            border-radius: 8px;
            padding: 16px 12px;
            text-align: center;
            flex-grow: 1; /* Takes up available space */
            display: flex;
            flex-direction: column;
            justify-content: center;
            border-left: 3px solid #00a8ff;
        }
        .fdc-label {
            font-size: 0.7rem;
            color: #c5cae9;
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        .fdc-primary-readout .fdc-value {
            font-size: 2.2rem;
            font-weight: 600;
            color: #fff;
            line-height: 1.1;
            font-family: 'Courier New', monospace;
        }
        .fdc-primary-readout .fdc-value .fa-solid {
            font-size: 1.5rem;
            margin-right: 8px;
            vertical-align: middle;
            transform: translateY(-2px);
        }
        .fdc-unit {
            font-size: 0.8rem;
            font-weight: 400;
            color: #9fa8da;
            margin-left: 4px;
            font-family: 'Segoe UI', sans-serif;
        }

        /* [NEW] 2x2 Navigation Grid */
        .fdc-data-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        .fdc-data-item {
            background: rgba(0,0,0,0.2);
            border-radius: 8px;
            padding: 12px 8px;
            text-align: center;
        }
        .fdc-data-item .fdc-value {
            font-size: 1.4rem;
            color: #fff;
            font-weight: 600;
            font-family: 'Courier New', monospace;
            line-height: 1.2;
            
            /* For long waypoint names */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: block;
        }
        /* Smaller unit for the grid */
        .fdc-data-item .fdc-value .fdc-unit {
            font-size: 0.75rem;
        }

        /* [NEW] Tertiary (GS) Readout */
        .fdc-tertiary-readout {
            background: rgba(0,0,0,0.2);
            border-radius: 8px;
            padding: 10px 12px;
            text-align: center;
        }
        .fdc-tertiary-readout .fdc-value {
            font-size: 1.2rem;
            color: #fff;
            font-weight: 600;
            font-family: 'Courier New', monospace;
        }

        /* [REMOVED] All styles for donut charts and odometers are gone */

        /* ====================================================================
        --- [END] FDC REDESIGN ---
        ==================================================================== */


        /* Aircraft Type Readout (REMOVED) */
        #aircraft-type-readout {
           display: none; /* This is no longer used */
        }

        /* --- [REMOVED] --- .live-data-panel styles (replaced by .live-data-panel-new) */

        /* 6. Pilot Stats Button */
        /* --- [RESTORED] --- */
        .pilot-stats-toggle-btn {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15);
            color: #e8eaf6;
            padding: 10px 12px;
            width: 100%;
            border-radius: 8px;
            cursor: pointer;
            text-align: center;
            transition: all 0.2s;
            font-size: 0.9rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .pilot-stats-toggle-btn:hover {
            background: #00a8ff;
            color: #fff;
        }

        /* 7. Pilot Stats View */
        #pilot-stats-display {
            /* --- [REMOVED] --- This is now handled by .ac-tab-pane */
        }
        .stats-rehaul-container {
            padding: 0; /* Remove padding, handled by parent */
            display: flex;
            flex-direction: column;
            gap: 16px;
            color: #e8eaf6;
        }
        .section-title {
            margin: 8px 0 -8px 0;
            font-size: 0.9rem;
            font-weight: 600;
            color: #9fa8da;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding-bottom: 8px;
        }
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 12px;
        }
        .kpi-card {
            background: rgba(10, 12, 26, 0.7);
            border-radius: 8px;
            padding: 12px;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .kpi-label {
            font-size: 0.7rem;
            color: #c5cae9;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .kpi-value {
            font-size: 1.4rem;
            font-weight: 700;
            color: #fff;
            line-height: 1.2;
        }
        .progression-container {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
        }
        .progress-card {
            background: rgba(10, 12, 26, 0.6);
            border-radius: 8px;
            padding: 16px;
            border-left: 4px solid #00a8ff;
        }
        .progress-card.complete {
            border-left-color: #28a745;
            text-align: center;
        }
        .progress-card h4 {
            margin: 0 0 12px 0;
            font-size: 1.1rem;
            color: #fff;
        }
        .progress-item {
            margin-bottom: 12px;
        }
        .progress-item:last-child {
            margin-bottom: 0;
        }
        .progress-label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.85rem;
            margin-bottom: 6px;
            color: #e8eaf6;
        }
        .progress-label .fa-solid { color: #9fa8da; margin-right: 6px; }
        .progress-bar-bg {
            width: 100%;
            height: 8px;
            background-color: rgba(0,0,0,0.3);
            border-radius: 4px;
            overflow: hidden;
        }
        .progress-bar-fg {
            height: 100%;
            background: linear-gradient(90deg, #00a8ff, #89f7fe);
            border-radius: 4px;
            transition: width 0.5s ease-out;
        }
        .req-met { color: #28a745; }
        .req-not-met { color: #dc3545; }
        .req-met .fa-solid, .req-not-met .fa-solid { margin-left: 6px; }

        .details-grid.stats-details { /* Add class to differentiate */
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 16px;
            background: rgba(10, 12, 26, 0.6);
            padding: 16px;
            border-radius: 8px;
        }
        .detail-item.stats-item { /* Add class to differentiate */
            display: flex;
            justify-content: space-between;
            font-size: 0.9rem;
            padding: 6px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .detail-item.stats-item:last-child, .detail-item.stats-item:nth-last-child(2) { border-bottom: none; }
        /* --- MODIFIED: Need to redefine detail-label/value as they were removed --- */
        .detail-label { color: #c5cae9; }
        .detail-value { color: #fff; font-weight: 600; }
        .back-to-flight-btn { /* Changed from back-to-pfd-btn */
            background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
            color: #e8eaf6; padding: 10px 12px; width: 100%;
            border-radius: 8px; cursor: pointer; text-align: center;
            transition: all 0.2s; font-size: 0.9rem; font-weight: 600;
        }
        .back-to-flight-btn:hover { background: #00a8ff; color: #fff; }

        /* Stats Accordion */
        .stats-rehaul-container .stats-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0; /* Adjusted margin */
        }
        .stats-rehaul-container .stats-header h4 {
            margin: 0;
            font-size: 1.4rem;
        }
        .community-profile-link {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background-color: rgba(0, 168, 255, 0.1);
            color: #00a8ff;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-decoration: none;
            border: 1px solid rgba(0, 168, 255, 0.3);
            transition: all 0.2s ease-in-out;
        }
        .community-profile-link:hover {
            background-color: #00a8ff;
            color: #fff;
            transform: translateY(-2px);
            box-shadow: 0 4px 10px rgba(0, 168, 255, 0.3);
        }

        .stats-accordion {
            margin-top: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .accordion-item {
            background: rgba(10, 12, 26, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            overflow: hidden;
            transition: background-color 0.2s;
        }
        .accordion-item.active {
            background: rgba(10, 12, 26, 0.8);
        }
        .accordion-header {
            width: 100%;
            background: none;
            border: none;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            color: #e8eaf6;
            text-align: left;
        }
        .accordion-header span {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .accordion-header .toggle-icon {
            transition: transform 0.3s ease-in-out;
            color: #9fa8da;
        }
        .accordion-item.active .toggle-icon {
            transform: rotate(180deg);
        }
        .accordion-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease-in-out, padding 0.3s ease-in-out;
            padding: 0 16px;
        }
        .accordion-item.active .accordion-content {
            padding: 0 16px 16px 16px;
        }
        .accordion-content > .progression-container,
        .accordion-content > .details-grid {
            padding-top: 8px;
        }
        
        /* --- Toolbar Recall Buttons --- */
        #airport-recall-btn, #aircraft-recall-btn {
            display: none; font-size: 1.1rem; position: relative;
        }
        #airport-recall-btn.visible, #aircraft-recall-btn.visible {
            display: inline-block;
        }
        #airport-recall-btn.palpitate, #aircraft-recall-btn.palpitate {
            animation: palpitate 0.5s ease-in-out 2;
        }
        @keyframes palpitate {
            0%, 100% { transform: scale(1); color: #00a8ff; }
            50% { transform: scale(1.3); color: #fff; }
        }
        
        /* Styles for Active ATC Markers on Sector Ops Map */
        @keyframes atc-pulse {
            0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); }
            100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
        }
        @keyframes atc-breathe {
            0% { transform: scale(0.95); opacity: 0.6; }
            50% { transform: scale(1.4); opacity: 0.9; }
            100% { transform: scale(0.95); opacity: 0.6; }
        }
        .atc-active-marker {
            width: 15px; height: 15px; background-color: #dc3545; border-radius: 50%;
            border: 2px solid #fff; cursor: pointer; animation: atc-pulse 2s infinite;
            display: grid; place-items: center;
        }
        .atc-approach-active::before {
            content: ''; grid-area: 1 / 1; width: 250%; height: 250%; border-radius: 50%;
            background-color: rgba(240, 173, 78, 0.8); z-index: -1; 
            animation: atc-breathe 4s ease-in-out infinite;
        }
        
        /* --- [NEW] Mobile Sidebar Toggle & Overlay --- */
        .mobile-sidebar-toggle-btn {
            display: none; /* Hidden by default on desktop */
            place-items: center;
            position: fixed;
            top: 15px;
            left: 15px;
            z-index: 1100; /* ✅ High z-index to be on top of everything */
            background-color: rgba(18, 20, 38, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #e8eaf6;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.2rem;
            backdrop-filter: blur(10px);
            transition: all 0.2s ease-in-out;
        }
        .mobile-sidebar-toggle-btn:hover {
            background-color: #00a8ff;
            color: #fff;
            transform: scale(1.1);
        }

        .mobile-nav-overlay {
            display: none; /* ✅ Should be hidden by default */
            position: fixed;
            inset: 0;
            background-color: rgba(0, 0, 0, 0.6);
            z-index: 998; /* ✅ Below sidebar, above content */
        }

        /* --- [NEW] Responsive Media Query for Mobile --- */
        @media (max-width: 992px) {
            .mobile-sidebar-toggle-btn {
                display: grid; /* Show the button on mobile */
            }

            /* Hide the desktop toggle button on mobile */
            #sidebar-toggle {
                display: none;
            }

            .sidebar {
                position: fixed;
                left: 0;
                top: 0;
                height: 100%;
                width: 260px;
                transform: translateX(-100%); /* Start off-screen */
                transition: transform 0.3s ease-in-out;
                z-index: 999; /* ✅ Higher than the overlay */
                box-shadow: 5px 0 25px rgba(0,0,0,0.3);
            }

            /* When the menu is open, slide the sidebar in */
            .dashboard-container.sidebar-mobile-open .sidebar {
                transform: translateX(0);
            }

            /* ✅ When the menu is open, show the overlay */
            .dashboard-container.sidebar-mobile-open .mobile-nav-overlay {
                display: block;
            }
            
            /* Remove the padding that makes space for a static sidebar */
            .main-content, .dashboard-container.sidebar-collapsed .main-content {
                padding-left: 0;
            }
            
            /*
             * --- [USER REQUEST FIX - REMOVED!] ---
             * This rule was moved out of the media query
             * to apply to all screen sizes.
            */
            /*
            .main-content:has(#view-rosters.active) {
                padding: 0; 
                height: 100dvh; 
                overflow: hidden; 
            }
            */

            /* --- [REDESIGN] Mobile layout for info window --- */
            .info-window {
                width: 95vw; /* Almost full width */
                top: 10px;
                right: 2.5vw;
                left: 2.5vw;
                max-height: calc(100vh - 20px);
            }
            
            /* --- [MODIFIED] Stack (PFD | Data) grid on mobile --- */
            .pfd-data-grid { /* [DEPRECATED] but kept for fallback */
                grid-template-columns: 1fr; 
            }
            .fdc-layout-grid { /* [NEW] */
                grid-template-columns: 1fr;
            }
            
            .fdc-pfd-panel { /* [NEW] */
                /* Ensure PFD isn't too large */
                max-width: 400px;
                margin: 0 auto;
                width: 100%;
            }
            .pfd-main-panel { /* [DEPRECATED] but kept for fallback */
                /* Ensure PFD isn't too large */
                max-width: 400px;
                margin: 0 auto;
                width: 100%;
            }

            /* --- [REMOVED] Mobile grid styles for deleted elements --- */

            /* ⬇️ --- [NEW FIX] --- ⬇️ */
            /* Selectively reduce callsign font size only on mobile */
            .overview-col-left h3 {
                font-size: 1.1rem;
            }
            .ac-header-logo {
                height: 1.3rem;
            }
            /* ⬆️ --- [END NEW FIX] --- ⬆️ */
        }
        
        /* ====================================================================
        --- [START] VSD RE-DESIGN (USER REQUEST) --- 
        ====================================================================
        */
        #vsd-panel {
            position: relative;
            display: flex;
            flex-direction: column;
            background: transparent; /* --- [MODIFIED] Card bg handles this --- */
            border-radius: 12px;
            min-height: 240px; /* Give it a fixed height */
            max-height: 240px;
            overflow: hidden;
            font-family: 'Courier New', monospace;
            flex-grow: 1; /* --- [NEW] --- */
            width: 100%; /* --- [NEW] --- */
        }
        
        #vsd-summary-bar {
           /* --- [REMOVED] --- This is no longer used --- */
           display: none;
        }

        #vsd-graph-window {
            position: relative;
            width: 100%;
            flex-grow: 1;
            overflow: hidden;
            border-radius: 12px;
            
            /* --- [MODIFIED] Add padding for the new Y-Axis --- */
            padding-left: 35px;
            box-sizing: border-box; /* Ensure padding is included in width */
            
            /* Add horizontal grid lines for altitude */
            background: linear-gradient(
                rgba(0, 168, 255, 0.1) 1px, 
                transparent 1px
            );
            /* --- [MODIFIED] Adjusted background size to match 10k ft intervals --- */
            background-size: 100% 53.3px; /* (240px / 45k ft) * 10k ft */
        }

        /* --- [NEW] Y-Axis (Altitude Scale) --- */
        #vsd-y-axis {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 35px; /* Matches padding-left */
            font-size: 0.7rem;
            color: #9fa8da;
            font-weight: 600;
            padding: 5px 0;
            box-sizing: border-box;
            border-right: 1px solid rgba(0, 168, 255, 0.1);
            pointer-events: none; /* Let clicks pass through */
        }
        .y-axis-label {
            position: absolute;
            left: 5px;
            transform: translateY(-50%); /* Center on its 'top' value */
            text-shadow: 0 0 3px rgba(0,0,0,0.5);
        }
        /* --- [END NEW] --- */

        /* --- [MODIFIED] Aircraft Icon (Added Dropline) --- */
        #vsd-aircraft-icon {
            position: absolute;
            left: 0px; /* Will be set by JS */
            top: 50%; /* Will be set by JS */
            width: 30px;
            height: 20px;
            z-index: 10;
            /* Simple '>' icon for aircraft */
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 20' fill='%2300a8ff'%3E%3Cpath d='M2,10 L10,2 L10,7 L28,7 L28,13 L10,13 L10,18 L2,10 Z' /%3E%3C/svg%3E");
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            transform: translateY(-50%);
            transition: top 0.5s ease-out, left 1s linear;
        }
        
        /* --- [NEW] Vertical Dropline for aircraft --- */
        #vsd-aircraft-icon::before {
            content: '';
            position: absolute;
            top: 50%; /* Start at icon center */
            left: 10px; /* Position horizontally within icon bounds */
            width: 2px;
            height: 500px; /* Arbitrarily long */
            background: linear-gradient(to bottom, #00a8ff, transparent 80%);
            opacity: 0.7;
        }
        /* --- [END NEW] --- */
        
        #vsd-graph-content {
            position: absolute;
            top: 0;
            left: 35px; /* --- [MODIFIED] Start after Y-Axis --- */
            height: 100%;
            width: 1px; /* Will be set by JS */
            will-change: transform;
            transition: transform 1s linear; /* Smooth scroll */
        }

        #vsd-profile-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: visible;
        }
        
        #vsd-profile-path {
            fill: none;
            stroke: #00a8ff;
            stroke-width: 3;
            stroke-linejoin: round;
        }

        /* --- [MODIFIED] Style for the Flown Altitude Path --- */
        #vsd-flown-path {
            fill: none;
            stroke: #dc3545; /* Red */
            stroke-width: 4; /* <-- MODIFIED */
            stroke-linejoin: round;
            opacity: 0.9; /* <-- MODIFIED */
        }
        /* --- [END MODIFIED] --- */

        #vsd-waypoint-labels {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }
        
        /* --- [MODIFIED] Waypoint Labels (Staggering) --- */
        .vsd-wp-label {
            position: absolute;
            transform: translateX(-50%); /* Center the label on its 'left' pos */
            color: #fff;
            font-size: 0.8rem;
            text-align: center;
            text-shadow: 0 0 5px rgba(0,0,0,0.8);
            line-height: 1.2;
            padding: 2px 4px;
            background: rgba(10, 12, 26, 0.5);
            border-radius: 3px;
            white-space: nowrap;
        }
        .vsd-wp-label .wp-name {
            font-weight: 700;
            font-size: 0.9rem;
            color: #89f7fe;
        }
        .vsd-wp-label .wp-alt {
            font-size: 0.75rem;
            color: #c5cae9;
        }

        /* --- [NEW] Tick lines for labels --- */
        .vsd-wp-label::after {
            content: '';
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: 1px;
            height: 12px; /* Connects label to profile */
            background: rgba(255, 255, 255, 0.3);
        }
        
        /* High label: tick goes from bottom-center DOWN */
        .vsd-wp-label.high-label::after {
            top: 100%;
        }

        /* Low label: tick goes from top-center UP */
        .vsd-wp-label.low-label::after {
            bottom: 100%;
        }
        /* --- [END NEW] --- */

        /* ====================================================================
        --- [END] VSD RE-DESIGN --- 
        ====================================================================
        */

        /* --- [NEW] Aircraft Window Tab Styles --- */
        .ac-info-window-tabs {
            display: flex;
            background: rgba(10, 12, 26, 0.4);
            padding: 5px 15px 0 15px;
            /* --- [FIX] Removed margins that incorrectly placed it inside the content area --- */
            /* margin: 0 16px; */ 
            /* margin-top: 16px; */
            border-radius: 0; /* --- [FIX] Removed border-radius --- */
        }
        .ac-info-tab-btn {
            padding: 14px 18px;
            border: none;
            background: none;
            color: #c5cae9;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 600;
            border-bottom: 3px solid transparent;
            transition: all 0.25s;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .ac-info-tab-btn:hover { color: #fff; }
        .ac-info-tab-btn.active { color: #00a8ff; border-bottom-color: #00a8ff; }

        /* Hide the old toggle buttons, as tabs replace them */
        .pilot-stats-toggle-btn,
        .back-to-flight-btn {
            display: none !important;
        }

        /* --- [MODIFIED] VSD Disclaimer --- */
        .vsd-disclaimer {
            background: rgba(10, 12, 26, 0.5); /* --- [MODIFIED] Re-add bg --- */
            border: 1px solid rgba(255, 255, 255, 0.05); /* --- [MODIFIED] Re-add border --- */
            border-radius: 8px; /* --- [NEW] --- */
            padding: 10px 14px;
            margin-top: 0; 
        }
        .disclaimer-legend {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-bottom: 8px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .disclaimer-legend span {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .vsd-disclaimer p {
            font-size: 0.75rem;
            color: #9fa8da;
            text-align: center;
            margin: 0;
            padding-top: 8px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .vsd-disclaimer p .fa-solid {
            margin-right: 4px;
        }
    `;

    const style = document.createElement('style');
    style.id = styleId;
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
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

    // --- NEW: Fetch Runway Data ---
async function fetchRunwaysData() {
    try {
        // Make sure the path to your JSON file is correct
        const response = await fetch('runways.json'); 
        if (!response.ok) throw new Error('Could not load runway data.');
        const rawRunways = await response.json();

        // Re-structure data for easier lookup by airport ICAO
        runwaysData = rawRunways.reduce((acc, runway) => {
            const ident = runway.airport_ident;
            if (!acc[ident]) {
                acc[ident] = [];
            }
            acc[ident].push(runway);
            return acc;
        }, {});
        console.log(`Successfully loaded and indexed runway data for ${Object.keys(runwaysData).length} airports.`);
    } catch (error) {
        console.error('Failed to fetch runway data:', error);
        showNotification('Runway data not available; takeoff/landing detection may be limited.', 'error');
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

    /// --- Helper Functions ---

/**
     * --- [NEW] Helper function to update odometer-style text with a fade.
     * Uses a transitionend listener for a smooth update without chained setTimeouts.
     * @param {HTMLElement} el - The DOM element (span) to update.
     * @param {string} newValue - The new text content to display.
     */
    function updateOdometerDigit(el, newValue) {
        if (!el) return;
        
        const currentValue = el.textContent;
        
        if (currentValue !== newValue) {
            // 1. Fade out the old value
            el.style.opacity = 0;
            
            // 2. Listen for the fade-out to finish
            el.addEventListener('transitionend', function handler() {
                // 3. Once faded out, change the text
                el.textContent = newValue;
                
                // 4. Fade back in
                el.style.opacity = 1;
                
                // 5. Clean up the listener
                el.removeEventListener('transitionend', handler);
            }, { once: true });
        }
    }


function getAircraftCategory(aircraftName) {
    if (!aircraftName) return 'default';
    const name = aircraftName.toLowerCase();

    // Fighter / Military
    if (['f-16', 'f-18', 'f-22', 'f-35', 'f/a-18', 'a-10'].some(ac => name.includes(ac))) {
        return 'fighter';
    }

    // --- NEW: Jumbo Jets (Supers) ---
    // This check MUST come before the wide-body check.
    if (['a380', '747', 'vc-25'].some(ac => name.includes(ac))) {
        return 'jumbo';
    }

    // Wide-body Jets
    if (['a330', 'a340', 'a350', '767', '777', '787', 'dc-10', 'md-11'].some(ac => name.includes(ac))) {
        return 'widebody';
    }
    
    // Regional Jets (CRJs, Embraer, etc.)
    if (['crj', 'erj', 'dh8d', 'q400'].some(ac => name.includes(ac))) {
        return 'regional';
    }
    
    // Private / General Aviation
    if (['cessna', 'citation', 'cirrus', 'tbm', 'sr22','xcub'].some(ac => name.includes(ac))) {
        return 'private';
    }

    // Narrow-body Jets
    if (['a318', 'a319', 'a320', 'a321', '717', '727', '737', '757', 'a220', 'e17', 'e19'].some(ac => name.includes(ac))) {
        return 'narrowbody';
    }
    
    return 'default';
}

    /**
     * Calculates the distance between two coordinates in kilometers using the Haversine formula.
     */
    function getDistanceKm(lat1, lon1, lat2, lon2) {
      const R = 6371; // Radius of the Earth in km
      const toRad = (v) => (v * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }


    /**
     * --- [NEW] Calculates the initial bearing from point 1 to point 2.
     * @param {number} lat1 - Latitude of the starting point in degrees.
     * @param {number} lon1 - Longitude of the starting point in degrees.
     * @param {number} lat2 - Latitude of the ending point in degrees.
     * @param {number} lon2 - Longitude of the ending point in degrees.
     * @returns {number} The initial bearing in degrees (0-360).
     */
    function getBearing(lat1, lon1, lat2, lon2) {
        const toRad = (v) => v * Math.PI / 180;
        const toDeg = (v) => v * 180 / Math.PI;

        const lat1Rad = toRad(lat1);
        const lon1Rad = toRad(lon1);
        const lat2Rad = toRad(lat2);
        const lon2Rad = toRad(lon2);

        const dLon = lon2Rad - lon1Rad;

        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
        
        let brng = toDeg(Math.atan2(y, x));
        return (brng + 360) % 360; // Normalize to 0-360
    }

    /**
     * --- [NEW] Normalizes a bearing difference to the smallest angle (-180 to 180).
     * @param {number} diff - The difference in degrees.
     * @returns {number} The normalized difference.
     */
    function normalizeBearingDiff(diff) {
        let normalized = diff % 360;
        if (normalized > 180) {
            normalized -= 360;
        }
        if (normalized < -180) {
            normalized += 360;
        }
        return normalized;
    }

/**
 * Calculates an intermediate point along a great-circle path.
 * @param {number} lat1 - Latitude of the starting point in degrees.
 * @param {number} lon1 - Longitude of the starting point in degrees.
 * @param {number} lat2 - Latitude of the ending point in degrees.
 * @param {number} lon2 - Longitude of the ending point in degrees.
 * @param {number} fraction - The fraction of the distance along the path (0.0 to 1.0).
 * @returns {{lat: number, lon: number}} The intermediate point's coordinates.
 */
function getIntermediatePoint(lat1, lon1, lat2, lon2, fraction) {
    const toRad = (v) => v * Math.PI / 180;
    const toDeg = (v) => v * 180 / Math.PI;

    const lat1Rad = toRad(lat1);
    const lon1Rad = toRad(lon1);
    const lat2Rad = toRad(lat2);
    const lon2Rad = toRad(lon2);

    const d = getDistanceKm(lat1, lon1, lat2, lon2) / 6371; // Angular distance in radians

    const a = Math.sin((1 - fraction) * d) / Math.sin(d);
    const b = Math.sin(fraction * d) / Math.sin(d);

    const x = a * Math.cos(lat1Rad) * Math.cos(lon1Rad) + b * Math.cos(lat2Rad) * Math.cos(lon2Rad);
    const y = a * Math.cos(lat1Rad) * Math.sin(lon1Rad) + b * Math.cos(lat2Rad) * Math.sin(lon2Rad);
    const z = a * Math.sin(lat1Rad) + b * Math.sin(lat2Rad);

    const latI = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lonI = toDeg(Math.atan2(y, x));

    return { lat: latI, lon: lonI };
}


/**
 * --- [REPLACEMENT - TELEPORT VERSION] Handles live flight data received from the WebSocket.
 * This function updates the map source directly, causing aircraft to "teleport"
 * to their new positions with each update.
 *
 * ⬇️ MODIFIED: Now passes `isStaff` and `isVAMember` to the map source properties.
 */
function handleSocketFlightUpdate(data) {
    if (!data || !Array.isArray(data.flights)) {
        console.warn('Socket: Received invalid flights data packet.');
        return;
    }

    if (!sectorOpsMap || !sectorOpsMap.isStyleLoaded()) {
        return; // Map not ready
    }

    const source = sectorOpsMap.getSource('sector-ops-live-flights-source');
    if (!source) {
        console.warn('Socket: Map source not found, cannot update flight positions.');
        return;
    }

    const flights = data.flights;
    const updatedFlightIds = new Set();

    flights.forEach(flight => {
        if (!flight.position || flight.position.lat == null || flight.position.lon == null) return;

        const flightId = flight.flightId;
        updatedFlightIds.add(flightId);

        // Extract new API data
        const newApiLat = flight.position.lat;
        const newApiLon = flight.position.lon;
        const newApiHeading = flight.position.track_deg || 0;
        const newApiSpeed = flight.position.gs_kt || 0;
        const newProperties = {
            flightId: flight.flightId,
            callsign: flight.callsign,
            username: flight.username,
            altitude: flight.position.alt_ft,
            speed: newApiSpeed,
            verticalSpeed: flight.position.vs_fpm || 0,
            position: JSON.stringify(flight.position),
            aircraft: JSON.stringify(flight.aircraft),
            userId: flight.userId,
            category: getAircraftCategory(flight.aircraft?.aircraftName),
            heading: newApiHeading, // Pass heading for icon rotation
            // ⬇️ === NEW: Add VA status for icon logic === ⬇️
            isStaff: flight.isStaff,
            isVAMember: flight.isVAMember
            // ⬆️ === END OF NEW LINES === ⬆️
        };

        // Create or update the feature in our state
        currentMapFeatures[flightId] = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [newApiLon, newApiLat]
            },
            properties: newProperties
        };
    });

    // Clean up old flights that are no longer in the broadcast
    for (const flightId in currentMapFeatures) {
        if (!updatedFlightIds.has(flightId)) {
            delete currentMapFeatures[flightId];
        }
    }

    // Update the map source with the new feature collection
    source.setData({
        type: 'FeatureCollection',
        features: Object.values(currentMapFeatures)
    });
}

/**
 * --- [NEW] Initializes and connects the Socket.IO client for Sector Ops.
 * Manages connection, room joining, and data event listeners.
 */
function initializeSectorOpsSocket() {
    // Prevent duplicate connections if called multiple times
    if (sectorOpsSocket && sectorOpsSocket.connected) {
        return;
    }

    // If a socket exists but is disconnected, try to reconnect
    if (sectorOpsSocket) {
        sectorOpsSocket.connect();
        return;
    }

    // Create new connection
    // ASSUMPTION: The Socket.IO client library (socket.io.js) is included in your HTML.
    if (typeof io === 'undefined') {
        console.error('Socket.IO client library (io) is not loaded. Cannot connect to WebSocket.');
        showNotification('Live service connection failed. Please reload.', 'error');
        return;
    }
    
    console.log(`Socket: Connecting to ${ACARS_SOCKET_URL}...`);
    sectorOpsSocket = io(ACARS_SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        transports: ['websocket'] // Prefer websocket
    });

    // On successful connection, join the server room
    sectorOpsSocket.on('connect', () => {
        console.log(`Socket: Connected with ID ${sectorOpsSocket.id}. Joining room: ${TARGET_SERVER_NAME.toLowerCase()}`);
        sectorOpsSocket.emit('join_server_room', TARGET_SERVER_NAME);
    });

    // --- THIS IS THE CORE ---
    // Listen for the broadcasted flight data
    sectorOpsSocket.on('all_flights_update', handleSocketFlightUpdate);
    // --- END OF CORE ---

    sectorOpsSocket.on('disconnect', (reason) => {
        console.warn(`Socket: Disconnected. Reason: ${reason}`);
    });

    sectorOpsSocket.on('connect_error', (error) => {
        console.error(`Socket: Connection Error. ${error.message}`);
    });
}

/**
 * Densifies a route by adding intermediate points between each coordinate pair.
 * @param {Array<[number, number]>} coordinates - The original array of [lon, lat] points.
 * @param {number} numPoints - The number of intermediate points to add between each original point.
 * @returns {Array<[number, number]>} The new, densified array of [lon, lat] points.
 */
function densifyRoute(coordinates, numPoints = 20) {
    if (coordinates.length < 2) {
        return coordinates;
    }

    const densified = [];
    densified.push(coordinates[0]); // Start with the first point

    for (let i = 0; i < coordinates.length - 1; i++) {
        const [lon1, lat1] = coordinates[i];
        const [lon2, lat2] = coordinates[i + 1];

        // Only densify if the points are reasonably far apart
        if (getDistanceKm(lat1, lon1, lat2, lon2) > 5) { // e.g., don't densify short taxi segments
            for (let j = 1; j <= numPoints; j++) {
                const fraction = j / (numPoints + 1);
                const intermediate = getIntermediatePoint(lat1, lon1, lat2, lon2, fraction);
                densified.push([intermediate.lon, intermediate.lat]);
            }
        }
        
        densified.push(coordinates[i + 1]); // Add the next original point
    }

    return densified;
}


    /**
 * --- NEW HELPER FUNCTION ---
 * Finds the closest runway end to a given aircraft position and track.
 * @param {object} aircraftPos - { lat, lon, track_deg }
 * @param {string} airportIcao - The ICAO of the airport to check.
 * @param {number} maxDistanceNM - The maximum search radius in nautical miles.
 * @returns {object|null} - The runway end details (including distance and heading difference) or null if none are close enough.
 */
function getNearestRunway(aircraftPos, airportIcao, maxDistanceNM = 2.0) {
    const runways = runwaysData[airportIcao];
    if (!runways || runways.length === 0) {
        return null;
    }

    let closestRunway = null;
    let minDistanceKm = maxDistanceNM * 1.852;

    for (const runway of runways) {
        // Check both ends of the runway ('le' = low end, 'he' = high end)
        const ends = [
            // ✅ CORRECTION: Added elevation_ft to each end
            { ident: runway.le_ident, lat: runway.le_latitude_deg, lon: runway.le_longitude_deg, heading: runway.le_heading_degT, elevation_ft: runway.le_elevation_ft },
            { ident: runway.he_ident, lat: runway.he_latitude_deg, lon: runway.he_longitude_deg, heading: runway.he_heading_degT, elevation_ft: runway.he_elevation_ft }
        ];

        for (const end of ends) {
            if (end.lat == null || end.lon == null) continue;

            const distanceKm = getDistanceKm(aircraftPos.lat, aircraftPos.lon, end.lat, end.lon);

            if (distanceKm < minDistanceKm) {
                minDistanceKm = distanceKm;
                closestRunway = {
                    ...end,
                    airport: airportIcao,
                    distanceNM: distanceKm / 1.852
                };
            }
        }
    }

    // If a close runway was found, calculate the heading difference
    if (closestRunway) {
        let headingDiff = Math.abs(aircraftPos.track_deg - closestRunway.heading);
        if (headingDiff > 180) {
            headingDiff = 360 - headingDiff; // Normalize to the shortest angle
        }
        closestRunway.headingDiff = headingDiff;
    }

    return closestRunway;
}
    
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

    /**
     * Determines the CSS class for manufacturer color-coding based on aircraft name.
     */
    function getAircraftManufacturerClass(aircraftName) {
        if (!aircraftName) return 'aircraft-type-unknown';
        const name = aircraftName.toLowerCase();

        if (name.includes('airbus')) return 'aircraft-type-airbus';
        if (name.includes('boeing')) return 'aircraft-type-boeing';
        if (name.includes('bombardier') || name.includes('crj')) return 'aircraft-type-bombardier';
        if (name.includes('embraer')) return 'aircraft-type-embraer';
        if (name.includes('mcdonnell douglas') || name.includes('md-') || name.includes('dc-')) return 'aircraft-type-mcdonnell-douglas';
        if (name.includes('de havilland') || name.includes('dash')) return 'aircraft-type-de-havilland';
        
        return 'aircraft-type-unknown';
    }

    // crew-center.js (within the DOMContentLoaded event listener)

const populateDispatchPass = (container, plan, options = {}) => {
    if (!container || !plan) return;

    // --- Data Formatters & Converters ---
    const isSimbriefPlan = !!plan.tlr; // Check if TLR data exists (likely Simbrief)
    const lbsToKg = (lbs) => {
        if (isNaN(lbs) || lbs === null) return null;
        return Math.round(Number(lbs) / 2.20462);
    };
    const formatWeightDisplay = (value) => {
        if (isNaN(value) || value === null) return '--- kg';
        // Use lbsToKg only if it's likely a Simbrief plan (using lbs)
        const kgValue = isSimbriefPlan && plan.units === 'lbs' ? lbsToKg(value) : value;
        // Fallback if conversion wasn't needed or failed
        const finalValue = (kgValue !== null) ? kgValue : value;
        return `${Number(finalValue).toLocaleString()} kg`;
    };
    const formatEET = (hoursOrSeconds) => {
        // Handle both seconds (from Simbrief OFP) and hours (manual entry/DB)
        let totalSeconds;
        if (typeof hoursOrSeconds === 'number') {
            // Check if it's likely seconds (large number) or hours (smaller number)
            if (hoursOrSeconds > 1000) { // Arbitrary threshold, adjust if needed
                totalSeconds = hoursOrSeconds;
            } else {
                totalSeconds = Math.round(hoursOrSeconds * 3600);
            }
        } else {
            return '00:00';
        }

        if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const formatSpeed = (kts) => (kts ? `${kts} kts` : '---');

    // --- Performance & Weather Data Extraction ---
    // <<< NEW >>> Get planned runways with fallbacks
    const takeoffRunway = plan.tlr?.takeoff?.conditions?.planned_runway || plan.origin?.plan_rwy || plan.departureRunway || '---';
    const landingRunway = plan.tlr?.landing?.conditions?.planned_runway || plan.destination?.plan_rwy || plan.arrivalRunway || '---';

    const takeoffRunwayData = plan.tlr?.takeoff?.runway?.find(r => r.identifier === takeoffRunway); // Use the determined runway
    const takeoffFlaps = takeoffRunwayData?.flap_setting ?? '---';
    const takeoffThrust = takeoffRunwayData?.thrust_setting ?? '---';
    const takeoffFlexTemp = takeoffRunwayData?.flex_temperature ? `${takeoffRunwayData.flex_temperature}°C` : '---';

    const v1 = takeoffRunwayData?.speeds_v1;
    const vr = takeoffRunwayData?.speeds_vr;
    const v2 = takeoffRunwayData?.speeds_v2;

    const landingFlaps = plan.tlr?.landing?.conditions?.flap_setting ?? '---';
    const landingWeight = formatWeightDisplay(plan.tlr?.landing?.conditions?.planned_weight ?? plan.landingWeight); // Added fallback
    const landingWind = `${plan.tlr?.landing?.conditions?.wind_direction ?? '???'}° @ ${plan.tlr?.landing?.conditions?.wind_speed ?? '?'} kts`;
    const vref = plan.tlr?.landing?.distance_dry?.speeds_vref ?? 0;
    const vrefAdd = vref > 0 ? '+5 kts (min)' : '---';
    const vapp = vref > 0 ? `${parseInt(vref, 10) + 5} kts` : '---';

    // Use already parsed weather if available, otherwise parse raw
    const departureWeather = plan.departureWeatherParsed || (plan.departureWeather ? window.WeatherService.parseMetar(plan.departureWeather) : window.WeatherService.parseMetar(''));
    const arrivalWeather = plan.arrivalWeatherParsed || (plan.arrivalWeather ? window.WeatherService.parseMetar(plan.arrivalWeather) : window.WeatherService.parseMetar(''));


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
                <span class="flight-date">${new Date(plan.etd || Date.now()).toLocaleDateString()}</span>
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
                <div class="summary-item">
                    <label><i class="fa-solid fa-road"></i> Takeoff Rwy</label>
                    <span>${takeoffRunway}</span>
                </div>
                <div class="summary-item">
                    <label><i class="fa-solid fa-road-circle-check"></i> Landing Rwy</label>
                    <span>${landingRunway}</span>
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
                                <h4>Takeoff (${takeoffRunway})</h4> {/* <<< NEW >>> Added runway here */}
                                <div class="data-item"><strong>Flaps:</strong> <span>${takeoffFlaps}</span></div>
                                <div class="data-item"><strong>Thrust:</strong> <span>${takeoffThrust}</span></div>
                                <div class="data-item"><strong>SEL/FLEX Temp:</strong> <span>${takeoffFlexTemp}</span></div>
                                <div class="data-item"><strong>V1:</strong> <span>${formatSpeed(v1)}</span></div>
                                <div class="data-item"><strong>Vr:</strong> <span>${formatSpeed(vr)}</span></div>
                                <div class="data-item"><strong>V2:</strong> <span>${formatSpeed(v2)}</span></div>
                            </div>
                            <div class="perf-card">
                                <h4>Landing (${landingRunway})</h4> {/* <<< NEW >>> Added runway here */}
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
                // We need to wait a tick for the content to potentially become visible
                // before measuring its scrollHeight accurately.
                requestAnimationFrame(() => {
                     content.style.maxHeight = content.scrollHeight + 'px';
                     // Re-plot map if it wasn't visible before
                     const mapContainerId = `dispatch-map-${plan._id}`;
                     const mapContainer = content.querySelector(`#${mapContainerId}`);
                     if (mapContainer && !mapContainer.mapInstance && plan.mapData) {
                          plotDispatchMap(mapContainerId, plan.mapData.origin, plan.mapData.destination, plan.mapData.navlog);
                     }
                });
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

    // Delay map plotting until the container might be visible
    const mapContainerId = `dispatch-map-${plan._id}`;
    const mapContent = container.querySelector(`#${mapContainerId}`)?.closest('.accordion-content');
    const mapAccordionItem = mapContent?.closest('.accordion-item');

    // Plot immediately only if it's the preview or if the accordion is already open
    if (options.isPreview || (mapAccordionItem && mapAccordionItem.classList.contains('active'))) {
        if (plan.mapData && plan.mapData.origin && plan.mapData.destination) {
            // Use setTimeout to ensure the element is in the DOM and sized
            setTimeout(() => {
                plotDispatchMap(mapContainerId, plan.mapData.origin, plan.mapData.destination, plan.mapData.navlog);
            }, 100);
        }
    }
};

// --- Make sure WeatherService is available globally ---
// Add this outside the DOMContentLoaded if it isn't already
if (typeof window.WeatherService === 'undefined') {
    window.WeatherService = {
        parseMetar: (rawMetar) => {
            if (!rawMetar || typeof rawMetar !== 'string') {
                return { condition: 'N/A', temp: '--', wind: '--', raw: 'Not Available' };
            }
            // Basic parsing, replace with a more robust library if needed
            const parts = rawMetar.split(' ');
            let condition = 'Clear';
            let temp = '--';
            let wind = '--';

            parts.forEach(part => {
                if (part.match(/^(FEW|SCT|BKN|OVC)\d+/)) condition = part;
                if (part.match(/^\d{2}\/\d{2}$/)) temp = part.split('/')[0] + '°C';
                if (part.match(/^\d{5}KT$/)) wind = `${part.substring(0, 3)}° @ ${part.substring(3, 5)} kts`;
            });
            return { condition, temp, wind, raw: rawMetar };
        },
        fetchAndParseMetar: async (icao) => {
             if (!icao) return window.WeatherService.parseMetar('');
             try {
                const weatherRes = await fetch(`https://indgo-va.netlify.app/.netlify/functions/weather?icao=${icao}`);
                if (weatherRes.ok) {
                    const weatherData = await weatherRes.json();
                    if (weatherData.data && weatherData.data.length > 0) {
                        return window.WeatherService.parseMetar(weatherData.data[0].raw_text);
                    }
                }
                return window.WeatherService.parseMetar(''); // Fallback on error
             } catch(err) {
                 console.error("Weather fetch failed:", err);
                 return window.WeatherService.parseMetar(''); // Fallback on error
             }
        }
    };
}

    function atcTypeToString(typeId) {
        const types = {
            0: 'Ground', 1: 'Tower', 2: 'Unicom', 3: 'Clearance',
            4: 'Approach', 5: 'Departure', 6: 'Center', 7: 'ATIS',
            8: 'Aircraft', 9: 'Recorded', 10: 'Unknown', 11: 'Unused'
        };
        return types[typeId] || 'Unknown';
    }

    function formatAtcDuration(startTime) {
        if (!startTime) return '';
        const start = new Date(startTime).getTime();
        const now = Date.now();
        const diffMs = Math.max(0, now - start);
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

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
    function createPfdDisplay() {
        const SVG_NS = "http://www.w3.org/2000/svg";
        const attitudeGroup = document.getElementById('attitude_group');
        const speedTapeGroup = document.getElementById('speed_tape_group');
        const altitudeTapeGroup = document.getElementById('altitude_tape_group');
        const tensReelGroup = document.getElementById('altitude_tens_reel_group');
        const headingTapeGroup = document.getElementById('heading_tape_group');

        if (!attitudeGroup || !speedTapeGroup || !altitudeTapeGroup || !tensReelGroup || !headingTapeGroup || attitudeGroup.dataset.initialized) {
            return;
        }

        attitudeGroup.dataset.initialized = 'true'; // Prevent re-initialization

        // --- GENERATION FUNCTIONS (unchanged from your original static function) ---
        function generateAttitudeIndicators() {
            const centerX = 401.5;
            const centerY = 312.5;
            for (let p = -90; p <= 90; p += 2.5) {
                if (p === 0) continue;
                const y = centerY - (p * PFD_PITCH_SCALE);
                const isMajor = (p % 10 === 0);
                const isMinor = (p % 5 === 0);
                if (isMajor || isMinor) {
                    const lineWidth = isMajor ? 80 : 40;
                    const line = document.createElementNS(SVG_NS, 'line');
                    line.setAttribute('x1', centerX - lineWidth / 2);
                    line.setAttribute('x2', centerX + lineWidth / 2);
                    line.setAttribute('y1', y);
                    line.setAttribute('y2', y);
                    line.setAttribute('stroke', 'white');
                    line.setAttribute('stroke-width', 2);
                    attitudeGroup.appendChild(line);
                    if (isMajor) {
                        const textLeft = document.createElementNS(SVG_NS, 'text');
                        textLeft.setAttribute('x', centerX - lineWidth / 2 - 10);
                        textLeft.setAttribute('y', y + 5);
                        textLeft.setAttribute('fill', 'white');
                        textLeft.setAttribute('font-size', '18');
                        textLeft.setAttribute('text-anchor', 'end');
                        textLeft.textContent = Math.abs(p);
                        attitudeGroup.appendChild(textLeft);
                        const textRight = document.createElementNS(SVG_NS, 'text');
                        textRight.setAttribute('x', centerX + lineWidth / 2 + 10);
                        textRight.setAttribute('y', y + 5);
                        textRight.setAttribute('fill', 'white');
                        textRight.setAttribute('font-size', '18');
                        textRight.setAttribute('text-anchor', 'start');
                        textRight.textContent = Math.abs(p);
                        attitudeGroup.appendChild(textRight);
                    }
                }
            }
        }
        function generateSpeedTape() {
            const MIN_SPEED = 0, MAX_SPEED = 999;
            for (let s = MIN_SPEED; s <= MAX_SPEED; s += 5) {
                const yPos = PFD_SPEED_CENTER_Y - (s - PFD_SPEED_REF_VALUE) * PFD_SPEED_SCALE;
                const tick = document.createElementNS(SVG_NS, 'line');
                tick.setAttribute('y1', yPos); tick.setAttribute('y2', yPos);
                tick.setAttribute('stroke', 'white'); tick.setAttribute('stroke-width', '2');
                if (s % 10 === 0) {
                    tick.setAttribute('x1', '67'); tick.setAttribute('x2', '52');
                    const text = document.createElementNS(SVG_NS, 'text');
                    text.setAttribute('x', '37'); text.setAttribute('y', yPos + 5);
                    text.setAttribute('fill', 'white'); text.setAttribute('font-size', '18');
                    text.setAttribute('text-anchor', 'middle'); text.textContent = s;
                    speedTapeGroup.appendChild(text);
                } else {
                    tick.setAttribute('x1', '67'); tick.setAttribute('x2', '60');
                }
                speedTapeGroup.appendChild(tick);
            }
        }
        function generateAltitudeTape() {
            // ✅ FIX: Changed MIN_ALTITUDE from -1000 to 0 to prevent negative numbers on the tape.
            const MIN_ALTITUDE = 0, MAX_ALTITUDE = 50000;
            for (let alt = MIN_ALTITUDE; alt <= MAX_ALTITUDE; alt += 20) {
                const yPos = PFD_ALTITUDE_CENTER_Y - (alt - PFD_ALTITUDE_REF_VALUE) * PFD_ALTITUDE_SCALE;
                const tick = document.createElementNS(SVG_NS, 'line');
                tick.setAttribute('y1', yPos); tick.setAttribute('y2', yPos);
                tick.setAttribute('stroke', 'white'); tick.setAttribute('stroke-width', '2');
                tick.setAttribute('x1', '72');
                if (alt % 100 === 0) {
                    tick.setAttribute('x2', '52');
                    const text = document.createElementNS(SVG_NS, 'text');
                    text.setAttribute('x', '25'); text.setAttribute('y', yPos + 5);
                    text.setAttribute('fill', 'white'); text.setAttribute('font-size', '18');
                    text.setAttribute('text-anchor', 'middle'); text.textContent = alt / 100;
                    altitudeTapeGroup.appendChild(text);
                } else {
                    tick.setAttribute('x2', '62');
                }
                altitudeTapeGroup.appendChild(tick);
            }
        }
        function generateAltitudeTensReel() {
            const center_y = 316;
            for (let i = -5; i < 10; i++) {
                let value = (i * 20); value = (value < 0) ? 100 + (value % 100) : value % 100;
                const displayValue = String(value).padStart(2, '0');
                const yPos = center_y + (i * PFD_REEL_SPACING);
                const text = document.createElementNS(SVG_NS, 'text');
                text.setAttribute('x', '745'); text.setAttribute('y', yPos);
                text.setAttribute('fill', '#00FF00'); text.setAttribute('font-size', '32');
                text.setAttribute('font-weight', 'bold'); text.textContent = displayValue;
                tensReelGroup.appendChild(text);
            }
        }
        function generateHeadingTape() {
            const y_text = 650, y_tick_top = 620, y_tick_bottom_major = 635, y_tick_bottom_minor = 628;
            for (let h = -360; h <= 720; h += 5) {
                const xPos = PFD_HEADING_CENTER_X + (h - PFD_HEADING_REF_VALUE) * PFD_HEADING_SCALE;
                const normalizedH = (h + 360) % 360;
                if (normalizedH % 90 === 0) continue;
                const tick = document.createElementNS(SVG_NS, 'line');
                tick.setAttribute('x1', xPos); tick.setAttribute('x2', xPos);
                tick.setAttribute('stroke', 'white'); tick.setAttribute('stroke-width', '1.5');
                tick.setAttribute('y1', y_tick_top); tick.setAttribute('y2', (h % 10 === 0) ? y_tick_bottom_major : y_tick_bottom_minor);
                headingTapeGroup.appendChild(tick);
            }
            for (let h = 0; h < 360; h += 10) {
                for (let offset of [-360, 0, 360]) {
                    const currentH = h + offset;
                    const xPos = PFD_HEADING_CENTER_X + (currentH - PFD_HEADING_REF_VALUE) * PFD_HEADING_SCALE;
                    const text = document.createElementNS(SVG_NS, 'text');
                    text.setAttribute('x', xPos); text.setAttribute('y', y_text);
                    text.setAttribute('fill', 'white'); text.setAttribute('font-size', '16');
                    text.setAttribute('text-anchor', 'middle');
                    let displayVal = '';
                    switch (h) { case 0: displayVal = 'N'; break; case 90: displayVal = 'E'; break; case 180: displayVal = 'S'; break; case 270: displayVal = 'W'; break; default: if (h % 30 === 0) { displayVal = h / 10; } }
                    if (displayVal !== '') { text.textContent = displayVal; headingTapeGroup.appendChild(text); }
                }
            }
        }
        
        generateAttitudeIndicators();
        generateSpeedTape();
        generateAltitudeTape();
        generateAltitudeTensReel();
        generateHeadingTape();
    }
    
/**
 * Stable PFD update:
 * - Sample-and-hold last turn-rate between API packets (no snap-back).
 * - Linear regression w/ fallback dH/dt, heading unwrap, and EMA smoothing.
 * - Sign stickiness (won’t flip L/R for brief jitters).
 * - Hysteresis + stale logic so roll only decays when data is truly old.
 */
function updatePfdDisplay(pfdData) {
  if (!pfdData) return;

  // ---- tolerate common key names ----
  const gs_kt =
    pfdData.gs_kt ??
    pfdData.groundspeed_kts ??
    pfdData.groundspeed ??
    pfdData.gs ??
    (pfdData.speed && (pfdData.speed.kt || pfdData.speed.kts)) ??
    0;

  const track_deg =
    pfdData.track_deg ??
    pfdData.heading_deg ??
    pfdData.track ??
    pfdData.hdg ??
    0;

  const alt_ft = pfdData.alt_ft ?? pfdData.altitude_ft ?? pfdData.altitude ?? 0;
  const vs_fpm = pfdData.vs_fpm ?? pfdData.vertical_speed_fpm ?? pfdData.vs ?? 0;

  // ---- DOM ----
  const attitudeGroup     = document.getElementById('attitude_group');
  const speedTapeGroup    = document.getElementById('speed_tape_group');
  const altitudeTapeGroup = document.getElementById('altitude_tape_group');
  const tensReelGroup     = document.getElementById('altitude_tens_reel_group');
  const headingTapeGroup  = document.getElementById('heading_tape_group');
  const speedReadout      = document.getElementById('speed_readout');
  const altReadoutHund    = document.getElementById('altitude_readout_hundreds');
  const headingReadout    = document.getElementById('heading_readout');
  if (!attitudeGroup || !speedTapeGroup || !altitudeTapeGroup || !headingTapeGroup || !tensReelGroup) return;

  // ---- tunables ----
  const WINDOW_SEC          = 2.4;   // regression window
  const LATCH_ON_TURN       = 0.20;  // deg/s to latch "turning"
  const LATCH_OFF_TURN      = 0.10;  // deg/s to unlatch
  const LATCH_HOLD_MS       = 400;   // chatter guard
  const MAX_BANK_DEG        = 35;
  const MAX_ROLL_RATE       = 60;    // display slew (deg/s)
  const MIN_GS_FOR_TURN     = 1;
  const PITCH_LIMIT         = 25;

  const DATA_HOLD_MS        = 1400;  // hold last turn-rate after last fresh packet
  const STALE_MS            = 4000;  // after this, allow full decay/unlatch
  const HDG_EPS             = 0.4;   // unwrapped degrees to consider heading "changed"
  const GS_EPS              = 0.5;   // kt change to consider GS "changed"
  const DECAY_TO_LEVEL_DPS  = 12;    // decay when not turning
  const MICRO_DECAY_FACTOR  = 0.25;  // softer decay before STALE_MS

  const EMA_ALPHA           = 0.35;  // EMA smoothing on turn-rate (0..1)
  const SIGN_MIN_DEG        = 3.0;   // min magnitude to accept L/R sign flip
  const SIGN_HOLD_MS        = 250;   // new sign must persist this long

  const now = performance.now();

  // ---- persistent state ----
  if (!window.lastPfdState || typeof window.lastPfdState !== 'object') {
    window.lastPfdState = {
      unwrapped: track_deg,
      lastTime: now,
      buf: [],                  // [{t, hdg}] for fresh samples only
      rollDisp: 0,
      turning: false,
      lastTurnLatchTs: 0,

      // freshness / hold
      lastDataTs: 0,
      lastTurnRate: 0,
      lastRawTrack: track_deg,
      lastRawGs: gs_kt,
      prevUnwrapped: track_deg,

      // smoothing & sign guard
      turnRateEma: 0,
      rollSign: 0,
      lastSignChangeTs: 0
    };
  }
  const S = window.lastPfdState;

  // ---- unwrap heading ----
  let delta = track_deg - (S.unwrapped % 360);
  if (delta > 180)  delta -= 360;
  if (delta < -180) delta += 360;
  const unwrapped = S.unwrapped + delta;

  // ---- detect "fresh" API packet vs. render tick (use unwrapped delta) ----
  const unwrappedDelta = Math.abs(unwrapped - S.unwrapped);
  const isFresh =
    unwrappedDelta > HDG_EPS ||
    Math.abs(gs_kt - S.lastRawGs) > GS_EPS;

  // ---- manage regression buffer (only for fresh samples) ----
  const tNow = now / 1000;
  if (isFresh) {
    S.lastDataTs = now;
    S.lastRawTrack = track_deg;
    S.lastRawGs = gs_kt;
    const cutoff = tNow - WINDOW_SEC;
    S.buf.push({ t: tNow, hdg: unwrapped });
    while (S.buf.length && S.buf[0].t < cutoff) S.buf.shift();
  }

  // ---- turn-rate estimate (deg/s): fresh -> compute; else -> hold previous ----
  let turnRate = S.lastTurnRate;
  if (isFresh) {
    if (S.buf.length >= 3 && gs_kt > MIN_GS_FOR_TURN) {
      // linear regression slope
      const t0 = S.buf[0].t;
      let sumT = 0, sumH = 0, sumTT = 0, sumTH = 0, n = S.buf.length;
      for (let i = 0; i < n; i++) {
        const ti = S.buf[i].t - t0;
        const hi = S.buf[i].hdg;
        sumT  += ti;
        sumH  += hi;
        sumTT += ti * ti;
        sumTH += ti * hi;
      }
      const denom = n * sumTT - sumT * sumT;
      if (denom !== 0) {
        turnRate = (n * sumTH - sumT * sumH) / denom; // deg/s
      } else {
        const dtS = Math.max(0.02, (now - S.lastTime) / 1000);
        turnRate = (unwrapped - S.prevUnwrapped) / dtS;
      }
    } else {
      const dtS = Math.max(0.02, (now - S.lastTime) / 1000);
      turnRate = (unwrapped - S.prevUnwrapped) / dtS;
    }
    S.lastTurnRate = turnRate;
  }

  // ---- EMA smoothing on turn-rate ----
  S.turnRateEma = EMA_ALPHA * turnRate + (1 - EMA_ALPHA) * S.turnRateEma;

  // ---- hysteresis + data-hold for "turning" ----
  const sinceFresh = now - S.lastDataTs;
  const rateAbs    = Math.abs(S.turnRateEma);
  const wasTurning = S.turning;
  const forceTurningByHold = sinceFresh <= DATA_HOLD_MS && Math.abs(S.lastTurnRate) >= LATCH_OFF_TURN;

  if (!wasTurning) {
    if (rateAbs >= LATCH_ON_TURN || forceTurningByHold) {
      S.turning = true;
      S.lastTurnLatchTs = now;
    }
  } else {
    const timeSinceLatch = now - S.lastTurnLatchTs;
    const allowUnlatch = rateAbs < LATCH_OFF_TURN && timeSinceLatch > LATCH_HOLD_MS && sinceFresh > DATA_HOLD_MS;
    if (allowUnlatch && sinceFresh > STALE_MS) {
      S.turning = false;
    } else if (rateAbs >= LATCH_OFF_TURN || forceTurningByHold) {
      S.lastTurnLatchTs = now;
    }
  }

  // ---- coordinated-turn bank target from smoothed rate ----
  const Vms   = Math.max(0, gs_kt) * 0.514444;
  const omega = (S.turnRateEma * Math.PI) / 180; // rad/s
  const bankAbs = Math.atan(Math.abs(omega) * Vms / 9.81) * 180 / Math.PI;
  let targetRoll = (S.turnRateEma >= 0 ? 1 : -1) * Math.min(bankAbs, MAX_BANK_DEG);

  // ---- sign stickiness (prevents brief L/R flips) ----
  const desiredSign = Math.sign(targetRoll);
  if (desiredSign !== 0 && desiredSign !== S.rollSign) {
    const bigEnough = Math.abs(targetRoll) >= SIGN_MIN_DEG;
    const persisted = (now - S.lastSignChangeTs) >= SIGN_HOLD_MS;
    if (bigEnough && persisted) {
      S.rollSign = desiredSign;
      S.lastSignChangeTs = now;
    } else {
      targetRoll = Math.abs(targetRoll) * (S.rollSign || desiredSign);
    }
  } else if (S.rollSign === 0 && desiredSign !== 0) {
    S.rollSign = desiredSign;
    S.lastSignChangeTs = now;
  }

  // ---- when not turning: decay toward level (hold pose before STALE_MS) ----
  if (!S.turning) {
    const dt = Math.max(0.01, (now - S.lastTime) / 1000);
    const base = DECAY_TO_LEVEL_DPS * dt;
    const decayStep = sinceFresh <= STALE_MS ? base * MICRO_DECAY_FACTOR : base;
    targetRoll = (Math.abs(S.rollDisp) <= decayStep) ? 0 : S.rollDisp - Math.sign(S.rollDisp) * decayStep;
  }

  // ---- slew-limit the displayed roll ----
  {
    const dt = Math.max(0.01, (now - S.lastTime) / 1000);
    const maxStep = dt * MAX_ROLL_RATE;
    const diff = targetRoll - S.rollDisp;
    S.rollDisp += Math.abs(diff) > maxStep ? Math.sign(diff) * maxStep : diff;
  }

  // ---- update state timestamps/unwraps ----
  S.unwrapped = unwrapped;
  S.prevUnwrapped = unwrapped;
  S.lastTime = now;

  // ---- pitch from VS ----
  const pitch_deg = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, (vs_fpm / 1000) * 4));

  // ---- global scales (with sane fallbacks) ----
  const PFD_PITCH_SCALE       = window.PFD_PITCH_SCALE ?? 2.0;
  const PFD_SPEED_REF_VALUE   = window.PFD_SPEED_REF_VALUE ?? 0;
  const PFD_SPEED_SCALE       = window.PFD_SPEED_SCALE ?? -0.6;
  // ✅ FIX: Changed fallback value from -0.09 to 0.7 to ensure correct (positive) tape translation.
  const PFD_ALTITUDE_SCALE    = window.PFD_ALTITUDE_SCALE ?? 0.7;
  const PFD_REEL_SPACING      = window.PFD_REEL_SPACING ?? 40;
  const PFD_HEADING_REF_VALUE = window.PFD_HEADING_REF_VALUE ?? 0;
  const PFD_HEADING_SCALE     = window.PFD_HEADING_SCALE ?? 4;

  // ---- apply attitude transform (pitch translate, roll rotate) ----
  const rollForSvg = -S.rollDisp; // SVG rotation sense
  attitudeGroup.setAttribute(
    'transform',
    `translate(0, ${pitch_deg * PFD_PITCH_SCALE}) rotate(${rollForSvg}, 401.5, 312.5)`
  );

  // ---- tapes/readouts ----
  speedReadout.textContent = Math.round(gs_kt);
  const speedYOffset = (gs_kt - PFD_SPEED_REF_VALUE) * PFD_SPEED_SCALE;
  speedTapeGroup.setAttribute('transform', `translate(0, ${speedYOffset})`);

  const altitude = Math.max(0, alt_ft);
  altReadoutHund.textContent = Math.floor(altitude / 100);
  const tapeYOffset = altitude * PFD_ALTITUDE_SCALE;
  altitudeTapeGroup.setAttribute('transform', `translate(0, ${tapeYOffset})`);

  const tensValue = altitude % 100;
  const reelYOffset = -(tensValue / 20) * PFD_REEL_SPACING;
  tensReelGroup.setAttribute('transform', `translate(0, ${reelYOffset})`);

  const hdg = ((Math.round(track_deg) % 360) + 360) % 360;
  headingReadout.textContent = String(hdg).padStart(3, '0');
  const xOffset = -(track_deg - PFD_HEADING_REF_VALUE) * PFD_HEADING_SCALE;
  headingTapeGroup.setAttribute('transform', `translate(${xOffset}, 0)`);
}

    /**
     * --- [NEW] Resets the PFD state and visuals to neutral. ---
     * Call this when selecting a new aircraft to prevent displaying stale data.
     */
    function resetPfdState() {
        // 1. Invalidate the persistent state object.
        //    This forces updatePfdDisplay to re-initialize it on its next run.
        window.lastPfdState = null;

        // 2. Immediately set the core SVG elements to a neutral, "level flight" state.
        const attitudeGroup = document.getElementById('attitude_group');
        const speedReadout = document.getElementById('speed_readout');
        const altReadoutHund = document.getElementById('altitude_readout_hundreds');
        const headingReadout = document.getElementById('heading_readout');
        const speedTapeGroup = document.getElementById('speed_tape_group');
        const altitudeTapeGroup = document.getElementById('altitude_tape_group');
        const headingTapeGroup = document.getElementById('heading_tape_group');

        if (attitudeGroup) {
            // Set to zero pitch translation and zero roll rotation.
            attitudeGroup.setAttribute('transform', 'translate(0, 0) rotate(0, 401.5, 312.5)');
        }
        
        // 3. Clear readouts to avoid showing the last aircraft's data.
        if (speedReadout) speedReadout.textContent = '---';
        if (altReadoutHund) altReadoutHund.textContent = '---';
        if (headingReadout) headingReadout.textContent = '---';

        // 4. Reset tape positions to zero.
        if (speedTapeGroup) speedTapeGroup.setAttribute('transform', 'translate(0, 0)');
        if (altitudeTapeGroup) altitudeTapeGroup.setAttribute('transform', 'translate(0, 0)');
        if (headingTapeGroup) headingTapeGroup.setAttribute('transform', 'translate(0, 0)');
    }


/**
 * --- [REVAMPED] Creates the rich HTML content for the airport information window.
 * This now includes a live weather widget and a tabbed interface.
 */
    async function createAirportInfoWindowHTML(icao) {
        const atcForAirport = activeAtcFacilities.filter(f => f.airportName === icao);
        const notamsForAirport = activeNotams.filter(n => n.airportIcao === icao);
        const routesFromAirport = ALL_AVAILABLE_ROUTES.filter(r => r.departure === icao);

        // Fetch weather
        let weatherHtml = '';
        try {
            const weatherRes = await fetch(`https://indgo-va.netlify.app/.netlify/functions/weather?icao=${icao}`);
            if (weatherRes.ok) {
                const weatherData = await weatherRes.json();
                if (weatherData.data && weatherData.data.length > 0) {
                     const metar = weatherData.data[0];
                     const flightCategory = metar.flight_category || 'N/A';
                     weatherHtml = `
                        <div class="airport-info-weather">
                            <span class="weather-flight-rules flight-rules-${flightCategory.toLowerCase()}">${flightCategory}</span>
                            <div class="weather-details-grid">
                                <span><i class="fa-solid fa-temperature-half"></i> ${metar.temperature?.celsius || '--'}°C</span>
                                <span><i class="fa-solid fa-droplet"></i> ${metar.dewpoint?.celsius || '--'}°C</span>
                                <span><i class="fa-solid fa-wind"></i> ${metar.wind?.degrees || '---'}° @ ${metar.wind?.speed_kts || '--'} kts</span>
                                <span><i class="fa-solid fa-gauge"></i> ${metar.barometer?.hpa || '----'} hPa</span>
                                <span><i class="fa-solid fa-eye"></i> ${metar.visibility?.miles || '--'} SM</span>
                                <span><i class="fa-solid fa-cloud"></i> ${metar.clouds?.[0]?.text || 'Clear'}</span>
                            </div>
                            <code class="metar-code">${metar.raw_text}</code>
                        </div>
                     `;
                }
            }
        } catch (err) {
            console.error(`Could not fetch weather for ${icao}:`, err);
            weatherHtml = '<div class="airport-info-weather"><p>Weather data unavailable.</p></div>';
        }

        // If there's no data at all (besides weather), don't show a popup
        if (atcForAirport.length === 0 && notamsForAirport.length === 0 && routesFromAirport.length === 0) {
            return null;
        }

        let atcHtml = '<p class="muted-text">No active ATC reported.</p>';
        if (atcForAirport.length > 0) {
            atcHtml = `
                <ul class="atc-frequencies">
                    ${atcForAirport.map(f => `
                        <li class="atc-frequency-item">
                            <span class="freq-type">${atcTypeToString(f.type)}:</span>
                            <span class="freq-user">${f.username || 'N/A'}</span>
                            <span class="freq-time">${formatAtcDuration(f.startTime)}</span>
                        </li>
                    `).join('')}
                </ul>
            `;
        }

        let notamsHtml = '<p class="muted-text">No active NOTAMs.</p>';
        if (notamsForAirport.length > 0) {
            notamsHtml = `
                <ul class="notam-list">
                    ${notamsForAirport.map(n => `<li>${n.message}</li>`).join('')}
                </ul>
            `;
        }
        
        let routesHtml = '<p class="muted-text">No departing routes from this airport in our database.</p>';
        if (routesFromAirport.length > 0) {
            routesHtml = `
                <ul class="popup-routes-list">
                    ${routesFromAirport.map(route => {
                        const airlineCode = extractAirlineCode(route.flightNumber);
                        const logoPath = airlineCode ? `Images/vas/${airlineCode}.png` : '';
                        const aircraftInfo = AIRCRAFT_SELECTION_LIST.find(ac => ac.value === route.aircraft);
                        const aircraftName = aircraftInfo ? aircraftInfo.name : route.aircraft;
                        const aircraftImagePath = `Images/planesForCC/${route.aircraft}.png`;
                        
                        const routeDataString = JSON.stringify(route).replace(/'/g, "&apos;");

                        return `
                        <li class="popup-route-item">
                            <div class="route-item-header">
                                <div class="route-item-info">
                                    <img src="${logoPath}" class="route-item-airline-logo" alt="${airlineCode}" onerror="this.style.display='none'">
                                    <div class="route-item-flight-details">
                                        <span class="flight-number">${route.flightNumber}</span>
                                        <span class="destination">to ${route.arrival}</span>
                                    </div>
                                </div>
                                <div class="route-item-actions">
                                     <button class="cta-button plan-flight-from-explorer-btn" data-route='${routeDataString}'>Plan</button>
                                </div>
                            </div>
                            <div class="route-item-footer">
                                <div class="route-item-aircraft-info">
                                    <img src="${aircraftImagePath}" class="route-item-aircraft-img" alt="${aircraftName}" onerror="this.style.display='none'">
                                    <span>${aircraftName}</span>
                                </div>
                                ${getRankBadgeHTML(route.rankUnlock || deduceRankFromAircraftFE(route.aircraft), { showImage: true, imageClass: 'roster-req-rank-badge' })}
                            </div>
                        </li>
                        `;
                    }).join('')}
                </ul>
            `;
        }

        return `
            ${weatherHtml}
            <div class="info-window-tabs">
                <button class="info-tab-btn active" data-tab="airport-routes"><i class="fa-solid fa-route"></i> Routes</button>
                <button class="info-tab-btn" data-tab="airport-atc"><i class="fa-solid fa-headset"></i> ATC</button>
                <button class="info-tab-btn" data-tab="airport-notams"><i class="fa-solid fa-triangle-exclamation"></i> NOTAMs</button>
            </div>
            <div id="airport-routes" class="info-tab-content active" style="padding: 20px;">
                ${routesHtml}
            </div>
            <div id="airport-atc" class="info-tab-content" style="padding: 20px;">
                ${atcHtml}
            </div>
            <div id="airport-notams" class="info-tab-content" style="padding: 20px;">
                ${notamsHtml}
            </div>
        `;
    }

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
            liveFlightsInterval = setInterval(updateLiveFlights, 3000);
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
            const sessionsRes = await fetch('https://site--acars-backend--6dmjph8ltlhv.code.run/if-sessions');
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
                            if (planRes.ok && planJson.ok && Array.isArray(planJson?.plan?.flightPlanItems) && planJson.plan.flightPlanItems.length > 0) {
                                const nextIdx = (typeof planJson?.plan?.nextWaypointIndex === 'number') ? planJson.plan.nextWaypointIndex : 0;
                                const items = Array.isArray(planJson.plan.flightPlanItems) ? planJson.plan.flightPlanItems.slice(nextIdx) : [];
                                const plannedWps = flattenWaypointsFromPlan(items);
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
    
    // NEW: Function to set up event listeners for the Airport Info Window
    function setupAirportWindowEvents() {
        if (!airportInfoWindow || airportInfoWindow.dataset.eventsAttached === 'true') return;

        const closeBtn = document.getElementById('airport-window-close-btn');
        const hideBtn = document.getElementById('airport-window-hide-btn');

        closeBtn.addEventListener('click', () => {
            airportInfoWindow.classList.remove('visible');
            MobileUIHandler.closeActiveWindow();
            airportInfoWindowRecallBtn.classList.remove('visible');
            clearRouteLayers(); // Closing also clears the map routes
            currentAirportInWindow = null;
        });

        hideBtn.addEventListener('click', () => {
            airportInfoWindow.classList.remove('visible');
            if (currentAirportInWindow) {
                airportInfoWindowRecallBtn.classList.add('visible');
                // Trigger animation by adding and removing the class
                airportInfoWindowRecallBtn.classList.add('palpitate');
                setTimeout(() => {
                    airportInfoWindowRecallBtn.classList.remove('palpitate');
                }, 1000); // Duration of 2 palpitations (0.5s each)
            }
        });

        airportInfoWindowRecallBtn.addEventListener('click', () => {
            if (currentAirportInWindow) {
                airportInfoWindow.classList.add('visible');
                airportInfoWindowRecallBtn.classList.remove('visible');
            }
        });

        airportInfoWindow.dataset.eventsAttached = 'true';
    }
    

// --- [MODIFIED] Event listener setup using Event Delegation for new Tabs ---
    function setupAircraftWindowEvents() {
        if (!aircraftInfoWindow || aircraftInfoWindow.dataset.eventsAttached === 'true') return;
    
        aircraftInfoWindow.addEventListener('click', async (e) => {
            const closeBtn = e.target.closest('.aircraft-window-close-btn');
            const hideBtn = e.target.closest('.aircraft-window-hide-btn');
            const tabBtn = e.target.closest('.ac-info-tab-btn'); // <-- NEW: Listen for tab clicks

            // --- [NEW] Tab Switching Logic ---
            if (tabBtn) {
                e.preventDefault();
                const tabId = tabBtn.dataset.tab;
                if (!tabId || tabBtn.classList.contains('active')) {
                    return; // Already on this tab or invalid button
                }

                // Find the main content container relative to the button
                // --- [FIX] The tab bar is no longer inside .unified-display-main-content
                // We need to go up to the main .info-window-content
                const windowContent = tabBtn.closest('.info-window-content');
                if (!windowContent) return;

                // De-activate old tab and pane
                // --- [FIX] Find tabs in the *new* location
                tabBtn.closest('.ac-info-window-tabs').querySelector('.ac-info-tab-btn.active')?.classList.remove('active');
                windowContent.querySelector('.ac-tab-pane.active')?.classList.remove('active');

                // Activate new tab and pane
                tabBtn.classList.add('active');
                const newPane = windowContent.querySelector(`#${tabId}`);
                
                if (newPane) {
                    newPane.classList.add('active');
                }

                // Check if we need to lazy-load the Pilot Report data
                if (tabId === 'ac-tab-pilot-report') {
                    const statsDisplay = newPane.querySelector('#pilot-stats-display');

                    // ======================================================
                    // --- [BUG FIX] ---
                    // Changed check from !statsDisplay.hasChildNodes() to
                    // statsDisplay.innerHTML.trim() === ''
                    // This prevents whitespace in the template from breaking
                    // the lazy-load.
                    // ======================================================
                    if (statsDisplay && statsDisplay.innerHTML.trim() === '') { 
                        const userId = tabBtn.dataset.userId;
                        const username = tabBtn.dataset.username;
                        if (userId) {
                            // This function will fetch data and populate #pilot-stats-display
                            await displayPilotStats(userId, username); 
                        }
                    }
                }
            }

            // --- Original Close/Hide Logic (Unchanged) ---
            if (closeBtn) {
                aircraftInfoWindow.classList.remove('visible');
                MobileUIHandler.closeActiveWindow();
                aircraftInfoWindowRecallBtn.classList.remove('visible');
                clearLiveFlightPath(currentFlightInWindow);
                if (activePfdUpdateInterval) clearInterval(activePfdUpdateInterval);
                activePfdUpdateInterval = null;
                currentFlightInWindow = null;
                cachedFlightDataForStatsView = { flightProps: null, plan: null };
            }
    
            if (hideBtn) {
                aircraftInfoWindow.classList.remove('visible');
                if (activePfdUpdateInterval) clearInterval(activePfdUpdateInterval);
                activePfdUpdateInterval = null;
                if (currentFlightInWindow) {
                    aircraftInfoWindowRecallBtn.classList.add('visible', 'palpitate');
                    setTimeout(() => aircraftInfoWindowRecallBtn.classList.remove('palpitate'), 1000);
                }
            }

            // --- [REMOVED] Old button logic for statsBtn and backBtn ---
        });
    
        // The recall button logic remains the same.
        aircraftInfoWindowRecallBtn.addEventListener('click', () => {
            if (currentFlightInWindow) {
                const layer = sectorOpsMap.getLayer('sector-ops-live-flights-layer');
                if (layer) {
                    const source = sectorOpsMap.getSource('sector-ops-live-flights-source');
                    const features = source._data.features;
                    const feature = features.find(f => f.properties.flightId === currentFlightInWindow);
                    if (feature) {
                        const props = feature.properties;
                        const flightProps = { ...props, position: JSON.parse(props.position) };
                        
                        fetch('https://site--acars-backend--6dmjph8v.code.run/if-sessions').then(res => res.json()).then(data => {
                            const expertSession = data.sessions.find(s => s.name.toLowerCase().includes('expert'));
                            if(expertSession) {
                                handleAircraftClick(flightProps, expertSession.id);
                            }
                        });
                    }
                }
            }
        });
        
        aircraftInfoWindow.dataset.eventsAttached = 'true';
    }


    /**
     * Main orchestrator for the Sector Ops view.
     * Manages fetching data and orchestrating map and list updates.
     */
    async function initializeSectorOpsView() {
        const selector = document.getElementById('departure-hub-selector');
        const mapContainer = document.getElementById('sector-ops-map-fullscreen');
        const viewContainer = document.getElementById('view-rosters'); // The main view container
        if (!selector || !mapContainer) return;

        mainContentLoader.classList.add('active');

        try {
            // Create and inject the Info Windows and their recall buttons into the main view container
            if (!document.getElementById('airport-info-window')) {
                const windowHtml = `
                    <div id="airport-info-window" class="info-window">
                        <div class="info-window-header">
                            <h3 id="airport-window-title"></h3>
                            <div class="info-window-actions">
                                <button id="airport-window-hide-btn" title="Hide"><i class="fa-solid fa-compress"></i></button>
                                <button id="airport-window-close-btn" title="Close"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        </div>
                        <div id="airport-window-content" class="info-window-content"></div>
                    </div>
                `;
                viewContainer.insertAdjacentHTML('beforeend', windowHtml);
            }
            if (!document.getElementById('aircraft-info-window')) {
                 const windowHtml = `
                    <div id="aircraft-info-window" class="info-window">
                        
                    </div>
                `;
                viewContainer.insertAdjacentHTML('beforeend', windowHtml);
            }
            
            const toolbarToggleBtn = document.getElementById('toolbar-toggle-panel-btn');
            if (toolbarToggleBtn) {
                 if (!document.getElementById('airport-recall-btn')) {
                    toolbarToggleBtn.parentElement.insertAdjacentHTML('beforeend', `
                        <button id="airport-recall-btn" class="toolbar-btn" title="Show Airport Info">
                            <i class="fa-solid fa-location-dot"></i>
                        </button>
                    `);
                 }
                 if (!document.getElementById('aircraft-recall-btn')) {
                      toolbarToggleBtn.parentElement.insertAdjacentHTML('beforeend', `
                        <button id="aircraft-recall-btn" class="toolbar-btn" title="Show Aircraft Info">
                            <i class="fa-solid fa-plane-up"></i>
                        </button>
                    `);
                 }
            }
            
            airportInfoWindow = document.getElementById('airport-info-window');
            airportInfoWindowRecallBtn = document.getElementById('airport-recall-btn');
            aircraftInfoWindow = document.getElementById('aircraft-info-window');
            aircraftInfoWindowRecallBtn = document.getElementById('aircraft-recall-btn');


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

            // 4. Fetch data for both tabs in parallel
            const [rosters, routes] = await Promise.all([
                fetchAndRenderRosters(selectedHub),
                fetchAndRenderRoutes()
            ]);
            ALL_AVAILABLE_ROUTES = routes; // Store all routes for later use

            // *** FIX APLIED HERE ***
            // Immediately render markers with the static route data to prevent blank map on view switch
            renderAirportMarkers();

            // 5. Set up all event listeners
            setupSectorOpsEventListeners();
            setupAirportWindowEvents();
            setupAircraftWindowEvents(); // NEW

            // 6. Start the live data loop.
            startSectorOpsLiveLoop();

        } catch (error) {
            console.error("Error initializing Sector Ops view:", error);
            showNotification(error.message, 'error');
            document.getElementById('roster-list-container').innerHTML = `<p class="error-text">${error.message}</p>`;
            document.getElementById('route-list-container').innerHTML = `<p class="error-text">${error.message}</p>`;
        } finally {
            mainContentLoader.classList.remove('active');
        }
    }

// [REPLACE THIS FUNCTION]
// ⬇️ MODIFIED: This function is modified to load 21 icons (regular, member, staff)
// and use a 'case' expression to select the correct icon.
async function initializeSectorOpsMap(centerICAO) {
    if (!MAPBOX_ACCESS_TOKEN) {
        document.getElementById('sector-ops-map-fullscreen').innerHTML = '<p class="map-error-msg">Map service not available.</p>';
        return;
    }
    if (sectorOpsMap) sectorOpsMap.remove();

    const centerCoords = airportsData[centerICAO] ? [airportsData[centerICAO].lon, airportsData[centerICAO].lat] : [77.2, 28.6];

    sectorOpsMap = new mapboxgl.Map({
        container: 'sector-ops-map-fullscreen',
        style: 'mapbox://styles/mapbox/dark-v11',
        center: centerCoords,
        zoom: 4.5,
        interactive: true,
        // ⬇️ === RECOMMENDED RENDERING FIX ===
        projection: 'globe' 
        // ⬆️ === END OF RECOMMENDED RENDERING FIX ===
    });

    // --- [NEW] Set globe-specific settings on style load ---
    sectorOpsMap.on('style.load', () => {
        sectorOpsMap.setFog({
            color: 'rgb(186, 210, 235)', // Lower atmosphere
            'high-color': 'rgb(36, 92, 223)', // Upper atmosphere
            'horizon-blend': 0.02, // Smooth blend
            'space-color': 'rgb(11, 11, 25)', // Space color
            'star-intensity': 0.6 // Adjust star intensity
        });
    });

    return new Promise(resolve => {
        sectorOpsMap.on('load', () => {
            // ⬇️ === MODIFIED: Load all 21 icon variations === ⬇️
            const iconsToLoad = [
                // Regular
                { id: 'icon-jumbo', path: '/Images/map_icons/jumbo.png' },
                { id: 'icon-widebody', path: '/Images/map_icons/widebody.png' },
                { id: 'icon-narrowbody', path: '/Images/map_icons/narrowbody.png' },
                { id: 'icon-regional', path: '/Images/map_icons/regional.png' },
                { id: 'icon-private', path: '/Images/map_icons/private.png' },
                { id: 'icon-fighter', path: '/Images/map_icons/fighter.png' },
                { id: 'icon-default', path: '/Images/map_icons/default.png' },
                // Members
                { id: 'icon-jumbo-member', path: '/Images/map_icons/members/jumbo.png' },
                { id: 'icon-widebody-member', path: '/Images/map_icons/members/widebody.png' },
                { id: 'icon-narrowbody-member', path: '/Images/map_icons/members/narrowbody.png' },
                { id: 'icon-regional-member', path: '/Images/map_icons/members/regional.png' },
                { id: 'icon-private-member', path: '/Images/map_icons/members/private.png' },
                { id: 'icon-fighter-member', path: '/Images/map_icons/members/fighter.png' },
                { id: 'icon-default-member', path: '/Images/map_icons/members/default.png' },
                // Staff
                { id: 'icon-jumbo-staff', path: '/Images/map_icons/staff/jumbo.png' },
                { id: 'icon-widebody-staff', path: '/Images/map_icons/staff/widebody.png' },
                { id: 'icon-narrowbody-staff', path: '/Images/map_icons/staff/narrowbody.png' },
                { id: 'icon-regional-staff', path: '/Images/map_icons/staff/regional.png' },
                { id: 'icon-private-staff', path: '/Images/map_icons/staff/private.png' },
                { id: 'icon-fighter-staff', path: '/Images/map_icons/staff/fighter.png' },
                { id: 'icon-default-staff', path: '/Images/map_icons/staff/default.png' }
            ];
            // ⬆️ === END OF MODIFICATION === ⬆️

            const imagePromises = iconsToLoad.map(icon =>
                new Promise((res, rej) => {
                    sectorOpsMap.loadImage(icon.path, (error, image) => {
                        if (error) {
                            console.warn(`Could not load icon: ${icon.path}`);
                            rej(error);
                        } else {
                            if (!sectorOpsMap.hasImage(icon.id)) {
                                sectorOpsMap.addImage(icon.id, image);
                            }
                            res();
                        }
                    });
                })
            );

            // --- [MODIFIED] Set up layers after icons are loaded ---
            Promise.all(imagePromises).then(() => {
                console.log('All custom aircraft icons loaded.');

                // --- [NEW] Create the source and layer ONCE with empty data ---
                if (!sectorOpsMap.getSource('sector-ops-live-flights-source')) {
                    sectorOpsMap.addSource('sector-ops-live-flights-source', {
                        type: 'geojson',
                        // Start with an empty collection
                        data: { type: 'FeatureCollection', features: [] }
                    });

                    sectorOpsMap.addLayer({
                        id: 'sector-ops-live-flights-layer',
                        type: 'symbol',
                        source: 'sector-ops-live-flights-source',
                        layout: {
                            // ⬇️ === MODIFIED: Use 'case' expression for icon logic === ⬇️
                            'icon-image': [
                                'case',
                                // Condition 1: Is Staff?
                                ['==', ['get', 'isStaff'], true],
                                [ // Result: Use Staff icons
                                    'match',
                                    ['get', 'category'],
                                    'jumbo', 'icon-jumbo-staff',
                                    'widebody', 'icon-widebody-staff',
                                    'narrowbody', 'icon-narrowbody-staff',
                                    'regional', 'icon-regional-staff',
                                    'private', 'icon-private-staff',
                                    'fighter', 'icon-fighter-staff',
                                    'icon-default-staff' // Staff fallback
                                ],
                                // Condition 2: Is Member?
                                ['==', ['get', 'isVAMember'], true],
                                [ // Result: Use Member icons
                                    'match',
                                    ['get', 'category'],
                                    'jumbo', 'icon-jumbo-member',
                                    'widebody', 'icon-widebody-member',
                                    'narrowbody', 'icon-narrowbody-member',
                                    'regional', 'icon-regional-member',
                                    'private', 'icon-private-member',
                                    'fighter', 'icon-fighter-member',
                                    'icon-default-member' // Member fallback
                                ],
                                // Default: Use Regular icons
                                [
                                    'match',
                                    ['get', 'category'],
                                    'jumbo', 'icon-jumbo',
                                    'widebody', 'icon-widebody',
                                    'narrowbody', 'icon-narrowbody',
                                    'regional', 'icon-regional',
                                    'private', 'icon-private',
                                    'fighter', 'icon-fighter',
                                    'icon-default' // Regular fallback
                                ]
                            ],
                            // ⬆️ === END OF MODIFICATION === ⬆️
                            'icon-size': 0.08,
                            'icon-rotate': ['get', 'heading'],
                            'icon-rotation-alignment': 'map',
                            'icon-allow-overlap': true,
                            'icon-ignore-placement': true
                        }
                    });

                    // Set up the click/hover event listeners ONCE
                    sectorOpsMap.on('click', 'sector-ops-live-flights-layer', (e) => {
                        const props = e.features[0].properties;
                        const flightProps = { ...props, position: JSON.parse(props.position), aircraft: JSON.parse(props.aircraft) };
                        fetch('https://site--acars-backend--6dmjph8ltlhv.code.run/if-sessions').then(res => res.json()).then(data => {
                            const expertSession = data.sessions.find(s => s.name.toLowerCase().includes('expert'));
                            if (expertSession) {
                                handleAircraftClick(flightProps, expertSession.id);
                            }
                        });
                    });
                    sectorOpsMap.on('mouseenter', 'sector-ops-live-flights-layer', () => { sectorOpsMap.getCanvas().style.cursor = 'pointer'; });
                    sectorOpsMap.on('mouseleave', 'sector-ops-live-flights-layer', () => { sectorOpsMap.getCanvas().style.cursor = ''; });
                }

                resolve(); // Resolve the main promise
            }).catch(error => {
                console.error('Failed to load aircraft icons, flight layer not added.', error);
                resolve(); // Still resolve so the app doesn't hang
            });
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

    // NEW: Helper to clear the live flight trail from the map
    function clearLiveFlightPath(flightId) {
        if (!sectorOpsMap || !flightId) return;

        const flownLayerId = `flown-path-${flightId}`;

        if (sectorOpsMap.getLayer(flownLayerId)) sectorOpsMap.removeLayer(flownLayerId);
        if (sectorOpsMap.getSource(flownLayerId)) sectorOpsMap.removeSource(flownLayerId);
        
        delete sectorOpsLiveFlightPathLayers[flightId];
    }


    /**
     * --- [MODIFIED] Centralized handler for clicking any airport marker.
     * This now opens the persistent info window instead of a popup.
     */
    async function handleAirportClick(icao) {
        if (currentAirportInWindow && currentAirportInWindow !== icao) {
            airportInfoWindow.classList.remove('visible');
            airportInfoWindowRecallBtn.classList.remove('visible');
            clearRouteLayers();
        }

        plotRoutesFromAirport(icao);

        const airport = airportsData[icao];
        if (!airport) return;

        const titleEl = document.getElementById('airport-window-title');
        const contentEl = document.getElementById('airport-window-content');
        
        titleEl.innerHTML = `${icao} <small>- ${airport.name || 'Airport'}</small>`;
        contentEl.innerHTML = `<div class="spinner-small" style="margin: 2rem auto;"></div>`; // Loading state
        
        MobileUIHandler.openWindow(airportInfoWindow);
        airportInfoWindow.classList.add('visible');
        airportInfoWindowRecallBtn.classList.remove('visible');
        currentAirportInWindow = icao;

        const windowContentHTML = await createAirportInfoWindowHTML(icao);

        if (windowContentHTML) {
            contentEl.innerHTML = windowContentHTML;
            contentEl.scrollTop = 0;

            // Add event listeners for the new tabs
            const tabContainer = contentEl.querySelector('.info-window-tabs');
            tabContainer.addEventListener('click', (e) => {
                const tabBtn = e.target.closest('.info-tab-btn');
                if (!tabBtn) return;
                
                tabContainer.querySelector('.active').classList.remove('active');
                contentEl.querySelector('.info-tab-content.active').classList.remove('active');

                tabBtn.classList.add('active');
                contentEl.querySelector(`#${tabBtn.dataset.tab}`).classList.add('active');
            });
        } else {
             airportInfoWindow.classList.remove('visible');
             currentAirportInWindow = null;
        }
    }

    /**
 * --- [NEW HELPER FUNCTION FOR WAYPOINT FIX] ---
 * Recursively flattens the nested flightPlanItems from the SimBrief API plan
 * into a single, clean array of the full waypoint *objects*.
 * @param {Array} items - The flightPlanItems array from the API response.
 * @returns {Array<object>} A flat array of waypoint objects.
 */
function getFlatWaypointObjects(items) {
    const waypoints = [];
    if (!Array.isArray(items)) return waypoints;

    const extract = (planItems) => {
        for (const item of planItems) {
            // If an item is a container for a procedure (like a SID/STAR),
            // ignore its own object and process its children instead.
            if (Array.isArray(item.children) && item.children.length > 0) {
                extract(item.children);
            } 
            // Otherwise, if it's a simple waypoint, add its object.
            else if (item.location && typeof item.location.longitude === 'number' && typeof item.location.latitude === 'number' && (item.location.latitude !== 0 || item.location.longitude !== 0)) {
                waypoints.push(item); // Push the whole object
            }
        }
    };

    extract(items);
    return waypoints;
}
    
    /**
     * --- [FIXED HELPER] ---
     * Recursively flattens the nested flightPlanItems from the SimBrief API plan
     * into a single, clean array of [longitude, latitude] coordinates.
     * This version correctly handles nested procedures like SIDs and STARs.
     * @param {Array} items - The flightPlanItems array from the API response.
     * @returns {Array<[number, number]>} A flat array of coordinates.
     */
    function flattenWaypointsFromPlan(items) {
        const waypoints = [];
        if (!Array.isArray(items)) return waypoints;

        const extract = (planItems) => {
            for (const item of planItems) {
                // If an item is a container for a procedure (like a SID/STAR),
                // ignore its own coordinates and process its children instead.
                if (Array.isArray(item.children) && item.children.length > 0) {
                    extract(item.children);
                } 
                // Otherwise, if it's a simple waypoint, add its coordinates.
                else if (item.location && typeof item.location.longitude === 'number' && typeof item.location.latitude === 'number' && (item.location.latitude !== 0 || item.location.longitude !== 0)) {
                    waypoints.push([item.location.longitude, item.location.latitude]);
                }
            }
        };

        extract(items);
        return waypoints;
    }



// This function fixes the "incorrect plot" by sorting the /route data
// by timestamp before mapping it. It also removes the densifyRoute
// function, as the 'globe' projection handles curves automatically.
async function handleAircraftClick(flightProps, sessionId) {
    if (!flightProps || !flightProps.flightId) return;

    // [RESILIENCE] Prevent new clicks if one is already loading
    if (isAircraftWindowLoading) {
        console.warn("Aircraft click ignored: window is already loading.");
        return;
    }

    // [ORIGINAL] Prevent re-opening an already open window.
    if (currentFlightInWindow === flightProps.flightId && aircraftInfoWindow.classList.contains('visible')) {
        return;
    }

    // [RESILIENCE] Set loading flag *after* initial checks
    isAircraftWindowLoading = true;

    // [RESILIENCE & CRITICAL] Always clear any existing interval *first*.
    if (activePfdUpdateInterval) {
        clearInterval(activePfdUpdateInterval);
        activePfdUpdateInterval = null;
    }

    resetPfdState();

    // [ORIGINAL] Clear previous flight's path
    if (currentFlightInWindow && currentFlightInWindow !== flightProps.flightId) {
        clearLiveFlightPath(currentFlightInWindow);
    }

    currentFlightInWindow = flightProps.flightId; // Set state
    cachedFlightDataForStatsView = { flightProps: null, plan: null }; // Clear cache

    // [ORIGINAL] Show loading state
    if (window.MobileUIHandler && window.MobileUIHandler.isMobile()) {
        window.MobileUIHandler.openWindow(aircraftInfoWindow);
    } else {
        aircraftInfoWindow.classList.add('visible');
    }
    aircraftInfoWindowRecallBtn.classList.remove('visible');
    
    const windowEl = document.getElementById('aircraft-info-window');
    windowEl.innerHTML = `<div class="spinner-small" style="margin: 2rem auto;"></div><p style="text-align: center;">Loading flight data...</p>`;

    try {
        const [planRes, routeRes] = await Promise.all([
            fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}/${flightProps.flightId}/plan`),
            fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}/${flightProps.flightId}/route`)
        ]);
        
        const planData = planRes.ok ? await planRes.json() : null;
        const plan = (planData && planData.ok) ? planData.plan : null;
        const routeData = routeRes.ok ? await routeRes.json() : null;
        
        // --- [MODIFIED] ---
        // Get the *initial* sorted route points for the first render
        let sortedRoutePoints = [];
        if (routeData && routeData.ok && Array.isArray(routeData.route) && routeData.route.length > 0) {
            sortedRoutePoints = routeData.route.sort((a, b) => {
                const timeA = a.date ? new Date(a.date).getTime() : 0;
                const timeB = b.date ? new Date(b.date).getTime() : 0;
                return timeA - timeB;
            });
        }
        // --- [END MODIFIED] ---

        // NEW: Cache data for stats view
        cachedFlightDataForStatsView = { flightProps, plan };
        
        // --- [MODIFIED] ---
        // Pass the *initial* historical route data to the info window builder
        populateAircraftInfoWindow(flightProps, plan, sortedRoutePoints);

        const currentPosition = [flightProps.position.lon, flightProps.position.lat];
        const flownLayerId = `flown-path-${flightProps.flightId}`;
        let allCoordsForBounds = [currentPosition];

        // ⬇️ === START OF DATA PLOTTING FIX ===
        let historicalRoute = [];
        // --- [MODIFIED] Use the pre-sorted 'sortedRoutePoints' ---
        if (sortedRoutePoints.length > 0) {
            // 2. Now map the (chronologically sorted) points to [lon, lat]
            historicalRoute = sortedRoutePoints.map(p => [p.longitude, p.latitude]);
        }
        // ⬆️ === END OF DATA PLOTTING FIX ===
        
        if (historicalRoute.length > 0) {
            
            // The map projection is now 'globe', so we no longer need densifyRoute.
            // We just use the original (but now sorted) sparse points.
            const completeFlownPath = [...historicalRoute, currentPosition];
            
            // Use the sorted, non-densified path for calculating the map bounds
            allCoordsForBounds.push(...historicalRoute);

            if (!sectorOpsMap.getSource(flownLayerId)) {
                sectorOpsMap.addSource(flownLayerId, {
                    type: 'geojson',
                    data: { 
                        type: 'Feature', 
                        geometry: { 
                            type: 'LineString', 
                            // Use the sorted, non-densified path
                            coordinates: completeFlownPath 
                        } 
                    }
                });
                sectorOpsMap.addLayer({
                    id: flownLayerId,
                    type: 'line',
                    source: flownLayerId,
                    paint: { 'line-color': '#00b894', 'line-width': 4, 'line-opacity': 0.9 }
                }, 'sector-ops-live-flights-layer');
            }

            // --- Store the layer ID and the coordinates array for future updates ---
            sectorOpsLiveFlightPathLayers[flightProps.flightId] = {
                flown: flownLayerId,
                coordinates: completeFlownPath // Store the sorted path
            };
        }
        
        if (allCoordsForBounds.length > 1) {
            const bounds = allCoordsForBounds.reduce((b, coord) => b.extend(coord), new mapboxgl.LngLatBounds(allCoordsForBounds[0], allCoordsForBounds[0]));
            sectorOpsMap.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 1000 });
        }
        
        // --- [MODIFIED] ---
        // The interval will NOW re-fetch the route data on every tick.
        activePfdUpdateInterval = setInterval(async () => {
            try {
                // --- [NEW] Fetch both live position AND route history in parallel ---
                const [freshDataRes, routeRes] = await Promise.all([
                    fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}`), // Live position
                    fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}/${flightProps.flightId}/route`) // Route history
                ]);

                if (!freshDataRes.ok) throw new Error("Flight data update failed.");
                
                const allFlights = await freshDataRes.json();
                const updatedFlight = allFlights.flights.find(f => f.flightId === flightProps.flightId);

                // --- [NEW] Process the freshly fetched route data ---
                let updatedSortedRoutePoints = [];
                if (routeRes.ok) {
                    const routeData = await routeRes.json();
                    if (routeData && routeData.ok && Array.isArray(routeData.route) && routeData.route.length > 0) {
                        updatedSortedRoutePoints = routeData.route.sort((a, b) => {
                            const timeA = a.date ? new Date(a.date).getTime() : 0;
                            const timeB = b.date ? new Date(b.date).getTime() : 0;
                            return timeA - timeB;
                        });
                    }
                }
                // --- [END NEW] ---

                if (updatedFlight && updatedFlight.position) {
                    // --- Logic to update the info window (Unchanged) ---
                    updatePfdDisplay(updatedFlight.position);
                    
                    // --- [MODIFIED] ---
                    // Pass the NEWLY fetched historical data
                    updateAircraftInfoWindow(updatedFlight, plan, updatedSortedRoutePoints);
                    
                    // --- [START OF USER MODIFICATION] ---
                    // Map icon and trail updates are handled globally.
                    // --- [END OF USER MODIFICATION] ---

                } else {
                    // Flight no longer found, stop the interval
                    clearInterval(activePfdUpdateInterval);
                    activePfdUpdateInterval = null;
                }
            } catch (error) {
                console.error("Stopping PFD update due to error:", error);
                clearInterval(activePfdUpdateInterval);
                activePfdUpdateInterval = null;
            }
        }, 3000);

        // [RESILIENCE] Unset loading flag on success
        isAircraftWindowLoading = false;

    } catch (error) {
        console.error("Error fetching or plotting aircraft details:", error);
        windowEl.innerHTML = `<p class="error-text" style="padding: 2rem;">Could not retrieve complete flight details. The aircraft may have landed or disconnected.</p>`;
        
        // [RESILIENCE & CRITICAL] Reset state on failure
        isAircraftWindowLoading = false; 
        currentFlightInWindow = null; 
        cachedFlightDataForStatsView = { flightProps: null, plan: null };
    }
}



/**
 * --- [REDESIGNED & UPDATED] Generates the "Unified Flight Display" with image overlay and aircraft type.
 * --- [MODIFIED] Replaced data list with Vertical Situation Display (VSD)
 * --- [MODIFIED v3] Added PFD Footer Panel
 * --- [MODIFIED v5] Implemented (USER REQUEST) (PFD | Data) over (VSD) layout
 * --- [MODIFIED v6] Implemented (USER REQUEST) Tab-based navigation
 * --- [MODIFIED v7] Fixed tab bar position and icon
 * --- [MODIFIED v8] Added Donut Chart and Odometer
 * --- [MODIFIED v9] Redesigned PFD data layout into "Flight Data Computer" (FDC)
 */
function populateAircraftInfoWindow(baseProps, plan, sortedRoutePoints) { // <-- MODIFIED: Added 3rd arg
    const windowEl = document.getElementById('aircraft-info-window');

    // --- Get Aircraft & Route Data ---
    const aircraftName = baseProps.aircraft?.aircraftName || 'Unknown Type';
    const airlineName = baseProps.aircraft?.liveryName || 'Generic Livery';

    const allWaypoints = [];
    if (plan && plan.flightPlanItems) {
        const extractWps = (items) => {
            for (const item of items) {
                if (item.location && (item.location.latitude !== 0 || item.location.longitude !== 0)) { allWaypoints.push(item); }
                if (Array.isArray(item.children)) { extractWps(item.children); }
            }
        };
        extractWps(plan.flightPlanItems);
    }
    const hasPlan = allWaypoints.length >= 2;
    const departureIcao = hasPlan ? allWaypoints[0]?.name : 'N/A';
    const arrivalIcao = hasPlan ? allWaypoints[allWaypoints.length - 1]?.name : 'N/A';

    // --- [NEW] Get Airline Logo (REVISED with new rules) ---
    const liveryName = baseProps.aircraft?.liveryName || '';
    const words = liveryName.trim().split(/\s+/); // Split by one or more spaces
    let logoName = '';
    const specialCharRegex = /[^a-zA-Z0-9]/; // Regex to find any non-alphanumeric character

    if (words.length === 1) {
        // Rule 2: Only one thing, take it. (e.g., "Generic")
        logoName = words[0];
    } else if (words.length > 1) {
        const firstWord = words[0];
        const secondWord = words[1];

        // Rule 3: Check if the second word contains special characters (e.g., "(6E)")
        if (specialCharRegex.test(secondWord)) {
            // It's a special word, so "just keep the first thing"
            logoName = firstWord; // e.g., "IndiGo"
        } else {
            // Rule 1: Second word is clean, take the first two. (e.g., "El Al", "Delta Air")
            logoName = `${firstWord} ${secondWord}`;
        }
    }

    // Sanitize the final result for the filename
    const sanitizedLogoName = logoName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove any remaining special chars
        .replace(/\s+/g, '_'); // Replace spaces with underscores

    // The path is still 'Images/airline_logos/'
    const logoPath = sanitizedLogoName ? `Images/airline_logos/${sanitizedLogoName}.png` : '';
    const logoHtml = logoPath ? `<img src="${logoPath}" alt="${liveryName}" class="ac-header-logo" onerror="this.style.display='none'">` : '';
    // --- End [NEW] ---

    // --- Set Aircraft Image (Handled by updateAircraftInfoWindow) ---
    // We set a temporary background
    const tempBg = `background-image: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('/CommunityPlanes/default.png');`;

    windowEl.innerHTML = `
    <div class="info-window-content">
        <div class="aircraft-overview-panel" id="ac-overview-panel" style="${tempBg}">
            
            <div class="overview-actions">
                <button class="aircraft-window-hide-btn" title="Hide"><i class="fa-solid fa-compress"></i></button>
                <button class="aircraft-window-close-btn" title="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div class="overview-content">
                <div class="overview-col-left">
                    <h3 id="ac-header-callsign">${logoHtml}${baseProps.callsign}</h3>
                    
                    <p id="ac-header-subtext-container">
                        <span class="ac-header-subtext" id="ac-header-username">${baseProps.username || 'N/A'}</span>
                        <span class="ac-header-subtext" id="ac-header-actype">${aircraftName}</span>
                    </p>
                </div>
                <div class="overview-col-right">
                    <span class="route-icao" id="ac-header-dep">${departureIcao}</span>
                    <span class="route-icao" id="ac-header-arr">${arrivalIcao}</span>
                </div>
            </div>

            <div class="route-summary-overlay">
                <span class="icao" id="ac-bar-dep">${departureIcao}</span>
                <div class="route-progress-container">
                    <div class="route-progress-bar-container">
                        <div class="progress-bar-fill" id="ac-progress-bar"></div>
                    </div>
                    <div class="flight-phase-indicator" id="ac-phase-indicator">ENROUTE</div>
                </div>
                <span class="icao" id="ac-bar-arr">${arrivalIcao}</span>
            </div>
        </div>

        <div class="ac-info-window-tabs">
            <button class="ac-info-tab-btn active" data-tab="ac-tab-flight-data">
                <i class="fa-solid fa-gauge-high"></i> Flight Display
            </button>
            <button class="ac-info-tab-btn" data-tab="ac-tab-pilot-report" data-user-id="${baseProps.userId}" data-username="${baseProps.username || 'N/A'}">
                <i class="fa-solid fa-chart-simple"></i> Pilot Report
            </button>
        </div>
        <div class="unified-display-main-content">
            
            <div id="ac-tab-flight-data" class="ac-tab-pane active">

                <div class="fdc-layout-grid">
                    
                    <div class="fdc-pfd-panel">
                        <div id="pfd-container" class="fdc-pfd-instrument">
                            <svg width="787" height="635" viewBox="0 30 787 665" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g id="PFD" clip-path="url(#clip0_1_2890)">
                                <g id="attitude_group">
                                    <rect id="Sky" x="-186" y="-222" width="1121" height="532" fill="#0596FF"/>
                                    <rect id="Ground" x="-138" y="307" width="1024" height="527" fill="#9A4710"/>
                                    </g>
                                <rect id="Rectangle 1" x="-6" y="5" width="191" height="566" fill="#030309"/>
                                <rect id="Rectangle 9" x="609" width="185" height="566" fill="#030309"/>
                                <path id="Rectangle 2" d="M273.905 84.9424L180.983 183.181L-23 -9.76114L69.9218 -108L273.905 84.9424Z" fill="#030309"/>
                                <path id="Rectangle 8" d="M303.215 77.0814L187.591 147.198L42 -92.8829L157.624 -163L303.215 77.0814Z" fill="#030309"/>
                                <path id="Rectangle 7" d="M372.606 54.0171L244.59 97.5721L154.152 -168.242L282.169 -211.796L372.606 54.0171Z" fill="#030309"/>
                                <rect id="Rectangle 10" x="25" y="487.905" width="168.696" height="262.947" transform="rotate(-31.8041 25 487.905)" fill="#030309"/>
                                <rect id="Rectangle 14" width="67.3639" height="53.5561" transform="matrix(-0.972506 0.23288 0.23288 0.972506 482.512 537)" fill="#030309"/>
                                <rect id="Rectangle 19" width="80.8905" height="53.5561" transform="matrix(-0.999899 0.0142423 0.0142423 0.999899 442.882 549.506)" fill="#030309"/>
                                <rect id="Rectangle 18" width="46.2297" height="53.5561" transform="matrix(-0.988103 -0.153795 -0.153795 0.988103 369.916 549.11)" fill="#030309"/>
                                <rect id="Rectangle 17" width="46.2297" height="53.5561" transform="matrix(-0.940186 -0.340662 -0.340662 0.940186 337.709 546.749)" fill="#030309"/>
                                <rect id="Rectangle 16" width="46.2297" height="53.5561" transform="matrix(-0.940186 -0.340662 -0.340662 0.940186 299.709 531.749)" fill="#030309"/>
                                <rect id="Rectangle 15" x="387" y="587.269" width="168.696" height="262.947" transform="rotate(-27.6434 387 587.269)" fill="#030309"/>
                                <rect id="Rectangle 13" x="86" y="584.104" width="168.696" height="262.947" transform="rotate(-46.8648 86 584.104)" fill="#030309"/>
                                <rect id="Rectangle 11" x="527" y="532.777" width="168.696" height="262.947" transform="rotate(-51.9135 527 532.777)" fill="#030309"/>
                                <rect id="Rectangle 12" x="503" y="527.247" width="168.696" height="262.947" transform="rotate(-31.9408 503 527.247)" fill="#030309"/>
                                <rect id="Rectangle 6" x="456.715" y="60.2651" width="131.991" height="278.153" transform="rotate(-177.303 456.715 60.2651)" fill="#030309"/>
                                <rect id="Rectangle 5" x="525.118" y="90.4898" width="131.991" height="274.627" transform="rotate(-158.368 525.118 90.4898)" fill="#030309"/>
                                <rect id="Rectangle 4" x="570.695" y="127.633" width="109.94" height="223.222" transform="rotate(-142.051 570.695 127.633)" fill="#030309"/>
                                <rect id="Rectangle 3" x="613.292" y="189.098" width="99.2768" height="223.222" transform="rotate(-128.125 613.292 189.098)" fill="#030309"/>
                                <path id="Vector 3" d="M609 183V422.5" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 1" d="M185.5 425.5L185 180" stroke="#DBDBDC" stroke-width="4"/>
                                <path id="Vector 2" d="M185 181.502C185 181.502 269.8 52.0936 397 56.0907C524.2 60.0879 576.603 135.189 609 184" stroke="#DBDBDC" stroke-width="4"/>
                                <path id="Vector 4" d="M608.5 424.5C608.5 424.5 557 548 396 550.5C235 553 185 424.5 185 424.5" stroke="#DBDBDC" stroke-width="4"/>
                                <path id="Polygon 1" d="M396.252 65.2333L377.848 35.8138L414.647 35.8079L396.252 65.2333Z" fill="#E7F013"/>
                                <path id="Polygon 2" d="M407.919 38.9482L396.431 59.4193L384.446 38.7244L407.919 38.9482Z" fill="#030309"/>
                                <path id="Vector 6" d="M307 76L302 64.5L312 60.5L317 71" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 7" d="M279.5 91L268.5 73.5L259 79L269.5 97.5" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 8" d="M225 135L206.5 117" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 9" d="M477.153 71.5794L479.366 59.3018L489.886 61.5697L488.226 73.0218" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 10" d="M347.928 61.4888L346.352 49.0483L357.072 48.0112L358.929 59.4917" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 11" d="M435.153 59.5794L437.366 47.3018L447.886 49.5697L446.226 61.0218" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 12" d="M514.032 86.1754L522.756 72.2658L533.956 78.0405L525.5 93.5" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 13" d="M569.5 131.5L585.5 116" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 15" d="M183.5 193.5L173 187" stroke="#029705" stroke-width="4"/>
                                <path id="Vector 16" d="M184 203L173.5 196.5" stroke="#029705" stroke-width="4"/>
                                <path id="Vector 17" d="M610 193.5L619 188" stroke="#029705" stroke-width="3"/>
                                <path id="Vector 18" d="M610 199.5L619 194" stroke="#029705" stroke-width="3"/>
                                <line id="Line 1" x1="184" y1="211" x2="184" y2="184" stroke="#DBDBDC" stroke-width="2"/>
                                <line id="Line 2" x1="610" y1="211" x2="610" y2="184" stroke="#DBDBDC" stroke-width="2"/>
                                <rect id="altitude_bg" x="675" y="73" width="72" height="476" fill="#76767A"/>
                                <svg x="675" y="73" width="72" height="476"><g id="altitude_tape_group"></g></svg>
                                <g id="altitude_indicator_static">
                                    <rect id="altitude_1" x="675" y="280" width="73" height="49" fill="#030309"/>
                                    <text id="altitude_readout_hundreds" x="740" y="316" fill="#00FF00" font-size="32" text-anchor="end" font-weight="bold">0</text>
                                    <g id="altitude_tens_reel_container" clip-path="url(#tensReelClip)"><g id="altitude_tens_reel_group"></g></g>
                                    <line id="Line 8" x1="669" y1="307" x2="618" y2="307" stroke="#DDDF07" stroke-width="8"/>
                                </g>
                                <path id="limit" d="M636 336.08L621.413 307.511L650.858 307.651L636 336.08Z" fill="#C477C6"/>
                                <path id="limit2" d="M636 279L650.722 307.5H621.278L636 279Z" fill="#C477C6"/>
                                <path id="limit3" d="M636 285L643.794 303H628.206L636 285Z" fill="#100010"/>
                                <path id="limit4" d="M636.191 329.14L628.276 311.242L643.534 310.999L636.191 329.14Z" fill="#030309"/>
                                <line id="Line 6" x1="746.5" y1="263" x2="746.5" y2="281" stroke="#ECED06" stroke-width="3"/>
                                <line id="Line 4" x1="746.5" y1="329" x2="746.5" y2="347" stroke="#ECED06" stroke-width="3"/>
                                <path id="Ellipse 1" d="M636 481C636 484.866 632.866 488 629 488C625.134 488 622 484.866 622 481C622 477.134 625.134 474 629 474C632.866 474 636 477.134 636 481Z" fill="#D9D9D9"/>
                                <path id="Ellipse 4" d="M636 147C636 150.866 632.866 154 629 154C625.134 154 622 150.866 622 147C622 143.134 625.134 140 629 140C632.866 140 636 143.134 636 147Z" fill="#D9D9D9"/>
                                <g id="Ellipse 3">
                                    <path d="M636 229C636 232.866 632.866 236 629 236C625.134 236 622 232.866 622 229C622 225.134 625.134 222 629 222C632.866 222 636 225.134 636 229Z" fill="#D9D9D9"/>
                                    <path d="M636 395C636 398.866 632.866 402 629 402C625.134 402 622 398.866 622 395C622 391.134 625.134 388 629 388C632.866 388 636 391.134 636 395Z" fill="#D9D9D9"/>
                                </g>
                                <rect id="speed" x="28" y="73" width="97" height="477" fill="#76767A"/>
                                <svg x="28" y="73" width="97" height="477"><g id="speed_tape_group"></g></svg>
                                <g id="speed_indicator_static">
                                    <path id="Polygon 9" d="M128.036 311.591L150.451 301.561L150.513 321.482L128.036 311.591Z" fill="#FDFD03"/>
                                    <path id="Vector 20" d="M137 311H96.5" stroke="#FDFD03" stroke-width="4"/>
                                    <rect x="50" y="296" width="45" height="30" fill="black" stroke="#999" stroke-width="1"/>
                                    <text id="speed_readout" x="72.5" y="318" fill="#00FF00" font-size="20" text-anchor="middle" font-weight="bold">0</text>
                                </g>
                                <path id="Vector 19" d="M19.5 311H31" stroke="#FDFD03" stroke-width="4"/>
                                <path id="Vector 21" d="M29 73H151.5" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 22" d="M28 549H151.5" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 23" d="M672.5 73H774" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 24" d="M672 548.5H773" stroke="#E7E6E8" stroke-width="4"/>
                                <path id="Vector 25" d="M745 549.5L746 347" stroke="#E7E6E8" stroke-width="3"/>
                                <path id="Vector 26" d="M745 73V265" stroke="#E7E6E8" stroke-width="3"/>
                                <g id="wings">
                                    <rect id="Rectangle 21" x="280" y="315" width="11" height="25" fill="#030309"/>
                                    <rect id="Rectangle 23" x="522" y="304" width="71" height="12" fill="#030309"/>
                                    <rect id="Rectangle 22" x="512" y="305" width="13" height="35" fill="#030309"/>
                                    <rect id="Rectangle 20" x="208" y="304" width="83" height="13" fill="#030309"/>
                                    <g id="wing">
                                        <path d="M278.591 316.857H208V304H291.608V340H278.591V316.857Z" stroke="#FEFE03" stroke-width="3"/>
                                        <path d="M511.392 340V304H595V316.857H524.409V340H511.392Z" stroke="#FEFE03" stroke-width="3"/>
                                    </g>
                                </g>
                                <g id="middle">
                                    <rect id="middle_2" x="393" y="304" width="17" height="17" fill="#0CC704"/>
                                    <rect id="Rectangle 24" x="395" y="307" width="13" height="11" fill="#030309"/>
                                </g>
                                <rect id="Rectangle 25" y="571" width="787" height="140" fill="#030309"/>
                                <rect id="header" x="243" y="599" width="326" height="66" fill="#76767A"/>
                                <g id="heading_indicator">
                                    <g id="heading_tape_container" clip-path="url(#headingClip)"><g id="heading_tape_group"></g></g>
                                    <g id="heading_static_elements">
                                        <line x1="406" y1="620" x2="406" y2="635" stroke="#FDFD03" stroke-width="3"/>
                                        <rect x="381" y="599" width="50" height="20" fill="black" stroke="#FFFFFF" stroke-width="1"/>
                                        <text id="heading_readout" x="406" y="615" fill="#00FF00" font-size="16" text-anchor="middle" font-weight="bold">000</text>
                                    </g>
                                </g>
                                <path id="Vector 27" d="M243 599V667" stroke="#FCFCFF" stroke-width="4"/>
                                <g id="Line 5"><line id="Line 5_2" x1="745" y1="264.5" x2="787" y2="264.5" stroke="#ECED06" stroke-width="3"/></g>
                                <line id="Line 6_2" x1="671" y1="279.5" x2="748" y2="279.5" stroke="#ECED06" stroke-width="3"/>
                                <line id="Line 7" x1="671" y1="329.5" x2="748" y2="329.5" stroke="#ECED06" stroke-width="3"/>
                                <line id="Line 3" x1="746" y1="345.5" x2="786" y2="345.5" stroke="#ECED06" stroke-width="3"/>
                            </g>
                            <defs>
                                <clipPath id="clip0_1_2890"><rect width="787" height="695" fill="white"/></clipPath>
                                <clipPath id="tensReelClip"><rect x="732" y="269" width="50" height="75"/></clipPath>
                                <clipPath id="headingClip"><rect x="243" y="620" width="326" height="45"/></clipPath>
                            </defs>
                            </svg>
                        </div>
                        </div>

                    <div class="fdc-data-panel">
                        
                        <div class="fdc-primary-readout">
                            <span class="fdc-label">Vertical Speed</span>
                            <span class="fdc-value" id="ac-vs-new">
                                <i class="fa-solid fa-minus"></i> 0 <span class="fdc-unit">FPM</span>
                            </span>
                        </div>

                        <div class="fdc-data-grid">
                            <div class="fdc-data-item">
                                <span class="fdc-label">ETE</span>
                                <span class="fdc-value" id="ac-ete-new">--:--</span>
                            </div>
                            <div class="fdc-data-item">
                                <span class="fdc-label">To Dest</span>
                                <span class="fdc-value" id="ac-dist-new">--- <span class="fdc-unit">NM</span></span>
                            </div>
                            <div class="fdc-data-item">
                                <span class="fdc-label">Next WP</span>
                                <span class="fdc-value" id="ac-next-wp-new">---</span>
                            </div>
                            <div class="fdc-data-item">
                                <span class="fdc-label">To Next</span>
                                <span class="fdc-value" id="ac-next-wp-dist-new">--.- <span class="fdc-unit">NM</span></span>
                            </div>
                        </div>

                        <div class="fdc-tertiary-readout">
                            <span class="fdc-label">Groundspeed</span>
                            <span class="fdc-value" id="ac-gs-new">
                                0 <span class="fdc-unit">KTS</span>
                            </span>
                        </div>

                    </div>
                </div> 
                
                <div class="ac-profile-card-new">
                    <h4>Vertical Profile</h4>
                    <div id="vsd-panel" class="vsd-panel" data-plan-id="" data-profile-built="false">
                        <div id="vsd-graph-window" class="vsd-graph-window">
                            <div id="vsd-aircraft-icon"></div>
                            <div id="vsd-graph-content">
                                <svg id="vsd-profile-svg" xmlns="http://www.w3.org/2000/svg">
                                    <path id="vsd-flown-path" d="" />
                                    <path id="vsd-profile-path" d="" />
                                </svg>
                                <div id="vsd-waypoint-labels"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="vsd-disclaimer">
                    <div class="disclaimer-legend">
                        <span><i class="fa-solid fa-circle" style="color: #00a8ff;"></i> Planned FPL</span>
                        <span><i class="fa-solid fa-circle" style="color: #dc3545;"></i> Flown Route</span>
                    </div>
                    <p><i class="fa-solid fa-circle-info"></i> The vertical profile may be inaccurate if your filed flight plan altitudes are incomplete or incorrect.</p>
                </div>

                </div> 
            
            <div id="ac-tab-pilot-report" class="ac-tab-pane">
                <div id="pilot-stats-display">
                    </div>
            </div>

        </div> 
    </div>
    `;
    
    createPfdDisplay();
    updatePfdDisplay(baseProps.position);
    
    // --- [MODIFIED] ---
    // Pass the historical route data to the update function
    updateAircraftInfoWindow(baseProps, plan, sortedRoutePoints);
}

/**
 * --- [REHAULED v2.1] Renders the Pilot Report with collapsible sections and a case-sensitive profile link.
 * --- [MODIFIED v2.2] Removed back button for new tabbed layout
 */
function renderPilotStatsHTML(stats, username) {
    if (!stats) return '<p class="error-text">Could not load pilot statistics.</p>';

    // --- Data Extraction & Helpers ---
    const getRuleValue = (rules, ruleName) => {
        if (!Array.isArray(rules)) return null;
        const rule = rules.find(r => r.definition?.name === ruleName);
        return rule ? rule.referenceValue : null;
    };
    const formatViolationDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const currentGradeIndex = stats.gradeDetails?.gradeIndex;
    const currentGrade = stats.gradeDetails?.grades?.[currentGradeIndex];
    const nextGrade = stats.gradeDetails?.grades?.[currentGradeIndex + 1];

    const atcRankId = stats.atcRank;
    const atcRankMap = { 0: 'Observer', 1: 'Trainee', 2: 'Apprentice', 3: 'Specialist', 4: 'Officer', 5: 'Supervisor', 6: 'Recruiter', 7: 'Manager' };
    const atcRankName = atcRankId in atcRankMap ? atcRankMap[atcRankId] : 'N/A';
    
    // --- Key Performance Indicators (KPIs) ---
    const kpis = {
        grade: currentGrade?.name.replace('Grade ', '') || 'N/A',
        xp: (stats.totalXP || 0).toLocaleString(),
        atcRank: atcRankName,
        totalViolations: (stats.violationCountByLevel?.level1 || 0) + (stats.violationCountByLevel?.level2 || 0) + (stats.violationCountByLevel?.level3 || 0)
    };
    
    // --- Detailed Stats ---
    const details = {
        lvl1Vios: stats.violationCountByLevel?.level1 || 0,
        lvl2Vios: stats.violationCountByLevel?.level2 || 0,
        lvl3Vios: stats.violationCountByLevel?.level3 || 0,
        lastViolation: formatViolationDate(stats.lastLevel1ViolationDate),
        flightTime90d: getRuleValue(currentGrade?.rules, 'Flight Time (90 days)'),
        landings90d: getRuleValue(currentGrade?.rules, 'Landings (90 days)')
    };

    // --- Progression Card Generator ---
    const createProgressCard = (title, gradeData) => {
        if (!gradeData) {
            return `<div class="progress-card complete"><h4><i class="fa-solid fa-crown"></i> Max Grade Achieved</h4><p>Congratulations, you have reached the highest available grade!</p></div>`;
        }
        const reqXp = getRuleValue(gradeData.rules, 'XP');
        const reqVios = getRuleValue(gradeData.rules, 'All Level 2/3 Violations (1 year)');
        const xpProgress = reqXp > 0 ? Math.min(100, (stats.totalXP / reqXp) * 100) : 100;
        const viosMet = stats.total12MonthsViolations <= reqVios;
        return `<div class="progress-card"><h4>${title}</h4><div class="progress-item"><div class="progress-label"><span><i class="fa-solid fa-star"></i> XP</span><span>${stats.totalXP.toLocaleString()} / ${reqXp.toLocaleString()}</span></div><div class="progress-bar-bg"><div class="progress-bar-fg" style="width: ${xpProgress.toFixed(1)}%;"></div></div></div><div class="progress-item"><div class="progress-label"><span><i class="fa-solid fa-shield-halved"></i> 1-Year Violations</span><span class="${viosMet ? 'req-met' : 'req-not-met'}">${stats.total12MonthsViolations} / ${reqVios} max<i class="fa-solid ${viosMet ? 'fa-check-circle' : 'fa-times-circle'}"></i></span></div></div></div>`;
    };
    
    // --- Final HTML Assembly with Accordion ---
    return `
        <div class="stats-rehaul-container">
            <div class="stats-header">
                <h4>${username}</h4>
                <a href="https://community.infiniteflight.com/u/${username}/summary" target="_blank" rel="noopener noreferrer" class="community-profile-link" title="View Community Profile">
                    <i class="fa-solid fa-external-link-alt"></i> View Profile
                </a>
            </div>

            <div class="kpi-grid">
                <div class="kpi-card"><div class="kpi-label"><i class="fa-solid fa-user-shield"></i> Grade</div><div class="kpi-value">${kpis.grade}</div></div>
                <div class="kpi-card"><div class="kpi-label"><i class="fa-solid fa-star"></i> Total XP</div><div class="kpi-value">${kpis.xp}</div></div>
                <div class="kpi-card"><div class="kpi-label"><i class="fa-solid fa-headset"></i> ATC Rank</div><div class="kpi-value">${kpis.atcRank}</div></div>
                <div class="kpi-card"><div class="kpi-label"><i class="fa-solid fa-triangle-exclamation"></i> Total Violations</div><div class="kpi-value">${kpis.totalViolations}</div></div>
            </div>

            <div class="stats-accordion">
                <div class="accordion-item">
                    <button class="accordion-header">
                        <span><i class="fa-solid fa-chart-line"></i> Grade Progression</span>
                        <i class="fa-solid fa-chevron-down toggle-icon"></i>
                    </button>
                    <div class="accordion-content">
                        <div class="progression-container">
                            ${createProgressCard(`Current: Grade ${kpis.grade}`, currentGrade)}
                            ${createProgressCard(`Next: Grade ${nextGrade?.name.replace('Grade ', '') || ''}`, nextGrade)}
                        </div>
                    </div>
                </div>

                <div class="accordion-item">
                    <button class="accordion-header">
                        <span><i class="fa-solid fa-list-check"></i> Detailed Statistics</span>
                        <i class="fa-solid fa-chevron-down toggle-icon"></i>
                    </button>
                    <div class="accordion-content">
                        <div class="details-grid">
                             <div class="detail-item"><span class="detail-label">Level 1 Violations</span><span class="detail-value">${details.lvl1Vios}</span></div>
                            <div class="detail-item"><span class="detail-label">Level 2 Violations</span><span class="detail-value">${details.lvl2Vios}</span></div>
                            <div class="detail-item"><span class="detail-label">Level 3 Violations</span><span class="detail-value">${details.lvl3Vios}</span></div>
                             <div class="detail-item"><span class="detail-label">Last Violation Date</span><span class="detail-value">${details.lastViolation}</span></div>
                            <div class="detail-item"><span class="detail-label">Flight Time (90 days)</span><span class="detail-value">${details.flightTime90d ? details.flightTime90d.toFixed(1) + ' hrs' : 'N/A'}</span></div>
                            <div class="detail-item"><span class="detail-label">Landings (90 days)</span><span class="detail-value">${details.landings90d || 'N/A'}</span></div>
                        </div>
                    </div>
                </div>
            </div>
            
            </div>
    `;
}

// --- [NEW & FIXED] Fetches and displays the pilot stats, and attaches its own event listeners ---
    async function displayPilotStats(userId, username) {
        if (!userId) return;

        // Get the containers
        // const statsPane = document.getElementById('ac-tab-pilot-report'); // No longer needed
        // const flightPane = document.getElementById('ac-tab-flight-data'); // No longer needed
        const statsDisplay = document.getElementById('pilot-stats-display');
        
        if (!statsDisplay) return;

        // Show loading spinner in stats panel
        statsDisplay.innerHTML = `<div class="spinner-small" style="margin: 2rem auto;"></div><p style="text-align: center;">Loading pilot report for ${username}...</p>`;
        
        // --- [REMOVED] Toggle visibility ---
        // flightPane.classList.remove('active');
        // statsPane.classList.add('active');

        try {
            const res = await fetch(`${ACARS_USER_API_URL}/${userId}/grade`);
            if (!res.ok) throw new Error('Could not fetch pilot data.');
            
            const data = await res.json();
            if (data.ok && data.gradeInfo) {
                statsDisplay.innerHTML = renderPilotStatsHTML(data.gradeInfo, username);
                
                // --- Accordion event listeners ---
                const accordionHeaders = statsDisplay.querySelectorAll('.accordion-header');
                accordionHeaders.forEach(header => {
                    header.addEventListener('click', () => {
                        const item = header.closest('.accordion-item');
                        const content = header.nextElementSibling;
                        const isExpanded = item.classList.contains('active');
                        
                        item.classList.toggle('active');

                        if (isExpanded) {
                            content.style.maxHeight = null;
                        } else {
                            content.style.maxHeight = content.scrollHeight + 'px';
                        }
                    });
                });

                // The main delegate in setupAircraftWindowEvents will catch the back button click
                
            } else {
                throw new Error('Pilot data not found or invalid.');
            }
        } catch (error) {
            console.error('Error fetching pilot stats:', error);
            // [MODIFIED] Removed back button from error message
            statsDisplay.innerHTML = `<div class="stats-rehaul-container">
                <p class="error-text">${error.message}</p>
            </div>`;
        }
    }


/**
 * --- [MAJOR REVISION V8.0: FDC Redesign]
 * This update binds data to the new "Flight Data Computer" panel,
 * removing logic for the old donut, odometer, and PFD footer.
*/
function updateAircraftInfoWindow(baseProps, plan, sortedRoutePoints) {
    // --- Get all DOM elements ---
    const progressBarFill = document.getElementById('ac-progress-bar');
    const phaseIndicator = document.getElementById('ac-phase-indicator');
    const overviewPanel = document.getElementById('ac-overview-panel');
    
    // --- VSD Elements (Unchanged) ---
    const vsdPanel = document.getElementById('vsd-panel');
    const vsdAircraftIcon = document.getElementById('vsd-aircraft-icon');
    const vsdGraphWindow = document.getElementById('vsd-graph-window');
    const vsdGraphContent = document.getElementById('vsd-graph-content');
    const vsdProfilePath = document.getElementById('vsd-profile-path');
    const vsdFlownPath = document.getElementById('vsd-flown-path');
    const vsdWpLabels = document.getElementById('vsd-waypoint-labels');

    // --- [NEW] FDC Data Panel Elements ---
    const fdcVsEl = document.getElementById('ac-vs-new');
    const fdcEteEl = document.getElementById('ac-ete-new');
    const fdcDistDestEl = document.getElementById('ac-dist-new');
    const fdcNextWpEl = document.getElementById('ac-next-wp-new');
    const fdcNextWpDistEl = document.getElementById('ac-next-wp-dist-new');
    const fdcGsEl = document.getElementById('ac-gs-new');

    // --- [REMOVED] Old Donut, Odometer, and PFD Footer elements ---


    // --- Get Original Data (Unchanged) ---
    const originalFlatWaypoints = (plan && plan.flightPlanItems) ? flattenWaypointsFromPlan(plan.flightPlanItems) : [];
    const originalFlatWaypointObjects = (plan && plan.flightPlanItems) ? getFlatWaypointObjects(plan.flightPlanItems) : [];
    const hasPlan = originalFlatWaypoints.length >= 2;

    let progress = 0, ete = '--:--', distanceToDestNM = 0;
    let totalDistanceNM = 0;

    if (hasPlan) {
        let totalDistanceKm = 0;
        for (let i = 0; i < originalFlatWaypoints.length - 1; i++) {
            const [lon1, lat1] = originalFlatWaypoints[i];
            const [lon2, lat2] = originalFlatWaypoints[i + 1];
            totalDistanceKm += getDistanceKm(lat1, lon1, lat2, lon2);
        }
        totalDistanceNM = totalDistanceKm / 1.852;

        if (totalDistanceNM > 0) {
            const [destLon, destLat] = originalFlatWaypoints[originalFlatWaypoints.length - 1];
            const remainingDistanceKm = getDistanceKm(baseProps.position.lat, baseProps.position.lon, destLat, destLon);
            
            distanceToDestNM = remainingDistanceKm / 1.852;
            progress = Math.max(0, Math.min(100, (1 - (distanceToDestNM / totalDistanceNM)) * 100));

            if (baseProps.position.gs_kt > 50) {
                const timeHours = distanceToDestNM / baseProps.position.gs_kt;
                const hours = Math.floor(timeHours);
                const minutes = Math.round((timeHours - hours) * 60);
                ete = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
        }
    }

    // --- [NEW in V7.1] Pre-calculate cumulative NM on the main waypoint objects (Unchanged) ---
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
    }
    // --- [END NEW in V7.1] ---

    // --- Flight Plan Data Extraction (for flight phase) (Unchanged) ---
    let nextWpName = '---';
    let nextWpDistNM = '---';
    let bestWpIndex = -1;
    let minScore = Infinity; 
    if (plan) { 
        const currentPos = baseProps.position;
        const currentTrack = currentPos.track_deg;
        
        if (originalFlatWaypointObjects.length > 1 && currentPos && typeof currentTrack === 'number') {
            for (let i = 1; i < originalFlatWaypointObjects.length; i++) { 
                const wp = originalFlatWaypointObjects[i];
                if (!wp.location || wp.location.latitude == null || wp.location.longitude == null) {
                    continue; 
                }
                const distanceToWpKm = getDistanceKm(currentPos.lat, currentPos.lon, wp.location.latitude, wp.location.longitude);
                const bearingToWp = getBearing(currentPos.lat, currentPos.lon, wp.location.latitude, wp.location.longitude);
                const bearingDiff = Math.abs(normalizeBearingDiff(currentTrack - bearingToWp));
                if (bearingDiff <= 95) { 
                    if (distanceToWpKm < minScore) {
                        minScore = distanceToWpKm;
                        bestWpIndex = i;
                    }
                }
            }
        }
        if (bestWpIndex !== -1) {
            const nextWp = originalFlatWaypointObjects[bestWpIndex]; 
            if (nextWp) {
                nextWpName = nextWp.identifier || nextWp.name || 'N/A';
                nextWpDistNM = (minScore / 1.852).toFixed(0);
            }
        } else if (hasPlan && distanceToDestNM < 10 && distanceToDestNM > 0.5) {
            nextWpName = originalFlatWaypointObjects.length > 0 ? (originalFlatWaypointObjects[originalFlatWaypointObjects.length - 1].identifier || originalFlatWaypointObjects[originalFlatWaypointObjects.length - 1].name) : "DEST";
            nextWpDistNM = distanceToDestNM.toFixed(0);
        } else if (hasPlan && distanceToDestNM <= 0.5) {
             nextWpName = "DEST";
             nextWpDistNM = "0";
        }
    }
    
    // --- [MODIFIED in V7.1] Calculate accurate progress along the planned route (Unchanged) ---
    let progressAlongRouteNM = 0;
    if (hasPlan && bestWpIndex > 0) {
        const prevWp = originalFlatWaypointObjects[bestWpIndex - 1];
        const nextWp = originalFlatWaypointObjects[bestWpIndex];
        
        if (prevWp && nextWp && prevWp.cumulativeNM != null && nextWp.cumulativeNM != null) {
            const segmentTotalNM = nextWp.cumulativeNM - prevWp.cumulativeNM;
            const distToNextNM = minScore / 1.852;
            
            if (segmentTotalNM > 0) {
                const segmentProgressNM = Math.max(0, segmentTotalNM - distToNextNM);
                progressAlongRouteNM = prevWp.cumulativeNM + segmentProgressNM;
            } else {
                progressAlongRouteNM = prevWp.cumulativeNM;
            }
        } else {
             progressAlongRouteNM = Math.max(0.01, totalDistanceNM - distanceToDestNM);
        }
    } else if (hasPlan && (bestWpIndex === 0 || bestWpIndex === -1) && distanceToDestNM >= 1.0) { 
        progressAlongRouteNM = Math.max(0.01, totalDistanceNM - distanceToDestNM);
    } else if (hasPlan && distanceToDestNM < 1.0) { 
        progressAlongRouteNM = totalDistanceNM;
    }
    // --- [END MODIFIED in V7.1] ---


    // --- [REMOVED] PFD Footer Display update logic ---


    // --- Configuration Thresholds (Unchanged) ---
    const THRESHOLD = {
        ON_GROUND_AGL: 75, PARKED_MAX_GS: 2, TAXI_MAX_GS: 35, TAKEOFF_MIN_VS: 300,
        TAKEOFF_CEILING_AGL: 1500, CLIMB_MIN_VS: 500, DESCENT_MIN_VS: -500,
        TERMINAL_AREA_DIST_NM: 40, APPROACH_PROGRESS_MIN: 5, LANDING_CEILING_AGL: 500,
        CRUISE_MIN_ALT_MSL: 18000, CRUISE_VS_TOLERANCE: 500, RUNWAY_PROXIMITY_NM: 1.5,
        RUNWAY_HEADING_TOLERANCE: 10, LANDING_FLARE_MAX_GS: 220, APPROACH_CEILING_AGL: 2500,
        PARKED_PROGRESS_START: 2, PARKED_PROGRESS_END: 98, HOLD_SHORT_GS: 2.0,
        HOLD_SHORT_PROXIMITY_NM: 0.15,
    };

    // --- Flight Phase State Machine (Unchanged) ---
    let flightPhase = 'ENROUTE';
    let phaseClass = 'phase-enroute';
    let phaseIcon = 'fa-route';
    const vs = baseProps.position.vs_fpm || 0;
    const altitude = baseProps.position.alt_ft || 0;
    const gs = baseProps.position.gs_kt || 0;
    let departureIcao = null;
    let arrivalIcao = null;
    if (plan && Array.isArray(plan.flightPlanItems) && plan.flightPlanItems.length >= 2) {
        departureIcao = plan.flightPlanItems[0]?.identifier?.trim().toUpperCase();
        arrivalIcao = plan.flightPlanItems[plan.flightPlanItems.length - 1]?.identifier?.trim().toUpperCase();
    }
    const aircraftPos = { lat: baseProps.position.lat, lon: baseProps.position.lon, track_deg: baseProps.position.track_deg };
    let nearestRunwayInfo = null;
    if (hasPlan) {
        const distanceFlownKm = totalDistanceNM * 1.852 - distanceToDestNM * 1.852;
        if (distanceToDestNM * 1.852 < distanceFlownKm && arrivalIcao) {
             nearestRunwayInfo = getNearestRunway(aircraftPos, arrivalIcao, THRESHOLD.RUNWAY_PROXIMITY_NM);
        } else if (departureIcao) {
             nearestRunwayInfo = getNearestRunway(aircraftPos, departureIcao, THRESHOLD.RUNWAY_PROXIMITY_NM);
        }
    }
    let altitudeAGL = null;
    if (nearestRunwayInfo && nearestRunwayInfo.elevation_ft != null) {
        altitudeAGL = altitude - nearestRunwayInfo.elevation_ft;
    } else {
        const originElevationFt = (plan?.origin?.elevation_ft) ? parseFloat(plan.origin.elevation_ft) : null;
        const destElevationFt = (plan?.destination?.elevation_ft) ? parseFloat(plan.destination.elevation_ft) : null;
        const relevantElevationFt = (totalDistanceNM > 0 && distanceToDestNM < totalDistanceNM / 2) ? destElevationFt : originElevationFt;
        if (relevantElevationFt !== null) {
            altitudeAGL = altitude - relevantElevationFt;
        }
    }
    const aglCheck = altitudeAGL !== null && altitudeAGL < THRESHOLD.ON_GROUND_AGL;
    const fallbackGroundCheck = altitudeAGL === null && gs < THRESHOLD.TAXI_MAX_GS && Math.abs(vs) < 150;
    const isOnGround = aglCheck || fallbackGroundCheck;
    const isLinedUpForLanding = nearestRunwayInfo && nearestRunwayInfo.airport === arrivalIcao && nearestRunwayInfo.headingDiff < THRESHOLD.RUNWAY_HEADING_TOLERANCE;
    if (isOnGround) {
        if (gs > THRESHOLD.TAXI_MAX_GS) {
            if (progress > 90) { flightPhase = 'LANDING ROLLOUT'; phaseClass = 'phase-approach'; phaseIcon = 'fa-plane-arrival';
            } else if (progress < 10) { flightPhase = 'TAKEOFF ROLL'; phaseClass = 'phase-climb'; phaseIcon = 'fa-plane-departure';
            } else { flightPhase = 'HIGH-SPEED TAXI'; phaseIcon = 'fa-road'; phaseClass = 'phase-enroute'; }
        } else {
            const isStopped = gs <= THRESHOLD.HOLD_SHORT_GS;
            const isAtTerminal = (progress < THRESHOLD.PARKED_PROGRESS_START) || (progress > THRESHOLD.PARKED_PROGRESS_END);
            const relevantIcao = progress < 50 ? departureIcao : arrivalIcao;
            const closeRunwayInfo = getNearestRunway(aircraftPos, relevantIcao, THRESHOLD.HOLD_SHORT_PROXIMITY_NM);
            const isLinedUp = closeRunwayInfo && closeRunwayInfo.headingDiff < THRESHOLD.RUNWAY_HEADING_TOLERANCE;
            if (isLinedUp) { flightPhase = `LINED UP RWY ${closeRunwayInfo.ident}`; phaseIcon = 'fa-arrow-up'; phaseClass = 'phase-climb';
            } else if (isStopped) {
                if (closeRunwayInfo) { flightPhase = `HOLDING SHORT RWY ${closeRunwayInfo.ident}`; phaseIcon = 'fa-pause-circle'; phaseClass = 'phase-enroute';
                } else if (isAtTerminal) { flightPhase = 'PARKED'; phaseIcon = 'fa-parking'; phaseClass = 'phase-enroute';
                } else { flightPhase = 'HOLDING POSITION'; phaseIcon = 'fa-hand'; phaseClass = 'phase-enroute'; }
            } else {
                flightPhase = 'TAXIING'; phaseIcon = 'fa-road'; phaseClass = 'phase-enroute';
                if (progress > 50) { flightPhase = 'TAXIING TO GATE';
                } else if (progress < 10) { flightPhase = 'TAXIING TO RUNWAY'; }
            }
        }
    } else {
        const isInLandingSequence = isLinedUpForLanding && altitudeAGL !== null;
        if (isInLandingSequence && altitudeAGL < THRESHOLD.APPROACH_CEILING_AGL) {
            if (altitudeAGL < 60 && vs < -50) { flightPhase = 'FLARE';
            } else if (altitudeAGL < THRESHOLD.LANDING_CEILING_AGL) { flightPhase = 'SHORT FINAL';
            } else { flightPhase = 'FINAL APPROACH'; }
            phaseClass = 'phase-approach'; phaseIcon = 'fa-plane-arrival';
        } else if (hasPlan && distanceToDestNM < THRESHOLD.TERMINAL_AREA_DIST_NM && progress > THRESHOLD.APPROACH_PROGRESS_MIN) {
            flightPhase = 'APPROACH'; phaseClass = 'phase-approach'; phaseIcon = 'fa-plane-arrival';
        } else if (vs > THRESHOLD.TAKEOFF_MIN_VS) {
            flightPhase = 'CLIMB'; phaseClass = 'phase-climb'; phaseIcon = 'fa-arrow-trend-up';
            if (progress < 10 && altitudeAGL !== null && altitudeAGL < THRESHOLD.TAKEOFF_CEILING_AGL) {
                 flightPhase = 'LIFTOFF'; phaseIcon = 'fa-plane-up';
            }
        } else if (vs < THRESHOLD.DESCENT_MIN_VS) {
            flightPhase = 'DESCENT'; phaseClass = 'phase-descent'; phaseIcon = 'fa-arrow-trend-down';
        } else if (altitude > THRESHOLD.CRUISE_MIN_ALT_MSL && Math.abs(vs) < THRESHOLD.CRUISE_VS_TOLERANCE) {
            flightPhase = 'CRUISE'; phaseClass = 'phase-cruise'; phaseIcon = 'fa-minus';
        }
    }
    // --- [End of unchanged section] ---


    // --- [NEW] VSD LOGIC (Unchanged, but vsdSummaryVS is now fdcVsEl) ---
    if (vsdPanel && hasPlan && vsdGraphContent && vsdAircraftIcon) {
        // --- 1. Define VSD scales ---
        const VSD_HEIGHT_PX = vsdGraphContent.clientHeight || 240;
        const MAX_ALT_FT = 45000;
        const Y_SCALE_PX_PER_FT = VSD_HEIGHT_PX / MAX_ALT_FT;
        const FIXED_X_SCALE_PX_PER_NM = 4;
        
        // --- 2. Build the Profile (Only once per flight plan) ---
        const planId = plan.flightPlanId || plan.id || 'unknown';
        if (vsdPanel.dataset.profileBuilt !== 'true' || vsdPanel.dataset.planId !== planId) {
            
            let flatWaypointObjects = JSON.parse(JSON.stringify(originalFlatWaypointObjects));
            
            if (flatWaypointObjects.length > 0) {
                const lastIdx = flatWaypointObjects.length - 1;
                if (flatWaypointObjects[0].altitude == null) {
                    flatWaypointObjects[0].altitude = plan?.origin?.elevation_ft || 0;
                }
                if (flatWaypointObjects[lastIdx].altitude == null) {
                    const prevAlt = (lastIdx > 0) ? flatWaypointObjects[lastIdx - 1]?.altitude : null;
                    flatWaypointObjects[lastIdx].altitude = (prevAlt != null) ? prevAlt : (plan?.destination?.elevation_ft || 0);
                }
                for (let i = 1; i < lastIdx; i++) {
                    const wp = flatWaypointObjects[i];
                    if (wp.altitude == null || (typeof wp.altitude === 'number' && wp.altitude <= 0)) {
                        wp.altitude = null;
                    }
                }
                let lastValidAltIndex = 0; 
                for (let i = 1; i < flatWaypointObjects.length; i++) {
                    const wp = flatWaypointObjects[i];
                    if (wp.altitude != null && typeof wp.altitude === 'number') {
                        if (i > lastValidAltIndex + 1) {
                            const gapStartIndex = lastValidAltIndex;
                            const gapEndIndex = i;
                            const startAlt = flatWaypointObjects[gapStartIndex].altitude;
                            const endAlt = flatWaypointObjects[gapEndIndex].altitude;
                            const numStepsInGap = gapEndIndex - gapStartIndex;

                            for (let j = 1; j < numStepsInGap; j++) {
                                const stepIndex = gapStartIndex + j;
                                const fraction = j / numStepsInGap;
                                const interpolatedAlt = startAlt + (endAlt - startAlt) * fraction;
                                flatWaypointObjects[stepIndex].altitude = Math.round(interpolatedAlt);
                            }
                        }
                        lastValidAltIndex = i;
                    }
                }
            }

            // --- Build Y-Axis ---
            if (vsdGraphWindow && !vsdGraphWindow.querySelector('#vsd-y-axis')) {
                let yAxisHtml = '<div id="vsd-y-axis">';
                const altLabels = [10000, 20000, 30000, 40000];
                for (const alt of altLabels) {
                    const yPos = VSD_HEIGHT_PX - (alt * Y_SCALE_PX_PER_FT);
                    yAxisHtml += `<div class="y-axis-label" style="top: ${yPos}px;">${alt / 1000}K</div>`;
                }
                yAxisHtml += '</div>';
                vsdGraphWindow.insertAdjacentHTML('afterbegin', yAxisHtml);
            }
            
            // --- Build Profile Path & Staggered Labels ---
            let path_d = "";
            let labels_html = "";
            let current_x_px = 0;
            let last_label_x_px = -1000;
            let stagger_level = 0;
            const MIN_LABEL_SPACING_PX = 80;
            
            if (flatWaypointObjects.length === 0) return;

            for (let i = 0; i < flatWaypointObjects.length; i++) {
                const wp = flatWaypointObjects[i];
                const wpAltFt = wp.altitude; 
                const wpAltPx = VSD_HEIGHT_PX - (wpAltFt * Y_SCALE_PX_PER_FT);

                current_x_px = wp.cumulativeNM * FIXED_X_SCALE_PX_PER_NM;

                if (i === 0) {
                    path_d = `M ${current_x_px} ${wpAltPx}`;
                } else {
                    path_d += ` L ${current_x_px} ${wpAltPx}`;
                }

                let label_top_px;
                let label_class = '';
                
                if (current_x_px - last_label_x_px < MIN_LABEL_SPACING_PX) {
                    stagger_level = 1 - stagger_level;
                } else {
                    stagger_level = 0;
                }

                if (stagger_level === 1) {
                    label_class = 'low-label';
                    label_top_px = wpAltPx + 12;
                } else {
                    label_class = 'high-label';
                    label_top_px = wpAltPx - 42;
                }
                
                last_label_x_px = current_x_px;

                labels_html += `
                    <div class="vsd-wp-label ${label_class}" style="left: ${current_x_px}px; top: ${label_top_px}px;">
                        <span class="wp-name">${wp.identifier}</span>
                        <span class="wp-alt">${Math.round(wpAltFt)}ft</span>
                    </div>`;
            }
            
            vsdGraphContent.style.width = `${current_x_px + 100}px`;
            vsdProfilePath.closest('svg').style.width = `${current_x_px + 100}px`;
            
            vsdProfilePath.setAttribute('d', path_d);
            vsdWpLabels.innerHTML = labels_html;
            
            vsdPanel.dataset.profileBuilt = 'true';
            vsdPanel.dataset.planId = planId;
        }
        
        // --- 3. Build/Update Flown Altitude Path (Unchanged) ---
        if (vsdFlownPath && hasPlan && originalFlatWaypointObjects.length > 0) {
            let flown_path_d = "";
            let lastFlownLat, lastFlownLon;

            let currentFlightRoutePoints = [...sortedRoutePoints]; 
            const originLat = plan?.origin?.latitude;
            const originLon = plan?.origin?.longitude;
            if (originLat != null && originLon != null && sortedRoutePoints.length > 10) {
                let startIndex = -1;
                for (let i = sortedRoutePoints.length - 1; i > 0; i--) {
                    const point = sortedRoutePoints[i];
                    if (!point.latitude || !point.longitude || point.altitude == null) continue;
                    const distKm = getDistanceKm(point.latitude, point.longitude, originLat, originLon);
                    if (point.altitude < 1000 && distKm < 25) {
                        startIndex = i;
                        break;
                    }
                }
                if (startIndex !== -1) {
                    currentFlightRoutePoints = sortedRoutePoints.slice(startIndex);
                }
            }

            const fullFlownRoute = [];
            if (currentFlightRoutePoints && currentFlightRoutePoints.length > 0) {
                fullFlownRoute.push(...currentFlightRoutePoints); 
                lastFlownLat = currentFlightRoutePoints[0].latitude;
                lastFlownLon = currentFlightRoutePoints[0].longitude;
            }
            
            fullFlownRoute.push({
                latitude: baseProps.position.lat,
                longitude: baseProps.position.lon,
                altitude: baseProps.position.alt_ft
            });

            const flownPathPoints = [];
            let totalActualFlownNM = 0;

            if (fullFlownRoute.length > 0) {
                if (!lastFlownLat) {
                    lastFlownLat = fullFlownRoute[0].latitude;
                    lastFlownLon = fullFlownRoute[0].longitude;
                }

                const startAltFt = originalFlatWaypointObjects[0]?.altitude || fullFlownRoute[0].altitude;
                const startAltPx = VSD_HEIGHT_PX - (startAltFt * Y_SCALE_PX_PER_FT);

                for (let i = 0; i < fullFlownRoute.length; i++) {
                    const point = fullFlownRoute[i];
                    const wpAltFt = typeof point.altitude === 'number' ? point.altitude : 0;
                    const wpAltPx = VSD_HEIGHT_PX - (wpAltFt * Y_SCALE_PX_PER_FT);
                    const wpLat = point.latitude;
                    const wpLon = point.longitude;
                    
                    let segmentDistNM = 0;
                    if (i > 0) { 
                        segmentDistNM = getDistanceKm(lastFlownLat, lastFlownLon, wpLat, wpLon) / 1.852;
                    }
                    totalActualFlownNM += segmentDistNM;

                    flownPathPoints.push({ x_nm: totalActualFlownNM, y_px: wpAltPx });

                    lastFlownLat = wpLat;
                    lastFlownLon = wpLon;
                }
                
                const plannedProgressNM = progressAlongRouteNM;
                const scaleFactor = (totalActualFlownNM > 0.1 && plannedProgressNM > 0.01) ? (plannedProgressNM / totalActualFlownNM) : 1;
                
                for (let i = 0; i < flownPathPoints.length; i++) {
                    const point = flownPathPoints[i];
                    const scaled_x_px = point.x_nm * scaleFactor * FIXED_X_SCALE_PX_PER_NM; 
                    
                    if (i === 0) {
                        flown_path_d = `M 0 ${startAltPx}`;
                        if (flownPathPoints.length === 1) {
                            flown_path_d += ` L ${scaled_x_px} ${point.y_px}`;
                        }
                    } else {
                        flown_path_d += ` L ${scaled_x_px} ${point.y_px}`;
                    }
                }
                
                vsdFlownPath.setAttribute('d', flown_path_d);
            }
        }

        // --- 4. Update Aircraft Icon Position (Vertical) (Unchanged) ---
        const currentAltPx = VSD_HEIGHT_PX - (altitude * Y_SCALE_PX_PER_FT);
        vsdAircraftIcon.style.top = `${currentAltPx}px`;

        // --- 5. Scroll the Graph (Horizontal) (Unchanged) ---
        if (vsdGraphWindow && vsdGraphWindow.clientWidth > 0) {
            const distanceFlownNM = progressAlongRouteNM; 
            const scrollOffsetPx = (distanceFlownNM * FIXED_X_SCALE_PX_PER_NM);
            const vsdViewportWidth = vsdGraphWindow.clientWidth;
            const totalProfileWidthPx = vsdGraphContent.scrollWidth;
            const centerOffset = (vsdViewportWidth / 2) + 35;
            const desiredTranslateX = centerOffset - scrollOffsetPx;
            const maxTranslateX = 0;
            const minTranslateX = Math.min(0, vsdViewportWidth - totalProfileWidthPx);
            const finalTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, desiredTranslateX));
            vsdGraphContent.style.transform = `translateX(${finalTranslateX - 35}px)`;
            const iconLeftPx = scrollOffsetPx + finalTranslateX;
            vsdAircraftIcon.style.left = `${iconLeftPx}px`;
        } else {
            const distanceFlownNM = progressAlongRouteNM;
            const scrollOffsetPx = (distanceFlownNM * FIXED_X_SCALE_PX_PER_NM);
            const translateX = 75 - scrollOffsetPx; 
            vsdGraphContent.style.transform = `translateX(${translateX - 35}px)`;
            vsdAircraftIcon.style.left = `75px`;
        }
    }
    // --- [END NEW VSD LOGIC] ---


    // --- Update Other DOM Elements (Unchanged) ---
    if (progressBarFill) progressBarFill.style.width = `${progress.toFixed(1)}%`;

    if (phaseIndicator) {
        phaseIndicator.className = `flight-phase-indicator ${phaseClass}`;
        phaseIndicator.innerHTML = `<i class="fa-solid ${phaseIcon}"></i> ${flightPhase}`;
    }

    // --- [NEW] Update FDC Data Panel ---
    if (fdcVsEl) {
        const vsRounded = Math.round(vs);
        const vsSign = vsRounded > 50 ? '+' : vsRounded < -50 ? '' : '';
        const vsIcon = vsRounded > 100 ? 'fa-arrow-up' : vsRounded < -100 ? 'fa-arrow-down' : 'fa-minus';
        fdcVsEl.innerHTML = `<i class="fa-solid ${vsIcon}"></i> ${vsSign}${vsRounded} <span class="fdc-unit">FPM</span>`;
    }
    if (fdcEteEl) {
        fdcEteEl.textContent = ete;
    }
    if (fdcDistDestEl) {
        fdcDistDestEl.innerHTML = `${Math.round(distanceToDestNM)} <span class="fdc-unit">NM</span>`;
    }
    if (fdcNextWpEl) {
        fdcNextWpEl.textContent = nextWpName;
    }
    if (fdcNextWpDistEl) {
        const distVal = (nextWpDistNM === '---' || isNaN(parseFloat(nextWpDistNM))) ? '--.-' : Number(nextWpDistNM).toFixed(1);
        fdcNextWpDistEl.innerHTML = `${distVal} <span classm="fdc-unit">NM</span>`;
    }
    if (fdcGsEl) {
        fdcGsEl.innerHTML = `${Math.round(gs)} <span class="fdc-unit">KTS</span>`;
    }
    // --- [END NEW] ---


    // --- Update Aircraft Image (Unchanged) ---
    if (overviewPanel) {
        const sanitizeFilename = (name) => {
            if (!name || typeof name !== 'string') return 'unknown';
            return name.trim().toLowerCase().replace(/[^a-z0-j-9-]/g, '_');
        };
        const aircraftName = baseProps.aircraft?.aircraftName || 'Generic Aircraft';
        const liveryName = baseProps.aircraft?.liveryName || 'Default Livery';
        const sanitizedAircraft = sanitizeFilename(aircraftName);
        const sanitizedLivery = sanitizeFilename(liveryName);
        const imagePath = `/CommunityPlanes/${sanitizedAircraft}/${sanitizedLivery}.png`;
        const fallbackPath = '/CommunityPlanes/default.png';
        const newImageUrl = `url('${imagePath}')`;

        if (overviewPanel.dataset.currentPath !== imagePath) {
            const img = new Image();
            img.src = imagePath;
            const gradient = 'linear-gradient(180deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0) 40%)';
            img.onload = () => {
                overviewPanel.style.backgroundImage = `${gradient}, ${newImageUrl}`;
                overviewPanel.dataset.currentPath = imagePath;
            };
            img.onerror = () => {
                overviewPanel.style.backgroundImage = `${gradient}, url('${fallbackPath}')`;
                overviewPanel.dataset.currentPath = fallbackPath;
            };
        }
    }
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
                // Safely stringify the route data for the data attribute
                const routeDataString = JSON.stringify(route).replace(/'/g, "&apos;");

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
                        <button class="cta-button plan-flight-from-explorer-btn" data-route='${routeDataString}'>Plan</button>
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
     * MODIFIED: Sets up event listeners for the Sector Ops view, including the new toolbar.
     */
    function setupSectorOpsEventListeners() {
        const panel = document.getElementById('sector-ops-floating-panel');
        if (!panel || panel.dataset.listenersAttached === 'true') return;
        panel.dataset.listenersAttached = 'true';

        // --- START: REFACTORED for Toolbar and Panel Toggle ---
        const internalToggleBtn = document.getElementById('sector-ops-toggle-btn');
        const toolbarToggleBtn = document.getElementById('toolbar-toggle-panel-btn');

        const togglePanel = () => {
            const isNowCollapsed = panel.classList.toggle('panel-collapsed');
            
            // Update UI state for both buttons
            if (internalToggleBtn) {
                internalToggleBtn.setAttribute('aria-expanded', !isNowCollapsed);
            }
            if (toolbarToggleBtn) {
                toolbarToggleBtn.classList.toggle('active', !isNowCollapsed);
            }

            // Resize the map
            if (sectorOpsMap) {
                setTimeout(() => {
                    sectorOpsMap.resize();
                }, 400); // Match CSS transition duration
            }
        };

        if (internalToggleBtn) {
            internalToggleBtn.addEventListener('click', togglePanel);
        }
        if (toolbarToggleBtn) {
            toolbarToggleBtn.addEventListener('click', togglePanel);
        }
        // --- END: REFACTORED for Toolbar and Panel Toggle ---

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
    }

    // ==========================================================
    // END: SECTOR OPS / ROUTE EXPLORER LOGIC
    // ==========================================================

    // ====================================================================
    // START: NEW LIVE FLIGHTS & ATC/NOTAM LOGIC FOR SECTOR OPS MAP
    // ====================================================================


// --- [REPLACEMENT for startSectorOpsLiveLoop] ---
// This function is updated to only connect to the WebSocket and 
// set up the poller for ATC/NOTAMs.
function startSectorOpsLiveLoop() {
    stopSectorOpsLiveLoop(); // Clear any old loops

    // 1. Start the data fetching loop for ATC/NOTAMs (infrequent)
    updateSectorOpsSecondaryData(); // Fetch immediately
    sectorOpsAtcNotamInterval = setInterval(updateSectorOpsSecondaryData, DATA_REFRESH_INTERVAL_MS); 

    // 2. Initialize and connect the WebSocket
    // This is responsible for receiving flight data
    initializeSectorOpsSocket();

    // 3. Animation loop is no longer started here.
    // Data updates happen directly in handleSocketFlightUpdate.
}


// --- [REPLACEMENT for stopSectorOpsLiveLoop] ---
// This function is updated to stop the socket
// and clear the ATC/NOTAM poller.
function stopSectorOpsLiveLoop() {
    // 1. Clear the data-fetching interval for ATC/NOTAMs
    if (sectorOpsAtcNotamInterval) {
        clearInterval(sectorOpsAtcNotamInterval);
        sectorOpsAtcNotamInterval = null;
    }
    
    // 2. Disconnect the WebSocket and remove listeners
    if (sectorOpsSocket) {
        console.log('Socket: Disconnecting from Sector Ops...');
        sectorOpsSocket.disconnect();
        sectorOpsSocket = null;
    }

    // 3. NEW: Clear the feature state to prevent stale aircraft
    currentMapFeatures = {};
}

    /**
     * NEW / REFACTORED: Renders all airport markers based on current route and ATC data.
     * This single, efficient function replaces the previous separate functions.
     */
    function renderAirportMarkers() {
        if (!sectorOpsMap || !sectorOpsMap.isStyleLoaded()) return;

        // Clear all previously rendered airport markers to ensure a fresh state
        Object.values(airportAndAtcMarkers).forEach(({ marker }) => marker.remove());
        airportAndAtcMarkers = {};

        const atcAirportIcaos = new Set(activeAtcFacilities.map(f => f.airportName).filter(Boolean));
        
        const allRouteAirports = new Set();
        ALL_AVAILABLE_ROUTES.forEach(route => {
            allRouteAirports.add(route.departure);
            allRouteAirports.add(route.arrival);
        });

        const allAirportsToRender = new Set([...allRouteAirports, ...atcAirportIcaos]);

        allAirportsToRender.forEach(icao => {
            const airport = airportsData[icao];
            if (!airport || airport.lat == null || airport.lon == null) return;

            const hasAtc = atcAirportIcaos.has(icao);
            let markerClass; // Use 'let' to allow modification
            let title = `${icao}: ${airport.name || 'Unknown Airport'}`;

            if (hasAtc) {
                const airportAtc = activeAtcFacilities.filter(f => f.airportName === icao);
                // Check for Approach (type 4) or Departure (type 5)
                const hasApproachOrDeparture = airportAtc.some(f => f.type === 4 || f.type === 5);

                // Start with the base class for any staffed airport
                markerClass = 'atc-active-marker';
                title += ' (Active ATC)';

                // Add the aura class if Approach/Departure is active
                if (hasApproachOrDeparture) {
                    markerClass += ' atc-approach-active';
                    title += ' - Approach/Departure';
                }

            } else {
                markerClass = 'destination-marker'; // For non-ATC airports
            }
            
            const el = document.createElement('div');
            el.className = markerClass;
            el.title = title;

            const marker = new mapboxgl.Marker({ element: el })
                .setLngLat([airport.lon, airport.lat])
                .addTo(sectorOpsMap);

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                handleAirportClick(icao);
            });

            airportAndAtcMarkers[icao] = { marker: marker, className: markerClass };
        });
    }

// crew-center.js

// --- [REPLACEMENT] for updateSectorOpsLiveFlights ---
// --- [MODIFIED] This function is now named 'updateSectorOpsSecondaryData'
// and ONLY fetches Sessions, ATC, and NOTAMs.
// Flight data is now handled by the 'handleSocketFlightUpdate' function via WebSocket.
async function updateSectorOpsSecondaryData() {
    if (!sectorOpsMap || !sectorOpsMap.isStyleLoaded()) return;

    const LIVE_FLIGHTS_BACKEND = 'https://site--acars-backend--6dmjph8ltlhv.code.run';

    try {
        const sessionsRes = await fetch(`${LIVE_FLIGHTS_BACKEND}/if-sessions`);
        if (!sessionsRes.ok) {
            console.warn('Sector Ops Map: Could not fetch server sessions. Skipping secondary data update.');
            return;
        }
        const sessionsData = await sessionsRes.json();
        const expertSession = sessionsData.sessions.find(s => s.name.toLowerCase().includes('expert'));

        if (!expertSession) {
            console.warn('Sector Ops Map: Expert Server session not found.');
            return;
        }

        // --- MODIFIED: Removed 'flightsRes' from Promise.all ---
        const [atcRes, notamsRes] = await Promise.all([
            fetch(`${LIVE_FLIGHTS_BACKEND}/atc/${expertSession.id}`),
            fetch(`${LIVE_FLIGHTS_BACKEND}/notams/${expertSession.id}`)
        ]);
        
        // Update ATC & NOTAMs (Unchanged)
        if (atcRes.ok) {
            const atcData = await atcRes.json();
            activeAtcFacilities = (atcData.ok && Array.isArray(atcData.atc)) ? atcData.atc : [];
        }
        if (notamsRes.ok) {
            const notamsData = await notamsRes.json();
            activeNotams = (notamsData.ok && Array.isArray(notamsData.notams)) ? notamsData.notams : [];
        }
        // Re-render airport markers with fresh ATC data
        renderAirportMarkers(); 

        // --- REMOVED: All flight processing logic ('flightsRes', 'flightsData', loops) ---
        // This is now handled by 'handleSocketFlightUpdate'

    } catch (error) {
        console.error('Error updating Sector Ops secondary data (ATC/NOTAMs):', error);
    }
}
    // ====================================================================
    // END: NEW LIVE FLIGHTS & ATC/NOTAM LOGIC FOR SECTOR OPS MAP
    // ====================================================================

    /**
     * Main view switching logic.
     */
    const switchView = (viewId) => {
        sidebarNav.querySelector('.nav-link.active')?.classList.remove('active');
        mainContentContainer.querySelector('.content-view.active')?.classList.remove('active');

        // --- FIX: START ---
        // Explicitly hide Sector Ops pop-out windows and their recall buttons
        // when switching away to prevent them from appearing over other tabs.
        if (viewId !== 'view-rosters') {
            const airportWindow = document.getElementById('airport-info-window');
            const aircraftWindow = document.getElementById('aircraft-info-window');
            const airportRecall = document.getElementById('airport-recall-btn');
            const aircraftRecall = document.getElementById('aircraft-recall-btn');

            if (airportWindow) airportWindow.classList.remove('visible');
            if (aircraftWindow) aircraftWindow.classList.remove('visible');
            if (airportRecall) airportRecall.classList.remove('visible');
            if (aircraftRecall) aircraftRecall.classList.remove('visible');

            // NEW: Stop the PFD update interval when leaving the view
            if (activePfdUpdateInterval) {
                clearInterval(activePfdUpdateInterval);
                activePfdUpdateInterval = null;
            }
        }
        // --- FIX: END ---

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
            profilePictureElem.src = pilot.imageUrl || 'Images/default-avatar.png';

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
        // The pilot.currentRoster field holds the ID of the active roster.
        if (!pilot.currentRoster) {
            return `<div class="content-card"><p>Error: On duty but no roster data found.</p></div>`;
        }

        try {
            // --- START OF FIX ---
            // Fetch the specific active roster using the new endpoint, and PIREPs in parallel.
            const [rosterRes, pirepsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/rosters/by-id/${pilot.currentRoster}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/me/pireps`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (!rosterRes.ok) throw new Error('Could not load your assigned roster details.');
            if (!pirepsRes.ok) throw new Error('Could not load your duty details.');

            const [currentRoster, allPireps] = await Promise.all([rosterRes.json(), pirepsRes.json()]);
            // --- END OF FIX ---

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

        // MODIFIED: Global listener for "Plan Flight" buttons
        const planButton = target.closest('.plan-flight-from-explorer-btn');
        if (planButton) {
            try {
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
                
                // Close the map window if it is open
                if(airportInfoWindow && airportInfoWindow.classList.contains('visible')) {
                    document.getElementById('airport-window-close-btn').click();
                }
            } catch (error) {
                console.error("Error parsing route data from button:", error);
                showNotification("Could not load flight data from this button.", "error");
            }
        }

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
                                         onerror="this.onerror=null; this.src='Images/default-aircraft.png'; this.alt='Image not available';">
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

    // NEW: Inject all custom CSS needed for new features
    injectCustomStyles();

    // --- [NEW] Inject Mobile Toggle Button & Overlay ---
    const dashboardContainer = document.querySelector('.dashboard-container');
    if (dashboardContainer) {
        dashboardContainer.insertAdjacentHTML('afterbegin', `
            <button id="mobile-sidebar-toggle" class="mobile-sidebar-toggle-btn" aria-label="Open sidebar">
                <i class="fa-solid fa-bars"></i>
            </button>
            <div id="mobile-nav-overlay" class="mobile-nav-overlay"></div>
        `);
    }
    // --- End of New Injection ---

    // Fetch essential data in parallel
    await Promise.all([
        fetchMapboxToken(),
        fetchAirportsData(),
        fetchRunwaysData()
    ]);

    await fetchPilotData();

    // Initial view setup
    const urlParams = new URLSearchParams(window.location.search);
    const initialView = urlParams.get('view') || 'view-duty-status';
    switchView(initialView);

    // Sidebar state (Desktop)
    if (window.innerWidth > 992 && localStorage.getItem('sidebarState') === 'collapsed') {
        dashboardContainer.classList.add('sidebar-collapsed');
    }

    sidebarToggleBtn.addEventListener('click', () => {
        dashboardContainer.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarState', dashboardContainer.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded');
        
        if (sectorOpsMap) {
            setTimeout(() => sectorOpsMap.resize(), 400); 
        }
    });

    // --- [NEW] Mobile Sidebar Event Listeners ---
    const mobileToggleBtn = document.getElementById('mobile-sidebar-toggle');
    const mobileOverlay = document.getElementById('mobile-nav-overlay');
    const sidebar = document.querySelector('.sidebar');

    if (mobileToggleBtn && mobileOverlay && dashboardContainer && sidebar) {
        // Open/close with the button
        mobileToggleBtn.addEventListener('click', () => {
            dashboardContainer.classList.toggle('sidebar-mobile-open');
        });

        // Close by clicking the overlay
        mobileOverlay.addEventListener('click', () => {
            dashboardContainer.classList.remove('sidebar-mobile-open');
        });

        // Close sidebar when a nav link is clicked
        sidebar.addEventListener('click', (e) => {
            if (e.target.closest('.nav-link')) {
                dashboardContainer.classList.remove('sidebar-mobile-open');
            }
        });
    }
    // --- End of New Mobile Listeners ---

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