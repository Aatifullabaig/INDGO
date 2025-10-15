/**
 * MobileUIHandler Module (Floating Windows Redesign - v2)
 *
 * Rebuilds the aircraft info window into a split-view layout on mobile,
 * featuring a floating top window and an expandable bottom drawer with swipe gestures.
 *
 * Changes from v1:
 * - Added touch/swipe gestures to control the bottom drawer.
 * - Relocated the close button to the top window for better accessibility.
 * - Centralized configuration for easier maintenance.
 * - Improved state management and event listener cleanup.
 * - Added CSS for smoother swipe interactions (`touch-action`).
 */
const MobileUIHandler = {
    // --- CONFIGURATION ---
    CONFIG: {
        breakpoint: 992, // The max-width in pixels to trigger mobile view
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
        console.log("Mobile UI Handler (Floating Windows v2) Initialized.");
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

            /* --- Top Floating Window Styling --- */
            #mobile-aircraft-top-window {
                top: 15px;
                left: 15px;
                right: 15px;
                border-radius: 16px;
                transform: translateY(-200%); /* Start off-screen */
                padding-top: env(safe-area-inset-top, 0);
            }
            #mobile-aircraft-top-window.visible {
                transform: translateY(0);
            }
            #mobile-aircraft-top-window .aircraft-image-container {
                height: 140px;
                border-radius: 16px 16px 0 0;
                overflow: hidden;
            }
            #mobile-aircraft-top-window .flight-details-panel {
                border-radius: 16px;
            }
            /* [MODIFIED] Make the relocated close button look good */
            #mobile-aircraft-top-window .aircraft-window-close-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                z-index: 10;
                background: rgba(0,0,0,0.4);
                border-radius: 50%;
                width: 30px;
                height: 30px;
                line-height: 30px;
                text-align: center;
            }

            /* --- Bottom Drawer Styling --- */
            #mobile-aircraft-bottom-drawer {
                bottom: 0;
                left: 0;
                right: 0;
                height: 85vh; /* Set to max height */
                max-height: calc(100vh - 80px); /* Ensure it doesn't overlap top ui */
                border-radius: 20px 20px 0 0;
                transform: translateY(calc(85vh - 220px)); /* "Peek" state */
                transition-property: transform; /* Only transition transform */
                transition-duration: 0.45s;
                transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
                display: flex;
                flex-direction: column;
            }
            #mobile-aircraft-bottom-drawer.dragging {
                transition: none; /* Disable transition while dragging for instant feedback */
            }
            #mobile-aircraft-bottom-drawer.off-screen {
                transform: translateY(100%);
            }
             #mobile-aircraft-bottom-drawer.expanded {
                transform: translateY(0);
            }
            
            .drawer-handle-bar {
                width: 50px;
                height: 5px;
                background-color: rgba(255, 255, 255, 0.2);
                border-radius: 2.5px;
                margin: 8px auto 0 auto;
                flex-shrink: 0;
            }
            
            /* [MODIFIED] Add touch-action for better swipe control */
            #mobile-aircraft-bottom-drawer .unified-display-header {
                cursor: pointer;
                padding: 8px 16px;
                margin: 0;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                touch-action: none; /* Prevents page scroll while swiping drawer */
                user-select: none;
            }
            #mobile-aircraft-bottom-drawer .unified-display-main {
                overflow-y: auto;
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
        // Start off-screen before animating into peek view
        this.bottomDrawerEl.className = 'mobile-aircraft-view off-screen'; 
        this.bottomDrawerEl.innerHTML = `<div class="drawer-handle-bar"></div>`;
        viewContainer.appendChild(this.bottomDrawerEl);
    },

    /**
     * Uses a MutationObserver to wait for the original window to be populated.
     */
    observeOriginalWindow(windowElement) {
        if (this.contentObserver) this.contentObserver.disconnect();

        this.contentObserver = new MutationObserver((mutationsList, obs) => {
            if (windowElement.querySelector('.unified-display-container')) {
                this.populateSplitView(windowElement);
                obs.disconnect(); // Stop observing once content is found
                this.contentObserver = null;
            }
        });

        this.contentObserver.observe(windowElement, { childList: true, subtree: true });
    },

    /**
     * Moves content from the original window into the new mobile UI components.
     */
    populateSplitView(sourceWindow) {
        if (!this.topWindowEl || !this.bottomDrawerEl) return;

        const topContent = sourceWindow.querySelector('.image-and-route-wrapper');
        const bottomHeader = sourceWindow.querySelector('.unified-display-header');
        const bottomMain = sourceWindow.querySelector('.unified-display-main');
        // [NEW] Find the close button to move it
        const closeBtn = sourceWindow.querySelector('.aircraft-window-close-btn');

        if (topContent) {
            this.topWindowEl.appendChild(topContent);
            if (closeBtn) {
                 // [MODIFIED] Move the close button to the top window for visibility
                this.topWindowEl.appendChild(closeBtn);
            }
        }
        if (bottomHeader) this.bottomDrawerEl.appendChild(bottomHeader);
        if (bottomMain) this.bottomDrawerEl.appendChild(bottomMain);

        this.wireUpInteractions();
    },

    /**
     * Adds event listeners for all interactions.
     */
    wireUpInteractions() {
        if (!this.bottomDrawerEl || !this.topWindowEl) return;

        const drawerHeader = this.bottomDrawerEl.querySelector('.unified-display-header');
        const closeBtn = this.topWindowEl.querySelector('.aircraft-window-close-btn');

        // Click to toggle
        if (drawerHeader) {
            drawerHeader.addEventListener('click', () => this.toggleExpansion());
        }

        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', this.closeActiveWindow.bind(this), { once: true });
        }
        
        // [NEW] Swipe gesture listeners
        if (drawerHeader) {
            drawerHeader.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
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

    // --- [NEW] Swipe Gesture Handlers ---
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
        
        // Prevent dragging the drawer further down than its peek state
        let newY = Math.max(0, this.swipeState.drawerStartY + deltaY);
        this.bottomDrawerEl.style.transform = `translateY(${newY}px)`;
    },
    
    handleTouchEnd() {
        if (!this.swipeState.isDragging) return;

        this.swipeState.isDragging = false;
        this.bottomDrawerEl.classList.remove('dragging');
        this.bottomDrawerEl.style.transform = ''; // Clear inline style to allow CSS transitions

        const peekHeight = this.bottomDrawerEl.clientHeight - 220;
        const deltaY = this.swipeState.touchCurrentY - this.swipeState.touchStartY;

        // Swiped down significantly: Close everything
        if (deltaY > 150) {
            this.closeActiveWindow();
            return;
        }

        // Determine whether to snap open or closed
        if (deltaY < -50) { // Swiped up
            this.toggleExpansion(true);
        } else if (deltaY > 50) { // Swiped down
            this.toggleExpansion(false);
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
        
        if (this.overlayEl) {
            this.overlayEl.classList.remove('visible');
            setTimeout(() => this.overlayEl?.remove(), 500);
        }
        if (this.topWindowEl) {
            this.topWindowEl.classList.remove('visible');
            setTimeout(() => this.topWindowEl?.remove(), 500);
        }
        if (this.bottomDrawerEl) {
            // Use a specific class for the "out" animation
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