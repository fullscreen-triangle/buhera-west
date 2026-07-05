// dendra — lexer (M1)
// Source text → token stream. Whitespace/newlines are insignificant;
// `#` begins a comment to end-of-line. See dendra-grammer.md §2–§3.

import { Token, TokKind, LexDiag, KEYWORDS } from "./token";

export interface LexResult {
  tokens: Token[];
  diagnostics: LexDiag[];
}

const isDigit = (c: string) => c >= "0" && c <= "9";
const isAlpha = (c: string) =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
const isAlnum = (c: string) => isAlpha(c) || isDigit(c);

const PUNCT: Record<string, TokKind> = {
  "(": "lparen", ")": "rparen", "[": "lbrack", "]": "rbrack",
  ",": "comma", ":": "colon", "=": "equals",
};

export function lex(src: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: LexDiag[] = [];
  let i = 0, line = 1, col = 1;

  const peek = (k = 0) => src[i + k] ?? "";
  const advance = () => {
    const c = src[i++];
    if (c === "\n") { line++; col = 1; } else { col++; }
    return c;
  };
  const emit = (kind: TokKind, text: string, pos: number, l: number, c: number, extra: Partial<Token> = {}) =>
    tokens.push({ kind, text, pos, line: l, col: c, ...extra });

  while (i < src.length) {
    const c = peek();

    if (c === " " || c === "\t" || c === "\r" || c === "\n") { advance(); continue; }
    if (c === "#") { while (i < src.length && peek() !== "\n") advance(); continue; }

    const pos = i, l = line, cc = col;

    if (PUNCT[c]) { advance(); emit(PUNCT[c], c, pos, l, cc); continue; }

    // string literal — "…" (import paths). No escapes in v0.
    if (c === '"') {
      advance(); // opening quote
      let text = "";
      while (i < src.length && peek() !== '"' && peek() !== "\n") text += advance();
      if (peek() === '"') advance();
      else diagnostics.push({ severity: "error", message: "unterminated string", pos, line: l, col: cc });
      emit("string", text, pos, l, cc, { value: undefined });
      continue;
    }

    // number / length — optional leading '-' only when a digit follows
    if (isDigit(c) || (c === "-" && isDigit(peek(1)))) {
      let text = "";
      if (peek() === "-") text += advance();
      while (i < src.length && isDigit(peek())) text += advance();
      if (peek() === ".") {
        text += advance();
        while (i < src.length && isDigit(peek())) text += advance();
      }
      const value = parseFloat(text);
      if (isAlpha(peek())) {
        let unit = "";
        while (i < src.length && isAlnum(peek())) unit += advance();
        if (unit === "m" || unit === "km") {
          emit("length", text + unit, pos, l, cc, { value, unit });
        } else {
          diagnostics.push({ severity: "error", message: `unknown unit '${unit}' (use m or km)`, pos, line: l, col: cc });
          emit("length", text + unit, pos, l, cc, { value, unit: "m" });
        }
      } else {
        emit("number", text, pos, l, cc, { value });
      }
      continue;
    }

    // identifier / keyword
    if (isAlpha(c)) {
      let text = "";
      while (i < src.length && isAlnum(peek())) text += advance();
      emit(KEYWORDS.has(text) ? "kw" : "ident", text, pos, l, cc);
      continue;
    }

    diagnostics.push({ severity: "error", message: `unexpected character '${c}'`, pos, line: l, col: cc });
    advance();
  }

  emit("eof", "", i, line, col);
  return { tokens, diagnostics };
}
