/*
Relational Algebra engine for sql-validator
Copyright (C) 2026 E.SU. IT AB (Org.no 559484-0505) and Edwin Sundberg <edwin@edthing.com>

Licensed under the Business Source License 1.1 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License in the LICENSE.md file in this repository.
*/

import type { DatabaseEngine } from "../database/types";

// ─── Token Types ────────────────────────────────────────────────────────────

enum TokenType {
  // Unary operators
  SIGMA = "SIGMA",       // σ or sigma
  PI = "PI",             // π or pi
  RHO = "RHO",           // ρ or rho
  GAMMA = "GAMMA",       // γ or gamma (grouping/aggregation)
  TAU = "TAU",           // τ or tau (sorting)
  DELTA = "DELTA",       // δ or delta (duplicate elimination / DISTINCT)
  // Binary operators
  CROSS = "CROSS",       // × or cross
  NATJOIN = "NATJOIN",   // ⋈ or natjoin
  JOIN = "JOIN",         // join (theta join with condition)
  UNION = "UNION",       // ∪ or union
  INTERSECT = "INTERSECT", // ∩ or intersect
  MINUS = "MINUS",       // − or minus or \
  DIVIDE = "DIVIDE",     // ÷ or divide
  LEFTJOIN = "LEFTJOIN", // ⟕ or leftjoin
  RIGHTJOIN = "RIGHTJOIN", // ⟖ or rightjoin
  FULLJOIN = "FULLJOIN", // ⟗ or fulljoin
  LEFTSEMIJOIN = "LEFTSEMIJOIN",   // ⋉ or leftsemijoin
  RIGHTSEMIJOIN = "RIGHTSEMIJOIN", // ⋊ or rightsemijoin
  ANTIJOIN = "ANTIJOIN", // ▷ or antijoin
  // Delimiters
  LPAREN = "LPAREN",     // (
  RPAREN = "RPAREN",     // )
  LBRACKET = "LBRACKET", // [
  RBRACKET = "RBRACKET", // ]
  COMMA = "COMMA",       // ,
  // Identifiers, literals
  IDENTIFIER = "IDENTIFIER",
  NUMBER = "NUMBER",
  STRING = "STRING",     // 'value'
  // Condition tokens (passed through inside brackets)
  CONDITION = "CONDITION",
  // Operators within conditions
  EQ = "EQ",             // =
  NEQ = "NEQ",           // <> or !=
  LT = "LT",             // <
  GT = "GT",             // >
  LTE = "LTE",           // <=
  GTE = "GTE",           // >=
  AND = "AND",
  OR = "OR",
  NOT = "NOT",
  DOT = "DOT",           // .
  ARROW = "ARROW",       // → or ->
  ASSIGN = "ASSIGN",     // ← or <-
  SEMICOLON = "SEMICOLON",
  NEWLINE = "NEWLINE",   // line break (statement separator)
  EOF = "EOF",
}

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

// ─── Tokenizer ──────────────────────────────────────────────────────────────

// Unicode symbol → TokenType map
const UNICODE_OPS: Record<string, TokenType> = {
  "σ": TokenType.SIGMA,
  "π": TokenType.PI,
  "ρ": TokenType.RHO,
  "γ": TokenType.GAMMA,
  "τ": TokenType.TAU,
  "δ": TokenType.DELTA,
  "×": TokenType.CROSS,
  "⋈": TokenType.NATJOIN,
  "∪": TokenType.UNION,
  "∩": TokenType.INTERSECT,
  "−": TokenType.MINUS,
  "÷": TokenType.DIVIDE,
  "⟕": TokenType.LEFTJOIN,
  "⟖": TokenType.RIGHTJOIN,
  "⟗": TokenType.FULLJOIN,
  "⋉": TokenType.LEFTSEMIJOIN,
  "⋊": TokenType.RIGHTSEMIJOIN,
  "▷": TokenType.ANTIJOIN,
  "←": TokenType.ASSIGN,
};

