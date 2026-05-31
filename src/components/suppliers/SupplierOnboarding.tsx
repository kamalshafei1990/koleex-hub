"use client";

/* ---------------------------------------------------------------------------
   SupplierOnboarding — ALL-IN-ONE "New Supplier" data entry.

   One long scrolling form (collapsible sections). You fill everything here —
   identity, commercial, legal, logistics, messaging, strategic, classifications,
   contact people, factory, certifications/documents (with file upload), risk and
   negotiation — and one Save writes it all.

   No new tables, no duplication: it creates the base contacts row, then enriches
   the EXISTING canonical intelligence tables through the EXISTING APIs:
     · base scalars        → POST /api/contacts
     · strategic status    → PATCH /api/suppliers/[id]         (timeline + history)
     · classifications     → POST .../classifications          (timeline, primary)
     · contact people      → POST .../contacts                 (supplier_contact_persons)
     · factory profile     → PUT  .../factory
     · documents/certs     → POST /api/storage/upload → POST .../media (governed)
     · risk scorecard      → PUT  .../risk
     · negotiation intel   → PUT  .../negotiations/intel
   Tenant scoping, RLS, visibility tiers, timeline emission and readiness scoring
   are all preserved. Monochrome, keyboard-friendly, mobile responsive.
   --------------------------------------------------------------------------- */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STRATEGIC_STATUS_LABELS, CLASSIFICATION_LABELS, FACTORY_TYPE_LABELS } from "@/lib/suppliers/intelligence";
import SuppliersNav from "./SuppliersNav";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";

/* ── vocab ── */
const SUPPLIER_TYPES = ["Manufacturer", "Trading Company", "OEM", "ODM", "Distributor", "Service Provider", "Spare Parts", "Machinery", "Electronics", "Packaging", "Textile", "Chemical", "Logistics", "Other"];
const PAYMENT_TERMS = ["T/T", "L/C", "D/P", "D/A", "COD", "Net 30", "Net 60", "Net 90"];
const CURRENCIES = ["USD", "CNY", "EUR", "AED", "GBP", "JPY", "HKD"];
const REVENUE_RANGES = ["< $1M", "$1M–$5M", "$5M–$20M", "$20M–$50M", "$50M–$100M", "$100M+"];
const EMPLOYEE_RANGES = ["1–10", "11–50", "51–200", "201–500", "501–1000", "1000+"];
const LEVEL3 = ["", "low", "medium", "high"];
const LEVEL4 = ["", "low", "medium", "high", "critical"];
const DOC_CATEGORIES = [
  { v: "certification", label: "Certification (ISO/CE/RoHS…)" },
  { v: "business_license", label: "Business License" },
  { v: "audit_report", label: "Audit Report" },
  { v: "inspection_report", label: "Inspection Report" },
  { v: "sample_report", label: "Sample Report" },
  { v: "catalog", label: "Catalog / Brochure" },
  { v: "factory_photo", label: "Factory Photo" },
];
const ROLE_CATEGORIES = ["sales", "boss", "owner", "support", "finance", "logistics", "qc", "engineering", "management", "other"];
const RELIABILITY = ["", "high", "medium", "low", "unknown"];

const inputCls = "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none";
const labelCls = "mb-1 block text-[11px] font-medium text-[var(--text-secondary)]";

