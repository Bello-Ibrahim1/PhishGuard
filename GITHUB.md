# How to upload PhishGuard to GitHub

Follow these steps to put your project on GitHub.

---

## 1. Create a GitHub account (if you don’t have one)

- Go to [github.com](https://github.com) and sign up.

---

## 2. Create a new repository on GitHub

1. Log in to GitHub.
2. Click the **+** (top right) → **New repository**.
3. **Repository name:** e.g. `PhishGuard` or `PhishGuard-v2`.
4. **Description (optional):** e.g. “Chrome extension + API for phishing email detection”.
5. Choose **Public** (or Private if you prefer).
6. **Do not** check “Add a README” or “Add .gitignore” (you already have them in your project).
7. Click **Create repository**.

You’ll see a page with a URL like:  
`https://github.com/YOUR_USERNAME/PhishGuard.git`

---

## 3. Open Terminal and go to your project folder

```bash
cd /Users/ibrahimbello/Desktop/BitHunter_v2_Seminar
```

(Or wherever your project folder actually is.)

---

## 4. Turn the project into a Git repo (first time only)

If this folder is **not** already a Git repo (no `.git` folder), run:

```bash
git init
```

---

## 5. Add a remote pointing to GitHub

Replace `YOUR_USERNAME` and `PhishGuard` with your GitHub username and repo name:

```bash
git remote add origin https://github.com/YOUR_USERNAME/PhishGuard.git
```

If you already had a remote named `origin` and want to replace it:

```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/PhishGuard.git
```

---

## 6. Stage and commit your files

```bash
# Ignore venv and other junk (the project .gitignore does this)
git add .
git status   # optional: see what will be committed

git commit -m "Initial commit: PhishGuard extension, API, ML, and UI"
```

---

## 7. Push to GitHub

For the first push, use (again replace with your repo name if different):

```bash
git branch -M main
git push -u origin main
```

Git may ask for your GitHub username and password. For password, use a **Personal Access Token** (PAT), not your normal GitHub password:

- GitHub → **Settings** → **Developer settings** → **Personal access tokens** → generate a token with `repo` scope.
- When Git asks for a password, paste that token.

---

## 8. Check on GitHub

Refresh your repository page on GitHub. You should see all your project files (extension, sentinel, ml, ui, README, etc.). The `.gitignore` will keep things like `venv/` and `node_modules/` from being uploaded.

---

## Later: making more changes and pushing again

After you change code:

```bash
cd /Users/ibrahimbello/Desktop/BitHunter_v2_Seminar
git add .
git commit -m "Short description of what you changed"
git push
```

---

## Summary

| Step | What you do |
|------|-------------|
| 1 | Create GitHub account |
| 2 | Create a new repo (no README/.gitignore) |
| 3 | `cd` into your project folder |
| 4 | `git init` (if not already a repo) |
| 5 | `git remote add origin https://github.com/YOUR_USERNAME/PhishGuard.git` |
| 6 | `git add .` then `git commit -m "Initial commit: PhishGuard..."` |
| 7 | `git branch -M main` then `git push -u origin main` |
| 8 | Check the repo on GitHub |

If you hit an error (e.g. “remote already exists” or “permission denied”), copy the exact message and we can fix it step by step.