// Keyword → TokenType map (case-insensitive)
const KEYWORD_OPS: Record<string, TokenType> = {
  "sigma": TokenType.SIGMA,
  "select": TokenType.SIGMA,
  "pi": TokenType.PI,
  "project": TokenType.PI,
  "rho": TokenType.RHO,
  "rename": TokenType.RHO,
  "gamma": TokenType.GAMMA,
  "tau": TokenType.TAU,
  "sort": TokenType.TAU,
  "delta": TokenType.DELTA,
  "distinct": TokenType.DELTA,
  "cross": TokenType.CROSS,
  "natjoin": TokenType.NATJOIN,
  "join": TokenType.JOIN,
  "union": TokenType.UNION,
  "intersect": TokenType.INTERSECT,
  "minus": TokenType.MINUS,
  "divide": TokenType.DIVIDE,
  "leftjoin": TokenType.LEFTJOIN,
  "rightjoin": TokenType.RIGHTJOIN,
  "fulljoin": TokenType.FULLJOIN,
  "leftsemijoin": TokenType.LEFTSEMIJOIN,
  "rightsemijoin": TokenType.RIGHTSEMIJOIN,
  "antijoin": TokenType.ANTIJOIN,
  "and": TokenType.AND,
  "or": TokenType.OR,
  "not": TokenType.NOT,
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip comments (lines starting with --)
    if (input[i] === "-" && i + 1 < input.length && input[i + 1] === "-") {
      while (i < input.length && input[i] !== "\n") i++;
      continue;
    }

    // Emit newlines as statement separators, skip other whitespace
    if (input[i] === "\n" || input[i] === "\r") {
      // Skip consecutive newlines and emit at most one NEWLINE token
      while (i < input.length && (input[i] === "\n" || input[i] === "\r")) i++;
      // Only emit if there are tokens before this (not leading newlines)
      // and the last token isn't already a newline/semicolon
      if (tokens.length > 0 &&
          tokens[tokens.length - 1].type !== TokenType.NEWLINE &&
          tokens[tokens.length - 1].type !== TokenType.SEMICOLON) {
        tokens.push({ type: TokenType.NEWLINE, value: "\\n", pos: i });
      }
      continue;
    }
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    const pos = i;
    const ch = input[i];

    // Check for Unicode operators
    if (UNICODE_OPS[ch]) {
      tokens.push({ type: UNICODE_OPS[ch], value: ch, pos });
      i++;
      continue;
    }

    // Single-char tokens
    if (ch === "(") { tokens.push({ type: TokenType.LPAREN, value: ch, pos }); i++; continue; }
    if (ch === ")") { tokens.push({ type: TokenType.RPAREN, value: ch, pos }); i++; continue; }
    if (ch === "[") { tokens.push({ type: TokenType.LBRACKET, value: ch, pos }); i++; continue; }
    if (ch === "]") { tokens.push({ type: TokenType.RBRACKET, value: ch, pos }); i++; continue; }
    // Curly braces as alternative to square brackets (LaTeX-style σ_{cond})
    if (ch === "{") { tokens.push({ type: TokenType.LBRACKET, value: ch, pos }); i++; continue; }
    if (ch === "}") { tokens.push({ type: TokenType.RBRACKET, value: ch, pos }); i++; continue; }
    // Underscore: skip silently (allows LaTeX-style σ_{cond} — the _ is just decoration)
    if (ch === "_") { i++; continue; }
    if (ch === ",") { tokens.push({ type: TokenType.COMMA, value: ch, pos }); i++; continue; }
    if (ch === ".") { tokens.push({ type: TokenType.DOT, value: ch, pos }); i++; continue; }
    if (ch === ";") { tokens.push({ type: TokenType.SEMICOLON, value: ch, pos }); i++; continue; }
    if (ch === "\\") { tokens.push({ type: TokenType.MINUS, value: ch, pos }); i++; continue; }

    // |X| or |><| — natural join
    if (ch === "|") {
      // Check for |X|
      if (i + 2 < input.length && (input[i + 1] === "X" || input[i + 1] === "x") && input[i + 2] === "|") {
        tokens.push({ type: TokenType.JOIN, value: "|X|", pos });
        i += 3;
        continue;
      }
      // Check for |><|
      if (i + 3 < input.length && input[i + 1] === ">" && input[i + 2] === "<" && input[i + 3] === "|") {
        tokens.push({ type: TokenType.JOIN, value: "|><|", pos });
        i += 4;
        continue;
      }
    }

    // Arrow: → or ->
    if (ch === "→") { tokens.push({ type: TokenType.ARROW, value: ch, pos }); i++; continue; }
    if (ch === "-" && i + 1 < input.length && input[i + 1] === ">") {
      tokens.push({ type: TokenType.ARROW, value: "->", pos });
      i += 2;
      continue;
    }

    // Assignment: <- (must be checked before comparison operators)
    if (ch === "<" && i + 1 < input.length && input[i + 1] === "-") {
      tokens.push({ type: TokenType.ASSIGN, value: "<-", pos }); i += 2; continue;
    }

    // Comparison operators
    if (ch === "=" ) { tokens.push({ type: TokenType.EQ, value: "=", pos }); i++; continue; }
    if (ch === "<" && i + 1 < input.length && input[i + 1] === ">") {
      tokens.push({ type: TokenType.NEQ, value: "<>", pos }); i += 2; continue;
    }
    if (ch === "!" && i + 1 < input.length && input[i + 1] === "=") {
      tokens.push({ type: TokenType.NEQ, value: "!=", pos }); i += 2; continue;
    }
    if (ch === "<" && i + 1 < input.length && input[i + 1] === "=") {
      tokens.push({ type: TokenType.LTE, value: "<=", pos }); i += 2; continue;
    }
    if (ch === ">" && i + 1 < input.length && input[i + 1] === "=") {
      tokens.push({ type: TokenType.GTE, value: ">=", pos }); i += 2; continue;
    }
    if (ch === "<") { tokens.push({ type: TokenType.LT, value: "<", pos }); i++; continue; }
    if (ch === ">") { tokens.push({ type: TokenType.GT, value: ">", pos }); i++; continue; }

    // Minus (as set difference) when not part of ->
    if (ch === "-") { tokens.push({ type: TokenType.MINUS, value: "-", pos }); i++; continue; }

    // String literals
    if (ch === "'") {
      let str = "";
      i++; // skip opening quote
      while (i < input.length && input[i] !== "'") {
        if (input[i] === "\\" && i + 1 < input.length) {
          str += input[i + 1];
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      if (i >= input.length) throw new RAError(`Unterminated string literal at position ${pos}`);
      i++; // skip closing quote
      tokens.push({ type: TokenType.STRING, value: str, pos });
      continue;
    }

    // Numbers
    if (/\d/.test(ch)) {
      let num = "";
      while (i < input.length && /[\d.]/.test(input[i])) {
        num += input[i];
        i++;
      }
      tokens.push({ type: TokenType.NUMBER, value: num, pos });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_\u00C0-\u024F]/.test(ch)) {
      let ident = "";
      while (i < input.length && /[a-zA-Z0-9_\u00C0-\u024F]/.test(input[i])) {
        ident += input[i];
        i++;
      }
      const lower = ident.toLowerCase();
      if (KEYWORD_OPS[lower]) {
        tokens.push({ type: KEYWORD_OPS[lower], value: ident, pos });
      } else {
        tokens.push({ type: TokenType.IDENTIFIER, value: ident, pos });
      }
      continue;
    }

    throw new RAError(`Unexpected character '${ch}' at position ${pos}`);
  }

  tokens.push({ type: TokenType.EOF, value: "", pos: i });
  return tokens;
}

// ─── AST Node Types ─────────────────────────────────────────────────────────

type RANode =
  | TableNode
  | SelectionNode
  | ProjectionNode
  | RenameNode
  | GroupNode
  | SortNode
  | DistinctNode
  | CrossProductNode
  | NaturalJoinNode
  | ThetaJoinNode
  | LeftJoinNode
  | RightJoinNode
  | FullJoinNode
  | LeftSemiJoinNode
  | RightSemiJoinNode
  | AntiJoinNode
  | UnionNode
  | IntersectNode
  | DifferenceNode
  | DivisionNode;

interface TableNode { type: "table"; name: string }
interface SelectionNode { type: "selection"; condition: ConditionNode; relation: RANode }
interface ProjectionNode { type: "projection"; columns: ColumnRef[]; relation: RANode }
interface RenameNode { type: "rename"; mappings: RenameMapping[]; relation: RANode }
interface GroupNode { type: "group"; groupBy: ColumnRef[]; aggregates: AggregateExpr[]; relation: RANode }
interface SortNode { type: "sort"; columns: SortColumn[]; relation: RANode }
interface DistinctNode { type: "distinct"; relation: RANode }
interface CrossProductNode { type: "crossProduct"; left: RANode; right: RANode }
interface NaturalJoinNode { type: "naturalJoin"; left: RANode; right: RANode }
interface ThetaJoinNode { type: "thetaJoin"; condition: ConditionNode; left: RANode; right: RANode }
interface LeftJoinNode { type: "leftJoin"; condition: ConditionNode; left: RANode; right: RANode }
interface RightJoinNode { type: "rightJoin"; condition: ConditionNode; left: RANode; right: RANode }
interface FullJoinNode { type: "fullJoin"; condition: ConditionNode; left: RANode; right: RANode }
interface LeftSemiJoinNode { type: "leftSemiJoin"; left: RANode; right: RANode }
interface RightSemiJoinNode { type: "rightSemiJoin"; left: RANode; right: RANode }
interface AntiJoinNode { type: "antiJoin"; left: RANode; right: RANode }
interface UnionNode { type: "union"; left: RANode; right: RANode }
interface IntersectNode { type: "intersect"; left: RANode; right: RANode }
interface DifferenceNode { type: "difference"; left: RANode; right: RANode }
interface DivisionNode { type: "division"; left: RANode; right: RANode }

