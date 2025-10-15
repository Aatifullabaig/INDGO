/**
 * MobileUIHandler Module (Floating Windows Redesign - v3)
 *
 * Rebuilds the aircraft info window into a split-view layout on mobile. This version
 * refines the content distribution for a more intuitive mobile experience.
 *
 * Changes from v2:
 * - Redesigned content layout: The top window now contains the full header
 * (flight #, pilot) and the image/route wrapper for a complete summary view.
 * - The bottom drawer is now dedicated to the PFD and detailed flight data.
 * - Created a dedicated, non-content handle for the bottom drawer to improve
 * usability and prevent accidental interactions with content.
 * - Refined CSS for the new layout, improving peek/expanded state calculations.
 */
const MobileUIHandler = {
    // --- CONFIGURATION ---
    CONFIG: {
        breakpoint: 992, // The max-width in pixels to trigger mobile view
        PEEK_HEIGHT: 160,  // The height of the drawer in its collapsed/peek state
    },

    // --- STATE ---
    isMobile: () => window.innerWidth <= MobileUIHandler.CONFIG.breakpoint,
    activeWindow: null,        // The original, hidden .info-window element
    topWindowEl: null,         // The generated top window UI element
    bottomDrawerEl: null,      // The generated bottom drawer UI element
    overlayEl: null,           // The background overlay element
    contentObserver: null,     // The MutationObserver to watch for content population

    // --- Swipe Gesture State ---
    swipeState: {
        touchStartY: 0,
        touchCurrentY: 0,
        drawerStartY: 0,
        isDragging: false,
    },

    /**
     * Initializes the handler by injecting the necessary CSS.
     */
    init() {
        this.injectMobileStyles();
        console.log("Mobile UI Handler (Floating Windows v3) Initialized.");
    },

    /**
     * Injects all the CSS required for the floating windows and overlay.
     */
    injectMobileStyles() {
        const styleId = 'mobile-sector-ops-styles';
        if (document.getElementById(styleId)) return;

        const css = `
            /* --- This ensures our absolute positioning works relative to the screen --- */
            #view-rosters.active {
                position: relative;
                overflow: hidden;
            }

            /* --- Overlay for the expanded drawer --- */
            #mobile-window-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                z-index: 1040;
                opacity: 0;
                transition: opacity 0.4s ease;
                pointer-events: none;
            }
            #mobile-window-overlay.visible { opacity: 1; pointer-events: auto; }

            /* --- Base styles for new floating components --- */
            .mobile-aircraft-view {
                position: absolute;
                background: rgba(18, 20, 38, 0.8);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.1);
                z-index: 1045;
                transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
                will-change: transform;
                box-shadow: 0 10px 40px rgba(0,0,0,0.4);
            }

            /* --- [REDESIGNED] Top Floating Window Styling --- */
            #mobile-aircraft-top-window {
                top: 15px;
                left: 15px;
                right: 15px;
                border-radius: 16px;
                transform: translateY(-200%); /* Start off-screen */
                padding-top: env(safe-area-inset-top, 0);
                overflow: hidden; /* Ensures children conform to rounded corners */
            }
            #mobile-aircraft-top-window.visible {
                transform: translateY(0);
            }
            /* Adjustments for content moved into the top window */
            #mobile-aircraft-top-window .unified-display-header {
                margin: 0;
                border-radius: 0;
                border-width: 0 0 1px 0; /* Only keep the bottom border */
                box-shadow: none;
            }
            #mobile-aircraft-top-window .image-and-route-wrapper {
                border-bottom: none; /* No border needed inside this container */
            }

            /* --- [REDESIGNED] Bottom Drawer Styling --- */
            #mobile-aircraft-bottom-drawer {
                bottom: 0;
                left: 0;
                right: 0;
                height: calc(100vh - 90px - env(safe-area-inset-top, 0px)); /* Max height, leaves room for top bar */
                max-height: 750px; /* Don't be excessively tall on large phones */
                border-radius: 20px 20px 0 0;
                transform: translateY(calc(100% - ${this.CONFIG.PEEK_HEIGHT}px - env(safe-area-inset-bottom, 0px))); /* "Peek" state */
                transition-property: transform;
                transition-duration: 0.45s;
                transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
                display: flex;
                flex-direction: column;
            }
            #mobile-aircraft-bottom-drawer.dragging {
                transition: none; /* Disable transition while dragging for instant feedback */
            }
            #mobile-aircraft-bottom-drawer.expanded {
                transform: translateY(0);
            }
            #mobile-aircraft-bottom-drawer.off-screen {
                transform: translateY(100%);
            }
            
            /* [NEW] Drawer Handle Area */
            .mobile-drawer-handle {
                padding: 4px 16px 12px 16px;
                cursor: pointer;
                touch-action: none;
                user-select: none;
                flex-shrink: 0;
            }
            .drawer-handle-bar {
                width: 50px;
                height: 5px;
                background-color: rgba(255, 255, 255, 0.2);
                border-radius: 2.5px;
                margin: 0 auto;
            }
            
            #mobile-aircraft-bottom-drawer .unified-display-main {
                overflow-y: auto;
                flex-grow: 1;
                /* Padding is already on the element from crew-center.js */
            }
            
            /* --- Hide the original desktop window on mobile --- */
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
     * Intercepts the command to open the aircraft window.
     */
    openWindow(windowElement) {
        if (!this.isMobile() || this.activeWindow) return;

        if (windowElement.id === 'aircraft-info-window') {
            this.activeWindow = windowElement;
            this.createSplitViewUI();

            // Animate in
            setTimeout(() => {
                if (this.topWindowEl) this.topWindowEl.classList.add('visible');
                if (this.bottomDrawerEl) this.bottomDrawerEl.classList.remove('off-screen');
            }, 50);

            this.observeOriginalWindow(windowElement);
        }
    },

    /**
     * Creates the empty DOM elements for the floating windows and overlay.
     */
    createSplitViewUI() {
        this.closeActiveWindow(); // Ensure any old elements are removed first

        const viewContainer = document.getElementById('view-rosters');
        if (!viewContainer) return;

        // Create and store the overlay
        this.overlayEl = document.createElement('div');
        this.overlayEl.id = 'mobile-window-overlay';
        viewContainer.appendChild(this.overlayEl);
        this.overlayEl.addEventListener('click', () => this.toggleExpansion(false));

        // Create top window
        this.topWindowEl = document.createElement('div');
        this.topWindowEl.id = 'mobile-aircraft-top-window';
        this.topWindowEl.className = 'mobile-aircraft-view';
        viewContainer.appendChild(this.topWindowEl);

        // Create bottom drawer
        this.bottomDrawerEl = document.createElement('div');
        this.bottomDrawerEl.id = 'mobile-aircraft-bottom-drawer';
        this.bottomDrawerEl.className = 'mobile-aircraft-view off-screen'; 
        // [MODIFIED] Create a dedicated handle area
        this.bottomDrawerEl.innerHTML = `
            <div class="mobile-drawer-handle">
                <div class="drawer-handle-bar"></div>
            </div>`;
        viewContainer.appendChild(this.bottomDrawerEl);
    },

    /**
     * Uses a MutationObserver to wait for the original window to be populated.
     */
    observeOriginalWindow(windowElement) {
        if (this.contentObserver) this.contentObserver.disconnect();

        this.contentObserver = new MutationObserver((mutationsList, obs) => {
            // Check for the main content block which contains the PFD
            if (windowElement.querySelector('.unified-display-main')) {
                this.populateSplitView(windowElement);
                obs.disconnect(); // Stop observing once content is found
                this.contentObserver = null;
            }
        });

        this.contentObserver.observe(windowElement, { childList: true, subtree: true });
    },

    /**
     * [REDESIGNED] Moves content from the original window into the new mobile UI components.
     */
    populateSplitView(sourceWindow) {
        if (!this.topWindowEl || !this.bottomDrawerEl) return;

        const header = sourceWindow.querySelector('.unified-display-header');
        const imageWrapper = sourceWindow.querySelector('.image-and-route-wrapper');
        const mainContent = sourceWindow.querySelector('.unified-display-main');

        // Move the complete summary (header + image) to the top window
        if (header) this.topWindowEl.appendChild(header);
        if (imageWrapper) this.topWindowEl.appendChild(imageWrapper);
        
        // Move the PFD and side panels into the bottom drawer
        if (mainContent) this.bottomDrawerEl.appendChild(mainContent);

        this.wireUpInteractions();
    },

    /**
     * [MODIFIED] Adds event listeners for all interactions using the new layout.
     */
    wireUpInteractions() {
        if (!this.bottomDrawerEl || !this.topWindowEl) return;

        const handle = this.bottomDrawerEl.querySelector('.mobile-drawer-handle');
        const header = this.topWindowEl.querySelector('.unified-display-header');

        if (header) {
            const closeBtn = header.querySelector('.aircraft-window-close-btn');
            const hideBtn = header.querySelector('.aircraft-window-hide-btn');

            if (closeBtn) {
                 closeBtn.addEventListener('click', this.closeActiveWindow.bind(this));
            }
             // On mobile, the "hide" button will also close the window for simplicity
            if (hideBtn) {
                 hideBtn.addEventListener('click', this.closeActiveWindow.bind(this));
            }
        }
        
        // All drawer interactions are now on the dedicated handle
        if (handle) {
            handle.addEventListener('click', () => this.toggleExpansion());
            handle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
            document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
            document.addEventListener('touchend', this.handleTouchEnd.bind(this));
        }
    },
    
    /**
     * Toggles the drawer between its expanded and peek states.
     * @param {boolean|undefined} force - `true` to expand, `false` to collapse.
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
        this.swipeState.drawerStartY = currentTransform.m42; // The 'y' translation value
        
        this.bottomDrawerEl.classList.add('dragging');
    },

    handleTouchMove(e) {
        if (!this.swipeState.isDragging) return;
        e.preventDefault();

        this.swipeState.touchCurrentY = e.touches[0].clientY;
        let deltaY = this.swipeState.touchCurrentY - this.swipeState.touchStartY;
        
        // Prevent dragging the drawer above the top of the screen
        let newY = Math.max(0, this.swipeState.drawerStartY + deltaY);
        this.bottomDrawerEl.style.transform = `translateY(${newY}px)`;
    },
    
    handleTouchEnd() {
        if (!this.swipeState.isDragging) return;

        this.swipeState.isDragging = false;
        this.bottomDrawerEl.classList.remove('dragging');
        this.bottomDrawerEl.style.transform = ''; // Clear inline style to allow CSS transitions

        const deltaY = this.swipeState.touchCurrentY - this.swipeState.touchStartY;

        // Swiped down significantly: Close everything
        if (deltaY > 150) {
            this.closeActiveWindow();
            return;
        }

        // Determine whether to snap open or closed based on swipe direction
        if (deltaY < -50) { // Swiped up
            this.toggleExpansion(true);
        } else if (deltaY > 50) { // Swiped down
            this.toggleExpansion(false);
        } else {
            // If it wasn't a clear swipe, snap to the closer state based on final position
            const drawerTop = this.bottomDrawerEl.getBoundingClientRect().top;
            const halfwayPoint = window.innerHeight / 2;
            this.toggleExpansion(drawerTop < halfwayPoint);
        }
        
        // Reset state
        this.swipeState.touchStartY = 0;
        this.swipeState.touchCurrentY = 0;
    },

    /**
     * Animates out and removes all mobile UI components.
     */
    closeActiveWindow() {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        // Unbind document-level swipe listeners to prevent issues
        document.removeEventListener('touchmove', this.handleTouchMove.bind(this));
        document.removeEventListener('touchend', this.handleTouchEnd.bind(this));

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
        
        // Cleanup
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
    // Make the handler globally accessible so other scripts can call it
    window.MobileUIHandler = MobileUIHandler;
});