function Section({ title, sub, defaultOpen, children }: { title: string; sub?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
        <span>
          <span className="block text-[14px] font-semibold text-[var(--text-primary)]">{title}</span>
          {sub ? <span className="block text-[11px] text-[var(--text-faint)]">{sub}</span> : null}
        </span>
        <AngleDownIcon className={`h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="border-t border-[var(--border-subtle)] px-5 py-4">{children}</div> : null}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>; }
function F({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className={labelCls}>{label}</span>{children}</label>; }
function LevelSelect({ value, onChange, levels }: { value: string; onChange: (v: string) => void; levels: string[] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>{levels.map((l) => <option key={l} value={l}>{l ? l[0].toUpperCase() + l.slice(1) : "—"}</option>)}</select>;
}

interface Person { full_name: string; position: string; role_category: string; email: string; mobile: string; whatsapp: string; wechat_id: string; is_primary: boolean; is_decision_maker: boolean; reliability: string; notes: string; }
const emptyPerson = (): Person => ({ full_name: "", position: "", role_category: "", email: "", mobile: "", whatsapp: "", wechat_id: "", is_primary: false, is_decision_maker: false, reliability: "", notes: "" });
interface Doc { file: File | null; category: string; cert_type: string; issuer: string; issued_date: string; expiry_date: string; visibility: string; }
const emptyDoc = (): Doc => ({ file: null, category: "certification", cert_type: "", issuer: "", issued_date: "", expiry_date: "", visibility: "internal" });

export default function SupplierOnboarding() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // base
  const [b, setB] = useState({
    company_name_en: "", company_name_cn: "", supplier_type: "", industry: "", website: "", year_established: "",
    country: "", province: "", city: "", supplier_address: "",
    currency: "", payment_terms: "", moq: "", lead_time: "", incoterms: "", annual_revenue_range: "", employee_count_range: "",
    trading_name: "", business_registration_number: "", registration_country: "", gst_number: "", cr_number: "", duns_number: "", importer_exporter_code: "", customs_code: "",
    port_of_entry: "", container_preference: "", customs_broker: "", freight_forwarder: "",
    whatsapp_business: "", wechat_id: "", telegram_id: "", line_id: "", skype_id: "",
    strategic_status: "", strategic_status_reason: "", notes: "",
  });
  const setb = (k: keyof typeof b, v: string) => setB((p) => ({ ...p, [k]: v }));

  const [classifications, setClassifications] = useState<string[]>([]);
  const [primaryClass, setPrimaryClass] = useState("");
  const [persons, setPersons] = useState<Person[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);

  // factory
  const [fac, setFac] = useState({ factory_name: "", factory_type: "", production_lines: "", monthly_capacity: "", annual_output: "", factory_size_sqm: "", employee_count: "", qc_staff_count: "", rd_staff_count: "", export_percentage: "", odm_supported: false, private_label_supported: false, low_moq_supported: false, main_export_markets: "", production_categories: "", notes: "" });
  const setf = (k: keyof typeof fac, v: string | boolean) => setFac((p) => ({ ...p, [k]: v }));
  // risk
  const [risk, setRisk] = useState({ risk_level: "", dependency_level: "", financial_stability: "", delivery_stability: "", quality_stability: "", communication_quality: "", trust_level: "", internal_evaluation_score: "", backup_supplier_exists: false, assessment_notes: "" });
  const setr = (k: keyof typeof risk, v: string | boolean) => setRisk((p) => ({ ...p, [k]: v }));
  // negotiation
  const [neg, setNeg] = useState({ negotiation_score: "", price_flexibility: "", moq_flexibility: "", payment_flexibility: "", negotiation_difficulty: "", sample_turnaround_speed: "", internal_notes: "" });
  const setn = (k: keyof typeof neg, v: string) => setNeg((p) => ({ ...p, [k]: v }));

  const toggleClass = (key: string) => setClassifications((prev) => {
    const has = prev.includes(key);
    const next = has ? prev.filter((c) => c !== key) : [...prev, key];
    setPrimaryClass((pc) => (has && pc === key ? next[0] ?? "" : (!has && !pc ? key : pc)));
    return next;
  });

  const nonEmpty = (o: Record<string, unknown>) => { const r: Record<string, unknown> = {}; for (const [k, v] of Object.entries(o)) { if (typeof v === "string") { if (v.trim()) r[k] = v.trim(); } else if (typeof v === "boolean") { if (v) r[k] = true; } else if (v != null) r[k] = v; } return r; };
  const numify = (o: Record<string, unknown>, keys: string[]) => { for (const k of keys) if (typeof o[k] === "string") o[k] = Number(o[k]); return o; };

  const submit = useCallback(async () => {
    if (!b.company_name_en.trim()) { setErr("Company name (English) is required."); window.scrollTo({ top: 0 }); return; }
    setBusy(true); setErr(null);
    const j = async (url: string, method: string, body: unknown) => fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    try {
      // 1) base record
      setProgress("Creating supplier…");
      const insert: Record<string, unknown> = { contact_type: "supplier", entity_type: "company", ...nonEmpty({
        company_name_en: b.company_name_en, company_name_cn: b.company_name_cn, supplier_type: b.supplier_type, industry: b.industry,
        website: b.website, year_established: b.year_established, country: b.country, province: b.province, city: b.city, supplier_address: b.supplier_address,
        currency: b.currency, payment_terms: b.payment_terms, moq: b.moq, lead_time: b.lead_time, incoterms: b.incoterms,
        annual_revenue_range: b.annual_revenue_range, employee_count_range: b.employee_count_range,
        trading_name: b.trading_name, business_registration_number: b.business_registration_number, registration_country: b.registration_country,
        gst_number: b.gst_number, cr_number: b.cr_number, duns_number: b.duns_number, importer_exporter_code: b.importer_exporter_code, customs_code: b.customs_code,
        port_of_entry: b.port_of_entry, container_preference: b.container_preference, customs_broker: b.customs_broker, freight_forwarder: b.freight_forwarder,
        whatsapp_business: b.whatsapp_business, wechat_id: b.wechat_id, telegram_id: b.telegram_id, line_id: b.line_id, skype_id: b.skype_id,
        notes: b.notes,
      }) };
      const cr = await j("/api/contacts", "POST", insert);
      if (!cr.ok) throw new Error((await cr.json().catch(() => ({}))).error || "Failed to create supplier");
      const id = ((await cr.json()).contact as { id?: string } | null)?.id;
      if (!id) throw new Error("Created but no id returned");

      // 2) strategic status (timeline + history)
      if (b.strategic_status) { setProgress("Strategic status…"); await j(`/api/suppliers/${id}`, "PATCH", { strategic_status: b.strategic_status, strategic_status_reason: b.strategic_status_reason || null }); }
      // 3) classifications
      if (classifications.length) { setProgress("Classifications…"); for (const c of classifications) await j(`/api/suppliers/${id}/classifications`, "POST", { classification: c, is_primary: c === primaryClass }); }
      // 4) contact people
      const validPersons = persons.filter((p) => p.full_name.trim());
      if (validPersons.length) { setProgress("Contacts…"); for (const p of validPersons) await j(`/api/suppliers/${id}/contacts`, "POST", nonEmpty({ ...p })); }
      // 5) factory
      const facBody = numify(nonEmpty(fac), ["production_lines", "monthly_capacity", "annual_output", "factory_size_sqm", "employee_count", "qc_staff_count", "rd_staff_count", "export_percentage"]);
      if (fac.main_export_markets.trim()) facBody.main_export_markets = fac.main_export_markets.split(",").map((s) => s.trim()).filter(Boolean);
      if (fac.production_categories.trim()) facBody.production_categories = fac.production_categories.split(",").map((s) => s.trim()).filter(Boolean);
      if (Object.keys(facBody).length) { setProgress("Factory…"); await j(`/api/suppliers/${id}/factory`, "PUT", facBody); }
      // 6) risk
      const riskBody = numify(nonEmpty(risk), ["internal_evaluation_score"]);
      if (Object.keys(riskBody).length) { setProgress("Risk…"); await j(`/api/suppliers/${id}/risk`, "PUT", riskBody); }
      // 7) negotiation
      const negBody = numify(nonEmpty(neg), ["negotiation_score"]);
      if (Object.keys(negBody).length) { setProgress("Negotiation…"); await j(`/api/suppliers/${id}/negotiations/intel`, "PUT", negBody); }
      // 8) documents / certifications (upload → media)
      const validDocs = docs.filter((d) => d.file);
      for (let i = 0; i < validDocs.length; i++) {
        const d = validDocs[i]; if (!d.file) continue;
        setProgress(`Uploading document ${i + 1}/${validDocs.length}…`);
        const fd = new FormData();
        fd.append("file", d.file);
        fd.append("bucket", "media");
        fd.append("path", `${id}/${Date.now()}-${d.file.name}`);
        const up = await fetch("/api/storage/upload", { method: "POST", credentials: "include", body: fd });
        if (!up.ok) continue;
        const uj = await up.json();
        const fileUrl = uj.url || uj.publicUrl || uj.signedUrl;
        if (!fileUrl) continue;
        await j(`/api/suppliers/${id}/media`, "POST", nonEmpty({
          file_url: fileUrl, category: d.category, media_class: "document",
          cert_type: d.cert_type, issuer: d.issuer, issued_date: d.issued_date, expiry_date: d.expiry_date,
          visibility: d.visibility, file_name: d.file.name, mime_type: d.file.type, file_size: d.file.size,
          storage_bucket: "media", storage_path: uj.path,
        }));
      }

      setProgress("Opening supplier…");
      router.push(`/suppliers/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create supplier");
      setBusy(false); setProgress(null);
    }
  }, [b, classifications, primaryClass, persons, fac, risk, neg, docs, router]);

  const filledCount = useMemo(() => Object.values(b).filter((v) => v.trim()).length + classifications.length + persons.filter((p) => p.full_name.trim()).length + docs.filter((d) => d.file).length, [b, classifications, persons, docs]);

  return (
    <>
      <SuppliersNav active="directory" />
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">New Supplier</h1>
            <p className="text-[12px] text-[var(--text-secondary)]">Fill everything in one place. Only the company name is required — the rest builds the supplier&rsquo;s intelligence.</p>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">{filledCount} fields</span>
        </div>

        <div className="space-y-3 pb-28">
          <Section title="Identity" sub="Who the supplier is" defaultOpen>
            <div className="space-y-3">
              <F label="Company name (English) — required"><input autoFocus value={b.company_name_en} onChange={(e) => setb("company_name_en", e.target.value)} placeholder="Shenzhen ABC Trading Co., Ltd." className={inputCls} /></F>
              <Grid>
                <F label="Company name (Chinese)"><input value={b.company_name_cn} onChange={(e) => setb("company_name_cn", e.target.value)} className={inputCls} /></F>
                <F label="Supplier type"><select value={b.supplier_type} onChange={(e) => setb("supplier_type", e.target.value)} className={inputCls}><option value="">Select…</option>{SUPPLIER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></F>
                <F label="Industry"><input value={b.industry} onChange={(e) => setb("industry", e.target.value)} className={inputCls} /></F>
                <F label="Website"><input value={b.website} onChange={(e) => setb("website", e.target.value)} placeholder="https://…" className={inputCls} /></F>
                <F label="Country"><input value={b.country} onChange={(e) => setb("country", e.target.value)} className={inputCls} /></F>
                <F label="Year established"><input value={b.year_established} onChange={(e) => setb("year_established", e.target.value)} placeholder="2008" className={inputCls} /></F>
                <F label="Province / State"><input value={b.province} onChange={(e) => setb("province", e.target.value)} className={inputCls} /></F>
                <F label="City"><input value={b.city} onChange={(e) => setb("city", e.target.value)} className={inputCls} /></F>
              </Grid>
              <F label="Address"><input value={b.supplier_address} onChange={(e) => setb("supplier_address", e.target.value)} className={inputCls} /></F>
            </div>
          </Section>

          <Section title="Commercial" sub="How you trade with them">
            <Grid>
              <F label="Currency"><select value={b.currency} onChange={(e) => setb("currency", e.target.value)} className={inputCls}><option value="">Select…</option>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></F>
              <F label="Payment terms"><input list="pt" value={b.payment_terms} onChange={(e) => setb("payment_terms", e.target.value)} className={inputCls} /><datalist id="pt">{PAYMENT_TERMS.map((p) => <option key={p} value={p} />)}</datalist></F>
              <F label="MOQ"><input value={b.moq} onChange={(e) => setb("moq", e.target.value)} className={inputCls} /></F>
              <F label="Lead time"><input value={b.lead_time} onChange={(e) => setb("lead_time", e.target.value)} placeholder="30 days" className={inputCls} /></F>
              <F label="Incoterms"><input value={b.incoterms} onChange={(e) => setb("incoterms", e.target.value)} placeholder="FOB / CIF / EXW" className={inputCls} /></F>
              <F label="Annual revenue"><select value={b.annual_revenue_range} onChange={(e) => setb("annual_revenue_range", e.target.value)} className={inputCls}><option value="">Select…</option>{REVENUE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}</select></F>
              <F label="Employee count"><select value={b.employee_count_range} onChange={(e) => setb("employee_count_range", e.target.value)} className={inputCls}><option value="">Select…</option>{EMPLOYEE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}</select></F>
            </Grid>
          </Section>

          <Section title="Legal & Trade IDs" sub="Registration & customs identifiers">
            <Grid>
              <F label="Trading / DBA name"><input value={b.trading_name} onChange={(e) => setb("trading_name", e.target.value)} className={inputCls} /></F>
              <F label="Business registration #"><input value={b.business_registration_number} onChange={(e) => setb("business_registration_number", e.target.value)} className={inputCls} /></F>
              <F label="Registration country"><input value={b.registration_country} onChange={(e) => setb("registration_country", e.target.value)} className={inputCls} /></F>
              <F label="VAT / GST"><input value={b.gst_number} onChange={(e) => setb("gst_number", e.target.value)} className={inputCls} /></F>
              <F label="CR number"><input value={b.cr_number} onChange={(e) => setb("cr_number", e.target.value)} className={inputCls} /></F>
              <F label="D-U-N-S"><input value={b.duns_number} onChange={(e) => setb("duns_number", e.target.value)} className={inputCls} /></F>
              <F label="Importer/Exporter code"><input value={b.importer_exporter_code} onChange={(e) => setb("importer_exporter_code", e.target.value)} className={inputCls} /></F>
              <F label="Customs code"><input value={b.customs_code} onChange={(e) => setb("customs_code", e.target.value)} className={inputCls} /></F>
            </Grid>
          </Section>

          <Section title="Logistics" sub="Shipping & freight">
            <Grid>
              <F label="Port of loading / entry"><input value={b.port_of_entry} onChange={(e) => setb("port_of_entry", e.target.value)} className={inputCls} /></F>
              <F label="Container preference"><input value={b.container_preference} onChange={(e) => setb("container_preference", e.target.value)} className={inputCls} /></F>
              <F label="Customs broker"><input value={b.customs_broker} onChange={(e) => setb("customs_broker", e.target.value)} className={inputCls} /></F>
              <F label="Freight forwarder"><input value={b.freight_forwarder} onChange={(e) => setb("freight_forwarder", e.target.value)} className={inputCls} /></F>
            </Grid>
          </Section>

          <Section title="Messaging IDs" sub="How to reach an overseas factory">
            <Grid>
              <F label="WhatsApp Business"><input value={b.whatsapp_business} onChange={(e) => setb("whatsapp_business", e.target.value)} className={inputCls} /></F>
              <F label="WeChat ID"><input value={b.wechat_id} onChange={(e) => setb("wechat_id", e.target.value)} className={inputCls} /></F>
              <F label="Telegram"><input value={b.telegram_id} onChange={(e) => setb("telegram_id", e.target.value)} className={inputCls} /></F>
              <F label="Line"><input value={b.line_id} onChange={(e) => setb("line_id", e.target.value)} className={inputCls} /></F>
              <F label="Skype"><input value={b.skype_id} onChange={(e) => setb("skype_id", e.target.value)} className={inputCls} /></F>
            </Grid>
          </Section>

          <Section title="Strategic & Classifications" sub="Status and what they are">
            <div className="space-y-3">
              <Grid>
                <F label="Strategic status"><select value={b.strategic_status} onChange={(e) => setb("strategic_status", e.target.value)} className={inputCls}><option value="">Not set</option>{Object.entries(STRATEGIC_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
                <F label="Status reason"><input value={b.strategic_status_reason} onChange={(e) => setb("strategic_status_reason", e.target.value)} className={inputCls} /></F>
              </Grid>
              <div>
                <span className={labelCls}>Classifications</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => {
                    const on = classifications.includes(k);
                    return <button key={k} type="button" onClick={() => toggleClass(k)} className={`rounded-full border px-3 py-1 text-[12px] font-medium ${on ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"}`}>{v}</button>;
                  })}
                </div>
                {classifications.length > 1 ? (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]"><span>Primary:</span>
                    <select value={primaryClass} onChange={(e) => setPrimaryClass(e.target.value)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 text-[12px] text-[var(--text-primary)]">{classifications.map((c) => <option key={c} value={c}>{CLASSIFICATION_LABELS[c as keyof typeof CLASSIFICATION_LABELS] ?? c}</option>)}</select>
                  </div>
                ) : null}
              </div>
            </div>
          </Section>

          <Section title="Contact people" sub="Key people at the supplier">
            <div className="space-y-3">
              {persons.map((p, i) => (
                <div key={i} className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-semibold text-[var(--text-secondary)]">Person {i + 1}</span><button type="button" onClick={() => setPersons((a) => a.filter((_, x) => x !== i))} className="text-[var(--text-faint)] hover:text-[var(--text-primary)]"><TrashIcon className="h-3.5 w-3.5" /></button></div>
                  <Grid>
                    <F label="Full name"><input value={p.full_name} onChange={(e) => setPersons((a) => a.map((x, j) => j === i ? { ...x, full_name: e.target.value } : x))} className={inputCls} /></F>
                    <F label="Position"><input value={p.position} onChange={(e) => setPersons((a) => a.map((x, j) => j === i ? { ...x, position: e.target.value } : x))} className={inputCls} /></F>
                    <F label="Role"><select value={p.role_category} onChange={(e) => setPersons((a) => a.map((x, j) => j === i ? { ...x, role_category: e.target.value } : x))} className={inputCls}><option value="">Select…</option>{ROLE_CATEGORIES.map((r) => <option key={r} value={r}>{r}</option>)}</select></F>
                    <F label="Reliability"><select value={p.reliability} onChange={(e) => setPersons((a) => a.map((x, j) => j === i ? { ...x, reliability: e.target.value } : x))} className={inputCls}>{RELIABILITY.map((r) => <option key={r} value={r}>{r || "—"}</option>)}</select></F>
                    <F label="Email"><input value={p.email} onChange={(e) => setPersons((a) => a.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} className={inputCls} /></F>
                    <F label="Mobile"><input value={p.mobile} onChange={(e) => setPersons((a) => a.map((x, j) => j === i ? { ...x, mobile: e.target.value } : x))} className={inputCls} /></F>
                    <F label="WhatsApp"><input value={p.whatsapp} onChange={(e) => setPersons((a) => a.map((x, j) => j === i ? { ...x, whatsapp: e.target.value } : x))} className={inputCls} /></F>
                    <F label="WeChat"><input value={p.wechat_id} onChange={(e) => setPersons((a) => a.map((x, j) => j === i ? { ...x, wechat_id: e.target.value } : x))} className={inputCls} /></F>
                  </Grid>
                  <div className="mt-2 flex gap-4 text-[12px] text-[var(--text-secondary)]">
                    <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={p.is_primary} onChange={(e) => setPersons((a) => a.map((x, j) => j === i ? { ...x, is_primary: e.target.checked } : x))} className="accent-[var(--text-primary)]" />Primary</label>
                    <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={p.is_decision_maker} onChange={(e) => setPersons((a) => a.map((x, j) => j === i ? { ...x, is_decision_maker: e.target.checked } : x))} className="accent-[var(--text-primary)]" />Decision maker</label>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setPersons((a) => [...a, emptyPerson()])} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]"><PlusIcon className="h-3.5 w-3.5" />Add person</button>
            </div>
          </Section>

          <Section title="Factory" sub="Production capability">
            <Grid>
              <F label="Factory name"><input value={fac.factory_name} onChange={(e) => setf("factory_name", e.target.value)} className={inputCls} /></F>
              <F label="Factory type"><select value={fac.factory_type} onChange={(e) => setf("factory_type", e.target.value)} className={inputCls}><option value="">Select…</option>{Object.entries(FACTORY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
              <F label="Production lines"><input value={fac.production_lines} onChange={(e) => setf("production_lines", e.target.value)} className={inputCls} /></F>
              <F label="Monthly capacity"><input value={fac.monthly_capacity} onChange={(e) => setf("monthly_capacity", e.target.value)} className={inputCls} /></F>
              <F label="Annual output"><input value={fac.annual_output} onChange={(e) => setf("annual_output", e.target.value)} className={inputCls} /></F>
              <F label="Factory size (sqm)"><input value={fac.factory_size_sqm} onChange={(e) => setf("factory_size_sqm", e.target.value)} className={inputCls} /></F>
              <F label="Employees"><input value={fac.employee_count} onChange={(e) => setf("employee_count", e.target.value)} className={inputCls} /></F>
              <F label="QC staff"><input value={fac.qc_staff_count} onChange={(e) => setf("qc_staff_count", e.target.value)} className={inputCls} /></F>
              <F label="R&D staff"><input value={fac.rd_staff_count} onChange={(e) => setf("rd_staff_count", e.target.value)} className={inputCls} /></F>
              <F label="Export %"><input value={fac.export_percentage} onChange={(e) => setf("export_percentage", e.target.value)} placeholder="0–100" className={inputCls} /></F>
              <F label="Export markets (comma-sep)"><input value={fac.main_export_markets} onChange={(e) => setf("main_export_markets", e.target.value)} placeholder="US, EU, UAE" className={inputCls} /></F>
              <F label="Production categories (comma-sep)"><input value={fac.production_categories} onChange={(e) => setf("production_categories", e.target.value)} className={inputCls} /></F>
            </Grid>
            <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-[var(--text-secondary)]">
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={fac.odm_supported} onChange={(e) => setf("odm_supported", e.target.checked)} className="accent-[var(--text-primary)]" />ODM support</label>
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={fac.private_label_supported} onChange={(e) => setf("private_label_supported", e.target.checked)} className="accent-[var(--text-primary)]" />Private label</label>
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={fac.low_moq_supported} onChange={(e) => setf("low_moq_supported", e.target.checked)} className="accent-[var(--text-primary)]" />Low MOQ</label>
            </div>
          </Section>

          <Section title="Certifications & Documents" sub="Upload certs, licenses, audit reports, catalogs">
            <div className="space-y-3">
              {docs.map((d, i) => (
                <div key={i} className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-semibold text-[var(--text-secondary)]">Document {i + 1}</span><button type="button" onClick={() => setDocs((a) => a.filter((_, x) => x !== i))} className="text-[var(--text-faint)] hover:text-[var(--text-primary)]"><TrashIcon className="h-3.5 w-3.5" /></button></div>
                  <input type="file" onChange={(e) => { const file = e.target.files?.[0] ?? null; setDocs((a) => a.map((x, j) => j === i ? { ...x, file } : x)); }} className="mb-2 block w-full text-[12px] text-[var(--text-secondary)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--bg-surface-subtle)] file:px-3 file:py-1.5 file:text-[12px] file:text-[var(--text-primary)]" />
                  <Grid>
                    <F label="Type"><select value={d.category} onChange={(e) => setDocs((a) => a.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} className={inputCls}>{DOC_CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select></F>
                    <F label="Cert / doc name"><input value={d.cert_type} onChange={(e) => setDocs((a) => a.map((x, j) => j === i ? { ...x, cert_type: e.target.value } : x))} placeholder="ISO 9001" className={inputCls} /></F>
                    <F label="Issuer"><input value={d.issuer} onChange={(e) => setDocs((a) => a.map((x, j) => j === i ? { ...x, issuer: e.target.value } : x))} className={inputCls} /></F>
                    <F label="Visibility"><select value={d.visibility} onChange={(e) => setDocs((a) => a.map((x, j) => j === i ? { ...x, visibility: e.target.value } : x))} className={inputCls}><option value="internal">Internal</option><option value="procurement">Procurement</option><option value="management">Management</option><option value="public">Public</option></select></F>
                    <F label="Issued date"><input type="date" value={d.issued_date} onChange={(e) => setDocs((a) => a.map((x, j) => j === i ? { ...x, issued_date: e.target.value } : x))} className={inputCls} /></F>
                    <F label="Expiry date"><input type="date" value={d.expiry_date} onChange={(e) => setDocs((a) => a.map((x, j) => j === i ? { ...x, expiry_date: e.target.value } : x))} className={inputCls} /></F>
                  </Grid>
                </div>
              ))}
              <button type="button" onClick={() => setDocs((a) => [...a, emptyDoc()])} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]"><PlusIcon className="h-3.5 w-3.5" />Add document</button>
            </div>
          </Section>

          <Section title="Risk" sub="Risk scorecard">
            <Grid>
              <F label="Risk level"><LevelSelect value={risk.risk_level} onChange={(v) => setr("risk_level", v)} levels={LEVEL4} /></F>
              <F label="Dependency level"><LevelSelect value={risk.dependency_level} onChange={(v) => setr("dependency_level", v)} levels={LEVEL4} /></F>
              <F label="Financial stability"><LevelSelect value={risk.financial_stability} onChange={(v) => setr("financial_stability", v)} levels={LEVEL3} /></F>
              <F label="Delivery stability"><LevelSelect value={risk.delivery_stability} onChange={(v) => setr("delivery_stability", v)} levels={LEVEL3} /></F>
              <F label="Quality stability"><LevelSelect value={risk.quality_stability} onChange={(v) => setr("quality_stability", v)} levels={LEVEL3} /></F>
              <F label="Communication quality"><LevelSelect value={risk.communication_quality} onChange={(v) => setr("communication_quality", v)} levels={LEVEL3} /></F>
              <F label="Trust level"><LevelSelect value={risk.trust_level} onChange={(v) => setr("trust_level", v)} levels={LEVEL3} /></F>
              <F label="Internal score (0–100)"><input value={risk.internal_evaluation_score} onChange={(e) => setr("internal_evaluation_score", e.target.value)} className={inputCls} /></F>
            </Grid>
            <div className="mt-2 flex items-center gap-4 text-[12px] text-[var(--text-secondary)]"><label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={risk.backup_supplier_exists} onChange={(e) => setr("backup_supplier_exists", e.target.checked)} className="accent-[var(--text-primary)]" />Backup supplier exists</label></div>
            <div className="mt-2"><F label="Assessment notes"><textarea value={risk.assessment_notes} onChange={(e) => setr("assessment_notes", e.target.value)} rows={2} className={inputCls} /></F></div>
          </Section>

          <Section title="Negotiation" sub="Negotiation intelligence">
            <Grid>
              <F label="Negotiation score (0–100)"><input value={neg.negotiation_score} onChange={(e) => setn("negotiation_score", e.target.value)} className={inputCls} /></F>
              <F label="Price flexibility"><LevelSelect value={neg.price_flexibility} onChange={(v) => setn("price_flexibility", v)} levels={LEVEL3} /></F>
              <F label="MOQ flexibility"><LevelSelect value={neg.moq_flexibility} onChange={(v) => setn("moq_flexibility", v)} levels={LEVEL3} /></F>
              <F label="Payment flexibility"><LevelSelect value={neg.payment_flexibility} onChange={(v) => setn("payment_flexibility", v)} levels={LEVEL3} /></F>
              <F label="Negotiation difficulty"><LevelSelect value={neg.negotiation_difficulty} onChange={(v) => setn("negotiation_difficulty", v)} levels={LEVEL3} /></F>
              <F label="Sample turnaround speed"><LevelSelect value={neg.sample_turnaround_speed} onChange={(v) => setn("sample_turnaround_speed", v)} levels={LEVEL3} /></F>
            </Grid>
            <div className="mt-2"><F label="Internal notes"><textarea value={neg.internal_notes} onChange={(e) => setn("internal_notes", e.target.value)} rows={2} className={inputCls} /></F></div>
            <p className="mt-2 text-[11px] text-[var(--text-faint)]">Sourcing product links are added on the supplier&rsquo;s Sourcing tab (they require picking existing products).</p>
          </Section>
        </div>

        {/* Sticky save bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--bg-primary)]/90 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 md:px-8">
            <div className="min-w-0 text-[12px] text-[var(--text-secondary)]">{err ? <span className="text-rose-400">{err}</span> : progress ? <span className="inline-flex items-center gap-1.5"><SpinnerIcon className="h-3.5 w-3.5 animate-spin" />{progress}</span> : "Only company name is required."}</div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={() => router.push("/suppliers")} className="rounded-lg px-3 py-2 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
              <button onClick={() => void submit()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 py-2 text-[12px] font-semibold text-[var(--bg-primary)] disabled:opacity-50">{busy ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckIcon className="h-3.5 w-3.5" />}Create supplier</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
