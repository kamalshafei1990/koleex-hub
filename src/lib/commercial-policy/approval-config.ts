// ── Approval Authority System Configuration ─────────────────────────────

export const APPROVAL_ROLES = [
  { id: 'sales', title: 'Sales Person', icon: 'User', color: '#34C759', level: 1,
    responsibilities: ['Small standard discounts (0-3%)', 'Routine orders within policy', 'Customer onboarding', 'Quote generation'],
    canApprove: ['Standard discount up to 3%', 'Orders within credit limit', 'Routine customer requests'] },
  { id: 'sales_manager', title: 'Sales Manager', icon: 'UserCheck', color: '#007AFF', level: 2,
    responsibilities: ['Medium discounts (3-5%)', 'Team discount oversight', 'Competitive pricing review', 'Customer escalations'],
    canApprove: ['Discounts 3-5%', 'Competitive price match', 'Volume discount requests', 'Sales team exceptions'] },
  { id: 'commercial_manager', title: 'Commercial Manager', icon: 'Briefcase', color: '#FF9500', level: 3,
    responsibilities: ['Large discounts (5-10%)', 'Project pricing', 'Promotion campaigns', 'Market strategy pricing', 'Credit reviews'],
    canApprove: ['Discounts 5-10%', 'Project pricing', 'Promotion discounts', 'Credit limit adjustments', 'Clear stock pricing'] },
  { id: 'finance_manager', title: 'Finance Manager', icon: 'Calculator', color: '#AF52DE', level: 3,
    responsibilities: ['Credit limit evaluation', 'Over-credit order review', 'Payment term decisions', 'Risk assessment'],
    canApprove: ['Credit limit increases', 'Over-credit orders', 'Payment term extensions', 'Credit block removal'] },
  { id: 'general_manager', title: 'General Manager', icon: 'Shield', color: '#FF3B30', level: 4,
    responsibilities: ['High discounts (10-15%)', 'Special pricing', 'Strategic decisions', 'Market entry pricing', 'OEM pricing', 'New market agreements'],
    canApprove: ['Discounts 10-15%', 'Special project pricing', 'Market entry pricing', 'OEM deals', 'Large credit limits', 'New Diamond evaluation'] },
  { id: 'ceo', title: 'CEO', icon: 'Crown', color: '#1E1E20', level: 5,
    responsibilities: ['Exceptional discounts (15%+)', 'Diamond/Sole Agent contracts', 'Market exclusivity', 'Territory protection', 'Strategic partnerships'],
    canApprove: ['Discounts above 15%', 'Diamond appointment', 'Market exclusivity agreements', 'Territory protection contracts', 'Open credit activation', 'Below-minimum-margin exceptions'] },
];

export const DISCOUNT_APPROVAL_MATRIX = [
  { range: '0% – 3%', approver: 'Sales Person', level: 1, color: '#34C759', response: 'Immediate', conditions: 'Within standard policy' },
  { range: '3% – 5%', approver: 'Sales Manager', level: 2, color: '#007AFF', response: 'Same day', conditions: 'Justified by competition or volume' },
  { range: '5% – 10%', approver: 'Commercial Manager', level: 3, color: '#FF9500', response: '24 hours', conditions: 'Project, promotion, or market strategy' },
  { range: '10% – 15%', approver: 'General Manager', level: 4, color: '#FF3B30', response: '48 hours', conditions: 'Strategic deals, large projects' },
  { range: 'Above 15%', approver: 'CEO', level: 5, color: '#1E1E20', response: 'Case by case', conditions: 'Exceptional only with full justification' },
];

