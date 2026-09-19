"use client";

/* ---------------------------------------------------------------------------
   ComplianceSheet — the Compliance tab of the product profile, editable in
   place. The editor's two cards, in its order:

     Compliance             CE / RoHS, the environmental ratings (IP, operating
                            range, oil-mist filter) and the certificate records
     Warranty & After-Sales warranty text + months/type/start, coverage,
                            exclusions, spares, service life, maintenance,
                            support, channels, training, installation, returns

   Every row stays a row; Edit turns the value into the control. Fields the
   product's spec template owns (CE, IP rating, operating temperature, oil
   mist) are not shown here — the Specs tab is their home, as in the editor.
   Certificates save through the certifications set (replace-the-set).
   --------------------------------------------------------------------------- */

import { updateProduct, saveProductCertifications, type ProductCertificationRow } from "@/lib/products-admin";
import KdsSelect from "@/components/kds/Select";
import Toggle from "@/components/kds/Toggle";
import BoundIcon from "@/components/common/BoundIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import { Group, FieldRow, Blank, YesNo, Chips, INP_B, TA } from "./primitives";
import { useSheetEdit } from "./useSheetEdit";

type Row = Record<string, unknown>;
type Cert = {
  _k: string; id?: string; cert_type: string; certified_standard: string; cert_number: string; issuer: string;
  issued_date: string; expiry_date: string; reminder_days: string; country_scope: string; file_url: string;
  verification_url: string; status: string; notes: string;
};
type Draft = {
  ce_certified: boolean; rohs_compliant: boolean; ip_rating: string; operating_temp: string; oil_mist_filter: boolean;
  certifications: Cert[];
  warranty: string; warranty_months: string; warranty_type: string; warranty_start_from: string;
  warranty_coverage: string; warranty_exclusions: string; spare_parts_availability: string; spare_parts_stock: string;
  service_life: string; maintenance_interval: string; technical_support: string; returns_policy: string;
  support_channels: string[]; training_available: boolean; installation_service: boolean;
};
type Card = "compliance" | "warranty";

