/* ---------------------------------------------------------------------------
   notes-yjs-rescue — "an edit wins over a delete" for Yjs note documents.

   Yjs deletes a block together with everything inside it — including text a
   peer typed into it CONCURRENTLY (before it saw the delete). Typical case:
   a fallback client (single-editor save, merged server-side) deletes a
   paragraph while a live peer is typing in it; when the peer's typing
   reaches the stored state, or the peer pulls the stored state, the typing
   would silently vanish with the paragraph.

   The rule here matches the non-Yjs 3-way merge (notes-merge3): a block
   that was deleted on one side while it was EDITED on the other is kept.
   Concretely: a block that the OTHER state deleted, which is still alive on
   this side and holds content the other side never saw (so the delete
   cannot have been meant for it), is re-inserted — as this side sees it —
   right where it was. Used at both ends:

     · server  mergeState: a collaborative save carries typing into a block
               the stored state already deleted → re-insert it (any author).
     · browser applyServerState: pulling a state that deletes a block this
               tab is typing in (unsaved) → re-insert it (own typing only,
               so two tabs never both rescue the same block).

   Three refinements keep a rescue from ever showing up twice:

     · ORIGIN MARKER. Every re-inserted block carries `restoredFrom` = the
       Yjs id of the deleted block ("client:clock"). An item is deleted at
       most once and its id is the same on every replica, so the server and
       every browser derive the SAME origin for the same rescue. A rescue
       whose origin already has a block in the document is not inserted
       again — only the rescuer's new characters are added to that block.
     · COLLAPSE. Two rescuers that did not see each other (the server
       merging a save while the typist pulls an older state) still make two
       copies; they sit side by side with the same origin. collapseRestored
       deletes the copy whose text the other one already contains — chosen
       deterministically (by Yjs id when equal), so every replica deletes
       the same one.
     · JOIN ≠ DELETE. Backspace at the start of a paragraph (or Delete at
       the end of the previous one) removes the block and appends its text
       to its neighbour. A concurrent typist's rescue would then duplicate
       the whole paragraph. When the neighbour — in the deleter's view —
       ends (or starts) with exactly the text the deleter saw in the block,
       typed by the deleter, it is a join: only the typist's NEW characters
       are grafted into the joined block, anchored to the characters they
       followed.

   The browser also asks where its caret was: locateCursor (before the
   merge) + applyRescues give the same offset in the re-inserted copy.

   Pure (no DOM, no Buffer): imported by the server and the browser.
   --------------------------------------------------------------------------- */

import * as Y from "yjs";
import { charDiff, type CharOp } from "@/lib/notes-merge3";

/** Block attribute: the Yjs id of the deleted block this one restores. */
export const RESTORED_ATTR = "restoredFrom";

type StateVector = Map<number, number>;
type DeleteSet = ReturnType<typeof Y.createDeleteSetFromStructStore>;
/** The part of a Yjs type the walk needs (its item lists). */
type YType = { _map: Map<string, Y.Item>; _start: Y.Item | null };

/** What the other side knows: its state vector, its deletions and (when
 *  available) its document — needed to recognise a join. */
export interface OtherSide {
  sv: StateVector;
  ds: DeleteSet;
  doc?: Y.Doc | null;
}

/** New characters typed after `after` characters the other side had seen. */
interface Run {
  after: number;
  text: string;
}

/** One text node of a rescued block. */
interface TextPart {
  /** Live-child indexes from the block down to this text. */
  path: number[];
  /** The live text as this side sees it. */
  full: string;
  /** The characters the other side had seen (still live here). */
  seen: string;
  /** The rescuer's characters the other side never saw. */
  runs: Run[];
  /** Per UTF-16 unit of the live text: s(een) / r(un) / x (someone
   *  else's unseen typing — not the rescuer's to carry). */
  cls: string;
}

