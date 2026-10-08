-- ---------------------------------------------------------------------------
-- CEO Brand quick capture: the CEO speaks (and adds pictures) from his phone,
-- Koleex AI drafts the post in his voice. Owner-approved 30/09/2026
-- («أيوه، طبّقهم» — one column and one private bucket). ADDITIVE.
--
--   marketing_posts.capture  { transcript, lang, audio_path, audio_mime,
--       seconds, captured_by, captured_at } — what was said, in which
--       language, and where the recording is kept. null = not a capture.
--
--   storage bucket marketing-voice — PRIVATE. The recordings are read only
--       through the server (service role), which signs a short-lived link
--       for whoever may view CEO Brand. No storage policies are added on
--       purpose: anon/authenticated clients get no direct access.
--       10 MB; the audio types browsers record (webm/opus, mp4/aac) and the
--       common others.
--
-- Rollback: ALTER TABLE marketing_posts DROP COLUMN capture;
--           DELETE FROM storage.buckets WHERE id = 'marketing-voice'; (empty it first)
-- ---------------------------------------------------------------------------

ALTER TABLE marketing_posts ADD COLUMN IF NOT EXISTS capture jsonb;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketing-voice',
  'marketing-voice',
  false,
  10485760,
  ARRAY['audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/ogg', 'audio/wav']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
