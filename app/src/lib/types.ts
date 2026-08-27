export type YesNoUnknown = 'Y' | 'N' | 'Unknown';

/** One anonymised row from a yearly ETL output CSV (etl/output/<year>.csv). */
export interface AssessmentRow {
	pseudonymous_id: string;
	year: string;
	gender: string;
	age: number | null;
	age_range: string;
	height_cm: number | null;
	weight_kg: number | null;
	bmi: number | null;
	body_fat_pct: number | null;
	waist_cm: number | null;
	waist_to_height_ratio: number | null;
	blood_pressure_systolic: number | null;
	blood_pressure_diastolic: number | null;
	blood_pressure_category: string;
	resting_pulse: number | null;
	total_cholesterol: number | null;
	hdl_cholesterol: number | null;
	hdl_cholesterol_category: string;
	non_hdl_cholesterol: number | null;
	non_hdl_cholesterol_category: string;
	non_fasted_glucose: number | null;
	hba1c: number | null;
	overall_healthy: YesNoUnknown;
	nutritional_underfuelling: YesNoUnknown;
	sleep_issue: YesNoUnknown;
	stress_burnout: YesNoUnknown;
	acupuncture_referral: YesNoUnknown;
	mental_health_referral: YesNoUnknown;
}

/** Fixed display order for age range buckets, matching the ETL's Derivations. */
export const AGE_RANGE_ORDER = ['Under 20', '20-39', '40-59', '60-79', '80+'];
