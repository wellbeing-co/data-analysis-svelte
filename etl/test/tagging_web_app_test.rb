require "minitest/autorun"
require_relative "../tagging_web/app"

class TaggingWebAppTest < Minitest::Test
  def test_preferred_report_rows_uses_output_when_output_has_rows
    output_rows = [{"pseudonymous_id" => "demo-1"}]
    tagging_rows = [{"pseudonymous_id" => "demo-2"}]

    rows, source_mode = Etl::TaggingWebApp.preferred_report_rows(output_rows, tagging_rows)

    assert_equal :output, source_mode
    assert_equal output_rows, rows
  end

  def test_preferred_report_rows_falls_back_to_tagging_when_output_is_empty
    output_rows = []
    tagging_rows = [{"pseudonymous_id" => "demo-2"}]

    rows, source_mode = Etl::TaggingWebApp.preferred_report_rows(output_rows, tagging_rows)

    assert_equal :tagging, source_mode
    assert_equal tagging_rows, rows
  end
end
