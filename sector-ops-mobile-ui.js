/**
 * MobileUIHandler Module (Creative HUD Rehaul - v5.2 - 3-State Rehaul)
 *
 * This version implements the user's request for a 3-state drawer:
 * 1. "Mini View" (State 0): A minimal "Apple Maps" style data strip.
 * 2. "Peek View" (State 1): The side-by-side PFD + Live Data "mini-dashboard".
 * 3. "Expanded View" (State 2): The full-content, scrollable view.
 *
 * REHAUL v5.2 CHANGES:
 * 1. NEW 3-STATE LOGIC: Replaced toggleExpansion() with setDrawerState() and
 * updated swipe/click logic to cycle through states 0, 1, and 2.
 * 2. NEW "MINI VIEW": The default state (0) now only shows the handle and
 * a redesigned summary bar.
 * 3. DOM RE-PARENTING: populateSplitView() now moves *three* elements:
 * the overview, the summary bar, and the main content.
 * 4. CSS RE-SCOPING: All v5.1 styles are re-scoped. Default is "Mini",
 * .peek is "Peek", and .expanded is "Expanded".
 * 5. CLEANUP: closeActiveWindow() now correctly re-parents all 3 elements
 * and resets the state.
 */
const MobileUIHandler = {
    // --- CONFIGURATION ---
    CONFIG: {
        breakpoint: 992, // The max-width in pixels to trigger mobile view
    },

    // --- STATE ---
    isMobile: () => window.innerWidth <= MobileUIHandler.CONFIG.breakpoint,
    activeWindow: null, // The *original* hidden #aircraft-info-window
    topWindowEl: null,
    bottomDrawerEl: null,
    overlayEl: null,
    contentObserver: null,
    drawerState: 0, // 0 = Mini (data strip), 1 = Peek (PFD), 2 = Expanded
    swipeState: {
        touchStartY: 0,
        touchCurrentY: 0,
        drawerStartY: 0,
        isDragging: false,
    },

    /**
     * Initializes the handler by injecting the new HUD styles.
     */
    init() {
        this.injectMobileStyles();
        console.log("Mobile UI Handler (HUD Rehaul v5.2 / 3-State) Initialized.");
    },

    /**
     * Injects all the CSS for the new HUD-themed floating windows.
     * ---
     * [REHAUL v5.2 / 3-STATE]
     * 1. Adds "Mini View" (State 0) as the default, styled like Apple Maps.
     * 2. Re-scopes "Peek View" (State 1) to the new .peek class.
     * 3. "Expanded View" (State 2) remains on the .expanded class.
     */
    injectMobileStyles() {
        const styleId = 'mobile-sector-ops-styles';
        if (document.getElementById(styleId)) document.getElementById(styleId).remove();

        const css = `
            :root {
                --hud-bg: rgba(10, 15, 28, 0.85);
                --hud-blur: 15px;
                --hud-border: rgba(0, 168, 255, 0.3);
                --hud-accent: #00a8ff;
                --hud-glow: 0 0 15px rgba(0, 168, 255, 0.5);
                
                /* [NEW] 3-State Heights */
                --drawer-handle-height: 35px;
                --drawer-mini-content-height: 65px; /* Height for Apple Maps-style data strip */
                --drawer-peek-content-height: 200px; /* Height for PFD/Data side-by-side */
                
                --drawer-mini-height: calc(var(--drawer-handle-height) + var(--drawer-mini-content-height)); /* ~100px */
                --drawer-peek-height: calc(var(--drawer-handle-height) + var(--drawer-peek-content-height)); /* ~235px */
                /* Expanded height is 85vh (set below) */
            }

            #view-rosters.active {
                position: relative;
                overflow: hidden;
            }

            #mobile-window-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(5px);
                z-index: 1040;
                opacity: 0;
                transition: opacity 0.4s ease;
                pointer-events: none;
            }
            #mobile-window-overlay.visible { opacity: 1; pointer-events: auto; }

            .mobile-aircraft-view {
                position: absolute;
                background: var(--hud-bg); /* [MODIFIED] Solid bg for unified look */
                backdrop-filter: blur(var(--hud-blur));
                -webkit-backdrop-filter: blur(var(--hud-blur));
                border: 1px solid var(--hud-border);
                z-index: 1045;
                transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
                will-change: transform;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5), var(--hud-glow);
                color: #e8eaf6;
            }

            /* --- Top Floating Window: Image & Route --- */
            #mobile-aircraft-top-window {
                top: env(safe-area-inset-top, 15px);
                left: 15px;
                right: 15px;
                border-radius: 16px;
                transform: translateY(-250%);
                overflow: hidden;
                max-height: 250px; 
            }
            #mobile-aircraft-top-window.visible {
                transform: translateY(0);
            }

            /* --- Bottom Drawer: Flight Deck --- */
            #mobile-aircraft-bottom-drawer {
                bottom: 0;
                left: 0;
                right: 0;
                height: 85vh;
                max-height: calc(100vh - 80px);
                border-radius: 20px 20px 0 0;
                
                /* [NEW] Default state is "Mini View" (State 0) */
                transform: translateY(calc(85vh - var(--drawer-mini-height))); 
                
                display: flex;
                flex-direction: column;
                transition-property: transform;
                transition-duration: 0.45s;
                transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
                box-sizing: border-box;
                
                /* [NEW] Clip the .drawer-content when in Mini state */
                overflow: hidden; 
            }
            #mobile-aircraft-bottom-drawer.dragging { transition: none; }
            #mobile-aircraft-bottom-drawer.off-screen { transform: translateY(100%); }
            
            /* [NEW] "Peek View" (State 1) */
            #mobile-aircraft-bottom-drawer.peek {
                transform: translateY(calc(85vh - var(--drawer-peek-height)));
            }
            
            /* [Unchanged] "Expanded View" (State 2) */
            #mobile-aircraft-bottom-drawer.expanded {
                transform: translateY(0);
                /* [MODIFIED] Allow overflow when expanded for scrolling */
                overflow: visible;
            }

            /* --- Drawer Handle --- */
            .drawer-handle {
                height: var(--drawer-handle-height);
                flex-shrink: 0;
                cursor: grab;
                touch-action: none;
                user-select: none;
                padding: 10px;
                display: grid;
                place-items: center;
                border-bottom: 1px solid var(--hud-border);
                background: transparent; /* [MODIFIED] Part of unified bg */
                box-sizing: border-box;
            }
            .drawer-handle::before {
                content: '';
                width: 50px;
                height: 5px;
                background: var(--hud-border);
                border-radius: 3px;
                opacity: 0.8;
                transition: all 0.3s ease;
            }
            #mobile-aircraft-bottom-drawer.expanded .drawer-handle::before {
                opacity: 0.4;
            }

            /* --- [NEW] State 0: "Mini View" / Apple Maps Style --- */
            /* This is the #vsd-summary-bar, moved from crew-center.js */
            #mobile-aircraft-bottom-drawer > #vsd-summary-bar {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 10px;
                height: var(--drawer-mini-content-height);
                padding: 5px 16px 10px 16px;
                box-sizing: border-box;
                flex-shrink: 0;
                background: transparent; /* [MODIFIED] Part of unified bg */
                border-bottom: none; /* [REMOVED] */
                margin-bottom: 0; /* [REMOVED] */
            }
            #vsd-summary-bar .vsd-summary-item {
                flex-direction: column-reverse; /* [NEW] Value on top, Label on bottom */
                text-align: center;
                justify-content: center;
            }
            #vsd-summary-bar .vsd-summary-item .data-value {
                font-size: 2.2rem; /* [NEW] Much larger value */
                font-weight: 600;
                line-height: 1.1;
                color: #fff;
            }
            #vsd-summary-bar .vsd-summary-item .data-label {
                font-size: 0.8rem; /* [NEW] Smaller, subtler label */
                color: #9fa8da;
                text-transform: uppercase;
                font-weight: 500;
            }
            /* Hide the .unit (NM, fpm) in mini view */
            #vsd-summary-bar .vsd-summary-item .data-value .unit {
                display: none;
            }
            /* [END NEW MINI VIEW] */


            /* --- Drawer Content Wrapper (for States 1 & 2) --- */
            .drawer-content {
                overflow-y: auto;
                flex-grow: 1;
                padding-bottom: env(safe-area-inset-bottom, 0);
                
                /* [NEW] When expanded, add a top border to separate
                   from the summary bar, which is now *above* it. */
                #mobile-aircraft-bottom-drawer.expanded & {
                    border-top: 1px solid var(--hud-border);
                }
            }
            .drawer-content::-webkit-scrollbar { width: 6px; }
            .drawer-content::-webkit-scrollbar-track { background: transparent; }
            .drawer-content::-webkit-scrollbar-thumb { background-color: var(--hud-accent); border-radius: 10px; }
            
            
            /* --- [RE-SCOPED] State 1: "Peek View" Side-by-Side Layout --- */
            /* All selectors here are now prefixed with .peek */
            #mobile-aircraft-bottom-drawer.peek .unified-display-main {
                display: grid !important;
                grid-template-columns: 1.2fr 1fr !important;
                grid-template-rows: 1fr;
                height: var(--drawer-peek-content-height); /* 200px */
                padding: 10px;
                box-sizing: border-box;
                gap: 10px;
                overflow: hidden;
                transition: all 0.3s ease-in-out;
            }
            
            #mobile-aircraft-bottom-drawer.peek .pfd-main-panel {
                margin: 0 !important;
                max-width: none !important;
                justify-content: center;
            }
            
            #mobile-aircraft-bottom-drawer.peek .live-data-panel {
                justify-content: space-around !important;
                padding: 0 !important;
                background: none !important;
            }
            
            #mobile-aircraft-bottom-drawer.peek .live-data-item .data-label {
                font-size: 0.6rem;
            }
            #mobile-aircraft-bottom-drawer.peek .live-data-item .data-value {
                font-size: 1.1rem;
            }
            #mobile-aircraft-bottom-drawer.peek .live-data-item .data-value .unit {
                font-size: 0.7rem;
            }
            #mobile-aircraft-bottom-drawer.peek .live-data-item .data-value-ete {
                font-size: 1.3rem;
            }

            /* [NEW] Hide the stats button in Mini and Peek states */
            .pilot-stats-toggle-btn {
                display: none;
            }

            /* --- [RE-SCOPED] State 2: "Expanded" Stacked Layout --- */
            /* Selectors are prefixed with .expanded */
            #mobile-aircraft-bottom-drawer.expanded .unified-display-main {
                grid-template-columns: 1fr !important; /* Stacked */
                height: auto;
                overflow: visible; /* Allow scrolling */
                padding: 16px; /* Restore original padding */
            }
            
            #mobile-aircraft-bottom-drawer.expanded .pfd-main-panel {
                margin: 0 auto !important;
                max-width: 400px !important;
            }

            #mobile-aircraft-bottom-drawer.expanded .live-data-panel {
                justify-content: space-around !important;
                padding: 0 !important;
                background: rgba(10, 12, 26, 0.5) !important;
            }

            #mobile-aircraft-bottom-drawer.expanded .live-data-item .data-label {
                font-size: 0.7rem;
            }
            #mobile-aircraft-bottom-drawer.expanded .live-data-item .data-value {
                font-size: 1.5rem;
            }
             #mobile-aircraft-bottom-drawer.expanded .live-data-item .data-value .unit {
                font-size: 0.8rem;
            }
            #mobile-aircraft-bottom-drawer.expanded .live-data-item .data-value-ete {
                font-size: 1.7rem;
            }
            
            /* [NEW] Show stats button ONLY when expanded */
            #mobile-aircraft-bottom-drawer.expanded .pilot-stats-toggle-btn {
                display: flex;
            }
            /* --- [END REHAUL v5.2] --- */


            @media (max-width: ${this.CONFIG.breakpoint}px) {
                #aircraft-info-window, #airport-info-window {
                    display: none !important;
                }
            }
        `;
        const style = document.createElement('style');
        style.id = styleId;
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    },

    /**
     * Intercepts the window open command to build the mobile UI.
     * ---
     * [FIXED] This function now handles being called multiple times.
     * It will force-close any existing mobile window before building
     * a new one, ensuring a clean state for every aircraft click.
     */
    openWindow(windowElement) {
        if (!this.isMobile()) return; // 1. Only check for mobile

        // 2. [CRITICAL FIX] If a window is already active, force-close it
        //    synchronously. This resets the state (this.activeWindow = null)
        //    before we continue.
        if (this.activeWindow) {
            // 'true' = force close, no animation, synchronous
            this.closeActiveWindow(true); 
        }

        // 3. Now that the state is clean, proceed as normal
        if (windowElement.id === 'aircraft-info-window') {
            this.activeWindow = windowElement; // Store reference
            
            this.createSplitViewUI(); // Build our mobile containers

            setTimeout(() => {
                if (this.topWindowEl) this.topWindowEl.classList.add('visible');
                if (this.bottomDrawerEl) this.bottomDrawerEl.classList.remove('off-screen');
            }, 50);

            // Watch the original window
            this.observeOriginalWindow(windowElement);
        }
    },

    /**
     * Creates the new DOM structure for the HUD.
     * [REHAUL v5.1] Adds static .drawer-handle.
     */
    createSplitViewUI() {
        const viewContainer = document.getElementById('view-rosters');
        if (!viewContainer) return;

        this.overlayEl = document.createElement('div');
        this.overlayEl.id = 'mobile-window-overlay';
        viewContainer.appendChild(this.overlayEl);
        
        this.topWindowEl = document.createElement('div');
        this.topWindowEl.id = 'mobile-aircraft-top-window';
        this.topWindowEl.className = 'mobile-aircraft-view';
        viewContainer.appendChild(this.topWindowEl);

        this.bottomDrawerEl = document.createElement('div');
        this.bottomDrawerEl.id = 'mobile-aircraft-bottom-drawer';
        this.bottomDrawerEl.className = 'mobile-aircraft-view off-screen';
        
        // [REHAUL v5.1] Add the static grab bar handle
        this.bottomDrawerEl.innerHTML = `
            <div class="drawer-handle"></div>
            <div class="drawer-content"></div>
        `;
        viewContainer.appendChild(this.bottomDrawerEl);
    },

    /**
     * Watches the original hidden window for when its content is ready.
     * [FIXED] This function no longer performs a synchronous check,
     * which was causing a race condition. It now *always* waits
     * for a mutation, ensuring it only grabs the *new* content
     * generated by crew-center.js, not the stale content from the
     * previous window.
     */
    observeOriginalWindow(windowElement) {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        this.contentObserver = new MutationObserver((mutationsList, obs) => {
            // Wait for the correct element to appear.
            const mainContent = windowElement.querySelector('.unified-display-main-content');
            
            // Check for both the main content and the PFD container to be safe
            if (mainContent && mainContent.querySelector('#pfd-container')) {
                this.populateSplitView(windowElement);
                obs.disconnect(); // Stop observing
                this.contentObserver = null;
            }
        });
        
        // Always observe, forcing the UI to wait for crew-center.js
        // to destroy old content and add new content.
        this.contentObserver.observe(windowElement, { childList: true, subtree: true });
    },

    /**
     * [REHAUL v5.2]
     * Moves content from the original window into the new HUD components.
     * 1. Moves .aircraft-overview-panel to top window.
     * 2. [NEW] Moves #vsd-summary-bar to the bottom drawer's root.
     * 3. Moves .unified-display-main-content to bottom drawer's content wrapper.
     */
    populateSplitView(sourceWindow) {
        if (!this.topWindowEl || !this.bottomDrawerEl) return;

        const drawerContentContainer = this.bottomDrawerEl.querySelector('.drawer-content');
        if (!drawerContentContainer) return;

        // Find original content pieces from crew-center.js
        const topOverviewPanel = sourceWindow.querySelector('.aircraft-overview-panel');
        const vsdSummaryBar = sourceWindow.querySelector('#vsd-summary-bar');
        const mainFlightContent = sourceWindow.querySelector('.unified-display-main-content');
        
        // [CRITICAL] Move the elements, don't clone them
        if (topOverviewPanel) {
            this.topWindowEl.appendChild(topOverviewPanel);
        }

        // [NEW] Move the summary bar to be a direct child of the drawer,
        // placing it between the handle and the content wrapper.
        if (vsdSummaryBar) {
            this.bottomDrawerEl.insertBefore(vsdSummaryBar, drawerContentContainer);
        }
        
        if (mainFlightContent) {
            // This container now holds the PFD, VSD, stats button, etc.
            drawerContentContainer.appendChild(mainFlightContent);
        }
        
        this.wireUpInteractions();
    },

    /**
     * [REHAUL v5.2]
     * Adds event listeners. Click now cycles through 3 states.
     */
    wireUpInteractions() {
        if (!this.bottomDrawerEl || !this.topWindowEl) return;

        const drawerHandle = this.bottomDrawerEl.querySelector('.drawer-handle');

        // --- Mobile-specific interactions ---
        if (drawerHandle) {
            drawerHandle.addEventListener('click', (e) => {
                // [NEW] Cycle through states: 0 -> 1 -> 2 -> 0
                this.setDrawerState(null, true); 
            });
            drawerHandle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        }
        
        // [NEW] Clicking the overlay always returns to the mini state
        if (this.overlayEl) {
            this.overlayEl.addEventListener('click', () => this.setDrawerState(0));
        }
        
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // --- Re-wire desktop buttons using event delegation ---

        // 1. Close and Hide buttons (in top panel)
        this.topWindowEl.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.aircraft-window-close-btn');
            const hideBtn = e.target.closest('.aircraft-window-hide-btn');

            if (closeBtn) {
                this.closeActiveWindow();
            }

            if (hideBtn) {
                this.topWindowEl.classList.remove('visible');
                this.bottomDrawerEl.classList.add('off-screen');
                this.overlayEl.classList.remove('visible');
                this.setDrawerState(0); // Reset to mini state
                
                const recallBtn = document.getElementById('aircraft-recall-btn');
                if (recallBtn) {
                    recallBtn.classList.add('visible', 'palpitate');
                    setTimeout(() => recallBtn.classList.remove('palpitate'), 1000);
                }
            }
        });
        
        // 2. Stats and Back buttons (in bottom drawer)
        this.bottomDrawerEl.addEventListener('click', async (e) => {
            const statsBtn = e.target.closest('.pilot-stats-toggle-btn');
            const backBtn = e.target.closest('.back-to-flight-btn');

            if (statsBtn) {
                const userId = statsBtn.dataset.userId;
                const username = statsBtn.dataset.username;
                
                if (userId) {
                    const statsDisplay = this.bottomDrawerEl.querySelector('#pilot-stats-display');
                    const flightDisplay = this.bottomDrawerEl.querySelector('#aircraft-display-main');
                    if (statsDisplay && flightDisplay) {
                        await displayPilotStats(userId, username);
                        flightDisplay.style.display = 'none';
                        statsDisplay.style.display = 'block';
                    }
                }
            }

            if (backBtn) {
                const statsDisplay = this.bottomDrawerEl.querySelector('#pilot-stats-display');
                const flightDisplay = this.bottomDrawerEl.querySelector('#aircraft-display-main');
                if (statsDisplay && flightDisplay) {
                    statsDisplay.style.display = 'none';
                    flightDisplay.style.display = 'flex';
                }
            }
        });
    },
    
    /**
     * [NEW] Sets the drawer to a specific state (0=Mini, 1=Peek, 2=Expanded).
     * @param {number | null} targetState - The state to snap to (0, 1, or 2).
     * @param {boolean} [isClick=false] - If true, cycle to the next state.
     */
    setDrawerState(targetState, isClick = false) {
        if (!this.bottomDrawerEl || this.swipeState.isDragging) return;
        
        let newState;
        if (isClick) {
            newState = (this.drawerState + 1) % 3; // Cycle 0 -> 1 -> 2 -> 0
        } else {
            newState = targetState;
        }

        if (newState === this.drawerState) return; // No change

        this.drawerState = newState;

        // Reset classes
        this.bottomDrawerEl.classList.remove('peek', 'expanded');

        if (this.drawerState === 1) {
            this.bottomDrawerEl.classList.add('peek');
        } else if (this.drawerState === 2) {
            this.bottomDrawerEl.classList.add('expanded');
        }
        
        // Overlay is only visible when fully expanded
        const isFullyExpanded = (this.drawerState === 2);
        if (this.overlayEl) this.overlayEl.classList.toggle('visible', isFullyExpanded);
    },

    // --- Swipe Gesture Handlers ---
    
    /**
     * [REHAUL v5.1] Updated to only allow dragging from the new handle.
     */
    handleTouchStart(e) {
        // Check if the touch started on the handle itself
        const handle = this.bottomDrawerEl.querySelector('.drawer-handle');
        if (!handle || !handle.contains(e.target)) {
             // If touch wasn't on the handle, don't drag.
            this.swipeState.isDragging = false;
            return;
        }
        
        e.preventDefault(); // Only prevent default if we're dragging the handle
        this.swipeState.isDragging = true;
        this.swipeState.touchStartY = e.touches[0].clientY;
        const currentTransform = new WebKitCSSMatrix(window.getComputedStyle(this.bottomDrawerEl).transform);
        this.swipeState.drawerStartY = currentTransform.m42;
        this.bottomDrawerEl.classList.add('dragging');
    },

    handleTouchMove(e) {
        if (!this.swipeState.isDragging) return;
        e.preventDefault();
        this.swipeState.touchCurrentY = e.touches[0].clientY;
        let deltaY = this.swipeState.touchCurrentY - this.swipeState.touchStartY;
        
        // Clamp movement: cannot go higher than expanded (0)
        let newY = Math.max(0, this.swipeState.drawerStartY + deltaY); 
        this.bottomDrawerEl.style.transform = `translateY(${newY}px)`;
    },
    
    handleTouchEnd() {
        if (!this.swipeState.isDragging) return;
        this.swipeState.isDragging = false;
        this.bottomDrawerEl.classList.remove('dragging');
        this.bottomDrawerEl.style.transform = ''; // Clear inline style

        const deltaY = this.swipeState.touchCurrentY - this.swipeState.touchStartY;
        const currentState = this.drawerState;

        // [NEW] "Throw away" gesture: swipe down hard from the mini state
        if (deltaY > 150 && currentState === 0) {
             this.closeActiveWindow();
             return;
        }
        
        let newState = currentState;
        // Snap open or closed based on swipe direction
        if (deltaY < -50) { // Swiped up
             newState = Math.min(2, currentState + 1); // Go up one state, max 2
        } else if (deltaY > 50) { // Swiped down
             newState = Math.max(0, currentState - 1); // Go down one state, min 0
        }
        
        // Snap to the new (or old) state
        this.setDrawerState(newState);
        
        this.swipeState = { ...this.swipeState, touchStartY: 0, touchCurrentY: 0 };
    },

    /**
     * [REHAUL v5.2]
     * Animates out, moves content back (including summary bar), and cleans up.
     */
    closeActiveWindow(force = false) {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        // [CRITICAL] Move content back to the original hidden window
        if (this.activeWindow && this.topWindowEl && this.bottomDrawerEl) {
            const topOverviewPanel = this.topWindowEl.querySelector('.aircraft-overview-panel');
            
            // [NEW] Find the summary bar and main content
            const vsdSummaryBar = this.bottomDrawerEl.querySelector('#vsd-summary-bar');
            const mainFlightContent = this.bottomDrawerEl.querySelector('.unified-display-main-content');
            
            if (topOverviewPanel) {
                this.activeWindow.appendChild(topOverviewPanel);
            }
            
            // [NEW] Put the summary bar back where it belongs
            if (vsdSummaryBar && mainFlightContent) {
                // Find its original parent container
                const aircraftDisplayMain = mainFlightContent.querySelector('#aircraft-display-main');
                if (aircraftDisplayMain) {
                    // Prepend it so it's the first child
                    aircraftDisplayMain.prepend(vsdSummaryBar); 
                } else {
                    // Fallback in case structure changed
                    mainFlightContent.prepend(vsdSummaryBar);
                }
            }

            if (mainFlightContent) {
                this.activeWindow.appendChild(mainFlightContent);
            }
        }

        const animationDuration = force ? 0 : 500;

        const overlayToRemove = this.overlayEl;
        const topWindowToRemove = this.topWindowEl;
        const bottomDrawerToRemove = this.bottomDrawerEl;

        if (window.activePfdUpdateInterval) {
             clearInterval(window.activePfdUpdateInterval);
             window.activePfdUpdateInterval = null;
        }

        if (force) {
            overlayToRemove?.remove();
            topWindowToRemove?.remove();
            bottomDrawerToRemove?.remove();
            
            this.activeWindow = null;
            this.contentObserver = null;
            this.topWindowEl = null;
            this.bottomDrawerEl = null;
            this.overlayEl = null;
            this.drawerState = 0; // [NEW] Reset state
        } else {
            if (overlayToRemove) overlayToRemove.classList.remove('visible');
            if (topWindowToRemove) topWindowToRemove.classList.remove('visible');
            if (bottomDrawerToRemove) {
                bottomDrawerToRemove.classList.add('off-screen');
                bottomDrawerToRemove.classList.remove('peek', 'expanded');
            }

            setTimeout(() => {
                overlayToRemove?.remove();
                topWindowToRemove?.remove();
                bottomDrawerToRemove?.remove();
                
                if (this.topWindowEl === topWindowToRemove) {
                    this.activeWindow = null;
                    this.contentObserver = null;
                    this.topWindowEl = null;
                    this.bottomDrawerEl = null;
                    this.overlayEl = null;
                    this.drawerState = 0; // [NEW] Reset state
                }
            }, animationDuration);
        }
    }
};

/**
 * Initialize the Mobile UI Handler when the DOM is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
    MobileUIHandler.init();
    window.MobileUIHandler = MobileUIHandler; // Make it globally accessible
});