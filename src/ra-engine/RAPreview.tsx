/*
Relational Algebra engine for sql-validator
Copyright (C) 2026 E.SU. IT AB (Org.no 559484-0505) and Edwin Sundberg <edwin@edthing.com>

Licensed under the Business Source License 1.1 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License in the LICENSE.md file in this repository.
*/

import { useMemo } from "react";
import {
  UNARY_SYMBOLS, BINARY_SYMBOLS,
  LOGIC_KEYWORDS, UNARY_KEYWORD_SYMBOLS, BINARY_KEYWORD_SYMBOLS,
  IDENT_START, IDENT_CHAR,
  esc, skipWs, highlightSubContent, extractBracketContent, extractImplicitSubscript,
} from "./raShared";

/**
 * Renders a relational algebra expression with proper formatting:
 * - Keyword operators replaced with Unicode symbols
 * - Bracket content rendered as subscripts using <sub> tags
 * - Assignment arrows rendered as ←
 *
 * Two modes:
 * - CSS classes (default): uses .ra-prev-* classes from App.css, supports dark: variants
 * - Inline styles (forExport=true): hardcoded light colors for PNG export on white background
 */

// Inline styles for export only (always light, white background)
const EXPORT_STYLES = {
  op: "color: #7c3aed; font-weight: bold;",
  logic: "color: #1d4ed8; font-weight: bold;",
  str: "color: #047857;",
  num: "color: #b45309;",
  comment: "color: #6b7280; font-style: italic;",
  assign: "color: #7c3aed; font-weight: bold;",
  sub: "font-size: 0.9em; color: #1f2937;",
  paren: "color: #9ca3af;",
};

type TagFn = (token: string, content: string) => string;
type SubFn = (content: string) => string;

function cssTag(token: string, content: string): string {
  return `<span class="ra-prev-${token}">${content}</span>`;
}

function cssSub(content: string): string {
  return `<sub class="ra-prev-sub">${content}</sub>`;
}

function makeExportTag(): TagFn {
  return (token: string, content: string) => {
    const style = EXPORT_STYLES[token as keyof typeof EXPORT_STYLES] || "";
    return style ? `<span style="${style}">${content}</span>` : content;
  };
}

function makeExportSub(): SubFn {
  return (content: string) => `<sub style="${EXPORT_STYLES.sub}">${content}</sub>`;
}

function makeSubWrap(tag: TagFn) {
  return (type: string, text: string) => tag(type, text);
}

function renderSubscriptHtml(content: string, tag: TagFn, sub: SubFn): string {
  return sub(highlightSubContent(content, makeSubWrap(tag)));
}

/** Consume a subscript and return [newIndex, html] */
function consumeSubscript(code: string, i: number, tag: TagFn, sub: SubFn): [number, string] {
  const beforeWs = i;
  const wsI = skipWs(code, i);

  const [bracketI, bracketContent] = extractBracketContent(code, i);
  if (bracketContent !== null) {
    return [bracketI, renderSubscriptHtml(bracketContent, tag, sub)];
  }

  const [implI, implContent] = extractImplicitSubscript(code, wsI, beforeWs);
  if (implContent !== null) {
    return [implI, renderSubscriptHtml(implContent, tag, sub)];
  }

  return [beforeWs, ""];
}

