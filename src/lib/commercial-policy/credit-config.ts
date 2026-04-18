import type { CustomerLevelConfig, CreditProfile, OverdueRule, CreditFlowStep, CustomerLevel } from './credit-types';

/* ===== Customer Level Configuration (Confirmed) ===== */

export const CUSTOMER_LEVELS: CustomerLevelConfig[] = [
  {
    level: 0, id: 'end_user', name: 'End User', color: '#86868B',
    description: 'Personal or small direct customer. Single item or small quantity purchases for personal use, not trading.',
    hasCredit: false, creditLimit: 'None', creditDays: 0,
    upgradeRequirement: 'Invoice ≤ $2,000 or quantity < 10 items',
    upgradeThreshold: null,
    priceAccess: 'Retail Price', discountAccess: 'None', supportLevel: 'Basic',
    marketRights: 'None',
  },
  {
    level: 1, id: 'silver', name: 'Silver', color: '#A8A9AD',
    description: 'Small trader or first commercial customer. First commercial-size order qualifies.',
    hasCredit: false, creditLimit: 'None', creditDays: 0,
    upgradeRequirement: 'First commercial order (e.g. $15,000+)',
    upgradeThreshold: 0,
    priceAccess: 'Silver Price (Dealer)', discountAccess: 'Limited', supportLevel: 'Standard',
    marketRights: 'Non-exclusive',
  },
  {
    level: 2, id: 'gold', name: 'Gold', color: '#C9973F',
    description: 'Distributor-level customer with proven purchase history and credit eligibility.',
    hasCredit: true, creditLimit: 'Limited (Avg Monthly × 3)', creditDays: 90,
    upgradeRequirement: 'Total purchase lifetime ≥ $500,000',
    upgradeThreshold: 500000,
    priceAccess: 'Gold Price (Distributor)', discountAccess: 'Standard', supportLevel: 'Priority',
    marketRights: 'Non-exclusive',
  },
  {
    level: 3, id: 'platinum', name: 'Platinum', color: '#7BA1C2',
    description: 'Major distributor with significant volume and extended credit access.',
    hasCredit: true, creditLimit: 'Higher (Avg Monthly × 4)', creditDays: 120,
    upgradeRequirement: 'Total purchase lifetime ≥ $3,000,000',
    upgradeThreshold: 3000000,
    priceAccess: 'Platinum Price (Agent)', discountAccess: 'Enhanced', supportLevel: 'Dedicated',
    marketRights: 'Priority territory',
  },
  {
    level: 4, id: 'diamond', name: 'Diamond', color: '#00BFFF',
    description: 'Sole agent / exclusive strategic partner. Contract required. Market exclusivity and territory protection.',
    hasCredit: true, creditLimit: 'Open Credit (Contract-based)', creditDays: 'Annual Settlement',
    upgradeRequirement: 'Contract + Management Approval + Sole Agent Agreement',
    upgradeThreshold: null,
    priceAccess: 'Best Price (Contract)', discountAccess: 'Full / Contract', supportLevel: 'Strategic / VIP',
    marketRights: 'Exclusive territory — KOLEEX does not sell to others in this market except through Diamond, per contract',
  },
];

/* ===== Overdue Policy (Confirmed) ===== */

export const OVERDUE_RULES: OverdueRule[] = [
  { range: '0–30', days: '0-30 days', action: 'reminder', actionLabel: 'Reminder / Warning', description: 'Payment reminder sent. No restrictions yet.', color: '#FF9500' },
  { range: '30–60', days: '30-60 days', action: 'no_new_orders', actionLabel: 'No New Orders', description: 'Customer cannot place new orders until payment is received.', color: '#FF3B30' },
  { range: '60–90', days: '60-90 days', action: 'credit_hold', actionLabel: 'Credit Hold', description: 'Credit facility suspended. All orders require advance payment.', color: '#FF3B30' },
  { range: '90+', days: '90+ days', action: 'account_blocked', actionLabel: 'Account Blocked', description: 'Full account suspension. No transactions allowed.', color: '#1E1E20' },
  { range: '120+', days: '120+ days', action: 'legal', actionLabel: 'Legal / Collection', description: 'Case escalated to legal department for debt collection.', color: '#1E1E20' },
];

/* ===== Credit Protection Rules ===== */

export const CREDIT_PROTECTION_RULES = [
  'No credit for new customers',
  'Credit starts only after customer reaches the appropriate customer level',
  'Credit limit increases gradually based on purchase history',
  'No new orders if overdue invoices exist',
  'Orders blocked if overdue > 30 days',
  'Credit hold if overdue > 60 days',
  'Account blocked if overdue > 90 days',
  'Credit review every 6 months',
  'Diamond requires contract for open credit',
  'Management approval required if order exceeds available credit',
];

/* ===== Credit Flow Steps ===== */

