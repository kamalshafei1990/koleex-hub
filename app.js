/* ============================================================
   KOLEEX Enterprise Platform — Application Logic
   ============================================================ */

// ── Icon Library (SVG — 2px uniform stroke, geometric, grid-aligned per KOLEEX brand) ──
const Icons = {
  dashboard: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`,
  sales: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
  priceCalculator: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><rect x="8" y="10" width="3" height="3" rx="0.5"/><rect x="13" y="10" width="3" height="3" rx="0.5"/><rect x="8" y="15" width="3" height="3" rx="0.5"/><rect x="13" y="15" width="3" height="3" rx="0.5"/></svg>`,
  quotations: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>`,
  invoices: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6a2 2 0 0 0-2 2z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>`,
  landedCost: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><circle cx="12" cy="14" r="3"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`,
  products: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  documents: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
  contacts: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  customers: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 11l2 2 4-4"/></svg>`,
  suppliers: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="15" height="12" rx="2"/><path d="M16 10h4l3 3v5h-3"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/><line x1="8" y1="18" x2="16" y2="18"/></svg>`,
  markets: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  crm: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  calendar: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="7" y="14" width="3" height="3" rx="0.5"/></svg>`,
  todo: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  employees: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><rect x="16" y="4" width="6" height="8" rx="1"/><line x1="19" y1="7" x2="19" y2="7.01"/></svg>`,
  recruitment: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><circle cx="11" cy="8" r="2"/><path d="M7 16v-1a4 4 0 0 1 8 0v1"/></svg>`,
  appraisals: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  appointments: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  attendance: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M8 16h.01"/><path d="M12 16h.01"/><line x1="2" y1="7" x2="22" y2="7"/></svg>`,
  knowledge: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  discuss: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="13" y2="13"/></svg>`,
  finance: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  purchase: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  expenses: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15h2"/><path d="M13 15h2"/></svg>`,
  inventory: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><line x1="3.27" y1="6.96" x2="12" y2="12.01"/><line x1="20.73" y1="6.96" x2="12" y2="12.01"/><line x1="12" y1="22.08" x2="12" y2="12"/><path d="M7.5 4.5L16.5 9.5"/></svg>`,
  marketingApp: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  marketingCards: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  events: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="12" y1="2" x2="12" y2="4"/></svg>`,
  planning: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/><circle cx="18" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></svg>`,
  projects: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`,
  database: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>`,
  ai: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>`,
  settings: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
};

// ── App Data Configuration ──
const apps = [
  // Operations
  { id: 'dashboard',       name: 'Dashboard',        icon: Icons.dashboard,       category: 'operations',    route: '/dashboard' },
  { id: 'products',        name: 'Products',          icon: Icons.products,        category: 'operations',    route: '/products' },
  { id: 'inventory',       name: 'Inventory',         icon: Icons.inventory,       category: 'operations',    route: '/inventory' },
  { id: 'purchase',        name: 'Purchase',          icon: Icons.purchase,        category: 'operations',    route: '/purchase' },
  { id: 'landed-cost',     name: 'Landed Cost',       icon: Icons.landedCost,      category: 'operations',    route: '/landed-cost' },
  { id: 'documents',       name: 'Documents',         icon: Icons.documents,       category: 'operations',    route: '/documents' },

  // Commercial
  { id: 'sales',           name: 'Sales',             icon: Icons.sales,           category: 'commercial',    route: '/sales' },
  { id: 'crm',             name: 'CRM',               icon: Icons.crm,             category: 'commercial',    route: '/crm' },
  { id: 'quotations',      name: 'Quotations',        icon: Icons.quotations,      category: 'commercial',    route: '/quotations' },
  { id: 'invoices',        name: 'Invoices',          icon: Icons.invoices,        category: 'commercial',    route: '/invoices' },
  { id: 'price-calculator',name: 'Price Calculator',  icon: Icons.priceCalculator, category: 'commercial',    route: '/price-calculator' },
  { id: 'customers',       name: 'Customers',         icon: Icons.customers,       category: 'commercial',    route: '/customers' },
  { id: 'suppliers',       name: 'Suppliers',         icon: Icons.suppliers,        category: 'commercial',    route: '/suppliers' },
  { id: 'contacts',        name: 'Contacts',          icon: Icons.contacts,        category: 'commercial',    route: '/contacts' },
  { id: 'markets',         name: 'Markets',           icon: Icons.markets,         category: 'commercial',    route: '/markets' },

  // Finance
  { id: 'finance',         name: 'Finance',           icon: Icons.finance,         category: 'finance',       route: '/finance' },
  { id: 'expenses',        name: 'Expenses',          icon: Icons.expenses,        category: 'finance',       route: '/expenses' },

  // People
  { id: 'employees',       name: 'Employees',         icon: Icons.employees,       category: 'people',        route: '/employees' },
  { id: 'recruitment',     name: 'Recruitment',       icon: Icons.recruitment,     category: 'people',        route: '/recruitment' },
  { id: 'appraisals',      name: 'Appraisals',        icon: Icons.appraisals,      category: 'people',        route: '/appraisals' },
  { id: 'appointments',    name: 'Appointments',      icon: Icons.appointments,    category: 'people',        route: '/appointments' },
  { id: 'attendance',      name: 'Attendance',        icon: Icons.attendance,      category: 'people',        route: '/attendance' },

  // Communication
  { id: 'discuss',         name: 'Discuss',           icon: Icons.discuss,         category: 'communication', route: '/discuss' },
  { id: 'calendar',        name: 'Calendar',          icon: Icons.calendar,        category: 'communication', route: '/calendar' },
  { id: 'todo',            name: 'To-do',             icon: Icons.todo,            category: 'communication', route: '/todo' },

  // Marketing
  { id: 'marketing',       name: 'Marketing',         icon: Icons.marketingApp,    category: 'marketing',     route: '/marketing' },
  { id: 'marketing-cards', name: 'Marketing Cards',   icon: Icons.marketingCards,  category: 'marketing',     route: '/marketing-cards' },
  { id: 'events',          name: 'Events',            icon: Icons.events,          category: 'marketing',     route: '/events' },

  // Planning
  { id: 'planning',        name: 'Planning',          icon: Icons.planning,        category: 'planning',      route: '/planning' },
  { id: 'projects',        name: 'Projects',          icon: Icons.projects,        category: 'planning',      route: '/projects' },

  // Knowledge & System
  { id: 'knowledge',       name: 'Knowledge',         icon: Icons.knowledge,       category: 'knowledge',     route: '/knowledge' },
  { id: 'database',        name: 'Database',          icon: Icons.database,        category: 'system',        route: '/database' },
  { id: 'ai',              name: 'AI',                icon: Icons.ai,              category: 'system',        route: '/ai' },
  { id: 'settings',        name: 'Settings',          icon: Icons.settings,        category: 'system',        route: '/settings' },
];

