export type PortalType = 'admin' | 'sales' | 'partner' | 'agent' | 'become-agent';

export type ThemeMode = 'light' | 'dark';

export type Language = 'en' | 'zh' | 'ar';

export interface NavItem {
  id: string;
  label: string;
  labelKey?: string;
  icon?: string;
  path: string;
  children?: NavItem[];
  badge?: string;
  isNew?: boolean;
  section?: string; // Section header label displayed above this item
}

export interface PortalConfig {
  id: PortalType;
  name: string;
  description: string;
  basePath: string;
  navigation: NavItem[];
  accentColor?: string;
}

export interface PolicyBlock {
  id: string;
  title: string;
  description: string;
  status: 'final' | 'draft' | 'placeholder' | 'pending';
  content?: string;
  lastUpdated?: string;
}

export interface MetricCardData {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'placeholder' | 'live';
}

export interface CaseStudy {
  id: string;
  title: string;
  category: string;
  scenario: string;
  outcome: string;
  correctAction: string;
  tags: string[];
}

export interface GlossaryItem {
  term: string;
  definition: string;
  category?: string;
}

export interface CalculatorField {
  id: string;
  label: string;
  type: 'number' | 'select' | 'toggle' | 'text' | 'currency';
  placeholder?: string;
  options?: { label: string; value: string }[];
  defaultValue?: string | number | boolean;
  unit?: string;
  helpText?: string;
  isDemo?: boolean;
}
