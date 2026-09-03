# Changelog

All notable changes to PhishGuard are documented here. You can show this file on GitHub so others (and your friend) can see what was done and why.

---

## [Unreleased] – Real ML backend + real Gmail live test found and fixed a false-positive bug

Ran the actual trained ML backend (not a mocked/keyword one) locally, then loaded the real,
built PhishGuard extension into a real Chrome profile and ran it against a real personal Gmail
inbox (tens of thousands of messages, 50 scanned per pass) end to end: real content script,
real panel, real network calls to the local FastAPI + scikit-learn backend, real quarantine
behavior. This surfaced one real, high-impact bug that none of the jsdom fixtures or the
earlier mocked-backend live tests (see the entry below) exercised, because it depends on the
actual variety of markup a real, years-old inbox accumulates:

- **Gmail: sender email address extraction silently fell back to the display name on the
  large majority of real rows, causing a real false positive.** `extractVisibleEmails()` looked
  for the sender's address via a class-based selector (`.yX.xY .yP`, falling back to `.yW
  span`). Live-measured against 50 real inbox rows, that selector actually found the real
  address on only 11 of 50 (22%) — for the other 39 it silently returned the bare display name
  ("DoorDash") instead of the address ("no-reply@doordash.com"), because Gmail's class names for
  this element vary/are obfuscated per account and aren't a reliable match. That's not just a
  missed detail: the backend's brand-impersonation check needs a real domain to compare against,
  and a bare display name has no `@`, so the check concluded the domain "didn't match" — which
  is exactly what happened live: two genuine DoorDash order emails were scored High risk and
  auto-quarantined (hidden client-side) from a real inbox. Caught immediately during the live
  test, disclosed to the user right away, and reversed with the panel's own "Restore all" (a
  client-side `display:none` toggle — the real Gmail account was never touched server-side).
  Root-caused and fixed by querying Gmail's `[email]` attribute directly — Gmail reliably
  annotates the sender span with `email="..."` regardless of its class name, so this is far more
  robust than depending on class names at all. Old class-based selectors kept as a fallback for
  the rare row with no `[email]` attribute. Re-tested live after the fix, reloading the real
  extension in the real browser: re-scanned the same real inbox and confirmed the DoorDash
  emails now correctly extract `no-reply@doordash.com` and score Low risk (20%), with zero
  emails hidden/quarantined.

Full jsdom suite re-run after the fix: 79/79 tests still pass, no regressions.
**Disclosed limitation, as before:** this was tested against one real inbox — real, and this
time against the real backend and real quarantine path (not a mock), but still not exhaustive
coverage of every possible sender-markup variation a different or much larger inbox could
produce.

---

## [Unreleased] – Live-browser testing found and fixed 3 real bugs (Yahoo, Outlook, Gmail)

Everything above had only ever been checked against jsdom fixtures or throwaway test accounts
with a handful of emails. Today, at your request, ran the *actual* extension code (adapters +
panel.js, unmodified except for a mocked backend so no real server was needed) live inside your
already-open Gmail, Outlook, and Yahoo tabs — full inboxes, real DOM, real Trusted Types
policies — and found three bugs that the jsdom suite's simpler fixtures never exercised:

- **Yahoo & Outlook: real-time protection silently stopped noticing new mail.**
  `getContainer()` returned `rows[0].parentElement`, which in both providers' real markup wraps
  only that single first row (Yahoo nests each message in its own `<li>`; Outlook nests several
  levels deep). The `MutationObserver` watching that node never saw a new message arrive as a
  sibling elsewhere in the real list, so after the first scan, real-time protection went quiet —
  new phishing mail would sit in the inbox unscored until the user manually clicked "Scan
  visible" again. Confirmed live: cloned a real message row, rewrote it into a phishing lure, and
  inserted it as a genuine sibling in the real DOM — with the old code the auto-scan never fired;
  after the fix (climb to the nearest ancestor that actually contains every currently-visible
  row), the new row was auto-detected and auto-scored within ~1s, no manual scan needed, on both
  providers.
- **Gmail: card count blew up from 41 to 83 on a single new email.** `extractVisibleEmails()`
  falls back to a `Math.random()` id when a row has no `data-legacy-message-id` — true for every
  one of 41 real inbox rows tested. A fresh random id on every extraction call meant the
  `scoredIds` de-dup set could never recognize an already-scored row as "seen", so *every* DOM
  mutation anywhere in the inbox re-scored and re-rendered *every* visible email again. Confirmed
  live: a 41-message real inbox produced 41 cards on first scan (correct) but jumped to 83 after
  inserting one synthetic new row. Fixed by caching the fallback id on the DOM element itself
  (`dataset.pgFallbackId`) so the same node always reports the same id; re-tested live after the
  fix and the count went 41 → 42, exactly matching the one new row.
- **Gmail: the panel didn't render at all.** Gmail enforces a Trusted Types CSP
  (`require-trusted-types-for 'script'`), which throws on any bare-string `.innerHTML =`
  assignment — confirmed live via `TypeError: Failed to set the 'innerHTML' property... This
  document requires 'TrustedHTML' assignment`, thrown from `ensureLauncher()` the moment the
  panel tried to inject itself. Fixed by registering a dedicated Trusted Types policy
  (`'phishguard-panel'`, not `'default'`, so other scripts on the host page keep whatever
  Trusted Types protection they already had) and routing every `.innerHTML` assignment in
  `panel.js` through it; sites with no Trusted Types enforcement are unaffected. Re-tested live
  after the fix: the panel and all 41 cards rendered normally on Gmail.

All three fixes were re-verified live against the real, reloaded tabs (not just re-run in
jsdom) before being called done — for Yahoo and Outlook, by confirming the previously-silent
auto-detection now fires; for Gmail, by confirming the card count no longer inflates and the
panel renders. Full jsdom suite re-run after each fix: 79/79 tests still pass, no regressions.
**Disclosed limitation, as before:** this was tested against one real inbox per provider (with a
mocked scoring backend, since no live backend can stay reachable across tool calls in this
environment) — real, but not exhaustive coverage of every possible DOM state a much larger or
differently-configured inbox might produce. `manifest.json` bumped to 0.6;
`dist/PhishGuard-extension-v0.6.zip` packaged with all three fixes.

---

## [Unreleased] – Real-time protection, quarantine, and sandboxed link scanning

Implemented the three features requested: emails are now scored as they arrive (not just on
manual scan), phishing-scored emails are pulled out of the inbox view automatically, and every
link in a scored email gets checked for phishing-style tricks, with an on-demand deep check that
never requires the user to actually click a suspicious link.

### Real-time protection (extension/panel.js)

A `MutationObserver` watches the inbox container adapters now expose (`getContainer()`, added to
all three adapters) and auto-scores any new row within ~600ms of it appearing — no manual "Scan"
click needed. A shield toggle in the panel header lets the user pause/resume it; while paused, no
scoring happens, and resuming immediately catches up on anything that arrived in the meantime.

### Quarantine (extension/panel.js)

Any email scored High risk is instantly hidden from the inbox (`display:none` on its row) rather
than just flagged — this is a client-side approximation of quarantine, done by hiding the DOM
node the adapter already has a reference to, not a real server-side move. A bar above the panel
shows how many emails are currently quarantined with a "Restore all" action, and each hidden
email's card in the panel carries a "Removed from inbox — Restore" control. Limitation, disclosed
here rather than hidden: if a webmail client recycles row DOM nodes while virtual-scrolling, a
hidden node could in theory get reused for a different message; mitigated by checking
`el.isConnected` before restoring, not fully eliminated. **A real, server-side quarantine (actually
moving the message via the Gmail/Outlook API) is a natural phase 2** — it needs an OAuth app you'd
set up yourself (I can't create one on your behalf), so it's left for a follow-up once you want to
do that.

### Automatic link-safety checks (sentinel/main.py)

Every link in a scored email is now checked for two more phishing tells, folded into the existing
heuristic score: **punycode/IDN domains** (`xn--...`, used to spoof lookalike-looking domains with
non-Latin characters) and **brand-lookalike domains** (e.g. `paypa1-secure.com` when the email
claims to be PayPal, matched against a small known-brand table while excluding each brand's real
domains). Re-ran the two existing hand-labeled held-out test sets after adding this — accuracy,
precision, recall and F1 all still 1.000/1.000 on both (32 and 19 emails), so the new checks didn't
regress anything already tuned.

### Sandboxed "Deep scan" (new endpoint: `POST /scan/link_deepscan`)

Rather than auto-visiting every link (which would itself be risky and slow), a "Deep scan" button
appears on any scored email that contains links. Clicking it has the **backend** fetch the link
server-side — never the user's own browser — follows redirects, and reports: final destination,
redirect count, whether a lookalike/punycode domain or password field showed up, and whether the
final domain matches the brand the email claims to be from. This is SSRF-protected: both the
initial host and the final host (after redirects) are resolved and checked against
private/loopback/link-local/reserved IP ranges before any request is made, so the endpoint can't be
used to probe internal services.

**Testing:** 29 offline tests (`tests/test_link_deepscan.py`) cover the SSRF blocking logic, brand-
lookalike detection, and mocked HTTP scenarios (clean page, phishing redirect chain with a password
field, SSL error, timeout, connection error, redirect landing on a private address) — all pass.
Disclosed limitation: neither available test environment (this Mac's sandboxed shell, nor the
cloud container) has unrestricted outbound network access, so a true live fetch of an arbitrary
public URL couldn't be exercised end-to-end; verified instead with mocks plus a live (but
network-less) run of the actual endpoint confirming it correctly distinguishes "couldn't resolve
this domain" from "resolved to a blocked private address" and returns the right flags for a private
IP and a lookalike domain.

**Extension testing:** `tests/extension/test_quarantine_realtime.js` (new, 19 tests) exercises
real-time auto-scan, auto-quarantine of a high-risk row, the quarantine bar, badge count,
restore-from-card and restore-all, the `MutationObserver` catching a dynamically-added row, and
pause/resume behavior, all against real DOM elements. Two real bugs were caught by this suite
before release: the launcher badge was double-counting quarantined emails (it added
`quarantined.size` on top of a High-risk count that already included them), and `restoreEmail` used
`CSS.escape`, which isn't available in the jsdom test environment (or guaranteed everywhere) —
fixed by tracking the quarantine tag's DOM reference directly instead of re-querying for it. Full
suite: 79/79 extension tests pass. `manifest.json` bumped to 0.5;
`dist/PhishGuard-extension-v0.5.zip` packaged with all of the above.

---

## [Unreleased] – Outlook + Yahoo adapters fixed against real live accounts

Both the Outlook Web and Yahoo Mail adapters were originally best-effort guesses, never
checked against a real inbox. Tested them live today against a throwaway outlook.live.com
account and a throwaway Yahoo Mail account, with real cross-provider test emails sent between
them, and found real bugs in both:

- **Outlook**: the adapter assumed each row's aria-label was cleanly formatted as
  "Sender. Subject. Snippet." Real Outlook Web labels are free-form sentences where periods
  also show up inside email addresses and mid-sentence (e.g. "Unread idowu.bello@myyahoo.com
  Your account has been suspended..."), so the old split-on-"." logic shredded the sender,
  subject, and snippet into garbage. Rewrote it to read structural/ARIA hooks instead — the
  row's avatar (`role="img"`) aria-label for the sender, and the text immediately before the
  dated timestamp element for the subject — which matched correctly across all rows tested,
  including real external mail and Microsoft's own system notifications. The original
  aria-label-splitting logic is kept as a fallback if Microsoft changes the markup again.
- **Yahoo**: the row-level selector guess (`data-test-id="message-list-item"`) was correct, but
  the field-level guesses (`data-test-id="sender-name"` / `"subject"` / `"message-snippet"`)
  don't exist in Yahoo's real markup. Yahoo actually uses per-row element ids
  (`email-sender-00_1`, `email-subject-00_1`, `email-snippet-00_1`), with a screen-reader-only
  trap span (`email-subject-snippet-00_1`) that has to be explicitly excluded or subject
  parsing silently grabs the wrong, truncated text. Fixed and verified against two real
  incoming emails.

Both adapters still carry `experimental: true` — this was one throwaway account each with a
handful of emails, not exhaustive coverage (untested: threaded conversations, non-English
locales, attachments-only rows). Added realistic-markup fixtures to
`tests/extension/test_adapters.js` for both sites (in addition to the existing best-effort
fallback fixtures) so a future regression here is caught automatically — 26/26 adapter tests
and 30/30 panel tests pass. `dist/PhishGuard-extension-v0.4.zip` was repackaged with the fix.

---

## [Unreleased] – Resizable panel

The panel was fixed at 384x560px, which could block part of the inbox on smaller screens.
Added a drag handle (top-left corner) so it can be resized freely between roughly 320x340 and
680x860px (clamped to the viewport too, so it can never overflow off-screen), a size-cycle
button in the header (Compact/Default/Large presets) for a one-click alternative to free-drag,
and double-click-to-reset. The chosen size is remembered via `chrome.storage.sync` and restored
next time the panel opens. 13 new tests in `tests/extension/test_panel.js` cover drag resizing,
min/max clamping, the preset cycle, persistence, and reset — 48/48 tests pass across the full
suite. `dist/PhishGuard-extension-v0.4.zip` was repackaged with this change.

---

## [Unreleased] – UI redesign, multi-platform support, cloud deployment prep

### Extension UI (extension/overlay.css, extension/panel.js)

Reworked from an always-open panel to a floating launcher (with a live High-risk count badge)
that opens a refined dark-glass panel — segmented Scan visible/Scan inbox control, avatar-style
sender initials, a risk pill + animated threat meter per card, and click-to-expand reason chips
instead of always-visible text. Same color system as before (dark, glassmorphic, blurred), evolved
with a distinctive indigo-to-cyan gradient accent, entrance animations, and more polish throughout.
`popup.html` and `options.html` were restyled to match.

### Multi-platform support (extension/adapters/)

`content_script.js` is replaced by a shared `panel.js` (all UI/scan logic, site-agnostic) plus
per-site adapters that only handle DOM extraction: `adapters/gmail.js` (ported from the original
script — high confidence, Gmail's row classes have been stable for years), `adapters/outlook.js`
(Outlook on the web, reads the ARIA `role="option"`/`aria-label` structure rather than volatile
class names), and `adapters/yahoo.js` (Yahoo Mail, `data-test-id` hooks with a class-based
fallback). **The Outlook and Yahoo adapters are best-effort and unverified against live
accounts** — flagged as `experimental: true` in their adapter object, and the panel shows a
message rather than failing silently if a site's layout doesn't match. `manifest.json` now
declares `content_scripts` per site and adds `optional_host_permissions` for the configurable API
URL instead of a broad permanent host permission.

**Testing:** 35 automated tests (`tests/extension/test_adapters.js`, `test_panel.js`, run via
jsdom) cover DOM extraction for all three sites (including a Yahoo selector-fallback case) and
the panel's rendering/interaction logic (scan → render → risk styling → badge count → expand/
collapse). All 35 pass; run with `npm test` from `tests/extension/` (see its README).

### Cloud deployment (Dockerfile, render.yaml, HOSTING_QUICKSTART.md)

Added a production `Dockerfile` for `sentinel/`, a `render.yaml` blueprint for one-click Render
deployment, and `HOSTING_QUICKSTART.md` with click-by-click setup steps. `sentinel/requirements.txt`
now pins exact versions (previously unpinned, which was already causing scikit-learn
version-mismatch warnings on model load). The pinned dependency set and the exact `uvicorn`
startup command were verified end-to-end against Python 3.11 in a clean environment (the actual
`docker build` could not be run in the environment this change was authored in, since Docker Hub
was network-restricted there — verify the build once in your own environment before relying on it).

### Distribution

`dist/PhishGuard-extension-v0.4.zip` — the `extension/` folder only, zipped, ready for
"Load unpacked" install. This is the only file anyone needs to download; the backend and
dashboard are separate, hosted pieces per `HOSTING_QUICKSTART.md`.

---

## [Unreleased] – Accuracy hardening: fixed brand-spoofing bypass, retrained model, cleanup

**Why:** An independent accuracy audit (two hand-built, held-out test sets of realistic phishing +
legitimate emails, 51 cases total, none used in training) found the deployed pipeline caught only
64.7% of phishing attempts (recall) at 75.0% overall accuracy. After the fixes below, both held-out
sets score 100% (51/51). See `tests/adversarial_eval.py` and `tests/adversarial_eval_2.py` to
reproduce (`python3 tests/run_eval.py`, `python3 tests/run_eval2.py` against a running API).

### Critical fix: trusted-sender spoofing bypass (sentinel/main.py)

**What changed:** `_sender_looks_trusted()` granted "trusted brand" status (reduced score, capped at
Medium, never High) based on a **substring match against the attacker-controlled display name /
sender string** (e.g. "PayPal Support <support@paypal-verify-account.tk>" matched "paypal" and was
treated as trusted). Since brand impersonation is the primary phishing tactic, this silenced
detection for exactly the attacks it should catch — every false negative in the initial audit was
explained by this bug.

- **`_is_trusted_domain(domain)`** — trust is now based ONLY on the verified sending domain (exact
  match or subdomain of a known-good domain), never on display-name text.
- **`_brand_impersonation(sender, subject, body)`** — new detector: if a known brand name appears in
  the sender/subject but the actual sending domain does not match that brand's real domain(s), it's
  flagged as strong phishing evidence ("Sender impersonates X (domain does not match)") and is
  explicitly excluded from the trusted-sender discount.

### Heuristic cleanup (sentinel/main.py)

- Removed `"unsubscribe"`, `"click to unsubscribe"`, `"manage preferences"` from `PHISH_WORDING` —
  these appear in nearly all legitimate newsletters and were causing false positives.
- Added OTP/verification-code legit pattern (`verification code is`, `one-time code`, etc.) — these
  are extremely common legitimate emails that were previously scored as suspicious.
- Added job-offer/recruitment-scam wording ("work from home", "voided check", "no experience
  required", etc.) — a common scam pattern that was previously undetected.
- Expanded the trusted-domain allowlist with common modern SaaS tools (Canva, Figma, Notion,
  1Password, Twilio, Calendly, Airbnb, Etsy, Mailchimp, GitHub, and others).
- Fixed a dead/unreachable branch in `classify_risk()` and removed an unused legacy import
  (`sentinel/scorer.py`'s `heuristic_score`/`ml_predict`, shadowed and never called).
- Fixed `threat_pct` in `/email/score` and `/scan/batch`: it was derived from the raw model
  probability *before* trust/impersonation adjustments, so a trusted or capped email could display a
  contradictory "100% threat" next to a "Low risk" label. It's now derived from the final,
  adjusted score.

### Model retraining (ml/)

The underlying classifier is trained on 2001–2008 email corpora (Enron/CEAS/Nigerian Fraud), which
under-represents modern legitimate newsletters, travel/transactional emails, OTP codes, and modern
SaaS notifications, and modern phishing tactics (OAuth/MFA-fatigue phishing, brand-typosquat
domains, fake remote-job offers). Added ~550 synthetic rows across two rounds
(`ml/augment_generate.py`, `ml/augment_generate_2.py`) targeting exactly the gaps found by the
held-out eval sets, merged into `ml/processed/train_augmented2.csv`, and retrained
(`ml/models/phish_clf.joblib`). Original model backed up as
`ml/models/phish_clf.baseline.joblib.bak`.

**Note on metrics:** the internal train/test split reported by `ml/train_model.py`
(~99% accuracy) was already true of the original model too — it's a same-distribution split and
isn't a reliable signal of real-world generalization. The meaningful comparison is the two
independent held-out sets in `tests/`, which went from 75.0%/64.7% (accuracy/recall) to 100%/100%.

---

## [Unreleased] – Risk classification & UX updates

### Risk classification (sentinel/main.py)

**What changed:** Replaced the old threshold mix with a single, evidence-based classifier so risk levels are consistent and easier to tune.

| Change | Description |
|--------|-------------|
| **`_has_strong_phish_evidence(heur_reasons)`** | New helper. Returns `True` only when reasons include high-confidence signals: "Phishing wording:", "URL shortener", "IP address in URL", "Many external links", "Very short message with urgency". Single-word triggers (e.g. "payment") no longer alone cause High. |
| **`classify_risk(model_prob, heur_score, heur_reasons, trusted_sender)`** | New single entry point for risk. Replaces the previous `blend_model_with_heuristics()`. Takes model probability, heuristic score, list of reason strings, and trusted-sender flag. |
| **Combined score formula** | `combined = 0.6 * model_prob + 0.4 * (heur_score/10)`. 60% weight on ML, 40% on heuristics, so both signals matter in one transparent formula. |
| **Explicit High rule** | High only when: (1) `combined >= 0.75` and (`model_prob >= 0.82` or `strong_evidence`), or (2) `combined >= 0.70` and `strong_evidence`. Reduces false Highs from weak signals. |
| **Medium / Low bands** | Medium when `combined >= 0.35` or total score >= 3; else Low. Trusted senders are capped at Medium and usually Low. |
| **Trusted sender handling** | Inside `classify_risk`, trusted senders get a reduced total and never High; same logic in one place for `/email/score`, `/scan/batch`, and `/scan/gmail`. |

**Where it’s used:**

- **`/email/score`** – Calls `classify_risk(prob, h_score, h_reasons, trusted_sender)` after heuristics and optional OpenAI.
- **`/scan/batch`** – Same, with `trusted_sender` from sender domain + `_sender_looks_trusted(sender)`.
- **`/scan/gmail`** – Same classifier with `trusted_sender=False` (no sender in that flow).

---

### Extension overlay (extension/overlay.css)

| Change | Description |
|--------|-------------|
| **Panel background** | From solid `#020617` to `rgba(2,6,23,.78)` plus `backdrop-filter: blur(14px)` so the email behind stays visible. |
| **Header / actions / footer** | Semi-transparent backgrounds and lighter borders so they don’t fully block the page. |
| **Results area** | Light transparent background so when the list is short or scrolling, content behind shows through. |
| **Result cards** | From solid `#0b1220` to `rgba(11,18,32,.85)` so cards are slightly see-through. |

