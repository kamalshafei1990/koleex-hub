/* Phase-0 signpost for the identity-data consolidation
   (docs/identity-data-architecture-plan.md).

   Name / contact / address for a person live in ONE shared record
   (`people`), which Settings, the Accounts app, and the Employees app all
   edit. This subtle note makes that shared spine visible so the same fields
   across apps don't read as "re-enter the same data." Purely informational —
   no behaviour, no data. */

import InfoIcon from "@/components/icons/ui/InfoIcon";

export default function IdentitySourceNote({ text, className = "" }: {
  text: string;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 ${className}`}>
      <InfoIcon size={13} className="mt-0.5 shrink-0 text-[var(--text-faint)]" />
      <p className="text-[11.5px] leading-relaxed text-[var(--text-dim)]">{text}</p>
    </div>
  );
}
