/* ---------------------------------------------------------------------------
   Reports app — the browser's client for /api/work-reports/*. Every call
   goes through the server (the tables are service-role only); nothing here
   touches Supabase directly.
   --------------------------------------------------------------------------- */

import type { ReportDataValue, ReportSectionValue, ReportTemplateDef } from "@/lib/reports/templates";
import type { CustomDef, CustomTemplateHead } from "@/lib/reports/custom-templates";
import type { TemplateHead, TemplateWords } from "@/lib/reports/template-words";
import type { Translations } from "@/lib/i18n";
import type { CarryGroup } from "@/lib/reports/carry";
import type { ReportAttachment } from "@/lib/reports/attachments";
import type { AppRecord } from "@/lib/reports/app-feed";
import type { AiDraftRequest } from "@/lib/reports/ai-draft";
import type { BoardRow, BoardSummary, DueItem, Obliged } from "@/lib/reports/obligations";

export type ReportStatus = "draft" | "submitted" | "approved" | "returned";

export interface ReportPerson { id: string; name: string; nameAlt: string | null; avatar: string | null; position?: string | null }

export interface ReportListRow {
  id: string;
  templateKey: string;
  title: string;
  authorId: string;
  authorName: string;
  authorNameAlt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  periodKey: string | null;
  status: ReportStatus;
  confidential: boolean;
  reviewRequired: boolean;
  version: number;
  submittedAt: string | null;
  updatedAt: string;
  myRole: "to" | "cc" | null;
  readAt: string | null;
  acknowledgedAt: string | null;
  /** A builder type (4E): its name, icon and period as the report was started with it. */
  tpl?: TemplateHead;
}

export interface ReportsBundle {
  /** templates: may open the template builder (4E). */
  me: { id: string; managerId: string | null; hasTeam: boolean; board?: boolean; templates?: boolean };
  /** Phase 3A: what this person owes now. */
  due?: DueItem[];
  counts: { unread: number; review: number; drafts: number; sentThisMonth: number };
  latest: ReportListRow[];
  /** The built-in types this person may start (hidden ones left out — 4E). */
  templates: string[];
  /** The builder types this person may start, named (4E). */
  custom?: CustomTemplateHead[];
  people: ReportPerson[];
  library: { hr: boolean; finance: boolean; tasks: boolean };
}

export interface ReportRecipient extends ReportPerson { role: "to" | "cc"; readAt: string | null; acknowledgedAt: string | null }
export interface ReportComment { id: string; author: ReportPerson; body: string; kind: "comment" | "approved" | "returned"; createdAt: string }

export interface ReportDetail {
  report: {
    id: string; templateKey: string; title: string; author: ReportPerson;
    periodStart: string | null; periodEnd: string | null; periodKey: string | null;
    sections: ReportSectionValue[]; status: ReportStatus; confidential: boolean; reviewRequired: boolean;
    version: number; previousId: string | null; superseded: boolean; newerId: string | null;
    submittedAt: string | null; decidedAt: string | null; decidedBy: ReportPerson | null;
    createdAt: string; updatedAt: string;
  };
  recipients: ReportRecipient[];
  comments: ReportComment[];
  access: "author" | "recipient" | "manager" | "super_admin";
  can: { edit: boolean; remove: boolean; revise: boolean; decide: boolean; acknowledge: boolean; comment: boolean };
  people?: ReportPerson[];
  /** The author's draft only: suggestions from their earlier reports. */
  carry?: CarryGroup[];
  /** Photos and files, in order (ids only — see reportFileUrl). */
  attachments?: ReportAttachment[];
  /** The author's draft only: their own work in the apps around the period
   *  (raw facts; the composer picks the days and words them). */
  appFeed?: AppRecord[];
  /** The author's draft only: its numbers blocks as the server computes
   *  them now, by section id (a sent report has them frozen in its sections). */
  blockData?: Record<string, ReportDataValue>;
  /** A builder type (4E): the type as this report was started with it, and
   *  its words as the dictionary holds them (`tpl.<key>.…`). */
  template?: { def: ReportTemplateDef; words: Translations };
}

export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string; extra?: Record<string, unknown> };

async function call<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...(init?.headers ?? {}) } : init?.headers,
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) return { ok: false, status: res.status, error: json?.error ?? `HTTP ${res.status}`, extra: (json ?? undefined) as Record<string, unknown> | undefined };
    return { ok: true, data: json as T };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "network" };
  }
}

