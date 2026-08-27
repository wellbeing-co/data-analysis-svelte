#!/usr/bin/env ruby
# Generates a small, demo dataset with the same shape as
# a real etl/output/<year>.csv, so the Svelte app can be tested
# without needing real data. For UI development purposes only.
#
# Usage: bundle exec ruby bin/generate_demo_data.rb 2023 > ../app/static/data/2023.csv

require "csv"
require_relative "../lib/etl/derivations"

year = ARGV[0] or abort("Usage: #{$PROGRAM_NAME} YEAR")

HEADERS = %w[
  pseudonymous_id year gender age age_range
  height_cm weight_kg bmi body_fat_pct waist_cm waist_to_height_ratio
  blood_pressure_systolic blood_pressure_diastolic blood_pressure_category
  resting_pulse
  total_cholesterol hdl_cholesterol hdl_cholesterol_category
  non_hdl_cholesterol non_hdl_cholesterol_category
  non_fasted_glucose hba1c
  overall_healthy
  nutritional_underfuelling
  sleep_issue stress_burnout acupuncture_referral mental_health_referral
].freeze

srand(1000 + year.to_i)

# Nudge a few rates by year (relative to a 2023 baseline) so the demo dataset
# tells a plausible story across years rather than looking flat/random.
year_offset = year.to_i - 2023
stress_rate = [0.20 + (0.05 * year_offset), 0.75].min
sleep_rate = [0.28 + (0.03 * year_offset), 0.75].min
acupuncture_rate = [0.15 + (0.03 * year_offset), 0.6].min
mental_health_rate = [0.10 + (0.03 * year_offset), 0.6].min
unknown_rate = 0.12

def yes_no_unknown_for(rate, unknown_rate)
  roll = rand
  return "Unknown" if roll < unknown_rate

  roll -= unknown_rate
  roll < rate ? "Y" : "N"
end

rows = 40.times.map do |i|
  gender = %w[Male Female].sample
  age = rand(19..78)
  systolic = rand(105..150)
  diastolic = rand(65..95)
  hdl = (0.8 + (rand * 1.2)).round(2)
  non_hdl = (2.5 + (rand * 3.0)).round(2)
  total_cholesterol = (hdl + non_hdl).round(2)

  bp_category = Etl::Derivations.blood_pressure_category(systolic, diastolic)
  non_hdl_category = Etl::Derivations.non_hdl_cholesterol_category(non_hdl)
  hdl_category = Etl::Derivations.hdl_cholesterol_category(hdl, gender)
  overall_healthy = Etl::Derivations.overall_healthy?(bp_category, non_hdl_category, hdl_category)

  {
    "pseudonymous_id" => format("demo-%<year>s-%<index>03d", year: year, index: i + 1),
    "year" => year,
    "gender" => gender,
    "age" => age,
    "age_range" => Etl::Derivations.age_range(age),
    "height_cm" => rand(155..195),
    "weight_kg" => rand(55..100),
    "bmi" => (20 + (rand * 12)).round(1),
    "body_fat_pct" => (12 + (rand * 25)).round(1),
    "waist_cm" => rand(70..110),
    "waist_to_height_ratio" => (0.4 + (rand * 0.25)).round(2),
    "blood_pressure_systolic" => systolic,
    "blood_pressure_diastolic" => diastolic,
    "blood_pressure_category" => bp_category,
    "resting_pulse" => rand(50..95),
    "total_cholesterol" => total_cholesterol,
    "hdl_cholesterol" => hdl,
    "hdl_cholesterol_category" => hdl_category,
    "non_hdl_cholesterol" => non_hdl,
    "non_hdl_cholesterol_category" => non_hdl_category,
    "non_fasted_glucose" => (4.5 + (rand * 4)).round(1),
    "hba1c" => (4.5 + (rand * 2.5)).round(1),
    "overall_healthy" => overall_healthy ? "Y" : "N",
    "nutritional_underfuelling" => overall_healthy && rand < 0.35 ? "Y" : "N",
    "sleep_issue" => yes_no_unknown_for(sleep_rate, unknown_rate),
    "stress_burnout" => yes_no_unknown_for(stress_rate, unknown_rate),
    "acupuncture_referral" => rand < acupuncture_rate ? "Y" : "N",
    "mental_health_referral" => rand < mental_health_rate ? "Y" : "N"
  }
end

CSV do |csv|
  csv << HEADERS
  rows.each { |row| csv << HEADERS.map { |h| row[h] } }
end
