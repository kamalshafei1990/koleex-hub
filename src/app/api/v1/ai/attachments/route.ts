/* ---------------------------------------------------------------------------
   /api/v1/ai/attachments — versioned transport.

   Phase 2G. This file adds a VERSION to the URL and nothing else: it re-exports
   the same handler the legacy route runs, so the two paths are not "kept in
   sync" — they are the same function. Behaviour, auth, permissions, rate
   limits and the seal chain cannot differ between them, because there is only
   one implementation.

   Why a version at all: the day a second client ships — the standalone web
   app, then desktop, then native — it pins these response shapes permanently.
   Drawing the line is cheap now and impossible later.

   Auth is UNCHANGED. requireInternalUser still guards this route exactly as it
   guards the legacy one (owner decision, 2026-08-30, Option A). A versioned
   URL is not a looser door.
   --------------------------------------------------------------------------- */

export { POST } from "../../../ai/attachments/route";

/* Segment config is read STATICALLY by the compiler from the route file, so
   it is declared here literally rather than re-exported. It MUST match the
   legacy route — validate:ai-api-v1 asserts that it does. */
export const dynamic = "force-dynamic";
export const maxDuration = 120;
