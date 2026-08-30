"use client";

/* ---------------------------------------------------------------------------
   components/ai/ProjectDialog — create / edit a chat project.

   Phase 2J, sliced verbatim from KoleexAiApp.tsx. A leaf: it takes props and
   nothing else — no parent state closure, no context beyond its own hooks —
   which is what made it safe to move a 3 958-line component's first
   sub-component out while the client still has no test harness.
   --------------------------------------------------------------------------- */

import { useEffect } from "react";
import ProjectGlyph, { useProjectColorHex } from "@/components/ai/ProjectGlyph";
import {
  PROJECT_COLOR_KEYS,
  PROJECT_ICONS,
  PROJECT_NAME_MAX,
  type ProjectColor,
  type ProjectIcon,
} from "@/lib/ai-projects";
import { COPY } from "@/components/ai/copy";

/* ── Project create / edit dialog ──
   One dialog for both jobs: a null id means create. Name, icon and colour
   are all decided in the same place so a folder is never half-configured. */
export default function ProjectDialog({
  draft,
  copy,
  saving,
  onChange,
  onSave,
  onClose,
}: {
  draft: { id: string | null; name: string; icon: ProjectIcon; color: ProjectColor };
  copy: typeof COPY["en"];
  saving: boolean;
  onChange: (next: { id: string | null; name: string; icon: ProjectIcon; color: ProjectColor }) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const colorHex = useProjectColorHex();
  const canSave = draft.name.trim().length > 0 && !saving;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* House rule: a modal backdrop dims AND blurs — never dim alone. */}
      <button
        type="button"
        aria-label={copy.cancel}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="kx-glass-pop relative w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <ProjectGlyph icon={draft.icon} color={draft.color} size={16} />
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
            {draft.id ? copy.editProject : copy.newProject}
          </h2>
        </div>

        <label className="block text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)] mb-1">
          {copy.projectName}
        </label>
        <input
          autoFocus
          value={draft.name}
          maxLength={PROJECT_NAME_MAX}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter" && canSave) onSave(); }}
          className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          placeholder={copy.newProject}
        />

        <div className="mt-3 text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)] mb-1.5">
          {copy.projectIcon}
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {PROJECT_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => onChange({ ...draft, icon: ic })}
              aria-pressed={draft.icon === ic}
              aria-label={ic}
              className={`h-9 rounded-lg border flex items-center justify-center ${
                draft.icon === ic
                  ? "border-[var(--text-primary)] bg-[var(--bg-surface-active)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-dim)]"
              }`}
            >
              <ProjectGlyph icon={ic} color={draft.color} size={16} />
            </button>
          ))}
        </div>

        <div className="mt-3 text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)] mb-1.5">
          {copy.projectColor}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PROJECT_COLOR_KEYS.map((ck) => (
            <button
              key={ck}
              type="button"
              onClick={() => onChange({ ...draft, color: ck })}
              aria-pressed={draft.color === ck}
              aria-label={ck}
              className={`h-7 w-7 rounded-full flex items-center justify-center border-2 ${
                draft.color === ck ? "border-[var(--text-primary)]" : "border-transparent"
              }`}
            >
              <span
                className="h-5 w-5 rounded-full block"
                style={{ backgroundColor: colorHex(ck) }}
              />
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] disabled:opacity-40"
          >
            {copy.save}
          </button>
        </div>
      </div>
    </div>
  );
}
