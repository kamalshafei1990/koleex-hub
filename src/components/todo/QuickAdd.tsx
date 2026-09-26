"use client";

/* ---------------------------------------------------------------------------
   QuickAdd — capture a task in one line, and still say everything.

   "Call Ali tomorrow 3pm !high #Sales @Sara" → title, due day + time,
   priority, label and assignee, shown as chips before Enter so nothing is
   guessed silently; each chip's × keeps those words in the title instead.

   Owner: "quick add is a very good idea but too many things are missing: I
   can't assign it to someone, set priority, time… and I can't write any
   details." So, without giving up the one fast line:
     · @ opens the colleague list (↑ ↓ Enter, Esc) and drops a chip;
       "@sara" typed out in full is understood too
     · a slim toolbar — Assign · Due (+ time) · Priority · Label — each a
       tiny picker; what is picked shows as the same removable chips
     · Shift+Enter or "Add details" opens a description box under the line
     · "Open full form" hands everything typed and picked to the task form
   Enter still creates at once. The pickers and the @ list are their own
   chunk (QuickAddPanels), fetched the first time one opens.
   --------------------------------------------------------------------------- */

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import FloatLayer from "./FloatLayer";
import dynamic from "next/dynamic";
import type { TodoAssigneeInfo, TodoPriority } from "@/types/supabase";
import AlignLeftIcon from "@/components/icons/ui/AlignLeftIcon";
import AtSignIcon from "@/components/icons/ui/AtSignIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import Maximize2Icon from "@/components/icons/ui/Maximize2Icon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import MiniAvatar from "./MiniAvatar";
import { dueValue, parseQuickAdd } from "./quick-add-parse";
import { fmtDue, todayIso } from "./todo-dates";
import { PRIORITY_TEXT, nameOf, type TFn } from "./todo-ui";
import type { QuickPanelKind } from "./QuickAddPanels";
import LabelIcon from "./LabelIcon";

const QuickPanel = dynamic(() => import("./QuickAddPanels"), { ssr: false });
const MentionList = dynamic(() => import("./QuickAddPanels").then((m) => m.MentionList), { ssr: false });

export interface QuickAddValue {
  title: string;
  description: string | null;
  /** The stored due: "YYYY-MM-DD", or an ISO instant when a time was set. */
  due: string | null;
  priority: TodoPriority;
  label: string | null;
  assigneeIds: string[];
}
/** Everything typed and picked, for the full task form. */
export interface QuickDraft {
  title: string;
  description: string;
  day: string | null;
  time: string | null;
  priority: TodoPriority;
  label: string | null;
  assigneeIds: string[];
}

type Part = "due" | "priority" | "label" | "people";
interface Picked { people: string[]; day: string | null; time: string | null; priority: TodoPriority | null; label: string | null }
const NO_PICK: Picked = { people: [], day: null, time: null, priority: null, label: null };
const MENTION_MAX = 6;

/** "@sa|" before the caret → the query and where it starts. */
function mentionAt(text: string, caret: number): { q: string; start: number; end: number } | null {
  const m = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  return m ? { q: m[2], start: caret - m[2].length - 1, end: caret } : null;
}

