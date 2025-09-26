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
            row.innerHTML = html;
            row.style.padding = '8px 4px';
            row.style.borderBottom = '1px dashed rgba(255,255,255,0.15)';
            dbgBody.prepend(row);
        };

        // Event listeners for the UI controls
        btn.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
        panel.querySelector('#global-debug-close').onclick = () => { panel.style.display = 'none'; };
        panel.querySelector('#global-debug-clear').onclick = () => { dbgBody.innerHTML = ''; };

        // Expose the logging function globally so our fetch wrapper can use it
        window.__globalDebugLog = addLog;
        window.toggleGlobalDebugger = () => { DEBUG_ENABLED = !DEBUG_ENABLED; console.log(`Global Debugger ${DEBUG_ENABLED ? 'ON' : 'OFF'}`); };
    }

    /**
     * A helper function to format log entries for display.
     */
    function createLogEntry(kind, data) {
        if (!DEBUG_ENABLED || !window.__globalDebugLog) return;
        const ts = new Date().toLocaleTimeString();
        let color = '#FFF';
        let icon = '➡️';
        
        switch (kind) {
            case 'REQUEST':
                color = '#00A8FF'; // Blue for request
                break;
            case 'RESPONSE':
                color = data.ok ? '#28a745' : '#dc3545'; // Green for success, Red for error
                icon = data.ok ? '✅' : '❌';
                break;
            case 'ERROR':
                color = '#ffc107'; // Yellow for network/fetch errors
                icon = '⚠️';
                break;
        }

        const safeHtml = (str) => String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const urlParts = new URL(data.url, window.location.origin);

        const logHtml = `
            <div style="display: flex; align-items: flex-start; gap: 8px;">
                <strong style="color: ${color}; font-size: 16px;">${icon}</strong>
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color: ${color};">${safeHtml(kind)}</strong>
                        <span style="opacity:0.7;">${ts}</span>
                    </div>
                    <div style="font-weight: bold; margin: 2px 0;">
                        <span style="opacity: 0.8;">${data.method || 'GET'}</span> ${safeHtml(urlParts.pathname)}
                    </div>
                    <div style="opacity: 0.9; margin-top: 4px;">${data.details}</div>
                </div>
            </div>`;
        window.__globalDebugLog(logHtml);
    }
    
    // --- The Core Logic: Monkey-Patching Fetch ---

    // 1. Store the original, native fetch function
    const originalFetch = window.fetch;

    // 2. Overwrite the global window.fetch with our custom function
    window.fetch = async function(...args) {
        if (!DEBUG_ENABLED) {
            return originalFetch.apply(this, args);
        }

        const [url, config] = args;
        const method = config?.method || 'GET';

        // Log the outgoing request
        createLogEntry('REQUEST', { url, method, details: 'Initiating call...' });

        try {
            // 3. Call the original fetch function to perform the network request
            const response = await originalFetch.apply(this, args);

            // Clone the response so we can inspect it without consuming the body
            const responseClone = response.clone();
            
            let responseDetails = `Status: ${response.status} ${response.statusText}`;
            try {
                const text = await responseClone.text();
                const size = new Blob([text]).size;
                responseDetails += ` | Size: ${(size / 1024).toFixed(2)} KB`;
            } catch (e) {
                responseDetails += ' | (Could not read response body)';
            }
            
            // Log the received response
            createLogEntry('RESPONSE', { url, method, ok: response.ok, details: responseDetails });

            // 4. Return the original response so the application can use it normally
            return response;

        } catch (error) {
            // Log any errors that occurred during the fetch (e.g., network down)
            createLogEntry('ERROR', { url, method, details: `Fetch failed: ${error.message}` });

            // 5. Re-throw the error so the application's .catch() blocks still work
            throw error;
        }
    };
    
    // Mount the UI once the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountDebuggerUI);
    } else {
        mountDebuggerUI();
    }
    
    // Make the debugger object globally accessible (optional)
    window.globalDebugger = {
        toggle: window.toggleGlobalDebugger,
    };

})();