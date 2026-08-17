"use client";

/* ---------------------------------------------------------------------------
   Customer picker — search the directory, pick one, pull their passport data.

   Two requests, both on demand:
     · the search itself, debounced and using the SLIM paged list endpoint
       (32 columns, no blobs) — never the full-list path;
     · one fetch of /api/contacts/:id/passport once a customer is chosen.

   Nothing loads until the field is typed in, so opening the form costs zero
   requests here.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

export type PickedCustomer = {
  id: string;
  name: string | null;
  gender: string | null;
  dob: string | null;
  nationality: string | null;
  nationalityCode: string | null;
  country: string | null;
  countryCode: string | null;
  company: string | null;
  position: string | null;
  passportNo: string | null;
  passportIssue: string | null;
  passportExpiry: string | null;
};

type Row = {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  company_name?: string | null;
  country?: string | null;
};

const CONTROL =
  "mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] " +
  "px-3 py-2 text-sm text-[var(--text-primary)] outline-none";

function labelFor(r: Row): string {
  return r.display_name || r.full_name || r.company_name || "—";
}

export default function CustomerPicker({
  contactId,
  label,
  onPick,
}: {
  contactId: string | null;
  label: string;
  onPick: (c: PickedCustomer) => void;
}) {
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Every async result carries the sequence it was requested under, so a slow
     early keystroke can never overwrite a later, more specific search. */
  const seq = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  /* Debounced search. 250 ms is short enough to feel immediate and long
     enough that typing a full name is ONE request, not eight. */
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setRows(null);
      return;
    }
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      setBusy(true);
      setError(null);
      void (async () => {
        try {
          const res = await fetch(
            `/api/contacts?paged=1&type=customer&pageSize=8&q=${encodeURIComponent(q)}`,
            { cache: "no-store" },
          );
          if (!res.ok) throw new Error();
          const body = (await res.json()) as { rows?: Row[] };
          if (mine !== seq.current) return;
          setRows(body.rows ?? []);
          setOpen(true);
        } catch {
          if (mine === seq.current) setError("Search failed.");
        } finally {
          if (mine === seq.current) setBusy(false);
        }
      })();
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);

  /* Close on an outside click — a list left open over the fields below it
     would swallow the next click meant for them. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = useCallback(
    async (row: Row) => {
      setOpen(false);
      setTerm(labelFor(row));
      setBusy(true);
      try {
        const res = await fetch(`/api/contacts/${row.id}/passport`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const p = (await res.json()) as Omit<PickedCustomer, "id"> & { id: string };
        onPick({ ...p, id: row.id });
      } catch {
        /* The passport fetch failing must not lose the choice — link the
           customer with what the search row already told us. */
        onPick({
          id: row.id,
          name: row.full_name ?? row.display_name ?? null,
          gender: null, dob: null, nationality: null, nationalityCode: null,
          country: row.country ?? null, countryCode: null,
          company: row.company_name ?? null, position: null,
          passportNo: null, passportIssue: null, passportExpiry: null,
        });
        setError("Linked, but the passport details could not be loaded.");
      } finally {
        setBusy(false);
      }
    },
    [onPick],
  );

  return (
    <div ref={boxRef} className="relative">
      <span className="block text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      <div className="relative">
        <input
          type="text"
          value={term}
          placeholder="Type a name or company to search"
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => rows && setOpen(true)}
          className={CONTROL}
        />
        {busy && (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
            <SpinnerIcon size={16} />
          </span>
        )}
      </div>
      <p className="mt-1 min-h-[1rem] text-[11px] leading-4 text-[var(--text-dim)]">
        {error ?? (contactId ? "Linked to a customer — the letter will appear in their documents." : "")}
      </p>

      {open && rows && (
        /* kx-glass-pop, not kx-glass: this floats above the form and needs the
           popover recipe, otherwise the fields behind it read through. */
        <ul
          /* kx-glass-pop is Aurora-only, so the popover needs its own solid
             surface and rim for Core — without them the list read as floating
             text over the fields behind it. */
          className="kx-glass-pop absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl
                     border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1
                     shadow-[0_20px_48px_-20px_rgba(0,0,0,0.6)]"
        >
          {rows.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--text-secondary)]">No customers found.</li>
          ) : (
            rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => void pick(r)}
                  className="w-full rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-[var(--bg-surface-hover)]"
                >
                  <span className="block truncate">{labelFor(r)}</span>
                  {r.company_name && labelFor(r) !== r.company_name && (
                    <span className="block truncate text-xs text-[var(--text-secondary)]">
                      {r.company_name}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
