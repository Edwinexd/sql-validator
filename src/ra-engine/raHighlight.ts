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
 *
 * IMPORTANT: This highlighter must preserve character count (each input char
 * maps to exactly one output char) for editor overlay alignment.
 */

import {
  UNARY_SYMBOLS, BINARY_SYMBOLS, UNARY_KEYWORDS, BINARY_KEYWORDS,
  LOGIC_KEYWORDS, IDENT_START, IDENT_CHAR,
  esc, skipWs, highlightSubContent, extractBracketContent, extractImplicitSubscript,
} from "./raShared";

// Inline styles for portability with the code editor
const S = {
  op: "color: #7c3aed; font-weight: bold;",
  kw: "color: #7c3aed; font-weight: bold;",
  logic: "color: #2563eb; font-weight: bold;",
  str: "color: #059669;",
  num: "color: #d97706;",
  comment: "color: #9ca3af; font-style: italic;",
  bracket: "color: #a1a1aa; opacity: 0.5;",
  assign: "color: #7c3aed; font-weight: bold;",
  sub: "color: #c084fc; font-weight: 500;",
};

const subWrap = (type: string, text: string) =>
  `<span style="${S[type as keyof typeof S] || S.sub}">${text}</span>`;

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
      if (i < code.length && (code[i] === "[" || code[i] === "{" || code[i] === "_")) {
        i = renderSubscript(code, i, result);
      }
      continue;
    }

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
    if (IDENT_START.test(code[i])) {
      let ident = "";
      while (i < code.length && IDENT_CHAR.test(code[i])) {
        ident += code[i];
        i++;
      }
      const lower = ident.toLowerCase();
      if (UNARY_KEYWORDS.has(lower)) {
        result.push(`<span style="${S.kw}">${esc(ident)}</span>`);
        i = renderSubscript(code, i, result);
      } else if (BINARY_KEYWORDS.has(lower)) {
        result.push(`<span style="${S.kw}">${esc(ident)}</span>`);
        const j = skipWs(code, i);
        if (j < code.length && (code[j] === "[" || code[j] === "{" || code[j] === "_")) {
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

/**
 * Render a subscript section after a unary/binary operator.
 * Handles: _{ }, [ ], { }, or implicit (content until '(').
 * Returns the new index position.
 */
function renderSubscript(code: string, i: number, result: string[]): number {
  const beforeWs = i;
  i = skipWs(code, i);

  if (i >= code.length) {
    if (i > beforeWs) result.push(code.slice(beforeWs, i));
    return i;
  }

  // Handle _{ or _[ (LaTeX-style)
  if (code[i] === "_") {
    result.push(`<span style="${S.bracket}">${esc("_")}</span>`);
    i++;
    i = skipWs(code, i);
  }

  // Try bracket content
  if (code[i] === "[" || code[i] === "{") {
    const openBracket = code[i];
    result.push(`<span style="${S.bracket}">${esc(openBracket)}</span>`);
    const [newI, content] = extractBracketContent(code, i);
    if (content !== null) {
      result.push(`<span style="${S.sub}">${highlightSubContent(content, subWrap)}</span>`);
      // Render closing bracket (only if bracket was actually closed)
      if (newI > i + 1 && newI <= code.length) {
        const closeBracket = code[newI - 1];
        if (closeBracket === "]" || closeBracket === "}") {
          result.push(`<span style="${S.bracket}">${esc(closeBracket)}</span>`);
        }
      }
      return newI;
    }
  }

  // Implicit subscript
  const [newI, content] = extractImplicitSubscript(code, i, beforeWs);
  if (content !== null) {
    result.push(code.slice(beforeWs, i)); // whitespace
    result.push(`<span style="${S.sub}">${highlightSubContent(content, subWrap)}</span>`);
    return newI;
  }

  // No subscript found — restore whitespace
  if (i > beforeWs) result.push(code.slice(beforeWs, i));
  return i;
}
