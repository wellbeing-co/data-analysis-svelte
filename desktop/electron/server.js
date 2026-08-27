"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function safeJoin(rootDir, requestPath) {
  const resolved = path.normalize(path.join(rootDir, requestPath));
  if (!resolved.startsWith(path.normalize(rootDir))) return null;
  return resolved;
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypeFor(filePath) }).end(data);
  });
}

/**
 * @param {object} options
 * @param {string} options.staticDir - built dashboard (desktop/app-static/)
 * @param {string} options.publishedDir - published/<year>.csv + years.json (see paths.js)
 * @returns {import('node:http').Server}
 */
function createServer({ staticDir, publishedDir }) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname.startsWith("/data/")) {
      const publishedPath = safeJoin(publishedDir, url.pathname.slice("/data/".length));
      if (!publishedPath || !fs.existsSync(publishedPath)) {
        res.writeHead(404).end("Not found");
        return;
      }
      serveFile(res, publishedPath);
      return;
    }

    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    let filePath = safeJoin(staticDir, requestedPath);
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // SPA fallback - see app/vite.config.desktop.ts's adapter-static "fallback" option.
      filePath = path.join(staticDir, "index.html");
    }
    serveFile(res, filePath);
  });
}

module.exports = { createServer };
