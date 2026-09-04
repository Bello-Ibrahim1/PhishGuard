// Tests for real-time protection, client-side quarantine (hide + undo), and the on-demand
// sandboxed "Deep scan" link button — the features added on top of the base panel.
const { JSDOM } = require("jsdom");
const fs = require("fs");

let failures = 0;
function check(label, cond) {
  console.log((cond ? "PASS " : "FAIL ") + label);
  if (!cond) failures++;
}
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

const html = `<!doctype html><html><body>
  <div id="mock-inbox">
    <div class="mock-row" data-mid="m1">Suspicious row placeholder</div>
    <div class="mock-row" data-mid="m2">Legit row placeholder</div>
  </div>
</body></html>`;
const dom = new JSDOM(html, { url: "https://mail.google.com/mail/u/0/#inbox", runScripts: "dangerously" });
const win = dom.window;

Object.defineProperty(win.HTMLElement.prototype, "innerText", {
  get() { return this.textContent.trim(); }, configurable: true,
});
function pxFromStyle(el, prop, fallback) { const v = el.style[prop]; return v ? parseInt(v, 10) : fallback; }
Object.defineProperty(win.HTMLElement.prototype, "offsetWidth", { get() { return pxFromStyle(this, "width", 384); }, configurable: true });
Object.defineProperty(win.HTMLElement.prototype, "offsetHeight", { get() { return pxFromStyle(this, "height", 560); }, configurable: true });

const storage = { apiBase: "http://fake-api.test", dashboardUrl: "http://fake-dash.test", realtimeProtection: true };
win.chrome = {
  storage: {
    sync: {
      get: (defaults, cb) => cb({ ...defaults, ...storage }),
      set: (obj, cb) => { Object.assign(storage, obj); if (cb) cb(); },
    },
  },
  runtime: { getURL: (p) => "chrome-extension://fake/" + p, onMessage: { addListener: () => {} } },
};

const scoreCalls = [];
const deepScanCalls = [];
win.fetch = async (url, opts) => {
  if (url.endsWith("/email/score")) {
    const body = JSON.parse(opts.body);
    scoreCalls.push(body);
    const isPhish = /suspended|verify/i.test(body.subject + body.body);
    return {
      ok: true,
      json: async () => ({
        risk: isPhish ? "High" : "Low",
        threat_pct: isPhish ? 96 : 2,
        summary: body.subject,
        reasons: isPhish ? ["Sender impersonates PayPal (domain does not match)"] : [],
        iocs: { urls: isPhish ? ["http://paypal-fake-login.tk/verify"] : [], domains: [], attachments: [] },
      }),
    };
  }
  if (url.endsWith("/scan/link_deepscan")) {
    const body = JSON.parse(opts.body);
    deepScanCalls.push(body.url);
    return {
      ok: true,
      json: async () => ({
        url: body.url, final_url: body.url, status_code: 200, redirect_count: 1,
        title: "PayPal - Log In", risk: "High",
        flags: ["Domain resembles Paypal but isn't its real domain", "Final page has a password field"],
      }),
    };
  }
  if (url.endsWith("/ingest/report")) return { ok: true, json: async () => ({ ok: true }) };
  return { ok: false, status: 404, json: async () => ({}) };
};

// Adapter reads real DOM rows out of the mock inbox, mirroring how a real site adapter works.
win.PhishGuardAdapter = {
  siteName: "Gmail",
  experimental: false,
  extractVisibleEmails: () => Array.from(win.document.querySelectorAll(".mock-row")).map((row) => ({
    id: row.dataset.mid,
    subject: row.dataset.subject || (row.dataset.mid === "m1" ? "Your account has been suspended" : "Team lunch Friday"),
    sender: row.dataset.mid === "m1" ? "PayPal <support@paypal-fake-login.tk>" : "Coworker <a@co.com>",
    snippet: row.dataset.mid === "m1" ? "Verify your identity now" : "Anyone free for lunch?",
    el: row,
  })),
  collectAllInbox: async () => [],
  getContainer: () => win.document.getElementById("mock-inbox"),
};

