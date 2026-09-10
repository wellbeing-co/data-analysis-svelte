# ETL Tool for Healthcare Reports using Ruby / Kiba

This repo houses [Kiba](https://github.com/thbar/kiba) scripts written in Ruby
to process healthcare reports while safeguarding client privacy.

The goal was an open source, locally running tool that ingested word docs from
the local filesystem, processed and converted data into csv format and provided
a simple reporting dashboard to see trends over time.

One key constraint was source data formatting. The word docs follow a standard 
format, however no two word docs are the same when you consider hidden characters,
blank spaces or fudgy fingers on the wrong keys. Therefore there needed to be
a simple interface for manually reviewing large quantities of data and adjusting 
values by hand where the system has not been able to accurately process.

Here's what's included:

```
raw-data/*/           Source .docx reports (one folder per year)
etl/                  Ruby/Kiba ETL: docx -> anonymised CSVs
bin/extract           Guided ETL walkthrough (extract -> edit -> report-ready)
bin/tag               Browser UI with editable tagging table
.github/workflows/    Ruby ETL quality + privacy checks
```

## ETL pipeline

```
1. Perform extraction
   - `$ cd etl && bundle exec bin/extract <year>`
   - Writes `etl/tagging/<year>_tagging.csv`

2. Open the browser tagging page and run reports
   - Run `$ bin/tag`
   - Open the URL shown, review records, then Save & continue
```

In the interests of open data, both intermediary and final artifacts are plain
CSV files. Step 1 is post-extraction and data is stored at `etl/tagging/`.
`etl/output/` is where final  report-ready data is stored after manual processing.

## Quick start

1. Clone repo
2. Extract data
3. Tag / amend data
4. Run report

```
$ bin/extract
```

`bin/extract` handles dependency checks, extraction of raw data for tagging, the 
browser-based editing views and yearly anonymised final report CSV's under
`etl/output/`.

If a raw-data year folder has no `.docx` reports, `bin/extract` generates demo data for
that year in `etl/output/<year>.csv` so reports and charts can still load.

```
bin/tag
```

This runs a local web app for the transform/tagging stage so non-technical
reviewers can update records in the browser.

## Dashboard questions covered

The report page focuses on the following queries:

1. Split male/female
2. Age ranges
3. Sleep issues
4. Nutritional underfuelling while presenting overall healthy (good cholesterol, good blood pressure)
5. Stress/burnout
6. Number of acupuncture referrals
7. Number of mental health referrals

## Privacy

All CSV files generated are anonymous. Output includes only a non-reversible 
`pseudonymous_id` age, gender and health metrics needed for aggregate analysis.

See `etl/README.md` for ETL internals.
