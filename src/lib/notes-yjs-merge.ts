/* ---------------------------------------------------------------------------
   notes-yjs-merge — the pure CRDT half of the server's co-editing logic
   (no database, no network), so it can be exercised in isolation. Only the
   server imports it (via notes-yjs-server); it uses Node's Buffer.

     · seedStateFromJson — a shared note's one-time Yjs seed from body_json.
     · mergeState        — merge a collaborative client's Yjs state into the
                           stored state (merges commute; nothing is lost).
     · applyBodyToState  — a SINGLE-EDITOR save on a note that already has a
                           Yjs state: the incoming body_json is turned into a
                           Yjs update against the stored state (the XML
                           fragment is diffed block-by-block to match it, in
                           ONE transaction),
                           so live peers' concurrent edits — which are other
                           CRDT items — survive the merge instead of being
                           wiped by a last-writer-wins overwrite.
     · rebaseOntoState / rebaseBody — a STALE single-editor save (its base
                           is older than the note): the client's own changes
                           (base → local) are 3-way merged onto the current
                           document (notes-merge3), then written like any
                           single-editor save. Nothing typed is dropped; a
                           real same-block conflict keeps both versions.

   Every result carries the body DERIVED from the merged document and
   validated against the note schema, so body_json / body_plain always match
   what collaborators see.
   --------------------------------------------------------------------------- */

