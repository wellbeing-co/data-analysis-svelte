module Etl
  # Kiba source that yields the path of every .docx report found directly
  # inside a given year folder (e.g. "../raw-data/2023"). Hidden/temp files
  # (starting with "." or "~$", as Word creates while a file is open) are skipped.
  class DocxFolderSource
    def initialize(folder)
      @folder = folder
    end

    def each
      Dir.glob(File.join(@folder, "*.docx")).sort.each do |path|
        basename = File.basename(path)
        next if basename.start_with?(".", "~$")

        yield(path)
      end
    end
  end
end
