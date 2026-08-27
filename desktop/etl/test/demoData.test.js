"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parse } = require("csv-parse/sync");

const { generateDemoCsv } = require("../demoData");
const { OUTPUT_HEADERS } = require("../pipeline");

test("generateDemoCsv produces 40 rows with the same headers as a real build", async () => {
  const csv = await generateDemoCsv("2023");
  const records = parse(csv, { columns: true });

  assert.equal(records.length, 40);
  assert.deepEqual(Object.keys(records[0]), OUTPUT_HEADERS);
  assert.equal(records[0].year, "2023");
  assert.match(records[0].pseudonymous_id, /^demo-2023-\d{3}$/);
});

test("generateDemoCsv is deterministic for the same year", async () => {
  const first = await generateDemoCsv("2024");
  const second = await generateDemoCsv("2024");
  assert.equal(first, second);
});
