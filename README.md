# Gym Tracker (GitHub Pages)

Standalone deploy for the 12-week gym tracker health module only.

## Local development

```bash
cd gym-tracker
npm install
npm run dev
```

Open `http://localhost:5173`.

## Deploy to GitHub Pages

1. Create a GitHub repository (for example `gym-tracker`).
2. Push this repo to GitHub:

```bash
git add .
git commit -m "Add standalone gym tracker for GitHub Pages"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

3. In GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push to `main`/`master` (or run the workflow manually). The workflow builds only `gym-tracker/` and publishes it.

Your site will be available at:

`https://YOUR_USERNAME.github.io/YOUR_REPO/`

## Notes

- All workout/nutrition data is stored in browser `localStorage` (offline-first).
- For a user site (`YOUR_USERNAME.github.io` repo), set `VITE_BASE_PATH=/` in the workflow before building.
- This folder is independent from the main Nexus dashboard API/backend.
