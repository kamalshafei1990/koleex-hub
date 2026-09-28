"use client";

/* ---------------------------------------------------------------------------
   Mockup parts for Parts 4 and 5 of the brand book — screens, posts,
   slides, cards and house documents, drawn flat (2D) and to scale.

   The document parts reproduce the Hub's house sheet (QuotationA4Preview):
   wordmark at the start, title at the end, the black legal line over the
   grey tagline strip, black-label meta cells, a black table head and a
   black total bar, 210 × 270 proportions. The legal name, address and
   contacts come from DocumentBrandStrips' KOLEEX_COMPANY — the same record
   every real document prints.
   --------------------------------------------------------------------------- */

import type { CSSProperties, ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import { Wordmark } from "./marks";

export const INK = "#000000";
export const GRAPHITE = "#1D1D1F";
const MONO: CSSProperties = { fontFamily: "ui-monospace,'SF Mono',Menlo,Consolas,monospace" };

/* ── Screens ───────────────────────────────────────────────────────────── */

export function Phone({ children, w = 210, dark = false }: { children: ReactNode; w?: number; dark?: boolean }) {
  return (
    <div className="shrink-0 rounded-[28px] p-[6px]" style={{ width: w, background: "#1D1D1F", boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}>
      <div className="relative overflow-hidden rounded-[22px]" style={{ aspectRatio: "9 / 19.5", background: dark ? INK : "#FFFFFF" }}>
        <div className="flex h-5 items-center justify-between px-4 text-[7px] font-semibold" style={{ color: dark ? "#FFFFFF" : INK }}>
          <span>9:41</span><span className="h-2 w-8 rounded-full" style={{ background: dark ? "#FFFFFF" : INK, opacity: 0.8 }} />
        </div>
        <div className="absolute inset-x-0 bottom-0 top-5 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

export function Browser({ children, url = "www.koleexgroup.com", w = 520 }: { children: ReactNode; url?: string; w?: number }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ width: "100%", maxWidth: w }}>
      <div className="flex items-center gap-2 border-b border-[#D2D2D7] bg-[#F5F5F7] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#D1D1D6]" /><span className="h-2 w-2 rounded-full bg-[#D1D1D6]" /><span className="h-2 w-2 rounded-full bg-[#D1D1D6]" />
        <span className="ms-3 flex-1 truncate rounded-md bg-white px-2 py-0.5 font-mono text-[9px] text-[#6E6E73]">{url}</span>
      </div>
      <div className="text-[#1D1D1F]">{children}</div>
    </div>
  );
}

/** A social post, drawn at a fixed width and its platform ratio. */
export function Post({ w = 200, ratio = "4 / 5", bg = INK, children, style }: { w?: number; ratio?: string; bg?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-md ring-1 ring-black/10 dark:ring-white/15" style={{ width: w, aspectRatio: ratio, background: bg, ...style }}>
      {children}
    </div>
  );
}

/** The KOLEEX post grammar: the KOLEEX edge, the logo top-left, small
 *  label, big headline, image area (owner, 27/09/2026: the logo sits
 *  top-left in marketing; designed posts carry the edge — 1% of the width,
 *  full height, the opposite colour of the ground). */
export function PostBody({ label, title, dark = true, image = true, foot, edge = true }: { label: string; title: ReactNode; dark?: boolean; image?: boolean; foot?: ReactNode; edge?: boolean }) {
  const fg = dark ? "#FFFFFF" : INK;
  return (
    <div className="absolute inset-0 flex flex-col p-[8%]">
      {edge && <div className="absolute inset-y-0 left-0" style={{ width: "1%", minWidth: 1.5, background: fg }} />}
      <Wordmark color={dark ? "#FFFFFF" : "#000000"} width="34%" />
      <p className="mt-[9%] text-[6.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: dark ? "#98989D" : "#6E6E73" }}>{label}</p>
      <p className="mt-1.5 text-[13px] font-bold leading-[1.15]" style={{ color: fg }}>{title}</p>
      {image ? <div className="mt-2.5 flex flex-1 items-center justify-center"><MachineShot w="88%" dark={dark} label={false} /></div> : <div className="flex-1" />}
      {foot && <div className="mt-2.5 flex items-center justify-end">{foot}</div>}
    </div>
  );
}

export function Slide({ w = 300, dark = false, children }: { w?: number; dark?: boolean; children: ReactNode }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-md" style={{ width: w, aspectRatio: "16 / 9", background: dark ? INK : "#FFFFFF", boxShadow: dark ? "0 0 0 1px rgba(255,255,255,0.12)" : "0 0 0 1px rgba(0,0,0,0.12)", color: dark ? "#FFFFFF" : INK }}>
      {children}
    </div>
  );
}