export const SPECIAL_PRICE_APPROVALS = [
  { type: 'Project Pricing', description: 'Large project or tender requiring special rates', approver: 'Commercial Manager / GM', evidence: 'Project details, competitor quotes, volume commitment', icon: 'Building2' },
  { type: 'Competitive Pricing', description: 'Price match to win against competitor', approver: 'Sales Manager+', evidence: 'Competitor price evidence, market analysis', icon: 'Swords' },
  { type: 'Market Entry', description: 'New market penetration pricing strategy', approver: 'General Manager', evidence: 'Market analysis, 6-month plan, volume projection', icon: 'Globe' },
  { type: 'Strategic Pricing', description: 'Key account or partnership support', approver: 'General Manager', evidence: 'Strategic justification, relationship value', icon: 'Star' },
  { type: 'Diamond Support', description: 'Sole agent market development pricing', approver: 'Contract-based / GM', evidence: 'Contract terms, market development plan', icon: 'Diamond' },
  { type: 'OEM Pricing', description: 'Manufacturer bulk pricing agreement', approver: 'General Manager', evidence: 'Volume commitment, exclusivity terms', icon: 'Cpu' },
  { type: 'Clear Stock', description: 'Inventory clearance for old models', approver: 'Commercial Manager', evidence: 'Stock age, storage cost analysis', icon: 'Package' },
  { type: 'Promotion', description: 'Campaign or seasonal promotional pricing', approver: 'Commercial Manager', evidence: 'Campaign plan, time limit, expected ROI', icon: 'Sparkles' },
];

export const CREDIT_APPROVALS = [
  { type: 'New Credit Activation', description: 'First-time credit for qualifying customer (Gold+)', approver: 'Finance Manager + Commercial Manager', conditions: 'Customer reached Gold level, payment history reviewed', icon: 'CreditCard' },
  { type: 'Credit Limit Increase', description: 'Increase existing credit limit based on growth', approver: 'Finance Manager', conditions: 'Consistent payment, increased monthly purchases', icon: 'TrendingUp' },
  { type: 'Over-Credit Order', description: 'Order exceeding available credit limit', approver: 'Finance Manager + GM', conditions: 'No overdue, strategic justification', icon: 'AlertTriangle' },
  { type: 'Open Credit (Diamond)', description: 'Activate open credit for Diamond sole agent', approver: 'CEO', conditions: 'Signed contract, annual settlement terms agreed', icon: 'Diamond' },
  { type: 'Credit Block Removal', description: 'Remove credit hold after overdue resolution', approver: 'Finance Manager', conditions: 'All overdue settled, payment plan agreed', icon: 'Unlock' },
  { type: 'Emergency Credit', description: 'Urgent credit for critical business need', approver: 'General Manager', conditions: 'Business justification, time-limited', icon: 'Zap' },
];

export const DIAMOND_APPROVALS = [
  { step: 1, title: 'Application Review', description: 'Initial evaluation of sole agent application', approver: 'Commercial Manager', icon: 'FileSearch' },
  { step: 2, title: 'Market Analysis', description: 'Evaluate market size, potential, and competition', approver: 'Commercial Manager', icon: 'BarChart3' },
  { step: 3, title: 'Financial Assessment', description: 'Review financial capability and stability', approver: 'Finance Manager', icon: 'Calculator' },
  { step: 4, title: 'Commercial Terms', description: 'Draft contract terms, pricing, and territory', approver: 'General Manager', icon: 'FileText' },
  { step: 5, title: 'Exclusivity Decision', description: 'Approve market exclusivity and territory protection', approver: 'CEO', icon: 'Shield' },
  { step: 6, title: 'Contract Signing', description: 'Final contract execution and partner onboarding', approver: 'CEO', icon: 'PenTool' },
  { step: 7, title: 'Credit Activation', description: 'Activate open credit per contract terms', approver: 'Finance Manager + CEO', icon: 'CreditCard' },
];

export const APPROVAL_PURPOSES = [
  { purpose: 'Protect Margin', description: 'Ensure every deal maintains minimum profitability', icon: 'Shield' },
  { purpose: 'Control Risk', description: 'Manage credit and financial exposure', icon: 'AlertTriangle' },
  { purpose: 'Pricing Discipline', description: 'Maintain consistent pricing across markets', icon: 'DollarSign' },
  { purpose: 'Strategic Alignment', description: 'Ensure deals align with company strategy', icon: 'Target' },
  { purpose: 'Market Stability', description: 'Prevent price erosion and channel conflict', icon: 'Globe' },
];
