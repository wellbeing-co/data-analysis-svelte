require "minitest/autorun"
require "open3"
require "tmpdir"
require "fileutils"

class BinExtractTest < Minitest::Test
  def test_processes_real_docx_files_instead_of_demo_fallback
    with_fixture("2024") do |project_root|
      File.write(File.join(project_root, "raw-data", "2024", "report.docx"), "")

      stdout, stderr, status = run_extract(project_root, "2024")

      assert status.success?, "Expected success, got stderr:\n#{stderr}\nstdout:\n#{stdout}"
      assert_includes stdout, "Year 2024 - Stage 1: extract report data for tagging"
      assert_includes stdout, "Year 2024 - Stage 2: build the final anonymised CSV"
      refute_includes stdout, "no reports found, using demo data instead"
      assert File.exist?(File.join(project_root, "etl", "output", "2024.csv"))
    end
  end

  def test_uses_demo_fallback_when_only_temp_or_hidden_docx_exist
    with_fixture("2024") do |project_root|
      File.write(File.join(project_root, "raw-data", "2024", "~$lock.docx"), "")
      File.write(File.join(project_root, "raw-data", "2024", ".hidden.docx"), "")

      stdout, stderr, status = run_extract(project_root, "2024")

      assert status.success?, "Expected success, got stderr:\n#{stderr}\nstdout:\n#{stdout}"
      assert_includes stdout, "Year 2024 - no reports found, using demo data instead"
      csv = File.read(File.join(project_root, "etl", "output", "2024.csv"))
      assert_includes csv, "demo-1,2024"
    end
  end

  def test_processes_nested_docx_and_reports_nested_diagnostic
    with_fixture("2024") do |project_root|
      nested = File.join(project_root, "raw-data", "2024", "nested")
      Dir.mkdir(nested)
      File.write(File.join(nested, "inner.docx"), "")

      stdout, stderr, status = run_extract(project_root, "2024")

      assert status.success?, "Expected success, got stderr:\n#{stderr}\nstdout:\n#{stdout}"
      assert_includes stdout, "No top-level .docx files found, but nested folders contain .docx files. Nested files will be processed."
      assert_includes stdout, "Year 2024 - Stage 1: extract report data for tagging"
      refute_includes stdout, "no reports found, using demo data instead"
    end
  end

  private

  def with_fixture(year)
    Dir.mktmpdir do |dir|
      project_root = File.join(dir, "project")
      FileUtils.mkdir_p(File.join(project_root, "bin"))
      FileUtils.mkdir_p(File.join(project_root, "etl", "tagging"))
      FileUtils.mkdir_p(File.join(project_root, "etl", "output"))
      FileUtils.mkdir_p(File.join(project_root, "raw-data", year))

      source_extract = File.expand_path("../../bin/extract", __dir__)
      fixture_extract = File.join(project_root, "bin", "extract")
      FileUtils.cp(source_extract, fixture_extract)
      FileUtils.chmod("u+rwx", fixture_extract)

      fake_bin = File.join(project_root, "fake-bin")
      FileUtils.mkdir_p(fake_bin)
      File.write(File.join(fake_bin, "bundle"), test_bundle_script)
      FileUtils.chmod("u+rwx", File.join(fake_bin, "bundle"))

      yield(project_root)
    end
  end

  def run_extract(project_root, year)
    env = {
      "PATH" => "#{File.join(project_root, "fake-bin")}:#{ENV.fetch("PATH")}",
      "TERM" => "dumb"
    }

    Open3.capture3(env, "bash", "bin/extract", "--year", year, chdir: project_root)
  end

  def test_bundle_script
    <<~BASH
            #!/usr/bin/env bash
            set -euo pipefail
      
            if [ "$1" = "check" ]; then
              exit 0
            fi
      
            if [ "$1" = "install" ]; then
              exit 0
            fi
      
            if [ "$1" = "exec" ] && [ "$2" = "ruby" ]; then
              script="$3"
              year="$4"
      
              case "$script" in
                jobs/extract_for_tagging.rb)
                  mkdir -p tagging
                  cat > "tagging/${year}_tagging.csv" <<CSV
      pseudonymous_id,sleep_issue,stress_burnout,acupuncture_referral,mental_health_referral
      id-1,Y,N,N,N
      CSV
                  ;;
                jobs/build_yearly_csv.rb)
                  mkdir -p output
                  cat > "output/${year}.csv" <<CSV
      pseudonymous_id,year
      id-1,${year}
      CSV
                  ;;
                bin/generate_demo_data.rb)
                  echo "pseudonymous_id,year"
                  echo "demo-1,${year}"
                  ;;
                *)
                  echo "Unexpected bundle exec ruby script: $script" >&2
                  exit 2
                  ;;
              esac
      
              exit 0
            fi
      
            echo "Unexpected bundle args: $*" >&2
            exit 2
    BASH
  end
end
