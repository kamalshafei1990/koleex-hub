"use client";

import { useState } from "react";
import PolicyPage, { Section } from "@/components/commercial-policy/PolicyPage";

const faqs = [
  { q: "How is commission calculated?", a: "Commission = Invoice Amount × Commission Rate. Rates: Standard 3%, Senior 4%, Lead 5%. Calculated automatically when payment is confirmed." },
  { q: "When is commission paid?", a: "After the customer pays the invoice: Invoice Paid → Calculated → Manager Approved → Finance Payable → Disbursed. Monthly cycle." },
  { q: "Do discounts affect commission?", a: "No. Commission is always calculated on the full invoice amount, regardless of any discounts applied to the customer." },
  { q: "What happens with returns?", a: "Commission is adjusted proportionally. A $10,000 return on a 3% rate reduces commission by $300." },
  { q: "Is there a commission cap?", a: "No. There is no upper limit on commission earnings. Higher sales always mean higher commission." },
  { q: "What if the customer pays partially?", a: "Commission is calculated only on the paid portion. Remaining commission triggers when the rest is paid." },
  { q: "Who approves commission?", a: "Sales Manager reviews and approves. Finance marks as payable and processes payment." },
  { q: "Can commission be reversed?", a: "Only adjusted through a credit note. Full reversal without credit note is not supported." },
  { q: "Do I see the product cost?", a: "No. Sales personnel cannot see KOLEEX internal cost. Commission is based on invoice amount only." },
  { q: "What commission rate do I get?", a: "Based on your tier: Standard (Junior) 3%, Senior 4%, Lead 5%. Assigned by management." },
  { q: "When does the cycle close?", a: "End of each calendar month. All invoices paid within the month are included in that cycle." },
  { q: "Can I track my commission history?", a: "Yes. Full visibility into pending, calculated, approved, payable, and paid commissions with all details." },
];

export default function CommissionFaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <PolicyPage title="Commission FAQ" subtitle="Common questions about how commission works at KOLEEX." badge="Commission System">
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
