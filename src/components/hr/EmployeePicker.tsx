"use client";

/* ---------------------------------------------------------------------------
   EmployeePicker — the way HR forms choose a person.

   Replaces the native <select> that showed a bare `full_name`: an operator
   picking from a 60-row dropdown could not tell two similar English names
   apart, and the Chinese name — how half the team is actually known — was
   nowhere. This shows the photo, both names (via the shared <PersonName>),
   and the department · position line, with type-to-filter across all of them.

   Shaped to match the HR form controls (h-10, rounded-xl, 13px, surface
   background) so it drops into a field stack without looking foreign. The
   list renders IN FLOW rather than absolutely positioned — same choice as
   <DatePicker> — so a scrolling modal can never clip it.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import PersonName from "@/components/ui/PersonName";
import { fpAvatar } from "@/lib/cdn";
import type { EmployeeListItem } from "@/lib/employees-admin";
import UserIcon from "@/components/icons/ui/UserIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";

/** Photo, or initials, or the generic person glyph — in that order. */
export function EmployeeAvatar({
  employee,
  size = 32,
}: {
  employee: EmployeeListItem;
  size?: number;
}) {
  const src = fpAvatar(employee.person.avatar_url);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars come from Storage at arbitrary sizes
      <img
        src={src}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = (employee.person.full_name || "")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="rounded-full bg-[var(--bg-surface-subtle,var(--bg-surface))] border border-[var(--border-faint,var(--border-subtle))] flex items-center justify-center shrink-0 text-[var(--text-dim)]"
      style={{ width: size, height: size }}
    >
      {initials
        ? <span className="font-semibold" style={{ fontSize: size * 0.38 }}>{initials}</span>
        : <UserIcon size={Math.round(size * 0.45)} />}
    </div>
  );
}

/** Department · position, whichever exist. */
export function employeeRoleLine(emp: EmployeeListItem): string {
  return [emp.department_name, emp.position_title].filter(Boolean).join(" · ");
}

export default function EmployeePicker({
  employees,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled,
}: {
  employees: EmployeeListItem[];
  value: string;
  onChange: (employeeId: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  /** Shown when the search matches nobody. */
  emptyLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => employees.find((e) => e.id === value) ?? null,
    [employees, value],
  );

  /* Match on both names, the employee number, department and position — an
     operator searching "warehouse" or "黎" should land somewhere useful. */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [
        e.person.full_name,
        e.person.name_alt,
        e.employee_number,
        e.department_name,
        e.position_title,
      ]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q)),
    );
  }, [employees, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    /* Focus the filter so typing works immediately, but not on touch — it
       would throw up the keyboard over the list the user came to read. */
    if (window.matchMedia?.("(pointer: fine)").matches) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      /* Stop at this layer: the enclosing modal also closes on Escape, and
         one keypress should only close one thing. */
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full h-10 px-3 rounded-xl bg-[var(--bg-surface)] border text-[13px] outline-none transition-colors flex items-center gap-2.5 text-start disabled:opacity-50 ${
          open ? "border-[var(--border-focus)]" : "border-[var(--border-subtle)]"
        }`}
      >
        {selected ? (
          <>
            <EmployeeAvatar employee={selected} size={24} />
            <PersonName
              name={selected.person.full_name}
              alt={selected.person.name_alt}
              className="min-w-0 flex-1"
              nameClassName="text-[13px] text-[var(--text-primary)] truncate block"
              altClassName="text-[11px] text-[var(--text-dim)] truncate block"
            />
          </>
        ) : (
          <span className="flex-1 text-[var(--text-dim)]">{placeholder}</span>
        )}
        <AngleDownIcon size={14} className="text-[var(--text-dim)] shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="mt-2 rounded-2xl bg-[var(--bg-elevated,var(--bg-surface))] border border-[var(--border-subtle)] shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden"
        >
          <div className="p-2 border-b border-[var(--border-subtle)]">
            <div className="relative">
              <SearchIcon
                size={13}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none"
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-9 ps-8 pe-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] text-[12px] text-[var(--text-primary)] outline-none transition-colors"
              />
            </div>
          </div>

          <div className="max-h-[248px] overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-[var(--text-dim)]">
                {emptyLabel}
              </div>
            ) : (
              filtered.map((emp) => {
                const isSelected = emp.id === value;
                const role = employeeRoleLine(emp);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => { onChange(emp.id); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-start transition-colors ${
                      isSelected
                        ? "bg-[var(--bg-inverted)]/[0.06]"
                        : "hover:bg-[var(--bg-inverted)]/[0.04]"
                    }`}
                  >
                    <EmployeeAvatar employee={emp} size={30} />
                    <span className="flex-1 min-w-0">
                      <PersonName
                        name={emp.person.full_name}
                        alt={emp.person.name_alt}
                        nameClassName="text-[13px] font-medium text-[var(--text-primary)] truncate block"
                        altClassName="text-[11px] text-[var(--text-dim)] truncate block"
                      />
                      {role && (
                        <span className="block text-[11px] text-[var(--text-dim)] truncate">{role}</span>
                      )}
                    </span>
                    {isSelected && (
                      <CheckIcon size={14} className="text-[var(--accent)] shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
