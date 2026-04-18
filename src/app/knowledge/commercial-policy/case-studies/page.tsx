"use client";

import { useState } from "react";
import PolicyPage, {
  Section,
  SectionDesc,
  Callout,
  Badge,
} from "@/components/commercial-policy/PolicyPage";

/* ===== Case Studies Data (from mock-data) ===== */
const CASE_STUDIES = [
  {
    id: "cs-001",
    title: "Unauthorized Discount Escalation",
    category: "Pricing",
    scenario:
      "A sales representative offered a 25% discount to a new customer without following the approval workflow.",
    outcome:
      "The discount was flagged during review and the order was delayed by 2 weeks.",
    correctAction:
      "Discounts above the standard threshold must go through the multi-level approval process before being communicated to the customer.",
    tags: ["pricing", "discount", "approval"],
    color: "#FF9500",
  },
  {
    id: "cs-002",
    title: "Credit Limit Breach",
    category: "Credit",
    scenario:
      "A dealer placed a large order that exceeded their credit limit without prior arrangement.",
    outcome:
      "Order was held, causing delivery delays and partner dissatisfaction.",
    correctAction:
      "Sales should verify credit standing before accepting orders above standard levels. Credit limit increases require documented approval.",
    tags: ["credit", "risk", "dealer"],
    color: "#FF3B30",
  },
  {
    id: "cs-003",
    title: "Territory Conflict Resolution",
    category: "Agent",
    scenario:
      "Two agents claimed the same customer in an overlapping market area.",
    outcome:
      "After review, the first-registered agent was confirmed. Clear territory documentation prevented future disputes.",
    correctAction:
      "All territory assignments must be documented and verified in the system. Conflicts should be escalated to the regional manager.",
    tags: ["agent", "territory", "conflict"],
    color: "#007AFF",
  },
  {
    id: "cs-004",
    title: "Partner Tier Upgrade Success",
    category: "Partner",
    scenario:
      "A dealer consistently exceeded performance targets over 4 consecutive quarters.",
    outcome:
      "The dealer was upgraded to a higher partner tier with improved commercial conditions.",
    correctAction:
      "Performance reviews should be conducted quarterly. Tier upgrades follow the documented criteria in the Partner System.",
    tags: ["partner", "performance", "upgrade"],
    color: "#34C759",
  },
];

const CATEGORIES = ["All", "Pricing", "Credit", "Agent", "Partner"];

export default function CaseStudiesPage() {
  const [filter, setFilter] = useState("All");
  const filtered =
    filter === "All"
      ? CASE_STUDIES
      : CASE_STUDIES.filter((s) => s.category === filter);

  return (
    <PolicyPage
      title="Case Studies."
      subtitle="Real-world scenarios and decision examples to guide commercial policy application."
      badge="Case Studies"
    >
      {/* Filter Tabs */}
      <Section>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all"
              style={{
                background:
                  filter === cat ? "var(--bg-inverted)" : "var(--bg-surface)",
                color:
                  filter === cat ? "var(--text-inverted)" : "var(--text-muted)",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </Section>

      {/* Case Study Cards */}
      <Section>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {filtered.map((study) => (
            <div
              key={study.id}
              className="rounded-xl border p-6"
              style={{
                borderColor: "var(--border-subtle)",
                background: "var(--bg-card)",
              }}
            >
              {/* Header */}
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <Badge label={study.category} color={study.color} />
                  <h3
                    className="mt-2 text-[15px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {study.title}
                  </h3>
                </div>
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--text-ghost)" }}
                >
                  {study.id.toUpperCase()}
                </span>
              </div>

              {/* Scenario */}
              <div className="mb-3">
                <p
                  className="mb-1 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-dim)" }}
                >
                  Scenario
                </p>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {study.scenario}
                </p>
              </div>

              {/* Outcome */}
              <div className="mb-3">
                <p
                  className="mb-1 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-dim)" }}
                >
                  Outcome
                </p>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {study.outcome}
                </p>
              </div>

              {/* Correct Action */}
              <div
                className="rounded-lg p-3"
                style={{ background: "var(--bg-surface-subtle)" }}
              >
                <p
                  className="mb-1 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: study.color }}
                >
                  Correct Action
                </p>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {study.correctAction}
                </p>
              </div>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {study.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--text-faint)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Callout title="Illustrative Examples">
        Case studies shown are illustrative examples designed to demonstrate
        correct policy application. Details may not reflect actual events.
      </Callout>
    </PolicyPage>
  );
}
