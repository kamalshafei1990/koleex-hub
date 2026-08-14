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
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

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
          <span className={`h-4 w-4 rounded-[5px] border flex items-center justify-center shrink-0 ${c1 ? "bg-[var(--bg-inverted)] border-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border-[var(--border-strong)] text-transparent"}`}><CheckIcon className="h-3 w-3" /></span>
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
    <Family id="danger" title="Danger / Delete button" note="winner: D-1" elected>
      <Variant vid="D-1" apps="Products · Catalogs · Database delete-confirms (~13 sites)" count="tinted red, matches R-2 box" elected>
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

function Toasts() {
  return (
    <Family id="toasts" title="Toast / Notification" note="winner: TS-2" elected>
      <Variant vid="TS-1" apps="Roles · Management · Discuss · PWA (4 sites)" count="inverted solid pill — de-facto house style">
        <div className="px-4 py-2.5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-medium shadow-lg flex items-center gap-2"><CheckIcon className="h-3.5 w-3.5" /> Saved successfully</div>
      </Variant>
      <Variant vid="TS-2" apps="Inbox · Commercial Policy" count="semantic tinted glass" elected>
        <div className="px-4 py-2.5 rounded-xl border shadow-lg text-[12.5px] font-semibold flex items-center gap-2 bg-emerald-500/15 border-emerald-500/30 text-emerald-300"><CheckIcon className="h-3.5 w-3.5" /> Request approved</div>
        <div className="px-4 py-2.5 rounded-xl border shadow-lg text-[12.5px] font-semibold flex items-center gap-2 bg-red-500/15 border-red-500/30 text-red-300">Failed to save</div>
      </Variant>
      <Variant vid="TS-3" apps="Expenses (UndoToast component)" count="elevated card + Undo + countdown">
        <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--bg-secondary)] px-3.5 py-2 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.7)]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
          <span className="text-[12px] text-[var(--text-secondary)]">Expense deleted</span>
          <button className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">Undo</button>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] bg-white/[0.04]"><span className="block h-full w-2/3 bg-white/40" /></span>
        </div>
      </Variant>
      <Variant vid="TS-4" apps="QA lightbox HUD" count="black glass capsule">
        <div className="rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[12px] font-medium text-white shadow-lg backdrop-blur-md">3 / 8</div>
      </Variant>
    </Family>
  );
}