export type Rescue =
  | {
      kind: "restore";
      /** The deleted block's item id — the copy goes right after it. */
      ref: Y.ID;
      /** Deterministic origin (RESTORED_ATTR) shared by every replica. */
      origin: string;
      /** A detached copy of the block as THIS side sees it. */
      copy: Y.XmlElement;
      /** Its text nodes (null: a shape the merge cannot follow). */
      parts: TextPart[] | null;
      /** The block itself (this side, before the merge). */
      src: Y.XmlElement;
    }
  | {
      kind: "graft";
      ref: Y.ID;
      /** Ids (in the joined block) of the characters the deleter moved,
       *  one per character of `part.seen`. */
      anchors: Y.ID[];
      /** True when the block was joined into the NEXT block (a prefix). */
      prefix: boolean;
      part: TextPart;
      src: Y.XmlElement;
    };

/** Where the caret was inside a rescued block (see locateCursor). */
export interface RescueCursor {
  rescue: number;
  path: number[];
  offset: number;
  /** Filled by applyRescues: the same place after the rescue. */
  result?: Y.RelativePosition | null;
}

export function otherSideOf(doc: Y.Doc): OtherSide {
  return { sv: Y.decodeStateVector(Y.encodeStateVector(doc)), ds: Y.createDeleteSetFromStructStore(doc.store), doc };
}

function unknownTo(id: Y.ID, sv: StateVector): boolean {
  return id.clock >= (sv.get(id.client) ?? 0);
}

/** Live content in `type` the other side never saw (by `author`, if set). */
function holdsUnseen(type: YType, sv: StateVector, author: number | null): boolean {
  // An item may hold a run of clocks (Yjs squashes a client's consecutive
  // typing into one item): it is unseen if its LAST clock is.
  const unseen = (it: Y.Item) =>
    !it.deleted && it.id.clock + it.length > (sv.get(it.id.client) ?? 0) && (author === null || it.id.client === author);
  for (const it of type._map.values()) if (unseen(it)) return true;
  for (let it = type._start; it; it = it.right) {
    if (it.deleted) continue;
    if (unseen(it)) return true;
    if (it.content instanceof Y.ContentType && holdsUnseen(it.content.type as unknown as YType, sv, author)) return true;
  }
  return false;
}

/**
 * A detached deep copy. (Y.XmlElement.clone keeps string attributes only —
 * a heading's numeric level or a to-do's boolean `checked` would be lost.)
 */
function copyElement(el: Y.XmlElement): Y.XmlElement {
  const out = new Y.XmlElement(el.nodeName);
  for (const [k, v] of Object.entries(el.getAttributes() as Record<string, unknown>)) {
    if (v !== undefined && v !== null) out.setAttribute(k, v as never);
  }
  const kids: Array<Y.XmlElement | Y.XmlText> = [];
  for (const c of el.toArray()) {
    if (c instanceof Y.XmlElement) kids.push(copyElement(c));
    else if (c instanceof Y.XmlText) kids.push(c.clone());
  }
  if (kids.length) out.insert(0, kids);
  return out;
}

/** The plain string of a text node (formatting ignored, embeds as U+FFFC). */
function textOf(t: Y.XmlText): string {
  let out = "";
  for (const op of t.toDelta() as Array<{ insert?: unknown }>) out += typeof op.insert === "string" ? op.insert : "￼";
  return out;
}

/** Split a text node into seen characters and the rescuer's new runs. */
function partOf(t: Y.XmlText, sv: StateVector, author: number | null, path: number[]): TextPart | null {
  let seen = "";
  let full = "";
  let cls = "";
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (let it = (t as unknown as YType)._start; it; it = it.right) {
    if (it.deleted || !it.countable) continue;
    if (!(it.content instanceof Y.ContentString)) return null; // embeds: not followed
    const s = it.content.str;
    full += s;
    const known = sv.get(it.id.client) ?? 0;
    for (let k = 0; k < s.length; k++) {
      if (it.id.clock + k < known) {
        seen += s[k];
        cls += "s";
      } else if (author === null || it.id.client === author) {
        if (!cur || cur.after !== seen.length) { cur = { after: seen.length, text: "" }; runs.push(cur); }
        cur.text += s[k];
        cls += "r";
      } else {
        cls += "x";
      }
    }
  }
  return { path, full, seen, runs, cls };
}

