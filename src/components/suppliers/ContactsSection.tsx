"use client";

/* ---------------------------------------------------------------------------
   ContactsSection — Communication Intelligence for the Supplier 360.

   Supplier contact persons rendered as operational communication-intelligence
   entities: role hierarchy grouping, channel quick-actions, preferred channel
   / language indicators, reliability + response signals, per-contact visibility
   tier, and a governed WeChat/WeCom QR gallery (supplier-level + per-contact).

   Inline add / edit / archive for contacts; upload / remove for QR codes.
   Storage uploads go through /api/storage/upload (service-role). All writes are
   tenant + supplier scoped and Suppliers-module gated server-side. Monochrome,
   compact, enterprise — not a CRM contact book.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { contactsT } from "@/lib/translations/contacts";
import { humanizeError } from "@/lib/ui/humanize-error";
import { uploadToStorage } from "@/lib/storage-client";
import {
  ROLE_CATEGORY_LABELS,
  ROLE_CATEGORY_ORDER,
  roleCategoryLabel,
  CHANNEL_LABELS,
  channelLabel,
  QR_CATEGORY_LABELS,
  qrCategoryLabel,
  RELIABILITY_LABELS,
} from "@/lib/suppliers/intelligence";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import CrownIcon from "@/components/icons/ui/CrownIcon";
import UserCheckIcon from "@/components/icons/ui/UserCheckIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import ScanLineIcon from "@/components/icons/ui/ScanLineIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import ZapIcon from "@/components/icons/ui/ZapIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import Edit3Icon from "@/components/icons/ui/Edit3Icon";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";

type Row = Record<string, unknown>;

const str = (r: Row, k: string): string => {
  const v = r[k];
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
};
const isTrue = (r: Row, k: string): boolean => r[k] === true;

const VISIBILITY_TIERS = ["public", "internal", "procurement", "finance", "management"] as const;
const VISIBILITY_LABELS: Record<string, string> = {
  public: "Public", internal: "Internal", procurement: "Procurement",
  finance: "Finance only", management: "Management only",
};

/* a single messaging/contact channel descriptor for a contact card */
type Channel = { key: string; value: string; href?: string };
const channelsFor = (c: Row): Channel[] => {
  const out: Channel[] = [];
  const digits = (s: string) => s.replace(/[^\d+]/g, "");
  if (str(c, "email")) out.push({ key: "email", value: str(c, "email"), href: `mailto:${str(c, "email")}` });
  if (str(c, "mobile")) out.push({ key: "mobile", value: str(c, "mobile"), href: `tel:${digits(str(c, "mobile"))}` });
  if (str(c, "whatsapp")) out.push({ key: "whatsapp", value: str(c, "whatsapp"), href: `https://wa.me/${digits(str(c, "whatsapp"))}` });
  if (str(c, "telegram")) out.push({ key: "telegram", value: str(c, "telegram"), href: `https://t.me/${str(c, "telegram").replace(/^@/, "")}` });
  if (str(c, "wechat_id")) out.push({ key: "wechat", value: str(c, "wechat_id") });
  if (str(c, "wecom_id")) out.push({ key: "wecom", value: str(c, "wecom_id") });
  if (str(c, "line_id")) out.push({ key: "line", value: str(c, "line_id") });
  if (str(c, "skype_id")) out.push({ key: "skype", value: str(c, "skype_id") });
  return out;
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{children}</div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
    {children}
  </label>
);
const inputCls =
  "w-full rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:ring-1 focus:ring-[var(--border-subtle)]";

