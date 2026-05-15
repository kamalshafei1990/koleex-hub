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
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import SettingsIcon from "@/components/icons/SettingsIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import CalendarIcon from "@/components/icons/ui/CalendarRawIcon";
import BuildingIcon from "@/components/icons/ui/BuildingIcon";
import { useCurrentAccount, notifyIdentityChanged } from "@/lib/identity";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import { updateAccountAvatar } from "@/lib/accounts-admin";
import PreferencesTab from "@/components/admin/accounts/tabs/PreferencesTab";
import CalendarTab from "@/components/admin/accounts/tabs/CalendarTab";
import PaymentTermsManager from "@/components/settings/PaymentTermsManager";
import type { AccountWithLinks } from "@/types/supabase";

type Tab = "profile" | "preferences" | "calendar" | "workspace";

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

function SettingsContent() {
  const { account, refresh } = useCurrentAccount();
  /* Read is_super_admin straight off the bootstrap payload — same
     source useScopeContext reads from, but synchronous once the
     bootstrap has resolved. Avoids the extra hop through
     useScopeContext's internal useState which was rendering the
     hook in null state for too long, hiding the Workspace tab. */
  const { data: bootstrap } = useMeBootstrap();
  const isSuperAdmin = bootstrap?.auth?.is_super_admin ?? false;
  /* Default tab: System-Workspace for super-admins (the page is now
     system-first), Profile for everyone else. The bootstrap may not
     be ready on first render, so we also re-target the tab once it
     resolves — useEffect below. */
  const [tab, setTab] = useState<Tab>(isSuperAdmin ? "workspace" : "profile");
  useEffect(() => {
    if (isSuperAdmin && tab === "profile") {
      /* Bootstrap resolved after first render — switch the default
         to Workspace if the operator hasn't already picked a tab. */
      setTab("workspace");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      {/* Header */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 pt-5 pb-1">
            <Link
              href="/"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                <SettingsIcon className="h-4 w-4" />
              </div>
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
                System Settings
              </h1>
            </div>
          </div>
          <p className="text-[12px] text-[var(--text-dim)] mb-4 ml-0 md:ml-11">
            {isSuperAdmin
              ? "Workspace-wide configuration — payment terms, master data, document defaults — plus your own profile."
              : <>Your profile, preferences, and calendar defaults. Signed in as <span className="text-[var(--text-primary)] font-medium">@{account.username}</span>.</>}
          </p>

          {/* Tabs — System group first (super-admin only), then My
              Account group everyone sees. A small visual divider
              between the two groups keeps the system / personal
              boundary obvious at a glance. */}
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {isSuperAdmin && (
              <>
                <span className="hidden md:inline-flex pl-1 pr-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                  System
                </span>
                <TabButton active={tab === "workspace"} onClick={() => setTab("workspace")} icon={<BuildingIcon size={14} />} label="Workspace" />
                <span className="mx-2 h-5 w-px bg-[var(--border-subtle)]" aria-hidden />
                <span className="hidden md:inline-flex pl-1 pr-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                  My Account
                </span>
              </>
            )}
            <TabButton active={tab === "profile"} onClick={() => setTab("profile")} icon={<UserIcon size={14} />} label="Profile" />
            <TabButton active={tab === "preferences"} onClick={() => setTab("preferences")} icon={<Settings2Icon className="h-3.5 w-3.5" />} label="Preferences" />
            <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon={<CalendarIcon className="h-3.5 w-3.5" />} label="Calendar" />
          </nav>
        </div>
      </div>

      {/* Body — wider when on a System tab (the master-data grids
          want the room); 900px column on My-Account tabs since those
          are form-shaped and read better at that width. */}
      <div className="flex-1 overflow-y-auto">
        <div className={`mx-auto px-4 md:px-6 lg:px-8 py-6 w-full space-y-4 ${tab === "workspace" ? "max-w-[1500px]" : "max-w-[900px]"}`}>
          {tab === "profile" && (
            <ProfileSection
              account={account}
              onChanged={() => { notifyIdentityChanged(); refresh(); }}
            />
          )}
          {tab === "preferences" && (
            <PreferencesTab
              account={account}
              onChanged={() => { notifyIdentityChanged(); refresh(); }}
            />
          )}
          {tab === "calendar" && (
            <CalendarTab
              account={account}
              onChanged={() => { notifyIdentityChanged(); refresh(); }}
            />
          )}
          {tab === "workspace" && isSuperAdmin && (
            <PaymentTermsManager isSuperAdmin={isSuperAdmin} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Tab button ─────────────── */

function TabButton({
  active, onClick, icon, label,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-4 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-2 shrink-0 ${
        active
          ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
          : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
      }`}
    >
      {icon}
      {label}
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
