"use client";

/* Profile — two halves. The top half is what HR holds about me (read-only
   here; HR changes it through the Employees app with an audit trail). The
   bottom half is what I keep current myself: how to reach me and who to
   call — the whitelist in me-hr-types is the whole editable surface. */

import { useState } from "react";
import type { MyHrBundle, MyProfilePatch } from "@/lib/me-hr-types";
import { COUNTRIES } from "@/lib/commercial-policy/countries";
import { cardCls, inputCls, primaryBtnCls, cancelBtnCls, fmtDate, FieldLabel, makeTranslationHelpers } from "@/components/hr/shared";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import { meFetch, type MeTabProps } from "./shared";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">{label}</dt>
      <dd className="mt-0.5 text-[14px] text-[var(--text-primary)] truncate">{value || "—"}</dd>
    </div>
  );
}

const countryName = (code: string | null) => {
  if (!code) return null;
  const c = COUNTRIES.find((x) => x.code === code);
  return c ? `${c.flag} ${c.name}` : code;
};

type Draft = Required<{ [K in keyof MyProfilePatch]: string }>;

const draftFrom = (b: MyHrBundle): Draft => ({
  phone: b.person.phone ?? "", mobile: b.person.mobile ?? "",
  address_line1: b.person.addressLine1 ?? "", address_line2: b.person.addressLine2 ?? "",
  city: b.person.city ?? "", country: b.person.country ?? "",
  wechat_id: b.contacts.wechatId ?? "",
  emergency_contact_name: b.contacts.emergency1.name ?? "", emergency_contact_phone: b.contacts.emergency1.phone ?? "", emergency_contact_relationship: b.contacts.emergency1.relationship ?? "",
  emergency_contact2_name: b.contacts.emergency2.name ?? "", emergency_contact2_phone: b.contacts.emergency2.phone ?? "", emergency_contact2_relationship: b.contacts.emergency2.relationship ?? "",
});

function EditForm({ initial, t, onCancel, onSaved }: {
  initial: Draft; t: MeTabProps["t"]; onCancel: () => void; onSaved: (d: Draft) => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Draft, v: string) => setD((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError(null);
    /* Only what changed goes over the wire — a PATCH, not a snapshot. */
    const patch: MyProfilePatch = {};
    for (const k of Object.keys(d) as (keyof Draft)[]) if (d[k] !== initial[k]) patch[k] = d[k] || null;
    if (Object.keys(patch).length === 0) { setSaving(false); onCancel(); return; }
    const res = await meFetch<{ ok: true }>("/api/me/hr/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    setSaving(false);
    if (!res.ok) { setError(t("hr.me.error")); return; }
    onSaved(d);
  };

  const field = (k: keyof Draft, label: string, type = "text") => (
    <div><FieldLabel>{label}</FieldLabel><input type={type} value={d[k]} onChange={(e) => set(k, e.target.value)} className={inputCls} /></div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("phone", t("hr.phone"), "tel")}
        {field("mobile", t("hr.me.mobile"), "tel")}
        {field("wechat_id", t("hr.me.wechat"))}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("hr.me.address")}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("address_line1", t("hr.me.address"))}
        {field("address_line2", t("hr.me.address2"))}
        {field("city", t("hr.me.city"))}
        <div>
          <FieldLabel>{t("hr.me.country")}</FieldLabel>
          <select value={d.country} onChange={(e) => set("country", e.target.value)} className={inputCls}>
            <option value="">—</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("hr.me.emergency1")}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {field("emergency_contact_name", t("hr.emergencyName"))}
        {field("emergency_contact_phone", t("hr.emergencyPhone"), "tel")}
        {field("emergency_contact_relationship", t("hr.me.relationship"))}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("hr.me.emergency2")}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {field("emergency_contact2_name", t("hr.emergencyName"))}
        {field("emergency_contact2_phone", t("hr.emergencyPhone"), "tel")}
        {field("emergency_contact2_relationship", t("hr.me.relationship"))}
      </div>
      {error && <p className="text-[12px] text-[#FF3333]">{error}</p>}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className={cancelBtnCls}>{t("hr.cancel")}</button>
        <button type="button" onClick={save} disabled={saving} className={`${primaryBtnCls} inline-flex items-center gap-2`}>{saving && <SpinnerIcon size={13} />} {t("hr.save")}</button>
      </div>
    </div>
  );
}

