import type { MetricCardData, CaseStudy, GlossaryItem } from './types';

export const adminMetrics: MetricCardData[] = [
  { label: 'Active Policies', value: '24', change: '+3', trend: 'up', status: 'placeholder' },
  { label: 'Partner Accounts', value: '156', change: '+12', trend: 'up', status: 'placeholder' },
  { label: 'Active Agents', value: '38', change: '+5', trend: 'up', status: 'placeholder' },
  { label: 'Pending Reviews', value: '7', trend: 'neutral', status: 'placeholder' },
];

export const salesMetrics: MetricCardData[] = [
  { label: 'Pricing Guides', value: '12', status: 'placeholder' },
  { label: 'Active Discounts', value: '8', status: 'placeholder' },
  { label: 'Commission Tiers', value: '4', status: 'placeholder' },
  { label: 'Quick Tools', value: '6', status: 'placeholder' },
];

export const productLevels = [
  { level: 'Level A', description: 'Premium flagship products', marginRange: '35-45%', badge: 'Draft' },
  { level: 'Level B', description: 'Standard product line', marginRange: '25-35%', badge: 'Draft' },
  { level: 'Level C', description: 'Entry-level products', marginRange: '18-25%', badge: 'Draft' },
  { level: 'Level D', description: 'Accessories and parts', marginRange: '15-20%', badge: 'Draft' },
];

export const marketBands = [
  { band: 'Band 1', regions: 'North America, Western Europe, Japan, Australia', factor: '1.00', status: 'Placeholder' },
  { band: 'Band 2', regions: 'Eastern Europe, South Korea, Gulf States', factor: '0.92', status: 'Placeholder' },
  { band: 'Band 3', regions: 'Southeast Asia, Central Asia, North Africa', factor: '0.85', status: 'Placeholder' },
  { band: 'Band 4', regions: 'Sub-Saharan Africa, South Asia', factor: '0.78', status: 'Placeholder' },
];

export const customerTypes = [
  { type: 'Direct End User', channel: 'Direct', discountAccess: 'Standard', creditEligibility: 'Case by case' },
  { type: 'Dealer', channel: 'Dealer Channel', discountAccess: 'Dealer Price List', creditEligibility: 'Tiered' },
  { type: 'Distributor', channel: 'Distribution', discountAccess: 'Distributor Price List', creditEligibility: 'Extended' },
  { type: 'Agent Customer', channel: 'Agent-Referred', discountAccess: 'Agent Conditions', creditEligibility: 'Via Agent' },
  { type: 'Project / Tender', channel: 'Special', discountAccess: 'Project Pricing', creditEligibility: 'Project-specific' },
];

export const sampleCaseStudies: CaseStudy[] = [
  {
    id: 'cs-001',
    title: 'Unauthorized Discount Escalation',
    category: 'Pricing',
    scenario: 'A sales representative offered a 25% discount to a new customer without following the approval workflow.',
    outcome: 'The discount was flagged during review and the order was delayed by 2 weeks.',
    correctAction: 'Discounts above the standard threshold must go through the multi-level approval process before being communicated to the customer.',
    tags: ['pricing', 'discount', 'approval'],
  },
  {
    id: 'cs-002',
    title: 'Credit Limit Breach',
    category: 'Credit',
    scenario: 'A dealer placed a large order that exceeded their credit limit without prior arrangement.',
    outcome: 'Order was held, causing delivery delays and partner dissatisfaction.',
    correctAction: 'Sales should verify credit standing before accepting orders above standard levels. Credit limit increases require documented approval.',
    tags: ['credit', 'risk', 'dealer'],
  },
  {
    id: 'cs-003',
    title: 'Territory Conflict Resolution',
    category: 'Agent',
    scenario: 'Two agents claimed the same customer in an overlapping market area.',
    outcome: 'After review, the first-registered agent was confirmed. Clear territory documentation prevented future disputes.',
    correctAction: 'All territory assignments must be documented and verified in the system. Conflicts should be escalated to the regional manager.',
    tags: ['agent', 'territory', 'conflict'],
  },
  {
    id: 'cs-004',
    title: 'Partner Tier Upgrade Success',
    category: 'Partner',
    scenario: 'A dealer consistently exceeded performance targets over 4 consecutive quarters.',
    outcome: 'The dealer was upgraded to a higher partner tier with improved commercial conditions.',
    correctAction: 'Performance reviews should be conducted quarterly. Tier upgrades follow the documented criteria in the Partner System.',
    tags: ['partner', 'performance', 'upgrade'],
  },
];

