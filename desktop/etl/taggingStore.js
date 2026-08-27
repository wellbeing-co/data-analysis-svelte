// Node.js port of ../../etl/lib/etl/tagging_store.rb.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const TAG_COLUMNS = ["sleep_issue", "stress_burnout", "acupuncture_referral", "mental_health_referral"];

const HEADERS = ["pseudonymous_id", "source_file", "gender", "age", ...TAG_COLUMNS, "personal_report_excerpt"];

const BLANK_TAG = "TODO(Y/N)";

function loadTagging(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const content = fs.readFileSync(filePath, "utf8");
  const records = parse(content, { columns: true, skip_empty_lines: true });

  const byId = {};
  for (const row of records) {
    byId[row.pseudonymous_id] = row;
  }
  return byId;
}

function writeTagging(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const data = rows.map((row) => HEADERS.map((header) => row[header] ?? ""));
  const csv = stringify([HEADERS, ...data]);
  fs.writeFileSync(filePath, csv);
}

module.exports = { TAG_COLUMNS, HEADERS, BLANK_TAG, loadTagging, writeTagging };
