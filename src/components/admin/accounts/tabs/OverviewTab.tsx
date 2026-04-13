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

const priceLevelFor: Record<CustomerLevel, string> = {
  silver: "Price Level 1",
  gold: "Price Level 2",
  platinum: "Price Level 3",
  diamond: "Price Level 4",
};

interface Props {
  account: AccountWithLinks;
}

export default function OverviewTab({ account }: Props) {
  const { person, company, role, preset, employee } = account;
  const customerLevel = company?.customer_level || null;

  return (
    <div className="space-y-4">
      {/* Login Identity */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <KeyIcon className="h-3.5 w-3.5" />
          Login Identity
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoField
            icon={<AtSignIcon className="h-3.5 w-3.5" />}
            label="Username"
            value={<span className="font-mono">@{account.username}</span>}
          />
          <InfoField
            icon={<EnvelopeIcon className="h-3.5 w-3.5" />}
            label="Login Email"
            value={account.login_email}
          />
          <InfoField
            icon={<ClockIcon className="h-3.5 w-3.5" />}
            label="Last Login"
            value={
              account.last_login_at
                ? new Date(account.last_login_at).toLocaleString()
                : "Never"
            }
          />
          <InfoField
            icon={<ShieldIcon className="h-3.5 w-3.5" />}
            label="2FA"
            value={account.two_factor_enabled ? "Enabled" : "Disabled"}
          />
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex items-center gap-2 flex-wrap">
          {account.force_password_change && (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-amber-500/15 text-amber-300 border-amber-500/25">
              Force Password Change
            </span>
          )}
          {account.password_hash ? (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]">
              Temporary Password Set
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-red-500/15 text-red-300 border-red-500/25">
              No Password Set
            </span>
          )}
        </div>
      </section>

      {/* Contact profile */}
      {person && (
        <section className={tabCardClass}>
          <h2 className={tabSectionTitle}>
            <UserCircle2Icon className="h-3.5 w-3.5" />
            Contact Profile
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoField
              icon={<UserCircle2Icon className="h-3.5 w-3.5" />}
              label="Full Name"
              value={person.full_name}
            />
            {person.display_name && (
              <InfoField
                icon={<UserCircle2Icon className="h-3.5 w-3.5" />}
                label="Display Name"
                value={person.display_name}
              />
            )}
            {person.job_title && (
              <InfoField
                icon={<BriefcaseIcon className="h-3.5 w-3.5" />}
                label="Job Title"
                value={person.job_title}
              />
            )}
            {person.email && (
              <InfoField
                icon={<EnvelopeIcon className="h-3.5 w-3.5" />}
                label="Email"
                value={person.email}
              />
            )}
            {person.phone && (
              <InfoField
                icon={<PhoneIcon className="h-3.5 w-3.5" />}
                label="Phone"
                value={person.phone}
              />
            )}
            {person.mobile && (
              <InfoField
                icon={<SmartphoneIcon className="h-3.5 w-3.5" />}
                label="Mobile"
                value={person.mobile}
              />
            )}
            {person.language && (
              <InfoField
                icon={<LanguagesIcon className="h-3.5 w-3.5" />}
                label="Language"
                value={person.language}
              />
            )}
          </div>
          {(person.address_line1 || person.city || person.country) && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold mb-2 flex items-center gap-1.5">
                <MapPinIcon className="h-3 w-3" />
                Address
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
            Company
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoField
              icon={<Building2Icon className="h-3.5 w-3.5" />}
              label="Name"
              value={company.name}
            />
            <InfoField
              icon={<LayersIcon className="h-3.5 w-3.5" />}
              label="Type"
              value={
                <span className="uppercase tracking-wider">{company.type}</span>
              }
            />
            {company.country && (
              <InfoField
                icon={<FlagIcon className="h-3.5 w-3.5" />}
                label="Country"
                value={company.country}
              />
            )}
            {company.currency && (
              <InfoField
                icon={<GlobeIcon className="h-3.5 w-3.5" />}
                label="Currency"
                value={company.currency}
              />
            )}
            {customerLevel && (
              <>
                <InfoField
                  icon={<ShieldIcon className="h-3.5 w-3.5" />}
                  label="Customer Level"
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
                  label="Price Level"
                  value={priceLevelFor[customerLevel]}
                />
              </>
            )}
          </div>
          {account.user_type === "customer" && !customerLevel && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-[12px] text-amber-300/80 flex items-center gap-1.5">
              <ExclamationIcon className="h-3.5 w-3.5" />
              This company has no customer level set. Set it on the company
              record to enable pricing.
            </div>
          )}
        </section>
      )}

      {/* Employee (HR) — public-level summary only */}
      {employee && (
        <section className={tabCardClass}>
          <h2 className={tabSectionTitle}>
            <BriefcaseIcon className="h-3.5 w-3.5" />
            Employee Record
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {employee.employee_number && (
              <InfoField
                icon={<BriefcaseIcon className="h-3.5 w-3.5" />}
                label="Employee #"
                value={employee.employee_number}
              />
            )}
            {employee.department && (
              <InfoField
                icon={<LayersIcon className="h-3.5 w-3.5" />}
                label="Department"
                value={employee.department}
              />
            )}
            {employee.position && (
              <InfoField
                icon={<BriefcaseIcon className="h-3.5 w-3.5" />}
                label="Position"
                value={employee.position}
              />
            )}
            <InfoField
              icon={<ShieldIcon className="h-3.5 w-3.5" />}
              label="Employment"
              value={
                <span className="uppercase tracking-wider">
                  {employee.employment_status}
                </span>
              }
            />
            {employee.hire_date && (
              <InfoField
                icon={<ClockIcon className="h-3.5 w-3.5" />}
                label="Hire Date"
                value={new Date(employee.hire_date).toLocaleDateString()}
              />
            )}
            {employee.work_email && (
              <InfoField
                icon={<EnvelopeIcon className="h-3.5 w-3.5" />}
                label="Work Email"
                value={employee.work_email}
              />
            )}
            {employee.work_phone && (
              <InfoField
                icon={<PhoneIcon className="h-3.5 w-3.5" />}
                label="Work Phone"
                value={employee.work_phone}
              />
            )}
          </div>
          <p className="text-[11px] text-[var(--text-dim)] mt-4 pt-4 border-t border-[var(--border-subtle)]">
            Private HR data (address, emergency contact, documents) is managed
            under the <span className="text-[var(--text-muted)] font-medium">Private</span> tab.
          </p>
        </section>
      )}

      {/* Role */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <ShieldIcon className="h-3.5 w-3.5" />
          Role
        </h2>
        {role ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-focus)]">
                {role.name}
              </span>
              <span className="text-[11px] text-[var(--text-dim)] uppercase tracking-wider">
                Scope: {role.scope}
              </span>
            </div>
            {role.description && (
              <p className="text-[12px] text-[var(--text-dim)] mt-2">
                {role.description}
              </p>
            )}
            {preset && (
              <p className="text-[11px] text-[var(--text-dim)] mt-3 pt-3 border-t border-[var(--border-subtle)]">
                Default access comes from preset
                <span className="text-[var(--text-muted)] font-medium">
                  {" "}
                  {preset.preset_name}
                </span>
                . Per-module overrides are managed under the{" "}
                <span className="text-[var(--text-muted)] font-medium">
                  Access Rights
                </span>{" "}
                tab.
              </p>
            )}
          </>
        ) : (
          <p className="text-[12px] text-amber-300/80 flex items-center gap-1.5">
            <ExclamationIcon className="h-3.5 w-3.5" />
            No role assigned. Edit this account to assign one.
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
