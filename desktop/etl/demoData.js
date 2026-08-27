"use strict";

const { stringify } = require("csv-stringify/sync");
const derivations = require("./derivations");
const { OUTPUT_HEADERS } = require("./pipeline");

// Small deterministic PRNG (mulberry32), seeded per year so re-generating
// demo data for the same year is stable but different years look distinct.
function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function yesNoUnknownFor(random, rate, unknownRate) {
  let roll = random();
  if (roll < unknownRate) return "Unknown";
  roll -= unknownRate;
  return roll < rate ? "Y" : "N";
}

async function generateDemoCsv(year) {
  const yearNum = parseInt(year, 10);
  const random = makeRandom(1000 + yearNum);

  const yearOffset = yearNum - 2023;
  const stressRate = Math.min(0.2 + 0.05 * yearOffset, 0.75);
  const sleepRate = Math.min(0.28 + 0.03 * yearOffset, 0.75);
  const acupunctureRate = Math.min(0.15 + 0.03 * yearOffset, 0.6);
  const mentalHealthRate = Math.min(0.1 + 0.03 * yearOffset, 0.6);
  const unknownRate = 0.12;

  const rows = Array.from({ length: 40 }, (_, i) => {
    const gender = random() < 0.5 ? "Male" : "Female";
    const age = randomInt(random, 19, 78);
    const systolic = randomInt(random, 105, 150);
    const diastolic = randomInt(random, 65, 95);
    const hdl = round(0.8 + random() * 1.2, 2);
    const nonHdl = round(2.5 + random() * 3.0, 2);
    const totalCholesterol = round(hdl + nonHdl, 2);

    const bpCategory = derivations.bloodPressureCategory(systolic, diastolic);
    const nonHdlCategory = derivations.nonHdlCholesterolCategory(nonHdl);
    const hdlCategory = derivations.hdlCholesterolCategory(hdl, gender);
    const overallHealthy = derivations.overallHealthy(bpCategory, nonHdlCategory, hdlCategory);

    return {
      pseudonymous_id: `demo-${year}-${String(i + 1).padStart(3, "0")}`,
      year,
      gender,
      age,
      age_range: derivations.ageRange(age),
      height_cm: randomInt(random, 155, 195),
      weight_kg: randomInt(random, 55, 100),
      bmi: round(20 + random() * 12, 1),
      body_fat_pct: round(12 + random() * 25, 1),
      waist_cm: randomInt(random, 70, 110),
      waist_to_height_ratio: round(0.4 + random() * 0.25, 2),
      blood_pressure_systolic: systolic,
      blood_pressure_diastolic: diastolic,
      blood_pressure_category: bpCategory,
      resting_pulse: randomInt(random, 50, 95),
      total_cholesterol: totalCholesterol,
      hdl_cholesterol: hdl,
      hdl_cholesterol_category: hdlCategory,
      non_hdl_cholesterol: nonHdl,
      non_hdl_cholesterol_category: nonHdlCategory,
      non_fasted_glucose: round(4.5 + random() * 4, 1),
      hba1c: round(4.5 + random() * 2.5, 1),
      overall_healthy: overallHealthy ? "Y" : "N",
      nutritional_underfuelling: overallHealthy && random() < 0.35 ? "Y" : "N",
      sleep_issue: yesNoUnknownFor(random, sleepRate, unknownRate),
      stress_burnout: yesNoUnknownFor(random, stressRate, unknownRate),
      acupuncture_referral: random() < acupunctureRate ? "Y" : "N",
      mental_health_referral: random() < mentalHealthRate ? "Y" : "N"
    };
  });

  const data = rows.map((row) => OUTPUT_HEADERS.map((header) => row[header] ?? ""));
  return stringify([OUTPUT_HEADERS, ...data]);
}

module.exports = { generateDemoCsv };
