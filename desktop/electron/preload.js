"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  isDesktop: true,
  listRawYears: () => ipcRenderer.invoke("rawData:listYears"),
  createRawYear: (year) => ipcRenderer.invoke("rawData:createYear", year),
  listRawFiles: (year) => ipcRenderer.invoke("rawData:listFiles", year),
  chooseDocxFiles: () => ipcRenderer.invoke("dialog:chooseDocxFiles"),
  chooseFolderToImport: () => ipcRenderer.invoke("dialog:chooseFolderToImport"),
  importRawFiles: (year, filePaths) => ipcRenderer.invoke("rawData:importFiles", year, filePaths),
  removeRawFile: (year, name) => ipcRenderer.invoke("rawData:removeFile", year, name),
  listYears: () => ipcRenderer.invoke("etl:listYears"),
  extractForTagging: (year) => ipcRenderer.invoke("etl:extractForTagging", year),
  getTagging: (year) => ipcRenderer.invoke("etl:getTagging", year),
  saveTagging: (year, rows) => ipcRenderer.invoke("etl:saveTagging", year, rows),
  buildYearlyCsv: (year) => ipcRenderer.invoke("etl:buildYearlyCsv", year),
  generateDemoData: (year) => ipcRenderer.invoke("etl:generateDemoData", year),
  openUserDataFolder: () => ipcRenderer.invoke("shell:openUserDataFolder")
});
