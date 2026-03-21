import type { PGlite } from "@electric-sql/pglite";
import type { DatabaseEngine, QueryResult } from "./types";

export class PgliteEngine implements DatabaseEngine {
  readonly engine = "postgresql" as const;
  private db: PGlite;

  constructor(db: PGlite) {
    this.db = db;
  }

  async exec(sql: string): Promise<QueryResult[]> {
    const results = await this.db.exec(sql);
    return results.map(r => ({
      columns: r.fields.map(f => f.name),
      values: r.rows.map(row => {
        // PGLite returns rows as objects, convert to arrays matching column order
        const fields = r.fields.map(f => f.name);
        return fields.map(name => {
          const val = (row as Record<string, unknown>)[name];
          // Normalize PG types to match the app's expected format
          if (val instanceof Date) return val.toISOString().split("T")[0]; // DATE → "YYYY-MM-DD"
          if (typeof val === "boolean") return val ? 1 : 0; // BOOLEAN → 0/1 for result comparison
          return val;
        });
      }),
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
