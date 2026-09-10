# ETL: docx reports -> per-year anonymised CSV

A locally-running Ruby [Kiba](https://github.com/thbar/kiba) ETL that reads `.docx` reports (grouped by year, in
folders `../raw-data/2023`), producing one anonymised CSV per year.

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

StandardRB also runs in CI - see `../.github/workflows/ci.yml`.

## Pipeline

The pipeline is three stages because the source reports have no structured
fields for sleep issues, stress/burnout or acupuncture/mental-health
referrals. They only appear as free narrative text written differently for
each client. Rather than guess at these with unreliable keyword matching, a
review is required to view the short excerpt and tag the records.

### Stage 1 - extract for tagging

```
bundle exec bin/extract
```

Reads every `.docx` in `../raw-data/*`, and writes/updates
`etl/tagging/YYYY_tagging.csv` with one row per report:

| column | meaning                                   |
| --- |-------------------------------------------|
| `pseudonymous_id` | stable, non-reversible id for this report |
| `source_file` | original filename, for cross-checking     |
| `gender`, `age` | for context while tagging                 |
| `sleep_issue`, `stress_burnout`, `acupuncture_referral`, `mental_health_referral` | `TODO(Y/N)` placeholders to fill in       |
| `personal_report_excerpt` | narrative text for review while tagging   |

Open a web browser, load the app at `localhost:4567`, then check/verify
the values related to `personal_report_excerpt`.

Re-running this command later (e.g. after adding more reports to the
year's folder) is non-destructive, keeps tags already filled in
(matched by `pseudonymous_id`) and only adds rows for new reports.

### Stage 2 - browser editing and save

Run `bin/tag` from the project root. It boots a small Sinatra
app (`tagging_web/`) protected with HTTP Basic Auth and prints a
URL/username/password to give to a reviewer if there are a few
of you on the same network and want to share the workload.

Reviewers edit one record at a time and press Save & continue. Each
save writes straight into `etl/tagging/<year>_tagging.csv`.

### Stage 3 - Reports

Open `/:year/report` in the web browser. This:

1. runs `jobs/build_yearly_csv.rb <year>` using the latest saved tags
2. writes/refreshes `etl/output/<year>.csv` (final report-ready output)
3. shows `/:year/report` for quick year summary viewing

Reporting queries:

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
it either..

## Anonymisation

No name or date of birth is ever written to CSV. Each report
gets a `pseudonymous_id`, a SHA-256 hash of the year, filename and a local
salt (`etl/config/salt.txt`). The same file always produces the same id (so stage 1/2 rows match
up), but the id cannot be reversed back to a filename or name.

This is enforced in CI. `bin/check_anonymized.rb` scans every final output CSV
(`output/*.csv`) for forbidden columns (name, DOB, email, phone,
address, ...) and for the presence of
`pseudonymous_id`, and fails the build if either check fails. See
`../.github/workflows/ci.yml`.

## Demo data

`bin/generate_demo_data.rb YEAR` writes 40 rows of made-up demo data for a
given year to stdout, with a few rates (sleep issues, stress/burnout,
referrals) differing slightly by year so the reports have
something realistic to show. `../bin/extract` (project root) runs this
automatically for any `raw-data/<year>` folder that has no `.docx` reports
in it yet, writing the final output CSV to `output/<year>.csv`.
