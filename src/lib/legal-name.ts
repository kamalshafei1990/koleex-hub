/* ---------------------------------------------------------------------------
   The company's formal English name — and the names it had before.

   Owner, 27/09/2026: the formal English name is exactly
   "KOLEEX INTERNATIONAL CORPORATION (TAIZHOU) CO., LTD." and it appears on
   formal documents only. Everywhere else — screens, cards, signatures,
   contact QR codes — the company is EVERYDAY_NAME_EN (owner, 28/09/2026).
   A document keeps the name that was in force when it was MADE: every
   quotation, invoice, packing list, payslip and contract created before
   01/10/2026 still prints the old spelling, however often it is reopened.

   Two names never follow this history:
   · the bank's beneficiary name — it must match the bank's records letter
     for letter, or a transfer can be refused;
   · a signed sales contract — it prints the name frozen in its snapshot.
   --------------------------------------------------------------------------- */

/** The everyday name (owner, 28/09/2026: "always, except official
 *  documents"). Formal documents use legalNameEn() instead. */
export const EVERYDAY_NAME_EN = "Koleex International Group";

/** The formal English name in force today. */
export const LEGAL_NAME_EN = "KOLEEX INTERNATIONAL CORPORATION (TAIZHOU) CO., LTD.";

/** Earlier names, newest first: each applies to documents made before `until`. */
export const LEGAL_NAME_HISTORY: ReadonlyArray<{ until: string; en: string }> = [
  { until: "2026-10-01T00:00:00+08:00", en: "KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD." },
];

/** Exactly as the bank holds it — never changed with the legal name. */
export const BANK_BENEFICIARY_NAME = "KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO. LTD.";

/** The formal English name in force on the day a document was made. No
 *  date — a new, unsaved document, or one generated on demand (a report,
 *  an employment contract) — means now, so before 01/10/2026 every paper
 *  still prints the old name and from that day every paper the new one. */
export function legalNameEn(madeAt?: string | Date | null): string {
  const parsed = madeAt instanceof Date ? madeAt.getTime() : madeAt ? Date.parse(madeAt) : NaN;
  const t = Number.isNaN(parsed) ? Date.now() : parsed;
  let name = LEGAL_NAME_EN;
  for (const h of LEGAL_NAME_HISTORY) {
    if (t < Date.parse(h.until)) name = h.en;
  }
  return name;
}
