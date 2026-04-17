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

import { supabaseAdmin } from "./supabase-admin";

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

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (error) return { url: "", error: error.message };
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
  return { url: data.publicUrl, error: null };
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
  created_at: string;
  updated_at: string;
}

/** Record-level scope a role has on a module.
 *  - `own`        – only records the user owns (created or assigned to)
 *  - `department` – records owned by anyone in the user's department
 *  - `all`        – every record in the system (backwards-compatible default)
 */
export type DataScope = "own" | "department" | "all";

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
  const { data, error } = await supabaseAdmin
    .from("koleex_departments")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[Management] fetchDepartments:", error.message);
    return [];
  }
  return (data as DepartmentRow[]) || [];
}

export async function createDepartment(
  obj: Partial<DepartmentRow>,
): Promise<{ data: DepartmentRow | null; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("koleex_departments")
    .insert({ ...obj, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as DepartmentRow, error: null };
}

export async function updateDepartment(
  id: string,
  obj: Partial<DepartmentRow>,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin
    .from("koleex_departments")
    .update({ ...obj, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function deleteDepartment(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin
    .from("koleex_departments")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/** Safe delete: reassigns child departments to parent, handles positions. */
export async function safeDeleteDepartment(
  id: string,
  positionStrategy: "cascade" | "reassign",
  reassignToDeptId?: string,
): Promise<{ ok: boolean; error: string | null }> {
  // Get department's parent so we can reparent children
  const { data: dept } = await supabaseAdmin
    .from("koleex_departments")
    .select("parent_id")
    .eq("id", id)
    .single();

  // Reparent child departments to this dept's parent
  await supabaseAdmin
    .from("koleex_departments")
    .update({ parent_id: dept?.parent_id || null, updated_at: new Date().toISOString() })
    .eq("parent_id", id);

  if (positionStrategy === "reassign" && reassignToDeptId) {
    // Move positions to another department
    await supabaseAdmin
      .from("koleex_positions")
      .update({ department_id: reassignToDeptId, updated_at: new Date().toISOString() })
      .eq("department_id", id);
    await supabaseAdmin
      .from("koleex_assignments")
      .update({ department_id: reassignToDeptId, updated_at: new Date().toISOString() })
      .eq("department_id", id);
  } else {
    // Cascade delete: remove assignments then positions
    await supabaseAdmin.from("koleex_assignments").delete().eq("department_id", id);
    await supabaseAdmin.from("koleex_positions").delete().eq("department_id", id);
  }

  return deleteDepartment(id);
}

/* ═══════════════════════════════════════════════════
   POSITIONS — CRUD
   ═══════════════════════════════════════════════════ */

export async function fetchPositions(
  departmentId?: string,
): Promise<PositionRow[]> {
  let query = supabaseAdmin
    .from("koleex_positions")
    .select("*")
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (departmentId) query = query.eq("department_id", departmentId);

  const { data, error } = await query;
  if (error) {
    console.error("[Management] fetchPositions:", error.message);
    return [];
  }
  return (data as PositionRow[]) || [];
}

export async function createPosition(
  obj: Partial<PositionRow>,
): Promise<{ data: PositionRow | null; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("koleex_positions")
    .insert({ ...obj, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as PositionRow, error: null };
}

export async function updatePosition(
  id: string,
  obj: Partial<PositionRow>,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin
    .from("koleex_positions")
    .update({ ...obj, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function deletePosition(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin
    .from("koleex_positions")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/** Safe delete: reassigns subordinates to this position's parent, removes assignments. */
export async function safeDeletePosition(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data: pos } = await supabaseAdmin
    .from("koleex_positions")
    .select("reports_to_position_id")
    .eq("id", id)
    .single();

  // Reassign direct reports to this position's parent
  await supabaseAdmin
    .from("koleex_positions")
    .update({
      reports_to_position_id: pos?.reports_to_position_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("reports_to_position_id", id);

  // Remove assignments
  await supabaseAdmin.from("koleex_assignments").delete().eq("position_id", id);

  return deletePosition(id);
}

/** Duplicate a position (copies title, level, description, JD — not assignments). */
export async function duplicatePosition(
  sourceId: string,
): Promise<{ data: PositionRow | null; error: string | null }> {
  const { data: src, error: fetchErr } = await supabaseAdmin
    .from("koleex_positions")
    .select("*")
    .eq("id", sourceId)
    .single();

  if (fetchErr || !src) return { data: null, error: fetchErr?.message || "Position not found" };

  const { data, error } = await supabaseAdmin
    .from("koleex_positions")
    .insert({
      title: `${src.title} (Copy)`,
      department_id: src.department_id,
      reports_to_position_id: src.reports_to_position_id,
      level: src.level,
      description: src.description,
      role_id: src.role_id,
      responsibilities: src.responsibilities,
      requirements: src.requirements,
      is_active: true,
      sort_order: (src.sort_order || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as PositionRow, error: null };
}

/** Move a position in the hierarchy (drag & drop). */
export async function movePosition(
  positionId: string,
  newReportsToId: string | null,
  newDepartmentId?: string,
): Promise<{ ok: boolean; error: string | null }> {
  const updates: Record<string, unknown> = {
    reports_to_position_id: newReportsToId,
    updated_at: new Date().toISOString(),
  };
  if (newDepartmentId) updates.department_id = newDepartmentId;

  const { error } = await supabaseAdmin
    .from("koleex_positions")
    .update(updates)
    .eq("id", positionId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/* ═══════════════════════════════════════════════════
   ASSIGNMENTS — CRUD
   ═══════════════════════════════════════════════════ */

export async function fetchAssignments(
  departmentId?: string,
): Promise<AssignmentRow[]> {
  let query = supabaseAdmin
    .from("koleex_assignments")
    .select("*")
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (departmentId) query = query.eq("department_id", departmentId);

  const { data, error } = await query;
  if (error) {
    console.error("[Management] fetchAssignments:", error.message);
    return [];
  }
  return (data as AssignmentRow[]) || [];
}

export async function createAssignment(
  obj: Partial<AssignmentRow>,
): Promise<{ data: AssignmentRow | null; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("koleex_assignments")
    .insert({ ...obj, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as AssignmentRow, error: null };
}

export async function updateAssignment(
  id: string,
  obj: Partial<AssignmentRow>,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin
    .from("koleex_assignments")
    .update({ ...obj, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function deleteAssignment(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin
    .from("koleex_assignments")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/* ═══════════════════════════════════════════════════
   ROLES — CRUD
   ═══════════════════════════════════════════════════ */

export async function fetchRoles(): Promise<RoleRow[]> {
  const { data, error } = await supabaseAdmin
    .from("koleex_roles")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("[Management] fetchRoles:", error.message);
    return [];
  }
  return (data as RoleRow[]) || [];
}

export async function createRole(
  obj: Partial<RoleRow>,
): Promise<{ data: RoleRow | null; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("koleex_roles")
    .insert({ ...obj, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as RoleRow, error: null };
}

export async function updateRole(
  id: string,
  obj: Partial<RoleRow>,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin
    .from("koleex_roles")
    .update({ ...obj, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function deleteRole(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  // Unlink positions first
  await supabaseAdmin
    .from("koleex_positions")
    .update({ role_id: null, updated_at: new Date().toISOString() })
    .eq("role_id", id);

  const { error } = await supabaseAdmin
    .from("koleex_roles")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/** Clone a role and copy its permissions. */
export async function cloneRole(
  sourceRoleId: string,
): Promise<{ data: RoleRow | null; error: string | null }> {
  const { data: src, error: fetchErr } = await supabaseAdmin
    .from("koleex_roles")
    .select("*")
    .eq("id", sourceRoleId)
    .single();

  if (fetchErr || !src) return { data: null, error: fetchErr?.message || "Role not found" };

  const { data: newRole, error: createErr } = await supabaseAdmin
    .from("koleex_roles")
    .insert({
      name: `${src.name} (Copy)`,
      description: src.description,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (createErr || !newRole) return { data: null, error: createErr?.message || "Failed to create role" };

  // Copy permissions
  const { data: perms } = await supabaseAdmin
    .from("koleex_permissions")
    .select("module_name, can_view, can_create, can_edit, can_delete")
    .eq("role_id", sourceRoleId);

  if (perms && perms.length > 0) {
    await supabaseAdmin
      .from("koleex_permissions")
      .insert(perms.map((p: Record<string, unknown>) => ({ ...p, role_id: newRole.id })));
  }

  return { data: newRole as RoleRow, error: null };
}

/* ═══════════════════════════════════════════════════
   PERMISSIONS
   ═══════════════════════════════════════════════════ */

export async function fetchPermissions(roleId: string): Promise<PermissionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("koleex_permissions")
    .select("*")
    .eq("role_id", roleId)
    .order("module_name", { ascending: true });

  if (error) return [];
  return (data as PermissionRow[]) || [];
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
  const rows = perms.map((p) => ({
    role_id: roleId,
    module_name: p.module_name,
    can_view: p.can_view,
    can_create: p.can_create,
    can_edit: p.can_edit,
    can_delete: p.can_delete,
    data_scope: p.data_scope ?? "all",
  }));
  const { error } = await supabaseAdmin
    .from("koleex_permissions")
    .upsert(rows, { onConflict: "role_id,module_name" });

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/* ═══════════════════════════════════════════════════
   POSITION HISTORY
   ═══════════════════════════════════════════════════ */

export async function fetchPositionHistory(positionId: string): Promise<PositionHistoryRow[]> {
  const { data, error } = await supabaseAdmin
    .from("koleex_position_history")
    .select("*")
    .eq("position_id", positionId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data as PositionHistoryRow[]) || [];
}

export async function addPositionHistory(
  obj: Partial<PositionHistoryRow>,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin.from("koleex_position_history").insert(obj);
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/* ═══════════════════════════════════════════════════
   TRANSFER EMPLOYEE
   ═══════════════════════════════════════════════════ */

export async function transferEmployee(
  assignmentId: string,
  newPositionId: string,
  newDepartmentId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data: current, error: fetchErr } = await supabaseAdmin
    .from("koleex_assignments")
    .select("*")
    .eq("id", assignmentId)
    .single();

  if (fetchErr || !current) return { ok: false, error: fetchErr?.message || "Assignment not found" };

  const oldPositionId = current.position_id as string;
  const contactId = current.person_id as string;
  const oldDepartmentId = current.department_id as string;

  const { error: updateErr } = await supabaseAdmin
    .from("koleex_assignments")
    .update({ position_id: newPositionId, department_id: newDepartmentId, updated_at: new Date().toISOString() })
    .eq("id", assignmentId);

  if (updateErr) return { ok: false, error: updateErr.message };

  // Audit entries
  await supabaseAdmin.from("koleex_position_history").insert({
    position_id: oldPositionId, person_id: contactId, department_id: oldDepartmentId,
    action: "transferred", from_position_id: oldPositionId, to_position_id: newPositionId,
    notes: "Transferred out",
  });
  await supabaseAdmin.from("koleex_position_history").insert({
    position_id: newPositionId, person_id: contactId, department_id: newDepartmentId,
    action: "transferred", from_position_id: oldPositionId, to_position_id: newPositionId,
    notes: "Transferred in",
  });

  return { ok: true, error: null };
}

/* ═══════════════════════════════════════════════════
   CONTACTS — people picker + inline creation
   ═══════════════════════════════════════════════════ */

export async function fetchPeopleForLinking(): Promise<PersonRef[]> {
  const { data, error } = await supabaseAdmin
    .from("people")
    .select("id, first_name, last_name, display_name, full_name, email, avatar_url, phone")
    .order("full_name", { ascending: true });

  if (error) return [];

  return (data || []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    name: (c.display_name as string) || (c.full_name as string) || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed",
    email: (c.email as string) || null,
    avatar: (c.avatar_url as string) || null,
    phone: (c.phone as string) || null,
  }));
}

export async function createInlinePerson(input: {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
}): Promise<{ data: PersonRef | null; error: string | null }> {
  const display = [input.first_name, input.last_name].filter(Boolean).join(" ");

  const { data, error } = await supabaseAdmin
    .from("people")
    .insert({
      first_name: input.first_name,
      last_name: input.last_name || null,
      full_name: display,
      display_name: display,
      email: input.email || null,
      phone: input.phone || null,
    })
    .select("id, first_name, last_name, display_name, email, avatar_url, phone")
    .single();

  if (error) return { data: null, error: error.message };

  return {
    data: {
      id: data.id,
      name: data.display_name || display,
      email: data.email,
      avatar: data.avatar_url || null,
      phone: data.phone,
    },
    error: null,
  };
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
  const { data, error } = await supabaseAdmin
    .from("koleex_position_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data as PositionHistoryRow[]) || [];
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
