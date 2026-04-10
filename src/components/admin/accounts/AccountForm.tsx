"use client";

/* ---------------------------------------------------------------------------
   AccountForm — Shared create/edit form for the Accounts Manager.

   Grouped sections:
     1. Profile
     2. Access (user type, company, role, status)
     3. Permissions (feature flags)
     4. Security (temporary password on create; reset-only on edit)
     5. Localisation
     6. Notes

   Customer-specific fields (customer level, can_place_orders) only render
   when user_type === "customer". Validation runs inline on submit.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserCircle2, Shield, KeyRound, Globe, StickyNote, Save, ArrowLeft,
  Copy, RefreshCcw, Eye, EyeOff, Building2, AlertCircle,
} from "lucide-react";
import {
  createAccount, updateAccount, fetchCompanies, fetchRoles,
  isUsernameAvailable, isEmailAvailable, generateTemporaryPassword,
} from "@/lib/accounts-admin";
import type {
  AccountRow, CompanyRow, RoleRow, UserType, AccountStatus, CustomerLevel,
} from "@/types/supabase";

/* ── Styling tokens (shared with ProductList look & feel) ── */
const inputClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors";
const selectClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors";
const labelClass =
  "block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider";
const sectionWrap =
  "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";
const sectionHead =
  "flex items-center gap-2.5 mb-5 text-[13px] font-semibold text-[var(--text-primary)] uppercase tracking-wider";

type Mode = "create" | "edit";

interface Props {
  mode: Mode;
  account?: AccountRow;
}

interface FormState {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  avatar_url: string;
  user_type: UserType;
  company_id: string;
  role_id: string;
  status: AccountStatus;
  country: string;
  currency: string;
  customer_level: CustomerLevel | "";
  can_access_products: boolean;
  can_create_quotations: boolean;
  can_view_pricing: boolean;
  can_place_orders: boolean;
  internal_notes: string;
  account_notes: string;
  temporary_password: string;
}

function initialState(a?: AccountRow): FormState {
  return {
    full_name: a?.full_name ?? "",
    username: a?.username ?? "",
    email: a?.email ?? "",
    phone: a?.phone ?? "",
    avatar_url: a?.avatar_url ?? "",
    user_type: (a?.user_type as UserType) ?? "internal",
    company_id: a?.company_id ?? "",
    role_id: a?.role_id ?? "",
    status: (a?.status as AccountStatus) ?? "pending",
    country: a?.country ?? "",
    currency: a?.currency ?? "USD",
    customer_level: (a?.customer_level as CustomerLevel) ?? "",
    can_access_products: a?.can_access_products ?? true,
    can_create_quotations: a?.can_create_quotations ?? false,
    can_view_pricing: a?.can_view_pricing ?? true,
    can_place_orders: a?.can_place_orders ?? false,
    internal_notes: a?.internal_notes ?? "",
    account_notes: a?.account_notes ?? "",
    temporary_password: "",
  };
}

