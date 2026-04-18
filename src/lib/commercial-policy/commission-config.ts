import type { CommissionRecord, SalesPerson, CommissionRule, CommissionSummary, CommissionStatus } from './commission-types';

/* ===== Commission Rules (Confirmed) ===== */

export const COMMISSION_RULES: CommissionRule[] = [
  { id: 'standard', name: 'Standard Commission', description: 'Default commission rate for all paid invoices', rate: 0.03, applicableTo: 'All Sales' },
  { id: 'senior', name: 'Senior Sales Rate', description: 'Enhanced rate for senior sales personnel', rate: 0.04, applicableTo: 'Senior Sales' },
  { id: 'lead', name: 'Sales Lead Rate', description: 'Lead rate with team override component', rate: 0.05, applicableTo: 'Sales Leads' },
];

export const COMMISSION_FLOW_STEPS = [
  { step: 1, name: 'Quotation', icon: 'FileText', desc: 'Sales creates quotation for customer' },
  { step: 2, name: 'Order', icon: 'ShoppingCart', desc: 'Customer confirms and places order' },
  { step: 3, name: 'Invoice', icon: 'Receipt', desc: 'Invoice generated for the order' },
  { step: 4, name: 'Payment', icon: 'CreditCard', desc: 'Customer pays the invoice', trigger: true },
  { step: 5, name: 'Commission Calculated', icon: 'Calculator', desc: 'System auto-calculates commission' },
  { step: 6, name: 'Commission Approved', icon: 'CheckCircle', desc: 'Manager approves commission' },
  { step: 7, name: 'Commission Payable', icon: 'Wallet', desc: 'Finance marks as payable' },
  { step: 8, name: 'Commission Paid', icon: 'Banknote', desc: 'Commission disbursed to sales person' },
];

export const STATUS_CONFIG: Record<CommissionStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#FF9500', bg: 'bg-[#FF9500]/10' },
  calculated: { label: 'Calculated', color: '#007AFF', bg: 'bg-[#007AFF]/10' },
  approved: { label: 'Approved', color: '#34C759', bg: 'bg-[#34C759]/10' },
  payable: { label: 'Payable', color: '#5856D6', bg: 'bg-[#5856D6]/10' },
  paid: { label: 'Paid', color: '#1E1E20', bg: 'bg-[#1E1E20]/10' },
  cancelled: { label: 'Cancelled', color: '#FF3B30', bg: 'bg-[#FF3B30]/10' },
  adjusted: { label: 'Adjusted', color: '#FF9500', bg: 'bg-[#FF9500]/10' },
};

export const KEY_POLICIES = [
  'Commission is calculated on Invoice Amount',
  'Commission triggers only after Invoice is Paid',
  'Commission is paid after payment collection',
  'Discounts do NOT reduce commission',
  'There is NO commission cap',
  'Sales users must NOT see KOLEEX Cost',
  'Commission is calculated automatically by the system',
  'Returns or credit notes require commission adjustment',
  'Commission is linked to the responsible Sales Person',
];

/* ===== Mock Sales People ===== */

export const SALES_PEOPLE: SalesPerson[] = [
  { id: 'sp-001', name: 'Ahmed Hassan', region: 'Middle East', tier: 'lead', baseRate: 0.05, totalSales: 1245000, totalCommission: 62250, pendingCommission: 8400 },
  { id: 'sp-002', name: 'Sarah Chen', region: 'Asia Pacific', tier: 'senior', baseRate: 0.04, totalSales: 980000, totalCommission: 39200, pendingCommission: 5600 },
  { id: 'sp-003', name: 'Marco Silva', region: 'Latin America', tier: 'senior', baseRate: 0.04, totalSales: 756000, totalCommission: 30240, pendingCommission: 4200 },
  { id: 'sp-004', name: 'Fatima Al-Rashid', region: 'Africa', tier: 'junior', baseRate: 0.03, totalSales: 425000, totalCommission: 12750, pendingCommission: 2100 },
  { id: 'sp-005', name: 'David Kim', region: 'Europe', tier: 'lead', baseRate: 0.05, totalSales: 1890000, totalCommission: 94500, pendingCommission: 12300 },
];

/* ===== Mock Commission Records ===== */