interface ColumnRef { table?: string; column: string }
interface RenameMapping { from: string; to: string }
interface SortColumn { column: ColumnRef; desc: boolean }
interface AggregateExpr { func: string; column: ColumnRef; alias?: string }

type ConditionNode =
  | ComparisonNode
  | AndNode
  | OrNode
  | NotNode;

interface ComparisonNode { type: "comparison"; left: ValueExpr; op: string; right: ValueExpr }
interface AndNode { type: "and"; left: ConditionNode; right: ConditionNode }
interface OrNode { type: "or"; left: ConditionNode; right: ConditionNode }
interface NotNode { type: "not"; operand: ConditionNode }

type ValueExpr =
  | ColumnRefExpr
  | StringLiteral
  | NumberLiteral
  | FunctionCallExpr;

interface ColumnRefExpr { type: "columnRef"; ref: ColumnRef }
interface StringLiteral { type: "string"; value: string }
interface NumberLiteral { type: "number"; value: string }
interface FunctionCallExpr { type: "functionCall"; name: string; args: ValueExpr[] }

// ─── Error Type ─────────────────────────────────────────────────────────────

export class RAError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RAError";
  }
}

// ─── Parser ─────────────────────────────────────────────────────────────────

interface RAProgram {
  assignments: { name: string; expr: RANode }[];
  result: RANode;
}

