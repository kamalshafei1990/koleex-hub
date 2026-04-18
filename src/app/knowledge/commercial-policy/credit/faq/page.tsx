"use client";

import { useState } from "react";
import PolicyPage, { Section } from "@/components/commercial-policy/PolicyPage";

const faqs = [
  { q: "Who can get credit?", a: "Only Gold, Platinum, and Diamond level customers. End User and Silver operate on cash/advance only. Must reach required purchase threshold and receive management approval." },
  { q: "How is credit limit calculated?", a: "Credit Limit = Average Monthly Purchase × Credit Months. Gold: ×3, Platinum: ×4, Diamond: contract-based (typically ×12+)." },
  { q: "What are credit days?", a: "Payment window after invoice: Gold = 90 days, Platinum = 120 days, Diamond = Annual Settlement. End User and Silver = 0 (cash only)." },
  { q: "What happens if I am overdue?", a: "0-30 days: reminder. 30-60 days: no new orders. 60-90 days: credit hold. 90+ days: account blocked. 120+ days: legal/collection." },
  { q: "Can I upgrade my level?", a: "Yes. Silver→Gold at $500K lifetime. Gold→Platinum at $3M lifetime. Platinum→Diamond requires contract + sole agent agreement + management approval." },
  { q: "What is Diamond level?", a: "Highest level — sole agents/exclusive partners. Requires formal contract. Benefits: best pricing, open credit with annual settlement, exclusive territory, VIP support." },
  { q: "Is credit automatic?", a: "No. Even when qualified, credit must go through: system identifies eligibility → management reviews → finance evaluates → credit assigned." },
  { q: "How often is credit reviewed?", a: "Every 6 months. Finance evaluates payment behavior, volumes, outstanding balances, overdue history. Limits may increase, maintain, or decrease." },
  { q: "Can my credit be reduced?", a: "Yes. Late payments, declining volumes, or financial risk can reduce credit at the 6-month review. Severe overdue triggers immediate holds." },
  { q: "What if my order exceeds credit?", a: "Requires management approval. Sales manager and finance review payment history and relationship before deciding." },
  { q: "Do new customers get credit?", a: "No. All new customers start at End User/Silver with cash only. Credit available once Gold level reached ($500K+ lifetime)." },
  { q: "How does Diamond credit work?", a: "Open credit with annual settlement per contract. Unlike formula-based Gold/Platinum, Diamond terms are individually negotiated." },
];

export default function CreditFaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <PolicyPage title="Credit FAQ" subtitle="Common questions about credit eligibility, limits, and policies." badge="Credit System">
      <Section>
        <div className="flex flex-col gap-2">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border" style={{ borderColor: "var(--border-subtle)" }}>
              <button onClick={() => setOpenIdx(openIdx === i ? null : i)} className="flex w-full items-center justify-between px-5 py-4 text-left">
                <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{faq.q}</span>
                <span className="text-[18px]" style={{ color: "var(--text-dim)" }}>{openIdx === i ? "−" : "+"}</span>
              </button>
              {openIdx === i && (
                <div className="border-t px-5 py-4" style={{ borderColor: "var(--border-faint)" }}>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </PolicyPage>
  );
}
