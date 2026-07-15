"use client";

/* ---------------------------------------------------------------------------
   PartyChip — compact inline display of a chosen customer or supplier.
   Used in the Order editor and Order list card next to where the user
   picks the customer or each supplier. Shows avatar / logo + name +
   country flag + tier badge (customers only).
   --------------------------------------------------------------------------- */

import type { FinancePartyRow } from "@/components/finance/PartyPickerModal";
import { fpAvatar } from "@/lib/cdn";
import { COUNTRIES } from "@/lib/commercial-policy/countries";
import { getTierColor, tierTextStyle } from "@/lib/customer-tiers";
import RrIcon from "@/components/ui/RrIcon";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";

export interface PartyChipData {
  id?: string | null;
  name: string;
  company?: string | null;
  country_code?: string | null;
  customer_tier?: FinancePartyRow["customer_tier"] | null;
  photo_url?: string | null;
  payment_terms?: string | null;
  credit_status?: FinancePartyRow["credit_status"] | null;
}

function flagFor(code: string | null | undefined): string | null {
  if (!code) return null;
  const up = code.toUpperCase();
  const hit = COUNTRIES.find((c) => c.code === up);
  return hit?.flag ?? null;
}

export default function PartyChip({
  party,
  onChange,
  onClear,
  placeholder = "Pick…",
  compact,
}: {
  party: PartyChipData | null | undefined;
  onChange: () => void;
  onClear?: () => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation(financeT);
  if (!party || !party.name?.trim()) {
    return (
      <button
        type="button"
        onClick={onChange}
        className="flex w-full items-center justify-between rounded-lg border border-dashed border-white/10 bg-[var(--bg-primary)] px-3 py-2 text-left text-sm text-[var(--text-dim)] transition hover:border-emerald-500/40 hover:text-[var(--text-highlight)]"
      >
        <span>{placeholder}</span>
        <span className="rounded border border-[var(--border-subtle)] bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Pick
        </span>
      </button>
    );
  }
  const flag = flagFor(party.country_code);
  return (
    <div className="group flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5">
      {/* Avatar */}
      <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] ${compact ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[11px]"} font-semibold text-[var(--text-highlight)]`}>
        {party.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fpAvatar(party.photo_url)} alt="" className="h-full w-full object-cover" />
        ) : (
          (party.name || "?").slice(0, 1).toUpperCase()
        )}
      </div>
      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate text-sm font-medium text-[var(--text-primary)]">{party.name}</span>
          {flag && <span className="text-xs">{flag}</span>}
          {(() => {
            const tm = getTierColor(party.customer_tier);
            if (!tm || tm.value === "end_user") return null;
            return (
              <span
                className="rounded-full px-1 py-0.5 text-[8px] font-semibold uppercase"
                style={{ backgroundColor: tm.tintBg }}
              >
                <span className="kx-tier-metal" style={tierTextStyle(tm)}>
                  {party.customer_tier}
                </span>
              </span>
            );
          })()}
        </div>
        {!compact && (party.company || party.payment_terms) && (
          <div className="mt-0.5 truncate text-[10px] text-[var(--text-dim)]">
            {[party.company, party.payment_terms].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={onChange}
          className="rounded-md px-2 py-0.5 text-[10px] font-medium text-[var(--text-highlight)] hover:bg-white/5"
          title={t("party.change", "Change")}
        >
          {t("party.change", "Change")}
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            title={t("party.clear", "Clear")}
          >
            <RrIcon name="cross" size={10} />
          </button>
        )}
      </div>
    </div>
  );
}
