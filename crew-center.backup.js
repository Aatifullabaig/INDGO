// Backup of crew-center.js — created before cleanup
// This file is an exact snapshot of crew-center.js at the time of backup.

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

        /* --- [NEW & IMPROVED] Clickable Pilot Name Button --- */
        .pilot-name-button {
            display: inline-flex; /* Use flexbox for easy alignment */
            align-items: center;
            gap: 8px; /* Space between name and icon */
            background-color: rgba(255, 255, 255, 0.05); /* Subtle background to stand out */
            border: 1px solid rgba(255, 255, 255, 0.1); /* Faint border */
            padding: 4px 10px; /* Give it some comfortable spacing */
            margin: 0,
