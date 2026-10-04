/* ---------------------------------------------------------------------------
   notes-merge3 — a THREE-WAY merge of TipTap (ProseMirror JSON) documents.

   Used when a single-editor save turns out to be stale (someone else saved
   since the client's base): instead of reloading the fresh note and throwing
   the client's unsaved typing away, the changes the client made to its base
   (base → local) are re-applied on top of the fresh document (current).

     · Block level (doc.content and every nested container): the classic
       diff3 — blocks are matched against the base by content (LCS); regions
       only one side touched take that side; regions both sides touched
       identically are taken once.
     · Same block edited on both sides: merged RECURSIVELY — attrs per key,
       nested containers (lists, quotes, tables) as block sequences, and
       inline content (text + marks, hard breaks) character by character.
     · A real conflict (overlapping edits in the same text, a changed
       type): BOTH versions are kept — the current block, then the local
       block right after it, flagged as a conflict copy with a LANGUAGE-
       NEUTRAL marker (`attrs.conflict: true` on its first text block; the
       editor renders the label in the viewer's language). Typed text is
       never dropped; the caller counts conflicts and tells the user.
     · Delete vs edit (one side deleted a block the other side edited): the
       EDIT wins — the edited block is kept (unmarked) and counted in
       `kept`, so the user is told a deleted block came back.

   Pure and dependency-free (runs in the browser and on the server). The
   server normalises all three inputs through the note schema first and
   validates the result against it.
   --------------------------------------------------------------------------- */

export interface PMJson {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: PMJson[];
  text?: string;
  marks?: unknown[];
  [k: string]: unknown;
}

export interface Merge3Result {
  doc: PMJson;
  /** Blocks kept twice because both sides changed them incompatibly. */
  conflicts: number;
  /** Blocks one side deleted that were KEPT because the other edited them. */
  kept: number;
}

/* Schema facts (src/lib/notes-schema.ts) the merge needs. The server
   re-validates every merged document against the real schema. */
const INLINE_TYPES = new Set(["text", "hardBreak"]);
const TEXTBLOCK_TYPES = new Set(["paragraph", "heading", "codeBlock"]);

/** LCS tables above this many cells fall back to prefix/suffix matching. */
const MAX_LCS_CELLS = 2_000_000;

/** JSON with sorted keys (undefined dropped) — equal content, equal key. */
export function stableKey(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableKey).join(",")}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableKey(o[k])}`).join(",")}}`;
}

function sameKeys(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Monotone index pairs of equal elements (an LCS): common prefix and suffix
 * directly, the middle by dynamic programming when it is small enough.
 */
export function matchPairs(a: string[], b: string[]): Array<[number, number]> {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < p; i++) pairs.push([i, i]);
  const n = a.length - p - s;
  const m = b.length - p - s;
  if (n > 0 && m > 0 && n * m <= MAX_LCS_CELLS) {
    const w = m + 1;
    const dp = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] = a[p + i] === b[p + j]
          ? dp[(i + 1) * w + j + 1] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[p + i] === b[p + j]) { pairs.push([p + i, p + j]); i++; j++; }
      else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
      else j++;
    }
  }
  for (let k = 0; k < s; k++) pairs.push([a.length - s + k, b.length - s + k]);
  return pairs;
}

type Chunk<T> = { stable: T } | { o: T[]; a: T[]; b: T[] };

/** diff3: stable elements (unchanged on both sides) and the chunks between. */
function diff3<T>(o: T[], a: T[], b: T[], key: (x: T) => string): Chunk<T>[] {
  const ok = o.map(key);
  const ma = new Map(matchPairs(ok, a.map(key)));
  const mb = new Map(matchPairs(ok, b.map(key)));
  const out: Chunk<T>[] = [];
  let i = 0;
  let j = 0;
  let k = 0;
  for (let p = 0; p < o.length; p++) {
    const pa = ma.get(p);
    const pb = mb.get(p);
    if (pa === undefined || pb === undefined || pa < j || pb < k) continue;
    if (i < p || j < pa || k < pb) out.push({ o: o.slice(i, p), a: a.slice(j, pa), b: b.slice(k, pb) });
    out.push({ stable: b[pb] });
    i = p + 1;
    j = pa + 1;
    k = pb + 1;
  }
  if (i < o.length || j < a.length || k < b.length) out.push({ o: o.slice(i), a: a.slice(j), b: b.slice(k) });
  return out;
}

/* ── Inline content (character level) ──────────────────────────────────── */

type Tok = { k: string; ch?: string; marks?: unknown[]; node?: PMJson };

