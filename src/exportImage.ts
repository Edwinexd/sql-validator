import type { Result } from "./utils";
import { format as formatSql } from "sql-formatter";
import Prism from "./prism";

export interface ExportTruncation {
  rows: number;
  totalRows: number;
  columns: number;
  totalColumns: number;
}

export interface ExportImageLabels {
  questionLabel: string;
  variantLabel: string;
  codeLabel: string;
  resultLabel: string;
  viewCodeLabel: string;
  viewResultLabel: string;
  matchesLabel: string;
  doesNotMatchLabel: string;
  truncatedLabel: (truncation: ExportTruncation) => string;
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

// Every engine refuses to rasterize past some canvas size, and WebKit does it
// by handing back a blank bitmap instead of throwing. The export is laid out to
// fit inside the smallest limit we have to support so a large result set comes
// out truncated-but-readable rather than silently empty.
const MAX_CANVAS_SIDE = 8192;
const MAX_CANVAS_PIXELS = 16_777_216;

const MIN_EXPORT_WIDTH = 1200;
const MAX_EXPORT_WIDTH = 2560;
const PAGE_MARGIN = 64;
const CODE_WIDTH = 1072;
const CODE_PADDING = 12;
const CODE_FONT = 18;
const CODE_LINE_HEIGHT = 29;
const MAX_CODE_LINES = 200;
const ROW_HEIGHT = 38;
const CELL_FONT = 16;
const CELL_PADDING = 24;
const MIN_CELL_WIDTH = 72;
const MAX_CELL_CHARS = 44;

const EXPORT_BACKGROUND = "#efefef";
const SANS_FAMILY = "ui-sans-serif, system-ui, sans-serif";
const MONO_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Engines resolve the generic font families above to different faces, so text
// is laid out against an upper bound on the per-character advance rather than
// measured: a line can come out narrower than its box, never wider.
const CHAR_ADVANCE = 0.62;
const CELL_CHAR_WIDTH = Math.ceil(CELL_FONT * CHAR_ADVANCE);

const escapeXml = (value: unknown): string => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

function wrap(value: string, max: number): string[] {
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

/**
 * Word-aware wrapping for prose. `wrap` splits on an exact column, which is
 * what code needs and what a heading must not do.
 */
function wrapWords(value: string, max: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= max) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      // A single run longer than the line still has to break somewhere.
      const parts = wrap(word, max);
      lines.push(...parts.slice(0, -1));
      current = parts[parts.length - 1];
    }
    lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

/** Longest line that fits `available` pixels at `size`, given the advance bound. */
const charsPerLine = (size: number, available: number): number => Math.max(8, Math.floor(available / (size * CHAR_ADVANCE)));

function displayCell(value: unknown): string {
  if (value === null) return "NULL";
  if (value instanceof Uint8Array) return Array.from(value).map(n => n.toString(16).padStart(2, "0")).join(" ");
  return String(value);
}

/** Keep one outlying value from widening a column past what the canvas can hold. */
const clampCell = (value: string): string => value.length > MAX_CELL_CHARS ? `${value.slice(0, MAX_CELL_CHARS - 1)}…` : value;

function textElement(text: string, x: number, y: number, size: number, weight = "normal", fill = "#313131", family = MONO_FAMILY, anchor?: string, italic = false): string {
  const anchorAttribute = anchor ? ` text-anchor="${anchor}"` : "";
  return `<text xml:space="preserve" x="${x}" y="${y}"${anchorAttribute} font-family="${family}" font-size="${size}px" font-weight="${weight}"${italic ? " font-style=\"italic\"" : ""} fill="${fill}">${escapeXml(text)}</text>`;
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

function codeElements(code: string, x: number, y: number, highlight: boolean): { svg: string; height: number } {
  let formatted = code;
  if (highlight) {
    try { formatted = formatSql(code, { language: "sql", tabWidth: 2, useTabs: false, keywordCase: "upper", dataTypeCase: "upper", functionCase: "upper" }); } catch { /* preserve input */ }
  }
  let lines = formatted.split("\n").flatMap(line => wrap(line, charsPerLine(CODE_FONT, CODE_WIDTH - CODE_PADDING * 2)));
  if (lines.length > MAX_CODE_LINES) lines = [...lines.slice(0, MAX_CODE_LINES - 1), "…"];
  const boxHeight = Math.max(92, lines.length * CODE_LINE_HEIGHT + 28);
  let svg = `<rect x="${x}" y="${y}" width="${CODE_WIDTH}" height="${boxHeight}" rx="2" fill="#e2e8f0"/>`;
  lines.forEach((line, index) => {
    const parts = highlight ? tokenizeSqlLine(line) : [{ value: line, type: "plain" }];
    const tspans = parts.map(part => `<tspan fill="${tokenColor(part.type)}">${escapeXml(part.value)}</tspan>`).join("");
    svg += `<text xml:space="preserve" x="${x + CODE_PADDING}" y="${y + 31 + index * CODE_LINE_HEIGHT}" font-family="${MONO_FAMILY}" font-size="${CODE_FONT}px">${tspans}</text>`;
  });
  return { svg, height: boxHeight };
}

interface TablePlan {
  columns: string[];
  rows: string[][];
  widths: number[];
  width: number;
  truncation: ExportTruncation;
}

/** Choose the columns that fit the widest canvas we are allowed to produce. */
function planTable(result: Result, rowLimit: number): TablePlan {
  const allRows = result.data.map(row => row.map(value => clampCell(displayCell(value))));
  const widths = result.columns.map((column, index) => {
    const longest = allRows.reduce((max, row) => Math.max(max, (row[index] ?? "").length), column.length);
    return Math.max(MIN_CELL_WIDTH, longest * CELL_CHAR_WIDTH + CELL_PADDING);
  });
  const budget = MAX_EXPORT_WIDTH - PAGE_MARGIN * 2;
  let columnCount = widths.length;
  let width = widths.reduce((sum, value) => sum + value, 0);
  while (columnCount > 1 && width > budget) width -= widths[--columnCount];
  const rowCount = Math.max(0, Math.min(allRows.length, rowLimit));
  return {
    columns: result.columns.slice(0, columnCount),
    rows: allRows.slice(0, rowCount).map(row => row.slice(0, columnCount)),
    widths: widths.slice(0, columnCount),
    width,
    truncation: { rows: rowCount, totalRows: allRows.length, columns: columnCount, totalColumns: result.columns.length },
  };
}

function tableElements(plan: TablePlan, x: number, y: number): { svg: string; height: number } {
  const offsets = plan.widths.map((_, index) => plan.widths.slice(0, index).reduce((sum, value) => sum + value, 0));
  const line = (values: string[], rowIndex: number, header = false) => values.map((value, index) => {
    const fill = header ? "#dbeafe" : rowIndex % 2 ? "#f8fafc" : "#ffffff";
    return `<rect x="${x + offsets[index]}" y="${y + rowIndex * ROW_HEIGHT}" width="${plan.widths[index]}" height="${ROW_HEIGHT}" fill="${fill}" stroke="#cbd5e1"/><text xml:space="preserve" x="${x + offsets[index] + 12}" y="${y + rowIndex * ROW_HEIGHT + 25}" font-weight="${header ? "700" : "400"}" fill="#1f2937">${escapeXml(value)}</text>`;
  }).join("");
  let svg = `<g font-family="${MONO_FAMILY}" font-size="${CELL_FONT}">${line(plan.columns, 0, true)}`;
  plan.rows.forEach((values, index) => { svg += line(values, index + 1); });
  return { svg: `${svg}</g>`, height: (plan.rows.length + 1) * ROW_HEIGHT };
}

interface Layout extends RenderedExportSvg {
  maxHeight: number;
  rowsShown: number;
}

function layout(input: ExportImageInput, rowLimit: number): Layout {
  const { labels, query, view } = input;
  const plan = planTable(query ? query.result : view!.result, rowLimit);
  const width = Math.min(MAX_EXPORT_WIDTH, Math.max(MIN_EXPORT_WIDTH, plan.width + PAGE_MARGIN * 2));
  const center = width / 2;
  const textWidth = width - PAGE_MARGIN * 2;
  const codeX = Math.round((width - CODE_WIDTH) / 2);

  const sections: string[] = [];
  let y = PAGE_MARGIN;
  const addText = (text: string, size: number, weight = "normal", fill = "#313131", gap = 0, centered = false, italic = false) => {
    y += gap;
    const lines = centered ? wrapWords(text, charsPerLine(size, textWidth)) : [text];
    // `y` is the top of the block; a baseline one em below it keeps ascenders
    // inside the margin whichever face the engine picks for the generic family.
    lines.forEach((line, index) => sections.push(textElement(line, centered ? center : PAGE_MARGIN, y + size + index * (size + 8), size, weight, fill, SANS_FAMILY, centered ? "middle" : undefined, italic)));
    y += lines.length * (size + 8) + 14;
  };
  const addCode = (code: string, highlight: boolean) => { const rendered = codeElements(code, codeX, y, highlight); sections.push(rendered.svg); y += rendered.height + 22; };
  const addTable = (title: string) => {
    sections.push(textElement(title, center, y + 30, 22, "700", "#374151", SANS_FAMILY, "middle"));
    y += 52;
    const rendered = tableElements(plan, Math.round((width - plan.width) / 2), y);
    sections.push(rendered.svg);
    y += rendered.height + 22;
    const { rows, totalRows, columns, totalColumns } = plan.truncation;
    if (rows < totalRows || columns < totalColumns) addText(labels.truncatedLabel(plan.truncation), 18, "700", "#b45309", 0, true, true);
  };
  const addStatus = (isCorrect: boolean) => {
    const word = escapeXml(isCorrect ? labels.matchesLabel : labels.doesNotMatchLabel);
    sections.push(`<text xml:space="preserve" x="${center}" y="${y + 22}" text-anchor="middle" font-family="${SANS_FAMILY}" font-size="22px" font-weight="700" font-style="italic" fill="#313131">... which <tspan fill="${isCorrect ? "#16a34a" : "#dc2626"}">${word}</tspan> the expected result!</text>`);
    y += 95;
  };

  if (query) {
    sections.push(`<g font-family="${SANS_FAMILY}" font-size="22px" font-weight="700"><text x="${center - 54}" y="${y + 26}" text-anchor="end" fill="#374151">${escapeXml(labels.questionLabel)}</text><rect x="${center - 39}" y="${y + 3}" width="42" height="34" rx="5" fill="#dbeafe"/><text x="${center - 18}" y="${y + 27}" text-anchor="middle" fill="#1d4ed8">${escapeXml(query.question.category.display_number)}</text><text x="${center + 26}" y="${y + 26}" fill="#374151">${escapeXml(labels.variantLabel)}</text><rect x="${center + 118}" y="${y + 3}" width="42" height="34" rx="5" fill="#dbeafe"/><text x="${center + 139}" y="${y + 27}" text-anchor="middle" fill="#1d4ed8">${escapeXml(query.question.display_sequence)}</text></g>`);
    y += 65;
    addText(query.question.description, 32, "700", "#313131", 4, true);
    addText(labels.codeLabel, 22, "700", "#313131", 4, true, true);
    addCode(query.code, query.mode !== "ra");
    addTable(labels.resultLabel);
    addStatus(query.isCorrect);
  } else {
    addText(`${labels.viewCodeLabel}   ${view!.view.name}`, 32, "700", "#313131", 0, true);
    addText(labels.viewCodeLabel, 22, "700", "#313131", 4, true, true);
    addCode(view!.view.query, true);
    addTable(labels.viewResultLabel);
  }
  addText(labels.generatedByLabel, 22, "700", "#313131", 0, true);

  const height = Math.max(320, y + 48);
  return {
    width,
    height,
    maxHeight: Math.min(MAX_CANVAS_SIDE, Math.floor(MAX_CANVAS_PIXELS / width)),
    rowsShown: plan.rows.length,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${EXPORT_BACKGROUND}"/>${sections.join("")}</svg>`,
  };
}

/** Render export data as SVG primitives; no DOM cloning or SVG foreignObject is used. */
export function renderExportSvg(input: ExportImageInput): RenderedExportSvg {
  if ((input.query && input.view) || (!input.query && !input.view)) throw new Error("Exactly one export payload is required");
  let plan = layout(input, Number.POSITIVE_INFINITY);
  // Drop the rows that do not fit the engine-safe canvas. Each pass overshoots
  // slightly to pay for the truncation note the next one adds, so this settles
  // in one or two rounds; the guard is only there to bound a pathological input.
  for (let attempt = 0; attempt < 6 && plan.height > plan.maxHeight; attempt++) {
    const excess = Math.ceil((plan.height - plan.maxHeight) / ROW_HEIGHT) + 2;
    plan = layout(input, Math.max(0, Math.min(plan.rowsShown - 1, plan.rowsShown - excess)));
  }
  return { svg: plan.svg, width: plan.width, height: plan.height };
}

/**
 * Supersampling factor for rasterization. Two device pixels per CSS pixel keeps
 * text crisp, but a large export has to settle for less to stay inside the
 * canvas bounds every engine enforces.
 */
export function rasterScale(width: number, height: number): number {
  const bySide = Math.min(MAX_CANVAS_SIDE / width, MAX_CANVAS_SIDE / height);
  const byArea = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
  return Math.max(1, Math.min(2, bySide, byArea));
}

/** Rasterize our primitive-only SVG. The rasterization step has no foreignObject dependency. */
export async function rasterizeExportPng(rendered: RenderedExportSvg): Promise<Blob> {
  const svgUrl = URL.createObjectURL(new Blob([rendered.svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to rasterize export image"));
      image.src = svgUrl;
    });
    const scale = rasterScale(rendered.width, rendered.height);
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = Math.round(rendered.width * scale);
    sourceCanvas.height = Math.round(rendered.height * scale);
    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) throw new Error("Canvas rendering is unavailable");
    // Firefox antialiases the edges of a scaled SVG image against transparency,
    // so paint the page colour first instead of shipping a translucent seam.
    sourceContext.fillStyle = EXPORT_BACKGROUND;
    sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
    const canvas = document.createElement("canvas");
    canvas.width = rendered.width;
    canvas.height = rendered.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable");
    context.fillStyle = EXPORT_BACKGROUND;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error("Unable to encode PNG")), "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export async function downloadExportPng(rendered: RenderedExportSvg, filename: string): Promise<void> {
  downloadBlob(await rasterizeExportPng(rendered), filename);
}
