/* ---------------------------------------------------------------------------
   Supabase Database Types — Maps to the CMS tables.

   Tables:
   - pages: website pages (home, about, products, etc.)
   - sections: content sections within pages
   - media: uploaded files and images

   Layout types for sections:
   hero | image-left | image-right | cards | grid | video | numbers | cta |
   quote | timeline | full-image | split | brands
   --------------------------------------------------------------------------- */

export type SectionLayout =
  | "hero"
  | "image-left"
  | "image-right"
  | "cards"
  | "grid"
  | "video"
  | "numbers"
  | "cta"
  | "quote"
  | "timeline"
  | "full-image"
  | "split"
  | "brands"
  | "bg-hero";

export type ButtonStyle = "solid" | "outline" | "ghost";
export type ButtonShape = "pill" | "rounded" | "square";
export type ButtonSize = "small" | "medium" | "large";
export type LinkType = "none" | "page" | "product" | "anchor" | "url" | "file" | "email" | "phone";

export interface ButtonConfig {
  text: string;
  linkType: LinkType;
  link: string;
  newTab: boolean;
  style: ButtonStyle;
  shape: ButtonShape;
  size: ButtonSize;
}

export interface SectionSettings {
  btn1?: ButtonConfig;
  btn2?: ButtonConfig;
  overlayOpacity?: number;
  textAlign?: "left" | "center" | "right";
  textMode?: "dark" | "light";
  contentWidth?: "narrow" | "medium" | "wide" | "full";
  verticalAlign?: "top" | "center" | "bottom";
  columns?: number;
  rows?: number;
  paddingTop?: string;
  paddingBottom?: string;
  gap?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  // Layout zones
  zoneLayout?: ZoneLayout;
}

/* ── Layout Zones ── */
export type ZoneLayout =
  | "1-col"
  | "2-col"
  | "3-col"
  | "4-col"
  | "70-30"
  | "30-70"
  | "60-40"
  | "40-60";

/* ── Icon Config ── */
export interface IconConfig {
  type: "emoji" | "lucide" | "svg" | "image";
  value: string; // emoji char, lucide name, svg string, or image URL
  size: "xs" | "sm" | "md" | "lg" | "xl" | "custom";
  customSize?: number;
  color?: string;
  bgShape?: "none" | "circle" | "rounded" | "pill";
  bgColor?: string;
  position?: "left" | "right" | "top" | "bottom" | "center";
  align?: "left" | "center" | "right";
}

/* ── Element Types ── */

export type ElementType =
  | "heading"
  | "paragraph"
  | "image"
  | "button"
  | "icon"
  | "card"
  | "list"
  | "form"
  | "video"
  | "divider"
  | "container"
  | "spacer"
  | "badge"
  | "avatar"
  | "stat"
  | "testimonial"
  | "feature"
  | "pricing"
  | "faq"
  | "social"
  | "logo"
  | "countdown"
  | "progress"
  | "tag-list"
  | "cta-banner"
  | "icon-box"
  | "gallery"
  | "map"
  | "code"
  | "table"
  | "accordion"
  | "tabs"
  | "alert"
  | "breadcrumb";

export interface ElementRow {
  id: string;
  section_id: string;
  type: ElementType;
  content: Record<string, unknown> | null;
  style: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  order: number;
  visible: boolean;
  zone?: string; // Virtual field — derived from settings.zone, not a DB column
  created_at: string;
  updated_at: string;
}

/* ── Row types (what comes back from Supabase) ── */