function tokens(content: PMJson[]): Tok[] {
  const out: Tok[] = [];
  for (const n of content) {
    if (n.type === "text" && typeof n.text === "string") {
      const mk = stableKey(n.marks ?? []);
      for (const ch of Array.from(n.text)) out.push({ k: `${mk}\u0001${ch}`, ch, marks: n.marks });
    } else {
      out.push({ k: `\u0002${stableKey(n)}`, node: n });
    }
  }
  return out;
}

function untokens(toks: Tok[]): PMJson[] {
  const out: PMJson[] = [];
  let run: { text: string; marks?: unknown[]; mk: string } | null = null;
  const end = () => {
    if (run) out.push(run.marks && run.marks.length ? { type: "text", text: run.text, marks: run.marks } : { type: "text", text: run.text });
    run = null;
  };
  for (const t of toks) {
    if (t.node) { end(); out.push(t.node); continue; }
    const mk = stableKey(t.marks ?? []);
    if (run && (run as { mk: string }).mk === mk) (run as { text: string }).text += t.ch;
    else { end(); run = { text: t.ch ?? "", marks: t.marks, mk }; }
  }
  end();
  return out;
}

/** Character-level diff3 of inline content; null when edits overlap. */
function mergeInline(o: PMJson[], l: PMJson[], c: PMJson[]): PMJson[] | null {
  const out: Tok[] = [];
  for (const ch of diff3(tokens(o), tokens(l), tokens(c), (t) => t.k)) {
    if ("stable" in ch) { out.push(ch.stable); continue; }
    const ok = ch.o.map((t) => t.k);
    const lk = ch.a.map((t) => t.k);
    const ck = ch.b.map((t) => t.k);
    if (sameKeys(lk, ok)) out.push(...ch.b);
    else if (sameKeys(ck, ok) || sameKeys(lk, ck)) out.push(...ch.a);
    else if (ok.length === 0) {
      // Both typed at the same spot: keep both, current first.
      out.push(...ch.b, ...ch.a);
    } else return null;
  }
  return untokens(out);
}

/* ── Blocks ─────────────────────────────────────────────────────────────── */

const CONFLICT = Symbol("conflict");

