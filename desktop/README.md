# Complete Wellbeing - standalone desktop app

A single offline installer (`.exe` / `.dmg` / `.deb`) that packages the whole
ETL + dashboard as one Electron app.

## Layout

```
electron/           Electron main process, preload bridge, local HTTP server
etl/                Node.js port of ../etl/lib/etl/*.rb and ../etl/jobs/*.rb
etl/test/           node:test suite for the port (parity-checked against
                    the Ruby fixtures in ../etl/test/)
scripts/            Build-time helper scripts (static SPA build/copy)
build/              electron-builder's "buildResources": icon.svg (master) and
                    icon.png (1024x1024) - a single icon.png is enough for
                    electron-builder to auto-generate .icns/.ico/Linux icon sets
app-static/         Built dashboard, generated
dist/               electron-builder output (installers), generated
```

Why a Node port of the ETL rather than bundling Ruby: Electron already
ships a full Node runtime inside the packaged app, so keeping everything on
one runtime means the installer needs no separate interpreter to be
downloaded, installed, or found on the user's `PATH` - it just works after
double-clicking the installer. The Ruby pipeline under `../etl/` keeps
working unchanged for local development / CI (`bin/run`,
`bin/tagging_server`) - the two implementations are kept behaviourally in
sync by testing the Node port against the same sample data and thresholds.

## How the app works

- On first launch, if no data has ever been published, the app generates
  demo data for the current year so there's something to look at.
- The **Manage data** screen (in the SvelteKit app, reachable once the
  desktop app is running) lets the user:
  1. Choose the folder containing one subfolder per year of `.docx` reports.
  2. Extract a year for tagging (writes an internal tagging CSV).
  3. Fill in Y/N for sleep issue / stress-burnout / acupuncture referral /
     mental health referral directly in the app (rows left blank publish as
     "Unknown").
  4. Build and publish - the final anonymised CSV is copied into the
     dashboard's data folder and the year is added to `years.json`.
  5. Years with no `.docx` files yet can generate demo data instead, same as
     `bin/run`'s fallback.
- All of the above happens through IPC calls from the renderer
  (`app/src/lib/desktopApi.ts`) to handlers in `electron/main.js`, which call
  straight into the Node ETL.
- Everything the app reads or writes lives under Electron's
  `app.getPath('userData')` - A per-OS, per-app folder that needs no special 
  permissions and is fully separate from the install location.

## Building

```
cd desktop
npm install
npm run dist
npm run dist -- --linux deb
npm run dist -- --win nsis
npm run dist -- --mac dmg
```

`npm run dist` first runs `scripts/prepare-static.js` (builds the SvelteKit
app as a static SPA and copies it into `app-static/`), then invokes
`electron-builder`, which reads the `build` key in `package.json` for the
installer configuration (app id, product name, per-OS targets).

Installers must be built on their own native OS - electron-builder can't
reliably cross-compile a `.dmg` or NSIS `.exe` from Linux. `../.github/workflows/release.yml`
handles this with a build matrix across `ubuntu-latest`, `windows-latest`
and `macos-latest`, triggered by pushing a `desktop-v*` tag (or manually for
a test build) and attaches the resulting installers to a GitHub Release.

## Tests

```
cd desktop
npm install
npm test
```

Covers the Node ETL port: docx extraction (checked against the same sample
report and expected values as `../etl/test/report_extractor_test.rb`),
health-metric derivations, tagging store round-trips and a full
extract-tag-build pipeline run against a temporary directory.

## Network Connectivity

The desktop app has zero network requirements once installed and can be used
100% offline.

## Running in development

```
cd desktop
npm install
npm start
```

This runs the Electron shell directly against whatever is already in
`app-static/` - run `node scripts/prepare-static.js` first (or `npm run
dist` once) to make sure that folder is up to date.
