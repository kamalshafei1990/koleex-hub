/* One comment stripper for the validators (25 Sep 2026).
 *
 * A validator strips comments before it matches source, so a guard cannot
 * trip on its own documentation. The bare regex this replaces,
 * /\/\*[\s\S]*?\*\//g, does not know about strings: accept="image/*" reads
 * as a comment OPENING, and everything up to the next comment's end is
 * deleted. Every guard on that file then checks part of it, and a "must NOT
 * contain X" guard passes on nothing — a false pass nobody sees. The day
 * this was written it cut real code out of 41 files under src/, 206 lines of
 * one of them.
 *
 * So the source is read as tokens. Strings, template literals (a ${…} hole is
 * code again), regex literals and comments are each stepped over whole, and
 * only real comments are dropped. It is the tokenizer validate:reports grew
 * first, plus what that one still read as code: a template nested in a
 * template's hole, a regex literal, and a // comment after code (a quote or
 * "/*" in one opened a string or a comment that ran on past it). On every
 * file under src/ it finds exactly the comments the TypeScript parser does.
 *
 * Known limit: JSX text is not a token of its own. An apostrophe in it reads
 * as a string that ends with the line, which is harmless; a lone backtick or
 * a "/*" in JSX text would still mislead it. There is none today.
 *
 * It reads SQL too (lang "sql", same day) for the migration guard in
 * apply-migration.ts, which had the same bare regex: a "/*" in a -- comment or
 * in a string ('image/*') opens a fake comment there as well, and a DROP
 * between it and the next real comment's end would go unseen. Nothing was
 * hidden yet: on all 133 migrations the two read exactly the same text.
 */

export interface StripOptions {
  /** `//` comments: "leading" (the default) drops only those that start a
   *  line, with their indent, like /^\s*\/\/.*$/gm; "all" drops every one
   *  except right after ":" (a URL in JSX text); "keep" leaves them. A kept
   *  one is still read as a comment, so nothing inside it opens a string. */
  line?: "leading" | "all" | "keep";
  /** "css": strings and block comments only — no //, template or regex.
   *  "sql": Postgres — every -- and block comment (see stripSql); `line` is
   *  not read. */
  lang?: "ts" | "css" | "sql";
}

/** After one of these words a "/" starts a regex, not a division. */
const BEFORE_EXPR = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
const NBSP = String.fromCharCode(0xa0), BOM = String.fromCharCode(0xfeff);
const isSpace = (c: string) => c === " " || c === "\t" || c === "\r" || c === "\v" || c === "\f" || c === NBSP || c === BOM;
const isWord = (c: string) => c.charCodeAt(0) >= 0x80 || /[\w$]/.test(c);

export function stripComments(src: string, opts: StripOptions = {}): string {
  if (opts.lang === "sql") return stripSql(src);
  const line = opts.line ?? "leading";
  const css = opts.lang === "css";
  const n = src.length;
  const cuts: Array<[from: number, to: number]> = [];
  let i = src.startsWith("#!") ? (src.indexOf("\n") + 1 || n) : 0;
  let lineHasCode = false; // a token on this line already, so a // here is not leading
  let expr = true;         // a "/" here starts a regex
  let last = "";           // the last code character
  let depth = 0;           // open braces
  const holes: number[] = []; // the depth each open ${ hole closes back to

  /** From just inside a template's text to just past its closing backtick,
   *  or past the "${" that opens a hole — then the scan reads code again. */
  const template = (from: number): number => {
    for (let j = from; j < n; j++) {
      const c = src[j];
      if (c === "\\") { j++; continue; }
      if (c === "`") { expr = false; return j + 1; }
      if (c === "$" && src[j + 1] === "{") { holes.push(depth++); expr = true; return j + 2; }
    }
    return n;
  };

  /** Just past the regex literal at i (flags included), or -1 when it is not
   *  one: a regex never runs past its line. */
  const regexEnd = (at: number): number => {
    let cls = false;
    for (let j = at + 1; j < n; j++) {
      const c = src[j];
      if (c === "\n" || c === "\r") return -1;
      if (c === "\\") { if (src[j + 1] === "\n") return -1; j++; }
      else if (cls) { if (c === "]") cls = false; }
      else if (c === "[") cls = true;
      else if (c === "/") { j++; while (j < n && /[a-z]/i.test(src[j])) j++; return j; }
    }
    return -1;
  };

  while (i < n) {
    const ch = src[i], nx = src[i + 1];
    if (ch === "\n") { lineHasCode = false; i++; continue; }
    if (isSpace(ch)) { i++; continue; }

    if (ch === "/" && nx === "*") {
      const end = src.indexOf("*/", i + 2);
      const to = end < 0 ? n : end + 2;
      cuts.push([i, to]);
      i = to;
      continue;
    }

    if (ch === "/" && nx === "/" && !css) {
      const nl = src.indexOf("\n", i);
      const to = nl < 0 ? n : nl;
      if (line === "all" ? src[i - 1] !== ":" : line === "leading" && !lineHasCode) {
        let from = i;
        if (line === "leading") {
          // the indent goes too, and a block comment already cut before it on this line
          for (;;) {
            if (from > 0 && (src[from - 1] === " " || src[from - 1] === "\t")) from--;
            else if (cuts.length && cuts[cuts.length - 1][1] === from) from = cuts.pop()![0];
            else break;
          }
        }
        cuts.push([from, to]);
      } else lineHasCode = true;
      i = to;
      continue;
    }

    lineHasCode = true;

    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && src[j] !== ch && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      i = j < n && src[j] === ch ? j + 1 : Math.min(j, n); // an unclosed one ends with its line
      expr = false; last = ch;
      continue;
    }

    if (css) { i++; continue; }

    if (ch === "`") { i = template(i + 1); last = ch; continue; }

    if (ch === "}" && holes.length && holes[holes.length - 1] === depth - 1) {
      holes.pop(); depth--;
      i = template(i + 1); last = "`";
      continue;
    }

    if (ch === "/" && expr && last !== "<") { // "</" closes a JSX tag
      const j = regexEnd(i);
      if (j > 0) { i = j; expr = false; last = "/"; continue; }
    }

    if (isWord(ch)) {
      let j = i + 1;
      while (j < n && isWord(src[j])) j++;
      expr = last !== "." && BEFORE_EXPR.has(src.slice(i, j)); // x.return is a property
      last = src[j - 1];
      i = j;
      continue;
    }

    if (ch === "{") depth++;
    else if (ch === "}" && depth > 0) depth--;
    if ((ch === "+" || ch === "-") && nx === ch) { expr = false; last = ch; i += 2; continue; } // x++ / y
    expr = !(ch === ")" || ch === "]" || ch === "}");
    last = ch;
    i++;
  }

  if (!cuts.length) return src;
  let out = "", at = 0;
  for (const [from, to] of cuts) { out += src.slice(at, from); at = to; }
  return out + src.slice(at);
}

