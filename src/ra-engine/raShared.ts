/*
Relational Algebra engine for sql-validator
Copyright (C) 2026 E.SU. IT AB (Org.no 559484-0505) and Edwin Sundberg <edwin@edthing.com>

Licensed under the Business Source License 1.1 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License in the LICENSE.md file in this repository.
*/

/**
 * Shared constants and utilities for RA highlighting and preview rendering.
 */

// RA operator symbol sets
export const UNARY_SYMBOLS = new Set(["σ", "π", "ρ", "γ", "τ", "δ"]);
export const BINARY_SYMBOLS = new Set(["×", "⋈", "∪", "∩", "−", "÷", "⟕", "⟖", "⟗", "⋉", "⋊", "▷", "←"]);

// RA keyword sets (lowercase)
export const UNARY_KEYWORDS = new Set([
  "sigma", "select", "pi", "project", "rho", "rename",
  "gamma", "tau", "sort", "delta", "distinct",
]);
export const BINARY_KEYWORDS = new Set([
  "cross", "natjoin", "join", "union", "intersect", "minus",
  "divide", "leftjoin", "rightjoin", "fulljoin",
  "leftsemijoin", "rightsemijoin", "antijoin",
]);
export const LOGIC_KEYWORDS = new Set(["and", "or", "not"]);
export const MODIFIER_KEYWORDS = new Set(["asc", "desc", "as"]);
export const AGGREGATE_KEYWORDS = new Set(["count", "sum", "avg", "min", "max"]);

// Keyword to Unicode symbol mappings (used by RAPreview for pretty-printing)
export const UNARY_KEYWORD_SYMBOLS: Record<string, string> = {
  sigma: "σ", select: "σ",
  pi: "π", project: "π",
  rho: "ρ", rename: "ρ",
  gamma: "γ",
  tau: "τ", sort: "τ",
  delta: "δ", distinct: "δ",
};
export const BINARY_KEYWORD_SYMBOLS: Record<string, string> = {
  cross: "×",
  natjoin: "⋈", join: "⋈",
  union: "∪",
  intersect: "∩",
  minus: "−",
  divide: "÷",
  leftjoin: "⟕",
  rightjoin: "⟖",
  fulljoin: "⟗",
  leftsemijoin: "⋉",
  rightsemijoin: "⋊",
  antijoin: "▷",
};

/** Escape HTML special characters */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Skip whitespace (spaces only) */
export function skipWs(code: string, i: number): number {
  while (i < code.length && code[i] === " ") i++;
  return i;
}

/** Regex patterns for identifier characters */
export const IDENT_START = /[a-zA-Z_\u00C0-\u024F]/;
export const IDENT_CHAR = /[a-zA-Z0-9_\u00C0-\u024F]/;

/**
 * A wrapper function that produces a styled HTML span.
 * Takes a semantic token type and the escaped text.
 */
export type StyleWrapper = (type: "op" | "logic" | "str" | "num" | "ident", text: string) => string;

/**
 * Tokenize and highlight subscript content (conditions, column lists, etc.)
 * using the provided style wrapper for output.
 */
export function highlightSubContent(content: string, wrap: StyleWrapper): string {
  const parts: string[] = [];
  let i = 0;

  while (i < content.length) {
    // String literals
    if (content[i] === "'") {
      let str = "'";
      i++;
      while (i < content.length && content[i] !== "'") { str += content[i]; i++; }
      if (i < content.length) { str += "'"; i++; }
      parts.push(wrap("str", esc(str)));
      continue;
    }
    // Numbers
    if (/\d/.test(content[i])) {
      let num = "";
      while (i < content.length && /[\d.]/.test(content[i])) { num += content[i]; i++; }
      parts.push(wrap("num", esc(num)));
      continue;
    }
    // Keywords and identifiers
    if (IDENT_START.test(content[i])) {
      let ident = "";
      while (i < content.length && IDENT_CHAR.test(content[i])) { ident += content[i]; i++; }
      const lower = ident.toLowerCase();
      if (LOGIC_KEYWORDS.has(lower) || MODIFIER_KEYWORDS.has(lower)) {
        parts.push(wrap("logic", esc(ident)));
      } else if (AGGREGATE_KEYWORDS.has(lower)) {
        parts.push(wrap("op", esc(ident)));
      } else {
        parts.push(esc(ident));
      }
      continue;
    }
    // Arrow → or ->
    if (content[i] === "→") {
      parts.push(wrap("op", "→"));
      i++;
      continue;
    }
    if (content[i] === "-" && i + 1 < content.length && content[i + 1] === ">") {
      parts.push(wrap("op", esc("->")));
      i += 2;
      continue;
    }
    // Comparison ops
    if ("<>!=".includes(content[i])) {
      let op = content[i]; i++;
      if (i < content.length && (content[i] === "=" || content[i] === ">")) { op += content[i]; i++; }
      parts.push(wrap("logic", esc(op)));
      continue;
    }
    // Everything else
    parts.push(esc(content[i]));
    i++;
  }

  return parts.join("");
}

