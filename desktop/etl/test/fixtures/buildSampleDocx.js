"use strict";

const JSZip = require("jszip");

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Complete Wellbeing Health Assessment</w:t></w:r></w:p>
    <w:p><w:r><w:t>Name: John Doe</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>Gender: Male</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>Age: (46)</w:t></w:r></w:p>
    <w:p><w:r><w:t>Personal Report</w:t></w:r></w:p>
    <w:p><w:r><w:t>The client reports feeling stressed at work and struggling with sleep most nights.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Summary of Key Results</w:t></w:r></w:p>
    <w:tbl>
      <w:tr><w:tc><w:p><w:r><w:t>Measurement</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>Height (cm)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>x</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>Blood Pressure (mmHg)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>120/80</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>HDL Cholesterol (mmol/l)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1.5</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
    <w:p><w:r><w:t>Nutrition section of the questionnaire indicates a Mediterranean Style of Diet with some skipping meals during busy weeks.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

async function buildSampleDocxBuffer() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
  zip.file("_rels/.rels", RELS_XML);
  zip.file("word/document.xml", DOCUMENT_XML);
  return zip.generateAsync({ type: "nodebuffer" });
}

module.exports = { buildSampleDocxBuffer };
