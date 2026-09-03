// Regression test for a real bug: Gmail's DOM sometimes signals a new/changed row (firing
// the MutationObserver real-time protection watches) before the subject text has actually
// been inserted — the sender's [email] attribute tends to land first. Scoring that row right
// away produced a blank, subject-less report with no receivedAtRaw either, which then fell
// back to "right now" as its timestamp and sorted straight to the top of the dashboard.
// scanForRealtime() in panel.js now requires a real subject before treating a row as "seen".
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
    <div class="mock-row" data-mid="p1"><span class="sender-el">no-reply@asc.edu</span></div>
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
win.fetch = async (url, opts) => {
  if (url.endsWith("/email/score")) {
    const body = JSON.parse(opts.body);
    scoreCalls.push(body);
    return {
      ok: true,
      json: async () => ({
        risk: "Low", threat_pct: 5, summary: body.subject,
        reasons: [], iocs: { urls: [], domains: [], attachments: [] },
      }),
    };
  }
  if (url.endsWith("/ingest/report")) return { ok: true, json: async () => ({ ok: true }) };
  return { ok: false, status: 404, json: async () => ({}) };
};

function readRow(row) {
  const subjEl = row.querySelector(".subj");
  return {
    id: row.dataset.mid,
    subject: subjEl ? subjEl.textContent.trim() : "",
    sender: row.querySelector(".sender-el")?.textContent || "",
    snippet: "",
    el: row,
  };
}

win.PhishGuardAdapter = {
  siteName: "Gmail",
  experimental: false,
  extractVisibleEmails: () => Array.from(win.document.querySelectorAll(".mock-row")).map(readRow),
  collectAllInbox: async () => [],
  getContainer: () => win.document.getElementById("mock-inbox"),
};

(async () => {
  const panelScript = fs.readFileSync("extension/panel.js", "utf8");
  const el = win.document.createElement("script");
  el.textContent = panelScript;
  win.document.body.appendChild(el);

  // Real-time protection's initial pass runs automatically on load.
  await wait(150);
  check("a row with no subject rendered yet was NOT scored (no blank report entry)", scoreCalls.length === 0);

  // Gmail finishes rendering: the subject element gets inserted as a new child — a real
  // childList mutation, same as what actually happens on a live inbox.
  const row = win.document.querySelector('[data-mid="p1"]');
  const subjEl = win.document.createElement("span");
  subjEl.className = "subj";
  subjEl.textContent = "Your account has been suspended";
  row.appendChild(subjEl);

  await wait(750); // MutationObserver callback is debounced 600ms in panel.js
  check("the row was picked up and scored once its subject actually rendered", scoreCalls.length === 1);
  check("the scored row carries the real subject, not a blank one",
        !!scoreCalls[0] && scoreCalls[0].subject === "Your account has been suspended");

  console.log(failures === 0 ? "\nALL PREMATURE-RENDER GUARD TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
