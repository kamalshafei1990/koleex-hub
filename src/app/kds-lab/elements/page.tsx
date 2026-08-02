"use client";

/* ─────────────────────────────────────────────────────────────────
   KDS Element Election — hidden ballot page (not in nav).

   Two zones:
   1. ELECTED — element designs the owner has personally approved
      (selected live from the running apps on 2026-08-02). These are
      now canon; the conformance sweeps copy THESE exactly.
   2. BALLOT — families still awaiting a pick, every shipped variant
      rendered 1:1 with a variant id + the apps that use it.

   All markup is recreated verbatim from the harvested sources —
   do NOT "improve" anything here; the page must show what ships.
   ───────────────────────────────────────────────────────────────── */

import { useState } from "react";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import ListIcon from "@/components/icons/ui/ListIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import FileTextIcon from "@/components/icons/ui/FileIcon";

/* ── page chrome ── */

function Family({ id, title, note, elected, children }: {
  id: string; title: string; note?: string; elected?: boolean; children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-14 scroll-mt-24">
      <div className="flex items-baseline gap-3 border-b border-[var(--border-subtle)] pb-2 mb-6">
        <h2 className="text-[18px] font-bold tracking-tight">{title}</h2>
        {elected && (
          <span className="inline-flex items-center gap-1 h-[20px] px-2 rounded-full bg-[#10B981]/12 text-[#10B981] border border-[#10B981]/35 text-[10px] font-bold uppercase tracking-wider">
            <CheckIcon className="h-2.5 w-2.5" /> Elected
          </span>
        )}
        {note && <p className="text-[11px] text-[var(--text-dim)]">{note}</p>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function Variant({ vid, apps, count, children, wide, elected }: {
  vid: string; apps: string; count?: string; children: React.ReactNode; wide?: boolean; elected?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${wide ? "lg:col-span-2" : ""} ${elected ? "border-[#10B981]/40 bg-[#10B981]/[0.03]" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]"}`}>
      <div className="flex items-center justify-between mb-4 gap-3">
        <span className={`text-[13px] font-bold tracking-wide ${elected ? "text-[#10B981]" : "text-[#7FA9D6]"}`}>
          {vid}{elected ? " ✓" : ""}
        </span>
        <span className="text-[10px] text-[var(--text-dim)] text-right">{apps}{count ? ` · ${count}` : ""}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/* ═══════════════ 1 · ELECTED — the owner's picks ═══════════════ */

function Elected() {
  const [seg, setSeg] = useState(0);
  const [view, setView] = useState(0);
  const [tab, setTab] = useState(1);
  return (
    <Family id="elected" title="Elected — approved element canon" note="picked live from the apps · these are now the law" elected>

      <Variant vid="E-SEARCH" apps="from Products" count="toolbar search + Hub Blue focus" wide elected>
        <div className="w-full bg-[var(--bg-secondary)]/80 backdrop-blur-sm rounded-xl border border-[var(--border-subtle)] p-3.5 shadow-sm">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)] z-10" />
              <input type="search" className="w-full h-10 pl-10 pr-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none transition-[border-color,box-shadow] focus:border-[#567FB2]/60 focus:shadow-[0_0_0_4px_rgba(86,127,178,0.16)] [&::-webkit-search-cancel-button]:hidden" placeholder="Search by name, model code, brand, category, tags…" />
            </div>
            <div className="flex rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <button onClick={() => setView(0)} className={`h-10 w-10 flex items-center justify-center transition-all ${view === 0 ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"}`}><LayoutGridIcon className="h-4 w-4" /></button>
              <button onClick={() => setView(1)} className={`h-10 w-10 flex items-center justify-center border-l border-[var(--border-subtle)] transition-all ${view === 1 ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"}`}><ListIcon className="h-4 w-4" /></button>
            </div>
            <button className="h-10 px-4 rounded-xl border text-[12px] font-medium flex items-center gap-2 transition-all bg-[var(--bg-surface)] border-[var(--border-focus)] text-[var(--text-primary)]">
              Filters
              <span className="h-5 min-w-[20px] px-1 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] font-bold flex items-center justify-center">1</span>
            </button>
            <button className="h-10 px-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-muted)] flex items-center gap-1.5 transition-colors">Clear</button>
          </div>
        </div>
      </Variant>

      <Variant vid="E-TABS" apps="from Inventory / PageHeader" count="pill-in-shell nav (TAB-1)" wide elected>
        <div className="relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1.5 py-1.5">
          {["Home", "Items", "Movements", "Transfers", "Balances"].map((l, i) => (
            <button key={l} onClick={() => setTab(i)} className={`relative z-10 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${tab === i ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"}`}>{l}</button>
          ))}
        </div>
      </Variant>

      <Variant vid="E-SEG" apps="from Calendar" count="inset segmented control" elected>
        <div className="inline-flex items-center bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-xl p-1">
          {["Month", "Week", "Day"].map((l, i) => (
            <button key={l} onClick={() => setSeg(i)} className={`h-8 px-4 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-all ${seg === i ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>{l}</button>
          ))}
        </div>
      </Variant>

      <Variant vid="E-BTN" apps="from Documents · Calendar · Customers" count="button set" elected>
        <button className="inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 active:opacity-80 h-9 px-3.5 text-[12.5px] gap-1.5 rounded-md"><PlusIcon className="h-3 w-3" />New Quotation</button>
        <button className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-semibold hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all">Today</button>
        <button className="h-10 w-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all flex items-center justify-center"><AngleLeftIcon className="h-4 w-4" /></button>
        <button className="h-10 w-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all flex items-center justify-center"><AngleRightIcon className="h-4 w-4" /></button>
        <button className="h-8 w-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 flex items-center justify-center transition-colors shrink-0"><PlusIcon className="h-4 w-4" /></button>
        <a className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0 cursor-pointer"><ArrowLeftIcon className="h-4 w-4" /></a>
      </Variant>

      <Variant vid="E-KPI" apps="from Customers" count="stat card" elected>
        <div className="w-full max-w-[220px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 transition-all hover:border-[var(--border-focus)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"><UsersIcon size={16} className="text-[var(--text-secondary)]" /></div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">Total</span>
          </div>
          <p className="text-3xl font-bold text-[var(--text-primary)]">121</p>
          <p className="text-xs text-[var(--text-dim)] mt-1">All customers</p>
        </div>
      </Variant>

      <Variant vid="E-CARD" apps="from Documents · Database" count="action / data cards" wide elected>
        <button type="button" className="group text-start rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 hover:border-[var(--border-focus)] transition-colors w-full max-w-[300px]">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] group-hover:border-[var(--border-focus)] transition-colors"><FileTextIcon size={18} /></div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-[var(--text-primary)]">Quotation</div>
              <div className="text-xs text-[var(--text-dim)] truncate">Commercial quotation to a customer</div>
            </div>
          </div>
          <div className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider font-semibold">Blank A4 · fill · save · print</div>
        </button>
        <a className="group flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] w-full max-w-[300px] cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]"><LayoutGridIcon className="h-5 w-5" /></span>
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">5,087</span>
          </div>
          <div className="mt-3.5 text-[15px] font-semibold text-[var(--text-primary)]">Visual Library</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">Icons &amp; visual assets — one approved source of truth.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-dim)] transition-colors group-hover:text-[var(--text-primary)]">Open system →</span>
        </a>
      </Variant>

      <Variant vid="E-FIELD" apps="from Employees form" count="input + select (bg-primary, rounded-xl)" elected>
        <div className="w-full max-w-[220px]">
          <label className="block text-[11px] font-medium text-[var(--text-dim)] mb-1">Gender</label>
          <div className="relative">
            <select className="w-full h-10 px-3 pr-9 rounded-xl bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] appearance-none focus:outline-none transition-colors border border-[var(--border-subtle)] focus:border-[var(--border-focus)]">
              <option>Select…</option><option>Male</option><option>Female</option>
            </select>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none"><path d="M12,17.17a5,5,0,0,1-3.54-1.46L.29,7.54A1,1,0,0,1,1.71,6.12l8.17,8.17a3,3,0,0,0,4.24,0l8.17-8.17a1,1,0,1,1,1.42,1.42l-8.17,8.17A5,5,0,0,1,12,17.17Z" /></svg>
          </div>
        </div>
        <div className="w-full max-w-[220px]">
          <label className="block text-[11px] font-medium text-[var(--text-dim)] mb-1">First name</label>
          <input className="w-full h-10 px-3 rounded-xl bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none transition-colors border border-[var(--border-subtle)] focus:border-[var(--border-focus)]" placeholder="e.g. 明" />
        </div>
      </Variant>

      <Variant vid="E-ROW" apps="from Discuss" count="list row" elected>
        <button type="button" className="relative w-full max-w-[340px] text-left px-3 py-2.5 rounded-xl transition-colors hover:bg-[var(--bg-surface-hover)]">
          <div className="flex items-start gap-3 min-w-0">
            <div className="relative shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-neutral-600 to-neutral-700 flex items-center justify-center text-white font-semibold" style={{ width: 40, height: 40, fontSize: 14 }}>XZ</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] truncate font-medium text-[var(--text-muted)]">Ms. Xiang Xiang<span className="ms-1 text-[0.85em] font-normal text-[var(--text-dim)]">项 子真</span></span>
                <span className="text-[10px] tabular-nums text-[var(--text-dim)]">Jul 26</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5"><span className="text-[11.5px] truncate flex-1 text-[var(--text-dim)]">Can you see my message?</span></div>
            </div>
          </div>
        </button>
      </Variant>
    </Family>
  );
}

/* ═══════════════ 2 · RUNOFF — one conflict inside your picks ═══════════════ */

function BtnRunoff() {
  return (
    <Family id="btn-runoff" title="Primary button" note="winner: R-2" elected>
      <Variant vid="R-1" apps="ui/Button primitive — your 'New Quotation' pick" count="h-9 · rounded-md · 12.5px">
        <button className="inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold transition-all duration-150 bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 h-9 px-3.5 text-[12.5px] gap-1.5 rounded-md"><PlusIcon className="h-3 w-3" />New Quotation</button>
      </Variant>
      <Variant vid="R-2" apps="Products 'Add Product' hero style (~27 sites)" count="h-10 · rounded-xl · 13px" elected>
        <button className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg"><PlusIcon className="h-4 w-4" />Add Product</button>
      </Variant>
    </Family>
  );
}

/* ═══════════════ 3 · BALLOT — still awaiting your pick ═══════════════ */

function Pills() {
  return (
    <Family id="pills" title="Status Pill / Badge" note="winner: PILL-1" elected>
      <Variant vid="PILL-1" apps="KDS kit (Products list)" count="fixed 22px height, rounded-full" elected>
        <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35">ACTIVE</span>
        <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/35">DRAFT</span>
        <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap bg-[#FF3333]/12 text-[#FF3333] border-[#FF3333]/35">ARCHIVED</span>
        <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40">BRAND</span>
      </Variant>
      <Variant vid="PILL-2" apps="Purchase + Sales (22 sites)" count="rounded-md micro-caps — most used">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Paid</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">Ordered</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">Pending</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300">Overdue</span>
      </Variant>
      <Variant vid="PILL-4" apps="Finance · Suppliers · Knowledge" count="rounded-full borderless tint">
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Reconciled</span>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-600 dark:text-amber-400">Review</span>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-rose-500/15 text-rose-600 dark:text-rose-400">Failed</span>
      </Variant>
      <Variant vid="PILL-5" apps="Approvals / Payments" count="dot-led, hairline, desaturated">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 bg-emerald-500/[0.08] border-emerald-500/[0.18]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400/85" />Approved</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-amber-300 bg-amber-500/[0.08] border-amber-500/[0.18]"><span className="h-1.5 w-1.5 rounded-full bg-amber-400/85" />Awaiting</span>
      </Variant>
      <Variant vid="PILL-6" apps="Documents / Quotations headers" count="large text-xs clickable">
        <span className="text-xs font-semibold uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 bg-blue-500/15 text-blue-300" style={{ letterSpacing: "0.03em" }}>Sent</span>
        <span className="text-xs font-semibold uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 bg-green-500/20 text-green-300" style={{ letterSpacing: "0.03em" }}>Accepted</span>
      </Variant>
    </Family>
  );
}

function Bar({ track, fill, w }: { track: string; fill: string; w: number }) {
  return <div className={track} style={{ width: 220 }}><div className={fill} style={{ width: `${w}%` }} /></div>;
}

function ProgressBars() {
  return (
    <Family id="bars" title="Progress Bar" note="winner: PB-2" elected>
      <Variant vid="PB-1" apps="KDS kit v0" count="gradient fill, RTL-correct">
        <div className="relative h-1.5 rounded-full bg-[var(--bg-inverted)]/[0.08] overflow-visible" style={{ width: 220 }}>
          <div className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-[#567FB2] to-[#7FA9D6]" style={{ width: "62%" }} />
        </div>
      </Variant>
      <Variant vid="PB-2" apps="Projects · Reports · Planning (12 files)" count="surface track, solid fill — most used" elected>
        <Bar track="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden" fill="h-full rounded-full bg-[#567FB2] transition-all" w={62} />
      </Variant>
      <Variant vid="PB-4" apps="Database quality scores" count="threshold-colored ramp">
        <Bar track="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-hover)]" fill="h-full rounded-full bg-emerald-400" w={78} />
        <Bar track="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-hover)]" fill="h-full rounded-full bg-amber-400" w={52} />
      </Variant>
      <Variant vid="PB-5" apps="Suppliers · CRM · Employees (9 files)" count="hairline h-1, subtle track">
        <Bar track="h-1 overflow-hidden rounded-full bg-[var(--bg-surface-subtle)]" fill="h-full rounded-full bg-[#567FB2]" w={62} />
      </Variant>
    </Family>
  );
}

function Checkboxes() {
  const [c1, setC1] = useState(true);
  const [c2, setC2] = useState(true);
  const [c3, setC3] = useState(true);
  const [c4, setC4] = useState(true);
  return (
    <Family id="checkboxes" title="Checkbox" note="winner: CB-3" elected>
      <Variant vid="CB-1" apps="Contacts · Suppliers · Projects (~22 sites)" count="native, accent only">
        <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" defaultChecked className="accent-[var(--bg-inverted)]" />Include archived</label>
      </Variant>
      <Variant vid="CB-2" apps="Roles · Calendar · HR · CRM (~17 sites)" count="native 16px, bordered, semantic accent">
        <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" defaultChecked className="h-4 w-4 rounded border-[var(--border-subtle)] bg-[var(--bg-surface)] accent-emerald-500 cursor-pointer" />Can view</label>
      </Variant>
      <Variant vid="CB-3" apps="To-do · Calendar pickers" count="custom square, inverted mono fill" elected>
        <button onClick={() => setC1(!c1)} className="inline-flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
          <span className={`h-4 w-4 rounded-[5px] border flex items-center justify-center shrink-0 ${c1 ? "bg-[var(--bg-inverted)] border-[var(--bg-inverted)] text-[var(--bg-primary)]" : "border-[var(--border-strong)] text-transparent"}`}><CheckIcon className="h-3 w-3" /></span>
          Assign to me
        </button>
      </Variant>
      <Variant vid="CB-4" apps="Projects · CRM tasks" count="round emerald done-toggle">
        <button onClick={() => setC2(!c2)} className="inline-flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
          <span className={`h-4 w-4 shrink-0 rounded-full border flex items-center justify-center transition-colors ${c2 ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--border-color)] text-transparent hover:border-emerald-400"}`}><CheckIcon className="h-2.5 w-2.5" /></span>
          Task done
        </button>
      </Variant>
      <Variant vid="CB-5" apps="Database Visual Library · Catalogs" count="20px selection tick, accent fill">
        <button onClick={() => setC3(!c3)} className="inline-flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${c3 ? "border-[#567FB2] bg-[#567FB2] text-white" : "border-[var(--border-color)] text-transparent"}`}><CheckIcon className="h-3 w-3" /></span>
          Select asset
        </button>
        <button onClick={() => setC4(!c4)} className="inline-flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${c4 ? "border-[#567FB2] bg-[#567FB2] text-white" : "border-[var(--border-color)] text-transparent"}`}><CheckIcon className="h-3 w-3" /></span>
          Select page
        </button>
      </Variant>
    </Family>
  );
}

function EmptyStates() {
  return (
    <Family id="empty" title="Empty State" note="winner: ES-3" elected>
      <Variant vid="ES-1" apps="Products · Employees · CRM · Roles" count="boxed p-16 card + CTA">
        <div className="w-full bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-10 text-center">
          <UsersIcon size={40} className="text-[var(--text-barely)] mx-auto mb-4" />
          <p className="text-[var(--text-dim)] text-[14px] font-medium">No products yet</p>
          <p className="text-[var(--text-ghost)] text-[13px] mt-1">Add your first product to start the catalog</p>
          <button className="inline-flex items-center gap-2 mt-4 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all"><PlusIcon className="h-4 w-4" /> Add Product</button>
        </div>
      </Variant>
      <Variant vid="ES-2" apps="HR (48 sites) · Management · To-do · Notes" count="bare stack, badge glyph — most used">
        <div className="w-full flex flex-col items-center justify-center py-10 text-center">
          <div className="h-12 w-12 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center mb-3"><FileTextIcon size={20} className="text-[var(--text-dim)]" /></div>
          <p className="text-[14px] font-medium text-[var(--text-muted)] mb-1">No leave requests</p>
          <p className="text-[12px] text-[var(--text-dim)]">Requests you submit will appear here</p>
        </div>
      </Variant>
      <Variant vid="ES-3" apps="Database · Translator · Finance (14 modules)" count="dashed 'waiting slot'" elected>
        <div className="w-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-10 text-center">
          <LayoutGridIcon className="h-7 w-7 text-[var(--text-dim)]" />
          <p className="mt-3 text-[13px] font-medium text-[var(--text-muted)]">No collections yet</p>
          <p className="mt-1 text-[12px] text-[var(--text-dim)]">Create a collection to organize assets</p>
        </div>
      </Variant>
      <Variant vid="ES-4" apps="Finance workspace · Inventory panels" count="compact drawer-scale">
        <div className="w-full flex flex-col items-center justify-center px-4 py-8 text-center">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"><SearchIcon className="h-4 w-4" /></div>
          <p className="text-[12.5px] font-medium">Nothing here</p>
          <p className="mt-1 text-[10.5px] text-[var(--text-dim)]">Items will appear when added</p>
        </div>
      </Variant>
    </Family>
  );
}

function SectionHeaders() {
  return (
    <Family id="sections" title="Section Header" note="winner: SH-3" elected>
      <Variant vid="SH-1" apps="Home · Discuss · KDS kit" count="uppercase eyebrow + hairline" wide>
        <div className="w-full flex items-center gap-2.5">
          <span className="text-[11px] font-semibold tracking-[1px] uppercase text-[var(--text-ghost)]">Data systems</span>
          <span className="flex-1 h-px bg-[var(--bg-inverted)]/[0.06]" />
        </div>
      </Variant>
      <Variant vid="SH-2" apps="Products catalog groups" count="bold title + count pill + hairline" wide>
        <div className="w-full flex items-center gap-2.5">
          <span className="text-[16px] font-semibold tracking-tight text-[var(--text-primary)]">Spreading Machines</span>
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">20</span>
          <span className="flex-1 h-px bg-[var(--border-subtle)] ml-1" />
        </div>
      </Variant>
      <Variant vid="SH-3" apps="Employees · ProductForm · Suppliers (form sections)" count="icon chip + title + desc + rule" wide elected>
        <div className="w-full flex items-start gap-3 pb-4 border-b border-[var(--border-faint)]">
          <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><UsersIcon size={16} /></div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-[var(--text-primary)] leading-tight">Personal Information</p>
            <p className="text-[12px] text-[var(--text-dim)] mt-0.5">Identity, contact and personal details</p>
          </div>
        </div>
      </Variant>
      <Variant vid="SH-4" apps="Finance · Suppliers · ERP (21 exact sites)" count="wide-tracked kicker over title" wide>
        <div className="w-full">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">Treasury</p>
          <p className="mt-1 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">Cash position</p>
        </div>
      </Variant>
    </Family>
  );
}

function DangerBallot() {
  return (
    <Family id="danger" title="Danger / Delete button — OPEN BALLOT" note="pick ONE — D-1, D-2 or D-3">
      <Variant vid="D-1" apps="Products · Catalogs · Database delete-confirms (~13 sites)" count="tinted red, matches R-2 box">
        <button className="h-10 px-6 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[13px] font-semibold flex items-center gap-2 hover:bg-red-500/30 transition-all">Delete product</button>
      </Variant>
      <Variant vid="D-2" apps="Employees · HR (~18 sites)" count="solid saturated red">
        <button className="h-9 px-4 rounded-lg bg-red-500 text-white text-[12.5px] font-semibold flex items-center gap-2 hover:bg-red-600 transition-colors">Delete employee</button>
      </Variant>
      <Variant vid="D-3" apps="Projects · Notes · To-do row actions" count="ghost — transparent until hover">
        <button className="h-9 px-3 rounded-lg text-rose-400 hover:bg-rose-500/10 text-[12px] font-semibold flex items-center gap-1.5 transition-colors">Remove</button>
      </Variant>
    </Family>
  );
}

/* ═══════════════ page ═══════════════ */

export default function ElementElection() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-6 md:px-10 py-10 max-w-[1200px] mx-auto">
      <h1 className="text-[26px] font-bold tracking-tight mb-1">KDS — Element Election</h1>
      <p className="text-[12px] text-[var(--text-dim)] mb-2 max-w-2xl">
        Green = elected canon (owner, 2026-08-02): E-set + R-2 · PILL-1 · PB-2 · CB-3 · ES-3 · SH-3.
        Open ballot below: DANGER button — reply with one id (e.g. &quot;D-1&quot;).
      </p>
      <p className="text-[11px] text-[var(--text-ghost)] mb-10">
        Already law (never on the ballot): toggles emerald+white · slider/bar fill Hub Blue ·
        modal backdrop dim+blur · hover ring physics · PageHeader anatomy.
      </p>
      <Elected />
      <DangerBallot />
      <BtnRunoff />
      <Pills />
      <ProgressBars />
      <Checkboxes />
      <EmptyStates />
      <SectionHeaders />
    </div>
  );
}
