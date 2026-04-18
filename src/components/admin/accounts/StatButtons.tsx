"use client";

/* ---------------------------------------------------------------------------
   StatButtons — row of clickable navigation cards above the account detail
   tabs.

   - Employee & Contact buttons navigate to those modules.
   - Company & Calendar buttons stay on the account page — they switch
     to the relevant tab via the onTabChange callback.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import UserCircle2Icon from "@/components/icons/ui/UserCircle2Icon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import ArrowUpRightIcon from "@/components/icons/ui/ArrowUpRightIcon";
import { useTranslation } from "@/lib/i18n";
import { accountsT } from "@/lib/translations/accounts";
import type {
  AccountWithLinks,
  EmployeeRow,
  PersonRow,
  CompanyRow,
} from "@/types/supabase";

interface Props {
  account: AccountWithLinks;
  onTabChange?: (tab: string) => void;
}

interface StatButtonDef {
  key: string;
  label: string;
  value: string;
  href?: string;
  tabTarget?: string;
  icon: React.ElementType;
  hidden?: boolean;
}

export default function StatButtons({ account, onTabChange }: Props) {
  const { t } = useTranslation(accountsT);
  const buttons = buildButtons(account, t);
  const visible = buttons.filter((b) => !b.hidden);
  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
      {visible.map((b) => {
        const Icon = b.icon;

        /* ── Tab-switch buttons (Company, Calendar) ── */
        if (b.tabTarget) {
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => onTabChange?.(b.tabTarget!)}
              className="group relative h-[72px] rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface)] transition-all px-4 py-3 flex items-center gap-3 text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-[var(--text-muted)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider truncate">
                  {b.label}
                </p>
                <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                  {b.value}
                </p>
              </div>
            </button>
          );
        }

        /* ── Link buttons (Employee, Contact) ── */
        return (
          <Link
            key={b.key}
            href={b.href || "#"}
            className="group relative h-[72px] rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface)] transition-all px-4 py-3 flex items-center gap-3"
          >
            <div className="h-10 w-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-[var(--text-muted)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider truncate">
                {b.label}
              </p>
              <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                {b.value}
              </p>
            </div>
            <ArrowUpRightIcon className="h-3.5 w-3.5 text-[var(--text-dim)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        );
      })}
    </div>
  );
}

function buildButtons(
  account: AccountWithLinks,
  t: (key: string) => string,
): StatButtonDef[] {
  const { employee, person, company } = account;
  return [
    employeeButton(employee, t),
    contactButton(person, t),
    companyButton(company, t),
    calendarButton(t),
  ];
}

function employeeButton(
  employee: EmployeeRow | null,
  t: (key: string) => string,
): StatButtonDef {
  return {
    key: "employee",
    label: t("acc.stat.employee"),
    value: employee
      ? employee.employee_number || employee.position || t("acc.stat.viewRecord")
      : "",
    href: employee ? `/accounts?employee=${employee.id}` : "#",
    icon: BriefcaseIcon,
    hidden: !employee,
  };
}

function contactButton(
  person: PersonRow | null,
  t: (key: string) => string,
): StatButtonDef {
  return {
    key: "contact",
    label: t("acc.stat.contact"),
    value: person ? person.full_name : "",
    href: person ? `/contacts/${person.id}` : "#",
    icon: UserCircle2Icon,
    hidden: !person,
  };
}

function companyButton(
  company: CompanyRow | null,
  t: (key: string) => string,
): StatButtonDef {
  return {
    key: "company",
    label: t("acc.stat.company"),
    value: company ? company.name : "",
    tabTarget: "overview",
    icon: Building2Icon,
    hidden: !company,
  };
}

function calendarButton(t: (key: string) => string): StatButtonDef {
  return {
    key: "calendar",
    label: t("acc.stat.calendar"),
    value: t("acc.stat.viewSchedule"),
    tabTarget: "calendar",
    icon: CalendarRawIcon,
    hidden: false,
  };
}
