// AircraftAnimator.js

class AircraftAnimator {
    /**
     * @param {mapboxgl.Map} map - The Mapbox map instance.
     * @param {string} sourceName - The name of the Mapbox source to update (e.g., 'sector-ops-live-flights-source').
     * @param {number} animationDuration - The duration in ms to animate between updates (e.g., 30000).
     */
    constructor(map, sourceName, animationDuration = 30000) {
        this.map = map;
        this.sourceName = sourceName;
        this.animationDuration = animationDuration;
        this.aircraftState = new Map(); // Stores the animation state for each flight
        this.animationFrameId = null;

        // Bind the _animate method to this instance
        this._animate = this._animate.bind(this);
    }

    /**
     * Starts the animation loop.
     */
    start() {
        if (!this.animationFrameId) {
            this._animate();
        }
    }

    /**
     * Stops the animation loop.
     */
    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Helper function: Linear Interpolation (Lerp) for positions.
     * @param {Array<number>} a - Start coordinate [lon, lat].
     * @param {Array<number>} b - End coordinate [lon, lat].
     * @param {number} t - Interpolation factor (0.0 to 1.0).
     * @returns {Array<number>} Interpolated coordinate.
     */
    _lerp(a, b, t) {
        return [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t
        ];
    }

    /**
     * Helper function: Lerp for angles (handles 360 -> 0 wrap-around).
     * @param {number} a - Start angle (degrees).
     * @param {number} b - End angle (degrees).
     * @param {number} t - Interpolation factor (0.0 to 1.0).
     * @returns {number} Interpolated angle.
     */
    _lerpAngle(a, b, t) {
        let delta = b - a;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return a + delta * t;
    }

    /**
     * Public method to feed new flight data to the animator.
     * @param {Array<Object>} newFlights - The array of GeoJSON features from your API.
     */
    updateFlights(newFlights) {
        const now = performance.now();
        const activeFlightIds = new Set();

        for (const flightFeature of newFlights) {
            const flightId = flightFeature.properties.flightId;
            activeFlightIds.add(flightId);

            const newPos = flightFeature.geometry.coordinates;
            const newHdg = flightFeature.properties.heading;
            
            if (!this.aircraftState.has(flightId)) {
                // This is a new aircraft, just add it to the state
                this.aircraftState.set(flightId, {
                    sourcePosition: newPos,
                    targetPosition: newPos,
                    sourceHeading: newHdg,
                    targetHeading: newHdg,
                    startTime: now,
                    featureProperties: flightFeature.properties // Store all other data
                });
            } else {
                // This is an existing aircraft, update its state for animation
                const currentState = this.aircraftState.get(flightId);
                
                // Only update if the position has actually changed
                if (currentState.targetPosition[0] !== newPos[0] || currentState.targetPosition[1] !== newPos[1]) {
                    this.aircraftState.set(flightId, {
                        ...currentState,
                        sourcePosition: currentState.targetPosition, // Old target becomes new source
                        targetPosition: newPos,                      // Set new target
                        sourceHeading: currentState.targetHeading,
                        targetHeading: newHdg,
                        startTime: now // Reset the animation timer
                    });
                }
            }
        }
        
        // Clean up: Remove aircraft that are no longer in the API response
        for (const flightId of this.aircraftState.keys()) {
            if (!activeFlightIds.has(flightId)) {
                this.aircraftState.delete(flightId);
            }
        }
    }

    /**
     * The private animation loop.
     */
    _animate() {
        const now = performance.now();
        const source = this.map.getSource(this.sourceName);

        if (!source || !this.map.isStyleLoaded()) {
            // Map or source not ready, try again next frame
            this.animationFrameId = requestAnimationFrame(this._animate);
            return;
        }

        const interpolatedFeatures = [];

        for (const [flightId, state] of this.aircraftState.entries()) {
            // Calculate animation progress
            const timeElapsed = now - state.startTime;
            let t = timeElapsed / this.animationDuration; // t is 0.0 to 1.0
            if (t > 1.0) t = 1.0;

            // Calculate interpolated position and heading
            const interpolatedPosition = this._lerp(state.sourcePosition, state.targetPosition, t);
            const interpolatedHeading = this._lerpAngle(state.sourceHeading, state.targetHeading, t);

            // Create a new feature with the interpolated data
            interpolatedFeatures.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: interpolatedPosition
                },
                properties: {
                    ...state.featureProperties, // Copy all original properties
                    heading: interpolatedHeading // Overwrite with the interpolated heading
                }
            });
        }

        // Update the map source with the new set of features
        source.setData({
            type: 'FeatureCollection',
            features: interpolatedFeatures
        });

        // Continue the loop
        this.animationFrameId = requestAnimationFrame(this._animate);
    }
}