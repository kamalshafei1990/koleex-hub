/* ---------------------------------------------------------------------------
   Access Control Catalog — module keys, access levels, and preferences shape
   for the Accounts Manager v2 (Odoo-inspired) refactor.

   Two layers stack to produce an account's effective permissions:

     1. Role Access Preset     — default permission bundle for the role.
     2. Per-account Override   — sparse overrides in account_permission_overrides.

   The module catalog is grouped so the Access Rights UI can render a tidy
   list like Odoo's Users form (MASTER DATA, SALES, FINANCE, ...).

   Module keys are stable TEXT identifiers stored in
   account_permission_overrides.module_key. Do NOT rename them carelessly —
   existing override rows reference them by key.
   --------------------------------------------------------------------------- */

/* ========================================================================== */
/*  Access Levels                                                             */
/* ========================================================================== */

export const ACCESS_LEVELS = ["none", "user", "manager", "admin"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  none:    "No Access",
  user:    "User",
  manager: "Manager",
  admin:   "Administrator",
};

export const ACCESS_LEVEL_DESCRIPTIONS: Record<AccessLevel, string> = {
  none:    "Cannot see or use this module.",
  user:    "Can view and use standard features.",
  manager: "Can manage records and settings.",
  admin:   "Full control of the module.",
};

/* ========================================================================== */
/*  Module Catalog                                                            */
/* ========================================================================== */

/** A single module = one row in the Access Rights grid. */
export interface ModuleDef {
  key: string;
  label: string;
  description?: string;
}

/** A group of modules = one section in the Access Rights UI. */
export interface ModuleGroup {
  key: string;
  label: string;
  modules: ModuleDef[];
}

/**
 * Master module catalog. Grouped for UI, flat-keyed for storage.
 *
 * Keys chosen to be readable TEXT identifiers. Changing a key is a breaking
 * change — existing permission override rows reference them by key.
 */
