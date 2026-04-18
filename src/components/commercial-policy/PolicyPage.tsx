"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import { getAdjacentPages } from "@/lib/commercial-policy/navigation";

interface PolicyPageProps {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
}

export default function PolicyPage({ title, subtitle, badge, children }: PolicyPageProps) {
  const pathname = usePathname();
  const { prev, next } = getAdjacentPages(pathname);

  return (
    <div className="max-w-4xl py-6 md:py-8">
      {/* Header */}
      <header className="mb-10">
        {badge && (
          <span
            className="mb-3 inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}
          >
            {badge}
          </span>
        )}
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-base leading-relaxed md:text-lg" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </header>

      {/* Content */}
      <div className="flex flex-col gap-12">{children}</div>

      {/* Bottom navigation */}
      {(prev || next) && (
        <nav
          className="mt-16 flex items-center justify-between border-t pt-6"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {prev ? (
            <Link
              href={prev.path}
              className="flex items-center gap-2 text-[13px] transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              <ArrowLeftIcon size={14} />
              {prev.label}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={next.path}
              className="flex items-center gap-2 text-[13px] transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              {next.label}
              <ArrowRightIcon size={14} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

/* ── Reusable Section Components ── */

export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && (
        <h2 className="mb-4 text-xl font-semibold tracking-tight md:text-2xl" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function SectionDesc({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[14px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

export function CardGrid({ cols = 3, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  const colClass =
    cols === 2
      ? "grid-cols-1 md:grid-cols-2"
      : cols === 4
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return <div className={`grid gap-4 ${colClass}`}>{children}</div>;
}

export function InfoCard({
  title,
  value,
  description,
  color,
  children,
}: {
  title: string;
  value?: string;
  description?: string;
  color?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-5 transition-colors"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
    >
      {color && <div className="mb-3 h-1 w-8 rounded-full" style={{ background: color }} />}
      <h3 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {value && (
        <p className="mt-1 text-2xl font-bold" style={{ color: color || "var(--text-primary)" }}>
          {value}
        </p>
      )}
      {description && (
        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

export function DataTable({
  headers,
  rows,
}: {
  headers: (string | React.ReactNode)[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border-subtle)" }}>
      <table className="w-full text-[13px]">
        <thead>
          <tr style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border-faint)" }}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StepFlow({ steps }: { steps: { label: string; description?: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-4">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
            style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}
          >
            {i + 1}
          </div>
          <div className="pt-0.5">
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {step.label}
            </p>
            {step.description && (
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-faint)" }}>
                {step.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{
        background: color ? `${color}18` : "var(--bg-surface)",
        color: color || "var(--text-muted)",
      }}
    >
      {label}
    </span>
  );
}

export function RuleList({ rules }: { rules: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rules.map((rule, i) => (
        <li key={i} className="flex items-start gap-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
          <span
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: "var(--text-dim)" }}
          />
          {rule}
        </li>
      ))}
    </ul>
  );
}

export function Callout({ title, children, color }: { title?: string; children: React.ReactNode; color?: string }) {
  return (
    <div
      className="rounded-xl border-l-4 p-5"
      style={{
        borderColor: color || "var(--text-dim)",
        background: "var(--bg-surface-subtle)",
      }}
    >
      {title && (
        <p className="mb-1 text-[13px] font-semibold" style={{ color: color || "var(--text-primary)" }}>
          {title}
        </p>
      )}
      <div className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {children}
      </div>
    </div>
  );
}
