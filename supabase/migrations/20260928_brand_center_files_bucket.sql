-- ---------------------------------------------------------------------------
-- Brand Center files (plan step C5). ADDITIVE: one new PRIVATE bucket.
--
-- brand-center holds the files of every design (print PDFs, SVG, PNG, DXF…).
-- Private: no public URL ever. Uploads and downloads go only through
-- /api/brand-center/*, which checks the Brand Center rights in Roles &
-- Permissions and hands out short-lived signed links. 500 MB per file for
-- large print files; the path is <tenant>/<item>/<design>/<file>.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('brand-center', 'brand-center', false, 524288000)
ON CONFLICT (id) DO NOTHING;
