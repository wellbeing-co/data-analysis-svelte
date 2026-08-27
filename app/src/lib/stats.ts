import { AGE_RANGE_ORDER, type AssessmentRow, type YesNoUnknown } from './types';

export interface Count {
	label: string;
	count: number;
}

function countBy<T>(rows: T[], keyFn: (row: T) => string): Count[] {
	const counts = new Map<string, number>();
	for (const row of rows) {
		const key = keyFn(row) || 'Unknown';
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

export function percentage(count: number, total: number): number {
	return total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
}

/** Q1: split of assessments by gender. */
export function genderSplit(rows: AssessmentRow[]): Count[] {
	return countBy(rows, (row) => row.gender);
}

/** Q2: distribution of assessments across age ranges, in a fixed display order. */
export function ageRangeDistribution(rows: AssessmentRow[]): Count[] {
	const counts = countBy(rows, (row) => row.age_range);
	return AGE_RANGE_ORDER.map((label) => ({
		label,
		count: counts.find((c) => c.label === label)?.count ?? 0
	}));
}

/** Q3/Q5/Q6/Q7: Y/N/Unknown breakdown of a manually-tagged flag column. */
export function flagBreakdown(rows: AssessmentRow[], field: keyof AssessmentRow): Count[] {
	const order: YesNoUnknown[] = ['Y', 'N', 'Unknown'];
	const counts = countBy(rows, (row) => String(row[field]));
	return order.map((label) => ({
		label,
		count: counts.find((c) => c.label === label)?.count ?? 0
	}));
}

export interface FlagSummary {
	yes: number;
	no: number;
	unknown: number;
	total: number;
	yesPercentage: number;
}

export function summariseFlag(rows: AssessmentRow[], field: keyof AssessmentRow): FlagSummary {
	const breakdown = flagBreakdown(rows, field);
	const yes = breakdown.find((c) => c.label === 'Y')?.count ?? 0;
	const no = breakdown.find((c) => c.label === 'N')?.count ?? 0;
	const unknown = breakdown.find((c) => c.label === 'Unknown')?.count ?? 0;
	const total = rows.length;
	return { yes, no, unknown, total, yesPercentage: percentage(yes, total) };
}

/**
 * Q4: nutritional underfuelling while otherwise presenting healthy
 * (good cholesterol + good blood pressure). Cross-tabulates the
 * `nutritional_underfuelling` and `overall_healthy` flags.
 */
export function underfuellingWhileHealthy(rows: AssessmentRow[]): FlagSummary {
	const matching = rows.filter(
		(row) => row.nutritional_underfuelling === 'Y' && row.overall_healthy === 'Y'
	);
	return {
		yes: matching.length,
		no: rows.length - matching.length,
		unknown: 0,
		total: rows.length,
		yesPercentage: percentage(matching.length, rows.length)
	};
}

/** One year's story, reduced to the numbers needed to compare years side by side. */
export interface YearlySummary {
	year: string;
	total: number;
	femalePct: number;
	malePct: number;
	sleepPct: number;
	stressPct: number;
	underfuellingPct: number;
	acupunctureCount: number;
	mentalHealthCount: number;
}

/** Reduces a year's rows down to the headline numbers used by the trends section. */
export function summariseYear(year: string, rows: AssessmentRow[]): YearlySummary {
	const total = rows.length;
	const gender = genderSplit(rows);
	const female = gender.find((g) => g.label === 'Female')?.count ?? 0;
	const male = gender.find((g) => g.label === 'Male')?.count ?? 0;

	return {
		year,
		total,
		femalePct: percentage(female, total),
		malePct: percentage(male, total),
		sleepPct: summariseFlag(rows, 'sleep_issue').yesPercentage,
		stressPct: summariseFlag(rows, 'stress_burnout').yesPercentage,
		underfuellingPct: underfuellingWhileHealthy(rows).yesPercentage,
		acupunctureCount: summariseFlag(rows, 'acupuncture_referral').yes,
		mentalHealthCount: summariseFlag(rows, 'mental_health_referral').yes
	};
}
