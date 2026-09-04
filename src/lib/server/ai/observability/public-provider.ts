/* ---------------------------------------------------------------------------
   ai/observability/public-provider — what the BROWSER is told about who
   answered.

   Phase 7, closing finding N11. No `server-only`: it is one string transform,
   and the suite imports it directly.

   THE FINDING. `AgentResponse.provider` crosses the wire on every turn, and
   the client declares it in two response types and NEVER READS IT. So a vendor
   name — "deepseek:deepseek-chat" — is visible to anyone who opens devtools,
   for no consumer at all. It is not product copy, so it does not breach the
   user-facing vendor-language rule, but it is a disclosure with no purpose.

   WHY NOT JUST DELETE THE FIELD, which was the obvious answer. `/api/v1/ai/*`
   re-exports these handlers, and the standing amendment makes standalone
   clients a permanent requirement — so removing a field from a response is a
   contract change for a client this repository cannot see. Keeping the field
   and changing its VALUE breaks nothing: it is still a string, still present,
   still describes the turn.

   IT IS NOT ONE ROUTE. The first fix covered /api/ai/agent and the suite that
   proved it read that one file, so it asserted "every send site" over a search
   space of one. The review that followed swept every AI route and found the
   same leak on two more paths: /api/ai/chat returned the vendor label in four
   places (two SSE `end` frames, two JSON bodies), and
   /api/ai/conversations/[id]/messages returned the PERSISTED ROW, which carries
   the provider column verbatim — the exact failure mode the agent-route fix had
   already named and fixed there. All of them are re-exported under /api/v1/ai/*,
   so they are contract surfaces for clients this repository cannot see.

   AND THE SERVER KEEPS THE TRUTH. `ai_messages.provider` still records
   "deepseek:deepseek-chat", because that column is how a mis-diagnosis on
   2026-08-08 was eventually explained — the audit trail needs to know which
   model served, and the audit trail is not the browser.

   WHAT SURVIVES THE TRANSFORM is the LANE, which is the half that was
   actually useful client-side and discloses nothing: "fast-brand" tells you a
   tool-less path answered; "deepseek" tells you only who we buy from.
   --------------------------------------------------------------------------- */

/** Strip the vendor half of a provider label, keeping the lane.
 *
 *    "deepseek:fast-brand"    → "fast-brand"
 *    "deepseek:deepseek-chat" → "model"      (no lane to keep)
 *    "fast-path"              → "fast-path"  (no vendor half)
 *    "fallback"               → "fallback"
 *
 *  Pure and total: any input yields a non-empty string, because a client that
 *  renders this field would otherwise show a blank where it used to show
 *  something. */
/* ALLOW-LIST, not a deny-list, and the suite is why. The first version passed
   through anything with no colon, on the reasoning that a label without a
   vendor half must already be a lane name. It is not: `activeProviderLabel()`
   returns "none" when nothing is configured, and a bare "deepseek" — which a
   future caller could easily produce — sailed straight through. The suite
   caught it by asserting the ABSENCE OF A CLASS of leak rather than checking
   the cases I had thought of.

   So nothing is passed through unless it is named here. Any label that is not
   on this list, or does not carry a `fast-` lane suffix, becomes "model". A
   new vendor name is therefore neutralised the day it appears, without anyone
   remembering to add it to a list of things to hide. */
/* `local` is on the list for the same reason `fast-path` is: it names a lane
   that answered WITHOUT a provider (the local-knowledge table), which is true
   and discloses nothing. It is here because /api/ai/chat sends it as a literal,
   and a label the routes emit but this function would collapse to "model" is a
   disagreement between the two that a reader has to hold in their head. */
const PASSTHROUGH_LANES = new Set(["fast-path", "fallback", "local", "none", "unknown"]);

export function publicProviderLabel(label: string | null | undefined): string {
  const raw = (label ?? "").trim();
  if (!raw) return "unknown";

  const colon = raw.indexOf(":");
  const candidate = colon === -1 ? raw : raw.slice(colon + 1).trim();

  if (PASSTHROUGH_LANES.has(candidate)) return candidate;
  /* A real lane suffix is kept because it tells the client something true
     about HOW the turn was served — "fast-brand" means a tool-less path
     answered. A bare model id carries no routing information, only the
     vendor's product name. */
  if (candidate.startsWith("fast-")) return candidate;
  return "model";
}

/** Rewrite the provider field on an object that carries one. Returns a new
 *  object; the caller's copy — the one that gets persisted — is untouched. */
export function withPublicProvider<T extends { provider?: unknown }>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  if (!("provider" in obj)) return obj;
  return { ...obj, provider: publicProviderLabel(obj.provider as string | null) };
}
