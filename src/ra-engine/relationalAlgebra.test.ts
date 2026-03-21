import { describe, it, expect, beforeAll, afterAll } from "vitest";
import initSqlJs, { type Database } from "sql.js";
import { raToSQL, RAError } from "./relationalAlgebra";
import { SqliteEngine } from "../database/sqliteEngine";

// ─── Helper ─────────────────────────────────────────────────────────────────

/** Normalize whitespace for comparison */
function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// ─── Basic table references ─────────────────────────────────────────────────

describe("table references", () => {
  it("should return a bare table name", async () => {
    expect(await raToSQL("Person")).toBe("Person");
  });

  it("should handle parenthesised table name", async () => {
    expect(await raToSQL("(Person)")).toBe("Person");
  });

  it("should handle trailing semicolon", async () => {
    expect(await raToSQL("Person;")).toBe("Person");
  });
});

// ─── Selection (σ) ──────────────────────────────────────────────────────────

describe("selection (σ)", () => {
  it("should transpile σ with Unicode symbol", async () => {
    expect(norm(await raToSQL("σ[age > 20](Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should transpile sigma keyword", async () => {
    expect(norm(await raToSQL("sigma[age > 20](Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should transpile select keyword", async () => {
    expect(norm(await raToSQL("select[age > 20](Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should handle string comparison", async () => {
    expect(norm(await raToSQL("σ[name = 'Alice'](Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE name = 'Alice'")
    );
  });

  it("should handle compound conditions with AND/OR", async () => {
    const sql = await raToSQL("σ[age > 20 and name = 'Alice'](Person)");
    expect(norm(sql)).toBe(
      norm("SELECT * FROM (Person) WHERE (age > 20 AND name = 'Alice')")
    );
  });

  it("should handle NOT condition", async () => {
    const sql = await raToSQL("σ[not age > 20](Person)");
    expect(norm(sql)).toBe(
      norm("SELECT * FROM (Person) WHERE NOT (age > 20)")
    );
  });

  it("should handle table.column references in conditions", async () => {
    const sql = await raToSQL("σ[Person.age > 20](Person)");
    expect(norm(sql)).toBe(
      norm("SELECT * FROM (Person) WHERE Person.age > 20")
    );
  });

  it("should handle nested OR and AND", async () => {
    const sql = await raToSQL("σ[age > 20 or (name = 'Alice' and city = 'Stockholm')](Person)");
    expect(norm(sql)).toContain("OR");
    expect(norm(sql)).toContain("AND");
  });

  it("should handle all comparison operators", async () => {
    expect(norm(await raToSQL("σ[a = 1](T)"))).toContain("= 1");
    expect(norm(await raToSQL("σ[a <> 1](T)"))).toContain("<> 1");
    expect(norm(await raToSQL("σ[a != 1](T)"))).toContain("<> 1");
    expect(norm(await raToSQL("σ[a < 1](T)"))).toContain("< 1");
    expect(norm(await raToSQL("σ[a > 1](T)"))).toContain("> 1");
    expect(norm(await raToSQL("σ[a <= 1](T)"))).toContain("<= 1");
    expect(norm(await raToSQL("σ[a >= 1](T)"))).toContain(">= 1");
  });

  it("should handle function calls in conditions", async () => {
    const sql = await raToSQL("σ[YEAR(startDate) = 2024](CourseInstance)");
    expect(norm(sql)).toBe(
      norm("SELECT * FROM (CourseInstance) WHERE YEAR(startDate) = 2024")
    );
  });
});

// ─── Projection (π) ─────────────────────────────────────────────────────────

describe("projection (π)", () => {
  it("should transpile π with Unicode", async () => {
    expect(norm(await raToSQL("π[name, age](Person)"))).toBe(
      norm("SELECT name, age FROM (Person)")
    );
  });

  it("should transpile pi keyword", async () => {
    expect(norm(await raToSQL("pi[name](Person)"))).toBe(
      norm("SELECT name FROM (Person)")
    );
  });

  it("should transpile project keyword", async () => {
    expect(norm(await raToSQL("project[name, city](Person)"))).toBe(
      norm("SELECT name, city FROM (Person)")
    );
  });

  it("should handle table.column references", async () => {
    expect(norm(await raToSQL("π[Person.name](Person)"))).toBe(
      norm("SELECT Person.name FROM (Person)")
    );
  });
});

// ─── Rename (ρ) ─────────────────────────────────────────────────────────────

describe("rename (ρ)", () => {
  it("should transpile ρ with Unicode arrow", async () => {
    expect(norm(await raToSQL("ρ[name→fullName](Person)"))).toBe(
      norm("SELECT name AS fullName FROM (Person)")
    );
  });

  it("should transpile rho with ASCII arrow", async () => {
    expect(norm(await raToSQL("rho[name->fullName](Person)"))).toBe(
      norm("SELECT name AS fullName FROM (Person)")
    );
  });

  it("should handle multiple rename mappings", async () => {
    const sql = await raToSQL("ρ[name→fullName, age→years](Person)");
    expect(norm(sql)).toBe(
      norm("SELECT name AS fullName, age AS years FROM (Person)")
    );
  });
});

// ─── Cross product (×) ─────────────────────────────────────────────────────

describe("cross product (×)", () => {
  it("should transpile × operator", async () => {
    const sql = await raToSQL("Person × Course");
    expect(norm(sql)).toContain("CROSS JOIN");
  });

  it("should transpile cross keyword", async () => {
    const sql = await raToSQL("Person cross Course");
    expect(norm(sql)).toContain("CROSS JOIN");
  });
});

// ─── Natural join (⋈) ──────────────────────────────────────────────────────

describe("natural join (⋈)", () => {
  it("should transpile ⋈ operator", async () => {
    const sql = await raToSQL("Person ⋈ Student");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should transpile natjoin keyword", async () => {
    const sql = await raToSQL("Person natjoin Student");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should error on impossible natural join when database is provided", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE TableA (id INTEGER, name TEXT)");
    db.run("CREATE TABLE TableB (code TEXT, description TEXT)");

    await expect(raToSQL("TableA ⋈ TableB", new SqliteEngine(db))).rejects.toThrow(RAError);
    await expect(raToSQL("TableA ⋈ TableB", new SqliteEngine(db))).rejects.toThrow(/no common columns/i);
    db.close();
  });

  it("should not error on valid natural join when database is provided", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE Person (id INTEGER, name TEXT, city TEXT)");
    db.run("CREATE TABLE Student (id INTEGER, hasDisability INTEGER)");

    await expect(raToSQL("Person ⋈ Student", new SqliteEngine(db))).resolves.not.toThrow();
    db.close();
  });

  it("should error on natural join with non-existent table", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE Person (id INTEGER, name TEXT)");

    await expect(raToSQL("Person ⋈ Room", new SqliteEngine(db))).rejects.toThrow(RAError);
    await expect(raToSQL("Person ⋈ Room", new SqliteEngine(db))).rejects.toThrow(/Room/);
    db.close();
  });

  it("should error on natural join with no common columns through subquery", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE Person (person_id INTEGER, name TEXT, city TEXT)");
    db.run("CREATE TABLE Room (room_id INTEGER, building TEXT, capacity INTEGER)");

    await expect(raToSQL("σ[city = 'York'](Person) ⋈ Room", new SqliteEngine(db))).rejects.toThrow(RAError);
    await expect(raToSQL("σ[city = 'York'](Person) ⋈ Room", new SqliteEngine(db))).rejects.toThrow(/no common columns/i);
    db.close();
  });

  it("should not error when no database is provided (parse-only mode)", async () => {
    await expect(raToSQL("TableA ⋈ TableB")).resolves.not.toThrow();
  });

  it("should support |X| as natural join", async () => {
    const sql = await raToSQL("Person |X| Student");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should support |><| as natural join", async () => {
    const sql = await raToSQL("Person |><| Student");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });
});

// ─── Theta join (⋈[cond]) ──────────────────────────────────────────────────

describe("theta join (⋈[cond])", () => {
  it("should transpile ⋈ with condition", async () => {
    const sql = await raToSQL("Person ⋈[Person.id = Student.id] Student");
    expect(norm(sql)).toContain("JOIN");
    expect(norm(sql)).toContain("ON Person.id = Student.id");
    expect(norm(sql)).not.toContain("NATURAL");
  });

  it("should transpile join keyword with condition", async () => {
    const sql = await raToSQL("Person join[Person.id = Student.id] Student");
    expect(norm(sql)).toContain("JOIN");
    expect(norm(sql)).toContain("ON Person.id = Student.id");
  });
});

// ─── Set operations ─────────────────────────────────────────────────────────

describe("set operations", () => {
  it("should transpile union with ∪", async () => {
    const sql = await raToSQL("π[name](Person) ∪ π[name](Teacher)");
    expect(norm(sql)).toContain("UNION");
  });

  it("should transpile union keyword", async () => {
    const sql = await raToSQL("π[name](Person) union π[name](Teacher)");
    expect(norm(sql)).toContain("UNION");
  });

  it("should transpile intersect with ∩", async () => {
    const sql = await raToSQL("π[name](Person) ∩ π[name](Teacher)");
    expect(norm(sql)).toContain("INTERSECT");
  });

  it("should transpile difference with −", async () => {
    const sql = await raToSQL("π[name](Person) − π[name](Teacher)");
    expect(norm(sql)).toContain("EXCEPT");
  });

  it("should transpile minus keyword", async () => {
    const sql = await raToSQL("π[name](Person) minus π[name](Teacher)");
    expect(norm(sql)).toContain("EXCEPT");
  });

  it("should transpile backslash as set difference", async () => {
    const sql = await raToSQL("A \\ B");
    expect(norm(sql)).toContain("EXCEPT");
  });

  it("should generate valid SQL for bare table set operations", async () => {
    // Set ops need SELECT statements on both sides, not bare table names
    const unionSql = norm(await raToSQL("A union B"));
    expect(unionSql).toMatch(/SELECT \* FROM A\s+UNION\s+SELECT \* FROM B/i);

    const exceptSql = norm(await raToSQL("A minus B"));
    expect(exceptSql).toMatch(/SELECT \* FROM A\s+EXCEPT\s+SELECT \* FROM B/i);

    const intersectSql = norm(await raToSQL("A intersect B"));
    expect(intersectSql).toMatch(/SELECT \* FROM A\s+INTERSECT\s+SELECT \* FROM B/i);
  });

  it("should handle set difference with hyphenated expression", async () => {
    const sql = await raToSQL("PI[name, city](Person - Teacher)");
    expect(norm(sql)).toContain("EXCEPT");
    expect(norm(sql)).toContain("SELECT name, city");
  });

  it("should error on union-incompatible column counts when database is provided", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE A (x INTEGER, y TEXT)");
    db.run("CREATE TABLE B (x INTEGER, y TEXT, z TEXT)");

    await expect(raToSQL("A union B", new SqliteEngine(db))).rejects.toThrow(RAError);
    await expect(raToSQL("A union B", new SqliteEngine(db))).rejects.toThrow(/same number of columns/i);
    await expect(raToSQL("A minus B", new SqliteEngine(db))).rejects.toThrow(RAError);
    await expect(raToSQL("A intersect B", new SqliteEngine(db))).rejects.toThrow(RAError);

    // Should NOT throw when column counts match
    db.run("CREATE TABLE C (a INTEGER, b TEXT)");
    await expect(raToSQL("A union C", new SqliteEngine(db))).resolves.not.toThrow();
    db.close();
  });

  it("should include column names in union-incompatible error message", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE R1 (name TEXT, city TEXT)");
    db.run("CREATE TABLE R2 (name TEXT, city TEXT, age INTEGER)");

    await expect(raToSQL("R1 union R2", new SqliteEngine(db))).rejects.toThrow(/Left has 2/);
    await expect(raToSQL("R1 union R2", new SqliteEngine(db))).rejects.toThrow(/right has 3/);
    db.close();
  });
});

// ─── Outer joins ────────────────────────────────────────────────────────────

describe("outer joins", () => {
  it("should transpile left outer join", async () => {
    const sql = await raToSQL("Person leftjoin[Person.id = Student.id] Student");
    expect(norm(sql)).toContain("LEFT JOIN");
    expect(norm(sql)).toContain("ON Person.id = Student.id");
  });

  it("should transpile right outer join", async () => {
    const sql = await raToSQL("Person rightjoin[Person.id = Student.id] Student");
    expect(norm(sql)).toContain("RIGHT JOIN");
  });

  it("should transpile full outer join", async () => {
    const sql = await raToSQL("Person fulljoin[Person.id = Student.id] Student");
    expect(norm(sql)).toContain("FULL OUTER JOIN");
  });

  it("should transpile left outer join with Unicode ⟕", async () => {
    const sql = await raToSQL("Person ⟕[Person.id = Student.id] Student");
    expect(norm(sql)).toContain("LEFT JOIN");
  });
});

// ─── Semi-joins and anti-join ───────────────────────────────────────────────

describe("semi-joins and anti-join", () => {
  it("should transpile left semi-join", async () => {
    const sql = await raToSQL("Person leftsemijoin Student");
    expect(norm(sql)).toContain("WHERE EXISTS");
  });

  it("should transpile left semi-join with ⋉", async () => {
    const sql = await raToSQL("Person ⋉ Student");
    expect(norm(sql)).toContain("WHERE EXISTS");
  });

  it("should transpile right semi-join", async () => {
    const sql = await raToSQL("Person rightsemijoin Student");
    expect(norm(sql)).toContain("WHERE EXISTS");
  });

  it("should transpile anti-join", async () => {
    const sql = await raToSQL("Person antijoin Student");
    expect(norm(sql)).toContain("WHERE NOT EXISTS");
  });

  it("should transpile anti-join with ▷", async () => {
    const sql = await raToSQL("Person ▷ Student");
    expect(norm(sql)).toContain("WHERE NOT EXISTS");
  });
});

// ─── Division (÷) ──────────────────────────────────────────────────────────

describe("division (÷)", () => {
  it("should transpile ÷ operator", async () => {
    const sql = await raToSQL("A ÷ B");
    expect(norm(sql)).toContain("NOT EXISTS");
  });

  it("should transpile divide keyword", async () => {
    const sql = await raToSQL("A divide B");
    expect(norm(sql)).toContain("NOT EXISTS");
  });
});

// ─── Distinct (δ) ──────────────────────────────────────────────────────────

describe("distinct (δ)", () => {
  it("should transpile δ", async () => {
    expect(norm(await raToSQL("δ(Person)"))).toBe(
      norm("SELECT DISTINCT * FROM (Person)")
    );
  });

  it("should transpile delta keyword", async () => {
    expect(norm(await raToSQL("delta(Person)"))).toBe(
      norm("SELECT DISTINCT * FROM (Person)")
    );
  });

  it("should transpile distinct keyword", async () => {
    expect(norm(await raToSQL("distinct(Person)"))).toBe(
      norm("SELECT DISTINCT * FROM (Person)")
    );
  });
});

// ─── Sorting (τ) ────────────────────────────────────────────────────────────

describe("sorting (τ)", () => {
  it("should transpile τ with single column", async () => {
    const sql = await raToSQL("τ[name](Person)");
    expect(norm(sql)).toBe(
      norm("SELECT * FROM (Person) ORDER BY name")
    );
  });

  it("should transpile τ with DESC", async () => {
    const sql = await raToSQL("τ[age DESC](Person)");
    expect(norm(sql)).toBe(
      norm("SELECT * FROM (Person) ORDER BY age DESC")
    );
  });

  it("should transpile sort keyword", async () => {
    const sql = await raToSQL("sort[name](Person)");
    expect(norm(sql)).toContain("ORDER BY name");
  });

  it("should handle multiple sort columns", async () => {
    const sql = await raToSQL("τ[name, age DESC](Person)");
    expect(norm(sql)).toContain("ORDER BY name, age DESC");
  });
});

// ─── Grouping/Aggregation (γ) ──────────────────────────────────────────────

describe("grouping/aggregation (γ)", () => {
  it("should transpile γ with group-by and aggregate", async () => {
    const sql = await raToSQL("γ[city; COUNT(id)](Person)");
    expect(norm(sql)).toContain("COUNT(id)");
    expect(norm(sql)).toContain("GROUP BY city");
  });

  it("should handle aggregate with alias", async () => {
    const sql = await raToSQL("γ[city; COUNT(id) AS total](Person)");
    expect(norm(sql)).toContain("COUNT(id) AS total");
    expect(norm(sql)).toContain("GROUP BY city");
  });

  it("should transpile gamma keyword", async () => {
    const sql = await raToSQL("gamma[city; SUM(price) AS totalPrice](Course)");
    expect(norm(sql)).toContain("SUM(price) AS totalPrice");
    expect(norm(sql)).toContain("GROUP BY city");
  });
});

// ─── Composition / nesting ──────────────────────────────────────────────────

describe("composition and nesting", () => {
  it("should handle projection of selection", async () => {
    const sql = await raToSQL("π[name](σ[age > 20](Person))");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("WHERE age > 20");
  });

  it("should handle selection of join", async () => {
    const sql = await raToSQL("σ[age > 20](Person ⋈ Student)");
    expect(norm(sql)).toContain("WHERE age > 20");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should handle complex nested expression", async () => {
    const sql = await raToSQL("π[name](σ[city = 'Stockholm'](Person ⋈ Student))");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("WHERE city = 'Stockholm'");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should handle parenthesised subexpressions", async () => {
    const sql = await raToSQL("(Person ⋈ Student) ∪ (Person ⋈ Teacher)");
    expect(norm(sql)).toContain("UNION");
    expect(norm(sql).match(/NATURAL JOIN/g)?.length).toBe(2);
  });

  it("should handle deeply nested expressions", async () => {
    const sql = await raToSQL("π[name](σ[age > 20](ρ[id→personId](Person)))");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("WHERE age > 20");
    expect(norm(sql)).toContain("id AS personId");
  });
});

// ─── Operator precedence ───────────────────────────────────────────────────

describe("operator precedence", () => {
  it("should bind join tighter than union", async () => {
    // A ⋈ B ∪ C should be (A ⋈ B) ∪ C, not A ⋈ (B ∪ C)
    const sql = await raToSQL("A ⋈ B ∪ C");
    // The NATURAL JOIN should come before UNION in the SQL
    expect(norm(sql)).toMatch(/NATURAL JOIN.*UNION/);
  });

  it("should bind intersect tighter than union", async () => {
    const sql = await raToSQL("A ∪ B ∩ C");
    // B ∩ C should be grouped together
    expect(norm(sql)).toContain("INTERSECT");
    expect(norm(sql)).toContain("UNION");
  });
});

// ─── Error handling ─────────────────────────────────────────────────────────

describe("error handling", () => {
  it("should throw RAError on empty input", async () => {
    await expect(raToSQL("")).rejects.toThrow(RAError);
  });

  it("should throw RAError on invalid syntax", async () => {
    await expect(raToSQL("σ[](Person)")).rejects.toThrow(RAError);
  });

  it("should throw RAError on unclosed bracket", async () => {
    await expect(raToSQL("σ[age > 20(Person)")).rejects.toThrow(RAError);
  });

  it("should throw RAError on unexpected token after expression", async () => {
    await expect(raToSQL("Person Student")).rejects.toThrow(RAError);
  });

  it("should throw RAError on unterminated string", async () => {
    await expect(raToSQL("σ[name = 'Alice](Person)")).rejects.toThrow(RAError);
  });

  it("should throw RAError on missing condition in selection", async () => {
    await expect(raToSQL("σ(Person)")).rejects.toThrow(RAError);
  });

  it("should throw RAError on missing relation for selection", async () => {
    await expect(raToSQL("σ[age > 20]")).rejects.toThrow(RAError);
  });
});

// ─── Multi-line / assignments (←) ──────────────────────────────────────────

describe("multi-line and assignments", () => {
  it("should handle simple assignment with ←", async () => {
    const sql = await raToSQL("A ← Person\nA");
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
  });

  it("should handle simple assignment with <-", async () => {
    const sql = await raToSQL("A <- Person\nA");
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
  });

  it("should handle assignment with complex expression", async () => {
    const sql = await raToSQL("Students ← σ[age > 20](Person)\nπ[name](Students)");
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("Students AS");
    expect(norm(sql)).toContain("WHERE age > 20");
    expect(norm(sql)).toContain("SELECT name FROM");
  });

  it("should handle multiple assignments", async () => {
    const input = [
      "A ← σ[city = 'Stockholm'](Person)",
      "B ← π[name](A)",
      "B",
    ].join("\n");
    const sql = await raToSQL(input);
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
    expect(norm(sql)).toContain("B AS");
    expect(norm(sql)).toContain("WHERE city = 'Stockholm'");
    expect(norm(sql)).toContain("SELECT name FROM");
  });

  it("should handle assignment chaining with joins", async () => {
    const input = [
      "PS ← Person ⋈ Student",
      "Result ← π[name](PS)",
      "Result",
    ].join("\n");
    const sql = await raToSQL(input);
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("PS AS");
    expect(norm(sql)).toContain("NATURAL JOIN");
    expect(norm(sql)).toContain("Result AS");
  });

  it("should handle semicolons as statement separators", async () => {
    const sql = await raToSQL("A ← Person; π[name](A)");
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
    expect(norm(sql)).toContain("SELECT name FROM");
  });

  it("should handle mixed newlines and semicolons", async () => {
    const input = "A ← Person;\nB ← Student\nA ⋈ B";
    const sql = await raToSQL(input);
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
    expect(norm(sql)).toContain("B AS");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should still work with single-line expressions (no assignments)", async () => {
    // No regression — single-line without assignment should work as before
    expect(await raToSQL("Person")).toBe("Person");
    expect(norm(await raToSQL("π[name](Person)"))).toBe(
      norm("SELECT name FROM (Person)")
    );
  });

  it("should handle -- comments in multi-line input", async () => {
    const input = [
      "-- First get students",
      "A ← σ[age > 20](Person)",
      "-- Then project names",
      "π[name](A)",
    ].join("\n");
    const sql = await raToSQL(input);
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
    expect(norm(sql)).toContain("WHERE age > 20");
    expect(norm(sql)).toContain("SELECT name FROM");
  });

  it("should handle trailing newlines", async () => {
    const sql = await raToSQL("Person\n\n\n");
    expect(sql).toBe("Person");
  });

  it("should handle leading newlines", async () => {
    const sql = await raToSQL("\n\n\nPerson");
    expect(sql).toBe("Person");
  });

  it("should handle the student example: A <- pi[student](sigma[name='peter'](P))", async () => {
    const input = "A <- π[student](σ[name = 'Peter'](Participation))\nA";
    const sql = await raToSQL(input);
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
    expect(norm(sql)).toContain("SELECT student FROM");
    expect(norm(sql)).toContain("WHERE name = 'Peter'");
  });
});

// ─── Alternative notation styles ────────────────────────────────────────────

describe("curly braces (LaTeX-style)", () => {
  it("should support σ_{condition}(R)", async () => {
    expect(norm(await raToSQL("σ_{age > 20}(Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should support π_{cols}(R)", async () => {
    expect(norm(await raToSQL("π_{name, city}(Person)"))).toBe(
      norm("SELECT name, city FROM (Person)")
    );
  });

  it("should support ρ_{old→new}(R)", async () => {
    expect(norm(await raToSQL("ρ_{name→fullName}(Person)"))).toBe(
      norm("SELECT name AS fullName FROM (Person)")
    );
  });

  it("should support curly braces without underscore", async () => {
    expect(norm(await raToSQL("σ{age > 20}(Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should support theta join with curly braces", async () => {
    const sql = await raToSQL("Person ⋈{Person.id = Student.id} Student");
    expect(norm(sql)).toContain("JOIN");
    expect(norm(sql)).toContain("ON Person.id = Student.id");
  });
});

describe("implicit subscripts (no brackets)", () => {
  it("should support σ condition (R)", async () => {
    expect(norm(await raToSQL("σ age > 20 (Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should support π cols (R)", async () => {
    expect(norm(await raToSQL("π name, city (Person)"))).toBe(
      norm("SELECT name, city FROM (Person)")
    );
  });

  it("should support sigma condition (R) with keyword", async () => {
    expect(norm(await raToSQL("sigma age > 20 (Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should support pi cols (R) with keyword", async () => {
    expect(norm(await raToSQL("pi name (Person)"))).toBe(
      norm("SELECT name FROM (Person)")
    );
  });

  it("should support ρ old→new (R) implicit", async () => {
    expect(norm(await raToSQL("ρ name→fullName (Person)"))).toBe(
      norm("SELECT name AS fullName FROM (Person)")
    );
  });

  it("should support τ col (R) implicit", async () => {
    expect(norm(await raToSQL("τ name (Person)"))).toContain("ORDER BY name");
  });

  it("should support nested implicit subscripts", async () => {
    const sql = await raToSQL("π name (σ age > 20 (Person))");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("WHERE age > 20");
  });

  it("should support compound implicit condition with AND", async () => {
    const sql = await raToSQL("σ age > 20 and city = 'Stockholm' (Person)");
    expect(norm(sql)).toContain("WHERE");
    expect(norm(sql)).toContain("AND");
    expect(norm(sql)).toContain("age > 20");
  });

  it("should work with multi-line and implicit subscripts", async () => {
    const input = [
      "A <- σ age > 20 (Person)",
      "π name (A)",
    ].join("\n");
    const sql = await raToSQL(input);
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("WHERE age > 20");
    expect(norm(sql)).toContain("SELECT name FROM");
  });
});

describe("parenthesis-free syntax", () => {
  it("should allow σ[cond] Table without parens", async () => {
    expect(norm(await raToSQL("σ[age > 20] Person"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should allow π[cols] Table without parens", async () => {
    expect(norm(await raToSQL("π[name] Person"))).toBe(
      norm("SELECT name FROM (Person)")
    );
  });

  it("should allow chained unary ops without parens", async () => {
    const sql = await raToSQL("π[name] σ[age > 20] Person");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("WHERE age > 20");
  });

  it("should handle the user's example without excessive parens", async () => {
    const sql = await raToSQL("π[person_id, name, city] σ[city = 'York' OR city = 'Bristol'] Person");
    expect(norm(sql)).toContain("SELECT person_id, name, city FROM");
    expect(norm(sql)).toContain("WHERE");
    expect(norm(sql)).toContain("city = 'York'");
    expect(norm(sql)).toContain("city = 'Bristol'");
  });

  it("should still work with parens for grouping binary ops", async () => {
    const sql = await raToSQL("π[name] (Person ∪ Student)");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("UNION");
  });

  it("should allow δ Table without parens", async () => {
    expect(norm(await raToSQL("δ Person"))).toContain("SELECT DISTINCT");
  });

  it("should allow triple chain without parens", async () => {
    const sql = await raToSQL("π[name] σ[age > 20] ρ[n→name] Person");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("WHERE age > 20");
    expect(norm(sql)).toContain("n AS name");
  });
});

describe("implicit return from last assignment", () => {
  it("should return last assigned variable when no explicit result", async () => {
    const sql = await raToSQL("A <- σ[age > 20](Person)");
    expect(norm(sql)).toContain("WITH A AS");
    expect(norm(sql)).toContain("SELECT * FROM A");
  });

  it("should return last variable with multiple assignments", async () => {
    const sql = await raToSQL("A <- σ[age > 20](Person)\nB <- π[name](A)");
    expect(norm(sql)).toContain("SELECT * FROM B");
  });

  it("should still work when explicit result is given", async () => {
    const sql = await raToSQL("A <- σ[age > 20](Person)\nA");
    expect(norm(sql)).toContain("SELECT * FROM A");
  });

  it("should handle self-referential A <- A as a no-op", async () => {
    const sql = await raToSQL("A <- A");
    expect(norm(sql)).toBe(norm("SELECT * FROM A"));
  });

  it("should handle variable reassignment with versioned CTE names", async () => {
    const sql = await raToSQL("A <- σ[age > 20](Person)\nA <- π[name](A)\nA");
    expect(norm(sql)).toContain("WITH A AS");
    expect(norm(sql)).toContain("A_v2 AS");
    expect(norm(sql)).toContain("SELECT * FROM A_v2");
  });

  it("should handle triple reassignment", async () => {
    const sql = await raToSQL("X <- Person\nX <- σ[age > 20](X)\nX <- π[name](X)");
    expect(norm(sql)).toContain("X AS");
    expect(norm(sql)).toContain("X_v2 AS");
    expect(norm(sql)).toContain("X_v3 AS");
    expect(norm(sql)).toContain("SELECT * FROM X_v3");
  });
});

// ─── SQLite execution ──────────────────────────────────────────────────────
// Every generated SQL statement must actually execute against a real database.

describe("SQLite execution", () => {
  let db: Database;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run(`
      CREATE TABLE Person (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, city TEXT);
      INSERT INTO Person VALUES (1, 'Alice', 25, 'Stockholm');
      INSERT INTO Person VALUES (2, 'Bob', 19, 'York');
      INSERT INTO Person VALUES (3, 'Carol', 30, 'Bristol');

      CREATE TABLE Student (id INTEGER PRIMARY KEY, hasDisability INTEGER);
      INSERT INTO Student VALUES (1, 0);
      INSERT INTO Student VALUES (2, 1);

      CREATE TABLE Teacher (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, city TEXT, department TEXT);
      INSERT INTO Teacher VALUES (10, 'Dave', 45, 'Stockholm', 'CS');
      INSERT INTO Teacher VALUES (11, 'Eve', 38, 'York', 'Math');

      CREATE TABLE Course (course_id INTEGER PRIMARY KEY, title TEXT, credits INTEGER);
      INSERT INTO Course VALUES (100, 'Databases', 7);
      INSERT INTO Course VALUES (101, 'Algorithms', 5);

      CREATE TABLE Enrollment (id INTEGER, course_id INTEGER);
      INSERT INTO Enrollment VALUES (1, 100);
      INSERT INTO Enrollment VALUES (1, 101);
      INSERT INTO Enrollment VALUES (2, 100);
    `);
  });

  afterAll(() => db.close());

  /** Convert RA to SQL and execute, returning result rows */
  async function execRA(expr: string): Promise<initSqlJs.QueryExecResult[]> {
    const sql = await raToSQL(expr, new SqliteEngine(db));
    return db.exec(sql);
  }

  // ── Selection ──

  it("σ with condition", async () => {
    const res = await execRA("σ[age > 20](Person)");
    expect(res[0].values.length).toBe(2); // Alice (25) and Carol (30)
  });

  it("σ with string comparison", async () => {
    const res = await execRA("σ[name = 'Alice'](Person)");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Alice");
  });

  it("σ with compound condition", async () => {
    const res = await execRA("σ[age > 20 and city = 'Stockholm'](Person)");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Alice");
  });

  // ── Projection ──

  it("π selects columns", async () => {
    const res = await execRA("π[name, city](Person)");
    expect(res[0].columns).toEqual(["name", "city"]);
    expect(res[0].values.length).toBe(3);
  });

  // ── Rename ──

  it("ρ renames columns", async () => {
    const res = await execRA("ρ[name→fullName](Person)");
    expect(res[0].columns).toContain("fullName");
    expect(res[0].columns).not.toContain("name");
  });

  // ── Natural join ──

  it("⋈ natural join", async () => {
    const res = await execRA("Person ⋈ Student");
    expect(res[0].values.length).toBe(2); // ids 1 and 2 match
  });

  it("natjoin keyword", async () => {
    const res = await execRA("Person natjoin Student");
    expect(res[0].values.length).toBe(2);
  });

  // ── Cross product ──

  it("× cross product", async () => {
    const res = await execRA("Person × Course");
    expect(res[0].values.length).toBe(6); // 3 × 2
  });

  // ── Theta join ──

  it("⋈[cond] theta join", async () => {
    // Use unqualified column names since the generator aliases tables as _raN
    const res = await execRA("Person ⋈[age > credits] Course");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  // ── Set operations ──

  it("∪ union", async () => {
    const res = await execRA("π[name](Person) ∪ π[name](Teacher)");
    expect(res[0].values.length).toBe(5); // 3 + 2, all distinct names
  });

  it("∩ intersect", async () => {
    // No overlapping names between Person and Teacher
    const res = await execRA("π[name](Person) ∩ π[name](Teacher)");
    expect(res.length === 0 || res[0].values.length === 0).toBe(true);
  });

  it("− set difference", async () => {
    const res = await execRA("π[name](Person) − π[name](Teacher)");
    expect(res[0].values.length).toBe(3); // All Person names, none overlap
  });

  it("minus keyword", async () => {
    const res = await execRA("π[name](Person) minus π[name](Teacher)");
    expect(res[0].values.length).toBe(3);
  });

  it("bare table set difference (Person - Teacher)", async () => {
    // Person and Teacher are union-compatible (both have id, name, age, city)
    // but Teacher has an extra column (department) — use projections
    const res = await execRA("π[id, name](Person) − π[id, name](Teacher)");
    expect(res[0].values.length).toBe(3);
  });

  it("set difference with hyphen syntax", async () => {
    const res = await execRA("π[name, city](Person) - π[name, city](Teacher)");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  it("errors on union-incompatible set operations", async () => {
    // Person has 4 cols (id, name, age, city), Course has 3 cols (course_id, title, credits)
    await expect(execRA("Person union Course")).rejects.toThrow(RAError);
    await expect(execRA("Person union Course")).rejects.toThrow(/same number of columns/i);
    await expect(execRA("Person minus Course")).rejects.toThrow(RAError);
    await expect(execRA("Person intersect Course")).rejects.toThrow(RAError);
  });

  it("backslash set difference", async () => {
    const res = await execRA("π[name](Person) \\ π[name](Teacher)");
    expect(res[0].values.length).toBe(3);
  });

  // ── Outer joins ──

  it("leftjoin", async () => {
    // Use unqualified column names since the generator aliases tables as _raN
    const res = await execRA("Person leftjoin[age > credits] Course");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  // ── Semi-join ──

  it("⋉ left semi-join returns only matching rows", async () => {
    const res = await execRA("Person ⋉ Student");
    // Person ids 1,2,3 — Student ids 1,2 — semi-join on common col "id"
    expect(res[0].values.length).toBe(2);
  });

  // ── Anti-join ──

  it("▷ anti-join returns only non-matching rows", async () => {
    const res = await execRA("Person ▷ Student");
    // Only Carol (id=3) has no matching Student row
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Carol");
  });

  // ── Distinct ──

  it("δ distinct", async () => {
    const res = await execRA("δ(Person)");
    expect(res[0].values.length).toBe(3);
  });

  // ── Sort ──

  it("τ sort", async () => {
    const res = await execRA("τ[name](Person)");
    expect(res[0].values[0]).toContain("Alice");
    expect(res[0].values[2]).toContain("Carol");
  });

  it("τ sort DESC", async () => {
    const res = await execRA("τ[age DESC](Person)");
    expect(res[0].values[0]).toContain("Carol"); // age 30, highest
  });

  // ── Grouping / aggregation ──

  it("γ group by with COUNT", async () => {
    const res = await execRA("γ[city; COUNT(id) AS cnt](Person)");
    expect(res[0].columns).toContain("cnt");
    expect(res[0].values.length).toBe(3); // 3 distinct cities
  });

  // ── Division ──

  it("÷ division returns correct result", async () => {
    // Enrollment: (1,100),(1,101),(2,100) — Course: (100),(101)
    // Only id=1 is enrolled in ALL courses
    const res = await execRA("π[id, course_id](Enrollment) ÷ π[course_id](Course)");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain(1); // id=1 (Alice)
  });

  // ── Composition / nesting ──

  it("π of σ", async () => {
    const res = await execRA("π[name](σ[age > 20](Person))");
    expect(res[0].columns).toEqual(["name"]);
    expect(res[0].values.length).toBe(2);
  });

  it("σ of ⋈", async () => {
    const res = await execRA("σ[age > 20](Person ⋈ Student)");
    expect(res[0].values.length).toBe(1); // Only Alice (25) matches
  });

  it("deeply nested", async () => {
    const res = await execRA("π[name](σ[city = 'Stockholm'](Person ⋈ Student))");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Alice");
  });

  // ── Parenthesis-free syntax ──

  it("σ[cond] Table without parens", async () => {
    const res = await execRA("σ[age > 20] Person");
    expect(res[0].values.length).toBe(2);
  });

  it("π[cols] σ[cond] Table chained", async () => {
    const res = await execRA("π[name] σ[age > 20] Person");
    expect(res[0].columns).toEqual(["name"]);
    expect(res[0].values.length).toBe(2);
  });

  // ── Implicit subscripts ──

  it("σ cond (R) implicit", async () => {
    const res = await execRA("σ age > 20 (Person)");
    expect(res[0].values.length).toBe(2);
  });

  it("π cols (R) implicit", async () => {
    const res = await execRA("π name, city (Person)");
    expect(res[0].columns).toEqual(["name", "city"]);
  });

  // ── Assignments ──

  it("single assignment", async () => {
    const res = await execRA("A ← σ[age > 20](Person)\nπ[name](A)");
    expect(res[0].values.length).toBe(2);
  });

  it("multiple assignments", async () => {
    const res = await execRA("A ← σ[city = 'Stockholm'](Person)\nB ← π[name](A)\nB");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Alice");
  });

  it("variable reassignment", async () => {
    const res = await execRA("X ← Person\nX ← σ[age > 20](X)\nX ← π[name](X)");
    expect(res[0].values.length).toBe(2);
  });

  // ── LaTeX-style curly braces ──

  it("σ_{cond}(R)", async () => {
    const res = await execRA("σ_{age > 20}(Person)");
    expect(res[0].values.length).toBe(2);
  });

  it("π_{cols}(R)", async () => {
    const res = await execRA("π_{name, city}(Person)");
    expect(res[0].columns).toEqual(["name", "city"]);
  });

  it("ρ_{old→new}(R)", async () => {
    const res = await execRA("ρ_{name→fullName}(Person)");
    expect(res[0].columns).toContain("fullName");
    expect(res[0].columns).not.toContain("name");
  });

  it("σ{cond}(R) without underscore", async () => {
    const res = await execRA("σ{age > 20}(Person)");
    expect(res[0].values.length).toBe(2);
  });

  it("⋈{cond} theta join with curly braces", async () => {
    const res = await execRA("Person ⋈{age > credits} Course");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  // ── Selection edge cases ──

  it("σ with OR condition", async () => {
    const res = await execRA("σ[city = 'Stockholm' or city = 'York'](Person)");
    expect(res[0].values.length).toBe(2); // Alice and Bob
  });

  it("σ with NOT condition", async () => {
    const res = await execRA("σ[not age > 20](Person)");
    expect(res[0].values.length).toBe(1); // Only Bob (19)
    expect(res[0].values[0]).toContain("Bob");
  });

  it("σ with nested OR and AND", async () => {
    const res = await execRA("σ[age > 20 or (name = 'Bob' and city = 'York')](Person)");
    expect(res[0].values.length).toBe(3); // Alice, Bob, Carol
  });

  it("σ with all comparison operators", async () => {
    expect((await execRA("σ[age = 25](Person)"))[0].values.length).toBe(1);
    expect((await execRA("σ[age <> 25](Person)"))[0].values.length).toBe(2);
    expect((await execRA("σ[age != 25](Person)"))[0].values.length).toBe(2);
    expect((await execRA("σ[age < 25](Person)"))[0].values.length).toBe(1);
    expect((await execRA("σ[age > 25](Person)"))[0].values.length).toBe(1);
    expect((await execRA("σ[age <= 25](Person)"))[0].values.length).toBe(2);
    expect((await execRA("σ[age >= 25](Person)"))[0].values.length).toBe(2);
  });

  it("σ with table.column references", async () => {
    const res = await execRA("σ[Person.age > 20](Person)");
    expect(res[0].values.length).toBe(2);
  });

  // ── Rename edge cases ──

  it("ρ with multiple rename mappings", async () => {
    const res = await execRA("ρ[name→fullName, age→years](Person)");
    expect(res[0].columns).toContain("fullName");
    expect(res[0].columns).toContain("years");
    expect(res[0].columns).not.toContain("name");
    expect(res[0].columns).not.toContain("age");
    expect(res[0].values.length).toBe(3);
  });

  it("ρ with ASCII arrow", async () => {
    const res = await execRA("rho[name->fullName](Person)");
    expect(res[0].columns).toContain("fullName");
  });

  // ── Outer joins ──

  it("rightjoin", async () => {
    const res = await execRA("Student rightjoin[age > hasDisability] Person");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  it("fulljoin", async () => {
    const res = await execRA("Person fulljoin[age > credits] Course");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  it("⟕ left outer join with Unicode", async () => {
    const res = await execRA("Person ⟕[age > credits] Course");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  it("left join preserves non-matching rows", async () => {
    // Carol (age 30) has no Student row — left join should keep her with NULLs
    const res = await execRA("Person leftjoin[Person.id = Student.id] Student");
    expect(res[0].values.length).toBe(3); // All 3 Person rows
  });

  // ── Semi-join edge cases ──

  it("⋊ right semi-join", async () => {
    const res = await execRA("Student ⋊ Person");
    // Student ids 1,2 both exist in Person — all Student rows match
    expect(res[0].values.length).toBe(2);
  });

  it("rightsemijoin keyword", async () => {
    const res = await execRA("Student rightsemijoin Person");
    expect(res[0].values.length).toBe(2);
  });

  it("leftsemijoin keyword", async () => {
    const res = await execRA("Person leftsemijoin Student");
    expect(res[0].values.length).toBe(2);
  });

  it("antijoin keyword", async () => {
    const res = await execRA("Person antijoin Student");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Carol");
  });

  // ── Sort edge cases ──

  it("τ with multiple sort columns", async () => {
    const res = await execRA("τ[city, age DESC](Person)");
    // Bristol(30), Stockholm(25), York(19)
    expect(res[0].values[0]).toContain("Carol");   // Bristol
    expect(res[0].values[1]).toContain("Alice");   // Stockholm
    expect(res[0].values[2]).toContain("Bob");     // York
  });

  it("sort keyword", async () => {
    const res = await execRA("sort[name](Person)");
    expect(res[0].values[0]).toContain("Alice");
    expect(res[0].values[2]).toContain("Carol");
  });

  // ── Aggregation edge cases ──

  it("γ with SUM", async () => {
    const res = await execRA("γ[city; SUM(age) AS totalAge](Person)");
    expect(res[0].columns).toContain("totalAge");
    expect(res[0].values.length).toBe(3);
  });

  it("γ with AVG", async () => {
    const res = await execRA("γ[city; AVG(age) AS avgAge](Person)");
    expect(res[0].columns).toContain("avgAge");
    expect(res[0].values.length).toBe(3);
  });

  it("γ with MIN and MAX", async () => {
    const res = await execRA("γ[city; MIN(age) AS youngest, MAX(age) AS oldest](Person)");
    expect(res[0].columns).toContain("youngest");
    expect(res[0].columns).toContain("oldest");
  });

  it("γ COUNT without alias", async () => {
    const res = await execRA("γ[city; COUNT(id)](Person)");
    expect(res[0].values.length).toBe(3);
  });

  it("gamma keyword", async () => {
    const res = await execRA("gamma[city; COUNT(id) AS cnt](Person)");
    expect(res[0].columns).toContain("cnt");
  });

  // ── Distinct edge cases ──

  it("delta keyword", async () => {
    const res = await execRA("delta(Person)");
    expect(res[0].values.length).toBe(3);
  });

  it("distinct keyword", async () => {
    const res = await execRA("distinct(Person)");
    expect(res[0].values.length).toBe(3);
  });

  it("δ without parens", async () => {
    const res = await execRA("δ Person");
    expect(res[0].values.length).toBe(3);
  });

  // ── Keyword variants for operators ──

  it("select keyword", async () => {
    const res = await execRA("select[age > 20](Person)");
    expect(res[0].values.length).toBe(2);
  });

  it("project keyword", async () => {
    const res = await execRA("project[name, city](Person)");
    expect(res[0].columns).toEqual(["name", "city"]);
  });

  it("cross keyword", async () => {
    const res = await execRA("Person cross Course");
    expect(res[0].values.length).toBe(6);
  });

  it("join keyword with condition", async () => {
    const res = await execRA("Person join[age > credits] Course");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  it("|X| as natural join", async () => {
    const res = await execRA("Person |X| Student");
    expect(res[0].values.length).toBe(2);
  });

  it("|><| as natural join", async () => {
    const res = await execRA("Person |><| Student");
    expect(res[0].values.length).toBe(2);
  });

  it("intersect keyword", async () => {
    const res = await execRA("π[name](Person) intersect π[name](Teacher)");
    expect(res.length === 0 || res[0].values.length === 0).toBe(true);
  });

  it("divide keyword", async () => {
    const res = await execRA("π[id, course_id](Enrollment) divide π[course_id](Course)");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain(1);
  });

  // ── Implicit subscripts edge cases ──

  it("ρ old→new (R) implicit", async () => {
    const res = await execRA("ρ name→fullName (Person)");
    expect(res[0].columns).toContain("fullName");
  });

  it("τ col (R) implicit", async () => {
    const res = await execRA("τ name (Person)");
    expect(res[0].values[0]).toContain("Alice");
  });

  it("σ compound implicit with AND", async () => {
    const res = await execRA("σ age > 20 and city = 'Stockholm' (Person)");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Alice");
  });

  it("nested implicit subscripts", async () => {
    const res = await execRA("π name (σ age > 20 (Person))");
    expect(res[0].columns).toEqual(["name"]);
    expect(res[0].values.length).toBe(2);
  });

  // ── Parenthesis-free edge cases ──

  it("triple chain without parens", async () => {
    const res = await execRA("π[name] σ[age > 20] δ Person");
    expect(res[0].columns).toEqual(["name"]);
    expect(res[0].values.length).toBe(2);
  });

  it("π[cols] over union with parens", async () => {
    const res = await execRA("π[name] (π[name](Person) ∪ π[name](Teacher))");
    expect(res[0].values.length).toBe(5);
  });

  // ── Assignment edge cases ──

  it("assignment with <- ASCII arrow", async () => {
    const res = await execRA("A <- σ[age > 20](Person)\nπ[name](A)");
    expect(res[0].values.length).toBe(2);
  });

  it("semicolons as statement separators", async () => {
    const res = await execRA("A ← Person; π[name](A)");
    expect(res[0].values.length).toBe(3);
  });

  it("comments in multi-line input", async () => {
    const res = await execRA("-- Get adults\nA ← σ[age > 20](Person)\n-- Project names\nπ[name](A)");
    expect(res[0].values.length).toBe(2);
  });

  it("implicit return from last assignment", async () => {
    const res = await execRA("A ← σ[age > 20](Person)");
    expect(res[0].values.length).toBe(2);
  });

  it("complex pipeline with reassignment", async () => {
    const res = await execRA("X ← Person ⋈ Student\nX ← σ[age > 20](X)\nX ← π[name](X)");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Alice");
  });
});
