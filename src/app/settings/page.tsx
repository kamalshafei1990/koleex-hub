"use client";

/* ---------------------------------------------------------------------------
   /settings — self-service account settings.

   Deliberately narrower than the admin Accounts app. Exposes only what
   a regular user can change about themselves:

     - Profile photo
     - Display name + personal phone + personal email
     - Preferences (language / theme / notifications / signature)
     - Calendar (timezone / working hours / default meeting length / OOO)

   Locked away on purpose (admin-only, in /accounts/[id]):
     - Username
     - Login email
     - Password       ← super-admin-only per policy
     - Role / permissions / access rights
     - Status, tenant, company, user_type
     - HR data (hire date, salary, bank, visa, passport, etc.)

   Everything writes through endpoints that already enforce
   "editingSelf OR super_admin", so there's no new privilege surface.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/admin/AuthGate";
import PageHeader from "@/components/ui/PageHeader";
import SettingsIcon from "@/components/icons/SettingsIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import CalendarIcon from "@/components/icons/ui/CalendarRawIcon";
import BellIcon from "@/components/icons/ui/BellIcon";
import { useCurrentAccount, notifyIdentityChanged } from "@/lib/identity";
import { updateAccountAvatar } from "@/lib/accounts-admin";
import PreferencesTab from "@/components/admin/accounts/tabs/PreferencesTab";
import CalendarTab from "@/components/admin/accounts/tabs/CalendarTab";
import DisplayTab from "@/components/settings/tabs/DisplayTab";
import RegionTab from "@/components/settings/tabs/RegionTab";
import AboutTab from "@/components/settings/tabs/AboutTab";
import NotificationsTab from "@/components/settings/tabs/NotificationsTab";
import LoginHistoryTab from "@/components/settings/tabs/LoginHistoryTab";
import PrivacyTab from "@/components/settings/tabs/PrivacyTab";
import PasswordTab from "@/components/settings/tabs/PasswordTab";
import KeyIcon from "@/components/icons/ui/KeyIcon";
import StampSignatureTab from "@/components/settings/tabs/StampSignatureTab";
import AdminTab from "@/components/settings/tabs/AdminTab";
import PaletteIcon from "@/components/icons/ui/PaletteIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
import FileBadge2Icon from "@/components/icons/ui/FileBadge2Icon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import type { AccountWithLinks } from "@/types/supabase";

type Tab = "profile" | "preferences" | "calendar" | "display" | "region" | "notifications" | "password" | "security" | "privacy" | "assets" | "admin" | "about";

type SectionDef = {
  id: Tab; label: string; subtitle: string;
  icon: React.ReactNode; node: React.ReactNode;
};

export default function SettingsPage() {
  return (
    <AuthGate
      title="Settings"
      subtitle="System configuration and your account"
    >
      <SettingsContent />
    </AuthGate>
  );
}

/* Small chevron used for the iOS-style disclosure rows. */
function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/* ---------------------------------------------------------------------------
   Settings shell — iOS / iPadOS style.

     · iPad / desktop (md+): two-pane master-detail. A left "sidebar" with the
       account card + grouped disclosure rows, and a right detail pane that
       renders the selected section. The selected row stays highlighted.
     · iPhone / mobile: a single grouped list. Tapping a row "pushes" to the
       section (back chevron in the header returns to the list), mirroring the
       iOS Settings navigation.

   Sections are unchanged (Profile / Preferences / Calendar) — this is a
   layout-only reshape. Monochrome tiles per the Koleex brand; the accent is
   reserved for the active back control.
   --------------------------------------------------------------------------- */