export default function QuickAdd({ t, lang, labels, employees, inputRef, onCreate, onOpenForm }: {
  t: TFn;
  lang: string;
  labels: string[];
  employees: TodoAssigneeInfo[];
  inputRef: Ref<HTMLInputElement>;
  onCreate: (v: QuickAddValue) => Promise<boolean>;
  onOpenForm: (d: QuickDraft) => void;
}) {
  const [text, setText] = useState("");
  const [ignored, setIgnored] = useState<ReadonlySet<Part>>(() => new Set());
  const [picked, setPicked] = useState<Picked>(NO_PICK);
  const [details, setDetails] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [panel, setPanel] = useState<QuickPanelKind | null>(null);
  const [mention, setMention] = useState<{ q: string; start: number; end: number } | null>(null);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const ownInput = useRef<HTMLInputElement | null>(null);
  const detailsRef = useRef<HTMLTextAreaElement>(null);

  /* The page focuses the line (the N key) through its own ref. */
  useImperativeHandle(inputRef, () => ownInput.current as HTMLInputElement, []);

  /* What will be saved: picked values win; an ignored part keeps its words. */
  const parsed = useMemo(() => parseQuickAdd(text, ignored.has("label") ? [] : labels, {
    dates: !ignored.has("due"),
    priority: !ignored.has("priority"),
    people: ignored.has("people") ? [] : employees,
  }), [text, ignored, labels, employees]);
  const people = useMemo(() => {
    const ids = [...picked.people, ...parsed.people.filter((id) => !picked.people.includes(id))];
    return ids.map((id) => employees.find((e) => e.account_id === id)).filter((e): e is TodoAssigneeInfo => !!e);
  }, [picked.people, parsed.people, employees]);
  const time = picked.time ?? parsed.time;
  const day = picked.day ?? parsed.due ?? (time ? todayIso() : null);
  const priority = picked.priority ?? parsed.priority ?? "medium";
  const label = picked.label ?? parsed.label;

  const candidates = useMemo(() => {
    if (!mention) return [];
    const q = mention.q.toLowerCase();
    const taken = new Set(people.map((p) => p.account_id));
    return employees.filter((e) => !taken.has(e.account_id) && (!q ||
      nameOf(e).toLowerCase().includes(q) || e.username.toLowerCase().includes(q) ||
      (e.name_alt ?? "").toLowerCase().includes(q) || (e.department ?? "").toLowerCase().includes(q))).slice(0, MENTION_MAX);
  }, [mention, employees, people]);
  const listOpen = !!mention && candidates.length > 0;

  /* A picker closes on a click anywhere outside the quick-add card. */
  useEffect(() => {
    if (!panel && !mention) return;
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (rootRef.current?.contains(n) || floatRef.current?.contains(n)) return;
      setPanel(null); setMention(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [panel, mention]);

  const reset = () => {
    setText(""); setIgnored(new Set()); setPicked(NO_PICK); setDetails(""); setShowDetails(false);
    setPanel(null); setMention(null);
  };

  const submit = async () => {
    if (!parsed.title) return;
    const value: QuickAddValue = {
      title: parsed.title, description: details.trim() || null, due: dueValue(day, time),
      priority, label, assigneeIds: people.map((p) => p.account_id),
    };
    const snapshot = { text, ignored, picked, details, showDetails };
    reset();
    const ok = await onCreate(value);
    if (!ok) {
      setText(snapshot.text); setIgnored(snapshot.ignored); setPicked(snapshot.picked);
      setDetails(snapshot.details); setShowDetails(snapshot.showDetails);
    }
  };

  const openForm = () => {
    onOpenForm({
      title: parsed.title, description: details.trim(), day, time, priority, label,
      assigneeIds: people.map((p) => p.account_id),
    });
    reset();
  };

  const trackMention = (value: string, caret: number | null) => {
    const m = caret === null ? null : mentionAt(value, caret);
    setMention(m);
    if (m) { setActive(0); setPanel(null); }
  };

  const pickPerson = (emp: TodoAssigneeInfo) => {
    if (mention) {
      const next = (text.slice(0, mention.start) + text.slice(mention.end)).replace(/\s{2,}/g, " ");
      setText(next);
      const caret = mention.start;
      requestAnimationFrame(() => { ownInput.current?.focus(); ownInput.current?.setSelectionRange(caret, caret); });
    }
    setPicked((p) => (p.people.includes(emp.account_id) ? p : { ...p, people: [...p.people, emp.account_id] }));
    setMention(null);
  };
  const togglePerson = (id: string) => setPicked((p) => ({
    ...p, people: p.people.includes(id) ? p.people.filter((x) => x !== id) : [...p.people, id],
  }));
  const removePerson = (id: string) => {
    if (picked.people.includes(id)) togglePerson(id);
    else setIgnored((prev) => new Set([...prev, "people"]));
  };
  const clearPart = (part: Exclude<Part, "people">) => {
    const fromPick = part === "due" ? !!picked.day || !!picked.time : !!picked[part];
    if (fromPick) setPicked((p) => (part === "due" ? { ...p, day: null, time: null } : { ...p, [part]: null }));
    else setIgnored((prev) => new Set([...prev, part]));
  };

  const openDetails = () => {
    setShowDetails(true);
    requestAnimationFrame(() => detailsRef.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (listOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % candidates.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + candidates.length) % candidates.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickPerson(candidates[Math.min(active, candidates.length - 1)]); return; }
      if (e.key === "Escape") { e.preventDefault(); setMention(null); return; }
    }
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); openDetails(); return; }
    if (e.key === "Escape") {
      if (panel) { setPanel(null); return; }
      reset(); (e.target as HTMLInputElement).blur();
    }
  };

  const engaged = focused || !!text || showDetails || !!panel || people.length > 0 || !!picked.day || !!picked.priority || !!picked.label;
  const hasChips = people.length > 0 || !!day || priority !== "medium" || !!label;
  const chip = "inline-flex items-center gap-1 h-6 ps-2 pe-1 rounded-md text-[11px] font-semibold border max-w-full min-w-0";
  const x = (onClick: () => void) => (
    <button type="button" onClick={onClick} aria-label={t("quick.keepText")} className="h-4 w-4 shrink-0 inline-flex items-center justify-center rounded hover:bg-white/10"><CrossIcon size={9} /></button>
  );
  const tool = (on: boolean) => `h-7 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-colors border ${
    on ? "bg-[#567FB2]/15 border-[#567FB2]/30 text-[#7FA9D6]" : "border-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"}`;
  const toggle = (k: QuickPanelKind) => { setMention(null); setPanel((p) => (p === k ? null : k)); };

  return (
    <div ref={rootRef}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
      className={`kx-glass relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] focus-within:border-[var(--border-focus)] transition-colors`}>
      <form ref={formRef} className="flex items-center gap-2 px-3 md:px-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <PlusIcon size={16} className="text-[var(--text-dim)] shrink-0" />
        <input ref={ownInput} value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (!e.target.value) setIgnored(new Set());
            trackMention(e.target.value, e.target.selectionStart);
          }}
          onSelect={(e) => { const el = e.currentTarget; if (mention || el.value.includes("@")) trackMention(el.value, el.selectionStart); }}
          onKeyDown={onKeyDown}
          placeholder={t("quick.placeholder")} aria-label={t("quick.label")}
          role="combobox" aria-expanded={listOpen} aria-controls="todo-quick-mentions" aria-autocomplete="list"
          aria-activedescendant={listOpen ? `todo-quick-m-${candidates[Math.min(active, candidates.length - 1)]?.account_id}` : undefined}
          enterKeyHint="done" autoComplete="off"
          className="flex-1 min-w-0 h-11 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none" />
        {text.trim() && (
          <button type="submit" disabled={!parsed.title}
            className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold shrink-0 disabled:opacity-40">
            {t("common.add")}
          </button>
        )}
      </form>

      {listOpen && (
        <FloatLayer anchor={formRef} inset={40} layerRef={floatRef} width={320}>
          <MentionList people={candidates} active={Math.min(active, candidates.length - 1)} onPick={pickPerson} onHover={setActive} t={t} />
        </FloatLayer>
      )}

      {/* What will be saved — typed or picked, each removable. */}
      {hasChips && (text.trim() || picked !== NO_PICK) && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 md:px-4 pb-2 -mt-0.5" aria-live="polite">
          <span className="text-[10.5px] text-[var(--text-dim)]">{t("quick.understood")}</span>
          {people.map((p) => (
            <span key={p.account_id} className={`${chip} ps-0.5 border-[#567FB2]/30 bg-[#567FB2]/10 text-[#BCD8F0]`}>
              <MiniAvatar info={p} size={18} /> <span className="truncate">{nameOf(p)}</span>
              {x(() => removePerson(p.account_id))}
            </span>
          ))}
          {day && (
            <span className={`${chip} border-[#567FB2]/30 bg-[#567FB2]/10 text-[#7FA9D6]`}>
              <ClockIcon size={10} /> {fmtDue(day, t, lang)}{time && ` · ${time}`}
              {x(() => clearPart("due"))}
            </span>
          )}
          {priority !== "medium" && (
            <span className={`${chip} border-[var(--border-subtle)] bg-[var(--bg-surface)] ${PRIORITY_TEXT[priority]}`}>
              <FlagIcon size={10} /> {t("p." + priority)}
              {x(() => clearPart("priority"))}
            </span>
          )}
          {label && (
            <span className={`${chip} border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]`}>
              <LabelIcon name={label} size={10} className="text-current" /> <span className="truncate">{label}</span>
              {x(() => clearPart("label"))}
            </span>
          )}
        </div>
      )}

      {showDetails && (
        <div className="px-3 md:px-4 pb-2">
          <textarea ref={detailsRef} value={details} onChange={(e) => setDetails(e.target.value)} rows={3}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); }
              if (e.key === "Escape") { e.preventDefault(); ownInput.current?.focus(); }
            }}
            placeholder={t("quick.detailsPlaceholder")} aria-label={t("f.description")}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] resize-y min-h-[72px]" />
        </div>
      )}

      {/* The toolbar — only once the line is in use, so the page stays calm. */}
      {engaged && (
        <div ref={barRef} className="relative flex items-center gap-0.5 px-2 md:px-3 pb-2 flex-wrap">
          <button type="button" onClick={() => toggle("assign")} aria-expanded={panel === "assign"} className={tool(people.length > 0)}>
            <AtSignIcon size={12} /> {t("quick.assign")}{people.length > 0 && ` · ${people.length}`}
          </button>
          <button type="button" onClick={() => toggle("due")} aria-expanded={panel === "due"} className={tool(!!day)}>
            <ClockIcon size={12} /> {t("quick.due")}
          </button>
          <button type="button" onClick={() => toggle("priority")} aria-expanded={panel === "priority"} className={tool(priority !== "medium")}>
            <FlagIcon size={12} /> {t("f.priority")}
          </button>
          <button type="button" onClick={() => toggle("label")} aria-expanded={panel === "label"} className={tool(!!label)}>
            <TagsIcon size={12} /> {t("f.label")}
          </button>
          <span className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
          <button type="button" onClick={() => (showDetails ? setShowDetails(false) : openDetails())} aria-expanded={showDetails} className={tool(!!details.trim())}>
            <AlignLeftIcon size={12} /> {showDetails ? t("quick.hideDetails") : t("quick.details")}
          </button>
          <span className="hidden lg:inline ms-auto me-2 text-[10.5px] text-[var(--text-ghost)]">{t("quick.hint")}</span>
          <button type="button" onClick={openForm} className={`${tool(false)} ms-auto lg:ms-0`}>
            <Maximize2Icon size={12} /> {t("quick.fullForm")}
          </button>

          {panel && (
            <FloatLayer anchor={barRef} inset={8} layerRef={floatRef} width={340}>
              <QuickPanel kind={panel} t={t} lang={lang} employees={employees} labels={labels}
                people={people.map((p) => p.account_id)} onTogglePerson={togglePerson}
                day={day} time={time}
                onDue={(d, tm) => setPicked((p) => ({ ...p, day: d, time: tm }))}
                priority={priority} onPriority={(v) => { setPicked((p) => ({ ...p, priority: v })); setPanel(null); }}
                label={label} onLabel={(v) => { setPicked((p) => ({ ...p, label: v })); setIgnored((prev) => new Set([...prev, "label"])); setPanel(null); }}
                onClose={() => setPanel(null)} />
            </FloatLayer>
          )}
        </div>
      )}
    </div>
  );
}

