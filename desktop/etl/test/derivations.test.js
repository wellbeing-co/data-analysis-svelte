"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const derivations = require("../derivations");

test("pseudonymousId is deterministic and non-reversible", () => {
  const a = derivations.pseudonymousId("2023", "report.docx", "salt-value");
  const b = derivations.pseudonymousId("2023", "report.docx", "salt-value");
  const c = derivations.pseudonymousId("2023", "other.docx", "salt-value");

  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 12);
  assert.doesNotMatch(a, /report\.docx/);
});

test("ageRange buckets match the template's body-fat bands", () => {
  assert.equal(derivations.ageRange(null), null);
  assert.equal(derivations.ageRange(0), "Under 20");
  assert.equal(derivations.ageRange(19), "Under 20");
  assert.equal(derivations.ageRange(20), "20-39");
  assert.equal(derivations.ageRange(39), "20-39");
  assert.equal(derivations.ageRange(40), "40-59");
  assert.equal(derivations.ageRange(59), "40-59");
  assert.equal(derivations.ageRange(60), "60-79");
  assert.equal(derivations.ageRange(79), "60-79");
  assert.equal(derivations.ageRange(80), "80+");
  assert.equal(derivations.ageRange(120), "80+");
});

test("bloodPressureCategory takes the worse of systolic/diastolic", () => {
  assert.equal(derivations.bloodPressureCategory(null, 80), null);
  assert.equal(derivations.bloodPressureCategory(120, 80), "Green");
  assert.equal(derivations.bloodPressureCategory(132, 80), "Amber");
  assert.equal(derivations.bloodPressureCategory(120, 87), "Amber");
  assert.equal(derivations.bloodPressureCategory(141, 80), "Red");
  assert.equal(derivations.bloodPressureCategory(120, 91), "Red");
  // boundaries
  assert.equal(derivations.bloodPressureCategory(129, 84), "Green");
  assert.equal(derivations.bloodPressureCategory(130, 85), "Amber");
  assert.equal(derivations.bloodPressureCategory(139, 89), "Amber");
  assert.equal(derivations.bloodPressureCategory(140, 90), "Red");
});

test("nonHdlCholesterolCategory thresholds", () => {
  assert.equal(derivations.nonHdlCholesterolCategory(null), null);
  assert.equal(derivations.nonHdlCholesterolCategory(3.0), "Optimal");
  assert.equal(derivations.nonHdlCholesterolCategory(3.37), "Borderline High");
  assert.equal(derivations.nonHdlCholesterolCategory(4.9), "Borderline High");
  assert.equal(derivations.nonHdlCholesterolCategory(4.91), "High");
});

test("hdlCholesterolCategory differs by gender", () => {
  assert.equal(derivations.hdlCholesterolCategory(null, "Male"), null);
  assert.equal(derivations.hdlCholesterolCategory(1.6, "Male"), "Optimal");
  assert.equal(derivations.hdlCholesterolCategory(1.03, "Male"), "Average");
  assert.equal(derivations.hdlCholesterolCategory(1.02, "Male"), "Low");
  assert.equal(derivations.hdlCholesterolCategory(1.3, "Female"), "Average");
  assert.equal(derivations.hdlCholesterolCategory(1.28, "Female"), "Low");
  assert.equal(derivations.hdlCholesterolCategory(1.29, "Female"), "Average");
  // gender unknown falls back to male thresholds
  assert.equal(derivations.hdlCholesterolCategory(1.1, undefined), "Average");
});

test("overallHealthy requires green BP, non-high non-HDL and non-low HDL", () => {
  assert.equal(derivations.overallHealthy("Green", "Optimal", "Optimal"), true);
  assert.equal(derivations.overallHealthy("Amber", "Optimal", "Optimal"), false);
  assert.equal(derivations.overallHealthy("Green", "High", "Optimal"), false);
  assert.equal(derivations.overallHealthy("Green", "Optimal", "Low"), false);
});

test("nutritionalUnderfuellingFlag matches keywords case-insensitively", () => {
  assert.equal(derivations.nutritionalUnderfuellingFlag(""), false);
  assert.equal(derivations.nutritionalUnderfuellingFlag(null), false);
  assert.equal(derivations.nutritionalUnderfuellingFlag("Client reports SKIPPING MEALS regularly."), true);
  assert.equal(derivations.nutritionalUnderfuellingFlag("Follows a low-calorie diet on weekdays."), true);
  assert.equal(derivations.nutritionalUnderfuellingFlag("Eats a varied, balanced diet."), false);
});
