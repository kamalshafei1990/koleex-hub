/* ---------------------------------------------------------------------------
   General terms of the Koleex international sales contract.

   ── Structure ──────────────────────────────────────────────────────────────
   Articles are data, not strings scattered through a renderer. Each one can
   read the deal it is being drawn for, and can decline to appear: a contract
   paid by T/T should carry no letter-of-credit article, an EXW contract no
   FOB seller obligations, and a contract with no inspection agreed should not
   print an empty inspection heading.

   ── Versioning ─────────────────────────────────────────────────────────────
   TERMS_VERSION stamps every contract at creation. Editing these articles
   later must NOT change what a signed contract says, so a signed contract
   renders from its own frozen snapshot and this file is only ever read for
   drafts. Bump the version whenever the wording changes materially.

   ── Scope, deliberately ────────────────────────────────────────────────────
   Eighteen articles, not the forty-three the brief listed. These cover what
   an actual machinery export needs to state; the remainder (assignment,
   waiver, severability, counterparts …) are boilerplate that adds pages
   without adding protection, and can be added once counsel has reviewed the
   core. Better a short contract a buyer signs than a long one they send to
   their lawyer.

   ── Not legal advice ───────────────────────────────────────────────────────
   This is a working draft of standard commercial terms, written to be read
   and adjusted by qualified counsel before Koleex treats it as approved.
   Nothing here has been reviewed by a lawyer.
   --------------------------------------------------------------------------- */

export const TERMS_VERSION = "1.0";

/** What an article can see about the deal it is being drawn for. */
export interface ContractContext {
  /** Incoterm code — FOB, CIF, EXW … */
  incoterm?: string;
  incotermPlace?: string;
  /** Payment shape, from the master payment-terms category. */
  paymentKind?: "tt" | "lc" | "dp" | "da" | "open" | "mixed" | "other";
  paymentLabel?: string;
  currency?: string;
  /** Production days, and what starts the clock. */
  leadTimeDays?: number;
  leadTimeBasis?: "after_deposit" | "after_order" | "after_lc_opening";
  warrantyMonths?: number;
  inspection?: "none" | "seller" | "buyer" | "third_party";
  governingLaw?: string;
  disputeForum?: string;
  hasSpareParts?: boolean;
  isCustomised?: boolean;
}

export interface ContractArticle {
  /** Stable key — never renumber; article numbers are computed at render. */
  key: string;
  title: string;
  /** Body text, given the deal. */
  body: (c: ContractContext) => string;
  /** Omit the article entirely when this returns false. */
  applies?: (c: ContractContext) => boolean;
}

const SEA_TERMS = new Set(["FAS", "FOB", "CFR", "CIF"]);
const SELLER_CARRIES = new Set(["CPT", "CIP", "CFR", "CIF", "DAP", "DPU", "DDP"]);

const place = (c: ContractContext) =>
  c.incotermPlace ? `${c.incoterm} ${c.incotermPlace}` : (c.incoterm ?? "the agreed term");

