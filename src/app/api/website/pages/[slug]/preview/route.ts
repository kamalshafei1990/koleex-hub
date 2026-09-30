/* GET /api/website/pages/[slug]/preview — a 10-minute link that opens the
   page's draft on the site (signed with the bridge key). Website view. */

import { NextResponse } from "next/server";
import { builderJson, guardWebsite } from "@/lib/server/website/guard";
import { previewLink } from "@/lib/server/website/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await guardWebsite("view");
  if (auth instanceof NextResponse) return auth;
  const url = previewLink((await params).slug);
  return url ? builderJson({ url }) : builderJson({ error: "The website bridge is not configured.", code: "no_bridge" }, 503);
}
