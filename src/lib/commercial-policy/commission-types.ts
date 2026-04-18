/* ===== KOLEEX Commission System Types ===== */

export type CommissionStatus =
  | 'pending'
  | 'calculated'
  | 'approved'
  | 'payable'
  | 'paid'
  | 'cancelled'
  | 'adjusted';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

export interface CommissionRecord {
  id: string;
  invoiceNumber: string;
  orderNumber: string;
  customer: string;
  customerCountry: string;
  salesPerson: string;
  salesPersonId: string;
  invoiceDate: string;
  invoiceAmount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentDate?: string;
  commissionRate: number;
  commissionAmount: number;
  status: CommissionStatus;
  approvedBy?: string;
  approvedDate?: string;
  paidDate?: string;
  adjustmentReason?: string;
  adjustmentAmount?: number;
  originalCommission?: number;
  notes?: string;
}

export interface SalesPerson {
  id: string;
  name: string;
  region: string;
  tier: 'junior' | 'senior' | 'lead';
  baseRate: number;
  totalSales: number;
  totalCommission: number;
  pendingCommission: number;
}

export interface CommissionRule {
  id: string;
  name: string;
  description: string;
  rate: number;
  minInvoice?: number;
  maxInvoice?: number;
  applicableTo: string;
}

export interface CommissionSummary {
  totalInvoiced: number;
  totalPaid: number;
  totalCommissionEarned: number;
  totalCommissionPending: number;
  totalCommissionApproved: number;
  totalCommissionPayable: number;
  totalCommissionPaid: number;
  averageRate: number;
  recordCount: number;
}