/* ── Cards ─────────────────────────────────────────────────────────────── */

/** Business card, 90 × 54 mm, drawn at `w` px wide. */
export function BusinessCard({ side, w = 270, name = "Full Name", title = "Job Title" }: { side: "front" | "back"; w?: number; name?: string; title?: string }) {
  const h = (w * 54) / 90;
  if (side === "front") {
    return (
      <div className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[6px]" style={{ width: w, height: h, background: INK, boxShadow: "0 0 0 1px rgba(255,255,255,0.14)" }}>
        <Wordmark color="#FFFFFF" width="44%" style={{ filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.3)) drop-shadow(0 -1px 0 rgba(0,0,0,0.9))" }} />
      </div>
    );
  }
  return (
    <div className="flex shrink-0 flex-col justify-between overflow-hidden rounded-[6px] text-[#F5F5F7]" style={{ width: w, height: h, padding: w * 0.055, background: INK, boxShadow: "0 0 0 1px rgba(255,255,255,0.14)" }}>
      <Wordmark color="#FFFFFF" width="28%" />
      <div>
        <p className="font-semibold" style={{ fontSize: w * 0.047 }}>{name}</p>
        <p className="text-[#98989D]" style={{ fontSize: w * 0.034 }}>{title}</p>
      </div>
      <div className="leading-[1.5] text-[#F5F5F7]" style={{ fontSize: w * 0.029 }}>
        <p><b className="font-semibold">Mob:</b> {KOLEEX_COMPANY.mobile} · WhatsApp</p>
        <p><b className="font-semibold">Email:</b> {KOLEEX_COMPANY.email} · <b className="font-semibold">Web:</b> {KOLEEX_COMPANY.web}</p>
      </div>
    </div>
  );
}

/* ── House documents ───────────────────────────────────────────────────── */

/** A house sheet (210 × 270) at `w` px wide. Children are the body. */
export function Sheet({ w = 260, title, children, page = "Page 1 of 1" }: { w?: number; title: string; children?: ReactNode; page?: string }) {
  const s = w / 260; // everything below is designed at 260 px and scaled
  return (
    <div className="shrink-0 overflow-hidden rounded-[4px] bg-white text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ width: w, aspectRatio: "210 / 270" }}>
      <div style={{ width: 260, transform: `scale(${s})`, transformOrigin: "top left" }}>
        <div className="flex flex-col" style={{ height: (260 * 270) / 210, padding: 14 }}>
          <div className="flex items-center justify-between">
            <Wordmark color="#000000" width={64} />
            <span className="text-[9px] font-semibold tracking-[0.06em]">{title}</span>
          </div>
          <Strips />
          <div className="mt-2 flex-1 space-y-2">{children}</div>
          <div className="mt-2 flex items-center justify-between border-t border-[#D2D2D7] pt-1 text-[4.5px] text-[#98989D]">
            <span>{KOLEEX_COMPANY.web}</span><span>{page}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Strips() {
  return (
    <div className="mt-2 overflow-hidden rounded-[4px]">
      <div className="flex items-center justify-between bg-[#000000] px-1.5 py-[2px] text-[4.2px] text-white">
        <span className="font-semibold">{KOLEEX_COMPANY.en}</span>
        <span lang="zh-Hans">{KOLEEX_COMPANY.zh}</span>
      </div>
      <div className="bg-[#F5F5F7] px-1.5 py-[1.5px] text-[4px] font-semibold tracking-[0.3em] text-[#6E6E73]">{KOLEEX_COMPANY.tagline}</div>
    </div>
  );
}

/** Black label cell over a white value cell — the house meta grid. */
export function Meta({ items, cols = 4 }: { items: Array<[string, string]>; cols?: number }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {items.map(([k, v]) => (
        <div key={k} className="overflow-hidden rounded-[3px] border border-[#D2D2D7]">
          <div className="bg-[#000000] px-1 py-[1px] text-[3.8px] font-semibold uppercase tracking-[0.08em] text-white">{k}</div>
          <div className="px-1 py-[2px] text-[4.6px]" style={MONO}>{v}</div>
        </div>
      ))}
    </div>
  );
}

export function Parties({ left, right }: { left: [string, string[]]; right: [string, string[]] }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {[left, right].map(([h, lines]) => (
        <div key={h} className="overflow-hidden rounded-[3px] border border-[#D2D2D7]">
          <div className="bg-[#000000] px-1 py-[1px] text-[3.8px] font-semibold uppercase tracking-[0.08em] text-white">{h}</div>
          <div className="space-y-[1px] px-1 py-[2px] text-[4.4px] leading-tight">{lines.map((l) => <p key={l}>{l}</p>)}</div>
        </div>
      ))}
    </div>
  );
}

