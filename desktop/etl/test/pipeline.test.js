"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parse } = require("csv-parse/sync");

const pipeline = require("../pipeline");
const taggingStore = require("../taggingStore");
const { buildSampleDocxBuffer } = require("./fixtures/buildSampleDocx");

let tmpDir;
let yearFolder;
let taggingCsvPath;
let outputCsvPath;
const year = "2023";
const salt = "test-salt";

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wellbeing-pipeline-"));
  yearFolder = path.join(tmpDir, year);
  fs.mkdirSync(yearFolder);
  fs.writeFileSync(path.join(yearFolder, "Complete Wellbeing Sample 01012023.docx"), await buildSampleDocxBuffer());
  fs.writeFileSync(path.join(yearFolder, "~$Complete Wellbeing Sample 01012023.docx"), "lock");

  taggingCsvPath = path.join(tmpDir, `${year}_tagging.csv`);
  outputCsvPath = path.join(tmpDir, `${year}.csv`);
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("extractForTagging skips lock files and writes a tagging CSV with blank tags", async () => {
  const result = await pipeline.extractForTagging({ yearFolder, taggingCsvPath, year, salt });

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].gender, "Male");
  assert.equal(result.rows[0].sleep_issue, taggingStore.BLANK_TAG);
  assert.ok(fs.existsSync(taggingCsvPath));
});

test("extractForTagging preserves previously-filled tags on re-run", async () => {
  const first = await pipeline.extractForTagging({ yearFolder, taggingCsvPath, year, salt });
  const id = first.rows[0].pseudonymous_id;

  const tags = taggingStore.loadTagging(taggingCsvPath);
  tags[id].sleep_issue = "Y";
  tags[id].stress_burnout = "N";
  taggingStore.writeTagging(taggingCsvPath, Object.values(tags));

  const second = await pipeline.extractForTagging({ yearFolder, taggingCsvPath, year, salt });
  assert.equal(second.rows[0].sleep_issue, "Y");
  assert.equal(second.rows[0].stress_burnout, "N");
});

test("buildYearlyCsv throws a clear error when tagging hasn't been run yet", async () => {
  const missingTaggingPath = path.join(tmpDir, "missing_tagging.csv");
  await assert.rejects(
    () => pipeline.buildYearlyCsv({ yearFolder, taggingCsvPath: missingTaggingPath, outputCsvPath, year, salt }),
    /No tagging file found/
  );
});

test("full extract -> fill tags -> build round trip produces the expected CSV", async () => {
  const extracted = await pipeline.extractForTagging({ yearFolder, taggingCsvPath, year, salt });
  const id = extracted.rows[0].pseudonymous_id;

  const tags = taggingStore.loadTagging(taggingCsvPath);
  tags[id].sleep_issue = "Y";
  tags[id].stress_burnout = "n";
  taggingStore.writeTagging(taggingCsvPath, Object.values(tags));

  const built = await pipeline.buildYearlyCsv({ yearFolder, taggingCsvPath, outputCsvPath, year, salt });
  assert.equal(built.rows.length, 1);

  const row = built.rows[0];
  assert.equal(row.sleep_issue, "Y");
  assert.equal(row.stress_burnout, "N");
  assert.equal(row.acupuncture_referral, "Unknown");
  assert.equal(row.mental_health_referral, "Unknown");
  assert.equal(row.blood_pressure_systolic, 120);
  assert.equal(row.blood_pressure_category, "Green");

  const csvContent = fs.readFileSync(outputCsvPath, "utf8");
  const records = parse(csvContent, { columns: true });
  assert.equal(records.length, 1);
  assert.deepEqual(Object.keys(records[0]), pipeline.OUTPUT_HEADERS);
});

test("extractForTagging and buildYearlyCsv skip a corrupted .docx instead of crashing the whole folder", async () => {
  const mixedDir = fs.mkdtempSync(path.join(os.tmpdir(), "wellbeing-pipeline-mixed-"));
  try {
    fs.writeFileSync(path.join(mixedDir, "good.docx"), await buildSampleDocxBuffer());
    fs.writeFileSync(path.join(mixedDir, "corrupted.docx"), "this is not a zip file");

    const mixedTaggingPath = path.join(mixedDir, "tagging.csv");
    const mixedOutputPath = path.join(mixedDir, "output.csv");

    const extracted = await pipeline.extractForTagging({
      yearFolder: mixedDir,
      taggingCsvPath: mixedTaggingPath,
      year,
      salt
    });
    assert.equal(extracted.rows.length, 1);
    assert.equal(extracted.failures.length, 1);
    assert.equal(extracted.failures[0].file, "corrupted.docx");
    assert.match(extracted.failures[0].error, /corrupted\.docx/);

    const built = await pipeline.buildYearlyCsv({
      yearFolder: mixedDir,
      taggingCsvPath: mixedTaggingPath,
      outputCsvPath: mixedOutputPath,
      year,
      salt
    });
    assert.equal(built.rows.length, 1);
    assert.equal(built.failures.length, 1);
    assert.equal(built.failures[0].file, "corrupted.docx");
  } finally {
    fs.rmSync(mixedDir, { recursive: true, force: true });
  }
});
