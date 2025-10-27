/**
 * MobileUIHandler Module (Creative HUD Rehaul - v4.1 - Race Condition Fixed)
 *
 * This version is patched to be compatible with the new unified aircraft
 * info window from crew-center.js.
 *
 * It no longer clones DOM nodes. Instead, it "adopts" the real DOM elements
 * from the hidden desktop window (#aircraft-info-window) and moves them
 * into the mobile split-view containers. When closed, it moves them back.
 * This preserves all event listeners for the PFD, stats button, and back button.
 *
 * v4.1 FIX: Refactored `closeActiveWindow` to immediately set state to null,
 * preventing a race condition if a new window is opened before the
 * close animation completes.
 */
const MobileUIHandler = {
    // --- CONFIGURATION ---
    CONFIG: {
        breakpoint: 992, // The max-width in pixels to trigger mobile view
    },

    // --- STATE ---
    isMobile: () => window.innerWidth <= MobileUIHandler.CONFIG.breakpoint,
    activeWindow: null, // This will be the original #aircraft-info-window
    desktopContentWrapper: null, // The .info-window-content inside #aircraft-info-window
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
        console.log("Mobile UI Handler (v4.1) Initialized.");
    },

    /**
     * Injects all the CSS for the new HUD-themed floating windows.
     * This is now simplified to *only* style the mobile containers,
     * as crew-center.js already provides responsive styles for the content.
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
                top: env(safe-area-inset-top, 15px);
                left: 15px;
                right: 15px;
                border-radius: 16px;
                transform: translateY(-250%);
                overflow: hidden;
            }
            #mobile-aircraft-top-window.visible {
                transform: translateY(0);
            }
            /* The .aircraft-overview-panel will be moved inside this,
               and crew-center.js styles will handle its content. */

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
                /* Padding is now handled by .unified-display-main-content 
                  from crew-center.js, which is great.
                */
            }
            /* Custom Scrollbar for the drawer */
            .drawer-content::-webkit-scrollbar { width: 6px; }
            .drawer-content::-webkit-scrollbar-track { background: transparent; }
            .drawer-content::-webkit-scrollbar-thumb { background-color: var(--hud-accent); border-radius: 10px; }
            
            /* This is the only style we need to override from crew-center.js
              to ensure the stats panel fits the drawer height.
            */
            .drawer-content #pilot-stats-display {
                height: 100%;
            }

            /* --- Media query to hide desktop window --- */
            @media (max-width: ${this.CONFIG.breakpoint}px) {
                /* IMPORTANT: Hide the desktop window. 
                  Its content will be moved to the mobile UI.
                */
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
            // Store the original desktop window
            this.activeWindow = windowElement; 
            
            // Find the content wrapper that holds all the UI
            this.desktopContentWrapper = this.activeWindow.querySelector('.info-window-content');
            if (!this.desktopContentWrapper) {
                 console.error("MobileUI: Could not find .info-window-content to adopt.");
                 this.activeWindow = null;
                 return;
            }
            
            this.createSplitViewUI();

            setTimeout(() => {
                if (this.topWindowEl) this.topWindowEl.classList.add('visible');
                if (this.bottomDrawerEl) this.bottomDrawerEl.classList.remove('off-screen');
            }, 50);

            // Start observing for the new content
            this.observeOriginalWindow(this.desktopContentWrapper);
        }
    },

    /**
     * Creates the new DOM structure for the HUD.
     */
    createSplitViewUI() {
        this.closeActiveWindow(true); // Force close any existing UI
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
    observeOriginalWindow(contentWrapper) {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        // Check if content is already there
        if (contentWrapper.querySelector('.unified-display-main-content')) {
            this.populateSplitView(contentWrapper);
            return;
        }
        
        // If not, wait for it
        this.contentObserver = new MutationObserver((mutationsList, obs) => {
            if (contentWrapper.querySelector('.unified-display-main-content')) {
                this.populateSplitView(contentWrapper);
                obs.disconnect();
                this.contentObserver = null;
            }
        });
        this.contentObserver.observe(contentWrapper, { childList: true, subtree: true });
    },

    /**
     * MOVES content from the original window into the new HUD components.
     */
    populateSplitView(sourceContentWrapper) {
        if (!this.topWindowEl || !this.bottomDrawerEl) return;

        // Get references to new mobile containers
        const drawerContentContainer = this.bottomDrawerEl.querySelector('.drawer-content');

        // Find original content pieces
        const topContent = sourceContentWrapper.querySelector('.aircraft-overview-panel');
        const mainContent = sourceContentWrapper.querySelector('.unified-display-main-content');
        
        // Update the drawer header with dynamic flight info
        const drawerHeaderH4 = this.bottomDrawerEl.querySelector('.drawer-header h4');
        const drawerHeaderTextSpan = drawerHeaderH4?.querySelector('span');

        if (drawerHeaderTextSpan && topContent) {
            // Get data from the new structure
            const callsignEl = topContent.querySelector('#ac-header-callsign');
            const usernameEl = topContent.querySelector('#ac-header-username');
            
            const callsign = callsignEl ? callsignEl.textContent.trim() : 'Flight';
            const username = usernameEl ? usernameEl.textContent.trim() : 'Pilot';
            
            drawerHeaderTextSpan.innerHTML = `${callsign} | ${username} <i class="fa-solid fa-user" style="opacity: 0.8;"></i>`;
        }
        
        // --- THIS IS THE KEY CHANGE ---
        // We MOVE the elements, not clone them. This preserves event listeners.
        if (topContent) this.topWindowEl.appendChild(topContent);
        if (mainContent) drawerContentContainer.appendChild(mainContent);
        // --- END KEY CHANGE ---

        this.wireUpInteractions();
    },

    /**
     * Adds event listeners for all interactions (tap, swipe, close).
     */
    wireUpInteractions() {
        if (!this.bottomDrawerEl || !this.topWindowEl) return;

        const drawerHeader = this.bottomDrawerEl.querySelector('.drawer-header');
        
        // Find the close/hide buttons *inside* the top window where we moved them
        const closeBtn = this.topWindowEl.querySelector('.aircraft-window-close-btn');
        const hideBtn = this.topWindowEl.querySelector('.aircraft-window-hide-btn');

        if (drawerHeader) {
            drawerHeader.addEventListener('click', () => this.toggleExpansion());
            drawerHeader.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        }

        // Re-wire the close/hide buttons for mobile
        if (closeBtn) {
            closeBtn.addEventListener('click', this.handleMobileClose.bind(this));
        }
        if (hideBtn) {
            // On mobile, "hide" and "close" do the same thing.
            hideBtn.addEventListener('click', this.handleMobileClose.bind(this));
        }
        
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    },
    
    /**
     * New helper to handle mobile close/hide clicks.
     * It prevents the desktop listener from firing and calls the mobile close function.
     */
    handleMobileClose(e) {
        e.preventDefault();
        e.stopImmediatePropagation(); // Stop crew-center.js listener
        this.closeActiveWindow();
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
        // Allow scrolling inside the drawer content
        const drawerContent = this.bottomDrawerEl.querySelector('.drawer-content');
        if (drawerContent.contains(e.target) && drawerContent.scrollTop > 0) {
             this.swipeState.isDragging = false;
             return;
        }
        
        // Prevent drag on buttons
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
        let newY = Math.max(0, this.swipeState.drawerStartY + deltaY); // Don't let it go above the top
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
     * --- [FIXED v4.1] ---
     * Animates out, MOVES CONTENT BACK, and removes all mobile UI components.
     * Resets state immediately to prevent race conditions.
     * @param {boolean} [force=false] - If true, skips animation and just cleans up.
     */
    closeActiveWindow(force = false) {
        // [FIX] If there's no window, do nothing.
        if (!this.activeWindow) return;

        if (this.contentObserver) this.contentObserver.disconnect();

        // [FIX] Immediately set activeWindow to null to prevent race condition.
        // We store the elements we need to animate/remove in local vars.
        const overlay = this.overlayEl;
        const topWindow = this.topWindowEl;
        const bottomDrawer = this.bottomDrawerEl;
        const desktopWrapper = this.desktopContentWrapper;

        // [FIX] Reset state *immediately*.
        this.activeWindow = null;
        this.desktopContentWrapper = null;
        this.contentObserver = null;
        this.topWindowEl = null;
        this.bottomDrawerEl = null;
        this.overlayEl = null;

        // Find the content to move back
        const topContent = topWindow?.querySelector('.aircraft-overview-panel');
        const mainContent = bottomDrawer?.querySelector('.unified-display-main-content');
        
        // [FIX] Move content back *immediately*.
        if (desktopWrapper) {
            // We must check if elements exist before appending,
            // in case they were never populated.
            if (topContent) desktopWrapper.appendChild(topContent);
            if (mainContent) desktopWrapper.appendChild(mainContent);
        }

        // Now, define the cleanup function just for DOM removal.
        const cleanup = () => {
            overlay?.remove();
            topWindow?.remove();
            bottomDrawer?.remove();
        };

        if (force) {
            cleanup();
        } else {
            // Animate out
            if (overlay) overlay.classList.remove('visible');
            if (topWindow) topWindow.classList.remove('visible');
            if (bottomDrawer) {
                bottomDrawer.classList.add('off-screen');
                bottomDrawer.classList.remove('expanded');
            }
            // Remove from DOM after animation
            setTimeout(cleanup, 500);
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