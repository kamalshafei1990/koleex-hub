"use client";

/* Chapters 55–57: grid & layout, spacing & shapes, graphic elements.

   Owner decisions (27/09/2026): generous space; corners 20–28 px; a
   centered hero with the headline on top and the machine below; no Hub
   line and no peak. After the review of the real KOLEEX work (27/09/2026)
   the kit also has five brand elements: the KOLEEX edge, the light line,
   the X stroke, the dots and white 3D objects for occasions. */

import { useId, type ReactNode } from "react";
import { SILVER } from "@/lib/brand-book/tokens";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { MachineShot } from "../mockups";

const GUIDE = "#8E8E93";

/** A page drawn to scale with its margins and columns overlaid. */
function GridSheet({ w, h, margin, cols, gutter, dark = false, label, children }: {
  w: number; h: number; margin: number; cols: number; gutter: number; dark?: boolean; label: string; children?: ReactNode;
}) {
  const inner = w - margin * 2;
  const colW = (inner - gutter * (cols - 1)) / cols;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={label}>
      <rect width={w} height={h} fill={dark ? "#000000" : "#FFFFFF"} stroke="rgba(0,0,0,0.12)" />
      {Array.from({ length: cols }).map((_, i) => (
        <rect key={i} x={margin + i * (colW + gutter)} y={margin} width={colW} height={h - margin * 2} fill={GUIDE} fillOpacity={dark ? 0.22 : 0.14} />
      ))}
      <rect x={margin} y={margin} width={inner} height={h - margin * 2} fill="none" stroke={GUIDE} strokeDasharray="6 5" strokeWidth={Math.max(1, w / 400)} />
      {children}
    </svg>
  );
}

