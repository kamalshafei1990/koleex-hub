"use client";

/* ---------------------------------------------------------------------------
   AccountForm v2 — Identity system create/edit form.

   This form provisions a login identity. Profile data lives in `people`,
   workspace data lives in `companies`, and access rights are driven by the
   role's access_preset — this form only configures the linkages.

   Sections:
     1. Account Type      — user type, role, status
     2. Login Identity    — username, login email, temporary password
     3. Link Records      — linked company + linked person (both inline-createable)
     4. Customer Settings — only shown when user_type === "customer"; read-only
                            customer level from the company (source of truth)
     5. Notes             — admin-only internal notes

   Access permissions:
     Removed from this form entirely. They live on the role's access_preset
     and will get per-account overrides in the future permissions system.
     See the access summary card at the bottom of the form for a read-only
     view of the role's preset.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield, KeyRound, Link2, Globe, StickyNote, Save, ArrowLeft,
  Copy, RefreshCcw, Eye, EyeOff, AlertCircle, Plus, Building2, UserCircle2,
  Layers, CheckCircle2,
} from "lucide-react";
import {
  createAccount, updateAccount,
  fetchCompanies, fetchRoles, fetchPeople, fetchAccessPresetByRoleId,
  createCompany, createPerson,
  isUsernameAvailable, isLoginEmailAvailable,
  generateTemporaryPassword, suggestUsername,
} from "@/lib/accounts-admin";
import type {
  AccountRow, CompanyRow, RoleRow, PersonRow, AccessPresetRow,
  UserType, AccountStatus, CustomerLevel, CompanyType,
} from "@/types/supabase";

/* ── Shared styles (match the hub's product admin) ── */
const inputClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors";
const selectClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors";
const labelClass =
  "block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider";
const sectionWrap =
  "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";
const sectionHead =
  "flex items-center gap-2.5 mb-5 text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-[0.08em]";
const sectionNumber =
  "h-6 w-6 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-muted)] flex items-center justify-center";

type Mode = "create" | "edit";

interface Props {
  mode: Mode;
  account?: AccountRow;
}

interface FormState {
  user_type: UserType;
  role_id: string;
  status: AccountStatus;

  username: string;
  login_email: string;
  temporary_password: string;
  force_password_change: boolean;

  person_id: string;
  company_id: string;

  internal_notes: string;
}

function initialState(a?: AccountRow): FormState {
  return {
    user_type: (a?.user_type as UserType) ?? "internal",
    role_id: a?.role_id ?? "",
    status: (a?.status as AccountStatus) ?? "pending",

    username: a?.username ?? "",
    login_email: a?.login_email ?? "",
    temporary_password: "",
    force_password_change: a?.force_password_change ?? true,

    person_id: a?.person_id ?? "",
    company_id: a?.company_id ?? "",

    internal_notes: a?.internal_notes ?? "",
  };
}

