-- rating_general_pool — mark library skills/behaviors as applying to EVERY
-- employee (plan §L.1: the GENERAL layer of the rating catalog).
-- Position-derived items keep coming from position_*_requirements; this flag
-- is what makes a library row part of every cycle regardless of position.

ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS is_general boolean NOT NULL DEFAULT false;
ALTER TABLE public.behavior_indicators ADD COLUMN IF NOT EXISTS is_general boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.skills.is_general IS 'Rating system: assessed for every employee in every cycle, position or not.';
COMMENT ON COLUMN public.behavior_indicators.is_general IS 'Rating system: assessed for every employee in every cycle, position or not.';

NOTIFY pgrst, 'reload schema';
