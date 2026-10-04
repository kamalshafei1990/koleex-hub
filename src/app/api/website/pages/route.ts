import "server-only";

/* ---------------------------------------------------------------------------
   GET  /api/website/pages — the public site's pages for the Website app's
        Page Builder: slug, name, title, its published version, whether the
        draft has changes not yet live, the old editor's sections (shown
        until the page is published) and when it last changed.
   POST /api/website/pages { name, slug } — a new page (Website create); it
        reaches the site when it is first published.
   The builder replaced the frame on the site's old /admin (removed with the
   bridge, 30/09/2026: it wrote to the Hub's product tables from the browser).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { allRowsOrThrow } from "@/lib/server/all-rows";
import { builderJson, guardWebsite } from "@/lib/server/website/guard";
import { createPage, isError } from "@/lib/server/website/pages";
import type { WebsitePageRow } from "@/lib/website-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardWebsite("view");
  if (auth instanceof NextResponse) return auth;
  try {
    const [pages, sections] = await Promise.all([
      allRowsOrThrow<{ id: string; slug: string; name: string; title: string | null; updated_at: string | null; draft: unknown; published: unknown; version: number | null; published_at: string | null; draft_updated_at: string | null }>(
        "website pages", supabaseServer.from("pages").select("id, slug, name, title, updated_at, draft, published, version, published_at, draft_updated_at").order("name").order("id")),
      allRowsOrThrow<{ page_id: string }>(
        "website sections", supabaseServer.from("sections").select("page_id").eq("visible", true).order("id")),
    ]);
    const count = new Map<string, number>();
    for (const s of sections) count.set(s.page_id, (count.get(s.page_id) ?? 0) + 1);
    const rows: WebsitePageRow[] = pages.map((p) => {
      const version = p.version ?? 0;
      return {
        slug: p.slug, name: p.name, title: p.title,
        sections: count.get(p.id) ?? 0,
        version,
        changed: !!p.draft && (version === 0 || JSON.stringify(p.draft) !== JSON.stringify(p.published)),
        publishedAt: p.published_at,
        updatedAt: [p.draft_updated_at, p.published_at, p.updated_at].filter((x): x is string => !!x).sort().pop() ?? null,
      };
    });
    return builderJson({ pages: rows });
  } catch (e) {
    console.error(`[website/pages] ${(e as Error).message}`);
    return builderJson({ error: "The pages could not be loaded." }, 500);
  }
}

export async function POST(req: Request) {
  const auth = await guardWebsite("create");
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => null)) as { name?: unknown; slug?: unknown } | null;
  try {
    const r = await createPage({ name: body?.name, slug: body?.slug });
    if (isError(r)) return builderJson({ error: r.error, code: r.code }, r.status);
    return builderJson(r, 201);
  } catch (e) {
    console.error(`[website/pages] ${(e as Error).message}`);
    return builderJson({ error: "The page could not be created." }, 500);
  }
}
