/**
 * MobileUIHandler Module (Creative HUD Rehaul - v6.6 - State Change Fix)
 *
 * REHAUL v6.6 CHANGES (State Change Fix):
 * 1. IDENTIFIED bug in `setDrawerState`: It was checking `this.swipeState.isDragging`
 * which prevented the `handleTouchEnd` function from *ever*
 * successfully changing the state.
 * 2. REMOVED the `this.swipeState.isDragging` check from `setDrawerState`.
 * The click handlers already perform this check, which is the correct
 * place for it.
 * 3. All other logic from v6.5 (Unified Handle) remains.
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
     * [NEW] Restores the main map UI controls.
     */
    restoreMapControls() {
        const burgerMenu = document.getElementById('mobile-sidebar-toggle');
        // Find the map toolbar by finding the parent of one of its buttons
        const mapToolbar = document.getElementById('toolbar-toggle-panel-btn')?.parentElement;
        
        // Revert to stylesheet defaults
        if (burgerMenu) burgerMenu.style.display = ''; 
        if (mapToolbar) mapToolbar.style.display = '';
    },

    /**
     * Initializes the handler by injecting the new HUD styles.
     */
    init() {
        this.injectMobileStyles();
        console.log("Mobile UI Handler (HUD Rehaul v6.6 / State Change Fix) Initialized.");
    },

    /**
     * Injects all the CSS for the new HUD-themed floating islands.
     * ---
     * [REHAUL v6.5 / UNIFIED HANDLE]
     * 1. Removes all styles for `.drawer-handle`.
     * 2. Adds handle properties (`cursor`, `touch-action`, etc.) to
     * `.route-summary-wrapper-mobile`.
     * 3. Adds the "pill" pseudo-element (`::before`) to
     * `.route-summary-wrapper-mobile` and gives it `padding-bottom`.
     * ---
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
                
                /* [REMOVED v6.5] --drawer-handle-height was here */
                
                /* [REMOVED v6.4] Mini Island Data Area Height */
                /* --drawer-mini-data-height: 70px; */
                
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
                
                /* [NEW v6.4] All bottom islands must overflow hidden */
                overflow: hidden;
            }
            
            /* Active State for ALL Bottom Islands */
            .mobile-island-bottom.island-active {
                transform: translateY(0);
                opacity: 1;
            }

            /* --- [MODIFIED v6.4] State 0: Mini Island --- */
            #mobile-island-mini {
                bottom: var(--island-bottom-margin);
                /* [MODIFIED v6.4] Height is auto-sized by content */
                height: auto; 
                /* [REMOVED v6.5] cursor: pointer was here */
                
                /* [NEW] Use flex to stack route bar and handle */
                display: flex;
                flex-direction: column; 
            }

            /* [REMOVED v6.5] Faint pill rule for mini-island was here */
            /* [REMOVED v6.4] .mini-content-wrapper was here */
            
            /* --- [NEW] State 1: Peek Island --- */
            #mobile-island-peek {
                bottom: var(--island-bottom-margin);
                /* [MODIFIED v6.4] Height is now auto (route bar + handle + content) */
                height: auto; 
            }
            
            /* --- [NEW] State 2: Expanded Island --- */
            #mobile-island-expanded {
                top: 280px; /* Sits below the top window */
                bottom: var(--island-bottom-margin);
                height: auto; /* Fills the space */
            }

            /* ====================================================================
            --- [MODIFIED v6.5] Route Summary Bar Styling (Mobile)
            ==================================================================== */
            
            /* [NEW v6.5] This is now the unified handle */
            .route-summary-wrapper-mobile {
                flex-shrink: 0;
                overflow: hidden;
                border-top-left-radius: 16px;
                border-top-right-radius: 16px;
                
                /* [NEW v6.5] Add handle properties */
                cursor: grab;
                touch-action: none;
                user-select: none;
                position: relative;
                
                /* [MODIFIED BY USER REQUEST] Add background to blend pill */
                background: var(--hud-bg);
                
                /* [REMOVED BY USER REQUEST] Removed padding-bottom */
                /* padding-bottom: 20px; */
            }
            
            /* [NEW v6.5] Add the pill visual */
            .route-summary-wrapper-mobile::before {
                content: '';
                position: absolute;
                left: 50%;
                transform: translateX(-50%);
                /* [MODIFIED BY USER REQUEST] Positioned at top */
                top: 8px; 
                width: 40px; 
                height: 4px; 
                background: var(--hud-border);
                border-radius: 2px; 
                opacity: 0.5;
            }
            
            /* [NEW v6.5] Make the pill fainter on the mini-island */
            #mobile-island-mini .route-summary-wrapper-mobile::before {
                opacity: 0.3;
            }

            /* [NEW] Override desktop styles for the route bar on mobile */
            .route-summary-wrapper-mobile .route-summary-overlay {
                /* Reset properties that fight the mobile layout */
                position: relative; 
                margin-bottom: 0;
                
                /* Use a simpler background, the gradient overlap is complex */
                background: var(--hud-bg);
                border-radius: 0; /* Wrapper handles rounding */
                
                /* Adjust padding for a tighter mobile look */
                /* [MODIFIED v6.5] Removed padding-bottom, handled by wrapper */
                padding: 12px 15px 0 15px; 
                
                /* Force grid to 3 columns and scale down text */
                grid-template-columns: auto 1fr auto;
                gap: 12px;
            }
            .route-summary-wrapper-mobile .route-summary-airport .icao {
                font-size: 1.0rem;
            }
            .route-summary-wrapper-mobile .route-summary-airport .time {
                font-size: 0.75rem;
                margin-top: 2px;
            }
            .route-summary-wrapper-mobile .route-summary-airport .country-flag {
                width: 16px;
            }
            .route-summary-wrapper-mobile .flight-phase-indicator {
                padding: 3px 10px;
                font-size: 0.7rem;
            }
            /* [NEW] Hide the progress bar fill on Mini and Peek islands */
            #mobile-island-mini .route-summary-wrapper-mobile .progress-bar-fill,
            #mobile-island-peek .route-summary-wrapper-mobile .progress-bar-fill {
                display: none;
            }
            /* [NEW] Make progress bar bg fainter on Mini/Peek */
            #mobile-island-mini .route-summary-wrapper-mobile .route-progress-bar-container,
            #mobile-island-peek .route-summary-wrapper-mobile .route-progress-bar-container {
                 background: rgba(10, 12, 26, 0.4);
            }
            
            /* ====================================================================
            --- [END V6.5 MODIFIED STYLES] ---
            ==================================================================== */


            /* --- [REMOVED v6.5] .drawer-handle styles were here --- */
            
            /* --- [MODIFIED] Drawer Content (Used in Peek & Expanded) --- */
            .drawer-content {
                overflow-y: auto;
                flex-grow: 1;
                padding-bottom: env(safe-area-inset-bottom, 0);
                /* [NEW v6.4] Explicitly set height for peek content */
                height: var(--drawer-peek-content-height);
            }
            #mobile-island-peek .drawer-content {
                overflow: hidden;
            }
            /* [NEW v6.4] Expanded content must fill remaining space */
            #mobile-island-expanded .drawer-content {
                height: auto;
            }
            
            .drawer-content::-webkit-scrollbar { width: 6px; }
            .drawer-content::-webkit-scrollbar-track { background: transparent; }
            .drawer-content::-webkit-scrollbar-thumb { background-color: var(--hud-accent); border-radius: 10px; }

            /* ====================================================================
            --- [REMOVED v6.4] V4 REDESIGN WAS HERE ---
            ==================================================================== */


            /* ====================================================================
            --- [START OF USER REQUEST V7: 2025-10-30] ---
            --- State 1: "Peek" Side-by-Side Layout ---
            ==================================================================== */
            #mobile-island-peek .unified-display-main {
                display: flex !important;
                flex-direction: row !important; /* <-- Use horizontal layout */
                height: var(--drawer-peek-content-height); /* 200px */
                padding: 10px;
                box-sizing: border-box;
                gap: 10px;
                overflow: hidden;
            }
            
            /* PFD on the left */
            #mobile-island-peek .pfd-main-panel {
                margin: 0 !important;
                max-width: none !important;
                justify-content: center;
                flex-basis: 80%; /* <-- [USER REQ V7] Changed to 80% */
                flex-grow: 0;
                flex-shrink: 0;
                width: 80%; /* <-- [USER REQ V7] Changed to 80% */
                min-height: 0;
                height: 100%;
                
                /* [NEW] Ensure flex properties for child growth */
                display: flex !important;
                flex-direction: column !important;
            }
            
            /* [MODIFIED V6] Make PFD container fill AND scale its child */
            #mobile-island-peek #pfd-container {
                flex-grow: 1;
                border-radius: 12px !important;
                
                /* [NEW V6] Use grid to force child scaling */
                display: grid; 
                place-items: center;
                overflow: hidden; /* Hide any overflow */
            }
            
            /* [NEW V6] Force the PFD's canvas/svg to fill container */
            #mobile-island-peek #pfd-container > * {
                width: 100% !important;
                height: 100% !important;
                object-fit: contain; /* Good for scaling SVGs/Canvas */
            }

            /* [NEW] Hide PFD footer */
            #mobile-island-peek .pfd-footer-display {
                display: none !important;
            }
            
            /* Data Panel on the right */
            #mobile-island-peek .live-data-panel {
                flex-direction: column; /* <-- Stack data items VERTICALLY */
                justify-content: flex-start !important; /* <-- Align to top */
                padding: 8px !important; /* <-- Adjusted padding */
                background: rgba(10, 12, 26, 0.5) !important;
                border-radius: 10px;
                
                flex-grow: 1; /* <-- Fill remaining space */
                flex-shrink: 1;
                flex-basis: auto; /* <-- [USER REQ V7] Let it fill remaining 20% */
                
                height: 100%; /* <-- Fill the container height */
                box-sizing: border-box;
                overflow: auto; /* <-- Allow scroll if bubbles overflow */
                gap: 6px; /* <-- Space out the bubbles */
            }
            
            /* Styling for the "bubble" items */
            #mobile-island-peek .live-data-item {
                flex-direction: column-reverse; /* Value on top, label on bottom */
                align-items: flex-start; /* <-- LEFT-ALIGN text */
                width: 100%;
                
                /* Bubble styles */
                background: rgba(20, 25, 40, 0.7);
                padding: 6px 10px;
                border-radius: 8px;
                box-sizing: border-box;
                flex-shrink: 0; /* <-- Prevent bubbles from shrinking */
            }
            #mobile-island-peek .live-data-item .data-label { 
                font-size: 0.6rem; 
                opacity: 0.7;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #mobile-island-peek .live-data-item .data-value { 
                font-size: 1.0rem; /* <-- Sized down */
                font-weight: 600;
                line-height: 1.1;
            }
            #mobile-island-peek .live-data-item .data-value .unit { 
                font-size: 0.7rem; 
                opacity: 0.7;
            }
            #mobile-island-peek .live-data-item .data-value-ETE { 
                font-size: 1.2rem; /* <-- Sized down */
                font-weight: 600;
                color: var(--hud-accent); /* <-- Make ETE stand out */
            }

            /* --- Hide VSD in Peek State --- */
            #mobile-island-peek #vsd-panel {
                display: none !important;
            }
            /* ====================================================================
            --- [END OF USER REQUEST V7] ---
            ==================================================================== */


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

            /* --- [RESTORED] State 2: "Expanded" Stacked Layout --- */
            #mobile-island-expanded .unified-display-main {
                display: flex !important;
                flex-direction: column; /* <-- Original vertical stack */
                gap: 16px; /* <-- Original gap */
                height: auto;
                overflow: hidden;
                padding: 16px;
            }
            #mobile-island-expanded .pfd-main-panel {
                margin: 0 auto !important; /* <-- Original centered layout */
                max-width: 400px !important; /* <-- Original max-width */
            }
            #mobile-island-expanded .live-data-panel {
                justify-content: space-around !important; /* <-- Original layout */
                /* Apply module styles */
                background: rgba(10, 12, 26, 0.5) !important;
                border-radius: 12px; /* <-- Original style */
                padding: 16px !important; /* <-- Original style */
            }
            /* Original styles for *contents* of the module */
            #mobile-island-expanded .live-data-item {
                 /* Uses default flex-direction (row) and alignment (center) */
            }
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
                margin-top: 16px; /* Add space from the content above */
            }

            /* --- VSD is visible by default in State 2 --- */
            /* No rule needed */


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
     * [MODIFIED] Hides main map controls when opening.
     */
    openWindow(windowElement) {
        if (!this.isMobile()) return;

        if (this.activeWindow) {
            this.closeActiveWindow(true); // 'true' = force close
        }

        if (windowElement.id === 'aircraft-info-window') {
            // --- [NEW] Hide map controls ---
            const burgerMenu = document.getElementById('mobile-sidebar-toggle');
            const mapToolbar = document.getElementById('toolbar-toggle-panel-btn')?.parentElement;
            
            if (burgerMenu) burgerMenu.style.display = 'none';
            if (mapToolbar) mapToolbar.style.display = 'none';
            // --- [END NEW] ---

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
     * [REHAUL v6.5]
     * Creates the new DOM structure for the HUD:
     * 1 Top Window + 3 Bottom Islands (Mini, Peek, Expanded).
     *
     * v6.5 Change: REMOVES the `.drawer-handle` div from all islands.
     * The `.route-summary-wrapper-mobile` is now the handle.
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

        // 3. [MODIFIED v6.5] Bottom Island - State 0 (Mini)
        this.miniIslandEl = document.createElement('div');
        this.miniIslandEl.id = 'mobile-island-mini';
        this.miniIslandEl.className = 'mobile-island-bottom';
        // [MODIFIED v6.5] Only contains the route bar wrapper
        this.miniIslandEl.innerHTML = `
            <div class="route-summary-wrapper-mobile"></div>
        `;
        viewContainer.appendChild(this.miniIslandEl);

        // 4. [MODIFIED v6.5] Bottom Island - State 1 (Peek)
        this.peekIslandEl = document.createElement('div');
        this.peekIslandEl.id = 'mobile-island-peek';
        this.peekIslandEl.className = 'mobile-island-bottom';
        this.peekIslandEl.innerHTML = `
            <div class="route-summary-wrapper-mobile"></div>
            <div class="drawer-content"></div>
        `;
        viewContainer.appendChild(this.peekIslandEl);
        
        // 5. [MODIFIED v6.5] Bottom Island - State 2 (Expanded)
        this.expandedIslandEl = document.createElement('div');
        this.expandedIslandEl.id = 'mobile-island-expanded';
        this.expandedIslandEl.className = 'mobile-island-bottom';
        this.expandedIslandEl.innerHTML = `
            <div class="route-summary-wrapper-mobile"></div>
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
     * [REHAUL v6.4]
     * Moves content from the original window into the new island components.
     * 1. Top Overview -> Top Window
     * 2. Route Summary Bar -> CLONED to Mini, Peek, and Expanded Islands
     * 3. Main Content -> CLONED to Peek Island, MOVED to Expanded Island
     * 4. VSD Summary Bar (old) -> Is NO LONGER MOVED. Stays in Main Content.
     */
    populateSplitView(sourceWindow) {
        if (!this.topWindowEl || !this.miniIslandEl || !this.peekIslandEl || !this.expandedIslandEl) return;

        // Find content containers
        const miniRouteContainer = this.miniIslandEl.querySelector('.route-summary-wrapper-mobile'); // <-- NEW
        const peekRouteContainer = this.peekIslandEl.querySelector('.route-summary-wrapper-mobile'); // <-- NEW
        const expandedRouteContainer = this.expandedIslandEl.querySelector('.route-summary-wrapper-mobile'); // <-- NEW
        
        const peekContentContainer = this.peekIslandEl.querySelector('.drawer-content');
        const expandedContentContainer = this.expandedIslandEl.querySelector('.drawer-content');
        if (!peekContentContainer || !expandedContentContainer || !miniRouteContainer || !peekRouteContainer || !expandedRouteContainer) return;

        // Find original content pieces
        const topOverviewPanel = sourceWindow.querySelector('.aircraft-overview-panel');
        const routeSummaryBar = sourceWindow.querySelector('.route-summary-overlay'); // <-- NEW
        const mainFlightContent = sourceWindow.querySelector('.unified-display-main-content');
        
        // [REMOVED v6.4] VSD Summary Bar logic is gone

        // 1. Move Top Panel
        if (topOverviewPanel) {
            this.topWindowEl.appendChild(topOverviewPanel);
        }
        
        // 2. [NEW v6.4] Clone and Move Route Summary Bar to ALL three islands
        if (routeSummaryBar) {
            const clonedRouteBar1 = routeSummaryBar.cloneNode(true);
            const clonedRouteBar2 = routeSummaryBar.cloneNode(true);
            const clonedRouteBar3 = routeSummaryBar.cloneNode(true);
            
            miniRouteContainer.appendChild(clonedRouteBar1);
            peekRouteContainer.appendChild(clonedRouteBar2);
            expandedRouteContainer.appendChild(clonedRouteBar3);
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
     * [REHAUL v6.5]
     * Wires up all interactions to the new unified handle
     * (`.route-summary-wrapper-mobile`) in all three islands.
     */
    wireUpInteractions() {
        if (!this.miniIslandEl || !this.peekIslandEl || !this.expandedIslandEl) return;

        // [NEW v6.5] Get the new unified handles
        const miniHandle = this.miniIslandEl.querySelector('.route-summary-wrapper-mobile');
        const peekHandle = this.peekIslandEl.querySelector('.route-summary-wrapper-mobile');
        const expandedHandle = this.expandedIslandEl.querySelector('.route-summary-wrapper-mobile');

        if (!miniHandle || !peekHandle || !expandedHandle) return;

        // --- Click Interactions ---
        
        // State 0 -> 1
        miniHandle.addEventListener('click', (e) => {
            // Prevent click from firing if it was the end of a swipe
            if (this.swipeState.isDragging) return;
            this.setDrawerState(1);
        });
        
        // State 1 -> 2
        peekHandle.addEventListener('click', (e) => {
            if (this.swipeState.isDragging) return;
            this.setDrawerState(2);
        });
        
        // State 2 -> 1 (Goes back to Peek, not Mini)
        expandedHandle.addEventListener('click', (e) => {
            if (this.swipeState.isDragging) return;
            this.setDrawerState(1);
        });
        
        // Overlay click -> State 0
        if (this.overlayEl) {
            this.overlayEl.addEventListener('click', () => this.setDrawerState(0));
        }

        // --- Swipe Interactions ---
        // [NEW v6.5] Listen on all three new handles
        miniHandle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        peekHandle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        expandedHandle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        
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
     * [REHAUL v6.6 - THE FIX]
     * Sets the drawer to a specific state (0, 1, or 2).
     * Removed the faulty `isDragging` check that prevented
     * state changes from `handleTouchEnd`.
     */
    setDrawerState(targetState) {
        // [REMOVED v6.6] The isDragging check was here.
        if (targetState === this.drawerState || !this.miniIslandEl) return;
        
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
     * [REHAUL v6.5]
     * Simplified: Only registers the start of a drag from the
     * new unified handle `.route-summary-wrapper-mobile`.
     */
    handleTouchStart(e) {
        // [CHANGED v6.5] Only check for the new unified handle
        const handle = e.target.closest('.route-summary-wrapper-mobile');
        
        // Only start a swipe if it's on the handle
        if (!handle) {
             this.swipeState.isDragging = false;
             return;
        }
        
        e.preventDefault();
        this.swipeState.isDragging = true;
        this.swipeState.touchStartY = e.touches[0].clientY;
    },

    /**
     * [REHAUL v6.5]
     * Handles the end of a swipe.
     * 1. Calculates new state based on swipe direction.
     * 2. Calls `setDrawerState` (which is no longer blocked).
     * 3. Uses a `setTimeout` to reset `isDragging` *after* a delay,
     * which correctly blocks the `click` event from firing.
     */
    handleTouchEnd(e) {
        if (!this.swipeState.isDragging) return;
        
        // [CHANGED v6.5] We must set isDragging to false *after* a short delay.
        // This allows the 'click' event listeners to check this flag and
        // prevent a "click" from firing at the end of a "swipe".
        setTimeout(() => {
            this.swipeState.isDragging = false;
            this.swipeState.touchStartY = 0;
        }, 50); // A 50ms delay is usually enough

        const touchEndY = e.changedTouches[0].clientY;
        const deltaY = touchEndY - this.swipeState.touchStartY;
        const currentState = this.drawerState;

        // "Throw away" gesture: swipe down hard from the mini state to close
        if (deltaY > 150 && currentState === 0) {
             this.closeActiveWindow();
             return; // The setTimeout will still run, which is fine.
        }
        
        let newState = currentState;
        // Snap open or closed based on swipe direction
        if (deltaY < -50) { // Swiped up
             newState = Math.min(2, currentState + 1); // Go up one state, max 2
        } else if (deltaY > 50) { // Swiped down
             newState = Math.max(0, currentState - 1); // Go down one state, min 0
        }
        
        this.setDrawerState(newState); // [FIX v6.6] This now works.
        
        // [REMOVED v6.5] State reset is now in the setTimeout
    },

    /**
     * [REHAUL v6.4]
     * Animates out all islands, moves *original* content back,
     * *destroys* cloned content, and cleans up.
     * v6.4: Removes all logic for `#vsd-summary-bar` as it is
     * no longer moved separately from its parent.
     * [MODIFIED] Restores main map controls on close.
     */
    closeActiveWindow(force = false) {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        // [CRITICAL] Move content back and destroy clone
        if (this.activeWindow && this.topWindowEl && this.miniIslandEl && this.peekIslandEl && this.expandedIslandEl) {
            const topOverviewPanel = this.topWindowEl.querySelector('.aircraft-overview-panel');
            
            // [REMOVED v6.4] Logic for vsdSummaryBar removed
            
            // Get the ORIGINAL content from the expanded island
            const mainFlightContent = this.expandedIslandEl.querySelector('.unified-display-main-content');
            // Get the CLONE from the peek island to destroy it
            const clonedFlightContent = this.peekIslandEl.querySelector('.unified-display-main-content');
            
            // [REMOVED v6.4] Destroy route bar clones (happens when islands are removed)

            if (topOverviewPanel) {
                this.activeWindow.appendChild(topOverviewPanel);
            }
            
            // [REMOVED v6.4] Logic to re-prepend vsdSummaryBar is gone.
            // It now stays inside mainFlightContent, where it belongs.

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
            
            // --- [NEW] Restore controls ---
            this.restoreMapControls();
            
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
                
                // --- [NEW] Restore controls ---
                this.restoreMapControls();

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