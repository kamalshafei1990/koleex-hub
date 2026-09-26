/* ---------------------------------------------------------------------------
   trade-terms/detail.en — LAYERS TWO AND THREE, English.

   NEVER IN THE FIRST BYTES. This file is reached by dynamic import when a
   reader opens a term, so browsing the grid costs nothing of it. That is why
   it may be generous: depth is free when it is not shipped by default.

   Facts trace to ICC (Incoterms® 2020, UCP 600, URC 522, URDG 758) and the
   U.S. International Trade Administration. Where market habit differs from
   the published rule — FOB on containers being the standing example — BOTH
   are stated, because a reader meets the habit in real contracts and needs to
   know it is habit.
   --------------------------------------------------------------------------- */

import type { TermCopy } from "./types";

export const DETAIL_EN: Record<string, Omit<TermCopy, "oneLine">> = {
  EXW: {
    meaning: "Ex Works is the seller's minimum obligation: goods are made available at the seller's premises, not loaded onto any vehicle, with the buyer handling everything else — including export clearance in the seller's own country.",
    howItWorks: "The seller packs and notifies. The buyer arranges collection, loading, export formalities, carriage, insurance and import. The named place is the seller's factory or warehouse.",
    useWhen: "Domestic sales, or a buyer with a strong local agent who can legally complete export formalities in the seller's country.",
    avoidWhen: "Almost any cross-border sale. ICC notes the buyer often cannot complete export formalities abroad.",
    pitfall: "A foreign buyer cannot always act as exporter of record, which can stall the shipment entirely. FCA is the better choice in nearly every export case — it moves only export clearance and loading to the seller and removes the whole problem.",
  },
  FCA: {
    meaning: "Free Carrier: the seller clears the goods for export and hands them to a carrier the buyer nominates.",
    howItWorks: "If the named place is the seller's premises, the seller loads onto the collecting vehicle. If it is anywhere else, the seller delivers ready for unloading. Risk passes at that handover.",
    useWhen: "Containerised cargo of any kind — this is ICC's recommended rule for containers.",
    avoidWhen: "Rarely a wrong choice. For bulk or break-bulk loaded directly aboard, FOB is the traditional fit.",
    pitfall: "Sellers used to avoid FCA because banks paying under a letter of credit want an on-board bill of lading, which FCA historically could not produce — so they misused FOB instead. Incoterms 2020 added a mechanism for the carrier to issue an on-board B/L to the seller under FCA, removing that reason.",
  },
  FAS: {
    meaning: "Free Alongside Ship: the seller delivers alongside the vessel — on the quay or on a barge — at the named port of shipment, export cleared.",
    howItWorks: "Risk passes once the goods sit alongside the ship. Loading aboard, freight, insurance and everything after are the buyer's.",
    useWhen: "Bulk or heavy-lift cargo loaded by the vessel's own gear or shore cranes.",
    avoidWhen: "Containers. The seller cannot control a box sitting in a terminal yard.",
    pitfall: "'Alongside' is a physical position, not a moment in a schedule. If the vessel is delayed, goods can sit on the quay at the buyer's risk while accruing storage the contract never mentioned.",
  },
  FOB: {
    meaning: "Free On Board: the seller delivers the goods on board the vessel at the named port of shipment, having cleared them for export. The buyer contracts and pays the main carriage.",
    howItWorks: "Risk passes when the goods are on board. The seller's cost stops at the same point — FOB is one of the rules where risk and cost end together.",
    useWhen: "Bulk and break-bulk cargo loaded directly aboard a ship.",
    avoidWhen: "Containerised cargo, per ICC guidance — use FCA.",
    pitfall: "Two things. First: risk does NOT pass at the 'ship's rail'. That wording was deleted in Incoterms 2010 after decades of dispute over an imaginary line; the rule is 'on board'. If a contract still says ship's rail, flag it as outdated drafting. Second: FOB remains overwhelmingly common for container trade out of Asia because banks, buyers and forwarders are used to it — know that this is market habit, not correct ICC practice, and know the exposure: the seller carries risk on a box it no longer controls, in a yard it cannot enter, until an uncertain loading moment that may be days away.",
  },
  CFR: {
    meaning: "Cost and Freight: the seller pays the freight to the named destination port — but risk passes on board at the port of shipment, not on arrival.",
    howItWorks: "The seller contracts and pays the main carriage. The buyer carries the risk from loading onward and may insure at its own discretion.",
    useWhen: "Bulk cargo where the seller has better freight rates and the buyer accepts origin risk.",
    avoidWhen: "Containers — use CPT.",
    pitfall: "This is the C-group split, and it is the single most misunderstood thing about Incoterms. Buyers routinely assume that because the seller pays freight to the destination, the seller carries risk there too. It does not. If the vessel sinks mid-ocean, the seller has been paid and the buyer has paid for freight on lost cargo it already owned the risk of.",
  },
  CIF: {
    meaning: "Cost, Insurance and Freight: CFR plus an obligation on the seller to insure the cargo.",
    howItWorks: "The seller pays freight to the destination port and buys marine insurance for the buyer's benefit. Minimum cover is Institute Cargo Clauses (C) at 110% of contract value, in the contract currency. Risk still passes on board at origin.",
    useWhen: "Bulk commodities, where minimum cover is the market norm and the buyer wants a freight-and-insurance-inclusive price to the port.",
    avoidWhen: "Containers — use CIP, which also carries wider cover.",
    pitfall: "ICC Clauses (C) is the MINIMUM tier and covers a narrow list of named perils — not theft, not water damage in many cases. Buyers of manufactured goods often assume 'insured' means comprehensive. Either agree a higher tier in the contract or use CIP.",
  },
  CPT: {
    meaning: "Carriage Paid To: the seller pays carriage to the named destination, but risk passes when the goods are handed to the FIRST carrier.",
    howItWorks: "The first carrier may be a trucker collecting far inland, long before any port. From that moment the goods are the buyer's risk while the seller keeps paying freight.",
    useWhen: "Containerised or multimodal shipments where the seller sells carriage-inclusive to a destination.",
    avoidWhen: "Where the buyer needs risk cover to destination — use DAP.",
    pitfall: "The gap between the risk point and the cost point is at its widest here. Goods can become the buyer's risk at a factory gate in one country while the seller pays carriage to a city in another.",
  },
  CIP: {
    meaning: "Carriage and Insurance Paid To: CPT plus an obligation on the seller to insure.",
    howItWorks: "Since Incoterms 2020 the seller must insure at Institute Cargo Clauses (A) — 'all risks' — for a minimum of 110% of contract value. Risk still passes at the first carrier.",
    useWhen: "Containerised manufactured goods sold carriage-and-insurance-inclusive. This is the container-era replacement for CIF.",
    avoidWhen: "Where the buyer wants the seller to carry risk to destination, not just cost — use DAP.",
    pitfall: "CIP and CIF require DIFFERENT insurance tiers, and the difference is deliberate: ICC set CIP at Clauses (A) because it typically carries manufactured goods needing broad cover, while CIF is dominated by bulk where minimum cover is normal. Quoting CIF for machinery and assuming wide cover is a real and common error.",
  },
  DAP: {
    meaning: "Delivered at Place: the seller carries cost and risk all the way to the named destination, delivering ready for unloading.",
    howItWorks: "The goods arrive still on the transport vehicle. The buyer unloads, clears import and pays duty and VAT.",
    useWhen: "The buyer wants a delivered price to its door but can clear import itself.",
    avoidWhen: "The buyer cannot or will not handle import clearance — use DDP.",
    pitfall: "The seller is not obliged to insure under DAP, but carries the risk to destination — so it should insure for its own protection. Do not confuse 'seller bears the risk' with 'seller is contractually required to insure the buyer', which is only true under CIF and CIP.",
  },
  DPU: {
    meaning: "Delivered at Place Unloaded: as DAP, and the seller also unloads at the destination.",
    howItWorks: "Risk passes only once the goods are unloaded at the named place. The buyer still clears import and pays duty.",
    useWhen: "Delivery into a terminal, yard or site where the seller can arrange unloading equipment.",
    avoidWhen: "The seller cannot guarantee unloading capability at the destination.",
    pitfall: "This is the only Incoterm that obliges the seller to unload. It was renamed from DAT (Delivered at Terminal) in 2020 precisely so the place need not be a terminal — but a seller accepting DPU at an unfamiliar site is accepting an unloading obligation it may not be able to perform.",
  },
  DDP: {
    meaning: "Delivered Duty Paid: the seller's maximum obligation — everything, including import clearance and duty and VAT in the buyer's country.",
    howItWorks: "The seller delivers to the named destination, import cleared, ready for unloading. The buyer unloads.",
    useWhen: "The buyer wants a fully landed price and the seller can legally act as importer of record in the destination country.",
    avoidWhen: "Anywhere the seller cannot be importer of record, or cannot reclaim or absorb local VAT.",
    pitfall: "Many countries bar a non-resident from acting as importer of record without a local entity or fiscal representative. Quoting DDP into such a market commits the seller to something it may be legally unable to perform. Always check before quoting DDP.",
  },

  /* ── Payment methods ───────────────────────────────────────────────── */
  "cash-in-advance": {
    meaning: "The buyer pays in full before the goods ship. Near-zero risk for the exporter.",
    howItWorks: "Usually a T/T wire before production or before dispatch.",
    useWhen: "A new buyer in an unknown market, a small order, or goods built to one buyer's specification.",
    avoidWhen: "Competitive markets — it loses deals to sellers offering credit.",
    pitfall: "It is the safest term and the hardest to win. As a full-value demand it is rare; staged deposits exist precisely because a 100% advance is usually unsellable.",
  },
  "letter-of-credit": {
    meaning: "A bank's independent undertaking to pay the seller against documents that comply with the credit. Governed by ICC UCP 600.",
    howItWorks: "The buyer (applicant) asks its bank (issuing bank) to issue the credit in the seller's favour (beneficiary). An advising bank passes it on and checks apparent authenticity — advising alone carries NO payment obligation. A confirming bank adds its own separate undertaking. The bank has a maximum of five banking days after presentation to examine documents and decide.",
    useWhen: "The buyer's creditworthiness is unknown but its bank is trusted. Ask for confirmation when the issuing bank is small or country risk is real — and ask for it in the contract BEFORE the credit is issued.",
    avoidWhen: "The cost is not justified by the risk, and the relationship and market are both stable.",
    pitfall: "Two principles decide every L/C dispute. Autonomy: the credit is a separate transaction from the sales contract — banks are not concerned with whether the machine works, only whether the documents comply. And documents only: a perfect shipment with flawed papers can go unpaid, while a poor shipment with perfect papers gets paid. Discrepancy rates on first presentation are notoriously high, which is why ICC recommends keeping the required document list minimal — ideally an invoice and a transport document.",
  },
  dp: {
    meaning: "Documents against Payment, also called cash against documents (CAD). A documentary collection under ICC URC 522 where the bank releases shipping documents only on payment.",
    howItWorks: "The seller ships and sends documents through the banking chain. The collecting bank hands them to the buyer only when the buyer pays. Without the documents the buyer cannot collect the goods. No bank guarantees anything — the banks are couriers and cashiers.",
    useWhen: "An established buyer, a stable country, and goods that are readily re-sellable if refused.",
    avoidWhen: "Custom-built equipment configured to one buyer's specification — a refused shipment may have no second buyer.",
    pitfall: "The buyer can simply refuse the shipment. The seller is then left with cargo at a foreign port, demurrage running, and a choice between a forced re-sale and paying to bring it home.",
  },
  da: {
    meaning: "Documents against Acceptance. Also a URC 522 collection, but the buyer receives the documents against ACCEPTING a draft payable at a future date.",
    howItWorks: "The buyer signs to accept a time draft and takes the documents — and therefore the goods — immediately. Payment falls due later.",
    useWhen: "A long-standing buyer with a proven payment record, ideally backed by credit insurance.",
    avoidWhen: "Any relationship where the buyer's payment history is not established.",
    pitfall: "The seller has parted with the cargo and holds only a signed promise. URC 522 puts no obligation on the collecting bank to pay at maturity and provides no financing mechanism for the exporter. D/A is materially riskier than D/P and should be treated as close to open account.",
  },
  "open-account": {
    meaning: "Goods ship first; payment follows at an agreed interval — typically 30, 60 or 90 days.",
    howItWorks: "The seller invoices and waits. No bank instrument stands behind the payment.",
    useWhen: "Competitive markets and strong buyers who demand it; usually paired with credit insurance or receivables finance.",
    avoidWhen: "An unproven buyer, or a market with currency or transfer restrictions.",
    pitfall: "A buyer demanding 90-day open account is asking for three months of free financing. That is a real cost and belongs in the price — or the term should be shortened. Payment terms are a price component, not a formality.",
  },
  consignment: {
    meaning: "The seller is paid only after the distributor sells the goods to an end customer.",
    howItWorks: "Stock sits abroad, owned by the seller, in the distributor's hands. Cash arrives on sale, not on shipment.",
    useWhen: "A highly trusted partner, in a market worth seeding, with insurance in place.",
    avoidWhen: "Almost everywhere else.",
    pitfall: "The highest exporter risk on the ladder: the goods are abroad, in someone else's warehouse, unpaid, and recovering them across a border is slow and expensive.",
  },

  /* ── T/T structures ────────────────────────────────────────────────── */
  "tt-100-advance": {
    meaning: "The whole contract value wired before production begins.",
    howItWorks: "Equivalent to cash in advance; T/T is simply the transfer method.",
    pitfall: "T/T carries no bank undertaking of any kind. Its security comes only from WHEN the money is due relative to shipment.",
  },
  "tt-30-70-bl": {
    meaning: "30% deposit with the order, 70% payable against a copy of the bill of lading. The classic structure in machinery exports from China.",
    howItWorks: "The deposit funds production. The balance falls due once shipping documents exist but before the buyer can collect the goods, because the seller holds the ORIGINAL bill of lading until paid.",
    useWhen: "Standard equipment for a buyer with some track record.",
    pitfall: "The original B/L is the entire lever — whoever holds it controls the cargo. This is what makes a 70% balance safe without any bank instrument. Release originals before payment and the structure collapses.",
  },
  "tt-30-70-preship": {
    meaning: "30% deposit, and the remaining 70% before the goods leave the factory.",
    howItWorks: "Stronger for the seller than paying against documents: the goods do not move until the money is in.",
    useWhen: "A new buyer, or equipment configured to order.",
    pitfall: "Harder to sell commercially. Buyers resist paying in full for goods they have not seen shipped.",
  },
  "tt-30-40-30": {
    meaning: "30% deposit, 40% when production is complete and before inspection, 30% against a copy of the bill of lading.",
    howItWorks: "Spreads the seller's exposure across the build. Common on long-lead capital equipment.",
    useWhen: "Machinery with a long production cycle, where tying up the seller's working capital for months is the real risk.",
    pitfall: "The middle payment should at least cover the non-recoverable build cost. For equipment customised to one buyer, that is the amount at risk if the buyer walks away.",
  },

  /* ── Letter of credit — variants ───────────────────────────────────── */
  "lc-irrevocable": {
    meaning: "A credit that cannot be amended or cancelled without the agreement of the issuing bank, the confirming bank if there is one, and the beneficiary. UCP 600 Article 3 makes every credit irrevocable even when the credit does not say so.",
    howItWorks: "Once issued, the bank's undertaking stands until expiry. An amendment reaches the seller through the advising bank, and the seller may accept or reject it. Under Article 10 the seller is bound only when it says yes — or presents documents that comply with the amended credit.",
    useWhen: "Always. It is the baseline, not an option.",
    pitfall: "'Revocable' credits still appear in old templates and in drafts from inexperienced buyers. Under UCP 600 they do not exist — a credit calling itself revocable is either subject to no rules at all, or to rules written before 2007. Read it as a warning about who drafted the contract.",
  },
  "lc-confirmed": {
    meaning: "A credit to which a second bank — the confirming bank, normally in the seller's country — has added its own independent undertaking to pay against complying documents (UCP 600 Article 8).",
    howItWorks: "The issuing bank asks or authorises the confirming bank to confirm. The seller presents documents to the confirming bank, which must pay if they comply — whether or not the issuing bank, or the issuing bank's country, ever reimburses it. The confirmation fee, roughly 0.1% to 3% a year of the exposure depending on the issuing bank and country, is usually for the seller's account unless negotiated.",
    useWhen: "The issuing bank is small or unknown, or the buyer's country carries transfer or political risk. Ask for it in the sales contract, before the credit is opened.",
    avoidWhen: "A first-class issuing bank in a stable country — the fee buys little.",
    pitfall: "'Advised' is not 'confirmed'. An advising bank only checks the credit's apparent authenticity and forwards it; under Article 9 it owes the seller nothing. Sellers regularly read 'advised through Bank X' as protection from Bank X. It is not. Silent confirmation — the seller's bank confirming without the issuing bank's request — is a private arrangement outside the credit, not a UCP confirmation, with different rights.",
  },
  "lc-sight": {
    meaning: "A credit available by sight payment: the bank pays when documents are presented and found to comply.",
    howItWorks: "The seller ships, assembles the documents and presents them. The bank has a maximum of five banking days following the day of presentation to examine them (UCP 600 Article 14b). If they comply, it pays; if not, it issues one refusal notice listing every discrepancy.",
    useWhen: "The seller wants cash on shipment and the buyer accepts paying before the goods arrive.",
    pitfall: "'At sight' is not 'same day'. Five banking days for examination, plus reimbursement between banks, plus a discrepancy round-trip, routinely turns 'sight' into two to three weeks after shipment. A working-capital plan built on 'paid when we ship' is built on a misreading.",
  },
  "lc-usance": {
    meaning: "A credit paying at a future date — commonly 30, 60, 90 or 180 days after the bill of lading date or after presentation. Also called a term credit, or a deferred payment / acceptance credit depending on the mechanism.",
    howItWorks: "The bank does not pay on presentation; it commits to pay at maturity. Under an acceptance credit the seller draws a time draft on the bank, which accepts it; under a deferred payment credit there is no draft, only the bank's undertaking. Either can normally be discounted — the seller sells the bank's commitment for cash today at a small charge. 'Usance payable at sight' (UPAS), common on shipments from China, means the seller is paid at sight while the buyer repays the bank at maturity: the bank finances the gap and someone pays the interest.",
    useWhen: "The buyer needs credit terms but the seller wants a bank, not the buyer, to owe the money.",
    avoidWhen: "The seller cannot carry the receivable and discounting is expensive in its market.",
    pitfall: "Who pays the interest is a negotiation, not a default — in a UPAS structure usually the buyer, in a discounted acceptance usually the seller — and in both cases it belongs in the price. Check the trigger too: '90 days from B/L date' and '90 days from sight' can differ by weeks.",
  },
  "lc-transferable": {
    meaning: "A credit that the first beneficiary — typically a trading company — may make available in whole or in part to one or more second beneficiaries, the actual suppliers (UCP 600 Article 38).",
    howItWorks: "The credit must expressly state 'transferable'. The transferring bank issues a transferred credit to the supplier on the same terms, except that the amount, unit price, expiry, presentation period and latest shipment date may be reduced and the insurance percentage increased. The middleman substitutes its own invoice for the supplier's and keeps the difference. A transferred credit cannot be transferred again by the second beneficiary.",
    useWhen: "An intermediary with no credit line of its own, selling goods it does not make, where the end buyer accepts a transferable credit.",
    avoidWhen: "The intermediary needs to hide the supplier's identity or change other terms — that calls for back-to-back.",
    pitfall: "If the middleman fails to substitute its invoice when asked, the bank may forward the supplier's documents — supplier's price and all — to the issuing bank. The whole margin, and the supplier's identity, become visible to the end buyer.",
  },
  "lc-back-to-back": {
    meaning: "Two separate credits: a master credit issued by the end buyer in favour of a middleman, which the middleman's bank then takes as security to issue a second credit in favour of the real supplier.",
    howItWorks: "The second credit mirrors the first with a lower amount, an earlier expiry and shipment date, and the supplier's documents flowing back to the middleman, who replaces them with its own and presents under the master credit. Unlike a transfer, the issuing bank of the master credit is not involved and need not know.",
    useWhen: "The middleman must keep buyer and supplier apart, or the master credit is not transferable, or the terms of the two legs genuinely differ.",
    avoidWhen: "The middleman's bank will not take the master credit as security — many will not, because the two credits are legally independent and the bank is exposed if documents under the master credit are rejected.",
    pitfall: "The two credits are independent. If the supplier's documents comply with the second credit but, once substituted, fail under the master credit — a date, a description, a tolerance — the middleman's bank must still pay the supplier while the middleman may not be paid. Every mismatch between the two credits is a hole the middleman falls through.",
  },
  "lc-revolving": {
    meaning: "A single credit whose amount is automatically reinstated after each drawing or each period, without an amendment.",
    howItWorks: "The credit states the amount per period, the number of periods and whether unused amounts carry forward (cumulative) or lapse (non-cumulative). USD 100,000 per month, non-cumulative, for six months covers regular monthly shipments up to that value; a cumulative one lets a missed month's amount be used later.",
    useWhen: "Regular, repetitive shipments of similar goods to the same buyer over a period.",
    avoidWhen: "Shipments are irregular in timing or value — one larger credit allowing partial shipments is simpler, and banks prefer it.",
    pitfall: "Revolving credits are genuinely uncommon because the drafting is fiddly — total exposure, cumulative or not, reinstatement by time or by drawing — and a badly drafted one leaves the bank's maximum liability unclear. Most banks steer the parties to one credit with partial shipments permitted, which gives the same commercial result.",
  },
  "lc-red-clause": {
    meaning: "A credit containing a clause — historically typed in red ink — authorising the advising or confirming bank to advance part of the credit amount to the seller before shipment, to finance purchase or production.",
    howItWorks: "The seller draws the advance against a receipt and an undertaking to present complying documents later; the advance is deducted from the final payment. A green clause goes further: the advance is made against warehouse receipts showing the goods in store awaiting shipment.",
    useWhen: "Commodity trades where the buyer wants to secure supply from a producer who needs pre-shipment finance, and accepts the risk of providing it.",
    avoidWhen: "The seller is unproven. If it never ships, the issuing bank recovers the advance from the buyer, not from the seller.",
    pitfall: "The advance is unsecured lending by the buyer, dressed as a letter of credit. It is rare today precisely because a buyer wanting to pre-finance a supplier has better-protected ways — a deposit behind an advance payment guarantee, for one.",
  },
  "lc-standby": {
    meaning: "A standby letter of credit is a bank undertaking that pays on demand if the applicant fails to perform — typically if the buyer fails to pay an invoice. Functionally a guarantee, in the legal form of a credit. Governed by ISP98 or UCP 600.",
    howItWorks: "Trade proceeds on open account or T/T. If the buyer does not pay, the seller presents a simple demand — usually a signed statement that payment is due and unpaid, with a copy of the invoice — and the bank pays within the credit's examination period. If the buyer pays normally, the standby is never drawn.",
    useWhen: "A recurring open-account relationship where the seller wants bank cover for the peak outstanding balance without a commercial credit for every shipment.",
    avoidWhen: "A one-off shipment — a commercial credit is the direct tool.",
    pitfall: "A standby is only as good as its demand conditions. One that pays against a signed statement of default is real security; one requiring a court judgment or the buyer's acknowledgement is decoration. US banks issue standbys where others issue guarantees, because they were historically restricted from issuing guarantees — so 'SBLC' and 'bank guarantee' often mean the same commercial thing in different countries.",
  },

  /* ── Bank guarantees & escrow ──────────────────────────────────────── */
  "bg-advance-payment": {
    meaning: "A guarantee issued by the seller's bank in favour of the buyer, undertaking to repay the buyer's advance if the seller fails to deliver. Governed by ICC URDG 758 when it says so.",
    howItWorks: "The buyer pays a deposit — 30% on a machine is typical — and holds a guarantee for the same amount. If the seller does not perform, the buyer demands under the guarantee and the bank pays, then recovers from the seller. The amount usually reduces as shipments are made.",
    useWhen: "Any deposit large enough that losing it would matter, paid to a seller the buyer does not yet know.",
    avoidWhen: "Small deposits to an established supplier — the bank fee and the seller's frozen credit line cost more than the risk.",
    pitfall: "The guarantee should take effect only once the advance is actually received — 'effective upon receipt of the advance payment in our account'. One effective on issue can, in principle, be called before the deposit has been paid. For the seller, the guarantee also occupies its bank facility for the whole contract period; that is a real cost and belongs in the price.",
  },
  "bg-performance": {
    meaning: "A guarantee from the seller's or contractor's bank that pays the buyer a fixed sum — typically 5% to 10% of the contract value — if the seller fails to perform.",
    howItWorks: "Under URDG 758 it is payable on first written demand, supported by a statement of what the seller has failed to do (Article 15). The bank does not investigate whether the failure is real — it pays against a complying demand and recovers from the seller.",
    useWhen: "Capital equipment, projects and public tenders, where non-performance would cost the buyer far more than the price.",
    avoidWhen: "Routine sales of standard goods — the buyer's remedy is simply not to pay.",
    pitfall: "'On demand' means what it says: an unfair demand is paid first and argued about later, in court, at the seller's expense. Protection is in the drafting — a clear expiry date, a statement-of-default requirement, and resistance to 'extend or pay', where a buyer threatens to call the guarantee unless the seller extends it indefinitely.",
  },
  "bg-bid": {
    meaning: "A guarantee submitted with a tender, usually 1% to 5% of the bid value, that pays the tendering authority if the bidder wins and then refuses to sign the contract or to provide the performance guarantee.",
    howItWorks: "Issued for the validity period of the tender. On award it is released once the contract is signed and the performance guarantee delivered; for losing bidders it is released when the tender closes.",
    useWhen: "Public procurement and large private tenders, where the buyer needs bidders to be serious.",
    pitfall: "The expiry must outlast the tender validity period plus the time needed to sign. A bid bond expiring the week the award is announced leaves the authority uncovered — and a bidder whose bond must be extended at short notice may find its bank slow.",
  },
  "bg-warranty": {
    meaning: "A guarantee covering the seller's obligations during the warranty period — usually 5% to 10% of the contract value for 12 to 24 months after delivery or acceptance. Often issued to release retention money the buyer would otherwise hold back.",
    howItWorks: "Instead of the buyer withholding the last 10% until the warranty ends, the seller is paid in full and provides a guarantee for the same amount. If defects appear and the seller does not remedy them, the buyer demands under the guarantee.",
    useWhen: "Machinery and installations where the seller wants its final payment now and the buyer wants cover for latent defects.",
    pitfall: "Tie the expiry to the real end of the warranty — 'twelve months after the date of the acceptance certificate' — not to a calendar date fixed at signing. If commissioning slips six months, a fixed-date guarantee expires halfway through the warranty it was meant to cover.",
  },
  escrow: {
    meaning: "An arrangement where a neutral third party — a bank, a law firm or a trading platform — holds the buyer's payment and releases it to the seller only when agreed conditions are met.",
    howItWorks: "The buyer pays the escrow agent up front, so the seller knows the money exists before shipping. The agent releases it against an agreed trigger: a shipping document, the buyer's confirmation of receipt, or an inspection report. Large B2B marketplaces offer a built-in version — often marketed as 'trade assurance' — where the platform is the agent and also arbitrates disputes.",
    useWhen: "A first transaction between parties who do not know each other, small enough that a letter of credit would cost more than it protects.",
    avoidWhen: "Large or repeated contracts — the fee, typically 1% to 3%, adds up, and a credit or a standby is the proper tool.",
    pitfall: "The release condition must be objective. 'Release on buyer's satisfaction' means the buyer decides when the seller is paid. And platform protection applies only to payments made through the platform: a supplier asking to be paid 'directly, to save the fee' is asking the buyer to give up the protection.",
  },
};
