"use client";

/* ---------------------------------------------------------------------------
   planning — client-side fetchers + shared types for the Planning app.

   Every function here hits the authenticated /api/planning/* routes so
   RLS bypass (service_role) stays server-side.
   --------------------------------------------------------------------------- */

export type PlanningItemType =
  | "shift"
  | "meeting"
  | "production"
  | "delivery"
  | "maintenance"
  | "project_task"
  | "room_booking"
  | "other";

export type PlanningStatus = "draft" | "published" | "completed" | "cancelled";

export type PlanningResourceType =
  | "employee"
  | "material"
  | "room"
  | "vehicle"
  | "other";

export interface PlanningRole {
  id: string;
  tenant_id: string;
  name: string;
  color: string | null;
  hourly_rate: number | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface PlanningResource {
  id: string;
  tenant_id: string;
  type: PlanningResourceType;
  account_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  capacity_hours_per_day: number | null;
  hourly_cost: number | null;
  is_active: boolean;
}

export interface PlanningItem {
  id: string;
  tenant_id: string;
  type: PlanningItemType;
  title: string;
  notes: string | null;
  resource_id: string | null;
  role_id: string | null;
  start_at: string;
  end_at: string;
  allocated_hours: number | null;
  allocated_pct: number | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  linked_entity_label: string | null;
  is_billable: boolean;
  hourly_rate: number | null;
  status: PlanningStatus;
  published_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  recurrence_rule: string | null;
  recurrence_parent_id: string | null;
  created_by_account_id: string | null;
  created_at: string;
  updated_at: string;
  resource?: Pick<PlanningResource, "id" | "name" | "type" | "account_id" | "color" | "icon"> | null;
  role?: Pick<PlanningRole, "id" | "name" | "color"> | null;
}

export interface PlanningTemplate {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  role_id: string | null;
  start_time: string | null;
  duration_hours: number | null;
  default_note: string | null;
  role?: Pick<PlanningRole, "id" | "name" | "color"> | null;
}

export interface PlanningSwitchRequest {
  id: string;
  tenant_id: string;
  item_id: string;
  requester_id: string;
  target_id: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  message: string | null;
  created_at: string;
  item?: Pick<PlanningItem, "id" | "title" | "start_at" | "end_at" | "resource_id" | "role_id"> | null;
}

/* ── Type / labels ── */

export const ITEM_TYPE_LABELS: Record<PlanningItemType, string> = {
  shift: "Shift",
  meeting: "Meeting",
  production: "Production",
  delivery: "Delivery",
  maintenance: "Maintenance",
  project_task: "Project Task",
  room_booking: "Room Booking",
  other: "Other",
};

export const ITEM_TYPE_COLOR: Record<PlanningItemType, string> = {
  shift: "#60a5fa",
  meeting: "#a78bfa",
  production: "#fbbf24",
  delivery: "#34d399",
  maintenance: "#f472b6",
  project_task: "#818cf8",
  room_booking: "#38bdf8",
  other: "#94a3b8",
};

/* ── Items ── */

export async function fetchItems(params: {
  start?: string;
  end?: string;
  resource_id?: string;
  role_id?: string;
  type?: PlanningItemType;
  status?: PlanningStatus;
  open?: boolean;
  mine?: boolean;
  linked_entity_type?: string;
  linked_entity_id?: string;
} = {}): Promise<PlanningItem[]> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (typeof v === "boolean") {
      if (v) q.set(k, "1");
    } else {
      q.set(k, String(v));
    }
  });
  const res = await fetch(`/api/planning/items?${q.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const { items } = (await res.json()) as { items: PlanningItem[] };
  return items ?? [];
}

export async function createItem(
  body: Partial<PlanningItem> & { start_at: string; end_at: string },
): Promise<PlanningItem | null> {
  const res = await fetch("/api/planning/items", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const { item } = (await res.json()) as { item: PlanningItem };
  return item;
}

export async function updateItem(
  id: string,
  patch: Partial<PlanningItem>,
): Promise<PlanningItem | null> {
  const res = await fetch(`/api/planning/items/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const { item } = (await res.json()) as { item: PlanningItem };
  return item;
}

