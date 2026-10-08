-- Job titles in Chinese and Arabic (Brand Center business cards, 28/09/2026).
-- The Hub's pattern for names kept in the database (skills, behaviours):
-- nullable _zh / _ar columns beside the English one. English `title` stays
-- the source of truth and the fallback; a missing translation shows English.
alter table public.koleex_positions
  add column if not exists title_zh text,
  add column if not exists title_ar text;

comment on column public.koleex_positions.title_zh is 'Job title in Chinese; null = show the English title.';
comment on column public.koleex_positions.title_ar is 'Job title in Arabic; null = show the English title.';
