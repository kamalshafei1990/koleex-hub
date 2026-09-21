/* ---------------------------------------------------------------------------
   trade-terms/types — the shape of the ONE trade-terms source.

   WHY THIS EXISTS. The Incoterms and payment-method facts already lived in
   ai-agent/trade-terms-knowledge.ts as prose blocks: perfect for a retrieval
   engine, unusable for a screen. Rather than copy the facts into a second
   file — which is how this codebase has repeatedly ended up with two versions
   of one truth, each silently drifting — the facts move HERE, structured, and
   the AI's prose is generated FROM them.

   THE SPLIT THAT MAKES THIS FAST. Two kinds of information live apart:

     · STRUCTURE (this file's Incoterm/PaymentMethod) is language-neutral and
       tiny — codes, families, who-pays flags, ladder order. It is pure data:
       no prose, so it never needs translating and never grows with languages.

     · COPY (TermCopy) is the prose, one file per language, loaded on demand.

   That separation is the whole performance story. The cost table, the journey
   strip and the risk ladder are all DRAWN FROM THE STRUCTURE — so a reader
   who never opens a term downloads a few kilobytes, and a reader on English
   never downloads a byte of Chinese or Arabic.
   --------------------------------------------------------------------------- */

/** Which transport modes a rule may legally be used for. Incoterms 2020
 *  divides the eleven rules into exactly these two families. */
export type IncotermFamily = "any" | "sea";

/** Who carries a given cost. Deliberately a flag, not a sentence: the cost
 *  table renders from these, so the table can never disagree with the prose
 *  next to it — there IS no prose, only this. */
export type Payer = "seller" | "buyer";

/** The stages of an export journey, in order. Both the risk-transfer marker
 *  and the cost-stop marker are positions on this line, which is what lets
 *  one strip show the C-group split (cost runs past the point where risk
 *  already passed) without any special-casing. */
export type JourneyStage =
  | "sellerPremises"
  | "exportCleared"
  | "alongsideShip"
  | "onBoard"
  | "mainCarriage"
  | "arrivalPort"
  | "importCleared"
  | "destination"
  | "unloaded";

export interface Incoterm {
  /** The three-letter code, e.g. "FOB". */
  code: string;
  /** Full name, e.g. "Free On Board". Not translated: the ICC publishes the
   *  rules in English and a contract must cite the English code and name. */
  name: string;
  family: IncotermFamily;
  /** Least → most seller obligation. Drives the default sort so the grid
   *  itself teaches the ladder. */
  order: number;
  /** Where risk of loss or damage passes from seller to buyer. */
  riskPassesAt: JourneyStage;
  /** Where the seller's cost obligation ends. Equal to riskPassesAt in the
   *  E, F and D groups; deliberately LATER in the C group — the single most
   *  misunderstood thing about Incoterms, and the reason these are two
   *  separate fields rather than one. */
  costEndsAt: JourneyStage;
  costs: {
    exportPackLoad: Payer;
    exportClearance: Payer;
    mainCarriage: Payer;
    insurance: Payer;
    importClearance: Payer;
    dutyVat: Payer;
    unloadAtDestination: Payer;
  };
  /** Set only where the RULE obliges the seller to insure — CIF and CIP.
   *  The D group seller normally insures too, but is not obliged to, and
   *  conflating the two misstates the contract. */
  insuranceObligation?: {
    /** Institute Cargo Clauses tier the rule requires. */
    clauses: "A" | "C";
    /** Minimum cover as a percentage of contract value. */
    minCoverPct: number;
  };
  /** True where ICC advises a different rule for containers. */
  containerTrap?: boolean;
  /** The rule ICC recommends instead, for containerised cargo. */
  containerAlternative?: string;
  /** Spellings the same rule goes by in real quotations — "C&F" and "CNF"
   *  for CFR. Searched and shown as "also written", never as a second card. */
  aliases?: string[];
}

/** Position on the exporter's risk ladder, most secure first. Buyer security
 *  runs in exactly the opposite direction — which is why the UI shows both
 *  ends of the same bar rather than a single "safe/risky" badge. */
/** Which section of the Payment tab a term belongs to. The ladder holds
 *  only the six METHODS, because a rung means "a way of getting paid";
 *  letter-of-credit variants and bank guarantees are refinements of a
 *  method, not rungs of their own, and listing them on the ladder would
 *  imply risk levels they do not carry independently. */
export type PaymentGroup = "method" | "lcType" | "guarantee" | "platform";

export interface PaymentMethod {
  id: string;
  /** e.g. "L/C" — the abbreviation a person actually meets in a contract. */
  abbr?: string;
  name: string;
  group: PaymentGroup;
  /** 1 = safest for the exporter. Only the six methods carry a rung. */
  ladder?: number;
  /** Whether a bank carries a payment undertaking. This is the real dividing
   *  line between a letter of credit and a documentary collection, and the
   *  reason collections cost a fraction as much. */
  bankUndertaking: boolean;
  /** Does the buyer get the goods before paying? The plainest possible
   *  statement of exporter exposure, and what separates D/A from D/P. */
  goodsBeforePayment: boolean;
  /** Other names the same thing goes by in real contracts — "CAD" for D/P,
   *  "Net 30" for open account. Searched, never displayed as separate cards:
   *  a duplicate card for a synonym teaches that they are two things. */
  aliases?: string[];
  /** Whom the instrument shields. Only for L/C variants, guarantees and
   *  escrow — for the six methods the ladder already says it, and saying it
   *  twice invites the two to disagree. */
  protects?: "seller" | "buyer" | "both";
}

/** All prose for one term, in one language. Kept out of the structure above
 *  so the grid can render without loading any of it. */
export interface TermCopy {
  /** One sentence a newcomer understands with no background. The entire
   *  first layer of the page is this string. */
  oneLine: string;
  /** What the term means, in plain words. */
  meaning: string;
  /** How it works in practice. */
  howItWorks: string;
  /** When to use it. */
  useWhen?: string;
  /** When NOT to use it — usually more valuable than useWhen. */
  avoidWhen?: string;
  /** The mistake people actually make with this term. */
  pitfall?: string;
}

/** A rule that ICC removed but that still turns up in contracts. Carried as
 *  structure only: the year and the replacement are facts, and the one line
 *  a reader needs is built from them by the UI in the reader's language. */
export interface LegacyIncoterm {
  code: string;
  name: string;
  retiredIn: 2010 | 2020;
  replacedBy: string;
}