const CERT_TYPES = ["CE", "RoHS", "ISO9001", "ISO14001", "UL", "CCC", "FCC", "REACH", "Other"];
const STATUSES = ["active", "pending", "expired"];
const CHANNELS = ["Phone", "Email", "WeChat", "WhatsApp", "On-site", "Remote"];
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export default function ComplianceSheet({
  product, certifications, productId, t, motion, canEdit, onDirtyChange, onSaved, notSet, schemaCovers, glyph,
}: {
  product: Row | undefined;
  certifications: Row[];
  productId: string | undefined;
  t: (k: string, fb?: string) => string;
  motion: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (patch: Row, certs?: Row[]) => void;
  notSet: string;
  /** Spec-template field keys — a covered column is the template's, not this tab's. */
  schemaCovers: Set<string>;
  glyph: (label: string) => React.ReactNode;
}) {
  const certOf = (c: Row, i: number): Cert => ({
    _k: str(c.id) || `n${i}`, id: str(c.id) || undefined, cert_type: str(c.cert_type), certified_standard: str(c.certified_standard),
    cert_number: str(c.cert_number), issuer: str(c.issuer), issued_date: str(c.issued_date).slice(0, 10), expiry_date: str(c.expiry_date).slice(0, 10),
    reminder_days: str(c.reminder_days), country_scope: str(c.country_scope), file_url: str(c.file_url), verification_url: str(c.verification_url),
    status: str(c.status) || "active", notes: str(c.notes),
  });
  const sheet = useSheetEdit<Card, Draft>({
    t, onDirtyChange,
    makeDraft: () => ({
      ce_certified: !!product?.ce_certified, rohs_compliant: !!product?.rohs_compliant,
      ip_rating: str(product?.ip_rating), operating_temp: str(product?.operating_temp), oil_mist_filter: !!product?.oil_mist_filter,
      certifications: certifications.map(certOf),
      warranty: str(product?.warranty), warranty_months: str(product?.warranty_months), warranty_type: str(product?.warranty_type),
      warranty_start_from: str(product?.warranty_start_from), warranty_coverage: str(product?.warranty_coverage),
      warranty_exclusions: str(product?.warranty_exclusions), spare_parts_availability: str(product?.spare_parts_availability),
      spare_parts_stock: str(product?.spare_parts_stock), service_life: str(product?.service_life),
      maintenance_interval: str(product?.maintenance_interval), technical_support: str(product?.technical_support),
      returns_policy: str(product?.returns_policy), support_channels: arr(product?.support_channels),
      training_available: !!product?.training_available, installation_service: !!product?.installation_service,
    }),
    valid: (c, d) => c !== "compliance" || d.certifications.every((x) => x.cert_type.trim().length > 0),
    commit: async (card, d) => {
      if (!productId) return;
      if (card === "compliance") {
        const patch: Row = {
          rohs_compliant: d.rohs_compliant,
          ...(certsInSpecs ? {} : { ce_certified: d.ce_certified }),
          ...(schemaCovers.has("ip_rating") ? {} : { ip_rating: d.ip_rating.trim() || null }),
          ...(schemaCovers.has("operating_temperature") ? {} : { operating_temp: d.operating_temp.trim() || null }),
          ...(schemaCovers.has("oil_mist_filter") ? {} : { oil_mist_filter: d.oil_mist_filter }),
        };
        await updateProduct(productId, patch);
        const rows: ProductCertificationRow[] = d.certifications.map((c) => ({
          cert_type: c.cert_type.trim(), certified_standard: c.certified_standard.trim() || null, cert_number: c.cert_number.trim() || null,
          issuer: c.issuer.trim() || null, issued_date: c.issued_date || null, expiry_date: c.expiry_date || null,
          reminder_days: c.reminder_days.trim() ? Number(c.reminder_days) : null, country_scope: c.country_scope.trim() || null,
          file_url: c.file_url.trim() || null, verification_url: c.verification_url.trim() || null, status: c.status || "active", notes: c.notes.trim() || null,
        }));
        const ok = await saveProductCertifications(productId, rows);
        if (!ok) throw new Error(t("pr.saveFailed", "Couldn't save — try again."));
        onSaved(patch, rows as unknown as Row[]);
      } else {
        const patch: Row = {
          warranty: d.warranty.trim() || null,
          warranty_months: d.warranty_months.trim() ? parseInt(d.warranty_months, 10) : null,
          warranty_type: d.warranty_type || null, warranty_start_from: d.warranty_start_from || null,
          warranty_coverage: d.warranty_coverage.trim() || null, warranty_exclusions: d.warranty_exclusions.trim() || null,
          spare_parts_availability: d.spare_parts_availability.trim() || null, spare_parts_stock: d.spare_parts_stock.trim() || null,
          service_life: d.service_life.trim() || null, maintenance_interval: d.maintenance_interval.trim() || null,
          technical_support: d.technical_support.trim() || null, returns_policy: d.returns_policy.trim() || null,
          support_channels: d.support_channels, training_available: d.training_available, installation_service: d.installation_service,
        };
        await updateProduct(productId, patch);
        onSaved(patch);
      }
    },
  });
  const certsInSpecs = schemaCovers.has("certifications");
  const eC = sheet.editing === "compliance";
  const eW = sheet.editing === "warranty";
  const d = sheet.draft;
  /* What the sheet reads from: the draft while its card is open, the row otherwise. */
  const v = (k: keyof Draft, card: Card): unknown => (sheet.editing === card && d ? d[k] : product?.[k as string]);
  const s = (k: keyof Draft, card: Card) => str(v(k, card));
  const b = (k: keyof Draft, card: Card) => !!v(k, card);
  const certs: Cert[] = eC && d ? d.certifications : certifications.map(certOf);

  const yes = t("pp.yes", "Yes"); const no = t("pp.no", "No");
  const text = (k: keyof Draft, opts?: { placeholder?: string; area?: boolean; numeric?: boolean }) => (
    opts?.area
      ? <textarea value={str(d?.[k])} onChange={(e) => sheet.patch({ [k]: e.target.value } as Partial<Draft>)} placeholder={opts.placeholder} className={TA} />
      : <input value={str(d?.[k])} inputMode={opts?.numeric ? "numeric" : undefined}
          onChange={(e) => sheet.patch({ [k]: opts?.numeric ? e.target.value.replace(/[^0-9]/g, "") : e.target.value } as Partial<Draft>)}
          placeholder={opts?.placeholder} className={`${INP_B} w-full`} />
  );
  const toggle = (k: keyof Draft) => <Toggle checked={!!d?.[k]} onChange={(x) => sheet.patch({ [k]: x } as Partial<Draft>)} />;
  const textOrBlank = (x: string) => (x ? x : <Blank label={notSet} />);
  const warrantyTypes = [
    { value: "parts-only", label: t("cw.partsOnly", "Parts only") },
    { value: "parts-and-labour", label: t("cw.partsLabour", "Parts & labour") },
    { value: "on-site", label: t("cw.onSite", "On-site") },
  ];
  const startFroms = [
    { value: "shipment", label: t("cw.shipment", "Shipment") },
    { value: "installation", label: t("cw.installation", "Installation") },
    { value: "invoice", label: t("cw.invoice", "Invoice date") },
  ];
  const labelOf = (opts: { value: string; label: string }[], x: string) => opts.find((o) => o.value === x)?.label ?? x;
  const grid = "grid grid-cols-1 sm:grid-cols-2 gap-x-8 [&>*]:border-b [&>*]:border-[var(--border-subtle)] [&>*:last-child]:border-b-0 sm:[&>*:nth-last-child(2):nth-child(odd)]:border-b-0";
  const updCert = (k: string, u: Partial<Cert>) => sheet.patch((dd) => ({ ...dd, certifications: dd.certifications.map((c) => (c._k === k ? { ...c, ...u } : c)) }));
  const cinp = `${INP_B} w-full h-8 text-[12px]`;
  const clbl = "block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)] mb-1";

  return (
    <div className="space-y-4" onKeyDown={sheet.onKeyDown}>
      {/* ── 1. Compliance ─────────────────────────────────────────────── */}
      <Group
        motion={motion}
        icon={<BoundIcon semanticKey="field.certifications" className="h-4 w-4" fallback={<ShieldCheckIcon className="h-4 w-4" />} />}
        title={t("compliance.title", "Compliance")}
        count={`${certs.length} ${t("pp.certWord", "cert")}`}
        {...sheet.gp("compliance", canEdit)}
      >
        {certsInSpecs && (
          <p className="mb-3 text-[11px] leading-relaxed text-[var(--text-ghost)]">{t("compliance.ceInSpecs", "CE and other certifications for this category are set on the Specifications tab.")}</p>
        )}
        <div className={grid}>
          {!certsInSpecs && (
            <FieldRow label={t("compliance.ce", "CE Certified")} glyph={glyph(t("pp.f.ce", "CE certified"))} help={t("compliance.ceHelp", "Required for sale in the European Economic Area.")}
              value={<YesNo v={b("ce_certified", "compliance")} yes={yes} no={no} />} input={eC ? toggle("ce_certified") : undefined} />
          )}
          <FieldRow label={t("compliance.rohs", "RoHS Compliant")} glyph={glyph(t("pp.f.rohs", "RoHS compliant"))} help={t("compliance.rohsHelp", "EU restriction on hazardous substances in electronics.")}
            value={<YesNo v={b("rohs_compliant", "compliance")} yes={yes} no={no} />} input={eC ? toggle("rohs_compliant") : undefined} />
          {!schemaCovers.has("ip_rating") && (
            <FieldRow label={t("tech.ipRating", "IP Rating")} glyph={glyph(t("tech.ipRating", "IP Rating"))} help={t("tech.ipRatingHint", "Ingress protection (dust + water).")}
              value={textOrBlank(s("ip_rating", "compliance"))} input={eC ? text("ip_rating", { placeholder: "e.g. IP54" }) : undefined} />
          )}
          {!schemaCovers.has("operating_temperature") && (
            <FieldRow label={t("tech.operatingTemp", "Operating Temperature")} glyph={glyph(t("tech.operatingTemp", "Operating Temperature"))} help={t("tech.operatingTempHint", "Recommended operating range.")}
              value={textOrBlank(s("operating_temp", "compliance"))} input={eC ? text("operating_temp", { placeholder: "e.g. 5–40 °C" }) : undefined} />
          )}
          {!schemaCovers.has("oil_mist_filter") && (
            <FieldRow label={t("tech.oilMist", "Oil mist filter")} glyph={glyph(t("tech.oilMist", "Oil mist filter"))}
              value={<YesNo v={b("oil_mist_filter", "compliance")} yes={yes} no={no} />} input={eC ? toggle("oil_mist_filter") : undefined} />
          )}
        </div>

        {/* Certificate records — one card per certificate, every column. */}
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">{t("compliance.recordsTitle", "Certificate records")}</span>
            {eC && (
              <button type="button" onClick={() => sheet.patch((dd) => ({ ...dd, certifications: [...dd.certifications, { ...certOf({}, dd.certifications.length), _k: crypto.randomUUID(), cert_type: "CE" }] }))}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors">
                <PlusIcon className="h-3 w-3" /> {t("cc.add", "Add certificate")}
              </button>
            )}
          </div>
          {certs.length === 0 ? (
            <p className="text-[12px] text-[var(--text-ghost)] italic">{t("cc.none", "No certificate recorded.")}</p>
          ) : (
            <div className="space-y-2">
              {certs.map((c) => (
                <div key={c._k} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  {eC ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      <div><span className={clbl}>{t("cc.type", "Type")}</span><KdsSelect value={c.cert_type} onChange={(x) => updCert(c._k, { cert_type: x })} options={CERT_TYPES} triggerClassName={`${cinp} pe-8 text-start`} /></div>
                      <div><span className={clbl}>{t("cc.standard", "Standard")}</span><input className={cinp} value={c.certified_standard} placeholder="e.g. EN ISO 12100" onChange={(e) => updCert(c._k, { certified_standard: e.target.value })} /></div>
                      <div><span className={clbl}>{t("cc.number", "Certificate no.")}</span><input className={cinp} value={c.cert_number} placeholder="e.g. CE-2024-0193" onChange={(e) => updCert(c._k, { cert_number: e.target.value })} /></div>
                      <div><span className={clbl}>{t("cc.issuer", "Issuer")}</span><input className={cinp} value={c.issuer} placeholder="e.g. TÜV / SGS" onChange={(e) => updCert(c._k, { issuer: e.target.value })} /></div>
                      <div><span className={clbl}>{t("cc.issued", "Issued")}</span><input type="date" className={cinp} value={c.issued_date} onChange={(e) => updCert(c._k, { issued_date: e.target.value })} /></div>
                      <div><span className={clbl}>{t("cc.expires", "Expires")}</span><input type="date" className={cinp} value={c.expiry_date} onChange={(e) => updCert(c._k, { expiry_date: e.target.value })} /></div>
                      <div><span className={clbl}>{t("cc.remind", "Remind (days before)")}</span><input className={cinp} inputMode="numeric" value={c.reminder_days} placeholder="e.g. 30" onChange={(e) => updCert(c._k, { reminder_days: e.target.value.replace(/[^0-9]/g, "") })} /></div>
                      <div><span className={clbl}>{t("cc.scope", "Country scope")}</span><input className={cinp} value={c.country_scope} placeholder="e.g. EU, GCC" onChange={(e) => updCert(c._k, { country_scope: e.target.value })} /></div>
                      <div><span className={clbl}>{t("cc.status", "Status")}</span><KdsSelect value={c.status} onChange={(x) => updCert(c._k, { status: x })} options={STATUSES.map((x) => ({ value: x, label: t(`cc.st.${x}`, x) }))} triggerClassName={`${cinp} pe-8 text-start`} /></div>
                      <div><span className={clbl}>{t("cc.file", "Certificate file URL")}</span><input className={cinp} value={c.file_url} placeholder="https://…" onChange={(e) => updCert(c._k, { file_url: e.target.value })} /></div>
                      <div><span className={clbl}>{t("cc.verify", "Verification URL")}</span><input className={cinp} value={c.verification_url} placeholder="https://verify…" onChange={(e) => updCert(c._k, { verification_url: e.target.value })} /></div>
                      <div><span className={clbl}>{t("cc.notes", "Notes")}</span><input className={cinp} value={c.notes} onChange={(e) => updCert(c._k, { notes: e.target.value })} /></div>
                      <div className="col-span-full flex justify-end">
                        <button type="button" onClick={() => sheet.patch((dd) => ({ ...dd, certifications: dd.certifications.filter((x) => x._k !== c._k) }))}
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--text-ghost)] hover:text-rose-300 transition-colors">
                          <CrossIcon className="h-3 w-3" /> {t("cc.remove", "Remove")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{c.cert_type || "—"}</span>
                        {c.certified_standard && <span className="text-[12px] text-[var(--text-dim)]">{c.certified_standard}</span>}
                        {c.cert_number && <span className="font-mono text-[11px] text-[var(--text-muted)]">{c.cert_number}</span>}
                        <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${c.status === "expired" ? "border-rose-500/40 text-rose-300" : c.status === "pending" ? "border-amber-500/40 text-amber-300" : "border-emerald-500/30 text-emerald-400/90"}`}>{t(`cc.st.${c.status}`, c.status)}</span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
                        <span>{t("cc.issuer", "Issuer")}: <b className="text-[var(--text-secondary)] font-medium">{c.issuer || "—"}</b></span>
                        <span>{t("cc.issued", "Issued")}: <b className="text-[var(--text-secondary)] font-medium tabular-nums">{c.issued_date || "—"}</b></span>
                        <span>{t("cc.expires", "Expires")}: <b className="text-[var(--text-secondary)] font-medium tabular-nums">{c.expiry_date || "—"}</b>{c.reminder_days ? ` · ${t("cc.remindShort", "remind {n}d before").replace("{n}", c.reminder_days)}` : ""}</span>
                        <span>{t("cc.scope", "Country scope")}: <b className="text-[var(--text-secondary)] font-medium">{c.country_scope || "—"}</b></span>
                        {(c.file_url || c.verification_url) && (
                          <span className="col-span-full flex flex-wrap gap-3">
                            {c.file_url && <a href={c.file_url} target="_blank" rel="noreferrer" className="underline hover:text-[var(--text-primary)]">{t("cc.fileShort", "Certificate file")}</a>}
                            {c.verification_url && <a href={c.verification_url} target="_blank" rel="noreferrer" className="underline hover:text-[var(--text-primary)]">{t("cc.verifyShort", "Verify online")}</a>}
                          </span>
                        )}
                        {c.notes && <span className="col-span-full italic">{c.notes}</span>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Group>

      {/* ── 2. Warranty & After-Sales ─────────────────────────────────── */}
      <Group motion={motion} icon={<WrenchIcon className="h-4 w-4" />} title={t("compliance.warrantyTitle", "Warranty & After-Sales")} count={t("compliance.warrantyBadge", "Service")} {...sheet.gp("warranty", canEdit)}>
        <div className={grid}>
          <FieldRow label={t("hero.warranty", "Warranty")} glyph={glyph(t("hero.warranty", "Warranty"))} wide
            value={textOrBlank(s("warranty", "warranty"))} input={eW ? text("warranty", { placeholder: t("hero.warrantyPlaceholder", "e.g. 2 years parts & labour") }) : undefined} />
          <FieldRow label={t("pp.f.warrMonths", "Warranty (months)")} glyph={glyph(t("pp.f.warrMonths", "Warranty (months)"))}
            value={textOrBlank(s("warranty_months", "warranty"))} input={eW ? text("warranty_months", { numeric: true, placeholder: "12" }) : undefined} />
          <FieldRow label={t("pp.f.warrType", "Warranty type")} glyph={glyph(t("pp.f.warrType", "Warranty type"))}
            value={s("warranty_type", "warranty") ? labelOf(warrantyTypes, s("warranty_type", "warranty")) : <Blank label={notSet} />}
            input={eW && d ? <KdsSelect value={d.warranty_type} onChange={(x) => sheet.patch({ warranty_type: x })} options={warrantyTypes} placeholder={notSet} triggerClassName={`${INP_B} w-full pe-8 text-start`} /> : undefined} />
          <FieldRow label={t("pp.f.warrStart", "Starts from")} glyph={glyph(t("pp.f.warrStart", "Starts from"))}
            value={s("warranty_start_from", "warranty") ? labelOf(startFroms, s("warranty_start_from", "warranty")) : <Blank label={notSet} />}
            input={eW && d ? <KdsSelect value={d.warranty_start_from} onChange={(x) => sheet.patch({ warranty_start_from: x })} options={startFroms} placeholder={notSet} triggerClassName={`${INP_B} w-full pe-8 text-start`} /> : undefined} />
          <FieldRow label={t("pp.f.warrCover", "Coverage")} glyph={glyph(t("pp.f.warrCover", "Coverage"))}
            value={textOrBlank(s("warranty_coverage", "warranty"))} input={eW ? text("warranty_coverage", { area: true }) : undefined} />
          <FieldRow label={t("pp.f.warrExcl", "Exclusions")} glyph={glyph(t("pp.f.warrExcl", "Exclusions"))}
            value={textOrBlank(s("warranty_exclusions", "warranty"))} input={eW ? text("warranty_exclusions", { area: true }) : undefined} />
          <FieldRow label={t("pp.f.spares", "Spare parts availability")} glyph={glyph(t("pp.f.spares", "Spare parts availability"))}
            value={textOrBlank(s("spare_parts_availability", "warranty"))} input={eW ? text("spare_parts_availability", { placeholder: "e.g. 10 years" }) : undefined} />
          <FieldRow label={t("pp.f.sparesStock", "Spare parts stock")} glyph={glyph(t("pp.f.sparesStock", "Spare parts stock"))}
            value={textOrBlank(s("spare_parts_stock", "warranty"))} input={eW ? text("spare_parts_stock", { placeholder: "e.g. Cairo warehouse" }) : undefined} />
          <FieldRow label={t("pp.f.serviceLife", "Service life")} glyph={glyph(t("pp.f.serviceLife", "Service life"))}
            value={textOrBlank(s("service_life", "warranty"))} input={eW ? text("service_life", { placeholder: "e.g. 15 years" }) : undefined} />
          <FieldRow label={t("pp.f.maintenance", "Maintenance interval")} glyph={glyph(t("pp.f.maintenance", "Maintenance interval"))}
            value={textOrBlank(s("maintenance_interval", "warranty"))} input={eW ? text("maintenance_interval", { placeholder: "e.g. every 6 months" }) : undefined} />
          <FieldRow label={t("pp.f.support", "Technical support")} glyph={glyph(t("pp.f.support", "Technical support"))}
            value={textOrBlank(s("technical_support", "warranty"))} input={eW ? text("technical_support", { placeholder: "e.g. 24/7 remote + on-site" }) : undefined} />
          <FieldRow label={t("pp.f.returns", "Returns policy")} glyph={glyph(t("pp.f.returns", "Returns policy"))}
            value={textOrBlank(s("returns_policy", "warranty"))} input={eW ? text("returns_policy", { placeholder: "e.g. 30 days, unused" }) : undefined} />
          <FieldRow label={t("pp.f.channels", "Support channels")} glyph={glyph(t("pp.f.channels", "Support channels"))} wide
            value={arr(v("support_channels", "warranty")).length ? <Chips items={arr(v("support_channels", "warranty"))} /> : <Blank label={notSet} />}
            input={eW && d ? (
              <span className="inline-flex flex-wrap gap-1.5">
                {CHANNELS.map((ch) => {
                  const on = d.support_channels.includes(ch);
                  return (
                    <button key={ch} type="button" onClick={() => sheet.patch({ support_channels: on ? d.support_channels.filter((x) => x !== ch) : [...d.support_channels, ch] })}
                      className={`h-7 px-2.5 rounded-md text-[10.5px] font-semibold border transition-colors ${on ? "border-[#567FB2]/60 bg-[#567FB2]/[0.12] text-[var(--text-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/70 text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                      {t(`cw.ch.${ch}`, ch)}
                    </button>
                  );
                })}
              </span>
            ) : undefined} />
          <FieldRow label={t("pp.f.training", "Training available")} glyph={glyph(t("pp.f.training", "Training available"))}
            value={<YesNo v={b("training_available", "warranty")} yes={yes} no={no} />} input={eW ? toggle("training_available") : undefined} />
          <FieldRow label={t("pp.f.installation", "Installation service")} glyph={glyph(t("pp.f.installation", "Installation service"))}
            value={<YesNo v={b("installation_service", "warranty")} yes={yes} no={no} />} input={eW ? toggle("installation_service") : undefined} />
        </div>
      </Group>
    </div>
  );
}
