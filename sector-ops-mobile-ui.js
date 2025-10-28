/**
 * MobileUIHandler Module (Creative HUD Rehaul - v5.1 - User-Revised Handle)
 *
 * This version implements the user's request for a re-hauled bottom panel,
 * creating a functional "mini-dashboard" in the "peek" (collapsed) state.
 *
 * REHAUL v5.1 CHANGES (Based on user feedback):
 * 1. REVERTED: The ".route-summary-overlay" is NO LONGER moved. It remains
 * in the top panel, as requested by the user.
 * 2. NEW HANDLE: A static, minimalist ".drawer-handle" (a "grab bar") is
 * re-introduced to the bottom drawer to control opening/closing.
 * 3. RETAINED: The side-by-side "mini-dashboard" layout for the "peek"
 * state (PFD left, Live Data right) is kept from v5.0.
 * 4. RE-WIRED: All event listeners (`click`, `touchstart`) are re-wired
 * to use the new ".drawer-handle".
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
        console.log("Mobile UI Handler (HUD Rehaul v5.1) Initialized.");
    },

    /**
     * Injects all the CSS for the new HUD-themed floating windows.
     * ---
     * [RENOVATED v5.1] This CSS now includes the static grab-bar handle
     * and the peek/expanded layout overrides.
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
                --drawer-handle-height: 35px;
                --drawer-peek-content-height: 200px;
                --drawer-peek-height: calc(var(--drawer-handle-height) + var(--drawer-peek-content-height)); /* 235px */
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
                background: #1C1E2A; 
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
                /* "Peek" state */
                transform: translateY(calc(85vh - var(--drawer-peek-height))); 
                display: flex;
                flex-direction: column;
                transition-property: transform;
                transition-duration: 0.45s;
                transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
                box-sizing: border-box;
            }
            #mobile-aircraft-bottom-drawer.dragging { transition: none; }
            #mobile-aircraft-bottom-drawer.off-screen { transform: translateY(100%); }
            #mobile-aircraft-bottom-drawer.expanded { transform: translateY(0); }

            /* --- [REHAUL v5.1] New Drawer Handle --- */
            .drawer-handle {
                height: var(--drawer-handle-height);
                flex-shrink: 0;
                cursor: grab;
                touch-action: none;
                user-select: none;
                padding: 10px; /* Click/touch area */
                display: grid;
                place-items: center;
                border-bottom: 1px solid var(--hud-border);
                background: rgba(18, 20, 38, 0.85); /* Match drawer bg */
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

            /* --- Drawer Content Wrapper --- */
            .drawer-content {
                overflow-y: auto;
                flex-grow: 1;
                /* [NEW] Add safe-area padding here */
                padding-bottom: env(safe-area-inset-bottom, 0);
            }
            /* Custom Scrollbar for the drawer */
            .drawer-content::-webkit-scrollbar { width: 6px; }
            .drawer-content::-webkit-scrollbar-track { background: transparent; }
            .drawer-content::-webkit-scrollbar-thumb { background-color: var(--hud-accent); border-radius: 10px; }
            
            /* --- [REHAUL v5.1] Core Rehaul: Side-by-Side Peek Layout --- */
            #mobile-aircraft-bottom-drawer .unified-display-main {
                /* This is the PEEK state layout */
                display: grid !important;
                grid-template-columns: 1.2fr 1fr !important; /* PFD slightly larger */
                grid-template-rows: 1fr;
                
                /* Constrain height to fit in the peek view */
                height: var(--drawer-peek-content-height); /* 200px */
                padding: 10px;
                box-sizing: border-box;
                gap: 10px;
                overflow: hidden; /* Clip anything below */
                transition: all 0.3s ease-in-out;
            }
            
            #mobile-aircraft-bottom-drawer .pfd-main-panel {
                /* Override centering from desktop-mobile */
                margin: 0 !important;
                max-width: none !important;
                justify-content: center; /* Keep it centered vertically */
            }
            
            #mobile-aircraft-bottom-drawer .live-data-panel {
                /* Override styles for peek view */
                justify-content: space-around !important;
                padding: 0 !important;
                background: none !important;
            }
            
            #mobile-aircraft-bottom-drawer .live-data-item .data-label {
                font-size: 0.6rem; /* Smaller label */
            }
            #mobile-aircraft-bottom-drawer .live-data-item .data-value {
                font-size: 1.1rem; /* Smaller value */
            }
            #mobile-aircraft-bottom-drawer .live-data-item .data-value .unit {
                font-size: 0.7rem;
            }
            #mobile-aircraft-bottom-drawer .live-data-item .data-value-ete {
                font-size: 1.3rem; /* ETE still a bit bigger */
            }

            /* --- [REHAUL v5.1] Revert to stacked layout when EXPANDED --- */
            #mobile-aircraft-bottom-drawer.expanded .unified-display-main {
                grid-template-columns: 1fr !important; /* Stacked */
                height: auto;
                overflow: visible; /* Allow scrolling */
                padding: 16px; /* Restore original padding */
            }
            
            #mobile-aircraft-bottom-drawer.expanded .pfd-main-panel {
                margin: 0 auto !important; /* Re-center the PFD */
                max-width: 400px !important;
            }

            #mobile-aircraft-bottom-drawer.expanded .live-data-panel {
                justify-content: space-around !important; /* Keep this */
                padding: 0 !important; /* Keep this */
                background: rgba(10, 12, 26, 0.5) !important; /* Restore bg */
            }

            #mobile-aircraft-bottom-drawer.expanded .live-data-item .data-label {
                font-size: 0.7rem; /* Restore label size */
            }
            #mobile-aircraft-bottom-drawer.expanded .live-data-item .data-value {
                font-size: 1.5rem; /* Restore value size */
            }
             #mobile-aircraft-bottom-drawer.expanded .live-data-item .data-value .unit {
                font-size: 0.8rem;
            }
            #mobile-aircraft-bottom-drawer.expanded .live-data-item .data-value-ete {
                font-size: 1.7rem; /* Restore ETE size */
            }
            /* --- [END REHAUL v5.1] --- */


            @media (max-width: ${this.CONFIG.breakpoint}px) {
                #aircraft-info-window, #airport-info-window {
                    /* This is the key that hides the original desktop window */
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
        this.overlayEl.addEventListener('click', () => this.toggleExpansion(false));

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
     * [REHAUL v5.1]
     * Moves content from the original window into the new HUD components.
     * 1. Moves .aircraft-overview-panel to top window. (Route summary stays inside)
     * 2. Moves .unified-display-main-content to bottom drawer's content.
     */
    populateSplitView(sourceWindow) {
        if (!this.topWindowEl || !this.bottomDrawerEl) return;

        const drawerContentContainer = this.bottomDrawerEl.querySelector('.drawer-content');
        if (!drawerContentContainer) return;

        // Find original content pieces from crew-center.js
        const topOverviewPanel = sourceWindow.querySelector('.aircraft-overview-panel');
        const mainFlightContent = sourceWindow.querySelector('.unified-display-main-content');
        
        // [REVERTED] No longer moving the route summary handle

        // [CRITICAL] Move the elements, don't clone them
        if (topOverviewPanel) {
            // The .route-summary-overlay is INSIDE this panel and will move with it,
            // staying at the bottom of the top panel, as requested.
            this.topWindowEl.appendChild(topOverviewPanel);
        }
        
        if (mainFlightContent) {
            drawerContentContainer.appendChild(mainFlightContent);
        }
        
        this.wireUpInteractions();
    },

    /**
     * [REHAUL v5.1]
     * Adds event listeners for mobile interactions (swipe) AND re-wires
     * desktop-driven buttons. Now targets ".drawer-handle".
     */
    wireUpInteractions() {
        if (!this.bottomDrawerEl || !this.topWindowEl) return;

        // [REHAUL v5.1] Target the new static grab bar handle
        const drawerHandle = this.bottomDrawerEl.querySelector('.drawer-handle');

        // --- Mobile-specific interactions ---
        if (drawerHandle) {
            drawerHandle.addEventListener('click', (e) => {
                this.toggleExpansion();
            });
            drawerHandle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
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
                // This logic is from crew-center.js, adapted for mobile
                this.topWindowEl.classList.remove('visible');
                this.bottomDrawerEl.classList.add('off-screen');
                this.overlayEl.classList.remove('visible');
                
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
            const backBtn = e.target.closest('.back-to-flight-btn'); // Renamed in crew-center

            if (statsBtn) {
                const userId = statsBtn.dataset.userId;
                const username = statsBtn.dataset.username;
                
                // This logic is from crew-center.js
                if (userId) {
                    const statsDisplay = this.bottomDrawerEl.querySelector('#pilot-stats-display');
                    const flightDisplay = this.bottomDrawerEl.querySelector('#aircraft-display-main');
                    if (statsDisplay && flightDisplay) {
                        // This function is global, defined in crew-center.js
                        await displayPilotStats(userId, username);
                        // Ensure mobile UI shows the right panel
                        flightDisplay.style.display = 'none';
                        statsDisplay.style.display = 'block';
                    }
                }
            }

            if (backBtn) {
                // This logic is from crew-center.js
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
     * Toggles the drawer between its expanded and peek states.
     */
    toggleExpansion(force) {
        if (!this.bottomDrawerEl || this.swipeState.isDragging) return;
        const isExpanded = this.bottomDrawerEl.classList.contains('expanded');
        const shouldExpand = force === undefined ? !isExpanded : force;

        this.bottomDrawerEl.classList.toggle('expanded', shouldExpand);
        if (this.overlayEl) this.overlayEl.classList.toggle('visible', shouldExpand);
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
        const isExpanded = this.bottomDrawerEl.classList.contains('expanded');

        if (deltaY > 150) { // Swiped down a lot
             // If expanded, just collapse. If already collapsed, close everything.
            if (isExpanded) {
                 this.toggleExpansion(false);
            } else {
                 this.closeActiveWindow();
                 return;
            }
        }
        
        // Snap open or closed based on swipe direction
        if (deltaY < -50) this.toggleExpansion(true); // Swiped up
        else if (deltaY > 50) this.toggleExpansion(false); // Swiped down
        else {
             // Not a strong swipe, snap back to original state
             this.toggleExpansion(isExpanded);
        }
        
        this.swipeState = { ...this.swipeState, touchStartY: 0, touchCurrentY: 0 };
    },

    /**
     * [REHAUL v5.1]
     * Animates out, moves content back to the original hidden window,
     * and removes all mobile UI components.
     */
    closeActiveWindow(force = false) {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        // [CRITICAL] Move content back to the original hidden window
        if (this.activeWindow && this.topWindowEl && this.bottomDrawerEl) {
            const topOverviewPanel = this.topWindowEl.querySelector('.aircraft-overview-panel');
            const mainFlightContent = this.bottomDrawerEl.querySelector('.unified-display-main-content');
            
            // [REVERTED] No logic needed for route summary handle

            if (topOverviewPanel) {
                // Move the entire top panel (with summary bar still inside) back
                this.activeWindow.appendChild(topOverviewPanel);
            }
            
            if (mainFlightContent) {
                this.activeWindow.appendChild(mainFlightContent);
            }
        }

        const animationDuration = force ? 0 : 500;

        // --- [FIX #1 START] ---
        // 1. Capture the *current* elements that need to be removed.
        const overlayToRemove = this.overlayEl;
        const topWindowToRemove = this.topWindowEl;
        const bottomDrawerToRemove = this.bottomDrawerEl;

        // 2. Stop the PFD interval
        if (window.activePfdUpdateInterval) {
             clearInterval(window.activePfdUpdateInterval);
             window.activePfdUpdateInterval = null;
        }

        // 3. Handle removal and cleanup based on 'force'
        if (force) {
            // --- SYNCHRONOUS PATH ---
            // Immediately remove elements
            overlayToRemove?.remove();
            topWindowToRemove?.remove();
            bottomDrawerToRemove?.remove();
            
            // Immediately cleanup state
            this.activeWindow = null;
            this.contentObserver = null;
            this.topWindowEl = null;
            this.bottomDrawerEl = null;
            this.overlayEl = null;
        } else {
            // --- ASYNCHRONOUS PATH ---
            // Animate out
            if (overlayToRemove) overlayToRemove.classList.remove('visible');
            if (topWindowToRemove) topWindowToRemove.classList.remove('visible');
            if (bottomDrawerToRemove) {
                bottomDrawerToRemove.classList.add('off-screen');
                bottomDrawerToRemove.classList.remove('expanded');
            }

            // Schedule removal AND state cleanup
            setTimeout(() => {
                overlayToRemove?.remove();
                topWindowToRemove?.remove();
                bottomDrawerToRemove?.remove();
                
                // [CRITICAL] Only reset the state if a new window
                // hasn't already been created. We check if the *current*
                // state element is the same one we intended to remove.
                if (this.topWindowEl === topWindowToRemove) {
                    this.activeWindow = null;
                    this.contentObserver = null;
                    this.topWindowEl = null;
                    this.bottomDrawerEl = null;
                    this.overlayEl = null;
                }
            }, animationDuration);
        }
        // --- [FIX #1 END] ---
    }
};

/**
 * Initialize the Mobile UI Handler when the DOM is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
    MobileUIHandler.init();
    window.MobileUIHandler = MobileUIHandler; // Make it globally accessible
});