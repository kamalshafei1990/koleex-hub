"use client";

/* ---------------------------------------------------------------------------
   OverviewTab — default tab on the account detail page.

   Shows the read-only snapshot of identity + linked records: login identity,
   person profile (contact info + address), company, employee record, and the
   role's access preset summary.

   This tab does NOT include anything that has its own dedicated tab
   (Access Rights, Preferences, CalendarRawIcon, Private HR, Notes).
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import AtSignIcon from "@/components/icons/ui/AtSignIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import UserCircle2Icon from "@/components/icons/ui/UserCircle2Icon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import SmartphoneIcon from "@/components/icons/ui/SmartphoneIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import KeyIcon from "@/components/icons/ui/KeyIcon";
import { useTranslation } from "@/lib/i18n";
import { accountsT } from "@/lib/translations/accounts";
import type {
  AccountWithLinks,
  CustomerLevel,
} from "@/types/supabase";
import { tabCardClass, tabSectionTitle } from "./shared";

const levelColors: Record<CustomerLevel, string> = {
  silver: "bg-slate-400/15 text-slate-300 border-slate-400/25",
  gold: "bg-amber-400/15 text-amber-300 border-amber-400/25",
  platinum: "bg-sky-400/15 text-sky-300 border-sky-400/25",
  diamond: "bg-fuchsia-400/15 text-fuchsia-300 border-fuchsia-400/25",
};

const priceLevelKeyFor: Record<CustomerLevel, string> = {
  silver: "acc.priceLevel.1",
  gold: "acc.priceLevel.2",
  platinum: "acc.priceLevel.3",
  diamond: "acc.priceLevel.4",
};

interface Props {
  account: AccountWithLinks;
}

export default function OverviewTab({ account }: Props) {
  const { t } = useTranslation(accountsT);
  const { person, company, role, preset, employee } = account;
  const customerLevel = company?.customer_level || null;

  return (
    <div className="space-y-4">
      {/* Login Identity */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <KeyIcon className="h-3.5 w-3.5" />
          {t("acc.overview.loginIdentity")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoField
            icon={<AtSignIcon className="h-3.5 w-3.5" />}
            label={t("acc.overview.username")}
            value={<span className="font-mono">@{account.username}</span>}
          />
          <InfoField
            icon={<EnvelopeIcon className="h-3.5 w-3.5" />}
            label={t("acc.overview.loginEmail")}
            value={account.login_email}
          />
          <InfoField
            icon={<ClockIcon className="h-3.5 w-3.5" />}
            label={t("acc.overview.lastLogin")}
            value={
              account.last_login_at
                ? new Date(account.last_login_at).toLocaleString()
                : t("acc.overview.never")
            }
          />
          <InfoField
            icon={<ShieldIcon className="h-3.5 w-3.5" />}
            label={t("acc.overview.twoFA")}
            value={account.two_factor_enabled ? t("acc.overview.enabled") : t("acc.overview.disabled")}
          />
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex items-center gap-2 flex-wrap">
          {account.force_password_change && (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-amber-500/15 text-amber-300 border-amber-500/25">
              {t("acc.overview.forcePasswordChange")}
            </span>
          )}
          {account.password_hash ? (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]">
              {t("acc.overview.tempPasswordSet")}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-red-500/15 text-red-300 border-red-500/25">
              {t("acc.overview.noPasswordSet")}
            </span>
          )}
        </div>
      </section>

      {/* Contact profile */}
      {person && (
        <section className={tabCardClass}>
          <h2 className={tabSectionTitle}>
            <UserCircle2Icon className="h-3.5 w-3.5" />
            {t("acc.overview.contactProfile")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoField
              icon={<UserCircle2Icon className="h-3.5 w-3.5" />}
              label={t("acc.overview.fullName")}
              value={person.full_name}
            />
            {person.display_name && (
              <InfoField
                icon={<UserCircle2Icon className="h-3.5 w-3.5" />}
                label={t("acc.overview.displayName")}
                value={person.display_name}
              />
            )}
            {person.job_title && (
              <InfoField
                icon={<BriefcaseIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.jobTitle")}
                value={person.job_title}
              />
            )}
            {person.email && (
              <InfoField
                icon={<EnvelopeIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.email")}
                value={person.email}
              />
            )}
            {person.phone && (
              <InfoField
                icon={<PhoneIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.phone")}
                value={person.phone}
              />
            )}
            {person.mobile && (
              <InfoField
                icon={<SmartphoneIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.mobile")}
                value={person.mobile}
              />
            )}
            {person.language && (
              <InfoField
                icon={<LanguagesIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.language")}
                value={person.language}
              />
            )}
          </div>
          {(person.address_line1 || person.city || person.country) && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold mb-2 flex items-center gap-1.5">
                <MapPinIcon className="h-3 w-3" />
                {t("acc.overview.address")}
              </p>
              <p className="text-[13px] text-[var(--text-muted)] whitespace-pre-line">
                {[
                  person.address_line1,
                  person.address_line2,
                  [person.city, person.state, person.postal_code]
                    .filter(Boolean)
                    .join(", "),
                  person.country,
                ]
                  .filter(Boolean)
                  .join("\n")}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Company */}
      {company && (
        <section className={tabCardClass}>
          <h2 className={tabSectionTitle}>
            <Building2Icon className="h-3.5 w-3.5" />
            {t("acc.overview.company")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoField
              icon={<Building2Icon className="h-3.5 w-3.5" />}
              label={t("acc.overview.companyName")}
              value={company.name}
            />
            <InfoField
              icon={<LayersIcon className="h-3.5 w-3.5" />}
              label={t("acc.overview.companyType")}
              value={
                <span className="uppercase tracking-wider">{company.type}</span>
              }
            />
            {company.country && (
              <InfoField
                icon={<FlagIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.companyCountry")}
                value={company.country}
              />
            )}
            {company.currency && (
              <InfoField
                icon={<GlobeIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.companyCurrency")}
                value={company.currency}
              />
            )}
            {customerLevel && (
              <>
                <InfoField
                  icon={<ShieldIcon className="h-3.5 w-3.5" />}
                  label={t("acc.overview.customerLevel")}
                  value={
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${levelColors[customerLevel]}`}
                    >
                      {customerLevel}
                    </span>
                  }
                />
                <InfoField
                  icon={<LayersIcon className="h-3.5 w-3.5" />}
                  label={t("acc.overview.priceLevel")}
                  value={t(priceLevelKeyFor[customerLevel])}
                />
              </>
            )}
          </div>
          {account.user_type === "customer" && !customerLevel && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-[12px] text-amber-300/80 flex items-center gap-1.5">
              <ExclamationIcon className="h-3.5 w-3.5" />
              {t("acc.overview.noLevelWarning")}
            </div>
          )}
        </section>
      )}

      {/* Employee (HR) — public-level summary only */}
      {employee && (
        <section className={tabCardClass}>
          <h2 className={tabSectionTitle}>
            <BriefcaseIcon className="h-3.5 w-3.5" />
            {t("acc.overview.employeeRecord")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {employee.employee_number && (
              <InfoField
                icon={<BriefcaseIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.employeeNumber")}
                value={employee.employee_number}
              />
            )}
            {employee.department && (
              <InfoField
                icon={<LayersIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.department")}
                value={employee.department}
              />
            )}
            {employee.position && (
              <InfoField
                icon={<BriefcaseIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.position")}
                value={employee.position}
              />
            )}
            <InfoField
              icon={<ShieldIcon className="h-3.5 w-3.5" />}
              label={t("acc.overview.employment")}
              value={
                <span className="uppercase tracking-wider">
                  {employee.employment_status}
                </span>
              }
            />
            {employee.hire_date && (
              <InfoField
                icon={<ClockIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.hireDate")}
                value={new Date(employee.hire_date).toLocaleDateString()}
              />
            )}
            {employee.work_email && (
              <InfoField
                icon={<EnvelopeIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.workEmail")}
                value={employee.work_email}
              />
            )}
            {employee.work_phone && (
              <InfoField
                icon={<PhoneIcon className="h-3.5 w-3.5" />}
                label={t("acc.overview.workPhone")}
                value={employee.work_phone}
              />
            )}
          </div>
          <p className="text-[11px] text-[var(--text-dim)] mt-4 pt-4 border-t border-[var(--border-subtle)]">
            {t("acc.overview.privateDataHint")}{" "}
            <span className="text-[var(--text-muted)] font-medium">{t("acc.overview.privateTabRef")}</span> {t("acc.overview.tabSuffix")}
          </p>
        </section>
      )}

      {/* Role */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <ShieldIcon className="h-3.5 w-3.5" />
          {t("acc.overview.role")}
        </h2>
        {role ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-focus)]">
                {role.name}
              </span>
              <span className="text-[11px] text-[var(--text-dim)] uppercase tracking-wider">
                {t("acc.overview.scope")} {role.scope}
              </span>
            </div>
            {role.description && (
              <p className="text-[12px] text-[var(--text-dim)] mt-2">
                {role.description}
              </p>
            )}
            {preset && (
              <p className="text-[11px] text-[var(--text-dim)] mt-3 pt-3 border-t border-[var(--border-subtle)]">
                {t("acc.overview.presetHint")}
                <span className="text-[var(--text-muted)] font-medium">
                  {" "}
                  {preset.preset_name}
                </span>
                {t("acc.overview.overridesHint")}{" "}
                <span className="text-[var(--text-muted)] font-medium">
                  {t("acc.overview.accessRightsRef")}
                </span>{" "}
                {t("acc.overview.tabSuffix")}
              </p>
            )}
          </>
        ) : (
          <p className="text-[12px] text-amber-300/80 flex items-center gap-1.5">
            <ExclamationIcon className="h-3.5 w-3.5" />
            {t("acc.overview.noRoleWarning")}
          </p>
        )}
      </section>

      {/* Meta */}
      <p className="text-[11px] text-[var(--text-ghost)] px-1">
        Created {new Date(account.created_at).toLocaleString()} · Updated{" "}
        {new Date(account.updated_at).toLocaleString()}
      </p>
    </div>
  );
}

function InfoField({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold flex items-center gap-1.5 mb-1">
        {icon}
        {label}
      </p>
      <div className="text-[13px] text-[var(--text-primary)] truncate">
        {value}
      </div>
    </div>
  );
}
