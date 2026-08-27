import Papa from 'papaparse';
import type { AssessmentRow } from './types';

const NUMERIC_FIELDS = [
	'age',
	'height_cm',
	'weight_kg',
	'bmi',
	'body_fat_pct',
	'waist_cm',
	'waist_to_height_ratio',
	'blood_pressure_systolic',
	'blood_pressure_diastolic',
	'resting_pulse',
	'total_cholesterol',
	'hdl_cholesterol',
	'non_hdl_cholesterol',
	'non_fasted_glucose',
	'hba1c'
] as const;

/** List of years with data available, from static/data/years.json. */
export async function loadAvailableYears(): Promise<string[]> {
	const response = await fetch('/data/years.json');
	if (!response.ok) return [];
	const years: string[] = await response.json();
	return years.sort();
}

/** Loads and parses static/data/<year>.csv into typed rows. */
export async function loadYear(year: string): Promise<AssessmentRow[]> {
	const response = await fetch(`/data/${year}.csv`);
	if (!response.ok) {
		throw new Error(`Could not load data for ${year} (${response.status})`);
	}
	const text = await response.text();
	const { data } = Papa.parse<Record<string, string>>(text, {
		header: true,
		skipEmptyLines: true
	});

	return data.map((raw) => {
		const row: Record<string, unknown> = { ...raw };
		for (const field of NUMERIC_FIELDS) {
			const value = raw[field];
			row[field] = value === undefined || value === '' ? null : Number(value);
		}
		return row as unknown as AssessmentRow;
	});
}

/** Loads every given year in parallel, keyed by year - used to spot trends across years. */
export async function loadAllYears(years: string[]): Promise<Record<string, AssessmentRow[]>> {
	const entries = await Promise.all(
		years.map(async (year) => [year, await loadYear(year)] as const)
	);
	return Object.fromEntries(entries);
}