class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new RAError(`Expected ${type} but got ${token.type} ('${token.value}') at position ${token.pos}`);
    }
    return this.advance();
  }

  private match(type: TokenType): boolean {
    if (this.peek().type === type) {
      this.advance();
      return true;
    }
    return false;
  }

  // Grammar (precedence low→high):
  //   expr      = union_expr
  //   union_expr = intersect_expr (( ∪ | − ) intersect_expr)*
  //   intersect_expr = join_expr ( ∩ join_expr)*
  //   join_expr = unary_expr (( × | ⋈ | ⋈[cond] | join[cond] | ÷ | ⟕[cond] | ⟖[cond] | ⟗[cond] | ⋉ | ⋊ | ▷ ) unary_expr)*
  //   unary_expr = (σ[cond] | π[cols] | ρ[mappings] | γ[...] | τ[...] | δ) unary_expr | primary
  //   primary = IDENTIFIER | '(' expr ')'

  parse(): RAProgram {
    const assignments: { name: string; expr: RANode }[] = [];

    // Skip leading newlines
    while (this.peek().type === TokenType.NEWLINE) this.advance();

    while (this.peek().type !== TokenType.EOF) {
      // Try to detect assignment: IDENTIFIER (← | <-) expr
      if (this.peek().type === TokenType.IDENTIFIER) {
        const saved = this.pos;
        const name = this.advance().value;
        if (this.peek().type === TokenType.ASSIGN) {
          this.advance(); // consume ← / <-
          const expr = this.parseUnionExpr();
          assignments.push({ name, expr });
          // Consume statement separator (newline, semicolon, or EOF)
          while (this.peek().type === TokenType.SEMICOLON || this.peek().type === TokenType.NEWLINE) {
            this.advance();
          }
          continue;
        }
        // Not an assignment — backtrack and parse as expression
        this.pos = saved;
      }

      // Parse the final result expression
      const result = this.parseUnionExpr();
      // Consume trailing separators
      while (this.peek().type === TokenType.SEMICOLON || this.peek().type === TokenType.NEWLINE) {
        this.advance();
      }
      if (this.peek().type !== TokenType.EOF) {
        throw new RAError(`Unexpected token '${this.peek().value}' at position ${this.peek().pos}`);
      }
      return { assignments, result };
    }

    // If we only have assignments and no final expression, implicitly return the last assigned variable
    if (assignments.length > 0) {
      const lastName = assignments[assignments.length - 1].name;
      return { assignments, result: { type: "table", name: lastName } };
    }

    throw new RAError("Empty expression");
  }

  private parseUnionExpr(): RANode {
    let left = this.parseIntersectExpr();
    while (this.peek().type === TokenType.UNION || this.peek().type === TokenType.MINUS) {
      const op = this.advance();
      const right = this.parseIntersectExpr();
      if (op.type === TokenType.UNION) {
        left = { type: "union", left, right };
      } else {
        left = { type: "difference", left, right };
      }
    }
    return left;
  }

  private parseIntersectExpr(): RANode {
    let left = this.parseJoinExpr();
    while (this.peek().type === TokenType.INTERSECT) {
      this.advance();
      const right = this.parseJoinExpr();
      left = { type: "intersect", left, right };
    }
    return left;
  }

  private parseJoinExpr(): RANode {
    let left = this.parseUnaryExpr();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const t = this.peek().type;
      if (t === TokenType.CROSS) {
        this.advance();
        const right = this.parseUnaryExpr();
        left = { type: "crossProduct", left, right };
      } else if (t === TokenType.NATJOIN) {
        this.advance();
        // Check if there's a condition: ⋈[cond]
        if (this.peek().type === TokenType.LBRACKET) {
          const condition = this.parseBracketedCondition();
          const right = this.parseUnaryExpr();
          left = { type: "thetaJoin", condition, left, right };
        } else {
          const right = this.parseUnaryExpr();
          left = { type: "naturalJoin", left, right };
        }
      } else if (t === TokenType.JOIN) {
        this.advance();
        if (this.peek().type === TokenType.LBRACKET) {
          const condition = this.parseBracketedCondition();
          const right = this.parseUnaryExpr();
          left = { type: "thetaJoin", condition, left, right };
        } else {
          // join without condition = natural join
          const right = this.parseUnaryExpr();
          left = { type: "naturalJoin", left, right };
        }
      } else if (t === TokenType.DIVIDE) {
        this.advance();
        const right = this.parseUnaryExpr();
        left = { type: "division", left, right };
      } else if (t === TokenType.LEFTJOIN) {
        this.advance();
        const condition = this.parseBracketedCondition();
        const right = this.parseUnaryExpr();
        left = { type: "leftJoin", condition, left, right };
      } else if (t === TokenType.RIGHTJOIN) {
        this.advance();
        const condition = this.parseBracketedCondition();
        const right = this.parseUnaryExpr();
        left = { type: "rightJoin", condition, left, right };
      } else if (t === TokenType.FULLJOIN) {
        this.advance();
        const condition = this.parseBracketedCondition();
        const right = this.parseUnaryExpr();
        left = { type: "fullJoin", condition, left, right };
      } else if (t === TokenType.LEFTSEMIJOIN) {
        this.advance();
        const right = this.parseUnaryExpr();
        left = { type: "leftSemiJoin", left, right };
      } else if (t === TokenType.RIGHTSEMIJOIN) {
        this.advance();
        const right = this.parseUnaryExpr();
        left = { type: "rightSemiJoin", left, right };
      } else if (t === TokenType.ANTIJOIN) {
        this.advance();
        const right = this.parseUnaryExpr();
        left = { type: "antiJoin", left, right };
      } else {
        break;
      }
    }
    return left;
  }

  /**
   * Check if the next token starts a subscript (bracket or implicit).
   * Returns true if it's `[`, `{`, or any non-`(` token that could begin
   * an implicit subscript (i.e., the subscript content before `(`).
   */
  private hasSubscript(): boolean {
    return this.peek().type === TokenType.LBRACKET || this.peek().type !== TokenType.LPAREN;
  }

  /**
   * Parse a subscript that may be:
   * 1. Bracketed: `[...]` or `{...}`
   * 2. Implicit: tokens up to the next unmatched `(`
   *
   * For implicit subscripts, we temporarily inject LBRACKET/RBRACKET
   * around the subscript tokens so the same parsing logic can be reused.
   */
  private parseSubscriptCondition(): ConditionNode {
    if (this.peek().type === TokenType.LBRACKET) {
      return this.parseBracketedCondition();
    }
    // Implicit subscript: parse condition tokens until we hit LPAREN
    // We parse directly — the condition ends when we encounter LPAREN at depth 0
    const cond = this.parseOrCondition();
    return cond;
  }

  private parseSubscriptColumns(): ColumnRef[] {
    if (this.peek().type === TokenType.LBRACKET) {
      this.expect(TokenType.LBRACKET);
      const cols = this.parseColumnList();
      this.expect(TokenType.RBRACKET);
      return cols;
    }
    // Implicit: parse column list until LPAREN
    return this.parseColumnList();
  }

  private parseSubscriptRenameMappings(): RenameMapping[] {
    if (this.peek().type === TokenType.LBRACKET) {
      this.expect(TokenType.LBRACKET);
      const mappings = this.parseRenameMappings();
      this.expect(TokenType.RBRACKET);
      return mappings;
    }
    return this.parseRenameMappings();
  }

  private parseSubscriptGroupSpec(): { groupBy: ColumnRef[]; aggregates: AggregateExpr[] } {
    if (this.peek().type === TokenType.LBRACKET) {
      this.expect(TokenType.LBRACKET);
      const spec = this.parseGroupSpec();
      this.expect(TokenType.RBRACKET);
      return spec;
    }
    return this.parseGroupSpec();
  }

  private parseSubscriptSortColumns(): SortColumn[] {
    if (this.peek().type === TokenType.LBRACKET) {
      this.expect(TokenType.LBRACKET);
      const cols = this.parseSortColumns();
      this.expect(TokenType.RBRACKET);
      return cols;
    }
    return this.parseSortColumns();
  }

  /**
   * Parse the operand of a unary operator.
   * If `(` follows, parse `(expr)`. Otherwise parse another unary or a table name.
   * This allows `π[cols] σ[cond] Person` without mandatory parentheses.
   */
  private parseUnaryOperand(): RANode {
    if (this.peek().type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseUnionExpr();
      this.expect(TokenType.RPAREN);
      return expr;
    }
    return this.parseUnaryExpr();
  }

  private parseUnaryExpr(): RANode {
    const t = this.peek().type;

    if (t === TokenType.SIGMA) {
      this.advance();
      if (this.hasSubscript()) {
        const condition = this.parseSubscriptCondition();
        const relation = this.parseUnaryOperand();
        return { type: "selection", condition, relation };
      }
      throw new RAError("Selection (σ) requires a condition — use σ[condition](R) or σ condition (R)");
    }

    if (t === TokenType.PI) {
      this.advance();
      if (this.hasSubscript()) {
        const columns = this.parseSubscriptColumns();
        const relation = this.parseUnaryOperand();
        return { type: "projection", columns, relation };
      }
      throw new RAError("Projection (π) requires column list — use π[cols](R) or π cols (R)");
    }

    if (t === TokenType.RHO) {
      this.advance();
      if (this.hasSubscript()) {
        const mappings = this.parseSubscriptRenameMappings();
        const relation = this.parseUnaryOperand();
        return { type: "rename", mappings, relation };
      }
      throw new RAError("Rename (ρ) requires mappings — use ρ[old→new](R) or ρ old→new (R)");
    }

    if (t === TokenType.GAMMA) {
      this.advance();
      if (this.hasSubscript()) {
        const { groupBy, aggregates } = this.parseSubscriptGroupSpec();
        const relation = this.parseUnaryOperand();
        return { type: "group", groupBy, aggregates, relation };
      }
      throw new RAError("Grouping (γ) requires specification — use γ[groupCols; AGG(col)](R)");
    }

    if (t === TokenType.TAU) {
      this.advance();
      if (this.hasSubscript()) {
        const columns = this.parseSubscriptSortColumns();
        const relation = this.parseUnaryOperand();
        return { type: "sort", columns, relation };
      }
      throw new RAError("Sort (τ) requires column list — use τ[col](R) or τ col (R)");
    }

    if (t === TokenType.DELTA) {
      this.advance();
      const relation = this.parseUnaryOperand();
      return { type: "distinct", relation };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): RANode {
    if (this.peek().type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseUnionExpr();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    if (this.peek().type === TokenType.IDENTIFIER) {
      const name = this.advance().value;
      return { type: "table", name };
    }

    throw new RAError(`Expected table name or '(' at position ${this.peek().pos}, got '${this.peek().value}'`);
  }

  // ─── Condition parsing ──────────────────────────────────────

  private parseBracketedCondition(): ConditionNode {
    this.expect(TokenType.LBRACKET);
    const cond = this.parseOrCondition();
    this.expect(TokenType.RBRACKET);
    return cond;
  }

  private parseOrCondition(): ConditionNode {
    let left = this.parseAndCondition();
    while (this.peek().type === TokenType.OR) {
      this.advance();
      const right = this.parseAndCondition();
      left = { type: "or", left, right };
    }
    return left;
  }

  private parseAndCondition(): ConditionNode {
    let left = this.parseNotCondition();
    while (this.peek().type === TokenType.AND) {
      this.advance();
      const right = this.parseNotCondition();
      left = { type: "and", left, right };
    }
    return left;
  }

  private parseNotCondition(): ConditionNode {
    if (this.peek().type === TokenType.NOT) {
      this.advance();
      const operand = this.parseNotCondition();
      return { type: "not", operand };
    }
    return this.parseComparisonCondition();
  }

  private parseComparisonCondition(): ConditionNode {
    if (this.peek().type === TokenType.LPAREN) {
      this.advance();
      const cond = this.parseOrCondition();
      this.expect(TokenType.RPAREN);
      return cond;
    }

    const left = this.parseValueExpr();
    const opToken = this.peek();
    let op: string;
    if (opToken.type === TokenType.EQ) { op = "="; this.advance(); }
    else if (opToken.type === TokenType.NEQ) { op = "<>"; this.advance(); }
    else if (opToken.type === TokenType.LT) { op = "<"; this.advance(); }
    else if (opToken.type === TokenType.GT) { op = ">"; this.advance(); }
    else if (opToken.type === TokenType.LTE) { op = "<="; this.advance(); }
    else if (opToken.type === TokenType.GTE) { op = ">="; this.advance(); }
    else {
      throw new RAError(`Expected comparison operator at position ${opToken.pos}, got '${opToken.value}'`);
    }
    const right = this.parseValueExpr();
    return { type: "comparison", left, op, right };
  }

  private parseValueExpr(): ValueExpr {
    if (this.peek().type === TokenType.STRING) {
      const token = this.advance();
      return { type: "string", value: token.value };
    }
    if (this.peek().type === TokenType.NUMBER) {
      const token = this.advance();
      return { type: "number", value: token.value };
    }
    if (this.peek().type === TokenType.IDENTIFIER) {
      const name = this.advance().value;

      // Check if it's a function call: NAME(args)
      if (this.peek().type === TokenType.LPAREN) {
        this.advance();
        const args: ValueExpr[] = [];
        if (this.peek().type !== TokenType.RPAREN) {
          args.push(this.parseValueExpr());
          while (this.match(TokenType.COMMA)) {
            args.push(this.parseValueExpr());
          }
        }
        this.expect(TokenType.RPAREN);
        return { type: "functionCall", name, args };
      }

      // Check for table.column
      if (this.peek().type === TokenType.DOT) {
        this.advance();
        const col = this.expect(TokenType.IDENTIFIER).value;
        return { type: "columnRef", ref: { table: name, column: col } };
      }
      return { type: "columnRef", ref: { column: name } };
    }
    throw new RAError(`Expected value expression at position ${this.peek().pos}, got '${this.peek().value}'`);
  }

  // ─── Column list parsing ────────────────────────────────────

  private parseColumnList(): ColumnRef[] {
    const columns: ColumnRef[] = [];
    columns.push(this.parseColumnRef());
    while (this.match(TokenType.COMMA)) {
      columns.push(this.parseColumnRef());
    }
    return columns;
  }

  private parseColumnRef(): ColumnRef {
    const name = this.expect(TokenType.IDENTIFIER).value;
    if (this.peek().type === TokenType.DOT) {
      this.advance();
      const col = this.expect(TokenType.IDENTIFIER).value;
      return { table: name, column: col };
    }
    return { column: name };
  }

  // ─── Rename mappings ───────────────────────────────────────

  private parseRenameMappings(): RenameMapping[] {
    const mappings: RenameMapping[] = [];
    mappings.push(this.parseRenameMapping());
    while (this.match(TokenType.COMMA)) {
      mappings.push(this.parseRenameMapping());
    }
    return mappings;
  }

  private parseRenameMapping(): RenameMapping {
    const from = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.ARROW);
    const to = this.expect(TokenType.IDENTIFIER).value;
    return { from, to };
  }

  // ─── Group/aggregate spec ──────────────────────────────────
  // Format: γ[groupCol1, groupCol2; COUNT(col) AS alias, SUM(col2)]
  // The semicolon separates group-by columns from aggregates

  private parseGroupSpec(): { groupBy: ColumnRef[]; aggregates: AggregateExpr[] } {
    const groupBy: ColumnRef[] = [];
    const aggregates: AggregateExpr[] = [];

    // Parse group-by columns (before semicolon)
    if (this.peek().type === TokenType.IDENTIFIER) {
      // Check if this is a group-by column or an aggregate function
      const saved = this.pos;
      const name = this.advance().value;
      if (this.peek().type === TokenType.LPAREN) {
        // It's an aggregate function, backtrack
        this.pos = saved;
      } else if (this.peek().type === TokenType.DOT) {
        // It's a table.column group-by
        this.pos = saved;
        groupBy.push(this.parseColumnRef());
        while (this.peek().type === TokenType.COMMA) {
          this.advance();
          // Check if next item is aggregate or column
          const saved2 = this.pos;
          this.expect(TokenType.IDENTIFIER);
          if (this.peek().type === TokenType.LPAREN) {
            this.pos = saved2;
            break;
          }
          this.pos = saved2;
          groupBy.push(this.parseColumnRef());
        }
      } else if (this.peek().type === TokenType.SEMICOLON) {
        // Single group-by column followed by semicolon
        groupBy.push({ column: name });
        this.advance(); // consume semicolon
      } else if (this.peek().type === TokenType.COMMA) {
        groupBy.push({ column: name });
        while (this.peek().type === TokenType.COMMA) {
          this.advance();
          if (this.peek().type === TokenType.IDENTIFIER) {
            const saved3 = this.pos;
            const nextName = this.advance().value;
            if (this.peek().type === TokenType.LPAREN) {
              this.pos = saved3;
              break;
            }
            if (this.peek().type === TokenType.SEMICOLON) {
              groupBy.push({ column: nextName });
              this.advance();
              break;
            }
            this.pos = saved3;
            groupBy.push(this.parseColumnRef());
          }
        }
      } else {
        groupBy.push({ column: name });
      }
    }

    // Handle semicolon separator if not yet consumed
    if (this.peek().type === TokenType.SEMICOLON) {
      this.advance();
    }

    // Parse aggregates
    while (this.peek().type === TokenType.IDENTIFIER) {
      const funcName = this.advance().value.toUpperCase();
      this.expect(TokenType.LPAREN);
      const col = this.parseColumnRef();
      this.expect(TokenType.RPAREN);
      let alias: string | undefined;
      // Check for AS alias
      if (this.peek().type === TokenType.IDENTIFIER && this.peek().value.toUpperCase() === "AS") {
        this.advance();
        alias = this.expect(TokenType.IDENTIFIER).value;
      }
      aggregates.push({ func: funcName, column: col, alias });
      if (!this.match(TokenType.COMMA)) break;
    }

    return { groupBy, aggregates };
  }

  // ─── Sort columns ──────────────────────────────────────────
  // Format: τ[col1, col2 DESC]

  private parseSortColumns(): SortColumn[] {
    const columns: SortColumn[] = [];
    const col = this.parseColumnRef();
    let desc = false;
    if (this.peek().type === TokenType.IDENTIFIER && this.peek().value.toUpperCase() === "DESC") {
      this.advance();
      desc = true;
    } else if (this.peek().type === TokenType.IDENTIFIER && this.peek().value.toUpperCase() === "ASC") {
      this.advance();
    }
    columns.push({ column: col, desc });

    while (this.match(TokenType.COMMA)) {
      const c = this.parseColumnRef();
      let d = false;
      if (this.peek().type === TokenType.IDENTIFIER && this.peek().value.toUpperCase() === "DESC") {
        this.advance();
        d = true;
      } else if (this.peek().type === TokenType.IDENTIFIER && this.peek().value.toUpperCase() === "ASC") {
        this.advance();
      }
      columns.push({ column: c, desc: d });
    }

    return columns;
  }
}

