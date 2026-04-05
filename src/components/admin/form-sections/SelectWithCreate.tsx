"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Check, X, ChevronDown, Search } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onCreate?: (name: string) => Promise<string | null>; // returns value or null on failure
  placeholder?: string;
  disabled?: boolean;
  createLabel?: string; // e.g. "Create Division"
  className?: string;
}

export default function SelectWithCreate({
  value,
  options,
  onChange,
  onCreate,
  placeholder = "Select...",
  disabled = false,
  createLabel = "Create New",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Focus create input
  useEffect(() => {
    if (creating && createInputRef.current) createInputRef.current.focus();
  }, [creating]);

  const selected = options.find(o => o.value === value);
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleCreate = async () => {
    if (!newName.trim() || !onCreate) return;
    setSaving(true);
    const result = await onCreate(newName.trim());
    setSaving(false);
    if (result) {
      onChange(result);
      setCreating(false);
      setNewName("");
      setOpen(false);
      setSearch("");
    }
  };

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
        <span className={selected ? "text-[var(--text-primary)]" : "text-[var(--text-ghost)]"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-[var(--text-ghost)] shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl shadow-2xl shadow-black/30 overflow-hidden">
          {/* Search */}
          {options.length > 5 && (
            <div className="p-2 border-b border-[var(--border-subtle)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-ghost)]" />
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
          <div className="max-h-[220px] overflow-y-auto py-1">
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
                className={`w-full px-4 py-2.5 text-left text-[13px] flex items-center justify-between hover:bg-[var(--bg-surface-subtle)] transition-colors ${
                  o.value === value ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)]"
                }`}
              >
                <span>{o.label}</span>
                {o.value === value && <Check className="h-3.5 w-3.5 text-emerald-400" />}
              </button>
            ))}

            {filtered.length === 0 && search && (
              <p className="px-4 py-3 text-[12px] text-[var(--text-ghost)] text-center">No results found</p>
            )}
          </div>

          {/* Create New */}
          {onCreate && (
            <div className="border-t border-[var(--border-subtle)]">
              {creating ? (
                <div className="p-2.5 flex items-center gap-2">
                  <input
                    ref={createInputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
                      if (e.key === "Escape") { setCreating(false); setNewName(""); }
                    }}
                    placeholder={`New name...`}
                    className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-focus)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={saving || !newName.trim()}
                    className="h-9 w-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreating(false); setNewName(""); }}
                    className="h-9 w-9 rounded-lg bg-[var(--bg-surface)] text-[var(--text-ghost)] flex items-center justify-center hover:text-[var(--text-primary)] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="w-full px-4 py-2.5 text-left text-[12px] font-medium text-blue-400 hover:bg-blue-500/10 flex items-center gap-2 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> {createLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
