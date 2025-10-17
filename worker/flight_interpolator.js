// flight_interpolator.js

// State to hold the current position and target destination for each aircraft
const aircraftState = new Map();
const INTERPOLATION_RATE_MS = 16; // Target ~60fps for smooth animation

// --- HELPER FUNCTIONS ---

/**
 * Calculates distance between two coordinates in kilometers (Haversine formula).
 */
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
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
 */
function getIntermediatePoint(lat1, lon1, lat2, lon2, fraction) {
    const toRad = (v) => v * Math.PI / 180;
    const toDeg = (v) => v * 180 / Math.PI;

    const lat1Rad = toRad(lat1);
    const lon1Rad = toRad(lon1);
    const lat2Rad = toRad(lat2);
    const lon2Rad = toRad(lon2);

    const d = getDistanceKm(lat1, lon1, lat2, lon2) / 6371; // Angular distance in radians

    if (d === 0) return { lat: lat1, lon: lon1 }; // Avoid division by zero

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
 * Interpolates angles correctly, handling the wrap-around from 359° to 0°.
 */
function lerpAngle(a, b, t) {
    let delta = b - a;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return a + delta * t;
}

/**
 * The main animation loop function, called at ~60fps.
 */
function tick() {
    if (aircraftState.size === 0) return;

    const now = performance.now();
    const interpolatedPositions = [];

    aircraftState.forEach((craft, flightId) => {
        const timeSinceUpdate = now - craft.lastApiUpdate;
        const totalDuration = craft.nextApiUpdate - craft.lastApiUpdate;
        const fraction = Math.min(timeSinceUpdate / Math.max(1, totalDuration), 1.0);

        // Calculate the smooth intermediate position and heading
        const intermediatePoint = getIntermediatePoint(
            craft.lastPos.lat, craft.lastPos.lon,
            craft.targetPos.lat, craft.targetPos.lon,
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

    // Send the array of newly calculated positions back to the main thread
    self.postMessage(interpolatedPositions);
}

// Listen for new flight data from the main thread
self.onmessage = (e) => {
    const flights = e.data.flights;
    const updateTimestamp = performance.now();
    const updateInterval = e.data.interval;

    const validFlights = flights.filter(f => f.position && f.position.lat != null && f.position.lon != null);
    
    validFlights.forEach(flight => {
        const flightId = flight.flightId;
        const currentData = aircraftState.get(flightId);
        
        // Use the new heading, or persist the old one if the new data is missing it
        const newHeading = flight.position.track_deg ?? currentData?.targetPos.heading ?? 0;

        if (currentData) {
            // Update an existing aircraft: the old target becomes the new start point
            currentData.lastPos = { ...currentData.targetPos };
            currentData.targetPos = {
                lat: flight.position.lat,
                lon: flight.position.lon,
                heading: newHeading
            };
            currentData.lastApiUpdate = updateTimestamp;
            currentData.nextApiUpdate = updateTimestamp + updateInterval;
        } else {
            // Add a new aircraft: the start and target points are the same initially
            const initialPos = {
                lat: flight.position.lat,
                lon: flight.position.lon,
                heading: newHeading
            };
            aircraftState.set(flightId, {
                lastPos: { ...initialPos },
                targetPos: { ...initialPos },
                lastApiUpdate: updateTimestamp,
                nextApiUpdate: updateTimestamp + updateInterval,
            });
        }
    });

    // Clean up: remove aircraft that are no longer in the API feed
    const activeFlightIds = new Set(validFlights.map(f => f.flightId));
    aircraftState.forEach((_, flightId) => {
        if (!activeFlightIds.has(flightId)) {
            aircraftState.delete(flightId);
        }
    });
};

// Start the animation loop
setInterval(tick, INTERPOLATION_RATE_MS);