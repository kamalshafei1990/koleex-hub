/* ---------------------------------------------------------------------------
   trade-terms/data — the ELEVEN Incoterms® 2020 rules and the exporter's
   payment ladder, as structure.

   SOURCES. Every value traces to the body that PUBLISHES the rule:
     · Incoterms® 2020 rules, insurance tiers, container guidance
       — International Chamber of Commerce (ICC).
     · The exporter risk ladder — U.S. International Trade Administration.
     · L/C and collection mechanics — ICC UCP 600 and URC 522.

   NO PROSE LIVES HERE. Not a style preference — a size decision. This file
   is in the page's first bytes, so anything written in one language would be
   written three times and shipped to every reader. Prose lives in
   copy.<lang>.ts and is fetched only when a reader opens a term.

   ONE CORRECTION, KEPT DELIBERATELY. Risk under FOB / CFR / CIF does NOT
   pass at the "ship's rail". That wording was deleted in Incoterms 2010
   after decades of litigation over an imaginary vertical line; the rule is
   "on board the vessel". Widely-copied sources — including a US government
   page — still repeat it. Hence `riskPassesAt: "onBoard"` for all three.
   --------------------------------------------------------------------------- */

import type { Incoterm, LegacyIncoterm, PaymentGroup, PaymentMethod } from "./types";

/** Ordered least → most seller obligation, so the grid teaches the ladder
 *  just by being read top to bottom. */
export const INCOTERMS: Incoterm[] = [
  {
    code: "EXW", name: "Ex Works", family: "any", order: 1,
    riskPassesAt: "sellerPremises", costEndsAt: "sellerPremises",
    costs: {
      exportPackLoad: "buyer", exportClearance: "buyer", mainCarriage: "buyer",
      insurance: "buyer", importClearance: "buyer", dutyVat: "buyer",
      unloadAtDestination: "buyer",
    },
  },
  {
    code: "FCA", name: "Free Carrier", family: "any", order: 2,
    riskPassesAt: "exportCleared", costEndsAt: "exportCleared",
    costs: {
      exportPackLoad: "seller", exportClearance: "seller", mainCarriage: "buyer",
      insurance: "buyer", importClearance: "buyer", dutyVat: "buyer",
      unloadAtDestination: "buyer",
    },
  },
  {
    code: "FAS", name: "Free Alongside Ship", family: "sea", order: 3,
    riskPassesAt: "alongsideShip", costEndsAt: "alongsideShip",
    costs: {
      exportPackLoad: "seller", exportClearance: "seller", mainCarriage: "buyer",
      insurance: "buyer", importClearance: "buyer", dutyVat: "buyer",
      unloadAtDestination: "buyer",
    },
    containerTrap: true, containerAlternative: "FCA",
  },
  {
    code: "FOB", name: "Free On Board", family: "sea", order: 4,
    riskPassesAt: "onBoard", costEndsAt: "onBoard",
    costs: {
      exportPackLoad: "seller", exportClearance: "seller", mainCarriage: "buyer",
      insurance: "buyer", importClearance: "buyer", dutyVat: "buyer",
      unloadAtDestination: "buyer",
    },
    containerTrap: true, containerAlternative: "FCA",
  },
  {
    /* C group: cost deliberately runs PAST the risk point. */
    code: "CFR", name: "Cost and Freight", family: "sea", order: 5,
    riskPassesAt: "onBoard", costEndsAt: "arrivalPort",
    costs: {
      exportPackLoad: "seller", exportClearance: "seller", mainCarriage: "seller",
      insurance: "buyer", importClearance: "buyer", dutyVat: "buyer",
      unloadAtDestination: "buyer",
    },
    containerTrap: true, containerAlternative: "CPT",
    /* Quotations from Egypt to Vietnam write "C&F" or "CNF". Same rule; the
       ICC spelling has been CFR since 1990. */
    aliases: ["C&F", "CNF"],
  },
  {
    code: "CIF", name: "Cost, Insurance and Freight", family: "sea", order: 6,
    riskPassesAt: "onBoard", costEndsAt: "arrivalPort",
    costs: {
      exportPackLoad: "seller", exportClearance: "seller", mainCarriage: "seller",
      insurance: "seller", importClearance: "buyer", dutyVat: "buyer",
      unloadAtDestination: "buyer",
    },
    /* Minimum tier: CIF is dominated by bulk commodities where minimum cover
       is the market norm. Parties may agree higher. */
    insuranceObligation: { clauses: "C", minCoverPct: 110 },
    containerTrap: true, containerAlternative: "CIP",
  },
  {
    code: "CPT", name: "Carriage Paid To", family: "any", order: 7,
    riskPassesAt: "exportCleared", costEndsAt: "destination",
    costs: {
      exportPackLoad: "seller", exportClearance: "seller", mainCarriage: "seller",
      insurance: "buyer", importClearance: "buyer", dutyVat: "buyer",
      unloadAtDestination: "buyer",
    },
  },
  {
    code: "CIP", name: "Carriage and Insurance Paid To", family: "any", order: 8,
    riskPassesAt: "exportCleared", costEndsAt: "destination",
    costs: {
      exportPackLoad: "seller", exportClearance: "seller", mainCarriage: "seller",
      insurance: "seller", importClearance: "buyer", dutyVat: "buyer",
      unloadAtDestination: "buyer",
    },
    /* ICC set CIP higher than CIF in 2020: CIP typically carries manufactured
       goods, which need broad cover. */
    insuranceObligation: { clauses: "A", minCoverPct: 110 },
  },
  {
    code: "DAP", name: "Delivered at Place", family: "any", order: 9,
    riskPassesAt: "destination", costEndsAt: "destination",
    costs: {
      exportPackLoad: "seller", exportClearance: "seller", mainCarriage: "seller",
      insurance: "seller", importClearance: "buyer", dutyVat: "buyer",
      unloadAtDestination: "buyer",
    },
  },
  {
    /* The only rule obliging the seller to unload. Renamed from DAT in 2020
       so the place need not be a terminal. */
    code: "DPU", name: "Delivered at Place Unloaded", family: "any", order: 10,
    riskPassesAt: "unloaded", costEndsAt: "unloaded",
    costs: {
      exportPackLoad: "seller", exportClearance: "seller", mainCarriage: "seller",
      insurance: "seller", importClearance: "buyer", dutyVat: "buyer",
      unloadAtDestination: "seller",
    },
  },
  {
    code: "DDP", name: "Delivered Duty Paid", family: "any", order: 11,
    riskPassesAt: "importCleared", costEndsAt: "importCleared",
    costs: {
      exportPackLoad: "seller", exportClearance: "seller", mainCarriage: "seller",
      insurance: "seller", importClearance: "seller", dutyVat: "seller",
      unloadAtDestination: "buyer",
    },
  },
];

