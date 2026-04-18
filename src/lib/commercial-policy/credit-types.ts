/* ===== KOLEEX Credit System Types ===== */

export type CustomerLevel = 'end_user' | 'silver' | 'gold' | 'platinum' | 'diamond';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type CreditStatus = 'active' | 'on_hold' | 'blocked' | 'no_credit' | 'under_review';

export type OverdueAction = 'reminder' | 'no_new_orders' | 'credit_hold' | 'account_blocked' | 'legal';

export interface CustomerLevelConfig {
  level: number;
  id: CustomerLevel;
  name: string;
  description: string;
  color: string;
  hasCredit: boolean;
  creditLimit: string;
  creditDays: number | string;
  upgradeRequirement: string;
  upgradeThreshold: number | null;
  priceAccess: string;
  discountAccess: string;
  supportLevel: string;
  marketRights: string;
}

export interface CreditProfile {
  id: string;
  customerName: string;
  country: string;
  countryCode: string;
  customerLevel: CustomerLevel;
  totalPurchaseLifetime: number;
  averageMonthlyPurchase: number;
  creditLimit: number;
  outstanding: number;
  availableCredit: number;
  overdueDays: number;
  creditDays: number;
  riskLevel: RiskLevel;
  upgradeProgress: number;
  lastPaymentDate: string;
  averagePaymentDays: number;
  creditStatus: CreditStatus;
}

export interface OverdueRule {
  range: string;
  days: string;
  action: OverdueAction;
  actionLabel: string;
  description: string;
  color: string;
}

export interface CreditFlowStep {
  step: number;
  name: string;
  description: string;
  icon: string;
}
