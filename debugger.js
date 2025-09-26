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

        // --- MODIFICATION: Added search input to the header ---
        panel.innerHTML = `
            <div style="padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <strong>Main Debug Logs</strong>
                    <div>
                        <button id="global-debug-clear" style="margin-right:8px; padding: 4px 8px;">Clear</button>
                        <button id="global-debug-close" style="padding: 4px 8px;">Close</button>
                    </div>
                </div>
                <input type="search" id="global-debug-filter" placeholder="Filter by URL..." style="width: 100%; box-sizing: border-box; padding: 6px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 4px;">
            </div>
            <div id="global-debug-body" style="line-height:1.4"></div>
        `;

        document.body.appendChild(btn);
        document.body.appendChild(panel);

        const dbgBody = panel.querySelector('#global-debug-body');
        const filterInput = panel.querySelector('#global-debug-filter');

        const addLog = (html, data) => {
            const row = document.createElement('div');
            row.className = 'debug-log-row';
            row.innerHTML = html;
            row.dataset.url = data.url; // Store URL for filtering
            row.style.padding = '8px 4px';
            row.style.borderBottom = '1px dashed rgba(255,255,255,0.15)';
            // Attach data for copy functionality
            row.debugData = data;
            dbgBody.prepend(row);
        };

        // --- MODIFICATION: Enhanced event delegation for details, copy, and filtering ---
        dbgBody.addEventListener('click', (e) => {
            const target = e.target;
            const logRow = target.closest('.debug-log-row');
            if (!logRow) return;

            if (target.matches('.debug-details-toggle')) {
                const detailsPanel = logRow.querySelector('.debug-details-panel');
                if (detailsPanel) {
                    const isHidden = detailsPanel.style.display === 'none';
                    detailsPanel.style.display = isHidden ? 'block' : 'none';
                    target.textContent = isHidden ? 'Hide' : 'Details';
                }
            } else if (target.matches('.copy-btn')) {
                let textToCopy;
                if (target.dataset.copyType === 'curl') {
                    textToCopy = logRow.debugData.curlString;
                } else if (target.dataset.copyType === 'response') {
                    const body = logRow.debugData.details.body;
                    textToCopy = typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body);
                }

                if (textToCopy) {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        const originalText = target.textContent;
                        target.textContent = 'Copied!';
                        setTimeout(() => { target.textContent = originalText; }, 1500);
                    });
                }
            }
        });

        filterInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            dbgBody.querySelectorAll('.debug-log-row').forEach(row => {
                const url = row.dataset.url.toLowerCase();
                row.style.display = url.includes(searchTerm) ? '' : 'none';
            });
        });

        btn.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
        panel.querySelector('#global-debug-close').onclick = () => { panel.style.display = 'none'; };
        panel.querySelector('#global-debug-clear').onclick = () => { dbgBody.innerHTML = ''; };

        window.__globalDebugLog = addLog;
        window.toggleGlobalDebugger = () => { DEBUG_ENABLED = !DEBUG_ENABLED; console.log(`Global Debugger ${DEBUG_ENABLED ? 'ON' : 'OFF'}`); };
    }

    /**
     * Helper to format log entries. Now includes duration and copy buttons.
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
        
        const formatObjectForDisplay = (obj) => {
            if (obj === undefined || obj === null) return 'Not available.';
            const content = typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj);
            return `<pre style="background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px; white-space: pre-wrap; word-break: break-all; margin: 0;"><code>${safeHtml(content)}</code></pre>`;
        };

        const hasDetails = data.details.headers || data.details.body;
        // --- MODIFICATION: Show duration if available ---
        const durationHtml = data.duration ? `<span style="font-size:10px; opacity: 0.6; margin-left: 8px;">(${data.duration}ms)</span>` : '';

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
                         <span>${data.summary}${durationHtml}</span>
                         ${hasDetails ? '<button class="debug-details-toggle" style="padding: 2px 6px; font-size: 10px; cursor: pointer;">Details</button>' : ''}
                    </div>
                     ${hasDetails ? `
                        <div class="debug-details-panel" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                                ${data.curlString ? `<button class="copy-btn" data-copy-type="curl" style="font-size:10px; padding:2px 6px;">Copy as cURL</button>` : ''}
                                ${kind === 'RESPONSE' ? `<button class="copy-btn" data-copy-type="response" style="font-size:10px; padding:2px 6px;">Copy Response</button>` : ''}
                            </div>
                            ${data.details.headers ? `<strong>Headers:</strong> ${formatObjectForDisplay(data.details.headers)}` : ''}
                            ${data.details.body ? `<strong style="display: block; margin-top: 5px;">Body:</strong> ${formatObjectForDisplay(data.details.body)}` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>`;
        window.__globalDebugLog(logHtml, data);
    }
    
    // --- Helper function to generate a cURL command ---
    function generateCurl(url, config) {
        const { method = 'GET', headers, body } = config || {};
        let curl = `curl '${url}' \\\n`;
        curl += `  -X ${method.toUpperCase()} \\\n`;

        if (headers) {
            for (const [key, value] of new Headers(headers).entries()) {
                curl += `  -H '${key}: ${value}' \\\n`;
            }
        }
        if (body && typeof body === 'string') {
            curl += `  --data-binary '${body.replace(/'/g, "'\\''")}'`;
        }
        return curl;
    }

    // --- Core Logic Part 1: Monkey-Patching Fetch ---
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        if (!DEBUG_ENABLED) return originalFetch.apply(this, args);

        const startTime = performance.now();
        const [url, config] = args;
        const method = config?.method || 'GET';
        
        let requestDetails = {};
        try {
            requestDetails.headers = config?.headers ? Object.fromEntries(new Headers(config.headers).entries()) : undefined;
            if (config?.body) {
                requestDetails.body = typeof config.body === 'string' ? JSON.parse(config.body) : 'Non-JSON body';
            }
        } catch (e) {}

        const curlString = generateCurl(url, config);
        createLogEntry('REQUEST', { url, method, summary: 'Initiating call...', details: requestDetails, curlString });

        try {
            const response = await originalFetch.apply(this, args);
            const duration = Math.round(performance.now() - startTime);
            const responseClone = response.clone();
            
            let responseDetails = { headers: Object.fromEntries(response.headers.entries()) };
            let summary = `Status: ${response.status} ${response.statusText}`;
            try {
                const text = await responseClone.text();
                summary += ` | Size: ${(new Blob([text]).size / 1024).toFixed(2)} KB`;
                responseDetails.body = text ? JSON.parse(text) : '(Empty Body)';
            } catch (e) {
                responseDetails.body = await response.clone().text();
            }
            
            createLogEntry('RESPONSE', { url, method, ok: response.ok, summary, duration, details: responseDetails });
            return response;

        } catch (error) {
            const duration = Math.round(performance.now() - startTime);
            createLogEntry('ERROR', { url, method, summary: `Fetch failed: ${error.message}`, duration, details: {} });
            throw error;
        }
    };

    // --- Core Logic Part 2: Monkey-Patching XMLHttpRequest ---
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._debuggerData = { method, url, startTime: 0 };
        return originalXhrOpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function(body) {
        if (DEBUG_ENABLED && this._debuggerData) {
            this._debuggerData.startTime = performance.now();
            let requestDetails = {};
            try {
                if(body) requestDetails.body = JSON.parse(body);
            } catch (e) {}
             createLogEntry('REQUEST', { url: this._debuggerData.url, method: this._debuggerData.method, summary: 'Initiating XHR call...', details: requestDetails });
        }

        const onStateChange = (e) => {
            if (this.readyState === 4 && this._debuggerData) { // DONE
                const { url, method, startTime } = this._debuggerData;
                const duration = Math.round(performance.now() - startTime);
                const ok = this.status >= 200 && this.status < 300;

                if (e.type === 'error' || e.type === 'abort') {
                    createLogEntry('ERROR', { url, method, summary: `XHR failed: ${e.type}`, duration, details: {} });
                } else {
                    let responseDetails = {};
                    try {
                        const headersRaw = this.getAllResponseHeaders().trim().split(/[\r\n]+/);
                        responseDetails.headers = headersRaw.reduce((acc, line) => {
                           const parts = line.split(': ');
                           acc[parts.shift()] = parts.join(': ');
                           return acc;
                        }, {});
                        responseDetails.body = this.responseText ? JSON.parse(this.responseText) : '(Empty Body)';
                    } catch(err) {
                        responseDetails.body = this.responseText;
                    }
                    
                    let summary = `Status: ${this.status} ${this.statusText}`;
                    createLogEntry('RESPONSE', { url, method, ok, summary, duration, details: responseDetails });
                }
                // Clean up listeners
                this.removeEventListener('load', onStateChange);
                this.removeEventListener('error', onStateChange);
                this.removeEventListener('abort', onStateChange);
            }
        };
        
        this.addEventListener('load', onStateChange);
        this.addEventListener('error', onStateChange);
        this.addEventListener('abort', onStateChange);
        
        return originalXhrSend.apply(this, [body]);
    };
    
    // Mount the UI once the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountDebuggerUI);
    } else {
        mountDebuggerUI();
    }
    
    window.globalDebugger = { toggle: window.toggleGlobalDebugger };
})();