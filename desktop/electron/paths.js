"use strict";

const path = require("node:path");
const fs = require("node:fs");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildPaths(userDataDir) {
  const etlDir = path.join(userDataDir, "etl");
  const publishedDir = path.join(userDataDir, "published");
  const rawDataDir = path.join(userDataDir, "raw-data");

  return {
    settingsFile: path.join(userDataDir, "settings.json"),
    saltFile: path.join(etlDir, "config", "salt.txt"),
    taggingDir: path.join(etlDir, "tagging"),
    outputDir: path.join(etlDir, "output"),
    publishedDir,
    rawDataDir,
    yearsJsonFile: path.join(publishedDir, "years.json"),
    rawYearFolder(year) {
      return path.join(this.rawDataDir, year);
    },
    taggingPath(year) {
      return path.join(this.taggingDir, `${year}_tagging.csv`);
    },
    outputPath(year) {
      return path.join(this.outputDir, `${year}.csv`);
    },
    publishedPath(year) {
      return path.join(this.publishedDir, `${year}.csv`);
    },
    ensureAll() {
      ensureDir(this.taggingDir);
      ensureDir(this.outputDir);
      ensureDir(path.dirname(this.saltFile));
      ensureDir(this.publishedDir);
      ensureDir(this.rawDataDir);
      return this;
    }
  };
}

module.exports = { buildPaths, ensureDir };
