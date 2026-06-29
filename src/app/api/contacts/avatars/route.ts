import "server-only";

/* GET /api/contacts/avatars?ids=a,b,c
   Returns just the avatar images (logo_url / photo_url) for the given contact
   ids. The directory list (GET /api/contacts) drops heavy base64 avatars to stay
   under Vercel's function response limit; the client fetches them back here in
   small batches so logos still render without blocking the list. Tenant-scoped,
   read-only. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const ids = (new URL(req.url).searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 60); // keep each batch well under the response-size limit
  if (!ids.length) return NextResponse.json({ avatars: [] });

  const { data, error } = await supabaseServer
    .from("contacts")
    .select("id, logo_url, photo_url")
    .eq("tenant_id", auth.tenant_id)
    .in("id", ids);
  if (error) {
    console.error("[api/contacts/avatars]", error.message);
    return NextResponse.json({ avatars: [] });
  }

  // Only return rows that actually have an avatar — keeps the payload tiny.
  const avatars = (data ?? []).filter((r) => r.logo_url || r.photo_url);
  return NextResponse.json({ avatars }, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" },
  });
}
