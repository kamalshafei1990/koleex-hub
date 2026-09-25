"use client";

import Building2Icon from "@/components/icons/ui/Building2Icon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import { DiscussAvatar } from "./DiscussAvatar";
import type { DiscussLinkedContact } from "@/types/supabase";

/* ---------------------------------------------------------------------------
   ContactCard — compact card shown inside the Discuss details pane when
   the selected channel is a customer chat. Renders the linked CRM
   contact's basics + a "View in CRM" link.
   --------------------------------------------------------------------------- */

export interface CustomerContactCardProps {
  contact: DiscussLinkedContact;
  /** i18n helper. */
  t: (key: string, fallback?: string) => string;
  /** Optional href for the CRM deep-link; defaults to /contacts/{id}. */
  crmHref?: string;
}

export function CustomerContactCard({
  contact,
  t,
  crmHref,
}: CustomerContactCardProps) {
  const href = crmHref ?? `/contacts/${contact.id}`;
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      {/* Header row */}
      <div className="p-3 flex items-center gap-3 border-b border-[var(--border-subtle)]">
        <DiscussAvatar name={contact.display_name} url={contact.avatar_url} size={44} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
            {contact.display_name}
          </div>
          {contact.company && (
            <div className="text-[11px] text-[var(--text-dim)] truncate">
              {contact.company}
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="p-3 flex flex-col gap-2.5 text-[11.5px]">
        {contact.email && (
          <DetailRow
            icon={<EnvelopeIcon className="h-3.5 w-3.5" />}
            label={t("customer.email", "Email")}
            value={
              <a
                href={`mailto:${contact.email}`}
                className="text-[#567FB2] dark:text-[#7FA9D6] hover:underline break-all"
              >
                {contact.email}
              </a>
            }
          />
        )}
        {contact.phone && (
          <DetailRow
            icon={<PhoneIcon className="h-3.5 w-3.5" />}
            label={t("customer.phone", "Phone")}
            value={
              <a
                href={`tel:${contact.phone}`}
                className="text-[#567FB2] dark:text-[#7FA9D6] hover:underline"
              >
                {contact.phone}
              </a>
            }
          />
        )}
        {contact.company && (
          <DetailRow
            icon={<Building2Icon className="h-3.5 w-3.5" />}
            label={t("customer.company", "Company")}
            value={
              <span className="text-[var(--text-primary)]">
                {contact.company}
              </span>
            }
          />
        )}
      </div>

      {/* View in CRM */}
      <a
        href={href}
        className="h-10 flex items-center justify-center gap-1.5 border-t border-[var(--border-subtle)] text-[11.5px] font-semibold text-[#567FB2] dark:text-[#7FA9D6] hover:bg-[#567FB2]/5 transition-colors"
      >
        {t("customer.viewInCRM", "View in CRM")}
      </a>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="h-5 w-5 shrink-0 flex items-center justify-center text-[var(--text-dim)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9.5px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
          {label}
        </div>
        <div className="mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}
