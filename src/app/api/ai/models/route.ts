import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/ai/models — the Koleex AI models the picker may offer, and which
   of them can answer right now.

   Owner, 2026-09-23: three providers become three Koleex models the user
   switches between (lib/ai/koleex-models.ts). The picker needs one fact it
   cannot know itself: whether a model is configured and not switched off —
   Koleex Deep, for instance, stays unavailable until its slot is set.

   NAMES ONLY. The answer is `{ id, available }` per model: no vendor, no
   model id, no host — nothing that says who stands behind a name. The same
   door as every Koleex AI endpoint: signed in, internal accounts only.

   FOR THE OWNER, ONE MORE BLOCK (models 4/4, 2026-09-24). A super admin also
   gets `admin`: per model, whether its slot is configured, whether the
   runtime switch has it off, and whether the deploy-time switch does — what
   Settings → Koleex AI needs to draw the switches. Still names only.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { modelAvailability, modelConfigured, parseDisabledModels } from "@/lib/server/ai/provider/koleex-model-slots";
import { switchedOffInTable, switchedOffModels } from "@/lib/server/ai/provider/model-switches";
import { DEFAULT_KOLEEX_MODEL, KOLEEX_SERVING_MODELS } from "@/lib/ai/koleex-models";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const notInternal = requireInternalUser(auth);
  if (notInternal) return notInternal;

  const off = await switchedOffModels();
  const body: Record<string, unknown> = { models: modelAvailability(off), default: DEFAULT_KOLEEX_MODEL };
  if (auth.is_super_admin) {
    const envOff = parseDisabledModels(process.env.AI_MODELS_DISABLED);
    const tableOff = await switchedOffInTable();
    body.admin = KOLEEX_SERVING_MODELS.map((id) => ({
      id,
      configured: modelConfigured(id),
      off: tableOff.has(id),
      env_off: envOff.has(id),
    }));
  }
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
