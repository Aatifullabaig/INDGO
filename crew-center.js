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

    const threeJS_Layer = {
        id: '3d-model-layer',
        type: 'custom',

        onAdd: function (map, gl) {
            this.camera = new THREE.Camera();
            this.scene = new THREE.Scene();

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
            this.scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(0, -70, 100).normalize();
            this.scene.add(directionalLight);

            this.map = map;

            this.renderer = new THREE.WebGLRenderer({
                canvas: map.getCanvas(),
                context: gl,
                antialias: true,
            });

            this.renderer.autoClear = false;
            this.loader = new THREE.GLTFLoader();
            this.model = null;
        },

        render: function (gl, matrix) {
            // =================================================================
            // --- FIX: Conditional Rendering ---
            // This is the primary fix. The render function now exits immediately
            // if there is no 3D model to display. This prevents the Three.js
            // renderer from interfering with Mapbox's own rendering loop,
            // which allows the 2D plane icons to show up correctly.
            if (!this.model) {
                return;
            }
            // =================================================================

            const m = new THREE.Matrix4().fromArray(matrix);

            // The heading is passed in degrees and converted to radians when the model is loaded.
            // We retrieve it here for the render loop.
            const headingRadians = this.model ? this.model.rotation.y : 0;

            // Define the necessary rotation matrices for orientation.
            const rotationX_pitch = new THREE.Matrix4().makeRotationX(Math.PI / 2); // Pitches the model to be level.
            const rotationY_offset = new THREE.Matrix4().makeRotationY(Math.PI);    // Corrects the model's default forward direction.
            const rotationZ_heading = new THREE.Matrix4().makeRotationZ(headingRadians); // Applies the live heading.

            // Build the final transformation matrix for the model.
            const l = new THREE.Matrix4()
                // 1. Translate the model to its correct geographic coordinates.
                .makeTranslation(this.modelPosition.x, this.modelPosition.y, this.modelPosition.z)
                
                // 2. Scale the model to an appropriate size.
                // FIX: Using a positive Y-scale to prevent the model from being flipped upside down.
                .scale(new THREE.Vector3(this.modelScale, this.modelScale, this.modelScale))
                
                // 3. Apply rotations in the correct order to orient the model.
                // The order of multiplication is crucial: pitch, then yaw offset, then heading.
                .multiply(rotationX_pitch)
                .multiply(rotationY_offset)
                .multiply(rotationZ_heading);

            this.camera.projectionMatrix.elements = matrix;
            this.camera.projectionMatrix = m.multiply(l);
            this.renderer.render(this.scene, this.camera);
            this.map.triggerRepaint();
        },

        displayModel: function(modelPath, lngLat, rotation = 0) {
    if (this.model) {
        this.scene.remove(this.model);
    }

    const modelAsMercator = mapboxgl.MercatorCoordinate.fromLngLat(lngLat, 0);
    this.modelPosition = { x: modelAsMercator.x, y: modelAsMercator.y, z: modelAsMercator.z };
    this.modelScale = modelAsMercator.meterInMercatorCoordinateUnits() * 1.5;

    this.loader.load(
        modelPath,
        (gltf) => {
            this.model = gltf.scene;

            // --- FIX FOR ALL MATERIAL PROPERTIES ---
            this.model.traverse((child) => {
                if (child.isMesh) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {
                        // --- ADD THIS LINE TO FIX TRANSPARENCY ---
                        material.depthWrite = true;

                        // --- Previous fixes (keep these) ---
                        material.transparent = false;
                        material.opacity = 1.0;
                        material.side = THREE.DoubleSide;
                        material.needsUpdate = true;
                        material.toneMapped = true;
                        material.emissiveIntensity = 0.2;
                    });
                }
            });

            // Add extra neutral lighting to brighten textures
            const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
            hemiLight.position.set(0, 200, 0);
            this.scene.add(hemiLight);

            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(50, 200, 100);
            this.scene.add(dirLight);

            // Make sure renderer uses correct tone mapping for GLTF
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.2;
            // --- END OF FIX ---

            this.model.rotation.y = rotation * (Math.PI / 180);
            this.scene.add(this.model);
            this.map.triggerRepaint();
        },
        undefined,
        (error) => {
            console.error('An error happened while loading the 3D model:', error);
        }
    );
},
        
        // =================================================================
        // --- FIX: Add Model Cleanup Function ---
        // This new helper function removes the 3D model from the scene.
        // It's called when the aircraft info window is closed to ensure
        // the model doesn't persist.
        clearModel: function() {
            if (this.model) {
                this.scene.remove(this.model);
                this.model = null;
                this.map.triggerRepaint();
            }
        }
        // =================================================================
    };

    // --- State Variables ---
    let MAPBOX_ACCESS_TOKEN = null;
    let DYNAMIC_FLEET = [];
    let CURRENT_PILOT = null;
    let ACTIVE_FLIGHT_PLANS = [];
    let CURRENT_OFP_DATA = null;
    let crewRestInterval = null;
    let airportsData = {};
    let ALL_AVAILABLE_ROUTES = [];

    // --- Map-related State ---
    let liveFlightsMap = null;
    let pilotMarkers = {};
    let liveFlightsInterval = null;
    let sectorOpsMap = null;
    let airportAndAtcMarkers = {};
    let sectorOpsMapRouteLayers = [];
    let sectorOpsLiveFlightPathLayerId = null;
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
            #view-rosters {
                display: grid;
                grid-template-columns: 1fr;
                grid-template-rows: 1fr;
                height: 100%;
                width: 100%;
                overflow: hidden;
                position: relative;
            }
            #sector-ops-map-fullscreen {
                grid-column: 1 / -1;
                grid-row: 1 / -1;
                width: 100%;
                height: 100%;
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
            .info-tab-content { display: none; padding: 20px; animation: fadeIn 0.4s; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            .info-tab-content.active { display: block; }
            .info-tab-content ul { list-style: none; padding: 0; margin: 0; }
            .info-tab-content li { padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
            .info-tab-content li:last-child { border-bottom: none; }
            .muted-text { color: #9fa8da; text-align: center; padding: 2rem; }

            /* --- [OVERHAUL] Aircraft Window: Modern Stats --- */
            .aircraft-info-header {
                padding: 20px; text-align: center;
                background: linear-gradient(135deg, rgba(0, 168, 255, 0.15), rgba(0, 100, 200, 0.25));
            }
            .aircraft-info-header .route-display { display: flex; justify-content: space-around; align-items: center; }
            .aircraft-info-header .icao { font-size: 2rem; font-weight: 700; color: #fff; }
            .aircraft-info-header .fa-plane { font-size: 1.5rem; color: #00a8ff; }
            
            .aircraft-info-body { padding: 20px; }
            .stat-grid {
                display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px;
            }
            .stat-box {
                background: rgba(10, 12, 26, 0.5); padding: 16px; border-radius: 10px;
                border-left: 4px solid #00a8ff; transition: transform 0.2s, box-shadow 0.2s;
            }
            .stat-box:hover { transform: translateY(-3px); box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
            .stat-box label { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #c5cae9; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
            .stat-box .stat-value { font-size: 1.6rem; font-weight: 600; color: #fff; }
            
            .flight-progress { margin-bottom: 20px; }
            .progress-labels { display: flex; justify-content: space-between; font-size: 0.85rem; color: #c5cae9; margin-bottom: 8px; }
            .flight-progress-bar { width: 100%; height: 12px; background-color: rgba(10, 12, 26, 0.7); border-radius: 6px; overflow: hidden; }
            .flight-progress-bar-inner {
                height: 100%; width: 0%; border-radius: 6px;
                background: linear-gradient(90deg, #00a8ff, #005f9e);
                transition: width 0.5s ease-out; 
                display:flex; align-items:center; justify-content:flex-end;
                box-shadow: 0 0 10px rgba(0, 168, 255, 0.5);
            }
            .progress-bar-label { color: white; font-size: 0.7rem; font-weight: bold; padding-right: 5px; }
            
            .flight-plan-route-box {
                background: rgba(10, 12, 26, 0.5); padding: 16px; border-radius: 10px;
            }
            .flight-plan-route-box label { font-size: 0.8rem; color: #c5cae9; margin-bottom: 10px; display: block; text-transform: uppercase; }
            .flight-plan-route-box code {
                display: block; white-space: pre-wrap; word-break: break-all;
                font-family: 'Courier New', Courier, monospace;
                font-size: 0.95rem; color: #e8eaf6; background: none; padding: 0; line-height: 1.6;
            }

            /* Toolbar Recall Buttons */
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

        return `<span>${rankName}</span>`;
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

    async function createAirportInfoWindowHTML(icao) {
        const atcForAirport = activeAtcFacilities.filter(f => f.airportName === icao);
        const notamsForAirport = activeNotams.filter(n => n.airportIcao === icao);
        const routesFromAirport = ALL_AVAILABLE_ROUTES.filter(r => r.departure === icao);

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
            <div id="airport-routes" class="info-tab-content active">
                ${routesHtml}
            </div>
            <div id="airport-atc" class="info-tab-content">
                ${atcHtml}
            </div>
            <div id="airport-notams" class="info-tab-content">
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

    const promotionModal = document.getElementById('promotion-modal');
    const arriveFlightModal = document.getElementById('arrive-flight-modal');

    // --- Auth Check ---
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // --- Mapbox Plotting Functions ---
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

    function startLiveLoop() {
        if (!liveFlightsInterval) {
            updateLiveFlights();
            liveFlightsInterval = setInterval(updateLiveFlights, 20000);
        }
    }

    function removeFlightPathLayers(map) {
        if (map.getLayer('flown-path')) map.removeLayer('flown-path');
        if (map.getSource('flown-path-source')) map.removeSource('flown-path-source');
        if (map.getLayer('planned-path')) map.removeLayer('planned-path');
        if (map.getSource('planned-path-source')) map.removeSource('planned-path-source');
    }

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
                    const entry = pilotMarkers[flightId];
                    entry.marker.setLngLat(lngLat);
                    entry.marker.getElement().style.transform = `rotate(${pos.track_deg ?? 0}deg)`;
                } else {
                    const el = document.createElement('div');
                    el.className = 'plane-marker';
                    const marker = new mapboxgl.Marker(el).setLngLat(lngLat).addTo(liveFlightsMap);
                    pilotMarkers[flightId] = { marker: marker };

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

                            const flownCoords = (routeRes.ok && routeJson.ok && Array.isArray(routeJson.route)) ? routeJson.route.map(p => [p.lon, p.lat]) : [];
                            if (flownCoords.length > 1) {
                                allCoordsForBounds.push(...flownCoords);
                                liveFlightsMap.addSource('flown-path-source', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: flownCoords } } });
                                liveFlightsMap.addLayer({ id: 'flown-path', type: 'line', source: 'flown-path-source', paint: { 'line-color': '#00b894', 'line-width': 4 } });
                            }

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
    // START: SECTOR OPS / ROUTE EXPLORER LOGIC
    // ==========================================================
    
    function setupAirportWindowEvents() {
        if (!airportInfoWindow || airportInfoWindow.dataset.eventsAttached === 'true') return;

        const closeBtn = document.getElementById('airport-window-close-btn');
        const hideBtn = document.getElementById('airport-window-hide-btn');

        closeBtn.addEventListener('click', () => {
            airportInfoWindow.classList.remove('visible');
            airportInfoWindowRecallBtn.classList.remove('visible');
            clearRouteLayers();
            currentAirportInWindow = null;
        });

        hideBtn.addEventListener('click', () => {
            airportInfoWindow.classList.remove('visible');
            if (currentAirportInWindow) {
                airportInfoWindowRecallBtn.classList.add('visible');
                airportInfoWindowRecallBtn.classList.add('palpitate');
                setTimeout(() => {
                    airportInfoWindowRecallBtn.classList.remove('palpitate');
                }, 1000);
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
    
    function setupAircraftWindowEvents() {
        if (!aircraftInfoWindow || aircraftInfoWindow.dataset.eventsAttached === 'true') return;
        const closeBtn = document.getElementById('aircraft-window-close-btn');
        const hideBtn = document.getElementById('aircraft-window-hide-btn');

        closeBtn.addEventListener('click', () => {
            aircraftInfoWindow.classList.remove('visible');
            aircraftInfoWindowRecallBtn.classList.remove('visible');
            clearLiveFlightPath();
            currentFlightInWindow = null;

            // =================================================================
            // --- FIX: Cleanup 3D Model and View ---
            // When the window is closed, this calls the new clearModel function
            // on the custom layer and resets the map's camera pitch for a
            // better user experience.
            if (threeJS_Layer) {
                threeJS_Layer.clearModel();
            }
            if (sectorOpsMap) {
                sectorOpsMap.flyTo({
                    pitch: 0,
                    bearing: 0,
                    speed: 0.5
                });
            }
            // =================================================================
        });

        hideBtn.addEventListener('click', () => {
            aircraftInfoWindow.classList.remove('visible');
            if (currentFlightInWindow) {
                aircraftInfoWindowRecallBtn.classList.add('visible', 'palpitate');
                setTimeout(() => aircraftInfoWindowRecallBtn.classList.remove('palpitate'), 1000);
            }
        });
        
        aircraftInfoWindowRecallBtn.addEventListener('click', () => {
            if (currentFlightInWindow) {
                aircraftInfoWindow.classList.add('visible');
                aircraftInfoWindowRecallBtn.classList.remove('visible');
            }
        });
        
        aircraftInfoWindow.dataset.eventsAttached = 'true';
    }

    async function initializeSectorOpsView() {
        const selector = document.getElementById('departure-hub-selector');
        const mapContainer = document.getElementById('sector-ops-map-fullscreen');
        const viewContainer = document.getElementById('view-rosters');
        if (!selector || !mapContainer) return;

        mainContentLoader.classList.add('active');

        try {
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
                        <div class="info-window-header">
                            <h3 id="aircraft-window-title"></h3>
                            <div class="info-window-actions">
                                <button id="aircraft-window-hide-btn" title="Hide"><i class="fa-solid fa-compress"></i></button>
                                <button id="aircraft-window-close-btn" title="Close"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        </div>
                        <div id="aircraft-window-content" class="info-window-content"></div>
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

            const rosterRes = await fetch(`${API_BASE_URL}/api/rosters/my-rosters`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!rosterRes.ok) throw new Error('Could not determine your current location.');
            const rosterData = await rosterRes.json();
            const departureHubs = rosterData.searchCriteria?.searched || ['VIDP'];

            selector.innerHTML = departureHubs.map(h => `<option value="${h}">${airportsData[h]?.name || h}</option>`).join('');
            const selectedHub = selector.value;

            await initializeSectorOpsMap(selectedHub);

            const [rosters, routes] = await Promise.all([
                fetchAndRenderRosters(selectedHub),
                fetchAndRenderRoutes()
            ]);
            ALL_AVAILABLE_ROUTES = routes;

            renderAirportMarkers();

            setupSectorOpsEventListeners();
            setupAirportWindowEvents();
            setupAircraftWindowEvents();

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
            interactive: true
        });

        return new Promise(resolve => {
            sectorOpsMap.on('load', () => {
                sectorOpsMap.addLayer(threeJS_Layer);
                
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
                        resolve();
                    }
                );
            });
        });
    }

    function clearRouteLayers() {
        sectorOpsMapRouteLayers.forEach(id => {
            if (sectorOpsMap.getLayer(id)) sectorOpsMap.removeLayer(id);
            if (sectorOpsMap.getSource(id)) sectorOpsMap.removeSource(id);
        });
        sectorOpsMapRouteLayers = [];
    }

    function clearLiveFlightPath() {
        if (sectorOpsMap && sectorOpsLiveFlightPathLayerId) {
            if (sectorOpsMap.getLayer(sectorOpsLiveFlightPathLayerId)) {
                sectorOpsMap.removeLayer(sectorOpsLiveFlightPathLayerId);
            }
            if (sectorOpsMap.getSource(sectorOpsLiveFlightPathLayerId)) {
                sectorOpsMap.removeSource(sectorOpsLiveFlightPathLayerId);
            }
            sectorOpsLiveFlightPathLayerId = null;
        }
    }

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
        contentEl.innerHTML = `<div class="spinner-small" style="margin: 2rem auto;"></div>`;

        airportInfoWindow.classList.add('visible');
        airportInfoWindowRecallBtn.classList.remove('visible');
        currentAirportInWindow = icao;

        const windowContentHTML = await createAirportInfoWindowHTML(icao);

        if (windowContentHTML) {
            contentEl.innerHTML = windowContentHTML;
            contentEl.scrollTop = 0;

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
    
    async function handleAircraftClick(flightProps, sessionId) {
        if (!flightProps || !flightProps.flightId) return;

        const lngLat = [flightProps.position.lon, flightProps.position.lat];
        const heading = flightProps.heading || 0;
        const modelPath = 'assets/models/a320/source/A320.glb';

        threeJS_Layer.displayModel(modelPath, lngLat, heading);
    
        sectorOpsMap.flyTo({
            center: lngLat,
            zoom: 15,
            pitch: 60,
            bearing: heading,
            speed: 0.8
        });

        clearLiveFlightPath();

        currentFlightInWindow = flightProps.flightId;
        aircraftInfoWindow.classList.add('visible');
        aircraftInfoWindowRecallBtn.classList.remove('visible');

        const titleEl = document.getElementById('aircraft-window-title');
        const contentEl = document.getElementById('aircraft-window-content');
        const usernameDisplay = flightProps.username || 'N/A';
        titleEl.innerHTML = `${flightProps.callsign} <small>(${usernameDisplay})</small>`;
        contentEl.innerHTML = `<div class="spinner-small" style="margin: 2rem auto;"></div><p style="text-align: center;">Loading flight data...</p>`;

        try {
            const [planRes, routeRes] = await Promise.all([
                fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}/${flightProps.flightId}/plan`),
                fetch(`${LIVE_FLIGHTS_API_URL}/${sessionId}/${flightProps.flightId}/route`)
            ]);
            
            const planData = planRes.ok ? await planRes.json() : null;
            const plan = (planData && planData.ok) ? planData.plan : null;

            populateAircraftInfoWindow(flightProps, plan);

            if (routeRes.ok) {
                const routeData = await routeRes.json();
                if (routeData.ok && Array.isArray(routeData.route) && routeData.route.length > 1) {
                    const trailCoords = routeData.route.map(p => [p.longitude, p.latitude]);
                    const trailId = `live-trail-${flightProps.flightId}`;
                    sectorOpsLiveFlightPathLayerId = trailId;

                    if(sectorOpsMap.getSource(trailId)) {
                        sectorOpsMap.removeLayer(trailId);
                        sectorOpsMap.removeSource(trailId);
                    }

                    sectorOpsMap.addSource(trailId, {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: trailCoords }
                        }
                    });
                    sectorOpsMap.addLayer({
                        id: trailId,
                        type: 'line',
                        source: trailId,
                        paint: { 'line-color': '#00b894', 'line-width': 3, 'line-opacity': 0.8 }
                    });
                }
            }

        } catch (error) {
            console.error("Error fetching aircraft details:", error);
            contentEl.innerHTML = `<p class="error-text">Could not retrieve flight details. The aircraft may have landed or disconnected.</p>`;
        }
    }

    function populateAircraftInfoWindow(baseProps, plan) {
        const contentEl = document.getElementById('aircraft-window-content');
        const usernameDisplay = baseProps.username || 'N/A';
        document.getElementById('aircraft-window-title').innerHTML = `${baseProps.callsign} <small>(${usernameDisplay})</small>`;

        if (!plan || !plan.flightPlanItems || plan.flightPlanItems.length === 0) {
            contentEl.innerHTML = `
                <div class="aircraft-info-body">
                    <div class="stat-grid">
                        <div class="stat-box">
                            <label><i class="fa-solid fa-arrows-up-down"></i> Altitude</label>
                            <span class="stat-value">${Math.round(baseProps.altitude).toLocaleString()} ft</span>
                        </div>
                        <div class="stat-box">
                            <label><i class="fa-solid fa-gauge-high"></i> Ground Speed</label>
                            <span class="stat-value">${Math.round(baseProps.speed)} kts</span>
                        </div>
                        <div class="stat-box">
                            <label><i class="fa-solid fa-compass"></i> Heading</label>
                            <span class="stat-value">${Math.round(baseProps.heading)}°</span>
                        </div>
                         <div class="stat-box">
                            <label><i class="fa-solid fa-arrow-trend-up"></i> Vert. Speed</label>
                            <span class="stat-value">${Math.round(baseProps.verticalSpeed)} fpm</span>
                        </div>
                    </div>
                    <div class="flight-plan-route-box">
                        <label>Filed Route</label>
                        <code>No flight plan filed.</code>
                    </div>
                </div>
            `;
            return;
        }

        const allWaypoints = [];
        const extractWps = (items) => {
            for (const item of items) {
                if (item.location && (item.location.latitude !== 0 || item.location.longitude !== 0)) {
                    allWaypoints.push(item);
                }
                if (Array.isArray(item.children)) { extractWps(item.children); }
            }
        };
        extractWps(plan.flightPlanItems);

        if (allWaypoints.length < 2) {
             populateAircraftInfoWindow(baseProps, null);
             return;
        }

        const departureIcao = allWaypoints[0]?.name || 'N/A';
        const arrivalIcao = allWaypoints[allWaypoints.length - 1]?.name || 'N/A';
        const routeString = allWaypoints.map(wp => wp.name).join(' ');

        let totalDistanceKm = 0;
        for (let i = 0; i < allWaypoints.length - 1; i++) {
            const wp1 = allWaypoints[i].location;
            const wp2 = allWaypoints[i + 1].location;
            totalDistanceKm += getDistanceKm(wp1.latitude, wp1.longitude, wp2.latitude, wp2.longitude);
        }
        const totalDistanceNM = totalDistanceKm / 1.852;

        let progress = 0;
        let ete = 'N/A';
        if (totalDistanceNM > 0 && baseProps.position) {
            const destWp = allWaypoints[allWaypoints.length - 1];
            if (destWp && destWp.location) {
                const remainingDistanceKm = getDistanceKm(baseProps.position.lat, baseProps.position.lon, destWp.location.latitude, destWp.location.longitude);
                const remainingDistanceNM = remainingDistanceKm / 1.852;
                progress = Math.max(0, Math.min(100, (1 - (remainingDistanceNM / totalDistanceNM)) * 100));
                
                if (baseProps.speed > 50) {
                    const timeHours = remainingDistanceNM / baseProps.speed;
                    const hours = Math.floor(timeHours);
                    const minutes = Math.round((timeHours - hours) * 60);
                    ete = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
                }
            }
        }

        contentEl.innerHTML = `
            <div class="aircraft-info-header">
                <div class="route-display">
                    <span class="icao">${departureIcao}</span>
                    <i class="fa-solid fa-plane"></i>
                    <span class="icao">${arrivalIcao}</span>
                </div>
            </div>
            <div class="aircraft-info-body">
                <div class="flight-progress">
                    <div class="progress-labels">
                        <span>Progress</span>
                        <span>ETE: ${ete}</span>
                    </div>
                    <div class="flight-progress-bar">
                        <div class="flight-progress-bar-inner" style="width: ${progress.toFixed(1)}%;">
                             <span class="progress-bar-label">${progress.toFixed(0)}%</span>
                        </div>
                    </div>
                </div>

                <div class="stat-grid">
                    <div class="stat-box">
                        <label><i class="fa-solid fa-arrows-up-down"></i> Altitude</label>
                        <span class="stat-value">${Math.round(baseProps.altitude).toLocaleString()} ft</span>
                    </div>
                    <div class="stat-box">
                        <label><i class="fa-solid fa-gauge-high"></i> Ground Speed</label>
                        <span class="stat-value">${Math.round(baseProps.speed)} kts</span>
                    </div>
                    <div class="stat-box">
                        <label><i class="fa-solid fa-compass"></i> Heading</label>
                        <span class="stat-value">${Math.round(baseProps.heading)}°</span>
                    </div>
                     <div class="stat-box">
                        <label><i class="fa-solid fa-arrow-trend-up"></i> Vert. Speed</label>
                        <span class="stat-value">${Math.round(baseProps.verticalSpeed)} fpm</span>
                    </div>
                </div>
                
                <div class="flight-plan-route-box">
                    <label>Filed Route</label>
                    <code>${routeString}</code>
                </div>
            </div>
        `;
    }

    function plotRoutesFromAirport(departureICAO) {
        clearRouteLayers();

        const departureAirport = airportsData[departureICAO];
        if (!departureAirport) return;

        const departureCoords = [departureAirport.lon, departureAirport.lat];
        const routesFromHub = ALL_AVAILABLE_ROUTES.filter(r => r.departure === departureICAO);

        if (routesFromHub.length === 0) {
            return;
        }

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
        }).filter(Boolean);

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
                'line-color': '#00a8ff',
                'line-width': 2,
                'line-opacity': 0.8
            }
        });

        sectorOpsMapRouteLayers.push(routeLinesId);

        sectorOpsMap.flyTo({
            center: departureCoords,
            zoom: 5,
            essential: true
        });
    }

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

    function setupSectorOpsEventListeners() {
        const panel = document.getElementById('sector-ops-floating-panel');
        if (!panel || panel.dataset.listenersAttached === 'true') return;
        panel.dataset.listenersAttached = 'true';

        const internalToggleBtn = document.getElementById('sector-ops-toggle-btn');
        const toolbarToggleBtn = document.getElementById('toolbar-toggle-panel-btn');

        const togglePanel = () => {
            const isNowCollapsed = panel.classList.toggle('panel-collapsed');
            
            if (internalToggleBtn) {
                internalToggleBtn.setAttribute('aria-expanded', !isNowCollapsed);
            }
            if (toolbarToggleBtn) {
                toolbarToggleBtn.classList.toggle('active', !isNowCollapsed);
            }

            if (sectorOpsMap) {
                setTimeout(() => {
                    sectorOpsMap.resize();
                }, 400);
            }
        };

        if (internalToggleBtn) {
            internalToggleBtn.addEventListener('click', togglePanel);
        }
        if (toolbarToggleBtn) {
            toolbarToggleBtn.addEventListener('click', togglePanel);
        }

        panel.querySelector('.panel-tabs')?.addEventListener('click', (e) => {
            const tabLink = e.target.closest('.tab-link');
            if (!tabLink) return;
            
            panel.querySelectorAll('.tab-link, .tab-content').forEach(el => el.classList.remove('active'));
            const tabId = tabLink.dataset.tab;
            tabLink.classList.add('active');
            panel.querySelector(`#${tabId}`).classList.add('active');
        });

        panel.querySelector('#departure-hub-selector')?.addEventListener('change', async (e) => {
            const selectedHub = e.target.value;
            await fetchAndRenderRosters(selectedHub);
        });

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
    // START: LIVE FLIGHTS & ATC/NOTAM LOGIC FOR SECTOR OPS MAP
    // ====================================================================

    function startSectorOpsLiveLoop() {
        stopSectorOpsLiveLoop();
        updateSectorOpsLiveFlights();
        sectorOpsLiveFlightsInterval = setInterval(updateSectorOpsLiveFlights, 30000);
    }

    function stopSectorOpsLiveLoop() {
        if (sectorOpsLiveFlightsInterval) {
            clearInterval(sectorOpsLiveFlightsInterval);
            sectorOpsLiveFlightsInterval = null;
        }
    }

    function renderAirportMarkers() {
        if (!sectorOpsMap || !sectorOpsMap.isStyleLoaded()) return;

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
            let markerClass;
            let title = `${icao}: ${airport.name || 'Unknown Airport'}`;

            if (hasAtc) {
                const airportAtc = activeAtcFacilities.filter(f => f.airportName === icao);
                const hasApproachOrDeparture = airportAtc.some(f => f.type === 4 || f.type === 5);

                markerClass = 'atc-active-marker';
                title += ' (Active ATC)';

                if (hasApproachOrDeparture) {
                    markerClass += ' atc-approach-active';
                    title += ' - Approach/Departure';
                }

            } else {
                markerClass = 'destination-marker';
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

    async function updateSectorOpsLiveFlights() {
        if (!sectorOpsMap || !sectorOpsMap.isStyleLoaded()) return;

        const LIVE_FLIGHTS_BACKEND = 'https://acars-backend-uxln.onrender.com';

        try {
            const sessionsRes = await fetch(`${LIVE_FLIGHTS_BACKEND}/if-sessions`);
            const sessionsData = await sessionsRes.json();
            const expertSession = sessionsData.sessions.find(s => s.name.toLowerCase().includes('expert'));

            if (!expertSession) {
                console.warn('Sector Ops Map: Expert Server session not found.');
                return;
            }

            const [flightsRes, atcRes, notamsRes] = await Promise.all([
                fetch(`${LIVE_FLIGHTS_BACKEND}/flights/${expertSession.id}`),
                fetch(`${LIVE_FLIGHTS_BACKEND}/atc/${expertSession.id}`),
                fetch(`${LIVE_FLIGHTS_BACKEND}/notams/${expertSession.id}`)
            ]);
            
            const atcData = await atcRes.json();
            activeAtcFacilities = (atcData.ok && Array.isArray(atcData.atc)) ? atcData.atc : [];
            
            const notamsData = await notamsRes.json();
            activeNotams = (notamsData.ok && Array.isArray(notamsData.notams)) ? notamsData.notams : [];

            renderAirportMarkers();

            const flightsData = await flightsRes.json();
            if (!flightsData.ok || !Array.isArray(flightsData.flights)) {
                console.warn('Sector Ops Map: Could not fetch live flights.');
                return;
            }

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
                        flightId: flight.flightId,
                        callsign: flight.callsign,
                        username: flight.username,
                        altitude: flight.position.alt_ft,
                        speed: flight.position.gs_kt,
                        heading: flight.position.track_deg || 0,
                        verticalSpeed: flight.position.vs_fpm || 0,
                        position: flight.position
                    }
                };
            }).filter(Boolean);

            const geojsonData = {
                type: 'FeatureCollection',
                features: flightFeatures
            };

            const sourceId = 'sector-ops-live-flights-source';
            const layerId = 'sector-ops-live-flights-layer';
            const source = sectorOpsMap.getSource(sourceId);

            if (source) {
                source.setData(geojsonData);
            } else {
                sectorOpsMap.addSource(sourceId, {
                    type: 'geojson',
                    data: geojsonData
                });

                sectorOpsMap.addLayer({
                    id: layerId,
                    type: 'symbol',
                    source: sourceId,
                    layout: {
                        'icon-image': 'plane-icon',
                        'icon-size': 0.07,
                        'icon-rotate': ['get', 'heading'],
                        'icon-rotation-alignment': 'map',
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true
                    }
                });

                sectorOpsMap.on('click', layerId, (e) => {
                    if (e.features.length > 0) {
                        const props = e.features[0].properties;
                        // The position object gets stringified when passed as a geojson property.
                        // We need to parse it back into an object for the handler function.
                        const flightProps = { ...props, position: JSON.parse(props.position) };
                        handleAircraftClick(flightProps, expertSession.id);
                    }
                });

                sectorOpsMap.on('mouseenter', layerId, () => { sectorOpsMap.getCanvas().style.cursor = 'pointer'; });
                sectorOpsMap.on('mouseleave', layerId, () => { sectorOpsMap.getCanvas().style.cursor = ''; });
            }

        } catch (error) {
            console.error('Error updating Sector Ops live data:', error);
        }
    }
    // ====================================================================
    // END: LIVE FLIGHTS & ATC/NOTAM LOGIC FOR SECTOR OPS MAP
    // ====================================================================

    const switchView = (viewId) => {
        sidebarNav.querySelector('.nav-link.active')?.classList.remove('active');
        mainContentContainer.querySelector('.content-view.active')?.classList.remove('active');

        const newLink = sidebarNav.querySelector(`.nav-link[data-view="${viewId}"]`);
        const newView = document.getElementById(viewId);

        if (newLink && newView) {
            newLink.classList.add('active');
            newView.classList.add('active');
        }

        if (liveFlightsInterval) {
            clearInterval(liveFlightsInterval);
            liveFlightsInterval = null;
        }
        
        stopSectorOpsLiveLoop();

        if (sectorOpsMap) {
            setTimeout(() => sectorOpsMap.resize(), 400); 
        }

        if (viewId === 'view-duty-status') {
            initializeLiveMap();
        } else if (viewId === 'view-rosters') {
            initializeSectorOpsView();
        }
    };

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
        if (!pilot.currentRoster) {
            return `<div class="content-card"><p>Error: On duty but no roster data found.</p></div>`;
        }

        try {
            const [rosterRes, pirepsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/rosters/by-id/${pilot.currentRoster}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/me/pireps`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (!rosterRes.ok) throw new Error('Could not load your assigned roster details.');
            if (!pirepsRes.ok) throw new Error('Could not load your duty details.');

            const [currentRoster, allPireps] = await Promise.all([rosterRes.json(), pirepsRes.json()]);

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

    const renderFlightPlanView = async (pilot) => {
        const viewContainer = document.getElementById('view-flight-plan');
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

    sidebarNav.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (!link) return;
        e.preventDefault();

        const viewId = link.dataset.view;
        if (viewId) {
            switchView(viewId);
        }
    });

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

    async function initializeApp() {
        mainContentLoader.classList.add('active');

        injectCustomStyles();

        await Promise.all([
            fetchMapboxToken(),
            fetchAirportsData()
        ]);

        await fetchPilotData();

        const urlParams = new URLSearchParams(window.location.search);
        const initialView = urlParams.get('view') || 'view-duty-status';
        switchView(initialView);

        if (localStorage.getItem('sidebarState') === 'collapsed') {
            dashboardContainer.classList.add('sidebar-collapsed');
        }
        sidebarToggleBtn.addEventListener('click', () => {
            dashboardContainer.classList.toggle('sidebar-collapsed');
            localStorage.setItem('sidebarState', dashboardContainer.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded');
            
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

    initializeApp();
});