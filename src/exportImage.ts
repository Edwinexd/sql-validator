import type { Result } from "./utils";
import { format as formatSql } from "sql-formatter";
import Prism from "prismjs";
import "prismjs/components/prism-sql";

export interface ExportImageLabels {
  questionLabel: string;
  variantLabel: string;
  codeLabel: string;
  resultLabel: string;
  viewCodeLabel: string;
  viewResultLabel: string;
  matchesLabel: string;
  doesNotMatchLabel: string;
  generatedByLabel: string;
}

export interface ExportImageQuery {
  question: { category: { display_number: string }; display_sequence: string; description: string };
  code: string;
  result: Result;
  isCorrect: boolean;
  mode?: "sql" | "ra";
}

export interface ExportImageView {
  view: { name: string; query: string };
  result: Result;
}

export interface ExportImageInput {
  labels: ExportImageLabels;
  query?: ExportImageQuery;
  view?: ExportImageView;
}

export interface RenderedExportSvg {
  svg: string;
  width: number;
  height: number;
}

const escapeXml = (value: unknown): string => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

function wrap(value: string, max = 92): string[] {
  const lines: string[] = [];
  for (const line of value.split("\n")) {
    if (line.length === 0) {
      lines.push("");
      continue;
    }
    for (let offset = 0; offset < line.length; offset += max) {
      lines.push(line.slice(offset, offset + max));
    }
  }
  return lines.length > 0 ? lines : [""];
}

function displayCell(value: unknown): string {
  if (value === null) return "NULL";
  if (value instanceof Uint8Array) return Array.from(value).map(n => n.toString(16).padStart(2, "0")).join(" ");
  return String(value);
}

function textElement(text: string, x: number, y: number, size: number, weight = "normal", fill = "#313131", family = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", italic = false): string {
  return `<text xml:space="preserve" x="${x}" y="${y}" font-family="${family}" font-size="${size}px" font-weight="${weight}"${italic ? " font-style=\"italic\"" : ""} fill="${fill}">${escapeXml(text)}</text>`;
}

const tokenColor = (token: string): string => {
  if (/^(keyword|boolean)$/.test(token)) return "#0086b3";
  if (token === "string" || token === "number") return "#5f9800";
  if (token === "comment") return "#8a8a8a";
  if (token === "operator") return "#a66a00";
  return "#313131";
};

function tokenizeSqlLine(line: string): Array<{ value: string; type: string }> {
  const grammar = Prism.languages.sql;
  if (!grammar) throw new Error("Prism SQL grammar was not bundled");
  const flatten = (value: unknown, type = "plain"): Array<{ value: string; type: string }> => {
    if (typeof value === "string") return [{ value, type }];
    if (Array.isArray(value)) return value.flatMap(part => flatten(part, type));
    if (value && typeof value === "object" && "content" in value) {
      const token = value as { type?: string; content: unknown };
      return flatten(token.content, token.type ?? type);
    }
    return [{ value: String(value ?? ""), type }];
  };
  return flatten(Prism.tokenize(line, grammar));
}

function codeElements(code: string, x: number, y: number, width: number): { svg: string; height: number } {
  let formatted = code;
  try { formatted = formatSql(code, { language: "sql", tabWidth: 2, useTabs: false, keywordCase: "upper", dataTypeCase: "upper", functionCase: "upper" }); } catch { /* preserve input */ }
  const lines = formatted.split("\n").flatMap(line => wrap(line, 92));
  const lineHeight = 29;
  const boxHeight = Math.max(92, lines.length * lineHeight + 28);
  let svg = `<rect x="${x}" y="${y}" width="${width}" height="${boxHeight}" rx="2" fill="#e2e8f0"/>`;
  lines.forEach((line, index) => {
    const tspans = tokenizeSqlLine(line).map(part => {
      return `<tspan fill="${tokenColor(part.type)}">${escapeXml(part.value)}</tspan>`;
    }).join("");
    svg += `<text xml:space="preserve" x="${x + 12}" y="${y + 31 + index * lineHeight}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="18px">${tspans}</text>`;
  });
  return { svg, height: boxHeight };
}

function tableElements(result: Result, x: number, y: number, maxWidth = 1080): { svg: string; height: number; width: number } {
  const rows = result.data.map(row => row.map(displayCell));
  const widths = result.columns.map((column, index) => Math.max(column.length, ...rows.map(row => (row[index] ?? "").length)));
  const scale = Math.min(1, maxWidth / Math.max(1, widths.reduce((sum, width) => sum + width * 10 + 24, 0)));
  const cellWidths = widths.map(width => Math.max(72, width * 10 * scale + 24));
  const rowHeight = 38;
  let svg = "<g font-family=\"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace\" font-size=\"16\">";
  const row = (values: string[], rowIndex: number, header = false) => values.map((value, index) => {
    const offset = cellWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
    const fill = header ? "#dbeafe" : rowIndex % 2 ? "#f8fafc" : "#ffffff";
    return `<rect x="${x + offset}" y="${y + rowIndex * rowHeight}" width="${cellWidths[index]}" height="${rowHeight}" fill="${fill}" stroke="#cbd5e1"/><text x="${x + offset + 12}" y="${y + rowIndex * rowHeight + 25}" font-weight="${header ? "700" : "400"}" fill="#1f2937">${escapeXml(value)}</text>`;
  }).join("");
  svg += row(result.columns, 0, true);
  rows.forEach((values, index) => { svg += row(values, index + 1); });
  svg += "</g>";
  return { svg, height: (rows.length + 1) * rowHeight, width: cellWidths.reduce((sum, width) => sum + width, 0) };
}

