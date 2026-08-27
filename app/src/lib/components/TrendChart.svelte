<script lang="ts">
	import { Chart, type ChartData } from 'chart.js/auto';
	import type { YearlySummary } from '$lib/stats';

	let {
		summaries,
		series
	}: {
		summaries: YearlySummary[];
		series: { key: keyof YearlySummary; label: string; color: string }[];
	} = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | undefined;

	function chartData(): ChartData<'line'> {
		return {
			labels: summaries.map((s) => s.year),
			datasets: series.map((s) => ({
				label: s.label,
				data: summaries.map((row) => Number(row[s.key])),
				borderColor: s.color,
				backgroundColor: s.color,
				pointBackgroundColor: s.color,
				pointRadius: 4,
				tension: 0.35,
				fill: false
			}))
		};
	}

	$effect(() => {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'line',
			data: chartData(),
			options: {
				responsive: true,
				interaction: { intersect: false, mode: 'index' },
				plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
				scales: { y: { beginAtZero: true } }
			}
		});
		return () => chart?.destroy();
	});
</script>

<canvas bind:this={canvas}></canvas>
