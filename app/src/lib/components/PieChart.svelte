<script lang="ts">
	import { Chart, type ChartData } from 'chart.js/auto';
	import type { Count } from '$lib/stats';

	let { title, data }: { title: string; data: Count[] } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | undefined;

	const palette = ['#b5482f', '#2f6d63', '#c08a1e', '#8a6bb0', '#5b7a9c', '#a89a86'];

	function chartData(counts: Count[]): ChartData<'pie'> {
		return {
			labels: counts.map((c) => c.label),
			datasets: [
				{
					data: counts.map((c) => c.count),
					backgroundColor: counts.map((_, i) => palette[i % palette.length])
				}
			]
		};
	}

	$effect(() => {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'pie',
			data: chartData(data),
			options: {
				responsive: true,
				plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: "'Source Sans 3', sans-serif" } } } }
			}
		});
		return () => chart?.destroy();
	});
</script>

<figure class="chart">
	<figcaption>{title}</figcaption>
	<div class="canvas-wrap">
		<canvas bind:this={canvas}></canvas>
	</div>
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
	.canvas-wrap {
		max-width: 320px;
		margin: 0 auto;
	}
</style>
