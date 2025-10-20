// --- Relevant State Variables ---
let liveFlightData = {}; // Key: flightId, Value: { animation state, properties }
const DATA_REFRESH_INTERVAL_MS = 1500; // Data fetch interval
let sectorOpsMap = null; // The Mapbox GL JS map object
let sectorOpsLiveFlightsInterval = null; // Timer for fetching data
let animationFrameId = null; // ID for the animation loop
let lastAnimateTimestamp = 0; // Timestamp for throttling
const ANIMATION_THROTTLE_MS = 100; // Update map 10x/sec

// --- Math & Utility Helpers ---

/**
     * Linearly interpolates between two values.
     * This now also supports extrapolation if progress > 1.0.
     * @param {number} start - The starting value.
     * @param {number} end - The ending value.
     * @param {number} progress - The interpolation factor (0.0 to 1.0+).
     * @returns {number} The interpolated value.
     */
    function lerp(start, end, progress) {
        return start * (1 - progress) + end * progress;
    }

    /**
     * Interpolates heading degrees along the shortest path (e.g., from 350° to 10°).
     * This also supports extrapolation.
     */
    function interpolateHeading(start, end, progress) {
        let delta = end - start;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return (start + delta * progress + 360) % 360;
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
 * Calculates an intermediate point along a great-circle path.
 * (Used for drawing the flight trails)
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
 * Densifies a route by adding intermediate points.
 * (Used for drawing the flight trails)
 */
function densifyRoute(coordinates, numPoints = 20) {
    if (coordinates.length < 2) {
        return coordinates;
    }
    const densified = [];
    densified.push(coordinates[0]);
    for (let i = 0; i < coordinates.length - 1; i++) {
        const [lon1, lat1] = coordinates[i];
        const [lon2, lat2] = coordinates[i + 1];
        if (getDistanceKm(lat1, lon1, lat2, lon2) > 5) {
            for (let j = 1; j <= numPoints; j++) {
                const fraction = j / (numPoints + 1);
                const intermediate = getIntermediatePoint(lat1, lon1, lat2, lon2, fraction);
                densified.push([intermediate.lon, intermediate.lat]);
            }
        }
        densified.push(coordinates[i + 1]);
    }
    return densified;
}

/**
 * Gets the aircraft category string for icon matching.
 */
function getAircraftCategory(aircraftName) {
    if (!aircraftName) return 'default';
    const name = aircraftName.toLowerCase();
    if (['f-16', 'f-18', 'f-22', 'f-35', 'f/a-18', 'a-10'].some(ac => name.includes(ac))) return 'fighter';
    if (['a380', '747', 'vc-25'].some(ac => name.includes(ac))) return 'jumbo';
    if (['a330', 'a340', 'a350', '767', '777', '787', 'dc-10', 'md-11'].some(ac => name.includes(ac))) return 'widebody';
    if (['crj', 'erj', 'dh8d', 'q400'].some(ac => name.includes(ac))) return 'regional';
    if (['cessna', 'citation', 'cirrus', 'tbm', 'sr22', 'xcub'].some(ac => name.includes(ac))) return 'private';
    if (['a318', 'a319', 'a320', 'a321', '717', '727', '737', '757', 'a220', 'e17', 'e19'].some(ac => name.includes(ac))) return 'narrowbody';
    return 'default';
}

// --- Map Initialization (The "Stage") ---

/**
 * Initializes the Mapbox map and adds the necessary layers for aircraft.
 * This must be called before the animation loop starts.
 */
async function initializeSectorOpsMap(centerICAO) {
    // This function assumes mapboxgl.accessToken and airportsData are set elsewhere
    if (!mapboxgl.accessToken) {
        console.error('Mapbox token is not set.');
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
            const iconsToLoad = [
                { id: 'icon-jumbo', path: '/Images/map_icons/jumbo.png' },
                { id: 'icon-widebody', path: '/Images/map_icons/widebody.png' },
                { id: 'icon-narrowbody', path: '/Images/map_icons/narrowbody.png' },
                { id: 'icon-regional', path: '/Images/map_icons/regional.png' },
                { id: 'icon-private', path: '/Images/map_icons/private.png' },
                { id: 'icon-fighter', path: '/Images/map_icons/fighter.png' },
                { id: 'icon-default', path: '/Images/map_icons/default.png' }
            ];

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

            Promise.all(imagePromises).then(() => {
                console.log('All custom aircraft icons loaded.');

                // Create the source that will be animated
                if (!sectorOpsMap.getSource('sector-ops-live-flights-source')) {
                    sectorOpsMap.addSource('sector-ops-live-flights-source', {
                        type: 'geojson',
                        data: { type: 'FeatureCollection', features: [] }
                    });

                    // Create the layer that renders the source
                    sectorOpsMap.addLayer({
                        id: 'sector-ops-live-flights-layer',
                        type: 'symbol',
                        source: 'sector-ops-live-flights-source',
                        layout: {
                            'icon-image': ['match', ['get', 'category'], 'jumbo', 'icon-jumbo', 'widebody', 'icon-widebody', 'narrowbody', 'icon-narrowbody', 'regional', 'icon-regional', 'private', 'icon-private', 'fighter', 'icon-fighter', 'icon-default'],
                            'icon-size': 0.08,
                            'icon-rotate': ['get', 'heading'], // Reads heading from properties
                            'icon-rotation-alignment': 'map',
                            'icon-allow-overlap': true,
                            'icon-ignore-placement': true
                        }
                    });

                    // Add click handlers
                    sectorOpsMap.on('click', 'sector-ops-live-flights-layer', (e) => {
                        const props = e.features[0].properties;
                        // ... (handleAircraftClick logic exists elsewhere in the full script)
                        console.log("Clicked on aircraft:", props.callsign);
                    });
                    sectorOpsMap.on('mouseenter', 'sector-ops-live-flights-layer', () => { sectorOpsMap.getCanvas().style.cursor = 'pointer'; });
                    sectorOpsMap.on('mouseleave', 'sector-ops-live-flights-layer', () => { sectorOpsMap.getCanvas().style.cursor = ''; });
                }
                resolve();
            }).catch(error => {
                console.error('Failed to load aircraft icons, flight layer not added.', error);
                resolve();
            });
        });
    });
}


