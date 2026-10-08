/* POST /api/website/pages/[slug]/publish — the draft goes live as the next
   version. The super admins and whoever is given «Website Publish» (owner's
   pick); 400 with the problems when a section is not ready. */

import { NextResponse } from "next/server";
import { builderJson, guardWebsite } from "@/lib/server/website/guard";
import { canPublish, isError, publishPage } from "@/lib/server/website/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await guardWebsite("edit");
  if (auth instanceof NextResponse) return auth;
  if (!(await canPublish(auth))) return builderJson({ error: "Only the super admins and whoever is given «Website Publish» can publish.", code: "not_publisher" }, 403);
  const { slug } = await params;
  try {
    const r = await publishPage(slug, auth.account_id);
    if (isError(r)) return builderJson({ error: r.error, code: r.code, problems: r.problems }, r.status);
    return builderJson(r);
  } catch (e) {
    console.error(`[website/publish] ${(e as Error).message}`);
    return builderJson({ error: "The page could not be published." }, 500);
  }
}
