import { afterEach, beforeEach, describe, expect, it } from "vitest";
import initSqlJs, { type Database } from "sql.js";
import { SqliteEngine } from "./sqliteEngine";

describe("SqliteEngine", () => {
  let db: Database;
  let engine: SqliteEngine;

  beforeEach(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("CREATE TABLE people (id INTEGER, name TEXT); INSERT INTO people VALUES (1, 'Ada');");
    db.run("CREATE VIEW person_names AS SELECT name FROM people");
    engine = new SqliteEngine(db);
  });

  afterEach(async () => {
    await engine.close();
  });

  it("executes statements and exposes views and schema", async () => {
    await expect(engine.exec("SELECT id, name FROM people")).resolves.toEqual([
      { columns: ["id", "name"], values: [[1, "Ada"]] },
    ]);
    await expect(engine.getViews()).resolves.toEqual([
      { name: "person_names", query: "CREATE VIEW person_names AS SELECT name FROM people" },
    ]);
    await expect(engine.getSchema()).resolves.toEqual({ people: ["id", "name"] });
  });

  it("validates statement counts and syntax", async () => {
    await expect(engine.validateStatements("")).resolves.toBeNull();
    await expect(engine.validateStatements("SELECT 1")).resolves.toBeNull();
    await expect(engine.validateStatements("SELECT 1; SELECT 2")).resolves.toBe("multiple_statements");
    await expect(engine.validateStatements("SELECT FROM")).resolves.toContain("near");
  });

  it("gets columns for tables and expressions and reports missing tables", async () => {
    await expect(engine.getColumnNames("people")).resolves.toEqual(["id", "name"]);
    await expect(engine.getColumnNames("SELECT name FROM people")).resolves.toEqual(["name"]);
    await expect(engine.getColumnNames("missing")).rejects.toThrow("Table 'missing' does not exist");
  });

  it("returns empty metadata from an empty database", async () => {
    await engine.close();
    const SQL = await initSqlJs();
    db = new SQL.Database();
    engine = new SqliteEngine(db);

    await expect(engine.getViews()).resolves.toEqual([]);
    await expect(engine.getSchema()).resolves.toEqual({});
  });
});