import * as Y from "yjs";
import { getSchema } from "@tiptap/core";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import { prosemirrorJSONToYDoc, updateYFragment, yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import { NOTES_YJS_FIELD, notesSchemaExtensions } from "@/lib/notes-schema";
import { NOTE_LIMITS } from "@/lib/notes-policy";
import { charDiff, mergeDocs } from "@/lib/notes-merge3";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

let _schema: Schema | null = null;
function schema(): Schema {
  if (!_schema) _schema = getSchema(notesSchemaExtensions());
  return _schema;
}

export function b64encode(u: Uint8Array): string {
  return Buffer.from(u).toString("base64");
}
export function b64decode(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}

/** Build a Yjs state from a TipTap doc (the one-time seed). */
export function seedStateFromJson(bodyJson: unknown): string {
  let doc: Y.Doc;
  try {
    doc = prosemirrorJSONToYDoc(schema(), bodyJson ?? EMPTY_DOC, NOTES_YJS_FIELD);
  } catch (e) {
    // Content the schema can't read (legacy/garbage) — start clean rather
    // than refuse collaboration; body_json itself is untouched until a save.
    console.error("[notes-yjs] seed", e instanceof Error ? e.message : e);
    doc = prosemirrorJSONToYDoc(schema(), EMPTY_DOC, NOTES_YJS_FIELD);
  }
  const out = b64encode(Y.encodeStateAsUpdate(doc));
  doc.destroy();
  return out;
}

export type MergeResult =
  | { ok: true; state: string; bodyJson: Record<string, unknown> }
  | { ok: false; error: string };

/** Encode + derive + validate the merged document. */
function finish(doc: Y.Doc): MergeResult {
  const state = b64encode(Y.encodeStateAsUpdate(doc));
  if (state.length > NOTE_LIMITS.yjsStateChars) return { ok: false, error: "Note is too large" };
  const bodyJson = yDocToProsemirrorJSON(doc, NOTES_YJS_FIELD) as Record<string, unknown>;
  // Validate the derived document against the schema — a malformed update
  // must not become the note's body.
  schema().nodeFromJSON(bodyJson);
  return { ok: true, state, bodyJson };
}

/** Merge a client's Yjs update into the stored state and derive body_json. */
export function mergeState(stored: string | null, incomingB64: string): MergeResult {
  if (typeof incomingB64 !== "string" || !incomingB64 || incomingB64.length > NOTE_LIMITS.yjsStateChars) {
    return { ok: false, error: "Invalid collaborative update" };
  }
  const doc = new Y.Doc();
  try {
    if (stored) Y.applyUpdate(doc, b64decode(stored));
    Y.applyUpdate(doc, b64decode(incomingB64));
    return finish(doc);
  } catch (e) {
    console.error("[notes-yjs] merge", e instanceof Error ? e.message : e);
    return { ok: false, error: "Invalid collaborative update" };
  } finally {
    doc.destroy();
  }
}

/* ── Block-aware fragment sync ────────────────────────────────────────────
   y-prosemirror's updateYFragment is built for the editor, where a mapping
   of Y types → ProseMirror nodes pins every unchanged block. Given a whole
   document with no mapping, it pairs changed blocks POSITIONALLY: adding a
   paragraph at the top rewrites every paragraph below into its neighbour's
   text. The merge would still keep everyone's edits, but a live peer's
   concurrent typing would land in the wrong paragraph. So the top level is
   diffed here first: unchanged blocks are matched by content (LCS) and keep
   their CRDT identity untouched; among the changed ones, a removed block is
   updated IN PLACE when a similar block replaces it, or — failing that —
   when a block of the same type sits at the same position among the
   changes (a near-total rewrite of a paragraph is still that paragraph).
   In-place updates diff the text CHARACTER BY CHARACTER on the existing
   XmlText (syncTextInPlace), so a live peer's concurrent typing inside the
   block survives the merge. Everything else is a real delete / insert. */

const MAX_LCS_CELLS = 2_000_000;
type BindingMeta = Parameters<typeof updateYFragment>[3];

/**
 * How much of the SHORTER text survives as a common prefix + suffix (0..1):
 * an append, an insertion or a trim scores 1, a rewrite ~0. An empty block
 * against text scores 0.5 (typing into an empty paragraph is an edit).
 */
function similarity(a: string, b: string): number {
  if (!a || !b) return a === b ? 1 : 0.5;
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return (p + s) / Math.min(a.length, b.length);
}

/** The plain string of a Y.XmlText (formatting ignored). */
function yTextString(t: Y.XmlText): string {
  let out = "";
  for (const op of t.toDelta() as Array<{ insert?: unknown }>) if (typeof op.insert === "string") out += op.insert;
  return out;
}

/**
 * Bring the TEXT of a Yjs block to the target block's text with a
 * character-level diff — inserts and deletes on the existing XmlText, so
 * every unchanged character keeps its CRDT identity and a peer's concurrent
 * insertion stays anchored where it was typed. (y-prosemirror's own sync
 * replaces the whole middle between a common prefix and suffix.) Recurses
 * into containers whose shape matches; updateYFragment then only has to fix
 * formatting and structure.
 */
function syncTextInPlace(el: Y.XmlElement, node: PMNode): void {
  if (el.nodeName !== node.type.name) return;
  const kids = el.toArray();
  if (node.isTextblock) {
    let textOnly = true;
    node.forEach((c) => { if (!c.isText) textOnly = false; });
    if (!textOnly || kids.length !== 1 || !(kids[0] instanceof Y.XmlText)) return;
    const yt = kids[0];
    const target = node.textContent;
    // A replacement INSERTS before it deletes: the new text is then anchored
    // to the old text's left neighbour and its first replaced character, so
    // a peer's concurrent insertion after the replaced range (typing at the
    // end of the old text) stays after the new text instead of before it.
    let at = 0;
    let pendingDel = 0;
    const dropPending = () => { if (pendingDel) { yt.delete(at, pendingDel); pendingDel = 0; } };
    for (const op of charDiff(yTextString(yt), target)) {
      if (op.op === "del") { pendingDel += op.s.length; continue; }
      if (op.op === "ins") { yt.insert(at, op.s); at += op.s.length; dropPending(); continue; }
      dropPending();
      at += op.s.length;
    }
    dropPending();
    return;
  }
  if (kids.length !== node.childCount) return;
  kids.forEach((k, i) => {
    if (k instanceof Y.XmlElement) syncTextInPlace(k, node.child(i));
  });
}

function syncBlocks(doc: Y.Doc, fragment: Y.XmlFragment, pDoc: PMNode): void {
  const meta: BindingMeta = { mapping: new Map(), isOMark: new Map() };
  const yKids = fragment.toArray();
  const current = ((yDocToProsemirrorJSON(doc, NOTES_YJS_FIELD) as { content?: unknown[] }).content ?? []);
  const pKids: PMNode[] = [];
  pDoc.forEach((c) => { pKids.push(c); });
  const n = yKids.length;
  const m = pKids.length;
  if (current.length !== n || n * m > MAX_LCS_CELLS || !yKids.every((k) => k instanceof Y.XmlElement)) {
    updateYFragment(doc, fragment, pDoc, meta);
    return;
  }
  // Normalise both sides through the schema so equal blocks compare equal.
  const yNodes = current.map((j) => schema().nodeFromJSON(j));
  const yKeys = yNodes.map((x) => JSON.stringify(x.toJSON()));
  const pKeys = pKids.map((x) => JSON.stringify(x.toJSON()));

  // LCS over suffixes: dp[i][j] = LCS(y[i..], p[j..]).
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = yKeys[i] === pKeys[j]
        ? dp[(i + 1) * w + j + 1] + 1
        : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }

  let pos = 0; // index into the LIVE fragment
  const insertBlock = (node: PMNode) => {
    const el = new Y.XmlElement(node.type.name);
    fragment.insert(pos, [el]);
    updateYFragment(doc, el, node, meta);
    pos += 1;
  };
  const flush = (dels: number[], ins: number[]) => {
    // 1. Order-preserving greedy pairing of SIMILAR blocks of the same type
    //    (pairs hold indexes into `dels` / `ins`).
    const similar: Array<[number, number]> = [];
    let from = 0;
    for (let d = 0; d < dels.length; d++) {
      const a = dels[d];
      let best = -1;
      let bestSim = 0.49; // pair at ≥ 0.5
      for (let b = from; b < ins.length; b++) {
        const pn = pKids[ins[b]];
        if (pn.type.name !== (yKids[a] as Y.XmlElement).nodeName) continue;
        const sim = similarity(yNodes[a].textContent, pn.textContent);
        if (sim > bestSim) { bestSim = sim; best = b; }
      }
      if (best >= 0) { similar.push([d, best]); from = best + 1; }
    }
    // 2. Between those pairs, pair the rest BY POSITION when the types
    //    match: a near-total rewrite of a paragraph is still that paragraph
    //    (updated in place, character by character), so a live peer's
    //    concurrent typing in it survives instead of being deleted with it.
    const pairs: Array<[number, number]> = [];
    let pd = 0;
    let pi = 0;
    for (const [d, b] of [...similar, [dels.length, ins.length] as [number, number]]) {
      for (let k = 0; pd + k < d && pi + k < b; k++) {
        if (pKids[ins[pi + k]].type.name === (yKids[dels[pd + k]] as Y.XmlElement).nodeName) pairs.push([pd + k, pi + k]);
      }
      if (d < dels.length) pairs.push([d, b]);
      pd = d + 1;
      pi = b + 1;
    }
    let di = 0;
    let ii = 0;
    const until = (d: number, b: number) => {
      for (; di < d; di++) fragment.delete(pos, 1);
      for (; ii < b; ii++) insertBlock(pKids[ins[ii]]);
    };
    for (const [d, b] of pairs) {
      until(d, b);
      const el = yKids[dels[d]] as Y.XmlElement;
      syncTextInPlace(el, pKids[ins[b]]);
      updateYFragment(doc, el, pKids[ins[b]], meta);
      pos += 1;
      di += 1;
      ii += 1;
    }
    until(dels.length, ins.length);
  };

  let i = 0;
  let j = 0;
  let dels: number[] = [];
  let ins: number[] = [];
  while (i < n || j < m) {
    if (i < n && j < m && yKeys[i] === pKeys[j]) {
      flush(dels, ins);
      dels = [];
      ins = [];
      pos += 1;
      i += 1;
      j += 1;
    } else if (j >= m || (i < n && dp[(i + 1) * w + j] >= dp[i * w + j + 1])) {
      dels.push(i++);
    } else {
      ins.push(j++);
    }
  }
  flush(dels, ins);
}