function Menus() {
  return (
    <Family id="menus" title="Dropdown / Context Menu" note="winner: MN-4" elected>
      <Variant vid="MN-1" apps="Discuss right-click menus" count="padded shell, rounded item pills">
        <div className="min-w-[220px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-2xl p-1.5">
          <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium text-start transition-colors text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">Pin conversation</button>
          <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium text-start transition-colors text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">Mark unread</button>
          <div className="my-1 border-t border-[var(--border-subtle)]" />
          <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium text-start transition-colors text-red-400 hover:bg-red-500/10">Delete</button>
        </div>
      </Variant>
      <Variant vid="MN-2" apps="Accounts · Expenses · CRM · Inventory (~8 sites)" count="edge-to-edge full-bleed rows">
        <div className="w-56 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden">
          <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors text-left">Edit account</button>
          <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors text-left">Duplicate</button>
          <div className="h-px bg-[var(--border-subtle)]" />
          <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left">Revoke access</button>
        </div>
      </Variant>
      <Variant vid="MN-4" apps="Contacts · ProductForm · Notes… (~45 sites)" count="combobox listbox — highest volume" elected>
        <div className="w-64 max-h-52 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
          {["Juki Corporation", "Jack Sewing Machine", "Brother Industries"].map((x, i) => (
            <button key={x} className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${i === 0 ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"}`}>{x}</button>
          ))}
        </div>
      </Variant>
    </Family>
  );
}

function Tooltips() {
  return (
    <Family id="tooltips" title="Tooltip" note="winner: TP-1" elected>
      <Variant vid="TP-1" apps="GuidanceTip — 14 files (bilingual help system)" count="slate panel, 320px, EN/中文" elected>
        <div className="w-[300px] rounded-lg px-3 py-2.5 text-[11px] leading-relaxed text-white border border-white/[0.18] shadow-2xl" style={{ background: "#1f2937" }}>
          <p className="font-bold text-[9px] tracking-[0.08em] mb-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>MARKET BAND</p>
          Controls which price band this market belongs to.
          <p className="mt-1.5" lang="zh">控制该市场所属的价格区间。</p>
        </div>
      </Variant>
      <Variant vid="TP-2" apps="Notes editor" count="inverted chip, 500ms delay">
        <div className="inline-block whitespace-nowrap rounded-md bg-[var(--bg-inverted)] px-2 py-1 text-[10.5px] font-medium text-[var(--text-inverted)] shadow-lg">Bold (⌘B)</div>
      </Variant>
      <Variant vid="TP-4" apps="Landed Cost · Contacts (ad-hoc)" count="wrapping inverted panel">
        <div className="w-48 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] leading-snug px-2.5 py-2 shadow-xl">Duty is calculated on CIF value plus applicable surcharges.</div>
      </Variant>
    </Family>
  );
}

function Modals() {
  return (
    <Family id="modals" title="Modal Shell" note="winner: MD-4" elected>
      <Variant vid="MD-1" apps="Products form modals · Purchase · global dialog host (9 files)" count="px-6 chrome, 16px bold, ruled header+footer">
        <div className="w-full max-w-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden">
          <div className="flex items-start justify-between px-6 py-5 border-b border-[var(--border-subtle)]">
            <div><p className="text-[16px] font-bold text-[var(--text-primary)]">Create brand</p><p className="text-[12px] text-[var(--text-dim)] mt-0.5">Add a new brand to the catalog</p></div>
            <span className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-ghost)]">✕</span>
          </div>
          <div className="px-6 py-5 text-[13px] text-[var(--text-muted)]">Body content…</div>
          <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
            <button className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)]">Cancel</button>
            <button className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold shadow-lg">Save</button>
          </div>
        </div>
      </Variant>
      <Variant vid="MD-3" apps="Finance · Sales · Discuss (~8 files)" count="compact px-5, 14px title">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
            <div><p className="text-[14px] font-semibold">Add bank account</p><p className="mt-0.5 text-[11px] text-[var(--text-dim)]">Connected to reconciliation</p></div>
            <span className="rounded-lg p-1.5 text-[var(--text-secondary)] text-[11px]">✕</span>
          </div>
          <div className="px-5 py-4 text-[13px] text-[var(--text-muted)]">Body content…</div>
          <div className="border-t border-[var(--border-subtle)] px-5 py-3 flex items-center justify-end gap-2">
            <button className="h-9 px-4 rounded-lg text-[12px] font-medium text-[var(--text-dim)]">Cancel</button>
            <button className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold">Save</button>
          </div>
        </div>
      </Variant>
      <Variant vid="MD-4" apps="Suppliers · HR · Employees · Quotations (~14 files)" count="chromeless padded card, no rules" elected>
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <p className="text-[14px] font-semibold text-[var(--text-primary)]">Log negotiation round</p>
          <p className="text-[13px] text-[var(--text-muted)]">Body content…</p>
          <div className="flex items-center gap-3">
            <button className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold">Save</button>
            <button className="text-[12px] text-[var(--text-dim)]">Cancel</button>
          </div>
        </div>
      </Variant>
      <Variant vid="MD-5" apps="Inventory drawer · CRM · PageNavPopup" count="mobile fullscreen → desktop island, icon-chip header">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-center"><LayoutGridIcon className="h-4 w-4 text-[var(--text-dim)]" /></span>
              <div><p className="text-[15px] font-semibold leading-none tracking-tight">Internal item</p><p className="mt-1 text-[11.5px] text-[var(--text-dim)]">SKU KX-00812</p></div>
            </div>
            <span className="text-[var(--text-dim)]">✕</span>
          </div>
          <div className="px-5 py-4 text-[13px] text-[var(--text-muted)]">Body content…</div>
        </div>
      </Variant>
    </Family>
  );
}

function Confirms() {
  return (
    <Family id="confirms" title="Delete Confirm" note="winner: CF-1" elected>
      <Variant vid="CF-1" apps="Expenses · Finance orders" count="compact hairline, no header bar" elected>
        <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden">
          <div className="px-4 py-3.5">
            <p className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">Delete this expense?</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-dim)]">This cannot be undone.</p>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.05] px-4 py-3">
            <button className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)]">Cancel</button>
            <button className="rounded-lg border border-rose-500/[0.30] bg-rose-500/[0.10] px-3 py-1.5 text-[12px] font-medium text-rose-300">Delete</button>
          </div>
        </div>
      </Variant>
      <Variant vid="CF-3" apps="Employees · To-do · product view (~4 files)" count="icon-led alert card">
        <div className="w-full max-w-sm bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-2xl">
          <div className="flex items-start gap-3 mb-4">
            <span className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 shrink-0">!</span>
            <div><p className="text-[15px] font-bold">Delete employee?</p><p className="text-[12.5px] text-[var(--text-dim)] mt-1 leading-relaxed">The record and its history will be removed.</p></div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button className="h-9 px-4 rounded-lg border border-[var(--border-subtle)] text-[12.5px] font-medium text-[var(--text-dim)]">Cancel</button>
            <button className="h-9 px-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-[12.5px] font-semibold">Delete</button>
          </div>
        </div>
      </Variant>
      <Variant vid="CF-2" apps="Products admin + all dialog.confirm() calls" count="MD-1 shell at max-w-md">
        <div className="w-full max-w-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--border-subtle)]"><p className="text-[16px] font-bold">Delete product?</p></div>
          <div className="px-6 py-5 text-[13px] text-[var(--text-muted)] leading-relaxed">This will remove the product from the catalog.</div>
          <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
            <button className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)]">Cancel</button>
            <button className="h-10 px-6 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[13px] font-semibold">Delete</button>
          </div>
        </div>
      </Variant>
    </Family>
  );
}

