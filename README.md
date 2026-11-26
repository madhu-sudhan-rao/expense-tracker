# Finance Tracker

A personal finance tracker for expenses, income, savings goals, budgets and recurring transactions.
It's an installable web app (PWA) built mobile-first, and it works on desktop too.

v1 stores everything **locally in the browser on each device** (IndexedDB). See [docs/SPEC.md](docs/SPEC.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5173, also printed as a Network URL for your phone on the same Wi‑Fi
npm run build      # production build in dist/ (includes service worker + manifest)
npm run preview    # serve the production build
```

Installing to the home screen and offline mode need the production build served over HTTPS
(e.g. deploy `dist/` to Vercel, Netlify or GitHub Pages).

## Structure

- `src/lib/db.ts` – Dexie schema and default categories/payment methods
- `src/lib/ops.ts` – all writes (transactions, goal entries ↔ linked transactions, budgets, recurring)
- `src/lib/backup.ts` – JSON export/import (merge or replace), CSV export
- `src/pages/*` – screens; `src/components/*` – shared UI (sheet, forms, nav)

Amounts are stored as integers in hundredths of the currency unit. Every record has a UUID, `createdAt`,
`updatedAt` and a soft-delete `deletedAt`, so a Supabase sync can be added later without migrating data.
