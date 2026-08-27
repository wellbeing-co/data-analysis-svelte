<script lang="ts">
	import { Chart, type ChartData } from 'chart.js/auto';
	import type { Count } from '$lib/stats';

	let { title, data, color = '#b5482f' }: { title: string; data: Count[]; color?: string } =
		$props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | undefined;

	function chartData(counts: Count[]): ChartData<'bar'> {
		return {
			labels: counts.map((c) => c.label),
			datasets: [{ data: counts.map((c) => c.count), backgroundColor: color }]
		};
	}

	$effect(() => {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'bar',
			data: chartData(data),
			options: {
				responsive: true,
				plugins: { legend: { display: false } },
				scales: {
					y: { beginAtZero: true, ticks: { precision: 0 } },
					x: { grid: { display: false } }
				}
			}
		});
		return () => chart?.destroy();
	});
</script>

<figure class="chart">
	<figcaption>{title}</figcaption>
	<canvas bind:this={canvas}></canvas>
</figure>

<style>
	.chart {
		margin: 0;
	}
	figcaption {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
		color: var(--color-ink);
	}
</style>
