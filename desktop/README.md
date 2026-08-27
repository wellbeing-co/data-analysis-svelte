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

- The app ships with **no sample data** and never reads `.docx` files from an
  external, user-owned folder at ETL time. Instead, every report is
  **copied into the app's own storage** (`userData/raw-data/<year>/`) the
  moment it's added, so the app always has a complete, self-contained view of
  exactly what it can see - this also avoids relying on native file/folder
  pickers correctly enumerating an external folder's contents on every OS.
- On first launch, a welcome screen asks the user to pick a year, then add
  `.docx` files (either an explicit multi-file selection, or a folder to
  scan for `.docx` files inside it). Before anything is copied, the app shows
  exactly how many files were found; after copying, it reports exactly how
  many were saved into that year's folder.
- The **Manage data** screen (in the SvelteKit app, reachable once the
  desktop app is running) is where this is managed long-term:
  1. **Add a year** - type a 4-digit year and click "Create folder" to make
     a new folder inside the app's storage.
  2. **Files...** on any year opens that year's file list (name + size) with
     a **Remove** button per file, plus **Add files...** /
     **Scan a folder for files...** to copy more `.docx` reports in - always
     showing the exact count saved/skipped before it's applied.
  3. Extract a year for tagging (writes an internal tagging CSV).
  4. Fill in Y/N for sleep issue / stress-burnout / acupuncture referral /
     mental health referral directly in the app (rows left blank publish as
     "Unknown").
  5. Build and publish - the final anonymised CSV is copied into the
     dashboard's data folder and the year is added to `years.json`.
- All of the above happens through IPC calls from the renderer
  (`app/src/lib/desktopApi.ts`) to handlers in `electron/main.js`
  (`rawData:*`/`dialog:chooseDocxFiles`/`dialog:chooseFolderToImport`), which
  call straight into the Node ETL.
- Everything the app reads or writes - including the copied `.docx` reports
  themselves - lives under Electron's `app.getPath('userData')` - a per-OS,
  per-app folder that needs no special permissions and is fully separate
  from the install location.

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