function Drawers() {
  return (
    <Family id="drawers" title="Drawer / Side Panel" note="winner: DR-1" elected>
      <Variant vid="DR-1" apps="Approvals · Payments · Attachments" count="eyebrow header, sectioned footer" elected>
        <div className="w-full max-w-sm h-64 flex flex-col border border-[var(--border-subtle)] bg-[var(--bg-primary)] rounded-xl overflow-hidden">
          <div className="flex items-start gap-3 border-b border-white/[0.05] px-4 py-3">
            <div className="flex-1"><p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Payment review</p><p className="mt-0.5 truncate text-[14px] font-medium text-[var(--text-primary)]">PO-2231 · Juki</p></div>
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-[var(--text-dim)] text-[11px]">✕</span>
          </div>
          <div className="flex-1 px-4 py-4 text-[12px] text-[var(--text-dim)]">Body…</div>
          <div className="border-t border-white/[0.05] px-4 py-3"><button className="w-full h-9 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold">Approve</button></div>
        </div>
      </Variant>
      <Variant vid="DR-2" apps="Finance setup · Home · Inventory (4 copies)" count="14px header + rule, plain body">
        <div className="w-full max-w-sm h-64 flex flex-col border border-[var(--border-subtle)] bg-[var(--bg-primary)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
            <div><p className="text-[14px] font-semibold">Edit account</p><p className="text-[11px] text-[var(--text-dim)]">Chart of accounts</p></div>
            <span className="text-[var(--text-dim)] text-[20px] leading-none">×</span>
          </div>
          <div className="flex-1 p-4 text-[12px] text-[var(--text-dim)]">Body…</div>
          <div className="border-t border-[var(--border-subtle)] px-4 py-3 flex justify-end"><button className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold">Save</button></div>
        </div>
      </Variant>
      <Variant vid="DR-4" apps="Database Visual Library" count="tabbed header, mono code line">
        <div className="w-full max-w-sm h-64 flex flex-col border border-[var(--border-subtle)] bg-[var(--bg-card)] rounded-xl overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] px-5 pt-4">
            <p className="truncate text-[15px] font-semibold">needle-icon.svg</p>
            <p className="font-mono text-[10.5px] px-0 text-[var(--text-dim)]">VL-04471</p>
            <div className="mt-3 flex gap-4 text-[12px]">
              <span className="relative pb-2 text-[var(--text-primary)] font-medium">Details<span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--text-primary)]" /></span>
              <span className="pb-2 text-[var(--text-dim)]">Usage</span>
              <span className="pb-2 text-[var(--text-dim)]">History</span>
            </div>
          </div>
          <div className="flex-1 px-5 py-4 text-[12px] text-[var(--text-dim)]">Body…</div>
        </div>
      </Variant>
    </Family>
  );
}

const TROWS = [
  ["KX-00812", "Lockstitch machine", "48", "Active"],
  ["KX-00344", "Overlock 4-thread", "12", "Draft"],
  ["KX-01277", "Spreading machine", "6", "Active"],
];

