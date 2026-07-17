/* kxperf — KNOWN STAGING ENVIRONMENT LIMITS.
   ────────────────────────────────────────────────────────────────────────────
   THE STAGING DATABASE IS DISCUSS-ONLY. It holds 13 public tables:

     accounts · companies · contacts · discuss_channels · discuss_drafts
     discuss_members · discuss_messages · discuss_pinned · discuss_reactions
     discuss_starred · people · roles · tenants

   Everything else the Hub asks for — products, product_media, inbox_messages,
   koleex_employees, role_permissions — is INTENTIONALLY ABSENT. The app is the
   full Hub, so it requests them anyway and the API answers 404/500. Those
   responses are correct reporting about a deliberately partial environment.
   They are NOT Production defects and must never be reported as such.

   ── Why this file exists ────────────────────────────────────────────────────
   A previous phase escalated exactly these responses into an investigation,
   proposed a PostgREST "schema cache reload", and got it approved — all on a
   misreading. The cache was never stale: `to_regclass` proves the tables do not
   exist. There was nothing to reload. Assigning a role to the fixture accounts
   then made it strictly WORSE: /api/discuss/recipients went from a clean
   403 "No role assigned" to a 500 "Permission check failed", because
   requireModuleAccess reaches for `role_permissions`, which is one of the
   absent tables. Both changes were reverted. Zero product defects were found.

   This module exists so that conclusion survives, and so the next run annotates
   these responses instead of rediscovering them as a "finding".

   ── What this is NOT ────────────────────────────────────────────────────────
   · NOT suppression. Nothing here touches product code, and the requests still
     happen and are still recorded — they are LABELLED, not hidden. A real
     regression on these endpoints would still show up as an unexpected body or
     status and would still fail classification.
   · NOT placeholder tables, fake permissions, or a Production schema mirror.
     All three were explicitly rejected; a green benchmark that verified a fake
     schema would be worse than a red one. */

export type Classification =
  | "staging-artifact"      // absent-by-design table or missing authz schema
  | "local-build-artifact"  // exists only because we run `next start`, not Vercel
  | "expected-auth"         // authorization behaving correctly
  | "unclassified";         // ← anything here deserves a human look

export interface KnownArtifact {
  match: (url: string, status: number, body: string) => boolean;
  classification: Classification;
  why: string;
}

/** Tables deliberately absent from the Discuss-only staging project. */
export const ABSENT_TABLES = [
  "products", "product_media", "inbox_messages", "koleex_employees", "role_permissions",
] as const;

export const KNOWN_ARTIFACTS: KnownArtifact[] = [
  {
    match: (_u, _s, body) => ABSENT_TABLES.some((t) => body.includes(`public.${t}`)) && body.includes("schema cache"),
    classification: "staging-artifact",
    why: "PostgREST correctly reports a table that is intentionally absent from the Discuss-only staging schema. Verified with to_regclass: the table does not exist. Not a cache problem — there is nothing to reload.",
  },
  {
    match: (u, s) => u.includes("/api/products") && s >= 500,
    classification: "staging-artifact",
    why: "Depends on `products`, which is absent by design on staging.",
  },
  {
    match: (u, _s, body) => u.includes("/api/discuss/recipients") && body.includes("No role assigned"),
    classification: "expected-auth",
    why: "The fixture accounts intentionally have role_id = NULL and staging has zero roles. This 403 is authorization working. DO NOT 'fix' it by assigning a role: that was tried and measured, and it converts this clean 403 into a 500 because requireModuleAccess needs `role_permissions`, which is absent. /api/discuss/recipients cannot be meaningfully exercised until the authorization schema exists on staging.",
  },
  {
    match: (u, _s, body) => u.includes("/api/discuss/recipients") && body.includes("Permission check failed"),
    classification: "staging-artifact",
    why: "Only occurs if a role has been assigned while `role_permissions` is absent. If you see this, someone re-ran the reverted role experiment.",
  },
  {
    match: (u) => u.includes("/_vercel/speed-insights/"),
    classification: "local-build-artifact",
    why: "Vercel injects this at the edge; a local `next start` has no edge. Invisible in Production. Ignore.",
  },
];

export function classify(url: string, status: number, body: string): { classification: Classification; why: string } {
  for (const a of KNOWN_ARTIFACTS) {
    try { if (a.match(url, status, body)) return { classification: a.classification, why: a.why }; }
    catch { /* a broken matcher must not silently swallow a real error */ }
  }
  return {
    classification: "unclassified",
    why: "NOT a known staging artifact. This one is worth a human look before it is dismissed.",
  };
}

/** The line every benchmark report must carry when run against staging. */
export const STAGING_CAVEAT =
  "Staging is a Discuss-only database (13 tables). Non-Discuss modules emit expected 404/500 " +
  "responses because their tables are intentionally absent. These are environment artifacts and " +
  "MUST NOT be reported as Production defects. /api/discuss/recipients cannot be meaningfully " +
  "exercised until the authorization schema (role_permissions) exists on staging.";
