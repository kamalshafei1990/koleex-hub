-- ---------------------------------------------------------------------------
-- Discuss pending uploads (2026-09-29) — who uploaded an unsent Discuss file.
--
-- GET /api/discuss/pending-media previews an attachment / voice clip that was
-- uploaded but whose message never reached the server (a failed send restored
-- from the reload-proof outbox). Until now it relied on the upload path being
-- unguessable. This table binds each Discuss upload to the account (and
-- tenant) that made it, so the route serves a path only to its uploader.
--
-- Written by the server only:
--   · POST /api/storage/upload        — after a discuss-media / discuss-voice
--                                        object is stored;
--   · POST /api/storage/signed-upload — when a direct-upload token for a
--                                        Discuss path is minted (the browser
--                                        then PUTs the bytes itself, so the
--                                        signing moment is the only point the
--                                        server knows who the uploader is).
-- Service-role only: RLS enabled with NO policies, grants revoked.
--
-- Idempotent. The app degrades gracefully until this is applied: if the table
-- is missing, pending-media falls back to the previous rule (active member of
-- the target channel in the caller's tenant + unguessable recent path).
-- Rows only matter for the outbox TTL (7 days); the API prunes rows older than
-- 8 days opportunistically.
-- ---------------------------------------------------------------------------

create table if not exists public.discuss_pending_uploads (
  path        text        not null,
  bucket      text        not null
              check (bucket in ('discuss-media', 'discuss-voice')),
  account_id  uuid        not null references public.accounts(id) on delete cascade,
  tenant_id   uuid        not null,
  created_at  timestamptz not null default now(),
  primary key (bucket, path)
);

create index if not exists idx_discuss_pending_uploads_created
  on public.discuss_pending_uploads (created_at);

alter table public.discuss_pending_uploads enable row level security;
revoke all on public.discuss_pending_uploads from anon;
revoke all on public.discuss_pending_uploads from authenticated;
