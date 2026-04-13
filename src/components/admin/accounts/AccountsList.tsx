"use client";

/* ---------------------------------------------------------------------------
   AccountsList v2 — Identity system table view.

   Columns:
     Avatar · Full Name · Username · Login Email · User Type · Company ·
     Role · Status · Country · Customer Level · Created · Actions

   Search:   name, username, email, company
   Filters:  user type, role, company, status, country, customer level
   Actions:  View, Edit, Disable/Activate, Reset Password, Force Password Reset

   Full name, country, and customer level are resolved by joining in-memory
   against the parallel-fetched people + companies tables. Account rows
   themselves only hold login identity now.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Search, Filter, X, UserCircle2, Shield, Mail, Building2,
  MoreHorizontal, Eye, Pencil, KeyRound, PowerOff, Power, RefreshCcw,
  CheckCircle2, AlertCircle, Copy, Flag,
} from "lucide-react";
import {
  fetchAccounts, fetchCompanies, fetchRoles, fetchPeople,
  setAccountStatus, resetAccountPassword, setForcePasswordChange,
  generateTemporaryPassword,
} from "@/lib/accounts-admin";
import type {
  AccountRow, CompanyRow, RoleRow, PersonRow,
  AccountStatus, UserType, CustomerLevel,
} from "@/types/supabase";
import AccountsIcon from "@/components/icons/AccountsIcon";

const selectClass =
  "h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors";

const statusColors: Record<AccountStatus, string> = {
  invited:   "bg-sky-500/15 text-sky-300 border-sky-500/25",
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

export default function AccountsList() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"" | UserType>("");
  const [filterStatus, setFilterStatus] = useState<"" | AccountStatus>("");
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterLevel, setFilterLevel] = useState<"" | CustomerLevel>("");
  const [showFilters, setShowFilters] = useState(false);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  /* Row action dropdown lives in a viewport-fixed portal so that the
     parent table's `overflow-hidden` / `overflow-x-auto` boundaries
     cannot clip it. We store the trigger button's viewport rect here
     and render a single <RowMenu> at the component's root. */
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTempPw, setNewTempPw] = useState<{ id: string; pw: string } | null>(null);

  /* Helper: capture the trigger button's viewport rect and toggle the
     row menu. We position the dropdown's top edge a few px below the
     button and anchor its right edge to the button's right edge. */
  function toggleRowMenu(id: string, el: HTMLElement | null) {
    if (openMenu === id) {
      setOpenMenu(null);
      setMenuAnchor(null);
      return;
    }
    if (el) {
      const rect = el.getBoundingClientRect();
      setMenuAnchor({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setOpenMenu(id);
  }

  /* Close the row menu on scroll / resize so stale coords don't drift. */
  useEffect(() => {
    if (!openMenu) return;
    function close() {
      setOpenMenu(null);
      setMenuAnchor(null);
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openMenu]);

  useEffect(() => {
    (async () => {
      const [a, c, r, p] = await Promise.all([
        fetchAccounts(), fetchCompanies(), fetchRoles(), fetchPeople(),
      ]);
      setAccounts(a);
      setCompanies(c);
      setRoles(r);
      setPeople(p);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const companyMap = useMemo(
    () => Object.fromEntries(companies.map((c) => [c.id, c])),
    [companies],
  );
  const roleMap = useMemo(
    () => Object.fromEntries(roles.map((r) => [r.id, r])),
    [roles],
  );
  const personMap = useMemo(
    () => Object.fromEntries(people.map((p) => [p.id, p])),
    [people],
  );

  /* Build a derived row bag so search + filter logic is a single pass. */
  const enriched = useMemo(
    () =>
      accounts.map((a) => {
        const person = a.person_id ? personMap[a.person_id] : null;
        const company = a.company_id ? companyMap[a.company_id] : null;
        const role = a.role_id ? roleMap[a.role_id] : null;
        const fullName = person?.full_name || a.username;
        const country = company?.country || person?.country || null;
        const customerLevel: CustomerLevel | null = company?.customer_level || null;
        return { account: a, person, company, role, fullName, country, customerLevel };
      }),
    [accounts, personMap, companyMap, roleMap],
  );

  /* Country options derived from companies + people so filter dropdown
     only shows countries that actually exist in the data. */
  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => c.country && set.add(c.country));
    people.forEach((p) => p.country && set.add(p.country));
    return Array.from(set).sort();
  }, [companies, people]);

  const activeFilters =
    (filterType ? 1 : 0) +
    (filterStatus ? 1 : 0) +
    (filterCompany ? 1 : 0) +
    (filterRole ? 1 : 0) +
    (filterCountry ? 1 : 0) +
    (filterLevel ? 1 : 0);

  const filtered = useMemo(() => {
    return enriched.filter((row) => {
      const { account: a, company, fullName, country, customerLevel } = row;
      if (filterType && a.user_type !== filterType) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      if (filterCompany && a.company_id !== filterCompany) return false;
      if (filterRole && a.role_id !== filterRole) return false;
      if (filterCountry && country !== filterCountry) return false;
      if (filterLevel && customerLevel !== filterLevel) return false;
      if (search) {
        const q = search.toLowerCase();
        const hit =
          fullName.toLowerCase().includes(q) ||
          a.username.toLowerCase().includes(q) ||
          a.login_email.toLowerCase().includes(q) ||
          (company?.name || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [enriched, search, filterType, filterStatus, filterCompany, filterRole, filterCountry, filterLevel]);

  function clearFilters() {
    setFilterType("");
    setFilterStatus("");
    setFilterCompany("");
    setFilterRole("");
    setFilterCountry("");
    setFilterLevel("");
  }

  /* ── Row actions ── */

  async function actionToggleStatus(a: AccountRow) {
    const next: AccountStatus = a.status === "active" ? "inactive" : "active";
    setWorking(true);
    const ok = await setAccountStatus(a.id, next);
    setWorking(false);
    setOpenMenu(null);
    if (ok) {
      setAccounts((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
      setToast(next === "active" ? "Account activated." : "Account deactivated.");
    } else {
      setError("Could not update account status.");
    }
  }

  async function actionResetPassword(a: AccountRow) {
    const pw = generateTemporaryPassword();
    setWorking(true);
    const ok = await resetAccountPassword(a.id, pw);
    setWorking(false);
    setOpenMenu(null);
    if (ok) {
      setNewTempPw({ id: a.id, pw });
      setAccounts((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, force_password_change: true } : x)),
      );
      setToast("Temporary password reset. Copy it and share securely.");
    } else {
      setError("Could not reset the password.");
    }
  }

  async function actionToggleForce(a: AccountRow) {
    const next = !a.force_password_change;
    setWorking(true);
    const ok = await setForcePasswordChange(a.id, next);
    setWorking(false);
    setOpenMenu(null);
    if (ok) {
      setAccounts((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, force_password_change: next } : x)),
      );
      setToast(
        next
          ? "Force password change on next login."
          : "Force password change cleared.",
      );
    } else {
      setError("Could not update the flag.");
    }
  }

  function copyTempPw() {
    if (!newTempPw) return;
    navigator.clipboard?.writeText(newTempPw.pw).catch(() => {});
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              <AccountsIcon size={16} />
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
              Accounts
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/accounts/new" className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg">
              <Plus className="h-4 w-4" /> New Account
            </Link>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-dim)] mb-6 md:mb-8 ml-0 md:ml-11">
          {accounts.length} accounts across Koleex and customer workspaces
        </p>

        {/* Toasts */}
        {toast && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 px-4 py-3 text-[13px] flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{toast}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {newTempPw && (
          <div className="mb-4 rounded-xl border border-[var(--border-focus)] bg-[var(--bg-surface)] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">
                New Temporary Password
              </p>
              <p className="text-[14px] font-mono text-[var(--text-primary)] mt-1">
                {newTempPw.pw}
              </p>
              <p className="text-[11px] text-[var(--text-dim)] mt-1">
                Copy this and share securely. The user will be forced to change it on next login.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyTempPw}
                className="h-9 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
              <button
                onClick={() => setNewTempPw(null)}
                className="h-9 w-9 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Search + Filters */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-4 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, username, email, or company…"
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
              />
            </div>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`h-10 px-4 rounded-xl border text-[12px] font-medium flex items-center gap-2 transition-all ${
                showFilters || activeFilters > 0
                  ? "bg-[var(--bg-surface)] border-[var(--border-focus)] text-[var(--text-primary)]"
                  : "bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-[var(--text-muted)]"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilters > 0 && (
                <span className="h-5 min-w-[20px] px-1 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] font-bold flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </button>
            {activeFilters > 0 && (
              <button
                onClick={clearFilters}
                className="h-10 px-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-muted)] flex items-center gap-1.5 transition-colors"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
                  User Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as "" | UserType)}
                  className={selectClass + " w-full"}
                >
                  <option value="">All</option>
                  <option value="internal">Internal</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
                  Role
                </label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className={selectClass + " w-full"}
                >
                  <option value="">All</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
                  Company
                </label>
                <select
                  value={filterCompany}
                  onChange={(e) => setFilterCompany(e.target.value)}
                  className={selectClass + " w-full"}
                >
                  <option value="">All</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as "" | AccountStatus)}
                  className={selectClass + " w-full"}
                >
                  <option value="">All</option>
                  <option value="invited">Invited</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
                  Country
                </label>
                <select
                  value={filterCountry}
                  onChange={(e) => setFilterCountry(e.target.value)}
                  className={selectClass + " w-full"}
                >
                  <option value="">All</option>
                  {countryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
                  Customer Level
                </label>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value as "" | CustomerLevel)}
                  className={selectClass + " w-full"}
                >
                  <option value="">All</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                  <option value="diamond">Diamond</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Results count */}
        {(activeFilters > 0 || search) && (
          <p className="text-[12px] text-[var(--text-dim)] mb-4 px-1">
            Showing {filtered.length} of {accounts.length} accounts
          </p>
        )}

        {/* Table */}
        {loading ? (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                <div className="h-11 w-11 rounded-full bg-[var(--bg-surface-subtle)] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[var(--bg-surface-subtle)] rounded w-1/3" />
                  <div className="h-3 bg-[var(--bg-surface-subtle)] rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-16 text-center">
            <AccountsIcon size={48} className="text-[var(--text-barely)] mx-auto mb-4" />
            <p className="text-[var(--text-dim)] text-[15px] font-medium">
              {accounts.length === 0
                ? "No accounts yet"
                : "No accounts match your filters"}
            </p>
            <p className="text-[var(--text-ghost)] text-[13px] mt-1">
              {accounts.length === 0
                ? "Add the first Super Admin to get started."
                : "Try clearing filters or broadening your search."}
            </p>
            {accounts.length === 0 && (
              <Link
                href="/accounts/new"
                className="inline-flex items-center gap-2 mt-4 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all"
              >
                <Plus className="h-4 w-4" /> New Account
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-[var(--bg-surface-subtle)]/50">
                  <tr className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">
                    <th className="px-4 py-3 w-[280px]">Name</th>
                    <th className="px-3 py-3 w-[140px]">Username</th>
                    <th className="px-3 py-3">Login Email</th>
                    <th className="px-3 py-3 w-[90px]">Type</th>
                    <th className="px-3 py-3">Company</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3 w-[90px]">Status</th>
                    <th className="px-3 py-3 w-[100px]">Country</th>
                    <th className="px-3 py-3 w-[100px]">Level</th>
                    <th className="px-3 py-3 w-[100px]">Created</th>
                    <th className="px-3 py-3 w-[60px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filtered.map((row) => {
                    const { account: a, person, company, role, fullName, country, customerLevel } = row;
                    return (
                      <tr
                        key={a.id}
                        className="hover:bg-[var(--bg-surface-subtle)]/60 transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <Link href={`/accounts/${a.id}`} className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
                              {person?.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={person.avatar_url}
                                  alt={fullName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <UserCircle2 className="h-5 w-5 text-[var(--text-dim)]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                                {fullName}
                              </div>
                              {person?.job_title && (
                                <div className="text-[11px] text-[var(--text-dim)] truncate">
                                  {person.job_title}
                                </div>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-3 font-mono text-[12px] text-[var(--text-muted)]">
                          @{a.username}
                        </td>
                        <td className="px-3 py-3 text-[var(--text-muted)]">
                          <span className="flex items-center gap-1.5 truncate">
                            <Mail className="h-3 w-3 text-[var(--text-dim)] shrink-0" />
                            <span className="truncate">{a.login_email}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            {a.user_type}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[var(--text-muted)]">
                          {company ? (
                            <span className="flex items-center gap-1.5 truncate">
                              <Building2 className="h-3 w-3 text-[var(--text-dim)] shrink-0" />
                              <span className="truncate">{company.name}</span>
                            </span>
                          ) : (
                            <span className="text-[var(--text-ghost)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[var(--text-muted)]">
                          {role ? (
                            <span className="flex items-center gap-1.5 truncate">
                              <Shield className="h-3 w-3 text-[var(--text-dim)] shrink-0" />
                              <span className="truncate">{role.name}</span>
                            </span>
                          ) : (
                            <span className="text-[var(--text-ghost)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusColors[a.status]}`}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[var(--text-muted)]">
                          {country || <span className="text-[var(--text-ghost)]">—</span>}
                        </td>
                        <td className="px-3 py-3">
                          {customerLevel ? (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${levelColors[customerLevel]}`}
                            >
                              {customerLevel}
                            </span>
                          ) : (
                            <span className="text-[var(--text-ghost)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[var(--text-dim)] text-[11px]">
                          {new Date(a.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowMenu(a.id, e.currentTarget);
                            }}
                            disabled={working}
                            aria-haspopup="menu"
                            aria-expanded={openMenu === a.id}
                            className="h-8 w-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center justify-center ml-auto disabled:opacity-60"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet card list */}
            <div className="lg:hidden divide-y divide-[var(--border-subtle)]">
              {filtered.map((row) => {
                const { account: a, person, company, role, fullName, country, customerLevel } = row;
                return (
                  <div key={a.id} className="p-4 relative">
                    <Link href={`/accounts/${a.id}`} className="flex items-start gap-3">
                      <div className="h-11 w-11 shrink-0 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
                        {person?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={person.avatar_url}
                            alt={fullName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <UserCircle2 className="h-6 w-6 text-[var(--text-dim)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pr-10">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                            {fullName}
                          </span>
                          <span className="text-[11px] font-mono text-[var(--text-dim)]">
                            @{a.username}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[var(--text-dim)] mt-1 flex-wrap">
                          <span className="flex items-center gap-1 truncate max-w-full">
                            <Mail className="h-3 w-3" />
                            {a.login_email}
                          </span>
                          {company && (
                            <span className="flex items-center gap-1 truncate max-w-full">
                              <Building2 className="h-3 w-3" />
                              {company.name}
                            </span>
                          )}
                          {role && (
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              {role.name}
                            </span>
                          )}
                          {country && (
                            <span className="flex items-center gap-1">
                              <Flag className="h-3 w-3" />
                              {country}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusColors[a.status]}`}
                          >
                            {a.status}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-[var(--border-subtle)] text-[var(--text-muted)]">
                            {a.user_type}
                          </span>
                          {customerLevel && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${levelColors[customerLevel]}`}
                            >
                              {customerLevel}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRowMenu(a.id, e.currentTarget);
                      }}
                      disabled={working}
                      aria-haspopup="menu"
                      aria-expanded={openMenu === a.id}
                      className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center disabled:opacity-60"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Single root-level action dropdown. Rendered in a viewport-fixed
          layer so the parent table's overflow boundaries can't clip it. */}
      {openMenu && menuAnchor && (() => {
        const active = filtered.find((r) => r.account.id === openMenu)?.account;
        if (!active) return null;
        return (
          <RowMenu
            account={active}
            anchor={menuAnchor}
            onClose={() => {
              setOpenMenu(null);
              setMenuAnchor(null);
            }}
            onToggleStatus={() => actionToggleStatus(active)}
            onResetPassword={() => actionResetPassword(active)}
            onToggleForce={() => actionToggleForce(active)}
          />
        );
      })()}
    </div>
  );
}

/* ── Row menu popover ──
   Rendered at the component root (not inside the table row) so it
   escapes the table's `overflow-hidden` / `overflow-x-auto` clipping
   boundaries. Positioned via `position: fixed` against coordinates
   captured from the trigger button's `getBoundingClientRect()`. */

function RowMenu({
  account,
  anchor,
  onClose,
  onToggleStatus,
  onResetPassword,
  onToggleForce,
}: {
  account: AccountRow;
  anchor: { top: number; right: number };
  onClose: () => void;
  onToggleStatus: () => void;
  onResetPassword: () => void;
  onToggleForce: () => void;
}) {
  const isActive = account.status === "active";
  return (
    <>
      {/* Click-away backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        onClick={onClose}
      />
      <div
        role="menu"
        style={{ top: anchor.top, right: anchor.right }}
        className="fixed z-[70] w-56 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
      >
        <MenuItem icon={<Eye className="h-4 w-4" />} label="View" href={`/accounts/${account.id}`} />
        <MenuItem icon={<Pencil className="h-4 w-4" />} label="Edit" href={`/accounts/${account.id}/edit`} />
        <div className="h-px bg-[var(--border-subtle)]" />
        <MenuItem
          icon={isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          label={isActive ? "Deactivate" : "Activate"}
          onClick={onToggleStatus}
        />
        <MenuItem
          icon={<KeyRound className="h-4 w-4" />}
          label="Reset Password"
          onClick={onResetPassword}
        />
        <MenuItem
          icon={<RefreshCcw className="h-4 w-4" />}
          label={account.force_password_change ? "Clear Force Reset" : "Force Password Reset"}
          onClick={onToggleForce}
        />
      </div>
    </>
  );
}

function MenuItem({
  icon, label, href, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const base =
    "w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors text-left";
  if (href) {
    return (
      <Link href={href} className={base}>
        {icon}
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={base}>
      {icon}
      {label}
    </button>
  );
}
