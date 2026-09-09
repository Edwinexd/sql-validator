import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PgliteEngine } from "./pgliteEngine";

describe("PgliteEngine.validateStatements", () => {
  let db: PGlite;
  let engine: PgliteEngine;

  beforeEach(() => {
    db = new PGlite();
    engine = new PgliteEngine(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it.each([
    "SELECT 1 -- ; a comment",
    "SELECT 1 /* ; a block comment */",
    "SELECT $$a;b$$",
    "SELECT ';'",
  ])("accepts a semicolon that belongs to valid SQL: %s", async (sql) => {
    await expect(engine.validateStatements(sql)).resolves.toBeNull();
  });

  it("rejects two executable statements", async () => {
    await expect(engine.validateStatements("SELECT 1; SELECT 2")).resolves.toBe("multiple_statements");
  });
});
