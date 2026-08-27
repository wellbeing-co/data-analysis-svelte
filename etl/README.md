# ETL: docx reports -> per-year anonymised CSV

A locally-running Ruby [Kiba](https://github.com/thbar/kiba) ETL that reads
"Complete Wellbeing Health Assessment" `.docx` reports (grouped by year, in
folders like `../raw-data/2023`) and produces one anonymised CSV per year for the
Svelte app.

## Setup

```
cd etl
bundle install
```

## Tests & linting

```
bundle exec rake        # runs the minitest suite, then RuboCop
bundle exec rubocop     # RuboCop only (style/lint over etl/, see .rubocop.yml)
bundle exec rubocop -a  # auto-correct safe offences
```

RuboCop also runs in CI on every push/PR - see `../.github/workflows/ci.yml`.

## Pipeline

The pipeline is two stages because the source reports have no structured
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

Open this file in Excel and replace each
`TODO(Y/N)` with `Y` or `N` based on the excerpt.

Re-running this command later (e.g. after adding more reports to the
year's folder) is safe: it keeps tags already filled in
(matched by `pseudonymous_id`) and only adds rows for new reports.

### Handing stage 1 off to someone else (tagging_web)

Instead of editing the CSV directly, run `../bin/tagging_server` from the
project root. It boots a small Sinatra app (`tagging_web/`) protected with
HTTP Basic Auth and prints a URL/username/password to give to a reviewer on
another machine on the same local network.

Their submissions are never written straight into
`etl/tagging/<year>_tagging.csv` - they're saved as a "pending" proposal
(`etl/tagging/pending/<year>_tagging.pending.csv`) and shown as a diff on a
review page. Merging (from that same page) is what actually applies it to
the real tagging file - the same propose -> review -> merge shape as a
GitHub pull request, kept entirely local. See `Etl::TaggingReview`
(`lib/etl/tagging_review.rb`) for the merge logic and `tagging_web/app.rb`
for the routes.

### Stage 2 - build the final yearly CSV

Once the tagging CSV has been filled in:

```
bundle exec ruby jobs/build_yearly_csv.rb 2023
```

Reads the `.docx` reports again, merges in the tags, and writes
`etl/output/2023.csv` - the anonymised, per-year CSV consumed by the Svelte
app. Rows still containing a `TODO(Y/N)` placeholder are recorded as
`Unknown`.

Copy the resulting file into `../app/static/data/2023.csv` (and add `2023`
to `../app/static/data/years.json`) to publish it to the dashboard.

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

No name or date of birth is ever written to the output CSV. Each report
gets a `pseudonymous_id`, a SHA-256 hash of the year, filename and a local
salt (`etl/config/salt.txt`, generated on first run (git-ignore). The same file always produces the same id (so stage 1/2 rows match
up), but the id cannot be reversed back to a filename or name.

This is enforced in CI. `bin/check_anonymized.rb` scans every published
CSV (`../app/static/data/*.csv`, `output/*.csv`) for forbidden columns
(name, DOB, email, phone, address, ...) and for the presence of
`pseudonymous_id`, and fails the build if either check fails. See
`../.github/workflows/ci.yml`.

## Demo data

`bin/generate_demo_data.rb YEAR` writes 40 rows of made-up demo data for a
given year to stdout, with a few rates (sleep issues, stress/burnout,
referrals) drifting slightly by year so the dashboard's trends chapter has
something realistic to show. `../bin/run` (project root) runs this
automatically for any `raw-data/<year>` folder that has no `.docx` reports
in it yet, publishing the result straight to `../app/static/data/<year>.csv`.
