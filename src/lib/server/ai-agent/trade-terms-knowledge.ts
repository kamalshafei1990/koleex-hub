import "server-only";

/* ---------------------------------------------------------------------------
   ai-agent/trade-terms-knowledge — international trade terms: the Incoterms®
   2020 delivery rules and the methods-of-payment ladder used in export sales.

   SOURCES. Every fact here traces to a body that PUBLISHES the rule, not to
   an encyclopedia summary of it:
     · Incoterms® 2020 rules, insurance levels, containerised-cargo guidance
       — International Chamber of Commerce (iccwbo.org, ICC Academy). The ICC
         authors the Incoterms rules, so it is the primary source by
         definition.
     · Letters of credit, documentary collections, the autonomy principle,
       the 5-banking-day examination window — ICC UCP 600 and URC 522, via
       ICC Academy.
     · The exporter risk ladder (cash-in-advance → consignment)
       — U.S. Department of Commerce, International Trade Administration
         (trade.gov/methods-payment).

   ONE CORRECTION WORTH KEEPING. A widely-copied claim — including on a US
   government page — says risk under FOB/CFR/CIF passes at the "ship's rail".
   That wording was DELETED in Incoterms 2010; the rule is "on board the
   vessel". The old phrasing caused decades of litigation over an imaginary
   vertical line and must never be repeated in an answer.

   This is standards knowledge, not Koleex commercial policy. Koleex's own
   margins, bands, tiers and channel ladder live in Commercial Setup and are
   reached through their own tools — never blend the two. Say what a term
   MEANS; never invent what Koleex charges for it.
   --------------------------------------------------------------------------- */

export interface TradeTermsSection {
  title: string;
  content: string;
  /* Retrieval handles: the words a person actually types that may appear
     nowhere in the prose. Without these, "how many days does a bank have to
     check documents" scored the *Bank guarantees* section top — purely
     because "bank" sits in its title — and never surfaced the five-banking-day
     rule. Keywords carry more weight than a loose body hit for exactly that
     reason. */
  keywords: string[];
}

