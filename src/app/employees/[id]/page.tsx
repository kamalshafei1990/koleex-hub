"use client";

/* ---------------------------------------------------------------------------
   Employee Profile — /employees/[id]

   Overview + cross-app activity feed for one employee. Solves gap #3
   from the connectivity audit: every module (CRM, Quotations, Invoices,
   Projects, Tasks, Todos, HR Leave, Calendar, Notes) is already keyed to
   the same account_id / employee_id, but nobody had built the view that
   made the links visible. This page is that view.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState, use } from "react";
import { fpAvatar } from "@/lib/cdn";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import CreditCardIcon from "@/components/icons/ui/CreditCardIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import KeyIcon from "@/components/icons/ui/KeyIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import { resolveHrFileUrl } from "@/components/hr/HrFileField";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import {
  fetchEmployeeProfile,
  fetchEmployeeActivity,
  deleteEmployee,
  type ActivityBucket,
  type ActivityItem,
  type EmployeeActivity,
} from "@/lib/employees-admin";
import { usePermissions } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";
import { employeesT } from "@/lib/translations/employees";
import type { EmployeeWithLinks } from "@/types/supabase";

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  on_leave: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  terminated: "text-red-400 bg-red-400/10 border-red-400/20",
  inactive: "text-slate-400 bg-slate-400/10 border-slate-400/20",
};

const TABS = ["overview", "activity", "hr"] as const;
type Tab = (typeof TABS)[number];

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

function Avatar({ src, name, size = 64 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className="rounded-2xl object-cover shrink-0" style={{ width: size, height: size }} />
    );
  }
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center shrink-0 text-[var(--text-dim)]"
      style={{ width: size, height: size }}
    >
      {initials ? <span className="font-semibold" style={{ fontSize: size * 0.36 }}>{initials}</span> : <UserIcon size={size * 0.5} />}
    </div>
  );
}

function formatCurrency(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || ""} ${amount}`;
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

/* ═══════════════════════════════════════════════════
   REUSABLE BITS
   ═══════════════════════════════════════════════════ */

/* Panels are `self-start` on purpose: in a grid they used to stretch to the
   tallest row, so a 4-row card sat in an 8-row box and the page read as a
   sparse wall of blocks. Height now follows content. */
const panelCls =
  "self-start bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-4 md:p-5";

/* ── Record-page grammar ───────────────────────────────────────────────
   Same shell the Supplier 360 uses, so a KOLEEX record always looks like a
   KOLEEX record: a centered hero card with a metric rail fused to its bottom
   edge, then GROUP bands, then one bordered card per section with an icon
   chip and a label-above-value field grid. */

/** Uppercase band that clusters the sections below it into a named group. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 md:mx-6 mt-6 mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-faint)]">
      {children}
    </div>
  );
}

/** One section card — icon chip + title header, collapsible, body below. */
function Sec({
  icon: Icon, title, children, defaultOpen = true,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mx-4 md:mx-6 my-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/30 px-4 md:px-5 py-3 text-start transition-colors hover:bg-[var(--bg-surface-subtle)]/60 ${open ? "" : "border-b-transparent"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
            <Icon size={15} />
          </span>
          <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)] truncate">{title}</h3>
        </div>
        <AngleDownIcon className={`h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform ${open ? "" : "-rotate-90 rtl:rotate-90"}`} />
      </button>
      {open ? <div className="px-4 md:px-5 py-4">{children}</div> : null}
    </div>
  );
}

/** Label-above-value grid. Empty rows are dropped, so a section shows what
    exists rather than a column of em-dashes; if nothing exists it says so. */
function FieldGrid({ rows, empty }: { rows: { label: string; value?: React.ReactNode }[]; empty: string }) {
  const filled = rows.filter(
    (r) => r.value != null && r.value !== "" && !(typeof r.value === "string" && !r.value.trim()),
  );
  if (!filled.length) {
    return <p className="text-[12px] text-[var(--text-faint)]">{empty}</p>;
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-3.5">
      {filled.map((r) => (
        <div key={r.label} className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{r.label}</span>
          <p className="text-sm text-[var(--text-primary)] break-words">{r.value}</p>
        </div>
      ))}
    </div>
  );
}

