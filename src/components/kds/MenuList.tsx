"use client";

/* KDS MenuList — the ONE dropdown panel for the whole Hub.

   ELECTED MN-4 by owner 2026-08-02 (combobox listbox: rounded-lg, plain
   bg-secondary, full-bleed rows).
   RE-ELECTED MN-5 by owner 2026-08-12, from the Sales Rep picker in the
   customer form: the glass pop surface, softer rounding, and an optional
   search row and avatar rows. Owner: "any dropdown in Koleex Hub can be this
   style… whatever its shape, use this design."

   WHAT CHANGED MN-4 → MN-5
     rounded-lg          → rounded-xl
     plain bg-secondary  → .kx-glass-pop over bg-secondary
     rows px-3 py-2      → px-2.5 py-2, flex, gap-2.5 (so an avatar or an icon
                           can sit in the row without a second row style)
     (new)               → MenuSearch — the bordered filter row on top
     (new)               → MenuItemAvatar — 30px avatar + truncating label

   ANATOMY — every part is optional except the panel:

     ┌─────────────────────────────┐
     │ 🔍 Search team…             │  ← <MenuSearch>   (omit when < ~8 rows)
     ├─────────────────────────────┤
     │ (avatar) Mr. Kamal Esmat    │  ← <MenuItemAvatar>
     │ (avatar) Mrs. Zoe You       │
     │ Plain option                │  ← <MenuItem>
     └─────────────────────────────┘

   POSITIONING STAYS WITH THE CALLER. Panels legitimately differ — w-full
   under a field, w-56 under an icon button, bottom-full when there is no room
   below — so MenuList owns the LOOK and the caller passes placement through
   `className`. That is what lets one component serve every shape.

   STACKING: the panel carries .kx-glass-pop, and globals.css lifts any glass
   ancestor that contains one (`.kx-glass:has(.kx-glass-pop)`). Without that a
   panel is trapped inside its card — backdrop-filter creates a stacking
   context, so no z-index on the panel can ever escape it. MEASURED: the Sales
   Rep panel was covered by the NEXT form card until that rule landed. */

export function MenuSearch({
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="p-2 border-b border-[var(--border-subtle)]">
      <div className="relative">
        <span className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--text-ghost)] pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden>
            <path d="M23.707,22.293l-5.969-5.969a10.016,10.016,0,1,0-1.414,1.414l5.969,5.969a1,1,0,0,0,1.414-1.414ZM10,18a8,8,0,1,1,8-8A8.009,8.009,0,0,1,10,18Z" />
          </svg>
        </span>
        <input
          {...rest}
          className={`w-full h-9 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-[var(--border-focus)] outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] ps-8 pe-3 ${className}`}
        />
      </div>
    </div>
  );
}

/* The scrolling body. Split from the panel so a search row can stay pinned
   while the options scroll under it. */
export function MenuBody({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`max-h-64 overflow-y-auto py-1 ${className}`}>{children}</div>;
}

export function MenuItem({
  active,
  destructive,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; destructive?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-start text-[13px] transition-colors ${
        destructive
          ? "text-red-400 hover:bg-red-500/10"
          : active
            ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* A row that leads with a 30px round image (people) or any node (an icon, a
   flag, a colour chip). `label` truncates — a long company name must never
   widen the panel. */
export function MenuItemAvatar({
  avatar,
  label,
  sub,
  active,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  avatar: React.ReactNode;
  label: React.ReactNode;
  sub?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <MenuItem active={active} className={className} {...rest}>
      <span className="shrink-0 flex items-center">{avatar}</span>
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm text-[var(--text-primary)]">{label}</span>
        {sub ? <span className="block truncate text-[11px] text-[var(--text-dim)]">{sub}</span> : null}
      </span>
    </MenuItem>
  );
}

export default function MenuList({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      /* kx-glass-pop = the glass material · kx-pop-panel = the MN-5 shell
         (radius, border, surface, shadow). Both live in globals.css so this
         component and the 14 hand-rolled panels cannot drift apart. */
      className={`kx-glass-pop kx-pop-panel ${className}`}
    >
      {children}
    </div>
  );
}
