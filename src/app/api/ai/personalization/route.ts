import "server-only";

/* ---------------------------------------------------------------------------
   /api/ai/personalization — one user's Koleex AI preferences and memory.

   GET  → { personalization, memory }   what Settings → Koleex AI shows
   PUT  → { personalization?, forget?, forgetAll? }
          personalization: a partial edit (unknown keys and values are
            dropped by the shared normaliser, strings are capped);
          forget: memory keys to delete; forgetAll: delete every fact.
        ← { ok, personalization, memory }

   OWN ACCOUNT ONLY. The account is the session's; there is no id in the
   URL to point at anyone else. A super admin "viewing as" someone may READ
   (view-as is read-only by design) and may not write — the same rule the
   memory tools apply.

   ONE ATOMIC MERGE. Personalization writes go through mergeAccountPrefs,
   the single statement that closed finding N12, touching only the `ai` key.

   2026-10-07: memory facts moved to the ai_memories table (one row per
   fact, atomic upserts). GET reads them from there; forget/forgetAll delete
   rows there. The merge below never touches ai_memory anymore, so a Settings
   save and an assistant save cannot collide at all.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { supabaseServer } from "@/lib/server/supabase-server";
import { mergeAccountPrefs } from "@/lib/server/ai/security/account-prefs";
import { readMemories, forgetFact, forgetAllFacts } from "@/lib/server/ai/user-memory-store";
import { readPersonalization } from "@/lib/server/ai/personalization-prompt";
import { patchAiPersonalization, type AiPersonalization } from "@/lib/ai-personalization";

export const dynamic = "force-dynamic";

async function loadPrefs(accountId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseServer
    .from("accounts")
    .select("preferences")
    .eq("id", accountId)
    .maybeSingle();
  if (error) return null;
  return ((data?.preferences ?? {}) as Record<string, unknown>);
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  /* Koleex AI is internal-only (owner decision, Option A); its memory is too. */
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  const prefs = await loadPrefs(auth.account_id);
  if (!prefs) return NextResponse.json({ error: "Couldn't read your preferences." }, { status: 500 });

  return NextResponse.json({
    personalization: readPersonalization(prefs),
    memory: await readMemories(auth.account_id),
  });
}

type PutBody = {
  personalization?: unknown;
  forget?: unknown;
  forgetAll?: unknown;
};

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }
  if (auth.viewing_as) {
    return NextResponse.json({ error: "Not while viewing as another user." }, { status: 403 });
  }

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const prefs = await loadPrefs(auth.account_id);
  if (!prefs) return NextResponse.json({ error: "Couldn't read your preferences." }, { status: 500 });

  const patch: Record<string, unknown> = {};

  let personalization: AiPersonalization = readPersonalization(prefs);
  if (body.personalization !== undefined) {
    personalization = patchAiPersonalization(prefs.ai, body.personalization);
    patch.ai = personalization;
  }

  /* Facts are rows now — a delete touches only the row it names, and a
     Settings save can never erase a fact the assistant stored mid-edit
     (the old ai_memory replace could, in the same second). */
  if (body.forgetAll === true) {
    if (!(await forgetAllFacts(auth.account_id))) {
      return NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
  } else if (Array.isArray(body.forget) && body.forget.length > 0) {
    for (const k of body.forget) {
      if (typeof k === "string") await forgetFact(auth.account_id, k);
    }
  }
  const memory = await readMemories(auth.account_id);

  if (Object.keys(patch).length > 0) {
    const merged = await mergeAccountPrefs(auth.account_id, patch);
    if (merged === null) {
      console.error("[api/ai/personalization] merge failed");
      return NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, personalization, memory });
}
