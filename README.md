# Complete Wellbeing - Ruby ETL for anonymised reporting

An ETL-first repository for anonymised, aggregated reporting on
"Complete Wellbeing Health Assessment" `.docx` reports, grouped by year.

```
raw-data/*/           Source .docx reports (one folder per year)
etl/                  Ruby/Kiba ETL: docx -> anonymised CSVs
bin/extract           Guided ETL walkthrough (extract -> edit -> report-ready)
bin/tag               Browser UI with editable tagging table
.github/workflows/    Ruby ETL quality + privacy checks
```

## Quick start

```
bin/extract
```

`bin/extract` handles dependency checks, extraction for tagging, the browser-based
editing gate, and yearly anonymised final report CSV generation under
`etl/output/`.
It is safe to re-run.

If a year folder has no `.docx` reports yet, `bin/extract` generates demo data for
that year in `etl/output/<year>.csv` (the final report output) so downstream
charting can still proceed.

## ETL pipeline

```
1. Perform extraction
   - `bundle exec ruby jobs/extract_for_tagging.rb <year>` (in `etl/`)
   - Writes `etl/tagging/<year>_tagging.csv`

2. Open the browser tagging page and save edits
   - Run `bin/tag`
   - Open the URL shown, review records, then Save & continue

3. Open the yearly report page
   - In the web tool, open `/:year/report`
   - The report rebuilds from your latest saved tags automatically
```

Both intermediary and final artifacts are plain open CSV files:
`etl/tagging/` is post-extract editable data, and `etl/output/` is final
report-ready data.

## Browser tagging page

```
bin/tag
```

This runs a local web app for the transform/tagging stage so a non-technical
reviewer can update a single editable table in the browser and save.
After saves, open the per-year report page and it will use the latest saved
tags automatically.

## Dashboard questions covered

The report page should summarise these 7 primary questions in chart form:

1. Split male/female
2. Age ranges
3. Sleep issues
4. Nutritional underfuelling while presenting overall healthy (good
   cholesterol, good blood pressure)
5. Stress/burnout
6. Number of acupuncture referrals
7. Mental health referrals

## Privacy

The final CSVs never contain names or dates of birth. Output includes only a
non-reversible `pseudonymous_id` (derived from a local salt), age, gender, and
health metrics/flags needed for aggregate analysis.

See `etl/README.md` for ETL internals.