export const fetchReportsBundle = () => call<ReportsBundle>("/api/work-reports/bundle");
export const fetchReport = (id: string) => call<ReportDetail>(`/api/work-reports/${id}`);

/** `request`: start the report an event asked for (Phase 3D) — it opens
 *  with the event's facts, worded in `lang`. */
export const createReport = (templateKey: string, date: string, opts?: { title?: string; request?: string; lang?: string }) =>
  call<{ id: string; existing: boolean }>("/api/work-reports", { method: "POST", body: JSON.stringify({ template_key: templateKey, date, ...opts }) });

/** `keepalive` lets the last save finish while the tab is closing. */
export const saveDraft = (id: string, patch: { title?: string; date?: string; dateTo?: string; sections?: ReportSectionValue[]; to?: string[]; cc?: string[]; confidential?: boolean }, opts?: { keepalive?: boolean }) =>
  call<{ ok: true; savedAt: string }>(`/api/work-reports/${id}`, { method: "PATCH", body: JSON.stringify(patch), keepalive: opts?.keepalive });

export const deleteDraft = (id: string) => call<{ ok: true }>(`/api/work-reports/${id}`, { method: "DELETE" });
export async function submitReport(id: string) {
  const res = await call<{ ok: true; submittedAt: string }>(`/api/work-reports/${id}/submit`, { method: "POST" });
  /* What the person owes just changed: the work snapshot (Home's greeting
     reads "your report is due" from it) must not keep saying so. */
  if (res.ok) void import("@/lib/client-cache").then(({ invalidateCachedGet }) => invalidateCachedGet("/api/me/work"));
  return res;
}
export const decideReport = (id: string, action: "approve" | "return" | "acknowledge", note?: string) =>
  call<{ ok: true }>(`/api/work-reports/${id}/decision`, { method: "POST", body: JSON.stringify({ action, note }) });
export const commentOnReport = (id: string, body: string) =>
  call<{ comment: ReportComment }>(`/api/work-reports/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) });
export const reviseReport = (id: string) => call<{ id: string; existing: boolean }>(`/api/work-reports/${id}/revise`, { method: "POST" });
/** One photo or file onto a draft, with upload progress (0..1) — an XHR,
 *  because fetch cannot report upload progress, and on a slow line "is it
 *  moving?" is the question. One more try when the connection drops (a
 *  dropped connection is not a refusal); an HTTP answer is reported as-is. */
export function uploadReportAttachment(
  id: string,
  parts: { file: Blob; name: string; thumb?: Blob | null; width?: number; height?: number },
  onProgress?: (fraction: number) => void,
): Promise<Result<{ attachment: ReportAttachment }>> {
  const once = () => new Promise<Result<{ attachment: ReportAttachment }>>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/work-reports/${id}/attachments`);
    xhr.withCredentials = true;
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && e.total) onProgress?.(Math.min(1, e.loaded / e.total)); };
    xhr.onload = () => {
      let json: ({ attachment?: ReportAttachment; error?: string } & Record<string, unknown>) | null = null;
      try { json = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && json?.attachment) resolve({ ok: true, data: { attachment: json.attachment } });
      else resolve({ ok: false, status: xhr.status, error: json?.error ?? `HTTP ${xhr.status}`, extra: json ?? undefined });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, error: "network" });
    xhr.ontimeout = () => resolve({ ok: false, status: 0, error: "timeout" });
    const form = new FormData();
    form.append("file", parts.file, parts.name);
    form.append("name", parts.name);
    if (parts.thumb) form.append("thumb", parts.thumb, "thumb.jpg");
    if (parts.width) form.append("width", String(parts.width));
    if (parts.height) form.append("height", String(parts.height));
    xhr.send(form);
  });
  return once().then((res) => (!res.ok && res.status === 0 && res.error === "network" ? once() : res));
}

export const captionReportAttachment = (id: string, attId: string, caption: string) =>
  call<{ attachment: ReportAttachment }>(`/api/work-reports/${id}/attachments/${attId}`, { method: "PATCH", body: JSON.stringify({ caption }) });
export const deleteReportAttachment = (id: string, attId: string) =>
  call<{ ok: true }>(`/api/work-reports/${id}/attachments/${attId}`, { method: "DELETE" });

/** One thing a report can be linked to (Phase 4A). */
export interface LinkHit { id: string; label: string; sub?: string }
/** Search what a links block can point at; `denied` when the author does not
 *  have the app that owns that kind of record. */
