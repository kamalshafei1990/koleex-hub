export interface DiscountType {
  id: string;
  name: string;
  description: string;
  icon: string;
  applicableTo: string[];
  approvalRequired: boolean;
  maxDiscount?: number;
}

export interface DiscountLimit {
  level: string;
  levelColor: string;
  authority: string;
  typicalRange: string;
  maxWithoutApproval: number;
  maxWithApproval: number;
  notes: string;
}

export interface ApprovalLevel {
  range: string;
  minPercent: number;
  maxPercent: number;
  approver: string;
  role: string;
  icon: string;
  color: string;
  responseTime: string;
}

export interface DiscountScenario {
  id: string;
  title: string;
  customerLevel: string;
  levelColor: string;
  type: string;
  basePrice: number;
  discount: number;
  quantity: number;
  cost: number;
  minMargin: number;
  description: string;
  outcome: 'approved' | 'escalated' | 'rejected';
  notes: string;
}

export interface DiscountFlowStep {
  id: number;
  title: string;
  description: string;
  icon: string;
  isDecision?: boolean;
}
