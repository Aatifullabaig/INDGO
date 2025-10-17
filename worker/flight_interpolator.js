// flight_interpolator.js

// State to hold the current position and target destination for each aircraft
let aircraftState = new Map();
const INTERPOLATION_RATE_MS = 16; // Target ~60fps

// --- HELPER FUNCTIONS ---

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

    // Handle cases where start and end points are the same to avoid division by zero
    if (d === 0) return { lat: lat1, lon: lon1 };

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
 * Special interpolation for angles (like heading) to handle wrapping from 350° to 10°.
 */
function lerpAngle(a, b, t) {
    let delta = b - a;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return a + delta * t;
}


// The main animation tick function
function tick() {
    if (aircraftState.size === 0) return;

    const now = performance.now();
    const interpolatedPositions = [];

    aircraftState.forEach((craft, flightId) => {
        const timeSinceUpdate = now - craft.lastApiUpdate;
        const totalDuration = craft.nextApiUpdate - craft.lastApiUpdate;
        const fraction = Math.min(timeSinceUpdate / Math.max(1, totalDuration), 1.0);

        const intermediatePoint = getIntermediatePoint(
            craft.lastPos.lat,
            craft.lastPos.lon,
            craft.targetPos.lat,
            craft.targetPos.lon,
            fraction
        );

        const newHeading = lerpAngle(craft.lastPos.heading, craft.targetPos.heading, fraction);

        interpolatedPositions.push({
            flightId,
            lat: intermediatePoint.lat,
            lon: intermediatePoint.lon,
            heading: newHeading,
        });
    });

    // Send the lean array of new positions back to the main thread for rendering
    self.postMessage(interpolatedPositions);
}

// Listen for messages from the main thread
self.onmessage = (e) => {
    const flights = e.data.flights;
    const updateTimestamp = performance.now();
    const updateInterval = e.data.interval;

    const validFlights = flights.filter(f => f.position && f.position.lat != null && f.position.lon != null);

    validFlights.forEach(flight => {
        const flightId = flight.flightId;
        const currentData = aircraftState.get(flightId);
        
        const newHeading = flight.position.track_deg != null ? flight.position.track_deg : (currentData ? currentData.targetPos.heading : 0);

        if (currentData) {
            // This is an existing aircraft, update its state.
            currentData.lastPos = { ...currentData.targetPos };
            currentData.targetPos = {
                lat: flight.position.lat,
                lon: flight.position.lon,
                heading: newHeading
            };
            currentData.lastApiUpdate = updateTimestamp;
            currentData.nextApiUpdate = updateTimestamp + updateInterval;
        } else {
            // ✅ FIX: This is a new aircraft. Create a smarter initial state to prevent it from being static.
            const targetPos = {
                lat: flight.position.lat,
                lon: flight.position.lon,
                heading: newHeading,
            };

            // Estimate a logical starting ("last") position by projecting backwards based on its current speed.
            // This makes the plane appear to be moving smoothly from the moment it appears.
            const speedKts = flight.position.gs_kt || 0;
            // Calculate distance moved in km over one update interval (e.g., 3000 ms)
            const distanceKm = (speedKts * 1.852) * (updateInterval / 3600000); 
            // Total angular distance of the Earth is 2*PI*R, so 1km is 1/R radians.
            const angularDist = distanceKm / 6371; 
            
            const latRad = targetPos.lat * Math.PI / 180;
            const lonRad = targetPos.lon * Math.PI / 180;
            // Project backwards, so use the opposite heading
            const bearingRad = (newHeading - 180) * Math.PI / 180;

            const lastLatRad = Math.asin(Math.sin(latRad) * Math.cos(angularDist) + Math.cos(latRad) * Math.sin(angularDist) * Math.cos(bearingRad));
            const lastLonRad = lonRad + Math.atan2(Math.sin(bearingRad) * Math.sin(angularDist) * Math.cos(latRad), Math.cos(angularDist) - Math.sin(latRad) * Math.sin(lastLatRad));
            
            const lastPos = {
                lat: lastLatRad * 180 / Math.PI,
                lon: lastLonRad * 180 / Math.PI,
                heading: newHeading, // Start with the correct heading
            };

            aircraftState.set(flightId, {
                lastPos: lastPos,
                targetPos: targetPos,
                lastApiUpdate: updateTimestamp - updateInterval, // Pretend the last update was one interval ago
                nextApiUpdate: updateTimestamp,
            });
        }
    });

    // Clean up old aircraft that are no longer in the API feed
    const activeFlightIds = new Set(validFlights.map(f => f.flightId));
    aircraftState.forEach((_, flightId) => {
        if (!activeFlightIds.has(flightId)) {
            aircraftState.delete(flightId);
        }
    });
};

// Start the animation loop inside the worker
setInterval(tick, INTERPOLATION_RATE_MS);