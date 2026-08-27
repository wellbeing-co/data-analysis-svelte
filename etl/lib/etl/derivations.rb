require "digest"

module Etl
  module Derivations
    module_function

    # Stable, non-reversible per-source-file identifier. Two runs against the
    # same file (same year + filename) always produce the same id, but the
    # id cannot be used to recover the original filename/name.
    def pseudonymous_id(year, filename, salt)
      Digest::SHA256.hexdigest("#{salt}:#{year}:#{filename}")[0, 12]
    end

    # Buckets ages using the same bands already used in the report template's
    # body-fat table (20-39 / 40-59 / 60-79), with catch-alls at the edges.
    def age_range(age)
      return nil if age.nil?

      case age
      when 0..19 then "Under 20"
      when 20..39 then "20-39"
      when 40..59 then "40-59"
      when 60..79 then "60-79"
      else "80+"
      end
    end

    # Blood pressure category, following the Green/Amber/Red thresholds
    # printed in the report ("Cardiovascular Health Measures" section).
    # Uses systolic/diastolic categories.
    def blood_pressure_category(systolic, diastolic)
      return nil if systolic.nil? || diastolic.nil?

      systolic_cat = if systolic >= 140 then :red
                     elsif systolic >= 130 then :amber
                     else :green
                     end
      diastolic_cat = if diastolic >= 90 then :red
                      elsif diastolic >= 85 then :amber
                      else :green
                      end
      worse_category(systolic_cat, diastolic_cat)
    end

    # Non-HDL ("bad") cholesterol category, following the report's table.
    def non_hdl_cholesterol_category(value)
      return nil if value.nil?

      if value > 4.9 then "High"
      elsif value >= 3.37 then "Borderline High"
      else "Optimal"
      end
    end

    # HDL ("good") cholesterol category, following the report's table.
    # Thresholds differ slightly by gender; falls back to male thresholds
    # when gender is unknown.
    def hdl_cholesterol_category(value, gender)
      return nil if value.nil?

      low_threshold = gender.to_s.casecmp("Female").zero? ? 1.29 : 1.03
      if value > 1.55 then "Optimal"
      elsif value >= low_threshold then "Average"
      else "Low"
      end
    end

    # Q4: "good cholesterol, good blood pressure" while otherwise healthy.
    def overall_healthy?(bp_category, non_hdl_category, hdl_category)
      bp_category == "Green" &&
        non_hdl_category != "High" &&
        hdl_category != "Low"
    end

    # Keyword-only detection of nutritional underfuelling language in the
    # Nutrition narrative paragraph (Q4). Best-effort: the source docx has no
    # dedicated structured field for this, only free text.
    UNDERFUELLING_KEYWORDS = [
      "underfuel", "under-fuel", "under fuel",
      "under eating", "undereating", "under-eating",
      "not eating enough", "skipping meals", "skips meals", "skip meals",
      "restrict", "low calorie", "low-calorie", "insufficient intake",
      "not fuelling", "not fueling", "inadequate intake"
    ].freeze

    def nutritional_underfuelling_flag(nutrition_text)
      return false if nutrition_text.nil? || nutrition_text.empty?

      text = nutrition_text.downcase
      UNDERFUELLING_KEYWORDS.any? { |kw| text.include?(kw) }
    end

    def worse_category(a, b)
      order = { green: 0, amber: 1, red: 2 }
      order[a] >= order[b] ? label_for(a) : label_for(b)
    end
    private_class_method :worse_category

    def label_for(sym)
      { green: "Green", amber: "Amber", red: "Red" }[sym]
    end
    private_class_method :label_for
  end
end
