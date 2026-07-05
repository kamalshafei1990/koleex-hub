"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import ImportSupplierFromCatalog from "@/components/contacts/ImportSupplierFromCatalog";
import SquareLogoCropper from "@/components/contacts/SquareLogoCropper";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import Edit3Icon from "@/components/icons/ui/Edit3Icon";
import DiskIcon from "@/components/icons/ui/DiskIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import CatalogsIcon from "@/components/icons/CatalogsIcon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import UserIcon from "@/components/icons/ui/UserIcon";
import CrownIcon from "@/components/icons/ui/CrownIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import MinusIcon from "@/components/icons/ui/MinusIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import HeartIcon from "@/components/icons/ui/HeartIcon";
import Share2Icon from "@/components/icons/ui/Share2Icon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import GemIcon from "@/components/icons/ui/GemIcon";
import AwardIcon from "@/components/icons/ui/AwardIcon";
import CreditCardIcon from "@/components/icons/ui/CreditCardIcon";

import UserCheckIcon from "@/components/icons/ui/UserCheckIcon";
import TrendingUpIcon from "@/components/icons/ui/TrendingUpIcon";
import MapPinnedIcon from "@/components/icons/ui/MapPinnedIcon";
import DollarSignIcon from "@/components/icons/ui/DollarSignIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import ScanLineIcon from "@/components/icons/ui/ScanLineIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import { DIVISIONS, CATEGORIES } from "@/components/knowledge/product-coding/data";
import { taxonomyLogoUrl } from "@/components/knowledge/product-coding/taxonomy-logo";
import { fetchDivisionLogos, fetchCategoryLogos } from "@/lib/products-admin";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import ShipIcon from "@/components/icons/ui/ShipIcon";
import FileCheckIcon from "@/components/icons/ui/FileCheckIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import CalendarPlusIcon from "@/components/icons/ui/CalendarPlusIcon";
import CalendarCheckIcon from "@/components/icons/ui/CalendarCheckIcon";
import ReceiptIcon from "@/components/icons/ui/ReceiptIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import HandCoinsIcon from "@/components/icons/ui/HandCoinsIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import UserCogIcon from "@/components/icons/ui/UserCogIcon";
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import TimerIcon from "@/components/icons/ui/TimerIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import TruckIcon from "@/components/icons/ui/TruckIcon";
import WarehouseIcon from "@/components/icons/ui/WarehouseIcon";
import ClipboardCheckIcon from "@/components/icons/ui/ClipboardCheckIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import LandmarkIcon from "@/components/icons/ui/LandmarkIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import FilePlusIcon from "@/components/icons/ui/FilePlusIcon";
import GraduationCapIcon from "@/components/icons/ui/GraduationCapIcon";
import ShieldExclamationIcon from "@/components/icons/ui/ShieldExclamationIcon";
import PlaneIcon from "@/components/icons/ui/PlaneIcon";
import HomeIcon from "@/components/icons/ui/HomeIcon";
import HelpCircleIcon from "@/components/icons/ui/HelpCircleIcon";
import ContactsIcon from "@/components/icons/ContactsIcon";
import CustomersIcon from "@/components/icons/CustomersIcon";
import SuppliersIcon from "@/components/icons/SuppliersIcon";

import {
  checkContactsSetup, fetchContacts, fetchContactsByType, fetchContactAvatars, createContact, updateContact, deleteContact,
  type ContactRow,
} from "@/lib/contacts-admin";
import { fetchOpportunities } from "@/lib/crm";
import { humanizeError } from "@/lib/ui/humanize-error";
import { STRATEGIC_STATUS_LABELS, CLASSIFICATION_LABELS, FACTORY_TYPE_LABELS, strategicStatusTone } from "@/lib/suppliers/intelligence";
import { findSupplierDuplicates, type DupMatch } from "@/lib/contacts/duplicate-match";
import { countryNameLocalized, provinceNameLocalized, cityNameLocalized, chinaCitiesForState } from "@/lib/geo/localize";
import { divisionNameLocalized, categoryNameLocalized } from "@/lib/geo/taxonomy-cn";
import { kxInspectAttrs } from "@/lib/qa/inspector";
import { useScopeContext } from "@/lib/use-scope";
import type { CrmOpportunityWithRelations } from "@/types/supabase";
import { Country, State, City } from "country-state-city";
import { useTranslation } from "@/lib/i18n";
import { contactsT } from "@/lib/translations/contacts";
import EntityPlanningStrip from "@/components/planning/EntityPlanningStrip";
import EntityTasksStrip from "@/components/projects/EntityTasksStrip";
import EntityInvoicesStrip from "@/components/invoices/EntityInvoicesStrip";
import ProfileCompletenessBar from "@/components/ui/ProfileCompletenessBar";
import GuidanceTip from "@/components/ui/GuidanceTip";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import SupplierDetail from "@/components/suppliers/SupplierDetail";
import AddressAutocomplete from "@/components/suppliers/AddressAutocomplete";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type ContactType = "customer" | "supplier" | "company" | "people";
type CustomerTier = "end_user" | "silver" | "gold" | "platinum" | "diamond";
type ViewMode = "list" | "detail" | "form";

interface PhoneEntry { label: string; number: string }
interface EmailEntry { label: string; email: string }
interface AddressEntry { label: string; street: string; city: string; state: string; zip: string; country: string }
interface WebsiteEntry { label: string; url: string }
interface SocialProfile { platform: string; username: string; url: string; qr_code_url: string }
interface FamilyMember {
  relationship: string; title: string; first_name: string; middle_name: string;
  last_name: string; phone: string; email: string; birthday: string; notes: string; photo_url: string;
}
interface RelatedName { name: string; relationship: string }
interface CustomField { field_name: string; field_value: string }
interface Attachment { name: string; url: string; type: string; uploaded_at: string }

interface ResumeLineEntry {
  type: "experience" | "education" | "training" | "certification";
  title: string;
  duration_start: string;
  duration_end: string;
  is_forever: boolean;
  certificate_url: string;
  certificate_name: string;
  notes: string;
  course_type: string;
  external_url: string;
}

interface EmergencyContactEntry {
  contact: string;
  phone: string;
}

interface VisaDocEntry {
  name: string;
  url: string;
  type: string;
  uploaded_at: string;
}

export interface ContactForm {
  contact_type: ContactType;
  entity_type: "person" | "company" | "";
  photo_url: string;
  title: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  company: string;
  position: string;
  country: string;
  country_code: string;
  province: string;
  province_code: string;
  city: string;
  birthday: string;
  notes: string;
  is_active: boolean;
  customer_type: CustomerTier | "";
  phones: PhoneEntry[];
  emails: EmailEntry[];
  addresses: AddressEntry[];
  websites: WebsiteEntry[];
  social_profiles: SocialProfile[];
  family_members: FamilyMember[];
  related_names: RelatedName[];
  custom_fields: CustomField[];
  business_card_front: string;
  business_card_back: string;
  /* ── Financial & Business ── */
  total_revenue: string;
  last_order_date: string;
  payment_terms: string;
  credit_limit: string;
  outstanding_balance: string;
  currency: string;
  /* ── Classification & Segmentation ── */
  industry: string;
  source: string;
  tags: string[];
  account_manager: string;
  /* ── Relationship & Activity ── */
  first_contact_date: string;
  last_contacted: string;
  follow_up_date: string;
  communication_preference: string;
  language: string;
  /* ── Trade-Specific ── */
  shipping_addresses: AddressEntry[];
  preferred_shipping: string;
  tax_id: string;
  incoterms: string;
  /* ── Documents ── */
  attachments: Attachment[];
  /* ── Commercial Profile (Customer Premium) ── */
  market_band: string;
  commercial_role: string;
  territory: string;
  exclusivity: string;
  exclusivity_scope: string;
  exclusivity_expiry: string;
  backup_account_manager: string;
  assigned_branch: string;
  source_details: string;
  referred_by: string;
  customer_level_assigned_date: string;
  customer_level_review_date: string;
  sales_rep: string;
  /* ── Credit Management (Customer Premium) ── */
  credit_rating_internal: string;
  credit_rating_external: string;
  credit_limit_approved_by: string;
  credit_limit_approved_date: string;
  overdue_balance: string;
  days_sales_outstanding: string;
  credit_insurance_covered: boolean;
  credit_insurance_provider: string;
  credit_insurance_coverage: string;
  preferred_payment_method: string;
  max_discount_allowed: string;
  price_list_tier: string;
  special_pricing_agreement: boolean;
  contract_pricing_expiry: string;
  commission_rate: string;
  /* ── KYC & Compliance ── */
  kyc_status: string;
  kyc_verified_date: string;
  kyc_verified_by: string;
  kyc_review_due_date: string;
  risk_score: string;
  sanctions_check_status: string;
  sanctions_check_date: string;
  pep_status: boolean;
  high_risk_country: boolean;
  aml_status: string;
  business_registration_number: string;
  registration_country: string;
  registration_date: string;
  year_established: string;
  company_type: string;
  trading_name: string;
  employee_count_range: string;
  annual_revenue_range: string;
  /* ── International Trade IDs ── */
  eori_number: string;
  duns_number: string;
  importer_exporter_code: string;
  customs_code: string;
  gst_number: string;
  cr_number: string;
  /* ── Messaging IDs ── */
  messaging_channels: { platform: string; value: string }[];   // WeChat is the hero; these are the rest
  whatsapp_business: string;
  wechat_id: string;
  telegram_id: string;
  line_id: string;
  skype_id: string;
  wechat_qr: string;
  whatsapp_qr: string;
  telegram_qr: string;
  line_qr: string;
  skype_qr: string;
  qq_id: string;
  qq_qr: string;
  dingtalk_id: string;
  dingtalk_qr: string;
  messenger_id: string;
  messenger_qr: string;
  /* ── Segmentation extras ── */
  sub_industry: string;
  buying_behavior: string;
  price_sensitivity: string;
  quality_sensitivity: string;
  customer_health_score: string;
  nps_score: string;
  churn_risk: string;
  vip_status: boolean;
  strategic_account: boolean;
  relationship_stage: string;
  support_tier: string;
  /* ── Trade & Shipping extras ── */
  port_of_entry: string;
  preferred_carriers: string[];
  customs_broker: string;
  freight_forwarder: string;
  shipping_marks: string;
  container_preference: string;
  certifications_required: string[];
  labeling_requirements: string;
  hs_codes: string[];
  /* ── Notes & audit extras ── */
  internal_notes: string;
  flags: string[];
  /* ── Supplier-Specific ── */
  supplier_type: string;
  product_categories: string[];
  brand_names: string[];
  moq: string;
  lead_time: string;
  backup_supplier_name: string;
  total_purchases: string;
  origin_country: string;
  origin_country_code: string;
  certifications: string[];
  rating: number;
  reliability_score: string;
  quality_notes: string;
  last_quality_issue: string;
  quality_issues: { date: string; note: string }[];
  sample_status: string;
  factory_visit_date: string;
  /* ── Sidebar mini-intelligence (read-only, already on the contacts row) ── */
  strategic_status: string;
  readiness_milestone: number;
  /* ── Supplier Redesign ── */
  company_name_en: string;
  company_name_cn: string;
  additional_company_names: { language: string; name: string }[];
  supplier_tel: string;
  supplier_mobile: string;
  supplier_email: string;
  supplier_website: string;
  supplier_website_qr: string;
  supplier_profile_url: string;
  ecatalog_url: string;
  ecatalog_qr: string;
  business_timezone: string;
  business_hours_start: string;
  business_hours_end: string;
  wechat_official_account: string;
  wechat_official_account_qr: string;
  wechat_sales_group_available: boolean;
  wechat_group_name: string;
  wechat_group_members: string;
  wecom_support_available: boolean;
  supplier_address: string;
  supplier_address_cn: string;
  supplier_postal_code: string;
  division: string;
  category: string;
  catalogues: { name: string; url: string; type: string; uploaded_at: string; cover_url?: string; cover_path?: string; storage_path?: string }[];
  documents: { doc_name: string; name: string; url: string; type: string; uploaded_at: string }[];
  contact_persons: { name: string; name_cn?: string; position: string; department: string; phone: string; mobile: string; email: string; notes: string; whatsapp?: string; wechat_id?: string; wechat_qr?: string; role_category?: string; is_decision_maker?: boolean; is_primary?: boolean; telegram?: string; wecom_id?: string; line_id?: string; skype_id?: string; preferred_channel?: string; preferred_language?: string; timezone?: string; available_hours?: string; reliability?: string; response_speed?: string; id_image?: string }[];
  bank_accounts: { bank_name: string; account_name: string; account_number: string; swift_code: string; iban: string; branch: string; currency: string; info_image?: string }[];
  payment_info: string;
  /* ── Mobile payment (China) — handle/account + QR image ── */
  wechat_pay_id: string;
  wechat_pay_qr: string;
  alipay_id: string;
  alipay_qr: string;
  /* ── Employee-Specific ── */
  work_email: string;
  work_tel: string;
  work_mobile: string;
  management: string;
  department: string;
  job_position: string;
  job_title: string;
  manager: string;
  work_address: string;
  work_location: string;
  resume_lines: ResumeLineEntry[];
  private_email: string;
  private_phone: string;
  employee_bank_account: string;
  legal_name: string;
  business_license_image: string;
  place_of_birth: string;
  gender: string;
  emergency_contacts: EmergencyContactEntry[];
  visa_no: string;
  work_permit: string;
  visa_documents: VisaDocEntry[];
  nationality: string;
  nationality_code: string;
  id_no: string;
  ssn_no: string;
  passport_no: string;
  private_address: string;
  home_work_distance: string;
  marital_status: string;
  number_of_children: string;
  certificate_level: string;
  field_of_study: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const CONTACT_TYPES: { value: ContactType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "customer", label: "Customer", icon: <CrownIcon size={16} />, color: "text-amber-400" },
  { value: "supplier", label: "Supplier", icon: <Building2Icon size={16} />, color: "text-blue-400" },
  { value: "company", label: "Company", icon: <BriefcaseIcon size={16} />, color: "text-purple-400" },
  { value: "people", label: "People", icon: <UserIcon size={16} />, color: "text-green-400" },
];

const CUSTOMER_TIERS: { value: CustomerTier; label: string; color: string; bg: string }[] = [
  { value: "end_user", label: "End User", color: "text-zinc-300", bg: "bg-zinc-700" },
  { value: "silver", label: "Silver", color: "text-slate-300", bg: "bg-slate-600" },
  { value: "gold", label: "Gold", color: "text-amber-300", bg: "bg-amber-700/60" },
  { value: "platinum", label: "Platinum", color: "text-cyan-200", bg: "bg-cyan-800/50" },
  { value: "diamond", label: "Diamond", color: "text-violet-200", bg: "bg-violet-700/50" },
];

const TITLES = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Eng.", "Sheikh", "H.E."];

const PHONE_LABELS = ["mobile", "home", "work", "main", "work fax", "home fax", "pager", "other"];
const EMAIL_LABELS = ["home", "work", "iCloud", "other"];
const ADDRESS_LABELS = ["home", "work", "other"];
const WEBSITE_LABELS = ["homepage", "work", "blog", "other"];
const SOCIAL_PLATFORMS = ["WhatsApp", "WeChat", "LinkedIn", "Instagram", "Facebook", "Twitter/X", "Telegram", "Snapchat", "TikTok", "Other"];
/* Comprehensive social-media + B2B-marketplace list for the supplier Social Media section. */
const SOCIAL_MEDIA_PLATFORMS = [
  "LinkedIn", "Facebook", "Instagram", "Twitter/X", "YouTube", "TikTok", "Pinterest",
  "Threads", "Reddit", "Snapchat", "Weibo", "Douyin", "Xiaohongshu (RED)", "Bilibili",
  "Alibaba", "Made-in-China", "Global Sources", "1688", "Website / Blog", "Other",
];
/* Messaging apps for the supplier Messaging IDs repeater (WeChat is the hero, shown separately).
   Order = most common for China sourcing first. Apps with a dedicated contacts
   column derive back to it on save so the Supplier 360 channel grid keeps showing them. */
const MESSAGING_APPS = [
  "WhatsApp", "Telegram", "QQ", "DingTalk", "Messenger", "Line", "Skype",
  "Viber", "Signal", "KakaoTalk", "Other",
];
const RELATED_PEOPLE_LABELS = ["Parent", "Father", "Mother", "Brother", "Sister", "Child", "Son", "Daughter", "Spouse", "Friend", "Assistant", "Manager", "Other"];

const INDUSTRIES = [
  "Agriculture", "Automotive", "Banking & Finance", "Chemicals", "Construction",
  "Consumer Goods", "E-Commerce", "Education", "Electronics", "Energy & Utilities",
  "F&B", "Fashion & Apparel", "Healthcare", "Hospitality", "IT & Technology",
  "Logistics & Transport", "Manufacturing", "Media & Entertainment", "Mining",
  "Oil & Gas", "Pharmaceuticals", "Real Estate", "Retail", "Telecom", "Other",
];
const LEAD_SOURCES = [
  "Referral", "Website", "Exhibition / Trade Show", "Cold Call", "Social Media",
  "Email Campaign", "LinkedIn", "Partner", "Walk-in", "Advertisement", "Other",
];
const PAYMENT_TERMS_OPTIONS = [
  "Prepaid", "COD", "Net 15", "Net 30", "Net 45", "Net 60", "Net 90",
  "EOM", "2/10 Net 30", "CIA", "CWO", "Upon Receipt",
  "T/T", "L/C", "D/P", "D/A", "Custom",
];
const CURRENCIES = [
  "USD", "EUR", "GBP", "CNY", "JPY", "AED", "SAR", "EGP", "INR", "BRL",
  "AUD", "CAD", "CHF", "KRW", "SGD", "MYR", "THB", "IDR", "PHP", "VND",
  "TRY", "RUB", "ZAR", "NGN", "KES", "MXN", "COP", "ARS", "CLP", "PEN",
];
const SHIPPING_METHODS = ["Sea Freight", "Air Freight", "Land / Truck", "Express / Courier", "Rail", "Multimodal", "Other"];
const INCOTERMS_OPTIONS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const COMM_PREFERENCES = ["Phone", "Email", "WhatsApp", "WeChat", "Telegram", "SMS", "In-Person", "Video Call"];
const LANGUAGES = [
  "English", "Arabic", "Chinese (Mandarin)", "Chinese (Cantonese)", "Spanish", "French",
  "German", "Portuguese", "Russian", "Japanese", "Korean", "Hindi", "Turkish",
  "Italian", "Dutch", "Thai", "Vietnamese", "Indonesian", "Malay", "Tagalog",
];

/* Supplier "type" is no longer a standalone field — it is the PRIMARY
   classification (see the Classifications section + supplier_classifications
   table). The legacy contacts.supplier_type column is kept in sync by the
   /api/suppliers/[id]/classifications mirror, so no SUPPLIER_TYPES list is
   needed here anymore. */
const SUPPLIER_SOURCES = [
  "Alibaba", "Made-in-China", "Global Sources", "Exhibition / Trade Show",
  "Referral", "Website", "LinkedIn", "Cold Call", "Partner", "Agent", "Other",
];
const SAMPLE_STATUSES = ["None", "Requested", "Received", "Approved", "Rejected"];
const CERTIFICATIONS_LIST = [
  "ISO 9001", "ISO 14001", "ISO 45001", "CE", "FDA", "BSCI", "SEDEX",
  "SA8000", "GMP", "HACCP", "UL", "RoHS", "REACH", "FSC", "GOTS", "Other",
];

/** Countries where Province/State is commonly used in addresses */
const COUNTRIES_WITH_STATES = new Set([
  "US", "CA", "AU", "IN", "BR", "MX", "CN", "JP", "RU", "AR", "CL",
  "CO", "VE", "PE", "NG", "ZA", "MY", "ID", "PH", "TH", "KR", "MM",
  "PK", "BD", "VN", "DE", "AT", "CH", "IT", "ES", "NL", "BE", "AE",
  "SA", "IR", "IQ", "TR", "UA", "PL", "RO", "CZ", "SE", "NO", "FI",
  "NZ", "KE", "TZ", "ET", "GH",
]);

/* ═══════════════════════════════════════════════════════════════════════════
   CUSTOMER PREMIUM CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Customer tab identifiers for the premium tabbed form/detail layout */
type CustomerTab = "overview" | "commercial" | "financial" | "compliance" | "trade" | "activity";

const CUSTOMER_TABS: { id: CustomerTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview",   label: "Overview",   icon: <UserIcon size={14} /> },
  { id: "commercial", label: "Commercial", icon: <BriefcaseIcon size={14} /> },
  { id: "financial",  label: "Financial",  icon: <DollarSignIcon size={14} /> },
  { id: "compliance", label: "Compliance", icon: <ShieldCheckIcon size={14} /> },
  { id: "trade",      label: "Trade",      icon: <ShipIcon size={14} /> },
  { id: "activity",   label: "Activity",   icon: <ClockIcon size={14} /> },
];

const MARKET_BANDS = ["A", "B", "C", "D"];
const COMMERCIAL_ROLES = ["Importer", "Distributor", "Wholesaler", "Retailer", "End User", "Agent", "Reseller"];
const EXCLUSIVITY_LEVELS = ["None", "Non-Exclusive", "Exclusive"];
const EXCLUSIVITY_SCOPES = ["Country", "Region", "Product Line", "Full Territory"];
const COMPANY_TYPES = ["LLC", "Ltd", "Corp", "GmbH", "S.A.", "Sole Proprietorship", "Partnership", "Branch", "Other"];
const EMPLOYEE_COUNT_RANGES = ["1–10", "11–50", "51–200", "201–500", "501–1,000", "1,001–5,000", "5,000+"];
const ANNUAL_REVENUE_RANGES = ["<$1M", "$1M–$10M", "$10M–$50M", "$50M–$100M", "$100M–$500M", "$500M–$1B", "$1B+"];

const KYC_STATUSES = ["Pending", "Verified", "Flagged", "Expired"];
const SANCTIONS_STATUSES = ["Clear", "Flagged", "Pending"];
const CREDIT_RATING_INTERNAL = ["A", "B", "C", "D"];

const PREFERRED_PAYMENT_METHODS = ["Wire Transfer", "LC (Letter of Credit)", "Documentary Collection", "Check", "Credit Card", "Cash", "Cryptocurrency"];
const PRICE_LIST_TIERS = ["Diamond", "Platinum", "Gold", "Silver", "End User", "Custom"];

const BUYING_BEHAVIORS = ["Frequent", "Seasonal", "Project-based", "One-time"];
const SENSITIVITY_LEVELS = ["Low", "Medium", "High"];
const CHURN_RISK_LEVELS = ["Low", "Medium", "High"];
const RELATIONSHIP_STAGES = ["Prospect", "Lead", "Active", "Dormant", "Churned", "Won-back"];
const SUPPORT_TIERS = ["Basic", "Standard", "Premium", "Enterprise"];

const CONTAINER_PREFERENCES = ["20ft", "40ft", "40HQ", "LCL", "FCL"];

/* Editable presets for combo fields (Input list=). The user can pick one OR
   type their own value — these are only suggestions, never a hard constraint. */
const LEAD_TIME_OPTS = ["In stock", "7 days", "10 days", "15 days", "20 days", "30 days", "45 days", "60 days", "90 days", "120 days"];
const MOQ_OPTS = ["1", "10", "20", "50", "100", "200", "500", "1000", "2000", "5000", "Negotiable"];
/* Time zone presets carry the city/area alongside the GMT offset so the field
   "mentions the area with the time" while staying free-text editable. */
const TIMEZONE_OPTS = [
  "Asia/Shanghai (GMT+8) · Shanghai / Beijing",
  "Asia/Shenzhen (GMT+8) · Shenzhen / Guangzhou",
  "Asia/Hong_Kong (GMT+8) · Hong Kong",
  "Asia/Taipei (GMT+8) · Taipei",
  "Asia/Tokyo (GMT+9) · Tokyo / Osaka",
  "Asia/Seoul (GMT+9) · Seoul",
  "Asia/Bangkok (GMT+7) · Bangkok",
  "Asia/Ho_Chi_Minh (GMT+7) · Ho Chi Minh",
  "Asia/Kolkata (GMT+5:30) · Mumbai / Delhi",
  "Asia/Karachi (GMT+5) · Karachi",
  "Asia/Dubai (GMT+4) · Dubai / Abu Dhabi",
  "Asia/Riyadh (GMT+3) · Riyadh / Jeddah",
  "Europe/Istanbul (GMT+3) · Istanbul",
  "Africa/Cairo (GMT+2) · Cairo",
  "Europe/Paris (GMT+1) · Paris / Berlin / Milan",
  "Europe/London (GMT+0) · London",
  "America/New_York (GMT-5) · New York",
  "America/Chicago (GMT-6) · Chicago",
  "America/Los_Angeles (GMT-8) · Los Angeles",
];

/* Tiny helper: a hidden <datalist> so an <Input list={id}> becomes an editable
   dropdown (pick a preset or type a custom value). */
function ComboOptions({ id, options }: { id: string; options: string[] }) {
  return <datalist id={id}>{options.map(o => <option key={o} value={o} />)}</datalist>;
}

/* Multi-value reason field: a status can carry more than one reason. Stored as
   a single " · "-joined string (no schema change) and shown as removable chips
   with an editable add box (pick a common reason or type your own). */
function MultiReasonField({ value, onChange, options, label, placeholder, icon, datalistId }: {
  value: string; onChange: (v: string) => void; options: string[];
  label: string; placeholder?: string; icon?: React.ReactNode; datalistId: string;
}) {
  const reasons = React.useMemo(
    () => (value ? value.split(/\s*·\s*|\n/).map(s => s.trim()).filter(Boolean) : []),
    [value],
  );
  const [draft, setDraft] = React.useState("");
  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || reasons.includes(v)) { setDraft(""); return; }
    onChange([...reasons, v].join(" · "));
    setDraft("");
  };
  const removeAt = (i: number) => onChange(reasons.filter((_, idx) => idx !== i).join(" · "));
  return (
    <div>
      <label className="text-xs text-[var(--text-faint)] mb-1 flex items-center gap-1">{label}</label>
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {reasons.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-color)] px-2 py-1 text-xs text-[var(--text-primary)]">
              {r}
              <button type="button" onClick={() => removeAt(i)} className="text-[var(--text-ghost)] hover:text-rose-500" aria-label="Remove reason">
                <CrossIcon size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative flex gap-1.5">
        <div className="relative flex-1">
          {icon && <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)]">{icon}</span>}
          <input
            list={datalistId}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }}
            onBlur={() => add(draft)}
            placeholder={placeholder}
            className={`w-full h-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors ${icon ? "ps-9 pe-3" : "px-3"}`}
          />
          <datalist id={datalistId}>{options.map(o => <option key={o} value={o} />)}</datalist>
        </div>
        <button type="button" onClick={() => add(draft)} disabled={!draft.trim()} className="shrink-0 px-3 h-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors">
          +
        </button>
      </div>
    </div>
  );
}

/* Common reasons behind a supplier's strategic status — suggestions only; the
   field still accepts free text. */
const STATUS_REASON_SUGGESTIONS = [
  "Consistent quality & on-time delivery",
  "Sole source for a critical component",
  "Long-term strategic partnership",
  "Most competitive pricing",
  "Currently in trial / evaluation",
  "Newly identified — not yet engaged",
  "Pending audit / approval",
  "Repeated quality issues",
  "Late / unreliable deliveries",
  "Failed audit or certification lapse",
  "Compliance / sanctions concern",
  "Pricing no longer competitive",
  "No recent orders / dormant",
  "Being replaced by an alternative supplier",
];

/* Incoterms® 2020 — the full standardized set (any mode + sea/inland waterway). */
const INCOTERMS = [
  "EXW — Ex Works",
  "FCA — Free Carrier",
  "CPT — Carriage Paid To",
  "CIP — Carriage & Insurance Paid To",
  "DAP — Delivered At Place",
  "DPU — Delivered At Place Unloaded",
  "DDP — Delivered Duty Paid",
  "FAS — Free Alongside Ship",
  "FOB — Free On Board",
  "CFR — Cost & Freight",
  "CIF — Cost, Insurance & Freight",
];

export const EMPTY_FORM: ContactForm = {
  contact_type: "customer",
  entity_type: "",
  photo_url: "",
  title: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  company: "",
  position: "",
  country: "",
  country_code: "",
  province: "",
  province_code: "",
  city: "",
  birthday: "",
  notes: "",
  is_active: true,
  customer_type: "",
  phones: [],
  emails: [],
  addresses: [],
  websites: [],
  social_profiles: [],
  family_members: [],
  related_names: [],
  custom_fields: [],
  business_card_front: "",
  business_card_back: "",
  /* Financial & Business */
  total_revenue: "",
  last_order_date: "",
  payment_terms: "",
  credit_limit: "",
  outstanding_balance: "",
  currency: "",
  /* Classification & Segmentation */
  industry: "",
  source: "",
  tags: [],
  account_manager: "",
  /* Relationship & Activity */
  first_contact_date: "",
  last_contacted: "",
  follow_up_date: "",
  communication_preference: "",
  language: "",
  /* Trade-Specific */
  shipping_addresses: [],
  preferred_shipping: "",
  tax_id: "",
  incoterms: "",
  /* Documents */
  attachments: [],
  /* Commercial Profile */
  market_band: "",
  commercial_role: "",
  territory: "",
  exclusivity: "",
  exclusivity_scope: "",
  exclusivity_expiry: "",
  backup_account_manager: "",
  assigned_branch: "",
  source_details: "",
  referred_by: "",
  customer_level_assigned_date: "",
  customer_level_review_date: "",
  sales_rep: "",
  /* Credit Management */
  credit_rating_internal: "",
  credit_rating_external: "",
  credit_limit_approved_by: "",
  credit_limit_approved_date: "",
  overdue_balance: "",
  days_sales_outstanding: "",
  credit_insurance_covered: false,
  credit_insurance_provider: "",
  credit_insurance_coverage: "",
  preferred_payment_method: "",
  max_discount_allowed: "",
  price_list_tier: "",
  special_pricing_agreement: false,
  contract_pricing_expiry: "",
  commission_rate: "",
  /* KYC & Compliance */
  kyc_status: "",
  kyc_verified_date: "",
  kyc_verified_by: "",
  kyc_review_due_date: "",
  risk_score: "",
  sanctions_check_status: "",
  sanctions_check_date: "",
  pep_status: false,
  high_risk_country: false,
  aml_status: "",
  business_registration_number: "",
  registration_country: "",
  registration_date: "",
  year_established: "",
  company_type: "",
  trading_name: "",
  employee_count_range: "",
  annual_revenue_range: "",
  /* International Trade IDs */
  eori_number: "",
  duns_number: "",
  importer_exporter_code: "",
  customs_code: "",
  gst_number: "",
  cr_number: "",
  /* Messaging IDs */
  messaging_channels: [],
  whatsapp_business: "",
  wechat_id: "",
  telegram_id: "",
  line_id: "",
  skype_id: "",
  wechat_qr: "",
  whatsapp_qr: "",
  telegram_qr: "",
  line_qr: "",
  skype_qr: "",
  qq_id: "",
  qq_qr: "",
  dingtalk_id: "",
  dingtalk_qr: "",
  messenger_id: "",
  messenger_qr: "",
  /* Segmentation extras */
  sub_industry: "",
  buying_behavior: "",
  price_sensitivity: "",
  quality_sensitivity: "",
  customer_health_score: "",
  nps_score: "",
  churn_risk: "",
  vip_status: false,
  strategic_account: false,
  relationship_stage: "",
  support_tier: "",
  /* Trade & Shipping extras */
  port_of_entry: "",
  preferred_carriers: [],
  customs_broker: "",
  freight_forwarder: "",
  shipping_marks: "",
  container_preference: "",
  certifications_required: [],
  labeling_requirements: "",
  hs_codes: [],
  /* Notes & audit extras */
  internal_notes: "",
  flags: [],
  /* Supplier-Specific */
  supplier_type: "",
  product_categories: [],
  brand_names: [],
  moq: "",
  lead_time: "",
  backup_supplier_name: "",
  total_purchases: "",
  origin_country: "",
  origin_country_code: "",
  certifications: [],
  rating: 0,
  reliability_score: "",
  quality_notes: "",
  last_quality_issue: "",
  quality_issues: [],
  sample_status: "",
  factory_visit_date: "",
  strategic_status: "",
  readiness_milestone: 0,
  /* Supplier Redesign */
  company_name_en: "",
  company_name_cn: "",
  additional_company_names: [],
  supplier_tel: "",
  supplier_mobile: "",
  supplier_email: "",
  supplier_website: "",
  supplier_website_qr: "",
  supplier_profile_url: "",
  ecatalog_url: "",
  ecatalog_qr: "",
  business_timezone: "",
  business_hours_start: "",
  business_hours_end: "",
  wechat_official_account: "",
  wechat_official_account_qr: "",
  wechat_sales_group_available: false,
  wechat_group_name: "",
  wechat_group_members: "",
  wecom_support_available: false,
  supplier_address: "",
  supplier_address_cn: "",
  supplier_postal_code: "",
  division: "",
  category: "",
  catalogues: [],
  documents: [],
  contact_persons: [],
  bank_accounts: [],
  payment_info: "",
  wechat_pay_id: "",
  wechat_pay_qr: "",
  alipay_id: "",
  alipay_qr: "",
  /* Employee-Specific */
  work_email: "",
  work_tel: "",
  work_mobile: "",
  management: "",
  department: "",
  job_position: "",
  job_title: "",
  manager: "",
  work_address: "",
  work_location: "",
  resume_lines: [],
  private_email: "",
  private_phone: "",
  employee_bank_account: "",
  legal_name: "",
  business_license_image: "",
  place_of_birth: "",
  gender: "",
  emergency_contacts: [],
  visa_no: "",
  work_permit: "",
  visa_documents: [],
  nationality: "",
  nationality_code: "",
  id_no: "",
  ssn_no: "",
  passport_no: "",
  private_address: "",
  home_work_distance: "",
  marital_status: "",
  number_of_children: "",
  certificate_level: "",
  field_of_study: "",
};

const MIGRATION_SQL = `-- Contacts Module Migration for Koleex HUB
-- Run this in Supabase Dashboard > SQL Editor > New Query

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_type text DEFAULT 'people';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS middle_name text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "position" text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS customer_type text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS province_code text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phones jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS emails jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS addresses jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS websites jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS social_profiles jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS family_members jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS related_names jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS business_card_front text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS business_card_back text;
-- Financial & Business
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_revenue text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_order_date date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS credit_limit text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS outstanding_balance text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
-- Classification & Segmentation
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS account_manager text;
-- Relationship & Activity
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_contact_date date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contacted date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS follow_up_date date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS communication_preference text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS language text;
-- Trade-Specific
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS shipping_addresses jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_shipping text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS incoterms text;
-- Documents
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
-- Supplier-Specific
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_type text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS product_categories jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS brand_names jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS moq text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_time text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_purchases text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS origin_country text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS origin_country_code text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rating integer DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS reliability_score text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS quality_notes text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_quality_issue date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sample_status text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS factory_visit_date date;
-- Supplier Redesign Fields
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_name_en text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_name_cn text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS additional_company_names jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_tel text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_mobile text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_email text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_website text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_address text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_postal_code text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS division text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS catalogues jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_persons jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bank_accounts jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS payment_info text;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts (contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_customer_type ON contacts (customer_type);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts (first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_contacts_active ON contacts (is_active);

-- RLS Policies (allow anon key full access)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow public select" ON contacts FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow public insert" ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public update" ON contacts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public delete" ON contacts FOR DELETE USING (true);`;

const RLS_FIX_SQL = `-- Fix: Allow anon key to read/write contacts
-- Run this in Supabase Dashboard > SQL Editor > New Query

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contacts' AND policyname='Allow public select') THEN
    CREATE POLICY "Allow public select" ON contacts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contacts' AND policyname='Allow public insert') THEN
    CREATE POLICY "Allow public insert" ON contacts FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contacts' AND policyname='Allow public update') THEN
    CREATE POLICY "Allow public update" ON contacts FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contacts' AND policyname='Allow public delete') THEN
    CREATE POLICY "Allow public delete" ON contacts FOR DELETE USING (true);
  END IF;
END $$;`;

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function buildFullName(f: ContactForm): string {
  return [f.title, f.first_name, f.middle_name, f.last_name].filter(Boolean).join(" ").trim();
}

function buildDisplayName(f: ContactForm): string {
  if (f.contact_type === "supplier" && f.company_name_en) return f.company_name_en;
  if (f.first_name || f.last_name) return [f.first_name, f.last_name].filter(Boolean).join(" ");
  if (f.company) return f.company;
  return "Unnamed Contact";
}

function getInitials(contact: ContactRow): string {
  if (contact.contact_type === "supplier") {
    const en = (contact as any).company_name_en || "";
    if (en) return en.slice(0, 2).toUpperCase();
  }
  if ((contact as any).entity_type === "company" && contact.company) {
    return contact.company.slice(0, 2).toUpperCase();
  }
  const fn = contact.first_name || "";
  const ln = contact.last_name || "";
  if (fn && ln) return (fn[0] + ln[0]).toUpperCase();
  if (fn) return fn.slice(0, 2).toUpperCase();
  if (contact.company) return contact.company.slice(0, 2).toUpperCase();
  return "?";
}

function contactDisplayName(c: ContactRow): string {
  if (c.contact_type === "supplier") {
    const en = c.company_name_en || "";
    if (en) return en;
  }
  if (c.contact_type === "company" && c.company) return c.company;
  if (c.entity_type === "company" && c.company) return c.company;
  if (c.first_name || c.last_name) return [c.first_name, c.last_name].filter(Boolean).join(" ");
  if (c.display_name) return c.display_name;
  if (c.company) return c.company;
  return "Unnamed";
}

/** Why a contact matched the search — the most specific field that contains a
 *  query term — so a suggestion can say WHERE the hit came from (e.g.
 *  "Brand: NEXD", "Contact: 王伟", "WeChat: kx-sales"). Returns null when only
 *  the name/company matched (already shown as the suggestion's title). */
function searchMatchReason(c: ContactRow, terms: string[]): { label: string; value: string } | null {
  if (!terms.length) return null;
  const rec = c as unknown as Record<string, unknown>;
  const s = (k: string) => { const v = rec[k]; return typeof v === "string" ? v : ""; };
  const labeled: [string, string][] = [];
  const add = (label: string, val?: string | null) => { if (val && String(val).trim()) labeled.push([label, String(val).trim()]); };
  add("Chinese name", s("company_name_cn"));
  add("Trading name", s("trading_name"));
  add("Code", s("supplier_code"));
  add("Email", s("email") || s("supplier_email"));
  add("Phone", s("phone") || s("supplier_tel") || s("supplier_mobile"));
  add("WeChat", s("wechat_id"));
  add("WhatsApp", s("whatsapp_business"));
  add("Website", s("website"));
  add("Country", s("country"));
  add("City", s("city"));
  add("Division", s("division"));
  add("Category", s("category"));
  if (Array.isArray(c.brand_names)) c.brand_names.forEach((b) => add("Brand", b));
  if (Array.isArray(c.tags)) c.tags.forEach((tg) => add("Tag", tg));
  const mc = rec.messaging_channels;
  if (Array.isArray(mc)) (mc as { platform?: string; value?: string }[]).forEach((m) => add(m?.platform || "App", m?.value));
  if (Array.isArray(c.contact_persons)) {
    for (const p of c.contact_persons) {
      add("Contact", p.name); add("Contact email", p.email); add("Contact phone", p.phone);
      add("Contact WeChat", (p as { wechat_id?: string }).wechat_id);
    }
  }
  for (const [label, val] of labeled) {
    const lv = val.toLowerCase();
    if (terms.some((t) => lv.includes(t))) return { label, value: val };
  }
  return null;
}

/* ── Supplier form validation (blocks save) ─────────────────────────────────
   Enforces the data-integrity rules from the Suppliers System Report:
   required fields, email/phone format, name-script consistency, numeric-only
   messaging IDs, payment-link sanity, and a sane factory-visit date. */
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const hasArabicChars = (s: string) => /[؀-ۿݐ-ݿࢠ-ࣿ]/.test(s);
const hasCJKChars = (s: string) => /[㐀-鿿豈-﫿぀-ヿ]/.test(s);
const phoneDigits = (s: string) => (s || "").replace(/[^\d]/g, "");
/* Live phone sanitizer: keep digits + separators, but cap to a realistic
   number of digits (E.164 max is 15) so users can't type 30-digit nonsense. */
function sanPhone(s: string, maxDigits = 15): string {
  let out = ""; let d = 0;
  for (const ch of s || "") {
    if (ch >= "0" && ch <= "9") { if (d >= maxDigits) continue; d++; out += ch; }
    else if (" ()+-".includes(ch)) out += ch;
  }
  return out;
}

function supplierFormErrors(f: ContactForm): string[] {
  const e: string[] = [];
  const v = (x?: string | null) => (x || "").trim();

  // E — required fields
  if (!v(f.company_name_en)) e.push("Company name (English) is required.");
  if (!v(f.country)) e.push("Country is required.");
  if (!v(f.division)) e.push("Division is required.");
  if (!v(f.category)) e.push("Category is required.");
  if (![f.supplier_tel, f.supplier_mobile, f.supplier_email].some((x) => v(x))) e.push("Add at least one company contact (tel, mobile, or email).");
  // Messaging channel (WeChat etc.) and contact person are no longer required —
  // the supplier can be saved without them.

  // C — email / phone format
  if (v(f.supplier_email) && !RE_EMAIL.test(v(f.supplier_email))) e.push("Company email isn't a valid email address.");
  f.contact_persons.forEach((p) => { if (v(p.email) && !RE_EMAIL.test(v(p.email))) e.push(`Contact "${v(p.name) || "?"}" has an invalid email address.`); });
  const phoneBad = (x?: string) => { const d = phoneDigits(v(x)); return !!v(x) && (d.length < 6 || d.length > 15); };
  if (phoneBad(f.supplier_tel)) e.push("Company tel looks invalid (expected 6–15 digits).");
  if (phoneBad(f.supplier_mobile)) e.push("Company mobile looks invalid (expected 6–15 digits).");

  // A — name-script consistency (Chinese name must not contain Arabic)
  {
    const cnName = v(f.company_name_cn);
    if (cnName) {
      if (hasArabicChars(cnName)) e.push("Chinese company name shouldn't contain Arabic text.");
      else if (!hasCJKChars(cnName)) e.push("Chinese company name must use Chinese characters (e.g. 深圳精密机械).");
    }
  }

  // I — numeric-only messaging IDs (WhatsApp / QQ are phone/number based)
  f.messaging_channels.forEach((m) => {
    const val = v(m.value);
    if (!val) return;
    if (m.platform === "QQ" && !/^\d+$/.test(val)) e.push("QQ number must contain digits only.");
    if (m.platform === "WhatsApp" && !/^[\d+\-\s()]+$/.test(val)) e.push("WhatsApp number must be a phone number (digits only).");
  });
  if (v(f.qq_id) && !/^\d+$/.test(v(f.qq_id))) e.push("QQ number must contain digits only.");
  if (v(f.whatsapp_business) && !/^[\d+\-\s()]+$/.test(v(f.whatsapp_business))) e.push("WhatsApp Business must be a phone number (digits only).");

  // K — payment link / ID sanity
  const pay = v(f.wechat_pay_id);
  if (pay) {
    if (hasArabicChars(pay)) e.push("WeChat Pay ID/link shouldn't contain Arabic text.");
    else if (/https?:\/\//i.test(pay)) { try { new URL(pay); } catch { e.push("WeChat Pay link isn't a valid URL."); } }
  }

  // M — factory-visit date in a sane range
  if (v(f.factory_visit_date)) {
    const dt = new Date(f.factory_visit_date);
    const y = dt.getFullYear();
    if (isNaN(dt.getTime()) || y < 2000 || y > 2100) e.push("Factory visit date is out of a valid range.");
  }

  // de-dupe (same message can be pushed by multiple channels)
  return [...new Set(e)];
}

function contactSortKey(c: ContactRow): string {
  if (c.contact_type === "supplier") {
    const en = c.company_name_en || "";
    if (en) return en.toLowerCase();
  }
  if (c.contact_type === "company" && c.company) return c.company.toLowerCase();
  if (c.entity_type === "company" && c.company) return c.company.toLowerCase();
  return (c.first_name || c.last_name || c.company || c.display_name || "zzz").toLowerCase();
}

function getTypeColor(type: string): string {
  return CONTACT_TYPES.find(t => t.value === type)?.color || "text-zinc-400";
}

function getTierInfo(tier: string | null) {
  return CUSTOMER_TIERS.find(t => t.value === tier);
}

/** Derive flag emoji from a 2-letter ISO country code */
function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    ...Array.from(upper).map(c => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/** Compress an image file to a smaller base64 string for faster saves */
async function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Read any file as a base64 data URL (for PDFs and non-image files) */
async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
}

/** Upload a file (PDF / large document) to Supabase Storage and return its
    public URL. Storing big files inline as base64 in a JSONB column bloated
    one contact row to 40 MB, which made GET /api/contacts/[id] exceed the
    serverless function's ~4.5 MB limit (413) and broke every save. Documents
    now live in Storage; only the small URL is kept on the row. Falls back to
    inline base64 if the upload fails, so the feature never silently breaks. */
/** Upload a Blob/File to the media bucket; returns its public URL + storage path
    (or null on failure). Used for both the catalogue file and its cover. */
async function uploadToMediaStorage(blob: Blob, name: string): Promise<{ url: string; path: string } | null> {
  try {
    const safe = (name || "file").normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(0, 80);
    const fd = new FormData();
    fd.append("file", blob, safe);
    fd.append("bucket", "media");
    fd.append("path", `supplier-catalogues/${Date.now()}_${safe}`);
    const ct = (blob as File).type || "application/octet-stream";
    fd.append("contentType", ct);
    const res = await fetch("/api/storage/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    const json = (await res.json()) as { publicUrl?: string; path?: string };
    return json.publicUrl && json.path ? { url: json.publicUrl, path: json.path } : null;
  } catch { return null; }
}

async function uploadFileToStorage(file: File): Promise<string> {
  const up = await uploadToMediaStorage(file, file.name);
  return up ? up.url : readFileAsDataURL(file);
}

/** Convert a base64 data URL to a Blob URL that browsers can open/download */
function dataURLtoBlobURL(dataURL: string): string {
  try {
    const [header, data] = dataURL.split(",");
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    const blob = new Blob([array], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return dataURL;
  }
}

/** Open a data URL file in a new browser tab (works in Safari/Chrome/Firefox) */
function openFilePreview(dataURL: string) {
  const blobURL = dataURLtoBlobURL(dataURL);
  window.open(blobURL, "_blank");
}

/** Trigger a download for a data URL file */
function downloadFile(dataURL: string, filename: string) {
  const blobURL = dataURLtoBlobURL(dataURL);
  const a = document.createElement("a");
  a.href = blobURL;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobURL), 1000);
}

function contactToForm(c: ContactRow): ContactForm {
  return {
    contact_type: (c.contact_type as ContactType) || "people",
    entity_type: (c.entity_type as "person" | "company" | "") || "",
    // Older suppliers stored the company logo in logo_url; surface it so the
    // edit form shows the existing logo instead of an empty "Add Logo" box.
    photo_url: c.photo_url || c.logo_url || "",
    title: c.title || "",
    first_name: c.first_name || "",
    middle_name: c.middle_name || "",
    last_name: c.last_name || "",
    company: c.company || "",
    position: c.position || "",
    country: c.country || "",
    country_code: c.country_code || "",
    province: c.province || "",
    province_code: c.province_code || "",
    city: c.city || "",
    birthday: c.birthday || "",
    notes: c.notes || "",
    is_active: c.is_active ?? true,
    customer_type: (c.customer_type as CustomerTier) || "",
    phones: Array.isArray(c.phones) ? c.phones : [],
    emails: Array.isArray(c.emails) ? c.emails : [],
    addresses: Array.isArray(c.addresses) ? c.addresses : [],
    websites: Array.isArray(c.websites) ? c.websites : [],
    social_profiles: Array.isArray(c.social_profiles) ? c.social_profiles : [],
    family_members: Array.isArray(c.family_members) ? c.family_members : [],
    related_names: Array.isArray(c.related_names) ? c.related_names : [],
    custom_fields: Array.isArray(c.custom_fields) ? c.custom_fields : [],
    business_card_front: c.business_card_front || "",
    business_card_back: c.business_card_back || "",
    /* Financial & Business */
    total_revenue: c.total_revenue || "",
    last_order_date: c.last_order_date || "",
    payment_terms: c.payment_terms || "",
    credit_limit: c.credit_limit || "",
    outstanding_balance: c.outstanding_balance || "",
    currency: c.currency || "",
    /* Classification & Segmentation */
    industry: c.industry || "",
    source: c.source || "",
    tags: Array.isArray(c.tags) ? c.tags : [],
    account_manager: c.account_manager || "",
    /* Relationship & Activity */
    first_contact_date: c.first_contact_date || "",
    last_contacted: c.last_contacted || "",
    follow_up_date: c.follow_up_date || "",
    communication_preference: c.communication_preference || "",
    language: c.language || "",
    /* Trade-Specific */
    shipping_addresses: Array.isArray(c.shipping_addresses) ? c.shipping_addresses : [],
    preferred_shipping: c.preferred_shipping || "",
    tax_id: c.tax_id || "",
    incoterms: c.incoterms || "",
    /* Documents */
    attachments: Array.isArray(c.attachments) ? c.attachments : [],
    /* Commercial Profile */
    market_band: c.market_band || "",
    commercial_role: c.commercial_role || "",
    territory: c.territory || "",
    exclusivity: c.exclusivity || "",
    exclusivity_scope: c.exclusivity_scope || "",
    exclusivity_expiry: c.exclusivity_expiry || "",
    backup_account_manager: c.backup_account_manager || "",
    assigned_branch: c.assigned_branch || "",
    source_details: c.source_details || "",
    referred_by: c.referred_by || "",
    customer_level_assigned_date: c.customer_level_assigned_date || "",
    customer_level_review_date: c.customer_level_review_date || "",
    sales_rep: c.sales_rep || "",
    /* Credit Management */
    credit_rating_internal: c.credit_rating_internal || "",
    credit_rating_external: c.credit_rating_external || "",
    credit_limit_approved_by: c.credit_limit_approved_by || "",
    credit_limit_approved_date: c.credit_limit_approved_date || "",
    overdue_balance: c.overdue_balance || "",
    days_sales_outstanding: c.days_sales_outstanding || "",
    credit_insurance_covered: c.credit_insurance_covered ?? false,
    credit_insurance_provider: c.credit_insurance_provider || "",
    credit_insurance_coverage: c.credit_insurance_coverage || "",
    preferred_payment_method: c.preferred_payment_method || "",
    max_discount_allowed: c.max_discount_allowed || "",
    price_list_tier: c.price_list_tier || "",
    special_pricing_agreement: c.special_pricing_agreement ?? false,
    contract_pricing_expiry: c.contract_pricing_expiry || "",
    commission_rate: c.commission_rate || "",
    /* KYC & Compliance */
    kyc_status: c.kyc_status || "",
    kyc_verified_date: c.kyc_verified_date || "",
    kyc_verified_by: c.kyc_verified_by || "",
    kyc_review_due_date: c.kyc_review_due_date || "",
    risk_score: c.risk_score || "",
    sanctions_check_status: c.sanctions_check_status || "",
    sanctions_check_date: c.sanctions_check_date || "",
    pep_status: c.pep_status ?? false,
    high_risk_country: c.high_risk_country ?? false,
    aml_status: c.aml_status || "",
    business_registration_number: c.business_registration_number || "",
    registration_country: c.registration_country || "",
    registration_date: c.registration_date || "",
    year_established: c.year_established || "",
    company_type: c.company_type || "",
    trading_name: c.trading_name || "",
    employee_count_range: c.employee_count_range || "",
    annual_revenue_range: c.annual_revenue_range || "",
    /* International Trade IDs */
    eori_number: c.eori_number || "",
    duns_number: c.duns_number || "",
    importer_exporter_code: c.importer_exporter_code || "",
    customs_code: c.customs_code || "",
    gst_number: c.gst_number || "",
    cr_number: c.cr_number || "",
    /* Messaging IDs */
    // Messaging repeater: prefer the stored array; otherwise backfill from the
    // legacy per-app columns so existing suppliers keep their channels.
    messaging_channels: (Array.isArray(c.messaging_channels) && c.messaging_channels.length
      ? (c.messaging_channels as { platform?: string; value?: string }[]).map((m) => ({ platform: String(m.platform || ""), value: String(m.value || "") }))
      : ([
          ["WhatsApp", c.whatsapp_business], ["Telegram", c.telegram_id], ["QQ", c.qq_id],
          ["DingTalk", c.dingtalk_id], ["Messenger", c.messenger_id], ["Line", c.line_id], ["Skype", c.skype_id],
        ] as [string, unknown][]).filter(([, v]) => typeof v === "string" && v.trim()).map(([platform, v]) => ({ platform, value: String(v) }))
    ).filter((m) => m.platform),
    whatsapp_business: c.whatsapp_business || "",
    wechat_id: c.wechat_id || "",
    telegram_id: c.telegram_id || "",
    line_id: c.line_id || "",
    skype_id: c.skype_id || "",
    wechat_qr: c.wechat_qr || "",
    whatsapp_qr: c.whatsapp_qr || "",
    telegram_qr: c.telegram_qr || "",
    line_qr: c.line_qr || "",
    skype_qr: c.skype_qr || "",
    qq_id: c.qq_id || "",
    qq_qr: c.qq_qr || "",
    dingtalk_id: c.dingtalk_id || "",
    dingtalk_qr: c.dingtalk_qr || "",
    messenger_id: c.messenger_id || "",
    messenger_qr: c.messenger_qr || "",
    /* Segmentation extras */
    sub_industry: c.sub_industry || "",
    buying_behavior: c.buying_behavior || "",
    price_sensitivity: c.price_sensitivity || "",
    quality_sensitivity: c.quality_sensitivity || "",
    customer_health_score: c.customer_health_score || "",
    nps_score: c.nps_score || "",
    churn_risk: c.churn_risk || "",
    vip_status: c.vip_status ?? false,
    strategic_account: c.strategic_account ?? false,
    relationship_stage: c.relationship_stage || "",
    support_tier: c.support_tier || "",
    /* Trade & Shipping extras */
    port_of_entry: c.port_of_entry || "",
    preferred_carriers: Array.isArray(c.preferred_carriers) ? c.preferred_carriers : [],
    customs_broker: c.customs_broker || "",
    freight_forwarder: c.freight_forwarder || "",
    shipping_marks: c.shipping_marks || "",
    container_preference: c.container_preference || "",
    certifications_required: Array.isArray(c.certifications_required) ? c.certifications_required : [],
    labeling_requirements: c.labeling_requirements || "",
    hs_codes: Array.isArray(c.hs_codes) ? c.hs_codes : [],
    /* Notes & audit extras */
    internal_notes: c.internal_notes || "",
    flags: Array.isArray(c.flags) ? c.flags : [],
    /* Supplier-Specific */
    supplier_type: c.supplier_type || "",
    product_categories: Array.isArray(c.product_categories) ? c.product_categories : [],
    brand_names: Array.isArray(c.brand_names) ? c.brand_names : [],
    moq: c.moq || "",
    lead_time: c.lead_time || "",
    backup_supplier_name: (c as unknown as Record<string, unknown>).backup_supplier_name as string || "",
    total_purchases: c.total_purchases || "",
    origin_country: c.origin_country || "",
    origin_country_code: c.origin_country_code || "",
    certifications: Array.isArray(c.certifications) ? c.certifications : [],
    rating: c.rating || 0,
    reliability_score: c.reliability_score || "",
    quality_notes: c.quality_notes || "",
    last_quality_issue: c.last_quality_issue || "",
    quality_issues: Array.isArray((c as unknown as Record<string, unknown>).quality_issues) ? ((c as unknown as Record<string, unknown>).quality_issues as { date: string; note: string }[]) : [],
    sample_status: c.sample_status || "",
    factory_visit_date: c.factory_visit_date || "",
    strategic_status: c.strategic_status || "",
    readiness_milestone: typeof c.readiness_milestone === "number" ? c.readiness_milestone : Number(c.readiness_milestone) || 0,
    /* Supplier Redesign */
    company_name_en: c.company_name_en || "",
    company_name_cn: c.company_name_cn || "",
    additional_company_names: Array.isArray(c.additional_company_names) ? c.additional_company_names : [],
    supplier_tel: c.supplier_tel || "",
    supplier_mobile: c.supplier_mobile || "",
    supplier_email: c.supplier_email || "",
    supplier_website: c.supplier_website || "",
    supplier_website_qr: (c as unknown as Record<string, unknown>).website_qr as string || "",
    supplier_profile_url: (c as unknown as Record<string, unknown>).supplier_profile_url as string || "",
    ecatalog_url: (c as unknown as Record<string, unknown>).ecatalog_url as string || "",
    ecatalog_qr: (c as unknown as Record<string, unknown>).ecatalog_qr as string || "",
    business_timezone: (c as unknown as Record<string, unknown>).business_timezone as string || "",
    business_hours_start: (c as unknown as Record<string, unknown>).business_hours_start as string || "",
    business_hours_end: (c as unknown as Record<string, unknown>).business_hours_end as string || "",
    wechat_official_account: c.wechat_official_account || "",
    wechat_official_account_qr: c.wechat_official_account_qr || "",
    wechat_sales_group_available: !!c.wechat_sales_group_available,
    wechat_group_name: (c as unknown as Record<string, unknown>).wechat_group_name as string || "",
    wechat_group_members: (c as unknown as Record<string, unknown>).wechat_group_members as string || "",
    wecom_support_available: !!c.wecom_support_available,
    supplier_address: c.supplier_address || "",
    supplier_address_cn: (c as unknown as Record<string, unknown>).supplier_address_cn as string || "",
    supplier_postal_code: c.supplier_postal_code || "",
    division: c.division || "",
    category: c.category || "",
    catalogues: Array.isArray(c.catalogues) ? c.catalogues : [],
    documents: Array.isArray(c.documents) ? c.documents : [],
    contact_persons: Array.isArray(c.contact_persons) ? c.contact_persons : [],
    bank_accounts: Array.isArray(c.bank_accounts) ? c.bank_accounts : [],
    payment_info: c.payment_info || "",
    wechat_pay_id: c.wechat_pay_id || "",
    wechat_pay_qr: c.wechat_pay_qr || "",
    alipay_id: c.alipay_id || "",
    alipay_qr: c.alipay_qr || "",
    /* Employee-Specific */
    work_email: c.work_email || "",
    work_tel: c.work_tel || "",
    work_mobile: c.work_mobile || "",
    management: c.management || "",
    department: c.department || "",
    job_position: c.job_position || "",
    job_title: c.job_title || "",
    manager: c.manager || "",
    work_address: c.work_address || "",
    work_location: c.work_location || "",
    resume_lines: Array.isArray(c.resume_lines) ? (c.resume_lines as ResumeLineEntry[]) : [],
    private_email: c.private_email || "",
    private_phone: c.private_phone || "",
    employee_bank_account: c.employee_bank_account || "",
    legal_name: c.legal_name || "",
    business_license_image: c.business_license_image || "",
    place_of_birth: c.place_of_birth || "",
    gender: c.gender || "",
    emergency_contacts: Array.isArray(c.emergency_contacts) ? c.emergency_contacts : [],
    visa_no: c.visa_no || "",
    work_permit: c.work_permit || "",
    visa_documents: Array.isArray(c.visa_documents) ? c.visa_documents : [],
    nationality: c.nationality || "",
    nationality_code: c.nationality_code || "",
    id_no: c.id_no || "",
    ssn_no: c.ssn_no || "",
    passport_no: c.passport_no || "",
    private_address: c.private_address || "",
    home_work_distance: c.home_work_distance || "",
    marital_status: c.marital_status || "",
    number_of_children: c.number_of_children || "",
    certificate_level: c.certificate_level || "",
    field_of_study: c.field_of_study || "",
  };
}

export function formToRow(f: ContactForm): Record<string, unknown> {
  const fullName = buildFullName(f);
  const displayName = buildDisplayName(f);
  return {
    contact_type: f.contact_type,
    entity_type: f.entity_type || (f.contact_type === "company" ? "company" : "person"),
    photo_url: f.photo_url || null,
    // Keep logo_url in sync so the directory list (which reads logo_url too)
    // and the detail card always agree — including when a logo is removed.
    logo_url: f.photo_url || null,
    title: f.title || null,
    first_name: f.first_name || null,
    middle_name: f.middle_name || null,
    last_name: f.last_name || null,
    full_name: fullName || null,
    display_name: displayName,
    company: f.company || f.company_name_en || null,
    position: f.position || null,
    email: f.supplier_email || f.emails[0]?.email || null,
    phone: f.phones[0]?.number || f.supplier_tel || f.supplier_mobile || null,
    country: f.country || null,
    country_code: f.country_code || null,
    province: f.province || null,
    province_code: f.province_code || null,
    city: f.city || null,
    birthday: f.birthday || null,
    notes: f.notes || null,
    website: f.supplier_website || f.websites[0]?.url || null,
    is_active: f.is_active,
    /* Keep the tier even when the customer is deactivated — we used
       to null it out on is_active=false, which silently deleted the
       tier any time the toggle flipped. Deactivation should suspend
       the record, not wipe its commercial metadata. */
    customer_type: f.contact_type === "customer" ? (f.customer_type || null) : null,
    phones: f.phones,
    emails: f.emails,
    addresses: f.addresses,
    websites: f.websites,
    social_profiles: f.social_profiles,
    family_members: f.family_members,
    related_names: f.related_names,
    custom_fields: f.custom_fields,
    business_card_front: f.business_card_front || null,
    business_card_back: f.business_card_back || null,
    /* Financial & Business */
    total_revenue: f.total_revenue || null,
    last_order_date: f.last_order_date || null,
    payment_terms: f.payment_terms || null,
    credit_limit: f.credit_limit || null,
    outstanding_balance: f.outstanding_balance || null,
    currency: f.currency || null,
    /* Classification & Segmentation */
    industry: f.industry || null,
    source: f.source || null,
    tags: f.tags.length > 0 ? f.tags : null,
    account_manager: f.account_manager || null,
    /* Relationship & Activity */
    first_contact_date: f.first_contact_date || null,
    last_contacted: f.last_contacted || null,
    follow_up_date: f.follow_up_date || null,
    communication_preference: f.communication_preference || null,
    language: f.language || null,
    /* Trade-Specific */
    shipping_addresses: f.shipping_addresses.length > 0 ? f.shipping_addresses : null,
    preferred_shipping: f.preferred_shipping || null,
    tax_id: f.tax_id || null,
    incoterms: f.incoterms || null,
    /* Documents */
    attachments: f.attachments.length > 0 ? f.attachments : null,
    /* Commercial Profile */
    market_band: f.market_band || null,
    commercial_role: f.commercial_role || null,
    territory: f.territory || null,
    exclusivity: f.exclusivity || null,
    exclusivity_scope: f.exclusivity_scope || null,
    exclusivity_expiry: f.exclusivity_expiry || null,
    backup_account_manager: f.backup_account_manager || null,
    assigned_branch: f.assigned_branch || null,
    source_details: f.source_details || null,
    referred_by: f.referred_by || null,
    customer_level_assigned_date: f.customer_level_assigned_date || null,
    customer_level_review_date: f.customer_level_review_date || null,
    sales_rep: f.sales_rep || null,
    /* Credit Management */
    credit_rating_internal: f.credit_rating_internal || null,
    credit_rating_external: f.credit_rating_external || null,
    credit_limit_approved_by: f.credit_limit_approved_by || null,
    credit_limit_approved_date: f.credit_limit_approved_date || null,
    overdue_balance: f.overdue_balance || null,
    days_sales_outstanding: f.days_sales_outstanding || null,
    credit_insurance_covered: f.credit_insurance_covered,
    credit_insurance_provider: f.credit_insurance_provider || null,
    credit_insurance_coverage: f.credit_insurance_coverage || null,
    preferred_payment_method: f.preferred_payment_method || null,
    max_discount_allowed: f.max_discount_allowed || null,
    price_list_tier: f.price_list_tier || null,
    special_pricing_agreement: f.special_pricing_agreement,
    contract_pricing_expiry: f.contract_pricing_expiry || null,
    commission_rate: f.commission_rate || null,
    /* KYC & Compliance */
    kyc_status: f.kyc_status || null,
    kyc_verified_date: f.kyc_verified_date || null,
    kyc_verified_by: f.kyc_verified_by || null,
    kyc_review_due_date: f.kyc_review_due_date || null,
    risk_score: f.risk_score || null,
    sanctions_check_status: f.sanctions_check_status || null,
    sanctions_check_date: f.sanctions_check_date || null,
    pep_status: f.pep_status,
    high_risk_country: f.high_risk_country,
    aml_status: f.aml_status || null,
    business_registration_number: f.business_registration_number || null,
    registration_country: f.registration_country || null,
    registration_date: f.registration_date || null,
    year_established: f.year_established || null,
    company_type: f.company_type || null,
    trading_name: f.trading_name || null,
    employee_count_range: f.employee_count_range || null,
    annual_revenue_range: f.annual_revenue_range || null,
    /* International Trade IDs */
    eori_number: f.eori_number || null,
    duns_number: f.duns_number || null,
    importer_exporter_code: f.importer_exporter_code || null,
    customs_code: f.customs_code || null,
    gst_number: f.gst_number || null,
    cr_number: f.cr_number || null,
    /* Messaging IDs — WeChat is the hero; the rest live in the messaging_channels
       repeater. Persist the array AND derive the legacy per-app columns from it
       so the Supplier 360 channel grid keeps rendering known apps unchanged. */
    messaging_channels: f.messaging_channels.filter((m) => m.platform && (m.value || "").trim()).map((m) => ({ platform: m.platform, value: m.value.trim() })),
    wechat_id: f.wechat_id || null,
    whatsapp_business: (f.messaging_channels.find((m) => m.platform === "WhatsApp")?.value || "").trim() || null,
    telegram_id: (f.messaging_channels.find((m) => m.platform === "Telegram")?.value || "").trim() || null,
    qq_id: (f.messaging_channels.find((m) => m.platform === "QQ")?.value || "").trim() || null,
    dingtalk_id: (f.messaging_channels.find((m) => m.platform === "DingTalk")?.value || "").trim() || null,
    messenger_id: (f.messaging_channels.find((m) => m.platform === "Messenger")?.value || "").trim() || null,
    line_id: (f.messaging_channels.find((m) => m.platform === "Line")?.value || "").trim() || null,
    skype_id: (f.messaging_channels.find((m) => m.platform === "Skype")?.value || "").trim() || null,
    wechat_qr: f.wechat_qr || null,
    whatsapp_qr: f.whatsapp_qr || null,
    telegram_qr: f.telegram_qr || null,
    line_qr: f.line_qr || null,
    skype_qr: f.skype_qr || null,
    qq_qr: f.qq_qr || null,
    dingtalk_qr: f.dingtalk_qr || null,
    messenger_qr: f.messenger_qr || null,
    /* Segmentation extras */
    sub_industry: f.sub_industry || null,
    buying_behavior: f.buying_behavior || null,
    price_sensitivity: f.price_sensitivity || null,
    quality_sensitivity: f.quality_sensitivity || null,
    customer_health_score: f.customer_health_score || null,
    nps_score: f.nps_score || null,
    churn_risk: f.churn_risk || null,
    vip_status: f.vip_status,
    strategic_account: f.strategic_account,
    relationship_stage: f.relationship_stage || null,
    support_tier: f.support_tier || null,
    /* Trade & Shipping extras */
    port_of_entry: f.port_of_entry || null,
    preferred_carriers: f.preferred_carriers.length > 0 ? f.preferred_carriers : null,
    customs_broker: f.customs_broker || null,
    freight_forwarder: f.freight_forwarder || null,
    shipping_marks: f.shipping_marks || null,
    container_preference: f.container_preference || null,
    certifications_required: f.certifications_required.length > 0 ? f.certifications_required : null,
    labeling_requirements: f.labeling_requirements || null,
    hs_codes: f.hs_codes.length > 0 ? f.hs_codes : null,
    /* Notes & audit extras */
    internal_notes: f.internal_notes || null,
    flags: f.flags.length > 0 ? f.flags : null,
    /* Supplier-Specific */
    supplier_type: f.supplier_type || null,
    product_categories: f.product_categories.length > 0 ? f.product_categories : null,
    brand_names: f.brand_names.length > 0 ? f.brand_names : null,
    moq: f.moq || null,
    lead_time: f.lead_time || null,
    backup_supplier_name: f.backup_supplier_name || null,
    total_purchases: f.total_purchases || null,
    origin_country: f.origin_country || null,
    origin_country_code: f.origin_country_code || null,
    certifications: f.certifications.length > 0 ? f.certifications : null,
    rating: f.rating || null,
    reliability_score: f.reliability_score || null,
    quality_notes: f.quality_notes || null,
    last_quality_issue: f.last_quality_issue || null,
    quality_issues: f.quality_issues.filter((q) => (q.date || "").trim() || (q.note || "").trim()),
    sample_status: f.sample_status || null,
    factory_visit_date: f.factory_visit_date || null,
    /* Supplier Redesign */
    company_name_en: f.company_name_en || null,
    company_name_cn: f.company_name_cn || null,
    additional_company_names: f.additional_company_names.length > 0 ? f.additional_company_names : null,
    supplier_tel: f.supplier_tel || null,
    supplier_mobile: f.supplier_mobile || null,
    supplier_email: f.supplier_email || null,
    supplier_website: f.supplier_website || null,
    website_qr: f.supplier_website_qr || null,
    supplier_profile_url: f.supplier_profile_url || null,
    ecatalog_url: f.ecatalog_url || null,
    ecatalog_qr: f.ecatalog_qr || null,
    business_timezone: f.business_timezone || null,
    business_hours_start: f.business_hours_start || null,
    business_hours_end: f.business_hours_end || null,
    wechat_official_account: f.wechat_official_account || null,
    wechat_official_account_qr: f.wechat_official_account_qr || null,
    wechat_sales_group_available: !!f.wechat_sales_group_available,
    wechat_group_name: f.wechat_group_name || null,
    wechat_group_members: f.wechat_group_members || null,
    wecom_support_available: !!f.wecom_support_available,
    supplier_address: f.supplier_address || null,
    supplier_address_cn: f.supplier_address_cn || null,
    supplier_postal_code: f.supplier_postal_code || null,
    division: f.division || null,
    category: f.category || null,
    catalogues: f.catalogues.length > 0 ? f.catalogues : null,
    documents: f.documents.length > 0 ? f.documents : null,
    contact_persons: f.contact_persons.length > 0 ? f.contact_persons : null,
    bank_accounts: f.bank_accounts.length > 0 ? f.bank_accounts : null,
    payment_info: f.payment_info || null,
    wechat_pay_id: f.wechat_pay_id || null,
    wechat_pay_qr: f.wechat_pay_qr || null,
    alipay_id: f.alipay_id || null,
    alipay_qr: f.alipay_qr || null,
    /* Employee-Specific */
    work_email: f.work_email || null,
    work_tel: f.work_tel || null,
    work_mobile: f.work_mobile || null,
    management: f.management || null,
    department: f.department || null,
    job_position: f.job_position || null,
    job_title: f.job_title || null,
    manager: f.manager || null,
    work_address: f.work_address || null,
    work_location: f.work_location || null,
    resume_lines: f.resume_lines.length > 0 ? f.resume_lines : null,
    private_email: f.private_email || null,
    private_phone: f.private_phone || null,
    employee_bank_account: f.employee_bank_account || null,
    legal_name: f.legal_name || null,
    business_license_image: f.business_license_image || null,
    place_of_birth: f.place_of_birth || null,
    gender: f.gender || null,
    emergency_contacts: f.emergency_contacts.length > 0 ? f.emergency_contacts : null,
    visa_no: f.visa_no || null,
    work_permit: f.work_permit || null,
    visa_documents: f.visa_documents.length > 0 ? f.visa_documents : null,
    nationality: f.nationality || null,
    nationality_code: f.nationality_code || null,
    id_no: f.id_no || null,
    ssn_no: f.ssn_no || null,
    passport_no: f.passport_no || null,
    private_address: f.private_address || null,
    home_work_distance: f.home_work_distance || null,
    marital_status: f.marital_status || null,
    number_of_children: f.number_of_children || null,
    certificate_level: f.certificate_level || null,
    field_of_study: f.field_of_study || null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODULE-LEVEL REUSABLE COMPONENTS (extracted from render functions for perf)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Detail view section wrapper ── */
const Section = React.memo(function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--border-color)] px-4 md:px-6 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[var(--text-dim)]">{icon}</span>
        <h3 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
});

/* ── Form text input ── */
/* ── Supplier intelligence (canonical tables, written after create) ── */
const LEVEL3_OPTS = ["low", "medium", "high"];
const LEVEL4_OPTS = ["low", "medium", "high", "critical"];
const capWord = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* Contact-person controlled vocabularies — mirror the DB CHECK + the
   server-side whitelist in src/lib/suppliers/contact-fields.ts. */
const CONTACT_ROLE_CATEGORIES = ["sales", "boss", "owner", "support", "finance", "logistics", "qc", "engineering", "management", "other"];
const CONTACT_RELIABILITY = ["high", "medium", "low", "unknown"];
const CONTACT_CHANNELS = ["wechat", "wecom", "whatsapp", "telegram", "email", "mobile", "line", "skype"];
/* Free-text fields with a natural fixed vocabulary, surfaced as dropdowns.
   Values are stored as plain strings (the routes accept free text), so these
   pick-lists guide entry without locking the column. */
const CONTACT_RESPONSE_SPEEDS = ["Within 1 hour", "Within 2 hours", "Same day", "Within 24 hours", "Within 48 hours", "2–3 days", "Slow / varies"];
const CONTACT_LANGUAGES = ["English", "Chinese (Mandarin)", "Chinese (Cantonese)", "Arabic", "Spanish", "French", "Russian", "Portuguese", "German", "Japanese", "Korean", "Hindi", "Other"];
const TIMEZONES = ["GMT-12", "GMT-11", "GMT-10", "GMT-9", "GMT-8", "GMT-7", "GMT-6", "GMT-5", "GMT-4", "GMT-3", "GMT-2", "GMT-1", "GMT+0", "GMT+1", "GMT+2", "GMT+3", "GMT+3:30", "GMT+4", "GMT+4:30", "GMT+5", "GMT+5:30", "GMT+6", "GMT+7", "GMT+8", "GMT+9", "GMT+9:30", "GMT+10", "GMT+11", "GMT+12", "GMT+13", "GMT+14"];
const FACTORY_CAPACITY_UNITS = ["units / month", "pcs / month", "sets / month", "pairs / month", "tons / month", "meters / month", "rolls / month", "containers / month"];
const FACTORY_OUTPUT_UNITS = ["units / year", "pcs / year", "sets / year", "pairs / year", "tons / year", "meters / year", "rolls / year", "containers / year"];

/* Map a Low/Med/High[/Critical] rating to a 0..1 "goodness" (1 = best for us),
   honouring polarity. Returns null when the field is unset. */
function levelGoodness(option: string, polarity: "goodHigh" | "goodLow", opts: string[]): number | null {
  const i = opts.indexOf(option);
  if (i < 0) return null;
  const max = opts.length - 1;
  const frac = max === 0 ? 1 : i / max;
  return polarity === "goodLow" ? 1 - frac : frac;
}
/* Average the set ratings into a 0–100 score, or null if nothing is rated. */
function avgRatingScore(entries: Array<[string, "goodHigh" | "goodLow", string[]]>): number | null {
  const vals = entries.map(([v, p, o]) => levelGoodness(v, p, o)).filter((x): x is number => x != null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
}
interface SupplierRiskItem { dimension: string; severity: string; status: string; title: string; description: string; mitigation: string }
interface SupplierIntel {
  strategic_status: string; strategic_status_reason: string;
  classifications: string[]; primary_class: string;
  factory: Record<string, string | boolean>;
  risk: Record<string, string | boolean>;
  neg: Record<string, string>;
  riskItems: SupplierRiskItem[];
  sourcing: Record<string, string>;
}
const EMPTY_SINTEL: SupplierIntel = {
  strategic_status: "", strategic_status_reason: "", classifications: [], primary_class: "",
  factory: { factory_name: "", factory_type: "", production_lines: "", monthly_capacity: "", annual_output: "", factory_size_sqm: "", employee_count: "", qc_staff_count: "", rd_staff_count: "", export_percentage: "", odm_supported: false, private_label_supported: false, low_moq_supported: false, main_export_markets: "", production_categories: "", supported_materials: "", capacity_unit: "", output_unit: "", lead_time_days: "", peak_season_months: "" },
  risk: { risk_level: "", dependency_level: "", geographic_risk: "", compliance_level: "", capacity_level: "", financial_stability: "", delivery_stability: "", quality_stability: "", communication_quality: "", trust_level: "", internal_evaluation_score: "", backup_supplier_exists: false, assessment_notes: "" },
  neg: { negotiation_score: "", price_flexibility: "", moq_flexibility: "", payment_flexibility: "", leadtime_flexibility: "", volume_discount: "", contract_willingness: "", negotiation_difficulty: "", sample_turnaround_speed: "", communication_flexibility: "", customization_openness: "", exclusivity_openness: "", preferred_tactics: "", leverage_points: "", internal_notes: "" },
  riskItems: [],
  sourcing: { sourcing_priority: "", sourcing_score_override: "", sourcing_notes: "", diversification_note: "" },
};

/* Controlled vocabularies for the risk-items register — mirror the
   /api/suppliers/[id]/risk/items route validation. */
const RISK_ITEM_DIMS = ["operational", "financial", "strategic", "geographic", "relationship"];
const RISK_ITEM_SEVERITY = ["low", "medium", "high", "critical"];
const RISK_ITEM_STATUS = ["open", "mitigating", "resolved"];

/* Importance marker shown after a field label: red * for required,
   a subtle "preferred" tag for recommended. */
type FieldTier = "required" | "preferred" | "optional";
const FieldMark = ({ tier }: { tier?: FieldTier }) =>
  tier === "required" ? <span className="ms-0.5 text-rose-400" title="Required">*</span>
    : tier === "preferred" ? <span className="ms-1.5 align-middle text-[9px] font-medium uppercase tracking-wide text-amber-400/80">preferred</span>
    : tier === "optional" ? <span className="ms-1.5 align-middle text-[9px] font-medium uppercase tracking-wide text-[var(--text-ghost)]">optional</span>
    : null;

const Input = React.memo(function Input({ label, value, onChange, type = "text", placeholder, icon, inputMode, autoComplete, list, tier, help, invalid }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; icon?: React.ReactNode;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; autoComplete?: string; list?: string; tier?: FieldTier; help?: string; invalid?: boolean;
}) {
  /* Sensible defaults so each field gets the right mobile keyboard + browser
     autofill even when the caller only passes `type`. */
  const resolvedInputMode = inputMode ?? (type === "email" ? "email" : type === "url" ? "url" : type === "tel" ? "tel" : type === "number" ? "decimal" : undefined);
  const resolvedAutoComplete = autoComplete ?? (type === "email" ? "email" : type === "tel" ? "tel" : type === "url" ? "url" : undefined);
  /* Hard-enforce the field's character set as the user types — `inputMode` is
     only a mobile-keyboard hint, so without this a numeric field still accepts
     letters / Arabic (report I). numeric → digits only; decimal → digits + one
     dot; tel → phone characters. */
  const sanitizeByMode = (raw: string): string => {
    if (resolvedInputMode === "numeric") return raw.replace(/[^\d]/g, "");
    if (resolvedInputMode === "decimal") return raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    if (resolvedInputMode === "tel") return raw.replace(/[^\d+\-\s()]/g, "");
    return raw;
  };
  return (
    <div>
      <label className="text-xs text-[var(--text-faint)] mb-1 flex items-center gap-1">{label}<FieldMark tier={tier} />{help && <GuidanceTip guidanceId={help} size="xs" />}</label>
      <div className="relative">
        {icon && <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)]">{icon}</span>}
        <input
          type={type}
          inputMode={resolvedInputMode}
          autoComplete={resolvedAutoComplete}
          list={list}
          value={value}
          onChange={e => onChange(sanitizeByMode(e.target.value))}
          placeholder={placeholder || label}
          aria-invalid={invalid || undefined}
          className={`w-full h-10 rounded-lg bg-[var(--bg-surface)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none transition-colors ${icon ? "ps-9 pe-3" : "px-3"} ${invalid ? "border-rose-500 ring-1 ring-rose-500/30 focus:border-rose-500" : "border-[var(--border-color)] focus:border-[var(--border-focus)]"}`}
        />
      </div>
    </div>
  );
});

/* ── Clock time picker (brand-styled, replaces the native <input type=time>) ──
   Stores "HH:MM" (24h) so the saved value format is unchanged. Opens a compact
   monochrome popover with hour + minute columns. */
const TimeField = React.memo(function TimeField({ label, value, onChange, tier }: {
  label: string; value: string; onChange: (v: string) => void; tier?: FieldTier;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const [hh, mm] = (value || "").split(":");
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
  const set = (h: string, m: string) => onChange(`${h}:${m}`);
  const cell = (active: boolean) =>
    `text-xs py-1.5 rounded-md transition-colors ${active ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"}`;
  return (
    <div ref={ref} className="relative">
      <label className="text-xs text-[var(--text-faint)] mb-1 flex items-center gap-1">{label}<FieldMark tier={tier} /></label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full h-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--border-focus)] flex items-center gap-2 px-3 text-sm transition-colors">
        <ClockIcon size={14} className="text-[var(--text-ghost)]" />
        <span className={value ? "text-[var(--text-primary)]" : "text-[var(--text-ghost)]"}>{value || "--:--"}</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg p-2 flex gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1 px-1">{"Hour"}</p>
            <div className="max-h-40 overflow-y-auto grid grid-cols-3 gap-1 pe-1">
              {hours.map(h => <button key={h} type="button" onClick={() => set(h, mm || "00")} className={cell(h === hh)}>{h}</button>)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1 px-1">{"Min"}</p>
            <div className="max-h-40 overflow-y-auto grid grid-cols-3 gap-1 pe-1">
              {mins.map(m => <button key={m} type="button" onClick={() => set(hh || "00", m)} className={cell(m === mm)}>{m}</button>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

/* ── Form select input ── */
const SelectInput = React.memo(function SelectInput({ label, value, onChange, options, icon, renderLabel, selectLabel, tier, help }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; icon?: React.ReactNode;
  renderLabel?: (o: string) => string; selectLabel?: string; tier?: FieldTier; help?: string;
}) {
  return (
    <div>
      <label className="text-xs text-[var(--text-faint)] mb-1 flex items-center gap-1">{label}<FieldMark tier={tier} />{help && <GuidanceTip guidanceId={help} size="xs" />}</label>
      <div className="relative">
        {icon && <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)] pointer-events-none">{icon}</span>}
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full h-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors appearance-none cursor-pointer ${icon ? "ps-9 pe-3" : "px-3"}`}
        >
          <option value="" className="bg-[var(--bg-secondary)]">{selectLabel ?? "Select..."}</option>
          {options.map(o => <option key={o} value={o} className="bg-[var(--bg-secondary)]">{renderLabel ? renderLabel(o) : o}</option>)}
        </select>
        <AngleDownIcon size={14} className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)] pointer-events-none" />
      </div>
    </div>
  );
});

/* ── Add button ── */
const AddButton = React.memo(function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 text-sm text-[var(--text-subtle)] hover:text-[var(--text-primary)] py-2 transition-colors">
      <div className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center">
        <PlusIcon size={14} className="text-[var(--text-muted)]" />
      </div>
      {label}
    </button>
  );
});

/* ── Remove button ── */
const RemoveBtn = React.memo(function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 hover:bg-[var(--bg-surface-bright)] transition-colors">
      <MinusIcon size={14} className="text-[var(--text-muted)]" />
    </button>
  );
});

/* ── Tag/Chip input — controlled, dedupes, Enter or click-to-add ── */
const TagInput = React.memo(function TagInput({
  values, onChange, placeholder, icon, addLabel, duplicateLabel,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  icon?: React.ReactNode;
  addLabel: string;
  duplicateLabel?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const [dupHint, setDupHint] = React.useState(false);
  const trimmed = draft.trim();
  const isDup = !!trimmed && values.some((v) => v.toLowerCase() === trimmed.toLowerCase());
  const canAdd = trimmed.length > 0 && !isDup;
  const commit = () => {
    if (!trimmed) return;
    if (isDup) { setDupHint(true); window.setTimeout(() => setDupHint(false), 1600); return; }
    onChange([...values, trimmed]);
    setDraft("");
    setDupHint(false);
  };
  return (
    <div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map((b, i) => (
            <span key={`${b}-${i}`} className="group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
              {b}
              <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))} aria-label={`Remove ${b}`} className="w-4 h-4 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--accent,#0066FF)]/15 hover:text-[var(--accent,#0066FF)] transition-colors">
                <CrossIcon size={9} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none">{icon}</span>}
          <input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); if (dupHint) setDupHint(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
            placeholder={placeholder}
            className={`w-full h-9 ${icon ? "pl-9" : "pl-3"} pr-3 rounded-lg bg-[var(--bg-surface)] border ${isDup && draft.length > 0 ? "border-amber-400/50" : "border-[var(--border-color)]"} text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors`}
          />
        </div>
        <button
          type="button"
          onClick={commit}
          disabled={!canAdd}
          className={`h-9 px-3.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${canAdd ? "bg-[var(--accent,#0066FF)] text-white hover:opacity-90" : "bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-ghost)] cursor-not-allowed"}`}
        >
          <PlusIcon size={12} />
          {addLabel}
        </button>
      </div>
      {dupHint && duplicateLabel && (
        <p className="text-[10.5px] text-amber-400 mt-1.5">{duplicateLabel}</p>
      )}
    </div>
  );
});

/* ── Inline label select ── */
const LabelSelect = React.memo(function LabelSelect({ value, onChange, options, renderLabel }: { value: string; onChange: (v: string) => void; options: string[]; renderLabel?: (o: string) => string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-10 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] font-medium outline-none cursor-pointer min-w-[80px]"
    >
      {options.map(o => <option key={o} value={o} className="bg-[var(--bg-secondary)] text-[var(--text-primary)]">{renderLabel ? renderLabel(o) : o}</option>)}
    </select>
  );
});

/* ── Platform select with brand glyphs (custom dropdown — native <select>
      can't render SVG icons in its option list). ── */
const PlatformSelect = React.memo(function PlatformSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-10 w-full px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5 outline-none hover:border-[var(--border-color)] focus:border-[var(--border-focus)] transition-colors"
      >
        <BrandGlyph name={value} size={16} />
        <span className="truncate flex-1 text-start">{value}</span>
        <AngleDownIcon size={12} className={`text-[var(--text-dim)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-56 max-h-60 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-start hover:bg-[var(--bg-surface)] transition-colors ${o === value ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
            >
              <BrandGlyph name={o} size={18} />
              <span className="truncate">{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

/* ── Taxonomy helpers (saved KOLEEX divisions + categories) ───────────────── */
type TaxoOption = { value: string; label: string; iconUrl: string | null };
/* Which division a category belongs to — by longest matching code prefix
   (e.g. "XPR" / "XS" → division prefix "X"; "Md…" → "Md" before "M"). */
function divisionOfCategory(code: string) {
  return DIVISIONS
    .filter((d) => code.startsWith(d.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
}

/* ── Searchable taxonomy dropdown (icon + label) with "create new" ──────────
   Lists the saved divisions / categories and lets the user add a custom one. */
const TaxonomySelect = React.memo(function TaxonomySelect({ value, onChange, options, placeholder, createLabel }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; iconUrl: string | null }[];
  placeholder?: string;
  createLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setQuery(""); } }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [query, options]);

  if (creating) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
        />
        <button type="button" onClick={() => setCreating(false)} title="Pick from list" className="h-10 shrink-0 px-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
          <AngleDownIcon size={14} />
        </button>
      </div>
    );
  }
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm flex items-center gap-2 outline-none hover:border-[var(--border-focus)] focus:border-[var(--border-focus)] transition-colors"
      >
        {selected?.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.iconUrl} alt="" className="h-4 w-4 shrink-0 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        ) : null}
        <span className={`flex-1 text-start truncate ${value ? "text-[var(--text-primary)]" : "text-[var(--text-ghost)]"}`}>{selected?.label || value || placeholder}</span>
        <AngleDownIcon size={12} className={`text-[var(--text-dim)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
          <div className="p-2 border-b border-[var(--border-faint)]">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="w-full h-8 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--text-dim)]">No matches</div>
            ) : filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-start hover:bg-[var(--bg-surface)] transition-colors ${o.value === value ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
              >
                {o.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.iconUrl} alt="" className="h-5 w-5 shrink-0 object-contain" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                ) : <span className="h-5 w-5 shrink-0" />}
                <span className="truncate">{o.label}</span>
              </button>
            ))}
            {/* "Create new" scrolls with the list (not pinned). */}
            <button
              type="button"
              onClick={() => { onChange(query.trim()); setQuery(""); setOpen(false); setCreating(true); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] border-t border-[var(--border-faint)] hover:bg-[var(--bg-surface)]"
            >
              <PlusIcon size={14} /> {createLabel || "Create new"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

/* ── Department colour key ──
   Each owning department gets one functional colour, shared by the filter
   chips and the section owner badge so the operator can connect "this chip"
   to "these sections" at a glance. Classes are written out in full so
   Tailwind's JIT keeps them. */
const DEPT_TONE: Record<string, { dot: string; chipIdle: string; chipActive: string; badge: string }> = {
  procurement: { dot: "bg-blue-400",    chipIdle: "border-blue-500/40 text-blue-300 hover:bg-blue-500/10",       chipActive: "bg-blue-500 text-white border-blue-500",       badge: "border-blue-500/40 text-blue-300" },
  finance:     { dot: "bg-emerald-400", chipIdle: "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10", chipActive: "bg-emerald-500 text-white border-emerald-500", badge: "border-emerald-500/40 text-emerald-300" },
  legal:       { dot: "bg-violet-400",  chipIdle: "border-violet-500/40 text-violet-300 hover:bg-violet-500/10",   chipActive: "bg-violet-500 text-white border-violet-500",   badge: "border-violet-500/40 text-violet-300" },
  logistics:   { dot: "bg-amber-400",   chipIdle: "border-amber-500/40 text-amber-300 hover:bg-amber-500/10",     chipActive: "bg-amber-500 text-black border-amber-500",     badge: "border-amber-500/40 text-amber-300" },
  quality:     { dot: "bg-cyan-400",    chipIdle: "border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10",        chipActive: "bg-cyan-500 text-black border-cyan-500",       badge: "border-cyan-500/40 text-cyan-300" },
  commercial:  { dot: "bg-rose-400",    chipIdle: "border-rose-500/40 text-rose-300 hover:bg-rose-500/10",        chipActive: "bg-rose-500 text-white border-rose-500",       badge: "border-rose-500/40 text-rose-300" },
  general:     { dot: "bg-slate-400",   chipIdle: "border-slate-500/40 text-slate-300 hover:bg-slate-500/10",     chipActive: "bg-slate-500 text-white border-slate-500",     badge: "border-slate-500/40 text-slate-300" },
};

/* ── Form group label ──
   A quiet band header that visually groups the supplier form's many sections
   (Identity, Communication, Commercial, …). Call sites hide it while a
   department filter is active (so it never orphans above zero sections). */
function FormGroupLabel({ label }: { label: string }) {
  // Matches the Supplier 360 page's GroupLabel band so the add/edit form and
  // the detail page read with the same hierarchy.
  return (
    <div className="mx-4 md:mx-6 mt-6 mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-faint)] first:mt-2">{label}</div>
  );
}

/* ── Form section wrapper ──
   `owner` (optional) shows which department / role is responsible for filling
   this section — a supplier record spans Procurement, Finance, Compliance, QC…
   so the badge makes accountability obvious without splitting the record. */
const FormSection = React.memo(function FormSection({ title, icon, children, owner, ownerLabel, dept, activeDept, auditMap, updatedByLabel, kxComponent, kxModule, kxSection }: { title: string; icon?: React.ReactNode; children: React.ReactNode; owner?: string; ownerLabel?: string; dept?: string; activeDept?: string | null; auditMap?: Record<string, { name: string; at: string }>; updatedByLabel?: string; kxComponent?: string; kxModule?: string; kxSection?: string }) {
  /* Department filter: when a department chip is active, only render the
     sections that belong to it. Sections without a `dept` always show. */
  if (activeDept && dept && dept !== activeDept) return null;
  const tone = dept ? DEPT_TONE[dept] : undefined;
  /* Section-level attribution for this department, if recorded. */
  const audit = dept && auditMap ? auditMap[dept] : undefined;
  let auditDate = "";
  if (audit) { try { auditDate = new Date(audit.at).toLocaleDateString(); } catch { auditDate = ""; } }
  /* Card grammar mirrors the Supplier 360 page's `Sec` component: a rounded,
     bordered panel with a tinted icon chip + title header, then a padded body —
     so the add/edit form and the detail page look like one system. */
  return (
    <div
      className="mx-4 md:mx-6 my-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
      {...(kxComponent ? kxInspectAttrs({ component: kxComponent, module: kxModule || "Suppliers", section: kxSection }) : {})}
    >
      <div className="flex items-center justify-between gap-3 rounded-t-2xl border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/30 px-4 md:px-5 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">{icon}</span>}
          <h3 className="truncate text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
        </div>
        {owner && (
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-[var(--bg-surface)] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide ${tone ? tone.badge : "border-[var(--border-subtle)] text-[var(--text-dim)]"}`}
            title={ownerLabel ? `${ownerLabel}: ${owner}` : owner}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone ? tone.dot : "bg-[var(--text-ghost)]"}`} />
            {owner}
          </span>
        )}
      </div>
      <div className="px-4 md:px-5 py-4">
        {audit && (
          <div className="mb-3 flex items-center gap-1.5 text-[10px] text-[var(--text-ghost)]">
            <ClockIcon size={10} />
            <span>{updatedByLabel ?? "Updated by"} <span className="font-medium text-[var(--text-dim)]">{audit.name}</span>{auditDate ? ` · ${auditDate}` : ""}</span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
});

/* ── Customer Tab Bar — premium sticky tabs for Customer form & detail ── */
const CustomerTabBar = React.memo(function CustomerTabBar({
  activeTab,
  onChange,
  translate,
}: {
  activeTab: CustomerTab;
  onChange: (tab: CustomerTab) => void;
  translate?: (key: string, fallback: string) => string;
}) {
  const t = translate ?? ((_k: string, f: string) => f);
  return (
    <div className="sticky top-[56px] md:top-[64px] z-20 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-3 md:px-6 py-2.5">
        {CUSTOMER_TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 md:px-3.5 py-1.5 rounded-full text-xs md:text-[13px] font-medium transition-all whitespace-nowrap shrink-0 ${
                active
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] shadow-sm"
                  : "text-[var(--text-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
              }`}
            >
              <span className={active ? "text-[var(--text-inverted)]" : "text-[var(--text-faint)]"}>{tab.icon}</span>
              <span>{t(`customerTab.${tab.id}`, tab.label)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

/* ── Toggle switch — premium on/off switch used across Compliance/KYC booleans ── */
const ToggleSwitch = React.memo(function ToggleSwitch({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--border-focus)] transition-colors text-left"
    >
      <div className="min-w-0">
        <div className="text-sm text-[var(--text-primary)]">{label}</div>
        {hint && <div className="text-[11px] text-[var(--text-faint)] mt-0.5">{hint}</div>}
      </div>
      <div
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
          checked ? "bg-emerald-500/70" : "bg-[var(--bg-surface-active)]"
        }`}
      >
        <div
          className={`absolute top-0.5 start-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4 rtl:-translate-x-4" : ""
          }`}
        />
      </div>
    </button>
  );
});

/* ── Tag Editor — reusable chip input used for hs_codes, preferred_carriers, certifications_required, flags ── */
const TagEditor = React.memo(function TagEditor({
  label,
  values,
  onChange,
  placeholder,
  icon,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  const inputId = React.useId();
  return (
    <div>
      <label className="text-xs text-[var(--text-faint)] mb-1 block">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
            {v}
            <button onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]">
              <CrossIcon size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        {icon && <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)] pointer-events-none">{icon}</span>}
        <input
          id={inputId}
          placeholder={placeholder || "Press Enter to add"}
          className={`w-full h-9 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] ${icon ? "ps-9 pe-3" : "px-3"}`}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              const el = e.target as HTMLInputElement;
              const val = el.value.trim();
              if (val && !values.includes(val)) {
                onChange([...values, val]);
                el.value = "";
              }
            }
          }}
        />
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────────────────────────────────
   Customer Pipeline Block — shows CRM opportunities for a given contact.
   Rendered in the Commercial tab of the Customer detail view. Each row
   deep-links to /crm?opportunity=<id> so the full deal is one click away.
   ───────────────────────────────────────────────────────────────────────── */
const CustomerPipelineBlock = React.memo(function CustomerPipelineBlock({
  contactId,
  translate,
}: {
  contactId: string;
  translate: (key: string, fallback: string) => string;
}) {
  const t = translate;
  const [opps, setOpps] = useState<CrmOpportunityWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const rows = await fetchOpportunities({ contactId, includeArchived: true });
      if (!cancelled) {
        setOpps(rows);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contactId]);

  const { open, won, lost, pipelineValue, weightedValue, lastWonAt } = useMemo(() => {
    let open = 0, won = 0, lost = 0;
    let pipelineValue = 0, weightedValue = 0;
    let lastWonAt: string | null = null;
    for (const o of opps) {
      if (o.won_at) {
        won += 1;
        if (!lastWonAt || o.won_at > lastWonAt) lastWonAt = o.won_at;
      } else if (o.lost_at) {
        lost += 1;
      } else if (!o.archived_at) {
        open += 1;
        pipelineValue += o.expected_revenue || 0;
        weightedValue += (o.expected_revenue || 0) * (o.probability || 0) / 100;
      }
    }
    return { open, won, lost, pipelineValue, weightedValue, lastWonAt };
  }, [opps]);

  const fmt = (n: number) => {
    if (!n) return "$0";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
    return `$${Math.round(n).toLocaleString()}`;
  };

  /* React-Compiler: anchor "now" once at first render so the relative-day
     math stays referentially stable. A live ticker isn't needed — pipeline
     dates only meaningfully change when the page is re-mounted. */
  const [nowMs] = useState(() => Date.now());
  const relDate = (iso: string | null) => {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return null;
    const diff = Math.round((then - nowMs) / 86_400_000);
    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, tone: "overdue" as const };
    if (diff === 0) return { label: t("pipeline.today", "today"), tone: "soon" as const };
    if (diff <= 7) return { label: `${diff}d`, tone: "soon" as const };
    return { label: `${diff}d`, tone: "neutral" as const };
  };

  /* Split for display: open first, then last 3 won/lost for history. */
  const openOpps = opps.filter(o => !o.won_at && !o.lost_at && !o.archived_at);
  const closedOpps = opps.filter(o => o.won_at || o.lost_at).slice(0, 3);

  return (
    <div className="border-b border-[var(--border-color)] px-4 md:px-6 py-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-dim)]"><TrendingUpIcon size={14} /></span>
          <h3 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">
            {t("section.pipeline", "Pipeline")}
          </h3>
        </div>
        <Link
          href={`/crm?contact=${contactId}`}
          className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1"
        >
          {t("pipeline.openInCrm", "Open in CRM")} <ExternalLinkIcon size={10} />
        </Link>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] px-3 py-2.5">
          <div className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("pipeline.open", "Open")}</div>
          <div className="text-lg font-semibold text-[var(--text-primary)] mt-0.5">{open}</div>
        </div>
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] px-3 py-2.5">
          <div className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("pipeline.pipelineValue", "Pipeline")}</div>
          <div className="text-lg font-semibold text-[var(--text-primary)] mt-0.5">{fmt(pipelineValue)}</div>
          {weightedValue > 0 && (
            <div className="text-[10px] text-[var(--text-faint)] mt-0.5">
              {fmt(weightedValue)} {t("pipeline.weighted", "weighted")}
            </div>
          )}
        </div>
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
          <div className="text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider">{t("pipeline.won", "Won")}</div>
          <div className="text-lg font-semibold text-emerald-400 mt-0.5">{won}</div>
          {lastWonAt && (
            <div className="text-[10px] text-emerald-400/70 mt-0.5">
              {new Date(lastWonAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </div>
          )}
        </div>
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] px-3 py-2.5">
          <div className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("pipeline.lost", "Lost")}</div>
          <div className="text-lg font-semibold text-[var(--text-primary)] mt-0.5">{lost}</div>
        </div>
      </div>

      {/* Open opportunities list */}
      {loading ? (
        <div className="text-[11px] text-[var(--text-faint)] py-4 text-center">{t("pipeline.loading", "Loading…")}</div>
      ) : openOpps.length === 0 && closedOpps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] px-4 py-6 text-center">
          <div className="text-sm text-[var(--text-subtle)] mb-2">{t("pipeline.empty", "No deals yet")}</div>
          <Link
            href={`/crm?contact=${contactId}&new=1`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-xs font-medium hover:opacity-90"
          >
            <PlusIcon size={12} /> {t("pipeline.newDeal", "New deal")}
          </Link>
        </div>
      ) : (
        <>
          {openOpps.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {openOpps.map(o => {
                const due = relDate(o.expected_close_date);
                return (
                  <Link
                    key={o.id}
                    href={`/crm?opportunity=${o.id}`}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    {/* Stage chip */}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--bg-surface-hover)] text-[var(--text-subtle)] shrink-0 max-w-[100px] truncate">
                      {o.stage?.name || "—"}
                    </span>
                    {/* Name + owner */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">{o.name}</div>
                      {o.owner && (
                        <div className="text-[11px] text-[var(--text-faint)] truncate">
                          {o.owner.full_name || o.owner.username}
                        </div>
                      )}
                    </div>
                    {/* Revenue + date */}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{fmt(o.expected_revenue || 0)}</div>
                      {due && (
                        <div className={`text-[11px] ${
                          due.tone === "overdue" ? "text-red-400"
                          : due.tone === "soon" ? "text-amber-400"
                          : "text-[var(--text-faint)]"
                        }`}>
                          {due.label}
                        </div>
                      )}
                    </div>
                    <ExternalLinkIcon size={12} className="text-[var(--text-ghost)] group-hover:text-[var(--text-subtle)] shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}

          {closedOpps.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                {t("pipeline.recent", "Recent")}
              </div>
              <div className="space-y-1">
                {closedOpps.map(o => (
                  <Link
                    key={o.id}
                    href={`/crm?opportunity=${o.id}`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${o.won_at ? "bg-emerald-400" : "bg-[var(--text-ghost)]"}`} />
                    <div className="flex-1 min-w-0 text-xs text-[var(--text-subtle)] truncate">{o.name}</div>
                    <span className="text-[11px] text-[var(--text-faint)] shrink-0">{fmt(o.expected_revenue || 0)}</span>
                    <span className={`text-[10px] font-medium shrink-0 ${o.won_at ? "text-emerald-400" : "text-[var(--text-dim)]"}`}>
                      {o.won_at ? t("pipeline.wonLabel", "Won") : t("pipeline.lostLabel", "Lost")}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

/* ── Birthday Picker (DD/MM/YYYY) ── */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const BirthdayPicker = React.memo(function BirthdayPicker({ value, onChange, dayLabel, monthLabel, yearLabel, renderMonth }: {
  value: string; onChange: (v: string) => void;
  dayLabel?: string; monthLabel?: string; yearLabel?: string; renderMonth?: (m: string) => string;
}) {
  const parts = value ? value.split("-") : ["", "", ""];
  const year = parts[0] || "";
  const month = parts[1] || "";
  const day = parts[2] || "";

  const update = (d: string, m: string, y: string) => {
    if (d && m && y) onChange(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    else if (!d && !m && !y) onChange("");
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className="text-xs text-[var(--text-faint)] mb-1 block">{dayLabel ?? "Day"}</label>
        <select value={day} onChange={e => update(e.target.value, month, year)} className="w-full h-10 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] outline-none cursor-pointer">
          <option value="" className="bg-[var(--bg-secondary)]">DD</option>
          {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={String(i + 1).padStart(2, "0")} className="bg-[var(--bg-secondary)]">{i + 1}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-[var(--text-faint)] mb-1 block">{monthLabel ?? "Month"}</label>
        <select value={month} onChange={e => update(day, e.target.value, year)} className="w-full h-10 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] outline-none cursor-pointer">
          <option value="" className="bg-[var(--bg-secondary)]">MM</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")} className="bg-[var(--bg-secondary)]">{renderMonth ? renderMonth(m) : m}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-[var(--text-faint)] mb-1 block">{yearLabel ?? "Year"}</label>
        <select value={year} onChange={e => update(day, month, e.target.value)} className="w-full h-10 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] outline-none cursor-pointer">
          <option value="" className="bg-[var(--bg-secondary)]">YYYY</option>
          {Array.from({ length: 100 }, (_, i) => { const y = currentYear - i; return <option key={y} value={String(y)} className="bg-[var(--bg-secondary)]">{y}</option>; })}
        </select>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   COUNTRY / PROVINCE / CITY CASCADE COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

interface CountryOption {
  name: string;
  isoCode: string;
  flag: string;
}

const ALL_COUNTRIES: CountryOption[] = Country.getAllCountries().map(c => ({
  name: c.name,
  isoCode: c.isoCode,
  flag: countryCodeToFlag(c.isoCode),
}));

/* All country names — for the Registration Country dropdown. */
const COUNTRY_NAMES: string[] = ALL_COUNTRIES.map(c => c.name);
/* Bidirectional lookups so a country stored as only a code (→ full name) or
   only a name (→ ISO code for the flag) can always be resolved to both. */
const COUNTRY_CODE_TO_NAME: Map<string, string> = new Map(
  ALL_COUNTRIES.map(c => [c.isoCode.toUpperCase(), c.name]),
);
const COUNTRY_NAME_TO_CODE: Map<string, string> = new Map(
  ALL_COUNTRIES.map(c => [c.name.trim().toLowerCase(), c.isoCode.toUpperCase()]),
);
/** Resolve a contact's flag emoji from its country_code, or from the free-text
 *  country name (which sometimes holds a full name OR a 2-letter ISO code).
 *  Returns "" when nothing resolves, so callers can omit the flag entirely. */
function contactFlag(country_code?: string | null, country?: string | null): string {
  let code = String(country_code || "").trim().toUpperCase();
  if (!code && country) {
    const raw = String(country).trim();
    code = COUNTRY_NAME_TO_CODE.get(raw.toLowerCase())
      || (COUNTRY_CODE_TO_NAME.has(raw.toUpperCase()) ? raw.toUpperCase() : "");
  }
  return countryCodeToFlag(code);
}
/* Year options for "Year Established" — current year back to 1950. */
const ESTABLISHED_YEARS: string[] = (() => {
  const now = new Date().getFullYear();
  return Array.from({ length: now - 1949 }, (_, i) => String(now - i));
})();

/* ── Phone dial codes (built from the same country dataset) ───────────────── */
interface DialCode { iso: string; name: string; code: string; flag: string; }
const DIAL_CODES: DialCode[] = Country.getAllCountries()
  .map(c => ({ iso: c.isoCode, name: c.name, code: String(c.phonecode || "").replace(/^\+/, "").trim(), flag: countryCodeToFlag(c.isoCode) }))
  .filter(c => c.code)
  .sort((a, b) => a.name.localeCompare(b.name));
/* Longest dial code first — so "+1" doesn't shadow "+1-xxx" style codes when parsing. */
const DIAL_BY_LEN = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length);

/** Split a stored phone string ("+86 138…") into { code, number }. */
function splitPhone(value: string): { code: string; number: string } {
  const v = (value || "").trim();
  if (v.startsWith("+")) {
    const digits = v.slice(1).replace(/^\s+/, "");
    const match = DIAL_BY_LEN.find(d => digits.replace(/[\s-]/g, "").startsWith(d.code));
    if (match) {
      // Strip the matched code from the (space/dash-normalised) remainder.
      const compact = digits.replace(/[\s-]/g, "");
      const rest = compact.slice(match.code.length);
      return { code: match.code, number: rest };
    }
  }
  return { code: "", number: v };
}

/* ── Phone input with searchable country-code selector ────────────────────── */
const PhoneField = React.memo(function PhoneField({ label, value, onChange, placeholder, defaultIso }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; defaultIso?: string;
}) {
  const { lang } = useTranslation(contactsT);
  const parsed = splitPhone(value);
  const defaultCode = defaultIso ? (DIAL_CODES.find(d => d.iso === defaultIso)?.code ?? "") : "";
  const [selCode, setSelCode] = useState<string>(() => parsed.code || defaultCode);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // If the stored value already carries a dial code (e.g. editing), adopt it.
  useEffect(() => {
    const p = splitPhone(value).code;
    if (p && p !== selCode) setSelCode(p);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function h(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setQuery(""); } }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const number = parsed.number;
  const emit = (code: string, num: string) => {
    const n = num.trim();
    if (!n) { onChange(""); return; }
    onChange(code ? `+${code} ${n}` : n);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return DIAL_CODES;
    return DIAL_CODES.filter(d => d.name.toLowerCase().includes(q) || countryNameLocalized(d.iso, lang, d.name).toLowerCase().includes(q) || d.code.startsWith(q) || d.iso.toLowerCase().includes(q));
  }, [query, lang]);

  const sel = DIAL_CODES.find(d => d.code === selCode);

  return (
    <div>
      {label && <label className="text-xs text-[var(--text-faint)] mb-1 block">{label}</label>}
      <div ref={wrapRef} className="relative flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="h-10 shrink-0 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm flex items-center gap-1.5 hover:border-[var(--border-focus)] transition-colors"
          aria-label="Select country code"
        >
          <span className="text-base">{sel?.flag ?? "🌐"}</span>
          <span className="text-[var(--text-secondary)] tabular-nums">{selCode ? `+${selCode}` : "+—"}</span>
          <AngleDownIcon size={12} className={`text-[var(--text-dim)] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={number}
          onChange={e => emit(selCode, sanPhone(e.target.value))}
          maxLength={20}
          placeholder={placeholder || label || "Phone number"}
          className="flex-1 h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors"
        />
        {open && (
          <div className="absolute z-50 top-11 start-0 w-64 max-h-60 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
            <div className="p-2 border-b border-[var(--border-faint)]">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search country or code…"
                className="w-full h-8 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[var(--text-dim)]">No matches</div>
              ) : filtered.map(d => (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => { setSelCode(d.code); emit(d.code, number); setOpen(false); setQuery(""); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-start hover:bg-[var(--bg-surface)] transition-colors ${d.code === selCode ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
                >
                  <span className="text-base">{d.flag}</span>
                  <span className="truncate flex-1">{countryNameLocalized(d.iso, lang, d.name)}</span>
                  <span className="text-[11px] text-[var(--text-ghost)] tabular-nums">+{d.code}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Messaging ID + QR uploader (text handle and/or QR image, drag-drop) ──── */
const MessagingIdField = React.memo(function MessagingIdField({
  label, icon, idValue, onIdChange, placeholder, idNode, qrValue, onQrChange, hero,
}: {
  label: string;
  icon?: React.ReactNode;
  idValue?: string;
  onIdChange?: (v: string) => void;
  placeholder?: string;
  idNode?: React.ReactNode;
  qrValue: string;
  onQrChange: (v: string) => void;
  hero?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const accept = (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) return; // PNG / JPG only
    compressImage(file, 600, 0.85).then(onQrChange);
  };
  const qrBox = qrValue ? (
    <div className="relative shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrValue} alt={`${label} QR`} className="h-24 w-24 rounded-lg border border-[var(--border-color)] object-cover bg-white" />
      <button type="button" onClick={() => onQrChange("")} aria-label="Remove QR" className="absolute -top-2 -end-2 h-6 w-6 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center shadow">
        <CrossIcon size={12} />
      </button>
    </div>
  ) : (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files?.[0]); }}
      className={`flex h-24 w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center transition-colors ${drag ? "border-[var(--border-focus)] bg-[var(--bg-surface)]" : "border-[var(--border-color)] hover:border-[var(--border-focus)]"}`}
    >
      <ScanLineIcon size={16} className="text-[var(--text-dim)]" />
      <span className="px-1 text-[9px] leading-tight text-[var(--text-dim)]">Drop QR<br />PNG / JPG</span>
      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
    </label>
  );
  return (
    <div className={`rounded-xl border bg-[var(--bg-surface-subtle)] p-3 ${hero ? "border-[var(--border-focus)]" : "border-[var(--border-color)]"}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[var(--text-muted)]">{icon ?? <MessageSquareIcon size={14} />}</span>
        <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
        {hero && <span className="ms-auto rounded-full bg-[var(--bg-inverted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-inverted)]">Primary</span>}
      </div>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {idNode ?? (
            <input
              value={idValue ?? ""}
              onChange={(e) => onIdChange?.(e.target.value)}
              placeholder={placeholder}
              className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors"
            />
          )}
          <p className="mt-1.5 text-[10px] text-[var(--text-faint)]">Add the ID/handle, the QR image, or both.</p>
        </div>
        {qrBox}
      </div>
    </div>
  );
});

/* ── Document / photo uploader (landscape, drag-drop PNG/JPG) ─────────────── */
const ImageDropField = React.memo(function ImageDropField({
  label, value, onChange, hint, icon, tier,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  icon?: React.ReactNode;
  tier?: FieldTier;
}) {
  const [drag, setDrag] = useState(false);
  const accept = (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) return; // PNG / JPG only
    compressImage(file, 1600, 0.85).then(onChange);
  };
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
        <span className="text-[var(--text-muted)]">{icon ?? <ImageRawIcon size={14} />}</span>
        {label}<FieldMark tier={tier} />
      </label>
      {value ? (
        <div className="relative w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-48 w-full rounded-lg border border-[var(--border-color)] object-contain bg-white" />
          <button type="button" onClick={() => onChange("")} aria-label="Remove" className="absolute -top-2 -end-2 h-6 w-6 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center shadow">
            <CrossIcon size={12} />
          </button>
        </div>
      ) : (
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files?.[0]); }}
          className={`flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-center transition-colors ${drag ? "border-[var(--border-focus)] bg-[var(--bg-surface)]" : "border-[var(--border-color)] hover:border-[var(--border-focus)]"}`}
        >
          <ImageRawIcon size={20} className="text-[var(--text-dim)]" />
          <span className="px-2 text-[11px] leading-tight text-[var(--text-dim)]">{hint ?? "Drop image — PNG / JPG"}</span>
          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );
});

/* ── Date field — fully custom calendar popover (matches Koleex UI) ──────────
   The native <input type=date> popup is drawn by the OS and can't be themed, so
   this is a hand-built calendar styled with the Hub design tokens: works in both
   light and dark mode, blue accent for the selected day, month/year navigation,
   Today / Clear actions. Stores the value as ISO yyyy-mm-dd (unchanged contract). */
const DATE_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DATE_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function parseISODate(v: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
  if (!m) return null;
  return { y: +m[1], m: +m[2] - 1, d: +m[3] };
}
function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }

/* ISO yyyy-mm-dd → easy-to-edit dd/mm/yyyy display. */
function isoToDisplay(v: string): string {
  const p = parseISODate(v);
  return p ? `${pad2(p.d)}/${pad2(p.m + 1)}/${p.y}` : "";
}
/* Build a validated ISO date, or null if the day/month/year don't form a real date. */
function makeISO(y: number, mo: number, d: number): string | null {
  if (y < 1000 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}
/* Accept what a person naturally types: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy,
   2-digit years, or ISO yyyy-mm-dd. Returns ISO or null. */
function parseTypedDate(s: string): string | null {
  const t = (s || "").trim();
  if (!t) return null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) return makeISO(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(t))) return makeISO(+m[3], +m[2], +m[1]);
  if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/.exec(t))) return makeISO(2000 + +m[3], +m[2], +m[1]);
  return null;
}

const DateField = React.memo(function DateField({ value, onChange, disabled, className }: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  const parsed = parseISODate(value);
  const today = new Date();

  // The text the user is typing. Stays in sync with the stored value when not editing.
  const [text, setText] = useState(() => isoToDisplay(value));
  useEffect(() => { if (!focusedRef.current) setText(isoToDisplay(value)); }, [value]);

  const commitText = (raw: string) => {
    setText(raw);
    if (raw.trim() === "") { onChange(""); return; }
    const iso = parseTypedDate(raw);
    if (iso) onChange(iso);
  };
  const onBlurText = () => {
    focusedRef.current = false;
    const iso = parseTypedDate(text);
    setText(iso ? isoToDisplay(iso) : (text.trim() === "" ? "" : isoToDisplay(value)));
  };
  // Month currently shown in the calendar grid.
  const [view, setView] = useState(() => parsed ? { y: parsed.y, m: parsed.m } : { y: today.getFullYear(), m: today.getMonth() });

  // Re-sync the visible month when the value changes externally / on (re)open.
  useEffect(() => {
    if (open) {
      const p = parseISODate(value);
      setView(p ? { y: p.y, m: p.m } : { y: new Date().getFullYear(), m: new Date().getMonth() });
    }
  }, [open, value]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const toggle = () => {
    if (disabled) return;
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setOpenUp(window.innerHeight - r.bottom < 360); // flip up near the bottom of the viewport
    }
    setOpen(o => !o);
  };

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const stepMonth = (delta: number) => setView(v => {
    const m = v.m + delta;
    return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
  });
  const pick = (d: number) => { const iso = `${view.y}-${pad2(view.m + 1)}-${pad2(d)}`; onChange(iso); setText(isoToDisplay(iso)); setOpen(false); };

  const isSel = (d: number) => parsed && parsed.y === view.y && parsed.m === view.m && parsed.d === d;
  const isToday = (d: number) => today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d;

  const Chevron = ({ dir }: { dir: "left" | "right" }) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <CalendarRawIcon size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
      {/* Type the date directly (dd/mm/yyyy) — fastest path */}
      <input
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        placeholder="dd/mm/yyyy"
        onFocus={() => { focusedRef.current = true; }}
        onBlur={onBlurText}
        onChange={e => commitText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); setOpen(false); } }}
        className={`w-full h-10 ps-9 pe-10 rounded-lg bg-[var(--bg-surface)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none transition-colors disabled:opacity-30 ${open ? "border-[var(--border-focus)]" : "border-[var(--border-color)] hover:border-[var(--border-focus)] focus:border-[var(--border-focus)]"}`}
      />
      {/* Calendar toggle */}
      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-label="Open calendar"
        className="absolute end-1.5 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30"
      >
        <CalendarRawIcon size={15} />
      </button>

      {open && (
        <div className={`absolute z-50 ${openUp ? "bottom-full mb-1" : "top-full mt-1"} start-0 w-[17rem] rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 shadow-2xl`}>
          {/* Header: month/year + nav */}
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => stepMonth(-1)} aria-label="Previous month" className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"><Chevron dir="left" /></button>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{DATE_MONTHS[view.m]} {view.y}</span>
            <button type="button" onClick={() => stepMonth(1)} aria-label="Next month" className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"><Chevron dir="right" /></button>
          </div>
          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DATE_WEEKDAYS.map((w, i) => (
              <div key={i} className="h-7 flex items-center justify-center text-[10px] font-semibold text-[var(--text-dim)]">{w}</div>
            ))}
          </div>
          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => d === null ? <div key={i} className="h-8" /> : (
              <button
                key={i}
                type="button"
                onClick={() => pick(d)}
                className={`h-8 rounded-lg text-sm flex items-center justify-center transition-colors ${
                  isSel(d)
                    ? "bg-[var(--accent,#0066FF)] text-white font-semibold"
                    : isToday(d)
                    ? "text-[var(--text-primary)] ring-1 ring-inset ring-[var(--border-focus)] hover:bg-[var(--bg-surface)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          {/* Actions */}
          <div className="mt-2 flex items-center justify-between border-t border-[var(--border-color)] pt-2">
            <button type="button" onClick={() => { onChange(""); setText(""); setOpen(false); }} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)]">Clear</button>
            <button type="button" onClick={() => { const t = new Date(); const iso = `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`; onChange(iso); setText(isoToDisplay(iso)); setOpen(false); }} className="text-xs font-medium text-[var(--accent,#0066FF)] hover:opacity-80">Today</button>
          </div>
        </div>
      )}
    </div>
  );
});

/* ── Suggest input — free text with a branded suggestions dropdown ──────────
   Replaces the native <datalist> (whose popup is OS-drawn and ignores the
   theme). Type freely, or pick a suggestion; the list filters as you type and
   is styled with Hub tokens (opaque, light/dark aware). */
const SuggestInput = React.memo(function SuggestInput({ label, value, onChange, options, placeholder, icon }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const q = value.trim().toLowerCase();
  const filtered = q ? options.filter(o => o.toLowerCase().includes(q)) : options;
  return (
    <div>
      <label className="text-xs text-[var(--text-faint)] mb-1 block">{label}</label>
      <div ref={wrapRef} className="relative">
        {icon && <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)] pointer-events-none">{icon}</span>}
        <input
          value={value}
          onChange={e => { onChange(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}
          placeholder={placeholder || label}
          className={`w-full h-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors cursor-pointer ${icon ? "ps-9 pe-9" : "ps-3 pe-9"}`}
        />
        <AngleDownIcon size={14} className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)] pointer-events-none" />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full mt-1 start-0 w-full max-h-52 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1 shadow-2xl">
            {filtered.map((o, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onChange(o); setOpen(false); }}
                className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-colors ${o === value ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"}`}
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Score slider — drag a 0–N value instead of typing a number ─────────────
   Branded range input (blue fill), live readout, and a draggable thumb. Stores
   the value as a string to keep the existing field contract. */
const ScoreSlider = React.memo(function ScoreSlider({ label, value, onChange, max = 100, isAuto, onUseAuto, disabled = false, lockedNote }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  isAuto?: boolean;
  onUseAuto?: () => void;
  disabled?: boolean;
  lockedNote?: string;
}) {
  const has = value !== "" && value != null;
  const raw = parseInt(value || "", 10);
  const n = Number.isFinite(raw) ? Math.max(0, Math.min(max, raw)) : 0;
  const pct = Math.round((n / max) * 100);
  return (
    <div className={disabled ? "opacity-70" : undefined}>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs text-[var(--text-faint)]">{label}</label>
        <div className="flex items-center gap-2">
          {!disabled && onUseAuto && (isAuto ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-dim)]">✦ Auto</span>
          ) : (
            <button type="button" onClick={onUseAuto} className="text-[10px] font-medium text-[var(--accent,#0066FF)] hover:opacity-80">Use auto</button>
          ))}
          {disabled && lockedNote ? <span className="text-[10px] font-medium text-[var(--text-dim)]">🔒 {lockedNote}</span> : null}
          <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
            {has ? n : "—"}<span className="text-xs text-[var(--text-dim)]"> / {max}</span>
          </span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={n}
        disabled={disabled}
        onChange={(e) => { if (!disabled) onChange(e.target.value); }}
        aria-label={label}
        className={`h-2 w-full appearance-none rounded-full outline-none ${disabled ? "cursor-not-allowed" : "cursor-pointer"} [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#0066FF] [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#0066FF]`}
        style={{ background: `linear-gradient(to right, #0066FF ${pct}%, var(--bg-surface-active) ${pct}%)` }}
      />
      <div className="mt-1 flex justify-between text-[10px] text-[var(--text-dim)]">
        <span>0</span><span>50</span><span>{max}</span>
      </div>
    </div>
  );
});

/* ── Segmented control — one-tap pick for short option sets (Low/Med/High) ──
   All choices visible at once, no dropdown to open. Click the active one again
   to clear. Colour-coded by meaning: green = good, amber = caution, red = bad.
   `polarity` flips which end is "good": "goodHigh" (stability/quality/trust →
   High is good) vs "goodLow" (risk/dependency/difficulty → Low is good). */
type SegTone = "emerald" | "amber" | "rose" | "neutral";
const SEG_TONE_TEXT: Record<SegTone, string> = {
  emerald: "text-emerald-400", amber: "text-amber-400", rose: "text-rose-400", neutral: "text-[var(--text-secondary)]",
};
const SEG_TONE_SEL: Record<SegTone, string> = {
  emerald: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/40",
  amber: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/40",
  rose: "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/40",
  neutral: "bg-[var(--bg-inverted)] text-[var(--text-inverted)]",
};
function segTone(option: string, polarity: "goodHigh" | "goodLow"): SegTone {
  const o = option.toLowerCase();
  if (o === "medium") return "amber";
  if (o === "critical") return "rose";
  if (o === "low") return polarity === "goodLow" ? "emerald" : "rose";
  if (o === "high") return polarity === "goodLow" ? "rose" : "emerald";
  return "neutral";
}
const SegmentedField = React.memo(function SegmentedField({ label, value, onChange, options, renderLabel, polarity = "goodHigh", layout = "stack" }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  renderLabel?: (o: string) => string;
  polarity?: "goodHigh" | "goodLow";
  layout?: "stack" | "row";
}) {
  const row = layout === "row";
  const pills = (
    <div className="flex w-full sm:flex-1 gap-0.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-0.5">
      {options.map((o) => {
        const sel = value === o;
        const tone = segTone(o, polarity);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(sel ? "" : o)}
            className={`min-w-0 flex-1 h-8 rounded-md text-[11px] font-semibold truncate transition-colors ${sel ? SEG_TONE_SEL[tone] : `${SEG_TONE_TEXT[tone]} hover:bg-[var(--bg-surface-hover)]`}`}
          >
            {renderLabel ? renderLabel(o) : o}
          </button>
        );
      })}
    </div>
  );
  if (row) {
    return (
      <div className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
        <label className="text-xs text-[var(--text-secondary)] sm:w-44 sm:shrink-0">{label}</label>
        {pills}
      </div>
    );
  }
  return (
    <div>
      <label className="text-xs text-[var(--text-faint)] mb-1 block">{label}</label>
      {pills}
    </div>
  );
});

/* ── Searchable Country Dropdown ── */
function CountryDropdown({ value, displayValue, onChange, label, placeholder, noResults }: {
  value: string; // isoCode
  displayValue: string; // country name shown
  onChange: (name: string, isoCode: string) => void;
  label?: string; placeholder?: string; noResults?: string;
}) {
  const { lang } = useTranslation(contactsT);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_COUNTRIES;
    const q = query.toLowerCase();
    return ALL_COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.isoCode.toLowerCase().includes(q) || countryNameLocalized(c.isoCode, lang, c.name).toLowerCase().includes(q));
  }, [query, lang]);

  const handleSelect = (c: CountryOption) => {
    onChange(c.name, c.isoCode);
    setOpen(false);
    setQuery("");
  };

  const selectedFlag = value ? countryCodeToFlag(value) : "";

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-xs text-[var(--text-faint)] mb-1 block">{label ?? "Country"}</label>
      <div
        className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] flex items-center gap-2 cursor-pointer focus-within:border-[var(--border-focus)] transition-colors"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        {selectedFlag && <span className="text-base">{selectedFlag}</span>}
        <input
          ref={inputRef}
          type="text"
          value={open ? query : (value ? countryNameLocalized(value, lang, displayValue) : displayValue)}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Search country..."}
          className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)]"
        />
        <AngleDownIcon size={14} className={`text-[var(--text-dim)] transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--text-dim)]">{noResults ?? "No countries found"}</div>
          ) : (
            filtered.map(c => (
              <button
                key={c.isoCode}
                onClick={() => handleSelect(c)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-start hover:bg-[var(--bg-surface)] transition-colors ${
                  c.isoCode === value ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <span className="text-base">{c.flag}</span>
                <span className="truncate">{countryNameLocalized(c.isoCode, lang, c.name)}</span>
                <span className="text-[10px] text-[var(--text-ghost)] ml-auto">{c.isoCode}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Province/State Dropdown ── */
function ProvinceDropdown({ countryCode, value, displayValue, onChange, label, placeholder, noResults }: {
  countryCode: string;
  value: string; // stateCode
  displayValue: string;
  onChange: (name: string, isoCode: string) => void;
  label?: string; placeholder?: string; noResults?: string;
}) {
  const { lang } = useTranslation(contactsT);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const states = useMemo(() => {
    if (!countryCode) return [];
    return State.getStatesOfCountry(countryCode);
  }, [countryCode]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return states;
    const q = query.toLowerCase();
    return states.filter(s => s.name.toLowerCase().includes(q) || s.isoCode.toLowerCase().includes(q) || provinceNameLocalized(countryCode, s.isoCode, lang, s.name).toLowerCase().includes(q));
  }, [query, states, countryCode, lang]);

  if (states.length === 0) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-xs text-[var(--text-faint)] mb-1 block">{label ?? "Province / State"}</label>
      <div
        className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] flex items-center gap-2 cursor-pointer focus-within:border-[var(--border-focus)] transition-colors"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        <input
          ref={inputRef}
          type="text"
          value={open ? query : (value ? provinceNameLocalized(countryCode, value, lang, displayValue) : displayValue)}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Search province..."}
          className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)]"
        />
        <AngleDownIcon size={14} className={`text-[var(--text-dim)] transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--text-dim)]">{noResults ?? "No provinces found"}</div>
          ) : (
            filtered.map(s => (
              <button
                key={s.isoCode}
                onClick={() => { onChange(s.name, s.isoCode); setOpen(false); setQuery(""); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-start hover:bg-[var(--bg-surface)] transition-colors ${
                  s.isoCode === value ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <span className="truncate">{provinceNameLocalized(countryCode, s.isoCode, lang, s.name)}</span>
                <span className="text-[10px] text-[var(--text-ghost)] ml-auto">{s.isoCode}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── City Dropdown ── */
function CityDropdown({ countryCode, stateCode, value, onChange, label, placeholder, noResults }: {
  countryCode: string;
  stateCode: string;
  value: string;
  onChange: (name: string) => void;
  label?: string; placeholder?: string; noResults?: string;
}) {
  const { lang } = useTranslation(contactsT);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cities = useMemo(() => {
    if (!countryCode) return [];
    // China: use our clean, complete prefecture-level list (the geo library's
    // China cities are English-only and noisy). Elsewhere use the library.
    if (countryCode === "CN") {
      const list = chinaCitiesForState(stateCode);
      if (list.length) return list.map((c) => ({ name: c.en }));
    }
    if (stateCode) return City.getCitiesOfState(countryCode, stateCode);
    return City.getCitiesOfCountry(countryCode) || [];
  }, [countryCode, stateCode]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return cities;
    const q = query.toLowerCase();
    return cities.filter(c => c.name.toLowerCase().includes(q) || cityNameLocalized(countryCode, c.name, lang).toLowerCase().includes(q));
  }, [query, cities, countryCode, lang]);

  // Fallback to plain text input if no city data available
  if (cities.length === 0) {
    return (
      <Input label={label ?? "City"} value={value} onChange={onChange} placeholder={label ?? "City"} />
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-xs text-[var(--text-faint)] mb-1 block">{label ?? "City"}</label>
      <div
        className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] flex items-center gap-2 cursor-pointer focus-within:border-[var(--border-focus)] transition-colors"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        <input
          ref={inputRef}
          type="text"
          value={open ? query : cityNameLocalized(countryCode, value, lang)}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Search city..."}
          className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)]"
        />
        <AngleDownIcon size={14} className={`text-[var(--text-dim)] transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--text-dim)]">{noResults ?? "No cities found"}</div>
          ) : (
            filtered.map((c, idx) => (
              <button
                key={`${c.name}-${idx}`}
                onClick={() => { onChange(c.name); setOpen(false); setQuery(""); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-start hover:bg-[var(--bg-surface)] transition-colors ${
                  c.name === value ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <span className="truncate">{cityNameLocalized(countryCode, c.name, lang)}</span>
                {cityNameLocalized(countryCode, c.name, lang) !== c.name && (
                  <span className="text-[10px] text-[var(--text-ghost)] ml-auto">{c.name}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DELETE CONFIRMATION HOST
   Self-contained modal driven by a window event. Keeping the open-state OUT
   of the giant Contacts component means firing a delete no longer re-renders
   the whole tree (list + Supplier 360) — which previously caused a ~1.7s lag
   just to open the confirm dialog.
   ═══════════════════════════════════════════════════════════════════════════ */
type DeleteResult = { ok: boolean; error?: string };
type PendingDelete = { id: string; name: string; title?: string; onConfirm: () => Promise<DeleteResult> | DeleteResult | void };
function DeleteConfirmHost({ t }: { t: (key: string, fallback?: string) => string }) {
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const handler = (e: Event) => { setErr(null); setBusy(false); setPending((e as CustomEvent<PendingDelete>).detail); };
    window.addEventListener("koleex:confirm-delete", handler as EventListener);
    return () => window.removeEventListener("koleex:confirm-delete", handler as EventListener);
  }, []);
  if (!pending) return null;
  const close = () => { if (!busy) { setPending(null); setErr(null); } };
  const confirm = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await pending.onConfirm();
      if (r && r.ok === false) { setErr(r.error || t("error.deleteFailed", "Couldn't delete. Please try again.")); setBusy(false); return; }
      setPending(null); setBusy(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e)); setBusy(false);
    }
  };
  return (
    <ScrollLockOverlay className="fixed inset-0 z-[60] bg-[var(--bg-overlay)] flex items-center justify-center p-4" onClick={close}>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{pending.title || t("delete.title")}</h3>
        <p className="text-sm text-[var(--text-subtle)] mb-6">
          {t("delete.confirm")} <strong className="text-[var(--text-primary)]">{pending.name}</strong>{t("delete.cannotUndo")}
        </p>
        {err ? <div className="mb-4 text-[12px] text-rose-400">{err}</div> : null}
        <div className="flex gap-3 justify-end">
          <button onClick={close} disabled={busy} className="px-4 py-2 rounded-lg text-sm border border-[var(--border-color)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50">
            {t("btn.cancel")}
          </button>
          <button onClick={confirm} disabled={busy} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50">
            {busy ? t("ts.saving", "Saving…") : t("btn.delete")}
          </button>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Contacts({ filterType }: { filterType?: ContactType } = {}) {
  /* ── i18n ── */
  const { t, lang } = useTranslation(contactsT);
  const router = useRouter();
  /** Translate a dropdown option value. Falls back to the raw value. */
  const tOpt = (val: string) => t("opt." + val, val);

  /* ── State ── */
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  /* Saved accounts/employees — used to pick WeChat group members. Fetched once;
     cheap (allowlisted columns, no blobs). */
  const [accountNames, setAccountNames] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/accounts", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!alive || !j?.accounts) return;
        const names = (j.accounts as { username?: string | null; login_email?: string | null }[])
          .map(a => (a.username || a.login_email || "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setAccountNames([...new Set(names)]);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [typeTab, setTypeTab] = useState<ContactType | "all">(filterType || "all");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);   // controls the suggestions dropdown
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);     // gates sensitive edits (internal score)
  useEffect(() => {
    let alive = true;
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j) setIsSuperAdmin(!!j.is_super_admin); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  /* Active/Archived status filter — surfaced only in the supplier view. */
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [form, setForm] = useState<ContactForm>({ ...EMPTY_FORM });
  /* Department filter for the supplier form — null = show all sections.
     Lets a Finance/Legal/QC owner collapse the form to just their fields. */
  const [supplierDept, setSupplierDept] = useState<string | null>(null);
  /* Section-level attribution: { dept_key: { name, at } } — who last edited
     each department's section of this supplier. Loaded when editing. */
  const [supplierSectionAudit, setSupplierSectionAudit] = useState<Record<string, { name: string; at: string }>>({});
  /* Supplier-only intelligence captured in the same form, written to the
     canonical tables after the base contact is created. */
  const [sIntel, setSIntel] = useState<SupplierIntel>(EMPTY_SINTEL);
  const setIntelFactory = (k: string, v: string | boolean) => setSIntel((p) => ({ ...p, factory: { ...p.factory, [k]: v } }));
  const setIntelRisk = (k: string, v: string | boolean) => setSIntel((p) => ({ ...p, risk: { ...p.risk, [k]: v } }));
  const setIntelNeg = (k: string, v: string) => setSIntel((p) => ({ ...p, neg: { ...p.neg, [k]: v } }));
  const setIntelSourcing = (k: string, v: string) => setSIntel((p) => ({ ...p, sourcing: { ...p.sourcing, [k]: v } }));
  const setRiskItem = (i: number, k: string, v: string) => setSIntel((p) => { const arr = [...p.riskItems]; arr[i] = { ...arr[i], [k]: v }; return { ...p, riskItems: arr }; });
  const addRiskItem = () => setSIntel((p) => ({ ...p, riskItems: [...p.riskItems, { dimension: "operational", severity: "medium", status: "open", title: "", description: "", mitigation: "" }] }));
  const removeRiskItem = (i: number) => setSIntel((p) => ({ ...p, riskItems: p.riskItems.filter((_, idx) => idx !== i) }));

  /* Auto-score: the Risk / Negotiation scores follow the Low/Med/High choices
     unless the user drags the slider (then it's manual until they hit "Use auto"). */
  const [riskScoreManual, setRiskScoreManual] = useState(false);
  const [negScoreManual, setNegScoreManual] = useState(false);
  const autoRiskScore = useMemo(() => avgRatingScore([
    [String(sIntel.risk.risk_level), "goodLow", LEVEL4_OPTS],
    [String(sIntel.risk.dependency_level), "goodLow", LEVEL4_OPTS],
    [String(sIntel.risk.geographic_risk), "goodLow", LEVEL3_OPTS],
    [String(sIntel.risk.compliance_level), "goodHigh", LEVEL3_OPTS],
    [String(sIntel.risk.capacity_level), "goodHigh", LEVEL3_OPTS],
    [String(sIntel.risk.financial_stability), "goodHigh", LEVEL3_OPTS],
    [String(sIntel.risk.delivery_stability), "goodHigh", LEVEL3_OPTS],
    [String(sIntel.risk.quality_stability), "goodHigh", LEVEL3_OPTS],
    [String(sIntel.risk.communication_quality), "goodHigh", LEVEL3_OPTS],
    [String(sIntel.risk.trust_level), "goodHigh", LEVEL3_OPTS],
    // Having a backup supplier is a risk mitigant → counts as a top mark when ticked.
    ...(sIntel.risk.backup_supplier_exists ? [["high", "goodHigh", LEVEL3_OPTS] as [string, "goodHigh" | "goodLow", string[]]] : []),
  ]), [sIntel.risk.risk_level, sIntel.risk.dependency_level, sIntel.risk.geographic_risk, sIntel.risk.compliance_level, sIntel.risk.capacity_level, sIntel.risk.financial_stability, sIntel.risk.delivery_stability, sIntel.risk.quality_stability, sIntel.risk.communication_quality, sIntel.risk.trust_level, sIntel.risk.backup_supplier_exists]);
  const autoNegScore = useMemo(() => avgRatingScore([
    [sIntel.neg.price_flexibility, "goodHigh", LEVEL3_OPTS],
    [sIntel.neg.moq_flexibility, "goodHigh", LEVEL3_OPTS],
    [sIntel.neg.payment_flexibility, "goodHigh", LEVEL3_OPTS],
    [sIntel.neg.leadtime_flexibility, "goodHigh", LEVEL3_OPTS],
    [sIntel.neg.volume_discount, "goodHigh", LEVEL3_OPTS],
    [sIntel.neg.contract_willingness, "goodHigh", LEVEL3_OPTS],
    [sIntel.neg.negotiation_difficulty, "goodLow", LEVEL3_OPTS],
    [sIntel.neg.sample_turnaround_speed, "goodHigh", LEVEL3_OPTS],
  ]), [sIntel.neg.price_flexibility, sIntel.neg.moq_flexibility, sIntel.neg.payment_flexibility, sIntel.neg.leadtime_flexibility, sIntel.neg.volume_discount, sIntel.neg.contract_willingness, sIntel.neg.negotiation_difficulty, sIntel.neg.sample_turnaround_speed]);
  useEffect(() => {
    if (riskScoreManual || autoRiskScore == null) return;
    setSIntel((p) => p.risk.internal_evaluation_score === String(autoRiskScore) ? p : ({ ...p, risk: { ...p.risk, internal_evaluation_score: String(autoRiskScore) } }));
  }, [autoRiskScore, riskScoreManual]);
  useEffect(() => {
    if (negScoreManual || autoNegScore == null) return;
    setSIntel((p) => p.neg.negotiation_score === String(autoNegScore) ? p : ({ ...p, neg: { ...p.neg, negotiation_score: String(autoNegScore) } }));
  }, [autoNegScore, negScoreManual]);
  const toggleIntelClass = (key: string) => setSIntel((p) => {
    const has = p.classifications.includes(key);
    const classifications = has ? p.classifications.filter((c) => c !== key) : [...p.classifications, key];
    const primary_class = has && p.primary_class === key ? (classifications[0] ?? "") : (!has && !p.primary_class ? key : p.primary_class);
    return { ...p, classifications, primary_class };
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTypeChooser, setShowTypeChooser] = useState(false);
  const [showCatalogImport, setShowCatalogImport] = useState(false);
  const [typeChooserStep, setTypeChooserStep] = useState<1 | 2>(1);
  const [expandedFamily, setExpandedFamily] = useState<number | null>(null);

  /* Division / category icons — loaded live from the same storage the Product
     Data app manages, so an icon swapped there shows here too.
     PERF: these two /api/storage/list calls are ONLY consumed by the create/
     edit form's taxonomy selects — fetching them on mount slowed the initial
     directory load for every visitor. Deferred until the form actually opens. */
  const [divisionLogos, setDivisionLogos] = useState<Record<string, string>>({});
  const [categoryLogos, setCategoryLogos] = useState<Record<string, string>>({});
  const taxonomyLogosRequested = useRef(false);
  useEffect(() => {
    if (view !== "form" || taxonomyLogosRequested.current) return;
    taxonomyLogosRequested.current = true;
    /* One-shot load; no cancellation — closing the form mid-flight should
       still cache the result for the next open (fallback icons cover the gap). */
    fetchDivisionLogos().then(setDivisionLogos).catch(() => {});
    fetchCategoryLogos().then(setCategoryLogos).catch(() => {});
  }, [view]);

  const divisionOptions: TaxoOption[] = useMemo(
    () => DIVISIONS.map((d) => ({ value: d.name, label: divisionNameLocalized(d.name, lang), iconUrl: divisionLogos[d.id] ?? taxonomyLogoUrl("divisions", d.id) })),
    [divisionLogos, lang],
  );
  /* Category list is scoped to the chosen division (falls back to all when none picked). */
  const categoryOptions: TaxoOption[] = useMemo(() => {
    const div = DIVISIONS.find((d) => d.name === form.division);
    if (!div) return []; // category depends on the chosen division
    return CATEGORIES
      .filter((c) => divisionOfCategory(c.code)?.id === div.id)
      .map((c) => ({ value: c.label, label: categoryNameLocalized(c.label, lang), iconUrl: categoryLogos[c.slug] ?? taxonomyLogoUrl("categories", c.slug) }));
  }, [categoryLogos, form.division, lang]);
  const [expandedResumeLine, setExpandedResumeLine] = useState<number | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Set true after a blocked save attempt so required fields highlight in red.
  const [triedSave, setTriedSave] = useState(false);
  // Distinguishes "fill required fields" (validation) from a real server error.
  const [saveErrorIsValidation, setSaveErrorIsValidation] = useState(false);
  // True while the full record (images/docs) is being fetched for an edit —
  // Save is blocked until it loads so we never overwrite unloaded images.
  const [formHydrating, setFormHydrating] = useState(false);
  // The full DB row as loaded for editing — used to send ONLY changed columns
  // on save (the row holds multi-MB base64 images; rewriting all of them every
  // save is what made saving slow/time out).
  const editOriginalRef = useRef<Record<string, unknown> | null>(null);
  const [rlsCopied, setRlsCopied] = useState(false);
  /* Customer premium tab — used by both form and detail views for customers */
  const [customerTab, setCustomerTab] = useState<CustomerTab>("overview");
  /* Reset to overview whenever the form/detail opens for a different customer */
  useEffect(() => {
    if (view === "form" || view === "detail") setCustomerTab("overview");
  }, [view, editingId, selectedId]);

  /* ── Load ── */
  // Scope context (tenant + role + SA flags) scopes every fetch to the
  // viewer's tenant. A customer-tenant account opening Customers sees
  // their own (empty) book; Koleex staff sees Koleex's book. Without
  // this, everyone would see Koleex's contacts regardless of tenant.
  const scopeCtx = useScopeContext();

  const loadContacts = useCallback(async () => {
    /* PERF — wait for the resolved scope before fetching. scopeCtx starts null
       for one render tick and then resolves from the (already-loaded) bootstrap
       cache; fetching on the null tick caused EVERY visit to download the
       directory twice (an "anon" fetch immediately superseded by the real one).
       PermissionGate only renders this page after bootstrap loads, so waiting
       here costs nothing and halves the network work. */
    if (!scopeCtx) return;
    /* PERF — warm start: paint the last-known directory instantly from
       sessionStorage (same pattern as the hub bootstrap warm-start), then
       refresh from the network in the background and silently replace it.
       Keyed by tenant + contact type so no cross-tenant/cross-app bleed. */
    const cacheKey = `kx_contacts_v1:${scopeCtx?.tenant_id || "anon"}:${filterType || "all"}`;
    let paintedFromCache = false;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as ContactRow[];
        if (Array.isArray(cached) && cached.length) {
          setContacts(cached);
          setLoading(false);
          paintedFromCache = true;
        }
      }
    } catch { /* corrupt/absent cache → normal load path */ }
    if (!paintedFromCache) setLoading(true);
    /* PERF: the old code AWAITED a checkContactsSetup() round-trip to Supabase
       BEFORE starting the real fetch — a pure serial waterfall that delayed
       every load by a network round-trip. Start the contacts fetch immediately;
       the setup probe runs in parallel and is only consulted when the directory
       comes back empty (the only case where "table not set up" matters). */
    const setupProbe = checkContactsSetup().catch(() => false);
    /* Scope the fetch to the app's contact type when we have one
       (Suppliers / Customers / …). Without this the Suppliers app
       downloaded EVERY contact in the tenant (~789 KB of customers,
       people & companies) just to render ~a dozen suppliers. The
       type-scoped endpoint returns only what this app renders. */
    const data = filterType
      ? await fetchContactsByType(filterType, scopeCtx)
      : await fetchContacts(scopeCtx);
    if (data.length === 0 && !(await setupProbe)) {
      setSetupNeeded(true); setLoading(false); return;
    }
    /* An empty result while the cache already painted rows is almost always a
       transient failure (expired session mid-flight, network blip) — keep the
       cached view instead of blanking a directory the user is looking at. */
    if (data.length === 0 && paintedFromCache) return;
    // Exclude employees — they are managed via the Employees app now
    const slim = data.filter(c => c.contact_type !== "employee");
    setContacts(slim);
    setLoading(false);
    /* Refresh the warm-start cache (skip oversized payloads — quota safety). */
    try {
      const json = JSON.stringify(slim);
      if (json.length < 2_500_000) sessionStorage.setItem(cacheKey, json);
    } catch { /* quota exceeded → next visit just cold-loads */ }
    /* The list endpoint drops heavy base64 avatars so the response stays under
       the function size limit. Lazy-load the real logos in small batches and
       merge them in, so the directory paints instantly and logos stream in. */
    const missing = slim.filter(c => !c.logo_url && !c.photo_url).map(c => c.id);
    if (missing.length) {
      fetchContactAvatars(missing).then((map) => {
        if (!map || Object.keys(map).length === 0) return;
        setContacts(prev => prev.map(c => map[c.id]
          ? { ...c, logo_url: map[c.id].logo_url ?? c.logo_url, photo_url: map[c.id].photo_url ?? c.photo_url }
          : c));
      }).catch(() => {});
    }
  }, [scopeCtx, filterType]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  /* ── Deep link handler: /customers?selected=<contactId> auto-opens the detail view.
        This is how the CRM (and any other app) can hand off to us. ── */
  useEffect(() => {
    if (loading || contacts.length === 0) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const selected = params.get("selected");
    if (!selected) return;
    const match = contacts.find(c => c.id === selected);
    if (!match) return;
    setSelectedId(match.id);
    setView("detail");
    setMobileShowDetail(true);
    /* Strip the param so a reload doesn't lock the user into this contact. */
    const url = new URL(window.location.href);
    url.searchParams.delete("selected");
    window.history.replaceState({}, "", url.toString());
  }, [loading, contacts]);

  /* ── Debounced search for performance ── */
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── Filtered + grouped contacts ── */
  const filtered = useMemo(() => {
    let list = contacts;
    const tab = filterType || typeTab;
    if (tab !== "all") list = list.filter(c => c.contact_type === tab);
    if (statusFilter !== "all") {
      const wantActive = statusFilter === "active";
      list = list.filter(c => ((c.is_active ?? true) !== false) === wantActive);
    }
    if (debouncedSearch.trim()) {
      /* Smart search: builds one haystack per contact from every supplier-related
         field (incl. the Chinese company name and messaging-app IDs), then
         requires ALL whitespace-separated terms to match (so "shenzhen sewing"
         narrows). CJK queries (Chinese / Japanese / Korean) always use substring
         matching — short CJK terms are meaningful and must not be prefix-gated. */
      const raw = debouncedSearch.trim().toLowerCase();
      const hasCJK = /[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/.test(raw);
      const terms = raw.split(/\s+/).filter(Boolean);
      const prefixOnly = terms.length === 1 && terms[0].length <= 2 && !hasCJK;
      list = list.filter(c => {
        const rec = c as unknown as Record<string, unknown>;
        const s = (k: string) => { const v = rec[k]; return typeof v === "string" ? v : ""; };
        const parts: string[] = [
          contactDisplayName(c), s("first_name"), s("last_name"), s("company"),
          s("company_name_en"), s("company_name_cn"), s("trading_name"), s("supplier_code"),
          s("email"), s("supplier_email"), s("phone"), s("supplier_tel"), s("supplier_mobile"),
          s("whatsapp_business"), s("wechat_id"), s("website"),
          s("country"), s("province"), s("city"), s("division"), s("category"),
        ];
        if (Array.isArray(c.brand_names)) parts.push(...c.brand_names);
        if (Array.isArray(c.tags)) parts.push(...c.tags);
        const mc = rec.messaging_channels;
        if (Array.isArray(mc)) parts.push(...mc.map((m) => (m as { value?: string })?.value || ""));
        if (Array.isArray(c.contact_persons)) {
          for (const p of c.contact_persons) parts.push(p.name || "", p.email || "", p.phone || "", (p as { wechat_id?: string }).wechat_id || "");
        }
        const hay = parts.filter(Boolean).join("  ").toLowerCase();
        if (prefixOnly) return hay.split(/[\s]+/).some((tok) => tok.startsWith(terms[0]));
        return terms.every((term) => hay.includes(term));
      });
    }
    return list.sort((a, b) => contactSortKey(a).localeCompare(contactSortKey(b)));
  }, [contacts, typeTab, filterType, debouncedSearch, statusFilter]);

  /* Typeahead suggestions — the top matches with a "why it matched" hint. */
  const searchTerms = useMemo(() => debouncedSearch.trim().toLowerCase().split(/\s+/).filter(Boolean), [debouncedSearch]);
  const suggestions = useMemo(() => (debouncedSearch.trim() ? filtered.slice(0, 8) : []), [filtered, debouncedSearch]);

  const grouped = useMemo(() => {
    const map: Record<string, ContactRow[]> = {};
    filtered.forEach(c => {
      const letter = contactSortKey(c)[0]?.toUpperCase() || "#";
      if (!map[letter]) map[letter] = [];
      map[letter].push(c);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const selectedContact = useMemo(() => contacts.find(c => c.id === selectedId) || null, [contacts, selectedId]);

  /* ── Module KPI stats (works for any contact type) ── */
  const moduleKpis = useMemo(() => {
    if (!filterType) return null;
    const all = contacts.filter(c => c.contact_type === filterType);
    const active = all.filter(c => c.is_active);
    /* Count countries with the SAME code-or-name resolution the
       "Customers by Country" card uses — counting only country_code
       undercounted (KPI said 13 while the card listed 17) because many
       records store the country by name only. */
    const countries = new Set(
      all
        .map(c => {
          const code = String(c.country_code || "").trim().toUpperCase();
          if (code) return code;
          const raw = String(c.country || "").trim();
          if (!raw) return "";
          return COUNTRY_NAME_TO_CODE.get(raw.toLowerCase())
            || (COUNTRY_CODE_TO_NAME.has(raw.toUpperCase()) ? raw.toUpperCase() : raw.toLowerCase());
        })
        .filter(Boolean),
    );
    const vip = all.filter(c => c.customer_type === "diamond" || c.customer_type === "platinum");
    const now = new Date();
    const thisMonth = all.filter(c => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return { total: all.length, active: active.length, countries: countries.size, vip: vip.length, newThisMonth: thisMonth.length };
  }, [contacts, filterType]);

  /* ── Supplier-specific KPI stats ── */
  const supplierKpis = useMemo(() => {
    if (filterType !== "supplier") return null;
    const all = contacts.filter(c => c.contact_type === "supplier");
    const active = all.filter(c => c.is_active);
    /* Count distinct geographies. Most suppliers carry only a free-text
       `country` (no ISO code), so fall back to it — otherwise the card
       misleadingly reads "1" while suppliers clearly span several countries. */
    const countries = new Set(
      all
        .map(c => String(c.origin_country_code || c.country_code || c.country || "").trim().toLowerCase())
        .filter(Boolean),
    );
    const rated = all.filter(c => c.rating > 0);
    const avgRating = rated.length > 0 ? (rated.reduce((sum, c) => sum + c.rating, 0) / rated.length) : 0;
    const withCatalogues = all.filter(c => Array.isArray(c.catalogues) && c.catalogues.length > 0);
    const divisions = new Set(all.map(c => c.division).filter(Boolean));
    const categories = new Set(all.map(c => c.category).filter(Boolean));
    const withContacts = all.filter(c => Array.isArray(c.contact_persons) && c.contact_persons.length > 0);
    const now = new Date();
    const newThisMonth = all.filter(c => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return {
      total: all.length,
      active: active.length,
      countries: countries.size,
      avgRating: Math.round(avgRating * 10) / 10,
      ratedCount: rated.length,
      withCatalogues: withCatalogues.length,
      divisions: divisions.size,
      categories: categories.size,
      withContacts: withContacts.length,
      newThisMonth: newThisMonth.length,
    };
  }, [contacts, filterType]);

  /* ── Handlers ── */
  /* The list API returns rows WITHOUT the heavy base64 image/document fields
     (for speed). Detail + edit need the full record, so fetch it on demand
     and splice it back into the in-memory list. Returns the full row. */
  const hydrateContact = useCallback(async (id: string): Promise<ContactRow | null> => {
    try {
      const res = await fetch(`/api/contacts/${id}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) return null;
      const j = (await res.json()) as { contact?: ContactRow };
      const full = j.contact ?? null;
      if (full) setContacts((prev) => prev.map((c) => (c.id === id ? full : c)));
      return full;
    } catch {
      return null;
    }
  }, []);

  const handleSelectContact = useCallback((c: ContactRow) => {
    /* Customers use a two-step open (like Suppliers): the FIRST click on a row
       shows the profile inline in the right pane; clicking the SAME already-open
       customer again navigates to the dedicated full /customers/[id] page. */
    if (filterType === "customer" && c.contact_type === "customer") {
      if (selectedId === c.id && view === "detail") {
        router.push(`/customers/${c.id}`);
        return;
      }
      setSelectedId(c.id);
      setView("detail");
      setMobileShowDetail(true);
      setEditingId(null);
      void hydrateContact(c.id);
      return;
    }
    /* On the Suppliers app, show the full Supplier 360 (Factory, Contacts,
       Media, Timeline, Risk, Negotiation, Sourcing) inline in the right
       detail panel — no full-page navigation. */
    setSelectedId(c.id);
    setView("detail");
    setMobileShowDetail(true);
    setEditingId(null);
    void hydrateContact(c.id); // pull full record (images/docs) for the detail view
  }, [filterType, router, hydrateContact, selectedId, view]);

  const handleAdd = useCallback((type: ContactType, entityType?: "person" | "company") => {
    // New suppliers default to the Garment Machinery division so the
    // category dropdown is populated out of the box.
    setForm({ ...EMPTY_FORM, contact_type: type, entity_type: entityType || "", division: type === "supplier" ? "Garment Machinery" : "", currency: type === "supplier" ? "CNY" : "" });
    setTriedSave(false);
    setSaveError(null);
    setSIntel(EMPTY_SINTEL);
    setRiskScoreManual(false);
    setNegScoreManual(false);
    setSupplierDept(null);
    setSupplierSectionAudit({});
    setEditingId(null);
    setView("form");
    setShowTypeChooser(false);
    setTypeChooserStep(1);
    setMobileShowDetail(true);
    setExpandedFamily(null);
  }, []);

  /* Catalog import → open the REAL New Supplier form (the exact same
     renderFormPanel) inside a modal, pre-filled with the extracted data. The
     PDF is filed against the new supplier after Save (handleSave success). */
  const [formModalOpen, setFormModalOpen] = useState(false);
  const pendingCatalogFileRef = useRef<File | null>(null);
  /* Duplicate-supplier guard: likely matches found at save time + a one-shot
     bypass when the operator confirms "create anyway". */
  const [dupMatches, setDupMatches] = useState<DupMatch[]>([]);
  const [dupMerging, setDupMerging] = useState<string | null>(null);
  const dupBypassRef = useRef(false);
  /* Square-crop a chosen logo / screenshot before it becomes the photo. */
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);
  const [logoDrag, setLogoDrag] = useState(false);
  const openLogoCrop = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => { const u = String(reader.result || ""); if (u) setLogoCropSrc(u); };
    reader.readAsDataURL(file);
  }, []);
  /* Paste a screenshot directly while the supplier form is open: take a
     clipboard screenshot (⌃⌘⇧4 on macOS) then ⌘V here → the square cropper
     opens. Only acts on image clipboard data, so text paste is untouched. */
  useEffect(() => {
    if (view !== "form") return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) { e.preventDefault(); openLogoCrop(file); }
          return;
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [view, openLogoCrop]);
  const importIntoForm = useCallback((prefill: Partial<ContactForm>, catalogFile: File | null) => {
    pendingCatalogFileRef.current = catalogFile;
    setForm({ ...EMPTY_FORM, contact_type: "supplier", entity_type: "company", division: "Garment Machinery", currency: "CNY", ...prefill });
    setTriedSave(false);
    setSaveError(null);
    setSIntel(EMPTY_SINTEL);
    setRiskScoreManual(false);
    setNegScoreManual(false);
    setSupplierDept(null);
    setSupplierSectionAudit({});
    setEditingId(null);
    setView("form");
    setExpandedFamily(null);
    setFormModalOpen(true);
  }, []);
  // Close the import form-modal whenever the form navigates away (cancel/save).
  useEffect(() => { if (formModalOpen && view !== "form") setFormModalOpen(false); }, [formModalOpen, view]);

  /* Open the edit form for a specific contact. Used by the in-detail Edit
     button (via handleEdit) and the side-list row Edit button — both must
     map the row through contactToForm (NOT a raw spread) so every field
     populates and the supplier section-audit loads. */
  const openEditFor = useCallback((c: ContactRow) => {
    setSelectedId(c.id);
    setForm(contactToForm(c));
    setTriedSave(false);
    setSaveError(null);
    setEditingId(c.id);
    setSupplierDept(null);
    setSupplierSectionAudit({});
    /* The list row is "slim" (no base64 images/docs). Pull the full record and
       rebuild the form from it, so editing + saving never wipes images that
       weren't loaded. */
    setFormHydrating(true);
    editOriginalRef.current = null;
    void hydrateContact(c.id).then((full) => {
      if (full) { setForm(contactToForm(full)); editOriginalRef.current = full as unknown as Record<string, unknown>; }
      setFormHydrating(false);
    });
    /* Load section-level attribution for suppliers (who edited each dept). */
    if (c.contact_type === "supplier") {
      fetch(`/api/suppliers/${c.id}/section-audit`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.audit) setSupplierSectionAudit(d.audit); })
        .catch(() => { /* attribution is best-effort */ });
    }
    setView("form");
    setMobileShowDetail(true);
    setExpandedFamily(null);
  }, [hydrateContact]);

  const handleEdit = useCallback(() => {
    if (!selectedContact) return;
    openEditFor(selectedContact);
  }, [selectedContact, openEditFor]);

  /* After a supplier's base contact row is created, push the intelligence
     captured in the form into the canonical tables via the existing APIs.
     Best-effort: a hiccup here never undoes the created supplier. */
  const enrichSupplier = async (id: string) => {
    const j = (u: string, m: string, b: unknown) => fetch(u, { method: m, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).catch(() => null);
    const ne = (o: Record<string, unknown>) => { const r: Record<string, unknown> = {}; for (const [k, v] of Object.entries(o)) { if (typeof v === "string") { if (v.trim()) r[k] = v.trim(); } else if (typeof v === "boolean") { if (v) r[k] = true; } else if (v != null) r[k] = v; } return r; };
    const num = (o: Record<string, unknown>, keys: string[]) => { for (const k of keys) if (typeof o[k] === "string") o[k] = Number(o[k]); return o; };
    try {
      /* All enrichment endpoints are independent — fire them concurrently
         instead of awaiting each in series (was a visible multi-second hang
         on the Save spinner for suppliers with several contacts/items). */
      const tasks: Promise<unknown>[] = [];
      if (sIntel.strategic_status) tasks.push(j(`/api/suppliers/${id}`, "PATCH", { strategic_status: sIntel.strategic_status, strategic_status_reason: sIntel.strategic_status_reason || null }));
      for (const c of sIntel.classifications) tasks.push(j(`/api/suppliers/${id}/classifications`, "POST", { classification: c, is_primary: c === sIntel.primary_class }));
      for (const p of form.contact_persons) { if ((p.name || "").trim()) tasks.push(j(`/api/suppliers/${id}/contacts`, "POST", ne({ full_name: p.name, name_cn: p.name_cn, position: p.position, department: p.department, mobile: p.mobile || p.phone, email: p.email, whatsapp: p.whatsapp, wechat_id: p.wechat_id, telegram: p.telegram, wecom_id: p.wecom_id, line_id: p.line_id, skype_id: p.skype_id, role_category: p.role_category, reliability: p.reliability, preferred_channel: p.preferred_channel, preferred_language: p.preferred_language, timezone: p.timezone, response_speed: p.response_speed, available_hours: p.available_hours, id_image: p.id_image, is_primary: p.is_primary, is_decision_maker: p.is_decision_maker, notes: p.notes }))); }
      const fb = num(ne(sIntel.factory), ["production_lines", "monthly_capacity", "annual_output", "factory_size_sqm", "employee_count", "qc_staff_count", "rd_staff_count", "export_percentage", "lead_time_days"]);
      const fem = sIntel.factory.main_export_markets; if (typeof fem === "string" && fem.trim()) fb.main_export_markets = fem.split(",").map((s) => s.trim()).filter(Boolean);
      const fpc = sIntel.factory.production_categories; if (typeof fpc === "string" && fpc.trim()) fb.production_categories = fpc.split(",").map((s) => s.trim()).filter(Boolean);
      const fsm = sIntel.factory.supported_materials; if (typeof fsm === "string" && fsm.trim()) fb.supported_materials = fsm.split(",").map((s) => s.trim()).filter(Boolean);
      const fps = sIntel.factory.peak_season_months; if (typeof fps === "string" && fps.trim()) fb.peak_season_months = fps.split(",").map((s) => s.trim()).filter(Boolean);
      if (Object.keys(fb).length) tasks.push(j(`/api/suppliers/${id}/factory`, "PUT", fb));
      const rb = num(ne(sIntel.risk), ["internal_evaluation_score"]);
      if (Object.keys(rb).length) tasks.push(j(`/api/suppliers/${id}/risk`, "PUT", rb));
      const nb = num(ne(sIntel.neg), ["negotiation_score"]);
      const npt = sIntel.neg.preferred_tactics; nb.preferred_tactics = typeof npt === "string" && npt.trim() ? npt.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const nlp = sIntel.neg.leverage_points; nb.leverage_points = typeof nlp === "string" && nlp.trim() ? nlp.split(",").map((s) => s.trim()).filter(Boolean) : [];
      if (Object.keys(nb).length) tasks.push(j(`/api/suppliers/${id}/negotiations/intel`, "PUT", nb));
      // Sourcing override (supplier-level)
      const sb = num(ne(sIntel.sourcing), ["sourcing_priority", "sourcing_score_override"]);
      if (Object.keys(sb).length) tasks.push(j(`/api/suppliers/${id}/sourcing`, "PUT", sb));
      // Risk items register — one POST per item with a title
      for (const ri of sIntel.riskItems) { if ((ri.title || "").trim()) tasks.push(j(`/api/suppliers/${id}/risk/items`, "POST", ne({ dimension: ri.dimension, severity: ri.severity, status: ri.status, title: ri.title, description: ri.description, mitigation: ri.mitigation }))); }
      await Promise.all(tasks);
    } catch { /* best-effort */ }
  };

  const handleSave = async () => {
    if (!form.first_name && !form.last_name && !form.company && !form.company_name_en) return;
    // Don't save while the full record (images/docs) is still loading — would
    // overwrite unloaded image fields with blanks.
    if (formHydrating) { setSaveErrorIsValidation(false); setSaveError(t("loading", "Loading…")); return; }
    // If we're editing but the full record never loaded (hydrate failed), saving
    // would diff against nothing and overwrite un-loaded image/doc fields with
    // blanks. Block it and ask the user to reopen instead of losing data.
    if (editingId && !editOriginalRef.current) {
      setSaveErrorIsValidation(false);
      setSaveError(t("error.reopenToSave", "Couldn't load the full record. Please close and reopen this record, then save again."));
      return;
    }
    // Block save on supplier data-integrity errors (required + format validation).
    if (filterType === "supplier" || form.contact_type === "supplier") {
      const errs = supplierFormErrors(form);
      if (errs.length) {
        setTriedSave(true);
        setSaveErrorIsValidation(true);
        // List everything that needs fixing so the operator knows exactly what to complete.
        setSaveError(errs.map((m, i) => `${i + 1}. ${m}`).join("\n"));
        return;
      }
    }
    setTriedSave(false);
    setSaveErrorIsValidation(false);
    setSaving(true);
    setSaveError(null);
    const row = formToRow(form);
    /* On edit, send ONLY changed columns. The row carries multi-MB base64
       images; rewriting all of them on every save made the UPDATE slow enough
       to exceed the serverless timeout. Diffing against the loaded record means
       a metadata-only edit sends a tiny patch and saves instantly. */
    let patch: Record<string, unknown> = row as Record<string, unknown>;
    if (editingId && editOriginalRef.current) {
      const orig = editOriginalRef.current;
      const diff: Record<string, unknown> = {};
      for (const k of Object.keys(row as Record<string, unknown>)) {
        if (JSON.stringify((row as Record<string, unknown>)[k]) !== JSON.stringify(orig[k] ?? null)) {
          diff[k] = (row as Record<string, unknown>)[k];
        }
      }
      patch = diff;
    }
    try {
      if (editingId) {
        if (Object.keys(patch).length === 0) { setSaving(false); setView("detail"); return; }
        const { ok, error } = await updateContact(editingId, patch);
        if (ok) {
          await loadContacts();
          setView("detail");
        } else {
          setSaveError(error || t("error.updateFailed"));
        }
      } else {
        /* Duplicate guard (suppliers only): before creating, look for an
           existing supplier this is likely a duplicate of. If found and the
           operator hasn't chosen "create anyway", surface the matches and stop. */
        if (!dupBypassRef.current && (filterType === "supplier" || row.contact_type === "supplier")) {
          const matches = findSupplierDuplicates(
            row as Record<string, unknown>,
            contacts as unknown as Record<string, unknown>[],
          );
          if (matches.length) {
            setDupMatches(matches);
            setSaving(false);
            return;
          }
        }
        dupBypassRef.current = false;
        const { data: created, error } = await createContact(row);
        if (created) {
          /* Catalog import: file the PDF against the new supplier (Suppliers +
             Catalogs apps), then clear the pending file. */
          if (pendingCatalogFileRef.current) {
            const pdf = pendingCatalogFileRef.current;
            pendingCatalogFileRef.current = null;
            try {
              const { uploadCatalogFile, createCatalog } = await import("@/lib/catalogs-admin");
              const up = await uploadCatalogFile(pdf);
              if (up) {
                const c = created as unknown as Record<string, unknown>;
                const dn = (c.display_name || c.company_name_en || c.company_name_cn || pdf.name) as string;
                await createCatalog({
                  title: dn, title_cn: (c.company_name_cn as string) || null, description: null,
                  contact_id: created.id, contact_name: dn,
                  company_name_en: (c.company_name_en as string) || null,
                  company_name_cn: (c.company_name_cn as string) || null,
                  contact_type: "supplier", contact_photo_url: (c.photo_url as string) || null,
                  division_slug: null, division_name: null, category_slug: null, category_name: null,
                  file_name: pdf.name, file_path: up.path, file_url: up.url,
                  file_type: pdf.type || "application/pdf", file_size: pdf.size,
                  cover_url: null, cover_path: null, tags: ["supplier-catalog"],
                });
              }
            } catch { /* non-fatal — supplier exists regardless */ }
          }
          /* New suppliers open straight into the Supplier 360 intelligence
             page so the operator immediately sees Factory / Contacts / Media /
             Risk / Negotiation / Sourcing rather than the legacy panel. */
          if (filterType === "supplier" || row.contact_type === "supplier") {
            await enrichSupplier(created.id);
            router.push(`/suppliers/${created.id}`);
            return;
          }
          await loadContacts();
          setSelectedId(created.id);
          setView("detail");
        } else {
          setSaveError(error || t("error.createFailed"));
        }
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("error.unexpected"));
    }
    setSaving(false);
  };

  /* File the pending catalog PDF against a supplier id (shared by create + merge). */
  const fileCatalogAgainst = async (id: string, idy: Record<string, unknown>) => {
    if (!pendingCatalogFileRef.current) return;
    const pdf = pendingCatalogFileRef.current;
    pendingCatalogFileRef.current = null;
    try {
      const { uploadCatalogFile, createCatalog } = await import("@/lib/catalogs-admin");
      const up = await uploadCatalogFile(pdf);
      if (!up) return;
      const dn = (idy.display_name || idy.company_name_en || idy.company_name_cn || pdf.name) as string;
      await createCatalog({
        title: dn, title_cn: (idy.company_name_cn as string) || null, description: null,
        contact_id: id, contact_name: dn,
        company_name_en: (idy.company_name_en as string) || null,
        company_name_cn: (idy.company_name_cn as string) || null,
        contact_type: "supplier", contact_photo_url: (idy.photo_url as string) || null,
        division_slug: null, division_name: null, category_slug: null, category_name: null,
        file_name: pdf.name, file_path: up.path, file_url: up.url,
        file_type: pdf.type || "application/pdf", file_size: pdf.size,
        cover_url: null, cover_path: null, tags: ["supplier-catalog"],
      });
    } catch { /* non-fatal */ }
  };

  /* Duplicate resolution actions. */
  const openExistingDup = (id: string) => { setDupMatches([]); setFormModalOpen(false); router.push(`/suppliers/${id}`); };
  const createAnywayDup = () => { dupBypassRef.current = true; setDupMatches([]); void handleSave(); };
  /* "Merge into existing": fill ONLY the empty fields of the existing supplier
     from the new data (never overwrite), attach the catalog, then open it. */
  const mergeIntoExisting = async (existingId: string) => {
    setDupMerging(existingId);
    const existing = contacts.find((c) => c.id === existingId) as unknown as Record<string, unknown> | undefined;
    const row = formToRow(form) as unknown as Record<string, unknown>;
    const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
    const patch: Record<string, unknown> = {};
    if (existing) {
      for (const k of Object.keys(row)) {
        if (k === "id" || k === "contact_type") continue;
        if (!isEmpty(row[k]) && isEmpty(existing[k])) patch[k] = row[k];
      }
    }
    try {
      if (Object.keys(patch).length) await updateContact(existingId, patch);
      await fileCatalogAgainst(existingId, { ...(existing || {}), ...patch });
    } catch { /* non-fatal */ }
    setDupMerging(null);
    setDupMatches([]);
    setFormModalOpen(false);
    await enrichSupplier(existingId).catch(() => {});
    router.push(`/suppliers/${existingId}`);
  };

  const handleDelete = async (id: string): Promise<DeleteResult> => {
    const { ok, error } = await deleteContact(id);
    if (ok) {
      setContacts(prev => prev.filter(c => c.id !== id));
      if (selectedId === id) { setSelectedId(null); setView("list"); setMobileShowDetail(false); }
    }
    return { ok, error: error ? humanizeError(error) : undefined };
  };

  /* Fire the delete confirmation via a window event so the (huge) Contacts
     tree doesn't re-render just to open the dialog — see DeleteConfirmHost.
     onConfirm resolves the delete result so the dialog can surface errors. */
  const requestDelete = (c: ContactRow) => {
    if (typeof window === "undefined") return;
    const title = c.contact_type === "supplier"
      ? t("delete.titleSupplier", "Delete supplier")
      : c.contact_type === "customer"
        ? t("delete.titleCustomer", "Delete customer")
        : t("delete.title", "Delete Contact");
    window.dispatchEvent(new CustomEvent("koleex:confirm-delete", {
      detail: { id: c.id, name: contactDisplayName(c), title, onConfirm: () => handleDelete(c.id) },
    }));
  };

  const handleCancel = () => {
    if (editingId && selectedContact) {
      setView("detail");
    } else {
      setView("list");
      setMobileShowDetail(false);
    }
    setEditingId(null);
  };

  const handleBack = () => {
    setMobileShowDetail(false);
    setSelectedId(null);
    setView("list");
    setEditingId(null);
  };

  const copySql = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Form updaters ── */
  const setField = useCallback(<K extends keyof ContactForm>(key: K, val: ContactForm[K]) =>
    setForm(prev => ({ ...prev, [key]: val })), []);

  const addPhone = () => setField("phones", [...form.phones, { label: "mobile", number: "" }]);
  const removePhone = (i: number) => setField("phones", form.phones.filter((_, idx) => idx !== i));
  const updatePhone = (i: number, field: keyof PhoneEntry, val: string) => {
    const arr = [...form.phones]; arr[i] = { ...arr[i], [field]: val }; setField("phones", arr);
  };

  const addEmail = () => setField("emails", [...form.emails, { label: "home", email: "" }]);
  const removeEmail = (i: number) => setField("emails", form.emails.filter((_, idx) => idx !== i));
  const updateEmail = (i: number, field: keyof EmailEntry, val: string) => {
    const arr = [...form.emails]; arr[i] = { ...arr[i], [field]: val }; setField("emails", arr);
  };

  const addAddress = () => setField("addresses", [...form.addresses, { label: "home", street: "", city: "", state: "", zip: "", country: "" }]);
  const removeAddress = (i: number) => setField("addresses", form.addresses.filter((_, idx) => idx !== i));
  const updateAddress = (i: number, field: keyof AddressEntry, val: string) => {
    const arr = [...form.addresses]; arr[i] = { ...arr[i], [field]: val }; setField("addresses", arr);
  };

  const addWebsite = () => setField("websites", [...form.websites, { label: "homepage", url: "" }]);
  const removeWebsite = (i: number) => setField("websites", form.websites.filter((_, idx) => idx !== i));
  const updateWebsite = (i: number, field: keyof WebsiteEntry, val: string) => {
    const arr = [...form.websites]; arr[i] = { ...arr[i], [field]: val }; setField("websites", arr);
  };

  const addSocial = () => setField("social_profiles", [...form.social_profiles, { platform: "WhatsApp", username: "", url: "", qr_code_url: "" }]);
  const removeSocial = (i: number) => setField("social_profiles", form.social_profiles.filter((_, idx) => idx !== i));
  const updateSocial = (i: number, field: keyof SocialProfile, val: string) => {
    const arr = [...form.social_profiles]; arr[i] = { ...arr[i], [field]: val }; setField("social_profiles", arr);
  };

  const addRelated = () => setField("related_names", [...form.related_names, { name: "", relationship: "friend" }]);
  const removeRelated = (i: number) => setField("related_names", form.related_names.filter((_, idx) => idx !== i));
  const updateRelated = (i: number, field: keyof RelatedName, val: string) => {
    const arr = [...form.related_names]; arr[i] = { ...arr[i], [field]: val }; setField("related_names", arr);
  };

  const addFamily = () => setField("family_members", [...form.family_members, {
    relationship: "Spouse", title: "", first_name: "", middle_name: "", last_name: "",
    phone: "", email: "", birthday: "", notes: "", photo_url: "",
  }]);
  const removeFamily = (i: number) => {
    setField("family_members", form.family_members.filter((_, idx) => idx !== i));
    if (expandedFamily === i) setExpandedFamily(null);
  };
  const updateFamily = (i: number, field: keyof FamilyMember, val: string) => {
    const arr = [...form.family_members]; arr[i] = { ...arr[i], [field]: val }; setField("family_members", arr);
  };

  // Resume Line helpers
  const addResumeLine = (type: "experience" | "education" | "training" | "certification") => {
    setField("resume_lines", [...form.resume_lines, {
      type,
      title: "",
      duration_start: "",
      duration_end: "",
      is_forever: false,
      certificate_url: "",
      certificate_name: "",
      notes: "",
      course_type: type === "training" ? "external" : "",
      external_url: "",
    }]);
  };
  const removeResumeLine = (i: number) => setField("resume_lines", form.resume_lines.filter((_, idx) => idx !== i));
  const updateResumeLine = (i: number, field: string, val: any) => {
    const arr = [...form.resume_lines];
    arr[i] = { ...arr[i], [field]: val };
    setField("resume_lines", arr);
  };

  // Emergency Contact helpers
  const addEmergencyContact = () => setField("emergency_contacts", [...form.emergency_contacts, { contact: "", phone: "" }]);
  const removeEmergencyContact = (i: number) => setField("emergency_contacts", form.emergency_contacts.filter((_, idx) => idx !== i));
  const updateEmergencyContact = (i: number, field: string, val: string) => {
    const arr = [...form.emergency_contacts];
    arr[i] = { ...arr[i], [field]: val };
    setField("emergency_contacts", arr);
  };

  // Visa Document helpers
  const addVisaDoc = () => setField("visa_documents", [...form.visa_documents, { name: "", url: "", type: "", uploaded_at: new Date().toISOString() }]);
  const removeVisaDoc = (i: number) => setField("visa_documents", form.visa_documents.filter((_, idx) => idx !== i));

  const addCustomField = () => setField("custom_fields", [...form.custom_fields, { field_name: "", field_value: "" }]);
  const removeCustomField = (i: number) => setField("custom_fields", form.custom_fields.filter((_, idx) => idx !== i));
  const updateCustomField = (i: number, field: keyof CustomField, val: string) => {
    const arr = [...form.custom_fields]; arr[i] = { ...arr[i], [field]: val }; setField("custom_fields", arr);
  };

  /* ── Location cascade handlers ── */
  const handleCountryChange = useCallback((name: string, isoCode: string) => {
    setForm(prev => ({
      ...prev,
      country: name,
      country_code: isoCode,
      province: "",
      province_code: "",
      city: "",
    }));
  }, []);

  const handleProvinceChange = useCallback((name: string, isoCode: string) => {
    setForm(prev => ({
      ...prev,
      province: name,
      province_code: isoCode,
      city: "",
    }));
  }, []);

  const handleCityChange = useCallback((name: string) => {
    setField("city", name);
  }, []);

  /* ═════════════════════════════════════════════════════════════════════════
     SETUP SCREEN
     ═════════════════════════════════════════════════════════════════════════ */

  if (setupNeeded) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <TriangleWarningIcon className="text-amber-400" size={32} />
            </div>
            <h1 className="text-2xl font-semibold mb-2">{t("setup.title")}</h1>
            <p className="text-[var(--text-subtle)] text-sm">
              {t("setup.desc")}
              <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline ms-1">
                Supabase Dashboard
              </a>
              {" "}&rarr; SQL Editor &rarr; New Query.
            </p>
          </div>

          <div className="relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-surface-subtle)]">
              <span className="text-xs text-[var(--text-faint)] font-mono">{t("setup.sqlMigration")}</span>
              <button onClick={copySql} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface-active)] transition-colors">
                {copied ? <><CheckIcon size={12} className="text-green-400" /> {t("btn.copied")}</> : <><CopyIcon size={12} /> {t("btn.copy")}</>}
              </button>
            </div>
            <pre className="p-4 text-xs text-[var(--text-secondary)] font-mono overflow-x-auto max-h-80 overflow-y-auto leading-relaxed">
              {MIGRATION_SQL}
            </pre>
          </div>

          <div className="flex items-center justify-center gap-3 mt-6">
            <Link href="/" className="px-4 py-2 rounded-lg text-sm border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors">
              {t("btn.backToHub")}
            </Link>
            <button onClick={() => { setSetupNeeded(false); loadContacts(); }} className="px-4 py-2 rounded-lg text-sm bg-[var(--bg-inverted)] text-[var(--text-inverted)] font-medium hover:bg-[var(--bg-inverted-hover)] transition-colors">
              {t("btn.retry")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════════════════════
     LOADING
     ═════════════════════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--border-focus)] border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER: CONTACT LIST PANEL
     ═════════════════════════════════════════════════════════════════════════ */

  const renderListPanel = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2.5 mb-3">
          <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeftIcon size={16} className="rtl:rotate-180" />
          </Link>
          {/* Neutral surface tile — matches the shared PageHeader and every
              other app's header icon. (Was amber-tinted for /customers only,
              which made it the odd one out.) */}
          <div
            className={`h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 ${
              filterType === "company" || filterType === "people"
                ? "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)]"
                : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]"
            }`}
          >
            {filterType === "supplier" ? <SuppliersIcon size={16} /> : filterType === "customer" ? <CustomersIcon size={16} /> : <ContactsIcon size={16} />}
          </div>
          <h1 className="text-[16px] font-bold text-[var(--text-primary)] truncate flex-1">
            {filterType ? (filterType === "company" ? t("tab.companies") : filterType === "people" ? t("tab.people") : filterType === "supplier" ? t("tab.suppliers") : t("tab.customers")) : t("title")}
          </h1>
          {/* CSV export — customer directory only. Dumps whatever the
              current filters produce (search, tier filter, active
              filter) so the download matches what the user sees. */}
          {filterType === "customer" && (
            <button
              onClick={() => {
                /* Lazy import so the csv string builder doesn't
                   weigh on the initial render of /contacts or
                   /suppliers. */
                import("@/lib/customers-admin").then(({ customersToCsv }) => {
                  const csv = customersToCsv(filtered as unknown as Array<Record<string, unknown> & { id: string; contact_type: string | null; customer_type: string | null; display_name: string | null; company_name: string | null; first_name: string | null; last_name: string | null }>);
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                });
              }}
              className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors shrink-0"
              aria-label="Export customers as CSV"
              title="Export CSV"
            >
              <DownloadIcon size={14} />
            </button>
          )}
          {filterType === "supplier" && (
            <button
              onClick={() => setShowCatalogImport(true)}
              className="h-8 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1.5 text-[12px] font-medium transition-colors shrink-0"
              aria-label={t("importFromCatalog", "Import from catalog")}
              title={t("importFromCatalog", "Import supplier from a PDF catalog")}
            >
              <PlusIcon size={13} />
              {t("importCatalog", "Import catalog")}
            </button>
          )}
          <button
            onClick={() => {
              /* Phase 20: make the "+" button app-aware so the
                 Customers page doesn't re-ask "what type of contact?"
                 when the user is already in the Customers directory.
                   · on /customers (filterType==='customer')
                       → skip step 1 of the chooser, go straight to
                         the step-2 "person or company" picker so the
                         first click lands on a customer-specific form
                   · on /contacts (no filterType)
                       → show the full 4-way chooser (Customer /
                         Supplier / Company / People)
                   · on other filtered views (suppliers, companies,
                     people) → direct-add of that type, no chooser */
              if (filterType === "customer") {
                setTypeChooserStep(2);
                setShowTypeChooser(true);
              } else if (filterType) {
                handleAdd(filterType);
              } else {
                setTypeChooserStep(1);
                setShowTypeChooser(true);
              }
            }}
            className="h-8 w-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 flex items-center justify-center transition-colors shrink-0"
            aria-label={filterType === "supplier" ? t("newSupplier", "New supplier") : filterType === "customer" ? t("newCustomer", "New customer") : t("newContact", "New Contact")}
            title={filterType === "supplier" ? t("newSupplier", "New supplier") : filterType === "customer" ? t("newCustomer", "New customer") : t("newContact", "New Contact")}
          >
            <PlusIcon size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <SearchIcon size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            type="text"
            placeholder={filterType === "supplier" ? t("searchSuppliers", "Search suppliers — name, 中文名, country, app ID…") : filterType === "customer" ? t("searchCustomers", "Search customers…") : t("searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            onKeyDown={e => { if (e.key === "Enter" && suggestions[0]) { setSearchFocused(false); handleSelectContact(suggestions[0]); } else if (e.key === "Escape") { setSearchFocused(false); } }}
            className="w-full h-9 ps-9 pe-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute end-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-primary)]">
              <CrossIcon size={14} />
            </button>
          )}

          {/* Smart suggestions — each row names the supplier AND why it matched
              (brand, contact person, app ID, country…). Click opens that supplier. */}
          {searchFocused && debouncedSearch.trim() && suggestions.length > 0 && (
            <div className="absolute z-50 mt-1 start-0 end-0 max-h-[22rem] overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
              {suggestions.map(c => {
                const reason = searchMatchReason(c, searchTerms);
                const cn = (c as unknown as Record<string, unknown>).company_name_cn;
                const sub = reason ? `${reason.label}: ${reason.value}` : (typeof cn === "string" && cn.trim() ? cn : (c.country || ""));
                const initials = contactDisplayName(c).split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); setSearchFocused(false); handleSelectContact(c); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-start hover:bg-[var(--bg-surface)] transition-colors"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--bg-surface)] ring-1 ring-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)]">
                      {(c.photo_url || c.logo_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={(c.photo_url || c.logo_url) as string} alt="" className="h-full w-full object-cover" loading="lazy" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      ) : initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{contactDisplayName(c)}</span>
                      {sub ? <span className="block truncate text-[11px] text-[var(--text-faint)]">{sub}</span> : null}
                    </span>
                    {reason ? <span className="shrink-0 rounded-full bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-[var(--text-ghost)]">{reason.label}</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active / Archived filter — suppliers only */}
        {filterType === "supplier" && (
          <div className="flex gap-1 mt-3">
            {([
              { k: "all", label: t("sd.statusAll", "All") },
              { k: "active", label: t("sd.active", "Active") },
              { k: "archived", label: t("sd.archived", "Archived") },
            ] as const).map(opt => (
              <button
                key={opt.k}
                onClick={() => setStatusFilter(opt.k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === opt.k
                    ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]"
                    : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Type tabs */}
        {!filterType && (
          <div className="flex gap-1 mt-3 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setTypeTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                typeTab === "all" ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
              }`}
            >
              {t("tab.all")} ({contacts.length})
            </button>
            {CONTACT_TYPES.map(ct => {
              const count = contacts.filter(c => c.contact_type === ct.value).length;
              return (
                <button
                  key={ct.value}
                  onClick={() => setTypeTab(ct.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    typeTab === ct.value ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
                  }`}
                >
                  {ct.icon} {ct.value === "company" ? t("tab.companies") : ct.value === "people" ? t("tab.people") : ct.value === "supplier" ? t("tab.suppliers") : t("tab.customers")} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto will-change-scroll">
        {/* Compact KPI strip — mobile only (main dashboard is in right panel on desktop) */}
        {moduleKpis && filterType === "customer" && (
          <div className="md:hidden grid grid-cols-4 gap-2 px-4 py-3 border-b border-[var(--border-color)]">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-[var(--text-primary)]">{moduleKpis.total}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">{t("kpi.total")}</p>
            </div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{moduleKpis.active}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-emerald-400/40">{t("kpi.active")}</p>
            </div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-violet-400">{moduleKpis.vip}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-violet-400/40">{t("kpi.vip")}</p>
            </div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-blue-400">{moduleKpis.countries}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-blue-400/40">{t("kpi.countries")}</p>
            </div>
          </div>
        )}
        {/* Compact KPI strip — mobile only (supplier variant) */}
        {supplierKpis && filterType === "supplier" && (
          <div className="md:hidden grid grid-cols-4 gap-2 px-4 py-3 border-b border-[var(--border-color)]">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-[var(--text-primary)]">{supplierKpis.total}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">{t("kpi.total")}</p>
            </div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{supplierKpis.active}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-emerald-400/40">{t("kpi.active")}</p>
            </div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-amber-400">{supplierKpis.avgRating > 0 ? supplierKpis.avgRating : "—"}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-amber-400/40">{t("field.rating")}</p>
            </div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-orange-400">{supplierKpis.countries}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-orange-400/40">{t("kpi.countries")}</p>
            </div>
          </div>
        )}

        {/* Compact KPI strip — mobile only (employee/company/people) */}
        {moduleKpis && filterType && filterType !== "customer" && filterType !== "supplier" && (
          <div className="md:hidden grid grid-cols-4 gap-2 px-4 py-3 border-b border-[var(--border-color)]">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-[var(--text-primary)]">{moduleKpis.total}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">{t("kpi.total")}</p>
            </div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{moduleKpis.active}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-emerald-400/40">{t("kpi.active")}</p>
            </div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-blue-400">{moduleKpis.countries}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-blue-400/40">{t("kpi.countries")}</p>
            </div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-amber-400">{moduleKpis.newThisMonth}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-amber-400/40">{t("kpi.new")}</p>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-dim)] gap-2">
            <UsersIcon size={32} />
            <p className="text-sm">{t("noContactsFound")}</p>
          </div>
        ) : (
          grouped.map(([letter, items]) => (
            <div key={letter}>
              <div className="px-4 py-1.5 text-xs font-semibold text-[var(--text-dim)] bg-[var(--bg-surface-subtle)] sticky top-0 backdrop-blur-sm">
                {letter}
              </div>
              {items.map(c => {
                const isSelected = selectedId === c.id;
                const tierInfo = c.contact_type === "customer" ? getTierInfo(c.customer_type) : null;
                // Robust duplicate-name guard — normalize away ALL punctuation,
                // spacing and case so "CO.,LTD" === "CO.,LTD." (the real bug).
                // Keep CJK so a Chinese name is never collapsed into a Latin one.
                const norm = (x: string) => (x || "").toLowerCase().replace(/[^a-z0-9一-鿿]/g, "");
                const dnN = norm(contactDisplayName(c));
                const cnN = norm(c.company_name_cn || "");
                const coN = norm(c.company || "");
                const showCn = !!cnN && cnN !== dnN;
                const showCo = !!coN && coN !== dnN && coN !== cnN;
                const rating = Math.max(0, Math.min(5, Number(c.rating ?? 0)));
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectContact(c)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectContact(c); } }}
                    {...kxInspectAttrs({
                      component: filterType === "supplier" ? "SupplierRow" : filterType === "customer" ? "CustomerRow" : "ContactRow",
                      module: filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts",
                      section: "Directory list",
                      recordId: c.id,
                    })}
                    className={`group/row relative w-full flex items-center gap-3 ps-4 pe-4 py-3 text-start cursor-pointer transition-colors border-b border-[var(--border-faint)] contain-layout ${
                      isSelected
                        ? "bg-[var(--bg-surface-active)]"
                        : "hover:bg-[var(--bg-surface-subtle)]"
                    }`}
                  >
                    {/* Avatar — stronger container on the active row */}
                    <div className={`w-12 h-12 ${c.contact_type === "supplier" || c.contact_type === "company" || (c.contact_type === "customer" && c.entity_type === "company") ? "rounded-lg" : "rounded-full"} ${isSelected ? "bg-[var(--bg-surface)] ring-1 ring-[var(--border-color)]" : "bg-[var(--bg-surface-hover)]"} flex items-center justify-center text-sm font-semibold text-[var(--text-muted)] shrink-0 overflow-hidden transition-shadow`}>
                      {(c.photo_url || c.logo_url) ? (
                        <img src={(c.photo_url || c.logo_url) as string} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : c.contact_type === "supplier" || c.contact_type === "company" || (c.contact_type === "customer" && c.entity_type === "company") ? (
                        <Building2Icon size={16} className="text-[var(--text-dim)]" />
                      ) : (
                        getInitials(c)
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {contactDisplayName(c)}
                        </span>
                        {tierInfo && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${tierInfo.bg} ${tierInfo.color} font-medium`}>
                            {tierInfo.label}
                          </span>
                        )}
                      </div>
                      {showCn && (
                        <div lang="zh" className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                          {c.company_name_cn}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {(() => { const fl = contactFlag(c.country_code, c.country); return fl ? <span className="text-[11px] leading-none shrink-0" title={c.country || c.country_code || ""} aria-hidden>{fl}</span> : null; })()}
                        <span className={`text-[10px] font-medium ${getTypeColor(c.contact_type)}`}>
                          {t("type." + c.contact_type, c.contact_type?.charAt(0).toUpperCase() + c.contact_type?.slice(1))}
                        </span>
                        {rating > 0 && (
                          <span className="flex items-center gap-0.5" aria-label={`${rating} of 5 stars`}>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <StarIcon key={i} size={9} className={i <= rating ? "text-amber-400" : "text-[var(--text-faint)] opacity-40"} />
                            ))}
                          </span>
                        )}
                        {showCo && (
                          <span className="text-xs text-[var(--text-dim)] truncate">&middot; {c.company}</span>
                        )}
                      </div>
                      {/* ── Supplier mini-intelligence — readiness · strategic · type.
                            Sourced entirely from the list payload (contacts row), so it
                            adds zero queries and scales to large directories. ── */}
                      {c.contact_type === "supplier" && ((c.readiness_milestone ?? 0) > 0 || c.strategic_status || c.supplier_type) ? (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {(c.readiness_milestone ?? 0) > 0 ? (
                            <span className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold tabular-nums ${(c.readiness_milestone ?? 0) >= 75 ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : (c.readiness_milestone ?? 0) >= 50 ? "bg-amber-500/12 text-amber-600 dark:text-amber-400" : "bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]"}`}>
                              {c.readiness_milestone}%
                            </span>
                          ) : null}
                          {c.strategic_status ? (() => {
                            /* GEN-9 — drive the guidance badge from the canonical
                               tone helper so an approved / preferred / strategic
                               (trusted) supplier reads green with a star, and a
                               blocked / blacklisted one reads as a danger badge
                               with a warning glyph — not a neutral pill. */
                            const tone = strategicStatusTone(c.strategic_status);
                            const cls =
                              tone === "positive"
                                ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                                : tone === "danger"
                                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                                  : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]";
                            return (
                              <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold ${cls}`}>
                                {tone === "positive" ? <StarIcon size={8} /> : tone === "danger" ? <TriangleWarningIcon size={8} /> : null}
                                {t("opt." + c.strategic_status, STRATEGIC_STATUS_LABELS[c.strategic_status as keyof typeof STRATEGIC_STATUS_LABELS] ?? c.strategic_status)}
                              </span>
                            );
                          })() : null}
                          {c.supplier_type ? (
                            <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]">
                              {t("opt." + c.supplier_type, c.supplier_type)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {/* Row actions — appear on hover. Click stops bubble so the row doesn't select. */}
                    <div className={`flex items-center gap-0.5 shrink-0 ${isSelected ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"} transition-opacity`}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEditFor(c); }}
                        title={t("btn.edit", "Edit")}
                        aria-label={t("btn.edit", "Edit")}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                      >
                        <Edit3Icon size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); requestDelete(c); }}
                        title={t("btn.delete", "Delete")}
                        aria-label={t("btn.delete", "Delete")}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-faint)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      >
                        <TrashIcon size={13} />
                      </button>
                    </div>
                    <AngleRightIcon size={14} className="text-[var(--text-ghost)] shrink-0 rtl:rotate-180 hidden group-hover/row:hidden" />
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER: CONTACT DETAIL PANEL
     ═════════════════════════════════════════════════════════════════════════ */

  const renderDetailPanel = () => {
    /* Suppliers: render the full Supplier 360 inline (all intel sections),
       not the legacy base-field panel. */
    if (filterType === "supplier" && selectedContact && view === "detail") {
      return <SupplierDetail id={selectedContact.id} embedded onEdit={handleEdit} onDelete={() => requestDelete(selectedContact)} onBack={() => { setSelectedId(null); setView("list"); setMobileShowDetail(false); }} />;
    }
    if (!selectedContact) {
      /* ── Supplier KPI Dashboard ── */
      if (filterType === "supplier" && supplierKpis) {
        return (
          <div className="h-full overflow-y-auto">
            <div className="w-full px-4 md:px-6 py-6 md:py-8 space-y-4 md:space-y-6">
              {/* Title */}
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t("type.supplier")} {t("kpi.overview")}</h2>
                <p className="text-sm text-[var(--text-faint)] mt-1">{t("kpi.keyMetrics")}</p>
              </div>

              {/* Explore — two compact entry points to the deeper sourcing
                  surfaces. Ordered like the header tabs (coverage → intelligence)
                  so the nav reads consistently; kept lightweight so they read as
                  shortcuts, not a second competing nav. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { href: "/suppliers/main", icon: <StarIcon size={18} />, title: t("supplier.mainSuppliers", "Koleex Main Suppliers"), desc: t("supplier.mainSuppliersDesc", "Sourcing coverage map — main/backup suppliers by division, category & subcategory") },
                  { href: "/suppliers/sourcing", icon: <TargetIcon size={18} />, title: t("supplier.commandCenter", "Sourcing Command Center"), desc: t("supplier.commandCenterDesc", "Tenant-wide procurement intelligence — ranking, dependencies & recommendations") },
                ].map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="group flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3.5 transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)]">
                      {c.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">{c.title}</p>
                      <p className="text-[11px] text-[var(--text-faint)] mt-0.5 line-clamp-2">{c.desc}</p>
                    </div>
                    <AngleRightIcon size={14} className="shrink-0 text-[var(--text-ghost)] group-hover:text-[var(--text-secondary)] rtl:rotate-180" />
                  </Link>
                ))}
              </div>

              {/* Main KPI Row - 4 cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {/* Total Suppliers */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 transition-all hover:border-[var(--border-focus)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      <Building2Icon size={16} className="text-[var(--text-secondary)]" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">{t("kpi.total")}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{supplierKpis.total}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{t("kpi.allSuppliers")}</p>
                </div>

                {/* Active */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 transition-all hover:border-[var(--border-focus)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      <UserCheckIcon size={16} className="text-[var(--text-secondary)]" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">{t("kpi.active")}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{supplierKpis.active}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{supplierKpis.total > 0 ? Math.round((supplierKpis.active / supplierKpis.total) * 100) : 0}% {t("kpi.ofTotal")}</p>
                </div>

                {/* Countries */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 transition-all hover:border-[var(--border-focus)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      <GlobeIcon size={16} className="text-[var(--text-secondary)]" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">{t("kpi.countries")}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{supplierKpis.countries}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{t("kpi.sourceCountries")}</p>
                </div>

                {/* Avg Rating */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 transition-all hover:border-[var(--border-focus)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      <StarIcon size={16} className="text-[var(--text-secondary)]" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">{t("kpi.avgRating")}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{supplierKpis.avgRating > 0 ? supplierKpis.avgRating : "\u2014"}<span className="text-base text-[var(--text-ghost)]">/5</span></p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{supplierKpis.ratedCount} {t("kpi.rated")}</p>
                </div>
              </div>

              {/* Supplier Details Grid - 2x2 */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {/* Catalogues */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpenIcon size={16} className="text-[var(--text-secondary)]" />
                    <span className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">{t("kpi.catalogues")}</span>
                  </div>
                  <p className="text-3xl font-bold text-[var(--text-primary)]">{supplierKpis.withCatalogues}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{t("kpi.suppliersCatalogues")}</p>
                </div>

                {/* Contact Persons */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <UsersIcon size={16} className="text-[var(--text-secondary)]" />
                    <span className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">{t("kpi.contacts")}</span>
                  </div>
                  <p className="text-3xl font-bold text-[var(--text-primary)]">{supplierKpis.withContacts}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{t("kpi.withContactPersons")}</p>
                </div>

                {/* Divisions */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BriefcaseIcon size={16} className="text-[var(--text-secondary)]" />
                    <span className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">{t("kpi.divisions")}</span>
                  </div>
                  <p className="text-3xl font-bold text-[var(--text-primary)]">{supplierKpis.divisions}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{t("kpi.productDivisions")}</p>
                </div>

                {/* Categories */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <PackageIcon size={16} className="text-[var(--text-secondary)]" />
                    <span className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">{t("kpi.categories")}</span>
                  </div>
                  <p className="text-3xl font-bold text-[var(--text-primary)]">{supplierKpis.categories}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{t("kpi.productCategories")}</p>
                </div>
              </div>

              {/* New This Month */}
              {supplierKpis.newThisMonth > 0 && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                    <TrendingUpIcon size={20} className="text-[var(--text-secondary)]" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-[var(--text-primary)]">+{supplierKpis.newThisMonth}</p>
                    <p className="text-xs text-[var(--text-faint)]">{t("kpi.newSuppliersMonth")}</p>
                  </div>
                </div>
              )}

              {/* Hint */}
              <p className="text-xs text-[var(--text-ghost)] text-center pt-2">{t("kpi.selectSupplier")}</p>
            </div>
          </div>
        );
      }

      /* ── Customer KPI Dashboard ── */
      if (filterType === "customer" && moduleKpis) {
        const tierCounts = {
          diamond: contacts.filter(c => c.contact_type === filterType && c.customer_type === "diamond").length,
          platinum: contacts.filter(c => c.contact_type === filterType && c.customer_type === "platinum").length,
          gold: contacts.filter(c => c.contact_type === filterType && c.customer_type === "gold").length,
          silver: contacts.filter(c => c.contact_type === filterType && c.customer_type === "silver").length,
          end_user: contacts.filter(c => c.contact_type === filterType && c.customer_type === "end_user").length,
          none: contacts.filter(c => c.contact_type === filterType && !c.customer_type).length,
        };
        /* Customers grouped by country (for the flagged breakdown card).
           Keyed by ISO code when present (gives a flag), else by name. */
        const countryMap = new Map<string, { code: string; name: string; count: number }>();
        for (const c of contacts) {
          if (c.contact_type !== filterType) continue;
          let code = String(c.country_code || "").trim().toUpperCase();
          const rawName = String(c.country || "").trim();
          if (!code && !rawName) continue;
          /* Resolve BOTH fields from the country dataset: a record with only a
             code gets its full name; a record with only a name gets its ISO code
             (so the flag renders instead of a blank white flag). The name field
             sometimes literally holds a 2-letter ISO code (e.g. "EG") — treat
             that as a code too, so it merges with the proper country entry
             instead of forming a second row that collides on the render key. */
          if (!code && rawName) {
            code = COUNTRY_NAME_TO_CODE.get(rawName.toLowerCase())
              || (COUNTRY_CODE_TO_NAME.has(rawName.toUpperCase()) ? rawName.toUpperCase() : "");
          }
          const name = COUNTRY_CODE_TO_NAME.get(code) || rawName || code;
          /* One stable identity per country used for BOTH dedup and the React
             key, so the two can never diverge and produce duplicate keys. */
          const key = code || name.toLowerCase();
          const cur = countryMap.get(key);
          if (cur) cur.count += 1;
          else countryMap.set(key, { code, name, count: 1 });
        }
        const countryStats = Array.from(countryMap.values()).sort((a, b) => b.count - a.count);
        const countryMax = countryStats.reduce((m, x) => Math.max(m, x.count), 0);
        /* Show EVERY country we have a customer from — the map is rebuilt from
           live contacts, so a customer added from a new country appears here
           automatically. Not capped; the list scrolls inside the card. */
        const topCountries = countryStats;
        return (
          <div className="h-full overflow-y-auto">
            <div className="w-full px-4 md:px-6 py-6 md:py-8 space-y-4 md:space-y-6">
              {/* Title */}
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t("type.customer")} {t("kpi.overview")}</h2>
                <p className="text-sm text-[var(--text-faint)] mt-1">{t("kpi.keyMetrics")}</p>
              </div>

              {/* Explore — two compact entry points to the deeper customer
                  surfaces, mirroring the Supplier Overview's feature cards
                  (Main Suppliers / Sourcing Command Center). */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { href: "/crm", icon: <TargetIcon size={18} />, title: t("customer.crmPipeline", "CRM Pipeline"), desc: t("customer.crmPipelineDesc", "Opportunities, deals & follow-ups across your customer book") },
                  { href: "/commercial-policy", icon: <DollarSignIcon size={18} />, title: t("customer.commercialPolicy", "Commercial Policy & Pricing"), desc: t("customer.commercialPolicyDesc", "Customer tiers, price levels, discounts & credit rules") },
                ].map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="group flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3.5 transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)]">
                      {c.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">{c.title}</p>
                      <p className="text-[11px] text-[var(--text-faint)] mt-0.5 line-clamp-2">{c.desc}</p>
                    </div>
                    <AngleRightIcon size={14} className="shrink-0 text-[var(--text-ghost)] group-hover:text-[var(--text-secondary)] rtl:rotate-180" />
                  </Link>
                ))}
              </div>

              {/* Main KPI Row — neutral chip styling, same as Supplier Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {/* Total */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 transition-all hover:border-[var(--border-focus)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      <CrownIcon size={16} className="text-[var(--text-secondary)]" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">{t("kpi.total")}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{moduleKpis.total}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{t("kpi.allCustomers")}</p>
                </div>

                {/* Active */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 transition-all hover:border-[var(--border-focus)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      <UserCheckIcon size={16} className="text-[var(--text-secondary)]" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">{t("kpi.active")}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{moduleKpis.active}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{moduleKpis.total > 0 ? Math.round((moduleKpis.active / moduleKpis.total) * 100) : 0}% {t("kpi.ofTotal")}</p>
                </div>

                {/* VIP */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 transition-all hover:border-[var(--border-focus)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      <GemIcon size={16} className="text-[var(--text-secondary)]" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">{t("kpi.vip")}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{moduleKpis.vip}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{t("kpi.diamondPlatinum")}</p>
                </div>

                {/* Countries */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 transition-all hover:border-[var(--border-focus)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      <MapPinnedIcon size={16} className="text-[var(--text-secondary)]" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">{t("kpi.countries")}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{moduleKpis.countries}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{t("kpi.globalReach")}</p>
                </div>
              </div>

              {/* Tier Breakdown */}
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5">
                <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">{t("kpi.customerTiers")}</h3>
                <div className="space-y-3">
                  {[
                    /* Diamond / Platinum / Gold / Silver get a shiny material
                       gradient (via the .kx-tier-metal utility + --kx-tier-grad)
                       so each label reads like the precious material it's named
                       after. The same gradient fills the progress bar. End User
                       keeps a flat emerald (not a precious material). */
                    { key: "diamond", label: t("tier.diamond"), count: tierCounts.diamond, grad: "linear-gradient(100deg, #7fd7ff 0%, #e8faff 20%, #ffffff 38%, #d9c7ff 55%, #9be8ff 72%, #ffffff 88%, #7fd7ff 100%)" },
                    { key: "platinum", label: t("tier.platinum"), count: tierCounts.platinum, grad: "linear-gradient(100deg, #a7adb5 0%, #ffffff 22%, #dfe3e8 42%, #9aa0a8 60%, #ffffff 80%, #c3c8ce 100%)" },
                    { key: "gold", label: t("tier.gold"), count: tierCounts.gold, grad: "linear-gradient(100deg, #b8860b 0%, #f7c948 22%, #fff3b0 42%, #e6a817 60%, #fff6c2 80%, #d4930a 100%)" },
                    { key: "silver", label: t("tier.silver"), count: tierCounts.silver, grad: "linear-gradient(100deg, #8a9299 0%, #ffffff 24%, #c8ced4 44%, #7f878e 62%, #ffffff 82%, #b0b6bd 100%)" },
                    { key: "end_user", label: t("tier.end_user"), count: tierCounts.end_user, textColor: "text-emerald-600 dark:text-emerald-300", barColor: "bg-emerald-500" },
                  ].map(tier => (
                    <div key={tier.key} className="flex items-center gap-3">
                      <span
                        className={`text-xs font-semibold w-20 ${tier.grad ? "kx-tier-metal" : tier.textColor}`}
                        style={tier.grad ? ({
                          /* Static gradient-text is inlined so it renders even
                             if the .kx-tier-metal rule (which adds the animated
                             shine) hasn't loaded. */
                          backgroundImage: tier.grad,
                          backgroundSize: "200% auto",
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          color: "transparent",
                          WebkitTextFillColor: "transparent",
                          ["--kx-tier-grad" as string]: tier.grad,
                        } as React.CSSProperties) : undefined}
                      >
                        {tier.label}
                      </span>
                      <div className="flex-1 h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${tier.barColor ?? ""}`}
                          style={{
                            width: moduleKpis.total > 0 ? `${(tier.count / moduleKpis.total) * 100}%` : "0%",
                            ...(tier.grad ? { backgroundImage: tier.grad, backgroundSize: "200% auto" } : {}),
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-muted)] w-8 text-end">{tier.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customers by Country (flagged) */}
              {topCountries.length > 0 && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("kpi.customersByCountry")}</h3>
                    <span className="text-xs font-semibold text-[var(--text-faint)] shrink-0">{topCountries.length}</span>
                  </div>
                  <div className="space-y-3">
                    {topCountries.map((cty) => (
                      <div key={cty.code || cty.name.toLowerCase()} className="flex items-center gap-3">
                        <span className="text-base w-6 text-center shrink-0" aria-hidden>{countryCodeToFlag(cty.code) || "🏳️"}</span>
                        <span className="text-xs font-medium w-32 shrink-0 truncate text-[var(--text-secondary)]" title={cty.name}>{cty.name}</span>
                        <div className="flex-1 h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: countryMax > 0 ? `${(cty.count / countryMax) * 100}%` : "0%" }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-[var(--text-muted)] w-8 text-end">{cty.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New This Month — neutral trend card, same as Supplier Overview.
                  (The old Active/Inactive 2-col block was removed: it repeated
                  the Active KPI above; the supplier layout has no such block.) */}
              {moduleKpis.newThisMonth > 0 && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                    <TrendingUpIcon size={20} className="text-[var(--text-secondary)]" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-[var(--text-primary)]">+{moduleKpis.newThisMonth}</p>
                    <p className="text-xs text-[var(--text-faint)]">{t("kpi.newCustomersMonth")}</p>
                  </div>
                </div>
              )}

              {/* Hint */}
              <p className="text-xs text-[var(--text-ghost)] text-center pt-2">{t("kpi.selectCustomer")}</p>
            </div>
          </div>
        );
      }

      /* ── Generic KPI Dashboard (Company / People) ── */
      if (filterType && moduleKpis) {
        const typeLabel = t("type." + filterType, filterType.charAt(0).toUpperCase() + filterType.slice(1));
        const typeIcon = filterType === "company" ? <BriefcaseIcon size={16} className="text-purple-400" /> : <UserIcon size={16} className="text-green-400" />;
        const accentColor = filterType === "company" ? "purple" : "green";
        return (
          <div className="h-full overflow-y-auto">
            <div className="w-full px-4 md:px-6 py-6 md:py-8 space-y-4 md:space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{typeLabel} {t("kpi.overview")}</h2>
                <p className="text-sm text-[var(--text-faint)] mt-1">{t("kpi.keyMetrics")}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 transition-all hover:border-[var(--border-focus)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg bg-${accentColor}-500/10`}>{typeIcon}</div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">{t("kpi.total")}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{moduleKpis.total}</p>
                </div>
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 transition-all hover:border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10"><UserCheckIcon size={16} className="text-emerald-400" /></div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/60">{t("kpi.active")}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-emerald-400">{moduleKpis.active}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{moduleKpis.total > 0 ? Math.round((moduleKpis.active / moduleKpis.total) * 100) : 0}% {t("kpi.ofTotal")}</p>
                </div>
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 transition-all hover:border-blue-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10"><MapPinnedIcon size={16} className="text-blue-400" /></div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/60">{t("kpi.countries")}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-blue-400">{moduleKpis.countries}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{t("kpi.globalReach")}</p>
                </div>
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 transition-all hover:border-amber-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10"><TrendingUpIcon size={16} className="text-amber-400" /></div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/60">{t("kpi.new")}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-amber-400">{moduleKpis.newThisMonth}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{t("kpi.addedThisMonth")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">{t("kpi.active")}</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400">{moduleKpis.active}</p>
                </div>
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">{t("kpi.inactive")}</span>
                  </div>
                  <p className="text-3xl font-bold text-red-400">{moduleKpis.total - moduleKpis.active}</p>
                </div>
              </div>
              {moduleKpis.newThisMonth > 0 && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 md:p-5 flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10">
                    <TrendingUpIcon size={20} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-400">+{moduleKpis.newThisMonth}</p>
                    <p className="text-xs text-[var(--text-faint)]">{t("kpi.addedThisMonth")}</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-[var(--text-ghost)] text-center pt-2">{t("selectContact")}</p>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--text-ghost)] gap-3">
          <UserIcon size={48} />
          <p className="text-sm">{t("selectContact")}</p>
        </div>
      );
    }

    const c = selectedContact;
    const tierInfo = c.contact_type === "customer" ? getTierInfo(c.customer_type) : null;
    const phones: PhoneEntry[] = Array.isArray(c.phones) ? c.phones : [];
    const emails: EmailEntry[] = Array.isArray(c.emails) ? c.emails : [];
    const addresses: AddressEntry[] = Array.isArray(c.addresses) ? c.addresses : [];
    const websitesList: WebsiteEntry[] = Array.isArray(c.websites) ? c.websites : [];
    const socials: SocialProfile[] = Array.isArray(c.social_profiles) ? c.social_profiles : [];
    const family: FamilyMember[] = Array.isArray(c.family_members) ? c.family_members : [];
    const related: RelatedName[] = Array.isArray(c.related_names) ? c.related_names : [];
    const customs: CustomField[] = Array.isArray(c.custom_fields) ? c.custom_fields : [];

    /* Customer detail tabs — non-customer types ignore the tab state entirely. */
    const isCustomerDetail = c.contact_type === "customer" && !!c.entity_type;
    const detailTab = (tab: CustomerTab) => !isCustomerDetail || customerTab === tab;

    const backLabel = filterType ? t("type." + filterType, filterType.charAt(0).toUpperCase() + filterType.slice(1)) + " " + t("kpi.overview") : t("title");

    return (
      <div className="h-full overflow-y-auto">
        {/* Back button */}
        <div className="px-4 py-3 border-b border-[var(--border-color)]">
          <button onClick={handleBack} className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors">
            <ArrowLeftIcon size={16} className="rtl:rotate-180" /> {backLabel}
          </button>
        </div>

        {/* Header card */}
        <div className="px-4 md:px-6 py-6 md:py-8 text-center border-b border-[var(--border-color)]">
          <div className={`w-24 h-24 ${c.contact_type === "supplier" || c.contact_type === "company" || (c.contact_type === "customer" && c.entity_type === "company") ? "rounded-2xl" : "rounded-full"} bg-[var(--bg-surface-hover)] flex items-center justify-center text-2xl font-bold text-[var(--text-subtle)] mx-auto mb-4 overflow-hidden`}>
            {(c.photo_url || c.logo_url) ? (
              <img src={(c.photo_url || c.logo_url) as string} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            ) : c.contact_type === "supplier" || c.contact_type === "company" || (c.contact_type === "customer" && c.entity_type === "company") ? (
              <Building2Icon size={32} className="text-[var(--text-ghost)]" />
            ) : (
              getInitials(c)
            )}
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">{contactDisplayName(c)}</h2>
          {c.contact_type === "supplier" && c.company_name_cn && <p className="text-sm text-[var(--text-faint)] mt-0.5">{c.company_name_cn}</p>}
          {c.contact_type !== "supplier" && c.contact_type !== "company" && !(c.contact_type === "customer" && c.entity_type === "company") && c.position && <p className="text-sm text-[var(--text-subtle)] mt-1">{c.position}</p>}
          {c.contact_type !== "supplier" && c.contact_type !== "company" && !(c.contact_type === "customer" && c.entity_type === "company") && c.company && <p className="text-sm text-[var(--text-faint)]">{c.company}</p>}

          <div className="flex items-center justify-center gap-2 mt-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border border-[var(--border-color)] ${getTypeColor(c.contact_type)}`}>
              {t("type." + c.contact_type, c.contact_type?.charAt(0).toUpperCase() + c.contact_type?.slice(1))}{c.contact_type === "customer" && c.entity_type === "company" ? " · " + t("entity.business") : c.contact_type === "customer" && c.entity_type === "person" ? " · " + t("entity.individual") : ""}
            </span>
            {tierInfo && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${tierInfo.bg} ${tierInfo.color}`}>
                {tierInfo.label}
              </span>
            )}
            {!c.is_active && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-500/20 text-red-400">
                {t("kpi.inactive")}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-2 mt-5">
            <button onClick={handleEdit} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] text-sm transition-colors">
              <Edit3Icon size={14} /> {t("btn.edit")}
            </button>
            <button
              onClick={() => requestDelete(c)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-colors"
            >
              <TrashIcon size={14} /> {t("btn.delete")}
            </button>
          </div>
        </div>

        {/* Premium tabs (Customer only) */}
        {isCustomerDetail && (
          <CustomerTabBar activeTab={customerTab} onChange={setCustomerTab} translate={(k, f) => t(k, f)} />
        )}

        {/* Customer Hero Strip — quick badges for tier, KYC, VIP, Strategic, Flags */}
        {isCustomerDetail && (c.market_band || c.commercial_role || c.kyc_status || c.sanctions_check_status || c.vip_status || c.strategic_account || c.pep_status || c.high_risk_country) && (
          <div className="px-4 md:px-6 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="flex flex-wrap items-center gap-1.5">
              {c.market_band && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-medium border border-blue-500/20">
                  <TargetIcon size={10} /> {t("field.marketBand", "Band")} {c.market_band}
                </span>
              )}
              {c.commercial_role && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] text-[11px] font-medium border border-[var(--border-color)]">
                  <HandCoinsIcon size={10} /> {c.commercial_role}
                </span>
              )}
              {c.kyc_status && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  c.kyc_status === "Verified" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : c.kyc_status === "Flagged" ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : c.kyc_status === "Expired" ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-color)]"
                }`}>
                  <ShieldCheckIcon size={10} /> KYC: {c.kyc_status}
                </span>
              )}
              {c.sanctions_check_status === "Clear" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                  <ShieldCheckIcon size={10} /> {t("field.sanctionsClear", "Sanctions Clear")}
                </span>
              )}
              {c.sanctions_check_status === "Flagged" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[11px] font-medium border border-red-500/20">
                  <ShieldExclamationIcon size={10} /> {t("field.sanctionsFlagged", "Sanctions Flagged")}
                </span>
              )}
              {c.vip_status && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-[11px] font-medium border border-violet-500/20">
                  <GemIcon size={10} /> VIP
                </span>
              )}
              {c.strategic_account && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-medium border border-amber-500/20">
                  <StarIcon size={10} /> {t("field.strategic", "Strategic")}
                </span>
              )}
              {c.pep_status && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[11px] font-medium border border-orange-500/20">
                  <TriangleWarningIcon size={10} /> PEP
                </span>
              )}
              {c.high_risk_country && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[11px] font-medium border border-red-500/20">
                  <TriangleWarningIcon size={10} /> {t("field.highRiskShort", "High-Risk")}
                </span>
              )}
              {Array.isArray(c.flags) && c.flags.map((fl: string, i: number) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] text-[11px] font-medium border border-[var(--border-color)]">
                  <TriangleWarningIcon size={10} /> {fl}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Phone numbers (hidden for suppliers) */}
        {c.contact_type !== "supplier" && detailTab("overview") && (phones.length > 0 || c.phone) && (
          <Section title={t("detail.phone")} icon={<PhoneIcon size={14} />}>
            {phones.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-xs text-blue-400 font-medium">{p.label}</span>
                  <p className="text-sm text-[var(--text-primary)]">{p.number}</p>
                </div>
              </div>
            ))}
            {phones.length === 0 && c.phone && (
              <p className="text-sm text-[var(--text-primary)]">{c.phone}</p>
            )}
          </Section>
        )}

        {/* Emails (hidden for suppliers) */}
        {c.contact_type !== "supplier" && detailTab("overview") && (emails.length > 0 || c.email) && (
          <Section title={t("detail.email")} icon={<EnvelopeIcon size={14} />}>
            {emails.map((e, i) => (
              <div key={i} className="py-1.5">
                <span className="text-xs text-blue-400 font-medium">{e.label}</span>
                <p className="text-sm text-[var(--text-primary)]">{e.email}</p>
              </div>
            ))}
            {emails.length === 0 && c.email && (
              <p className="text-sm text-[var(--text-primary)]">{c.email}</p>
            )}
          </Section>
        )}

        {/* Addresses (hidden for suppliers) */}
        {c.contact_type !== "supplier" && detailTab("overview") && addresses.length > 0 && (
          <Section title={t("detail.address")} icon={<MapPinIcon size={14} />}>
            {addresses.map((a, i) => (
              <div key={i} className="py-1.5">
                <span className="text-xs text-blue-400 font-medium">{a.label}</span>
                <p className="text-sm text-[var(--text-primary)]">
                  {[a.street, a.city, a.state, a.zip, a.country].filter(Boolean).join(", ")}
                </p>
              </div>
            ))}
          </Section>
        )}

        {/* Country / Province / City (hidden for suppliers - shown in Contact Details) */}
        {c.contact_type !== "supplier" && detailTab("overview") && (c.country || c.province || c.city) && (
          <Section title={t("section.location")} icon={<MapPinIcon size={14} />}>
            <div className="flex items-center gap-2">
              {c.country_code && <span className="text-base">{countryCodeToFlag(c.country_code)}</span>}
              <p className="text-sm text-[var(--text-primary)]">
                {[c.city, c.province, c.country].filter(Boolean).join(", ")}
              </p>
            </div>
          </Section>
        )}

        {/* Websites (hidden for suppliers) */}
        {c.contact_type !== "supplier" && detailTab("overview") && (websitesList.length > 0 || c.website) && (
          <Section title={t("detail.website")} icon={<GlobeIcon size={14} />}>
            {websitesList.map((w, i) => (
              <div key={i} className="py-1.5">
                <span className="text-xs text-blue-400 font-medium">{w.label}</span>
                <p className="text-sm text-blue-400 hover:underline cursor-pointer">{w.url}</p>
              </div>
            ))}
            {websitesList.length === 0 && c.website && (
              <p className="text-sm text-blue-400">{c.website}</p>
            )}
          </Section>
        )}

        {/* Birthday (hidden for suppliers, company customers, company type) */}
        {c.contact_type !== "supplier" && c.contact_type !== "company" && !(c.contact_type === "customer" && c.entity_type === "company") && detailTab("overview") && c.birthday && (
          <Section title={t("section.birthday")} icon={<CalendarRawIcon size={14} />}>
            <p className="text-sm text-[var(--text-primary)]">{new Date(c.birthday).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
          </Section>
        )}

        {/* Social Profiles (hidden for company customers) */}
        {!(c.contact_type === "customer" && c.entity_type === "company") && detailTab("overview") && socials.length > 0 && (
          <Section title={t("section.socialProfiles")} icon={<Share2Icon size={14} />}>
            {socials.map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="flex-1">
                  <span className="text-xs text-blue-400 font-medium">{s.platform}</span>
                  <p className="text-sm text-[var(--text-primary)]">{s.username || s.url}</p>
                </div>
                {s.qr_code_url && (
                  <img src={s.qr_code_url} alt="QR" className="w-10 h-10 rounded border border-[var(--border-color)]" loading="lazy" decoding="async" />
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Related People (hidden for suppliers, company customers, and company type) */}
        {c.contact_type !== "supplier" && c.contact_type !== "company" && !(c.contact_type === "customer" && c.entity_type === "company") && detailTab("activity") && family.length > 0 && (
          <Section title={t("section.relatedPeople")} icon={<UsersIcon size={14} />}>
            {family.map((f, i) => (
              <div key={i} className="py-2 border-b border-[var(--border-faint)] last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-xs font-semibold text-[var(--text-subtle)] overflow-hidden">
                    {f.photo_url ? <img src={f.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /> : (f.first_name?.[0] || "?").toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xs text-blue-400 font-medium">{f.relationship}</span>
                    <p className="text-sm text-[var(--text-primary)]">{[f.title, f.first_name, f.middle_name, f.last_name].filter(Boolean).join(" ")}</p>
                  </div>
                </div>
                {(f.phone || f.email) && (
                  <div className="ms-11 mt-1 text-xs text-[var(--text-faint)] space-y-0.5">
                    {f.phone && <p>{t("detail.phone")}: {f.phone}</p>}
                    {f.email && <p>{t("detail.email")}: {f.email}</p>}
                  </div>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Business Card (customers only — Overview tab) */}
        {c.contact_type === "customer" && detailTab("overview") && (c.business_card_front || c.business_card_back) && (
          <Section title={t("section.businessCard")} icon={<CreditCardIcon size={14} />}>
            <div className="grid grid-cols-2 gap-3">
              {c.business_card_front && (
                <div>
                  <span className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("detail.front")}</span>
                  <img src={c.business_card_front!} alt="Business Card Front" className="w-full rounded-lg border border-[var(--border-color)]" loading="lazy" decoding="async" />
                </div>
              )}
              {c.business_card_back && (
                <div>
                  <span className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("detail.back")}</span>
                  <img src={c.business_card_back!} alt="Business Card Back" className="w-full rounded-lg border border-[var(--border-color)]" loading="lazy" decoding="async" />
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Company Customer: Company Info (Overview tab) ── */}
        {c.contact_type === "customer" && c.entity_type === "company" && detailTab("overview") && (c.company || c.industry || c.tax_id) && (
          <Section title={t("section.companyInfo")} icon={<Building2Icon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.company && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.companyName")}</span>
                  <p className="text-sm text-[var(--text-primary)] font-medium">{c.company}</p>
                </div>
              )}
              {c.industry && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.industry")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.industry}</p>
                </div>
              )}
              {c.tax_id && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.taxId")}</span>
                  <p className="text-sm text-[var(--text-primary)] font-mono">{c.tax_id}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Company Customer: Contact Persons (Activity tab) ── */}
        {c.contact_type === "customer" && c.entity_type === "company" && detailTab("activity") && Array.isArray(c.contact_persons) && c.contact_persons.length > 0 && (
          <Section title={t("section.contactPersons")} icon={<UsersIcon size={14} />}>
            <div className="space-y-2">
              {c.contact_persons.map((cp: { name: string; name_cn?: string; position: string; department: string; phone: string; mobile: string; email: string; notes: string; whatsapp?: string; wechat_id?: string; wechat_qr?: string }, i: number) => (
                <div key={i} className="py-2 border-b border-[var(--border-faint)] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-xs font-semibold text-[var(--text-subtle)]">
                      {(cp.name?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[var(--text-primary)] font-medium">{cp.name}{cp.name_cn ? <span className="text-[var(--text-faint)] font-normal"> · {cp.name_cn}</span> : null}</p>
                      <div className="flex items-center gap-2">
                        {cp.position && <span className="text-xs text-[var(--text-faint)]">{cp.position}</span>}
                        {cp.department && <span className="text-xs text-[var(--text-dim)]">{cp.position ? " · " : ""}{cp.department}</span>}
                      </div>
                    </div>
                  </div>
                  {(cp.phone || cp.mobile || cp.email || cp.whatsapp || cp.wechat_id) && (
                    <div className="ms-11 mt-1 text-xs text-[var(--text-faint)] space-y-0.5">
                      {cp.phone && <p>{t("detail.tel")}: {cp.phone}</p>}
                      {cp.mobile && <p>{t("detail.mobile")}: {cp.mobile}</p>}
                      {cp.email && <p>{t("detail.email")}: {cp.email}</p>}
                      {cp.whatsapp && <p>{t("field.whatsappBusiness", "WhatsApp")}: {cp.whatsapp}</p>}
                      {cp.wechat_id && <p>{t("field.wechat", "WeChat")}: {cp.wechat_id}</p>}
                    </div>
                  )}
                  {cp.wechat_qr && (
                    <div className="ms-11 mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cp.wechat_qr} alt={`${cp.name || "Contact"} WeChat QR`} className="h-24 w-24 rounded-lg border border-[var(--border-color)] object-cover bg-white" />
                    </div>
                  )}
                  {cp.notes && <p className="ms-11 mt-1 text-xs text-[var(--text-dim)]">{cp.notes}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Company Type: Company Info ── */}
        {c.contact_type === "company" && (c.company || c.industry || c.tax_id || c.source || c.language) && (
          <Section title={t("section.companyInfo")} icon={<Building2Icon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.company && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.companyName")}</span>
                  <p className="text-sm text-[var(--text-primary)] font-medium">{c.company}</p>
                </div>
              )}
              {c.industry && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.industry")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.industry}</p>
                </div>
              )}
              {c.tax_id && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.taxId")}</span>
                  <p className="text-sm text-[var(--text-primary)] font-mono">{c.tax_id}</p>
                </div>
              )}
              {c.source && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.source")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.source}</p>
                </div>
              )}
              {c.language && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.language")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.language}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Company Type: Contact Persons ── */}
        {c.contact_type === "company" && Array.isArray(c.contact_persons) && c.contact_persons.length > 0 && (
          <Section title={t("section.contactPersons")} icon={<UsersIcon size={14} />}>
            <div className="space-y-2">
              {c.contact_persons.map((cp: { name: string; name_cn?: string; position: string; department: string; phone: string; mobile: string; email: string; notes: string; whatsapp?: string; wechat_id?: string; wechat_qr?: string }, i: number) => (
                <div key={i} className="py-2 border-b border-[var(--border-faint)] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-xs font-semibold text-[var(--text-subtle)]">
                      {(cp.name?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[var(--text-primary)] font-medium">{cp.name}{cp.name_cn ? <span className="text-[var(--text-faint)] font-normal"> · {cp.name_cn}</span> : null}</p>
                      <div className="flex items-center gap-2">
                        {cp.position && <span className="text-xs text-[var(--text-faint)]">{cp.position}</span>}
                        {cp.department && <span className="text-xs text-[var(--text-dim)]">{cp.position ? " · " : ""}{cp.department}</span>}
                      </div>
                    </div>
                  </div>
                  {(cp.phone || cp.mobile || cp.email || cp.whatsapp || cp.wechat_id) && (
                    <div className="ms-11 mt-1 text-xs text-[var(--text-faint)] space-y-0.5">
                      {cp.phone && <p>{t("detail.tel")}: {cp.phone}</p>}
                      {cp.mobile && <p>{t("detail.mobile")}: {cp.mobile}</p>}
                      {cp.email && <p>{t("detail.email")}: {cp.email}</p>}
                      {cp.whatsapp && <p>{t("field.whatsappBusiness", "WhatsApp")}: {cp.whatsapp}</p>}
                      {cp.wechat_id && <p>{t("field.wechat", "WeChat")}: {cp.wechat_id}</p>}
                    </div>
                  )}
                  {cp.wechat_qr && (
                    <div className="ms-11 mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cp.wechat_qr} alt={`${cp.name || "Contact"} WeChat QR`} className="h-24 w-24 rounded-lg border border-[var(--border-color)] object-cover bg-white" />
                    </div>
                  )}
                  {cp.notes && <p className="ms-11 mt-1 text-xs text-[var(--text-dim)]">{cp.notes}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Financial & Business (customer only — Financial tab) ── */}
        {c.contact_type === "customer" && detailTab("financial") && (c.total_revenue || c.outstanding_balance || c.credit_limit || c.payment_terms || c.currency || c.last_order_date) && (
          <Section title={t("section.financialBusiness")} icon={<DollarSignIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.total_revenue && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.totalRevenue")}</span>
                  <p className="text-sm text-emerald-400 font-semibold">{c.currency || "USD"} {Number(c.total_revenue).toLocaleString()}</p>
                </div>
              )}
              {c.outstanding_balance && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("detail.outstanding")}</span>
                  <p className="text-sm text-amber-400 font-semibold">{c.currency || "USD"} {Number(c.outstanding_balance).toLocaleString()}</p>
                </div>
              )}
              {c.credit_limit && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("detail.creditLimit")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.currency || "USD"} {Number(c.credit_limit).toLocaleString()}</p>
                </div>
              )}
              {c.payment_terms && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.paymentTerms")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.payment_terms}</p>
                </div>
              )}
              {c.currency && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.currency")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.currency}</p>
                </div>
              )}
              {c.last_order_date && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("detail.lastOrder")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{new Date(c.last_order_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Classification & Segmentation (customer only — Commercial tab) ── */}
        {c.contact_type === "customer" && detailTab("commercial") && (c.industry || c.source || (Array.isArray(c.tags) && c.tags.length > 0) || c.account_manager) && (
          <Section title={t("section.classification")} icon={<TagsIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.industry && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.industry")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.industry}</p>
                </div>
              )}
              {c.source && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.source")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.source}</p>
                </div>
              )}
              {c.account_manager && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.accountManager")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.account_manager}</p>
                </div>
              )}
            </div>
            {Array.isArray(c.tags) && c.tags.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-1.5">{t("field.tags")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {c.tags.map((tag: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── Relationship & Activity (Activity tab) ── */}
        {c.contact_type === "customer" && detailTab("activity") && (c.first_contact_date || c.last_contacted || c.follow_up_date || c.communication_preference || c.language) && (
          <Section title={t("section.relationshipActivity")} icon={<ClockIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.first_contact_date && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.firstContact")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{new Date(c.first_contact_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              )}
              {c.last_contacted && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.lastContacted")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{new Date(c.last_contacted).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              )}
              {c.follow_up_date && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.followUpDate")}</span>
                  <p className={`text-sm font-medium ${new Date(c.follow_up_date) < new Date() ? "text-red-400" : "text-blue-400"}`}>{new Date(c.follow_up_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              )}
              {c.communication_preference && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.prefers")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.communication_preference}</p>
                </div>
              )}
              {c.language && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.language")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.language}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Trade-Specific (customer only — Trade tab) ── */}
        {c.contact_type === "customer" && detailTab("trade") && (c.preferred_shipping || c.tax_id || c.incoterms || (Array.isArray(c.shipping_addresses) && c.shipping_addresses.length > 0)) && (
          <Section title={t("section.tradeShipping")} icon={<ShipIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.preferred_shipping && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.shippingMethod")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.preferred_shipping}</p>
                </div>
              )}
              {c.incoterms && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.incoterms")}</span>
                  <p className="text-sm text-[var(--text-primary)] font-mono">{c.incoterms}</p>
                </div>
              )}
              {c.tax_id && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.taxIdImport")}</span>
                  <p className="text-sm text-[var(--text-primary)] font-mono">{c.tax_id}</p>
                </div>
              )}
            </div>
            {Array.isArray(c.shipping_addresses) && c.shipping_addresses.length > 0 && (
              <div className="mt-3 space-y-2">
                <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block">{t("field.shippingAddresses")}</span>
                {c.shipping_addresses.map((a: AddressEntry, i: number) => (
                  <div key={i} className="py-1.5">
                    <span className="text-xs text-blue-400 font-medium">{a.label}</span>
                    <p className="text-sm text-[var(--text-primary)]">{[a.street, a.city, a.state, a.zip, a.country].filter(Boolean).join(", ")}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Attachments (hidden for suppliers — Compliance tab for customers) ── */}
        {c.contact_type !== "supplier" && (c.contact_type !== "customer" || detailTab("compliance")) && Array.isArray(c.attachments) && c.attachments.length > 0 && (
          <Section title={t("section.documents")} icon={<PaperclipIcon size={14} />}>
            <div className="space-y-2">
              {c.attachments.map((a: Attachment, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)]">
                  <FileCheckIcon size={16} className="text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">{a.name}</p>
                    <p className="text-[10px] text-[var(--text-dim)]">{a.type} &middot; {a.uploaded_at ? new Date(a.uploaded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Supplier: 1. Company Name ── */}
        {c.contact_type === "supplier" && (
          <Section title={t("section.companyName")} icon={<Building2Icon size={14} />}>
            <div className="space-y-2">
              {c.company_name_en && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("detail.english")}</span>
                  <p className="text-sm text-[var(--text-primary)] font-medium">{c.company_name_en}</p>
                </div>
              )}
              {c.company_name_cn && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("detail.chinese")}</span>
                  <p className="text-sm text-[var(--text-primary)] font-medium">{c.company_name_cn}</p>
                </div>
              )}
            </div>
            {Array.isArray(c.additional_company_names) && c.additional_company_names.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-1.5">{t("field.otherNames")}</span>
                <div className="space-y-1">
                  {c.additional_company_names.map((entry: { language: string; name: string }, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-blue-400 font-medium min-w-[60px]">{entry.language}</span>
                      <span className="text-sm text-[var(--text-primary)]">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── Supplier: 2. Contact Details ── */}
        {c.contact_type === "supplier" && (c.supplier_tel || c.supplier_mobile || c.supplier_email || c.supplier_website || c.supplier_address || c.country) && (
          <Section title={t("section.contactDetails")} icon={<PhoneIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.supplier_tel && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("detail.tel")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.supplier_tel}</p>
                </div>
              )}
              {c.supplier_mobile && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("detail.mobile")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.supplier_mobile}</p>
                </div>
              )}
              {c.supplier_email && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("detail.email")}</span>
                  <p className="text-sm text-blue-400">{c.supplier_email}</p>
                </div>
              )}
              {c.supplier_website && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("detail.website")}</span>
                  <p className="text-sm text-blue-400 hover:underline cursor-pointer" onClick={() => window.open(c.supplier_website!.startsWith("http") ? c.supplier_website! : "https://" + c.supplier_website!, "_blank")}>{c.supplier_website}</p>
                </div>
              )}
              {c.supplier_address && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("detail.address")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.supplier_address}</p>
                </div>
              )}
            </div>
            {(c.country || c.province || c.city || c.supplier_postal_code) && (
              <div className="mt-3 flex items-center gap-2">
                {c.country_code && <span className="text-base">{countryCodeToFlag(c.country_code)}</span>}
                <p className="text-sm text-[var(--text-primary)]">{[c.city, c.province, c.country, c.supplier_postal_code].filter(Boolean).join(", ")}</p>
              </div>
            )}
          </Section>
        )}

        {/* ── Supplier: 3. Contact Persons ── */}
        {c.contact_type === "supplier" && Array.isArray(c.contact_persons) && c.contact_persons.length > 0 && (
          <Section title={t("section.contactPersons")} icon={<UsersIcon size={14} />}>
            <div className="space-y-2">
              {c.contact_persons.map((cp: { name: string; name_cn?: string; position: string; department: string; phone: string; mobile: string; email: string; notes: string; whatsapp?: string; wechat_id?: string; wechat_qr?: string }, i: number) => (
                <div key={i} className="py-2 border-b border-[var(--border-faint)] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-xs font-semibold text-[var(--text-subtle)]">
                      {(cp.name?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[var(--text-primary)] font-medium">{cp.name}{cp.name_cn ? <span className="text-[var(--text-faint)] font-normal"> · {cp.name_cn}</span> : null}</p>
                      <div className="flex items-center gap-2">
                        {cp.position && <span className="text-xs text-[var(--text-faint)]">{cp.position}</span>}
                        {cp.department && <span className="text-xs text-[var(--text-dim)]">{cp.position ? " · " : ""}{cp.department}</span>}
                      </div>
                    </div>
                  </div>
                  {(cp.phone || cp.mobile || cp.email || cp.whatsapp || cp.wechat_id) && (
                    <div className="ms-11 mt-1 text-xs text-[var(--text-faint)] space-y-0.5">
                      {cp.phone && <p>{t("detail.tel")}: {cp.phone}</p>}
                      {cp.mobile && <p>{t("detail.mobile")}: {cp.mobile}</p>}
                      {cp.email && <p>{t("detail.email")}: {cp.email}</p>}
                      {cp.whatsapp && <p>{t("field.whatsappBusiness", "WhatsApp")}: {cp.whatsapp}</p>}
                      {cp.wechat_id && <p>{t("field.wechat", "WeChat")}: {cp.wechat_id}</p>}
                    </div>
                  )}
                  {cp.wechat_qr && (
                    <div className="ms-11 mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cp.wechat_qr} alt={`${cp.name || "Contact"} WeChat QR`} className="h-24 w-24 rounded-lg border border-[var(--border-color)] object-cover bg-white" />
                    </div>
                  )}
                  {cp.notes && <p className="ms-11 mt-1 text-xs text-[var(--text-dim)]">{cp.notes}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Supplier: 4. Company Profile ── */}
        {c.contact_type === "supplier" && (c.supplier_type || c.industry || c.source || c.division || c.category || (Array.isArray(c.brand_names) && c.brand_names.length > 0)) && (
          <Section title={t("section.companyProfile")} icon={<BriefcaseIcon size={14} />}>
            {Array.isArray(c.brand_names) && c.brand_names.length > 0 && (
              <div className="mb-3">
                <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-1.5">{t("detail.brands")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {c.brand_names.map((b: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">{b}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.division && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.division")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.division}</p>
                </div>
              )}
              {c.category && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.category")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.category}</p>
                </div>
              )}
              {c.supplier_type && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.supplierType")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.supplier_type}</p>
                </div>
              )}
              {c.industry && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.industry")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.industry}</p>
                </div>
              )}
              {c.source && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.source")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.source}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Supplier: 5. Payment & Currency ── */}
        {c.contact_type === "supplier" && (c.payment_terms || c.currency || c.payment_info) && (
          <Section title={t("section.paymentCurrency")} icon={<DollarSignIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.payment_terms && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.paymentTerms")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.payment_terms}</p>
                </div>
              )}
              {c.currency && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.currency")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.currency}</p>
                </div>
              )}
            </div>
            {c.payment_info && (
              <div className="mt-3">
                <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-1">{t("field.paymentInfo")}</span>
                <p className="text-sm text-[var(--text-muted)] whitespace-pre-wrap"><AutoTranslatedText text={c.payment_info} /></p>
              </div>
            )}
          </Section>
        )}

        {/* ── Supplier: 6. Bank Accounts ── */}
        {c.contact_type === "supplier" && ((Array.isArray(c.bank_accounts) && c.bank_accounts.length > 0) || c.wechat_pay_qr || c.wechat_pay_id || c.alipay_qr || c.alipay_id) && (
          <Section title={t("section.paymentInfo", "Payment Information")} icon={<LandmarkIcon size={14} />}>
            <div className="space-y-3">
              {Array.isArray(c.bank_accounts) && c.bank_accounts.map((bank: { bank_name: string; account_name: string; account_number: string; swift_code: string; iban: string; branch: string; currency: string; info_image?: string }, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)]">
                  <div className="flex items-center gap-2 mb-2">
                    <LandmarkIcon size={14} className="text-blue-400" />
                    <span className="text-sm text-[var(--text-primary)] font-medium">{bank.bank_name || "Bank " + (i + 1)}</span>
                    {bank.currency && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-faint)] font-medium ms-auto">{bank.currency}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 ms-5">
                    {bank.account_name && (
                      <div>
                        <span className="text-[10px] text-[var(--text-dim)]">{t("field.accountName")}</span>
                        <p className="text-xs text-[var(--text-primary)]">{bank.account_name}</p>
                      </div>
                    )}
                    {bank.account_number && (
                      <div>
                        <span className="text-[10px] text-[var(--text-dim)]">{t("field.accountNumber")}</span>
                        <p className="text-xs text-[var(--text-primary)] font-mono">{bank.account_number}</p>
                      </div>
                    )}
                    {bank.swift_code && (
                      <div>
                        <span className="text-[10px] text-[var(--text-dim)]">SWIFT / BIC</span>
                        <p className="text-xs text-[var(--text-primary)] font-mono">{bank.swift_code}</p>
                      </div>
                    )}
                    {bank.iban && (
                      <div>
                        <span className="text-[10px] text-[var(--text-dim)]">IBAN</span>
                        <p className="text-xs text-[var(--text-primary)] font-mono">{bank.iban}</p>
                      </div>
                    )}
                    {bank.branch && (
                      <div>
                        <span className="text-[10px] text-[var(--text-dim)]">{t("field.branch")}</span>
                        <p className="text-xs text-[var(--text-primary)]">{bank.branch}</p>
                      </div>
                    )}
                  </div>
                  {bank.info_image && (
                    <a href={bank.info_image} target="_blank" rel="noopener noreferrer" className="mt-2 ms-5 block w-fit">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bank.info_image} alt={t("field.bankInfoPhoto", "Bank info photo")} className="max-h-40 w-auto max-w-full rounded-lg border border-[var(--border-color)] object-contain bg-white" />
                    </a>
                  )}
                </div>
              ))}
              {(c.wechat_pay_qr || c.wechat_pay_id || c.alipay_qr || c.alipay_id) && (
                <div className="grid grid-cols-2 gap-3">
                  {(c.wechat_pay_qr || c.wechat_pay_id) && (
                    <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)]">
                      <div className="flex items-center gap-2 mb-2">
                        <BrandGlyph name="WeChat" size={16} />
                        <span className="text-sm text-[var(--text-primary)] font-medium">WeChat Pay</span>
                      </div>
                      {c.wechat_pay_id && <p className="text-xs text-[var(--text-primary)] mb-2 break-all">{c.wechat_pay_id}</p>}
                      {c.wechat_pay_qr && (
                        <a href={c.wechat_pay_qr} target="_blank" rel="noopener noreferrer" className="block w-fit">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.wechat_pay_qr} alt="WeChat Pay QR" className="h-28 w-28 rounded-lg border border-[var(--border-color)] object-cover bg-white" />
                        </a>
                      )}
                    </div>
                  )}
                  {(c.alipay_qr || c.alipay_id) && (
                    <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)]">
                      <div className="flex items-center gap-2 mb-2">
                        <BrandGlyph name="Alipay" size={16} />
                        <span className="text-sm text-[var(--text-primary)] font-medium">Alipay</span>
                      </div>
                      {c.alipay_id && <p className="text-xs text-[var(--text-primary)] mb-2 break-all">{c.alipay_id}</p>}
                      {c.alipay_qr && (
                        <a href={c.alipay_qr} target="_blank" rel="noopener noreferrer" className="block w-fit">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.alipay_qr} alt="Alipay QR" className="h-28 w-28 rounded-lg border border-[var(--border-color)] object-cover bg-white" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Supplier: 7. Catalogue ── */}
        {c.contact_type === "supplier" && Array.isArray(c.catalogues) && c.catalogues.length > 0 && (
          <Section title={t("section.catalogue")} icon={<BookOpenIcon size={14} />}>
            <div className="space-y-2">
              {c.catalogues.map((cat: { name: string; url: string; type: string; uploaded_at: string }, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)]">
                  {cat.type === "PDF" ? <DocumentIcon size={16} className="text-red-400 shrink-0" /> : <ImageRawIcon size={16} className="text-blue-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">{cat.name}</p>
                    <p className="text-[10px] text-[var(--text-dim)]">{cat.type} {cat.uploaded_at ? " \u00B7 " + new Date(cat.uploaded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : ""}</p>
                  </div>
                  <button onClick={() => openFilePreview(cat.url)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[10px] text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors">
                    <EyeIcon size={10} /> Preview
                  </button>
                  <button onClick={() => downloadFile(cat.url, cat.name)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[10px] text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors">
                    <DownloadIcon size={10} /> Download
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Supplier: 8. Documents ── */}
        {c.contact_type === "supplier" && Array.isArray(c.documents) && c.documents.length > 0 && (
          <Section title={t("section.documents")} icon={<PaperclipIcon size={14} />}>
            <div className="space-y-2">
              {c.documents.map((doc: { doc_name: string; name: string; url: string; type: string; uploaded_at: string }, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)]">
                  <FileCheckIcon size={16} className="text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">{doc.doc_name || doc.name}</p>
                    <p className="text-[10px] text-[var(--text-dim)]">{doc.type} {doc.uploaded_at ? " · " + new Date(doc.uploaded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : ""}</p>
                  </div>
                  {doc.url && (
                    <>
                      <button onClick={() => openFilePreview(doc.url)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[10px] text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors">
                        <EyeIcon size={10} /> Preview
                      </button>
                      <button onClick={() => downloadFile(doc.url, doc.name)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[10px] text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors">
                        <DownloadIcon size={10} /> {t("btn.download")}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Supplier: 9. Quality & Performance ── */}
        {c.contact_type === "supplier" && (c.rating || c.reliability_score || c.sample_status || c.quality_notes || c.last_quality_issue || (Array.isArray(c.certifications) && c.certifications.length > 0)) && (
          <Section title={t("section.qualityPerformance")} icon={<ShieldCheckIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.rating > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.rating")}</span>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <StarIcon key={s} size={14} className={s <= (c.rating || 0) ? "text-amber-400 fill-amber-400" : "text-[var(--text-barely)]"} />
                    ))}
                  </div>
                </div>
              )}
              {c.reliability_score && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("detail.reliability")}</span>
                  <p className="text-sm text-[var(--text-primary)]">{c.reliability_score}%</p>
                </div>
              )}
              {c.sample_status && c.sample_status !== "None" && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.sampleStatus")}</span>
                  <p className={`text-sm font-medium ${c.sample_status === "Approved" ? "text-emerald-400" : c.sample_status === "Rejected" ? "text-red-400" : "text-[var(--text-primary)]"}`}>{c.sample_status}</p>
                </div>
              )}
              {c.last_quality_issue && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.lastQualityIssueDate")}</span>
                  <p className="text-sm text-red-400">{new Date(c.last_quality_issue).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              )}
            </div>
            {Array.isArray(c.certifications) && c.certifications.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-1.5">{t("field.certifications")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {c.certifications.map((cert: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">{cert}</span>
                  ))}
                </div>
              </div>
            )}
            {c.quality_notes && (
              <div className="mt-3">
                <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-1">{t("detail.qualityNotes")}</span>
                <p className="text-sm text-[var(--text-muted)] whitespace-pre-wrap"><AutoTranslatedText text={c.quality_notes} /></p>
              </div>
            )}
          </Section>
        )}

        {/* ── Supplier: 10. Products (placeholder) ── */}
        {c.contact_type === "supplier" && (
          <Section title={t("section.products")} icon={<PackageIcon size={14} />}>
            <div className="flex items-center gap-3 py-3">
              <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
                <PackageIcon size={18} className="text-[var(--text-ghost)]" />
              </div>
              <p className="text-sm text-[var(--text-dim)]">{t("detail.productsPlaceholder")}</p>
            </div>
          </Section>
        )}

        {/* ══ EMPLOYEE DETAIL SECTIONS ══ */}
        {c.contact_type === "employee" && (
        <>
          {/* Work Contact */}
          {(c.work_email || c.work_tel || c.work_mobile) && (
            <Section title={t("section.workContact")} icon={<PhoneIcon size={14} />}>
              {c.work_email && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("detail.email")}</span><p className="text-sm text-[var(--text-primary)]">{c.work_email}</p></div>}
              {c.work_tel && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("detail.tel")}</span><p className="text-sm text-[var(--text-primary)]">{c.work_tel}</p></div>}
              {c.work_mobile && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("detail.mobile")}</span><p className="text-sm text-[var(--text-primary)]">{c.work_mobile}</p></div>}
            </Section>
          )}
          {/* Work */}
          {(c.department || c.job_position || c.job_title || c.management || c.manager) && (
            <Section title={t("section.work")} icon={<BriefcaseIcon size={14} />}>
              {c.management && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.managementLevel")}</span><p className="text-sm text-[var(--text-primary)]">{c.management}</p></div>}
              {c.department && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.department")}</span><p className="text-sm text-[var(--text-primary)]">{c.department}</p></div>}
              {c.job_position && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.position")}</span><p className="text-sm text-[var(--text-primary)]">{c.job_position}</p></div>}
              {c.job_title && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.title")}</span><p className="text-sm text-[var(--text-primary)]">{c.job_title}</p></div>}
              {c.manager && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.directManager")}</span><p className="text-sm text-[var(--text-primary)]">{c.manager}</p></div>}
            </Section>
          )}
          {/* Work Location */}
          {(c.work_address || c.work_location) && (
            <Section title={t("section.workLocation")} icon={<MapPinIcon size={14} />}>
              {c.work_address && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("detail.address")}</span><p className="text-sm text-[var(--text-primary)]">{c.work_address}</p></div>}
              {c.work_location && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.workLocationLabel")}</span><p className="text-sm text-[var(--text-primary)]">{c.work_location}</p></div>}
            </Section>
          )}
          {/* Resume */}
          {Array.isArray(c.resume_lines) && c.resume_lines.length > 0 && (
            <Section title={t("section.resume")} icon={<DocumentIcon size={14} />}>
              {c.resume_lines.map((rl: any, i: number) => (
                <div key={i} className="py-2 border-b border-[var(--border-color)] last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                      rl.type === "experience" ? "bg-blue-500/10 text-blue-400" :
                      rl.type === "education" ? "bg-green-500/10 text-green-400" :
                      rl.type === "training" ? "bg-amber-500/10 text-amber-400" :
                      "bg-violet-500/10 text-violet-400"
                    }`}>{t("resumeType." + rl.type, rl.type)}</span>
                    <span className="text-sm text-[var(--text-primary)] font-medium">{rl.title}</span>
                  </div>
                  {(rl.duration_start || rl.duration_end || rl.is_forever) && (
                    <p className="text-xs text-[var(--text-faint)]">{rl.duration_start || ""} {"\u2192"} {rl.is_forever ? "Present" : rl.duration_end || ""}</p>
                  )}
                  {rl.course_type && <p className="text-xs text-[var(--text-dim)] mt-0.5">{t("detail.type")}: {rl.course_type}</p>}
                  {rl.notes && <p className="text-xs text-[var(--text-subtle)] mt-1">{rl.notes}</p>}
                </div>
              ))}
            </Section>
          )}
          {/* Personal Info */}
          {(c.legal_name || c.birthday || c.place_of_birth || c.gender) && (
            <Section title={t("section.personalInfo")} icon={<UserIcon size={14} />}>
              {c.legal_name && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.legalName")}</span><p className="text-sm text-[var(--text-primary)]">{c.legal_name}</p></div>}
              {c.birthday && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("detail.birthday")}</span><p className="text-sm text-[var(--text-primary)]">{new Date(c.birthday).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p></div>}
              {c.place_of_birth && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.placeOfBirth")}</span><p className="text-sm text-[var(--text-primary)]">{c.place_of_birth}</p></div>}
              {c.gender && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.gender")}</span><p className="text-sm text-[var(--text-primary)] capitalize">{tOpt(c.gender)}</p></div>}
            </Section>
          )}
          {/* Emergency Contact */}
          {Array.isArray(c.emergency_contacts) && c.emergency_contacts.length > 0 && (
            <Section title={t("section.emergencyContact")} icon={<ShieldExclamationIcon size={14} />}>
              {c.emergency_contacts.map((ec: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--border-color)] last:border-0">
                  <span className="text-sm text-[var(--text-primary)]">{ec.contact}</span>
                  <span className="text-sm text-[var(--text-subtle)]">{ec.phone}</span>
                </div>
              ))}
            </Section>
          )}
          {/* Visa & Work Permit */}
          {(c.visa_no || c.work_permit) && (
            <Section title={t("section.visaWorkPermit")} icon={<PlaneIcon size={14} />}>
              {c.visa_no && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.visaNo")}</span><p className="text-sm text-[var(--text-primary)]">{c.visa_no}</p></div>}
              {c.work_permit && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.workPermit")}</span><p className="text-sm text-[var(--text-primary)]">{c.work_permit}</p></div>}
            </Section>
          )}
          {/* Citizenship */}
          {(c.nationality || c.id_no || c.ssn_no || c.passport_no) && (
            <Section title={t("section.citizenship")} icon={<GlobeIcon size={14} />}>
              {c.nationality && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.nationality")}</span><p className="text-sm text-[var(--text-primary)]">{c.nationality}</p></div>}
              {c.id_no && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("detail.idNo")}</span><p className="text-sm text-[var(--text-primary)]">{c.id_no}</p></div>}
              {c.ssn_no && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("detail.ssnNo")}</span><p className="text-sm text-[var(--text-primary)]">{c.ssn_no}</p></div>}
              {c.passport_no && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.passportNo")}</span><p className="text-sm text-[var(--text-primary)]">{c.passport_no}</p></div>}
            </Section>
          )}
          {/* Private Location */}
          {(c.private_address || c.home_work_distance) && (
            <Section title={t("section.privateLocation")} icon={<HomeIcon size={14} />}>
              {c.private_address && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("detail.address")}</span><p className="text-sm text-[var(--text-primary)]">{c.private_address}</p></div>}
              {c.home_work_distance && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("detail.distance")}</span><p className="text-sm text-[var(--text-primary)]">{c.home_work_distance} KM</p></div>}
            </Section>
          )}
          {/* Family */}
          {(c.marital_status || c.number_of_children) && (
            <Section title={t("section.family")} icon={<HeartIcon size={14} />}>
              {c.marital_status && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.maritalStatus")}</span><p className="text-sm text-[var(--text-primary)] capitalize">{tOpt(c.marital_status)}</p></div>}
              {c.number_of_children && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("detail.children")}</span><p className="text-sm text-[var(--text-primary)]">{c.number_of_children}</p></div>}
            </Section>
          )}
          {/* Education */}
          {(c.certificate_level || c.field_of_study) && (
            <Section title={t("section.education")} icon={<GraduationCapIcon size={14} />}>
              {c.certificate_level && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.certificateLevel")}</span><p className="text-sm text-[var(--text-primary)] capitalize">{tOpt(c.certificate_level)}</p></div>}
              {c.field_of_study && <div className="py-1"><span className="text-xs text-[var(--text-faint)]">{t("field.fieldOfStudy")}</span><p className="text-sm text-[var(--text-primary)]">{c.field_of_study}</p></div>}
            </Section>
          )}
        </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
             PREMIUM CUSTOMER DETAIL SECTIONS
             ═══════════════════════════════════════════════════════════════════ */}

        {/* ── Pipeline (CRM deals for this customer — Commercial tab) ── */}
        {isCustomerDetail && detailTab("commercial") && (
          <CustomerPipelineBlock contactId={c.id} translate={(k, f) => t(k, f)} />
        )}

        {/* ── Commercial Profile (Commercial tab) ── */}
        {isCustomerDetail && detailTab("commercial") && (c.market_band || c.commercial_role || c.territory || c.assigned_branch || c.exclusivity || c.sales_rep || c.backup_account_manager || c.source_details || c.referred_by || c.customer_level_review_date) && (
          <Section title={t("section.commercialProfile", "Commercial Profile")} icon={<BriefcaseIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.market_band && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.marketBand", "Market Band")}</span><p className="text-sm text-[var(--text-primary)]">{c.market_band}</p></div>}
              {c.commercial_role && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.commercialRole", "Commercial Role")}</span><p className="text-sm text-[var(--text-primary)]">{c.commercial_role}</p></div>}
              {c.territory && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.territory", "Territory")}</span><p className="text-sm text-[var(--text-primary)]">{c.territory}</p></div>}
              {c.assigned_branch && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.assignedBranch", "Assigned Branch")}</span><p className="text-sm text-[var(--text-primary)]">{c.assigned_branch}</p></div>}
              {c.exclusivity && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.exclusivity", "Exclusivity")}</span><p className="text-sm text-[var(--text-primary)]">{c.exclusivity}{c.exclusivity_scope ? ` · ${c.exclusivity_scope}` : ""}</p></div>}
              {c.exclusivity_expiry && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.exclusivityExpiry", "Exclusivity Expiry")}</span><p className="text-sm text-[var(--text-primary)]">{new Date(c.exclusivity_expiry).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p></div>}
              {c.sales_rep && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.salesRep", "Sales Rep")}</span><p className="text-sm text-[var(--text-primary)]">{c.sales_rep}</p></div>}
              {c.backup_account_manager && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.backupAM", "Backup AM")}</span><p className="text-sm text-[var(--text-primary)]">{c.backup_account_manager}</p></div>}
              {c.source_details && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.sourceDetails", "Source Details")}</span><p className="text-sm text-[var(--text-primary)]">{c.source_details}</p></div>}
              {c.referred_by && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.referredBy", "Referred By")}</span><p className="text-sm text-[var(--text-primary)]">{c.referred_by}</p></div>}
              {c.customer_level_review_date && <div className="col-span-2"><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.levelReviewDate", "Level Review Due")}</span><p className={`text-sm font-medium ${new Date(c.customer_level_review_date) < new Date() ? "text-red-400" : "text-[var(--text-primary)]"}`}>{new Date(c.customer_level_review_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p></div>}
            </div>
          </Section>
        )}

        {/* ── Pricing & Discounts (Commercial tab) ── */}
        {isCustomerDetail && detailTab("commercial") && (c.price_list_tier || c.max_discount_allowed || c.commission_rate || c.special_pricing_agreement || c.contract_pricing_expiry) && (
          <Section title={t("section.pricingDiscounts", "Pricing & Discounts")} icon={<HandCoinsIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.price_list_tier && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.priceListTier", "Price List")}</span><p className="text-sm text-[var(--text-primary)]">{c.price_list_tier}</p></div>}
              {c.max_discount_allowed && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.maxDiscount", "Max Discount")}</span><p className="text-sm text-[var(--text-primary)]">{c.max_discount_allowed}%</p></div>}
              {c.commission_rate && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.commissionRate", "Commission Rate")}</span><p className="text-sm text-[var(--text-primary)]">{c.commission_rate}%</p></div>}
              {c.contract_pricing_expiry && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.contractPricingExpiry", "Contract Expires")}</span><p className="text-sm text-[var(--text-primary)]">{new Date(c.contract_pricing_expiry).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p></div>}
              {c.special_pricing_agreement && (
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-medium border border-blue-500/20">
                    <FileCheckIcon size={10} /> {t("field.specialPricingAgreement", "Special Pricing Agreement")}
                  </span>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Segmentation & Health (Commercial tab) ── */}
        {isCustomerDetail && detailTab("commercial") && (c.sub_industry || c.buying_behavior || c.price_sensitivity || c.quality_sensitivity || c.relationship_stage || c.churn_risk || c.support_tier || c.customer_health_score || c.nps_score) && (
          <Section title={t("section.segmentationHealth", "Segmentation & Health")} icon={<StarIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.sub_industry && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.subIndustry", "Sub Industry")}</span><p className="text-sm text-[var(--text-primary)]">{c.sub_industry}</p></div>}
              {c.buying_behavior && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.buyingBehavior", "Buying Behavior")}</span><p className="text-sm text-[var(--text-primary)]">{c.buying_behavior}</p></div>}
              {c.price_sensitivity && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.priceSensitivity", "Price Sensitivity")}</span><p className="text-sm text-[var(--text-primary)]">{c.price_sensitivity}</p></div>}
              {c.quality_sensitivity && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.qualitySensitivity", "Quality Sensitivity")}</span><p className="text-sm text-[var(--text-primary)]">{c.quality_sensitivity}</p></div>}
              {c.relationship_stage && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.relationshipStage", "Relationship Stage")}</span><p className="text-sm text-[var(--text-primary)]">{c.relationship_stage}</p></div>}
              {c.churn_risk && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.churnRisk", "Churn Risk")}</span><p className={`text-sm font-medium ${c.churn_risk === "High" ? "text-red-400" : c.churn_risk === "Medium" ? "text-amber-400" : "text-emerald-400"}`}>{c.churn_risk}</p></div>}
              {c.support_tier && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.supportTier", "Support Tier")}</span><p className="text-sm text-[var(--text-primary)]">{c.support_tier}</p></div>}
              {c.customer_health_score && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.healthScore", "Health Score")}</span><p className="text-sm text-[var(--text-primary)]">{c.customer_health_score}/100</p></div>}
              {c.nps_score && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.npsScore", "NPS Score")}</span><p className="text-sm text-[var(--text-primary)]">{c.nps_score}</p></div>}
            </div>
          </Section>
        )}

        {/* ── Credit Management (Financial tab) ── */}
        {isCustomerDetail && detailTab("financial") && (c.credit_rating_internal || c.credit_rating_external || c.credit_limit_approved_by || c.overdue_balance || c.days_sales_outstanding || c.preferred_payment_method) && (
          <Section title={t("section.creditManagement", "Credit Management")} icon={<WalletIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.credit_rating_internal && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.creditRatingInternal", "Internal Rating")}</span><p className="text-sm text-[var(--text-primary)]">{c.credit_rating_internal}</p></div>}
              {c.credit_rating_external && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.creditRatingExternal", "External Rating")}</span><p className="text-sm text-[var(--text-primary)]">{c.credit_rating_external}</p></div>}
              {c.credit_limit_approved_by && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.creditApprovedBy", "Limit Approved By")}</span><p className="text-sm text-[var(--text-primary)]">{c.credit_limit_approved_by}</p></div>}
              {c.credit_limit_approved_date && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.creditApprovedDate", "Approved Date")}</span><p className="text-sm text-[var(--text-primary)]">{new Date(c.credit_limit_approved_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p></div>}
              {c.overdue_balance && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.overdueBalance", "Overdue Balance")}</span><p className="text-sm text-amber-400 font-semibold">{c.currency || "USD"} {Number(c.overdue_balance).toLocaleString()}</p></div>}
              {c.days_sales_outstanding && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.dso", "DSO")}</span><p className="text-sm text-[var(--text-primary)]">{c.days_sales_outstanding} {t("unit.days", "days")}</p></div>}
              {c.preferred_payment_method && <div className="col-span-2"><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.preferredPaymentMethod", "Preferred Payment")}</span><p className="text-sm text-[var(--text-primary)]">{c.preferred_payment_method}</p></div>}
            </div>
          </Section>
        )}

        {/* ── Credit Insurance (Financial tab) ── */}
        {isCustomerDetail && detailTab("financial") && c.credit_insurance_covered && (
          <Section title={t("section.creditInsurance", "Credit Insurance")} icon={<ShieldCheckIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div className="col-span-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                  <ShieldCheckIcon size={10} /> {t("field.insuredReceivables", "Receivables Insured")}
                </span>
              </div>
              {c.credit_insurance_provider && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.insuranceProvider", "Provider")}</span><p className="text-sm text-[var(--text-primary)]">{c.credit_insurance_provider}</p></div>}
              {c.credit_insurance_coverage && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.insuranceCoverage", "Coverage")}</span><p className="text-sm text-[var(--text-primary)]">{c.currency || "USD"} {Number(c.credit_insurance_coverage).toLocaleString()}</p></div>}
            </div>
          </Section>
        )}

        {/* ── Bank Accounts (Financial tab) ── */}
        {isCustomerDetail && detailTab("financial") && Array.isArray(c.bank_accounts) && c.bank_accounts.length > 0 && (
          <Section title={t("section.bankAccountInfo")} icon={<LandmarkIcon size={14} />}>
            <div className="space-y-2">
              {c.bank_accounts.map((b: { bank_name: string; account_name: string; account_number: string; swift_code: string; iban: string; branch: string; currency: string }, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm text-[var(--text-primary)] font-medium">{b.bank_name}</p>
                    {b.currency && <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase">{b.currency}</span>}
                  </div>
                  {b.account_name && <p className="text-xs text-[var(--text-faint)]">{b.account_name}</p>}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1.5 text-xs">
                    {b.account_number && <div><span className="text-[var(--text-dim)]">A/C: </span><span className="text-[var(--text-primary)] font-mono">{b.account_number}</span></div>}
                    {b.swift_code && <div><span className="text-[var(--text-dim)]">SWIFT: </span><span className="text-[var(--text-primary)] font-mono">{b.swift_code}</span></div>}
                    {b.iban && <div className="col-span-2"><span className="text-[var(--text-dim)]">IBAN: </span><span className="text-[var(--text-primary)] font-mono">{b.iban}</span></div>}
                    {b.branch && <div className="col-span-2"><span className="text-[var(--text-dim)]">{t("field.branch", "Branch")}: </span><span className="text-[var(--text-primary)]">{b.branch}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Legal Identity (Compliance tab) ── */}
        {isCustomerDetail && detailTab("compliance") && (c.trading_name || c.company_type || c.business_registration_number || c.registration_country || c.year_established || c.employee_count_range || c.annual_revenue_range || c.business_license_image) && (
          <Section title={t("section.legalIdentity", "Legal Identity")} icon={<Building2Icon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.trading_name && <div className="col-span-2"><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.tradingName", "Trading Name")}</span><p className="text-sm text-[var(--text-primary)]">{c.trading_name}</p></div>}
              {c.company_type && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.companyType", "Company Type")}</span><p className="text-sm text-[var(--text-primary)]">{c.company_type}</p></div>}
              {c.business_registration_number && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.businessRegNumber", "Business Reg #")}</span><p className="text-sm text-[var(--text-primary)] font-mono">{c.business_registration_number}</p></div>}
              {c.registration_country && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.registrationCountry", "Reg. Country")}</span><p className="text-sm text-[var(--text-primary)]">{c.registration_country}</p></div>}
              {c.registration_date && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.registrationDate", "Reg. Date")}</span><p className="text-sm text-[var(--text-primary)]">{new Date(c.registration_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p></div>}
              {c.year_established && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.yearEstablished", "Established")}</span><p className="text-sm text-[var(--text-primary)]">{c.year_established}</p></div>}
              {c.employee_count_range && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.employeeCountRange", "Employees")}</span><p className="text-sm text-[var(--text-primary)]">{c.employee_count_range}</p></div>}
              {c.annual_revenue_range && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.annualRevenueRange", "Annual Revenue")}</span><p className="text-sm text-[var(--text-primary)]">{c.annual_revenue_range}</p></div>}
              {c.business_license_image && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.businessLicense", "Business License")}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <a href={c.business_license_image} target="_blank" rel="noopener noreferrer" className="mt-1 block w-full">
                    <img src={c.business_license_image} alt={t("field.businessLicense", "Business License")} className="h-48 w-full rounded-lg border border-[var(--border-color)] object-contain bg-white" />
                  </a>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── International Trade IDs (Compliance tab) ── */}
        {isCustomerDetail && detailTab("compliance") && (c.eori_number || c.duns_number || c.importer_exporter_code || c.customs_code || c.gst_number || c.cr_number) && (
          <Section title={t("section.tradeIdentifiers", "International Trade IDs")} icon={<FileCheckIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.eori_number && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">EORI</span><p className="text-sm text-[var(--text-primary)] font-mono">{c.eori_number}</p></div>}
              {c.duns_number && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">D-U-N-S</span><p className="text-sm text-[var(--text-primary)] font-mono">{c.duns_number}</p></div>}
              {c.importer_exporter_code && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">IEC</span><p className="text-sm text-[var(--text-primary)] font-mono">{c.importer_exporter_code}</p></div>}
              {c.customs_code && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.customsCode", "Customs Code")}</span><p className="text-sm text-[var(--text-primary)] font-mono">{c.customs_code}</p></div>}
              {c.gst_number && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">GST/VAT</span><p className="text-sm text-[var(--text-primary)] font-mono">{c.gst_number}</p></div>}
              {c.cr_number && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">CR</span><p className="text-sm text-[var(--text-primary)] font-mono">{c.cr_number}</p></div>}
            </div>
          </Section>
        )}

        {/* ── KYC & Risk (Compliance tab) ── */}
        {isCustomerDetail && detailTab("compliance") && (c.kyc_status || c.risk_score || c.kyc_verified_date || c.kyc_review_due_date || c.sanctions_check_status || c.aml_status) && (
          <Section title={t("section.kycRisk", "KYC & Risk")} icon={<ShieldCheckIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.kyc_status && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.kycStatus", "KYC Status")}</span><p className={`text-sm font-medium ${c.kyc_status === "Verified" ? "text-emerald-400" : c.kyc_status === "Flagged" ? "text-red-400" : c.kyc_status === "Expired" ? "text-amber-400" : "text-[var(--text-primary)]"}`}>{c.kyc_status}</p></div>}
              {c.risk_score && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.riskScore", "Risk Score")}</span><p className="text-sm text-[var(--text-primary)]">{c.risk_score}/100</p></div>}
              {c.kyc_verified_date && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.kycVerifiedDate", "Verified On")}</span><p className="text-sm text-[var(--text-primary)]">{new Date(c.kyc_verified_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p></div>}
              {c.kyc_verified_by && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.kycVerifiedBy", "Verified By")}</span><p className="text-sm text-[var(--text-primary)]">{c.kyc_verified_by}</p></div>}
              {c.kyc_review_due_date && <div className="col-span-2"><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.kycReviewDueDate", "Next Review")}</span><p className={`text-sm font-medium ${new Date(c.kyc_review_due_date) < new Date() ? "text-red-400" : "text-[var(--text-primary)]"}`}>{new Date(c.kyc_review_due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p></div>}
              {c.sanctions_check_status && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.sanctionsCheckStatus", "Sanctions")}</span><p className={`text-sm font-medium ${c.sanctions_check_status === "Clear" ? "text-emerald-400" : c.sanctions_check_status === "Flagged" ? "text-red-400" : "text-amber-400"}`}>{c.sanctions_check_status}</p></div>}
              {c.sanctions_check_date && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.sanctionsCheckDate", "Last Check")}</span><p className="text-sm text-[var(--text-primary)]">{new Date(c.sanctions_check_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p></div>}
              {c.aml_status && <div className="col-span-2"><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.amlStatus", "AML Status")}</span><p className="text-sm text-[var(--text-primary)]">{c.aml_status}</p></div>}
            </div>
          </Section>
        )}

        {/* ── Logistics & Trade Ops (Trade tab) ── */}
        {isCustomerDetail && detailTab("trade") && (c.port_of_entry || c.customs_broker || c.freight_forwarder || c.shipping_marks || c.container_preference || c.labeling_requirements) && (
          <Section title={t("section.logisticsTrade", "Logistics & Trade Operations")} icon={<TruckIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.port_of_entry && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.portOfEntry", "Port of Entry")}</span><p className="text-sm text-[var(--text-primary)]">{c.port_of_entry}</p></div>}
              {c.container_preference && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.containerPreference", "Container")}</span><p className="text-sm text-[var(--text-primary)]">{c.container_preference}</p></div>}
              {c.customs_broker && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.customsBroker", "Customs Broker")}</span><p className="text-sm text-[var(--text-primary)]">{c.customs_broker}</p></div>}
              {c.freight_forwarder && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.freightForwarder", "Freight Forwarder")}</span><p className="text-sm text-[var(--text-primary)]">{c.freight_forwarder}</p></div>}
              {c.shipping_marks && <div className="col-span-2"><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.shippingMarks", "Shipping Marks")}</span><p className="text-sm text-[var(--text-primary)]">{c.shipping_marks}</p></div>}
              {c.labeling_requirements && <div className="col-span-2"><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("field.labelingRequirements", "Labeling")}</span><p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{c.labeling_requirements}</p></div>}
            </div>
          </Section>
        )}

        {/* ── Classification & Carriers (Trade tab) ── */}
        {isCustomerDetail && detailTab("trade") && ((Array.isArray(c.hs_codes) && c.hs_codes.length > 0) || (Array.isArray(c.preferred_carriers) && c.preferred_carriers.length > 0) || (Array.isArray(c.certifications_required) && c.certifications_required.length > 0)) && (
          <Section title={t("section.tradeCodes", "Classification & Carriers")} icon={<ClipboardCheckIcon size={14} />}>
            <div className="space-y-3">
              {Array.isArray(c.hs_codes) && c.hs_codes.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-1.5">{t("field.hsCodes", "HS Codes")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {c.hs_codes.map((code: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] font-mono">{code}</span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(c.preferred_carriers) && c.preferred_carriers.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-1.5">{t("field.preferredCarriers", "Preferred Carriers")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {c.preferred_carriers.map((car: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">{car}</span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(c.certifications_required) && c.certifications_required.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-1.5">{t("field.certificationsRequired", "Certifications Required")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {c.certifications_required.map((cert: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">{cert}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Messaging IDs (Activity tab) ── */}
        {isCustomerDetail && detailTab("activity") && (c.whatsapp_business || c.wechat_id || c.telegram_id || c.line_id || c.skype_id) && (
          <Section title={t("section.messagingIds", "Messaging IDs")} icon={<MessageSquareIcon size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.whatsapp_business && <div className="col-span-2"><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">WhatsApp Business</span><p className="text-sm text-[var(--text-primary)]">{c.whatsapp_business}</p></div>}
              {c.wechat_id && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">WeChat</span><p className="text-sm text-[var(--text-primary)]">{c.wechat_id}</p></div>}
              {c.telegram_id && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Telegram</span><p className="text-sm text-[var(--text-primary)]">{c.telegram_id}</p></div>}
              {c.line_id && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Line</span><p className="text-sm text-[var(--text-primary)]">{c.line_id}</p></div>}
              {c.skype_id && <div><span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Skype</span><p className="text-sm text-[var(--text-primary)]">{c.skype_id}</p></div>}
            </div>
          </Section>
        )}

        {/* ── Internal Notes (Activity tab) ── */}
        {isCustomerDetail && detailTab("activity") && c.internal_notes && (
          <Section title={t("section.internalNotes", "Internal Notes")} icon={<DocumentIcon size={14} />}>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{c.internal_notes}</p>
          </Section>
        )}

        {/* Custom Fields (Activity tab for customers) */}
        {(c.contact_type !== "customer" || detailTab("activity")) && customs.length > 0 && (
          <Section title={t("section.customFields")} icon={<DocumentIcon size={14} />}>
            {customs.map((cf, i) => (
              <div key={i} className="py-1.5">
                <span className="text-xs text-blue-400 font-medium">{cf.field_name}</span>
                <p className="text-sm text-[var(--text-primary)]">{cf.field_value}</p>
              </div>
            ))}
          </Section>
        )}

        {/* Notes (Activity tab for customers) */}
        {(c.contact_type !== "customer" || detailTab("activity")) && c.notes && (
          <Section title={t("section.notes")} icon={<DocumentIcon size={14} />}>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{c.notes}</p>
          </Section>
        )}

        {/* Planning + Project-tasks + Invoices strips — linked records that
            reference this contact. Rendered at the BOTTOM of the detail (was at
            the top) so the record's own profile reads first. Shown on every
            contact type / tab, unchanged from before — only its position moved. */}
        <div className="px-4 md:px-6 py-3 space-y-3">
          <EntityPlanningStrip
            entityType={
              c.contact_type === "customer"
                ? "customer"
                : c.contact_type === "supplier"
                  ? "supplier"
                  : "contact"
            }
            entityId={c.id}
          />
          <EntityTasksStrip
            entityType={
              c.contact_type === "customer"
                ? "customer"
                : c.contact_type === "supplier"
                  ? "supplier"
                  : "contact"
            }
            entityId={c.id}
          />
          {c.contact_type === "customer" && <EntityInvoicesStrip customerId={c.id} />}
        </div>

        {/* Delete confirmation is rendered once at the top level (see main
            return) so it works from every entry point, including supplier
            rows where this legacy detail panel is replaced by Supplier 360. */}
      </div>
    );
  };

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER: FORM PANEL
     ═════════════════════════════════════════════════════════════════════════ */

  const renderFormPanel = () => {
    const isCustomer = form.contact_type === "customer";
    const isSupplier = form.contact_type === "supplier";
    const isCompanyCustomer = form.contact_type === "customer" && form.entity_type === "company";
    const isPersonCustomer = form.contact_type === "customer" && form.entity_type === "person";
    const isCompanyType = form.contact_type === "company";

    /* ── Profile completeness ──
       Two-track accounting: scalar fields count 1 / 1. Array fields
       (phones, emails, addresses, websites, contact_persons,
       brand_names, certifications, tags) count one slot per ENTRY so
       the total grows as the operator adds more phones / emails /
       addresses, exactly matching the operator's mental model
       ("once I add another phone, that's another field to fill"). An
       array always contributes at least 1 expected slot so an empty
       phones array still reads as "0 / 1 phone" — the primary slot
       is always expected. */
    const completenessIsFilledScalar = (v: unknown): boolean => {
      if (v == null) return false;
      if (typeof v === "string") return v.trim().length > 0;
      if (typeof v === "number") return !Number.isNaN(v) && v > 0;
      if (typeof v === "boolean") return v;
      return Boolean(v);
    };
    /* Count meaningful entries inside an array of strings or objects.
       String entry: non-empty after trim. Object entry: at least one
       non-empty/non-default value across its own keys. */
    const countArrayFilled = (arr: unknown[]): number => {
      let n = 0;
      for (const item of arr) {
        if (item == null) continue;
        if (typeof item === "string") {
          if (item.trim().length > 0) n += 1;
        } else if (typeof item === "object") {
          const vals = Object.values(item as Record<string, unknown>);
          if (vals.some((v) => completenessIsFilledScalar(v))) n += 1;
        } else if (completenessIsFilledScalar(item)) {
          n += 1;
        }
      }
      return n;
    };
    /* Field lists per contact type. Array-shaped fields are flagged
       so we know to size their slot by length. */
    const ARRAY_FIELDS = new Set<keyof ContactForm>([
      "phones", "emails", "addresses", "websites",
      "contact_persons", "brand_names", "certifications", "tags",
    ]);
    const customerFields: (keyof ContactForm)[] = [
      "photo_url", "first_name", "last_name", "company", "position",
      "country", "city", "birthday", "phones", "emails", "addresses",
      "websites", "customer_type", "industry", "source", "tags",
      "payment_terms", "currency", "credit_limit", "tax_id",
      "incoterms", "language", "communication_preference",
      "account_manager", "notes",
    ];
    const genericFields: (keyof ContactForm)[] = [
      "photo_url", "first_name", "last_name", "company", "position",
      "country", "city", "birthday", "phones", "emails", "addresses",
      "websites", "notes",
    ];
    let filledCount = 0;
    let totalCount = 0;
    /* Supplier completeness is tiered: Required (gates "Ready"), Preferred
       (recommended), Optional (counted, never penalised). "Any-of" groups
       count as ONE slot — having WeChat is enough; a missing DingTalk never
       reads as incomplete. */
    let supplierTiers: { required: { filled: number; total: number }; preferred: { filled: number; total: number }; optional: { filled: number; total: number }; overall: { filled: number; total: number } } | undefined;

    if (isSupplier) {
      const filled = completenessIsFilledScalar;
      const groupHasValue = (o: Record<string, unknown>) =>
        Object.values(o).some((v) => v === true || (typeof v === "string" && v.trim().length > 0) || (typeof v === "number" && v > 0));
      let rF = 0, rT = 0, pF = 0, pT = 0, oF = 0, oT = 0;
      const req = (ok: boolean) => { rT += 1; if (ok) rF += 1; };
      const pref = (ok: boolean) => { pT += 1; if (ok) pF += 1; };
      const opt = (ok: boolean) => { oT += 1; if (ok) oF += 1; };

      // ── Required ──
      req(filled(form.company_name_en));
      req(filled(form.country));
      req(filled(form.division));
      req(filled(form.category));
      req([form.supplier_tel, form.supplier_mobile, form.supplier_email].some((v) => filled(v)));            // a contact
      req(filled(form.wechat_id) || form.messaging_channels.some((m) => filled(m.value))); // a messaging channel (WeChat or any added app)
      req(form.contact_persons.some((p) => (p.name || "").trim().length > 0));                                 // a contact person

      // ── Preferred ──
      pref(filled(form.supplier_address));
      pref(filled(form.payment_terms));
      pref(filled(form.currency));
      pref(filled(form.incoterms));
      pref(filled(form.business_registration_number));
      pref(filled(form.year_established));
      pref(filled(form.lead_time));
      pref(filled(form.moq));
      pref(filled(form.business_license_image));
      pref(form.certifications.length > 0);
      pref(sIntel.classifications.length > 0);
      pref(!!sIntel.strategic_status);

      // ── Optional (tracked as a real total, but never gates "Ready") ──
      /* Only fields that actually have an input in the SUPPLIER add form are
         counted — phantom fields (customer-only customs_broker/freight_forwarder)
         are excluded so the bar can reach a true 100%. Booleans are intentionally
         not counted (a "no" toggle isn't "missing"). */
      const optScalars: (keyof ContactForm)[] = [
        "photo_url", "company_name_cn", "supplier_website", "supplier_type", "industry", "source", "trading_name",
        "employee_count_range",
        "gst_number", "cr_number", "duns_number", "importer_exporter_code", "customs_code",
        "port_of_entry", "container_preference", "wechat_official_account", "factory_visit_date",
        "sample_status", "rating", "payment_info", "notes",
      ];
      for (const k of optScalars) opt(filled(form[k]));
      opt(form.brand_names.length > 0);
      opt(form.social_profiles.length > 0);
      opt(Array.isArray(form.bank_accounts) && form.bank_accounts.length > 0);
      opt(filled(form.wechat_pay_qr) || filled(form.wechat_pay_id) || filled(form.alipay_qr) || filled(form.alipay_id));
      opt(groupHasValue(sIntel.factory));
      opt(groupHasValue(sIntel.risk));
      opt(groupHasValue(sIntel.neg));
      opt(sIntel.riskItems.length > 0);
      opt(groupHasValue(sIntel.sourcing));

      supplierTiers = {
        required: { filled: rF, total: rT },
        preferred: { filled: pF, total: pT },
        optional: { filled: oF, total: oT },
        overall: { filled: rF + pF + oF, total: rT + pT + oT },
      };
      // Keep the legacy overall numbers in sync (fallback).
      filledCount = rF + pF + oF;
      totalCount = rT + pT + oT;
    } else {
      const completenessFields = isCustomer ? customerFields : genericFields;
      for (const key of completenessFields) {
        const v = form[key];
        if (ARRAY_FIELDS.has(key) && Array.isArray(v)) {
          const len = v.length;
          totalCount += Math.max(1, len);
          filledCount += countArrayFilled(v);
        } else {
          totalCount += 1;
          if (completenessIsFilledScalar(v)) filledCount += 1;
        }
      }
    }

    /* Customer premium tabs — for non-customers, every tab check returns true so existing behaviour is preserved.
       For customers, only sections on the active tab are rendered. */
    const showTab = (tab: CustomerTab) => !isCustomer || !form.entity_type || customerTab === tab;

    /* Determine if province dropdown should show — only for countries that commonly use states/provinces */
    const hasStates = !!form.country_code && COUNTRIES_WITH_STATES.has(form.country_code) && State.getStatesOfCountry(form.country_code).length > 0;

    /* City always shows once country is selected; province is optional */
    const showCity = !!form.country_code;

    return (
      <div className="h-full overflow-y-auto overflow-x-hidden">
        {/* Form header */}
        <div className="px-3 md:px-6 py-3 md:py-4 border-b border-[var(--border-color)] flex items-center justify-between sticky top-0 bg-[var(--bg-secondary)] z-10 gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button onClick={handleBack} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
              <ArrowLeftIcon size={18} className="rtl:rotate-180" />
            </button>
            <h2 className="text-base md:text-lg font-semibold text-[var(--text-primary)] truncate">
              {filterType
                ? `${editingId ? t("btn.edit", "Edit") : t("btn.new", "New")} ${t("type." + filterType, filterType.charAt(0).toUpperCase() + filterType.slice(1))}`
                : editingId ? t("editContact") : t("newContact")}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <button onClick={handleCancel} className="px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors">
              {t("btn.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || formHydrating || (!form.first_name && !form.last_name && !form.company && !form.company_name_en)}
              className="flex items-center gap-1 md:gap-1.5 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm bg-[var(--bg-inverted)] text-[var(--text-inverted)] font-medium hover:bg-[var(--bg-inverted-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-[var(--border-focus)] border-t-black rounded-full animate-spin" /> : <DiskIcon size={14} />}
              {saving ? t("btn.saving") : t("btn.save")}
            </button>
          </div>
        </div>

        {/* Save error banner */}
        {saveError && (
          <div className="mx-4 md:mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-start gap-2">
              <TriangleWarningIcon size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-400 font-medium">{saveErrorIsValidation ? t("error.fixToSave", "Please complete the highlighted fields before saving") : t("error.saveFailed")}</p>
                <p className="text-xs text-red-400/70 mt-0.5 whitespace-pre-line">{saveError}</p>
              </div>
              <button onClick={() => setSaveError(null)} className="text-red-400/50 hover:text-red-400 shrink-0">
                <CrossIcon size={14} />
              </button>
            </div>
            {/* Only surface the RLS / "copy fix SQL" hint for genuine permission
                errors — showing it for every server error (e.g. a timeout or a
                payload-too-large) misled the user into chasing a non-existent
                RLS problem. */}
            {!saveErrorIsValidation && /permission|policy|row-level|\brls\b|not authoriz|forbidden|\b401\b|\b403\b|42501/i.test(saveError) && (
              <div className="mt-3 flex items-center gap-2 ms-6">
                <p className="text-xs text-[var(--text-faint)] flex-1">
                  {t("error.rlsHint")}
                </p>
                <button
                  onClick={() => { navigator.clipboard.writeText(RLS_FIX_SQL); setRlsCopied(true); setTimeout(() => setRlsCopied(false), 2000); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface-active)] text-[var(--text-secondary)] shrink-0 transition-colors"
                >
                  {rlsCopied ? <><CheckIcon size={12} className="text-green-400" /> {t("btn.copied")}</> : <><CopyIcon size={12} /> {t("btn.copyFixSql")}</>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Profile completeness */}
        <div className="px-4 md:px-6 pt-4">
          <ProfileCompletenessBar filled={filledCount} total={totalCount} tiers={supplierTiers} />
        </div>

        {/* Department filter — lets each owner (Finance, Legal, QC…) collapse the
            form to just their sections instead of scrolling the whole record. */}
        {form.contact_type === "supplier" && (
          <div className="px-4 md:px-6 pt-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)] mb-1.5">
              <UsersIcon size={11} className="text-[var(--text-ghost)]" />
              {t("dept.filterHint", "Show fields for")}
              <GuidanceTip guidanceId="supplier.deptFilter" size="xs" />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {[
                { key: null,           label: t("dept.all", "All") },
                { key: "procurement",  label: t("dept.procurement", "Procurement") },
                { key: "finance",      label: t("dept.finance", "Finance") },
                { key: "legal",        label: t("dept.legal", "Legal & Compliance") },
                { key: "logistics",    label: t("dept.logistics", "Logistics") },
                { key: "quality",      label: t("dept.quality", "Quality & Factory") },
                { key: "commercial",   label: t("dept.commercial", "Commercial") },
                { key: "general",      label: t("dept.general", "General") },
              ].map((d) => {
                const active = supplierDept === d.key;
                const tone = d.key ? DEPT_TONE[d.key] : undefined;
                const cls = !tone
                  ? (active
                      ? "bg-[var(--accent,#0066FF)] text-white border-transparent"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]")
                  : (active ? tone.chipActive : `bg-[var(--bg-surface)] ${tone.chipIdle}`);
                return (
                  <button
                    key={d.key ?? "all"}
                    type="button"
                    onClick={() => setSupplierDept(d.key)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${cls}`}
                  >
                    {tone && <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-current opacity-90" : tone.dot}`} />}
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Photo / Logo + Type — supports click, paste (⌘V) and drag-and-drop */}
        <div
          className={`px-4 md:px-6 py-5 md:py-6 text-center border-b border-[var(--border-color)] rounded-xl transition-colors ${logoDrag ? "ring-2 ring-[var(--accent)] bg-[var(--accent)]/5" : ""}`}
          onDragOver={(e) => { e.preventDefault(); if (!logoDrag) setLogoDrag(true); }}
          onDragLeave={(e) => { e.preventDefault(); setLogoDrag(false); }}
          onDrop={(e) => {
            e.preventDefault(); setLogoDrag(false);
            const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
            if (file) openLogoCrop(file);
          }}
        >
          <div className={`w-24 h-24 md:w-28 md:h-28 ${form.contact_type === "supplier" || isCompanyCustomer || isCompanyType ? "rounded-2xl" : "rounded-full"} bg-gradient-to-b from-white/15 to-white/5 flex items-center justify-center mx-auto mb-3 relative overflow-hidden`}>
            {form.photo_url ? (
              <img src={form.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            ) : form.contact_type === "supplier" || isCompanyCustomer || isCompanyType ? (
              <Building2Icon size={32} className="text-[var(--text-ghost)]" />
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-bright)] mb-1" />
                <div className="w-14 h-7 rounded-t-full bg-[var(--bg-surface-active)]" />
              </div>
            )}
          </div>
          {form.photo_url ? (
            <div className="flex items-center justify-center gap-3">
              <label className="text-sm text-blue-400 hover:text-blue-300 cursor-pointer font-medium">
                {form.contact_type === "supplier" || isCompanyCustomer || isCompanyType ? t("photo.changeLogo") : t("photo.changePhoto")}
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) openLogoCrop(file);
                  e.target.value = "";
                }} />
              </label>
              <button onClick={() => setField("photo_url", "")} className="text-sm text-red-400 hover:text-red-300 font-medium">{t("btn.remove")}</button>
            </div>
          ) : (
            <>
              <label className="inline-block px-5 py-2 rounded-full bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface-active)] text-sm text-[var(--text-secondary)] font-medium cursor-pointer transition-colors">
                {form.contact_type === "supplier" || isCompanyCustomer || isCompanyType ? t("photo.addLogo") : t("photo.addPhoto")}
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) openLogoCrop(file);
                  e.target.value = "";
                }} />
              </label>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">{t("photo.hint", "Upload, drag & drop, or paste a screenshot (⌘V) — then crop to a square.")}</p>
            </>
          )}

          {/* Contact Type selector — only in the generic Contacts app.
              In a type-specific app (Suppliers, Customers) the contact type is
              already fixed by the app you're in, so offering Customer / Supplier
              / Company / People here is confusing. */}
          {!filterType && (
          <div className="flex items-center gap-2 mt-4 overflow-x-auto md:overflow-visible no-scrollbar px-2 pb-1 md:justify-center md:flex-wrap">
            {CONTACT_TYPES.map(ct => (
              <button
                key={ct.value}
                onClick={() => setField("contact_type", ct.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  form.contact_type === ct.value
                    ? `border-[var(--border-focus)] bg-[var(--bg-surface-hover)] ${ct.color}`
                    : "border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-subtle)]"
                }`}
              >
                {ct.icon} {t("type." + ct.value, ct.label)}
              </button>
            ))}
          </div>
          )}

          {/* Entity type toggle for customers */}
          {form.contact_type === "customer" && (
            <div className="flex items-center gap-2 mt-3 justify-center">
              <button
                onClick={() => setField("entity_type", "person")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  form.entity_type === "person" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-subtle)]"
                }`}
              >
                <UserIcon size={14} /> {t("entity.individual")}
              </button>
              <button
                onClick={() => setField("entity_type", "company")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  form.entity_type === "company" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-subtle)]"
                }`}
              >
                <Building2Icon size={14} /> {t("entity.business")}
              </button>
            </div>
          )}
        </div>

        {/* ── Customer Premium Tab Bar ── */}
        {isCustomer && form.entity_type && (
          <CustomerTabBar activeTab={customerTab} onChange={setCustomerTab} translate={(k, f) => t(k, f)} />
        )}

        {/* Company Customer: Company Name section */}
        {isCompanyCustomer && customerTab === "overview" && (
        <FormSection title={t("section.companyName")} icon={<Building2Icon size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.companyName")}</label>
              <div className="relative">
                <Building2Icon size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)]" />
                <input
                  value={form.company}
                  onChange={e => setField("company", e.target.value)}
                  placeholder={t("placeholder.acme")}
                  className="w-full h-10 ps-9 pe-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.industry")}</label>
              <input
                value={form.industry}
                onChange={e => setField("industry", e.target.value)}
                placeholder={t("placeholder.techMfg")}
                className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.taxId")}</label>
              <input
                value={form.tax_id}
                onChange={e => setField("tax_id", e.target.value)}
                placeholder={t("placeholder.vatCr")}
                className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
          </div>
        </FormSection>
        )}

        {/* Company Customer: Contact Persons (Activity tab) */}
        {isCompanyCustomer && showTab("activity") && (
        <FormSection title={t("section.contactPersons")} kxComponent="ContactPersonsFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Contacts & communication" icon={<UsersIcon size={14} />}>
          <div className="space-y-3">
            {form.contact_persons.map((cp, i) => (
              <div key={i} className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] overflow-hidden">
                <div className="flex items-center gap-2 p-3">
                  <RemoveBtn onClick={() => setField("contact_persons", form.contact_persons.filter((_, idx) => idx !== i))} />
                  <input
                    value={cp.name}
                    onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], name: e.target.value }; setField("contact_persons", arr); }}
                    placeholder={t("field.name")}
                    className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                  />
                  <input
                    value={cp.position}
                    onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], position: e.target.value }; setField("contact_persons", arr); }}
                    placeholder={t("field.position")}
                    className="w-32 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                  />
                  <button
                    onClick={() => setExpandedFamily(expandedFamily === 2000 + i ? null : 2000 + i)}
                    className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <AngleDownIcon size={14} className={`transition-transform ${expandedFamily === 2000 + i ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {expandedFamily === 2000 + i && (
                  <div className="px-3 pb-3 pt-1 ms-8 space-y-2 border-t border-[var(--border-faint)]">
                    <input value={cp.department} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], department: e.target.value }; setField("contact_persons", arr); }} placeholder={t("field.department")} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none mt-2" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="tel" inputMode="tel" autoComplete="tel" value={cp.phone} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], phone: sanPhone(e.target.value) }; setField("contact_persons", arr); }} placeholder={t("field.phone")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                      <input type="tel" inputMode="tel" autoComplete="tel" value={cp.mobile} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], mobile: sanPhone(e.target.value) }; setField("contact_persons", arr); }} placeholder={t("field.contactMobile")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                    </div>
                    <input type="email" inputMode="email" autoComplete="email" value={cp.email} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], email: e.target.value }; setField("contact_persons", arr); }} placeholder={t("field.email")} aria-invalid={!!(cp.email && !RE_EMAIL.test(cp.email)) || undefined} className={`w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none ${cp.email && !RE_EMAIL.test(cp.email) ? "border-rose-500 ring-1 ring-rose-500/30" : "border-[var(--border-color)]"}`} />
                    <textarea value={cp.notes} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], notes: e.target.value }; setField("contact_persons", arr); }} placeholder={t("field.notes")} rows={2} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none resize-none" />
                  </div>
                )}
              </div>
            ))}
            <AddButton label={t("add.contactPerson")} onClick={() => setField("contact_persons", [...form.contact_persons, { name: "", name_cn: "", position: "", department: "", phone: "", mobile: "", email: "", notes: "", whatsapp: "", wechat_id: "", wechat_qr: "" }])} />
          </div>
        </FormSection>
        )}

        {/* Company Type: Company Information */}
        {isCompanyType && (
        <>
        <FormSection title={t("section.companyInformation")} kxComponent="CompanyInfoFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Identity & profile" icon={<Building2Icon size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.companyName")}</label>
              <div className="relative">
                <Building2Icon size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)]" />
                <input
                  value={form.company}
                  onChange={e => setField("company", e.target.value)}
                  placeholder={t("placeholder.acme")}
                  className="w-full h-10 ps-9 pe-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.industry")}</label>
                <input
                  value={form.industry}
                  onChange={e => setField("industry", e.target.value)}
                  placeholder={t("placeholder.technology")}
                  className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.source")}</label>
                <input
                  value={form.source}
                  onChange={e => setField("source", e.target.value)}
                  placeholder={t("placeholder.referral")}
                  className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.taxId")}</label>
                <input
                  value={form.tax_id}
                  onChange={e => setField("tax_id", e.target.value)}
                  placeholder={t("placeholder.vatCr")}
                  className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.language")}</label>
                <input
                  value={form.language}
                  onChange={e => setField("language", e.target.value)}
                  placeholder={t("field.language")}
                  className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                />
              </div>
            </div>
          </div>
        </FormSection>

        {/* Company Type: Contact Persons */}
        <FormSection title={t("section.contactPersons")} kxComponent="ContactPersonsFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Contacts & communication" icon={<UsersIcon size={14} />}>
          <div className="space-y-3">
            {form.contact_persons.map((cp, i) => (
              <div key={i} className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] overflow-hidden">
                <div className="flex items-center gap-2 p-3">
                  <RemoveBtn onClick={() => setField("contact_persons", form.contact_persons.filter((_, idx) => idx !== i))} />
                  <input
                    value={cp.name}
                    onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], name: e.target.value }; setField("contact_persons", arr); }}
                    placeholder={t("field.name")}
                    className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                  />
                  <input
                    value={cp.position}
                    onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], position: e.target.value }; setField("contact_persons", arr); }}
                    placeholder={t("field.position")}
                    className="w-32 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                  />
                  <button
                    onClick={() => setExpandedFamily(expandedFamily === 3000 + i ? null : 3000 + i)}
                    className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <AngleDownIcon size={14} className={`transition-transform ${expandedFamily === 3000 + i ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {expandedFamily === 3000 + i && (
                  <div className="px-3 pb-3 pt-1 ms-8 space-y-2 border-t border-[var(--border-faint)]">
                    <input value={cp.department} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], department: e.target.value }; setField("contact_persons", arr); }} placeholder={t("field.department")} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none mt-2" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="tel" inputMode="tel" autoComplete="tel" value={cp.phone} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], phone: sanPhone(e.target.value) }; setField("contact_persons", arr); }} placeholder={t("field.phone")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                      <input type="tel" inputMode="tel" autoComplete="tel" value={cp.mobile} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], mobile: sanPhone(e.target.value) }; setField("contact_persons", arr); }} placeholder={t("field.contactMobile")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                    </div>
                    <input type="email" inputMode="email" autoComplete="email" value={cp.email} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], email: e.target.value }; setField("contact_persons", arr); }} placeholder={t("field.email")} aria-invalid={!!(cp.email && !RE_EMAIL.test(cp.email)) || undefined} className={`w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none ${cp.email && !RE_EMAIL.test(cp.email) ? "border-rose-500 ring-1 ring-rose-500/30" : "border-[var(--border-color)]"}`} />
                    <textarea value={cp.notes} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], notes: e.target.value }; setField("contact_persons", arr); }} placeholder={t("field.notes")} rows={2} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none resize-none" />
                  </div>
                )}
              </div>
            ))}
            <AddButton label={t("add.contactPerson")} onClick={() => setField("contact_persons", [...form.contact_persons, { name: "", name_cn: "", position: "", department: "", phone: "", mobile: "", email: "", notes: "", whatsapp: "", wechat_id: "", wechat_qr: "" }])} />
          </div>
        </FormSection>
        </>
        )}

        {/* Basic Info (hidden for suppliers, company customers, and company type) */}
        {form.contact_type !== "supplier" && !isCompanyCustomer && !isCompanyType && showTab("overview") && (
        <FormSection title={t("section.basicInfo")} icon={<UserIcon size={14} />}>
          <div className="space-y-3">
            <SelectInput label={t("field.title")} value={form.title} onChange={v => setField("title", v)} options={TITLES} renderLabel={tOpt} selectLabel={t("detail.select")} />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("field.firstName")} value={form.first_name} onChange={v => setField("first_name", v)} />
              <Input label={t("field.middleName")} value={form.middle_name} onChange={v => setField("middle_name", v)} />
            </div>
            <Input label={t("field.lastName")} value={form.last_name} onChange={v => setField("last_name", v)} />
            <Input label={t("field.company")} value={form.company} onChange={v => setField("company", v)} icon={<Building2Icon size={14} />} />
            <Input label={t("field.position")} value={form.position} onChange={v => setField("position", v)} icon={<BriefcaseIcon size={14} />} />
          </div>
        </FormSection>
        )}

        {/* Phones (hidden for suppliers and employees) */}
        {form.contact_type !== "supplier" && showTab("overview") && (
        <FormSection title={t("section.phoneNumbers")} icon={<PhoneIcon size={14} />}>
          {form.phones.map((p, i) => (
            <div key={i} className="flex items-center gap-2 mb-3">
              <RemoveBtn onClick={() => removePhone(i)} />
              <LabelSelect value={p.label} onChange={v => updatePhone(i, "label", v)} options={PHONE_LABELS} renderLabel={tOpt} />
              <div className="flex-1">
                <PhoneField
                  value={p.number}
                  onChange={v => updatePhone(i, "number", v)}
                  placeholder={t("placeholder.phoneNumber")}
                  defaultIso={form.country_code}
                />
              </div>
            </div>
          ))}
          <AddButton label={t("add.phone")} onClick={addPhone} />
        </FormSection>
        )}

        {/* Emails (hidden for suppliers and employees) */}
        {form.contact_type !== "supplier" && showTab("overview") && (
        <FormSection title={t("section.emailAddresses")} icon={<EnvelopeIcon size={14} />}>
          {form.emails.map((e, i) => (
            <div key={i} className="flex items-center gap-2 mb-3">
              <RemoveBtn onClick={() => removeEmail(i)} />
              <LabelSelect value={e.label} onChange={v => updateEmail(i, "label", v)} options={EMAIL_LABELS} renderLabel={tOpt} />
              <input
                type="email"
                value={e.email}
                onChange={ev => updateEmail(i, "email", ev.target.value)}
                placeholder={t("placeholder.emailAddress")}
                className="flex-1 h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
          ))}
          <AddButton label={t("add.email")} onClick={addEmail} />
        </FormSection>
        )}

        {/* Addresses (hidden for suppliers and employees) */}
        {form.contact_type !== "supplier" && showTab("overview") && (
        <FormSection title={t("section.addresses")} icon={<MapPinIcon size={14} />}>
          {form.addresses.map((a, i) => (
            <div key={i} className="mb-4 p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-3">
                <RemoveBtn onClick={() => removeAddress(i)} />
                <LabelSelect value={a.label} onChange={v => updateAddress(i, "label", v)} options={ADDRESS_LABELS} renderLabel={tOpt} />
              </div>
              <div className="space-y-2 ms-8">
                <input value={a.street} onChange={e => updateAddress(i, "street", e.target.value)} placeholder={t("placeholder.street")} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={a.city} onChange={e => updateAddress(i, "city", e.target.value)} placeholder={t("placeholder.city")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                  <input value={a.state} onChange={e => updateAddress(i, "state", e.target.value)} placeholder={t("placeholder.state")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={a.zip} onChange={e => updateAddress(i, "zip", e.target.value)} placeholder={t("placeholder.zipCode")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                  <input value={a.country} onChange={e => updateAddress(i, "country", e.target.value)} placeholder={t("placeholder.country")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                </div>
              </div>
            </div>
          ))}
          <AddButton label={t("add.address")} onClick={addAddress} />
        </FormSection>
        )}

        {/* Location (country/province/city cascade) - hidden for suppliers and employees */}
        {form.contact_type !== "supplier" && showTab("overview") && (
        <FormSection title={t("section.location")} icon={<MapPinnedIcon size={14} />}>
          <div className="space-y-3">
            <CountryDropdown
              value={form.country_code}
              displayValue={form.country}
              onChange={handleCountryChange}
              label={t("field.country")}
              placeholder={t("field.searchCountry")}
              noResults={t("detail.noCountries")}
            />
            {form.country_code && hasStates && (
              <ProvinceDropdown
                countryCode={form.country_code}
                value={form.province_code}
                displayValue={form.province}
                onChange={handleProvinceChange}
                label={t("field.provinceState")}
                placeholder={t("field.searchProvince")}
                noResults={t("detail.noProvinces")}
              />
            )}
            {showCity && (
              <CityDropdown
                countryCode={form.country_code}
                stateCode={form.province_code}
                value={form.city}
                onChange={handleCityChange}
                label={t("field.city")}
                placeholder={t("field.searchCity")}
                noResults={t("detail.noCities")}
              />
            )}
          </div>
        </FormSection>
        )}

        {/* Websites (hidden for suppliers and employees) */}
        {form.contact_type !== "supplier" && showTab("overview") && (
        <FormSection title={t("section.websites")} icon={<GlobeIcon size={14} />}>
          {form.websites.map((w, i) => (
            <div key={i} className="flex items-center gap-2 mb-3">
              <RemoveBtn onClick={() => removeWebsite(i)} />
              <LabelSelect value={w.label} onChange={v => updateWebsite(i, "label", v)} options={WEBSITE_LABELS} renderLabel={tOpt} />
              <input
                type="url"
                value={w.url}
                onChange={e => updateWebsite(i, "url", e.target.value)}
                placeholder="https://"
                className="flex-1 h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
          ))}
          <AddButton label={t("add.website")} onClick={addWebsite} />
        </FormSection>
        )}

        {/* Birthday (hidden for suppliers, company customers, company type, and employees) */}
        {form.contact_type !== "supplier" && !isCompanyCustomer && !isCompanyType && showTab("overview") && (
        <FormSection title={t("section.birthday")} icon={<CalendarRawIcon size={14} />}>
          <BirthdayPicker value={form.birthday} onChange={v => setField("birthday", v)} dayLabel={t("field.day")} monthLabel={t("field.month")} yearLabel={t("field.year")} renderMonth={m => t("month." + m, m)} />
        </FormSection>
        )}

        {/* Social Profiles (hidden for suppliers, company customers, and employees) */}
        {form.contact_type !== "supplier" && !isCompanyCustomer && showTab("overview") && (
        <FormSection title={t("section.socialProfiles")} icon={<Share2Icon size={14} />}>
          {form.social_profiles.map((s, i) => (
            <div key={i} className="mb-4 p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-3">
                <RemoveBtn onClick={() => removeSocial(i)} />
                <LabelSelect value={s.platform} onChange={v => updateSocial(i, "platform", v)} options={SOCIAL_PLATFORMS} renderLabel={tOpt} />
              </div>
              <div className="space-y-2 ms-8">
                <input value={s.username} onChange={e => updateSocial(i, "username", e.target.value)} placeholder={t("field.username")} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                <input value={s.url} onChange={e => updateSocial(i, "url", e.target.value)} placeholder={t("field.profileUrl")} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.qrCode")}</label>
                  <div className="flex items-center gap-3">
                    {s.qr_code_url && (
                      <img src={s.qr_code_url} alt="QR" className="w-14 h-14 rounded border border-[var(--border-color)] object-cover" loading="lazy" decoding="async" />
                    )}
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-surface-hover)] transition-colors">
                      <CameraIcon size={14} />
                      {s.qr_code_url ? t("btn.change") : t("photo.uploadQr")}
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) compressImage(file, 400, 0.8).then(url => updateSocial(i, "qr_code_url", url));
                      }} />
                    </label>
                    {s.qr_code_url && (
                      <button onClick={() => updateSocial(i, "qr_code_url", "")} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("btn.remove")}</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <AddButton label={t("add.socialProfile")} onClick={addSocial} />
        </FormSection>
        )}

        {/* Related People (hidden for suppliers, company customers, company type, and employees) */}
        {form.contact_type !== "supplier" && !isCompanyCustomer && !isCompanyType && showTab("activity") && (
        <FormSection title={t("section.relatedPeople")} icon={<UsersIcon size={14} />}>
          {form.family_members.map((f, i) => (
            <div key={i} className="mb-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] overflow-hidden">
              <div className="flex items-center gap-2 p-3">
                <RemoveBtn onClick={() => removeFamily(i)} />
                <LabelSelect value={f.relationship} onChange={v => updateFamily(i, "relationship", v)} options={RELATED_PEOPLE_LABELS} renderLabel={tOpt} />
                <input
                  value={f.first_name}
                  onChange={e => updateFamily(i, "first_name", e.target.value)}
                  placeholder={t("field.name")}
                  className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                />
                <button
                  onClick={() => setExpandedFamily(expandedFamily === i ? null : i)}
                  className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <AngleDownIcon size={14} className={`transition-transform ${expandedFamily === i ? "rotate-180" : ""}`} />
                </button>
              </div>
              {expandedFamily === i && (
                <div className="px-3 pb-3 pt-1 ms-8 space-y-2 border-t border-[var(--border-faint)]">
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input value={f.last_name} onChange={e => updateFamily(i, "last_name", e.target.value)} placeholder={t("field.lastNameField")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                    <input type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={e => updateFamily(i, "phone", sanPhone(e.target.value))} placeholder={t("field.phone")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                  </div>
                  <input type="email" inputMode="email" autoComplete="email" value={f.email} onChange={e => updateFamily(i, "email", e.target.value)} placeholder={t("field.email")} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                  <textarea value={f.notes} onChange={e => updateFamily(i, "notes", e.target.value)} placeholder={t("field.notes")} rows={2} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none resize-none" />
                </div>
              )}
            </div>
          ))}
          <AddButton label={t("add.relatedPerson")} onClick={addFamily} />
        </FormSection>
        )}

        {/* Notes (shared — hidden for suppliers, they have their own at the end) */}
        {form.contact_type !== "supplier" && showTab("activity") && (
        <FormSection title={t("section.notes")} icon={<DocumentIcon size={14} />}>
          <textarea
            value={form.notes}
            onChange={e => setField("notes", e.target.value)}
            placeholder={t("placeholder.addNotes")}
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] resize-none"
          />
        </FormSection>
        )}

        {/* Custom Fields (hidden for suppliers) */}
        {form.contact_type !== "supplier" && showTab("activity") && (
        <FormSection title={t("section.customFields")} icon={<HashtagIcon size={14} />}>
          {form.custom_fields.map((cf, i) => (
            <div key={i} className="flex items-center gap-2 mb-3">
              <RemoveBtn onClick={() => removeCustomField(i)} />
              <input
                value={cf.field_name}
                onChange={e => updateCustomField(i, "field_name", e.target.value)}
                placeholder={t("placeholder.fieldName")}
                className="w-32 h-10 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium outline-none"
              />
              <input
                value={cf.field_value}
                onChange={e => updateCustomField(i, "field_value", e.target.value)}
                placeholder={t("placeholder.value")}
                className="flex-1 h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
          ))}
          <AddButton label={t("add.field")} onClick={addCustomField} />
        </FormSection>
        )}

        {/* Business Card (customers only — Overview tab) */}
        {isCustomer && showTab("overview") && (
          <FormSection title={t("section.businessCard")} kxComponent="BusinessCardFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Records & notes" icon={<CreditCardIcon size={14} />}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("detail.front")}</label>
                <label className="flex flex-col items-center justify-center w-full aspect-[1.6/1] rounded-lg border-2 border-dashed border-[var(--border-color)] hover:border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] cursor-pointer transition-colors overflow-hidden">
                  {form.business_card_front ? (
                    <img src={form.business_card_front} alt="Front" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-[var(--text-dim)]">
                      <CreditCardIcon size={18} />
                      <span className="text-[11px]">{t("photo.uploadFront")}</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) compressImage(file).then(url => setField("business_card_front", url));
                  }} />
                </label>
                {form.business_card_front && (
                  <button onClick={() => setField("business_card_front", "")} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] mt-1.5">{t("btn.remove")}</button>
                )}
              </div>
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("detail.back")}</label>
                <label className="flex flex-col items-center justify-center w-full aspect-[1.6/1] rounded-lg border-2 border-dashed border-[var(--border-color)] hover:border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] cursor-pointer transition-colors overflow-hidden">
                  {form.business_card_back ? (
                    <img src={form.business_card_back} alt="Back" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-[var(--text-dim)]">
                      <CreditCardIcon size={18} />
                      <span className="text-[11px]">{t("photo.uploadBack")}</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) compressImage(file).then(url => setField("business_card_back", url));
                  }} />
                </label>
                {form.business_card_back && (
                  <button onClick={() => setField("business_card_back", "")} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] mt-1.5">{t("btn.remove")}</button>
                )}
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Financial & Business (customer only — Financial tab) ── */}
        {isCustomer && showTab("financial") && (
          <FormSection title={t("section.financialBusiness")} kxComponent="FinancialFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Commercial & logistics" icon={<DollarSignIcon size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.currency")} value={form.currency} onChange={v => setField("currency", v)} options={CURRENCIES} icon={<DollarSignIcon size={14} />} selectLabel={t("detail.select")} />
                <SelectInput label={t("field.paymentTerms")} value={form.payment_terms} onChange={v => setField("payment_terms", v)} options={PAYMENT_TERMS_OPTIONS} icon={<ReceiptIcon size={14} />} renderLabel={tOpt} selectLabel={t("detail.select")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.totalRevenue")} value={form.total_revenue} onChange={v => setField("total_revenue", v)} placeholder="0.00" inputMode="decimal" icon={<TrendingUpIcon size={14} />} />
                <Input label={t("field.outstandingBalance")} value={form.outstanding_balance} onChange={v => setField("outstanding_balance", v)} placeholder="0.00" inputMode="decimal" icon={<ReceiptIcon size={14} />} />
              </div>
              <Input label={t("field.creditLimit")} value={form.credit_limit} onChange={v => setField("credit_limit", v)} placeholder="0.00" inputMode="decimal" icon={<WalletIcon size={14} />} />
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.lastOrderDate")}</label>
                <DateField value={form.last_order_date} onChange={v => setField("last_order_date", v)} />
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Classification & Segmentation (customer only — Commercial tab) ── */}
        {isCustomer && showTab("commercial") && (
          <FormSection title={t("section.classification")} kxComponent="ClassificationFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Intelligence" icon={<TagsIcon size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.industry")} value={form.industry} onChange={v => setField("industry", v)} options={INDUSTRIES} icon={<FactoryIcon size={14} />} renderLabel={tOpt} selectLabel={t("detail.select")} />
                <SelectInput label={t("field.source")} value={form.source} onChange={v => setField("source", v)} options={LEAD_SOURCES} icon={<TargetIcon size={14} />} renderLabel={tOpt} selectLabel={t("detail.select")} />
              </div>
              <Input label={t("field.accountManager")} value={form.account_manager} onChange={v => setField("account_manager", v)} placeholder={t("field.name")} icon={<UserCogIcon size={14} />} />
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.tags")}</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.tags.map((tag, i) => (
                    <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
                      {tag}
                      <button onClick={() => setField("tags", form.tags.filter((_, idx) => idx !== i))} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                        <CrossIcon size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    id="tag-input"
                    placeholder={t("add.tag")}
                    className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && !form.tags.includes(val)) {
                          setField("tags", [...form.tags, val]);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById("tag-input") as HTMLInputElement;
                      const val = input?.value.trim();
                      if (val && !form.tags.includes(val)) {
                        setField("tags", [...form.tags, val]);
                        input.value = "";
                      }
                    }}
                    className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Relationship & Activity (customer only — Activity tab) ── */}
        {isCustomer && showTab("activity") && (
          <FormSection title={t("section.relationshipActivity")} icon={<ClockIcon size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.communication")} value={form.communication_preference} onChange={v => setField("communication_preference", v)} options={COMM_PREFERENCES} icon={<MessageSquareIcon size={14} />} renderLabel={tOpt} selectLabel={t("detail.select")} />
                <SelectInput label={t("field.language")} value={form.language} onChange={v => setField("language", v)} options={LANGUAGES} icon={<LanguagesIcon size={14} />} renderLabel={tOpt} selectLabel={t("detail.select")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.firstContact")}</label>
                  <DateField value={form.first_contact_date} onChange={v => setField("first_contact_date", v)} />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.lastContacted")}</label>
                  <DateField value={form.last_contacted} onChange={v => setField("last_contacted", v)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.followUpDate")}</label>
                <DateField value={form.follow_up_date} onChange={v => setField("follow_up_date", v)} />
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Trade & Shipping (customer only — Trade tab) ── */}
        {isCustomer && showTab("trade") && (
          <FormSection title={t("section.tradeShipping")} kxComponent="TradeShippingFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Commercial & logistics" icon={<ShipIcon size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.shippingMethod")} value={form.preferred_shipping} onChange={v => setField("preferred_shipping", v)} options={SHIPPING_METHODS} icon={<ShipIcon size={14} />} renderLabel={tOpt} selectLabel={t("detail.select")} />
                <SelectInput label={t("field.incoterms")} value={form.incoterms} onChange={v => setField("incoterms", v)} options={INCOTERMS_OPTIONS} icon={<FileCheckIcon size={14} />} selectLabel={t("detail.select")} />
              </div>
              <Input label={t("field.taxIdImport")} value={form.tax_id} onChange={v => setField("tax_id", v)} placeholder={t("placeholder.vatCr")} icon={<HashtagIcon size={14} />} />
              {/* Shipping Addresses */}
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-2 block">{t("field.shippingAddresses")}</label>
                {form.shipping_addresses.map((a, i) => (
                  <div key={i} className="mb-3 p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-color)]">
                    <div className="flex items-center gap-2 mb-2">
                      <RemoveBtn onClick={() => setField("shipping_addresses", form.shipping_addresses.filter((_, idx) => idx !== i))} />
                      <LabelSelect value={a.label} onChange={v => { const arr = [...form.shipping_addresses]; arr[i] = { ...arr[i], label: v }; setField("shipping_addresses", arr); }} options={["warehouse", "port", "office", "other"]} renderLabel={tOpt} />
                    </div>
                    <div className="space-y-2 ms-8">
                      <input value={a.street} onChange={e => { const arr = [...form.shipping_addresses]; arr[i] = { ...arr[i], street: e.target.value }; setField("shipping_addresses", arr); }} placeholder={t("placeholder.street")} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={a.city} onChange={e => { const arr = [...form.shipping_addresses]; arr[i] = { ...arr[i], city: e.target.value }; setField("shipping_addresses", arr); }} placeholder={t("placeholder.city")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                        <input value={a.state} onChange={e => { const arr = [...form.shipping_addresses]; arr[i] = { ...arr[i], state: e.target.value }; setField("shipping_addresses", arr); }} placeholder={t("placeholder.state")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={a.zip} onChange={e => { const arr = [...form.shipping_addresses]; arr[i] = { ...arr[i], zip: e.target.value }; setField("shipping_addresses", arr); }} placeholder={t("placeholder.zipCode")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                        <input value={a.country} onChange={e => { const arr = [...form.shipping_addresses]; arr[i] = { ...arr[i], country: e.target.value }; setField("shipping_addresses", arr); }} placeholder={t("placeholder.country")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                      </div>
                    </div>
                  </div>
                ))}
                <AddButton label={t("add.shippingAddress")} onClick={() => setField("shipping_addresses", [...form.shipping_addresses, { label: "warehouse", street: "", city: "", state: "", zip: "", country: "" }])} />
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Documents / Attachments (customer only — Compliance tab) ── */}
        {isCustomer && showTab("compliance") && (
          <FormSection title={t("section.documentsAttachments")} kxComponent="DocumentsFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Records & notes" icon={<PaperclipIcon size={14} />}>
            {form.attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)]">
                <RemoveBtn onClick={() => setField("attachments", form.attachments.filter((_, idx) => idx !== i))} />
                <FileCheckIcon size={14} className="text-blue-400 shrink-0" />
                <span className="text-sm text-[var(--text-primary)] truncate flex-1">{a.name}</span>
                <span className="text-[10px] text-[var(--text-dim)]">{a.type}</span>
              </div>
            ))}
            <label className="flex items-center gap-2 mt-2 px-3 py-2.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-dashed border-[var(--border-color)] hover:border-[var(--border-focus)] cursor-pointer transition-colors">
              <PaperclipIcon size={14} className="text-[var(--text-faint)]" />
              <span className="text-xs text-[var(--text-faint)]">{t("photo.uploadDocument")}</span>
              <input type="file" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const isImage = file.type.startsWith("image/");
                  const handler = isImage ? compressImage(file, 1200, 0.8) : uploadFileToStorage(file);
                  handler.then(url => {
                    setField("attachments", [...form.attachments, {
                      name: file.name,
                      url,
                      type: file.type.split("/").pop()?.toUpperCase() || "FILE",
                      uploaded_at: new Date().toISOString(),
                    }]);
                  });
                }
              }} />
            </label>
          </FormSection>
        )}

        {/* ════════════════════════════════════════════════════════════════════
             PREMIUM CUSTOMER SECTIONS — Phase 1
             ════════════════════════════════════════════════════════════════════ */}

        {/* ── Commercial Profile (customer only — Commercial tab) ── */}
        {isCustomer && showTab("commercial") && (
          <FormSection title={t("section.commercialProfile", "Commercial Profile")} kxComponent="CommercialFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Commercial & logistics" icon={<BriefcaseIcon size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.marketBand", "Market Band")} value={form.market_band} onChange={v => setField("market_band", v)} options={MARKET_BANDS} icon={<TargetIcon size={14} />} selectLabel={t("detail.select")} />
                <SelectInput label={t("field.commercialRole", "Commercial Role")} value={form.commercial_role} onChange={v => setField("commercial_role", v)} options={COMMERCIAL_ROLES} icon={<HandCoinsIcon size={14} />} selectLabel={t("detail.select")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.territory", "Territory")} value={form.territory} onChange={v => setField("territory", v)} placeholder="GCC / MENA / APAC" icon={<MapPinnedIcon size={14} />} />
                <Input label={t("field.assignedBranch", "Assigned Branch")} value={form.assigned_branch} onChange={v => setField("assigned_branch", v)} placeholder={t("placeholder.branchName", "Branch name")} icon={<Building2Icon size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.exclusivity", "Exclusivity")} value={form.exclusivity} onChange={v => setField("exclusivity", v)} options={EXCLUSIVITY_LEVELS} icon={<ShieldCheckIcon size={14} />} selectLabel={t("detail.select")} />
                <SelectInput label={t("field.exclusivityScope", "Exclusivity Scope")} value={form.exclusivity_scope} onChange={v => setField("exclusivity_scope", v)} options={EXCLUSIVITY_SCOPES} icon={<MapPinIcon size={14} />} selectLabel={t("detail.select")} />
              </div>
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.exclusivityExpiry", "Exclusivity Expiry")}</label>
                <DateField value={form.exclusivity_expiry} onChange={v => setField("exclusivity_expiry", v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.salesRep", "Sales Rep")} value={form.sales_rep} onChange={v => setField("sales_rep", v)} placeholder={t("field.name")} icon={<UserIcon size={14} />} />
                <Input label={t("field.backupAM", "Backup Account Manager")} value={form.backup_account_manager} onChange={v => setField("backup_account_manager", v)} placeholder={t("field.name")} icon={<UserCogIcon size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.sourceDetails", "Source Details")} value={form.source_details} onChange={v => setField("source_details", v)} placeholder={t("placeholder.sourceCampaign", "Campaign / event")} icon={<TargetIcon size={14} />} />
                <Input label={t("field.referredBy", "Referred By")} value={form.referred_by} onChange={v => setField("referred_by", v)} placeholder={t("field.name")} icon={<UsersIcon size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.levelAssignedDate", "Level Assigned")}</label>
                  <DateField value={form.customer_level_assigned_date} onChange={v => setField("customer_level_assigned_date", v)} />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.levelReviewDate", "Level Review Due")}</label>
                  <DateField value={form.customer_level_review_date} onChange={v => setField("customer_level_review_date", v)} />
                </div>
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Pricing & Discounts (customer only — Commercial tab) ── */}
        {isCustomer && showTab("commercial") && (
          <FormSection title={t("section.pricingDiscounts", "Pricing & Discounts")} kxComponent="PricingFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Commercial & logistics" icon={<HandCoinsIcon size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.priceListTier", "Price List Tier")} value={form.price_list_tier} onChange={v => setField("price_list_tier", v)} options={PRICE_LIST_TIERS} icon={<TagsIcon size={14} />} selectLabel={t("detail.select")} />
                <Input label={t("field.maxDiscount", "Max Discount (%)")} value={form.max_discount_allowed} onChange={v => setField("max_discount_allowed", v)} placeholder="0.00" inputMode="decimal" icon={<ReceiptIcon size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.commissionRate", "Commission Rate (%)")} value={form.commission_rate} onChange={v => setField("commission_rate", v)} placeholder="0.00" inputMode="decimal" icon={<DollarSignIcon size={14} />} />
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.contractPricingExpiry", "Contract Pricing Expiry")}</label>
                  <DateField value={form.contract_pricing_expiry} onChange={v => setField("contract_pricing_expiry", v)} />
                </div>
              </div>
              <ToggleSwitch
                label={t("field.specialPricingAgreement", "Special Pricing Agreement")}
                hint={t("field.specialPricingAgreementHint", "Active custom contract pricing")}
                checked={form.special_pricing_agreement}
                onChange={v => setField("special_pricing_agreement", v)}
              />
            </div>
          </FormSection>
        )}

        {/* ── Segmentation & Health (customer only — Commercial tab) ── */}
        {isCustomer && showTab("commercial") && (
          <FormSection title={t("section.segmentationHealth", "Segmentation & Health")} icon={<StarIcon size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.subIndustry", "Sub Industry")} value={form.sub_industry} onChange={v => setField("sub_industry", v)} placeholder={t("placeholder.subIndustry", "e.g. Solar EPC")} icon={<FactoryIcon size={14} />} />
                <SelectInput label={t("field.buyingBehavior", "Buying Behavior")} value={form.buying_behavior} onChange={v => setField("buying_behavior", v)} options={BUYING_BEHAVIORS} icon={<PackageIcon size={14} />} selectLabel={t("detail.select")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.priceSensitivity", "Price Sensitivity")} value={form.price_sensitivity} onChange={v => setField("price_sensitivity", v)} options={SENSITIVITY_LEVELS} icon={<DollarSignIcon size={14} />} selectLabel={t("detail.select")} />
                <SelectInput label={t("field.qualitySensitivity", "Quality Sensitivity")} value={form.quality_sensitivity} onChange={v => setField("quality_sensitivity", v)} options={SENSITIVITY_LEVELS} icon={<ShieldCheckIcon size={14} />} selectLabel={t("detail.select")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.relationshipStage", "Relationship Stage")} value={form.relationship_stage} onChange={v => setField("relationship_stage", v)} options={RELATIONSHIP_STAGES} icon={<ClockIcon size={14} />} selectLabel={t("detail.select")} />
                <SelectInput label={t("field.churnRisk", "Churn Risk")} value={form.churn_risk} onChange={v => setField("churn_risk", v)} options={CHURN_RISK_LEVELS} icon={<TriangleWarningIcon size={14} />} selectLabel={t("detail.select")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.supportTier", "Support Tier")} value={form.support_tier} onChange={v => setField("support_tier", v)} options={SUPPORT_TIERS} icon={<HeartIcon size={14} />} selectLabel={t("detail.select")} />
                <Input label={t("field.healthScore", "Health Score")} value={form.customer_health_score} onChange={v => setField("customer_health_score", v)} placeholder="0–100" icon={<HeartIcon size={14} />} />
              </div>
              <Input label={t("field.npsScore", "NPS Score")} value={form.nps_score} onChange={v => setField("nps_score", v)} placeholder="-100 to 100" icon={<StarIcon size={14} />} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ToggleSwitch
                  label={t("field.vipStatus", "VIP Status")}
                  hint={t("field.vipStatusHint", "Priority service & white-glove support")}
                  checked={form.vip_status}
                  onChange={v => setField("vip_status", v)}
                />
                <ToggleSwitch
                  label={t("field.strategicAccount", "Strategic Account")}
                  hint={t("field.strategicAccountHint", "Key account for growth")}
                  checked={form.strategic_account}
                  onChange={v => setField("strategic_account", v)}
                />
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Credit Management (customer only — Financial tab) ── */}
        {isCustomer && showTab("financial") && (
          <FormSection title={t("section.creditManagement", "Credit Management")} kxComponent="CreditFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Commercial & logistics" icon={<WalletIcon size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.creditRatingInternal", "Internal Rating")} value={form.credit_rating_internal} onChange={v => setField("credit_rating_internal", v)} options={CREDIT_RATING_INTERNAL} icon={<ShieldIcon size={14} />} selectLabel={t("detail.select")} />
                <Input label={t("field.creditRatingExternal", "External Rating")} value={form.credit_rating_external} onChange={v => setField("credit_rating_external", v)} placeholder="D&B / S&P" icon={<AwardIcon size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.creditApprovedBy", "Limit Approved By")} value={form.credit_limit_approved_by} onChange={v => setField("credit_limit_approved_by", v)} placeholder={t("field.name")} icon={<UserCheckIcon size={14} />} />
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.creditApprovedDate", "Approved Date")}</label>
                  <DateField value={form.credit_limit_approved_date} onChange={v => setField("credit_limit_approved_date", v)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.overdueBalance", "Overdue Balance")} value={form.overdue_balance} onChange={v => setField("overdue_balance", v)} placeholder="0.00" inputMode="decimal" icon={<TriangleWarningIcon size={14} />} />
                <Input label={t("field.dso", "Days Sales Outstanding")} value={form.days_sales_outstanding} onChange={v => setField("days_sales_outstanding", v)} placeholder="0" icon={<TimerIcon size={14} />} />
              </div>
              <SelectInput label={t("field.preferredPaymentMethod", "Preferred Payment Method")} value={form.preferred_payment_method} onChange={v => setField("preferred_payment_method", v)} options={PREFERRED_PAYMENT_METHODS} icon={<CreditCardIcon size={14} />} selectLabel={t("detail.select")} />
            </div>
          </FormSection>
        )}

        {/* ── Credit Insurance (customer only — Financial tab) ── */}
        {isCustomer && showTab("financial") && (
          <FormSection title={t("section.creditInsurance", "Credit Insurance")} icon={<ShieldCheckIcon size={14} />}>
            <div className="space-y-3">
              <ToggleSwitch
                label={t("field.creditInsuranceCovered", "Credit Insurance Covered")}
                hint={t("field.creditInsuranceCoveredHint", "Receivables insured by a trade credit policy")}
                checked={form.credit_insurance_covered}
                onChange={v => setField("credit_insurance_covered", v)}
              />
              {form.credit_insurance_covered && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t("field.insuranceProvider", "Provider")} value={form.credit_insurance_provider} onChange={v => setField("credit_insurance_provider", v)} placeholder="Euler Hermes / Coface" icon={<ShieldCheckIcon size={14} />} />
                  <Input label={t("field.insuranceCoverage", "Coverage Amount")} value={form.credit_insurance_coverage} onChange={v => setField("credit_insurance_coverage", v)} placeholder="0.00" inputMode="decimal" icon={<WalletIcon size={14} />} />
                </div>
              )}
            </div>
          </FormSection>
        )}

        {/* ── Bank Accounts (customer only — Financial tab) ── */}
        {isCustomer && showTab("financial") && (
          <FormSection title={t("section.bankAccountInfo")} kxComponent="BankingFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Commercial & logistics" icon={<LandmarkIcon size={14} />}>
            <div className="space-y-3">
              {form.bank_accounts.map((b, i) => (
                <div key={i} className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] overflow-hidden">
                  <div className="flex items-center gap-2 p-3">
                    <RemoveBtn onClick={() => setField("bank_accounts", form.bank_accounts.filter((_, idx) => idx !== i))} />
                    <input
                      value={b.bank_name}
                      onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], bank_name: e.target.value }; setField("bank_accounts", arr); }}
                      placeholder={t("field.bankName", "Bank name")}
                      className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                    />
                    <input
                      value={b.currency}
                      onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], currency: e.target.value }; setField("bank_accounts", arr); }}
                      placeholder="USD"
                      className="w-20 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] text-center uppercase"
                    />
                  </div>
                  <div className="px-3 pb-3 ms-8 space-y-2">
                    <input value={b.account_name} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], account_name: e.target.value }; setField("bank_accounts", arr); }} placeholder={t("field.accountName", "Account name")} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={b.account_number} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], account_number: e.target.value }; setField("bank_accounts", arr); }} placeholder={t("field.accountNumber", "Account number")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                      <input value={b.swift_code} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], swift_code: e.target.value }; setField("bank_accounts", arr); }} placeholder="SWIFT / BIC" className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={b.iban} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], iban: e.target.value }; setField("bank_accounts", arr); }} placeholder="IBAN" className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                      <input value={b.branch} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], branch: e.target.value }; setField("bank_accounts", arr); }} placeholder={t("field.branch", "Branch")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                    </div>
                  </div>
                </div>
              ))}
              <AddButton label={t("add.bankAccount", "Add bank account")} onClick={() => setField("bank_accounts", [...form.bank_accounts, { bank_name: "", account_name: "", account_number: "", swift_code: "", iban: "", branch: "", currency: "" }])} />
            </div>
          </FormSection>
        )}

        {/* ── Legal Identity (customer only — Compliance tab) ── */}
        {isCustomer && showTab("compliance") && (
          <FormSection title={t("section.legalIdentity", "Legal Identity")} kxComponent="LegalIdentityFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Legal & compliance" icon={<Building2Icon size={14} />}>
            <div className="space-y-3">
              <Input label={t("field.tradingName", "Trading / DBA Name")} value={form.trading_name} onChange={v => setField("trading_name", v)} placeholder={t("placeholder.tradingName", "Doing business as")} icon={<Building2Icon size={14} />} />
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.companyType", "Company Type")} value={form.company_type} onChange={v => setField("company_type", v)} options={COMPANY_TYPES} icon={<BriefcaseIcon size={14} />} selectLabel={t("detail.select")} />
                <Input label={t("field.businessRegNumber", "Business Registration #")} value={form.business_registration_number} onChange={v => setField("business_registration_number", v)} placeholder={t("placeholder.regNumber", "CR / ABN / Reg #")} icon={<HashtagIcon size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.registrationCountry", "Registration Country")} value={form.registration_country} onChange={v => setField("registration_country", v)} placeholder={t("placeholder.country")} icon={<GlobeIcon size={14} />} />
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.registrationDate", "Registration Date")}</label>
                  <DateField value={form.registration_date} onChange={v => setField("registration_date", v)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.yearEstablished", "Year Established")} value={form.year_established} onChange={v => setField("year_established", v)} placeholder="2000" icon={<CalendarRawIcon size={14} />} />
                <SelectInput label={t("field.employeeCountRange", "Employee Count")} value={form.employee_count_range} onChange={v => setField("employee_count_range", v)} options={EMPLOYEE_COUNT_RANGES} icon={<UsersIcon size={14} />} selectLabel={t("detail.select")} />
              </div>
              <SelectInput label={t("field.annualRevenueRange", "Annual Revenue")} value={form.annual_revenue_range} onChange={v => setField("annual_revenue_range", v)} options={ANNUAL_REVENUE_RANGES} icon={<TrendingUpIcon size={14} />} selectLabel={t("detail.select")} />
            </div>
          </FormSection>
        )}

        {/* ── International Trade IDs (customer only — Compliance tab) ── */}
        {isCustomer && showTab("compliance") && (
          <FormSection title={t("section.tradeIdentifiers", "International Trade IDs")} kxComponent="TradeIdentifiersFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Legal & compliance" icon={<FileCheckIcon size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.eoriNumber", "EORI")} value={form.eori_number} onChange={v => setField("eori_number", v)} placeholder="GB123456789000" icon={<HashtagIcon size={14} />} />
                <Input label={t("field.dunsNumber", "D-U-N-S")} value={form.duns_number} onChange={v => setField("duns_number", v)} placeholder="123456789" icon={<HashtagIcon size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.iec", "IEC (Importer/Exporter)")} value={form.importer_exporter_code} onChange={v => setField("importer_exporter_code", v)} placeholder="IEC code" icon={<HashtagIcon size={14} />} />
                <Input label={t("field.customsCode", "Customs Code")} value={form.customs_code} onChange={v => setField("customs_code", v)} placeholder="Customs code" icon={<HashtagIcon size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.gstNumber", "GST / VAT")} value={form.gst_number} onChange={v => setField("gst_number", v)} placeholder="GST / VAT number" icon={<HashtagIcon size={14} />} />
                <Input label={t("field.crNumber", "CR Number")} value={form.cr_number} onChange={v => setField("cr_number", v)} placeholder="Commercial registration" icon={<HashtagIcon size={14} />} />
              </div>
            </div>
          </FormSection>
        )}

        {/* ── KYC & Risk (customer only — Compliance tab) ── */}
        {isCustomer && showTab("compliance") && (
          <FormSection title={t("section.kycRisk", "KYC & Risk")} icon={<ShieldCheckIcon size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.kycStatus", "KYC Status")} value={form.kyc_status} onChange={v => setField("kyc_status", v)} options={KYC_STATUSES} icon={<ClipboardCheckIcon size={14} />} selectLabel={t("detail.select")} />
                <Input label={t("field.riskScore", "Risk Score")} value={form.risk_score} onChange={v => setField("risk_score", v)} placeholder="0–100" icon={<TriangleWarningIcon size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.kycVerifiedDate", "KYC Verified Date")}</label>
                  <DateField value={form.kyc_verified_date} onChange={v => setField("kyc_verified_date", v)} />
                </div>
                <Input label={t("field.kycVerifiedBy", "Verified By")} value={form.kyc_verified_by} onChange={v => setField("kyc_verified_by", v)} placeholder={t("field.name")} icon={<UserCheckIcon size={14} />} />
              </div>
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.kycReviewDueDate", "Next Review Due")}</label>
                <DateField value={form.kyc_review_due_date} onChange={v => setField("kyc_review_due_date", v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.sanctionsCheckStatus", "Sanctions Check")} value={form.sanctions_check_status} onChange={v => setField("sanctions_check_status", v)} options={SANCTIONS_STATUSES} icon={<ShieldExclamationIcon size={14} />} selectLabel={t("detail.select")} />
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.sanctionsCheckDate", "Last Check")}</label>
                  <DateField value={form.sanctions_check_date} onChange={v => setField("sanctions_check_date", v)} />
                </div>
              </div>
              <Input label={t("field.amlStatus", "AML Status")} value={form.aml_status} onChange={v => setField("aml_status", v)} placeholder={t("placeholder.amlStatus", "Clear / Pending / Flagged")} icon={<ShieldCheckIcon size={14} />} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ToggleSwitch
                  label={t("field.pepStatus", "PEP (Politically Exposed)")}
                  hint={t("field.pepStatusHint", "Requires enhanced due diligence")}
                  checked={form.pep_status}
                  onChange={v => setField("pep_status", v)}
                />
                <ToggleSwitch
                  label={t("field.highRiskCountry", "High-Risk Country")}
                  hint={t("field.highRiskCountryHint", "Jurisdiction on watchlist")}
                  checked={form.high_risk_country}
                  onChange={v => setField("high_risk_country", v)}
                />
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Flags & Audit (customer only — Compliance tab) ── */}
        {isCustomer && showTab("compliance") && (
          <FormSection title={t("section.flagsAudit", "Flags & Audit")} icon={<TriangleWarningIcon size={14} />}>
            <TagEditor
              label={t("field.flags", "Flags")}
              values={form.flags}
              onChange={v => setField("flags", v)}
              placeholder={t("placeholder.addFlag", "Type a flag and press Enter")}
              icon={<TriangleWarningIcon size={14} />}
            />
          </FormSection>
        )}

        {/* ── Logistics & Trade Operations (customer only — Trade tab) ── */}
        {isCustomer && showTab("trade") && (
          <FormSection title={t("section.logisticsTrade", "Logistics & Trade Operations")} icon={<TruckIcon size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.portOfEntry", "Port of Entry")} value={form.port_of_entry} onChange={v => setField("port_of_entry", v)} placeholder="Jebel Ali / Shanghai" icon={<ShipIcon size={14} />} />
                <SelectInput label={t("field.containerPreference", "Container Preference")} value={form.container_preference} onChange={v => setField("container_preference", v)} options={CONTAINER_PREFERENCES} icon={<BoxesIcon size={14} />} selectLabel={t("detail.select")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.customsBroker", "Customs Broker")} value={form.customs_broker} onChange={v => setField("customs_broker", v)} placeholder={t("field.name")} icon={<FileCheckIcon size={14} />} />
                <Input label={t("field.freightForwarder", "Freight Forwarder")} value={form.freight_forwarder} onChange={v => setField("freight_forwarder", v)} placeholder={t("field.name")} icon={<WarehouseIcon size={14} />} />
              </div>
              <Input label={t("field.shippingMarks", "Shipping Marks")} value={form.shipping_marks} onChange={v => setField("shipping_marks", v)} placeholder={t("placeholder.shippingMarks", "Marks & numbers")} icon={<HashtagIcon size={14} />} />
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.labelingRequirements", "Labeling Requirements")}</label>
                <textarea
                  value={form.labeling_requirements}
                  onChange={e => setField("labeling_requirements", e.target.value)}
                  placeholder={t("placeholder.labelingRequirements", "Multi-language labels, regulatory stickers...")}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] resize-none"
                />
              </div>
            </div>
          </FormSection>
        )}

        {/* ── HS Codes, Carriers & Certifications (customer only — Trade tab) ── */}
        {isCustomer && showTab("trade") && (
          <FormSection title={t("section.tradeCodes", "Classification & Carriers")} icon={<ClipboardCheckIcon size={14} />}>
            <div className="space-y-4">
              <TagEditor
                label={t("field.hsCodes", "HS Codes")}
                values={form.hs_codes}
                onChange={v => setField("hs_codes", v)}
                placeholder={t("placeholder.hsCode", "e.g. 8541.40")}
                icon={<HashtagIcon size={14} />}
              />
              <TagEditor
                label={t("field.preferredCarriers", "Preferred Carriers")}
                values={form.preferred_carriers}
                onChange={v => setField("preferred_carriers", v)}
                placeholder={t("placeholder.carrier", "Maersk / DHL / …")}
                icon={<TruckIcon size={14} />}
              />
              <TagEditor
                label={t("field.certificationsRequired", "Certifications Required")}
                values={form.certifications_required}
                onChange={v => setField("certifications_required", v)}
                placeholder={t("placeholder.certification", "ISO / CE / SASO / …")}
                icon={<AwardIcon size={14} />}
              />
            </div>
          </FormSection>
        )}

        {/* ── Messaging IDs (customer only — Activity tab) ── */}
        {isCustomer && showTab("activity") && (
          <FormSection title={t("section.messagingIds", "Messaging IDs")} icon={<MessageSquareIcon size={14} />}>
            <div className="space-y-3">
              <Input label={t("field.whatsappBusiness", "WhatsApp Business")} value={form.whatsapp_business} onChange={v => setField("whatsapp_business", sanPhone(v))} placeholder="+971 …" icon={<PhoneIcon size={14} />} inputMode="tel" />
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.wechatId", "WeChat ID")} value={form.wechat_id} onChange={v => setField("wechat_id", v)} placeholder="@handle" icon={<MessageSquareIcon size={14} />} />
                <Input label={t("field.telegramId", "Telegram ID")} value={form.telegram_id} onChange={v => setField("telegram_id", v)} placeholder="@handle" icon={<MessageSquareIcon size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("field.lineId", "Line ID")} value={form.line_id} onChange={v => setField("line_id", v)} placeholder="@handle" icon={<MessageSquareIcon size={14} />} />
                <Input label={t("field.skypeId", "Skype ID")} value={form.skype_id} onChange={v => setField("skype_id", v)} placeholder="live:…" icon={<MessageSquareIcon size={14} />} />
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Internal Notes (customer only — Activity tab) ── */}
        {isCustomer && showTab("activity") && (
          <FormSection title={t("section.internalNotes", "Internal Notes")} icon={<DocumentIcon size={14} />}>
            <textarea
              value={form.internal_notes}
              onChange={e => setField("internal_notes", e.target.value)}
              placeholder={t("placeholder.internalNotes", "Private notes visible only to team members")}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] resize-none"
            />
          </FormSection>
        )}

        {/* ══ SUPPLIER FORM SECTIONS (ordered by priority) ══ */}
        {form.contact_type === "supplier" && (
          <>
            {!supplierDept && <FormGroupLabel label={t("supgroup.identity", "Identity & profile")} />}
            {/* 1. Company Name — Most important, identity of the supplier */}
            <FormSection title={t("section.companyName")} icon={<Building2Icon size={14} />} owner={t("owner.procurement")} ownerLabel={t("owner.label")} dept="procurement" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-3">
                <Input label={t("field.companyNameEn")} value={form.company_name_en} onChange={v => setField("company_name_en", v)} placeholder={t("placeholder.companyNameEn")} icon={<Building2Icon size={14} />} tier="required" invalid={triedSave && !form.company_name_en.trim()} />
                <Input label={t("field.companyNameCn")} tier="optional" value={form.company_name_cn} onChange={v => setField("company_name_cn", v.replace(/[؀-ۿݐ-ݿࢠ-ࣿ]/g, ""))} placeholder={t("placeholder.companyNameCn")} icon={<LanguagesIcon size={14} />} invalid={!!form.company_name_cn.trim() && !hasCJKChars(form.company_name_cn)} />
                {/* Additional Company Names */}
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-2 block">{t("field.additionalNames")}</label>
                  {form.additional_company_names.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <RemoveBtn onClick={() => setField("additional_company_names", form.additional_company_names.filter((_, idx) => idx !== i))} />
                      <input
                        value={entry.language}
                        onChange={e => { const arr = [...form.additional_company_names]; arr[i] = { ...arr[i], language: e.target.value }; setField("additional_company_names", arr); }}
                        placeholder={t("field.language")}
                        className="w-28 h-9 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium outline-none"
                      />
                      <input
                        value={entry.name}
                        onChange={e => { const arr = [...form.additional_company_names]; arr[i] = { ...arr[i], name: e.target.value }; setField("additional_company_names", arr); }}
                        placeholder={t("field.companyName")}

                        className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                      />
                    </div>
                  ))}
                  <AddButton label={t("add.companyName")} onClick={() => setField("additional_company_names", [...form.additional_company_names, { language: "", name: "" }])} />
                </div>
              </div>
            </FormSection>

            {/* 4. Company Profile — Brand, classification, and business identity */}
            <FormSection title={t("section.companyProfile")} icon={<BriefcaseIcon size={14} />} owner={t("owner.procurement")} ownerLabel={t("owner.label")} dept="procurement" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-3">
                {/* Brand Names — controlled tag input with Enter / click-to-add + dedupe */}
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.brand")}</label>
                  <TagInput
                    values={form.brand_names}
                    onChange={(next) => setField("brand_names", next)}
                    placeholder={t("add.brand")}
                    icon={<TagsIcon size={13} />}
                    addLabel={t("btn.add")}
                    duplicateLabel={t("hint.brandAlreadyAdded", "Already added — pick a different name")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={triedSave && !form.division.trim() ? "rounded-lg ring-1 ring-rose-500/60" : undefined}>
                    <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.division")}<FieldMark tier="required" /></label>
                    <TaxonomySelect
                      value={form.division}
                      onChange={v => {
                        setField("division", v);
                        // Clear a known category that no longer belongs to the new division.
                        const div = DIVISIONS.find(d => d.name === v);
                        const cat = CATEGORIES.find(c => c.label === form.category);
                        if (cat && div && divisionOfCategory(cat.code)?.id !== div.id) setField("category", "");
                      }}
                      options={divisionOptions}
                      placeholder={t("field.division")}
                      createLabel={t("create.newDivision", "Create new division")}
                    />
                  </div>
                  <div className={triedSave && !form.category.trim() ? "rounded-lg ring-1 ring-rose-500/60" : undefined}>
                    <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.category")}<FieldMark tier="required" /></label>
                    <TaxonomySelect value={form.category} onChange={v => setField("category", v)} options={categoryOptions} placeholder={form.division ? t("field.category") : t("placeholder.pickDivisionFirst", "Pick a division first")} createLabel={t("create.newCategory", "Create new category")} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectInput label={t("field.industry")} tier="optional" value={form.industry} onChange={v => setField("industry", v)} options={INDUSTRIES} icon={<FactoryIcon size={14} />} renderLabel={tOpt} selectLabel={t("detail.select")} />
                  <SelectInput label={t("field.source")} tier="optional" value={form.source} onChange={v => setField("source", v)} options={SUPPLIER_SOURCES} icon={<TargetIcon size={14} />} renderLabel={tOpt} selectLabel={t("detail.select")} />
                </div>
                <Input label={t("field.supplierProfileUrl", "Platform profile link")} tier="optional" type="url" value={form.supplier_profile_url} onChange={v => setField("supplier_profile_url", v)} placeholder={t("placeholder.supplierProfileUrl", "Made-in-China / Alibaba / AliExpress profile URL")} icon={<GlobeIcon size={14} />} invalid={!!form.supplier_profile_url.trim() && (/\s/.test(form.supplier_profile_url.trim()) || !/\./.test(form.supplier_profile_url))} />
                {/* Supplier "type" is no longer a separate field — it's the PRIMARY
                    classification (star one in the Classifications section below).
                    On save it mirrors into contacts.supplier_type, so Purchase, the
                    supplier list, seed scripts and readiness keep working unchanged. */}
              </div>
            </FormSection>

            {!supplierDept && <FormGroupLabel label={t("supgroup.communication", "Contacts & communication")} />}
            {/* 2. Contact Details — How to reach the supplier */}
            <FormSection title={t("section.contactDetails")} icon={<PhoneIcon size={14} />} owner={t("owner.procurement")} ownerLabel={t("owner.label")} dept="procurement" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-3">
                <p className="text-[11px] text-[var(--text-dim)]">{t("hint.atLeastOneContact", "At least one of phone / mobile / email is required")} <span className="text-rose-400">*</span></p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <PhoneField label={t("field.contactTel")} value={form.supplier_tel} onChange={v => setField("supplier_tel", v)} placeholder={t("field.contactTel")} defaultIso={form.country_code || "CN"} />
                  <PhoneField label={t("field.contactMobile")} value={form.supplier_mobile} onChange={v => setField("supplier_mobile", v)} placeholder={t("field.contactMobile")} defaultIso={form.country_code || "CN"} />
                </div>
                <Input label={t("field.contactEmail")} type="email" value={form.supplier_email} onChange={v => setField("supplier_email", v)} placeholder="company@example.com" icon={<EnvelopeIcon size={14} />} invalid={!!form.supplier_email.trim() && !RE_EMAIL.test(form.supplier_email.trim())} />
                {/* Additional emails — some companies have more than one */}
                {form.emails.map((em, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="email" inputMode="email" value={em.email} onChange={e => updateEmail(i, "email", e.target.value)} placeholder={t("field.additionalEmail", "Additional email")} aria-invalid={!!(em.email && !RE_EMAIL.test(em.email)) || undefined} className={`w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none ${em.email && !RE_EMAIL.test(em.email) ? "border-rose-500 ring-1 ring-rose-500/30" : "border-[var(--border-color)] focus:border-[var(--border-focus)]"}`} />
                    <RemoveBtn onClick={() => removeEmail(i)} />
                  </div>
                ))}
                <AddButton label={t("field.addEmail", "Add another email")} onClick={addEmail} />
                {/* Website + optional QR (some suppliers share their site as a QR code) */}
                <MessagingIdField
                  label={t("field.website")}
                  icon={<GlobeIcon size={16} />}
                  idValue={form.supplier_website}
                  onIdChange={v => setField("supplier_website", v)}
                  placeholder="https://www.example.com"
                  qrValue={form.supplier_website_qr}
                  onQrChange={v => setField("supplier_website_qr", v)}
                />
                {/* Additional websites — companies sometimes run more than one site */}
                {form.websites.map((w, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" value={w.url} onChange={e => updateWebsite(i, "url", e.target.value)} placeholder={t("field.additionalWebsite", "Additional website")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                    <RemoveBtn onClick={() => removeWebsite(i)} />
                  </div>
                ))}
                <AddButton label={t("field.addWebsite", "Add another website")} onClick={addWebsite} />
                {/* E-catalog link + optional QR */}
                <MessagingIdField
                  label={t("field.ecatalog", "E-catalog")}
                  icon={<CatalogsIcon size={16} />}
                  idValue={form.ecatalog_url}
                  onIdChange={v => setField("ecatalog_url", v)}
                  placeholder={t("placeholder.ecatalog", "E-catalog link (or scan QR)")}
                  qrValue={form.ecatalog_qr}
                  onQrChange={v => setField("ecatalog_qr", v)}
                />
                {/* Business hours + time zone */}
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] p-3 space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("field.businessHours", "Business hours & time zone")}</p>
                  <Input label={t("field.timeZone", "Time zone / area")} tier="optional" value={form.business_timezone} onChange={v => setField("business_timezone", v)} placeholder={t("placeholder.timeZone", "e.g. Asia/Shanghai (GMT+8)")} icon={<GlobeIcon size={14} />} list="sup-timezone-opts" />
                  <ComboOptions id="sup-timezone-opts" options={TIMEZONE_OPTS} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <TimeField label={t("field.hoursFrom", "Open from")} tier="optional" value={form.business_hours_start} onChange={v => setField("business_hours_start", v)} />
                    <TimeField label={t("field.hoursTo", "Open until")} tier="optional" value={form.business_hours_end} onChange={v => setField("business_hours_end", v)} />
                  </div>
                </div>
                {/* Address — structured like a standard postal address:
                    street line → country → province/state → city + postal code. */}
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] p-3 space-y-2.5">
                  {/* AMap (高德) address lookup — China-friendly, no VPN. Self-hides
                      until AMAP_WEB_KEY is configured. Fills the Chinese address +
                      city + province so the address can't be mismatched (report D). */}
                  <AddressAutocomplete
                    label={t("field.addressLookup", "Find address (AMap / 高德)")}
                    placeholder={t("placeholder.addressLookup", "Search a Chinese address or place…")}
                    hint={t("hint.addressLookup", "Auto-fills Chinese street · city · province")}
                    onSelect={(r) => {
                      if (r.formatted) setField("supplier_address_cn", r.formatted);
                      if (r.city) setField("city", r.city);
                      if (r.province) setField("province", r.province);
                    }}
                  />
                  <Input label={t("field.streetAddressEn", "Street address (English)")} tier="preferred" value={form.supplier_address} onChange={v => setField("supplier_address", v)} placeholder={t("placeholder.street", "Street, building, unit…")} icon={<MapPinIcon size={14} />} autoComplete="street-address" />
                  <Input label={t("field.streetAddressCn", "Street address (Chinese)")} tier="preferred" value={form.supplier_address_cn} onChange={v => setField("supplier_address_cn", v)} placeholder={t("placeholder.streetCn", "街道、楼宇、单元…")} icon={<MapPinIcon size={14} />} />
                  <div className={triedSave && !form.country.trim() ? "rounded-lg ring-1 ring-rose-500/60" : undefined}>
                    <CountryDropdown value={form.country_code} displayValue={form.country} onChange={handleCountryChange} label={t("field.country")} placeholder={t("field.searchCountry")} noResults={t("detail.noCountries")} />
                  </div>
                  {form.country_code && hasStates && (
                    <ProvinceDropdown countryCode={form.country_code} value={form.province_code} displayValue={form.province} onChange={handleProvinceChange} label={t("field.provinceState")} placeholder={t("field.searchProvince")} noResults={t("detail.noProvinces")} />
                  )}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {showCity ? (
                      <CityDropdown countryCode={form.country_code} stateCode={form.province_code} value={form.city} onChange={handleCityChange} label={t("field.city")} placeholder={t("field.searchCity")} noResults={t("detail.noCities")} />
                    ) : (
                      <Input label={t("field.city")} value={form.city} onChange={v => setField("city", v)} placeholder={t("placeholder.city", "City")} autoComplete="address-level2" />
                    )}
                    <Input label={t("field.postalCode", "Postal / ZIP code")} value={form.supplier_postal_code} onChange={v => setField("supplier_postal_code", v)} placeholder={t("placeholder.zipCode", "Postal / ZIP code")} autoComplete="postal-code" />
                  </div>
                </div>
              </div>
            </FormSection>

            {/* 3. Contact Persons — Key people to communicate with */}
            <FormSection title={t("section.contactPersons")} kxComponent="ContactPersonsFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Contacts & communication" icon={<UsersIcon size={14} />} owner={t("owner.procurement")} ownerLabel={t("owner.label")} dept="procurement" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-3">
                <p className="text-[11px] text-[var(--text-dim)]">{t("hint.atLeastOnePerson", "Contact persons (optional)")}</p>
                {form.contact_persons.map((cp, i) => (
                  <div key={i} className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] overflow-hidden">
                    <div className="flex items-center gap-2 p-3">
                      <RemoveBtn onClick={() => {
                        setField("contact_persons", form.contact_persons.filter((_, idx) => idx !== i));
                        // Keep the single-accordion state (band 1000+) pointing at the
                        // correct row after the array re-indexes — otherwise deleting an
                        // earlier person leaves a different person's panel expanded.
                        setExpandedFamily(prev => prev == null ? prev : prev === 1000 + i ? null : (prev > 1000 + i && prev < 2000 ? prev - 1 : prev));
                      }} />
                      <input
                        value={cp.name}
                        onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], name: e.target.value }; setField("contact_persons", arr); }}
                        placeholder={t("field.nameEn", "English name")}
                        className="min-w-0 flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                      />
                      <input
                        value={cp.name_cn ?? ""}
                        onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], name_cn: e.target.value }; setField("contact_persons", arr); }}
                        placeholder={t("field.nameCn", "中文名 / Chinese name")}
                        className="min-w-0 flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                      />
                      <button
                        onClick={() => setExpandedFamily(expandedFamily === 1000 + i ? null : 1000 + i)}
                        className="w-8 h-8 shrink-0 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <AngleDownIcon size={14} className={`transition-transform ${expandedFamily === 1000 + i ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    {expandedFamily === 1000 + i && (
                      <div className="px-3 pb-3 pt-1 ms-8 space-y-2 border-t border-[var(--border-faint)]">
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input value={cp.position} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], position: e.target.value }; setField("contact_persons", arr); }} placeholder={t("placeholder.positionsMulti", "Position(s) — comma-separated")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                          <input value={cp.department} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], department: e.target.value }; setField("contact_persons", arr); }} placeholder={t("placeholder.departmentsMulti", "Department(s) — comma-separated")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                        </div>
                        {((cp.position || "").includes(",") || (cp.department || "").includes(",")) && (
                          <div className="flex flex-wrap gap-1">
                            {[...(cp.position || "").split(","), ...(cp.department || "").split(",")].map(s => s.trim()).filter(Boolean).map((tag, ti) => (
                              <span key={ti} className="inline-flex items-center rounded-full bg-[var(--bg-surface-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">{tag}</span>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <input type="tel" inputMode="tel" autoComplete="tel" value={cp.phone} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], phone: sanPhone(e.target.value) }; setField("contact_persons", arr); }} placeholder={t("field.phone")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                          <input type="tel" inputMode="tel" autoComplete="tel" value={cp.mobile} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], mobile: sanPhone(e.target.value) }; setField("contact_persons", arr); }} placeholder={t("field.contactMobile")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                        </div>
                        <input type="email" inputMode="email" autoComplete="email" value={cp.email} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], email: e.target.value }; setField("contact_persons", arr); }} placeholder={t("field.email")} aria-invalid={!!(cp.email && !RE_EMAIL.test(cp.email)) || undefined} className={`w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none ${cp.email && !RE_EMAIL.test(cp.email) ? "border-rose-500 ring-1 ring-rose-500/30" : "border-[var(--border-color)]"}`} />
                        <input type="tel" inputMode="tel" autoComplete="tel" value={cp.whatsapp ?? ""} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], whatsapp: sanPhone(e.target.value) }; setField("contact_persons", arr); }} placeholder={t("field.whatsappBusiness", "WhatsApp")} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                        <MessagingIdField
                          label={t("field.wechat", "WeChat")}
                          icon={<BrandGlyph name="WeChat" size={15} />}
                          idValue={cp.wechat_id ?? ""}
                          onIdChange={v => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], wechat_id: v }; setField("contact_persons", arr); }}
                          placeholder={t("placeholder.wechatId", "WeChat ID / handle")}
                          qrValue={cp.wechat_qr ?? ""}
                          onQrChange={v => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], wechat_qr: v }; setField("contact_persons", arr); }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={cp.telegram ?? ""} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], telegram: e.target.value }; setField("contact_persons", arr); }} placeholder={t("field.telegram", "Telegram")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                          <input value={cp.wecom_id ?? ""} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], wecom_id: e.target.value }; setField("contact_persons", arr); }} placeholder={t("field.wecom", "WeCom")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                          <input value={cp.line_id ?? ""} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], line_id: e.target.value }; setField("contact_persons", arr); }} placeholder={t("field.line", "LINE")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                          <input value={cp.skype_id ?? ""} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], skype_id: e.target.value }; setField("contact_persons", arr); }} placeholder={t("field.skype", "Skype")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <SelectInput label={t("field.roleCategory", "Role category")} value={cp.role_category ?? ""} onChange={v => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], role_category: v }; setField("contact_persons", arr); }} options={CONTACT_ROLE_CATEGORIES} renderLabel={tOpt} selectLabel={t("detail.select")} />
                          <SelectInput label={t("field.reliability", "Reliability")} value={cp.reliability ?? ""} onChange={v => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], reliability: v }; setField("contact_persons", arr); }} options={CONTACT_RELIABILITY} renderLabel={tOpt} selectLabel={t("detail.select")} />
                          <SelectInput label={t("field.preferredChannel", "Preferred channel")} value={cp.preferred_channel ?? ""} onChange={v => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], preferred_channel: v }; setField("contact_persons", arr); }} options={CONTACT_CHANNELS} renderLabel={tOpt} selectLabel={t("detail.select")} />
                          <SelectInput label={t("field.responseSpeed", "Response speed")} value={cp.response_speed ?? ""} onChange={v => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], response_speed: v }; setField("contact_persons", arr); }} options={CONTACT_RESPONSE_SPEEDS} renderLabel={tOpt} selectLabel={t("detail.select")} />
                          <SelectInput label={t("field.preferredLanguage", "Preferred language")} value={cp.preferred_language ?? ""} onChange={v => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], preferred_language: v }; setField("contact_persons", arr); }} options={CONTACT_LANGUAGES} renderLabel={tOpt} selectLabel={t("detail.select")} />
                          <SelectInput label={t("field.timezone", "Timezone")} value={cp.timezone ?? ""} onChange={v => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], timezone: v }; setField("contact_persons", arr); }} options={TIMEZONES} selectLabel={t("detail.select")} />
                        </div>
                        {(() => {
                          const parts = (cp.available_hours ?? "").split(/[–-]/);
                          const from = (parts[0] || "").trim();
                          const to = (parts[1] || "").trim();
                          const setHours = (f: string, tt: string) => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], available_hours: (f || tt) ? `${f}–${tt}` : "" }; setField("contact_persons", arr); };
                          const cls = "h-9 flex-1 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";
                          return (
                            <div>
                              <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.availableHours", "Available hours")} {cp.timezone ? <span className="text-[var(--text-dim)]">({cp.timezone})</span> : null}</label>
                              <div className="flex items-center gap-2">
                                <input type="time" value={from} onChange={e => setHours(e.target.value, to)} aria-label={t("field.fromTime", "From")} className={cls} />
                                <span className="text-[var(--text-dim)]">–</span>
                                <input type="time" value={to} onChange={e => setHours(from, e.target.value)} aria-label={t("field.toTime", "To")} className={cls} />
                              </div>
                            </div>
                          );
                        })()}
                        <ImageDropField
                          label={t("field.contactIdUpload", "ID / business card (image or QR)")}
                          value={cp.id_image || ""}
                          onChange={v => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], id_image: v }; setField("contact_persons", arr); }}
                          hint={t("hint.contactIdUpload", "Drop the ID card, badge, or QR — PNG / JPG")}
                          icon={<FileCheckIcon size={14} />}
                        />
                        <textarea value={cp.notes} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], notes: e.target.value }; setField("contact_persons", arr); }} placeholder={t("field.notes")} rows={2} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none resize-none" />
                        <div className="flex flex-wrap gap-4 text-sm text-[var(--text-muted)]">
                          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!cp.is_primary} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], is_primary: e.target.checked }; setField("contact_persons", arr); }} className="accent-[var(--bg-inverted)]" />{t("field.isPrimaryContact", "Primary contact")}</label>
                          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!cp.is_decision_maker} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], is_decision_maker: e.target.checked }; setField("contact_persons", arr); }} className="accent-[var(--bg-inverted)]" />{t("field.isDecisionMaker", "Decision maker")}</label>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <AddButton label={t("add.contactPerson")} onClick={() => setField("contact_persons", [...form.contact_persons, { name: "", name_cn: "", position: "", department: "", phone: "", mobile: "", email: "", notes: "", whatsapp: "", wechat_id: "", wechat_qr: "" }])} />
              </div>
            </FormSection>

            {/* Messaging IDs — how the team reaches an overseas factory.
                Each channel takes an ID/handle and/or a QR image (drag-drop,
                PNG/JPG). WeChat is the primary channel for China sourcing. */}
            <FormSection title={t("section.messagingIds", "Messaging IDs")} icon={<MessageSquareIcon size={14} />} owner={t("owner.procurement")} ownerLabel={t("owner.label")} dept="procurement" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-3">
                <p className="text-[11px] text-[var(--text-dim)]">{t("hint.atLeastOneMessaging", "Messaging channel (optional)")}</p>
                <MessagingIdField
                  hero
                  label={t("field.wechat", "WeChat")}
                  icon={<BrandGlyph name="WeChat" size={15} />}
                  idValue={form.wechat_id}
                  onIdChange={v => setField("wechat_id", v)}
                  placeholder={t("placeholder.wechatId", "WeChat ID / handle")}
                  qrValue={form.wechat_qr}
                  onQrChange={v => setField("wechat_qr", v)}
                />
                {/* Company-level WeChat presence — official account, sales group, WeCom.
                    (Per-contact WeChat IDs live in Contact Persons; WeChat Pay lives in Payment —
                    they're different concepts, so they stay in their own sections.) */}
                <div className="space-y-2.5 border-t border-[var(--border-color)] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("subsection.wechatPresence", "WeChat presence")}</p>
                  <MessagingIdField
                    label={t("field.wechatOfficialAccount", "WeChat Official Account")}
                    icon={<BrandGlyph name="WeChat" size={16} />}
                    idValue={form.wechat_official_account}
                    onIdChange={v => setField("wechat_official_account", v)}
                    placeholder={t("placeholder.wechatOfficial", "Official Account name / ID")}
                    qrValue={form.wechat_official_account_qr}
                    onQrChange={v => setField("wechat_official_account_qr", v)}
                  />
                  <div className="flex flex-wrap gap-4 text-sm text-[var(--text-muted)] pt-0.5">
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!form.wechat_sales_group_available} onChange={e => setField("wechat_sales_group_available", e.target.checked)} className="accent-[var(--bg-inverted)]" />{t("field.wechatGroupAvailable", "WeChat group available")}</label>
                    {form.wechat_sales_group_available && (
                      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] p-3 space-y-2.5 mt-1">
                        <Input
                          label={t("field.wechatGroupName", "WeChat group name")}
                          value={form.wechat_group_name}
                          onChange={v => setField("wechat_group_name", v)}
                          placeholder={t("placeholder.wechatGroupName", "e.g. Koleex × Supplier — Sales")}
                          icon={<BrandGlyph name="WeChat" size={14} />}
                        />
                        <MultiReasonField
                          label={t("field.wechatGroupMembers", "Group members (from your team)")}
                          value={form.wechat_group_members}
                          onChange={v => setField("wechat_group_members", v)}
                          placeholder={accountNames.length ? t("placeholder.wechatMembers", "Pick a teammate or type a name") : t("placeholder.wechatMembersEmpty", "Type a name")}
                          options={accountNames}
                          icon={<UsersIcon size={14} />}
                          datalistId="sup-wechat-members-opts"
                        />
                      </div>
                    )}
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!form.wecom_support_available} onChange={e => setField("wecom_support_available", e.target.checked)} className="accent-[var(--bg-inverted)]" />{t("field.wecomSupport", "WeCom support")}</label>
                  </div>
                </div>
                {/* Other apps — pick the app and add as many as needed (same grammar as Social Media). */}
                <div className="space-y-2.5 border-t border-[var(--border-color)] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("subsection.otherMessagingApps", "Other apps")}</p>
                  {form.messaging_channels.length === 0 && (
                    <p className="text-[11px] text-[var(--text-faint)]">{t("hint.messagingApps", "Add other apps the factory uses — pick the app, then enter the ID / handle / number.")}</p>
                  )}
                  {form.messaging_channels.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <RemoveBtn onClick={() => setField("messaging_channels", form.messaging_channels.filter((_, idx) => idx !== i))} />
                      <div className="w-36 shrink-0 sm:w-44">
                        <PlatformSelect value={m.platform} onChange={v => { const arr = [...form.messaging_channels]; arr[i] = { ...arr[i], platform: v }; setField("messaging_channels", arr); }} options={MESSAGING_APPS} />
                      </div>
                      <input
                        value={m.value}
                        onChange={e => { let val = e.target.value; if (m.platform === "QQ") val = val.replace(/[^0-9]/g, "").slice(0, 12); else if (m.platform === "WhatsApp") val = sanPhone(val); const arr = [...form.messaging_channels]; arr[i] = { ...arr[i], value: val }; setField("messaging_channels", arr); }}
                        placeholder={t("placeholder.messagingId", "ID, handle, or number")}
                        className="min-w-0 flex-1 h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                      />
                    </div>
                  ))}
                  <AddButton label={t("add.messagingApp", "Add messaging app")} onClick={() => setField("messaging_channels", [...form.messaging_channels, { platform: MESSAGING_APPS.find(a => a !== "Other" && !form.messaging_channels.some(m => m.platform === a)) || "Other", value: "" }])} />
                </div>
              </div>
            </FormSection>

            {/* Social profiles & marketplaces — LinkedIn / Facebook / Alibaba etc.
                (Company WeChat presence now lives in the Messaging IDs section so all
                WeChat info is in one place.) Grouped with the other comms sections. */}
            <FormSection title={t("section.socialMedia", "Social Media")} icon={<Share2Icon size={14} />} owner={t("owner.marketing")} ownerLabel={t("owner.label")} dept="general" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-2.5">
                {form.social_profiles.length === 0 && (
                  <p className="text-[11px] text-[var(--text-faint)]">{t("hint.socialMedia", "Add the factory's social pages — paste a link, page, or @account.")}</p>
                )}
                {form.social_profiles.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <RemoveBtn onClick={() => removeSocial(i)} />
                    <div className="w-36 shrink-0 sm:w-44">
                      <PlatformSelect value={s.platform} onChange={v => updateSocial(i, "platform", v)} options={SOCIAL_MEDIA_PLATFORMS} />
                    </div>
                    <input
                      value={s.url}
                      onChange={e => updateSocial(i, "url", e.target.value)}
                      placeholder={t("placeholder.socialLink", "Link, page, or @account")}
                      className="min-w-0 flex-1 h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                    />
                  </div>
                ))}
                <AddButton label={t("add.socialAccount", "Add social account")} onClick={() => setField("social_profiles", [...form.social_profiles, { platform: "LinkedIn", username: "", url: "", qr_code_url: "" }])} />
              </div>
            </FormSection>

            {/* Classifications — pick what describes this supplier, star one as primary */}
            <FormSection title={t("section.classifications", "Classifications")} icon={<TagsIcon size={14} />} owner={t("owner.procurement")} ownerLabel={t("owner.label")} dept="procurement" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-3">
                {/* Header: helper text + selected count + primary chip */}
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11.5px] leading-relaxed text-[var(--text-dim)] flex-1">
                    {t("hint.classifications", "Pick everything that describes this supplier. Star one as the primary type.")}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-semibold bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                      {sIntel.classifications.length}
                    </span>
                    <span className="text-[10.5px] uppercase tracking-wider text-[var(--text-faint)]">{t("classifications.selected", "selected")}</span>
                  </div>
                </div>

                {/* Selected summary strip with primary star — only when something is selected */}
                {sIntel.classifications.length > 0 && (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {sIntel.classifications.map((k) => {
                        const isPrimary = sIntel.primary_class === k;
                        return (
                          <span key={k} className={`inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-[11px] font-medium border transition-colors ${isPrimary ? "bg-[var(--accent,#0066FF)] text-white border-transparent" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]"}`}>
                            {isPrimary && <StarIcon size={10} className="opacity-90" />}
                            {t("opt." + k, CLASSIFICATION_LABELS[k as keyof typeof CLASSIFICATION_LABELS] ?? k)}
                            {sIntel.classifications.length > 1 && !isPrimary && (
                              <button
                                type="button"
                                title={t("action.makePrimary", "Make primary")}
                                onClick={() => setSIntel((p) => ({ ...p, primary_class: k }))}
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--accent,#0066FF)] transition-colors"
                                aria-label={t("action.makePrimary", "Make primary")}
                              >
                                <StarIcon size={10} />
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Picker grid — 3 columns on desktop, 2 on tablet, 1 on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                  {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => {
                    const on = sIntel.classifications.includes(k);
                    const isPrimary = on && sIntel.primary_class === k;
                    return (
                      <button
                        type="button"
                        key={k}
                        onClick={() => toggleIntelClass(k)}
                        className={`group relative flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all ${
                          on
                            ? "bg-[var(--bg-surface)] border-[var(--accent,#0066FF)]/40 text-[var(--text-primary)] shadow-[0_0_0_1px_var(--accent,#0066FF)_inset]"
                            : "bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {/* Check / empty indicator */}
                        <span className={`flex items-center justify-center w-4 h-4 rounded-md border shrink-0 transition-colors ${on ? "bg-[var(--accent,#0066FF)] border-transparent text-white" : "border-[var(--border-color)] text-transparent group-hover:border-[var(--border-focus)]"}`}>
                          {on && <CheckIcon size={10} />}
                        </span>
                        <span className="flex-1 text-[12px] font-medium leading-tight">
                          {t("opt." + k, v)}
                        </span>
                        {isPrimary && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--accent,#0066FF)]/15 text-[var(--accent,#0066FF)]" title={t("field.primary", "Primary")}>
                            <StarIcon size={11} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Empty hint when nothing is picked */}
                {sIntel.classifications.length === 0 && (
                  <p className="text-[11px] text-[var(--text-faint)] italic">
                    {t("hint.noClassifications", "Tip: at least one classification helps the team route this supplier correctly.")}
                  </p>
                )}
              </div>
            </FormSection>

            {!supplierDept && <FormGroupLabel label={t("supgroup.commercial", "Commercial & logistics")} />}
            {/* Payment — terms + currency + bank accounts + mobile payment (WeChat Pay / Alipay) */}
            <FormSection title={t("section.paymentInfo", "Payment Information")} icon={<LandmarkIcon size={14} />} owner={t("owner.finance")} ownerLabel={t("owner.label")} dept="finance" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-4">
                {/* Terms & currency (merged from the old Payment & Currency section) */}
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("subsection.termsCurrency", "Terms & Currency")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectInput label={t("field.paymentTerms")} tier="preferred" value={form.payment_terms} onChange={v => setField("payment_terms", v)} options={PAYMENT_TERMS_OPTIONS} icon={<ReceiptIcon size={14} />} renderLabel={tOpt} selectLabel={t("detail.select")} />
                    <SelectInput label={t("field.currency")} tier="preferred" value={form.currency} onChange={v => setField("currency", v)} options={CURRENCIES} icon={<DollarSignIcon size={14} />} selectLabel={t("detail.select")} />
                  </div>
                  <textarea value={form.payment_info} onChange={e => setField("payment_info", e.target.value)} placeholder={t("placeholder.bankTransfer")} rows={2} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none resize-none focus:border-[var(--border-focus)]" />
                </div>
                <div className="space-y-3 border-t border-[var(--border-color)] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("subsection.bankAccounts", "Bank Accounts")}</p>
                  {form.bank_accounts.map((bank, i) => (
                    <div key={i} className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <RemoveBtn onClick={() => setField("bank_accounts", form.bank_accounts.filter((_, idx) => idx !== i))} />
                        <span className="text-xs text-[var(--text-subtle)] font-medium">{t("misc.account")} {i + 1}</span>
                      </div>
                      <div className="space-y-2 ms-8">
                        <div className="grid grid-cols-2 gap-2">
                          <input value={bank.bank_name} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], bank_name: e.target.value }; setField("bank_accounts", arr); }} placeholder={t("field.bankName")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                          <input value={bank.account_name} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], account_name: e.target.value }; setField("bank_accounts", arr); }} placeholder={t("field.accountName")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                        </div>
                        <input value={bank.account_number} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], account_number: e.target.value }; setField("bank_accounts", arr); }} placeholder={t("field.accountNumber")} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={bank.swift_code} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], swift_code: e.target.value }; setField("bank_accounts", arr); }} placeholder={t("field.swiftCode")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                          <input value={bank.iban} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], iban: e.target.value }; setField("bank_accounts", arr); }} placeholder={t("field.iban")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={bank.branch} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], branch: e.target.value }; setField("bank_accounts", arr); }} placeholder={t("field.branch")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                          <input value={bank.currency} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], currency: e.target.value }; setField("bank_accounts", arr); }} placeholder={t("field.currency")} className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                        </div>
                        <ImageDropField
                          label={t("field.bankInfoPhoto", "Bank info photo")}
                          value={bank.info_image || ""}
                          onChange={v => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], info_image: v }; setField("bank_accounts", arr); }}
                          hint={t("hint.bankInfoPhoto", "Company sent bank details as an image? Drop it here — PNG / JPG")}
                          icon={<LandmarkIcon size={14} />}
                        />
                      </div>
                    </div>
                  ))}
                  <AddButton label={t("add.bankAccount")} onClick={() => setField("bank_accounts", [...form.bank_accounts, { bank_name: "", account_name: "", account_number: "", swift_code: "", iban: "", branch: "", currency: "" }])} />
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("subsection.mobilePayment", "Mobile Payment")}</p>
                  <MessagingIdField
                    label="WeChat Pay"
                    icon={<BrandGlyph name="WeChat" size={16} />}
                    idValue={form.wechat_pay_id}
                    onIdChange={v => setField("wechat_pay_id", v)}
                    placeholder={t("placeholder.wechatPayId", "WeChat Pay ID / name")}
                    qrValue={form.wechat_pay_qr}
                    onQrChange={v => setField("wechat_pay_qr", v)}
                  />
                  <MessagingIdField
                    label="Alipay"
                    icon={<BrandGlyph name="Alipay" size={16} />}
                    idValue={form.alipay_id}
                    onIdChange={v => setField("alipay_id", v)}
                    placeholder={t("placeholder.alipayId", "Alipay account / name")}
                    qrValue={form.alipay_qr}
                    onQrChange={v => setField("alipay_qr", v)}
                  />
                </div>
              </div>
            </FormSection>

            {/* Logistics & Trade — shipping terms a buyer needs at a glance */}
            <FormSection title={t("section.logisticsTrade", "Logistics & Trade")} icon={<TruckIcon size={14} />} owner={t("owner.logistics")} ownerLabel={t("owner.label")} dept="logistics" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <SelectInput label={t("field.incoterms", "Incoterms")} help="supplier.incoterms" tier="preferred" value={form.incoterms} onChange={v => setField("incoterms", v)} options={INCOTERMS} icon={<ShipIcon size={14} />} selectLabel={t("detail.select")} />
                  <><Input label={t("field.leadTime", "Lead Time")} help="supplier.lead_time" tier="preferred" value={form.lead_time} onChange={v => setField("lead_time", v)} placeholder="e.g. 30 days" icon={<TimerIcon size={14} />} list="sup-leadtime-opts" /><ComboOptions id="sup-leadtime-opts" options={LEAD_TIME_OPTS} /></>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <><Input label={t("field.moq", "MOQ")} help="supplier.moq" tier="preferred" value={form.moq} onChange={v => setField("moq", v)} placeholder="Minimum order qty" icon={<PackageIcon size={14} />} list="sup-moq-opts" /><ComboOptions id="sup-moq-opts" options={MOQ_OPTS} /></>
                  <SelectInput label={t("field.containerPreference", "Container Preference")} help="supplier.container_preference" tier="optional" value={form.container_preference} onChange={v => setField("container_preference", v)} options={CONTAINER_PREFERENCES} icon={<BoxesIcon size={14} />} selectLabel={t("detail.select")} />
                </div>
                <Input label={t("field.portOfEntry", "Port of Loading / Entry")} help="supplier.port_of_entry" tier="optional" value={form.port_of_entry} onChange={v => setField("port_of_entry", v)} placeholder="Shanghai / Ningbo / Jebel Ali" icon={<ShipIcon size={14} />} />
              </div>
            </FormSection>

            {!supplierDept && <FormGroupLabel label={t("supgroup.production", "Products & production")} />}
            {/* Factory */}
            <FormSection title={t("section.factory", "Factory")} icon={<FactoryIcon size={14} />} owner={t("owner.sourcingQuality")} ownerLabel={t("owner.label")} dept="quality" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t("field.factoryName", "Factory name")} help="supplier.factory_name" value={String(sIntel.factory.factory_name)} onChange={(v) => setIntelFactory("factory_name", v)} icon={<FactoryIcon size={14} />} />
                  <SelectInput label={t("field.factoryType", "Factory type")} help="supplier.factory_type" value={String(sIntel.factory.factory_type)} onChange={(v) => setIntelFactory("factory_type", v)} options={Object.keys(FACTORY_TYPE_LABELS)} renderLabel={(o) => t("opt." + o, FACTORY_TYPE_LABELS[o] ?? o)} selectLabel={t("detail.select")} />
                  <Input label={t("field.productionLines", "Production lines")} help="supplier.production_lines" value={String(sIntel.factory.production_lines)} onChange={(v) => setIntelFactory("production_lines", v)} inputMode="numeric" placeholder="e.g. 12" />
                  <Input label={t("field.monthlyCapacity", "Monthly capacity")} help="supplier.monthly_capacity" value={String(sIntel.factory.monthly_capacity)} onChange={(v) => setIntelFactory("monthly_capacity", v)} placeholder="e.g. 50,000 units" />
                  <Input label={t("field.annualOutput", "Annual output")} help="supplier.annual_output" value={String(sIntel.factory.annual_output)} onChange={(v) => setIntelFactory("annual_output", v)} placeholder="e.g. 600,000 units" />
                  <Input label={t("field.factorySize", "Factory size (sqm)")} help="supplier.factory_size" value={String(sIntel.factory.factory_size_sqm)} onChange={(v) => setIntelFactory("factory_size_sqm", v)} inputMode="numeric" placeholder="e.g. 8000" />
                  <Input label={t("field.employees", "Employees")} help="supplier.employees" value={String(sIntel.factory.employee_count)} onChange={(v) => setIntelFactory("employee_count", v)} inputMode="numeric" placeholder="e.g. 250" />
                  <Input label={t("field.qcStaff", "QC staff")} help="supplier.qc_staff" value={String(sIntel.factory.qc_staff_count)} onChange={(v) => setIntelFactory("qc_staff_count", v)} inputMode="numeric" placeholder="e.g. 15" />
                  <Input label={t("field.rdStaff", "R&D staff")} help="supplier.rd_staff" value={String(sIntel.factory.rd_staff_count)} onChange={(v) => setIntelFactory("rd_staff_count", v)} inputMode="numeric" placeholder="e.g. 8" />
                  <Input label={t("field.exportPct", "Export %")} help="supplier.export_pct" value={String(sIntel.factory.export_percentage)} onChange={(v) => setIntelFactory("export_percentage", v)} inputMode="numeric" placeholder="0–100" />
                  <Input label={t("field.exportMarkets", "Export markets (comma)")} help="supplier.export_markets" value={String(sIntel.factory.main_export_markets)} onChange={(v) => setIntelFactory("main_export_markets", v)} placeholder="US, EU, UAE" />
                  <Input label={t("field.prodCategories", "Production categories (comma)")} help="supplier.production_categories" value={String(sIntel.factory.production_categories)} onChange={(v) => setIntelFactory("production_categories", v)} />
                  <Input label={t("field.supportedMaterials", "Supported materials (comma)")} help="supplier.supported_materials" value={String(sIntel.factory.supported_materials)} onChange={(v) => setIntelFactory("supported_materials", v)} placeholder="Cotton, Polyester, Steel" />
                  <SelectInput label={t("field.capacityUnit", "Capacity unit")} help="supplier.capacity_unit" value={String(sIntel.factory.capacity_unit)} onChange={(v) => setIntelFactory("capacity_unit", v)} options={FACTORY_CAPACITY_UNITS} renderLabel={tOpt} selectLabel={t("detail.select")} />
                  <SelectInput label={t("field.outputUnit", "Output unit")} help="supplier.output_unit" value={String(sIntel.factory.output_unit)} onChange={(v) => setIntelFactory("output_unit", v)} options={FACTORY_OUTPUT_UNITS} renderLabel={tOpt} selectLabel={t("detail.select")} />
                  <Input label={t("field.leadTimeDays", "Lead time (days)")} help="supplier.lead_time_days" value={String(sIntel.factory.lead_time_days)} onChange={(v) => setIntelFactory("lead_time_days", v)} inputMode="numeric" placeholder="e.g. 30" />
                  <Input label={t("field.peakSeasonMonths", "Peak season months (comma)")} help="supplier.peak_season_months" value={String(sIntel.factory.peak_season_months)} onChange={(v) => setIntelFactory("peak_season_months", v)} placeholder="Sep, Oct, Nov" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 flex items-center gap-1">{t("field.factoryVisitDate", "Factory visit date")}<GuidanceTip guidanceId="supplier.factory_visit_date" size="xs" /></label>
                  <DateField value={form.factory_visit_date} onChange={v => setField("factory_visit_date", v)} />
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-[var(--text-muted)]">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!sIntel.factory.odm_supported} onChange={(e) => setIntelFactory("odm_supported", e.target.checked)} className="accent-[var(--bg-inverted)]" />{t("field.odm", "ODM support")}<GuidanceTip guidanceId="supplier.odm" size="xs" /></label>
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!sIntel.factory.private_label_supported} onChange={(e) => setIntelFactory("private_label_supported", e.target.checked)} className="accent-[var(--bg-inverted)]" />{t("field.privateLabel", "Private label")}<GuidanceTip guidanceId="supplier.private_label" size="xs" /></label>
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!sIntel.factory.low_moq_supported} onChange={(e) => setIntelFactory("low_moq_supported", e.target.checked)} className="accent-[var(--bg-inverted)]" />{t("field.lowMoq", "Low MOQ")}<GuidanceTip guidanceId="supplier.low_moq" size="xs" /></label>
                </div>
              </div>
            </FormSection>

            {/* 7. Catalogue */}
            <FormSection title={t("section.catalogue")} icon={<BookOpenIcon size={14} />} owner={t("owner.product")} ownerLabel={t("owner.label")} dept="procurement" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-2">
                {form.catalogues.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)]">
                    <RemoveBtn onClick={() => setField("catalogues", form.catalogues.filter((_, idx) => idx !== i))} />
                    {cat.type === "PDF" ? <DocumentIcon size={14} className="text-red-400 shrink-0" /> : <ImageRawIcon size={14} className="text-blue-400 shrink-0" />}
                    <span className="text-sm text-[var(--text-primary)] truncate flex-1">{cat.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-faint)] font-medium">{cat.type}</span>
                    {cat.url && (
                      <button onClick={() => openFilePreview(cat.url)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[10px] text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors">
                        {cat.type === "PDF" ? <ExternalLinkIcon size={10} /> : <EyeIcon size={10} />} {cat.type === "PDF" ? t("btn.open") : t("btn.preview")}
                      </button>
                    )}
                    {cat.url && (
                      <button onClick={() => downloadFile(cat.url, cat.name)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[10px] text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors">
                        <DownloadIcon size={10} /> {t("btn.download")}
                      </button>
                    )}
                  </div>
                ))}
                <label className="flex items-center gap-2 px-3 py-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-dashed border-[var(--border-color)] hover:border-[var(--border-focus)] cursor-pointer transition-colors">
                  <FilePlusIcon size={14} className="text-[var(--text-faint)]" />
                  <span className="text-xs text-[var(--text-faint)]">{t("photo.uploadCatalogue")}</span>
                  <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const isPdf = file.type === "application/pdf";
                    const existing = form.catalogues;
                    (async () => {
                      // Always upload to Storage (not inline base64) so the catalogue
                      // gets an http URL that syncs to the Catalogs app — images too.
                      const up = await uploadToMediaStorage(file, file.name);
                      const url = up ? up.url : await readFileAsDataURL(file);
                      const item: (typeof existing)[number] = {
                        name: file.name,
                        url,
                        type: isPdf ? "PDF" : (file.type.split("/").pop()?.toUpperCase() || "IMAGE"),
                        uploaded_at: new Date().toISOString(),
                        ...(up?.path ? { storage_path: up.path } : {}),
                      };
                      if (isPdf) {
                        // Render the PDF's first page as the cover so the Catalogs app
                        // (and detail views) show a real cover, not a generic tile.
                        try {
                          const { pdfFirstPageCover } = await import("@/lib/pdf-cover");
                          const cover = await pdfFirstPageCover(file);
                          if (cover) {
                            const cu = await uploadToMediaStorage(cover, `${file.name}.cover.jpg`);
                            if (cu) { item.cover_url = cu.url; item.cover_path = cu.path; }
                          }
                        } catch { /* cover is best-effort */ }
                      } else if (up) {
                        item.cover_url = up.url; // image is its own cover
                      }
                      setField("catalogues", [...existing, item]);
                    })();
                  }} />
                </label>
              </div>
            </FormSection>

            {/* 10. Products (placeholder) */}
            <FormSection title={t("section.products")} icon={<PackageIcon size={14} />} owner={t("owner.product")} ownerLabel={t("owner.label")} dept="procurement" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
                  <PackageIcon size={18} className="text-[var(--text-ghost)]" />
                </div>
                <p className="text-sm text-[var(--text-dim)]">{t("detail.productsPlaceholder")}</p>
              </div>
            </FormSection>

            {/* 9. Quality & Performance */}
            <FormSection title={t("section.qualityPerformance")} icon={<ShieldCheckIcon size={14} />} owner={t("owner.quality")} ownerLabel={t("owner.label")} dept="quality" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.rating")}</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} onClick={() => setField("rating", form.rating === s ? 0 : s)} className="p-0.5 transition-colors">
                        <StarIcon size={22} className={s <= form.rating ? "text-amber-400 fill-amber-400" : "text-[var(--text-whisper)] hover:text-[var(--text-dim)]"} />
                      </button>
                    ))}
                    {form.rating > 0 && <span className="text-xs text-[var(--text-dim)] ms-2">{form.rating}/5</span>}
                  </div>
                </div>
                {/* Reliability is captured as the Risk → Internal score (auto-calculated). */}
                <SelectInput label={t("field.sampleStatus")} tier="optional" value={form.sample_status} onChange={v => setField("sample_status", v)} options={SAMPLE_STATUSES} icon={<PackageIcon size={14} />} renderLabel={tOpt} selectLabel={t("detail.select")} />
                {/* Certifications */}
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.certifications")}</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.certifications.map((cert, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                        {cert}
                        <button onClick={() => setField("certifications", form.certifications.filter((_, idx) => idx !== i))} className="text-emerald-400/50 hover:text-emerald-400"><CrossIcon size={10} /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select onChange={e => { const val = e.target.value; if (val && !form.certifications.includes(val)) setField("certifications", [...form.certifications, val]); e.target.value = ""; }} className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] outline-none cursor-pointer">
                      <option value="" className="bg-[var(--bg-secondary)]">{t("add.certification")}</option>
                      {CERTIFICATIONS_LIST.filter(c => !form.certifications.includes(c)).map(c => <option key={c} value={c} className="bg-[var(--bg-secondary)]">{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.lastQualityIssueDate")}</label>
                  <DateField value={form.last_quality_issue} onChange={v => setField("last_quality_issue", v)} />
                </div>
                {/* Quality issues log — add multiple dated issues, like the Risk list */}
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.qualityIssues", "Quality issues log")}</label>
                  <div className="space-y-2">
                    {form.quality_issues.map((q, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-36 shrink-0">
                          <DateField value={q.date} onChange={v => setField("quality_issues", form.quality_issues.map((x, j) => j === i ? { ...x, date: v } : x))} />
                        </div>
                        <input value={q.note} onChange={e => setField("quality_issues", form.quality_issues.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder={t("placeholder.qualityIssueNote", "What happened?")} className="flex-1 h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                        <button type="button" onClick={() => setField("quality_issues", form.quality_issues.filter((_, j) => j !== i))} aria-label="Remove" className="shrink-0 h-10 w-9 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-400/10 transition-colors"><TrashIcon size={14} /></button>
                      </div>
                    ))}
                    <AddButton label={t("add.qualityIssue", "Add quality issue")} onClick={() => setField("quality_issues", [...form.quality_issues, { date: "", note: "" }])} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.qualityObs")}</label>
                  <textarea value={form.quality_notes} onChange={e => setField("quality_notes", e.target.value)} placeholder={t("placeholder.qualityObs")} rows={3} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none resize-none focus:border-[var(--border-focus)]" />
                </div>
              </div>
            </FormSection>

            {!supplierDept && <FormGroupLabel label={t("supgroup.legal", "Legal & compliance")} />}
            {/* Legal Identity — registration & company profile */}
            <FormSection title={t("section.legalIdentity", "Legal Identity")} kxComponent="LegalIdentityFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Legal & compliance" icon={<Building2Icon size={14} />} owner={t("owner.compliance")} ownerLabel={t("owner.label")} dept="legal" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-3">
                <Input label={t("field.tradingName", "Trading / DBA Name")} tier="optional" value={form.trading_name} onChange={v => setField("trading_name", v)} placeholder={t("placeholder.tradingName", "Doing business as")} icon={<Building2Icon size={14} />} />
                <div className="grid grid-cols-2 gap-3">
                  <SelectInput label={t("field.companyType", "Company Type")} tier="optional" value={form.company_type} onChange={v => setField("company_type", v)} options={COMPANY_TYPES} icon={<BriefcaseIcon size={14} />} selectLabel={t("detail.select")} />
                  <Input label={t("field.businessRegNumber", "Business Registration #")} tier="preferred" value={form.business_registration_number} onChange={v => setField("business_registration_number", v)} placeholder={t("placeholder.regNumber", "CR / Reg #")} icon={<HashtagIcon size={14} />} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectInput label={t("field.registrationCountry", "Registration Country")} tier="optional" value={form.registration_country} onChange={v => setField("registration_country", v)} options={COUNTRY_NAMES} icon={<GlobeIcon size={14} />} selectLabel={t("detail.select")} />
                  <SelectInput label={t("field.yearEstablished", "Year Established")} tier="preferred" value={form.year_established} onChange={v => setField("year_established", v)} options={ESTABLISHED_YEARS} icon={<CalendarRawIcon size={14} />} selectLabel={t("detail.select")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectInput label={t("field.employeeCountRange", "Employee Count")} tier="optional" value={form.employee_count_range} onChange={v => setField("employee_count_range", v)} options={EMPLOYEE_COUNT_RANGES} icon={<UsersIcon size={14} />} selectLabel={t("detail.select")} />
                  <SelectInput label={t("field.annualRevenueRange", "Annual Revenue")} tier="optional" value={form.annual_revenue_range} onChange={v => setField("annual_revenue_range", v)} options={ANNUAL_REVENUE_RANGES} icon={<TrendingUpIcon size={14} />} selectLabel={t("detail.select")} />
                </div>
                <ImageDropField
                  label={t("field.businessLicense", "Business License")}
                  value={form.business_license_image}
                  onChange={v => setField("business_license_image", v)}
                  hint={t("hint.businessLicense", "Drop the company license photo — PNG / JPG")}
                  icon={<FileCheckIcon size={14} />}
                  tier="preferred"
                />
              </div>
            </FormSection>

            {/* Trade & Tax IDs — VAT / customs identifiers */}
            <FormSection title={t("section.tradeIdentifiers", "Trade & Tax IDs")} kxComponent="TradeIdentifiersFormSection" kxModule={filterType === "supplier" ? "Suppliers" : filterType === "customer" ? "Customers" : "Contacts"} kxSection="Legal & compliance" icon={<FileCheckIcon size={14} />} owner={t("owner.compliance")} ownerLabel={t("owner.label")} dept="legal" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t("field.gstNumber", "VAT / GST")} help="supplier.gst_number" tier="optional" value={form.gst_number} onChange={v => setField("gst_number", v)} placeholder="VAT / GST number" icon={<HashtagIcon size={14} />} />
                  <Input label={t("field.crNumber", "CR Number")} help="supplier.cr_number" tier="optional" value={form.cr_number} onChange={v => setField("cr_number", v)} placeholder="Commercial registration" icon={<HashtagIcon size={14} />} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t("field.dunsNumber", "D-U-N-S")} help="supplier.duns_number" tier="optional" value={form.duns_number} onChange={v => setField("duns_number", v)} placeholder="123456789" icon={<HashtagIcon size={14} />} />
                  <Input label={t("field.iec", "Importer / Exporter Code")} help="supplier.iec" tier="optional" value={form.importer_exporter_code} onChange={v => setField("importer_exporter_code", v)} placeholder="IEC code" icon={<HashtagIcon size={14} />} />
                </div>
                <Input label={t("field.customsCode", "Customs Code")} help="supplier.customs_code" tier="optional" value={form.customs_code} onChange={v => setField("customs_code", v)} placeholder="Customs code" icon={<HashtagIcon size={14} />} />
              </div>
            </FormSection>

            {!supplierDept && <FormGroupLabel label={t("supgroup.intelligence", "Intelligence")} />}
            {/* Risk */}
            <FormSection title={t("section.risk", "Risk")} icon={<TriangleWarningIcon size={14} />} owner={t("owner.risk")} ownerLabel={t("owner.label")} dept="commercial" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-4">
                {/* Exposure — how risky the relationship is */}
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("subsection.exposure", "Exposure")}</p>
                  <div className="divide-y divide-[var(--border-color)]">
                    <SegmentedField layout="row" label={t("field.riskLevel", "Risk level")} value={String(sIntel.risk.risk_level)} onChange={(v) => setIntelRisk("risk_level", v)} options={LEVEL4_OPTS} renderLabel={tOpt} polarity="goodLow" />
                    <SegmentedField layout="row" label={t("field.dependencyLevel", "Dependency level")} value={String(sIntel.risk.dependency_level)} onChange={(v) => setIntelRisk("dependency_level", v)} options={LEVEL4_OPTS} renderLabel={tOpt} polarity="goodLow" />
                    <SegmentedField layout="row" label={t("field.geographicRisk", "Geographic / political risk")} value={String(sIntel.risk.geographic_risk)} onChange={(v) => setIntelRisk("geographic_risk", v)} options={LEVEL3_OPTS} renderLabel={tOpt} polarity="goodLow" />
                  </div>
                </div>
                {/* Reliability — how dependable they are */}
                <div className="border-t border-[var(--border-color)] pt-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("subsection.reliability", "Reliability & Trust")}</p>
                  <div className="divide-y divide-[var(--border-color)]">
                    <SegmentedField layout="row" label={t("field.financialStability", "Financial stability")} value={String(sIntel.risk.financial_stability)} onChange={(v) => setIntelRisk("financial_stability", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.deliveryStability", "Delivery stability")} value={String(sIntel.risk.delivery_stability)} onChange={(v) => setIntelRisk("delivery_stability", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.qualityStability", "Quality stability")} value={String(sIntel.risk.quality_stability)} onChange={(v) => setIntelRisk("quality_stability", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.communicationQuality", "Communication quality")} value={String(sIntel.risk.communication_quality)} onChange={(v) => setIntelRisk("communication_quality", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.complianceLevel", "Compliance & certs")} value={String(sIntel.risk.compliance_level)} onChange={(v) => setIntelRisk("compliance_level", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.capacityLevel", "Capacity / scalability")} value={String(sIntel.risk.capacity_level)} onChange={(v) => setIntelRisk("capacity_level", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.trustLevel", "Trust level")} value={String(sIntel.risk.trust_level)} onChange={(v) => setIntelRisk("trust_level", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                  </div>
                </div>
                {/* Overall */}
                <div className="space-y-3 border-t border-[var(--border-color)] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("subsection.overall", "Overall")}</p>
                  <ScoreSlider label={t("field.internalScore", "Internal score (0–100)")} value={String(sIntel.risk.internal_evaluation_score)} onChange={(v) => { setRiskScoreManual(true); setIntelRisk("internal_evaluation_score", v); }} max={100} isAuto={!riskScoreManual} onUseAuto={() => setRiskScoreManual(false)} disabled={!isSuperAdmin} lockedNote={t("field.superAdminOnly", "Super admin only")} />
                  <label className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]"><input type="checkbox" checked={!!sIntel.risk.backup_supplier_exists} onChange={(e) => setIntelRisk("backup_supplier_exists", e.target.checked)} className="accent-[var(--bg-inverted)]" />{t("field.backupExists", "Backup supplier exists")}</label>
                  {(() => {
                    const base = contacts
                      .filter(c => c.contact_type === "supplier" && c.id !== editingId)
                      .map(c => c.display_name || c.company_name_en || c.company_name_cn || "")
                      .filter(Boolean)
                      .sort((a, b) => a.localeCompare(b));
                    // Keep a previously-saved name visible even if that supplier
                    // isn't in the currently-loaded list.
                    const opts = form.backup_supplier_name && !base.includes(form.backup_supplier_name)
                      ? [form.backup_supplier_name, ...base]
                      : base;
                    return (
                      <>
                        <SelectInput
                          label={t("field.backupSupplier", "Which supplier is the backup?")}
                          value={form.backup_supplier_name}
                          onChange={v => setField("backup_supplier_name", v)}
                          options={opts}
                          icon={<TruckIcon size={14} />}
                          selectLabel={t("detail.select")}
                        />
                        {form.backup_supplier_name && !opts.includes(form.backup_supplier_name) && (
                          <p className="text-[11px] text-[var(--text-faint)] -mt-1">{t("field.backupSupplierFreeText", "Saved: {name}").replace("{name}", form.backup_supplier_name)}</p>
                        )}
                      </>
                    );
                  })()}
                  <Input label={t("field.assessmentNotes", "Assessment notes")} value={String(sIntel.risk.assessment_notes)} onChange={(v) => setIntelRisk("assessment_notes", v)} />
                </div>
                {/* Risk items register — specific issues by dimension (operational,
                    financial, strategic, geographic, relationship). */}
                <div className="space-y-3 border-t border-[var(--border-color)] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("subsection.riskItems", "Risk Items")}</p>
                  {sIntel.riskItems.map((ri, i) => (
                    <div key={i} className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] space-y-2">
                      <div className="flex items-center gap-2">
                        <RemoveBtn onClick={() => removeRiskItem(i)} />
                        <input value={ri.title} onChange={e => setRiskItem(i, "title", e.target.value)} placeholder={t("field.riskItemTitle", "Risk title")} className="min-w-0 flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 ms-8">
                        <SelectInput label={t("field.riskDimension", "Dimension")} value={ri.dimension} onChange={v => setRiskItem(i, "dimension", v)} options={RISK_ITEM_DIMS} renderLabel={tOpt} selectLabel={t("detail.select")} />
                        <SelectInput label={t("field.riskSeverity", "Severity")} value={ri.severity} onChange={v => setRiskItem(i, "severity", v)} options={RISK_ITEM_SEVERITY} renderLabel={tOpt} selectLabel={t("detail.select")} />
                        <SelectInput label={t("field.riskStatus", "Status")} value={ri.status} onChange={v => setRiskItem(i, "status", v)} options={RISK_ITEM_STATUS} renderLabel={tOpt} selectLabel={t("detail.select")} />
                      </div>
                      <div className="ms-8 space-y-2">
                        <Input label={t("field.riskDescription", "Description")} value={ri.description} onChange={v => setRiskItem(i, "description", v)} />
                        <Input label={t("field.riskMitigation", "Mitigation")} value={ri.mitigation} onChange={v => setRiskItem(i, "mitigation", v)} />
                      </div>
                    </div>
                  ))}
                  <AddButton label={t("add.riskItem", "Add risk item")} onClick={addRiskItem} />
                </div>
              </div>
            </FormSection>

            {/* Negotiation */}
            <FormSection title={t("section.negotiation", "Negotiation")} icon={<HandCoinsIcon size={14} />} owner={t("owner.commercial")} ownerLabel={t("owner.label")} dept="commercial" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-4">
                {/* Flexibility & terms */}
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("subsection.flexibility", "Flexibility & Terms")}</p>
                  <div className="divide-y divide-[var(--border-color)]">
                    <SegmentedField layout="row" label={t("field.priceFlexibility", "Price flexibility")} value={sIntel.neg.price_flexibility} onChange={(v) => setIntelNeg("price_flexibility", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.moqFlexibility", "MOQ flexibility")} value={sIntel.neg.moq_flexibility} onChange={(v) => setIntelNeg("moq_flexibility", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.paymentFlexibility", "Payment flexibility")} value={sIntel.neg.payment_flexibility} onChange={(v) => setIntelNeg("payment_flexibility", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.leadtimeFlexibility", "Lead-time flexibility")} value={sIntel.neg.leadtime_flexibility} onChange={(v) => setIntelNeg("leadtime_flexibility", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.volumeDiscount", "Volume discounts")} value={sIntel.neg.volume_discount} onChange={(v) => setIntelNeg("volume_discount", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.contractWillingness", "Contract willingness")} value={sIntel.neg.contract_willingness} onChange={(v) => setIntelNeg("contract_willingness", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.negotiationDifficulty", "Negotiation difficulty")} value={sIntel.neg.negotiation_difficulty} onChange={(v) => setIntelNeg("negotiation_difficulty", v)} options={LEVEL3_OPTS} renderLabel={tOpt} polarity="goodLow" />
                    <SegmentedField layout="row" label={t("field.sampleSpeed", "Sample turnaround speed")} value={sIntel.neg.sample_turnaround_speed} onChange={(v) => setIntelNeg("sample_turnaround_speed", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.communicationFlexibility", "Communication flexibility")} value={sIntel.neg.communication_flexibility} onChange={(v) => setIntelNeg("communication_flexibility", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.customizationOpenness", "Customization openness")} value={sIntel.neg.customization_openness} onChange={(v) => setIntelNeg("customization_openness", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                    <SegmentedField layout="row" label={t("field.exclusivityOpenness", "Exclusivity openness")} value={sIntel.neg.exclusivity_openness} onChange={(v) => setIntelNeg("exclusivity_openness", v)} options={LEVEL3_OPTS} renderLabel={tOpt} />
                  </div>
                </div>
                {/* Tactics & leverage (comma-separated lists) */}
                <div className="space-y-3 border-t border-[var(--border-color)] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("subsection.tacticsLeverage", "Tactics & Leverage")}</p>
                  <Input label={t("field.preferredTactics", "Preferred tactics (comma)")} value={sIntel.neg.preferred_tactics} onChange={(v) => setIntelNeg("preferred_tactics", v)} placeholder="Bundle pricing, Annual commitment" />
                  <Input label={t("field.leveragePoints", "Leverage points (comma)")} value={sIntel.neg.leverage_points} onChange={(v) => setIntelNeg("leverage_points", v)} placeholder="High volume, Repeat buyer, Multiple suppliers" />
                </div>
                {/* Overall — score + notes (last, mirrors Risk) */}
                <div className="space-y-3 border-t border-[var(--border-color)] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("subsection.overall", "Overall")}</p>
                  <ScoreSlider label={t("field.negotiationScore", "Negotiation score (0–100)")} value={sIntel.neg.negotiation_score} onChange={(v) => { setNegScoreManual(true); setIntelNeg("negotiation_score", v); }} max={100} isAuto={!negScoreManual} onUseAuto={() => setNegScoreManual(false)} />
                  <Input label={t("field.internalNotes", "Internal notes")} tier="optional" value={sIntel.neg.internal_notes} onChange={(v) => setIntelNeg("internal_notes", v)} />
                </div>
              </div>
            </FormSection>

            {/* Sourcing — manual priority / score override + diversification.
                Moved out of Risk so it stands as its own commercial-intelligence
                section (mirrors the 360° detail view, which has a dedicated Sourcing block). */}
            <FormSection title={t("section.sourcing", "Sourcing")} icon={<TargetIcon size={14} />} owner={t("owner.commercial")} ownerLabel={t("owner.label")} dept="commercial" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label={t("field.sourcingPriority", "Sourcing priority (#)")} value={sIntel.sourcing.sourcing_priority} onChange={(v) => setIntelSourcing("sourcing_priority", v)} inputMode="numeric" placeholder="e.g. 1" />
                  <Input label={t("field.sourcingScoreOverride", "Sourcing score override (0–100)")} value={sIntel.sourcing.sourcing_score_override} onChange={(v) => setIntelSourcing("sourcing_score_override", v)} inputMode="numeric" placeholder="0–100" />
                </div>
                <Input label={t("field.sourcingNotes", "Sourcing notes")} value={sIntel.sourcing.sourcing_notes} onChange={(v) => setIntelSourcing("sourcing_notes", v)} />
                <Input label={t("field.diversificationNote", "Diversification note")} value={sIntel.sourcing.diversification_note} onChange={(v) => setIntelSourcing("diversification_note", v)} />
              </div>
            </FormSection>

            {/* Strategic status */}
            <FormSection title={t("section.strategicStatus", "Strategic Status")} icon={<TargetIcon size={14} />} owner={t("owner.management")} ownerLabel={t("owner.label")} dept="commercial" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label={t("field.strategicStatus", "Strategic status")} tier="preferred" value={sIntel.strategic_status} onChange={(v) => setSIntel((p) => ({ ...p, strategic_status: v }))} options={Object.keys(STRATEGIC_STATUS_LABELS)} renderLabel={(o) => t("opt." + o, STRATEGIC_STATUS_LABELS[o as keyof typeof STRATEGIC_STATUS_LABELS] ?? o)} icon={<TargetIcon size={14} />} selectLabel={t("detail.select")} />
                <MultiReasonField
                  label={t("field.statusReason", "Status reason")}
                  value={sIntel.strategic_status_reason}
                  onChange={(v) => setSIntel((p) => ({ ...p, strategic_status_reason: v }))}
                  placeholder={t("placeholder.statusReason", "Pick a common reason or type your own")}
                  options={STATUS_REASON_SUGGESTIONS.map((s, i) => t(`sreason.${i}`, s))}
                  icon={<TargetIcon size={14} />}
                  datalistId="sup-status-reason-opts"
                />
              </div>
              {/* Q — restricted suppliers must carry a clear warning regardless of score/ratings. */}
              {["blocked", "blacklisted", "suspended", "phasing_out"].includes(sIntel.strategic_status) && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  <p className="text-[11px] leading-relaxed text-rose-600 dark:text-rose-300">
                    {t("field.blockedWarning", "This supplier is {status} — do not source from it regardless of its ratings or internal score. Approvals and new orders should be paused.").replace("{status}", (t("opt." + sIntel.strategic_status, STRATEGIC_STATUS_LABELS[sIntel.strategic_status as keyof typeof STRATEGIC_STATUS_LABELS] ?? sIntel.strategic_status)).toLowerCase())}
                  </p>
                </div>
              )}
            </FormSection>

            {!supplierDept && <FormGroupLabel label={t("supgroup.records", "Records & notes")} />}
            {/* 8. Documents */}
            <FormSection title={t("section.documents")} icon={<PaperclipIcon size={14} />} owner={t("owner.compliance")} ownerLabel={t("owner.label")} dept="legal" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <div className="space-y-2">
                {form.documents.map((doc, i) => (
                  <div key={i} className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] space-y-2">
                    <div className="flex items-center gap-2">
                      <RemoveBtn onClick={() => setField("documents", form.documents.filter((_, idx) => idx !== i))} />
                      {doc.url ? (
                        <>
                          <FileCheckIcon size={14} className="text-blue-400 shrink-0" />
                          <span className="text-xs text-[var(--text-muted)] font-medium truncate">{doc.doc_name || t("misc.untitled")}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-faint)] font-medium ms-auto">{doc.type}</span>
                          <button onClick={() => openFilePreview(doc.url)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[10px] text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors">
                            {doc.type === "PDF" ? <ExternalLinkIcon size={10} /> : <EyeIcon size={10} />} {doc.type === "PDF" ? t("btn.open") : t("btn.preview")}
                          </button>
                          <button onClick={() => downloadFile(doc.url, doc.name)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[10px] text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors">
                            <DownloadIcon size={10} /> {t("btn.download")}
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            value={doc.doc_name}
                            onChange={e => { const arr = [...form.documents]; arr[i] = { ...arr[i], doc_name: e.target.value }; setField("documents", arr); }}
                            placeholder={t("placeholder.docName")}
                            className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                          />
                          <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-subtle)] hover:text-[var(--text-primary)] cursor-pointer transition-colors shrink-0">
                            <PaperclipIcon size={12} /> {t("btn.upload")}
                            <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const isPdf = file.type === "application/pdf";
                                const handler = isPdf ? uploadFileToStorage(file) : compressImage(file, 1200, 0.8);
                                handler.then(url => {
                                  const arr = [...form.documents];
                                  arr[i] = { ...arr[i], name: file.name, url, type: isPdf ? "PDF" : file.type.split("/").pop()?.toUpperCase() || "FILE", uploaded_at: new Date().toISOString() };
                                  setField("documents", arr);
                                });
                              }
                            }} />
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <AddButton label={t("add.document")} onClick={() => setField("documents", [...form.documents, { doc_name: "", name: "", url: "", type: "", uploaded_at: "" }])} />
              </div>
            </FormSection>

            {/* 11. Notes */}
            <FormSection title={t("section.notes")} icon={<DocumentIcon size={14} />} owner={t("owner.anyTeam")} ownerLabel={t("owner.label")} dept="general" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              <textarea
                value={form.notes}
                onChange={e => setField("notes", e.target.value)}
                placeholder={t("placeholder.addNotes")}
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] resize-none"
              />
            </FormSection>

            {/* 12. Custom Fields */}
            <FormSection title={t("section.customFields")} icon={<HashtagIcon size={14} />} owner={t("owner.anyTeam")} ownerLabel={t("owner.label")} dept="general" activeDept={supplierDept} auditMap={supplierSectionAudit} updatedByLabel={t("owner.updatedBy")}>
              {form.custom_fields.map((cf, i) => (
                <div key={i} className="flex items-center gap-2 mb-3">
                  <RemoveBtn onClick={() => removeCustomField(i)} />
                  <input
                    value={cf.field_name}
                    onChange={e => updateCustomField(i, "field_name", e.target.value)}
                    placeholder={t("placeholder.fieldName")}
                    className="w-32 h-10 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium outline-none"
                  />
                  <input
                    value={cf.field_value}
                    onChange={e => updateCustomField(i, "field_value", e.target.value)}
                    placeholder={t("placeholder.value")}
                    className="flex-1 h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                  />
                </div>
              ))}
              <AddButton label={t("add.field")} onClick={addCustomField} />
            </FormSection>
          </>
        )}

        {/* ══ EMPLOYEE FORM SECTIONS ══ */}
        {false && /* Employee sections removed — employees use the Employees app */ (
        <>
        {/* 1. Work Contact */}
        <FormSection title={t("section.workContact")} icon={<PhoneIcon size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.workEmail")}</label>
              <div className="relative">
                <EnvelopeIcon size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)]" />
                <input value={form.work_email} onChange={e => setField("work_email", e.target.value)} placeholder="employee@company.com" className="w-full h-10 ps-9 pe-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.workTel")}</label>
                <input value={form.work_tel} onChange={e => setField("work_tel", e.target.value)} placeholder="+1 234 567 890" className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.workMobile")}</label>
                <input value={form.work_mobile} onChange={e => setField("work_mobile", e.target.value)} placeholder="+1 234 567 890" className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
              </div>
            </div>
          </div>
        </FormSection>

        {/* 2. Work */}
        <FormSection title={t("section.work")} icon={<BriefcaseIcon size={14} />}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.managementLevel")}</label>
                <input value={form.management} onChange={e => setField("management", e.target.value)} placeholder={t("placeholder.seniorMgmt")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.department")}</label>
                <input value={form.department} onChange={e => setField("department", e.target.value)} placeholder={t("placeholder.engineering")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.jobPosition")}</label>
                <input value={form.job_position} onChange={e => setField("job_position", e.target.value)} placeholder={t("placeholder.softwareEng")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.jobTitle")}</label>
                <input value={form.job_title} onChange={e => setField("job_title", e.target.value)} placeholder={t("placeholder.leadDev")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.directManager")}</label>
              <input value={form.manager} onChange={e => setField("manager", e.target.value)} placeholder={t("placeholder.manager")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
          </div>
        </FormSection>

        {/* 3. Work Location */}
        <FormSection title={t("section.workLocation")} icon={<MapPinIcon size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.workAddress")}</label>
              <input value={form.work_address} onChange={e => setField("work_address", e.target.value)} placeholder={t("placeholder.officeAddress")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.workLocationLabel")}</label>
              <input value={form.work_location} onChange={e => setField("work_location", e.target.value)} placeholder={t("placeholder.workLocation")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
          </div>
        </FormSection>

        {/* 4. Resume */}
        <FormSection title={t("section.resume")} icon={<DocumentIcon size={14} />}>
          {form.resume_lines.map((rl, i) => (
            <div key={i} className="mb-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] overflow-hidden">
              <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setExpandedResumeLine(expandedResumeLine === i ? null : i)}>
                <span onClick={e => e.stopPropagation()}><RemoveBtn onClick={() => removeResumeLine(i)} /></span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                  rl.type === "experience" ? "bg-blue-500/10 text-blue-400" :
                  rl.type === "education" ? "bg-green-500/10 text-green-400" :
                  rl.type === "training" ? "bg-amber-500/10 text-amber-400" :
                  "bg-violet-500/10 text-violet-400"
                }`}>{t("resumeType." + rl.type, rl.type)}</span>
                <span className="flex-1 text-sm text-[var(--text-highlight)] truncate">{rl.title || t("misc.untitled")}</span>
                <AngleDownIcon size={14} className={`text-[var(--text-dim)] transition-transform ${expandedResumeLine === i ? "rotate-180" : ""}`} />
              </div>
              {expandedResumeLine === i && (
                <div className="px-3 pb-3 space-y-3 border-t border-[var(--border-color)] pt-3">
                  <input value={rl.title} onChange={e => updateResumeLine(i, "title", e.target.value)} placeholder={t("field.resumeTitle")} className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.startDate")}</label>
                      <DateField value={rl.duration_start} onChange={v => updateResumeLine(i, "duration_start", v)} />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.endDate")}</label>
                      <DateField value={rl.duration_end} onChange={v => updateResumeLine(i, "duration_end", v)} disabled={rl.is_forever} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={rl.is_forever} onChange={e => updateResumeLine(i, "is_forever", e.target.checked)} className="w-4 h-4 rounded border-[var(--border-strong)] bg-[var(--bg-surface)] accent-white" />
                    <span className="text-xs text-[var(--text-subtle)]">{t("field.currentlyOngoing")}</span>
                  </label>
                  {rl.type === "training" && (
                    <>
                      <div>
                        <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.courseType")}</label>
                        <div className="flex gap-2">
                          <button onClick={() => updateResumeLine(i, "course_type", "external")} className={`flex-1 h-9 rounded-lg text-xs font-medium border transition-colors ${rl.course_type === "external" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-subtle)]"}`}>{t("field.external")}</button>
                          <button onClick={() => updateResumeLine(i, "course_type", "onsite")} className={`flex-1 h-9 rounded-lg text-xs font-medium border transition-colors ${rl.course_type === "onsite" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-subtle)]"}`}>{t("field.onsite")}</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.externalUrl")}</label>
                        <input value={rl.external_url} onChange={e => updateResumeLine(i, "external_url", e.target.value)} placeholder="https://..." className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.certificate")}</label>
                    {rl.certificate_url ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)] truncate flex-1">{rl.certificate_name || t("field.certificate")}</span>
                        <button onClick={() => openFilePreview(rl.certificate_url)} className="text-xs text-blue-400 hover:text-blue-300">{t("btn.open")}</button>
                        <button onClick={() => { updateResumeLine(i, "certificate_url", ""); updateResumeLine(i, "certificate_name", ""); }} className="text-xs text-red-400 hover:text-red-300">{t("btn.remove")}</button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-dashed border-[var(--border-strong)] hover:border-[var(--border-focus)] text-xs text-[var(--text-faint)] cursor-pointer transition-colors">
                        <FilePlusIcon size={14} />
                        {t("field.uploadCertificate")}
                        <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.type.startsWith("image/")) {
                              compressImage(file).then(url => { updateResumeLine(i, "certificate_url", url); updateResumeLine(i, "certificate_name", file.name); });
                            } else {
                              readFileAsDataURL(file).then(url => { updateResumeLine(i, "certificate_url", url); updateResumeLine(i, "certificate_name", file.name); });
                            }
                          }
                        }} />
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-faint)] mb-1 block">{t("field.notes")}</label>
                    <textarea value={rl.notes} onChange={e => updateResumeLine(i, "notes", e.target.value)} rows={4} placeholder={t("placeholder.addNotes")} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] resize-none" />
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => addResumeLine("experience")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium hover:bg-blue-500/15 transition-colors">
              <PlusIcon size={12} /> {t("resumeType.experience")}
            </button>
            <button onClick={() => addResumeLine("education")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400 font-medium hover:bg-green-500/15 transition-colors">
              <PlusIcon size={12} /> {t("resumeType.education")}
            </button>
            <button onClick={() => addResumeLine("training")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-medium hover:bg-amber-500/15 transition-colors">
              <PlusIcon size={12} /> {t("resumeType.training")}
            </button>
            <button onClick={() => addResumeLine("certification")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-400 font-medium hover:bg-violet-500/15 transition-colors">
              <PlusIcon size={12} /> {t("resumeType.internalCert")}
            </button>
          </div>
        </FormSection>

        {/* 5. Private Contact */}
        <FormSection title={t("section.privateContact")} icon={<PhoneIcon size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.privateEmail")}</label>
              <input value={form.private_email} onChange={e => setField("private_email", e.target.value)} placeholder={t("field.privateEmail")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.privatePhone")}</label>
              <input value={form.private_phone} onChange={e => setField("private_phone", e.target.value)} placeholder={t("field.privatePhone")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.bankAccount")}</label>
              <input value={form.employee_bank_account} onChange={e => setField("employee_bank_account", e.target.value)} placeholder={t("placeholder.bankAccount")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
          </div>
        </FormSection>

        {/* 6. Personal Information */}
        <FormSection title={t("section.personalInfo")} icon={<UserIcon size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.legalName")}</label>
              <input value={form.legal_name} onChange={e => setField("legal_name", e.target.value)} placeholder={t("placeholder.legalName")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("section.birthday")}</label>
              <BirthdayPicker value={form.birthday} onChange={v => setField("birthday", v)} dayLabel={t("field.day")} monthLabel={t("field.month")} yearLabel={t("field.year")} renderMonth={m => t("month." + m, m)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.placeOfBirth")}</label>
                <input value={form.place_of_birth} onChange={e => setField("place_of_birth", e.target.value)} placeholder={t("placeholder.cityCountry")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.gender")}</label>
                <select value={form.gender} onChange={e => setField("gender", e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] appearance-none">
                  <option value="">{t("detail.select")}</option>
                  <option value="male">{tOpt("male")}</option>
                  <option value="female">{tOpt("female")}</option>
                  <option value="other">{tOpt("Other")}</option>
                </select>
              </div>
            </div>
          </div>
        </FormSection>

        {/* 7. Emergency Contact */}
        <FormSection title={t("section.emergencyContact")} icon={<ShieldExclamationIcon size={14} />}>
          {form.emergency_contacts.map((ec, i) => (
            <div key={i} className="flex items-center gap-2 mb-3">
              <RemoveBtn onClick={() => removeEmergencyContact(i)} />
              <input value={ec.contact} onChange={e => updateEmergencyContact(i, "contact", e.target.value)} placeholder={t("field.contactName")} className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
              <input value={ec.phone} onChange={e => updateEmergencyContact(i, "phone", e.target.value)} placeholder={t("field.phone")} className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
          ))}
          <AddButton label={t("add.emergencyContact")} onClick={addEmergencyContact} />
        </FormSection>

        {/* 8. Visa & Work Permit */}
        <FormSection title={t("section.visaWorkPermit")} icon={<PlaneIcon size={14} />}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.visaNo")}</label>
                <input value={form.visa_no} onChange={e => setField("visa_no", e.target.value)} placeholder={t("placeholder.visaNo")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.workPermit")}</label>
                <input value={form.work_permit} onChange={e => setField("work_permit", e.target.value)} placeholder={t("placeholder.workPermit")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.documents")}</label>
              {form.visa_documents.map((vd, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-[var(--text-muted)] truncate flex-1">{vd.name || t("field.documents")}</span>
                  <button onClick={() => openFilePreview(vd.url)} className="text-xs text-blue-400 hover:text-blue-300">{t("btn.open")}</button>
                  <button onClick={() => downloadFile(vd.url, vd.name)} className="text-xs text-[var(--text-faint)] hover:text-[var(--text-primary)]">{t("btn.download")}</button>
                  <button onClick={() => removeVisaDoc(i)} className="text-xs text-red-400 hover:text-red-300">{t("btn.remove")}</button>
                </div>
              ))}
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-dashed border-[var(--border-strong)] hover:border-[var(--border-focus)] text-xs text-[var(--text-faint)] cursor-pointer transition-colors">
                <FilePlusIcon size={14} />
                {t("photo.uploadDoc")}
                <input type="file" accept=".pdf,image/*,.doc,.docx" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = (file.type.startsWith("image/") ? compressImage(file) : readFileAsDataURL(file));
                    reader.then(url => {
                      setField("visa_documents", [...form.visa_documents, { name: file.name, url, type: file.type, uploaded_at: new Date().toISOString() }]);
                    });
                  }
                }} />
              </label>
            </div>
          </div>
        </FormSection>

        {/* 9. Citizenship */}
        <FormSection title={t("section.citizenship")} icon={<GlobeIcon size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.nationalityCountry")}</label>
              <CountryDropdown value={form.nationality_code} displayValue={form.nationality} onChange={(name, code) => { setField("nationality", name); setField("nationality_code", code); }} label={t("field.nationality")} placeholder={t("field.searchCountry")} noResults={t("detail.noCountries")} />
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block flex items-center gap-1">
                {t("field.nationalIdNumber")}
                <span className="relative group">
                  <HelpCircleIcon size={12} className="text-[var(--text-ghost)] cursor-help" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-[var(--border-color)] text-[10px] text-[var(--text-secondary)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{t("tooltip.nationalId")}</span>
                </span>
              </label>
              <input value={form.id_no} onChange={e => setField("id_no", e.target.value)} placeholder={t("placeholder.nationalId")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block flex items-center gap-1">
                {t("field.ssn")}
                <span className="relative group">
                  <HelpCircleIcon size={12} className="text-[var(--text-ghost)] cursor-help" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-[var(--border-color)] text-[10px] text-[var(--text-secondary)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{t("tooltip.ssn")}</span>
                </span>
              </label>
              <input value={form.ssn_no} onChange={e => setField("ssn_no", e.target.value)} placeholder={t("placeholder.ssn")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.passportNo")}</label>
              <input value={form.passport_no} onChange={e => setField("passport_no", e.target.value)} placeholder={t("placeholder.passport")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
          </div>
        </FormSection>

        {/* 10. Private Location */}
        <FormSection title={t("section.privateLocation")} icon={<HomeIcon size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.privateAddress")}</label>
              <input value={form.private_address} onChange={e => setField("private_address", e.target.value)} placeholder={t("placeholder.homeAddress")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.homeWorkDistance")}</label>
              <div className="relative">
                <input value={form.home_work_distance} onChange={e => setField("home_work_distance", e.target.value)} placeholder="0" className="w-full h-10 px-3 pe-12 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
                <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)]">KM</span>
              </div>
            </div>
          </div>
        </FormSection>

        {/* 11. Family */}
        <FormSection title={t("section.family")} icon={<HeartIcon size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.maritalStatus")}</label>
              <select value={form.marital_status} onChange={e => setField("marital_status", e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] appearance-none">
                <option value="">{t("detail.select")}</option>
                <option value="single">{tOpt("single")}</option>
                <option value="married">{tOpt("married")}</option>
                <option value="divorced">{tOpt("divorced")}</option>
                <option value="widowed">{tOpt("widowed")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.numberOfChildren")}</label>
              <input type="number" min="0" value={form.number_of_children} onChange={e => setField("number_of_children", e.target.value)} placeholder="0" className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
          </div>
        </FormSection>

        {/* 12. Education */}
        <FormSection title={t("section.education")} icon={<GraduationCapIcon size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.certificateLevel")}</label>
              <select value={form.certificate_level} onChange={e => setField("certificate_level", e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] appearance-none">
                <option value="">{t("detail.select")}</option>
                <option value="high_school">{tOpt("high_school")}</option>
                <option value="diploma">{tOpt("diploma")}</option>
                <option value="bachelor">{tOpt("bachelor")}</option>
                <option value="master">{tOpt("master")}</option>
                <option value="doctorate">{tOpt("doctorate")}</option>
                <option value="other">{tOpt("Other")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--text-faint)] mb-1.5 block">{t("field.fieldOfStudy")}</label>
              <input value={form.field_of_study} onChange={e => setField("field_of_study", e.target.value)} placeholder={t("placeholder.fieldOfStudy")} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]" />
            </div>
          </div>
        </FormSection>
        </>
        )}

        {/* Customer Type (only for customer contacts — Commercial tab) */}
        {isCustomer && showTab("commercial") && (
          <FormSection title={t("section.customerType")} icon={<CrownIcon size={14} />}>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setField("is_active", e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border-focus)] bg-[var(--bg-surface)] accent-blue-500"
                />
                <span className="text-sm text-[var(--text-primary)]">{t("detail.activeCustomer")}</span>
              </label>

              {form.is_active && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CUSTOMER_TIERS.map(tier => (
                    <button
                      key={tier.value}
                      onClick={() => setField("customer_type", form.customer_type === tier.value ? "" : tier.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        form.customer_type === tier.value
                          ? `${tier.bg} ${tier.color} border-[var(--border-focus)] ring-1 ring-white/10`
                          : "border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-subtle)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      {tier.value === "end_user" && <UserIcon size={14} />}
                      {tier.value === "silver" && <ShieldIcon size={14} />}
                      {tier.value === "gold" && <StarIcon size={14} />}
                      {tier.value === "platinum" && <AwardIcon size={14} />}
                      {tier.value === "diamond" && <GemIcon size={14} />}
                      {tier.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FormSection>
        )}

        {/* Spacer at bottom */}
        <div className="h-20" />
      </div>
    );
  };

  /* ═════════════════════════════════════════════════════════════════════════
     TYPE CHOOSER MODAL
     ═════════════════════════════════════════════════════════════════════════ */

  const renderTypeChooser = () => (
    <ScrollLockOverlay className="fixed inset-0 z-50 bg-[var(--bg-overlay)] flex items-center justify-center p-4" onClick={() => { setShowTypeChooser(false); setTypeChooserStep(1); }}>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        {typeChooserStep === 1 ? (
          <>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{t("typeChooser.title")}</h3>
            <p className="text-sm text-[var(--text-faint)] mb-5">{t("typeChooser.desc")}</p>
            <div className="grid grid-cols-2 gap-3">
              {CONTACT_TYPES.map(ct => (
                <button
                  key={ct.value}
                  onClick={() => {
                    if (ct.value === "customer") {
                      setTypeChooserStep(2);
                    } else {
                      handleAdd(ct.value);
                    }
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-color)] hover:border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface)] transition-all ${ct.color}`}
                >
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-surface)] flex items-center justify-center [&>svg]:w-[22px] [&>svg]:h-[22px]">
                    {ct.icon}
                  </div>
                  <span className="text-sm font-medium">{t("type." + ct.value, ct.label)}</span>
                </button>
              ))}
            </div>
            <button onClick={() => { setShowTypeChooser(false); setTypeChooserStep(1); }} className="w-full mt-4 py-2.5 rounded-lg text-sm text-[var(--text-subtle)] hover:text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--bg-surface)] transition-colors">
              Cancel
            </button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{t("typeChooser.customerQ")}</h3>
            <p className="text-sm text-[var(--text-faint)] mb-5">{t("typeChooser.customerDesc")}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAdd("customer", "person")}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-color)] hover:border-amber-500/30 bg-[var(--bg-surface-subtle)] hover:bg-amber-500/[0.05] transition-all text-amber-400"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <UserIcon size={22} />
                </div>
                <span className="text-sm font-medium">{t("typeChooser.individual")}</span>
                <span className="text-[11px] text-[var(--text-dim)] text-center leading-tight">{t("typeChooser.individualDesc")}</span>
              </button>
              <button
                onClick={() => handleAdd("customer", "company")}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border-color)] hover:border-amber-500/30 bg-[var(--bg-surface-subtle)] hover:bg-amber-500/[0.05] transition-all text-amber-400"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Building2Icon size={22} />
                </div>
                <span className="text-sm font-medium">{t("typeChooser.business")}</span>
                <span className="text-[11px] text-[var(--text-dim)] text-center leading-tight">{t("typeChooser.businessDesc")}</span>
              </button>
            </div>
            <button onClick={() => setTypeChooserStep(1)} className="w-full mt-4 py-2.5 rounded-lg text-sm text-[var(--text-subtle)] hover:text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--bg-surface)] transition-colors flex items-center justify-center gap-2">
              <ArrowLeftIcon size={14} className="rtl:rotate-180" /> {t("back")}
            </button>
          </>
        )}
      </div>
    </ScrollLockOverlay>
  );

  /* ═════════════════════════════════════════════════════════════════════════
     MAIN LAYOUT
     ═════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-[var(--bg-primary)] text-[var(--text-primary)] flex overflow-hidden max-w-[100vw]">
      {/* Left panel -- contact list */}
      <div className={`${mobileShowDetail ? "hidden md:flex" : "flex"} flex-col w-full md:w-[340px] lg:w-[380px] md:border-e border-[var(--border-color)] shrink-0 h-full bg-[var(--bg-secondary)] min-w-0`}>
        {renderListPanel()}
      </div>

      {/* Right panel -- detail / form */}
      <div className={`${mobileShowDetail ? "flex" : "hidden md:flex"} flex-col flex-1 min-w-0 h-full bg-[var(--bg-primary)]`}>
        {view === "form" && !formModalOpen ? renderFormPanel() : renderDetailPanel()}
      </div>

      {/* Type chooser modal */}
      {showTypeChooser && renderTypeChooser()}

      {/* Catalog import → the REAL New Supplier form (renderFormPanel) inside a
          modal, pre-filled. Identical to a manual add because it IS the form. */}
      {formModalOpen && view === "form" && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setFormModalOpen(false); pendingCatalogFileRef.current = null; setView("list"); } }}>
          <div className="w-full max-w-4xl my-6 rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: "var(--bg-card, #fff)", border: "1px solid var(--border-subtle, #e0e0e0)" }}>
            <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
              style={{ background: "var(--bg-card, #fff)", borderBottom: "1px solid var(--border-subtle, #e0e0e0)" }}>
              <div>
                <h2 className="text-[15px] font-semibold">New supplier from catalog</h2>
                <p className="text-[12px]" style={{ color: "var(--text-dim, #888)" }}>Review the imported details, set Division &amp; Category, then Save.</p>
              </div>
              <button onClick={() => { setFormModalOpen(false); pendingCatalogFileRef.current = null; setView("list"); }}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:opacity-70"
                style={{ border: "1px solid var(--border-subtle, #e0e0e0)" }} aria-label="Close">
                <span className="text-[18px] leading-none">×</span>
              </button>
            </div>
            {/* kx-import-fill: highlight auto-filled (non-empty) inputs with a
                green border while reviewing the import; reverts after save. */}
            <div className="max-h-[80vh] overflow-y-auto kx-import-fill">{renderFormPanel()}</div>
          </div>
        </div>
      )}

      {/* Square-crop the chosen logo / screenshot before it becomes the photo. */}
      {logoCropSrc && (
        <SquareLogoCropper
          src={logoCropSrc}
          onCancel={() => setLogoCropSrc(null)}
          onCrop={(url) => { setField("photo_url", url); setLogoCropSrc(null); }}
        />
      )}

      {/* Possible-duplicate guard — shown before a new supplier is created when
          it looks like one we already have. Operator decides: open / merge / create. */}
      {dupMatches.length > 0 && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget && !dupMerging) setDupMatches([]); }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
              <div className="text-[15px] font-semibold text-[var(--text-primary)]">{t("dup.title", "Possible duplicate supplier")}</div>
              <div className="text-[12px] text-[var(--text-muted)] mt-0.5">
                {t("dup.subtitle", "This looks like a supplier you already have. Open it, merge the new info into it, or create a separate record.")}
              </div>
            </div>
            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              {dupMatches.map((m) => (
                <div key={m.id} className="rounded-xl p-3.5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-[var(--text-primary)] truncate">{m.name}</div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{m.reasons.join(" · ")}</div>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full"
                      style={m.level === "high"
                        ? { background: "rgba(255,51,51,0.12)", color: "#ff6b6b" }
                        : { background: "rgba(255,204,0,0.12)", color: "#e0a800" }}>
                      {m.level === "high" ? t("dup.likely", "Likely match") : t("dup.possible", "Possible")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button disabled={!!dupMerging} onClick={() => openExistingDup(m.id)}
                      className="px-3 py-1.5 text-[12px] font-medium rounded-lg disabled:opacity-50"
                      style={{ background: "var(--bg-surface-hover)", color: "var(--text-secondary)" }}>
                      {t("dup.open", "Open this supplier")}
                    </button>
                    <button disabled={!!dupMerging} onClick={() => mergeIntoExisting(m.id)}
                      className="px-3 py-1.5 text-[12px] font-semibold rounded-lg disabled:opacity-50"
                      style={{ background: "#0066FF", color: "#fff" }}>
                      {dupMerging === m.id ? t("dup.merging", "Merging…") : t("dup.merge", "Merge new info into it")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t flex items-center justify-between gap-2" style={{ borderColor: "var(--border-color)" }}>
              <button disabled={!!dupMerging} onClick={() => setDupMatches([])}
                className="px-3 py-1.5 text-[12px] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:opacity-50">
                {t("btn.cancel", "Cancel")}
              </button>
              <button disabled={!!dupMerging} onClick={createAnywayDup}
                className="px-3 py-1.5 text-[12px] font-medium rounded-lg disabled:opacity-50"
                style={{ border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                {t("dup.createAnyway", "Not a duplicate — create anyway")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import supplier from PDF catalog */}
      <ImportSupplierFromCatalog
        open={showCatalogImport}
        onClose={() => setShowCatalogImport(false)}
        onPrefill={(prefill, catalogFile) => {
          setShowCatalogImport(false);
          importIntoForm(prefill, catalogFile);
        }}
      />

      {/* Delete confirmation — isolated host (window-event driven) so opening
          it never re-renders this giant component. */}
      <DeleteConfirmHost t={t} />
    </div>
  );
}
