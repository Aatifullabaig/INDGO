/**
 * MobileUIHandler Module (Creative HUD Rehaul - v4.0)
 *
 * This version brings the full "desktop feel" and animations to the mobile
 * UI, while retaining the mobile-native top-window/bottom-drawer layout.
 *
 * This is achieved by changing the core strategy:
 * 1. STOP CLONING: We no longer "scrape" and "clone" DOM nodes.
 * 2. START MOVING: We use appendChild() to move the *actual* live DOM elements
 * from the hidden desktop window into the mobile containers.
 * 3. PRESERVE BINDINGS: This preserves all desktop CSS, animations, and JS
 * data bindings (like the PFD and live data readouts).
 * 4. MOVE BACK: On close, we move the content back to the original hidden
 * window, ensuring it's not destroyed.
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
        console.log("Mobile UI Handler (HUD Rehaul v4.0) Initialized.");
    },

    /**
     * Injects all the CSS for the new HUD-themed floating windows.
     * ---
     * [RENOVATED] This CSS is now *much* simpler. It only styles the
     * mobile containers and no longer tries to re-style the content,
     * as the desktop CSS from crew-center.js will handle that.
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
                --drawer-peek-height: 235px; /* How much of the drawer is visible */
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
                /* MODIFIED: Use the desktop's dark color for a seamless content blend */
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
                /* MODIFIED: Let content define height, but set a max */
                max-height: 250px; 
            }
            #mobile-aircraft-top-window.visible {
                transform: translateY(0);
            }
            /* * [REMOVED] All content-specific styles like .aircraft-image-container.
             * The desktop's .aircraft-overview-panel will be moved here and
             * will style itself.
             */

            /* --- Bottom Drawer: Flight Deck --- */
            #mobile-aircraft-bottom-drawer {
                bottom: 0;
                left: 0;
                right: 0;
                height: 85vh;
                max-height: calc(100vh - 80px);
                border-radius: 20px 20px 0 0;
                transform: translateY(calc(85vh - var(--drawer-peek-height))); /* "Peek" state */
                display: flex;
                flex-direction: column;
                transition-property: transform;
                transition-duration: 0.45s;
                transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
                padding-bottom: env(safe-area-inset-bottom, 0);
                box-sizing: border-box;
            }
            #mobile-aircraft-bottom-drawer.dragging { transition: none; }
            #mobile-aircraft-bottom-drawer.off-screen { transform: translateY(100%); }
            #mobile-aircraft-bottom-drawer.expanded { transform: translateY(0); }

            /* --- Drawer Header / Handle --- */
            .drawer-header {
                padding: 12px 20px;
                text-align: center;
                flex-shrink: 0;
                cursor: grab;
                touch-action: none;
                user-select: none;
                border-bottom: 1px solid var(--hud-border);
            }
             .drawer-header h4 {
                margin: 0;
                font-size: 1.1rem;
                font-weight: 600;
                color: var(--hud-accent);
                text-shadow: var(--hud-glow);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
            }
            .drawer-header .chevron-icon {
                transition: transform 0.3s ease-in-out;
            }
            #mobile-aircraft-bottom-drawer.expanded .chevron-icon {
                transform: rotate(180deg);
            }
            
            /* --- Drawer Content Wrapper --- */
            .drawer-content {
                overflow-y: auto;
                flex-grow: 1;
                /*
                 * [REMOVED] All padding/gap styles.
                 * The desktop's .unified-display-main-content will be moved
                 * here and provides its own padding.
                 */
            }
            /* Custom Scrollbar for the drawer */
            .drawer-content::-webkit-scrollbar { width: 6px; }
            .drawer-content::-webkit-scrollbar-track { background: transparent; }
            .drawer-content::-webkit-scrollbar-thumb { background-color: var(--hud-accent); border-radius: 10px; }
            
            /* * [REMOVED] All rules for .unified-display-main, .pfd-main-panel, etc.
             * The desktop CSS from crew-center.js is already responsive
             * and will correctly style the content.
             */

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
        
        // [MODIFIED] Simplified header. The dynamic info is now *in* the top panel.
        this.bottomDrawerEl.innerHTML = `
            <div class="drawer-header">
                <h4>
                    <i class="fa-solid fa-chevron-up chevron-icon"></i>
                    <span>Flight Data</span>
                </h4>
            </div>
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
        
        // [REMOVED] The synchronous "if/else" block that was causing
        // the race condition.
        
        // Always observe, forcing the UI to wait for crew-center.js
        // to destroy old content and add new content.
        this.contentObserver.observe(windowElement, { childList: true, subtree: true });
    },

    /**
     * [COMPLETELY RENOVATED]
     * Moves content from the original window into the new HUD components.
     * We use appendChild (move) instead of cloneNode (copy) to preserve
     * all event listeners, animations, and live data bindings from crew-center.js.
     */
    populateSplitView(sourceWindow) {
        if (!this.topWindowEl || !this.bottomDrawerEl) return;

        const drawerContentContainer = this.bottomDrawerEl.querySelector('.drawer-content');
        if (!drawerContentContainer) return;

        // Find original content pieces from crew-center.js
        const topOverviewPanel = sourceWindow.querySelector('.aircraft-overview-panel');
        const mainFlightContent = sourceWindow.querySelector('.unified-display-main-content');

        // [CRITICAL] Move the elements, don't clone them
        if (topOverviewPanel) {
            this.topWindowEl.appendChild(topOverviewPanel);
        }
        
        if (mainFlightContent) {
            drawerContentContainer.appendChild(mainFlightContent);
        }
        
        // [REMOVED] All text modification logic. It's no longer needed.
        // [REMOVED] Dynamic header logic. It's now part of the moved topOverviewPanel.

        this.wireUpInteractions();
    },

    /**
     * [RENOVATED]
     * Adds event listeners for mobile interactions (swipe) AND re-wires
     * desktop-driven buttons (hide, stats) that were broken by the move.
     */
    wireUpInteractions() {
        if (!this.bottomDrawerEl || !this.topWindowEl) return;

        const drawerHeader = this.bottomDrawerEl.querySelector('.drawer-header');

        // --- Mobile-specific interactions ---
        if (drawerHeader) {
            drawerHeader.addEventListener('click', () => this.toggleExpansion());
            drawerHeader.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
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
                
                // We don't need to stop the PFD interval here,
                // as the user might just be hiding, not closing.
                
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

    // --- Swipe Gesture Handlers (Unchanged) ---
    handleTouchStart(e) {
        // Prevent swipe if touching a button or the scrollable content
        if (e.target.closest('button, a, .drawer-content')) {
            this.swipeState.isDragging = false;
            return;
        }
        
        e.preventDefault(); // Only prevent default if we're dragging the header
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
     * [RENOVATED]
     * Animates out, moves content back to the original hidden window,
     * and removes all mobile UI components.
     *
     * [FIXED v4.1] This function now correctly handles:
     * 1. Asynchronous cleanup to prevent a race condition where a new
     * window could be removed by a lingering setTimeout.
     * 2. Synchronous cleanup when 'force = true' is passed.
     * 3. Correctly moves content back without breaking the DOM structure.
     */
    closeActiveWindow(force = false) {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        // [CRITICAL] Move content back to the original hidden window
        // This ensures the desktop UI is intact if the user resizes.
        if (this.activeWindow && this.topWindowEl && this.bottomDrawerEl) {
            const topContent = this.topWindowEl.querySelector('.aircraft-overview-panel');
            const mainContent = this.bottomDrawerEl.querySelector('.unified-display-main-content');
            
            if (topContent) {
                this.activeWindow.appendChild(topContent);
            }
            
            // [FIX #2] Only move the main container. The stats display
            // is *inside* it and will be moved correctly with it.
            // Moving it separately breaks the DOM structure.
            if (mainContent) {
                this.activeWindow.appendChild(mainContent);
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