export type BodyToStateResult =
  | { ok: true; state: string; bodyJson: Record<string, unknown>; update: string }
  | { ok: false; error: string };

/**
 * A single-editor save expressed as a Yjs update: load the stored state,
 * rewrite the XML fragment to match `bodyJson` in one transaction (a
 * structural diff — untouched blocks and text keep their CRDT identity), and
 * return the merged state, the derived body, and the update itself.
 *
 * `update` is relative to `stored`: it can later be merged into a NEWER
 * state (one that gained concurrent collaborative edits) with mergeState,
 * and those edits survive — which is how a save whose base was current when
 * the diff was taken never has to bounce just because a peer saved a moment
 * later.
 */
export function applyBodyToState(stored: string, bodyJson: unknown): BodyToStateResult {
  let pNode: PMNode;
  try {
    pNode = schema().nodeFromJSON(bodyJson ?? EMPTY_DOC);
  } catch {
    return { ok: false, error: "Invalid note body" };
  }
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, b64decode(stored));
    const before = Y.encodeStateVector(doc);
    const fragment = doc.getXmlFragment(NOTES_YJS_FIELD);
    doc.transact(() => syncBlocks(doc, fragment, pNode));
    const update = b64encode(Y.encodeStateAsUpdate(doc, before));
    const done = finish(doc);
    if (!done.ok) return done;
    return { ...done, update };
  } catch (e) {
    console.error("[notes-yjs] body→state", e instanceof Error ? e.message : e);
    return { ok: false, error: "Invalid note body" };
  } finally {
    doc.destroy();
  }
}