/** Render export data as SVG primitives; no DOM cloning or SVG foreignObject is used. */
export function renderExportSvg(input: ExportImageInput): RenderedExportSvg {
  const { labels, query, view } = input;
  if ((query && view) || (!query && !view)) throw new Error("Exactly one export payload is required");

  const sections: string[] = [];
  let y = 64;
  const addText = (text: string, size: number, weight = "normal", fill = "#313131", gap = 0, centered = false, italic = false) => { y += gap; const lines = centered ? wrap(text, 62) : [text]; lines.forEach((line, index) => { sections.push(textElement(line, centered ? 600 : 64, y + index * (size + 8), size, weight, fill, "ui-sans-serif, system-ui, sans-serif", italic).replace("<text ", centered ? "<text text-anchor=\"middle\" " : "<text ")); }); y += lines.length * (size + 8) + 14; };
  const addCode = (code: string) => { const rendered = codeElements(code, 64, y, 1072); sections.push(rendered.svg); y += rendered.height + 22; };
  const addTable = (title: string, table: Result, accent: string) => { sections.push(textElement(title, 600, y + 30, 22, "700", accent, "ui-sans-serif, system-ui, sans-serif", true).replace("<text ", "<text text-anchor=\"middle\" ")); y += 52; const rendered = tableElements(table, (1200 - renderedWidth(table, 720)) / 2, y, 720); sections.push(rendered.svg); y += rendered.height + 22; };
  const addCodeAndResult = (codeLabel: string, code: string, resultLabel: string, result: Result) => {
    addText(codeLabel, 22, "700", "#313131", 4, true, true);
    addCode(code);
    addTable(resultLabel, result, "#374151");
  };
  const addStatus = (isCorrect: boolean) => {
    const status = isCorrect
      ? `<text x="600" y="${y + 22}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="22px" font-weight="700" font-style="italic" fill="#313131">... which <tspan fill="#16a34a">matches</tspan> the expected result!</text>`
      : textElement(`... which ${labels.doesNotMatchLabel}`, 600, y + 22, 22, "700", "#dc2626", "ui-sans-serif, system-ui, sans-serif", true).replace("<text ", "<text text-anchor=\"middle\" ");
    sections.push(status); y += 95;
  };
  const renderedWidth = (table: Result, maxWidth: number) => table.columns.reduce((sum, column, index) => sum + Math.max(72, Math.max(column.length, ...table.data.map(row => displayCell(row[index]).length)) * 10 + 24), 0) > maxWidth ? maxWidth : table.columns.reduce((sum, column, index) => sum + Math.max(72, Math.max(column.length, ...table.data.map(row => displayCell(row[index]).length)) * 10 + 24), 0);
  if (query) {
    sections.push(`<g font-family="ui-sans-serif, system-ui, sans-serif" font-size="22px" font-weight="700"><text x="546" y="${y + 26}" text-anchor="end" fill="#374151">${escapeXml(labels.questionLabel)}</text><rect x="561" y="${y + 3}" width="42" height="34" rx="5" fill="#dbeafe"/><text x="582" y="${y + 27}" text-anchor="middle" fill="#1d4ed8">${escapeXml(query.question.category.display_number)}</text><text x="626" y="${y + 26}" fill="#374151">${escapeXml(labels.variantLabel)}</text><rect x="718" y="${y + 3}" width="42" height="34" rx="5" fill="#dbeafe"/><text x="739" y="${y + 27}" text-anchor="middle" fill="#1d4ed8">${escapeXml(query.question.display_sequence)}</text></g>`); y += 65;
    addText(query.question.description, 32, "700", "#313131", 4, true);
    addCodeAndResult(labels.codeLabel, query.code, labels.resultLabel, query.result);
    addStatus(query.isCorrect);
  } else if (view) {
    addText(`${labels.viewCodeLabel}   ${view.view.name}`, 32, "700", "#313131", 0, true);
    addCodeAndResult(labels.viewCodeLabel, view.view.query, labels.viewResultLabel, view.result);
  }
  addText(labels.generatedByLabel, 22, "700", "#313131", 0, true);

  const width = 1200;
  const height = Math.max(320, y + 48);
  const content = sections.join("");
  return {
    width,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#efefef"/>${content}</svg>`,
  };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/** Rasterize our primitive-only SVG. The rasterization step has no foreignObject dependency. */
export async function downloadExportPng(rendered: RenderedExportSvg, filename: string): Promise<void> {
  const svgUrl = URL.createObjectURL(new Blob([rendered.svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to rasterize export image"));
      image.src = svgUrl;
    });
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = rendered.width * 2;
    sourceCanvas.height = rendered.height * 2;
    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) throw new Error("Canvas rendering is unavailable");
    sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
    const canvas = document.createElement("canvas");
    canvas.width = rendered.width;
    canvas.height = rendered.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error("Unable to encode PNG")), "image/png");
    });
    downloadBlob(blob, filename);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
