-- ---------------------------------------------------------------------------
-- 20261004_events_invitations — Events phase 2: the invitation itself.
--
-- One row per invited guest: the unguessable token behind the public RSVP
-- link (/invite/<token>), the channel it went out on, and the funnel state
-- (sent → viewed → rsved). The guest's own row in koleex_event_guests stays
-- the funnel's single source of truth; these rows only carry HOW the
-- invitation went out and WHAT the guest did with it.
--
-- SECURITY: same lockdown as phase 1 — RLS on, no public policies, revoked
-- from anon/authenticated. Public access is token-scoped through
-- /api/invite/[token] (service role), never through PostgREST.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.koleex_event_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES public.koleex_events(id) ON DELETE CASCADE,
  /* One live invitation per guest — re-inviting the same person refreshes
     the row rather than stacking duplicates. */
  guest_id    uuid NOT NULL UNIQUE REFERENCES public.koleex_event_guests(id) ON DELETE CASCADE,

  /* 36 random hex chars; the ONLY credential a guest needs. Unique index is
     the constraint below. */
  token       text NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  channel     text NOT NULL DEFAULT 'link'
              CHECK (channel IN ('link', 'email')),
  status      text NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'sent', 'viewed', 'rsvped')),

  /* A personal line the organizer can add before sending. */
  note        text,

  sent_at     timestamptz,
  sent_by     uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  viewed_at   timestamptz,
  answered_at timestamptz,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kei_token_uniq UNIQUE (token)
);
CREATE INDEX IF NOT EXISTS idx_kei_event   ON public.koleex_event_invitations (event_id);
CREATE INDEX IF NOT EXISTS idx_kei_tenant  ON public.koleex_event_invitations (tenant_id, event_id);

DROP TRIGGER IF EXISTS trg_kei_updated_at ON public.koleex_event_invitations;
CREATE TRIGGER trg_kei_updated_at BEFORE UPDATE ON public.koleex_event_invitations
  FOR EACH ROW EXECUTE FUNCTION public.koleex_events_set_updated_at();

ALTER TABLE public.koleex_event_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.koleex_event_invitations FROM anon, authenticated;
