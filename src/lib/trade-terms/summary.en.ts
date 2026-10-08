/* ---------------------------------------------------------------------------
   trade-terms/summary.en — LAYER ONE. One sentence per term, English.

   THE WHOLE PAGE RESTS ON THIS FILE. Someone who has never exported anything
   meets "FOB Ningbo" in a contract with exactly one question in their head:
   "what is it, and what changes for me?" If a line here does not answer that
   without a second line, the line is wrong.

   RULES THESE SENTENCES FOLLOW:
     · No jargon explaining jargon. "Risk passes" means nothing to a newcomer;
       "from that moment it is yours" does.
     · Say who carries what, in the second person. A reader is always one of
       the two parties, never a spectator.
     · One sentence. Anything needing two belongs in detail.en.ts.

   English is the SOURCE. Other languages translate from here, never from
   each other, and never back into English.
   --------------------------------------------------------------------------- */

/** code / id → the one line. */
export const SUMMARY_EN: Record<string, string> = {
  /* ── Incoterms ─────────────────────────────────────────────────────── */
  EXW: "You collect the goods from the seller's own premises — not even loaded. Everything past that door is yours to arrange and pay for.",
  FCA: "The seller clears the goods for export and hands them to the carrier you nominated. From that handover they are yours.",
  FAS: "The seller places the goods on the quay next to the ship. Getting them aboard, and everything after, is yours.",
  FOB: "The seller loads the goods onto the ship. From the moment they are on board, the risk is yours.",
  CFR: "The seller pays the freight to the arrival port — but the goods became your risk back at loading, not on arrival.",
  CIF: "Like CFR, plus the seller must insure the cargo. The risk still became yours at loading; you simply hold the insurance claim.",
  CPT: "The seller pays the carriage all the way to the destination — but the goods became your risk the moment the first carrier took them.",
  CIP: "Like CPT, plus the seller must insure the cargo at the widest cover. The risk still passed at the first carrier.",
  DAP: "The seller brings the goods to the agreed place and carries the risk the whole way. You clear customs and pay the duty.",
  DPU: "Same as DAP, and the seller also unloads for you. This is the only rule that obliges the seller to unload.",
  DDP: "The seller delivers to your door with import cleared and duty paid. You do nothing but receive the goods.",

  /* ── Payment methods ───────────────────────────────────────────────── */
  "cash-in-advance": "The buyer pays before anything ships. Nothing is safer for the seller, and nothing is harder on the buyer's cash.",
  "letter-of-credit": "A bank promises to pay the seller once the paperwork is correct — not once the goods are good. Papers, not cargo.",
  dp: "The bank releases the shipping documents only when the buyer pays. No payment, no goods.",
  da: "The buyer gets the documents — and therefore the goods — by signing a promise to pay later. The seller is left holding a signature.",
  "open-account": "The goods ship first and payment follows in 30, 60 or 90 days. Normal in competitive markets, and the seller carries it all.",
  consignment: "The seller is paid only after the distributor sells the goods. The cargo sits abroad, in someone else's hands, unpaid.",

  /* ── T/T structures ────────────────────────────────────────────────── */
  "tt-100-advance": "The full amount is wired before production starts.",
  "tt-30-70-bl": "30% deposit with the order, 70% once shipping documents exist — the seller keeps the original B/L until paid.",
  "tt-30-70-preship": "30% deposit, and the remaining 70% before the goods leave. Stronger for the seller than paying against documents.",
  "tt-30-40-30": "30% deposit, 40% when production is finished, 30% against the shipping document. Common on long-lead machinery.",

  /* ── Letter of credit — variants ───────────────────────────────────── */
  "lc-irrevocable": "Cannot be changed or cancelled without the seller's consent. Under today's rules every letter of credit is irrevocable — a contract offering a 'revocable' one is offering nothing.",
  "lc-confirmed": "A second bank — usually in the seller's own country — adds its own promise to pay. The seller no longer depends on a foreign bank or a foreign country.",
  "lc-sight": "The bank pays as soon as it has checked the documents and found them correct — in practice within five banking days, not the same day.",
  "lc-usance": "The bank pays 30, 60, 90 or 180 days after shipment. The buyer gets credit; the seller can usually sell the bank's promise for cash today.",
  "lc-transferable": "A middleman can pass all or part of the credit to the real supplier. The word 'transferable' must be printed on it, or it cannot be done.",
  "lc-back-to-back": "A middleman uses the buyer's credit as security to open a second, separate credit for the supplier. Two credits, one deal — and every difference between them is the middleman's cost.",
  "lc-revolving": "One credit that refills itself after each shipment or each month, so regular deliveries to the same buyer need no new credit every time.",
  "lc-red-clause": "The bank advances part of the money to the seller before shipment, to fund production — on the buyer's risk. Rare today.",
  "lc-standby": "A guarantee dressed as a letter of credit: it pays only if the buyer fails to pay. Usually sits behind open-account shipments.",

  /* ── Bank guarantees & escrow ──────────────────────────────────────── */
  "bg-advance-payment": "The seller's bank promises to refund the buyer's deposit if the seller never delivers. What a buyer asks for before wiring 30% on a machine.",
  "bg-performance": "The seller's bank pays the buyer a fixed sum — typically 5–10% of the contract — if the seller fails to perform.",
  "bg-bid": "Handed in with a tender: the bidder's bank pays if the bidder wins and then walks away from signing.",
  "bg-warranty": "Replaces the money a buyer would otherwise hold back during the warranty period — the seller is paid in full, and the bank covers defects.",
  escrow: "A neutral third party holds the buyer's money and releases it to the seller only when the agreed condition is met — shipped, received or inspected.",
};
