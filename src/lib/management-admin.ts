"use client";

/* ---------------------------------------------------------------------------
   management-admin — CRUD helpers for the Management app.

   Relational data model:
     koleex_departments  – hierarchical org units (parent_id for nesting)
     koleex_positions    – job roles within departments, with reporting lines
                           (reports_to_position_id for org chart hierarchy)
     koleex_assignments  – people (from contacts) assigned to positions
                           supports primary/secondary, date ranges
     koleex_roles        – named roles that can be attached to positions
     koleex_permissions  – per-module permission flags attached to roles
     koleex_position_history – audit log of assignment changes

   People are NEVER isolated — they always reference existing contacts.
   Department heads are determined by assignments, not manual fields.
   --------------------------------------------------------------------------- */

import { supabaseAdmin } from "./supabase-admin";

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */

export interface DepartmentRow {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  icon_type: string;
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
  contact_id: string;
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

export interface PermissionRow {
  id: string;
  role_id: string;
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface PositionHistoryRow {
  id: string;
  position_id: string;
  contact_id: string;
  department_id: string | null;
  action: string;
  from_position_id: string | null;
  to_position_id: string | null;
  notes: string | null;
  created_at: string;
}

/** Contact reference for the people picker */
export interface ContactRef {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  phone: string | null;
}

/** Org chart node (position + assigned person + children) */
export interface OrgChartNode {
  position: PositionRow;
  assignment: AssignmentRow | null;
  contact: ContactRef | null;
  children: OrgChartNode[];
}

export type DeptTreeNode = DepartmentRow & { children: DeptTreeNode[] };

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

  if (error) {
    console.error("[Management] createDepartment:", error.message);
    return { data: null, error: error.message };
  }
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