// ─── SQL Code Generator ─────────────────────────────────────────────────────

function conditionToSQL(cond: ConditionNode): string {
  switch (cond.type) {
    case "comparison":
      return `${valueExprToSQL(cond.left)} ${cond.op} ${valueExprToSQL(cond.right)}`;
    case "and":
      return `(${conditionToSQL(cond.left)} AND ${conditionToSQL(cond.right)})`;
    case "or":
      return `(${conditionToSQL(cond.left)} OR ${conditionToSQL(cond.right)})`;
    case "not":
      return `NOT (${conditionToSQL(cond.operand)})`;
  }
}

function valueExprToSQL(expr: ValueExpr): string {
  switch (expr.type) {
    case "columnRef":
      return columnRefToSQL(expr.ref);
    case "string":
      return `'${expr.value.replace(/'/g, "''")}'`;
    case "number":
      return expr.value;
    case "functionCall":
      return `${expr.name}(${expr.args.map(valueExprToSQL).join(", ")})`;
  }
}

function columnRefToSQL(ref: ColumnRef): string {
  if (ref.table) {
    return `${ref.table}.${ref.column}`;
  }
  return ref.column;
}

let subqueryCounter = 0;

/** Return a SQL alias for a node: use the table name for bare tables, otherwise _raN */
function aliasFor(node: RANode): string {
  return node.type === "table" ? node.name : `_ra${subqueryCounter++}`;
}

