"use client";

/* ---------------------------------------------------------------------------
   PeopleField — pick people by name: chosen ones as chips, "Add" opens a
   search over the list the server allowed. The composer's To / Copy, and
   (6A) the people a report is forwarded to or a task is for. Its words are
   the composer's (composer.addPeople / searchPeople / noPeople).
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import RrIcon from "@/components/ui/RrIcon";
import type { ReportPerson } from "@/lib/work-reports";
import { Avatar, FIELD, type T } from "./shared";

export default function PeopleField({ t, label, ids, people, nameOf, onChange, hint, max }: {
  t: T; label: string; ids: string[]; people: ReportPerson[]; nameOf: Map<string, ReportPerson>;
  onChange: (ids: string[]) => void; hint?: string;
  /** No more than this many (the add button goes when it is reached). */
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return people.filter((p) => !ids.includes(p.id) && (!s || p.name.toLowerCase().includes(s) || (p.nameAlt ?? "").toLowerCase().includes(s))).slice(0, 8);
  }, [people, ids, q]);
  const full = max !== undefined && ids.length >= max;
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((pid) => {
          const p = nameOf.get(pid);
          return (
            <span key={pid} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-0.5 ps-0.5 pe-1 text-[12px] text-[var(--text-primary)]">
              <Avatar person={{ name: p?.name ?? "?", avatar: p?.avatar ?? null }} size={20} />
              <span className="max-w-[140px] truncate">{p?.name ?? "—"}</span>
              <button type="button" onClick={() => onChange(ids.filter((x) => x !== pid))} aria-label={`${label}: ${p?.name ?? ""} ×`} className="grid h-5 w-5 place-items-center rounded-full text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                <RrIcon name="cross" size={9} />
              </button>
            </span>
          );
        })}
        {!full && (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">
            <RrIcon name="plus" size={10} />{t("composer.addPeople")}
          </button>
        )}
      </div>
      {hint && ids.length > 0 && <p className="mt-1 text-[11px] text-[var(--text-faint)]">{hint}</p>}
      {open && !full && (
        <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("composer.searchPeople")} className={`${FIELD} h-8 py-1`} aria-label={t("composer.searchPeople")} />
          <ul className="mt-1 max-h-56 overflow-y-auto">
            {matches.length === 0 && <li className="px-2 py-2 text-[12px] text-[var(--text-dim)]">{t("composer.noPeople")}</li>}
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { onChange([...ids, p.id]); setQ(""); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[12.5px] hover:bg-[var(--bg-surface)]">
                  <Avatar person={p} size={22} />
                  <span className="min-w-0">
                    <span className="block truncate text-[var(--text-primary)]">{p.name}</span>
                    {p.position && <span className="block truncate text-[10.5px] text-[var(--text-dim)]">{p.position}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
