require "csv"
require "open3"
require "sinatra/base"
require_relative "../lib/etl/tagging_store"
require_relative "../lib/etl/derivations"

module Etl
  # Local web tool that lets a non-technical reviewer - on another machine on
  # the same network - fill in the sleep_issue/stress_burnout/
  # acupuncture_referral/mental_health_referral tags from a fast single-record
  # browser flow. Each save writes straight to the year's tagging CSV, and the
  # report page is rebuilt from those saved tags automatically.
  #
  # HTTP Basic Auth is applied in config.ru, in front of this app.
  class TaggingWebApp < Sinatra::Base
    set :views, File.expand_path("views", __dir__)
    set :public_folder, File.expand_path("public", __dir__)

    def self.preferred_report_rows(output_rows, tagging_rows)
      if output_rows && !output_rows.empty?
        [output_rows, :output]
      else
        [tagging_rows, :tagging]
      end
    end

    helpers do
      def etl_root
        File.expand_path("..", __dir__)
      end

      def tagging_dir
        File.join(etl_root, "tagging")
      end

      def tagging_path_for(year)
        File.join(tagging_dir, "#{year}_tagging.csv")
      end

      def years
        Dir.glob(File.join(tagging_dir, "*_tagging.csv")).map do |path|
          File.basename(path).sub(/_tagging\.csv\z/, "")
        end.sort
      end

      def rows_for(year)
        Etl::TaggingStore.load(tagging_path_for(year)).values.sort_by { |row| row["pseudonymous_id"].to_s }
      end

      def tag_columns
        Etl::TaggingStore::TAG_COLUMNS
      end

      def blank_tag
        Etl::TaggingStore.blank_tag
      end

      def tag_match_column(column)
        Etl::TaggingStore.match_column_for(column)
      end

      def suggested_match_for(row, column)
        stored_match = row[tag_match_column(column)].to_s.strip
        return stored_match unless stored_match.empty?

        Etl::Derivations.matched_keyword_from_excerpt(row["personal_report_excerpt"], column)
      end

      def output_path_for(year)
        File.join(etl_root, "output", "#{year}.csv")
      end

      def extract_for_tagging(year)
        output, status = Open3.capture2e(
          "bundle", "exec", "ruby", "jobs/extract_for_tagging.rb", year,
          chdir: etl_root
        )
        {success: status.success?, output: output}
      end

      def refresh_output(year)
        output, status = Open3.capture2e(
          "bundle", "exec", "ruby", "jobs/build_yearly_csv.rb", year,
          chdir: etl_root
        )
        {success: status.success?, output: output}
      end

      def yes?(value)
        %w[Y YES TRUE].include?(value.to_s.strip.upcase)
      end

      def percentage(count, total)
        return 0 if total.to_i <= 0

        ((count.to_f / total) * 100).round(1)
      end

      def selected_tag_value(row, column)
        raw_value = row[column].to_s.strip
        case raw_value.upcase
        when "Y" then "Y"
        when "N" then "N"
        else
          suggested_match_for(row, column).to_s.strip.empty? ? "Unknown" : "Y"
        end
      end

      def normalized_index(rows, requested_index)
        return 0 if rows.empty?

        index = requested_index.to_i
        index = 0 if index.negative?
        index = rows.length - 1 if index >= rows.length
        index
      end

      def normalized_tag_value(value)
        case value.to_s.strip.upcase
        when "Y" then "Y"
        when "N" then "N"
        when "UNKNOWN" then "Unknown"
        end
      end

      def build_summary(rows)
        summary = {
          total: rows.size,
          gender: Hash.new(0),
          age_range: Hash.new(0),
          sleep_issue_yes: 0,
          nutritional_underfuelling_while_healthy: 0,
          stress_burnout_yes: 0,
          acupuncture_referral_yes: 0,
          mental_health_referral_yes: 0
        }

        rows.each do |row|
          gender = row["gender"].to_s.strip
          summary[:gender][gender.empty? ? "Unknown" : gender] += 1

          age_range = row["age_range"].to_s.strip
          if age_range.empty?
            age = row["age"].to_s.strip
            age_range = Etl::Derivations.age_range(age.to_i) unless age.empty?
          end
          summary[:age_range][age_range.empty? ? "Unknown" : age_range] += 1

          summary[:sleep_issue_yes] += 1 if yes?(row["sleep_issue"])
          summary[:stress_burnout_yes] += 1 if yes?(row["stress_burnout"])
          summary[:acupuncture_referral_yes] += 1 if yes?(row["acupuncture_referral"])
          summary[:mental_health_referral_yes] += 1 if yes?(row["mental_health_referral"])

          if yes?(row["overall_healthy"]) && yes?(row["nutritional_underfuelling"])
            summary[:nutritional_underfuelling_while_healthy] += 1
          end
        end

        summary
      end
    end

    get "/" do
      @years = years
      erb :index
    end

    post "/run-extraction" do
      @years = years
      @extract_year = params[:year].to_s.strip

      unless @extract_year.match?(/\A\d{4}\z/)
        @extract_error = "Enter a 4-digit year to run extraction."
        status 422
        return erb :index
      end

      extraction = extract_for_tagging(@extract_year)

      if extraction[:success] && File.exist?(tagging_path_for(@extract_year))
        redirect "/#{@extract_year}/edit"
      else
        @extract_error = "Extraction failed for #{@extract_year}."
        @extract_output = extraction[:output]
        status 422
        erb :index
      end
    end

    get "/:year/edit" do
      @page_class = "page-edit"
      @year = params[:year]
      tagging_path = tagging_path_for(@year)
      halt 404, "No tagging file for #{@year}" unless File.exist?(tagging_path)

      @rows = rows_for(@year)
      halt 404, "No records found for #{@year}" if @rows.empty?

      @record_index = normalized_index(@rows, params[:at])
      @record = @rows[@record_index]
      @record_id = @record["pseudonymous_id"]
      @total_records = @rows.length
      @previous_index = [@record_index - 1, 0].max
      @next_index = [@record_index + 1, @total_records - 1].min
      @saved = params[:saved] == "1"
      erb :edit
    end

    post "/:year/edit" do
      @year = params[:year]
      tagging_path = tagging_path_for(@year)
      halt 404, "No tagging file for #{@year}" unless File.exist?(tagging_path)

      rows_by_id = Etl::TaggingStore.load(tagging_path)

      submitted = (params[:tags] || {}).each_with_object({}) do |(id, columns), out|
        out[id] = columns.to_h
      end
      unless submitted.empty?
        submitted.each do |id, columns|
          row = rows_by_id[id]
          next unless row

          Etl::TaggingStore::TAG_COLUMNS.each do |column|
            value = normalized_tag_value(columns[column])
            row[column] = value unless value.nil?
          end
        end

        Etl::TaggingStore.write(tagging_path, rows_by_id.values)
      end

      refresh_output(@year)

      current_index = params[:at].to_i
      next_index = current_index + 1
      redirect "/#{@year}/edit?at=#{next_index}&saved=1"
    end

    get "/:year/review" do
      redirect "/#{params[:year]}/report"
    end

    post "/:year/publish" do
      redirect "/#{params[:year]}/report"
    end

    get "/:year/report" do
      @year = params[:year]
      tagging_path = tagging_path_for(@year)
      halt 404, "No tagging file for #{@year}" unless File.exist?(tagging_path)

      build_result = refresh_output(@year)
      @output_path = output_path_for(@year)
      output_rows = nil
      if build_result[:success] && File.exist?(@output_path)
        output_rows = CSV.read(@output_path, headers: true)
      end

      rows, @source_mode = self.class.preferred_report_rows(output_rows, rows_for(@year))
      @build_error = build_result[:output] if @source_mode == :tagging

      @summary = build_summary(rows)
      erb :report
    end
  end
end