/** Every text node of a block (live-child paths), or null for embeds. */
function partsOf(el: Y.XmlElement, sv: StateVector, author: number | null): TextPart[] | null {
  const out: TextPart[] = [];
  let ok = true;
  const walk = (node: Y.XmlElement, path: number[]) => {
    node.toArray().forEach((c, i) => {
      if (!ok) return;
      if (c instanceof Y.XmlText) {
        const p = partOf(c, sv, author, [...path, i]);
        if (p) out.push(p); else ok = false;
      } else if (c instanceof Y.XmlElement) walk(c, [...path, i]);
    });
  };
  walk(el, []);
  return ok ? out : null;
}

function atPath(el: Y.XmlElement, path: number[]): Y.XmlText | null {
  let node: Y.XmlElement | Y.XmlText = el;
  for (const i of path) {
    if (!(node instanceof Y.XmlElement)) return null;
    const next: unknown = node.get(i);
    if (!(next instanceof Y.XmlElement) && !(next instanceof Y.XmlText)) return null;
    node = next;
  }
  return node instanceof Y.XmlText ? node : null;
}

/** The first / last text node of a block (descending into containers). */
function edgeText(el: Y.XmlElement, last: boolean): Y.XmlText | null {
  const kids = el.toArray();
  const k = last ? kids[kids.length - 1] : kids[0];
  if (k instanceof Y.XmlText) return k;
  if (k instanceof Y.XmlElement) return edgeText(k, last);
  return null;
}

/** Live characters of a text node with their ids (null: holds embeds). */
function charsOf(t: Y.XmlText): { s: string; ids: Y.ID[] } | null {
  let s = "";
  const ids: Y.ID[] = [];
  for (let it = (t as unknown as YType)._start; it; it = it.right) {
    if (it.deleted || !it.countable) continue;
    if (!(it.content instanceof Y.ContentString)) return null;
    const str = it.content.str;
    for (let k = 0; k < str.length; k++) ids.push(Y.createID(it.id.client, it.id.clock + k));
    s += str;
  }
  return { s, ids };
}

/**
 * Was the deleted block JOINED into a neighbour on the other side? True
 * when — in the other side's document — the previous live block ends with
 * (or the next one starts with) exactly the text the other side saw in the
 * deleted block, and those characters are new to this side (the deleter
 * typed them: the join). Returns the graft, or null for a real delete.
 */
function detectJoin(el: Y.XmlElement, item: Y.Item, other: OtherSide, mine: StateVector, author: number | null): Rescue | null {
  const kids = el.toArray();
  if (!other.doc || kids.length !== 1 || !(kids[0] instanceof Y.XmlText)) return null;
  const part = partOf(kids[0], other.sv, author, [0]);
  if (!part || !part.seen) return null;
  let oi: unknown;
  try { oi = Y.getItem(other.doc.store, item.id); } catch { return null; }
  if (!(oi instanceof Y.Item)) return null;
  for (const prefix of [false, true]) {
    let n: Y.Item | null = prefix ? oi.right : oi.left;
    while (n && (n.deleted || !(n.content instanceof Y.ContentType) || !(n.content.type instanceof Y.XmlElement))) n = prefix ? n.right : n.left;
    if (!n) continue;
    // Our own restored copy (a rescuer already re-inserted this block) is
    // not a join target: the origin marker handles it.
    const neighbour = (n.content as Y.ContentType).type as Y.XmlElement;
    if (neighbour.getAttribute(RESTORED_ATTR) === `${item.id.client}:${item.id.clock}`) continue;
    const t = edgeText((n.content as Y.ContentType).type as Y.XmlElement, !prefix);
    const chars = t ? charsOf(t) : null;
    if (!chars) continue;
    if (prefix ? !chars.s.startsWith(part.seen) : !chars.s.endsWith(part.seen)) continue;
    const from = prefix ? 0 : chars.s.length - part.seen.length;
    const anchors = chars.ids.slice(from, from + part.seen.length);
    if (!anchors.every((id) => unknownTo(id, mine))) continue;
    return { kind: "graft", ref: item.id, anchors, prefix, part, src: el };
  }
  return null;
}