type Draft = {
  full_name: string; name_cn: string; role: string; role_category: string;
  department: string; position: string; email: string; mobile: string;
  whatsapp: string; telegram: string; wechat_id: string; wecom_id: string;
  preferred_channel: string; preferred_language: string; timezone: string;
  available_hours: string; reliability: string; response_speed: string;
  visibility_tier: string; notes: string;
  is_primary: boolean; is_decision_maker: boolean;
};
const emptyDraft = (): Draft => ({
  full_name: "", name_cn: "", role: "", role_category: "", department: "", position: "",
  email: "", mobile: "", whatsapp: "", telegram: "", wechat_id: "", wecom_id: "",
  preferred_channel: "", preferred_language: "", timezone: "", available_hours: "",
  reliability: "", response_speed: "", visibility_tier: "internal", notes: "",
  is_primary: false, is_decision_maker: false,
});
const draftFrom = (c: Row): Draft => ({
  full_name: str(c, "full_name"), name_cn: str(c, "name_cn"), role: str(c, "role"),
  role_category: str(c, "role_category"), department: str(c, "department"), position: str(c, "position"),
  email: str(c, "email"), mobile: str(c, "mobile"), whatsapp: str(c, "whatsapp"),
  telegram: str(c, "telegram"), wechat_id: str(c, "wechat_id"), wecom_id: str(c, "wecom_id"),
  preferred_channel: str(c, "preferred_channel"), preferred_language: str(c, "preferred_language"),
  timezone: str(c, "timezone"),
  available_hours:
    typeof c.available_hours === "object" && c.available_hours
      ? String((c.available_hours as Row).text ?? "")
      : str(c, "available_hours"),
  reliability: str(c, "reliability"), response_speed: str(c, "response_speed"),
  visibility_tier: str(c, "visibility_tier") || "internal", notes: str(c, "notes"),
  is_primary: isTrue(c, "is_primary"), is_decision_maker: isTrue(c, "is_decision_maker"),
});

