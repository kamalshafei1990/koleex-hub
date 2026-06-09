"use client";

/* SecurityCenter — Phase A redesign orchestrator (Phase 2A · A3, L1+L2 only).
   Consumes the FROZEN S3b API + the A1 presenter + A2/A3 primitives. One fetch
   per window, in-memory cached; refreshing keeps stale data visible (no layout
   shift); no polling, no mutations, no deep dive / tabs / drawer yet (A4).
   Super-admin gated (useMeBootstrap → access-denied; the API also 403s). */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import {
  deriveViewModel,
  type SecurityReport,
  type AnalyticsWindow,
  type AttentionItem,
} from "@/lib/security/view-model";
import { TAB_IDS, type TabId, type Entity } from "@/components/security/investigation";
import SecurityHeader from "./SecurityHeader";
import StatusHero from "./StatusHero";
import NeedsAttention from "./NeedsAttention";
import KpiStrip from "./KpiStrip";
import TrendPanel from "./TrendPanel";
import ReadinessPanel from "./ReadinessPanel";
import ThreatList from "./ThreatList";
import EmptyState from "./EmptyState";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* L3 is lazy — the hero + KPIs paint first; tabs + drawer load on demand. */
const DeepDiveTabs = dynamic(() => import("./DeepDiveTabs"), { ssr: false, loading: () => null });
const InvestigationDrawer = dynamic(() => import("./InvestigationDrawer"), { ssr: false });

type Status = "loading" | "ready" | "refreshing" | "error" | "forbidden";

export default function SecurityCenter() {
  const boot = useMeBootstrap();
  const isSuperAdmin = boot.data?.isSuperAdmin === true;

  const cache = useRef<Map<AnalyticsWindow, SecurityReport>>(new Map());
  const [window, setWindow] = useState<AnalyticsWindow>("24h");
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [activeTab, setActiveTab] = useState<TabId>("identifiers");
  const [entity, setEntity] = useState<Entity | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const sp = useSearchParams();
  const didInit = useRef(false);

  const load = useCallback(async (w: AnalyticsWindow, force = false) => {
    if (!force && cache.current.has(w)) {
      setReport(cache.current.get(w)!);
      setStatus("ready");
      return;
    }
    // Keep any existing report visible while fetching (no flash / no shift).
    setStatus((prev) => (prev === "loading" && !cache.current.size ? "loading" : "refreshing"));
    try {
      const res = await fetch(`/api/admin/login-analytics?window=${w}`, { credentials: "include" });
      if (res.status === 403) {
        setStatus("forbidden");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as SecurityReport;
      cache.current.set(w, json);
      setReport(json);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) void load(window);
  }, [isSuperAdmin, window, load]);

  const vm = useMemo(() => (report ? deriveViewModel(report, window) : null), [report, window]);

  // Deep-link (read-only, once): ?tab= and ?ip= / ?identifier=.
  useEffect(() => {
    if (!report || didInit.current) return;
    didInit.current = true;
    const t = sp.get("tab");
    if (t && (TAB_IDS as string[]).includes(t)) setActiveTab(t as TabId);
    const ip = sp.get("ip");
    const id = sp.get("identifier");
    if (ip) setEntity({ kind: "ip", id: ip });
    else if (id) setEntity({ kind: "identifier", id });
  }, [report, sp]);

  const goTab = useCallback((t: TabId) => {
    setActiveTab(t);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const onAttention = useCallback(
    (item: AttentionItem) => {
      switch (item.target.kind) {
        case "false_positives":
          goTab("false_positives");
          break;
        case "threats": {
          const ip = report?.topOffendingIps.find((i) => i.failures > 0)?.ipAddress;
          if (ip) setEntity({ kind: "ip", id: ip });
          else goTab("identifiers");
          break;
        }
        case "readiness":
          goTab("rules");
          break;
        default:
          break;
      }
    },
    [report, goTab],
  );

  if (boot.loading) return <Center><SpinnerIcon className="h-6 w-6 animate-spin text-[var(--text-dim)]" /></Center>;
  if (!isSuperAdmin || status === "forbidden") return <AccessDenied />;

  const refreshing = status === "refreshing";

  return (
    <>
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
      <SecurityHeader
        window={window}
        onWindow={setWindow}
        onRefresh={() => load(window, true)}
        refreshing={refreshing}
        generatedAt={vm?.generatedAt}
      />

      <p className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-xs text-[var(--text-dim)]">
        Advisory analysis · production is in <span className="font-medium text-[var(--text-secondary)]">observe</span> mode · this page never enables enforcement.
      </p>

      {status === "loading" && !vm && <Skeleton />}
      {status === "error" && !vm && <EmptyState variant="error" />}

      {vm && (
        <div className="space-y-5">
          {/* L1 */}
          <StatusHero posture={vm.posture} threat={vm.threat} readiness={vm.readiness} />
          <NeedsAttention items={vm.attention} onAction={onAttention} />

          {/* L2 */}
          {vm.flags.empty ? (
            <EmptyState variant="inactive" />
          ) : (
            <>
              <KpiStrip kpis={vm.kpis} />
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <TrendPanel trend={vm.trend} outcome={vm.outcomeSplit} window={vm.window} />
                </div>
                <div className="lg:col-span-1">
                  <ReadinessPanel readiness={vm.readiness} reasons={report!.readiness.reasons} />
                </div>
              </div>
              <ThreatList ips={report!.topOffendingIps} onSelect={(ip) => setEntity({ kind: "ip", id: ip })} />
              {vm.flags.lowTraffic && (
                <p className="text-xs text-[var(--text-dim)]">Limited activity — readiness needs more data before enforcement can be trusted.</p>
              )}

              {/* L3 — deep dive (lazy) */}
              <div ref={tabsRef}>
                <DeepDiveTabs report={report!} activeTab={activeTab} onTab={goTab} onSelect={setEntity} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
    {entity && report && (
      <InvestigationDrawer entity={entity} report={report} onClose={() => setEntity(null)} />
    )}
    </>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-center py-24">{children}</div>;
}
function AccessDenied() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-8">
        <p className="text-lg font-semibold text-[var(--text-primary)]">Super-admin only</p>
        <p className="mt-2 text-sm text-[var(--text-dim)]">You don&apos;t have access to login-security analytics.</p>
      </div>
    </div>
  );
}
function Skeleton() {
  return (
    <div className="space-y-5">
      <div className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/40" />
      <div className="h-12 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/40" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/40" />
        ))}
      </div>
    </div>
  );
}
