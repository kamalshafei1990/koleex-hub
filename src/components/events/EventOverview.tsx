"use client";

/* ---------------------------------------------------------------------------
   EventOverview — the read-only summary: facts on the left, the invitation
   funnel on the right. Phase 1 tracks answers here; Phase 2 turns the same
   counts into live RSVP numbers.
   --------------------------------------------------------------------------- */

import { useTranslation } from "@/lib/i18n";
import { eventsT } from "@/lib/translations/events";
import { GUEST_STATUSES, formatEventDate, ownerDisplayName, type EventDetail } from "@/lib/events/types";
import { CARD } from "@/components/events/fields";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{label}</p>
      <div className="mt-1 text-[13px] text-[var(--text-primary)]">{children}</div>
    </div>
  );
}

export default function EventOverview({ detail }: { detail: EventDetail }) {
  const { t } = useTranslation(eventsT);

  const startLabel = formatEventDate(detail.start_at);
  const endLabel = formatEventDate(detail.end_at);
  const dateLine = startLabel
    ? endLabel && endLabel !== startLabel ? `${startLabel} → ${endLabel}` : startLabel
    : t("ov.noDates");
  const placeLine =
    [detail.location, detail.city, detail.country].filter(Boolean).join(" · ") || t("ov.noLocation");

  const funnel = GUEST_STATUSES.map((s) => ({
    status: s,
    count: detail.guests.filter((g) => g.status === s).length,
  })).filter((f) => f.count > 0 || ["listed", "invited", "accepted", "attended"].includes(f.status));

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <section className={`${CARD} space-y-4 p-4 sm:p-5 lg:col-span-2`}>
        <Fact label={t("ov.when")}>
          <span className="tabular-nums">{dateLine}</span>
        </Fact>
        <Fact label={t("ov.where")}>{placeLine}</Fact>
        <Fact label={t("ov.owner")}>{ownerDisplayName(detail.owner) || "—"}</Fact>
        {detail.budget_total != null && (
          <Fact label={t("ov.budget")}>
            <span className="tabular-nums">{detail.budget_total.toLocaleString("en-US")}</span>
          </Fact>
        )}
        {detail.expected_guests != null && (
          <Fact label={t("form.expectedGuests")}>
            <span className="tabular-nums">{detail.expected_guests}</span>
          </Fact>
        )}
        {detail.booth && <Fact label={t("form.booth")}>{detail.booth}</Fact>}
        {detail.website && (
          <Fact label={t("form.website")}>
            <a
              href={detail.website}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--text-secondary)] underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--text-primary)]"
            >
              {detail.website}
            </a>
          </Fact>
        )}
        {detail.description && (
          <Fact label={t("ov.description")}>
            <p className="whitespace-pre-wrap text-[var(--text-secondary)]">{detail.description}</p>
          </Fact>
        )}
      </section>

      <section className={`${CARD} p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold">{t("ov.funnel")}</h2>
        <p className="mt-1 text-[11px] text-[var(--text-dim)]">{t("ov.funnelHint")}</p>
        <dl className="mt-4 space-y-2">
          {funnel.map((f) => (
            <div key={f.status} className="flex items-center justify-between text-[13px]">
              <dt className="text-[var(--text-secondary)]">{t(`gst.${f.status}`)}</dt>
              <dd className="tabular-nums font-medium">{f.count}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
