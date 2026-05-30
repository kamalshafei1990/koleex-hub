-- ============================================================================
-- Supplier Intelligence · Phase 2 · Media + Documents Intelligence tranche
-- Migration: supplier_media_evidence_intelligence
--
-- Turns supplier media/documents into governed evidence assets. Additive +
-- idempotent: extends the canonical supplier_media table with certification-
-- intelligence metadata + optional product linkage, and widens the category
-- CHECK to the full evidence taxonomy. No new tables, no destructive ops; all
-- previously-valid values (incl. QR categories) remain valid.
-- ============================================================================

-- 1) Certification intelligence + product linkage.
--    issuer (= issuing authority), issued_date, expiry_date already exist;
--    verification is driven by verified_by / verified_at + lifecycle_status.
alter table public.supplier_media
  add column if not exists cert_type text;
alter table public.supplier_media
  add column if not exists markets_covered text[] not null default '{}'::text[];
alter table public.supplier_media
  add column if not exists product_id uuid references public.products(id) on delete set null;

create index if not exists ix_supplier_media_product
  on public.supplier_media (product_id);
create index if not exists ix_supplier_media_supplier_category
  on public.supplier_media (supplier_id, category) where deleted_at is null;

-- 2) Widen the governed category vocabulary to the evidence taxonomy.
alter table public.supplier_media drop constraint if exists sm_category_chk;
alter table public.supplier_media
  add constraint sm_category_chk
  check (category = any (array[
    -- existing document / media categories
    'business_license','certification','audit_report','contract','nda',
    'product_catalog','quotation','price_list','factory_photo','factory_video',
    'team_photo','product_photo','company_logo','other',
    -- communication QR categories (Contacts + QR tranche)
    'sales','support','finance','boss','logistics','group','showroom','factory',
    -- evidence taxonomy (Media + Documents Intelligence tranche)
    'brochure','presentation','production_line','qc_photo','warehouse_photo',
    'showroom_photo','license','registration','compliance_doc','sample_report',
    'inspection_report','packing_standard','business_card','product_video',
    'production_video'
  ]));
