-- ---------------------------------------------------------------------------
-- Koleex catalogs on the public website (Phase 3 step 4). Owner, 30/09/2026:
-- "Just Koleex catalogs only — don't show any supplier catalog." So they
-- live APART from the Catalogs app (whose 58 rows are all suppliers'): a
-- table of their own, edited in the Website app, and a bucket of their own.
-- A supplier catalog cannot reach the site by any switch — it is never in
-- here. ADDITIVE.
--
--   website_catalogs — title / description in English, Arabic, Chinese
--       (jsonb {en, ar, zh}), the PDF's path in website-files, its size, a
--       cover photo (website-media), year, order, shown on the site or not.
--       RLS ON, no policies: only the Hub's server (service role) reads or
--       writes it; the site reads it through the bridge.
--
--   storage bucket website-files — PUBLIC read (visitors download the PDF),
--       PDF only, 100 MB. Written only through the Hub's server (a signed
--       upload link issued to someone with Website edit); no storage
--       policies.
--
-- Rollback: DROP TABLE website_catalogs;
--           DELETE FROM storage.buckets WHERE id = 'website-files'; (empty it first)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS website_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title jsonb NOT NULL,
  description jsonb,
  file_path text NOT NULL,
  file_size bigint,
  cover_url text,
  year integer,
  sort integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE website_catalogs ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'website-files',
  'website-files',
  true,
  104857600,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