/**
 * Blocks of `doc` (fragment `field`) that `other` deleted although they
 * hold content `other` never saw. Only the TOPMOST such block is taken (a
 * list item inside a still-living list, a whole paragraph at the top).
 * Take the copies BEFORE applying the other side's update.
 */
export function findRescues(doc: Y.Doc, field: string, other: OtherSide, author: number | null): Rescue[] {
  const out: Rescue[] = [];
  const mine = Y.decodeStateVector(Y.encodeStateVector(doc));
  const visit = (type: YType) => {
    for (let it = type._start; it; it = it.right) {
      if (it.deleted || !(it.content instanceof Y.ContentType)) continue;
      const child = it.content.type;
      if (!(child instanceof Y.XmlElement)) continue;
      // A block the other side never saw cannot have been deleted by it.
      if (unknownTo(it.id, other.sv)) continue;
      if (Y.isDeleted(other.ds, it.id)) {
        if (holdsUnseen(child as unknown as YType, other.sv, author)) {
          const join = detectJoin(child, it, other, mine, author);
          if (join) out.push(join);
          else {
            const origin = `${it.id.client}:${it.id.clock}`;
            const copy = copyElement(child);
            copy.setAttribute(RESTORED_ATTR, origin);
            out.push({ kind: "restore", ref: it.id, origin, copy, parts: partsOf(child, other.sv, author), src: child });
          }
        }
        continue;
      }
      visit(child as unknown as YType);
    }
  };
  visit(doc.getXmlFragment(field) as unknown as YType);
  return out;
}

/* ── Applying ─────────────────────────────────────────────────────────── */

/** Offset `off` of diff side A → side B (a deleted spot maps to where it was). */
function mapOffset(ops: CharOp[], off: number): number {
  let a = 0;
  let b = 0;
  for (const op of ops) {
    const len = op.s.length;
    if (op.op === "ins") { b += len; continue; }
    if (off < a + len) return op.op === "eq" ? b + (off - a) : b;
    a += len;
    if (op.op === "eq") b += len;
  }
  return b;
}

/** The characters of `cls`-classified text the rescuer carries (s + r). */
function carried(full: string, cls: string): string {
  let out = "";
  for (let i = 0; i < full.length; i++) if (cls[i] !== "x") out += full[i];
  return out;
}

/** The index of a character (by id) in its text node, or -1 if gone. */
function indexOfChar(doc: Y.Doc, id: Y.ID): { text: Y.XmlText; index: number } | null {
  let item: unknown;
  try { item = Y.getItem(doc.store, id); } catch { return null; }
  if (!(item instanceof Y.Item) || item.deleted || !(item.parent instanceof Y.XmlText)) return null;
  let index = 0;
  for (let it = (item.parent as unknown as YType)._start; it && it !== item; it = it.right) {
    if (!it.deleted && it.countable) index += it.length;
  }
  return { text: item.parent, index: index + (id.clock - item.id.clock) };
}

