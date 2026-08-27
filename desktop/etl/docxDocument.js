"use strict";

const fs = require("node:fs");
const JSZip = require("jszip");
const { DOMParser } = require("@xmldom/xmldom");

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function isW(node, localName) {
  return !!node && node.nodeType === 1 && node.localName === localName && node.namespaceURI === W_NS;
}

function walkElements(node, visit) {
  const children = node.childNodes;
  if (!children) return;
  for (let i = 0; i < children.length; i += 1) {
    const child = children.item(i);
    if (child.nodeType === 1) {
      visit(child);
      walkElements(child, visit);
    }
  }
}

function directChildren(node, localName) {
  const result = [];
  const children = node.childNodes;
  if (!children) return result;
  for (let i = 0; i < children.length; i += 1) {
    const child = children.item(i);
    if (isW(child, localName)) result.push(child);
  }
  return result;
}

function paragraphText(pNode) {
  let text = "";
  walkElements(pNode, (node) => {
    if (isW(node, "t")) text += node.textContent || "";
    else if (isW(node, "tab")) text += "\t";
    else if (isW(node, "br")) text += "\n";
  });
  return text.trim();
}

function tableRows(tblNode) {
  return directChildren(tblNode, "tr").map((tr) =>
    directChildren(tr, "tc").map((tc) => {
      const cellParagraphs = [];
      walkElements(tc, (node) => {
        if (isW(node, "p")) cellParagraphs.push(paragraphText(node));
      });
      return cellParagraphs.filter((text) => text !== "").join(" ");
    })
  );
}

function findBody(doc) {
  const bodies = doc.getElementsByTagNameNS(W_NS, "body");
  return bodies.length > 0 ? bodies.item(0) : null;
}

function readBlocks(doc) {
  const body = findBody(doc);
  if (!body) return [];

  const blocks = [];
  const children = body.childNodes;
  for (let i = 0; i < children.length; i += 1) {
    const child = children.item(i);
    if (isW(child, "p")) {
      blocks.push({ type: "paragraph", text: paragraphText(child) });
    } else if (isW(child, "tbl")) {
      blocks.push({ type: "table", rows: tableRows(child) });
    }
  }
  return blocks;
}

class DocxDocument {
  static async load(filePath) {
    const buffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(buffer);
    const entry = zip.file("word/document.xml");
    if (!entry) throw new Error(`word/document.xml not found in ${filePath} - is this a valid .docx?`);

    const xml = await entry.async("string");
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return new DocxDocument(readBlocks(doc));
  }

  constructor(blocks) {
    this.blocks = blocks;
  }

  get fullText() {
    return this.blocks
      .map((block) => (block.type === "paragraph" ? block.text : block.rows.map((row) => row.join(" | ")).join("\n")))
      .join("\n");
  }

  get paragraphs() {
    return this.blocks.filter((b) => b.type === "paragraph").map((b) => b.text);
  }

  get tables() {
    return this.blocks.filter((b) => b.type === "table").map((b) => b.rows);
  }
}

module.exports = { DocxDocument };
