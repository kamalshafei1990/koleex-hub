"use client";

/* ---------------------------------------------------------------------------
   Supplier Onboarding — Operating Procedure (Workflow)
   A manager-grade operational plan for the supplier onboarding PROCESS:
   how a supplier moves from "found on the internet" to "active & purchasable",
   the stages, the timing/SLA, who enters the data, who reviews, who approves,
   plus a RACI matrix, status lifecycle, and the factory-visit question bank.
   Companion to the field-level "Supplier Data Entry Guide".
   Brand: monochrome surfaces + blue accent; functional department tones reused
   only for wayfinding (matching the form's color-coded sections).
   --------------------------------------------------------------------------- */

import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import KnowledgeIcon from "@/components/icons/KnowledgeIcon";
import WorkflowIcon from "@/components/icons/ui/WorkflowIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import MegaphoneIcon from "@/components/icons/ui/MegaphoneIcon";
import FileCheckIcon from "@/components/icons/ui/FileCheckIcon";
import LandmarkIcon from "@/components/icons/ui/LandmarkIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import TruckIcon from "@/components/icons/ui/TruckIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import RocketIcon from "@/components/icons/ui/RocketIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import HelpCircleIcon from "@/components/icons/ui/HelpCircleIcon";
import ClipboardCheckIcon from "@/components/icons/ui/ClipboardCheckIcon";
import CalendarCheckIcon from "@/components/icons/ui/CalendarCheckIcon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import LightbulbIcon from "@/components/icons/ui/LightbulbIcon";
import HandshakeIcon from "@/components/icons/ui/HandshakeIcon";

