-- ============================================================================
-- Supplier Intelligence · Phase 2 · Contacts + WeChat QR Intelligence tranche
-- Migration: supplier_contacts_qr_intelligence
--
-- Turns supplier contact persons into communication-intelligence entities and
-- models WeChat/WeCom QR codes as governed media linked to a supplier and
-- (optionally) a specific contact person. Additive + idempotent. No new
-- tables, no destructive ops, no enum reuse. Extends the Phase-1 foundation
-- tables (supplier_contact_persons, supplier_media), which stay server-gated.
-- ============================================================================

-- 1) Contact persons: explicit job position + per-contact visibility tier.
alter table public.supplier_contact_persons
  add column if not exists position text;
alter table public.supplier_contact_persons
  add column if not exists visibility_tier text not null default 'internal';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_scp_visibility_tier') then
    alter table public.supplier_contact_persons
      add constraint chk_scp_visibility_tier
      check (visibility_tier in ('public','internal','procurement','finance','management'))
      not valid;
  end if;
end $$;

-- 2) Governed media: link a QR (or any media row) to a specific contact person.
--    ON DELETE SET NULL — removing a contact never orphans or cascade-deletes
--    the media row; it simply detaches.
alter table public.supplier_media
  add column if not exists contact_id uuid
  references public.supplier_contact_persons(id) on delete set null;

create index if not exists ix_supplier_media_contact
  on public.supplier_media (contact_id);

-- Helps the QR gallery query (supplier + class, excluding soft-deleted).
create index if not exists ix_supplier_media_class
  on public.supplier_media (supplier_id, media_class) where deleted_at is null;

-- 3) Model communication QR codes as a first-class governed media kind.
--    Additively extend the existing CHECK vocabularies: add the 'qr_code'
--    media_class and the 8 QR categories. All previously-valid values remain
--    valid; the future Media/Documents tranche keeps its document categories.
--    (supplier_media is empty at apply time, so recreate validates instantly.)
alter table public.supplier_media drop constraint if exists sm_media_class_chk;
alter table public.supplier_media
  add constraint sm_media_class_chk
  check (media_class = any (array['document','image','video','qr_code','other']));

alter table public.supplier_media drop constraint if exists sm_category_chk;
alter table public.supplier_media
  add constraint sm_category_chk
  check (category = any (array[
    'business_license','certification','audit_report','contract','nda',
    'product_catalog','quotation','price_list','factory_photo','factory_video',
    'team_photo','product_photo','company_logo','other',
    'sales','support','finance','boss','logistics','group','showroom','factory'
  ]));
