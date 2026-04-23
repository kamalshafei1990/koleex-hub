-- ============================================================================
-- add_product_data_module
--
-- Introduce a new "Product Data" module permission. The hub is splitting
-- the Products experience in two:
--
--   /products       — PUBLIC catalog (no cost / no supplier). Visible to
--                     every user type including customers. No change to
--                     the existing "Products" module which guards it.
--
--   /product-data   — INTERNAL admin tool (cost, supplier, contract
--                     terms, internal notes). Guarded by this new
--                     "Product Data" module.
--
-- Super admins always see everything via the is_super_admin bootstrap
-- shortcut (no row needed). Other roles inherit the permission only if
-- they currently have "Products > Cost Price" — those are the people
-- already trusted with cost information, so workflow continuity is
-- preserved.
--
-- Customer-scoped roles are explicitly stripped so a bad INSERT on the
-- parent Cost Price row can't leak Product Data to them.
--
-- Applied 2026-04-23 via MCP; this file is kept so fresh environments
-- reproduce the same permission state.
-- ============================================================================

-- 1) Grandfather Product Data into every role that had Cost Price.
INSERT INTO koleex_permissions (role_id, module_name, can_view, can_create, can_edit, can_delete)
SELECT
  role_id,
  'Product Data',
  can_view,
  can_create,
  can_edit,
  can_delete
FROM koleex_permissions
WHERE module_name = 'Products > Cost Price'
ON CONFLICT (role_id, module_name) DO NOTHING;

-- 2) Defensive: no customer role should ever carry Product Data.
DELETE FROM koleex_permissions p
 USING roles r
 WHERE p.role_id = r.id
   AND p.module_name = 'Product Data'
   AND r.scope = 'customer';
