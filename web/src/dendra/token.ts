// dendra — token definitions (M1)
// See web/docs/sources/dendra-grammer.md §2 (lexical grammar).

export type TokKind =
  | "kw"      // structural keyword
  | "ident"   // user name OR closed-set word (pass / observe-field), resolved by the parser
  | "number"  // unit-less numeric literal
  | "length"  // numeric literal with a unit (m | km)
  | "lparen" | "rparen" | "lbrack" | "rbrack"
  | "comma" | "colon" | "equals"
  | "eof";

export interface Token {
  kind: TokKind;
  text: string;          // raw lexeme
  value?: number;        // parsed value for number / length
  unit?: "m" | "km";     // unit for length
  pos: number;           // byte offset
  line: number;
  col: number;
}

export interface LexDiag {
  severity: "error";
  message: string;
  pos: number;
  line: number;
  col: number;
}

// Structural keywords only. Pass names (terrain, light, …) and observe-fields
// (position, altitude, …) lex as `ident` and are validated in their syntactic
// position by the parser/checker — keeps the keyword set small and unambiguous.
export const KEYWORDS: ReadonlySet<string> = new Set([
  "anchor", "field", "observer", "walk", "render", "observe",
  "partition", "atmosphere", "body", "height", "at", "spawn",
  "to", "depth", "passes", "zoom",
]);