export function ItemsTable({ head, rows, total }: { head: string[]; rows: string[][]; total?: string[] }) {
  const cols = `repeat(${head.length}, minmax(0,1fr))`;
  const tpl = head.length > 3 ? `14px minmax(0,3fr) ${"minmax(0,1fr) ".repeat(head.length - 2)}` : cols;
  return (
    <div className="overflow-hidden rounded-[3px] border border-[#D2D2D7]">
      <div className="grid bg-[#000000] px-1 py-[2px] text-[3.8px] font-semibold uppercase tracking-[0.06em] text-white" style={{ gridTemplateColumns: tpl }}>
        {head.map((h, i) => <span key={h} className={i >= 2 ? "text-end" : ""}>{h}</span>)}
      </div>
      {rows.map((r, j) => (
        <div key={j} className="grid border-t border-[#D2D2D7] px-1 py-[2px] text-[4.4px]" style={{ gridTemplateColumns: tpl }}>
          {r.map((c, i) => <span key={i} className={i >= 2 ? "text-end" : ""} style={i >= 2 ? MONO : undefined}>{c}</span>)}
        </div>
      ))}
      {total && (
        <div className="grid bg-[#000000] px-1 py-[2px] text-[4.6px] font-semibold text-white" style={{ gridTemplateColumns: tpl }}>
          {total.map((c, i) => <span key={i} className={i >= 2 ? "text-end" : ""} style={i >= 2 ? MONO : undefined}>{c}</span>)}
        </div>
      )}
    </div>
  );
}

/** Grey text lines standing for body copy. */
export function Lines({ n = 3, dark = false, w = "100%" }: { n?: number; dark?: boolean; w?: string }) {
  return (
    <div className="space-y-[3px]" style={{ width: w }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-[2.5px] rounded-full" style={{ background: dark ? "#1D1D1F" : "#D2D2D7", width: i === n - 1 ? "62%" : "100%" }} />
      ))}
    </div>
  );
}

export function SignatureBlock({ labels = ["Seller", "Buyer"] }: { labels?: string[] }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0,1fr))` }}>
      {labels.map((l) => (
        <div key={l}>
          <div className="h-4 border-b border-[#000000]" />
          <p className="mt-[2px] text-[4px] uppercase tracking-[0.08em] text-[#6E6E73]">{l} · signature and date</p>
        </div>
      ))}
    </div>
  );
}

/* ── Objects (Parts 6–9) ───────────────────────────────────────────────── */

/** A drawing designed at `base` × `h` px and shown at `w` px wide, so every
 *  object keeps its real proportions at any size. */
export function Scaled({ w, base, h, children }: { w: number; base: number; h: number; children: ReactNode }) {
  const s = w / base;
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ width: w, height: h * s }}>
      <div className="absolute left-0 top-0" style={{ width: base, height: h, transform: `scale(${s})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

/** A barcode, drawn — it stands for the real one and does not scan. */
export function Barcode({ w = 80, h = 18, color = INK }: { w?: number; h?: number; color?: string }) {
  return (
    <span
      aria-hidden
      className="inline-block"
      style={{ width: w, height: h, background: `repeating-linear-gradient(90deg, ${color} 0 1px, transparent 1px 3px, ${color} 3px 5px, transparent 5px 6px, ${color} 6px 7px, transparent 7px 10px)` }}
    />
  );
}