function Tables() {
  return (
    <Family id="tables" title="Data Table" note="winner: TBL-6" elected>
      <Variant vid="TBL-1" apps="Inventory · Finance · Purchase (16 tables)" count="ERP micro-table — house default" wide>
        <div className="w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
          <table className="min-w-full text-[12.5px]">
            <thead><tr className="border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
              <th className="px-3 py-2.5 text-left font-semibold">SKU</th><th className="px-3 py-2.5 text-left font-semibold">Item</th><th className="px-3 py-2.5 text-right font-semibold">Qty</th><th className="px-3 py-2.5 text-left font-semibold">Status</th>
            </tr></thead>
            <tbody>{TROWS.map((r) => (
              <tr key={r[0]} className="cursor-pointer border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)]">
                <td className="px-3 py-3 font-mono text-[var(--text-dim)]">{r[0]}</td><td className="px-3 py-3">{r[1]}</td><td className="px-3 py-3 text-right tabular-nums">{r[2]}</td><td className="px-3 py-3">{r[3]}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </Variant>
      <Variant vid="TBL-4" apps="Accounts · Price Calculator · CRM" count="filled thead + divide-y in rounded-2xl" wide>
        <div className="w-full bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[var(--bg-surface-subtle)]/50"><tr className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">
              <th className="px-4 py-3">SKU</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">{TROWS.map((r) => (
              <tr key={r[0]} className="hover:bg-[var(--bg-surface-subtle)]/60 transition-colors">
                <td className="px-4 py-3 font-mono text-[var(--text-dim)]">{r[0]}</td><td className="px-4 py-3">{r[1]}</td><td className="px-4 py-3 tabular-nums">{r[2]}</td><td className="px-4 py-3">{r[3]}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </Variant>
      <Variant vid="TBL-5" apps="Commercial Policy knowledge (82 tables)" count="sentence-case header, filled, no hover" wide>
        <div className="w-full overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border-subtle)" }}>
          <table className="w-full text-[13px]">
            <thead><tr style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-secondary)" }}>Sku</th><th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-secondary)" }}>Item</th><th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-secondary)" }}>Qty</th><th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-secondary)" }}>Status</th>
            </tr></thead>
            <tbody>{TROWS.map((r) => (
              <tr key={r[0]} style={{ borderBottom: "1px solid var(--border-faint)" }}>
                <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>{r[0]}</td><td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>{r[1]}</td><td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>{r[2]}</td><td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>{r[3]}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </Variant>
      <Variant vid="TBL-6" apps="Customers · Suppliers server lists" count="sticky sentence-case header" wide elected>
        <div className="w-full" style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["SKU", "Item", "Qty", "Status"].map((h) => (
              <th key={h} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", fontSize: 13, textAlign: "start", fontWeight: 600, color: "var(--text-secondary)", background: "var(--bg-surface)" }}>{h}</th>
            ))}</tr></thead>
            <tbody>{TROWS.map((r) => (
              <tr key={r[0]} style={{ cursor: "pointer" }}>{r.map((c, j) => (
                <td key={j} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", fontSize: 13 }}>{c}</td>
              ))}</tr>))}</tbody>
          </table>
        </div>
      </Variant>
    </Family>
  );
}

