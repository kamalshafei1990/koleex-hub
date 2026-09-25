import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the types made in the template builder and the built-in
   types a tenant has hidden (Phase 4E). The rules are the pure
   src/lib/reports/custom-templates.ts; this file only reads the rows.

   Tables: work_report_templates, work_report_hidden_templates (RLS on, no
   policies — the service role here is the only way in). Every read is the
   tenant's own.

   Who may manage them: super admins, and whoever holds "Report Templates"
   in Roles (a capability row — src/lib/permission-modules.ts): view opens
   the builder, create makes a type, edit changes one and hides or shows a
   built-in, delete removes a type no report uses yet.
   --------------------------------------------------------------------------- */

import crypto from "node:crypto";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import {
  asReportTemplate, readSnapshot, type CustomDef, type CustomTemplateHead, type TemplateWords, type Word,
} from "@/lib/reports/custom-templates";
import type { ReportCadence, ReportFamily, ReportTemplateDef } from "@/lib/reports/templates";
import type { RrIconName } from "@/components/ui/RrIcon";

export const TEMPLATES_MODULE = "Report Templates";

export interface TemplateRights { view: boolean; create: boolean; edit: boolean; delete: boolean }

/** What this person may do in the builder — one wave, never four trips. */
export async function templateRights(auth: ServerAuthContext): Promise<TemplateRights> {
  const [view, create, edit, del] = await Promise.all(
    (["view", "create", "edit", "delete"] as const).map((a) => requireModuleAction(auth, TEMPLATES_MODULE, a)),
  );
  return { view: view === null, create: create === null, edit: edit === null, delete: del === null };
}

export interface CustomRow {
  key: string;
  def: CustomDef;
  words: TemplateWords;
  status: "active" | "archived";
  version: number;
  updated_at: string;
}

type HeadRow = {
  key: string; family: string | null; icon: string | null; cadence: string | null; hr_only: boolean | string | null;
  name: Word | null; desc: Word | null; status: string; version: number; updated_at: string;
};

/** The tenant's builder types, named — for the picker (active ones) and
 *  the builder's list (all). Only the few fields a list shows travel. */
export async function loadCustomHeads(tenantId: string | null, opts: { activeOnly?: boolean } = {}): Promise<CustomTemplateHead[]> {
  let q = supabaseServer.from("work_report_templates")
    .select("key, family:def->>family, icon:def->>icon, cadence:def->>cadence, hr_only:def->hrOnly, name:words->name, desc:words->desc, status, version, updated_at")
    .order("created_at", { ascending: true }).limit(200);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  if (opts.activeOnly) q = q.eq("status", "active");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as HeadRow[]).map((r) => ({
    key: r.key,
    family: (r.family ?? "work") as ReportFamily,
    icon: (r.icon ?? "document") as RrIconName,
    cadence: (r.cadence === "daily" || r.cadence === "weekly" || r.cadence === "monthly" ? r.cadence : null) as ReportCadence,
    hrOnly: r.hr_only === true || r.hr_only === "true",
    name: r.name ?? {},
    desc: r.desc ?? {},
    status: r.status === "archived" ? "archived" : "active",
    version: r.version,
    updatedAt: r.updated_at,
  }));
}

/** The built-in types this tenant hides. */
export async function loadHiddenKeys(tenantId: string | null): Promise<string[]> {
  let q = supabaseServer.from("work_report_hidden_templates").select("template_key").limit(500);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return Array.from(new Set(((data ?? []) as Array<{ template_key: string }>).map((r) => r.template_key)));
}

/** One builder type of this tenant, whole — or null. */
export async function loadCustomTemplate(tenantId: string | null, key: string): Promise<CustomRow | null> {
  let q = supabaseServer.from("work_report_templates").select("key, def, words, status, version, updated_at").eq("key", key);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as CustomRow;
  /* Read back through the snapshot reader: a malformed row is refused, never guessed. */
  const snap = readSnapshot({ v: r.version, def: r.def, words: r.words });
  return snap ? { ...r, def: snap.def, words: snap.words } : null;
}

/** A builder type as the engine takes it (its current version). */
export const customAsTemplate = (row: CustomRow): ReportTemplateDef => asReportTemplate(row.key, row.def, row.version);

/** A fresh key: "c-" and ten letters or digits. */
export function newTemplateKey(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(10);
  let out = "c-";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
