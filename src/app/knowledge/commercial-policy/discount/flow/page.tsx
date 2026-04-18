"use client";

import PolicyPage, { Section, StepFlow, Callout } from "@/components/commercial-policy/PolicyPage";

export default function DiscountFlowPage() {
  return (
    <PolicyPage title="Discount Flow" subtitle="The 9-step process from base price to final discounted price, with margin checks and approval gates." badge="Discount System">
      <Section title="9-Step Discount Process">
        <StepFlow steps={[
          { label: "Start with Base Price", description: "Price from the pricing formula for this product, market, and channel" },
          { label: "Customer requests discount", description: "Sales identifies the need for a pricing adjustment" },
          { label: "Determine discount type", description: "Standard, Volume, Project, Competitive, Market Entry, Promotion, or Special" },
          { label: "Calculate discounted price", description: "Apply the requested percentage to the base price" },
          { label: "Margin check", description: "System verifies the discounted price maintains minimum margin for the product level" },
          { label: "Identify approval level", description: "Based on discount percentage: 0-3% Sales, 3-5% Manager, 5-10% Commercial, 10-15% GM, 15%+ CEO" },
          { label: "Submit for approval", description: "Request sent to the appropriate approver with justification" },
          { label: "Approval decision", description: "Approver reviews and either approves, modifies, or rejects the discount" },
          { label: "Final price confirmed", description: "Approved discount applied to quotation with full audit trail" },
        ]} />
      </Section>

      <Section title="Decision Points">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border-l-4 p-4" style={{ borderColor: "#FF3B30", background: "var(--bg-surface-subtle)" }}>
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Margin Check Fails</p>
            <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>If discount would breach minimum margin, it automatically escalates to the next approval level regardless of the discount percentage.</p>
          </div>
          <div className="rounded-xl border-l-4 p-4" style={{ borderColor: "#34C759", background: "var(--bg-surface-subtle)" }}>
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Margin Check Passes</p>
            <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>If margin is maintained, the discount follows the standard approval chain based on percentage alone.</p>
          </div>
        </div>
      </Section>

      <Callout>The margin check at Step 5 is automatic and cannot be bypassed. If margin falls below minimum, the system forces escalation regardless of discount percentage.</Callout>
    </PolicyPage>
  );
}
