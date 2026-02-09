# CLAUDE.md

## Project

Energy monitoring for Blindern Studenterhjem. Tracks electricity usage (Elvia), district heating (Hafslund), spot prices (Nord Pool), and outdoor temperature (Yr). Norwegian language throughout UI/comments.

## Architecture

pnpm monorepo with two packages:

- **extractor** — Backend TypeScript service that fetches data from external APIs, stores in `data.json`, and generates `report.json`
- **report** — React SPA that loads `report.json` and renders interactive Recharts visualizations

### Extractor internals (`extractor/src/`)

- `extract/` — Individual data fetchers (nordpool, stroem, fjernvarme, temperatur)
- `service/service.ts` — Main loop, runs every 30 min, loads 40 days of history
- `service/data-store.ts` — JSON file persistence
- `service/loader.ts` — Orchestrates which data needs refreshing
- `report/report.ts` — Aggregates hourly→daily→monthly→yearly data
- `report/prices.ts` — Complex pricing model with VAT, subsidies, monthly fee adjustments
- `instrumentation.ts` — OpenTelemetry setup (traces + metrics → SigNoz)

### Report internals (`report/src/`)

- `App.tsx` — Single large component file (~1300 lines) containing all chart components and dashboard

## Commands

```bash
# Install
corepack enable && pnpm install

# Run tests (extractor only)
pnpm --filter ./extractor test        # watch mode
pnpm --filter ./extractor test --run  # single run

# Frontend dev
pnpm --filter ./report dev --open

# Build frontend
pnpm --filter ./report build

# Generate report from data
pnpm --filter ./extractor generate-report

# Run extractor service
pnpm --filter ./extractor start

# CLI data fetchers (from extractor/)
node src/cli/{nordpool,stroem,fjernvarme,temperatur}.ts [DATE [DATE]]
```

## Tech stack

- TypeScript 5 (strict), Node 24 (native TS type stripping — no enums, namespaces, or parameter properties)
- pnpm 10 workspaces
- React 19, Recharts 3, Vite 7
- Vitest for testing
- `@js-temporal/polyfill` for date handling
- Ramda for functional utilities

## Deployment

- **Extractor**: Docker image → `ghcr.io/blindern/energi-extractor:latest`, deployed via API call
- **Report**: Static build → rsync over SSH to `fcos-3.nrec.foreningenbs.no`
- CI: GitHub Actions (`.github/workflows/extractor.yml` and `report.yml`)

## Key details

- Elvia integration scrapes their web portal (no official API) — fragile
- Price calculations include VAT transitions, subsidies (strømstøtte/norgespris), and monthly-specific adjustments
- Report shows cross-year comparisons and energy-vs-temperature linear regression by season
- `?presentation` query param enables presentation mode in the frontend
