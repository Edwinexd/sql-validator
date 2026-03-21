/**
 * CodeMirror StreamLanguage definition for relational algebra syntax.
 * Maps tokens to CodeMirror tag names for theme-based highlighting.
 */
import { StreamLanguage, type StreamParser } from "@codemirror/language";
import {
  UNARY_SYMBOLS, BINARY_SYMBOLS, UNARY_KEYWORDS, BINARY_KEYWORDS,
  LOGIC_KEYWORDS, IDENT_START, IDENT_CHAR,
} from "./raShared";

interface RAState {
  inComment: boolean;
}

const raParser: StreamParser<RAState> = {
  startState(): RAState {
    return { inComment: false };
  },

  token(stream, _state): string | null {
    // Comments: -- until end of line
    if (stream.match("--")) {
      stream.skipToEnd();
      return "comment";
    }

    // Skip whitespace
    if (stream.eatSpace()) return null;

    const ch = stream.peek()!;

    // Unary operator symbols (σ, π, ρ, γ, τ, δ)
    if (UNARY_SYMBOLS.has(ch)) {
      stream.next();
      return "keyword";
    }

    // Binary operator symbols (×, ⋈, ∪, ∩, etc.)
    if (BINARY_SYMBOLS.has(ch)) {
      stream.next();
      return "keyword";
    }

    // → rename arrow
    if (ch === "→") {
      stream.next();
      return "keyword";
    }

    // |X| or |><| natural join
    if (ch === "|") {
      if (stream.match(/^\|[Xx]\|/) || stream.match(/^\|><\|/)) {
        return "keyword";
      }
      stream.next();
      return null;
    }

    // <- assignment
    if (ch === "<" && stream.match("<-")) {
      return "keyword";
    }

    // -> rename arrow
    if (ch === "-" && stream.match("->")) {
      return "keyword";
    }

    // String literals
    if (ch === "'") {
      stream.next();
      while (!stream.eol()) {
        if (stream.next() === "'") break;
      }
      return "string";
    }

    // Numbers
    if (/\d/.test(ch)) {
      stream.match(/^\d[\d.]*/);
      return "number";
    }

    // Brackets — styled as punctuation
    if ("[]{}".includes(ch)) {
      stream.next();
      return "bracket";
    }

    // Underscore before bracket (LaTeX-style subscript prefix)
    if (ch === "_") {
      const pos = stream.pos;
      stream.next();
      // Peek ahead past spaces
      const rest = stream.string.slice(stream.pos).trimStart();
      if (rest.length > 0 && (rest[0] === "{" || rest[0] === "[")) {
        return "bracket";
      }
      // Not a subscript prefix — fall through, reset nothing (already consumed)
      // Check if it's part of an identifier
      if (stream.pos < stream.string.length && IDENT_CHAR.test(stream.string[stream.pos])) {
        stream.backUp(1);
        stream.pos = pos;
        // Let the identifier handler below pick it up
      } else {
        return null;
      }
    }

    // Identifiers and keywords
    if (IDENT_START.test(ch)) {
      const wordStart = stream.pos;
      while (!stream.eol() && IDENT_CHAR.test(stream.string[stream.pos])) {
        stream.pos++;
      }
      const word = stream.string.slice(wordStart, stream.pos);
      if (word.length === 0) {
        stream.next();
        return null;
      }
      const lower = word.toLowerCase();
      if (UNARY_KEYWORDS.has(lower) || BINARY_KEYWORDS.has(lower)) {
        return "keyword";
      }
      if (LOGIC_KEYWORDS.has(lower)) {
        return "operator";
      }
      return "variableName";
    }

    // Comparison operators
    if ("<>!=".includes(ch)) {
      stream.next();
      if (!stream.eol() && "=>".includes(stream.peek()!)) {
        stream.next();
      }
      return "operator";
    }

    // Everything else
    stream.next();
    return null;
  },
};

export const raStreamLanguage = StreamLanguage.define(raParser);
