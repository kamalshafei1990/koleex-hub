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
import { Monogram, Wordmark } from "./marks";

export const INK = "#0A0A0A";
export const HUB_LINE = "linear-gradient(90deg,#567FB2,#BCD8F0)";
const MONO: CSSProperties = { fontFamily: "ui-monospace,'SF Mono',Menlo,Consolas,monospace" };

/* ── Screens ───────────────────────────────────────────────────────────── */

export function Phone({ children, w = 210, dark = false }: { children: ReactNode; w?: number; dark?: boolean }) {
  return (
    <div className="shrink-0 rounded-[28px] p-[6px]" style={{ width: w, background: "#1A1A1A", boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}>
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
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] bg-[#F5F5F5] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#D1D5DB]" /><span className="h-2 w-2 rounded-full bg-[#D1D5DB]" /><span className="h-2 w-2 rounded-full bg-[#D1D5DB]" />
        <span className="ms-3 flex-1 truncate rounded-md bg-white px-2 py-0.5 font-mono text-[9px] text-[#4B5563]">{url}</span>
      </div>
      <div className="text-[#0A0A0A]">{children}</div>
    </div>
  );
}

/** A social post, drawn at a fixed width and its platform ratio. */
export function Post({ w = 200, ratio = "4 / 5", bg = INK, children, style }: { w?: number; ratio?: string; bg?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-md" style={{ width: w, aspectRatio: ratio, background: bg, boxShadow: "0 0 0 1px rgba(0,0,0,0.12)", ...style }}>
      {children}
    </div>
  );
}

/** The KOLEEX post grammar: small label, big headline, image area, logo, Hub line. */
export function PostBody({ label, title, dark = true, image = true, foot }: { label: string; title: ReactNode; dark?: boolean; image?: boolean; foot?: ReactNode }) {
  const fg = dark ? "#FFFFFF" : INK;
  return (
    <div className="absolute inset-0 flex flex-col p-[8%]">
      <p className="text-[6.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: dark ? "#7FA9D6" : "#3E6796" }}>{label}</p>
      <p className="mt-1.5 text-[13px] font-bold leading-[1.15]" style={{ color: fg }}>{title}</p>
      {image ? <div className="my-2.5 flex-1 rounded" style={{ background: dark ? "#1A1A1A" : "#F5F5F5" }} /> : <div className="flex-1" />}
      <div className="flex items-center justify-between">
        <Wordmark color={dark ? "#FFFFFF" : "#000000"} width="34%" />
        {foot ?? <span className="h-[2px] w-[22%]" style={{ background: HUB_LINE }} />}
      </div>
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
      <div className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[6px]" style={{ width: w, height: h, background: INK, boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}>
        <Wordmark color="#FFFFFF" width="44%" />
        <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: HUB_LINE }} />
      </div>
    );
  }
  return (
    <div className="flex shrink-0 flex-col justify-between overflow-hidden rounded-[6px] bg-white text-[#0A0A0A]" style={{ width: w, height: h, padding: w * 0.055, boxShadow: "0 0 0 1px rgba(0,0,0,0.12)" }}>
      <Wordmark color="#000000" width="28%" />
      <div>
        <p className="font-bold" style={{ fontSize: w * 0.047 }}>{name}</p>
        <p className="text-[#4B5563]" style={{ fontSize: w * 0.034 }}>{title}</p>
      </div>
      <div className="leading-[1.5] text-[#1A1A1A]" style={{ ...MONO, fontSize: w * 0.029 }}>
        <p>M {KOLEEX_COMPANY.mobile} · WhatsApp</p>
        <p>{KOLEEX_COMPANY.email} · {KOLEEX_COMPANY.web}</p>
      </div>
    </div>
  );
}

/* ── House documents ───────────────────────────────────────────────────── */

