"use client";

/* ---------------------------------------------------------------------------
   AccountsList — Table view of all accounts with search, filters, and
   per-row actions. Links to /accounts/[id] for detail.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus, Search, Filter, X, Users, UserCircle2, Shield, Mail, Phone,
  ChevronRight, Building2,
} from "lucide-react";
import {
  fetchAccounts, fetchCompanies, fetchRoles,
} from "@/lib/accounts-admin";
import type {
  AccountRow, CompanyRow, RoleRow, AccountStatus, UserType, CustomerLevel,
} from "@/types/supabase";

const selectClass =
  "h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors";

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

export default function AccountsList() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"" | UserType>("");
  const [filterStatus, setFilterStatus] = useState<"" | AccountStatus>("");
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, c, r] = await Promise.all([
        fetchAccounts(), fetchCompanies(), fetchRoles(),
      ]);
      setAccounts(a);
      setCompanies(c);
      setRoles(r);
      setLoading(false);
    })();
  }, []);

  const companyMap = useMemo(
    () => Object.fromEntries(companies.map((c) => [c.id, c])),
    [companies],
  );
  const roleMap = useMemo(
    () => Object.fromEntries(roles.map((r) => [r.id, r])),
    [roles],
  );

  const activeFilters =
    (filterType ? 1 : 0) +
    (filterStatus ? 1 : 0) +
    (filterCompany ? 1 : 0) +
    (filterRole ? 1 : 0);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (filterType && a.user_type !== filterType) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      if (filterCompany && a.company_id !== filterCompany) return false;
      if (filterRole && a.role_id !== filterRole) return false;
      if (search) {
        const q = search.toLowerCase();
        const hit =
          a.full_name.toLowerCase().includes(q) ||
          a.username.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.phone || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [accounts, search, filterType, filterStatus, filterCompany, filterRole]);

  function clearFilters() {
    setFilterType("");
    setFilterStatus("");
    setFilterCompany("");
    setFilterRole("");
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-xl md:text-[26px] font-bold text-[var(--text-primary)] flex items-center gap-2.5">
              <Users className="h-6 w-6 text-[var(--text-faint)]" />
              Accounts
            </h1>
            <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mt-1">
              {accounts.length} accounts across Koleex and customer workspaces
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/accounts/new"
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg"
            >
              <Plus className="h-4 w-4" />
              New Account
            </Link>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-4 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, username, email, phone…"
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
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1 uppercase tracking-wider">
                  Type
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
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as "" | AccountStatus)}
                  className={selectClass + " w-full"}
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
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
            </div>
          )}
        </div>

        {/* Results count */}
        {(activeFilters > 0 || search) && (
          <p className="text-[12px] text-[var(--text-dim)] mb-4 px-1">
            Showing {filtered.length} of {accounts.length} accounts
          </p>
        )}

        {/* List */}
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
            <Users className="h-12 w-12 text-[var(--text-barely)] mx-auto mb-4" />
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
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
            {filtered.map((a) => {
              const company = a.company_id ? companyMap[a.company_id] : null;
              const role = a.role_id ? roleMap[a.role_id] : null;
              return (
                <Link
                  key={a.id}
                  href={`/accounts/${a.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-[var(--bg-surface-subtle)] transition-colors group"
                >
                  {/* Avatar */}
                  <div className="h-11 w-11 shrink-0 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
                    {a.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.avatar_url}
                        alt={a.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserCircle2 className="h-6 w-6 text-[var(--text-dim)]" />
                    )}
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                        {a.full_name}
                      </span>
                      <span className="text-[11px] text-[var(--text-dim)]">
                        @{a.username}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusColors[a.status]}`}
                      >
                        {a.status}
                      </span>
                      {a.customer_level && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${levelColors[a.customer_level]}`}
                        >
                          {a.customer_level}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--text-dim)] mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {a.email}
                      </span>
                      {a.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {a.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Company / role */}
                  <div className="hidden md:flex flex-col items-end text-[11px] text-[var(--text-dim)] min-w-[160px]">
                    {company && (
                      <span className="flex items-center gap-1 text-[var(--text-muted)]">
                        <Building2 className="h-3 w-3" />
                        {company.name}
                      </span>
                    )}
                    {role && (
                      <span className="flex items-center gap-1 mt-0.5">
                        <Shield className="h-3 w-3" />
                        {role.name}
                      </span>
                    )}
                    <span className="uppercase tracking-wider mt-0.5 opacity-60">
                      {a.user_type}
                    </span>
                  </div>

                  <ChevronRight className="h-4 w-4 text-[var(--text-ghost)] group-hover:text-[var(--text-primary)] transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
