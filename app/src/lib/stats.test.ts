import { describe, expect, it } from 'vitest';
import {
	ageRangeDistribution,
	genderSplit,
	percentage,
	summariseFlag,
	summariseYear,
	underfuellingWhileHealthy
} from './stats';
import type { AssessmentRow } from './types';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
	return {
		pseudonymous_id: 'demo-001',
		year: '2023',
		gender: 'Female',
		age: 34,
		age_range: '20-39',
		height_cm: 165,
		weight_kg: 60,
		bmi: 22,
		body_fat_pct: 25,
		waist_cm: 75,
		waist_to_height_ratio: 0.45,
		blood_pressure_systolic: 110,
		blood_pressure_diastolic: 70,
		blood_pressure_category: 'Green',
		resting_pulse: 65,
		total_cholesterol: 4.5,
		hdl_cholesterol: 1.5,
		hdl_cholesterol_category: 'Green',
		non_hdl_cholesterol: 3,
		non_hdl_cholesterol_category: 'Green',
		non_fasted_glucose: 5,
		hba1c: 5,
		overall_healthy: 'Y',
		nutritional_underfuelling: 'N',
		sleep_issue: 'N',
		stress_burnout: 'N',
		acupuncture_referral: 'N',
		mental_health_referral: 'N',
		...overrides
	};
}

describe('percentage', () => {
	it('rounds to one decimal place', () => {
		expect(percentage(1, 3)).toBe(33.3);
	});

	it('returns 0 for an empty total instead of dividing by zero', () => {
		expect(percentage(5, 0)).toBe(0);
	});
});

describe('genderSplit', () => {
	it('counts rows per gender', () => {
		const rows = [row({ gender: 'Female' }), row({ gender: 'Male' }), row({ gender: 'Female' })];
		const split = genderSplit(rows);
		expect(split).toEqual(
			expect.arrayContaining([
				{ label: 'Female', count: 2 },
				{ label: 'Male', count: 1 }
			])
		);
	});
});

describe('ageRangeDistribution', () => {
	it('always returns every bucket, even ones with zero rows, in a fixed order', () => {
		const rows = [row({ age_range: '20-39' })];
		const distribution = ageRangeDistribution(rows);
		expect(distribution.map((d) => d.label)).toEqual(['Under 20', '20-39', '40-59', '60-79', '80+']);
		expect(distribution.find((d) => d.label === '20-39')?.count).toBe(1);
		expect(distribution.find((d) => d.label === '60-79')?.count).toBe(0);
	});
});

describe('summariseFlag', () => {
	it('breaks a Y/N/Unknown column down into counts and a yes percentage', () => {
		const rows = [
			row({ sleep_issue: 'Y' }),
			row({ sleep_issue: 'Y' }),
			row({ sleep_issue: 'N' }),
			row({ sleep_issue: 'Unknown' })
		];
		const summary = summariseFlag(rows, 'sleep_issue');
		expect(summary).toEqual({ yes: 2, no: 1, unknown: 1, total: 4, yesPercentage: 50 });
	});
});

describe('underfuellingWhileHealthy', () => {
	it('only counts rows that are both underfuelling and overall healthy', () => {
		const rows = [
			row({ nutritional_underfuelling: 'Y', overall_healthy: 'Y' }),
			row({ nutritional_underfuelling: 'Y', overall_healthy: 'N' }),
			row({ nutritional_underfuelling: 'N', overall_healthy: 'Y' })
		];
		const summary = underfuellingWhileHealthy(rows);
		expect(summary.yes).toBe(1);
		expect(summary.total).toBe(3);
	});
});

describe('summariseYear', () => {
	it('reduces a year of rows down to headline numbers', () => {
		const rows = [
			row({ gender: 'Female', acupuncture_referral: 'Y' }),
			row({ gender: 'Male', mental_health_referral: 'Y' })
		];
		const summary = summariseYear('2024', rows);
		expect(summary.year).toBe('2024');
		expect(summary.total).toBe(2);
		expect(summary.femalePct).toBe(50);
		expect(summary.malePct).toBe(50);
		expect(summary.acupunctureCount).toBe(1);
		expect(summary.mentalHealthCount).toBe(1);
	});
});
