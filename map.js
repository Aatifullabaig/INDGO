// --- map.js (Corrected) ---
// This version exposes the map instance on the window object (window.leafletMap)
// so that other scripts can interact with it, specifically to fix the initialization bug.

document.addEventListener('DOMContentLoaded', () => {
    // The local 'map' variable has been removed to avoid confusion.
    // We will now use 'window.leafletMap' exclusively.
    let airportsData;
    const rosterLayers = {}; // To store layers (lines, markers) for each roster
    const allAirportMarkers = {}; // Global store to avoid duplicate airport markers {icao: marker}

    // --- NEW: Define styles for map elements ---
    const defaultLineStyle = { color: '#5a6a9c', weight: 2, opacity: 0.7 };
    const highlightLineStyle = { color: '#FFA500', weight: 3, opacity: 1 }; // Orange

    const defaultAirportStyle = {
        radius: 4,
        fillColor: "#00BFFF", // Deep Sky Blue
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };
    const highlightAirportStyle = {
        radius: 6,
        fillColor: "#FFA500", // Orange
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 1
    };

    // MODIFIED: Initialize the map using a global variable
    function initializeMap() {
        if (window.leafletMap) return; // Check if the global map object already exists
        
        window.leafletMap = L.map('map', {
            worldCopyJump: true // Ensures smooth panning across the date line
        }).setView([20, 0], 2);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20,
            minZoom: 2 // Prevent zooming out too far
        }).addTo(window.leafletMap);

        // Set map boundaries to prevent endless panning
        const southWest = L.latLng(-85, -180);
        const northEast = L.latLng(85, 180);
        const bounds = L.latLngBounds(southWest, northEast);
        window.leafletMap.setMaxBounds(bounds);
        window.leafletMap.on('drag', function() {
            window.leafletMap.panInsideBounds(bounds, { animate: false });
        });
    }

    // Load airport data from the API
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

    // MODIFIED: Function to clear all previously plotted routes and markers
    function clearAllRosterLayers() {
        if (!window.leafletMap) return; // Don't do anything if map doesn't exist
        Object.values(rosterLayers).forEach(data => {
            data.polylines.forEach(polyline => window.leafletMap.removeLayer(polyline));
        });
        Object.values(allAirportMarkers).forEach(marker => window.leafletMap.removeLayer(marker));

        for (const key in rosterLayers) { delete rosterLayers[key]; }
        for (const key in allAirportMarkers) { delete allAirportMarkers[key]; }
    }

    // MODIFIED: Main function to plot all available rosters
    window.plotRosters = async function(pilotLocation, rosters) {
        initializeMap();
        if (!window.leafletMap) return; // Guard against missing map object
        
        clearAllRosterLayers();
        await loadAirportsData();

        if (!airportsData) {
            console.error("Airports data is not available.");
            return;
        }

        rosters.forEach(roster => {
            // Initialize storage for this roster's layers
            rosterLayers[roster._id] = { polylines: [], airportMarkers: [] };

            const rosterUniqueIcaos = new Set();

            // First, create the polylines for each leg
            roster.legs.forEach(leg => {
                rosterUniqueIcaos.add(leg.departure);
                rosterUniqueIcaos.add(leg.arrival);

                const dep = airportsData[leg.departure];
                const arr = airportsData[leg.arrival];

                if (dep && arr) {
                    const latlngs = [[dep.lat, dep.lon], [arr.lat, arr.lon]];
                    const polyline = L.polyline(latlngs, defaultLineStyle).addTo(window.leafletMap);
                    rosterLayers[roster._id].polylines.push(polyline);
                }
            });

            // Next, create and associate airport markers
            rosterUniqueIcaos.forEach(icao => {
                const airport = airportsData[icao];
                if (airport) {
                    let marker;
                    // If marker doesn't exist globally, create it
                    if (!allAirportMarkers[icao]) {
                        marker = L.circleMarker([airport.lat, airport.lon], defaultAirportStyle)
                            .addTo(window.leafletMap)
                            .bindPopup(`<b>${airport.icao}</b><br>${airport.name}`);
                        allAirportMarkers[icao] = marker;
                    }
                    // Add the marker (new or existing) to this roster's data
                    marker = allAirportMarkers[icao];
                    rosterLayers[roster._id].airportMarkers.push(marker);
                }
            });
        });

        // Center the map on the pilot's location
        const pilotAirport = airportsData[pilotLocation];
        if (pilotAirport) {
            window.leafletMap.setView([pilotAirport.lat, pilotAirport.lon], 5);
        }
    };

    // MODIFIED: Resets all routes and airports to the default style
    window.resetHighlights = function() {
        Object.values(rosterLayers).forEach(data => {
            data.polylines.forEach(polyline => polyline.setStyle(defaultLineStyle));
        });
        Object.values(allAirportMarkers).forEach(marker => {
            marker.setStyle(defaultAirportStyle);
        });
    };

    // MODIFIED: Highlights a specific roster's route and airports
    window.highlightRoster = function(rosterId) {
        if (!window.leafletMap) return;
        resetHighlights(); // First, reset everything to default

        const rosterData = rosterLayers[rosterId];
        if (!rosterData) return;

        // Highlight the lines for this roster
        rosterData.polylines.forEach(polyline => {
            polyline.setStyle(highlightLineStyle).bringToFront();
        });

        // Highlight the airports for this roster
        rosterData.airportMarkers.forEach(marker => {
            marker.setStyle(highlightAirportStyle).bringToFront();
        });

        // Zoom and pan the map to fit the highlighted route
        const allLayersForBounds = [...rosterData.polylines, ...rosterData.airportMarkers];
        if (allLayersForBounds.length > 0) {
            const featureGroup = L.featureGroup(allLayersForBounds);
            window.leafletMap.fitBounds(featureGroup.getBounds().pad(0.2));
        }
    };

    // Initial load of airport data when script loads
    loadAirportsData();
});