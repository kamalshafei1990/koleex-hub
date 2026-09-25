"use client";

/* ---------------------------------------------------------------------------
   EntityPicker — searchable combobox for linking a planning item to a
   real Hub record (Customer, Supplier, Contact, Product, Project).

   On select it hands back the id, the display label AND the record's real
   kind, so the modal can persist linked_entity_id (for queryability),
   linked_entity_label (for fast rendering without a join) and — for a
   generic contact search — the contact's actual customer/supplier type,
   which is what the Contacts detail page asks the strip for.

   A failed search reads as an error, not as "No matches".
   --------------------------------------------------------------------------- */

import { useEffect, useId, useRef, useState } from "react";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import { searchEntities, type EntitySearchResult, type PickerEntityType } from "@/lib/planning";
import { useTranslation } from "@/lib/i18n";
import { planningT } from "@/lib/translations/planning";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

export default function EntityPicker({
  entityType,
  entityId,
  entityLabel,
  onChange,
  placeholder,
}: {
  entityType: PickerEntityType;
  entityId: string | null;
  entityLabel: string | null;
  onChange: (id: string | null, label: string | null, kind?: string) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation(planningT);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EntitySearchResult[]>([]);
  const [failed, setFailed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Results belong to the type they answered; a type switch just stops
     showing them (the modal remounts the picker per type anyway). */
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      searchEntities(entityType, query)
        .then((r) => { setResults(r); setFailed(false); })
        .catch(() => { setResults([]); setFailed(true); })
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, entityType, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const clear = () => {
    onChange(null, null);
    setQuery("");
    setResults([]);
  };

  return (
    <div ref={wrapRef} className="relative">
      {entityId && entityLabel ? (
        <div className="h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--text-primary)] flex-1 truncate">
            {entityLabel}
          </span>
          <button
            type="button"
            onClick={clear}
            className="h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
            aria-label={t("picker.clear")}
          >
            <CrossIcon size={12} />
          </button>
        </div>
      ) : (
        <div className="h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-2 focus-within:border-[var(--border-focus)] transition-colors">
          <SearchIcon size={14} className="text-[var(--text-dim)] shrink-0" />
          <input
            role="combobox"
            aria-expanded={open && !entityId}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={placeholder ?? t("picker.searchPh")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder ?? t("picker.searchPh")}
            className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
          />
          {loading && (
            <SpinnerIcon className="h-3.5 w-3.5 text-[var(--text-dim)] shrink-0" />
          )}
        </div>
      )}

      {open && !entityId && (
        <div id={listId} role="listbox" className="absolute z-20 start-0 end-0 mt-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl max-h-64 overflow-y-auto">
          {failed && !loading && (
            <div role="alert" className="px-3 py-2 text-[12px] text-red-600 dark:text-red-400">
              {t("err.generic")}
            </div>
          )}
          {!failed && results.length === 0 && !loading && (
            <div className="px-3 py-2 text-[12px] text-[var(--text-dim)]">
              {query.trim() ? t("picker.noMatches") : t("picker.typeToSearch")}
            </div>
          )}
          {results.map((r) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              key={r.id}
              onClick={() => {
                onChange(r.id, r.label, r.kind);
                setOpen(false);
              }}
              className="w-full text-start px-3 py-2 hover:bg-[var(--bg-surface-subtle)] border-b last:border-b-0 border-[var(--border-subtle)]"
            >
              <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                {r.label}
              </div>
              {r.subtitle && (
                <div className="text-[10px] text-[var(--text-dim)] truncate">
                  {r.subtitle}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
