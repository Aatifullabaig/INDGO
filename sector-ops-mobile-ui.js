/**
 * MobileUIHandler Module (Creative HUD Rehaul - v7.0 - Peek View Reconfig)
 *
 * REHAUL v7.0 CHANGES (Peek View Reconfig):
 * 1. IDENTIFIED that "Peek" view (State 1) CSS was outdated
 * and still trying to show the PFD.
 * 2. REPLACED the entire CSS block for "#mobile-island-peek"
 * to align with the new v14 layout from crew-center.js.
 * 3. NEW CSS now hides the PFD panel (`.pfd-main-panel`).
 * 4. NEW CSS now correctly displays the location panel
 * (`#location-data-panel`) and the flight data bar
 * (`.flight-data-bar`).
 * 5. ADJUSTED padding and font sizes for these elements to fit
 * within the 200px peek drawer.
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
    closeTimer: null,
    
    // [NEW] Island elements
    miniIslandEl: null,
    peekIslandEl: null,
    expandedIslandEl: null,
    
    contentObserver: null,
    documentListenersWired: false, // <-- [FIX] This flag prevents duplicate listeners
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
        console.log("Mobile UI Handler (HUD Rehaul v7.0 / Peek View Reconfig) Initialized.");
    },

    /**
     * Injects all the CSS for the new HUD-themed floating islands.
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
                
                --drawer-peek-content-height: 200px;
                --island-bottom-margin: env(safe-area-inset-bottom, 15px);
                --island-side-margin: 10px;
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
                
                overflow: hidden;
            }
            
            /* Active State for ALL Bottom Islands */
            .mobile-island-bottom.island-active {
                transform: translateY(0);
                opacity: 1;
            }

            /* --- State 0: Mini Island --- */
            #mobile-island-mini {
                bottom: var(--island-bottom-margin);
                height: auto; 
                display: flex;
                flex-direction: column; 
            }
            
            /* --- State 1: Peek Island --- */
            #mobile-island-peek {
                bottom: var(--island-bottom-margin);
                height: auto; 
            }
            
            /* --- State 2: Expanded Island --- */
            #mobile-island-expanded {
                top: 280px; /* Sits below the top window */
                bottom: var(--island-bottom-margin);
                height: auto; /* Fills the space */
            }

            /* ====================================================================
            --- Route Summary Bar Styling (Mobile)
            ==================================================================== */
            
            /* This is now the unified handle */
            .route-summary-wrapper-mobile {
                flex-shrink: 0;
                overflow: hidden;
                border-top-left-radius: 16px;
                border-top-right-radius: 16px;
                
                /* Handle properties */
                cursor: grab;
                touch-action: none;
                user-select: none;
                position: relative;
                
                background: var(--hud-bg);
            }
            
            /* Add the pill visual */
            .route-summary-wrapper-mobile::before {
                content: '';
                position: absolute;
                left: 50%;
                transform: translateX(-50%);
                top: 8px; 
                width: 40px; 
                height: 4px; 
                background: var(--hud-border);
                border-radius: 2px; 
                opacity: 0.5;
            }
            
            /* Make the pill fainter on the mini-island */
            #mobile-island-mini .route-summary-wrapper-mobile::before {
                opacity: 0.3;
            }

            /* Override desktop styles for the route bar on mobile */
            .route-summary-wrapper-mobile .route-summary-overlay {
                position: relative; 
                margin-bottom: 0;
                background: var(--hud-bg);
                border-radius: 0;
                padding: 12px 15px 12px 15px; 
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
            /* Hide the progress bar fill on Mini and Peek islands */
            #mobile-island-mini .route-summary-wrapper-mobile .progress-bar-fill,
            #mobile-island-peek .route-summary-wrapper-mobile .progress-bar-fill {
                display: none;
            }
            /* Make progress bar bg fainter on Mini/Peek */
            #mobile-island-mini .route-summary-wrapper-mobile .route-progress-bar-container,
            #mobile-island-peek .route-summary-wrapper-mobile .route-progress-bar-container {
                 background: rgba(10, 12, 26, 0.4);
            }

            /* --- Drawer Content (Used in Peek & Expanded) --- */
            .drawer-content {
                overflow-y: auto;
                flex-grow: 1;
                padding-bottom: env(safe-area-inset-bottom, 0);
                height: var(--drawer-peek-content-height);
            }
            #mobile-island-peek .drawer-content {
                overflow: hidden;
            }
            #mobile-island-expanded .drawer-content {
                height: auto;
            }
            
            .drawer-content::-webkit-scrollbar { width: 6px; }
            .drawer-content::-webkit-scrollbar-track { background: transparent; }
            .drawer-content::-webkit-scrollbar-thumb { background-color: var(--hud-accent); border-radius: 10px; }


            /* ====================================================================
            --- [START] State 1: "Peek" Stacked Data Layout (Replaces PFD)
            ==================================================================== */
            
            /* Set padding on the content area itself */
            #mobile-island-peek .drawer-content {
                padding: 10px;
                box-sizing: border-box;
                height: var(--drawer-peek-content-height); /* 200px */
                display: flex; /* Use flex to control the child */
                flex-direction: column;
            }
            
            /* This is the container cloned from crew-center.js */
            #mobile-island-peek .unified-display-main-content {
                padding: 0 !important; /* Remove its internal padding */
                gap: 10px; /* Reduce the gap for peek view */
                height: 100%;
                overflow: hidden; /* Hide anything that overflows the 200px */
            }

            /* HIDE the PFD */
            #mobile-island-peek .pfd-main-panel {
                display: none !important;
            }
            
            /* HIDE the VSD card */
            #mobile-island-peek .ac-profile-card-new {
                display: none !important;
            }
            
            /* HIDE the VSD disclaimer */
            #mobile-island-peek .vsd-disclaimer {
                display: none !important;
            }
            
            /* HIDE the VSD panel (redundant, but safe) */
            #mobile-island-peek #vsd-panel {
                display: none !important;
            }

            /* SHOW the location panel (Currently Over) */
            #mobile-island-peek #location-data-panel {
                padding: 10px; /* Make padding smaller */
                flex-shrink: 0; /* Prevent shrinking */
                border-top-width: 0; /* Hide top border */
                background: rgba(10, 12, 26, 0.5) !important;
            }
            #mobile-island-peek #location-data-panel .data-value {
                font-size: 1.0rem; /* Make text a bit smaller */
                margin-top: 4px;
            }

            /* SHOW the flight data bar */
            #mobile-island-peek .flight-data-bar {
                padding: 10px; /* Make padding smaller */
                gap: 8px; /* Reduce gap */
                grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); /* Allow more items */
                flex-grow: 1; /* Allow it to fill remaining space */
                overflow: hidden;
                border-top-width: 0; /* Hide top border */
            }
            #mobile-island-peek .flight-data-bar .data-label {
                font-size: 0.6rem; /* Smaller label */
            }
            #mobile-island-peek .flight-data-bar .data-value {
                font-size: 1.1rem; /* Smaller value */
            }
            #mobile-island-peek .flight-data-bar .data-value .unit {
                font-size: 0.7rem; /* Smaller unit */
            }

            /* --- [END] State 1 --- */


            /* Hide stats button in Mini and Peek states */
            .pilot-stats-toggle-btn {
                display: none;
            }

            /* --- HUD Modules for Expanded View --- */
            .hud-module {
                background: rgba(10, 12, 26, 0.5);
                border-radius: 12px;
                padding: 16px;
                box-sizing: border-box;
            }

            /* --- State 2: "Expanded" Stacked Layout --- */
            /* This section now re-enables the PFD and VSD for the full view */
            #mobile-island-expanded .unified-display-main-content {
                display: flex !important;
                flex-direction: column;
                gap: 16px;
                height: auto;
                overflow: hidden; /* This is OK, drawer-content scrolls */
                padding: 16px;
            }
            #mobile-island-expanded .pfd-main-panel {
                display: flex !important; /* RE-SHOW PFD */
                margin: 0 auto !important;
                max-width: 400px !important;
            }
             #mobile-island-expanded .ac-profile-card-new {
                display: flex !important; /* RE-SHOW VSD */
            }
            #mobile-island-expanded .vsd-disclaimer {
                display: block !important; /* RE-SHOW VSD Disclaimer */
            }
            #mobile-island-expanded .live-data-panel {
                justify-content: space-around !important;
                background: rgba(10, 12, 26, 0.5) !important;
                border-radius: 12px !important;
                padding: 16px !important;
            }
            #mobile-island-expanded .live-data-item .data-label { font-size: 0.7rem; }
            #mobile-island-expanded .live-data-item .data-value { font-size: 1.5rem; }
            #mobile-island-expanded .live-data-item .data-value .unit { font-size: 0.8rem; }
            #mobile-island-expanded .live-data-item .data-value-ete { font-size: 1.7rem; }
            
            /* Show stats button ONLY when expanded (as a module) */
            #mobile-island-expanded .pilot-stats-toggle-btn {
                display: flex;
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
                margin-top: 16px;
            }


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
     */
    openWindow(windowElement) {
        if (!this.isMobile()) return;

        if (this.activeWindow) {
            this.closeActiveWindow(true); // 'true' = force close
        }

        if (windowElement.id === 'aircraft-info-window') {
            // --- Hide map controls ---
            const burgerMenu = document.getElementById('mobile-sidebar-toggle');
            const mapToolbar = document.getElementById('toolbar-toggle-panel-btn')?.parentElement;
            
            if (burgerMenu) burgerMenu.style.display = 'none';
            if (mapToolbar) mapToolbar.style.display = 'none';

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
     * Creates the new DOM structure for the HUD:
     * 1 Top Window + 3 Bottom Islands (Mini, Peek, Expanded).
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

        // 3. Bottom Island - State 0 (Mini)
        this.miniIslandEl = document.createElement('div');
        this.miniIslandEl.id = 'mobile-island-mini';
        this.miniIslandEl.className = 'mobile-island-bottom';
        this.miniIslandEl.innerHTML = `
            <div class="route-summary-wrapper-mobile"></div>
        `;
        viewContainer.appendChild(this.miniIslandEl);

        // 4. Bottom Island - State 1 (Peek)
        this.peekIslandEl = document.createElement('div');
        this.peekIslandEl.id = 'mobile-island-peek';
        this.peekIslandEl.className = 'mobile-island-bottom';
        this.peekIslandEl.innerHTML = `
            <div class="route-summary-wrapper-mobile"></div>
            <div class="drawer-content"></div>
        `;
        viewContainer.appendChild(this.peekIslandEl);
        
        // 5. Bottom Island - State 2 (Expanded)
        this.expandedIslandEl = document.createElement('div');
        this.expandedIslandEl.id = 'mobile-island-expanded';
        this.expandedIslandEl.className = 'mobile-island-bottom';
        this.expandedIslandEl.innerHTML = `
            <div class="route-summary-wrapper-mobile"></div>
            <div class="drawer-content"></div>
        `;
        viewContainer.appendChild(this.expandedIslandEl);
    },

    observeOriginalWindow(windowElement) {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        this.contentObserver = new MutationObserver((mutationsList, obs) => {
            const mainContent = windowElement.querySelector('.unified-display-main-content');
            
            const attitudeGroup = mainContent?.querySelector('#attitude_group');
            
            if (mainContent && attitudeGroup && attitudeGroup.dataset.initialized === 'true') {
                this.populateSplitView(windowElement);
                obs.disconnect();
                this.contentObserver = null;
            }
        });
        
        this.contentObserver.observe(windowElement, { 
            childList: true, 
            subtree: true,
            attributes: true
        });
    },

    /**
     * Moves content from the original window into the new island components.
     */
    populateSplitView(sourceWindow) {
        if (!this.topWindowEl || !this.miniIslandEl || !this.peekIslandEl || !this.expandedIslandEl) return;

        // Find content containers
        const miniRouteContainer = this.miniIslandEl.querySelector('.route-summary-wrapper-mobile');
        const peekRouteContainer = this.peekIslandEl.querySelector('.route-summary-wrapper-mobile');
        const expandedRouteContainer = this.expandedIslandEl.querySelector('.route-summary-wrapper-mobile');
        
        const peekContentContainer = this.peekIslandEl.querySelector('.drawer-content');
        const expandedContentContainer = this.expandedIslandEl.querySelector('.drawer-content');
        if (!peekContentContainer || !expandedContentContainer || !miniRouteContainer || !peekRouteContainer || !expandedRouteContainer) return;

        // Find original content pieces
        const topOverviewPanel = sourceWindow.querySelector('.aircraft-overview-panel');
        const routeSummaryBar = sourceWindow.querySelector('.route-summary-overlay');
        const mainFlightContent = sourceWindow.querySelector('.unified-display-main-content');
        
        // 1. Move Top Panel
        if (topOverviewPanel) {
            this.topWindowEl.appendChild(topOverviewPanel);
        }
        
        // 2. Clone and Move Route Summary Bar to ALL three islands
        if (routeSummaryBar) {
            const clonedRouteBar1 = routeSummaryBar.cloneNode(true);
            const clonedRouteBar2 = routeSummaryBar.cloneNode(true);
            const clonedRouteBar3 = routeSummaryBar.cloneNode(true);
            
            miniRouteContainer.appendChild(clonedRouteBar1);
            peekRouteContainer.appendChild(clonedRouteBar2);
            expandedRouteContainer.appendChild(clonedRouteBar3);
        }
        
        // 3. Clone and Move Main Content
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
     * Wires up all interactions to the new unified handle
     * (`.route-summary-wrapper-mobile`) in all three islands.
     */
    wireUpInteractions() {
        if (!this.miniIslandEl || !this.peekIslandEl || !this.expandedIslandEl) return;

        // Get the new unified handles
        const miniHandle = this.miniIslandEl.querySelector('.route-summary-wrapper-mobile');
        const peekHandle = this.peekIslandEl.querySelector('.route-summary-wrapper-mobile');
        const expandedHandle = this.expandedIslandEl.querySelector('.route-summary-wrapper-mobile');

        if (!miniHandle || !peekHandle || !expandedHandle) return;

        // --- Click Interactions ---
        
        // State 0 -> 1
        miniHandle.addEventListener('click', (e) => {
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
        miniHandle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        peekHandle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        expandedHandle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        
        // --- [FIX FOR STATE-SKIP BUG] ---
        // Only attach the *global* document listener ONCE.
        if (!this.documentListenersWired) {
            document.addEventListener('touchend', this.handleTouchEnd.bind(this));
            this.documentListenersWired = true;
        }
        // --- [END FIX] ---

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
     * Sets the drawer to a specific state (0, 1, or 2).
     */
    setDrawerState(targetState) {
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
     * Registers the start of a drag from the
     * unified handle `.route-summary-wrapper-mobile`.
     */
    handleTouchStart(e) {
        const handle = e.target.closest('.route-summary-wrapper-mobile');
        
        if (!handle) {
             this.swipeState.isDragging = false;
             return;
        }
        
        e.preventDefault();
        this.swipeState.isDragging = true;
        this.swipeState.touchStartY = e.touches[0].clientY;
    },

    /**
     * Handles the end of a swipe.
     */
    handleTouchEnd(e) {
        if (!this.swipeState.isDragging) return;
        
        setTimeout(() => {
            this.swipeState.isDragging = false;
            this.swipeState.touchStartY = 0;
        }, 50);

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
    },

    closeActiveWindow(force = false) {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        if (this.closeTimer) {
            clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }

        // [CRITICAL] Move content back and destroy clone
        if (this.activeWindow && this.topWindowEl && this.miniIslandEl && this.peekIslandEl && this.expandedIslandEl) {
            const topOverviewPanel = this.topWindowEl.querySelector('.aircraft-overview-panel');
            
            const mainFlightContent = this.expandedIslandEl.querySelector('.unified-display-main-content');
            const clonedFlightContent = this.peekIslandEl.querySelector('.unified-display-main-content');
            
            if (topOverviewPanel) {
                this.activeWindow.appendChild(topOverviewPanel);
            }

            if (mainFlightContent) {
                this.activeWindow.appendChild(mainFlightContent);
            }
            
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
            
            this.restoreMapControls();
            
            resetState();
        } else {
            if (overlayToRemove) overlayToRemove.classList.remove('visible');
            if (topWindowToRemove) topWindowToRemove.classList.remove('visible');
            if (miniIslandToRemove) miniIslandToRemove.classList.remove('island-active');
            if (peekIslandToRemove) peekIslandToRemove.classList.remove('island-active');
            if (expandedIslandToRemove) expandedIslandToRemove.classList.remove('island-active');

            this.closeTimer = setTimeout(() => {
                overlayToRemove?.remove();
                topWindowToRemove?.remove();
                miniIslandToRemove?.remove();
                peekIslandToRemove?.remove();
                expandedIslandToRemove?.remove();
                
                this.restoreMapControls();

                if (this.topWindowEl === topWindowToRemove) {
                    resetState();
                }
                
                this.closeTimer = null;
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