"use client";

/* ---------------------------------------------------------------------------
   PartyChip — compact inline display of a chosen customer or supplier.
   Used in the Order editor and Order list card next to where the user
   picks the customer or each supplier. Shows avatar / logo + name +
   country flag + tier badge (customers only).
   --------------------------------------------------------------------------- */

import type { FinancePartyRow } from "@/components/finance/PartyPickerModal";
import { COUNTRIES } from "@/lib/commercial-policy/countries";
import RrIcon from "@/components/ui/RrIcon";

const TIER_COLORS: Record<NonNullable<FinancePartyRow["customer_tier"]>, string> = {
  end_user: "bg-gray-500/15 text-gray-300",
  silver:   "bg-zinc-400/15 text-zinc-200",
  gold:     "bg-amber-500/15 text-amber-300",
  platinum: "bg-sky-500/15 text-sky-300",
  diamond:  "bg-violet-500/15 text-violet-300",
};

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
  if (!party || !party.name?.trim()) {
    return (
      <button
        type="button"
        onClick={onChange}
        className="flex w-full items-center justify-between rounded-lg border border-dashed border-white/10 bg-[var(--bg-primary)] px-3 py-2 text-left text-sm text-gray-500 transition hover:border-emerald-500/40 hover:text-gray-300"
      >
        <span>{placeholder}</span>
        <span className="rounded border border-white/[0.06] bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Pick
        </span>
      </button>
    );
  }
  const flag = flagFor(party.country_code);
  return (
    <div className="group flex items-center gap-2 rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5">
      {/* Avatar */}
      <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.06] bg-[var(--bg-secondary)] ${compact ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[11px]"} font-semibold text-gray-300`}>
        {party.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={party.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          (party.name || "?").slice(0, 1).toUpperCase()
        )}
      </div>
      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate text-sm font-medium text-[var(--text-primary)]">{party.name}</span>
          {flag && <span className="text-xs">{flag}</span>}
          {party.customer_tier && party.customer_tier !== "end_user" && (
            <span className={`rounded-full px-1 py-0.5 text-[8px] font-semibold uppercase ${TIER_COLORS[party.customer_tier]}`}>
              {party.customer_tier}
            </span>
          )}
        </div>
        {!compact && (party.company || party.payment_terms) && (
          <div className="mt-0.5 truncate text-[10px] text-gray-500">
            {[party.company, party.payment_terms].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={onChange}
          className="rounded-md px-2 py-0.5 text-[10px] font-medium text-gray-300 hover:bg-white/5"
          title="Change"
        >
          Change
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[10px] font-medium text-rose-400 hover:bg-rose-500/10"
            title="Clear"
          >
            <RrIcon name="cross" size={10} />
          </button>
        )}
      </div>
    </div>
  );
}
