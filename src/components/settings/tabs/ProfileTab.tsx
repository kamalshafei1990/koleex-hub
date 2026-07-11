"use client";

/* Settings → Profile.

   Self-service profile editor. Everything here writes to the caller's OWN
   records through routes that enforce "editing self OR Accounts-admin", so
   there's no new privilege surface:

     · people row      → PATCH /api/people/[id]   (name, title, contact, address)
     · avatar          → updateAccountAvatar       (accounts.avatar_url)
     · pronouns/links   → accounts.preferences.profile (JSON bag, no migration)

   Work identity (role, department, employee no., dates) is shown read-only —
   it stays admin-managed, we only surface it so the profile feels complete. */

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
  const [form, setForm] = useState<PeopleForm>(() => peopleFrom(account));
  const [prof, setProf] = useState<ProfilePrefs>(
    () => withDefaults(account.preferences).profile as ProfilePrefs,
  );
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
  const peopleDirty = (Object.keys(form) as (keyof PeopleForm)[]).some((k) => form[k] !== base[k]);
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
        if (!personId) { setError("No linked profile record to update."); return; }
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
          setError(j.error || `Save failed (${res.status})`);
          return;
        }
      }
      if (profDirty) {
        // Send ONLY the profile slice; the server merges it onto the rest.
        const ok = await updateAccountPreferences(account.id, { profile: prof });
        if (!ok) { setError("Couldn't save pronouns / links."); return; }
      }
      setToast("Profile updated");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(file: File) {
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Image too large — max 8 MB."); return; }
    setUploadingAvatar(true); setError(null);
    try {
      const dataUrl = await resizeToDataUrl(file);
      const ok = await updateAccountAvatar(account.id, dataUrl);
      if (!ok) { setError("Couldn't save the photo. Please try again."); return; }
      setToast("Photo updated");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo upload failed");
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    setUploadingAvatar(true);
    const ok = await updateAccountAvatar(account.id, null);
    setUploadingAvatar(false);
    if (!ok) { setError("Couldn't remove the photo."); return; }
    setToast("Photo removed");
    onChanged();
  }

  const roleLine = account.role?.name || capitalize(account.user_type);

  return (
    <div className="space-y-4 pb-2">
      <IdentitySourceNote text="Your name, contact, and address are one shared person record — the same details also shown in the Accounts app and your HR profile. Editing here updates them everywhere." />

      {/* ── Identity ── */}
      <Card title="Identity" subtitle="How you appear across the hub.">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="group relative h-20 w-20 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden hover:border-[var(--border-focus)] transition-colors disabled:opacity-60"
            title="Change photo"
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
            <p className="text-[13px] text-[var(--text-primary)] font-medium">Profile photo</p>
            <p className="text-[11px] text-[var(--text-dim)] mt-0.5">PNG, JPG, or WebP. Square works best.</p>
            {avatarUrl && (
              <button type="button" onClick={removePhoto} disabled={uploadingAvatar} className="mt-2 text-[11px] text-red-400 hover:text-red-300">
                Remove photo
              </button>
            )}
          </div>
        </div>

        <Grid>
          <Field label="Full name" icon={<UserIcon size={14} />} value={form.full_name} onChange={set("full_name")} placeholder="Your legal / full name" />
          <Field label="Preferred name" value={form.display_name} onChange={set("display_name")} placeholder="What people call you" />
          <Field label="Name in native script" value={form.name_alt} onChange={set("name_alt")} placeholder="الاسم / 姓名" dir="auto" />
          <Field label="Job title" icon={<BriefcaseIcon size={14} />} value={form.job_title} onChange={set("job_title")} placeholder="e.g. Operations Manager" />
          <Field label="Pronouns" value={prof.pronouns ?? ""} onChange={(v) => setProf((p) => ({ ...p, pronouns: v }))} placeholder="e.g. he/him" />
          <Select label="Preferred language" icon={<GlobeIcon size={14} />} value={form.language} onChange={set("language")}
            options={[{ v: "", l: "Not set" }, { v: "en", l: "English" }, { v: "ar", l: "العربية" }, { v: "zh", l: "中文" }]} />
        </Grid>

        <div className="mt-4">
          <TextArea label="About" value={form.notes} onChange={set("notes")} placeholder="A short line about your role or focus — shown on your profile card." />
        </div>
      </Card>

      {/* ── Contact & address ── */}
      <Card title="Contact & address">
        <Grid>
          <Field label="Personal phone" icon={<PhoneIcon size={14} />} value={form.phone} onChange={set("phone")} type="tel" placeholder="+1 234 567 890" />
          <Field label="Mobile" icon={<PhoneIcon size={14} />} value={form.mobile} onChange={set("mobile")} type="tel" placeholder="Cell number" />
        </Grid>
        <div className="mt-4">
          <Field label="Personal email" icon={<EnvelopeIcon size={14} />} value={form.email} onChange={set("email")} type="email" placeholder="your-personal@example.com" />
        </div>

        {/* Links */}
        <p className="mt-6 mb-2 text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-1.5"><LinkIcon size={13} /> Links</p>
        <Grid>
          <Field label="LinkedIn" value={prof.links?.linkedin ?? ""} onChange={setLink("linkedin")} placeholder="linkedin.com/in/…" />
          <Field label="Website" value={prof.links?.website ?? ""} onChange={setLink("website")} placeholder="https://…" />
          <Field label="WeChat ID" icon={<MessageSquareIcon size={14} />} value={prof.links?.wechat ?? ""} onChange={setLink("wechat")} placeholder="wechat-id" />
          <Field label="WhatsApp" icon={<MessageSquareIcon size={14} />} value={prof.links?.whatsapp ?? ""} onChange={setLink("whatsapp")} placeholder="+1 234 567 890" />
        </Grid>

        {/* Address */}
        <p className="mt-6 mb-2 text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-1.5"><MapPinIcon size={13} /> Address</p>
        <AddressAutocomplete
          label="Search address"
          placeholder="Start typing an address…"
          hint="Picks fill country / province / city below."
          onSelect={(g) => setForm((f) => ({
            ...f,
            address_line1: g.formatted || f.address_line1,
            country: g.country || f.country,
            state: g.province || f.state,
            city: g.city || f.city,
          }))}
        />
        <div className="mt-3 space-y-4">
          <Field label="Address line 1" value={form.address_line1} onChange={set("address_line1")} placeholder="Street address" />
          <Field label="Address line 2" value={form.address_line2} onChange={set("address_line2")} placeholder="Apt, suite, unit (optional)" />
          <Grid>
            <Field label="City" value={form.city} onChange={set("city")} />
            <Field label="State / province" value={form.state} onChange={set("state")} />
            <Field label="Country" value={form.country} onChange={set("country")} />
            <Field label="Postal code" value={form.postal_code} onChange={set("postal_code")} />
          </Grid>
        </div>

        <p className="mt-5 text-[11px] text-[var(--text-faint)]">
          Username, login email, password, role, and HR data are managed by your administrator.
        </p>
      </Card>

      {/* ── Work identity (read-only) ── */}
      <Card title="Work identity" subtitle="Managed by your administrator — shown here for reference.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
          <ReadRow icon={<ShieldIcon className="h-3.5 w-3.5" />} label="Role" value={roleLine} badge={account.is_super_admin ? "Super Admin" : undefined} />
          <ReadRow icon={<AtSignIcon size={14} />} label="Username" value={account.username ? `@${account.username}` : null} />
          <ReadRow icon={<BriefcaseIcon size={14} />} label="Department" value={account.employee?.department} />
          <ReadRow icon={<BriefcaseIcon size={14} />} label="Position" value={account.employee?.position} />
          <ReadRow icon={<IdCardIcon size={14} />} label="Employee no." value={account.employee?.employee_number} />
          <ReadRow icon={<CalendarIcon size={14} />} label="Hire date" value={fmtDate(account.employee?.hire_date)} />
          <ReadRow icon={<EnvelopeIcon size={14} />} label="Work email" value={account.employee?.work_email || account.login_email} />
          <ReadRow icon={<PhoneIcon size={14} />} label="Work phone" value={account.employee?.work_phone} />
          <ReadRow icon={<CalendarIcon size={14} />} label="Account created" value={fmtDate(account.created_at)} />
          <ReadRow icon={<CalendarIcon size={14} />} label="Last sign-in" value={fmtDateTime(account.last_login_at)} />
        </div>
      </Card>

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
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── building blocks ─────────────── */

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
      <h2 className="text-[14px] font-bold text-[var(--text-primary)]">{title}</h2>
      {subtitle && <p className="text-[12px] text-[var(--text-dim)] mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

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
  label, icon, value, onChange, placeholder, type = "text", dir,
}: {
  label: string; icon?: React.ReactNode; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; dir?: "auto" | "ltr" | "rtl";
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
        className="w-full h-10 px-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-focus)] transition-colors resize-y"
      />
    </div>
  );
}

function Select({ label, icon, value, onChange, options }: {
  label: string; icon?: React.ReactNode; value: string; onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div>
      <Label icon={icon}>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
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
      <span className="min-w-0 text-right text-[13px] text-[var(--text-primary)] truncate flex items-center gap-2 justify-end">
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