/**
 * --- [FINAL V5 - C/B/A Extrapolation] - The animation loop.
 * This version interpolates from `packetC` (start) to `packetB` (end).
 * By REMOVING the `progress` clamp at 1.0, the `lerp` function
 * will automatically EXTRAPOLATE beyond packet B if a new packet is late,
 * ensuring the animation never stops.
 */
function animateFlightPositions() {
    const source = sectorOpsMap.getSource('sector-ops-live-flights-source');
    if (!source || !sectorOpsMap.isStyleLoaded() || Object.keys(liveFlightData).length === 0) {
        return;
    }

    const newFeatures = [];
    const now = performance.now();
    
    // The *intended* duration of our animation window (C -> B)
    const ANIMATION_DURATION = DATA_REFRESH_INTERVAL_MS; 
    // The safety net: Remove aircraft if no data for 30 seconds
    const STALE_TIMEOUT_MS = 30000; 

    for (const flightId in liveFlightData) {
        const flight = liveFlightData[flightId];
        
        // --- 1. Check for stale data (Unchanged) ---
        if (now - flight.lastApiUpdate > STALE_TIMEOUT_MS) {
            delete liveFlightData[flightId];
            continue;
        }

        // --- 2. [REHAULED] Animate from Packet C to Packet B (with Extrapolation) ---
        
        const { packetC, packetB, animationStartTime } = flight;

        // How long has it been since this animation window started?
        const elapsed = now - animationStartTime;

        // Calculate progress.
        let progress = 0;
        if (ANIMATION_DURATION > 0) {
            progress = elapsed / ANIMATION_DURATION;
        }
        
        // --- [CRITICAL CHANGE] ---
        // We NO LONGER clamp `progress` at 1.0.
        // If `progress` is 1.1, `lerp(C, B, 1.1)` will return a point
        // 10% *beyond* B, along the same C->B vector.
        // This creates continuous, smooth extrapolation.
        
        if (progress < 0.0) progress = 0.0; // Still clamp at 0

        // Interpolate (or extrapolate) between C and B
        flight.currentLat = lerp(packetC.lat, packetB.lat, progress);
        flight.currentLon = lerp(packetC.lon, packetB.lon, progress);
        flight.currentHeading = interpolateHeading(packetC.heading, packetB.heading, progress);
        
        // --- 3. Add the feature for rendering (Unchanged) ---
        newFeatures.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [flight.currentLon, flight.currentLat]
            },
            properties: {
                ...flight.properties,
                heading: flight.currentHeading
            }
        });
    }
    
    // Update the map source with all new positions
    source.setData({ type: 'FeatureCollection', features: newFeatures });
}

/**
 * The high-frequency animation "engine" that runs at screen refresh rate
 * but throttles the expensive map update.
 */
function throttledAnimationLoop(timestamp) {
    // 1. Schedule the next frame immediately.
    animationFrameId = requestAnimationFrame(throttledAnimationLoop);

    // 2. Calculate time elapsed since the last *logic* update.
    const elapsed = timestamp - lastAnimateTimestamp;

    // 3. Check if we've waited long enough (100ms)
    if (elapsed > ANIMATION_THROTTLE_MS) {
        lastAnimateTimestamp = timestamp - (elapsed % ANIMATION_THROTTLE_MS);

        // 4. Run our *actual* animation logic.
        animateFlightPositions();
    }
}


/**
 * --- [RE-ARCHITECTED V4 - C/B/A Triple-Packet Buffer] - Updates the state for the animation loop.
 * This function populates the C-B-A buffer.
 */
