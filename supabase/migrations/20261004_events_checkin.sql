-- ---------------------------------------------------------------------------
-- 20261004_events_checkin — Events phase 3: day-of check-in.
--
-- A guest is checked in ONCE: checked_in_at is stamped by a conditional
-- update (WHERE checked_in_at IS NULL ... RETURNING), so two staff scanning
-- the same QR at the same second cannot double-count. The check-in flips
-- the funnel too — status becomes 'attended' — the funnel card, the guests
-- tab and the calendar answer all read the same column as before.
-- ---------------------------------------------------------------------------

ALTER TABLE public.koleex_event_guests
  ADD COLUMN IF NOT EXISTS checked_in_at  timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_by  uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_keg_event_checkin
  ON public.koleex_event_guests (event_id, checked_in_at)
  WHERE checked_in_at IS NOT NULL;
