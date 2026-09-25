-- ---------------------------------------------------------------------------
-- Reports app — Phase 2C: photos and files on a report (owner's pick,
-- 25 Sep 2026). ADDITIVE ONLY: one new table, one new PRIVATE bucket.
--
-- A row is one file on one report version. A new version (revise) copies
-- the rows, pointing at the SAME stored objects, so an object is removed
-- from storage only when no row references it any more (the routes check).
--
-- Access is server-only, like the other work_report_* tables: RLS on with no
-- policies; uploads go through POST /api/work-reports/[id]/attachments and
-- every read through /api/files/report/<id>, which applies the report's own
-- read rule (src/lib/reports/access.ts) on each request. The bucket is
-- private, so no public URL exists for any of these objects.
--
-- The bucket's MIME list is the same list as src/lib/reports/attachments.ts
-- (REPORT_ATTACHMENT_MIME) — validate:reports compares them. 4 MB matches
-- the transport ceiling the upload route runs under.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_report_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     uuid NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
  tenant_id     uuid,
  uploaded_by   uuid NOT NULL,
  -- Object paths inside the report-attachments bucket. thumb_path: the small
  -- preview made on the phone beside a photo (NULL for documents).
  storage_path  text NOT NULL,
  thumb_path    text,
  file_name     text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    integer NOT NULL CHECK (size_bytes > 0),
  -- Photos only: pixel size after the phone made it smaller.
  width         integer,
  height        integer,
  caption       text NOT NULL DEFAULT '',
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_report_attachments_report_idx ON work_report_attachments (report_id, position, created_at);
CREATE INDEX IF NOT EXISTS work_report_attachments_path_idx ON work_report_attachments (storage_path);

ALTER TABLE work_report_attachments ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-attachments', 'report-attachments', false, 4194304,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO NOTHING;
