"use client";

/* ---------------------------------------------------------------------------
   QuickAdd — capture a task in one line. "Call Ali tomorrow !high #Sales" →
   title, due day, priority and label, shown as chips before Enter so nothing
   is guessed silently; each chip's × keeps those words in the title instead.
   The full form is still one click away for assignment, repeats and files.
   --------------------------------------------------------------------------- */

import { useMemo, useState, type Ref } from "react";
import type { TodoPriority } from "@/types/supabase";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import { parseQuickAdd } from "./quick-add-parse";
import { fmtDue } from "./todo-dates";
import { PRIORITY_TEXT, type TFn } from "./todo-ui";

export interface QuickAddValue {
  title: string;
  due: string | null;
  priority: TodoPriority;
  label: string | null;
}

type Part = "due" | "priority" | "label";

export default function QuickAdd({ t, lang, labels, inputRef, onCreate }: {
  t: TFn;
  lang: string;
  labels: string[];
  inputRef: Ref<HTMLInputElement>;
  onCreate: (v: QuickAddValue) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [ignored, setIgnored] = useState<ReadonlySet<Part>>(() => new Set());

  /* What will be saved: an ignored part keeps its words in the title. */
  const value = useMemo<QuickAddValue>(() => {
    const p = parseQuickAdd(text, ignored.has("label") ? [] : labels, {
      dates: !ignored.has("due"),
      priority: !ignored.has("priority"),
    });
    return { title: p.title, due: p.due, priority: p.priority ?? "medium", label: p.label };
  }, [text, ignored, labels]);

  const submit = async () => {
    if (!value.title) return;
    const snapshot = text;
    setText("");
    setIgnored(new Set());
    const ok = await onCreate(value);
    if (!ok) setText(snapshot);
  };

  const ignore = (p: Part) => setIgnored((prev) => new Set([...prev, p]));
  const chip = "inline-flex items-center gap-1 h-6 ps-2 pe-1 rounded-md text-[11px] font-semibold border";

  return (
    <div className="kx-glass rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] focus-within:border-[var(--border-focus)] transition-colors">
      <form className="flex items-center gap-2 px-3 md:px-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <PlusIcon size={16} className="text-[var(--text-dim)] shrink-0" />
        <input ref={inputRef} value={text} onChange={(e) => { setText(e.target.value); if (!e.target.value) setIgnored(new Set()); }}
          onKeyDown={(e) => { if (e.key === "Escape") { setText(""); setIgnored(new Set()); (e.target as HTMLInputElement).blur(); } }}
          placeholder={t("quick.placeholder")} aria-label={t("quick.label")}
          enterKeyHint="done" autoComplete="off"
          className="flex-1 min-w-0 h-11 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none" />
        {text.trim() && (
          <button type="submit" disabled={!value.title}
            className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold shrink-0 disabled:opacity-40">
            {t("common.add")}
          </button>
        )}
      </form>
      {(value.due || value.priority !== "medium" || value.label) && text.trim() && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 md:px-4 pb-2.5 -mt-0.5" aria-live="polite">
          <span className="text-[10.5px] text-[var(--text-dim)]">{t("quick.understood")}</span>
          {value.due && (
            <span className={`${chip} border-[#567FB2]/30 bg-[#567FB2]/10 text-[#7FA9D6]`}>
              <ClockIcon size={10} /> {fmtDue(value.due, t, lang)}
              <button type="button" onClick={() => ignore("due")} aria-label={t("quick.keepText")} className="h-4 w-4 inline-flex items-center justify-center rounded hover:bg-white/10"><CrossIcon size={9} /></button>
            </span>
          )}
          {value.priority !== "medium" && (
            <span className={`${chip} border-[var(--border-subtle)] bg-[var(--bg-surface)] ${PRIORITY_TEXT[value.priority]}`}>
              <FlagIcon size={10} /> {t("p." + value.priority)}
              <button type="button" onClick={() => ignore("priority")} aria-label={t("quick.keepText")} className="h-4 w-4 inline-flex items-center justify-center rounded hover:bg-white/10"><CrossIcon size={9} /></button>
            </span>
          )}
          {value.label && (
            <span className={`${chip} border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]`}>
              <TagsIcon size={10} /> {value.label}
              <button type="button" onClick={() => ignore("label")} aria-label={t("quick.keepText")} className="h-4 w-4 inline-flex items-center justify-center rounded hover:bg-white/10"><CrossIcon size={9} /></button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
