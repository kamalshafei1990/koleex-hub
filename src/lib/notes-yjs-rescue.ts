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

   Pure (no DOM, no Buffer): imported by the server and the browser.
   --------------------------------------------------------------------------- */

import * as Y from "yjs";

type StateVector = Map<number, number>;
type DeleteSet = ReturnType<typeof Y.createDeleteSetFromStructStore>;
/** The part of a Yjs type the walk needs (its item lists). */
type YType = { _map: Map<string, Y.Item>; _start: Y.Item | null };

/** What the other side knows: its state vector and its deletions. */
export interface OtherSide {
  sv: StateVector;
  ds: DeleteSet;
}

export interface Rescue {
  /** The deleted block's item id — the copy goes right after it. */
  ref: Y.ID;
  /** A detached copy of the block as THIS side sees it. */
  copy: Y.XmlElement;
}

export function otherSideOf(doc: Y.Doc): OtherSide {
  return { sv: Y.decodeStateVector(Y.encodeStateVector(doc)), ds: Y.createDeleteSetFromStructStore(doc.store) };
}

function unknownTo(item: Y.Item, sv: StateVector): boolean {
  return item.id.clock >= (sv.get(item.id.client) ?? 0);
}

/** Live content in `type` the other side never saw (by `author`, if set). */
function holdsUnseen(type: YType, sv: StateVector, author: number | null): boolean {
  const unseen = (it: Y.Item) => !it.deleted && unknownTo(it, sv) && (author === null || it.id.client === author);
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

/**
 * Blocks of `doc` (fragment `field`) that `other` deleted although they
 * hold content `other` never saw. Only the TOPMOST such block is taken (a
 * list item inside a still-living list, a whole paragraph at the top).
 * Take the copies BEFORE applying the other side's update.
 */
export function findRescues(doc: Y.Doc, field: string, other: OtherSide, author: number | null): Rescue[] {
  const out: Rescue[] = [];
  const visit = (type: YType) => {
    for (let it = type._start; it; it = it.right) {
      if (it.deleted || !(it.content instanceof Y.ContentType)) continue;
      const child = it.content.type;
      if (!(child instanceof Y.XmlElement)) continue;
      // A block the other side never saw cannot have been deleted by it.
      if (unknownTo(it, other.sv)) continue;
      if (Y.isDeleted(other.ds, it.id)) {
        if (holdsUnseen(child as unknown as YType, other.sv, author)) out.push({ ref: it.id, copy: copyElement(child) });
        continue;
      }
      visit(child as unknown as YType);
    }
  };
  visit(doc.getXmlFragment(field) as unknown as YType);
  return out;
}

/** Re-insert the rescued blocks right after their deleted originals. */
export function applyRescues(doc: Y.Doc, field: string, rescues: Rescue[]): number {
  // Typed access first: a root type that only an update has touched is
  // still a generic AbstractType until it is asked for as a fragment.
  doc.getXmlFragment(field);
  let n = 0;
  doc.transact(() => {
    for (const r of rescues) {
      let item: Y.Item | null = null;
      try { item = Y.getItem(doc.store, r.ref) as Y.Item; } catch { item = null; }
      const parent = item?.parent;
      if (!item || !(parent instanceof Y.XmlElement || parent instanceof Y.XmlFragment)) continue;
      parent.insertAfter(item, [r.copy]);
      n += 1;
    }
  });
  return n;
}
