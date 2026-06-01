"use client";

/* ---------------------------------------------------------------------------
   Supplier Onboarding — Operating Procedure (Workflow)  (EN / 中文 / العربية)
   Manager-grade operational plan: how a supplier moves from "found online" to
   "active & purchasable" — stages, timing/SLA, who enters/reviews/approves the
   data, a RACI matrix, status lifecycle, and the factory-visit question bank.
   All copy lives in CONTENT[lang]; the page renders from it and flips to RTL.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
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

/* ── department keys & colors (not translated) ── */
type DeptKey = "procurement" | "legal" | "finance" | "logistics" | "quality" | "commercial" | "management";
const DEPT_ORDER: DeptKey[] = ["procurement", "legal", "finance", "logistics", "quality", "commercial", "management"];
const DEPT_STYLE: Record<DeptKey, { dot: string; soft: string; text: string; ring: string }> = {
  procurement: { dot: "bg-blue-500", soft: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/30" },
  legal: { dot: "bg-violet-500", soft: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/30" },
  finance: { dot: "bg-emerald-500", soft: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30" },
  logistics: { dot: "bg-amber-500", soft: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/30" },
  quality: { dot: "bg-cyan-500", soft: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", ring: "ring-cyan-500/30" },
  commercial: { dot: "bg-rose-500", soft: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/30" },
  management: { dot: "bg-slate-500", soft: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-300", ring: "ring-slate-500/30" },
};

/* ── per-stage metadata (icon/dept — not translated); text lives in CONTENT ── */
const STAGE_META: { n: number; dept: DeptKey; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { n: 0, dept: "procurement", icon: SearchIcon },
  { n: 1, dept: "procurement", icon: Building2Icon },
  { n: 2, dept: "procurement", icon: MegaphoneIcon },
  { n: 3, dept: "legal", icon: FileCheckIcon },
  { n: 4, dept: "finance", icon: LandmarkIcon },
  { n: 5, dept: "quality", icon: FactoryIcon },
  { n: 6, dept: "commercial", icon: TruckIcon },
  { n: 7, dept: "procurement", icon: CheckCircleIcon },
  { n: 8, dept: "management", icon: BadgeCheckIcon },
  { n: 9, dept: "procurement", icon: RocketIcon },
];

/* ── RACI matrix (language-neutral letters; columns = departments) ── */
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

/* ── localizable content shape ── */
interface StageText { n: number; title: string; short: string; days: string; duration: string; status: string; what: string; does: string[]; data: string; gate: string }
interface Content {
  breadcrumb: { knowledge: string; current: string };
  onThisPage: string;
  hero: { eyebrow: string; title: string; bodyA: string; cycle: string; bodyB: string; ctaStages: string; ctaGuide: string };
  toc: { id: string; label: string }[];
  lifecycleHead: { eyebrow: string; title: string; intro: string; stepLabel: string };
  lifecycle: { label: string; note: string }[];
  flowHead: { eyebrow: string; title: string; intro: string };
  stagesHead: { eyebrow: string; title: string };
  stageLabels: { stage: string; whatHappens: string; dataEntered: string; exitGate: string };
  stages: StageText[];
  depts: Record<DeptKey, { name: string; role: string }>;
  raciHead: { eyebrow: string; title: string; legendR: string; legendA: string; legendC: string; legendI: string; colStage: string };
  rolesHead: { eyebrow: string; title: string; ownsStages: string; caseOwner: string };
  questionsHead: { eyebrow: string; title: string; intro: string };
  questions: { group: string; qs: string[] }[];
  slaHead: { eyebrow: string; title: string };
  sla: { k: string; v: string; n: string }[];
  slaNote: string;
  ctaStart: string;
  ctaGuide: string;
}

/* ════════════════════════ ENGLISH (source of truth) ════════════════════════ */
const EN: Content = {
  breadcrumb: { knowledge: "Knowledge", current: "Supplier Onboarding Workflow" },
  onThisPage: "On this page",
  hero: {
    eyebrow: "Standard Operating Procedure",
    title: "Supplier onboarding workflow — from lead to active supplier",
    bodyA: "The operating plan for the whole supplier onboarding operation: how a supplier moves from “found online” to “approved and purchasable”, the stages and timing, who enters the data first, who enriches it, who reviews it, and who signs it off. Target cycle:",
    cycle: "about 30 days",
    bodyB: ".",
    ctaStages: "See the 10 stages",
    ctaGuide: "Field-by-field data guide",
  },
  toc: [
    { id: "lifecycle", label: "Status lifecycle" },
    { id: "flow", label: "The process at a glance" },
    { id: "stages", label: "Stages, timing & owners" },
    { id: "raci", label: "RACI — who does what" },
    { id: "roles", label: "Roles & responsibilities" },
    { id: "questions", label: "Factory-visit questions" },
    { id: "sla", label: "Timing & SLAs" },
  ],
  lifecycleHead: {
    eyebrow: "The big picture",
    title: "Supplier status lifecycle",
    intro: "A supplier moves through seven statuses. Each stage of the workflow advances it to the next.",
    stepLabel: "Step",
  },
  lifecycle: [
    { label: "Lead", note: "Sourced, not yet in Hub" },
    { label: "Draft", note: "Basic data entered" },
    { label: "Verification", note: "Legal + Finance vetting" },
    { label: "Assessment", note: "Factory visit + quality" },
    { label: "Review", note: "Leads check sections" },
    { label: "Approved", note: "Management sign-off" },
    { label: "Active", note: "Live for purchasing" },
  ],
  flowHead: {
    eyebrow: "Handoffs",
    title: "The process at a glance",
    intro: "Ten stages, color-coded by the owning department. Data is created once, then enriched and checked as it passes between teams.",
  },
  stagesHead: { eyebrow: "The operation", title: "Stages, timing & owners" },
  stageLabels: { stage: "Stage", whatHappens: "What happens", dataEntered: "Data entered", exitGate: "Exit gate" },
  stages: [
    { n: 0, title: "Source & qualify the supplier", short: "Source & qualify", days: "Day 0", duration: "0–1 day", status: "Lead",
      what: "Find a candidate supplier and decide they are worth pursuing — before any record is created.",
      does: [
        "Find candidates: internet search, Alibaba / Made-in-China, exhibitions, referrals, existing network.",
        "Do a quick sanity check: do they make what we need, at roughly the right scale and region?",
        "Capture the source link and a one-line reason to pursue.",
      ], data: "Nothing in the Hub yet — notes/links kept by the buyer.", gate: "Buyer confirms the lead is worth onboarding." },
    { n: 1, title: "Create the draft record (basic data)", short: "Create draft record", days: "Day 0–1", duration: "~1 hour", status: "Draft",
      what: "Open the supplier card and enter everything you can already get from public sources.",
      does: [
        "Search the directory first to be sure it is not a duplicate (try the Chinese name too).",
        "Click Add Supplier and fill from the website/listing: company name, supplier type, profile, classifications.",
        "Add the general contact details (phone, email, address, country).",
      ], data: "Company Name · Company Profile · Classifications · Contact Details", gate: "Required basics saved; record exists as Draft." },
    { n: 2, title: "First contact & information request (RFI)", short: "First contact & RFI", days: "Day 1–5", duration: "2–4 days", status: "Draft",
      what: "Reach out, introduce Koleex, and request the documents and details only the supplier can give you.",
      does: [
        "Make contact and identify the real people: add Contact Persons (decision-maker, primary, channels, language).",
        "Request: company profile/catalogue, business license, certifications, and a sample if relevant.",
        "Record chat handles in Messaging IDs.",
      ], data: "Contact Persons · Messaging IDs · Catalogue", gate: "A named contact responds and sends initial documents." },
    { n: 3, title: "Compliance & legal intake (KYC)", short: "Compliance & legal", days: "Day 3–10", duration: "3–7 days", status: "Verification",
      what: "Verify the supplier is a real, legitimate legal entity and capture its formal identity.",
      does: [
        "Enter Legal Identity and Trade & Tax IDs from the business license.",
        "Run KYC / sanctions screening per policy.",
        "Upload the business license, certificates and any signed NDA to Documents.",
      ], data: "Legal Identity · Trade & Tax IDs · Documents", gate: "Legal entity verified; documents on file; no KYC red flags." },
    { n: 4, title: "Finance & banking setup", short: "Finance & banking", days: "Day 5–12", duration: "2–5 days", status: "Verification",
      what: "Agree payment terms and capture verified banking details.",
      does: [
        "Record payment terms and currency from the agreement.",
        "Enter bank details exactly as on the bank confirmation letter.",
        "Verify the account by phone with a known contact before saving — never from email alone.",
      ], data: "Payment Information", gate: "Payment terms set; bank details entered and phone-verified." },
    { n: 5, title: "Schedule meeting & factory visit / audit", short: "Factory visit / audit", days: "Day 10–25", duration: "1–2 weeks", status: "Assessment",
      what: "Meet the supplier and audit the factory on-site (or by video) to confirm capability and gather deep data.",
      does: [
        "Schedule the meeting/visit and prepare the question bank (see below).",
        "On-site: assess capacity, equipment, certifications, quality systems; evaluate samples.",
        "Fill Factory and Quality & Performance, and set the Factory visit date.",
      ], data: "Factory · Quality & Performance", gate: "Visit completed; factory and quality data recorded." },
    { n: 6, title: "Logistics & commercial assessment", short: "Logistics & commercial", days: "Day 12–25", duration: "in parallel", status: "Assessment",
      what: "Lock the operational and commercial picture while the audit happens.",
      does: [
        "Logistics: Incoterms, ports, lead times, packaging.",
        "Commercial: log Risk items (dimension/severity/status) and Negotiation intelligence.",
        "Confirm products this supplier will provide.",
      ], data: "Logistics & Trade · Risk · Negotiation · Products", gate: "Logistics terms, risks and negotiation notes captured." },
    { n: 7, title: "Section review by department leads", short: "Section review", days: "Day 25–28", duration: "2–3 days", status: "Review",
      what: "Each owner checks their own section; Procurement consolidates the whole record.",
      does: [
        "Each department lead reviews their section for accuracy and completeness (the owner badge shows who).",
        "Procurement Manager consolidates, resolves gaps, and checks the Profile Completeness panel.",
        "Fix anything below the “Ready” bar before sending for approval.",
      ], data: "All sections — reviewed, not newly entered.", gate: "Completeness shows green “Ready”; leads sign off their sections." },
    { n: 8, title: "Management approval", short: "Management approval", days: "Day 28–30", duration: "1–2 days", status: "Approved",
      what: "Management makes the go/no-go decision and positions the supplier strategically.",
      does: [
        "Review the consolidated record and risk profile.",
        "Set Strategic Status and internal score.",
        "Approve, reject, or send back with conditions.",
      ], data: "Strategic Status", gate: "Management approves → supplier becomes Approved." },
    { n: 9, title: "Activate & maintain", short: "Activate & maintain", days: "Day 30 →", duration: "ongoing", status: "Active",
      what: "The supplier goes live for purchasing and is kept current over time.",
      does: [
        "Supplier becomes selectable in Purchase; first PO can be raised.",
        "Update performance scores after each order; refresh documents before they expire.",
        "Re-evaluate periodically (annual review or on any risk event).",
      ], data: "Quality & Performance (ongoing) · Documents (renewals) · Risk (events)", gate: "Active supplier, maintained on a review cycle." },
  ],
  depts: {
    procurement: { name: "Procurement", role: "Buyer / Sourcing Specialist · Procurement Manager" },
    legal: { name: "Compliance / Legal", role: "Compliance Officer" },
    finance: { name: "Finance / Treasury", role: "Finance / Treasury Officer" },
    logistics: { name: "Logistics", role: "Logistics Coordinator" },
    quality: { name: "Sourcing / Quality", role: "Quality / Sourcing Engineer" },
    commercial: { name: "Commercial", role: "Commercial Lead / Buyer Lead" },
    management: { name: "Management", role: "Procurement Director / GM" },
  },
  raciHead: {
    eyebrow: "Accountability",
    title: "RACI — who does what",
    legendR: "R does the work",
    legendA: "A owns the outcome",
    legendC: "C is consulted",
    legendI: "I is kept informed",
    colStage: "Stage",
  },
  rolesHead: {
    eyebrow: "The team",
    title: "Roles & responsibilities",
    ownsStages: "Owns stages",
    caseOwner: "The Procurement buyer is the case owner from start to finish — they keep the record moving, chase the other teams, and are accountable for it being complete. Other departments own only their section.",
  },
  questionsHead: {
    eyebrow: "Stage 5 toolkit",
    title: "Factory-visit & meeting question bank",
    intro: "Ask these during the meeting/visit to gather the data that fills the Factory, Quality, Logistics, Risk and Negotiation sections.",
  },
  questions: [
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
  ],
  slaHead: { eyebrow: "Cadence", title: "Timing & SLAs" },
  sla: [
    { k: "Standard cycle", v: "~30 days", n: "Lead → Active for a typical supplier." },
    { k: "Fast-track", v: "~10–14 days", n: "Strategic / urgent — runs stages in parallel." },
    { k: "Review cycle", v: "Annual", n: "Re-evaluate active suppliers, or on any risk event." },
  ],
  slaNote: "Each stage has an exit gate — the record only advances when the gate is met. If a stage stalls (e.g. documents not received), the case owner escalates to the Procurement Manager. A supplier cannot reach Active until Profile Completeness shows the green “Ready” badge and Management has approved.",
  ctaStart: "Start a new supplier",
  ctaGuide: "Field-by-field data guide →",
};

/* ════════════════════════ 中文 ════════════════════════ */
const ZH: Content = {
  "breadcrumb": {
    "knowledge": "知识库",
    "current": "供应商引入工作流程"
  },
  "onThisPage": "本页内容",
  "hero": {
    "eyebrow": "标准操作流程",
    "title": "供应商引入工作流程——从线索到正式供应商",
    "bodyA": "整个供应商引入运作的操作计划：供应商如何从“线上发现”推进到“批准并可采购”，各阶段与时间安排，谁先录入数据，谁补充完善，谁审核，谁签字批准。目标周期：",
    "cycle": "约 30 天",
    "bodyB": "。",
    "ctaStages": "查看 10 个阶段",
    "ctaGuide": "逐字段数据指南"
  },
  "toc": [
    {
      "id": "lifecycle",
      "label": "状态生命周期"
    },
    {
      "id": "flow",
      "label": "流程概览"
    },
    {
      "id": "stages",
      "label": "阶段、时间与负责人"
    },
    {
      "id": "raci",
      "label": "RACI——谁做什么"
    },
    {
      "id": "roles",
      "label": "角色与职责"
    },
    {
      "id": "questions",
      "label": "工厂考察问题"
    },
    {
      "id": "sla",
      "label": "时间与 SLA"
    }
  ],
  "lifecycleHead": {
    "eyebrow": "全局视角",
    "title": "供应商状态生命周期",
    "intro": "供应商会经历七种状态。工作流程的每个阶段都会将其推进到下一个状态。",
    "stepLabel": "步骤"
  },
  "lifecycle": [
    {
      "label": "线索",
      "note": "已寻源，尚未录入 Hub"
    },
    {
      "label": "草稿",
      "note": "已录入基础数据"
    },
    {
      "label": "核实",
      "note": "法务 + 财务审查"
    },
    {
      "label": "评估",
      "note": "工厂考察 + 质量"
    },
    {
      "label": "复核",
      "note": "负责人检查各板块"
    },
    {
      "label": "已批准",
      "note": "管理层签字批准"
    },
    {
      "label": "启用",
      "note": "上线可采购"
    }
  ],
  "flowHead": {
    "eyebrow": "交接",
    "title": "流程概览",
    "intro": "十个阶段，按主责部门进行颜色区分。数据只创建一次，随后在各团队之间流转时不断补充完善并核查。"
  },
  "stagesHead": {
    "eyebrow": "运作",
    "title": "阶段、时间与负责人"
  },
  "stageLabels": {
    "stage": "阶段",
    "whatHappens": "具体内容",
    "dataEntered": "录入数据",
    "exitGate": "出口门槛"
  },
  "stages": [
    {
      "n": 0,
      "title": "寻源并初步筛选供应商",
      "short": "寻源与筛选",
      "days": "第 0 天",
      "duration": "0–1 天",
      "status": "线索",
      "what": "找到一家候选供应商，并判断其是否值得进一步推进——在创建任何记录之前。",
      "does": [
        "寻找候选供应商：网络搜索、Alibaba / Made-in-China、展会、推荐、现有人脉。",
        "做一次快速合理性核查：他们是否生产我们所需的产品，规模和地区是否大致合适？",
        "记录来源链接以及一句话说明值得推进的理由。"
      ],
      "data": "Hub 中尚无任何记录——由采购员保留笔记/链接。",
      "gate": "采购员确认该线索值得引入。"
    },
    {
      "n": 1,
      "title": "创建草稿记录（基础数据）",
      "short": "创建草稿记录",
      "days": "第 0–1 天",
      "duration": "约 1 小时",
      "status": "草稿",
      "what": "打开供应商卡片，录入所有已能从公开渠道获取的信息。",
      "does": [
        "先搜索目录，确保不是重复记录（也尝试用中文名称搜索）。",
        "点击“添加供应商”，根据网站/名录填写：公司名称、供应商类型、简介、分类。",
        "添加通用联系方式（电话、邮箱、地址、国家）。"
      ],
      "data": "公司名称 · 公司简介 · 分类 · 联系方式",
      "gate": "必填基础信息已保存；记录以“草稿”状态存在。"
    },
    {
      "n": 2,
      "title": "首次接触与信息索取（RFI）",
      "short": "首次接触与 RFI",
      "days": "第 1–5 天",
      "duration": "2–4 天",
      "status": "草稿",
      "what": "主动联系，介绍 Koleex，并索取只有供应商才能提供的文件和细节。",
      "does": [
        "建立联系并确认真正的对接人：添加联系人（决策者、主要联系人、渠道、语言）。",
        "索取：公司简介/产品目录、营业执照、认证证书，必要时索取样品。",
        "在“即时通讯 ID”中记录聊天账号。"
      ],
      "data": "联系人 · 即时通讯 ID · 产品目录",
      "gate": "有具名联系人回复并发送初步文件。"
    },
    {
      "n": 3,
      "title": "合规与法务受理（KYC）",
      "short": "合规与法务",
      "days": "第 3–10 天",
      "duration": "3–7 天",
      "status": "核实",
      "what": "核实该供应商是真实、合法的法律实体，并记录其正式身份信息。",
      "does": [
        "根据营业执照录入法律身份以及工商与税务编号。",
        "按政策进行 KYC / 制裁名单筛查。",
        "将营业执照、证书以及任何已签署的 NDA 上传至“文件”。"
      ],
      "data": "法律身份 · 工商与税务编号 · 文件",
      "gate": "法律实体已核实；文件已存档；无 KYC 风险警示。"
    },
    {
      "n": 4,
      "title": "财务与银行信息设置",
      "short": "财务与银行",
      "days": "第 5–12 天",
      "duration": "2–5 天",
      "status": "核实",
      "what": "商定付款条件并记录经核实的银行信息。",
      "does": [
        "根据协议记录付款条件和币种。",
        "严格按照银行确认函录入银行信息。",
        "保存前与已知联系人通过电话核实账户信息——切勿仅凭邮件确认。"
      ],
      "data": "付款信息",
      "gate": "付款条件已设定；银行信息已录入并经电话核实。"
    },
    {
      "n": 5,
      "title": "安排会面与工厂考察/审核",
      "short": "工厂考察/审核",
      "days": "第 10–25 天",
      "duration": "1–2 周",
      "status": "评估",
      "what": "与供应商会面并现场（或通过视频）审核工厂，以确认其能力并收集深入数据。",
      "does": [
        "安排会面/考察并准备问题清单（见下文）。",
        "现场：评估产能、设备、认证、质量体系；评估样品。",
        "填写“工厂”和“质量与绩效”，并设定工厂考察日期。"
      ],
      "data": "工厂 · 质量与绩效",
      "gate": "考察已完成；工厂和质量数据已记录。"
    },
    {
      "n": 6,
      "title": "物流与商务评估",
      "short": "物流与商务",
      "days": "第 12–25 天",
      "duration": "并行进行",
      "status": "评估",
      "what": "在审核进行的同时，锁定运营与商务全貌。",
      "does": [
        "物流：Incoterms、港口、交货周期、包装。",
        "商务：记录风险项（维度/严重程度/状态）以及谈判情报。",
        "确认该供应商将提供的产品。"
      ],
      "data": "物流与贸易 · 风险 · 谈判 · 产品",
      "gate": "物流条款、风险及谈判记录已采集。"
    },
    {
      "n": 7,
      "title": "各部门负责人板块复核",
      "short": "板块复核",
      "days": "第 25–28 天",
      "duration": "2–3 天",
      "status": "复核",
      "what": "各负责人检查各自的板块；采购部整合整份记录。",
      "does": [
        "各部门负责人复核本部门板块的准确性与完整性（负责人标记显示具体责任人）。",
        "采购经理进行整合、补齐缺口，并检查“资料完整度”面板。",
        "在提交审批前，修复所有低于“就绪”标准的内容。"
      ],
      "data": "所有板块——复核，而非新录入。",
      "gate": "完整度显示绿色“就绪”；各负责人对其板块签字确认。"
    },
    {
      "n": 8,
      "title": "管理层审批",
      "short": "管理层审批",
      "days": "第 28–30 天",
      "duration": "1–2 天",
      "status": "已批准",
      "what": "管理层做出是否合作的决定，并对供应商进行战略定位。",
      "does": [
        "复核整合后的记录与风险概况。",
        "设定战略状态与内部评分。",
        "批准、驳回，或附条件退回。"
      ],
      "data": "战略状态",
      "gate": "管理层批准 → 供应商变为“已批准”。"
    },
    {
      "n": 9,
      "title": "启用与维护",
      "short": "启用与维护",
      "days": "第 30 天 →",
      "duration": "持续进行",
      "status": "启用",
      "what": "供应商上线可供采购，并随时间保持信息更新。",
      "does": [
        "供应商在“采购”中变为可选；可开出首个 PO。",
        "每次订单后更新绩效评分；在文件到期前及时刷新。",
        "定期重新评估（年度复核或在发生任何风险事件时）。"
      ],
      "data": "质量与绩效（持续） · 文件（续期） · 风险（事件）",
      "gate": "启用中的供应商，按复核周期维护。"
    }
  ],
  "depts": {
    "procurement": {
      "name": "采购",
      "role": "采购员 / 寻源专员 · 采购经理"
    },
    "legal": {
      "name": "合规 / 法务",
      "role": "合规官"
    },
    "finance": {
      "name": "财务 / 资金",
      "role": "财务 / 资金专员"
    },
    "logistics": {
      "name": "物流",
      "role": "物流协调员"
    },
    "quality": {
      "name": "寻源 / 质量",
      "role": "质量 / 寻源工程师"
    },
    "commercial": {
      "name": "商务",
      "role": "商务负责人 / 采购组长"
    },
    "management": {
      "name": "管理层",
      "role": "采购总监 / 总经理"
    }
  },
  "raciHead": {
    "eyebrow": "问责",
    "title": "RACI——谁做什么",
    "legendR": "R 执行工作",
    "legendA": "A 对结果负责",
    "legendC": "C 接受咨询",
    "legendI": "I 知会告知",
    "colStage": "阶段"
  },
  "rolesHead": {
    "eyebrow": "团队",
    "title": "角色与职责",
    "ownsStages": "负责阶段",
    "caseOwner": "采购员是从始至终的案件负责人——他们推动记录持续推进、督促其他团队，并对记录的完整性负责。其他部门只负责各自的板块。"
  },
  "questionsHead": {
    "eyebrow": "第 5 阶段工具包",
    "title": "工厂考察与会面问题清单",
    "intro": "在会面/考察期间提出这些问题，以收集用于填写工厂、质量、物流、风险和谈判板块的数据。"
  },
  "questions": [
    {
      "group": "公司与产能",
      "qs": [
        "贵司经营多久了，主要客户有哪些？",
        "贵司的月/年产能是多少，目前产能利用率如何？",
        "这家工厂是贵司自有，还是有部分生产外包？",
        "贵司通常的交货周期和旺季交货周期分别是多少？"
      ]
    },
    {
      "group": "质量与流程",
      "qs": [
        "贵司持有哪些认证（ISO、CE 等），我们能否查看？",
        "贵司的在线检验和最终检验流程是怎样的？通常的不良率是多少？",
        "贵司如何处理质量索赔或返工？",
        "贵司能否提供样品和近期的检测报告？"
      ]
    },
    {
      "group": "材料与采购",
      "qs": [
        "贵司可使用哪些材料/零部件，分别从何处采购？",
        "贵司能否按规格定制，最低起订量是多少？",
        "贵司如何应对原材料价格波动？"
      ]
    },
    {
      "group": "商务与条款",
      "qs": [
        "对于新买家，贵司提供哪些付款条件和币种？",
        "批量采购时有哪些折扣？是否有独家合作选项？",
        "在定价和争议方面，谁是决策者？"
      ]
    },
    {
      "group": "物流与合规",
      "qs": [
        "贵司支持哪些 Incoterms，从哪个港口发货？",
        "贵司是否持有进出口许可证并能处理出口单据？",
        "是否存在我们应当知晓的、正在进行的法律、环境或劳工方面的问题？"
      ]
    }
  ],
  "slaHead": {
    "eyebrow": "节奏",
    "title": "时间与 SLA"
  },
  "sla": [
    {
      "k": "标准周期",
      "v": "约 30 天",
      "n": "典型供应商从线索 → 启用。"
    },
    {
      "k": "快速通道",
      "v": "约 10–14 天",
      "n": "战略性 / 紧急——各阶段并行推进。"
    },
    {
      "k": "复核周期",
      "v": "每年",
      "n": "重新评估启用中的供应商，或在发生任何风险事件时进行。"
    }
  ],
  "slaNote": "每个阶段都有一个出口门槛——只有达到门槛，记录才会推进到下一阶段。如果某个阶段停滞（例如未收到文件），案件负责人需升级上报至采购经理。供应商必须在“资料完整度”显示绿色“就绪”标记且管理层已批准后，才能进入“启用”状态。",
  "ctaStart": "创建新供应商",
  "ctaGuide": "逐字段数据指南 →"
};

/* ════════════════════════ العربية ════════════════════════ */
const AR: Content = {
  "breadcrumb": {
    "knowledge": "قاعدة المعرفة",
    "current": "سير عمل إدراج المورّدين"
  },
  "onThisPage": "في هذه الصفحة",
  "hero": {
    "eyebrow": "إجراء تشغيل قياسي",
    "title": "سير عمل إدراج المورّدين — من العميل المحتمل إلى المورّد الفعّال",
    "bodyA": "خطة التشغيل لعملية إدراج المورّدين بالكامل: كيف ينتقل المورّد من «مكتشف عبر الإنترنت» إلى «معتمد وقابل للشراء منه»، والمراحل والتوقيت، ومن يُدخل البيانات أولاً، ومن يثريها، ومن يراجعها، ومن يعتمدها نهائيًا. الدورة المستهدفة:",
    "cycle": "حوالي 30 يوم",
    "bodyB": ".",
    "ctaStages": "اطّلع على المراحل العشر",
    "ctaGuide": "دليل البيانات حقلًا بحقل"
  },
  "toc": [
    {
      "id": "lifecycle",
      "label": "دورة حياة الحالة"
    },
    {
      "id": "flow",
      "label": "العملية في لمحة"
    },
    {
      "id": "stages",
      "label": "المراحل والتوقيت والمسؤولون"
    },
    {
      "id": "raci",
      "label": "RACI — من يفعل ماذا"
    },
    {
      "id": "roles",
      "label": "الأدوار والمسؤوليات"
    },
    {
      "id": "questions",
      "label": "أسئلة زيارة المصنع"
    },
    {
      "id": "sla",
      "label": "التوقيت واتفاقيات مستوى الخدمة"
    }
  ],
  "lifecycleHead": {
    "eyebrow": "الصورة العامة",
    "title": "دورة حياة حالة المورّد",
    "intro": "يمر المورّد عبر سبع حالات. كل مرحلة من سير العمل تنقله إلى الحالة التالية.",
    "stepLabel": "الخطوة"
  },
  "lifecycle": [
    {
      "label": "عميل محتمل",
      "note": "تم تحديده، ولم يُدخل بعد في Koleex"
    },
    {
      "label": "مسودة",
      "note": "تم إدخال البيانات الأساسية"
    },
    {
      "label": "تحقق",
      "note": "فحص القسم القانوني والمالي"
    },
    {
      "label": "تقييم",
      "note": "زيارة المصنع والجودة"
    },
    {
      "label": "مراجعة",
      "note": "يراجع المسؤولون الأقسام"
    },
    {
      "label": "معتمد",
      "note": "موافقة الإدارة"
    },
    {
      "label": "فعّال",
      "note": "متاح للشراء"
    }
  ],
  "flowHead": {
    "eyebrow": "عمليات التسليم",
    "title": "العملية في لمحة",
    "intro": "عشر مراحل، مميزة بالألوان حسب القسم المسؤول. تُنشأ البيانات مرة واحدة، ثم تُثرى وتُفحص أثناء انتقالها بين الفرق."
  },
  "stagesHead": {
    "eyebrow": "العملية",
    "title": "المراحل والتوقيت والمسؤولون"
  },
  "stageLabels": {
    "stage": "المرحلة",
    "whatHappens": "ما الذي يحدث",
    "dataEntered": "البيانات المُدخلة",
    "exitGate": "بوابة الخروج"
  },
  "stages": [
    {
      "n": 0,
      "title": "تحديد المورّد وتأهيله",
      "short": "تحديد وتأهيل",
      "days": "اليوم 0",
      "duration": "0–1 يوم",
      "status": "عميل محتمل",
      "what": "العثور على مورّد مرشّح وتقرير أنه يستحق المتابعة — قبل إنشاء أي سجل.",
      "does": [
        "العثور على المرشّحين: البحث عبر الإنترنت، Alibaba / Made-in-China، المعارض، الإحالات، الشبكة الحالية.",
        "إجراء فحص سريع للمنطقية: هل ينتجون ما نحتاجه، وبالحجم والمنطقة المناسبين تقريبًا؟",
        "تسجيل رابط المصدر وسبب من سطر واحد للمتابعة."
      ],
      "data": "لا شيء في Koleex بعد — يحتفظ المشتري بالملاحظات/الروابط.",
      "gate": "يؤكد المشتري أن العميل المحتمل يستحق الإدراج."
    },
    {
      "n": 1,
      "title": "إنشاء سجل المسودة (البيانات الأساسية)",
      "short": "إنشاء سجل مسودة",
      "days": "اليوم 0–1",
      "duration": "~1 ساعة",
      "status": "مسودة",
      "what": "فتح بطاقة المورّد وإدخال كل ما يمكن الحصول عليه بالفعل من المصادر العامة.",
      "does": [
        "ابحث في الدليل أولاً للتأكد من أنه ليس مكررًا (جرّب الاسم الصيني أيضًا).",
        "انقر على «إضافة مورّد» واملأ من الموقع/الإعلان: اسم الشركة، نوع المورّد، الملف التعريفي، التصنيفات.",
        "أضف تفاصيل التواصل العامة (الهاتف، البريد الإلكتروني، العنوان، الدولة)."
      ],
      "data": "اسم الشركة · الملف التعريفي للشركة · التصنيفات · تفاصيل التواصل",
      "gate": "حُفظت الأساسيات المطلوبة؛ السجل موجود كمسودة."
    },
    {
      "n": 2,
      "title": "التواصل الأول وطلب المعلومات (RFI)",
      "short": "التواصل الأول وطلب المعلومات",
      "days": "اليوم 1–5",
      "duration": "2–4 أيام",
      "status": "مسودة",
      "what": "تواصل، وعرّف بـ Koleex، واطلب المستندات والتفاصيل التي لا يمكن إلا للمورّد تقديمها.",
      "does": [
        "تواصل وحدّد الأشخاص الفعليين: أضف جهات الاتصال (صانع القرار، الجهة الأساسية، القنوات، اللغة).",
        "اطلب: الملف التعريفي/الكتالوج للشركة، الرخصة التجارية، الشهادات، وعينة إن كانت ذات صلة.",
        "سجّل معرّفات المحادثة في معرّفات المراسلة."
      ],
      "data": "جهات الاتصال · معرّفات المراسلة · الكتالوج",
      "gate": "تستجيب جهة اتصال مُسمّاة وترسل المستندات الأولية."
    },
    {
      "n": 3,
      "title": "الالتزام والاستلام القانوني (KYC)",
      "short": "الالتزام والقانوني",
      "days": "اليوم 3–10",
      "duration": "3–7 أيام",
      "status": "تحقق",
      "what": "التحقق من أن المورّد كيان قانوني حقيقي وشرعي، وتسجيل هويته الرسمية.",
      "does": [
        "أدخل الهوية القانونية والمعرّفات التجارية والضريبية من الرخصة التجارية.",
        "نفّذ فحص KYC / العقوبات وفق السياسة.",
        "ارفع الرخصة التجارية والشهادات وأي NDA موقّعة إلى المستندات."
      ],
      "data": "الهوية القانونية · المعرّفات التجارية والضريبية · المستندات",
      "gate": "تم التحقق من الكيان القانوني؛ المستندات محفوظة؛ لا توجد إشارات تحذيرية في KYC."
    },
    {
      "n": 4,
      "title": "إعداد القسم المالي والمصرفي",
      "short": "المالية والمصرفية",
      "days": "اليوم 5–12",
      "duration": "2–5 أيام",
      "status": "تحقق",
      "what": "الاتفاق على شروط الدفع وتسجيل التفاصيل المصرفية المُتحقق منها.",
      "does": [
        "سجّل شروط الدفع والعملة من الاتفاقية.",
        "أدخل التفاصيل المصرفية تمامًا كما في خطاب التأكيد البنكي.",
        "تحقّق من الحساب هاتفيًا مع جهة اتصال معروفة قبل الحفظ — لا تعتمد على البريد الإلكتروني وحده أبدًا."
      ],
      "data": "معلومات الدفع",
      "gate": "تم تحديد شروط الدفع؛ أُدخلت التفاصيل المصرفية وتم التحقق منها هاتفيًا."
    },
    {
      "n": 5,
      "title": "تحديد موعد الاجتماع وزيارة/تدقيق المصنع",
      "short": "زيارة/تدقيق المصنع",
      "days": "اليوم 10–25",
      "duration": "1–2 أسبوع",
      "status": "تقييم",
      "what": "قابل المورّد ودقّق المصنع ميدانيًا (أو عبر الفيديو) لتأكيد القدرة وجمع بيانات معمقة.",
      "does": [
        "حدّد موعد الاجتماع/الزيارة وأعدّ بنك الأسئلة (انظر أدناه).",
        "في الموقع: قيّم الطاقة الإنتاجية والمعدات والشهادات وأنظمة الجودة؛ وقيّم العينات.",
        "املأ بيانات المصنع والجودة والأداء، وحدّد تاريخ زيارة المصنع."
      ],
      "data": "المصنع · الجودة والأداء",
      "gate": "اكتملت الزيارة؛ سُجّلت بيانات المصنع والجودة."
    },
    {
      "n": 6,
      "title": "تقييم اللوجستيات والتقييم التجاري",
      "short": "اللوجستيات والتجاري",
      "days": "اليوم 12–25",
      "duration": "بالتوازي",
      "status": "تقييم",
      "what": "ترسيخ الصورة التشغيلية والتجارية أثناء إجراء التدقيق.",
      "does": [
        "اللوجستيات: Incoterms، الموانئ، المهل الزمنية، التغليف.",
        "التجاري: سجّل بنود المخاطر (البُعد/الخطورة/الحالة) ومعلومات التفاوض.",
        "أكّد المنتجات التي سيوفّرها هذا المورّد."
      ],
      "data": "اللوجستيات والتجارة · المخاطر · التفاوض · المنتجات",
      "gate": "تم تسجيل شروط اللوجستيات والمخاطر وملاحظات التفاوض."
    },
    {
      "n": 7,
      "title": "مراجعة الأقسام من قِبل مسؤولي الإدارات",
      "short": "مراجعة الأقسام",
      "days": "اليوم 25–28",
      "duration": "2–3 أيام",
      "status": "مراجعة",
      "what": "يفحص كل مسؤول قسمه الخاص؛ ويوحّد قسم المشتريات السجل بالكامل.",
      "does": [
        "يراجع مسؤول كل قسم قسمه من حيث الدقة والاكتمال (تُظهر شارة المسؤول من هو).",
        "يوحّد مدير المشتريات، ويعالج الثغرات، ويفحص لوحة اكتمال الملف التعريفي.",
        "أصلح أي شيء دون حدّ «جاهز» قبل الإرسال للاعتماد."
      ],
      "data": "جميع الأقسام — مُراجَعة، وليست مُدخَلة حديثًا.",
      "gate": "يُظهر الاكتمال شارة «جاهز» الخضراء؛ ويعتمد المسؤولون أقسامهم."
    },
    {
      "n": 8,
      "title": "موافقة الإدارة",
      "short": "موافقة الإدارة",
      "days": "اليوم 28–30",
      "duration": "1–2 أيام",
      "status": "معتمد",
      "what": "تتخذ الإدارة قرار المضي/عدم المضي وتموضع المورّد استراتيجيًا.",
      "does": [
        "راجع السجل الموحّد وملف المخاطر.",
        "حدّد الحالة الاستراتيجية والدرجة الداخلية.",
        "اعتمد، أو ارفض، أو أعِد مع شروط."
      ],
      "data": "الحالة الاستراتيجية",
      "gate": "توافق الإدارة ← يصبح المورّد معتمدًا."
    },
    {
      "n": 9,
      "title": "التفعيل والصيانة",
      "short": "التفعيل والصيانة",
      "days": "اليوم 30 →",
      "duration": "مستمر",
      "status": "فعّال",
      "what": "يصبح المورّد فعّالًا للشراء ويُحافَظ على تحديثه بمرور الوقت.",
      "does": [
        "يصبح المورّد قابلًا للاختيار في الشراء؛ ويمكن إصدار أول PO.",
        "حدّث درجات الأداء بعد كل طلب؛ وجدّد المستندات قبل انتهاء صلاحيتها.",
        "أعِد التقييم دوريًا (مراجعة سنوية أو عند أي حدث مخاطرة)."
      ],
      "data": "الجودة والأداء (مستمر) · المستندات (التجديدات) · المخاطر (الأحداث)",
      "gate": "مورّد فعّال، يُصان وفق دورة مراجعة."
    }
  ],
  "depts": {
    "procurement": {
      "name": "المشتريات",
      "role": "مشتري / أخصائي توريد · مدير المشتريات"
    },
    "legal": {
      "name": "الالتزام / القانوني",
      "role": "مسؤول الالتزام"
    },
    "finance": {
      "name": "المالية / الخزينة",
      "role": "مسؤول المالية / الخزينة"
    },
    "logistics": {
      "name": "اللوجستيات",
      "role": "منسّق اللوجستيات"
    },
    "quality": {
      "name": "التوريد / الجودة",
      "role": "مهندس الجودة / التوريد"
    },
    "commercial": {
      "name": "التجاري",
      "role": "مسؤول التجاري / رئيس المشترين"
    },
    "management": {
      "name": "الإدارة",
      "role": "مدير المشتريات / المدير العام"
    }
  },
  "raciHead": {
    "eyebrow": "المساءلة",
    "title": "RACI — من يفعل ماذا",
    "legendR": "R ينفّذ العمل",
    "legendA": "A مسؤول عن النتيجة",
    "legendC": "C يُستشار",
    "legendI": "I يُبقى على اطلاع",
    "colStage": "المرحلة"
  },
  "rolesHead": {
    "eyebrow": "الفريق",
    "title": "الأدوار والمسؤوليات",
    "ownsStages": "مسؤول عن المراحل",
    "caseOwner": "مشتري المشتريات هو مالك الحالة من البداية إلى النهاية — فهو يبقي السجل في حركة، ويتابع الفرق الأخرى، ويكون مسؤولًا عن اكتماله. أما الأقسام الأخرى فلا تملك سوى قسمها الخاص."
  },
  "questionsHead": {
    "eyebrow": "أدوات المرحلة 5",
    "title": "بنك أسئلة زيارة المصنع والاجتماع",
    "intro": "اطرح هذه الأسئلة أثناء الاجتماع/الزيارة لجمع البيانات التي تملأ أقسام المصنع والجودة واللوجستيات والمخاطر والتفاوض."
  },
  "questions": [
    {
      "group": "الشركة والطاقة الإنتاجية",
      "qs": [
        "منذ متى وأنتم في هذا المجال ومن هم عملاؤكم الرئيسيون؟",
        "ما طاقتكم الإنتاجية الشهرية/السنوية، وما نسبة الاستغلال الحالية؟",
        "هل تملكون هذا المصنع أم تتعاقدون من الباطن على أي جزء من الإنتاج؟",
        "ما المهلة الزمنية المعتادة ومهلة موسم الذروة لديكم؟"
      ]
    },
    {
      "group": "الجودة والعمليات",
      "qs": [
        "ما الشهادات التي تحملونها (ISO، CE…)، وهل يمكننا الاطلاع عليها؟",
        "ما عملية الفحص أثناء الإنتاج والفحص النهائي لديكم؟ وما معدل العيوب المعتاد؟",
        "كيف تتعاملون مع مطالبة جودة أو إعادة عمل؟",
        "هل يمكنكم تقديم عينات وتقارير اختبار حديثة؟"
      ]
    },
    {
      "group": "المواد والتوريد",
      "qs": [
        "ما المواد/المكونات التي يمكنكم التعامل معها، ومن أين تورّدونها؟",
        "هل يمكنكم تخصيص المواصفات، وما الحد الأدنى لكمية الطلب؟",
        "كيف تديرون تغيرات أسعار المواد الخام؟"
      ]
    },
    {
      "group": "التجاري والشروط",
      "qs": [
        "ما شروط الدفع والعملة التي تقدمونها لمشترٍ جديد؟",
        "ما الخصومات المطبّقة عند الكميات الكبيرة؟ وهل هناك خيارات حصرية؟",
        "من صانع القرار في التسعير والنزاعات؟"
      ]
    },
    {
      "group": "اللوجستيات والالتزام",
      "qs": [
        "أي Incoterms تدعمونها ومن أي ميناء؟",
        "هل تحملون رخصة استيراد/تصدير وتتولّون مستندات التصدير؟",
        "هل هناك أي قضايا قانونية أو بيئية أو عمالية قائمة ينبغي أن نعلم بها؟"
      ]
    }
  ],
  "slaHead": {
    "eyebrow": "الإيقاع",
    "title": "التوقيت واتفاقيات مستوى الخدمة"
  },
  "sla": [
    {
      "k": "الدورة القياسية",
      "v": "~30 يوم",
      "n": "من عميل محتمل ← فعّال لمورّد نموذجي."
    },
    {
      "k": "المسار السريع",
      "v": "~10–14 يوم",
      "n": "استراتيجي / عاجل — تُنفَّذ المراحل بالتوازي."
    },
    {
      "k": "دورة المراجعة",
      "v": "سنوية",
      "n": "إعادة تقييم المورّدين الفعّالين، أو عند أي حدث مخاطرة."
    }
  ],
  "slaNote": "لكل مرحلة بوابة خروج — لا يتقدم السجل إلا عند استيفاء البوابة. وإذا تعطّلت مرحلة (مثل عدم استلام المستندات)، يصعّد مالك الحالة الأمر إلى مدير المشتريات. ولا يمكن لمورّد بلوغ حالة فعّال إلى أن يُظهر اكتمال الملف التعريفي شارة «جاهز» الخضراء وتمنح الإدارة موافقتها.",
  "ctaStart": "ابدأ مورّدًا جديدًا",
  "ctaGuide": "دليل البيانات حقلًا بحقل →"
};

const CONTENT: Record<Lang, Content> = { en: EN, zh: ZH, ar: AR };

/* ── helpers ── */
function DeptDot({ d }: { d: DeptKey }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${DEPT_STYLE[d].dot}`} aria-hidden />;
}

export default function SupplierOnboardingWorkflowPage() {
  const { lang } = useTranslation({});
  const c = CONTENT[lang] ?? EN;
  const dir = lang === "ar" ? "rtl" : "ltr";

  const DeptChip = ({ d }: { d: DeptKey }) => (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${DEPT_STYLE[d].soft} ${DEPT_STYLE[d].text}`}>
      <DeptDot d={d} /> {c.depts[d].name}
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
            <WorkflowIcon size={14} /> {c.hero.eyebrow}
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight max-w-3xl">{c.hero.title}</h1>
          <p className="mt-3 text-[14px] md:text-[15px] leading-relaxed text-[var(--text-faint)] max-w-3xl">
            {c.hero.bodyA} <strong className="text-[var(--text-secondary)]">{c.hero.cycle}</strong>{c.hero.bodyB}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="#stages" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent,#0066FF)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity">
              <WorkflowIcon size={14} /> {c.hero.ctaStages}
            </a>
            <Link href="/knowledge/supplier-data-guide" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              {c.hero.ctaGuide}
            </Link>
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

          <main className="min-w-0 space-y-12">

            {/* LIFECYCLE */}
            <section id="lifecycle" className="scroll-mt-6">
              <SectionHeading icon={GaugeIcon} eyebrow={c.lifecycleHead.eyebrow} title={c.lifecycleHead.title} />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-4">{c.lifecycleHead.intro}</p>
              <div className="flex flex-wrap items-stretch gap-2">
                {c.lifecycle.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-2.5 min-w-[120px]">
                      <div className="text-[10px] tabular-nums text-[var(--text-dim)] mb-0.5">{c.lifecycleHead.stepLabel} {i + 1}</div>
                      <div className="text-[13px] font-semibold">{s.label}</div>
                      <div className="text-[11px] text-[var(--text-faint)] mt-0.5">{s.note}</div>
                    </div>
                    {i < c.lifecycle.length - 1 && <ArrowRightIcon className="h-4 w-4 shrink-0 text-[var(--text-ghost)] rtl:rotate-180" />}
                  </div>
                ))}
              </div>
            </section>

            {/* FLOW */}
            <section id="flow" className="scroll-mt-6">
              <SectionHeading icon={WorkflowIcon} eyebrow={c.flowHead.eyebrow} title={c.flowHead.title} />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-4">{c.flowHead.intro}</p>
              <div className="flex flex-wrap gap-2">
                {STAGE_META.map((m) => {
                  const s = c.stages.find((x) => x.n === m.n);
                  return (
                    <a key={m.n} href={`#stage-${m.n}`} className={`group flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2 transition-colors hover:border-[var(--border-focus)] ${DEPT_STYLE[m.dept].soft}`}>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[11px] font-bold">{m.n}</span>
                      <span className="text-[12px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">{s?.short}</span>
                      <DeptDot d={m.dept} />
                    </a>
                  );
                })}
              </div>
            </section>

            {/* STAGES */}
            <section id="stages" className="scroll-mt-6">
              <SectionHeading icon={CalendarCheckIcon} eyebrow={c.stagesHead.eyebrow} title={c.stagesHead.title} />
              <div className="relative space-y-4 before:absolute before:start-[18px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--border-subtle)] md:before:start-[19px]">
                {STAGE_META.map((m) => {
                  const st = DEPT_STYLE[m.dept];
                  const Icon = m.icon;
                  const s = c.stages.find((x) => x.n === m.n);
                  if (!s) return null;
                  return (
                    <div key={m.n} id={`stage-${m.n}`} className="scroll-mt-6 relative ps-12 md:ps-14">
                      <div className={`absolute start-0 top-1 flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full border-2 border-[var(--bg-primary)] ${st.soft} ring-1 ring-inset ${st.ring}`}>
                        <Icon size={16} className={st.text} />
                      </div>
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 border-b border-[var(--border-subtle)]">
                          <span className="text-[11px] tabular-nums text-[var(--text-dim)]">{c.stageLabels.stage} {m.n}</span>
                          <span className="text-[14.5px] font-semibold flex-1 min-w-[180px]">{s.title}</span>
                          <DeptChip d={m.dept} />
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-subtle)]">
                            <CalendarCheckIcon size={11} /> {s.days} · {s.duration}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-[var(--accent,#0066FF)]/12 px-2 py-0.5 text-[10.5px] font-semibold text-[var(--accent,#0066FF)]">→ {s.status}</span>
                        </div>
                        <div className="px-5 py-4">
                          <p className="text-[13px] leading-relaxed text-[var(--text-faint)] mb-3">{s.what}</p>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-1.5">{c.stageLabels.whatHappens}</div>
                          <ul className="space-y-1.5 mb-3">
                            {s.does.map((a, i) => (
                              <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />{a}
                              </li>
                            ))}
                          </ul>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg bg-[var(--bg-surface)] px-3 py-2">
                              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-0.5">{c.stageLabels.dataEntered}</div>
                              <div className="text-[12px] text-[var(--text-secondary)]">{s.data}</div>
                            </div>
                            <div className="rounded-lg bg-[var(--bg-surface)] px-3 py-2">
                              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-0.5">{c.stageLabels.exitGate}</div>
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
              <SectionHeading icon={ClipboardCheckIcon} eyebrow={c.raciHead.eyebrow} title={c.raciHead.title} />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-3">
                <strong className="text-[var(--text-secondary)]">{c.raciHead.legendR}</strong>, <strong className="text-[var(--text-secondary)]">{c.raciHead.legendA}</strong>, <strong className="text-[var(--text-secondary)]">{c.raciHead.legendC}</strong>, <strong className="text-[var(--text-secondary)]">{c.raciHead.legendI}</strong>.
              </p>
              <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <table className="w-full min-w-[640px] text-[12px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <th className="text-start font-semibold px-4 py-2.5 text-[var(--text-secondary)] sticky start-0 bg-[var(--bg-secondary)]">{c.raciHead.colStage}</th>
                      {RACI_COLS.map((col) => (
                        <th key={col.key} className="px-2 py-2.5 text-center">
                          <span className="inline-flex flex-col items-center gap-1">
                            <DeptDot d={col.key} />
                            <span className={`text-[11px] font-semibold ${DEPT_STYLE[col.key].text}`}>{col.short}</span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {STAGE_META.map((m) => {
                      const s = c.stages.find((x) => x.n === m.n);
                      return (
                        <tr key={m.n} className="border-b border-[var(--border-faint)] last:border-0">
                          <td className="px-4 py-2.5 sticky start-0 bg-[var(--bg-secondary)]">
                            <span className="text-[var(--text-dim)] tabular-nums me-1.5">{m.n}</span>
                            <span className="text-[var(--text-secondary)]">{s?.short}</span>
                          </td>
                          {RACI_COLS.map((col) => {
                            const v = RACI[m.n][col.key];
                            return (
                              <td key={col.key} className="px-2 py-2 text-center">
                                <span className={`inline-flex min-w-[26px] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] ${RACI_STYLE[v]}`}>{v || "·"}</span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ROLES */}
            <section id="roles" className="scroll-mt-6">
              <SectionHeading icon={UsersIcon} eyebrow={c.rolesHead.eyebrow} title={c.rolesHead.title} />
              <div className="grid gap-3 sm:grid-cols-2">
                {DEPT_ORDER.map((k) => {
                  const st = DEPT_STYLE[k];
                  const stages = STAGE_META.filter((s) => s.dept === k).map((s) => s.n).join(", ") || "—";
                  return (
                    <div key={k} className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 ring-1 ring-inset ${st.ring}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <DeptDot d={k} />
                        <span className={`text-[13px] font-semibold ${st.text}`}>{c.depts[k].name}</span>
                      </div>
                      <div className="text-[12px] text-[var(--text-secondary)] mb-1">{c.depts[k].role}</div>
                      <div className="text-[12px] leading-relaxed text-[var(--text-faint)]">{c.rolesHead.ownsStages} {stages}.</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2 rounded-xl border border-[var(--accent,#0066FF)]/25 bg-[var(--accent,#0066FF)]/[0.06] px-4 py-3">
                <LightbulbIcon size={15} className="mt-0.5 shrink-0 text-[var(--accent,#0066FF)]" />
                <span className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{c.rolesHead.caseOwner}</span>
              </div>
            </section>

            {/* QUESTIONS */}
            <section id="questions" className="scroll-mt-6">
              <SectionHeading icon={HelpCircleIcon} eyebrow={c.questionsHead.eyebrow} title={c.questionsHead.title} />
              <p className="text-[14px] leading-relaxed text-[var(--text-faint)] max-w-3xl mb-4">{c.questionsHead.intro}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {c.questions.map((g) => (
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
              <SectionHeading icon={CalendarCheckIcon} eyebrow={c.slaHead.eyebrow} title={c.slaHead.title} />
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  {c.sla.map((x) => (
                    <div key={x.k}>
                      <div className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">{x.k}</div>
                      <div className="text-2xl font-bold mt-0.5">{x.v}</div>
                      <div className="text-[12px] text-[var(--text-faint)] mt-0.5">{x.n}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-[12.5px] leading-relaxed text-[var(--text-faint)]">{c.slaNote}</div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/suppliers/new" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent,#0066FF)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity">
                  <HandshakeIcon size={14} /> {c.ctaStart}
                </Link>
                <Link href="/knowledge/supplier-data-guide" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  {c.ctaGuide}
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
