/**
 * MobileUIHandler Module (Cockpit HUD Rehaul - v4)
 *
 * Implements a dynamic, two-stage mobile interface.
 * 1. Peek State: A compact, horizontal HUD with the PFD on the left and critical data on the right.
 * 2. Expanded State: A full-screen vertical layout that combines the aircraft image with all flight data.
 */
const MobileUIHandler = {
    // --- CONFIGURATION ---
    CONFIG: {
        breakpoint: 992,
    },

    // --- STATE ---
    isMobile: () => window.innerWidth <= MobileUIHandler.CONFIG.breakpoint,
    activeWindow: null,
    topWindowEl: null,
    bottomDrawerEl: null,
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
        console.log("Mobile UI Handler (Cockpit HUD v4) Initialized.");
    },

    /**
     * Injects all the CSS for the new HUD-themed floating windows.
     */
    injectMobileStyles() {
        const styleId = 'mobile-sector-ops-styles-v4';
        if (document.getElementById(styleId)) document.getElementById(styleId).remove();

        const css = `
            :root {
                --hud-bg: rgba(10, 15, 28, 0.85);
                --hud-blur: 15px;
                --hud-border: rgba(0, 168, 255, 0.3);
                --hud-accent: #00a8ff;
                --hud-glow: 0 0 15px rgba(0, 168, 255, 0.5);
                --drawer-peek-height: 260px; /* Adjusted for new layout */
            }

            @media (max-width: ${this.CONFIG.breakpoint}px) {
                /* --- Hide the desktop window when mobile UI is active --- */
                #aircraft-info-window { display: none !important; }

                /* --- Top Window (Route Progress + Close Button) --- */
                #mobile-aircraft-top-window {
                    position: absolute;
                    top: 15px; left: 15px; right: 15px;
                    z-index: 1045;
                    background: var(--hud-bg);
                    backdrop-filter: blur(var(--hud-blur));
                    border: 1px solid var(--hud-border);
                    border-radius: 16px;
                    padding: 8px;
                    transform: translateY(-200%);
                    transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s ease;
                    will-change: transform, opacity;
                    box-shadow: 0 5px 25px rgba(0,0,0,0.4);
                }
                #mobile-aircraft-top-window.visible { transform: translateY(0); }
                #mobile-aircraft-top-window.hidden-by-drawer {
                    opacity: 0;
                    transform: translateY(-200%);
                    pointer-events: none;
                }
                .mobile-top-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .mobile-top-content .flight-details-panel {
                    position: static;
                    background: none;
                    padding: 0;
                    flex-grow: 1;
                }
                .mobile-top-content .aircraft-window-close-btn {
                    background: rgba(0,0,0,0.5); border: 1px solid var(--hud-border);
                    color: #FFF; border-radius: 50%; width: 32px; height: 32px;
                    display: grid; place-items: center; flex-shrink: 0;
                }

                /* --- Bottom Drawer --- */
                #mobile-aircraft-bottom-drawer {
                    position: absolute;
                    bottom: 0; left: 0; right: 0;
                    height: calc(100vh - 60px); /* Leave space at the top */
                    background: var(--hud-bg);
                    backdrop-filter: blur(var(--hud-blur));
                    border: 1px solid var(--hud-border);
                    border-radius: 20px 20px 0 0;
                    z-index: 1040;
                    display: flex;
                    flex-direction: column;
                    transform: translateY(calc(100% - var(--drawer-peek-height))); /* Peek state */
                    transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
                    box-shadow: 0 -10px 40px rgba(0,0,0,0.5), var(--hud-glow);
                }
                #mobile-aircraft-bottom-drawer.dragging { transition: none; }
                #mobile-aircraft-bottom-drawer.off-screen { transform: translateY(100%); }
                #mobile-aircraft-bottom-drawer.expanded { transform: translateY(60px); }

                /* --- Drawer Header (Callsign, Username, Handle) --- */
                .drawer-header {
                    padding: 8px 16px;
                    text-align: center;
                    flex-shrink: 0;
                    cursor: grab;
                    touch-action: none;
                    user-select: none;
                    border-bottom: 1px solid var(--hud-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .drawer-header-info h4 { margin: 0; font-size: 1.2rem; color: #fff; }
                .drawer-header-info p { margin: 0; font-size: 0.8rem; color: #c5cae9; }
                .drawer-handle { width: 40px; height: 5px; background: var(--hud-border); border-radius: 3px; margin: 0 auto; }

                /* --- Main Drawer Content Area --- */
                .drawer-content-wrapper {
                    overflow-y: auto;
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                }
                
                /* --- Aircraft Image (Visible only when expanded) --- */
                .drawer-aircraft-image-container {
                    display: none; /* Hidden in peek state */
                    width: 100%;
                    height: 180px;
                    background-color: rgba(0,0,0,0.3);
                }
                #mobile-aircraft-bottom-drawer.expanded .drawer-aircraft-image-container {
                    display: block; /* Shown in expanded state */
                }
                .drawer-aircraft-image-container img { width: 100%; height: 100%; object-fit: cover; }

                /* --- Main Data Grid (Changes based on state) --- */
                .drawer-main-content {
                    padding: 12px;
                    flex-grow: 1;
                    min-height: 0;
                    /* PEEK STATE: Horizontal Grid */
                    display: grid;
                    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); /* 2/3 for PFD, 1/3 for data */
                    gap: 12px;
                    align-items: stretch;
                }
                /* EXPANDED STATE: Vertical Flexbox */
                #mobile-aircraft-bottom-drawer.expanded .drawer-main-content {
                    display: flex;
                    flex-direction: column;
                }
                #pfd-container-mobile, #drawer-right-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                #pfd-container-mobile .readout-box { flex-shrink: 0; }
                #drawer-right-panel .readout-box {
                    flex-grow: 1; display: flex; flex-direction: column; justify-content: center;
                    background: rgba(0, 168, 255, 0.05); border: 1px solid var(--hud-border);
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
        this.activeWindow = windowElement;
        this.createSplitViewUI();
        this.observeOriginalWindow(windowElement);
    },

    /**
     * Creates the new DOM structure for the HUD.
     */
    createSplitViewUI() {
        this.closeActiveWindow(); // Clean up any previous instances
        const viewContainer = document.getElementById('view-rosters');
        if (!viewContainer) return;

        // Top window for route progress and close button
        this.topWindowEl = document.createElement('div');
        this.topWindowEl.id = 'mobile-aircraft-top-window';
        this.topWindowEl.innerHTML = `<div class="mobile-top-content"></div>`;
        viewContainer.appendChild(this.topWindowEl);

        // Main bottom drawer
        this.bottomDrawerEl = document.createElement('div');
        this.bottomDrawerEl.id = 'mobile-aircraft-bottom-drawer';
        this.bottomDrawerEl.className = 'off-screen';
        this.bottomDrawerEl.innerHTML = `
            <div class="drawer-header">
                <div class="drawer-header-info">
                    <h4 id="mobile-header-callsign">--</h4>
                    <p id="mobile-header-username">--</p>
                </div>
                <div class="drawer-handle-area">
                    <div class="drawer-handle"></div>
                </div>
            </div>
            <div class="drawer-content-wrapper">
                <div class="drawer-aircraft-image-container"></div>
                <div class="drawer-main-content">
                    <div id="pfd-container-mobile"></div>
                    <div id="drawer-right-panel"></div>
                </div>
            </div>
        `;
        viewContainer.appendChild(this.bottomDrawerEl);

        // Animate in
        setTimeout(() => {
            if (this.topWindowEl) this.topWindowEl.classList.add('visible');
            if (this.bottomDrawerEl) this.bottomDrawerEl.classList.remove('off-screen');
        }, 50);
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
     * Moves content from the original window into the new HUD components.
     */
    populateSplitView(sourceWindow) {
        if (!this.topWindowEl || !this.bottomDrawerEl) return;

        // --- Get container references ---
        const topContentContainer = this.topWindowEl.querySelector('.mobile-top-content');
        const headerCallsign = this.bottomDrawerEl.querySelector('#mobile-header-callsign');
        const headerUsername = this.bottomDrawerEl.querySelector('#mobile-header-username');
        const drawerImageContainer = this.bottomDrawerEl.querySelector('.drawer-aircraft-image-container');
        const pfdMobileContainer = this.bottomDrawerEl.querySelector('#pfd-container-mobile');
        const rightPanelContainer = this.bottomDrawerEl.querySelector('#drawer-right-panel');

        // --- Get source content ---
        const routePanel = sourceWindow.querySelector('.flight-details-panel');
        const closeBtn = sourceWindow.querySelector('.aircraft-window-close-btn');
        const callsign = sourceWindow.querySelector('#header-flight-num')?.textContent;
        const username = sourceWindow.querySelector('.pilot-name-button')?.textContent.trim();
        const aircraftImage = sourceWindow.querySelector('.aircraft-image-container');
        const pfd = sourceWindow.querySelector('#pfd-container');
        const aircraftTypeBox = sourceWindow.querySelector('#aircraft-type-readout');
        const sideReadouts = sourceWindow.querySelectorAll('.pfd-side-panel .readout-box');

        // --- Populate Top Window ---
        if (routePanel) topContentContainer.appendChild(routePanel);
        if (closeBtn) topContentContainer.appendChild(closeBtn);

        // --- Populate Drawer Header ---
        if (headerCallsign && callsign) headerCallsign.textContent = callsign;
        if (headerUsername && username) headerUsername.textContent = username;

        // --- Populate Drawer Content ---
        if (drawerImageContainer && aircraftImage) drawerImageContainer.appendChild(aircraftImage);
        if (pfdMobileContainer && pfd) pfdMobileContainer.appendChild(pfd);
        if (rightPanelContainer) {
            if (aircraftTypeBox) rightPanelContainer.appendChild(aircraftTypeBox);
            sideReadouts.forEach(box => {
                if (box.id !== 'aircraft-type-readout') {
                    rightPanelContainer.appendChild(box.cloneNode(true));
                }
            });
        }

        this.wireUpInteractions();
    },

    /**
     * Adds event listeners for all interactions (tap, swipe, close).
     */
    wireUpInteractions() {
        if (!this.bottomDrawerEl || !this.topWindowEl) return;

        const drawerHeader = this.bottomDrawerEl.querySelector('.drawer-header');
        const closeBtn = this.topWindowEl.querySelector('.aircraft-window-close-btn');

        if (drawerHeader) {
            drawerHeader.addEventListener('click', () => this.toggleExpansion());
            drawerHeader.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
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
        if (this.topWindowEl) this.topWindowEl.classList.toggle('hidden-by-drawer', shouldExpand);
    },

    // --- Swipe Gesture Handlers (Optimized) ---
    handleTouchStart(e) {
        if (e.target.closest('button')) return;
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
        // Constrain movement between fully open and fully closed (peek state)
        let newY = this.swipeState.drawerStartY + deltaY;
        const peekY = window.innerHeight - this.CONFIG.drawerPeekHeight;
        const expandedY = 60;
        newY = Math.max(expandedY, Math.min(peekY, newY)); // Clamp the value
        this.bottomDrawerEl.style.transform = `translateY(${newY}px)`;
    },
    
    handleTouchEnd() {
        if (!this.swipeState.isDragging) return;
        this.swipeState.isDragging = false;
        this.bottomDrawerEl.classList.remove('dragging');
        this.bottomDrawerEl.style.transform = ''; // Let CSS take over

        const deltaY = this.swipeState.touchCurrentY - this.swipeState.touchStartY;

        // Snap open or closed based on swipe direction and velocity
        if (deltaY < -50) this.toggleExpansion(true); // Swiped up
        else if (deltaY > 50) this.toggleExpansion(false); // Swiped down
        else { // Not a big swipe, snap to nearest state
            const currentPos = this.bottomDrawerEl.getBoundingClientRect().top;
            const halfway = window.innerHeight / 2;
            this.toggleExpansion(currentPos < halfway);
        }
        
        this.swipeState = { ...this.swipeState, touchStartY: 0, touchCurrentY: 0 };
    },

    /**
     * Animates out and removes all mobile UI components.
     */
    closeActiveWindow() {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        if (this.topWindowEl) {
            this.topWindowEl.classList.remove('visible');
            setTimeout(() => this.topWindowEl?.remove(), 500);
        }
        if (this.bottomDrawerEl) {
            this.bottomDrawerEl.classList.add('off-screen');
            setTimeout(() => this.bottomDrawerEl?.remove(), 500);
        }
        
        this.activeWindow = null;
        this.contentObserver = null;
        this.topWindowEl = null;
        this.bottomDrawerEl = null;
    }
};

/**
 * Initialize the Mobile UI Handler when the DOM is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
    MobileUIHandler.init();
    window.MobileUIHandler = MobileUIHandler; // Make it globally accessible
});