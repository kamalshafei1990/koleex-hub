"use client";

/* ---------------------------------------------------------------------------
   Supplier Data Entry Guide — Knowledge app  (EN / 中文 / العربية)
   Step-by-step manual for employees on how to add and maintain a supplier
   record. Mirrors the real Add/Edit Supplier form (21 sections, department
   ownership, completeness tiers). All copy lives in CONTENT[lang]; the page
   renders purely from it and flips to RTL for Arabic.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import KnowledgeIcon from "@/components/icons/KnowledgeIcon";
import HandshakeIcon from "@/components/icons/ui/HandshakeIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import FileCheckIcon from "@/components/icons/ui/FileCheckIcon";
import LandmarkIcon from "@/components/icons/ui/LandmarkIcon";
import TruckIcon from "@/components/icons/ui/TruckIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import HandCoinsIcon from "@/components/icons/ui/HandCoinsIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import Share2Icon from "@/components/icons/ui/Share2Icon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import LightbulbIcon from "@/components/icons/ui/LightbulbIcon";
import HelpCircleIcon from "@/components/icons/ui/HelpCircleIcon";
import FilterIcon from "@/components/icons/ui/FilterIcon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";

/* ── department keys & colors (not translated) ── */
type DeptKey = "procurement" | "legal" | "finance" | "logistics" | "quality" | "commercial" | "general";
const DEPT_ORDER: DeptKey[] = ["procurement", "legal", "finance", "logistics", "quality", "commercial", "general"];
const DEPT_STYLE: Record<DeptKey, { dot: string; soft: string; text: string; ring: string }> = {
  procurement: { dot: "bg-blue-500", soft: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/30" },
  legal: { dot: "bg-violet-500", soft: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/30" },
  finance: { dot: "bg-emerald-500", soft: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30" },
  logistics: { dot: "bg-amber-500", soft: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/30" },
  quality: { dot: "bg-cyan-500", soft: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", ring: "ring-cyan-500/30" },
  commercial: { dot: "bg-rose-500", soft: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/30" },
  general: { dot: "bg-slate-400", soft: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-300", ring: "ring-slate-500/30" },
};

type Tier = "required" | "preferred" | "optional";
const TIER_STYLE: Record<Tier, string> = {
  required: "bg-rose-500/12 text-rose-600 dark:text-rose-400 ring-rose-500/30",
  preferred: "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/30",
  optional: "bg-[var(--bg-surface)] text-[var(--text-dim)] ring-[var(--border-subtle)]",
};

/* ── per-section metadata (icon/dept/tier — not translated); text lives in CONTENT ── */
const SECTION_META: { id: string; dept: DeptKey; tier: Tier; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "company-name", dept: "procurement", tier: "required", icon: Building2Icon },
  { id: "company-profile", dept: "procurement", tier: "preferred", icon: BriefcaseIcon },
  { id: "classifications", dept: "procurement", tier: "preferred", icon: TagsIcon },
  { id: "contact-details", dept: "procurement", tier: "required", icon: PhoneIcon },
  { id: "contact-persons", dept: "procurement", tier: "preferred", icon: UsersIcon },
  { id: "messaging-ids", dept: "procurement", tier: "optional", icon: MessageSquareIcon },
  { id: "legal-identity", dept: "legal", tier: "required", icon: Building2Icon },
  { id: "trade-tax-ids", dept: "legal", tier: "preferred", icon: FileCheckIcon },
  { id: "payment-info", dept: "finance", tier: "required", icon: LandmarkIcon },
  { id: "logistics-trade", dept: "logistics", tier: "preferred", icon: TruckIcon },
  { id: "factory", dept: "quality", tier: "preferred", icon: FactoryIcon },
  { id: "catalogue", dept: "procurement", tier: "optional", icon: BookOpenIcon },
  { id: "products", dept: "procurement", tier: "optional", icon: PackageIcon },
  { id: "quality-performance", dept: "quality", tier: "preferred", icon: ShieldCheckIcon },
  { id: "risk", dept: "commercial", tier: "preferred", icon: TriangleWarningIcon },
  { id: "negotiation", dept: "commercial", tier: "optional", icon: HandCoinsIcon },
  { id: "strategic-status", dept: "commercial", tier: "optional", icon: TargetIcon },
  { id: "documents", dept: "legal", tier: "preferred", icon: PaperclipIcon },
  { id: "social-media", dept: "general", tier: "optional", icon: Share2Icon },
  { id: "notes", dept: "general", tier: "optional", icon: DocumentIcon },
  { id: "custom-fields", dept: "general", tier: "optional", icon: HashtagIcon },
];

/* ── localizable content shape ── */
interface FieldRow { name: string; how: string }
interface SectionText { id: string; title: string; what: string; fields: FieldRow[]; tip?: string }
interface Content {
  breadcrumb: { knowledge: string; current: string };
  onThisPage: string;
  hero: { eyebrow: string; title: string; body: string; ctaOpen: string; ctaJump: string };
  toc: { id: string; label: string }[];
  why: { eyebrow: string; title: string; intro: string; cards: { h: string; b: string }[] };
  rules: { eyebrow: string; title: string; items: string[] };
  owners: { eyebrow: string; title: string; introA: string; showFieldsFor: string; introB: string };
  depts: Record<DeptKey, { name: string; owns: string }>;
  tierLabels: Record<Tier, string>;
  steps: { eyebrow: string; title: string; items: { n: number; title: string; dept?: DeptKey; body: string }[] };
  sectionsHead: { eyebrow: string; title: string; intro: string };
  sections: SectionText[];
  completeness: { eyebrow: string; title: string; intro: string; required: string; preferred: string; optional: string; overallTitle: string; overall: string };
  bilingual: { eyebrow: string; title: string; cards: { h: string; b: string }[] };
  mistakes: { eyebrow: string; title: string; items: string[] };
  checklist: { eyebrow: string; title: string; items: string[]; ctaAdd: string; ctaBack: string };
}

/* ════════════════════════ ENGLISH (source of truth) ════════════════════════ */
const EN: Content = {
  breadcrumb: { knowledge: "Knowledge", current: "Supplier Data Entry Guide" },
  onThisPage: "On this page",
  hero: {
    eyebrow: "Supplier Onboarding Manual",
    title: "How to fill supplier data — the right way, step by step",
    body: "A supplier record feeds Purchase, Finance, Inventory and the Sourcing Command Center. Good data in means good decisions out. This guide shows exactly what to enter in each section, who owns it, and the order to do it in — so any teammate can onboard a supplier cleanly and completely.",
    ctaOpen: "Open Add Supplier",
    ctaJump: "Jump to the 7 steps",
  },
  toc: [
    { id: "why", label: "Why this matters" },
    { id: "rules", label: "The golden rules" },
    { id: "owners", label: "Who fills what" },
    { id: "steps", label: "Step-by-step workflow" },
    { id: "sections", label: "Every section explained" },
    { id: "completeness", label: "Profile completeness" },
    { id: "bilingual", label: "Working in two languages" },
    { id: "mistakes", label: "Common mistakes" },
    { id: "checklist", label: "Before you save" },
  ],
  why: {
    eyebrow: "Start here",
    title: "Why supplier data matters",
    intro: "Every other app reads what you type here. The supplier card is the single source of truth.",
    cards: [
      { h: "One record, many apps", b: "Purchase creates POs from it, Finance pays from it, Inventory receives against it, the Sourcing Command Center scores it. A wrong name or bank number breaks all of them." },
      { h: "Decisions follow data", b: "Risk, lead time, factory capacity and performance scores are what management uses to choose suppliers. Empty fields = blind decisions." },
      { h: "One supplier = one card", b: "Duplicates split history and confuse reporting. Always search first." },
      { h: "It compounds over time", b: "You don't have to fill everything at once. Get the Required fields in today; the team enriches the rest as the relationship grows." },
    ],
  },
  rules: {
    eyebrow: "Principles",
    title: "The golden rules",
    items: [
      "Search before you create — never duplicate a supplier.",
      "Fill what your department owns; leave other sections for their owners (the colored badge tells you who).",
      "Type in your own language. The Hub auto-translates notes and typed text for the rest of the team.",
      "Required first, then Preferred, then Optional — watch the completeness panel.",
      "Every claim needs proof — upload the matching document for legal and bank fields.",
      "Verify bank details by phone before saving. Never trust bank changes sent only by email.",
      "Use dropdowns as given — consistent values keep filtering and reporting accurate.",
    ],
  },
  owners: {
    eyebrow: "Responsibility",
    title: "Who fills what",
    introA: "Each section on the form carries a colored owner badge. Use the",
    showFieldsFor: "Show fields for",
    introB: "filter under the completeness panel to show only your department's sections.",
  },
  depts: {
    procurement: { name: "Procurement", owns: "Who the supplier is, how to reach them, what they sell" },
    legal: { name: "Compliance / Legal", owns: "Legal identity, tax & trade IDs, signed documents" },
    finance: { name: "Finance / Treasury", owns: "Payment terms and verified bank details" },
    logistics: { name: "Logistics", owns: "Incoterms, shipping, lead times, ports" },
    quality: { name: "Sourcing / Quality", owns: "Factory profile, certifications, performance" },
    commercial: { name: "Commercial / Management", owns: "Risk, negotiation posture, strategic status" },
    general: { name: "Any team", owns: "Social links, internal notes, custom fields" },
  },
  tierLabels: { required: "Required", preferred: "Preferred", optional: "Optional" },
  steps: {
    eyebrow: "Workflow",
    title: "Step by step — the order to fill",
    items: [
      { n: 1, title: "Search before you create", body: "Open the Suppliers directory and search the company name (try the Chinese name too). If it exists, open and update it — do not create a duplicate." },
      { n: 2, title: "Start with Procurement basics", dept: "procurement", body: "Fill Company Name, Profile, Classifications, Contact Details and Contact Persons. This alone makes the record usable across the Hub." },
      { n: 3, title: "Hand off to Compliance / Legal", dept: "legal", body: "Legal Identity and Trade & Tax IDs, then upload the business license and certificates in Documents." },
      { n: 4, title: "Finance verifies payment", dept: "finance", body: "Payment terms and verified bank details. Confirm any bank info by phone before saving." },
      { n: 5, title: "Logistics & Quality add operations", dept: "logistics", body: "Incoterms and shipping (Logistics), then the Factory profile and Quality & Performance (Sourcing/Quality)." },
      { n: 6, title: "Commercial & Management close it out", dept: "commercial", body: "Log Risk items, capture Negotiation intelligence, and set the Strategic Status." },
      { n: 7, title: "Check completeness, then save", body: "Watch the Profile Completeness panel. Aim for the green \"Ready\" badge (all Required done), then keep raising Preferred and Optional over time." },
    ],
  },
  sectionsHead: {
    eyebrow: "Field reference",
    title: "Every section explained",
    intro: "The 21 sections of the form, in fill order. Each shows its owner and whether it is Required, Preferred or Optional for a complete profile.",
  },
  sections: [
    { id: "company-name", title: "Company Name", what: "The single line that identifies the supplier everywhere in the Hub. Get this exactly right — every other app (Purchase, Finance, Inventory) reads it.",
      fields: [
        { name: "Company / legal name", how: "Use the official registered name. If it is a Chinese company, type the Chinese name — the Hub auto-translates it for English/Arabic readers." },
        { name: "Display / short name", how: "A clean name for lists and POs (e.g. \"Ningbo Sunrise\"). Skip the legal suffixes here." },
        { name: "Supplier type", how: "Pick from the dropdown: Manufacturer, Trading, Agent, Spare Parts, Machinery, Packaging, Textile, Chemical, Logistics… Choose what they primarily are." },
      ], tip: "Search the directory first (see Step 1). One real-world company = one record. Never create a second card for the same factory." },
    { id: "company-profile", title: "Company Profile", what: "A quick portrait of the business so anyone opening the record understands who they are dealing with.",
      fields: [
        { name: "Year established", how: "Four-digit year. A long track record is a trust signal." },
        { name: "Employee count range", how: "Pick the band from the dropdown — a proxy for capacity and stability." },
        { name: "Business description", how: "One or two sentences: what they make/do and their specialty. Write in any language; it auto-translates." },
        { name: "Website", how: "Full URL including https://." },
      ] },
    { id: "classifications", title: "Classifications", what: "Tags that let everyone filter and group suppliers by what they provide.",
      fields: [
        { name: "Classification", how: "Pick the category from the dropdown (Machinery, Spare Parts, Textile, Chemical, Accessories…)." },
        { name: "Tags", how: "Add free keywords for niche capabilities (e.g. \"needles\", \"servo motors\")." },
      ] },
    { id: "contact-details", title: "Contact Details", what: "The primary, official way to reach the company. Personal contacts go in the next section.",
      fields: [
        { name: "Main phone", how: "Include country code (e.g. +86 …)." },
        { name: "Main email", how: "The company's general/sales inbox." },
        { name: "Address, city, country", how: "Their main business address. Country drives reporting and currency defaults downstream." },
      ] },
    { id: "contact-persons", title: "Contact Persons", what: "The real people you talk to. You can add several — mark who decides and who is your primary contact.",
      fields: [
        { name: "Name & role", how: "Add each person; pick their role from the dropdown (Sales, Owner, Engineer, Finance…)." },
        { name: "Decision-maker / Primary toggles", how: "Flag the person who signs off, and the one you deal with day-to-day." },
        { name: "Channels (WeChat, WeCom, WhatsApp, Telegram, Line, Skype)", how: "Fill the apps they actually answer on. Then set Preferred channel." },
        { name: "Preferred language", how: "Pick their language so the team knows how to write to them." },
        { name: "Timezone, available hours, reliability, response speed", how: "Optional but valuable — sets expectations for the next person who contacts them." },
      ], tip: "A decision-maker with a WeChat ID and a known timezone is worth ten generic info@ emails." },
    { id: "messaging-ids", title: "Messaging IDs", what: "Company-level chat identities (separate from a single person).",
      fields: [
        { name: "WeChat ID / Official Account", how: "The company's WeChat handle or official account." },
        { name: "WeChat sales group available", how: "Toggle on if they run a buyer group chat." },
        { name: "WeCom support available", how: "Toggle on if they use WeCom (企业微信) for support." },
      ] },
    { id: "legal-identity", title: "Legal Identity", what: "The legally registered entity behind the trade name. Required before any contract or first payment.",
      fields: [
        { name: "Legal entity name", how: "Exactly as on the business license — including the legal suffix." },
        { name: "Registration number", how: "Company registration / incorporation number." },
        { name: "Country of incorporation & entity type", how: "Where and how they are registered (Ltd, Co., etc.)." },
        { name: "Registered (legal) address", how: "The address on official records — may differ from the operating address." },
      ], tip: "Cross-check these against the uploaded business license in the Documents section. They must match." },
    { id: "trade-tax-ids", title: "Trade & Tax IDs", what: "Tax and cross-border trade identifiers needed for invoices, customs and compliance. Hover the (?) on each field for an explanation.",
      fields: [
        { name: "Tax ID / VAT number", how: "The supplier's tax registration number." },
        { name: "Unified Social Credit Code (USCI)", how: "For Chinese suppliers — the 18-character code on the license." },
        { name: "Import / Export license", how: "Their customs registration, if they ship internationally themselves." },
      ] },
    { id: "payment-info", title: "Payment Information", what: "How and where we pay them. This is the most sensitive section — Finance owns it.",
      fields: [
        { name: "Payment terms", how: "Pick from the dropdown: T/T, L/C, D/P, D/A, Net 30/60… Match the signed agreement." },
        { name: "Currency", how: "The currency of the agreement." },
        { name: "Bank name, account name, account no. / IBAN, SWIFT", how: "Enter exactly as on the bank confirmation letter. Verify the beneficiary name matches the legal entity." },
        { name: "Intermediary / correspondent bank", how: "Only if the bank requires one for international transfers." },
      ], tip: "Never accept bank details by email alone — fraudsters intercept these. Confirm any change by phone with a known contact, then record it here." },
    { id: "logistics-trade", title: "Logistics & Trade", what: "How goods move from them to us. Hover the (?) on each field for definitions.",
      fields: [
        { name: "Incoterms", how: "Pick the agreed term (EXW, FOB, CIF, DDP…). It decides who pays freight and bears risk." },
        { name: "Port of loading", how: "Where their goods normally ship from." },
        { name: "Standard lead time", how: "Typical days from PO to ready-to-ship." },
        { name: "Packaging / shipping notes", how: "Anything special about how they pack or consolidate." },
      ] },
    { id: "factory", title: "Factory", what: "The production capability behind the supplier. Every field has a (?) explaining what to enter.",
      fields: [
        { name: "Factory type & location", how: "Pick the type; record where the plant actually is (may differ from the office)." },
        { name: "Capacity & output (with units)", how: "Enter the number and pick the unit (pcs/month, tons/year…)." },
        { name: "Supported materials", how: "List the materials they can work with — used for matching to product needs." },
        { name: "Certifications", how: "ISO, CE and similar — list what they hold." },
        { name: "Lead time (days), peak-season months", how: "Production lead time, and the busy months when lead times stretch." },
        { name: "Factory visit date", how: "The date we last audited/visited on-site. Empty means never visited." },
      ] },
    { id: "catalogue", title: "Catalogue", what: "Links to what they offer.",
      fields: [ { name: "Catalogue / price list link", how: "Paste a link, or upload the file in Documents." } ] },
    { id: "products", title: "Products", what: "The specific products this supplier provides to us.",
      fields: [ { name: "Products supplied", how: "List or link the items. Connects the supplier to the Products and Purchase apps." } ] },
    { id: "quality-performance", title: "Quality & Performance", what: "The track record that decides whether we keep buying from them.",
      fields: [
        { name: "Quality certifications", how: "Standards they are certified to." },
        { name: "Defect rate / on-time delivery rate", how: "Enter measured percentages where known." },
        { name: "Quality notes", how: "Free notes on recurring issues or strengths (auto-translates)." },
        { name: "Performance scores", how: "Use the sliders to rate them; updates over time." },
      ] },
    { id: "risk", title: "Risk", what: "Known risks, logged item-by-item so nothing is forgotten.",
      fields: [
        { name: "Risk items", how: "Add one row per risk. Pick the Dimension (financial, supply, quality, geopolitical…), Severity and Status from the dropdowns." },
        { name: "Description & mitigation", how: "What the risk is, and what we are doing about it." },
      ] },
    { id: "negotiation", title: "Negotiation", what: "Intelligence that makes the next negotiation stronger.",
      fields: [
        { name: "Flexibility (payment, communication, customization, exclusivity)", how: "Set each level based on past dealings." },
        { name: "Preferred tactics & leverage points", how: "What works with them, and where we have leverage." },
      ] },
    { id: "strategic-status", title: "Strategic Status", what: "Management's verdict on how important this supplier is to us.",
      fields: [
        { name: "Strategic status", how: "Pick from the dropdown: Strategic, Preferred, Approved, Experimental, Backup, Probation…" },
        { name: "Internal score", how: "An overall internal rating. Set by management/commercial." },
      ] },
    { id: "documents", title: "Documents", what: "The proof behind everything above. Attach the real files.",
      fields: [ { name: "Business license, certificates, contracts, NDA", how: "Upload clear scans/PDFs. These back up the Legal and Finance sections." } ],
      tip: "If a field claims a certification or a bank account, the matching document belongs here." },
    { id: "social-media", title: "Social Media", what: "Public presence — useful for verification and background checks.",
      fields: [ { name: "LinkedIn, Alibaba, Made-in-China, etc.", how: "Paste profile/storefront links." } ] },
    { id: "notes", title: "Internal Notes", what: "Anything the team should know that doesn't fit a field.",
      fields: [ { name: "Notes", how: "Write freely in your own language — teammates see it auto-translated into theirs." } ] },
    { id: "custom-fields", title: "Custom Fields", what: "Extra key/value details specific to your workflow.",
      fields: [ { name: "Custom key / value", how: "Add only what you'll actually search or report on later." } ] },
  ],
  completeness: {
    eyebrow: "Your progress meter",
    title: "Reading the Profile Completeness panel",
    intro: "The panel at the top of the form tracks how complete the record is, in three tiers plus an overall score.",
    required: "The minimum to make the supplier usable: name, contact, legal identity and payment basics. The green “Ready” badge appears only when every Required field is filled.",
    preferred: "Strongly recommended: profile, factory, logistics, quality, risk. These power good sourcing decisions.",
    optional: "Nice-to-have depth: negotiation intelligence, social links, custom fields. Fill as the relationship grows.",
    overallTitle: "Overall",
    overall: "A single percentage across all tiers. Use it to see at a glance how mature a supplier record is — but “Ready” (all Required done) is the real bar for going live.",
  },
  bilingual: {
    eyebrow: "For mixed teams",
    title: "Working in Chinese, Arabic and English",
    cards: [
      { h: "Type in your language", b: "Enter notes, descriptions and names in whatever language is natural for you — Chinese staff in 中文, others in English or العربية. Don't enter data twice." },
      { h: "Everyone reads their own", b: "Typed text shows auto-translated into each viewer's language, with a one-tap “show original” toggle. The whole interface, labels and dropdowns also switch with the language picker." },
      { h: "Use the (?) help tips", b: "Many fields — especially Trade & Tax IDs, Logistics, and Factory — have a small (?) icon. Hover it for a bilingual explanation of exactly what to enter and where to find it." },
    ],
  },
  mistakes: {
    eyebrow: "Avoid these",
    title: "Common mistakes",
    items: [
      "Creating a duplicate because you didn't search the Chinese name.",
      "Putting a person's mobile in the company phone field — keep people in Contact Persons.",
      "Typing bank details from an email without a phone confirmation.",
      "Filling another department's section with guesses instead of leaving it for the owner.",
      "Writing dropdown values as free text (e.g. typing “FOB” somewhere instead of selecting the Incoterm).",
      "Claiming a certification with no document uploaded to back it up.",
    ],
  },
  checklist: {
    eyebrow: "Final pass",
    title: "Before you save",
    items: [
      "Searched first — this is not a duplicate.",
      "Company name is the official registered name; supplier type is set.",
      "At least one contact person, with a preferred channel.",
      "Legal identity matches the uploaded business license.",
      "Bank details verified by phone and documented.",
      "All dropdowns selected (not typed); units chosen where needed.",
      "Completeness panel shows the green “Ready” badge.",
    ],
    ctaAdd: "Add a supplier now",
    ctaBack: "Back to Knowledge",
  },
};

/* ════════════════════════ 中文 ════════════════════════ */
const ZH: Content = {
  "breadcrumb": {
    "knowledge": "知识库",
    "current": "供应商数据录入指南"
  },
  "onThisPage": "本页内容",
  "hero": {
    "eyebrow": "供应商入驻手册",
    "title": "如何正确录入供应商数据——分步操作指南",
    "body": "供应商档案会为采购、财务、库存以及寻源指挥中心提供数据。录入的数据质量好，输出的决策才会好。本指南将精确说明每个板块应录入哪些内容、由谁负责，以及录入的先后顺序——让任何团队成员都能干净、完整地完成供应商入驻。",
    "ctaOpen": "打开新增供应商",
    "ctaJump": "跳转到 7 个步骤"
  },
  "toc": [
    {
      "id": "why",
      "label": "为什么这很重要"
    },
    {
      "id": "rules",
      "label": "黄金法则"
    },
    {
      "id": "owners",
      "label": "谁负责填写什么"
    },
    {
      "id": "steps",
      "label": "分步工作流程"
    },
    {
      "id": "sections",
      "label": "每个板块详解"
    },
    {
      "id": "completeness",
      "label": "档案完整度"
    },
    {
      "id": "bilingual",
      "label": "使用两种语言协作"
    },
    {
      "id": "mistakes",
      "label": "常见错误"
    },
    {
      "id": "checklist",
      "label": "保存前检查"
    }
  ],
  "why": {
    "eyebrow": "从这里开始",
    "title": "为什么供应商数据很重要",
    "intro": "其他每一个应用都会读取你在此处录入的内容。供应商卡片是唯一的事实来源。",
    "cards": [
      {
        "h": "一份档案，多个应用",
        "b": "采购据此创建 PO，财务据此付款，库存据此收货，寻源指挥中心据此评分。一个错误的名称或银行账号会让它们全部出错。"
      },
      {
        "h": "决策依据数据",
        "b": "风险、交货周期、工厂产能和绩效评分是管理层选择供应商的依据。字段为空 = 盲目决策。"
      },
      {
        "h": "一个供应商 = 一张卡片",
        "b": "重复档案会割裂历史记录并扰乱报表。请务必先搜索。"
      },
      {
        "h": "数据会随时间累积",
        "b": "你不必一次性填完所有内容。今天先把必填字段录入；随着合作关系的发展，团队会逐步补充其余内容。"
      }
    ]
  },
  "rules": {
    "eyebrow": "原则",
    "title": "黄金法则",
    "items": [
      "创建前先搜索——切勿重复创建供应商。",
      "填写你所在部门负责的内容；其他板块留给各自的负责人(彩色徽章会告诉你由谁负责)。",
      "用你自己的语言录入。Hub 会为团队其他成员自动翻译备注和录入的文本。",
      "先必填，再优选，最后可选——关注完整度面板。",
      "每一项主张都需要凭证——为法律和银行字段上传对应的文件。",
      "保存前通过电话核实银行信息。切勿信任仅通过邮件发送的银行变更。",
      "按提供的下拉选项选择——一致的取值能让筛选和报表保持准确。"
    ]
  },
  "owners": {
    "eyebrow": "职责",
    "title": "谁负责填写什么",
    "introA": "表单上的每个板块都带有一个彩色的负责人徽章。使用完整度面板下方的",
    "showFieldsFor": "显示字段范围",
    "introB": "筛选器，只显示你所在部门的板块。"
  },
  "depts": {
    "procurement": {
      "name": "采购",
      "owns": "供应商是谁、如何联系他们、他们销售什么"
    },
    "legal": {
      "name": "合规 / 法务",
      "owns": "法律主体身份、税务与贸易编号、已签署的文件"
    },
    "finance": {
      "name": "财务 / 资金",
      "owns": "付款条件和已核实的银行信息"
    },
    "logistics": {
      "name": "物流",
      "owns": "Incoterms、运输、交货周期、港口"
    },
    "quality": {
      "name": "寻源 / 质量",
      "owns": "工厂概况、认证、绩效"
    },
    "commercial": {
      "name": "商务 / 管理",
      "owns": "风险、谈判态势、战略地位"
    },
    "general": {
      "name": "任何团队",
      "owns": "社交链接、内部备注、自定义字段"
    }
  },
  "tierLabels": {
    "required": "必填",
    "preferred": "优选",
    "optional": "可选"
  },
  "steps": {
    "eyebrow": "工作流程",
    "title": "分步操作——填写顺序",
    "items": [
      {
        "n": 1,
        "title": "创建前先搜索",
        "body": "打开供应商目录并搜索公司名称(也试试中文名称)。如果已存在，请打开并更新它——不要创建重复档案。"
      },
      {
        "n": 2,
        "title": "从采购基础信息开始",
        "dept": "procurement",
        "body": "填写公司名称、概况、分类、联系方式和联系人。仅此一项就能让档案在整个 Hub 中可用。"
      },
      {
        "n": 3,
        "title": "移交给合规 / 法务",
        "dept": "legal",
        "body": "法律主体身份以及贸易与税务编号，然后在文件板块上传营业执照和证书。"
      },
      {
        "n": 4,
        "title": "财务核实付款",
        "dept": "finance",
        "body": "付款条件和已核实的银行信息。保存前通过电话确认任何银行信息。"
      },
      {
        "n": 5,
        "title": "物流与质量补充运营信息",
        "dept": "logistics",
        "body": "Incoterms 和运输(物流)，然后是工厂概况以及质量与绩效(寻源/质量)。"
      },
      {
        "n": 6,
        "title": "商务与管理收尾",
        "dept": "commercial",
        "body": "记录风险项，收集谈判情报，并设定战略地位。"
      },
      {
        "n": 7,
        "title": "检查完整度，然后保存",
        "body": "关注档案完整度面板。争取拿到绿色的\"就绪\"徽章(所有必填项完成)，然后随时间持续提升优选和可选项。"
      }
    ]
  },
  "sectionsHead": {
    "eyebrow": "字段参考",
    "title": "每个板块详解",
    "intro": "表单的 21 个板块，按填写顺序排列。每个板块都会显示其负责人，以及对于一份完整档案而言它是必填、优选还是可选。"
  },
  "sections": [
    {
      "id": "company-name",
      "title": "公司名称",
      "what": "在整个 Hub 中标识该供应商的那一行内容。请务必填写完全准确——其他每个应用(采购、财务、库存)都会读取它。",
      "fields": [
        {
          "name": "公司 / 法定名称",
          "how": "使用官方注册名称。如果是中国公司，请录入中文名称——Hub 会为英文/阿拉伯文读者自动翻译。"
        },
        {
          "name": "显示 / 简称",
          "how": "用于列表和 PO 的简洁名称(例如\"Ningbo Sunrise\")。此处省略法律后缀。"
        },
        {
          "name": "供应商类型",
          "how": "从下拉菜单中选择：制造商、贸易商、代理商、备件、机械、包装、纺织、化工、物流……选择他们的主要属性。"
        }
      ],
      "tip": "先搜索目录(见步骤 1)。一家真实公司 = 一份档案。切勿为同一家工厂创建第二张卡片。"
    },
    {
      "id": "company-profile",
      "title": "公司概况",
      "what": "对该企业的快速画像，让任何打开档案的人都能了解自己在与谁打交道。",
      "fields": [
        {
          "name": "成立年份",
          "how": "四位数年份。长久的经营履历是一种信任信号。"
        },
        {
          "name": "员工人数区间",
          "how": "从下拉菜单中选择区间——可作为产能和稳定性的参考。"
        },
        {
          "name": "业务描述",
          "how": "一到两句话：他们生产/做什么以及他们的专长。可用任何语言书写；将自动翻译。"
        },
        {
          "name": "网站",
          "how": "包含 https:// 的完整 URL。"
        }
      ]
    },
    {
      "id": "classifications",
      "title": "分类",
      "what": "让所有人能够按供应商所提供的内容进行筛选和分组的标签。",
      "fields": [
        {
          "name": "分类",
          "how": "从下拉菜单中选择类别(机械、备件、纺织、化工、配件……)。"
        },
        {
          "name": "标签",
          "how": "为细分能力添加自由关键词(例如\"针\"、\"伺服电机\")。"
        }
      ]
    },
    {
      "id": "contact-details",
      "title": "联系方式",
      "what": "联系该公司的主要、官方途径。个人联系人放在下一个板块。",
      "fields": [
        {
          "name": "主电话",
          "how": "包含国家区号(例如 +86 …)。"
        },
        {
          "name": "主邮箱",
          "how": "公司的综合/销售邮箱。"
        },
        {
          "name": "地址、城市、国家/地区",
          "how": "他们的主要营业地址。国家/地区会驱动下游的报表和默认币种。"
        }
      ]
    },
    {
      "id": "contact-persons",
      "title": "联系人",
      "what": "你实际打交道的真实人员。你可以添加多位——标记谁有决策权以及谁是你的主要联系人。",
      "fields": [
        {
          "name": "姓名与职务",
          "how": "添加每个人；从下拉菜单中选择他们的职务(销售、负责人、工程师、财务……)。"
        },
        {
          "name": "决策者 / 主要联系人开关",
          "how": "标记拍板签字的人，以及你日常打交道的人。"
        },
        {
          "name": "渠道(WeChat、WeCom、WhatsApp、Telegram、Line、Skype)",
          "how": "填写他们实际会回复的应用。然后设置首选渠道。"
        },
        {
          "name": "首选语言",
          "how": "选择他们的语言，让团队知道该如何给他们写信。"
        },
        {
          "name": "时区、可联系时段、可靠性、响应速度",
          "how": "可选但很有价值——为下一个联系他们的人设定预期。"
        }
      ],
      "tip": "一个带有 WeChat ID 和已知时区的决策者，胜过十个通用的 info@ 邮箱。"
    },
    {
      "id": "messaging-ids",
      "title": "即时通讯 ID",
      "what": "公司层面的聊天身份(区别于单个个人)。",
      "fields": [
        {
          "name": "WeChat ID / 公众号",
          "how": "公司的 WeChat 账号或公众号。"
        },
        {
          "name": "提供 WeChat 销售群",
          "how": "如果他们运营买家群聊，请打开此开关。"
        },
        {
          "name": "提供 WeCom 支持",
          "how": "如果他们使用 WeCom(企业微信)提供支持，请打开此开关。"
        }
      ]
    },
    {
      "id": "legal-identity",
      "title": "法律主体身份",
      "what": "贸易名称背后依法注册的实体。在任何合同或首次付款之前必填。",
      "fields": [
        {
          "name": "法律主体名称",
          "how": "完全按照营业执照上的名称——包括法律后缀。"
        },
        {
          "name": "注册号",
          "how": "公司注册 / 设立登记号。"
        },
        {
          "name": "注册国家/地区与实体类型",
          "how": "他们在何处、以何种形式注册(Ltd、Co. 等)。"
        },
        {
          "name": "注册(法定)地址",
          "how": "官方记录上的地址——可能与经营地址不同。"
        }
      ],
      "tip": "将这些信息与文件板块中上传的营业执照交叉核对。它们必须一致。"
    },
    {
      "id": "trade-tax-ids",
      "title": "贸易与税务编号",
      "what": "开具发票、海关和合规所需的税务及跨境贸易标识。将鼠标悬停在每个字段的 (?) 上以查看说明。",
      "fields": [
        {
          "name": "税号 / 增值税号",
          "how": "供应商的税务登记号。"
        },
        {
          "name": "统一社会信用代码(USCI)",
          "how": "针对中国供应商——执照上的 18 位代码。"
        },
        {
          "name": "进出口许可证",
          "how": "如果他们自行进行国际运输，则填写其海关注册信息。"
        }
      ]
    },
    {
      "id": "payment-info",
      "title": "付款信息",
      "what": "我们如何以及向何处向他们付款。这是最敏感的板块——由财务负责。",
      "fields": [
        {
          "name": "付款条件",
          "how": "从下拉菜单中选择：T/T、L/C、D/P、D/A、Net 30/60……与已签署的协议一致。"
        },
        {
          "name": "币种",
          "how": "协议的币种。"
        },
        {
          "name": "银行名称、账户名称、账号 / IBAN、SWIFT",
          "how": "完全按照银行确认函录入。核实收款人名称与法律主体一致。"
        },
        {
          "name": "中间行 / 代理行",
          "how": "仅当银行要求用于国际转账时填写。"
        }
      ],
      "tip": "切勿仅凭邮件接受银行信息——诈骗者会拦截这些信息。通过电话向已知联系人确认任何变更，然后在此记录。"
    },
    {
      "id": "logistics-trade",
      "title": "物流与贸易",
      "what": "货物如何从他们那里运到我们这里。将鼠标悬停在每个字段的 (?) 上以查看定义。",
      "fields": [
        {
          "name": "Incoterms",
          "how": "选择约定的术语(EXW、FOB、CIF、DDP……)。它决定由谁支付运费并承担风险。"
        },
        {
          "name": "装运港",
          "how": "他们的货物通常从何处发运。"
        },
        {
          "name": "标准交货周期",
          "how": "从 PO 到可发货的典型天数。"
        },
        {
          "name": "包装 / 运输备注",
          "how": "关于他们如何包装或拼货的任何特殊说明。"
        }
      ]
    },
    {
      "id": "factory",
      "title": "工厂",
      "what": "供应商背后的生产能力。每个字段都有 (?) 说明应录入的内容。",
      "fields": [
        {
          "name": "工厂类型与位置",
          "how": "选择类型；记录工厂的实际所在地(可能与办公室不同)。"
        },
        {
          "name": "产能与产量(含单位)",
          "how": "录入数字并选择单位(件/月、吨/年……)。"
        },
        {
          "name": "可处理材料",
          "how": "列出他们能够处理的材料——用于与产品需求的匹配。"
        },
        {
          "name": "认证",
          "how": "ISO、CE 及类似认证——列出他们持有的认证。"
        },
        {
          "name": "交货周期(天)、旺季月份",
          "how": "生产交货周期，以及交货周期会拉长的繁忙月份。"
        },
        {
          "name": "工厂走访日期",
          "how": "我们上次到现场审核/走访的日期。为空表示从未走访。"
        }
      ]
    },
    {
      "id": "catalogue",
      "title": "产品目录",
      "what": "通往他们所提供内容的链接。",
      "fields": [
        {
          "name": "产品目录 / 价格表链接",
          "how": "粘贴链接，或在文件板块上传文件。"
        }
      ]
    },
    {
      "id": "products",
      "title": "产品",
      "what": "该供应商提供给我们的具体产品。",
      "fields": [
        {
          "name": "供应的产品",
          "how": "列出或链接相关项目。将供应商与产品和采购应用关联起来。"
        }
      ]
    },
    {
      "id": "quality-performance",
      "title": "质量与绩效",
      "what": "决定我们是否继续向其采购的过往业绩记录。",
      "fields": [
        {
          "name": "质量认证",
          "how": "他们通过认证的标准。"
        },
        {
          "name": "不良率 / 准时交货率",
          "how": "在已知的情况下录入实测百分比。"
        },
        {
          "name": "质量备注",
          "how": "关于反复出现的问题或优势的自由备注(自动翻译)。"
        },
        {
          "name": "绩效评分",
          "how": "使用滑块为他们评分；会随时间更新。"
        }
      ]
    },
    {
      "id": "risk",
      "title": "风险",
      "what": "已知风险，逐项记录，以免遗漏。",
      "fields": [
        {
          "name": "风险项",
          "how": "每个风险添加一行。从下拉菜单中选择维度(财务、供应、质量、地缘政治……)、严重程度和状态。"
        },
        {
          "name": "描述与缓解措施",
          "how": "风险是什么，以及我们正在采取什么应对措施。"
        }
      ]
    },
    {
      "id": "negotiation",
      "title": "谈判",
      "what": "让下一次谈判更有底气的情报。",
      "fields": [
        {
          "name": "灵活度(付款、沟通、定制化、独家性)",
          "how": "根据以往交往设定各项级别。"
        },
        {
          "name": "首选策略与筹码点",
          "how": "对他们有效的方式，以及我们在哪些方面拥有筹码。"
        }
      ]
    },
    {
      "id": "strategic-status",
      "title": "战略地位",
      "what": "管理层对该供应商对我们重要程度的判断。",
      "fields": [
        {
          "name": "战略地位",
          "how": "从下拉菜单中选择：战略、优选、已批准、试验、备用、观察期……"
        },
        {
          "name": "内部评分",
          "how": "一个整体内部评级。由管理层/商务设定。"
        }
      ]
    },
    {
      "id": "documents",
      "title": "文件",
      "what": "以上一切内容背后的凭证。上传真实文件。",
      "fields": [
        {
          "name": "营业执照、证书、合同、NDA",
          "how": "上传清晰的扫描件/PDF。这些用于支撑法律和财务板块。"
        }
      ],
      "tip": "如果某个字段声称拥有某项认证或某个银行账户，对应的文件就应放在此处。"
    },
    {
      "id": "social-media",
      "title": "社交媒体",
      "what": "公开形象——有助于核实和背景调查。",
      "fields": [
        {
          "name": "LinkedIn、Alibaba、Made-in-China 等",
          "how": "粘贴主页/店铺链接。"
        }
      ]
    },
    {
      "id": "notes",
      "title": "内部备注",
      "what": "团队应当知道但又不适合放进某个字段的任何内容。",
      "fields": [
        {
          "name": "备注",
          "how": "用你自己的语言自由书写——队友会看到自动翻译成他们语言的版本。"
        }
      ]
    },
    {
      "id": "custom-fields",
      "title": "自定义字段",
      "what": "针对你的工作流程的额外键/值详情。",
      "fields": [
        {
          "name": "自定义键 / 值",
          "how": "只添加你日后真正会搜索或用于报表的内容。"
        }
      ]
    }
  ],
  "completeness": {
    "eyebrow": "你的进度仪表",
    "title": "读懂档案完整度面板",
    "intro": "表单顶部的面板会跟踪档案的完整程度，分为三个层级外加一个总体评分。",
    "required": "让供应商可用的最低要求：名称、联系方式、法律主体身份和付款基础信息。只有在每个必填字段都填好后，才会出现绿色的\"就绪\"徽章。",
    "preferred": "强烈推荐：概况、工厂、物流、质量、风险。这些支撑良好的寻源决策。",
    "optional": "锦上添花的深度信息：谈判情报、社交链接、自定义字段。随合作关系的发展逐步填写。",
    "overallTitle": "总体",
    "overall": "贯穿所有层级的单一百分比。用它一眼看出某份供应商档案的成熟程度——但\"就绪\"(所有必填项完成)才是上线的真正门槛。"
  },
  "bilingual": {
    "eyebrow": "面向混合团队",
    "title": "用中文、阿拉伯文和英文协作",
    "cards": [
      {
        "h": "用你的语言录入",
        "b": "用对你而言最自然的语言录入备注、描述和名称——中国员工用中文，其他人用 English 或 العربية。不要重复录入数据。"
      },
      {
        "h": "每个人都读自己的语言",
        "b": "录入的文本会自动翻译成每位查看者的语言显示，并带有一键\"显示原文\"开关。整个界面、标签和下拉选项也会随语言选择器一起切换。"
      },
      {
        "h": "善用 (?) 帮助提示",
        "b": "许多字段——尤其是贸易与税务编号、物流和工厂——都有一个小小的 (?) 图标。将鼠标悬停在上面，可查看关于究竟应录入什么以及在哪里找到它的双语说明。"
      }
    ]
  },
  "mistakes": {
    "eyebrow": "避免这些",
    "title": "常见错误",
    "items": [
      "因为没有搜索中文名称而创建了重复档案。",
      "把个人手机号填进公司电话字段——把人员信息保留在联系人中。",
      "未经电话确认就照搬邮件中的银行信息。",
      "用猜测去填写其他部门的板块，而不是留给负责人。",
      "把下拉取值当作自由文本录入(例如在某处手打\"FOB\"而不是选择该 Incoterm)。",
      "声称拥有某项认证却没有上传文件加以佐证。"
    ]
  },
  "checklist": {
    "eyebrow": "最后一遍",
    "title": "保存前",
    "items": [
      "已先搜索——这不是重复档案。",
      "公司名称为官方注册名称；已设定供应商类型。",
      "至少有一位联系人，并设定了首选渠道。",
      "法律主体身份与上传的营业执照一致。",
      "银行信息已通过电话核实并存档。",
      "所有下拉项均已选择(而非手打);需要的地方已选定单位。",
      "完整度面板显示绿色的\"就绪\"徽章。"
    ],
    "ctaAdd": "立即新增供应商",
    "ctaBack": "返回知识库"
  }
};

/* ════════════════════════ العربية ════════════════════════ */
const AR: Content = {
  "breadcrumb": {
    "knowledge": "قاعدة المعرفة",
    "current": "دليل إدخال بيانات المورّد"
  },
  "onThisPage": "في هذه الصفحة",
  "hero": {
    "eyebrow": "دليل إعداد المورّدين",
    "title": "كيفية تعبئة بيانات المورّد — بالطريقة الصحيحة، خطوة بخطوة",
    "body": "يغذّي سجل المورّد تطبيقات الشراء والمالية والمخزون ومركز قيادة التوريد. البيانات الجيدة المُدخَلة تعني قرارات جيدة مُخرَجة. يوضّح هذا الدليل بالضبط ما الذي يجب إدخاله في كل قسم، ومن المسؤول عنه، والترتيب الذي يجب اتباعه — حتى يتمكن أي زميل من إعداد مورّد بشكل نظيف وكامل.",
    "ctaOpen": "فتح إضافة مورّد",
    "ctaJump": "الانتقال إلى الخطوات السبع"
  },
  "toc": [
    {
      "id": "why",
      "label": "لماذا هذا مهم"
    },
    {
      "id": "rules",
      "label": "القواعد الذهبية"
    },
    {
      "id": "owners",
      "label": "من يعبّئ ماذا"
    },
    {
      "id": "steps",
      "label": "سير العمل خطوة بخطوة"
    },
    {
      "id": "sections",
      "label": "شرح كل قسم"
    },
    {
      "id": "completeness",
      "label": "اكتمال الملف"
    },
    {
      "id": "bilingual",
      "label": "العمل بلغتين"
    },
    {
      "id": "mistakes",
      "label": "الأخطاء الشائعة"
    },
    {
      "id": "checklist",
      "label": "قبل الحفظ"
    }
  ],
  "why": {
    "eyebrow": "ابدأ من هنا",
    "title": "لماذا تهمّ بيانات المورّد",
    "intro": "كل تطبيق آخر يقرأ ما تكتبه هنا. بطاقة المورّد هي المصدر الوحيد للحقيقة.",
    "cards": [
      {
        "h": "سجل واحد، تطبيقات متعددة",
        "b": "الشراء ينشئ منه أوامر الشراء، والمالية تدفع منه، والمخزون يستلم مقابله، ومركز قيادة التوريد يقيّمه. اسم خاطئ أو رقم بنكي خاطئ يعطّلها جميعًا."
      },
      {
        "h": "القرارات تتبع البيانات",
        "b": "المخاطر وزمن التوريد وطاقة المصنع ودرجات الأداء هي ما تستخدمه الإدارة لاختيار المورّدين. الحقول الفارغة = قرارات عمياء."
      },
      {
        "h": "مورّد واحد = بطاقة واحدة",
        "b": "النسخ المكررة تقسّم السجل وتربك التقارير. ابحث دائمًا أولًا."
      },
      {
        "h": "تتراكم بمرور الوقت",
        "b": "لست مضطرًا لتعبئة كل شيء دفعة واحدة. أدخِل الحقول المطلوبة اليوم؛ ويثري الفريق الباقي مع نمو العلاقة."
      }
    ]
  },
  "rules": {
    "eyebrow": "المبادئ",
    "title": "القواعد الذهبية",
    "items": [
      "ابحث قبل الإنشاء — لا تكرّر مورّدًا أبدًا.",
      "عبّئ ما يخص قسمك؛ واترك الأقسام الأخرى لأصحابها (الشارة الملوّنة تخبرك بمن المسؤول).",
      "اكتب بلغتك الخاصة. يقوم الـ Hub بالترجمة التلقائية للملاحظات والنصوص المكتوبة لبقية الفريق.",
      "المطلوب أولًا، ثم المفضّل، ثم الاختياري — راقب لوحة الاكتمال.",
      "كل ادعاء يحتاج إثباتًا — ارفع المستند المطابق للحقول القانونية والبنكية.",
      "تحقّق من التفاصيل البنكية هاتفيًا قبل الحفظ. لا تثق أبدًا بتغييرات بنكية مُرسَلة عبر البريد الإلكتروني فقط.",
      "استخدم القوائم المنسدلة كما هي — القيم المتسقة تحافظ على دقة التصفية والتقارير."
    ]
  },
  "owners": {
    "eyebrow": "المسؤولية",
    "title": "من يعبّئ ماذا",
    "introA": "يحمل كل قسم في النموذج شارة ملوّنة لصاحبه. استخدم فلتر",
    "showFieldsFor": "عرض حقول قسم",
    "introB": "أسفل لوحة الاكتمال لإظهار أقسام قسمك فقط."
  },
  "depts": {
    "procurement": {
      "name": "المشتريات",
      "owns": "من هو المورّد، وكيفية الوصول إليه، وما الذي يبيعه"
    },
    "legal": {
      "name": "الامتثال / الشؤون القانونية",
      "owns": "الهوية القانونية، ومعرّفات الضرائب والتجارة، والمستندات الموقّعة"
    },
    "finance": {
      "name": "المالية / الخزينة",
      "owns": "شروط الدفع والتفاصيل البنكية المُتحقَّق منها"
    },
    "logistics": {
      "name": "اللوجستيات",
      "owns": "Incoterms، والشحن، وأزمنة التوريد، والموانئ"
    },
    "quality": {
      "name": "التوريد / الجودة",
      "owns": "ملف المصنع، والشهادات، والأداء"
    },
    "commercial": {
      "name": "التجاري / الإدارة",
      "owns": "المخاطر، وموقف التفاوض، والوضع الاستراتيجي"
    },
    "general": {
      "name": "أي فريق",
      "owns": "روابط التواصل الاجتماعي، والملاحظات الداخلية، والحقول المخصّصة"
    }
  },
  "tierLabels": {
    "required": "مطلوب",
    "preferred": "مفضّل",
    "optional": "اختياري"
  },
  "steps": {
    "eyebrow": "سير العمل",
    "title": "خطوة بخطوة — ترتيب التعبئة",
    "items": [
      {
        "n": 1,
        "title": "ابحث قبل الإنشاء",
        "body": "افتح دليل المورّدين وابحث عن اسم الشركة (جرّب الاسم الصيني أيضًا). إذا كان موجودًا، افتحه وحدّثه — لا تنشئ نسخة مكررة."
      },
      {
        "n": 2,
        "title": "ابدأ بأساسيات المشتريات",
        "dept": "procurement",
        "body": "عبّئ اسم الشركة، والملف التعريفي، والتصنيفات، وتفاصيل الاتصال، وأشخاص الاتصال. هذا وحده يجعل السجل قابلًا للاستخدام عبر الـ Hub."
      },
      {
        "n": 3,
        "title": "التسليم إلى الامتثال / الشؤون القانونية",
        "dept": "legal",
        "body": "الهوية القانونية ومعرّفات التجارة والضرائب، ثم ارفع الرخصة التجارية والشهادات في قسم المستندات."
      },
      {
        "n": 4,
        "title": "المالية تتحقّق من الدفع",
        "dept": "finance",
        "body": "شروط الدفع والتفاصيل البنكية المُتحقَّق منها. أكّد أي معلومات بنكية هاتفيًا قبل الحفظ."
      },
      {
        "n": 5,
        "title": "اللوجستيات والجودة تضيفان العمليات",
        "dept": "logistics",
        "body": "Incoterms والشحن (اللوجستيات)، ثم ملف المصنع والجودة والأداء (التوريد/الجودة)."
      },
      {
        "n": 6,
        "title": "التجاري والإدارة يختمان العمل",
        "dept": "commercial",
        "body": "سجّل عناصر المخاطر، والتقط معلومات التفاوض، وحدّد الوضع الاستراتيجي."
      },
      {
        "n": 7,
        "title": "تحقّق من الاكتمال، ثم احفظ",
        "body": "راقب لوحة اكتمال الملف. استهدف الشارة الخضراء «جاهز» (اكتمال جميع الحقول المطلوبة)، ثم استمر في رفع المفضّل والاختياري بمرور الوقت."
      }
    ]
  },
  "sectionsHead": {
    "eyebrow": "مرجع الحقول",
    "title": "شرح كل قسم",
    "intro": "الأقسام الـ 21 في النموذج، بترتيب التعبئة. يُظهر كل قسم صاحبه وما إذا كان مطلوبًا أو مفضّلًا أو اختياريًا لملف مكتمل."
  },
  "sections": [
    {
      "id": "company-name",
      "title": "اسم الشركة",
      "what": "السطر الوحيد الذي يحدّد المورّد في كل مكان داخل الـ Hub. اضبط هذا بدقة تامة — فكل تطبيق آخر (الشراء، المالية، المخزون) يقرأه.",
      "fields": [
        {
          "name": "الاسم القانوني / اسم الشركة",
          "how": "استخدم الاسم الرسمي المسجّل. إذا كانت شركة صينية، اكتب الاسم الصيني — يقوم الـ Hub بترجمته تلقائيًا للقرّاء بالإنجليزية/العربية."
        },
        {
          "name": "الاسم المعروض / المختصر",
          "how": "اسم نظيف للقوائم وأوامر الشراء (مثل «Ningbo Sunrise»). احذف اللواحق القانونية هنا."
        },
        {
          "name": "نوع المورّد",
          "how": "اختر من القائمة المنسدلة: مُصنّع، تجاري، وكيل، قطع غيار، آلات، تغليف، نسيج، كيماويات، لوجستيات… اختر ما هم عليه بشكل أساسي."
        }
      ],
      "tip": "ابحث في الدليل أولًا (انظر الخطوة 1). شركة واقعية واحدة = سجل واحد. لا تنشئ أبدًا بطاقة ثانية للمصنع نفسه."
    },
    {
      "id": "company-profile",
      "title": "الملف التعريفي للشركة",
      "what": "صورة سريعة عن النشاط التجاري ليفهم أي شخص يفتح السجل مع من يتعامل.",
      "fields": [
        {
          "name": "سنة التأسيس",
          "how": "سنة من أربعة أرقام. السجل الطويل إشارة ثقة."
        },
        {
          "name": "نطاق عدد الموظفين",
          "how": "اختر النطاق من القائمة المنسدلة — مؤشر للطاقة والاستقرار."
        },
        {
          "name": "وصف النشاط التجاري",
          "how": "جملة أو جملتان: ما الذي يصنعونه/يفعلونه وتخصّصهم. اكتب بأي لغة؛ تُترجَم تلقائيًا."
        },
        {
          "name": "الموقع الإلكتروني",
          "how": "عنوان URL كامل بما في ذلك https://."
        }
      ]
    },
    {
      "id": "classifications",
      "title": "التصنيفات",
      "what": "وسوم تتيح للجميع تصفية المورّدين وتجميعهم حسب ما يقدّمونه.",
      "fields": [
        {
          "name": "التصنيف",
          "how": "اختر الفئة من القائمة المنسدلة (آلات، قطع غيار، نسيج، كيماويات، إكسسوارات…)."
        },
        {
          "name": "الوسوم",
          "how": "أضِف كلمات مفتاحية حرة للقدرات المتخصّصة (مثل «إبر»، «محركات سيرفو»)."
        }
      ]
    },
    {
      "id": "contact-details",
      "title": "تفاصيل الاتصال",
      "what": "الطريقة الأساسية والرسمية للوصول إلى الشركة. جهات الاتصال الشخصية توضع في القسم التالي.",
      "fields": [
        {
          "name": "الهاتف الرئيسي",
          "how": "أدرِج رمز الدولة (مثل +86 …)."
        },
        {
          "name": "البريد الإلكتروني الرئيسي",
          "how": "البريد العام / بريد المبيعات للشركة."
        },
        {
          "name": "العنوان والمدينة والدولة",
          "how": "عنوان العمل الرئيسي. الدولة تحدّد التقارير والعملة الافتراضية لاحقًا."
        }
      ]
    },
    {
      "id": "contact-persons",
      "title": "أشخاص الاتصال",
      "what": "الأشخاص الحقيقيون الذين تتحدث إليهم. يمكنك إضافة عدة أشخاص — حدّد من يتخذ القرار ومن جهة اتصالك الأساسية.",
      "fields": [
        {
          "name": "الاسم والدور",
          "how": "أضِف كل شخص؛ اختر دوره من القائمة المنسدلة (مبيعات، مالك، مهندس، مالية…)."
        },
        {
          "name": "مفاتيح متخذ القرار / الأساسي",
          "how": "حدّد الشخص الذي يعتمد القرارات، والذي تتعامل معه يوميًا."
        },
        {
          "name": "القنوات (WeChat، WeCom، WhatsApp، Telegram، Line، Skype)",
          "how": "عبّئ التطبيقات التي يردّون عليها فعليًا. ثم حدّد القناة المفضّلة."
        },
        {
          "name": "اللغة المفضّلة",
          "how": "اختر لغتهم ليعرف الفريق كيف يكاتبهم."
        },
        {
          "name": "المنطقة الزمنية، وساعات التوفّر، والموثوقية، وسرعة الاستجابة",
          "how": "اختيارية لكنها قيّمة — تحدّد التوقعات للشخص التالي الذي يتواصل معهم."
        }
      ],
      "tip": "متخذ قرار يملك معرّف WeChat ومنطقة زمنية معروفة يساوي عشرة عناوين info@ عامة."
    },
    {
      "id": "messaging-ids",
      "title": "معرّفات المراسلة",
      "what": "هويات الدردشة على مستوى الشركة (منفصلة عن أي شخص بعينه).",
      "fields": [
        {
          "name": "معرّف WeChat / الحساب الرسمي",
          "how": "معرّف WeChat للشركة أو حسابها الرسمي."
        },
        {
          "name": "توفّر مجموعة مبيعات WeChat",
          "how": "فعّله إذا كانوا يديرون دردشة جماعية للمشترين."
        },
        {
          "name": "توفّر دعم WeCom",
          "how": "فعّله إذا كانوا يستخدمون WeCom (企业微信) للدعم."
        }
      ]
    },
    {
      "id": "legal-identity",
      "title": "الهوية القانونية",
      "what": "الكيان المسجّل قانونيًا خلف الاسم التجاري. مطلوب قبل أي عقد أو أول دفعة.",
      "fields": [
        {
          "name": "اسم الكيان القانوني",
          "how": "كما هو تمامًا في الرخصة التجارية — بما في ذلك اللاحقة القانونية."
        },
        {
          "name": "رقم التسجيل",
          "how": "رقم تسجيل / تأسيس الشركة."
        },
        {
          "name": "دولة التأسيس ونوع الكيان",
          "how": "أين وكيف تم تسجيلهم (Ltd، Co.، إلخ)."
        },
        {
          "name": "العنوان المسجّل (القانوني)",
          "how": "العنوان في السجلات الرسمية — قد يختلف عن عنوان التشغيل."
        }
      ],
      "tip": "تحقّق من مطابقة هذه مع الرخصة التجارية المرفوعة في قسم المستندات. يجب أن تتطابق."
    },
    {
      "id": "trade-tax-ids",
      "title": "معرّفات التجارة والضرائب",
      "what": "معرّفات ضريبية وتجارية عابرة للحدود لازمة للفواتير والجمارك والامتثال. مرّر فوق علامة (?) في كل حقل للحصول على شرح.",
      "fields": [
        {
          "name": "المعرّف الضريبي / رقم VAT",
          "how": "رقم التسجيل الضريبي للمورّد."
        },
        {
          "name": "رمز الائتمان الاجتماعي الموحّد (USCI)",
          "how": "للمورّدين الصينيين — الرمز المكوّن من 18 حرفًا في الرخصة."
        },
        {
          "name": "رخصة الاستيراد / التصدير",
          "how": "تسجيلهم الجمركي، إذا كانوا يشحنون دوليًا بأنفسهم."
        }
      ]
    },
    {
      "id": "payment-info",
      "title": "معلومات الدفع",
      "what": "كيف وأين ندفع لهم. هذا أكثر الأقسام حساسية — المالية مسؤولة عنه.",
      "fields": [
        {
          "name": "شروط الدفع",
          "how": "اختر من القائمة المنسدلة: T/T، L/C، D/P، D/A، Net 30/60… طابِق الاتفاقية الموقّعة."
        },
        {
          "name": "العملة",
          "how": "عملة الاتفاقية."
        },
        {
          "name": "اسم البنك، واسم الحساب، ورقم الحساب / IBAN، وSWIFT",
          "how": "أدخِلها كما هي تمامًا في خطاب التأكيد البنكي. تحقّق من مطابقة اسم المستفيد للكيان القانوني."
        },
        {
          "name": "البنك الوسيط / المراسل",
          "how": "فقط إذا كان البنك يتطلّبه للتحويلات الدولية."
        }
      ],
      "tip": "لا تقبل أبدًا التفاصيل البنكية عبر البريد الإلكتروني وحده — يعترضها المحتالون. أكّد أي تغيير هاتفيًا مع جهة اتصال معروفة، ثم سجّله هنا."
    },
    {
      "id": "logistics-trade",
      "title": "اللوجستيات والتجارة",
      "what": "كيف تنتقل البضائع منهم إلينا. مرّر فوق علامة (?) في كل حقل للتعريفات.",
      "fields": [
        {
          "name": "Incoterms",
          "how": "اختر الشرط المتفق عليه (EXW، FOB، CIF، DDP…). يحدّد من يدفع الشحن ويتحمّل المخاطر."
        },
        {
          "name": "ميناء التحميل",
          "how": "المكان الذي تُشحن منه بضائعهم عادةً."
        },
        {
          "name": "زمن التوريد القياسي",
          "how": "عدد الأيام المعتاد من أمر الشراء حتى الجاهزية للشحن."
        },
        {
          "name": "ملاحظات التغليف / الشحن",
          "how": "أي شيء خاص حول كيفية تغليفهم أو تجميعهم للبضائع."
        }
      ]
    },
    {
      "id": "factory",
      "title": "المصنع",
      "what": "القدرة الإنتاجية خلف المورّد. كل حقل يحمل علامة (?) تشرح ما يجب إدخاله.",
      "fields": [
        {
          "name": "نوع المصنع وموقعه",
          "how": "اختر النوع؛ سجّل المكان الفعلي للمصنع (قد يختلف عن المكتب)."
        },
        {
          "name": "الطاقة والإنتاج (مع الوحدات)",
          "how": "أدخِل الرقم واختر الوحدة (قطعة/شهر، طن/سنة…)."
        },
        {
          "name": "المواد المدعومة",
          "how": "اذكر المواد التي يمكنهم العمل بها — تُستخدم للمطابقة مع احتياجات المنتجات."
        },
        {
          "name": "الشهادات",
          "how": "ISO وCE وما شابه — اذكر ما يحملونه."
        },
        {
          "name": "زمن التوريد (أيام)، وأشهر ذروة الموسم",
          "how": "زمن توريد الإنتاج، والأشهر المزدحمة التي يطول فيها زمن التوريد."
        },
        {
          "name": "تاريخ زيارة المصنع",
          "how": "تاريخ آخر تدقيق/زيارة ميدانية. الفراغ يعني عدم الزيارة مطلقًا."
        }
      ]
    },
    {
      "id": "catalogue",
      "title": "الكتالوج",
      "what": "روابط لما يقدّمونه.",
      "fields": [
        {
          "name": "رابط الكتالوج / قائمة الأسعار",
          "how": "الصق رابطًا، أو ارفع الملف في قسم المستندات."
        }
      ]
    },
    {
      "id": "products",
      "title": "المنتجات",
      "what": "المنتجات المحدّدة التي يوفّرها هذا المورّد لنا.",
      "fields": [
        {
          "name": "المنتجات المورّدة",
          "how": "اذكر العناصر أو اربطها. يربط المورّد بتطبيقي المنتجات والشراء."
        }
      ]
    },
    {
      "id": "quality-performance",
      "title": "الجودة والأداء",
      "what": "السجل الذي يحدّد ما إذا كنا سنستمر في الشراء منهم.",
      "fields": [
        {
          "name": "شهادات الجودة",
          "how": "المعايير المعتمَدين بها."
        },
        {
          "name": "معدل العيوب / معدل التسليم في الوقت المحدّد",
          "how": "أدخِل النسب المقيسة حيثما كانت معروفة."
        },
        {
          "name": "ملاحظات الجودة",
          "how": "ملاحظات حرة حول المشكلات المتكررة أو نقاط القوة (تُترجَم تلقائيًا)."
        },
        {
          "name": "درجات الأداء",
          "how": "استخدم المؤشرات المنزلقة لتقييمهم؛ تُحدَّث بمرور الوقت."
        }
      ]
    },
    {
      "id": "risk",
      "title": "المخاطر",
      "what": "المخاطر المعروفة، مسجّلة عنصرًا بعنصر حتى لا يُنسى شيء.",
      "fields": [
        {
          "name": "عناصر المخاطر",
          "how": "أضِف صفًا لكل خطر. اختر البُعد (مالي، توريد، جودة، جيوسياسي…)، والشدّة، والحالة من القوائم المنسدلة."
        },
        {
          "name": "الوصف والتخفيف",
          "how": "ما هو الخطر، وما الذي نفعله بشأنه."
        }
      ]
    },
    {
      "id": "negotiation",
      "title": "التفاوض",
      "what": "معلومات تجعل المفاوضة التالية أقوى.",
      "fields": [
        {
          "name": "المرونة (الدفع، التواصل، التخصيص، الحصرية)",
          "how": "حدّد كل مستوى بناءً على التعاملات السابقة."
        },
        {
          "name": "التكتيكات المفضّلة ونقاط النفوذ",
          "how": "ما الذي ينجح معهم، وأين نملك نفوذًا."
        }
      ]
    },
    {
      "id": "strategic-status",
      "title": "الوضع الاستراتيجي",
      "what": "حُكم الإدارة على مدى أهمية هذا المورّد بالنسبة لنا.",
      "fields": [
        {
          "name": "الوضع الاستراتيجي",
          "how": "اختر من القائمة المنسدلة: استراتيجي، مفضّل، معتمَد، تجريبي، احتياطي، تحت المراقبة…"
        },
        {
          "name": "الدرجة الداخلية",
          "how": "تقييم داخلي إجمالي. تحدّده الإدارة/التجاري."
        }
      ]
    },
    {
      "id": "documents",
      "title": "المستندات",
      "what": "الإثبات خلف كل ما سبق. أرفِق الملفات الحقيقية.",
      "fields": [
        {
          "name": "الرخصة التجارية، والشهادات، والعقود، وNDA",
          "how": "ارفع نسخًا ممسوحة/ملفات PDF واضحة. تدعم هذه أقسام القانوني والمالية."
        }
      ],
      "tip": "إذا ادّعى حقل وجود شهادة أو حساب بنكي، فإن المستند المطابق ينتمي إلى هنا."
    },
    {
      "id": "social-media",
      "title": "وسائل التواصل الاجتماعي",
      "what": "الحضور العام — مفيد للتحقق وفحوصات الخلفية.",
      "fields": [
        {
          "name": "LinkedIn، Alibaba، Made-in-China، إلخ.",
          "how": "الصق روابط الملف الشخصي/المتجر."
        }
      ]
    },
    {
      "id": "notes",
      "title": "الملاحظات الداخلية",
      "what": "أي شيء يجب أن يعرفه الفريق ولا يناسب أي حقل.",
      "fields": [
        {
          "name": "الملاحظات",
          "how": "اكتب بحرية بلغتك الخاصة — يرى الزملاء النص مترجمًا تلقائيًا إلى لغتهم."
        }
      ]
    },
    {
      "id": "custom-fields",
      "title": "الحقول المخصّصة",
      "what": "تفاصيل إضافية على شكل مفتاح/قيمة خاصة بسير عملك.",
      "fields": [
        {
          "name": "المفتاح / القيمة المخصّصة",
          "how": "أضِف فقط ما ستبحث عنه أو تُعدّ عنه تقارير فعلًا لاحقًا."
        }
      ]
    }
  ],
  "completeness": {
    "eyebrow": "مقياس تقدّمك",
    "title": "قراءة لوحة اكتمال الملف",
    "intro": "تتتبّع اللوحة في أعلى النموذج مدى اكتمال السجل، في ثلاث فئات إضافة إلى درجة إجمالية.",
    "required": "الحد الأدنى لجعل المورّد قابلًا للاستخدام: الاسم، والاتصال، والهوية القانونية، وأساسيات الدفع. تظهر الشارة الخضراء «جاهز» فقط عند تعبئة كل حقل مطلوب.",
    "preferred": "موصى به بشدة: الملف التعريفي، والمصنع، واللوجستيات، والجودة، والمخاطر. هذه تدعم قرارات التوريد الجيدة.",
    "optional": "عمق مرغوب: معلومات التفاوض، وروابط التواصل الاجتماعي، والحقول المخصّصة. عبّئها مع نمو العلاقة.",
    "overallTitle": "الإجمالي",
    "overall": "نسبة مئوية واحدة عبر جميع الفئات. استخدمها لترى بلمحة مدى نضج سجل المورّد — لكن «جاهز» (اكتمال جميع الحقول المطلوبة) هو المعيار الحقيقي للتشغيل الفعلي."
  },
  "bilingual": {
    "eyebrow": "للفِرق المختلطة",
    "title": "العمل بالصينية والعربية والإنجليزية",
    "cards": [
      {
        "h": "اكتب بلغتك",
        "b": "أدخِل الملاحظات والأوصاف والأسماء بأي لغة طبيعية بالنسبة لك — الموظفون الصينيون بـ 中文، والآخرون بالإنجليزية أو العربية. لا تُدخِل البيانات مرتين."
      },
      {
        "h": "كل شخص يقرأ بلغته",
        "b": "يظهر النص المكتوب مترجمًا تلقائيًا إلى لغة كل مشاهِد، مع زر «إظهار النص الأصلي» بنقرة واحدة. كما تتبدّل الواجهة كاملةً والتسميات والقوائم المنسدلة مع مُحدّد اللغة."
      },
      {
        "h": "استخدم تلميحات المساعدة (?)",
        "b": "تحتوي حقول كثيرة — خصوصًا معرّفات التجارة والضرائب، واللوجستيات، والمصنع — على أيقونة صغيرة (?). مرّر فوقها للحصول على شرح ثنائي اللغة لما يجب إدخاله بالضبط وأين تجده."
      }
    ]
  },
  "mistakes": {
    "eyebrow": "تجنّب هذه",
    "title": "الأخطاء الشائعة",
    "items": [
      "إنشاء نسخة مكررة لأنك لم تبحث عن الاسم الصيني.",
      "وضع رقم جوّال شخص في حقل هاتف الشركة — احتفظ بالأشخاص في قسم أشخاص الاتصال.",
      "كتابة التفاصيل البنكية من بريد إلكتروني دون تأكيد هاتفي.",
      "تعبئة قسم قسم آخر بالتخمين بدلًا من تركه لصاحبه.",
      "كتابة قيم القوائم المنسدلة كنص حر (مثل كتابة «FOB» في مكان ما بدلًا من اختيار Incoterm).",
      "ادّعاء شهادة دون رفع مستند يدعمها."
    ]
  },
  "checklist": {
    "eyebrow": "المراجعة النهائية",
    "title": "قبل الحفظ",
    "items": [
      "بحثتَ أولًا — هذا ليس نسخة مكررة.",
      "اسم الشركة هو الاسم الرسمي المسجّل؛ ونوع المورّد محدّد.",
      "شخص اتصال واحد على الأقل، مع قناة مفضّلة.",
      "الهوية القانونية تطابق الرخصة التجارية المرفوعة.",
      "التفاصيل البنكية مُتحقَّق منها هاتفيًا وموثّقة.",
      "جميع القوائم المنسدلة مُختارة (وليست مكتوبة)؛ والوحدات مُختارة حيثما لزم.",
      "لوحة الاكتمال تُظهر الشارة الخضراء «جاهز»."
    ],
    "ctaAdd": "أضِف مورّدًا الآن",
    "ctaBack": "العودة إلى قاعدة المعرفة"
  }
};

const CONTENT: Record<Lang, Content> = { en: EN, zh: ZH, ar: AR };

/* ── helpers ── */
function DeptDot({ d }: { d: DeptKey }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${DEPT_STYLE[d].dot}`} aria-hidden />;
}

export default function SupplierDataGuidePage() {
  const { lang } = useTranslation({});
  const c = CONTENT[lang] ?? EN;
  const dir = lang === "ar" ? "rtl" : "ltr";

  const TierBadge = ({ t }: { t: Tier }) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${TIER_STYLE[t]}`}>
      {c.tierLabels[t]}
    </span>
  );

  return (
    <div dir={dir} className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Link href="/knowledge" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" />
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] min-w-0">
            <KnowledgeIcon size={14} />
            <Link href="/knowledge" className="hover:text-[var(--text-primary)]">{c.breadcrumb.knowledge}</Link>
            <span>/</span>
            <span className="text-[var(--text-secondary)] truncate">{c.breadcrumb.current}</span>
          </div>
        </div>

        {/* Hero */}
        <header className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 md:p-10 mb-8">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--accent,#0066FF)] mb-3">
            <HandshakeIcon size={14} /> {c.hero.eyebrow}
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight max-w-3xl">{c.hero.title}</h1>
          <p className="mt-3 text-[14px] md:text-[15px] leading-relaxed text-[var(--text-faint)] max-w-3xl">{c.hero.body}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/suppliers/new" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent,#0066FF)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity">
              <HandshakeIcon size={14} /> {c.hero.ctaOpen}
            </Link>
            <a href="#steps" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              {c.hero.ctaJump}
            </a>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
          {/* TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)] mb-3">{c.onThisPage}</div>
              <nav className="space-y-1">
                {c.toc.map((t) => (
                  <a key={t.id} href={`#${t.id}`} className="block rounded-md px-2.5 py-1.5 text-[12.5px] text-[var(--text-faint)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors">{t.label}</a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Body */}
          <main className="min-w-0 space-y-12">

            {/* WHY */}
            <section id="why" className="scroll-mt-6">
              <SectionHeading icon={LightbulbIcon} eyebrow={c.why.eyebrow} title={c.why.title} />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl">{c.why.intro}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {c.why.cards.map((card) => (
                  <div key={card.h} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
                    <div className="text-[13px] font-semibold mb-1">{card.h}</div>
                    <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)]">{card.b}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* RULES */}
            <section id="rules" className="scroll-mt-6">
              <SectionHeading icon={CheckCircleIcon} eyebrow={c.rules.eyebrow} title={c.rules.title} />
              <ol className="space-y-2.5">
                {c.rules.items.map((r, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent,#0066FF)] text-[11px] font-bold text-white">{i + 1}</span>
                    <span className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{r}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* OWNERS */}
            <section id="owners" className="scroll-mt-6">
              <SectionHeading icon={UsersIcon} eyebrow={c.owners.eyebrow} title={c.owners.title} />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-4">
                {c.owners.introA}
                <span className="mx-1 inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-subtle)]"><FilterIcon size={11} /> {c.owners.showFieldsFor}</span>
                {c.owners.introB}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {DEPT_ORDER.map((k) => {
                  const st = DEPT_STYLE[k];
                  return (
                    <div key={k} className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 ring-1 ring-inset ${st.ring}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <DeptDot d={k} />
                        <span className={`text-[13px] font-semibold ${st.text}`}>{c.depts[k].name}</span>
                      </div>
                      <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)] mb-2">{c.depts[k].owns}</div>
                      <div className="flex flex-wrap gap-1">
                        {SECTION_META.filter((s) => s.dept === k).map((s) => {
                          const txt = c.sections.find((x) => x.id === s.id);
                          return <span key={s.id} className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${st.soft} ${st.text}`}>{txt?.title}</span>;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* STEPS */}
            <section id="steps" className="scroll-mt-6">
              <SectionHeading icon={GaugeIcon} eyebrow={c.steps.eyebrow} title={c.steps.title} />
              <div className="space-y-3">
                {c.steps.items.map((s) => (
                  <div key={s.n} className="flex gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[15px] font-bold">{s.n}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold">{s.title}</span>
                        {s.dept && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${DEPT_STYLE[s.dept].soft} ${DEPT_STYLE[s.dept].text}`}>
                            <DeptDot d={s.dept} /> {c.depts[s.dept].name}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-faint)]">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* SECTIONS */}
            <section id="sections" className="scroll-mt-6">
              <SectionHeading icon={BookOpenIcon} eyebrow={c.sectionsHead.eyebrow} title={c.sectionsHead.title} />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-5">{c.sectionsHead.intro}</p>
              <div className="space-y-4">
                {SECTION_META.map((meta, idx) => {
                  const st = DEPT_STYLE[meta.dept];
                  const Icon = meta.icon;
                  const s = c.sections.find((x) => x.id === meta.id);
                  if (!s) return null;
                  return (
                    <div key={meta.id} id={meta.id} className="scroll-mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
                      <div className={`flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-[var(--border-subtle)] ${st.soft}`}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                          <Icon size={15} className={st.text} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] tabular-nums text-[var(--text-dim)]">{String(idx + 1).padStart(2, "0")}</span>
                            <span className="text-[14.5px] font-semibold">{s.title}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TierBadge t={meta.tier} />
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${st.text}`}>
                            <DeptDot d={meta.dept} /> {c.depts[meta.dept].name}
                          </span>
                        </div>
                      </div>
                      <div className="px-5 py-4">
                        <p className="text-[13px] leading-relaxed text-[var(--text-faint)] mb-3">{s.what}</p>
                        <div className="space-y-2">
                          {s.fields.map((f) => (
                            <div key={f.name} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-3 rounded-lg bg-[var(--bg-surface)] px-3 py-2">
                              <div className="text-[12.5px] font-medium text-[var(--text-secondary)]">{f.name}</div>
                              <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)]">{f.how}</div>
                            </div>
                          ))}
                        </div>
                        {s.tip && (
                          <div className="mt-3 flex gap-2 rounded-lg border border-[var(--accent,#0066FF)]/25 bg-[var(--accent,#0066FF)]/[0.06] px-3 py-2.5">
                            <LightbulbIcon size={14} className="mt-0.5 shrink-0 text-[var(--accent,#0066FF)]" />
                            <span className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{s.tip}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* COMPLETENESS */}
            <section id="completeness" className="scroll-mt-6">
              <SectionHeading icon={GaugeIcon} eyebrow={c.completeness.eyebrow} title={c.completeness.title} />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-4">{c.completeness.intro}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TierExplain badge={<TierBadge t="required" />} body={c.completeness.required} />
                <TierExplain badge={<TierBadge t="preferred" />} body={c.completeness.preferred} />
                <TierExplain badge={<TierBadge t="optional" />} body={c.completeness.optional} />
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
                  <div className="text-[13px] font-semibold mb-1">{c.completeness.overallTitle}</div>
                  <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)]">{c.completeness.overall}</div>
                </div>
              </div>
            </section>

            {/* BILINGUAL */}
            <section id="bilingual" className="scroll-mt-6">
              <SectionHeading icon={LanguagesIcon} eyebrow={c.bilingual.eyebrow} title={c.bilingual.title} />
              <div className="grid gap-3 sm:grid-cols-2">
                {c.bilingual.cards.map((card, i) => (
                  <div key={i} className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 ${i === 2 ? "sm:col-span-2" : ""}`}>
                    <div className="flex items-center gap-2 text-[13px] font-semibold mb-1">
                      {i === 2 ? <HelpCircleIcon size={14} className="text-[var(--accent,#0066FF)]" /> : <LanguagesIcon size={14} className="text-[var(--accent,#0066FF)]" />}
                      {card.h}
                    </div>
                    <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)]">{card.b}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* MISTAKES */}
            <section id="mistakes" className="scroll-mt-6">
              <SectionHeading icon={TriangleWarningIcon} eyebrow={c.mistakes.eyebrow} title={c.mistakes.title} />
              <div className="grid gap-3 sm:grid-cols-2">
                {c.mistakes.items.map((m, i) => (
                  <div key={i} className="flex gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.05] px-3.5 py-2.5">
                    <TriangleWarningIcon size={14} className="mt-0.5 shrink-0 text-rose-500" />
                    <span className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{m}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* CHECKLIST */}
            <section id="checklist" className="scroll-mt-6">
              <SectionHeading icon={CheckCircleIcon} eyebrow={c.checklist.eyebrow} title={c.checklist.title} />
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
                <ul className="space-y-2.5">
                  {c.checklist.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircleIcon size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                      <span className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/suppliers/new" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent,#0066FF)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity">
                  <HandshakeIcon size={14} /> {c.checklist.ctaAdd}
                </Link>
                <Link href="/knowledge" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  <ArrowLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" /> {c.checklist.ctaBack}
                </Link>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
}

/* ── shared sub-components ── */
function SectionHeading({ icon: Icon, eyebrow, title }: { icon: React.ComponentType<{ size?: number; className?: string }>; eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--accent,#0066FF)] mb-1.5">
        <Icon size={13} /> {eyebrow}
      </div>
      <h2 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

function TierExplain({ badge, body }: { badge: React.ReactNode; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
      <div className="mb-1">{badge}</div>
      <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)] mt-1.5">{body}</div>
    </div>
  );
}
