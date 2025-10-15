/**
 * MobileUIHandler Module (Creative HUD Rehaul - v3.3)
 *
 * This version reimagines the mobile aircraft info window with a modern,
 * cockpit-inspired "Heads-Up Display" (HUD) theme. It maintains the
 * top-window and bottom-drawer interaction model but enhances it with
 * a new aesthetic, a more intuitive layout for mobile, and improved
 * visual feedback.
 */
const MobileUIHandler = {
    // --- CONFIGURATION ---
    CONFIG: {
        breakpoint: 992, // The max-width in pixels to trigger mobile view
    },

    // --- STATE ---
    isMobile: () => window.innerWidth <= MobileUIHandler.CONFIG.breakpoint,
    activeWindow: null,
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
        console.log("Mobile UI Handler (HUD Rehaul v3.3) Initialized.");
    },

    /**
     * Injects all the CSS for the new HUD-themed floating windows.
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
                background: var(--hud-bg);
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
                top: 15px;
                left: 15px;
                right: 15px;
                border-radius: 16px;
                transform: translateY(-200%);
                padding-top: env(safe-area-inset-top, 0);
                overflow: hidden;
            }
            #mobile-aircraft-top-window.visible {
                transform: translateY(0);
            }
            #mobile-aircraft-top-window .aircraft-image-container {
                height: 140px;
            }
            #mobile-aircraft-top-window .aircraft-window-close-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                z-index: 10;
                background: rgba(0,0,0,0.5);
                border: 1px solid var(--hud-border);
                color: #FFF;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: grid;
                place-items: center;
            }

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
            }
            #mobile-aircraft-bottom-drawer.dragging { transition: none; }
            #mobile-aircraft-bottom-drawer.off-screen { transform: translateY(100%); }
            #mobile-aircraft-bottom-drawer.expanded { transform: translateY(0); }

            /* --- [NEW] Drawer Header / Handle --- */
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
            
            /* --- [NEW] Drawer Content Wrapper --- */
            .drawer-content {
                overflow-y: auto;
                flex-grow: 1;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            /* Custom Scrollbar for the drawer */
            .drawer-content::-webkit-scrollbar { width: 6px; }
            .drawer-content::-webkit-scrollbar-track { background: transparent; }
            .drawer-content::-webkit-scrollbar-thumb { background-color: var(--hud-accent); border-radius: 10px; }
            
            /* --- [RE-STYLED] Content from crew-center.js --- */
            .drawer-content .unified-display-header {
                /* This element is now removed via JS for a cleaner UI */
                display: none;
            }
            .drawer-content .unified-display-main {
                /* [MODIFIED] Now a 2-column grid to place PFD on left */
                display: grid;
                grid-template-columns: 1fr 120px; /* PFD takes space, side panel has fixed width */
                gap: 12px;
                padding: 0;
                order: 1; /* This will now be the first element */
            }
            .drawer-content .pfd-main-panel {
                /* PFD container. No specific width needed, it will take the grid column space. */
                min-width: 0; /* Important for flex/grid children */
            }
            .drawer-content .pfd-side-panel {
                /* [MODIFIED] From a grid to a single column flexbox for the right side */
                display: flex;
                flex-direction: column;
                justify-content: space-around; /* Distributes items nicely */
                gap: 12px;
            }
            .drawer-content .readout-box {
                background: rgba(0, 168, 255, 0.05);
                border: 1px solid var(--hud-border);
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
        if (!this.isMobile() || this.activeWindow) return;

        if (windowElement.id === 'aircraft-info-window') {
            this.activeWindow = windowElement;
            this.createSplitViewUI();

            setTimeout(() => {
                if (this.topWindowEl) this.topWindowEl.classList.add('visible');
                if (this.bottomDrawerEl) this.bottomDrawerEl.classList.remove('off-screen');
            }, 50);

            this.observeOriginalWindow(windowElement);
        }
    },

    /**
     * Creates the new DOM structure for the HUD.
     */
    createSplitViewUI() {
        this.closeActiveWindow();
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
        // [NEW] Create the drawer header and content container
        this.bottomDrawerEl.innerHTML = `
            <div class="drawer-header">
                <h4>
                    <i class="fa-solid fa-chevron-up chevron-icon"></i>
                    <span>Flight Deck</span>
                </h4>
            </div>
            <div class="drawer-content"></div>
        `;
        viewContainer.appendChild(this.bottomDrawerEl);
    },

    /**
     * Watches the original hidden window for when its content is ready.
     */
    observeOriginalWindow(windowElement) {
        if (this.contentObserver) this.contentObserver.disconnect();
        this.contentObserver = new MutationObserver((mutationsList, obs) => {
            if (windowElement.querySelector('.unified-display-container')) {
                this.populateSplitView(windowElement);
                obs.disconnect();
                this.contentObserver = null;
            }
        });
        this.contentObserver.observe(windowElement, { childList: true, subtree: true });
    },

    /**
     * Moves content from the original window into the new HUD components and
     * modifies text for mobile.
     */
    populateSplitView(sourceWindow) {
        if (!this.topWindowEl || !this.bottomDrawerEl) return;

        // Get references to new mobile containers
        const drawerContentContainer = this.bottomDrawerEl.querySelector('.drawer-content');

        // Find original content pieces
        const topContent = sourceWindow.querySelector('.image-and-route-wrapper');
        const pilotHeader = sourceWindow.querySelector('.unified-display-header');
        const flightDataMain = sourceWindow.querySelector('.unified-display-main');
        const closeBtn = sourceWindow.querySelector('.aircraft-window-close-btn');
        
        // Update the drawer header with dynamic flight info
        const drawerHeaderH4 = this.bottomDrawerEl.querySelector('.drawer-header h4');
        const drawerHeaderTextSpan = drawerHeaderH4?.querySelector('span');

        if (drawerHeaderTextSpan && pilotHeader) {
            const callsign = pilotHeader.querySelector('#header-flight-num')?.textContent.trim() || 'Flight';
            const username = pilotHeader.querySelector('.pilot-name-button')?.dataset.username || 'Pilot';
            drawerHeaderTextSpan.innerHTML = `${callsign} | ${username} <i class="fa-solid fa-user" style="opacity: 0.8;"></i>`;
        }
        
        // --- FIX: Clone nodes instead of moving them to prevent destroying the original window ---
        if (topContent) this.topWindowEl.appendChild(topContent.cloneNode(true));
        if (closeBtn) this.topWindowEl.appendChild(closeBtn.cloneNode(true));
        
        if (drawerContentContainer) {
            // REMOVED: No longer need the redundant header inside the drawer.
            if (flightDataMain) {
                const clonedFlightData = flightDataMain.cloneNode(true);
                drawerContentContainer.appendChild(clonedFlightData);
                
                // Modify text for a cleaner mobile view on the CLONED data
                const readoutLabels = clonedFlightData.querySelectorAll('.readout-box .label');
                readoutLabels.forEach(label => {
                    let text = label.textContent.trim();
                    if (text === 'Ground Speed') label.innerHTML = 'GSPD';
                    if (text === 'Vertical Speed') label.innerHTML = 'V/S';
                    if (text === 'Dist. to Dest.') label.innerHTML = 'DIST';
                    if (text === 'Aircraft Type') label.innerHTML = '<i class="fa-solid fa-plane-circle-check"></i> AIRCRAFT';
                });
            }
        }

        this.wireUpInteractions();
    },

    /**
     * Adds event listeners for all interactions (tap, swipe, close).
     */
    wireUpInteractions() {
        if (!this.bottomDrawerEl || !this.topWindowEl) return;

        const drawerHeader = this.bottomDrawerEl.querySelector('.drawer-header');
        // Important: Query the close button within the new mobile UI, not the original window
        const closeBtn = this.topWindowEl.querySelector('.aircraft-window-close-btn');

        if (drawerHeader) {
            drawerHeader.addEventListener('click', () => this.toggleExpansion());
            drawerHeader.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', this.closeActiveWindow.bind(this), { once: true });
        }
        
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
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
    handleTouchStart(e) {
        if (e.target.closest('button')) return;
        e.preventDefault();
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
        let newY = Math.max(0, this.swipeState.drawerStartY + deltaY);
        this.bottomDrawerEl.style.transform = `translateY(${newY}px)`;
    },
    
    handleTouchEnd() {
        if (!this.swipeState.isDragging) return;
        this.swipeState.isDragging = false;
        this.bottomDrawerEl.classList.remove('dragging');
        this.bottomDrawerEl.style.transform = '';

        const deltaY = this.swipeState.touchCurrentY - this.swipeState.touchStartY;

        if (deltaY > 150) { // Swiped down a lot, close everything
            this.closeActiveWindow();
            return;
        }
        
        // Snap open or closed based on swipe direction
        if (deltaY < -50) this.toggleExpansion(true); // Swiped up
        else if (deltaY > 50) this.toggleExpansion(false); // Swiped down
        
        this.swipeState = { ...this.swipeState, touchStartY: 0, touchCurrentY: 0 };
    },

    /**
     * Animates out and removes all mobile UI components.
     */
    closeActiveWindow() {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        if (this.overlayEl) {
            this.overlayEl.classList.remove('visible');
            setTimeout(() => this.overlayEl?.remove(), 500);
        }
        if (this.topWindowEl) {
            this.topWindowEl.classList.remove('visible');
            setTimeout(() => this.topWindowEl?.remove(), 500);
        }
        if (this.bottomDrawerEl) {
            this.bottomDrawerEl.classList.add('off-screen');
            this.bottomDrawerEl.classList.remove('expanded');
            setTimeout(() => this.bottomDrawerEl?.remove(), 500);
        }
        
        // Cleanup state
        this.activeWindow = null;
        this.contentObserver = null;
        this.topWindowEl = null;
        this.bottomDrawerEl = null;
        this.overlayEl = null;
    }
};

/**
 * Initialize the Mobile UI Handler when the DOM is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
    MobileUIHandler.init();
    window.MobileUIHandler = MobileUIHandler; // Make it globally accessible
});