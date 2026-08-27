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

function ensureValidYearName(year) {
  if (typeof year !== "string" || !/^\d{4}$/.test(year)) {
    throw new Error(`Invalid year folder name: "${year}". Use a 4-digit year, e.g. 2024.`);
  }
}

function ensureSafeFileName(name) {
  if (
    typeof name !== "string" ||
    name.length === 0 ||
    name.includes("/") ||
    name.includes("\\") ||
    name === "." ||
    name === ".."
  ) {
    throw new Error(`Invalid file name: "${name}".`);
  }
}

function listDocxFiles(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((name) => /\.docx$/i.test(name) && !name.startsWith(".") && !name.startsWith("~$"))
    .sort();
}

function countDocx(folder) {
  return listDocxFiles(folder).length;
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
  ipcMain.handle("rawData:listYears", () => discoverYears(paths.rawDataDir));

  ipcMain.handle("rawData:createYear", (_event, year) => {
    ensureValidYearName(year);
    fs.mkdirSync(paths.rawYearFolder(year), { recursive: true });
    return { ok: true };
  });

  ipcMain.handle("rawData:listFiles", (_event, year) => {
    ensureValidYearName(year);
    const folder = paths.rawYearFolder(year);
    return listDocxFiles(folder).map((name) => {
      const { size, mtimeMs } = fs.statSync(path.join(folder, name));
      return { name, size, mtimeMs };
    });
  });

  ipcMain.handle("dialog:chooseDocxFiles", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Word documents", extensions: ["docx"] }],
      title: "Choose one or more .docx report files to add"
    });
    if (result.canceled) return [];
    return result.filePaths;
  });

  ipcMain.handle("dialog:chooseFolderToImport", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Choose a folder to scan for .docx report files"
    });
    if (result.canceled || result.filePaths.length === 0) return [];

    const [folder] = result.filePaths;
    return listDocxFiles(folder).map((name) => path.join(folder, name));
  });

  ipcMain.handle("rawData:importFiles", (_event, year, filePaths) => {
    ensureValidYearName(year);
    const folder = paths.rawYearFolder(year);
    fs.mkdirSync(folder, { recursive: true });

    const importedNames = [];
    const skippedNames = [];
    for (const filePath of filePaths) {
      const name = path.basename(filePath);
      const dest = path.join(folder, name);
      if (fs.existsSync(dest)) {
        skippedNames.push(name);
        continue;
      }
      fs.copyFileSync(filePath, dest);
      importedNames.push(name);
    }

    return {
      folder,
      total: filePaths.length,
      imported: importedNames.length,
      skipped: skippedNames.length,
      importedNames,
      skippedNames
    };
  });

  ipcMain.handle("rawData:removeFile", (_event, year, name) => {
    ensureValidYearName(year);
    ensureSafeFileName(name);
    const target = path.join(paths.rawYearFolder(year), name);
    if (fs.existsSync(target)) fs.unlinkSync(target);
    return { ok: true };
  });

  ipcMain.handle("etl:listYears", () => {
    const publishedYears = fs.existsSync(paths.yearsJsonFile)
      ? JSON.parse(fs.readFileSync(paths.yearsJsonFile, "utf8"))
      : [];

    return discoverYears(paths.rawDataDir).map((year) => {
      const docxCount = countDocx(paths.rawYearFolder(year));
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
    const result = await pipeline.extractForTagging({
      yearFolder: paths.rawYearFolder(year),
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
    const result = await pipeline.buildYearlyCsv({
      yearFolder: paths.rawYearFolder(year),
      taggingCsvPath: paths.taggingPath(year),
      outputCsvPath: paths.outputPath(year),
      year,
      salt: getSalt(path.dirname(paths.saltFile))
    });
    publishYear(year, paths.outputPath(year));
    return { ok: true, rowCount: result.rows.length, failures: result.failures };
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
