"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { stringify } = require("csv-stringify/sync");

const { extractReport } = require("./reportExtractor");
const derivations = require("./derivations");
const taggingStore = require("./taggingStore");

// Same shape as ../../etl/jobs/build_yearly_csv.rb's OUTPUT_HEADERS.
const OUTPUT_HEADERS = [
  "pseudonymous_id", "year", "gender", "age", "age_range",
  "height_cm", "weight_kg", "bmi", "body_fat_pct", "waist_cm", "waist_to_height_ratio",
  "blood_pressure_systolic", "blood_pressure_diastolic", "blood_pressure_category",
  "resting_pulse",
  "total_cholesterol", "hdl_cholesterol", "hdl_cholesterol_category",
  "non_hdl_cholesterol", "non_hdl_cholesterol_category",
  "non_fasted_glucose", "hba1c",
  "overall_healthy",
  "nutritional_underfuelling",
  "sleep_issue", "stress_burnout", "acupuncture_referral", "mental_health_referral"
];

function listDocxFiles(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((name) => /\.docx$/i.test(name) && !name.startsWith(".") && !name.startsWith("~$"))
    .sort()
    .map((name) => path.join(folder, name));
}

function yesNoUnknown(value) {
  const normalised = (value ?? "").toString().trim().toUpperCase();
  if (["Y", "YES", "TRUE"].includes(normalised)) return "Y";
  if (["N", "NO", "FALSE"].includes(normalised)) return "N";
  return "Unknown";
}

// extractReport() throws a low-level jszip/xml error (e.g. "Can't find end of
// central directory") when a file isn't a valid, complete .docx - which
// happens when a file is corrupted, still syncing from cloud storage, or is
// actually a different format (e.g. a legacy .doc) saved with a .docx
// extension. Wrap that into a message naming the offending file, so a single
// bad file doesn't produce a confusing crash and can be reported/skipped
// instead of aborting the whole folder.
async function safeExtractReport(filePath, sourceFile) {
  try {
    return await extractReport(filePath);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not read "${sourceFile}" as a .docx file (${reason}). It may be corrupted, still ` +
        `syncing from cloud storage, or saved in a different format - remove or re-export it and try again.`
    );
  }
}

/**
 * Stage 1: scan a year's folder of .docx reports and produce/update the
 * tagging CSV for that year, preserving any tags already filled in.
 */
async function extractForTagging({ yearFolder, taggingCsvPath, year, salt }) {
  const existingTags = taggingStore.loadTagging(taggingCsvPath);
  const rows = [];
  const failures = [];

  for (const filePath of listDocxFiles(yearFolder)) {
    const sourceFile = path.basename(filePath);
    let report;
    try {
      report = await safeExtractReport(filePath, sourceFile);
    } catch (err) {
      failures.push({ file: sourceFile, error: err.message });
      continue;
    }
    const id = derivations.pseudonymousId(year, sourceFile, salt);
    const existing = existingTags[id];

    rows.push({
      pseudonymous_id: id,
      source_file: sourceFile,
      gender: report.gender,
      age: report.age,
      sleep_issue: existing?.sleep_issue || taggingStore.BLANK_TAG,
      stress_burnout: existing?.stress_burnout || taggingStore.BLANK_TAG,
      acupuncture_referral: existing?.acupuncture_referral || taggingStore.BLANK_TAG,
      mental_health_referral: existing?.mental_health_referral || taggingStore.BLANK_TAG,
      personal_report_excerpt: (report.personal_report_text || "").replace(/\n{2,}/g, " ").trim()
    });
  }

  taggingStore.writeTagging(taggingCsvPath, rows);
  return { rows, taggingCsvPath, failures };
}

/**
 * Stage 2: combine the extracted/derived health metrics for a year with the
 * completed tagging CSV for that year, producing the final anonymised CSV.
 */
async function buildYearlyCsv({ yearFolder, taggingCsvPath, outputCsvPath, year, salt }) {
  if (!fs.existsSync(taggingCsvPath)) {
    throw new Error(
      `No tagging file found at ${taggingCsvPath}. Run extraction for ${year} first, fill in the tags, then retry.`
    );
  }

  const tags = taggingStore.loadTagging(taggingCsvPath);
  const rows = [];
  const failures = [];

  for (const filePath of listDocxFiles(yearFolder)) {
    const sourceFile = path.basename(filePath);
    let report;
    try {
      report = await safeExtractReport(filePath, sourceFile);
    } catch (err) {
      failures.push({ file: sourceFile, error: err.message });
      continue;
    }
    const id = derivations.pseudonymousId(year, sourceFile, salt);
    const tagRow = tags[id];

    if (!tagRow) {
      // eslint-disable-next-line no-console
      console.warn(
        `WARNING: ${sourceFile} has no matching tagging row (id=${id}). ` +
          `Run extraction for ${year} again before building. Skipping this file.`
      );
      continue;
    }

    const bpCategory = derivations.bloodPressureCategory(
      report.blood_pressure_systolic,
      report.blood_pressure_diastolic
    );
    const nonHdlCategory = derivations.nonHdlCholesterolCategory(report.non_hdl_cholesterol);
    const hdlCategory = derivations.hdlCholesterolCategory(report.hdl_cholesterol, report.gender);

    rows.push({
      pseudonymous_id: id,
      year,
      gender: report.gender,
      age: report.age,
      age_range: derivations.ageRange(report.age),
      height_cm: report.height_cm,
      weight_kg: report.weight_kg,
      bmi: report.bmi,
      body_fat_pct: report.body_fat_pct,
      waist_cm: report.waist_cm,
      waist_to_height_ratio: report.waist_to_height_ratio,
      blood_pressure_systolic: report.blood_pressure_systolic,
      blood_pressure_diastolic: report.blood_pressure_diastolic,
      blood_pressure_category: bpCategory,
      resting_pulse: report.resting_pulse,
      total_cholesterol: report.total_cholesterol,
      hdl_cholesterol: report.hdl_cholesterol,
      hdl_cholesterol_category: hdlCategory,
      non_hdl_cholesterol: report.non_hdl_cholesterol,
      non_hdl_cholesterol_category: nonHdlCategory,
      non_fasted_glucose: report.non_fasted_glucose,
      hba1c: report.hba1c,
      overall_healthy: derivations.overallHealthy(bpCategory, nonHdlCategory, hdlCategory) ? "Y" : "N",
      nutritional_underfuelling: derivations.nutritionalUnderfuellingFlag(report.nutrition_text) ? "Y" : "N",
      sleep_issue: yesNoUnknown(tagRow.sleep_issue),
      stress_burnout: yesNoUnknown(tagRow.stress_burnout),
      acupuncture_referral: yesNoUnknown(tagRow.acupuncture_referral),
      mental_health_referral: yesNoUnknown(tagRow.mental_health_referral)
    });
  }

  fs.mkdirSync(path.dirname(outputCsvPath), { recursive: true });
  const data = rows.map((row) => OUTPUT_HEADERS.map((header) => row[header] ?? ""));
  fs.writeFileSync(outputCsvPath, stringify([OUTPUT_HEADERS, ...data]));

  return { rows, outputCsvPath, failures };
}

module.exports = { OUTPUT_HEADERS, listDocxFiles, yesNoUnknown, extractForTagging, buildYearlyCsv };
