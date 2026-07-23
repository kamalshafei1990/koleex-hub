/* ---------------------------------------------------------------------------
   permission-modules — THE list of modules that Roles & Permissions can
   govern, derived from the app registry.

   Why this file exists
   --------------------
   The Roles page used to carry its own hand-written array of module names.
   Adding an app to APP_REGISTRY therefore did NOT add it to Roles, and since
   the permission system is deny-by-default (a module with no row is blocked),
   a newly shipped app was invisible to every non-super-admin with no way for
   an admin to grant it. The Translator shipped that way. The array had also
   drifted the other direction — it still listed "Brands", "Recruitment",
   "Appraisals" and "Attendance", none of which are apps.

   Now there is one source of truth: APP_REGISTRY decides what exists, and
   SIDEBAR_GROUPS decides how it is grouped. Ship an app, and it shows up here
   automatically.

   Modules are keyed by the app's display NAME (e.g. "Translator") because
   that is what koleex_permissions.module_name stores.
   --------------------------------------------------------------------------- */

import { APP_REGISTRY, SIDEBAR_GROUPS, type AppDef } from "@/lib/navigation";

export interface PermissionGroup {
  /** Group id — matches a SIDEBAR_GROUPS id where one exists. */
  id: string;
  label: string;
  /** Module names, in registry order. */
  modules: string[];
}

/* Apps that must never appear as a governable module.
   - Roles & Permissions itself: it is reached only by super admins, and
     letting a role grant itself permission-editing is a privilege-escalation
     footgun.
   - Activity Monitor / Download Center: superAdminOnly, gated server-side. */
const NOT_GOVERNABLE = new Set(["roles", "activity-monitor", "software-center"]);

/* Module names that predate the registry and may still have saved rows in
   koleex_permissions. Keeping them listed means an existing role's saved
   configuration stays visible and editable instead of silently orphaning.
   Nothing new should be added here — new modules come from the registry. */
const LEGACY_MODULES = ["Koleex Mail", "Recruitment", "Appraisals", "Attendance", "Brands"];

function isGovernable(app: AppDef): boolean {
  return app.active && !NOT_GOVERNABLE.has(app.id);
}

/** Every module Roles & Permissions can govern, grouped for display. */
export const PERMISSION_GROUPS: PermissionGroup[] = (() => {
  const groups: PermissionGroup[] = [];
  const placed = new Set<string>();

  /* Follow the sidebar's grouping so Roles reads in the same order as the
     nav the admin is used to. */
  for (const g of SIDEBAR_GROUPS) {
    const modules: string[] = [];
    for (const id of g.appIds) {
      const app = APP_REGISTRY.find((a) => a.id === id);
      if (!app || !isGovernable(app)) continue;
      modules.push(app.name);
      placed.add(app.id);
    }
    if (modules.length) groups.push({ id: g.id, label: g.label, modules });
  }

  /* Registry apps that belong to no sidebar group (Mail, Price Calculator,
     Settings, …) still need to be governable — a missing group must never be
     the reason an app can't be granted. */
  const ungrouped = APP_REGISTRY.filter((a) => isGovernable(a) && !placed.has(a.id)).map((a) => a.name);
  const legacy = LEGACY_MODULES.filter((m) => !ungrouped.includes(m));
  if (ungrouped.length || legacy.length) {
    groups.push({ id: "system", label: "System & Tools", modules: [...ungrouped, ...legacy] });
  }

  return groups;
})();

/** Flat list of every governable module name. */
export const PERMISSION_MODULES: string[] = PERMISSION_GROUPS.flatMap((g) => g.modules);

/* ── Open access ─────────────────────────────────────────────────────────
   Modules flagged `openAccess` in the registry are available to everyone
   UNTIL an admin says otherwise. See AppDef.openAccess for the reasoning.
   An explicit permission row always wins — this only decides the default. */

export const OPEN_ACCESS_MODULES: ReadonlySet<string> = new Set(
  APP_REGISTRY.filter((a) => a.openAccess).map((a) => a.name),
);

/** True when a module is open to everyone in the absence of an explicit row.
 *  Case-insensitive, because module_name is compared with ilike server-side. */
export function isOpenAccessModule(moduleName: string): boolean {
  if (OPEN_ACCESS_MODULES.has(moduleName)) return true;
  const lower = moduleName.toLowerCase();
  for (const m of OPEN_ACCESS_MODULES) if (m.toLowerCase() === lower) return true;
  return false;
}