/** Opens a private hr-documents file. The stored value is a PATH, not a URL:
    the bucket is private, so the link is minted on demand and expires. An
    <img src={path}> would simply 400 — and if it ever rendered, that would mean
    the bucket had been made public, which is the bug this guards against. */
function SecureDocLink({ path, label }: { path: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      /* Same resolver HrFileField uses — one signing path for hr-documents, so
         bucket name and expiry are decided in exactly one place. */
      const url = await resolveHrFileUrl(path);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally { setBusy(false); }
  };
  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors disabled:opacity-50"
    >
      <DocumentIcon size={12} />
      {busy ? "Opening…" : label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════
   ACTIVITY CARDS
   ═══════════════════════════════════════════════════ */

function ActivityCard({
  title, icon: Icon, bucket, appHref, emptyHint,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  bucket: ActivityBucket;
  appHref: string;
  emptyHint: string;
}) {
  const { count, recent } = bucket;
  return (
    <div className={panelCls}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center text-[var(--text-dim)] shrink-0" aria-hidden>
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight truncate">{title}</h3>
            <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
              {count === 0 ? emptyHint : `${count} total`}
            </p>
          </div>
        </div>
        {count > 0 && (
          <Link
            href={appHref}
            className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
          >
            Open <ArrowRightIcon size={10} />
          </Link>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="text-[12px] text-[var(--text-faint)] py-3">—</div>
      ) : (
        <ul className="divide-y divide-[var(--border-faint)]">
          {recent.map((r) => <ActivityRow key={r.id} item={r} />)}
        </ul>
      )}
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const amount = formatCurrency(item.amount, item.currency);
  const body = (
    <div className="flex items-center gap-3 py-2 min-w-0">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{item.title}</div>
        {item.subtitle && (
          <div className="text-[11px] text-[var(--text-dim)] truncate mt-0.5">{item.subtitle}</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.status && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border border-[var(--border-faint)] bg-[var(--bg-surface)] text-[var(--text-dim)] capitalize">
            {item.status.replace(/_/g, " ")}
          </span>
        )}
        {amount && <span className="text-[12px] font-semibold text-[var(--text-primary)]">{amount}</span>}
      </div>
    </div>
  );
  return (
    <li>
      {item.href ? (
        <Link href={item.href} className="block hover:bg-[var(--bg-surface-subtle)] rounded-lg px-1 -mx-1 transition-colors">
          {body}
        </Link>
      ) : body}
    </li>
  );
}

/* ── Behavior & Conduct standing (read-only) ──────────────────────────────
   Surfaces the LATEST FINALIZED behavior assessment for this employee, plus a
   count of drafts awaiting review and a deep-link into the HR › Behavior tab.
   Fetches the HR-gated endpoint; a viewer without HR read simply sees nothing
   (graceful) — behavior standing is not exposed to non-HR profile viewers.
   Skills and Behavior are shown as separate, never-combined signals. */
interface BehaviorAssessmentRow {
  id: string;
  assessment_type: string;
  status: string;
  finalized_at: string | null;
  overall_behavior_score: number | null;
  position_behavior_match: number | null;
  critical_gap_count: number | null;
  recommendation: string | null;
  created_at: string;
}

const BEHAVIOR_LEVEL_COLOR: Record<string, string> = {
  Exemplary: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Strong: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Acceptable: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "Needs Improvement": "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Poor: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Unacceptable: "text-red-400 bg-red-400/10 border-red-400/20",
};

function behaviorBand(score: number): string {
  if (score >= 90) return "Exemplary";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Acceptable";
  if (score >= 40) return "Needs Improvement";
  if (score >= 20) return "Poor";
  return "Unacceptable";
}

function BehaviorStanding({ employeeId, t }: { employeeId: string; t: (k: string) => string }) {
  const [rows, setRows] = useState<BehaviorAssessmentRow[] | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/hr/behavior?employee_id=${encodeURIComponent(employeeId)}`, { credentials: "include" });
        if (!alive) return;
        if (res.status === 403 || res.status === 401) { setForbidden(true); return; }
        if (!res.ok) { setRows([]); return; }
        const data = await res.json();
        setRows((data.assessments ?? []) as BehaviorAssessmentRow[]);
      } catch { if (alive) setRows([]); }
    })();
    return () => { alive = false; };
  }, [employeeId]);

  /* Non-HR viewers (or no data yet) — render nothing rather than an empty shell. */
  if (forbidden || rows === null || rows.length === 0) return null;

  const latest = rows.find((r) => r.status === "finalized" && r.overall_behavior_score != null) ?? null;
  const draftCount = rows.filter((r) => r.status === "draft").length;
  const score = latest?.overall_behavior_score != null ? Math.round(Number(latest.overall_behavior_score)) : null;
  const band = score != null ? behaviorBand(score) : null;

  return (
    <Sec icon={ShieldIcon} title={t("hr.behaviorConduct")}>
      {latest ? (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-[var(--text-primary)] tabular-nums">{score}</span>
            <span className="text-[11px] text-[var(--text-dim)]">/ 100</span>
          </div>
          {band && (
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border ${BEHAVIOR_LEVEL_COLOR[band] ?? ""}`}>
              {band}
            </span>
          )}
          {latest.position_behavior_match != null && (
            <div className="text-[12px] text-[var(--text-dim)]">
              {t("hr.behaviorMatch")}: <span className="font-semibold text-[var(--text-primary)]">{Math.round(Number(latest.position_behavior_match))}%</span>
            </div>
          )}
          {(latest.critical_gap_count ?? 0) > 0 && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md border text-red-400 bg-red-400/10 border-red-400/20">
              {latest.critical_gap_count} {t("hr.behaviorCriticalGaps")}
            </span>
          )}
          <div className="text-[11px] text-[var(--text-dim)]">
            {t("hr.behaviorAsOf")} {latest.finalized_at ? formatDate(latest.finalized_at) : formatDate(latest.created_at)}
          </div>
        </div>
      ) : (
        <div className="text-[13px] text-[var(--text-dim)]">{t("hr.behaviorNoFinal")}</div>
      )}
      <div className="mt-4 flex items-center gap-3">
        {draftCount > 0 && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md border border-[var(--border-faint)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
            {draftCount} {t("hr.behaviorDrafts")}
          </span>
        )}
        <Link
          href={`/hr?tab=behavior&employee=${encodeURIComponent(employeeId)}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
        >
          {t("hr.behaviorOpenHr")}
          <ArrowRightIcon size={12} />
        </Link>
      </div>
    </Sec>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════ */

export default function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = useTranslation(employeesT);
  const { id } = use(params);
  const router = useRouter();
  const perms = usePermissions();
  const [profile, setProfile] = useState<EmployeeWithLinks | null>(null);
  const [activity, setActivity] = useState<EmployeeActivity | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEdit = perms.can("Employees", "edit");
  const canDelete = perms.can("Employees", "delete");

  const onDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteEmployee(id);
    setDeleting(false);
    if (!res.ok) { setDeleteError(res.error ?? "Delete failed."); return; }
    router.push("/employees");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const prof = await fetchEmployeeProfile(id);
      if (cancelled) return;
      if (!prof) { setNotFound(true); setLoading(false); return; }
      setProfile(prof);
      /* Kick off the activity load in parallel — profile header can
         render immediately while the cross-app queries resolve. */
      const act = await fetchEmployeeActivity(prof.employee.id, prof.account?.id ?? null);
      if (cancelled) return;
      setActivity(act);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const activityTotal = useMemo(() => {
    if (!activity) return 0;
    return activity.crmOpportunities.count
      + activity.quotations.count
      + activity.invoices.count
      + activity.projectsManaged.count
      + activity.tasksAssigned.count
      + activity.todosAssigned.count
      + activity.leaveRequests.count
      + activity.calendarEvents.count
      + activity.notes.count;
  }, [activity]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <UserIcon size={32} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-sm text-[var(--text-primary)] font-medium mb-1">{t("profile.notFound")}</p>
          <Link href="/employees" className="text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] underline underline-offset-2">
            {t("back.toList")}
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <SpinnerIcon size={28} className="animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  const { person, employee, account, department, position } = profile;
  const statusKey = employee.employment_status || "inactive";

  /* Stored as jsonb; a bad row must not blank the page. */
  const socialAccounts: { platform: string; value: string }[] = Array.isArray(employee.social_accounts)
    ? (employee.social_accounts as { platform: string; value: string }[]).filter((a) => a?.platform && a?.value)
    : [];

  /* Tenure, computed once — the single fact a manager scans for that no
     column in the table carries. */
  const tenure = (() => {
    if (!employee.hire_date) return null;
    const from = new Date(employee.hire_date);
    if (Number.isNaN(from.getTime())) return null;
    const months = Math.max(0, Math.round((Date.now() - from.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
    const y = Math.floor(months / 12);
    const m = months % 12;
    return y > 0 ? `${y}${t("unit.year")}${m ? ` ${m}${t("unit.month")}` : ""}` : `${m}${t("unit.month")}`;
  })();

  /* Six cells on purpose: 2 / 3 / 6 columns all divide evenly, so the band
     never ends in a ragged half-row. Each fact appears HERE and nowhere else
     in the hero — the pills above used to repeat type, location and number. */
  const metrics: { label: string; value: string; accent?: "emerald" | "amber" }[] = [
    { label: t("kpi.employeeNo"), value: employee.employee_number || "—" },
    { label: t("kpi.tenure"), value: tenure ?? "—" },
    { label: t("kpi.type"), value: employee.employment_type?.replace(/_/g, " ") || "—" },
    { label: t("kpi.location"), value: employee.work_location || "—" },
    { label: t("kpi.hired"), value: employee.hire_date ? formatDate(employee.hire_date) : "—" },
    { label: t("kpi.account"), value: account ? t("kpi.linked") : t("kpi.none"), accent: account ? "emerald" : "amber" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      <div className="max-w-[1500px] mx-auto">

        {/* ═══ HERO ═══════════════════════════════════════════════════════
            The record announces itself once, centered, then hands over to the
            sections. Same shell as the Supplier 360 so every KOLEEX record
            reads the same way. */}
        <div className="mx-4 md:mx-6 mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
          <div className="px-5 sm:px-8 md:px-10 pt-5 md:pt-6">

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/employees"
                aria-label={t("back.toList")}
                title={t("back.toList")}
                className="flex items-center gap-1.5 shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
              >
                <ArrowLeftIcon size={14} className="rtl:rotate-180" />
                <span className="hidden sm:inline">{t("app.title")}</span>
              </Link>
              <div className="flex items-center gap-1.5">
                {canEdit && (
                  <Link
                    href={`/employees/${id}/edit`}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-hover)]"
                  >
                    <PencilIcon size={13} />
                    <span className="hidden sm:inline">Edit</span>
                  </Link>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => { setDeleteError(null); setConfirmDelete(true); }}
                    className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-[12px] font-medium text-red-500 transition-colors hover:bg-red-500/20"
                  >
                    <TrashIcon size={13} />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}
              </div>
            </div>

            {/* Centered identity */}
            <div className="flex flex-col items-center text-center pt-1 pb-7 md:pb-8">
              <div className="w-24 h-24 rounded-2xl bg-[var(--bg-surface-subtle)] ring-1 ring-[var(--border-subtle)] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex items-center justify-center">
                <Avatar src={fpAvatar(person.avatar_url)} name={person.full_name} size={96} />
              </div>

              <h1 className="mt-4 max-w-2xl text-2xl md:text-[28px] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
                {person.full_name}
              </h1>
              {(person as { name_alt?: string | null }).name_alt && (
                <p lang="zh" className="mt-1 text-[14px] text-[var(--text-faint)]">
                  {(person as { name_alt?: string | null }).name_alt}
                </p>
              )}

              {/* Position › department, read as a path like the supplier taxonomy */}
              {(position?.title || department?.name) && (
                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                  {position?.title && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--bg-surface-subtle)] ring-1 ring-[var(--border-subtle)]">
                        <BriefcaseIcon size={12} className="text-[var(--text-faint)]" />
                      </span>
                      {position.title}
                    </span>
                  )}
                  {position?.title && department?.name && (
                    <AngleRightIcon className="h-3 w-3 text-[var(--text-ghost)] rtl:rotate-180" />
                  )}
                  {department?.name && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--bg-surface-subtle)] ring-1 ring-[var(--border-subtle)]">
                        <Building2Icon size={12} className="text-[var(--text-faint)]" />
                      </span>
                      {department.name}
                    </span>
                  )}
                </div>
              )}

              {/* Status only — everything else the pills used to carry is in
                  the labelled stat band below, where it can't be misread. */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border capitalize ${STATUS_COLORS[statusKey] || STATUS_COLORS.inactive}`}>
                  {statusKey.replace(/_/g, " ")}
                </span>
              </div>

              {/* No login account — stated here, once, where it changes what the
                  reader can expect from the Activity tab below. */}
              {!account && (
                <div className="mt-3.5 mx-auto flex max-w-xl items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.08] px-3.5 py-2.5 text-start">
                  <KeyIcon size={14} className="mt-0.5 shrink-0 text-amber-500" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-amber-600 dark:text-amber-300">{t("profile.noAccount.title")}</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-amber-600/85 dark:text-amber-300/80">{t("profile.noAccount.body")}</p>
                    <Link
                      href={`/accounts?person=${person.id}`}
                      className="mt-2 inline-flex h-7 items-center rounded-lg border border-amber-400/40 px-2.5 text-[11px] font-medium text-amber-600 transition-colors hover:bg-amber-400/10 dark:text-amber-300"
                    >
                      {t("profile.noAccount.cta")}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stat band — a GRID, not wrapping pills. Seven pills centred by
              flex-wrap collapsed into ragged 2-2-2-1 rows on a phone, which is
              exactly the "not organised" complaint. A grid keeps the values in
              aligned columns at every width. The 1px gap over a tinted parent
              draws the hairline lattice for free, whatever the row count. */}
          <div className="border-t border-[var(--border-subtle)] bg-[var(--border-subtle)]/60 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px">
            {metrics.map((m) => (
              <div key={m.label} className="bg-[var(--bg-secondary)] px-3 py-3 text-center">
                <div className={`text-[13.5px] font-semibold leading-tight tabular-nums capitalize truncate ${
                  m.accent === "emerald" ? "text-emerald-600 dark:text-emerald-400"
                  : m.accent === "amber" ? "text-amber-600 dark:text-amber-400"
                  : "text-[var(--text-primary)]"}`}>
                  {m.value}
                </div>
                <div className="mt-1 text-[9.5px] font-medium uppercase tracking-wider text-[var(--text-faint)] truncate">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ Tabs — full-width opaque strip so content scrolls behind it ═══ */}
        <div className="sticky top-0 z-20 bg-[var(--bg-primary)] px-4 md:px-6 pt-3 pb-2">
          <nav className="flex gap-1 overflow-x-auto rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1.5 py-1.5 scrollbar-none">
            {TABS.map((tabKey) => {
              const base = tabKey === "overview" ? t("tab.overview")
                : tabKey === "activity" ? t("tab.activity")
                : t("tab.hr");
              const label = tabKey === "activity" && activity ? `${base} · ${activityTotal}` : base;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setTab(tabKey)}
                  aria-current={tab === tabKey ? "page" : undefined}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors ${
                    tab === tabKey
                      ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                      : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        </div>

        {tab === "overview" && (
          <>
            <GroupLabel>{t("grp.identity")}</GroupLabel>
            <Sec icon={UserIcon} title={t("ov.personal")}>
              <FieldGrid
                empty={t("sec.empty")}
                rows={[
                  { label: "Full name", value: person.full_name },
                  { label: "Gender", value: employee.gender },
                  { label: "Nationality", value: employee.nationality },
                  { label: "Birthday", value: employee.birth_date ? formatDate(employee.birth_date) : null },
                  { label: "Marital", value: employee.marital_status },
                  { label: "Languages", value: employee.languages },
                  { label: "Personal email", value: person.email },
                  { label: "Personal phone", value: person.phone },
                ]}
              />
            </Sec>

            <Sec icon={EnvelopeIcon} title={t("ov.workContact")}>
              <FieldGrid
                empty={t("sec.empty")}
                rows={[
                  { label: "Work email", value: employee.work_email },
                  { label: "Work phone", value: employee.work_phone },
                  { label: "Address", value: [person.address_line1, person.address_line2, person.city, person.state, person.country].filter(Boolean).join(", ") },
                  { label: "Postal code", value: person.postal_code },
                  { label: "WeChat", value: employee.wechat_id },
                ]}
              />
              {/* Social handles + the WeChat QR. Both are how you actually
                  reach this person, so they belong beside the phone number
                  rather than in a separate tab. */}
              {(socialAccounts.length > 0 || employee.wechat_qr_url) && (
                <div className="mt-4 flex flex-wrap items-start gap-2">
                  {socialAccounts.map((a, i) => (
                    <span key={`${a.platform}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] px-2.5 py-1 text-[12px]">
                      <span className="text-[var(--text-faint)]">{a.platform}</span>
                      <span className="text-[var(--text-primary)] break-all">{a.value}</span>
                    </span>
                  ))}
                  {employee.wechat_qr_url && (
                    <SecureDocLink path={employee.wechat_qr_url} label="WeChat QR" />
                  )}
                </div>
              )}
            </Sec>

            <GroupLabel>{t("grp.employment")}</GroupLabel>
            <Sec icon={BriefcaseIcon} title={t("ov.employment")}>
              <FieldGrid
                empty={t("sec.empty")}
                rows={[
                  { label: "Employee #", value: employee.employee_number },
                  { label: "Type", value: employee.employment_type?.replace(/_/g, " ") },
                  { label: "Department", value: department?.name },
                  { label: "Position", value: position?.title },
                  { label: "Work location", value: employee.work_location },
                  { label: "Hire date", value: employee.hire_date ? formatDate(employee.hire_date) : null },
                  { label: "Contract end", value: employee.contract_end_date ? formatDate(employee.contract_end_date) : null },
                  { label: "Probation end", value: employee.probation_end_date ? formatDate(employee.probation_end_date) : null },
                ]}
              />
            </Sec>

            <Sec icon={ShieldIcon} title={t("ov.emergency")}>
              <FieldGrid
                empty={t("sec.empty")}
                rows={[
                  { label: "Primary", value: employee.emergency_contact_name },
                  { label: "Phone", value: employee.emergency_contact_phone },
                  { label: "Relation", value: employee.emergency_contact_relationship },
                  { label: "Secondary", value: employee.emergency_contact2_name },
                  { label: "Phone", value: employee.emergency_contact2_phone },
                  { label: "Relation", value: employee.emergency_contact2_relationship },
                ]}
              />
            </Sec>
          </>
        )}

        {tab === "activity" && (
          <>
            <GroupLabel>{t("grp.activity")}</GroupLabel>
            {!activity ? (
              <div className="flex items-center justify-center py-16">
                <SpinnerIcon size={20} className="animate-spin text-[var(--text-dim)]" />
              </div>
            ) : (
              <div className="mx-4 md:mx-6 my-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <ActivityCard title="CRM Opportunities" icon={UserIcon} bucket={activity.crmOpportunities} appHref="/crm" emptyHint="No opportunities owned yet" />
                <ActivityCard title="Quotations" icon={DocumentIcon} bucket={activity.quotations} appHref="/quotations" emptyHint="No quotations created yet" />
                <ActivityCard title="Invoices" icon={CreditCardIcon} bucket={activity.invoices} appHref="/invoices" emptyHint="No invoices created yet" />
                <ActivityCard title="Projects Managed" icon={BriefcaseIcon} bucket={activity.projectsManaged} appHref="/projects" emptyHint="Not managing any projects" />
                <ActivityCard title="Open Tasks" icon={CheckIcon} bucket={activity.tasksAssigned} appHref="/projects" emptyHint="No tasks assigned" />
                <ActivityCard title="Todos" icon={CheckIcon} bucket={activity.todosAssigned} appHref="/todo" emptyHint="No open todos" />
                <ActivityCard title="Leave Requests" icon={ShieldIcon} bucket={activity.leaveRequests} appHref="/hr" emptyHint="No leave history" />
                <ActivityCard title="Calendar" icon={BriefcaseIcon} bucket={activity.calendarEvents} appHref="/calendar" emptyHint="No recent events" />
                <ActivityCard title="Notes" icon={DocumentIcon} bucket={activity.notes} appHref="/notes" emptyHint="No notes yet" />
              </div>
            )}
          </>
        )}

        {tab === "hr" && (
          <>
            <GroupLabel>{t("grp.compensation")}</GroupLabel>
            <Sec icon={CreditCardIcon} title={t("hr.compensation")}>
              <FieldGrid
                empty={t("sec.empty")}
                rows={[
                  { label: "Initial salary", value: employee.initial_salary != null ? formatCurrency(employee.initial_salary, employee.salary_currency) : null },
                  { label: "Currency", value: employee.bank_currency },
                  { label: "Bank", value: employee.bank_name },
                  { label: "Holder", value: employee.bank_account_holder },
                  { label: "Account #", value: employee.bank_account_number },
                  { label: "IBAN", value: employee.bank_iban },
                  { label: "SWIFT", value: employee.bank_swift },
                ]}
              />
            </Sec>

            <GroupLabel>{t("grp.records")}</GroupLabel>
            <Sec icon={DocumentIcon} title={t("hr.documents")}>
              <FieldGrid
                empty={t("sec.empty")}
                rows={[
                  { label: "National ID", value: employee.identification_id },
                  { label: "Passport", value: employee.passport_number },
                  { label: "SSN", value: employee.social_security_number },
                  { label: "Tax ID", value: employee.tax_id },
                  { label: "Visa #", value: employee.visa_number },
                  { label: "Visa expiry", value: employee.visa_expiry_date ? formatDate(employee.visa_expiry_date) : null },
                  { label: "License #", value: employee.driving_license_number },
                  { label: "License expiry", value: employee.driving_license_expiry ? formatDate(employee.driving_license_expiry) : null },
                ]}
              />
              {(employee.national_id_doc_url || employee.national_id_back_doc_url || employee.passport_doc_url || employee.visa_doc_url) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {employee.national_id_doc_url && <SecureDocLink path={employee.national_id_doc_url} label="National ID — front" />}
                  {employee.national_id_back_doc_url && <SecureDocLink path={employee.national_id_back_doc_url} label="National ID — back" />}
                  {employee.passport_doc_url && <SecureDocLink path={employee.passport_doc_url} label="Passport scan" />}
                  {employee.visa_doc_url && <SecureDocLink path={employee.visa_doc_url} label="Visa scan" />}
                </div>
              )}
            </Sec>

            <Sec icon={ShieldIcon} title={t("hr.insurance")}>
              <FieldGrid
                empty={t("sec.empty")}
                rows={[
                  { label: "Provider", value: employee.insurance_provider },
                  { label: "Policy #", value: employee.insurance_policy_number },
                  { label: "Class", value: employee.insurance_class },
                  { label: "Expiry", value: employee.insurance_expiry_date ? formatDate(employee.insurance_expiry_date) : null },
                ]}
              />
            </Sec>

            <Sec icon={BriefcaseIcon} title={t("hr.education")}>
              <FieldGrid
                empty={t("sec.empty")}
                rows={[
                  { label: "Degree", value: employee.education_degree?.replace(/_/g, " ") },
                  { label: "Institution", value: employee.education_institution },
                  { label: "Field", value: employee.education_field },
                  { label: "Graduation", value: employee.education_graduation_year },
                ]}
              />
            </Sec>

            <GroupLabel>{t("grp.performance")}</GroupLabel>
            <BehaviorStanding employeeId={employee.id} t={t} />
          </>
        )}
      </div>

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !deleting && setConfirmDelete(false)}>
          <div
            className="w-full max-w-md bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 shrink-0">
                <TrashIcon size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-[var(--text-primary)]">Delete {person.full_name}?</h3>
                <p className="text-[12.5px] text-[var(--text-dim)] mt-1 leading-relaxed">
                  This permanently removes the employee record and their HR history
                  (leave, payslips, appraisals, attendance, documents). Their login
                  account will be suspended and their identity is kept for audit
                  trails. This cannot be undone.
                </p>
              </div>
            </div>
            {deleteError && (
              <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-[12px] text-red-400">
                {deleteError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="h-9 px-4 rounded-lg border border-[var(--border-subtle)] text-[12.5px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="h-9 px-4 rounded-lg bg-red-500 text-white text-[12.5px] font-semibold flex items-center gap-2 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting && <SpinnerIcon size={13} className="animate-spin" />}
                Delete employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