function ListRows() {
  return (
    <Family id="rows" title="List Row (non-table)" note="winner: ROW-4" elected>
      <Variant vid="ROW-1" apps="Purchase + Sales + Invoices (14 files)" count="grid row in divide-y card — dominant" wide>
        <div className="w-full bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
          {TROWS.map((r) => (
            <div key={r[0]} className="grid grid-cols-[120px_1fr_60px_auto] gap-4 items-center px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors cursor-pointer">
              <span className="font-mono text-[12px] text-[var(--text-dim)]">{r[0]}</span>
              <span className="text-[13px]">{r[1]}</span>
              <span className="text-[12px] tabular-nums text-right">{r[2]}</span>
              <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35">{r[3]}</span>
            </div>
          ))}
        </div>
      </Variant>
      <Variant vid="ROW-2" apps="Employees · Products list view" count="faux table: column header row + rows" wide>
        <div className="w-full bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
            <span className="w-[120px] shrink-0">SKU</span><span className="flex-1">Item</span><span className="w-[60px]">Qty</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {TROWS.map((r) => (
              <div key={r[0]} className="flex items-center gap-4 px-4 py-3.5 hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer">
                <span className="w-[120px] shrink-0 font-mono text-[12px] text-[var(--text-dim)]">{r[0]}</span>
                <span className="flex-1 text-[13px]">{r[1]}</span>
                <span className="w-[60px] text-[12px] tabular-nums">{r[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </Variant>
      <Variant vid="ROW-4" apps="Notes · Inbox sidebars" count="full-bleed + 3px selection bar" wide elected>
        <div className="w-full max-w-sm bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="relative px-4 py-3 border-b border-[var(--border-faint)] bg-[#567FB2]/[0.10]">
            <span className="absolute inset-y-0 start-0 w-[3px] bg-[#567FB2]" />
            <p className="text-[13px] font-medium">Q3 supplier review</p><p className="text-[11.5px] text-[var(--text-dim)] mt-0.5">Selected row</p>
          </div>
          <div className="px-4 py-3 border-b border-[var(--border-faint)] hover:bg-[var(--bg-surface)] transition-colors">
            <p className="text-[13px] font-medium">Spreading machine specs</p><p className="text-[11.5px] text-[var(--text-dim)] mt-0.5">Hover row</p>
          </div>
        </div>
      </Variant>
    </Family>
  );
}

function Loading() {
  return (
    <Family id="loading" title="Loading Language" note="winners: SK-1 + SP-1 (delegated)" elected>
      <Variant vid="SK-1" apps="15 route loading.tsx (shell kit)" count="token kit: surface-active bars in bordered blocks" elected>
        <div className="w-full max-w-sm space-y-2 animate-pulse">
          <div className="h-4 w-2/3 rounded bg-[var(--bg-surface-active)]" />
          <div className="h-24 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]" />
          <div className="h-4 w-1/3 rounded bg-[var(--bg-surface-active)]" />
        </div>
      </Variant>
      <Variant vid="SK-3" apps="ProductList · Accounts · Suppliers (~10 files)" count="surface-subtle blocks per-row">
        <div className="w-full max-w-sm flex items-center gap-4 animate-pulse">
          <div className="h-14 w-14 rounded-xl bg-[var(--bg-surface-subtle)] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-[var(--bg-surface-subtle)] rounded w-2/3" />
            <div className="h-3 bg-[var(--bg-surface-subtle)] rounded w-1/3" />
          </div>
        </div>
      </Variant>
      <Variant vid="SP-1" apps="SpinnerIcon — every inline site" count="Koleex orb, inline size" elected>
        <div className="flex items-center gap-3 text-[var(--text-dim)]">
          <SpinnerIcon size={20} />
          <span className="text-[12px]">Loading…</span>
        </div>
      </Variant>
      {/* SP-4, the CSS ring, is gone rather than shown greyed out: ui/Button and
          AppLaunchLink were its only callers and both render SpinnerIcon now, so
          a sample here would be the last copy of a shape the Hub no longer has. */}
      <Variant vid="SP-BAR" apps="PermissionGate (seen on every app open)" count="indeterminate mini bar">
        <div className="h-2 w-32 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden"><div className="h-full w-1/2 bg-[var(--bg-inverted)] animate-pulse" /></div>
      </Variant>
    </Family>
  );
}

function Avatars() {
  const A = ({ cls, style, ch }: { cls: string; style?: React.CSSProperties; ch: string }) => (
    <div className={cls} style={{ width: 40, height: 40, fontSize: 14, ...style }}>{ch}</div>
  );
  return (
    <Family id="avatars" title="Avatar Fallback" note="winner: AV-3" elected>
      <Variant vid="AV-1" apps="Discuss (9 sites)" count="neutral gradient + white initials">
        <A cls="rounded-full bg-gradient-to-br from-neutral-400 to-neutral-500 flex items-center justify-center text-white font-semibold" ch="KE" />
        <A cls="rounded-full bg-gradient-to-br from-neutral-300 to-neutral-600 flex items-center justify-center text-white font-semibold" ch="XZ" />
      </Variant>
      <Variant vid="AV-2" apps="Employees · HR · Management (~26 files)" count="token circle, bordered, dim initials">
        <A cls="rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center text-[var(--text-dim)] font-semibold" ch="KE" />
        <A cls="rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center text-[var(--text-dim)] font-semibold" ch="AL" />
      </Variant>
      <Variant vid="AV-3" apps="Header user chip · CRM owner" count="inverted solid mono" elected>
        <A cls="rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center font-semibold" ch="KE" />
      </Variant>
      <Variant vid="AV-4" apps="Inbox · Discuss thread · Customer chat" count="saturated hue gradients (off-brand)">
        <A cls="rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold" ch="KE" />
        <A cls="rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold" ch="AL" />
        <A cls="rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold" ch="XZ" />
      </Variant>
    </Family>
  );
}

function DatePickers() {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <Family id="datepicker" title="Date Picker" note="winner: DP-1 custom — internal style ballot below (DPS)" elected>
      <Variant vid="DP-1" apps="To-do · HR Leave (custom DatePicker)" count="themed calendar, Today/Clear footer" wide elected>
        <div className="flex flex-wrap gap-6 items-start">
          <button className="w-[220px] h-10 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-focus)] text-[13px] flex items-center justify-between gap-2 text-start">
            <span className="text-[var(--text-primary)]">Aug 2, 2026</span>
            <span className="text-[var(--text-dim)]">📅</span>
          </button>
          <div className="w-[280px] p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between mb-2">
              <span className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)]"><AngleLeftIcon className="h-3.5 w-3.5" /></span>
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">August 2026</span>
              <span className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)]"><AngleRightIcon className="h-3.5 w-3.5" /></span>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-0.5">{["S","M","T","W","T","F","S"].map((d, i) => <span key={i} className="h-7 flex items-center justify-center text-[10px] font-semibold text-[var(--text-ghost)] uppercase">{d}</span>)}</div>
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((d) => (
                <span key={d} className={`h-8 rounded-lg text-[12px] font-medium flex items-center justify-center ${d === 2 ? "bg-[#567FB2] text-white" : "text-[var(--text-primary)]"}`}>{d}</span>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[11px] font-semibold text-[#7FA9D6]">Today</span>
              <span className="text-[11px] font-medium text-[var(--text-dim)]">Clear</span>
            </div>
          </div>
        </div>
      </Variant>
      <Variant vid="DP-2" apps="Calendar · Invoices · CRM (85 inputs)" count="native OS calendar on the field">
        <input type="date" defaultValue="2026-08-02" className="w-[220px] h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors" />
      </Variant>
    </Family>
  );
}

function FilterChips() {
  return (
    <Family id="filterchips" title="Filter / Tag Chip" note="winner: FC-1" elected>
      <Variant vid="FC-1" apps="Products ACTIVE filters row" count="h-7 pill, focus border, round × button" elected>
        <span className="inline-flex items-center gap-1.5 h-7 pl-3 pr-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-focus)] text-[11px] font-medium text-[var(--text-primary)]">Division: garment machinery<span className="h-5 w-5 rounded-full flex items-center justify-center text-[var(--text-dim)] text-[14px] leading-none">×</span></span>
      </Variant>
      <Variant vid="FC-2" apps="Contacts tags (8 sites)" count="text-xs, border-color">
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">supplier<span className="text-[var(--text-dim)]">×</span></span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">garment<span className="text-[var(--text-dim)]">×</span></span>
      </Variant>
      <Variant vid="FC-3" apps="Products form sections" count="h-7 borderless surface">
        <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[var(--bg-surface)] text-[12px] text-[var(--text-muted)]">stainless<span className="text-[var(--text-dim)]">×</span></span>
        <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[var(--bg-surface)] text-[12px] text-[var(--text-muted)]">220V<span className="text-[var(--text-dim)]">×</span></span>
      </Variant>
      <Variant vid="FC-4" apps="Notes #tags" count="h-6 compact, red remove hover">
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">#meeting<span className="text-[var(--text-dim)]">×</span></span>
      </Variant>
    </Family>
  );
}

function CalendarDemo({ sel, selCls, cellCls, shell }: { sel: number; selCls: string; cellCls: string; shell: string }) {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <div className={`w-[264px] p-3 ${shell}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)]"><AngleLeftIcon className="h-3.5 w-3.5" /></span>
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">August 2026</span>
        <span className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)]"><AngleRightIcon className="h-3.5 w-3.5" /></span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">{["S","M","T","W","T","F","S"].map((d, i) => <span key={i} className="h-6 flex items-center justify-center text-[10px] font-semibold text-[var(--text-ghost)] uppercase">{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => (
          <span key={d} className={`h-8 text-[12px] font-medium flex items-center justify-center ${cellCls} ${d === sel ? selCls : d === 14 ? "text-[#7FA9D6] ring-1 ring-inset ring-[#567FB2]/40 " + cellCls : "text-[var(--text-primary)]"}`}>{d}</span>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)]">
        <span className="text-[11px] font-semibold text-[#7FA9D6]">Today</span>
        <span className="text-[11px] font-medium text-[var(--text-dim)]">Clear</span>
      </div>
    </div>
  );
}

function DatePickerStyles() {
  const shell = "rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[0_12px_40px_rgba(0,0,0,0.45)]";
  return (
    <Family id="dps" title="Date Picker — internal style" note="winner: DPS-4" elected>
      <Variant vid="DPS-1" apps="current ui/DatePicker" count="Hub Blue square selection">
        <CalendarDemo sel={2} selCls="bg-[#567FB2] text-white rounded-lg" cellCls="rounded-lg" shell={shell} />
      </Variant>
      <Variant vid="DPS-2" apps="proposal — matches your mono picks (CB-3/AV-3)" count="inverted mono circle selection">
        <CalendarDemo sel={2} selCls="bg-[var(--bg-inverted)] text-[var(--text-inverted)] rounded-full" cellCls="rounded-full" shell={shell} />
      </Variant>
      <Variant vid="DPS-3" apps="proposal" count="Hub Blue circle selection">
        <CalendarDemo sel={2} selCls="bg-[#567FB2] text-white rounded-full" cellCls="rounded-full" shell={shell} />
      </Variant>
      <Variant vid="DPS-4" apps="proposal" count="Hub Blue gradient square + soft ring" elected>
        <CalendarDemo sel={2} selCls="bg-gradient-to-br from-[#567FB2] to-[#7FA9D6] text-white rounded-lg shadow-[0_0_0_3px_rgba(86,127,178,0.2)]" cellCls="rounded-lg" shell={shell} />
      </Variant>
    </Family>
  );
}

function PaginationBallot() {
  return (
    <Family id="pagination" title="Pagination" note="winner: PG-1" elected>
      <Variant vid="PG-1" apps="Customers · Suppliers server lists" count="Prev / Page N of M / Next" wide elected>
        <div className="w-full flex items-center justify-between gap-3 text-[13px] text-[var(--text-secondary)]">
          <span>121 customers</span>
          <span className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px]">Prev</button>
            <span>Page 2 / 7</span>
            <button className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px]">Next</button>
          </span>
        </div>
      </Variant>
      <Variant vid="PG-2" apps="Catalogs PDF viewer" count="icon nav + page number input">
        <div className="flex items-center gap-0.5 rounded-xl bg-[var(--bg-inverted)]/[0.06] border border-[var(--border-subtle)] px-1 py-1">
          <button className="h-8 min-w-8 px-2 rounded-lg flex items-center justify-center text-[var(--text-primary)]"><AngleLeftIcon className="h-4 w-4" /></button>
          <input className="h-7 w-10 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-center text-[12px] tabular-nums outline-none" defaultValue="3" />
          <span className="text-[12px] text-[var(--text-dim)] tabular-nums px-1">/ 12</span>
          <button className="h-8 min-w-8 px-2 rounded-lg flex items-center justify-center text-[var(--text-primary)]"><AngleRightIcon className="h-4 w-4" /></button>
        </div>
      </Variant>
      <Variant vid="PG-4" apps="Database Visual Library · Catalogs" count="Load more / infinite scroll">
        <button className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-[12.5px] font-medium text-[var(--text-muted)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]">Load 60 more</button>
      </Variant>
    </Family>
  );
}

function Dropzones() {
  return (
    <Family id="uploads" title="File Upload / Dropzone" note="winner: UP-1" elected>
      <Variant vid="UP-1" apps="ProductForm media · HR · Database (~12 sites)" count="dashed panel, token hover" wide elected>
        <div className="w-full max-w-md border border-dashed rounded-xl py-8 text-center cursor-pointer transition-all border-[var(--border-subtle)] hover:border-[var(--border-focus)]/60 hover:bg-[var(--bg-surface-subtle)]/30">
          <div className="h-10 w-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] mx-auto mb-2 flex items-center justify-center"><PlusIcon className="h-4 w-4 text-[var(--text-dim)]" /></div>
          <p className="text-[11px] font-medium text-[var(--text-dim)]">Drop files here or click to upload</p>
          <p className="text-[10px] text-[var(--text-ghost)] mt-0.5">PNG, JPG, PDF up to 10MB</p>
        </div>
      </Variant>
      <Variant vid="UP-1b" apps="Catalogs (blue accent dialect)" count="border-2 dashed, blue drag state">
        <div className="w-full max-w-md py-8 rounded-xl border-2 border-dashed bg-[var(--bg-surface)] flex flex-col items-center gap-2 transition-all cursor-pointer border-[#567FB2] bg-[#567FB2]/5">
          <PlusIcon className="h-5 w-5 text-[#7FA9D6]" />
          <p className="text-[11px] font-medium text-[var(--text-muted)]">Drop to upload (drag state shown)</p>
        </div>
      </Variant>
      <Variant vid="UP-4" apps="Product docs · QA · Catalogs (~6 sites)" count="solid chip button (no dashes)">
        <span className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer transition-colors"><PlusIcon className="h-3.5 w-3.5" /> Attach file</span>
      </Variant>
    </Family>
  );
}

function Accordions() {
  const [a1, setA1] = useState(true);
  const [a2, setA2] = useState(true);
  const [a3, setA3] = useState(true);
  const Chev = ({ open }: { open: boolean }) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" className={`text-[var(--text-ghost)] transition-transform duration-300 ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
  );
  return (
    <Family id="accordions" title="Collapsible Section" note="winner: AC-2" elected>
      <Variant vid="AC-1" apps="ProductForm (19 sections) · To-do" count="card + icon tile + border-t body" wide>
        <div className="w-full bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
          <button onClick={() => setA1(!a1)} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-[var(--bg-surface-subtle)]/50 transition-colors">
            <span className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)]"><LayoutGridIcon className="h-4 w-4" /></span>
            <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight flex-1 text-left">Technical Specifications</span>
            <span className="text-[10px] font-medium text-[var(--text-ghost)] bg-[var(--bg-surface)] px-2 py-0.5 rounded-full">12 fields</span>
            <Chev open={a1} />
          </button>
          {a1 && <div className="px-6 pb-6 pt-2 border-t border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)]">Section body…</div>}
        </div>
      </Variant>
      <Variant vid="AC-2" apps="Suppliers · Employees · Contacts (~15 sections)" count="tinted header strip + preview" wide elected>
        <div className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
          <button onClick={() => setA2(!a2)} className={`flex w-full items-center justify-between gap-3 bg-[var(--bg-surface-subtle)]/30 px-5 py-3 text-start cursor-pointer hover:bg-[var(--bg-surface-subtle)]/60 transition-colors ${a2 ? "border-b border-[var(--border-subtle)]" : ""}`}>
            <span className="flex items-center gap-3 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"><UsersIcon size={15} /></span>
              <span className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)] truncate">Contact Persons</span>
              {!a2 && <span className="ms-1 truncate text-[11px] text-[var(--text-faint)]">3 contacts</span>}
            </span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" className={`text-[var(--text-faint)] transition-transform ${a2 ? "" : "-rotate-90 rtl:rotate-90"}`}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {a2 && <div className="px-5 py-4 text-[12px] text-[var(--text-dim)]">Section body…</div>}
        </div>
      </Variant>
      <Variant vid="AC-4" apps="Product customer preview" count="bare divider rows, eyebrow + title" wide>
        <div className="w-full border-b border-[var(--border-subtle)]">
          <button onClick={() => setA3(!a3)} className="group w-full flex items-center justify-between gap-3 py-5 text-left">
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Specifications</span>
              <span className="block text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">Machine details</span>
            </span>
            <Chev open={a3} />
          </button>
          {a3 && <div className="pb-7 -mt-1 text-[12px] text-[var(--text-dim)]">Section body…</div>}
        </div>
      </Variant>
    </Family>
  );
}

