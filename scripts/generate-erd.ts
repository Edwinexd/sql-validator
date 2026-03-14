/**
 * ERD generator: produces light/dark SVG ERD diagrams from a .sqlite3 file.
 * Uses the Edwinexd/sqlite-erd package for schema extraction, DOT generation,
 * and themed SVG coloring, with jsdom providing browser APIs in Node.js.
 *
 * Usage: npx tsx scripts/generate-erd.ts --db <path/to/data.sqlite3> --out <output-dir>
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { JSDOM } from "jsdom";

// ── CLI args ───────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const dbPath = getArg("db");
const outDir = getArg("out");

if (!dbPath || !outDir) {
  console.error("Usage: npx tsx scripts/generate-erd.ts --db <path> --out <dir>");
  process.exit(1);
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  // Polyfill browser globals via jsdom (needed by sqlite-erd's colorErdSVG)
  const dom = new JSDOM("<!DOCTYPE html><html></html>");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  g.DOMParser = dom.window.DOMParser;
  g.XMLSerializer = dom.window.XMLSerializer;

  // sqlite-erd's colorErdSVG uses `instanceof SVGPolygonElement` etc.
  // jsdom doesn't define these classes, but all SVG elements are instances of SVGElement.
  // We create tag-checking classes so `instanceof` works via Symbol.hasInstance.
  function makeSvgCheck(...tags: string[]) {
    return class {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      static [Symbol.hasInstance](el: any) {
        return el?.tagName && tags.includes(el.tagName.toLowerCase());
      }
    };
  }
  g.SVGPolygonElement = makeSvgCheck("polygon");
  g.SVGTextElement = makeSvgCheck("text");
  g.SVGPathElement = makeSvgCheck("path");
  g.SVGSVGElement = makeSvgCheck("svg");

  // Import sqlite-erd utilities
  const { executorToLayout, dotToSvg, colorErdSVG } = await import("sqlite-erd/src/utils");

  // Import sql.js
  const initSqlJs = (await import("sql.js")).default;
  const SQL = await initSqlJs();
  const dbData = readFileSync(dbPath!);
  const db = new SQL.Database(new Uint8Array(dbData));

  const executor = (query: string) => {
    const res = db.exec(query);
    // Return empty result set if no rows (sqlite-erd expects a valid object)
    if (!res[0]) return { columns: [] as string[], values: [] as unknown[][] };
    return res[0];
  };

  console.log("Building layout from database...");
  const layout = executorToLayout(executor);
  const dot = layout.getDot();

  console.log("Rendering SVG with Graphviz...");
  const rawSvg = await dotToSvg(dot);

  if (!existsSync(outDir!)) {
    mkdirSync(outDir!, { recursive: true });
  }

  // Light theme SVG
  const lightSvg = colorErdSVG(rawSvg, false);
  writeFileSync(join(outDir!, "db_layout_light.svg"), lightSvg);
  console.log("Wrote db_layout_light.svg");

  // Dark theme SVG
  const darkSvg = colorErdSVG(rawSvg, true);
  writeFileSync(join(outDir!, "db_layout_dark.svg"), darkSvg);
  console.log("Wrote db_layout_dark.svg");

  db.close();
  console.log("Done!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
