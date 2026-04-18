import type { Role, RoleConfig, DataField, CalculatorView } from './rbac-types';

/* ===== Role Definitions ===== */

export const ROLES: Record<Role, RoleConfig> = {
  super_admin: {
    id: 'super_admin',
    label: 'Super Admin',
    description: 'Full system access including all cost, pricing, and configuration data',
    calculatorView: 'full',
    color: '#FF3B30',
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    description: 'Full operational access to pricing, margins, and system settings',
    calculatorView: 'full',
    color: '#1E1E20',
  },
  finance: {
    id: 'finance',
    label: 'Finance',
    description: 'Access to cost, pricing, profit, margins, and commission data',
    calculatorView: 'full',
    color: '#007AFF',
  },
  pricing_manager: {
    id: 'pricing_manager',
    label: 'Pricing Manager',
    description: 'Full pricing engine access including formulas, margins, and configuration',
    calculatorView: 'full',
    color: '#FF9500',
  },
  sales_manager: {
    id: 'sales_manager',
    label: 'Sales Manager',
    description: 'Sales pricing tools, team commission visibility, optional margin view',
    calculatorView: 'sales',
    color: '#34C759',
  },
  sales_person: {
    id: 'sales_person',
    label: 'Sales Person',
    description: 'Sales calculator with final prices, own commission only',
    calculatorView: 'sales',
    color: '#5856D6',
  },
  agent: {
    id: 'agent',
    label: 'Agent',
    description: 'Partner portal — sees Platinum (Agent) price and retail price only',
    tier: 'platinum',
    calculatorView: 'partner',
    color: '#7BA1C2',
  },
  distributor: {
    id: 'distributor',
    label: 'Distributor',
    description: 'Partner portal — sees Gold (Distributor) price and retail price only',
    tier: 'gold',
    calculatorView: 'partner',
    color: '#C9973F',
  },
  dealer: {
    id: 'dealer',
    label: 'Dealer',
    description: 'Partner portal — sees Silver (Dealer) price and retail price only',
    tier: 'silver',
    calculatorView: 'partner',
    color: '#A8A9AD',
  },
  customer: {
    id: 'customer',
    label: 'Customer',
    description: 'Retail price visibility only — no internal pricing data',
    tier: 'retail',
    calculatorView: 'partner',
    color: '#6B8F71',
  },
};

/* ===== Data Visibility Matrix ===== */
/* true = visible, false = hidden, 'optional' = configurable */

export const DATA_VISIBILITY: Record<DataField, Record<Role, boolean | 'optional'>> = {
  koleex_cost: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: false, sales_person: false,
    agent: false, distributor: false, dealer: false, customer: false,
  },
  base_price: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: false, sales_person: false,
    agent: false, distributor: false, dealer: false, customer: false,
  },
  pricing_formula: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: false, sales_person: false,
    agent: false, distributor: false, dealer: false, customer: false,
  },
  product_level_margin: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: false, sales_person: false,
    agent: false, distributor: false, dealer: false, customer: false,
  },
  channel_multipliers: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: false, sales_person: false,
    agent: false, distributor: false, dealer: false, customer: false,
  },
  platinum_price: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: true, sales_person: true,
    agent: true, distributor: false, dealer: false, customer: false,
  },
  gold_price: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: true, sales_person: true,
    agent: false, distributor: true, dealer: false, customer: false,
  },
  silver_price: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: true, sales_person: true,
    agent: false, distributor: false, dealer: true, customer: false,
  },
  retail_global_price: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: true, sales_person: true,
    agent: true, distributor: true, dealer: true, customer: true,
  },
  retail_market_price: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: true, sales_person: true,
    agent: true, distributor: true, dealer: true, customer: true,
  },
  profit_margin: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: 'optional', sales_person: false,
    agent: false, distributor: false, dealer: false, customer: false,
  },
  profit_amount: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: 'optional', sales_person: false,
    agent: false, distributor: false, dealer: false, customer: false,
  },
  commission: {
    super_admin: true, admin: true, finance: true, pricing_manager: false,
    sales_manager: true, sales_person: true,
    agent: false, distributor: false, dealer: false, customer: false,
  },
  landed_cost: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: false, sales_person: false,
    agent: false, distributor: false, dealer: false, customer: false,
  },
  competitor_prices: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: true, sales_person: false,
    agent: false, distributor: false, dealer: false, customer: false,
  },
  market_band_config: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: false, sales_person: false,
    agent: false, distributor: false, dealer: false, customer: false,
  },
  discount_rules: {
    super_admin: true, admin: true, finance: true, pricing_manager: true,
    sales_manager: true, sales_person: false,
    agent: false, distributor: false, dealer: false, customer: false,
  },
  approval_matrix: {
    super_admin: true, admin: true, finance: false, pricing_manager: true,
    sales_manager: true, sales_person: false,
    agent: false, distributor: false, dealer: false, customer: false,
  },
};

/* ===== Navigation Visibility ===== */

export const NAV_VISIBILITY: Record<string, Role[]> = {
  // Pricing Engine sections
  'pricing-dashboard': ['super_admin', 'admin', 'finance', 'pricing_manager'],
  'pricing-rules': ['super_admin', 'admin', 'pricing_manager'],
  'pricing-flow': ['super_admin', 'admin', 'pricing_manager'],
  'pricing-formula': ['super_admin', 'admin', 'pricing_manager'],
  'product-levels': ['super_admin', 'admin', 'pricing_manager'],
  'market-bands': ['super_admin', 'admin', 'pricing_manager'],
  'customer-tiers': ['super_admin', 'admin', 'pricing_manager', 'sales_manager'],
  'landed-cost': ['super_admin', 'admin', 'finance', 'pricing_manager'],
  'competitor-comparison': ['super_admin', 'admin', 'pricing_manager', 'sales_manager'],
  'profit-analysis': ['super_admin', 'admin', 'finance', 'pricing_manager'],
  'scenario-library': ['super_admin', 'admin', 'pricing_manager', 'sales_manager'],
  'pricing-settings': ['super_admin', 'admin'],
  // Calculator access (different views per role)
  'price-calculator': ['super_admin', 'admin', 'finance', 'pricing_manager', 'sales_manager', 'sales_person', 'agent', 'distributor', 'dealer'],
  // Commission
  'commission-system': ['super_admin', 'admin', 'finance', 'sales_manager', 'sales_person'],
  // RBAC management
  'rbac-settings': ['super_admin', 'admin'],
};

/* ===== Helper Functions ===== */

export function canView(role: Role, field: DataField): boolean {
  const access = DATA_VISIBILITY[field]?.[role];
  return access === true || access === 'optional';
}

export function isOptional(role: Role, field: DataField): boolean {
  return DATA_VISIBILITY[field]?.[role] === 'optional';
}

export function canAccessNav(role: Role, navKey: string): boolean {
  const allowedRoles = NAV_VISIBILITY[navKey];
  if (!allowedRoles) return true; // Default: accessible
  return allowedRoles.includes(role);
}

export function getCalculatorView(role: Role): CalculatorView {
  return ROLES[role].calculatorView;
}

export function getVisibleTier(role: Role): string | undefined {
  return ROLES[role].tier;
}

export function getRoleLabel(role: Role): string {
  return ROLES[role].label;
}

export function getRoleColor(role: Role): string {
  return ROLES[role].color;
}
