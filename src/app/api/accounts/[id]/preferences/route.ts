import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
/* Its home is under ai/ for historical reasons — it was written to close N12,
   which was found in the AI memory tools — but the primitive is account-wide,
   and this route is one of the three writers that migration set out to fix.
   Worth relocating; not worth mixing a file move into a bug fix. */
import { mergeAccountPrefs } from "@/lib/server/ai/security/account-prefs";

/* PATCH /api/accounts/[id]/preferences
   Body: { preferences: object }

   Rule: you can always edit your OWN preferences without the Accounts
   permission. Editing someone else's preferences requires SA. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const editingSelf = id === auth.account_id;
  if (!editingSelf && !auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { preferences } = (await req.json()) as {
    preferences: Record<string, unknown>;
  };

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
  const merged = await mergeAccountPrefs(id, (preferences ?? {}) as Record<string, unknown>);
  if (merged === null) {
    console.error("[api/accounts/[id]/preferences] merge failed");
    return NextResponse.json({ error: "Could not save preferences." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
