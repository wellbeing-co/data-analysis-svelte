import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Separate build used only for the Electron desktop package (see ../desktop/).
// Produces a static SPA bundle (build-desktop/) that the desktop app's local
// server serves over http://127.0.0.1 - kept apart from the normal `npm run
// build` output so regular web deployments are unaffected.
export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				pages: 'build-desktop',
				assets: 'build-desktop',
				fallback: 'index.html',
				strict: false
			})
		})
	]
});
