"use client";

/* ---------------------------------------------------------------------------
   Sidebar — global navigation for Koleex Hub.

   Desktop: fixed left column, 60 px collapsed / 220 px expanded.
     · Collapsed: group icons with hover-flyout showing app links.
     · Expanded: collapsible groups with direct app links.
   Mobile:  off-canvas drawer overlay (always expanded-width).

   The sidebar reads the app registry and group config from
   `src/lib/navigation.ts`. Every app belongs to exactly one group.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutGrid,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Home,
} from "lucide-react";
import {
  SIDEBAR_GROUPS,
  getGroupApps,
  getActiveGroupId,
  getActiveAppId,
  type AppDef,
  type SidebarGroup,
} from "@/lib/navigation";
import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";
import {
  useSidebar,
  SIDEBAR_EXPANDED_W,
  SIDEBAR_COLLAPSED_W,
} from "./SidebarContext";

/* ── Theme hook (reads data-theme attribute) ── */
function useTheme() {
  const [dk, setDk] = useState(true);
  useEffect(() => {
    const sync = () =>
      setDk(document.documentElement.getAttribute("data-theme") !== "light");
    sync();
    const h = () => sync();
    window.addEventListener("themechange", h);
    return () => window.removeEventListener("themechange", h);
  }, []);
  return dk;
}

/* ═══════════════════════════════════════════════════
   SIDEBAR COMPONENT
   ═══════════════════════════════════════════════════ */

