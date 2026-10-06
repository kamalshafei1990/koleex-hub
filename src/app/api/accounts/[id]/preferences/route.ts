import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
/* Its home is under ai/ for historical reasons — it was written to close N12,
   which was found in the AI memory tools — but the primitive is account-wide,
   and this route is one of the three writers that migration set out to fix.
   Worth relocating; not worth mixing a file move into a bug fix. */
import { mergeAccountPrefsNested } from "@/lib/server/account-prefs-nested";

/* WHAT THIS ROUTE MAY WRITE (Settings audit, 29/09/2026). It used to take any
   keys at any size, so a Super Admin could plant `ai` / `ai_memory` facts in
   another user's assistant (the personalization route exists precisely to
   keep those to the caller and normalised), and a self-edit could store a
   payload that then rides every bootstrap. The keys below are every slice the
   Hub's own screens write here; AI personalization and memory go through
   /api/ai/personalization only. */
const WRITABLE = new Set([
  "language", "theme", "email_signature", "wallpaper", "profile", "notifications",
  "display", "calendar", "orb", "orb_sound", "ai_model", "home_apps", "home_layout",
]);
const MAX_BODY_BYTES = 32 * 1024;

/* PATCH /api/accounts/[id]/preferences
   Body: { preferences: object }

   Rule: you can always edit your OWN preferences without the Accounts
   permission. Editing someone else's preferences requires SA. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  /* `req` turns on the read-only guard: while a Super Admin is viewing as
     someone, every Settings toggle, the wallpaper, Home's My apps… used to be
     written to THAT person's account. */
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const editingSelf = id === auth.account_id;
  if (!editingSelf && !auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Preferences too large" }, { status: 413 });
  }
  let preferences: Record<string, unknown>;
  try {
    const body = JSON.parse(raw) as { preferences?: unknown };
    if (!body || typeof body.preferences !== "object" || body.preferences === null || Array.isArray(body.preferences)) {
      return NextResponse.json({ error: "preferences must be an object" }, { status: 400 });
    }
    preferences = body.preferences as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const unknownKeys = Object.keys(preferences).filter((k) => !WRITABLE.has(k));
  if (unknownKeys.length > 0) {
    return NextResponse.json({ error: `Not writable here: ${unknownKeys.join(", ")}` }, { status: 400 });
  }

  /* THE THIRD WRITER, AND THE ONE THAT WAS LEFT BEHIND. Shallow-merging the
     incoming top-level slices (profile / display / notifications / calendar /
     …) is right and stays: it lets each Settings tab persist only the slice it
     owns instead of clobbering another tab's with a stale snapshot.

     Doing that merge HERE was the problem. account_prefs_merge.sql names three
     paths that read-modify-write this column — user-memory, reply-language,
     and this route — and only the first two were converted. So the N12 race
     survived through this one:

       1. this route SELECTs preferences        (ai_memory = {birthday})
       2. the assistant stores a fact atomically (ai_memory = {birthday, city})
       3. this route UPDATEs {...current, ...incoming}
          → ai_memory is back to {birthday}. "city" is gone, with no error.

     The user asked the assistant to remember something and it silently
     vanished because they had a Settings tab open. Same finding, same fix:
     merge inside one statement, so there is no gap to lose a write in.
     `||` is a shallow top-level merge — exactly the semantics this route
     already wanted. */

  /* THE TENANT BOUNDARY MOVES WITH IT. The UPDATE above carried
     `.eq("tenant_id", …)`; the RPC takes an account id and no tenant, so
     dropping the old filter without replacing it would silently widen what a
     super-admin can write to. Self-edits need no check — the id IS the
     session's account. */
  if (!editingSelf) {
    const { data: target } = await supabaseServer
      .from("accounts")
      .select("tenant_id")
      .eq("id", id)
      .maybeSingle();
    if (!target || target.tenant_id !== auth.tenant_id) {
      /* Previously this wrote zero rows and still answered `{ok:true}` —
         a success for a save that never happened. The client already treats
         404 as a failed save. */
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
  }

  /* One top-level difference from the old code, unreachable through the typed
     client: a top-level key whose value is null is REMOVED rather than stored
     as null, because `setReplyLanguage(null)` means "clear it". Every field on
     AccountPreferences is optional and none is typed `| null`. */
  /* display / notifications / calendar merge one level deep, so a screen can
     send only the fields it changed and never puts back a stale copy of the
     rest (Display vs. Region, Settings vs. the bell's pause). */
  const merged = await mergeAccountPrefsNested(id, preferences);
  if (merged === null) {
    console.error("[api/accounts/[id]/preferences] merge failed");
    return NextResponse.json({ error: "Could not save preferences." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
