"use client";

/* ---------------------------------------------------------------------------
   UsageGovernance — the governance panel for an asset OR a collection.
   Allowed / Forbidden / Preferred context chips (add via picker grouped by
   type), plus (assets) compatibility scores + violation badges.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CONTEXT_TYPE_LABEL, type UsageContext, type ContextRule, type ContextType,
  type GovernanceViolation, type RuleKind,
} from "@/lib/visual-library/types";
import { scoreVerdict } from "@/lib/visual-library/governance";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";

const RULE_META: Record<RuleKind, { label: string; cls: string }> = {
  allowed:   { label: "Allowed",   cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  forbidden: { label: "Forbidden", cls: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  preferred: { label: "Preferred", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
};

export default function UsageGovernance({
  entityType, entityId,
}: { entityType: "asset" | "collection"; entityId: string }) {
  const base = entityType === "asset"
    ? `/api/visual-library/${entityId}/governance`
    : `/api/visual-library/collections/${entityId}/governance`;

  const [rules, setRules] = useState<ContextRule[]>([]);
  const [compat, setCompat] = useState<{ collection_id: string; name: string; score: number }[]>([]);
  const [violations, setViolations] = useState<GovernanceViolation[]>([]);
  const [contexts, setContexts] = useState<UsageContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState<RuleKind | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, c] = await Promise.all([
      fetch(base, { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : { rules: [] }),
      fetch("/api/visual-library/contexts", { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : { contexts: [] }),
    ]);
    setRules(g.rules ?? []); setCompat(g.compatibility ?? []); setViolations(g.violations ?? []);
    setContexts(c.contexts ?? []);
    setLoading(false);
  }, [base]);
  useEffect(() => { load(); }, [load]);

  const addRule = async (contextId: string, rule: RuleKind) => {
    setBusy(true);
    await fetch(base, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context_id: contextId, rule }) });
    setBusy(false); setPicker(null); load();
  };
  const removeRule = async (ruleId: string) => {
    await fetch(`${base}?rule_id=${ruleId}`, { method: "DELETE", credentials: "include" });
    load();
  };

  const byRule = (k: RuleKind) => rules.filter((r) => r.rule === k);
  const usedContextIds = useMemo(() => new Set(rules.map((r) => r.context_id)), [rules]);
  const grouped = useMemo(() => {
    const m: Record<string, UsageContext[]> = {};
    for (const c of contexts) if (!usedContextIds.has(c.id) || picker) (m[c.context_type] ??= []).push(c);
    return m;
  }, [contexts, usedContextIds, picker]);

  if (loading) return <div className="mt-4 flex justify-center py-4 text-[var(--text-dim)]"><SpinnerIcon size={14} className="animate-spin" /></div>;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-1.5">
        <ShieldCheckIcon size={13} className="text-[var(--text-dim)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Usage governance</span>
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <div className="mb-3 space-y-1">
          {violations.map((v, i) => (
            <div key={i} className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] ${v.severity === "error" ? "border-rose-500/20 bg-rose-500/10 text-rose-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
              <span className="mt-0.5">⚠</span><span>{v.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Rule groups */}
      {(["allowed", "forbidden", "preferred"] as RuleKind[]).map((k) => (
        <div key={k} className="mb-2.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{RULE_META[k].label}</span>
            <button type="button" onClick={() => setPicker(picker === k ? null : k)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <PlusIcon size={10} /> Add
            </button>
          </div>
          {byRule(k).length === 0 ? (
            <p className="text-[11px] text-[var(--text-dim)]">—</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {byRule(k).map((r) => (
                <span key={r.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] ${RULE_META[k].cls}`}>
                  {(r.context as UsageContext | null)?.name ?? "context"}
                  <button type="button" onClick={() => removeRule(r.id)} className="opacity-70 hover:opacity-100"><CrossIcon size={9} /></button>
                </span>
              ))}
            </div>
          )}
          {picker === k && (
            <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2">
              {Object.entries(grouped).map(([type, list]) => (
                <div key={type} className="mb-1.5 last:mb-0">
                  <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{CONTEXT_TYPE_LABEL[type as ContextType]}</div>
                  <div className="flex flex-wrap gap-1">
                    {list.map((cx) => (
                      <button key={cx.id} type="button" disabled={busy} onClick={() => addRule(cx.id, k)}
                        className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 text-[10.5px] text-[var(--text-muted)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)] disabled:opacity-50">
                        {cx.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Compatibility (assets only) */}
      {entityType === "asset" && compat.length > 0 && (
        <div className="mt-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Compatibility</span>
          <div className="mt-1.5 space-y-1">
            {compat.map((c) => {
              const v = scoreVerdict(c.score);
              const tone = v.tone === "positive" ? "text-emerald-400" : v.tone === "warning" ? "text-amber-400" : "text-rose-400";
              return (
                <div {...kxInspectAttrs({ component: "AssetGovernanceTab", module: "Database", section: "Governance" })} key={c.collection_id} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="truncate text-[var(--text-muted)]">{c.name}</span>
                  <span className={`shrink-0 font-semibold tabular-nums ${tone}`}>{c.score}% · {v.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
