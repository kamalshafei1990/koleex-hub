"use client";

import PolicyPage, { Section, Callout } from "@/components/commercial-policy/PolicyPage";

const decisions = [
  { question: "Is the customer a credit customer?", yes: "Check credit limit and overdue status", no: "Collect payment before shipping", color: "#007AFF" },
  { question: "Does the order exceed credit limit?", yes: "Escalate to management for approval", no: "Process order on credit terms", color: "#FF9500" },
  { question: "Does the customer have overdue invoices?", yes: "Block order until overdue is settled", no: "Continue with order", color: "#FF3B30" },
  { question: "Is a discount requested?", yes: "Check discount % against approval matrix", no: "Use standard price", color: "#34C759" },
  { question: "Does the discount breach minimum margin?", yes: "Escalate to GM/CEO regardless of discount %", no: "Route to appropriate discount approver", color: "#AF52DE" },
  { question: "Is this a new market or strategic account?", yes: "Special pricing approval required", no: "Standard commercial process", color: "#4FC3F7" },
  { question: "Is the order value >$100K?", yes: "Additional review by Commercial Manager", no: "Standard processing", color: "#7BA1C2" },
];

export default function DecisionTreePage() {
  return (
    <PolicyPage title="Decision Tree" subtitle="Key decision points in the commercial process and the rules that determine outcomes." badge="Commercial Flow">
      <Section title="Commercial Decision Points">
        <div className="flex flex-col gap-4">
          {decisions.map((d, i) => (
            <div key={i} className="rounded-xl border p-5" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
              <p className="text-[14px] font-bold mb-3" style={{ color: "var(--text-primary)" }}>{d.question}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg p-3" style={{ background: "#34C75910" }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: "#34C759" }}>YES</p>
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{d.yes}</p>
                </div>
                <div className="rounded-lg p-3" style={{ background: "#FF3B3010" }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: "#FF3B30" }}>NO</p>
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{d.no}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Callout>Each decision point has a clear binary outcome. There are no ambiguous situations — the rules determine the path. When in doubt, escalate to the next approval level.</Callout>
    </PolicyPage>
  );
}
