/* ---------------------------------------------------------------------------
   /api/ai/knowledge/sources — Knowledge plane Phase 1 (schema gate signed
   2026-08-06).

   GET  → sources with unit counts (drafts/approved) for the queue UI.
   POST → create a source and run Refinery v1 SYNCHRONOUSLY for v1 sizes
          (a 48-page catalog extracts + refines in a few seconds; the
          chunked-background upgrade is Phase 2 work if real inputs demand
          it). Accepts JSON {title, kind, domain, lang, text} OR multipart
          with a PDF/Markdown file (unpdf extracts text serverlessly).

   Gate: SUPER ADMIN only — the approval queue is the owner's bench in v1
   (D2: write-side stays with Kamal). Tables are RLS deny-all; every read
   and write goes through this service-role gateway.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { refine, persistUnits, type RefinerySegment } from "@/lib/server/ai-knowledge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KINDS = ["catalog", "manual", "policy", "document", "webpage", "note"];

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [srcRes, kuRes] = await Promise.all([
    supabaseServer
      .from("ai_sources")
      .select("id, title, kind, origin, domain, lang, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseServer.from("ai_knowledge_units").select("source_id, status"),
  ]);
  if (srcRes.error) return NextResponse.json({ error: srcRes.error.message }, { status: 500 });

  const counts: Record<string, { draft: number; approved: number; retired: number }> = {};
  for (const r of (kuRes.data ?? []) as Array<{ source_id: string; status: string }>) {
    const c = (counts[r.source_id] ??= { draft: 0, approved: 0, retired: 0 });
    if (r.status === "draft") c.draft++;
    else if (r.status === "approved") c.approved++;
    else c.retired++;
  }
  return NextResponse.json({ sources: srcRes.data ?? [], counts });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let title = "";
  let kind = "document";
  let domain: string | null = null;
  let lang: string | null = null;
  let origin = "pasted";
  let mime = "text/plain";
  let segments: RefinerySegment[] = [];

  const ctype = req.headers.get("content-type") || "";
  try {
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      title = String(form.get("title") || "").trim();
      kind = String(form.get("kind") || "document");
      domain = String(form.get("domain") || "").trim() || null;
      lang = String(form.get("lang") || "").trim() || null;
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }
      origin = file.name;
      mime = file.type || "application/octet-stream";
      if (!title) title = file.name.replace(/\.[^.]+$/, "");

      if (mime === "application/pdf" || /\.pdf$/i.test(file.name)) {
        /* unpdf — serverless PDF text extraction, per-page segments so
           every unit keeps its page lineage. */
        const { extractText, getDocumentProxy } = await import("unpdf");
        const buf = new Uint8Array(await file.arrayBuffer());
        const doc = await getDocumentProxy(buf);
        const { text } = await extractText(doc, { mergePages: false });
        segments = (text as string[]).map((t, i) => ({ page: i + 1, text: t || "" }));
      } else {
        segments = [{ page: 0, text: await file.text() }];
      }
    } else {
      const body = await req.json();
      title = String(body.title || "").trim();
      kind = String(body.kind || "document");
      domain = body.domain ? String(body.domain) : null;
      lang = body.lang ? String(body.lang) : null;
      if (Array.isArray(body.segments) && body.segments.length) {
        /* Pre-extracted per-page text (e.g. OCR of an image-only PDF) —
           lineage keeps the page numbers the caller supplies. */
        segments = (body.segments as Array<{ page?: number; text?: string }>)
          .map((sg, i) => ({ page: Number(sg.page ?? i + 1), text: String(sg.text ?? "") }));
        origin = String(body.origin || "ocr");
        mime = "text/plain";
      } else {
        const text = String(body.text || "");
        if (!text.trim()) return NextResponse.json({ error: "text or segments is required" }, { status: 400 });
        segments = [{ page: 0, text }];
      }
    }
  } catch (e) {
    return NextResponse.json({ error: `Could not read the source: ${String(e)}` }, { status: 400 });
  }

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!KINDS.includes(kind)) kind = "document";

  const { data: src, error: srcErr } = await supabaseServer
    .from("ai_sources")
    .insert({
      tenant_id: auth.tenant_id ?? null,
      title, kind, origin, mime, lang, domain,
      status: "ingesting",
      created_by: auth.account_id ?? null,
    })
    .select("id")
    .single();
  if (srcErr || !src) return NextResponse.json({ error: srcErr?.message || "insert failed" }, { status: 500 });

  try {
    const units = refine(segments);
    const inserted = await persistUnits({
      sourceId: src.id,
      tenantId: auth.tenant_id ?? null,
      domain, lang, units,
    });
    await supabaseServer
      .from("ai_sources")
      .update({ status: "ready", meta: { pages: segments.length, units: inserted }, updated_at: new Date().toISOString() })
      .eq("id", src.id);
    return NextResponse.json({ id: src.id, units: inserted, pages: segments.length });
  } catch (e) {
    await supabaseServer
      .from("ai_sources")
      .update({ status: "failed", error: String(e), updated_at: new Date().toISOString() })
      .eq("id", src.id);
    return NextResponse.json({ error: `Refinery failed: ${String(e)}` }, { status: 500 });
  }
}
