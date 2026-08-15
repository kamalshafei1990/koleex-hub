/* Status pill classes for the document apps — one ladder, not six.
   ---------------------------------------------------------------------------
   Quotations.tsx and InvoicesDoc.tsx each carried THREE copies of the same
   colour ladder, and all six were identical character for character:

     accepted / paid   bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35
     sent              bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40
     rejected          bg-[#FF3333]/12 text-[#FF3333] border-[#FF3333]/35
     draft             bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/35

   Six copies is not a style problem, it is six places to miss when a status is
   added or a colour changes — and the two apps show the SAME documents at
   different stages, so they drifting apart is a correctness problem before it
   is an aesthetic one.

   THE COLOURS ARE NOW THE HUB'S OWN TONES, not new literals. KpiCard has
   carried a semantic tone vocabulary for a long time — emerald / amber / rose
   / blue — and these hexes were that vocabulary rewritten by hand: #10B981 is
   emerald-500, #F59E0B is amber-500, #567FB2 is Hub Blue. Using the named
   scale means both themes get a value that was designed for them instead of
   one dark-mode literal doing duty in both. */

export type DocStatus =
  | "draft" | "sent" | "accepted" | "rejected" | "expired" | "paid" | "overdue" | string;

const LADDER: Record<string, string> = {
  accepted: "bg-emerald-500/12 text-emerald-400 border-emerald-500/35",
  paid:     "bg-emerald-500/12 text-emerald-400 border-emerald-500/35",
  sent:     "bg-blue-500/15 text-blue-300 border-blue-500/40",
  rejected: "bg-rose-500/12 text-rose-400 border-rose-500/35",
  overdue:  "bg-rose-500/12 text-rose-400 border-rose-500/35",
  /* Expired is deliberately NOT a colour. It is not a problem to fix or a
     result to celebrate — it is a document that stopped being current, and it
     should recede rather than compete with the ones that still matter. */
  expired:  "bg-[var(--bg-inverted)]/[0.06] text-[var(--text-muted)] border-[var(--border-subtle)]",
};

const DEFAULT = "bg-amber-500/12 text-amber-400 border-amber-500/35";   // draft

/** The colour half of a status pill. The shape half — height, radius, padding —
 *  stays at the call site, because the two apps size their pills differently
 *  and that is a layout decision, not a status one. */
export function statusTone(status: DocStatus): string {
  return LADDER[status] ?? DEFAULT;
}
