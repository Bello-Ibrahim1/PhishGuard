# Changelog

All notable changes to PhishGuard are documented here. You can show this file on GitHub so others (and your friend) can see what was done and why.

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
