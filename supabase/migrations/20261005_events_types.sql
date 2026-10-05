-- ---------------------------------------------------------------------------
-- 20261005_events_types — widen the event type vocabulary. Existing rows are
-- untouched (their values stay valid); four business types are added.
-- ---------------------------------------------------------------------------

ALTER TABLE public.koleex_events
  DROP CONSTRAINT IF EXISTS koleex_events_type_check;
ALTER TABLE public.koleex_events
  ADD CONSTRAINT koleex_events_type_check CHECK (type IN (
    'exhibition', 'conference', 'launch', 'mission',
    'visit', 'training', 'workshop', 'seminar',
    'gathering', 'ceremony', 'roadshow', 'online'
  ));
