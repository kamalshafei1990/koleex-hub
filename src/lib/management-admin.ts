"use client";

/* ---------------------------------------------------------------------------
   management-admin — CRUD + business logic for the Management module.

   Tables:
     koleex_departments  – org units (parent_id for nesting, icon system)
     koleex_positions    – jobs within departments, reports_to hierarchy
     koleex_assignments  – people → positions
     koleex_roles        – named roles attached to positions
     koleex_permissions  – per-module permission flags on roles
     koleex_position_history – audit log

   Key invariants:
     • No circular reporting chains (validated before every save)
     • Deleting a department reassigns children + positions safely
     • Deleting a position reassigns subordinates to parent
     • Assignments always reference existing people
   --------------------------------------------------------------------------- */

import { invalidateCachedGet } from "./client-cache";
import { uploadToStorage } from "./storage-client";


/* Every call goes through an API route; nothing here touches the database. */
const J = { "Content-Type": "application/json" };
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
const BUCKET = "media";

/* ═══════════════════════════════════════════════════
   ICON UPLOAD
   ═══════════════════════════════════════════════════ */

/** Upload a department/management icon (PNG, JPG, SVG) to Supabase storage. */
export async function uploadManagementIcon(
  file: File,
  prefix = "management",
): Promise<{ url: string; error: string | null }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const allowed = ["png", "jpg", "jpeg", "svg", "webp"];
  if (!allowed.includes(ext)) return { url: "", error: `File type .${ext} not allowed. Use PNG, JPG, or SVG.` };
  if (file.size > 2 * 1024 * 1024) return { url: "", error: "File too large (max 2 MB)." };

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `${prefix}/${Date.now()}_${safeName}`;

  const result = await uploadToStorage(BUCKET, filePath, file, {
    cacheControl: "3600",
  });
  if (!result.ok) return { url: "", error: result.error };
  /* BUCKET is public; a null URL would mean it was repointed at a private one. */
  if (result.data.publicUrl === null) {
    return { url: "", error: "Storage bucket has no public URL." };
  }
  return { url: result.data.publicUrl, error: null };
}

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */

