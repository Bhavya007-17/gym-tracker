# Gym Tracker

12-week transformation gym tracker — standalone web app with offline `localStorage` persistence.

Live site: https://bhavya007-17.github.io/gym-tracker/

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## GitHub Pages

This repo deploys automatically via GitHub Actions on push to `main`.

1. Go to **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Push to `main` (or run the workflow manually from the Actions tab)

## Notes

- All workout/nutrition data stays in your browser (`localStorage`).
- No backend required — works fully offline after first load.
