// AircraftAnimator.js (Deck.gl Version)

class AircraftAnimator {
    /**
     * @param {mapboxgl.Map} map - The Mapbox map instance.
     * @param {Function} onClickHandler - Callback function for when an aircraft is clicked.
     * @param {number} animationDuration - The duration in ms to animate between updates (e.g., 3000).
     */
    constructor(map, onClickHandler, animationDuration = 3000) {
        this.map = map;
        this.animationDuration = animationDuration;
        this.aircraftState = new Map(); // Stores animation state
        this.animationFrameId = null;

        // 1. Define the mapping for your icons
        // The width/height must be the actual pixel size of your images.
        // anchorY: 128 assumes the plane is centered in a 256x256 image.
        this.iconMapping = {
            'jumbo': { url: '/Images/map_icons/jumbo.png', width: 256, height: 256, anchorY: 128 },
            'widebody': { url: '/Images/map_icons/widebody.png', width: 256, height: 256, anchorY: 128 },
            'narrowbody': { url: '/Images/map_icons/narrowbody.png', width: 256, height: 256, anchorY: 128 },
            'regional': { url: '/Images/map_icons/regional.png', width: 256, height: 256, anchorY: 128 },
            'private': { url: '/Images/map_icons/private.png', width: 256, height: 256, anchorY: 128 },
            'fighter': { url: '/Images/map_icons/fighter.png', width: 256, height: 256, anchorY: 128 },
            'default': { url: '/Images/map_icons/default.png', width: 256, height: 256, anchorY: 128 }
        };
        
        // 2. Create the Deck.gl Layer
        this.deckLayer = new deck.MapboxLayer({
            id: 'deck-gl-aircraft-layer',
            type: deck.IconLayer,
            data: [], // Start with empty data
            
            // --- IconLayer Properties ---
            getIcon: f => this.iconMapping[f.properties.category] || this.iconMapping['default'],
            getPosition: f => f.geometry.coordinates,
            getSize: 16, // This is the on-screen size in pixels. Tune this!
            sizeScale: 1.5, // You can also use this to scale the size.
            
            // Deck.gl's 'getAngle' is counter-clockwise, so we flip the heading
            getAngle: f => 360 - f.properties.heading,
            
            // --- Interaction ---
            pickable: true,
            autoHighlight: true,
            highlightColor: [255, 255, 255, 128],
            onClick: (info) => {
                // When clicked, call the handler we passed from crew-center.js
                if (info && info.object) {
                    onClickHandler(info.object.properties);
                }
            }
        });

        // 3. Add the Deck.gl layer to the Mapbox map
        this.map.addLayer(this.deckLayer);

        // Bind the animate method so it doesn't lose 'this'
        this._animate = this._animate.bind(this);
    }

    /**
     * Helper function: Linear Interpolation (Lerp) for positions.
     */
    _lerp(a, b, t) {
        return [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t
        ];
    }

    /**
     * Helper function: Lerp for angles (handles 360 -> 0 wrap-around).
     */
    _lerpAngle(a, b, t) {
        let delta = b - a;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return (a + delta * t + 360) % 360; // Keep it positive
    }

    /**
     * Public method to feed new flight data to the animator.
     * This logic is mostly the same as before.
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
                // NEW AIRCRAFT: Set start and end to the same spot.
                this.aircraftState.set(flightId, {
                    sourcePosition: newPos,
                    targetPosition: newPos,
                    sourceHeading: newHdg,
                    targetHeading: newHdg,
                    startTime: now,
                    featureProperties: flightFeature.properties
                });
            } else {
                // EXISTING AIRCRAFT: Update its state for animation.
                const currentState = this.aircraftState.get(flightId);
                
                // Only update if position or heading has changed
                if (currentState.targetPosition[0] !== newPos[0] || 
                    currentState.targetPosition[1] !== newPos[1] ||
                    currentState.targetHeading !== newHdg) {
                    
                    this.aircraftState.set(flightId, {
                        featureProperties: flightFeature.properties, // Get fresh properties
                        sourcePosition: currentState.targetPosition, // Old target is new start
                        targetPosition: newPos,                      // Set new target
                        sourceHeading: currentState.targetHeading,
                        targetHeading: newHdg,
                        startTime: now // Reset animation timer
                    });
                } else {
                    // No change in movement, but update properties (like callsign)
                     this.aircraftState.set(flightId, {
                        ...currentState,
                        featureProperties: flightFeature.properties
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
        const interpolatedFeatures = [];

        // 1. Calculate the intermediate position/heading for every aircraft
        for (const [flightId, state] of this.aircraftState.entries()) {
            // Get animation progress (a value from 0.0 to 1.0)
            const timeElapsed = now - state.startTime;
            let t = timeElapsed / this.animationDuration;
            if (t > 1.0) t = 1.0;

            const interpolatedPosition = this._lerp(state.sourcePosition, state.targetPosition, t);
            const interpolatedHeading = this._lerpAngle(state.sourceHeading, state.targetHeading, t);

            // Create the new "in-between" feature
            interpolatedFeatures.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: interpolatedPosition
                },
                properties: {
                    ...state.featureProperties,
                    heading: interpolatedHeading // Overwrite with interpolated heading
                }
            });
        }

        // 2. [THE FIX]
        // Update the Deck.gl layer with the new data. This is extremely fast.
        this.deckLayer.setProps({
            data: interpolatedFeatures
        });

        // 3. Continue the loop
        this.animationFrameId = requestAnimationFrame(this._animate);
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
}