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
     │ [Employee]  [Contact]  [Company]  [Calendar]  ← stat buttons │
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

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  KeyRound,
  PowerOff,
  Power,
  UserCircle2,
  Copy,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
  Shield,
  LayoutGrid,
  Settings2,
  Calendar as CalendarIcon,
  Lock,
  FileText,
  Briefcase,
} from "lucide-react";
import {
  fetchAccountWithLinks,
  setAccountStatus,
  resetAccountPassword,
  setForcePasswordChange,
  generateTemporaryPassword,
} from "@/lib/accounts-admin";
import type {
  AccountWithLinks,
  AccountStatus,
  AccountPermissionOverrideRow,
  AccountPreferences,
  EmployeeRow,
  CustomerLevel,
} from "@/types/supabase";

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

  useEffect(() => {
    (async () => {
      const a = await fetchAccountWithLinks(accountId);
      setData(a);
      setLoading(false);
    })();
  }, [accountId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const tabs: TabDef[] = useMemo(() => {
    const isInternal = data?.user_type === "internal";
    return [
      { key: "overview", label: "Overview", icon: LayoutGrid },
      { key: "access", label: "Access Rights", icon: Shield },
      { key: "preferences", label: "Preferences", icon: Settings2 },
      { key: "calendar", label: "Calendar", icon: CalendarIcon },
      { key: "private", label: "Private", icon: Lock, hidden: !isInternal },
      { key: "security", label: "Security", icon: KeyRound },
      { key: "notes", label: "Notes", icon: FileText },
    ];
  }, [data?.user_type]);

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
        next === "active" ? "Account activated." : "Account deactivated.",
      );
    } else {
      setError("Could not update account status.");
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
      setToast("Temporary password reset. Copy it and share securely.");
    } else {
      setError("Could not reset the password.");
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
          ? "Force password change on next login."
          : "Force password change cleared.",
      );
    } else {
      setError("Could not update the flag.");
    }
  }

  function copyNewPw() {
    if (!newTempPw) return;
    navigator.clipboard?.writeText(newTempPw).catch(() => {});
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
        <div className="max-w-[1100px] mx-auto px-4 md:px-6 lg:px-8 py-8">
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
          <p className="text-[var(--text-dim)] mb-4">Account not found.</p>
          <Link
            href="/accounts"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to accounts
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
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6 md:mb-8 gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/accounts"
              className="h-9 w-9 shrink-0 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
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
              <KeyRound className="h-4 w-4" /> Reset Password
            </button>
            <button
              onClick={handleToggleForce}
              disabled={working}
              className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all disabled:opacity-60"
              title={
                data.force_password_change
                  ? "Clear the force-password-change flag"
                  : "Require user to change password on next login"
              }
            >
              <RefreshCcw className="h-4 w-4" />
              {data.force_password_change
                ? "Clear Force Reset"
                : "Force Password Reset"}
            </button>
            <button
              onClick={handleToggleStatus}
              disabled={working}
              className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all disabled:opacity-60"
            >
              {isActive ? (
                <>
                  <PowerOff className="h-4 w-4" /> Deactivate
                </>
              ) : (
                <>
                  <Power className="h-4 w-4" /> Activate
                </>
              )}
            </button>
            <Link
              href={`/accounts/${data.id}/edit`}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </div>
        </div>

        {toast && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 px-4 py-3 text-[13px] flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{toast}</span>
          </div>
        )}
        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {newTempPw && (
          <div className="mb-5 rounded-xl border border-[var(--border-focus)] bg-[var(--bg-surface)] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">
                New Temporary Password
              </p>
              <p className="text-[14px] font-mono text-[var(--text-primary)] mt-1">
                {newTempPw}
              </p>
              <p className="text-[11px] text-[var(--text-dim)] mt-1">
                The user will be forced to change this on their next login.
              </p>
            </div>
            <button
              onClick={copyNewPw}
              className="h-9 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
        )}

        {/* ── Identity banner ── */}
        <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6 mb-4">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="h-20 w-20 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden shrink-0">
              {person?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person.avatar_url}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserCircle2 className="h-10 w-10 text-[var(--text-dim)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusRibbon status={data.status} />
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]">
                  {data.user_type}
                </span>
                {role && (
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] flex items-center gap-1.5">
                    <Shield className="h-3 w-3" />
                    {role.name}
                  </span>
                )}
                {customerLevel && (
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${levelColors[customerLevel]}`}
                  >
                    {customerLevel}
                  </span>
                )}
              </div>
              {person?.job_title && (
                <p className="text-[13px] text-[var(--text-muted)] mt-3 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-[var(--text-dim)]" />
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
                  <AlertCircle className="h-3.5 w-3.5" />
                  No linked contact record. Edit this account to link one.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Stat buttons row ── */}
        <div className="mb-4">
          <StatButtons account={data} />
        </div>

        {/* ── Tab navigation ── */}
        <div className="sticky top-0 z-10 -mx-4 md:mx-0 px-4 md:px-0 bg-[var(--bg-primary)]/80 backdrop-blur mb-4">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border-subtle)]">
            {tabs
              .filter((t) => !t.hidden)
              .map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={`shrink-0 h-11 px-4 text-[12px] font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 -mb-px transition-colors ${
                      active
                        ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                        : "border-transparent text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
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
          Created {new Date(data.created_at).toLocaleString()} · Updated{" "}
          {new Date(data.updated_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
