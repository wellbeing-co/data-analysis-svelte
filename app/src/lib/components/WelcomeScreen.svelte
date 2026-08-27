<script lang="ts">
	import { desktopApi } from '$lib/desktopApi';
	import { goto } from '$app/navigation';

	const api = desktopApi();

	let year = $state(String(new Date().getFullYear()));
	let pendingFiles = $state<string[]>([]);
	let busy = $state(false);
	let errorMessage = $state<string | null>(null);
	let resultMessage = $state<string | null>(null);

	function isValidYear(value: string) {
		return /^\d{4}$/.test(value);
	}

	async function chooseFiles() {
		if (!api) return;
		busy = true;
		errorMessage = null;
		try {
			const chosen = await api.chooseDocxFiles();
			if (chosen.length > 0) pendingFiles = chosen;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}

	async function chooseFolder() {
		if (!api) return;
		busy = true;
		errorMessage = null;
		try {
			const found = await api.chooseFolderToImport();
			if (found.length === 0) {
				errorMessage = 'No .docx files were found in that folder.';
			} else {
				pendingFiles = found;
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}

	function clearPending() {
		pendingFiles = [];
		resultMessage = null;
	}

	async function confirmImport() {
		if (!api || pendingFiles.length === 0) return;
		if (!isValidYear(year)) {
			errorMessage = 'Enter a 4-digit year, e.g. 2024.';
			return;
		}
		busy = true;
		errorMessage = null;
		try {
			await api.createRawYear(year);
			// pendingFiles is a $state array (Proxy) - Electron's contextBridge
			// cannot structured-clone Proxies over IPC ("An object could not be
			// cloned"), so send a plain snapshot instead.
			const files = $state.snapshot(pendingFiles);
			const result = await api.importRawFiles(year, files);
			resultMessage =
				`Saved ${result.imported} of ${result.total} file(s) into the "${year}" folder` +
				(result.skipped > 0 ? ` (${result.skipped} already existed and were skipped).` : '.');
			pendingFiles = [];
			await goto('/manage');
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}
</script>

<main class="welcome">
	<div class="card">
		<p class="kicker">The Wellbeing Co - Data Analysis</p>
		<h1>Welcome</h1>
		<p class="lede">
			To begin, choose which year these
			reports belong to, then add the <code>.docx</code> assessment files. They will be copied
			into the app's own storage so it can process them.
		</p>

		<label class="year-field">
			Year
			<input type="text" inputmode="numeric" maxlength="4" bind:value={year} placeholder="2024" />
		</label>

		{#if pendingFiles.length > 0}
			<p class="selected">
				Found <strong>{pendingFiles.length}</strong> file(s) to save into
				<strong>{year}</strong>:
			</p>
			<ul class="file-list">
				{#each pendingFiles as file (file)}
					<li>{file}</li>
				{/each}
			</ul>
			<div class="actions">
				<button type="button" disabled={busy} onclick={confirmImport}>
					Save {pendingFiles.length} file(s) into "{year}"
				</button>
				<button type="button" disabled={busy} onclick={clearPending}>Cancel</button>
			</div>
		{:else}
			<div class="actions">
				<button type="button" disabled={busy} onclick={chooseFiles}>Choose files&hellip;</button>
				<button type="button" disabled={busy} onclick={chooseFolder}>
					Choose a folder to scan&hellip;
				</button>
			</div>
		{/if}

		{#if errorMessage}
			<p class="error">{errorMessage}</p>
		{/if}
		{#if resultMessage}
			<p class="success">{resultMessage}</p>
		{/if}
	</div>
</main>

<style>
	.welcome {
		min-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.5rem;
	}
	.card {
		max-width: 34rem;
		background: var(--color-bg-panel);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 2.5rem;
		text-align: center;
	}
	.kicker {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.8rem;
		color: var(--color-muted);
		margin: 0 0 0.75rem;
	}
	h1 {
		font-size: clamp(2rem, 5vw, 2.6rem);
		margin: 0 0 1rem;
	}
	.lede {
		font-size: 1.05rem;
		color: var(--color-ink);
		margin: 0 0 1.75rem;
	}
	.year-field {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.9rem;
		color: var(--color-muted);
		margin: 0 0 1.5rem;
	}
	.year-field input {
		font-family: var(--font-body);
		font-size: 1.2rem;
		text-align: center;
		width: 6rem;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}
	.selected {
		margin: 0 0 0.5rem;
		font-size: 0.95rem;
		color: var(--color-ink);
	}
	.file-list {
		max-height: 8rem;
		overflow-y: auto;
		text-align: left;
		font-size: 0.85rem;
		color: var(--color-muted);
		margin: 0 0 1.5rem;
		padding: 0.75rem 1rem;
		background: var(--color-bg-alt);
		border-radius: 4px;
		word-break: break-all;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
	}
	button {
		font-family: var(--font-body);
		background: var(--color-ink);
		color: var(--color-bg-panel);
		border: none;
		border-radius: 4px;
		padding: 0.6rem 1.25rem;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.error {
		margin-top: 1.25rem;
		color: var(--color-accent);
	}
	.success {
		margin-top: 1.25rem;
		color: var(--color-teal);
	}
</style>
