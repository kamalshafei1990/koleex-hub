"use client";

/* ---------------------------------------------------------------------------
   Employees — Employee directory listing.
   Layout matches Products app: min-h-screen, max-w container, natural scroll.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import FilterIcon from "@/components/icons/ui/FilterIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import EmployeesIcon from "@/components/icons/EmployeesIcon";
import {
  fetchEmployeeList,
  fetchDepartments as fetchDepts,
  type EmployeeListItem,
} from "@/lib/employees-admin";
import { useTranslation } from "@/lib/i18n";
import { employeesT } from "@/lib/translations/employees";
import type { DepartmentRow } from "@/types/supabase";

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  on_leave: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  terminated: "text-red-400 bg-red-400/10 border-red-400/20",
  inactive: "text-slate-400 bg-slate-400/10 border-slate-400/20",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  on_leave: "On Leave",
  terminated: "Terminated",
  inactive: "Inactive",
};

const TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  intern: "Intern",
  freelance: "Freelance",
};

const LOCATION_LABELS: Record<string, string> = {
  office: "Office",
  remote: "Remote",
  hybrid: "Hybrid",
};

/* ═══════════════════════════════════════════════════
   AVATAR
   ═══════════════════════════════════════════════════ */

function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center shrink-0 text-[var(--text-dim)]" style={{ width: size, height: size }}>
      {initials ? <span className="font-semibold" style={{ fontSize: size * 0.38 }}>{initials}</span> : <UserIcon size={size * 0.45} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════ */

export default function EmployeesPage() {
  const { t } = useTranslation(employeesT);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      const [emps, depts] = await Promise.all([fetchEmployeeList(), fetchDepts()]);
      setEmployees(emps);
      setDepartments(depts);
      setLoading(false);
    })();
  }, []);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (filterDept && e.department_id !== filterDept) return false;
      if (filterStatus && e.employment_status !== filterStatus) return false;
      if (filterType && e.employment_type !== filterType) return false;
      if (filterLocation && e.work_location !== filterLocation) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.person.full_name.toLowerCase().includes(q) &&
          !e.employee_number?.toLowerCase().includes(q) &&
          !e.work_email?.toLowerCase().includes(q) &&
          !e.person.email?.toLowerCase().includes(q) &&
          !e.position_title?.toLowerCase().includes(q) &&
          !e.department_name?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [employees, search, filterDept, filterStatus, filterType, filterLocation]);

  const activeFilterCount = [filterDept, filterStatus, filterType, filterLocation].filter(Boolean).length;
  const clearAllFilters = () => { setFilterDept(""); setFilterStatus(""); setFilterType(""); setFilterLocation(""); setSearch(""); };

  const selectCls = "h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-secondary)] outline-none focus:border-[var(--border-focus)]";

  /* ── Stats ── */
  const totalActive = employees.filter((e) => e.employment_status === "active").length;
  const totalDepts = new Set(employees.map((e) => e.department_id).filter(Boolean)).size;
  const totalOnLeave = employees.filter((e) => e.employment_status === "on_leave").length;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              <EmployeesIcon size={16} />
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">{t("app.title")}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/employees/new"
              className="h-10 px-3 sm:px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg"
              aria-label={t("app.add")}
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t("app.add")}</span>
            </Link>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-dim)] mb-6 md:mb-8 ml-0 md:ml-11">
          {t("list.showing", `${employees.length} employees`).replace("{x}", String(employees.length)).replace("{y}", String(employees.length))}
        </p>

        {/* Search + Filters */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-4 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t("list.search")}
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                  <CrossIcon size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 px-3.5 rounded-xl border text-[13px] font-medium flex items-center gap-2 transition-colors ${
                showFilters || activeFilterCount ? "bg-[var(--bg-surface)] border-[var(--border-focus)] text-[var(--text-primary)]" : "bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
              }`}
            >
              <FilterIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t("list.filters")}</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>
          </div>
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] mb-1">{t("list.department")}</label>
                <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className={selectCls + " w-full"}>
                  <option value="">{t("list.all")}</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[130px]">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] mb-1">{t("list.status")}</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls + " w-full"}>
                  <option value="">{t("list.all")}</option>
                  {Object.keys(STATUS_LABELS).map((k) => <option key={k} value={k}>{t(`status.${k}`, STATUS_LABELS[k])}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[130px]">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] mb-1">{t("list.type")}</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectCls + " w-full"}>
                  <option value="">{t("list.all")}</option>
                  {Object.keys(TYPE_LABELS).map((k) => <option key={k} value={k}>{t(`type.${k}`, TYPE_LABELS[k])}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[130px]">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] mb-1">{t("list.location")}</label>
                <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className={selectCls + " w-full"}>
                  <option value="">{t("list.all")}</option>
                  {Object.keys(LOCATION_LABELS).map((k) => <option key={k} value={k}>{t(`loc.${k}`, LOCATION_LABELS[k])}</option>)}
                </select>
              </div>
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} className="h-10 px-3 rounded-lg text-[12px] text-red-400 hover:bg-red-400/10 font-medium transition-colors">{t("list.filters")} · {t("cancel")}</button>
              )}
            </div>
          )}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-blue-400" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-400"><UsersIcon size={15} /></div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("list.all", "Total")}</span>
            </div>
            <div className="text-[32px] font-extrabold tracking-tight text-[var(--text-primary)] leading-none">{employees.length}</div>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-emerald-400" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400"><CheckIcon size={15} /></div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("status.active")}</span>
            </div>
            <div className="text-[32px] font-extrabold tracking-tight text-[var(--text-primary)] leading-none">{totalActive}</div>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-violet-400" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/10 text-violet-400"><Building2Icon size={15} /></div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("list.department")}</span>
            </div>
            <div className="text-[32px] font-extrabold tracking-tight text-[var(--text-primary)] leading-none">{totalDepts}</div>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-amber-400" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-400"><BriefcaseIcon size={15} /></div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("status.on_leave")}</span>
            </div>
            <div className="text-[32px] font-extrabold tracking-tight text-[var(--text-primary)] leading-none">{totalOnLeave}</div>
          </div>
        </div>

        {/* Employee list */}
        {loading ? (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-16 text-center">
            <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin mx-auto" />
            <p className="text-[13px] mt-3 text-[var(--text-dim)]">{t("loading")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center mx-auto mb-4">
              <UsersIcon size={24} className="text-[var(--text-dim)] opacity-40" />
            </div>
            <p className="text-[14px] font-semibold text-[var(--text-secondary)] mb-1">
              {employees.length === 0 ? t("list.empty.title") : t("list.noResults")}
            </p>
            <p className="text-[12px] text-[var(--text-dim)]">
              {employees.length === 0 ? t("list.empty.body") : ""}
            </p>
            {employees.length === 0 && (
              <Link href="/employees/new" className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 transition-all">
                <PlusIcon className="h-4 w-4" /> {t("app.add")}
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            {/* Table header — desktop */}
            <div className="hidden md:flex items-center gap-4 px-4 py-2.5 border-b border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
              <div className="w-10 shrink-0" />
              <div className="flex-1 min-w-0">{t("list.col.employee")}</div>
              <div className="w-[180px] shrink-0">{t("list.col.dept")}</div>
              <div className="w-[160px] shrink-0">{t("list.col.position")}</div>
              <div className="w-[100px] shrink-0">{t("list.col.type")}</div>
              <div className="w-[90px] shrink-0">{t("list.col.status")}</div>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {filtered.map((emp) => (
                /* Row links to the per-employee profile at
                   /employees/[id]. The profile page aggregates
                   cross-app activity (CRM, Quotations, Projects,
                   Todos, HR leave, Notes, Calendar). */
                <Link
                  key={emp.id}
                  href={`/employees/${emp.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                >
                  <Avatar src={emp.person.avatar_url} name={emp.person.full_name} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{emp.person.full_name}</span>
                      {emp.employee_number && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[var(--bg-surface)] text-[var(--text-faint)] border border-[var(--border-faint)] shrink-0">{emp.employee_number}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {emp.work_email && <span className="flex items-center gap-1 text-[11px] text-[var(--text-dim)] truncate"><EnvelopeIcon size={10} /> {emp.work_email}</span>}
                      {emp.work_phone && <span className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]"><PhoneIcon size={10} /> {emp.work_phone}</span>}
                    </div>
                    {/* Mobile-only */}
                    <div className="md:hidden flex items-center gap-2 mt-1 flex-wrap">
                      {emp.department_name && <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[var(--text-dim)] border border-[var(--border-faint)]">{emp.department_name}</span>}
                      {emp.position_title && <span className="text-[11px] text-[var(--text-dim)]">{emp.position_title}</span>}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${STATUS_COLORS[emp.employment_status] || STATUS_COLORS.inactive}`}>
                        {t(`status.${emp.employment_status}`, STATUS_LABELS[emp.employment_status] || emp.employment_status)}
                      </span>
                    </div>
                  </div>
                  <div className="hidden md:block w-[180px] shrink-0 truncate text-[13px] text-[var(--text-secondary)]">
                    {emp.department_name || <span className="text-[var(--text-faint)]">&mdash;</span>}
                  </div>
                  <div className="hidden md:block w-[160px] shrink-0 truncate text-[13px] text-[var(--text-secondary)]">
                    {emp.position_title || <span className="text-[var(--text-faint)]">&mdash;</span>}
                  </div>
                  <div className="hidden md:block w-[100px] shrink-0 text-[12px] text-[var(--text-dim)]">
                    {t(`type.${emp.employment_type}`, TYPE_LABELS[emp.employment_type] || emp.employment_type)}
                  </div>
                  <div className="hidden md:block w-[90px] shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-md border ${STATUS_COLORS[emp.employment_status] || STATUS_COLORS.inactive}`}>
                      {STATUS_LABELS[emp.employment_status] || emp.employment_status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p className="text-[11px] text-[var(--text-faint)] mt-3 text-center">
            {t("list.showing").replace("{x}", String(filtered.length)).replace("{y}", String(employees.length))}
          </p>
        )}
      </div>
    </div>
  );
}
