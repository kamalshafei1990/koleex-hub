"use client";

/* ---------------------------------------------------------------------------
   AccountDetail v2 — tabbed account profile view (Odoo-inspired structure,
   Koleex Hub design system).

   Layout:
     ┌─────────────────────────────────────────────────────────────┐
     │ [← Back]           {display name}   [Reset PW] [Force] [Edit]│
     │                    @username · email                         │
     ├─────────────────────────────────────────────────────────────┤
     │ Avatar | Status ribbon · Type · Role badge · Customer level  │
     ├─────────────────────────────────────────────────────────────┤
     │ [Employee]  [Contact]  [Company]  [CalendarRawIcon]  ← stat buttons │
     ├─────────────────────────────────────────────────────────────┤
     │ Overview | Access Rights | Preferences | Calendar | Private |│
     │  Notes                                                       │
     ├─────────────────────────────────────────────────────────────┤
     │ {active tab content}                                         │
     └─────────────────────────────────────────────────────────────┘

   Tabs:
     - Overview       — read-only identity + contact + company + employee + role
     - Access Rights  — per-module permission overrides on top of the role preset
     - Preferences    — language, theme, signature, notifications (prefs.jsonb)
     - Calendar       — timezone, working hours, OOO, default meeting length
     - Private        — private HR data (koleex_employees, internal accounts only)
     - Notes          — admin-only internal notes
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import KeyIcon from "@/components/icons/ui/KeyIcon";
import ToggleOffIcon from "@/components/icons/ui/ToggleOffIcon";
import PowerIcon from "@/components/icons/ui/PowerIcon";
import UserCircle2Icon from "@/components/icons/ui/UserCircle2Icon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import RefreshCcwIcon from "@/components/icons/ui/RefreshCcwIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import CalendarIcon from "@/components/icons/ui/CalendarRawIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import {
  fetchAccountWithLinks,
  setAccountStatus,
  resetAccountPassword,
  setForcePasswordChange,
  generateTemporaryPassword,
  updateAccountAvatar,
} from "@/lib/accounts-admin";
import { notifyIdentityChanged } from "@/lib/identity";
import type {
  AccountWithLinks,
  AccountStatus,
  AccountPermissionOverrideRow,
  AccountPreferences,
  EmployeeRow,
  CustomerLevel,
} from "@/types/supabase";

import { useTranslation } from "@/lib/i18n";
import { accountsT } from "@/lib/translations/accounts";
import StatusRibbon from "./StatusRibbon";
import StatButtons from "./StatButtons";
import OverviewTab from "./tabs/OverviewTab";
import AccessRightsTab from "./tabs/AccessRightsTab";
import PreferencesTab from "./tabs/PreferencesTab";
import CalendarTab from "./tabs/CalendarTab";
import PrivateTab from "./tabs/PrivateTab";
import SecurityTab from "./tabs/SecurityTab";
import NotesTab from "./tabs/NotesTab";

const levelColors: Record<CustomerLevel, string> = {
  silver: "bg-slate-400/15 text-slate-300 border-slate-400/25",
  gold: "bg-amber-400/15 text-amber-300 border-amber-400/25",
  platinum: "bg-sky-400/15 text-sky-300 border-sky-400/25",
  diamond: "bg-fuchsia-400/15 text-fuchsia-300 border-fuchsia-400/25",
};

type TabKey =
  | "overview"
  | "access"
  | "preferences"
  | "calendar"
  | "private"
  | "security"
  | "notes";

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  hidden?: boolean;
}

interface Props {
  accountId: string;
}

export default function AccountDetail({ accountId }: Props) {
  const [data, setData] = useState<AccountWithLinks | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [newTempPw, setNewTempPw] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useTranslation(accountsT);

  useEffect(() => {
    (async () => {
      const a = await fetchAccountWithLinks(accountId);
      setData(a);
      setLoading(false);
    })();
  }, [accountId]);

  useEffect(() => {
    if (!toast) return;
    const tid = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(tid);
  }, [toast]);

  const tabs: TabDef[] = useMemo(() => {
    const isInternal = data?.user_type === "internal";
    return [
      { key: "overview", label: t("acc.tab.overview"), icon: LayoutGridIcon },
      { key: "access", label: t("acc.tab.access"), icon: ShieldIcon },
      { key: "preferences", label: t("acc.tab.preferences"), icon: Settings2Icon },
      { key: "calendar", label: t("acc.tab.calendar"), icon: CalendarIcon },
      { key: "private", label: t("acc.tab.private"), icon: LockIcon, hidden: !isInternal },
      { key: "security", label: t("acc.tab.security"), icon: KeyIcon },
      { key: "notes", label: t("acc.tab.notes"), icon: DocumentIcon },
    ];
  }, [data?.user_type, t]);

  async function handleToggleStatus() {
    if (!data) return;
    const next: AccountStatus =
      data.status === "active" ? "inactive" : "active";
    setWorking(true);
    const ok = await setAccountStatus(data.id, next);
    setWorking(false);
    if (ok) {
      setData({ ...data, status: next });
      setToast(
        next === "active" ? t("acc.msg.activated") : t("acc.msg.deactivated"),
      );
    } else {
      setError(t("acc.err.statusFailed"));
    }
  }

  async function handleResetPassword() {
    if (!data) return;
    const pw = generateTemporaryPassword();
    setWorking(true);
    const ok = await resetAccountPassword(data.id, pw);
    setWorking(false);
    if (ok) {
      setNewTempPw(pw);
      setData({ ...data, force_password_change: true });
      setToast(t("acc.msg.passwordReset"));
    } else {
      setError(t("acc.err.passwordFailed"));
    }
  }

  async function handleToggleForce() {
    if (!data) return;
    const next = !data.force_password_change;
    setWorking(true);
    const ok = await setForcePasswordChange(data.id, next);
    setWorking(false);
    if (ok) {
      setData({ ...data, force_password_change: next });
      setToast(
        next
          ? t("acc.msg.forceEnabled")
          : t("acc.msg.forceCleared"),
      );
    } else {
      setError(t("acc.err.flagFailed"));
    }
  }

  function copyNewPw() {
    if (!newTempPw) return;
    navigator.clipboard?.writeText(newTempPw).catch(() => {});
  }

  /* ---- Avatar upload ---------------------------------------------------- */

  /**
   * Load a File into an HTMLImageElement, center-crop to a square, scale to
   * 256×256, and return a JPEG data URL at ~0.85 quality. Keeps payloads well
   * under 30 KB so we can store the result directly in `accounts.avatar_url`
   * as TEXT without needing a Storage bucket.
   */
  function resizeImageToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(t("acc.err.readFile")));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error(t("acc.err.decodeImage")));
        img.onload = () => {
          const size = 256;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error(t("acc.err.canvasNotAvailable")));
            return;
          }
          /* center-crop to square then scale */
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

  async function handleAvatarChange(file: File) {
    if (!data) return;
    if (!file.type.startsWith("image/")) {
      setError(t("acc.err.avatarImage"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError(t("acc.err.avatarTooLarge"));
      return;
    }
    setUploadingAvatar(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const ok = await updateAccountAvatar(data.id, dataUrl);
      if (!ok) {
        setError(t("acc.err.avatarSaveFailed"));
        return;
      }
      setData({ ...data, avatar_url: dataUrl });
      setToast(t("acc.msg.avatarUpdated"));
      notifyIdentityChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("acc.err.avatarProcess"));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    if (!data) return;
    setUploadingAvatar(true);
    const ok = await updateAccountAvatar(data.id, null);
    setUploadingAvatar(false);
    if (!ok) {
      setError(t("acc.err.avatarRemoveFailed"));
      return;
    }
    setData({ ...data, avatar_url: null });
    setToast(t("acc.msg.avatarRemoved"));
    notifyIdentityChanged();
  }

  /** Called by child tabs to patch the loaded account in memory. */
  function handleOverridesChanged(overrides: AccountPermissionOverrideRow[]) {
    if (!data) return;
    setData({ ...data, overrides });
  }
  function handlePreferencesChanged(preferences: AccountPreferences) {
    if (!data) return;
    setData({ ...data, preferences });
  }
  function handleEmployeeChanged(employee: EmployeeRow) {
    if (!data) return;
    setData({ ...data, employee });
  }
  function handleNotesChanged(internal_notes: string | null) {
    if (!data) return;
    setData({ ...data, internal_notes });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-[var(--bg-surface-subtle)] rounded" />
            <div className="h-40 bg-[var(--bg-surface-subtle)] rounded-2xl" />
            <div className="h-64 bg-[var(--bg-surface-subtle)] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-dim)] mb-4">{t("acc.detail.accountNotFound")}</p>
          <Link
            href="/accounts"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeftIcon className="h-4 w-4" /> {t("acc.btn.backToAccounts")}
          </Link>
        </div>
      </div>
    );
  }

  const { person, role } = data;
  const isActive = data.status === "active";
  const displayName = person?.full_name || data.username;
  const customerLevel = data.company?.customer_level || null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6 md:mb-8 gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/accounts"
              className="h-9 w-9 shrink-0 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl md:text-[26px] font-bold text-[var(--text-primary)] truncate">
                {displayName}
              </h1>
              <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mt-0.5">
                @{data.username} · {data.login_email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleResetPassword}
              disabled={working}
              className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all disabled:opacity-60"
            >
              <KeyIcon className="h-4 w-4" /> {t("acc.action.resetPassword")}
            </button>
            <button
              onClick={handleToggleForce}
              disabled={working}
              className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all disabled:opacity-60"
              title={
                data.force_password_change
                  ? t("acc.detail.clearForceHint")
                  : t("acc.detail.forceHint")
              }
            >
              <RefreshCcwIcon className="h-4 w-4" />
              {data.force_password_change
                ? t("acc.action.clearForceReset")
                : t("acc.action.forcePasswordReset")}
            </button>
            <button
              onClick={handleToggleStatus}
              disabled={working}
              className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all disabled:opacity-60"
            >
              {isActive ? (
                <>
                  <ToggleOffIcon className="h-4 w-4" /> {t("acc.action.deactivate")}
                </>
              ) : (
                <>
                  <PowerIcon className="h-4 w-4" /> {t("acc.action.activate")}
                </>
              )}
            </button>
            <Link
              href={`/accounts/${data.id}/edit`}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg"
            >
              <PencilIcon className="h-4 w-4" /> {t("acc.action.edit")}
            </Link>
          </div>
        </div>

        {toast && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 px-4 py-3 text-[13px] flex items-start gap-2">
            <CheckCircleIcon className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{toast}</span>
          </div>
        )}
        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
            <ExclamationIcon className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {newTempPw && (
          <div className="mb-5 rounded-xl border border-[var(--border-focus)] bg-[var(--bg-surface)] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">
                {t("acc.tempPw.title")}
              </p>
              <p className="text-[14px] font-mono text-[var(--text-primary)] mt-1">
                {newTempPw}
              </p>
              <p className="text-[11px] text-[var(--text-dim)] mt-1">
                {t("acc.tempPw.hint")}
              </p>
            </div>
            <button
              onClick={copyNewPw}
              className="h-9 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5"
            >
              <CopyIcon className="h-3.5 w-3.5" /> {t("acc.btn.copy")}
            </button>
          </div>
        )}

        {/* ── Identity banner ── */}
        <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6 mb-4">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="group relative h-20 w-20 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden hover:border-[var(--border-focus)] transition-colors disabled:opacity-60"
                title={
                  data.avatar_url || person?.avatar_url
                    ? t("acc.detail.changeAvatar")
                    : t("acc.detail.uploadAvatar")
                }
              >
                {data.avatar_url || person?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.avatar_url || person?.avatar_url || ""}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserCircle2Icon className="h-10 w-10 text-[var(--text-dim)]" />
                )}
                <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingAvatar ? (
                    <SpinnerIcon className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <CameraIcon className="h-5 w-5 text-white" />
                  )}
                </span>
                {uploadingAvatar && (
                  <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <SpinnerIcon className="h-5 w-5 text-white animate-spin" />
                  </span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleAvatarChange(f);
                }}
              />
              {data.avatar_url && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  disabled={uploadingAvatar}
                  className="text-[11px] text-[var(--text-dim)] hover:text-red-300 flex items-center gap-1 disabled:opacity-60"
                >
                  <TrashIcon className="h-3 w-3" /> {t("acc.btn.remove")}
                </button>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusRibbon status={data.status} />
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]">
                  {t(`acc.type.${data.user_type}`)}
                </span>
                {role && (
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] flex items-center gap-1.5">
                    <ShieldIcon className="h-3 w-3" />
                    {role.name}
                  </span>
                )}
                {customerLevel && (
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${levelColors[customerLevel]}`}
                  >
                    {t(`acc.level.${customerLevel}`)}
                  </span>
                )}
              </div>
              {person?.job_title && (
                <p className="text-[13px] text-[var(--text-muted)] mt-3 flex items-center gap-1.5">
                  <BriefcaseIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                  {person.job_title}
                  {data.company?.name && (
                    <span className="text-[var(--text-dim)]">
                      · {data.company.name}
                    </span>
                  )}
                </p>
              )}
              {!person && (
                <p className="text-[12px] text-amber-300/80 mt-3 flex items-center gap-1.5">
                  <ExclamationIcon className="h-3.5 w-3.5" />
                  {t("acc.detail.noContact")}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Stat buttons row ── */}
        <div className="mb-4">
          <StatButtons account={data} onTabChange={(tab) => setActiveTab(tab as TabKey)} />
        </div>

        {/* ── Tab navigation ── */}
        <div className="sticky top-0 z-10 -mx-4 md:mx-0 px-4 md:px-0 bg-[var(--bg-primary)]/80 backdrop-blur mb-4">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border-subtle)]">
            {tabs
              .filter((tab) => !tab.hidden)
              .map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`shrink-0 h-11 px-4 text-[12px] font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 -mb-px transition-colors ${
                      active
                        ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                        : "border-transparent text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
          </div>
        </div>

        {/* ── Tab body ── */}
        <div className="pb-10">
          {activeTab === "overview" && <OverviewTab account={data} />}
          {activeTab === "access" && (
            <AccessRightsTab
              account={data}
              onChanged={handleOverridesChanged}
            />
          )}
          {activeTab === "preferences" && (
            <PreferencesTab
              account={data}
              onChanged={handlePreferencesChanged}
            />
          )}
          {activeTab === "calendar" && (
            <CalendarTab
              account={data}
              onChanged={handlePreferencesChanged}
            />
          )}
          {activeTab === "private" && (
            <PrivateTab account={data} onChanged={handleEmployeeChanged} />
          )}
          {activeTab === "security" && <SecurityTab account={data} />}
          {activeTab === "notes" && (
            <NotesTab account={data} onChanged={handleNotesChanged} />
          )}
        </div>

        {/* Meta */}
        <p className="text-[11px] text-[var(--text-ghost)] px-1 pb-6">
          {t("acc.detail.createdAt")} {new Date(data.created_at).toLocaleString()} · {t("acc.detail.updatedAt")} {new Date(data.updated_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