function SettingsContent() {
  const { account, refresh } = useCurrentAccount();
  const { data: boot } = useMeBootstrap();
  const isSA = !!boot?.isSuperAdmin;
  const [tab, setTab] = useState<Tab>("profile");
  /* Mobile only: false → show the list, true → show the pushed detail. */
  const [mobileDetail, setMobileDetail] = useState(false);

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  const onChanged = () => { notifyIdentityChanged(); refresh(); };
  const openSection = (t: Tab) => { setTab(t); setMobileDetail(true); };

  const person = account.person;
  const avatarUrl = account.avatar_url || person?.avatar_url || null;
  const displayName = person?.full_name || account.username || "—";
  const initials = (person?.full_name || account.username || "")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLine = account.role?.name || capitalize(account.user_type);

  const sections: SectionDef[] = [
    {
      id: "profile", label: "Profile", subtitle: "Photo, name, contact",
      icon: <UserIcon size={15} />,
      node: <ProfileSection account={account} onChanged={onChanged} />,
    },
    {
      id: "preferences", label: "Preferences", subtitle: "Language, theme, notifications",
      icon: <Settings2Icon className="h-3.5 w-3.5" />,
      node: <PreferencesTab account={account} onChanged={onChanged} />,
    },
    {
      id: "calendar", label: "Calendar", subtitle: "Timezone, hours, availability",
      icon: <CalendarIcon className="h-3.5 w-3.5" />,
      node: <CalendarTab account={account} onChanged={onChanged} />,
    },
    {
      id: "display", label: "Display & accessibility", subtitle: "Text size, motion, contrast",
      icon: <PaletteIcon className="h-3.5 w-3.5" />,
      node: <DisplayTab account={account} onChanged={onChanged} />,
    },
    {
      id: "region", label: "Language & region", subtitle: "Date, time, number formats",
      icon: <GlobeIcon className="h-3.5 w-3.5" />,
      node: <RegionTab account={account} onChanged={onChanged} />,
    },
    {
      id: "notifications", label: "Notification preferences", subtitle: "Channels and per-activity",
      icon: <BellIcon className="h-3.5 w-3.5" />,
      node: <NotificationsTab account={account} onChanged={onChanged} />,
    },
    {
      id: "password", label: "Password", subtitle: "Change your password",
      icon: <KeyIcon className="h-3.5 w-3.5" />,
      node: <PasswordTab account={account} />,
    },
    {
      id: "security", label: "Login history", subtitle: "Recent sign-ins",
      icon: <LockIcon className="h-3.5 w-3.5" />,
      node: <LoginHistoryTab account={account} />,
    },
    {
      id: "privacy", label: "Privacy & data", subtitle: "Download your data",
      icon: <ShieldIcon className="h-3.5 w-3.5" />,
      node: <PrivacyTab account={account} />,
    },
    /* Super-admin-only sections. */
    ...(isSA ? [
      {
        id: "assets" as Tab, label: "Signature & stamp", subtitle: "Company seal for documents",
        icon: <FileBadge2Icon className="h-3.5 w-3.5" />,
        node: <StampSignatureTab account={account} />,
      },
      {
        id: "admin" as Tab, label: "Admin tools", subtitle: "Activity, roles, accounts",
        icon: <ShieldIcon className="h-3.5 w-3.5" />,
        node: <AdminTab account={account} />,
      },
    ] : []),
    {
      id: "about", label: "About", subtitle: "Version, device, support",
      icon: <InfoIcon className="h-3.5 w-3.5" />,
      node: <AboutTab account={account} />,
    },
  ];
  const active = sections.find((s) => s.id === tab) ?? sections[0];
  const byId = (id: Tab) => sections.find((s) => s.id === id)!;
  const personalItems = (["profile", "preferences", "calendar"] as Tab[]).map(byId);
  const displayItems = (["display", "region"] as Tab[]).map(byId);
  const notificationsItem = byId("notifications");
  const securityItems = (["password", "security", "privacy"] as Tab[]).map(byId);
  const workspaceItems = isSA ? (["assets"] as Tab[]).map(byId) : [];
  const adminItems = isSA ? (["admin"] as Tab[]).map(byId) : [];
  const aboutItems = (["about"] as Tab[]).map(byId);

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full max-w-[100vw]">
      {/* Canonical Koleex app header — identical to every other app.
          Shares the body's max-width + padding so the title aligns with the
          master list below and the whole page fills the desktop viewport. */}
      <div className="shrink-0 w-full mx-auto max-w-[1600px] px-4 md:px-6 pt-4 sm:pt-5">
        <PageHeader
          title="Settings"
          subtitle="Your profile, preferences, and calendar defaults"
          icon={<SettingsIcon className="h-5 w-5" />}
          backHref="/"
        />
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        <div className="mx-auto max-w-[1600px] h-full px-4 md:px-6 py-5 md:grid md:grid-cols-[320px_minmax(0,1fr)] md:gap-8">

          {/* Master list — sidebar on iPad, full screen on iPhone. */}
          <aside className={`${mobileDetail ? "hidden" : "block"} md:block h-full overflow-y-auto no-scrollbar space-y-4`}>
            {/* Account card (Apple-ID style) */}
            <button
              type="button"
              onClick={() => openSection("profile")}
              className="w-full flex items-center gap-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 text-left hover:border-[var(--border-focus)] transition-colors"
            >
              <span className="h-12 w-12 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[15px] font-semibold text-[var(--text-dim)]">{initials || "·"}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[var(--text-primary)] truncate">{displayName}</span>
                <span className="block text-[11px] text-[var(--text-dim)] truncate">{roleLine} · @{account.username}</span>
              </span>
              <Chevron className="text-[var(--text-faint)] shrink-0" />
            </button>

            {/* Personal */}
            <MasterGroup label="Personal" items={personalItems} activeTab={tab} mobileDetail={mobileDetail} onOpen={openSection} />

            {/* Display */}
            <MasterGroup label="Display" items={displayItems} activeTab={tab} mobileDetail={mobileDetail} onOpen={openSection} />

            {/* Notifications — preferences (in-pane) + link to the push page. */}
            <div>
              <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider px-3 mb-1.5">Notifications</p>
              <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
                <SettingsRow
                  active={!mobileDetail && tab === "notifications"}
                  onClick={() => openSection("notifications")}
                  icon={notificationsItem.icon}
                  label={notificationsItem.label}
                  subtitle={notificationsItem.subtitle}
                />
                <SettingsRow
                  href="/settings/notifications"
                  icon={<BellIcon className="h-3.5 w-3.5" />}
                  label="Push notifications"
                  subtitle="Devices and alerts"
                  isLast
                />
              </div>
            </div>

            {/* Security */}
            <MasterGroup label="Security" items={securityItems} activeTab={tab} mobileDetail={mobileDetail} onOpen={openSection} />

            {/* Workspace (super-admin) */}
            {workspaceItems.length > 0 && (
              <MasterGroup label="Workspace" items={workspaceItems} activeTab={tab} mobileDetail={mobileDetail} onOpen={openSection} />
            )}

            {/* Admin (super-admin) */}
            {adminItems.length > 0 && (
              <MasterGroup label="Admin" items={adminItems} activeTab={tab} mobileDetail={mobileDetail} onOpen={openSection} />
            )}

            {/* About */}
            <MasterGroup label="About" items={aboutItems} activeTab={tab} mobileDetail={mobileDetail} onOpen={openSection} />
          </aside>

          {/* Detail pane */}
          <main className={`${mobileDetail ? "block" : "hidden"} md:block h-full overflow-y-auto no-scrollbar`}>
            {/* Mobile-only back to the settings list (iOS push nav). */}
            <button
              type="button"
              onClick={() => setMobileDetail(false)}
              className="md:hidden mb-3 -ml-1 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--accent-blue,#0066FF)]"
            >
              <Chevron className="rotate-180" /> All settings
            </button>
            {/* Fill the detail pane on desktop; cap only so ultra-wide
                monitors don't stretch forms to unreadable line lengths. */}
            <div className="max-w-[1040px] pb-8">
              {active.node}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Grouped master-list block ─────────────── */

function MasterGroup({
  label, items, activeTab, mobileDetail, onOpen,
}: {
  label: string; items: SectionDef[]; activeTab: Tab;
  mobileDetail: boolean; onOpen: (t: Tab) => void;
}) {
  return (
    <div>
      <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider px-3 mb-1.5">{label}</p>
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
        {items.map((s, i) => (
          <SettingsRow
            key={s.id}
            active={!mobileDetail && activeTab === s.id}
            onClick={() => onOpen(s.id)}
            icon={s.icon}
            label={s.label}
            subtitle={s.subtitle}
            isLast={i === items.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────── iOS-style disclosure row ─────────────── */

function SettingsRow({
  active, onClick, href, icon, label, subtitle, isLast,
}: {
  active?: boolean; onClick?: () => void; href?: string;
  icon: React.ReactNode; label: string; subtitle?: string; isLast?: boolean;
}) {
  const inner = (
    <>
      <span
        className={`h-8 w-8 rounded-[10px] flex items-center justify-center shrink-0 border transition-colors ${
          active
            ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
            : "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)]"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-[var(--text-primary)] truncate">{label}</span>
        {subtitle && <span className="block text-[11px] text-[var(--text-dim)] truncate">{subtitle}</span>}
      </span>
      <Chevron className="text-[var(--text-faint)] shrink-0" />
    </>
  );
  const cls = `w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
    active ? "bg-[var(--bg-surface-subtle)]" : "hover:bg-[var(--bg-surface-subtle)]"
  } ${!isLast ? "border-b border-[var(--border-faint)]" : ""}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* ─────────────── Profile section ─────────────── */

function ProfileSection({
  account, onChanged,
}: {
  account: AccountWithLinks;
  onChanged: () => void;
}) {
  /* Everything here writes to the caller's own records through
     routes that enforce editingSelf-OR-super_admin. */
  const person = account.person;
  const [displayName, setDisplayName] = useState(person?.full_name ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(person?.full_name ?? "");
    setPhone(person?.phone ?? "");
    setEmail(person?.email ?? "");
  }, [person]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const avatarUrl = account.avatar_url || person?.avatar_url || null;
  const initials = useMemo(() => {
    const name = person?.full_name || account.username || "";
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }, [person?.full_name, account.username]);

  const dirty =
    displayName !== (person?.full_name ?? "") ||
    phone !== (person?.phone ?? "") ||
    email !== (person?.email ?? "");

  async function save() {
    if (!person?.id) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/people/${person.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: displayName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error || `Save failed (${res.status})`);
        return;
      }
      setToast("Profile updated");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image too large — max 8 MB.");
      return;
    }
    setUploadingAvatar(true); setError(null);
    try {
      const dataUrl = await resizeToDataUrl(file);
      const ok = await updateAccountAvatar(account.id, dataUrl);
      if (!ok) {
        setError("Couldn't save the photo. Please try again.");
        return;
      }
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

  return (
    <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
      <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-1">Profile</h2>
      <p className="text-[12px] text-[var(--text-dim)] mb-5">
        How you appear across the hub.
      </p>

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
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handlePhoto(f);
            }}
          />
        </button>
        <div>
          <p className="text-[13px] text-[var(--text-primary)] font-medium">Profile photo</p>
          <p className="text-[11px] text-[var(--text-dim)] mt-0.5">PNG, JPG, or WebP. Square works best.</p>
          {avatarUrl && (
            <button
              type="button"
              onClick={removePhoto}
              disabled={uploadingAvatar}
              className="mt-2 text-[11px] text-red-400 hover:text-red-300"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <Field
          label="Display name"
          icon={<UserIcon size={14} />}
          value={displayName}
          onChange={setDisplayName}
          placeholder="Your name as shown across the hub"
        />
        <Field
          label="Personal phone"
          icon={<PhoneIcon size={14} />}
          value={phone}
          onChange={setPhone}
          type="tel"
          placeholder="+1 234 567 890"
        />
        <Field
          label="Personal email"
          icon={<EnvelopeIcon size={14} />}
          value={email}
          onChange={setEmail}
          type="email"
          placeholder="your-personal@example.com"
        />
        <p className="text-[11px] text-[var(--text-faint)]">
          Username, login email, password, role, and HR data are managed by your administrator.
        </p>
      </div>

      {/* Status + save */}
      <div className="mt-5 pt-4 border-t border-[var(--border-faint)] flex items-center justify-end gap-3">
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
    </section>
  );
}

function Field({
  label, icon, value, onChange, placeholder, type = "text",
}: {
  label: string; icon: React.ReactNode;
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
        <span className="inline-flex items-center gap-1.5">{icon} {label}</span>
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
      />
    </div>
  );
}

/* Image resize — same crop-to-square logic AccountDetail uses so
   avatars stay under ~30 KB as data URLs. The sync triggers mirror
   the value into people.avatar_url so every avatar surface picks
   it up. */
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
        const sourceSide = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - sourceSide) / 2;
        const sy = (img.naturalHeight - sourceSide) / 2;
        ctx.drawImage(img, sx, sy, sourceSide, sourceSide, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
