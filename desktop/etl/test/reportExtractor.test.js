"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { extractReport } = require("../reportExtractor");
const { buildSampleDocxBuffer } = require("./fixtures/buildSampleDocx");

let tmpDir;
let samplePath;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wellbeing-docx-"));
  samplePath = path.join(tmpDir, "Complete Wellbeing Sample 01012023.docx");
  fs.writeFileSync(samplePath, await buildSampleDocxBuffer());
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Same assertions as ../../../etl/test/report_extractor_test.rb, against an
// equivalent hand-built fixture (the real sample docx is intentionally not
// present in this environment).
test("extracts gender and age from the sample report", async () => {
  const report = await extractReport(samplePath);
  assert.equal(report.gender, "Male");
  assert.equal(report.age, 46);
});

test("extracts narrative sections for tagging", async () => {
  const report = await extractReport(samplePath);
  assert.match(report.personal_report_text, /stress/);
  assert.match(report.personal_report_text, /sleep/);
  assert.match(report.nutrition_text, /Mediterranean Style of Diet/);
});

test("summary table labels are found even when unfilled", async () => {
  const report = await extractReport(samplePath);
  // "Height (cm)" has the placeholder value "x" in the fixture (as in the
  // real template), so it should resolve to null rather than throwing/NaN.
  assert.equal(report.height_cm, null);
  assert.equal(report.blood_pressure_systolic, 120);
  assert.equal(report.blood_pressure_diastolic, 80);
  assert.equal(report.hdl_cholesterol, 1.5);
});
