<script lang="ts">
	import {
		desktopApi,
		type ExtractionFailure,
		type RawFileInfo,
		type TaggingRow,
		type YearStatus
	} from '$lib/desktopApi';

	const api = desktopApi();

	let years = $state<YearStatus[]>([]);
	let activeYear = $state<string | null>(null);
	let taggingRows = $state<TaggingRow[]>([]);
	let busy = $state(false);
	let message = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let failures = $state<ExtractionFailure[]>([]);

	let newYear = $state(String(new Date().getFullYear()));
	let filesYear = $state<string | null>(null);
	let rawFiles = $state<RawFileInfo[]>([]);
	let pendingFiles = $state<string[]>([]);

	const TAG_FIELDS = [
		'sleep_issue',
		'stress_burnout',
		'acupuncture_referral',
		'mental_health_referral'
	] as const;

	async function refresh() {
		if (!api) return;
		years = await api.listYears();
		if (filesYear) rawFiles = await api.listRawFiles(filesYear);
	}

	async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
		if (!api) return undefined;
		busy = true;
		errorMessage = null;
		try {
			return await action();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
			return undefined;
		} finally {
			busy = false;
		}
	}

	function isValidYear(value: string) {
		return /^\d{4}$/.test(value);
	}

	async function createYear() {
		if (!isValidYear(newYear)) {
			errorMessage = 'Enter a 4-digit year, e.g. 2024.';
			return;
		}
		const result = await run(() => api!.createRawYear(newYear));
		if (result) {
			message = `Created the "${newYear}" folder.`;
			await openFiles(newYear);
			await refresh();
		}
	}

	async function openFiles(year: string) {
		filesYear = year;
		pendingFiles = [];
		const result = await run(() => api!.listRawFiles(year));
		if (result) rawFiles = result;
	}

	function closeFiles() {
		filesYear = null;
		rawFiles = [];
		pendingFiles = [];
	}

	async function chooseFiles() {
		const chosen = await run(() => api!.chooseDocxFiles());
		if (chosen && chosen.length > 0) {
			pendingFiles = chosen;
			message = null;
		}
	}

	async function chooseFolderToImport() {
		const found = await run(() => api!.chooseFolderToImport());
		if (found) {
			if (found.length === 0) {
				errorMessage = 'No .docx files were found in that folder.';
			} else {
				pendingFiles = found;
				message = null;
			}
		}
	}

	function cancelPendingFiles() {
		pendingFiles = [];
	}

	async function confirmImport() {
		if (!filesYear || pendingFiles.length === 0) return;
		const year = filesYear;
		// Svelte 5's $state arrays are Proxies, which Electron's contextBridge
		// cannot structured-clone across the IPC boundary ("An object could not
		// be cloned") - take a plain snapshot before sending it over IPC.
		const files = $state.snapshot(pendingFiles);
		const result = await run(() => api!.importRawFiles(year, files));
		if (result) {
			pendingFiles = [];
			message =
				`Saved ${result.imported} of ${result.total} file(s) into "${year}"` +
				(result.skipped > 0 ? ` (${result.skipped} already existed and were skipped).` : '.');
			await openFiles(year);
			await refresh();
		}
	}

	async function removeFile(year: string, name: string) {
		const result = await run(() => api!.removeRawFile(year, name));
		if (result) {
			message = `Removed "${name}" from "${year}".`;
			await openFiles(year);
			await refresh();
		}
	}

	async function extract(year: string) {
		const result = await run(() => api!.extractForTagging(year));
		if (result) {
			activeYear = year;
			taggingRows = result.rows;
			failures = result.failures ?? [];
			message =
				`Extracted ${result.rows.length} report(s) for ${year}` +
				(failures.length > 0
					? ` - ${failures.length} file(s) could not be read and were skipped (see below).`
					: ' - fill in the tags below, then save.');
			await refresh();
		}
	}

	async function openTagging(year: string) {
		const result = await run(() => api!.getTagging(year));
		if (result) {
			activeYear = year;
			taggingRows = result.rows;
		}
	}

	async function saveTagging() {
		if (!activeYear) return;
		// Same Proxy-cloning issue as confirmImport() above - snapshot before IPC.
		const rows = $state.snapshot(taggingRows);
		const result = await run(() => api!.saveTagging(activeYear!, rows));
		if (result) {
			message = `Tags saved for ${activeYear}.`;
			await refresh();
		}
	}

	async function build(year: string) {
		const result = await run(() => api!.buildYearlyCsv(year));
		if (result) {
			failures = result.failures ?? [];
			message =
				`Built and published ${result.rowCount} row(s) for ${year}. Reload the dashboard to see it.` +
				(failures.length > 0
					? ` ${failures.length} file(s) could not be read and were skipped (see below).`
					: '');
			await refresh();
		}
	}

	async function demo(year: string) {
		const result = await run(() => api!.generateDemoData(year));
		if (result) {
			message = `Generated and published demo data for ${year}.`;
			await refresh();
		}
	}

	$effect(() => {
		refresh();
	});
