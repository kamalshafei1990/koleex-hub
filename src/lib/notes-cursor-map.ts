/* ---------------------------------------------------------------------------
   notes-cursor-map — carry a cursor position from one version of a note to
   another when the editor adopts a whole new document (a rebased save's
   merged body), where no ProseMirror steps exist to map through.

   The two documents are matched the way the merge / block matcher match
   them: unchanged blocks by content (LCS over stable keys); among the
   changed ones, a similar block of the same type (≥ 0.5 prefix+suffix
   overlap), then the rest by position when the types agree. Descending into
   the block that holds the cursor, the offset inside a text block is mapped
   through a character diff — so the caret stays on the same character even
   when text was inserted before it in the same paragraph, or paragraphs
   were added above it. A cursor inside a block that no longer exists lands
   at the start of the next surviving one.

   Pure (ProseMirror nodes in, positions out); used by NoteEditor.
   --------------------------------------------------------------------------- */

import type { Node as PMNode } from "@tiptap/pm/model";
import { charDiff, matchPairs, similarity, stableKey } from "@/lib/notes-merge3";

/** Text of an inline-content node with every inline leaf as one char, so
 *  string offsets equal content positions. */
function inlineText(n: PMNode): string {
  return n.textBetween(0, n.content.size, "", "￼");
}

function mapInline(a: PMNode, b: PMNode, off: number): number {
  const sa = inlineText(a);
  const sb = inlineText(b);
  if (sa === sb) return Math.min(off, b.content.size);
  let ap = 0;
  let bp = 0;
  for (const op of charDiff(sa, sb)) {
    const n = op.s.length;
    if (op.op === "eq") {
      if (off <= ap + n) return bp + (off - ap);
      ap += n;
      bp += n;
    } else if (op.op === "del") {
      if (off < ap + n) return bp; // inside removed text: where it was
      ap += n;
    } else {
      bp += n;
    }
  }
  return Math.min(bp, b.content.size);
}

/** Child pairs a[i] ↔ b[j]: equal content, then similar, then by position. */
function pairChildren(a: PMNode, b: PMNode): Map<number, number> {
  const ak: string[] = [];
  const bk: string[] = [];
  const at: PMNode[] = [];
  const bt: PMNode[] = [];
  a.forEach((c) => { ak.push(stableKey(c.toJSON())); at.push(c); });
  b.forEach((c) => { bk.push(stableKey(c.toJSON())); bt.push(c); });
  const out = new Map<number, number>();
  const eq = matchPairs(ak, bk);
  let pi = 0;
  let pj = 0;
  for (const [ei, ej] of [...eq, [ak.length, bk.length] as [number, number]]) {
    // The gap a[pi..ei) ↔ b[pj..ej): similar blocks first, in order…
    const sim: Array<[number, number]> = [];
    let from = pj;
    for (let i = pi; i < ei; i++) {
      let best = -1;
      let bestSim = 0.49;
      for (let j = from; j < ej; j++) {
        if (bt[j].type !== at[i].type) continue;
        const s = similarity(at[i].textContent, bt[j].textContent);
        if (s > bestSim) { bestSim = s; best = j; }
      }
      if (best >= 0) { sim.push([i, best]); from = best + 1; }
    }
    // …then, between those, the rest by position when the types agree.
    let qi = pi;
    let qj = pj;
    for (const [si, sj] of [...sim, [ei, ej] as [number, number]]) {
      for (let k = 0; qi + k < si && qj + k < sj; k++) {
        if (at[qi + k].type === bt[qj + k].type) out.set(qi + k, qj + k);
      }
      if (si < ei) out.set(si, sj);
      qi = si + 1;
      qj = sj + 1;
    }
    if (ei < ak.length) out.set(ei, ej);
    pi = ei + 1;
    pj = ej + 1;
  }
  return out;
}

/** Map a content offset of container `a` to one of container `b`. */
function mapIn(a: PMNode, b: PMNode, off: number, depth: number): number {
  if (a.inlineContent && b.inlineContent) return mapInline(a, b, off);
  if (a.inlineContent || b.inlineContent || a.childCount === 0 || b.childCount === 0 || depth > 64) {
    return Math.min(off, b.content.size);
  }
  const pairs = pairChildren(a, b);
  const bStart: number[] = [];
  let acc = 0;
  b.forEach((c) => { bStart.push(acc); acc += c.nodeSize; });
  let start = 0;
  for (let i = 0; i < a.childCount; i++) {
    const c = a.child(i);
    const end = start + c.nodeSize;
    if (off < end || i === a.childCount - 1) {
      const j = pairs.get(i);
      if (j === undefined) {
        // The block is gone: the start of the next surviving block (or the
        // end of the previous one).
        for (let k = i + 1; k < a.childCount; k++) {
          const nj = pairs.get(k);
          if (nj !== undefined) return bStart[nj] + (b.child(nj).isLeaf ? 0 : 1);
        }
        for (let k = i - 1; k >= 0; k--) {
          const pj = pairs.get(k);
          if (pj !== undefined) return bStart[pj] + b.child(pj).nodeSize - (b.child(pj).isLeaf ? 0 : 1);
        }
        return Math.min(off, b.content.size);
      }
      const bc = b.child(j);
      if (off <= start) return bStart[j];
      if (c.isLeaf || bc.isLeaf || off >= end) return bStart[j] + Math.min(off - start, bc.nodeSize);
      return bStart[j] + 1 + mapIn(c, bc, off - start - 1, depth + 1);
    }
    start = end;
  }
  return Math.min(off, b.content.size);
}

/**
 * Where document position `pos` of `oldDoc` is in `newDoc` (both documents,
 * positions as ProseMirror counts them). Always within newDoc's bounds.
 */
export function mapPosAcrossDocs(oldDoc: PMNode, newDoc: PMNode, pos: number): number {
  const off = Math.max(0, Math.min(pos, oldDoc.content.size));
  const out = mapIn(oldDoc, newDoc, off, 0);
  return Math.max(0, Math.min(out, newDoc.content.size));
}
