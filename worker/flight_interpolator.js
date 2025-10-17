// flight_interpolator.js

// State to hold the current position and target destination for each aircraft
let aircraftState = new Map();
const INTERPOLATION_RATE_MS = 16; // Target ~60fps

/**
 * Linearly interpolates between two numbers.
 * @param {number} a - Start value.
 * @param {number} b - End value.
 * @param {number} t - Fraction (0.0 to 1.0).
 * @returns {number} The interpolated value.
 */
function lerp(a, b, t) {
  return a * (1 - t) + b * t;
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

        // Calculate how far along the animation is (a value from 0.0 to 1.0)
        const fraction = Math.min(timeSinceUpdate / totalDuration, 1.0);

        // Calculate the new interpolated position
        const newLat = lerp(craft.lastPos.lat, craft.targetPos.lat, fraction);
        const newLon = lerp(craft.lastPos.lon, craft.targetPos.lon, fraction);
        const newHeading = lerpAngle(craft.lastPos.heading, craft.targetPos.heading, fraction);

        interpolatedPositions.push({
            flightId,
            lat: newLat,
            lon: newLon,
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
    const updateInterval = e.data.interval; // e.g., 30000ms

    flights.forEach(flight => {
        const flightId = flight.flightId;
        const currentData = aircraftState.get(flightId);

        if (currentData) {
            // This is an existing aircraft, update its state
            currentData.lastPos = {
                lat: currentData.targetPos.lat,
                lon: currentData.targetPos.lon,
                heading: currentData.targetPos.heading
            };
            currentData.targetPos = {
                lat: flight.position.lat,
                lon: flight.position.lon,
                heading: flight.position.track_deg || 0
            };
            currentData.lastApiUpdate = updateTimestamp;
            currentData.nextApiUpdate = updateTimestamp + updateInterval;
        } else {
            // This is a new aircraft, create its initial state
            aircraftState.set(flightId, {
                lastPos: {
                    lat: flight.position.lat,
                    lon: flight.position.lon,
                    heading: flight.position.track_deg || 0
                },
                targetPos: {
                    lat: flight.position.lat,
                    lon: flight.position.lon,
                    heading: flight.position.track_deg || 0
                },
                lastApiUpdate: updateTimestamp,
                nextApiUpdate: updateTimestamp + updateInterval,
            });
        }
    });

    // Clean up old aircraft that are no longer in the API feed
    const activeFlightIds = new Set(flights.map(f => f.flightId));
    aircraftState.forEach((_, flightId) => {
        if (!activeFlightIds.has(flightId)) {
            aircraftState.delete(flightId);
        }
    });
};

// Start the animation loop inside the worker
setInterval(tick, INTERPOLATION_RATE_MS);