export default function Sidebar() {
  const dk = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation(hubT);
  const { expanded, toggle, mobileOpen, setMobileOpen } = useSidebar();

  const activeGroupId = getActiveGroupId(pathname);
  const activeAppId = getActiveAppId(pathname);
  const isHome = pathname === "/";

  /* Track which groups are expanded (in expanded sidebar mode) */
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (activeGroupId) initial.add(activeGroupId);
    return initial;
  });

  /* Auto-open the group containing the active app */
  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) => {
        if (prev.has(activeGroupId)) return prev;
        return new Set(prev).add(activeGroupId);
      });
    }
  }, [activeGroupId]);

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* Close mobile drawer on route change */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const w = expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;

  /* Shared styling tokens */
  const bg = dk ? "bg-[#0A0A0A]" : "bg-[#FAFAFA]";
  const border = dk ? "border-white/[0.06]" : "border-black/[0.06]";
  const textPrimary = dk ? "text-white" : "text-black";
  const textMuted = dk ? "text-white/55" : "text-black/55";
  const textGhost = dk ? "text-white/30" : "text-black/30";
  const hoverBg = dk ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.04]";
  const activeBg = dk ? "bg-white/[0.08]" : "bg-black/[0.08]";
  const flyoutBg = dk ? "bg-[#141414]" : "bg-white";
  const flyoutBorder = dk ? "border-white/[0.08]" : "border-black/[0.08]";

  /* ── Render a single app link ── */
  const AppLink = ({ app, compact }: { app: AppDef; compact?: boolean }) => {
    const Icon = app.icon;
    const isActive = activeAppId === app.id;
    const label = t(app.tKey, app.name);
    return (
      <Link
        href={app.active ? app.route : "#"}
        onClick={(e) => {
          if (!app.active) e.preventDefault();
          setMobileOpen(false);
        }}
        className={`flex items-center gap-2.5 rounded-lg transition-all ${
          compact ? "px-2.5 py-1.5" : "px-3 py-2"
        } ${
          isActive
            ? `${activeBg} ${textPrimary} font-semibold`
            : app.active
              ? `${textMuted} ${hoverBg} hover:${dk ? "text-white" : "text-black"}`
              : `${textGhost} cursor-default opacity-40`
        }`}
      >
        <Icon size={compact ? 14 : 16} className="shrink-0" />
        <span className={`text-[12.5px] truncate ${compact ? "text-[12px]" : ""}`}>
          {label}
        </span>
      </Link>
    );
  };

  /* ── Group in expanded mode ── */
  const ExpandedGroup = ({ group }: { group: SidebarGroup }) => {
    const GroupIcon = group.icon;
    const isOpen = openGroups.has(group.id);
    const isGroupActive = activeGroupId === group.id;
    const apps = getGroupApps(group);
    const label = t(group.tKey, group.label);

    return (
      <div>
        <button
          onClick={() => toggleGroup(group.id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-all ${
            isGroupActive
              ? `${textPrimary}`
              : `${textGhost} ${hoverBg} hover:${dk ? "text-white/50" : "text-black/50"}`
          }`}
        >
          <GroupIcon size={16} className={isGroupActive ? (dk ? "text-white/70" : "text-black/70") : ""} />
          <span className="flex-1 text-start truncate">{label}</span>
          <ChevronRight
            size={12}
            className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""} ${isGroupActive ? (dk ? "text-white/40" : "text-black/40") : ""}`}
          />
        </button>
        {isOpen && (
          <div className="ps-4 mt-0.5 mb-1 space-y-0.5">
            {apps.map((app) => (
              <AppLink key={app.id} app={app} />
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ── Group in collapsed mode (icon + hover flyout) ── */
  const CollapsedGroup = ({ group }: { group: SidebarGroup }) => {
    const GroupIcon = group.icon;
    const isGroupActive = activeGroupId === group.id;
    const apps = getGroupApps(group);
    const label = t(group.tKey, group.label);

    return (
      <div className="relative group/fly">
        <button
          className={`w-full flex items-center justify-center h-10 rounded-lg transition-all ${
            isGroupActive
              ? `${activeBg} ${textPrimary}`
              : `${textGhost} ${hoverBg} hover:${dk ? "text-white/60" : "text-black/60"}`
          }`}
          aria-label={label}
        >
          <GroupIcon size={18} />
        </button>

        {/* Flyout */}
        <div className="hidden group-hover/fly:block absolute top-0 start-full z-[60] ps-2">
          <div
            className={`${flyoutBg} border ${flyoutBorder} rounded-xl shadow-2xl w-[200px] py-2 px-2`}
          >
            <div className={`text-[10px] font-bold uppercase tracking-wider ${textGhost} px-2.5 py-1.5`}>
              {label}
            </div>
            <div className="space-y-0.5">
              {apps.map((app) => (
                <AppLink key={app.id} app={app} compact />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── Sidebar inner content (shared by desktop + mobile) ── */
  const SidebarContent = ({ mobile }: { mobile?: boolean }) => {
    const showExpanded = mobile || expanded;
    return (
      <div className="flex flex-col h-full">
        {/* All Apps button */}
        <div className={`p-2 ${showExpanded ? "px-3" : ""}`}>
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 rounded-lg transition-all ${
              showExpanded ? "px-3 py-2.5" : "justify-center py-2.5"
            } ${
              isHome
                ? `${activeBg} ${textPrimary} font-semibold`
                : `${textMuted} ${hoverBg} hover:${dk ? "text-white" : "text-black"}`
            }`}
          >
            <LayoutGrid size={18} className="shrink-0" />
            {showExpanded && <span className="text-[13px] font-semibold">All Apps</span>}
          </Link>
        </div>

        {/* Divider */}
        <div className={`mx-3 border-b ${border} mb-1`} />

        {/* Groups */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${showExpanded ? "px-3 py-1 space-y-0.5" : "px-2 py-1 space-y-0.5"}`}>
          {SIDEBAR_GROUPS.map((group) =>
            showExpanded ? (
              <ExpandedGroup key={group.id} group={group} />
            ) : (
              <CollapsedGroup key={group.id} group={group} />
            ),
          )}
        </nav>

        {/* Footer */}
        <div className={`border-t ${border} p-3 flex items-center ${showExpanded ? "justify-between" : "justify-center"}`}>
          {showExpanded && (
            <span className={`text-[10px] font-medium ${textGhost}`}>
              Platform v2.4
            </span>
          )}
          {!mobile && (
            <button
              onClick={toggle}
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
              className={`p-1.5 rounded-md transition-all ${textGhost} ${hoverBg} hover:${dk ? "text-white/60" : "text-black/60"}`}
            >
              {expanded ? <ChevronsLeft size={14} /> : <ChevronsRight size={14} />}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ── Desktop sidebar (fixed) ── */}
      <aside
        className={`hidden md:flex flex-col fixed top-14 bottom-0 start-0 z-40 ${bg} border-e ${border} transition-all duration-200`}
        style={{ width: w }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile drawer + backdrop ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`md:hidden fixed top-14 bottom-0 start-0 z-50 ${bg} border-e ${border} transition-transform duration-200 ${
          mobileOpen ? "translate-x-0 rtl:-translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
        style={{ width: SIDEBAR_EXPANDED_W }}
      >
        <SidebarContent mobile />
      </aside>
    </>
  );
}
