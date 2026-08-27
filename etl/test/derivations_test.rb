require "minitest/autorun"
require_relative "../lib/etl/derivations"

class DerivationsTest < Minitest::Test
  def test_pseudonymous_id_is_stable_and_non_reversible
    id1 = Etl::Derivations.pseudonymous_id("2023", "report.docx", "salt-a")
    id2 = Etl::Derivations.pseudonymous_id("2023", "report.docx", "salt-a")
    id3 = Etl::Derivations.pseudonymous_id("2023", "report.docx", "salt-b")

    assert_equal id1, id2
    refute_equal id1, id3
    refute_includes id1, "report"
  end

  def test_age_range_buckets
    assert_equal "Under 20", Etl::Derivations.age_range(19)
    assert_equal "20-39", Etl::Derivations.age_range(20)
    assert_equal "20-39", Etl::Derivations.age_range(39)
    assert_equal "40-59", Etl::Derivations.age_range(46)
    assert_equal "60-79", Etl::Derivations.age_range(60)
    assert_equal "80+", Etl::Derivations.age_range(85)
    assert_nil Etl::Derivations.age_range(nil)
  end

  def test_blood_pressure_category
    assert_equal "Green", Etl::Derivations.blood_pressure_category(120, 80)
    assert_equal "Amber", Etl::Derivations.blood_pressure_category(135, 80)
    assert_equal "Amber", Etl::Derivations.blood_pressure_category(120, 87)
    assert_equal "Red", Etl::Derivations.blood_pressure_category(141, 80)
    assert_equal "Red", Etl::Derivations.blood_pressure_category(120, 92)
    assert_nil Etl::Derivations.blood_pressure_category(nil, 80)
  end

  def test_non_hdl_cholesterol_category
    assert_equal "Optimal", Etl::Derivations.non_hdl_cholesterol_category(3.0)
    assert_equal "Borderline High", Etl::Derivations.non_hdl_cholesterol_category(4.0)
    assert_equal "High", Etl::Derivations.non_hdl_cholesterol_category(5.5)
  end

  def test_hdl_cholesterol_category_differs_by_gender
    assert_equal "Average", Etl::Derivations.hdl_cholesterol_category(1.1, "Male")
    assert_equal "Low", Etl::Derivations.hdl_cholesterol_category(1.1, "Female")
    assert_equal "Optimal", Etl::Derivations.hdl_cholesterol_category(1.6, "Male")
  end

  def test_overall_healthy
    assert Etl::Derivations.overall_healthy?("Green", "Optimal", "Optimal")
    refute Etl::Derivations.overall_healthy?("Red", "Optimal", "Optimal")
    refute Etl::Derivations.overall_healthy?("Green", "High", "Optimal")
    refute Etl::Derivations.overall_healthy?("Green", "Optimal", "Low")
  end

  def test_nutritional_underfuelling_flag
    assert Etl::Derivations.nutritional_underfuelling_flag("You mentioned skipping meals often.")
    refute Etl::Derivations.nutritional_underfuelling_flag("Your diet looks well balanced.")
    refute Etl::Derivations.nutritional_underfuelling_flag(nil)
  end
end
