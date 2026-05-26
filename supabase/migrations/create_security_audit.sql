/* ---------------------------------------------------------------------------
   koleex_security_audit — Security-sensitive event log.

   Audit trail for actions that touch identity, permission, or impersonation
   boundaries. The first consumer is "View as user" (a super admin acting
   as another account); future consumers include sign-in / sign-out,
   permission grant / revoke, role changes, and break-glass private-data
   reads (which today live in `koleex_private_access_log` — they can be
   folded in later).

   Why a separate table from existing audit logs:
     · `inventory_audit_log` is scoped to inventory mutations only.
     · `koleex_private_access_log` is scoped to break-glass private reads.
     · This table is for IDENTITY/AUTH events that cross both.

   Append-only by design — never UPDATE or DELETE. Retention is set at
   the DB level if needed via a partitioning policy.
   --------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS koleex_security_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /* The account that initiated the action (the real session, not the
     view-as target). Indexed because "show me everything user X did
     while viewing as someone else" is the primary query shape. */
  actor_account_id uuid NOT NULL,
  /* For impersonation events, the target account being viewed-as. NULL
     for events that don't have a target (e.g. sign-in). */
  target_account_id uuid,
  /* Free-form action discriminator. Conventions:
       view_as.enter   — SA started viewing as target
       view_as.exit    — SA exited view-as
       view_as.denied  — non-SA attempted to view-as (rejected)
     Add new actions as kebab-cased namespaces (e.g. role.change). */
  action          text NOT NULL,
  /* Best-effort request metadata. May be NULL if not available. */
  ip              text,
  user_agent      text,
  /* Optional JSONB blob for action-specific context (e.g. the role
     being assigned, the module being granted). Keep it small. */
  details         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_actor_created
  ON koleex_security_audit (actor_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_target_created
  ON koleex_security_audit (target_account_id, created_at DESC)
  WHERE target_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_security_audit_action_created
  ON koleex_security_audit (action, created_at DESC);

/* RLS: write is service-role only (API routes use supabaseServer).
   Read is super-admin only. Block client-side anon access entirely so
   the log isn't readable from the browser. */
ALTER TABLE koleex_security_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_audit_service_all ON koleex_security_audit;
CREATE POLICY security_audit_service_all
  ON koleex_security_audit
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
