"use client";

/* Chapters 41–44: the K monogram, the Koleex Hub mark & app icon, lockups,
   and the logo next to other logos. */

import type { ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import {
  B, Bullets, Chapter, Downloads, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { HubMark, HUB_MARK_FILES, Monogram, MonogramTile, Wordmark } from "../marks";

/* ── 41 · The K Monogram ───────────────────────────────────────────────── */

export function KMonogram() {
  return (
    <Chapter
      n={41}
      lead={
        <p>
          The K monogram is the first letter of the logo, taken exactly as it is drawn there. It stands in
          for the full logo where the full logo cannot be read — a profile picture, a browser tab, a small
          stamp — and nowhere else.
        </p>
      }
      toc={[
        { id: "the-k", title: "The K" },
        { id: "when", title: "When to use it — and when not" },
        { id: "tile", title: "The tile" },
        { id: "sizes", title: "Sizes" },
        { id: "k-donts", title: "What never to do" },
        { id: "k-files", title: "Files" },
      ]}
    >
      <Section id="the-k" title="The K">
        <Examples cols={2}>
          <Example caption="The K, as it appears in the logo…" bg="#FFFFFF" h={200}>
            <div className="flex flex-col items-start gap-4">
              <Wordmark color="#000000" width={300} />
              <div className="h-[2px] w-[49px] rounded" style={{ background: "#567FB2" }} />
            </div>
          </Example>
          <Example caption="…is the monogram. Same shape, same proportions, nothing added." bg="#FFFFFF" h={200}>
            <Monogram color="#000000" style={{ height: 110 }} />
          </Example>
        </Examples>
        <Rule why="A second, different symbol would split the brand's recognition in two. The K is recognisable because it is already in every logo.">
          The monogram is the K of the logo, unchanged. It is never redrawn, re-proportioned or combined
          with other letters.
        </Rule>
      </Section>

      <Section id="when" title="When to use it — and when not">
        <Table
          head={["Use the K monogram", "Use the full logo"]}
          rows={[
            ["Profile pictures: WhatsApp, WeChat, Facebook, Instagram, LinkedIn, TikTok, Douyin, YouTube, X", "Every document, catalog, brochure, poster and sign"],
            ["Website favicon and browser tab", "Website header, email signature, presentations"],
            ["Small embroidery: cuff, collar, cap side", "Chest and back embroidery on uniforms"],
            ["Small parts, tools and accessories, below the logo's minimum size", "Machine heads, nameplates, cartons"],
            ["Stamps and seals for internal use", "Anywhere the full logo fits at its minimum size"],
          ]}
        />
        <Note tone="warn">The K is not the company seal. Official company chops (公章) follow Chinese law and are never replaced or decorated with the K.</Note>
      </Section>

      <Section id="tile" title="The tile">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col items-center gap-2"><MonogramTile size={128} /><span className="text-[12px] text-[var(--text-dim)]">Primary — dark tile</span></div>
          <div className="flex flex-col items-center gap-2"><MonogramTile size={128} dark={false} border /><span className="text-[12px] text-[var(--text-dim)]">Alternative — light tile</span></div>
          <div className="flex flex-col items-center gap-2">
            <span className="flex h-[128px] w-[128px] items-center justify-center overflow-hidden rounded-full bg-[#0A0A0A] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"><Monogram color="#FFFFFF" style={{ width: 59 }} /></span>
            <span className="text-[12px] text-[var(--text-dim)]">As a platform shows it (circle)</span>
          </div>
        </div>
        <Specs rows={[
          ["Tile", "Square, 1 : 1. Files are square — each platform applies its own circle or rounded mask"],
          ["K width", "46% of the tile width, centered"],
          ["Primary colors", "White K on Ink #0A0A0A"],
          ["Alternative colors", "Black K on White #FFFFFF — for light profile pages and print"],
          ["Corner radius (our own tiles)", "22% of the tile side"],
        ]} />
      </Section>

      <Section id="sizes" title="Sizes">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="flex flex-wrap items-end gap-6">
            {[96, 64, 48, 32, 16].map((s) => (
              <div key={s} className="flex flex-col items-center gap-2">
                <MonogramTile size={s} radius={0.22} />
                <span className="font-mono text-[10.5px] text-[#4B5563]">{s} px</span>
              </div>
            ))}
          </div>
        </Stage>
        <Specs rows={[
          ["Screen minimum", "16 px (favicon)"],
          ["Print minimum", "5 mm"],
          ["Embroidery minimum", "12 mm"],
          ["Profile picture upload", "1024 × 1024 px (the platform downsizes)"],
        ]} />
      </Section>

      <Section id="k-donts" title="What never to do">
        <Examples cols={4}>
          <Example tone="dont" caption="Colored or in Hub Blue." h={130}><Monogram color="#567FB2" style={{ height: 70 }} /></Example>
          <Example tone="dont" caption="Rotated." h={130}><Monogram color="#000000" style={{ height: 70, transform: "rotate(-15deg)" }} /></Example>
          <Example tone="dont" caption="Next to the full logo — say it once." h={130}>
            <div className="flex items-center gap-3"><Monogram color="#000000" style={{ height: 30 }} /><Wordmark color="#000000" width={110} /></div>
          </Example>
          <Example tone="dont" caption="Combined with other letters or words." h={130}>
            <div className="flex items-center gap-1"><Monogram color="#000000" style={{ height: 50 }} /><span className="text-[40px] font-bold leading-none">X</span></div>
          </Example>
        </Examples>
      </Section>

      <Section id="k-files" title="Files">
        <Downloads items={[
          { label: "K monogram — black", href: "/brand/kit/koleex-k-black.svg", format: "SVG" },
          { label: "K monogram — white", href: "/brand/kit/koleex-k-white.svg", format: "SVG" },
          { label: "K tile — dark (profile pictures)", href: "/brand/kit/koleex-k-tile-dark-1024.png", format: "PNG 1024" },
          { label: "K tile — light", href: "/brand/kit/koleex-k-tile-light-1024.png", format: "PNG 1024" },
          { label: "K tile — dark, vector", href: "/brand/kit/koleex-k-tile-dark.svg", format: "SVG" },
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 42 · Koleex Hub Mark & App Icon ───────────────────────────────────── */

export function HubMarkChapter() {
  return (
    <Chapter
      n={42}
      lead={
        <p>
          Koleex Hub is our own platform — the system the whole company runs on, and that customers and
          partners use too. It carries the KOLEEX logo with a handwritten “hub” in the Hub Blue gradient.
          It is a product mark: it belongs to the software and to what we say about it.
        </p>
      }
      toc={[
        { id: "hub-mark", title: "The Koleex Hub mark" },
        { id: "hub-versions", title: "Versions" },
        { id: "app-icon", title: "The app icon" },
        { id: "hub-where", title: "Where it is used" },
        { id: "hub-donts", title: "What never to do" },
        { id: "hub-files", title: "Files" },
      ]}
    >
      <Section id="hub-mark" title="The Koleex Hub mark">
        <Stage bg="#0A0A0A" h={220}><HubMark variant="for-dark" style={{ width: "64%" }} /></Stage>
        <Specs rows={[
          ["Construction", "The official KOLEEX logo, unaltered, followed by the \"hub\" script"],
          ["The script", "A rounded monoline \"hub\", colored with the Hub gradient #567FB2 → #BCD8F0"],
          ["Relationship", "The Hub is a product of KOLEEX: the company logo always leads"],
        ]} />
      </Section>

      <Section id="hub-versions" title="Versions">
        <Examples cols={2}>
          <Example tone="do" caption="Horizontal — for dark backgrounds." bg="#0A0A0A" h={150}><HubMark variant="for-dark" style={{ width: "72%" }} /></Example>
          <Example tone="do" caption="Horizontal — for light backgrounds." bg="#FFFFFF" h={150}><HubMark variant="for-light" style={{ width: "72%" }} /></Example>
          <Example tone="do" caption="Stacked — for dark backgrounds." bg="#0A0A0A" h={200}><HubMark variant="for-dark" stacked style={{ width: "46%" }} /></Example>
          <Example tone="do" caption="Stacked — for light backgrounds." bg="#FFFFFF" h={200}><HubMark variant="for-light" stacked style={{ width: "46%" }} /></Example>
          <Example tone="do" caption="One color — when the gradient cannot be reproduced (engraving, one-color print), on dark." bg="#0A0A0A" h={140}><HubMark variant="mono-dark" style={{ width: "72%" }} /></Example>
          <Example tone="do" caption="One color, on light." bg="#FFFFFF" h={140}><HubMark variant="mono-light" style={{ width: "72%" }} /></Example>
        </Examples>
      </Section>

      <Section id="app-icon" title="The app icon">
        <div className="flex flex-wrap items-end gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- the live app icon file */}
          <img src="/icon-512.png" alt="Koleex Hub app icon" width={128} height={128} className="h-32 w-32 rounded-[28px]" />
          {/* eslint-disable-next-line @next/next/no-img-element -- the live app icon file */}
          <img src="/icon-512.png" alt="" width={64} height={64} className="h-16 w-16 rounded-[14px]" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element -- the live app icon file */}
          <img src="/icon-512.png" alt="" width={40} height={40} className="h-10 w-10 rounded-[9px]" aria-hidden />
        </div>
        <Specs rows={[
          ["Artwork", "The stacked Koleex Hub mark on Ink #0A0A0A"],
          ["Size in the tile", "72% of the tile width (62% for the maskable Android icon)"],
          ["Position", "The whole group centered, then moved down by 10.6% of its height — so it looks centered"],
          ["Browser tab (favicon)", "The \"hub\" script alone"],
          ["Master", "Rendered from a 1024 px master; never redrawn by hand or by an image generator"],
        ]} />
      </Section>

      <Section id="hub-where" title="Where it is used">
        <Table
          head={["Use the Koleex Hub mark", "Use the KOLEEX logo"]}
          rows={[
            ["Inside the platform: sign-in, header, app icon, desktop app", "Quotations, invoices, contracts, packing lists — every business document"],
            ["Marketing about the platform: announcements, tutorials, onboarding for customers and agents", "Business cards, letterhead, email signatures"],
            ["Screenshots and videos of the platform", "Products, packaging, signage, uniforms, exhibitions"],
          ]}
        />
        <Rule why="Documents speak for the company, not for the software that produced them.">
          The Koleex Hub mark never appears on company documents and never replaces the KOLEEX logo.
        </Rule>
      </Section>

      <Section id="hub-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption={'"Hub" typed in a font next to the logo.'} bg="#0A0A0A" h={130}>
            <div className="flex items-baseline gap-2"><Wordmark color="#FFFFFF" width={130} /><span className="text-[22px] font-semibold text-[#7FA9D6]">Hub</span></div>
          </Example>
          <Example tone="dont" caption="The script recolored or separated from the logo." bg="#0A0A0A" h={130}>
            <div className="flex items-end gap-10">
              <Wordmark color="#FFFFFF" width={110} />
              {/* eslint-disable-next-line @next/next/no-img-element -- the live script file, shown to illustrate a misuse */}
              <img src={HUB_MARK_FILES.script} alt="" aria-hidden className="h-7 w-auto" style={{ filter: "hue-rotate(140deg) saturate(3)" }} />
            </div>
          </Example>
          <Example tone="dont" caption="The Hub mark on a quotation or invoice." bg="#FFFFFF" h={130}>
            <div className="flex w-full items-center justify-between px-3">
              <HubMark variant="for-light" style={{ width: 120 }} />
              <span className="text-[11px] font-bold tracking-wider">QUOTATION</span>
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="hub-files" title="Files">
        <Downloads items={[
          { label: "Koleex Hub — horizontal, for dark", href: HUB_MARK_FILES.horizontal("for-dark"), format: "PNG" },
          { label: "Koleex Hub — horizontal, for light", href: HUB_MARK_FILES.horizontal("for-light"), format: "PNG" },
          { label: "Koleex Hub — stacked, for dark", href: HUB_MARK_FILES.stacked("for-dark"), format: "PNG" },
          { label: "Koleex Hub — stacked, for light", href: HUB_MARK_FILES.stacked("for-light"), format: "PNG" },
          { label: "Koleex Hub — one color, for dark", href: HUB_MARK_FILES.horizontal("mono-dark"), format: "PNG" },
          { label: "Koleex Hub — one color, for light", href: HUB_MARK_FILES.horizontal("mono-light"), format: "PNG" },
          { label: "App icon", href: "/icon-512.png", format: "PNG 512" },
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 43 · Lockups ──────────────────────────────────────────────────────── */

function Descriptor({ children, color = "#4B5563", size = 9 }: { children: ReactNode; color?: string; size?: number }) {
  return <span className="block font-semibold uppercase" style={{ color, fontSize: size, letterSpacing: "0.22em", lineHeight: 1 }}>{children}</span>;
}

export function Lockups() {
  return (
    <Chapter
      n={43}
      lead={
        <p>
          A lockup is the logo with a fixed line of text — the descriptor, the tagline, the legal name or a
          region. It is built once, in exact proportions, and used as a single unit.
        </p>
      }
      toc={[
        { id: "descriptor", title: "Logo + descriptor" },
        { id: "tagline", title: "Logo + tagline" },
        { id: "document", title: "The document lockup" },
        { id: "region", title: "Logo + region or company" },
        { id: "lockup-donts", title: "What never to do" },
      ]}
    >
      <Section id="descriptor" title="Logo + descriptor">
        <Examples cols={2}>
          <Example tone="do" caption="Stacked: descriptor under the logo, aligned to the K." bg="#FFFFFF" h={170}>
            <div className="flex flex-col items-start" style={{ gap: 14 }}>
              <Wordmark color="#000000" width={260} />
              <Descriptor>Industrial Garment Machinery</Descriptor>
            </div>
          </Example>
          <Example tone="do" caption="Horizontal: separated by a hairline, x apart." bg="#0A0A0A" h={170}>
            <div className="flex items-center" style={{ gap: 18 }}>
              <Wordmark color="#FFFFFF" width={170} />
              <span className="h-[26px] w-px bg-[#4B5563]" />
              <Descriptor color="#9CA3AF">Industrial<br />Garment Machinery</Descriptor>
            </div>
          </Example>
        </Examples>
        <Specs rows={[
          ["Text", "INDUSTRIAL GARMENT MACHINERY — the approved descriptor, in English"],
          ["Typeface", "Inter SemiBold, all capitals, letter-spacing +0.22 em"],
          ["Size", "Capital height = 0.30 x"],
          ["Gap (stacked)", "0.5 x below the logo, left edge on the K"],
          ["Color", "Slate #4B5563 on light · Silver #9CA3AF on dark"],
          ["Width", "Never wider than the logo"],
        ]} />
      </Section>

      <Section id="tagline" title="Logo + tagline">
        <Example tone="do" caption="The tagline follows the same system as the descriptor." bg="#FFFFFF" h={160}>
          <div className="flex flex-col items-start" style={{ gap: 14 }}>
            <Wordmark color="#000000" width={260} />
            <Descriptor>{KOLEEX_COMPANY.tagline}</Descriptor>
          </div>
        </Example>
        <Note>The current tagline is <B>{KOLEEX_COMPANY.tagline}</B> A new tagline is being prepared (<Ref n={20} />); when it is approved, this lockup changes with it. Never use the descriptor and the tagline together.</Note>
      </Section>

      <Section id="document" title="The document lockup">
        <P>Every KOLEEX business document opens with the same header: the logo at the start, the document title at the end, and the legal name in English and Chinese over the tagline strip.</P>
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="w-full max-w-[560px]">
            <div className="flex items-center justify-between">
              <Wordmark color="#000000" width={150} />
              <span className="text-[18px] font-bold tracking-[0.06em] text-[#0A0A0A]">QUOTATION</span>
            </div>
            <div className="mt-5 overflow-hidden rounded-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0A0A0A] px-4 py-2 text-[10.5px] text-white">
                <span className="font-semibold tracking-[0.04em]">{KOLEEX_COMPANY.en}</span>
                <span lang="zh-Hans">{KOLEEX_COMPANY.zh}</span>
              </div>
              <div className="bg-[#F5F5F5] px-4 py-1.5 text-[10px] font-semibold tracking-[0.3em] text-[#4B5563]">{KOLEEX_COMPANY.tagline}</div>
            </div>
          </div>
        </Stage>
        <P>This lockup is built into every document the Hub produces. The full document system is in <Ref n={94} />.</P>
      </Section>

      <Section id="region" title="Logo + region or company">
        <Example tone="do" caption="A region or group company in the same system as the descriptor, after a hairline." bg="#FFFFFF" h={150}>
          <div className="flex items-center" style={{ gap: 18 }}>
            <Wordmark color="#000000" width={200} />
            <span className="h-[28px] w-px bg-[#9CA3AF]" />
            <Descriptor size={12} color="#0A0A0A">China</Descriptor>
          </div>
        </Example>
        <P>How group companies are named and shown is set out in <Ref n={16} />.</P>
      </Section>

      <Section id="lockup-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="Text larger or bolder than the logo." h={140}>
            <div className="flex flex-col items-start gap-1"><Wordmark color="#000000" width={150} /><span className="text-[22px] font-black">MACHINERY</span></div>
          </Example>
          <Example tone="dont" caption="Another typeface or a script." h={140}>
            <div className="flex flex-col items-start gap-2"><Wordmark color="#000000" width={170} /><span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15 }}>Shaping the future</span></div>
          </Example>
          <Example tone="dont" caption={'"by KOLEEX" or product names locked to the logo.'} h={140}>
            <div className="flex items-baseline gap-2"><span className="text-[18px] font-bold">SuperStitch</span><span className="text-[11px]">by</span><Wordmark color="#000000" width={90} /></div>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 44 · The Logo with Other Logos ────────────────────────────────────── */

function PartnerBox({ label = "PARTNER LOGO", w = 110 }: { label?: string; w?: number }) {
  return (
    <span className="flex items-center justify-center rounded-md border border-dashed border-[#9CA3AF] text-[9px] font-semibold tracking-[0.14em] text-[#4B5563]" style={{ width: w, height: 34 }}>
      {label}
    </span>
  );
}

export function CoBranding() {
  return (
    <Chapter
      n={44}
      lead={
        <p>
          Sometimes KOLEEX appears with other names — an exhibition organizer, a group company, a
          certification. The rules below keep the KOLEEX logo clear, equal and first, and keep our suppliers
          and agents where they belong.
        </p>
      }
      toc={[
        { id: "principles", title: "Principles" },
        { id: "events", title: "Events and partners" },
        { id: "group", title: "Group companies" },
        { id: "certifications", title: "Certification marks" },
        { id: "agents-suppliers", title: "Agents and suppliers" },
      ]}
    >
      <Section id="principles" title="Principles">
        <Stage bg="#FFFFFF" h="auto" pad={28}>
          <div className="flex items-center" style={{ gap: 28 }}>
            <Wordmark color="#000000" width={170} />
            <span className="h-9 w-px bg-[#9CA3AF]" />
            <PartnerBox />
          </div>
        </Stage>
        <Specs rows={[
          ["Order", "KOLEEX first — on the left in English, on the right in Arabic"],
          ["Size", "Equal visual weight: the partner logo is optically as large as ours, never larger"],
          ["Separation", "A hairline divider, with x of space on each side"],
          ["Colors", "Each logo in its own approved version; ours stays black or white"],
          ["Maximum", "Three logos in one lockup — beyond that, use a logo wall"],
        ]} />
      </Section>

      <Section id="events" title="Events and partners">
        <Examples cols={2}>
          <Example tone="do" caption="Equal, divided, KOLEEX first." bg="#0A0A0A" h={140}>
            <div className="flex items-center gap-6">
              <Wordmark color="#FFFFFF" width={140} />
              <span className="h-8 w-px bg-[#4B5563]" />
              <span className="flex h-[34px] w-[110px] items-center justify-center rounded-md border border-dashed border-[#4B5563] text-[9px] font-semibold tracking-[0.14em] text-[#9CA3AF]">ORGANIZER</span>
            </div>
          </Example>
          <Example tone="dont" caption="The partner logo larger than ours, or placed first." bg="#FFFFFF" h={140}>
            <div className="flex items-center gap-3"><PartnerBox w={170} /><Wordmark color="#000000" width={90} /></div>
          </Example>
        </Examples>
      </Section>

      <Section id="group" title="Group companies">
        <P>
          The companies of KOLEEX International Group show their link to the group with a written line —
          not by placing their logo next to ours:
        </P>
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="flex flex-col items-center gap-3">
            <PartnerBox label="GROUP COMPANY LOGO" w={180} />
            <span className="text-[10px] tracking-[0.2em] text-[#4B5563]">A KOLEEX INTERNATIONAL GROUP COMPANY</span>
          </div>
        </Stage>
        <P>The full system for the group’s companies and brands is in <Ref n={16} />.</P>
      </Section>

      <Section id="certifications" title="Certification marks">
        <Rule why="A certification mark is a legal claim about a specific product. Shown by default, it becomes a false claim.">
          CE, ISO 9001 and other marks appear only on the products, documents and pages they actually apply
          to — in their own band, never touching or locked to the KOLEEX logo.
        </Rule>
        <P>Which marks we hold and how to show them: <Ref n={133} />.</P>
      </Section>

      <Section id="agents-suppliers" title="Agents and suppliers">
        <Table
          head={["Who", "Rule"]}
          rows={[
            [<B key="a">Agents & distributors</B>, "Their logo is never placed next to the KOLEEX logo. They use the \"Authorized KOLEEX Distributor\" badge instead (Part 9)."],
            [<B key="a">Suppliers & factories</B>, "Never shown with the KOLEEX logo, never named on customer-facing material. Supplier identity is confidential."],
            [<B key="a">Customers</B>, "A customer's logo appears only with their written permission, in a logo wall — never locked to ours."],
          ]}
        />
        <Bullets items={[<>Details for each partner type follow in Part 9: <Ref n={128} />, <Ref n={130} />, <Ref n={131} />.</>]} />
      </Section>
    </Chapter>
  );
}