/**
 * Resolve the column names produced by a SQL expression using the database.
 * Uses db.getColumnNames() which handles both SQLite and PostgreSQL internally.
 */
async function resolveColumns(sql: string, db: DatabaseEngine): Promise<string[]> {
  try {
    return await db.getColumnNames(sql);
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (/no such table/i.test(msg)) {
      const match = msg.match(/no such table:\s*(\S+)/i);
      throw new RAError(match ? `Table '${match[1]}' does not exist` : msg);
    }
    if (/does not exist/i.test(msg) || /not found/i.test(msg)) {
      throw new RAError(msg);
    }
    throw new RAError(msg);
  }
}
/** Ensure a node produces a full SELECT statement (needed for UNION/INTERSECT/EXCEPT) */
async function asSelect(node: RANode, db?: DatabaseEngine): Promise<string> {
  const sql = await nodeToSQL(node, db);
  // Bare table names need wrapping; anything starting with SELECT is already a query
  return sql.trimStart().toUpperCase().startsWith("SELECT") ? sql : `SELECT * FROM ${sql}`;
}

/**
 * Build a WHERE clause correlating two aliases on their common columns.
 * Returns empty string if no db or no common columns found.
 */
async function buildCorrelation(leftSQL: string, rightSQL: string, lAlias: string, rAlias: string, db?: DatabaseEngine): Promise<string> {
  if (!db) return "";
  try {
    const leftCols = await resolveColumns(leftSQL, db);
    const rightCols = await resolveColumns(rightSQL, db);
    const common = leftCols.filter(c => rightCols.includes(c));
    if (common.length > 0) {
      return " WHERE " + common.map(c => `${lAlias}.${c} = ${rAlias}.${c}`).join(" AND ");
    }
  } catch {
    // If we can't resolve columns, fall back to uncorrelated
  }
  return "";
}

