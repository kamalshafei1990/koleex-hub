"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import CommercialPolicyIcon from "@/components/icons/CommercialPolicyIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import { POLICY_NAV } from "@/lib/commercial-policy/navigation";

/* ── Build breadcrumb from pathname ── */
function getBreadcrumbs(pathname: string) {
  if (pathname === "/knowledge/commercial-policy") return [];

  for (const item of POLICY_NAV) {
    if (pathname === item.path) {
      return [{ label: item.label, path: item.path, current: true }];
    }
    if (item.children) {
      const child = item.children.find((c) => c.path === pathname);
      if (child) {
        return [
          { label: item.label, path: item.path, current: false },
          { label: child.label, path: child.path, current: true },
        ];
      }
    }
  }
  return [];
}

export default function CommercialPolicyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);
  const isLanding = pathname === "/knowledge/commercial-policy";

  return (
    <div className="flex flex-col h-full min-h-0 flex-1 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* ── Header ── */}
      <div className="shrink-0" style={{ background: "var(--bg-primary)" }}>
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3 pt-5 pb-2">
            <Link
              href={isLanding ? "/knowledge" : "/knowledge/commercial-policy"}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                <CommercialPolicyIcon size={16} />
              </div>
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
                Commercial Policy
              </h1>
            </div>
          </div>

          {/* Breadcrumb */}
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1.5 pb-3 ml-[44px] text-[12px] overflow-x-auto">
              <Link
                href="/knowledge/commercial-policy"
                className="shrink-0 transition-colors hover:opacity-80"
                style={{ color: "var(--text-dim)" }}
              >
                Overview
              </Link>
              {breadcrumbs.map((crumb) => (
                <span key={crumb.path} className="flex items-center gap-1.5 shrink-0">
                  <AngleRightIcon size={8} style={{ color: "var(--text-ghost)" }} />
                  {crumb.current ? (
                    <span style={{ color: "var(--text-muted)" }}>{crumb.label}</span>
                  ) : (
                    <Link
                      href={crumb.path}
                      className="transition-colors hover:opacity-80"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {crumb.label}
                    </Link>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bottom border */}
        <div className="border-b" style={{ borderColor: "var(--border-subtle)" }} />
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
