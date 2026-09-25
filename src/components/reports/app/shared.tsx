"use client";

/* ---------------------------------------------------------------------------
   Reports app — the small pieces every screen shares: the status chip, the
   badges, a person's avatar, and one report row for any list.

   Colours come from the Hub tokens only, so the same markup reads as flat
   Core or as Aurora glass inside the segment's `kx-app` scope. Semantic
   colour (sent / approved / returned) is kept apart from the accent.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import RrIcon from "@/components/ui/RrIcon";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import { reportTemplate } from "@/lib/reports/templates";
import { pickWord } from "@/lib/reports/template-words";
import type { Lang } from "@/lib/i18n";
import type { RrIconName } from "@/components/ui/RrIcon";
import { dmyDate, periodLabel, type ReportListRow, type ReportPerson, type ReportStatus } from "@/lib/work-reports";
import { initialsOf } from "@/lib/discuss/initials";

export type T = (key: string, fallback?: string) => string;

export const CARD = "kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]";
export const FIELD =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--border-focus)]";

export const tplName = (t: T, key: string) => t(`tpl.${key}.name`);
export const reportTitle = (t: T, r: { title: string; templateKey: string }) => (r.title?.trim() ? r.title.trim() : tplName(t, r.templateKey));

const STATUS_CLS: Record<ReportStatus, string> = {
  draft: "border-[var(--border-subtle)] text-[var(--text-dim)]",
  submitted: "border-sky-500/25 bg-sky-500/10 text-sky-400",
  approved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  returned: "border-amber-500/25 bg-amber-500/10 text-amber-400",
};

export function StatusChip({ status, t }: { status: ReportStatus; t: T }) {
  return <span className={`inline-flex h-5 items-center rounded-md border px-1.5 text-[10.5px] font-medium ${STATUS_CLS[status]}`}>{t(`status.${status}`)}</span>;
}

export function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" | "warn" | "danger" }) {
  const cls = {
    muted: "border-[var(--border-subtle)] text-[var(--text-dim)]",
    accent: "border-[#567FB2]/40 bg-[#567FB2]/12 text-[#9DBCE0]",
    warn: "border-amber-500/25 bg-amber-500/10 text-amber-400",
    danger: "border-red-500/25 bg-red-500/10 text-red-400",
  }[tone];
  return <span className={`inline-flex h-5 items-center rounded-md border px-1.5 text-[10.5px] font-medium ${cls}`}>{children}</span>;
}

export function Avatar({ person, size = 28 }: { person: Pick<ReportPerson, "name" | "avatar">; size?: number }) {
  /* The Hub's initials rule (lib/discuss/initials): first + LAST word, so
     "Mustafa El Anany" is MA, not "ME" — which read as the word "me" on a
     recipient chip. It also skips punctuation tokens ("Li Wei (Sales)") and
     handles Arabic/Chinese names. Titles are dropped first, as before. */
  const initials = initialsOf((person.name || "").split(/\s+/).filter((w) => !/^(mr|mrs|ms|dr)\.?$/i.test(w)).join(" "));
  return person.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element -- avatars are small remote images already sized by the uploader
    <img src={person.avatar} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-[var(--bg-surface-subtle)] text-[10.5px] font-semibold text-[var(--text-secondary)]" style={{ width: size, height: size }} aria-hidden>
      {initials || "?"}
    </span>
  );
}

/** `icon`: a builder type's own (4E) — a built-in's comes from its key. */
export function TemplateIcon({ templateKey, icon, size = 14 }: { templateKey: string; icon?: RrIconName; size?: number }) {
  return <RrIcon name={icon ?? reportTemplate(templateKey)?.icon ?? "document"} size={size} />;
}

/** One report in any list: who, what, which period, and its state. A
 *  builder type (4E) is named as the report was started with it. */
export function ReportRowItem({ r, t, lang, showAuthor = true }: { r: ReportListRow; t: T; lang: string; showAuthor?: boolean }) {
  const unread = !!r.myRole && !r.readAt;
  const builtin = reportTemplate(r.templateKey);
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
            <span className="inline-flex items-center gap-1"><TemplateIcon templateKey={r.templateKey} icon={builtin ? undefined : r.tpl?.icon} size={11} />{typeName}</span>
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
