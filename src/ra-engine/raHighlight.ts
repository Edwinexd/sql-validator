/*
Relational Algebra engine for sql-validator
Copyright (C) 2026 E.SU. IT AB (Org.no 559484-0505) and Edwin Sundberg <edwin@edthing.com>

Licensed under the Business Source License 1.1 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License in the LICENSE.md file in this repository.
*/

/**
 * Custom syntax highlighter for relational algebra expressions.
 * Returns HTML with subscript rendering for bracket content and
 * colored tokens for operators, keywords, strings, etc.
 */

// Escape HTML special characters
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// RA operator symbols
const UNARY_SYMBOLS = new Set(["σ", "π", "ρ", "γ", "τ", "δ"]);
const BINARY_SYMBOLS = new Set(["×", "⋈", "∪", "∩", "−", "÷", "⟕", "⟖", "⟗", "⋉", "⋊", "▷", "←"]);

const UNARY_KEYWORDS = new Set([
  "sigma", "select", "pi", "project", "rho", "rename",
  "gamma", "tau", "sort", "delta", "distinct",
]);
const BINARY_KEYWORDS = new Set([
  "cross", "natjoin", "join", "union", "intersect", "minus",
  "divide", "leftjoin", "rightjoin", "fulljoin",
  "leftsemijoin", "rightsemijoin", "antijoin",
]);
const LOGIC_KEYWORDS = new Set(["and", "or", "not"]);

// CSS classes (inline styles for portability with the code editor)
const S = {
  op: "color: #7c3aed; font-weight: bold;",         // purple - operators
  kw: "color: #7c3aed; font-weight: bold;",         // purple - keyword operators
  logic: "color: #2563eb; font-weight: bold;",      // blue - AND/OR/NOT
  str: "color: #059669;",                            // green - strings
  num: "color: #d97706;",                            // amber - numbers
  comment: "color: #9ca3af; font-style: italic;",   // gray - comments
  bracket: "color: #a1a1aa; opacity: 0.5;",           // zinc, faint - brackets (subscript delimiters)
  assign: "color: #7c3aed; font-weight: bold;",     // purple - assignment arrow
  sub: "color: #c084fc; font-weight: 500;",         // light purple - subscript content (readable, distinct from plain text)
};

/**
 * Highlight a relational algebra expression, rendering bracket content
 * as subscripts and coloring operators/keywords.
 */
