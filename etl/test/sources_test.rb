require "minitest/autorun"
require "tmpdir"
require_relative "../lib/etl/sources"

class SourcesTest < Minitest::Test
  def test_docx_folder_source_reads_docx_case_insensitively_recursively_and_skips_temp_files
    files = nil

    Dir.mktmpdir do |dir|
      File.write(File.join(dir, "lower.docx"), "")
      File.write(File.join(dir, "upper.DOCX"), "")
      File.write(File.join(dir, "mixed.DocX"), "")
      Dir.mkdir(File.join(dir, "nested"))
      File.write(File.join(dir, "nested", "inner.docx"), "")
      File.write(File.join(dir, "nested", "~$nested-temp.docx"), "")
      File.write(File.join(dir, "~$lock.docx"), "")
      File.write(File.join(dir, ".hidden.docx"), "")
      File.write(File.join(dir, "notes.txt"), "")

      files = []
      Etl::DocxFolderSource.new(dir).each do |path|
        files << path.delete_prefix("#{dir}/")
      end
    end

    assert_equal ["lower.docx", "mixed.DocX", "nested/inner.docx", "upper.DOCX"], files
  end
end
