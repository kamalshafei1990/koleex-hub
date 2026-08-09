import "server-only";

/* GET /api/membership-requests/[id]/document?path=… — open a proof document.

   The bucket is private and has no public URL. This mints a signed URL that
   lives for five minutes and redirects to it, so the link a reviewer's browser
   follows is dead long before it could be pasted anywhere useful.

   The path is CHECKED AGAINST THE ROW, not trusted. Without that, a reviewer
   could read any object in the bucket by editing the query string — including
   another company's licence attached to an application they were never shown. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { isReviewer } from "@/lib/server/admin-recipients";

const BUCKET = "membership-docs";
const TTL_SECONDS = 300;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await isReviewer(auth.account_id))) {
    return NextResponse.json({ error: "Not a reviewer" }, { status: 403 });
  }

  const wanted = new URL(req.url).searchParams.get("path") ?? "";
  if (!wanted) return NextResponse.json({ error: "No path" }, { status: 400 });

  const { data: row } = await supabaseServer
    .from("membership_requests")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();
  const docs = ((row as { metadata?: { documents?: Array<{ path: string }> } } | null)
    ?.metadata?.documents ?? []) as Array<{ path: string }>;
  if (!docs.some((d) => d.path === wanted)) {
    /* 404, not 403: confirming that a path exists but belongs to a different
       request is itself an answer worth not giving. */
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: signed, error } = await supabaseServer.storage
    .from(BUCKET)
    .createSignedUrl(wanted, TTL_SECONDS);
  if (error || !signed?.signedUrl) {
    console.error("[api/membership-requests document]", error?.message);
    return NextResponse.json({ error: "Could not open the document." }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
