/* GET /api/website/pages/[slug] — one page for the Page Builder: its draft
   (the saved draft, else the published copy, else empty), whether it differs
   from what the site shows, its version, and whether this account may
   publish it. */

import { NextResponse } from "next/server";
import { builderJson, guardWebsite } from "@/lib/server/website/guard";
import { canPublish, getBuilderPage, previewLink } from "@/lib/server/website/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await guardWebsite("view");
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  try {
    const page = await getBuilderPage(slug);
    if (!page) return builderJson({ error: "No such page." }, 404);
    return builderJson({ page, canPublish: await canPublish(auth), canPreview: previewLink(slug) !== null });
  } catch (e) {
    console.error(`[website/page] ${(e as Error).message}`);
    return builderJson({ error: "The page could not be loaded." }, 500);
  }
}
