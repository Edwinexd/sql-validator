import type { Database } from "sql.js";
import type { DatabaseEngine, QueryResult } from "./types";

export class SqliteEngine implements DatabaseEngine {
  readonly engine = "sqlite" as const;
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async exec(sql: string): Promise<QueryResult[]> {
    const results = this.db.exec(sql);
    return results.map(r => ({
      columns: r.columns,
      values: r.values as unknown[][],
    }));
  }

  async getViews(): Promise<{ name: string; query: string }[]> {
    const res = this.db.exec("SELECT name, sql FROM sqlite_master WHERE type='view'");
    if (res.length === 0) return [];
    return (res[0].values as string[][]).map(([name, query]) => ({ name, query }));
  }

  async getSchema(): Promise<Record<string, string[]>> {
    const schema: Record<string, string[]> = {};
    const tables = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    if (tables.length === 0) return schema;
    for (const row of tables[0].values) {
      const tableName = row[0] as string;
      const cols = this.db.exec(`PRAGMA table_info(${tableName})`);
      if (cols.length > 0) {
        schema[tableName] = cols[0].values.map(r => r[1] as string);
      }
    }
    return schema;
  }

  async validateStatements(sql: string): Promise<string | null> {
    try {
      let count = 0;
      for (const stmt of this.db.iterateStatements(sql)) {
        count++;
        stmt.free();
        if (count > 1) {
          return "multiple_statements";
        }
      }
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async getColumnNames(sql: string): Promise<string[]> {
    // For bare table names, use PRAGMA table_info
    if (/^\w+$/.test(sql.trim())) {
      const tableName = sql.trim();
      const res = this.db.exec(`PRAGMA table_info(${tableName})`);
      if (res.length > 0 && res[0].values.length > 0) {
        return res[0].values.map(row => String(row[1]));
      }
      throw new Error(`Table '${tableName}' does not exist`);
    }

    // For complex expressions, use prepare to get column names
    const probeSQL = `SELECT * FROM (${sql}) LIMIT 0`;
    const stmt = this.db.prepare(probeSQL);
    stmt.step();
    const cols = stmt.getColumnNames();
    stmt.free();
    return cols;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