export interface DepartmentRow {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  icon_type: string;       // 'emoji' | 'image' | 'icon'
  icon_value: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PositionRow {
  id: string;
  title: string;
  department_id: string;
  reports_to_position_id: string | null;
  level: number;
  description: string | null;
  role_id: string | null;
  responsibilities: string | null;
  requirements: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AssignmentRow {
  id: string;
  person_id: string;
  position_id: string;
  department_id: string;
  is_primary: boolean;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  /** When true, the role bypasses every data_scope filter (but is still
   *  excluded from is_private records unless can_view_private is also true). */
  is_super_admin: boolean;
  /** Break-glass: when true, the role can read is_private records. Every
   *  such read is audit-logged to koleex_private_access_log. Grant sparingly. */
  can_view_private: boolean;
  /** Live accounts currently assigned this role (from GET /api/roles). */
  accounts_count?: number;
  created_at: string;
  updated_at: string;
}

/** Record-level scope a role has on a module. Mirrors the DB CHECK on
 *  koleex_permissions.data_scope.
 *  - `private`    – only records this user created (locks out even other
 *                   holders of the same role). Most restrictive.
 *  - `own`        – records the user owns OR was assigned to OR shared with
 *  - `department` – own rules + records owned by anyone in user's department
 *  - `all`        – every record in the system (backwards-compatible default)
 */
export type DataScope = "private" | "own" | "department" | "all";

export interface PermissionRow {
  id: string;
  role_id: string;
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  /** Non-optional now that the column exists in Supabase with a NOT NULL
   *  default of 'all'. Still typed loosely for forward-compat. */
  data_scope: DataScope;
  sensitive_fields?: string[];
}

export interface PositionHistoryRow {
  id: string;
  position_id: string;
  person_id: string;
  department_id: string | null;
  action: string;
  from_position_id: string | null;
  to_position_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface PersonRef {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  phone: string | null;
}

export interface OrgChartNode {
  position: PositionRow;
  department: DepartmentRow | null;
  assignment: AssignmentRow | null;
  person: PersonRef | null;
  children: OrgChartNode[];
}

export type DeptTreeNode = DepartmentRow & { children: DeptTreeNode[] };

/* ═══════════════════════════════════════════════════
   VALIDATION
   ═══════════════════════════════════════════════════ */

/** Returns true if setting `positionId` to report to `newReportsToId`
    would create a circular chain. */
export function detectCircularHierarchy(
  positionId: string,
  newReportsToId: string | null,
  allPositions: PositionRow[],
): boolean {
  if (!newReportsToId) return false;
  if (positionId === newReportsToId) return true;

  const posMap = new Map(allPositions.map((p) => [p.id, p]));
  const visited = new Set<string>();
  let current: string | null = newReportsToId;

  while (current) {
    if (current === positionId) return true;
    if (visited.has(current)) return false; // existing cycle elsewhere
    visited.add(current);
    const pos = posMap.get(current);
    current = pos?.reports_to_position_id || null;
  }

  return false;
}

/* ═══════════════════════════════════════════════════
   DEPARTMENTS — CRUD
   ═══════════════════════════════════════════════════ */

export async function fetchDepartments(): Promise<DepartmentRow[]> {
  try {
    const j = await api<{ departments: DepartmentRow[] }>("/api/management/departments");
    return j.departments ?? [];
  } catch (e) {
    console.error("[Management] fetchDepartments:", e);
    return [];
  }
}

export async function createDepartment(
  obj: Partial<DepartmentRow>,
): Promise<{ data: DepartmentRow | null; error: string | null }> {
  try {
    const j = await api<{ department: DepartmentRow | null }>("/api/management/departments", {
      method: "POST", headers: J, body: JSON.stringify(obj),
    });
    invalidateCachedGet("/api/management/departments");
    return { data: j.department, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateDepartment(
  id: string,
  obj: Partial<DepartmentRow>,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await api("/api/management/departments", {
      method: "PATCH", headers: J, body: JSON.stringify({ ...obj, id }),
    });
    invalidateCachedGet("/api/management/departments");
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteDepartment(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  /* Always the SAFE delete: the route reparents children and handles the
     department's positions in one operation. */
  return safeDeleteDepartment(id, "cascade");
}

/** Safe delete: reassigns child departments to parent, handles positions. */
export async function safeDeleteDepartment(
  id: string,
  positionStrategy: "cascade" | "reassign",
  reassignToDeptId?: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await api("/api/management/departments", {
      method: "DELETE", headers: J,
      body: JSON.stringify({ id, positionStrategy, reassignToDeptId }),
    });
    invalidateCachedGet("/api/management/departments");
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/* ═══════════════════════════════════════════════════
   POSITIONS — CRUD
   ═══════════════════════════════════════════════════ */

export async function fetchPositions(
  departmentId?: string,
): Promise<PositionRow[]> {
  try {
    const qs = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : "";
    const j = await api<{ positions: PositionRow[] }>(`/api/management/positions${qs}`);
    return j.positions ?? [];
  } catch (e) {
    console.error("[Management] fetchPositions:", e);
    return [];
  }
}

export async function createPosition(
  obj: Partial<PositionRow>,
): Promise<{ data: PositionRow | null; error: string | null }> {
  try {
    const j = await api<{ position: PositionRow | null }>("/api/management/positions", {
      method: "POST", headers: J, body: JSON.stringify(obj),
    });
    return { data: j.position, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updatePosition(
  id: string,
  obj: Partial<PositionRow>,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await api("/api/management/positions", {
      method: "PATCH", headers: J, body: JSON.stringify({ ...obj, id }),
    });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deletePosition(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  return safeDeletePosition(id);
}

/** Safe delete: reassigns subordinates to this position's parent, removes assignments. */
export async function safeDeletePosition(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await api("/api/management/positions", {
      method: "DELETE", headers: J, body: JSON.stringify({ id }),
    });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Duplicate a position (copies title, level, description, JD — not assignments). */
export async function duplicatePosition(
  sourceId: string,
): Promise<{ data: PositionRow | null; error: string | null }> {
  try {
    const j = await api<{ position: PositionRow | null }>("/api/management/positions", {
      method: "PUT", headers: J, body: JSON.stringify({ duplicate: sourceId }),
    });
    return { data: j.position, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Move a position in the hierarchy (drag & drop). */
export async function movePosition(
  positionId: string,
  newReportsToId: string | null,
  newDepartmentId?: string,
): Promise<{ ok: boolean; error: string | null }> {
  const body: Record<string, unknown> = { id: positionId, reports_to_position_id: newReportsToId };
  if (newDepartmentId) body.department_id = newDepartmentId;
  try {
    await api("/api/management/positions", { method: "PATCH", headers: J, body: JSON.stringify(body) });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/* ═══════════════════════════════════════════════════
   ASSIGNMENTS — CRUD
   ═══════════════════════════════════════════════════ */

export async function fetchAssignments(
  departmentId?: string,
): Promise<AssignmentRow[]> {
  try {
    const qs = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : "";
    const j = await api<{ assignments: AssignmentRow[] }>(`/api/management/assignments${qs}`);
    return j.assignments ?? [];
  } catch (e) {
    console.error("[Management] fetchAssignments:", e);
    return [];
  }
}

export async function createAssignment(
  obj: Partial<AssignmentRow>,
): Promise<{ data: AssignmentRow | null; error: string | null }> {
  try {
    const j = await api<{ assignment: AssignmentRow | null }>("/api/management/assignments", {
      method: "POST", headers: J, body: JSON.stringify(obj),
    });
    return { data: j.assignment, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateAssignment(
  id: string,
  obj: Partial<AssignmentRow>,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await api("/api/management/assignments", {
      method: "PATCH", headers: J, body: JSON.stringify({ ...obj, id }),
    });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteAssignment(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await api("/api/management/assignments", { method: "DELETE", headers: J, body: JSON.stringify({ id }) });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/* ═══════════════════════════════════════════════════
   ROLES — CRUD
   ═══════════════════════════════════════════════════ */

export async function fetchRoles(): Promise<RoleRow[]> {
  try {
    const res = await fetch("/api/roles", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as { roles: RoleRow[] };
      return json.roles;
    }
    if (res.status !== 401 && res.status !== 403) {
      console.error("[Management] fetchRoles:", res.status);
    }
    return [];
  } catch (e) {
    console.error("[Management] fetchRoles failed:", e);
    return [];
  }
}

export async function createRole(
  obj: Partial<RoleRow>,
): Promise<{ data: RoleRow | null; error: string | null }> {
  try {
    const res = await fetch("/api/roles", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });
    if (res.ok) {
      const json = (await res.json()) as { role: RoleRow };
      return { data: json.role, error: null };
    }
    const err = await res.json().catch(() => ({ error: "Failed" }));
    return { data: null, error: (err as { error?: string }).error ?? "Failed" };
  } catch (e) {
    console.error("[Management] createRole API failed:", e);
  }
  /* NO anon-key fallback for role/permission WRITES. The tables are RLS
     service-role-only, so the old direct-write fallback could never succeed —
     but it was a loaded gun: any future RLS relaxation would have silently
     turned "API unreachable" into "any browser can write the permission
     grid". Security mutations go through the SA-gated API or fail. */
  return { data: null, error: "Network error — role not created." };
}

export async function updateRole(
  id: string,
  obj: Partial<RoleRow>,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/roles/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });
    if (res.ok) {
      /* Editing a role (esp. Super Admin / View Private / scope) changes the
         effective access of every account on it — including the editing admin
         if they touched their own role. Bust the shared bootstrap cache so the
         sidebar + module gates refresh on the next navigation instead of
         serving a stale snapshot for the rest of the TTL. */
      try {
        const { invalidateMeBootstrap } = await import("./me-bootstrap");
        invalidateMeBootstrap();
      } catch { /* ignore — SSR path has no window cache */ }
      return { ok: true, error: null };
    }
    const err = await res.json().catch(() => ({ error: "Failed" }));
    return { ok: false, error: (err as { error?: string }).error ?? "Failed" };
  } catch (e) {
    console.error("[Management] updateRole API failed:", e);
  }
  return { ok: false, error: "Network error — role not updated." };
}

export async function deleteRole(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/roles/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      try {
        const { invalidateMeBootstrap } = await import("./me-bootstrap");
        invalidateMeBootstrap();
      } catch { /* ignore */ }
      return { ok: true, error: null };
    }
    const err = await res.json().catch(() => ({ error: "Failed" }));
    return { ok: false, error: (err as { error?: string }).error ?? "Failed" };
  } catch (e) {
    console.error("[Management] deleteRole API failed:", e);
  }
  return { ok: false, error: "Network error — role not deleted." };
}

/** Clone a role and copy its permissions. */
export async function cloneRole(
  sourceRoleId: string,
): Promise<{ data: RoleRow | null; error: string | null }> {
  try {
    const res = await fetch("/api/roles/" + sourceRoleId + "/clone", {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      const json = (await res.json()) as { role: RoleRow };
      return { data: json.role, error: null };
    }
    const err = await res.json().catch(() => ({ error: "Failed" }));
    return { data: null, error: (err as { error?: string }).error ?? "Failed" };
  } catch (e) {
    console.error("[Management] cloneRole API failed:", e);
  }
  return { data: null, error: "Network error — role not cloned." };
}

/* ═══════════════════════════════════════════════════
   PERMISSIONS
   ═══════════════════════════════════════════════════ */

export async function fetchPermissions(roleId: string): Promise<PermissionRow[]> {
  try {
    const res = await fetch("/api/permissions?role_id=" + encodeURIComponent(roleId), {
      credentials: "include",
    });
    if (res.ok) {
      const json = (await res.json()) as { permissions: PermissionRow[] };
      return json.permissions;
    }
    if (res.status !== 401 && res.status !== 403) {
      console.error("[Management] fetchPermissions:", res.status);
    }
    return [];
  } catch (e) {
    console.error("[Management] fetchPermissions failed:", e);
    return [];
  }
}

export async function upsertPermissions(
  roleId: string,
  perms: {
    module_name: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
    /** Optional for backwards-compat with older callers; defaults to 'all'
     *  if missing so existing save paths don't regress. */
    data_scope?: DataScope;
  }[],
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/permissions", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_id: roleId, permissions: perms }),
    });
    if (res.ok) {
      // Any role-level permission change affects every account on that
      // role. Bust the shared bootstrap cache so the sidebar + module
      // gates don't keep serving a stale permittedModules list for
      // the rest of the TTL.
      try {
        const { invalidateMeBootstrap } = await import("./me-bootstrap");
        invalidateMeBootstrap();
      } catch { /* ignore — SSR path has no window cache */ }
      return { ok: true, error: null };
    }
    const err = await res.json().catch(() => ({ error: "Failed" }));
    return { ok: false, error: (err as { error?: string }).error ?? "Failed" };
  } catch (e) {
    console.error("[Management] upsertPermissions API failed:", e);
  }
  return { ok: false, error: "Network error — permissions not saved." };
}

/* ═══════════════════════════════════════════════════
   POSITION HISTORY
   ═══════════════════════════════════════════════════ */

export async function fetchPositionHistory(positionId: string): Promise<PositionHistoryRow[]> {
  try {
    const j = await api<{ history: PositionHistoryRow[] }>(
      `/api/management/activity?position_id=${encodeURIComponent(positionId)}`,
    );
    return j.history ?? [];
  } catch (e) {
    console.error("[Management] fetchPositionHistory:", e);
    return [];
  }
}

export async function addPositionHistory(
  obj: Partial<PositionHistoryRow>,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await api("/api/management/activity", { method: "POST", headers: J, body: JSON.stringify(obj) });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/* ═══════════════════════════════════════════════════
   TRANSFER EMPLOYEE
   ═══════════════════════════════════════════════════ */

export async function transferEmployee(
  assignmentId: string,
  newPositionId: string,
  newDepartmentId: string,
): Promise<{ ok: boolean; error: string | null }> {
  /* The move AND both audit rows land as one server operation. Split across
     the browser, a failure between them left a transfer with half a trail. */
  try {
    await api("/api/management/assignments", {
      method: "PUT", headers: J,
      body: JSON.stringify({ transfer: { assignmentId, newPositionId, newDepartmentId } }),
    });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/* ═══════════════════════════════════════════════════
   CONTACTS — people picker + inline creation
   ═══════════════════════════════════════════════════ */

export async function fetchPeopleForLinking(): Promise<PersonRef[]> {
  try {
    const j = await api<{ people: Record<string, unknown>[] }>("/api/people");
    return (j.people ?? []).map((c) => ({
      id: c.id as string,
      name: (c.display_name as string) || (c.full_name as string)
        || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed",
      email: (c.email as string) || null,
      avatar: (c.avatar_url as string) || null,
      phone: (c.phone as string) || null,
    }));
  } catch (e) {
    console.error("[Management] fetchPeopleForLinking:", e);
    return [];
  }
}

export async function createInlinePerson(input: {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
}): Promise<{ data: PersonRef | null; error: string | null }> {
  const display = [input.first_name, input.last_name].filter(Boolean).join(" ");
  try {
    const j = await api<{ person: Record<string, unknown> }>("/api/people", {
      method: "POST", headers: J,
      body: JSON.stringify({
        first_name: input.first_name,
        last_name: input.last_name || null,
        full_name: display,
        display_name: display,
        email: input.email || null,
        phone: input.phone || null,
      }),
    });
    const d = j.person ?? {};
    return {
      data: {
        id: d.id as string,
        name: (d.display_name as string) || display,
        email: (d.email as string) ?? null,
        avatar: (d.avatar_url as string) ?? null,
        phone: (d.phone as string) ?? null,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed" };
  }
}

/* ═══════════════════════════════════════════════════
   FULL ORG DATA (cross-department)
   ═══════════════════════════════════════════════════ */

export async function fetchFullOrgData(): Promise<{
  positions: PositionRow[];
  assignments: AssignmentRow[];
  people: PersonRef[];
  departments: DepartmentRow[];
}> {
  const [positions, assignments, people, departments] = await Promise.all([
    fetchPositions(),
    fetchAssignments(),
    fetchPeopleForLinking(),
    fetchDepartments(),
  ]);
  return { positions, assignments, people, departments };
}

/* ═══════════════════════════════════════════════════
   TREE BUILDERS
   ═══════════════════════════════════════════════════ */

export function buildDepartmentTree(departments: DepartmentRow[]): DeptTreeNode[] {
  const map = new Map<string, DeptTreeNode>();
  const roots: DeptTreeNode[] = [];

  for (const dept of departments) map.set(dept.id, { ...dept, children: [] });

  for (const dept of departments) {
    const node = map.get(dept.id)!;
    if (dept.parent_id && map.has(dept.parent_id)) {
      map.get(dept.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Build org chart tree. Works for department-scoped or full data. */
export function buildOrgChart(
  positions: PositionRow[],
  assignments: AssignmentRow[],
  people: PersonRef[],
  departments?: DepartmentRow[],
): OrgChartNode[] {
  const ctcMap = new Map(people.map((c) => [c.id, c]));
  const deptMap = departments ? new Map(departments.map((d) => [d.id, d])) : null;

  const assignMap = new Map<string, AssignmentRow>();
  for (const a of assignments) {
    if (!assignMap.has(a.position_id) || a.is_primary) assignMap.set(a.position_id, a);
  }

  const nodeMap = new Map<string, OrgChartNode>();
  const roots: OrgChartNode[] = [];

  for (const pos of positions) {
    const asgn = assignMap.get(pos.id) || null;
    const ctc = asgn ? ctcMap.get(asgn.person_id) || null : null;
    const dept = deptMap?.get(pos.department_id) || null;
    nodeMap.set(pos.id, { position: pos, department: dept, assignment: asgn, person: ctc, children: [] });
  }

  for (const pos of positions) {
    const node = nodeMap.get(pos.id)!;
    if (pos.reports_to_position_id && nodeMap.has(pos.reports_to_position_id)) {
      nodeMap.get(pos.reports_to_position_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by level then title for consistent layout
  const sortChildren = (nodes: OrgChartNode[]) => {
    nodes.sort((a, b) => a.position.level - b.position.level || a.position.title.localeCompare(b.position.title));
    nodes.forEach((n) => sortChildren(n.children));
  };
  roots.forEach((r) => sortChildren(r.children));
  roots.sort((a, b) => a.position.level - b.position.level || a.position.title.localeCompare(b.position.title));

  return roots;
}

export function getDepartmentHead(
  positions: PositionRow[],
  assignments: AssignmentRow[],
  people: PersonRef[],
): { name: string; title: string } | null {
  if (!positions.length) return null;
  const sorted = [...positions].sort((a, b) => a.level - b.level);
  const topPos = sorted[0];
  const primaryAssign = assignments.find((a) => a.position_id === topPos.id && a.is_primary);
  if (!primaryAssign) return null;
  const ctc = people.find((c) => c.id === primaryAssign.person_id);
  return { name: ctc?.name || "Unknown", title: topPos.title };
}

/** Quick stats per department. */
export async function fetchDeptStats(): Promise<Record<string, { total: number; assigned: number }>> {
  const [allPos, allAssign] = await Promise.all([fetchPositions(), fetchAssignments()]);
  const assignedSet = new Set(allAssign.map((a) => a.position_id));
  const stats: Record<string, { total: number; assigned: number }> = {};

  for (const pos of allPos) {
    if (!stats[pos.department_id]) stats[pos.department_id] = { total: 0, assigned: 0 };
    stats[pos.department_id].total++;
    if (assignedSet.has(pos.id)) stats[pos.department_id].assigned++;
  }
  return stats;
}

/* ═══════════════════════════════════════════════════
   EMPLOYEE PROFILE
   ═══════════════════════════════════════════════════ */

export interface EmployeeProfile {
  person: PersonRef;
  assignments: (AssignmentRow & { position: PositionRow; department: DepartmentRow | null })[];
  reportingChain: { position: PositionRow; person: PersonRef | null; department: DepartmentRow | null }[];
  directReports: { position: PositionRow; person: PersonRef | null; department: DepartmentRow | null }[];
  history: PositionHistoryRow[];
}

export async function fetchEmployeeProfile(personId: string): Promise<EmployeeProfile | null> {
  const [allPeople, allPositions, allAssignments, allDepts] = await Promise.all([
    fetchPeopleForLinking(),
    fetchPositions(),
    fetchAssignments(),
    fetchDepartments(),
  ]);

  const person = allPeople.find((c) => c.id === personId);
  if (!person) return null;

  const deptMap = new Map(allDepts.map((d) => [d.id, d]));
  const posMap = new Map(allPositions.map((p) => [p.id, p]));

  // Get this employee's assignments with position/dept info
  const myAssignments = allAssignments
    .filter((a) => a.person_id === personId)
    .map((a) => ({
      ...a,
      position: posMap.get(a.position_id)!,
      department: deptMap.get(a.department_id) || null,
    }))
    .filter((a) => a.position);

  // Build reporting chain (walk upward from primary position)
  const primaryAssign = myAssignments.find((a) => a.is_primary) || myAssignments[0];
  const reportingChain: EmployeeProfile["reportingChain"] = [];
  if (primaryAssign) {
    let currentPosId = primaryAssign.position.reports_to_position_id;
    const visited = new Set<string>();
    while (currentPosId && !visited.has(currentPosId)) {
      visited.add(currentPosId);
      const pos = posMap.get(currentPosId);
      if (!pos) break;
      const posAssign = allAssignments.find((a) => a.position_id === currentPosId && a.is_primary);
      const ctc = posAssign ? allPeople.find((c) => c.id === posAssign.person_id) || null : null;
      reportingChain.push({ position: pos, person: ctc, department: deptMap.get(pos.department_id) || null });
      currentPosId = pos.reports_to_position_id;
    }
  }

  // Direct reports (people who report to this employee's primary position)
  const directReports: EmployeeProfile["directReports"] = [];
  if (primaryAssign) {
    const subordinatePositions = allPositions.filter((p) => p.reports_to_position_id === primaryAssign.position.id);
    for (const pos of subordinatePositions) {
      const posAssign = allAssignments.find((a) => a.position_id === pos.id && a.is_primary);
      const ctc = posAssign ? allPeople.find((c) => c.id === posAssign.person_id) || null : null;
      directReports.push({ position: pos, person: ctc, department: deptMap.get(pos.department_id) || null });
    }
  }

  // Fetch history for all positions this person holds
  const historyPromises = myAssignments.map((a) => fetchPositionHistory(a.position_id));
  const allHistory = (await Promise.all(historyPromises)).flat();
  const myHistory = allHistory.filter((h) => h.person_id === personId).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return { person, assignments: myAssignments, reportingChain, directReports, history: myHistory };
}

/* ═══════════════════════════════════════════════════
   GLOBAL ACTIVITY FEED
   ═══════════════════════════════════════════════════ */

export async function fetchRecentActivity(limit = 50): Promise<PositionHistoryRow[]> {
  try {
    const j = await api<{ history: PositionHistoryRow[] }>(`/api/management/activity?limit=${limit}`);
    return j.history ?? [];
  } catch (e) {
    console.error("[Management] fetchRecentActivity:", e);
    return [];
  }
}

/* ═══════════════════════════════════════════════════
   HEADCOUNT ANALYTICS
   ═══════════════════════════════════════════════════ */

export interface HeadcountAnalytics {
  totalDepartments: number;
  totalPositions: number;
  filledPositions: number;
  vacantPositions: number;
  vacancyRate: number;
  totalEmployees: number;
  avgSpanOfControl: number;
  maxOrgDepth: number;
  departmentBreakdown: {
    id: string; name: string; icon: string;
    icon_type?: string; icon_value?: string;
    total: number; filled: number; vacant: number;
  }[];
  levelDistribution: { level: number; label: string; count: number }[];
}

export async function fetchHeadcountAnalytics(): Promise<HeadcountAnalytics> {
  const [depts, positions, assignments] = await Promise.all([
    fetchDepartments(), fetchPositions(), fetchAssignments(),
  ]);

  const assignedPosIds = new Set(assignments.map((a) => a.position_id));
  const uniqueContactIds = new Set(assignments.map((a) => a.person_id));

  const filledPositions = positions.filter((p) => assignedPosIds.has(p.id)).length;
  const vacantPositions = positions.length - filledPositions;
  const vacancyRate = positions.length > 0 ? (vacantPositions / positions.length) * 100 : 0;

  // Avg span of control: positions that have direct reports / count of direct reports
  const managersWithReports = new Map<string, number>();
  for (const pos of positions) {
    if (pos.reports_to_position_id) {
      managersWithReports.set(pos.reports_to_position_id, (managersWithReports.get(pos.reports_to_position_id) || 0) + 1);
    }
  }
  const managerCount = managersWithReports.size;
  const totalDirectReports = Array.from(managersWithReports.values()).reduce((a, b) => a + b, 0);
  const avgSpanOfControl = managerCount > 0 ? totalDirectReports / managerCount : 0;

  // Max org depth
  const posMap = new Map(positions.map((p) => [p.id, p]));
  const depthCache = new Map<string, number>();
  const getDepth = (posId: string): number => {
    if (depthCache.has(posId)) return depthCache.get(posId)!;
    const pos = posMap.get(posId);
    if (!pos || !pos.reports_to_position_id) { depthCache.set(posId, 0); return 0; }
    const d = 1 + getDepth(pos.reports_to_position_id);
    depthCache.set(posId, d);
    return d;
  };
  let maxOrgDepth = 0;
  for (const p of positions) { maxOrgDepth = Math.max(maxOrgDepth, getDepth(p.id)); }

  // Department breakdown
  const deptBreakdown = depts.map((d) => {
    const deptPos = positions.filter((p) => p.department_id === d.id);
    const filled = deptPos.filter((p) => assignedPosIds.has(p.id)).length;
    return { id: d.id, name: d.name, icon: d.icon || "building2", icon_type: d.icon_type || "icon", icon_value: d.icon_value || "building2", total: deptPos.length, filled, vacant: deptPos.length - filled };
  }).sort((a, b) => b.total - a.total);

  // Level distribution
  const levelCounts = new Map<number, number>();
  for (const p of positions) { levelCounts.set(p.level, (levelCounts.get(p.level) || 0) + 1); }
  const levelDistribution = Array.from(levelCounts.entries())
    .map(([level, count]) => ({
      level,
      label: level === 0 ? "Executive" : level === 1 ? "Senior Mgmt" : level === 2 ? "Management" : level === 3 ? "Senior" : level === 4 ? "Mid-Level" : "Entry Level",
      count,
    }))
    .sort((a, b) => a.level - b.level);

  return {
    totalDepartments: depts.length,
    totalPositions: positions.length,
    filledPositions,
    vacantPositions,
    vacancyRate,
    totalEmployees: uniqueContactIds.size,
    avgSpanOfControl,
    maxOrgDepth,
    departmentBreakdown: deptBreakdown,
    levelDistribution,
  };
}