/** A QR code, drawn — it stands for the real one and does not scan. */
export function QrBox({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-[2px]"
      style={{ width: size, height: size, background: `repeating-conic-gradient(${INK} 0 25%, #FFFFFF 0 50%) 0 0 / ${Math.max(4, Math.round(size / 6))}px ${Math.max(4, Math.round(size / 6))}px`, boxShadow: "0 0 0 2px #FFFFFF, 0 0 0 3px rgba(0,0,0,0.12)" }}
    />
  );
}

/** Avatar: the FULL logo on a black circle, 70% of the width (owner,
 *  27/09/2026 — no separate monogram). */
export function Avatar({ size = 40, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: light ? "#FFFFFF" : "#000000", boxShadow: light ? "0 0 0 1px rgba(0,0,0,0.12)" : "0 0 0 1px rgba(255,255,255,0.16)" }}>
      <Wordmark color={light ? "#000000" : "#FFFFFF"} width={size * 0.7} />
    </span>
  );
}

/* ── The machine, standing in for a studio photograph ──────────────────── */

/* The KOLEEX white body (owner, 27/09/2026), lit from above: bright on
   black, soft gray shading on white. */
const FINISH_DARK: Array<[number, string]> = [[0, "#FFFFFF"], [0.35, "#F5F5F7"], [0.7, "#E8E8ED"], [1, "#C7C7CC"]];
const FINISH_LIGHT: Array<[number, string]> = [[0, "#FFFFFF"], [0.5, "#F2F2F5"], [1, "#D1D1D6"]];
const FINISH_GRAPHITE: Array<[number, string]> = [[0, "#636366"], [0.3, "#3A3A3C"], [1, "#1D1D1F"]];

/** An industrial machine head in side view, designed at 400 × 210. */
function MachineShape({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 400 210" className="block h-auto w-full" aria-hidden fill={fill}>
      <rect x="18" y="168" width="364" height="24" rx="7" opacity=".6" />
      <rect x="262" y="58" width="80" height="116" rx="14" opacity=".85" />
      <rect x="84" y="46" width="258" height="50" rx="24" />
      <rect x="58" y="46" width="76" height="100" rx="16" />
      <rect x="336" y="60" width="26" height="64" rx="10" opacity=".7" />
      <rect x="92" y="144" width="4" height="24" opacity=".8" />
      <rect x="82" y="163" width="26" height="5" rx="2" opacity=".8" />
    </svg>
  );
}

/** Where a real studio photograph of the machine goes. Until the photo
 *  shoot, the book shows the white KOLEEX machine as a shape: on pure black with
 *  a top light (heroes, ads) or softly shaded on pure white (catalog, website) — the
 *  two backgrounds the owner chose (27/09/2026). */
export function MachineShot({ w = 320, dark = true, label = true, logo = true, body = "white", logoColor, children, style }: {
  w?: number | string; dark?: boolean; label?: boolean; logo?: boolean;
  /** "graphite" = a machine with a dark body (white logo). */
  body?: "white" | "graphite"; logoColor?: string; children?: ReactNode; style?: CSSProperties;
}) {
  const id = body === "graphite" ? "kx-finish-g" : dark ? "kx-finish-d" : "kx-finish-l";
  const stops = body === "graphite" ? FINISH_GRAPHITE : dark ? FINISH_DARK : FINISH_LIGHT;
  return (
    <div className="relative" style={{ width: w, maxWidth: "100%", ...style }}>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
          </linearGradient>
        </defs>
      </svg>
      <div className="relative">
        <div style={dark || body === "graphite" ? undefined : { filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.14))" }}><MachineShape fill={`url(#${id})`} /></div>
        {logo && (
          <span className="absolute" style={{ left: "37.5%", top: "27.5%", width: "28%" }}>
            <Wordmark color={logoColor ?? (body === "graphite" ? "#FFFFFF" : "#1D1D1F")} width="100%" />
          </span>
        )}
        {children}
      </div>
      {label && <p className="mt-2 text-center text-[9px]" style={{ color: dark ? "#6E6E73" : "#86868B" }}>Studio photo of the real machine</p>}
    </div>
  );
}
