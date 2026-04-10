"use client";

/* ---------------------------------------------------------------------------
   AccountDetail v2 — Identity system profile view.

   Shows the full picture of an account by fetching it + all linked records
   (person, company, role, preset, employee) in one call via
   fetchAccountWithLinks. Cards are grouped by concern:

     1. Identity        — avatar, full name, job title, status pills
     2. Login Identity  — username, login email, flags (2FA, force reset)
     3. Person Profile  — contact info + address from the linked person record
     4. Company         — company name, type, customer level, country, currency
     5. Employee        — HR record (only when the account has one)
     6. Role & Access   — role name + access preset flags + placeholder note
     7. Notes           — admin-only internal notes
     8. Meta            — timestamps

   Actions:
     - Edit
     - Reset Password   (generates a new temporary password, forces change)
     - Force Password Reset toggle
     - Activate / Deactivate
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Pencil, KeyRound, PowerOff, Power, UserCircle2, Mail, Phone,
  Building2, Shield, Globe, Flag, Clock, CheckCircle2, Copy, AlertCircle,
  RefreshCcw, AtSign, Briefcase, MapPin, Languages, Layers, FileText,
  Smartphone,
} from "lucide-react";
import {
  fetchAccountWithLinks, setAccountStatus,
  resetAccountPassword, setForcePasswordChange, generateTemporaryPassword,
} from "@/lib/accounts-admin";
import type {
  AccountWithLinks, AccountStatus, CustomerLevel,
} from "@/types/supabase";

const statusColors: Record<AccountStatus, string> = {
  active:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  pending:   "bg-amber-500/15 text-amber-400 border-amber-500/25",
  inactive:  "bg-zinc-500/15 text-zinc-300 border-zinc-500/25",
  suspended: "bg-red-500/15 text-red-300 border-red-500/25",
};

const levelColors: Record<CustomerLevel, string> = {
  silver:   "bg-slate-400/15 text-slate-300 border-slate-400/25",
  gold:     "bg-amber-400/15 text-amber-300 border-amber-400/25",
  platinum: "bg-sky-400/15 text-sky-300 border-sky-400/25",
  diamond:  "bg-fuchsia-400/15 text-fuchsia-300 border-fuchsia-400/25",
};

const priceLevelForCustomerLevel: Record<CustomerLevel, string> = {
  silver:   "Price Level 1",
  gold:     "Price Level 2",
  platinum: "Price Level 3",
  diamond:  "Price Level 4",
};

const cardWrap =
  "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";

const cardTitle =
  "text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-4 flex items-center gap-2";

interface Props {
  accountId: string;
}

export default function AccountDetail({ accountId }: Props) {
  const [data, setData] = useState<AccountWithLinks | null>(null);
  const [loading, setLoading] = useState(true);

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

  async function handleToggleStatus() {
    if (!data) return;
    const next: AccountStatus = data.status === "active" ? "inactive" : "active";
    setWorking(true);
    const ok = await setAccountStatus(data.id, next);
    setWorking(false);
    if (ok) {
      setData({ ...data, status: next });
      setToast(next === "active" ? "Account activated." : "Account deactivated.");
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
      setToast(next ? "Force password change on next login." : "Force password change cleared.");
    } else {
      setError("Could not update the flag.");
    }
  }

  function copyNewPw() {
    if (!newTempPw) return;
    navigator.clipboard?.writeText(newTempPw).catch(() => {});
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="max-w-[1000px] mx-auto px-4 md:px-6 lg:px-8 py-8">
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

  const { person, company, role, preset, employee } = data;
  const isActive = data.status === "active";
  const displayName = person?.full_name || data.username;
  const customerLevel = company?.customer_level || null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1000px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
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
              title={data.force_password_change ? "Clear the force-password-change flag" : "Require user to change password on next login"}
            >
              <RefreshCcw className="h-4 w-4" />
              {data.force_password_change ? "Clear Force Reset" : "Force Password Reset"}
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

        <div className="space-y-5">

          {/* ── 1. Identity card ── */}
          <section className={cardWrap}>
            <div className="flex items-start gap-5 flex-wrap">
              <div className="h-20 w-20 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
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
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${statusColors[data.status]}`}
                  >
                    {data.status}
                  </span>
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
                  </p>
                )}
                {!person && (
                  <p className="text-[12px] text-amber-300/80 mt-3 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    No linked person record. Edit this account to link a contact.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── 2. Login Identity ── */}
          <section className={cardWrap}>
            <h2 className={cardTitle}>
              <KeyRound className="h-3.5 w-3.5" />
              Login Identity
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField
                icon={<AtSign className="h-3.5 w-3.5" />}
                label="Username"
                value={<span className="font-mono">@{data.username}</span>}
              />
              <InfoField
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Login Email"
                value={data.login_email}
              />
              <InfoField
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Last Login"
                value={data.last_login_at ? new Date(data.last_login_at).toLocaleString() : "Never"}
              />
              <InfoField
                icon={<Shield className="h-3.5 w-3.5" />}
                label="2FA"
                value={data.two_factor_enabled ? "Enabled" : "Disabled"}
              />
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex items-center gap-2 flex-wrap">
              {data.force_password_change && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-amber-500/15 text-amber-300 border-amber-500/25">
                  Force Password Change
                </span>
              )}
              {data.password_hash ? (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]">
                  Temporary Password Set
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-red-500/15 text-red-300 border-red-500/25">
                  No Password Set
                </span>
              )}
            </div>
          </section>

          {/* ── 3. Person Profile ── */}
          {person && (
            <section className={cardWrap}>
              <h2 className={cardTitle}>
                <UserCircle2 className="h-3.5 w-3.5" />
                Contact Profile
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField icon={<UserCircle2 className="h-3.5 w-3.5" />} label="Full Name" value={person.full_name} />
                {person.display_name && (
                  <InfoField icon={<UserCircle2 className="h-3.5 w-3.5" />} label="Display Name" value={person.display_name} />
                )}
                {person.email && (
                  <InfoField icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={person.email} />
                )}
                {person.phone && (
                  <InfoField icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={person.phone} />
                )}
                {person.mobile && (
                  <InfoField icon={<Smartphone className="h-3.5 w-3.5" />} label="Mobile" value={person.mobile} />
                )}
                {person.language && (
                  <InfoField icon={<Languages className="h-3.5 w-3.5" />} label="Language" value={person.language} />
                )}
              </div>
              {(person.address_line1 || person.city || person.country) && (
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold mb-2 flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" />
                    Address
                  </p>
                  <p className="text-[13px] text-[var(--text-muted)] whitespace-pre-line">
                    {[
                      person.address_line1,
                      person.address_line2,
                      [person.city, person.state, person.postal_code].filter(Boolean).join(", "),
                      person.country,
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ── 4. Company ── */}
          {company && (
            <section className={cardWrap}>
              <h2 className={cardTitle}>
                <Building2 className="h-3.5 w-3.5" />
                Company
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField icon={<Building2 className="h-3.5 w-3.5" />} label="Name" value={company.name} />
                <InfoField
                  icon={<Layers className="h-3.5 w-3.5" />}
                  label="Type"
                  value={<span className="uppercase tracking-wider">{company.type}</span>}
                />
                {company.country && (
                  <InfoField icon={<Flag className="h-3.5 w-3.5" />} label="Country" value={company.country} />
                )}
                {company.currency && (
                  <InfoField icon={<Globe className="h-3.5 w-3.5" />} label="Currency" value={company.currency} />
                )}
                {customerLevel && (
                  <>
                    <InfoField
                      icon={<Shield className="h-3.5 w-3.5" />}
                      label="Customer Level"
                      value={
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${levelColors[customerLevel]}`}
                        >
                          {customerLevel}
                        </span>
                      }
                    />
                    <InfoField
                      icon={<Layers className="h-3.5 w-3.5" />}
                      label="Price Level"
                      value={priceLevelForCustomerLevel[customerLevel]}
                    />
                  </>
                )}
              </div>
              {data.user_type === "customer" && !customerLevel && (
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-[12px] text-amber-300/80 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  This company has no customer level set. Set it on the company record to enable pricing.
                </div>
              )}
            </section>
          )}

          {/* ── 5. Employee (HR) ── */}
          {employee && (
            <section className={cardWrap}>
              <h2 className={cardTitle}>
                <Briefcase className="h-3.5 w-3.5" />
                Employee Record
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {employee.employee_number && (
                  <InfoField icon={<Briefcase className="h-3.5 w-3.5" />} label="Employee #" value={employee.employee_number} />
                )}
                {employee.department && (
                  <InfoField icon={<Layers className="h-3.5 w-3.5" />} label="Department" value={employee.department} />
                )}
                {employee.position && (
                  <InfoField icon={<Briefcase className="h-3.5 w-3.5" />} label="Position" value={employee.position} />
                )}
                <InfoField
                  icon={<Shield className="h-3.5 w-3.5" />}
                  label="Employment"
                  value={<span className="uppercase tracking-wider">{employee.employment_status}</span>}
                />
                {employee.hire_date && (
                  <InfoField icon={<Clock className="h-3.5 w-3.5" />} label="Hire Date" value={new Date(employee.hire_date).toLocaleDateString()} />
                )}
                {employee.work_email && (
                  <InfoField icon={<Mail className="h-3.5 w-3.5" />} label="Work Email" value={employee.work_email} />
                )}
                {employee.work_phone && (
                  <InfoField icon={<Phone className="h-3.5 w-3.5" />} label="Work Phone" value={employee.work_phone} />
                )}
              </div>
            </section>
          )}

          {/* ── 6. Role & Access Preset ── */}
          <section className={cardWrap}>
            <h2 className={cardTitle}>
              <Shield className="h-3.5 w-3.5" />
              Role &amp; Access Preset
            </h2>
            {role ? (
              <div className="mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-focus)]">
                    {role.name}
                  </span>
                  <span className="text-[11px] text-[var(--text-dim)] uppercase tracking-wider">
                    Scope: {role.scope}
                  </span>
                </div>
                {role.description && (
                  <p className="text-[12px] text-[var(--text-dim)] mt-2">{role.description}</p>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-amber-300/80 mb-4 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                No role assigned. Edit this account to assign one.
              </p>
            )}

            {preset ? (
              <>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold mb-2">
                  Default access flags from preset
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <AccessFlag label="Access Products"    on={preset.can_access_products} />
                  <AccessFlag label="View Pricing"       on={preset.can_view_pricing} />
                  <AccessFlag label="Create Quotations"  on={preset.can_create_quotations} />
                  <AccessFlag label="Place Orders"       on={preset.can_place_orders} />
                  <AccessFlag label="Manage Accounts"    on={preset.can_manage_accounts} />
                  <AccessFlag label="Manage Products"    on={preset.can_manage_products} />
                  <AccessFlag label="Access Finance"     on={preset.can_access_finance} />
                  <AccessFlag label="Access HR"          on={preset.can_access_hr} />
                  <AccessFlag label="Access Marketing"   on={preset.can_access_marketing} />
                </div>
              </>
            ) : (
              role && (
                <p className="text-[12px] text-[var(--text-dim)]">
                  No access preset defined for this role yet.
                </p>
              )
            )}

            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-dim)] flex items-start gap-2">
              <Shield className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                Detailed module permissions will be managed in the permissions
                system later. This card shows the defaults inherited from the
                role&rsquo;s access preset.
              </span>
            </div>
          </section>

          {/* ── 7. Notes ── */}
          {data.internal_notes && (
            <section className={cardWrap}>
              <h2 className={cardTitle}>
                <FileText className="h-3.5 w-3.5" />
                Internal Notes
              </h2>
              <p className="text-[13px] text-[var(--text-muted)] whitespace-pre-wrap">
                {data.internal_notes}
              </p>
            </section>
          )}

          {/* ── 8. Meta ── */}
          <p className="text-[11px] text-[var(--text-ghost)] px-1">
            Created {new Date(data.created_at).toLocaleString()} · Updated{" "}
            {new Date(data.updated_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Helper components ── */

function InfoField({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold flex items-center gap-1.5 mb-1">
        {icon}
        {label}
      </p>
      <div className="text-[13px] text-[var(--text-primary)] truncate">
        {value}
      </div>
    </div>
  );
}

function AccessFlag({ label, on }: { label: string; on: boolean }) {
  return (
    <div
      className={`h-10 px-3 rounded-lg border text-[12px] font-medium flex items-center justify-between ${
        on
          ? "bg-[var(--bg-surface)] border-[var(--border-focus)] text-[var(--text-primary)]"
          : "bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`h-2 w-2 rounded-full ${on ? "bg-emerald-400" : "bg-[var(--text-ghost)]"}`}
      />
    </div>
  );
}
