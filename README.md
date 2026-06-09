# Gym Tracker

![Language](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white) ![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black) ![Status](https://img.shields.io/badge/status-stable-brightgreen)


12-week transformation gym tracker — standalone web app with offline `localStorage` persistence.

## Live sites

- GitHub Pages: https://bhavya007-17.github.io/gym-tracker/
- Firebase: https://gym-tracker-14785.web.app (after deploy)

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Deploy to Firebase

Project: [gym-tracker-14785](https://console.firebase.google.com/project/gym-tracker-14785/hosting)

### One-time setup

1. Install the Firebase CLI (included as a dev dependency after `npm install`).
2. Log in: `npx firebase login`
3. Confirm the project: `npx firebase use gym-tracker-14785`

### Deploy from your machine

```bash
npm run deploy:firebase
```

This builds with `VITE_BASE_PATH=/` and publishes the `dist/` folder to Firebase Hosting.

### Auto-deploy via GitHub Actions

1. In [Firebase Console → Project settings → Service accounts](https://console.firebase.google.com/project/gym-tracker-14785/settings/serviceaccounts/adminsdk), generate a new private key (JSON).
2. In GitHub repo **Settings → Secrets → Actions**, add `FIREBASE_SERVICE_ACCOUNT` with the full JSON contents.
3. Push to `main` — the **Deploy to Firebase Hosting** workflow runs automatically.

## GitHub Pages

Deploys via GitHub Actions on push to `main`.

1. **Settings → Pages → Source: GitHub Actions**

## Notes

- All workout/nutrition data stays in your browser (`localStorage`).
- No backend required — works fully offline after first load.
## Status

Stable — deployed and usable. Workout/nutrition data is stored client-side in `localStorage`.

TODO: add a license (no license file is currently present in this repo).

## Contact

Bhavya Dosi — [LinkedIn](https://www.linkedin.com/in/bhavya-dosi)
