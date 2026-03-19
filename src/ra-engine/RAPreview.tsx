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
 */

const previewWrap = (type: string, text: string) =>
  `<span class="ra-prev-${type}">${text}</span>`;

function renderSubscriptHtml(content: string): string {
  return `<sub class="ra-prev-sub">${highlightSubContent(content, previewWrap)}</sub>`;
}

/** Consume a subscript and return [newIndex, html] */
function consumeSubscript(code: string, i: number): [number, string] {
  const beforeWs = i;
  const wsI = skipWs(code, i);

  // Try bracket content
  const [bracketI, bracketContent] = extractBracketContent(code, i);
  if (bracketContent !== null) {
    return [bracketI, renderSubscriptHtml(bracketContent)];
  }

  // Try implicit subscript
  const [implI, implContent] = extractImplicitSubscript(code, wsI, beforeWs);
  if (implContent !== null) {
    return [implI, renderSubscriptHtml(implContent)];
  }

  return [beforeWs, ""];
}

export function renderRAPreview(code: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < code.length) {
    // Comments
    if (code[i] === "-" && i + 1 < code.length && code[i + 1] === "-") {
      let comment = "";
      while (i < code.length && code[i] !== "\n") { comment += code[i]; i++; }
      result.push(`<span class="ra-prev-comment">${esc(comment)}</span>`);
      continue;
    }

    if (code[i] === "\n") {
      result.push("<br/>");
      i++;
      continue;
    }

    // Unicode unary operators
    if (UNARY_SYMBOLS.has(code[i])) {
      result.push(`<span class="ra-prev-op">${esc(code[i])}</span>`);
      i++;
      const [newI, html] = consumeSubscript(code, i);
      i = newI;
      result.push(html);
      continue;
    }

    // |X| or |><| natural join
    if (code[i] === "|") {
      if (i + 2 < code.length && (code[i + 1] === "X" || code[i + 1] === "x") && code[i + 2] === "|") {
        result.push("<span class=\"ra-prev-op\">⋈</span>");
        i += 3;
        continue;
      }
      if (i + 3 < code.length && code[i + 1] === ">" && code[i + 2] === "<" && code[i + 3] === "|") {
        result.push("<span class=\"ra-prev-op\">⋈</span>");
        i += 4;
        continue;
      }
    }

    // Binary symbols
    if (BINARY_SYMBOLS.has(code[i])) {
      result.push(`<span class="ra-prev-op">${esc(code[i])}</span>`);
      i++;
      if (i < code.length && (code[i] === "[" || code[i] === "{" || code[i] === "_")) {
        const [newI, html] = consumeSubscript(code, i);
        i = newI;
        result.push(html);
      }
      continue;
    }

    // <- assignment
    if (code[i] === "<" && i + 1 < code.length && code[i + 1] === "-") {
      result.push("<span class=\"ra-prev-assign\">←</span>");
      i += 2;
      continue;
    }

    // -> rename
    if (code[i] === "-" && i + 1 < code.length && code[i + 1] === ">") {
      result.push("<span class=\"ra-prev-op\">→</span>");
      i += 2;
      continue;
    }

    // String literals
    if (code[i] === "'") {
      let str = "'";
      i++;
      while (i < code.length && code[i] !== "'") { str += code[i]; i++; }
      if (i < code.length) { str += "'"; i++; }
      result.push(`<span class="ra-prev-str">${esc(str)}</span>`);
      continue;
    }

    // Numbers
    if (/\d/.test(code[i])) {
      let num = "";
      while (i < code.length && /[\d.]/.test(code[i])) { num += code[i]; i++; }
      result.push(`<span class="ra-prev-num">${esc(num)}</span>`);
      continue;
    }

    // Identifiers and keywords
    if (IDENT_START.test(code[i])) {
      let ident = "";
      while (i < code.length && IDENT_CHAR.test(code[i])) { ident += code[i]; i++; }
      const lower = ident.toLowerCase();
      if (UNARY_KEYWORD_SYMBOLS[lower]) {
        result.push(`<span class="ra-prev-op">${UNARY_KEYWORD_SYMBOLS[lower]}</span>`);
        const [newI, html] = consumeSubscript(code, i);
        i = newI;
        result.push(html);
      } else if (BINARY_KEYWORD_SYMBOLS[lower]) {
        result.push(`<span class="ra-prev-op">${BINARY_KEYWORD_SYMBOLS[lower]}</span>`);
        const j = skipWs(code, i);
        if (j < code.length && (code[j] === "[" || code[j] === "{" || code[j] === "_")) {
          const [newI, html] = consumeSubscript(code, j);
          i = newI;
          result.push(html);
        }
      } else if (LOGIC_KEYWORDS.has(lower)) {
        result.push(`<span class="ra-prev-logic">${esc(ident)}</span>`);
      } else {
        result.push(esc(ident));
      }
      continue;
    }

    // Comparison operators
    if ("<>!=".includes(code[i])) {
      let op = code[i]; i++;
      if (i < code.length && (code[i] === "=" || code[i] === ">")) { op += code[i]; i++; }
      result.push(`<span class="ra-prev-logic">${esc(op)}</span>`);
      continue;
    }

    // Everything else
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
        className="font-serif text-base px-3 py-2 rounded-md bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