/** A house sheet (210 × 270) at `w` px wide. Children are the body. */
export function Sheet({ w = 260, title, children, page = "Page 1 of 1" }: { w?: number; title: string; children?: ReactNode; page?: string }) {
  const s = w / 260; // everything below is designed at 260 px and scaled
  return (
    <div className="shrink-0 overflow-hidden rounded-[4px] bg-white text-[#0A0A0A] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ width: w, aspectRatio: "210 / 270" }}>
      <div style={{ width: 260, transform: `scale(${s})`, transformOrigin: "top left" }}>
        <div className="flex flex-col" style={{ height: (260 * 270) / 210, padding: 14 }}>
          <div className="flex items-center justify-between">
            <Wordmark color="#000000" width={64} />
            <span className="text-[9px] font-bold tracking-[0.06em]">{title}</span>
          </div>
          <Strips />
          <div className="mt-2 flex-1 space-y-2">{children}</div>
          <div className="mt-2 flex items-center justify-between border-t border-[#E5E7EB] pt-1 text-[4.5px] text-[#9CA3AF]">
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
      <div className="flex items-center justify-between bg-[#0A0A0A] px-1.5 py-[2px] text-[4.2px] text-white">
        <span className="font-semibold">{KOLEEX_COMPANY.en}</span>
        <span lang="zh-Hans">{KOLEEX_COMPANY.zh}</span>
      </div>
      <div className="bg-[#F5F5F5] px-1.5 py-[1.5px] text-[4px] font-semibold tracking-[0.3em] text-[#4B5563]">{KOLEEX_COMPANY.tagline}</div>
    </div>
  );
}

/** Black label cell over a white value cell — the house meta grid. */
export function Meta({ items, cols = 4 }: { items: Array<[string, string]>; cols?: number }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {items.map(([k, v]) => (
        <div key={k} className="overflow-hidden rounded-[3px] border border-[#E5E7EB]">
          <div className="bg-[#0A0A0A] px-1 py-[1px] text-[3.8px] font-semibold uppercase tracking-[0.08em] text-white">{k}</div>
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
        <div key={h} className="overflow-hidden rounded-[3px] border border-[#E5E7EB]">
          <div className="bg-[#0A0A0A] px-1 py-[1px] text-[3.8px] font-semibold uppercase tracking-[0.08em] text-white">{h}</div>
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
    <div className="overflow-hidden rounded-[3px] border border-[#E5E7EB]">
      <div className="grid bg-[#0A0A0A] px-1 py-[2px] text-[3.8px] font-semibold uppercase tracking-[0.06em] text-white" style={{ gridTemplateColumns: tpl }}>
        {head.map((h, i) => <span key={h} className={i >= 2 ? "text-end" : ""}>{h}</span>)}
      </div>
      {rows.map((r, j) => (
        <div key={j} className="grid border-t border-[#E5E7EB] px-1 py-[2px] text-[4.4px]" style={{ gridTemplateColumns: tpl }}>
          {r.map((c, i) => <span key={i} className={i >= 2 ? "text-end" : ""} style={i >= 2 ? MONO : undefined}>{c}</span>)}
        </div>
      ))}
      {total && (
        <div className="grid bg-[#0A0A0A] px-1 py-[2px] text-[4.6px] font-semibold text-white" style={{ gridTemplateColumns: tpl }}>
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
        <div key={i} className="h-[2.5px] rounded-full" style={{ background: dark ? "#1A1A1A" : "#E5E7EB", width: i === n - 1 ? "62%" : "100%" }} />
      ))}
    </div>
  );
}

export function SignatureBlock({ labels = ["Seller", "Buyer"] }: { labels?: string[] }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0,1fr))` }}>
      {labels.map((l) => (
        <div key={l}>
          <div className="h-4 border-b border-[#0A0A0A]" />
          <p className="mt-[2px] text-[4px] uppercase tracking-[0.08em] text-[#4B5563]">{l} · signature and date</p>
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

/** Avatar: the K tile, as platforms show it (circle). */
export function Avatar({ size = 40 }: { size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#0A0A0A]" style={{ width: size, height: size, boxShadow: "0 0 0 1px rgba(255,255,255,0.16)" }}>
      <Monogram color="#FFFFFF" style={{ width: size * 0.46 }} />
    </span>
  );
}
