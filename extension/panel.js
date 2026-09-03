// PhishGuard — shared panel UI + scan orchestration (v3: real-time protection + quarantine)
// Requires window.PhishGuardAdapter to be set by a site adapter script loaded first.
(function () {
  const ICONS = {
    logo: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5v6c0 5.2 3.4 9.7 8 11 4.6-1.3 8-5.8 8-11V5l-8-3z" fill="#fff" fill-opacity=".95"/><path d="M9 12.5l2 2 4-4.5" stroke="#4338ca" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    scanVisible: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 9h18" stroke="currentColor" stroke-width="1.8"/></svg>`,
    scanAll: `<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    empty: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5v6c0 5.2 3.4 9.7 8 11 4.6-1.3 8-5.8 8-11V5l-8-3z" stroke="currentColor" stroke-width="1.5"/></svg>`,
    low: `<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    medium: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M10.3 3.9L2.6 18a1.5 1.5 0 001.3 2.2h16.2a1.5 1.5 0 001.3-2.2L13.7 3.9a1.5 1.5 0 00-2.6 0z" stroke="currentColor" stroke-width="1.6"/></svg>`,
    high: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v6M12 16.5h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    resize: `<svg viewBox="0 0 24 24" fill="none"><path d="M21 3L14 10M21 10L13 18M21 17L18 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    sizeCycle: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 14v6h6M20 10V4h-6M20 4l-7 7M4 20l7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6l7-3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    flask: `<svg viewBox="0 0 24 24" fill="none"><path d="M9 3h6M10 3v6.5L4.8 18a1.5 1.5 0 001.3 2.3h11.8a1.5 1.5 0 001.3-2.3L14 9.5V3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  // Some inboxes enforce a Trusted Types CSP that blocks assigning a raw string to
  // .innerHTML outright — confirmed live on Gmail: without this, the panel throws
  // "This document requires 'TrustedHTML' assignment" and never renders at all. Register
  // our own named policy (never 'default', so we don't loosen Trusted Types enforcement for
  // the rest of the page — other scripts on the host page keep whatever protection they had)
  // and route every innerHTML assignment in this file through it. Sites with no Trusted
  // Types enforcement are unaffected: trustedTypes is undefined there, or policy creation is
  // simply unnecessary since raw strings already work.
  let pgHtml = (s) => s;
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    try {
      const policy = window.trustedTypes.createPolicy('phishguard-panel', { createHTML: (s) => s });
      pgHtml = (s) => policy.createHTML(s);
    } catch (e) {
      // A policy with this name may already exist, or the page's CSP may restrict which
      // policy names can be created — fall back to raw strings, which still work wherever
      // Trusted Types isn't enforced.
    }
  }

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function initials(sender) {
    const name = (sender || '').replace(/<.*?>/g, '').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  function riskClass(risk) { return risk === 'High' ? 'high' : risk === 'Medium' ? 'medium' : risk === 'Blocked' ? 'high' : 'low'; }

  // ---------- Resizable panel ----------
  const SIZE_PRESETS = [
    { w: 340, h: 420, label: 'Compact' },
    { w: 384, h: 560, label: 'Default' },
    { w: 480, h: 700, label: 'Large' },
  ];
  const MIN_W = 320, MIN_H = 340;
  function maxW() { return Math.min(680, window.innerWidth - 40); }
  function maxH() { return Math.min(860, window.innerHeight - 40); }
  function clampSize(w, h) {
    return { w: Math.round(Math.min(maxW(), Math.max(MIN_W, w))), h: Math.round(Math.min(maxH(), Math.max(MIN_H, h))) };
  }
  function applySize(panel, w, h) {
    const c = clampSize(w, h);
    panel.style.width = c.w + 'px';
    panel.style.height = c.h + 'px';
    return c;
  }
  function saveSize(w, h) { chrome.storage.sync.set({ panelSize: { w, h } }); }
  function getSavedSize() { return new Promise(r => chrome.storage.sync.get({ panelSize: null }, o => r(o.panelSize))); }

  function setupResize(panel, handle, sizeCycleBtn) {
    let dragging = false, startX = 0, startY = 0, startW = 0, startH = 0;
    handle.addEventListener('pointerdown', (e) => {
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startW = panel.offsetWidth; startH = panel.offsetHeight;
      panel.classList.add('pg-resizing');
      try { handle.setPointerCapture(e.pointerId); } catch (_) {} // not all environments support pointer capture
      e.preventDefault();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = startX - e.clientX; // dragging left (handle is top-left) grows the panel
      const dy = startY - e.clientY; // dragging up grows the panel
      applySize(panel, startW + dx, startH + dy);
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('pg-resizing');
      saveSize(panel.offsetWidth, panel.offsetHeight);
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('dblclick', () => {
      const c = applySize(panel, SIZE_PRESETS[1].w, SIZE_PRESETS[1].h);
      saveSize(c.w, c.h);
    });

    if (sizeCycleBtn) {
      let presetIdx = 1;
      sizeCycleBtn.title = 'Cycle panel size';
      sizeCycleBtn.addEventListener('click', () => {
        presetIdx = (presetIdx + 1) % SIZE_PRESETS.length;
        const p = SIZE_PRESETS[presetIdx];
        const c = applySize(panel, p.w, p.h);
        saveSize(c.w, c.h);
      });
    }
  }

  async function restoreSize(panel) {
    const saved = await getSavedSize();
    if (saved && saved.w && saved.h) applySize(panel, saved.w, saved.h);
  }

  const DEFAULT_API = "http://localhost:8000";
  const DEFAULT_DASHBOARD = "http://localhost:5173";
  function getApiBase() { return new Promise(r => { chrome.storage.sync.get({ apiBase: DEFAULT_API }, o => r(o.apiBase || DEFAULT_API)); }); }
  function getDashboardUrl() { return new Promise(r => { chrome.storage.sync.get({ dashboardUrl: DEFAULT_DASHBOARD }, o => r(o.dashboardUrl || DEFAULT_DASHBOARD)); }); }
  function getRealtimeEnabled() { return new Promise(r => chrome.storage.sync.get({ realtimeProtection: true }, o => r(o.realtimeProtection !== false))); }
  function setRealtimeEnabled(v) { chrome.storage.sync.set({ realtimeProtection: !!v }); }

  let abortScan = null;
  let panelOpen = false;

  // ---------- Quarantine ----------
  // Two independent mechanisms, applied best-effort per email:
  //  1) Client-side hide: hides the row in the real inbox DOM the moment a High-risk email
  //     is scored, with a one-click Undo. Known limitation: some inbox UIs virtualize/recycle
  //     their row DOM nodes as you scroll, which could in theory reuse a hidden node for a
  //     different message later — restoreEmail() guards against operating on a node that's
  //     no longer attached to the page. This is a per-tab visual workaround only — it does
  //     NOT touch the real mailbox, so a reload (or opening the inbox elsewhere) shows the
  //     email again unless it's also labeled (below).
  //  2) Real Gmail label ("PhishGuard/Quarantine"): a genuine, server-side tag applied via
  //     the Gmail API, findable/filterable in Gmail itself from any device. Requires a real
  //     Gmail API message id, which we only have for (a) emails from the full-inbox API scan
  //     (background.js already fetched them via the API, so email.gmailId is the true id) or
  //     (b) DOM rows where Gmail happened to populate data-legacy-message-id, converted to
  //     the API's hex id format. Without either, quarantine falls back to hide-only. The
  //     label call itself runs in background.js (only service workers have chrome.identity)
  //     using a non-interactive token fetch, so it never pops an unexpected Google sign-in
  //     window mid-browse — until the broader "manage your mail" scope has been granted once
  //     (e.g. by running an API scan), labeling silently no-ops and falls back to hide-only.
  //  Deliberately does NOT remove the INBOX label / archive the message — it stays visible in
  //  the real inbox too, just tagged, so nothing disappears from Gmail unexpectedly.
  const quarantined = new Map(); // id -> { email, api, hidden, gmailId, labelState, tagEl }
  const scoredIds = new Set();

  function realGmailIdFor(email) {
    if (email.gmailId) return email.gmailId;
    if (email.legacyId && /^\d+$/.test(String(email.legacyId))) {
      try { return BigInt(email.legacyId).toString(16); } catch (_) { return null; }
    }
    return null;
  }

  // When the email was actually received, not when PhishGuard happened to scan it. Prefers
  // the Gmail API's internalDate (exact epoch ms, only present on full-inbox API scan
  // results) and falls back to the date parsed out of the inbox row's title attribute
  // (adapters/gmail.js, adapters/outlook.js). Returns null — caller falls back to scan
  // time — when neither is available (e.g. Yahoo, or a row Gmail didn't annotate).
  function resolveReceivedAt(email) {
    if (email.receivedAt) {
      const ms = Number(email.receivedAt);
      if (!Number.isNaN(ms)) return new Date(ms).toISOString();
    }
    if (email.receivedAtRaw) {
      const d = new Date(email.receivedAtRaw);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    return null;
  }

  function requestGmailLabel(localId, gmailId, cmd) {
    if (!(chrome.runtime && typeof chrome.runtime.sendMessage === 'function')) return;
    try {
      chrome.runtime.sendMessage({ cmd, msgId: gmailId }, (resp) => {
        if (chrome.runtime.lastError) return; // no receiving end (e.g. SW asleep) — best-effort only
        if (cmd !== 'gmail_label_quarantine') return;
        const q = quarantined.get(localId);
        if (!q) return; // already restored/removed before the response came back
        q.labelState = (resp && resp.ok) ? 'labeled' : 'error';
        q.labelError = resp && resp.error;
        renderQuarantineTag(q);
      });
    } catch (_) {}
  }

  function quarantineEmail(email, api) {
    if (quarantined.has(email.id)) return false;
    let hidden = false;
    if (email.el) {
      email.el.dataset.pgOriginalDisplay = email.el.style.display || '';
      email.el.style.display = 'none';
      hidden = true;
    }
    const gmailId = realGmailIdFor(email);
    if (!hidden && !gmailId) return false; // nothing we can actually do for this one
    const q = { email, api, hidden, gmailId, labelState: gmailId ? 'pending' : 'none' };
    quarantined.set(email.id, q);
    updateQuarantineBar();
    if (gmailId) requestGmailLabel(email.id, gmailId, 'gmail_label_quarantine');
    return true;
  }

  function restoreEmail(id) {
    const q = quarantined.get(id);
    if (!q) return;
    quarantined.delete(id);
    const el = q.email.el;
    if (el && el.isConnected) {
      el.style.display = el.dataset.pgOriginalDisplay || '';
      delete el.dataset.pgOriginalDisplay;
    }
    if (q.gmailId) requestGmailLabel(id, q.gmailId, 'gmail_label_restore');
    // Tracked directly (rather than re-queried via a CSS attribute-selector, since
    // CSS.escape isn't universally available) so this works regardless of the id's shape.
    if (q.tagEl && q.tagEl.isConnected) q.tagEl.remove();
    updateQuarantineBar();
  }

  function attachQuarantineTag(id, tagEl) {
    const q = quarantined.get(id);
    if (q) { q.tagEl = tagEl; renderQuarantineTag(q); }
  }

  function quarantineTagText(q) {
    if (q.labelState === 'labeled') return q.hidden ? 'Hidden + labeled in Gmail' : 'Labeled in Gmail (kept in inbox)';
    if (q.labelState === 'pending') return 'Hidden — labeling in Gmail…';
    if (q.labelState === 'error') return 'Hidden here only (Gmail label failed)';
    return 'Removed from inbox';
  }

  function renderQuarantineTag(q) {
    if (!q.tagEl || !q.tagEl.isConnected) return;
    const span = q.tagEl.querySelector('span');
    if (span) span.innerHTML = pgHtml(`${ICONS.shield} ${esc(quarantineTagText(q))}`);
  }

  function restoreAllQuarantined() {
    Array.from(quarantined.keys()).forEach(restoreEmail);
  }

  function updateQuarantineBar() {
    const bar = document.getElementById('pg-quarantine-bar');
    if (!bar) return;
    const n = quarantined.size;
    bar.hidden = n === 0;
    const text = document.getElementById('pg-quarantine-text');
    if (text) text.textContent = `${n} phishing email${n === 1 ? '' : 's'} quarantined`;
  }

  let quarantineViewActive = false;

  function updateQuarantineViewToggleUI() {
    const btn = document.getElementById('pg-view-quarantined');
    if (!btn) return;
    btn.textContent = quarantineViewActive ? 'Show all' : 'View quarantined';
    btn.classList.toggle('active', quarantineViewActive);
  }

  // Filters the currently-rendered result cards down to just the quarantined ones (or back
  // to all of them). Works identically no matter which site adapter is active: it never
  // looks at siteName, gmailId, or anything Gmail-specific — only whether a card carries the
  // .pg-quarantined-tag that buildCard() already attaches to every quarantined email, hidden
  // -only (Outlook/Yahoo, and Gmail before the label lands) or hidden+labeled (Gmail).
  function applyQuarantineViewFilter() {
    const box = document.getElementById('phishguard-results');
    if (!box) return;
    const cards = box.querySelectorAll('.pg-card');
    let visibleCount = 0;
    cards.forEach((card) => {
      const isQuarantined = !!card.querySelector('.pg-quarantined-tag');
      const show = !quarantineViewActive || isQuarantined;
      card.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });
    let note = box.querySelector('.pg-quarantine-filter-note');
    if (quarantineViewActive && visibleCount === 0 && cards.length > 0) {
      if (!note) {
        note = document.createElement('div');
        note.className = 'pg-empty pg-quarantine-filter-note';
        note.innerHTML = pgHtml(`${ICONS.empty}<div>None of the emails in this scan are quarantined.</div>`);
        box.appendChild(note);
      }
    } else if (note) {
      note.remove();
    }
  }

  function toggleQuarantineView() {
    quarantineViewActive = !quarantineViewActive;
    updateQuarantineViewToggleUI();
    applyQuarantineViewFilter();
  }

  // ---------- Real-time protection ----------
  let realtimeEnabled = true;
  let realtimeObserver = null;
  let realtimeDebounceTimer = null;

  function updateRealtimeToggleUI() {
    const btn = document.getElementById('pg-realtime-toggle');
    if (!btn) return;
    btn.classList.toggle('active', realtimeEnabled);
    btn.title = realtimeEnabled
      ? 'Real-time protection: ON — click to pause'
      : 'Real-time protection: OFF — click to resume';
    const status = document.querySelector('.pg-status');
    if (status) {
      status.innerHTML = pgHtml(realtimeEnabled
        ? `<span class="dot"></span>Real-time protection on`
        : `<span class="dot dot-off"></span>Real-time protection paused`);
    }
  }

  async function scanForRealtime() {
    const adapter = window.PhishGuardAdapter;
    if (!adapter || !realtimeEnabled) return;
    const emails = adapter.extractVisibleEmails();
    // Gmail sometimes fires the DOM mutation that reveals a new row before it's finished
    // populating the subject text (the sender's `[email]` attribute tends to land first) —
    // scoring that early produced blank, "(no subject)"-less report entries with no
    // receivedAtRaw yet either, which then fell back to "right now" as their timestamp and
    // sorted straight to the top of the dashboard. Require a real subject before treating a
    // row as "seen": an unrendered row is simply left off `scoredIds` and skipped this pass,
    // so the next mutation/debounce cycle (600ms later, or whenever Gmail changes the DOM
    // again — routine while scrolling/loading) picks it up once it's actually rendered,
    // rather than reporting it broken.
    const fresh = emails.filter(e => !scoredIds.has(e.id) && (e.subject || '').trim());
    if (!fresh.length) return;
    const box = document.getElementById('phishguard-results');
    for (const e of fresh) {
      scoredIds.add(e.id);
      if (box) await scoreAndHandle(e, box);
    }
  }

  function startRealtimeProtection() {
    const adapter = window.PhishGuardAdapter;
    if (!adapter) return;
    stopRealtimeProtection();
    const container = adapter.getContainer ? adapter.getContainer() : document.body;
    if (!container) return;
    scanForRealtime();
    realtimeObserver = new MutationObserver(() => {
      clearTimeout(realtimeDebounceTimer);
      realtimeDebounceTimer = setTimeout(scanForRealtime, 600);
    });
    realtimeObserver.observe(container, { childList: true, subtree: true });
  }

  function stopRealtimeProtection() {
    if (realtimeObserver) { realtimeObserver.disconnect(); realtimeObserver = null; }
    clearTimeout(realtimeDebounceTimer);
  }

  function toggleRealtime() {
    realtimeEnabled = !realtimeEnabled;
    setRealtimeEnabled(realtimeEnabled);
    updateRealtimeToggleUI();
    if (realtimeEnabled) startRealtimeProtection(); else stopRealtimeProtection();
  }

  // ---------- Sandboxed link deep-scan (on-demand) ----------
  function pillClassForRisk(risk) {
    if (risk === 'High' || risk === 'Blocked') return 'high';
    if (risk === 'Medium') return 'medium';
    if (risk === 'Low') return 'low';
    return 'medium';
  }

  function renderDeepScanRow(url, data) {
    const cls = pillClassForRisk(data.risk);
    const flags = (data.flags || []).map(f => `<div class="pg-deepscan-flag">${esc(f)}</div>`).join('');
    const dest = esc(data.final_url || data.url || url);
    return `<div class="pg-deepscan-head"><span class="pg-pill ${cls}">${esc(data.risk || 'Unknown')}</span><span class="pg-deepscan-url" title="${dest}">${dest}</span></div>${flags}`;
  }

  async function runDeepScan(urls, btn, resultsEl) {
    btn.disabled = true;
    const orig = btn.textContent;
    resultsEl.innerHTML = '';
    resultsEl.hidden = false;
    const base = await getApiBase();
    for (const url of urls.slice(0, 3)) {
      btn.textContent = 'Scanning in sandbox…';
      const row = document.createElement('div');
      row.className = 'pg-deepscan-row';
      row.textContent = `Checking ${url} …`;
      resultsEl.appendChild(row);
      try {
        const res = await fetch(base + '/scan/link_deepscan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        row.innerHTML = pgHtml(renderDeepScanRow(url, data));
      } catch (e) {
        row.textContent = `Couldn't reach PhishGuard API to scan ${url}.`;
      }
    }
    btn.disabled = false;
    btn.textContent = orig;
  }

  function ensureLauncher() {
    if (document.getElementById('phishguard-launcher')) return;
    const btn = document.createElement('button');
    btn.id = 'phishguard-launcher';
    btn.title = 'Open PhishGuard';
    btn.innerHTML = pgHtml(`${ICONS.logo}<span class="pg-launcher-badge" id="pg-launcher-badge">0</span>`);
    btn.onclick = () => togglePanel();
    document.body.appendChild(btn);
  }

  function ensurePanel() {
    if (document.getElementById('phishguard-panel')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('overlay.css');
    document.documentElement.appendChild(link);

    const siteName = (window.PhishGuardAdapter && window.PhishGuardAdapter.siteName) || 'this inbox';
    const panel = document.createElement('div');
    panel.id = 'phishguard-panel';
    panel.hidden = true;
    panel.innerHTML = pgHtml(`
      <div class="pg-resize-handle" id="pg-resize-handle" title="Drag to resize · double-click to reset">${ICONS.resize}</div>
      <div id="phishguard-header">
        <div class="pg-logo-mark">${ICONS.logo}</div>
        <div class="pg-titles">
          <div class="title">PhishGuard</div>
          <div class="pg-status"><span class="dot"></span>Protecting ${esc(siteName)}</div>
        </div>
        <button class="pg-size-btn" id="pg-realtime-toggle" title="Real-time protection">${ICONS.shield}</button>
        <button class="pg-size-btn" id="pg-size-cycle" title="Cycle panel size">${ICONS.sizeCycle}</button>
        <button id="pg-close" title="Close">${ICONS.close}</button>
      </div>
      <div id="phishguard-actions">
        <div class="pg-segmented">
          <button class="pg-seg-btn active" id="pg-scan-visible">${ICONS.scanVisible}Scan visible</button>
          <button class="pg-seg-btn" id="pg-scan-all">${ICONS.scanAll}Scan inbox</button>
        </div>
        <div class="pg-row-actions">
          <button class="pg-btn" id="pg-report">Full report</button>
          <button class="pg-btn" id="pg-scan-api" hidden title="Reads your entire inbox via the Gmail API instead of scrolling the page — not capped, but paced by Google's quota (~5 msgs/sec, so a very large inbox can take a while).">API scan</button>
          <button class="pg-btn" id="pg-clear">Clear</button>
          <button class="pg-btn danger" id="pg-cancel">Cancel</button>
        </div>
      </div>
      <div id="pg-quarantine-bar" class="pg-quarantine-bar" hidden>
        <span id="pg-quarantine-text">0 phishing emails quarantined</span>
        <div class="pg-quarantine-actions">
          <button class="pg-link-btn" id="pg-view-quarantined">View quarantined</button>
          <a class="pg-link-btn" id="pg-view-quarantined-gmail" href="https://mail.google.com/mail/u/0/#label/PhishGuard%2FQuarantine" target="_blank" rel="noopener noreferrer" hidden>Open in Gmail ↗</a>
          <button class="pg-link-btn" id="pg-quarantine-restore-all">Restore all</button>
        </div>
      </div>
      <div id="phishguard-results"><div class="pg-empty">${ICONS.empty}<div>Real-time protection is scanning automatically. Click <b>Scan visible</b> to check right now.</div></div></div>
      <div id="phishguard-footer">
        <span id="pg-count">0 emails</span>
        <div class="pg-progress"><div class="pg-bar" id="pg-bar"></div></div>
        <span class="pg-powered">AI + heuristics</span>
      </div>`);
    document.body.appendChild(panel);

    setupResize(panel, document.getElementById('pg-resize-handle'), document.getElementById('pg-size-cycle'));
    restoreSize(panel);
    document.getElementById('pg-close').onclick = () => togglePanel(false);
    document.getElementById('pg-scan-visible').onclick = () => runScan(false);
    document.getElementById('pg-scan-all').onclick = () => runScan(true);
    document.getElementById('pg-cancel').onclick = () => { if (abortScan) abortScan(); };
    document.getElementById('pg-clear').onclick = () => {
      document.getElementById('phishguard-results').innerHTML = pgHtml(`<div class="pg-empty">${ICONS.empty}<div>No scans yet. Click <b>Scan visible</b> to check the emails on screen.</div></div>`);
      updateBar(0, 1); setCount(0); setBadge(0);
      if (quarantineViewActive) { quarantineViewActive = false; updateQuarantineViewToggleUI(); }
    };
    document.getElementById('pg-report').onclick = () => { getDashboardUrl().then(url => window.open(url, '_blank')); };
    document.getElementById('pg-realtime-toggle').onclick = () => toggleRealtime();
    document.getElementById('pg-quarantine-restore-all').onclick = () => restoreAllQuarantined();
    document.getElementById('pg-view-quarantined').onclick = () => toggleQuarantineView();
    // Full-inbox-via-API is Gmail-specific (chrome.identity is wired to a Gmail OAuth client
    // in background.js) — hide the row entirely on Outlook/Yahoo rather than show a button
    // that would just error out there. Same reasoning for the "Open in Gmail" quarantine
    // label deep link — Outlook/Yahoo have no server-side quarantine label to link to, only
    // the client-side hide, which "View quarantined" (below) already covers for every site.
    if (window.PhishGuardAdapter && window.PhishGuardAdapter.siteName === 'Gmail') {
      document.getElementById('pg-scan-api').hidden = false;
      document.getElementById('pg-scan-api').onclick = () => runApiScan();
      document.getElementById('pg-view-quarantined-gmail').hidden = false;
    }
  }

  function togglePanel(force) {
    ensurePanel();
    const panel = document.getElementById('phishguard-panel');
    panelOpen = typeof force === 'boolean' ? force : !panelOpen;
    panel.hidden = !panelOpen;
  }

  function setCount(n) { const el = document.getElementById('pg-count'); if (el) el.textContent = `${n} email${n === 1 ? '' : 's'}`; }
  function updateBar(done, total) { const el = document.getElementById('pg-bar'); if (el) el.style.width = (total ? Math.min(100, Math.round(done * 100 / total)) : 0) + '%'; }
  function setBadge(highCount) {
    // highCount already counts every High-risk card built this session, INCLUDING
    // quarantined ones (buildCard increments it regardless of quarantine status) — it must
    // not also add quarantined.size on top, or quarantined emails would be counted twice.
    const b = document.getElementById('pg-launcher-badge');
    if (!b) return;
    if (highCount > 0) { b.textContent = highCount > 9 ? '9+' : String(highCount); b.classList.add('show'); }
    else { b.classList.remove('show'); }
  }

  let highCount = 0;

  function buildCard(meta, api, opts = {}) {
    const risk = api?.risk || 'Low';
    const cls = riskClass(risk);
    const pct = (typeof api?.threat_pct === 'number') ? api.threat_pct : Math.round((api?.prob || 0) * 100);
    const summary = api?.summary || (meta?.subject ? `${meta.subject} — ${meta.snippet || ''}` : (meta?.snippet || 'No content'));
    const reasons = (api?.reasons || []).filter(Boolean);
    const urls = (api?.iocs && api.iocs.urls) || [];

    const el = document.createElement('div');
    el.className = 'pg-card';
    el.innerHTML = pgHtml(`
      <div class="pg-row">
        <div class="pg-left">
          <div class="pg-avatar">${esc(initials(meta?.sender))}</div>
          <div class="pg-text">
            <div class="pg-title">${esc(meta?.subject || '(no subject)')}</div>
            <div class="pg-sub">${esc(meta?.sender || '')}</div>
            <div class="pg-summary">${esc(summary)}</div>
          </div>
        </div>
        <div class="pg-right"><span class="pg-pill ${cls}">${ICONS[cls] || ICONS.high}${esc(risk)}</span></div>
      </div>
      <div class="pg-meter-track"><div class="pg-meter-fill ${cls}" style="width:${pct}%"></div></div>
      ${reasons.length ? `<div class="pg-reasons">${reasons.map(r => `<span class="pg-chip">${esc(r)}</span>`).join('')}</div>` : ''}
      <div class="pg-meta-row">
        <span>Threat likelihood: <b style="color:var(--pg-text)">${pct}%</b></span>
        ${reasons.length ? `<span class="pg-expand-hint">Details ${ICONS.chevron}</span>` : ''}
      </div>`);
    if (reasons.length) el.addEventListener('click', () => el.classList.toggle('expanded'));
    if (risk === 'High') highCount++;

    if (opts.quarantined) {
      const tag = document.createElement('div');
      tag.className = 'pg-quarantined-tag';
      tag.innerHTML = pgHtml(`<span></span>`);
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'pg-link-btn';
      restoreBtn.textContent = 'Restore';
      restoreBtn.onclick = (ev) => { ev.stopPropagation(); restoreEmail(opts.msgId); };
      tag.appendChild(restoreBtn);
      el.appendChild(tag);
      attachQuarantineTag(opts.msgId, tag);
    }

    if (urls.length) {
      const wrap = document.createElement('div');
      wrap.className = 'pg-deepscan-wrap';
      const dsBtn = document.createElement('button');
      dsBtn.className = 'pg-btn pg-deepscan-btn';
      dsBtn.innerHTML = pgHtml(`${ICONS.flask}Deep scan ${urls.length > 1 ? urls.length + ' links' : 'link'}`);
      const dsResults = document.createElement('div');
      dsResults.className = 'pg-deepscan-results';
      dsResults.hidden = true;
      dsBtn.onclick = (ev) => { ev.stopPropagation(); runDeepScan(urls, dsBtn, dsResults); };
      wrap.appendChild(dsBtn);
      wrap.appendChild(dsResults);
      el.appendChild(wrap);
    }

    return el;
  }

  async function scoreOneEmail(msg) {
    const base = await getApiBase();
    const res = await fetch(base + '/email/score', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: msg.subject || '', body: msg.body || msg.snippet || '', sender: msg.sender || '' }),
    });
    if (!res.ok) throw new Error('API error: ' + res.status);
    return res.json();
  }

  async function scoreAndHandle(msg, container, anchor) {
    try {
      const api = await scoreOneEmail(msg);
      let didQuarantine = false;
      if (api.risk === 'High' && realtimeEnabled && (msg.el || realGmailIdFor(msg))) {
        didQuarantine = quarantineEmail(msg, api);
      }
      const node = buildCard(
        { subject: msg.subject, sender: msg.sender, snippet: msg.snippet || '' },
        api,
        { quarantined: didQuarantine, msgId: msg.id }
      );
      if (anchor && anchor.isConnected) anchor.replaceWith(node); else container.appendChild(node);
      if (quarantineViewActive) applyQuarantineViewFilter();
      setBadge(highCount);
      try {
        const base = await getApiBase();
        const gmailId = realGmailIdFor(msg);
        await fetch(base + '/ingest/report', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            time: resolveReceivedAt(msg) || new Date().toISOString(),
            risk: api.risk, sender: msg.sender, subject: msg.subject,
            body_preview: api.summary, reasons: api.reasons || [],
            // Lets the "Full Report" dashboard link a row straight to the real email in
            // Gmail. Only ever set for Gmail (the only inbox we can derive a real API
            // message id for) — null elsewhere, and the dashboard just renders plain text.
            gmail_link: gmailId ? `https://mail.google.com/mail/u/0/#all/${gmailId}` : null,
            // Which inbox this came from (Gmail / Outlook / Yahoo Mail). Previously every
            // report from every mailbox landed in the same list with nothing distinguishing
            // them, so scanning both Gmail and Outlook made the Full Report look like one
            // merged, indistinguishable pile — the dashboard now shows and can filter by this.
            source: (window.PhishGuardAdapter && window.PhishGuardAdapter.siteName) || 'Unknown',
          }),
        });
      } catch (_) {}
    } catch (e) {
      const err = document.createElement('div');
      err.className = 'pg-err';
      err.textContent = 'Couldn’t reach PhishGuard API — ' + e.message + '. Check the API URL in options.';
      if (anchor && anchor.isConnected) anchor.replaceWith(err); else container.appendChild(err);
    }
  }

  async function runScan(full) {
    togglePanel(true);
    const box = document.getElementById('phishguard-results');
    box.innerHTML = '';
    highCount = 0;
    const adapter = window.PhishGuardAdapter;
    if (!adapter) {
      box.innerHTML = pgHtml(`<div class="pg-err">No adapter loaded for this site.</div>`);
      return;
    }
    let emails = [];
    if (full) {
      box.innerHTML = pgHtml(`<div class="pg-empty">Scrolling and scanning the inbox…</div>`);
      emails = await adapter.collectAllInbox(1000, n => setCount(n));
    } else {
      emails = adapter.extractVisibleEmails();
      setCount(emails.length);
    }
    box.innerHTML = '';
    document.getElementById('pg-scan-visible').classList.toggle('active', !full);
    document.getElementById('pg-scan-all').classList.toggle('active', full);
    if (!emails.length) {
      box.innerHTML = pgHtml(`<div class="pg-empty">${ICONS.empty}<div>No emails detected on screen. ${adapter.experimental ? 'This site’s support is experimental — layout may have changed.' : 'Try scrolling the inbox into view.'}</div></div>`);
      updateBar(0, 1);
      return;
    }
    emails.forEach(e => scoredIds.add(e.id));
    const batchSize = 10;
    let i = 0, cancelled = false;
    abortScan = () => { cancelled = true; };
    while (i < emails.length && !cancelled) {
      const slice = emails.slice(i, i + batchSize);
      const placeholders = slice.map(() => {
        const ph = document.createElement('div');
        ph.className = 'pg-card-loading';
        box.appendChild(ph);
        return ph;
      });
      await Promise.all(slice.map((e, idx) => scoreAndHandle(e, box, placeholders[idx])));
      i += batchSize;
      updateBar(i, emails.length);
    }
    abortScan = null;
  }

  // ---------- Full-inbox scan via the Gmail API ----------
  // Unlike runScan(), this doesn't touch the DOM at all for data collection — it asks
  // background.js to page through the Gmail API directly (chrome.identity + OAuth), which
  // has no practical cap and reaches messages the DOM scan would never scroll to. Because a
  // large inbox can take a real amount of time (Gmail's per-user API quota caps this around
  // ~300 messages/minute), results stream in and get scored one at a time via the same
  // scoreAndHandle()/buildCard() path as a normal scan, rather than waiting for the whole
  // thing to finish before showing anything.
  let apiScanBox = null;
  function runApiScan() {
    togglePanel(true);
    const box = document.getElementById('phishguard-results');
    box.innerHTML = '';
    highCount = 0;
    apiScanBox = box;
    box.innerHTML = pgHtml(`<div class="pg-empty">${ICONS.empty}<div>Signing in with Google and starting the full-inbox scan… a browser sign-in popup may appear — approve it to continue. This paces itself to Google's API limits, so a large inbox can take a while; you can leave this tab and come back, or hit Cancel any time.</div></div>`);
    setCount(0);
    updateBar(0, 1);
    abortScan = () => { chrome.runtime.sendMessage({ cmd: 'gmail_api_scan_cancel' }); };
    chrome.runtime.sendMessage({ cmd: 'gmail_api_scan_start' }, (resp) => {
      if (chrome.runtime.lastError) {
        box.innerHTML = pgHtml(`<div class="pg-err">Couldn't reach the extension background service — try reloading the page.</div>`);
        return;
      }
      if (resp && resp.ok === false) {
        const hint = resp.error === 'A scan is already running'
          ? ' If you didn\'t see a Google sign-in popup from an earlier click, it may still be waiting somewhere off-screen — check for it, or wait up to 90s and try again.'
          : '';
        box.innerHTML = pgHtml(`<div class="pg-err">${esc(resp.error || 'Could not start the scan.')}${esc(hint)}</div>`);
      }
    });
  }

  let apiScanTotal = null;
  let apiScanEmailCount = 0;
  chrome.runtime.onMessage.addListener((req) => {
    if (!apiScanBox) return;
    if (req.cmd === 'gmail_api_total') {
      apiScanTotal = req.total;
      updateBar(0, apiScanTotal || 1);
    } else if (req.cmd === 'gmail_api_email') {
      apiScanEmailCount++;
      scoredIds.add(req.email.id);
      scoreAndHandle(req.email, apiScanBox);
      setCount(apiScanEmailCount);
    } else if (req.cmd === 'gmail_api_progress') {
      updateBar(req.done, req.total || Math.max(req.done + req.remaining, 1));
    } else if (req.cmd === 'gmail_api_error') {
      const err = document.createElement('div');
      err.className = 'pg-err';
      err.textContent = req.message;
      apiScanBox.appendChild(err);
      abortScan = null;
    } else if (req.cmd === 'gmail_api_cancelled') {
      const note = document.createElement('div');
      note.className = 'pg-empty';
      note.textContent = `Stopped — ${apiScanEmailCount} emails scanned before cancelling.`;
      apiScanBox.appendChild(note);
      abortScan = null;
    } else if (req.cmd === 'gmail_api_done') {
      updateBar(1, 1);
      const note = document.createElement('div');
      note.className = 'pg-empty';
      note.textContent = `Done — scanned the full inbox (${req.total} messages).`;
      apiScanBox.appendChild(note);
      abortScan = null;
    }
  });

  ensureLauncher();
  ensurePanel();
  getRealtimeEnabled().then(v => {
    realtimeEnabled = v;
    updateRealtimeToggleUI();
    if (realtimeEnabled) startRealtimeProtection();
  });

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.cmd === 'open_panel') { togglePanel(true); sendResponse({ ok: true }); }
    if (req.cmd === 'scan_inbox') { sendResponse({ emails: window.PhishGuardAdapter ? window.PhishGuardAdapter.extractVisibleEmails() : [] }); }
  });
})();
