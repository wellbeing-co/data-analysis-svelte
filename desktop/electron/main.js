"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const { buildPaths } = require("./paths");
const { createServer } = require("./server");
const taggingStore = require("../etl/taggingStore");
const pipeline = require("../etl/pipeline");
const { getSalt } = require("../etl/salt");
const demoData = require("../etl/demoData");

const STATIC_DIR = path.join(__dirname, "..", "app-static");

let mainWindow = null;
let httpServer = null;
let serverPort = 0;
let paths = null;

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(paths.settingsFile, "utf8"));
  } catch {
    return { rawDataDir: null };
  }
}

function writeSettings(settings) {
  fs.writeFileSync(paths.settingsFile, JSON.stringify(settings, null, 2));
}

function yearFolder(rawDataDir, year) {
  return path.join(rawDataDir, year);
}

function countDocx(folder) {
  if (!fs.existsSync(folder)) return 0;
  return fs
    .readdirSync(folder)
    .filter((name) => /\.docx$/i.test(name) && !name.startsWith(".") && !name.startsWith("~$"))
    .length;
}

function discoverYears(rawDataDir) {
  if (!rawDataDir || !fs.existsSync(rawDataDir)) return [];
  return fs
    .readdirSync(rawDataDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function pendingTagCount(taggingPath) {
  const tags = taggingStore.loadTagging(taggingPath);
  const rows = Object.values(tags);
  if (rows.length === 0) return -1;
  return rows.filter((row) =>
    taggingStore.TAG_COLUMNS.some((col) => row[col] === taggingStore.BLANK_TAG)
  ).length;
}

function publishYear(year, outputCsvPath) {
  fs.mkdirSync(paths.publishedDir, { recursive: true });
  fs.copyFileSync(outputCsvPath, paths.publishedPath(year));

  let years = [];
  if (fs.existsSync(paths.yearsJsonFile)) {
    try {
      years = JSON.parse(fs.readFileSync(paths.yearsJsonFile, "utf8"));
    } catch {
      years = [];
    }
  }
  years = [...new Set([...years, year])].sort();
  fs.writeFileSync(paths.yearsJsonFile, JSON.stringify(years));
}

function registerIpcHandlers() {
  ipcMain.handle("settings:get", () => readSettings());

  ipcMain.handle("dialog:chooseRawDataFolder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Choose the folder containing one subfolder per year of .docx reports"
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const [chosen] = result.filePaths;
    writeSettings({ ...readSettings(), rawDataDir: chosen });
    return chosen;
  });

  ipcMain.handle("etl:listYears", () => {
    const { rawDataDir } = readSettings();
    const publishedYears = fs.existsSync(paths.yearsJsonFile)
      ? JSON.parse(fs.readFileSync(paths.yearsJsonFile, "utf8"))
      : [];

    return discoverYears(rawDataDir).map((year) => {
      const docxCount = countDocx(yearFolder(rawDataDir, year));
      const taggingPath = paths.taggingPath(year);
      const hasTagging = fs.existsSync(taggingPath);
      return {
        year,
        docxCount,
        hasTagging,
        pendingTags: hasTagging ? pendingTagCount(taggingPath) : -1,
        hasOutput: fs.existsSync(paths.outputPath(year)),
        published: publishedYears.includes(year)
      };
    });
  });

  ipcMain.handle("etl:extractForTagging", async (_event, year) => {
    const { rawDataDir } = readSettings();
    if (!rawDataDir) throw new Error("Choose a raw data folder first.");

    const result = await pipeline.extractForTagging({
      yearFolder: yearFolder(rawDataDir, year),
      taggingCsvPath: paths.taggingPath(year),
      year,
      salt: getSalt(path.dirname(paths.saltFile))
    });
    return result;
  });

  ipcMain.handle("etl:getTagging", (_event, year) => {
    const tags = taggingStore.loadTagging(paths.taggingPath(year));
    return { rows: Object.values(tags) };
  });

  ipcMain.handle("etl:saveTagging", (_event, year, rows) => {
    taggingStore.writeTagging(paths.taggingPath(year), rows);
    return { ok: true };
  });

  ipcMain.handle("etl:buildYearlyCsv", async (_event, year) => {
    const { rawDataDir } = readSettings();
    if (!rawDataDir) throw new Error("Choose a raw data folder first.");

    const result = await pipeline.buildYearlyCsv({
      yearFolder: yearFolder(rawDataDir, year),
      taggingCsvPath: paths.taggingPath(year),
      outputCsvPath: paths.outputPath(year),
      year,
      salt: getSalt(path.dirname(paths.saltFile))
    });
    publishYear(year, paths.outputPath(year));
    return { ok: true, rowCount: result.rows.length };
  });

  ipcMain.handle("etl:generateDemoData", async (_event, year) => {
    const csv = await demoData.generateDemoCsv(year);
    fs.mkdirSync(paths.outputDir, { recursive: true });
    fs.writeFileSync(paths.outputPath(year), csv);
    publishYear(year, paths.outputPath(year));
    return { ok: true };
  });

  ipcMain.handle("shell:openUserDataFolder", () => {
    shell.openPath(app.getPath("userData"));
  });
}

function startLocalServer() {
  return new Promise((resolve) => {
    httpServer = createServer({ staticDir: STATIC_DIR, publishedDir: paths.publishedDir });
    httpServer.listen(0, "127.0.0.1", () => {
      serverPort = httpServer.address().port;
      resolve(serverPort);
    });
  });
}

async function seedDemoDataIfEmpty() {
  const hasAnyPublished = fs.existsSync(paths.yearsJsonFile);
  if (hasAnyPublished) return;

  const year = String(new Date().getFullYear());
  const csv = await demoData.generateDemoCsv(year);
  fs.mkdirSync(paths.outputDir, { recursive: true });
  fs.writeFileSync(paths.outputPath(year), csv);
  publishYear(year, paths.outputPath(year));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    title: "Complete Wellbeing - Data Reporting",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);
}

app.whenReady().then(async () => {
  paths = buildPaths(app.getPath("userData")).ensureAll();
  registerIpcHandlers();
  await seedDemoDataIfEmpty();
  await startLocalServer();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (httpServer) httpServer.close();
  if (process.platform !== "darwin") app.quit();
});
