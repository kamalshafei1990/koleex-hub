"use client";

/* Settings → Profile.

   ACCESS POLICY (access-architecture vision): employee identity data is
   COMPANY data. Identity/contact/address fields are EDITABLE only when the
   caller's role can edit Employees or Accounts (GET /api/me/can-edit-profile,
   same rule the server enforces on PATCH /api/people/[id]) — everyone else
   sees them read-only with a "maintained by HR" note. Personal touches stay
   self-service for everyone:

     · avatar          → updateAccountAvatar       (accounts.avatar_url)
     · pronouns/links   → accounts.preferences.profile (JSON bag, no migration)

   Work identity (role, department, employee no., dates) is always read-only. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import { withDefaults } from "@/lib/access-control";
import type { ProfilePrefs } from "@/lib/access-control";
import { updateAccountAvatar, updateAccountPreferences } from "@/lib/accounts-admin";
import AddressAutocomplete from "@/components/suppliers/AddressAutocomplete";
import IdentitySourceNote from "@/components/ui/IdentitySourceNote";
import UserIcon from "@/components/icons/ui/UserIcon";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import LinkIcon from "@/components/icons/ui/LinkIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import IdCardIcon from "@/components/icons/ui/IdCardIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import CalendarIcon from "@/components/icons/ui/CalendarRawIcon";
import AtSignIcon from "@/components/icons/ui/AtSignIcon";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";
import { SettingsCard } from "@/components/settings/tabs/ui";

/* ── State shape ── */
interface PeopleForm {
  full_name: string;
  display_name: string;
  name_alt: string;
  job_title: string;
  phone: string;
  mobile: string;
  email: string;
  notes: string;
  language: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
}

function peopleFrom(account: AccountWithLinks): PeopleForm {
  const p = account.person;
  return {
    full_name: p?.full_name ?? "",
    display_name: p?.display_name ?? "",
    name_alt: p?.name_alt ?? "",
    job_title: p?.job_title ?? "",
    phone: p?.phone ?? "",
    mobile: p?.mobile ?? "",
    email: p?.email ?? "",
    notes: p?.notes ?? "",
    language: p?.language ?? "",
    address_line1: p?.address_line1 ?? "",
    address_line2: p?.address_line2 ?? "",
    city: p?.city ?? "",
    state: p?.state ?? "",
    country: p?.country ?? "",
    postal_code: p?.postal_code ?? "",
  };
}

