-- Drop the FK from the sequence tables to `companies`.
--
-- The assumption was that a tenant IS a company row. It is not: live
-- quotations carry tenant 490fbd4d-… while the only companies row is
-- 1295d97e-…. `companies` is the customer/supplier directory, not the tenant
-- registry. The constraint therefore rejected every real document creation
-- with a foreign-key violation — caught by creating an actual quotation, not
-- by the migration applying cleanly.
--
-- Existing tenant-scoped tables in this schema carry tenant_id as a plain
-- uuid with no FK, for the same reason. These now match.

alter table public.doc_sequences
  drop constraint if exists doc_sequences_tenant_id_fkey;

alter table public.customer_code_sequences
  drop constraint if exists customer_code_sequences_tenant_id_fkey;
