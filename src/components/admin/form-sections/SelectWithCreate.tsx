"use client";

import { useState, useRef, useEffect } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";

export interface SelectOption {
  value: string;
  label: string;
  icon?: string | null; // URL to logo/image
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  onClickCreate?: () => void;
  placeholder?: string;
  disabled?: boolean;
  createLabel?: string;
  className?: string;
}

export default function SelectWithCreate({
  value,
  options,
  onChange,
  onClickCreate,
  placeholder = "Select...",
  disabled = false,
  createLabel = "Create New",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  /* Selected option — case-insensitive match so a preset default
     like "Koleex" still binds to a DB option row saved as "koleex"
     or " Koleex ". If nothing matches but `value` is non-empty (e.g.
     on initial page load before the options fetch resolves, or for
     a legacy value that no longer exists in the options list), fall
     back to a synthetic entry so the trigger button still shows the
     current value instead of the placeholder. */
  const selected =
    options.find(o => o.value.trim().toLowerCase() === value.trim().toLowerCase()) ||
    (value ? { value, label: value, icon: null } : undefined);
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const hasIcons = options.some(o => o.icon);

  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all appearance-none";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(!open); }}
        disabled={disabled}
        className={`${inp} flex items-center justify-between gap-2 cursor-pointer text-left ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span className={`flex items-center gap-2.5 min-w-0 ${selected ? "text-[var(--text-primary)]" : "text-[var(--text-ghost)]"}`}>
          {selected?.icon && (
            <img src={selected.icon} alt="" className="h-5 w-5 rounded-md object-cover shrink-0" />
          )}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <AngleDownIcon className={`h-3.5 w-3.5 text-[var(--text-ghost)] shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl shadow-2xl shadow-black/30 overflow-hidden">
          {/* Search */}
          {options.length > 5 && (
            <div className="p-2 border-b border-[var(--border-subtle)]">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-ghost)]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div className="max-h-[260px] overflow-y-auto py-1">
            {/* Empty option */}
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
              className="w-full px-4 py-2.5 text-left text-[12px] text-[var(--text-ghost)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
            >
              {placeholder}
            </button>

            {filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                className={`w-full px-4 py-2.5 text-left text-[13px] flex items-center gap-2.5 hover:bg-[var(--bg-surface-subtle)] transition-colors ${
                  o.value === value ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)]"
                }`}
              >
                {hasIcons && (
                  o.icon ? (
                    <img src={o.icon} alt="" className="h-6 w-6 rounded-md object-cover shrink-0 border border-[var(--border-subtle)]" />
                  ) : (
                    <div className="h-6 w-6 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] shrink-0 flex items-center justify-center text-[10px] font-bold text-[var(--text-ghost)]">
                      {o.label.charAt(0).toUpperCase()}
                    </div>
                  )
                )}
                <span className="truncate flex-1">{o.label}</span>
                {o.value === value && <CheckIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
              </button>
            ))}

            {filtered.length === 0 && search && (
              <p className="px-4 py-3 text-[12px] text-[var(--text-ghost)] text-center">No results found</p>
            )}
          </div>

          {/* Create New — opens modal */}
          {onClickCreate && (
            <div className="border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => { setOpen(false); setSearch(""); onClickCreate(); }}
                className="w-full px-4 py-3 text-left text-[12px] font-medium text-blue-400 hover:bg-blue-500/10 flex items-center gap-2 transition-colors"
              >
                <PlusIcon className="h-3.5 w-3.5" /> {createLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
