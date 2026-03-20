/*
Relational Algebra engine for sql-validator
Copyright (C) 2026 E.SU. IT AB (Org.no 559484-0505) and Edwin Sundberg <edwin@edthing.com>

Licensed under the Business Source License 1.1 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License in the LICENSE.md file in this repository.
*/

/**
 * Custom syntax highlighter for relational algebra expressions.
 *
 * INVARIANT: The visible text of the output must be EXACTLY the input string.
 * Every input character must appear exactly once in the output. We only wrap
 * characters in <span> tags for coloring — never skip, reorder, or add chars.
 */

import {
  UNARY_SYMBOLS, BINARY_SYMBOLS, UNARY_KEYWORDS, BINARY_KEYWORDS,
  LOGIC_KEYWORDS, IDENT_START, IDENT_CHAR, esc,
} from "./raShared";

// Only color/opacity — never font-weight/size which affect character width
const LIGHT = {
  op: "color: #7c3aed;",
  logic: "color: #2563eb;",
  str: "color: #059669;",
  num: "color: #d97706;",
  comment: "color: #9ca3af; font-style: italic;",
  bracket: "color: #a1a1aa; opacity: 0.5;",
};

const DARK = {
  op: "color: #a78bfa;",
  logic: "color: #60a5fa;",
  str: "color: #34d399;",
  num: "color: #fbbf24;",
  comment: "color: #6b7280; font-style: italic;",
  bracket: "color: #6b7280; opacity: 0.5;",
};

/**
 * Wrap a raw substring in a styled span, escaping HTML entities.
 * The visible text length is always === raw.length.
 */
function span(style: string, raw: string): string {
  return `<span style="${style}">${esc(raw)}</span>`;
}

/**
 * Highlight RA code for the editor overlay.
 * Simple token-coloring only — no rewriting, no subscript rendering.
 * Character count is guaranteed correct by construction.
 */
export function highlightRA(code: string, dark = false): string {
  const S = dark ? DARK : LIGHT;
  const result: string[] = [];
  let i = 0;

  while (i < code.length) {
    // ── Comments: -- until newline ──
    if (code[i] === "-" && i + 1 < code.length && code[i + 1] === "-") {
      let end = i;
      while (end < code.length && code[end] !== "\n") end++;
      result.push(span(S.comment, code.slice(i, end)));
      i = end;
      continue;
    }

    // ── Newlines ──
    if (code[i] === "\n") {
      result.push("\n");
      i++;
      continue;
    }

    // ── Unicode unary operators (σ, π, ρ, γ, τ, δ) ──
    if (UNARY_SYMBOLS.has(code[i])) {
      result.push(span(S.op, code[i]));
      i++;
      continue;
    }

    // ── Unicode binary operators (×, ⋈, ∪, ∩, etc.) ──
    if (BINARY_SYMBOLS.has(code[i])) {
      result.push(span(S.op, code[i]));
      i++;
      continue;
    }

    // ── |X| or |><| natural join ──
    if (code[i] === "|") {
      if (i + 2 < code.length && (code[i + 1] === "X" || code[i + 1] === "x") && code[i + 2] === "|") {
        result.push(span(S.op, code.slice(i, i + 3)));
        i += 3;
        continue;
      }
      if (i + 3 < code.length && code[i + 1] === ">" && code[i + 2] === "<" && code[i + 3] === "|") {
        result.push(span(S.op, code.slice(i, i + 4)));
        i += 4;
        continue;
      }
    }

    // ── <- assignment ──
    if (code[i] === "<" && i + 1 < code.length && code[i + 1] === "-") {
      result.push(span(S.op, "<-"));
      i += 2;
      continue;
    }

    // ── -> rename arrow ──
    if (code[i] === "-" && i + 1 < code.length && code[i + 1] === ">") {
      result.push(span(S.op, "->"));
      i += 2;
      continue;
    }

    // ── → Unicode rename arrow ──
    if (code[i] === "→") {
      result.push(span(S.op, "→"));
      i++;
      continue;
    }

    // ── String literals ──
    if (code[i] === "'") {
      let end = i + 1;
      while (end < code.length && code[end] !== "'") end++;
      if (end < code.length) end++; // include closing quote
      result.push(span(S.str, code.slice(i, end)));
      i = end;
      continue;
    }

    // ── Numbers ──
    if (/\d/.test(code[i])) {
      let end = i;
      while (end < code.length && /[\d.]/.test(code[end])) end++;
      result.push(span(S.num, code.slice(i, end)));
      i = end;
      continue;
    }

    // ── Brackets — render faintly ──
    if (code[i] === "[" || code[i] === "]" || code[i] === "{" || code[i] === "}") {
      result.push(span(S.bracket, code[i]));
      i++;
      continue;
    }

    // ── Underscore before bracket — render as faint bracket prefix ──
    if (code[i] === "_") {
      // Check if this is a LaTeX-style _{} or _[] prefix
      let j = i + 1;
      while (j < code.length && code[j] === " ") j++;
      if (j < code.length && (code[j] === "{" || code[j] === "[")) {
        result.push(span(S.bracket, "_"));
        i++;
        continue;
      }
    }

    // ── Identifiers and keywords ──
    if (IDENT_START.test(code[i])) {
      let end = i;
      while (end < code.length && IDENT_CHAR.test(code[end])) end++;
      const word = code.slice(i, end);
      const lower = word.toLowerCase();
      if (UNARY_KEYWORDS.has(lower) || BINARY_KEYWORDS.has(lower)) {
        result.push(span(S.op, word));
      } else if (LOGIC_KEYWORDS.has(lower)) {
        result.push(span(S.logic, word));
      } else {
        result.push(esc(word));
      }
      i = end;
      continue;
    }

    // ── Comparison operators ──
    if ("<>!=".includes(code[i])) {
      let end = i + 1;
      if (end < code.length && (code[end] === "=" || code[end] === ">")) end++;
      result.push(span(S.logic, code.slice(i, end)));
      i = end;
      continue;
    }

    // ── Everything else (spaces, parens, etc.) — pass through ──
    result.push(esc(code[i]));
    i++;
  }

  return result.join("");
}
