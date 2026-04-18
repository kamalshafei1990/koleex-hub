"use client";

/* ---------------------------------------------------------------------------
   EntityPicker — searchable combobox for linking a planning item to a
   real Hub record (Customer, Supplier, Contact, Product).

   On select it hands back BOTH the id and the display label so the modal
   can persist linked_entity_id (for queryability) AND linked_entity_label
   (for fast rendering without a join).
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { searchEntities, type EntitySearchResult } from "@/lib/planning";

type EntityType = "customer" | "supplier" | "contact" | "product";

export default function EntityPicker({
  entityType,
  entityId,
  entityLabel,
  onChange,
  placeholder,
}: {
  entityType: EntityType;
  entityId: string | null;
  entityLabel: string | null;
  onChange: (id: string | null, label: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EntitySearchResult[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset results when the entity type changes.
  useEffect(() => {
    setResults([]);
    setQuery("");
  }, [entityType]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      searchEntities(entityType, query)
        .then(setResults)
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
            aria-label="Clear selection"
          >
            <CrossIcon size={12} />
          </button>
        </div>
      ) : (
        <div className="h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-2 focus-within:border-[var(--border-focus)] transition-colors">
          <SearchIcon size={14} className="text-[var(--text-dim)] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder ?? "Search…"}
            className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
          />
          {loading && (
            <SpinnerIcon className="h-3.5 w-3.5 text-[var(--text-dim)] animate-spin shrink-0" />
          )}
        </div>
      )}

      {open && !entityId && (
        <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl max-h-64 overflow-y-auto">
          {results.length === 0 && !loading && (
            <div className="px-3 py-2 text-[12px] text-[var(--text-dim)]">
              {query.trim() ? "No matches" : "Start typing to search"}
            </div>
          )}
          {results.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => {
                onChange(r.id, r.label);
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