/** The dollar-quote tag at i, "$$" or "$name$" (a name without "$"), or "". */
function tagAt(src: string, i: number): string {
  let j = i + 1;
  while (j < src.length && src[j] !== "$" && isWord(src[j]) && (j > i + 1 || !/[0-9]/.test(src[j]))) j++;
  return src[j] === "$" ? src.slice(i, j + 1) : "";
}

/** Postgres, read the way its own lexer reads it (src/backend/parser/scan.l).
 *  A -- comment runs to the end of its line and goes. A block comment nests,
 *  and becomes one space, which is what it is to Postgres: a comment between
 *  DROP and TABLE still drops the table. Stepped over whole, so nothing inside
 *  them opens a comment: '…' strings ('' is a quote; in E'…' a backslash also
 *  takes the next character) and "…" identifiers ("" is a quote). A $tag$ …
 *  $tag$ body is read as SQL again — it is a function or a DO block, with
 *  comments of its own — but only up to its closing tag, which Postgres finds
 *  without reading anything in between, so nothing in it runs on past it.
 *  Anything unclosed runs to the end, as it does for Postgres, which then
 *  refuses the whole file. */
function stripSql(src: string): string {
  const read = (from: number, to: number): string => {
    const at = (k: number) => (k < to ? src[k] : "");
    /** From just inside a quote to just past the one that closes it. */
    const quoted = (q: string, j: number, backslash: boolean): number => {
      for (; j < to; j++) {
        if (backslash && src[j] === "\\") j++;
        else if (src[j] === q) { if (at(j + 1) !== q) return j + 1; j++; }
      }
      return to;
    };
    let out = "", done = from, i = from;
    while (i < to) {
      const ch = src[i], nx = at(i + 1);
      if (ch === "-" && nx === "-") {
        let j = i + 2;
        while (j < to && src[j] !== "\n" && src[j] !== "\r") j++;
        out += src.slice(done, i);
        done = i = j;
      } else if (ch === "/" && nx === "*") {
        let j = i + 2, depth = 1;
        while (j < to && depth > 0) {
          if (src[j] === "/" && at(j + 1) === "*") { depth++; j += 2; }
          else if (src[j] === "*" && at(j + 1) === "/") { depth--; j += 2; }
          else j++;
        }
        out += src.slice(done, i) + " ";
        done = i = j;
      } else if (ch === "'" || ch === '"') {
        i = quoted(ch, i + 1, false);
      } else if (ch === "$") {
        const tag = tagAt(src, i);
        if (!tag || i + tag.length > to) { i++; continue; } // $1, or a lone $
        const open = i + tag.length, close = src.indexOf(tag, open);
        const end = close < 0 || close + tag.length > to ? to : close;
        out += src.slice(done, open) + read(open, end);
        done = end;
        i = Math.min(end + tag.length, to);
      } else if (isWord(ch) && !/[0-9]/.test(ch)) {
        // a name, "$" in it included (a$$ is a name, not a tag); a lone E
        // right before a quote opens E'…'
        let j = i + 1;
        while (j < to && isWord(src[j])) j++;
        i = j === i + 1 && (ch === "E" || ch === "e") && at(j) === "'" ? quoted("'", j + 1, true) : j;
      } else i++;
    }
    return out + src.slice(done, to);
  };
  return read(0, src.length);
}