// ── Category Labels ──
const categoryLabels = {
  operations:    'Operations',
  commercial:    'Commercial',
  finance:       'Finance',
  people:        'People',
  communication: 'Communication',
  marketing:     'Marketing & Growth',
  planning:      'Planning',
  knowledge:     'Knowledge',
  system:        'System',
};

// ── i18n ──
const translations = {
  en: {
    title: 'Applications',
    subtitle: 'Access your enterprise modules and tools',
    searchPlaceholder: 'Search apps, modules, settings...',
    categories: {
      operations: 'Operations',
      commercial: 'Commercial',
      finance: 'Finance',
      people: 'People',
      communication: 'Communication',
      marketing: 'Marketing & Growth',
      planning: 'Planning',
      knowledge: 'Knowledge',
      system: 'System',
    },
    apps: {},
  },
  zh: {
    title: '应用程序',
    subtitle: '访问您的企业模块和工具',
    searchPlaceholder: '搜索应用、模块、设置...',
    categories: {
      operations: '运营',
      commercial: '商务',
      finance: '财务',
      people: '人事',
      communication: '沟通',
      marketing: '营销与增长',
      planning: '规划',
      knowledge: '知识库',
      system: '系统',
    },
    apps: {
      'dashboard': '仪表盘', 'sales': '销售', 'price-calculator': '价格计算器',
      'quotations': '报价单', 'invoices': '发票', 'landed-cost': '到岸成本',
      'products': '产品', 'documents': '文件', 'contacts': '联系人',
      'customers': '客户', 'suppliers': '供应商', 'markets': '市场',
      'crm': '客户关系管理', 'calendar': '日历', 'todo': '待办事项',
      'employees': '员工', 'recruitment': '招聘', 'appraisals': '考核',
      'appointments': '预约', 'attendance': '考勤', 'knowledge': '知识库',
      'discuss': '讨论', 'finance': '财务', 'purchase': '采购',
      'expenses': '费用', 'inventory': '库存', 'marketing': '营销',
      'marketing-cards': '营销卡片', 'events': '活动', 'planning': '规划',
      'projects': '项目', 'database': '数据库', 'ai': 'AI', 'settings': '设置',
    },
  },
  ar: {
    title: 'التطبيقات',
    subtitle: 'الوصول إلى وحدات ومنصات المؤسسة',
    searchPlaceholder: 'البحث في التطبيقات والوحدات...',
    categories: {
      operations: 'العمليات',
      commercial: 'التجاري',
      finance: 'المالية',
      people: 'الموارد البشرية',
      communication: 'التواصل',
      marketing: 'التسويق والنمو',
      planning: 'التخطيط',
      knowledge: 'المعرفة',
      system: 'النظام',
    },
    apps: {
      'dashboard': 'لوحة التحكم', 'sales': 'المبيعات', 'price-calculator': 'حاسبة الأسعار',
      'quotations': 'عروض الأسعار', 'invoices': 'الفواتير', 'landed-cost': 'تكلفة الوصول',
      'products': 'المنتجات', 'documents': 'المستندات', 'contacts': 'جهات الاتصال',
      'customers': 'العملاء', 'suppliers': 'الموردين', 'markets': 'الأسواق',
      'crm': 'إدارة العلاقات', 'calendar': 'التقويم', 'todo': 'المهام',
      'employees': 'الموظفين', 'recruitment': 'التوظيف', 'appraisals': 'التقييمات',
      'appointments': 'المواعيد', 'attendance': 'الحضور', 'knowledge': 'المعرفة',
      'discuss': 'المناقشات', 'finance': 'المالية', 'purchase': 'المشتريات',
      'expenses': 'المصروفات', 'inventory': 'المخزون', 'marketing': 'التسويق',
      'marketing-cards': 'بطاقات التسويق', 'events': 'الفعاليات', 'planning': 'التخطيط',
      'projects': 'المشاريع', 'database': 'قاعدة البيانات', 'ai': 'الذكاء الاصطناعي', 'settings': 'الإعدادات',
    },
  },
};