export default function ProfileTab({
  account, onChanged,
}: {
  account: AccountWithLinks;
  onChanged: () => void;
}) {
  const { t } = useTranslation(settingsT);
  const [form, setForm] = useState<PeopleForm>(() => peopleFrom(account));
  const [prof, setProf] = useState<ProfilePrefs>(
    () => withDefaults(account.preferences).profile as ProfilePrefs,
  );
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* May this user edit identity fields? Fail-closed: fields stay locked
     until the server says yes (same rule as PATCH /api/people/[id]). */
  const [canEditIdentity, setCanEditIdentity] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/can-edit-profile", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { allowed: false }))
      .then((j: { allowed?: boolean }) => { if (!cancelled) setCanEditIdentity(j.allowed === true); })
      .catch(() => { /* stay locked */ });
    return () => { cancelled = true; };
  }, []);

  /* Re-sync when the account refreshes (avatar save, prefs save elsewhere). */
  useEffect(() => { setForm(peopleFrom(account)); }, [account]);
  useEffect(() => {
    setProf(withDefaults(account.preferences).profile as ProfilePrefs);
  }, [account.preferences]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const avatarUrl = account.avatar_url || account.person?.avatar_url || null;
  const initials = useMemo(() => {
    const name = account.person?.full_name || account.username || "";
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }, [account.person?.full_name, account.username]);

  const set = (k: keyof PeopleForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setLink = (k: keyof NonNullable<ProfilePrefs["links"]>) => (v: string) =>
    setProf((p) => ({ ...p, links: { ...p.links, [k]: v } }));

  /* Dirty tracking — save only when something actually changed. */
  const base = useMemo(() => peopleFrom(account), [account]);
  const baseProf = useMemo(
    () => withDefaults(account.preferences).profile as ProfilePrefs,
    [account.preferences],
  );
  const peopleDirty =
    canEditIdentity &&
    (Object.keys(form) as (keyof PeopleForm)[]).some((k) => form[k] !== base[k]);
  const profDirty =
    (prof.pronouns ?? "") !== (baseProf.pronouns ?? "") ||
    (["linkedin", "website", "wechat", "whatsapp"] as const).some(
      (k) => (prof.links?.[k] ?? "") !== (baseProf.links?.[k] ?? ""),
    );
  const dirty = peopleDirty || profDirty;

  async function save() {
    const personId = account.person?.id;
    setSaving(true); setError(null);
    try {
      if (peopleDirty) {
        if (!personId) { setError(t("prof.noRecord")); return; }
        const res = await fetch(`/api/people/${personId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: form.full_name.trim() || null,
            display_name: form.display_name.trim() || null,
            name_alt: form.name_alt.trim() || null,
            job_title: form.job_title.trim() || null,
            phone: form.phone.trim() || null,
            mobile: form.mobile.trim() || null,
            email: form.email.trim() || null,
            notes: form.notes.trim() || null,
            language: form.language.trim() || null,
            address_line1: form.address_line1.trim() || null,
            address_line2: form.address_line2.trim() || null,
            city: form.city.trim() || null,
            state: form.state.trim() || null,
            country: form.country.trim() || null,
            postal_code: form.postal_code.trim() || null,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error || t("prof.saveFailed").replace("{code}", String(res.status)));
          return;
        }
      }
      if (profDirty) {
        // Send ONLY the profile slice; the server merges it onto the rest.
        const ok = await updateAccountPreferences(account.id, { profile: prof });
        if (!ok) { setError(t("prof.prefsFailed")); return; }
      }
      setToast(t("prof.saved"));
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(file: File) {
    if (!file.type.startsWith("image/")) { setError(t("prof.photo.notImage")); return; }
    if (file.size > 8 * 1024 * 1024) { setError(t("prof.photo.tooLarge")); return; }
    setUploadingAvatar(true); setError(null);
    try {
      const dataUrl = await resizeToDataUrl(file);
      const ok = await updateAccountAvatar(account.id, dataUrl);
      if (!ok) { setError(t("prof.photo.saveFailed")); return; }
      setToast(t("prof.photo.updated"));
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("prof.photo.uploadFailed"));
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    setUploadingAvatar(true);
    const ok = await updateAccountAvatar(account.id, null);
    setUploadingAvatar(false);
    if (!ok) { setError(t("prof.photo.removeFailed")); return; }
    setToast(t("prof.photo.removed"));
    onChanged();
  }

  const roleLine = account.role?.name || capitalize(account.user_type);

  const ro = !canEditIdentity; // read-only identity fields

  return (
    <div className="space-y-4 pb-2">
      <IdentitySourceNote
        text={
          canEditIdentity ? t("prof.note.editable") : t("prof.note.readonly")
        }
      />

      {/* ── Identity ── */}
      <SettingsCard title={t("prof.identity")} subtitle={t("prof.identity.sub")}>
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="group relative h-20 w-20 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden hover:border-[var(--border-focus)] transition-colors disabled:opacity-60"
            title={t("prof.photo.change")}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[22px] font-semibold text-[var(--text-dim)]">{initials || "·"}</span>
            )}
            {uploadingAvatar ? (
              <span className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <SpinnerIcon className="h-5 w-5 text-white animate-spin" />
              </span>
            ) : (
              <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <CameraIcon size={18} className="text-white" />
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePhoto(f); }}
            />
          </button>
          <div>
            <p className="text-[13px] text-[var(--text-primary)] font-medium">{t("prof.photo")}</p>
            <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{t("prof.photo.hint")}</p>
            {avatarUrl && (
              <button type="button" onClick={removePhoto} disabled={uploadingAvatar} className="mt-2 text-[11px] text-red-400 hover:text-red-300">
                {t("prof.photo.remove")}
              </button>
            )}
          </div>
        </div>

        <Grid>
          <Field label={t("prof.fullName")} icon={<UserIcon size={14} />} value={form.full_name} onChange={set("full_name")} placeholder={t("prof.fullName.ph")} disabled={ro} />
          <Field label={t("prof.preferredName")} value={form.display_name} onChange={set("display_name")} placeholder={t("prof.preferredName.ph")} disabled={ro} />
          <Field label={t("prof.nativeName")} value={form.name_alt} onChange={set("name_alt")} placeholder="الاسم / 姓名" dir="auto" disabled={ro} />
          <Field label={t("prof.jobTitle")} icon={<BriefcaseIcon size={14} />} value={form.job_title} onChange={set("job_title")} placeholder={t("prof.jobTitle.ph")} disabled={ro} />
          <Field label={t("prof.pronouns")} value={prof.pronouns ?? ""} onChange={(v) => setProf((p) => ({ ...p, pronouns: v }))} placeholder={t("prof.pronouns.ph")} />
          <Select label={t("prof.language")} icon={<GlobeIcon size={14} />} value={form.language} onChange={set("language")}
            options={[{ v: "", l: t("prof.language.notSet") }, { v: "en", l: "English" }, { v: "ar", l: "العربية" }, { v: "zh", l: "中文" }]} disabled={ro} />
        </Grid>

        <div className="mt-4">
          <TextArea label={t("prof.about")} value={form.notes} onChange={set("notes")} placeholder={t("prof.about.ph")} disabled={ro} />
        </div>
      </SettingsCard>

      {/* ── Contact & address ── */}
      <SettingsCard title={t("prof.contact")}>
        <Grid>
          <Field label={t("prof.phone")} icon={<PhoneIcon size={14} />} value={form.phone} onChange={set("phone")} type="tel" placeholder="+1 234 567 890" disabled={ro} />
          <Field label={t("prof.mobile")} icon={<PhoneIcon size={14} />} value={form.mobile} onChange={set("mobile")} type="tel" placeholder={t("prof.mobile.ph")} disabled={ro} />
        </Grid>
        <div className="mt-4">
          <Field label={t("prof.email")} icon={<EnvelopeIcon size={14} />} value={form.email} onChange={set("email")} type="email" placeholder="your-personal@example.com" disabled={ro} />
        </div>

        {/* Links */}
        <p className="mt-6 mb-2 text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-1.5"><LinkIcon size={13} /> {t("prof.links")}</p>
        <Grid>
          <Field label="LinkedIn" value={prof.links?.linkedin ?? ""} onChange={setLink("linkedin")} placeholder="linkedin.com/in/…" />
          <Field label={t("prof.website")} value={prof.links?.website ?? ""} onChange={setLink("website")} placeholder="https://…" />
          <Field label={t("prof.wechat")} icon={<MessageSquareIcon size={14} />} value={prof.links?.wechat ?? ""} onChange={setLink("wechat")} placeholder="wechat-id" />
          <Field label="WhatsApp" icon={<MessageSquareIcon size={14} />} value={prof.links?.whatsapp ?? ""} onChange={setLink("whatsapp")} placeholder="+1 234 567 890" />
        </Grid>

        {/* Address */}
        <p className="mt-6 mb-2 text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-1.5"><MapPinIcon size={13} /> {t("prof.address")}</p>
        {!ro && (
          <AddressAutocomplete
            label={t("prof.searchAddress")}
            placeholder={t("prof.searchAddress.ph")}
            hint={t("prof.searchAddress.hint")}
            onSelect={(g) => setForm((f) => ({
              ...f,
              address_line1: g.formatted || f.address_line1,
              country: g.country || f.country,
              state: g.province || f.state,
              city: g.city || f.city,
            }))}
          />
        )}
        <div className="mt-3 space-y-4">
          <Field label={t("prof.addr1")} value={form.address_line1} onChange={set("address_line1")} placeholder={t("prof.addr1.ph")} disabled={ro} />
          <Field label={t("prof.addr2")} value={form.address_line2} onChange={set("address_line2")} placeholder={t("prof.addr2.ph")} disabled={ro} />
          <Grid>
            <Field label={t("prof.city")} value={form.city} onChange={set("city")} disabled={ro} />
            <Field label={t("prof.state")} value={form.state} onChange={set("state")} disabled={ro} />
            <Field label={t("prof.country")} value={form.country} onChange={set("country")} disabled={ro} />
            <Field label={t("prof.postal")} value={form.postal_code} onChange={set("postal_code")} disabled={ro} />
          </Grid>
        </div>

        <p className="mt-5 text-[11px] text-[var(--text-faint)]">
          {ro ? t("prof.adminNote.ro") : t("prof.adminNote")}
        </p>
      </SettingsCard>

      {/* ── Work identity (read-only) ── */}
      <SettingsCard title={t("prof.work")} subtitle={t("prof.work.sub")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
          <ReadRow icon={<ShieldIcon className="h-3.5 w-3.5" />} label={t("prof.role")} value={roleLine} badge={account.is_super_admin ? t("prof.superAdmin") : undefined} />
          <ReadRow icon={<AtSignIcon size={14} />} label={t("prof.username")} value={account.username ? `@${account.username}` : null} />
          <ReadRow icon={<BriefcaseIcon size={14} />} label={t("prof.department")} value={account.employee?.department} />
          <ReadRow icon={<BriefcaseIcon size={14} />} label={t("prof.position")} value={account.employee?.position} />
          <ReadRow icon={<IdCardIcon size={14} />} label={t("prof.empNo")} value={account.employee?.employee_number} />
          <ReadRow icon={<CalendarIcon size={14} />} label={t("prof.hireDate")} value={fmtDate(account.employee?.hire_date)} />
          <ReadRow icon={<EnvelopeIcon size={14} />} label={t("prof.workEmail")} value={account.employee?.work_email || account.login_email} />
          <ReadRow icon={<PhoneIcon size={14} />} label={t("prof.workPhone")} value={account.employee?.work_phone} />
          <ReadRow icon={<CalendarIcon size={14} />} label={t("prof.created")} value={fmtDate(account.created_at)} />
          <ReadRow icon={<CalendarIcon size={14} />} label={t("prof.lastSignIn")} value={fmtDateTime(account.last_login_at)} />
        </div>
      </SettingsCard>

      {/* Status + save */}
      <div className="sticky bottom-0 -mx-1 px-1 pt-2 pb-1 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent">
        <div className="flex items-center justify-end gap-3">
          {error && <span className="text-[12px] text-red-400 flex-1">{error}</span>}
          {toast && !error && <span className="text-[12px] text-emerald-400 flex-1 flex items-center gap-1.5"><CheckIcon size={12} />{toast}</span>}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="h-10 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <CheckIcon size={14} />}
            {saving ? t("prof.saving") : t("prof.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── building blocks ─────────────── */

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function Label({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
      <span className="inline-flex items-center gap-1.5">{icon}{children}</span>
    </label>
  );
}

function Field({
  label, icon, value, onChange, placeholder, type = "text", dir, disabled,
}: {
  label: string; icon?: React.ReactNode; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; dir?: "auto" | "ltr" | "rtl"; disabled?: boolean;
}) {
  return (
    <div>
      <Label icon={icon}>{label}</Label>
      <input
        type={type}
        dir={dir}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-10 px-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-focus)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        disabled={disabled}
        className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-focus)] transition-colors resize-y disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function Select({ label, icon, value, onChange, options, disabled }: {
  label: string; icon?: React.ReactNode; value: string; onChange: (v: string) => void;
  options: { v: string; l: string }[]; disabled?: boolean;
}) {
  return (
    <div>
      <Label icon={icon}>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full h-10 px-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

/** One read-only "definition" row — skips itself entirely when empty. */
function ReadRow({ icon, label, value, badge }: {
  icon: React.ReactNode; label: string; value?: string | null; badge?: string;
}) {
  if (!value && !badge) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-[var(--border-faint)]">
      <span className="inline-flex items-center gap-2 text-[12px] text-[var(--text-dim)] shrink-0">
        <span className="text-[var(--text-faint)]">{icon}</span>{label}
      </span>
      <span className="min-w-0 text-end text-[13px] text-[var(--text-primary)] truncate flex items-center gap-2 justify-end">
        {value && <span className="truncate">{value}</span>}
        {badge && (
          <span className="shrink-0 rounded-full bg-[var(--accent-blue,#0066FF)]/15 text-[var(--accent-blue,#0066FF)] px-2 py-0.5 text-[10px] font-semibold">
            {badge}
          </span>
        )}
      </span>
    </div>
  );
}

/* ─────────────── helpers ─────────────── */

function capitalize(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* Image resize — crop-to-square, same logic AccountDetail uses so avatars
   stay small as data URLs. Sync triggers mirror the value into
   people.avatar_url so every avatar surface picks it up. */
function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not available")); return; }
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/webp", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
