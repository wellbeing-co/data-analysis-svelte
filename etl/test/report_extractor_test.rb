require "minitest/autorun"
require_relative "../lib/etl/report_extractor"

class ReportExtractorTest < Minitest::Test
  SAMPLE_PATH = "ignored.docx"
  SAMPLE_PARAGRAPHS = [
    "Complete Wellbeing Health Assessment",
    "Gender: male (46)",
    "Personal Report",
    "Client reports stress in daily life.",
    "Client reports poor sleep quality.",
    "Summary of Key Results",
    "Nutrition section of the questionnaire: Mediterranean Style of Diet"
  ].freeze

  SAMPLE_TABLE = [
    ["Measurement", "Value"],
    ["Height (cm)", "x"],
    ["Blood Pressure (mmHg)", "x / x"]
  ].freeze

  def with_stubbed_docx(paragraphs: SAMPLE_PARAGRAPHS, table: SAMPLE_TABLE)
    fake_doc = Struct.new(:paragraphs, :tables).new(paragraphs, [table])

    Etl::DocxDocument.stub(:new, fake_doc) do
      yield
    end
  end

  def test_extracts_gender_and_age_from_the_sample_report
    with_stubbed_docx do
      report = Etl::ReportExtractor.extract(SAMPLE_PATH)

      assert_equal "Male", report.gender
      assert_equal 46, report.age
    end
  end

  def test_extracts_narrative_sections_for_tagging
    with_stubbed_docx do
      report = Etl::ReportExtractor.extract(SAMPLE_PATH)

      assert_includes report.personal_report_text, "stress"
      assert_includes report.personal_report_text, "sleep"
      assert_includes report.nutrition_text, "Mediterranean Style of Diet"
    end
  end

  def test_summary_table_labels_are_found_even_when_unfilled
    with_stubbed_docx do
      report = Etl::ReportExtractor.extract(SAMPLE_PATH)

      # The sample report is a template with placeholder ("x") values, so the
      # numeric fields correctly resolve to nil rather than raising.
      assert_nil report.height_cm
      assert_nil report.blood_pressure_systolic
    end
  end
end
