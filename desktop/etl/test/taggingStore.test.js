"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const taggingStore = require("../taggingStore");

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wellbeing-tagging-"));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("loadTagging returns an empty object when the file doesn't exist yet", () => {
  const result = taggingStore.loadTagging(path.join(tmpDir, "missing.csv"));
  assert.deepEqual(result, {});
});

test("writeTagging then loadTagging round-trips rows keyed by pseudonymous_id", () => {
  const csvPath = path.join(tmpDir, "2023_tagging.csv");
  const rows = [
    {
      pseudonymous_id: "abc123",
      source_file: "report-1.docx",
      gender: "Male",
      age: "46",
      sleep_issue: "Y",
      stress_burnout: taggingStore.BLANK_TAG,
      acupuncture_referral: "N",
      mental_health_referral: "N",
      personal_report_excerpt: "Some excerpt, with a comma."
    }
  ];

  taggingStore.writeTagging(csvPath, rows);
  assert.ok(fs.existsSync(csvPath));

  const loaded = taggingStore.loadTagging(csvPath);
  assert.ok(loaded.abc123);
  assert.equal(loaded.abc123.sleep_issue, "Y");
  assert.equal(loaded.abc123.stress_burnout, taggingStore.BLANK_TAG);
  assert.equal(loaded.abc123.personal_report_excerpt, "Some excerpt, with a comma.");
});

test("TAG_COLUMNS and BLANK_TAG match the Ruby TaggingStore contract", () => {
  assert.deepEqual(taggingStore.TAG_COLUMNS, [
    "sleep_issue",
    "stress_burnout",
    "acupuncture_referral",
    "mental_health_referral"
  ]);
  assert.equal(taggingStore.BLANK_TAG, "TODO(Y/N)");
});
