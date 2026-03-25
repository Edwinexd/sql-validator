import { describe, it, expect } from "vitest";
import { highlightRA } from "./raHighlight";
import { renderRAPreview } from "./RAPreview";

/** Strip HTML tags and decode entities to recover visible text */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

// ─── Character count invariant ──────────────────────────────────────────────
// The editor overlay MUST produce visible text identical to the input.
// These tests are the most important — if any fail, the editor is broken.

describe("RA highlighter character preservation", () => {
  const inputs = [
    "Person",
    "σ[age > 20](Person)",
    "π[name, city](Person)",
    "ρ[name→fullName](Person)",
    "σ_{age > 20}(Person)",
    "σ{age > 20}(Person)",
    "PI [name, city](Person)",
    "PI [name, person_id, address, postal_code] SIGMA [city='York'] Person",
    "PI name, person_id SIGMA city='York' Person",
    "PI _name, person_id Person",
    "A <- σ[age > 20](Person)\nπ[name](A)",
    "-- comment\nPerson",
    "Person ⋈ Student",
    "Person |X| Student",
    "Person |><| Student",
    "ρ[name->fullName](Person)",
    "σ[a <> 1](T)",
    "σ[a != 1](T)",
    "σ[a >= 1](T)",
    "σ[a <= 1](T)",
    "γ[city; COUNT(id) AS cnt](Person)",
    "Person ⋈[Person.id = Student.id] Student",
    "σ[name = 'Alice'](Person)",
    "PI [name SIGMA [age > 20] Person",  // unclosed bracket
    "σ age > 20 (Person)",  // implicit subscript
    "",
  ];

  for (const input of inputs) {
    it(`preserves: ${JSON.stringify(input).slice(0, 60)}`, () => {
      if (input === "") return; // empty input = empty output
      const html = highlightRA(input);
      expect(visibleText(html)).toBe(input);
    });
  }
});

// ─── Token coloring ─────────────────────────────────────────────────────────

describe("RA highlighter coloring", () => {
  it("colors σ operator", () => {
    expect(highlightRA("σ[age > 20](Person)")).toContain("color: #7c3aed");
  });

  it("colors keyword operators", () => {
    const html = highlightRA("sigma[age > 20](Person)");
    expect(html).toContain("color: #7c3aed");
    expect(html).toContain("sigma");
  });

  it("colors binary keyword operators", () => {
    expect(highlightRA("A cross B")).toContain("color: #7c3aed");
  });

  it("renders brackets faintly", () => {
    expect(highlightRA("σ[age > 20](Person)")).toContain("opacity: 0.5");
  });

  it("colors string literals green", () => {
    const html = highlightRA("σ[name = 'Alice'](Person)");
    expect(html).toContain("color: #059669");
    expect(html).toContain("Alice");
  });

  it("colors numbers amber", () => {
    expect(highlightRA("σ[age > 20](Person)")).toContain("color: #d97706");
  });

  it("colors AND/OR/NOT blue", () => {
    const html = highlightRA("σ[a > 1 and b < 2](T)");
    expect(html).toContain("color: #2563eb");
  });

  it("colors comments gray italic", () => {
    const html = highlightRA("-- this is a comment\nPerson");
    expect(html).toContain("font-style: italic");
  });

  it("colors <- assignment", () => {
    const html = highlightRA("A <- Person");
    expect(html).toContain("color: #7c3aed");
    expect(html).toContain("&lt;-");
  });

  it("colors -> rename arrow", () => {
    const html = highlightRA("ρ[name->fullName](Person)");
    expect(html).toContain("-&gt;");
  });

  it("colors _ as bracket when before {", () => {
    const html = highlightRA("σ_{age > 20}(Person)");
    expect(html).toContain("opacity: 0.5");
  });

  it("does not color _ when part of identifier", () => {
    const html = highlightRA("PI _name (Person)");
    // _name should not have bracket styling
    expect(html).not.toMatch(/opacity.*_n/);
  });

  it("preserves newlines", () => {
    expect(highlightRA("A <- Person\nA")).toContain("\n");
  });
});

// ─── RAPreview rendering ────────────────────────────────────────────────────

describe("RA preview", () => {
  it("should render paren-free implicit projection without eating the table name", () => {
    const html = renderRAPreview("PI person_id, address Person");
    expect(html).toMatch(/<sub[^>]*>.*person_id.*address.*<\/sub>/);
    // Person must not be in a subscript
    expect(html).not.toMatch(/<sub[^>]*>.*Person.*<\/sub>/s);
  });

  it("should render paren-free implicit projection with Unicode symbol", () => {
    const html = renderRAPreview("π person_id, address Person");
    expect(html).toMatch(/<sub[^>]*>.*person_id.*<\/sub>/);
  });

  it("should still render parenthesised implicit subscript correctly", () => {
    const html = renderRAPreview("π person_id, address (Person)");
    expect(html).toMatch(/<sub[^>]*>.*person_id.*address.*<\/sub>/);
  });

  it("should render paren-free σ condition Table correctly", () => {
    const html = renderRAPreview("sigma age > 20 Person");
    expect(html).toContain("Person");
    expect(html).toMatch(/<sub[^>]*>.*age.*<\/sub>/);
  });

  it("should not swallow content after unclosed bracket", () => {
    const html = renderRAPreview("PI [name, person_id SIGMA city='York' Person");
    const opMatches = html.match(/ra-prev-op/g);
    expect(opMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it("should render chained paren-free operators correctly", () => {
    const html = renderRAPreview("PI name, person_id, address, postal_code SIGMA city='York' Person");
    const opMatches = html.match(/ra-prev-op/g);
    expect(opMatches!.length).toBeGreaterThanOrEqual(2);
    expect(html).toMatch(/<sub[^>]*>.*name.*postal_code.*<\/sub>/);
  });

  it("should render chained Unicode operators correctly", () => {
    const html = renderRAPreview("π name, city σ age > 20 Person");
    const opMatches = html.match(/ra-prev-op/g);
    expect(opMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it("should not treat underscore-prefixed column names as LaTeX subscript", () => {
    const html = renderRAPreview("PI _name, person_id Person");
    expect(html).toMatch(/<sub[^>]*>.*_name.*person_id.*<\/sub>/);
    expect(html).not.toMatch(/opacity/);
  });
});