  if (error) {
    console.error("[Management] updateDepartment:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

export async function deleteDepartment(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin
    .from("koleex_departments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[Management] deleteDepartment:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
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

  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }

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

  if (error) {
    console.error("[Management] createPosition:", error.message);
    return { data: null, error: error.message };
  }
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

  if (error) {
    console.error("[Management] updatePosition:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

export async function deletePosition(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin
    .from("koleex_positions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[Management] deletePosition:", error.message);
    return { ok: false, error: error.message };
  }
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

  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }

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

  if (error) {
    console.error("[Management] createAssignment:", error.message);
    return { data: null, error: error.message };
  }
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

  if (error) {
    console.error("[Management] updateAssignment:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

export async function deleteAssignment(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin
    .from("koleex_assignments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[Management] deleteAssignment:", error.message);
    return { ok: false, error: error.message };
  }
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

  if (error) {
    console.error("[Management] createRole:", error.message);
    return { data: null, error: error.message };
  }
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

  if (error) {
    console.error("[Management] updateRole:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

export async function deleteRole(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin
    .from("koleex_roles")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[Management] deleteRole:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

/* ═══════════════════════════════════════════════════
   PERMISSIONS
   ═══════════════════════════════════════════════════ */

export async function fetchPermissions(
  roleId: string,
): Promise<PermissionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("koleex_permissions")
    .select("*")
    .eq("role_id", roleId)
    .order("module_name", { ascending: true });

  if (error) {
    console.error("[Management] fetchPermissions:", error.message);
    return [];
  }
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
  }[],
): Promise<{ ok: boolean; error: string | null }> {
  const rows = perms.map((p) => ({
    role_id: roleId,
    module_name: p.module_name,
    can_view: p.can_view,
    can_create: p.can_create,
    can_edit: p.can_edit,
    can_delete: p.can_delete,
  }));

  const { error } = await supabaseAdmin
    .from("koleex_permissions")
    .upsert(rows, { onConflict: "role_id,module_name" });

  if (error) {
    console.error("[Management] upsertPermissions:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

/* ═══════════════════════════════════════════════════
   POSITION HISTORY
   ═══════════════════════════════════════════════════ */

export async function fetchPositionHistory(
  positionId: string,
): Promise<PositionHistoryRow[]> {
  const { data, error } = await supabaseAdmin
    .from("koleex_position_history")
    .select("*")
    .eq("position_id", positionId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Management] fetchPositionHistory:", error.message);
    return [];
  }
  return (data as PositionHistoryRow[]) || [];
}

export async function addPositionHistory(
  obj: Partial<PositionHistoryRow>,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabaseAdmin
    .from("koleex_position_history")
    .insert(obj);

  if (error) {
    console.error("[Management] addPositionHistory:", error.message);
    return { ok: false, error: error.message };
  }
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
  // 1. Fetch the current assignment to know the old position/department
  const { data: current, error: fetchErr } = await supabaseAdmin
    .from("koleex_assignments")
    .select("*")
    .eq("id", assignmentId)
    .single();

  if (fetchErr || !current) {
    console.error("[Management] transferEmployee fetch:", fetchErr?.message);
    return { ok: false, error: fetchErr?.message || "Assignment not found" };
  }

  const oldPositionId = current.position_id as string;
  const contactId = current.contact_id as string;
  const oldDepartmentId = current.department_id as string;

  // 2. Update the assignment with new position and department
  const { error: updateErr } = await supabaseAdmin
    .from("koleex_assignments")
    .update({
      position_id: newPositionId,
      department_id: newDepartmentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId);

  if (updateErr) {
    console.error("[Management] transferEmployee update:", updateErr.message);
    return { ok: false, error: updateErr.message };
  }

  // 3. Add history entry for the old position (unassigned)
  const { error: histOldErr } = await supabaseAdmin
    .from("koleex_position_history")
    .insert({
      position_id: oldPositionId,
      contact_id: contactId,
      department_id: oldDepartmentId,
      action: "transferred",
      from_position_id: oldPositionId,
      to_position_id: newPositionId,
      notes: `Transferred out to new position`,
    });

  if (histOldErr) {
    console.error("[Management] transferEmployee history (old):", histOldErr.message);
  }

  // 4. Add history entry for the new position (assigned)
  const { error: histNewErr } = await supabaseAdmin
    .from("koleex_position_history")
    .insert({
      position_id: newPositionId,
      contact_id: contactId,
      department_id: newDepartmentId,
      action: "transferred",
      from_position_id: oldPositionId,
      to_position_id: newPositionId,
      notes: `Transferred in from previous position`,
    });

  if (histNewErr) {
    console.error("[Management] transferEmployee history (new):", histNewErr.message);
  }

  return { ok: true, error: null };
}

/* ═══════════════════════════════════════════════════
   CONTACTS — for people picker (linked, not isolated)
   ═══════════════════════════════════════════════════ */

export async function fetchContactsForLinking(): Promise<ContactRef[]> {
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("id, first_name, last_name, display_name, email, photo_url, phone")
    .order("first_name", { ascending: true });

  if (error) {
    console.error("[Management] fetchContactsForLinking:", error.message);
    return [];
  }

  return (data || []).map((c: any) => ({
    id: c.id,
    name:
      c.display_name ||
      [c.first_name, c.last_name].filter(Boolean).join(" ") ||
      "Unnamed",
    email: c.email || null,
    avatar: c.photo_url || null,
    phone: c.phone || null,
  }));
}

/* ═══════════════════════════════════════════════════
   TREE BUILDERS
   ═══════════════════════════════════════════════════ */

export function buildDepartmentTree(
  departments: DepartmentRow[],
): DeptTreeNode[] {
  const map = new Map<string, DeptTreeNode>();
  const roots: DeptTreeNode[] = [];

  for (const dept of departments) {
    map.set(dept.id, { ...dept, children: [] });
  }

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

/** Build org chart tree from positions by reports_to_position_id */
export function buildOrgChart(
  positions: PositionRow[],
  assignments: AssignmentRow[],
  contacts: ContactRef[],
): OrgChartNode[] {
  const ctcMap = new Map(contacts.map((c) => [c.id, c]));
  // Map position_id -> primary assignment
  const assignMap = new Map<string, AssignmentRow>();
  for (const a of assignments) {
    // Prefer primary assignments
    if (!assignMap.has(a.position_id) || a.is_primary) {
      assignMap.set(a.position_id, a);
    }
  }

  const nodeMap = new Map<string, OrgChartNode>();
  const roots: OrgChartNode[] = [];

  // Create all nodes
  for (const pos of positions) {
    const asgn = assignMap.get(pos.id) || null;
    const ctc = asgn ? ctcMap.get(asgn.contact_id) || null : null;
    nodeMap.set(pos.id, { position: pos, assignment: asgn, contact: ctc, children: [] });
  }

  // Build tree
  for (const pos of positions) {
    const node = nodeMap.get(pos.id)!;
    if (pos.reports_to_position_id && nodeMap.has(pos.reports_to_position_id)) {
      nodeMap.get(pos.reports_to_position_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Get department head: the person assigned to the highest-level position
    (lowest level number) with is_primary = true */
export function getDepartmentHead(
  positions: PositionRow[],
  assignments: AssignmentRow[],
  contacts: ContactRef[],
): { name: string; title: string } | null {
  if (positions.length === 0) return null;

  // Sort by level ascending (0 = executive = head)
  const sorted = [...positions].sort((a, b) => a.level - b.level);
  const topPos = sorted[0];

  const primaryAssign = assignments.find(
    (a) => a.position_id === topPos.id && a.is_primary,
  );
  if (!primaryAssign) return null;

  const ctc = contacts.find((c) => c.id === primaryAssign.contact_id);
  return {
    name: ctc?.name || "Unknown",
    title: topPos.title,
  };
}
