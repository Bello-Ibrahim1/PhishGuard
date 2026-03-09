PhishGuard UI (React) — SRC-ONLY BUNDLE
======================================
This folder contains only the React `src/` + `index.html` files so you can drop them into a fresh Vite React+TS app.
Steps:
1) cd PhishGuard_v2/ui
2) npm create vite@latest . -- --template react-ts
3) npm install
4) npm install recharts
5) Replace the generated `src/` with the `src/` in this bundle. Also replace `index.html`.
6) Optional: add `src/assets/hero.png` for the top-left logo.
7) Ensure backend running at http://127.0.0.1:8000
8) npm run dev
