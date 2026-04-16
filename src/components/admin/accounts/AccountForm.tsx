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
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import KeyIcon from "@/components/icons/ui/KeyIcon";
import Link2Icon from "@/components/icons/ui/Link2Icon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import StickyNoteIcon from "@/components/icons/ui/StickyNoteIcon";
import DiskIcon from "@/components/icons/ui/DiskIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import RefreshCcwIcon from "@/components/icons/ui/RefreshCcwIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import EyeOffIcon from "@/components/icons/ui/EyeOffIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import UserCircle2Icon from "@/components/icons/ui/UserCircle2Icon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import {
  createAccount, updateAccount,
  fetchCompanies, fetchRoles, fetchPeople, fetchAccessPresetByRoleId,
  createCompany, createPerson,
  isUsernameAvailable, isLoginEmailAvailable,
  generateTemporaryPassword, suggestUsername,
} from "@/lib/accounts-admin";
import { useTranslation } from "@/lib/i18n";
import { accountsT } from "@/lib/translations/accounts";
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
  const { t } = useTranslation(accountsT);
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

    if (!form.username.trim()) return setError(t("acc.err.usernameRequired"));
    if (!/^[a-z0-9._-]{3,32}$/i.test(form.username.trim()))
      return setError(t("acc.err.usernameFormat"));
    if (!form.login_email.trim()) return setError(t("acc.err.emailRequired"));
    if (!/.+@.+\..+/.test(form.login_email))
      return setError(t("acc.err.emailInvalid"));
    if (!form.role_id) return setError(t("acc.err.roleRequired"));
    if (mode === "create" && !form.temporary_password.trim())
      return setError(t("acc.err.passwordRequired"));
    if (isCustomer && !form.company_id)
      return setError(t("acc.err.companyRequired"));

    // ─── No-orphan-accounts policy ───────────────────────────────────────
    // Every account MUST be tied to a real-world identity — a Person
    // (employee / individual) or a Company (customer / workspace). Even
    // though the DB CHECK constraint `accounts_must_have_link` refuses
    // orphans, we catch it here first so the user gets a clear message
    // instead of a cryptic Postgres error.
    if (!form.person_id && !form.company_id) {
      return setError(t("acc.err.linkRequired"));
    }

    setSaving(true);

    // Uniqueness checks
    const [uOk, eOk] = await Promise.all([
      isUsernameAvailable(form.username.trim(), account?.id),
      isLoginEmailAvailable(form.login_email.trim(), account?.id),
    ]);
    if (!uOk) {
      setSaving(false);
      return setError(t("acc.err.usernameTaken"));
    }
    if (!eOk) {
      setSaving(false);
      return setError(t("acc.err.emailExists"));
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
        avatar_url: null,
        temporary_password: form.temporary_password.trim(),
      });
      setSaving(false);
      if (!created) {
        setError(t("acc.err.createFailed"));
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
        setError(t("acc.err.updateFailed"));
        return;
      }
      router.push(`/accounts/${account.id}`);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 xl:px-10 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-[var(--bg-surface-subtle)] rounded" />
            <div className="h-52 bg-[var(--bg-surface-subtle)] rounded-2xl" />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="h-52 bg-[var(--bg-surface-subtle)] rounded-2xl" />
              <div className="h-52 bg-[var(--bg-surface-subtle)] rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 xl:px-10 py-6 md:py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <Link
              href={mode === "edit" && account ? `/accounts/${account.id}` : "/accounts"}
              className="h-9 w-9 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl md:text-[26px] font-bold text-[var(--text-primary)]">
                {mode === "create" ? t("acc.newAccount") : t("acc.editAccount")}
              </h1>
              <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mt-0.5">
                {mode === "create"
                  ? t("acc.createSubtitle")
                  : `${t("acc.editSubtitle")} ${account?.username ?? t("acc.thisAccount")}.`}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
            <ExclamationIcon className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5 xl:space-y-0 xl:grid xl:grid-cols-2 xl:gap-5"
        >

          {/* ─── 1. Account Type ─── (spans full width on xl: heavy with access preset) */}
          <section className={`${sectionWrap} xl:col-span-2`}>
            <h2 className={sectionHead}>
              <span className={sectionNumber}>1</span>
              <ShieldIcon className="h-3.5 w-3.5 text-[var(--text-faint)]" />
              {t("acc.form.accountType")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>{t("acc.field.userType")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["internal", "customer"] as UserType[]).map((ut) => (
                    <button
                      type="button"
                      key={ut}
                      onClick={() => set("user_type", ut)}
                      className={`h-10 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                        form.user_type === ut
                          ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                          : "bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {ut === "internal" ? t("acc.type.internal") : t("acc.type.customer")}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>{t("acc.field.role")}</label>
                <select
                  className={selectClass}
                  value={form.role_id}
                  onChange={(e) => set("role_id", e.target.value)}
                >
                  <option value="">{t("acc.select.selectRole")}</option>
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>{t("acc.field.status")}</label>
                <select
                  className={selectClass}
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as AccountStatus)}
                >
                  <option value="invited">{t("acc.status.invited")}</option>
                  <option value="pending">{t("acc.status.pending")}</option>
                  <option value="active">{t("acc.status.active")}</option>
                  <option value="inactive">{t("acc.status.inactive")}</option>
                  <option value="suspended">{t("acc.status.suspended")}</option>
                </select>
                <p className="text-[11px] text-[var(--text-dim)] mt-1.5">
                  {t("acc.hint.statusInvited")}
                </p>
              </div>
            </div>

            {/* Access preset preview */}
            {preset && (
              <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4">
                <div className="flex items-start gap-2">
                  <LayersIcon className="h-3.5 w-3.5 text-[var(--text-faint)] mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      {t("acc.preset.title")} · {preset.preset_name}
                    </p>
                    <p className="text-[11px] text-[var(--text-dim)] mt-1 mb-3">
                      {t("acc.preset.description")}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      <Flag on={preset.can_access_products} label={t("acc.preset.products")} />
                      <Flag on={preset.can_view_pricing} label={t("acc.preset.pricing")} />
                      <Flag on={preset.can_create_quotations} label={t("acc.preset.quotations")} />
                      <Flag on={preset.can_place_orders} label={t("acc.preset.orders")} />
                      <Flag on={preset.can_access_finance} label={t("acc.preset.finance")} />
                      <Flag on={preset.can_access_hr} label={t("acc.preset.hr")} />
                      <Flag on={preset.can_access_marketing} label={t("acc.preset.marketing")} />
                      <Flag on={preset.can_manage_products} label={t("acc.preset.manageProducts")} />
                      <Flag on={preset.can_manage_accounts} label={t("acc.preset.manageAccounts")} />
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
              <KeyIcon className="h-3.5 w-3.5 text-[var(--text-faint)]" />
              {t("acc.form.loginIdentity")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t("acc.field.username")}</label>
                <input
                  className={inputClass + " font-mono"}
                  value={form.username}
                  onChange={(e) => set("username", e.target.value.toLowerCase())}
                  placeholder="jane.cooper"
                />
                <p className="text-[10px] text-[var(--text-dim)] mt-1">
                  {t("acc.hint.username")}
                </p>
              </div>
              <div>
                <label className={labelClass}>{t("acc.field.loginEmail")}</label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.login_email}
                  onChange={(e) => set("login_email", e.target.value)}
                  placeholder="jane@koleex.com"
                />
                <p className="text-[10px] text-[var(--text-dim)] mt-1">
                  {t("acc.hint.loginEmail")}
                </p>
              </div>
            </div>

            {mode === "create" && (
              <div className="mt-4">
                <label className={labelClass}>{t("acc.field.tempPassword")}</label>
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
                      {showPw ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => set("temporary_password", generateTemporaryPassword())}
                    className="h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center gap-1.5 transition-all"
                  >
                    <RefreshCcwIcon className="h-3.5 w-3.5" /> New
                  </button>
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center gap-1.5 transition-all"
                  >
                    <CopyIcon className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-dim)] mt-2">
                  {t("acc.hint.tempPassword")}
                </p>
              </div>
            )}

            {mode === "edit" && (
              <div className="mt-4">
                <Toggle
                  label={t("acc.field.forceChangeOnLogin")}
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
              <Link2Icon className="h-3.5 w-3.5 text-[var(--text-faint)]" />
              {t("acc.form.linkRecords")}
            </h2>
            <p className="text-[11px] text-[var(--text-dim)] -mt-3 mb-4">
              {t("acc.hint.linkRecords")}
            </p>

            {/* No-orphan-accounts policy banner — appears until the user
                picks at least one link. Mirrors the CHECK constraint
                (accounts_must_have_link) so the rule is visible up front
                rather than failing at submit time. */}
            {!form.person_id && !form.company_id && (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] text-amber-300 px-4 py-3 text-[12px] flex items-start gap-2">
                <ExclamationIcon className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{t("acc.hint.noOrphan")}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Company picker */}
              <div>
                <label className={labelClass}>
                  {t("acc.field.company")} {isCustomer && "*"}
                </label>
                <div className="flex gap-2">
                  <select
                    className={selectClass}
                    value={form.company_id}
                    onChange={(e) => set("company_id", e.target.value)}
                  >
                    <option value="">{t("acc.select.selectCompany")}</option>
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
                    <PlusIcon className="h-3.5 w-3.5" /> New
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
                <label className={labelClass}>{t("acc.field.contactPerson")}</label>
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
                    <option value="">{t("acc.select.selectPerson")}</option>
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
                    <PlusIcon className="h-3.5 w-3.5" /> New
                  </button>
                </div>
                {selectedPerson && (
                  <p className="text-[10px] text-[var(--text-dim)] mt-1.5">
                    {selectedPerson.email || t("acc.hint.noEmail")}
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
                <GlobeIcon className="h-3.5 w-3.5 text-[var(--text-faint)]" />
                {t("acc.form.customerSettings")}
              </h2>
              {selectedCompany ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ReadOnlyField label={t("acc.field.company")} value={selectedCompany.name} />
                  <ReadOnlyField
                    label={t("acc.inline.customerLevelLabel")}
                    value={
                      selectedCompany.customer_level
                        ? selectedCompany.customer_level.toUpperCase()
                        : t("acc.hint.notSet")
                    }
                  />
                  <ReadOnlyField
                    label={t("acc.preset.pricing")}
                    value={
                      selectedCompany.customer_level
                        ? `${t("acc.hint.derivedFrom")} ${selectedCompany.customer_level}`
                        : "—"
                    }
                  />
                  <ReadOnlyField
                    label={t("acc.inline.country")}
                    value={selectedCompany.country || "—"}
                  />
                  <ReadOnlyField
                    label={t("acc.inline.currency")}
                    value={selectedCompany.currency || "—"}
                  />
                </div>
              ) : (
                <p className="text-[13px] text-[var(--text-dim)]">
                  {t("acc.hint.customerNoPricing")}
                </p>
              )}
              {selectedCompany && !selectedCompany.customer_level && (
                <p className="text-[11px] text-amber-400/80 mt-3">
                  {t("acc.hint.noCustomerLevel")}
                </p>
              )}
            </section>
          )}

          {/* ─── 5. Notes ─── (spans full width when Customer Settings isn't shown, so it doesn't sit alone on xl) */}
          <section className={`${sectionWrap} ${isCustomer ? "" : "xl:col-span-2"}`}>
            <h2 className={sectionHead}>
              <span className={sectionNumber}>{isCustomer ? 5 : 4}</span>
              <StickyNoteIcon className="h-3.5 w-3.5 text-[var(--text-faint)]" />
              {t("acc.form.notes")}
            </h2>
            <label className={labelClass}>{t("acc.field.internalNotes")}</label>
            <textarea
              className={inputClass + " h-24 py-2 resize-y"}
              value={form.internal_notes}
              onChange={(e) => set("internal_notes", e.target.value)}
              placeholder={t("acc.hint.notesPlaceholder")}
            />
          </section>

          {/* ── Actions (always full width) ── */}
          <div className="flex items-center justify-end gap-2 pt-2 xl:col-span-2">
            <Link
              href={mode === "edit" && account ? `/accounts/${account.id}` : "/accounts"}
              className="h-10 px-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
            >
              {t("acc.btn.cancel")}
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-60"
            >
              <DiskIcon className="h-4 w-4" />
              {saving ? t("acc.btn.saving") : mode === "create" ? t("acc.btn.createAccount") : t("acc.btn.save")}
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
  const { t } = useTranslation(accountsT);
  const [name, setName] = useState("");
  const [type, setType] = useState<CompanyType>(defaultType);
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [customerLevel, setCustomerLevel] = useState<CustomerLevel | "">("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setErr(t("acc.err.companyNameRequired"));
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
      setErr(t("acc.err.companyCreateFailed"));
      return;
    }
    onCreated(c);
  }

  return (
    <div className="mt-5 rounded-xl border border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Building2Icon className="h-3.5 w-3.5 text-[var(--text-faint)]" />
        <span className="text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
          {t("acc.inline.newCompany")}
        </span>
      </div>
      {err && (
        <p className="text-[11px] text-red-400 mb-2 flex items-center gap-1">
          <ExclamationIcon className="h-3 w-3" /> {err}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
            {t("acc.inline.companyName")}
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
            {t("acc.inline.companyType")}
          </label>
          <select
            className="w-full h-9 px-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            value={type}
            onChange={(e) => setType(e.target.value as CompanyType)}
          >
            <option value="koleex">{t("acc.inline.koleexInternal")}</option>
            <option value="customer">{t("acc.type.customer")}</option>
            <option value="supplier">{t("acc.inline.supplier")}</option>
            <option value="partner">{t("acc.inline.partner")}</option>
          </select>
        </div>
        {type === "customer" && (
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
              {t("acc.inline.customerLevelLabel")}
            </label>
            <select
              className="w-full h-9 px-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              value={customerLevel}
              onChange={(e) => setCustomerLevel(e.target.value as CustomerLevel | "")}
            >
              <option value="">{t("acc.select.none")}</option>
              <option value="silver">{t("acc.level.silver")}</option>
              <option value="gold">{t("acc.level.gold")}</option>
              <option value="platinum">{t("acc.level.platinum")}</option>
              <option value="diamond">{t("acc.level.diamond")}</option>
            </select>
          </div>
        )}
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
            {t("acc.inline.country")}
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
            {t("acc.inline.currency")}
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
          {t("acc.btn.cancel")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-60"
        >
          <CheckCircleIcon className="h-3.5 w-3.5" />
          {saving ? t("acc.btn.saving") : t("acc.inline.addCompany")}
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
  const { t } = useTranslation(accountsT);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!fullName.trim()) return setErr(t("acc.err.personNameRequired"));
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
      name_alt: null,
      first_name_alt: null,
      last_name_alt: null,
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
      setErr(t("acc.err.personCreateFailed"));
      return;
    }
    onCreated(p);
  }

  return (
    <div className="mt-5 rounded-xl border border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <UserCircle2Icon className="h-3.5 w-3.5 text-[var(--text-faint)]" />
        <span className="text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
          {t("acc.inline.newContact")}
        </span>
      </div>
      {err && (
        <p className="text-[11px] text-red-400 mb-2 flex items-center gap-1">
          <ExclamationIcon className="h-3 w-3" /> {err}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
            {t("acc.inline.fullName")}
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
            {t("acc.inline.jobTitle")}
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
            {t("acc.inline.personalEmail")}
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
            {t("acc.inline.phone")}
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
          {t("acc.btn.cancel")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-60"
        >
          <CheckCircleIcon className="h-3.5 w-3.5" />
          {saving ? t("acc.btn.saving") : t("acc.inline.addContact")}
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
        className={`relative inline-block h-5 w-9 rounded-full transition-colors duration-200 ${
          checked ? "bg-emerald-500" : "bg-zinc-600"
        }`}
      >
        {/* Anchor the handle at start-0.5 (2px from logical start) and only
            animate with translate — this keeps the off and on positions
            symmetric (2px gap on each side) and makes the toggle RTL-safe. */}
        <span
          className={`absolute top-0.5 start-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-4 rtl:-translate-x-4" : ""
          }`}
        />
      </span>
    </button>
  );
}
