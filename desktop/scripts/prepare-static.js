"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const DESKTOP_DIR = path.join(__dirname, "..");
const APP_DIR = path.join(DESKTOP_DIR, "..", "app");
const APP_BUILD_DIR = path.join(APP_DIR, "build-desktop");
const STATIC_DIR = path.join(DESKTOP_DIR, "app-static");

function run(cmd, args, cwd) {
  console.log(`> (${cwd}) ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

if (!fs.existsSync(path.join(APP_DIR, "node_modules"))) {
  run(npmCmd, ["install"], APP_DIR);
}

run(npmCmd, ["run", "build:desktop"], APP_DIR);

if (!fs.existsSync(APP_BUILD_DIR)) {
  throw new Error(`Expected ${APP_BUILD_DIR} to exist after "npm run build:desktop" - check app/vite.config.desktop.ts`);
}

fs.rmSync(STATIC_DIR, { recursive: true, force: true });
fs.cpSync(APP_BUILD_DIR, STATIC_DIR, { recursive: true });

console.log(`Copied ${APP_BUILD_DIR} -> ${STATIC_DIR}`);