async function nodeToSQL(node: RANode, db?: DatabaseEngine): Promise<string> {
  switch (node.type) {
    case "table":
      return node.name;

    case "selection":
      return `SELECT * FROM (${await nodeToSQL(node.relation, db)}) WHERE ${conditionToSQL(node.condition)}`;

    case "projection":
      return `SELECT ${node.columns.map(columnRefToSQL).join(", ")} FROM (${await nodeToSQL(node.relation, db)})`;

    case "rename": {
      const inner = await nodeToSQL(node.relation, db);
      // Simple case: rename columns
      const colMappings = node.mappings.map(m => `${m.from} AS ${m.to}`).join(", ");
      return `SELECT ${colMappings} FROM (${inner})`;
    }

    case "group": {
      const inner = await nodeToSQL(node.relation, db);
      const groupCols = node.groupBy.map(columnRefToSQL);
      const aggExprs = node.aggregates.map(a => {
        const expr = `${a.func}(${columnRefToSQL(a.column)})`;
        return a.alias ? `${expr} AS ${a.alias}` : expr;
      });
      const selectParts = [...groupCols, ...aggExprs].join(", ");
      const groupByClause = groupCols.length > 0 ? ` GROUP BY ${groupCols.join(", ")}` : "";
      return `SELECT ${selectParts} FROM (${inner})${groupByClause}`;
    }

    case "sort": {
      const inner = await nodeToSQL(node.relation, db);
      const orderParts = node.columns.map(c =>
        `${columnRefToSQL(c.column)}${c.desc ? " DESC" : ""}`
      ).join(", ");
      return `SELECT * FROM (${inner}) ORDER BY ${orderParts}`;
    }

    case "distinct":
      return `SELECT DISTINCT * FROM (${await nodeToSQL(node.relation, db)})`;

    case "crossProduct":
      return `SELECT * FROM (${await nodeToSQL(node.left, db)}) AS ${aliasFor(node.left)} CROSS JOIN (${await nodeToSQL(node.right, db)}) AS ${aliasFor(node.right)}`;

    case "naturalJoin": {
      const leftSQL = await nodeToSQL(node.left, db);
      const rightSQL = await nodeToSQL(node.right, db);
      if (db) {
        const leftCols = await resolveColumns(leftSQL, db);
        const rightCols = await resolveColumns(rightSQL, db);
        if (leftCols.length > 0 && rightCols.length > 0) {
          const common = leftCols.filter(c => rightCols.includes(c));
          if (common.length === 0) {
            throw new RAError(
              "Natural join has no common columns between the two relations. " +
              "Left columns: [" + leftCols.join(", ") + "], Right columns: [" + rightCols.join(", ") + "]. " +
              "Use a cross product (×) if a cartesian product is intended, or a theta join (⋈[condition]) to specify the join condition."
            );
          }
        }
      }
      return `SELECT * FROM (${leftSQL}) AS ${aliasFor(node.left)} NATURAL JOIN (${rightSQL}) AS ${aliasFor(node.right)}`;
    }

    case "thetaJoin":
      return `SELECT * FROM (${await nodeToSQL(node.left, db)}) AS ${aliasFor(node.left)} JOIN (${await nodeToSQL(node.right, db)}) AS ${aliasFor(node.right)} ON ${conditionToSQL(node.condition)}`;

    case "leftJoin":
      return `SELECT * FROM (${await nodeToSQL(node.left, db)}) AS ${aliasFor(node.left)} LEFT JOIN (${await nodeToSQL(node.right, db)}) AS ${aliasFor(node.right)} ON ${conditionToSQL(node.condition)}`;

    case "rightJoin":
      return `SELECT * FROM (${await nodeToSQL(node.left, db)}) AS ${aliasFor(node.left)} RIGHT JOIN (${await nodeToSQL(node.right, db)}) AS ${aliasFor(node.right)} ON ${conditionToSQL(node.condition)}`;

    case "fullJoin":
      return `SELECT * FROM (${await nodeToSQL(node.left, db)}) AS ${aliasFor(node.left)} FULL OUTER JOIN (${await nodeToSQL(node.right, db)}) AS ${aliasFor(node.right)} ON ${conditionToSQL(node.condition)}`;

    case "leftSemiJoin": {
      const lAlias = `_ra${subqueryCounter++}`;
      const rAlias = `_ra${subqueryCounter++}`;
      const leftSQL = await nodeToSQL(node.left, db);
      const rightSQL = await nodeToSQL(node.right, db);
      const corr = await buildCorrelation(leftSQL, rightSQL, lAlias, rAlias, db);
      return `SELECT ${lAlias}.* FROM (${leftSQL}) AS ${lAlias} WHERE EXISTS (SELECT 1 FROM (${rightSQL}) AS ${rAlias}${corr})`;
    }

    case "rightSemiJoin": {
      const lAlias = `_ra${subqueryCounter++}`;
      const rAlias = `_ra${subqueryCounter++}`;
      const leftSQL = await nodeToSQL(node.left, db);
      const rightSQL = await nodeToSQL(node.right, db);
      // Outer relation is right; EXISTS checks left — correlate right (outer) with left (inner)
      const corr = await buildCorrelation(rightSQL, leftSQL, rAlias, lAlias, db);
      return `SELECT ${rAlias}.* FROM (${rightSQL}) AS ${rAlias} WHERE EXISTS (SELECT 1 FROM (${leftSQL}) AS ${lAlias}${corr})`;
    }

    case "antiJoin": {
      const lAlias = `_ra${subqueryCounter++}`;
      const rAlias = `_ra${subqueryCounter++}`;
      const leftSQL = await nodeToSQL(node.left, db);
      const rightSQL = await nodeToSQL(node.right, db);
      const corr = await buildCorrelation(leftSQL, rightSQL, lAlias, rAlias, db);
      return `SELECT ${lAlias}.* FROM (${leftSQL}) AS ${lAlias} WHERE NOT EXISTS (SELECT 1 FROM (${rightSQL}) AS ${rAlias}${corr})`;
    }

    case "union":
    case "intersect":
    case "difference": {
      const leftSQL = await asSelect(node.left, db);
      const rightSQL = await asSelect(node.right, db);
      if (db) {
        const leftCols = await resolveColumns(leftSQL, db);
        const rightCols = await resolveColumns(rightSQL, db);
        if (leftCols.length > 0 && rightCols.length > 0 && leftCols.length !== rightCols.length) {
          const opName = node.type === "union" ? "Union (∪)" : node.type === "intersect" ? "Intersect (∩)" : "Difference (−)";
          throw new RAError(
            `${opName} requires both sides to have the same number of columns. ` +
            `Left has ${leftCols.length} column(s): [${leftCols.join(", ")}], ` +
            `right has ${rightCols.length} column(s): [${rightCols.join(", ")}].`
          );
        }
      }
      const sqlOp = node.type === "union" ? "UNION" : node.type === "intersect" ? "INTERSECT" : "EXCEPT";
      return `${leftSQL} ${sqlOp} ${rightSQL}`;
    }

    case "division": {
      const lAlias = `_ra${subqueryCounter++}`;
      const rAlias = `_ra${subqueryCounter++}`;
      const innerAlias = `_ra${subqueryCounter++}`;
      const leftSQL = await nodeToSQL(node.left, db);
      const rightSQL = await nodeToSQL(node.right, db);

      if (db) {
        try {
          const leftCols = await resolveColumns(leftSQL, db);
          const rightCols = await resolveColumns(rightSQL, db);
          const aOnlyCols = leftCols.filter(c => !rightCols.includes(c));
          const bCols = rightCols;

          if (aOnlyCols.length === 0) {
            throw new RAError(
              "Division requires the dividend to have columns not present in the divisor. " +
              `Left columns: [${leftCols.join(", ")}], Right columns: [${rightCols.join(", ")}].`
            );
          }

          const aOnlyMatch = aOnlyCols.map(c => `${innerAlias}.${c} = ${lAlias}.${c}`).join(" AND ");
          const bMatch = bCols.map(c => `${innerAlias}.${c} = ${rAlias}.${c}`).join(" AND ");

          const selectCols = aOnlyCols.map(c => `${lAlias}.${c}`).join(", ");
          return `SELECT DISTINCT ${selectCols} FROM (${leftSQL}) AS ${lAlias} WHERE NOT EXISTS (SELECT 1 FROM (${rightSQL}) AS ${rAlias} WHERE NOT EXISTS (SELECT 1 FROM (${leftSQL}) AS ${innerAlias} WHERE ${aOnlyMatch} AND ${bMatch}))`;
        } catch (e) {
          if (e instanceof RAError) throw e;
          // Fall through to no-db version
        }
      }

      // Without db: best-effort uncorrelated version
      return `SELECT * FROM (SELECT DISTINCT * FROM (${leftSQL}) AS ${lAlias}) AS ${innerAlias} WHERE NOT EXISTS (SELECT * FROM (${rightSQL}) AS ${rAlias} WHERE NOT EXISTS (SELECT * FROM (${leftSQL}) AS _ra${subqueryCounter++}))`;
    }
  }
}

