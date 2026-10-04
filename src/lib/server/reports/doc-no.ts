import "server-only";

/* ---------------------------------------------------------------------------
   The number a customer copy carries (owner, 28/09/2026): SR-2026-0001 for a
   service report, IR-2026-0001 for an installation.

   Minted once, when the report is FIRST sent; a revised version keeps its
   first version's number (it is the same visit). The year is Taizhou's.
   Two technicians sending at the same moment can pick the same next number:
   the unique index (tenant, number, version) refuses the second, which takes
   the one after it.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ReportTemplateDef } from "@/lib/reports/templates";
import type { ReportRow } from "@/lib/server/reports/core";

const yearInTaizhou = (d: Date) => new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Asia/Shanghai" }).format(d);

/** The number this report sends with — kept, inherited, or the next free
 *  one — and a function that tells whether a write failed on a taken number. */
export async function docNoFor(row: Pick<ReportRow, "tenant_id" | "doc_no" | "previous_id">, tpl: Pick<ReportTemplateDef, "customerCopy">, skip = 0): Promise<string | null> {
  if (!tpl.customerCopy) return null;
  if (row.doc_no) return row.doc_no;
  if (row.previous_id) {
    const { data } = await supabaseServer.from("work_reports").select("doc_no").eq("id", row.previous_id).maybeSingle();
    const prev = (data as { doc_no: string | null } | null)?.doc_no;
    if (prev) return prev;
  }
  const prefix = `${tpl.customerCopy}-${yearInTaizhou(new Date())}-`;
  /* Padded to four digits, so the highest sorts last (to 9999 a year). */
  let q = supabaseServer.from("work_reports").select("doc_no").like("doc_no", `${prefix}%`);
  if (row.tenant_id) q = q.eq("tenant_id", row.tenant_id);
  const { data } = await q.order("doc_no", { ascending: false }).limit(1);
  const last = ((data ?? []) as Array<{ doc_no: string | null }>)[0]?.doc_no ?? null;
  const n = (last ? Number.parseInt(last.slice(prefix.length), 10) || 0 : 0) + 1 + skip;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** A write refused because the number was just taken by someone else. */
export const isTakenNumber = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === "23505" || /work_reports_tenant_doc_no_version_key/.test(error.message ?? ""));
