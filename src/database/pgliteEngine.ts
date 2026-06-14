import type { PGlite } from "@electric-sql/pglite";
import type { DatabaseEngine, QueryResult } from "./types";
import { normalizePgValue } from "./pgNormalize";

export class PgliteEngine implements DatabaseEngine {
  readonly engine = "postgresql" as const;
  private db: PGlite;

  constructor(db: PGlite) {
    this.db = db;
  }

  async exec(sql: string): Promise<QueryResult[]> {
    // rowMode "array" returns each row as a positional array aligned with `fields`.
    // Object mode keys rows by column name, which silently collapses duplicate column
    // names (e.g. `SELECT namn, namn` or self-joins) down to a single value.
    const results = await this.db.exec(sql, { rowMode: "array" });
    return results.map(r => ({
      columns: r.fields.map(f => f.name),
      values: (r.rows as unknown[][]).map(row =>
        row.map((val, i) => normalizePgValue(val, r.fields[i].dataTypeID)),
      ),
    }));
  }

  async getViews(): Promise<{ name: string; query: string }[]> {
    const res = await this.db.query<{ viewname: string; definition: string }>(
      "SELECT viewname, definition FROM pg_views WHERE schemaname = 'public'"
    );
    return res.rows.map(r => ({
      name: r.viewname,
      query: `CREATE VIEW ${r.viewname} AS ${r.definition}`,
    }));
  }

  async getSchema(): Promise<Record<string, string[]>> {
    const res = await this.db.query<{ table_name: string; column_name: string }>(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position"
    );
    const schema: Record<string, string[]> = {};
    for (const row of res.rows) {
      if (!schema[row.table_name]) schema[row.table_name] = [];
      schema[row.table_name].push(row.column_name);
    }
    return schema;
  }

  async validateStatements(sql: string): Promise<string | null> {
    // Count semicolons outside of string literals
    const stripped = sql.replace(/'[^']*'/g, ""); // remove string literals
    const statements = stripped.split(";").filter(s => s.trim().length > 0);
    if (statements.length > 1) {
      return "multiple_statements";
    }
    // Use EXPLAIN to validate syntax without executing
    if (statements.length === 1) {
      try {
        await this.db.query(`EXPLAIN ${sql}`);
      } catch (e) {
        return (e as Error).message;
      }
    }
    return null;
  }

  async getColumnNames(sql: string): Promise<string[]> {
    // For bare table names, use information_schema
    if (/^\w+$/.test(sql.trim())) {
      const tableName = sql.trim();
      const res = await this.db.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
        [tableName]
      );
      if (res.rows.length > 0) {
        return res.rows.map(r => r.column_name);
      }
      // PostgreSQL lowercases unquoted identifiers, try lowercase
      const resLower = await this.db.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
        [tableName.toLowerCase()]
      );
      if (resLower.rows.length > 0) {
        return resLower.rows.map(r => r.column_name);
      }
      throw new Error(`Table '${tableName}' does not exist`);
    }

    // For complex expressions, probe with LIMIT 0
    const probeSQL = `SELECT * FROM (${sql}) AS _probe LIMIT 0`;
    const res = await this.db.query(probeSQL);
    return res.fields.map(f => f.name);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
