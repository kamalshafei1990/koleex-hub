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

/** Terms whose whole point is that the bank pays against documents. */
const DOCUMENTARY = new Set(["lc", "dp", "da"]);

export interface CheckableTerms extends ContractContext {
  loadingPort?: string;
  dischargePort?: string;
  containerType?: string;
  documents?: string[];
  specialConditions?: string[];
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