async function updateSectorOpsLiveFlights() {
    if (!sectorOpsMap || !sectorOpsMap.isStyleLoaded()) return;

    const LIVE_FLIGHTS_BACKEND = 'https://site--acars-backend--6dmjph8ltlhv.code.run';

    try {
        const sessionsRes = await fetch(`${LIVE_FLIGHTS_BACKEND}/if-sessions`);
        if (!sessionsRes.ok) {
            console.warn('Sector Ops Map: Could not fetch server sessions. Skipping update.');
            return;
        }
        const sessionsData = await sessionsRes.json();
        const expertSession = sessionsData.sessions.find(s => s.name.toLowerCase().includes('expert'));

        if (!expertSession) {
            console.warn('Sector Ops Map: Expert Server session not found.');
            return;
        }

        // Fetch ATC/NOTAMs (unchanged)
        const [atcRes, notamsRes] = await Promise.all([
            fetch(`${LIVE_FLIGHTS_BACKEND}/atc/${expertSession.id}`),
            fetch(`${LIVE_FLIGHTS_BACKEND}/notams/${expertSession.id}`)
        ]);
        
        if (atcRes.ok) {
            const atcData = await atcRes.json();
            activeAtcFacilities = (atcData.ok && Array.isArray(atcData.atc)) ? atcData.atc : [];
        }
        if (notamsRes.ok) {
            const notamsData = await notamsRes.json();
            activeNotams = (notamsData.ok && Array.isArray(notamsData.notams)) ? notamsData.notams : [];
        }
        renderAirportMarkers(); 

        // Fetch Flights
        const flightsRes = await fetch(`${LIVE_FLIGHTS_BACKEND}/flights/${expertSession.id}`);
        if (!flightsRes.ok) {
            console.warn('Sector Ops Map: Failed to fetch live flights data. Holding last known positions.');
            return;
        }
        
        const flightsData = await flightsRes.json();
        if (!flightsData.ok || !Array.isArray(flightsData.flights)) {
            console.warn('Sector Ops Map: Received invalid flights data. Holding last known positions.');
            return;
        }

        const now = performance.now();
        const updatedFlightIds = new Set();

        flightsData.flights.forEach(flight => {
            if (!flight.position || flight.position.lat == null || flight.position.lon == null) return;
            
            const flightId = flight.flightId;
            updatedFlightIds.add(flightId);

            // --- [MODIFIED LOGIC] ---
            // This is the new, freshest data (Packet A)
            const packetA = {
                lat: flight.position.lat,
                lon: flight.position.lon,
                heading: flight.position.track_deg || 0,
                timestamp: now // The time this packet arrived
            };
            
            const newProperties = {
                flightId: flight.flightId,
                callsign: flight.callsign,
                username: flight.username,
                altitude: flight.position.alt_ft,
                speed: flight.position.gs_kt || 0,
                verticalSpeed: flight.position.vs_fpm || 0,
                position: JSON.stringify(flight.position),
                aircraft: JSON.stringify(flight.aircraft),
                userId: flight.userId,
                category: getAircraftCategory(flight.aircraft?.aircraftName)
            };

            const existingData = liveFlightData[flightId];

            if (existingData) {
                // --- [CRITICAL CHANGE] ---
                // Shift the packet buffer:
                // The old B becomes the new C (animation start)
                existingData.packetC = { ...existingData.packetB };
                
                // The old A becomes the new B (animation end)
                existingData.packetB = { ...existingData.packetA };

                // The new packet becomes A (next animation's end)
                existingData.packetA = packetA;
                
                // Set the start time for the *new* C -> B animation
                existingData.animationStartTime = now;
                
                existingData.properties = newProperties;
                existingData.lastApiUpdate = now;
                
            } else {
                // --- [CRITICAL CHANGE] ---
                // This is a new flight. Set all packets to the same spot.
                liveFlightData[flightId] = {
                    packetA: packetA,
                    packetB: packetA,
                    packetC: packetA,
                    
                    animationStartTime: now,
                    
                    // Set 'current' state for the very first frame
                    currentLat: packetA.lat,
                    currentLon: packetA.lon,
                    currentHeading: packetA.heading,
                    
                    properties: newProperties,
                    lastApiUpdate: now
                };
            }
        });

        // Clean up old flights
        for (const flightId in liveFlightData) {
            if (!updatedFlightIds.has(flightId)) {
                delete liveFlightData[flightId];
            }
        }

    } catch (error) {
        console.error('Error updating Sector Ops live data:', error);
    }
}


// --- Loop Controllers (The "On/Off Switch") ---

/**
 * Starts the data-fetching interval and the animation loop.
 */
function startSectorOpsLiveLoop() {
    stopSectorOpsLiveLoop(); // Clear any old loops

    // 1. Start the data fetching loop (infrequent)
    updateSectorOpsLiveFlights(); // Fetch immediately
    sectorOpsLiveFlightsInterval = setInterval(updateSectorOpsLiveFlights, DATA_REFRESH_INTERVAL_MS); 

    // 2. Start the new throttled animation loop
    lastAnimateTimestamp = 0;
    animationFrameId = requestAnimationFrame(throttledAnimationLoop);
}

/**
 * Stops the data-fetching interval and the animation loop.
 */
function stopSectorOpsLiveLoop() {
    // 1. Clear the data-fetching interval
    if (sectorOpsLiveFlightsInterval) {
        clearInterval(sectorOpsLiveFlightsInterval);
        sectorOpsLiveFlightsInterval = null;
    }

    // 2. Clear the animation loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}