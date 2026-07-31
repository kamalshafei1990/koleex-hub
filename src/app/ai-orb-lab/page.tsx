"use client";

/* Dev-only harness for the AIOrb status system. NOT registered in
   APP_REGISTRY — reachable only by typing /ai-orb-lab.

   Layout: approved BASELINE (locked idle) side-by-side with the ACTIVE
   state at the same size, on both a dark Hub surface and a neutral
   light-gray surface; a row of real production sizes; toggles; and a
   description of what the current state/activity animates. */

import { useState } from "react";
import AIOrb from "@/components/ai-orb/AIOrb";
import type { AIOrbActivity, AIOrbResult, AIOrbState } from "@/components/ai-orb/ai-orb-types";
import { ACTIVITY_FAMILY } from "@/components/ai-orb/ai-orb-types";

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

const STATE_DESC: Record<AIOrbState, string> = {
  idle: "2px drift · aura spin 14s + breathe 4.5s · slow specular drift · JS blink every 6–14s.",
  awakening: "Aura fades in → indicators fade dim→white → one soft ring. No overshoot.",
  listening: "Aura opacity + inner glow + ≤3% scale follow smoothed audio; indicators brightness only.",
  transcribing: "One narrow horizontal light sweep; indicators stable.",
  thinking: "Internal gradients circulate 16s, aura breathes faster, sparse rim particles, rare streak. Body centered.",
  processing: "Thin rim arc rotates + ordered particles + brightness 1.05; activity layer on top.",
  speaking: "Aura/glow/≤3% scale ride output amplitude; indicators brightness + ≤5% scaleY.",
  success: "Center brightens, 1.02 settle, one clean ring, 600ms.",
  warning: "One calm amber tint pulse; slowed aura; indicators +15% brightness.",
  error: "One 2px nudge, glow contraction, soft red tint once, aura dims.",
  sleeping: "Aura 12% · everything slowed · indicators dimmed at full shape.",
};
const FAMILY_DESC: Record<string, string> = {
  "arc-scan": "narrow arc scans the perimeter + faster rim arc",
  "line-scan": "horizontal light line steps down the surface",
  "sweep-lr": "light transfers side↔side through the center",
  "counter-rotate": "aura reverses vs. inner circulation (opposed flows)",
  "ripple-out": "low-opacity rings grow from the center",
  "ordered-orbit": "rim particles become ordered, brighter, clockwise",
};

export default function AiOrbLab() {
  const [state, setState] = useState<AIOrbState>("idle");
  const [activity, setActivity] = useState<AIOrbActivity>("none");
  const [result, setResult] = useState<AIOrbResult>("none");
  const [audio, setAudio] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [noParticles, setNoParticles] = useState(false);

  const chip = (active: boolean) =>
    `px-2.5 h-7 rounded-lg text-[11px] font-semibold border transition-colors ${
      active ? "border-[#567fb2] text-[#7fa9d6] bg-[#567fb2]/10" : "border-white/10 text-white/50"
    }`;

  const fam = state === "processing" || state === "thinking" ? ACTIVITY_FAMILY[activity] : null;
  const desc =
    STATE_DESC[state] + (fam ? ` Activity(${activity}): ${FAMILY_DESC[fam]}.` : "");

  const orb = (size: number, compact?: boolean) => (
    <AIOrb state={state} activity={activity} result={result}
      audioLevel={audio} progress={progress} interactive={size >= 100}
      size={size} compact={compact} />
  );

  return (
    <div className={`min-h-screen p-6 bg-[#0a0a0a] text-white ${noParticles ? "lab-nopart" : ""}`}>
      <style>{`.lab-nopart .kx-aiorb .particles { display: none !important; }`}</style>
      <div className="flex items-center gap-4 mb-5">
        <h1 className="text-lg font-bold">AI Orb Lab</h1>
        <span className="text-[11px] text-white/40">indicators geometry: LOCKED (validate:ai-orb enforces)</span>
        <button className={chip(noParticles)} onClick={() => setNoParticles(!noParticles)}>particles off</button>
      </div>

      {/* Baseline vs active — same size, dark + neutral light surfaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-w-3xl">
        <div className="rounded-2xl border border-white/10 p-5 flex items-center justify-around bg-[#0a0a0a]">
          <div className="text-center">
            <AIOrb state="idle" size={104} />
            <p className="mt-2 text-[10px] uppercase tracking-wider text-white/35">baseline (approved)</p>
          </div>
          <div className="text-center">
            {orb(104)}
            <p className="mt-2 text-[10px] uppercase tracking-wider text-[#7fa9d6]">active: {state}</p>
          </div>
        </div>
        <div className="rounded-2xl p-5 flex items-center justify-around" style={{ background: "#e8eaed" }}>
          <div className="text-center">
            <AIOrb state="idle" size={104} />
            <p className="mt-2 text-[10px] uppercase tracking-wider text-black/40">baseline · light surface</p>
          </div>
          <div className="text-center">
            {orb(104)}
            <p className="mt-2 text-[10px] uppercase tracking-wider text-[#3e6796]">active: {state}</p>
          </div>
        </div>
      </div>

      {/* Real production sizes */}
      <div className="flex items-end gap-10 mb-6">
        {[
          [160, "lab"], [72, "home greeter"], [38, "chat header"], [26, "launcher (compact)"],
        ].map(([sz, lbl]) => (
          <div key={lbl as string} className="text-center">
            {orb(sz as number, (sz as number) < 44)}
            <p className="mt-2 text-[10px] text-white/35">{sz}px · {lbl}</p>
          </div>
        ))}
      </div>

      {/* What is animating right now */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 mb-6 max-w-3xl">
        <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1">current animation</p>
        <p className="text-[12.5px] text-white/75 leading-relaxed">{desc}</p>
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
