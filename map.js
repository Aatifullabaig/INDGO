// map.js - CORRECTED
let map;
let airportsData;
const rosterLayers = {}; // To store layers (lines, markers) for each roster
const allAirportMarkers = {}; // Global store to avoid duplicate airport markers {icao: marker}

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

// MODIFIED: Attached to window to be globally accessible from crew-center.js
window.initializeMap = function() {
    if (map) return;
    map = L.map('map', {
        worldCopyJump: true // Ensures smooth panning across the date line
    }).setView([20, 0], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        minZoom: 2 // Prevent zooming out too far
    }).addTo(map);

    // Set map boundaries to prevent endless panning
    const southWest = L.latLng(-85, -180);
    const northEast = L.latLng(85, 180);
    const bounds = L.latLngBounds(southWest, northEast);
    map.setMaxBounds(bounds);
    map.on('drag', function() {
        map.panInsideBounds(bounds, { animate: false });
    });
};

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

// Function to clear all previously plotted routes and markers
function clearAllRosterLayers() {
    // Check if map is initialized before trying to remove layers
    if (!map) return;

    Object.values(rosterLayers).forEach(data => {
        data.polylines.forEach(polyline => map.removeLayer(polyline));
    });
    Object.values(allAirportMarkers).forEach(marker => map.removeLayer(marker));

    for (const key in rosterLayers) { delete rosterLayers[key]; }
    for (const key in allAirportMarkers) { delete allAirportMarkers[key]; }
}

// Main function to plot all available rosters
window.plotRosters = async function(pilotLocation, rosters) {
    if (!map) {
        console.error("Map is not initialized. Cannot plot rosters.");
        return;
    }
    
    clearAllRosterLayers();
    await loadAirportsData();

    if (!airportsData) {
        console.error("Airports data is not available.");
        return;
    }

    rosters.forEach(roster => {
        rosterLayers[roster._id] = { polylines: [], airportMarkers: [] };
        const rosterUniqueIcaos = new Set();

        roster.legs.forEach(leg => {
            rosterUniqueIcaos.add(leg.departure);
            rosterUniqueIcaos.add(leg.arrival);
            const dep = airportsData[leg.departure];
            const arr = airportsData[leg.arrival];
            if (dep && arr) {
                const latlngs = [[dep.lat, dep.lon], [arr.lat, arr.lon]];
                const polyline = L.polyline(latlngs, defaultLineStyle).addTo(map);
                rosterLayers[roster._id].polylines.push(polyline);
            }
        });

        rosterUniqueIcaos.forEach(icao => {
            const airport = airportsData[icao];
            if (airport) {
                let marker;
                if (!allAirportMarkers[icao]) {
                    marker = L.circleMarker([airport.lat, airport.lon], defaultAirportStyle)
                        .addTo(map)
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
        map.setView([pilotAirport.lat, pilotAirport.lon], 5);
    }
};

// Resets all routes and airports to the default style
window.resetHighlights = function() {
    Object.values(rosterLayers).forEach(data => {
        data.polylines.forEach(polyline => polyline.setStyle(defaultLineStyle));
    });
    Object.values(allAirportMarkers).forEach(marker => {
        marker.setStyle(defaultAirportStyle);
    });
};

// Highlights a specific roster's route and airports
window.highlightRoster = function(rosterId) {
    resetHighlights();
    const rosterData = rosterLayers[rosterId];
    if (!rosterData) return;

    rosterData.polylines.forEach(polyline => {
        polyline.setStyle(highlightLineStyle).bringToFront();
    });

    rosterData.airportMarkers.forEach(marker => {
        marker.setStyle(highlightAirportStyle).bringToFront();
    });

    const allLayersForBounds = [...rosterData.polylines, ...rosterData.airportMarkers];
    if (allLayersForBounds.length > 0) {
        const featureGroup = L.featureGroup(allLayersForBounds);
        map.fitBounds(featureGroup.getBounds().pad(0.2));
    }
};

// Initial load of airport data when script loads
loadAirportsData();