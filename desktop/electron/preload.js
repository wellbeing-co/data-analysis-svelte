"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  isDesktop: true,
  getSettings: () => ipcRenderer.invoke("settings:get"),
  chooseRawDataFolder: () => ipcRenderer.invoke("dialog:chooseRawDataFolder"),
  listYears: () => ipcRenderer.invoke("etl:listYears"),
  extractForTagging: (year) => ipcRenderer.invoke("etl:extractForTagging", year),
  getTagging: (year) => ipcRenderer.invoke("etl:getTagging", year),
  saveTagging: (year, rows) => ipcRenderer.invoke("etl:saveTagging", year, rows),
  buildYearlyCsv: (year) => ipcRenderer.invoke("etl:buildYearlyCsv", year),
  generateDemoData: (year) => ipcRenderer.invoke("etl:generateDemoData", year),
  openUserDataFolder: () => ipcRenderer.invoke("shell:openUserDataFolder")
});