export default function AccountForm({ mode, account }: Props) {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(() => initialState(account));
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [preset, setPreset] = useState<AccessPresetRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPw, setShowPw] = useState(false);
  const [showCompanyPanel, setShowCompanyPanel] = useState(false);
  const [showPersonPanel, setShowPersonPanel] = useState(false);

  /* ── Initial load ── */
  useEffect(() => {
    (async () => {
      const [c, r, p] = await Promise.all([
        fetchCompanies(), fetchRoles(), fetchPeople(),
      ]);
      setCompanies(c);
      setRoles(r);
      setPeople(p);

      // Auto-generate temp password on create
      if (mode === "create" && !form.temporary_password) {
        setForm((f) => ({ ...f, temporary_password: generateTemporaryPassword() }));
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Whenever role changes, refresh the preset summary ── */
  useEffect(() => {
    if (!form.role_id) {
      setPreset(null);
      return;
    }
    fetchAccessPresetByRoleId(form.role_id).then(setPreset);
  }, [form.role_id]);

  const isCustomer = form.user_type === "customer";

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === form.company_id) || null,
    [companies, form.company_id],
  );
  const selectedPerson = useMemo(
    () => people.find((p) => p.id === form.person_id) || null,
    [people, form.person_id],
  );

  const availableRoles = useMemo(
    () =>
      roles.filter(
        (r) =>
          r.scope === "all" ||
          (isCustomer ? r.scope === "customer" : r.scope === "internal"),
      ),
    [roles, isCustomer],
  );

  /* When user type changes, reset the role if its scope no longer matches
     and nudge the company selection toward the right scope. */
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

  /* ── Handle company created inline ── */
  async function handleCompanyCreated(c: CompanyRow) {
    setCompanies((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((f) => ({ ...f, company_id: c.id }));
    setShowCompanyPanel(false);
  }

  /* ── Handle person created inline ── */
  async function handlePersonCreated(p: PersonRow) {
    setPeople((prev) => [...prev, p].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setForm((f) => ({
      ...f,
      person_id: p.id,
      // Pre-fill fields derived from the new person if they're still empty
      login_email: f.login_email || p.email || "",
      username: f.username || (p.full_name ? suggestUsername(p.full_name) : ""),
    }));
    setShowPersonPanel(false);
  }

  /* ── Submit ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.username.trim()) return setError("Username is required.");
    if (!/^[a-z0-9._-]{3,32}$/i.test(form.username.trim()))
      return setError("Username must be 3-32 characters (letters, numbers, . _ -).");
    if (!form.login_email.trim()) return setError("Login email is required.");
    if (!/.+@.+\..+/.test(form.login_email))
      return setError("Login email looks invalid.");
    if (!form.role_id) return setError("Please select a role.");
    if (mode === "create" && !form.temporary_password.trim())
      return setError("A temporary password is required for new accounts.");
    if (isCustomer && !form.company_id)
      return setError("Customer accounts must be linked to a company.");

    setSaving(true);

    // Uniqueness checks
    const [uOk, eOk] = await Promise.all([
      isUsernameAvailable(form.username.trim(), account?.id),
      isLoginEmailAvailable(form.login_email.trim(), account?.id),
    ]);
    if (!uOk) {
      setSaving(false);
      return setError("That username is already taken.");
    }
    if (!eOk) {
      setSaving(false);
      return setError("An account with that login email already exists.");
    }

    const base = {
      username: form.username.trim(),
      login_email: form.login_email.trim(),
      user_type: form.user_type,
      status: form.status,
      role_id: form.role_id || null,
      person_id: form.person_id || null,
      company_id: form.company_id || null,
      internal_notes: form.internal_notes.trim() || null,
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
        setError("Could not create account. Check the browser console for details.");
        return;
      }
      router.push(`/accounts/${created.id}`);
    } else if (account) {
      const ok = await updateAccount(account.id, {
        ...base,
        force_password_change: form.force_password_change,
      });
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
            <div className="h-52 bg-[var(--bg-surface-subtle)] rounded-2xl" />
            <div className="h-52 bg-[var(--bg-surface-subtle)] rounded-2xl" />
            <div className="h-52 bg-[var(--bg-surface-subtle)] rounded-2xl" />
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
                  ? "Provision a login identity linked to a person and a company."
                  : `Update the login identity for ${account?.username ?? "this account"}.`}
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

          {/* ─── 1. Account Type ─── */}
          <section className={sectionWrap}>
            <h2 className={sectionHead}>
              <span className={sectionNumber}>1</span>
              <Shield className="h-3.5 w-3.5 text-[var(--text-faint)]" />
              Account Type
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>User Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["internal", "customer"] as UserType[]).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => set("user_type", t)}
                      className={`h-10 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
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
                <label className={labelClass}>Role *</label>
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
            </div>

            {/* Access preset preview */}
            {preset && (
              <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4">
                <div className="flex items-start gap-2">
                  <Layers className="h-3.5 w-3.5 text-[var(--text-faint)] mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Access preset · {preset.preset_name}
                    </p>
                    <p className="text-[11px] text-[var(--text-dim)] mt-1 mb-3">
                      These are the default access flags for this role. Detailed
                      module permissions will be managed in the permissions
                      system later.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      <Flag on={preset.can_access_products} label="Products" />
                      <Flag on={preset.can_view_pricing} label="Pricing" />
                      <Flag on={preset.can_create_quotations} label="Quotations" />
                      <Flag on={preset.can_place_orders} label="Orders" />
                      <Flag on={preset.can_access_finance} label="Finance" />
                      <Flag on={preset.can_access_hr} label="HR" />
                      <Flag on={preset.can_access_marketing} label="Marketing" />
                      <Flag on={preset.can_manage_products} label="Manage Products" />
                      <Flag on={preset.can_manage_accounts} label="Manage Accounts" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ─── 2. Login Identity ─── */}
          <section className={sectionWrap}>
            <h2 className={sectionHead}>
              <span className={sectionNumber}>2</span>
              <KeyRound className="h-3.5 w-3.5 text-[var(--text-faint)]" />
              Login Identity
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Username *</label>
                <input
                  className={inputClass + " font-mono"}
                  value={form.username}
                  onChange={(e) => set("username", e.target.value.toLowerCase())}
                  placeholder="jane.cooper"
                />
                <p className="text-[10px] text-[var(--text-dim)] mt-1">
                  3-32 chars, lowercase. Letters, numbers, dot, dash, underscore.
                </p>
              </div>
              <div>
                <label className={labelClass}>Login Email *</label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.login_email}
                  onChange={(e) => set("login_email", e.target.value)}
                  placeholder="jane@koleex.com"
                />
                <p className="text-[10px] text-[var(--text-dim)] mt-1">
                  Used as the login identifier. Not the person's personal email.
                </p>
              </div>
            </div>

            {mode === "create" && (
              <div className="mt-4">
                <label className={labelClass}>Temporary Password *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPw ? "text" : "password"}
                      className={inputClass + " pr-10 font-mono"}
                      value={form.temporary_password}
                      onChange={(e) => set("temporary_password", e.target.value)}
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
                    onClick={() => set("temporary_password", generateTemporaryPassword())}
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
              </div>
            )}

            {mode === "edit" && (
              <div className="mt-4">
                <Toggle
                  label="Force password change on next login"
                  checked={form.force_password_change}
                  onChange={(v) => set("force_password_change", v)}
                />
              </div>
            )}
          </section>

          {/* ─── 3. Link Records ─── */}
          <section className={sectionWrap}>
            <h2 className={sectionHead}>
              <span className={sectionNumber}>3</span>
              <Link2 className="h-3.5 w-3.5 text-[var(--text-faint)]" />
              Link Records
            </h2>
            <p className="text-[11px] text-[var(--text-dim)] -mt-3 mb-4">
              Link this account to a company (workspace) and optionally to a
              person (identity / profile). Create new records inline if needed.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Company picker */}
              <div>
                <label className={labelClass}>
                  Company {isCustomer && "*"}
                </label>
                <div className="flex gap-2">
                  <select
                    className={selectClass}
                    value={form.company_id}
                    onChange={(e) => set("company_id", e.target.value)}
                  >
                    <option value="">— Select company —</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.type !== "customer" ? ` · ${c.type}` : ""}
                        {c.customer_level ? ` · ${c.customer_level}` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCompanyPanel((s) => !s)}
                    className="h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center gap-1.5 transition-all shrink-0"
                    title="Create new company"
                  >
                    <Plus className="h-3.5 w-3.5" /> New
                  </button>
                </div>
                {selectedCompany && (
                  <p className="text-[10px] text-[var(--text-dim)] mt-1.5">
                    {selectedCompany.type} · {selectedCompany.country || "—"} ·{" "}
                    {selectedCompany.currency || "—"}
                    {selectedCompany.customer_level
                      ? ` · ${selectedCompany.customer_level}`
                      : ""}
                  </p>
                )}
              </div>

              {/* Person picker */}
              <div>
                <label className={labelClass}>Contact (Person)</label>
                <div className="flex gap-2">
                  <select
                    className={selectClass}
                    value={form.person_id}
                    onChange={(e) => {
                      const pid = e.target.value;
                      const p = people.find((x) => x.id === pid);
                      set("person_id", pid);
                      // Offer sensible defaults when first linking
                      if (p && mode === "create") {
                        if (!form.username && p.full_name)
                          set("username", suggestUsername(p.full_name));
                        if (!form.login_email && p.email)
                          set("login_email", p.email);
                      }
                    }}
                  >
                    <option value="">— Select person —</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                        {p.job_title ? ` · ${p.job_title}` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowPersonPanel((s) => !s)}
                    className="h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center gap-1.5 transition-all shrink-0"
                    title="Create new person"
                  >
                    <Plus className="h-3.5 w-3.5" /> New
                  </button>
                </div>
                {selectedPerson && (
                  <p className="text-[10px] text-[var(--text-dim)] mt-1.5">
                    {selectedPerson.email || "no email"}
                    {selectedPerson.phone ? ` · ${selectedPerson.phone}` : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Inline Company create panel */}
            {showCompanyPanel && (
              <InlineCompanyPanel
                defaultType={isCustomer ? "customer" : "koleex"}
                onCreated={handleCompanyCreated}
                onCancel={() => setShowCompanyPanel(false)}
              />
            )}

            {/* Inline Person create panel */}
            {showPersonPanel && (
              <InlinePersonPanel
                defaultCompanyId={form.company_id || null}
                onCreated={handlePersonCreated}
                onCancel={() => setShowPersonPanel(false)}
              />
            )}
          </section>

          {/* ─── 4. Customer Settings (customer only) ─── */}
          {isCustomer && (
            <section className={sectionWrap}>
              <h2 className={sectionHead}>
                <span className={sectionNumber}>4</span>
                <Globe className="h-3.5 w-3.5 text-[var(--text-faint)]" />
                Customer Settings
              </h2>
              {selectedCompany ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ReadOnlyField label="Company" value={selectedCompany.name} />
                  <ReadOnlyField
                    label="Customer Level"
                    value={
                      selectedCompany.customer_level
                        ? selectedCompany.customer_level.toUpperCase()
                        : "— not set —"
                    }
                  />
                  <ReadOnlyField
                    label="Price Level"
                    value={
                      selectedCompany.customer_level
                        ? `Derived from ${selectedCompany.customer_level}`
                        : "—"
                    }
                  />
                  <ReadOnlyField
                    label="Country"
                    value={selectedCompany.country || "—"}
                  />
                  <ReadOnlyField
                    label="Currency"
                    value={selectedCompany.currency || "—"}
                  />
                </div>
              ) : (
                <p className="text-[13px] text-[var(--text-dim)]">
                  Select or create a customer company above to see its level,
                  country, and currency. These fields belong to the company —
                  not the account — so every user under the same company
                  inherits the same pricing logic.
                </p>
              )}
              {selectedCompany && !selectedCompany.customer_level && (
                <p className="text-[11px] text-amber-400/80 mt-3">
                  This company has no customer level set. Edit the company to
                  set it — customer level drives pricing for all its users.
                </p>
              )}
            </section>
          )}

          {/* ─── 5. Notes ─── */}
          <section className={sectionWrap}>
            <h2 className={sectionHead}>
              <span className={sectionNumber}>{isCustomer ? 5 : 4}</span>
              <StickyNote className="h-3.5 w-3.5 text-[var(--text-faint)]" />
              Notes
            </h2>
            <label className={labelClass}>Internal Notes (admin only)</label>
            <textarea
              className={inputClass + " h-24 py-2 resize-y"}
              value={form.internal_notes}
              onChange={(e) => set("internal_notes", e.target.value)}
              placeholder="Private notes visible only to admins."
            />
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

/* ============================================================================
   Inline Company create panel
   ============================================================================ */
function InlineCompanyPanel({
  defaultType, onCreated, onCancel,
}: {
  defaultType: CompanyType;
  onCreated: (c: CompanyRow) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CompanyType>(defaultType);
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [customerLevel, setCustomerLevel] = useState<CustomerLevel | "">("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setErr("Company name is required.");
    setSaving(true);
    setErr(null);
    const c = await createCompany({
      name: name.trim(),
      type,
      country: country.trim() || null,
      currency: currency.trim() || null,
      customer_level: type === "customer" ? (customerLevel || null) : null,
      tax_id: null,
      website: null,
      logo_url: null,
      notes: null,
    });
    setSaving(false);
    if (!c) {
      setErr("Could not create company.");
      return;
    }
    onCreated(c);
  }

  return (
    <div className="mt-5 rounded-xl border border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="h-3.5 w-3.5 text-[var(--text-faint)]" />
        <span className="text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
          New Company
        </span>
      </div>
      {err && (
        <p className="text-[11px] text-red-400 mb-2 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {err}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
            Company Name *
          </label>
          <input
            className="w-full h-9 px-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Trading LLC"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
            Type
          </label>
          <select
            className="w-full h-9 px-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            value={type}
            onChange={(e) => setType(e.target.value as CompanyType)}
          >
            <option value="koleex">Koleex (internal)</option>
            <option value="customer">Customer</option>
            <option value="supplier">Supplier</option>
            <option value="partner">Partner</option>
          </select>
        </div>
        {type === "customer" && (
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
              Customer Level (drives pricing)
            </label>
            <select
              className="w-full h-9 px-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              value={customerLevel}
              onChange={(e) => setCustomerLevel(e.target.value as CustomerLevel | "")}
            >
              <option value="">— None —</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
              <option value="diamond">Diamond</option>
            </select>
          </div>
        )}
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
            Country
          </label>
          <input
            className="w-full h-9 px-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            placeholder="AE"
            maxLength={4}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
            Currency
          </label>
          <input
            className="w-full h-9 px-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="USD"
            maxLength={6}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-4 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-60"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Add Company"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   Inline Person create panel
   ============================================================================ */
function InlinePersonPanel({
  defaultCompanyId, onCreated, onCancel,
}: {
  defaultCompanyId: string | null;
  onCreated: (p: PersonRow) => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!fullName.trim()) return setErr("Full name is required.");
    setSaving(true);
    setErr(null);
    const p = await createPerson({
      full_name: fullName.trim(),
      display_name: null,
      first_name: null,
      last_name: null,
      job_title: jobTitle.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      mobile: null,
      avatar_url: null,
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      country: null,
      postal_code: null,
      company_id: defaultCompanyId,
      language: null,
      notes: null,
      created_by: null,
    });
    setSaving(false);
    if (!p) {
      setErr("Could not create person.");
      return;
    }
    onCreated(p);
  }

  return (
    <div className="mt-5 rounded-xl border border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <UserCircle2 className="h-3.5 w-3.5 text-[var(--text-faint)]" />
        <span className="text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
          New Contact (Person)
        </span>
      </div>
      {err && (
        <p className="text-[11px] text-red-400 mb-2 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {err}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
            Full Name *
          </label>
          <input
            className="w-full h-9 px-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Cooper"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
            Job Title
          </label>
          <input
            className="w-full h-9 px-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Sales Manager"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
            Personal Email
          </label>
          <input
            className="w-full h-9 px-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
            Phone
          </label>
          <input
            className="w-full h-9 px-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+971 50 123 4567"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-4 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-60"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Add Contact"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   Small building blocks
   ============================================================================ */
function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <div
      className={`h-7 px-2.5 rounded-md text-[10px] font-medium flex items-center justify-between gap-1.5 border ${
        on
          ? "bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-300"
          : "bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-dim)]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-400" : "bg-[var(--text-ghost)]"}`}
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-muted)] flex items-center">
        {value}
      </div>
    </div>
  );
}

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`h-11 px-4 rounded-lg border text-[12px] font-medium flex items-center justify-between gap-3 transition-all w-full ${
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
