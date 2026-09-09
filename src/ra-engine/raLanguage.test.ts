import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree } from "@codemirror/language";
import { highlightTree, classHighlighter } from "@lezer/highlight";
import { describe, expect, it } from "vitest";
import { raStreamLanguage } from "./raLanguage";

function highlight(code: string): string[] {
  const state = EditorState.create({ doc: code, extensions: [raStreamLanguage] });
  const tree = ensureSyntaxTree(state, state.doc.length, 1_000);
  expect(tree).not.toBeNull();
  const tokens: string[] = [];
  highlightTree(tree!, classHighlighter, (from, to, classes) => tokens.push(`${code.slice(from, to)}:${classes}`));
  return tokens;
}

describe("raStreamLanguage", () => {
  it("classifies comments, symbols, keyword operators, literals, brackets, and comparisons", () => {
    const tokens = highlight("-- comment\nσ π ρ γ τ δ × ⋈ ∪ ∩ − ÷ ⟕ ⟖ ⟗ ⋉ ⋊ ▷ ← -> |X| |><| [x] {y} 'Ada' 12.5 name AND or NOT a <= b <> c != d");
    expect(tokens.join(" ")).toContain("-- comment:tok-comment");
    expect(tokens.join(" ")).toContain("σ:tok-keyword");
    expect(tokens.join(" ")).toContain("|X|:tok-keyword");
    expect(tokens.join(" ")).toContain("'Ada':tok-string");
    expect(tokens.join(" ")).toContain("12.5:tok-number");
    expect(tokens.join(" ")).toContain("name:tok-variableName");
    expect(tokens.join(" ")).toContain("AND:tok-operator");
  });

  it("recognizes textual operators, assignments, and underscore subscript syntax", () => {
    const tokens = highlight("sigma project rename gamma sort distinct cross natjoin join union intersect minus divide leftjoin rightjoin fulljoin leftsemijoin rightsemijoin antijoin R _{condition} _ [space] _name @");
    const output = tokens.join(" ");
    expect(output).toContain("sigma:tok-keyword");
    expect(output).toContain("antijoin:tok-keyword");
    expect(output).toContain("_{:tok-punctuation");
    expect(output).toContain("_name:tok-variableName");
    expect(output).toContain("R:tok-variableName");
  });
});