function ChoiceRows() {
  const [r1, setR1] = useState(0);
  const [r2, setR2] = useState(0);
  const [r3, setR3] = useState(0);
  return (
    <Family id="choices" title="Choice Rows (single-select with descriptions)" note="winner: RD-2 (delegated between RD-2/RD-4)" elected>
      <Variant vid="RD-2" apps="Settings sounds" count="iOS checkmark row, no chrome" elected>
        <div className="w-full max-w-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2">
          {["Chime", "Pulse"].map((l, i) => (
            <button key={l} onClick={() => setR1(i)} data-kx-keep-hover="" className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-start transition-colors hover:bg-[var(--bg-surface-hover)] ${i === 0 ? "border-b border-[var(--border-faint)]" : ""}`}>
              <span><span className={`block truncate text-[13px] ${r1 === i ? "font-semibold" : ""} text-[var(--text-primary)]`}>{l}</span><span className="mt-0.5 block text-[11px] text-[var(--text-dim)]">Notification tone</span></span>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">{r1 === i && <CheckIcon className="h-3.5 w-3.5 text-[var(--text-primary)]" />}</span>
            </button>
          ))}
        </div>
      </Variant>
      <Variant vid="RD-3" apps="Inventory usage scope" count="bordered card + native radio">
        <div className="w-full max-w-sm grid grid-cols-1 gap-1.5">
          {["Internal use", "Product-related"].map((l, i) => (
            <label key={l} onClick={() => setR2(i)} className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 ${r2 === i ? "border-[var(--text-primary)] bg-[var(--bg-surface)]" : "border-[var(--border-color)]"}`}>
              <input type="radio" checked={r2 === i} readOnly className="mt-0.5" />
              <span><span className="block text-[12px] font-medium text-[var(--text-primary)]">{l}</span><span className="block text-[10.5px] leading-relaxed text-[var(--text-dim)]">Controls where this item appears</span></span>
            </label>
          ))}
        </div>
      </Variant>
      <Variant vid="RD-4" apps="Expenses category picker" count="tile grid + trailing check">
        <div className="w-full max-w-sm grid grid-cols-2 gap-2">
          {["Logistics", "Marketing"].map((l, i) => (
            <button key={l} onClick={() => setR3(i)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] font-medium transition-all ${r3 === i ? "border-[#567FB2]/50 bg-[#567FB2]/10 text-[var(--text-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"}`}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--bg-surface)]"><LayoutGridIcon className="h-3.5 w-3.5" /></span>
              <span className="flex-1 truncate">{l}</span>
              {r3 === i && <CheckIcon className="h-3 w-3 shrink-0 opacity-80" />}
            </button>
          ))}
        </div>
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
        🏁 ELECTION COMPLETE — every element family has one elected canon (green). Next: element-first conformance sweeps.
      </p>
      <p className="text-[11px] text-[var(--text-ghost)] mb-10">
        Already law (never on the ballot): toggles emerald+white · slider/bar fill Hub Blue ·
        modal backdrop dim+blur · hover ring physics · PageHeader anatomy.
      </p>
      <Elected />
      <DangerBallot />
      <Modals />
      <Confirms />
      <Drawers />
      <Tables />
      <ListRows />
      <Loading />
      <Avatars />
      <DatePickers />
      <DatePickerStyles />
      <FilterChips />
      <PaginationBallot />
      <Dropzones />
      <Accordions />
      <ChoiceRows />
      <Toasts />
      <Menus />
      <Tooltips />
      <BtnRunoff />
      <Pills />
      <ProgressBars />
      <Checkboxes />
      <EmptyStates />
      <SectionHeaders />
    </div>
  );
}
