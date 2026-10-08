"use client";

/* ---------------------------------------------------------------------------
   Reports app — one report in any list (the home, the inbox, my reports, the
   team). It names a built-in from its head (lib/reports/catalog-heads — 5C:
   the lists carry the heads of the types, never the catalog of sections).
   --------------------------------------------------------------------------- */

import Link from "next/link";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import { reportHead } from "@/lib/reports/catalog-heads";
import { pickWord } from "@/lib/reports/template-words";
import type { Lang } from "@/lib/i18n";
import { dmyDate, periodLabel, type ReportListRow } from "@/lib/work-reports";
import { Avatar, Badge, StatusChip, TemplateIcon, tplName, type T } from "./shared";

/** One report in any list: who, what, which period, and its state. A
 *  builder type (4E) is named as the report was started with it. */
export function ReportRowItem({ r, t, lang, showAuthor = true }: { r: ReportListRow; t: T; lang: string; showAuthor?: boolean }) {
  const unread = !!r.myRole && !r.readAt;
  const builtin = reportHead(r.templateKey);
  const tpl = builtin ?? (r.tpl ? { cadence: r.tpl.cadence, urgent: r.tpl.urgent } : null);
  const typeName = !builtin && r.tpl ? pickWord(r.tpl.name, lang as Lang) || tplName(t, r.templateKey) : tplName(t, r.templateKey);
  return (
    <li>
      <Link
        href={`/reports/${r.id}`}
        className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--bg-surface-subtle)] focus-visible:bg-[var(--bg-surface-subtle)] focus-visible:outline-none"
      >
        <Avatar person={{ name: showAuthor ? r.authorName : typeName, avatar: null }} />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#567FB2]" aria-label={t("badge.unread")} />}
            <span className={`truncate text-[13px] ${unread ? "font-semibold text-[var(--text-primary)]" : "font-medium text-[var(--text-primary)]"}`}>
              {r.title?.trim() ? <AutoTranslatedText text={r.title} plain /> : typeName}
            </span>
          </span>
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[var(--text-dim)]">
            <span className="inline-flex items-center gap-1"><TemplateIcon icon={builtin ? builtin.icon : r.tpl?.icon} size={11} />{typeName}</span>
            {showAuthor && <span className="truncate">· {r.authorName}</span>}
            <span className="tabular-nums">· {tpl?.cadence ? periodLabel(r.periodStart, r.periodEnd) : dmyDate(r.submittedAt ?? r.updatedAt)}</span>
            {r.version > 1 && <span className="tabular-nums">· {t("badge.version")} {r.version}</span>}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {tpl?.urgent && r.status !== "draft" && <Badge tone="danger">{t("badge.urgent")}</Badge>}
          {r.confidential && <Badge>{t("badge.confidential")}</Badge>}
          {r.reviewRequired && r.status === "submitted" && <Badge tone="warn">{t("badge.review")}</Badge>}
          <StatusChip status={r.status} t={t} />
        </span>
      </Link>
    </li>
  );
}
