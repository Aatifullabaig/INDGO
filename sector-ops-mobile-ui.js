/**
 * MobileUIHandler Module (Floating Windows Redesign)
 * Rebuilds the aircraft info window into a split-view layout on mobile,
 * featuring a floating top window and an expandable bottom drawer, both
 * positioned over the map container for an integrated feel.
 */
const MobileUIHandler = {
    // --- STATE ---
    isMobile: () => window.innerWidth <= 992,
    activeWindow: null,        // The original, hidden .info-window element
    topWindowEl: null,         // The generated top window UI element
    bottomDrawerEl: null,      // The generated bottom drawer UI element
    contentObserver: null,     // The MutationObserver to watch for content population

    /**
     * Initializes the handler by injecting the necessary CSS.
     */
    init() {
        this.injectMobileStyles();
        console.log("Mobile UI Handler (Floating Windows) Initialized.");
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
                position: absolute; /* Changed from fixed to stay within the map view */
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
                position: absolute; /* Positioned relative to the map container */
                background: rgba(18, 20, 38, 0.8);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.1);
                z-index: 1045;
                transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
                will-change: transform;
                box-shadow: 0 10px 40px rgba(0,0,0,0.4);
            }

            /* --- [NEW] Top Floating Window Styling --- */
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
            /* Tweak content from original script to fit the window */
            #mobile-aircraft-top-window .aircraft-image-container {
                height: 140px;
                border-radius: 16px 16px 0 0; /* Match the new border radius */
                overflow: hidden;
            }
             #mobile-aircraft-top-window .flight-details-panel {
                border-radius: 16px; /* Match the new border radius */
            }

            /* --- [NEW] Bottom Drawer Styling --- */
            #mobile-aircraft-bottom-drawer {
                bottom: 0;
                left: 0;
                right: 0;
                height: 220px; /* Initial "peek" height */
                border-radius: 20px 20px 0 0;
                transform: translateY(200%); /* Start off-screen */
                transition-property: transform, height;
                transition-duration: 0.45s;
                transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
                display: flex;
                flex-direction: column;
            }
            #mobile-aircraft-bottom-drawer.visible {
                transform: translateY(0);
            }
            #mobile-aircraft-bottom-drawer.expanded {
                height: 85vh; /* Expanded height */
            }
            
            /* Visual handle for the drawer */
            .drawer-handle-bar {
                width: 50px;
                height: 5px;
                background-color: rgba(255, 255, 255, 0.2);
                border-radius: 2.5px;
                margin: 8px auto 0 auto;
                flex-shrink: 0;
            }

            /* Adapt original content for the drawer */
            #mobile-aircraft-bottom-drawer .unified-display-header {
                cursor: pointer;
                padding: 8px 16px;
                margin: 0;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            #mobile-aircraft-bottom-drawer .unified-display-main {
                overflow-y: auto; /* Allow scrolling when expanded */
            }
            
            /* --- Hide the original desktop window on mobile --- */
            @media (max-width: 992px) {
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
     * Intercepts the command to open the aircraft window to create the new split view.
     */
    openWindow(windowElement) {
        if (!this.isMobile() || this.activeWindow) return;

        if (windowElement.id === 'aircraft-info-window') {
            this.activeWindow = windowElement;
            this.createSplitViewUI();

            setTimeout(() => {
                if (this.topWindowEl) this.topWindowEl.classList.add('visible');
                if (this.bottomDrawerEl) this.bottomDrawerEl.classList.add('visible');
            }, 50);

            this.observeOriginalWindow(windowElement);
        }
    },

    /**
 * Animates out and removes all mobile UI components.
 * Can be immediate to prevent race conditions.
 * @param {boolean} immediate - If true, removes elements instantly without animation.
 */
closeActiveWindow(immediate = false) {
    if (this.contentObserver) this.contentObserver.disconnect();
    
    const overlay = document.getElementById('mobile-window-overlay');
    if (overlay) overlay.classList.remove('visible');

    const cleanup = (el) => {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    };

    if (immediate) {
        cleanup(this.topWindowEl);
        cleanup(this.bottomDrawerEl);
    } else {
        if (this.topWindowEl) {
            this.topWindowEl.classList.remove('visible');
            setTimeout(() => cleanup(this.topWindowEl), 500);
        }
        if (this.bottomDrawerEl) {
            this.bottomDrawerEl.classList.remove('visible');
            setTimeout(() => cleanup(this.bottomDrawerEl), 500);
        }
    }
    
    this.topWindowEl = null;
    this.bottomDrawerEl = null;
    this.activeWindow = null;
    this.contentObserver = null;
},

    /**
     * Uses a MutationObserver to wait for the original window to be populated with content.
     */
    observeOriginalWindow(windowElement) {
        if (this.contentObserver) this.contentObserver.disconnect();

        const observer = new MutationObserver((mutationsList, obs) => {
            if (windowElement.querySelector('.unified-display-container')) {
                this.populateSplitView(windowElement);
                obs.disconnect();
                this.contentObserver = null;
            }
        });

        observer.observe(windowElement, { childList: true, subtree: true });
        this.contentObserver = observer;
    },

    /**
     * Moves the populated content from the original hidden window into the new mobile UI components.
     */
    populateSplitView(sourceWindow) {
        if (!this.topWindowEl || !this.bottomDrawerEl) return;

        const topContent = sourceWindow.querySelector('.image-and-route-wrapper');
        const bottomHeader = sourceWindow.querySelector('.unified-display-header');
        const bottomMain = sourceWindow.querySelector('.unified-display-main');

        if (topContent) this.topWindowEl.appendChild(topContent);
        if (bottomHeader) this.bottomDrawerEl.appendChild(bottomHeader);
        if (bottomMain) this.bottomDrawerEl.appendChild(bottomMain);

        this.wireUpInteractions();
    },

    /**
     * Adds event listeners for expanding the drawer and closing the view.
     */
    wireUpInteractions() {
        if (!this.bottomDrawerEl) return;

        const drawerHeader = this.bottomDrawerEl.querySelector('.unified-display-header');
        const overlay = document.getElementById('mobile-window-overlay');

        const toggleExpansion = (e) => {
            if (e.target.closest('button')) return;
            this.bottomDrawerEl.classList.toggle('expanded');
            overlay.classList.toggle('visible', this.bottomDrawerEl.classList.contains('expanded'));
        };

        if (drawerHeader) {
            drawerHeader.addEventListener('click', toggleExpansion);
        }

        const closeBtn = this.bottomDrawerEl.querySelector('.aircraft-window-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeActiveWindow(true);
            }, { once: true });
        }
    },

    /**
     * Animates out and removes all mobile UI components.
     */
    closeActiveWindow() {
        if (this.contentObserver) this.contentObserver.disconnect();
        
        const overlay = document.getElementById('mobile-window-overlay');
        if (overlay) overlay.classList.remove('visible');

        if (this.topWindowEl) {
            this.topWindowEl.classList.remove('visible');
            setTimeout(() => this.topWindowEl.remove(), 500);
            this.topWindowEl = null;
        }
        if (this.bottomDrawerEl) {
            this.bottomDrawerEl.classList.remove('visible');
            setTimeout(() => this.bottomDrawerEl.remove(), 500);
            this.bottomDrawerEl = null;
        }
        
        this.activeWindow = null;
        this.contentObserver = null;
    }
};

/**
 * Initialize the Mobile UI Handler when the DOM is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
    MobileUIHandler.init();
    // Make the handler globally accessible so crew-center.js can call it
    window.MobileUIHandler = MobileUIHandler;
});