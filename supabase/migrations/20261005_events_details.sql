-- ---------------------------------------------------------------------------
-- 20261005_events_details — richer event records: the fields a real event
-- brief carries beyond the basics. Additive, nullable — nothing existing
-- moves.
-- ---------------------------------------------------------------------------

ALTER TABLE public.koleex_events
  ADD COLUMN IF NOT EXISTS expected_guests integer
    CHECK (expected_guests IS NULL OR expected_guests >= 0),
  ADD COLUMN IF NOT EXISTS booth text,
  ADD COLUMN IF NOT EXISTS website text;
