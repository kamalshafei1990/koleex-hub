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

/* ── Detail document ────────────────────────────────────────────────────
   A person's record is ONE document, not six things. Rendering each section
   as its own bordered card is what made this page read as a grid of blocks
   no matter how the grid was tuned — so a section here is a heading and a
   rule inside a single surface, with no border or background of its own.

   Fields sit in a two-column grid so a wide screen is filled by DATA rather
   than by one tall ribbon of rows or by empty card gutters. */

function DetailSection({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-5 first:pt-0 last:pb-0 border-b border-[var(--border-subtle)] last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className="text-[var(--text-dim)] shrink-0" aria-hidden />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
          {title}
        </h2>
      </div>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-10">{children}</dl>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const empty =
    value == null || value === "" || (typeof value === "string" && !value.trim());
  return (
    <div className="flex items-baseline justify-between gap-4 py-[7px] border-b border-[var(--border-faint)] last:border-0">
      <dt className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] shrink-0">{label}</dt>
      <dd className={`text-[13px] min-w-0 break-words text-end ${empty ? "text-[var(--text-faint)]" : "text-[var(--text-primary)]"}`}>
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

/** Compact key/value line for the identity rail. */
function RailFact({ label, value }: { label: string; value: React.ReactNode }) {
  const empty =
    value == null || value === "" || (typeof value === "string" && !value.trim());
  if (empty) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] shrink-0">{label}</span>
      <span className="text-[12.5px] text-[var(--text-primary)] text-end min-w-0 break-words">{value}</span>
    </div>
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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* The Hub's canonical page container — the same one the Employees
          list and ~10 other pages use. This page was the odd one out with
          `lg:px-10 xl:px-16` and NO max-width: the fatter padding ate 128px
          of content width (sections were cramped on a normal screen), while
          the missing max-w meant `mx-auto` did nothing and the page stretched
          edge-to-edge on a wide monitor. Both wrong in opposite directions. */}
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* ── Back + actions ── */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/employees"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
            aria-label={t("back.toList")}
          >
            <ArrowLeftIcon size={16} />
          </Link>
          <h1 className="text-lg font-semibold text-[var(--text-primary)] flex-1 min-w-0 truncate">{t("app.profile")}</h1>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <Link
                href={`/employees/${id}/edit`}
                className="h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all"
              >
                <PencilIcon size={13} />
                Edit
              </Link>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => { setDeleteError(null); setConfirmDelete(true); }}
                className="h-9 px-3.5 rounded-xl border border-red-500/30 text-red-400 text-[12.5px] font-semibold flex items-center gap-2 hover:bg-red-500/10 transition-colors"
              >
                <TrashIcon size={13} />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* ── Identity rail + detail document ──
            The page was a grid of equal-weight bordered cards, which is why it
            kept reading as "blocks" however the grid was tuned. It now has a
            spine: WHO this is stays pinned on the left, and everything else is
            one continuous document on the right. */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">

          {/* ── Identity rail ── */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="lg:sticky lg:top-6 space-y-3">
              <section className={panelCls}>
                <div className="flex flex-col items-center text-center pb-4 border-b border-[var(--border-faint)]">
                  <Avatar src={fpAvatar(person.avatar_url)} name={person.full_name} size={88} />
                  <h2 className="mt-3 text-[17px] font-bold text-[var(--text-primary)] leading-tight break-words">
                    {person.full_name}
                  </h2>
                  {(person as { name_alt?: string | null }).name_alt && (
                    <p lang="zh" className="text-[13px] text-[var(--text-dim)] leading-tight mt-0.5">
                      {(person as { name_alt?: string | null }).name_alt}
                    </p>
                  )}
                  {(position?.title || department?.name) && (
                    <p className="mt-1.5 text-[12.5px] text-[var(--text-muted)] leading-snug">
                      {position?.title}
                      {position?.title && department?.name && <span className="mx-1">·</span>}
                      {department?.name}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap justify-center">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border capitalize ${STATUS_COLORS[statusKey] || STATUS_COLORS.inactive}`}>
                      {statusKey.replace(/_/g, " ")}
                    </span>
                    {employee.employee_number && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[var(--text-faint)] border border-[var(--border-faint)]">
                        {employee.employee_number}
                      </span>
                    )}
                  </div>
                </div>

                {/* The handful of facts you actually came here for — visible
                    without scrolling, and pinned while you read the rest. */}
                <div className="pt-3">
                  <RailFact label="Work email" value={employee.work_email} />
                  <RailFact label="Work phone" value={employee.work_phone} />
                  <RailFact label="Location" value={employee.work_location} />
                  <RailFact label="Type" value={employee.employment_type?.replace(/_/g, " ")} />
                  <RailFact label="Hired" value={employee.hire_date ? formatDate(employee.hire_date) : null} />
                </div>
              </section>

              {/* Account state — a quiet line in the rail rather than a full
                  banner across the top of the page. */}
              {!account && (
                <section className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-2">
                    <KeyIcon size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] text-amber-300 font-medium">{t("profile.noAccount.title")}</p>
                      <p className="text-[11px] text-amber-300/80 mt-0.5 leading-snug">
                        {t("profile.noAccount.body")}
                      </p>
                      <Link
                        href={`/accounts?person=${person.id}`}
                        className="mt-2 h-7 px-2.5 rounded-lg text-[11px] font-medium border border-amber-400/30 text-amber-300 hover:bg-amber-400/10 inline-flex items-center transition-colors"
                      >
                        {t("profile.noAccount.cta")}
                      </Link>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </aside>

          {/* ── Detail column ── */}
          <div className="lg:col-span-8 xl:col-span-9 min-w-0">
            {/* Tabs */}
            <div className="flex items-center gap-1 mb-3 overflow-x-auto">
              {TABS.map((tabKey) => {
                const base = tabKey === "overview" ? t("tab.overview")
                  : tabKey === "activity" ? t("tab.activity")
                  : t("tab.hr");
                const label = tabKey === "activity" && activity ? `${base} · ${activityTotal}` : base;
                return (
                  <button
                    key={tabKey}
                    onClick={() => setTab(tabKey)}
                    className={`h-9 px-4 rounded-lg text-[12px] font-medium transition-colors ${
                      tab === tabKey
                        ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                        : "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                    }`}
                    aria-current={tab === tabKey ? "page" : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {tab === "overview" && (
              /* ONE surface. The sections inside are separated by rules, not by
                 card borders — that difference is the whole point. */
              <div className={panelCls}>
                <DetailSection icon={UserIcon} title={t("ov.personal")}>
                  <Field label="Full name" value={person.full_name} />
                  <Field label="Gender" value={employee.gender} />
                  <Field label="Nationality" value={employee.nationality} />
                  <Field label="Birthday" value={employee.birth_date ? formatDate(employee.birth_date) : null} />
                  <Field label="Marital" value={employee.marital_status} />
                  <Field label="Languages" value={employee.languages} />
                  <Field label="Personal email" value={person.email} />
                  <Field label="Personal phone" value={person.phone} />
                </DetailSection>

                <DetailSection icon={BriefcaseIcon} title={t("ov.employment")}>
                  <Field label="Employee #" value={employee.employee_number} />
                  <Field label="Type" value={employee.employment_type?.replace(/_/g, " ")} />
                  <Field label="Department" value={department?.name} />
                  <Field label="Position" value={position?.title} />
                  <Field label="Work location" value={employee.work_location} />
                  <Field label="Hire date" value={employee.hire_date ? formatDate(employee.hire_date) : null} />
                  <Field label="Contract end" value={employee.contract_end_date ? formatDate(employee.contract_end_date) : null} />
                  <Field label="Probation end" value={employee.probation_end_date ? formatDate(employee.probation_end_date) : null} />
                </DetailSection>

                <DetailSection icon={Building2Icon} title={t("ov.workContact")}>
                  <Field label="Work email" value={employee.work_email} />
                  <Field label="Work phone" value={employee.work_phone} />
                  <Field label="Address" value={[person.address_line1, person.address_line2, person.city, person.state, person.country].filter(Boolean).join(", ")} />
                  <Field label="Postal code" value={person.postal_code} />
                </DetailSection>

                <DetailSection icon={ShieldIcon} title={t("ov.emergency")}>
                  <Field label="Primary" value={employee.emergency_contact_name} />
                  <Field label="Phone" value={employee.emergency_contact_phone} />
                  <Field label="Relation" value={employee.emergency_contact_relationship} />
                  <Field label="Secondary" value={employee.emergency_contact2_name} />
                  <Field label="Phone" value={employee.emergency_contact2_phone} />
                  <Field label="Relation" value={employee.emergency_contact2_relationship} />
                </DetailSection>
              </div>
            )}

        {tab === "activity" && (
          <div>
            {!activity ? (
              <div className="flex items-center justify-center py-16">
                <SpinnerIcon size={20} className="animate-spin text-[var(--text-dim)]" />
              </div>
            ) : (
              <>
                {activity.missingAccount && (
                  <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-300">
                    Most activity buckets are empty because this employee doesn&apos;t have a login account yet.
                    HR leave records still show below.
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <ActivityCard
                    title="CRM Opportunities"
                    icon={UserIcon}
                    bucket={activity.crmOpportunities}
                    appHref="/crm"
                    emptyHint="No opportunities owned yet"
                  />
                  <ActivityCard
                    title="Quotations"
                    icon={DocumentIcon}
                    bucket={activity.quotations}
                    appHref="/quotations"
                    emptyHint="No quotations created yet"
                  />
                  <ActivityCard
                    title="Invoices"
                    icon={CreditCardIcon}
                    bucket={activity.invoices}
                    appHref="/invoices"
                    emptyHint="No invoices created yet"
                  />
                  <ActivityCard
                    title="Projects Managed"
                    icon={BriefcaseIcon}
                    bucket={activity.projectsManaged}
                    appHref="/projects"
                    emptyHint="Not managing any projects"
                  />
                  <ActivityCard
                    title="Open Tasks"
                    icon={CheckIcon}
                    bucket={activity.tasksAssigned}
                    appHref="/projects"
                    emptyHint="No tasks assigned"
                  />
                  <ActivityCard
                    title="Todos"
                    icon={CheckIcon}
                    bucket={activity.todosAssigned}
                    appHref="/todo"
                    emptyHint="No open todos"
                  />
                  <ActivityCard
                    title="Leave Requests"
                    icon={ShieldIcon}
                    bucket={activity.leaveRequests}
                    appHref="/hr"
                    emptyHint="No leave history"
                  />
                  <ActivityCard
                    title="Calendar"
                    icon={BriefcaseIcon}
                    bucket={activity.calendarEvents}
                    appHref="/calendar"
                    emptyHint="No recent events"
                  />
                  <ActivityCard
                    title="Notes"
                    icon={DocumentIcon}
                    bucket={activity.notes}
                    appHref="/notes"
                    emptyHint="No notes yet"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {tab === "hr" && (
          /* Same one-surface document as Overview — HR detail is part of the
             same record, so it gets the same treatment, not a second grid. */
          <div className={panelCls}>
            <DetailSection icon={CreditCardIcon} title={t("hr.compensation")}>
              <Field
                label="Initial salary"
                value={employee.initial_salary != null ? formatCurrency(employee.initial_salary, employee.salary_currency) : null}
              />
              <Field label="Currency" value={employee.bank_currency} />
              <Field label="Bank" value={employee.bank_name} />
              <Field label="Holder" value={employee.bank_account_holder} />
              <Field label="Account #" value={employee.bank_account_number} />
              <Field label="IBAN" value={employee.bank_iban} />
              <Field label="SWIFT" value={employee.bank_swift} />
            </DetailSection>

            <DetailSection icon={DocumentIcon} title={t("hr.documents")}>
              <Field label="National ID" value={employee.identification_id} />
              <Field label="Passport" value={employee.passport_number} />
              <Field label="SSN" value={employee.social_security_number} />
              <Field label="Tax ID" value={employee.tax_id} />
              <Field label="Visa #" value={employee.visa_number} />
              <Field label="Visa expiry" value={employee.visa_expiry_date ? formatDate(employee.visa_expiry_date) : null} />
              <Field label="License #" value={employee.driving_license_number} />
              <Field label="License expiry" value={employee.driving_license_expiry ? formatDate(employee.driving_license_expiry) : null} />
            </DetailSection>

            <DetailSection icon={ShieldIcon} title={t("hr.insurance")}>
              <Field label="Provider" value={employee.insurance_provider} />
              <Field label="Policy #" value={employee.insurance_policy_number} />
              <Field label="Class" value={employee.insurance_class} />
              <Field label="Expiry" value={employee.insurance_expiry_date ? formatDate(employee.insurance_expiry_date) : null} />
            </DetailSection>

            <DetailSection icon={BriefcaseIcon} title={t("hr.education")}>
              <Field label="Degree" value={employee.education_degree?.replace(/_/g, " ")} />
              <Field label="Institution" value={employee.education_institution} />
              <Field label="Field" value={employee.education_field} />
              <Field label="Graduation" value={employee.education_graduation_year} />
            </DetailSection>
          </div>
        )}
          </div>{/* /detail column */}
        </div>{/* /rail + detail grid */}
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
