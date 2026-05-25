-- ============================================================
-- INV IO BUDGET — Comprehensive index coverage for all
-- inventory tables to eliminate sequential scans.
-- Applied 2026-05-25 after compute resize + DB restart.
-- All 18 inventory tables covered. ✓
-- ============================================================

-- inventory_transfers
CREATE INDEX IF NOT EXISTS idx_inv_xfr_tenant ON inventory_transfers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_xfr_tenant_created ON inventory_transfers (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_xfr_status ON inventory_transfers (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_xfr_src_wh ON inventory_transfers (source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_xfr_dst_wh ON inventory_transfers (destination_warehouse_id);

-- inventory_transfer_items
CREATE INDEX IF NOT EXISTS idx_inv_xfr_items_transfer ON inventory_transfer_items (transfer_id);
CREATE INDEX IF NOT EXISTS idx_inv_xfr_items_inv_item ON inventory_transfer_items (inventory_item_id);

-- inventory_transfer_movements
CREATE INDEX IF NOT EXISTS idx_inv_xfr_mv_transfer ON inventory_transfer_movements (transfer_id);
CREATE INDEX IF NOT EXISTS idx_inv_xfr_mv_out ON inventory_transfer_movements (transfer_out_movement_id);
CREATE INDEX IF NOT EXISTS idx_inv_xfr_mv_in ON inventory_transfer_movements (transfer_in_movement_id);

-- inventory_returns
CREATE INDEX IF NOT EXISTS idx_inv_ret_tenant ON inventory_returns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_ret_tenant_created ON inventory_returns (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_ret_status ON inventory_returns (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_ret_type ON inventory_returns (tenant_id, return_type);
CREATE INDEX IF NOT EXISTS idx_inv_ret_supplier ON inventory_returns (supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_ret_customer ON inventory_returns (customer_id) WHERE customer_id IS NOT NULL;

-- inventory_return_items
CREATE INDEX IF NOT EXISTS idx_inv_ret_items_return ON inventory_return_items (return_id);
CREATE INDEX IF NOT EXISTS idx_inv_ret_items_inv_item ON inventory_return_items (inventory_item_id);

-- inventory_return_movements
CREATE INDEX IF NOT EXISTS idx_inv_ret_mv_return ON inventory_return_movements (return_id);
CREATE INDEX IF NOT EXISTS idx_inv_ret_mv_movement ON inventory_return_movements (movement_id);

-- inventory_serials
CREATE INDEX IF NOT EXISTS idx_inv_serial_tenant ON inventory_serials (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_serial_item ON inventory_serials (tenant_id, inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_serial_status ON inventory_serials (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_serial_warehouse ON inventory_serials (warehouse_id) WHERE warehouse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_serial_cur_mv ON inventory_serials (current_movement_id) WHERE current_movement_id IS NOT NULL;

-- inventory_batches
CREATE INDEX IF NOT EXISTS idx_inv_batch_tenant ON inventory_batches (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_batch_item ON inventory_batches (tenant_id, inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_batch_status ON inventory_batches (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_batch_expiry ON inventory_batches (expiry_date) WHERE expiry_date IS NOT NULL;

-- inventory_item_variants
CREATE INDEX IF NOT EXISTS idx_inv_variant_tenant ON inventory_item_variants (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_variant_item ON inventory_item_variants (tenant_id, inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_variant_active ON inventory_item_variants (tenant_id, inventory_item_id) WHERE status = 'active';

-- inventory_audit_log
CREATE INDEX IF NOT EXISTS idx_inv_audit_tenant_created ON inventory_audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_audit_entity ON inventory_audit_log (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_inv_audit_action ON inventory_audit_log (tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_inv_audit_actor ON inventory_audit_log (actor_id) WHERE actor_id IS NOT NULL;

-- inventory_stock_balances
CREATE INDEX IF NOT EXISTS idx_inv_bal_tenant ON inventory_stock_balances (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_bal_item ON inventory_stock_balances (tenant_id, inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_bal_warehouse ON inventory_stock_balances (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_bal_item_wh ON inventory_stock_balances (inventory_item_id, warehouse_id);

-- inventory_valuation
CREATE INDEX IF NOT EXISTS idx_inv_val_tenant ON inventory_valuation (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_val_item ON inventory_valuation (tenant_id, inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_val_updated ON inventory_valuation (tenant_id, updated_at DESC);

-- inventory_warehouses
CREATE INDEX IF NOT EXISTS idx_inv_wh_tenant ON inventory_warehouses (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_wh_active ON inventory_warehouses (tenant_id, is_active);

-- inventory_item_types
CREATE INDEX IF NOT EXISTS idx_inv_itype_tenant ON inventory_item_types (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_itype_scope ON inventory_item_types (usage_scope);
CREATE INDEX IF NOT EXISTS idx_inv_itype_requires_product ON inventory_item_types (requires_product);

-- inventory_item_categories
CREATE INDEX IF NOT EXISTS idx_inv_icat_tenant ON inventory_item_categories (tenant_id);

-- inventory_item_code_sequences
CREATE INDEX IF NOT EXISTS idx_inv_code_seq_tenant ON inventory_item_code_sequences (tenant_id);

-- Refresh query planner statistics
ANALYZE inventory_items;
ANALYZE inventory_stock_movements;
ANALYZE inventory_transfers;
ANALYZE inventory_transfer_items;
ANALYZE inventory_transfer_movements;
ANALYZE inventory_returns;
ANALYZE inventory_return_items;
ANALYZE inventory_return_movements;
ANALYZE inventory_serials;
ANALYZE inventory_batches;
ANALYZE inventory_item_variants;
ANALYZE inventory_audit_log;
ANALYZE inventory_stock_balances;
ANALYZE inventory_valuation;
ANALYZE inventory_warehouses;
ANALYZE inventory_item_types;
ANALYZE inventory_item_categories;
ANALYZE inventory_item_code_sequences;