export const COMMISSION_RECORDS: CommissionRecord[] = [
  { id: 'cm-001', invoiceNumber: 'INV-2026-0142', orderNumber: 'ORD-2026-0089', customer: 'Acme Industrial Corp', customerCountry: 'TR', salesPerson: 'Ahmed Hassan', salesPersonId: 'sp-001', invoiceDate: '2026-02-15', invoiceAmount: 85000, currency: 'USD', paymentStatus: 'paid', paymentDate: '2026-03-01', commissionRate: 0.05, commissionAmount: 4250, status: 'paid', approvedBy: 'David Kim', approvedDate: '2026-03-05', paidDate: '2026-03-15' },
  { id: 'cm-002', invoiceNumber: 'INV-2026-0156', orderNumber: 'ORD-2026-0095', customer: 'TechVision Ltd', customerCountry: 'EG', salesPerson: 'Ahmed Hassan', salesPersonId: 'sp-001', invoiceDate: '2026-02-22', invoiceAmount: 42000, currency: 'USD', paymentStatus: 'paid', paymentDate: '2026-03-10', commissionRate: 0.05, commissionAmount: 2100, status: 'approved', approvedBy: 'David Kim', approvedDate: '2026-03-15' },
  { id: 'cm-003', invoiceNumber: 'INV-2026-0163', orderNumber: 'ORD-2026-0101', customer: 'BuildRight Inc', customerCountry: 'BR', salesPerson: 'Marco Silva', salesPersonId: 'sp-003', invoiceDate: '2026-03-01', invoiceAmount: 128000, currency: 'USD', paymentStatus: 'paid', paymentDate: '2026-03-18', commissionRate: 0.04, commissionAmount: 5120, status: 'payable', approvedBy: 'David Kim', approvedDate: '2026-03-20' },
  { id: 'cm-004', invoiceNumber: 'INV-2026-0171', orderNumber: 'ORD-2026-0108', customer: 'MetalWorks Co', customerCountry: 'DE', salesPerson: 'David Kim', salesPersonId: 'sp-005', invoiceDate: '2026-03-05', invoiceAmount: 215000, currency: 'USD', paymentStatus: 'paid', paymentDate: '2026-03-22', commissionRate: 0.05, commissionAmount: 10750, status: 'calculated' },
  { id: 'cm-005', invoiceNumber: 'INV-2026-0178', orderNumber: 'ORD-2026-0112', customer: 'PowerGrid SA', customerCountry: 'ZA', salesPerson: 'Fatima Al-Rashid', salesPersonId: 'sp-004', invoiceDate: '2026-03-08', invoiceAmount: 67000, currency: 'USD', paymentStatus: 'paid', paymentDate: '2026-03-24', commissionRate: 0.03, commissionAmount: 2010, status: 'pending' },
  { id: 'cm-006', invoiceNumber: 'INV-2026-0185', orderNumber: 'ORD-2026-0118', customer: 'Shanghai Electric', customerCountry: 'CN', salesPerson: 'Sarah Chen', salesPersonId: 'sp-002', invoiceDate: '2026-03-12', invoiceAmount: 340000, currency: 'USD', paymentStatus: 'partial', commissionRate: 0.04, commissionAmount: 0, status: 'pending', notes: 'Awaiting full payment' },
  { id: 'cm-007', invoiceNumber: 'INV-2026-0192', orderNumber: 'ORD-2026-0124', customer: 'Nile Industries', customerCountry: 'EG', salesPerson: 'Ahmed Hassan', salesPersonId: 'sp-001', invoiceDate: '2026-03-15', invoiceAmount: 56000, currency: 'USD', paymentStatus: 'unpaid', commissionRate: 0.05, commissionAmount: 0, status: 'pending', notes: 'Invoice sent, awaiting payment' },
  { id: 'cm-008', invoiceNumber: 'INV-2026-0098', orderNumber: 'ORD-2026-0062', customer: 'OceanTech Marine', customerCountry: 'KR', salesPerson: 'Sarah Chen', salesPersonId: 'sp-002', invoiceDate: '2026-01-20', invoiceAmount: 95000, currency: 'USD', paymentStatus: 'paid', paymentDate: '2026-02-15', commissionRate: 0.04, commissionAmount: 3800, status: 'paid', approvedBy: 'David Kim', approvedDate: '2026-02-20', paidDate: '2026-03-01' },
  { id: 'cm-009', invoiceNumber: 'INV-2026-0105', orderNumber: 'ORD-2026-0068', customer: 'AutoMex SA', customerCountry: 'MX', salesPerson: 'Marco Silva', salesPersonId: 'sp-003', invoiceDate: '2026-01-28', invoiceAmount: 178000, currency: 'USD', paymentStatus: 'paid', paymentDate: '2026-02-28', commissionRate: 0.04, commissionAmount: 7120, status: 'paid', approvedBy: 'David Kim', approvedDate: '2026-03-05', paidDate: '2026-03-10' },
  { id: 'cm-010', invoiceNumber: 'INV-2026-0134', orderNumber: 'ORD-2026-0082', customer: 'EuroParts GmbH', customerCountry: 'AT', salesPerson: 'David Kim', salesPersonId: 'sp-005', invoiceDate: '2026-02-10', invoiceAmount: 52000, currency: 'USD', paymentStatus: 'paid', paymentDate: '2026-02-25', commissionRate: 0.05, commissionAmount: 2600, status: 'adjusted', approvedBy: 'David Kim', adjustmentReason: 'Partial return — credit note CN-2026-0012', adjustmentAmount: -520, originalCommission: 2600 },
];

/* ===== Helpers ===== */

export function calculateSummary(records: CommissionRecord[]): CommissionSummary {
  const paid = records.filter(r => r.paymentStatus === 'paid');
  return {
    totalInvoiced: records.reduce((s, r) => s + r.invoiceAmount, 0),
    totalPaid: paid.reduce((s, r) => s + r.invoiceAmount, 0),
    totalCommissionEarned: records.reduce((s, r) => s + r.commissionAmount, 0),
    totalCommissionPending: records.filter(r => r.status === 'pending' || r.status === 'calculated').reduce((s, r) => s + r.commissionAmount, 0),
    totalCommissionApproved: records.filter(r => r.status === 'approved').reduce((s, r) => s + r.commissionAmount, 0),
    totalCommissionPayable: records.filter(r => r.status === 'payable').reduce((s, r) => s + r.commissionAmount, 0),
    totalCommissionPaid: records.filter(r => r.status === 'paid').reduce((s, r) => s + r.commissionAmount, 0),
    averageRate: records.length > 0 ? records.reduce((s, r) => s + r.commissionRate, 0) / records.length : 0,
    recordCount: records.length,
  };
}

export function formatUSD(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
