# Complete Wellbeing - Data Reporting Tool

Anonymised, aggregated reporting on "Complete Wellbeing Health Assessment"
reports (`.docx`), grouped by year.

The project has multiple components:

```
raw-data/*/           Source .docx reports for 2023 (one folder per year)
etl/                  Ruby/Kiba ETL: docx -> per-year anonymised CSV
app/                  SvelteKit dashboard that reads the per-year CSVs
bin/run               Guided script that walks through the whole thing
bin/tagging_server    Hands step 2 off to someone else over the browser
.github/workflows/    CI and security scanning
```

## Quick start

```
bin/run
```

This single script takes you through the whole pipeline end to end: it
checks/installs dependencies (Ruby gems, npm packages), runs the extraction
for each detected year folder, pauses and tells you exactly which file to
open and fill in when manual tagging is needed, builds the final CSV,
publishes it into the dashboard's data folder, then finally offers to boot
the dashboard (`npm run dev` or a production preview). It's safe to re-run
any time - already-completed steps are skipped or simply re-confirmed.

If a year folder (e.g. `raw-data/2024/`) doesn't have any `.docx` reports in
it yet, `bin/run` generates demo data for that year instead, so
the dashboard always has something to show. Drop real reports in and
re-run to replace it.

## How it works

`bin/run` walks through all of the steps below automatically (pausing for
step 2, since that needs additional input from another person):

```
docx reports (raw-data/<year>/)
        │
        ▼
 1. bundle exec ruby jobs/extract_for_tagging.rb <year>   (etl/)
        │  produces etl/tagging/<year>_tagging.csv
        ▼
 2. fill in Y/N for sleep_issue, stress_burnout, acupuncture_referral,
    mental_health_referral - either by hand, or hand this step off to
    someone else with `bin/tagging_server` (see below)
        │
        ▼
 3. bundle exec ruby jobs/build_yearly_csv.rb <year>       (etl/)
        │  produces etl/output/<year>.csv
        ▼
 4. copy etl/output/<year>.csv and update years.json       (app/static/data/)
        │
        ▼
   npm run dev (app/) -> dashboard answering the main reporting questions
```

See `etl/README.md` and `app/README.md` for details on each part.

## Handing off tagging to someone else

Step 2 above is the one step that needs someone to actually read each
report's excerpt, and that person doesn't have to be technical, or even on
this machine.

```
bin/tagging_server
```

This boots a small local web app and prints a URL, username and password to
share with them (they just need a browser on the same local network). It
works like a pull request: their submitted tags are saved as a *proposal*,
never written straight into `etl/tagging/<year>_tagging.csv`. Reviewing that
proposal (a plain before/after diff) and clicking "Merge" - from the same
web UI, on either machine - is what actually applies it, so nothing reaches
the file stage 2 reads until someone has looked at the diff. See
`etl/tagging_web/` for implementation.

## Continuous integration

`.github/workflows/ci.yml` runs on every push/PR:

| Job | What it checks |
| --- | --- |
| Anonymisation check | Fails the build if any published CSV contains a re-identifying column (name, DOB, email, etc.) or is missing `pseudonymous_id` - see `etl/bin/check_anonymized.rb`. |
| Ruby security scan | [Brakeman](https://brakeman.org/) (run with `--force`, since `etl/` is Sinatra/Kiba, not Rails) and [bundler-audit](https://github.com/rubysec/bundler-audit) against known gem CVEs. |
| Ruby lint | [RuboCop](https://rubocop.org/) over `etl/` (see `etl/.rubocop.yml`), run via `bundle exec rubocop` or `bundle exec rake` (which runs it alongside the test suite). |
| CodeQL | GitHub's static analysis for both the Ruby ETL/tagging tool and the Svelte/TypeScript app. |
| Svelte checks, tests & build | `svelte-check`, the Vitest unit tests (`app/src/lib/stats.test.ts`), and a production build. |

All are intended to be required status checks on the default branch.

## The dashboard

The app reads like a short story for each year: a
headline, a plain-English narrative for each finding and a chapter at the
end that compares wellbeing signals and referrals across every year of data
available, so trends are easy to spot.

## Reporting questions

1. Split male/female
2. Age ranges
3. Sleep issues
4. Nutritional underfuelling while presenting overall healthy (good cholesterol, good blood pressure)
5. Stress/burnout
6. Number of acupuncture referrals
7. Mental health referrals

## Privacy

The final CSVs never contain names or dates of birth - only a
non-reversible pseudonymous id (derived from a local, never-committed
salt), age, gender and health metrics/flags.
