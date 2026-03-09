# Hosting PhishGuard so others can use the extension

To let people **download the extension** and use it without running anything on their machine, you need to:

1. **Host the backend (API)** so it’s reachable at a public URL.
2. **Host the dashboard (UI)** so the “View Full Report” link works.
3. **Point the extension** at those URLs (via the extension Options page).

---

## 1. Host the backend (API)

The backend is the FastAPI app in `sentinel/`. It must be reachable over HTTPS so the extension can call it from Gmail.

### Option A: Railway (simple)

1. Sign up at [railway.app](https://railway.app).
2. New Project → **Deploy from GitHub** (connect your PhishGuard repo).
3. Set **root directory** to the repo root (or the folder that has `sentinel/` and `ml/`).
4. Set **start command** to something like:
   ```bash
   pip install -r sentinel/requirements.txt && python -m uvicorn sentinel.main:app --host 0.0.0.0 --port $PORT
   ```
   (Railway sets `PORT`; use it so the app listens on the right port.)
5. Add a **start command** in the dashboard or use a **Procfile** / **nixpacks** so Railway runs the above. You may need to copy the `ml/models` folder or train the model in a build step if you don’t commit the `.joblib` file.
6. Deploy. Railway will give you a URL like `https://your-app.up.railway.app`. That is your **API URL**.

**CORS:** The app already allows all origins (`*`) for development. For production you can restrict this in `sentinel/main.py` to your dashboard and extension origin if you want.

### Option B: Render

1. [render.com](https://render.com) → New → **Web Service**.
2. Connect the repo, set build to install deps and (if needed) train the model or copy `ml/models`.
3. Start command: `uvicorn sentinel.main:app --host 0.0.0.0 --port $PORT`.
4. Use the generated URL (e.g. `https://phishguard-api.onrender.com`) as your **API URL**.

### Option C: Google Cloud Run / Fly.io / Heroku

Same idea: run `uvicorn sentinel.main:app --host 0.0.0.0 --port <port>` and expose it over HTTPS. Use the service URL as the **API URL**.

**Note:** Scan results are stored **in memory**. If the backend restarts, they’re lost. For persistent reports you’d add a database later.

---

## 2. Host the dashboard (UI)

The UI is the React app in `ui/`. Build it and host the static files.

### Option A: Vercel

1. Sign up at [vercel.com](https://vercel.com).
2. Import your GitHub repo, set **root directory** to `ui`.
3. Build command: `npm run build`. Output: `dist` (or whatever your Vite config uses).
4. Deploy. You’ll get a URL like `https://phishguard-dashboard.vercel.app`. That is your **Dashboard URL**.

**Important:** The UI calls the API with `API_BASE` in `ui/src/api.ts`. For a hosted dashboard you must either:

- Build with the production API URL (e.g. env var `VITE_API_URL=https://your-api.railway.app` and use it in `api.ts`), or
- Use a single domain and proxy (e.g. dashboard and API on same domain with different paths).

So in `ui` you’d set something like:

```bash
VITE_API_URL=https://your-api.railway.app npm run build
```

and in `ui/src/api.ts` use `import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"` so the hosted build points to your hosted API.

### Option B: Netlify / GitHub Pages

Same idea: build `ui` and deploy the build output. Set the API base URL at build time so the dashboard talks to your hosted backend.

---

## 3. Point the extension at your hosted URLs

1. **Package the extension:** the folder you need is `extension/` (with `manifest.json`, `content_script.js`, `options.html`, etc.).
2. **Options page:** Users (or you) open the extension’s options:
   - Chrome → Extensions → PhishGuard → **Details** → **Extension options**
   - Or right‑click the extension icon → Options (if you expose it).
3. Set:
   - **API URL** = your backend URL (e.g. `https://your-app.up.railway.app`) — no trailing slash.
   - **Dashboard URL** = your dashboard URL (e.g. `https://phishguard-dashboard.vercel.app`).
4. Save. **Reload Gmail** (or the tab) so the content script uses the new URLs.

Then anyone who loads the extension (see below) and sets the same Options (or you ship a build with defaults pointing to your hosted API/dashboard) can use it without running the backend locally.

---

## 4. Letting people “download” the extension

- **Chrome Web Store:** Publish the extension (zip the `extension/` folder or build it). Users install from the store. They can still set Options to your hosted API/dashboard if you don’t hardcode them.
- **“Load unpacked” (developer):** Zip the `extension/` folder; recipients unzip, go to `chrome://extensions`, turn on Developer mode, **Load unpacked**, and select the folder. Then set Options to your API and Dashboard URLs.

For a public release, you’d typically host the backend and dashboard as above, then either publish the extension with those URLs as defaults or ask users to set them once in Options.

---

## Quick checklist

| Step | What to do |
|------|------------|
| 1 | Deploy backend (e.g. Railway) → get **API URL** (HTTPS). |
| 2 | Set `VITE_API_URL` to that URL, build `ui`, deploy to Vercel/Netlify → get **Dashboard URL**. |
| 3 | In extension Options, set API URL and Dashboard URL. |
| 4 | Distribute the extension (store or unpacked) and tell users to set Options if needed. |
