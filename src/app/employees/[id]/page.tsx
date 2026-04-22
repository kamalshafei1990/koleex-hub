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
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
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
  type ActivityBucket,
  type ActivityItem,
  type EmployeeActivity,
} from "@/lib/employees-admin";
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

const panelCls =
  "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value == null || value === "" ||
    (typeof value === "string" && !value.trim());
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-[var(--border-faint)] last:border-0">
      <span className="text-[11px] text-[var(--text-faint)] uppercase tracking-wide w-[120px] shrink-0">{label}</span>
      <span className={`text-[13px] flex-1 min-w-0 break-words ${empty ? "text-[var(--text-faint)]" : "text-[var(--text-primary)]"}`}>
        {empty ? "—" : value}
      </span>
    </div>
  );
}

function SectionHeader({
  icon: Icon, title, description, action,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-[var(--border-faint)]">
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center text-[var(--text-dim)] shrink-0" aria-hidden>
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-[var(--text-primary)] leading-tight truncate">{title}</h2>
          {description && <p className="text-[12px] text-[var(--text-dim)] mt-0.5">{description}</p>}
        </div>
      </div>
      {action}
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
  const [profile, setProfile] = useState<EmployeeWithLinks | null>(null);
  const [activity, setActivity] = useState<EmployeeActivity | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

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
      <div className="mx-auto px-4 md:px-6 lg:px-10 xl:px-16 py-6 md:py-8">

        {/* ── Back ── */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/employees"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
            aria-label={t("back.toList")}
          >
            <ArrowLeftIcon size={16} />
          </Link>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t("app.profile")}</h1>
        </div>

        {/* ── Header card ── */}
        <section className={`${panelCls} mb-4`}>
          <div className="flex items-start gap-5">
            <Avatar src={person.avatar_url} name={person.full_name} size={80} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-[var(--text-primary)] truncate">{person.full_name}</h2>
                {employee.employee_number && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[var(--text-faint)] border border-[var(--border-faint)]">
                    {employee.employee_number}
                  </span>
                )}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border capitalize ${STATUS_COLORS[statusKey] || STATUS_COLORS.inactive}`}>
                  {statusKey.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-1 text-[13px] text-[var(--text-dim)]">
                {position?.title && <span className="text-[var(--text-primary)] font-medium">{position.title}</span>}
                {position?.title && department?.name && <span className="mx-1.5">·</span>}
                {department?.name && <span>{department.name}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-[var(--text-dim)]">
                {employee.work_email && (
                  <span className="flex items-center gap-1.5"><EnvelopeIcon size={12} /> {employee.work_email}</span>
                )}
                {employee.work_phone && (
                  <span className="flex items-center gap-1.5"><PhoneIcon size={12} /> {employee.work_phone}</span>
                )}
                {employee.hire_date && (
                  <span className="flex items-center gap-1.5"><BriefcaseIcon size={12} /> {t("profile.hired").replace("{date}", formatDate(employee.hire_date))}</span>
                )}
              </div>
            </div>
          </div>

          {/* Account-missing nudge */}
          {!account && (
            <div className="mt-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <KeyIcon size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-amber-300 font-medium">{t("profile.noAccount.title")}</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  {t("profile.noAccount.body")}
                </p>
              </div>
              <Link
                href={`/accounts?person=${person.id}`}
                className="h-8 px-3 rounded-lg text-[11px] font-medium border border-amber-400/30 text-amber-300 hover:bg-amber-400/10 inline-flex items-center transition-colors shrink-0"
              >
                {t("profile.noAccount.cta")}
              </Link>
            </div>
          )}
        </section>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto">
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

        {/* ── Panels ── */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className={panelCls}>
              <SectionHeader icon={UserIcon} title={t("ov.personal")} description={t("ov.personal.desc")} />
              <div>
                <InfoRow label="Full name" value={person.full_name} />
                <InfoRow label="Gender" value={employee.gender} />
                <InfoRow label="Nationality" value={employee.nationality} />
                <InfoRow label="Birthday" value={formatDate(employee.birth_date)} />
                <InfoRow label="Marital" value={employee.marital_status} />
                <InfoRow label="Personal email" value={person.email} />
                <InfoRow label="Personal phone" value={person.phone} />
                <InfoRow label="Languages" value={employee.languages} />
              </div>
            </section>

            <section className={panelCls}>
              <SectionHeader icon={BriefcaseIcon} title={t("ov.employment")} description={t("ov.employment.desc")} />
              <div>
                <InfoRow label="Employee #" value={employee.employee_number} />
                <InfoRow label="Department" value={department?.name} />
                <InfoRow label="Position" value={position?.title} />
                <InfoRow label="Type" value={employee.employment_type?.replace(/_/g, " ")} />
                <InfoRow label="Work location" value={employee.work_location} />
                <InfoRow label="Hire date" value={formatDate(employee.hire_date)} />
                <InfoRow label="Contract end" value={formatDate(employee.contract_end_date)} />
                <InfoRow label="Probation end" value={formatDate(employee.probation_end_date)} />
              </div>
            </section>

            <section className={panelCls}>
              <SectionHeader icon={Building2Icon} title={t("ov.workContact")} description={t("ov.workContact.desc")} />
              <div>
                <InfoRow label="Work email" value={employee.work_email} />
                <InfoRow label="Work phone" value={employee.work_phone} />
                <InfoRow label="Address" value={[employee.private_address_line1, employee.private_address_line2, employee.private_city, employee.private_state, employee.private_country].filter(Boolean).join(", ")} />
                <InfoRow label="Postal code" value={employee.private_postal_code} />
              </div>
            </section>

            <section className={panelCls}>
              <SectionHeader icon={ShieldIcon} title={t("ov.emergency")} description={t("ov.emergency.desc")} />
              <div>
                <InfoRow label="Primary" value={employee.emergency_contact_name} />
                <InfoRow label="Phone" value={employee.emergency_contact_phone} />
                <InfoRow label="Relation" value={employee.emergency_contact_relationship} />
                <InfoRow label="Secondary" value={employee.emergency_contact2_name} />
                <InfoRow label="Phone" value={employee.emergency_contact2_phone} />
                <InfoRow label="Relation" value={employee.emergency_contact2_relationship} />
              </div>
            </section>
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

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className={panelCls}>
              <SectionHeader icon={CreditCardIcon} title={t("hr.compensation")} description={t("hr.compensation.desc")} />
              <div>
                <InfoRow
                  label="Initial salary"
                  value={employee.initial_salary != null ? formatCurrency(employee.initial_salary, employee.salary_currency) : null}
                />
                <InfoRow label="Bank" value={employee.bank_name} />
                <InfoRow label="Holder" value={employee.bank_account_holder} />
                <InfoRow label="Account #" value={employee.bank_account_number} />
                <InfoRow label="IBAN" value={employee.bank_iban} />
                <InfoRow label="SWIFT" value={employee.bank_swift} />
                <InfoRow label="Currency" value={employee.bank_currency} />
              </div>
            </section>

            <section className={panelCls}>
              <SectionHeader icon={DocumentIcon} title={t("hr.documents")} description={t("hr.documents.desc")} />
              <div>
                <InfoRow label="National ID" value={employee.identification_id} />
                <InfoRow label="Passport" value={employee.passport_number} />
                <InfoRow label="SSN" value={employee.social_security_number} />
                <InfoRow label="Tax ID" value={employee.tax_id} />
                <InfoRow label="Visa #" value={employee.visa_number} />
                <InfoRow label="Visa expiry" value={formatDate(employee.visa_expiry_date)} />
                <InfoRow label="License #" value={employee.driving_license_number} />
                <InfoRow label="License expiry" value={formatDate(employee.driving_license_expiry)} />
              </div>
            </section>

            <section className={panelCls}>
              <SectionHeader icon={ShieldIcon} title={t("hr.insurance")} description={t("hr.insurance.desc")} />
              <div>
                <InfoRow label="Provider" value={employee.insurance_provider} />
                <InfoRow label="Policy #" value={employee.insurance_policy_number} />
                <InfoRow label="Class" value={employee.insurance_class} />
                <InfoRow label="Expiry" value={formatDate(employee.insurance_expiry_date)} />
              </div>
            </section>

            <section className={panelCls}>
              <SectionHeader icon={BriefcaseIcon} title={t("hr.education")} description={t("hr.education.desc")} />
              <div>
                <InfoRow label="Degree" value={employee.education_degree?.replace(/_/g, " ")} />
                <InfoRow label="Institution" value={employee.education_institution} />
                <InfoRow label="Field" value={employee.education_field} />
                <InfoRow label="Graduation" value={employee.education_graduation_year} />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
