require_relative "docx_document"

module Etl
  # Extracts specific fields from a "Complete Wellbeing
  # Health Assessment" docx, based on the 2023 sample template:
  #  - Gender / age, from the header line under the title.
  #  - The "Summary of Key Results" table, for the numeric health metrics.
  #  - The "Personal Report" narrative, for sleep/stress/referral tagging.
  #  - The Nutrition paragraph, for the underfuelling keyword flag.
  class ReportExtractor
    RawReport = Struct.new(
      :gender, :age,
      :height_cm, :weight_kg, :body_fat_pct, :bmi,
      :waist_cm, :waist_to_height_ratio,
      :blood_pressure_systolic, :blood_pressure_diastolic,
      :resting_pulse,
      :total_cholesterol, :hdl_cholesterol, :non_hdl_cholesterol,
      :non_fasted_glucose, :hba1c,
      :personal_report_text, :nutrition_text,
      keyword_init: true
    )

    def self.extract(path)
      new(path).extract
    end

    def initialize(path)
      @doc = DocxDocument.new(path)
    end

    def extract
      RawReport.new(
        gender: gender,
        age: age,
        **summary_metrics,
        personal_report_text: personal_report_text,
        nutrition_text: nutrition_text
      )
    end

    private

    def header_line
      @doc.paragraphs.find { |p| p =~ /Gender:/i }
    end

    def gender
      line = header_line
      return nil unless line

      match = line.match(/Gender:\s*([A-Za-z]+)/i)
      match && match[1].capitalize
    end

    def age
      line = header_line
      return nil unless line

      match = line.match(/\((\d+)\)/)
      match && match[1].to_i
    end

    def summary_table
      @doc.tables.find { |rows| rows.first && rows.first.first.to_s =~ /Measurement/i }
    end

    def summary_lookup
      return {} unless summary_table

      summary_table.drop(1).each_with_object({}) do |row, hash|
        label, value = row
        next unless label

        hash[label.strip] = value.to_s.strip
      end
    end

    def summary_metrics
      lookup = summary_lookup
      systolic, diastolic = parse_blood_pressure(lookup["Blood Pressure (mmHg)"])

      {
        height_cm: parse_float(lookup["Height (cm)"]),
        weight_kg: parse_float(lookup["Weight (kg)"]),
        body_fat_pct: parse_float(lookup["Body Fat Percentage (%)"]),
        bmi: parse_float(lookup["Body Mass Index (kg/m2)"]),
        waist_cm: parse_float(lookup["Waist Circumference (cm)"]),
        waist_to_height_ratio: parse_float(lookup["Waist to Height Ratio"]),
        blood_pressure_systolic: systolic,
        blood_pressure_diastolic: diastolic,
        resting_pulse: parse_float(lookup["Resting Pulse (bpm)"]),
        total_cholesterol: parse_float(lookup["Total Cholesterol (mmol/l)"]),
        hdl_cholesterol: parse_float(lookup["HDL Cholesterol (mmol/l)"]),
        non_hdl_cholesterol: parse_float(lookup["Non-HDL Cholesterol (mmol/l)"]),
        non_fasted_glucose: parse_float(lookup["Non Fasted Blood Glucose (mmol/l)"]),
        hba1c: parse_float(lookup["HBA1C (%)"])
      }
    end

    def parse_blood_pressure(value)
      return [nil, nil] unless value

      match = value.match(%r{(\d+)\s*/\s*(\d+)})
      return [nil, nil] unless match

      [match[1].to_i, match[2].to_i]
    end

    def parse_float(value)
      return nil if value.nil? || value.empty?

      match = value.match(/-?\d+(\.\d+)?/)
      match && match[0].to_f
    end

    # The narrative "Personal Report" section: everything between the
    # "Personal Report" heading and the "Summary of Key Results" heading.
    def personal_report_text
      paragraphs = @doc.paragraphs
      start_index = paragraphs.index { |p| p.strip == "Personal Report" }
      end_index = paragraphs.index { |p| p.strip == "Summary of Key Results" }
      return "" unless start_index && end_index && end_index > start_index

      paragraphs[(start_index + 1)...end_index].join("\n\n")
    end

    def nutrition_text
      @doc.paragraphs.find { |p| p =~ /Nutrition section of the questionnaire/i } || ""
    end
  end
end
