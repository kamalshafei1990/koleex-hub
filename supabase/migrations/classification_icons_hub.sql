-- Classification icon hub (Phase 1): single override layer keyed by (level, slug).
-- Additive only — does not touch divisions/categories/subcategories/products.
-- A row here means "this classification's icon is X"; absence = fall back to
-- the built-in code/storage icon. Kinds covered by slug without moving the
-- frozen kind catalog into the DB.
-- Applied to prod via Supabase migration `classification_icons_hub`.

create table if not exists public.classification_icons (
  id            uuid primary key default gen_random_uuid(),
  level         text not null check (level in ('division','category','subcategory','kind')),
  slug          text not null,
  icon_asset_id uuid references public.visual_assets(id) on delete set null,
  icon_url      text,
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  unique (level, slug)
);

create index if not exists classification_icons_level_idx on public.classification_icons (level);

-- Lock down: RLS on, no anon/auth policies → only service-role /api routes
-- can read/write (matches the existing P0-C product lockdown).
alter table public.classification_icons enable row level security;