export const glossaryItems: GlossaryItem[] = [
  { term: 'FOB Price', definition: 'Free On Board price — the price at the point of shipment, excluding international freight and insurance.', category: 'Pricing' },
  { term: 'CIF Price', definition: 'Cost, Insurance, and Freight — includes the cost of goods plus insurance and freight to the destination port.', category: 'Pricing' },
  { term: 'Market Band', definition: 'A geographic grouping of countries/regions that share similar market conditions and pricing factors.', category: 'Pricing' },
  { term: 'Product Level', definition: 'A classification of products based on their strategic importance, margin expectations, and market positioning.', category: 'Pricing' },
  { term: 'Channel Margin', definition: 'The markup or margin applied based on the sales channel (direct, dealer, distributor, agent).', category: 'Pricing' },
  { term: 'Credit Limit', definition: 'The maximum outstanding balance a customer or partner is authorized to carry at any time.', category: 'Credit' },
  { term: 'Net Terms', definition: 'The number of days after invoice date by which payment must be received (e.g., Net 30, Net 60).', category: 'Credit' },
  { term: 'Commission Tier', definition: 'A performance-based level that determines the commission percentage earned by sales staff.', category: 'Commission' },
  { term: 'Protection Period', definition: 'A defined timeframe during which a salesperson\'s commission on a customer account is protected from reassignment.', category: 'Commission' },
  { term: 'Agent Deposit', definition: 'A security deposit or advance payment required from agents as part of the annual credit program.', category: 'Agent' },
  { term: 'Territory Assignment', definition: 'The exclusive or semi-exclusive geographic area assigned to an agent or partner for business development.', category: 'Agent' },
  { term: 'Approval Workflow', definition: 'The documented multi-step process for reviewing and approving pricing exceptions, discounts, or credit changes.', category: 'General' },
];

export const calculatorCountries = [
  { value: 'us', label: 'United States', band: 'Band 1' },
  { value: 'de', label: 'Germany', band: 'Band 1' },
  { value: 'jp', label: 'Japan', band: 'Band 1' },
  { value: 'pl', label: 'Poland', band: 'Band 2' },
  { value: 'kr', label: 'South Korea', band: 'Band 2' },
  { value: 'ae', label: 'UAE', band: 'Band 2' },
  { value: 'th', label: 'Thailand', band: 'Band 3' },
  { value: 'eg', label: 'Egypt', band: 'Band 3' },
  { value: 'ng', label: 'Nigeria', band: 'Band 4' },
  { value: 'in', label: 'India', band: 'Band 4' },
];

export const partnerComparison = [
  {
    feature: 'Minimum Order Value',
    dealer: '$5,000 / order',
    distributor: '$25,000 / order',
    agent: 'Varies by territory',
  },
  {
    feature: 'Price List Access',
    dealer: 'Dealer Price List',
    distributor: 'Distributor Price List',
    agent: 'Agent Conditions',
  },
  {
    feature: 'Credit Terms',
    dealer: 'Up to Net 30',
    distributor: 'Up to Net 60',
    agent: 'Per agreement',
  },
  {
    feature: 'Territory Exclusivity',
    dealer: 'Non-exclusive',
    distributor: 'Semi-exclusive',
    agent: 'Exclusive possible',
  },
  {
    feature: 'Marketing Support',
    dealer: 'Basic',
    distributor: 'Enhanced',
    agent: 'Full support',
  },
  {
    feature: 'Performance Review',
    dealer: 'Annual',
    distributor: 'Semi-annual',
    agent: 'Quarterly',
  },
  {
    feature: 'Training Access',
    dealer: 'Online only',
    distributor: 'Online + On-site',
    agent: 'Full program',
  },
];
