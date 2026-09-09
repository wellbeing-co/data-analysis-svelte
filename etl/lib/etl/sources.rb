module Etl
  # Kiba source that yields the path of every .docx report found inside a
  # given year folder (e.g. "../raw-data/2023"), including nested folders.
  # Hidden/temp files (starting with "." or "~$", as Word creates while a
  # file is open) are skipped.
  class DocxFolderSource
    def initialize(folder)
      @folder = folder
    end

    def each
      files = Dir.glob(File.join(@folder, "**", "*"), File::FNM_CASEFOLD)
        .select { |path| File.file?(path) }
        .select { |path| File.extname(path).casecmp(".docx").zero? }
        .reject { |path| File.basename(path).start_with?(".", "~$") }
        .sort

      files.each { |path| yield(path) }
    end
  end
end
