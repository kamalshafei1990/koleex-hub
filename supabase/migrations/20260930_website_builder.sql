-- ---------------------------------------------------------------------------
-- Website Page Builder (Phase 3 step 3): the public site's pages are built in
-- the Hub's Website app from brand-locked sections, in English, Arabic and
-- Chinese, saved as a draft and published. Owner-approved 30/09/2026
-- («أيوه، ضيفه» — a draft and a published copy per page, a version history,
-- and a place for the site's photos). ADDITIVE.
--
--   pages.draft      jsonb  the page being edited (lib/website/page-doc:
--                           { v: 1, sections: [...], seo: {...} }); null = none
--   pages.published  jsonb  what the site shows (the bridge serves ONLY this,
--                           or the draft to the site's own signed preview)
--   pages.version    int    the published version (0 = never published: the
--                           site keeps its built-in page)
--   pages.published_at / published_by (accounts.id)
--   pages.draft_updated_at / draft_updated_by — who saved last; the save is
--                           refused (409) when the draft moved under the editor
--
--   page_versions — every publish, kept for history and restore. RLS ON with
--       no policies, like pages/sections/elements since 14/07/2026: only the
--       Hub's server (service role) reads or writes it.
--
--   storage bucket website-media — PUBLIC read: the site shows these photos
--       (through its own image optimizer). Written only through the Hub's
--       server; no storage policies, so no browser can upload or delete.
--       8 MB; photos only (jpeg, png, webp, avif) — no SVG (it can carry
--       script).
--
-- Rollback: ALTER TABLE pages DROP COLUMN draft, DROP COLUMN published,
--             DROP COLUMN version, DROP COLUMN published_at,
--             DROP COLUMN published_by, DROP COLUMN draft_updated_at,
--             DROP COLUMN draft_updated_by;
--           DROP TABLE page_versions;
--           DELETE FROM storage.buckets WHERE id = 'website-media'; (empty it first)
-- ---------------------------------------------------------------------------

ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS draft jsonb,
  ADD COLUMN IF NOT EXISTS published jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid,
  ADD COLUMN IF NOT EXISTS draft_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS draft_updated_by uuid;

CREATE TABLE IF NOT EXISTS page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  version integer NOT NULL,
  doc jsonb NOT NULL,
  published_by uuid,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, version)
);

CREATE INDEX IF NOT EXISTS page_versions_page_idx ON page_versions (page_id, version DESC);

ALTER TABLE page_versions ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'website-media',
  'website-media',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