/** Most secure → least secure FOR THE EXPORTER. Buyer security runs the other
 *  way: every step protecting the seller exposes the buyer, which is why
 *  payment terms are negotiated rather than chosen.
 *
 *  FOUR GROUPS IN ONE LIST, on purpose. A reader who types "SBLC" or "APG"
 *  into the search box should find it without knowing which shelf it sits
 *  on; one list, one filter. The `group` field is what the page uses to put
 *  each card under the right heading when nobody is searching.
 *
 *  Only the six METHODS carry a `ladder` rung: a rung means "a way of getting
 *  paid", and a confirmed credit or a performance guarantee is a refinement
 *  of a method, not a rung of its own. */
export const PAYMENT_METHODS: PaymentMethod[] = [
  /* ── The six methods (the ladder) ─────────────────────────────────── */
  { id: "cash-in-advance", name: "Cash in advance", group: "method", ladder: 1, bankUndertaking: false, goodsBeforePayment: false, aliases: ["CIA", "Advance payment"] },
  { id: "letter-of-credit", abbr: "L/C", name: "Letter of credit", group: "method", ladder: 2, bankUndertaking: true, goodsBeforePayment: false, aliases: ["LC", "Documentary credit"] },
  { id: "dp", abbr: "D/P", name: "Documents against Payment", group: "method", ladder: 3, bankUndertaking: false, goodsBeforePayment: false, aliases: ["CAD"] },
  { id: "da", abbr: "D/A", name: "Documents against Acceptance", group: "method", ladder: 4, bankUndertaking: false, goodsBeforePayment: true },
  { id: "open-account", name: "Open account", group: "method", ladder: 5, bankUndertaking: false, goodsBeforePayment: true, aliases: ["O/A", "Net 30 / 60 / 90"] },
  { id: "consignment", name: "Consignment", group: "method", ladder: 6, bankUndertaking: false, goodsBeforePayment: true },

  /* ── Letter of credit — the variants a contract actually names ─────
     Every one of these is still an L/C: a bank undertaking, documents only.
     The label changes WHO promises (confirmed), WHEN it pays (sight,
     usance), WHO may use it (transferable, back-to-back), HOW OFTEN it can
     be used (revolving), or what it is FOR (red clause, standby). */
  { id: "lc-irrevocable", name: "Irrevocable L/C", group: "lcType", bankUndertaking: true, goodsBeforePayment: false, protects: "both" },
  { id: "lc-confirmed", name: "Confirmed L/C", group: "lcType", bankUndertaking: true, goodsBeforePayment: false, protects: "seller" },
  { id: "lc-sight", name: "Sight L/C", group: "lcType", bankUndertaking: true, goodsBeforePayment: false, protects: "seller" },
  { id: "lc-usance", name: "Usance L/C", group: "lcType", bankUndertaking: true, goodsBeforePayment: true, protects: "buyer", aliases: ["Deferred payment L/C", "UPAS"] },
  { id: "lc-transferable", name: "Transferable L/C", group: "lcType", bankUndertaking: true, goodsBeforePayment: false, protects: "seller" },
  { id: "lc-back-to-back", name: "Back-to-back L/C", group: "lcType", bankUndertaking: true, goodsBeforePayment: false, protects: "seller" },
  { id: "lc-revolving", name: "Revolving L/C", group: "lcType", bankUndertaking: true, goodsBeforePayment: false, protects: "both" },
  { id: "lc-red-clause", name: "Red clause L/C", group: "lcType", bankUndertaking: true, goodsBeforePayment: false, protects: "seller", aliases: ["Green clause"] },
  { id: "lc-standby", abbr: "SBLC", name: "Standby L/C", group: "lcType", bankUndertaking: true, goodsBeforePayment: true, protects: "seller" },

  /* ── Bank guarantees (ICC URDG 758) ─────────────────────────────────
     Not ways of paying: ways of protecting a payment or a performance
     already promised. Each pays only when someone FAILS. */
  { id: "bg-advance-payment", abbr: "APG", name: "Advance payment guarantee", group: "guarantee", bankUndertaking: true, goodsBeforePayment: false, protects: "buyer" },
  { id: "bg-performance", name: "Performance guarantee", group: "guarantee", bankUndertaking: true, goodsBeforePayment: false, protects: "buyer", aliases: ["Performance bond"] },
  { id: "bg-bid", name: "Bid bond", group: "guarantee", bankUndertaking: true, goodsBeforePayment: false, protects: "buyer", aliases: ["Tender guarantee", "Bid security"] },
  { id: "bg-warranty", name: "Warranty guarantee", group: "guarantee", bankUndertaking: true, goodsBeforePayment: false, protects: "buyer", aliases: ["Retention bond"] },

  /* ── Escrow ──────────────────────────────────────────────────────────
     A third party holds the money. No bank undertaking — the agent pays out
     what it holds, it promises nothing of its own. */
  { id: "escrow", name: "Escrow", group: "platform", bankUndertaking: false, goodsBeforePayment: false, protects: "both", aliases: ["Trade assurance"] },
];

