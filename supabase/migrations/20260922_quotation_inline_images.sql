-- Quotations whose doc still carries base64 photos inline (item.image =
-- "data:image/…"). One such document is up to half a megabyte of JSON that
-- every open, save and PDF render moves in full — the reason a 59-item
-- quotation took seconds to open. New uploads go to storage; these two
-- functions let /api/quotations/compact-images find and shrink the old ones.

create or replace function public.fn_quotations_inline_images(p_tenant_id uuid, p_limit int default 4)
returns table (id uuid, quote_no text)
language sql
stable
set search_path = public
as $$
  select q.id, q.quote_no
  from public.quotations q
  where q.tenant_id = p_tenant_id
    and q.doc::text like '%data:image%'
  order by q.updated_at desc
  limit greatest(1, least(p_limit, 20))
$$;

create or replace function public.fn_quotations_inline_images_count(p_tenant_id uuid)
returns bigint
language sql
stable
set search_path = public
as $$
  select count(*)
  from public.quotations q
  where q.tenant_id = p_tenant_id
    and q.doc::text like '%data:image%'
$$;