(async () => {
  const panelScript = fs.readFileSync("extension/panel.js", "utf8");
  const el = win.document.createElement("script");
  el.textContent = panelScript;
  win.document.body.appendChild(el);

  // Real-time protection runs its initial pass automatically on load (no click needed) —
  // give the chained promises (storage -> extractVisibleEmails -> fetch -> render) time to settle.
  await wait(150);

  check("real-time initial pass scored both existing rows", scoreCalls.length === 2);
  const row1 = win.document.querySelector('[data-mid="m1"]');
  const row2 = win.document.querySelector('[data-mid="m2"]');
  check("High-risk row (m1) was auto-hidden from the inbox", row1.style.display === "none");
  check("Low-risk row (m2) stays visible", row2.style.display !== "none");

  const qBar = win.document.getElementById("pg-quarantine-bar");
  check("quarantine bar becomes visible", qBar.hidden === false);
  check("quarantine bar reports 1 email", win.document.getElementById("pg-quarantine-text").textContent.includes("1 phishing email"));

  const badge = win.document.getElementById("pg-launcher-badge");
  check("launcher badge reflects quarantined count", badge.classList.contains("show") && badge.textContent === "1");

  const quarantinedTag = win.document.querySelector(".pg-quarantined-tag");
  check("quarantined card shows a 'Removed from inbox' tag", !!quarantinedTag);

  // ---- Deep scan button on the quarantined (High-risk, has a link) card ----
  const dsBtn = win.document.querySelector(".pg-deepscan-btn");
  check("deep scan button rendered for the email with a link", !!dsBtn);
  dsBtn.click();
  await wait(50);
  check("deep scan hit the sandbox endpoint with the email's link", deepScanCalls.includes("http://paypal-fake-login.tk/verify"));
  const dsResultRow = win.document.querySelector(".pg-deepscan-row");
  check("deep scan result rendered a risk pill", dsResultRow.innerHTML.includes("pg-pill high") || dsResultRow.querySelector(".pg-pill")?.textContent === "High");
  check("deep scan result shows a flag", dsResultRow.innerHTML.includes("password field"));

  // ---- Restore from the card's own Restore button ----
  const restoreBtn = quarantinedTag.querySelector(".pg-restore-btn");
  restoreBtn.click();
  check("restoring un-hides the real inbox row", row1.style.display !== "none");
  check("quarantine bar hides again once empty", win.document.getElementById("pg-quarantine-bar").hidden === true);

  // ---- Real-time protection catches a NEW row added later (simulating incoming mail) ----
  const newRow = win.document.createElement("div");
  newRow.className = "mock-row";
  newRow.dataset.mid = "m3";
  newRow.dataset.subject = "Your account has been suspended - final notice";
  win.document.getElementById("mock-inbox").appendChild(newRow);
  await wait(750); // MutationObserver callback is debounced 600ms in panel.js
  check("newly-added phishing row was auto-scored", scoreCalls.some((c) => c.subject.includes("final notice")));
  check("newly-added phishing row was auto-quarantined", newRow.style.display === "none");

  // ---- Pausing real-time protection stops auto-quarantine for further new rows ----
  const toggleBtn = win.document.getElementById("pg-realtime-toggle");
  toggleBtn.click(); // pause
  check("toggle button reflects paused state", !toggleBtn.classList.contains("active"));
  const scoredBeforePause = scoreCalls.length;
  const newRow2 = win.document.createElement("div");
  newRow2.className = "mock-row";
  newRow2.dataset.mid = "m4";
  newRow2.dataset.subject = "Your account has been suspended again";
  win.document.getElementById("mock-inbox").appendChild(newRow2);
  await wait(750);
  check("no new scoring happens while real-time protection is paused", scoreCalls.length === scoredBeforePause);
  check("row added while paused stays visible", newRow2.style.display !== "none");

  // Resume, and confirm it picks back up
  toggleBtn.click();
  await wait(200);
  check("toggle button reflects resumed state", toggleBtn.classList.contains("active"));
  await wait(750);
  check("real-time protection catches up on rows added while paused, once resumed",
        newRow2.style.display === "none" || scoreCalls.length > scoredBeforePause);

  console.log(failures === 0 ? "\nALL QUARANTINE/REALTIME TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
