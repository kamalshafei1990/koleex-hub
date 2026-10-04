-- ---------------------------------------------------------------------------
-- Notes audit (2026-09-25) — indexes + private image bucket.
-- Idempotent: safe to run more than once. NOT applied automatically; the lead
-- engineer applies it. The app code works before it is applied (image
-- uploads fail with a visible error until the bucket exists; queries are
-- just slower without the indexes).
-- ---------------------------------------------------------------------------

-- 1. List endpoint: owner's notes filtered by trash state, ordered pinned-first
--    then most recently updated.
CREATE INDEX IF NOT EXISTS notes_account_deleted_pinned_updated_idx
  ON public.notes (account_id, deleted_at, is_pinned DESC, updated_at DESC);

-- 2. Trash purge cron: WHERE deleted_at IS NOT NULL AND deleted_at < cutoff.
CREATE INDEX IF NOT EXISTS notes_deleted_at_idx
  ON public.notes (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 3. Sharing lookups: "shared with me", role resolution, is_shared flag.
CREATE INDEX IF NOT EXISTS note_shares_shared_with_account_id_idx
  ON public.note_shares (shared_with_account_id);
CREATE INDEX IF NOT EXISTS note_shares_note_id_idx
  ON public.note_shares (note_id);
CREATE INDEX IF NOT EXISTS note_shares_shared_by_account_id_idx
  ON public.note_shares (shared_by_account_id);

-- 4. Substring search (ILIKE '%term%') on title + body_plain.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS notes_title_trgm_idx
  ON public.notes USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS notes_body_plain_trgm_idx
  ON public.notes USING gin (body_plain gin_trgm_ops);

-- 5. Private bucket for note images. Objects: <tenant_id>/<note_id>/<uuid>.<ext>
--    Served only through GET /api/notes/[id]/images/[name] (service role +
--    note access check → short-lived signed URL). No storage.objects policies
--    are added on purpose: anon/authenticated clients get no direct access.
--    Limits mirror src/lib/notes-policy.ts (10 MB; png/jpeg/webp/gif).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notes-media',
  'notes-media',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
