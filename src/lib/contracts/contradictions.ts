/* ---------------------------------------------------------------------------
   Terms that fight each other.

   The failure this exists to prevent is not a typo. It is a contract that is
   internally inconsistent — production counted from a deposit that the
   payment term never asks for, an FOB sale where the Seller has undertaken to
   insure, a credit expiring before the goods can be ready. Each of these
   reads fine in isolation. Together they are the clauses a buyer's bank
   rejects, or a buyer's lawyer uses.
   
   Pure functions over the terms object: no database, no React, no async, so
   the editor can run this on every keystroke and the tests can cover it
   exhaustively.

   Severity is honest about what it means:
     error — the document contradicts itself; someone will be caught by it
     warn  — legal but unusual; worth a second look before it goes out
     note  — a fact worth stating that the contract currently leaves silent
   --------------------------------------------------------------------------- */

import type { ContractContext } from "./general-terms";

export type Severity = "error" | "warn" | "note";

export interface Finding {
  /** Stable id — used to dismiss, test, and link to the field. */
  id: string;
  severity: Severity;
  /** Which editor field to point at, when one field owns the problem. */
  field?: string;
  message: string;
  /** What to actually do about it. Never "review the terms". */
  fix: string;
}

/** Incoterms 2020, grouped by what they oblige. */
const SEA_ONLY = new Set(["FAS", "FOB", "CFR", "CIF"]);
const SELLER_INSURES = new Set(["CIF", "CIP"]);
const SELLER_CARRIES = new Set(["CPT", "CIP", "CFR", "CIF", "DAP", "DPU", "DDP"]);
const ALL_INCOTERMS = new Set([
  "EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP",
]);

/* ── What the named place MEANS, per rule ───────────────────────────────────
   This is the distinction that makes "FOB Chittagong" wrong rather than
   merely odd. Under FOB the named place is the port where the goods are put
   ON BOARD — the SELLER's port. Naming the buyer's port instead says, in
   ICC's own vocabulary, that the seller carries the goods all the way to
   Bangladesh and loads them there. A bank or a buyer reading it literally
   would be entitled to hold Koleex to exactly that.

   Caught on a live contract by an outside reader (2026-08-25) after our own
   checker passed it: it knew "no named place" and "EXW with ports", and had
   no idea the place could be the WRONG one. */
export const PLACE_IS_ORIGIN = new Set(["EXW", "FCA", "FAS", "FOB"]);
export const PLACE_IS_DESTINATION = new Set(["CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"]);

/** Loose match — "Ningbo, China" vs "ningbo,  china" is the same port. */
function samePlace(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const norm = (v: string) => v.toLowerCase().replace(/[\s,.\-]+/g, " ").trim();
  return norm(a) === norm(b);
}

/** Any warranty stated in a goods description, in MONTHS. Reads "5 years",
    "5 YEARS", "24 months", "12 mo". */
export function warrantyMonthsInText(text: string): number | null {
  const m = /(\d+)\s*(years?|yrs?|months?|mos?)\b/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return /^y/i.test(m[2]) ? n * 12 : n;
}

/** Terms whose whole point is that the bank pays against documents. */
const DOCUMENTARY = new Set(["lc", "dp", "da"]);

export interface CheckableTerms extends ContractContext {
  loadingPort?: string;
  dischargePort?: string;
  containerType?: string;
  documents?: string[];
  specialConditions?: string[];
  /* The goods as they will PRINT. The checker has to see them: a contract
     whose articles promise 12 months while every line of its own schedule
     says "Warranty: 5 YEARS" contradicts itself on one page, and no amount
     of checking the terms object alone can find that. */
  goods?: { description?: string }[];
}

/** Does this payment term actually produce a payment before production?
    "30% T/T deposit, 70% before shipment" does. "100% T/T before shipment"
    does not — the money arrives when the goods are already made. Read from
    the printed label because the CATEGORY cannot tell the two apart: both
    are T/T. */
export function impliesAdvancePayment(label?: string): boolean {
  if (!label) return false;
  if (/deposit|advance|down.?payment|prepay/i.test(label)) return true;
  /* A staged split — "30% … 70% …" — means the first stage is up front. */
  return /\d+\s*%[^%]*\d+\s*%/.test(label);
}

