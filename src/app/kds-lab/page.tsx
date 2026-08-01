"use client";

/* KDS Lab — hidden review surface for the canonical kit (not in nav). */

import { useState } from "react";
import {
  HUB, HUB_GRADIENT,
  StatusPill, ProgressBar, Toggle, SearchInput, SectionHeader,
} from "@/components/kds";

export default function KdsLab() {
  const [on, setOn] = useState(true);
  const [q, setQ] = useState("");
  const [p, setP] = useState(0.62);
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] p-8 max-w-3xl">
      <h1 className="text-[22px] font-bold mb-1">KDS Lab</h1>
      <p className="text-[12px] text-[var(--text-dim)] mb-8">
        The canonical kit — one shape per element. docs/design-system/kds-1.md is law.
      </p>

      <SectionHeader>Colors</SectionHeader>
      <div className="flex gap-3 mb-8">
        {Object.entries(HUB).map(([k, v]) => (
          <div key={k} className="text-center">
            <div className="h-14 w-14 rounded-xl border border-[var(--border-subtle)]" style={{ background: v }} />
            <p className="text-[10px] text-[var(--text-dim)] mt-1">{k}</p>
          </div>
        ))}
        <div className="text-center">
          <div className="h-14 w-28 rounded-xl" style={{ background: HUB_GRADIENT }} />
          <p className="text-[10px] text-[var(--text-dim)] mt-1">gradient</p>
        </div>
      </div>

      <SectionHeader>StatusPill</SectionHeader>
      <div className="flex gap-2 mb-8">
        <StatusPill>NEUTRAL</StatusPill>
        <StatusPill tone="brand">BRAND</StatusPill>
        <StatusPill tone="success">ACTIVE</StatusPill>
        <StatusPill tone="warning">DRAFT</StatusPill>
        <StatusPill tone="error">ARCHIVED</StatusPill>
      </div>

      <SectionHeader>ProgressBar</SectionHeader>
      <div className="space-y-3 mb-8 max-w-sm">
        <ProgressBar value={p} />
        <ProgressBar value={p} knob />
        <input type="range" min={0} max={1} step={0.01} value={p} onChange={(e) => setP(Number(e.target.value))} className="w-full" />
      </div>

      <SectionHeader>Toggle</SectionHeader>
      <div className="flex items-center gap-4 mb-8">
        <Toggle checked={on} onChange={setOn} label="demo" />
        <Toggle checked={!on} onChange={(v) => setOn(!v)} label="demo2" />
        <Toggle checked disabled onChange={() => {}} label="disabled" />
      </div>

      <SectionHeader>SearchInput</SectionHeader>
      <div className="max-w-sm mb-8">
        <SearchInput value={q} onChange={setQ} placeholder="Search anything…" />
      </div>
    </div>
  );
}
