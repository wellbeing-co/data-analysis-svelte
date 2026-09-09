require "minitest/autorun"
require "tmpdir"
require_relative "../lib/etl/sources"

class SourcesTest < Minitest::Test
  def test_docx_folder_source_reads_docx_case_insensitively_and_skips_temp_files
    files = nil

    Dir.mktmpdir do |dir|
      File.write(File.join(dir, "lower.docx"), "")
      File.write(File.join(dir, "upper.DOCX"), "")
      File.write(File.join(dir, "mixed.DocX"), "")
      File.write(File.join(dir, "~$lock.docx"), "")
      File.write(File.join(dir, ".hidden.docx"), "")
      File.write(File.join(dir, "notes.txt"), "")

      files = []
      Etl::DocxFolderSource.new(dir).each { |path| files << File.basename(path) }
    end

    assert_equal %w[lower.docx mixed.DocX upper.DOCX], files
  end
end