export function renderRAPreview(code: string, forExport = false): string {
  const tag: TagFn = forExport ? makeExportTag() : cssTag;
  const sub: SubFn = forExport ? makeExportSub() : cssSub;
  const result: string[] = [];
  let i = 0;

  while (i < code.length) {
    if (code[i] === "-" && i + 1 < code.length && code[i + 1] === "-") {
      let comment = "";
      while (i < code.length && code[i] !== "\n") { comment += code[i]; i++; }
      result.push(tag("comment", esc(comment)));
      continue;
    }

    if (code[i] === "\n") {
      result.push("<br/>");
      i++;
      continue;
    }

    if (UNARY_SYMBOLS.has(code[i])) {
      result.push(tag("op", esc(code[i])));
      i++;
      const [newI, html] = consumeSubscript(code, i, tag, sub);
      i = newI;
      result.push(html);
      continue;
    }

    if (code[i] === "|") {
      if (i + 2 < code.length && (code[i + 1] === "X" || code[i + 1] === "x") && code[i + 2] === "|") {
        result.push(tag("op", "⋈"));
        i += 3;
        continue;
      }
      if (i + 3 < code.length && code[i + 1] === ">" && code[i + 2] === "<" && code[i + 3] === "|") {
        result.push(tag("op", "⋈"));
        i += 4;
        continue;
      }
    }

    if (BINARY_SYMBOLS.has(code[i])) {
      result.push(tag("op", esc(code[i])));
      i++;
      if (i < code.length && (code[i] === "[" || code[i] === "{" || code[i] === "_")) {
        const [newI, html] = consumeSubscript(code, i, tag, sub);
        i = newI;
        result.push(html);
      }
      continue;
    }

    if (code[i] === "<" && i + 1 < code.length && code[i + 1] === "-") {
      result.push(tag("assign", "←"));
      i += 2;
      continue;
    }

    if (code[i] === "-" && i + 1 < code.length && code[i + 1] === ">") {
      result.push(tag("op", "→"));
      i += 2;
      continue;
    }

    if (code[i] === "'") {
      let str = "'";
      i++;
      while (i < code.length && code[i] !== "'") { str += code[i]; i++; }
      if (i < code.length) { str += "'"; i++; }
      result.push(tag("str", esc(str)));
      continue;
    }

    if (/\d/.test(code[i])) {
      let num = "";
      while (i < code.length && /[\d.]/.test(code[i])) { num += code[i]; i++; }
      result.push(tag("num", esc(num)));
      continue;
    }

    if (IDENT_START.test(code[i])) {
      let ident = "";
      while (i < code.length && IDENT_CHAR.test(code[i])) { ident += code[i]; i++; }
      const lower = ident.toLowerCase();
      if (UNARY_KEYWORD_SYMBOLS[lower]) {
        result.push(tag("op", UNARY_KEYWORD_SYMBOLS[lower]));
        const [newI, html] = consumeSubscript(code, i, tag, sub);
        i = newI;
        result.push(html);
      } else if (BINARY_KEYWORD_SYMBOLS[lower]) {
        result.push(tag("op", BINARY_KEYWORD_SYMBOLS[lower]));
        const j = skipWs(code, i);
        if (j < code.length && (code[j] === "[" || code[j] === "{" || code[j] === "_")) {
          const [newI, html] = consumeSubscript(code, j, tag, sub);
          i = newI;
          result.push(html);
        }
      } else if (LOGIC_KEYWORDS.has(lower)) {
        result.push(tag("logic", esc(ident)));
      } else {
        result.push(esc(ident));
      }
      continue;
    }

    if ("<>!=".includes(code[i])) {
      let op = code[i]; i++;
      if (i < code.length && (code[i] === "=" || code[i] === ">")) { op += code[i]; i++; }
      result.push(tag("logic", esc(op)));
      continue;
    }

    if (code[i] === "(" || code[i] === ")") {
      result.push(tag("paren", esc(code[i])));
      i++;
      continue;
    }

    result.push(esc(code[i]));
    i++;
  }

  return result.join("");
}

interface RAPreviewProps {
  code: string;
}

export default function RAPreview({ code }: RAPreviewProps) {
  const html = useMemo(() => {
    const trimmed = code.trim();
    if (!trimmed || trimmed.startsWith("--") && !trimmed.includes("\n")) {
      return null;
    }
    return renderRAPreview(trimmed);
  }, [code]);

  if (!html) return null;

  return (
    <div className="w-full max-w-4xl mt-2">
      <div
        className="font-mono text-base text-left px-3 py-2 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
