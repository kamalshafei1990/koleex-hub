"use client";

/* ---------------------------------------------------------------------------
   Supplier Data Entry Guide — Knowledge app
   A complete, step-by-step manual for employees on how to add and maintain a
   supplier record in the Koleex Hub. Mirrors the real Add/Edit Supplier form
   (src/components/contacts/Contacts.tsx): same 21 sections, same department
   ownership, same dropdowns and completeness tiers.
   Brand: monochrome surfaces + single blue accent; functional department tones
   reused only for wayfinding (matching the form's color-coded sections).
   --------------------------------------------------------------------------- */

import Link from "next/link";
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

/* ── Department palette (mirrors DEPT_TONE in the supplier form) ── */
type DeptKey = "procurement" | "finance" | "legal" | "logistics" | "quality" | "commercial" | "general";

const DEPTS: Record<DeptKey, { name: string; owns: string; dot: string; soft: string; text: string; ring: string }> = {
  procurement: { name: "Procurement", owns: "Who the supplier is, how to reach them, what they sell", dot: "bg-blue-500", soft: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/30" },
  legal: { name: "Compliance / Legal", owns: "Legal identity, tax & trade IDs, signed documents", dot: "bg-violet-500", soft: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/30" },
  finance: { name: "Finance / Treasury", owns: "Payment terms and verified bank details", dot: "bg-emerald-500", soft: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30" },
  logistics: { name: "Logistics", owns: "Incoterms, shipping, lead times, ports", dot: "bg-amber-500", soft: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/30" },
  quality: { name: "Sourcing / Quality", owns: "Factory profile, certifications, performance", dot: "bg-cyan-500", soft: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", ring: "ring-cyan-500/30" },
  commercial: { name: "Commercial / Management", owns: "Risk, negotiation posture, strategic status", dot: "bg-rose-500", soft: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/30" },
  general: { name: "Any team", owns: "Social links, internal notes, custom fields", dot: "bg-slate-400", soft: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-300", ring: "ring-slate-500/30" },
};

type Tier = "required" | "preferred" | "optional";
const TIER_LABEL: Record<Tier, string> = { required: "Required", preferred: "Preferred", optional: "Optional" };
const TIER_STYLE: Record<Tier, string> = {
  required: "bg-rose-500/12 text-rose-600 dark:text-rose-400 ring-rose-500/30",
  preferred: "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/30",
  optional: "bg-[var(--bg-surface)] text-[var(--text-dim)] ring-[var(--border-subtle)]",
};

/* ── Section field guide (mirrors the 21 supplier form sections, in fill order) ── */
interface FieldRow { name: string; how: string; }
interface GuideSection {
  id: string;
  title: string;
  dept: DeptKey;
  tier: Tier;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  what: string;
  fields: FieldRow[];
  tip?: string;
}

const SECTIONS: GuideSection[] = [
  {
    id: "company-name", title: "Company Name", dept: "procurement", tier: "required", icon: Building2Icon,
    what: "The single line that identifies the supplier everywhere in the Hub. Get this exactly right — every other app (Purchase, Finance, Inventory) reads it.",
    fields: [
      { name: "Company / legal name", how: "Use the official registered name. If it is a Chinese company, type the Chinese name — the Hub auto-translates it for English/Arabic readers." },
      { name: "Display / short name", how: "A clean name for lists and POs (e.g. \"Ningbo Sunrise\"). Skip the legal suffixes here." },
      { name: "Supplier type", how: "Pick from the dropdown: Manufacturer, Trading, Agent, Spare Parts, Machinery, Packaging, Textile, Chemical, Logistics… Choose what they primarily are." },
    ],
    tip: "Search the directory first (see Step 1). One real-world company = one record. Never create a second card for the same factory.",
  },
  {
    id: "company-profile", title: "Company Profile", dept: "procurement", tier: "preferred", icon: BriefcaseIcon,
    what: "A quick portrait of the business so anyone opening the record understands who they are dealing with.",
    fields: [
      { name: "Year established", how: "Four-digit year. A long track record is a trust signal." },
      { name: "Employee count range", how: "Pick the band from the dropdown — a proxy for capacity and stability." },
      { name: "Business description", how: "One or two sentences: what they make/do and their specialty. Write in any language; it auto-translates." },
      { name: "Website", how: "Full URL including https://." },
    ],
  },
  {
    id: "classifications", title: "Classifications", dept: "procurement", tier: "preferred", icon: TagsIcon,
    what: "Tags that let everyone filter and group suppliers by what they provide.",
    fields: [
      { name: "Classification", how: "Pick the category from the dropdown (Machinery, Spare Parts, Textile, Chemical, Accessories…)." },
      { name: "Tags", how: "Add free keywords for niche capabilities (e.g. \"needles\", \"servo motors\")." },
    ],
  },
  {
    id: "contact-details", title: "Contact Details", dept: "procurement", tier: "required", icon: PhoneIcon,
    what: "The primary, official way to reach the company. Personal contacts go in the next section.",
    fields: [
      { name: "Main phone", how: "Include country code (e.g. +86 …)." },
      { name: "Main email", how: "The company's general/sales inbox." },
      { name: "Address, city, country", how: "Their main business address. Country drives reporting and currency defaults downstream." },
    ],
  },
  {
    id: "contact-persons", title: "Contact Persons", dept: "procurement", tier: "preferred", icon: UsersIcon,
    what: "The real people you talk to. You can add several — mark who decides and who is your primary contact.",
    fields: [
      { name: "Name & role", how: "Add each person; pick their role from the dropdown (Sales, Owner, Engineer, Finance…)." },
      { name: "Decision-maker / Primary toggles", how: "Flag the person who signs off, and the one you deal with day-to-day." },
      { name: "Channels (WeChat, WeCom, WhatsApp, Telegram, Line, Skype)", how: "Fill the apps they actually answer on. Then set Preferred channel." },
      { name: "Preferred language", how: "Pick their language so the team knows how to write to them." },
      { name: "Timezone, available hours, reliability, response speed", how: "Optional but valuable — sets expectations for the next person who contacts them." },
    ],
    tip: "A decision-maker with a WeChat ID and a known timezone is worth ten generic info@ emails.",
  },
  {
    id: "messaging-ids", title: "Messaging IDs", dept: "procurement", tier: "optional", icon: MessageSquareIcon,
    what: "Company-level chat identities (separate from a single person).",
    fields: [
      { name: "WeChat ID / Official Account", how: "The company's WeChat handle or official account." },
      { name: "WeChat sales group available", how: "Toggle on if they run a buyer group chat." },
      { name: "WeCom support available", how: "Toggle on if they use WeCom (企业微信) for support." },
    ],
  },
  {
    id: "legal-identity", title: "Legal Identity", dept: "legal", tier: "required", icon: Building2Icon,
    what: "The legally registered entity behind the trade name. Required before any contract or first payment.",
    fields: [
      { name: "Legal entity name", how: "Exactly as on the business license — including the legal suffix." },
      { name: "Registration number", how: "Company registration / incorporation number." },
      { name: "Country of incorporation & entity type", how: "Where and how they are registered (Ltd, Co., etc.)." },
      { name: "Registered (legal) address", how: "The address on official records — may differ from the operating address." },
    ],
    tip: "Cross-check these against the uploaded business license in the Documents section. They must match.",
  },
  {
    id: "trade-tax-ids", title: "Trade & Tax IDs", dept: "legal", tier: "preferred", icon: FileCheckIcon,
    what: "Tax and cross-border trade identifiers needed for invoices, customs and compliance. Hover the (?) on each field for an explanation.",
    fields: [
      { name: "Tax ID / VAT number", how: "The supplier's tax registration number." },
      { name: "Unified Social Credit Code (USCI)", how: "For Chinese suppliers — the 18-character code on the license." },
      { name: "Import / Export license", how: "Their customs registration, if they ship internationally themselves." },
    ],
  },
  {
    id: "payment-info", title: "Payment Information", dept: "finance", tier: "required", icon: LandmarkIcon,
    what: "How and where we pay them. This is the most sensitive section — Finance owns it.",
    fields: [
      { name: "Payment terms", how: "Pick from the dropdown: T/T, L/C, D/P, D/A, Net 30/60… Match the signed agreement." },
      { name: "Currency", how: "The currency of the agreement." },
      { name: "Bank name, account name, account no. / IBAN, SWIFT", how: "Enter exactly as on the bank confirmation letter. Verify the beneficiary name matches the legal entity." },
      { name: "Intermediary / correspondent bank", how: "Only if the bank requires one for international transfers." },
    ],
    tip: "Never accept bank details by email alone — fraudsters intercept these. Confirm any change by phone with a known contact, then record it here.",
  },
  {
    id: "logistics-trade", title: "Logistics & Trade", dept: "logistics", tier: "preferred", icon: TruckIcon,
    what: "How goods move from them to us. Hover the (?) on each field for definitions.",
    fields: [
      { name: "Incoterms", how: "Pick the agreed term (EXW, FOB, CIF, DDP…). It decides who pays freight and bears risk." },
      { name: "Port of loading", how: "Where their goods normally ship from." },
      { name: "Standard lead time", how: "Typical days from PO to ready-to-ship." },
      { name: "Packaging / shipping notes", how: "Anything special about how they pack or consolidate." },
    ],
  },
  {
    id: "factory", title: "Factory", dept: "quality", tier: "preferred", icon: FactoryIcon,
    what: "The production capability behind the supplier. Every field has a (?) explaining what to enter.",
    fields: [
      { name: "Factory type & location", how: "Pick the type; record where the plant actually is (may differ from the office)." },
      { name: "Capacity & output (with units)", how: "Enter the number and pick the unit (pcs/month, tons/year…)." },
      { name: "Supported materials", how: "List the materials they can work with — used for matching to product needs." },
      { name: "Certifications", how: "ISO, CE and similar — list what they hold." },
      { name: "Lead time (days), peak-season months", how: "Production lead time, and the busy months when lead times stretch." },
      { name: "Factory visit date", how: "The date we last audited/visited on-site. Empty means never visited." },
    ],
  },
  {
    id: "catalogue", title: "Catalogue", dept: "procurement", tier: "optional", icon: BookOpenIcon,
    what: "Links to what they offer.",
    fields: [
      { name: "Catalogue / price list link", how: "Paste a link, or upload the file in Documents." },
    ],
  },
  {
    id: "products", title: "Products", dept: "procurement", tier: "optional", icon: PackageIcon,
    what: "The specific products this supplier provides to us.",
    fields: [
      { name: "Products supplied", how: "List or link the items. Connects the supplier to the Products and Purchase apps." },
    ],
  },
  {
    id: "quality-performance", title: "Quality & Performance", dept: "quality", tier: "preferred", icon: ShieldCheckIcon,
    what: "The track record that decides whether we keep buying from them.",
    fields: [
      { name: "Quality certifications", how: "Standards they are certified to." },
      { name: "Defect rate / on-time delivery rate", how: "Enter measured percentages where known." },
      { name: "Quality notes", how: "Free notes on recurring issues or strengths (auto-translates)." },
      { name: "Performance scores", how: "Use the sliders to rate them; updates over time." },
    ],
  },
  {
    id: "risk", title: "Risk", dept: "commercial", tier: "preferred", icon: TriangleWarningIcon,
    what: "Known risks, logged item-by-item so nothing is forgotten.",
    fields: [
      { name: "Risk items", how: "Add one row per risk. Pick the Dimension (financial, supply, quality, geopolitical…), Severity and Status from the dropdowns." },
      { name: "Description & mitigation", how: "What the risk is, and what we are doing about it." },
    ],
  },
  {
    id: "negotiation", title: "Negotiation", dept: "commercial", tier: "optional", icon: HandCoinsIcon,
    what: "Intelligence that makes the next negotiation stronger.",
    fields: [
      { name: "Flexibility (payment, communication, customization, exclusivity)", how: "Set each level based on past dealings." },
      { name: "Preferred tactics & leverage points", how: "What works with them, and where we have leverage." },
    ],
  },
  {
    id: "strategic-status", title: "Strategic Status", dept: "commercial", tier: "optional", icon: TargetIcon,
    what: "Management's verdict on how important this supplier is to us.",
    fields: [
      { name: "Strategic status", how: "Pick from the dropdown: Strategic, Preferred, Approved, Experimental, Backup, Probation…" },
      { name: "Internal score", how: "An overall internal rating. Set by management/commercial." },
    ],
  },
  {
    id: "documents", title: "Documents", dept: "legal", tier: "preferred", icon: PaperclipIcon,
    what: "The proof behind everything above. Attach the real files.",
    fields: [
      { name: "Business license, certificates, contracts, NDA", how: "Upload clear scans/PDFs. These back up the Legal and Finance sections." },
    ],
    tip: "If a field claims a certification or a bank account, the matching document belongs here.",
  },
  {
    id: "social-media", title: "Social Media", dept: "general", tier: "optional", icon: Share2Icon,
    what: "Public presence — useful for verification and background checks.",
    fields: [
      { name: "LinkedIn, Alibaba, Made-in-China, etc.", how: "Paste profile/storefront links." },
    ],
  },
  {
    id: "notes", title: "Internal Notes", dept: "general", tier: "optional", icon: DocumentIcon,
    what: "Anything the team should know that doesn't fit a field.",
    fields: [
      { name: "Notes", how: "Write freely in your own language — teammates see it auto-translated into theirs." },
    ],
  },
  {
    id: "custom-fields", title: "Custom Fields", dept: "general", tier: "optional", icon: HashtagIcon,
    what: "Extra key/value details specific to your workflow.",
    fields: [
      { name: "Custom key / value", how: "Add only what you'll actually search or report on later." },
    ],
  },
];

/* ── The recommended workflow order ── */
const STEPS: { n: number; title: string; dept?: DeptKey; body: string }[] = [
  { n: 1, title: "Search before you create", body: "Open the Suppliers directory and search the company name (try the Chinese name too). If it exists, open and update it — do not create a duplicate." },
  { n: 2, title: "Start with Procurement basics", dept: "procurement", body: "Fill Company Name, Profile, Classifications, Contact Details and Contact Persons. This alone makes the record usable across the Hub." },
  { n: 3, title: "Hand off to Compliance / Legal", dept: "legal", body: "Legal Identity and Trade & Tax IDs, then upload the business license and certificates in Documents." },
  { n: 4, title: "Finance verifies payment", dept: "finance", body: "Payment terms and verified bank details. Confirm any bank info by phone before saving." },
  { n: 5, title: "Logistics & Quality add operations", dept: "logistics", body: "Incoterms and shipping (Logistics), then the Factory profile and Quality & Performance (Sourcing/Quality)." },
  { n: 6, title: "Commercial & Management close it out", dept: "commercial", body: "Log Risk items, capture Negotiation intelligence, and set the Strategic Status." },
  { n: 7, title: "Check completeness, then save", body: "Watch the Profile Completeness panel. Aim for the green \"Ready\" badge (all Required done), then keep raising Preferred and Optional over time." },
];

/* ── small presentational helpers ── */
function DeptDot({ d }: { d: DeptKey }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${DEPTS[d].dot}`} aria-hidden />;
}
function TierBadge({ t }: { t: Tier }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${TIER_STYLE[t]}`}>
      {TIER_LABEL[t]}
    </span>
  );
}

const TOC = [
  { id: "why", label: "Why this matters" },
  { id: "rules", label: "The golden rules" },
  { id: "owners", label: "Who fills what" },
  { id: "steps", label: "Step-by-step workflow" },
  { id: "sections", label: "Every section explained" },
  { id: "completeness", label: "Profile completeness" },
  { id: "bilingual", label: "Working in two languages" },
  { id: "mistakes", label: "Common mistakes" },
  { id: "checklist", label: "Before you save" },
];

export default function SupplierDataGuidePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Breadcrumb header */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Link
            href="/knowledge"
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] min-w-0">
            <KnowledgeIcon size={14} />
            <Link href="/knowledge" className="hover:text-[var(--text-primary)]">Knowledge</Link>
            <span>/</span>
            <span className="text-[var(--text-secondary)] truncate">Supplier Data Entry Guide</span>
          </div>
        </div>

        {/* Hero */}
        <header className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 md:p-10 mb-8">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--accent,#0066FF)] mb-3">
            <HandshakeIcon size={14} /> Supplier Onboarding Manual
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight max-w-3xl">
            How to fill supplier data — the right way, step by step
          </h1>
          <p className="mt-3 text-[14px] md:text-[15px] leading-relaxed text-[var(--text-faint)] max-w-3xl">
            A supplier record feeds Purchase, Finance, Inventory and the Sourcing Command Center.
            Good data in means good decisions out. This guide shows exactly what to enter in each
            section, who owns it, and the order to do it in — so any teammate can onboard a supplier
            cleanly and completely.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/suppliers/new" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent,#0066FF)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity">
              <HandshakeIcon size={14} /> Open Add Supplier
            </Link>
            <a href="#steps" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Jump to the 7 steps
            </a>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
          {/* Sticky TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)] mb-3">On this page</div>
              <nav className="space-y-1">
                {TOC.map((t) => (
                  <a key={t.id} href={`#${t.id}`} className="block rounded-md px-2.5 py-1.5 text-[12.5px] text-[var(--text-faint)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors">
                    {t.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Body */}
          <main className="min-w-0 space-y-12">

            {/* WHY */}
            <section id="why" className="scroll-mt-6">
              <SectionHeading icon={LightbulbIcon} eyebrow="Start here" title="Why supplier data matters" />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl">
                Every other app reads what you type here. The supplier card is the single source of truth.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { h: "One record, many apps", b: "Purchase creates POs from it, Finance pays from it, Inventory receives against it, the Sourcing Command Center scores it. A wrong name or bank number breaks all of them." },
                  { h: "Decisions follow data", b: "Risk, lead time, factory capacity and performance scores are what management uses to choose suppliers. Empty fields = blind decisions." },
                  { h: "One supplier = one card", b: "Duplicates split history and confuse reporting. Always search first." },
                  { h: "It compounds over time", b: "You don't have to fill everything at once. Get the Required fields in today; the team enriches the rest as the relationship grows." },
                ].map((c) => (
                  <div key={c.h} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
                    <div className="text-[13px] font-semibold mb-1">{c.h}</div>
                    <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)]">{c.b}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* GOLDEN RULES */}
            <section id="rules" className="scroll-mt-6">
              <SectionHeading icon={CheckCircleIcon} eyebrow="Principles" title="The golden rules" />
              <ol className="space-y-2.5">
                {[
                  "Search before you create — never duplicate a supplier.",
                  "Fill what your department owns; leave other sections for their owners (the colored badge tells you who).",
                  "Type in your own language. The Hub auto-translates notes and typed text for the rest of the team.",
                  "Required first, then Preferred, then Optional — watch the completeness panel.",
                  "Every claim needs proof — upload the matching document for legal and bank fields.",
                  "Verify bank details by phone before saving. Never trust bank changes sent only by email.",
                  "Use dropdowns as given — consistent values keep filtering and reporting accurate.",
                ].map((r, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent,#0066FF)] text-[11px] font-bold text-white">{i + 1}</span>
                    <span className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{r}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* OWNERS */}
            <section id="owners" className="scroll-mt-6">
              <SectionHeading icon={UsersIcon} eyebrow="Responsibility" title="Who fills what" />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-4">
                Each section on the form carries a colored owner badge. Use the
                <span className="mx-1 inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-subtle)]"><FilterIcon size={11} /> Show fields for</span>
                filter under the completeness panel to show only your department's sections.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(DEPTS) as DeptKey[]).map((k) => {
                  const d = DEPTS[k];
                  return (
                    <div key={k} className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 ring-1 ring-inset ${d.ring}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <DeptDot d={k} />
                        <span className={`text-[13px] font-semibold ${d.text}`}>{d.name}</span>
                      </div>
                      <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)] mb-2">{d.owns}</div>
                      <div className="flex flex-wrap gap-1">
                        {SECTIONS.filter((s) => s.dept === k).map((s) => (
                          <span key={s.id} className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${d.soft} ${d.text}`}>{s.title}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* STEPS */}
            <section id="steps" className="scroll-mt-6">
              <SectionHeading icon={GaugeIcon} eyebrow="Workflow" title="Step by step — the order to fill" />
              <div className="space-y-3">
                {STEPS.map((s) => (
                  <div key={s.n} className="flex gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[15px] font-bold">{s.n}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold">{s.title}</span>
                        {s.dept && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${DEPTS[s.dept].soft} ${DEPTS[s.dept].text}`}>
                            <DeptDot d={s.dept} /> {DEPTS[s.dept].name}
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
              <SectionHeading icon={BookOpenIcon} eyebrow="Field reference" title="Every section explained" />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-5">
                The 21 sections of the form, in fill order. Each shows its owner and whether it is
                Required, Preferred or Optional for a complete profile.
              </p>
              <div className="space-y-4">
                {SECTIONS.map((s, idx) => {
                  const d = DEPTS[s.dept];
                  const Icon = s.icon;
                  return (
                    <div key={s.id} id={s.id} className="scroll-mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
                      <div className={`flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-[var(--border-subtle)] ${d.soft}`}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                          <Icon size={15} className={d.text} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] tabular-nums text-[var(--text-dim)]">{String(idx + 1).padStart(2, "0")}</span>
                            <span className="text-[14.5px] font-semibold">{s.title}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TierBadge t={s.tier} />
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${d.text}`}>
                            <DeptDot d={s.dept} /> {d.name}
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
              <SectionHeading icon={GaugeIcon} eyebrow="Your progress meter" title="Reading the Profile Completeness panel" />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-4">
                The panel at the top of the form tracks how complete the record is, in three tiers plus an overall score.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TierExplain t="required" body="The minimum to make the supplier usable: name, contact, legal identity and payment basics. The green “Ready” badge appears only when every Required field is filled." />
                <TierExplain t="preferred" body="Strongly recommended: profile, factory, logistics, quality, risk. These power good sourcing decisions." />
                <TierExplain t="optional" body="Nice-to-have depth: negotiation intelligence, social links, custom fields. Fill as the relationship grows." />
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
                  <div className="text-[13px] font-semibold mb-1">Overall</div>
                  <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)]">A single percentage across all tiers. Use it to see at a glance how mature a supplier record is — but “Ready” (all Required done) is the real bar for going live.</div>
                </div>
              </div>
            </section>

            {/* BILINGUAL */}
            <section id="bilingual" className="scroll-mt-6">
              <SectionHeading icon={LanguagesIcon} eyebrow="For mixed teams" title="Working in Chinese, Arabic and English" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
                  <div className="flex items-center gap-2 text-[13px] font-semibold mb-1"><LanguagesIcon size={14} className="text-[var(--accent,#0066FF)]" /> Type in your language</div>
                  <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)]">Enter notes, descriptions and names in whatever language is natural for you — Chinese staff in 中文, others in English or العربية. Don't enter data twice.</div>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
                  <div className="flex items-center gap-2 text-[13px] font-semibold mb-1"><LanguagesIcon size={14} className="text-[var(--accent,#0066FF)]" /> Everyone reads their own</div>
                  <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)]">Typed text shows auto-translated into each viewer's language, with a one-tap “show original” toggle. The whole interface, labels and dropdowns also switch with the language picker.</div>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 sm:col-span-2">
                  <div className="flex items-center gap-2 text-[13px] font-semibold mb-1"><HelpCircleIcon size={14} className="text-[var(--accent,#0066FF)]" /> Use the (?) help tips</div>
                  <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)]">Many fields — especially Trade &amp; Tax IDs, Logistics, and Factory — have a small (?) icon. Hover it for a bilingual explanation of exactly what to enter and where to find it.</div>
                </div>
              </div>
            </section>

            {/* MISTAKES */}
            <section id="mistakes" className="scroll-mt-6">
              <SectionHeading icon={TriangleWarningIcon} eyebrow="Avoid these" title="Common mistakes" />
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Creating a duplicate because you didn't search the Chinese name.",
                  "Putting a person's mobile in the company phone field — keep people in Contact Persons.",
                  "Typing bank details from an email without a phone confirmation.",
                  "Filling another department's section with guesses instead of leaving it for the owner.",
                  "Writing dropdown values as free text (e.g. typing “FOB” somewhere instead of selecting the Incoterm).",
                  "Claiming a certification with no document uploaded to back it up.",
                ].map((m, i) => (
                  <div key={i} className="flex gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.05] px-3.5 py-2.5">
                    <TriangleWarningIcon size={14} className="mt-0.5 shrink-0 text-rose-500" />
                    <span className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{m}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* CHECKLIST */}
            <section id="checklist" className="scroll-mt-6">
              <SectionHeading icon={CheckCircleIcon} eyebrow="Final pass" title="Before you save" />
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
                <ul className="space-y-2.5">
                  {[
                    "Searched first — this is not a duplicate.",
                    "Company name is the official registered name; supplier type is set.",
                    "At least one contact person, with a preferred channel.",
                    "Legal identity matches the uploaded business license.",
                    "Bank details verified by phone and documented.",
                    "All dropdowns selected (not typed); units chosen where needed.",
                    "Completeness panel shows the green “Ready” badge.",
                  ].map((c, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircleIcon size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                      <span className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/suppliers/new" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent,#0066FF)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity">
                  <HandshakeIcon size={14} /> Add a supplier now
                </Link>
                <Link href="/knowledge" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  <ArrowLeftIcon className="h-3.5 w-3.5" /> Back to Knowledge
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

function TierExplain({ t, body }: { t: Tier; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
      <div className="mb-1"><TierBadge t={t} /></div>
      <div className="text-[12.5px] leading-relaxed text-[var(--text-faint)] mt-1.5">{body}</div>
    </div>
  );
}
