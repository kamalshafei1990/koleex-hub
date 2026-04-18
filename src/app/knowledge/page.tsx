"use client";

import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import KnowledgeIcon from "@/components/icons/KnowledgeIcon";
import CommercialPolicyIcon from "@/components/icons/CommercialPolicyIcon";

const knowledgeBases = [
  {
    id: "commercial-policy",
    title: "Commercial Policy",
    description: "Complete commercial system covering pricing, margins, discounts, commissions, credit, and approval authority.",
    icon: CommercialPolicyIcon,
    href: "/knowledge/commercial-policy",
    pages: 75,
    sections: ["Pricing", "Commission", "Credit", "Discount", "Approval", "Tools"],
    color: "#007AFF",
  },
];

export default function KnowledgePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header — matches Hub pattern */}
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link
            href="/"
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              <KnowledgeIcon size={16} />
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
              Knowledge
            </h1>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-dim)] mb-6 md:mb-8 ml-0 md:ml-11">
          Company policies, manuals, and reference documentation
        </p>

        {/* Knowledge Base Cards */}
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {knowledgeBases.map((kb) => {
            const Icon = kb.icon;
            return (
              <Link
                key={kb.id}
                href={kb.href}
                className="group rounded-2xl border p-6 transition-all hover:border-[var(--border-focus)] hover:shadow-lg"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-secondary)",
                }}
              >
                {/* Icon */}
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)]"
                  style={{ background: `${kb.color}12` }}
                >
                  <Icon size={20} className="transition-transform group-hover:scale-110" />
                </div>

                {/* Title & Description */}
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {kb.title}
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-faint)]">
                  {kb.description}
                </p>

                {/* Tags */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {kb.sections.map((s) => (
                    <span
                      key={s}
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border border-[var(--border-faint)]"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                {/* Footer */}
                <div className="mt-5 flex items-center justify-between border-t border-[var(--border-faint)] pt-4 text-[12px]">
                  <span className="text-[var(--text-dim)]">{kb.pages} pages</span>
                  <span
                    className="font-semibold transition-colors group-hover:opacity-80"
                    style={{ color: kb.color }}
                  >
                    Open →
                  </span>
                </div>
              </Link>
            );
          })}

          {/* Placeholder card for future additions */}
          <div
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center"
            style={{ borderColor: "var(--border-faint)" }}
          >
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl text-xl bg-[var(--bg-surface)] text-[var(--text-ghost)]">
              +
            </div>
            <p className="text-[13px] font-medium text-[var(--text-ghost)]">
              More coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
