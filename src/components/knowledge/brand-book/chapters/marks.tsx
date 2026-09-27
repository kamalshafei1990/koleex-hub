"use client";

/* Chapters 41–44: the logo in small spaces (there is no monogram), the
   Koleex Hub mark & app icon, lockups, and the logo next to other logos. */

import type { ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import {
  B, Bullets, Chapter, Downloads, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { GroupLockup, HubMark, HUB_MARK_FILES, LogoTile, Wordmark } from "../marks";

/* ── 41 · The Logo in Small Spaces ────────────────────────────────────── */

export function SmallSpaces() {
  return (
    <Chapter
      n={41}
      lead={
        <p>
          KOLEEX has one mark: the logo. There is no separate monogram. Where the space is small — a profile
          picture, an app icon, the browser tab — the whole logo is fitted in, white on black.
        </p>
      }
      toc={[
        { id: "rule", title: "The rule" },
        { id: "tiles", title: "The tile" },
        { id: "sizes", title: "Sizes" },
        { id: "small-items", title: "Small objects" },
        { id: "small-never", title: "What never to do" },
        { id: "small-files", title: "Files" },
      ]}
    >
      <Section id="rule" title="The rule">
        <Rule why="One mark is remembered faster than two. Every time someone sees the full name, the brand is built — a letter on its own builds nothing.">
          Small spaces use the full logo, fitted to 70% of the width and centered. Never a single letter, never an
          abbreviation.
        </Rule>
      </Section>

      <Section id="tiles" title="The tile">
        <Stage bg="#F5F5F7" h="auto" pad={40}>
          <div className="flex flex-wrap items-end justify-center gap-10">
            <div className="flex flex-col items-center gap-3"><LogoTile size={140} round /><span className="text-[13px] text-[#6E6E73]">Profile picture — circle</span></div>
            <div className="flex flex-col items-center gap-3"><LogoTile size={140} /><span className="text-[13px] text-[#6E6E73]">App icon — rounded square</span></div>
            <div className="flex flex-col items-center gap-3"><LogoTile size={140} dark={false} border /><span className="text-[13px] text-[#6E6E73]">On dark grounds only</span></div>
          </div>
        </Stage>
        <Specs rows={[
          ["Primary", "White logo on black #000000"],
          ["Alternative", "Black logo on white — only where the tile sits on a dark ground"],
          ["Logo width", "70% of the tile, centered on both axes"],
          ["Shape", "The platform decides: circle for profiles, rounded square for app icons. The file itself is square."],
        ]} />
      </Section>

      <Section id="sizes" title="Sizes">
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <div className="flex flex-wrap items-end justify-center gap-8">
            {[128, 64, 40, 24].map((s) => (
              <div key={s} className="flex flex-col items-center gap-2"><LogoTile size={s} round /><span className="font-mono text-[12px] text-[#6E6E73]">{s} px</span></div>
            ))}
          </div>
        </Stage>
        <P>
          The logo reads clearly from 40 px. At the smallest sizes — the browser tab at 16 px, a notification icon —
          it becomes a recognisable shape rather than readable letters; that is expected, and it is still the full
          logo (owner decision, 27/09/2026).
        </P>
      </Section>

      <Section id="small-items" title="Small objects">
        <Examples cols={2}>
          <Example tone="do" caption="Pens, tools, small parts: the full logo along the long side." bg="#F5F5F7" h={170}>
            <div className="flex flex-col items-center gap-5">
              <div className="flex h-[16px] w-[220px] items-center rounded-full bg-[#1D1D1F] ps-5"><Wordmark color="#FFFFFF" width={70} /></div>
              <div className="flex h-[44px] w-[150px] items-center justify-center rounded-[10px] bg-[#D1D1D6]"><Wordmark color="#1D1D1F" width={100} /></div>
            </div>
          </Example>
          <Example tone="do" caption="When even that is too small, leave the logo off — the packaging carries it." bg="#F5F5F7" h={170}>
            <div className="flex items-center gap-4">
              <div className="h-[30px] w-[30px] rounded-full bg-[#AEAEB2]" />
              <span className="text-[13px] text-[#6E6E73]">A 6 mm part: no mark</span>
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="small-never" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="A single letter as the mark." h={140}>
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[16px] bg-black text-[36px] font-bold text-white">K</div>
          </Example>
          <Example tone="dont" caption="The logo squeezed to fill the tile." h={140}>
            <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[16px] bg-black"><Wordmark color="#FFFFFF" width={92} style={{ transform: "scaleY(2.4)" }} /></div>
          </Example>
          <Example tone="dont" caption="Silver, blue or any color on the logo." h={140}>
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[16px] bg-black"><Wordmark color="#567FB2" width={50} /></div>
          </Example>
        </Examples>
      </Section>

      <Section id="small-files" title="Files">
        <Downloads items={[
          { label: "Avatar — white on black, 1024 px", href: "/brand/kit/koleex-avatar-dark-1024.png", format: "PNG", note: "Profile pictures on every platform" },
          { label: "Avatar — white on black, 512 px", href: "/brand/kit/koleex-avatar-dark-512.png", format: "PNG" },
          { label: "Avatar — black on white, 1024 px", href: "/brand/kit/koleex-avatar-light-1024.png", format: "PNG" },
          { label: "Avatar — vector", href: "/brand/kit/koleex-avatar-dark.svg", format: "SVG" },
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
        <Stage bg="#000000" h={220}><HubMark variant="for-dark" style={{ width: "64%" }} /></Stage>
        <Specs rows={[
          ["Construction", "The official KOLEEX logo, unaltered, followed by the \"hub\" script"],
          ["The script", "A rounded monoline \"hub\", colored with the Hub gradient #567FB2 → #BCD8F0"],
          ["Relationship", "The Hub is a product of KOLEEX: the company logo always leads"],
        ]} />
      </Section>

      <Section id="hub-versions" title="Versions">
        <Examples cols={2}>
          <Example tone="do" caption="Horizontal — for dark backgrounds." bg="#000000" h={150}><HubMark variant="for-dark" style={{ width: "72%" }} /></Example>
          <Example tone="do" caption="Horizontal — for light backgrounds." bg="#FFFFFF" h={150}><HubMark variant="for-light" style={{ width: "72%" }} /></Example>
          <Example tone="do" caption="Stacked — for dark backgrounds." bg="#000000" h={200}><HubMark variant="for-dark" stacked style={{ width: "46%" }} /></Example>
          <Example tone="do" caption="Stacked — for light backgrounds." bg="#FFFFFF" h={200}><HubMark variant="for-light" stacked style={{ width: "46%" }} /></Example>
          <Example tone="do" caption="One color — when the gradient cannot be reproduced (engraving, one-color print), on dark." bg="#000000" h={140}><HubMark variant="mono-dark" style={{ width: "72%" }} /></Example>
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
          ["Artwork", "The stacked Koleex Hub mark on Black #000000"],
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
          <Example tone="dont" caption={'"Hub" typed in a font next to the logo.'} bg="#000000" h={130}>
            <div className="flex items-baseline gap-2"><Wordmark color="#FFFFFF" width={130} /><span className="text-[22px] font-semibold text-[#7FA9D6]">Hub</span></div>
          </Example>
          <Example tone="dont" caption="The script recolored or separated from the logo." bg="#000000" h={130}>
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

function Descriptor({ children, color = "#000000", size = 9 }: { children: ReactNode; color?: string; size?: number }) {
  return <span className="block font-light uppercase" style={{ color, fontSize: size, letterSpacing: "0.3em", lineHeight: 1 }}>{children}</span>;
}

export function Lockups() {
  return (
    <Chapter
      n={43}
      lead={
        <p>
          A lockup is the logo with a fixed line of text — the group name, the tagline, the legal name or a
          region. It is built once, in exact proportions, and used as a single unit.
        </p>
      }
      toc={[
        { id: "descriptor", title: "The group lockup" },
        { id: "horizontal", title: "The horizontal lockup" },
        { id: "context", title: "The context header" },
        { id: "tagline", title: "Logo + tagline" },
        { id: "document", title: "The document lockup" },
        { id: "region", title: "Logo + region or company" },
        { id: "lockup-donts", title: "What never to do" },
      ]}
    >
      <Section id="descriptor" title="The group lockup">
        <P>
          The logo with <B>KOLEEX INTERNATIONAL GROUP</B> under it — the lockup on the booth, the hanging banner, the
          invitation, the cup and the VIP card. The line is light and spaced out to exactly the width of the logo,
          in the logo’s own colour.
        </P>
        <Examples cols={2}>
          <Example tone="do" caption="Stacked, on white: black logo, black line." bg="#FFFFFF" h={190}>
            <GroupLockup color="#000000" width={280} />
          </Example>
          <Example tone="do" caption="Stacked, on black: white logo, white line." bg="#000000" h={190}>
            <GroupLockup color="#FFFFFF" width={280} />
          </Example>
        </Examples>
        <Specs rows={[
          ["Text", "KOLEEX INTERNATIONAL GROUP — always in English, always in capitals"],
          ["Typeface", "Inter Light (300), spaced so the line is exactly as wide as the logo"],
          ["Size", "Capital height about 0.2 × the logo's height"],
          ["Gap", "About 0.3 × the logo's height between the logo and the line"],
          ["Colour", "The logo's colour: white on black, black on white — never grey"],
          ["Smallest size", "Logo 40 mm wide in print, 160 px on screen. Smaller: the logo alone, without the line"],
        ]} />
        <Rule why="Four different versions of this line were found on real KOLEEX pieces — light, regular, bold and stacked — because each supplier typed it again.">
          The line is never typed again. It comes from the lockup file, with the logo, as one piece.
        </Rule>
      </Section>

      <Section id="horizontal" title="The horizontal lockup">
        <P>For wide, short spaces — the back of the business card, the e-mail signature, a document header — the name sits beside the logo, after a hairline, on three lines.</P>
        <Examples cols={2}>
          <Example tone="do" caption="On black: the back of the business card." bg="#000000" h={150}>
            <GroupLockup color="#FFFFFF" width={300} horizontal />
          </Example>
          <Example tone="do" caption="On white: e-mail signatures and headers." bg="#FFFFFF" h={150}>
            <GroupLockup color="#000000" width={300} horizontal />
          </Example>
        </Examples>
        <Specs rows={[
          ["Hairline", "The height of the three lines, in the logo's colour"],
          ["Text", "KOLEEX / INTERNATIONAL / GROUP — Inter Light, three lines about 1.5 × the logo's height, centered on it"],
          ["When", "Only where the stacked lockup would be too tall. Everywhere else, the stacked one"],
        ]} />
      </Section>

      <Section id="context" title="The context header">
        <P>The logo, a hairline, then where you are: a product category, an event and its day, a named series, a partner. It opens posts, posters and event photos.</P>
        <Stage bg="#000000" h="auto" pad={28}>
          <div className="flex w-full flex-col gap-4 text-white">
            {[["Lockstitch Sewing Machine"], ["CISMA 2025", "DAY 2"], ["NEXO"], ["Official Announcement"]].map((parts) => (
              <div key={parts.join()} className="flex items-center gap-3">
                <Wordmark color="#FFFFFF" width={96} />
                {parts.map((t, i) => (
                  <span key={t} className="flex items-center gap-3"><span className="h-[16px] w-px bg-white/70" /><span className={`text-[14px] ${i === 0 ? "font-normal" : "font-light"}`}>{t}</span></span>
                ))}
              </div>
            ))}
          </div>
        </Stage>
        <Specs rows={[
          ["Hairline", "The height of the logo's capitals, in the logo's colour, x apart on both sides"],
          ["Text", "Inter Regular, about 0.9 × the logo's height; a second part (the day) in Light"],
          ["Parts", "Two after the logo at most: KOLEEX | CISMA 2025 | DAY 2"],
          ["A partner's logo", "Follows ch. 44 — equal weight, its own colours"],
        ]} />
      </Section>

      <Section id="tagline" title="Logo + tagline">
        <Example tone="do" caption="The tagline follows the same system as the group line." bg="#FFFFFF" h={160}>
          <div className="flex flex-col items-start" style={{ gap: 14 }}>
            <Wordmark color="#000000" width={260} />
            <Descriptor>{KOLEEX_COMPANY.tagline}</Descriptor>
          </div>
        </Example>
        <Note>The current tagline is <B>{KOLEEX_COMPANY.tagline}</B> A new tagline is being prepared (<Ref n={20} />); when it is approved, this lockup changes with it. Never use the group line and the tagline together.</Note>
      </Section>

      <Section id="document" title="The document lockup">
        <P>Every KOLEEX business document opens with the same header: the logo at the start, the document title at the end, and the legal name in English and Chinese over the tagline strip.</P>
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="w-full max-w-[560px]">
            <div className="flex items-center justify-between">
              <Wordmark color="#000000" width={150} />
              <span className="text-[18px] font-bold tracking-[0.06em] text-[#1D1D1F]">QUOTATION</span>
            </div>
            <div className="mt-5 overflow-hidden rounded-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#000000] px-4 py-2 text-[10.5px] text-white">
                <span className="font-semibold tracking-[0.04em]">{KOLEEX_COMPANY.en}</span>
                <span lang="zh-Hans">{KOLEEX_COMPANY.zh}</span>
              </div>
              <div className="bg-[#F5F5F7] px-4 py-1.5 text-[10px] font-semibold tracking-[0.3em] text-[#6E6E73]">{KOLEEX_COMPANY.tagline}</div>
            </div>
          </div>
        </Stage>
        <P>This lockup is built into every document the Hub produces. The full document system is in <Ref n={94} />.</P>
      </Section>

      <Section id="region" title="Logo + region or company">
        <Example tone="do" caption="A region or group company in the same system, after a hairline." bg="#FFFFFF" h={150}>
          <div className="flex items-center" style={{ gap: 18 }}>
            <Wordmark color="#000000" width={200} />
            <span className="h-[28px] w-px bg-[#98989D]" />
            <Descriptor size={12} color="#000000">China</Descriptor>
          </div>
        </Example>
        <P>How group companies are named and shown is set out in <Ref n={16} />.</P>
      </Section>

      <Section id="lockup-donts" title="What never to do">
        <Examples cols={2}>
          <Example tone="dont" caption="Text larger or bolder than the logo." h={140}>
            <div className="flex flex-col items-start gap-1"><Wordmark color="#000000" width={150} /><span className="text-[22px] font-black">MACHINERY</span></div>
          </Example>
          <Example tone="dont" caption="The line typed again — bold, and not the logo's width." h={140}>
            <div className="flex flex-col items-start gap-2"><Wordmark color="#000000" width={170} /><span className="text-[10px] font-bold">KOLEEX INTERNATIONAL GROUP</span></div>
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
    <span className="flex items-center justify-center rounded-md border border-dashed border-[#98989D] text-[9px] font-semibold tracking-[0.14em] text-[#6E6E73]" style={{ width: w, height: 34 }}>
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
            <span className="h-9 w-px bg-[#98989D]" />
            <PartnerBox />
          </div>
        </Stage>
        <Specs rows={[
          ["Order", "KOLEEX first — on the left in English, on the right in Arabic"],
          ["Size", "Equal visual weight: the partner logo is optically as large as ours, never larger"],
          ["Separation", "A hairline divider, with x of space on each side"],
          ["Colors", "Each logo in its own approved version; ours stays black or white"],
          ["A coloured logo on black", "On a white panel or tab — never straight on the black (the Bento board, ch. 80)"],
          ["Maximum", "Three logos in one lockup — beyond that, use a logo wall"],
        ]} />
      </Section>

      <Section id="events" title="Events and partners">
        <Examples cols={2}>
          <Example tone="do" caption="Equal, divided, KOLEEX first." bg="#000000" h={140}>
            <div className="flex items-center gap-6">
              <Wordmark color="#FFFFFF" width={140} />
              <span className="h-8 w-px bg-[#6E6E73]" />
              <span className="flex h-[34px] w-[110px] items-center justify-center rounded-md border border-dashed border-[#6E6E73] text-[9px] font-semibold tracking-[0.14em] text-[#98989D]">ORGANIZER</span>
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
            <span className="text-[10px] tracking-[0.2em] text-[#6E6E73]">A KOLEEX INTERNATIONAL GROUP COMPANY</span>
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
