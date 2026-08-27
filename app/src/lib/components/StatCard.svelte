<script lang="ts">
	let {
		title,
		value,
		subtitle,
		accent = 'accent'
	}: { title: string; value: string; subtitle?: string; accent?: 'accent' | 'teal' | 'gold' } =
		$props();
</script>

<div class="card card--{accent}">
	<h3>{title}</h3>
	<p class="value">{value}</p>
	{#if subtitle}
		<p class="subtitle">{subtitle}</p>
	{/if}
</div>

<style>
	.card {
		border: 1px solid var(--color-border);
		border-left: 4px solid var(--color-accent);
		border-radius: 4px;
		padding: 1.25rem 1.5rem;
		background: var(--color-bg-panel);
	}
	.card--teal {
		border-left-color: var(--color-teal);
	}
	.card--gold {
		border-left-color: var(--color-gold);
	}
	h3 {
		margin: 0 0 0.6rem;
		font-family: var(--font-body);
		font-size: 0.85rem;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--color-muted);
		font-weight: 600;
	}
	.value {
		margin: 0;
		font-family: var(--font-display);
		font-size: 2.4rem;
		font-weight: 600;
		color: var(--color-ink);
	}
	.subtitle {
		margin: 0.35rem 0 0;
		font-size: 0.9rem;
		color: var(--color-muted);
	}
</style>
