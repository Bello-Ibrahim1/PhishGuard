# Deploy PhishGuard's backend in ~10 minutes (Render, free tier)

This is the fast path: `Dockerfile` and `render.yaml` are already in this repo, so Render
builds and runs the API automatically — you don't need to type a build/start command by hand.

## 1. Push this repo to GitHub

If it isn't already:
```bash
git add .
git commit -m "Add Docker + Render deployment config"
git push origin main
```
(See `GITHUB.md` in this repo if you haven't connected a GitHub remote yet.)

## 2. Create a Render account

Go to [render.com](https://render.com) and sign up (GitHub sign-in is fastest — it also makes
step 3 easier since Render can list your repos directly).

## 3. Deploy the blueprint

1. In the Render dashboard, click **New** (top right) → **Blueprint**.
2. Connect your GitHub account if prompted, then select the **PhishGuard** repo.
3. Render will detect `render.yaml` in the repo root and show you the `phishguard-api` service
   it's about to create. Click **Apply**.
4. Render builds the Docker image (this takes a few minutes the first time — it's installing
   scikit-learn, numpy, etc.) and starts the container.
5. When it's done, you'll see a green "Live" status and a URL like
   `https://phishguard-api.onrender.com`. **That's your API URL.**

## 4. Confirm it's actually working

Open `https://phishguard-api-<yours>.onrender.com/health` in a browser — you should see
`{"status":"ok"}`. If you see an error instead, click into the service in Render and check the
**Logs** tab; the most common issue is the build timing out on the free tier (scikit-learn takes
a minute or two to install) — just retry the deploy if that happens.

**Note on the free tier:** Render's free web services spin down after 15 minutes of no traffic
and take 30-60 seconds to wake back up on the next request. That's fine for testing and personal
use; if you want it to always respond instantly (e.g. once other people depend on it), you'd
upgrade to a paid instance later — nothing else about this setup changes.

## 5. Point the extension at your hosted API

1. Load the extension (see `README.md`, or just use `dist/PhishGuard-extension-v0.4.zip`).
2. Click the PhishGuard icon → **Settings** (or right-click the icon → Options).
3. Set **API URL** to your Render URL from step 3 (no trailing slash), e.g.
   `https://phishguard-api.onrender.com`.
4. Save, then reload your Gmail/Outlook/Yahoo tab.

At this point anyone who installs the extension zip and enters that same API URL can use
PhishGuard without running anything on their own machine — which is the whole point.

## 6. (Optional) Ship the hosted URL as the default

Right now the extension defaults to `http://localhost:8000` until someone sets it in Options.
Once you're happy with your hosted URL and want it to just work out of the box for anyone who
installs the zip, change the two `DEFAULT_API` / `DEFAULT_DASHBOARD` constants in
`extension/panel.js` to your real URLs, then re-zip `extension/` — after that, Options becomes
optional rather than required for a new install.

## Where this leaves the dashboard

This guide only deploys the API (`sentinel/`), which is the part the extension needs. The
analytics dashboard (`ui/`) is optional and already has its own instructions in `HOSTING.md`
(deploy to Vercel, point it at the same API URL). Skip it for now if you just want the extension
working — the extension itself doesn't depend on the dashboard being deployed.