export function paymentsIn(group: PaymentGroup): PaymentMethod[] {
  return PAYMENT_METHODS.filter((p) => p.group === group);
}

/** The six rungs, safest first. Rendered by the ladder; derived here so the
 *  ladder never has to know which entries carry a rung. */
export const PAYMENT_LADDER: (PaymentMethod & { ladder: number })[] = PAYMENT_METHODS
  .filter((p): p is PaymentMethod & { ladder: number } => p.ladder != null)
  .sort((a, b) => a.ladder - b.ladder);

/** T/T is the plumbing, not a risk structure — its security comes entirely
 *  from WHEN the transfer falls due relative to shipment. Kept separate from
 *  the ladder for that reason: listing it as a rung would imply a risk level
 *  it does not have on its own.
 *
 *  The trigger wording lives in ui.ts, in three languages — it was English
 *  prose here once, and showed up untranslated on Chinese and Arabic cards. */
export const TT_STRUCTURES = [
  { id: "tt-100-advance", split: "100%" },
  { id: "tt-30-70-bl", split: "30 / 70" },
  { id: "tt-30-70-preship", split: "30 / 70" },
  { id: "tt-30-40-30", split: "30 / 40 / 30" },
] as const;

export type TtStructureId = (typeof TT_STRUCTURES)[number]["id"];

/** Rules ICC has removed that still appear in contracts, because templates
 *  outlive rulebooks. DDU in particular is written every day. Incoterms 2010
 *  dropped DAF, DES, DEQ and DDU and introduced DAT and DAP; Incoterms 2020
 *  renamed DAT to DPU. */
export const LEGACY_INCOTERMS: LegacyIncoterm[] = [
  { code: "DDU", name: "Delivered Duty Unpaid", retiredIn: 2010, replacedBy: "DAP" },
  { code: "DAT", name: "Delivered at Terminal", retiredIn: 2020, replacedBy: "DPU" },
  { code: "DAF", name: "Delivered at Frontier", retiredIn: 2010, replacedBy: "DAP" },
  { code: "DES", name: "Delivered Ex Ship", retiredIn: 2010, replacedBy: "DAP" },
  { code: "DEQ", name: "Delivered Ex Quay", retiredIn: 2010, replacedBy: "DPU" },
];

/** E / F / C / D — the four Incoterm groups, which are the first letter of
 *  the code. The order is the order of increasing seller obligation, and the
 *  page teaches the ladder just by listing the groups in it. */
export const INCOTERM_GROUPS = ["E", "F", "C", "D"] as const;
export type IncotermGroup = (typeof INCOTERM_GROUPS)[number];

export function incotermsIn(group: IncotermGroup): Incoterm[] {
  return INCOTERMS.filter((i) => i.code[0] === group);
}

export const INCOTERM_CODES = INCOTERMS.map((i) => i.code);

export function getIncoterm(code: string): Incoterm | undefined {
  const c = code.trim().toUpperCase();
  return INCOTERMS.find((i) => i.code === c);
}
