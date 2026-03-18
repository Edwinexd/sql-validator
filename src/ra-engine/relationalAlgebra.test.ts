import { describe, it, expect } from "vitest";
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

  it("should produce NATURAL JOIN SQL even without common columns (let SQLite handle it)", () => {
    const sql = raToSQL("TableA ⋈ TableB");
    expect(norm(sql)).toContain("NATURAL JOIN");
  });

  it("should not error on valid natural join when database is provided", () => {
    const mockDb = {
      exec: (sql: string) => {
        if (sql.includes("Person")) {
          return [{ columns: ["id", "name", "city"], values: [] }];
        }
        if (sql.includes("Student")) {
          return [{ columns: ["id", "hasDisability"], values: [] }];
        }
        return [{ columns: [], values: [] }];
      },
    };

    expect(() => raToSQL("Person ⋈ Student", mockDb)).not.toThrow();
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
});
