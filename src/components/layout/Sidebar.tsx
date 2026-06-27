"use client";

/* ---------------------------------------------------------------------------
   Sidebar — global navigation for Koleex Hub (production-level).

   Desktop: fixed left column, 60 px collapsed / 220 px expanded.
     · Collapsed: group icons with tooltip labels + hover flyout.
     · Expanded: collapsible groups with direct app links.
   Mobile:  off-canvas drawer overlay (always expanded-width).

   Toggle: a floating circular button on the sidebar right edge,
   vertically centered. 36 px, always visible, glow on hover.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
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
import { usePermittedModules } from "@/lib/use-scope";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import {
  useSidebar,
  SIDEBAR_EXPANDED_W,
  SIDEBAR_COLLAPSED_W,
} from "./SidebarContext";

/* ── Theme hook ── */
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
  const { t } = useTranslation(hubT);
  const { expanded, toggle, mobileOpen, setMobileOpen } = useSidebar();

  // Role-based filtering: hide apps the viewer's role has no can_view on.
  // Super Admin sees everything. While the permission check is
  // loading we show NO apps (fail-closed) so a user never sees modules
  // they aren't allowed to — even briefly on first paint. The sidebar
  // stays empty for a few hundred ms instead.
  const { modules: permittedModules, loading: permLoading } =
    usePermittedModules();
  const { data: meBoot } = useMeBootstrap();
  const isSuperAdmin = !!meBoot?.isSuperAdmin;

  const filterApps = useCallback(
    (apps: AppDef[]): AppDef[] => {
      if (permLoading) return [];
      return apps.filter((a) =>
        // Super-Admin-only apps (e.g. Activity Monitor) gate on the SA flag.
        a.superAdminOnly ? isSuperAdmin : permittedModules.has(a.name),
      );
    },
    [permLoading, permittedModules, isSuperAdmin],
  );

  const activeGroupId = getActiveGroupId(pathname);
  const activeAppId = getActiveAppId(pathname);

  /* Home ("/") is the launcher — it already shows every app grouped by
     category, so the desktop rail there is redundant. Hide the persistent
     rail on home; inner routes keep it. (Mobile drawer is on-demand, so it
     stays available everywhere via the header menu button.) */
  const isHome = pathname === "/";

  /* Track which groups are open (expanded mode) */
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (activeGroupId) initial.add(activeGroupId);
    return initial;
  });

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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const w = expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;

  /* ── Tokens ── */
  const bg = dk ? "bg-[#0A0A0A]" : "bg-[#FAFAFA]";
  const border = dk ? "border-white/[0.06]" : "border-black/[0.06]";
  const textPrimary = dk ? "text-white" : "text-black";
  const textMuted = dk ? "text-white/50" : "text-black/50";
  const textGhost = dk ? "text-white/25" : "text-black/25";
  const hoverBg = dk ? "hover:bg-white/[0.05]" : "hover:bg-black/[0.05]";
  const flyoutBg = dk ? "bg-[#141414]" : "bg-white";
  const flyoutBorder = dk ? "border-white/[0.08]" : "border-black/[0.08]";

  /* ── App link (expanded or flyout) ── */
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
        /* Phase UI.4 — sidebar refinement.
           Active state painted with a thin 2px left-edge accent rule
           + full-opacity ink, NOT a background fill. Icon sizes
           dropped from 14/17 → 13/15 so the row reads as Apple-thin
           SF Symbols rather than the heavier uicons regular. */
        className={`relative flex items-center gap-2.5 rounded-md transition-colors duration-150 ${
          compact ? "px-2.5 py-1.5" : "px-3 py-2"
        } ${
          isActive
            ? dk
              ? "text-white/95 font-medium"
              : "text-black/95 font-medium"
            : app.active
              ? `${textMuted} ${hoverBg} hover:${dk ? "text-white/80" : "text-black/80"}`
              : `${textGhost} cursor-default opacity-30`
        }`}
      >
        {/* Active accent rail — 2px left-edge mark, calmer than a
            background fill and lets the icon weight do the work. */}
        {isActive && (
          <span aria-hidden className={`pointer-events-none absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-r ${dk ? "bg-white/55" : "bg-black/60"}`} />
        )}
        <Icon size={compact ? 13 : 15} className="shrink-0" />
        <span className={`text-[13px] truncate ${compact ? "text-[12px]" : ""}`}>
          {label}
        </span>
      </Link>
    );
  };

  /* ── Expanded group ── */
  const ExpandedGroup = ({ group }: { group: SidebarGroup }) => {
    const GroupIcon = group.icon;
    const isOpen = openGroups.has(group.id);
    const isGroupActive = activeGroupId === group.id;
    const apps = filterApps(getGroupApps(group));
    if (apps.length === 0) return null;
    const label = t(group.tKey, group.label);

    return (
      <div>
        <button
          onClick={() => toggleGroup(group.id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] font-semibold uppercase tracking-wider transition-all duration-150 ${
            isGroupActive
              ? dk
                ? "text-white/90"
                : "text-black/90"
              : `${textGhost} ${hoverBg} hover:${dk ? "text-white/50" : "text-black/50"}`
          }`}
        >
          <GroupIcon
            size={15}
            className={
              isGroupActive
                ? dk
                  ? "text-white/70"
                  : "text-black/70"
                : ""
            }
          />
          <span className="flex-1 text-start truncate">{label}</span>
          <AngleRightIcon
            size={12}
            className={`transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`}
          />
        </button>
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="ps-4 mt-0.5 mb-1 space-y-0.5">
            {apps.map((app) => (
              <AppLink key={app.id} app={app} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* ── Collapsed group (icon + tooltip + flyout) ── */
  const CollapsedGroup = ({ group }: { group: SidebarGroup }) => {
    const GroupIcon = group.icon;
    const isGroupActive = activeGroupId === group.id;
    const apps = filterApps(getGroupApps(group));
    if (apps.length === 0) return null;
    const label = t(group.tKey, group.label);
    const hasActiveChild = apps.some((a) => a.id === activeAppId);

    return (
      <div className="relative group/fly">
        <button
          className={`w-full flex items-center justify-center h-11 rounded-md transition-colors duration-150 relative ${
            isGroupActive || hasActiveChild
              ? dk
                ? "text-white/90"
                : "text-black/90"
              : dk
                ? "text-white/35 hover:text-white/65"
                : "text-black/35 hover:text-black/65"
          }`}
          aria-label={label}
        >
          {/* Active accent rail for collapsed sidebar. */}
          {(isGroupActive || hasActiveChild) && (
            <span aria-hidden className={`pointer-events-none absolute top-2 bottom-2 left-0 w-[2px] rounded-r ${dk ? "bg-white/55" : "bg-black/60"}`} />
          )}
          <GroupIcon size={16} />
        </button>

        {/* Tooltip (shows group name on hover) */}
        <div
          className="hidden group-hover/fly:block absolute top-1/2 -translate-y-1/2 z-[60] pointer-events-none"
          style={{ insetInlineStart: "calc(100% + 14px)" }}
        >
          <div
            className={`${flyoutBg} border ${flyoutBorder} rounded-lg shadow-xl px-3 py-1.5 whitespace-nowrap`}
          >
            <span className={`text-[11px] font-semibold ${dk ? "text-white/80" : "text-black/80"}`}>
              {label}
            </span>
          </div>
        </div>

        {/* Flyout with apps */}
        <div className="hidden group-hover/fly:block absolute top-0 start-full z-[60] ps-3">
          <div
            className={`${flyoutBg} border ${flyoutBorder} rounded-xl shadow-2xl w-[200px] py-2 px-2`}
          >
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${textGhost} px-2.5 py-1.5`}
            >
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

  /* ── Collapse toggle — a dimensional "bead on the seam".
     Vertically centered on the rail's inner right edge (fully inside the
     border). A subtle top-lit gradient capsule with an inner highlight and
     a soft lift shadow reads as a tactile, engineered control rather than a
     pasted-on flat pill. Two grip ticks frame the directional chevron,
     which brightens + nudges on hover. A tooltip clarifies the action.
     Brand: strictly monochrome, no color. */
  const EdgeToggle = () => (
    <div className="group/toggle relative">
      <button
        onClick={toggle}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        className="relative flex items-center justify-center w-[20px] h-[52px] rounded-full cursor-pointer transition-all duration-200 active:scale-90 hover:h-[58px]"
        style={{
          background: dk
            ? "linear-gradient(180deg,#262626 0%,#141414 100%)"
            : "linear-gradient(180deg,#ffffff 0%,#ededed 100%)",
          border: dk ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)",
          boxShadow: dk
            ? "inset 0 1px 0 rgba(255,255,255,0.07), 0 3px 10px rgba(0,0,0,0.5)"
            : "inset 0 1px 0 rgba(255,255,255,0.9), 0 3px 10px rgba(0,0,0,0.10)",
        }}
      >
        {/* upper grip tick */}
        <span
          aria-hidden
          className={`absolute top-[9px] left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full transition-colors duration-200 ${
            dk ? "bg-white/15 group-hover/toggle:bg-white/35" : "bg-black/15 group-hover/toggle:bg-black/35"
          }`}
        />
        <AngleRightIcon
          size={12}
          className={`transition-all duration-300 ${expanded ? "rotate-180" : ""} ${
            dk ? "text-white/50 group-hover/toggle:text-white" : "text-black/45 group-hover/toggle:text-black"
          } group-hover/toggle:scale-110`}
        />
        {/* lower grip tick */}
        <span
          aria-hidden
          className={`absolute bottom-[9px] left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full transition-colors duration-200 ${
            dk ? "bg-white/15 group-hover/toggle:bg-white/35" : "bg-black/15 group-hover/toggle:bg-black/35"
          }`}
        />
      </button>

      {/* Tooltip — appears on the inner side so it never overflows the edge. */}
      <div
        className="hidden group-hover/toggle:block absolute top-1/2 -translate-y-1/2 z-[60] pointer-events-none"
        style={{ insetInlineEnd: "calc(100% + 10px)" }}
      >
        <div className={`${flyoutBg} border ${flyoutBorder} rounded-lg shadow-xl px-2.5 py-1 whitespace-nowrap`}>
          <span className={`text-[10.5px] font-semibold ${dk ? "text-white/80" : "text-black/80"}`}>
            {expanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </div>
    </div>
  );

  /* ── Sidebar content ── */
  const SidebarContent = ({ mobile }: { mobile?: boolean }) => {
    const showExpanded = mobile || expanded;
    return (
      <div className="flex flex-col h-full">
        <div className="h-2" />
        <nav
          className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-none ${
            showExpanded ? "px-3 py-1 space-y-0.5" : "px-2 py-1.5 space-y-1.5"
          }`}
        >
          {SIDEBAR_GROUPS.map((group) =>
            showExpanded ? (
              <ExpandedGroup key={group.id} group={group} />
            ) : (
              <CollapsedGroup key={group.id} group={group} />
            ),
          )}
        </nav>
        {/* Footer — quiet brand mark in the expanded state. */}
        <div className="p-3 flex items-center justify-center">
          {showExpanded && (
            <span className={`text-[9px] font-semibold uppercase tracking-[0.22em] ${textGhost}`}>
              KOLEEX HUB
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ── Desktop sidebar (hidden on the home launcher) ── */}
      {!isHome && (
        <aside
          className={`hidden md:flex flex-col fixed top-14 bottom-0 start-0 z-40 ${bg} border-e ${border} transition-all duration-300 ease-in-out`}
          style={{ width: w }}
        >
          <SidebarContent />

          {/* Collapse handle — vertically centered, tucked just inside the
              rail's right edge (does not cross the border). */}
          <div
            className="absolute top-1/2 -translate-y-1/2 z-50"
            style={{ insetInlineEnd: "5px" }}
          >
            <EdgeToggle />
          </div>
        </aside>
      )}

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={`md:hidden fixed top-14 bottom-0 start-0 z-50 ${bg} border-e ${border} transition-transform duration-300 ease-in-out ${
          mobileOpen
            ? "translate-x-0 rtl:-translate-x-0"
            : "-translate-x-full rtl:translate-x-full"
        }`}
        style={{ width: SIDEBAR_EXPANDED_W }}
      >
        <SidebarContent mobile />
      </aside>
    </>
  );
}
