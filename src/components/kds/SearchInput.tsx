"use client";
/* KDS SearchInput — THE search field: icon, tokens, Hub Blue focus ring. */
import SearchIcon from "@/components/icons/ui/SearchIcon";

export default function SearchInput({
  value, onChange, placeholder, className = "", autoFocus, onKeyDown,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  className?: string; autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className={`flex items-center gap-2.5 h-10 px-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inverted)]/[0.04] transition-shadow focus-within:border-[#567FB2]/60 focus-within:shadow-[0_0_0_4px_rgba(86,127,178,0.16)] ${className}`}>
      <SearchIcon size={15} className="shrink-0 text-[var(--text-ghost)]" />
      <input
        type="text" value={value} autoFocus={autoFocus} onKeyDown={onKeyDown}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] min-w-0"
      />
    </div>
  );
}
