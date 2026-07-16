# Bangalore Votes — Prototype

A static, front-end-only React prototype of the GBA Elections Citizen Platform. This is a **design/UX prototype**, not the real product:

- All data (wards, candidates, issues, submissions, audit log) is **fictional mock data** baked into the app — nothing is fetched from a real backend or database.
- There is **no server**. Login/OTP is **simulated** — no email or WhatsApp message is actually sent, and no real account is created.
- Nothing you do here (flagging, voting, curator edits) persists beyond your browser session or affects any real system.

It exists to validate flows, layout, and copy before the real platform is built. See `../docs/` at the repo root for the actual product spec.

## Running locally

```bash
cd prototype
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173/bangalore-votes/`).

## Build

```bash
npm run build
```

Type-checks, builds a production bundle to `dist/`, and copies `dist/index.html` to `dist/404.html` (this is the standard GitHub Pages trick to make deep links survive a hard refresh on a static host).

To preview the production build locally:

```bash
npm run preview
```

## Tests

```bash
npm run test
```

## Deployment

This app auto-deploys to **https://snarayanank2.github.io/bangalore-votes/** via the `.github/workflows/deploy-prototype.yml` workflow on every push to `main` that touches `prototype/**`.

**One-time setup** (already done, or to be done once by a repo admin): in GitHub, go to **Settings → Pages** and set **Source = GitHub Actions**. No other manual steps are required — the workflow builds, tests, and publishes automatically.
