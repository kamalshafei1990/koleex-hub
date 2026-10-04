"use client";

import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";

/* ---------------------------------------------------------------------------
   UnitPicker — the one control that says which unit a number is being typed in.

   It started as a bare <select>, which was wrong twice over: the Hub has a
   single dropdown style and a native select is not it, and on the weight field
   the browser's own chevron landed beside the suggestion list's chevron — two
   arrows, a centimetre apart, doing different things.

   A unit has two or three values, all one or two characters long. That is a
   segmented control, not a menu: every option is visible, the current one is
   obvious, and choosing takes one click instead of two. Same shape as the
   Size / Weight switch above the packing crates, so every unit control on the
   form reads as the same control.
   --------------------------------------------------------------------------- */

export default function UnitPicker({
  value, options, onPick, canonical, size = "md",
}: {
  value: string;
  options: readonly string[];
  onPick: (u: string) => void;
  /** The unit the value is STORED in — named in the tooltip so the operator
   *  can see that switching changes the typing, not the product. */
  canonical: string;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-8" : "h-10";
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  return (
    <span
      className={`inline-flex shrink-0 ${h} rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/60 overflow-hidden`}
      title={t("pk.unitTitle", "Type in any unit — the value is stored in {unit}.").replace("{unit}", canonical)}
    >
      {options.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onPick(u)}
          aria-pressed={value === u}
          aria-label={t("pk.unitEnter", "Enter values in {unit}").replace("{unit}", u)}
          className={`px-2 text-[11px] font-semibold tabular-nums transition-colors ${
            value === u
              ? "bg-[#567FB2]/[0.18] text-[var(--text-primary)]"
              : "text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
          }`}
        >
          {u}
        </button>
      ))}
    </span>
  );
}
