const { JSDOM } = require("jsdom");
const fs = require("fs");

function loadAdapter(dom, path) {
  // jsdom doesn't implement innerText (it's layout-dependent; jsdom has no renderer).
  // Real browsers (Chrome/Firefox/Edge, where this extension actually runs) support it
  // natively — this polyfill exists only so the test harness can approximate that.
  const proto = dom.window.HTMLElement.prototype;
  if (!Object.getOwnPropertyDescriptor(proto, "innerText")) {
    Object.defineProperty(proto, "innerText", {
      get() { return this.textContent.trim(); },
      configurable: true,
    });
  }
  const script = fs.readFileSync(path, "utf8");
  const el = dom.window.document.createElement("script");
  el.textContent = script;
  dom.window.document.body.appendChild(el);
  return dom.window.PhishGuardAdapter;
}

let failures = 0;
function check(label, cond) {
  console.log((cond ? "PASS " : "FAIL ") + label);
  if (!cond) failures++;
}

// ---------- Gmail fixture (real class names from the shipped adapter) ----------
{
  const html = `<!doctype html><html><body>
    <table>
      <tr class="zA yO" data-legacy-message-id="msg1">
        <td class="yX xY"><span class="yP" email="attacker@phish-example.com">Attacker Name</span></td>
        <td><span class="bog">Your account has been suspended</span></td>
        <td><span class="y2">Verify your identity immediately or lose access...</span></td>
      </tr>
      <tr class="zA zE" data-legacy-message-id="msg2">
        <td class="yX xY"><span class="yP" email="service@paypal.com">PayPal</span></td>
        <td><span class="bog">You sent a payment</span></td>
        <td><span class="y2">You sent $45.00 to Joe's Coffee...</span></td>
      </tr>
    </table>
  </body></html>`;
  const dom = new JSDOM(html, { url: "https://mail.google.com/mail/u/0/#inbox", runScripts: "dangerously" });
  const adapter = loadAdapter(dom, "extension/adapters/gmail.js");
  const rows = adapter.extractVisibleEmails();
  check("gmail: siteName", adapter.siteName === "Gmail");
  check("gmail: found 2 rows", rows.length === 2);
  check("gmail: row1 subject", rows[0].subject === "Your account has been suspended");
  check("gmail: row1 sender is email attr", rows[0].sender === "attacker@phish-example.com");
  check("gmail: row2 sender", rows[1].sender === "service@paypal.com");
  check("gmail: row1 snippet", rows[0].snippet.includes("Verify your identity"));
}

// ---------- Outlook Web fixture: REAL structure, captured live 2026-09-02 ----------
// This mirrors the actual outlook.live.com DOM found during live browser testing: hashed
// Fluent UI classes with no semantic names, an avatar with role="img" whose aria-label is
// the sender, and a timestamp element with a dated `title` immediately after the subject.
// The row's own aria-label is realistic too (NOT clean "Sender. Subject." — periods appear
// inside the email address and mid-sentence), to guard against ever trusting that split again.
{
  const html = `<!doctype html><html><body>
    <div role="listbox">
      <div role="option" id="conv1" aria-label="Unread idowu.bello@myyahoo.com Your account has been suspended - action required 12:28 AM Dear customer, we detected unusual sign-in activity...">
        <span role="img" aria-label="idowu.bello@myyahoo.com" class="fui-Avatar-hash1">I</span>
        <div class="hashXYZ">
          <span class="TtcXM">Your account has been suspended - action required</span>
          <span class="qq2gS" title="Wed 9/2/2026 12:28 AM">12:28 AM</span>
        </div>
        <span class="ASFJj">Dear customer, we detected unusual sign-in activity on your account. Verify your identity within 24 hours...</span>
      </div>
      <div role="option" id="conv2" aria-label="Unread Microsoft account team Microsoft account security info verification 12:17 AM Microsoft account Thanks for verifying your security info...">
        <span role="img" aria-label="Microsoft account team" class="fui-Avatar-hash2">M</span>
        <div class="hashXYZ">
          <span class="TtcXM">Microsoft account security info verification</span>
          <span class="qq2gS" title="Wed 9/2/2026 12:17 AM">12:17 AM</span>
        </div>
        <span class="ASFJj">Microsoft account Thanks for verifying your security info. Recently, you verified the security info...</span>
      </div>
      <div role="option" aria-label="Folders">not a message row</div>
    </div>
  </body></html>`;
  const dom = new JSDOM(html, { url: "https://outlook.live.com/mail/inbox", runScripts: "dangerously" });
  const adapter = loadAdapter(dom, "extension/adapters/outlook.js");
  const rows = adapter.extractVisibleEmails();
  check("outlook: siteName", adapter.siteName === "Outlook");
  check("outlook: experimental flag set", adapter.experimental === true);
  check("outlook: found 2 message rows (folder row excluded)", rows.length === 2);
  check("outlook: row1 sender via avatar aria-label", rows[0].sender === "idowu.bello@myyahoo.com");
  check("outlook: row1 subject via pre-timestamp sibling", rows[0].subject === "Your account has been suspended - action required");
  check("outlook: row1 snippet", rows[0].snippet.includes("unusual sign-in activity"));
  check("outlook: row2 sender via avatar aria-label", rows[1].sender === "Microsoft account team");
  check("outlook: row2 subject via pre-timestamp sibling", rows[1].subject === "Microsoft account security info verification");
}

