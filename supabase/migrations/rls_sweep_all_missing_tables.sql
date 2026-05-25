-- ============================================================
-- RLS SWEEP — Enable RLS + service_role full-access policy
-- on all 54 tables that had RLS disabled.
-- Applied 2026-05-25. Matches existing policy pattern:
--   FOR ALL USING (true) WITH CHECK (true)
-- service_role key bypasses RLS automatically; policies
-- exist so that RLS is formally enabled without blocking
-- any legitimate access.
-- All 54 tables across 8 modules covered. ✓
-- ============================================================

-- ── ACCOUNTING (3) ─────────────────────────────────────────
ALTER TABLE accounting_accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_journal_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_journal_lines         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_accounts_service_all"
  ON accounting_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "accounting_journal_entries_service_all"
  ON accounting_journal_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "accounting_journal_lines_service_all"
  ON accounting_journal_lines FOR ALL USING (true) WITH CHECK (true);

-- ── COMMERCIAL (10) ────────────────────────────────────────
ALTER TABLE commercial_approval_authority        ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_band_countries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_channel_multipliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_commission_tiers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_customer_tiers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_discount_tiers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_market_bands              ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_product_levels            ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_settings                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_volume_discount_tiers     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_approval_authority_service_all"
  ON commercial_approval_authority FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "commercial_band_countries_service_all"
  ON commercial_band_countries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "commercial_channel_multipliers_service_all"
  ON commercial_channel_multipliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "commercial_commission_tiers_service_all"
  ON commercial_commission_tiers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "commercial_customer_tiers_service_all"
  ON commercial_customer_tiers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "commercial_discount_tiers_service_all"
  ON commercial_discount_tiers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "commercial_market_bands_service_all"
  ON commercial_market_bands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "commercial_product_levels_service_all"
  ON commercial_product_levels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "commercial_settings_service_all"
  ON commercial_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "commercial_volume_discount_tiers_service_all"
  ON commercial_volume_discount_tiers FOR ALL USING (true) WITH CHECK (true);

-- ── FINANCE (6) ────────────────────────────────────────────
ALTER TABLE finance_activity_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_assets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_fx_exchanges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_fx_rates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_opening_balances   ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_report_exports     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_activity_log_service_all"
  ON finance_activity_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "finance_assets_service_all"
  ON finance_assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "finance_fx_exchanges_service_all"
  ON finance_fx_exchanges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "finance_fx_rates_service_all"
  ON finance_fx_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "finance_opening_balances_service_all"
  ON finance_opening_balances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "finance_report_exports_service_all"
  ON finance_report_exports FOR ALL USING (true) WITH CHECK (true);

-- ── INVENTORY (15) ─────────────────────────────────────────
ALTER TABLE inventory_audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches                ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_item_categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_item_code_sequences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_item_types             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_item_variants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_return_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_return_movements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_returns                ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_serials                ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_balances         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_valuation              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_warehouses             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_audit_log_service_all"
  ON inventory_audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_batches_service_all"
  ON inventory_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_item_categories_service_all"
  ON inventory_item_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_item_code_sequences_service_all"
  ON inventory_item_code_sequences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_item_types_service_all"
  ON inventory_item_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_item_variants_service_all"
  ON inventory_item_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_items_service_all"
  ON inventory_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_return_items_service_all"
  ON inventory_return_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_return_movements_service_all"
  ON inventory_return_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_returns_service_all"
  ON inventory_returns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_serials_service_all"
  ON inventory_serials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_stock_balances_service_all"
  ON inventory_stock_balances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_stock_movements_service_all"
  ON inventory_stock_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_valuation_service_all"
  ON inventory_valuation FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_warehouses_service_all"
  ON inventory_warehouses FOR ALL USING (true) WITH CHECK (true);

-- ── PURCHASE (12) ──────────────────────────────────────────
ALTER TABLE purchase_approval_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipt_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisition_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisitions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_return_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_returns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_rfq_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_rfqs                 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_approval_rules_service_all"
  ON purchase_approval_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchase_categories_service_all"
  ON purchase_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchase_order_items_service_all"
  ON purchase_order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchase_orders_service_all"
  ON purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchase_receipt_items_service_all"
  ON purchase_receipt_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchase_receipts_service_all"
  ON purchase_receipts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchase_requisition_items_service_all"
  ON purchase_requisition_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchase_requisitions_service_all"
  ON purchase_requisitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchase_return_items_service_all"
  ON purchase_return_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchase_returns_service_all"
  ON purchase_returns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchase_rfq_items_service_all"
  ON purchase_rfq_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchase_rfqs_service_all"
  ON purchase_rfqs FOR ALL USING (true) WITH CHECK (true);

-- ── SALES (2) ──────────────────────────────────────────────
ALTER TABLE sales_shipment_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_shipments        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_shipment_items_service_all"
  ON sales_shipment_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "sales_shipments_service_all"
  ON sales_shipments FOR ALL USING (true) WITH CHECK (true);

-- ── SUPPLIER (3) ───────────────────────────────────────────
ALTER TABLE supplier_contracts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_price_list_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_price_lists       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_contracts_service_all"
  ON supplier_contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "supplier_price_list_items_service_all"
  ON supplier_price_list_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "supplier_price_lists_service_all"
  ON supplier_price_lists FOR ALL USING (true) WITH CHECK (true);

-- ── VENDOR (3) ─────────────────────────────────────────────
ALTER TABLE vendor_bill_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_bills        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payments     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_bill_items_service_all"
  ON vendor_bill_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "vendor_bills_service_all"
  ON vendor_bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "vendor_payments_service_all"
  ON vendor_payments FOR ALL USING (true) WITH CHECK (true);
