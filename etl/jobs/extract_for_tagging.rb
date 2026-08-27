#!/usr/bin/env ruby
# Stage 1: scan a year's folder of .docx reports and produce/update the
# "tagging" CSV for that year (etl/tagging/<year>_tagging.csv).
#
# The tagging CSV is the file someone needs to open in Excel to
# fill in Y/N for sleep_issue, stress_burnout, acupuncture_referral and
# mental_health_referral for each anonymised row, based on the narrative
# excerpt shown alongside it.
#
# Usage: bundle exec ruby jobs/extract_for_tagging.rb 2023

require "kiba"
require_relative "../lib/etl/sources"
require_relative "../lib/etl/report_extractor"
require_relative "../lib/etl/derivations"
require_relative "../lib/etl/tagging_store"
require_relative "../lib/etl/salt"

year = ARGV[0] or abort("Usage: #{$PROGRAM_NAME} YEAR")

root = File.expand_path("../..", __dir__)
year_folder = File.join(root, "raw-data", year)
abort("No such folder: #{year_folder}") unless Dir.exist?(year_folder)

tagging_path = File.join(root, "etl", "tagging", "#{year}_tagging.csv")
existing_tags = Etl::TaggingStore.load(tagging_path)
salt = Etl::Salt.value

rows = []

job = Kiba.parse do
  source Etl::DocxFolderSource, year_folder

  transform do |path|
    report = Etl::ReportExtractor.extract(path)
    id = Etl::Derivations.pseudonymous_id(year, File.basename(path), salt)
    existing = existing_tags[id]

    {
      "pseudonymous_id" => id,
      "source_file" => File.basename(path),
      "gender" => report.gender,
      "age" => report.age,
      "sleep_issue" => existing&.fetch("sleep_issue", nil) || Etl::TaggingStore.blank_tag,
      "stress_burnout" => existing&.fetch("stress_burnout", nil) || Etl::TaggingStore.blank_tag,
      "acupuncture_referral" => existing&.fetch("acupuncture_referral", nil) || Etl::TaggingStore.blank_tag,
      "mental_health_referral" => existing&.fetch("mental_health_referral", nil) || Etl::TaggingStore.blank_tag,
      "personal_report_excerpt" => report.personal_report_text.gsub(/\n{2,}/, " ").strip,
    }
  end

  transform do |row|
    rows << row
    row
  end
end

Kiba.run(job)

Etl::TaggingStore.write(tagging_path, rows)

puts "Wrote #{rows.size} row(s) to #{tagging_path}"
puts "=> Open this file, fill in Y/N for each #{Etl::TaggingStore::TAG_COLUMNS.join(', ')} column,"
puts "   then run: bundle exec ruby jobs/build_yearly_csv.rb #{year}"
