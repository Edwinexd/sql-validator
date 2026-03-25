import { describe, it, expect, beforeAll, afterAll } from "vitest";
import initSqlJs, { type Database } from "sql.js";
import { raToSQL, RAError } from "./relationalAlgebra";

// ─── Helper ─────────────────────────────────────────────────────────────────

/** Normalize whitespace for comparison */
function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// ─── Basic table references ─────────────────────────────────────────────────

describe("table references", () => {
  it("should return a bare table name", () => {
    expect(raToSQL("Person")).toBe("Person");
  });

  it("should handle parenthesised table name", () => {
    expect(raToSQL("(Person)")).toBe("Person");
  });

  it("should handle trailing semicolon", () => {
    expect(raToSQL("Person;")).toBe("Person");
  });
});

// ─── Selection (σ) ──────────────────────────────────────────────────────────

describe("selection (σ)", () => {
  it("should transpile σ with Unicode symbol", () => {
    expect(norm(raToSQL("σ[age > 20](Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should transpile sigma keyword", () => {
    expect(norm(raToSQL("sigma[age > 20](Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should transpile select keyword", () => {
    expect(norm(raToSQL("select[age > 20](Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should handle string comparison", () => {
    expect(norm(raToSQL("σ[name = 'Alice'](Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE name = 'Alice'")
    );
  });

  it("should handle compound conditions with AND/OR", () => {
    const sql = raToSQL("σ[age > 20 and name = 'Alice'](Person)");
    expect(norm(sql)).toBe(
      norm("SELECT * FROM (Person) WHERE (age > 20 AND name = 'Alice')")
    );
  });

  it("should handle NOT condition", () => {
    const sql = raToSQL("σ[not age > 20](Person)");
    expect(norm(sql)).toBe(
      norm("SELECT * FROM (Person) WHERE NOT (age > 20)")
    );
  });

  it("should handle table.column references in conditions", () => {
    const sql = raToSQL("σ[Person.age > 20](Person)");
    expect(norm(sql)).toBe(
      norm("SELECT * FROM (Person) WHERE Person.age > 20")
    );
  });

  it("should handle nested OR and AND", () => {
    const sql = raToSQL("σ[age > 20 or (name = 'Alice' and city = 'Stockholm')](Person)");
    expect(norm(sql)).toContain("OR");
    expect(norm(sql)).toContain("AND");
  });

  it("should handle all comparison operators", () => {
    expect(norm(raToSQL("σ[a = 1](T)"))).toContain("= 1");
    expect(norm(raToSQL("σ[a <> 1](T)"))).toContain("<> 1");
    expect(norm(raToSQL("σ[a != 1](T)"))).toContain("<> 1");
    expect(norm(raToSQL("σ[a < 1](T)"))).toContain("< 1");
    expect(norm(raToSQL("σ[a > 1](T)"))).toContain("> 1");
    expect(norm(raToSQL("σ[a <= 1](T)"))).toContain("<= 1");
    expect(norm(raToSQL("σ[a >= 1](T)"))).toContain(">= 1");
  });

  it("should handle function calls in conditions", () => {
    const sql = raToSQL("σ[YEAR(startDate) = 2024](CourseInstance)");
    expect(norm(sql)).toBe(
      norm("SELECT * FROM (CourseInstance) WHERE YEAR(startDate) = 2024")
    );
  });
});

// ─── Projection (π) ─────────────────────────────────────────────────────────

describe("projection (π)", () => {
  it("should transpile π with Unicode", () => {
    expect(norm(raToSQL("π[name, age](Person)"))).toBe(
      norm("SELECT name, age FROM (Person)")
    );
  });

  it("should transpile pi keyword", () => {
    expect(norm(raToSQL("pi[name](Person)"))).toBe(
      norm("SELECT name FROM (Person)")
    );
  });

  it("should transpile project keyword", () => {
    expect(norm(raToSQL("project[name, city](Person)"))).toBe(
      norm("SELECT name, city FROM (Person)")
    );
  });

  it("should handle table.column references", () => {
    expect(norm(raToSQL("π[Person.name](Person)"))).toBe(
      norm("SELECT Person.name FROM (Person)")
    );
  });
});

// ─── Rename (ρ) ─────────────────────────────────────────────────────────────

describe("rename (ρ)", () => {
  it("should transpile ρ with Unicode arrow", () => {
    expect(norm(raToSQL("ρ[name→fullName](Person)"))).toBe(
      norm("SELECT name AS fullName FROM (Person)")
    );
  });

  it("should transpile rho with ASCII arrow", () => {
    expect(norm(raToSQL("rho[name->fullName](Person)"))).toBe(
      norm("SELECT name AS fullName FROM (Person)")
    );
  });

  it("should handle multiple rename mappings", () => {
    const sql = raToSQL("ρ[name→fullName, age→years](Person)");
    expect(norm(sql)).toBe(
      norm("SELECT name AS fullName, age AS years FROM (Person)")
    );
  });
});

// ─── Cross product (×) ─────────────────────────────────────────────────────

describe("cross product (×)", () => {
  it("should transpile × operator", () => {
    const sql = raToSQL("Person × Course");
    expect(norm(sql)).toContain("CROSS JOIN");
  });

  it("should transpile cross keyword", () => {
    const sql = raToSQL("Person cross Course");
    expect(norm(sql)).toContain("CROSS JOIN");
  });
});

// ─── Natural join (⋈) ──────────────────────────────────────────────────────

describe("natural join (⋈)", () => {
  it("should transpile ⋈ operator", () => {
    const sql = raToSQL("Person ⋈ Student");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should transpile natjoin keyword", () => {
    const sql = raToSQL("Person natjoin Student");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should error on impossible natural join when database is provided", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE TableA (id INTEGER, name TEXT)");
    db.run("CREATE TABLE TableB (code TEXT, description TEXT)");

    expect(() => raToSQL("TableA ⋈ TableB", db)).toThrow(RAError);
    expect(() => raToSQL("TableA ⋈ TableB", db)).toThrow(/no common columns/i);
    db.close();
  });

  it("should not error on valid natural join when database is provided", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE Person (id INTEGER, name TEXT, city TEXT)");
    db.run("CREATE TABLE Student (id INTEGER, hasDisability INTEGER)");

    expect(() => raToSQL("Person ⋈ Student", db)).not.toThrow();
    db.close();
  });

  it("should error on natural join with non-existent table", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE Person (id INTEGER, name TEXT)");

    expect(() => raToSQL("Person ⋈ Room", db)).toThrow(RAError);
    expect(() => raToSQL("Person ⋈ Room", db)).toThrow(/Room/);
    db.close();
  });

  it("should error on natural join with no common columns through subquery", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE Person (person_id INTEGER, name TEXT, city TEXT)");
    db.run("CREATE TABLE Room (room_id INTEGER, building TEXT, capacity INTEGER)");

    expect(() => raToSQL("σ[city = 'York'](Person) ⋈ Room", db)).toThrow(RAError);
    expect(() => raToSQL("σ[city = 'York'](Person) ⋈ Room", db)).toThrow(/no common columns/i);
    db.close();
  });

  it("should not error when no database is provided (parse-only mode)", () => {
    expect(() => raToSQL("TableA ⋈ TableB")).not.toThrow();
  });

  it("should support |X| as natural join", () => {
    const sql = raToSQL("Person |X| Student");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should support |><| as natural join", () => {
    const sql = raToSQL("Person |><| Student");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });
});

// ─── Theta join (⋈[cond]) ──────────────────────────────────────────────────

describe("theta join (⋈[cond])", () => {
  it("should transpile ⋈ with condition", () => {
    const sql = raToSQL("Person ⋈[Person.id = Student.id] Student");
    expect(norm(sql)).toContain("JOIN");
    expect(norm(sql)).toContain("ON Person.id = Student.id");
    expect(norm(sql)).not.toContain("NATURAL");
  });

  it("should transpile join keyword with condition", () => {
    const sql = raToSQL("Person join[Person.id = Student.id] Student");
    expect(norm(sql)).toContain("JOIN");
    expect(norm(sql)).toContain("ON Person.id = Student.id");
  });
});

// ─── Set operations ─────────────────────────────────────────────────────────

describe("set operations", () => {
  it("should transpile union with ∪", () => {
    const sql = raToSQL("π[name](Person) ∪ π[name](Teacher)");
    expect(norm(sql)).toContain("UNION");
  });

  it("should transpile union keyword", () => {
    const sql = raToSQL("π[name](Person) union π[name](Teacher)");
    expect(norm(sql)).toContain("UNION");
  });

  it("should transpile intersect with ∩", () => {
    const sql = raToSQL("π[name](Person) ∩ π[name](Teacher)");
    expect(norm(sql)).toContain("INTERSECT");
  });

  it("should transpile difference with −", () => {
    const sql = raToSQL("π[name](Person) − π[name](Teacher)");
    expect(norm(sql)).toContain("EXCEPT");
  });

  it("should transpile minus keyword", () => {
    const sql = raToSQL("π[name](Person) minus π[name](Teacher)");
    expect(norm(sql)).toContain("EXCEPT");
  });

  it("should transpile backslash as set difference", () => {
    const sql = raToSQL("A \\ B");
    expect(norm(sql)).toContain("EXCEPT");
  });

  it("should generate valid SQL for bare table set operations", () => {
    // Set ops need SELECT statements on both sides, not bare table names
    const unionSql = norm(raToSQL("A union B"));
    expect(unionSql).toMatch(/SELECT \* FROM A\s+UNION\s+SELECT \* FROM B/i);

    const exceptSql = norm(raToSQL("A minus B"));
    expect(exceptSql).toMatch(/SELECT \* FROM A\s+EXCEPT\s+SELECT \* FROM B/i);

    const intersectSql = norm(raToSQL("A intersect B"));
    expect(intersectSql).toMatch(/SELECT \* FROM A\s+INTERSECT\s+SELECT \* FROM B/i);
  });

  it("should handle set difference with hyphenated expression", () => {
    const sql = raToSQL("PI[name, city](Person - Teacher)");
    expect(norm(sql)).toContain("EXCEPT");
    expect(norm(sql)).toContain("SELECT name, city");
  });

  it("should error on union-incompatible column counts when database is provided", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE A (x INTEGER, y TEXT)");
    db.run("CREATE TABLE B (x INTEGER, y TEXT, z TEXT)");

    expect(() => raToSQL("A union B", db)).toThrow(RAError);
    expect(() => raToSQL("A union B", db)).toThrow(/same number of columns/i);
    expect(() => raToSQL("A minus B", db)).toThrow(RAError);
    expect(() => raToSQL("A intersect B", db)).toThrow(RAError);

    // Should NOT throw when column counts match
    db.run("CREATE TABLE C (a INTEGER, b TEXT)");
    expect(() => raToSQL("A union C", db)).not.toThrow();
    db.close();
  });

  it("should include column names in union-incompatible error message", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE R1 (name TEXT, city TEXT)");
    db.run("CREATE TABLE R2 (name TEXT, city TEXT, age INTEGER)");

    expect(() => raToSQL("R1 union R2", db)).toThrow(/Left has 2/);
    expect(() => raToSQL("R1 union R2", db)).toThrow(/right has 3/);
    db.close();
  });
});

// ─── Outer joins ────────────────────────────────────────────────────────────

describe("outer joins", () => {
  it("should transpile left outer join", () => {
    const sql = raToSQL("Person leftjoin[Person.id = Student.id] Student");
    expect(norm(sql)).toContain("LEFT JOIN");
    expect(norm(sql)).toContain("ON Person.id = Student.id");
  });

  it("should transpile right outer join", () => {
    const sql = raToSQL("Person rightjoin[Person.id = Student.id] Student");
    expect(norm(sql)).toContain("RIGHT JOIN");
  });

  it("should transpile full outer join", () => {
    const sql = raToSQL("Person fulljoin[Person.id = Student.id] Student");
    expect(norm(sql)).toContain("FULL OUTER JOIN");
  });

  it("should transpile left outer join with Unicode ⟕", () => {
    const sql = raToSQL("Person ⟕[Person.id = Student.id] Student");
    expect(norm(sql)).toContain("LEFT JOIN");
  });
});

// ─── Semi-joins and anti-join ───────────────────────────────────────────────

describe("semi-joins and anti-join", () => {
  it("should transpile left semi-join", () => {
    const sql = raToSQL("Person leftsemijoin Student");
    expect(norm(sql)).toContain("WHERE EXISTS");
  });

  it("should transpile left semi-join with ⋉", () => {
    const sql = raToSQL("Person ⋉ Student");
    expect(norm(sql)).toContain("WHERE EXISTS");
  });

  it("should transpile right semi-join", () => {
    const sql = raToSQL("Person rightsemijoin Student");
    expect(norm(sql)).toContain("WHERE EXISTS");
  });

  it("should transpile anti-join", () => {
    const sql = raToSQL("Person antijoin Student");
    expect(norm(sql)).toContain("WHERE NOT EXISTS");
  });

  it("should transpile anti-join with ▷", () => {
    const sql = raToSQL("Person ▷ Student");
    expect(norm(sql)).toContain("WHERE NOT EXISTS");
  });
});

// ─── Division (÷) ──────────────────────────────────────────────────────────

describe("division (÷)", () => {
  it("should transpile ÷ operator", () => {
    const sql = raToSQL("A ÷ B");
    expect(norm(sql)).toContain("NOT EXISTS");
  });

  it("should transpile divide keyword", () => {
    const sql = raToSQL("A divide B");
    expect(norm(sql)).toContain("NOT EXISTS");
  });
});

// ─── Distinct (δ) ──────────────────────────────────────────────────────────

describe("distinct (δ)", () => {
  it("should transpile δ", () => {
    expect(norm(raToSQL("δ(Person)"))).toBe(
      norm("SELECT DISTINCT * FROM (Person)")
    );
  });

  it("should transpile delta keyword", () => {
    expect(norm(raToSQL("delta(Person)"))).toBe(
      norm("SELECT DISTINCT * FROM (Person)")
    );
  });

  it("should transpile distinct keyword", () => {
    expect(norm(raToSQL("distinct(Person)"))).toBe(
      norm("SELECT DISTINCT * FROM (Person)")
    );
  });
});

// ─── Sorting (τ) ────────────────────────────────────────────────────────────

describe("sorting (τ)", () => {
  it("should transpile τ with single column", () => {
    const sql = raToSQL("τ[name](Person)");
    expect(norm(sql)).toBe(
      norm("SELECT * FROM (Person) ORDER BY name")
    );
  });

  it("should transpile τ with DESC", () => {
    const sql = raToSQL("τ[age DESC](Person)");
    expect(norm(sql)).toBe(
      norm("SELECT * FROM (Person) ORDER BY age DESC")
    );
  });

  it("should transpile sort keyword", () => {
    const sql = raToSQL("sort[name](Person)");
    expect(norm(sql)).toContain("ORDER BY name");
  });

  it("should handle multiple sort columns", () => {
    const sql = raToSQL("τ[name, age DESC](Person)");
    expect(norm(sql)).toContain("ORDER BY name, age DESC");
  });
});

// ─── Grouping/Aggregation (γ) ──────────────────────────────────────────────

describe("grouping/aggregation (γ)", () => {
  it("should transpile γ with group-by and aggregate", () => {
    const sql = raToSQL("γ[city; COUNT(id)](Person)");
    expect(norm(sql)).toContain("COUNT(id)");
    expect(norm(sql)).toContain("GROUP BY city");
  });

  it("should handle aggregate with alias", () => {
    const sql = raToSQL("γ[city; COUNT(id) AS total](Person)");
    expect(norm(sql)).toContain("COUNT(id) AS total");
    expect(norm(sql)).toContain("GROUP BY city");
  });

  it("should transpile gamma keyword", () => {
    const sql = raToSQL("gamma[city; SUM(price) AS totalPrice](Course)");
    expect(norm(sql)).toContain("SUM(price) AS totalPrice");
    expect(norm(sql)).toContain("GROUP BY city");
  });
});

// ─── Composition / nesting ──────────────────────────────────────────────────

describe("composition and nesting", () => {
  it("should handle projection of selection", () => {
    const sql = raToSQL("π[name](σ[age > 20](Person))");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("WHERE age > 20");
  });

  it("should handle selection of join", () => {
    const sql = raToSQL("σ[age > 20](Person ⋈ Student)");
    expect(norm(sql)).toContain("WHERE age > 20");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should handle complex nested expression", () => {
    const sql = raToSQL("π[name](σ[city = 'Stockholm'](Person ⋈ Student))");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("WHERE city = 'Stockholm'");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should handle parenthesised subexpressions", () => {
    const sql = raToSQL("(Person ⋈ Student) ∪ (Person ⋈ Teacher)");
    expect(norm(sql)).toContain("UNION");
    expect(norm(sql).match(/NATURAL JOIN/g)?.length).toBe(2);
  });

  it("should handle deeply nested expressions", () => {
    const sql = raToSQL("π[name](σ[age > 20](ρ[id→personId](Person)))");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("WHERE age > 20");
    expect(norm(sql)).toContain("id AS personId");
  });
});

// ─── Operator precedence ───────────────────────────────────────────────────

describe("operator precedence", () => {
  it("should bind join tighter than union", () => {
    // A ⋈ B ∪ C should be (A ⋈ B) ∪ C, not A ⋈ (B ∪ C)
    const sql = raToSQL("A ⋈ B ∪ C");
    // The NATURAL JOIN should come before UNION in the SQL
    expect(norm(sql)).toMatch(/NATURAL JOIN.*UNION/);
  });

  it("should bind intersect tighter than union", () => {
    const sql = raToSQL("A ∪ B ∩ C");
    // B ∩ C should be grouped together
    expect(norm(sql)).toContain("INTERSECT");
    expect(norm(sql)).toContain("UNION");
  });
});

// ─── Error handling ─────────────────────────────────────────────────────────

describe("error handling", () => {
  it("should throw RAError on empty input", () => {
    expect(() => raToSQL("")).toThrow(RAError);
  });

  it("should throw RAError on invalid syntax", () => {
    expect(() => raToSQL("σ[](Person)")).toThrow(RAError);
  });

  it("should throw RAError on unclosed bracket", () => {
    expect(() => raToSQL("σ[age > 20(Person)")).toThrow(RAError);
  });

  it("should throw RAError on unexpected token after expression", () => {
    expect(() => raToSQL("Person Student")).toThrow(RAError);
  });

  it("should throw RAError on unterminated string", () => {
    expect(() => raToSQL("σ[name = 'Alice](Person)")).toThrow(RAError);
  });

  it("should throw RAError on missing condition in selection", () => {
    expect(() => raToSQL("σ(Person)")).toThrow(RAError);
  });

  it("should throw RAError on missing relation for selection", () => {
    expect(() => raToSQL("σ[age > 20]")).toThrow(RAError);
  });
});

// ─── Multi-line / assignments (←) ──────────────────────────────────────────

describe("multi-line and assignments", () => {
  it("should handle simple assignment with ←", () => {
    const sql = raToSQL("A ← Person\nA");
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
  });

  it("should handle simple assignment with <-", () => {
    const sql = raToSQL("A <- Person\nA");
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
  });

  it("should handle assignment with complex expression", () => {
    const sql = raToSQL("Students ← σ[age > 20](Person)\nπ[name](Students)");
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("Students AS");
    expect(norm(sql)).toContain("WHERE age > 20");
    expect(norm(sql)).toContain("SELECT name FROM");
  });

  it("should handle multiple assignments", () => {
    const input = [
      "A ← σ[city = 'Stockholm'](Person)",
      "B ← π[name](A)",
      "B",
    ].join("\n");
    const sql = raToSQL(input);
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
    expect(norm(sql)).toContain("B AS");
    expect(norm(sql)).toContain("WHERE city = 'Stockholm'");
    expect(norm(sql)).toContain("SELECT name FROM");
  });

  it("should handle assignment chaining with joins", () => {
    const input = [
      "PS ← Person ⋈ Student",
      "Result ← π[name](PS)",
      "Result",
    ].join("\n");
    const sql = raToSQL(input);
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("PS AS");
    expect(norm(sql)).toContain("NATURAL JOIN");
    expect(norm(sql)).toContain("Result AS");
  });

  it("should handle semicolons as statement separators", () => {
    const sql = raToSQL("A ← Person; π[name](A)");
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
    expect(norm(sql)).toContain("SELECT name FROM");
  });

  it("should handle mixed newlines and semicolons", () => {
    const input = "A ← Person;\nB ← Student\nA ⋈ B";
    const sql = raToSQL(input);
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
    expect(norm(sql)).toContain("B AS");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should still work with single-line expressions (no assignments)", () => {
    // No regression — single-line without assignment should work as before
    expect(raToSQL("Person")).toBe("Person");
    expect(norm(raToSQL("π[name](Person)"))).toBe(
      norm("SELECT name FROM (Person)")
    );
  });

  it("should handle -- comments in multi-line input", () => {
    const input = [
      "-- First get students",
      "A ← σ[age > 20](Person)",
      "-- Then project names",
      "π[name](A)",
    ].join("\n");
    const sql = raToSQL(input);
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
    expect(norm(sql)).toContain("WHERE age > 20");
    expect(norm(sql)).toContain("SELECT name FROM");
  });

  it("should handle trailing newlines", () => {
    const sql = raToSQL("Person\n\n\n");
    expect(sql).toBe("Person");
  });

  it("should handle leading newlines", () => {
    const sql = raToSQL("\n\n\nPerson");
    expect(sql).toBe("Person");
  });

  it("should handle the student example: A <- pi[student](sigma[name='peter'](P))", () => {
    const input = "A <- π[student](σ[name = 'Peter'](Participation))\nA";
    const sql = raToSQL(input);
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("A AS");
    expect(norm(sql)).toContain("SELECT student FROM");
    expect(norm(sql)).toContain("WHERE name = 'Peter'");
  });
});

// ─── Alternative notation styles ────────────────────────────────────────────

describe("curly braces (LaTeX-style)", () => {
  it("should support σ_{condition}(R)", () => {
    expect(norm(raToSQL("σ_{age > 20}(Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should support π_{cols}(R)", () => {
    expect(norm(raToSQL("π_{name, city}(Person)"))).toBe(
      norm("SELECT name, city FROM (Person)")
    );
  });

  it("should support ρ_{old→new}(R)", () => {
    expect(norm(raToSQL("ρ_{name→fullName}(Person)"))).toBe(
      norm("SELECT name AS fullName FROM (Person)")
    );
  });

  it("should support curly braces without underscore", () => {
    expect(norm(raToSQL("σ{age > 20}(Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should support theta join with curly braces", () => {
    const sql = raToSQL("Person ⋈{Person.id = Student.id} Student");
    expect(norm(sql)).toContain("JOIN");
    expect(norm(sql)).toContain("ON Person.id = Student.id");
  });
});

describe("implicit subscripts (no brackets)", () => {
  it("should support σ condition (R)", () => {
    expect(norm(raToSQL("σ age > 20 (Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should support π cols (R)", () => {
    expect(norm(raToSQL("π name, city (Person)"))).toBe(
      norm("SELECT name, city FROM (Person)")
    );
  });

  it("should support sigma condition (R) with keyword", () => {
    expect(norm(raToSQL("sigma age > 20 (Person)"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should support pi cols (R) with keyword", () => {
    expect(norm(raToSQL("pi name (Person)"))).toBe(
      norm("SELECT name FROM (Person)")
    );
  });

  it("should support ρ old→new (R) implicit", () => {
    expect(norm(raToSQL("ρ name→fullName (Person)"))).toBe(
      norm("SELECT name AS fullName FROM (Person)")
    );
  });

  it("should support τ col (R) implicit", () => {
    expect(norm(raToSQL("τ name (Person)"))).toContain("ORDER BY name");
  });

  it("should support nested implicit subscripts", () => {
    const sql = raToSQL("π name (σ age > 20 (Person))");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("WHERE age > 20");
  });

  it("should support compound implicit condition with AND", () => {
    const sql = raToSQL("σ age > 20 and city = 'Stockholm' (Person)");
    expect(norm(sql)).toContain("WHERE");
    expect(norm(sql)).toContain("AND");
    expect(norm(sql)).toContain("age > 20");
  });

  it("should work with multi-line and implicit subscripts", () => {
    const input = [
      "A <- σ age > 20 (Person)",
      "π name (A)",
    ].join("\n");
    const sql = raToSQL(input);
    expect(norm(sql)).toContain("WITH");
    expect(norm(sql)).toContain("WHERE age > 20");
    expect(norm(sql)).toContain("SELECT name FROM");
  });
});

describe("parenthesis-free syntax", () => {
  it("should allow σ[cond] Table without parens", () => {
    expect(norm(raToSQL("σ[age > 20] Person"))).toBe(
      norm("SELECT * FROM (Person) WHERE age > 20")
    );
  });

  it("should allow π[cols] Table without parens", () => {
    expect(norm(raToSQL("π[name] Person"))).toBe(
      norm("SELECT name FROM (Person)")
    );
  });

  it("should allow chained unary ops without parens", () => {
    const sql = raToSQL("π[name] σ[age > 20] Person");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("WHERE age > 20");
  });

  it("should handle the user's example without excessive parens", () => {
    const sql = raToSQL("π[person_id, name, city] σ[city = 'York' OR city = 'Bristol'] Person");
    expect(norm(sql)).toContain("SELECT person_id, name, city FROM");
    expect(norm(sql)).toContain("WHERE");
    expect(norm(sql)).toContain("city = 'York'");
    expect(norm(sql)).toContain("city = 'Bristol'");
  });

  it("should still work with parens for grouping binary ops", () => {
    const sql = raToSQL("π[name] (Person ∪ Student)");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("UNION");
  });

  it("should allow δ Table without parens", () => {
    expect(norm(raToSQL("δ Person"))).toContain("SELECT DISTINCT");
  });

  it("should allow triple chain without parens", () => {
    const sql = raToSQL("π[name] σ[age > 20] ρ[n→name] Person");
    expect(norm(sql)).toContain("SELECT name FROM");
    expect(norm(sql)).toContain("WHERE age > 20");
    expect(norm(sql)).toContain("n AS name");
  });
});

describe("implicit return from last assignment", () => {
  it("should return last assigned variable when no explicit result", () => {
    const sql = raToSQL("A <- σ[age > 20](Person)");
    expect(norm(sql)).toContain("WITH A AS");
    expect(norm(sql)).toContain("SELECT * FROM A");
  });

  it("should return last variable with multiple assignments", () => {
    const sql = raToSQL("A <- σ[age > 20](Person)\nB <- π[name](A)");
    expect(norm(sql)).toContain("SELECT * FROM B");
  });

  it("should still work when explicit result is given", () => {
    const sql = raToSQL("A <- σ[age > 20](Person)\nA");
    expect(norm(sql)).toContain("SELECT * FROM A");
  });

  it("should handle self-referential A <- A as a no-op", () => {
    const sql = raToSQL("A <- A");
    expect(norm(sql)).toBe(norm("SELECT * FROM A"));
  });

  it("should handle variable reassignment with versioned CTE names", () => {
    const sql = raToSQL("A <- σ[age > 20](Person)\nA <- π[name](A)\nA");
    expect(norm(sql)).toContain("WITH A AS");
    expect(norm(sql)).toContain("A_v2 AS");
    expect(norm(sql)).toContain("SELECT * FROM A_v2");
  });

  it("should handle triple reassignment", () => {
    const sql = raToSQL("X <- Person\nX <- σ[age > 20](X)\nX <- π[name](X)");
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
  function execRA(expr: string): initSqlJs.QueryExecResult[] {
    const sql = raToSQL(expr, db);
    return db.exec(sql);
  }

  // ── Selection ──

  it("σ with condition", () => {
    const res = execRA("σ[age > 20](Person)");
    expect(res[0].values.length).toBe(2); // Alice (25) and Carol (30)
  });

  it("σ with string comparison", () => {
    const res = execRA("σ[name = 'Alice'](Person)");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Alice");
  });

  it("σ with compound condition", () => {
    const res = execRA("σ[age > 20 and city = 'Stockholm'](Person)");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Alice");
  });

  // ── Projection ──

  it("π selects columns", () => {
    const res = execRA("π[name, city](Person)");
    expect(res[0].columns).toEqual(["name", "city"]);
    expect(res[0].values.length).toBe(3);
  });

  // ── Rename ──

  it("ρ renames columns", () => {
    const res = execRA("ρ[name→fullName](Person)");
    expect(res[0].columns).toContain("fullName");
    expect(res[0].columns).not.toContain("name");
  });

  // ── Natural join ──

  it("⋈ natural join", () => {
    const res = execRA("Person ⋈ Student");
    expect(res[0].values.length).toBe(2); // ids 1 and 2 match
  });

  it("natjoin keyword", () => {
    const res = execRA("Person natjoin Student");
    expect(res[0].values.length).toBe(2);
  });

  // ── Cross product ──

  it("× cross product", () => {
    const res = execRA("Person × Course");
    expect(res[0].values.length).toBe(6); // 3 × 2
  });

  // ── Theta join ──

  it("⋈[cond] theta join", () => {
    // Use unqualified column names since the generator aliases tables as _raN
    const res = execRA("Person ⋈[age > credits] Course");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  // ── Set operations ──

  it("∪ union", () => {
    const res = execRA("π[name](Person) ∪ π[name](Teacher)");
    expect(res[0].values.length).toBe(5); // 3 + 2, all distinct names
  });

  it("∩ intersect", () => {
    // No overlapping names between Person and Teacher
    const res = execRA("π[name](Person) ∩ π[name](Teacher)");
    expect(res.length === 0 || res[0].values.length === 0).toBe(true);
  });

  it("− set difference", () => {
    const res = execRA("π[name](Person) − π[name](Teacher)");
    expect(res[0].values.length).toBe(3); // All Person names, none overlap
  });

  it("minus keyword", () => {
    const res = execRA("π[name](Person) minus π[name](Teacher)");
    expect(res[0].values.length).toBe(3);
  });

  it("bare table set difference (Person - Teacher)", () => {
    // Person and Teacher are union-compatible (both have id, name, age, city)
    // but Teacher has an extra column (department) — use projections
    const res = execRA("π[id, name](Person) − π[id, name](Teacher)");
    expect(res[0].values.length).toBe(3);
  });

  it("set difference with hyphen syntax", () => {
    const res = execRA("π[name, city](Person) - π[name, city](Teacher)");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  it("errors on union-incompatible set operations", () => {
    // Person has 4 cols (id, name, age, city), Course has 3 cols (course_id, title, credits)
    expect(() => execRA("Person union Course")).toThrow(RAError);
    expect(() => execRA("Person union Course")).toThrow(/same number of columns/i);
    expect(() => execRA("Person minus Course")).toThrow(RAError);
    expect(() => execRA("Person intersect Course")).toThrow(RAError);
  });

  it("backslash set difference", () => {
    const res = execRA("π[name](Person) \\ π[name](Teacher)");
    expect(res[0].values.length).toBe(3);
  });

  // ── Outer joins ──

  it("leftjoin", () => {
    // Use unqualified column names since the generator aliases tables as _raN
    const res = execRA("Person leftjoin[age > credits] Course");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  // ── Semi-join ──

  it("⋉ left semi-join returns only matching rows", () => {
    const res = execRA("Person ⋉ Student");
    // Person ids 1,2,3 — Student ids 1,2 — semi-join on common col "id"
    expect(res[0].values.length).toBe(2);
  });

  // ── Anti-join ──

  it("▷ anti-join returns only non-matching rows", () => {
    const res = execRA("Person ▷ Student");
    // Only Carol (id=3) has no matching Student row
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Carol");
  });

  // ── Distinct ──

  it("δ distinct", () => {
    const res = execRA("δ(Person)");
    expect(res[0].values.length).toBe(3);
  });

  // ── Sort ──

  it("τ sort", () => {
    const res = execRA("τ[name](Person)");
    expect(res[0].values[0]).toContain("Alice");
    expect(res[0].values[2]).toContain("Carol");
  });

  it("τ sort DESC", () => {
    const res = execRA("τ[age DESC](Person)");
    expect(res[0].values[0]).toContain("Carol"); // age 30, highest
  });

  // ── Grouping / aggregation ──

  it("γ group by with COUNT", () => {
    const res = execRA("γ[city; COUNT(id) AS cnt](Person)");
    expect(res[0].columns).toContain("cnt");
    expect(res[0].values.length).toBe(3); // 3 distinct cities
  });

  // ── Division ──

  it("÷ division returns correct result", () => {
    // Enrollment: (1,100),(1,101),(2,100) — Course: (100),(101)
    // Only id=1 is enrolled in ALL courses
    const res = execRA("π[id, course_id](Enrollment) ÷ π[course_id](Course)");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain(1); // id=1 (Alice)
  });

  // ── Composition / nesting ──

  it("π of σ", () => {
    const res = execRA("π[name](σ[age > 20](Person))");
    expect(res[0].columns).toEqual(["name"]);
    expect(res[0].values.length).toBe(2);
  });

  it("σ of ⋈", () => {
    const res = execRA("σ[age > 20](Person ⋈ Student)");
    expect(res[0].values.length).toBe(1); // Only Alice (25) matches
  });

  it("deeply nested", () => {
    const res = execRA("π[name](σ[city = 'Stockholm'](Person ⋈ Student))");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Alice");
  });

  // ── Parenthesis-free syntax ──

  it("σ[cond] Table without parens", () => {
    const res = execRA("σ[age > 20] Person");
    expect(res[0].values.length).toBe(2);
  });

  it("π[cols] σ[cond] Table chained", () => {
    const res = execRA("π[name] σ[age > 20] Person");
    expect(res[0].columns).toEqual(["name"]);
    expect(res[0].values.length).toBe(2);
  });

  // ── Implicit subscripts ──

  it("σ cond (R) implicit", () => {
    const res = execRA("σ age > 20 (Person)");
    expect(res[0].values.length).toBe(2);
  });

  it("π cols (R) implicit", () => {
    const res = execRA("π name, city (Person)");
    expect(res[0].columns).toEqual(["name", "city"]);
  });

  // ── Assignments ──

  it("single assignment", () => {
    const res = execRA("A ← σ[age > 20](Person)\nπ[name](A)");
    expect(res[0].values.length).toBe(2);
  });

  it("multiple assignments", () => {
    const res = execRA("A ← σ[city = 'Stockholm'](Person)\nB ← π[name](A)\nB");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Alice");
  });

  it("variable reassignment", () => {
    const res = execRA("X ← Person\nX ← σ[age > 20](X)\nX ← π[name](X)");
    expect(res[0].values.length).toBe(2);
  });

  // ── LaTeX-style curly braces ──

  it("σ_{cond}(R)", () => {
    const res = execRA("σ_{age > 20}(Person)");
    expect(res[0].values.length).toBe(2);
  });

  it("π_{cols}(R)", () => {
    const res = execRA("π_{name, city}(Person)");
    expect(res[0].columns).toEqual(["name", "city"]);
  });

  it("ρ_{old→new}(R)", () => {
    const res = execRA("ρ_{name→fullName}(Person)");
    expect(res[0].columns).toContain("fullName");
    expect(res[0].columns).not.toContain("name");
  });

  it("σ{cond}(R) without underscore", () => {
    const res = execRA("σ{age > 20}(Person)");
    expect(res[0].values.length).toBe(2);
  });

  it("⋈{cond} theta join with curly braces", () => {
    const res = execRA("Person ⋈{age > credits} Course");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  // ── Selection edge cases ──

  it("σ with OR condition", () => {
    const res = execRA("σ[city = 'Stockholm' or city = 'York'](Person)");
    expect(res[0].values.length).toBe(2); // Alice and Bob
  });

  it("σ with NOT condition", () => {
    const res = execRA("σ[not age > 20](Person)");
    expect(res[0].values.length).toBe(1); // Only Bob (19)
    expect(res[0].values[0]).toContain("Bob");
  });

  it("σ with nested OR and AND", () => {
    const res = execRA("σ[age > 20 or (name = 'Bob' and city = 'York')](Person)");
    expect(res[0].values.length).toBe(3); // Alice, Bob, Carol
  });

  it("σ with all comparison operators", () => {
    expect(execRA("σ[age = 25](Person)")[0].values.length).toBe(1);
    expect(execRA("σ[age <> 25](Person)")[0].values.length).toBe(2);
    expect(execRA("σ[age != 25](Person)")[0].values.length).toBe(2);
    expect(execRA("σ[age < 25](Person)")[0].values.length).toBe(1);
    expect(execRA("σ[age > 25](Person)")[0].values.length).toBe(1);
    expect(execRA("σ[age <= 25](Person)")[0].values.length).toBe(2);
    expect(execRA("σ[age >= 25](Person)")[0].values.length).toBe(2);
  });

  it("σ with table.column references", () => {
    const res = execRA("σ[Person.age > 20](Person)");
    expect(res[0].values.length).toBe(2);
  });

  // ── Rename edge cases ──

  it("ρ with multiple rename mappings", () => {
    const res = execRA("ρ[name→fullName, age→years](Person)");
    expect(res[0].columns).toContain("fullName");
    expect(res[0].columns).toContain("years");
    expect(res[0].columns).not.toContain("name");
    expect(res[0].columns).not.toContain("age");
    expect(res[0].values.length).toBe(3);
  });

  it("ρ with ASCII arrow", () => {
    const res = execRA("rho[name->fullName](Person)");
    expect(res[0].columns).toContain("fullName");
  });

  // ── Outer joins ──

  it("rightjoin", () => {
    const res = execRA("Student rightjoin[age > hasDisability] Person");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  it("fulljoin", () => {
    const res = execRA("Person fulljoin[age > credits] Course");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  it("⟕ left outer join with Unicode", () => {
    const res = execRA("Person ⟕[age > credits] Course");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  it("left join preserves non-matching rows", () => {
    // Carol (age 30) has no Student row — left join should keep her with NULLs
    const res = execRA("Person leftjoin[Person.id = Student.id] Student");
    expect(res[0].values.length).toBe(3); // All 3 Person rows
  });

  // ── Semi-join edge cases ──

  it("⋊ right semi-join", () => {
    const res = execRA("Student ⋊ Person");
    // Student ids 1,2 both exist in Person — all Student rows match
    expect(res[0].values.length).toBe(2);
  });

  it("rightsemijoin keyword", () => {
    const res = execRA("Student rightsemijoin Person");
    expect(res[0].values.length).toBe(2);
  });

  it("leftsemijoin keyword", () => {
    const res = execRA("Person leftsemijoin Student");
    expect(res[0].values.length).toBe(2);
  });

  it("antijoin keyword", () => {
    const res = execRA("Person antijoin Student");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Carol");
  });

  // ── Sort edge cases ──

  it("τ with multiple sort columns", () => {
    const res = execRA("τ[city, age DESC](Person)");
    // Bristol(30), Stockholm(25), York(19)
    expect(res[0].values[0]).toContain("Carol");   // Bristol
    expect(res[0].values[1]).toContain("Alice");   // Stockholm
    expect(res[0].values[2]).toContain("Bob");     // York
  });

  it("sort keyword", () => {
    const res = execRA("sort[name](Person)");
    expect(res[0].values[0]).toContain("Alice");
    expect(res[0].values[2]).toContain("Carol");
  });

  // ── Aggregation edge cases ──

  it("γ with SUM", () => {
    const res = execRA("γ[city; SUM(age) AS totalAge](Person)");
    expect(res[0].columns).toContain("totalAge");
    expect(res[0].values.length).toBe(3);
  });

  it("γ with AVG", () => {
    const res = execRA("γ[city; AVG(age) AS avgAge](Person)");
    expect(res[0].columns).toContain("avgAge");
    expect(res[0].values.length).toBe(3);
  });

  it("γ with MIN and MAX", () => {
    const res = execRA("γ[city; MIN(age) AS youngest, MAX(age) AS oldest](Person)");
    expect(res[0].columns).toContain("youngest");
    expect(res[0].columns).toContain("oldest");
  });

  it("γ COUNT without alias", () => {
    const res = execRA("γ[city; COUNT(id)](Person)");
    expect(res[0].values.length).toBe(3);
  });

  it("gamma keyword", () => {
    const res = execRA("gamma[city; COUNT(id) AS cnt](Person)");
    expect(res[0].columns).toContain("cnt");
  });

  // ── Distinct edge cases ──

  it("delta keyword", () => {
    const res = execRA("delta(Person)");
    expect(res[0].values.length).toBe(3);
  });

  it("distinct keyword", () => {
    const res = execRA("distinct(Person)");
    expect(res[0].values.length).toBe(3);
  });

  it("δ without parens", () => {
    const res = execRA("δ Person");
    expect(res[0].values.length).toBe(3);
  });

  // ── Keyword variants for operators ──

  it("select keyword", () => {
    const res = execRA("select[age > 20](Person)");
    expect(res[0].values.length).toBe(2);
  });

  it("project keyword", () => {
    const res = execRA("project[name, city](Person)");
    expect(res[0].columns).toEqual(["name", "city"]);
  });

  it("cross keyword", () => {
    const res = execRA("Person cross Course");
    expect(res[0].values.length).toBe(6);
  });

  it("join keyword with condition", () => {
    const res = execRA("Person join[age > credits] Course");
    expect(res[0].values.length).toBeGreaterThan(0);
  });

  it("|X| as natural join", () => {
    const res = execRA("Person |X| Student");
    expect(res[0].values.length).toBe(2);
  });

  it("|><| as natural join", () => {
    const res = execRA("Person |><| Student");
    expect(res[0].values.length).toBe(2);
  });

  it("intersect keyword", () => {
    const res = execRA("π[name](Person) intersect π[name](Teacher)");
    expect(res.length === 0 || res[0].values.length === 0).toBe(true);
  });

  it("divide keyword", () => {
    const res = execRA("π[id, course_id](Enrollment) divide π[course_id](Course)");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain(1);
  });

  // ── Implicit subscripts edge cases ──

  it("ρ old→new (R) implicit", () => {
    const res = execRA("ρ name→fullName (Person)");
    expect(res[0].columns).toContain("fullName");
  });

  it("τ col (R) implicit", () => {
    const res = execRA("τ name (Person)");
    expect(res[0].values[0]).toContain("Alice");
  });

  it("σ compound implicit with AND", () => {
    const res = execRA("σ age > 20 and city = 'Stockholm' (Person)");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Alice");
  });

  it("nested implicit subscripts", () => {
    const res = execRA("π name (σ age > 20 (Person))");
    expect(res[0].columns).toEqual(["name"]);
    expect(res[0].values.length).toBe(2);
  });

  // ── Parenthesis-free edge cases ──

  it("triple chain without parens", () => {
    const res = execRA("π[name] σ[age > 20] δ Person");
    expect(res[0].columns).toEqual(["name"]);
    expect(res[0].values.length).toBe(2);
  });

  it("π[cols] over union with parens", () => {
    const res = execRA("π[name] (π[name](Person) ∪ π[name](Teacher))");
    expect(res[0].values.length).toBe(5);
  });

  // ── Assignment edge cases ──

  it("assignment with <- ASCII arrow", () => {
    const res = execRA("A <- σ[age > 20](Person)\nπ[name](A)");
    expect(res[0].values.length).toBe(2);
  });

  it("semicolons as statement separators", () => {
    const res = execRA("A ← Person; π[name](A)");
    expect(res[0].values.length).toBe(3);
  });

  it("comments in multi-line input", () => {
    const res = execRA("-- Get adults\nA ← σ[age > 20](Person)\n-- Project names\nπ[name](A)");
    expect(res[0].values.length).toBe(2);
  });

  it("implicit return from last assignment", () => {
    const res = execRA("A ← σ[age > 20](Person)");
    expect(res[0].values.length).toBe(2);
  });

  it("complex pipeline with reassignment", () => {
    const res = execRA("X ← Person ⋈ Student\nX ← σ[age > 20](X)\nX ← π[name](X)");
    expect(res[0].values.length).toBe(1);
    expect(res[0].values[0]).toContain("Alice");
  });
});