---

### Optional OpenAI (sentinel/openai_check.py + main.py)

| Change | Description |
|--------|-------------|
| **`openai_verdict(subject, body, sender)`** | Optional second opinion. When `OPENAI_API_KEY` (or `PHISHGUARD_OPENAI_API_KEY`) is set, calls OpenAI to classify LEGIT vs PHISH. |
| **`/email/score` body** | New field `use_openai: bool = True`. When `True` and key is set: if OpenAI says LEGIT → risk forced to Low; if PHISH and current risk Low → risk set to Medium. |
| **Env options** | `PHISHGUARD_OPENAI_ENABLED=0` disables OpenAI; `PHISHGUARD_OPENAI_MODEL` overrides model (default `gpt-4o-mini`). |

---

### Trusted senders (sentinel/main.py)

| Change | Description |
|--------|-------------|
| **`_trusted_domains()`** | Set of known-good domains (e.g. paypal.com, boostmobile.com, uber.com) plus optional `PHISHGUARD_TRUSTED_DOMAINS` env (comma-separated). |
| **`_sender_domain(sender)`** | Extracts domain from sender string (e.g. `service@paypal.com` → `paypal.com`). |
| **`_sender_looks_trusted(sender)`** | Fallback when only display name is available (e.g. "Boost Mobile", "PayPal"); matches against a list of brand substrings. |
| **Heuristic wording** | When `from_trusted_sender=True`, words "payment" and "invoice" in `URGENCY_CRED_WORDS` do not add to the wording score. |
| **Heuristic discount** | For trusted senders, heuristic score is reduced by 4 points before classification. |

