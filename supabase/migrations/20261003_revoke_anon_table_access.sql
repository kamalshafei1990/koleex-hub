-- ---------------------------------------------------------------------------
-- 20261003_revoke_anon_table_access — close the public anon/authenticated
-- table surface.
--
-- WHY: `rls_sweep_all_missing_tables.sql` (and the CRM / landed-cost DDL)
-- enabled RLS with `FOR ALL USING (true) WITH CHECK (true)` policies that have
-- NO `TO service_role` clause — i.e. they apply to PUBLIC. Combined with the
-- public `NEXT_PUBLIC_SUPABASE_ANON_KEY` shipped in the browser bundle, this
-- lets anyone query accounting / finance / inventory / purchase / sales /
-- supplier / vendor / CRM tables directly, bypassing the application entirely.
--
-- FIX: revoke table access from the `anon` and `authenticated` roles, matching
-- the lockdown pattern already used for ai_* / qa_* / project_members tables.
-- `service_role` keeps access (it bypasses RLS) and the app talks to the DB
-- only through the service-role server client.
--
-- ⚠️  PREREQUISITE: the legacy /sales modules (Dashboard / Pipeline / Customers
--     / Reports) still READ these tables from the browser via the anon client
--     (`supabase-admin.ts`). They must be migrated to server APIs BEFORE this
--     is applied, or /sales will stop loading. See the "browser-DB-access
--     programme" note in those components.
-- ---------------------------------------------------------------------------

-- ── ACCOUNTING ──
REVOKE ALL ON accounting_accounts        FROM anon, authenticated;
REVOKE ALL ON accounting_journal_entries FROM anon, authenticated;
REVOKE ALL ON accounting_journal_lines   FROM anon, authenticated;

-- ── COMMERCIAL ──
REVOKE ALL ON commercial_approval_authority  FROM anon, authenticated;
REVOKE ALL ON commercial_band_countries      FROM anon, authenticated;
REVOKE ALL ON commercial_channel_multipliers FROM anon, authenticated;
REVOKE ALL ON commercial_commission_tiers    FROM anon, authenticated;
REVOKE ALL ON commercial_customer_tiers      FROM anon, authenticated;
REVOKE ALL ON commercial_discount_tiers      FROM anon, authenticated;
REVOKE ALL ON commercial_market_bands        FROM anon, authenticated;
REVOKE ALL ON commercial_product_levels      FROM anon, authenticated;
REVOKE ALL ON commercial_settings            FROM anon, authenticated;
REVOKE ALL ON commercial_volume_discount_tiers FROM anon, authenticated;

-- ── FINANCE ──
REVOKE ALL ON finance_activity_log       FROM anon, authenticated;
REVOKE ALL ON finance_assets             FROM anon, authenticated;
REVOKE ALL ON finance_fx_exchanges       FROM anon, authenticated;
REVOKE ALL ON finance_fx_rates           FROM anon, authenticated;
REVOKE ALL ON finance_opening_balances   FROM anon, authenticated;
REVOKE ALL ON finance_report_exports     FROM anon, authenticated;

-- ── INVENTORY ──
REVOKE ALL ON inventory_audit_log             FROM anon, authenticated;
REVOKE ALL ON inventory_batches               FROM anon, authenticated;
REVOKE ALL ON inventory_item_categories       FROM anon, authenticated;
REVOKE ALL ON inventory_item_code_sequences   FROM anon, authenticated;
REVOKE ALL ON inventory_item_types            FROM anon, authenticated;
REVOKE ALL ON inventory_item_variants         FROM anon, authenticated;
REVOKE ALL ON inventory_items                 FROM anon, authenticated;
REVOKE ALL ON inventory_return_items          FROM anon, authenticated;
REVOKE ALL ON inventory_return_movements      FROM anon, authenticated;
REVOKE ALL ON inventory_returns               FROM anon, authenticated;
REVOKE ALL ON inventory_serials               FROM anon, authenticated;
REVOKE ALL ON inventory_stock_balances        FROM anon, authenticated;
REVOKE ALL ON inventory_stock_movements       FROM anon, authenticated;
REVOKE ALL ON inventory_valuation             FROM anon, authenticated;
REVOKE ALL ON inventory_warehouses            FROM anon, authenticated;

-- ── PURCHASE ──
REVOKE ALL ON purchase_approval_rules   FROM anon, authenticated;
REVOKE ALL ON purchase_categories       FROM anon, authenticated;
REVOKE ALL ON purchase_order_items      FROM anon, authenticated;
REVOKE ALL ON purchase_orders           FROM anon, authenticated;
REVOKE ALL ON purchase_receipt_items    FROM anon, authenticated;
REVOKE ALL ON purchase_receipts         FROM anon, authenticated;
REVOKE ALL ON purchase_requisition_items FROM anon, authenticated;
REVOKE ALL ON purchase_requisitions     FROM anon, authenticated;
REVOKE ALL ON purchase_return_items     FROM anon, authenticated;
REVOKE ALL ON purchase_returns          FROM anon, authenticated;
REVOKE ALL ON purchase_rfq_items        FROM anon, authenticated;
REVOKE ALL ON purchase_rfqs             FROM anon, authenticated;

-- ── SALES ──
REVOKE ALL ON sales_shipment_items FROM anon, authenticated;
REVOKE ALL ON sales_shipments      FROM anon, authenticated;

-- ── SUPPLIER ──
REVOKE ALL ON supplier_contracts        FROM anon, authenticated;
REVOKE ALL ON supplier_price_list_items FROM anon, authenticated;
REVOKE ALL ON supplier_price_lists      FROM anon, authenticated;

-- ── VENDOR ──
REVOKE ALL ON vendor_bill_items FROM anon, authenticated;
REVOKE ALL ON vendor_bills      FROM anon, authenticated;
REVOKE ALL ON vendor_payments   FROM anon, authenticated;

-- ── CRM ──
REVOKE ALL ON crm_stages        FROM anon, authenticated;
REVOKE ALL ON crm_opportunities FROM anon, authenticated;
REVOKE ALL ON crm_activities    FROM anon, authenticated;

-- ── LANDED COST ──
REVOKE ALL ON landed_cost_simulations FROM anon, authenticated;
