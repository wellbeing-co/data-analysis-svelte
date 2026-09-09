# Complete Wellbeing - Ruby ETL for anonymised reporting

An ETL-first repository for anonymised, aggregated reporting on
"Complete Wellbeing Health Assessment" `.docx` reports, grouped by year.

```
raw-data/*/           Source .docx reports (one folder per year)
etl/                  Ruby/Kiba ETL: docx -> anonymised CSVs
bin/run               Guided ETL walkthrough (extract -> edit -> report-ready)
bin/tagging_server    Browser UI with editable tagging table
.github/workflows/    Ruby ETL quality + privacy checks
```

## Quick start

```
bin/run
```

`bin/run` handles dependency checks, extraction for tagging, the browser-based
editing gate, and yearly anonymised CSV output generation under `etl/output/`.
It is safe to re-run.

If a year folder has no `.docx` reports yet, `bin/run` generates demo data for
that year in `etl/output/<year>.csv` so downstream charting can still proceed.

## ETL pipeline

```
1. Perform extraction
   - `bundle exec ruby jobs/extract_for_tagging.rb <year>` (in `etl/`)
   - Writes `etl/tagging/<year>_tagging.csv`

2. Open the browser tagging page and save edits
   - Run `bin/tagging_server`
   - Open the URL shown, edit the single-page table (`Y`/`N` tags), then save

3. Build report-ready output and view dashboard charts
   - `bundle exec ruby jobs/build_yearly_csv.rb <year>` (in `etl/`)
   - Produces `etl/output/<year>.csv` for the report page/dashboard
```

Both intermediary and final artifacts are plain open CSV files.

## Browser tagging page

```
bin/tagging_server
```

This runs a local web app for the transform/tagging stage so a non-technical
reviewer can update a single editable table in the browser and save.
Saved tags are then used to build yearly CSVs that feed the dashboard/report
charts.

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
