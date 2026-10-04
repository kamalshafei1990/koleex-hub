-- ---------------------------------------------------------------------------
-- Notes additions (2026-09-26) — live co-editing state, version history,
-- note-to-note links, "shared with me" unread tracking, tag filter index.
--
-- Idempotent: safe to run more than once. NOT applied automatically.
-- The app degrades gracefully before it is applied:
--   · no notes.yjs_state      → shared notes keep the single-editor path
--   · no note_versions        → "Version history isn't available yet"
--   · no note_links           → the Backlinks section is hidden
--   · no last_opened_at       → no unread badge (count 0)
-- New tables are service-role only (RLS on, no policies), like notes itself:
-- every read/write goes through the access-checked /api/notes routes.
-- ---------------------------------------------------------------------------

-- 1. Live co-editing: the note's Yjs document state (base64 update). The
--    server seeds it from body_json on first collaborative open and merges
--    every collaborative save into it; body_json/body_plain stay the source
--    for lists and search. Cleared by any single-editor body save.
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS yjs_state text;

-- 2. "Shared with me" unread badge. Existing shares are backfilled as READ
--    only when the column is first created (a re-run must not mark newer,
--    genuinely unopened shares as read).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'note_shares' AND column_name = 'last_opened_at'
  ) THEN
    ALTER TABLE public.note_shares ADD COLUMN last_opened_at timestamptz;
    UPDATE public.note_shares SET last_opened_at = created_at WHERE last_opened_at IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS note_shares_unopened_idx
  ON public.note_shares (shared_with_account_id)
  WHERE last_opened_at IS NULL;

-- 3. Version history: at most one automatic snapshot per note every
--    10 minutes + explicit "Save version"; the app keeps the newest 50.
CREATE TABLE IF NOT EXISTS public.note_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL,
  account_id  uuid,               -- who saved (the author of that state)
  title       text NOT NULL DEFAULT '',
  body_json   jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS note_versions_note_created_idx
  ON public.note_versions (note_id, created_at DESC);
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;

-- 4. Note links ([[…]] → /notes?id=<id>), replaced from body_json on save;
--    read for "Linked from" (backlinks), filtered by the caller's access.
CREATE TABLE IF NOT EXISTS public.note_links (
  from_note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  to_note_id   uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_note_id, to_note_id)
);
CREATE INDEX IF NOT EXISTS note_links_to_note_id_idx
  ON public.note_links (to_note_id);
ALTER TABLE public.note_links ENABLE ROW LEVEL SECURITY;

-- 5. Tag filter / tag search: tags @> '{x}' and tags && '{x,y}'.
CREATE INDEX IF NOT EXISTS notes_tags_gin_idx
  ON public.notes USING gin (tags);
