require "csv"
require "fileutils"

module Etl
  # Simple Kiba CSV destination: writes rows (hashes) in a fixed column
  # order, creating the destination folder if needed.
  class CsvDestination
    def initialize(path, headers)
      FileUtils.mkdir_p(File.dirname(path))
      @csv = CSV.open(path, "w")
      @headers = headers
      @csv << @headers
    end

    def write(row)
      @csv << @headers.map { |h| row[h] }
    end

    def close
      @csv.close
    end
  end
end