export default function Profile({ bundle, setBundle, t }: MeTabProps) {
  const { tEmpType } = makeTranslationHelpers(t);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const { employee, person, contacts } = bundle;

  const onSaved = (d: Draft) => {
    setBundle((prev) => ({
      ...prev,
      person: { ...prev.person, phone: d.phone || null, mobile: d.mobile || null, addressLine1: d.address_line1 || null, addressLine2: d.address_line2 || null, city: d.city || null, country: d.country || null },
      contacts: {
        ...prev.contacts, wechatId: d.wechat_id || null,
        emergency1: { name: d.emergency_contact_name || null, phone: d.emergency_contact_phone || null, relationship: d.emergency_contact_relationship || null },
        emergency2: { name: d.emergency_contact2_name || null, phone: d.emergency_contact2_phone || null, relationship: d.emergency_contact2_relationship || null },
      },
    }));
    setEditing(false);
    setSaved(true);
  };

  const emergency = (c: { name: string | null; phone: string | null; relationship: string | null }) =>
    c.name ? [c.name, c.relationship, c.phone].filter(Boolean).join(" · ") : null;

  return (
    <div className="space-y-4">
      <section className={`${cardCls} p-5 md:p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("hr.me.profile.hrOwned")}</h3>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
          <Row label={t("hr.name")} value={person.nameAlt ? `${person.fullName} · ${person.nameAlt}` : person.fullName} />
          <Row label={t("hr.me.employeeNumber")} value={employee.employeeNumber} />
          <Row label={t("hr.me.status")} value={employee.employmentStatus} />
          <Row label={t("hr.me.department")} value={employee.departmentName} />
          <Row label={t("hr.me.position")} value={employee.positionTitle} />
          <Row label={t("hr.me.manager")} value={employee.managerName} />
          <Row label={t("hr.me.hireDate")} value={employee.hireDate ? fmtDate(employee.hireDate) : null} />
          <Row label={t("hr.me.employmentType")} value={employee.employmentType ? tEmpType(employee.employmentType) : null} />
          <Row label={t("hr.me.workLocation")} value={employee.workLocation} />
          <Row label={t("hr.me.workEmail")} value={contacts.workEmail} />
          <Row label={t("hr.me.workPhone")} value={contacts.workPhone} />
          <Row label={t("hr.email")} value={person.email} />
        </dl>
        <p className="mt-4 text-[12px] text-[var(--text-faint)]">{t("hr.me.profile.hrOwnedHint")}</p>
      </section>

      <section className={`${cardCls} p-5 md:p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("hr.me.profile.mine")}</h3>
          {!editing && (
            <button type="button" onClick={() => { setEditing(true); setSaved(false); }} className="h-9 px-3 rounded-lg inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors">
              <PencilIcon size={13} /> {t("hr.edit")}
            </button>
          )}
        </div>
        {editing ? (
          <EditForm initial={draftFrom(bundle)} t={t} onCancel={() => setEditing(false)} onSaved={onSaved} />
        ) : (
          <>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              <Row label={t("hr.phone")} value={person.phone} />
              <Row label={t("hr.me.mobile")} value={person.mobile} />
              <Row label={t("hr.me.wechat")} value={contacts.wechatId} />
              <Row label={t("hr.me.address")} value={[person.addressLine1, person.addressLine2].filter(Boolean).join(", ") || null} />
              <Row label={t("hr.me.city")} value={person.city} />
              <Row label={t("hr.me.country")} value={countryName(person.country)} />
              <Row label={t("hr.me.emergency1")} value={emergency(contacts.emergency1)} />
              <Row label={t("hr.me.emergency2")} value={emergency(contacts.emergency2)} />
            </dl>
            {saved && <p className="mt-4 text-[12px] text-[#00CC66]">{t("hr.me.saved")}</p>}
          </>
        )}
      </section>
    </div>
  );
}
