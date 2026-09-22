"use client";

/* ProductRail — the pinned left column on desktop, the chip bar on phones.
 *
 * It carries two things the owner asked for in two different sentences:
 * the machine stays in sight while the record scrolls (the photo and the
 * model chips), and the reader can always see where they are and jump
 * (the section index with the active section marked). Every section that
 * exists on this product is in the index; none that does not.
 *
 * The active state is the one functional use of blue on the page.
 */
import { IMG } from "@/lib/cdn";

export interface RailSection { id: string; label: string }

export default function ProductRail({ image, name, models, selectedCode, onSelectModel, sections, activeId }: {
  image: string | null;
  name: string;
  models: Array<{ code: string }>;
  selectedCode: string | null;
  onSelectModel: (code: string) => void;
  sections: RailSection[];
  activeId: string | null;
}) {
  /* One section is not navigation — a lone "Compliance" hung under the
     model chips on thin drafts (owner's UI review, 22 Sep 2026). */
  const nav = sections.length < 2 ? null : (
    <nav aria-label="Sections">
      <ul className="flex lg:flex-col gap-1 lg:gap-0">
        {sections.map((s) => {
          const active = s.id === activeId;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                aria-current={active ? "location" : undefined}
                className={`block whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] transition-colors lg:rounded-none lg:border-s-2 lg:px-4 lg:py-2 ${
                  active
                    ? "bg-[var(--bg-surface-subtle)] font-medium text-[var(--text-primary)] lg:border-[#0066FF] lg:bg-transparent"
                    : "text-[var(--text-dim)] hover:text-[var(--text-primary)] lg:border-transparent"
                }`}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <>
      {/* Phones and tablets: a sticky chip bar under the app header. */}
      <div className="lg:hidden sticky top-2 z-30 -mx-4 overflow-x-auto px-4 py-2 bg-[var(--bg-primary)]/90 backdrop-blur-sm [scrollbar-width:none]">
        {nav}
      </div>

      {/* Desktop: the rail. */}
      <aside className="hidden lg:flex lg:sticky lg:top-24 flex-col gap-6 self-start">
        {image ? (
          <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.row(image)} alt={name} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-contain p-3" />
          </div>
        ) : null}
        {models.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {models.map((m) => {
              const on = m.code === selectedCode;
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => onSelectModel(m.code)}
                  className={`rounded-lg border px-2.5 py-1 text-[12px] font-semibold tabular-nums tracking-tight transition-colors ${
                    on ? "border-[var(--text-primary)] bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-focus)]"
                  }`}
                >
                  {m.code}
                </button>
              );
            })}
          </div>
        ) : null}
        {nav}
      </aside>
    </>
  );
}
