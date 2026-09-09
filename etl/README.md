# ETL: docx reports -> per-year anonymised CSV

A locally-running Ruby [Kiba](https://github.com/thbar/kiba) ETL that reads
"Complete Wellbeing Health Assessment" `.docx` reports (grouped by year, in
folders like `../raw-data/2023`) and produces one anonymised CSV per year.

## Setup

```
cd etl
bundle install
```

## Tests & linting

```
bundle exec rake        # runs the minitest suite, then StandardRB
bundle exec standardrb  # StandardRB only (style/lint over etl/)
bundle exec standardrb --fix  # auto-fix supported offences
```

StandardRB also runs in CI on every push/PR - see `../.github/workflows/ci.yml`.

## Pipeline

The pipeline is three stages because the source reports have no structured
fields for sleep issues, stress/burnout, or acupuncture/mental-health
referrals. They only appear as free narrative text written differently for
each client. Rather than guess at these with unreliable keyword matching, a
review is required to view the short excerpt and tag the records.

### Stage 1 - extract for tagging

```
bundle exec ruby jobs/extract_for_tagging.rb 2023
```

Reads every `.docx` in `../raw-data/2023`, and writes/updates
`etl/tagging/2023_tagging.csv` with one row per report:

| column | meaning |
| --- | --- |
| `pseudonymous_id` | stable, non-reversible id for this report |
| `source_file` | original filename, for cross-checking only |
| `gender`, `age` | for context while tagging |
| `sleep_issue`, `stress_burnout`, `acupuncture_referral`, `mental_health_referral` | `TODO(Y/N)` placeholders to fill in |
| `personal_report_excerpt` | the narrative text to read while tagging |

Then open the browser tagging page and replace each `TODO(Y/N)` with `Y` or
`N` based on the excerpt.

Re-running this command later (e.g. after adding more reports to the
year's folder) is safe: it keeps tags already filled in
(matched by `pseudonymous_id`) and only adds rows for new reports.

### Stage 2 - browser editing and save (tagging_web)

Run `../bin/tag` from the project root. It boots a small Sinatra
app (`tagging_web/`) protected with HTTP Basic Auth and prints a
URL/username/password to give to a reviewer on another machine on the same
local network.

The reviewer edits one record at a time and presses Save & continue. Each
save writes straight into `etl/tagging/<year>_tagging.csv` immediately.

### Stage 3 - open report charts

Open `/:year/report` in the tagging web UI. This:

1. runs `jobs/build_yearly_csv.rb <year>` using the latest saved tags
2. writes/refreshes `etl/output/<year>.csv` (final report-ready output)
3. shows `/:year/report` for quick year summary viewing

Rows still containing a `TODO(Y/N)` placeholder are recorded as `Unknown`.

Use `etl/output/<year>.csv` (final output) as the data source for your single
dashboard page
(for example on GitHub Pages) showing chart summaries for:

1. Split male/female
2. Age ranges
3. Sleep issues
4. Nutritional underfuelling while presenting overall healthy
5. Stress/burnout
6. Number of acupuncture referrals
7. Mental health referrals

## What gets extracted automatically

From the "Summary of Key Results" table and header: gender, age, height,
weight, BMI, body fat %, waist circumference/ratio, blood pressure,
resting pulse, total/HDL/non-HDL cholesterol, glucose, HBA1c - plus derived
traffic-light categories (`blood_pressure_category`,
`hdl_cholesterol_category`, `non_hdl_cholesterol_category`) and an
`overall_healthy` flag (green blood pressure + non-high non-HDL + non-low
HDL cholesterol).

`nutritional_underfuelling` is keyword-detected from the Nutrition
paragraph (see `Etl::Derivations::UNDERFUELLING_KEYWORDS`) - like the
narrative flags, this is best-effort since there's no structured field for
it either; refine the keyword list as real report language is reviewed.

## Anonymisation

No name or date of birth is ever written to the final output CSV. Each report
gets a `pseudonymous_id`, a SHA-256 hash of the year, filename and a local
salt (`etl/config/salt.txt`, generated on first run (git-ignore). The same file always produces the same id (so stage 1/2 rows match
up), but the id cannot be reversed back to a filename or name.

This is enforced in CI. `bin/check_anonymized.rb` scans every final output CSV
(`output/*.csv`) for forbidden columns (name, DOB, email, phone,
address, ...) and for the presence of
`pseudonymous_id`, and fails the build if either check fails. See
`../.github/workflows/ci.yml`.

## Demo data

`bin/generate_demo_data.rb YEAR` writes 40 rows of made-up demo data for a
given year to stdout, with a few rates (sleep issues, stress/burnout,
referrals) drifting slightly by year so the dashboard's trends chapter has
something realistic to show. `../bin/extract` (project root) runs this
automatically for any `raw-data/<year>` folder that has no `.docx` reports
in it yet, writing the final output CSV to `output/<year>.csv`.
