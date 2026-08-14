"use client";

/* ─────────────────────────────────────────────────────────────────
   APP HEADER — ten designs, from zero (owner ask, 2026-08-15:
   "redesign the apps header from zero … very good navigations and
   app icon and name and can be for aurora and core style").

   NOTHING HERE SHIPS. This is a ballot page, like /kds-lab/elements:
   the owner picks, and only then does PageHeader change.

   Every sample is built from TOKENS and the Aurora classes, never
   literals, so the skin switch alone shows both looks — that is the
   dual-skin requirement, not a second set of markup:
     · surfaces      var(--bg-secondary) / var(--bg-surface)
     · lines         var(--border-subtle) / var(--border-faint)
     · one accent    Hub Blue #567FB2 → #7FA9D6, nothing else
     · selected      .kx-seg-on   (never a solid inverted block)
     · hover         .kx-hover-glow — border colour only, no lift
     · rows          .kx-row-hl   (KDS-1 §2a)
   Canon references: kds-1.md §2 physics, §3 type ladder (10·11·12·13·
   14·16·18·22·26), aurora-design-canon C (materials), D (states).

   The ten differ by NAVIGATION MODEL, not by decoration — picking one
   is choosing how an app is moved through, and the visual treatment
   follows. Read the note under each id.
   ───────────────────────────────────────────────────────────────── */

import { useState } from "react";
import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import FilterIcon from "@/components/icons/ui/FilterIcon";
import MoreHorizontalIcon from "@/components/icons/ui/MoreHorizontalIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import MenuBurgerIcon from "@/components/icons/ui/MenuBurgerIcon";
import AppsIcon from "@/components/icons/ui/AppsIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

/* The sample app every design is dressed with, so ten headers are
   compared on identical content and only the design varies. */
const APP = {
  name: "Documents",
  sub: "Quotations, invoices and packing lists",
  tabs: ["All", "Quotations", "Invoices", "Packing lists", "Templates"],
};

/* ── ballot chrome ───────────────────────────────────────────────── */

function Sample({ id, title, model, best, children }: {
  id: string; title: string; model: string; best: string; children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[13px] font-bold tracking-wide text-[#7FA9D6]">{id}</span>
        <h2 className="text-[16px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
        <span className="text-[11px] text-[var(--text-dim)]">{model}</span>
      </div>
      {/* The frame stands in for the app viewport so each header is judged
          at the width it will actually live at, with content beneath it. */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        {children}
        <div className="px-5 pb-5 pt-4">
          <div className="h-2 w-40 rounded-full bg-[var(--text-primary)] opacity-[0.07]" />
          <div className="mt-2.5 h-2 w-64 rounded-full bg-[var(--text-primary)] opacity-[0.05]" />
          <div className="mt-2.5 h-2 w-52 rounded-full bg-[var(--text-primary)] opacity-[0.05]" />
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-dim)]">
        <span className="text-[var(--text-secondary)]">Best for:</span> {best}
      </p>
    </section>
  );
}

/* Shared atoms — one definition, so a difference between two samples is
   always a real design difference and never a drifted copy. */

function IconTile({ size = 40, radius = "rounded-xl" }: { size?: number; radius?: string }) {
  return (
    <span
      className={`${radius} flex shrink-0 items-center justify-center border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]`}
      style={{ height: size, width: size }}
    >
      <DocumentIcon className="h-[55%] w-[55%]" />
    </span>
  );
}

function Chrome({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      data-kx-keep-hover=""
      className="kx-hover-glow flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]"
    >
      {children}
    </button>
  );
}

function Primary({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 text-[12px] font-semibold text-[var(--text-inverted)]"
    >
      <PlusIcon className="h-3 w-3" /> {children}
    </button>
  );
}

function Field({ wide }: { wide?: boolean }) {
  return (
    <span className={`flex h-8 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 ${wide ? "flex-1" : "w-56"}`}>
      <SearchIcon className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" />
      <span className="truncate text-[12px] text-[var(--text-faint)]">Search documents…</span>
    </span>
  );
}

/* Tabs — three presentations of the SAME state, so the samples can be
   compared on navigation model rather than on tab styling. */

