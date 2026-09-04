// Tests for the real Gmail-label quarantine path added on top of the client-side hide:
// converting a DOM row's data-legacy-message-id into the Gmail API's hex message id,
// messaging background.js to actually apply/remove the "PhishGuard/Quarantine" label, and
// quarantining an email that has no DOM row at all (the full-inbox API scan shape).
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
    <div class="mock-row" data-mid="r1">DOM row with a real legacy id</div>
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

// Records every message sent to "background.js" and lets the test script control the response.
const sentMessages = [];
let respondWithOk = true;
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
    sendMessage: (msg, cb) => {
      sentMessages.push(msg);
      if (cb) setTimeout(() => cb({ ok: respondWithOk, error: respondWithOk ? undefined : "simulated failure" }), 0);
    },
  },
};

const scoreCalls = [];
win.fetch = async (url, opts) => {
  if (url.endsWith("/email/score")) {
    const body = JSON.parse(opts.body);
    scoreCalls.push(body);
    return {
      ok: true,
      json: async () => ({
        risk: "High", threat_pct: 96, summary: body.subject,
        reasons: ["Sender impersonates PayPal (domain does not match)"],
        iocs: { urls: [], domains: [], attachments: [] },
      }),
    };
  }
  if (url.endsWith("/ingest/report")) return { ok: true, json: async () => ({ ok: true }) };
  return { ok: false, status: 404, json: async () => ({}) };
};

// r1: a normal DOM row where Gmail happened to expose data-legacy-message-id (decimal) — the
//     adapter surfaces this as `legacyId`; PhishGuard should convert it to the API's hex id.
// r2: no DOM row at all (`el` omitted) but a real `gmailId` already present — the shape emitted
//     by background.js's full-inbox API scan. Quarantine should still succeed (label-only).
const LEGACY_DECIMAL = "1234567890123456"; // arbitrary large decimal, exceeds Number safe range
const EXPECTED_HEX = BigInt(LEGACY_DECIMAL).toString(16);

win.PhishGuardAdapter = {
  siteName: "Gmail",
  experimental: false,
  extractVisibleEmails: () => {
    const row1 = win.document.querySelector('[data-mid="r1"]');
    return [
      {
        id: "r1", subject: "Your account has been suspended",
        sender: "PayPal <support@paypal-fake-login.tk>", snippet: "Verify your identity now",
        el: row1, legacyId: LEGACY_DECIMAL,
      },
      {
        id: "r2", subject: "Your account has been suspended (API scan copy)",
        sender: "PayPal <support@paypal-fake-login2.tk>", snippet: "Verify your identity now",
        gmailId: "18d4a2b3c1e5f6a7", // no `el` — mirrors background.js's full-scan email shape
      },
    ];
  },
  collectAllInbox: async () => [],
  getContainer: () => win.document.getElementById("mock-inbox"),
};

(async () => {
  const panelScript = fs.readFileSync("extension/panel.js", "utf8");
  const el = win.document.createElement("script");
  el.textContent = panelScript;
  win.document.body.appendChild(el);

  await wait(150);

  check("both emails were scored", scoreCalls.length === 2);

  const row1 = win.document.querySelector('[data-mid="r1"]');
  check("r1's real DOM row was hidden", row1.style.display === "none");

  const labelCalls = sentMessages.filter((m) => m.cmd === "gmail_label_quarantine");
  check("exactly 2 label-quarantine requests were sent (one per email, DOM or not)", labelCalls.length === 2);
  check("r1's legacy decimal id was converted to the correct hex Gmail API id",
        labelCalls.some((m) => m.msgId === EXPECTED_HEX));
  check("r2's already-real gmailId was passed through unchanged (no re-derivation)",
        labelCalls.some((m) => m.msgId === "18d4a2b3c1e5f6a7"));

  const tags = win.document.querySelectorAll(".pg-quarantined-tag");
  check("both High-risk emails got a quarantine tag, including the one with no DOM row", tags.length === 2);

  await wait(20); // let the queued sendMessage callbacks (setTimeout 0) resolve and re-render tags

  const tagTexts = Array.from(tags).map((t) => t.querySelector("span").textContent);
  check("r1 (hidden + labeled) shows the combined state", tagTexts.some((t) => t.includes("Hidden + labeled")));
  check("r2 (labeled only, no DOM row to hide) shows the label-only state",
        tagTexts.some((t) => t.includes("Labeled in Gmail") && t.includes("kept in inbox")));

  const qBar = win.document.getElementById("pg-quarantine-text");
  check("quarantine bar counts both (label-only counts too)", qBar.textContent.startsWith("2 phishing emails"));

  // ---- Restore sends gmail_label_restore with the right id and un-hides the DOM row ----
  const restoreBtn = tags[0].querySelector(".pg-restore-btn");
  restoreBtn.click();
  await wait(20);
  const restoreCalls = sentMessages.filter((m) => m.cmd === "gmail_label_restore");
  check("restoring r1 sent a gmail_label_restore with its hex id", restoreCalls.some((m) => m.msgId === EXPECTED_HEX));
  check("restoring r1 un-hid its real DOM row", row1.style.display !== "none");

  console.log(failures === 0 ? "\nALL GMAIL LABEL QUARANTINE TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