/**
 * Extract bracket content from code starting at position i.
 * Handles [..], {..}, and _{..} patterns.
 * Returns [newIndex, extractedContent] or [originalIndex, null] if no bracket found.
 */
export function extractBracketContent(code: string, startI: number): [number, string | null] {
  let i = skipWs(code, startI);
  if (i >= code.length) return [startI, null];

  // Handle _{ or _[ prefix — only if followed by a bracket
  if (code[i] === "_") {
    const afterUnderscore = skipWs(code, i + 1);
    if (afterUnderscore < code.length && (code[afterUnderscore] === "{" || code[afterUnderscore] === "[")) {
      i = afterUnderscore;
    }
  }

  if (code[i] === "[" || code[i] === "{") {
    i++; // past opening bracket
    let depth = 1;
    let content = "";
    while (i < code.length && depth > 0) {
      if (code[i] === "[" || code[i] === "{") depth++;
      if (code[i] === "]" || code[i] === "}") depth--;
      if (depth > 0) content += code[i];
      i++;
    }
    // Only treat as bracket content if the bracket was actually closed
    if (depth === 0) {
      return [i, content];
    }
    return [startI, null];
  }

  return [startI, null];
}

/** All keywords that are RA operators (unary + binary) */
const RA_OPERATOR_KEYWORDS = new Set([...UNARY_KEYWORDS, ...BINARY_KEYWORDS]);

/**
 * Extract implicit subscript content (tokens until '(' or newline or another RA operator).
 * When no '(' or operator follows (paren-free syntax like `π cols Table`), the last
 * space-separated token is the operand, not part of the subscript.
 * Returns [newIndex, extractedContent] or [originalIndex, null] if nothing found.
 */
export function extractImplicitSubscript(code: string, startI: number, beforeWs: number): [number, string | null] {
  let i = startI;
  if (code[i] === "(" || i <= beforeWs) return [startI, null];

  let content = "";
  let hitBoundary = false; // true if we stopped at '(' or an RA operator
  while (i < code.length && code[i] !== "\n") {
    if (code[i] === "(") { hitBoundary = true; break; }

    // Stop if we hit a unary/binary Unicode symbol (next operator)
    if (UNARY_SYMBOLS.has(code[i]) || BINARY_SYMBOLS.has(code[i])) { hitBoundary = true; break; }

    // Stop if we hit an RA operator keyword (e.g., SIGMA, PI, cross, natjoin)
    if (IDENT_START.test(code[i])) {
      let word = "";
      let j = i;
      while (j < code.length && IDENT_CHAR.test(code[j])) { word += code[j]; j++; }
      if (RA_OPERATOR_KEYWORDS.has(word.toLowerCase())) { hitBoundary = true; break; }
      content += word;
      i = j;
      continue;
    }

    content += code[i];
    i++;
  }
  const trimmed = content.trimEnd();
  const trimDiff = content.length - trimmed.length;
  if (trimDiff > 0) i -= trimDiff;

  if (trimmed.length > 0) {
    // If we stopped at a clear boundary ('(' or another operator), the entire
    // scanned content is the subscript.
    if (hitBoundary) {
      return [i, trimmed];
    }
    // Otherwise we hit end-of-line / end-of-input — the last token is the
    // operand (table name), not part of the subscript.
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace > 0) {
      const sub = trimmed.slice(0, lastSpace).trimEnd();
      if (sub.length > 0) {
        i = startI + sub.length;
        return [i, sub];
      }
    }
    // Single token with no parens — it's the operand, not a subscript
    return [startI, null];
  }
  return [startI, null];
}