// ── State ──
let currentLang = localStorage.getItem('koleex-lang') || 'en';
let currentTheme = localStorage.getItem('koleex-theme') || 'light';
let currentCategory = 'all';
let sidebarOpen = false;

// ── DOM Elements ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
  applyLanguage(currentLang);
  renderAppGrid();
  initSearch();
  initSidebar();
  initThemeToggle();
  initLanguagePill();
  updateDate();
  updateAppCount();
  initKeyboardShortcuts();
});

// ── Theme ──
function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('koleex-theme', theme);
}

function initThemeToggle() {
  const toggle = $('#themeToggle');
  toggle.addEventListener('click', () => {
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
  });
}

// ── Language ──
function applyLanguage(lang) {
  currentLang = lang;
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  localStorage.setItem('koleex-lang', lang);

  const t = translations[lang] || translations.en;

  // Update UI text
  const titleEl = $('[data-i18n="title"]');
  const subtitleEl = $('[data-i18n="subtitle"]');
  if (titleEl) titleEl.textContent = t.title;
  if (subtitleEl) subtitleEl.textContent = t.subtitle;

  const searchInput = $('#searchInput');
  if (searchInput) searchInput.placeholder = t.searchPlaceholder;
  const mobileSearchInput = $('#mobileSearchInput');
  if (mobileSearchInput) mobileSearchInput.placeholder = t.searchPlaceholder;

  // Update app labels
  $$('.app-card').forEach(card => {
    const appId = card.dataset.app;
    const label = card.querySelector('.app-label');
    if (label && t.apps[appId]) {
      label.textContent = t.apps[appId];
    } else if (label) {
      const app = apps.find(a => a.id === appId);
      if (app) label.textContent = app.name;
    }
  });

  // Update category labels
  $$('.app-category-label').forEach(el => {
    const cat = el.dataset.category;
    if (t.categories[cat]) {
      el.textContent = t.categories[cat];
    }
  });
}

function initLanguagePill() {
  const pill = $('#langPill');
  const options = pill.querySelectorAll('.lang-option');
  const indicator = pill.querySelector('.lang-indicator');

  function updateIndicator() {
    const activeOption = pill.querySelector('.lang-option.active');
    if (activeOption && indicator) {
      indicator.style.width = activeOption.offsetWidth + 'px';
      indicator.style.left = activeOption.offsetLeft + 'px';
    }
  }

  // Set initial active state
  options.forEach(opt => {
    if (opt.dataset.lang === currentLang) {
      opt.classList.add('active');
      opt.setAttribute('aria-checked', 'true');
    } else {
      opt.classList.remove('active');
      opt.setAttribute('aria-checked', 'false');
    }
  });

  // Position indicator after layout
  requestAnimationFrame(() => {
    requestAnimationFrame(updateIndicator);
  });

  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => {
        o.classList.remove('active');
        o.setAttribute('aria-checked', 'false');
      });
      opt.classList.add('active');
      opt.setAttribute('aria-checked', 'true');
      updateIndicator();
      applyLanguage(opt.dataset.lang);
    });
  });

  // Update on resize
  window.addEventListener('resize', updateIndicator);
}

