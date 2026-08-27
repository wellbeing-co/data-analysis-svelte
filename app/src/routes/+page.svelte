<script lang="ts">
	import { loadAvailableYears, loadYear, loadAllYears } from '$lib/data';
	import {
		ageRangeDistribution,
		genderSplit,
		summariseFlag,
		summariseYear,
		underfuellingWhileHealthy,
		type YearlySummary
	} from '$lib/stats';
	import type { AssessmentRow } from '$lib/types';
	import { desktopApi } from '$lib/desktopApi';
	import PieChart from '$lib/components/PieChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';

	const isDesktop = desktopApi() !== null;

	let years = $state<string[]>([]);
	let selectedYear = $state<string>('');
	let rows = $state<AssessmentRow[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let summaries = $state<YearlySummary[]>([]);

	$effect(() => {
		loadAvailableYears().then((available) => {
			years = available;
			if (available.length > 0) selectedYear = available[available.length - 1];
		});
	});

	$effect(() => {
		if (!selectedYear) return;
		loading = true;
		error = null;
		loadYear(selectedYear)
			.then((data) => (rows = data))
			.catch((err) => (error = err.message))
			.finally(() => (loading = false));
	});

	$effect(() => {
		if (years.length === 0) return;
		loadAllYears(years).then((all) => {
			summaries = [...years]
				.sort()
				.map((year) => summariseYear(year, all[year] ?? []));
		});
	});

	const gender = $derived(genderSplit(rows));
	const ageRanges = $derived(ageRangeDistribution(rows));
	const sleep = $derived(summariseFlag(rows, 'sleep_issue'));
	const stress = $derived(summariseFlag(rows, 'stress_burnout'));
	const acupuncture = $derived(summariseFlag(rows, 'acupuncture_referral'));
	const mentalHealth = $derived(summariseFlag(rows, 'mental_health_referral'));
	const underfuelling = $derived(underfuellingWhileHealthy(rows));

	const femaleCount = $derived(gender.find((g) => g.label === 'Female')?.count ?? 0);
	const maleCount = $derived(gender.find((g) => g.label === 'Male')?.count ?? 0);
	const majorityGender = $derived(femaleCount >= maleCount ? 'women' : 'men');
	const majorityPct = $derived(
		rows.length ? Math.round((Math.max(femaleCount, maleCount) / rows.length) * 100) : 0
	);
	const commonAgeRange = $derived(
		ageRanges.length && rows.length
			? ageRanges.reduce((a, b) => (b.count > a.count ? b : a)).label
			: ''
	);

	const trendSeries = [
		{ key: 'sleepPct' as const, label: 'Sleep issues %', color: '#5b7a9c' },
		{ key: 'stressPct' as const, label: 'Stress / burnout %', color: '#b5482f' },
		{ key: 'underfuellingPct' as const, label: 'Underfuelling %', color: '#c08a1e' }
	];
	const referralSeries = [
		{ key: 'acupunctureCount' as const, label: 'Acupuncture referrals', color: '#2f6d63' },
		{ key: 'mentalHealthCount' as const, label: 'Mental health referrals', color: '#8a6bb0' }
	];
</script>

<svelte:head>
	<title>Wellbeing Reporting - {selectedYear || '...'}</title>
</svelte:head>

<main>
	<header class="masthead">
		<p class="kicker">Complete Wellbeing - Anonymised Health Assessments</p>
		<h1>The story of {selectedYear || '...'}</h1>
		{#if isDesktop}
			<p class="lede"><a href="/manage">Manage this year's data &rarr;</a></p>
		{/if}
		{#if years.length > 0}
			<nav class="year-picker" aria-label="Choose a year">
				{#each years as year (year)}
					<button
						type="button"
						class:active={year === selectedYear}
						onclick={() => (selectedYear = year)}
					>
						{year}
					</button>
				{/each}
			</nav>
		{/if}
	</header>

	{#if error}
		<p class="error">
			{error}. Has the ETL output been copied into <code>app/static/data/</code>?
		</p>
	{:else if loading}
		<p class="loading">Loading the {selectedYear} report...</p>
	{:else}
		<p class="lede">
			In {selectedYear}, {rows.length} people took part in a wellbeing assessment.
		</p>

		<section class="chapter">
			<h2>Who took part</h2>
			<p>
				{#if rows.length}
					The group was made up mostly of {majorityGender} ({majorityPct}%), spanning a
					range of ages. Most people fell into the <strong>{commonAgeRange}</strong> age range.
				{:else}
					No assessments recorded for {selectedYear} yet.
				{/if}
			</p>
			<div class="grid grid-2">
				<div class="panel">
					<PieChart title="Gender split" data={gender} />
				</div>
				<div class="panel">
					<BarChart title="Age ranges" data={ageRanges} color="#5b7a9c" />
				</div>
			</div>
		</section>

		<section class="chapter">
			<h2>Sleep, stress and burnout</h2>
			<p>
				This year, <strong>{sleep.yesPercentage}%</strong> reported
				sleep issues, and <strong>{stress.yesPercentage}%</strong> showed signs of stress or
				burnout.
			</p>
			<div class="grid grid-2">
				<StatCard
					title="Sleep issues"
					value={`${sleep.yesPercentage}%`}
					subtitle={`${sleep.yes} of ${sleep.total} reported (Unknown: ${sleep.unknown})`}
					accent="teal"
				/>
				<StatCard
					title="Stress / burnout"
					value={`${stress.yesPercentage}%`}
					subtitle={`${stress.yes} of ${stress.total} reported (Unknown: ${stress.unknown})`}
					accent="accent"
				/>
			</div>
		</section>

		<section class="chapter">
			<h2>Nutrition</h2>
			<p>
				<strong>{underfuelling.yesPercentage}%</strong> of this year's group presented as
				overall healthy while also showing signs of nutritional underfuelling.
			</p>
			<div class="grid grid-1">
				<StatCard
					title="Underfuelling while overall healthy"
					value={`${underfuelling.yesPercentage}%`}
					subtitle={`${underfuelling.yes} of ${underfuelling.total} assessments (good cholesterol + good blood pressure)`}
					accent="gold"
				/>
			</div>
		</section>

		<section class="chapter">
			<h2>Referrals</h2>
			<p>
				When an assessment uncovers a concern, people are referred on for further help.
				This year, <strong>{acupuncture.yes}</strong> people were referred for acupuncture and
				<strong>{mentalHealth.yes}</strong> for mental health support.
			</p>
			<div class="grid grid-2">
				<StatCard
					title="Acupuncture referrals"
					value={String(acupuncture.yes)}
					subtitle={`${acupuncture.yesPercentage}% of ${acupuncture.total} assessments`}
					accent="teal"
				/>
				<StatCard
					title="Mental health referrals"
					value={String(mentalHealth.yes)}
					subtitle={`${mentalHealth.yesPercentage}% of ${mentalHealth.total} assessments`}
					accent="accent"
				/>
			</div>
		</section>
	{/if}

	{#if summaries.length > 1}
		<section class="chapter chapter--trends">
			<h2>Spotting trends across years</h2>
			<p>
				Looking across {summaries.length} years
				of assessments shows whether wellbeing signals are getting better, worse, or holding
				steady.
			</p>
			<div class="grid grid-2">
				<div class="panel">
					<p class="panel-title">Wellbeing signals over time</p>
					<TrendChart {summaries} series={trendSeries} />
				</div>
				<div class="panel">
					<p class="panel-title">Referrals over time</p>
					<TrendChart {summaries} series={referralSeries} />
				</div>
			</div>
		</section>
	{/if}

	<footer>
		<p>
			Anonymised, aggregated data. See
			<code>README.md</code> for ETL pipeline.
		</p>
	</footer>
</main>

<style>
	main {
		max-width: var(--content-width);
		margin: 0 auto;
		padding: 3rem 1.5rem 4rem;
	}

	.masthead {
		text-align: center;
		margin-bottom: 2.5rem;
	}
	.kicker {
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted);
		margin-bottom: 0.75rem;
	}
	.masthead h1 {
		font-size: clamp(2.2rem, 5vw, 3rem);
		margin-bottom: 1.25rem;
	}

	.year-picker {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.year-picker button {
		font-family: var(--font-body);
		font-size: 0.95rem;
		padding: 0.4rem 1rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-panel);
		color: var(--color-muted);
		cursor: pointer;
	}
	.year-picker button.active {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: #fff;
		font-weight: 600;
	}

	.lede {
		font-size: 1.2rem;
		color: var(--color-ink);
		text-align: center;
		max-width: 38rem;
		margin: 0 auto 2.5rem;
	}

	.loading,
	.error {
		text-align: center;
	}
	.error {
		color: var(--color-accent);
	}

	.chapter {
		margin: 3rem 0;
		padding-top: 2rem;
		border-top: 1px solid var(--color-border);
	}
	.chapter h2 {
		font-size: 1.6rem;
		margin-bottom: 0.75rem;
	}
	.chapter > p {
		font-size: 1.05rem;
		color: var(--color-ink);
	}

	.grid {
		display: grid;
		gap: 1.25rem;
		margin-top: 1.5rem;
	}
	.grid-2 {
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	}
	.grid-1 {
		grid-template-columns: 1fr;
	}

	.panel {
		background: var(--color-bg-panel);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 1.25rem 1.5rem;
	}
	.panel-title {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
	}

	.chapter--trends {
		background: var(--color-bg-alt);
		border-radius: 8px;
		padding: 2rem 1.5rem;
		border-top: none;
	}

	footer {
		margin-top: 3rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--color-border);
		font-size: 0.85rem;
		color: var(--color-muted);
		text-align: center;
	}
</style>