export function checkContract(t: CheckableTerms): Finding[] {
  const out: Finding[] = [];
  const add = (f: Finding) => out.push(f);
  const incoterm = (t.incoterm ?? "").toUpperCase();

  /* ── The incoterm itself ── */
  if (!incoterm) {
    add({
      id: "incoterm-missing",
      severity: "error",
      field: "incoterm",
      message: "No delivery term. The contract does not say where risk passes or who pays freight.",
      fix: "Pick an Incoterms 2020 rule — FOB, CIF, FCA, EXW …",
    });
  } else if (!ALL_INCOTERMS.has(incoterm)) {
    add({
      id: "incoterm-unknown",
      severity: "error",
      field: "incoterm",
      message: `"${incoterm}" is not an Incoterms 2020 rule. DAT and DDU were withdrawn.`,
      fix: "DAT became DPU in 2020; DDU became DAP in 2010. Use the current rule.",
    });
  } else if (!t.incotermPlace) {
    add({
      id: "incoterm-no-place",
      severity: "error",
      field: "incotermPlace",
      message: `"${incoterm}" without a named place is incomplete — the rule only works with one.`,
      fix: `Name the place: "${incoterm} ${SELLER_CARRIES.has(incoterm) ? "Chittagong" : "Ningbo"}", for example.`,
    });
  }

  /* ── The named place must be on the rule's OWN side ── */
  if (incoterm && t.incotermPlace) {
    if (PLACE_IS_ORIGIN.has(incoterm) && samePlace(t.incotermPlace, t.dischargePort)) {
      add({
        id: "place-is-destination-on-origin-term",
        severity: "error",
        field: "incotermPlace",
        message: `"${incoterm} ${t.incotermPlace}" names the port of DISCHARGE. Under ${incoterm} the named place is where the Seller hands the goods over — the port of loading.`,
        fix: `Write "${incoterm} ${t.loadingPort || "the port of loading"}". ${t.incotermPlace} is the port of discharge, and naming it here says the Seller carries the goods there at its own cost and risk.`,
      });
    }
    if (PLACE_IS_DESTINATION.has(incoterm) && samePlace(t.incotermPlace, t.loadingPort)) {
      add({
        id: "place-is-origin-on-destination-term",
        severity: "error",
        field: "incotermPlace",
        message: `"${incoterm} ${t.incotermPlace}" names the port of LOADING. Under ${incoterm} the Seller pays carriage to the named place, so it must be the destination.`,
        fix: `Write "${incoterm} ${t.dischargePort || "the port of discharge"}".`,
      });
    }
  }

  /* ── The goods must not promise a different warranty from the articles ── */
  if (t.warrantyMonths != null && t.warrantyMonths > 0) {
    const stated = new Set<number>();
    for (const g of t.goods ?? []) {
      const m = warrantyMonthsInText(g.description ?? "");
      if (m != null) stated.add(m);
    }
    const conflicting = [...stated].filter((m) => m !== t.warrantyMonths);
    if (conflicting.length > 0) {
      const asText = conflicting
        .map((m) => (m % 12 === 0 ? `${m / 12} year${m / 12 === 1 ? "" : "s"}` : `${m} months`))
        .join(" / ");
      add({
        id: "warranty-conflicts-with-goods",
        severity: "error",
        field: "warrantyMonths",
        message: `The warranty article says ${t.warrantyMonths} months, but the goods on this contract are described as carrying ${asText}. The document contradicts itself on one page.`,
        fix: `Set the warranty to match what the goods actually carry, or remove the period from the item descriptions. A buyer holding both will rely on the longer one.`,
      });
    }
  }

  /* ── Payment shape against the delivery clock ── */
  if (t.paymentKind === "lc" && t.leadTimeBasis === "after_deposit") {
    add({
      id: "lc-vs-deposit",
      severity: "error",
      field: "leadTimeBasis",
      message:
        "Payment is by letter of credit, but production is counted from a deposit. There is no deposit under a credit, so the clock never starts.",
      fix: "Count production from receipt of the operative credit.",
    });
  }
  if (t.paymentKind === "tt" && t.leadTimeBasis === "after_lc_opening") {
    add({
      id: "tt-vs-lc-clock",
      severity: "error",
      field: "leadTimeBasis",
      message: "Production is counted from a credit that this contract never asks the Buyer to open.",
      fix: "Count production from the advance payment, or from the contract date.",
    });
  }
  if (
    t.leadTimeBasis === "after_deposit" &&
    (t.paymentKind === "tt" || t.paymentKind === "open") &&
    !impliesAdvancePayment(t.paymentLabel)
  ) {
    add({
      id: "clock-without-advance",
      severity: "error",
      field: "leadTimeBasis",
      message: `Production is counted from an advance payment, but "${t.paymentLabel ?? "this term"}" does not ask for one — the money arrives after the goods are made.`,
      fix: "Count production from the contract date, or add a deposit stage to the payment term.",
    });
  }

  if (!t.paymentKind || t.paymentKind === "other") {
    add({
      id: "payment-missing",
      severity: "error",
      field: "paymentTermId",
      message: "No payment term. The contract does not say when or how the Seller is paid.",
      fix: "Pick a term from the payment-terms list.",
    });
  }

  /* ── Insurance ── */
  if (SELLER_INSURES.has(incoterm)) {
    add({
      id: "insurance-level",
      severity: "note",
      field: "incoterm",
      message:
        incoterm === "CIF"
          ? "Under CIF the Seller's minimum insurance is Institute Cargo Clauses (C) at 110% — thin cover for machinery."
          : "Under CIP the Seller must insure at Clauses (A) level, 110% of the contract value.",
      fix:
        incoterm === "CIF"
          ? "If the Buyer expects all-risks cover, state Clauses (A) in the Special Conditions."
          : "State the level explicitly if the Buyer has asked for something different.",
    });
  }
  if (!SELLER_INSURES.has(incoterm) && (t.specialConditions ?? []).some((c) => /insur/i.test(c))) {
    add({
      id: "insurance-outside-term",
      severity: "warn",
      field: "specialConditions",
      message: `A special condition mentions insurance, but under ${incoterm || "this term"} the Seller has no duty to insure.`,
      fix: "Either drop the condition or make the undertaking explicit — a half-stated duty is the one that gets argued.",
    });
  }

  /* ── Containers on a sea-only term ── */
  if (SEA_ONLY.has(incoterm) && t.containerType) {
    add({
      id: "container-on-sea-term",
      severity: "warn",
      field: "incoterm",
      message: `${incoterm} passes risk at the ship, but containerised goods leave the Seller's control at the terminal, days earlier.`,
      fix: "The ICC recommends FCA for containers. Keep FOB only if the Buyer's bank requires it.",
    });
  }

  /* ── Ports ── */
  if (SEA_ONLY.has(incoterm) || SELLER_CARRIES.has(incoterm)) {
    if (!t.loadingPort) {
      add({
        id: "no-loading-port",
        severity: "warn",
        field: "loadingPort",
        message: "No port of loading. Shipping documents and the credit will both need one.",
        fix: "Name the port of loading.",
      });
    }
    if (!t.dischargePort) {
      add({
        id: "no-discharge-port",
        severity: "warn",
        field: "dischargePort",
        message: "No port of discharge.",
        fix: "Name the port of discharge.",
      });
    }
  }
  if (incoterm === "EXW" && (t.loadingPort || t.dischargePort)) {
    add({
      id: "exw-with-ports",
      severity: "warn",
      field: "incoterm",
      message: "Under EXW the Seller does not load, ship, or clear for export — naming ports implies duties the term does not carry.",
      fix: "Use FCA if the Seller is in fact loading and clearing.",
    });
  }

  /* ── Timing ── */
  if (t.leadTimeDays == null || t.leadTimeDays <= 0) {
    add({
      id: "no-lead-time",
      severity: "error",
      field: "leadTimeDays",
      message: "No delivery time. A contract with no date for delivery has nothing to breach.",
      fix: "State the production time in days.",
    });
  } else if (t.leadTimeDays > 180) {
    add({
      id: "long-lead-time",
      severity: "warn",
      field: "leadTimeDays",
      message: `${t.leadTimeDays} days is over six months — longer than most credits stay valid.`,
      fix: "Check the credit's latest shipment date against this, or agree partial shipments.",
    });
  }

  /* ── Warranty ── */
  if (t.warrantyMonths == null || t.warrantyMonths <= 0) {
    add({
      id: "no-warranty",
      severity: "warn",
      field: "warrantyMonths",
      message: "No warranty period stated. Silence does not mean none — the buyer's local law may supply one that is longer than intended.",
      fix: "State the period explicitly, even if it is 12 months.",
    });
  }

  /* ── Documents the payment method actually requires ── */
  if (DOCUMENTARY.has(t.paymentKind ?? "") && (t.documents ?? []).length === 0) {
    add({
      id: "no-documents-listed",
      severity: "error",
      field: "documents",
      message:
        "Payment is against documents, but the contract does not list which documents. The bank pays on the list, not on the goods.",
      fix: "List them — commercial invoice, packing list, bill of lading, certificate of origin …",
    });
  }
  if (SELLER_INSURES.has(incoterm) && !(t.documents ?? []).some((d) => /insur/i.test(d))) {
    add({
      id: "no-insurance-document",
      severity: "warn",
      field: "documents",
      message: `${incoterm} obliges the Seller to insure, but no insurance policy or certificate is in the document list.`,
      fix: "Add the insurance certificate — the Buyer cannot claim without it.",
    });
  }

  /* ── Governing law ── */
  if (!t.governingLaw) {
    add({
      id: "no-governing-law",
      severity: "error",
      field: "governingLaw",
      message: "No governing law or forum. A dispute would start with an argument about where to have the argument.",
      fix: "State the governing law and the arbitration forum.",
    });
  } else if (!/arbitrat|court|cietac|icc|siac|hkiac|lcia/i.test(t.governingLaw)) {
    add({
      id: "law-without-forum",
      severity: "warn",
      field: "governingLaw",
      message: "A governing law is stated but no forum — which law applies is settled, where to bring the claim is not.",
      fix: "Name the arbitration institution or the courts.",
    });
  }

  /* ── Inspection ── */
  if (t.inspection === "third_party" && !(t.documents ?? []).some((d) => /inspect/i.test(d))) {
    add({
      id: "inspection-without-certificate",
      severity: "warn",
      field: "documents",
      message: "Third-party inspection is agreed but no inspection certificate is in the document list.",
      fix: "Add the inspection certificate, or the inspection has no documentary effect.",
    });
  }

  return out;
}

