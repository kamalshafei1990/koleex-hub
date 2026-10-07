-- rating_cycles / rating_items / rating_summaries / rating_band_config
-- Monthly Employee Rating System, Phase 1 (plan: docs/hr/monthly-rating-system-plan.md)
--
-- A monthly rating is a cycle-scoped, composed, finalize-locked DOCUMENT — the
-- skills/behavior history streams stay event logs; these tables sample them.
-- Owner decisions 2026-10-07: weights skills 60 / behavior 40, deadlines
-- score-by-28th / finalize-by-3rd / publish-by-5th, CEO + HR score for now,
-- employees see number AND band.

-- ── the cycle itself ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rating_cycles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  month        date NOT NULL,                 -- always the 1st (2026-10-01)
  kind         text NOT NULL DEFAULT 'monthly'
               CHECK (kind IN ('monthly', 'occasion')),
  title        text,                          -- occasion name ("CISMA 2025")
  occasion_date date,
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','scoring','review','finalized','published')),
  opened_by    uuid NOT NULL REFERENCES public.accounts(id),
  opened_at    timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  published_at timestamptz,
  config       jsonb NOT NULL DEFAULT '{"skills":60,"behavior":40}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- one monthly cycle per tenant per month; occasions are unique by name+date
CREATE UNIQUE INDEX IF NOT EXISTS rating_cycles_monthly_uq
  ON public.rating_cycles (tenant_id, month) WHERE kind = 'monthly';
CREATE UNIQUE INDEX IF NOT EXISTS rating_cycles_occasion_uq
  ON public.rating_cycles (tenant_id, kind, title, occasion_date) WHERE kind = 'occasion';

-- ── one row per employee per assessable thing ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.rating_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id       uuid NOT NULL REFERENCES public.rating_cycles(id) ON DELETE CASCADE,
  employee_id    uuid NOT NULL REFERENCES public.koleex_employees(id) ON DELETE CASCADE,
  item_kind      text NOT NULL CHECK (item_kind IN ('skill','behavior')),
  ref_id         uuid NOT NULL,               -- skills.id or behavior_indicators.id
  scope          text NOT NULL CHECK (scope IN ('general','function','position','occasion')),
  required_score smallint,                    -- snapshot of the requirement at open
  weight         numeric NOT NULL DEFAULT 1,
  is_mandatory   boolean NOT NULL DEFAULT false,
  score          smallint CHECK (score BETWEEN 0 AND 100),  -- NULL = unassessed ≠ 0
  comment        text,
  evidence       text,                        -- required for score < 30 or > 90
  scored_by      uuid REFERENCES public.accounts(id),
  scored_at      timestamptz,
  self_score     smallint CHECK (self_score BETWEEN 0 AND 100),  -- K.1 blind self-assessment
  tenant_id      uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, employee_id, item_kind, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_rating_items_cycle_emp ON public.rating_items (cycle_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_rating_items_emp_ref ON public.rating_items (employee_id, ref_id);

-- ── the computed document, written at finalize ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.rating_summaries (
  cycle_id        uuid NOT NULL REFERENCES public.rating_cycles(id) ON DELETE CASCADE,
  employee_id     uuid NOT NULL REFERENCES public.koleex_employees(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL,
  skills_avg      numeric(5,2),
  behavior_avg    numeric(5,2),
  overall         numeric(5,2),
  band            text,
  mandatory_gaps  smallint NOT NULL DEFAULT 0,
  partial         boolean NOT NULL DEFAULT false,   -- new hire / left mid-cycle
  position_note   text,
  delta_overall   numeric(5,2),                     -- vs previous finalized cycle, stored
  delta_skills    numeric(5,2),
  delta_behavior  numeric(5,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cycle_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_rating_summaries_emp ON public.rating_summaries (employee_id, created_at DESC);

-- ── bands are data, not code ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rating_band_config (
  tenant_id  uuid NOT NULL,
  band       text NOT NULL CHECK (band IN ('critical','needs_improvement','solid','strong','exceptional')),
  min_score  smallint NOT NULL CHECK (min_score BETWEEN 0 AND 100),
  label      jsonb NOT NULL,                  -- { en, zh, ar }
  color      text NOT NULL,                   -- token name, never a hex in a table
  sort       smallint NOT NULL,
  PRIMARY KEY (tenant_id, band)
);

-- ── lockdown: service-role only, like every platform table ──────────────────
ALTER TABLE public.rating_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_band_config ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.rating_cycles IS 'Monthly/occasion rating cycles — state machine draft→scoring→review→finalized→published.';
COMMENT ON TABLE public.rating_items IS 'One assessable row per employee per cycle. score NULL = unassessed, never 0.';
COMMENT ON TABLE public.rating_summaries IS 'The finalized computed document per employee per cycle; deltas stored at finalize.';
COMMENT ON TABLE public.rating_band_config IS 'Per-tenant status bands for ratings — seeded defaults, HR-editable.';

NOTIFY pgrst, 'reload schema';