function SilverHeadline({ children, size }: { children: ReactNode; size: number }) {
  return (
    <span className="font-semibold tracking-[-0.03em]" style={{ fontSize: size, lineHeight: 1.05, backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{children}</span>
  );
}

/* ── 55 · Grid & Layout ────────────────────────────────────────────────── */

export function GridLayout() {
  return (
    <Chapter
      n={55}
      lead={
        <p>
          Every KOLEEX layout sits on a grid. The grid is why a quotation, a catalog page and a social post
          look like they come from the same company — even when three different people made them.
        </p>
      }
      toc={[
        { id: "principle", title: "The principle" },
        { id: "formats", title: "Grids for our formats" },
        { id: "composition", title: "Composition" },
        { id: "grid-donts", title: "What never to do" },
      ]}
    >
      <Section id="principle" title="The principle">
        <Rule why="A shared grid is invisible, but everyone feels it: edges line up, the eye knows where to go, and the page looks deliberate.">
          Margins first, then columns, then content. Every text block, image and logo starts on a column
          edge.
        </Rule>
      </Section>

      <Section id="formats" title="Grids for our formats">
        <Examples cols={3}>
          <Example caption={<><B>House document</B> · 210 × 270 mm · 12 columns</>} bg="#F5F5F7" h={250}>
            <div style={{ width: 150 }}>
              <GridSheet w={210} h={270} margin={12} cols={12} gutter={3} label="Document grid">
                <image href="/brand/koleex-logo-black.svg" x={12} y={14} width={45} height={6.7} />
              </GridSheet>
            </div>
          </Example>
          <Example caption={<><B>Social post</B> · 1080 × 1350 px · 6 columns</>} bg="#F5F5F7" h={250}>
            <div style={{ width: 150 }}>
              <GridSheet w={1080} h={1350} margin={72} cols={6} gutter={24} dark label="Social post grid">
                <image href="/brand/koleex-logo-white.svg" x={72} y={1350 - 72 - 33} width={220} height={33} />
              </GridSheet>
            </div>
          </Example>
          <Example caption={<><B>Presentation</B> · 1920 × 1080 px · 12 columns</>} bg="#F5F5F7" h={250}>
            <div style={{ width: 220 }}>
              <GridSheet w={1920} h={1080} margin={96} cols={12} gutter={24} label="Presentation grid">
                <image href="/brand/koleex-logo-black.svg" x={96} y={64} width={200} height={30} />
              </GridSheet>
            </div>
          </Example>
        </Examples>
        <Table
          head={["Format", "Size", "Margins", "Columns · gutter"]}
          rows={[
            [<B key="a">House document</B>, "210 × 270 mm", "12 mm", "12 · 3 mm"],
            [<B key="a">Poster</B>, "A2 420 × 594 mm", "30 mm", "6 · 10 mm"],
            [<B key="a">Social post</B>, "1080 × 1350 px", "72 px", "6 · 24 px"],
            [<B key="a">Story / reel cover</B>, "1080 × 1920 px", "72 px sides · 250 px top and bottom", "4 · 24 px"],
            [<B key="a">Presentation</B>, "1920 × 1080 px", "96 px", "12 · 24 px"],
            [<B key="a">Website</B>, "Up to 1440 px content", "24 px (16 px on phones)", "12 · 24 px (4 on phones)"],
            [<B key="a">Business card</B>, "90 × 54 mm", "4 mm — the only exception (ch. 91)", "—"],
            [<B key="a">Roll-up banner</B>, "850 × 2000 mm", "60 mm · keep the bottom 200 mm empty", "6 · 20 mm"],
          ]}
        />
      </Section>

      <Section id="composition" title="Composition">
        <Bullets items={[
          <><B>One focal point</B> — the machine, a number or a headline. Everything else supports it.</>,
          <><B>Space is the design.</B> Leave about half of a marketing layout empty.</>,
          <><B>Heroes are centered</B>: headline on top, the machine below. Longer text is start-aligned (<Ref n={54} />).</>,
          <><B>Group by space, not boxes</B> — a spec and its value, a photo and its caption.</>,
        ]} />
        <Examples cols={2}>
          <Example tone="do" caption="Centered, one focal point, room to breathe." bg="#F5F5F7" h={260}>
            <div className="flex h-[230px] w-[184px] flex-col items-center rounded-[14px] bg-black px-4 pt-6 text-center">
              <SilverHeadline size={20}>Cut every layer clean.</SilverHeadline>
              <div className="mt-auto w-full pb-4"><MachineShot w="100%" label={false} /></div>
            </div>
          </Example>
          <Example tone="dont" caption="Nothing lines up, three focal points fight, no space left." bg="#F5F5F7" h={260}>
            <div className="relative h-[230px] w-[184px] overflow-hidden rounded-[14px] bg-black">
              <p className="absolute left-6 top-2 text-[7px] tracking-[0.2em] text-[#98989D]">CUTTING</p>
              <p className="absolute right-2 top-7 text-right text-[14px] font-bold leading-tight text-white">Cut every<br />layer clean!</p>
              <div className="absolute left-2 top-16 h-14 w-20 rounded bg-[#1D1D1F]" />
              <p className="absolute left-3 top-[128px] text-[15px] font-black text-[#DC2626]">SALE</p>
              <p className="absolute right-3 top-[140px] text-[10px] text-white">Call now</p>
              <div className="absolute bottom-3 right-10"><Wordmark color="#FFFFFF" width={48} /></div>
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="grid-donts" title="What never to do">
        <Bullets items={[
          "Place elements by eye without a grid.",
          "Change margins from page to page within one document or series.",
          "Fill every empty area — empty space is what makes it premium.",
          "Let text run edge to edge on a phone screen: keep the margins.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 56 · Spacing & Shapes ─────────────────────────────────────────────── */

const SPACES = [8, 16, 24, 32, 48, 64, 96, 128, 160];
const RADII: Array<[number | "full", string]> = [[12, "Small tiles, inputs, tags"], [20, "Cards and panels"], [28, "Heroes and large panels"], ["full", "Buttons, chips, avatars"]];

export function SpacingShapes() {
  return (
    <Chapter
      n={56}
      lead={<p>Generous space, soft corners, one hairline. That is the whole shape language.</p>}
      toc={[
        { id: "spacing", title: "Spacing scale" },
        { id: "radii", title: "Corners" },
        { id: "lines", title: "Lines" },
        { id: "shapes", title: "Shapes" },
        { id: "depth", title: "Depth" },
      ]}
    >
      <Section id="spacing" title="Spacing scale">
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <div className="w-full space-y-2.5">
            {SPACES.map((s) => (
              <div key={s} className="flex items-center gap-4">
                <span className="w-16 shrink-0 font-mono text-[12px] text-[#6E6E73]">{s} px</span>
                <span className="h-3 rounded-full bg-[#1D1D1F]" style={{ width: s * 2 }} />
              </div>
            ))}
          </div>
        </Stage>
        <Specs rows={[
          ["Screen", "8 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 160 px — nothing in between"],
          ["Inside a component", "8–32"],
          ["Between sections", "96–160 — more than feels necessary"],
          ["Print", "2 · 4 · 6 · 8 · 12 · 16 · 24 · 32 mm"],
        ]} />
      </Section>

      <Section id="radii" title="Corners">
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <div className="flex w-full flex-wrap gap-6">
            {RADII.map(([r, use]) => (
              <div key={String(r)} className="flex w-[140px] flex-col gap-2">
                <div className="h-20 w-full bg-[#F5F5F7] shadow-[inset_0_0_0_1px_#D2D2D7]" style={{ borderRadius: r === "full" ? 999 : r }} />
                <span className="font-mono text-[12px] text-[#1D1D1F]">{r === "full" ? "full" : `${r} px`}</span>
                <span className="text-[12px] leading-4 text-[#6E6E73]">{use}</span>
              </div>
            ))}
          </div>
        </Stage>
        <Note>In print, 20 px ≈ 5 mm. House documents keep their own 12 px blocks (<Ref n={94} />).</Note>
      </Section>

      <Section id="lines" title="Lines">
        <Specs rows={[
          ["Hairline", "1 px on screen · 0.25 pt in print — dividers and table rules only"],
          ["On white", "Mist #D2D2D7"],
          ["On black", "#38383A"],
          ["Never", "Underlines under headlines, dashed or double lines. The one drawn line the brand owns is the light line (ch. 57)"],
        ]} />
      </Section>

      <Section id="shapes" title="Shapes">
        <Rule why="Geometry reads as engineering. Blobs, waves and splashes read as a different kind of company.">
          Rounded rectangles, circles for avatars and status dots — and the brand elements of <Ref n={57} />. Nothing else.
        </Rule>
        <Note>The slow wave behind the Koleex Hub interface belongs to the Hub’s Aurora skin only (<Ref n={77} />).</Note>
      </Section>

      <Section id="depth" title="Depth">
        <Examples cols={3}>
          <Example tone="do" caption="Separation by a change of tone." bg="#FFFFFF" h={150}>
            <div className="w-44 rounded-[20px] bg-[#F5F5F7] p-4 text-[13px] font-semibold text-[#1D1D1F]">Spec sheet<div className="mt-2 h-1.5 w-24 rounded-full bg-[#D2D2D7]" /></div>
          </Example>
          <Example tone="dont" caption="Heavy drop shadows." bg="#FFFFFF" h={150}>
            <div className="w-44 rounded-[20px] bg-white p-4 text-[13px] font-semibold text-[#1D1D1F]" style={{ boxShadow: "8px 12px 18px rgba(0,0,0,0.45)" }}>Spec sheet</div>
          </Example>
          <Example tone="dont" caption="Bevels, embossing, 3D." bg="#FFFFFF" h={150}>
            <div className="w-44 rounded-[20px] p-4 text-[13px] font-bold text-[#6E6E73]" style={{ background: "linear-gradient(180deg,#FFFFFF,#98989D)", boxShadow: "inset 2px 2px 0 #fff, inset -3px -3px 0 #6E6E73" }}>Spec sheet</div>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/** A 4:5 post showing the KOLEEX edge (1% of the width, full height). */
function EdgePost({ light = false, tab = false }: { light?: boolean; tab?: boolean }) {
  const bg = light ? "#FFFFFF" : "#000000";
  const fg = light ? "#000000" : "#FFFFFF";
  return (
    <div className="relative overflow-hidden rounded-[4px] ring-1 ring-black/10" style={{ width: 136, height: 170, background: bg }}>
      <div className="absolute left-0 top-0" style={{ width: tab ? 3 : 2, height: tab ? 44 : "100%", background: fg }} />
      <div className="absolute left-[12px] top-[12px]"><Wordmark color={fg} width={44} /></div>
      <p className="absolute left-[12px] top-[40px] text-[11px] font-bold leading-tight" style={{ color: fg }}>XSL-L9</p>
      <p className="absolute left-[12px] top-[54px] text-[9px] font-light leading-tight" style={{ color: fg }}>Double-stepper lockstitch</p>
      <div className="absolute inset-x-[12px] bottom-[12px]"><MachineShot w="100%" dark={!light} label={false} logo={false} /></div>
    </div>
  );
}

/** The KOLEEX dots: one even grid; `wave` keeps only a band of it. */
function DotField({ wave = false }: { wave?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 280 150" style={{ width: 260 }} aria-hidden>
      <defs>
        <pattern id={`dots-${id}`} width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.4" fill="#FFFFFF" /></pattern>
        <clipPath id={`clip-${id}`}>
          {wave
            ? <path d="M0 96 C 60 60, 120 140, 180 92 S 280 66, 280 66 L280 150 L0 150 Z" />
            : <path d="M28 30 L90 26 L100 44 L80 60 L66 78 L50 70 L36 52 Z M72 84 L92 88 L90 112 L80 136 L72 120 Z M128 30 L150 28 L156 44 L140 50 L128 44 Z M132 56 L162 56 L168 76 L156 110 L144 112 L136 84 Z M158 26 L236 24 L250 44 L232 62 L206 66 L190 58 L170 50 Z M220 100 L248 98 L252 116 L228 120 Z" />}
        </clipPath>
      </defs>
      <rect width="280" height="150" fill={`url(#dots-${id})`} clipPath={`url(#clip-${id})`} opacity={wave ? 0.6 : 0.45} />
    </svg>
  );
}

/** A white occasion object in soft 3D — the Ramadan crescent. */
function Crescent() {
  return (
    <svg viewBox="0 0 120 120" style={{ width: 110 }} aria-hidden>
      <path d="M72 18a44 44 0 1 0 26 76a37 37 0 1 1-26-76z" fill="#F2F2F7" />
      <path d="M72 18a44 44 0 0 0-41 51a42 42 0 0 1 31-46z" fill="#C7C7CC" />
      <path d="M98 94a44 44 0 0 1-48 8a40 40 0 0 0 44-12z" fill="#AEAEB2" />
    </svg>
  );
}

/* ── 57 · Graphic Elements ─────────────────────────────────────────────── */

export function GraphicElements() {
  return (
    <Chapter
      n={57}
      lead={<p>KOLEEX adds nothing for decoration. The kit is type, space, silver and the machine — and five elements of its own, each with one job.</p>}
      toc={[
        { id: "kit", title: "The kit" },
        { id: "edge", title: "The KOLEEX edge" },
        { id: "light-line", title: "The light line" },
        { id: "x-stroke", title: "The X stroke" },
        { id: "dots", title: "The dots" },
        { id: "objects", title: "Occasion objects" },
        { id: "numbers", title: "Big numbers" },
        { id: "labels", title: "Labels" },
        { id: "ge-donts", title: "What never to do" },
      ]}
    >
      <Section id="kit" title="The kit">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Stage bg="#000000" h={200} pad={24}><SilverHeadline size={34}>Type.</SilverHeadline></Stage>
          <Stage bg="#FFFFFF" h={200} pad={24}><span className="text-[13px] text-[#6E6E73]">Space.</span></Stage>
          <Stage bg="#000000" h={200} pad={24}><div className="h-[72px] w-[200px] rounded-[18px]" style={{ background: SILVER.css }} /></Stage>
          <Stage bg="#000000" h={200} pad={24}><MachineShot w={240} label={false} /></Stage>
        </div>
        <Table
          head={["Element", "Its job"]}
          rows={[
            [<B key="a">Type</B>, "Big, short headlines carry the message (ch. 51)"],
            [<B key="a">Space</B>, "Makes everything look precise and premium"],
            [<B key="a">Silver</B>, "The one premium touch — headlines on black, the machine, metal (ch. 46)"],
            [<B key="a">The machine</B>, "Always the hero — our own studio photographs (ch. 63)"],
            [<B key="a">The five brand elements</B>, "The edge, the light line, the X stroke, the dots, occasion objects — below"],
          ]}
        />
      </Section>

      <Section id="edge" title="The KOLEEX edge">
        <P>A thin strip down the left side of every designed post, story, ad and poster. It is the first thing that marks a piece as ours, before the logo is read.</P>
        <Examples cols={3}>
          <Example tone="do" caption="On black: a white edge." bg="#F5F5F7" h={210}>
            <EdgePost />
          </Example>
          <Example tone="do" caption="On white: a black edge." bg="#F5F5F7" h={210}>
            <EdgePost light />
          </Example>
          <Example tone="dont" caption="A short tab, or the edge on a photo post." bg="#F5F5F7" h={210}>
            <EdgePost tab />
          </Example>
        </Examples>
        <Specs rows={[
          ["Width", "1% of the design's width — 11 px on a 1080 px post"],
          ["Length", "The full height of the design"],
          ["Colour", "The opposite of the ground: white on black, black on white"],
          ["Where", "Designed posts, stories, ads and posters — product, occasion, announcement"],
          ["Not on", "Photo posts from events (they have the dark band and footer, ch. 80) and the Bento board"],
        ]} />
      </Section>

      <Section id="light-line" title="The light line">
        <P>One continuous line of light, sweeping through the layout — the line of the booth, the VIP card and the invitation. It may be used on any piece.</P>
        <Stage bg="#000000" h={220} pad={0}>
          <svg viewBox="0 0 640 220" className="h-full w-full" aria-hidden>
            <path d="M-10 180 C 140 180, 170 70, 330 66 S 540 130, 650 40" fill="none" stroke="#FFFFFF" strokeOpacity="0.14" strokeWidth="10" />
            <path d="M-10 180 C 140 180, 170 70, 330 66 S 540 130, 650 40" fill="none" stroke="#FFFFFF" strokeWidth="2" />
          </svg>
        </Stage>
        <Specs rows={[
          ["Number", "One line per layout"],
          ["Colour", "White on black, black on white — never coloured"],
          ["Shape", "One smooth curve that enters and leaves the frame"],
          ["Never", "Across the logo or across text; several lines; a line under a headline"],
        ]} />
      </Section>

      <Section id="x-stroke" title="The X stroke">
        <P>One stroke of the X in the logo, drawn large behind a portrait or across a cover. It is the only shape taken from the logo.</P>
        <Examples cols={2}>
          <Example tone="do" caption="Behind a portrait: the management business card." bg="#000000" h={200}>
            <div className="relative h-[150px] w-[260px]">
              <div className="absolute top-0 h-[150px] w-[26px] origin-top-left bg-white" style={{ transform: "skewX(42deg)", left: 40 }} />
              <div className="absolute bottom-0 left-[60px] h-[92px] w-[110px] rounded-t-[55px] bg-[#48484A]" />
              <div className="absolute left-[88px] top-[22px] h-[50px] w-[50px] rounded-full bg-[#8E8E93]" />
            </div>
          </Example>
          <Example tone="do" caption="Across a cover." bg="#000000" h={200}>
            <div className="relative h-[150px] w-[112px] overflow-hidden rounded-[4px] ring-1 ring-white/15">
              <div className="absolute top-0 h-[190px] w-[22px] origin-top-left bg-white" style={{ transform: "skewX(42deg)", left: 18 }} />
              <div className="absolute bottom-4 left-3"><Wordmark color="#FFFFFF" width={44} /></div>
            </div>
          </Example>
        </Examples>
        <Specs rows={[
          ["Angle", "The angle of the X's stroke in the logo — never rotated to another angle"],
          ["Number", "One stroke per layout"],
          ["Where", "The portrait business card (ch. 91) and covers"],
          ["Never", "The peak triangle or any other piece cut from the logo"],
        ]} />
      </Section>

      <Section id="dots" title="The dots">
        <P>An even grid of small dots — the world map on the office glass, the wave on a start screen.</P>
        <Examples cols={2}>
          <Example tone="do" caption="The wave: screens and start pages." bg="#000000" h={180}><DotField wave /></Example>
          <Example tone="do" caption="The world map: glass, walls, global content." bg="#000000" h={180}><DotField /></Example>
        </Examples>
        <Specs rows={[
          ["Grid", "One even grid; every dot the same size"],
          ["Colour", "White or grey on black; grey on white glass — never coloured"],
          ["World map", "Offices, glass partitions (safety marking) and global content"],
          ["Wave", "Screens: start pages, presentations, the website"],
          ["Cards and badges", "Business cards and ID badges may carry the dots as a pattern (owner decision 29/09/2026) — printed grey, one even grid, the logo always on a clear panel"],
        ]} />
      </Section>

      <Section id="objects" title="Occasion objects">
        <P>Occasions and announcements are marked by one white object, shown in 3D on black — the crescent for Ramadan, the tree for Christmas, the triangle for a warning.</P>
        <Examples cols={3}>
          <Example tone="do" caption="Ramadan: the crescent." bg="#000000" h={170}><Crescent /></Example>
          <Example tone="dont" caption="Coloured symbols, flags or clip art." bg="#000000" h={170}>
            <div className="flex items-center gap-2"><span className="h-10 w-10 rounded-full" style={{ background: "#F59E0B" }} /><span className="text-[26px] font-black text-[#16A34A]">★</span></div>
          </Example>
          <Example tone="dont" caption="Line drawings of symbols and landmarks." bg="#000000" h={170}>
            <svg viewBox="0 0 120 90" style={{ width: 110 }} aria-hidden><g fill="none" stroke="#FFFFFF" strokeWidth="1.4"><path d="M10 80h100" /><path d="M24 80v-30h22v30" /><path d="M24 50a11 11 0 0 1 22 0" /><path d="M60 80v-56h10v56" /><path d="M57 24h16l-8-14z" /><path d="M82 80v-22h16v22" /></g></svg>
          </Example>
        </Examples>
        <Specs rows={[
          ["Object", "One, white, in soft 3D light on black"],
          ["Size", "Up to half the height of the layout; never behind the logo"],
          ["Colour", "White and greys only — travel posts too, never flag colours"],
        ]} />
      </Section>

      <Section id="numbers" title="Big numbers">
        <Stage bg="#000000" h="auto" pad={48}>
          <div className="grid w-full grid-cols-3 gap-6 text-center">
            {[["1955", "since"], ["70+", "countries"], ["6,000", "stitches a minute"]].map(([n, l]) => (
              <div key={n}><SilverHeadline size={48}>{n}</SilverHeadline><p className="mt-2 text-[13px] text-[#98989D]">{l}</p></div>
            ))}
          </div>
        </Stage>
        <P>One number, huge, says more than a chart. Numbers come from Koleex Hub or have a source (<Ref n={132} />).</P>
      </Section>

      <Section id="labels" title="Labels">
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <div className="text-[#1D1D1F]">
            <p className="text-[15px] font-semibold text-[#6E6E73]">New · Overlock</p>
            <p className="mt-1 text-[34px] font-semibold tracking-[-0.025em]">Four threads. One pass.</p>
          </div>
        </Stage>
        <Specs rows={[
          ["Style", "Sentence case, SemiBold, Gray — above the headline"],
          ["Color", "Gray #6E6E73 on white, #98989D on black — never Hub Blue or a status color"],
          ["Never", "Letter-spaced capitals, colored pills, badges and stickers"],
        ]} />
      </Section>

      <Section id="ge-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="Underlines and decorative rules." bg="#000000" h={150}>
            <div className="text-center"><p className="text-[20px] font-semibold text-white">Quiet power.</p><span className="mx-auto mt-2 block h-[2px] w-16" style={{ background: "linear-gradient(90deg,#567FB2,#BCD8F0)" }} /></div>
          </Example>
          <Example tone="dont" caption="The peak triangle or other shapes cut from the logo." bg="#000000" h={150}>
            <svg viewBox="0 0 81.19 36.31" style={{ width: 120 }} aria-hidden><path d="M40.59,0 L81.19,36.31 H0 Z" fill="#48484A" /></svg>
          </Example>
          <Example tone="dont" caption="Stickers, bursts and badges." bg="#000000" h={150}>
            <span className="rotate-[-12deg] rounded-full bg-[#DC2626] px-4 py-2 text-[14px] font-black text-white">NEW!</span>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}