/**
 * Rewrite table references in an AST node using a name mapping.
 * Used to handle variable reassignment (A <- ...; A <- ...) by pointing
 * references to the correct versioned CTE name.
 */
function rewriteTableRefs(node: RANode, nameMap: Record<string, string>): RANode {
  switch (node.type) {
    case "table":
      return nameMap[node.name] ? { type: "table", name: nameMap[node.name] } : node;
    case "selection":
      return { ...node, relation: rewriteTableRefs(node.relation, nameMap) };
    case "projection":
      return { ...node, relation: rewriteTableRefs(node.relation, nameMap) };
    case "rename":
      return { ...node, relation: rewriteTableRefs(node.relation, nameMap) };
    case "group":
      return { ...node, relation: rewriteTableRefs(node.relation, nameMap) };
    case "sort":
      return { ...node, relation: rewriteTableRefs(node.relation, nameMap) };
    case "distinct":
      return { ...node, relation: rewriteTableRefs(node.relation, nameMap) };
    case "crossProduct":
    case "naturalJoin":
    case "union":
    case "intersect":
    case "difference":
    case "division":
    case "leftSemiJoin":
    case "rightSemiJoin":
    case "antiJoin":
      return { ...node, left: rewriteTableRefs(node.left, nameMap), right: rewriteTableRefs(node.right, nameMap) };
    case "thetaJoin":
    case "leftJoin":
    case "rightJoin":
    case "fullJoin":
      return { ...node, left: rewriteTableRefs(node.left, nameMap), right: rewriteTableRefs(node.right, nameMap) };
    default:
      return node;
  }
}

async function programToSQL(program: RAProgram, db?: DatabaseEngine): Promise<string> {
  if (program.assignments.length === 0) {
    return await nodeToSQL(program.result, db);
  }

  // Use CTEs (WITH clauses) for assignments.
  // Handle reassignment (A <- ..., A <- ...) by versioning CTE names
  // and rewriting references in subsequent expressions.
  const ctes: string[] = [];
  // Maps variable name -> current CTE name (may be versioned like A_v2)
  const nameMap: Record<string, string> = {};
  // Track how many times each name has been assigned
  const assignCount: Record<string, number> = {};

  for (const a of program.assignments) {
    if (a.expr.type === "table" && a.expr.name === a.name && !nameMap[a.name]) {
      // Self-referential assignment (A <- A) where A is a real table — skip, it's a no-op
      continue;
    }

    // Rewrite the expression: replace table references with their current CTE aliases
    const rewrittenExpr = rewriteTableRefs(a.expr, nameMap);
    const sql = await nodeToSQL(rewrittenExpr, db);
    const wrappedSQL = /^\w+$/.test(sql) ? `SELECT * FROM ${sql}` : sql;

    // Determine the CTE name for this assignment
    assignCount[a.name] = (assignCount[a.name] || 0) + 1;
    const cteName = assignCount[a.name] > 1 ? `${a.name}_v${assignCount[a.name]}` : a.name;
    nameMap[a.name] = cteName;

    ctes.push(`${cteName} AS (${wrappedSQL})`);
  }

  // Rewrite the result expression with final name mappings
  const rewrittenResult = rewriteTableRefs(program.result, nameMap);
  const resultSQL = await nodeToSQL(rewrittenResult, db);
  const wrappedResult = /^\w+$/.test(resultSQL) ? `SELECT * FROM ${resultSQL}` : resultSQL;

  if (ctes.length === 0) {
    return wrappedResult;
  }
  return `WITH ${ctes.join(", ")} ${wrappedResult}`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse a relational algebra expression and transpile it to SQL.
 *
 * Supported syntax:
 *
 * **Unary operators** (prefix, with condition/columns in brackets):
 * - `σ[condition](R)` or `sigma[condition](R)` — Selection (WHERE)
 * - `π[col1, col2](R)` or `pi[col1, col2](R)` — Projection (SELECT)
 * - `ρ[old→new](R)` or `rho[old->new](R)` — Rename
 * - `γ[groupCol; COUNT(col) AS alias](R)` or `gamma[...]` — Grouping/Aggregation
 * - `τ[col DESC](R)` or `tau[col](R)` — Sorting (ORDER BY)
 * - `δ(R)` or `delta(R)` — Duplicate elimination (DISTINCT)
 *
 * **Binary operators** (infix):
 * - `R × S` or `R cross S` — Cross product
 * - `R ⋈ S` or `R natjoin S` — Natural join
 * - `R ⋈[cond] S` or `R join[cond] S` — Theta join
 * - `R ⟕[cond] S` or `R leftjoin[cond] S` — Left outer join
 * - `R ⟖[cond] S` or `R rightjoin[cond] S` — Right outer join
 * - `R ⟗[cond] S` or `R fulljoin[cond] S` — Full outer join
 * - `R ⋉ S` or `R leftsemijoin S` — Left semi-join
 * - `R ⋊ S` or `R rightsemijoin S` — Right semi-join
 * - `R ▷ S` or `R antijoin S` — Anti-join
 * - `R ∪ S` or `R union S` — Union
 * - `R ∩ S` or `R intersect S` — Intersection
 * - `R − S` or `R minus S` — Set difference
 * - `R ÷ S` or `R divide S` — Division
 *
 * **Conditions** support: `=`, `<>`, `!=`, `<`, `>`, `<=`, `>=`, `AND`, `OR`, `NOT`
 *
 * @param input The relational algebra expression
 * @param db Optional database handle for validating natural joins (checks for common columns)
 * @returns The equivalent SQL query string
 * @throws RAError if the expression cannot be parsed or a natural join has no common columns
 */
export async function raToSQL(input: string, db?: DatabaseEngine): Promise<string> {
  subqueryCounter = 0;
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  const program = parser.parse();
  return await programToSQL(program, db);
}

// Re-export for potential future use (e.g., AST visualization)
export type { RANode, ConditionNode, ColumnRef };
