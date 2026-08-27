export interface YearStatus {
	year: string;
	docxCount: number;
	hasTagging: boolean;
	pendingTags: number;
	hasOutput: boolean;
	published: boolean;
}

export type TagValue = 'Y' | 'N' | 'TODO(Y/N)';

export interface TaggingRow {
	pseudonymous_id: string;
	source_file: string;
	gender: string;
	age: string;
	sleep_issue: TagValue;
	stress_burnout: TagValue;
	acupuncture_referral: TagValue;
	mental_health_referral: TagValue;
	personal_report_excerpt: string;
}

export interface DesktopApi {
	isDesktop: true;
	getSettings(): Promise<{ rawDataDir: string | null }>;
	chooseRawDataFolder(): Promise<string | null>;
	listYears(): Promise<YearStatus[]>;
	extractForTagging(year: string): Promise<{ rows: TaggingRow[] }>;
	getTagging(year: string): Promise<{ rows: TaggingRow[] }>;
	saveTagging(year: string, rows: TaggingRow[]): Promise<{ ok: true }>;
	buildYearlyCsv(year: string): Promise<{ ok: true; rowCount: number }>;
	generateDemoData(year: string): Promise<{ ok: true }>;
	openUserDataFolder(): Promise<void>;
}

declare global {
	interface Window {
		desktopApi?: DesktopApi;
	}
}

export function desktopApi(): DesktopApi | null {
	return typeof window !== 'undefined' && window.desktopApi ? window.desktopApi : null;
}
