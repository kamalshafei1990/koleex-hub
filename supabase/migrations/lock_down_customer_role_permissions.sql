-- ============================================================================
-- lock_down_customer_role_permissions
--
-- The "Customer" role (scope='customer') was seeded with can_view=true on
-- nearly every internal module: Employees, Finance, CRM, Invoices,
-- Contacts, Customers directory, Appraisals, Recruitment, Sales, Discuss,
-- Landed Cost, Projects, Planning, Catalogs, etc. A customer user signed
-- in today could read every employee's appraisal, every supplier's terms,
-- every internal sales pipeline just by navigating to those apps.
--
-- Lock Customer down to the minimal public surface it actually needs:
--
--   · Dashboard         — hub home
--   · Products          — public catalog (already strips cost/supplier
--                         server-side)
--   · Quotations        — so customers can see their own quotes/requests
--   · Calendar · Notes · To-do · Koleex Mail — personal productivity
--     (also universally allowed via TYPE_C_MODULES in use-scope.ts,
--     but keeping the rows makes the Access Rights tab accurate).
--   · Settings          — own profile / preferences
--
-- Everything else gets can_view=false. Rows are preserved so the
-- Access Rights UI can show them as explicit "no" rather than
-- "unknown".
--
-- Applied 2026-04-23 via MCP; this file is kept so fresh environments
-- seed the same safe baseline.
-- ============================================================================

UPDATE koleex_permissions p
   SET can_view = CASE
         WHEN p.module_name IN (
           'Dashboard', 'Products', 'Quotations',
           'Calendar', 'Notes', 'To-do', 'Koleex Mail', 'Settings'
         ) THEN true
         ELSE false
       END,
       can_create = CASE
         WHEN p.module_name = 'Quotations' THEN p.can_create
         ELSE false
       END,
       can_edit = CASE
         WHEN p.module_name IN ('Quotations', 'Settings') THEN p.can_edit
         ELSE false
       END,
       can_delete = false
  FROM roles r
 WHERE p.role_id = r.id
   AND r.scope = 'customer'
   AND r.name  = 'Customer';
