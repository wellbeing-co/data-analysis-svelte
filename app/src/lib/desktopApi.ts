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

export interface RawFileInfo {
	name: string;
	size: number;
	mtimeMs: number;
}

export interface ImportFilesResult {
	folder: string;
	total: number;
	imported: number;
	skipped: number;
	importedNames: string[];
	skippedNames: string[];
}

export interface ExtractionFailure {
	file: string;
	error: string;
}

export interface DesktopApi {
	isDesktop: true;
	listRawYears(): Promise<string[]>;
	createRawYear(year: string): Promise<{ ok: true }>;
	listRawFiles(year: string): Promise<RawFileInfo[]>;
	chooseDocxFiles(): Promise<string[]>;
	chooseFolderToImport(): Promise<string[]>;
	importRawFiles(year: string, filePaths: string[]): Promise<ImportFilesResult>;
	removeRawFile(year: string, name: string): Promise<{ ok: true }>;
	listYears(): Promise<YearStatus[]>;
	extractForTagging(
		year: string
	): Promise<{ rows: TaggingRow[]; failures: ExtractionFailure[] }>;
	getTagging(year: string): Promise<{ rows: TaggingRow[] }>;
	saveTagging(year: string, rows: TaggingRow[]): Promise<{ ok: true }>;
	buildYearlyCsv(
		year: string
	): Promise<{ ok: true; rowCount: number; failures: ExtractionFailure[] }>;
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
