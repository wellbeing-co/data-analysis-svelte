// Node.js port of ../../etl/lib/etl/report_extractor.rb - extracts specific
// fields from a "Complete Wellbeing Health Assessment" docx, based on the
// 2023 sample template:
//  - Gender / age, from the header line under the title.
//  - The "Summary of Key Results" table, for the numeric health metrics.
//  - The "Personal Report" narrative, for sleep/stress/referral tagging.
//  - The Nutrition paragraph, for the underfuelling keyword flag.
"use strict";

const { DocxDocument } = require("./docxDocument");

function capitalize(word) {
  if (!word) return word;
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

function headerLine(paragraphs) {
  return paragraphs.find((p) => /Gender:/i.test(p)) || null;
}

function extractGender(paragraphs) {
  const line = headerLine(paragraphs);
  if (!line) return null;
  const match = line.match(/Gender:\s*([A-Za-z]+)/i);
  return match ? capitalize(match[1]) : null;
}

function extractAge(paragraphs) {
  const line = headerLine(paragraphs);
  if (!line) return null;
  const match = line.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : null;
}

function findSummaryTable(tables) {
  return tables.find((rows) => rows[0] && /Measurement/i.test(String(rows[0][0]))) || null;
}

function summaryLookup(tables) {
  const table = findSummaryTable(tables);
  const lookup = {};
  if (!table) return lookup;

  table.slice(1).forEach((row) => {
    const [label, value] = row;
    if (!label) return;
    lookup[label.trim()] = (value ?? "").toString().trim();
  });
  return lookup;
}

function parseBloodPressure(value) {
  if (!value) return [null, null];
  const match = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return [null, null];
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

function parseFloatField(value) {
  if (value == null || value === "") return null;
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function summaryMetrics(tables) {
  const lookup = summaryLookup(tables);
  const [systolic, diastolic] = parseBloodPressure(lookup["Blood Pressure (mmHg)"]);

  return {
    height_cm: parseFloatField(lookup["Height (cm)"]),
    weight_kg: parseFloatField(lookup["Weight (kg)"]),
    body_fat_pct: parseFloatField(lookup["Body Fat Percentage (%)"]),
    bmi: parseFloatField(lookup["Body Mass Index (kg/m2)"]),
    waist_cm: parseFloatField(lookup["Waist Circumference (cm)"]),
    waist_to_height_ratio: parseFloatField(lookup["Waist to Height Ratio"]),
    blood_pressure_systolic: systolic,
    blood_pressure_diastolic: diastolic,
    resting_pulse: parseFloatField(lookup["Resting Pulse (bpm)"]),
    total_cholesterol: parseFloatField(lookup["Total Cholesterol (mmol/l)"]),
    hdl_cholesterol: parseFloatField(lookup["HDL Cholesterol (mmol/l)"]),
    non_hdl_cholesterol: parseFloatField(lookup["Non-HDL Cholesterol (mmol/l)"]),
    non_fasted_glucose: parseFloatField(lookup["Non Fasted Blood Glucose (mmol/l)"]),
    hba1c: parseFloatField(lookup["HBA1C (%)"])
  };
}

// The narrative "Personal Report" section: everything between the
// "Personal Report" heading and the "Summary of Key Results" heading.
function personalReportText(paragraphs) {
  const startIndex = paragraphs.findIndex((p) => p.trim() === "Personal Report");
  const endIndex = paragraphs.findIndex((p) => p.trim() === "Summary of Key Results");
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return "";

  return paragraphs.slice(startIndex + 1, endIndex).join("\n\n");
}

function nutritionText(paragraphs) {
  return paragraphs.find((p) => /Nutrition section of the questionnaire/i.test(p)) || "";
}

async function extractReport(filePath) {
  const doc = await DocxDocument.load(filePath);
  const paragraphs = doc.paragraphs;
  const tables = doc.tables;

  return {
    gender: extractGender(paragraphs),
    age: extractAge(paragraphs),
    ...summaryMetrics(tables),
    personal_report_text: personalReportText(paragraphs),
    nutrition_text: nutritionText(paragraphs)
  };
}

module.exports = { extractReport };
