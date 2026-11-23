"use strict";
const SUPPORTED_FORMATS = new Set(["pdf", "xlsx", "csv"]);
const MIME_TYPES = { pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv" };
const PDF_WIDTH = 595, PDF_HEIGHT = 842, PDF_MARGIN = 50;

function cellValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function normalizeReportData(data) {
  const source = data || {};
  const sections = (Array.isArray(source.sections) ? source.sections : []).map(section => ({
    name: String((section && section.name) || "Section"),
    columns: ((section && section.columns) || []).map(column => String(column)),
    rows: ((section && section.rows) || []).map(row => (Array.isArray(row) ? row : [row]).map(cellValue))
  }));
  return {
    title: String(source.title || "Finance Report"),
    generatedAt: source.generatedAt || new Date().toISOString(),
    summary: (Array.isArray(source.summary) ? source.summary : []).map(item => ({ label: String((item && item.label) || ""), value: cellValue(item && item.value) })),
    sections,
    warnings: (Array.isArray(source.warnings) ? source.warnings : []).map(String),
    errors: Array.isArray(source._errors) ? source._errors : []
  };
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "report";
}

function buildFilename(data, extension) {
  return `${slugify(data.title)}_${String(data.generatedAt).slice(0, 10)}.${extension}`;
}

function csvEscape(value) {
  const text = String(value);
  if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function toCsv(data) {
  const lines = [];
  lines.push(csvEscape(data.title) + "," + csvEscape("Generated: " + data.generatedAt));
  lines.push("", "Summary", "Label,Value");
  data.summary.forEach(item => lines.push(csvEscape(item.label) + "," + csvEscape(item.value)));
  if (data.warnings.length) { lines.push("", "Warnings"); data.warnings.forEach(warning => lines.push(csvEscape(warning))); }
  if (data.errors.length) { lines.push("", "Section Errors"); data.errors.forEach(error => lines.push(csvEscape(error.section + ": " + error.error))); }
  data.sections.forEach(section => {
    lines.push("", csvEscape(section.name), section.columns.map(csvEscape).join(","));
    section.rows.forEach(row => lines.push(row.map(csvEscape).join(",")));
  });
  return lines.join("\r\n") + "\r\n";
}

function sheetSafeName(name, used) {
  let base = String(name).replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
  let candidate = base, index = 2;
  while (used.has(candidate.toLowerCase())) { candidate = base.slice(0, 28) + " " + index++; }
  used.add(candidate.toLowerCase());
  return candidate;
}

function sheetObjects(columns, rows) {
  const seen = new Set();
  const headers = columns.map(column => { let name = String(column), suffix = 2; while (seen.has(name)) { name = String(column) + " " + suffix++; } seen.add(name); return name; });
  return rows.map(row => { const record = {}; headers.forEach((header, index) => { record[header] = row[index]; }); return record; });
}

function addStyledSheet(book, name, rows) {
  const sheet = book.addWorksheet(name);
  const safe = rows.length ? rows : [{ Message: "No records match the reviewed filters." }];
  sheet.columns = Object.keys(safe[0]).map(key => ({ header: key, key, width: Math.min(50, Math.max(14, key.length + 3)) }));
  sheet.addRows(safe);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount } };
  return sheet;
}

const CRC_TABLE = (() => { const table = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c; } return table; })();
function crc32(buffer) { let c = ~0; for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xFF] ^ (c >>> 8); return ~c >>> 0; }

function zipStore(files) {
  const chunks = [], central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  files.forEach(file => {
    const name = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18); local.writeUInt32LE(file.data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    chunks.push(local, file.data);
    const entry = Buffer.alloc(46 + name.length);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0, 8); entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(dosTime, 12); entry.writeUInt16LE(dosDate, 14); entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(file.data.length, 20); entry.writeUInt32LE(file.data.length, 24);
    entry.writeUInt16LE(name.length, 28); entry.writeUInt16LE(0, 30); entry.writeUInt16LE(0, 32); entry.writeUInt16LE(0, 34); entry.writeUInt16LE(0, 36); entry.writeUInt32LE(0, 38); entry.writeUInt32LE(offset, 42);
    name.copy(entry, 46);
    central.push(entry);
    offset += local.length + file.data.length;
  });
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, directory, end]);
}

