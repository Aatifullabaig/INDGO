// --- map.js (REWRITTEN for Mapbox GL JS) ---
// This version is a complete replacement of the Leaflet implementation.

document.addEventListener('DOMContentLoaded', () => {
    // --- MAPBOX CONFIGURATION ---
    // IMPORTANT: Replace this placeholder with your actual Mapbox access token.

    // State variables
    let airportsData;
    let rostersDataStore = []; // To store the original roster data
    let customLabelMarkers = []; // To store custom HTML markers for route labels
    let MAPBOX_ACCESS_TOKEN = null;

    async function fetchMapboxToken() {
        try {
            const response = await fetch('/.netlify/functions/config');
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

    // --- INITIALIZE MAP ---
    // This is now a Mapbox GL JS map instance. The variable name is changed to reflect this.
    function initializeMap() {
        if (window.mapboxMap) return;

        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
        window.mapboxMap = new mapboxgl.Map({
            container: 'map', // The ID of the div where the map will be
            style: 'mapbox://styles/mapbox/dark-v11', // Mapbox dark style
            center: [0, 20],
            zoom: 1.5,
            worldCopyJump: true,
            maxBounds: [[-180, -85], [180, 85]] // Set map boundaries
        });

        // Add standard map controls
        window.mapboxMap.addControl(new mapboxgl.NavigationControl());
        window.mapboxMap.on('load', setupMapLayers);
    }

    // --- SETUP MAP SOURCES AND LAYERS ---
    // Mapbox works by adding data 'sources' and then styling them with 'layers'.
    function setupMapLayers() {
        if (!window.mapboxMap.getSource('roster-lines')) {
            window.mapboxMap.addSource('roster-lines', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }
        if (!window.mapboxMap.getSource('airport-points')) {
            window.mapboxMap.addSource('airport-points', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }

        // Layer for the roster lines (default style)
        window.mapboxMap.addLayer({
            id: 'roster-lines-layer',
            type: 'line',
            source: 'roster-lines',
            paint: {
                'line-color': '#5a6a9c',
                'line-width': 2,
                'line-opacity': 0.7
            }
        });
        
        // Layer for the highlighted roster lines (initially hidden)
        window.mapboxMap.addLayer({
            id: 'roster-lines-highlight-layer',
            type: 'line',
            source: 'roster-lines',
            paint: {
                'line-color': '#FFA500', // Orange
                'line-width': 3,
                'line-opacity': 1
            },
            filter: ['==', 'rosterId', ''] // Initially show nothing
        });

        // Layer for airport markers
        window.mapboxMap.addLayer({
            id: 'airport-points-layer',
            type: 'circle',
            source: 'airport-points',
            paint: {
                'circle-radius': 4,
                'circle-color': '#00BFFF', // Deep Sky Blue
                'circle-stroke-color': '#fff',
                'circle-stroke-width': 1
            }
        });
        
        // Layer for highlighted airport markers
         window.mapboxMap.addLayer({
            id: 'airport-points-highlight-layer',
            type: 'circle',
            source: 'airport-points',
            paint: {
                'circle-radius': 6,
                'circle-color': '#FFA500', // Orange
                'circle-stroke-color': '#fff',
                'circle-stroke-width': 1.5
            },
            filter: ['==', 'icao', ''] // Initially show nothing
        });
        
        // Create a popup, but don't add it to the map yet.
        const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false
        });

        // Add hover and click interactions for airports
        window.mapboxMap.on('mouseenter', 'airport-points-layer', (e) => {
            window.mapboxMap.getCanvas().style.cursor = 'pointer';
            const coordinates = e.features[0].geometry.coordinates.slice();
            const properties = e.features[0].properties;
            const popupHtml = `<b>${properties.icao}</b><br>${properties.name}`;
            
            popup.setLngLat(coordinates).setHTML(popupHtml).addTo(window.mapboxMap);
        });

        window.mapboxMap.on('mouseleave', 'airport-points-layer', () => {
            window.mapboxMap.getCanvas().style.cursor = '';
            popup.remove();
        });
    }


    // --- LOAD AIRPORT DATA ---
    async function loadAirportsData() {
        if (airportsData) return;
        try {
            const response = await fetch('https://indgo-backend.onrender.com/api/airports');
            if (!response.ok) throw new Error('Failed to load airport data');
            airportsData = await response.json();
        } catch (error) {
            console.error('Error loading airport data:', error);
        }
    }

    // --- CLEAR ALL DATA ---
    function clearAllData() {
        if (!window.mapboxMap || !window.mapboxMap.isStyleLoaded()) return;
        
        const emptyGeoJSON = { type: 'FeatureCollection', features: [] };
        window.mapboxMap.getSource('roster-lines').setData(emptyGeoJSON);
        window.mapboxMap.getSource('airport-points').setData(emptyGeoJSON);
        
        // Clear stored data
        rostersDataStore = [];
    }

    // --- PLOT ROSTERS ON THE MAP ---
    window.plotRosters = async function(pilotLocation, rosters) {
        initializeMap();
        await loadAirportsData();
        rostersDataStore = rosters; // Save original roster data

        if (!airportsData) return;
        
        // Wait for the map to be fully loaded before manipulating sources
        if (!window.mapboxMap.isStyleLoaded()) {
             window.mapboxMap.on('load', () => processAndPlotData(pilotLocation, rosters));
        } else {
            processAndPlotData(pilotLocation, rosters);
        }
    };
    
    function processAndPlotData(pilotLocation, rosters) {
        clearAllData();
        
        const lineFeatures = [];
        const pointFeatures = new Map();

        rosters.forEach(roster => {
            const rosterUniqueIcaos = new Set();
            roster.legs.forEach(leg => {
                rosterUniqueIcaos.add(leg.departure);
                rosterUniqueIcaos.add(leg.arrival);

                const dep = airportsData[leg.departure];
                const arr = airportsData[leg.arrival];

                if (dep && arr) {
                    // Create a GeoJSON LineString feature
                    lineFeatures.push({
                        type: 'Feature',
                        properties: { rosterId: roster.rosterId },
                        geometry: {
                            type: 'LineString',
                            coordinates: [[dep.lon, dep.lat], [arr.lon, arr.lat]]
                        }
                    });
                }
            });
            
             // Add associated ICAOs to each leg for filtering later
            roster.associatedIcaos = Array.from(rosterUniqueIcaos);

            rosterUniqueIcaos.forEach(icao => {
                const airport = airportsData[icao];
                if (airport && !pointFeatures.has(icao)) {
                    // Create a GeoJSON Point feature
                    pointFeatures.set(icao, {
                        type: 'Feature',
                        properties: { icao: airport.icao, name: airport.name },
                        geometry: { type: 'Point', coordinates: [airport.lon, airport.lat] }
                    });
                }
            });
        });

        // Update map sources with the new GeoJSON data
        window.mapboxMap.getSource('roster-lines').setData({ type: 'FeatureCollection', features: lineFeatures });
        window.mapboxMap.getSource('airport-points').setData({ type: 'FeatureCollection', features: Array.from(pointFeatures.values()) });

        // Center map view
        const pilotAirport = airportsData[pilotLocation];
        if (pilotAirport) {
            window.mapboxMap.flyTo({ center: [pilotAirport.lon, pilotAirport.lat], zoom: 4 });
        } else {
             window.mapboxMap.flyTo({ zoom: 1.5 });
        }
    }

    // --- RESET MAP TO SHOW ALL ROSTERS ---
    window.showAllRosters = function() {
        if (!window.mapboxMap || !window.mapboxMap.isStyleLoaded()) return;

        // Remove any custom HTML markers
        customLabelMarkers.forEach(marker => marker.remove());
        customLabelMarkers = [];

        // Reset filters to show all features
        window.mapboxMap.setFilter('roster-lines-layer', null);
        window.mapboxMap.setFilter('airport-points-layer', null);
        
        // Hide highlight layers
        window.mapboxMap.setFilter('roster-lines-highlight-layer', ['==', 'rosterId', '']);
        window.mapboxMap.setFilter('airport-points-highlight-layer', ['==', 'icao', '']);
        
        // Fit map to bounds of all points
        const features = window.mapboxMap.getSource('airport-points')._data.features;
        if(features.length === 0) return;
        
        const bounds = new mapboxgl.LngLatBounds();
        features.forEach(feature => {
            bounds.extend(feature.geometry.coordinates);
        });
        window.mapboxMap.fitBounds(bounds, { padding: 50, duration: 1000 });
    };

    // --- FOCUS ON A SINGLE ROSTER ---
    window.focusOnRoster = function(rosterId) {
        if (!window.mapboxMap || !window.mapboxMap.isStyleLoaded()) return;

        const rosterData = rostersDataStore.find(r => r.rosterId === rosterId);
        if (!rosterData) return;

        // Remove any old custom markers
        customLabelMarkers.forEach(marker => marker.remove());
        customLabelMarkers = [];
        
        // Use setFilter to show only the selected roster and its airports
        window.mapboxMap.setFilter('roster-lines-layer', ['!=', 'rosterId', rosterId]);
        window.mapboxMap.setFilter('airport-points-layer', ['!in', 'icao', ...rosterData.associatedIcaos]);
        
        // Use a separate layer for highlighting
        window.mapboxMap.setFilter('roster-lines-highlight-layer', ['==', 'rosterId', rosterId]);
        window.mapboxMap.setFilter('airport-points-highlight-layer', ['in', 'icao', ...rosterData.associatedIcaos]);

        const processedReturnRoutes = new Set();
        const bounds = new mapboxgl.LngLatBounds();

        // Create and add custom HTML labels for each leg
        rosterData.legs.forEach(leg => {
            const dep = airportsData[leg.departure];
            const arr = airportsData[leg.arrival];
            if (!dep || !arr) return;

            // Add coordinates to bounds
            bounds.extend([dep.lon, dep.lat]);
            bounds.extend([arr.lon, arr.lat]);

            const forwardRouteKey = `${leg.departure}-${leg.arrival}`;
            const reverseRouteKey = `${leg.arrival}-${leg.departure}`;
            let labelClass = "map-route-label";
            if (processedReturnRoutes.has(forwardRouteKey)) {
                labelClass += " offset-return";
            } else {
                processedReturnRoutes.add(reverseRouteKey);
            }

            const airlineCode = leg.flightNumber.replace(/\d+$/, '').toUpperCase();
            const aircraftCode = leg.aircraft;
            const liveryPath = `Images/liveries/${airlineCode}_${aircraftCode}.png`;
            const genericPath = `Images/planesForCC/${aircraftCode}.png`;

            // Create custom HTML element for the marker
            const el = document.createElement('div');
            el.className = 'map-route-icon-container';
            el.innerHTML = `
                <div class="${labelClass}">
                    <img src="${liveryPath}" class="map-route-aircraft-img"
                         onerror="this.onerror=null; this.src='${genericPath}';">
                    <span class="map-route-text">${leg.departure} → ${leg.arrival}</span>
                </div>`;
            
            // Calculate midpoint for the label
            const midpoint = [ (dep.lon + arr.lon) / 2, (dep.lat + arr.lat) / 2 ];

            // Add the custom marker to the map
            const marker = new mapboxgl.Marker(el).setLngLat(midpoint).addTo(window.mapboxMap);
            customLabelMarkers.push(marker);
        });

        // Fit map to the bounds of the focused roster
        window.mapboxMap.fitBounds(bounds, { padding: 80, duration: 1000 });
    };

    // Initial load
    loadAirportsData();
});