# Wellbeing reporting dashboard

SvelteKit dashboard that reads the anonymised per-year CSVs produced by the
`etl/` pipeline (`../etl/README.md`) and answers reporting questions:
gender split, age ranges, sleep issues, nutritional underfuelling while
otherwise healthy, stress/burnout, acupuncture referrals and mental health
referrals.

Rather than a short-form admin dashboard, each year is presented as a short
narrative: a headline, a plain-English paragraph per finding, and a "Spotting
the trend across years" chapter at the end (shown once more than one year of
data is available) comparing wellbeing signals and referrals over time.

## Data

The app reads static files served from `static/data/`:

- `static/data/years.json` - a JSON array of available years, e.g. `["2023"]`
- `static/data/<year>.csv` - the anonymised data for that year (same shape
  as `etl/output/<year>.csv`)

A made-up demo dataset ships for every year (see
`../etl/bin/generate_demo_data.rb`) so the dashboard works out of the box -
`bin/run` (at the project root) generates this automatically for any year
folder under `../raw-data/` that doesn't have real `.docx` reports in it yet.
To use real data for a year, copy the ETL output over its CSV and make sure
the year is listed in `years.json`.

## Developing

```
npm install
npm run dev -- --open
```

## Checks

```
npm run check   # svelte-check (types)
npm run test    # vitest unit tests (src/lib/stats.test.ts)
npm run build   # production build
```

All three run in CI on every push/PR - see `../.github/workflows/ci.yml`.
