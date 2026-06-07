// dendra — public compile entry (playground)
// Pipeline so far: ① lex.  ② parse, ③ check, ④ resolve, ⑤ render to follow
// (see dendra-grammer.md §9 roadmap). The sandbox's compileProject() calls this.

import { lex } from "./lexer";
import type { Token, LexDiag } from "./token";

export interface CompileOutput {
  ok: boolean;
  tokens: Token[];
  diagnostics: LexDiag[];
  /** human-readable token stream for the sandbox "Compiled" tab */
  dump: string;
}

function dumpTokens(tokens: Token[]): string {
  return tokens
    .filter(t => t.kind !== "eof")
    .map(t => {
      const where = `${String(t.line).padStart(3)}:${String(t.col).padStart(2)}`;
      const ann =
        t.unit !== undefined ? `  (${t.value}${t.unit})` :
        t.value !== undefined ? `  (${t.value})` : "";
      return `${where}  ${t.kind.padEnd(7)} ${t.text}${ann}`;
    })
    .join("\n");
}

export function compile(src: string): CompileOutput {
  const { tokens, diagnostics } = lex(src);
  return {
    ok: diagnostics.length === 0,
    tokens,
    diagnostics,
    dump: dumpTokens(tokens),
  };
}

export type { Token, LexDiag };