export function highlightRA(code: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < code.length) {
    // Comments: --
    if (code[i] === "-" && i + 1 < code.length && code[i + 1] === "-") {
      let comment = "";
      while (i < code.length && code[i] !== "\n") {
        comment += code[i];
        i++;
      }
      result.push(`<span style="${S.comment}">${esc(comment)}</span>`);
      continue;
    }

    // Newlines — preserve them
    if (code[i] === "\n") {
      result.push("\n");
      i++;
      continue;
    }

    // Unicode RA operators (single char)
    if (UNARY_SYMBOLS.has(code[i])) {
      result.push(`<span style="${S.op}">${esc(code[i])}</span>`);
      i++;
      // Check for subscript: _{ }, [ ], { }, or implicit (tokens until '(')
      i = renderSubscript(code, i, result);
      continue;
    }

    // |X| or |><| — natural join
    if (code[i] === "|") {
      if (i + 2 < code.length && (code[i + 1] === "X" || code[i + 1] === "x") && code[i + 2] === "|") {
        result.push(`<span style="${S.op}">${esc("|X|")}</span>`);
        i += 3;
        continue;
      }
      if (i + 3 < code.length && code[i + 1] === ">" && code[i + 2] === "<" && code[i + 3] === "|") {
        result.push(`<span style="${S.op}">${esc("|><|")}</span>`);
        i += 4;
        continue;
      }
    }

    if (BINARY_SYMBOLS.has(code[i])) {
      result.push(`<span style="${S.op}">${esc(code[i])}</span>`);
      i++;
      // Binary ops can have bracket conditions: ⋈[cond] or ⋈{cond}
      if (i < code.length && (code[i] === "[" || code[i] === "{" || code[i] === "_")) {
        i = renderSubscript(code, i, result);
      }
      continue;
    }

    // Assignment arrow: ← (already handled above as binary symbol)
    // Arrow: <- (assignment) — keep both chars for editor alignment
    if (code[i] === "<" && i + 1 < code.length && code[i + 1] === "-") {
      result.push(`<span style="${S.assign}">&lt;-</span>`);
      i += 2;
      continue;
    }

    // Arrow: -> (rename) — keep both chars for editor alignment
    if (code[i] === "-" && i + 1 < code.length && code[i + 1] === ">") {
      result.push(`<span style="${S.op}">-&gt;</span>`);
      i += 2;
      continue;
    }

    // String literals
    if (code[i] === "'") {
      let str = "'";
      i++;
      while (i < code.length && code[i] !== "'") {
        str += code[i];
        i++;
      }
      if (i < code.length) { str += "'"; i++; }
      result.push(`<span style="${S.str}">${esc(str)}</span>`);
      continue;
    }

    // Numbers
    if (/\d/.test(code[i])) {
      let num = "";
      while (i < code.length && /[\d.]/.test(code[i])) {
        num += code[i];
        i++;
      }
      result.push(`<span style="${S.num}">${esc(num)}</span>`);
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_\u00C0-\u024F]/.test(code[i])) {
      let ident = "";
      while (i < code.length && /[a-zA-Z0-9_\u00C0-\u024F]/.test(code[i])) {
        ident += code[i];
        i++;
      }
      const lower = ident.toLowerCase();
      if (UNARY_KEYWORDS.has(lower)) {
        result.push(`<span style="${S.kw}">${esc(ident)}</span>`);
        // Check for subscript after keyword
        i = renderSubscript(code, i, result);
      } else if (BINARY_KEYWORDS.has(lower)) {
        result.push(`<span style="${S.kw}">${esc(ident)}</span>`);
        // Binary keyword may have bracket conditions
        const j = skipWhitespace(code, i);
        if (j < code.length && (code[j] === "[" || code[j] === "{" || code[j] === "_")) {
          // Include the whitespace before the bracket
          if (j > i) result.push(esc(code.slice(i, j)));
          i = renderSubscript(code, j, result);
        }
      } else if (LOGIC_KEYWORDS.has(lower)) {
        result.push(`<span style="${S.logic}">${esc(ident)}</span>`);
      } else {
        result.push(esc(ident));
      }
      continue;
    }

    // Comparison operators
    if (code[i] === "<" || code[i] === ">" || code[i] === "!" || code[i] === "=") {
      let op = code[i];
      i++;
      if (i < code.length && (code[i] === "=" || code[i] === ">")) {
        op += code[i];
        i++;
      }
      result.push(`<span style="${S.logic}">${esc(op)}</span>`);
      continue;
    }

    // Everything else (whitespace, parens, etc.) — pass through
    result.push(esc(code[i]));
    i++;
  }

  return result.join("");
}

function skipWhitespace(code: string, i: number): number {
  while (i < code.length && code[i] === " ") i++;
  return i;
}

/**
 * Render a subscript section after a unary/binary operator.
 * Handles: _{ }, [ ], { }, or implicit (content until '(').
 * Returns the new index position.
 */
