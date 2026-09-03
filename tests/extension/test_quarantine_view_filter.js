// Regression/feature test for the "View quarantined" toggle: a button in the quarantine bar
// that filters the results list down to only the currently-quarantined cards. Deliberately
// runs on the Outlook adapter (not Gmail) to prove the toggle is adapter-agnostic — it works
// off each card's .pg-quarantined-tag, not any Gmail-specific id/label state, so it covers
// Outlook (hidden-only quarantine, no server-side label) exactly the same way it covers Gmail.
// Also checks that the Gmail-only "Open in Gmail" quarantine-label deep link stays hidden on
// Outlook, and that clicking "Clear" resets the toggle.
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
    <div class="mock-row" data-mid="l1"><span class="subj">Low risk newsletter</span></div>
    <div class="mock-row" data-mid="l2"><span class="subj">Low risk receipt</span></div>
  </div>
</body></html>`;
const dom = new JSDOM(html, { url: "https://outlook.live.com/mail/0/inbox", runScripts: "dangerously" });
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
  runtime: {
    getURL: (p) => "chrome-extension://fake/" + p,
    onMessage: { addListener: () => {} },
    lastError: null,
    sendMessage: (msg, cb) => { if (cb) setTimeout(() => cb({ ok: true }), 0); },
  },
};

win.fetch = async (url, opts) => {
  if (url.endsWith("/email/score")) {
    const body = JSON.parse(opts.body);
    const risk = /high risk/i.test(body.subject) ? "High" : "Low";
    return {
      ok: true,
      json: async () => ({
        risk, threat_pct: risk === "High" ? 95 : 4, summary: body.subject,
        reasons: risk === "High" ? ["Urgent account suspension language"] : [],
        iocs: { urls: [], domains: [], attachments: [] },
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
    sender: "someone@example.com",
    snippet: "",
    el: row,
  };
}

win.PhishGuardAdapter = {
  siteName: "Outlook",
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

  // Initial real-time pass scores both Low-risk rows; neither gets quarantined.
  await wait(150);
  const box = win.document.getElementById("phishguard-results");
  check("both Low-risk rows rendered as cards", box.querySelectorAll(".pg-card").length === 2);
  check("quarantine bar stays hidden — nothing quarantined yet",
        win.document.getElementById("pg-quarantine-bar").hidden === true);

  const gmailLink = win.document.getElementById("pg-view-quarantined-gmail");
  check("the Gmail-only 'Open in Gmail' quarantine link stays hidden on Outlook", gmailLink.hidden === true);

  // ---- Toggle "View quarantined" on with nothing quarantined yet: everything hides, a note explains why ----
  const toggleBtn = win.document.getElementById("pg-view-quarantined");
  toggleBtn.click();
  check("toggle label switches to 'Show all'", toggleBtn.textContent === "Show all");
  check("toggle button gets the active style hook", toggleBtn.classList.contains("active"));
  const cardsAfterToggleOn = box.querySelectorAll(".pg-card");
  check("both (non-quarantined) cards are hidden by the filter",
        Array.from(cardsAfterToggleOn).every((c) => c.style.display === "none"));
  check("a note explains none of the visible emails are quarantined",
        !!box.querySelector(".pg-quarantine-filter-note"));

  // ---- A new High-risk row arrives (real-time protection, same as an inbox mutation) — it
  // gets quarantined, and because the filter is active, its card must appear immediately and
  // the "nothing quarantined" note must clear, without the user needing to re-click the toggle. ----
  const inbox = win.document.getElementById("mock-inbox");
  const row = win.document.createElement("div");
  row.className = "mock-row";
  row.dataset.mid = "h1";
  const subjEl = win.document.createElement("span");
  subjEl.className = "subj";
  subjEl.textContent = "High risk: your account will be suspended";
  row.appendChild(subjEl);
  inbox.appendChild(row);

  await wait(750); // MutationObserver debounce (600ms) + margin

  check("the new email was quarantined (hidden-only — Outlook has no Gmail label)", row.style.display === "none");
  check("quarantine bar now shows 1 quarantined", win.document.getElementById("pg-quarantine-text").textContent.startsWith("1 "));
  check("the note is gone now that a quarantined card exists", !box.querySelector(".pg-quarantine-filter-note"));
  const quarantinedCard = Array.from(box.querySelectorAll(".pg-card")).find((c) => c.querySelector(".pg-quarantined-tag"));
  check("the newly-quarantined card is visible even though the filter is still active",
        !!quarantinedCard && quarantinedCard.style.display !== "none");
  check("the two originally Low-risk cards are still hidden by the filter",
        Array.from(box.querySelectorAll(".pg-card")).filter((c) => !c.querySelector(".pg-quarantined-tag"))
          .every((c) => c.style.display === "none"));

  // ---- Toggling back off reveals everything again ----
  toggleBtn.click();
  check("toggle label switches back to 'View quarantined'", toggleBtn.textContent === "View quarantined");
  check("all cards visible again once the filter is off",
        Array.from(box.querySelectorAll(".pg-card")).every((c) => c.style.display !== "none"));

  // ---- Clicking "Clear" resets the toggle, so a later scan doesn't stay silently filtered ----
  toggleBtn.click(); // back on
  check("toggle re-armed before testing Clear", toggleBtn.textContent === "Show all");
  win.document.getElementById("pg-clear").click();
  check("Clear turns the filter back off", toggleBtn.textContent === "View quarantined");
  check("Clear also drops the active style", !toggleBtn.classList.contains("active"));

  console.log(failures === 0 ? "\nALL VIEW-QUARANTINED FILTER TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
