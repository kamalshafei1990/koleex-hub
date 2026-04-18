"use client";

import Link from "next/link";

/* ── Section data ── */
const SECTION_GROUPS = [
  {
    id: "manual",
    sections: [
      { id: "introduction", label: "Introduction", path: "/knowledge/commercial-policy/introduction", description: "Purpose, audience, core principles, and how to use this manual.", count: 0, color: "#8E8E93" },
      { id: "business-model", label: "Business Model", path: "/knowledge/commercial-policy/business-model", description: "Channel structure, margin strategy, and how Koleex generates revenue.", count: 2, color: "#007AFF" },
      { id: "pricing-system", label: "Global Pricing", path: "/knowledge/commercial-policy/pricing", description: "Product levels, market bands, customer types, and the pricing formula.", count: 12, color: "#34C759" },
      { id: "commission-system", label: "Commission", path: "/knowledge/commercial-policy/commission", description: "Sales and agent compensation rules, calculations, and scenarios.", count: 9, color: "#FF9500" },
      { id: "credit-system", label: "Customer Credit", path: "/knowledge/commercial-policy/credit", description: "Credit limits, payment terms, customer levels, and risk control.", count: 13, color: "#5856D6" },
      { id: "discount-system", label: "Discounts", path: "/knowledge/commercial-policy/discount", description: "Discount types, approval rules, margin protection, and special pricing.", count: 8, color: "#FF3B30" },
      { id: "agent-system", label: "Agent System", path: "/knowledge/commercial-policy/agents", description: "Agent rights, partner structure, territory protection, and credit.", count: 3, color: "#AF52DE" },
      { id: "case-studies", label: "Case Studies", path: "/knowledge/commercial-policy/case-studies", description: "Real-world examples applying pricing, credit, and approval rules.", count: 0, color: "#FF2D55" },
      { id: "commercial-flow", label: "Commercial Flow", path: "/knowledge/commercial-policy/commercial-flow", description: "End-to-end order flows, decision trees, and process scenarios.", count: 8, color: "#00C7BE" },
      { id: "approval-system", label: "Approval Authority", path: "/knowledge/commercial-policy/approval", description: "Authority levels, escalation paths, and approval workflows.", count: 8, color: "#FFD60A" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    sections: [
      { id: "pricing-engine", label: "Pricing Engine", path: "/knowledge/commercial-policy/tools/pricing-engine", description: "Interactive calculators for pricing, landed cost, and profit analysis.", count: 7, color: "#007AFF" },
      { id: "quick-reference", label: "Quick Reference", path: "/knowledge/commercial-policy/quick-reference", description: "One-page summary of key formulas, limits, and approval thresholds.", count: 0, color: "#8E8E93" },
    ],
  },
  {
    id: "system",
    label: "System",
    sections: [
      { id: "settings", label: "Settings", path: "/knowledge/commercial-policy/settings", description: "Global parameters, default values, and system configuration.", count: 0, color: "#636366" },
      { id: "access-control", label: "Access Control", path: "/knowledge/commercial-policy/access-control", description: "Role-based permissions and data visibility rules.", count: 0, color: "#636366" },
    ],
  },
];

export default function CommercialPolicyLandingPage() {
  return (
    <div className="py-6 md:py-8">
      {/* Hero */}
      <div className="mb-8">
        <h1
          className="text-3xl font-bold tracking-tight md:text-4xl"
          style={{ color: "var(--text-primary)" }}
        >
          Commercial Policy
        </h1>
        <p
          className="mt-2 text-base leading-relaxed md:text-lg max-w-2xl"
          style={{ color: "var(--text-muted)" }}
        >
          Complete commercial operating system covering pricing, margins, discounts, commissions, credit, and approval authority.
        </p>
      </div>

      {/* Section Groups */}
      {SECTION_GROUPS.map((group) => (
        <div key={group.id} className="mb-10">
          {group.label && (
            <p
              className="mb-3 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-ghost)" }}
            >
              {group.label}
            </p>
          )}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.sections.map((section) => (
              <Link
                key={section.id}
                href={section.path}
                className="group rounded-2xl border p-5 transition-all hover:border-[var(--border-focus)] hover:shadow-md"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-secondary)",
                }}
              >
                {/* Color accent */}
                <div
                  className="mb-3 h-1 w-8 rounded-full"
                  style={{ background: section.color }}
                />

                {/* Title */}
                <h3
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {section.label}
                </h3>

                {/* Description */}
                <p
                  className="mt-1.5 text-[12px] leading-relaxed"
                  style={{ color: "var(--text-faint)" }}
                >
                  {section.description}
                </p>

                {/* Footer */}
                <div className="mt-4 flex items-center justify-between text-[11px]">
                  <span style={{ color: "var(--text-dim)" }}>
                    {section.count > 0 ? `${section.count} pages` : "Single page"}
                  </span>
                  <span
                    className="font-semibold transition-colors group-hover:opacity-80"
                    style={{ color: section.color }}
                  >
                    Open →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
