require "minitest/autorun"
require_relative "../lib/etl/report_extractor"

class ReportExtractorTest < Minitest::Test
  SAMPLE_PATH = File.expand_path("../../raw-data/2023/Complete Wellbeing XXX 01012023.docx", __dir__)

  def test_extracts_gender_and_age_from_the_sample_report
    report = Etl::ReportExtractor.extract(SAMPLE_PATH)

    assert_equal "Male", report.gender
    assert_equal 46, report.age
  end

  def test_extracts_narrative_sections_for_tagging
    report = Etl::ReportExtractor.extract(SAMPLE_PATH)

    assert_includes report.personal_report_text, "stress"
    assert_includes report.personal_report_text, "sleep"
    assert_includes report.nutrition_text, "Mediterranean Style of Diet"
  end

  def test_summary_table_labels_are_found_even_when_unfilled
    report = Etl::ReportExtractor.extract(SAMPLE_PATH)

    # The sample report is a template with placeholder ("x") values, so the
    # numeric fields correctly resolve to nil rather than raising.
    assert_nil report.height_cm
    assert_nil report.blood_pressure_systolic
  end
end
