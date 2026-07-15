"use client";

/* ---------------------------------------------------------------------------
   PerfPanel — DEVELOPMENT-ONLY live view of the kx-perf metric stream.
   Loaded exclusively through PerfPanelGate (dead-code-eliminated in prod).

   Shows the latest value of each key lifecycle metric (send optimistic/ack/
   reconcile, receiver fetch/visible, realtime join/reconnect/channel count,
   warm navigation) plus a scrolling tail of recent entries and a failed-send
   counter. Reads the SAME ring buffer production metrics ship from, so what
   you see here is exactly what lands in the logs. Contains metric names and
   numbers only — never message content.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { subscribe, recent, type PerfEntry } from "@/lib/perf/client";

const KEY_METRICS: Array<[string, string]> = [
  ["discuss.send.optimistic_ms", "send → visible"],
  ["discuss.send.ack_ms", "send round-trip"],
  ["discuss.send.reconcile_ms", "send → reconciled"],
  ["discuss.recv.fetch_ms", "ping → fetched"],
  ["discuss.recv.visible_ms", "ping → visible"],
  ["rt.join_ms", "realtime join"],
  ["rt.channels", "live channels"],
  ["nav.warm_ms", "warm navigation"],
];

export default function PerfPanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<PerfEntry[]>(() => recent());

  useEffect(() => subscribe(() => setEntries(recent())), []);

  const latest = useMemo(() => {
    const m = new Map<string, PerfEntry>();
    for (const e of entries) m.set(e.n, e);
    return m;
  }, [entries]);

  const failed = entries.filter((e) => e.n === "discuss.send.failed").length;
  const tail = entries.slice(-14).reverse();

  return (
    <div className="fixed bottom-3 left-3 z-[500] font-mono text-[11px]">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-2.5 py-1.5 rounded-full bg-black/85 text-white border border-white/20 shadow-lg"
        >
          perf {failed > 0 ? `· ${failed} failed` : ""}
        </button>
      ) : (
        <div className="w-[320px] max-h-[60vh] overflow-auto rounded-xl bg-black/90 text-white border border-white/20 shadow-2xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold">kx-perf (dev)</span>
            <button type="button" onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">×</button>
          </div>
          <table className="w-full">
            <tbody>
              {KEY_METRICS.map(([name, label]) => {
                const e = latest.get(name);
                return (
                  <tr key={name} className="border-t border-white/10">
                    <td className="py-0.5 pr-2 opacity-70">{label}</td>
                    <td className="py-0.5 text-right tabular-nums">
                      {e ? (name.endsWith("_ms") ? `${e.v.toFixed(0)} ms` : e.v) : "—"}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-white/10">
                <td className="py-0.5 pr-2 opacity-70">failed sends</td>
                <td className={`py-0.5 text-right tabular-nums ${failed ? "text-red-400" : ""}`}>{failed}</td>
              </tr>
            </tbody>
          </table>
          <div className="border-t border-white/10 pt-1 space-y-0.5 opacity-80">
            {tail.map((e, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="truncate">{e.n}</span>
                <span className="tabular-nums shrink-0">{e.n.endsWith("_ms") ? `${e.v.toFixed(0)}ms` : e.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
