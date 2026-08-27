#!/usr/bin/env ruby
# Stage 2: combine the extracted/derived health metrics for a year with the
# completed tagging CSV for that year, producing the final anonymised
# CSV consumed by Svelte (output/<year>.csv).
#
# Requires that jobs/extract_for_tagging.rb has already been run for this
# year AND that the resulting tagging CSV has its Y/N columns filled in
# (rows still containing the TODO placeholder are flagged as "Unknown").
#
# Usage: bundle exec ruby jobs/build_yearly_csv.rb 2023

require "kiba"
require_relative "../lib/etl/sources"
require_relative "../lib/etl/report_extractor"
require_relative "../lib/etl/derivations"
require_relative "../lib/etl/tagging_store"
require_relative "../lib/etl/csv_destination"
require_relative "../lib/etl/salt"

year = ARGV[0] or abort("Usage: #{$PROGRAM_NAME} YEAR")

root = File.expand_path("../..", __dir__)
year_folder = File.join(root, "raw-data", year)
abort("No such folder: #{year_folder}") unless Dir.exist?(year_folder)

tagging_path = File.join(root, "etl", "tagging", "#{year}_tagging.csv")
unless File.exist?(tagging_path)
  abort("No tagging file found at #{tagging_path}.\n" \
        "Run `bundle exec ruby jobs/extract_for_tagging.rb #{year}` first, fill in the tags, then retry.")
end

tags = Etl::TaggingStore.load(tagging_path)
salt = Etl::Salt.value

OUTPUT_HEADERS = %w[
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

def yes_no_unknown(value)
  case value.to_s.strip.upcase
  when "Y", "YES", "TRUE" then "Y"
  when "N", "NO", "FALSE" then "N"
  else "Unknown"
  end
end

job = Kiba.parse do
  source Etl::DocxFolderSource, year_folder

  transform do |path|
    report = Etl::ReportExtractor.extract(path)
    id = Etl::Derivations.pseudonymous_id(year, File.basename(path), salt)
    tag_row = tags[id]

    unless tag_row
      warn "WARNING: #{File.basename(path)} has no matching tagging row (id=#{id}). " \
           "Run jobs/extract_for_tagging.rb #{year} again before building. Skipping this file."
      next nil
    end

    bp_category = Etl::Derivations.blood_pressure_category(
      report.blood_pressure_systolic, report.blood_pressure_diastolic
    )
    non_hdl_category = Etl::Derivations.non_hdl_cholesterol_category(report.non_hdl_cholesterol)
    hdl_category = Etl::Derivations.hdl_cholesterol_category(report.hdl_cholesterol, report.gender)

    {
      "pseudonymous_id" => id,
      "year" => year,
      "gender" => report.gender,
      "age" => report.age,
      "age_range" => Etl::Derivations.age_range(report.age),
      "height_cm" => report.height_cm,
      "weight_kg" => report.weight_kg,
      "bmi" => report.bmi,
      "body_fat_pct" => report.body_fat_pct,
      "waist_cm" => report.waist_cm,
      "waist_to_height_ratio" => report.waist_to_height_ratio,
      "blood_pressure_systolic" => report.blood_pressure_systolic,
      "blood_pressure_diastolic" => report.blood_pressure_diastolic,
      "blood_pressure_category" => bp_category,
      "resting_pulse" => report.resting_pulse,
      "total_cholesterol" => report.total_cholesterol,
      "hdl_cholesterol" => report.hdl_cholesterol,
      "hdl_cholesterol_category" => hdl_category,
      "non_hdl_cholesterol" => report.non_hdl_cholesterol,
      "non_hdl_cholesterol_category" => non_hdl_category,
      "non_fasted_glucose" => report.non_fasted_glucose,
      "hba1c" => report.hba1c,
      "overall_healthy" => Etl::Derivations.overall_healthy?(bp_category, non_hdl_category, hdl_category) ? "Y" : "N",
      "nutritional_underfuelling" => Etl::Derivations.nutritional_underfuelling_flag(report.nutrition_text) ? "Y" : "N",
      "sleep_issue" => yes_no_unknown(tag_row["sleep_issue"]),
      "stress_burnout" => yes_no_unknown(tag_row["stress_burnout"]),
      "acupuncture_referral" => yes_no_unknown(tag_row["acupuncture_referral"]),
      "mental_health_referral" => yes_no_unknown(tag_row["mental_health_referral"])
    }
  end

  destination Etl::CsvDestination, File.join(root, "etl", "output", "#{year}.csv"), OUTPUT_HEADERS
end

Kiba.run(job)

puts "Wrote #{File.join('etl', 'output', "#{year}.csv")}"
