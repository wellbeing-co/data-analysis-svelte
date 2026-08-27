// Node.js port of ../../etl/lib/etl/derivations.rb.
"use strict";

const crypto = require("node:crypto");

function pseudonymousId(year, filename, salt) {
  return crypto
    .createHash("sha256")
    .update(`${salt}:${year}:${filename}`)
    .digest("hex")
    .slice(0, 12);
}

function ageRange(age) {
  if (age == null) return null;
  if (age <= 19) return "Under 20";
  if (age <= 39) return "20-39";
  if (age <= 59) return "40-59";
  if (age <= 79) return "60-79";
  return "80+";
}

const CATEGORY_ORDER = { green: 0, amber: 1, red: 2 };
const CATEGORY_LABEL = { green: "Green", amber: "Amber", red: "Red" };

function worseCategory(a, b) {
  return CATEGORY_ORDER[a] >= CATEGORY_ORDER[b] ? CATEGORY_LABEL[a] : CATEGORY_LABEL[b];
}

function bloodPressureCategory(systolic, diastolic) {
  if (systolic == null || diastolic == null) return null;

  const systolicCat = systolic >= 140 ? "red" : systolic >= 130 ? "amber" : "green";
  const diastolicCat = diastolic >= 90 ? "red" : diastolic >= 85 ? "amber" : "green";
  return worseCategory(systolicCat, diastolicCat);
}

function nonHdlCholesterolCategory(value) {
  if (value == null) return null;
  if (value > 4.9) return "High";
  if (value >= 3.37) return "Borderline High";
  return "Optimal";
}

function hdlCholesterolCategory(value, gender) {
  if (value == null) return null;
  const lowThreshold = (gender || "").toLowerCase() === "female" ? 1.29 : 1.03;
  if (value > 1.55) return "Optimal";
  if (value >= lowThreshold) return "Average";
  return "Low";
}

function overallHealthy(bpCategory, nonHdlCategory, hdlCategory) {
  return bpCategory === "Green" && nonHdlCategory !== "High" && hdlCategory !== "Low";
}

const UNDERFUELLING_KEYWORDS = [
  "underfuel", "under-fuel", "under fuel",
  "under eating", "undereating", "under-eating",
  "not eating enough", "skipping meals", "skips meals", "skip meals",
  "restrict", "low calorie", "low-calorie", "insufficient intake",
  "not fuelling", "not fueling", "inadequate intake"
];

function nutritionalUnderfuellingFlag(nutritionText) {
  if (!nutritionText) return false;
  const text = nutritionText.toLowerCase();
  return UNDERFUELLING_KEYWORDS.some((kw) => text.includes(kw));
}

module.exports = {
  pseudonymousId,
  ageRange,
  bloodPressureCategory,
  nonHdlCholesterolCategory,
  hdlCholesterolCategory,
  overallHealthy,
  nutritionalUnderfuellingFlag,
  UNDERFUELLING_KEYWORDS
};