function renderSubscript(code: string, i: number, result: string[]): number {
  // Skip whitespace
  const beforeWs = i;
  while (i < code.length && code[i] === " ") i++;

  // Check what follows
  if (i >= code.length) {
    if (i > beforeWs) result.push(code.slice(beforeWs, i));
    return i;
  }

  // Handle _{ or _[ (LaTeX-style)
  if (code[i] === "_") {
    result.push(`<span style="${S.bracket}">${esc("_")}</span>`);
    i++;
    while (i < code.length && code[i] === " ") i++;
  }

  if (code[i] === "[" || code[i] === "{") {
    // Bracketed subscript — render brackets faintly, content as subscript
    const openBracket = code[i];
    result.push(`<span style="${S.bracket}">${esc(openBracket)}</span>`);
    i++; // past opening bracket
    let depth = 1;
    let content = "";
    while (i < code.length && depth > 0) {
      if (code[i] === "[" || code[i] === "{") depth++;
      if (code[i] === "]" || code[i] === "}") depth--;
      if (depth > 0) {
        content += code[i];
      }
      i++;
    }
    // Render inner content with subscript styling
    result.push(`<span style="${S.sub}">${highlightSubscriptContent(content)}</span>`);
    // Render closing bracket faintly (the character at i-1 was the closing bracket)
    if (depth === 0) {
      const closeBracket = code[i - 1];
      result.push(`<span style="${S.bracket}">${esc(closeBracket)}</span>`);
    }
    return i;
  }

  // Not a bracket — check for implicit subscript (content until '(')
  // Only apply for unary operators where we expect a subscript
  if (code[i] !== "(" && i > beforeWs) {
    // Emit the whitespace between operator and subscript content
    result.push(code.slice(beforeWs, i));
    // Collect content until '(' as implicit subscript
    let content = "";
    while (i < code.length && code[i] !== "(" && code[i] !== "\n") {
      content += code[i];
      i++;
    }
    // Trim trailing whitespace from content but keep the position
    const trimmed = content.trimEnd();
    const trimDiff = content.length - trimmed.length;
    if (trimDiff > 0) i -= trimDiff;
    if (trimmed.length > 0) {
      result.push(`<span style="${S.sub}">${highlightSubscriptContent(trimmed)}</span>`);
    }
    return i;
  }

  // No subscript found — restore whitespace
  if (i > beforeWs) result.push(code.slice(beforeWs, i));
  return i;
}

/**
 * Highlight content inside a subscript (conditions, column lists, etc.)
 */
function highlightSubscriptContent(content: string): string {
  const parts: string[] = [];
  let i = 0;

  while (i < content.length) {
    // String literals
    if (content[i] === "'") {
      let str = "'";
      i++;
      while (i < content.length && content[i] !== "'") { str += content[i]; i++; }
      if (i < content.length) { str += "'"; i++; }
      parts.push(`<span style="${S.str}">${esc(str)}</span>`);
      continue;
    }
    // Numbers
    if (/\d/.test(content[i])) {
      let num = "";
      while (i < content.length && /[\d.]/.test(content[i])) { num += content[i]; i++; }
      parts.push(`<span style="${S.num}">${esc(num)}</span>`);
      continue;
    }
    // Keywords and identifiers
    if (/[a-zA-Z_\u00C0-\u024F]/.test(content[i])) {
      let ident = "";
      while (i < content.length && /[a-zA-Z0-9_\u00C0-\u024F]/.test(content[i])) { ident += content[i]; i++; }
      const lower = ident.toLowerCase();
      if (LOGIC_KEYWORDS.has(lower)) {
        parts.push(`<span style="${S.logic}">${esc(ident)}</span>`);
      } else if (lower === "desc" || lower === "asc" || lower === "as") {
        parts.push(`<span style="${S.logic}">${esc(ident)}</span>`);
      } else if (["count", "sum", "avg", "min", "max"].includes(lower)) {
        parts.push(`<span style="${S.kw}">${esc(ident)}</span>`);
      } else {
        parts.push(esc(ident));
      }
      continue;
    }
    // Arrow → or ->
    if (content[i] === "→") {
      parts.push(`<span style="${S.op}">→</span>`);
      i++;
      continue;
    }
    if (content[i] === "-" && i + 1 < content.length && content[i + 1] === ">") {
      parts.push(`<span style="${S.op}">-&gt;</span>`);
      i += 2;
      continue;
    }
    // Comparison ops
    if (content[i] === "<" || content[i] === ">" || content[i] === "!" || content[i] === "=") {
      let op = content[i]; i++;
      if (i < content.length && (content[i] === "=" || content[i] === ">")) { op += content[i]; i++; }
      parts.push(`<span style="${S.logic}">${esc(op)}</span>`);
      continue;
    }
    // Everything else
    parts.push(esc(content[i]));
    i++;
  }

  return parts.join("");
}
