"use client";

/* ---------------------------------------------------------------------------
   Customer Profile — /customers/[id]

   Dedicated route for one customer. Previously the Customers app had no
   /customers/[id] — selection was carried in a ?selected= query param that
   got stripped on reload, so customers weren't bookmarkable, openable in a
   new tab, or deep-linkable from other apps.

   The page shows:
     · Header card with avatar, tier badge, status, key contacts.
     · Activity tab aggregating CRM opportunities, Quotations, Invoices,
       Projects, and open Tasks linked to this contact_id.
     · Commercial tab with sales rep, payment terms, credit limit, plus
       the matched row from the legacy commercial-policy `customers` table
       when one exists (findLinkedCommercialCustomer).
     · Details tab with address and secondary contact fields.

   All reads go through customers-admin.ts which wraps every Supabase call
   so a missing column in one module can't break the whole page.
   --------------------------------------------------------------------------- */

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { customerProfileT } from "@/lib/translations/customer-profile";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import CustomersIcon from "@/components/icons/CustomersIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import CreditCardIcon from "@/components/icons/ui/CreditCardIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import CrownIcon from "@/components/icons/ui/CrownIcon";
import CircleDollarSignIcon from "@/components/icons/ui/CircleDollarSignIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import {
  fetchCustomerContact,
  fetchCustomerActivity,
  findLinkedCommercialCustomer,
  createLinkedCommercialCustomer,
  normalizeTier,
  type CustomerContactRow,
  type CustomerActivity,
  type LinkedCommercialCustomer,
  type ActivityBucket,
  type ActivityItem,
  type CustomerTier,
} from "@/lib/customers-admin";

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const TIER_STYLES: Record<CustomerTier, string> = {
  end_user: "text-slate-300 bg-slate-500/10 border-slate-400/30",
  silver:   "text-slate-200 bg-slate-300/10 border-slate-300/30",
  gold:     "text-amber-200 bg-amber-400/10 border-amber-400/30",
  platinum: "text-cyan-200  bg-cyan-500/10  border-cyan-400/30",
  diamond:  "text-violet-200 bg-violet-500/10 border-violet-400/30",
};

const TIER_LABELS: Record<CustomerTier, string> = {
  end_user: "End User",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
};

const TABS = ["activity", "commercial", "details"] as const;
type Tab = (typeof TABS)[number];

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

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

/** Customer display title:
 *   · B2B (entity_type=company) → company_name first, else display_name
 *   · B2C (entity_type=person)  → display_name / first last */
function customerTitle(c: CustomerContactRow, unnamed: string): string {
  const entity = (c.entity_type as string) || "";
  const displayName = c.display_name as string | null;
  const companyName = c.company_name as string | null;
  if (entity === "company" && companyName) return companyName;
  if (displayName) return displayName;
  if (companyName) return companyName;
  const first = c.first_name as string | null;
  const last = c.last_name as string | null;
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return unnamed;
}

/* ═══════════════════════════════════════════════════
   REUSABLE BITS
   ═══════════════════════════════════════════════════ */

const panelCls =
  "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";

