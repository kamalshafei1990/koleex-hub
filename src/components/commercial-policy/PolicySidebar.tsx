"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import { POLICY_NAV, type PolicyNavItem } from "@/lib/commercial-policy/navigation";

/* ── Section labels ── */
const SECTIONS: { id: string; label: string }[] = [
  { id: "manual", label: "Manual" },
  { id: "tools", label: "Tools" },
  { id: "system", label: "System" },
];

function NavGroup({ item, pathname, onNavigate }: { item: PolicyNavItem; pathname: string; onNavigate?: () => void }) {
  const isActive = pathname === item.path;
  const hasChildren = !!item.children?.length;
  const childActive = hasChildren && item.children!.some((c) => pathname === c.path);
  const [open, setOpen] = useState(isActive || childActive);

  useEffect(() => {
    if (isActive || childActive) setOpen(true);
  }, [isActive, childActive]);

  if (!hasChildren) {
    return (
      <Link
        href={item.path}
        onClick={onNavigate}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors"
        style={{
          color: isActive ? "var(--text-primary)" : "var(--text-muted)",
          background: isActive ? "var(--bg-surface)" : "transparent",
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[13px] transition-colors hover:bg-[var(--bg-surface-hover)]"
        style={{
          color: isActive || childActive ? "var(--text-primary)" : "var(--text-muted)",
          fontWeight: isActive || childActive ? 600 : 400,
        }}
      >
        <Link href={item.path} onClick={(e) => { e.stopPropagation(); onNavigate?.(); }} className="flex-1 text-left">
          {item.label}
        </Link>
        {open ? <AngleDownIcon size={12} /> : <AngleRightIcon size={12} />}
      </button>

      {open && (
        <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l" style={{ borderColor: "var(--border-subtle)" }}>
          {item.children!.map((child) => {
            const active = pathname === child.path;
            return (
              <Link
                key={child.id}
                href={child.path}
                onClick={onNavigate}
                className="rounded-lg px-3 py-1 text-[12px] transition-colors"
                style={{
                  color: active ? "var(--text-primary)" : "var(--text-faint)",
                  background: active ? "var(--bg-surface)" : "transparent",
                  fontWeight: active ? 600 : 400,
                  marginLeft: 8,
                }}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Shared nav content ── */
function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const grouped = SECTIONS.map((sec) => ({
    ...sec,
    items: POLICY_NAV.filter((n) => (n.section || "manual") === sec.id),
  }));

  return (
    <div className="flex flex-col gap-1 p-3">
      {/* Back to Knowledge */}
      <Link
        href="/knowledge"
        onClick={onNavigate}
        className="flex items-center gap-2 rounded-lg px-3 py-2 mb-1 text-[12px] font-medium transition-colors hover:bg-[var(--bg-surface-hover)]"
        style={{ color: "var(--text-dim)" }}
      >
        <AngleRightIcon size={10} className="rotate-180" />
        Knowledge
      </Link>
      <div className="px-3 pb-2">
        <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Commercial Policy</p>
      </div>

      {grouped.map((sec) => (
        <div key={sec.id}>
          {sec.id !== "manual" && (
            <p
              className="mt-4 px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-ghost)" }}
            >
              {sec.label}
            </p>
          )}
          {sec.items.map((item) => (
            <NavGroup key={item.id} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Main export ── */
export default function PolicySidebar({ mobileOpen, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname();

  /* close mobile drawer on route change */
  useEffect(() => {
    onMobileClose?.();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="sticky top-14 hidden h-[calc(100vh-56px)] w-[240px] shrink-0 overflow-y-auto border-r lg:block"
        style={{
          borderColor: "var(--border-subtle)",
          background: "var(--bg-primary)",
        }}
      >
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <aside
            className="fixed left-0 top-14 z-50 h-[calc(100vh-56px)] w-[280px] overflow-y-auto border-r lg:hidden"
            style={{
              borderColor: "var(--border-subtle)",
              background: "var(--bg-primary)",
            }}
          >
            <SidebarContent pathname={pathname} onNavigate={onMobileClose} />
          </aside>
        </>
      )}
    </>
  );
}
