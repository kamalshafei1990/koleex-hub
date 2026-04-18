/* ===== KOLEEX RBAC Types ===== */

export type Role =
  | 'super_admin'
  | 'admin'
  | 'finance'
  | 'pricing_manager'
  | 'sales_manager'
  | 'sales_person'
  | 'agent'
  | 'distributor'
  | 'dealer'
  | 'customer';

export type DataField =
  | 'koleex_cost'
  | 'base_price'
  | 'pricing_formula'
  | 'product_level_margin'
  | 'channel_multipliers'
  | 'platinum_price'
  | 'gold_price'
  | 'silver_price'
  | 'retail_global_price'
  | 'retail_market_price'
  | 'profit_margin'
  | 'profit_amount'
  | 'commission'
  | 'landed_cost'
  | 'competitor_prices'
  | 'market_band_config'
  | 'discount_rules'
  | 'approval_matrix';

export type CalculatorView = 'full' | 'sales' | 'partner';

export interface RoleConfig {
  id: Role;
  label: string;
  description: string;
  tier?: string; // For partner roles: which price tier they see
  calculatorView: CalculatorView;
  color: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
}