// ── App Grid Rendering ──
function renderAppGrid(filter = 'all') {
  const grid = $('#appGrid');
  grid.innerHTML = '';

  const categoryOrder = ['operations', 'commercial', 'finance', 'people', 'communication', 'marketing', 'planning', 'knowledge', 'system'];
  const t = translations[currentLang] || translations.en;

  categoryOrder.forEach(cat => {
    const catApps = apps.filter(a => a.category === cat);
    if (catApps.length === 0) return;
    if (filter !== 'all' && filter !== cat) return;

    // Category label
    const label = document.createElement('div');
    label.className = 'app-category-label';
    label.dataset.category = cat;
    label.textContent = t.categories[cat] || categoryLabels[cat];
    grid.appendChild(label);

    // App cards
    catApps.forEach(app => {
      const card = document.createElement('a');
      card.className = 'app-card';
      card.href = '#';
      card.dataset.app = app.id;
      card.dataset.category = app.category;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      const appName = (t.apps[app.id]) || app.name;

      card.innerHTML = `
        <div class="app-icon">${app.icon}</div>
        <span class="app-label">${appName}</span>
      `;

      card.addEventListener('click', (e) => {
        e.preventDefault();

        // Internal pages (same origin)
        const internalRoutes = {
          '/dashboard': 'dashboard.html',
        };

        // External routes — Koleex ERP / Admin system
        const erpBase = 'https://koleex-website.vercel.app';
        const externalRoutes = {
          '/products':         erpBase + '/admin/products',
          '/inventory':        erpBase + '/admin/products',
          '/settings':         erpBase + '/admin',
        };

        const internal = internalRoutes[app.route];
        const external = externalRoutes[app.route];

        if (internal) {
          window.location.href = internal;
        } else if (external) {
          window.open(external, '_blank');
        }
      });

      grid.appendChild(card);
    });
  });

  updateAppCount();
}

// ── Search ──
function performSearch(query) {
  const cards = $$('.app-card');
  const labels = $$('.app-category-label');

  if (!query) {
    cards.forEach(c => c.classList.remove('hidden'));
    labels.forEach(l => l.classList.remove('hidden'));
    updateAppCount();
    return;
  }

  const visibleCategories = new Set();

  cards.forEach(card => {
    const label = card.querySelector('.app-label').textContent.toLowerCase();
    const id = card.dataset.app;
    const match = label.includes(query) || id.includes(query);
    card.classList.toggle('hidden', !match);
    if (match) visibleCategories.add(card.dataset.category);
  });

  labels.forEach(label => {
    label.classList.toggle('hidden', !visibleCategories.has(label.dataset.category));
  });

  updateAppCount();
}

function initSearch() {
  const desktopInput = $('#searchInput');
  const mobileInput = $('#mobileSearchInput');

  // Sync both inputs and share search logic
  function handleSearch(source, target) {
    const query = source.value.toLowerCase().trim();
    if (target) target.value = source.value;
    performSearch(query);
  }

  if (desktopInput) {
    desktopInput.addEventListener('input', () => handleSearch(desktopInput, mobileInput));
  }
  if (mobileInput) {
    mobileInput.addEventListener('input', () => handleSearch(mobileInput, desktopInput));
  }
}

// ── Sidebar ──
function initSidebar() {
  const toggle = $('#sidebarToggle');
  const sidebar = $('#sidebar');
  const overlay = $('#sidebarOverlay');

  toggle.addEventListener('click', () => {
    sidebarOpen = !sidebarOpen;
    sidebar.classList.toggle('open', sidebarOpen);
    overlay.classList.toggle('active', sidebarOpen);
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
  });

  overlay.addEventListener('click', () => {
    sidebarOpen = false;
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  });

  // Sidebar category filter
  $$('.sidebar-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = item.dataset.category;

      $$('.sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      currentCategory = cat;
      renderAppGrid(cat);

      // Close mobile sidebar
      if (window.innerWidth <= 768) {
        sidebarOpen = false;
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });
}

// ── Date ──
function updateDate() {
  const el = $('#currentDate');
  if (!el) return;
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  el.textContent = now.toLocaleDateString('en-US', options);
}

// ── App Count ──
function updateAppCount() {
  const el = $('#appCount');
  if (!el) return;
  const visible = $$('.app-card:not(.hidden)').length;
  el.textContent = `${visible} apps`;
}

// ── Keyboard Shortcuts ──
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K — focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const isMobile = window.innerWidth <= 768;
      const input = isMobile ? $('#mobileSearchInput') : $('#searchInput');
      if (input) input.focus();
    }
    // Escape — clear search / close sidebar
    if (e.key === 'Escape') {
      const input = document.activeElement;
      if (input && (input.id === 'searchInput' || input.id === 'mobileSearchInput')) {
        input.value = '';
        // Clear the other input too
        const other = input.id === 'searchInput' ? $('#mobileSearchInput') : $('#searchInput');
        if (other) other.value = '';
        performSearch('');
        input.blur();
      }
      if (sidebarOpen) {
        sidebarOpen = false;
        $('#sidebar').classList.remove('open');
        $('#sidebarOverlay').classList.remove('active');
        document.body.style.overflow = '';
      }
    }
  });
}
