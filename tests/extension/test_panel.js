const { JSDOM } = require("jsdom");
const fs = require("fs");

let failures = 0;
function check(label, cond) {
  console.log((cond ? "PASS " : "FAIL ") + label);
  if (!cond) failures++;
}

const html = `<!doctype html><html><body></body></html>`;
const dom = new JSDOM(html, { url: "https://mail.google.com/mail/u/0/#inbox", runScripts: "dangerously" });
const win = dom.window;

// innerText polyfill (test-harness only, see test_adapters.js note)
Object.defineProperty(win.HTMLElement.prototype, "innerText", {
  get() { return this.textContent.trim(); }, configurable: true,
});

// offsetWidth/offsetHeight polyfill (test-harness only): jsdom has no layout engine, so these
// always return 0 there. Real browsers compute them from actual rendering. We approximate by
// reading back whatever inline px width/height panel.js itself just set.
function pxFromStyle(el, prop, fallback) {
  const v = el.style[prop];
  return v ? parseInt(v, 10) : fallback;
}
Object.defineProperty(win.HTMLElement.prototype, "offsetWidth", {
  get() { return pxFromStyle(this, "width", 384); }, configurable: true,
});
Object.defineProperty(win.HTMLElement.prototype, "offsetHeight", {
  get() { return pxFromStyle(this, "height", 560); }, configurable: true,
});

// --- mock chrome extension APIs ---
const storage = { apiBase: "http://fake-api.test", dashboardUrl: "http://fake-dash.test", panelSize: null };
const storageSetCalls = [];
win.chrome = {
  storage: {
    sync: {
      get: (defaults, cb) => cb({ ...defaults, ...storage }),
      set: (obj, cb) => { Object.assign(storage, obj); storageSetCalls.push(obj); if (cb) cb(); },
    },
  },
  runtime: {
    getURL: (p) => "chrome-extension://fake/" + p,
    onMessage: { addListener: () => {} },
  },
};

// Synthetic pointer event (jsdom has no PointerEvent constructor — real browsers do)
function pointerEvent(type, x, y) {
  const ev = new win.Event(type, { bubbles: true, cancelable: true });
  ev.clientX = x; ev.clientY = y; ev.pointerId = 1;
  return ev;
}

// --- mock fetch: simulate the real /email/score + /ingest/report API contract ---
const scored = [];
win.fetch = async (url, opts) => {
  if (url.endsWith("/email/score")) {
    const body = JSON.parse(opts.body);
    scored.push(body);
    // Simulate a High-risk verdict for anything mentioning "suspended", Low otherwise
    const isPhish = /suspended|verify/i.test(body.subject + body.body);
    return {
      ok: true,
      json: async () => ({
        risk: isPhish ? "High" : "Low",
        threat_pct: isPhish ? 97 : 3,
        summary: body.subject + " — " + body.body.slice(0, 40),
        reasons: isPhish ? ["Sender impersonates Paypal (domain does not match)", "Phishing wording: «suspended»"] : [],
      }),
    };
  }
  if (url.endsWith("/ingest/report")) return { ok: true, json: async () => ({ ok: true }) };
  return { ok: false, status: 404, json: async () => ({}) };
};

// --- fake adapter: 3 emails, one clearly phishy ---
win.PhishGuardAdapter = {
  siteName: "Gmail",
  experimental: false,
  extractVisibleEmails: () => ([
    { id: "1", subject: "Your account has been suspended", sender: "PayPal <support@paypal-verify.tk>", snippet: "Verify your identity now" },
    { id: "2", subject: "Team lunch Friday", sender: "Coworker <a@co.com>", snippet: "Anyone free for lunch?" },
    { id: "3", subject: "Your receipt", sender: "PayPal <service@paypal.com>", snippet: "You paid $12.00" },
  ]),
  collectAllInbox: async () => [],
};

