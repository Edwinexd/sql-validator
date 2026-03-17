/**
 * ERD generator: produces light/dark SVG ERD diagrams from a .sqlite3 file.
 * Uses the Edwinexd/sqlite-erd package for schema extraction, DOT generation,
 * and themed SVG coloring, with jsdom providing browser APIs in Node.js.
 *
 * Usage: npx tsx scripts/generate-erd.ts --db <path/to/data.sqlite3> --out <output-dir>
 *   or:  npx tsx scripts/generate-erd.ts --all
 *         (auto-discovers all languages in public/languages/)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { JSDOM } from "jsdom";
import type { SqlJsStatic } from "sql.js";

// ── CLI args ───────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const dbPath = getArg("db");
const outDir = getArg("out");
const generateAll = args.includes("--all");

if ((!dbPath || !outDir) && !generateAll) {
  console.error("Usage: npx tsx scripts/generate-erd.ts --db <path> --out <dir>");
  console.error("       npx tsx scripts/generate-erd.ts --all");
  process.exit(1);
}

/** Discover all language directories that contain data.sqlite3 */
function discoverLanguageDirs(): { db: string; out: string }[] {
  const langRoot = join(__dirname, "..", "public", "languages");
  if (!existsSync(langRoot)) return [];
  return readdirSync(langRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => ({
      db: join(langRoot, d.name, "data.sqlite3"),
      out: join(langRoot, d.name),
    }))
    .filter(({ db }) => existsSync(db));
}

// ── Generate ERD for a single database ────────────────────────
async function generateErd(
  dbFilePath: string,
  outputDir: string,
  deps: { SQL: SqlJsStatic; executorToLayout: typeof import("sqlite-erd/src/utils").executorToLayout; dotToSvg: typeof import("sqlite-erd/src/utils").dotToSvg; colorErdSVG: typeof import("sqlite-erd/src/utils").colorErdSVG },
) {
  const { SQL, executorToLayout, dotToSvg, colorErdSVG } = deps;
  const dbData = readFileSync(dbFilePath);
  const db = new SQL.Database(new Uint8Array(dbData));

  const executor = (query: string) => {
    const res = db.exec(query);
    if (!res[0]) return { columns: [] as string[], values: [] as unknown[][] };
    return res[0];
  };

  console.log(`Building layout from ${dbFilePath}...`);
  const layout = executorToLayout(executor);
  const dot = layout.getDot();

  const rawSvg = await dotToSvg(dot);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const lightSvg = colorErdSVG(rawSvg, false);
  writeFileSync(join(outputDir, "db_layout_light.svg"), lightSvg);
  console.log("Wrote db_layout_light.svg");

  const darkSvg = colorErdSVG(rawSvg, true);
  writeFileSync(join(outputDir, "db_layout_dark.svg"), darkSvg);
  console.log("Wrote db_layout_dark.svg");

  db.close();
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

  const { executorToLayout, dotToSvg, colorErdSVG } = await import("sqlite-erd/src/utils");
  const initSqlJs = (await import("sql.js")).default;
  const SQL = await initSqlJs();
  const deps = { SQL, executorToLayout, dotToSvg, colorErdSVG };

  const targets = generateAll
    ? discoverLanguageDirs()
    : [{ db: dbPath!, out: outDir! }];

  for (const { db, out } of targets) {
    await generateErd(db, out, deps);
  }

  console.log("Done!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