function mergeAttrs(
  o: Record<string, unknown> | undefined,
  l: Record<string, unknown> | undefined,
  c: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined | typeof CONFLICT {
  const keys = new Set([...Object.keys(o ?? {}), ...Object.keys(l ?? {}), ...Object.keys(c ?? {})]);
  if (!keys.size) return c;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const vo = o?.[k];
    const vl = l?.[k];
    const vc = c?.[k];
    const so = stableKey(vo);
    const sl = stableKey(vl);
    const sc = stableKey(vc);
    const v = sl === so ? vc : sc === so || sl === sc ? vl : CONFLICT;
    if (v === CONFLICT) return CONFLICT;
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function isInlineSeq(content: PMJson[]): boolean {
  return content.every((n) => INLINE_TYPES.has(n.type ?? ""));
}

interface Ctx { conflicts: number; kept: number }

/** Node attribute that flags a conflict copy (see NoteConflictMarker). */
export const CONFLICT_ATTR = "conflict";

/**
 * The local block, flagged as a conflict copy: `attrs.conflict = true` on
 * its first text block (or, for a block without text — an image, a divider
 * — on an empty paragraph put before it). The flag is language-neutral: the
 * editor draws the label in the VIEWER's language. A copied to-do item does
 * not keep the link to its task (the current block still has it).
 */
function markCopy(node: PMJson): PMJson[] {
  const copy = JSON.parse(JSON.stringify(node)) as PMJson;
  let done = false;
  const visit = (n: PMJson) => {
    if (n.attrs && typeof n.attrs.todoId === "string") n.attrs = { ...n.attrs, todoId: null };
    if (done) return;
    if (TEXTBLOCK_TYPES.has(n.type ?? "")) {
      n.attrs = { ...(n.attrs ?? {}), [CONFLICT_ATTR]: true };
      done = true;
      return;
    }
    for (const ch of n.content ?? []) visit(ch);
  };
  visit(copy);
  if (done) return [copy];
  return [{ type: "paragraph", attrs: { [CONFLICT_ATTR]: true } }, copy];
}

/** One block changed on both sides: merge it, or keep both versions. */
function mergeNode(o: PMJson, l: PMJson, c: PMJson, ctx: Ctx): PMJson[] {
  const ko = stableKey(o);
  const kl = stableKey(l);
  const kc = stableKey(c);
  if (kl === ko) return [c];
  if (kc === ko || kl === kc) return [l];
  if (o.type === l.type && l.type === c.type && o.type !== "text") {
    const attrs = mergeAttrs(o.attrs, l.attrs, c.attrs);
    if (attrs !== CONFLICT) {
      const oc = o.content ?? [];
      const lc = l.content ?? [];
      const cc = c.content ?? [];
      let content: PMJson[] | null = null;
      if (isInlineSeq(oc) && isInlineSeq(lc) && isInlineSeq(cc)) {
        content = mergeInline(oc, lc, cc);
      } else if (!oc.some((n) => INLINE_TYPES.has(n.type ?? "")) && !lc.some((n) => INLINE_TYPES.has(n.type ?? "")) && !cc.some((n) => INLINE_TYPES.has(n.type ?? ""))) {
        content = mergeSeq(oc, lc, cc, ctx);
      }
      if (content) {
        const out: PMJson = { ...c };
        if (attrs && Object.keys(attrs).length) out.attrs = attrs; else delete out.attrs;
        if (content.length) out.content = content; else delete out.content;
        return [out];
      }
    }
  }
  ctx.conflicts += 1;
  return [c, ...markCopy(l)];
}

/** A region both sides changed differently. */
function resolveBlocks(o: PMJson[], l: PMJson[], c: PMJson[], ctx: Ctx): PMJson[] {
  const ck = new Set(c.map(stableKey));
  // Both inserted blocks at the same place: keep both (no shared block).
  if (o.length === 0) return [...c, ...l.filter((x) => !ck.has(stableKey(x)))];
  // The same blocks edited in place on both sides: merge pairwise.
  if (o.length === l.length && l.length === c.length) {
    return o.flatMap((ob, i) => mergeNode(ob, l[i], c[i], ctx));
  }
  return mergeRegion(o, l, c, ctx);
}

/** Plain text of a block (for similarity pairing). */
function jsonText(n: PMJson): string {
  if (typeof n.text === "string") return n.text;
  return (n.content ?? []).map(jsonText).join("");
}

/**
 * Pair base blocks with one side's blocks: equal content first (LCS), then,
 * in the gaps, a SIMILAR block of the same type (≥ 0.5) — an edit of that
 * block. A base block left unpaired was deleted (or rewritten beyond
 * recognition) on that side.
 */
function pairBlocks(o: PMJson[], x: PMJson[]): Map<number, number> {
  const out = new Map<number, number>();
  const eq = matchPairs(o.map(stableKey), x.map(stableKey));
  let pi = 0;
  let pj = 0;
  for (const [ei, ej] of [...eq, [o.length, x.length] as [number, number]]) {
    let from = pj;
    for (let i = pi; i < ei; i++) {
      let best = -1;
      let bestSim = 0.49;
      const ot = jsonText(o[i]);
      for (let j = from; j < ej; j++) {
        if (x[j].type !== o[i].type) continue;
        const sim = similarity(ot, jsonText(x[j]));
        if (sim > bestSim) { bestSim = sim; best = j; }
      }
      if (best >= 0) { out.set(i, best); from = best + 1; }
    }
    if (ei < o.length) out.set(ei, ej);
    pi = ei + 1;
    pj = ej + 1;
  }
  return out;
}

/**
 * A region both sides changed with different block counts: follow every
 * base block to its fate on each side (kept / edited / deleted).
 *   · edited on one side only → that edit; on both → merged (mergeNode);
 *   · deleted on one side, untouched on the other → deleted;
 *   · deleted on one side, EDITED on the other → the edit wins: the block
 *     is kept and counted in `kept` — unless the deleting side put new
 *     blocks in its place (a rewrite beyond recognition): then both
 *     versions stay and the local one is flagged as a conflict copy;
 *   · blocks only one side inserted are kept where they were inserted.
 */
function mergeRegion(o: PMJson[], l: PMJson[], c: PMJson[], ctx: Ctx): PMJson[] {
  const ml = pairBlocks(o, l);
  const mc = pairBlocks(o, c);
  const lUsed = new Set(ml.values());
  const cUsed = new Set(mc.values());
  const cKeys = new Set(c.map(stableKey));
  const out: PMJson[] = [];
  let li = 0;
  let ci = 0;
  const nextPartner = (m: Map<number, number>, k: number, len: number) => {
    for (let q = k + 1; q < o.length; q++) { const v = m.get(q); if (v !== undefined) return v; }
    return len;
  };
  const newIn = (used: Set<number>, from: number, to: number) => {
    let n = 0;
    for (let j = from; j < to; j++) if (!used.has(j)) n++;
    return n;
  };
  let flagL = 0; // how many upcoming local inserts are rewrites of a block the current side edited
  const emit = (lEnd: number, cEnd: number) => {
    for (; ci < cEnd; ci++) if (!cUsed.has(ci)) out.push(c[ci]);
    for (; li < lEnd; li++) {
      if (lUsed.has(li)) continue;
      if (cKeys.has(stableKey(l[li]))) continue; // both inserted the same block
      if (flagL > 0) { flagL -= 1; ctx.conflicts += 1; out.push(...markCopy(l[li])); } else out.push(l[li]);
    }
  };
  for (let k = 0; k < o.length; k++) {
    const lj = ml.get(k);
    const cj = mc.get(k);
    emit(lj ?? li, cj ?? ci);
    const lSame = lj !== undefined && stableKey(l[lj]) === stableKey(o[k]);
    const cSame = cj !== undefined && stableKey(c[cj]) === stableKey(o[k]);
    if (lj !== undefined && cj !== undefined) {
      if (lSame) out.push(c[cj]);
      else if (cSame) out.push(l[lj]);
      else out.push(...mergeNode(o[k], l[lj], c[cj], ctx));
    } else if (lj === undefined && cj !== undefined && !cSame) {
      // Local deleted it, current edited it: keep the edit.
      out.push(c[cj]);
      const rewrites = newIn(lUsed, li, nextPartner(ml, k, l.length));
      if (rewrites) flagL += rewrites; else ctx.kept += 1;
    } else if (cj === undefined && lj !== undefined && !lSame) {
      // Current deleted it, local edited it: keep ours — flagged when the
      // current side put a rewrite of it in its place.
      const rewrites = newIn(cUsed, ci, nextPartner(mc, k, c.length));
      if (rewrites) { ctx.conflicts += 1; emit(li, nextPartner(mc, k, c.length)); out.push(...markCopy(l[lj])); }
      else { ctx.kept += 1; out.push(l[lj]); }
    }
    // Otherwise deleted on one side and untouched (or deleted) on the other.
    if (lj !== undefined) li = Math.max(li, lj + 1);
    if (cj !== undefined) ci = Math.max(ci, cj + 1);
  }
  emit(l.length, c.length);
  return out;
}

function mergeSeq(o: PMJson[], l: PMJson[], c: PMJson[], ctx: Ctx): PMJson[] {
  const out: PMJson[] = [];
  for (const ch of diff3(o, l, c, stableKey)) {
    if ("stable" in ch) { out.push(ch.stable); continue; }
    const ok = ch.o.map(stableKey);
    const lk = ch.a.map(stableKey);
    const ck = ch.b.map(stableKey);
    if (sameKeys(lk, ok)) out.push(...ch.b);
    else if (sameKeys(ck, ok) || sameKeys(lk, ck)) out.push(...ch.a);
    else out.push(...resolveBlocks(ch.o, ch.a, ch.b, ctx));
  }
  return out;
}

const EMPTY_DOC: PMJson = { type: "doc", content: [{ type: "paragraph" }] };

function asDoc(x: unknown): PMJson {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as PMJson) : EMPTY_DOC;
}

/**
 * Re-apply the changes `local` made to `base` on top of `current`. Conflict
 * copies carry the language-neutral CONFLICT_ATTR flag (no label text).
 */
export function mergeDocs(base: unknown, local: unknown, current: unknown): Merge3Result {
  const b = asDoc(base);
  const l = asDoc(local);
  const c = asDoc(current);
  const ctx: Ctx = { conflicts: 0, kept: 0 };
  if (stableKey(l) === stableKey(b)) return { doc: c, conflicts: 0, kept: 0 };
  if (stableKey(c) === stableKey(b) || stableKey(l) === stableKey(c)) return { doc: l, conflicts: 0, kept: 0 };
  const content = mergeSeq(b.content ?? [], l.content ?? [], c.content ?? [], ctx);
  const doc: PMJson = { ...c, type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
  return { doc, conflicts: ctx.conflicts, kept: ctx.kept };
}

/* ── Note metadata (title / tags / colour) ─────────────────────────────── */

export interface NoteMeta {
  title?: string;
  tags?: string[];
  color?: string | null;
}

export interface MetaMergeResult {
  /** The fields to write (only those that actually change the note). */
  apply: NoteMeta;
  /** Fields both sides changed differently — the current value was kept. */
  conflicts: Array<"title" | "color">;
}

/**
 * 3-way merge of a note's metadata: only the fields the client changed vs
 * its base are applied onto the current note. Tags merge as a SET (the
 * client's adds and removes are replayed on the current tags); a title or
 * colour both sides changed differently keeps the current value and is
 * reported. A field without a base value falls back to "client wins".
 */
export function mergeNoteMeta(
  base: NoteMeta,
  local: NoteMeta,
  current: { title: string; tags: string[]; color: string | null },
): MetaMergeResult {
  const apply: NoteMeta = {};
  const conflicts: MetaMergeResult["conflicts"] = [];
  const scalar = (k: "title" | "color") => {
    if (!(k in local)) return;
    const lv = local[k] ?? (k === "title" ? "" : null);
    const cv = current[k] ?? (k === "title" ? "" : null);
    if (lv === cv) return;
    if (!(k in base)) { (apply as Record<string, unknown>)[k] = lv; return; }
    const bv = base[k] ?? (k === "title" ? "" : null);
    if (lv === bv) return; // not changed by the client
    if (cv === bv) { (apply as Record<string, unknown>)[k] = lv; return; }
    conflicts.push(k);
  };
  scalar("title");
  scalar("color");
  if (Array.isArray(local.tags)) {
    const cur = current.tags ?? [];
    let next: string[];
    if (!Array.isArray(base.tags)) next = local.tags;
    else {
      const low = (xs: string[]) => new Set(xs.map((x) => x.toLowerCase()));
      const bl = low(base.tags);
      const ll = low(local.tags);
      const removed = new Set([...bl].filter((x) => !ll.has(x)));
      const added = local.tags.filter((x) => !bl.has(x.toLowerCase()));
      next = cur.filter((x) => !removed.has(x.toLowerCase()));
      const have = low(next);
      for (const x of added) if (!have.has(x.toLowerCase())) { next.push(x); have.add(x.toLowerCase()); }
    }
    if (next.length !== cur.length || next.some((x, i) => x !== cur[i])) apply.tags = next;
  }
  return { apply, conflicts };
}

/* ── Character-level diff (for in-place CRDT text updates) ─────────────── */

/**
 * How much of the SHORTER text survives as a common prefix + suffix (0..1):
 * an append, an insertion or a trim scores 1, a rewrite ~0. An empty block
 * against text scores 0.5 (typing into an empty paragraph is an edit).
 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return a === b ? 1 : 0.5;
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return (p + s) / Math.min(a.length, b.length);
}

export type CharOp = { op: "eq" | "del" | "ins"; s: string };

/**
 * A character-level diff of `a` → `b` (by code point, so a surrogate pair is
 * never split). Tiny equalities stranded between changes (a shared "e" in
 * two unrelated words) are folded into the change, so a rewrite reads as
 * whole-word replacements rather than confetti.
 */
export function charDiff(a: string, b: string): CharOp[] {
  if (a === b) return a ? [{ op: "eq", s: a }] : [];
  const x = Array.from(a);
  const y = Array.from(b);
  const pairs = matchPairs(x, y);
  const raw: CharOp[] = [];
  const push = (op: CharOp["op"], s: string) => {
    if (!s) return;
    const last = raw[raw.length - 1];
    if (last && last.op === op) last.s += s; else raw.push({ op, s });
  };
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [x.length, y.length] as [number, number]]) {
    push("del", x.slice(i, pi).join(""));
    push("ins", y.slice(j, pj).join(""));
    if (pi < x.length) push("eq", x[pi]);
    i = pi + 1;
    j = pj + 1;
  }
  // Fold short equalities that sit between two changes.
  const out: CharOp[] = [];
  for (let k = 0; k < raw.length; k++) {
    const op = raw[k];
    const between = k > 0 && k < raw.length - 1;
    if (op.op === "eq" && between && Array.from(op.s).length < 3) {
      raw.splice(k, 1, { op: "del", s: op.s }, { op: "ins", s: op.s });
      k -= 1;
      continue;
    }
    out.push(op);
  }
  // Normalise: within every run of changes, all deletes then all inserts.
  const norm: CharOp[] = [];
  let del = "";
  let ins = "";
  const flush = () => {
    if (del) norm.push({ op: "del", s: del });
    if (ins) norm.push({ op: "ins", s: ins });
    del = "";
    ins = "";
  };
  for (const op of out) {
    if (op.op === "del") del += op.s;
    else if (op.op === "ins") ins += op.s;
    else { flush(); norm.push(op); }
  }
  flush();
  return norm;
}