export const searchReportLinks = (type: string, q: string) =>
  call<{ hits: LinkHit[]; denied?: boolean }>(`/api/work-reports/links/search?type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}`);

/** Koleex AI on one section of a draft (write / tidy) — a proposal only. */
export const askReportAi = (id: string, body: AiDraftRequest) =>
  call<{ text: string }>(`/api/work-reports/${id}/ai`, { method: "POST", body: JSON.stringify(body) });

/* ── Phase 3A: obligations and the compliance board ── */
export interface ComplianceBoard {
  week: { key: string; start: string; days: string[] };
  trackingFrom: string | null;
  canSetUp: boolean;
  rows: Array<BoardRow & { person: ReportPerson }>;
  summary: BoardSummary;
}
export interface ObligationSetup {
  trackingFrom: string | null;
  /** Phase 3B switches. */
  reminders: boolean;
  escalations: boolean;
  rows: Array<{ person: ReportPerson; isSuperAdmin: boolean; hasTeam: boolean; defaults: Obliged; exceptions: Partial<Obliged> }>;
}
export const fetchCompliance = (day: string) => call<ComplianceBoard>(`/api/work-reports/compliance?week=${encodeURIComponent(day)}`);
export const fetchObligations = () => call<ObligationSetup>("/api/work-reports/obligations");
export const saveObligations = (body: { trackingFrom?: string | null; reminders?: boolean; escalations?: boolean; exceptions?: Array<{ accountId: string; key: "daily" | "weekly" | "monthly"; required: boolean | null }> }) =>
  call<ObligationSetup>("/api/work-reports/obligations", { method: "PUT", body: JSON.stringify(body) });
/** A super admin's preview of who the reminder job would tell right now
 *  (nothing is sent). */
export interface NudgePreview { planned?: Array<{ key: string; periodKey: string; kind: "reminder" | "escalation"; dueAt: string; authorName: string; recipients: string[] }> }
export const previewNudges = () => call<NudgePreview>("/api/cron/report-reminders?dry=1");

/* ── The template builder (4E) ── */
export interface TemplateRights { view: boolean; create: boolean; edit: boolean; delete: boolean }
export interface TemplateList { custom: CustomTemplateHead[]; hidden: string[]; can: TemplateRights }
/** A type in the editor: a builder type whole, or (key null) a built-in as a copy's starting point. */
export interface TemplateDoc { key: string | null; def: CustomDef; words: TemplateWords; status?: "active" | "archived"; version?: number }
export const fetchTemplates = () => call<TemplateList>("/api/work-reports/templates");
export const fetchTemplateDoc = (key: string) => call<TemplateDoc>(`/api/work-reports/templates/${encodeURIComponent(key)}`);
export const createTemplate = (def: CustomDef, words: TemplateWords) =>
  call<{ key: string }>("/api/work-reports/templates", { method: "POST", body: JSON.stringify({ def, words }) });
export const saveTemplate = (key: string, def: CustomDef, words: TemplateWords, version: number) =>
  call<{ ok: true; version: number }>(`/api/work-reports/templates/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify({ def, words, version }) });
export const setTemplateStatus = (key: string, status: "active" | "archived") =>
  call<{ ok: true }>(`/api/work-reports/templates/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify({ status }) });
export const deleteTemplate = (key: string) => call<{ ok: true }>(`/api/work-reports/templates/${encodeURIComponent(key)}`, { method: "DELETE" });
export const setBuiltinHidden = (key: string, hidden: boolean) =>
  call<{ ok: true }>(`/api/work-reports/templates/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify({ hidden }) });

/** The draft's suggestions again, for the day / week / month it is moving to. */
export const fetchCarry = (id: string, date: string, to?: string) =>
  call<{ carry: CarryGroup[]; appFeed: AppRecord[]; blockData?: Record<string, ReportDataValue> }>(`/api/work-reports/${id}/carry?date=${encodeURIComponent(date)}${to ? `&to=${encodeURIComponent(to)}` : ""}`);

/** The browser's own calendar day (not the UTC one). */
export const localToday = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** D/M/Y, the Hub's standing date format. */
export function dmyDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m && iso.length <= 10) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function dmyTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${dmyDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** The period line a report shows: a day, a week span, or a month. */
export function periodLabel(start: string | null, end: string | null): string {
  if (!start) return "—";
  if (!end || end === start) return dmyDate(start);
  return `${dmyDate(start)} – ${dmyDate(end)}`;
}