function PillTabs({ v, set, items = APP.tabs }: { v: number; set: (i: number) => void; items?: string[] }) {
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {items.map((t, i) => (
        <button
          key={t}
          type="button"
          onClick={() => set(i)}
          data-kx-keep-hover=""
          className={`h-7 shrink-0 rounded-lg px-2.5 text-[12px] font-medium transition-colors ${
            i === v
              ? "kx-seg-on text-[var(--text-primary)]"
              : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function UnderlineTabs({ v, set }: { v: number; set: (i: number) => void }) {
  return (
    <div className="flex min-w-0 items-center gap-5 overflow-x-auto">
      {APP.tabs.map((t, i) => (
        <button
          key={t}
          type="button"
          onClick={() => set(i)}
          data-kx-keep-hover=""
          className={`relative shrink-0 pb-2 text-[13px] transition-colors ${
            i === v ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-secondary)]"
          }`}
        >
          {t}
          {i === v && (
            <span
              className="absolute inset-x-0 -bottom-px h-[2px] rounded-full"
              style={{ background: "linear-gradient(90deg,#567FB2,#BCD8F0)" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

function SegmentTabs({ v, set }: { v: number; set: (i: number) => void }) {
  const items = APP.tabs.slice(0, 3);
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
      {items.map((t, i) => (
        <button
          key={t}
          type="button"
          onClick={() => set(i)}
          data-kx-keep-hover=""
          className={`h-7 rounded-lg px-3 text-[12px] font-medium transition-colors ${
            i === v ? "kx-seg-on text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════ the ten ═══════════════ */

/* H-1 — everything on one 52px line. */
function H1() {
  const [v, setV] = useState(0);
  return (
    <div className="flex h-[52px] items-center gap-3 border-b border-[var(--border-subtle)] px-4">
      <Chrome label="Back"><ArrowLeftIcon className="h-3.5 w-3.5" /></Chrome>
      <IconTile size={28} radius="rounded-lg" />
      <span className="shrink-0 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{APP.name}</span>
      <span className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" />
      <PillTabs v={v} set={setV} />
      <span className="ms-auto flex items-center gap-2">
        <Chrome label="Search"><SearchIcon className="h-3.5 w-3.5" /></Chrome>
        <Primary>New</Primary>
      </span>
    </div>
  );
}

/* H-2 — identity row, then a full-width nav rail. */
function H2() {
  const [v, setV] = useState(1);
  return (
    <div className="border-b border-[var(--border-subtle)]">
      <div className="flex items-center gap-3 px-5 pt-4">
        <Chrome label="Back"><ArrowLeftIcon className="h-3.5 w-3.5" /></Chrome>
        <IconTile />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[18px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">{APP.name}</span>
          {/* State, not marketing: a header line should say what is true now. */}
          <span className="mt-0.5 block text-[11px] text-[var(--text-dim)]">142 documents · 3 drafts</span>
        </span>
        <Field />
        <Primary>New</Primary>
      </div>
      <div className="mt-3 px-5">
        <UnderlineTabs v={v} set={setV} />
      </div>
    </div>
  );
}

/* H-3 — the path replaces the back arrow. */
function H3() {
  const [v, setV] = useState(0);
  return (
    <div className="border-b border-[var(--border-subtle)] px-5 py-3.5">
      <nav className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
        <button type="button" data-kx-keep-hover="" className="hover:text-[var(--text-primary)]">Hub</button>
        <AngleRightIcon className="h-2.5 w-2.5 opacity-50" />
        <button type="button" data-kx-keep-hover="" className="hover:text-[var(--text-primary)]">Operations</button>
        <AngleRightIcon className="h-2.5 w-2.5 opacity-50" />
        <span className="text-[var(--text-secondary)]">{APP.name}</span>
      </nav>
      <div className="mt-2 flex items-center gap-3">
        <IconTile size={32} radius="rounded-lg" />
        <span className="text-[20px] font-bold leading-none tracking-tight text-[var(--text-primary)]">{APP.name}</span>
        <span className="ms-auto flex items-center gap-2">
          <PillTabs v={v} set={setV} items={APP.tabs.slice(0, 4)} />
          <Primary>New</Primary>
        </span>
      </div>
    </div>
  );
}

/* H-4 — the icon is the anchor and the app switcher. */
function H4() {
  const [v, setV] = useState(2);
  return (
    <div className="flex gap-4 border-b border-[var(--border-subtle)] px-5 py-4">
      <button type="button" data-kx-keep-hover="" className="kx-hover-glow group relative flex h-[58px] w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <DocumentIcon className="h-6 w-6 text-[var(--text-secondary)]" />
        <AngleDownIcon className="h-2.5 w-2.5 text-[var(--text-faint)]" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[20px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">{APP.name}</span>
            <span className="mt-0.5 block truncate text-[11px] text-[var(--text-dim)]">{APP.sub}</span>
          </span>
          <Primary>New</Primary>
        </div>
        <div className="mt-2.5"><PillTabs v={v} set={setV} /></div>
      </div>
    </div>
  );
}

/* H-5 — search is the widest thing on the row. */
function H5() {
  const [v, setV] = useState(0);
  return (
    <div className="flex h-[60px] items-center gap-3 border-b border-[var(--border-subtle)] px-5">
      <IconTile size={32} radius="rounded-lg" />
      <button type="button" data-kx-keep-hover="" className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
        {APP.name}
        <span className="rounded-md px-1 text-[11px] font-medium text-[var(--text-dim)]">{APP.tabs[v]}</span>
        <AngleDownIcon className="h-3 w-3 text-[var(--text-faint)]" />
      </button>
      <Field wide />
      <Chrome label="Filter"><FilterIcon className="h-3.5 w-3.5" /></Chrome>
      <Primary>New</Primary>
      <button type="button" onClick={() => setV((v + 1) % APP.tabs.length)} className="sr-only">next</button>
    </div>
  );
}

/* H-6 — one thin line; navigation lives in a drawer. */
function H6() {
  return (
    <div className="flex h-[46px] items-center gap-3 border-b border-[var(--border-subtle)] px-4">
      <Chrome label="Sections"><MenuBurgerIcon className="h-3.5 w-3.5" /></Chrome>
      <IconTile size={24} radius="rounded-md" />
      <span className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">{APP.name}</span>
      <span className="text-[12px] text-[var(--text-faint)]">/</span>
      <span className="text-[12px] text-[var(--text-dim)]">Quotations</span>
      <span className="ms-auto flex items-center gap-2">
        <Chrome label="Search"><SearchIcon className="h-3.5 w-3.5" /></Chrome>
        <Chrome label="More"><MoreHorizontalIcon className="h-3.5 w-3.5" /></Chrome>
      </span>
    </div>
  );
}

/* H-7 — symmetric: title left, segment centred, actions right. */
function H7() {
  const [v, setV] = useState(1);
  return (
    <div className="grid h-[60px] grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[var(--border-subtle)] px-5">
      <span className="flex min-w-0 items-center gap-2.5">
        <IconTile size={30} radius="rounded-lg" />
        <span className="truncate text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{APP.name}</span>
      </span>
      <SegmentTabs v={v} set={setV} />
      <span className="flex items-center justify-end gap-2">
        <Chrome label="Search"><SearchIcon className="h-3.5 w-3.5" /></Chrome>
        <Primary>New</Primary>
      </span>
    </div>
  );
}

/* H-8 — the same header at rest and after scrolling. */
function H8() {
  const [v, setV] = useState(0);
  return (
    <div>
      <div className="border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="flex items-center gap-3">
          <IconTile />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[22px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">{APP.name}</span>
            <span className="mt-0.5 block truncate text-[11px] text-[var(--text-dim)]">{APP.sub}</span>
          </span>
          <Primary>New</Primary>
        </div>
        <div className="mt-3"><PillTabs v={v} set={setV} /></div>
      </div>
      <div className="flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">
        <span className="h-px flex-1 bg-[var(--border-faint)]" /> after scroll <span className="h-px flex-1 bg-[var(--border-faint)]" />
      </div>
      <div className="flex h-[44px] items-center gap-3 border-b border-[var(--border-subtle)] px-4">
        <IconTile size={24} radius="rounded-md" />
        <span className="shrink-0 text-[13px] font-semibold text-[var(--text-primary)]">{APP.name}</span>
        <PillTabs v={v} set={setV} items={APP.tabs.slice(0, 4)} />
        <span className="ms-auto"><Chrome label="New"><PlusIcon className="h-3.5 w-3.5" /></Chrome></span>
      </div>
    </div>
  );
}

/* H-9 — the header detaches from the edges. */
function H9() {
  const [v, setV] = useState(3);
  return (
    <div className="p-3">
      <div className="kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Chrome label="Back"><ArrowLeftIcon className="h-3.5 w-3.5" /></Chrome>
          <IconTile size={34} radius="rounded-xl" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">{APP.name}</span>
            <span className="mt-0.5 block truncate text-[11px] text-[var(--text-dim)]">142 documents</span>
          </span>
          <Primary>New</Primary>
        </div>
        <div className="mt-3 border-t border-[var(--border-faint)] pt-2.5">
          <PillTabs v={v} set={setV} />
        </div>
      </div>
    </div>
  );
}

/* H-10 — typographic; no icon box at all. */
function H10() {
  const [v, setV] = useState(0);
  return (
    <div className="border-b border-[var(--border-subtle)] px-6 pt-5">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">
            <DocumentIcon className="h-3 w-3" /> Operations
          </span>
          <h1 className="mt-1 truncate text-[26px] font-bold leading-none tracking-tight text-[var(--text-primary)]">{APP.name}</h1>
        </div>
        <span className="flex items-center gap-2 pb-1">
          <Chrome label="Search"><SearchIcon className="h-3.5 w-3.5" /></Chrome>
          <Primary>New</Primary>
        </span>
      </div>
      <div className="mt-4"><UnderlineTabs v={v} set={setV} /></div>
    </div>
  );
}

/* ═══════════════ page ═══════════════ */

export default function HeaderBallot() {
  const skin = useSkin();
  const aurora = skin === "aurora";
  return (
    <div className="kx-app kx-ground-host relative min-h-screen text-[var(--text-primary)]">
      {aurora && (
        <div className="fixed inset-0 z-0">
          <WavyBackground />
        </div>
      )}
      <div className="relative z-[1] mx-auto max-w-[1100px] px-6 py-10 md:px-10">
        <h1 className="mb-1 text-[26px] font-bold tracking-tight">App header — ten designs</h1>
        <p className="mb-2 max-w-2xl text-[12px] leading-relaxed text-[var(--text-dim)]">
          Built from zero for the owner ask. Every sample carries the app icon, the app name and a
          navigation model, and is drawn only from tokens — so this page in Aurora and the same page
          in Core is the dual-skin proof, not two sets of markup.
        </p>
        <p className="mb-8 flex items-center gap-2 text-[11px] text-[var(--text-ghost)]">
          <AppsIcon className="h-3 w-3" />
          Currently rendering: <span className="font-semibold text-[#7FA9D6]">{aurora ? "Aurora" : "Core"}</span>
          — switch skin in Settings → Display to judge the other one.
        </p>

        <Sample id="H-1" title="Command line" model="one 52px row · tabs inline" best="tool apps with ≤4 sections where vertical space is the scarce thing — Inventory counts, Calendar.">
          <H1 />
        </Sample>
        <Sample id="H-2" title="Identity + rail" model="two rows · underline nav" best="the Hub default. Reads as a place, not a toolbar; the subtitle becomes live state instead of a description.">
          <H2 />
        </Sample>
        <Sample id="H-3" title="Breadcrumb spine" model="path replaces the back arrow" best="apps reached from several places, where 'back' is ambiguous — Product Data from Home vs from a quotation.">
          <H3 />
        </Sample>
        <Sample id="H-4" title="Icon monolith" model="icon is the app switcher" best="power users who live inside one app all day and switch laterally — the icon becomes the launcher.">
          <H4 />
        </Sample>
        <Sample id="H-5" title="Search first" model="search is the widest element · sections in a dropdown" best="data apps where finding beats browsing — Contacts at 6,000 rows, Products at 3,000.">
          <H5 />
        </Sample>
        <Sample id="H-6" title="Thin line" model="46px · navigation in a drawer" best="reading and editing screens that want every pixel — the document editor, the quotation builder.">
          <H6 />
        </Sample>
        <Sample id="H-7" title="Centred segment" model="symmetric · iOS segment" best="apps with exactly 2–3 modes. Calm and predictable; breaks down past three.">
          <H7 />
        </Sample>
        <Sample id="H-8" title="Collapsing" model="full at rest → compact on scroll" best="long lists: identity when you arrive, sections when you are deep in the page. Costs a scroll listener.">
          <H8 />
        </Sample>
        <Sample id="H-9" title="Floating card" model="detached · glass on all four sides" best="Aurora-first screens where the ground should be visible around the chrome, not only under it.">
          <H9 />
        </Sample>
        <Sample id="H-10" title="Editorial" model="typographic · no icon box" best="overview and report screens that should feel like a document rather than an application.">
          <H10 />
        </Sample>

        <p className="mt-10 flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 text-[11px] leading-relaxed text-[var(--text-dim)]">
          <CheckIcon className="mt-0.5 h-3 w-3 shrink-0 text-[#7FA9D6]" />
          <span>
            Nothing here is wired into an app. Pick one (or parts of several — the tab treatment and the
            identity block are independent choices) and it becomes the new <code>PageHeader</code> anatomy
            for all 22 apps that share it.
          </span>
        </p>
      </div>
    </div>
  );
}
