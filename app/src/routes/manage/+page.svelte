<script lang="ts">
	import { desktopApi, type TaggingRow, type YearStatus } from '$lib/desktopApi';

	const api = desktopApi();

	let rawDataDir = $state<string | null>(null);
	let years = $state<YearStatus[]>([]);
	let activeYear = $state<string | null>(null);
	let taggingRows = $state<TaggingRow[]>([]);
	let busy = $state(false);
	let message = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	const TAG_FIELDS = [
		'sleep_issue',
		'stress_burnout',
		'acupuncture_referral',
		'mental_health_referral'
	] as const;

	async function refresh() {
		if (!api) return;
		const settings = await api.getSettings();
		rawDataDir = settings.rawDataDir;
		years = await api.listYears();
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

	async function chooseFolder() {
		const chosen = await run(() => api!.chooseRawDataFolder());
		if (chosen) {
			message = `Raw data folder set to ${chosen}`;
			await refresh();
		}
	}

	async function extract(year: string) {
		const result = await run(() => api!.extractForTagging(year));
		if (result) {
			activeYear = year;
			taggingRows = result.rows;
			message = `Extracted ${result.rows.length} report(s) for ${year} - fill in the tags below, then save.`;
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
		const result = await run(() => api!.saveTagging(activeYear!, taggingRows));
		if (result) {
			message = `Tags saved for ${activeYear}.`;
			await refresh();
		}
	}

	async function build(year: string) {
		const result = await run(() => api!.buildYearlyCsv(year));
		if (result) {
			message = `Built and published ${result.rowCount} row(s) for ${year}. Reload the dashboard to see it.`;
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
			<h2>Raw data folder</h2>
			<p>
				{#if rawDataDir}
					Currently: <code>{rawDataDir}</code>
				{:else}
					No folder chosen yet - pick the folder that contains one subfolder per year of
					<code>.docx</code> reports (e.g. <code>2023/</code>, <code>2024/</code>).
				{/if}
			</p>
			<button type="button" disabled={busy} onclick={chooseFolder}>Choose folder&hellip;</button>
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

		<section class="panel">
			<h2>Years</h2>
			{#if years.length === 0}
				<p>No years found yet - choose a raw data folder above.</p>
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
										{y.pendingTags} row(s) pending
									{:else}
										complete
									{/if}
								</td>
								<td>{y.published ? 'yes' : 'no'}</td>
								<td class="actions">
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
											<button
												type="button"
												disabled={busy || y.pendingTags > 0}
												onclick={() => build(y.year)}
											>
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
</style>