</script>

<svelte:head>
	<title>Manage data - Wellbeing Reporting</title>
</svelte:head>

<main>
	<header class="masthead">
		<p class="kicker">Complete Wellbeing - Data manager</p>
		<h1>Manage each year's data</h1>
		<p class="lede"><a href="/">&larr; Back to the dashboard</a></p>
	</header>

	{#if !api}
		<p class="notice">
			This page only works inside the packaged desktop app - it drives the ETL that turns
			<code>.docx</code> reports into the CSVs the dashboard reads. Running the site in a regular
			browser (dev/preview/deployment)? Use <code>bin/run</code> instead - see the project README.
		</p>
	{:else}
		<section class="panel">
			<h2>Add a year</h2>
			<p>
				Create a folder inside the app for a year of reports, then add <code>.docx</code> files to
				it. Files are always copied into the app's own storage - nothing is read from disk each
				time, so the app always knows exactly what it has.
			</p>
			<div class="new-year">
				<input type="text" inputmode="numeric" maxlength="4" bind:value={newYear} placeholder="2024" />
				<button type="button" disabled={busy} onclick={createYear}>Create folder</button>
			</div>
			<button type="button" disabled={busy} onclick={() => api?.openUserDataFolder()}>
				Open app data folder
			</button>
		</section>

		{#if errorMessage}
			<p class="error">{errorMessage}</p>
		{/if}
		{#if message}
			<p class="success">{message}</p>
		{/if}
		{#if failures.length > 0}
			<div class="panel failures">
				<h2>Files that couldn't be read</h2>
				<p>
					These files were skipped so the rest of the folder could still be processed. Fix or
					remove them (see "Files&hellip;" above), then run extraction/build again.
				</p>
				<ul>
					{#each failures as f (f.file)}
						<li><strong>{f.file}</strong>: {f.error}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<section class="panel">
			<h2>Years</h2>
			{#if years.length === 0}
				<p>No years found yet - create one above.</p>
			{:else}
				<table class="years">
					<thead>
						<tr>
							<th>Year</th>
							<th>.docx reports</th>
							<th>Tagging</th>
							<th>Published</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each years as y (y.year)}
							<tr>
								<td>{y.year}</td>
								<td>{y.docxCount}</td>
								<td>
									{#if !y.hasTagging}
										not started
									{:else if y.pendingTags > 0}
										{y.pendingTags} row(s) pending (published as "Unknown")
									{:else}
										complete
									{/if}
								</td>
								<td>{y.published ? 'yes' : 'no'}</td>
								<td class="actions">
									<button type="button" disabled={busy} onclick={() => openFiles(y.year)}>
										Files&hellip;
									</button>
									{#if y.docxCount === 0}
										<button type="button" disabled={busy} onclick={() => demo(y.year)}>
											Use demo data
										</button>
									{:else}
										<button type="button" disabled={busy} onclick={() => extract(y.year)}>
											Extract
										</button>
										{#if y.hasTagging}
											<button type="button" disabled={busy} onclick={() => openTagging(y.year)}>
												Edit tags
											</button>
											<button type="button" disabled={busy} onclick={() => build(y.year)}>
												Build &amp; publish
											</button>
										{/if}
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>

		{#if filesYear}
			<section class="panel">
				<h2>Files in "{filesYear}"</h2>
				<button type="button" class="close" disabled={busy} onclick={closeFiles}>Close</button>

				{#if rawFiles.length === 0}
					<p>No <code>.docx</code> files saved in this folder yet.</p>
				{:else}
					<table class="files">
						<thead>
							<tr>
								<th>File</th>
								<th>Size</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each rawFiles as f (f.name)}
								<tr>
									<td>{f.name}</td>
									<td>{Math.round(f.size / 1024)} KB</td>
									<td class="actions">
										<button
											type="button"
											disabled={busy}
											onclick={() => removeFile(filesYear!, f.name)}
										>
											Remove
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}

				{#if pendingFiles.length > 0}
					<p class="pending">
						Found <strong>{pendingFiles.length}</strong> file(s) to save into
						<strong>{filesYear}</strong>:
					</p>
					<ul class="file-list">
						{#each pendingFiles as file (file)}
							<li>{file}</li>
						{/each}
					</ul>
					<button type="button" disabled={busy} onclick={confirmImport}>
						Save {pendingFiles.length} file(s) into "{filesYear}"
					</button>
					<button type="button" disabled={busy} onclick={cancelPendingFiles}>Cancel</button>
				{:else}
					<button type="button" disabled={busy} onclick={chooseFiles}>Add files&hellip;</button>
					<button type="button" disabled={busy} onclick={chooseFolderToImport}>
						Scan a folder for files&hellip;
					</button>
				{/if}
			</section>
		{/if}

		{#if activeYear && taggingRows.length > 0}
			<section class="panel">
				<h2>Tagging - {activeYear}</h2>
				<p>
					Use the excerpt as context and choose Y/N for each column, then save. Rows left as
					<code>TODO(Y/N)</code> are published as "Unknown".
				</p>
				<table class="tagging">
					<thead>
						<tr>
							<th>Gender</th>
							<th>Age</th>
							<th>Sleep issue</th>
							<th>Stress / burnout</th>
							<th>Acupuncture referral</th>
							<th>Mental health referral</th>
							<th>Excerpt</th>
						</tr>
					</thead>
					<tbody>
						{#each taggingRows as row (row.pseudonymous_id)}
							<tr>
								<td>{row.gender}</td>
								<td>{row.age}</td>
								{#each TAG_FIELDS as field (field)}
									<td>
										<select bind:value={row[field]}>
											<option value="TODO(Y/N)">?</option>
											<option value="Y">Y</option>
											<option value="N">N</option>
										</select>
									</td>
								{/each}
								<td class="excerpt">{row.personal_report_excerpt}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<button type="button" disabled={busy} onclick={saveTagging}>Save tags</button>
			</section>
		{/if}
	{/if}
</main>

<style>
	main {
		max-width: 68rem;
		margin: 0 auto;
		padding: 3rem 1.5rem 5rem;
	}
	.masthead {
		margin-bottom: 2rem;
	}
	.kicker {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.8rem;
		color: var(--color-muted);
		margin: 0 0 0.5rem;
	}
	.panel {
		background: var(--color-bg-panel);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}
	.panel h2 {
		margin-bottom: 0.75rem;
		font-size: 1.3rem;
	}
	.notice {
		background: var(--color-bg-alt);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 1.25rem;
	}
	.error {
		color: var(--color-accent);
	}
	.success {
		color: var(--color-teal);
	}
	.pending {
		color: var(--color-muted);
		font-size: 0.9rem;
	}
	button {
		font-family: var(--font-body);
		background: var(--color-ink);
		color: var(--color-bg-panel);
		border: none;
		border-radius: 4px;
		padding: 0.5rem 1rem;
		margin: 0 0.5rem 0.5rem 0;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.5rem 0.6rem;
		border-bottom: 1px solid var(--color-border);
		vertical-align: top;
	}
	.excerpt {
		max-width: 26rem;
		color: var(--color-muted);
	}
	.actions button {
		margin-bottom: 0;
	}
	.new-year {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.new-year input {
		font-family: var(--font-body);
		font-size: 1rem;
		width: 6rem;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}
	.close {
		float: right;
	}
	.file-list {
		max-height: 8rem;
		overflow-y: auto;
		font-size: 0.85rem;
		color: var(--color-muted);
		margin: 0 0 1rem;
		padding: 0.75rem 1rem;
		background: var(--color-bg-alt);
		border-radius: 4px;
		word-break: break-all;
	}
	.failures {
		border-color: var(--color-accent);
	}
	.failures h2 {
		color: var(--color-accent);
	}
	.failures ul {
		margin: 0;
		padding-left: 1.25rem;
	}
	.failures li {
		margin-bottom: 0.4rem;
		word-break: break-word;
	}
</style>
