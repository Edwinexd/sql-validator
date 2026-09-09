import { describe, expect, it } from "vitest";
import {
  esc,
  extractBracketContent,
  extractImplicitSubscript,
  highlightSubContent,
  skipWs,
} from "./raShared";

const wrap = (type: string, text: string) => `<${type}>${text}</${type}>`;

describe("RA shared helpers", () => {
  it("escapes HTML and skips spaces", () => {
    expect(esc("<tag a=\"b\">&")).toBe("&lt;tag a=&quot;b&quot;&gt;&amp;");
    expect(skipWs("   value", 0)).toBe(3);
    expect(skipWs("value", 0)).toBe(0);
  });

  it("highlights all subscript token kinds", () => {
    const html = highlightSubContent("'Ada' 'unfinished 12.5 and ASC count name → a->b <= != &", wrap);

    expect(html).toContain("<str>'Ada'</str>");
    expect(html).toContain("<str>'unfinished 12.5 and ASC count name → a-&gt;b &lt;= != &amp;</str>");
    expect(highlightSubContent("12.5 and ASC count name → a->b <= != &", wrap)).toBe(
      "<num>12.5</num> <logic>and</logic> <logic>ASC</logic> <op>count</op> name <op>→</op> a<op>-&gt;</op>b <logic>&lt;=</logic> <logic>!=</logic> &amp;"
    );
  });

  it("extracts closed, nested, underscored, and invalid brackets", () => {
    expect(extractBracketContent(" [a {b}] rest", 0)).toEqual([8, "a {b}"]);
    expect(extractBracketContent(" _ [a]", 0)).toEqual([6, "a"]);
    expect(extractBracketContent("_{a}", 0)).toEqual([4, "a"]);
    expect(extractBracketContent("[a", 0)).toEqual([0, null]);
    expect(extractBracketContent("_name", 0)).toEqual([0, null]);
    expect(extractBracketContent("", 0)).toEqual([0, null]);
  });

  it("extracts implicit subscripts at syntax boundaries and preserves operands", () => {
    expect(extractImplicitSubscript("age > 20 (Person)", 0, -1)).toEqual([8, "age > 20"]);
    expect(extractImplicitSubscript("age > 20 π name Person", 0, -1)).toEqual([8, "age > 20"]);
    expect(extractImplicitSubscript("name sigma age Person", 0, -1)).toEqual([4, "name"]);
    expect(extractImplicitSubscript("name Person", 0, -1)).toEqual([4, "name"]);
    expect(extractImplicitSubscript("Person", 0, -1)).toEqual([0, null]);
    expect(extractImplicitSubscript(" (Person)", 1, 0)).toEqual([1, null]);
    expect(extractImplicitSubscript("", 0, -1)).toEqual([0, null]);
  });
});
