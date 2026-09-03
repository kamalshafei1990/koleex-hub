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

   ONE ATOMIC MERGE. Writes go through mergeAccountPrefs, the single
   statement that closed finding N12, touching only the `ai` and
   `ai_memory` keys, so a fact the assistant stores mid-edit is not erased
   by a Settings save landing a second later.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { mergeAccountPrefs } from "@/lib/server/ai/security/account-prefs";
import { readPersonalization } from "@/lib/server/ai/personalization-prompt";
import { patchAiPersonalization, type AiPersonalization } from "@/lib/ai-personalization";

export const dynamic = "force-dynamic";

/** Only well-formed string facts, the same filter every prompt lane applies. */
function factsOf(prefs: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = prefs.ai_memory;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && k.length <= 40 && v.length <= 200) out[k] = v;
  }
  return out;
}

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

  const prefs = await loadPrefs(auth.account_id);
  if (!prefs) return NextResponse.json({ error: "Couldn't read your preferences." }, { status: 500 });

  return NextResponse.json({
    personalization: readPersonalization(prefs),
    memory: factsOf(prefs),
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

  let memory = factsOf(prefs);
  if (body.forgetAll === true) {
    memory = {};
    patch.ai_memory = memory;
  } else if (Array.isArray(body.forget) && body.forget.length > 0) {
    const next = { ...memory };
    for (const k of body.forget) if (typeof k === "string") delete next[k];
    memory = next;
    /* A SMALLER object replaces the old one — the merge is shallow on
       purpose (account-prefs.ts), which is what makes deletion possible. */
    patch.ai_memory = memory;
  }

  if (Object.keys(patch).length > 0) {
    const merged = await mergeAccountPrefs(auth.account_id, patch);
    if (merged === null) {
      console.error("[api/ai/personalization] merge failed");
      return NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, personalization, memory });
}