export interface PageRow {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SectionRow {
  id: string;
  page_id: string;
  section_key: string;
  layout: SectionLayout;
  title: string | null;
  subtitle: string | null;
  content: string | null;
  image_url: string | null;
  image_alt: string | null;
  video_url: string | null;
  button_text: string | null;
  button_link: string | null;
  button2_text: string | null;
  button2_link: string | null;
  background: "white" | "light" | "dark" | "black" | "image" | null;
  items: SectionItem[] | null;
  order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface SectionItem {
  title: string;
  description?: string;
  icon?: string;
  image?: string;
  href?: string;
  value?: string;
  label?: string;
}

export interface MediaRow {
  id: string;
  name: string;
  file_path: string;
  url: string;
  type: string;
  size: number;
  created_at: string;
}

/* ── Insert types (what you send to Supabase) ── */

export type PageInsert = Omit<PageRow, "id" | "created_at" | "updated_at">;
export type SectionInsert = Omit<SectionRow, "id" | "created_at" | "updated_at">;
export type MediaInsert = Omit<MediaRow, "id" | "created_at">;

/* ── Update types ── */

export type PageUpdate = Partial<PageInsert>;
export type SectionUpdate = Partial<SectionInsert>;

/* ---------------------------------------------------------------------------
   Product Catalog Types — Maps to the product tables.
   --------------------------------------------------------------------------- */

export type ProductMediaType =
  | "main_image"
  | "gallery"
  | "packing_photo"
  | "label"
  | "logo_detail"
  | "manual"
  | "ar_3d"
  | "video";

export interface DivisionRow {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  order: number;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  division_id: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  created_at: string;
}

export interface SubcategoryRow {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  created_at: string;
}

export interface ProductRow {
  id: string;
  product_name: string;
  slug: string;
  division_slug: string;
  category_slug: string;
  subcategory_slug: string;
  brand: string | null;
  tags: string[];
  level: string | null;
  description: string | null;
  specs: Record<string, unknown>;
  hs_code: string | null;
  voltage: string[];
  plug_types: string[];
  watt: string | null;
  colors: string[];
  supports_head_only: boolean;
  supports_complete_set: boolean;
  warranty: string | null;
  visible: boolean;
  featured: boolean;
  status: string | null;
  family: string | null;
  country_of_origin: string | null;
  moq: number | null;
  lead_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductModelRow {
  id: string;
  product_id: string;
  model_name: string;
  slug: string;
  sku: string;
  tagline: string | null;
  supplier: string | null;
  reference_model: string | null;
  cost_price: number | null;
  global_price: number | null;
  supports_head_only: boolean | null;
  supports_complete_set: boolean | null;
  head_only_price: number | null;
  complete_set_price: number | null;
  weight: number | null;
  cbm: number | null;
  packing_type: string | null;
  box_include: string | null;
  extra_accessories: string | null;
  order: number;
  visible: boolean;
  status: string | null;
  moq: number | null;
  lead_time: string | null;
  barcode: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductMediaRow {
  id: string;
  product_id: string;
  model_id: string | null;
  type: ProductMediaType;
  url: string;
  file_path: string | null;
  alt_text: string | null;
  order: number;
  created_at: string;
}

export interface ProductTranslationRow {
  id: string;
  product_id: string;
  locale: string;
  product_name: string;
  description: string | null;
  created_at: string;
}

export interface ModelTranslationRow {
  id: string;
  model_id: string;
  locale: string;
  model_name: string;
  tagline: string | null;
  created_at: string;
}

export interface ProductMarketPriceRow {
  id: string;
  model_id: string;
  country_code: string;
  currency: string;
  market_price: number;
  head_only_price: number | null;
  complete_set_price: number | null;
  created_at: string;
}

export interface RelatedProductRow {
  product_id: string;
  related_id: string;
  order: number;
}

export interface SewingMachineSpecsRow {
  id: string;
  product_id: string;
  template_slug: string;
  common_specs: Record<string, unknown>;
  template_specs: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type SewingMachineSpecsInsert = Omit<SewingMachineSpecsRow, "id" | "created_at" | "updated_at">;

/* ── Insert types ── */

export type ProductInsert = Omit<ProductRow, "id" | "created_at" | "updated_at">;
export type ProductModelInsert = Omit<ProductModelRow, "id" | "sku" | "created_at" | "updated_at">;
export type ProductMediaInsert = Omit<ProductMediaRow, "id" | "created_at">;
export type ProductTranslationInsert = Omit<ProductTranslationRow, "id" | "created_at">;
export type ModelTranslationInsert = Omit<ModelTranslationRow, "id" | "created_at">;
export type ProductMarketPriceInsert = Omit<ProductMarketPriceRow, "id" | "created_at">;

/* ---------------------------------------------------------------------------
   Accounts Manager v2 — Identity System

   This is the refactored identity layer. It separates five concerns into
   five tables (see supabase/migrations/refactor_accounts_to_identity_system.sql):

     1. people            — Person / contact records (identity + address).
     2. companies         — Organisations. customer_level lives here as the
                            single source of truth for pricing logic.
     3. koleex_employees  — Internal HR records linking people ↔ accounts.
     4. accounts          — Login identity only: username, login email,
                            password, user_type, status, role, links to
                            person + company. No more profile data here.
     5. access_presets    — Role → default permission bundle (placeholder for
                            the future permissions system with overrides).

   Naming note: we use `people` (not `contacts`) and `koleex_employees` (not
   `employees`) because legacy tables with those names already exist. The
   legacy `contacts` table powers /customers, /suppliers, /contacts as a
   flat business directory, and a legacy `employees` table exists too. The
   new `people` + `koleex_employees` tables are identity-layer records.
   --------------------------------------------------------------------------- */

export type UserType = "internal" | "customer";
export type AccountStatus =
  | "invited"
  | "active"
  | "inactive"
  | "suspended"
  | "pending";
export type CustomerLevel = "silver" | "gold" | "platinum" | "diamond";
export type CompanyType = "koleex" | "customer" | "supplier" | "partner";
export type RoleScope = "internal" | "customer" | "all";
export type EmploymentStatus = "active" | "on_leave" | "terminated" | "inactive";

/* Re-export the AccountPreferences type from the access-control catalog so
   supabase types and UI types stay in sync. */
export type {
  AccountPreferences,
  AccessLevel,
} from "@/lib/access-control";
import type { AccountPreferences as _AccountPreferences } from "@/lib/access-control";

/* ── Companies (source of truth for customer level + pricing) ── */
export interface CompanyRow {
  id: string;
  name: string;
  type: CompanyType;
  country: string | null;
  currency: string | null;
  customer_level: CustomerLevel | null;
  tax_id: string | null;
  website: string | null;
  logo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CompanyInsert = Omit<CompanyRow, "id" | "created_at" | "updated_at">;
export type CompanyUpdate = Partial<CompanyInsert>;

/* ── Roles ── */
export interface RoleRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  scope: RoleScope;
  display_order: number;
  created_at: string;
}

export type RoleInsert = Omit<RoleRow, "id" | "created_at">;

/* ── People (person records — identity + address) ── */
export interface PersonRow {
  id: string;
  full_name: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  avatar_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  company_id: string | null;
  language: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type PersonInsert = Omit<PersonRow, "id" | "created_at" | "updated_at">;
export type PersonUpdate = Partial<PersonInsert>;

/* ── Employees (internal HR record, links person ↔ account) ── */
export interface EmployeeRow {
  id: string;
  person_id: string | null;
  account_id: string | null;
  employee_number: string | null;
  department: string | null;
  position: string | null;
  hire_date: string | null;
  employment_status: EmploymentStatus;
  manager_id: string | null;
  work_email: string | null;
  work_phone: string | null;
  notes: string | null;

  // Private HR fields (added in accounts v2 phase 1)
  private_address_line1: string | null;
  private_address_line2: string | null;
  private_city: string | null;
  private_state: string | null;
  private_country: string | null;
  private_postal_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  birth_date: string | null;
  marital_status: string | null;
  nationality: string | null;
  identification_id: string | null;
  passport_number: string | null;
  visa_number: string | null;
  visa_expiry_date: string | null;

  created_at: string;
  updated_at: string;
}

export type EmployeeInsert = Omit<EmployeeRow, "id" | "created_at" | "updated_at">;
export type EmployeeUpdate = Partial<EmployeeInsert>;

/* ── Accounts (login identity only) ── */
export interface AccountRow {
  id: string;
  auth_user_id: string | null;

  // Login identity
  username: string;
  login_email: string;
  password_hash: string | null;
  force_password_change: boolean;
  two_factor_enabled: boolean;
  last_login_at: string | null;

  // Type / status / role
  user_type: UserType;
  status: AccountStatus;
  role_id: string | null;

  // Linked records
  person_id: string | null;
  company_id: string | null;

  // Profile
  avatar_url: string | null;

  // Admin-only
  internal_notes: string | null;

  // Preferences bag (language, theme, signature, notifications, calendar)
  preferences: _AccountPreferences;

  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type AccountInsert = Omit<AccountRow, "id" | "created_at" | "updated_at">;
export type AccountUpdate = Partial<AccountInsert>;

/* ── Access Presets (role → default permission bundle) ── */
export interface AccessPresetRow {
  id: string;
  role_id: string;
  preset_name: string;
  description: string | null;
  can_access_products: boolean;
  can_view_pricing: boolean;
  can_create_quotations: boolean;
  can_place_orders: boolean;
  can_manage_accounts: boolean;
  can_manage_products: boolean;
  can_access_finance: boolean;
  can_access_hr: boolean;
  can_access_marketing: boolean;
  scope_notes: string | null;
  created_at: string;
}

export type AccessPresetInsert = Omit<AccessPresetRow, "id" | "created_at">;
export type AccessPresetUpdate = Partial<AccessPresetInsert>;

/* ── Per-account permission overrides (layers on top of role preset) ── */
export interface AccountPermissionOverrideRow {
  id: string;
  account_id: string;
  module_key: string;
  access_level: "none" | "user" | "manager" | "admin";
  created_at: string;
  updated_at: string;
}

export type AccountPermissionOverrideInsert = Omit<
  AccountPermissionOverrideRow,
  "id" | "created_at" | "updated_at"
>;
export type AccountPermissionOverrideUpdate =
  Partial<AccountPermissionOverrideInsert>;

/* Convenience: an account with its linked person / company / role / preset
   already joined in memory (built client-side after parallel fetches). */
export interface AccountWithLinks extends AccountRow {
  person: PersonRow | null;
  company: CompanyRow | null;
  role: RoleRow | null;
  preset: AccessPresetRow | null;
  employee: EmployeeRow | null;
  overrides: AccountPermissionOverrideRow[];
}

/* ── Security infrastructure (Project C: Security tab) ── */

export interface ApiKeyRow {
  id: string;
  account_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}
export type ApiKeyInsert = Omit<ApiKeyRow, "id" | "created_at">;
export type ApiKeyUpdate = Partial<ApiKeyInsert>;

export type DeviceType = "desktop" | "mobile" | "tablet" | "other";

export interface AccountSessionRow {
  id: string;
  account_id: string;
  session_token_hash: string;
  device_name: string | null;
  device_type: DeviceType | null;
  os: string | null;
  browser: string | null;
  ip_address: string | null;
  last_active_at: string;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}
export type AccountSessionInsert = Omit<
  AccountSessionRow,
  "id" | "created_at" | "last_active_at"
> & { last_active_at?: string };
export type AccountSessionUpdate = Partial<AccountSessionInsert>;

export type LoginEventType =
  | "login_success"
  | "login_failed"
  | "logout"
  | "password_reset"
  | "force_reset_enabled"
  | "force_reset_cleared"
  | "two_factor_enabled"
  | "two_factor_disabled"
  | "api_key_created"
  | "api_key_revoked"
  | "session_revoked"
  | "passkey_enrolled"
  | "passkey_revoked";

export interface LoginHistoryRow {
  id: string;
  account_id: string;
  event_type: LoginEventType;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
export type LoginHistoryInsert = Omit<LoginHistoryRow, "id" | "created_at">;

/* ── Calendar events (Project B: self-contained calendar app) ── */

export type CalendarEventType =
  | "meeting"
  | "task"
  | "reminder"
  | "event"
  | "holiday"
  | "out_of_office";

export interface CalendarEventRow {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;   // ISO UTC timestamp
  end_at: string;     // ISO UTC timestamp
  all_day: boolean;
  event_type: CalendarEventType;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export type CalendarEventInsert = Omit<
  CalendarEventRow,
  "id" | "created_at" | "updated_at"
>;
export type CalendarEventUpdate = Partial<CalendarEventInsert>;

/* ── Membership requests ("Be a Koleex Member" form) ── */

export type MembershipRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "archived";

export interface MembershipRequestRow {
  id: string;
  full_name: string;
  email: string;
  company: string | null;
  message: string | null;
  status: MembershipRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type MembershipRequestInsert = Omit<
  MembershipRequestRow,
  | "id"
  | "created_at"
  | "status"
  | "reviewed_by"
  | "reviewed_at"
  | "source"
  | "metadata"
> & {
  status?: MembershipRequestStatus;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

export type MembershipRequestUpdate = Partial<MembershipRequestInsert> & {
  status?: MembershipRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
};

/* ── Inbox messages (unified notifications + direct messages) ── */

export type InboxMessageCategory =
  | "message"
  | "system"
  | "membership_request"
  | "alert"
  | "external_email";

/** Direction an inbox message flowed:
 *   internal — in-app Koleex message (original default)
 *   inbound  — received from an external sender via IMAP
 *   outbound — sent to an external recipient via SMTP
 *
 *  Exists so the UI can render a "Gmail" / "External" badge and the
 *  sync service can filter cleanly between real email and Koleex DMs. */
export type InboxMessageDirection = "internal" | "inbound" | "outbound";

export interface InboxMessageRow {
  id: string;
  recipient_account_id: string;
  sender_account_id: string | null;
  category: InboxMessageCategory;
  subject: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;

  /* ── External-email fields (all NULL for internal Koleex messages) ── */
  mail_connection_id: string | null;
  direction: InboxMessageDirection;
  external_from: string | null;
  external_from_name: string | null;
  external_to: string[] | null;
  external_cc: string[] | null;
  external_message_id: string | null;
  external_in_reply_to: string | null;
  external_references: string[] | null;
  mail_thread_id: string | null;
  imap_uid: number | null;
  body_html: string | null;
}

export type InboxMessageInsert = Omit<
  InboxMessageRow,
  | "id"
  | "created_at"
  | "read_at"
  | "archived_at"
  | "metadata"
  | "mail_connection_id"
  | "direction"
  | "external_from"
  | "external_from_name"
  | "external_to"
  | "external_cc"
  | "external_message_id"
  | "external_in_reply_to"
  | "external_references"
  | "mail_thread_id"
  | "imap_uid"
  | "body_html"
> & {
  metadata?: Record<string, unknown>;
  mail_connection_id?: string | null;
  direction?: InboxMessageDirection;
  external_from?: string | null;
  external_from_name?: string | null;
  external_to?: string[] | null;
  external_cc?: string[] | null;
  external_message_id?: string | null;
  external_in_reply_to?: string | null;
  external_references?: string[] | null;
  mail_thread_id?: string | null;
  imap_uid?: number | null;
  body_html?: string | null;
};

export type InboxMessageUpdate = Partial<InboxMessageInsert> & {
  read_at?: string | null;
  archived_at?: string | null;
};

/* ── Mail connection (IMAP/SMTP) ────────────────────────────────────── */

export type MailProvider = "zoho" | "gmail" | "outlook" | "yahoo" | "custom";
export type MailConnectionStatus = "active" | "disabled" | "error";

/** One connected external mailbox per account. The `password_encrypted`
 *  field is deliberately excluded from the default `Row` shape — it's
 *  server-only and never sent to the browser. The sync service reads
 *  it through a privileged server helper that explicitly selects it. */
export interface MailConnectionRow {
  id: string;
  account_id: string;
  display_name: string;
  email_address: string;
  provider: MailProvider;

  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_username: string;

  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;

  last_uid: number | null;
  last_sync_at: string | null;
  last_error: string | null;
  status: MailConnectionStatus;

  created_at: string;
  updated_at: string;
}

/** Shape used only by the server-side IMAP/SMTP helpers. Adds the
 *  encrypted password blob that the rest of the app must never see. */
export interface MailConnectionWithSecret extends MailConnectionRow {
  password_encrypted: string;
}

export type MailConnectionInsert = Omit<
  MailConnectionRow,
  "id" | "created_at" | "updated_at" | "last_uid" | "last_sync_at" | "last_error" | "status"
> & {
  password_encrypted: string;
  status?: MailConnectionStatus;
};

export type MailConnectionUpdate = Partial<
  Omit<MailConnectionInsert, "account_id">
> & {
  last_uid?: number | null;
  last_sync_at?: string | null;
  last_error?: string | null;
  status?: MailConnectionStatus;
};

/** Joined view used by the bell dropdown + inbox list — includes the
 *  sender's display info so we don't have to round-trip for each row. */
export interface InboxMessageWithSender extends InboxMessageRow {
  sender: {
    id: string;
    username: string;
    avatar_url: string | null;
    full_name: string | null;
  } | null;
}

/* ── Discuss (chat system) ───────────────────────────────────────────
   Mirrors supabase/migrations/create_discuss_chat_system.sql. Every
   table there has a matching Row / Insert / Update trio here, plus a
   few "joined" view types for the common read patterns (sidebar list,
   message with author, etc.). Kept colocated with the Inbox types
   because chat evolved as the real-time counterpart to the static
   inbox — both read from accounts/people for user info. */

export type DiscussChannelKind = "direct" | "group" | "channel" | "customer";

export interface DiscussChannelRow {
  id: string;
  kind: DiscussChannelKind;
  name: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  last_message_at: string;
  /** For Phase E customer-chat channels only: FK to the CRM contact
   *  this chat is bound to. NULL for every internal channel. */
  linked_contact_id: string | null;
}

export type DiscussChannelInsert = Omit<
  DiscussChannelRow,
  "id" | "created_at" | "updated_at" | "archived_at" | "last_message_at"
> & {
  id?: string;
  last_message_at?: string;
};

export type DiscussChannelUpdate = Partial<
  Omit<DiscussChannelRow, "id" | "created_at">
>;

export type DiscussMemberRole = "admin" | "member" | "guest";
export type DiscussNotificationPref = "all" | "mentions" | "none";

export interface DiscussMemberRow {
  id: string;
  channel_id: string;
  account_id: string;
  role: DiscussMemberRole;
  last_read_at: string;
  notification_pref: DiscussNotificationPref;
  muted: boolean;
  joined_at: string;
  left_at: string | null;
}

export type DiscussMemberInsert = Omit<
  DiscussMemberRow,
  "id" | "joined_at" | "last_read_at" | "left_at"
> & {
  last_read_at?: string;
  notification_pref?: DiscussNotificationPref;
  muted?: boolean;
};

export type DiscussMemberUpdate = Partial<
  Omit<DiscussMemberRow, "id" | "channel_id" | "account_id">
>;

export type DiscussMessageKind = "text" | "image" | "file" | "voice" | "system";

/** Structured attachment record stored in `discuss_messages.metadata.attachments`.
 *  Mirrors InboxAttachment shape so we can share picker UI components. */
export interface DiscussAttachment {
  name: string;
  url: string;
  file_path: string;
  size: number;
  type: string;
}

/** Product reference stored in `discuss_messages.metadata.products`.
 *  Same shape as InboxProductRef — keeps rendering components reusable. */
export interface DiscussProductRef {
  id: string;
  name: string;
  slug: string;
  image: string | null;
}

/** Mention record stored in `discuss_messages.metadata.mentions`.
 *  `offset` + `length` let us highlight the mention span inside the
 *  rendered body without re-parsing markdown on every render. */
export interface DiscussMention {
  account_id: string;
  username: string;
  offset: number;
  length: number;
}

/** Voice-note payload stored in `discuss_messages.metadata.voice`.
 *  `waveform` is a downsampled amplitude array (usually 48–64 bars)
 *  rendered as a mini visualizer next to the play button. */
export interface DiscussVoiceMeta {
  url: string;
  duration_ms: number;
  waveform: number[];
}

/** Unfurled OpenGraph preview stored in `discuss_messages.metadata.link_preview`. */
export interface DiscussLinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
}

/** Strongly-typed view over the JSONB `metadata` column. All fields are
 *  optional because any given message will only carry the subset
 *  relevant to its kind — a text message never has `voice`, an image
 *  message might not have `products`, etc. */
export interface DiscussMessageMetadata {
  attachments?: DiscussAttachment[];
  products?: DiscussProductRef[];
  mentions?: DiscussMention[];
  voice?: DiscussVoiceMeta;
  link_preview?: DiscussLinkPreview;
  [key: string]: unknown;
}

export interface DiscussMessageRow {
  id: string;
  channel_id: string;
  author_account_id: string | null;
  reply_to_message_id: string | null;
  kind: DiscussMessageKind;
  body: string | null;
  body_html: string | null;
  metadata: DiscussMessageMetadata;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export type DiscussMessageInsert = Omit<
  DiscussMessageRow,
  "id" | "created_at" | "edited_at" | "deleted_at" | "body_html"
> & {
  body_html?: string | null;
  metadata?: DiscussMessageMetadata;
};

export type DiscussMessageUpdate = Partial<
  Omit<DiscussMessageRow, "id" | "channel_id" | "created_at">
>;

export interface DiscussReactionRow {
  id: string;
  message_id: string;
  account_id: string;
  emoji: string;
  created_at: string;
}

export type DiscussReactionInsert = Omit<DiscussReactionRow, "id" | "created_at">;

export interface DiscussPinnedRow {
  id: string;
  channel_id: string;
  message_id: string;
  pinned_by: string | null;
  pinned_at: string;
}

export type DiscussPinnedInsert = Omit<DiscussPinnedRow, "id" | "pinned_at">;

export interface DiscussStarredRow {
  id: string;
  account_id: string;
  message_id: string;
  starred_at: string;
}

export type DiscussStarredInsert = Omit<DiscussStarredRow, "id" | "starred_at">;

export interface DiscussDraftRow {
  id: string;
  account_id: string;
  channel_id: string;
  body: string;
  metadata: DiscussMessageMetadata;
  updated_at: string;
}

export type DiscussDraftInsert = Omit<DiscussDraftRow, "id" | "updated_at">;
export type DiscussDraftUpdate = Partial<Omit<DiscussDraftRow, "id" | "account_id" | "channel_id">>;

/* ── Joined / denormalized view types ───────────────────────────── */

/** Short author block attached to a message for render. Matches the
 *  InboxMessageWithSender.sender shape so the same avatar helpers work. */
export interface DiscussAuthor {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
}

/** Compact preview of a replied-to message, embedded inside a
 *  DiscussMessageWithAuthor when `reply_to_message_id` is populated.
 *  We denormalize the author username + a trimmed body snippet so
 *  the bubble can render the "Replying to X" header without a second
 *  round-trip fetch. */
export interface DiscussReplyPreview {
  id: string;
  body: string | null;
  author_username: string | null;
  author_full_name: string | null;
  kind: DiscussMessageKind;
  deleted_at: string | null;
}

export interface DiscussMessageWithAuthor extends DiscussMessageRow {
  author: DiscussAuthor | null;
  /** Aggregated reactions, grouped by emoji, populated by the data
   *  layer when fetching a message. The UI never groups raw rows. */
  reactions: Array<{
    emoji: string;
    count: number;
    account_ids: string[];
    reacted_by_me: boolean;
  }>;
  /** Populated when the message is a reply-with-quote. */
  reply_preview?: DiscussReplyPreview | null;
  /** Populated when the message has a thread of replies.
   *  Lightweight — just the count and latest reply timestamp so the
   *  "X replies" chip can render without loading the thread itself. */
  thread?: {
    reply_count: number;
    last_reply_at: string | null;
    participant_ids: string[];
  } | null;
}

/** Lightweight CRM contact block attached to a customer-chat channel.
 *  Populated in the sidebar + details pane so we can render the
 *  customer's name, company, and avatar without a second query. */
export interface DiscussLinkedContact {
  id: string;
  display_name: string;
  full_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  contact_type: string | null;
}

/** Sidebar channel row — enriched with the current user's read state,
 *  the other member (for DMs), and a snippet of the last message so
 *  the list looks like Slack/WhatsApp right out of the box. */
export interface DiscussChannelWithState extends DiscussChannelRow {
  unread_count: number;
  last_read_at: string | null;
  muted: boolean;
  notification_pref: DiscussNotificationPref;
  /** For direct channels, the OTHER account (not the current user).
   *  Null for group/channel kinds. */
  other: DiscussAuthor | null;
  /** For customer-chat channels, the linked CRM contact. NULL for
   *  every internal channel. */
  linked_contact: DiscussLinkedContact | null;
  /** Short preview of the most recent message. */
  last_message: {
    id: string;
    body: string | null;
    kind: DiscussMessageKind;
    author_username: string | null;
    created_at: string;
  } | null;
  /** True when the current user has a non-empty draft saved for
   *  this channel — surfaced so the sidebar can show a draft badge
   *  and the Drafts section can pull it straight from the sidebar
   *  query without a second round-trip. */
  has_draft?: boolean;
}

/** Row returned by the full-text search RPC — a message plus the
 *  channel it lives in so the search panel can group results. */
export interface DiscussSearchResult {
  message_id: string;
  channel_id: string;
  channel_name: string | null;
  channel_kind: DiscussChannelKind;
  author_username: string | null;
  author_full_name: string | null;
  author_avatar_url: string | null;
  body: string | null;
  /** ts_headline()-highlighted snippet with <mark> tags. */
  snippet: string;
  created_at: string;
  rank: number;
}

/* ── Database schema type for createClient<Database> ── */

export interface Database {
  public: {
    Tables: {
      pages: {
        Row: PageRow;
        Insert: PageInsert;
        Update: PageUpdate;
      };
      sections: {
        Row: SectionRow;
        Insert: SectionInsert;
        Update: SectionUpdate;
      };
      media: {
        Row: MediaRow;
        Insert: MediaInsert;
        Update: Partial<MediaInsert>;
      };
      divisions: {
        Row: DivisionRow;
        Insert: Omit<DivisionRow, "id" | "created_at">;
        Update: Partial<Omit<DivisionRow, "id" | "created_at">>;
      };
      categories: {
        Row: CategoryRow;
        Insert: Omit<CategoryRow, "id" | "created_at">;
        Update: Partial<Omit<CategoryRow, "id" | "created_at">>;
      };
      subcategories: {
        Row: SubcategoryRow;
        Insert: Omit<SubcategoryRow, "id" | "created_at">;
        Update: Partial<Omit<SubcategoryRow, "id" | "created_at">>;
      };
      products: {
        Row: ProductRow;
        Insert: ProductInsert;
        Update: Partial<ProductInsert>;
      };
      product_models: {
        Row: ProductModelRow;
        Insert: ProductModelInsert;
        Update: Partial<ProductModelInsert>;
      };
      product_media: {
        Row: ProductMediaRow;
        Insert: ProductMediaInsert;
        Update: Partial<ProductMediaInsert>;
      };
      product_translations: {
        Row: ProductTranslationRow;
        Insert: ProductTranslationInsert;
        Update: Partial<ProductTranslationInsert>;
      };
      model_translations: {
        Row: ModelTranslationRow;
        Insert: ModelTranslationInsert;
        Update: Partial<ModelTranslationInsert>;
      };
      product_market_prices: {
        Row: ProductMarketPriceRow;
        Insert: ProductMarketPriceInsert;
        Update: Partial<ProductMarketPriceInsert>;
      };
      related_products: {
        Row: RelatedProductRow;
        Insert: RelatedProductRow;
        Update: Partial<RelatedProductRow>;
      };
      product_sewing_specs: {
        Row: SewingMachineSpecsRow;
        Insert: SewingMachineSpecsInsert;
        Update: Partial<SewingMachineSpecsInsert>;
      };
      companies: {
        Row: CompanyRow;
        Insert: CompanyInsert;
        Update: CompanyUpdate;
      };
      roles: {
        Row: RoleRow;
        Insert: RoleInsert;
        Update: Partial<RoleInsert>;
      };
      people: {
        Row: PersonRow;
        Insert: PersonInsert;
        Update: PersonUpdate;
      };
      accounts: {
        Row: AccountRow;
        Insert: AccountInsert;
        Update: AccountUpdate;
      };
      koleex_employees: {
        Row: EmployeeRow;
        Insert: EmployeeInsert;
        Update: EmployeeUpdate;
      };
      access_presets: {
        Row: AccessPresetRow;
        Insert: AccessPresetInsert;
        Update: AccessPresetUpdate;
      };
      account_permission_overrides: {
        Row: AccountPermissionOverrideRow;
        Insert: AccountPermissionOverrideInsert;
        Update: AccountPermissionOverrideUpdate;
      };
      koleex_calendar_events: {
        Row: CalendarEventRow;
        Insert: CalendarEventInsert;
        Update: CalendarEventUpdate;
      };
      account_api_keys: {
        Row: ApiKeyRow;
        Insert: ApiKeyInsert;
        Update: ApiKeyUpdate;
      };
      account_sessions: {
        Row: AccountSessionRow;
        Insert: AccountSessionInsert;
        Update: AccountSessionUpdate;
      };
      account_login_history: {
        Row: LoginHistoryRow;
        Insert: LoginHistoryInsert;
        Update: Partial<LoginHistoryInsert>;
      };
      membership_requests: {
        Row: MembershipRequestRow;
        Insert: MembershipRequestInsert;
        Update: MembershipRequestUpdate;
      };
      inbox_messages: {
        Row: InboxMessageRow;
        Insert: InboxMessageInsert;
        Update: InboxMessageUpdate;
      };
      mail_connections: {
        Row: MailConnectionRow;
        Insert: MailConnectionInsert;
        Update: MailConnectionUpdate;
      };
      discuss_channels: {
        Row: DiscussChannelRow;
        Insert: DiscussChannelInsert;
        Update: DiscussChannelUpdate;
      };
      discuss_members: {
        Row: DiscussMemberRow;
        Insert: DiscussMemberInsert;
        Update: DiscussMemberUpdate;
      };
      discuss_messages: {
        Row: DiscussMessageRow;
        Insert: DiscussMessageInsert;
        Update: DiscussMessageUpdate;
      };
      discuss_reactions: {
        Row: DiscussReactionRow;
        Insert: DiscussReactionInsert;
        Update: Partial<DiscussReactionInsert>;
      };
      discuss_pinned: {
        Row: DiscussPinnedRow;
        Insert: DiscussPinnedInsert;
        Update: Partial<DiscussPinnedInsert>;
      };
      discuss_starred: {
        Row: DiscussStarredRow;
        Insert: DiscussStarredInsert;
        Update: Partial<DiscussStarredInsert>;
      };
      discuss_drafts: {
        Row: DiscussDraftRow;
        Insert: DiscussDraftInsert;
        Update: DiscussDraftUpdate;
      };
      crm_stages: {
        Row: CrmStageRow;
        Insert: CrmStageInsert;
        Update: CrmStageUpdate;
      };
      crm_opportunities: {
        Row: CrmOpportunityRow;
        Insert: CrmOpportunityInsert;
        Update: CrmOpportunityUpdate;
      };
      crm_activities: {
        Row: CrmActivityRow;
        Insert: CrmActivityInsert;
        Update: CrmActivityUpdate;
      };
    };
  };
}

/* ─── CRM ─────────────────────────────────────────────────────────────── */

/** A column in the CRM pipeline kanban. Sorted by `sequence`; `is_won`
 *  flags the terminal won column; `fold` collapses the column. */
export interface CrmStageRow {
  id: string;
  name: string;
  sequence: number;
  is_won: boolean;
  fold: boolean;
  created_at: string;
}
export type CrmStageInsert = Omit<CrmStageRow, "id" | "created_at"> & {
  id?: string;
};
export type CrmStageUpdate = Partial<CrmStageInsert>;

/** A single deal moving through the pipeline. Mirrors Odoo's
 *  crm.lead model — both leads (unqualified) and opportunities live in
 *  the same table, distinguished by stage. `contact_id` links to the
 *  shared contacts book; `company_name` / `contact_name` are
 *  denormalized so brand-new prospects can be created without first
 *  going through the contacts app. */
export interface CrmOpportunityRow {
  id: string;
  name: string;
  description: string | null;
  stage_id: string | null;

  contact_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;

  expected_revenue: number;
  probability: number;
  expected_close_date: string | null;

  priority: number;
  source: string | null;
  tags: string[];
  color: number;

  owner_account_id: string | null;

  lost_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  archived_at: string | null;

  created_at: string;
  updated_at: string;
}
export type CrmOpportunityInsert = Omit<
  CrmOpportunityRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
};
export type CrmOpportunityUpdate = Partial<CrmOpportunityInsert>;

/** Lightweight to-do attached to an opportunity. Type drives the icon
 *  the CRM card renders next to the activity row. */
export type CrmActivityType = "call" | "meeting" | "task" | "email" | "note";

export interface CrmActivityRow {
  id: string;
  opportunity_id: string;
  type: CrmActivityType;
  title: string;
  notes: string | null;
  due_at: string | null;
  done_at: string | null;
  assignee_account_id: string | null;
  created_by_account_id: string | null;
  created_at: string;
}
export type CrmActivityInsert = Omit<CrmActivityRow, "id" | "created_at"> & {
  id?: string;
};
export type CrmActivityUpdate = Partial<CrmActivityInsert>;

/** Opportunity row enriched with the related stage / contact / owner /
 *  next-activity data the UI needs to render a card without a second
 *  round-trip. The data layer in `lib/crm.ts` builds this. */
export interface CrmOpportunityWithRelations extends CrmOpportunityRow {
  stage: CrmStageRow | null;
  owner: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  contact: {
    id: string;
    display_name: string;
    company: string | null;
    country: string | null;
    country_code: string | null;
  } | null;
  next_activity: CrmActivityRow | null;
  activities_overdue: number;
  activities_pending: number;
}