/** Insert the rescuer's runs into an existing text (3-way: seen → current). */
function graftRuns(t: Y.XmlText, part: TextPart): boolean {
  if (!part.runs.length) return false;
  const current = textOf(t);
  // The existing copy already holds everything we carry (its rescuer saw
  // our typing too): nothing to add.
  if (isSubsequence(carried(part.full, part.cls), current)) return false;
  const ops = charDiff(part.seen, current);
  for (const run of [...part.runs].sort((x, y) => y.after - x.after)) t.insert(mapOffset(ops, run.after), run.text);
  return true;
}

/** Graft a joined block's new characters next to the ones they followed. */
function applyGraft(doc: Y.Doc, r: Extract<Rescue, { kind: "graft" }>): boolean {
  let changed = false;
  for (const run of [...r.part.runs].sort((x, y) => y.after - x.after)) {
    let at: { text: Y.XmlText; index: number } | null = null;
    // After the last surviving anchor at or before the run…
    for (let k = run.after - 1; k >= 0 && !at; k--) {
      const hit = indexOfChar(doc, r.anchors[k]);
      if (hit) at = { text: hit.text, index: hit.index + 1 };
    }
    // …or before the first surviving one after it.
    for (let k = run.after; k < r.anchors.length && !at; k++) at = indexOfChar(doc, r.anchors[k]);
    if (!at) continue; // the joined text is gone entirely — nothing to anchor to
    at.text.insert(at.index, run.text);
    changed = true;
  }
  return changed;
}

/** Live blocks carrying an origin marker, first one per origin. */
function originIndex(root: Y.XmlFragment | Y.XmlElement, out = new Map<string, Y.XmlElement>()): Map<string, Y.XmlElement> {
  for (const c of root.toArray()) {
    if (!(c instanceof Y.XmlElement)) continue;
    const o = c.getAttribute(RESTORED_ATTR) as unknown;
    if (typeof o === "string" && o && !out.has(o)) out.set(o, c);
    originIndex(c, out);
  }
  return out;
}

/**
 * Re-insert the rescued blocks right after their deleted originals (or
 * graft a joined block's new characters). A rescue whose origin already has
 * a block in `doc` only adds its new characters to that block. `cursor`
 * (from locateCursor) receives the caret's place after the rescue.
 * Returns how many rescues changed the document.
 */
export function applyRescues(doc: Y.Doc, field: string, rescues: Rescue[], cursor: RescueCursor | null = null): number {
  // Typed access first: a root type that only an update has touched is
  // still a generic AbstractType until it is asked for as a fragment.
  const fragment = doc.getXmlFragment(field);
  let n = 0;
  doc.transact(() => {
    const origins = originIndex(fragment);
    rescues.forEach((r, i) => {
      const here = cursor && cursor.rescue === i ? cursor : null;
      if (r.kind === "graft") {
        if (applyGraft(doc, r)) n += 1;
        if (here) here.result = graftCursor(doc, r, here.offset);
        return;
      }
      const existing = origins.get(r.origin);
      if (existing) {
        // Someone already restored this block: add only our new characters.
        let changed = false;
        for (const part of r.parts ?? []) {
          const t = atPath(existing, part.path);
          if (t && graftRuns(t, part)) changed = true;
        }
        if (changed) n += 1;
        if (here) {
          const part = r.parts?.find((p) => samePath(p.path, here.path));
          const t = part ? atPath(existing, part.path) : null;
          if (part && t) {
            const local = carried(part.full, part.cls);
            const localOff = carried(part.full.slice(0, here.offset), part.cls.slice(0, here.offset)).length;
            here.result = Y.createRelativePositionFromTypeIndex(t, mapOffset(charDiff(local, textOf(t)), localOff));
          }
        }
        return;
      }
      let item: Y.Item | null = null;
      try { item = Y.getItem(doc.store, r.ref) as Y.Item; } catch { item = null; }
      const parent = item?.parent;
      if (!item || !(parent instanceof Y.XmlElement || parent instanceof Y.XmlFragment)) return;
      parent.insertAfter(item, [r.copy]);
      origins.set(r.origin, r.copy);
      n += 1;
      if (here) {
        const t = atPath(r.copy, here.path);
        if (t) here.result = Y.createRelativePositionFromTypeIndex(t, Math.min(here.offset, t.length));
      }
    });
  });
  return n;
}

