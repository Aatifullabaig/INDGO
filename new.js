// Crew Center – Merged Script with Mobile HUD, Desktop Pop-out, & Pilot Stats
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
    let ALL_AVAILABLE_ROUTES = [];
    let runwaysData = {};

    // --- Map-related State ---
    let liveFlightsMap = null;
    let pilotMarkers = {};
    let liveFlightsInterval = null;
    let sectorOpsMap = null;
    let airportAndAtcMarkers = {};
    let sectorOpsMapRouteLayers = [];
    let sectorOpsLiveFlightPathLayers = {};
    let sectorOpsLiveFlightsInterval = null;
    let activeAtcFacilities = [];
    let activeNotams = [];
    let atcPopup = null;
    let airportInfoWindow = null;
    let airportInfoWindowRecallBtn = null;
    let currentAirportInWindow = null;
    let aircraftInfoWindow = null;
    let aircraftInfoWindowRecallBtn = null;
    let currentFlightInWindow = null;
    let activePfdUpdateInterval = null; // Used by both desktop and mobile
    let lastPfdState = { track_deg: 0, timestamp: 0, roll_deg: 0 };
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

    // --- [MERGED] Helper to inject custom CSS for ALL features (Desktop + Mobile) ---
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
    
            /* --- [NEW & IMPROVED] Clickable Pilot Name Button --- */
            .pilot-name-button {
                display: inline-flex; /* Use flexbox for easy alignment */
                align-items: center;
                gap: 8px; /* Space between name and icon */
                background-color: rgba(255, 255, 255, 0.05); /* Subtle background to stand out */
                border: 1px solid rgba(255, 255, 255, 0.1); /* Faint border */
                padding: 4px 10px; /* Give it some comfortable spacing */
                margin: 0;
                font-size: 0.9rem; /* Slightly larger for clarity */
                font-weight: 500;
                color: #c5cae9;
                cursor: pointer;
                border-radius: 20px; /* This creates the "pill" shape */
                transition: all 0.2s ease-in-out;
                line-height: 1;
            }
            .pilot-name-button:hover,
            .pilot-name-button:focus {
                background-color: #00a8ff; /* Use your brand's accent color on hover */
                color: #fff; /* White text for contrast */
                border-color: #00a8ff;
                transform: translateY(-2px) scale(1.03); /* Add a little "pop" effect */
                box-shadow: 0 4px 15px rgba(0, 168, 255, 0.3);
            }
            .pilot-name-button .fa-solid {
                margin: 0; /* Remove the old margin */
                font-size: 0.8rem;
            }
    
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
            
            /* --- [NEW] Pilot Report Rehaul --- */
            .stats-rehaul-container .stats-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
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
                margin-top: 20px;
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
    
            /* --- [NEW & MERGED] Responsive Media Query for Mobile --- */
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
                
                .main-content:has(#view-rosters.active) {
                    padding: 0; /* Remove ALL padding (top, right, bottom, left) */
                    height: 100vh; /* Set height to 100% of the viewport height */
                    overflow: hidden; /* Prevent the main container from scrolling */
                }
            
                /* --- [NEW] Flight HUD View (Mobile Only) --- */
                #flight-hud-view {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none; /* Pass clicks through to the map */
                    z-index: 1060; /* Above info window, below modals */
                    display: none; /* Hidden by default */
                }
                #flight-hud-view.visible {
                    display: block;
                }
    
                /* --- [NEW] Top Context Bar --- */
                #hud-top-bar {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: rgba(18, 20, 38, 0.75);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                    display: flex;
                    flex-direction: column; /* Stack elements vertically on mobile */
                    align-items: center;
                    padding: 8px 16px;
                    pointer-events: auto;
                    color: #e8eaf6;
                }
                .hud-route-info { text-align: center; order: 1; } /* Centered text */
                .hud-route-info h3 { margin: 0; font-size: 1.2rem; }
                .hud-route-info span { font-size: 0.9rem; color: #c5cae9; }
    
                .hud-aircraft-info {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    order: 2; /* Comes after route info */
                }
                #hud-aircraft-image {
                    width: 120px;
                    height: auto;
                    object-fit: contain;
                    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
                }
                #hud-phase {
                    background: rgba(0,0,0,0.3);
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                
                /* Actions are positioned absolutely to avoid affecting layout */
                .hud-actions { 
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    display: flex; 
                    flex-direction: column; /* Stack buttons vertically */
                    align-items: center; 
                    gap: 8px; 
                }
                .header-actions-btn {
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: #e8eaf6;
                    width: 36px; height: 36px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: grid;
                    place-items: center;
                    transition: all 0.2s;
                }
                .header-actions-btn:hover { background: #dc3545; color: #fff; }
    
    
                /* --- [NEW] Bottom Systems Panel --- */
                #hud-bottom-panel {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(18, 20, 38, 0.75);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
                    border-top-left-radius: 20px;
                    border-top-right-radius: 20px;
                    pointer-events: auto;
                    transition: height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
                    overflow: hidden;
                }
                #hud-bottom-panel.compact {
                    height: 80px;
                }
                #hud-bottom-panel.expanded {
                    height: 55vh; /* Takes up 55% of the viewport height */
                }
    
                .hud-panel-handle {
                    width: 100%;
                    text-align: center;
                    color: #9fa8da;
                    cursor: pointer;
                    padding: 4px 0;
                }
                .hud-panel-handle .fa-solid { transition: transform 0.4s; }
                #hud-bottom-panel.expanded .hud-panel-handle .fa-solid {
                    transform: rotate(180deg);
                }
    
                /* --- [NEW] Compact View Content --- */
                .hud-compact-view {
                    display: flex;
                    align-items: center;
                    justify-content: space-around;
                    padding: 0 16px 8px 16px;
                    opacity: 1;
                    transition: opacity 0.2s;
                }
                #compact-attitude-svg {
                    width: 100px;
                    height: 40px;
                    background: #1a1a1a;
                    border-radius: 4px;
                }
                #compact-attitude-group {
                    transition: transform 0.5s ease-out;
                }
                .hud-digital-readouts {
                    display: flex;
                    gap: 16px;
                    text-align: center;
                    color: #fff;
                }
                .readout label {
                    font-size: 0.7rem;
                    color: #c5cae9;
                    text-transform: uppercase;
                    display: block;
                }
                .readout span {
                    font-size: 1.2rem;
                    font-weight: 600;
                    font-family: 'Courier New', monospace;
                }
    
                /* --- [NEW] Expanded View Content --- */
                .hud-expanded-view {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: calc(100% - 24px); /* Full height minus handle */
                    opacity: 0;
                    transition: opacity 0.2s;
                    display: grid;
                    place-items: center;
                }
                #hud-bottom-panel.compact .hud-expanded-view {
                    pointer-events: none;
                    opacity: 0;
                }
                #hud-bottom-panel.expanded .hud-compact-view {
                    pointer-events: none;
                    opacity: 0;
                }
                #hud-bottom-panel.expanded .hud-expanded-view {
                    opacity: 1;
                }
    
                .hud-expanded-view #pfd-container {
                    height: 100%;
                    width: 100%;
                }
                .hud-expanded-view #pfd-container svg {
                    max-width: 100%;
                    max-height: 100%;
                    width: auto;
                    height: 100%;
                    background: none;
                }
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
            const response = await fetch('runways.json');
            if (!response.ok) throw new Error('Could not load runway data.');
            const rawRunways = await response.json();

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


    // --- ... (All other helper functions like getAircraftCategory, getDistanceKm, etc. remain here without changes) ...


    // --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---
    // --- START OF UI RENDERING LOGIC (MERGED & REFACTORED) ---
    // --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---

    /**
     * --- [NEW & MERGED] ---
     * This is the central function that decides which UI to show (Mobile HUD or Desktop Window).
     * It's called when a user clicks an aircraft on the Sector Ops map.
     */
    async function handleAircraftClick(flightProps, sessionId) {
        if (!flightProps || !flightProps.flightId) return;

        // Prevent re-fetch if the user clicks the same aircraft while its UI is already open.
        if (currentFlightInWindow === flightProps.flightId &&
            (document.getElementById('flight-hud-view')?.classList.contains('visible') ||
                aircraftInfoWindow.classList.contains('visible'))) {
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

        // --- UI ROUTER: Decide based on screen width ---
        const isMobile = window.innerWidth <= 992;

        try {
            // Fetch data once, regardless of UI
            const [planRes, routeRes] = await Promise.all([
                fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}/${flightProps.flightId}/plan`),
                fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}/${flightProps.flightId}/route`)
            ]);

            const planData = planRes.ok ? await planRes.json() : null;
            const plan = (planData && planData.ok) ? planData.plan : null;
            const routeData = routeRes.ok ? await routeRes.json() : null;

            // Show the appropriate UI
            if (isMobile) {
                // Mobile Path: Create and show the HUD
                createHudView(flightProps, plan);
            } else {
                // Desktop Path: Show the existing info window
                aircraftInfoWindow.classList.add('visible');
                aircraftInfoWindowRecallBtn.classList.remove('visible');
                const windowEl = document.getElementById('aircraft-info-window');
                windowEl.innerHTML = `<div class="spinner-small" style="margin: 2rem auto;"></div><p style="text-align: center;">Loading flight data...</p>`;

                cachedFlightDataForStatsView = { flightProps, plan };
                populateAircraftInfoWindow(flightProps, plan); // This is your original function for the desktop view
            }

            // --- Map Plotting (same for both mobile and desktop) ---
            const currentPosition = [flightProps.position.lon, flightProps.position.lat];
            const flownLayerId = `flown-path-${flightProps.flightId}`;
            let allCoordsForBounds = [currentPosition];

            const historicalRoute = (routeData?.ok && Array.isArray(routeData.route)) ?
                routeData.route.map(p => [p.longitude, p.latitude]) :
                [];

            if (historicalRoute.length > 0) {
                const densifiedPath = densifyRoute(historicalRoute, 30);
                const completeFlownPath = [...densifiedPath, currentPosition];
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
                sectorOpsLiveFlightPathLayers[flightProps.flightId] = { flown: flownLayerId, coordinates: completeFlownPath };
            }

            if (allCoordsForBounds.length > 1) {
                const bounds = allCoordsForBounds.reduce((b, coord) => b.extend(coord), new mapboxgl.LngLatBounds(allCoordsForBounds[0], allCoordsForBounds[0]));
                sectorOpsMap.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 1000 });
            }

            // --- Live Update Interval (feeds data to the correct UI) ---
            activePfdUpdateInterval = setInterval(async () => {
                try {
                    const freshDataRes = await fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}`);
                    if (!freshDataRes.ok) throw new Error("Flight data update failed.");

                    const allFlights = await freshDataRes.json();
                    const updatedFlight = allFlights.flights.find(f => f.flightId === flightProps.flightId);

                    if (updatedFlight && updatedFlight.position) {
                        // Update the correct UI based on which one is visible
                        if (isMobile) {
                            updateHudView(updatedFlight, plan);
                        } else {
                            updatePfdDisplay(updatedFlight.position);
                            updateAircraftInfoWindow(updatedFlight, plan); // Your original desktop update function
                        }

                        // Update map icon and flight path (code is the same for both)
                        const iconSource = sectorOpsMap.getSource('sector-ops-live-flights-source');
                        if (iconSource?._data) {
                            const currentData = iconSource._data;
                            const featureToUpdate = currentData.features.find(f => f.properties.flightId === flightProps.flightId);
                            if (featureToUpdate) {
                                featureToUpdate.geometry.coordinates = [updatedFlight.position.lon, updatedFlight.position.lat];
                                featureToUpdate.properties.heading = updatedFlight.position.track_deg || 0;
                                iconSource.setData(currentData);
                            }
                        }

                        const flightPathState = sectorOpsLiveFlightPathLayers[flightProps.flightId];
                        const pathSource = flightPathState ? sectorOpsMap.getSource(flightPathState.flown) : null;
                        if (flightPathState && pathSource && flightPathState.coordinates.length > 0) {
                            const newPosition = [updatedFlight.position.lon, updatedFlight.position.lat];
                            flightPathState.coordinates.push(newPosition);
                            pathSource.setData({
                                type: 'Feature',
                                geometry: { type: 'LineString', coordinates: flightPathState.coordinates }
                            });
                        }

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
            console.error("Error handling aircraft click:", error);
            if (isMobile) {
                const hudView = document.getElementById('flight-hud-view');
                if (hudView) hudView.innerHTML = `<p class="error-text">Could not load flight data.</p>`;
            } else {
                document.getElementById('aircraft-info-window').innerHTML = `<p class="error-text">Could not retrieve flight details.</p>`;
            }
        }
    }

    // --- --- --- [NEW FUNCTIONS FOR MOBILE HUD START] --- --- ---
    /**
     * Updates the simplified attitude indicator in the compact HUD view.
     */
    function updateCompactAttitudeIndicator(pitch, roll) {
        const attitudeGroup = document.getElementById('compact-attitude-group');
        const sky = document.getElementById('compact-sky');
        if (!attitudeGroup || !sky) return;

        const PITCH_SCALE = 1.5;
        const yOffset = pitch * PITCH_SCALE;

        attitudeGroup.setAttribute('transform', `rotate(${-roll} 50 20) translate(0 ${yOffset})`);
        sky.setAttribute('y', -50 - yOffset);
    }

    /**
     * Creates and populates the initial mobile HUD view.
     */
    function createHudView(flightProps, plan) {
        const existingHud = document.getElementById('flight-hud-view');
        if (existingHud) existingHud.remove();

        const hudHtml = `
            <div id="flight-hud-view">
                <div id="hud-top-bar">
                    <div class="hud-route-info">
                        <h3 id="hud-flight-number"></h3>
                        <span id="hud-route"></span>
                    </div>
                    <div class="hud-aircraft-info">
                        <img id="hud-aircraft-image" src="" alt="Aircraft Livery"/>
                        <span id="hud-phase"></span>
                    </div>
                    <div class="hud-actions">
                        <button id="hud-pilot-stats-btn" class="pilot-name-button">
                            <span id="hud-pilot-name"></span>
                            <i class="fa-solid fa-chart-simple"></i>
                        </button>
                        <button id="hud-close-btn" class="header-actions-btn" title="Close"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
                <div id="hud-bottom-panel" class="compact">
                    <div class="hud-panel-handle"><i class="fa-solid fa-chevron-up"></i></div>
                    <div class="hud-compact-view">
                        <svg id="compact-attitude-svg" viewBox="0 0 100 40">
                            <defs><clipPath id="compactAttitudeClip"><rect x="0" y="0" width="100" height="40" rx="4"></rect></clipPath></defs>
                            <g id="compact-attitude-group" clip-path="url(#compactAttitudeClip)">
                                <rect id="compact-sky" x="-50" y="-50" width="200" height="90" fill="#0596FF"></rect>
                                <rect id="compact-ground" x="-50" y="40" width="200" height="50" fill="#9A4710"></rect>
                            </g>
                            <path d="M 35 20 L 45 20 L 50 25 L 55 20 L 65 20 L 65 23 L 50 28 L 35 23 Z" fill="#FEFE03" stroke="black" stroke-width="0.5"></path>
                        </svg>
                        <div class="hud-digital-readouts">
                            <div class="readout"><label>SPD</label><span id="hud-compact-spd">---</span></div>
                            <div class="readout"><label>ALT</label><span id="hud-compact-alt">-----</span></div>
                            <div class="readout"><label>HDG</label><span id="hud-compact-hdg">---</span></div>
                        </div>
                    </div>
                    <div class="hud-expanded-view">
                         <div id="pfd-container">
                            <svg width="787" height="695" viewBox="0 0 787 695" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <g id="PFD" clip-path="url(#clip0_1_2890)">
                                    <g id="attitude_group"><rect id="Sky" x="-186" y="-222" width="1121" height="532" fill="#0596FF"/><rect id="Ground" x="-138" y="307" width="1024" height="527" fill="#9A4710"/></g>
                                    <rect id="Rectangle 1" x="-6" y="5" width="191" height="566" fill="#030309"/><rect id="Rectangle 9" x="609" width="185" height="566" fill="#030309"/><path id="Rectangle 2" d="M273.905 84.9424L180.983 183.181L-23 -9.76114L69.9218 -108L273.905 84.9424Z" fill="#030309"/><path id="Rectangle 8" d="M303.215 77.0814L187.591 147.198L42 -92.8829L157.624 -163L303.215 77.0814Z" fill="#030309"/><path id="Rectangle 7" d="M372.606 54.0171L244.59 97.5721L154.152 -168.242L282.169 -211.796L372.606 54.0171Z" fill="#030309"/><rect id="Rectangle 10" x="25" y="487.905" width="168.696" height="262.947" transform="rotate(-31.8041 25 487.905)" fill="#030309"/><rect id="Rectangle 14" width="67.3639" height="53.5561" transform="matrix(-0.972506 0.23288 0.23288 0.972506 482.512 537)" fill="#030309"/><rect id="Rectangle 19" width="80.8905" height="53.5561" transform="matrix(-0.999899 0.0142423 0.0142423 0.999899 442.882 549.506)" fill="#030309"/><rect id="Rectangle 18" width="46.2297" height="53.5561" transform="matrix(-0.988103 -0.153795 -0.153795 0.988103 369.916 549.11)" fill="#030309"/><rect id="Rectangle 17" width="46.2297" height="53.5561" transform="matrix(-0.940186 -0.340662 -0.340662 0.940186 337.709 546.749)" fill="#030309"/><rect id="Rectangle 16" width="46.2297" height="53.5561" transform="matrix(-0.940186 -0.340662 -0.340662 0.940186 299.709 531.749)" fill="#030309"/><rect id="Rectangle 15" x="387" y="587.269" width="168.696" height="262.947" transform="rotate(-27.6434 387 587.269)" fill="#030309"/><rect id="Rectangle 13" x="86" y="584.104" width="168.696" height="262.947" transform="rotate(-46.8648 86 584.104)" fill="#030309"/><rect id="Rectangle 11" x="527" y="532.777" width="168.696" height="262.947" transform="rotate(-51.9135 527 532.777)" fill="#030309"/><rect id="Rectangle 12" x="503" y="527.247" width="168.696" height="262.947" transform="rotate(-31.9408 503 527.247)" fill="#030309"/><rect id="Rectangle 6" x="456.715" y="60.2651" width="131.991" height="278.153" transform="rotate(-177.303 456.715 60.2651)" fill="#030309"/><rect id="Rectangle 5" x="525.118" y="90.4898" width="131.991" height="274.627" transform="rotate(-158.368 525.118 90.4898)" fill="#030309"/><rect id="Rectangle 4" x="570.695" y="127.633" width="109.94" height="223.222" transform="rotate(-142.051 570.695 127.633)" fill="#030309"/><rect id="Rectangle 3" x="613.292" y="189.098" width="99.2768" height="223.222" transform="rotate(-128.125 613.292 189.098)" fill="#030309"/><path id="Vector 3" d="M609 183V422.5" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 1" d="M185.5 425.5L185 180" stroke="#DBDBDC" stroke-width="4"/><path id="Vector 2" d="M185 181.502C185 181.502 269.8 52.0936 397 56.0907C524.2 60.0879 576.603 135.189 609 184" stroke="#DBDBDC" stroke-width="4"/><path id="Vector 4" d="M608.5 424.5C608.5 424.5 557 548 396 550.5C235 553 185 424.5 185 424.5" stroke="#DBDBDC" stroke-width="4"/><path id="Polygon 1" d="M396.252 65.2333L377.848 35.8138L414.647 35.8079L396.252 65.2333Z" fill="#E7F013"/><path id="Polygon 2" d="M407.919 38.9482L396.431 59.4193L384.446 38.7244L407.919 38.9482Z" fill="#030309"/><path id="Vector 6" d="M307 76L302 64.5L312 60.5L317 71" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 7" d="M279.5 91L268.5 73.5L259 79L269.5 97.5" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 8" d="M225 135L206.5 117" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 9" d="M477.153 71.5794L479.366 59.3018L489.886 61.5697L488.226 73.0218" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 10" d="M347.928 61.4888L346.352 49.0483L357.072 48.0112L358.929 59.4917" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 11" d="M435.153 59.5794L437.366 47.3018L447.886 49.5697L446.226 61.0218" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 12" d="M514.032 86.1754L522.756 72.2658L533.956 78.0405L525.5 93.5" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 13" d="M569.5 131.5L585.5 116" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 15" d="M183.5 193.5L173 187" stroke="#029705" stroke-width="4"/><path id="Vector 16" d="M184 203L173.5 196.5" stroke="#029705" stroke-width="4"/><path id="Vector 17" d="M610 193.5L619 188" stroke="#029705" stroke-width="3"/><path id="Vector 18" d="M610 199.5L619 194" stroke="#029705" stroke-width="3"/><line id="Line 1" x1="184" y1="211" x2="184" y2="184" stroke="#DBDBDC" stroke-width="2"/><line id="Line 2" x1="610" y1="211" x2="610" y2="184" stroke="#DBDBDC" stroke-width="2"/><rect id="altitude_bg" x="675" y="73" width="72" height="476" fill="#76767A"/><svg x="675" y="73" width="72" height="476"><g id="altitude_tape_group"></g></svg><g id="altitude_indicator_static"><rect id="altitude_1" x="675" y="280" width="73" height="49" fill="#030309"/><text id="altitude_readout_hundreds" x="740" y="316" fill="#00FF00" font-size="32" text-anchor="end" font-weight="bold">0</text><g id="altitude_tens_reel_container" clip-path="url(#tensReelClip)"><g id="altitude_tens_reel_group"></g></g><line id="Line 8" x1="669" y1="307" x2="618" y2="307" stroke="#DDDF07" stroke-width="8"/></g><path id="limit" d="M636 336.08L621.413 307.511L650.858 307.651L636 336.08Z" fill="#C477C6"/><path id="limit2" d="M636 279L650.722 307.5H621.278L636 279Z" fill="#C477C6"/><path id="limit3" d="M636 285L643.794 303H628.206L636 285Z" fill="#100010"/><path id="limit4" d="M636.191 329.14L628.276 311.242L643.534 310.999L636.191 329.14Z" fill="#030309"/><line id="Line 6" x1="746.5" y1="263" x2="746.5" y2="281" stroke="#ECED06" stroke-width="3"/><line id="Line 4" x1="746.5" y1="329" x2="746.5" y2="347" stroke="#ECED06" stroke-width="3"/><path id="Ellipse 1" d="M636 481C636 484.866 632.866 488 629 488C625.134 488 622 484.866 622 481C622 477.134 625.134 474 629 474C632.866 474 636 477.134 636 481Z" fill="#D9D9D9"/><path id="Ellipse 4" d="M636 147C636 150.866 632.866 154 629 154C625.134 154 622 150.866 622 147C622 143.134 625.134 140 629 140C632.866 140 636 143.134 636 147Z" fill="#D9D9D9"/><g id="Ellipse 3"><path d="M636 229C636 232.866 632.866 236 629 236C625.134 236 622 232.866 622 229C622 225.134 625.134 222 629 222C632.866 222 636 225.134 636 229Z" fill="#D9D9D9"/><path d="M636 395C636 398.866 632.866 402 629 402C625.134 402 622 398.866 622 395C622 391.134 625.134 388 629 388C632.866 388 636 391.134 636 395Z" fill="#D9D9D9"/></g><rect id="speed" x="28" y="73" width="97" height="477" fill="#76767A"/><svg x="28" y="73" width="97" height="477"><g id="speed_tape_group"></g></svg><g id="speed_indicator_static"><path id="Polygon 9" d="M128.036 311.591L150.451 301.561L150.513 321.482L128.036 311.591Z" fill="#FDFD03"/><path id="Vector 20" d="M137 311H96.5" stroke="#FDFD03" stroke-width="4"/><rect x="50" y="296" width="45" height="30" fill="black" stroke="#999" stroke-width="1"/><text id="speed_readout" x="72.5" y="318" fill="#00FF00" font-size="20" text-anchor="middle" font-weight="bold">0</text></g><path id="Vector 19" d="M19.5 311H31" stroke="#FDFD03" stroke-width="4"/><path id="Vector 21" d="M29 73H151.5" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 22" d="M28 549H151.5" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 23" d="M672.5 73H774" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 24" d="M672 548.5H773" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 25" d="M745 549.5L746 347" stroke="#E7E6E8" stroke-width="3"/><path id="Vector 26" d="M745 73V265" stroke="#E7E6E8" stroke-width="3"/><g id="wings"><rect id="Rectangle 21" x="280" y="315" width="11" height="25" fill="#030309"/><rect id="Rectangle 23" x="522" y="304" width="71" height="12" fill="#030309"/><rect id="Rectangle 22" x="512" y="305" width="13" height="35" fill="#030309"/><rect id="Rectangle 20" x="208" y="304" width="83" height="13" fill="#030309"/><g id="wing"><path d="M278.591 316.857H208V304H291.608V340H278.591V316.857Z" stroke="#FEFE03" stroke-width="3"/><path d="M511.392 340V304H595V316.857H524.409V340H511.392Z" stroke="#FEFE03" stroke-width="3"/></g></g><g id="middle"><rect id="middle_2" x="393" y="304" width="17" height="17" fill="#0CC704"/><rect id="Rectangle 24" x="395" y="307" width="13" height="11" fill="#030309"/></g><rect id="Rectangle 25" y="571" width="787" height="140" fill="#030309"/><rect id="header" x="243" y="599" width="326" height="66" fill="#76767A"/><g id="heading_indicator"><g id="heading_tape_container" clip-path="url(#headingClip)"><g id="heading_tape_group"></g></g><g id="heading_static_elements"><line x1="406" y1="620" x2="406" y2="635" stroke="#FDFD03" stroke-width="3"/><rect x="381" y="599" width="50" height="20" fill="black" stroke="#FFFFFF" stroke-width="1"/><text id="heading_readout" x="406" y="615" fill="#00FF00" font-size="16" text-anchor="middle" font-weight="bold">000</text></g></g><path id="Vector 27" d="M243 599V667" stroke="#FCFCFF" stroke-width="4"/><g id="Line 5"><line id="Line 5_2" x1="745" y1="264.5" x2="787" y2="264.5" stroke="#ECED06" stroke-width="3"/></g><line id="Line 6_2" x1="671" y1="279.5" x2="748" y2="279.5" stroke="#ECED06" stroke-width="3"/><line id="Line 7" x1="671" y1="329.5" x2="748" y2="329.5" stroke="#ECED06" stroke-width="3"/><line id="Line 3" x1="746" y1="345.5" x2="786" y2="345.5" stroke="#ECED06" stroke-width="3"/>
                                </g>
                                <defs><clipPath id="clip0_1_2890"><rect width="787" height="695" fill="white"/></clipPath><clipPath id="tensReelClip"><rect x="732" y="269" width="50" height="75"/></clipPath><clipPath id="headingClip"><rect x="243" y="620" width="326" height="45"/></clipPath></defs>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('view-rosters').insertAdjacentHTML('beforeend', hudHtml);

        const hudView = document.getElementById('flight-hud-view');
        const bottomPanel = document.getElementById('hud-bottom-panel');
        const handle = document.querySelector('.hud-panel-handle');
        const closeBtn = document.getElementById('hud-close-btn');
        const statsBtn = document.getElementById('hud-pilot-stats-btn');

        handle.addEventListener('click', () => {
            bottomPanel.classList.toggle('expanded');
            bottomPanel.classList.toggle('compact');
        });

        closeBtn.addEventListener('click', () => {
            hudView.classList.remove('visible');
            if (activePfdUpdateInterval) clearInterval(activePfdUpdateInterval);
            activePfdUpdateInterval = null;
            clearLiveFlightPath(currentFlightInWindow);
            currentFlightInWindow = null;
        });

        statsBtn.addEventListener('click', () => {
            const userId = statsBtn.dataset.userId;
            const username = statsBtn.dataset.username;
            if (userId) {
                aircraftInfoWindow.classList.add('visible');
                displayPilotStats(userId, username);
            }
        });

        createPfdDisplay();
        updateHudView(flightProps, plan);
        hudView.classList.add('visible');
    }

    /**
     * Updates all dynamic data in the mobile HUD view.
     */
    function updateHudView(flightProps, plan) {
        const pos = flightProps.position;
        const vs = pos.vs_fpm || 0;
        const altitude = pos.alt_ft || 0;
        const gs = pos.gs_kt || 0;
        const track = pos.track_deg || 0;
        const roll = pos.roll_deg || 0;
        const pitch = Math.max(-25, Math.min(25, (vs / 1000) * 4));

        // Update Top Bar
        document.getElementById('hud-flight-number').textContent = flightProps.callsign;
        document.getElementById('hud-pilot-name').textContent = flightProps.username || 'N/A';

        const statsBtn = document.getElementById('hud-pilot-stats-btn');
        statsBtn.dataset.userId = flightProps.userId;
        statsBtn.dataset.username = flightProps.username;

        const allWaypoints = plan?.flightPlanItems ? flattenWaypointsFromPlan(plan.flightPlanItems) : [];
        if (allWaypoints.length >= 2) {
            const departureIcao = allWaypoints[0]?.name || 'N/A';
            const arrivalIcao = allWaypoints[allWaypoints.length - 1]?.name || 'N/A';
            document.getElementById('hud-route').textContent = `${departureIcao} → ${arrivalIcao}`;
        }

        const imageElem = document.getElementById('hud-aircraft-image');
        const sanitize = (name) => (name || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '_');
        const aircraftName = flightProps.aircraft?.aircraftName || 'default';
        const liveryName = flightProps.aircraft?.liveryName || 'default';
        const imagePath = `/CommunityPlanes/${sanitize(aircraftName)}/${sanitize(liveryName)}.png`;
        if (imageElem.src !== imagePath) {
            imageElem.src = imagePath;
            imageElem.onerror = () => { imageElem.src = '/CommunityPlanes/default.png'; };
        }

        // Update Phase indicator
        const phaseIndicator = document.getElementById('hud-phase');
        const { flightPhase, phaseClass } = determineFlightPhase(flightProps, plan);
        phaseIndicator.textContent = flightPhase;
        phaseIndicator.className = `flight-phase-indicator ${phaseClass}`;

        // Update Compact Bottom Panel
        document.getElementById('hud-compact-spd').textContent = Math.round(gs);
        document.getElementById('hud-compact-alt').textContent = Math.round(altitude);
        document.getElementById('hud-compact-hdg').textContent = String(Math.round(track)).padStart(3, '0') + '°';
        updateCompactAttitudeIndicator(pitch, roll);

        // Update Expanded Bottom Panel (The Full PFD)
        updatePfdDisplay(pos);
    }
    // --- --- --- [NEW FUNCTIONS FOR MOBILE HUD END] --- --- ---


    /**
     * --- [UNCHANGED] This is your original function for the DESKTOP view.
     * It is now only called by handleAircraftClick on wider screens.
     */
    function populateAircraftInfoWindow(baseProps, plan) {
        // ... (This function remains mostly the same, it just builds the HTML structure)
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
                                    <g id="attitude_group"><rect id="Sky" x="-186" y="-222" width="1121" height="532" fill="#0596FF"/><rect id="Ground" x="-138" y="307" width="1024" height="527" fill="#9A4710"/></g>
                                    <rect id="Rectangle 1" x="-6" y="5" width="191" height="566" fill="#030309"/><rect id="Rectangle 9" x="609" width="185" height="566" fill="#030309"/><path id="Rectangle 2" d="M273.905 84.9424L180.983 183.181L-23 -9.76114L69.9218 -108L273.905 84.9424Z" fill="#030309"/><path id="Rectangle 8" d="M303.215 77.0814L187.591 147.198L42 -92.8829L157.624 -163L303.215 77.0814Z" fill="#030309"/><path id="Rectangle 7" d="M372.606 54.0171L244.59 97.5721L154.152 -168.242L282.169 -211.796L372.606 54.0171Z" fill="#030309"/><rect id="Rectangle 10" x="25" y="487.905" width="168.696" height="262.947" transform="rotate(-31.8041 25 487.905)" fill="#030309"/><rect id="Rectangle 14" width="67.3639" height="53.5561" transform="matrix(-0.972506 0.23288 0.23288 0.972506 482.512 537)" fill="#030309"/><rect id="Rectangle 19" width="80.8905" height="53.5561" transform="matrix(-0.999899 0.0142423 0.0142423 0.999899 442.882 549.506)" fill="#030309"/><rect id="Rectangle 18" width="46.2297" height="53.5561" transform="matrix(-0.988103 -0.153795 -0.153795 0.988103 369.916 549.11)" fill="#030309"/><rect id="Rectangle 17" width="46.2297" height="53.5561" transform="matrix(-0.940186 -0.340662 -0.340662 0.940186 337.709 546.749)" fill="#030309"/><rect id="Rectangle 16" width="46.2297" height="53.5561" transform="matrix(-0.940186 -0.340662 -0.340662 0.940186 299.709 531.749)" fill="#030309"/><rect id="Rectangle 15" x="387" y="587.269" width="168.696" height="262.947" transform="rotate(-27.6434 387 587.269)" fill="#030309"/><rect id="Rectangle 13" x="86" y="584.104" width="168.696" height="262.947" transform="rotate(-46.8648 86 584.104)" fill="#030309"/><rect id="Rectangle 11" x="527" y="532.777" width="168.696" height="262.947" transform="rotate(-51.9135 527 532.777)" fill="#030309"/><rect id="Rectangle 12" x="503" y="527.247" width="168.696" height="262.947" transform="rotate(-31.9408 503 527.247)" fill="#030309"/><rect id="Rectangle 6" x="456.715" y="60.2651" width="131.991" height="278.153" transform="rotate(-177.303 456.715 60.2651)" fill="#030309"/><rect id="Rectangle 5" x="525.118" y="90.4898" width="131.991" height="274.627" transform="rotate(-158.368 525.118 90.4898)" fill="#030309"/><rect id="Rectangle 4" x="570.695" y="127.633" width="109.94" height="223.222" transform="rotate(-142.051 570.695 127.633)" fill="#030309"/><rect id="Rectangle 3" x="613.292" y="189.098" width="99.2768" height="223.222" transform="rotate(-128.125 613.292 189.098)" fill="#030309"/><path id="Vector 3" d="M609 183V422.5" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 1" d="M185.5 425.5L185 180" stroke="#DBDBDC" stroke-width="4"/><path id="Vector 2" d="M185 181.502C185 181.502 269.8 52.0936 397 56.0907C524.2 60.0879 576.603 135.189 609 184" stroke="#DBDBDC" stroke-width="4"/><path id="Vector 4" d="M608.5 424.5C608.5 424.5 557 548 396 550.5C235 553 185 424.5 185 424.5" stroke="#DBDBDC" stroke-width="4"/><path id="Polygon 1" d="M396.252 65.2333L377.848 35.8138L414.647 35.8079L396.252 65.2333Z" fill="#E7F013"/><path id="Polygon 2" d="M407.919 38.9482L396.431 59.4193L384.446 38.7244L407.919 38.9482Z" fill="#030309"/><path id="Vector 6" d="M307 76L302 64.5L312 60.5L317 71" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 7" d="M279.5 91L268.5 73.5L259 79L269.5 97.5" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 8" d="M225 135L206.5 117" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 9" d="M477.153 71.5794L479.366 59.3018L489.886 61.5697L488.226 73.0218" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 10" d="M347.928 61.4888L346.352 49.0483L357.072 48.0112L358.929 59.4917" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 11" d="M435.153 59.5794L437.366 47.3018L447.886 49.5697L446.226 61.0218" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 12" d="M514.032 86.1754L522.756 72.2658L533.956 78.0405L525.5 93.5" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 13" d="M569.5 131.5L585.5 116" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 15" d="M183.5 193.5L173 187" stroke="#029705" stroke-width="4"/><path id="Vector 16" d="M184 203L173.5 196.5" stroke="#029705" stroke-width="4"/><path id="Vector 17" d="M610 193.5L619 188" stroke="#029705" stroke-width="3"/><path id="Vector 18" d="M610 199.5L619 194" stroke="#029705" stroke-width="3"/><line id="Line 1" x1="184" y1="211" x2="184" y2="184" stroke="#DBDBDC" stroke-width="2"/><line id="Line 2" x1="610" y1="211" x2="610" y2="184" stroke="#DBDBDC" stroke-width="2"/><rect id="altitude_bg" x="675" y="73" width="72" height="476" fill="#76767A"/><svg x="675" y="73" width="72" height="476"><g id="altitude_tape_group"></g></svg><g id="altitude_indicator_static"><rect id="altitude_1" x="675" y="280" width="73" height="49" fill="#030309"/><text id="altitude_readout_hundreds" x="740" y="316" fill="#00FF00" font-size="32" text-anchor="end" font-weight="bold">0</text><g id="altitude_tens_reel_container" clip-path="url(#tensReelClip)"><g id="altitude_tens_reel_group"></g></g><line id="Line 8" x1="669" y1="307" x2="618" y2="307" stroke="#DDDF07" stroke-width="8"/></g><path id="limit" d="M636 336.08L621.413 307.511L650.858 307.651L636 336.08Z" fill="#C477C6"/><path id="limit2" d="M636 279L650.722 307.5H621.278L636 279Z" fill="#C477C6"/><path id="limit3" d="M636 285L643.794 303H628.206L636 285Z" fill="#100010"/><path id="limit4" d="M636.191 329.14L628.276 311.242L643.534 310.999L636.191 329.14Z" fill="#030309"/><line id="Line 6" x1="746.5" y1="263" x2="746.5" y2="281" stroke="#ECED06" stroke-width="3"/><line id="Line 4" x1="746.5" y1="329" x2="746.5" y2="347" stroke="#ECED06" stroke-width="3"/><path id="Ellipse 1" d="M636 481C636 484.866 632.866 488 629 488C625.134 488 622 484.866 622 481C622 477.134 625.134 474 629 474C632.866 474 636 477.134 636 481Z" fill="#D9D9D9"/><path id="Ellipse 4" d="M636 147C636 150.866 632.866 154 629 154C625.134 154 622 150.866 622 147C622 143.134 625.134 140 629 140C632.866 140 636 143.134 636 147Z" fill="#D9D9D9"/><g id="Ellipse 3"><path d="M636 229C636 232.866 632.866 236 629 236C625.134 236 622 232.866 622 229C622 225.134 625.134 222 629 222C632.866 222 636 225.134 636 229Z" fill="#D9D9D9"/><path d="M636 395C636 398.866 632.866 402 629 402C625.134 402 622 398.866 622 395C622 391.134 625.134 388 629 388C632.866 388 636 391.134 636 395Z" fill="#D9D9D9"/></g><rect id="speed" x="28" y="73" width="97" height="477" fill="#76767A"/><svg x="28" y="73" width="97" height="477"><g id="speed_tape_group"></g></svg><g id="speed_indicator_static"><path id="Polygon 9" d="M128.036 311.591L150.451 301.561L150.513 321.482L128.036 311.591Z" fill="#FDFD03"/><path id="Vector 20" d="M137 311H96.5" stroke="#FDFD03" stroke-width="4"/><rect x="50" y="296" width="45" height="30" fill="black" stroke="#999" stroke-width="1"/><text id="speed_readout" x="72.5" y="318" fill="#00FF00" font-size="20" text-anchor="middle" font-weight="bold">0</text></g><path id="Vector 19" d="M19.5 311H31" stroke="#FDFD03" stroke-width="4"/><path id="Vector 21" d="M29 73H151.5" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 22" d="M28 549H151.5" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 23" d="M672.5 73H774" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 24" d="M672 548.5H773" stroke="#E7E6E8" stroke-width="4"/><path id="Vector 25" d="M745 549.5L746 347" stroke="#E7E6E8" stroke-width="3"/><path id="Vector 26" d="M745 73V265" stroke="#E7E6E8" stroke-width="3"/><g id="wings"><rect id="Rectangle 21" x="280" y="315" width="11" height="25" fill="#030309"/><rect id="Rectangle 23" x="522" y="304" width="71" height="12" fill="#030309"/><rect id="Rectangle 22" x="512" y="305" width="13" height="35" fill="#030309"/><rect id="Rectangle 20" x="208" y="304" width="83" height="13" fill="#030309"/><g id="wing"><path d="M278.591 316.857H208V304H291.608V340H278.591V316.857Z" stroke="#FEFE03" stroke-width="3"/><path d="M511.392 340V304H595V316.857H524.409V340H511.392Z" stroke="#FEFE03" stroke-width="3"/></g></g><g id="middle"><rect id="middle_2" x="393" y="304" width="17" height="17" fill="#0CC704"/><rect id="Rectangle 24" x="395" y="307" width="13" height="11" fill="#030309"/></g><rect id="Rectangle 25" y="571" width="787" height="140" fill="#030309"/><rect id="header" x="243" y="599" width="326" height="66" fill="#76767A"/><g id="heading_indicator"><g id="heading_tape_container" clip-path="url(#headingClip)"><g id="heading_tape_group"></g></g><g id="heading_static_elements"><line x1="406" y1="620" x2="406" y2="635" stroke="#FDFD03" stroke-width="3"/><rect x="381" y="599" width="50" height="20" fill="black" stroke="#FFFFFF" stroke-width="1"/><text id="heading_readout" x="406" y="615" fill="#00FF00" font-size="16" text-anchor="middle" font-weight="bold">000</text></g></g><path id="Vector 27" d="M243 599V667" stroke="#FCFCFF" stroke-width="4"/><g id="Line 5"><line id="Line 5_2" x1="745" y1="264.5" x2="787" y2="264.5" stroke="#ECED06" stroke-width="3"/></g><line id="Line 6_2" x1="671" y1="279.5" x2="748" y2="279.5" stroke="#ECED06" stroke-width="3"/><line id="Line 7" x1="671" y1="329.5" x2="748" y2="329.5" stroke="#ECED06" stroke-width="3"/><line id="Line 3" x1="746" y1="345.5" x2="786" y2="345.5" stroke="#ECED06" stroke-width="3"/>
                                </g>
                                <defs><clipPath id="clip0_1_2890"><rect width="787" height="695" fill="white"/></clipPath><clipPath id="tensReelClip"><rect x="732" y="269" width="50" height="75"/></clipPath><clipPath id="headingClip"><rect x="243" y="620" width="326" height="45"/></clipPath></defs>
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

        const aircraftTypeReadout = document.getElementById('aircraft-type-readout');
        const aircraftTypeValue = document.getElementById('aircraft-type-value');
        const aircraftName = baseProps.aircraft?.aircraftName || 'Unknown Type';

        if (aircraftTypeReadout && aircraftTypeValue) {
            aircraftTypeValue.textContent = aircraftName;
            const manufacturerClass = getAircraftManufacturerClass(aircraftName);
            aircraftTypeReadout.classList.add(manufacturerClass);
        }
    }


    /**
     * --- [REFACTORED] Updates the NON-PFD parts of the Aircraft Info Window by calling the new helper.
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
        let progress = 0,
            ete = '--:--',
            distanceToDestNM = 0;
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

        // --- REFACTORED PART ---
        // Call the single helper function to get all phase information.
        const { flightPhase, phaseClass, phaseIcon } = determineFlightPhase(baseProps, plan);
        // --- END OF REFACTORED PART ---

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

        if (footerGS) footerGS.innerHTML = `${Math.round(baseProps.position.gs_kt || 0)}<span class="unit">kts</span>`;
        if (footerVS) footerVS.innerHTML = `<i class="fa-solid ${baseProps.position.vs_fpm > 100 ? 'fa-arrow-up' : baseProps.position.vs_fpm < -100 ? 'fa-arrow-down' : 'fa-minus'}"></i> ${Math.round(baseProps.position.vs_fpm || 0)}<span class="unit">fpm</span>`;
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
            const imagePath = `/CommunityPlanes/${sanitizeFilename(aircraftName)}/${sanitizeFilename(liveryName)}.png`;

            if (aircraftImageElement.dataset.currentPath !== imagePath) {
                aircraftImageElement.src = imagePath;
                aircraftImageElement.dataset.currentPath = imagePath;
                aircraftImageElement.onerror = function() {
                    this.onerror = null;
                    this.src = '/CommunityPlanes/default.png';
                    this.dataset.currentPath = '/CommunityPlanes/default.png';
                };
            }
        }
    }

    /**
     * --- [NEW HELPER] Extracts flight phase logic to be used by both Mobile and Desktop UIs.
     * This contains the large state machine from your original updateAircraftInfoWindow function.
     */
    function determineFlightPhase(baseProps, plan) {
        // --- Configuration Thresholds ---
        const THRESHOLD = {
            ON_GROUND_AGL: 75, PARKED_MAX_GS: 2, TAXI_MAX_GS: 35,
            TAKEOFF_MIN_VS: 300, TAKEOFF_CEILING_AGL: 1500, CLIMB_MIN_VS: 500,
            DESCENT_MIN_VS: -500, TERMINAL_AREA_DIST_NM: 40, APPROACH_PROGRESS_MIN: 5,
            LANDING_CEILING_AGL: 500, CRUISE_MIN_ALT_MSL: 18000, CRUISE_VS_TOLERANCE: 500,
            RUNWAY_PROXIMITY_NM: 1.5, RUNWAY_HEADING_TOLERANCE: 25,
            LANDING_FLARE_MAX_GS: 220, APPROACH_CEILING_AGL: 2500,
        };

        // --- Flight Phase State Machine Logic (Moved from updateAircraftInfoWindow) ---
        let flightPhase = 'ENROUTE';
        let phaseClass = 'phase-enroute';
        let phaseIcon = 'fa-route';

        const vs = baseProps.position.vs_fpm || 0;
        const altitude = baseProps.position.alt_ft || 0;
        const gs = baseProps.position.gs_kt || 0;
        const aircraftPos = { lat: baseProps.position.lat, lon: baseProps.position.lon, track_deg: baseProps.position.track_deg };

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

        let departureIcao = null, arrivalIcao = null, progress = 0, distanceToDestNM = 0, totalDistanceNM = 0;
        if(hasPlan) {
            departureIcao = allWaypoints[0]?.name?.trim().toUpperCase();
            arrivalIcao = allWaypoints[allWaypoints.length - 1]?.name?.trim().toUpperCase();
            
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
            }
        }
        
        let nearestRunwayInfo = null;
        if (hasPlan) {
            if (distanceToDestNM < totalDistanceNM / 2 && arrivalIcao) {
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

        const isOnGround = (altitudeAGL !== null && altitudeAGL < THRESHOLD.ON_GROUND_AGL) || (altitudeAGL === null && gs < THRESHOLD.TAXI_MAX_GS && Math.abs(vs) < 150);
        const isLinedUpForLanding = nearestRunwayInfo && nearestRunwayInfo.airport === arrivalIcao && nearestRunwayInfo.headingDiff < THRESHOLD.RUNWAY_HEADING_TOLERANCE;

        if (isOnGround) {
            if (gs <= THRESHOLD.PARKED_MAX_GS) {
                flightPhase = 'PARKED'; phaseIcon = 'fa-parking'; phaseClass = 'phase-enroute';
            } else if (gs <= THRESHOLD.TAXI_MAX_GS) {
                flightPhase = 'TAXIING'; phaseIcon = 'fa-road'; phaseClass = 'phase-enroute';
            } else { 
                if (progress > 90) { flightPhase = 'LANDING ROLLOUT'; phaseClass = 'phase-approach'; phaseIcon = 'fa-plane-arrival'; } 
                else if (progress < 10) { flightPhase = 'TAKEOFF ROLL'; phaseClass = 'phase-climb'; phaseIcon = 'fa-plane-departure';} 
                else { flightPhase = 'HIGH-SPEED TAXI'; phaseIcon = 'fa-road'; phaseClass = 'phase-enroute'; }
            }
        } else {
            if (isLinedUpForLanding && altitudeAGL !== null && altitudeAGL < THRESHOLD.APPROACH_CEILING_AGL) {
                if (altitudeAGL < 60 && vs < -50) { flightPhase = 'FLARE'; } 
                else if (altitudeAGL < THRESHOLD.LANDING_CEILING_AGL) { flightPhase = 'SHORT FINAL'; } 
                else { flightPhase = 'FINAL APPROACH'; }
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
        
        return { flightPhase, phaseClass, phaseIcon };
    }

    // --- ... (The rest of your script, including PFD logic, event listeners, initializeApp, etc., remains below without any changes) ...
    
    // ... all other functions from crew-center.js ...

});