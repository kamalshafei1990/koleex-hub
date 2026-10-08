-- ---------------------------------------------------------------------------
-- 20261004_events_app_phase1 — Events app, phase 1 (owner plan 04 Oct 2026).
--
-- The event command centre: one row per company event (exhibition, launch,
-- conference, mission, visit…), its guest lists with invitation state, and
-- its day agenda. Later phases add invitations (send/QR/RSVP links), budget
-- lines and check-ins on top of these tables — the shape below is the
-- foundation, not the whole house.
--
-- SECURITY: same lockdown pattern as 20261003_revoke_anon_table_access —
-- RLS enabled, NO public policies, access revoked from anon/authenticated.
-- The app reaches these tables ONLY through the service-role server client
-- (src/app/api/events/*), which applies module permission ("Events") and
-- tenant scoping itself. Never add an authenticated policy here.
-- ---------------------------------------------------------------------------

-- ── 1. The event ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.koleex_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  title            text NOT NULL,
  type             text NOT NULL DEFAULT 'exhibition'
                   CHECK (type IN ('exhibition','conference','launch','mission',
                                   'visit','training','gathering','online')),
  /* idea → planning → confirmed → live → done → archived */
  status           text NOT NULL DEFAULT 'idea'
                   CHECK (status IN ('idea','planning','confirmed','live','done','archived')),

  start_at         timestamptz,
  end_at           timestamptz,
  location         text,
  city             text,
  country          text,
  description      text,

  /* Planned total budget, the app's own currency-free number; expense
     linkage lands in a later phase. */
  budget_total     numeric(14,2),

  owner_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  created_by       uuid REFERENCES public.accounts(id) ON DELETE SET NULL,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kev_tenant_status ON public.koleex_events (tenant_id, status, start_at);
CREATE INDEX IF NOT EXISTS idx_kev_tenant_start  ON public.koleex_events (tenant_id, start_at);
CREATE INDEX IF NOT EXISTS idx_kev_owner         ON public.koleex_events (owner_account_id);

-- ── 2. Guests + invitation state ────────────────────────────────────────────
/* source: where the person came from — a Contacts person, an employee's
   account, or typed by hand. contact_id / account_id are hints back to the
   record (nullable: manual guests have neither). status is the CURRENT
   answer; invited_sent_at / responded_at make the funnel honest. */
CREATE TABLE IF NOT EXISTS public.koleex_event_guests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id         uuid NOT NULL REFERENCES public.koleex_events(id) ON DELETE CASCADE,

  source           text NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('contact','employee','manual')),
  contact_id       uuid REFERENCES public.people(id) ON DELETE SET NULL,
  account_id       uuid REFERENCES public.accounts(id) ON DELETE SET NULL,

  name             text NOT NULL,
  company          text,
  email            text,
  phone            text,
  category         text NOT NULL DEFAULT 'guest'
                   CHECK (category IN ('vip','customer','supplier','partner',
                                       'media','staff','guest')),

  status           text NOT NULL DEFAULT 'listed'
                   CHECK (status IN ('listed','invited','viewed','accepted',
                                     'declined','maybe','attended')),
  invited_at       timestamptz,
  responded_at     timestamptz,

  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT keg_event_name_uniq UNIQUE (event_id, name)
);
CREATE INDEX IF NOT EXISTS idx_keg_event   ON public.koleex_event_guests (event_id, status);
CREATE INDEX IF NOT EXISTS idx_keg_tenant  ON public.koleex_event_guests (tenant_id, event_id);
CREATE INDEX IF NOT EXISTS idx_keg_contact ON public.koleex_event_guests (contact_id);

-- ── 3. Day agenda (sessions) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.koleex_event_agenda_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES public.koleex_events(id) ON DELETE CASCADE,

  title       text NOT NULL,
  description text,
  speaker     text,
  location    text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  sort_order  integer NOT NULL DEFAULT 0,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_keai_event ON public.koleex_event_agenda_items (event_id, sort_order, starts_at);

-- ── 4. updated_at trigger (shared with the other koleex_* tables' style) ────
CREATE OR REPLACE FUNCTION public.koleex_events_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_kev_updated_at ON public.koleex_events;
CREATE TRIGGER trg_kev_updated_at BEFORE UPDATE ON public.koleex_events
  FOR EACH ROW EXECUTE FUNCTION public.koleex_events_set_updated_at();
DROP TRIGGER IF EXISTS trg_keg_updated_at ON public.koleex_event_guests;
CREATE TRIGGER trg_keg_updated_at BEFORE UPDATE ON public.koleex_event_guests
  FOR EACH ROW EXECUTE FUNCTION public.koleex_events_set_updated_at();
DROP TRIGGER IF EXISTS trg_keai_updated_at ON public.koleex_event_agenda_items;
CREATE TRIGGER trg_keai_updated_at BEFORE UPDATE ON public.koleex_event_agenda_items
  FOR EACH ROW EXECUTE FUNCTION public.koleex_events_set_updated_at();

-- ── 5. Lockdown: RLS on, no public surface ──────────────────────────────────
ALTER TABLE public.koleex_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.koleex_event_guests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.koleex_event_agenda_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.koleex_events             FROM anon, authenticated;
REVOKE ALL ON public.koleex_event_guests       FROM anon, authenticated;
REVOKE ALL ON public.koleex_event_agenda_items FROM anon, authenticated;
