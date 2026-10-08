/* Brand Center — the browser side of /api/brand-center/*: types and calls.
   Every call answers { ok, data } or { ok: false, status, error } so a
   screen can say what went wrong instead of spinning. */

export type I18n = Partial<Record<"en" | "zh" | "ar", string>>;
export interface BcOption { id: string; type_id: string; key: string; label: string; label_i18n: I18n; recommended: boolean; chosen: boolean; sort: number }
export interface BcType { id: string; key: string; label: string; label_i18n: I18n; sort: number; options: BcOption[] }
import type { ItemRules } from "./rules";
export interface BcFile { id: string; design_id: string; file_name: string; mime: string | null; size_bytes: number | null; purpose: string; created_at: string }
export interface BcDesign { id: string; item_id?: string; option_ids: string[]; name: string; kind: string; status: "draft" | "active" | "retired"; is_default: boolean; notes: string | null; updated_at: string; files?: BcFile[] }
export interface BcItem {
  id: string; group_id: string | null; key: string; name: string; name_i18n: I18n; use_text: string | null;
  importance: "core" | "optional" | "later"; decision: "yes" | "later" | "no"; status: "draft" | "approved" | "retired";
  note: string | null; owner_note: string | null; sort: number;
  /** The item's rules (C19–C39), {} until its section is built. */
  rules?: ItemRules | null;
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

/** Someone a fill-in template can be filled for (GET /api/brand-center/people). */
export interface BcPerson {
  id: string; name: string; nameAlt: string | null;
  /** The position's title in English, and in Chinese / Arabic when translated. */
  title: string | null; titleZh: string | null; titleAr: string | null;
  department: string | null; email: string | null; mobile: string | null;
  /** The profile photo (public URL), for the portrait cards and the ID badge. */
  photo: string | null;
  /** The staff number, for the ID badge. */
  staffNo: string | null;
}

/** A product found by the post studio's search (GET /api/brand-center/products?q=);
 *  `photo` is a small first-party thumbnail. */
export interface BcProductHit { id: string; name: string; model: string | null; category: string | null; photo: string | null }
/** A product a post can be made for (GET /api/brand-center/products?id=) —
 *  active products only, and only what a post may show: never a price,
 *  never a supplier (the model is the KOLEEX commercial code). */
export interface BcProduct extends BcProductHit {
  /** The name in Chinese / Arabic when translated. */
  nameZh: string | null; nameAr: string | null;
  categoryZh: string | null; categoryAr: string | null;
  /** Short selling points, the product's own order. */
  highlights: string[];
  /** The feature highlights (title, text, a photo of the detail). */
  features: Array<{ title: string; titleZh: string | null; titleAr: string | null; text: string | null; textZh: string | null; textAr: string | null; image: string | null }>;
}

/** A template style's standing: approved = everyone's choice; draft = only
 *  those who manage Brand Center; retired = hidden, never deleted. */
export type StyleStatus = "approved" | "draft" | "retired";
/** One side of a designer's template: the SVG as uploaded (cleaned in the browser). */
export interface BcSvgPage { fileId: string; fileName: string; svg: string; widthMm: number | null; heightMm: number | null }

/** A saved fill of a template ("my templates"); pictures are never kept. */
export interface BcSaved { id: string; account_id: string; template_id: string; name: string; fill: Record<string, unknown>; shared: boolean; mine: boolean; updated_at: string }

export const bc = {
  saved: (template: string) => call<{ canShare: boolean; saved: BcSaved[] }>(`/api/brand-center/saved?template=${encodeURIComponent(template)}`),
  saveTemplate: (b: { templateId: string; name: string; fill: Record<string, unknown>; shared: boolean }) => send<{ saved: BcSaved }>("/api/brand-center/saved", "POST", b),
  editSaved: (id: string, b: { name?: string; fill?: Record<string, unknown>; shared?: boolean }) => send<{ saved: BcSaved }>(`/api/brand-center/saved/${id}`, "PATCH", b),
  deleteSaved: (id: string) => call<{ ok: true }>(`/api/brand-center/saved/${id}`, { method: "DELETE" }),
  people: () => call<{ scope: "all" | "self"; people: BcPerson[] }>("/api/brand-center/people"),
  /** Which styles are approved, drafts or retired (no entry = approved). */
  styles: (template: string) => call<{ canManage: boolean; statuses: Record<string, StyleStatus> }>(`/api/brand-center/styles?template=${encodeURIComponent(template)}`),
  /** A designer's template (C18): its SVG files, front then back. */
  designTemplate: (designId: string) => call<{ design: { id: string; name: string }; pages: BcSvgPage[] }>(`/api/brand-center/designs/${designId}/template`),
  setStyle: (b: { templateId: string; style: string; status: StyleStatus }) => send<{ ok: true }>("/api/brand-center/styles", "PUT", b),
  products: (q: string) => call<{ products: BcProductHit[] }>(`/api/brand-center/products?q=${encodeURIComponent(q)}`),
  product: (id: string) => call<{ product: BcProduct }>(`/api/brand-center/products?id=${encodeURIComponent(id)}`),
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

/* ── files (plan step C5) ──────────────────────────────────────────────── */

/** Mirrors the server's DIRECT_UPLOAD_OVER: up to this size the file goes
 *  through our route (reliable on every line), above it straight to storage. */
const THROUGH_US_MAX = 4.2 * 1024 * 1024;

export type UploadError = "too_big" | "direct_blocked" | "failed";

/** Upload one file to a design. Answers the saved file row, or why not. */
export async function uploadDesignFile(designId: string, file: File): Promise<{ ok: true; file: BcFile } | { ok: false; error: UploadError }> {
  const url = `/api/brand-center/designs/${designId}/files`;
  if (file.size > 500 * 1024 * 1024) return { ok: false, error: "too_big" };
  if (file.size <= THROUGH_US_MAX) {
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await fetch(url, { method: "POST", body: form });
      const body = await r.json().catch(() => ({}));
      return r.ok ? { ok: true, file: (body as { file: BcFile }).file } : { ok: false, error: "failed" };
    } catch { return { ok: false, error: "failed" }; }
  }
  /* Large: sign → PUT to storage → register. The PUT is the one hop with
     nothing of ours in it; when it fails we say so plainly. */
  const sign = await send<{ path: string; token: string; signedUrl: string }>(url, "POST", { action: "sign", fileName: file.name, size: file.size, mime: file.type });
  if (!sign.ok) return { ok: false, error: "failed" };
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const target = /^https?:\/\//i.test(sign.data.signedUrl) ? sign.data.signedUrl
    : `${base}/storage/v1${sign.data.signedUrl.startsWith("/") ? "" : "/"}${sign.data.signedUrl}`;
  try {
    const put = await fetch(target, { method: "PUT", body: file, headers: file.type ? { "Content-Type": file.type } : {} });
    if (!put.ok) return { ok: false, error: "direct_blocked" };
  } catch { return { ok: false, error: "direct_blocked" }; }
  const reg = await send<{ file: BcFile }>(url, "POST", { action: "register", path: sign.data.path, fileName: file.name, size: file.size, mime: file.type });
  return reg.ok ? { ok: true, file: reg.data.file } : { ok: false, error: "failed" };
}

export const deleteDesignFile = (id: string) => call<{ ok: true }>(`/api/brand-center/files/${id}`, { method: "DELETE" });
export const fileDownloadHref = (id: string) => `/api/brand-center/files/${id}`;
