// Regression test for a real bug: "Scan visible" scores its batch of visible emails
// concurrently, and each one used to append its own card to the results list the instant
// its own /email/score request resolved — so with real network requests inevitably
// finishing in an unpredictable order, the exact same visible inbox could print in a
// different card order every time you clicked "Scan visible". runScan()/scoreAndHandle()
// in panel.js now reserve each card's position with a placeholder before firing the
// (still-concurrent) requests, so the final order always matches the scanned order,
// regardless of which request happens to come back first.
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
    <div class="mock-row" data-mid="a">A</div>
    <div class="mock-row" data-mid="b">B</div>
    <div class="mock-row" data-mid="c">C</div>
    <div class="mock-row" data-mid="d">D</div>
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

const storage = { apiBase: "http://fake-api.test", dashboardUrl: "http://fake-dash.test", realtimeProtection: false };
win.chrome = {
  storage: {
    sync: {
      get: (defaults, cb) => cb({ ...defaults, ...storage }),
      set: (obj, cb) => { Object.assign(storage, obj); if (cb) cb(); },
    },
  },
  runtime: { getURL: (p) => "chrome-extension://fake/" + p, onMessage: { addListener: () => {} } },
};

// Emails are listed A, B, C, D — but their /email/score responses are deliberately made to
// resolve in the OPPOSITE order (D fastest, A slowest), the same way real network requests
// finish in whatever order they happen to, not the order they were sent in.
const DELAY_MS = { A: 80, B: 55, C: 30, D: 5 };
win.fetch = async (url, opts) => {
  if (url.endsWith("/email/score")) {
    const body = JSON.parse(opts.body);
    await wait(DELAY_MS[body.subject] ?? 10);
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

win.PhishGuardAdapter = {
  siteName: "Gmail",
  experimental: false,
  extractVisibleEmails: () => ["A", "B", "C", "D"].map((subject) => ({
    id: subject, subject, sender: `${subject.toLowerCase()}@example.com`, snippet: "",
    el: win.document.querySelector(`[data-mid="${subject.toLowerCase()}"]`),
  })),
  collectAllInbox: async () => [],
  getContainer: () => win.document.getElementById("mock-inbox"),
};

(async () => {
  const panelScript = fs.readFileSync("extension/panel.js", "utf8");
  const el = win.document.createElement("script");
  el.textContent = panelScript;
  win.document.body.appendChild(el);
  await wait(50);

  // Placeholder creation is entirely synchronous (it happens before the batch's first
  // `await`), so all 4 exist the instant .click() returns — checking any later risks the
  // fastest mocked request (D, 5ms) already resolving and replacing its own placeholder.
  win.document.getElementById("pg-scan-visible").click();

  const box = win.document.getElementById("phishguard-results");
  const placeholderCount = box.querySelectorAll(".pg-card-loading").length;
  check("all 4 placeholders reserved up front, in order, before any score resolved", placeholderCount === 4);

  await wait(150); // longest delay (A, 80ms) plus margin

  const cardTitles = Array.from(box.querySelectorAll(".pg-card .pg-title")).map((t) => t.textContent);
  check("no loading placeholders left once everything resolved", box.querySelectorAll(".pg-card-loading").length === 0);
  check("cards printed in the scanned order (A, B, C, D), not network-completion order (D, C, B, A)",
        JSON.stringify(cardTitles) === JSON.stringify(["A", "B", "C", "D"]));

  console.log(failures === 0 ? "\nALL SCAN-VISIBLE ORDERING TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
