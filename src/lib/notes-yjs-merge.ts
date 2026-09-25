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
   updated IN PLACE only when a similar block replaces it (then
   updateYFragment's text diff preserves concurrent typing inside it);
   everything else is a real delete / insert. */

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
    // Order-preserving greedy pairing of similar blocks of the same type.
    const pairs: Array<[number, number]> = [];
    let from = 0;
    for (const a of dels) {
      let best = -1;
      let bestSim = 0.49; // pair at ≥ 0.5
      for (let b = from; b < ins.length; b++) {
        const pn = pKids[ins[b]];
        if (pn.type.name !== (yKids[a] as Y.XmlElement).nodeName) continue;
        const sim = similarity(yNodes[a].textContent, pn.textContent);
        if (sim > bestSim) { bestSim = sim; best = b; }
      }
      if (best >= 0) { pairs.push([a, best]); from = best + 1; }
    }
    let di = 0;
    let ii = 0;
    const until = (a: number, b: number) => {
      for (; di < dels.length && dels[di] !== a; di++) fragment.delete(pos, 1);
      for (; ii < ins.length && ii !== b; ii++) insertBlock(pKids[ins[ii]]);
    };
    for (const [a, b] of pairs) {
      until(a, b);
      updateYFragment(doc, yKids[a] as Y.XmlElement, pKids[ins[b]], meta);
      pos += 1;
      di += 1;
      ii += 1;
    }
    until(-1, -1);
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