/** Nothing at "error" means the contract does not contradict itself. It does
    not mean the contract is a good deal. */
export function blocksSignature(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === "error");
}

/* ═══════════════════════════════════════════════════════════════════════════
   The same checks, on a QUOTATION or INVOICE

   The contract checker needs a resolved payment CATEGORY, which only the
   server knows. A quotation or invoice editor has the document and nothing
   else, so this runs the subset that can be judged from the document alone —
   and that subset happens to contain the most expensive mistake of the lot.

   Run over the five real invoices the day this was written, THREE carried
   "FOB <the buyer's port>": FOB Alexandria, FOB Chittagong, FOB Benghazi.
   Read literally each one obliges Koleex to carry the goods to the buyer's
   country at its own cost and risk. They had already been sent.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TradeDocumentFacts {
  incotermCode?: string;
  /** The place printed after the rule. */
  incotermLocation?: string;
  loadingPort?: string;
  dischargePort?: string;
  leadTimeDays?: number;
  leadTimeBasis?: string;
  /** Item descriptions, for the warranty cross-check. */
  goods?: { description?: string }[];
  /** What the document prints as its warranty, when it states one. */
  warrantyMonths?: number;
}

/** Findings a quotation or invoice can raise without asking the server
    anything. Deliberately a SUBSET — no payment-shape rules, because the
    category that decides them is not on the document. */
export function checkTradeDocument(d: TradeDocumentFacts): Finding[] {
  const place = (d.incotermLocation ?? "").trim() || (d.dischargePort ?? "").trim();
  return checkContract({
    incoterm: d.incotermCode,
    incotermPlace: place || undefined,
    loadingPort: d.loadingPort,
    dischargePort: d.dischargePort,
    leadTimeDays: d.leadTimeDays,
    leadTimeBasis: d.leadTimeBasis as CheckableTerms["leadTimeBasis"],
    warrantyMonths: d.warrantyMonths,
    goods: d.goods,
  }).filter((f) =>
    /* Only what the document itself can answer for. Everything else needs the
       payment category, the document list, or a governing-law clause that a
       quotation legitimately does not carry. */
    [
      "incoterm-unknown",
      "place-is-destination-on-origin-term",
      "place-is-origin-on-destination-term",
      "exw-with-ports",
      "container-on-sea-term",
      "warranty-conflicts-with-goods",
    ].includes(f.id),
  );
}
