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
            
            /* --- [OVERHAUL] Base Info Window Styles (Refined Glassmorphism) --- */
            .info-window {
                position: absolute;
                top: 20px;
                right: 20px;
                width: 420px;
                max-width: 90vw;
                max-height: calc(100vh - 40px);
                background: rgba(18, 20, 38, 0.75);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                border-radius: 16px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 12px 40px rgba(0,0,0,0.6);
                z-index: 1050;
                display: none;
                flex-direction: column;
                overflow: hidden;
                color: #e8eaf6;
                transition: opacity 0.3s ease, transform 0.3s ease;
                opacity: 0;
                transform: translateX(20px);
            }
            .info-window.visible { 
                display: flex; 
                opacity: 1;
                transform: translateX(0);
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

            /* --- [REDESIGNED] UNIFIED FLIGHT DISPLAY FOR AIRCRAFT WINDOW --- */
            .unified-display-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                gap: 0;
                font-family: 'Segoe UI', sans-serif;
                background: rgba(10, 12, 26, 0.5);
            }
            
            .unified-display-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: linear-gradient(135deg, rgba(30, 35, 70, 0.8), rgba(15, 20, 45, 0.9));
                border-radius: 12px;
                padding: 10px 16px;
                margin: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #e8eaf6;
                flex-shrink: 0;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            }
            
            .header-actions { display: flex; align-items: center; gap: 12px; }
            .flight-main-details { line-height: 1.2; }
            .flight-main-details h3 { margin: 0; font-size: 1.6rem; font-weight: 700; color: #fff; letter-spacing: 1px; }

            /* --- [NEW] Clickable Pilot Name Button --- */
            .pilot-name-button {
                background: none;
                border: none;
                padding: 2px 6px;
                margin: 0;
                font-size: 0.85rem;
                color: #c5cae9;
                opacity: 0.8;
                cursor: pointer;
                border-radius: 4px;
                transition: all 0.2s ease-in-out;
            }
            .pilot-name-button:hover {
                background-color: rgba(255, 255, 255, 0.1);
                color: #fff;
                opacity: 1;
            }
            .pilot-name-button .fa-solid { margin-left: 6px; }

            /* --- [NEW] Wrapper for Image and Overlay Route --- */
            .image-and-route-wrapper {
                position: relative;
                background: rgba(10, 12, 26, 0.5);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                overflow: hidden;
            }

            /* --- [NEW] Aircraft Image Display --- */
            .aircraft-image-container {
                width: 100%;
                height: 180px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .aircraft-image-container img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                background-color: rgba(0,0,0,0.2);
            }

            /* --- [MODIFIED] Flight Details Panel (now overlaid) --- */
            .flight-details-panel {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                padding: 8px 12px;
                background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.0));
                z-index: 10;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .flight-route-display {
                display: grid;
                grid-template-columns: auto 1fr auto;
                align-items: center;
                gap: 12px;
                color: #e8eaf6;
            }
            .route-point { display: flex; align-items: center; gap: 8px; }
            .route-point.arrival { flex-direction: row-reverse; }
            .route-point .icao { font-size: 1.6rem; font-weight: 700; font-family: 'Courier New', monospace; color: #fff; }
            .route-point .fa-solid { font-size: 1.1rem; color: #00a8ff; }
            .route-progress-container { display: flex; flex-direction: column; }


            /* [NEW] Redesigned Hide/Close Buttons */
            .header-actions button {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #e8eaf6;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                display: grid;
                place-items: center;
                transition: all 0.2s ease-in-out;
            }
            .header-actions button:hover {
                background: #00a8ff;
                color: #fff;
                transform: scale(1.1);
                border-color: transparent;
            }

            /* [MODIFIED] Progress Bar */
            .route-progress-bar-container {
                width: 100%;
                height: 6px;
                background: rgba(10, 12, 26, 0.7);
                border-radius: 3px;
                overflow: hidden;
            }
            .progress-bar-fill {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #00a8ff, #89f7fe);
                transition: width 0.5s ease-out;
                border-radius: 3px;
            }


            /* [MODIFIED] Upgraded Flight Phase Indicator */
            .flight-phase-indicator {
                position: relative;
                top: auto;
                left: auto;
                transform: none;
                margin: 0 auto 8px auto;
                width: fit-content;
                padding: 6px 16px;
                border-radius: 20px;
                font-size: 0.8rem;
                font-weight: 700;
                color: #fff;
                display: flex;
                align-items: center;
                gap: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(5px);
                transition: all 0.4s ease-out;
            }
            .flight-phase-indicator .fa-solid {
                font-size: 0.9rem;
            }
            /* Phase-specific colors */
            .phase-climb { background: rgba(34, 139, 34, 0.7); box-shadow: 0 0 12px rgba(34, 139, 34, 0.8); }
            .phase-cruise { background: rgba(0, 119, 255, 0.7); box-shadow: 0 0 12px rgba(0, 119, 255, 0.8); }
            .phase-descent { background: rgba(255, 140, 0, 0.7); box-shadow: 0 0 12px rgba(255, 140, 0, 0.8); }
            .phase-approach { background: rgba(138, 43, 226, 0.7); box-shadow: 0 0 12px rgba(138, 43, 226, 0.8); }
            .phase-enroute { background: rgba(100, 110, 130, 0.7); box-shadow: 0 0 12px rgba(100, 110, 130, 0.8); }

            .unified-display-main {
                flex-grow: 1;
                display: grid;
                grid-template-columns: 1fr 140px;
                gap: 16px;
                min-height: 0;
                overflow: hidden;
                padding: 12px;
            }
            .pfd-side-panel {
                display: flex;
                flex-direction: column;
                gap: 12px;
                justify-content: space-around;
            }
            .readout-box {
                background: rgba(10, 12, 26, 0.6);
                padding: 10px; border-radius: 8px; text-align: center;
            }
            .readout-box .label {
                font-size: 0.7rem; text-transform: uppercase; color: #c5cae9;
                margin-bottom: 4px;
            }
            .readout-box .value {
                font-size: 1.3rem; font-weight: 600; color: #fff;
                font-family: 'Courier New', monospace;
                line-height: 1.1;
            }
            .readout-box .value .unit { font-size: 0.8rem; color: #9fa8da; margin-left: 2px;}
            .readout-box .value .fa-solid { font-size: 0.8rem; margin-right: 4px; color: #00a8ff; }


            /* --- [UPGRADED & RESIZED] PFD (Primary Flight Display) Styles --- */
            #pfd-container {
                display: grid;
                place-items: center;
                background: rgba(10, 12, 26, 0.5);
                border-radius: 12px;
                overflow: hidden;
                min-width: 0;
            }
            #pfd-container svg {
                width: 100%;
                height: auto;
                max-width: 350px;
                aspect-ratio: 787 / 695;
                background-color: #1a1a1a;
                font-family: monospace, sans-serif;
                color: white;
                overflow: hidden;
                position: relative;
                border-radius: 8px;
            }
            #pfd-container svg #attitude_group {
                transition: transform 0.5s ease-out;
            }

            /* --- [NEW] Aircraft Type Display --- */
            .pfd-main-panel {
                display: flex;
                flex-direction: column;
                gap: 12px;
                min-width: 0;
            }
            #aircraft-type-readout .value {
                font-size: 1.05rem;
                font-family: 'Segoe UI', sans-serif;
                font-weight: 500;
                color: #fff;
                padding: 4px 0;
                line-height: 1.2;
            }
            #aircraft-type-readout .fa-solid {
                color: #9fa8da;
            }

            /* --- Manufacturer Color Codes --- */
            .aircraft-type-airbus { border-left: 4px solid #00a8ff; }
            .aircraft-type-boeing { border-left: 4px solid #ffc107; }
            .aircraft-type-bombardier { border-left: 4px solid #dc3545; }
            .aircraft-type-embraer { border-left: 4px solid #28a745; }
            .aircraft-type-mcdonnell-douglas { border-left: 4px solid #ff8c00; }
            .aircraft-type-de-havilland { border-left: 4px solid #6f42c1; }
            .aircraft-type-unknown { border-left: 4px solid #6c757d; }
            
            /* --- [NEW] Pilot Stats View --- */
            .pilot-stats-view { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
            .stats-header { text-align: center; margin-bottom: 8px; }
            .stats-header h4 { margin: 0; font-size: 1.3rem; color: #fff; }
            .stats-header p { margin: 0; font-size: 0.9rem; color: #c5cae9; }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; }
            .grade-table-container { background: rgba(10, 12, 26, 0.6); border-radius: 8px; padding: 12px; }
            .grade-table-container h5 { margin: 0 0 10px 0; text-align: center; }
            .grade-item { font-size: 0.85rem; padding: 8px; border-radius: 4px; transition: background-color 0.2s; }
            .grade-item.current-grade { background-color: rgba(0, 168, 255, 0.2); border-left: 3px solid #00a8ff; }
            .grade-item strong { color: #fff; }
            .grade-requirement { display: flex; align-items: center; gap: 6px; margin-left: 10px; font-size: 0.8rem; color: #c5cae9;}
            .grade-requirement .fa-check { color: #28a745; }
            .grade-requirement .fa-times { color: #dc3545; }
            /* --- [REHAULED] Pilot Stats View --- */
.stats-rehaul-container {
    padding: 16px;
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
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
    font-size: 0.75rem;
    color: #c5cae9;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}
.kpi-value {
    font-size: 1.5rem;
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

.details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 16px;
    background: rgba(10, 12, 26, 0.6);
    padding: 16px;
    border-radius: 8px;
}
.detail-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
}
.detail-item:last-child, .detail-item:nth-last-child(2) { border-bottom: none; }
.detail-label { color: #c5cae9; }
.detail-value { color: #fff; font-weight: 600; }
            .back-to-pfd-btn { 
                background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
                color: #e8eaf6; padding: 8px 12px; width: 100%;
                border-radius: 6px; cursor: pointer; text-align: center;
                transition: all 0.2s;
            }
            .back-to-pfd-btn:hover { background: #00a8ff; color: #fff; }


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

    // --- Helper Functions ---

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
            { ident: runway.le_ident, lat: runway.le_latitude_deg, lon: runway.le_longitude_deg, heading: runway.le_heading_degT },
            { ident: runway.he_ident, lat: runway.he_latitude_deg, lon: runway.he_longitude_deg, heading: runway.he_heading_degT }
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
    
    // --- [MODIFIED] Event listener setup using Event Delegation ---
    function setupAircraftWindowEvents() {
        if (!aircraftInfoWindow || aircraftInfoWindow.dataset.eventsAttached === 'true') return;
    
        aircraftInfoWindow.addEventListener('click', async (e) => {
            const closeBtn = e.target.closest('.aircraft-window-close-btn');
            const hideBtn = e.target.closest('.aircraft-window-hide-btn');
            const statsBtn = e.target.closest('.pilot-name-button');
            const backToPfdBtn = e.target.closest('.back-to-pfd-btn');

            if (closeBtn) {
                aircraftInfoWindow.classList.remove('visible');
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

            if (statsBtn) {
                const userId = statsBtn.dataset.userId;
                const username = statsBtn.dataset.username;
                if (userId) {
                    await displayPilotStats(userId, username);
                }
            }

            if (backToPfdBtn) {
                const { flightProps, plan } = cachedFlightDataForStatsView;
                if (flightProps) {
                    // Repopulate the PFD view and restart the update loop
                     const sessionsRes = await fetch('https://acars-backend-uxln.onrender.com/if-sessions');
                     const expertSession = (await sessionsRes.json()).sessions.find(s => s.name.toLowerCase().includes('expert'));
                     if (expertSession) {
                        handleAircraftClick(flightProps, expertSession.id);
                     }
                }
            }
        });
    
        // The recall button logic remains largely the same.
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
                        
                        fetch('https://acars-backend-uxln.onrender.com/if-sessions').then(res => res.json()).then(data => {
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
                    '/Images/whiteplane.png',
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

    /**
     * --- [REMODEL V4 - FULL SYNC] Handles aircraft clicks, data fetching, map plotting, and window population.
     */
    async function handleAircraftClick(flightProps, sessionId) {
        if (!flightProps || !flightProps.flightId) return;

        // FIX: Prevent re-fetch if the user clicks the same aircraft while its window is already open.
        if (currentFlightInWindow === flightProps.flightId && aircraftInfoWindow.classList.contains('visible')) {
            return;
        }

        resetPfdState();

        if (currentFlightInWindow && currentFlightInWindow !== flightProps.flightId) {
            clearLiveFlightPath(currentFlightInWindow);
        }
        if (activePfdUpdateInterval) {
            clearInterval(activePfdUpdateInterval);
            activePfdUpdateInterval = null;
        }

        currentFlightInWindow = flightProps.flightId;
        aircraftInfoWindow.classList.add('visible');
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
            
            // NEW: Cache data for stats view
            cachedFlightDataForStatsView = { flightProps, plan };
            populateAircraftInfoWindow(flightProps, plan);

            const currentPosition = [flightProps.position.lon, flightProps.position.lat];
            const flownLayerId = `flown-path-${flightProps.flightId}`;
            let allCoordsForBounds = [currentPosition];

            const historicalRoute = (routeData && routeData.ok && Array.isArray(routeData.route)) 
                ? routeData.route.map(p => [p.longitude, p.latitude]) 
                : [];
            
            if (historicalRoute.length > 0) {
                const completeFlownPath = [...historicalRoute, currentPosition];
                allCoordsForBounds.push(...historicalRoute);

                if (!sectorOpsMap.getSource(flownLayerId)) {
                    sectorOpsMap.addSource(flownLayerId, {
                        type: 'geojson',
                        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: completeFlownPath } }
                    });
                    sectorOpsMap.addLayer({
                        id: flownLayerId,
                        type: 'line',
                        source: flownLayerId,
                        paint: { 'line-color': '#00b894', 'line-width': 4, 'line-opacity': 0.9 }
                    }, 'sector-ops-live-flights-layer');
                }
            }
            
            sectorOpsLiveFlightPathLayers[flightProps.flightId] = { flown: flownLayerId };

            if (allCoordsForBounds.length > 1) {
                const bounds = allCoordsForBounds.reduce((b, coord) => b.extend(coord), new mapboxgl.LngLatBounds(allCoordsForBounds[0], allCoordsForBounds[0]));
                sectorOpsMap.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 1000 });
            }
            
            activePfdUpdateInterval = setInterval(async () => {
                try {
                    const freshDataRes = await fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}`);
                    if (!freshDataRes.ok) throw new Error("Flight data update failed.");
                    
                    const allFlights = await freshDataRes.json();
                    const updatedFlight = allFlights.flights.find(f => f.flightId === flightProps.flightId);

                    if (updatedFlight && updatedFlight.position) {
                        // --- Logic to update the info window (Unchanged) ---
                        updatePfdDisplay(updatedFlight.position);
                        updateAircraftInfoWindow(updatedFlight, plan);
                        
                        // --- Logic to update the aircraft's icon on the map (Unchanged) ---
                        const iconSource = sectorOpsMap.getSource('sector-ops-live-flights-source');
                        if (iconSource && iconSource._data) {
                            const currentData = iconSource._data;
                            const featureToUpdate = currentData.features.find(f => f.properties.flightId === flightProps.flightId);
                            if (featureToUpdate) {
                                featureToUpdate.geometry.coordinates = [updatedFlight.position.lon, updatedFlight.position.lat];
                                featureToUpdate.properties.heading = updatedFlight.position.track_deg || 0;
                                iconSource.setData(currentData);
                            }
                        }
                        
                        // --- NEW LOGIC to update the flown path ---
                        const pathSource = sectorOpsMap.getSource(flownLayerId);
                        if (pathSource && pathSource._data) {
                            const pathData = pathSource._data;
                            const newPosition = [updatedFlight.position.lon, updatedFlight.position.lat];

                            // Add the new point to the end of the line's coordinates array
                            pathData.geometry.coordinates.push(newPosition);

                            // Update the source to redraw the longer line
                            pathSource.setData(pathData);
                        }
                        // --- END OF NEW LOGIC ---

                    } else {
                        clearInterval(activePfdUpdateInterval);
                        activePfdUpdateInterval = null;
                    }
                } catch (error) {
                    console.error("Stopping PFD update due to error:", error);
                    clearInterval(activePfdUpdateInterval);
                    activePfdUpdateInterval = null;
                }
            }, 3000);

        } catch (error) {
            console.error("Error fetching or plotting aircraft details:", error);
            windowEl.innerHTML = `<p class="error-text" style="padding: 2rem;">Could not retrieve complete flight details. The aircraft may have landed or disconnected.</p>`;
        }
    }

    /**
     * --- [REDESIGNED & UPDATED] Generates the "Unified Flight Display" with image overlay and aircraft type.
     */
    function populateAircraftInfoWindow(baseProps, plan) {
        const windowEl = document.getElementById('aircraft-info-window');
    
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
    
        windowEl.innerHTML = `
            <div class="unified-display-container">
                <div class="unified-display-header">
                    <div class="flight-main-details">
                        <h3 id="header-flight-num">${baseProps.callsign}</h3>
                        <button class="pilot-name-button" data-user-id="${baseProps.userId}" data-username="${baseProps.username || 'N/A'}">
                            ${baseProps.username || 'N/A'}
                            <i class="fa-solid fa-chart-simple"></i>
                        </button>
                    </div>
                    <div class="header-actions">
                        <button id="aircraft-window-hide-btn-new" class="aircraft-window-hide-btn" title="Hide"><i class="fa-solid fa-compress"></i></button>
                        <button id="aircraft-window-close-btn-new" class="aircraft-window-close-btn" title="Close"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>

                <div class="image-and-route-wrapper">
                    <div class="aircraft-image-container">
                        <img id="dynamic-aircraft-image" src="" alt="Aircraft Image">
                    </div>
                    <div class="flight-details-panel">
                        <div class="flight-route-display">
                            <div class="route-point departure">
                                <span class="icao">${departureIcao}</span>
                                <i class="fa-solid fa-plane-departure"></i>
                            </div>
                            <div class="route-progress-container">
                                 <div class="flight-phase-indicator" id="flight-phase-indicator"></div>
                                 <div class="route-progress-bar-container">
                                    <div class="progress-bar-fill" id="header-progress-bar"></div>
                                </div>
                            </div>
                            <div class="route-point arrival">
                                 <i class="fa-solid fa-plane-arrival"></i>
                                <span class="icao">${arrivalIcao}</span>
                            </div>
                        </div>
                    </div>
                </div>
    
                <div class="unified-display-main">
                    <div class="pfd-main-panel">
                        <div id="pfd-container">
                            <svg width="787" height="695" viewBox="0 0 787 695" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                        <div class="readout-box" id="aircraft-type-readout">
                            <div class="label"><i class="fa-solid fa-plane-circle-check"></i> Aircraft Type</div>
                            <div class="value" id="aircraft-type-value">---</div>
                        </div>
                    </div>
    
                    <div class="pfd-side-panel">
                         <div class="readout-box"><div class="label">Ground Speed</div><div class="value" id="footer-gs">---<span class="unit">kts</span></div></div>
                         <div class="readout-box"><div class="label">Vertical Speed</div><div class="value" id="footer-vs">---<span class="unit">fpm</span></div></div>
                         <div class="readout-box"><div class="label">Dist. to Dest.</div><div class="value" id="footer-dist">---<span class="unit">NM</span></div></div>
                         <div class="readout-box"><div class="label">ETE</div><div class="value" id="footer-ete">--:--</div></div>
                    </div>
                </div>
            </div>
        `;
        
        createPfdDisplay();
        updatePfdDisplay(baseProps.position);
        updateAircraftInfoWindow(baseProps, plan);
        
        // --- [NEW] Logic to populate the aircraft type box ---
        const aircraftTypeReadout = document.getElementById('aircraft-type-readout');
        const aircraftTypeValue = document.getElementById('aircraft-type-value');
        
        // This 'aircraft' object is part of the live flight data from the ACARS backend
        const aircraftName = baseProps.aircraft?.aircraftName || 'Unknown Type';

        if (aircraftTypeReadout && aircraftTypeValue) {
            aircraftTypeValue.textContent = aircraftName;
            const manufacturerClass = getAircraftManufacturerClass(aircraftName);
            // Add the new class without removing the base 'readout-box' class
            aircraftTypeReadout.classList.add(manufacturerClass);
        }
    }

    // --- [NEW - CORRECTED] Renders the creative Pilot Stats view inside the info window ---
/**
 * --- [OVERHAULED] Renders a data-rich, modern Pilot Report view.
 * Focuses on current and next grade progression, and detailed stats.
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
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
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
        totalViolations: (stats.violationCountByLevel?.level1 || 0) +
                         (stats.violationCountByLevel?.level2 || 0) +
                         (stats.violationCountByLevel?.level3 || 0)
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
    const createProgressCard = (title, gradeData, isNextGrade = false) => {
        if (!gradeData) {
            // This handles the max grade scenario
            return `
            <div class="progress-card complete">
                <h4><i class="fa-solid fa-crown"></i> Max Grade Achieved</h4>
                <p>Congratulations, you have reached the highest available grade!</p>
            </div>`;
        }
        
        const reqXp = getRuleValue(gradeData.rules, 'XP');
        const reqVios = getRuleValue(gradeData.rules, 'All Level 2/3 Violations (1 year)');

        const xpProgress = reqXp > 0 ? Math.min(100, (stats.totalXP / reqXp) * 100) : 100;
        const viosMet = stats.total12MonthsViolations <= reqVios;

        return `
            <div class="progress-card">
                <h4>${title}</h4>
                <div class="progress-item">
                    <div class="progress-label">
                        <span><i class="fa-solid fa-star"></i> XP</span>
                        <span>${stats.totalXP.toLocaleString()} / ${reqXp.toLocaleString()}</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fg" style="width: ${xpProgress.toFixed(1)}%;"></div>
                    </div>
                </div>
                <div class="progress-item">
                    <div class="progress-label">
                        <span><i class="fa-solid fa-shield-halved"></i> 1-Year Violations</span>
                        <span class="${viosMet ? 'req-met' : 'req-not-met'}">
                            ${stats.total12MonthsViolations} / ${reqVios} max
                            <i class="fa-solid ${viosMet ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                        </span>
                    </div>
                </div>
            </div>`;
    };
    
    // --- Final HTML Assembly ---
    return `
        <div class="stats-rehaul-container">
            <div class="stats-header">
                <h4>Pilot Report</h4>
                <p>${username}</p>
            </div>

            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-label"><i class="fa-solid fa-user-shield"></i> Grade</div>
                    <div class="kpi-value">${kpis.grade}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label"><i class="fa-solid fa-star"></i> Total XP</div>
                    <div class="kpi-value">${kpis.xp}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label"><i class="fa-solid fa-headset"></i> ATC Rank</div>
                    <div class="kpi-value">${kpis.atcRank}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label"><i class="fa-solid fa-triangle-exclamation"></i> Total Violations</div>
                    <div class="kpi-value">${kpis.totalViolations}</div>
                </div>
            </div>

            <h5 class="section-title">Grade Progression</h5>
            <div class="progression-container">
                ${createProgressCard(`Current: Grade ${kpis.grade}`, currentGrade)}
                ${createProgressCard(`Next: Grade ${nextGrade?.name.replace('Grade ', '') || ''}`, nextGrade, true)}
            </div>

            <h5 class="section-title">Detailed Statistics</h5>
            <div class="details-grid">
                 <div class="detail-item">
                    <span class="detail-label">Level 1 Violations</span>
                    <span class="detail-value">${details.lvl1Vios}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Level 2 Violations</span>
                    <span class="detail-value">${details.lvl2Vios}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Level 3 Violations</span>
                    <span class="detail-value">${details.lvl3Vios}</span>
                </div>
                 <div class="detail-item">
                    <span class="detail-label">Last Violation Date</span>
                    <span class="detail-value">${details.lastViolation}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Flight Time (90 days)</span>
                    <span class="detail-value">${details.flightTime90d ? details.flightTime90d.toFixed(1) + ' hrs' : 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Landings (90 days)</span>
                    <span class="detail-value">${details.landings90d || 'N/A'}</span>
                </div>
            </div>
            
            <button class="back-to-pfd-btn"><i class="fa-solid fa-arrow-left"></i> Back to Flight Display</button>
        </div>
    `;
}

    // --- [NEW] Fetches and displays the pilot stats ---
    async function displayPilotStats(userId, username) {
        if (!userId) return;
        const windowEl = document.getElementById('aircraft-info-window');
        
        // Stop the PFD updates while viewing stats
        if (activePfdUpdateInterval) {
            clearInterval(activePfdUpdateInterval);
            activePfdUpdateInterval = null;
        }

        windowEl.innerHTML = `<div class="spinner-small" style="margin: 2rem auto;"></div><p style="text-align: center;">Loading pilot report for ${username}...</p>`;

        try {
            const res = await fetch(`${ACARS_USER_API_URL}/${userId}/grade`);
            if (!res.ok) throw new Error('Could not fetch pilot data.');
            
            const data = await res.json();
            if (data.ok && data.gradeInfo) {
                windowEl.innerHTML = renderPilotStatsHTML(data.gradeInfo, username);
            } else {
                throw new Error('Pilot data not found or invalid.');
            }
        } catch (error) {
            console.error('Error fetching pilot stats:', error);
            windowEl.innerHTML = `<div class="pilot-stats-view">
                <p class="error-text">${error.message}</p>
                <button class="back-to-pfd-btn"><i class="fa-solid fa-arrow-left"></i> Back to Flight Display</button>
            </div>`;
        }
    }

    

 * --- [MAJOR REVISION V4 - CORRECTED] Updates the non-PFD parts of the Aircraft Info Window.
 * This version uses a priority-based state machine with robust fallbacks to fix issues
 * with ground operations and accurately detect all airborne phases.
 */
/**
 * --- [MAJOR REVISION V5 - RUNWAY AWARE] Updates the non-PFD parts of the Aircraft Info Window.
 * This version uses runway proximity and heading alignment for highly accurate
 * detection of takeoffs, landings, and approaches.
 */
function updateAircraftInfoWindow(baseProps, plan) {
    // Calculation logic for progress, ETE, etc.
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
    let progress = 0, ete = '--:--', distanceToDestNM = 0;
    let totalDistanceNM = 0;

    if (hasPlan) {
        let totalDistanceKm = 0;
        for (let i = 0; i < allWaypoints.length - 1; i++) {
            totalDistanceKm += getDistanceKm(allWaypoints[i].location.latitude, allWaypoints[i].location.longitude, allWaypoints[i + 1].location.latitude, allWaypoints[i + 1].location.longitude);
        }
        totalDistanceNM = totalDistanceKm / 1.852;

        if (totalDistanceNM > 0) {
            const destWp = allWaypoints[allWaypoints.length - 1];
            const remainingDistanceKm = getDistanceKm(baseProps.position.lat, baseProps.position.lon, destWp.location.latitude, destWp.location.longitude);
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

    // --- [RE-ARCHITECTED] Flight Phase State Machine ---
    let flightPhase = 'ENROUTE';
    let phaseClass = 'phase-enroute';
    let phaseIcon = 'fa-route';

    // --- Configuration Thresholds ---
    const THRESHOLD = {
        ON_GROUND_AGL: 75,
        PARKED_MAX_GS: 2,
        TAXI_MAX_GS: 45,
        TAKEOFF_MIN_VS: 300,
        TAKEOFF_CEILING_AGL: 1500,
        CLIMB_MIN_VS: 500,
        DESCENT_MIN_VS: -500,
        TERMINAL_AREA_DIST_NM: 40,
        APPROACH_PROGRESS_MIN: 5,
        LANDING_CEILING_AGL: 500,
        CRUISE_MIN_ALT_MSL: 18000,
        CRUISE_VS_TOLERANCE: 500,
        RUNWAY_PROXIMITY_NM: 2.0,           // NEW: Search radius for runways
        RUNWAY_HEADING_ALIGNMENT_DEG: 30,    // NEW: Max heading diff for approach
    };

    // --- Live Flight Data ---
    const vs = baseProps.position.vs_fpm || 0;
    const altitude = baseProps.position.alt_ft || 0;
    const gs = baseProps.position.gs_kt || 0;
    const aircraftPos = { lat: baseProps.position.lat, lon: baseProps.position.lon, track_deg: baseProps.position.track_deg };

    // --- Contextual Calculations ---
    const originIcao = plan?.origin?.icao_code;
    const destIcao = plan?.destination?.icao_code;
    const originElevationFt = (plan?.origin?.elevation_ft) ? parseFloat(plan.origin.elevation_ft) : null;
    const destElevationFt = (plan?.destination?.elevation_ft) ? parseFloat(plan.destination.elevation_ft) : null;
    const relevantElevationFt = (totalDistanceNM > 0 && distanceToDestNM < totalDistanceNM / 2) ? destElevationFt : originElevationFt;
    const altitudeAGL = (relevantElevationFt !== null) ? altitude - relevantElevationFt : null;

    const aglCheck = altitudeAGL !== null && altitudeAGL < THRESHOLD.ON_GROUND_AGL;
    const fallbackGroundCheck = altitudeAGL === null && gs < THRESHOLD.TAXI_MAX_GS && Math.abs(vs) < 150;
    const isOnGround = aglCheck || fallbackGroundCheck;
    
    const isInTerminalArea = hasPlan && distanceToDestNM < THRESHOLD.TERMINAL_AREA_DIST_NM && progress > THRESHOLD.APPROACH_PROGRESS_MIN;

    // NEW: Determine proximity and alignment with a runway at the relevant airport
    const relevantIcao = (hasPlan && progress > 50) ? destIcao : originIcao;
    const runwayProximity = relevantIcao ? getNearestRunway(aircraftPos, relevantIcao, THRESHOLD.RUNWAY_PROXIMITY_NM) : null;
    const isAlignedWithRunway = runwayProximity && runwayProximity.headingDiff < THRESHOLD.RUNWAY_HEADING_ALIGNMENT_DEG;


    // --- Priority-Based State Machine Logic ---
    if (isOnGround) {
        // PRIORITY 1: Ground Operations are definitive.
        if (gs <= THRESHOLD.PARKED_MAX_GS) {
            flightPhase = 'PARKED';
            phaseIcon = 'fa-parking';
            phaseClass = 'phase-enroute'; // Neutral color
        } else if (gs <= THRESHOLD.TAXI_MAX_GS) {
            flightPhase = 'TAXIING';
            phaseIcon = 'fa-road';
            phaseClass = 'phase-enroute'; // Neutral color
        } else {
            // High speed on the ground: Use runway data to distinguish takeoff from landing.
            if (runwayProximity) {
                 flightPhase = vs > 50 ? 'TAKEOFF ROLL' : 'LANDING ROLLOUT';
                 phaseIcon = vs > 50 ? 'fa-plane-departure' : 'fa-plane-arrival';
                 phaseClass = vs > 50 ? 'phase-climb' : 'phase-approach';
            } else {
                 flightPhase = 'HIGH SPEED ON GROUND'; // Fallback
                 phaseIcon = 'fa-fighter-jet';
                 phaseClass = 'phase-enroute';
            }
        }
    } else if (runwayProximity && vs > THRESHOLD.TAKEOFF_MIN_VS && altitudeAGL !== null && altitudeAGL < THRESHOLD.TAKEOFF_CEILING_AGL) {
        // PRIORITY 2: Confirmed Takeoff (just lifted off a known runway)
        flightPhase = 'TAKING OFF';
        phaseClass = 'phase-climb';
        phaseIcon = 'fa-plane-departure';
    } else if (isInTerminalArea && isAlignedWithRunway && altitudeAGL !== null && altitudeAGL < THRESHOLD.LANDING_CEILING_AGL) {
        // PRIORITY 3: Confirmed Landing (aligned, low, and near destination)
        flightPhase = 'LANDING';
        phaseClass = 'phase-approach';
        phaseIcon = 'fa-plane-arrival';
    } else if (isInTerminalArea && isAlignedWithRunway) {
        // PRIORITY 4: Confirmed Approach (aligned with runway near destination)
        flightPhase = 'APPROACH';
        phaseClass = 'phase-approach';
        phaseIcon = 'fa-plane-arrival';
    } else {
        // PRIORITY 5: Fallback to original enroute logic if no runway is detected
        if (vs > THRESHOLD.CLIMB_MIN_VS) {
            flightPhase = 'CLIMB';
            phaseClass = 'phase-climb';
            phaseIcon = 'fa-arrow-trend-up';
        } else if (vs < THRESHOLD.DESCENT_MIN_VS) {
            flightPhase = 'DESCENT';
            phaseClass = 'phase-descent';
            phaseIcon = 'fa-arrow-trend-down';
        } else if (altitude > THRESHOLD.CRUISE_MIN_ALT_MSL && Math.abs(vs) < THRESHOLD.CRUISE_VS_TOLERANCE) {
            flightPhase = 'CRUISE';
            phaseClass = 'phase-cruise';
            phaseIcon = 'fa-minus';
        } else {
            flightPhase = 'ENROUTE';
            phaseClass = 'phase-enroute';
            phaseIcon = 'fa-route';
        }
    }

    // --- Update DOM Elements ---
    const progressBarFill = document.getElementById('header-progress-bar');
    const phaseIndicator = document.getElementById('flight-phase-indicator');
    const footerGS = document.getElementById('footer-gs');
    const footerVS = document.getElementById('footer-vs');
    const footerDist = document.getElementById('footer-dist');
    const footerETE = document.getElementById('footer-ete');

    if (progressBarFill) progressBarFill.style.width = `${progress.toFixed(1)}%`;

    if (phaseIndicator) {
        phaseIndicator.className = `flight-phase-indicator ${phaseClass}`;
        phaseIndicator.innerHTML = `<i class="fa-solid ${phaseIcon}"></i> ${flightPhase}`;
    }

    if (footerGS) footerGS.innerHTML = `${Math.round(gs)}<span class="unit">kts</span>`;
    if (footerVS) footerVS.innerHTML = `<i class="fa-solid ${vs > 100 ? 'fa-arrow-up' : vs < -100 ? 'fa-arrow-down' : 'fa-minus'}"></i> ${Math.round(vs)}<span class="unit">fpm</span>`;
    if (footerDist) footerDist.innerHTML = `${Math.round(distanceToDestNM)}<span class="unit">NM</span>`;
    if (footerETE) footerETE.textContent = ete;

    const aircraftImageElement = document.getElementById('dynamic-aircraft-image');
    if (aircraftImageElement) {
        const sanitizeFilename = (name) => {
            if (!name || typeof name !== 'string') return 'unknown';
            return name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '_');
        };

        const aircraftName = baseProps.aircraft?.aircraftName || 'Generic Aircraft';
        const liveryName = baseProps.aircraft?.liveryName || 'Default Livery';

        const sanitizedAircraft = sanitizeFilename(aircraftName);
        const sanitizedLivery = sanitizeFilename(liveryName);

        const imagePath = `/CommunityPlanes/${sanitizedAircraft}/${sanitizedLivery}.png`;

        if (aircraftImageElement.dataset.currentPath !== imagePath) {
            aircraftImageElement.src = imagePath;
            aircraftImageElement.dataset.currentPath = imagePath; 
        }

        aircraftImageElement.onerror = function () {
            this.onerror = null;
            this.src = '/CommunityPlanes/default.png';
            this.dataset.currentPath = '/CommunityPlanes/default.png';
        };
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

    /**
     * Fetches all live data (flights, ATC, NOTAMs) and plots them on the Sector Ops map.
     */
    /**
     * Fetches all live data (flights, ATC, NOTAMs) and plots them on the Sector Ops map.
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

            // 2. Fetch ALL live data in parallel for efficiency
            const [flightsRes, atcRes, notamsRes] = await Promise.all([
                fetch(`${LIVE_FLIGHTS_BACKEND}/flights/${expertSession.id}`),
                fetch(`${LIVE_FLIGHTS_BACKEND}/atc/${expertSession.id}`),
                fetch(`${LIVE_FLIGHTS_BACKEND}/notams/${expertSession.id}`)
            ]);
            
            // 3. Process ATC and NOTAM data, then render all airport markers
            const atcData = await atcRes.json();
            activeAtcFacilities = (atcData.ok && Array.isArray(atcData.atc)) ? atcData.atc : [];
            
            const notamsData = await notamsRes.json();
            activeNotams = (notamsData.ok && Array.isArray(notamsData.notams)) ? notamsData.notams : [];

            renderAirportMarkers(); 

            // 4. Process flight data
            const flightsData = await flightsRes.json();
            if (!flightsData.ok || !Array.isArray(flightsData.flights)) {
                console.warn('Sector Ops Map: Could not fetch live flights.');
                return;
            }

            // --- START OF FIX: Prevent flickering by merging data ---
            const source = sectorOpsMap.getSource('sector-ops-live-flights-source');
            let finalFeatures = [];

            if (source && source._data && currentFlightInWindow) {
                // If a flight is selected, find its current feature on the map
                const selectedFeature = source._data.features.find(f => f.properties.flightId === currentFlightInWindow);
                
                // Process all other flights from the new API call
                const otherFlights = flightsData.flights.filter(f => f.flightId !== currentFlightInWindow);
                finalFeatures = otherFlights.map(flight => {
                    // (This mapping logic is the same as before)
                    if (!flight.position || flight.position.lat == null || flight.position.lon == null) return null;
                    return {
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [flight.position.lon, flight.position.lat] },
                        properties: {
                            flightId: flight.flightId, callsign: flight.callsign, username: flight.username,
                            altitude: flight.position.alt_ft, speed: flight.position.gs_kt, heading: flight.position.track_deg || 0,
                            verticalSpeed: flight.position.vs_fpm || 0, position: JSON.stringify(flight.position), aircraft: JSON.stringify(flight.aircraft),
                            userId: flight.userId // IMPORTANT: Pass userId for the stats feature
                        }
                    };
                }).filter(Boolean);

                // Add the selected flight's feature (from its last high-frequency update) back into the array
                if (selectedFeature) {
                    finalFeatures.push(selectedFeature);
                }
            } else {
                // If no flight is selected, just process all flights normally
                finalFeatures = flightsData.flights.map(flight => {
                    if (!flight.position || flight.position.lat == null || flight.position.lon == null) return null;
                    return {
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [flight.position.lon, flight.position.lat] },
                        properties: {
                            flightId: flight.flightId, callsign: flight.callsign, username: flight.username,
                            altitude: flight.position.alt_ft, speed: flight.position.gs_kt, heading: flight.position.track_deg || 0,
                            verticalSpeed: flight.position.vs_fpm || 0, position: JSON.stringify(flight.position), aircraft: JSON.stringify(flight.aircraft),
                             userId: flight.userId // IMPORTANT: Pass userId for the stats feature
                        }
                    };
                }).filter(Boolean);
            }
            // --- END OF FIX ---

            const geojsonData = { type: 'FeatureCollection', features: finalFeatures };

            // 5. Update the flight map source and layer
            if (source) {
                source.setData(geojsonData);
            } else {
                sectorOpsMap.addSource('sector-ops-live-flights-source', {
                    type: 'geojson',
                    data: geojsonData
                });

                sectorOpsMap.addLayer({
                    id: 'sector-ops-live-flights-layer',
                    type: 'symbol',
                    source: 'sector-ops-live-flights-source',
                    layout: {
                        'icon-image': 'plane-icon', 'icon-size': 0.07, 'icon-rotate': ['get', 'heading'],
                        'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true
                    }
                });

                sectorOpsMap.on('click', 'sector-ops-live-flights-layer', (e) => {
                    const props = e.features[0].properties;
                    const flightProps = { ...props, position: JSON.parse(props.position), aircraft: JSON.parse(props.aircraft) };
                    handleAircraftClick(flightProps, expertSession.id);
                });

                sectorOpsMap.on('mouseenter', 'sector-ops-live-flights-layer', () => { sectorOpsMap.getCanvas().style.cursor = 'pointer'; });
                sectorOpsMap.on('mouseleave', 'sector-ops-live-flights-layer', () => { sectorOpsMap.getCanvas().style.cursor = ''; });
            }

        } catch (error) {
            console.error('Error updating Sector Ops live data:', error);
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