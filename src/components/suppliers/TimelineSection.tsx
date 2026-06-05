"use client";

/* ---------------------------------------------------------------------------
   TimelineSection — the unified Supplier Operational Timeline.

   The living operational history / memory layer for the Supplier 360: a single
   visibility-aware chronology of automatic events (status, classification,
   contacts, QR, factory, documents, certification verification, readiness
   milestones) plus manually logged operational events (meetings, visits,
   calls, negotiation notes, issues, milestones).

   Monochrome, intelligence-oriented vertical rhythm — not a social feed.
   Category + search + visibility filtering. Manual composer with inline add /
   remove and optimistic refresh.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { contactsT } from "@/lib/translations/contacts";
import { humanizeError } from "@/lib/ui/humanize-error";
import {
  TIMELINE_CATEGORY_LABELS, TIMELINE_CATEGORY_ORDER, timelineCategoryLabel,
  eventTypeLabel, MANUAL_EVENT_TYPES, IMPORTANCE_LABELS,
} from "@/lib/suppliers/intelligence";
import HandshakeIcon from "@/components/icons/ui/HandshakeIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import FileBadge2Icon from "@/components/icons/ui/FileBadge2Icon";
import ShoppingCartIcon from "@/components/icons/ui/ShoppingCartIcon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import HistoryIcon from "@/components/icons/ui/HistoryIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import TrendingUpIcon from "@/components/icons/ui/TrendingUpIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";

type Row = Record<string, unknown>;
const str = (r: Row, k: string): string => {
  const v = r[k];
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
};

const VISIBILITY_TIERS = ["public", "internal", "procurement", "finance", "management"] as const;
const VISIBILITY_FALLBACK: Record<string, string> = {
  public: "Public", internal: "Internal", procurement: "Procurement",
  finance: "Finance only", management: "Management only",
};
const VISIBILITY_KEY: Record<string, string> = {
  public: "ts.visPublic", internal: "ts.visInternal", procurement: "ts.visProcurement",
  finance: "ts.visFinance", management: "ts.visManagement",
};

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  relationship: HandshakeIcon,
  communication: MessageSquareIcon,
  factory: FactoryIcon,
  documents: FileBadge2Icon,
  procurement: ShoppingCartIcon,
  system: GaugeIcon,
};

/* ── Event-type visual treatment (Section 8) ──
   Beyond the broad category icon, give notable operational-memory events
   (milestones, upgrades, negotiation wins, verifications, risks, sourcing)
   a distinct glyph + semantic tone so the timeline reads as memory, not a
   log. Pure frontend mapping over the existing event_type string. */
type EventTone = "good" | "warn" | "neutral";
function eventVisual(eventType: string, category: string): { Icon: React.ComponentType<{ className?: string }>; tone: EventTone } {
  const ty = (eventType || "").toLowerCase();
  if (/verif|certif|approv|complete|pass/.test(ty)) return { Icon: BadgeCheckIcon, tone: "good" };
  if (/milestone|readiness/.test(ty)) return { Icon: GaugeIcon, tone: "good" };
  if (/upgrade|promot|tier|strateg|preferred/.test(ty)) return { Icon: TrendingUpIcon, tone: "good" };
  if (/negoti|deal|win|agreement|contract|price/.test(ty)) return { Icon: HandshakeIcon, tone: "good" };
  if (/risk|issue|delay|defect|dispute|warn|expir|fail|reject/.test(ty)) return { Icon: TriangleWarningIcon, tone: "warn" };
  if (/sourc|order|\bpo\b|purchase|quote|rfq/.test(ty)) return { Icon: TargetIcon, tone: "neutral" };
  return { Icon: CATEGORY_ICON[category] ?? GaugeIcon, tone: "neutral" };
}

type TFn = (key: string, fallback?: string) => string;

function relativeTime(iso: string, t: TFn): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return t("ts.justNow", "just now");
  const m = Math.round(s / 60);
  if (m < 60) return t("ts.minutesAgo", "{m}m ago").replace("{m}", String(m));
  const h = Math.round(m / 60);
  if (h < 24) return t("ts.hoursAgo", "{h}h ago").replace("{h}", String(h));
  const d = Math.round(h / 24);
  if (d < 30) return t("ts.daysAgoShort", "{d}d ago").replace("{d}", String(d));
  const mo = Math.round(d / 30);
  if (mo < 12) return t("ts.monthsAgo", "{mo}mo ago").replace("{mo}", String(mo));
  return t("ts.yearsAgo", "{y}y ago").replace("{y}", String(Math.round(mo / 12)));
}
/* Coarse relationship-history buckets (Section 8) — Today / Yesterday /
   Last week / Last month / Older. Returns a stable key + display label. */
