import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/work-reports/about?type=customer|supplier|product|order&id=<id>&lang=en|zh|ar
   The reports linked to one record (Phase 4A) that THIS viewer may read —
   the report's own read rule, never wider: a draft only its author's, a
   confidential report only its author's and recipients'. Newest first, the
   latest version of each, at most 20. The record's page shows them — each
   with its type and status already worded in `lang`, so the card on another
   app's page carries none of the Reports dictionary.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireReportsUser } from "@/lib/server/reports/core";
import { listReportsAbout } from "@/lib/server/reports/links";
import { REPORT_LINK_TYPES, type ReportLinkType } from "@/lib/reports/templates";
import { reportsT } from "@/lib/translations/reports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ReportLinkType | null;
  const id = (url.searchParams.get("id") ?? "").trim();
  if (!type || !REPORT_LINK_TYPES.includes(type) || !id || id.length > 64) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const lang = url.searchParams.get("lang") === "zh" ? "zh" : url.searchParams.get("lang") === "ar" ? "ar" : "en";
  const word = (key: string) => ((reportsT[key]?.[lang] ?? reportsT[key]?.en) as string | undefined) ?? "";
  try {
    const rows = await listReportsAbout(auth, type, id);
    const reports = rows.map((r) => ({ ...r, typeName: word(`tpl.${r.templateKey}.name`) || r.templateKey, statusLabel: word(`status.${r.status}`) || r.status }));
    return NextResponse.json({ reports }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/work-reports/about]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not load reports." }, { status: 500 });
  }
}
