/* Brand Center — the browser side of /api/brand-center/*: types and calls.
   Every call answers { ok, data } or { ok: false, status, error } so a
   screen can say what went wrong instead of spinning. */

export type I18n = Partial<Record<"en" | "zh" | "ar", string>>;
export interface BcOption { id: string; type_id: string; key: string; label: string; label_i18n: I18n; recommended: boolean; chosen: boolean; sort: number }
export interface BcType { id: string; key: string; label: string; label_i18n: I18n; sort: number; options: BcOption[] }
export interface BcFile { id: string; design_id: string; file_name: string; mime: string | null; size_bytes: number | null; purpose: string; created_at: string }
export interface BcDesign { id: string; item_id?: string; option_ids: string[]; name: string; kind: string; status: "draft" | "active" | "retired"; is_default: boolean; notes: string | null; updated_at: string; files?: BcFile[] }
export interface BcItem {
  id: string; group_id: string | null; key: string; name: string; name_i18n: I18n; use_text: string | null;
  importance: "core" | "optional" | "later"; decision: "yes" | "later" | "no"; status: "draft" | "approved" | "retired";
  note: string | null; owner_note: string | null; sort: number;
  types: BcType[]; designs: BcDesign[];
}
export interface BcSectionRow { id: string; key: string; no: number; name: string; name_i18n: I18n; icon: string | null; groups: number; items: number; types: number }
export interface BcGroup { id: string; name: string; name_i18n: I18n; sort: number }
export interface BcSectionData { section: BcSectionRow; groups: BcGroup[]; items: BcItem[]; canEdit: boolean }
export interface BcItemData {
  item: Omit<BcItem, "types" | "designs"> & { section_id: string };
  section: { id: string; key: string; no: number; name: string } | null;
  group: { id: string; name: string } | null;
  types: BcType[]; designs: BcDesign[]; canEdit: boolean;
}

type Res<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function call<T>(url: string, init?: RequestInit): Promise<Res<T>> {
  try {
    const r = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: (body as { error?: string }).error ?? `HTTP ${r.status}` };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
}
const send = <T>(url: string, method: string, body: unknown) => call<T>(url, { method, body: JSON.stringify(body) });

export const bc = {
  library: () => call<{ sections: BcSectionRow[] }>("/api/brand-center/library"),
  section: (key: string) => call<BcSectionData>(`/api/brand-center/sections/${encodeURIComponent(key)}`),
  item: (id: string) => call<BcItemData>(`/api/brand-center/items/${encodeURIComponent(id)}`),
  addItem: (b: { sectionId: string; groupId?: string | null; name: string }) => send<{ id: string }>("/api/brand-center/items", "POST", b),
  editItem: (id: string, b: Record<string, unknown>) => send<{ ok: true }>(`/api/brand-center/items/${id}`, "PATCH", b),
  retireItem: (id: string) => call<{ ok: true }>(`/api/brand-center/items/${id}`, { method: "DELETE" }),
  addType: (itemId: string, label: string) => send<{ id: string }>(`/api/brand-center/items/${itemId}/types`, "POST", { label }),
  addOption: (typeId: string, label: string) => send<{ id: string }>(`/api/brand-center/types/${typeId}/options`, "POST", { label }),
  editOption: (id: string, b: { chosen?: boolean; label?: string }) => send<{ ok: true }>(`/api/brand-center/options/${id}`, "PATCH", b),
  addDesign: (itemId: string, b: { name: string; kind?: string; optionIds?: string[]; notes?: string }) => send<{ id: string }>(`/api/brand-center/items/${itemId}/designs`, "POST", b),
  editDesign: (id: string, b: Record<string, unknown>) => send<{ ok: true }>(`/api/brand-center/designs/${id}`, "PATCH", b),
  retireDesign: (id: string) => call<{ ok: true }>(`/api/brand-center/designs/${id}`, { method: "DELETE" }),
};