export async function deleteItem(id: string): Promise<boolean> {
  const res = await fetch(`/api/planning/items/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.ok;
}

export async function publishItem(id: string): Promise<PlanningItem | null> {
  const res = await fetch(`/api/planning/items/${id}/publish`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const { item } = (await res.json()) as { item: PlanningItem };
  return item;
}

export async function takeOpenShift(id: string): Promise<PlanningItem | null> {
  const res = await fetch(`/api/planning/items/${id}/take`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const { item } = (await res.json()) as { item: PlanningItem };
  return item;
}

/* ── Roles ── */

export async function fetchRoles(): Promise<PlanningRole[]> {
  const res = await fetch("/api/planning/roles", { credentials: "include" });
  if (!res.ok) return [];
  const { roles } = (await res.json()) as { roles: PlanningRole[] };
  return roles ?? [];
}

export async function createRole(body: {
  name: string;
  color?: string | null;
  hourly_rate?: number | null;
  sort_order?: number;
}): Promise<PlanningRole | null> {
  const res = await fetch("/api/planning/roles", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const { role } = (await res.json()) as { role: PlanningRole };
  return role;
}

export async function updateRole(
  id: string,
  patch: Partial<PlanningRole>,
): Promise<PlanningRole | null> {
  const res = await fetch(`/api/planning/roles/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const { role } = (await res.json()) as { role: PlanningRole };
  return role;
}

export async function deleteRole(id: string): Promise<boolean> {
  const res = await fetch(`/api/planning/roles/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.ok;
}

/* ── Resources ── */

export async function fetchResources(params: {
  type?: PlanningResourceType;
  includeInactive?: boolean;
} = {}): Promise<PlanningResource[]> {
  const q = new URLSearchParams();
  if (params.type) q.set("type", params.type);
  if (params.includeInactive) q.set("include_inactive", "1");
  const res = await fetch(`/api/planning/resources?${q.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const { resources } = (await res.json()) as { resources: PlanningResource[] };
  return resources ?? [];
}

export async function createResource(body: {
  type: PlanningResourceType;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  capacity_hours_per_day?: number | null;
  hourly_cost?: number | null;
}): Promise<PlanningResource | null> {
  const res = await fetch("/api/planning/resources", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const { resource } = (await res.json()) as { resource: PlanningResource };
  return resource;
}

export async function updateResource(
  id: string,
  patch: Partial<PlanningResource>,
): Promise<PlanningResource | null> {
  const res = await fetch(`/api/planning/resources/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const { resource } = (await res.json()) as { resource: PlanningResource };
  return resource;
}

export async function deleteResource(id: string): Promise<boolean> {
  const res = await fetch(`/api/planning/resources/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.ok;
}

/* ── Date helpers ── */

export function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  // Monday as start of week (matches Odoo Planning + enterprise defaults).
  const dow = copy.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString("en", { weekday: "short", day: "numeric" });
}

export function formatRange(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  const t = (d: Date) =>
    d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
  if (sameDay) {
    return `${s.toLocaleDateString("en", { month: "short", day: "numeric" })} · ${t(s)}–${t(e)}`;
  }
  return `${s.toLocaleDateString("en", { month: "short", day: "numeric" })} ${t(s)} → ${e.toLocaleDateString("en", { month: "short", day: "numeric" })} ${t(e)}`;
}

export function durationHours(startISO: string, endISO: string): number {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  return Math.round((ms / 3600000) * 10) / 10;
}

/* ── Linked-entity search ── */

export interface EntitySearchResult {
  id: string;
  label: string;
  subtitle?: string | null;
}

export async function searchEntities(
  type: "customer" | "supplier" | "contact" | "product",
  q: string,
): Promise<EntitySearchResult[]> {
  const params = new URLSearchParams({ type, q });
  const res = await fetch(`/api/planning/entity-search?${params.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const { results } = (await res.json()) as { results: EntitySearchResult[] };
  return results ?? [];
}

/**
 * Fetch planning items attached to a specific Hub entity. Used by the
 * "Scheduled" strip on Customer / Supplier / Contact / Product detail pages.
 */
export async function fetchLinkedItems(
  entityType: string,
  entityId: string,
  opts: { upcomingOnly?: boolean } = {},
): Promise<PlanningItem[]> {
  const q = new URLSearchParams({
    linked_entity_type: entityType,
    linked_entity_id: entityId,
  });
  if (opts.upcomingOnly) {
    // Only items ending in the future.
    q.set("start", new Date().toISOString());
  }
  const res = await fetch(`/api/planning/items?${q.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const { items } = (await res.json()) as { items: PlanningItem[] };
  return items ?? [];
}
