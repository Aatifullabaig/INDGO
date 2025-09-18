// --- map.js (Updated) ---
// This version adds functionality to focus on a single roster, displaying custom route info.

document.addEventListener('DOMContentLoaded', () => {
    let airportsData;
    const rosterLayers = {}; // To store layers (lines, markers, leg data) for each roster
    const allAirportMarkers = {}; // Global store to avoid duplicate airport markers {icao: marker}
    let routeInfoLayerGroup = null; // A layer group specifically for our custom route labels

    // --- Define styles for map elements ---
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

    function initializeMap() {
        if (window.leafletMap) return;
        
        window.leafletMap = L.map('map', { worldCopyJump: true }).setView([20, 0], 2);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20,
            minZoom: 2
        }).addTo(window.leafletMap);

        const southWest = L.latLng(-85, -180);
        const northEast = L.latLng(85, 180);
        const bounds = L.latLngBounds(southWest, northEast);
        window.leafletMap.setMaxBounds(bounds);
        window.leafletMap.on('drag', function() {
            window.leafletMap.panInsideBounds(bounds, { animate: false });
        });

        // Initialize the layer group for our custom labels
        routeInfoLayerGroup = L.layerGroup().addTo(window.leafletMap);
    }

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

    function clearAllRosterLayers() {
        if (!window.leafletMap) return;
        Object.values(rosterLayers).forEach(data => {
            data.polylines.forEach(polyline => window.leafletMap.removeLayer(polyline));
        });
        Object.values(allAirportMarkers).forEach(marker => window.leafletMap.removeLayer(marker));
        routeInfoLayerGroup.clearLayers(); // Also clear custom labels

        for (const key in rosterLayers) { delete rosterLayers[key]; }
        for (const key in allAirportMarkers) { delete allAirportMarkers[key]; }
    }

    window.plotRosters = async function(pilotLocation, rosters) {
        initializeMap();
        if (!window.leafletMap) return;
        
        clearAllRosterLayers();
        await loadAirportsData();

        if (!airportsData) {
            console.error("Airports data is not available.");
            return;
        }

        rosters.forEach(roster => {
            // MODIFIED: Store leg data along with layers
            rosterLayers[roster._id] = { polylines: [], airportMarkers: [], legs: [] };
            const rosterUniqueIcaos = new Set();

            roster.legs.forEach(leg => {
                rosterUniqueIcaos.add(leg.departure);
                rosterUniqueIcaos.add(leg.arrival);

                const dep = airportsData[leg.departure];
                const arr = airportsData[leg.arrival];

                if (dep && arr) {
                    const latlngs = [[dep.lat, dep.lon], [arr.lat, arr.lon]];
                    const polyline = L.polyline(latlngs, defaultLineStyle).addTo(window.leafletMap);
                    rosterLayers[roster._id].polylines.push(polyline);
                    // NEW: Store detailed leg info for later use
                    rosterLayers[roster._id].legs.push({
                        ...leg,
                        depCoords: [dep.lat, dep.lon],
                        arrCoords: [arr.lat, arr.lon]
                    });
                }
            });

            rosterUniqueIcaos.forEach(icao => {
                const airport = airportsData[icao];
                if (airport) {
                    let marker;
                    if (!allAirportMarkers[icao]) {
                        marker = L.circleMarker([airport.lat, airport.lon], defaultAirportStyle)
                            .addTo(window.leafletMap)
                            .bindPopup(`<b>${airport.icao}</b><br>${airport.name}`);
                        allAirportMarkers[icao] = marker;
                    }
                    marker = allAirportMarkers[icao];
                    rosterLayers[roster._id].airportMarkers.push(marker);
                }
            });
        });

        const pilotAirport = airportsData[pilotLocation];
        if (pilotAirport) {
            window.leafletMap.setView([pilotAirport.lat, pilotAirport.lon], 5);
        } else {
             window.leafletMap.fitWorld(); // Fallback if pilot location not found
        }
    };

    window.resetHighlights = function() {
        Object.values(rosterLayers).forEach(data => {
            data.polylines.forEach(polyline => polyline.setStyle(defaultLineStyle));
        });
        Object.values(allAirportMarkers).forEach(marker => {
            marker.setStyle(defaultAirportStyle);
        });
    };
    
    // NEW: Function to reset the map to its initial state, showing all rosters
    window.showAllRosters = function() {
        if (!window.leafletMap) return;
        resetHighlights();
        routeInfoLayerGroup.clearLayers();

        // Add all layers back to the map
        Object.values(allAirportMarkers).forEach(marker => marker.addTo(window.leafletMap));
        Object.values(rosterLayers).forEach(data => {
            data.polylines.forEach(polyline => polyline.addTo(window.leafletMap));
        });

        // Create a feature group of everything to set the view
        const allMarkersGroup = L.featureGroup(Object.values(allAirportMarkers));
        if (Object.keys(allAirportMarkers).length > 0) {
            window.leafletMap.fitBounds(allMarkersGroup.getBounds().pad(0.1));
        }
    }

    // MODIFIED: highlightRoster is now focusOnRoster
    window.focusOnRoster = function(rosterId) {
        if (!window.leafletMap) return;
        resetHighlights();
        routeInfoLayerGroup.clearLayers(); // Clear any existing route labels

        const rosterData = rosterLayers[rosterId];
        if (!rosterData) return;

        // Hide all markers and polylines first
        Object.values(allAirportMarkers).forEach(marker => window.leafletMap.removeLayer(marker));
        Object.values(rosterLayers).forEach(data => {
            data.polylines.forEach(p => window.leafletMap.removeLayer(p));
        });

        // Show and highlight layers for the selected roster
        rosterData.polylines.forEach(p => {
            p.addTo(window.leafletMap).setStyle(highlightLineStyle).bringToFront();
        });
        rosterData.airportMarkers.forEach(m => {
            m.addTo(window.leafletMap).setStyle(highlightAirportStyle).bringToFront();
        });

        // NEW: Create and add custom labels for each leg
        rosterData.legs.forEach(leg => {
            const airlineCode = leg.flightNumber.replace(/\d+$/, '').toUpperCase();
            const aircraftCode = leg.aircraft;
            const liveryPath = `Images/liveries/${airlineCode}_${aircraftCode}.png`;
            const genericPath = `Images/planesForCC/${aircraftCode}.png`;

            const iconHtml = `
                <div class="map-route-label">
                    <img src="${liveryPath}" class="map-route-aircraft-img" 
                         onerror="this.onerror=null; this.src='${genericPath}';">
                    <span class="map-route-text">${leg.departure} → ${leg.arrival}</span>
                </div>`;
            
            const routeIcon = L.divIcon({
                className: 'map-route-icon-container', // Custom class to remove default leaflet styles
                html: iconHtml
            });

            // Place the label at the midpoint of the leg's polyline
            const midpoint = L.latLngBounds(leg.depCoords, leg.arrCoords).getCenter();
            L.marker(midpoint, { icon: routeIcon }).addTo(routeInfoLayerGroup);
        });

        const allLayersForBounds = [...rosterData.polylines, ...rosterData.airportMarkers];
        if (allLayersForBounds.length > 0) {
            const featureGroup = L.featureGroup(allLayersForBounds);
            window.leafletMap.fitBounds(featureGroup.getBounds().pad(0.2));
        }
    };

    loadAirportsData();
});