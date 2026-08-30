import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/ai/providers — is the failover actually configured?

   WHY THIS EXISTS. A fallback provider is contacted ONLY when the primary
   fails. So a mistake in setting it up — a wrong model id, a typo in the base
   url, a key pasted into the name field — stays invisible until the exact
   moment it is needed, which is the moment there is no margin for it. The
   whole point of Phase 4 was to remove "it looks configured and fails when the
   primary is already down"; shipping a fallback nobody can check reintroduces
   that one level up.

   After setting four environment variables and redeploying, an operator had no
   way to answer "did that work?" short of taking the primary down. Now they do.

   WHAT IT WILL NOT TELL YOU. No key, no fragment of a key, no key length, not
   even the full base url — only the adapter's own name, its model id, and
   whether it would serve. `configured()` reads the key and returns a boolean;
   that boolean is all that crosses this boundary.

   SUPER-ADMIN ONLY. Which providers a deployment can reach is operational
   detail, not user-facing. It follows the same rule as /api/qa/ai/tts.

   `?probe=1` GOES FURTHER, and the distinction matters more than it looks.
   Without it this reports CONFIGURED — the variables are present and
   well-formed. That is not the same as WORKING: a well-formed key can still be
   revoked, out of credit, or for the wrong account. The probe sends one
   deliberately tiny turn to each configured provider and reports what came
   back. It costs a few tokens, which is why it is opt-in rather than the
   default.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { providerRoster } from "@/lib/server/ai/provider/registry";
import { chatWithToolsVia } from "@/lib/server/ai/provider/registry";
import { deepseekAdapter } from "@/lib/server/ai/provider/adapters/deepseek";
import { openAiCompatibleAdapter } from "@/lib/server/ai/provider/adapters/openai-compatible";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const roster = providerRoster();
  const configured = roster.filter((p) => p.configured);

  const wantProbe = new URL(req.url).searchParams.get("probe") === "1";
  if (!wantProbe) {
    return NextResponse.json({
      providers: roster,
      configured_count: configured.length,
      /* Said plainly, because "configured" reads as "working" and is not.
         An operator who stops at this line should know what they have. */
      note:
        configured.length < 2
          ? "Only one provider is configured — there is no failover. Add AI_FALLBACK_BASE_URL, AI_FALLBACK_API_KEY and AI_FALLBACK_MODEL, then redeploy."
          : "Configured is not the same as working — add ?probe=1 to send one tiny real turn to each.",
    });
  }

  /* One provider at a time, each on its own, so the result names WHICH one
     failed. Going through chatWithToolsVia with a single-adapter list reuses
     the real call path rather than a parallel one written for this route. */
  const ADAPTERS = [deepseekAdapter, openAiCompatibleAdapter];
  const probes = await Promise.all(
    ADAPTERS.filter((a) => {
      try {
        return a.configured();
      } catch {
        return false;
      }
    }).map(async (adapter) => {
      const startedAt = Date.now();
      try {
        const out = await chatWithToolsVia([adapter], {
          messages: [{ role: "user", content: "Reply with the single word: ok" }],
          /* Deliberately tiny. This proves the credential and the endpoint,
             not the model's quality. */
          maxTokens: 5,
          temperature: 0,
        });
        return {
          name: adapter.name,
          ok: out.ok === true,
          /* The status is the useful half on a failure: 401 is a bad key,
             402 is an empty balance, 404 is a wrong url or model id. */
          status: out.ok ? 200 : (out.status ?? null),
          ms: Date.now() - startedAt,
          /* Truncated hard. A provider error body can echo request content,
             and this response is read by a human in a browser. */
          detail: out.ok ? null : (out.bodyText ?? "").slice(0, 200) || null,
        };
      } catch (e) {
        return {
          name: adapter.name,
          ok: false,
          status: null,
          ms: Date.now() - startedAt,
          detail: e instanceof Error ? e.message.slice(0, 200) : "probe threw",
        };
      }
    }),
  );

  return NextResponse.json({
    providers: roster,
    configured_count: configured.length,
    probes,
    note: probes.every((p) => p.ok)
      ? "Every configured provider answered."
      : "At least one provider did NOT answer — see `status`: 401 bad key, 402 no credit, 404 wrong url or model id.",
  });
}
