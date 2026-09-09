import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PgliteEngine } from "./pgliteEngine";

describe("PgliteEngine", () => {
  let db: PGlite;
  let engine: PgliteEngine;

  beforeAll(() => {
    db = new PGlite();
    engine = new PgliteEngine(db);
  });

  afterAll(async () => {
    await engine.close();
  });

  it.each([
    "SELECT 1 -- ; a comment",
    "SELECT 1 /* ; a block comment */",
    "SELECT $$a;b$$",
    "SELECT ';'",
  ])("accepts a semicolon that belongs to valid SQL: %s", async (sql) => {
    await expect(engine.validateStatements(sql)).resolves.toBeNull();
  }, 15_000);

  it("rejects two executable statements", async () => {
    await expect(engine.validateStatements("SELECT 1; SELECT 2")).resolves.toBe("multiple_statements");
  });

  it("returns syntax errors and ignores empty input", async () => {
    await expect(engine.validateStatements("")).resolves.toBeNull();
    await expect(engine.validateStatements("SELECT FROM")).resolves.toContain("syntax error");
  });

  it("executes queries without collapsing duplicate column names", async () => {
    await expect(engine.exec("SELECT 1 AS repeated, 2 AS repeated")).resolves.toEqual([
      { columns: ["repeated", "repeated"], values: [[1, 2]] },
    ]);
  });

  it("returns empty metadata when the database has no user objects", async () => {
    await expect(engine.getViews()).resolves.toEqual([]);
    await expect(engine.getSchema()).resolves.toEqual({});
  });

  it("lists views and public table schemas", async () => {
    await db.exec("CREATE TABLE People (id integer, active boolean); CREATE VIEW people_view AS SELECT id FROM People;");

    await expect(engine.getViews()).resolves.toMatchObject([
      { name: "people_view" },
    ]);
    await expect(engine.getSchema()).resolves.toMatchObject({ people: ["id", "active"] });
  });

  it("gets output columns for tables and SQL expressions", async () => {
    await db.exec("CREATE TABLE people_with_names (id integer, name text)");

    await expect(engine.getColumnNames("people_with_names")).resolves.toEqual(["id", "name"]);
    await expect(engine.getColumnNames("People_With_Names")).resolves.toEqual(["id", "name"]);
    await expect(engine.getColumnNames("SELECT name FROM people_with_names")).resolves.toEqual(["name"]);
    await expect(engine.getColumnNames("missing")).rejects.toThrow("Table 'missing' does not exist");
  });
});
