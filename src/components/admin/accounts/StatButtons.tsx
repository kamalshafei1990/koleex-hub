"use client";

/* ---------------------------------------------------------------------------
   StatButtons — row of clickable navigation cards above the account detail
   tabs, inspired by Odoo's "Employee 1", "Contact", "Calendar" buttons in the
   top of the user form.

   Each button shows a label, a value/indicator, and links to the related
   module surface. Hidden when the target record doesn't exist.

   Important: the UI intentionally does NOT copy Odoo's look. It uses the
   Koleex Hub design tokens (bg-secondary card, border-subtle, text-dim) so
   it looks native to the admin surface.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import UserCircle2Icon from "@/components/icons/ui/UserCircle2Icon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import ArrowUpRightIcon from "@/components/icons/ui/ArrowUpRightIcon";
import type {
  AccountWithLinks,
  EmployeeRow,
  PersonRow,
  CompanyRow,
} from "@/types/supabase";

interface Props {
  account: AccountWithLinks;
}

interface StatButtonDef {
  key: string;
  label: string;
  value: string;
  href: string;
  icon: React.ElementType;
  hidden?: boolean;
}

export default function StatButtons({ account }: Props) {
  const buttons = buildButtons(account);
  const visible = buttons.filter((b) => !b.hidden);
  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
      {visible.map((b) => {
        const Icon = b.icon;
        return (
          <Link
            key={b.key}
            href={b.href}
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

function buildButtons(account: AccountWithLinks): StatButtonDef[] {
  const { employee, person, company } = account;
  return [
    employeeButton(employee),
    contactButton(person),
    companyButton(company),
    calendarButton(account.id),
  ];
}

function employeeButton(employee: EmployeeRow | null): StatButtonDef {
  return {
    key: "employee",
    label: "Employee",
    value: employee
      ? employee.employee_number || employee.position || "View record"
      : "",
    href: employee ? `/accounts?employee=${employee.id}` : "#",
    icon: BriefcaseIcon,
    hidden: !employee,
  };
}

function contactButton(person: PersonRow | null): StatButtonDef {
  return {
    key: "contact",
    label: "Contact",
    value: person ? person.full_name : "",
    href: person ? `/contacts/${person.id}` : "#",
    icon: UserCircle2Icon,
    hidden: !person,
  };
}

function companyButton(company: CompanyRow | null): StatButtonDef {
  return {
    key: "company",
    label: "Company",
    value: company ? company.name : "",
    href: company ? `/companies/${company.id}` : "#",
    icon: Building2Icon,
    hidden: !company,
  };
}

function calendarButton(accountId: string): StatButtonDef {
  return {
    key: "calendar",
    label: "Calendar",
    value: "View schedule",
    href: `/calendar?account=${accountId}`,
    icon: CalendarRawIcon,
    // Always visible — calendar is available per-account even without HR record.
    hidden: false,
  };
}
