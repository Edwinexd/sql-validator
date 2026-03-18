import { describe, it, expect } from "vitest";
import { highlightRA } from "./raHighlight";

describe("RA highlighter", () => {
  it("should highlight σ operator in purple", () => {
    const html = highlightRA("σ[age > 20](Person)");
    expect(html).toContain("color: #7c3aed"); // operator color
    expect(html).toContain("σ");
  });

  it("should render brackets faintly", () => {
    const html = highlightRA("σ[age > 20](Person)");
    expect(html).toContain("opacity: 0.5"); // faint brackets
  });

  it("should render subscript content in light purple", () => {
    const html = highlightRA("π[name](Person)");
    expect(html).toContain("color: #c084fc"); // subscript styling
  });

  it("should highlight string literals in green", () => {
    const html = highlightRA("σ[name = 'Alice'](Person)");
    expect(html).toContain("color: #059669"); // string color
    expect(html).toContain("Alice");
  });

  it("should highlight numbers in amber", () => {
    const html = highlightRA("σ[age > 20](Person)");
    expect(html).toContain("color: #d97706"); // number color
  });

  it("should highlight AND/OR in blue", () => {
    const html = highlightRA("σ[a > 1 and b < 2](T)");
    expect(html).toContain("color: #2563eb"); // logic color
    expect(html).toContain("and");
  });

  it("should highlight comments in gray italic", () => {
    const html = highlightRA("-- this is a comment\nPerson");
    expect(html).toContain("font-style: italic");
    expect(html).toContain("this is a comment");
  });

  it("should render <- with assignment styling", () => {
    const html = highlightRA("A <- Person");
    expect(html).toContain("&lt;-");
    expect(html).toContain("font-weight: bold");
  });

  it("should render -> with operator styling", () => {
    const html = highlightRA("ρ[name->fullName](Person)");
    expect(html).toContain("-&gt;");
  });

  it("should handle LaTeX-style _{} notation", () => {
    const html = highlightRA("σ_{age > 20}(Person)");
    expect(html).toContain("opacity: 0.5"); // faint brackets
    expect(html).toContain("color: #c084fc"); // subscript content
  });

  it("should highlight keyword operators", () => {
    const html = highlightRA("sigma[age > 20](Person)");
    expect(html).toContain("color: #7c3aed"); // operator color
    expect(html).toContain("sigma");
  });

  it("should highlight binary keyword operators", () => {
    const html = highlightRA("A cross B");
    expect(html).toContain("color: #7c3aed");
    expect(html).toContain("cross");
  });

  it("should preserve newlines", () => {
    const html = highlightRA("A <- Person\nA");
    expect(html).toContain("\n");
  });

  it("should handle implicit subscripts with whitespace", () => {
    const html = highlightRA("σ age > 20 (Person)");
    expect(html).toContain("color: #c084fc"); // subscript styling for implicit content
  });
});