const TIME_BUCKET_ORDER = ["today", "yesterday", "lastWeek", "lastMonth", "older"] as const;
function timeBucketKey(iso: string): (typeof TIME_BUCKET_ORDER)[number] {
  const d = new Date(iso); const now = new Date();
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nn = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((nn.getTime() - dd.getTime()) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return "lastWeek";
  if (diff < 31) return "lastMonth";
  return "older";
}
function bucketLabel(key: (typeof TIME_BUCKET_ORDER)[number], t: TFn): string {
  return {
    today: t("ts.today", "Today"),
    yesterday: t("ts.yesterday", "Yesterday"),
    lastWeek: t("ts.lastWeek", "Last week"),
    lastMonth: t("ts.lastMonth", "Last month"),
    older: t("ts.older", "Older"),
  }[key];
}
function visibilityLabel(tier: string, t: TFn): string {
  const key = VISIBILITY_KEY[tier];
  const fallback = VISIBILITY_FALLBACK[tier];
  if (key && fallback) return t(key, fallback);
  return t("ts.visInternal", "Internal");
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
    {children}
  </label>
);
const inputCls =
  "w-full rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:ring-1 focus:ring-[var(--border-subtle)]";

const importanceDot: Record<string, string> = {
  low: "bg-[var(--text-faint)]", normal: "bg-[var(--text-secondary)]",
  high: "bg-amber-400", critical: "bg-rose-400",
};

export default function TimelineSection({
  supplierId,
  timeline,
  onSaved,
}: {
  supplierId: string;
  timeline: Row[];
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation(contactsT);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // composer
  const [open, setOpen] = useState(false);
  const [evType, setEvType] = useState(MANUAL_EVENT_TYPES[0].type);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("internal");
  const [importance, setImportance] = useState("normal");
  const [busy, setBusy] = useState(false);
  const [cErr, setCErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return timeline.filter((e) => {
      if (cat !== "all" && str(e, "event_category") !== cat) return false;
      if (ql) {
        const hay = `${str(e, "title")} ${str(e, "description")} ${str(e, "actor_name")} ${eventTypeLabel(str(e, "event_type"))}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [timeline, cat, q]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const e of filtered) {
      const k = timeBucketKey(str(e, "created_at"));
      (map.get(k) ?? map.set(k, []).get(k)!).push(e);
    }
    // Emit in fixed chronological order so headers never repeat or jump.
    return TIME_BUCKET_ORDER.filter((k) => map.has(k)).map((k) => ({ key: k, bucket: bucketLabel(k, t), items: map.get(k)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of timeline) m[str(e, "event_category")] = (m[str(e, "event_category")] ?? 0) + 1;
    return m;
  }, [timeline]);

  const save = async () => {
    if (!title.trim()) { setCErr(t("ts.titleRequired", "Title is required")); return; }
    setBusy(true); setCErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/timeline`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: evType, title, description, visibility_tier: visibility, importance }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      }
      setOpen(false); setTitle(""); setDescription("");
      await onSaved();
    } catch (e) {
      setCErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const remove = async (e: Row) => {
    const id = str(e, "id");
    if (!confirm(t("ts.confirmRemove", "Remove this logged event?"))) return;
    setBusyId(id); setErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/timeline/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusyId(null); }
  };

  const openComposer = () => {
    setEvType(MANUAL_EVENT_TYPES[0].type); setTitle(""); setDescription("");
    setVisibility("internal"); setImportance("normal"); setCErr(null); setOpen(true);
  };

  return (
    <section className="space-y-5" {...kxInspectAttrs({ component: "SupplierTimelineSection", module: "Suppliers", section: "Records", recordId: supplierId })}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-4 w-4 text-[var(--text-secondary)]" />
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{t("ts.title", "Operational Timeline")}</h3>
        </div>
        <button type="button" onClick={openComposer}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> {t("ts.logEvent", "Log event")}
        </button>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setCat("all")}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${cat === "all" ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
            {t("ts.all", "All")} {timeline.length ? <span className="opacity-60">{timeline.length}</span> : null}
          </button>
          {TIMELINE_CATEGORY_ORDER.filter((c) => counts[c]).map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${cat === c ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
              {TIMELINE_CATEGORY_LABELS[c]} <span className="opacity-60">{counts[c]}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ts.searchPlaceholder", "Search timeline…")}
            className="w-48 rounded-lg bg-[var(--bg-surface-subtle)] py-1.5 pl-8 pr-3 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none" />
        </div>
      </div>

      {err ? <div className="text-[12px] text-rose-400">{err}</div> : null}

      {timeline.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)]/50 px-6 py-12 text-center text-sm text-[var(--text-faint)]">
          {t("ts.emptyState", "No activity yet — operational events (status, contacts, documents, factory) appear here automatically, and you can log meetings, visits, and calls.")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)]/50 px-6 py-10 text-center text-sm text-[var(--text-faint)]">{t("ts.noMatch", "No events match this filter.")}</div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{g.bucket}</span>
                <span className="text-[10px] tabular-nums text-[var(--text-ghost)]">{g.items.length}</span>
                <span className="h-px flex-1 bg-[var(--border-subtle)]" />
              </div>
              <ol className="relative space-y-3 border-l border-[var(--border-subtle)] pl-5">
                {g.items.map((e) => {
                  const id = str(e, "id");
                  const ev = eventVisual(str(e, "event_type"), str(e, "event_category"));
                  const Icon = ev.Icon;
                  const imp = str(e, "importance") || "normal";
                  // Importance escalation wins; otherwise fall back to the
                  // event-type semantic tone so wins/verifications read green
                  // and risks read amber even at normal importance.
                  const nodeCls = imp === "critical"
                    ? "bg-rose-500/15 ring-rose-500/40 text-rose-600 dark:text-rose-400"
                    : imp === "high"
                      ? "bg-amber-500/15 ring-amber-500/40 text-amber-600 dark:text-amber-400"
                      : ev.tone === "good"
                        ? "bg-emerald-500/12 ring-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : ev.tone === "warn"
                          ? "bg-amber-500/12 ring-amber-500/30 text-amber-600 dark:text-amber-400"
                          : "bg-[var(--bg-surface)] ring-[var(--border-subtle)] text-[var(--text-secondary)]";
                  const cardCls = imp === "critical"
                    ? "bg-rose-500/[0.06] ring-1 ring-rose-500/20"
                    : imp === "high"
                      ? "bg-amber-500/[0.06] ring-1 ring-amber-500/20"
                      : "bg-[var(--bg-surface-subtle)]";
                  return (
                    <li key={id} className="relative">
                      {/* node — event-type glyph, colored by importance then type tone */}
                      <span className={`absolute -left-[27px] top-1 flex h-5 w-5 items-center justify-center rounded-full ring-1 ${nodeCls}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className={`rounded-xl p-3 ${cardCls}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {imp !== "normal" ? <span className={`h-1.5 w-1.5 rounded-full ${importanceDot[imp]}`} title={IMPORTANCE_LABELS[imp]} /> : null}
                              <span className="text-[13px] font-semibold text-[var(--text-primary)]">{str(e, "title")}</span>
                              {/* summary label — the operational verb of this memory entry */}
                              <span className="inline-flex items-center rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-faint)] ring-1 ring-[var(--border-subtle)]">
                                {eventTypeLabel(str(e, "event_type"))}
                              </span>
                            </div>
                            {str(e, "description") ? <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">{str(e, "description")}</div> : null}
                            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-[var(--text-faint)]">
                              <span className="uppercase tracking-wide">{timelineCategoryLabel(str(e, "event_category"))}</span>
                              {str(e, "actor_name") ? <span>· {str(e, "actor_name")}</span> : null}
                              <span title={new Date(str(e, "created_at")).toLocaleString()}>· {relativeTime(str(e, "created_at"), t)}</span>
                              {e.is_manual ? <span className="rounded bg-[var(--bg-surface)] px-1 py-0.5">{t("ts.manual", "Manual")}</span> : null}
                              <span className="inline-flex items-center gap-0.5"><ShieldCheckIcon className="h-2.5 w-2.5" />{visibilityLabel(str(e, "visibility_tier"), t)}</span>
                            </div>
                          </div>
                          {e.is_manual ? (
                            <button type="button" disabled={busyId === id} onClick={() => remove(e)}
                              className="shrink-0 rounded-md p-1 text-[var(--text-faint)] hover:bg-[var(--bg-surface)] hover:text-rose-400 disabled:opacity-40" title={t("ts.remove", "Remove")}><TrashIcon className="h-3.5 w-3.5" /></button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}

      {/* composer modal */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center gap-2">
              <HistoryIcon className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="text-[14px] font-semibold text-[var(--text-primary)]">{t("ts.logOperationalEvent", "Log operational event")}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("ts.fieldType", "Type")}>
                <select className={inputCls} value={evType} onChange={(e) => setEvType(e.target.value)}>
                  {MANUAL_EVENT_TYPES.map((mt) => <option key={mt.type} value={mt.type}>{mt.label}</option>)}
                </select>
              </Field>
              <Field label={t("ts.fieldImportance", "Importance")}>
                <select className={inputCls} value={importance} onChange={(e) => setImportance(e.target.value)}>
                  {Object.keys(IMPORTANCE_LABELS).map((k) => <option key={k} value={k}>{IMPORTANCE_LABELS[k]}</option>)}
                </select>
              </Field>
            </div>
            <Field label={t("ts.fieldTitle", "Title")}><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("ts.titlePlaceholder", "e.g. Factory visit — Taizhou plant")} /></Field>
            <Field label={t("ts.fieldDetails", "Details")}><textarea className={`${inputCls} min-h-[72px]`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("ts.detailsPlaceholder", "What happened, outcomes, follow-ups…")} /></Field>
            <Field label={t("ts.fieldVisibility", "Visibility")}>
              <select className={inputCls} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                {VISIBILITY_TIERS.map((tier) => <option key={tier} value={tier}>{visibilityLabel(tier, t)}</option>)}
              </select>
            </Field>
            {cErr ? <div className="text-[12px] text-rose-400">{cErr}</div> : null}
            <div className="flex items-center gap-3">
              <button type="button" disabled={busy} onClick={save}
                className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
                {busy ? t("ts.saving", "Saving…") : t("ts.logEvent", "Log event")}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("ts.cancel", "Cancel")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
