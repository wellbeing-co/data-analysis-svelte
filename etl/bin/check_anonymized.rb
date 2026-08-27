#!/usr/bin/env ruby
# Fails (non-zero exit) if any published/output CSV contains a column that
# could re-identify a client, or is missing the pseudonymous id that proves
# it went through the anonymisation pipeline.
#
# Run from CI (see ../../.github/workflows/ci.yml) before anything is
# allowed to merge, so identifying data can never reach the public repo.
#
# Usage: bundle exec ruby bin/check_anonymized.rb

require "csv"

root = File.expand_path("../..", __dir__)

FORBIDDEN_HEADERS = %w[
  name first_name last_name full_name surname client_name
  dob date_of_birth birth_date birthdate
  email email_address phone phone_number mobile
  address street_address postcode post_code zip zip_code
  source_file
].freeze

REQUIRED_HEADERS = %w[pseudonymous_id].freeze

csv_files = Dir.glob(File.join(root, "app", "static", "data", "*.csv")) +
            Dir.glob(File.join(root, "etl", "output", "*.csv"))

if csv_files.empty?
  puts "No published CSVs found to check - nothing to do."
  exit 0
end

violations = []

csv_files.each do |path|
  headers = CSV.open(path, &:readline) || []
  normalised = headers.map { |h| h.to_s.strip.downcase }

  found_forbidden = normalised & FORBIDDEN_HEADERS
  violations << "#{path}: contains forbidden column(s) #{found_forbidden.join(', ')}" if found_forbidden.any?

  missing_required = REQUIRED_HEADERS - normalised
  if missing_required.any?
    violations << "#{path}: missing required anonymisation column(s) #{missing_required.join(', ')}"
  end
end

if violations.empty?
  puts "OK - #{csv_files.size} CSV file(s) checked, no PII columns found and all have pseudonymous_id."
  exit 0
else
  warn "Anonymisation check failed:"
  violations.each { |v| warn "  - #{v}" }
  warn ""
  warn "Remove any identifying columns before publishing data to app/static/data/ or etl/output/."
  exit 1
end
