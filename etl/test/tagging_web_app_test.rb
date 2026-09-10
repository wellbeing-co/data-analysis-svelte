require "minitest/autorun"
require "fileutils"
require "tmpdir"
require "rack/mock"
require_relative "../tagging_web/app"

class TaggingWebAppTest < Minitest::Test
  class FlashHarnessApp < Etl::TaggingWebApp
    helpers do
      def etl_root
        ENV.fetch("TEST_ETL_ROOT")
      end

      def refresh_output(_year)
        {success: ENV.fetch("TEST_REFRESH_SUCCESS", "1") == "1", output: "refresh failed"}
      end
    end
  end

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

  def test_source_name_for_rows_is_raw_data_when_none_processed
    rows = [
      {
        "sleep_issue" => "TODO(Y/N)",
        "stress_burnout" => "TODO(Y/N)",
        "acupuncture_referral" => "TODO(Y/N)",
        "mental_health_referral" => "TODO(Y/N)"
      }
    ]

    assert_equal "raw data", Etl::TaggingWebApp.source_name_for_rows(rows)
  end

  def test_source_name_for_rows_is_verified_data_when_all_processed
    rows = [
      {
        "sleep_issue" => "Y",
        "stress_burnout" => "N",
        "acupuncture_referral" => "Unknown",
        "mental_health_referral" => "Y"
      }
    ]

    assert_equal "verified data", Etl::TaggingWebApp.source_name_for_rows(rows)
  end

  def test_source_name_for_rows_is_mixed_when_some_processed
    rows = [
      {
        "sleep_issue" => "Y",
        "stress_burnout" => "N",
        "acupuncture_referral" => "Unknown",
        "mental_health_referral" => "Y"
      },
      {
        "sleep_issue" => "TODO(Y/N)",
        "stress_burnout" => "TODO(Y/N)",
        "acupuncture_referral" => "TODO(Y/N)",
        "mental_health_referral" => "TODO(Y/N)"
      }
    ]

    assert_equal "mixed", Etl::TaggingWebApp.source_name_for_rows(rows)
  end

  def test_save_redirects_with_success_flash_even_when_output_refresh_fails
    with_tagging_fixture do
      ENV["TEST_REFRESH_SUCCESS"] = "0"
      response = request.post("/2023/edit?at=0", params: {
        "tags" => {
          "id-1" => {
            "sleep_issue" => "Y"
          }
        }
      })

      assert_equal 303, response.status
      assert_match(%r{flash=success}, response["Location"])
    end
  end

  def test_failure_flash_renders_styled_overlay
    with_tagging_fixture do
      response = request.get("/2023/edit?flash=failure")

      assert_equal 200, response.status
      assert_includes response.body, 'class="flash-overlay flash-failure"'
      assert_includes response.body, ">Failed<"
    end
  end

  def test_report_shows_source_name
    with_tagging_fixture do
      response = request.get("/2023/report")

      assert_equal 200, response.status
      assert_includes response.body, "Source: verified data"
    end
  end

  private

  def request
    Rack::MockRequest.new(FlashHarnessApp)
  end

  def with_tagging_fixture
    Dir.mktmpdir do |dir|
      etl_root = File.join(dir, "etl")
      FileUtils.mkdir_p(File.join(etl_root, "tagging"))
      File.write(File.join(etl_root, "tagging", "2023_tagging.csv"), <<~CSV)
        pseudonymous_id,sleep_issue,stress_burnout,acupuncture_referral,mental_health_referral,personal_report_excerpt
        id-1,N,N,N,N,excerpt
      CSV

      begin
        ENV["TEST_ETL_ROOT"] = etl_root
        ENV["TEST_REFRESH_SUCCESS"] = "1"
        yield
      ensure
        ENV.delete("TEST_ETL_ROOT")
        ENV.delete("TEST_REFRESH_SUCCESS")
      end
    end
  end
end