/* ── Department palette (mirrors the supplier form's DEPT_TONE) ── */
type DeptKey = "procurement" | "legal" | "finance" | "logistics" | "quality" | "commercial" | "management";
const DEPTS: Record<DeptKey, { name: string; role: string; dot: string; soft: string; text: string; ring: string }> = {
  procurement: { name: "Procurement", role: "Buyer / Sourcing Specialist · Procurement Manager", dot: "bg-blue-500", soft: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/30" },
  legal: { name: "Compliance / Legal", role: "Compliance Officer", dot: "bg-violet-500", soft: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/30" },
  finance: { name: "Finance / Treasury", role: "Finance / Treasury Officer", dot: "bg-emerald-500", soft: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30" },
  logistics: { name: "Logistics", role: "Logistics Coordinator", dot: "bg-amber-500", soft: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/30" },
  quality: { name: "Sourcing / Quality", role: "Quality / Sourcing Engineer", dot: "bg-cyan-500", soft: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", ring: "ring-cyan-500/30" },
  commercial: { name: "Commercial", role: "Commercial Lead / Buyer Lead", dot: "bg-rose-500", soft: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/30" },
  management: { name: "Management", role: "Procurement Director / GM", dot: "bg-slate-500", soft: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-300", ring: "ring-slate-500/30" },
};

/* ── Status lifecycle ── */
const LIFECYCLE = [
  { key: "lead", label: "Lead", note: "Sourced, not yet in Hub" },
  { key: "draft", label: "Draft", note: "Basic data entered" },
  { key: "verify", label: "Verification", note: "Legal + Finance vetting" },
  { key: "assess", label: "Assessment", note: "Factory visit + quality" },
  { key: "review", label: "Review", note: "Leads check sections" },
  { key: "approved", label: "Approved", note: "Management sign-off" },
  { key: "active", label: "Active", note: "Live for purchasing" },
];

/* ── The operation, stage by stage ── */
interface Stage {
  n: number;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  dept: DeptKey;
  days: string;
  duration: string;
  status: string;
  what: string;
  does: string[];
  data: string;       // which form sections get filled
  gate: string;       // exit criteria to move on
}

const STAGES: Stage[] = [
  {
    n: 0, title: "Source & qualify the supplier", icon: SearchIcon, dept: "procurement",
    days: "Day 0", duration: "0–1 day", status: "Lead",
    what: "Find a candidate supplier and decide they are worth pursuing — before any record is created.",
    does: [
      "Find candidates: internet search, Alibaba / Made-in-China, exhibitions, referrals, existing network.",
      "Do a quick sanity check: do they make what we need, at roughly the right scale and region?",
      "Capture the source link and a one-line reason to pursue.",
    ],
    data: "Nothing in the Hub yet — notes/links kept by the buyer.",
    gate: "Buyer confirms the lead is worth onboarding.",
  },
  {
    n: 1, title: "Create the draft record (basic data)", icon: Building2Icon, dept: "procurement",
    days: "Day 0–1", duration: "~1 hour", status: "Draft",
    what: "Open the supplier card and enter everything you can already get from public sources.",
    does: [
      "Search the directory first to be sure it is not a duplicate (try the Chinese name too).",
      "Click Add Supplier and fill from the website/listing: company name, supplier type, profile, classifications.",
      "Add the general contact details (phone, email, address, country).",
    ],
    data: "Company Name · Company Profile · Classifications · Contact Details",
    gate: "Required basics saved; record exists as Draft.",
  },
  {
    n: 2, title: "First contact & information request (RFI)", icon: MegaphoneIcon, dept: "procurement",
    days: "Day 1–5", duration: "2–4 days", status: "Draft",
    what: "Reach out, introduce Koleex, and request the documents and details only the supplier can give you.",
    does: [
      "Make contact and identify the real people: add Contact Persons (decision-maker, primary, channels, language).",
      "Request: company profile/catalogue, business license, certifications, and a sample if relevant.",
      "Record chat handles in Messaging IDs.",
    ],
    data: "Contact Persons · Messaging IDs · Catalogue",
    gate: "A named contact responds and sends initial documents.",
  },
  {
    n: 3, title: "Compliance & legal intake (KYC)", icon: FileCheckIcon, dept: "legal",
    days: "Day 3–10", duration: "3–7 days", status: "Verification",
    what: "Verify the supplier is a real, legitimate legal entity and capture its formal identity.",
    does: [
      "Enter Legal Identity and Trade & Tax IDs from the business license.",
      "Run KYC / sanctions screening per policy.",
      "Upload the business license, certificates and any signed NDA to Documents.",
    ],
    data: "Legal Identity · Trade & Tax IDs · Documents",
    gate: "Legal entity verified; documents on file; no KYC red flags.",
  },
  {
    n: 4, title: "Finance & banking setup", icon: LandmarkIcon, dept: "finance",
    days: "Day 5–12", duration: "2–5 days", status: "Verification",
    what: "Agree payment terms and capture verified banking details.",
    does: [
      "Record payment terms and currency from the agreement.",
      "Enter bank details exactly as on the bank confirmation letter.",
      "Verify the account by phone with a known contact before saving — never from email alone.",
    ],
    data: "Payment Information",
    gate: "Payment terms set; bank details entered and phone-verified.",
  },
  {
    n: 5, title: "Schedule meeting & factory visit / audit", icon: FactoryIcon, dept: "quality",
    days: "Day 10–25", duration: "1–2 weeks", status: "Assessment",
    what: "Meet the supplier and audit the factory on-site (or by video) to confirm capability and gather deep data.",
    does: [
      "Schedule the meeting/visit and prepare the question bank (see below).",
      "On-site: assess capacity, equipment, certifications, quality systems; evaluate samples.",
      "Fill Factory and Quality & Performance, and set the Factory visit date.",
    ],
    data: "Factory · Quality & Performance",
    gate: "Visit completed; factory and quality data recorded.",
  },
  {
    n: 6, title: "Logistics & commercial assessment", icon: TruckIcon, dept: "commercial",
    days: "Day 12–25", duration: "in parallel", status: "Assessment",
    what: "Lock the operational and commercial picture while the audit happens.",
    does: [
      "Logistics: Incoterms, ports, lead times, packaging.",
      "Commercial: log Risk items (dimension/severity/status) and Negotiation intelligence.",
      "Confirm products this supplier will provide.",
    ],
    data: "Logistics & Trade · Risk · Negotiation · Products",
    gate: "Logistics terms, risks and negotiation notes captured.",
  },
  {
    n: 7, title: "Section review by department leads", icon: CheckCircleIcon, dept: "procurement",
    days: "Day 25–28", duration: "2–3 days", status: "Review",
    what: "Each owner checks their own section; Procurement consolidates the whole record.",
    does: [
      "Each department lead reviews their section for accuracy and completeness (the owner badge shows who).",
      "Procurement Manager consolidates, resolves gaps, and checks the Profile Completeness panel.",
      "Fix anything below the “Ready” bar before sending for approval.",
    ],
    data: "All sections — reviewed, not newly entered.",
    gate: "Completeness shows green “Ready”; leads sign off their sections.",
  },
  {
    n: 8, title: "Management approval", icon: BadgeCheckIcon, dept: "management",
    days: "Day 28–30", duration: "1–2 days", status: "Approved",
    what: "Management makes the go/no-go decision and positions the supplier strategically.",
    does: [
      "Review the consolidated record and risk profile.",
      "Set Strategic Status and internal score.",
      "Approve, reject, or send back with conditions.",
    ],
    data: "Strategic Status",
    gate: "Management approves → supplier becomes Approved.",
  },
  {
    n: 9, title: "Activate & maintain", icon: RocketIcon, dept: "procurement",
    days: "Day 30 →", duration: "ongoing", status: "Active",
    what: "The supplier goes live for purchasing and is kept current over time.",
    does: [
      "Supplier becomes selectable in Purchase; first PO can be raised.",
      "Update performance scores after each order; refresh documents before they expire.",
      "Re-evaluate periodically (annual review or on any risk event).",
    ],
    data: "Quality & Performance (ongoing) · Documents (renewals) · Risk (events)",
    gate: "Active supplier, maintained on a review cycle.",
  },
];

/* ── RACI matrix (rows = stages, cols = departments) ── */
type Raci = "" | "R" | "A" | "C" | "I" | "A/R";
const RACI_COLS: { key: DeptKey; short: string }[] = [
  { key: "procurement", short: "Proc" },
  { key: "legal", short: "Legal" },
  { key: "finance", short: "Fin" },
  { key: "logistics", short: "Log" },
  { key: "quality", short: "QA" },
  { key: "commercial", short: "Comm" },
  { key: "management", short: "Mgmt" },
];
const RACI: Record<number, Record<DeptKey, Raci>> = {
  0: { procurement: "A/R", legal: "", finance: "", logistics: "", quality: "", commercial: "", management: "I" },
  1: { procurement: "A/R", legal: "", finance: "", logistics: "", quality: "", commercial: "", management: "I" },
  2: { procurement: "A/R", legal: "", finance: "", logistics: "", quality: "C", commercial: "", management: "I" },
  3: { procurement: "C", legal: "A/R", finance: "", logistics: "", quality: "", commercial: "", management: "I" },
  4: { procurement: "C", legal: "C", finance: "A/R", logistics: "", quality: "", commercial: "", management: "I" },
  5: { procurement: "C", legal: "", finance: "", logistics: "", quality: "A/R", commercial: "C", management: "I" },
  6: { procurement: "C", legal: "", finance: "", logistics: "R", quality: "C", commercial: "R", management: "I" },
  7: { procurement: "A", legal: "C", finance: "C", logistics: "C", quality: "C", commercial: "C", management: "I" },
  8: { procurement: "C", legal: "", finance: "", logistics: "", quality: "", commercial: "C", management: "A/R" },
  9: { procurement: "R", legal: "I", finance: "I", logistics: "I", quality: "I", commercial: "I", management: "A" },
};
const RACI_STYLE: Record<Raci, string> = {
  "": "text-[var(--text-ghost)]",
  R: "bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold",
  A: "bg-slate-500/15 text-slate-600 dark:text-slate-300 font-semibold",
  "A/R": "bg-[var(--accent,#0066FF)]/15 text-[var(--accent,#0066FF)] font-bold",
  C: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  I: "text-[var(--text-dim)]",
};

/* ── Factory-visit question bank ── */
const QUESTION_BANK: { group: string; qs: string[] }[] = [
  { group: "Company & capacity", qs: [
    "How long have you been in business and who are your main clients?",
    "What is your monthly/annual production capacity, and current utilization?",
    "Do you own this factory or subcontract any production?",
    "What is your typical and peak-season lead time?",
  ]},
  { group: "Quality & process", qs: [
    "What certifications do you hold (ISO, CE…), and can we see them?",
    "What is your in-line and final inspection process? Typical defect rate?",
    "How do you handle a quality claim or rework?",
    "Can you provide samples and recent test reports?",
  ]},
  { group: "Materials & sourcing", qs: [
    "Which materials/components can you work with, and where do you source them?",
    "Can you customize specs, and what is the minimum order quantity?",
    "How do you manage raw-material price changes?",
  ]},
  { group: "Commercial & terms", qs: [
    "What payment terms and currency do you offer for a new buyer?",
    "What discounts apply at volume? Any exclusivity options?",
    "Who is the decision-maker for pricing and disputes?",
  ]},
  { group: "Logistics & compliance", qs: [
    "Which Incoterms do you support and from which port?",
    "Do you hold an import/export license and handle export docs?",
    "Any ongoing legal, environmental or labor issues we should know about?",
  ]},
];

/* ── helpers ── */
function DeptDot({ d }: { d: DeptKey }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${DEPTS[d].dot}`} aria-hidden />;
}
function DeptChip({ d }: { d: DeptKey }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${DEPTS[d].soft} ${DEPTS[d].text}`}>
      <DeptDot d={d} /> {DEPTS[d].name}
    </span>
  );
}

const TOC = [
  { id: "lifecycle", label: "Status lifecycle" },
  { id: "flow", label: "The process at a glance" },
  { id: "stages", label: "Stages, timing & owners" },
  { id: "raci", label: "RACI — who does what" },
  { id: "roles", label: "Roles & responsibilities" },
  { id: "questions", label: "Factory-visit questions" },
  { id: "sla", label: "Timing & SLAs" },
];

export default function SupplierOnboardingWorkflowPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Link href="/knowledge" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] min-w-0">
            <KnowledgeIcon size={14} />
            <Link href="/knowledge" className="hover:text-[var(--text-primary)]">Knowledge</Link>
            <span>/</span>
            <span className="text-[var(--text-secondary)] truncate">Supplier Onboarding Workflow</span>
          </div>
        </div>

        {/* Hero */}
        <header className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 md:p-10 mb-8">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--accent,#0066FF)] mb-3">
            <WorkflowIcon size={14} /> Standard Operating Procedure
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight max-w-3xl">
            Supplier onboarding workflow — from lead to active supplier
          </h1>
          <p className="mt-3 text-[14px] md:text-[15px] leading-relaxed text-[var(--text-faint)] max-w-3xl">
            The operating plan for the whole supplier onboarding operation: how a supplier moves from
            “found online” to “approved and purchasable”, the stages and timing, who enters the data
            first, who enriches it, who reviews it, and who signs it off. Target cycle: <strong className="text-[var(--text-secondary)]">about 30 days</strong>.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="#stages" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent,#0066FF)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity">
              <WorkflowIcon size={14} /> See the 10 stages
            </a>
            <Link href="/knowledge/supplier-data-guide" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Field-by-field data guide
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
          {/* TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)] mb-3">On this page</div>
              <nav className="space-y-1">
                {TOC.map((t) => (
                  <a key={t.id} href={`#${t.id}`} className="block rounded-md px-2.5 py-1.5 text-[12.5px] text-[var(--text-faint)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors">{t.label}</a>
                ))}
              </nav>
            </div>
          </aside>

          <main className="min-w-0 space-y-12">

            {/* LIFECYCLE */}
            <section id="lifecycle" className="scroll-mt-6">
              <SectionHeading icon={GaugeIcon} eyebrow="The big picture" title="Supplier status lifecycle" />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-4">
                A supplier moves through seven statuses. Each stage of the workflow advances it to the next.
              </p>
              <div className="flex flex-wrap items-stretch gap-2">
                {LIFECYCLE.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-2.5 min-w-[120px]">
                      <div className="text-[10px] tabular-nums text-[var(--text-dim)] mb-0.5">Step {i + 1}</div>
                      <div className="text-[13px] font-semibold">{s.label}</div>
                      <div className="text-[11px] text-[var(--text-faint)] mt-0.5">{s.note}</div>
                    </div>
                    {i < LIFECYCLE.length - 1 && <ArrowRightIcon className="h-4 w-4 shrink-0 text-[var(--text-ghost)]" />}
                  </div>
                ))}
              </div>
            </section>

            {/* FLOW AT A GLANCE */}
            <section id="flow" className="scroll-mt-6">
              <SectionHeading icon={WorkflowIcon} eyebrow="Handoffs" title="The process at a glance" />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-4">
                Ten stages, color-coded by the owning department. Data is created once, then enriched and
                checked as it passes between teams.
              </p>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <a key={s.n} href={`#stage-${s.n}`} className={`group flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2 transition-colors hover:border-[var(--border-focus)] ${DEPTS[s.dept].soft}`}>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[11px] font-bold">{s.n}</span>
                    <span className="text-[12px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">{s.title.split(" ").slice(0, 3).join(" ")}</span>
                    <DeptDot d={s.dept} />
                  </a>
                ))}
              </div>
            </section>

            {/* STAGES */}
            <section id="stages" className="scroll-mt-6">
              <SectionHeading icon={CalendarCheckIcon} eyebrow="The operation" title="Stages, timing & owners" />
              <div className="relative space-y-4 before:absolute before:left-[18px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--border-subtle)] md:before:left-[19px]">
                {STAGES.map((s) => {
                  const d = DEPTS[s.dept];
                  const Icon = s.icon;
                  return (
                    <div key={s.n} id={`stage-${s.n}`} className="scroll-mt-6 relative pl-12 md:pl-14">
                      {/* node */}
                      <div className={`absolute left-0 top-1 flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full border-2 border-[var(--bg-primary)] ${d.soft} ring-1 ring-inset ${d.ring}`}>
                        <Icon size={16} className={d.text} />
                      </div>
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 border-b border-[var(--border-subtle)]">
                          <span className="text-[11px] tabular-nums text-[var(--text-dim)]">Stage {s.n}</span>
                          <span className="text-[14.5px] font-semibold flex-1 min-w-[180px]">{s.title}</span>
                          <DeptChip d={s.dept} />
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-subtle)]">
                            <CalendarCheckIcon size={11} /> {s.days} · {s.duration}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-[var(--accent,#0066FF)]/12 px-2 py-0.5 text-[10.5px] font-semibold text-[var(--accent,#0066FF)]">→ {s.status}</span>
                        </div>
                        <div className="px-5 py-4">
                          <p className="text-[13px] leading-relaxed text-[var(--text-faint)] mb-3">{s.what}</p>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-1.5">What happens</div>
                          <ul className="space-y-1.5 mb-3">
                            {s.does.map((a, i) => (
                              <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${d.dot}`} />{a}
                              </li>
                            ))}
                          </ul>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg bg-[var(--bg-surface)] px-3 py-2">
                              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-0.5">Data entered</div>
                              <div className="text-[12px] text-[var(--text-secondary)]">{s.data}</div>
                            </div>
                            <div className="rounded-lg bg-[var(--bg-surface)] px-3 py-2">
                              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-0.5">Exit gate</div>
                              <div className="text-[12px] text-[var(--text-secondary)]">{s.gate}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* RACI */}
            <section id="raci" className="scroll-mt-6">
              <SectionHeading icon={ClipboardCheckIcon} eyebrow="Accountability" title="RACI — who does what" />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-3">
                For every stage: <strong className="text-[var(--text-secondary)]">R</strong> does the work,
                <strong className="text-[var(--text-secondary)]"> A</strong> owns the outcome,
                <strong className="text-[var(--text-secondary)]"> C</strong> is consulted,
                <strong className="text-[var(--text-secondary)]"> I</strong> is kept informed.
              </p>
              <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <table className="w-full min-w-[640px] text-[12px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <th className="text-left font-semibold px-4 py-2.5 text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-secondary)]">Stage</th>
                      {RACI_COLS.map((c) => (
                        <th key={c.key} className="px-2 py-2.5 text-center">
                          <span className="inline-flex flex-col items-center gap-1">
                            <DeptDot d={c.key} />
                            <span className={`text-[11px] font-semibold ${DEPTS[c.key].text}`}>{c.short}</span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {STAGES.map((s) => (
                      <tr key={s.n} className="border-b border-[var(--border-faint)] last:border-0">
                        <td className="px-4 py-2.5 sticky left-0 bg-[var(--bg-secondary)]">
                          <span className="text-[var(--text-dim)] tabular-nums mr-1.5">{s.n}</span>
                          <span className="text-[var(--text-secondary)]">{s.title.split(" ").slice(0, 4).join(" ")}</span>
                        </td>
                        {RACI_COLS.map((c) => {
                          const v = RACI[s.n][c.key];
                          return (
                            <td key={c.key} className="px-2 py-2 text-center">
                              <span className={`inline-flex min-w-[26px] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] ${RACI_STYLE[v]}`}>{v || "·"}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ROLES */}
            <section id="roles" className="scroll-mt-6">
              <SectionHeading icon={UsersIcon} eyebrow="The team" title="Roles & responsibilities" />
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(DEPTS) as DeptKey[]).map((k) => {
                  const d = DEPTS[k];
                  return (
                    <div key={k} className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 ring-1 ring-inset ${d.ring}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <DeptDot d={k} />
                        <span className={`text-[13px] font-semibold ${d.text}`}>{d.name}</span>
                      </div>
                      <div className="text-[12px] text-[var(--text-secondary)] mb-1">{d.role}</div>
                      <div className="text-[12px] leading-relaxed text-[var(--text-faint)]">
                        Owns stages {STAGES.filter((s) => s.dept === k).map((s) => s.n).join(", ") || "—"}.
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2 rounded-xl border border-[var(--accent,#0066FF)]/25 bg-[var(--accent,#0066FF)]/[0.06] px-4 py-3">
                <LightbulbIcon size={15} className="mt-0.5 shrink-0 text-[var(--accent,#0066FF)]" />
                <span className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                  The Procurement buyer is the <strong>case owner</strong> from start to finish — they keep the record moving, chase the other teams, and are accountable for it being complete. Other departments own only their section.
                </span>
              </div>
            </section>

            {/* QUESTIONS */}
            <section id="questions" className="scroll-mt-6">
              <SectionHeading icon={HelpCircleIcon} eyebrow="Stage 5 toolkit" title="Factory-visit & meeting question bank" />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-4">
                Ask these during the meeting/visit to gather the data that fills the Factory, Quality, Logistics, Risk and Negotiation sections.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {QUESTION_BANK.map((g) => (
                  <div key={g.group} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
                    <div className="text-[13px] font-semibold mb-2">{g.group}</div>
                    <ul className="space-y-1.5">
                      {g.qs.map((q, i) => (
                        <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--text-faint)]">
                          <HelpCircleIcon size={13} className="mt-0.5 shrink-0 text-[var(--text-dim)]" />{q}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* SLA */}
            <section id="sla" className="scroll-mt-6">
              <SectionHeading icon={CalendarCheckIcon} eyebrow="Cadence" title="Timing & SLAs" />
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { k: "Standard cycle", v: "~30 days", n: "Lead → Active for a typical supplier." },
                    { k: "Fast-track", v: "~10–14 days", n: "Strategic / urgent — runs stages in parallel." },
                    { k: "Review cycle", v: "Annual", n: "Re-evaluate active suppliers, or on any risk event." },
                  ].map((x) => (
                    <div key={x.k}>
                      <div className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">{x.k}</div>
                      <div className="text-2xl font-bold mt-0.5">{x.v}</div>
                      <div className="text-[12px] text-[var(--text-faint)] mt-0.5">{x.n}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-[12.5px] leading-relaxed text-[var(--text-faint)]">
                  Each stage has an exit gate — the record only advances when the gate is met. If a stage stalls
                  (e.g. documents not received), the case owner escalates to the Procurement Manager. A supplier
                  cannot reach <strong className="text-[var(--text-secondary)]">Active</strong> until Profile
                  Completeness shows the green “Ready” badge and Management has approved.
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/suppliers/new" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent,#0066FF)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity">
                  <HandshakeIcon size={14} /> Start a new supplier
                </Link>
                <Link href="/knowledge/supplier-data-guide" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  Field-by-field data guide →
                </Link>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
}

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