// ---------- Outlook Web fallback fixture: structural hooks absent, old markup shape ----------
{
  const html = `<!doctype html><html><body>
    <div role="listbox">
      <div role="option" id="conv1" aria-label="Microsoft Security. Unusual sign-in activity. We noticed a new sign-in to your account. 9:41 AM">
        <span class="ms-subjectPart-abc123">Unusual sign-in activity</span>
      </div>
      <div role="option" id="conv2" aria-label="Jamie Lee. Notes from standup. Quick recap of today's standup meeting notes. 8:12 AM">
        <span class="ms-subjectPart-def456">Notes from standup</span>
      </div>
    </div>
  </body></html>`;
  const dom = new JSDOM(html, { url: "https://outlook.office.com/mail/inbox", runScripts: "dangerously" });
  const adapter = loadAdapter(dom, "extension/adapters/outlook.js");
  const rows = adapter.extractVisibleEmails();
  check("outlook fallback: found 2 rows with no structural hooks present", rows.length === 2);
  check("outlook fallback: row1 sender parsed from aria-label", rows[0].sender === "Microsoft Security");
  check("outlook fallback: row1 subject parsed from aria-label", rows[0].subject === "Unusual sign-in activity");
}

// ---------- Yahoo Mail fixture: REAL structure, captured live 2026-09-02 ----------
// Mirrors the actual mail.yahoo.com DOM: row matches data-test-id="message-list-item" (that
// guess was right), but sender/subject/snippet live in per-row ids ("email-sender-00_1" etc),
// not the data-test-id hooks originally guessed. Includes the sr-only "email-subject-snippet-*"
// trap span that must be excluded, or subject parsing silently grabs the wrong element.
{
  const html = `<!doctype html><html><body>
    <div>
      <div data-test-id="message-list-item" data-test-mid="y1">
        <div id="email-sender-00_1" title="service@paypal-verify.tk">PayPal</div>
        <span class="sr-only" id="email-subject-snippet-00_1">Your payment was declined·We were unable to charge…</span>
        <div id="email-subject-00_1" title="Your payment was declined">Your payment was declined</div>
        <div id="email-snippet-00_1">We were unable to charge your card on file...</div>
      </div>
      <div data-test-id="message-list-item" data-test-mid="y2">
        <div id="email-sender-00_2" title="mom@family.example">Mom</div>
        <span class="sr-only" id="email-subject-snippet-00_2">Dinner Sunday?·Are you free this Sunday…</span>
        <div id="email-subject-00_2" title="Dinner Sunday?">Dinner Sunday?</div>
        <div id="email-snippet-00_2">Are you free this Sunday for dinner...</div>
      </div>
    </div>
  </body></html>`;
  const dom = new JSDOM(html, { url: "https://mail.yahoo.com/d/folders/1", runScripts: "dangerously" });
  const adapter = loadAdapter(dom, "extension/adapters/yahoo.js");
  const rows = adapter.extractVisibleEmails();
  check("yahoo: siteName", adapter.siteName === "Yahoo Mail");
  check("yahoo: found 2 rows", rows.length === 2);
  check("yahoo: row1 subject (sr-only trap correctly excluded)", rows[0].subject === "Your payment was declined");
  check("yahoo: row1 sender", rows[0].sender === "PayPal");
  check("yahoo: row1 snippet", rows[0].snippet === "We were unable to charge your card on file...");
  check("yahoo: row2 subject", rows[1].subject === "Dinner Sunday?");
}

// ---------- Yahoo Mail fallback fixture: data-test-id field hooks (pre-fix guess) ----------
{
  const html = `<!doctype html><html><body>
    <div>
      <div data-test-id="message-list-item" data-test-mid="y1">
        <span data-test-id="sender-name">Netflix</span>
        <span data-test-id="subject">Your payment was declined</span>
        <span data-test-id="message-snippet">We were unable to charge your card on file...</span>
      </div>
    </div>
  </body></html>`;
  const dom = new JSDOM(html, { url: "https://mail.yahoo.com/d/folders/1", runScripts: "dangerously" });
  const adapter = loadAdapter(dom, "extension/adapters/yahoo.js");
  const rows = adapter.extractVisibleEmails();
  check("yahoo fallback: row1 subject via data-test-id", rows[0].subject === "Your payment was declined");
  check("yahoo fallback: row1 sender via data-test-id", rows[0].sender === "Netflix");

  // Second fallback: data-test-id changed to a generic class-based structure
  const html2 = `<!doctype html><html><body>
    <div role="row" data-test-id="row-generic">
      <span class="SenderName-x">Delta Air Lines</span>
      <span class="SubjectLine-y">Check-in now open</span>
      <span class="PreviewText-z">Check-in is now open for your flight...</span>
    </div>
  </body></html>`;
  const dom2 = new JSDOM(html2, { url: "https://mail.yahoo.com/d/folders/1", runScripts: "dangerously" });
  const adapter2 = loadAdapter(dom2, "extension/adapters/yahoo.js");
  const rows2 = adapter2.extractVisibleEmails();
  check("yahoo fallback: row detected via role=row", rows2.length === 1);
  check("yahoo fallback: subject via class*=subject", rows2[0].subject === "Check-in now open");
}

console.log(failures === 0 ? "\nALL ADAPTER TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