export const MODULE_GROUPS: ModuleGroup[] = [
  {
    key: "master_data",
    label: "Master Data",
    modules: [
      { key: "accounts",  label: "Accounts",   description: "User and contact accounts." },
      { key: "companies", label: "Companies",  description: "Customer, supplier, and partner companies." },
      { key: "contacts",  label: "Contacts",   description: "People directory across the hub." },
      { key: "products",  label: "Products",   description: "Product catalog and models." },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    modules: [
      { key: "quotations", label: "Quotations", description: "Draft and send quotations." },
      { key: "orders",     label: "Orders",     description: "Sales orders and confirmations." },
      { key: "customers",  label: "Customers",  description: "Customer workspaces." },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    modules: [
      { key: "invoices",    label: "Invoices",    description: "Customer and supplier invoices." },
      { key: "payments",    label: "Payments",    description: "Payment tracking and reconciliation." },
      { key: "expenses",    label: "Expenses",    description: "Expense claims and reimbursements." },
      { key: "landed_cost", label: "Landed Cost", description: "Import cost allocation." },
    ],
  },
  {
    key: "supply_chain",
    label: "Supply Chain",
    modules: [
      { key: "purchase",  label: "Purchase",  description: "Purchase orders and suppliers." },
      { key: "inventory", label: "Inventory", description: "Stock levels and warehouses." },
      { key: "shipping",  label: "Shipping",  description: "Logistics and delivery." },
    ],
  },
  {
    key: "human_resources",
    label: "Human Resources",
    modules: [
      { key: "employees",   label: "Employees",    description: "Employee records and HR data." },
      { key: "recruitment", label: "Recruitment",  description: "Candidate pipeline." },
      { key: "attendance",  label: "Attendance",   description: "Time and attendance." },
      { key: "appraisals",  label: "Appraisals",   description: "Performance reviews." },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    modules: [
      { key: "website",   label: "Website",    description: "CMS and public pages." },
      { key: "campaigns", label: "Campaigns",  description: "Marketing campaigns." },
      { key: "events",    label: "Events",     description: "Events and exhibitions." },
      { key: "brand",     label: "Brand",      description: "Brand assets and guidelines." },
    ],
  },
  {
    key: "productivity",
    label: "Productivity",
    modules: [
      { key: "calendar", label: "Calendar", description: "Meetings and scheduling." },
      { key: "tasks",    label: "Tasks",    description: "Task tracking." },
      { key: "notes",    label: "Notes",    description: "Personal and shared notes." },
    ],
  },
];

/** Flat list of every module key. Useful for validation. */
export const ALL_MODULE_KEYS: string[] = MODULE_GROUPS.flatMap((g) =>
  g.modules.map((m) => m.key),
);

/** Lookup a module's group + definition by key. */
export function findModule(
  key: string,
): { group: ModuleGroup; module: ModuleDef } | null {
  for (const group of MODULE_GROUPS) {
    const module = group.modules.find((m) => m.key === key);
    if (module) return { group, module };
  }
  return null;
}

/* ========================================================================== */
/*  Preset → default access level mapping                                     */
/*                                                                            */
/*  The current access_presets table is a set of boolean flags (can_access_*, */
/*  can_manage_*). This function translates those flags into a dense map of   */
/*  module_key → AccessLevel so the UI can show "preset default" per module.  */
/*                                                                            */
/*  When per-account overrides exist, they win. Otherwise this default holds. */
/* ========================================================================== */

export interface PresetFlagsLike {
  can_access_products: boolean;
  can_view_pricing: boolean;
  can_create_quotations: boolean;
  can_place_orders: boolean;
  can_manage_accounts: boolean;
  can_manage_products: boolean;
  can_access_finance: boolean;
  can_access_hr: boolean;
  can_access_marketing: boolean;
}

/**
 * Translate the v1 preset boolean flags into a dense per-module access map.
 * Modules not covered by any flag default to "none" so nothing leaks.
 */
export function defaultAccessFromPreset(
  preset: PresetFlagsLike | null,
): Record<string, AccessLevel> {
  const map: Record<string, AccessLevel> = {};
  for (const key of ALL_MODULE_KEYS) map[key] = "none";

  if (!preset) return map;

  // Master data
  if (preset.can_manage_accounts) map["accounts"] = "admin";
  if (preset.can_access_products) map["products"] = "user";
  if (preset.can_manage_products) map["products"] = "manager";

  // Sales
  if (preset.can_create_quotations) map["quotations"] = "user";
  if (preset.can_place_orders)      map["orders"] = "user";
  if (preset.can_view_pricing) {
    // Pricing visibility doesn't map to a module, but having it implies
    // at least user-level on customers/products.
    if (map["customers"] === "none") map["customers"] = "user";
  }

  // Finance
  if (preset.can_access_finance) {
    map["invoices"]    = "user";
    map["payments"]    = "user";
    map["expenses"]    = "user";
    map["landed_cost"] = "user";
  }

  // HR
  if (preset.can_access_hr) {
    map["employees"]   = "user";
    map["recruitment"] = "user";
    map["attendance"]  = "user";
    map["appraisals"]  = "user";
  }

  // Marketing
  if (preset.can_access_marketing) {
    map["website"]   = "user";
    map["campaigns"] = "user";
    map["events"]    = "user";
    map["brand"]     = "user";
  }

  // Productivity — everyone gets calendar/tasks/notes at user level.
  map["calendar"] = "user";
  map["tasks"]    = "user";
  map["notes"]    = "user";

  return map;
}

/* ========================================================================== */
/*  Preferences Shape                                                         */
/* ========================================================================== */

export type LanguagePref = "en" | "ar";
export type ThemePref = "light" | "dark" | "system";
export type NotificationChannel = "email" | "in_app" | "both";

export interface NotificationPrefs {
  email: boolean;
  in_app: boolean;
  /* ── Per-activity toggles (optional; default on) ──
     Let a user silence specific event types without turning off a whole
     channel. Consumed by the notification dispatcher when present. */
  mentions?: boolean;
  approvals?: boolean;
  assignments?: boolean;
  tasks_due?: boolean;
  quotation_activity?: boolean;
  low_stock?: boolean;
  qa_reports?: boolean;
  price_fx?: boolean;
  /* Quiet hours — a daily window (recipient-local) during which push and
     chimes stay silent. `tz` is snapshotted from the browser at save time so
     the SERVER can evaluate the window without guessing the user's zone.
     Enforced in sendPushToAccounts and the NotificationBell chime. */
  quiet_hours?: QuietHoursPref;
}

export interface QuietHoursPref {
  enabled: boolean;
  /** "HH:MM" 24h, recipient-local. Window may cross midnight (22:00→08:00). */
  start: string;
  end: string;
  /** IANA zone captured when the user saved (e.g. "Asia/Shanghai"). */
  tz?: string;
}

/* ── Display / appearance / region preferences ──
   All persisted inside accounts.preferences (jsonb) — no migration. The
   visual ones (theme, text size, reduce motion, high contrast, reduce
   transparency) are applied to <html> by DisplayPreferencesApplier; the
   format ones are consumed by src/lib/format-prefs.ts. */
export type TextSizePref = "small" | "default" | "large" | "xlarge";
export type DensityPref = "comfortable" | "compact";
export type DateFormatPref = "dmy" | "mdy" | "iso";
export type TimeFormatPref = "12h" | "24h";
export type NumberFormatPref = "comma_dot" | "dot_comma" | "space_comma";
export type UnitsPref = "metric" | "imperial";
export type CurrencyDisplayPref = "symbol" | "code";
/** 0 = Sunday, 1 = Monday, 6 = Saturday. */
export type WeekStartPref = 0 | 1 | 6;

export interface DisplayPrefs {
  text_size: TextSizePref;
  density: DensityPref;
  reduce_motion: boolean;
  high_contrast: boolean;
  reduce_transparency: boolean;
  bold_text: boolean;
  underline_links: boolean;
  focus_ring: boolean;
  date_format: DateFormatPref;
  time_format: TimeFormatPref;
  number_format: NumberFormatPref;
  units: UnitsPref;
  currency_display: CurrencyDisplayPref;
  week_start: WeekStartPref;
}

export interface WorkingHoursPrefs {
  /** 24h time "HH:MM" e.g. "09:00". */
  start: string;
  /** 24h time "HH:MM" e.g. "18:00". */
  end: string;
  /** ISO weekday numbers (1=Mon, 7=Sun). */
  days: number[];
}

export interface OutOfOfficePrefs {
  enabled: boolean;
  start?: string;  // ISO date "YYYY-MM-DD"
  end?: string;    // ISO date "YYYY-MM-DD"
  message?: string;
}

export interface CalendarPrefs {
  /** IANA timezone, e.g. "Asia/Dubai". */
  timezone?: string;
  working_hours?: WorkingHoursPrefs;
  default_meeting_duration_min?: number;
  out_of_office?: OutOfOfficePrefs;
}

/** Optional professional / social links surfaced on the Settings → Profile
 *  card. Stored in the preferences JSON bag — no dedicated columns. */
export interface ProfileLinks {
  linkedin?: string;
  website?: string;
  wechat?: string;
  whatsapp?: string;
}

/** Personal profile extras that don't have a `people` column of their own. */
export interface ProfilePrefs {
  pronouns?: string;
  links?: ProfileLinks;
}

export interface AccountPreferences {
  language?: LanguagePref;
  theme?: ThemePref;
  display?: DisplayPrefs;
  email_signature?: string;
  notifications?: NotificationPrefs;
  calendar?: CalendarPrefs;
  profile?: ProfilePrefs;
}

/**
 * Sensible defaults applied in the UI when a field is missing from the stored
 * preferences jsonb. These are frontend defaults only — we never auto-write
 * them into the DB on every read.
 */
export const DEFAULT_PREFERENCES: Required<
  Omit<AccountPreferences, "email_signature">
> & { email_signature: string } = {
  language: "en",
  theme: "system",
  email_signature: "",
  profile: { pronouns: "", links: {} },
  notifications: {
    email: true,
    in_app: true,
    mentions: true,
    approvals: true,
    assignments: true,
    tasks_due: true,
    quotation_activity: true,
    low_stock: true,
    qa_reports: true,
    price_fx: true,
  },
  display: {
    text_size: "default",
    density: "comfortable",
    reduce_motion: false,
    high_contrast: false,
    reduce_transparency: false,
    bold_text: false,
    underline_links: false,
    focus_ring: false,
    date_format: "dmy",
    time_format: "24h",
    number_format: "comma_dot",
    units: "metric",
    currency_display: "symbol",
    week_start: 1,
  },
  calendar: {
    timezone: "Asia/Dubai",
    working_hours: { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] },
    default_meeting_duration_min: 30,
    out_of_office: { enabled: false },
  },
};

/** Merge stored preferences with frontend defaults for display. */
export function withDefaults(
  prefs: AccountPreferences | null | undefined,
): AccountPreferences {
  const p = prefs || {};
  return {
    language: p.language ?? DEFAULT_PREFERENCES.language,
    theme:    p.theme    ?? DEFAULT_PREFERENCES.theme,
    email_signature: p.email_signature ?? DEFAULT_PREFERENCES.email_signature,
    profile: {
      pronouns: p.profile?.pronouns ?? DEFAULT_PREFERENCES.profile.pronouns,
      links: {
        linkedin: p.profile?.links?.linkedin ?? "",
        website:  p.profile?.links?.website  ?? "",
        wechat:   p.profile?.links?.wechat   ?? "",
        whatsapp: p.profile?.links?.whatsapp ?? "",
      },
    },
    notifications: {
      email:  p.notifications?.email  ?? DEFAULT_PREFERENCES.notifications.email,
      in_app: p.notifications?.in_app ?? DEFAULT_PREFERENCES.notifications.in_app,
      mentions: p.notifications?.mentions ?? DEFAULT_PREFERENCES.notifications.mentions,
      approvals: p.notifications?.approvals ?? DEFAULT_PREFERENCES.notifications.approvals,
      assignments: p.notifications?.assignments ?? DEFAULT_PREFERENCES.notifications.assignments,
      tasks_due: p.notifications?.tasks_due ?? DEFAULT_PREFERENCES.notifications.tasks_due,
      quotation_activity: p.notifications?.quotation_activity ?? DEFAULT_PREFERENCES.notifications.quotation_activity,
      low_stock: p.notifications?.low_stock ?? DEFAULT_PREFERENCES.notifications.low_stock,
      qa_reports: p.notifications?.qa_reports ?? DEFAULT_PREFERENCES.notifications.qa_reports,
      price_fx: p.notifications?.price_fx ?? DEFAULT_PREFERENCES.notifications.price_fx,
      quiet_hours: p.notifications?.quiet_hours ?? { enabled: false, start: "22:00", end: "08:00" },
    },
    display: {
      text_size: p.display?.text_size ?? DEFAULT_PREFERENCES.display.text_size,
      density: p.display?.density ?? DEFAULT_PREFERENCES.display.density,
      reduce_motion: p.display?.reduce_motion ?? DEFAULT_PREFERENCES.display.reduce_motion,
      high_contrast: p.display?.high_contrast ?? DEFAULT_PREFERENCES.display.high_contrast,
      reduce_transparency: p.display?.reduce_transparency ?? DEFAULT_PREFERENCES.display.reduce_transparency,
      bold_text: p.display?.bold_text ?? DEFAULT_PREFERENCES.display.bold_text,
      underline_links: p.display?.underline_links ?? DEFAULT_PREFERENCES.display.underline_links,
      focus_ring: p.display?.focus_ring ?? DEFAULT_PREFERENCES.display.focus_ring,
      date_format: p.display?.date_format ?? DEFAULT_PREFERENCES.display.date_format,
      time_format: p.display?.time_format ?? DEFAULT_PREFERENCES.display.time_format,
      number_format: p.display?.number_format ?? DEFAULT_PREFERENCES.display.number_format,
      units: p.display?.units ?? DEFAULT_PREFERENCES.display.units,
      currency_display: p.display?.currency_display ?? DEFAULT_PREFERENCES.display.currency_display,
      week_start: p.display?.week_start ?? DEFAULT_PREFERENCES.display.week_start,
    },
    calendar: {
      timezone: p.calendar?.timezone ?? DEFAULT_PREFERENCES.calendar.timezone,
      working_hours:
        p.calendar?.working_hours ?? DEFAULT_PREFERENCES.calendar.working_hours,
      default_meeting_duration_min:
        p.calendar?.default_meeting_duration_min ??
        DEFAULT_PREFERENCES.calendar.default_meeting_duration_min,
      out_of_office:
        p.calendar?.out_of_office ?? DEFAULT_PREFERENCES.calendar.out_of_office,
    },
  };
}

/* ========================================================================== */
/*  Common Timezone List (minimal — extend as needed)                         */
/* ========================================================================== */

export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "Asia/Dubai",       label: "Dubai (GMT+4)" },
  { value: "Asia/Riyadh",      label: "Riyadh (GMT+3)" },
  { value: "Asia/Qatar",       label: "Doha (GMT+3)" },
  { value: "Asia/Kuwait",      label: "Kuwait (GMT+3)" },
  { value: "Asia/Bahrain",     label: "Bahrain (GMT+3)" },
  { value: "Asia/Muscat",      label: "Muscat (GMT+4)" },
  { value: "Africa/Cairo",     label: "Cairo (GMT+2)" },
  { value: "Europe/Istanbul",  label: "Istanbul (GMT+3)" },
  { value: "Europe/London",    label: "London (GMT+0/+1)" },
  { value: "Europe/Paris",     label: "Paris (GMT+1/+2)" },
  { value: "Europe/Berlin",    label: "Berlin (GMT+1/+2)" },
  { value: "Europe/Moscow",    label: "Moscow (GMT+3)" },
  { value: "Asia/Shanghai",    label: "Shanghai (GMT+8)" },
  { value: "Asia/Singapore",   label: "Singapore (GMT+8)" },
  { value: "Asia/Tokyo",       label: "Tokyo (GMT+9)" },
  { value: "Asia/Kolkata",     label: "Mumbai (GMT+5:30)" },
  { value: "America/New_York", label: "New York (GMT-5/-4)" },
  { value: "America/Chicago",  label: "Chicago (GMT-6/-5)" },
  { value: "America/Denver",   label: "Denver (GMT-7/-6)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8/-7)" },
  { value: "UTC",              label: "UTC" },
];

/* ========================================================================== */
/*  Weekday Helpers                                                           */
/* ========================================================================== */

export const WEEKDAYS: { iso: number; short: string; label: string }[] = [
  { iso: 1, short: "Mon", label: "Monday" },
  { iso: 2, short: "Tue", label: "Tuesday" },
  { iso: 3, short: "Wed", label: "Wednesday" },
  { iso: 4, short: "Thu", label: "Thursday" },
  { iso: 5, short: "Fri", label: "Friday" },
  { iso: 6, short: "Sat", label: "Saturday" },
  { iso: 7, short: "Sun", label: "Sunday" },
];
