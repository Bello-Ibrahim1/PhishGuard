# PhishGuard (v2) — Extension + API + ML + UI

PhishGuard scans your inbox for phishing and malicious emails using an AI model plus rule-based checks (wording + links/identifiers).

**See [CHANGELOG.md](CHANGELOG.md)** for a description of what was changed and why (risk classification, trusted senders, OpenAI, extension UI, etc.).

---

## Quick start: run the extension (easy setup)

Follow these steps to run the PhishGuard extension on Gmail. Everything runs from the **project root** (the folder that contains `sentinel/`, `extension/`, `ui/`).

### Step 1: Get the project
```bash
git clone https://github.com/Bello-Ibrahim1/PhishGuard.git
cd PhishGuard
```
(Or open the folder you already have.)

### Step 2: Start the backend (required for the extension)
```bash
python3 -m venv venv
source venv/bin/activate          # On Windows: venv\Scripts\activate
pip install -r sentinel/requirements.txt
./run_api.sh
```
Leave this terminal open. The API runs at `http://localhost:8000`. You need it running whenever you use the extension.

**On Windows:** If `./run_api.sh` doesn’t work, run: `python -m uvicorn sentinel.main:app --reload --host 0.0.0.0 --port 8000` from the project root (with `venv` activated).

### Step 3: Load the extension in Chrome
1. Open Chrome and go to **chrome://extensions**
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the **`extension`** folder inside the PhishGuard project
5. The PhishGuard icon should appear in your toolbar

### Step 4: Use it on Gmail
1. Open [Gmail](https://mail.google.com) in the same browser
2. Click the PhishGuard icon (or the extension popup) and choose **Open Panel**
3. In the panel, click **Scan visible** to scan the emails on screen, or **Scan whole inbox** to scan more
4. Each email gets a risk label (Low / Medium / High) and a short reason

**Optional — dashboard:** To see a summary of all scanned emails (charts and table), in a **new terminal** run:
```bash
cd PhishGuard/ui
npm install
npm run dev
```
Then open the URL shown (e.g. `http://localhost:5173`) and click **View Full Report** in the extension panel to open it.

**That’s it.** As long as the API is running (Step 2) and the extension is loaded (Step 3), you can scan Gmail from the panel.

---

## One branch, run from root (no switching)

- **Use only the `main` branch.** You don’t need to switch between branches.
- **Always run from the project root** (the folder that contains `sentinel/`, `ml/`, `extension/`, `ui/`). No need to `cd` into `sentinel` and back.

---

## In simple terms

### What is the “Sentinel API”?
The **Sentinel API** is the small backend server that runs on your computer. When the Chrome extension scans an email, it sends the text to this server. The server runs the phishing-detection logic (the “brain”) and sends back a risk level (Low / Medium / High). So:

- **Extension** (in Gmail) → sends email text → **Sentinel API** (on your machine) → returns risk.

### What does “restart the Sentinel API” mean?
“Restart” just means: **stop the server, then start it again.**

- **Start:** You run a command so the server starts and stays running in the terminal.
- **Stop:** You press `Ctrl+C` in that terminal.
- **Restart:** Stop it, then run the start command again.

You restart when you change the backend code or after training a new model, so the server loads the latest version.

### When do I need to “retrain” or “restart”?
- **Retrain:** When you have new training data (e.g. new CSV of emails with labels) and you want to update the ML model. You run the training script once; it saves a new model file.
- **Restart the API:** After you retrain (so it uses the new model), or after you change any code in the `sentinel/` or `ml/` folder.

---

## How to run things

### 1. Backend (Sentinel API) — from project root only

From the **project root**:

```bash
# First time only
python3 -m venv venv
source venv/bin/activate
pip install -r sentinel/requirements.txt

# Run the API (keeps running until Ctrl+C). Stay in project root.
./run_api.sh
```

Or without the script: `source venv/bin/activate` then `python -m uvicorn sentinel.main:app --reload --host 0.0.0.0 --port 8000` (still from project root). The API will be at `http://localhost:8000`.

### 2. Optional: train or retrain the ML model
Only if you have training data (e.g. `ml/processed/train.csv` with `text` and `label` columns):

```bash
source venv/bin/activate
python -m ml.train_model --data ml/processed/train.csv --outdir ml/models
```

Then **restart the API** (Ctrl+C, then `./run_api.sh` again) so it loads the new model.

### 3. UI (dashboard)
In a new terminal:

```bash
cd ui
npm install
npm run dev
```

Open the URL it prints (e.g. `http://localhost:5173`).

### 4. Chrome extension
Load the `extension/` folder in Chrome as an unpacked extension (Chrome → Extensions → “Load unpacked” → select the `extension` folder). Use it on Gmail so the API and UI are running as above.

---

## Optional: OpenAI API (second opinion)

You can use **OpenAI** alongside the local ML so the model gets a second opinion and better separates legitimate companies from real phishing.

1. Get an API key from [platform.openai.com](https://platform.openai.com/api-keys).
2. Set **`OPENAI_API_KEY`** (or **`PHISHGUARD_OPENAI_API_KEY`**) before starting the API, e.g.  
   `export OPENAI_API_KEY=sk-...`
3. Install deps: `pip install -r sentinel/requirements.txt` (includes `openai`).
4. Restart the API. Each scored email will optionally call OpenAI (e.g. `gpt-4o-mini`) to classify as LEGIT or PHISH; if OpenAI says LEGIT, the email is forced to **Low** risk.

**Options:**

- **Disable OpenAI** but keep the key set: `PHISHGUARD_OPENAI_ENABLED=0`
- **Use a different model**: `PHISHGUARD_OPENAI_MODEL=gpt-4o` (default is `gpt-4o-mini` for lower cost)
- **Per-request**: the `/email/score` body accepts `"use_openai": false` to skip OpenAI for that call (e.g. to save cost or latency)

So you effectively have **two APIs**: the built-in ML + heuristics (always on), and optional OpenAI (on when the key is set and not disabled).

---

## Trusted senders (fewer false positives)

Legitimate brands (PayPal, Boost Mobile, Uber, Amazon, etc.) are **not** flagged as High just because the email contains words like "payment" or "invoice". The API uses a built-in allowlist of trusted domains and sender names. To add more:

- Set **`PHISHGUARD_TRUSTED_DOMAINS`** (comma-separated), e.g.  
  `PHISHGUARD_TRUSTED_DOMAINS=yourbank.com,shop.example.com`  
  before starting the API. No API key is required for this.

---

## Gmail API & Microsoft Outlook (optional)

- **Bulk scan (any source):** `POST /scan/batch` accepts `{"emails": [{"subject": "...", "body": "..."}, ...]}` and returns risk for each. Use from your own Gmail API or Microsoft Graph script to scan many emails.
- **Gmail:** Optional `GET /scan/gmail?max_results=50` uses Google Gmail API if you install `google-api-python-client` and `google-auth-oauthlib` and set `PHISHGUARD_GMAIL_CREDENTIALS`. If not set, the endpoint returns instructions and does not break the app.
- **Outlook:** Use `POST /email/score` or `POST /scan/batch` with `{"subject": "...", "body": "..."}`. Any Outlook add-in or script can call these endpoints.

---

## Pushing this project to GitHub

See **[GITHUB.md](GITHUB.md)** for step-by-step instructions to create a repo and upload your code.