export default function ContactsSection({
  supplierId,
  contactPersons,
  qrCodes,
  onSaved,
}: {
  supplierId: string;
  contactPersons: Row[];
  qrCodes: Row[];
  onSaved: () => void | Promise<void>;
}) {
  // editingId: contact id being edited, "new" for add, null for none
  const { t } = useTranslation(contactsT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // QR upload modal
  const [qrOpen, setQrOpen] = useState(false);
  const [qrContactId, setQrContactId] = useState<string | null>(null);
  const [qrCategory, setQrCategory] = useState("sales");
  const [qrVisibility, setQrVisibility] = useState("procurement");
  const [qrTitle, setQrTitle] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrErr, setQrErr] = useState<string | null>(null);

  const set = (k: keyof Draft, v: unknown) => setDraft((p) => ({ ...p, [k]: v }));

  const grouped = useMemo(() => {
    const by: Record<string, Row[]> = {};
    for (const c of contactPersons) {
      const cat = str(c, "role_category") || "other";
      (by[cat] ||= []).push(c);
    }
    const order = [...ROLE_CATEGORY_ORDER];
    return Object.keys(by)
      .sort((a, b) => {
        const ia = order.indexOf(a); const ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
      .map((cat) => ({ cat, items: by[cat] }));
  }, [contactPersons]);

  const qrByContact = useMemo(() => {
    const by: Record<string, Row[]> = { _supplier: [] };
    for (const q of qrCodes) {
      const cid = typeof q.contact_id === "string" ? q.contact_id : "_supplier";
      (by[cid] ||= []).push(q);
    }
    return by;
  }, [qrCodes]);

  const openAdd = () => { setDraft(emptyDraft()); setEditingId("new"); setErr(null); };
  const openEdit = (c: Row) => { setDraft(draftFrom(c)); setEditingId(str(c, "id")); setErr(null); };

  const saveContact = async () => {
    if (!draft.full_name.trim()) { setErr(t("cs.nameRequired", "Name is required")); return; }
    setSaving(true); setErr(null);
    try {
      const body: Record<string, unknown> = {
        ...draft,
        available_hours: draft.available_hours.trim() ? { text: draft.available_hours.trim() } : null,
      };
      const isNew = editingId === "new";
      const url = isNew
        ? `/api/suppliers/${supplierId}/contacts`
        : `/api/suppliers/${supplierId}/contacts/${editingId}`;
      const r = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      }
      setEditingId(null);
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const archiveContact = async (c: Row) => {
    const id = str(c, "id");
    if (!confirm(`${t("cs.archiveConfirmPrefix", "Archive")} ${str(c, "full_name") || t("cs.thisContact", "this contact")}${t("cs.archiveConfirmSuffix", "? They can be re-added later.")}`)) return;
    setBusyId(id); setErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/contacts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const openQr = (contactId: string | null) => {
    setQrContactId(contactId); setQrCategory("sales"); setQrVisibility("procurement");
    setQrTitle(""); setQrFile(null); setQrErr(null); setQrOpen(true);
  };

  const saveQr = async () => {
    if (!qrFile) { setQrErr(t("cs.chooseQrFirst", "Choose a QR image first")); return; }
    setQrBusy(true); setQrErr(null);
    try {
      const ext = (qrFile.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `suppliers/${supplierId}/qr/${crypto.randomUUID()}.${ext}`;
      const up = await uploadToStorage("media", path, qrFile, { contentType: qrFile.type || "image/png" });
      if (!up.ok) throw new Error(humanizeError(up.error));
      const r = await fetch(`/api/suppliers/${supplierId}/qr`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_url: up.data.publicUrl,
          preview_url: up.data.publicUrl,
          storage_bucket: "media",
          storage_path: up.data.path,
          category: qrCategory,
          visibility: qrVisibility,
          title: qrTitle,
          contact_id: qrContactId,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      }
      setQrOpen(false);
      await onSaved();
    } catch (e) {
      setQrErr(e instanceof Error ? e.message : String(e));
    } finally {
      setQrBusy(false);
    }
  };

  const removeQr = async (q: Row) => {
    const id = str(q, "id");
    if (!confirm(t("cs.removeQrConfirm", "Remove this QR code?"))) return;
    setBusyId(id); setQrErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/qr/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const hasData = contactPersons.length > 0 || qrCodes.length > 0;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-[var(--text-secondary)]" />
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{t("cs.title", "Communication Intelligence")}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openQr(null)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ScanLineIcon className="h-3.5 w-3.5" /> {t("cs.addQr", "Add QR")}
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90"
          >
            <PlusIcon className="h-3.5 w-3.5" /> {t("cs.addContact", "Add contact")}
          </button>
        </div>
      </div>

      {err ? <div className="text-[12px] text-rose-400">{err}</div> : null}

      {/* ── add/edit form ── */}
      {editingId ? (
        <div className="space-y-4 rounded-2xl bg-[var(--bg-surface-subtle)] p-5">
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-[var(--text-secondary)]" />
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">
              {editingId === "new" ? t("cs.newContact", "New contact") : t("cs.editContact", "Edit contact")}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <Field label={t("cs.fullName", "Full name *")}><input className={inputCls} value={draft.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="e.g. Wang Lei" /></Field>
            <Field label={t("cs.nameCn", "Name (中文)")}><input className={inputCls} value={draft.name_cn} onChange={(e) => set("name_cn", e.target.value)} placeholder="王磊" /></Field>
            <Field label={t("cs.roleCategory", "Role category")}>
              <select className={inputCls} value={draft.role_category} onChange={(e) => set("role_category", e.target.value)}>
                <option value="">—</option>
                {ROLE_CATEGORY_ORDER.map((k) => <option key={k} value={k}>{t("opt." + k, ROLE_CATEGORY_LABELS[k])}</option>)}
              </select>
            </Field>
            <Field label={t("cs.positionTitle", "Position / title")}><input className={inputCls} value={draft.position} onChange={(e) => set("position", e.target.value)} placeholder="Export Sales Lead" /></Field>
            <Field label={t("cs.department", "Department")}><input className={inputCls} value={draft.department} onChange={(e) => set("department", e.target.value)} placeholder="International Sales" /></Field>
            <Field label={t("cs.visibility", "Visibility")}>
              <select className={inputCls} value={draft.visibility_tier} onChange={(e) => set("visibility_tier", e.target.value)}>
                {VISIBILITY_TIERS.map((tier) => <option key={tier} value={tier}>{t("opt." + tier, VISIBILITY_LABELS[tier])}</option>)}
              </select>
            </Field>
            <Field label={t("cs.email", "Email")}><input className={inputCls} value={draft.email} onChange={(e) => set("email", e.target.value)} placeholder="name@factory.com" /></Field>
            <Field label={t("cs.mobile", "Mobile")}><input className={inputCls} value={draft.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="+86 …" /></Field>
            <Field label={t("cs.whatsapp", "WhatsApp")}><input className={inputCls} value={draft.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+86 …" /></Field>
            <Field label={t("cs.telegram", "Telegram")}><input className={inputCls} value={draft.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="@handle" /></Field>
            <Field label={t("cs.wechatId", "WeChat ID")}><input className={inputCls} value={draft.wechat_id} onChange={(e) => set("wechat_id", e.target.value)} placeholder="wxid_…" /></Field>
            <Field label={t("cs.wecomId", "WeCom ID")}><input className={inputCls} value={draft.wecom_id} onChange={(e) => set("wecom_id", e.target.value)} /></Field>
            <Field label={t("cs.preferredChannel", "Preferred channel")}>
              <select className={inputCls} value={draft.preferred_channel} onChange={(e) => set("preferred_channel", e.target.value)}>
                <option value="">—</option>
                {Object.keys(CHANNEL_LABELS).map((k) => <option key={k} value={k}>{t("opt." + k, CHANNEL_LABELS[k])}</option>)}
              </select>
            </Field>
            <Field label={t("cs.preferredLanguage", "Preferred language")}><input className={inputCls} value={draft.preferred_language} onChange={(e) => set("preferred_language", e.target.value)} placeholder="Chinese / English" /></Field>
            <Field label={t("cs.timezone", "Timezone")}><input className={inputCls} value={draft.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="CST (UTC+8)" /></Field>
            <Field label={t("cs.availableHours", "Available hours")}><input className={inputCls} value={draft.available_hours} onChange={(e) => set("available_hours", e.target.value)} placeholder="Active after 18:00 CST" /></Field>
            <Field label={t("cs.reliability", "Reliability")}>
              <select className={inputCls} value={draft.reliability} onChange={(e) => set("reliability", e.target.value)}>
                <option value="">—</option>
                {Object.keys(RELIABILITY_LABELS).map((k) => <option key={k} value={k}>{t("opt." + k, RELIABILITY_LABELS[k])}</option>)}
              </select>
            </Field>
            <Field label={t("cs.responseSpeed", "Response speed")}><input className={inputCls} value={draft.response_speed} onChange={(e) => set("response_speed", e.target.value)} placeholder="Replies fastest on WeChat" /></Field>
          </div>
          <Field label={t("cs.notes", "Notes (operational intelligence)")}>
            <textarea className={`${inputCls} min-h-[60px]`} value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Weak English · handles technical problems · prefers calls" />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {([["is_primary", t("cs.primaryContact", "Primary contact")], ["is_decision_maker", t("cs.decisionMaker", "Decision maker")]] as const).map(([k, label]) => {
              const on = draft[k];
              return (
                <button key={k} type="button" onClick={() => set(k, !on)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${on ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" disabled={saving} onClick={saveContact}
              className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
              {saving ? t("cs.saving", "Saving…") : t("cs.saveContact", "Save contact")}
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("cs.cancel", "Cancel")}</button>
          </div>
        </div>
      ) : null}

      {/* ── empty state ── */}
      {!hasData && !editingId ? (
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)]/50 px-6 py-12 text-center text-sm text-[var(--text-faint)]">
          {t("cs.emptyState", "No communication intelligence yet — add the people you actually talk to, their channels, and WeChat QR codes to strengthen sourcing readiness.")}
        </div>
      ) : null}

      {/* ── contact cards, grouped by role hierarchy ── */}
      {grouped.map(({ cat, items }) => (
        <div key={cat} className="space-y-2.5">
          <SectionLabel>{t("opt." + cat, roleCategoryLabel(cat))}</SectionLabel>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {items.map((c) => {
              const id = str(c, "id");
              const chans = channelsFor(c);
              const qrs = qrByContact[id] ?? [];
              const isBoss = ["boss", "owner"].includes(str(c, "role_category"));
              return (
                <div key={id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
                  {/* ── header: avatar · name/role · actions ── */}
                  <div className="flex items-start gap-3 p-4">
                    {/* avatar — photo if present, else monogram */}
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[var(--bg-surface-subtle)] ring-1 ring-[var(--border-subtle)] flex items-center justify-center">
                      {str(c, "photo_url") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={str(c, "photo_url")} alt={str(c, "full_name")} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[13px] font-semibold text-[var(--text-secondary)]">{(str(c, "full_name").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || "?").toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isBoss ? <CrownIcon className="h-3.5 w-3.5 text-amber-500" /> : null}
                        <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{str(c, "full_name")}</span>
                        {str(c, "name_cn") ? <span lang="zh" className="text-[12px] text-[var(--text-faint)]">{str(c, "name_cn")}</span> : null}
                      </div>
                      <div className="mt-0.5 text-[12px] text-[var(--text-secondary)] truncate">
                        {[str(c, "position") || str(c, "role"), str(c, "department")].filter(Boolean).join(" · ") || t("opt." + cat, roleCategoryLabel(cat))}
                      </div>
                      {(isTrue(c, "is_primary") || isTrue(c, "is_decision_maker")) ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {isTrue(c, "is_primary") ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--accent,#0066FF)]/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--accent,#0066FF)]"><StarIcon className="h-2.5 w-2.5" />{t("cs.primary", "Primary")}</span>
                          ) : null}
                          {isTrue(c, "is_decision_maker") ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]"><UserCheckIcon className="h-2.5 w-2.5" />{t("cs.decision", "Decision maker")}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" title={t("cs.addQrForContact", "Add QR for this contact")} onClick={() => openQr(id)}
                        className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"><ScanLineIcon className="h-3.5 w-3.5" /></button>
                      <button type="button" title={t("cs.edit", "Edit")} onClick={() => openEdit(c)}
                        className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"><Edit3Icon className="h-3.5 w-3.5" /></button>
                      <button type="button" title={t("cs.archive", "Archive")} disabled={busyId === id} onClick={() => archiveContact(c)}
                        className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>

                  {/* ── channels — clean labeled rows, icon chip + label + value ── */}
                  {chans.length ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 border-t border-[var(--border-subtle)] px-4 py-3.5">
                      {chans.map((ch) => {
                        const pref = str(c, "preferred_channel") === ch.key;
                        const inner = (
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)]"><ChannelIcon k={ch.key} size={14} /></span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
                                {t("opt." + ch.key, channelLabel(ch.key))}
                                {pref ? <StarIcon className="h-2.5 w-2.5 text-[var(--accent,#0066FF)]" /> : null}
                              </span>
                              <span className="block truncate text-[12.5px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent,#0066FF)]">{ch.value}</span>
                            </span>
                          </span>
                        );
                        return ch.href ? (
                          <a key={ch.key} href={ch.href} target="_blank" rel="noopener noreferrer" className="group" title={t("opt." + ch.key, channelLabel(ch.key))}>{inner}</a>
                        ) : (
                          <div key={ch.key} title={t("opt." + ch.key, channelLabel(ch.key))}>{inner}</div>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* ── signals — labeled stat chips ── */}
                  {(str(c, "preferred_language") || str(c, "timezone") || str(c, "available_hours") || str(c, "response_speed") || str(c, "reliability")) ? (
                    <div className="flex flex-wrap gap-1.5 border-t border-[var(--border-subtle)] px-4 py-3">
                      {str(c, "preferred_language") ? <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface-subtle)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"><LanguagesIcon className="h-3 w-3 text-[var(--text-faint)]" />{str(c, "preferred_language")}</span> : null}
                      {str(c, "timezone") ? <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface-subtle)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"><GlobeIcon className="h-3 w-3 text-[var(--text-faint)]" />{str(c, "timezone")}</span> : null}
                      {str(c, "available_hours") || (typeof c.available_hours === "object" && c.available_hours) ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface-subtle)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"><ClockIcon className="h-3 w-3 text-[var(--text-faint)]" />{typeof c.available_hours === "object" && c.available_hours ? String((c.available_hours as Row).text ?? "") : str(c, "available_hours")}</span>
                      ) : null}
                      {str(c, "response_speed") ? <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface-subtle)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"><ZapIcon className="h-3 w-3 text-amber-500" />{str(c, "response_speed")}</span> : null}
                      {str(c, "reliability") ? <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"><ShieldCheckIcon className="h-3 w-3" />{t("opt." + str(c, "reliability"), RELIABILITY_LABELS[str(c, "reliability")] ?? str(c, "reliability"))} {t("cs.reliabilitySuffix", "reliability")}</span> : null}
                    </div>
                  ) : null}

                  {/* ── notes ── */}
                  {str(c, "notes") ? (
                    <div className="border-t border-[var(--border-subtle)] px-4 py-3">
                      <p className="text-[11.5px] leading-relaxed text-[var(--text-secondary)]">{str(c, "notes")}</p>
                    </div>
                  ) : null}

                  {/* ── per-contact QR strip ── */}
                  {qrs.length ? (
                    <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
                      {qrs.map((q) => <QrThumb key={str(q, "id")} q={q} busy={busyId === str(q, "id")} onRemove={() => removeQr(q)} t={t} />)}
                    </div>
                  ) : null}

                  {/* ── visibility footer ── */}
                  <div className="flex items-center gap-1 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/30 px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
                    <ShieldCheckIcon className="h-3 w-3" />{t("opt." + str(c, "visibility_tier"), VISIBILITY_LABELS[str(c, "visibility_tier")] ?? "Internal")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── supplier-level QR gallery ── */}
      {(qrByContact._supplier ?? []).length ? (
        <div className="space-y-2.5">
          <SectionLabel>{t("cs.qrGalleryTitle", "WeChat / WeCom QR codes")}</SectionLabel>
          <div className="flex flex-wrap gap-3">
            {qrByContact._supplier.map((q) => <QrThumb key={str(q, "id")} q={q} large busy={busyId === str(q, "id")} onRemove={() => removeQr(q)} t={t} />)}
          </div>
        </div>
      ) : null}

      {/* ── QR upload modal ── */}
      {qrOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !qrBusy && setQrOpen(false)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <ScanLineIcon className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="text-[14px] font-semibold text-[var(--text-primary)]">{t("cs.addCommunicationQr", "Add communication QR")}</span>
            </div>
            <Field label={t("cs.qrImage", "QR image")}>
              <input type="file" accept="image/*" onChange={(e) => setQrFile(e.target.files?.[0] ?? null)}
                className="block w-full text-[12px] text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--bg-surface-subtle)] file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-[var(--text-primary)]" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("cs.category", "Category")}>
                <select className={inputCls} value={qrCategory} onChange={(e) => setQrCategory(e.target.value)}>
                  {Object.keys(QR_CATEGORY_LABELS).map((k) => <option key={k} value={k}>{t("opt." + k, QR_CATEGORY_LABELS[k])}</option>)}
                </select>
              </Field>
              <Field label={t("cs.visibility", "Visibility")}>
                <select className={inputCls} value={qrVisibility} onChange={(e) => setQrVisibility(e.target.value)}>
                  {VISIBILITY_TIERS.map((tier) => <option key={tier} value={tier}>{t("opt." + tier, VISIBILITY_LABELS[tier])}</option>)}
                </select>
              </Field>
            </div>
            <Field label={t("cs.labelOptional", "Label (optional)")}><input className={inputCls} value={qrTitle} onChange={(e) => setQrTitle(e.target.value)} placeholder="e.g. Sales group · Lily" /></Field>
            {qrContactId ? <div className="text-[11px] text-[var(--text-faint)]">{t("cs.linkedToContact", "Linked to the selected contact.")}</div> : null}
            {qrErr ? <div className="text-[12px] text-rose-400">{qrErr}</div> : null}
            <div className="flex items-center gap-3">
              <button type="button" disabled={qrBusy} onClick={saveQr}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
                <UploadIcon className="h-3.5 w-3.5" />{qrBusy ? t("cs.uploading", "Uploading…") : t("cs.uploadQr", "Upload QR")}
              </button>
              <button type="button" onClick={() => setQrOpen(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("cs.cancel", "Cancel")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* a channel glyph */
const CHANNEL_BRAND: Record<string, string> = {
  whatsapp: "whatsapp", telegram: "telegram", wechat: "wechat", wecom: "wechat",
  line: "line", skype: "skype", qq: "qq",
};
function ChannelIcon({ k, size = 14 }: { k: string; size?: number }) {
  if (k === "email") return <EnvelopeIcon className="shrink-0" style={{ width: size, height: size }} />;
  if (k === "mobile" || k === "phone") return <PhoneIcon className="shrink-0" style={{ width: size, height: size }} />;
  if (CHANNEL_BRAND[k]) return <BrandGlyph name={CHANNEL_BRAND[k]} size={size} />;
  return <MessageSquareIcon className="shrink-0" style={{ width: size, height: size }} />;
}

/* a QR thumbnail tile with label, category, download + remove */
function QrThumb({ q, large, busy, onRemove, t }: { q: Row; large?: boolean; busy: boolean; onRemove: () => void; t: (key: string, fallback?: string) => string }) {
  const url = str(q, "preview_url") || str(q, "file_url");
  const size = large ? "h-28 w-28" : "h-16 w-16";
  return (
    <div className="group relative">
      <div className={`${size} overflow-hidden rounded-xl bg-white ring-1 ring-[var(--border-subtle)]`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt={str(q, "title") || "QR"} className="h-full w-full object-contain" /> : null}
      </div>
      <div className="mt-1 max-w-[7rem] truncate text-center text-[10px] font-medium text-[var(--text-secondary)]">
        {str(q, "title") || t("opt." + str(q, "category"), qrCategoryLabel(str(q, "category")))}
      </div>
      <div className="text-center text-[9px] uppercase tracking-wide text-[var(--text-faint)]">{t("opt." + str(q, "category"), qrCategoryLabel(str(q, "category")))}</div>
      <div className="absolute right-0.5 top-0.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {str(q, "file_url") ? (
          <a href={str(q, "file_url")} download target="_blank" rel="noopener noreferrer"
            className="rounded-md bg-[var(--bg-surface)]/90 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" title={t("cs.download", "Download")}><DownloadIcon className="h-3 w-3" /></a>
        ) : null}
        <button type="button" disabled={busy} onClick={onRemove}
          className="rounded-md bg-[var(--bg-surface)]/90 p-1 text-[var(--text-secondary)] hover:text-rose-400 disabled:opacity-40" title={t("cs.remove", "Remove")}><TrashIcon className="h-3 w-3" /></button>
      </div>
    </div>
  );
}
