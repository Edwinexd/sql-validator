/**
 * ERD generator: produces light/dark SVG ERD diagrams from database files.
 * Supports both SQLite (.sqlite3 binary) and PostgreSQL (.sql text via PGLite).
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
import type { PGlite } from "@electric-sql/pglite";
import type { EngineType } from "../src/i18n/languages";

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

interface Target {
  db: string;
  out: string;
  engine: EngineType;
}

/** Discover all language directories that contain data.sqlite3 or data.sql */
function discoverLanguageDirs(): Target[] {
  const langRoot = join(__dirname, "..", "public", "languages");
  if (!existsSync(langRoot)) return [];
  return readdirSync(langRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .flatMap((d): Target[] => {
      const sqlitePath = join(langRoot, d.name, "data.sqlite3");
      const sqlPath = join(langRoot, d.name, "data.sql");
      if (existsSync(sqlitePath)) {
        return [{ db: sqlitePath, out: join(langRoot, d.name), engine: "sqlite" }];
      }
      if (existsSync(sqlPath)) {
        return [{ db: sqlPath, out: join(langRoot, d.name), engine: "postgresql" }];
      }
      return [];
    });
}

type ErdDeps = {
  executorToLayout: typeof import("sqlite-erd/src/utils").executorToLayout;
  dotToSvg: typeof import("sqlite-erd/src/utils").dotToSvg;
  colorErdSVG: typeof import("sqlite-erd/src/utils").colorErdSVG;
};

// ── Generate ERD for a SQLite database ─────────────────────────
async function generateErdSqlite(
  dbFilePath: string,
  outputDir: string,
  deps: ErdDeps & { SQL: SqlJsStatic },
) {
  const { SQL, executorToLayout, dotToSvg, colorErdSVG } = deps;
  const dbData = readFileSync(dbFilePath);
  const db = new SQL.Database(new Uint8Array(dbData));

  const executor = (query: string) => {
    const res = db.exec(query);
    if (!res[0]) return { columns: [] as string[], values: [] as unknown[][] };
    return res[0];
  };

  console.log(`Building layout from ${dbFilePath} (sqlite)...`);
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

// ── PostgreSQL PRAGMA translation layer ────────────────────────
/**
 * Pre-populates the PG executor cache with all data needed by executorToLayout.
 * This is necessary because executorToLayout expects a synchronous executor,
 * but PGlite is async.
 */
async function buildPgExecutorCache(pgDb: PGlite): Promise<(query: string) => { columns: string[]; values: unknown[][] }> {
  const cache: Record<string, { columns: string[]; values: unknown[][] }> = {};

  function cacheResult(key: string, columns: string[], values: unknown[][]) {
    cache[key] = { columns, values };
  }

  // 1. Get all table names (equivalent to sqlite_master query)
  const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
  const tablesRes = await pgDb.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
  );
  const tableNames = tablesRes.rows.map(r => r.table_name);
  cacheResult(tablesQuery, ["name"], tableNames.map(n => [n]));

  for (const tableName of tableNames) {
    const escapedName = `"${tableName.replace(/"/g, '""')}"`;

    // 2. PRAGMA table_info equivalent
    const tableInfoKey = `PRAGMA table_info(${escapedName})`;
    const colsRes = await pgDb.query<{
      column_name: string;
      ordinal_position: number;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, ordinal_position, UPPER(data_type) as data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName]
    );

    // Get primary key columns for this table
    const pkRes = await pgDb.query<{ column_name: string; ordinal_position: number }>(
      `SELECT kcu.column_name, kcu.ordinal_position
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY kcu.ordinal_position`,
      [tableName]
    );
    const pkColumns = new Set(pkRes.rows.map(r => r.column_name));

    // table_info columns: cid, name, type, notnull, dflt_value, pk
    cacheResult(tableInfoKey,
      ["cid", "name", "type", "notnull", "dflt_value", "pk"],
      colsRes.rows.map((r, i) => [
        i,                                   // cid
        r.column_name,                       // name
        r.data_type,                         // type
        r.is_nullable === "NO" ? 1 : 0,     // notnull
        r.column_default,                    // dflt_value
        pkColumns.has(r.column_name) ? 1 : 0 // pk
      ])
    );

    // 3. PRAGMA foreign_key_list equivalent
    const fkListKey = `PRAGMA foreign_key_list(${escapedName})`;
    const fkRes = await pgDb.query<{
      constraint_name: string;
      ref_table: string;
      column_name: string;
      ref_column: string;
      update_rule: string;
      delete_rule: string;
    }>(
      `SELECT
         tc.constraint_name,
         ccu.table_name AS ref_table,
         kcu.column_name,
         ccu.column_name AS ref_column,
         rc.update_rule,
         rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
       JOIN information_schema.referential_constraints rc
         ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
       WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
       ORDER BY tc.constraint_name, kcu.ordinal_position`,
      [tableName]
    );

    // Group by constraint name to assign sequential IDs
    const fkGroups: Record<string, typeof fkRes.rows> = {};
    for (const row of fkRes.rows) {
      if (!fkGroups[row.constraint_name]) fkGroups[row.constraint_name] = [];
      fkGroups[row.constraint_name].push(row);
    }

    const fkValues: unknown[][] = [];
    let fkId = 0;
    for (const [, rows] of Object.entries(fkGroups)) {
      for (let seq = 0; seq < rows.length; seq++) {
        const r = rows[seq];
        fkValues.push([
          fkId,                              // id
          seq,                               // seq
          r.ref_table,                       // table
          r.column_name,                     // from
          r.ref_column,                      // to
          mapPgAction(r.update_rule),        // on_update
          mapPgAction(r.delete_rule),        // on_delete
          "NONE",                            // match
        ]);
      }
      fkId++;
    }
    cacheResult(fkListKey,
      ["id", "seq", "table", "from", "to", "on_update", "on_delete", "match"],
      fkValues
    );

    // 4. PRAGMA index_list equivalent
    const indexListKey = `PRAGMA index_list(${escapedName})`;
    const idxRes = await pgDb.query<{
      indexname: string;
      indexdef: string;
    }>(
      "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1",
      [tableName]
    );

    // Also check which indexes are unique and which are pk
    const idxDetailRes = await pgDb.query<{
      index_name: string;
      is_unique: boolean;
      is_primary: boolean;
    }>(
      `SELECT
         i.relname AS index_name,
         ix.indisunique AS is_unique,
         ix.indisprimary AS is_primary
       FROM pg_index ix
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public' AND t.relname = $1`,
      [tableName]
    );

    const idxDetails: Record<string, { isUnique: boolean; isPrimary: boolean }> = {};
    for (const r of idxDetailRes.rows) {
      idxDetails[r.index_name] = { isUnique: r.is_unique, isPrimary: r.is_primary };
    }

    const indexListValues: unknown[][] = [];
    for (let seq = 0; seq < idxRes.rows.length; seq++) {
      const r = idxRes.rows[seq];
      const detail = idxDetails[r.indexname] || { isUnique: false, isPrimary: false };
      indexListValues.push([
        seq,                                   // seq
        r.indexname,                           // name
        detail.isUnique ? 1 : 0,               // unique
        detail.isPrimary ? "pk" : "c",         // origin
        0,                                     // partial
      ]);
    }
    cacheResult(indexListKey,
      ["seq", "name", "unique", "origin", "partial"],
      indexListValues
    );

    // 5. PRAGMA index_info for each index
    for (const idxRow of idxRes.rows) {
      const indexName = idxRow.indexname;
      const escapedIdx = `"${indexName.replace(/"/g, '""')}"`;
      const indexInfoKey = `PRAGMA index_info(${escapedIdx})`;

      const indexColsRes = await pgDb.query<{
        attnum: number;
        attname: string;
      }>(
        `SELECT a.attnum, a.attname
         FROM pg_index ix
         JOIN pg_class i ON i.oid = ix.indexrelid
         JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
         JOIN pg_namespace n ON n.oid = i.relnamespace
         WHERE n.nspname = 'public' AND i.relname = $1
         ORDER BY a.attnum`,
        [indexName]
      );

      cacheResult(indexInfoKey,
        ["seqno", "cid", "name"],
        indexColsRes.rows.map((r, seq) => [
          seq,            // seqno
          r.attnum - 1,   // cid (0-based)
          r.attname,      // name
        ])
      );
    }
  }

  return (query: string) => {
    const cached = cache[query];
    if (cached) return cached;
    // Return empty result for unknown queries
    console.warn(`PG executor: uncached query, returning empty: ${query}`);
    return { columns: [] as string[], values: [] as unknown[][] };
  };
}

