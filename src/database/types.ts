export type EngineType = "sqlite" | "postgresql";

export interface QueryResult {
  columns: string[];
  values: unknown[][];
}

export interface DatabaseEngine {
  /** Execute SQL and return results (one per statement) */
  exec(sql: string): Promise<QueryResult[]>;
  /** List all user-created views */
  getViews(): Promise<{ name: string; query: string }[]>;
  /** Get table→column[] map for autocomplete */
  getSchema(): Promise<Record<string, string[]>>;
  /** Validate that input contains at most one statement. Returns error message if invalid. */
  validateStatements(sql: string): Promise<string | null>;
  /** Get column names produced by a SQL expression (for RA engine) */
  getColumnNames(sql: string): Promise<string[]>;
  /** The engine type */
  readonly engine: EngineType;
  /** Close the database connection */
  close(): Promise<void>;
}
