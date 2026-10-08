"use client";

/* Chapters 36–40: the logo, its construction, size & placement,
   backgrounds & materials, and misuse.

   Every logo on these pages is the official artwork: <Wordmark> (the Hub's
   KoleexLogo component) or, inside a measured diagram, the master SVG file
   itself placed as an <image>. Nothing here redraws a letter. The "don't"
   examples are the official logo with the mistake APPLIED to it (a stretch,
   a colour, an effect) — the way the mistakes actually happen. */

import type { ReactNode } from "react";
import { SILVER, contrast, grade, ratioText } from "@/lib/brand-book/tokens";
import {
  B, Bullets, Chapter, Code, Downloads, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Sub, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { MachineShot } from "../mockups";

const LOGO_W = 719.83;
const LOGO_H = 107.57;
const RATIO = LOGO_W / LOGO_H; // 6.69

const LOGO_FILES = [
  { label: "KOLEEX logo — black (master vector)", href: "/brand/koleex-logo-black.svg", format: "SVG", note: "For light backgrounds. Print, signage, web." },
  { label: "KOLEEX logo — white (master vector)", href: "/brand/koleex-logo-white.svg", format: "SVG", note: "For dark backgrounds." },
  { label: "KOLEEX logo — black, 2000 px", href: "/brand/kit/koleex-logo-black-2000.png", format: "PNG", note: "Transparent. Office documents, slides, social." },
  { label: "KOLEEX logo — white, 2000 px", href: "/brand/kit/koleex-logo-white-2000.png", format: "PNG", note: "Transparent." },
  { label: "Complete logo pack", href: "/brand/kit/koleex-logo-pack.zip", format: "ZIP", note: "All logo files, the logo tiles and the colors." },
];

/** A measured drawing: the master file placed in logo units (1 unit = 1/107.57 x). */
function Diagram({ children, viewBox, dark = false, label }: { children: ReactNode; viewBox: string; dark?: boolean; label: string }) {
  return (
    <svg viewBox={viewBox} className="w-full h-auto" role="img" aria-label={label} style={{ background: dark ? "#000000" : "#FFFFFF" }}>
      {children}
    </svg>
  );
}

function MasterLogo({ x = 0, y = 0, scale = 1, white = false, opacity = 1 }: { x?: number; y?: number; scale?: number; white?: boolean; opacity?: number }) {
  return (
    <image
      href={white ? "/brand/koleex-logo-white.svg" : "/brand/koleex-logo-black.svg"}
      x={x}
      y={y}
      width={LOGO_W * scale}
      height={LOGO_H * scale}
      opacity={opacity}
    />
  );
}

const BLUE = "#8E8E93"; /* construction lines — neutral gray */

/* ── 36 · The Logo ─────────────────────────────────────────────────────── */

export function Logo() {
  const letters: Array<[string, number]> = [["K", 8.1], ["O", 25.4], ["L", 43.2], ["E", 58.6], ["E", 74.1], ["X", 91.8]];
  return (
    <Chapter
      n={36}
      lead={
        <p>
          The KOLEEX logo is a wordmark: the six letters of our name, drawn once and never redrawn. It is
          the most valuable thing the brand owns — it goes on every machine, document, post and booth — so
          it is always reproduced from the master file, in black or in white, and in nothing else.
        </p>
      }
      toc={[
        { id: "wordmark", title: "The wordmark" },
        { id: "anatomy", title: "Anatomy" },
        { id: "versions", title: "The two versions" },
        { id: "logo-not-word", title: "The logo, not the typed word" },
        { id: "files", title: "Master files & formats" },
      ]}
    >
      <Section id="wordmark" title="The wordmark">
        <Stage bg="#FFFFFF" h={260}><Wordmark color="#000000" width="72%" /></Stage>
        <Rule why="The letters are custom-drawn: no font reproduces them. A typed or traced copy is a different mark — and every copy that drifts weakens the one that is protected.">
          Always use the master file. Never type, trace, redraw, rebuild or edit the logo.
        </Rule>
      </Section>

      <Section id="anatomy" title="Anatomy">
        <Stage bg="#FFFFFF" h="auto" pad={28}>
          <div className="w-full">
            <div className="relative mx-auto" style={{ width: "86%" }}>
              <Wordmark color="#000000" width="100%" />
              <div className="relative mt-3 h-5">
                {letters.map(([l, at], i) => (
                  <span key={i} className="absolute -translate-x-1/2 font-mono text-[11px] text-[#6E6E73]" style={{ left: `${at}%` }}>{l}</span>
                ))}
              </div>
            </div>
          </div>
        </Stage>
        <Table
          head={["Feature", "What it is"]}
          rows={[
            [<B key="a">Proportion</B>, `Wide and horizontal: ${RATIO.toFixed(2)} times as wide as it is tall.`],
            [<B key="a">One stroke</B>, "Every letter uses the same stroke — 13.6% of the letter height — so the logo holds together at any size."],
            [<B key="a">Soft geometry</B>, "O, L and E have rounded corners; K and X are sharp. Engineering precision with a human touch."],
            [<B key="a">The X peak</B>, "A solid triangle closes the X at the baseline — the signature detail. It is part of the logo; it is never removed, outlined or colored."],
          ]}
        />
      </Section>

      <Section id="versions" title="The two versions">
        <P>The logo exists in exactly two colors. There is no color version.</P>
        <Examples cols={2}>
          <Example tone="do" caption={<><B>Positive.</B> Black (#000000) on white and light backgrounds.</>} bg="#FFFFFF" h={160}><Wordmark color="#000000" width="62%" /></Example>
          <Example tone="do" caption={<><B>Negative.</B> White (#FFFFFF) on black and dark backgrounds.</>} bg="#000000" h={160}><Wordmark color="#FFFFFF" width="62%" /></Example>
          <Example tone="dont" caption="Never in Hub Blue or silver — the logo is black or white, nothing else." bg="#FFFFFF" h={140}><Wordmark color="#567FB2" width="62%" /></Example>
          <Example tone="dont" caption="Never grey, never tinted, never in a gradient." bg="#FFFFFF" h={140}><Wordmark color="#98989D" width="62%" /></Example>
        </Examples>
      </Section>

      <Section id="logo-not-word" title="The logo, not the typed word">
        <Rule why="Readers recognise the drawn letters, not the spelling. A typed KOLEEX in a headline looks like someone else's brand.">
          Where the brand signs something — a cover, a header, a post, a product, a sign — use the logo.
          Never type the word KOLEEX in its place.
        </Rule>
        <Examples cols={2}>
          <Example tone="do" caption="The logo signs the poster." bg="#000000" h={220} pad={0}>
            <div className="flex h-[220px] w-full flex-col justify-between p-6 text-white">
              <p className="text-[10px] tracking-[0.18em] text-[#98989D]">LOCKSTITCH · NEW SERIES</p>
              <p className="text-[22px] font-bold leading-tight">Direct-drive<br />lockstitch.</p>
              <Wordmark color="#FFFFFF" width={120} />
            </div>
          </Example>
          <Example tone="dont" caption="The word typed in a font where the logo should be." bg="#000000" h={220} pad={0}>
            <div className="flex h-[220px] w-full flex-col justify-between p-6 text-white">
              <p className="text-[10px] tracking-[0.18em] text-[#98989D]">LOCKSTITCH · NEW SERIES</p>
              <p className="text-[22px] font-bold leading-tight">Direct-drive<br />lockstitch.</p>
              <span style={{ fontFamily: "Arial, sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: "0.12em" }}>KOLEEX</span>
            </div>
          </Example>
        </Examples>
        <Note>In a sentence, the name is written as a word — how to write it is in <Ref n={18} />.</Note>
      </Section>

      <Section id="files" title="Master files & formats">
        <Table
          head={["Use", "File", "Why"]}
          rows={[
            ["Print, signage, embroidery, laser", <Code key="f">SVG</Code>, "Vector: sharp at any size. The vendor works from it and never alters it."],
            ["Websites and apps", <Code key="f">SVG</Code>, "Sharp on every screen, tiny file."],
            ["Word, PowerPoint, Excel", <Code key="f">PNG 2000 px</Code>, "Office apps handle PNG best. Scale down, never up."],
            ["Social media, WhatsApp, WeChat", <Code key="f">PNG</Code>, "Upload the size closest to what is shown."],
            ["Very large formats (banners, walls)", <Code key="f">SVG</Code>, "Raster files blur at large sizes."],
          ]}
        />
        <Downloads items={LOGO_FILES} />
      </Section>
    </Chapter>
  );
}

/* ── 37 · Construction & Clear Space ───────────────────────────────────── */

export function Construction() {
  const x = LOGO_H;
  return (
    <Chapter
      n={37}
      lead={
        <p>
          The logo is measured in one unit: <B>x</B>, the height of the logo. Clear space, minimum sizes and
          placements are all multiples of x, so the rules work the same on a business card and on a
          building.
        </p>
      }
      toc={[
        { id: "proportions", title: "Proportions" },
        { id: "clear-space", title: "Clear space" },
        { id: "measuring", title: "Measuring x in practice" },
        { id: "alignment", title: "Aligning the logo" },
      ]}
    >
      <Section id="proportions" title="Proportions">
        <Stage bg="#FFFFFF" h="auto" pad={16}>
          <Diagram viewBox={`-120 -70 ${LOGO_W + 190} ${LOGO_H + 190}`} label="Logo proportions: height x, width 6.69x">
            <MasterLogo />
            {/* height */}
            <line x1={-40} y1={0} x2={-40} y2={x} stroke={BLUE} strokeWidth={2} />
            <line x1={-52} y1={0} x2={-28} y2={0} stroke={BLUE} strokeWidth={2} />
            <line x1={-52} y1={x} x2={-28} y2={x} stroke={BLUE} strokeWidth={2} />
            <text x={-72} y={x / 2 + 10} fontSize={30} fill={BLUE} textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={600}>x</text>
            {/* width */}
            <line x1={0} y1={x + 40} x2={LOGO_W} y2={x + 40} stroke={BLUE} strokeWidth={2} />
            <line x1={0} y1={x + 28} x2={0} y2={x + 52} stroke={BLUE} strokeWidth={2} />
            <line x1={LOGO_W} y1={x + 28} x2={LOGO_W} y2={x + 52} stroke={BLUE} strokeWidth={2} />
            <text x={LOGO_W / 2} y={x + 88} fontSize={28} fill={BLUE} textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={600}>{RATIO.toFixed(2)}x</text>
          </Diagram>
        </Stage>
        <Specs rows={[
          ["Unit", "x = the height of the logo"],
          ["Width", `${RATIO.toFixed(2)} x`],
          ["Stroke", "0.136 x — the same in every letter"],
          ["Master artboard", `${LOGO_W} × ${LOGO_H} (koleex-logo-black.svg)`],
        ]} />
      </Section>

      <Section id="clear-space" title="Clear space">
        <Stage bg="#FFFFFF" h="auto" pad={16}>
          <Diagram viewBox={`${-x - 60} ${-x - 50} ${LOGO_W + 2 * x + 120} ${LOGO_H + 2 * x + 100}`} label="Clear space of x on every side">
            <rect x={-x} y={-x} width={LOGO_W + 2 * x} height={LOGO_H + 2 * x} fill="#D1D1D6" fillOpacity={0.35} stroke={BLUE} strokeWidth={2} strokeDasharray="10 8" />
            <MasterLogo />
            {[
              [-x / 2, LOGO_H / 2], [LOGO_W + x / 2, LOGO_H / 2], [LOGO_W / 2, -x / 2], [LOGO_W / 2, LOGO_H + x / 2],
            ].map(([cx, cy], i) => (
              <text key={i} x={cx} y={cy + 11} fontSize={30} fill={BLUE} textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={600}>x</text>
            ))}
          </Diagram>
        </Stage>
        <Rule why="Space is what makes the logo look confident. Crowded, it looks like one more item on the page.">
          Keep a clear space of at least <B>x</B> on every side. Nothing enters it — no text, no image
          detail, no other logo, no edge of the page.
        </Rule>
        <Specs rows={[
          ["Standard clear space", "1 x on every side"],
          ["Reduced clear space", "0.5 x — only in tight technical spaces: app headers, nameplates, product labels, table headers"],
          ["Page edge", "At least 1 x from any trimmed edge"],
        ]} />
        <Examples cols={2}>
          <Example tone="do" caption="Clear space kept: the logo has room." bg="#FFFFFF" h={180}>
            <div className="flex w-full flex-col items-start gap-6 px-6">
              <Wordmark color="#000000" width={150} />
              <p className="max-w-[260px] text-[12px] leading-5 text-[#6E6E73]">Industrial garment machinery for manufacturers in more than seventy countries.</p>
            </div>
          </Example>
          <Example tone="dont" caption="Text crowding the logo, inside its clear space." bg="#FFFFFF" h={180}>
            <div className="flex w-full flex-col items-start gap-0.5 px-6">
              <Wordmark color="#000000" width={150} />
              <p className="max-w-[260px] text-[12px] leading-5 text-[#6E6E73]">Industrial garment machinery for manufacturers in more than seventy countries.</p>
            </div>
          </Example>
          <Example tone="dont" caption="The logo touching the edge of the page." bg="#FFFFFF" h={140} pad={0}>
            <div className="flex h-[140px] w-full items-start justify-start"><Wordmark color="#000000" width={150} /></div>
          </Example>
          <Example tone="dont" caption="Another logo inside the clear space." bg="#FFFFFF" h={140}>
            <div className="flex items-center gap-2">
              <Wordmark color="#000000" width={130} />
              <span className="flex h-7 w-20 items-center justify-center rounded border border-[#98989D] text-[9px] font-semibold tracking-wider text-[#6E6E73]">PARTNER</span>
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="measuring" title="Measuring x in practice">
        <P>x is the logo width divided by {RATIO.toFixed(2)}. For the common sizes:</P>
        <Table
          head={["Logo width", "x (height)", "Clear space on every side"]}
          rows={[
            ["25 mm (minimum in print)", "3.7 mm", "3.7 mm"],
            ["40 mm (business card front)", "6.0 mm", "6.0 mm"],
            ["45 mm (documents)", "6.7 mm", "6.7 mm"],
            ["100 mm", "14.9 mm", "14.9 mm"],
            ["100 px (minimum on screen)", "15 px", "15 px"],
            ["240 px (social post)", "36 px", "36 px"],
            ["1000 px", "149 px", "149 px"],
          ]}
        />
      </Section>

      <Section id="alignment" title="Aligning the logo">
        <Bullets items={[
          <>Align the logo by the <B>straight left edge of the K</B> to the same margin as the text and images below it.</>,
          <>When the logo sits beside text, align its <B>baseline</B> with the text baseline.</>,
          <>In centered layouts, center the logo on its full width — the X peak needs no optical correction.</>,
          <>Next to a headline, the logo height is never smaller than the headline’s capital height.</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 38 · Size & Placement ─────────────────────────────────────────────── */

function MiniPage({ w, h, bg = "#FFFFFF", children }: { w: number; h: number; bg?: string; children: ReactNode }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-md shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ width: w, height: h, background: bg }}>
      {children}
    </div>
  );
}

function Lines({ dark = false, n = 3, w = "70%" }: { dark?: boolean; n?: number; w?: string }) {
  return (
    <div className="space-y-1.5" style={{ width: w }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-1.5 rounded-full" style={{ background: dark ? "#1D1D1F" : "#D2D2D7", width: i === n - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}

export function SizePlacement() {
  return (
    <Chapter
      n={38}
      lead={
        <p>
          Big enough to read, small enough to breathe — and always in the same place within a series. This
          chapter gives the minimum sizes for every medium and the recommended size and position for the
          formats we use most.
        </p>
      }
      toc={[
        { id: "minimum", title: "Minimum sizes" },
        { id: "recommended", title: "Recommended sizes by format" },
        { id: "placement", title: "Where the logo goes" },
        { id: "series", title: "The same place in a series" },
        { id: "rtl", title: "Arabic (right-to-left) layouts" },
      ]}
    >
      <Section id="minimum" title="Minimum sizes">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="flex w-full flex-wrap items-end gap-8">
            {[200, 140, 100].map((w) => (
              <div key={w} className="flex flex-col items-start gap-2">
                <Wordmark color="#000000" width={w} />
                <span className="font-mono text-[10.5px] text-[#6E6E73]">{w} px{w === 100 ? " — minimum" : ""}</span>
              </div>
            ))}
            <div className="flex flex-col items-start gap-2">
              <Wordmark color="#000000" width={56} />
              <span className="font-mono text-[10.5px] text-[#DC2626]">56 px — too small</span>
            </div>
          </div>
        </Stage>
        <Table
          head={["Medium", "Minimum logo width", "Below the minimum"]}
          rows={[
            ["Screens (web, apps, social)", <B key="a">100 px</B>, "Make the space bigger — or use the logo tile (ch. 41)"],
            ["Print (offset, digital)", <B key="a">25 mm</B>, "Make the piece bigger, or leave the logo off"],
            ["Screen printing on fabric", <B key="a">40 mm</B>, "Move it to a larger area of the garment"],
            ["Embroidery", <B key="a">50 mm</B>, "Move it to a larger area of the garment"],
            ["Laser engraving, etching, pad printing", <B key="a">20 mm</B>, "Along the long side of the object, or no mark"],
          ]}
        />
        <Note>Below the minimum, the thin strokes fill in and the X loses its shape. There is no smaller mark: use more space, or leave the logo off — <Ref n={41} />.</Note>
      </Section>

      <Section id="recommended" title="Recommended sizes by format">
        <Table
          head={["Format", "Logo width", "Position"]}
          rows={[
            ["House document (210 × 270 mm)", "45 mm", "Top-left; document title top-right"],
            ["Business card (90 × 54 mm)", "40 mm front · 25 mm back", "Centered on the front; top-left on the back"],
            ["Presentation (1920 × 1080 px)", "480 px cover · 200 px content slides", "Centered on the cover; top-left on content slides"],
            ["Social post (1080 × 1350 px)", "200–240 px", "Top-left; top-right when the image needs the left side"],
            ["Story / reel cover (1080 × 1920 px)", "240 px", "Top-left (or top-right), at least 250 px below the top edge"],
            ["Website header", "120–140 px", "Top-left (top-right in Arabic)"],
            ["Email signature", "120 px", "Above the contact lines"],
            ["Roll-up banner (850 × 2000 mm)", "500 mm", "Top, centered"],
            ["Booth fascia", "60% of the fascia height is the maximum logo height", "Centered"],
          ]}
        />
        <P>Machines, nameplates and packaging have their own sizes — <Ref n={107} /> and <Ref n={110} />.</P>
      </Section>

      <Section id="placement" title="Where the logo goes">
        <Rule why="A logo that always appears in the same place is recognised before it is read.">
          The logo sits <B>top-left</B> on documents, posts, stories, ads and posters — <B>top-right</B> when the
          image needs the left side. Covers take it <B>centered</B>, or in the <B>calm area of the image</B>,
          aligned to a grid column. Business cards, signs and packaging fronts: centered. On a post it is never
          centered, never at the bottom, and never squeezed into a far corner.
        </Rule>
        <Examples cols={3}>
          <Example tone="do" caption="Document: top-left." bg="#F5F5F7" h={200}>
            <MiniPage w={120} h={154}>
              <div className="absolute left-3 top-3"><Wordmark color="#000000" width={40} /></div>
              <div className="absolute right-3 top-3 text-[6px] font-bold tracking-wider">QUOTATION</div>
              <div className="absolute left-3 top-12 w-[96px]"><Lines n={5} w="100%" /></div>
            </MiniPage>
          </Example>
          <Example tone="do" caption="Post, ad, poster: top-left." bg="#F5F5F7" h={200}>
            <MiniPage w={124} h={155} bg="#000000">
              <div className="absolute left-3 top-3"><Wordmark color="#FFFFFF" width={36} /></div>
              <div className="absolute left-3 top-9 text-[5px] tracking-[0.2em] text-[#98989D]">OVERLOCK</div>
              <div className="absolute left-3 top-[46px] text-[11px] font-semibold leading-tight text-white">Four threads.<br />One pass.</div>
              <div className="absolute inset-x-3 bottom-3"><MachineShot w="100%" label={false} logo={false} /></div>
            </MiniPage>
          </Example>
          <Example tone="do" caption="Top-right, when the image needs the left side." bg="#F5F5F7" h={200}>
            <MiniPage w={124} h={155} bg="#000000">
              <div className="absolute inset-y-0 left-0 w-[58%]"><div className="absolute bottom-0 left-3 h-[70%] w-[80%] rounded-t-[40px] bg-[#3A3A3C]" /><div className="absolute left-[26px] top-[34px] h-[30px] w-[30px] rounded-full bg-[#636366]" /></div>
              <div className="absolute right-3 top-3"><Wordmark color="#FFFFFF" width={36} /></div>
              <div className="absolute right-3 top-[70px] text-right text-[9px] font-semibold leading-tight text-white">Built for Change<br /><span className="font-light">Powered by Vision</span></div>
            </MiniPage>
          </Example>
          <Example tone="do" caption="Plain cover: centered." bg="#F5F5F7" h={200}>
            <MiniPage w={120} h={154} bg="#000000">
              <div className="absolute inset-0 flex items-center justify-center"><Wordmark color="#FFFFFF" width={64} /></div>
            </MiniPage>
          </Example>
          <Example tone="do" caption="Cover with an image: in its calm area, on a grid column." bg="#F5F5F7" h={200}>
            <MiniPage w={154} h={109} bg="#000000">
              <div className="absolute -bottom-6 -left-6 h-[90px] w-[90px] rounded-full" style={{ boxShadow: "inset 0 0 0 10px #2C2C2E" }} />
              <div className="absolute -bottom-10 left-6 h-[110px] w-[110px] rounded-full" style={{ boxShadow: "inset 0 0 0 7px #1C1C1E" }} />
              <div className="absolute right-4 top-[38px]"><Wordmark color="#FFFFFF" width={58} /></div>
            </MiniPage>
          </Example>
          <Example tone="dont" caption="A post: centered, at the bottom, or squeezed at the edge." bg="#F5F5F7" h={200}>
            <MiniPage w={124} h={155} bg="#000000">
              <div className="absolute left-3 top-4 text-[11px] font-semibold leading-tight text-white">Four threads.<br />One pass.</div>
              <div className="absolute bottom-2 right-0.5"><Wordmark color="#FFFFFF" width={36} /></div>
            </MiniPage>
          </Example>
        </Examples>
      </Section>

      <Section id="series" title="The same place in a series">
        <Examples cols={2}>
          <Example tone="do" caption="One position across the series — the feed reads as one brand." bg="#F5F5F7" h={150}>
            <div className="flex gap-2">
              {["Lockstitch", "Overlock", "Cutting"].map((t) => (
                <MiniPage key={t} w={78} h={98} bg="#000000">
                  <div className="absolute left-2 top-2"><Wordmark color="#FFFFFF" width={26} /></div>
                  <div className="absolute left-2 top-7 text-[8px] font-semibold text-white">{t}</div>
                </MiniPage>
              ))}
            </div>
          </Example>
          <Example tone="dont" caption="A different position on every post." bg="#F5F5F7" h={150}>
            <div className="flex gap-2">
              {[["left-2 bottom-2"], ["right-2 top-2"], ["left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"]].map(([pos], i) => (
                <MiniPage key={i} w={78} h={98} bg="#000000">
                  <div className="absolute left-2 top-7 text-[8px] font-semibold text-white">{["Lockstitch", "Overlock", "Cutting"][i]}</div>
                  <div className={`absolute ${pos}`}><Wordmark color="#FFFFFF" width={26} /></div>
                </MiniPage>
              ))}
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="rtl" title="Arabic (right-to-left) layouts">
        <Rule why="Arabic readers start at the right. The layout mirrors so the brand is still the first thing they meet — but the logo is Latin artwork, so it is never flipped.">
          In Arabic layouts the page mirrors and the logo moves to the <B>top-right</B>. The logo itself is
          never mirrored, and its letters always read left to right.
        </Rule>
        <Examples cols={2}>
          <Example tone="do" caption="English layout: logo top-left." bg="#F5F5F7" h={170}>
            <MiniPage w={180} h={120}>
              <div className="absolute left-3 top-3"><Wordmark color="#000000" width={52} /></div>
              <div className="absolute left-3 top-10 w-[150px]"><Lines n={4} w="100%" /></div>
            </MiniPage>
          </Example>
          <Example tone="do" caption="Arabic layout: logo top-right, logo not mirrored." bg="#F5F5F7" h={170}>
            <MiniPage w={180} h={120}>
              <div className="absolute right-3 top-3"><Wordmark color="#000000" width={52} /></div>
              <div className="absolute right-3 top-10 flex w-[150px] justify-end"><Lines n={4} w="100%" /></div>
            </MiniPage>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 39 · Backgrounds & Materials ──────────────────────────────────────── */

function ContrastTag({ fg, bg }: { fg: string; bg: string }) {
  const r = contrast(fg, bg);
  const g = grade(r);
  return (
    <span className="ms-1 font-mono text-[11px] text-[var(--text-dim)]">
      {ratioText(r)} · {g === "Fail" ? "too low" : g}
    </span>
  );
}

export function Backgrounds() {
  const good: Array<[string, string, string]> = [
    ["#FFFFFF", "#000000", "White"],
    ["#F5F5F7", "#000000", "Cloud #F5F5F7"],
    ["#D2D2D7", "#000000", "Mist #D2D2D7"],
    ["#000000", "#FFFFFF", "Black #000000"],
    ["#1D1D1F", "#FFFFFF", "Graphite #1D1D1F"],
  ];
  return (
    <Chapter
      n={39}
      lead={
        <p>
          The logo needs contrast and calm. It sits on white, on black and on the quiet greys of the palette
          — and on a photograph only where the photograph is quiet enough to let it.
        </p>
      }
      toc={[
        { id: "approved", title: "Approved backgrounds" },
        { id: "not-approved", title: "Backgrounds to avoid" },
        { id: "photos", title: "On photographs" },
        { id: "materials", title: "Materials & production" },
      ]}
    >
      <Section id="approved" title="Approved backgrounds">
        <Rule why="At 4.5 : 1 contrast or more, the logo reads at a glance — on paper, on a phone in sunlight, across a hall.">
          Black logo on white or light grey. White logo on black or dark grey. The contrast between the logo
          and what is directly behind it is at least <B>4.5 : 1</B>.
        </Rule>
        <Examples cols={3}>
          {good.map(([bg, fg, name]) => (
            <Example key={bg} tone="do" caption={<>{name}<ContrastTag fg={fg} bg={bg} /></>} bg={bg} h={130}>
              <Wordmark color={fg} width="66%" />
            </Example>
          ))}
        </Examples>
      </Section>

      <Section id="not-approved" title="Backgrounds to avoid">
        <Examples cols={3}>
          <Example tone="dont" caption={<>Mid grey — neither version reads.<ContrastTag fg="#FFFFFF" bg="#98989D" /></>} bg="#98989D" h={130}><Wordmark color="#FFFFFF" width="66%" /></Example>
          <Example tone="dont" caption={<>White logo on Steel or Sky blue.<ContrastTag fg="#FFFFFF" bg="#7FA9D6" /></>} bg="#7FA9D6" h={130}><Wordmark color="#FFFFFF" width="66%" /></Example>
          <Example tone="dont" caption="The Hub gradient behind the logo." bg="#567FB2" h={130} >
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,#567FB2,#BCD8F0)" }} />
            <span className="relative"><Wordmark color="#FFFFFF" width={170} /></span>
          </Example>
          <Example tone="dont" caption="Strong colors — red, green, orange." bg="#DC2626" h={130}><Wordmark color="#FFFFFF" width="66%" /></Example>
          <Example tone="dont" caption="Patterns and textures." bg="#FFFFFF" h={130}>
            <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(45deg,#000000 0 6px,#FFFFFF 6px 14px)" }} />
            <span className="relative"><Wordmark color="#000000" width={170} /></span>
          </Example>
          <Example tone="dont" caption="On a silver gradient — silver is for words and surfaces, never behind the logo." bg="#000000" h={130}>
            <div className="absolute inset-0" style={{ background: SILVER.css }} />
            <span className="relative"><Wordmark color="#FFFFFF" width={170} /></span>
          </Example>
          <Example tone="dont" caption="Low contrast of any kind.">
            <Wordmark color="#D2D2D7" width="66%" />
          </Example>
        </Examples>
      </Section>

      <Section id="photos" title="On photographs">
        <Rule why="A photograph is already busy. The logo has to win the small area it sits on, or it disappears.">
          Place the logo on the calmest area of the photograph — sky, wall, floor, a plain surface — with at
          least 4.5 : 1 contrast behind it. If there is no calm area, darken that area with a black overlay
          of 30–60%, or do not put the logo on the photograph.
        </Rule>
        <Examples cols={2}>
          <Example tone="do" caption="Calm, dark area of the image; logo at the start corner." bg="#000000" h={200} pad={0}>
            <div className="relative h-[200px] w-full" style={{ background: "radial-gradient(120% 90% at 80% 20%, #6E6E73 0%, #1D1D1F 45%, #000000 100%)" }}>
              <div className="absolute bottom-5 left-5"><Wordmark color="#FFFFFF" width={120} /></div>
              <span className="absolute right-3 top-3 rounded bg-black/40 px-1.5 py-0.5 text-[9px] tracking-wider text-[#98989D]">PHOTO</span>
            </div>
          </Example>
          <Example tone="dont" caption="Over detail, faces or the product itself." bg="#6E6E73" h={200} pad={0}>
            <div className="relative h-[200px] w-full" style={{ background: "repeating-radial-gradient(circle at 40% 50%, #98989D 0 8px, #6E6E73 8px 16px, #D2D2D7 16px 22px)" }}>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><Wordmark color="#FFFFFF" width={130} /></div>
              <span className="absolute right-3 top-3 rounded bg-black/40 px-1.5 py-0.5 text-[9px] tracking-wider text-white">PHOTO</span>
            </div>
          </Example>
        </Examples>
        <Note>Photographs in this book are placeholders until our own photo library is shot — see <Ref n={63} />.</Note>
      </Section>

      <Section id="materials" title="Materials & production">
        <Rule why="Effects imitate materials badly and age fast. One flat color reads on every material, from 3 m or 30 m.">
          Whatever the method, the logo is one flat color: black, white — or, where it is engraved, debossed or
          frosted, the material’s own tone. Never silver, gold, chrome, colored or lit in color.
        </Rule>
        <Specs
          title="Every production"
          rows={[
            ["Artwork", "The master vector file only (SVG, PDF or EPS from ch. 136) — never a screenshot, a PNG or a redraw"],
            ["Sample first", "A physical sample — a sew-out, a proof, a test engraving, a lit letter — approved before the run"],
            ["Approval", "Marketing Manager, then the Founder & CEO (ch. 134)"],
          ]}
        />

        <Sub title="Embroidery — uniforms, caps, bags">
          <Specs rows={[
            ["Minimum width", "50 mm — below it the strokes are thinner than 1 mm and fill in"],
            ["Sizes", "Left chest 70–80 mm · cap front 60–70 mm · sleeve 50–60 mm · back 200–250 mm"],
            ["Thread", "Matte polyester, one color: white on dark fabric, black on light — never metallic thread"],
            ["Stitch", "Flat satin stitch, the X triangle filled; the digitizer works from the vector file"],
            ["Never", "3D puff, outline-only stitching, a patch border around the logo"],
          ]} />
        </Sub>

        <Sub title="Woven labels, patches and prints on fabric">
          <Specs rows={[
            ["Woven label", "Damask weave, black ground, white logo; logo at least 25 mm wide"],
            ["Rubber or silicone patch", "Black, logo white and flat — one level, no bevel"],
            ["Screen print or DTF", "Minimum 40 mm; plastisol or water-based ink, matte, black or white"],
          ]} />
        </Sub>

        <Sub title="Metal — laser engraving, etching, plates">
          <Specs rows={[
            ["Minimum width", "20 mm (fine laser); 30 mm for deep engraving or chemical etching"],
            ["Bare steel or aluminium", "Black laser marking — the logo reads dark on the metal"],
            ["Anodized or painted metal", "Engraving opens the surface: the logo reads white on black anodizing"],
            ["Deep engraving", "0.1–0.3 mm deep, filled black or white — or left in the metal’s tone on dark metal"],
            ["Never", "Polished chrome, mirror, gold or silver-look logos; raised polished letters"],
          ]} />
          <P>Machine bodies and nameplates: <Ref n={107} /> and <Ref n={108} />.</P>
        </Sub>

        <Sub title="Illuminated signs — buildings, showroom, booths">
          <Specs rows={[
            ["The KOLEEX sign", "Halo-lit 3D letters: the light is behind the letters, on the wall — never through them"],
            ["Letters and wall", "Black letters on a light wall; on a dark wall, white letters. The wall is plain, one color"],
            ["Light", "Pure white, 6000–6500 K, even — no hot spots, no visible LEDs"],
            ["Never", "Face-lit letters, light boxes, colored, RGB or blue light, flashing or animation, neon-look tubes, stainless or chrome letters"],
            ["Size", "Letter height about 25 mm for every 3 m of reading distance — 250 mm letters read from 30 m"],
            ["Letters", "50–100 mm deep; halo-lit letters stand 30–50 mm off the wall"],
            ["Day and night", "By day the letters read on the wall; by night they stand in a soft white halo"],
          ]} />
          <P>Where the law asks for a local name on a sign, it is set in type beside the logo — <Ref n={117} />.</P>
        </Sub>

        <Sub title="Paper — print, foil, emboss">
          <Specs rows={[
            ["Print", "Offset or digital; black K100 or a white knock-out; minimum 25 mm"],
            ["Foil", "Black or white foil only — silver foil is for words and lines, never the logo"],
            ["Emboss or deboss", "Blind (the paper’s own tone) or with white or black foil on top — the business card (ch. 91); minimum 30 mm, board 350 g/m² or more"],
            ["Painted edges", "Silver (Pantone 877 C) on thick board, 600 g/m² or more — the edge is material, not the logo"],
          ]} />
        </Sub>

        <Sub title="Glass, walls and vehicles">
          <Specs rows={[
            ["Glass", "Frosted vinyl or acid etching; minimum 60 mm; at eye height on doors"],
            ["Walls", "Cut matte vinyl or paint through a stencil, black or white"],
            ["Vehicles", "Matte cut vinyl, never printed on a colored panel — ch. 120"],
          ]} />
        </Sub>

        <Sub title="Leather, wood, gifts and packaging">
          <Specs rows={[
            ["Leather", "Blind deboss or laser, the leather’s own tone; minimum 30 mm"],
            ["Wood", "Laser engraving, the wood’s own tone; minimum 25 mm"],
            ["Pens, mugs, USB, bottles", "Pad print or laser, one color; minimum 20 mm — ch. 123"],
            ["Cartons and tape", "One-color flexo print, black; minimum 80 mm on a carton — ch. 110"],
          ]} />
        </Sub>

        <Sub title="Screens and LED walls">
          <Specs rows={[
            ["Background", "Black, the logo white — the bright logo on a dark wall"],
            ["Minimum", "100 px wide on any screen (ch. 38); on an LED wall, at least 12 LED rows tall"],
            ["Motion", "Only the Focus animation (ch. 73) — never spinning, pulsing or scrolling"],
          ]} />
        </Sub>
      </Section>
    </Chapter>
  );
}

/* ── 40 · Misuse ───────────────────────────────────────────────────────── */

type Mis = { caption: string; bg?: string; render: ReactNode };

export function Misuse() {
  const W = 150;
  const cases: Mis[] = [
    { caption: "Stretched.", render: <Wordmark color="#000000" width={112} style={{ transform: "scaleX(1.4)" }} /> },
    { caption: "Squashed.", render: <Wordmark color="#000000" width={112} style={{ transform: "scaleY(1.9)" }} /> },
    { caption: "Rotated or tilted.", render: <Wordmark color="#000000" width={W} style={{ transform: "rotate(-12deg)" }} /> },
    { caption: "Recolored.", render: <Wordmark color="#DC2626" width={W} /> },
    { caption: "In Hub Blue.", render: <Wordmark color="#567FB2" width={W} /> },
    {
      caption: "In silver, chrome or a gradient.",
      bg: "#000000",
      render: (
        <span
          role="img"
          aria-label="KOLEEX logo filled with a silver gradient"
          className="block"
          style={{
            width: W,
            aspectRatio: "719.83 / 107.57",
            background: SILVER.css,
            WebkitMask: "url(/brand/koleex-logo-black.svg) center / contain no-repeat",
            mask: "url(/brand/koleex-logo-black.svg) center / contain no-repeat",
          }}
        />
      ),
    },
    {
      caption: "Outlined.",
      render: (
        <Wordmark
          color="#FFFFFF"
          width={W}
          style={{ filter: "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)" }}
        />
      ),
    },
    { caption: "With a drop shadow.", render: <Wordmark color="#000000" width={W} style={{ filter: "drop-shadow(4px 5px 3px rgba(0,0,0,0.45))" }} /> },
    { caption: "With a glow or neon.", bg: "#000000", render: <Wordmark color="#FFFFFF" width={W} style={{ filter: "drop-shadow(0 0 6px #7FA9D6) drop-shadow(0 0 14px #567FB2)" }} /> },
    {
      caption: "Made 3D, bevelled or metallic.",
      render: (
        <Wordmark
          color="#98989D"
          width={W}
          style={{ filter: "drop-shadow(1px 1px 0 #6E6E73) drop-shadow(1px 1px 0 #6E6E73) drop-shadow(2px 2px 0 #1D1D1F)", transform: "skewX(-10deg)" }}
        />
      ),
    },
    { caption: "Typed in a font.", render: <span style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: "0.1em", color: "#000" }}>KOLEEX</span> },
    {
      caption: "Cropped or partly hidden.",
      render: <span className="block overflow-hidden" style={{ width: W * 0.62 }}><Wordmark color="#000000" width={W} /></span>,
    },
    { caption: "Too little contrast.", bg: "#D2D2D7", render: <Wordmark color="#98989D" width={W} /> },
    {
      caption: "Inside a badge or a seal. The plain logo tile (ch. 41) is the only container.",
      render: (
        <span className="flex h-[92px] w-[92px] flex-col items-center justify-center gap-1 rounded-full border-[3px] border-double border-[#000000]">
          <Wordmark color="#000000" width={60} />
          <span className="text-[7px] font-semibold tracking-[0.2em] text-[#000000]">QUALITY</span>
        </span>
      ),
    },
    {
      caption: "Words added to the logo.",
      render: (
        <span className="flex flex-col items-start">
          <Wordmark color="#000000" width={W} />
          <span className="text-[9px] tracking-[0.3em] text-[#6E6E73]" style={{ marginTop: 1 }}>INDUSTRIAL TOOLS</span>
        </span>
      ),
    },
    { caption: "Smaller than the minimum size.", render: <Wordmark color="#000000" width={44} /> },
  ];

  return (
    <Chapter
      n={40}
      lead={
        <p>
          Every mistake on this page has already happened somewhere. The logo is changed in none of these
          ways — not for a special occasion, not for a single post, not because a layout “needs it”.
        </p>
      }
      toc={[
        { id: "never", title: "Sixteen things never to do" },
        { id: "if-it-seems-to-need-it", title: "If a layout seems to need it" },
      ]}
    >
      <Section id="never" title="Sixteen things never to do">
        <Examples cols={3}>
          {cases.map((c) => (
            <Example key={c.caption} tone="dont" caption={c.caption} bg={c.bg ?? "#FFFFFF"} h={130}>
              {c.render}
            </Example>
          ))}
        </Examples>
      </Section>
      <Section id="if-it-seems-to-need-it" title="If a layout seems to need it">
        <Rule why="The logo is the one fixed point every design is built around.">
          When the logo does not fit a design, the design changes — never the logo.
        </Rule>
        <Bullets items={[
          <>Too little room? Give the logo more space, or use the logo tile (<Ref n={41} />).</>,
          <>Background too busy? Move the logo to a calm area, or use a solid band of white or black behind it (<Ref n={39} />).</>,
          <>Want more presence? Put the logo on black, give it more space, or set a silver headline near it — never color in it (<Ref n={45} />).</>,
          <>Need a line of text with the logo? Use an approved lockup (<Ref n={43} />).</>,
        ]} />
      </Section>
    </Chapter>
  );
}