function Avatar({ name, size = 80 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center shrink-0 text-[var(--text-dim)]"
      style={{ width: size, height: size }}
    >
      {initials
        ? <span className="font-semibold" style={{ fontSize: size * 0.36 }}>{initials}</span>
        : <CustomersIcon size={size * 0.5} />}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value == null || value === "" ||
    (typeof value === "string" && !value.trim());
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-[var(--border-faint)] last:border-0">
      <span className="text-[11px] text-[var(--text-faint)] uppercase tracking-wide w-[130px] shrink-0">{label}</span>
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
  const { t } = useTranslation(customerProfileT);
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
              {bucket.count === 0 ? emptyHint : `${bucket.count} ${t("activity.total")}`}
            </p>
          </div>
        </div>
        {bucket.count > 0 && (
          <Link
            href={appHref}
            className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
          >
            {t("activity.open")} <ArrowRightIcon size={10} />
          </Link>
        )}
      </div>

      {bucket.recent.length === 0 ? (
        <div className="text-[12px] text-[var(--text-faint)] py-3">{t("activity.nothing")}</div>
      ) : (
        <ul className="divide-y divide-[var(--border-faint)]">
          {bucket.recent.map((r) => <ActivityRow key={r.id} item={r} />)}
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

export default function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation(customerProfileT);
  const [contact, setContact] = useState<CustomerContactRow | null>(null);
  const [linked, setLinked] = useState<LinkedCommercialCustomer | null>(null);
  const [activity, setActivity] = useState<CustomerActivity | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("activity");
  const [creatingCommercial, setCreatingCommercial] = useState(false);
  const [createError, setCreateError] = useState(false);

  const handleCreateCommercial = async () => {
    if (!contact || creatingCommercial) return;
    setCreatingCommercial(true);
    setCreateError(false);
    const created = await createLinkedCommercialCustomer(contact);
    if (created) setLinked(created);
    else setCreateError(true);
    setCreatingCommercial(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const c = await fetchCustomerContact(id);
      if (cancelled) return;
      if (!c || c.contact_type !== "customer") {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setContact(c);
      /* Kick off the two heavy fetches in parallel. Profile header
         can render the moment the contact row resolves. */
      const [actRes, linkRes] = await Promise.all([
        fetchCustomerActivity(c.id),
        findLinkedCommercialCustomer(c),
      ]);
      if (cancelled) return;
      setActivity(actRes);
      setLinked(linkRes);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const activityTotal = useMemo(() => {
    if (!activity) return 0;
    return activity.opportunities.count
      + activity.quotations.count
      + activity.invoices.count
      + activity.projects.count
      + activity.tasks.count;
  }, [activity]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <CustomersIcon size={32} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-sm text-[var(--text-primary)] font-medium mb-1">{t("notFound.title")}</p>
          <Link href="/customers" className="text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] underline underline-offset-2">
            {t("notFound.back")}
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !contact) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <SpinnerIcon size={28} className="animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  const title = customerTitle(contact, t("title.unnamed"));
  const tier = normalizeTier(contact.customer_type);
  const isActive = contact.is_active !== false;
  const entity = (contact.entity_type as string) || "person";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="mx-auto px-4 md:px-6 lg:px-10 xl:px-16 py-6 md:py-8">

        {/* ── Back ── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/customers"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
              aria-label={t("notFound.back")}
            >
              <ArrowLeftIcon size={16} />
            </Link>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t("header.title")}</h1>
          </div>
          {/* The existing Contacts component handles edit — link back into it */}
          <Link
            href={`/customers?selected=${contact.id}`}
            className="h-9 px-4 rounded-xl text-[12px] font-medium bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] inline-flex items-center gap-2 transition-colors"
          >
            <PencilIcon size={12} /> {t("header.editInList")}
          </Link>
        </div>

        {/* ── Header card ── */}
        <section className={`${panelCls} mb-4`}>
          <div className="flex items-start gap-5">
            <Avatar name={title} size={80} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-[var(--text-primary)] truncate">{title}</h2>
                {tier && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${TIER_STYLES[tier]}`}>
                    <CrownIcon size={10} /> {t(`tier.${tier}`, TIER_LABELS[tier])}
                  </span>
                )}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                  isActive
                    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                    : "text-slate-400 bg-slate-400/10 border-slate-400/20"
                }`}>
                  {isActive ? t("status.active") : t("status.inactive")}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border border-[var(--border-faint)] bg-[var(--bg-surface)] text-[var(--text-dim)] capitalize">
                  {t(`entity.${entity}`, entity)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-[var(--text-dim)]">
                {contact.email ? (
                  <span className="flex items-center gap-1.5"><EnvelopeIcon size={12} /> {String(contact.email)}</span>
                ) : null}
                {contact.phone ? (
                  <span className="flex items-center gap-1.5"><PhoneIcon size={12} /> {String(contact.phone)}</span>
                ) : null}
                {contact.country ? (
                  <span className="flex items-center gap-1.5"><GlobeIcon size={12} /> {String(contact.country)}</span>
                ) : null}
                {contact.city ? (
                  <span className="flex items-center gap-1.5"><MapPinIcon size={12} /> {String(contact.city)}</span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Missing commercial record nudge */}
          {!linked && (
            <div className="mt-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <CircleDollarSignIcon size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-amber-300">{t("nudge.noCommercial")}</div>
                <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={handleCreateCommercial}
                    disabled={creatingCommercial}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[12px] font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    <CircleDollarSignIcon size={13} />
                    {creatingCommercial ? t("nudge.creating") : t("nudge.createBtn")}
                  </button>
                  {createError && (
                    <span className="text-[11px] text-red-400">{t("nudge.createFailed")}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto">
          {TABS.map((tabKey) => {
            const label = tabKey === "activity" ? `${t("tab.activity")}${activity ? ` · ${activityTotal}` : ""}`
              : tabKey === "commercial" ? t("tab.commercial")
              : t("tab.details");
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

        {/* ── Activity ── */}
        {tab === "activity" && (
          <div>
            {!activity ? (
              <div className="flex items-center justify-center py-16">
                <SpinnerIcon size={20} className="animate-spin text-[var(--text-dim)]" />
              </div>
            ) : activityTotal === 0 ? (
              <div className={`${panelCls} text-center py-10`}>
                <ClockIcon size={24} className="mx-auto text-[var(--text-faint)] mb-2" />
                <p className="text-[13px] text-[var(--text-primary)] font-medium mb-1">{t("activity.emptyTitle")}</p>
                <p className="text-[12px] text-[var(--text-dim)]">
                  {t("activity.emptyHint")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <ActivityCard
                  title={t("card.opportunities")}
                  icon={BriefcaseIcon}
                  bucket={activity.opportunities}
                  appHref="/crm"
                  emptyHint={t("card.empty.opportunities")}
                />
                <ActivityCard
                  title={t("card.quotations")}
                  icon={DocumentIcon}
                  bucket={activity.quotations}
                  appHref="/quotations"
                  emptyHint={t("card.empty.quotations")}
                />
                <ActivityCard
                  title={t("card.invoices")}
                  icon={CreditCardIcon}
                  bucket={activity.invoices}
                  appHref="/invoices"
                  emptyHint={t("card.empty.invoices")}
                />
                <ActivityCard
                  title={t("card.projects")}
                  icon={BriefcaseIcon}
                  bucket={activity.projects}
                  appHref="/projects"
                  emptyHint={t("card.empty.projects")}
                />
                <ActivityCard
                  title={t("card.tasks")}
                  icon={CheckIcon}
                  bucket={activity.tasks}
                  appHref="/projects"
                  emptyHint={t("card.empty.tasks")}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Commercial ── */}
        {tab === "commercial" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className={panelCls}>
              <SectionHeader icon={CircleDollarSignIcon} title={t("sec.salesCredit")} description={t("sec.salesCredit.desc")} />
              <div>
                <InfoRow label={t("f.tier")} value={tier ? t(`tier.${tier}`, TIER_LABELS[tier]) : null} />
                <InfoRow label={t("f.entityType")} value={t(`entity.${entity}`, entity)} />
                <InfoRow label={t("f.salesRep")} value={contact.sales_rep as string | null} />
                <InfoRow label={t("f.paymentTerms")} value={contact.payment_terms as string | null} />
                <InfoRow label={t("f.creditLimit")} value={contact.credit_limit as string | null} />
                <InfoRow label={t("f.creditCurrency")} value={contact.currency as string | null} />
                <InfoRow label={t("f.approvedBy")} value={contact.credit_limit_approved_by as string | null} />
                <InfoRow label={t("f.approvedOn")} value={formatDate(contact.credit_limit_approved_date as string | null)} />
              </div>
            </section>

            <section className={panelCls}>
              <SectionHeader
                icon={BriefcaseIcon}
                title={t("sec.linked")}
                description={t("sec.linked.desc")}
              />
              {linked ? (
                <div>
                  <InfoRow label={t("f.customerCode")} value={linked.customer_code} />
                  <InfoRow label={t("f.name")} value={linked.name} />
                  <InfoRow label={t("f.pricingTier")} value={linked.preferred_pricing_tier} />
                  <InfoRow label={t("f.salesperson")} value={linked.assigned_salesperson} />
                  <InfoRow label={t("f.currency")} value={linked.currency_code} />
                  <InfoRow label={t("f.paymentTerms")} value={linked.payment_terms} />
                  <InfoRow label={t("f.lastContact")} value={formatDate(linked.last_contact_date)} />
                  <InfoRow label={t("f.nextFollowup")} value={formatDate(linked.next_followup_date)} />
                  <InfoRow label={t("f.status")} value={linked.status} />
                </div>
              ) : (
                <div className="text-[12px] text-[var(--text-dim)] py-3">
                  {t("sec.linked.none")}
                </div>
              )}
            </section>

            <section className={panelCls}>
              <SectionHeader icon={ClockIcon} title={t("sec.touchpoints")} description={t("sec.touchpoints.desc")} />
              <div>
                <InfoRow label={t("f.firstContact")} value={formatDate(contact.first_contact_date as string | null)} />
                <InfoRow label={t("f.lastContact")} value={formatDate(contact.last_contacted as string | null)} />
                <InfoRow label={t("f.followUp")} value={formatDate(contact.follow_up_date as string | null)} />
                <InfoRow label={t("f.preferredChannel")} value={contact.communication_preference as string | null} />
                <InfoRow label={t("f.language")} value={contact.language as string | null} />
              </div>
            </section>
          </div>
        )}

        {/* ── Details ── */}
        {tab === "details" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className={panelCls}>
              <SectionHeader icon={MapPinIcon} title={t("sec.address")} />
              <div>
                <InfoRow label={t("f.line1")} value={contact.address_line1 as string | null} />
                <InfoRow label={t("f.line2")} value={contact.address_line2 as string | null} />
                <InfoRow label={t("f.city")} value={contact.city as string | null} />
                <InfoRow label={t("f.state")} value={contact.state as string | null} />
                <InfoRow label={t("f.postal")} value={contact.postal_code as string | null} />
                <InfoRow label={t("f.country")} value={contact.country as string | null} />
              </div>
            </section>

            <section className={panelCls}>
              <SectionHeader icon={PhoneIcon} title={t("sec.channels")} />
              <div>
                <InfoRow label={t("f.email")} value={contact.email as string | null} />
                <InfoRow label={t("f.phone")} value={contact.phone as string | null} />
                <InfoRow label={t("f.whatsapp")} value={contact.whatsapp as string | null} />
                <InfoRow label={t("f.whatsappBiz")} value={contact.whatsapp_business as string | null} />
                <InfoRow label={t("f.wechat")} value={contact.wechat_id as string | null} />
                <InfoRow label={t("f.telegram")} value={contact.telegram_id as string | null} />
                <InfoRow label={t("f.line")} value={contact.line_id as string | null} />
                <InfoRow label={t("f.skype")} value={contact.skype_id as string | null} />
              </div>
            </section>

            {(contact.notes || contact.internal_notes) ? (
              <section className={`${panelCls} lg:col-span-2`}>
                <SectionHeader icon={DocumentIcon} title={t("sec.notes")} />
                {contact.notes ? (
                  <div className="mb-3">
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide mb-1">{t("notes.public")}</p>
                    <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap">{contact.notes as string}</p>
                  </div>
                ) : null}
                {contact.internal_notes ? (
                  <div>
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide mb-1">{t("notes.internal")}</p>
                    <p className="text-[13px] text-amber-300/90 whitespace-pre-wrap">{contact.internal_notes as string}</p>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
