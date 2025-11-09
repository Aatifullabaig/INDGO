// debugger.js (UPDATED - EXTRA POTENT + REDACTION + OPTIONAL ENCRYPTION)
// Drop this in to replace your previous debugger.js
function initializeGlobalDebugger(userRole) {
  if (window.globalDebugger) return;

  /*********************************************
   * CONFIG
   *********************************************/
  const CONFIG = {
    MAX_LOGS: 500,
    MAX_BODY_PREVIEW_BYTES: 64 * 1024, // 64 KB preview before truncation
    TRUNCATE_NOTICE: '\n\n-- (truncated) --',
    SENSITIVE_KEY_PATTERNS: [
      /authorization/i,
      /auth/i,
      /token/i,
      /api[_-]?key/i,
      /access[_-]?token/i,
      /refresh[_-]?token/i,
      /password/i,
      /secret/i,
      /set-cookie/i,
      /cookie/i,
    ],
    SENSITIVE_VALUE_PATTERNS: [
      /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/, // JWT-ish
    ],
    REDACTION_REPLACEMENT: '[REDACTED]',
    ENCRYPT_STORAGE_KEY: 'global_debug_encrypted_logs',
    ENABLE_PERSISTENCE: false, // set true if you want logs saved to localStorage (encrypted if passphrase set)
  };

  /*********************************************
   * Helpers: safe HTML, shorten, size checks
   *********************************************/
  const safeHtml = (s) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bytesOf = (str) => new TextEncoder().encode(str || '').length;

  // SHA-256 fingerprint (hex) — used for deterministic but non-reversible token representation
  async function sha256Hex(input) {
    const enc = new TextEncoder();
    const data = enc.encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Base64 helpers
  function toBase64(buf) {
    const u8 = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < u8.byteLength; i++) binary += String.fromCharCode(u8[i]);
    return btoa(binary);
  }
  function fromBase64(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr.buffer;
  }

  /*********************************************
   * Encryption layer (AES-GCM) for optional E2E on client
   * Usage: call `window.setDebuggerPassphrase(pass)` to enable.
   *********************************************/
  let encryptionKey = null; // CryptoKey
  let passphraseSalt = null; // stored as base64
  async function deriveKeyFromPassphrase(passphrase, saltB64) {
    const salt = saltB64 ? new Uint8Array(fromBase64(saltB64)) : crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({
      name: 'PBKDF2',
      salt,
      iterations: 200_000,
      hash: 'SHA-256'
    }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return { key, saltB64: toBase64(salt) };
  }

  async function encryptJson(obj) {
    if (!encryptionKey) throw new Error('No encryption key set');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, data);
    return `${toBase64(iv)}.${toBase64(ct)}`; // iv.ciphertext
  }

  async function decryptJson(str) {
    if (!encryptionKey) throw new Error('No encryption key set');
    const [ivB64, ctB64] = String(str || '').split('.');
    if (!ivB64 || !ctB64) throw new Error('Invalid encrypted blob');
    const iv = new Uint8Array(fromBase64(ivB64));
    const ct = fromBase64(ctB64);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encryptionKey, ct);
    return JSON.parse(new TextDecoder().decode(pt));
  }

  // Expose a setter to the window to enable encryption at runtime
  window.setDebuggerPassphrase = async function (passphrase) {
    if (!passphrase) {
      encryptionKey = null;
      passphraseSalt = null;
      console.log('Debugger encryption disabled');
      return;
    }
    const { key, saltB64 } = await deriveKeyFromPassphrase(passphrase, passphraseSalt);
    encryptionKey = key;
    passphraseSalt = saltB64;
    console.log('Debugger passphrase set (encryption active)');
    // If there are encrypted logs in storage, try to load them
    if (CONFIG.ENABLE_PERSISTENCE) {
      try {
        const raw = localStorage.getItem(CONFIG.ENCRYPT_STORAGE_KEY);
        if (raw) {
          const arr = JSON.parse(raw);
          // Decrypt each
          for (const item of arr) {
            if (item.encrypted) {
              try {
                const dec = await decryptJson(item.encrypted);
                item.decrypted = dec;
              } catch (e) { /* leave encrypted */ }
            }
          }
          // We don't auto-insert into UI: user can use the UI load option for safety
          console.log('Loaded stored encrypted logs (decrypted if passphrase matched).');
        }
      } catch (e) {
        console.warn('Could not load persisted logs:', e);
      }
    }
  };

  /*********************************************
   * Sensitive detection & masking
   *********************************************/
  async function maskSensitiveInHeaders(headersObj) {
    if (!headersObj || typeof headersObj !== 'object') return headersObj;
    const out = {};
    for (const [k, v] of Object.entries(headersObj)) {
      const isSensitiveKey = CONFIG.SENSITIVE_KEY_PATTERNS.some(rx => rx.test(k));
      const isSensitiveValue = CONFIG.SENSITIVE_VALUE_PATTERNS.some(rx => rx.test(String(v)));
      if (isSensitiveKey || isSensitiveValue) {
        // compute fingerprint
        try {
          const fp = await sha256Hex(String(v));
          out[k] = `${CONFIG.REDACTION_REPLACEMENT} (fingerprint:${fp.slice(0, 8)})`;
        } catch (e) {
          out[k] = CONFIG.REDACTION_REPLACEMENT;
        }
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  // Walk body and redact any object keys considered sensitive
  async function maskSensitiveInBody(body) {
    if (body === null || body === undefined) return body;
    try {
      // If it's a string that looks like JSON, try parse
      if (typeof body === 'string') {
        const maybeJson = body.trim();
        if ((maybeJson.startsWith('{') && maybeJson.endsWith('}')) || (maybeJson.startsWith('[') && maybeJson.endsWith(']'))) {
          body = JSON.parse(body);
        } else {
          // plain text: check patterns
          for (const rx of CONFIG.SENSITIVE_VALUE_PATTERNS) {
            if (rx.test(maybeJson)) {
              const fp = await sha256Hex(maybeJson);
              return `${CONFIG.REDACTION_REPLACEMENT} (fingerprint:${fp.slice(0, 8)})`;
            }
          }
          return body;
        }
      }

      if (typeof body === 'object') {
        // shallow walk (avoid deep recursion explosion) but handle nested objects up to depth 3
        const walk = async (obj, depth = 0) => {
          if (depth > 3 || obj === null) return obj;
          if (Array.isArray(obj)) {
            const res = [];
            for (const el of obj) res.push(await walk(el, depth + 1));
            return res;
          }
          if (typeof obj === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(obj)) {
              const isSensitiveKey = CONFIG.SENSITIVE_KEY_PATTERNS.some(rx => rx.test(k));
              const isSensitiveVal = typeof v === 'string' && CONFIG.SENSITIVE_VALUE_PATTERNS.some(rx => rx.test(v));
              if (isSensitiveKey || isSensitiveVal) {
                try {
                  const fp = await sha256Hex(String(v));
                  out[k] = `${CONFIG.REDACTION_REPLACEMENT} (fingerprint:${fp.slice(0, 8)})`;
                } catch {
                  out[k] = CONFIG.REDACTION_REPLACEMENT;
                }
              } else {
                out[k] = await walk(v, depth + 1);
              }
            }
            return out;
          }
          return obj;
        };
        return await walk(body, 0);
      }
      return body;
    } catch (e) {
      return body; // Fallback: leave as-is if parsing fails
    }
  }

  /*********************************************
   * UI + state management
   *********************************************/
  let DEBUG_ENABLED = true;
  const logs = []; // circular buffer
  const dbgState = { panelVisible: false };

  function mountDebuggerUI() {
    if (document.getElementById('global-debug-toggle')) return;

    // Styles & button
    const btn = document.createElement('button');
    btn.id = 'global-debug-toggle';
    btn.innerHTML = '🧪 Roster Debug';
    Object.assign(btn.style, {
      position: 'fixed', right: '14px', bottom: '14px', zIndex: 100000,
      padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
      background: '#0b3d91', color: '#fff', cursor: 'pointer', boxShadow: '0 5px 20px rgba(0,0,0,0.35)',
      fontFamily: 'sans-serif', fontSize: '14px', fontWeight: 'bold'
    });

    // Panel
    const panel = document.createElement('div');
    panel.id = 'global-debug-panel';
    Object.assign(panel.style, {
      position: 'fixed', right: '14px', bottom: '64px', width: '540px',
      maxWidth: '94vw', maxHeight: '70vh', overflow: 'hidden',
      background: 'rgba(12,14,26,0.98)', color: '#e8ecff', borderRadius: '12px',
      padding: '10px', display: 'none', zIndex: 100001, border: '1px solid rgba(255,255,255,0.06)',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: '12px'
    });

    panel.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <strong style="font-size:14px">Global Debug</strong>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="global-debug-search" placeholder="Filter by URL / method" style="padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.2);color:#fff;">
          <button id="global-debug-clear" style="padding:6px 8px;border-radius:6px">Clear</button>
          <button id="global-debug-toggle-encrypt" style="padding:6px 8px;border-radius:6px">Encryption Off</button>
          <button id="global-debug-close" style="padding:6px 8px;border-radius:6px">Close</button>
        </div>
      </div>
      <div id="global-debug-body" style="overflow:auto;max-height:calc(70vh - 72px);padding-right:6px;"></div>
      <div style="margin-top:6px;display:flex;gap:8px;align-items:center;justify-content:space-between;">
        <small style="opacity:0.7">Logs: <span id="global-debug-count">0</span></small>
        <div style="opacity:0.6;font-size:11px">Drag the blue button to move</div>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    const bodyEl = panel.querySelector('#global-debug-body');
    const searchInput = panel.querySelector('#global-debug-search');
    const clearBtn = panel.querySelector('#global-debug-clear');
    const closeBtn = panel.querySelector('#global-debug-close');
    const toggleEncryptBtn = panel.querySelector('#global-debug-toggle-encrypt');

    // drag support for button
    (function makeDraggable(el) {
      let isDown = false, startX, startY, origRight, origBottom;
      el.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.clientX; startY = e.clientY;
        origRight = parseInt(window.getComputedStyle(el).right, 10);
        origBottom = parseInt(window.getComputedStyle(el).bottom, 10);
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        el.style.right = `${origRight - dx}px`;
        el.style.bottom = `${origBottom + dy}px`;
      });
      window.addEventListener('mouseup', () => isDown = false);
    })(btn);

    btn.onclick = () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      dbgState.panelVisible = panel.style.display === 'block';
    };

    clearBtn.onclick = () => {
      logs.length = 0;
      bodyEl.innerHTML = '';
      updateCount();
      if (CONFIG.ENABLE_PERSISTENCE) localStorage.removeItem(CONFIG.ENCRYPT_STORAGE_KEY);
    };

    closeBtn.onclick = () => { panel.style.display = 'none'; dbgState.panelVisible = false; };

    toggleEncryptBtn.onclick = async () => {
      if (!encryptionKey) {
        const pass = prompt('Enter a passphrase to enable encryption for stored logs (this session only):');
        if (!pass) return alert('Passphrase required to enable encryption.');
        try {
          await window.setDebuggerPassphrase(pass);
          toggleEncryptBtn.textContent = 'Encryption On';
        } catch (e) {
          console.error('Could not set passphrase:', e);
          alert('Failed to enable encryption.');
        }
      } else {
        // disable
        encryptionKey = null;
        passphraseSalt = null;
        toggleEncryptBtn.textContent = 'Encryption Off';
        console.log('Debugger encryption disabled');
      }
    };

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      bodyEl.querySelectorAll('.debug-log-row').forEach(r => {
        const u = (r.dataset.url || '').toLowerCase();
        const m = (r.dataset.method || '').toLowerCase();
        r.style.display = (u.includes(q) || m.includes(q)) ? '' : 'none';
      });
    });

    // Click delegation in log body
    bodyEl.addEventListener('click', async e => {
      const tgt = e.target;
      const row = tgt.closest('.debug-log-row');
      if (!row) return;

      if (tgt.matches('.debug-details-toggle')) {
        const details = row.querySelector('.debug-details-panel');
        const show = details.style.display === 'none' || !details.style.display;
        if (show) {
          // On show, if encrypted and passphrase set, decrypt
          const encryptedBlob = row.dataset.encryptedBlob;
          if (encryptedBlob && !row.dataset.decrypted) {
            if (!encryptionKey) {
              alert('This log detail is encrypted. Set the passphrase with window.setDebuggerPassphrase(passphrase) to view.');
              return;
            }
            try {
              const dec = await decryptJson(encryptedBlob);
              // inject decrypted HTML
              details.innerHTML = renderDetailsHtml(dec);
              row.dataset.decrypted = '1';
            } catch (err) {
              details.innerHTML = `<div style="color:#ffcccb">Could not decrypt details: ${safeHtml(err.message)}</div>`;
            }
          }
          details.style.display = 'block';
          tgt.textContent = 'Hide';
        } else {
          details.style.display = 'none';
          tgt.textContent = 'Details';
        }
      } else if (tgt.matches('.copy-btn')) {
        const type = tgt.dataset.copyType;
        if (type === 'curl') {
          const curl = row.dataset.curl;
          if (!curl) return;
          // ensure we hide Authorization in copied cURL
          const sanitized = curl.replace(/(-H 'Authorization: )[^\n']+/i, "$1[REDACTED]");
          await navigator.clipboard.writeText(sanitized);
          const orig = tgt.textContent;
          tgt.textContent = 'Copied!';
          setTimeout(() => tgt.textContent = orig, 1200);
        } else if (type === 'response') {
          // If encrypted and no passphrase, block
          if (row.dataset.encryptedBlob && !encryptionKey) {
            alert('Response is encrypted. Set the passphrase via window.setDebuggerPassphrase(passphrase) to copy.');
            return;
          }
          const payload = row.dataset.decryptedPayload || row.dataset.responsePayload;
          if (!payload) return;
          await navigator.clipboard.writeText(payload);
          const orig = tgt.textContent;
          tgt.textContent = 'Copied!';
          setTimeout(() => tgt.textContent = orig, 1200);
        }
      }
    });

    function renderDetailsHtml(details) {
      const headersHtml = details.headers ? `<strong>Headers:</strong> <pre style="white-space:pre-wrap;margin:6px 0;">${safeHtml(JSON.stringify(details.headers, null, 2))}</pre>` : '';
      let bodyHtml = '';
      if (details.body) {
        let bodyContent = details.body;
        if (typeof bodyContent === 'object') bodyContent = JSON.stringify(bodyContent, null, 2);
        // Truncate if needed
        const size = bytesOf(bodyContent);
        if (size > CONFIG.MAX_BODY_PREVIEW_BYTES) {
          bodyHtml = `<strong>Body (preview ${Math.round(CONFIG.MAX_BODY_PREVIEW_BYTES/1024)} KB):</strong><pre style="white-space:pre-wrap;margin:6px 0;">${safeHtml(bodyContent.slice(0, CONFIG.MAX_BODY_PREVIEW_BYTES))}${safeHtml(CONFIG.TRUNCATE_NOTICE)}</pre>`;
        } else {
          bodyHtml = `<strong>Body:</strong><pre style="white-space:pre-wrap;margin:6px 0;">${safeHtml(bodyContent)}</pre>`;
        }
      } else {
        bodyHtml = `<div style="opacity:0.7">No body available.</div>`;
      }
      return `<div>${headersHtml}${bodyHtml}</div>`;
    }

    function updateCount() {
      const el = panel.querySelector('#global-debug-count');
      el.textContent = logs.length;
    }

    // expose addLog to the window
    window.__globalDebugLog = async function (entryHtml, rawData) {
      if (!DEBUG_ENABLED) return;
      // trim
      while (logs.length >= CONFIG.MAX_LOGS) logs.shift();
      // wrap a node
      const row = document.createElement('div');
      row.className = 'debug-log-row';
      row.style.padding = '8px 6px';
      row.style.borderBottom = '1px dashed rgba(255,255,255,0.06)';
      row.style.cursor = 'default';
      // Attach data attributes for filtering/curl etc.
      row.dataset.url = rawData.url || '';
      row.dataset.method = rawData.method || 'GET';
      row.dataset.time = Date.now();

      // We will choose to redact before inserting detail HTML
      const payload = {
        headers: rawData.details?.headers,
        body: rawData.details?.body,
        method: rawData.method,
        url: rawData.url,
        summary: rawData.summary,
        duration: rawData.duration
      };

      // Mask sensitive pieces (async)
      try {
        payload.headers = await maskSensitiveInHeaders(payload.headers);
        payload.body = await maskSensitiveInBody(payload.body);
      } catch (e) {
        console.warn('Masking error', e);
      }

      // Prepare display summary
      const shortSummary = `${safeHtml(rawData.method || 'GET')} ${safeHtml(new URL(rawData.url || '/', window.location.origin).pathname)} — ${safeHtml(rawData.summary || '')}`;
      const ts = new Date().toLocaleTimeString();
      const icon = rawData.kind === 'RESPONSE' ? (rawData.ok ? '✅' : '❌') : (rawData.kind === 'ERROR' ? '⚠️' : '➡️');

      // Build row HTML (lightweight)
      row.innerHTML = `
        <div style="display:flex;gap:8px">
          <div style="font-size:14px">${icon}</div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div><strong>${safeHtml(rawData.kind || 'LOG')}</strong> <span style="opacity:0.8;margin-left:6px">${safeHtml(shortSummary)}</span></div>
              <div style="opacity:0.6">${safeHtml(ts)} ${rawData.duration ? `<span style="opacity:0.6;margin-left:8px">(${rawData.duration}ms)</span>` : ''}</div>
            </div>
            <div style="margin-top:6px;display:flex;gap:8px;align-items:center;justify-content:space-between">
              <div style="opacity:0.9">${safeHtml(payload.summary || '')}</div>
              <div>
                ${rawData.curlString ? `<button class="copy-btn" data-copy-type="curl" style="font-size:11px;padding:4px 6px">Copy as cURL</button>` : ''}
                <button class="debug-details-toggle" style="font-size:11px;padding:4px 6px">Details</button>
              </div>
            </div>
            <div class="debug-details-panel" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04)"></div>
          </div>
        </div>
      `;
      // dataset for copy
      row.dataset.curl = sanitizeCurl(rawData.curlString || '', payload.headers);

      // Prepare stored payload: either store decrypted fields (if no encryption) OR encrypted blob
      if (encryptionKey) {
        try {
          const encrypted = await encryptJson(payload);
          row.dataset.encryptedBlob = encrypted; // for retrieval on details show
          // Do not expose decrypted payload in attributes
          row.dataset.responsePayload = ''; // leave empty
        } catch (e) {
          row.dataset.responsePayload = JSON.stringify(payload);
        }
      } else {
        row.dataset.responsePayload = typeof payload.body === 'object' ? JSON.stringify(payload.body, null, 2) : String(payload.body ?? '');
        // keep a JSON copy for immediate details (non-persistent)
        row.dataset.decryptedPayload = row.dataset.responsePayload;
        const detailsEl = row.querySelector('.debug-details-panel');
        detailsEl.innerHTML = renderDetailsHtml(payload);
        row.dataset.decrypted = '1';
      }

      // Prepend to body
      bodyEl.prepend(row);
      logs.push({ time: Date.now(), url: rawData.url, method: rawData.method, kind: rawData.kind, summary: rawData.summary });

      updateCount();

      // Save to localStorage if requested (persist encrypted only)
      if (CONFIG.ENABLE_PERSISTENCE) {
        try {
          let store = JSON.parse(localStorage.getItem(CONFIG.ENCRYPT_STORAGE_KEY) || '[]');
          const stored = encryptionKey ? { time: Date.now(), encrypted: row.dataset.encryptedBlob } : { time: Date.now(), payload };
          store.push(stored);
          // keep last 100
          if (store.length > 200) store = store.slice(-200);
          localStorage.setItem(CONFIG.ENCRYPT_STORAGE_KEY, JSON.stringify(store));
        } catch (e) { console.warn('Persist failed', e); }
      }

      // maintain max logs in DOM
      const children = bodyEl.querySelectorAll('.debug-log-row');
      if (children.length > CONFIG.MAX_LOGS) {
        children[children.length - 1].remove();
      }
    };

    // small utility: sanitize cURL by removing sensitive auth header
    function sanitizeCurl(curl, headers) {
      if (!curl) return '';
      // Remove Authorization header if present
      let out = curl.replace(/(-H 'Authorization: )[^\n']+/i, "$1[REDACTED]");
      // remove cookies
      out = out.replace(/(-H 'Cookie: )[^\n']+/i, "$1[REDACTED]");
      return out;
    }
  }

  /*********************************************
   * Logging helpers (createLogEntry)
   *********************************************/
  async function createLogEntry(kind, data) {
    if (!window.__globalDebugLog) return;
    // Build curl string if present (and ensure sensitive headers redacted)
    const curl = data.curlString || (data.method ? generateCurlString(data.url, { method: data.method, headers: data.details?.headers ?? {}, body: data.details?.body }) : null);
    window.__globalDebugLog('', { kind, ...data, curlString: curl });
  }

  // cURL generator (strips Authorization/Cookie automatically)
  function generateCurlString(url, config) {
    try {
      const method = (config?.method || 'GET').toUpperCase();
      let out = `curl '${url}' \\\n  -X ${method} \\\n`;
      const headers = config?.headers || {};
      for (const [k, v] of Object.entries(headers)) {
        if (CONFIG.SENSITIVE_KEY_PATTERNS.some(rx => rx.test(k))) {
          out += `  -H '${k}: [REDACTED]' \\\n`;
        } else {
          out += `  -H '${k}: ${v}' \\\n`;
        }
      }
      if (config?.body) {
        let bodyStr = typeof config.body === 'object' ? JSON.stringify(config.body) : String(config.body);
        // if body contains token-like value, redact
        if (CONFIG.SENSITIVE_VALUE_PATTERNS.some(rx => rx.test(bodyStr))) {
          bodyStr = '[REDACTED]';
        } else {
          bodyStr = bodyStr.replace(/'/g, `'\\''`);
        }
        out += `  --data-binary '${bodyStr}'`;
      }
      return out;
    } catch (e) {
      return '';
    }
  }

  /*********************************************
   * Monkey-patch fetch & XHR (core)
   *********************************************/
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (...args) {
    if (!window.__globalDebugLog) return originalFetch(...args);
    const start = performance.now();
    const url = args[0];
    const config = args[1] || {};
    const method = (config.method || 'GET').toUpperCase();

    // Try to capture request details safely
    let reqDetails = { headers: undefined, body: undefined };
    try {
      if (config.headers) reqDetails.headers = Object.fromEntries(new Headers(config.headers).entries());
      if (config.body) {
        if (typeof config.body === 'string') {
          reqDetails.body = config.body;
        } else if (config.body instanceof FormData) {
          const o = {};
          for (const pair of config.body.entries()) o[pair[0]] = pair[1];
          reqDetails.body = o;
        } else {
          reqDetails.body = '[Non-serializable request body]';
        }
      }
    } catch (e) {}

    // Build and log a request entry
    await createLogEntry('REQUEST', { url, method, summary: 'Initiating call...', details: reqDetails, curlString: generateCurlString(url, { method, headers: reqDetails.headers, body: reqDetails.body }) });

    try {
      const res = await originalFetch(...args);
      const duration = Math.round(performance.now() - start);
      // clone and read
      const clone = res.clone();
      let headersObj = {};
      try {
        for (const [k, v] of clone.headers.entries()) headersObj[k] = v;
      } catch { headersObj = undefined; }

      // decide how to parse body based on content-type
      let bodyContent;
      try {
        const ct = headersObj && (headersObj['content-type'] || headersObj['Content-Type'] || '');
        if (ct.includes('application/json')) {
          bodyContent = await clone.json();
        } else if (ct.includes('text/') || ct === '') {
          bodyContent = await clone.text();
        } else {
          // binary (don't attempt to parse)
          const buf = await clone.arrayBuffer();
          bodyContent = `[Binary ${Math.round(buf.byteLength / 1024)} KB]`;
        }
      } catch (e) {
        try { bodyContent = await clone.text(); } catch { bodyContent = '[Unreadable body]'; }
      }

      await createLogEntry('RESPONSE', { url, method, ok: res.ok, summary: `Status: ${res.status} ${res.statusText}`, duration, details: { headers: headersObj, body: bodyContent } });
      return res;
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      await createLogEntry('ERROR', { url, method, summary: `Fetch failed: ${err.message}`, duration, details: {} });
      throw err;
    }
  };

  // XHR
  (function () {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._dbg = { method, url };
      return origOpen.apply(this, [method, url, ...rest]);
    };
    XMLHttpRequest.prototype.send = function (body) {
      const dbg = this._dbg || {};
      const start = performance.now();
      let reqDetails = {};
      try {
        if (body) {
          if (typeof body === 'string') reqDetails.body = body;
          else reqDetails.body = '[Non-serializable XHR body]';
        }
      } catch (e) { }

      (async () => {
        await createLogEntry('REQUEST', { url: dbg.url, method: dbg.method, summary: 'Initiating XHR call...', details: reqDetails, curlString: generateCurlString(dbg.url, { method: dbg.method, body: reqDetails.body }) });
      })();

      const onState = async (e) => {
        if (this.readyState === 4) {
          try {
            const duration = Math.round(performance.now() - start);
            const ok = this.status >= 200 && this.status < 300;
            let headers = {};
            try {
              const hdrs = this.getAllResponseHeaders().trim().split(/[\r\n]+/);
              for (const h of hdrs) {
                const idx = h.indexOf(':');
                if (idx > -1) headers[h.slice(0, idx)] = h.slice(idx + 1).trim();
              }
            } catch (e) { headers = undefined; }
            let bodyContent;
            try {
              const ct = headers && (headers['content-type'] || headers['Content-Type'] || '');
              if (ct && ct.includes('application/json')) bodyContent = JSON.parse(this.responseText || '');
              else bodyContent = this.responseText || '';
            } catch (e) {
              bodyContent = this.responseText || '';
            }
            await createLogEntry('RESPONSE', { url: dbg.url, method: dbg.method, ok, summary: `Status: ${this.status} ${this.statusText}`, duration, details: { headers, body: bodyContent } });
          } catch (e) {
            console.warn('XHR logging error', e);
          } finally {
            this.removeEventListener('load', onState);
            this.removeEventListener('error', onState);
            this.removeEventListener('abort', onState);
          }
        }
      };

      this.addEventListener('load', onState);
      this.addEventListener('error', onState);
      this.addEventListener('abort', onState);
      return origSend.apply(this, [body]);
    };
  })();

  // mount UI
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountDebuggerUI);
  } else {
    mountDebuggerUI();
  }

  // expose toggle
  window.initializeGlobalDebugger = initializeGlobalDebugger;
}