"use client";

/* Dev-only harness for the AIOrb status system. NOT registered in
   APP_REGISTRY / sidebar — reachable only by typing /ai-orb-lab.
   Exercises every state, activity, audio level, progress, compact
   mode and both surfaces (dark/light). */

import { useState } from "react";
import AIOrb from "@/components/ai-orb/AIOrb";
import type { AIOrbActivity, AIOrbResult, AIOrbState } from "@/components/ai-orb/ai-orb-types";

const STATES: AIOrbState[] = [
  "idle", "awakening", "listening", "transcribing", "thinking",
  "processing", "speaking", "success", "warning", "error", "sleeping",
];
const ACTIVITIES: AIOrbActivity[] = [
  "none", "searching", "browsing", "reading", "analyzing", "reasoning",
  "translating", "generating", "retrieving-data", "executing-action",
  "creating-record", "updating-record", "deleting-record", "uploading",
  "downloading", "connecting", "waiting-for-user", "requesting-permission",
];
const RESULTS: AIOrbResult[] = ["none", "success", "warning", "error"];

export default function AiOrbLab() {
  const [state, setState] = useState<AIOrbState>("idle");
  const [activity, setActivity] = useState<AIOrbActivity>("none");
  const [result, setResult] = useState<AIOrbResult>("none");
  const [audio, setAudio] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [light, setLight] = useState(false);

  const chip = (active: boolean) =>
    `px-2.5 h-7 rounded-lg text-[11px] font-semibold border transition-colors ${
      active
        ? "border-[#567fb2] text-[#7fa9d6] bg-[#567fb2]/10"
        : light
          ? "border-black/10 text-black/50"
          : "border-white/10 text-white/50"
    }`;

  return (
    <div className={`min-h-screen p-6 ${light ? "bg-white text-black" : "bg-[#0a0a0a] text-white"}`}>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-lg font-bold">AI Orb Lab</h1>
        <button className={chip(light)} onClick={() => setLight(!light)}>light surface</button>
      </div>

      <div className="flex items-center gap-12 mb-8">
        <AIOrb state={state} activity={activity} result={result}
          audioLevel={audio} progress={progress} interactive size={160} />
        <AIOrb state={state} activity={activity} result={result}
          audioLevel={audio} progress={progress} interactive size={72} />
        <AIOrb state={state} activity={activity} result={result}
          audioLevel={audio} progress={progress} size={28} compact />
      </div>

      <p className="text-[11px] uppercase tracking-wider opacity-40 mb-1.5">State</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {STATES.map((st) => (
          <button key={st} className={chip(state === st)} onClick={() => setState(st)}>{st}</button>
        ))}
      </div>

      <p className="text-[11px] uppercase tracking-wider opacity-40 mb-1.5">Activity (thinking/processing)</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {ACTIVITIES.map((a) => (
          <button key={a} className={chip(activity === a)} onClick={() => setActivity(a)}>{a}</button>
        ))}
      </div>

      <p className="text-[11px] uppercase tracking-wider opacity-40 mb-1.5">Result pulse</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {RESULTS.map((r) => (
          <button key={r} className={chip(result === r)} onClick={() => setResult(r)}>{r}</button>
        ))}
      </div>

      <div className="flex items-center gap-6 max-w-xl">
        <label className="flex-1 text-[12px]">
          audioLevel {audio.toFixed(2)}
          <input type="range" min={0} max={1} step={0.01} value={audio}
            onChange={(e) => setAudio(Number(e.target.value))} className="w-full" />
        </label>
        <label className="flex-1 text-[12px]">
          progress {progress === null ? "off" : progress.toFixed(2)}
          <input type="range" min={-0.01} max={1} step={0.01} value={progress ?? -0.01}
            onChange={(e) => { const v = Number(e.target.value); setProgress(v < 0 ? null : v); }}
            className="w-full" />
        </label>
      </div>
    </div>
  );
}