export default function AccountForm({ mode, account }: Props) {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(() => initialState(account));
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, r] = await Promise.all([fetchCompanies(), fetchRoles()]);
      setCompanies(c);
      setRoles(r);
      // Auto-generate a temp password for new accounts
      if (mode === "create" && !form.temporary_password) {
        setForm((f) => ({ ...f, temporary_password: generateTemporaryPassword() }));
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCustomer = form.user_type === "customer";

  const availableRoles = useMemo(() => {
    return roles.filter(
      (r) =>
        r.scope === "all" ||
        (isCustomer ? r.scope === "customer" : r.scope === "internal"),
    );
  }, [roles, isCustomer]);

  // Auto-reset role when user type changes if the selected role no longer matches scope
  useEffect(() => {
    if (!form.role_id) return;
    const current = roles.find((r) => r.id === form.role_id);
    if (!current) return;
    const matches =
      current.scope === "all" ||
      (isCustomer ? current.scope === "customer" : current.scope === "internal");
    if (!matches) setForm((f) => ({ ...f, role_id: "" }));
  }, [form.user_type, roles, form.role_id, isCustomer]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function copyPassword() {
    if (!form.temporary_password) return;
    navigator.clipboard?.writeText(form.temporary_password).catch(() => {});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Inline validation
    if (!form.full_name.trim()) return setError("Full name is required.");
    if (!form.username.trim()) return setError("Username is required.");
    if (!form.email.trim()) return setError("Email is required.");
    if (!/.+@.+\..+/.test(form.email)) return setError("Email looks invalid.");
    if (mode === "create" && !form.temporary_password.trim())
      return setError("A temporary password is required for new accounts.");

    setSaving(true);

    // Uniqueness checks (soft — DB also enforces via unique index)
    const [uOk, eOk] = await Promise.all([
      isUsernameAvailable(form.username.trim(), account?.id),
      isEmailAvailable(form.email.trim(), account?.id),
    ]);
    if (!uOk) {
      setSaving(false);
      return setError("That username is already taken.");
    }
    if (!eOk) {
      setSaving(false);
      return setError("An account with that email already exists.");
    }

    const base = {
      full_name: form.full_name.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
      user_type: form.user_type,
      company_id: form.company_id || null,
      role_id: form.role_id || null,
      status: form.status,
      country: form.country.trim() || null,
      currency: form.currency.trim() || null,
      customer_level: isCustomer ? (form.customer_level || null) : null,
      can_access_products: form.can_access_products,
      can_create_quotations: form.can_create_quotations,
      can_view_pricing: form.can_view_pricing,
      can_place_orders: isCustomer ? form.can_place_orders : false,
      internal_notes: form.internal_notes.trim() || null,
      account_notes: form.account_notes.trim() || null,
    };

    if (mode === "create") {
      const created = await createAccount({
        ...base,
        auth_user_id: null,
        two_factor_enabled: false,
        last_login_at: null,
        created_by: null,
        temporary_password: form.temporary_password.trim(),
      });
      setSaving(false);
      if (!created) {
        setError("Could not create account. Check the console for details.");
        return;
      }
      router.push(`/accounts/${created.id}`);
    } else if (account) {
      const ok = await updateAccount(account.id, base);
      setSaving(false);
      if (!ok) {
        setError("Could not update account. Check the console for details.");
        return;
      }
      router.push(`/accounts/${account.id}`);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="max-w-[960px] mx-auto px-4 md:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-[var(--bg-surface-subtle)] rounded" />
            <div className="h-64 bg-[var(--bg-surface-subtle)] rounded-2xl" />
            <div className="h-64 bg-[var(--bg-surface-subtle)] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[960px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <Link
              href={mode === "edit" && account ? `/accounts/${account.id}` : "/accounts"}
              className="h-9 w-9 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl md:text-[26px] font-bold text-[var(--text-primary)]">
                {mode === "create" ? "New Account" : "Edit Account"}
              </h1>
              <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mt-0.5">
                {mode === "create"
                  ? "Provision an internal or customer user."
                  : `Update ${account?.full_name ?? "this account"}.`}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Profile ── */}
          <section className={sectionWrap}>
            <h2 className={sectionHead}>
              <UserCircle2 className="h-4 w-4 text-[var(--text-faint)]" />
              Profile
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelClass}>Full Name *</label>
                <input
                  className={inputClass}
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  placeholder="Jane Cooper"
                />
              </div>
              <div>
                <label className={labelClass}>Username *</label>
                <input
                  className={inputClass}
                  value={form.username}
                  onChange={(e) => set("username", e.target.value.toLowerCase())}
                  placeholder="jane.cooper"
                />
              </div>
              <div>
                <label className={labelClass}>Email *</label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="jane@koleex.com"
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+971 50 123 4567"
                />
              </div>
              <div>
                <label className={labelClass}>Profile Photo URL</label>
                <input
                  className={inputClass}
                  value={form.avatar_url}
                  onChange={(e) => set("avatar_url", e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>
          </section>

          {/* ── Access ── */}
          <section className={sectionWrap}>
            <h2 className={sectionHead}>
              <Shield className="h-4 w-4 text-[var(--text-faint)]" />
              Access
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>User Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["internal", "customer"] as UserType[]).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => set("user_type", t)}
                      className={`h-10 rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-all ${
                        form.user_type === t
                          ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                          : "bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Status</label>
                <select
                  className={selectClass}
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as AccountStatus)}
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Company / Workspace</label>
                <select
                  className={selectClass}
                  value={form.company_id}
                  onChange={(e) => set("company_id", e.target.value)}
                >
                  <option value="">— Select company —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.type === "koleex" ? " (Koleex)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Role</label>
                <select
                  className={selectClass}
                  value={form.role_id}
                  onChange={(e) => set("role_id", e.target.value)}
                >
                  <option value="">— Select role —</option>
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {isCustomer && (
                <div>
                  <label className={labelClass}>Customer Level</label>
                  <select
                    className={selectClass}
                    value={form.customer_level}
                    onChange={(e) =>
                      set("customer_level", e.target.value as CustomerLevel | "")
                    }
                  >
                    <option value="">— None —</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                    <option value="platinum">Platinum</option>
                    <option value="diamond">Diamond</option>
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* ── Permissions ── */}
          <section className={sectionWrap}>
            <h2 className={sectionHead}>
              <Building2 className="h-4 w-4 text-[var(--text-faint)]" />
              Permissions
            </h2>
            <p className="text-[12px] text-[var(--text-dim)] mb-4 -mt-2">
              Feature flags that gate which modules this account can reach. Role
              policies will enforce these later; for now they are advisory.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Toggle
                label="Access Products"
                checked={form.can_access_products}
                onChange={(v) => set("can_access_products", v)}
              />
              <Toggle
                label="View Pricing"
                checked={form.can_view_pricing}
                onChange={(v) => set("can_view_pricing", v)}
              />
              <Toggle
                label="Create Quotations"
                checked={form.can_create_quotations}
                onChange={(v) => set("can_create_quotations", v)}
              />
              {isCustomer && (
                <Toggle
                  label="Place Orders"
                  checked={form.can_place_orders}
                  onChange={(v) => set("can_place_orders", v)}
                />
              )}
            </div>
          </section>

          {/* ── Security ── */}
          {mode === "create" && (
            <section className={sectionWrap}>
              <h2 className={sectionHead}>
                <KeyRound className="h-4 w-4 text-[var(--text-faint)]" />
                Security
              </h2>
              <label className={labelClass}>Temporary Password *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPw ? "text" : "password"}
                    className={inputClass + " pr-10 font-mono"}
                    value={form.temporary_password}
                    onChange={(e) => set("temporary_password", e.target.value)}
                    placeholder="Auto-generated on load"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
                  >
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    set("temporary_password", generateTemporaryPassword())
                  }
                  className="h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center gap-1.5 transition-all"
                >
                  <RefreshCcw className="h-3.5 w-3.5" /> New
                </button>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center gap-1.5 transition-all"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-dim)] mt-2">
                The user will be forced to set their own password on first login.
              </p>
            </section>
          )}

          {/* ── Localisation ── */}
          <section className={sectionWrap}>
            <h2 className={sectionHead}>
              <Globe className="h-4 w-4 text-[var(--text-faint)]" />
              Localisation
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Country (ISO)</label>
                <input
                  className={inputClass}
                  value={form.country}
                  onChange={(e) => set("country", e.target.value.toUpperCase())}
                  placeholder="AE"
                  maxLength={4}
                />
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <input
                  className={inputClass}
                  value={form.currency}
                  onChange={(e) => set("currency", e.target.value.toUpperCase())}
                  placeholder="USD"
                  maxLength={6}
                />
              </div>
            </div>
          </section>

          {/* ── Notes ── */}
          <section className={sectionWrap}>
            <h2 className={sectionHead}>
              <StickyNote className="h-4 w-4 text-[var(--text-faint)]" />
              Notes
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={labelClass}>Internal Notes (admin only)</label>
                <textarea
                  className={inputClass + " h-24 py-2 resize-y"}
                  value={form.internal_notes}
                  onChange={(e) => set("internal_notes", e.target.value)}
                  placeholder="Private notes visible only to admins."
                />
              </div>
              <div>
                <label className={labelClass}>Account Notes (visible on profile)</label>
                <textarea
                  className={inputClass + " h-24 py-2 resize-y"}
                  value={form.account_notes}
                  onChange={(e) => set("account_notes", e.target.value)}
                  placeholder="Notes shown on the account detail page."
                />
              </div>
            </div>
          </section>

          {/* ── Actions ── */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Link
              href={mode === "edit" && account ? `/accounts/${account.id}` : "/accounts"}
              className="h-10 px-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : mode === "create" ? "Create Account" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Small toggle component (matches the hub's aesthetic) ── */
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`h-11 px-4 rounded-lg border text-[12px] font-medium flex items-center justify-between gap-3 transition-all ${
        checked
          ? "bg-[var(--bg-surface)] border-[var(--border-focus)] text-[var(--text-primary)]"
          : "bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`relative inline-block h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-emerald-500/80" : "bg-[var(--bg-surface-bright)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
