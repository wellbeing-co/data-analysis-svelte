require "csv"
require "fileutils"

module Etl
  class TaggingStore
    TAG_COLUMNS = %w[sleep_issue stress_burnout acupuncture_referral mental_health_referral].freeze

    HEADERS = (%w[pseudonymous_id source_file gender age] + TAG_COLUMNS + %w[personal_report_excerpt]).freeze

    def self.load(path)
      return {} unless File.exist?(path)

      CSV.read(path, headers: true).to_h do |row|
        [row["pseudonymous_id"], row.to_h]
      end
    end

    def self.write(path, rows)
      FileUtils.mkdir_p(File.dirname(path))

      CSV.open(path, "w") do |csv|
        csv << HEADERS
        rows.each do |row|
          csv << HEADERS.map { |h| row[h] }
        end
      end
    end

    def self.blank_tag
      "TODO(Y/N)"
    end
  end
end