(async () => {
  const panelScript = fs.readFileSync("extension/panel.js", "utf8");
  const el = win.document.createElement("script");
  el.textContent = panelScript;
  win.document.body.appendChild(el);

  // Launcher should exist immediately (panel.js calls ensureLauncher() at load).
  // The panel DOM is now ALSO built eagerly at load (not lazily on first click) so that
  // real-time protection has a results container to render into even before the user opens
  // the panel — but it stays hidden until the launcher is actually clicked.
  check("launcher exists on load", !!win.document.getElementById("phishguard-launcher"));
  check("panel pre-built but hidden before first open", !!win.document.getElementById("phishguard-panel") && win.document.getElementById("phishguard-panel").hidden === true);

  // Open the panel via the same message path popup.html uses
  let responded = null;
  const listeners = [];
  // panel.js already registered its onMessage listener via our mock (no-op) — call runScan directly instead
  win.document.getElementById("phishguard-launcher").click();
  check("panel exists after launcher click", !!win.document.getElementById("phishguard-panel"));
  check("panel visible after launcher click", win.document.getElementById("phishguard-panel").hidden === false);

  // Run a visible-scan
  win.document.getElementById("pg-scan-visible").click();
  await new Promise((r) => setTimeout(r, 50)); // let the async scan settle

  const cards = win.document.querySelectorAll("#phishguard-results .pg-card");
  check("3 emails scored -> 3 API calls", scored.length === 3);
  check("3 cards rendered", cards.length === 3);

  const pills = Array.from(cards).map((c) => c.querySelector(".pg-pill").textContent.trim());
  check("first card is High risk", pills[0] === "High");
  check("second card is Low risk", pills[1] === "Low");
  check("card risk classes applied correctly", cards[0].querySelector(".pg-pill").classList.contains("high"));

  // Badge should show 1 (one High-risk email)
  const badge = win.document.getElementById("pg-launcher-badge");
  check("badge shows count for High-risk emails", badge.textContent === "1" && badge.classList.contains("show"));

  // Card with reasons should expand on click
  const highCard = cards[0];
  check("high-risk card has reasons chips", highCard.querySelectorAll(".pg-chip").length === 2);
  check("card starts collapsed", !highCard.classList.contains("expanded"));
  highCard.click();
  check("card expands on click", highCard.classList.contains("expanded"));
  highCard.click();
  check("card collapses on second click", !highCard.classList.contains("expanded"));

  // Low-risk card with zero reasons should have no chips section and not be clickable-expandable
  const lowCard = cards[1];
  check("low-risk card (no reasons) has no chips", lowCard.querySelectorAll(".pg-chip").length === 0);

  // Clear button resets state
  win.document.getElementById("pg-clear").click();
  check("clear empties results", win.document.querySelectorAll("#phishguard-results .pg-card").length === 0);
  check("clear resets badge", !win.document.getElementById("pg-launcher-badge").classList.contains("show"));

  // --- Resize handle ---
  const panel = win.document.getElementById("phishguard-panel");
  const handle = win.document.getElementById("pg-resize-handle");
  check("resize handle exists", !!handle);
  // No saved size yet, so panel.js hasn't set an inline style — it's relying on the CSS
  // default (384x560, see overlay.css). offsetWidth/offsetHeight falls back to that same
  // default in our polyfill, mirroring what a real browser would compute from the CSS.
  check("panel starts at default size (no inline style yet, CSS default applies)", panel.style.width === "" && panel.offsetWidth === 384 && panel.offsetHeight === 560);

  // Drag the (top-left) handle up and to the left by 40px each way -> panel should GROW by 40px each dim
  handle.dispatchEvent(pointerEvent("pointerdown", 500, 500));
  handle.dispatchEvent(pointerEvent("pointermove", 460, 460));
  handle.dispatchEvent(pointerEvent("pointerup", 460, 460));
  check("dragging handle up-left grows width", panel.style.width === "424px");
  check("dragging handle up-left grows height", panel.style.height === "600px");
  check("resized dimensions were persisted via chrome.storage.sync.set", storageSetCalls.some(c => c.panelSize && c.panelSize.w === 424 && c.panelSize.h === 600));

  // Dragging far past the max should clamp rather than grow unbounded
  handle.dispatchEvent(pointerEvent("pointerdown", 500, 500));
  handle.dispatchEvent(pointerEvent("pointermove", -5000, -5000));
  handle.dispatchEvent(pointerEvent("pointerup", -5000, -5000));
  const clampedW = parseInt(panel.style.width, 10);
  const clampedH = parseInt(panel.style.height, 10);
  check("width clamps to a sane max instead of growing unbounded", clampedW <= 680);
  check("height clamps to a sane max instead of growing unbounded", clampedH <= 860);

  // Dragging far past the min should clamp rather than shrink to nothing
  handle.dispatchEvent(pointerEvent("pointerdown", 500, 500));
  handle.dispatchEvent(pointerEvent("pointermove", 5000, 5000));
  handle.dispatchEvent(pointerEvent("pointerup", 5000, 5000));
  check("width clamps to a sane min", parseInt(panel.style.width, 10) === 320);
  check("height clamps to a sane min", parseInt(panel.style.height, 10) === 340);

  // Double-click resets to the default preset
  handle.dispatchEvent(new win.Event("dblclick", { bubbles: true }));
  check("double-click resets to default width", panel.style.width === "384px");
  check("double-click resets to default height", panel.style.height === "560px");

  // Size-cycle button steps through Compact -> Large -> Compact presets
  const cycleBtn = win.document.getElementById("pg-size-cycle");
  check("size-cycle button exists", !!cycleBtn);
  cycleBtn.click();
  check("cycle button moves to Large preset", panel.style.width === "480px" && panel.style.height === "700px");
  cycleBtn.click();
  check("cycle button wraps to Compact preset", panel.style.width === "340px" && panel.style.height === "420px");

  // Close button hides panel without removing it
  win.document.getElementById("pg-close").click();
  check("close hides panel", win.document.getElementById("phishguard-panel").hidden === true);

  console.log(failures === 0 ? "\nALL PANEL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
