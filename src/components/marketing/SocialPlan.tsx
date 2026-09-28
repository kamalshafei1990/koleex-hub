"use client";

/* ---------------------------------------------------------------------------
   SocialPlan — the Plan tab (owner, 29/09/2026): the week's plan Koleex AI
   drafted from the accounts' numbers, its progress task by task, and the
   weeks before with their tallies.

   · A task's title is drawn here from its kind, in the reader's language;
     Koleex AI's reasons and summary come in en / zh / ar. A person's hand
     task reads as it was written.
   · Waiting for approval: an approver approves it; anyone who may edit
     Social Marketing edits it (targets, tasks added or removed) or asks
     Koleex AI for a new draft. Approved: its hand tasks are ticked; an
     approver may still change it. Every change carries the plan's version:
     when someone changed it first, the screen shows the plan as it is now.
   · The last answer per week is kept for the session, so coming back paints
     at once instead of flashing a skeleton.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import Button from "@/components/kds/Button";
import Checkbox from "@/components/kds/Checkbox";
import EmptyState from "@/components/kds/EmptyState";
import ProgressBar from "@/components/kds/ProgressBar";
import Spinner from "@/components/kds/Spinner";
import StatusPill from "@/components/kds/StatusPill";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CommentIcon from "@/components/icons/ui/CommentIcon";
import MinusIcon from "@/components/icons/ui/MinusIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import { useTranslation, type Lang } from "@/lib/i18n";
import { PLAN_T } from "@/lib/marketing/plan-i18n";
import { dmyHm } from "@/lib/marketing/format";
import { SPACE_ROUTE, type MarketingSpace } from "@/lib/marketing/spaces";
import { POST_FORMATS, type PostFormat } from "@/lib/marketing/insights";
import { PLAN_LIMITS, addWeeks, type Localized, type PlanPlatform, type PlanTask, type TaskProgress } from "@/lib/marketing/week-plan";
import { planCacheKey, readLastWeek, readPlanCache, writeLastWeek, writePlanCache, type PlanResponse, type PlanView } from "@/lib/marketing/plan-cache";

type T = (key: string) => string;
type Busy = "draft" | "approve" | "save" | "redraft" | `tick:${string}` | null;

const PLATFORM_NAME: Record<PlanPlatform, string> = { facebook: "Facebook", instagram: "Instagram" };

const dmy = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
/** "29/09 – 05/10/2026" (the year on both sides when the week crosses it). */
export function weekLabel(weekStart: string): string {
  const end = addWeeks(weekStart, 1);
  const last = new Date(Date.parse(`${end}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return weekStart.slice(0, 4) === last.slice(0, 4) ? `${dmy(weekStart).slice(0, 5)} – ${dmy(last)}` : `${dmy(weekStart)} – ${dmy(last)}`;
}

const pick = (l: Localized | null | undefined, lang: Lang) => (l ? l[lang] || l.en : "");
/** "1,500–2,500" kept left to right inside Arabic (an isolate: never reversed). */
const rangeText = (low: number, high: number) => `\u2066${low.toLocaleString("en-US")}–${high.toLocaleString("en-US")}\u2069`;

export function taskTitle(task: PlanTask, t: T, lang: Lang): string {
  if (task.kind === "manual") return pick(task.title, lang);
  if (task.kind === "reply") return t("t.reply");
  const f = task.format ?? "any";
  return t(task.target === 1 ? `t.publish.${f}.1` : `t.publish.${f}`)
    .replace("{n}", String(task.target))
    .replace("{platform}", task.platform ? PLATFORM_NAME[task.platform] : "");
}

let localSeq = 0;
const localId = () => `n${Date.now().toString(36)}${(localSeq++ % 1296).toString(36)}`;
/** A person's words read as written, whatever the reader's language. */
const asWritten = (s: string): Localized => ({ en: s, zh: s, ar: s });

export default function SocialPlan({ space }: { space: MarketingSpace }) {
  const { t, lang } = useTranslation(PLAN_T);
  const router = useRouter();
  const [week, setWeek] = useState<string | null>(null);
  const [data, setData] = useState<PlanResponse | null>(() => {
    if (typeof window === "undefined") return null;
    const last = readLastWeek(space);
    return last ? readPlanCache(planCacheKey(space, last)) : null;
  });
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanTask[] | null>(null);
  const [askRedraft, setAskRedraft] = useState(false);
  const weekRef = useRef<string | null>(null);

  const load = useCallback(async (w: string | null) => {
    setError(false);
    try {
      const res = await fetch(`/api/marketing/plan?space=${space}${w ? `&week=${w}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as PlanResponse;
      writePlanCache(planCacheKey(space, body.week), body);
      if (!w) writeLastWeek(space, body.week);
      if (weekRef.current === w) setData(body);
    } catch {
      if (weekRef.current === w) setError(true);
    }
  }, [space]);

  useEffect(() => {
    weekRef.current = week;
    /* The week's kept answer at once; else the skeleton, never another week's plan. */
    const key = week ?? readLastWeek(space);
    const kept = key ? readPlanCache(planCacheKey(space, key)) : null;
    setData((d) => kept ?? (d && (week ? d.week === week : d.week === d.current) ? d : null));
    setEditing(null);
    setAskRedraft(false);
    setNotice(null);
    void load(week);
  }, [week, space, load]);

  /** The plan changed (a save, an approval, a tick): kept for the session too. */
  const show = useCallback((plan: PlanView | null) => {
    setData((d) => {
      if (!d) return d;
      const next = { ...d, plan };
      writePlanCache(planCacheKey(space, d.week), next);
      return next;
    });
  }, [space]);

  const post = useCallback(async (kind: Exclude<Busy, null | "load">, payload: Record<string, unknown>): Promise<boolean> => {
    setBusy(kind);
    setNotice(null);
    try {
      const res = await fetch("/api/marketing/plan", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space, ...payload }),
      });
      const body = (await res.json().catch(() => ({}))) as { plan?: PlanView | null; code?: string };
      if (res.ok && body.plan) { show(body.plan); return true; }
      if (res.status === 409 && body.code === "conflict") {
        if (body.plan !== undefined) show(body.plan);
        setEditing(null);
        setNotice(t("conflict"));
      } else {
        setNotice(body.code === "later" ? t("busy") : t("saveError"));
      }
      return false;
    } catch {
      setNotice(t("saveError"));
      return false;
    } finally {
      setBusy(null);
    }
  }, [space, show, t]);

  const plan = data?.plan ?? null;
  const shownWeek = data?.week ?? week;
  const isCurrent = !!data && data.week === data.current;
  const mayChange = !!plan && !!data && (plan.status === "draft" ? data.may.edit : plan.status === "active" && data.may.approve);

  const header = <MarketingHeader space={space} />;
  const frame = (body: ReactNode) => (
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      {header}
      <div className="mt-6 flex flex-col gap-4">{body}</div>
    </div>
  );

  if (!data) {
    return frame(error ? (
      <EmptyState title={t("loadError")} action={<Button type="button" variant="secondary" onClick={() => void load(week)}>{t("retry")}</Button>} />
    ) : (
      <div aria-busy="true" className="flex flex-col gap-4">
        <div className="h-10 w-[280px] max-w-full rounded-xl bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />
        <div className="h-[120px] rounded-2xl bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />
        {[0, 1, 2].map((i) => <div key={i} className="h-[76px] rounded-2xl bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />)}
      </div>
    ));
  }

  const weekBar = (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="iconSecondary" aria-label={t("prevWeek")} onClick={() => setWeek(addWeeks(shownWeek ?? data.current, -1))}>
        <AngleLeftIcon size={14} className="rtl:rotate-180" />
      </Button>
      <h2 className="min-w-[180px] text-center text-[15px] font-semibold text-[var(--text-primary)]">
        <span dir="ltr" className="tabular-nums">{weekLabel(shownWeek ?? data.current)}</span>
      </h2>
      <Button type="button" variant="iconSecondary" aria-label={t("nextWeek")} disabled={isCurrent} onClick={() => setWeek(addWeeks(shownWeek ?? data.current, 1))}>
        <AngleRightIcon size={14} className="rtl:rotate-180" />
      </Button>
      {!isCurrent && <Button type="button" variant="secondary" onClick={() => setWeek(null)}>{t("thisWeek")}</Button>}
      {plan && (
        <span className="ms-auto flex items-center gap-2">
          <StatusPill tone={plan.status === "draft" ? "warning" : plan.status === "active" ? "brand" : "neutral"}>{t(`status.${plan.status}`)}</StatusPill>
          {plan.status === "active" && plan.approved_at && (
            <span className="text-[11px] text-[var(--text-dim)]">{t("approvedOn").replace("{time}", "").trim()} <span dir="ltr" className="tabular-nums">{dmyHm(plan.approved_at)}</span></span>
          )}
        </span>
      )}
    </div>
  );

  const history = data.history.length > 0 && (
    <section aria-label={t("history")} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 md:p-4">
      <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("history")}</h3>
      <ul className="mt-2 flex flex-col">
        {data.history.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => setWeek(h.week_start)}
              aria-current={h.week_start === shownWeek ? "true" : undefined}
              className={`flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-start text-[13px] transition-colors hover:bg-[var(--bg-surface-subtle)] ${h.week_start === shownWeek ? "bg-[var(--bg-surface-subtle)]" : ""}`}
            >
              <span dir="ltr" className="tabular-nums text-[var(--text-primary)]">{weekLabel(h.week_start)}</span>
              <span className="ms-auto text-[12px] text-[var(--text-muted)]">
                {h.result ? t("historyRow").replace("{done}", String(h.result.done)).replace("{total}", String(h.result.total)) : t("historyOpen")}
              </span>
              {h.result && <ProgressBar value={h.result.total ? h.result.done / h.result.total : 0} className="w-16 shrink-0" />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  const alert = notice && <p role="alert" className="text-[12px] text-[#FF3333]">{notice}</p>;

  /* No plan for the week shown. */
  if (!plan) {
    let body: ReactNode;
    if (data.platforms.length === 0) {
      body = (
        <EmptyState
          icon={<span className="inline-flex gap-2"><BrandGlyph name="facebook" size={22} /><BrandGlyph name="instagram" size={22} /></span>}
          title={t("empty")}
          hint={t("emptyHint")}
          action={<Button type="button" variant="secondary" onClick={() => router.push(SPACE_ROUTE[space])}>{t("openAccounts")}</Button>}
        />
      );
    } else if (busy === "draft") {
      body = (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-[13px] text-[var(--text-muted)]">
          <Spinner size={16} className="text-[#7FA9D6]" />{t("drafting")}
        </div>
      );
    } else if (!isCurrent) {
      body = <EmptyState title={t("none.past")} />;
    } else {
      body = (
        <EmptyState
          icon={<SparklesIcon size={22} />}
          title={t("none.title")}
          hint={t("none.hint")}
          action={data.may.edit ? (
            <Button type="button" variant="secondary" className="kx-ai-glow" disabled={busy !== null} onClick={() => void post("draft", { action: "draft", week: data.week })}>
              <SparklesIcon size={14} />{t("draftNow")}
            </Button>
          ) : undefined}
        />
      );
    }
    return frame(<>{weekBar}{alert}{body}{history}</>);
  }

  /* ── The plan ── */
  const list = editing ?? plan.tasks;
  const saveEdit = async () => {
    if (!editing) return;
    if (await post("save", { action: "edit", id: plan.id, version: plan.version, tasks: editing })) setEditing(null);
  };

  return frame(
    <>
      {weekBar}
      {alert}

      <section aria-label={t("week")} className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        {plan.summary && (
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--text-primary)]">
            <SparklesIcon size={14} className="mt-[3px] shrink-0 text-[#7FA9D6]" />
            <span className="min-w-0"><span className="sr-only">{t("byAi")}: </span>{pick(plan.summary, lang)}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            {t("doneOf").replace("{done}", String(plan.done)).replace("{total}", String(plan.total))}
          </span>
          <ProgressBar value={plan.total ? plan.done / plan.total : 0} className="min-w-[120px] flex-1 sm:max-w-[320px]" />
          <span className="flex flex-wrap items-center gap-2 sm:ms-auto">
            {editing ? (
              <>
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setEditing(null)}>{t("cancel")}</Button>
                <Button type="button" disabled={busy !== null} onClick={() => void saveEdit()}>{busy === "save" ? t("saving") : t("save")}</Button>
              </>
            ) : (
              <>
                {mayChange && (
                  <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => { setAskRedraft(false); setEditing(plan.tasks); }}>{t("edit")}</Button>
                )}
                {plan.status === "draft" && data.may.edit && (
                  <Button type="button" variant="secondary" className="kx-ai-glow" disabled={busy !== null} onClick={() => setAskRedraft(true)}>
                    <SparklesIcon size={14} />{t("redraft")}
                  </Button>
                )}
                {plan.status === "draft" && data.may.approve && (
                  <Button type="button" disabled={busy !== null} onClick={() => void post("approve", { action: "approve", id: plan.id, version: plan.version })}>
                    {busy === "approve" ? t("approving") : t("approve")}
                  </Button>
                )}
              </>
            )}
          </span>
        </div>
        {askRedraft && !editing && (
          <div role="group" className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-[13px] text-[var(--text-primary)]">
            <span className="min-w-0 flex-1">{busy === "redraft" ? t("drafting") : t("redraftAsk")}</span>
            {busy === "redraft" ? <Spinner size={16} className="text-[#7FA9D6]" /> : (
              <>
                <Button type="button" variant="ghost" onClick={() => setAskRedraft(false)}>{t("cancel")}</Button>
                <Button type="button" variant="secondary" className="kx-ai-glow" onClick={() => void post("redraft", { action: "redraft", id: plan.id, version: plan.version }).then((ok) => { if (ok) setAskRedraft(false); })}>
                  {t("redraftYes")}
                </Button>
              </>
            )}
          </div>
        )}
      </section>

      <ul aria-label={t("week")} className="flex flex-col gap-2">
        {list.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            progress={plan.progress[task.id]}
            t={t}
            lang={lang}
            editing={!!editing}
            mayTick={data.may.edit && plan.status !== "closed"}
            ticking={busy === `tick:${task.id}`}
            disabled={busy !== null}
            onTick={(done) => void post(`tick:${task.id}`, { action: "tick", id: plan.id, version: plan.version, task: task.id, done })}
            onTarget={(n) => setEditing((e) => e && e.map((x) => (x.id === task.id ? { ...x, target: n } : x)))}
            onRemove={() => setEditing((e) => e && e.filter((x) => x.id !== task.id))}
          />
        ))}
      </ul>

      {editing && <AddTasks tasks={editing} platforms={data.platforms} t={t} onChange={setEditing} />}

      {!data.may.edit && plan.status !== "closed" && <p className="text-[12px] text-[var(--text-dim)]">{t("viewOnly")}</p>}
      {history}
      <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">{t("counted")}</p>
    </>,
  );
}

function TaskRow({ task, progress, t, lang, editing, mayTick, ticking, disabled, onTick, onTarget, onRemove }: {
  task: PlanTask; progress: TaskProgress | undefined; t: T; lang: Lang; editing: boolean; mayTick: boolean;
  ticking: boolean; disabled: boolean; onTick: (done: boolean) => void; onTarget: (n: number) => void; onRemove: () => void;
}) {
  const done = !editing && !!progress?.done;
  const icon = task.kind === "publish" && task.platform ? <BrandGlyph name={task.platform} size={16} /> : <CommentIcon size={16} />;
  let state: ReactNode = null;
  if (!editing && progress) {
    if (task.kind === "publish") state = t("p.posts").replace("{value}", String(progress.value)).replace("{target}", String(progress.target));
    else if (task.kind === "reply") state = progress.target === 0 ? t("p.noComments") : t("p.replies").replace("{value}", String(progress.value)).replace("{target}", String(progress.target));
    else state = progress.done ? t("p.done") : t("p.hand");
  }
  return (
    <li className={`flex min-w-0 flex-col gap-2 rounded-2xl border bg-[var(--bg-surface)] p-3.5 sm:flex-row sm:items-center sm:gap-4 ${done ? "border-[#10B981]/35" : "border-[var(--border-subtle)]"}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {task.kind === "manual" ? (
          <Checkbox
            checked={!!task.done_manual}
            disabled={editing || !mayTick || disabled}
            onChange={onTick}
            className="mt-0.5"
            label={<span className="sr-only">{taskTitle(task, t, lang)}</span>}
          />
        ) : (
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center ${done ? "text-[#10B981]" : "text-[var(--text-muted)]"}`}>{done && task.kind === "reply" ? <CheckIcon size={16} /> : icon}</span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={`text-[14px] font-semibold ${done ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>{taskTitle(task, t, lang)}</span>
          {task.why && <span className="text-[12px] leading-relaxed text-[var(--text-muted)]">{pick(task.why, lang)}</span>}
          {task.kind === "publish" && task.estimate && (
            <span className="text-[11px] text-[var(--text-dim)]" title={t("estimateHint")}>
              {t("estimate").replace("{range}", rangeText(task.estimate.low, task.estimate.high))}
            </span>
          )}
          {task.kind === "manual" && task.done_manual && task.done_at && !editing && (
            <span className="text-[11px] text-[var(--text-dim)]">{t("doneBy").replace("{time}", "").trim()} <span dir="ltr" className="tabular-nums">{dmyHm(task.done_at)}</span></span>
          )}
        </div>
      </div>
      {editing ? (
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {task.kind === "publish" && (
            <span className="flex items-center gap-1" role="group" aria-label={t("howMany")}>
              <Button type="button" variant="iconSecondary" aria-label={t("fewer")} disabled={task.target <= 1} onClick={() => onTarget(task.target - 1)}><MinusIcon size={12} /></Button>
              <span className="w-6 text-center text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{task.target}</span>
              <Button type="button" variant="iconSecondary" aria-label={t("more")} disabled={task.target >= PLAN_LIMITS.publishTarget} onClick={() => onTarget(task.target + 1)}><PlusIcon size={12} /></Button>
            </span>
          )}
          <Button type="button" variant="iconSecondary" aria-label={t("remove")} onClick={onRemove}><TrashIcon size={13} /></Button>
        </div>
      ) : state !== null && (
        <div className="flex min-w-0 flex-col gap-1.5 sm:w-[200px] sm:shrink-0">
          <span className={`text-[12px] ${done ? "text-[#10B981]" : "text-[var(--text-muted)]"}`}>
            {ticking ? <Spinner size={12} className="text-[var(--text-dim)]" /> : state}
          </span>
          {task.kind !== "manual" && progress && progress.target > 0 && <ProgressBar value={progress.value / progress.target} />}
        </div>
      )}
    </li>
  );
}

function AddTasks({ tasks, platforms, t, onChange }: { tasks: PlanTask[]; platforms: PlanPlatform[]; t: T; onChange: (tasks: PlanTask[]) => void }) {
  const [platform, setPlatform] = useState<PlanPlatform>(platforms[0] ?? "facebook");
  const [format, setFormat] = useState<PostFormat | null>(null);
  const [target, setTarget] = useState(1);
  const [hand, setHand] = useState("");
  const full = tasks.length >= PLAN_LIMITS.tasks;
  const hands = tasks.filter((x) => x.kind === "manual").length;
  const hasReply = tasks.some((x) => x.kind === "reply");

  const addPosts = () => {
    const found = tasks.find((x) => x.kind === "publish" && x.platform === platform && (x.format ?? null) === format);
    if (found) {
      onChange(tasks.map((x) => (x.id === found.id ? { ...x, target: Math.min(PLAN_LIMITS.publishTarget, x.target + target) } : x)));
    } else if (!full) {
      onChange([...tasks, { id: localId(), kind: "publish", platform, format, target, why: null, estimate: null }]);
    }
    setTarget(1);
  };
  const addHand = () => {
    const title = hand.trim().slice(0, PLAN_LIMITS.text);
    if (!title || full || hands >= PLAN_LIMITS.manual) return;
    onChange([...tasks, { id: localId(), kind: "manual", target: 1, title: asWritten(title), why: null }]);
    setHand("");
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-[var(--border-subtle)] p-3.5">
      {full && <p className="text-[12px] text-[var(--text-muted)]">{t("full")}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">{t("addPosts")}</span>
        <span role="group" aria-label={t("platform")} className="flex flex-wrap gap-1.5">
          {platforms.map((p) => (
            <Chip key={p} on={platform === p} onClick={() => setPlatform(p)}><BrandGlyph name={p} size={13} />{PLATFORM_NAME[p]}</Chip>
          ))}
        </span>
        <span role="group" aria-label={t("format")} className="flex flex-wrap gap-1.5">
          <Chip on={format === null} onClick={() => setFormat(null)}>{t("f.any")}</Chip>
          {POST_FORMATS.map((f) => <Chip key={f} on={format === f} onClick={() => setFormat(f)}>{t(`f.${f}`)}</Chip>)}
        </span>
        <span className="flex items-center gap-1" role="group" aria-label={t("howMany")}>
          <Button type="button" variant="iconSecondary" aria-label={t("fewer")} disabled={target <= 1} onClick={() => setTarget(target - 1)}><MinusIcon size={12} /></Button>
          <span className="w-6 text-center text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{target}</span>
          <Button type="button" variant="iconSecondary" aria-label={t("more")} disabled={target >= PLAN_LIMITS.publishTarget} onClick={() => setTarget(target + 1)}><PlusIcon size={12} /></Button>
        </span>
        <Button type="button" variant="secondary" disabled={platforms.length === 0 || (full && !tasks.some((x) => x.kind === "publish" && x.platform === platform && (x.format ?? null) === format))} onClick={addPosts}>
          <PlusIcon size={12} />{t("add")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={hand}
          onChange={(e) => setHand(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHand(); } }}
          maxLength={PLAN_LIMITS.text}
          placeholder={t("handPlaceholder")}
          aria-label={t("addHand")}
          disabled={full || hands >= PLAN_LIMITS.manual}
          className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] disabled:opacity-50"
        />
        <Button type="button" variant="secondary" disabled={!hand.trim() || full || hands >= PLAN_LIMITS.manual} onClick={addHand}>
          <PlusIcon size={12} />{t("addHand")}
        </Button>
        {!hasReply && (
          <Button type="button" variant="secondary" disabled={full} onClick={() => onChange([...tasks, { id: localId(), kind: "reply", target: 1, why: null }])}>
            <CommentIcon size={13} />{t("addReply")}
          </Button>
        )}
      </div>
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors ${
        on ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}