function samePath(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** The caret's place in a joined block after its runs were grafted. */
function graftCursor(doc: Y.Doc, r: Extract<Rescue, { kind: "graft" }>, offset: number): Y.RelativePosition | null {
  const cls = r.part.cls.slice(0, offset);
  const sBefore = (cls.match(/s/g) ?? []).length;
  const lastS = cls.lastIndexOf("s");
  const rBefore = (cls.slice(lastS + 1).match(/r/g) ?? []).length;
  if (sBefore > 0) {
    const hit = indexOfChar(doc, r.anchors[sBefore - 1]);
    return hit ? Y.createRelativePositionFromTypeIndex(hit.text, hit.index + 1 + rBefore) : null;
  }
  const hit = indexOfChar(doc, r.anchors[0]);
  if (!hit) return null;
  const lead = r.part.runs.find((x) => x.after === 0)?.text.length ?? 0;
  return Y.createRelativePositionFromTypeIndex(hit.text, Math.max(0, hit.index - lead + rBefore));
}

/**
 * Where a caret (a Yjs relative position, taken BEFORE the other side's
 * update is applied) sits inside one of the rescued blocks — or null.
 */
export function locateCursor(doc: Y.Doc, rescues: Rescue[], rel: Y.RelativePosition | null): RescueCursor | null {
  if (!rel || !rescues.length) return null;
  const abs = Y.createAbsolutePositionFromRelativePosition(rel, doc);
  if (!abs || !(abs.type instanceof Y.XmlText)) return null;
  const path: number[] = [];
  let node: Y.AbstractType<unknown> | null = abs.type as unknown as Y.AbstractType<unknown>;
  while (node) {
    const i = rescues.findIndex((r) => (r.src as unknown) === node);
    if (i >= 0) return { rescue: i, path, offset: abs.index };
    const parent: Y.AbstractType<unknown> | null = node.parent as Y.AbstractType<unknown> | null;
    if (!(parent instanceof Y.XmlElement)) return null;
    path.unshift(parent.toArray().indexOf(node as unknown as Y.XmlElement));
    node = parent as unknown as Y.AbstractType<unknown>;
  }
  return null;
}

/** A caret inside blocks that a merge may delete (see caretIntoRestored). */
export interface CaretSnapshot {
  /** Enclosing blocks, innermost first: origin id + path down to the text. */
  chain: Array<{ origin: string; path: number[] }>;
  text: Y.XmlText;
  before: string;
  offset: number;
}

/** Remember where a caret is, block by block (take BEFORE a merge). */
export function caretSnapshot(doc: Y.Doc, rel: Y.RelativePosition | null): CaretSnapshot | null {
  if (!rel) return null;
  const abs = Y.createAbsolutePositionFromRelativePosition(rel, doc);
  if (!abs || !(abs.type instanceof Y.XmlText)) return null;
  const chain: CaretSnapshot["chain"] = [];
  const path: number[] = [];
  let node: Y.AbstractType<unknown> = abs.type as unknown as Y.AbstractType<unknown>;
  for (;;) {
    const parent: Y.AbstractType<unknown> | null = node.parent as Y.AbstractType<unknown> | null;
    if (!(parent instanceof Y.XmlElement)) break;
    path.unshift(parent.toArray().indexOf(node as unknown as Y.XmlElement));
    const item = parent._item;
    if (item) chain.push({ origin: `${item.id.client}:${item.id.clock}`, path: [...path] });
    node = parent as unknown as Y.AbstractType<unknown>;
  }
  return { chain, text: abs.type, before: textOf(abs.type), offset: abs.index };
}

/**
 * After a merge: the caret's block was deleted, but a restored copy of it
 * (origin marker) now exists — typically re-inserted by the SERVER from
 * our own save. The same place in that copy, or null.
 */
export function caretIntoRestored(doc: Y.Doc, field: string, snap: CaretSnapshot | null): Y.RelativePosition | null {
  if (!snap || !snap.text._item?.deleted) return null;
  const origins = originIndex(doc.getXmlFragment(field));
  for (const { origin, path } of snap.chain) {
    const el = origins.get(origin);
    const t = el ? atPath(el, path) : null;
    if (t) return Y.createRelativePositionFromTypeIndex(t, mapOffset(charDiff(snap.before, textOf(t)), snap.offset));
  }
  return null;
}

/* ── Collapse ─────────────────────────────────────────────────────────── */

function isSubsequence(small: string, big: string): boolean {
  if (small.length > big.length) return false;
  let j = 0;
  for (let i = 0; i < big.length && j < small.length; i++) if (big[i] === small[j]) j += 1;
  return j === small.length;
}

function attrsKey(el: Y.XmlElement): string {
  const a = el.getAttributes() as Record<string, unknown>;
  return JSON.stringify(Object.keys(a).sort().map((k) => [k, a[k]]));
}

/** Does `big` already hold everything `small` holds (same shape, text ⊆)? */
function contains(big: Y.XmlElement, small: Y.XmlElement): boolean {
  if (big.nodeName !== small.nodeName || attrsKey(big) !== attrsKey(small)) return false;
  const bk = big.toArray();
  const sk = small.toArray();
  if (bk.length !== sk.length) return false;
  return bk.every((b, i) => {
    const s = sk[i];
    if (b instanceof Y.XmlText && s instanceof Y.XmlText) return isSubsequence(textOf(s), textOf(b));
    if (b instanceof Y.XmlElement && s instanceof Y.XmlElement) return contains(b, s);
    return false;
  });
}

function idBefore(a: Y.ID, b: Y.ID): boolean {
  return a.client !== b.client ? a.client < b.client : a.clock < b.clock;
}

/**
 * Adjacent restored copies of the SAME origin (two rescuers that did not
 * see each other): delete the one the other already contains. Equal copies
 * keep the one with the smaller Yjs id — every replica picks the same.
 * Returns how many copies were deleted.
 */
export function collapseRestored(doc: Y.Doc, field: string): number {
  const fragment = doc.getXmlFragment(field);
  const doomed: Y.XmlElement[] = [];
  const visit = (type: YType) => {
    let prev: { el: Y.XmlElement; id: Y.ID; origin: string } | null = null;
    for (let it = type._start; it; it = it.right) {
      if (it.deleted || !(it.content instanceof Y.ContentType)) continue;
      const el = it.content.type;
      if (!(el instanceof Y.XmlElement)) { prev = null; continue; }
      const o = el.getAttribute(RESTORED_ATTR) as unknown;
      const origin = typeof o === "string" ? o : "";
      if (origin && prev && prev.origin === origin) {
        const aHasB = contains(prev.el, el);
        const bHasA = contains(el, prev.el);
        if (aHasB && bHasA) {
          if (idBefore(prev.id, it.id)) { doomed.push(el); continue; }
          doomed.push(prev.el);
        } else if (aHasB) { doomed.push(el); continue; }
        else if (bHasA) doomed.push(prev.el);
      }
      prev = origin ? { el, id: it.id, origin } : null;
      visit(el as unknown as YType);
    }
  };
  visit(fragment as unknown as YType);
  if (!doomed.length) return 0;
  doc.transact(() => {
    for (const el of doomed) {
      const parent = el.parent;
      if (!(parent instanceof Y.XmlElement || parent instanceof Y.XmlFragment)) continue;
      const idx = parent.toArray().indexOf(el);
      if (idx >= 0) parent.delete(idx, 1);
    }
  });
  return doomed.length;
}