export const CREDIT_FLOW_STEPS: CreditFlowStep[] = [
  { step: 1, name: 'New Customer', description: 'Customer registers or places first order', icon: 'UserPlus' },
  { step: 2, name: 'Cash Orders', description: 'All initial orders are cash / advance payment', icon: 'Banknote' },
  { step: 3, name: 'Purchase History', description: 'System tracks total purchase lifetime', icon: 'BarChart3' },
  { step: 4, name: 'Eligible for Upgrade', description: 'Customer reaches upgrade threshold', icon: 'TrendingUp' },
  { step: 5, name: 'Upgrade Suggestion', description: 'System suggests level upgrade', icon: 'ArrowUpCircle' },
  { step: 6, name: 'Management Approval', description: 'Manager reviews and approves upgrade', icon: 'ShieldCheck' },
  { step: 7, name: 'Credit Evaluation', description: 'Finance evaluates credit worthiness', icon: 'FileSearch' },
  { step: 8, name: 'Set Credit Limit', description: 'Credit limit and days assigned', icon: 'Settings' },
  { step: 9, name: 'Orders on Credit', description: 'Customer can order within credit limit', icon: 'ShoppingCart' },
  { step: 10, name: 'Invoices & Payment', description: 'Invoices generated, payments tracked', icon: 'Receipt' },
  { step: 11, name: 'Credit Update', description: 'Credit utilization updated after payment', icon: 'RefreshCw' },
  { step: 12, name: 'Next Upgrade', description: 'Continue purchasing toward next level', icon: 'Award' },
];

/* ===== Mock Customer Profiles ===== */

export const CUSTOMER_PROFILES: CreditProfile[] = [
  { id: 'cp-001', customerName: 'Ahmed Trading Co', country: 'Egypt', countryCode: 'EG', customerLevel: 'gold', totalPurchaseLifetime: 720000, averageMonthlyPurchase: 45000, creditLimit: 135000, outstanding: 42000, availableCredit: 93000, overdueDays: 0, creditDays: 90, riskLevel: 'low', upgradeProgress: 24, lastPaymentDate: '2026-03-15', averagePaymentDays: 28, creditStatus: 'active' },
  { id: 'cp-002', customerName: 'TechVision Industries', country: 'Turkey', countryCode: 'TR', customerLevel: 'platinum', totalPurchaseLifetime: 4200000, averageMonthlyPurchase: 180000, creditLimit: 720000, outstanding: 310000, availableCredit: 410000, overdueDays: 0, creditDays: 120, riskLevel: 'low', upgradeProgress: 100, lastPaymentDate: '2026-03-20', averagePaymentDays: 35, creditStatus: 'active' },
  { id: 'cp-003', customerName: 'BuildRight Inc', country: 'Brazil', countryCode: 'BR', customerLevel: 'silver', totalPurchaseLifetime: 85000, averageMonthlyPurchase: 12000, creditLimit: 0, outstanding: 0, availableCredit: 0, overdueDays: 0, creditDays: 0, riskLevel: 'low', upgradeProgress: 17, lastPaymentDate: '2026-03-10', averagePaymentDays: 0, creditStatus: 'no_credit' },
  { id: 'cp-004', customerName: 'PowerGrid SA', country: 'South Africa', countryCode: 'ZA', customerLevel: 'gold', totalPurchaseLifetime: 580000, averageMonthlyPurchase: 35000, creditLimit: 105000, outstanding: 98000, availableCredit: 7000, overdueDays: 45, creditDays: 90, riskLevel: 'high', upgradeProgress: 19, lastPaymentDate: '2026-02-01', averagePaymentDays: 52, creditStatus: 'on_hold' },
  { id: 'cp-005', customerName: 'Gulf Industrial Group', country: 'UAE', countryCode: 'AE', customerLevel: 'diamond', totalPurchaseLifetime: 12500000, averageMonthlyPurchase: 450000, creditLimit: 2000000, outstanding: 680000, availableCredit: 1320000, overdueDays: 0, creditDays: 365, riskLevel: 'low', upgradeProgress: 100, lastPaymentDate: '2026-03-22', averagePaymentDays: 45, creditStatus: 'active' },
  { id: 'cp-006', customerName: 'Metro Electronics', country: 'Pakistan', countryCode: 'PK', customerLevel: 'end_user', totalPurchaseLifetime: 1200, averageMonthlyPurchase: 0, creditLimit: 0, outstanding: 0, availableCredit: 0, overdueDays: 0, creditDays: 0, riskLevel: 'low', upgradeProgress: 0, lastPaymentDate: '2026-01-15', averagePaymentDays: 0, creditStatus: 'no_credit' },
];

/* ===== Upgrade Requirements ===== */

export const UPGRADE_PATHS = [
  { from: 'End User', to: 'Silver', requirement: 'First commercial order ($15,000+)', basis: 'Order size', automatic: true },
  { from: 'Silver', to: 'Gold', requirement: 'Total purchase lifetime ≥ $500,000', basis: 'Total Purchase Lifetime', automatic: false },
  { from: 'Gold', to: 'Platinum', requirement: 'Total purchase lifetime ≥ $3,000,000', basis: 'Total Purchase Lifetime', automatic: false },
  { from: 'Platinum', to: 'Diamond', requirement: 'Contract + Sole Agent Agreement + Management Approval', basis: 'Strategic Decision', automatic: false },
];

/* ===== Helpers ===== */

export function getCustomerLevel(id: CustomerLevel): CustomerLevelConfig {
  return CUSTOMER_LEVELS.find(l => l.id === id)!;
}

export function formatUSD(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function suggestCreditLimit(avgMonthly: number, creditMonths: number): number {
  return avgMonthly * creditMonths;
}

export function calculateUpgradeProgress(current: CustomerLevel, totalPurchase: number): number {
  const config = getCustomerLevel(current);
  const nextLevel = CUSTOMER_LEVELS.find(l => l.level === config.level + 1);
  if (!nextLevel || !nextLevel.upgradeThreshold) return 100;
  return Math.min(100, Math.round((totalPurchase / nextLevel.upgradeThreshold) * 100));
}
