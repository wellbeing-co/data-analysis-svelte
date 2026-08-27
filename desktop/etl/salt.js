// Node.js port of ../../etl/lib/etl/salt.rb - unlike the Ruby version, the
// salt file's directory is a parameter rather than hardcoded, since the
// desktop app keeps it under Electron's per-OS userData directory (see
// electron/paths.js) instead of etl/config/salt.txt.
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function getSalt(configDir) {
  fs.mkdirSync(configDir, { recursive: true });
  const saltFile = path.join(configDir, "salt.txt");
  if (!fs.existsSync(saltFile)) {
    fs.writeFileSync(saltFile, crypto.randomBytes(32).toString("hex"));
  }
  return fs.readFileSync(saltFile, "utf8").trim();
}

module.exports = { getSalt };
