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
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { refine, persistUnits, type RefinerySegment } from "@/lib/server/ai-knowledge";
import { assertSafeUrl } from "@/lib/server/safe-url";
import { dbError } from "@/lib/server/ai/http/api-error";

/* THE PAGE FETCH IS BOUNDED. A page is read up to this many bytes and then
   cut off — a host that streams for ever must not fill the function's
   memory (audit, 2026-09-11). Same ceiling the UI copy promises ("up to 2 MB"). */
const PAGE_MAX_BYTES = 2_000_000;
const PAGE_MAX_HOPS = 3;

/** The body up to `max` bytes, cut there — never the whole stream. */
async function readCappedText(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, max);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
    if (total >= max) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const out = new Uint8Array(Math.min(total, max));
  let off = 0;
  for (const c of chunks) {
    const take = Math.min(c.byteLength, out.byteLength - off);
    if (take <= 0) break;
    out.set(c.subarray(0, take), off);
    off += take;
  }
  return new TextDecoder().decode(out);
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KINDS = ["catalog", "manual", "policy", "document", "webpage", "note"];

/* Crude-but-honest HTML → text: drop script/style/nav chrome, keep block
   boundaries as newlines, decode common entities. Good enough for the
   Refinery; the approval bench is the quality gate. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|footer|header|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>(?=.)/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

  /* READ is grantable, WRITE is not. The super admin can hand "AI Knowledge"
     to an account so it can open the bench and read the corpus; ingesting
     sources and approving units stay his alone, because approval is what
     decides what the AI treats as true. */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, "AI Knowledge", "view");
  if (denied) return denied;

  /* ONE TENANT'S ROWS ONLY — the same rule qa/route.ts applies. Without
     the predicate this list showed every tenant's titles, URLs and error
     strings to any account holding the AI Knowledge module (audit,
     2026-09-11). */
  let srcQ = supabaseServer
    .from("ai_sources")
    .select("id, title, kind, origin, domain, lang, status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  srcQ = auth.tenant_id == null ? srcQ.is("tenant_id", null) : srcQ.eq("tenant_id", auth.tenant_id);
  let kuQ = supabaseServer.from("ai_knowledge_units").select("source_id, status");
  kuQ = auth.tenant_id == null ? kuQ.is("tenant_id", null) : kuQ.eq("tenant_id", auth.tenant_id);
  const [srcRes, kuRes] = await Promise.all([srcQ, kuQ]);
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
      if (typeof body.url === "string" && body.url.trim()) {
        /* Teach from the web: fetch one page server-side and refine it.
           Every unit keeps the URL as its origin so citations in Phase 2
           point back to the exact page. */
        const url = body.url.trim();
        if (!/^https?:\/\//i.test(url) || url.length > 2048) {
          return NextResponse.json({ error: "URL must start with http(s)://" }, { status: 400 });
        }
        /* OUR SERVER FETCHES WHAT THE OWNER PASTED — the SSRF shape. The
           address goes through the same gate as the picture proxy: scheme,
           name and every resolved IP checked, redirects followed by hand so
           a public page cannot 302 inward (audit, 2026-09-11). */
        let current: URL;
        try {
          current = await assertSafeUrl(url);
        } catch (e) {
          const why = e instanceof Error ? e.message : "bad_url";
          return NextResponse.json(
            { error: why === "blocked_host" ? "That address cannot be read from here." : "That URL could not be reached." },
            { status: 400 },
          );
        }
        const signal = AbortSignal.timeout(20000);
        let resp: Response | null = null;
        for (let hop = 0; hop <= PAGE_MAX_HOPS; hop++) {
          resp = await fetch(current.toString(), {
            headers: { "User-Agent": "KoleexHub-KnowledgeBot/1.0" },
            redirect: "manual",
            signal,
          });
          if (resp.status >= 300 && resp.status < 400) {
            const loc = resp.headers.get("location");
            if (!loc) break;
            try {
              current = await assertSafeUrl(new URL(loc, current).toString());
            } catch {
              return NextResponse.json({ error: "That address cannot be read from here." }, { status: 400 });
            }
            resp = null;
            continue;
          }
          break;
        }
        if (!resp) {
          return NextResponse.json({ error: "Too many redirects." }, { status: 400 });
        }
        if (!resp.ok) {
          return NextResponse.json({ error: `Fetch failed: HTTP ${resp.status}` }, { status: 400 });
        }
        const raw = await readCappedText(resp, PAGE_MAX_BYTES);
        const textContent = htmlToText(raw);
        if (textContent.length < 200) {
          return NextResponse.json({ error: "Page has too little readable text (JS-rendered pages are not supported yet)." }, { status: 400 });
        }
        segments = [{ page: 0, text: textContent }];
        origin = url;
        mime = "text/html";
        if (!kind || kind === "document") kind = "webpage";
        if (!title) {
          const m = raw.match(/<title[^>]*>([\s\S]{1,200}?)<\/title>/i);
          title = (m ? m[1].replace(/\s+/g, " ").trim() : url).slice(0, 120);
        }
      } else if (Array.isArray(body.segments) && body.segments.length) {
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
    /* The cause goes to the log, not to the browser: a fetch failure's text
       names hosts and addresses. */
    console.error("[ai.knowledge.sources] read failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not read the source." }, { status: 400 });
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
  if (srcErr || !src) return dbError("knowledge/sources insert", srcErr ?? "no row");

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
    console.error("[ai.knowledge.sources] refinery failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Refinery failed." }, { status: 500 });
  }
}
