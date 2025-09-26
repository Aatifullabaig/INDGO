// debugger.js
(function() {
    // Prevents the script from running twice
    if (window.globalDebugger) {
        return;
    }

    let DEBUG_ENABLED = true; // Can be toggled from the console with window.toggleGlobalDebugger()

    /**
     * Creates and injects the debugger UI into the page.
     */
    function mountDebuggerUI() {
        if (document.getElementById('global-debug-toggle')) return;

        // Create the main toggle button
        const btn = document.createElement('button');
        btn.id = 'global-debug-toggle';
        btn.innerHTML = '🧪 Roster Debug';
        Object.assign(btn.style, {
            position: 'fixed', right: '14px', bottom: '14px', zIndex: 10000,
            padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
            background: '#001B94', color: '#fff', cursor: 'pointer',
            boxShadow: '0 5px 20px rgba(0,0,0,0.35)',
            fontFamily: 'sans-serif', fontSize: '14px', fontWeight: 'bold'
        });

        // Create the panel to show logs
        const panel = document.createElement('div');
        panel.id = 'global-debug-panel';
        Object.assign(panel.style, {
            position: 'fixed', right: '14px', bottom: '64px', width: '450px',
            maxWidth: '90vw', maxHeight: '60vh', overflow: 'auto',
            background: 'rgba(10, 12, 22, 0.97)', backdropFilter: 'blur(5px)',
            color: '#e8ecff', borderRadius: '12px', padding: '10px',
            display: 'none', zIndex: 99999,
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '12px'
        });

        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1)">
                <strong>Main Debug Logs</strong>
                <div>
                    <button id="global-debug-clear" style="margin-right:8px; padding: 4px 8px;">Clear</button>
                    <button id="global-debug-close" style="padding: 4px 8px;">Close</button>
                </div>
            </div>
            <div id="global-debug-body" style="line-height:1.4"></div>
        `;

        document.body.appendChild(btn);
        document.body.appendChild(panel);

        const dbgBody = panel.querySelector('#global-debug-body');

        // Function to add a new log entry to the panel
        const addLog = (html) => {
            const row = document.createElement('div');
            row.className = 'debug-log-row';
            row.innerHTML = html;
            row.style.padding = '8px 4px';
            row.style.borderBottom = '1px dashed rgba(255,255,255,0.15)';
            dbgBody.prepend(row);
        };

        // --- MODIFICATION: Use event delegation for "Details" buttons ---
        dbgBody.addEventListener('click', (e) => {
            if (e.target.matches('.debug-details-toggle')) {
                const button = e.target;
                const detailsPanel = button.closest('.debug-log-row').querySelector('.debug-details-panel');
                if (detailsPanel) {
                    const isHidden = detailsPanel.style.display === 'none';
                    detailsPanel.style.display = isHidden ? 'block' : 'none';
                    button.textContent = isHidden ? 'Hide' : 'Details';
                }
            }
        });

        // Event listeners for the UI controls
        btn.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
        panel.querySelector('#global-debug-close').onclick = () => { panel.style.display = 'none'; };
        panel.querySelector('#global-debug-clear').onclick = () => { dbgBody.innerHTML = ''; };

        // Expose the logging function globally
        window.__globalDebugLog = addLog;
        window.toggleGlobalDebugger = () => { DEBUG_ENABLED = !DEBUG_ENABLED; console.log(`Global Debugger ${DEBUG_ENABLED ? 'ON' : 'OFF'}`); };
    }

    /**
     * A helper function to format log entries for display.
     * MODIFICATION: Now creates an expandable details section.
     */
    function createLogEntry(kind, data) {
        if (!DEBUG_ENABLED || !window.__globalDebugLog) return;
        
        const ts = new Date().toLocaleTimeString();
        let color = '#FFF';
        let icon = '➡️';
        
        switch (kind) {
            case 'REQUEST': color = '#00A8FF'; break;
            case 'RESPONSE': color = data.ok ? '#28a745' : '#dc3545'; icon = data.ok ? '✅' : '❌'; break;
            case 'ERROR': color = '#ffc107'; icon = '⚠️'; break;
        }

        const safeHtml = (str) => String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const urlParts = new URL(data.url, window.location.origin);
        
        // --- MODIFICATION: Function to pretty-print objects (headers, body) ---
        const formatObjectForDisplay = (obj) => {
            if (obj === undefined || obj === null) return 'Not available.';
            const content = typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj);
            return `<pre style="background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px; white-space: pre-wrap; word-break: break-all; margin: 0;"><code>${safeHtml(content)}</code></pre>`;
        };

        const hasDetails = data.details.headers || data.details.body;

        const logHtml = `
            <div style="display: flex; align-items: flex-start; gap: 8px;">
                <strong style="color: ${color}; font-size: 16px;">${icon}</strong>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color: ${color};">${safeHtml(kind)}</strong>
                        <span style="opacity:0.7;">${ts}</span>
                    </div>
                    <div style="font-weight: bold; margin: 2px 0;">
                        <span style="opacity: 0.8;">${data.method || 'GET'}</span> ${safeHtml(urlParts.pathname)}
                    </div>
                    <div style="opacity: 0.9; margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
                         <span>${data.summary}</span>
                         ${hasDetails ? '<button class="debug-details-toggle" style="padding: 2px 6px; font-size: 10px; cursor: pointer;">Details</button>' : ''}
                    </div>
                     ${hasDetails ? `
                        <div class="debug-details-panel" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                            ${data.details.headers ? `<strong>Headers:</strong> ${formatObjectForDisplay(data.details.headers)}` : ''}
                            ${data.details.body ? `<strong style="display: block; margin-top: 5px;">Body:</strong> ${formatObjectForDisplay(data.details.body)}` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>`;
        window.__globalDebugLog(logHtml);
    }
    
    // --- The Core Logic: Monkey-Patching Fetch (Now more robust) ---

    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
        if (!DEBUG_ENABLED) {
            return originalFetch.apply(this, args);
        }

        const [url, config] = args;
        const method = config?.method || 'GET';

        // --- MODIFICATION: Capture request headers and body ---
        let requestDetails = {};
        try {
            requestDetails.headers = config?.headers ? Object.fromEntries(new Headers(config.headers).entries()) : undefined;
            if (config?.body) {
                if (typeof config.body === 'string') {
                    try {
                        requestDetails.body = JSON.parse(config.body); // Attempt to parse if it's a JSON string
                    } catch (e) {
                        requestDetails.body = config.body; // Fallback to raw string
                    }
                } else if (config.body instanceof FormData) {
                    requestDetails.body = 'FormData object (not displayed)';
                } else {
                    requestDetails.body = 'Request body of unknown type';
                }
            }
        } catch (e) {
            console.error('Debugger error capturing request body:', e);
        }

        createLogEntry('REQUEST', { url, method, summary: 'Initiating call...', details: requestDetails });

        try {
            const response = await originalFetch.apply(this, args);
            const responseClone = response.clone();
            
            // --- MODIFICATION: Capture response headers and body ---
            let responseDetails = {};
            responseDetails.headers = Object.fromEntries(response.headers.entries());

            let summary = `Status: ${response.status} ${response.statusText}`;
            try {
                const text = await responseClone.text();
                const size = new Blob([text]).size;
                summary += ` | Size: ${(size / 1024).toFixed(2)} KB`;
                
                // Attempt to parse body as JSON, otherwise show as text
                try {
                    responseDetails.body = text ? JSON.parse(text) : '(Empty Body)';
                } catch (e) {
                    responseDetails.body = text; // It's not JSON, so store the raw text
                }
            } catch (e) {
                summary += ' | (Could not read response body)';
                responseDetails.body = 'Error reading response body.';
            }
            
            createLogEntry('RESPONSE', { url, method, ok: response.ok, summary, details: responseDetails });

            return response;

        } catch (error) {
            createLogEntry('ERROR', { url, method, summary: `Fetch failed: ${error.message}`, details: {} });
            throw error;
        }
    };
    
    // Mount the UI once the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountDebuggerUI);
    } else {
        mountDebuggerUI();
    }
    
    window.globalDebugger = {
        toggle: window.toggleGlobalDebugger,
    };

})();