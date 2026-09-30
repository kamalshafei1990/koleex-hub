import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/website/pages — the public site's pages, for the Website app's
   Page Builder tab: slug, name, title, how many visible sections each holds
   and when it last changed. Reads only.

   The tab used to frame the site's own /admin, which was removed with the
   bridge (30/09/2026, Phase 3 step 1: it wrote to the Hub's product tables
   from the browser). The builder itself is being rebuilt here, in the Hub
   (Phase 3 step 3); until then this list is what the tab shows.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { allRowsOrThrow } from "@/lib/server/all-rows";
import type { WebsitePageRow } from "@/lib/website-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Website");
  if (deny) return deny;
  try {
    const [pages, sections] = await Promise.all([
      allRowsOrThrow<{ id: string; slug: string; name: string; title: string | null; updated_at: string | null }>(
        "website pages", supabaseServer.from("pages").select("id, slug, name, title, updated_at").order("name").order("id")),
      allRowsOrThrow<{ page_id: string }>(
        "website sections", supabaseServer.from("sections").select("page_id").eq("visible", true).order("id")),
    ]);
    const count = new Map<string, number>();
    for (const s of sections) count.set(s.page_id, (count.get(s.page_id) ?? 0) + 1);
    const rows: WebsitePageRow[] = pages.map((p) => ({
      slug: p.slug, name: p.name, title: p.title, sections: count.get(p.id) ?? 0, updatedAt: p.updated_at,
    }));
    return NextResponse.json({ pages: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(`[website/pages] ${(e as Error).message}`);
    return NextResponse.json({ error: "The pages could not be loaded." }, { status: 500 });
  }
}
