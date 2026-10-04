-- ---------------------------------------------------------------------------
-- 20261004_events_budget — Events phase 4: the budget, line by line.
--
-- Planned vs actual per line, so an event closes financially: the summary
-- card reads SUM(lines) against koleex_events.budget_total, and each line
-- carries its own variance. Actuals are entered by the team (the deep
-- two-way Expenses-app integration is a later phase; these rows hold their
-- own numbers meanwhile).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.koleex_event_budget_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES public.koleex_events(id) ON DELETE CASCADE,

  label       text NOT NULL,
  category    text NOT NULL DEFAULT 'other'
              CHECK (category IN ('booth','travel','hotels','transport',
                                  'materials','catering','marketing','other')),
  planned     numeric(14,2) NOT NULL DEFAULT 0 CHECK (planned >= 0),
  actual      numeric(14,2) NOT NULL DEFAULT 0 CHECK (actual >= 0),
  sort_order  integer NOT NULL DEFAULT 0,
  notes       text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kebl_event ON public.koleex_event_budget_lines (event_id, sort_order);

DROP TRIGGER IF EXISTS trg_kebl_updated_at ON public.koleex_event_budget_lines;
CREATE TRIGGER trg_kebl_updated_at BEFORE UPDATE ON public.koleex_event_budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.koleex_events_set_updated_at();

ALTER TABLE public.koleex_event_budget_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.koleex_event_budget_lines FROM anon, authenticated;
