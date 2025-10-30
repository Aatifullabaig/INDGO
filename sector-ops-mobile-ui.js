/**
 * MobileUIHandler Module (Creative HUD Rehaul - v6.2 - Island Interiors)
 *
 * This version implements the "clean islands" concept AND redesigns the
 * content *within* the islands for a smoother, more modern HUD.
 *
 * REHAUL v6.1 CHANGES (Interior Redesign):
 * 1. NEW HANDLE: The handle is restyled to be a minimal "pill" (like
 * the iOS Dynamic Island). The border is removed from the handle and
 * added to the top of the content area.
 * 2. STATE 0 (MINI): Typography is tightened and vertically centered
 * for a cleaner "data strip" look.
 * 3. STATE 1 (PEEK): The side-by-side layout is REMOVED. It is now a
 * stacked layout: PFD on top, and a horizontal row of key
 * live-data (in a module) at the bottom. This de-clutters the view.
 * 4. STATE 2 (EXPANDED): The main content area is now a flex-column
 * with a `gap`. Data panels (like live-data) and buttons are
 * styled as distinct ".hud-module" cards for better organization.
 *
 * REHAUL v6.2 CHANGES (Consistent Handle Design):
 * 1. Mini Island now has a .drawer-handle for interaction affordance.
 * 2. All bottom islands (.drawer-handle) now have a consistent
 * `border-bottom` to cleanly separate the handle from content.
 * 3. Implements "v4 Redesign" for Mini Island content:
 * - "Less cramped" layout with more gap.
 * - "Smaller texts" (1.6rem) for a more balanced feel.
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
    overlayEl: null,
    
    // [NEW] Island elements
    miniIslandEl: null,
    peekIslandEl: null,
    expandedIslandEl: null,
    
    contentObserver: null,
    drawerState: 0, // 0 = Mini, 1 = Peek, 2 = Expanded
    swipeState: {
        touchStartY: 0,
        isDragging: false,
    },

    /**
     * Initializes the handler by injecting the new HUD styles.
     */
    init() {
        this.injectMobileStyles();
        console.log("Mobile UI Handler (HUD Rehaul v6.2 / Island Interiors) Initialized.");
    },

    /**
     * Injects all the CSS for the new HUD-themed floating islands.
     * ---
     * [REHAUL v6.2 / CONSISTENT HANDLES]
     * 1. Adds handle structure to Mini Island.
     * 2. Adds consistent separator line to all drawer handles.
     * 3. Implements "v4" content design for Mini Island.
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
                
                /* [MODIFIED] Island Dimensions */
                --drawer-handle-height: 30px; /* <-- Tighter handle */
                
                /* [USER REDESIGN v6.2] Mini Island Data Area Height */
                --drawer-mini-data-height: 60px; /* <-- Was 85px */
                
                --drawer-peek-content-height: 200px;
                --island-bottom-margin: env(safe-area-inset-bottom, 15px);
                --island-side-margin: 15px;
            }

            #view-rosters.active {
                position: relative;
                overflow: hidden;
            }

            /* --- Overlay --- */
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

            /* --- Base Island Class (Used by Top Window) --- */
            .mobile-aircraft-view {
                position: absolute;
                background: var(--hud-bg);
                backdrop-filter: blur(var(--hud-blur));
                -webkit-backdrop-filter: blur(var(--hud-blur));
                border: 1px solid var(--hud-border);
                z-index: 1045;
                transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
                will-change: transform, opacity;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5), var(--hud-glow);
                color: #e8eaf6;
                border-radius: 16px;
                overflow: hidden;
            }

            /* --- Top Floating Window --- */
            #mobile-aircraft-top-window {
                top: env(safe-area-inset-top, 15px);
                left: var(--island-side-margin);
                right: var(--island-side-margin);
                max-height: 250px;
                transform: translateY(-250%);
                opacity: 0;
            }
            #mobile-aircraft-top-window.visible {
                transform: translateY(0);
                opacity: 1;
            }

            /* --- [NEW] Base Class for Bottom Islands --- */
            .mobile-island-bottom {
                position: absolute;
                left: var(--island-side-margin);
                right: var(--island-side-margin);
                
                /* Visuals */
                background: var(--hud-bg);
                backdrop-filter: blur(var(--hud-blur));
                -webkit-backdrop-filter: blur(var(--hud-blur));
                border: 1px solid var(--hud-border);
                box-shadow: 0 10px 40px rgba(0,0,0,0.5), var(--hud-glow);
                color: #e8eaf6;
                border-radius: 16px;
                
                display: flex;
                flex-direction: column;
                
                /* Animation */
                transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
                will-change: transform, opacity;
                
                /* Default Off-Screen State */
                transform: translateY(120%);
                opacity: 0;
                z-index: 1045;
            }
            
            /* Active State for ALL Bottom Islands */
            .mobile-island-bottom.island-active {
                transform: translateY(0);
                opacity: 1;
            }

            /* --- [MODIFIED v6.2] State 0: Mini Island --- */
            #mobile-island-mini {
                bottom: var(--island-bottom-margin);
                /* [NEW] Total height is handle + data area */
                height: calc(var(--drawer-handle-height) + var(--drawer-mini-data-height)); 
                cursor: pointer;
                overflow: hidden;
                
                /* [NEW] Use flex to stack handle and content */
                display: flex;
                flex-direction: column; 
                padding: 0; /* Handle/content have their own padding */
            }

            /* [NEW v6.2] Make the "pill" fainter on the mini-island */
            #mobile-island-mini .drawer-handle::before {
                opacity: 0.3;
            }

            /* [NEW v6.2] Wrapper for the summary bar */
            .mini-content-wrapper {
                height: var(--drawer-mini-data-height);
                flex-grow: 1; /* Fill remaining space */
                overflow: hidden;
            }
            
            /* --- [NEW] State 1: Peek Island --- */
            #mobile-island-peek {
                bottom: var(--island-bottom-margin);
                height: calc(var(--drawer-handle-height) + var(--drawer-peek-content-height));
                overflow: hidden;
            }
            
            /* --- [NEW] State 2: Expanded Island --- */
            #mobile-island-expanded {
                top: 280px; /* Sits below the top window */
                bottom: var(--island-bottom-margin);
                height: auto; /* Fills the space */
                overflow: hidden; /* .drawer-content will scroll */
            }

            /* --- [MODIFIED v6.2] Drawer Handle (Used in ALL Bottom Islands) --- */
            .drawer-handle {
                height: var(--drawer-handle-height);
                flex-shrink: 0;
                cursor: grab;
                touch-action: none;
                user-select: none;
                display: grid;
                place-items: center;
                box-sizing: border-box;
                border-bottom: 1px solid var(--hud-border); /* [NEW] Consistent separator */
            }
            .drawer-handle::before {
                content: '';
                width: 40px; 
                height: 4px; 
                background: var(--hud-border);
                border-radius: 2px; 
                opacity: 0.5; 
            }
            #mobile-island-expanded .drawer-handle::before {
                opacity: 0.5; 
            }
            
            /* --- [MODIFIED] Drawer Content (Used in Peek & Expanded) --- */
            .drawer-content {
                overflow-y: auto;
                flex-grow: 1;
                padding-bottom: env(safe-area-inset-bottom, 0);
                /* [NOTE] Border is now on the handle, not here */
            }
            #mobile-island-peek .drawer-content {
                overflow: hidden;
            }
            .drawer-content::-webkit-scrollbar { width: 6px; }
            .drawer-content::-webkit-scrollbar-track { background: transparent; }
            .drawer-content::-webkit-scrollbar-thumb { background-color: var(--hud-accent); border-radius: 10px; }

            /* ====================================================================
            --- [USER REDESIGN V4] State 0: "Balanced" Widget Look ---
            ==================================================================== */

            /* [MODIFIED] The summary bar now lives inside the wrapper */
            .mini-content-wrapper > #vsd-summary-bar {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 0;
                height: 100%;
                padding: 8px 12px; /* Balanced padding */
                box-sizing: border-box;
                background: transparent;
                border-bottom: none;
                margin-bottom: 0;
                align-items: center;
            }

            /* [MODIFIED v4] Item layout: Value on top, Label on bottom */
            #vsd-summary-bar .vsd-summary-item {
                flex-direction: column-reverse; /* [MODIFIED] Flipped back to Value on Top */
                text-align: center;
                justify-content: center;
                padding: 0 4px;
                gap: 6px; /* [MODIFIED] Increased gap for a "less cramped" feel */
                overflow: hidden;
            }

            /* [MODIFIED v4] Data Label styling */
            #vsd-summary-bar .vsd-summary-item .data-label {
                font-size: 0.7rem; /* [MODIFIED] Smaller text */
                color: #9fa8da;
                text-transform: uppercase;
                font-weight: 500; /* [MODIFIED] Lighter weight */
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                margin-top: 0;
                opacity: 0.7; /* [NEW] De-emphasize for a cleaner look */
            }

            /* [MODIFIED v4] Data Value styling */
            #vsd-summary-bar .vsd-summary-item .data-value {
                font-size: 1.6rem; /* [MODIFIED] Smaller text */
                font-weight: 600;
                line-height: 1.1;
                color: #fff;
                
                display: flex;
                align-items: baseline;
                justify-content: center;
                gap: 4px;
                
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* [MODIFIED v4] Unit styling */
            #vsd-summary-bar .vsd-summary-item .data-value .unit {
                display: inline-block;
                font-size: 0.9rem; /* [MODIFIED] Good companion size */
                color: #9fa8da;
                font-weight: 400;
                margin-left: 1px;
                opacity: 0.7; /* [NEW] Match the label's opacity */
            }

            /* ====================================================================
            --- [END V4 REDESIGN] ---
            ==================================================================== */


            /* --- [REDESIGNED] State 1: "Peek View" Stacked Layout --- */
            #mobile-island-peek .unified-display-main {
                display: flex !important; /* <-- MODIFIED */
                flex-direction: column; /* <-- MODIFIED */
                height: var(--drawer-peek-content-height); /* 200px */
                padding: 10px;
                box-sizing: border-box;
                gap: 10px;
                overflow: hidden;
            }
            #mobile-island-peek .pfd-main-panel {
                margin: 0 !important;
                max-width: none !important;
                justify-content: center;
                flex-grow: 1; /* <-- ADDED */
                min-height: 0; /* <-- ADDED */
                width: 100%; /* <-- ADDED */
            }
            #mobile-island-peek .live-data-panel {
                flex-direction: row; /* <-- ADDED */
                justify-content: space-around !important;
                padding: 8px 0 !important; /* <-- MODIFIED */
                background: rgba(10, 12, 26, 0.5) !important; /* <-- ADDED */
                border-radius: 10px; /* <-- ADDED */
                flex-shrink: 0; /* <-- ADDED */
            }
            /* [NEW] Style Peek items for horizontal row */
            #mobile-island-peek .live-data-item {
                flex-direction: column-reverse;
                align-items: center;
            }
            #mobile-island-peek .live-data-item .data-label { font-size: 0.6rem; }
            #mobile-island-peek .live-data-item .data-value { font-size: 1.1rem; }
            #mobile-island-peek .live-data-item .data-value .unit { font-size: 0.7rem; }
            #mobile-island-peek .live-data-item .data-value-ete { font-size: 1.3rem; }

            /* Hide stats button in Mini and Peek states */
            .pilot-stats-toggle-btn {
                display: none;
            }

            /* --- [NEW] HUD Modules for Expanded View --- */
            .hud-module {
                background: rgba(10, 12, 26, 0.5);
                border-radius: 12px;
                padding: 16px;
                box-sizing: border-box;
            }

            /* --- [REDESIGNED] State 2: "Expanded" Stacked Layout --- */
            #mobile-island-expanded .unified-display-main {
                display: flex !important; /* <-- ADDED */
                flex-direction: column; /* <-- ADDED */
                gap: 16px; /* <-- ADDED */
                height: auto;
                overflow: hidden; /* <-- MODIFIED */
                padding: 16px;
            }
            #mobile-island-expanded .pfd-main-panel {
                margin: 0 auto !important;
                max-width: 400px !important;
                /* This is a display, not a module, so it has no BG */
            }
            #mobile-island-expanded .live-data-panel {
                justify-content: space-around !important;
                /* Apply module styles */
                background: rgba(10, 12, 26, 0.5) !important;
                border-radius: 12px; /* <-- ADDED */
                padding: 16px !important; /* <-- ADDED */
            }
            /* These styles are fine, they are for the *contents* of the module */
            #mobile-island-expanded .live-data-item .data-label { font-size: 0.7rem; }
            #mobile-island-expanded .live-data-item .data-value { font-size: 1.5rem; }
            #mobile-island-expanded .live-data-item .data-value .unit { font-size: 0.8rem; }
            #mobile-island-expanded .live-data-item .data-value-ete { font-size: 1.7rem; }
            
            /* [MODIFIED] Show stats button ONLY when expanded (as a module) */
            #mobile-island-expanded .pilot-stats-toggle-btn {
                display: flex;
                /* Apply module styles */
                background: rgba(10, 12, 26, 0.5);
                border-radius: 12px;
                padding: 16px;
                box-sizing: border-box;
                justify-content: center;
                align-items: center;
                text-decoration: none;
                color: var(--hud-accent);
                font-weight: 600;
                font-size: 1rem;
            }
            /* --- [END REHAUL v6.1] --- */

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
     * [FIXED] Force-closes any existing UI to ensure a clean state.
     */
    openWindow(windowElement) {
        if (!this.isMobile()) return;

        if (this.activeWindow) {
            this.closeActiveWindow(true); // 'true' = force close
        }

        if (windowElement.id === 'aircraft-info-window') {
            this.activeWindow = windowElement;
            this.createSplitViewUI(); // Build our new island containers

            setTimeout(() => {
                // Animate in the top window and the first island (mini)
                if (this.topWindowEl) this.topWindowEl.classList.add('visible');
                if (this.miniIslandEl) this.miniIslandEl.classList.add('island-active');
                this.drawerState = 0; // Set initial state
            }, 50);

            this.observeOriginalWindow(windowElement);
        }
    },

    /**
     * [REHAUL v6.2]
     * Creates the new DOM structure for the HUD:
     * 1 Top Window + 3 Bottom Islands (Mini, Peek, Expanded).
     *
     * v6.2 Change: Adds a drawer handle and content wrapper
     * directly into the Mini Island for better UX affordance.
     */
    createSplitViewUI() {
        const viewContainer = document.getElementById('view-rosters');
        if (!viewContainer) return;

        // 1. Overlay
        this.overlayEl = document.createElement('div');
        this.overlayEl.id = 'mobile-window-overlay';
        viewContainer.appendChild(this.overlayEl);
        
        // 2. Top Window
        this.topWindowEl = document.createElement('div');
        this.topWindowEl.id = 'mobile-aircraft-top-window';
        this.topWindowEl.className = 'mobile-aircraft-view';
        viewContainer.appendChild(this.topWindowEl);

        // 3. [MODIFIED v6.2] Bottom Island - State 0 (Mini)
        this.miniIslandEl = document.createElement('div');
        this.miniIslandEl.id = 'mobile-island-mini';
        this.miniIslandEl.className = 'mobile-island-bottom';
        // [NEW v6.2] Add handle and content wrapper
        this.miniIslandEl.innerHTML = `
            <div class="drawer-handle"></div>
            <div class="mini-content-wrapper"></div>
        `;
        viewContainer.appendChild(this.miniIslandEl);

        // 4. [NEW] Bottom Island - State 1 (Peek)
        this.peekIslandEl = document.createElement('div');
        this.peekIslandEl.id = 'mobile-island-peek';
        this.peekIslandEl.className = 'mobile-island-bottom';
        this.peekIslandEl.innerHTML = `
            <div class="drawer-handle"></div>
            <div class="drawer-content"></div>
        `;
        viewContainer.appendChild(this.peekIslandEl);
        
        // 5. [NEW] Bottom Island - State 2 (Expanded)
        this.expandedIslandEl = document.createElement('div');
        this.expandedIslandEl.id = 'mobile-island-expanded';
        this.expandedIslandEl.className = 'mobile-island-bottom';
        this.expandedIslandEl.innerHTML = `
            <div class="drawer-handle"></div>
            <div class="drawer-content"></div>
        `;
        viewContainer.appendChild(this.expandedIslandEl);
    },

    /**
     * Watches the original hidden window for when its content is ready.
     * (Unchanged from v5.2 - logic is robust)
     */
    observeOriginalWindow(windowElement) {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        this.contentObserver = new MutationObserver((mutationsList, obs) => {
            const mainContent = windowElement.querySelector('.unified-display-main-content');
            if (mainContent && mainContent.querySelector('#pfd-container')) {
                this.populateSplitView(windowElement);
                obs.disconnect();
                this.contentObserver = null;
            }
        });
        
        this.contentObserver.observe(windowElement, { childList: true, subtree: true });
    },

    /**
     * [REHAUL v6.2]
     * Moves content from the original window into the new island components.
     * 1. Top Overview -> Top Window
     * 2. Summary Bar -> Mini Island's ".mini-content-wrapper"
     * 3. Main Content -> CLONED to Peek Island, MOVED to Expanded Island
     */
    populateSplitView(sourceWindow) {
        if (!this.topWindowEl || !this.miniIslandEl || !this.peekIslandEl || !this.expandedIslandEl) return;

        // Find content containers
        const miniContentContainer = this.miniIslandEl.querySelector('.mini-content-wrapper'); // <-- NEW
        const peekContentContainer = this.peekIslandEl.querySelector('.drawer-content');
        const expandedContentContainer = this.expandedIslandEl.querySelector('.drawer-content');
        if (!miniContentContainer || !peekContentContainer || !expandedContentContainer) return; // <-- UPDATED

        // Find original content pieces
        const topOverviewPanel = sourceWindow.querySelector('.aircraft-overview-panel');
        const vsdSummaryBar = sourceWindow.querySelector('#vsd-summary-bar');
        const mainFlightContent = sourceWindow.querySelector('.unified-display-main-content');
        
        // 1. Move Top Panel
        if (topOverviewPanel) {
            this.topWindowEl.appendChild(topOverviewPanel);
        }

        // 2. Move Summary Bar to Mini Island
        if (vsdSummaryBar && miniContentContainer) {
            miniContentContainer.appendChild(vsdSummaryBar); // <-- MODIFIED
        }
        
        // 3. [CRITICAL] Clone and Move Main Content
        if (mainFlightContent) {
            // Clone the content for the "Peek" view
            const clonedFlightContent = mainFlightContent.cloneNode(true);
            peekContentContainer.appendChild(clonedFlightContent);
            
            // Move the *original* content to the "Expanded" view
            expandedContentContainer.appendChild(mainFlightContent);
        }
        
        this.wireUpInteractions();
    },

    /**
     * [REHAUL v6.0]
     * Wires up all-new interactions for the islands.
     * - Click logic is explicit (Mini -> Peek, Peek -> Expanded, etc.)
     * - Swipe logic is simplified (no drag-to-move).
     */
    wireUpInteractions() {
        if (!this.miniIslandEl || !this.peekIslandEl || !this.expandedIslandEl) return;

        // --- Click Interactions ---
        
        // State 0 -> 1
        this.miniIslandEl.addEventListener('click', () => this.setDrawerState(1));
        
        const peekHandle = this.peekIslandEl.querySelector('.drawer-handle');
        const expandedHandle = this.expandedIslandEl.querySelector('.drawer-handle');

        // State 1 -> 2
        if (peekHandle) {
            peekHandle.addEventListener('click', () => this.setDrawerState(2));
        }
        
        // State 2 -> 1 (Goes back to Peek, not Mini)
        if (expandedHandle) {
            expandedHandle.addEventListener('click', () => this.setDrawerState(1));
        }
        
        // Overlay click -> State 0
        if (this.overlayEl) {
            this.overlayEl.addEventListener('click', () => this.setDrawerState(0));
        }

        // --- Swipe Interactions ---
        this.miniIslandEl.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        if (peekHandle) {
            peekHandle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        }
        if (expandedHandle) {
            expandedHandle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        }
        
        // [REMOVED] 'touchmove' listener is no longer needed.
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // --- Re-wire desktop buttons using event delegation ---

        // 1. Close and Hide buttons (in top panel)
        this.topWindowEl.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.aircraft-window-close-btn');
            const hideBtn = e.target.closest('.aircraft-window-hide-btn');

            if (closeBtn) this.closeActiveWindow();

            if (hideBtn) {
                this.topWindowEl.classList.remove('visible');
                this.setDrawerState(0); // Go to mini state
                
                // Hide all bottom islands
                this.miniIslandEl?.classList.remove('island-active');
                this.peekIslandEl?.classList.remove('island-active');
                this.expandedIslandEl?.classList.remove('island-active');
                
                this.overlayEl.classList.remove('visible');
                
                const recallBtn = document.getElementById('aircraft-recall-btn');
                if (recallBtn) {
                    recallBtn.classList.add('visible', 'palpitate');
                    setTimeout(() => recallBtn.classList.remove('palpitate'), 1000);
                }
            }
        });
        
        // 2. Stats and Back buttons (in bottom islands)
        // [NEW] This single handler is attached to both Peek and Expanded islands.
        const bottomIslandButtonHandler = async (e) => {
            const statsBtn = e.target.closest('.pilot-stats-toggle-btn');
            const backBtn = e.target.closest('.back-to-flight-btn');
            const island = e.currentTarget; // Get the island (Peek or Expanded)

            if (statsBtn) {
                const userId = statsBtn.dataset.userId;
                const username = statsBtn.dataset.username;
                
                if (userId) {
                    // Find displays *within this island*
                    const statsDisplay = island.querySelector('#pilot-stats-display');
                    const flightDisplay = island.querySelector('#aircraft-display-main');
                    if (statsDisplay && flightDisplay) {
                        await displayPilotStats(userId, username);
                        flightDisplay.style.display = 'none';
                        statsDisplay.style.display = 'block';
                    }
                }
            }

            if (backBtn) {
                const statsDisplay = island.querySelector('#pilot-stats-display');
                const flightDisplay = island.querySelector('#aircraft-display-main');
                if (statsDisplay && flightDisplay) {
                    statsDisplay.style.display = 'none';
                    flightDisplay.style.display = 'flex';
                }
            }
        };
        
        this.peekIslandEl.addEventListener('click', bottomIslandButtonHandler);
        this.expandedIslandEl.addEventListener('click', bottomIslandButtonHandler);
    },
    
    /**
     * [REHAUL v6.0]
     * Sets the drawer to a specific state (0, 1, or 2) by toggling
     * the '.island-active' class on the correct island.
     */
    setDrawerState(targetState) {
        if (targetState === this.drawerState || this.swipeState.isDragging || !this.miniIslandEl) return;
        
        this.drawerState = targetState;

        // Toggle the active class on the correct island
        this.miniIslandEl.classList.toggle('island-active', this.drawerState === 0);
        this.peekIslandEl.classList.toggle('island-active', this.drawerState === 1);
        this.expandedIslandEl.classList.toggle('island-active', this.drawerState === 2);
        
        // Overlay is only visible when fully expanded
        const isFullyExpanded = (this.drawerState === 2);
        if (this.overlayEl) this.overlayEl.classList.toggle('visible', isFullyExpanded);
    },

    // --- Swipe Gesture Handlers ---
    
    /**
     * [REHAUL v6.0]
     * Simplified: Only registers the start of a drag.
     * Allows dragging from handles OR the entire mini island.
     */
    handleTouchStart(e) {
        const handle = e.target.closest('.drawer-handle');
        const miniIsland = e.target.closest('#mobile-island-mini');
        
        // Only start a swipe if it's on a handle or the mini island
        if (!handle && !miniIsland) {
             this.swipeState.isDragging = false;
             return;
        }
        
        e.preventDefault();
        this.swipeState.isDragging = true;
        this.swipeState.touchStartY = e.touches[0].clientY;
    },

    /**
     * [REHAUL v6.0] handleTouchMove has been DELETED.
     * All logic is now in handleTouchEnd for a "snap" interaction.
     */
    handleTouchEnd(e) {
        if (!this.swipeState.isDragging) return;
        this.swipeState.isDragging = false;

        const touchEndY = e.changedTouches[0].clientY;
        const deltaY = touchEndY - this.swipeState.touchStartY;
        const currentState = this.drawerState;

        // "Throw away" gesture: swipe down hard from the mini state to close
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
        
        this.setDrawerState(newState);
        
        this.swipeState.touchStartY = 0;
    },

    /**
     * [REHAUL v6.2]
     * Animates out all islands, moves *original* content back,
     * *destroys* cloned content, and cleans up.
     * * v6.2: Finds summary bar inside .mini-content-wrapper
     */
    closeActiveWindow(force = false) {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        // [CRITICAL] Move content back and destroy clone
        if (this.activeWindow && this.topWindowEl && this.miniIslandEl && this.peekIslandEl && this.expandedIslandEl) {
            const topOverviewPanel = this.topWindowEl.querySelector('.aircraft-overview-panel');
            
            // [MODIFIED v6.2] Find summary bar in its wrapper
            const miniContentWrapper = this.miniIslandEl.querySelector('.mini-content-wrapper');
            const vsdSummaryBar = miniContentWrapper ? miniContentWrapper.querySelector('#vsd-summary-bar') : null;
            
            // Get the ORIGINAL content from the expanded island
            const mainFlightContent = this.expandedIslandEl.querySelector('.unified-display-main-content');
            // Get the CLONE from the peek island to destroy it
            const clonedFlightContent = this.peekIslandEl.querySelector('.unified-display-main-content');
            
            if (topOverviewPanel) {
                this.activeWindow.appendChild(topOverviewPanel);
            }
            
            if (vsdSummaryBar && mainFlightContent) {
                const aircraftDisplayMain = mainFlightContent.querySelector('#aircraft-display-main');
                if (aircraftDisplayMain) {
                    aircraftDisplayMain.prepend(vsdSummaryBar); 
                } else {
                    mainFlightContent.prepend(vsdSummaryBar);
                }
            }

            if (mainFlightContent) {
                this.activeWindow.appendChild(mainFlightContent);
            }
            
            // Destroy the clone
            if (clonedFlightContent) {
                clonedFlightContent.remove();
            }
        }

        const animationDuration = force ? 0 : 500;

        const overlayToRemove = this.overlayEl;
        const topWindowToRemove = this.topWindowEl;
        const miniIslandToRemove = this.miniIslandEl;
        const peekIslandToRemove = this.peekIslandEl;
        const expandedIslandToRemove = this.expandedIslandEl;

        if (window.activePfdUpdateInterval) {
             clearInterval(window.activePfdUpdateInterval);
             window.activePfdUpdateInterval = null;
        }

        const resetState = () => {
            this.activeWindow = null;
            this.contentObserver = null;
            this.topWindowEl = null;
            this.overlayEl = null;
            this.miniIslandEl = null;
            this.peekIslandEl = null;
            this.expandedIslandEl = null;
            this.drawerState = 0;
        };

        if (force) {
            overlayToRemove?.remove();
            topWindowToRemove?.remove();
            miniIslandToRemove?.remove();
            peekIslandToRemove?.remove();
            expandedIslandToRemove?.remove();
            resetState();
        } else {
            // Animate all 4 islands out
            if (overlayToRemove) overlayToRemove.classList.remove('visible');
            if (topWindowToRemove) topWindowToRemove.classList.remove('visible');
            if (miniIslandToRemove) miniIslandToRemove.classList.remove('island-active');
            if (peekIslandToRemove) peekIslandToRemove.classList.remove('island-active');
            if (expandedIslandToRemove) expandedIslandToRemove.classList.remove('island-active');

            setTimeout(() => {
                overlayToRemove?.remove();
                topWindowToRemove?.remove();
                miniIslandToRemove?.remove();
                peekIslandToRemove?.remove();
                expandedIslandToRemove?.remove();
                
                // Check if a new window was opened *during* the close animation
                if (this.topWindowEl === topWindowToRemove) {
                    resetState();
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