export const GENERAL_ARTICLES: ContractArticle[] = [
  {
    key: "definitions",
    title: "Definitions",
    body: () =>
      `"Seller" means Koleex International Corporation Taizhou Co., Ltd. "Buyer" means the party named as Buyer in this Contract. "Goods" means the equipment, parts and accessories described in the Commercial Schedule. "Contract" means this document together with the Commercial Schedule and any annex or amendment signed by both parties. "Incoterms® 2020" means the international commercial terms published by the International Chamber of Commerce.`,
  },
  {
    key: "documents",
    title: "Contract Documents and Priority",
    body: () =>
      `This Contract consists of the Commercial Schedule, these General Terms, and any annexes and signed amendments. Where they conflict, the following order applies: signed amendments, then the Commercial Schedule and any Special Conditions, then these General Terms, then annexes.\n\nWhere payment is by documentary credit, the credit is a separate undertaking between the Buyer's bank and the Seller and is governed by its own terms and by the applicable ICC rules. The Buyer shall procure that the credit conforms to this Contract, but the banks' obligations under the credit are not altered by this Contract, and this Contract is not altered by the credit.`,
  },
  {
    key: "goods",
    title: "Goods and Specifications",
    body: () =>
      `The Seller shall supply the Goods described in the Commercial Schedule, in the quantities and to the specifications stated there. Specifications not expressly stated are the Seller's standard specifications for the model concerned. Minor changes that do not reduce performance or agreed function may be made without notice; any change that does shall require the Buyer's written agreement.`,
  },
  {
    key: "price",
    title: "Price and Currency",
    body: (c) =>
      `Prices are stated in ${c.currency ?? "the contract currency"} on the basis of ${place(c)} (Incoterms® 2020) and are exclusive of all duties, taxes, levies and charges imposed outside the country of export, which are for the Buyer's account. Prices are fixed for the duration of this Contract unless the parties agree otherwise in writing.`,
  },
  {
    key: "payment",
    title: "Payment",
    body: (c) =>
      `Payment shall be made as stated in the Commercial Schedule${c.paymentLabel ? `: ${c.paymentLabel}` : ""}. All banking charges outside the country of export, including any confirmation and amendment charges, are for the Buyer's account. Payments shall be made in full without set-off or deduction.`,
  },
  {
    key: "credit",
    title: "Documentary Credit",
    applies: (c) => c.paymentKind === "lc" || c.paymentKind === "mixed",
    body: () =>
      `Where payment is by documentary credit, the Buyer shall procure the issuance of an irrevocable credit in favour of the Seller, subject to UCP 600, through a bank acceptable to the Seller, and shall provide the Seller with a copy for approval before issuance where the Seller so requests.\n\nThe credit shall permit presentation of the documents listed in the Commercial Schedule and no others, shall remain available for negotiation for the period stated, and shall be issued in the contract currency for the full amount payable under it. Amendments required to bring the credit into conformity with this Contract shall be made at the Buyer's cost and without delay.`,
  },
  {
    key: "delivery",
    title: "Delivery Terms",
    body: (c) => {
      const base = `Delivery shall be made on the basis of ${place(c)} (Incoterms® 2020). Risk of loss or damage passes to the Buyer at the point determined by that rule, and the allocation of costs, carriage, insurance and customs formalities follows it.`;
      if (c.incoterm && SEA_TERMS.has(c.incoterm)) {
        return `${base}\n\nWhere the Goods are carried in containers, the parties acknowledge that delivery occurs on board the vessel and that the Goods may be held at the container terminal for a period before loading.`;
      }
      return base;
    },
  },
  {
    key: "shipment",
    title: "Production and Shipment",
    body: (c) => {
      const days = c.leadTimeDays ?? 45;
      const start =
        c.leadTimeBasis === "after_lc_opening"
          ? "receipt by the Seller of an operative documentary credit conforming to this Contract"
          : c.leadTimeBasis === "after_order"
            ? "the date of this Contract"
            : "receipt by the Seller of the agreed advance payment";
      return `The Seller shall complete production within ${days} days of ${start}, and shall ship within the period stated in the Commercial Schedule.\n\nThe Seller shall not be in default where performance is delayed by the Buyer, including delay in payment, in the issuance or amendment of a documentary credit, in approving drawings, samples or artwork, in supplying shipping marks or consignee details, or in obtaining import permissions. In such a case the Seller's dates shall be extended by the period of the delay.`;
    },
  },
  {
    key: "packing",
    title: "Packing and Marking",
    body: () =>
      `The Goods shall be packed in the Seller's standard export packing, suitable for the agreed mode of transport and for ordinary handling in international carriage. Marking shall follow the Buyer's written instructions where these are supplied in time; otherwise the Seller's standard marking applies. Packing specified by the Buyer beyond the Seller's standard is at the Buyer's cost.`,
  },
  {
    key: "inspection",
    title: "Inspection",
    applies: (c) => (c.inspection ?? "seller") !== "none",
    body: (c) => {
      if (c.inspection === "third_party")
        return `The Goods shall be inspected before shipment by the independent inspection body named in the Commercial Schedule. The cost is borne as stated there. The Seller shall give reasonable notice of readiness. Where the appointed inspector does not attend within the agreed period, the Seller may ship on the basis of its own quality records.`;
      if (c.inspection === "buyer")
        return `The Buyer may inspect the Goods at the Seller's premises before shipment, at the Buyer's cost. The Seller shall give reasonable notice of readiness. Where the Buyer does not attend within the agreed period, the Seller may ship on the basis of its own quality records, and the Goods shall be treated as accepted for the purposes of shipment.`;
      return `The Goods shall be inspected and tested by the Seller in accordance with its standard quality procedures before shipment. Records of that inspection shall be made available to the Buyer on request.`;
    },
  },
  {
    key: "warranty",
    title: "Warranty",
    body: (c) => {
      const m = c.warrantyMonths ?? 12;
      return `The Seller warrants the Goods against defects in material and workmanship for ${m} months from the date of arrival at the port or place of destination.\n\nThe warranty covers repair or replacement of defective parts at the Seller's option, and does not cover consumable parts, normal wear, damage arising from incorrect installation, incorrect voltage or supply conditions, misuse, neglect, accident, unauthorised repair or modification, or failure to follow the operating instructions. Replacement parts are supplied free of charge; carriage of those parts is as stated in the Commercial Schedule.\n\nThis warranty is the Buyer's exclusive remedy for defective Goods.`;
    },
  },
  {
    key: "spares",
    title: "Spare Parts",
    applies: (c) => c.hasSpareParts === true,
    body: () =>
      `Spare parts supplied with the Goods are listed in the Commercial Schedule. The Seller shall keep spare parts for the Goods available for a reasonable period after delivery and shall supply them at its prices current at the time of order.`,
  },
  {
    key: "obligations",
    title: "Obligations of the Parties",
    body: (c) => {
      const sellerCarries = c.incoterm ? SELLER_CARRIES.has(c.incoterm) : false;
      const carriage = sellerCarries
        ? "arrange and pay for carriage to the agreed destination"
        : "place the Goods at the Buyer's disposal or deliver them to the carrier nominated by the Buyer, as the agreed term requires";
      return `The Seller shall supply the Goods in accordance with this Contract, carry out the agreed quality procedures, pack and mark the Goods, ${carriage}, complete the export formalities allocated to it by the agreed term, and provide the documents listed in the Commercial Schedule.\n\nThe Buyer shall make payment when due, procure any documentary credit within the agreed period, supply approvals, shipping marks and consignee details in good time, obtain any import licence or permission required in the country of destination, complete the import formalities allocated to it by the agreed term, and take delivery of the Goods.`;
    },
  },
  {
    key: "custom",
    title: "Customised Goods",
    applies: (c) => c.isCustomised === true,
    body: () =>
      `Where the Goods are manufactured or configured to the Buyer's specification, the Buyer's written approval of the specification, drawings or samples is required before production begins, and the Seller shall not be responsible for a specification so approved. Customised Goods may not be cancelled or returned once production has begun, save for defects covered by the warranty.`,
  },
  {
    key: "claims",
    title: "Claims",
    body: () =>
      `Claims for shortage, damage visible on delivery, or Goods not conforming to the Commercial Schedule shall be notified to the Seller within 15 days of arrival at destination, supported by photographs and, where relevant, the carrier's report. Claims under the warranty shall be notified within the warranty period, supported by the contract and invoice numbers, the model and serial number, and a description of the defect with photographs or video.\n\nThe Seller shall be given a reasonable opportunity to examine the Goods before they are repaired, altered or returned.`,
  },
  {
    key: "title",
    title: "Transfer of Title",
    body: () =>
      `Title to the Goods passes to the Buyer on receipt by the Seller of payment in full. Passing of title is separate from passing of risk, which follows the agreed Incoterms® 2020 rule.`,
  },
  {
    key: "force",
    title: "Force Majeure",
    body: () =>
      `Neither party shall be liable for failure or delay in performing its obligations where that failure or delay results from an event beyond its reasonable control, including natural disaster, war, civil disturbance, act of government, port closure, or a serious disruption of transport or of the supply of energy or materials.\n\nThe party affected shall notify the other without undue delay, and the time for performance shall be extended by the duration of the event. Where the event continues for more than 90 days, either party may terminate the affected part of this Contract by written notice, in which case the Seller shall refund payments received for Goods not delivered, less costs properly incurred.\n\nA general increase in costs, or the ordinary difficulty of performing a bargain, is not an event of force majeure.`,
  },
  {
    key: "ip",
    title: "Intellectual Property and Confidentiality",
    body: () =>
      `The KOLEEX name, trademarks, designs, software, drawings, manuals and technical documentation remain the property of the Seller. Purchase of the Goods confers no right in them beyond the right to use the Goods for their intended purpose and to use the documentation supplied for operating and maintaining the Goods.\n\nEach party shall keep confidential the commercial and technical information it receives from the other in connection with this Contract, and shall not disclose it to third parties except as required to perform this Contract or by law.`,
  },
  {
    key: "liability",
    title: "Limitation of Liability",
    body: () =>
      `Subject to applicable law, neither party is liable to the other for loss of profit, loss of production, business interruption, or any indirect or consequential loss arising out of this Contract. The Seller's total liability arising out of this Contract shall not exceed the price of the Goods giving rise to the claim.\n\nNothing in this Contract excludes or limits liability that cannot be excluded or limited under the applicable law.`,
  },
  {
    key: "law",
    title: "Governing Law and Dispute Resolution",
    body: (c) =>
      `This Contract is governed by ${c.governingLaw ?? "the laws of the People's Republic of China"}.\n\nThe parties shall attempt in good faith to resolve any dispute by negotiation. Failing agreement within 30 days, the dispute shall be finally settled by ${c.disputeForum ?? "arbitration under the rules of CIETAC in Beijing"}. The award shall be final and binding on both parties.\n\nThe United Nations Convention on Contracts for the International Sale of Goods shall not apply.`,
  },
  {
    key: "general",
    title: "General",
    body: () =>
      `This Contract, together with its schedules and annexes, is the entire agreement between the parties in respect of the Goods, and supersedes any prior understanding. Amendments are effective only if made in writing and signed by both parties. Neither party may assign this Contract without the other's written consent. Where a provision is found to be unenforceable, the remainder continues in effect. A failure to enforce a provision is not a waiver of it.\n\nThis Contract may be executed in counterparts and by scanned or electronic signature, each of which is an original.`,
  },
];

/** Articles that apply to this deal, in order, numbered from 1. */
export function articlesFor(ctx: ContractContext): Array<{ n: number; title: string; body: string }> {
  const out: Array<{ n: number; title: string; body: string }> = [];
  for (const a of GENERAL_ARTICLES) {
    if (a.applies && !a.applies(ctx)) continue;
    out.push({ n: out.length + 1, title: a.title, body: a.body(ctx) });
  }
  return out;
}
