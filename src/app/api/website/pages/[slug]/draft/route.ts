/* PUT /api/website/pages/[slug]/draft — save the page's draft
   { draft, expected } (expected = the draftUpdatedAt the editor loaded).
   Website edit. 409 when someone saved in between. */

import { NextResponse } from "next/server";
import { builderJson, guardWebsite } from "@/lib/server/website/guard";
import { isError, saveDraft } from "@/lib/server/website/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await guardWebsite("edit");
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  const body = (await req.json().catch(() => null)) as { draft?: unknown; expected?: unknown } | null;
  if (!body || typeof body.draft !== "object") return builderJson({ error: "Nothing to save." }, 400);
  const expected = typeof body.expected === "string" ? body.expected : null;
  try {
    const r = await saveDraft(slug, body.draft, expected, auth.account_id);
    if (isError(r)) return builderJson({ error: r.error, code: r.code }, r.status);
    return builderJson(r);
  } catch (e) {
    console.error(`[website/draft] ${(e as Error).message}`);
    return builderJson({ error: "The draft could not be saved." }, 500);
  }
}
