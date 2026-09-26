"use client";

/* ---------------------------------------------------------------------------
   Reports app — the small pieces every screen shares: the status chip, the
   badges, a person's avatar, a type's icon. (One report row for any list is
   ./ReportRowItem — it reads the catalog, which the report page must not.)

   Colours come from the Hub tokens only, so the same markup reads as flat
   Core or as Aurora glass inside the segment's `kx-app` scope. Semantic
   colour (sent / approved / returned) is kept apart from the accent.
   --------------------------------------------------------------------------- */

import RrIcon from "@/components/ui/RrIcon";
import type { RrIconName } from "@/components/ui/RrIcon";
import type { ReportPerson, ReportStatus } from "@/lib/work-reports";
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

/** A type's icon — handed in (the report page has its type's own; the
 *  lists read the catalog in ./ReportRowItem). This file carries no catalog,
 *  so the report page stays light (5C). */
export function TemplateIcon({ icon, size = 14 }: { icon?: RrIconName; size?: number }) {
  return <RrIcon name={icon ?? "document"} size={size} />;
}
