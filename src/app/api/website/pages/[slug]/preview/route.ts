/* GET /api/website/pages/[slug]/preview — a 10-minute link that opens the
   page's draft on the site (signed with the bridge key), in ?lang= (the
   language the editor is writing in). Website view. */

import { NextResponse } from "next/server";
import { builderJson, guardWebsite } from "@/lib/server/website/guard";
import { previewLink } from "@/lib/server/website/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await guardWebsite("view");
  if (auth instanceof NextResponse) return auth;
  const url = previewLink((await params).slug, Date.now(), new URL(req.url).searchParams.get("lang") ?? "en");
  return url ? builderJson({ url }) : builderJson({ error: "The website bridge is not configured.", code: "no_bridge" }, 503);
}
