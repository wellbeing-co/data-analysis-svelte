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
    excerpt = report.personal_report_text.gsub(/\n{2,}/, " ").strip

    inferred_matches = Etl::TaggingStore::TAG_COLUMNS.to_h do |column|
      [column, Etl::Derivations.matched_keyword_from_excerpt(excerpt, column)]
    end

    inferred_tags = inferred_matches.transform_values { |match| match ? "Y" : nil }

    {
      "pseudonymous_id" => id,
      "source_file" => File.basename(path),
      "gender" => report.gender,
      "age" => report.age,
      "sleep_issue" => Etl::Derivations.resolve_tag(existing&.fetch("sleep_issue", nil), inferred_tags["sleep_issue"], Etl::TaggingStore.blank_tag),
      "stress_burnout" => Etl::Derivations.resolve_tag(existing&.fetch("stress_burnout", nil), inferred_tags["stress_burnout"], Etl::TaggingStore.blank_tag),
      "acupuncture_referral" => Etl::Derivations.resolve_tag(existing&.fetch("acupuncture_referral", nil), inferred_tags["acupuncture_referral"], Etl::TaggingStore.blank_tag),
      "mental_health_referral" => Etl::Derivations.resolve_tag(existing&.fetch("mental_health_referral", nil), inferred_tags["mental_health_referral"], Etl::TaggingStore.blank_tag),
      "sleep_issue_match" => inferred_matches["sleep_issue"],
      "stress_burnout_match" => inferred_matches["stress_burnout"],
      "acupuncture_referral_match" => inferred_matches["acupuncture_referral"],
      "mental_health_referral_match" => inferred_matches["mental_health_referral"],
      "personal_report_excerpt" => excerpt
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
puts "=> Start ../bin/tag, open /#{year}/edit, then use Save & continue in the web UI."
