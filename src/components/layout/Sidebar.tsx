"use client";

/* ---------------------------------------------------------------------------
   Sidebar — global navigation for Koleex Hub (production-level).

   Desktop: fixed left column, 60 px collapsed / 220 px expanded.
     · Collapsed: group icons with tooltip labels + hover flyout.
     · Expanded: collapsible groups with direct app links.
   Mobile:  off-canvas drawer overlay (always expanded-width).

   The presentational pieces (AppLink, ExpandedGroup, CollapsedGroup,
   EdgeToggle, SidebarContent) live at MODULE scope and take props. Defining
   them inside the Sidebar function would give them a new identity on every
   render, forcing React to unmount/remount the whole nav subtree (losing
   flyout/hover/focus state and restarting transitions). Hoisting them out
   keeps the tree stable.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import AppLaunchLink from "@/components/layout/AppLaunchLink";
import { useAppBadges } from "@/lib/app-badges";
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

type TFn = ReturnType<typeof useTranslation>["t"];

/* Precomputed per-group data handed to the presentational layer. */
type GroupView = {
  group: SidebarGroup;
  apps: AppDef[];
  isOpen: boolean;
  isGroupActive: boolean;
};

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

/* ── App link (expanded list or collapsed flyout) ── */
function AppLink({
  app,
  compact,
  dk,
  t,
  isActive,
  onNavigate,
}: {
  app: AppDef;
  compact?: boolean;
  dk: boolean;
  t: TFn;
  isActive: boolean;
  onNavigate: () => void;
}) {
  const Icon = app.icon;
  const label = t(app.tKey, app.name);
  const appBadges = useAppBadges();
  const badgeCount = appBadges[app.id] ?? 0;
  const textMuted = dk ? "text-white/50" : "text-black/50";
  const hoverBg = dk ? "hover:bg-white/[0.05]" : "hover:bg-black/[0.05]";

  return (
    <AppLaunchLink
      app={app}
      aria-current={isActive ? "page" : undefined}
      onNavigate={onNavigate}
      /* Active state: a soft rounded background + the 2px left-edge accent
         rail + full-opacity ink, so the current row is easy to spot. */
      className={`relative flex items-center gap-2.5 rounded-md transition-colors duration-150 ${
        compact ? "px-2.5 py-1.5" : "px-3 py-2"
      } ${
        isActive
          ? dk
            ? "bg-white/[0.055] text-white/95 font-medium"
            : "bg-black/[0.045] text-black/95 font-medium"
          : `${textMuted} ${hoverBg} hover:${dk ? "text-white/80" : "text-black/80"}`
      }`}
    >
      {isActive && (
        <span
          aria-hidden
          className={`pointer-events-none absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-r ${dk ? "bg-white/55" : "bg-black/60"}`}
        />
      )}
      <Icon size={compact ? 13 : 15} className="shrink-0" />
      <span className={`text-[13px] truncate ${compact ? "text-[12px]" : ""}`}>
        {label}
      </span>
      {badgeCount > 0 && (
        <span className="ms-auto shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-[#FF3333] text-white text-[9.5px] font-bold flex items-center justify-center">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </AppLaunchLink>
  );
}

/* ── Expanded group (header + collapsible app list) ── */
function ExpandedGroup({
  group,
  apps,
  isOpen,
  isGroupActive,
  dk,
  t,
  activeAppId,
  onToggleGroup,
  onNavigate,
}: {
  group: SidebarGroup;
  apps: AppDef[];
  isOpen: boolean;
  isGroupActive: boolean;
  dk: boolean;
  t: TFn;
  activeAppId: string | null;
  onToggleGroup: (id: string) => void;
  onNavigate: () => void;
}) {
  const GroupIcon = group.icon;
  const label = t(group.tKey, group.label);
  const hoverBg = dk ? "hover:bg-white/[0.05]" : "hover:bg-black/[0.05]";

  return (
    <div>
      <button
        onClick={() => onToggleGroup(group.id)}
        aria-expanded={isOpen}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] font-semibold uppercase tracking-wider transition-all duration-150 ${
          isGroupActive
            ? dk
              ? "text-white/90"
              : "text-black/90"
            : `${dk ? "text-white/40" : "text-black/45"} ${hoverBg} hover:${dk ? "text-white/70" : "text-black/70"}`
        }`}
      >
        <GroupIcon
          size={15}
          className={isGroupActive ? (dk ? "text-white/70" : "text-black/70") : ""}
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
        <div className={`ms-[19px] ps-3 mt-0.5 mb-1 space-y-0.5 border-s ${dk ? "border-white/[0.07]" : "border-black/[0.07]"}`}>
          {apps.map((app) => (
            <AppLink
              key={app.id}
              app={app}
              dk={dk}
              t={t}
              isActive={activeAppId === app.id}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Collapsed group (icon + tooltip + hover/focus flyout) ── */
function CollapsedGroup({
  group,
  apps,
  isGroupActive,
  dk,
  t,
  activeAppId,
  onNavigate,
}: {
  group: SidebarGroup;
  apps: AppDef[];
  isGroupActive: boolean;
  dk: boolean;
  t: TFn;
  activeAppId: string | null;
  onNavigate: () => void;
}) {
  const GroupIcon = group.icon;
  const label = t(group.tKey, group.label);
  const hasActiveChild = apps.some((a) => a.id === activeAppId);
  const flyoutBg = dk ? "bg-[#141414]" : "bg-white";
  const flyoutBorder = dk ? "border-white/[0.08]" : "border-black/[0.08]";
  const textGhost = dk ? "text-white/25" : "text-black/25";

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
        {(isGroupActive || hasActiveChild) && (
          <span
            aria-hidden
            className={`pointer-events-none absolute top-2 bottom-2 left-0 w-[2px] rounded-r ${dk ? "bg-white/55" : "bg-black/60"}`}
          />
        )}
        <GroupIcon size={16} />
      </button>

      {/* Tooltip (group name on hover / keyboard focus) */}
      <div
        className="hidden group-hover/fly:block group-focus-within/fly:block absolute top-1/2 -translate-y-1/2 z-[60] pointer-events-none"
        style={{ insetInlineStart: "calc(100% + 14px)" }}
      >
        <div className={`${flyoutBg} border ${flyoutBorder} rounded-lg shadow-xl px-3 py-1.5 whitespace-nowrap`}>
          <span className={`text-[11px] font-semibold ${dk ? "text-white/80" : "text-black/80"}`}>
            {label}
          </span>
        </div>
      </div>

      {/* Flyout with apps (hover or keyboard focus) */}
      <div className="hidden group-hover/fly:block group-focus-within/fly:block absolute top-0 start-full z-[60] ps-3">
        <div className={`${flyoutBg} border ${flyoutBorder} rounded-xl shadow-2xl w-[200px] py-2 px-2`}>
          <div className={`text-[10px] font-bold uppercase tracking-wider ${textGhost} px-2.5 py-1.5`}>
            {label}
          </div>
          <div className="space-y-0.5">
            {apps.map((app) => (
              <AppLink
                key={app.id}
                app={app}
                compact
                dk={dk}
                t={t}
                isActive={activeAppId === app.id}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Collapse toggle — curved pull tab tucked inside the rail seam ── */
function EdgeToggle({
  dk,
  expanded,
  onToggle,
  flyoutBg,
  flyoutBorder,
}: {
  dk: boolean;
  expanded: boolean;
  onToggle: () => void;
  flyoutBg: string;
  flyoutBorder: string;
}) {
  return (
    <div className="group/toggle relative">
      <button
        onClick={onToggle}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        className="relative flex items-center justify-center w-[13px] h-12 cursor-pointer transition-all duration-200 active:scale-95 hover:w-[16px]"
        style={{
          background: dk ? "#0E0E0E" : "#F4F4F4",
          borderTop: dk ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)",
          borderBottom: dk ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)",
          borderInlineStart: dk ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)",
          borderStartStartRadius: "999px",
          borderEndStartRadius: "999px",
          boxShadow: dk ? "-3px 0 10px rgba(0,0,0,0.45)" : "-3px 0 10px rgba(0,0,0,0.08)",
        }}
      >
        <AngleRightIcon
          size={11}
          className={`transition-all duration-300 ${expanded ? "rotate-180" : ""} ${
            dk ? "text-white/45 group-hover/toggle:text-white" : "text-black/45 group-hover/toggle:text-black"
          } group-hover/toggle:scale-110`}
        />
      </button>

      {/* Tooltip — to the inner side so it never overflows the edge. */}
      <div
        className="hidden group-hover/toggle:block absolute top-1/2 -translate-y-1/2 z-[60] pointer-events-none"
        style={{ insetInlineStart: "calc(100% + 8px)" }}
      >
        <div className={`${flyoutBg} border ${flyoutBorder} rounded-lg shadow-xl px-2.5 py-1 whitespace-nowrap`}>
          <span className={`text-[10.5px] font-semibold ${dk ? "text-white/80" : "text-black/80"}`}>
            {expanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Sidebar content (shared by desktop rail + mobile drawer) ── */
function SidebarContent({
  mobile,
  expanded,
  dk,
  t,
  groups,
  activeAppId,
  onToggleGroup,
  onNavigate,
}: {
  mobile?: boolean;
  expanded: boolean;
  dk: boolean;
  t: TFn;
  groups: GroupView[];
  activeAppId: string | null;
  onToggleGroup: (id: string) => void;
  onNavigate: () => void;
}) {
  const showExpanded = mobile || expanded;
  const textGhost = dk ? "text-white/25" : "text-black/25";

  return (
    <div className="flex flex-col h-full">
      <div className="h-2" />
      <nav
        className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-none ${
          showExpanded ? "px-3 py-1 space-y-0.5" : "px-2 py-1.5 space-y-1.5"
        }`}
      >
        {groups.map(({ group, apps, isOpen, isGroupActive }) =>
          showExpanded ? (
            <ExpandedGroup
              key={group.id}
              group={group}
              apps={apps}
              isOpen={isOpen}
              isGroupActive={isGroupActive}
              dk={dk}
              t={t}
              activeAppId={activeAppId}
              onToggleGroup={onToggleGroup}
              onNavigate={onNavigate}
            />
          ) : (
            <CollapsedGroup
              key={group.id}
              group={group}
              apps={apps}
              isGroupActive={isGroupActive}
              dk={dk}
              t={t}
              activeAppId={activeAppId}
              onNavigate={onNavigate}
            />
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
  // Super Admin sees everything. While the permission check is loading we
  // show NO apps (fail-closed) so a user never sees modules they aren't
  // allowed to — even briefly on first paint.
  const { modules: permittedModules, loading: permLoading } =
    usePermittedModules();
  const { data: meBoot } = useMeBootstrap();
  const isSuperAdmin = !!meBoot?.isSuperAdmin;

  const filterApps = useCallback(
    (apps: AppDef[]): AppDef[] => {
      if (permLoading) return [];
      return apps.filter((a) =>
        // Hide not-yet-shipped apps from the rail (no dead/greyed links).
        a.active &&
        // Super-Admin-only apps (e.g. Activity Monitor) gate on the SA flag.
        (a.superAdminOnly ? isSuperAdmin : permittedModules.has(a.name)),
      );
    },
    [permLoading, permittedModules, isSuperAdmin],
  );

  const activeGroupId = getActiveGroupId(pathname);
  const activeAppId = getActiveAppId(pathname);

  /* Home ("/") is the launcher — it already shows every app grouped by
     category, so the desktop rail there is redundant. Hide the persistent
     rail on home; inner routes keep it. (Mobile drawer is on-demand.) */
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

  /* ── Tokens (only those used by the shell chrome here) ── */
  const bg = dk ? "bg-[#0A0A0A]" : "bg-[#FAFAFA]";
  const border = dk ? "border-white/[0.06]" : "border-black/[0.06]";
  const flyoutBg = dk ? "bg-[#141414]" : "bg-white";
  const flyoutBorder = dk ? "border-white/[0.08]" : "border-black/[0.08]";

  /* Precompute per-group view data once; presentational components are
     pure and receive it as props. */
  const groups: GroupView[] = SIDEBAR_GROUPS.map((group) => ({
    group,
    apps: filterApps(getGroupApps(group)),
    isOpen: openGroups.has(group.id),
    isGroupActive: activeGroupId === group.id,
  })).filter((g) => g.apps.length > 0);

  const onNavigate = useCallback(() => setMobileOpen(false), [setMobileOpen]);

  return (
    <>
      {/* ── Desktop sidebar (hidden on the home launcher) ── */}
      {!isHome && (
        <aside
          className={`kx-below-header hidden md:flex flex-col fixed top-14 bottom-0 start-0 z-40 ${bg} border-e ${border} transition-all duration-300 ease-in-out`}
          style={{ width: w }}
        >
          <SidebarContent
            expanded={expanded}
            dk={dk}
            t={t}
            groups={groups}
            activeAppId={activeAppId}
            onToggleGroup={toggleGroup}
            onNavigate={onNavigate}
          />

          {/* Collapse handle — anchored at the rail seam, curving inward
              into the sidebar as a pull tab (stays inside the border). */}
          <div
            className="absolute top-1/2 -translate-y-1/2 z-50"
            style={{ insetInlineEnd: "0px" }}
          >
            <EdgeToggle
              dk={dk}
              expanded={expanded}
              onToggle={toggle}
              flyoutBg={flyoutBg}
              flyoutBorder={flyoutBorder}
            />
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
        className={`kx-below-header md:hidden fixed top-14 bottom-0 start-0 z-50 ${bg} border-e ${border} transition-transform duration-300 ease-in-out ${
          mobileOpen
            ? "translate-x-0 rtl:-translate-x-0"
            : "-translate-x-full rtl:translate-x-full"
        }`}
        style={{ width: SIDEBAR_EXPANDED_W }}
      >
        <SidebarContent
          mobile
          expanded={expanded}
          dk={dk}
          t={t}
          groups={groups}
          activeAppId={activeAppId}
          onToggleGroup={toggleGroup}
          onNavigate={onNavigate}
        />
      </aside>
    </>
  );
}