function xmlEscape(text) {
  return String(text).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnLetter(index) {
  let n = index + 1, result = "";
  while (n > 0) { const remainder = (n - 1) % 26; result = String.fromCharCode(65 + remainder) + result; n = Math.floor((n - 1) / 26); }
  return result;
}

function sheetXml(columns, rows) {
  const widths = columns.map((column, index) => {
    let longest = String(column).length;
    rows.forEach(row => { const text = String(row[index] === null || row[index] === undefined ? "" : row[index]); if (text.length > longest) longest = text.length; });
    return Math.min(50, Math.max(14, longest + 3));
  });
  const colsXml = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const headerCells = columns.map((column, index) => `<c r="${columnLetter(index)}1" s="1" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(column)}</t></is></c>`).join("");
  const bodyRows = rows.map((row, rowIndex) => {
    const r = rowIndex + 2;
    const cells = columns.map((column, index) => {
      const value = row[index];
      const reference = `${columnLetter(index)}${r}`;
      if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}" t="n"><v>${value}</v></c>`;
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value === null || value === undefined ? "" : value)}</t></is></c>`;
    }).join("");
    return `<row r="${r}">${cells}</row>`;
  }).join("");
  const lastRow = Math.max(1, rows.length + 1);
  const lastCol = columnLetter(Math.max(0, columns.length - 1));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${colsXml}</cols><sheetData><row r="1">${headerCells}</row>${bodyRows}</sheetData><autoFilter ref="A1:${lastCol}${lastRow}"/></worksheet>`;
}

function buildXlsxArchive(data) {
  const used = new Set(["summary"]);
  const sheets = [{ name: "Summary", columns: ["Label", "Value"], rows: data.summary.map(item => [item.label, item.value]) }]
    .concat(data.sections.map(section => ({ name: sheetSafeName(section.name, used), columns: section.columns, rows: section.rows })));
  if (data.warnings.length) sheets.push({ name: sheetSafeName("Warnings", used), columns: ["Warning"], rows: data.warnings.map(warning => [warning]) });
  if (data.errors.length) sheets.push({ name: sheetSafeName("Section Errors", used), columns: ["Section", "Error"], rows: data.errors.map(error => [error.section, error.error]) });
  const files = [];
  const sheetOverrides = sheets.map((sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  files.push({ name: "[Content_Types].xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`, "utf8") });
  files.push({ name: "_rels/.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`, "utf8") });
  const sheetTags = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  files.push({ name: "xl/workbook.xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`, "utf8") });
  const sheetRels = sheets.map((sheet, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  files.push({ name: "xl/_rels/workbook.xml.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`, "utf8") });
  files.push({ name: "xl/styles.xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="1" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`, "utf8") });
  sheets.forEach((sheet, index) => files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: Buffer.from(sheetXml(sheet.columns, sheet.rows), "utf8") }));
  return zipStore(files);
}

async function toXlsx(data) {
  try {
    const ExcelJS = require("exceljs");
    const book = new ExcelJS.Workbook();
    book.creator = "ATD Helpdesk";
    const used = new Set(["summary"]);
    addStyledSheet(book, "Summary", data.summary.map(item => ({ Label: item.label, Value: item.value })));
    data.sections.forEach(section => addStyledSheet(book, sheetSafeName(section.name, used), sheetObjects(section.columns, section.rows)));
    if (data.warnings.length) addStyledSheet(book, sheetSafeName("Warnings", used), data.warnings.map(warning => ({ Warning: warning })));
    if (data.errors.length) addStyledSheet(book, sheetSafeName("Section Errors", used), data.errors.map(error => ({ Section: error.section, Error: error.error })));
    const output = await book.xlsx.writeBuffer();
    return Buffer.from(output);
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") return buildXlsxArchive(data);
    throw error;
  }
}

function pdfEscapeText(text) {
  return String(text).replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7E]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function computeColumnWidths(columns, rows) {
  const contentWidth = PDF_WIDTH - 2 * PDF_MARGIN;
  const natural = columns.map((column, index) => {
    let longest = String(column).length;
    rows.forEach(row => { const text = String(row[index] === null || row[index] === undefined ? "" : row[index]); if (text.length > longest) longest = text.length; });
    return Math.min(180, Math.max(30, longest * 4.2 + 8));
  });
  const total = natural.reduce((sum, width) => sum + width, 0);
  if (total <= contentWidth) return natural;
  return natural.map(width => Math.max(20, Math.round(width * contentWidth / total)));
}

function layoutPdfPages(data) {
  const pages = [];
  let current = null;
  const newPage = () => { current = { items: [] }; pages.push(current); };
  const text = (font, size, x, y, value) => current.items.push({ kind: "text", font, size, x, y, text: String(value) });
  const rule = (x1, y1, x2, y2) => current.items.push({ kind: "line", x1, y1, x2, y2 });
  newPage();
  text("F1", 10, PDF_MARGIN, PDF_HEIGHT - 60, "ATD HELPDESK");
  rule(PDF_MARGIN, PDF_HEIGHT - 70, PDF_WIDTH - PDF_MARGIN, PDF_HEIGHT - 70);
  text("F1", 20, PDF_MARGIN, PDF_HEIGHT - 120, data.title);
  text("F2", 12, PDF_MARGIN, PDF_HEIGHT - 145, "Finance Management Report");
  text("F2", 10, PDF_MARGIN, PDF_HEIGHT - 170, "Generated: " + data.generatedAt);
  let y = PDF_HEIGHT - 195;
  data.summary.forEach(item => { text("F2", 9, PDF_MARGIN, y, item.label + ": " + item.value); y -= 13; });
  if (data.warnings.length) { y -= 8; data.warnings.forEach(warning => { text("F2", 9, PDF_MARGIN, y, "Warning: " + warning); y -= 13; }); }
  if (data.errors.length) { y -= 8; data.errors.forEach(error => { text("F2", 9, PDF_MARGIN, y, "Section error: " + error.section + " - " + error.error); y -= 13; }); }
  const sectionStarts = [];
  const allSections = [{ name: "Summary", columns: ["Label", "Value"], rows: data.summary.map(item => [item.label, item.value]) }].concat(data.sections);
  allSections.forEach(section => {
    newPage();
    sectionStarts.push({ name: section.name, pageNumber: pages.length + 1 });
    text("F1", 13, PDF_MARGIN, PDF_HEIGHT - 60, section.name);
    rule(PDF_MARGIN, PDF_HEIGHT - 70, PDF_WIDTH - PDF_MARGIN, PDF_HEIGHT - 70);
    let cursor = PDF_HEIGHT - 90;
    const widths = computeColumnWidths(section.columns, section.rows);
    const drawRow = (values, font, size) => {
      let x = PDF_MARGIN;
      const charWidth = font === "F3" ? size * 0.6 : size * 0.5;
      values.forEach((value, index) => {
        const maxChars = Math.max(1, Math.floor((widths[index] - 4) / charWidth));
        const raw = String(value === null || value === undefined ? "" : value);
        text(font, size, x, cursor, raw.length > maxChars ? raw.slice(0, maxChars - 1) + "~" : raw);
        x += widths[index];
      });
    };
    const drawHeader = () => { drawRow(section.columns, "F1", 8); cursor -= 12; };
    drawHeader();
    section.rows.forEach(row => {
      if (cursor < 75) { newPage(); text("F2", 8, PDF_MARGIN, PDF_HEIGHT - 40, section.name + " (continued)"); cursor = PDF_HEIGHT - 60; drawHeader(); }
      drawRow(row, "F3", 7);
      cursor -= 11;
    });
  });
  const tocPage = { items: [] };
  const tocText = (font, size, x, yy, value) => tocPage.items.push({ kind: "text", font, size, x, y: yy, text: String(value) });
  tocText("F1", 13, PDF_MARGIN, PDF_HEIGHT - 60, "Table of Contents");
  let tocY = PDF_HEIGHT - 100;
  sectionStarts.forEach(entry => {
    tocText("F2", 10, PDF_MARGIN, tocY, entry.name);
    tocText("F2", 10, PDF_WIDTH - PDF_MARGIN - 30, tocY, String(entry.pageNumber));
    tocY -= 16;
  });
  pages.splice(1, 0, tocPage);
  return pages;
}

function buildContentStream(page, pageNumber, totalPages) {
  const ops = [];
  page.items.forEach(item => {
    if (item.kind === "text") ops.push(`BT /${item.font} ${item.size} Tf ${item.x} ${item.y} Td (${pdfEscapeText(item.text)}) Tj ET`);
    else ops.push(`0.5 w ${item.x1} ${item.y1} m ${item.x2} ${item.y2} l S`);
  });
  ops.push(`0.5 w ${PDF_MARGIN} 52 m ${PDF_WIDTH - PDF_MARGIN} 52 l S`);
  ops.push(`BT /F2 8 Tf ${PDF_MARGIN} 40 Td (${pdfEscapeText("ATD Helpdesk - Finance Management")}) Tj ET`);
  const pageLabel = `Page ${pageNumber} of ${totalPages}`;
  ops.push(`BT /F2 8 Tf ${PDF_WIDTH - PDF_MARGIN - pageLabel.length * 4} 40 Td (${pdfEscapeText(pageLabel)}) Tj ET`);
  return ops.join("\n");
}

function toPdf(data) {
  const pages = layoutPdfPages(data);
  const objects = [];
  const pageObjectIds = pages.map((_, index) => 6 + index * 2);
  const kids = pageObjectIds.map(id => `${id} 0 R`).join(" ");
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj`);
  objects.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj");
  objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj");
  pages.forEach((page, index) => {
    const content = buildContentStream(page, index + 1, pages.length);
    const contentId = pageObjectIds[index] + 1;
    objects.push(`${pageObjectIds[index]} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>\nendobj`);
    objects.push(`${contentId} 0 obj\n<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream\nendobj`);
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach(body => { offsets.push(Buffer.byteLength(pdf, "latin1")); pdf += body + "\n"; });
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(offset => { pdf += String(offset).padStart(10, "0") + " 00000 n \n"; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

async function format(data, outputFormat) {
  if (!SUPPORTED_FORMATS.has(outputFormat)) throw Object.assign(new Error("Unsupported output format."), { status: 400, code: "UNSUPPORTED_FORMAT" });
  const normalized = normalizeReportData(data);
  const filename = buildFilename(normalized, outputFormat);
  if (outputFormat === "csv") return { buffer: Buffer.from(toCsv(normalized), "utf8"), mimeType: MIME_TYPES.csv, filename };
  if (outputFormat === "xlsx") return { buffer: await toXlsx(normalized), mimeType: MIME_TYPES.xlsx, filename };
  return { buffer: toPdf(normalized), mimeType: MIME_TYPES.pdf, filename };
}

module.exports = { format, SUPPORTED_FORMATS };