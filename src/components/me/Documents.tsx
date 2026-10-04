"use client";

/* Documents — what HR holds on file for me. View-only: HR uploads, I read.
   Files live in the private bucket; a click mints a short-lived signed URL. */

import { useState } from "react";
import { cardCls, fmtDate, StatusBadge, DOC_CATEGORY_MAP, makeTranslationHelpers, EmptyState } from "@/components/hr/shared";
import { resolveHrFileUrl } from "@/components/hr/HrFileField";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import type { MeTabProps } from "./shared";

export default function Documents({ bundle, t }: MeTabProps) {
  const { tCat } = makeTranslationHelpers(t);
  const [opening, setOpening] = useState<string | null>(null);
  const rows = bundle.documents;
  const today = bundle.serverDate;

  const open = async (id: string, value: string) => {
    setOpening(id);
    const url = await resolveHrFileUrl(value);
    setOpening(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className={`${cardCls} overflow-hidden`}>
      {rows.length === 0 ? (
        <EmptyState icon={DocumentIcon} title={t("hr.noDocuments")} subtitle={t("hr.me.documentsHint")} />
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {rows.map((d) => {
            const expired = !!d.expiry_date && d.expiry_date < today;
            return (
              <li key={d.id} className="px-5 py-3.5 flex items-center gap-4 text-[13px]">
                <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-dim)]"><DocumentIcon size={16} /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[var(--text-primary)] truncate">{d.name}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <StatusBadge status={d.category} map={DOC_CATEGORY_MAP} label={tCat(d.category)} />
                    {d.expiry_date && (
                      <span className={`text-[12px] tabular-nums ${expired ? "text-[#FF3333]" : "text-[var(--text-dim)]"}`}>
                        {expired ? t("hr.me.expired") : t("hr.expires")} {fmtDate(d.expiry_date)}
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => open(d.id, d.file_url)} disabled={opening === d.id}
                  className="h-9 px-3 rounded-lg inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0066FF] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50">
                  {opening === d.id ? <SpinnerIcon size={13} /> : <ExternalLinkIcon size={13} />}
                  {t("hr.me.view")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
