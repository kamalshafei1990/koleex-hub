import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { persistAccountAvatar } from "@/lib/server/persist-account-avatar";

/* PATCH /api/accounts/[id]/avatar
   Body: { avatar_url: string | null }
   Users can edit their own avatar; SA can edit anyone's. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (id !== auth.account_id && !auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let { avatar_url } = (await req.json()) as { avatar_url: string | null };

  /* Guard: inline base64 must never reach the column — it re-ships per row
     in every avatar join (inbox feed, headers). Upload to Storage instead;
     if that fails, reject the write (the previous avatar stays in place). */
  if (typeof avatar_url === "string" && avatar_url.startsWith("data:")) {
    try {
      avatar_url = await persistAccountAvatar(id, avatar_url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Avatar upload failed";
      console.error("[api/accounts/[id]/avatar] storage", msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const { error } = await supabaseServer
    .from("accounts")
    .update({ avatar_url })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/accounts/[id]/avatar]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
