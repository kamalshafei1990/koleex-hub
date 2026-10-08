"use client";

/* Chapters 102–106: company profile, catalogs, brochures & flyers, spec
   sheets, posters. */

import type { ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import OverlockMachineIcon from "@/components/icons/machine-kinds/OverlockMachineIcon";
import FlatBedMachineIcon from "@/components/icons/machine-kinds/FlatBedMachineIcon";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { KoleexLogoPaths } from "@/components/layout/KoleexLogo";
import { INK, Lines, MachineShot, Strips } from "../mockups";
import { SILVER } from "@/lib/brand-book/tokens";

function Page({ w = 150, dark = false, ratio = "210 / 270", children }: { w?: number; dark?: boolean; ratio?: string; children: ReactNode }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-[3px]" style={{ width: w, aspectRatio: ratio, background: dark ? INK : "#FFFFFF", color: dark ? "#FFFFFF" : INK, boxShadow: dark ? "0 0 0 1px rgba(255,255,255,0.12)" : "0 0 0 1px rgba(0,0,0,0.12)" }}>
      {children}
    </div>
  );
}

function Spread({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]">{children}</div>;
}

/* ── 102 · Company Profile ─────────────────────────────────────────────── */

export function CompanyProfile() {
  return (
    <Chapter
      n={102}
      lead={
        <p>
          The company profile introduces KOLEEX to partners who do not know us yet. Its story is strong —
          a family business since 1955, three generations, KOLEEX since 2012 — so the profile lets the facts
          and our own photographs speak, with nothing borrowed.
        </p>
      }
      toc={[
        { id: "layout", title: "Layout" },
        { id: "contents", title: "Contents" },
        { id: "evidence", title: "Evidence rules" },
      ]}
    >
      <Section id="layout" title="Layout">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <Page w={160} dark ratio="210 / 270">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
                <p className="text-[12px] font-semibold tracking-[-0.02em]" style={{ background: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Company Profile</p>
                <MachineShot w="86%" label={false} logo={false} />
                <div className="flex flex-col items-center gap-1"><Wordmark color="#FFFFFF" width={54} /><p className="text-[5px] tracking-[0.2em] text-[#98989D]">2026</p></div>
              </div>
            </Page>
            <Spread>
              <Page w={150} dark ratio="8 / 10"><div className="absolute inset-3 rounded-sm bg-[#1D1D1F]" /><span className="absolute bottom-2 left-3 rounded bg-black/50 px-1 text-[5px] tracking-[0.14em] text-white">OWN PHOTO</span></Page>
              <Page w={150} ratio="8 / 10"><div className="absolute left-4 top-[30%] right-4"><p className="text-[13px] font-bold leading-tight">Our story</p><div className="mt-2"><Lines n={5} /></div></div><p className="absolute bottom-2 left-4 text-[5px] text-[#98989D]">History / Since 1955</p><p className="absolute bottom-2 right-3 text-[5px] text-[#98989D]">04</p></Page>
            </Spread>
          </div>
        </Stage>
        <Specs rows={[
          ["Format", "Landscape, 16:10 — as PDF for screens, and printed as a booklet"],
          ["Spreads", "Photograph on one page, title and text on the other"],
          ["Every page", "Logo top-left; section and page name bottom-left; page number bottom-right"],
          ["Style", "Black, white and silver — photos with numbered callouts, no drawings, no neon, no 3D"],
        ]} />
      </Section>

      <Section id="contents" title="Contents">
        <Table
          head={["Section", "What it holds"]}
          rows={[
            [<B key="a">Message from the founder</B>, "Signed, with the founder's portrait"],
            [<B key="a">Our story</B>, "1955 Cairo → three generations → KOLEEX 2012 → Taizhou 2017, with our own archive photos"],
            [<B key="a">What we do</B>, "Machines by category (with machine icons) and services"],
            [<B key="a">Quality</B>, "How we inspect, test and pack — photographed in our own facilities"],
            [<B key="a">Where we are</B>, "Only real, current offices and agents"],
            [<B key="a">Values and vision</B>, "In a few words"],
            [<B key="a">Contact</B>, "One address, one phone, one email, the website, QR codes"],
          ]}
        />
      </Section>

      <Section id="evidence" title="Evidence rules">
        <Rule why="A profile is read by people deciding whether to trust us. One number or logo that turns out not to be true undoes every page.">
          Everything in the profile is true and checkable: our own photographs, real numbers with their
          source, and other companies’ logos only with their written permission.
        </Rule>
        <Bullets items={[
          "No stock photos of offices, people, cities or handshakes (ch. 63).",
          "Customer and partner logos only with written permission; supplier names never (ch. 44).",
          "Every number — countries, years, machines sold — with a source we can show.",
          <>Leadership shown only as real people in their real roles (<Ref n={66} />).</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 103 · Catalogs ────────────────────────────────────────────────────── */

export function Catalogs() {
  return (
    <Chapter
      n={103}
      lead={
        <p>
          The catalog lets a customer see every machine we offer and ask for the right one. It is built on
          the house sheet, organised by machine category, and it never shows a price.
        </p>
      }
      toc={[
        { id: "structure", title: "Structure" },
        { id: "pages", title: "Pages" },
        { id: "catalog-rules", title: "Rules" },
      ]}
    >
      <Section id="structure" title="Structure">
        <Bullets items={[
          "Cover — the machine on black, the logo, \"Product Catalog\", the year.",
          "Contents — categories with their machine icons and page numbers.",
          "A category opener for each machine kind, then one page (or spread) per machine.",
          "Services, contact, QR code to the website — at the back.",
        ]} />
      </Section>

      <Section id="pages" title="Pages">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-start justify-center gap-5">
            <Page w={160} dark>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
                <p className="text-[12px] font-semibold tracking-[-0.02em]" style={{ background: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Product Catalog</p>
                <MachineShot w="86%" label={false} logo={false} />
                <div className="flex flex-col items-center gap-1"><Wordmark color="#FFFFFF" width={54} /><p className="text-[5px] tracking-[0.2em] text-[#98989D]">2026</p></div>
              </div>
            </Page>
            <Page w={160}>
              <div className="absolute inset-4 flex flex-col">
                <OverlockMachineIcon size={34} />
                <p className="mt-3 text-[15px] font-bold">Overlock</p>
                <p className="text-[6px] text-[#6E6E73]">Edge trimming and overedge stitching</p>
                <div className="mt-auto flex items-center justify-between text-[5px] text-[#98989D]"><Wordmark color="#000000" width={30} /><span>12</span></div>
              </div>
            </Page>
            <Page w={160}>
              <div className="absolute inset-3 flex flex-col">
                <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1 text-[5px] font-semibold uppercase tracking-[0.12em] text-[#6E6E73]"><OverlockMachineIcon size={8} />Overlock</span><span className="text-[5px] text-[#98989D]">13</span></div>
                <div className="mt-2 flex h-[42%] items-center justify-center rounded-[6px] bg-[#FFFFFF] px-2"><MachineShot w="92%" dark={false} label={false} /></div>
                <p className="mt-2 text-[10px] font-bold">Model name</p>
                <div className="mt-1 space-y-[2px] text-[5.5px]">{["Key feature one", "Key feature two", "Key feature three"].map((f) => <p key={f} className="flex items-center gap-1">{f}</p>)}</div>
                <div className="mt-auto overflow-hidden rounded-[2px] border border-[#D2D2D7] text-[5px]">
                  {[["Max speed", "— SPM"], ["Needles", "—"], ["Motor", "—"]].map(([k, v]) => <div key={k} className="flex justify-between border-b border-[#D2D2D7] px-1 py-[1px] last:border-0"><span>{k}</span><span className="font-mono">{v}</span></div>)}
                </div>
              </div>
            </Page>
          </div>
        </Stage>
      </Section>

      <Section id="catalog-rules" title="Rules">
        <Bullets items={[
          <><B>No prices</B> — not in print, not in the PDF (owner rule). Prices go in quotations.</>,
          "KOLEEX machines only — never a supplier's catalog with our logo added, never a supplier's name or code.",
          "Specifications exactly as in Koleex Hub's product data; blank is better than a guess.",
          "Our own photographs — the hero on black, product pages on white (ch. 64); never a borrowed photo or a drawing.",
          "The cover is black; a white cover is the second version (ch. 47).",
          "Light-led pages for easy reading and office printing (ch. 47); dark only for cover and openers if wished.",
        ]} />
        <Note>The catalog’s product pages can be generated from Koleex Hub, so the catalog and the website always say the same thing.</Note>
      </Section>
    </Chapter>
  );
}

/* ── 104 · Brochures & Flyers ──────────────────────────────────────────── */

export function Brochures() {
  return (
    <Chapter
      n={104}
      lead={<p>Brochures and flyers are handed out at exhibitions and visits. They say one thing each, quickly, and send the reader to the website or WhatsApp.</p>}
      toc={[
        { id: "formats", title: "Formats" },
        { id: "flyer", title: "The flyer" },
        { id: "qr", title: "QR codes" },
      ]}
    >
      <Section id="formats" title="Formats">
        <Table
          head={["Piece", "Size", "Use"]}
          rows={[
            ["Tri-fold brochure", "A4 folded to 99 × 210 mm", "Company overview or one machine category"],
            ["Flyer", "A5 148 × 210 mm, both sides", "One machine, one service or one event"],
            ["Leaflet for WhatsApp", "1080 × 1350 px PDF or image", "The flyer's digital twin"],
          ]}
        />
      </Section>

      <Section id="flyer" title="The flyer">
        <Examples cols={2}>
          <Example tone="do" caption="Front: the logo top-left, one line, one machine." bg="#F5F5F7" h={260}>
            <Page w={160} ratio="148 / 210" dark>
              <div className="absolute inset-3 flex flex-col">
                <Wordmark color="#FFFFFF" width={40} />
                <p className="mt-3 text-[6px] font-semibold uppercase tracking-[0.2em] text-[#98989D]">Coverstitch</p>
                <p className="mt-1 text-[12px] font-semibold leading-tight tracking-[-0.02em]">Flat seams for knitwear.</p>
                <div className="mt-2 flex flex-1 items-center justify-center"><MachineShot w="92%" label={false} /></div>
              </div>
            </Page>
          </Example>
          <Example tone="do" caption="Back: key points, contact, QR — light-led." bg="#F5F5F7" h={260}>
            <Page w={160} ratio="148 / 210">
              <div className="absolute inset-3 flex flex-col text-[5.5px]">
                <p className="text-[9px] font-bold">Why this machine</p>
                <div className="mt-1 space-y-[3px]">{["Point one", "Point two", "Point three"].map((f) => <p key={f} className="flex items-center gap-1">{f}</p>)}</div>
                <div className="mt-auto flex items-end justify-between">
                  <div className="space-y-[1px] font-mono text-[4.5px]"><p>{KOLEEX_COMPANY.web}</p><p>{KOLEEX_COMPANY.email}</p></div>
                  <div className="h-8 w-8 rounded-sm" style={{ background: "repeating-conic-gradient(#000000 0 25%, #FFFFFF 0 50%) 0 0 / 6px 6px" }} />
                </div>
              </div>
            </Page>
          </Example>
        </Examples>
        <Specs rows={[
          ["Print", "CMYK, 3 mm bleed, 300 dpi images, PDF/X-1a"],
          ["Paper", "Matte coated 170–250 g/m²"],
          ["QR code", "The KOLEEX QR code below, at least 20 × 20 mm (15 mm only on business cards — ch. 91)"],
        ]} />
      </Section>

      <Section id="qr" title="QR codes">
        <P>Every KOLEEX QR code — on cards, flyers, stickers, badges and signs — is drawn the same way.</P>
        <Examples cols={3}>
          <Example tone="do" caption="Black on white, the logo in the middle." bg="#F5F5F7" h={160}><Qr logo /></Example>
          <Example tone="dont" caption="White on black — many phones cannot read it." bg="#F5F5F7" h={160}><Qr inverted /></Example>
          <Example tone="dont" caption="Coloured, stretched, or without the white margin." bg="#F5F5F7" h={160}><div style={{ transform: "scaleX(1.4)" }}><Qr /></div></Example>
        </Examples>
        <Specs rows={[
          ["Colours", "Black modules on white — on a black piece, on a white tile"],
          ["Logo", "The KOLEEX tile in the middle, no more than 20% of the code"],
          ["Error correction", "Level H, so the code still reads with the logo in it"],
          ["Margin", "A white quiet zone of four modules on every side"],
          ["Size", "20 × 20 mm at the smallest; 15 mm only on business cards, read from the hand (ch. 91); larger for signs read from a distance"],
          ["Link", "Our own domain or WhatsApp Business — tested on two phones before printing"],
        ]} />
      </Section>
    </Chapter>
  );
}

/** A QR code drawn flat: three finder squares and a few modules. `logo`
 *  puts the KOLEEX tile in the middle; `inverted` draws the forbidden
 *  white-on-black version. */
function Qr({ logo = false, inverted = false }: { logo?: boolean; inverted?: boolean }) {
  const fg = inverted ? "#FFFFFF" : "#000000";
  const bg = inverted ? "#000000" : "#FFFFFF";
  const mods = [[24, 6, 4, 4], [30, 10, 4, 8], [24, 44, 6, 4], [44, 26, 4, 6], [36, 42, 8, 4], [48, 44, 6, 10], [6, 26, 8, 4], [16, 30, 4, 6], [26, 24, 4, 4], [32, 30, 6, 4]];
  return (
    <svg viewBox="0 0 76 76" style={{ width: 110, background: bg, boxShadow: inverted ? "none" : "0 0 0 1px rgba(0,0,0,0.12)" }} aria-hidden>
      <g transform="translate(8,8)">
        {[[4, 4], [40, 4], [4, 40]].map(([x, y]) => (
          <g key={`${x}-${y}`}><rect x={x} y={y} width="16" height="16" fill={fg} /><rect x={x + 3} y={y + 3} width="10" height="10" fill={bg} /><rect x={x + 6} y={y + 6} width="4" height="4" fill={fg} /></g>
        ))}
        {mods.map(([x, y, w, h]) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill={fg} />)}
      </g>
      {logo && (
        <>
          <rect x="26" y="31" width="24" height="14" rx="2" fill="#000000" />
          <svg x="29" y="36" width="18" height="3" viewBox="0 0 719.83 107.57" fill="#FFFFFF"><KoleexLogoPaths /></svg>
        </>
      )}
    </svg>
  );
}

/* ── 105 · Spec Sheets ─────────────────────────────────────────────────── */

export function SpecSheets() {
  return (
    <Chapter
      n={105}
      lead={<p>A spec sheet is one page about one machine: what it is, what it does, its exact specifications. Customers compare them side by side, so every spec sheet is built the same way.</p>}
      toc={[
        { id: "sheet", title: "The spec sheet" },
        { id: "spec-rules", title: "Rules" },
      ]}
    >
      <Section id="sheet" title="The spec sheet">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <Page w={260}>
            <div className="absolute inset-3.5 flex flex-col">
              <div className="flex items-center justify-between"><Wordmark color="#000000" width={60} /><span className="text-[7px] font-bold tracking-[0.08em]">SPEC SHEET</span></div>
              <Strips />
              <div className="mt-2 grid grid-cols-[1fr_1fr] gap-2">
                <div className="flex aspect-square items-center justify-center rounded-[6px] bg-[#FFFFFF] px-1.5 ring-1 ring-[#F5F5F7]"><MachineShot w="96%" dark={false} label={false} /></div>
                <div className="flex flex-col">
                  <span className="inline-flex items-center gap-1 text-[5px] font-semibold uppercase tracking-[0.12em] text-[#6E6E73]"><FlatBedMachineIcon size={8} />Flat bed</span>
                  <p className="mt-1 text-[10px] font-bold">Model name</p>
                  <div className="mt-1 space-y-[2px] text-[5px]">{["Key feature one", "Key feature two", "Key feature three"].map((f) => <p key={f} className="flex items-center gap-1">{f}</p>)}</div>
                </div>
              </div>
              <div className="mt-2 overflow-hidden rounded-[2px] border border-[#D2D2D7] text-[5px]">
                <div className="bg-[#000000] px-1 py-[1.5px] text-[4.5px] font-semibold uppercase tracking-[0.08em] text-white">Specifications</div>
                {[["Stitch type", "—"], ["Max speed", "— SPM"], ["Stitch length", "— mm"], ["Presser foot lift", "— mm"], ["Motor", "—"], ["Voltage", "220 V · 50/60 Hz"], ["Net weight", "— kg"]].map(([k, v]) => <div key={k} className="flex justify-between border-t border-[#D2D2D7] px-1 py-[1.5px]"><span>{k}</span><span className="font-mono">{v}</span></div>)}
              </div>
              <div className="mt-auto flex items-end justify-between text-[4.5px] text-[#98989D]"><span>{KOLEEX_COMPANY.web}</span><span>Specifications may change. 27/09/2026</span></div>
            </div>
          </Page>
        </Stage>
      </Section>

      <Section id="spec-rules" title="Rules">
        <Bullets items={[
          "One machine per sheet, on the house sheet, light-led.",
          "Specifications from Koleex Hub's product data — the same values as the website; a dash where a value is not confirmed.",
          "Units always stated; decimals consistent; dates DD/MM/YYYY.",
          "A \"Specifications may change\" line with the date of the sheet.",
          <>Certification marks only if that exact model holds them (<Ref n={133} />).</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 106 · Posters ─────────────────────────────────────────────────────── */

export function Posters() {
  return (
    <Chapter
      n={106}
      lead={<p>A poster is seen from across a room or a hall. It has one message, one image and the logo — and it is readable in three seconds.</p>}
      toc={[
        { id: "poster", title: "The poster" },
        { id: "poster-specs", title: "Specifications" },
      ]}
    >
      <Section id="poster" title="The poster">
        <Examples cols={2}>
          <Example tone="do" caption="The logo top-left, one message in silver, the machine." bg="#F5F5F7" h={300}>
            <Page w={180} ratio="420 / 594" dark>
              <div className="absolute inset-4 flex flex-col">
                <Wordmark color="#FFFFFF" width={60} />
                <p className="mt-4 text-[6px] font-semibold uppercase tracking-[0.2em] text-[#98989D]">Spreading</p>
                <p className="mt-1 text-[18px] font-semibold leading-[1.05] tracking-[-0.03em]" style={{ background: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Lay it flat.<br />Cut it right.</p>
                <div className="mt-3 flex flex-1 items-center justify-center"><MachineShot w="96%" label={false} /></div>
              </div>
            </Page>
          </Example>
          <Example tone="dont" caption="Many messages, small type, every product at once." bg="#F5F5F7" h={300}>
            <Page w={180} ratio="420 / 594">
              <div className="absolute inset-3 grid grid-cols-3 content-start gap-1">
                {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-10 rounded-sm bg-[#D2D2D7]" />)}
                <p className="col-span-3 mt-1 text-[5px] leading-tight">All our machines, all our services, all our offices, all our phone numbers and every social account in one place…</p>
              </div>
            </Page>
          </Example>
        </Examples>
      </Section>

      <Section id="poster-specs" title="Specifications">
        <Specs rows={[
          ["Sizes", "A2 420 × 594 mm · A1 594 × 841 mm · A0 841 × 1189 mm"],
          ["Headline", "Readable from 5 m: at least 60 mm tall letters on A1"],
          ["Grid", "6 columns, 30 mm margins on A2 (ch. 55)"],
          ["Print", "CMYK, 3–5 mm bleed, images at 150 dpi at full size, rich black for large dark areas (ch. 48)"],
        ]} />
        <P>Exhibition graphics — booth walls, roll-ups, fascia — are in Part 7 (<Ref n={114} />).</P>
      </Section>
    </Chapter>
  );
}