export const TRADE_TERMS_KNOWLEDGE: TradeTermsSection[] = [
  /* ── Incoterms: the frame ────────────────────────────────────────────── */
  {
    title: "Incoterms 2020 — what the rules do and do not cover",
    content: `- **What they are**: eleven three-letter rules published by the International Chamber of Commerce (ICC) that allocate, between seller and buyer, the tasks / costs / risks of delivering goods. Current edition: Incoterms® 2020.
- **Always written as**: CODE + named place + edition, e.g. "FOB Ningbo, China (Incoterms® 2020)". A code without a named place is incomplete and a frequent source of dispute.
- **What they DO settle**: who arranges and pays carriage; who clears export and import; who buys insurance; where risk of loss or damage passes; who packs, marks and provides which documents.
- **What they do NOT settle**: transfer of TITLE / ownership; price; currency; payment method or timing; breach-of-contract remedies; governing law; force majeure; product liability. These belong in the sales contract — the Incoterm is only the delivery chapter of it.
- **Critical separation**: the point where RISK passes and the point where COST stops are the same only in the E, F and D groups. In the C group (CPT, CIP, CFR, CIF) they deliberately SPLIT — the seller pays freight to destination but risk already passed at origin. This split is the single most misunderstood thing about Incoterms.
- **Editions do not expire**: Incoterms 2010 contracts stay valid. That is exactly why the edition year must be stated.`,
    keywords: ["incoterms", "incoterm", "trade term", "delivery term", "title", "ownership", "edition", "2020", "2010", "icc", "named place", "scope"],
  },
  {
    title: "Incoterms 2020 — the two families and all eleven rules",
    content: `**Family 1 — ANY mode of transport (7 rules).** Use for containers, air, road, rail, and multimodal.
- **EXW** — Ex Works (named place). Seller merely makes goods available at its own premises, not even loaded. Buyer does everything including export clearance. Maximum seller convenience, minimum seller obligation. ICC notes EXW is often unsuitable for cross-border trade because the buyer may be unable to complete export formalities in the seller's country; **FCA is the better choice** in almost every export case.
- **FCA** — Free Carrier (named place). Seller clears for export and hands goods to the carrier named by the buyer. If the place is the seller's premises, seller loads; if elsewhere, seller delivers ready for unloading. **The recommended rule for containerised cargo.**
- **CPT** — Carriage Paid To (named destination). Seller pays carriage to destination, but risk passes when goods are handed to the FIRST carrier. Cost and risk split.
- **CIP** — Carriage and Insurance Paid To (named destination). CPT plus insurance. Under 2020 the seller must insure at **Institute Cargo Clauses (A)** — "all risks" — for a minimum of **110% of contract value**, in the contract currency.
- **DAP** — Delivered at Place (named destination). Seller carries all risk to destination, delivers ready for unloading. Buyer clears import and pays duty.
- **DPU** — Delivered at Place Unloaded (named destination). Same as DAP but the seller also UNLOADS. **The only rule requiring the seller to unload.** Renamed from DAT (Delivered at Terminal) in 2020 so the place need not be a terminal.
- **DDP** — Delivered Duty Paid (named destination). Maximum seller obligation: seller bears everything including import clearance and duty/VAT in the buyer's country. Risky for the seller where it cannot act as importer of record.

**Family 2 — SEA and inland waterway ONLY (4 rules).** For bulk, break-bulk and non-containerised cargo.
- **FAS** — Free Alongside Ship (named port of shipment). Seller delivers alongside the vessel (quay or barge); export cleared by seller.
- **FOB** — Free On Board (named port of shipment). Seller delivers **on board the vessel**; risk passes there. Seller clears export; buyer contracts and pays main carriage.
- **CFR** — Cost and Freight (named port of destination). Seller pays freight to destination port, but **risk still passes on board at origin**.
- **CIF** — Cost, Insurance and Freight (named port of destination). CFR plus insurance. Default cover is **Institute Cargo Clauses (C)** — the minimum tier — at **110% of contract value**. Parties may agree higher.

**Why CIP and CIF differ on insurance**: ICC's 2020 drafting group set CIP higher because it is typically used for manufactured goods (which need broad cover), while CIF is dominated by bulk commodities where minimum cover is the market norm.`,
    keywords: ["exw", "fca", "fas", "fob", "cfr", "cif", "cpt", "cip", "dap", "dpu", "ddp", "ex works", "free carrier", "free on board", "cost and freight", "cost insurance and freight", "carriage paid to", "delivered at place", "delivered duty paid", "eleven", "list", "all rules", "meaning", "means", "definition", "sea", "any mode"],
  },
  {
    title: "Incoterms — risk transfer point for each rule (the exact moment)",
    content: `Ordered from least to most seller responsibility:
- **EXW** — when goods are placed at the buyer's disposal at the named place, NOT loaded.
- **FCA** — when goods are handed to the buyer's nominated carrier (loaded onto the collecting vehicle if at seller's premises; ready for unloading if elsewhere).
- **FAS** — when goods are placed alongside the vessel at the named port.
- **FOB / CFR / CIF** — when goods are **on board the vessel** at the named port of shipment. **All three share the same risk point.** CFR and CIF differ from FOB only in who pays freight (and insurance), NOT in where risk passes.
- **CPT / CIP** — when goods are handed to the FIRST carrier, which may be far inland from any port.
- **DAP** — on arrival at the named destination, ready for unloading, still on the arriving vehicle.
- **DPU** — once unloaded at the named destination.
- **DDP** — on arrival at destination, import-cleared, ready for unloading.

**⚠ Obsolete wording — never use**: risk under FOB/CFR/CIF does NOT pass at the "ship's rail". That phrase was removed in Incoterms 2010 precisely because it caused decades of dispute; the rule is "on board". Some third-party websites still repeat it. If a customer's contract says "ship's rail", flag it as outdated drafting.`,
    keywords: ["risk", "risk transfer", "passes", "transfer point", "on board", "ship's rail", "when does risk", "who bears risk", "damage", "loss", "moment"],
  },
  {
    title: "Incoterms — who pays what (cost allocation table)",
    content: `S = seller, B = buyer.

| Rule | Export pack/load | Export clearance | Main carriage | Insurance | Import clearance | Duty/VAT | Unload at dest. |
|---|---|---|---|---|---|---|---|
| EXW | B | B | B | B | B | B | B |
| FCA | S | S | B | B | B | B | B |
| FAS | S | S | B | B | B | B | B |
| FOB | S | S | B | B | B | B | B |
| CFR | S | S | **S** | B | B | B | B |
| CIF | S | S | **S** | **S** (ICC-C, 110%) | B | B | B |
| CPT | S | S | **S** | B | B | B | B |
| CIP | S | S | **S** | **S** (ICC-A, 110%) | B | B | B |
| DAP | S | S | **S** | S (own risk, not obliged) | B | B | B |
| DPU | S | S | **S** | S (own risk, not obliged) | B | B | **S** |
| DDP | S | S | **S** | S (own risk, not obliged) | **S** | **S** | B |

Note on the D group: the seller carries risk to destination, so it will normally insure — but the RULE does not oblige it to, unlike CIF and CIP where insurance is a contractual duty owed to the buyer.`,
    keywords: ["who pays", "cost", "costs", "freight", "duty", "vat", "insurance", "clearance", "export clearance", "import clearance", "unload", "table", "comparison", "allocation", "responsibility", "obligations"],
  },
  {
    title: "Incoterms — choosing the right rule, and the container trap",
    content: `**The container trap (ICC's most repeated warning).** FOB, FAS, CFR and CIF were written for goods loaded directly onto a ship. With containers the seller hands over at a container terminal, where the box may sit for **days** before loading. Using FOB then leaves the seller carrying risk for cargo it no longer controls, in a yard it cannot access, until an uncertain loading moment. ICC's guidance: **for containerised cargo use FCA instead of FOB/FAS, CPT instead of CFR, CIP instead of CIF.**
- In practice FOB remains overwhelmingly common for container trade out of Asia because banks, buyers and freight forwarders are used to it. Know that this is market habit, not correct ICC practice — and know exactly what the exposure is if asked.

**Practical selection guide:**
- Buyer has its own forwarder and wants control of freight → **FCA** (containers) or **FOB** (bulk/break-bulk).
- Seller sells freight-inclusive to destination port → **CFR/CIF** (bulk) or **CPT/CIP** (containers).
- Buyer wants a delivered price to its door and can clear import → **DAP**.
- Buyer wants a fully landed price and cannot or will not clear import → **DDP**, but only take it where the seller can legally act as importer of record and reclaim/absorb VAT.
- Never quote **DDP** into a country whose import rules bar a non-resident from being importer of record without checking first.

**FCA's 2020 improvement**: banks paying under a letter of credit usually demand an on-board bill of lading, which historically FCA could not produce — pushing sellers to FOB just to satisfy the bank. Incoterms 2020 added a mechanism where buyer and seller can agree the carrier will issue an on-board B/L to the seller under FCA. This removes the main reason to misuse FOB for containers.`,
    keywords: ["container", "containers", "containerised", "containerized", "which incoterm", "choose", "choosing", "best", "recommend", "fcl", "lcl", "terminal", "bill of lading", "b/l", "on-board bill", "trap", "mistake", "wrong"],
  },

  /* ── Payment terms ───────────────────────────────────────────────────── */
  {
    title: "Methods of payment — the exporter risk ladder",
    content: `Ranked most-secure to least-secure **for the exporter** (per the U.S. International Trade Administration). Buyer security runs in exactly the opposite direction — every step that protects the seller exposes the buyer, which is why payment terms are negotiated, not chosen.

1. **Cash in advance** — paid before shipment. Near-zero seller risk; highest buyer risk and worst buyer cash flow. Rare as a full-value term because it loses deals to competitors offering credit.
2. **Letter of credit (documentary credit)** — a bank's independent undertaking to pay against compliant documents. Low seller risk, provided documents comply. Used when the buyer's creditworthiness is unknown but its bank is trusted.
3. **Documentary collection (D/P, D/A)** — banks handle documents but guarantee nothing. Cheaper than an L/C; moderate-to-high seller risk. Suits an established relationship in a stable market.
4. **Open account** — goods ship first, payment in 30/60/90 days. High seller risk; the norm in competitive markets and often demanded by strong buyers. Usually paired with credit insurance or receivables finance.
5. **Consignment** — payment only after the distributor sells the goods. Highest seller risk: goods sit abroad, in someone else's hands, still unpaid. Needs a highly trusted partner plus insurance.

**The negotiating reality**: payment terms are a price component. A buyer demanding 90-day open account is asking for free financing; that cost belongs in the price, or the term should be shortened.`,
    keywords: ["payment", "payment terms", "payment method", "methods of payment", "risk ladder", "secure", "security", "cash in advance", "advance", "open account", "consignment", "credit terms", "30 days", "60 days", "90 days", "compare", "safest", "riskiest"],
  },
  {
    title: "Telegraphic transfer (T/T) and staged deposits",
    content: `- **T/T** (telegraphic transfer / wire / SWIFT bank transfer) is the plumbing, not a risk structure — the security comes entirely from WHEN the transfer is due relative to shipment.
- **T/T in advance (100%)** — cash in advance. Strongest for the seller.
- **Staged T/T** — the dominant structure in machinery exports from China. Typical shapes:
  - **30% deposit with order, 70% against copy of B/L** — the classic. Deposit funds production; balance falls due once shipping documents exist but before the buyer can collect the goods (the original B/L is released only after payment).
  - **30% deposit, 70% before shipment** — stronger for the seller; the buyer pays in full before the goods leave.
  - **30 / 40 / 30** — deposit, on completion of production before inspection, balance against B/L copy. Common on long-lead capital equipment.
- **Why the deposit exists**: it covers the seller's exposure if a buyer walks away from a machine built or configured to order. For standard stock the deposit is a commitment signal; for customised equipment it should at least cover the non-recoverable build cost.
- **The B/L is the lever**: whoever holds the original bill of lading controls the cargo. "Balance against copy of B/L" means the seller keeps the originals until paid — which is what makes a 70% balance safe without a bank instrument.
- **Watch**: T/T carries no bank undertaking whatsoever. If the buyer refuses the balance, the seller's remedy is possession of the goods at a foreign port and the cost of re-selling or returning them.`,
    keywords: ["t/t", "tt", "telegraphic", "wire", "wire transfer", "swift", "deposit", "deposits", "down payment", "30%", "70%", "balance", "staged", "advance payment", "before shipment", "against b/l", "copy of b/l"],
  },
  {
    title: "Letters of credit — mechanics and the parties",
    content: `Governed by **ICC UCP 600** (39 articles, applied in ~175 countries).

**Parties:**
- **Applicant** — the buyer/importer who asks its bank to issue the credit.
- **Issuing bank** — issues the credit and carries the primary payment undertaking.
- **Beneficiary** — the seller/exporter, in whose favour it is issued.
- **Advising bank** — passes the credit to the beneficiary and verifies its apparent authenticity. Advising alone carries NO payment obligation.
- **Confirming bank** — adds its OWN independent undertaking alongside the issuing bank's.
- **Nominated bank** — the bank at which the credit is available for payment, acceptance or negotiation.

**Two principles that govern everything:**
- **Autonomy / independence** — the credit is a separate transaction from the sales contract. Banks are not concerned with whether the machine works, only with whether the documents comply. A perfect shipment with flawed documents can go unpaid; a poor shipment with perfect documents gets paid.
- **Documents only** — "in documentary credit operations all parties deal only in documents". Under UCP 600 data in one document need not be identical to another, but must not CONFLICT.

**Timing:** the bank has a maximum of **five banking days** after presentation to examine documents and decide.

**Honour vs negotiate:** *honour* = pay at sight, incur a deferred-payment undertaking, or accept a draft and pay at maturity. *Negotiate* = the nominated bank advances funds to the beneficiary by purchasing drafts/documents before it is itself reimbursed.

**Discrepancy** — any deviation of the presented documents from the credit's terms, UCP 600, or international standard banking practice. On discrepancy the bank may refuse; the exporter's protection then evaporates and payment reverts to the buyer's goodwill. Discrepancy rates on first presentation are notoriously high, which is why the ICC recommends keeping the required document list minimal — ideally an invoice and a transport document.`,
    keywords: ["letter of credit", "letters of credit", "l/c", "lc", "documentary credit", "ucp", "ucp 600", "applicant", "beneficiary", "issuing bank", "advising bank", "confirming bank", "nominated bank", "discrepancy", "discrepancies", "five banking days", "5 banking days", "examination", "examine", "how many days", "autonomy", "independence", "complying presentation", "honour", "honor", "negotiate", "documents only", "parties", "how does", "how it works"],
  },
  {
    title: "Letters of credit — the types and when each is used",
    content: `- **Irrevocable** — the default and, under UCP 600, effectively the only kind: a credit is irrevocable even if it does not say so. Amendment or cancellation needs the beneficiary's consent. (Revocable credits no longer exist in the ICC rules.)
- **Confirmed vs unconfirmed** — confirmation adds a second bank's independent undertaking. Ask for it when the issuing bank is small or unknown, or when country risk (sanctions, FX shortage, political instability) makes the issuing bank's promise less than solid. The beneficiary must request confirmation in the sales contract or proforma **before** the credit is issued.
- **Silent confirmation** — the advising bank privately guarantees the beneficiary without the issuing bank's knowledge. Falls outside UCP protection, costs more, carries more risk. A fallback when the issuing bank refuses confirmation.
- **Sight** — payment on presentation of compliant documents.
- **Usance / deferred payment** — payment at a stated future date (e.g. 90 days after B/L date). The seller extends credit, but with a bank undertaking behind it. Can often be discounted for early cash.
- **Acceptance** — a term draft is accepted by the bank, creating a bank-accepted bill that is readily discountable.
- **Transferable** — the beneficiary may transfer all or part of the credit to one or more second beneficiaries on identical terms, except that amount, unit price, expiry and shipment dates may be REDUCED. Cannot be transferred onward a second time. Used by traders standing between supplier and buyer.
- **Back-to-back** — two separate credits: a master credit in the middleman's favour, and a second credit the middleman opens for the actual supplier. Terms mirror the master except amount/price/dates, preserving the middleman's margin. Riskier operationally: the two credits are legally independent and banks may read terms differently.
- **Revolving** — the amount reinstates automatically by period or by shipment. *Cumulative* carries unused value forward; *non-cumulative* does not. Cuts paperwork on repeat orders of the same goods.
- **Red clause** — permits the beneficiary to draw an advance BEFORE shipment. *Unsecured* (no documents), *secured/documentary* (against warehouse receipts). **Green clause** goes further: advances against goods stored in the bank's name.
- **Standby (SBLC)** — a guarantee, not a payment mechanism. It pays only if something FAILS to happen: non-payment, non-performance, failure to repay an advance, withdrawal of a bid. May be governed by UCP 600, ISP98 or URDG 758. Common as advance-payment security, performance security, or a backstop behind open-account trading.`,
    keywords: ["types", "kinds", "irrevocable", "revocable", "confirmed", "unconfirmed", "silent confirmation", "sight", "usance", "deferred", "acceptance", "transferable", "back-to-back", "back to back", "revolving", "red clause", "green clause", "standby", "sblc", "isp98", "urdg", "which type"],
  },
  {
    title: "Documentary collections — D/P and D/A",
    content: `Governed by **ICC URC 522**. Banks act as couriers of documents and collectors of payment. Crucially, **no bank guarantees payment** — this is the whole difference from a letter of credit and the reason collections are far cheaper.

- **D/P — Documents against Payment** (also "cash against documents", CAD). The collecting bank releases the shipping documents to the buyer ONLY on payment. The buyer cannot obtain the goods without paying. Seller risk: the buyer simply refuses the shipment, leaving the goods at a foreign port with demurrage running and a forced re-sale or return.
- **D/A — Documents against Acceptance**. The buyer receives the documents — and therefore the goods — against ACCEPTING a draft payable at a future date. The seller has parted with the cargo and holds only a signed promise. URC 522 gives the collecting bank no obligation to pay at maturity, and no financing mechanism for the exporter. **D/A is materially riskier than D/P** and should be treated as close to open account.

**When collections make sense**: an established buyer, a stable country, goods that are readily re-sellable if refused, and a relationship where the L/C cost is not justified.
**When they do not**: custom-built machinery configured to one buyer's specification — a refused shipment may have no second buyer.`,
    keywords: ["documentary collection", "collection", "collections", "d/p", "dp", "d/a", "da", "documents against payment", "documents against acceptance", "cash against documents", "cad", "urc", "urc 522", "draft", "drawee", "collecting bank"],
  },
  {
    title: "Bank guarantees, and payment terms as a commercial lever",
    content: `**Demand guarantees (ICC URDG 758)** — an independent bank undertaking to pay on a compliant written demand. Unlike a documentary credit (a primary payment mechanism) a guarantee is a SECONDARY obligation covering default, and usually requires only a demand statement rather than transport documents. Common forms: advance-payment guarantee (protects the buyer's deposit), performance guarantee, bid/tender bond, warranty/retention guarantee.

**Structuring terms in a real negotiation:**
- Every concession on payment terms is a financing cost and a risk cost. Moving a buyer from 30/70 T/T to 90-day open account transfers roughly three months of working capital and adds full credit exposure — that belongs in the price or must be offset by credit insurance.
- Match the instrument to the exposure, not to habit: custom-built equipment justifies a deposit that covers the non-recoverable build; standard stock does not.
- New buyer, unknown market → advance deposit plus L/C, or confirmed L/C.
- Established buyer, stable market → staged T/T or D/P.
- Strategic long-term buyer with proven history → open account with a credit limit, ideally insured.
- **Partial-shipment and transhipment clauses** matter as much as the headline term: a credit that forbids partial shipment turns one delayed component into a fully unpaid order.

**Currency and charges**: state the currency explicitly, and state who bears bank charges — "all bank charges outside the seller's country are for the buyer's account" is the standard export formulation. Unallocated bank charges routinely eat a low-margin deal.`,
    keywords: ["bank guarantee", "guarantee", "guarantees", "demand guarantee", "urdg", "urdg 758", "performance bond", "bid bond", "tender bond", "advance payment guarantee", "retention", "warranty guarantee", "negotiate terms", "negotiating", "commercial lever", "bank charges", "currency", "partial shipment", "transhipment", "credit insurance", "working capital"],
  },
];