/* ── Rebase (a stale single-editor save) ───────────────────────────────── */

/** A body run through the note schema (equal content → equal JSON), or null. */
export function normalizeBody(json: unknown): Record<string, unknown> | null {
  try {
    return schema().nodeFromJSON(json ?? EMPTY_DOC).toJSON() as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type RebaseResult =
  | { ok: true; bodyJson: Record<string, unknown>; conflicts: number }
  | { ok: false; error: string };

/** 3-way merge of plain bodies (a note without a Yjs state). */
export function rebaseBody(current: unknown, base: unknown, local: unknown, conflictLabel: string): RebaseResult {
  const l = normalizeBody(local);
  if (!l) return { ok: false, error: "Invalid note body" };
  // An unreadable base / current still merges (every block then counts as
  // changed, and the local blocks are kept as copies — never dropped).
  const merged = mergeDocs(normalizeBody(base) ?? base, l, normalizeBody(current) ?? current, conflictLabel);
  const bodyJson = normalizeBody(merged.doc);
  if (!bodyJson) return { ok: false, error: "Invalid note body" };
  return { ok: true, bodyJson, conflicts: merged.conflicts };
}

export type RebaseStateResult =
  | { ok: true; state: string; bodyJson: Record<string, unknown>; update: string; conflicts: number }
  | { ok: false; error: string };

/**
 * A stale single-editor save on a note with a Yjs state: merge the client's
 * changes (base → local) onto the document the stored state holds NOW, then
 * express the result as a Yjs update against that state (the same block
 * matcher as applyBodyToState) — so both the newer saved content and live
 * peers' concurrent edits survive.
 */
export function rebaseOntoState(stored: string, base: unknown, local: unknown, conflictLabel: string): RebaseStateResult {
  const doc = new Y.Doc();
  let target: Record<string, unknown>;
  let conflicts: number;
  try {
    Y.applyUpdate(doc, b64decode(stored));
    const current = yDocToProsemirrorJSON(doc, NOTES_YJS_FIELD);
    const r = rebaseBody(current, base, local, conflictLabel);
    if (!r.ok) return r;
    target = r.bodyJson;
    conflicts = r.conflicts;
  } catch (e) {
    console.error("[notes-yjs] rebase", e instanceof Error ? e.message : e);
    return { ok: false, error: "Invalid note body" };
  } finally {
    doc.destroy();
  }
  const applied = applyBodyToState(stored, target);
  if (!applied.ok) return applied;
  return { ...applied, conflicts };
}