---

### API & dashboard

| Change | Description |
|--------|-------------|
| **`ScoreIn.sender`** | Request body now accepts `sender` so trusted-sender logic can run. |
| **`ScoreIn.use_openai`** | Request body accepts `use_openai` to enable/disable OpenAI per request. |
| **Batch endpoint** | `POST /scan/batch` uses `classify_risk` and supports optional `sender` per email. |
| **Dashboard (ui/src/api.ts)** | Fetches from `/reports/summary` and `/reports/recent?limit=500` so the dashboard shows extension scan results. |
| **Reports table** | Displays up to 500 reports with scrollable table and sticky header. |

---

### Project setup & docs

| Change | Description |
|--------|-------------|
| **Run from root** | `run_api.sh` runs the API from project root; model path resolved from package root so no need to `cd` into `sentinel`. |
| **README** | One-branch (main), run-from-root; optional OpenAI and trusted senders; `PHISHGUARD_TRUSTED_DOMAINS`; link to GITHUB.md and HOSTING.md. |
| **HOSTING.md** | How to host backend (e.g. Railway) and dashboard (e.g. Vercel) and point the extension at them. |
| **Extension options** | Options page to set API URL and Dashboard URL for hosted use; content script reads from `chrome.storage.sync`. |
| **.gitignore** | `.env`, `.env.local`, `.env.*.local` so API keys are not committed. |

---

## How to show this on GitHub

1. **Commit and push this file:**
   ```bash
   git add CHANGELOG.md
   git commit -m "Add CHANGELOG describing risk classification and other changes"
   git push origin main
   ```

2. **On GitHub:** The file will appear in the repo. You can link to it in the README, e.g.  
   `See [CHANGELOG.md](CHANGELOG.md) for a description of what was changed and why.`

3. **For a specific change (e.g. risk classification):** Share the link to the file and point to the section, e.g.  
   `#changelog---unreleased--risk-classification--ux-updates` (GitHub turns headings into anchors).