/** Map PostgreSQL referential action names to SQLite-style action names */
function mapPgAction(action: string): string {
  switch (action) {
    case "CASCADE": return "CASCADE";
    case "SET NULL": return "SET NULL";
    case "SET DEFAULT": return "SET DEFAULT";
    case "RESTRICT": return "RESTRICT";
    case "NO ACTION": return "NO ACTION";
    default: return action;
  }
}

// ── Generate ERD for a PostgreSQL database ─────────────────────
async function generateErdPostgresql(
  sqlFilePath: string,
  outputDir: string,
  deps: ErdDeps,
) {
  const { executorToLayout, dotToSvg, colorErdSVG } = deps;

  const { PGlite } = await import("@electric-sql/pglite");
  const pgDb = new PGlite();

  const sqlContent = readFileSync(sqlFilePath, "utf-8");
  console.log(`Loading SQL into PGLite from ${sqlFilePath}...`);
  await pgDb.exec(sqlContent);

  console.log(`Building layout from ${sqlFilePath} (postgresql)...`);
  const executor = await buildPgExecutorCache(pgDb);
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

  await pgDb.close();
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
  const erdDeps = { executorToLayout, dotToSvg, colorErdSVG };

  const targets: Target[] = generateAll
    ? discoverLanguageDirs()
    : [{ db: dbPath!, out: outDir!, engine: (dbPath!.endsWith(".sql") ? "postgresql" : "sqlite") as EngineType }];

  // Only init sql.js if we have sqlite targets
  let SQL: SqlJsStatic | null = null;
  if (targets.some(t => t.engine === "sqlite")) {
    const initSqlJs = (await import("sql.js")).default;
    SQL = await initSqlJs();
  }

  for (const target of targets) {
    if (target.engine === "postgresql") {
      await generateErdPostgresql(target.db, target.out, erdDeps);
    } else {
      await generateErdSqlite(target.db, target.out, { ...erdDeps, SQL: SQL! });
    }
  }

  console.log("Done!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
