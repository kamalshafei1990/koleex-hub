"use client";

/* Chapters 122–127: uniforms, merchandise & gifts, seasonal gifts,
   employer brand & hiring, staff on social media, the founder's personal
   brand.

   People carry the brand further than any campaign. The rules here protect
   two things at once: the brand, and the people themselves — their consent,
   their privacy, their own voice. */

import type { ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { KoleexLogoPaths } from "@/components/layout/KoleexLogo";
import { Avatar, INK, Phone, Post, Scaled } from "../mockups";
import { SILVER } from "@/lib/brand-book/tokens";

const FOUNDER_PHOTO = "/brand/book/founder-kamal-shafei.webp";

/* ── Drawings ──────────────────────────────────────────────────────────── */

/** A polo shirt, front view (designed at 200 × 200). The logo sits on the
 *  wearer's left chest — the viewer's right. `trim` draws the two approved
 *  designs (owner, 27/09/2026): white collar and cuffs with shoulder
 *  piping (A) or with a white placket (B). */
function Polo({ color = INK, ink = "#FFFFFF", logo = "chest", trim = "none" }: { color?: string; ink?: string; logo?: "chest" | "center" | "none"; trim?: "piping" | "placket" | "none" }) {
  const line = color === "#FFFFFF" ? "#D1D1D6" : "rgba(255,255,255,0.18)";
  const t = color === "#FFFFFF" ? INK : "#FFFFFF";
  return (
    <div className="relative" style={{ width: 200, height: 200 }}>
      <svg viewBox="0 0 200 200" width={200} height={200} className="absolute inset-0" aria-hidden>
        <path d="M60 30 L84 20 Q100 30 116 20 L140 30 L176 56 L160 82 L145 72 L145 186 L55 186 L55 72 L40 82 L24 56 Z" fill={color} stroke={line} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M84 20 L100 44 L116 20" fill="none" stroke={line} strokeWidth="1.5" />
        <path d="M100 44 L100 70" stroke={line} strokeWidth="1.5" />
        {trim === "placket" && <rect x="95" y="42" width="10" height="30" fill={t} />}
        {trim !== "none" && <path d="M84 20 L100 44 L116 20 Q100 30 84 20 Z M84 20 L76 34 L96 40 Z M116 20 L124 34 L104 40 Z" fill={t} />}
        {trim === "piping" && <path d="M80 24 L30 62 M120 24 L170 62" stroke={t} strokeWidth="2.2" />}
        {trim !== "none" && <path d="M24 56 L40 82 M176 56 L160 82" stroke={t} strokeWidth="5" />}
        <circle cx="100" cy="53" r="1.6" fill={trim === "placket" ? color : line} /><circle cx="100" cy="63" r="1.6" fill={trim === "placket" ? color : line} />
      </svg>
      {logo === "chest" && <div className="absolute" style={{ left: 114, top: 66 }}><Wordmark color={ink} width={30} /></div>}
      {logo === "center" && <div className="absolute" style={{ left: 60, top: 96 }}><Wordmark color="#EAB308" width={80} /></div>}
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="flex h-[92px] items-center justify-center">{children}</div>
      <figcaption className="text-[11px] font-medium text-[#6E6E73]">{label}</figcaption>
    </figure>
  );
}

/** The staff ID card, 54 × 86 mm — the standard card of ch. 101 (owner,
 *  01/10/2026; it was 86 × 124 mm): a black front with the portrait on
 *  dark; the back is the owner's own design. */
function StaffCard({ side, light = false }: { side: "front" | "back"; light?: boolean }) {
  const w = 124;
  const h = (w * 86) / 54;
  if (side === "back") {
    return (
      <div className="relative overflow-hidden rounded-[6px] bg-black" style={{ width: w, height: h }}>
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2"><Wordmark color="#FFFFFF" width={90} /></div>
        <div className="absolute bottom-[10%] left-[9%] flex items-center gap-1.5">
          <QrTile /><QrTile />
          <span className="mx-1 h-[22px] w-px bg-white" />
          <span className="text-[4.5px] font-light leading-[1.5] tracking-[0.2em] text-white">KOLEEX<br />INTERNATIONAL<br />GROUP</span>
        </div>
      </div>
    );
  }
  const fg = light ? "#000000" : "#FFFFFF";
  return (
    <div className="relative overflow-hidden rounded-[6px]" style={{ width: w, height: h, background: light ? "#FFFFFF" : "#000000", boxShadow: light ? "0 0 0 1px rgba(0,0,0,0.12)" : "none" }}>
      <div className="absolute left-[9%] top-[6%]"><Wordmark color={fg} width={46} /></div>
      <div className="absolute left-[9%] right-[9%] top-[16%] overflow-hidden" style={{ height: "46%", background: light ? "#E5E5EA" : "#1C1C1E" }}>
        <div className="absolute bottom-0 left-1/2 h-[45%] w-[56%] -translate-x-1/2 rounded-t-full bg-[#636366]" />
        <div className="absolute left-1/2 top-[22%] h-[30%] w-[26%] -translate-x-1/2 rounded-full bg-[#8E8E93]" />
      </div>
      <p className="absolute left-[9%] top-[66%] text-[10px] font-bold" style={{ color: fg }}>Full Name</p>
      <p className="absolute left-[9%] top-[73%] text-[7px] font-light" style={{ color: fg }}>Sales Engineer</p>
      <p className="absolute bottom-[6%] left-[9%] text-[6px] text-[#8E8E93]" style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>KX-0042 · Sales</p>
    </div>
  );
}

function QrTile() {
  return <span className="inline-block h-[20px] w-[20px] bg-white" style={{ backgroundImage: "repeating-conic-gradient(#000 0 25%, #fff 0 50%)", backgroundSize: "5px 5px", boxShadow: "0 0 0 2px #FFFFFF" }} />;
}

type GarmentKind = "shirt" | "shirt-white" | "shirt-trim" | "workshirt" | "coverall" | "workjacket" | "softshell" | "down" | "quarterzip" | "tee" | "tee-back";

const LONG_BODY = "M60 30 L84 20 Q100 28 116 20 L140 30 L180 72 L174 176 L156 174 L152 96 L150 214 L50 214 L48 96 L44 174 L26 176 L20 72 Z";
const SHIRT_COLLAR = "M84 20 L100 42 L116 20 L124 36 L102 46 L98 46 L76 36 Z";

/** The logo inside a garment drawing, from the official paths. */
function GLogo({ x, y, w, color = "#FFFFFF" }: { x: number; y: number; w: number; color?: string }) {
  return <svg x={x} y={y} width={w} height={(w * 107.57) / 719.83} viewBox="0 0 719.83 107.57" fill={color}><KoleexLogoPaths /></svg>;
}

/** The rest of the uniform set (owner, 28/09/2026 — every option approved):
 *  office shirts, technicians' wear, cold-weather wear and the T-shirt, all
 *  black with white details and the white logo on the wearer's left chest. */
function Garment({ kind }: { kind: GarmentKind }) {
  const INKG = "#111111";
  const EDGE = "#3A3A3C";
  if (kind === "coverall") {
    return (
      <svg viewBox="0 0 200 300" width={200} height={300} aria-hidden>
        <path d="M60 30 L84 20 Q100 28 116 20 L140 30 L180 72 L174 176 L156 174 L152 96 L152 290 L108 290 L100 200 L92 290 L48 290 L48 96 L44 174 L26 176 L20 72 Z" fill={INKG} />
        <path d={SHIRT_COLLAR} fill="#FFFFFF" />
        <line x1="100" y1="46" x2="100" y2="196" stroke="#FFFFFF" strokeWidth="1.4" />
        <rect x="48" y="150" width="104" height="8" fill="#1C1C1E" />
        <rect x="112" y="76" width="28" height="28" fill="#1C1C1E" stroke={EDGE} />
        <GLogo x={114} y={66} w={26} />
      </svg>
    );
  }
  if (kind === "tee" || kind === "tee-back") {
    return (
      <svg viewBox="0 0 200 230" width={200} height={230} aria-hidden>
        <path d="M60 30 L84 22 Q100 34 116 22 L140 30 L176 56 L160 82 L145 72 L145 210 L55 210 L55 72 L40 82 L24 56 Z" fill={INKG} />
        {kind === "tee" ? <><path d="M84 22 Q100 34 116 22" fill="none" stroke="#FFFFFF" strokeWidth="3" /><GLogo x={112} y={66} w={26} /></> : <GLogo x={60} y={70} w={80} />}
      </svg>
    );
  }
  const white = kind === "shirt-white";
  const body = white ? "#FFFFFF" : INKG;
  return (
    <svg viewBox="0 0 200 230" width={200} height={230} aria-hidden>
      {kind === "workjacket"
        ? <path d="M60 30 L84 20 Q100 28 116 20 L140 30 L180 72 L174 176 L156 174 L152 96 L150 178 L50 178 L48 96 L44 174 L26 176 L20 72 Z" fill={body} />
        : <path d={LONG_BODY} fill={body} stroke={white ? "#C7C7CC" : "none"} />}
      {(kind === "shirt" || kind === "shirt-white" || kind === "shirt-trim") && (
        <>
          <path d={SHIRT_COLLAR} fill={kind === "shirt-trim" ? "#FFFFFF" : white ? "#FFFFFF" : "#1C1C1E"} stroke={kind === "shirt-trim" ? "none" : white ? "#C7C7CC" : EDGE} />
          {kind === "shirt-trim" ? <rect x="95" y="46" width="10" height="168" fill="#FFFFFF" /> : <line x1="100" y1="46" x2="100" y2="214" stroke={white ? "#D1D1D6" : EDGE} />}
          {[62, 90, 118, 146].map((y) => <circle key={y} cx="100" cy={y} r="1.8" fill={kind === "shirt-trim" ? INKG : white ? "#AEAEB2" : "#48484A"} />)}
          {[26, 154].map((x) => <rect key={x} x={x} y="162" width="20" height="12" fill={kind === "shirt-trim" ? "#FFFFFF" : white ? "#FFFFFF" : "#1C1C1E"} stroke={kind === "shirt-trim" ? "none" : white ? "#C7C7CC" : EDGE} />)}
          <GLogo x={112} y={70} w={26} color={white ? "#000000" : "#FFFFFF"} />
        </>
      )}
      {kind === "workshirt" && (
        <>
          <path d={SHIRT_COLLAR} fill="#FFFFFF" />
          <path d="M80 24 L24 70 M120 24 L176 70" stroke="#FFFFFF" strokeWidth="2.2" />
          <line x1="100" y1="46" x2="100" y2="214" stroke={EDGE} />
          {[58, 112].map((x) => <g key={x}><rect x={x} y="76" width="30" height="32" fill="#1C1C1E" stroke={EDGE} /><rect x={x} y="76" width="30" height="8" fill="#2C2C2E" /></g>)}
          <GLogo x={114} y={66} w={26} />
        </>
      )}
      {kind === "workjacket" && (
        <>
          <rect x="50" y="166" width="100" height="14" fill="#1C1C1E" />
          <path d="M84 20 L100 34 L116 20 L118 30 L100 40 L82 30 Z" fill="#2C2C2E" />
          <line x1="100" y1="40" x2="100" y2="178" stroke="#FFFFFF" strokeWidth="1.4" />
          {[58, 114].map((x) => <rect key={x} x={x} y="96" width="28" height="30" fill="#1C1C1E" stroke={EDGE} />)}
          <GLogo x={114} y={70} w={26} />
        </>
      )}
      {(kind === "softshell" || kind === "down") && (
        <>
          <path d="M82 16 L118 16 L118 32 L100 38 L82 32 Z" fill="#1C1C1E" stroke={EDGE} />
          {kind === "down" && [70, 100, 130, 160, 190].map((y) => <line key={y} x1="48" y1={y} x2="152" y2={y} stroke="#2C2C2E" strokeWidth="2" />)}
          <line x1="100" y1="36" x2="100" y2="214" stroke="#FFFFFF" strokeWidth="2" />
          <GLogo x={112} y={kind === "down" ? 80 : 66} w={26} />
        </>
      )}
      {kind === "quarterzip" && (
        <>
          <path d="M84 16 L116 16 L116 30 L100 34 L84 30 Z" fill="#1C1C1E" stroke={EDGE} />
          <line x1="100" y1="30" x2="100" y2="80" stroke="#FFFFFF" strokeWidth="2" />
          <GLogo x={112} y={84} w={26} />
        </>
      )}
    </svg>
  );
}

/* ── 122 · Uniforms ────────────────────────────────────────────────────── */

export function Uniforms() {
  return (
    <Chapter
      n={122}
      lead={
        <p>
          A uniform tells a customer who to ask. Ours is simple and well made: black, white trims, the white
          logo on the chest. It looks the same at CISMA, in a customer’s factory and in our office.
        </p>
      }
      toc={[
        { id: "set", title: "The set" },
        { id: "placement", title: "Logo placement" },
        { id: "lanyard", title: "The lanyard and the staff card" },
        { id: "uniform-never", title: "What never to do" },
      ]}
    >
      <Section id="set" title="The set">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="w-full space-y-6">
            {([
              ["Polo — everyone", [["A — piping", <Polo key="a" trim="piping" />, 200], ["B — placket", <Polo key="b" trim="placket" />, 200]]],
              ["Office shirt — meetings, visits, management", [["A — black", <Garment key="a" kind="shirt" />, 230], ["B — white", <Garment key="b" kind="shirt-white" />, 230], ["C — polo details", <Garment key="c" kind="shirt-trim" />, 230]]],
              ["Technicians — installation and service", [["Work shirt", <Garment key="a" kind="workshirt" />, 230], ["Coverall", <Garment key="b" kind="coverall" />, 300], ["Work jacket", <Garment key="c" kind="workjacket" />, 230]]],
              ["Cold weather", [["Soft-shell", <Garment key="a" kind="softshell" />, 230], ["Down jacket", <Garment key="b" kind="down" />, 230], ["Quarter-zip", <Garment key="c" kind="quarterzip" />, 230]]],
              ["T-shirt — booth crews, training days", [["Front", <Garment key="a" kind="tee" />, 230], ["Back", <Garment key="b" kind="tee-back" />, 230]]],
            ] as Array<[string, Array<[string, ReactNode, number]>]>).map(([group, items]) => (
              <div key={group}>
                <p className="mb-2 text-[12px] font-semibold text-[#1D1D1F]">{group}</p>
                <div className="flex flex-wrap items-end gap-4">
                  {items.map(([label, node, h]) => (
                    <Item key={label} label={label}><Scaled w={Math.round((92 * 200) / h)} base={200} h={h}>{node}</Scaled></Item>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Stage>
        <Table
          head={["Who", "Garment", "Colors"]}
          rows={[
            ["Sales, office, exhibitions, visits", "Piqué polo — design A (shoulder piping) or B (white placket)", "Black body; white collar, cuffs, trims and logo"],
            ["Meetings, visits, management", "Long-sleeve shirt — A black, B white, or C black with the polo's white collar, placket and cuffs", "The logo embroidered, one colour"],
            ["Technicians", "Work shirt with two pockets and the polo's piping; a coverall for dirty jobs; a short work jacket over black trousers", "Black, white details; the coverall and jacket carry the large logo on the back"],
            ["Cold weather", "Soft-shell jacket (white zip) for everyone; a down jacket for the Chinese winter; a quarter-zip pullover in the office", "Black, white logo; jackets may carry the back logo"],
            ["Booth crews, training days", "Crew-neck T-shirt, white neck rib", "Black, white logo; the large logo on the back allowed"],
            ["Second version", "Polo or shirt", "White, black trims and logo — hot days and white rooms (ch. 47)"],
          ]}
        />
      </Section>

      <Section id="placement" title="Logo placement">
        <Specs rows={[
          ["Chest", "Wearer’s left, 70–80 mm wide, 180–200 mm below the shoulder seam"],
          ["Back (jackets, coveralls, fair polos, T-shirts)", "Optional: logo 200–250 mm wide, 100 mm below the collar; screen print on T-shirts"],
          ["Sleeve", "The full logo, 40–50 mm wide — or nothing"],
          ["Cap", "The full logo, 60–70 mm wide on the front (ch. 39)"],
          ["Method", "Embroidery, one thread color — screen print or DTF only on technical fabrics (ch. 39)"],
        ]} />
        <Note>In the warehouse, high-visibility vests and safety wear come first. The logo may be printed on the back of a vest, black on yellow; it never covers the reflective strips.</Note>
      </Section>

      <Section id="lanyard" title="The lanyard and the staff card">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <svg viewBox="0 0 220 130" style={{ width: 220 }} aria-hidden>
            <path d="M60 0 L100 100 M160 0 L120 100" stroke="#000000" strokeWidth="16" />
            <rect x="90" y="96" width="40" height="30" rx="3" fill="#FFFFFF" stroke="#AEAEB2" />
          </svg>
        </Stage>
        <Specs rows={[
          ["Strap", "Black, 20 mm, the white logo repeated along it"],
          ["Who", "Everyone — in the office, at visits and at fairs, instead of the fair’s own lanyard"],
          ["Badge", "A clear holder with the staff ID card"],
        ]} />
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-end justify-center gap-5">
            {([["Front", "front", false], ["Back — the current design", "back", false], ["Second version", "front", true]] as Array<[string, "front" | "back", boolean]>).map(([label, side, light]) => (
              <figure key={label} className="flex flex-col items-center gap-2">
                <Scaled w={120} base={124} h={198}><StaffCard side={side} light={light} /></Scaled>
                <figcaption className="text-[11px] font-medium text-[#6E6E73]">{label}</figcaption>
              </figure>
            ))}
          </div>
        </Stage>
        <Specs rows={[
          ["Size", "54 × 86 mm, portrait, on the lanyard — the standard card (ch. 101)"],
          ["Front", "Black: the logo top-left; the portrait in black and white on dark (ch. 66); the name Bold, the title Light; staff number and department"],
          ["Back", "Black: the logo centered; the QR codes (ch. 104) and the horizontal lockup (ch. 43) at the bottom"],
          ["Second version", "White front, black type (ch. 47)"],
          ["Never", "A personal phone number, a home address, or a coloured band per department"],
        ]} />
      </Section>

      <Section id="uniform-never" title="What never to do">
        <Examples cols={2}>
          <Example tone="do" caption="One logo, on the chest, one color." bg="#F5F5F7" h={200}>
            <Scaled w={160} base={200} h={200}><Polo trim="piping" /></Scaled>
          </Example>
          <Example tone="dont" caption="Gold thread, a big logo in the middle, a colored shirt." bg="#F5F5F7" h={200}>
            <Scaled w={160} base={200} h={200}><Polo color="#1D4ED8" logo="center" /></Scaled>
          </Example>
        </Examples>
        <Bullets items={[
          "Slogans, phone numbers or social icons on garments.",
          "Supplier or partner logos next to ours.",
          "Worn, faded or stained uniforms — replace them.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 123 · Merchandise & Gifts ─────────────────────────────────────────── */

export function Merchandise() {
  return (
    <Chapter
      n={123}
      lead={
        <p>
          A gift with our logo lives on someone’s desk for years. A cheap one that breaks says something about
          our machines. So we give few things, and good ones — useful, well made, quietly branded.
        </p>
      }
      toc={[
        { id: "items", title: "Approved items" },
        { id: "merch-rules", title: "Rules" },
      ]}
    >
      <Section id="items" title="Approved items">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-end justify-center gap-6 text-[#1D1D1F]">
            <Item label="Notebook A5">
              <div className="relative h-[84px] w-[62px] rounded-[3px] bg-[#000000]" style={{ boxShadow: "inset -3px 0 0 #38383A" }}>
                <div className="absolute inset-x-0 bottom-3 flex justify-center"><Wordmark color="#FFFFFF" width={34} /></div>
              </div>
            </Item>
            <Item label="Pen">
              <div className="flex h-[84px] items-center"><div className="relative flex h-[8px] w-[84px] items-center rounded-full bg-[#000000] ps-3"><Wordmark color="#FFFFFF" width={30} /></div></div>
            </Item>
            <Item label="Tote bag">
              <div className="relative flex h-[84px] w-[72px] items-end">
                <div className="absolute left-1/2 top-0 h-6 w-9 -translate-x-1/2 rounded-t-full border-[3px] border-b-0 border-[#000000]" />
                <div className="flex h-[66px] w-full items-center justify-center rounded-[2px] bg-[#000000]"><Wordmark color="#FFFFFF" width={46} /></div>
              </div>
            </Item>
            <Item label="Mug">
              <div className="relative flex h-[84px] items-end">
                <div className="flex h-[58px] w-[50px] items-center justify-center rounded-b-[8px] bg-[#000000]"><Wordmark color="#FFFFFF" width={34} /></div>
                <div className="mb-3 h-7 w-4 rounded-r-full border-[3px] border-l-0 border-[#000000]" />
              </div>
            </Item>
            <Item label="Cap">
              <div className="relative flex h-[84px] items-end">
                <div className="relative flex h-[40px] w-[64px] items-center justify-center rounded-t-full bg-[#000000] pt-2"><Wordmark color="#FFFFFF" width={34} /></div>
                <div className="h-[6px] w-[26px] rounded-r-full bg-[#1D1D1F]" />
              </div>
            </Item>
          </div>
        </Stage>
        <Table
          head={["Item", "Method", "Mark"]}
          rows={[
            ["Notebook, A5, black", "Blind or white foil deboss", "Logo 40 mm, bottom center"],
            ["Pen, black metal", "Laser engraving", "The full logo along the barrel, 30 mm"],
            ["Tote bag, black cotton", "Screen print, white", "Logo 120–150 mm"],
            ["Mug, black ceramic (matte), white inside", "Ceramic print, white", "The group lockup, 60 mm, on both sides"],
            ["Paper bag — fairs", "Black art paper, black rope handles, white print", "The group lockup, centered"],
            ["Paper bag — VIP", "Black art paper, black ribbon handles, white foil", "The group lockup, centered; the website small at the bottom"],
            ["Backpack, black", "Embroidery or heat transfer, white", "Logo 60–80 mm, on the upper front"],
            ["Tool bag, black nylon — technicians", "Screen print, white", "The group lockup, large, on the front — from the lockup file"],
            ["Carry-on case, black hard shell", "UV print with a clear coat, or a black engraved badge", "The group lockup, upper center"],
            ["Ashtray, black metal — our offices only", "Laser engraving, the metal’s tone", "The group lockup; never given as a gift"],
            ["Cap, black cotton", "Embroidery, white", "The full logo, 60–70 mm on the front (ch. 39)"],
            ["Tape measure, seam ripper, thread snips", "Pad print", "The full logo along the longest flat side — tools for the people who use our machines"],
          ]}
        />
      </Section>

      <Section id="merch-rules" title="Rules">
        <Bullets items={[
          "Black first, the logo white; white is the second version (ch. 47) — one color, one logo per item.",
          "No slogans, website lists or social icons on gifts.",
          "Sample first: every item is approved on a physical sample before an order (ch. 134).",
          "Gifts follow the law and the customer’s own rules; never cash or cash-like gifts.",
          "Tobacco items are never a KOLEEX gift.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 124 · Seasonal Gifts ──────────────────────────────────────────────── */

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-[150px] flex-col items-center justify-between rounded-[3px] bg-[#000000] p-3 text-center text-[#F5F5F7] shadow-[0_0_0_1px_rgba(255,255,255,0.14)]" style={{ aspectRatio: "105 / 148" }}>
      <Wordmark color="#FFFFFF" width={52} />
      <div className="space-y-1">{children}</div>
      
    </div>
  );
}

export function SeasonalGifts() {
  return (
    <Chapter
      n={124}
      lead={
        <p>
          We work across Egypt, the Gulf, China and the rest of the world, so our calendar has many seasons.
          We greet each partner on the occasions that matter to them, in their language — with the same calm
          KOLEEX card.
        </p>
      }
      toc={[
        { id: "calendar", title: "The calendar" },
        { id: "box", title: "The gift box" },
        { id: "cards", title: "The cards" },
        { id: "season-rule", title: "Colors of the season" },
      ]}
    >
      <Section id="calendar" title="The calendar">
        <Table
          head={["Occasion", "Who we greet", "Language"]}
          rows={[
            ["Ramadan, Eid al-Fitr, Eid al-Adha", "Customers and partners in Egypt, the Gulf and Muslim markets", "Arabic (with English)"],
            ["Spring Festival (Chinese New Year)", "Partners and staff in China, Chinese-speaking customers", "Chinese (with English)"],
            ["Mid-Autumn Festival", "Partners and staff in China", "Chinese"],
            ["New Year", "Everyone", "English, plus the partner’s language"],
            ["Egypt’s national holidays, Chinese Golden Week", "Customers — as a notice of office hours", "The market’s language"],
          ]}
        />
        <Note>Dates of Islamic and Chinese holidays move every year. Plan from the official calendar of each country, two months ahead.</Note>
      </Section>

      <Section id="box" title="The gift box">
        <Stage bg="#F5F5F7" h="auto" pad={28}>
          <div className="relative h-[150px] w-[220px] overflow-hidden rounded-[6px] bg-[#000000] shadow-[0_0_0_1px_rgba(255,255,255,0.14)]">
            <div className="absolute inset-y-0 left-[60%] w-[14px]" style={{ background: SILVER.css }} />
            <div className="absolute left-4 top-4"><Wordmark color="#FFFFFF" width={70} /></div>
            <p dir="rtl" lang="ar" className="absolute bottom-4 left-4 text-[18px] font-semibold" style={{ backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>رمضان كريم</p>
          </div>
        </Stage>
        <Specs rows={[
          ["Box", "Black rigid box, soft-touch, the white logo top-left"],
          ["Band", "A silver band (Pantone 877 C or silver foil paper) around the box"],
          ["Message", "The greeting of the season in silver foil, in the partner’s language"],
          ["Inside", "The gift itself — and the KOLEEX card below"],
          ["Second version", "White box, black band, the greeting in black (ch. 47)"],
        ]} />
      </Section>

      <Section id="cards" title="The cards">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <Card>
              <p dir="rtl" lang="ar" className="text-[16px] font-bold">عيد مبارك</p>
              <p className="text-[7px] text-[#98989D]">Eid Mubarak from all of us at KOLEEX</p>
            </Card>
            <Card>
              <p lang="zh-Hans" className="text-[16px] font-bold">新春快乐</p>
              <p className="text-[7px] text-[#98989D]">Happy Spring Festival</p>
            </Card>
            <Card>
              <p className="text-[14px] font-bold">Happy New Year</p>
              <p className="text-[7px] text-[#98989D]">Thank you for a year of work together</p>
            </Card>
          </div>
        </Stage>
        <Specs rows={[
          ["Card", "105 × 148 mm (A6), 350 g/m² black card; white logo, the greeting in silver foil"],
          ["Inside", "A handwritten line and a real signature — never a printed signature"],
          ["Digital version", "1080 × 1350 px, same layout, for WhatsApp and WeChat (ch. 80)"],
        ]} />
      </Section>

      <Section id="season-rule" title="Colors of the season">
        <Rule why="Red envelopes at Spring Festival and lanterns at Ramadan carry meaning people care about. Our card does not need to borrow them to show respect.">
          The season’s colors belong to the gift; the KOLEEX card stays black and white.
        </Rule>
        <Examples cols={2}>
          <Example tone="do" caption="Traditional gift (a mooncake box, a red envelope) with the KOLEEX card." bg="#F5F5F7" h={170}>
            <div className="flex items-end gap-3">
              <div className="h-[80px] w-[80px] rounded-[4px]" style={{ background: "#B91C1C", boxShadow: "inset 0 0 0 4px #EAB308" }} />
              <div className="flex h-[96px] w-[68px] flex-col items-center justify-center gap-2 rounded-[2px] bg-[#000000] shadow-[0_0_0_1px_rgba(255,255,255,0.14)]"><Wordmark color="#FFFFFF" width={40} /></div>
            </div>
          </Example>
          <Example tone="dont" caption="The logo recolored gold or red for the season." bg="#B91C1C" h={170}>
            <Wordmark color="#EAB308" width={130} />
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 125 · Employer Brand & Hiring ─────────────────────────────────────── */

export function EmployerBrand() {
  return (
    <Chapter
      n={125}
      lead={
        <p>
          The people we hire decide what KOLEEX becomes. A job post is the first thing a good candidate sees of
          us, so it is written like everything else we publish: clear, honest, specific.
        </p>
      }
      toc={[
        { id: "job-post", title: "The job post" },
        { id: "structure", title: "What it says" },
        { id: "hiring-rules", title: "Rules" },
      ]}
    >
      <Section id="job-post" title="The job post">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <Post w={220} bg={INK}>
            <div className="absolute inset-0 flex flex-col p-[8%] text-white">
              <p className="text-[6.5px] font-semibold uppercase tracking-[0.2em] text-[#98989D]">We’re hiring · Taizhou</p>
              <p className="mt-1.5 text-[15px] font-bold leading-[1.1]">Sales Engineer,<br />Middle East</p>
              <div className="mt-3 space-y-1 text-[7px] text-[#D1D1D6]">
                <p>Advise garment factories on the right machines</p>
                <p>Arabic and English · industry experience</p>
                <p>Based in Taizhou, travel to the region</p>
              </div>
              <p className="mt-auto text-[7px] font-semibold">Apply on {KOLEEX_COMPANY.web}</p>
              <div className="mt-2 flex items-center justify-between"><Wordmark color="#FFFFFF" width="34%" /></div>
            </div>
          </Post>
        </Stage>
      </Section>

      <Section id="structure" title="What it says">
        <Table
          head={["Part", "Content"]}
          rows={[
            [<B key="a">Title</B>, "The real job title and the place — no invented titles"],
            [<B key="a">The work</B>, "Three to five lines on what the person will actually do"],
            [<B key="a">The person</B>, "Skills, experience and languages the job needs"],
            [<B key="a">About us</B>, <>The standard company description (<Ref n={32} />)</>],
            [<B key="a">How to apply</B>, "One way, with a closing date"],
          ]}
        />
        <P>Job openings are published from Koleex Hub, so the website and every post announce the same role in the same words.</P>
      </Section>

      <Section id="hiring-rules" title="Rules">
        <Rule why="It is the law in the countries where we hire, and it is how we find the best people.">
          Requirements are about the job — skills, experience, languages. Never age, gender, religion,
          nationality or appearance.
        </Rule>
        <Bullets items={[
          <>Photos of our team only with their consent (<Ref n={66} />).</>,
          "No exaggerated promises about pay, growth or perks.",
          "Every applicant gets an answer, even when it is no.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 126 · Staff on Social Media ───────────────────────────────────────── */

export function StaffSocial() {
  return (
    <Chapter
      n={126}
      lead={
        <p>
          Our people’s own accounts reach customers our pages never will. We welcome them sharing their work —
          as themselves, with a few clear rules that protect our customers, our partners and them.
        </p>
      }
      toc={[
        { id: "can", title: "What you can do" },
        { id: "never-post", title: "What you never post" },
        { id: "profiles", title: "Your work profile" },
        { id: "problems", title: "When something goes wrong" },
      ]}
    >
      <Section id="can" title="What you can do">
        <Bullets items={[
          "Share and repost KOLEEX posts from the official accounts.",
          "Post your own photos from fairs, trainings and customer visits — with the consent of anyone in them.",
          "Say where you work: “Sales Engineer at KOLEEX International Group”.",
          "Answer general questions, and move anything about an order to WhatsApp Business or email.",
        ]} />
      </Section>

      <Section id="never-post" title="What you never post">
        <Rule why="These are the owner’s confidential categories. Once posted, they cannot be taken back.">
          Prices, costs, supplier names, customer names, internal documents, screens of Koleex Hub, and plans that
          have not been announced.
        </Rule>
        <Bullets items={[
          "No personal pages or groups named “KOLEEX …” — only the official accounts use the name (ch. 79).",
          "No edited or recolored logo in your profile picture or banner.",
          "No arguments with customers or competitors in public.",
        ]} />
      </Section>

      <Section id="profiles" title="Your work profile">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Phone w={170}>
              <div className="flex flex-col items-center px-3 pt-4 text-center text-[#1D1D1F]">
                <span className="h-12 w-12 rounded-full bg-[#D1D1D6]" />
                <p className="mt-2 text-[10px] font-bold">Full Name</p>
                <p className="text-[7px] text-[#6E6E73]">Sales Engineer · KOLEEX</p>
                <div className="mt-3 w-full space-y-1 text-start text-[6.5px]">
                  <div className="rounded-[4px] bg-[#F5F5F7] px-2 py-1"><p className="text-[#6E6E73]">About</p><p>Industrial garment machinery · EN / <span lang="ar">عربي</span></p></div>
                  <div className="rounded-[4px] bg-[#F5F5F7] px-2 py-1"><p className="text-[#6E6E73]">Website</p><p>{KOLEEX_COMPANY.web}</p></div>
                </div>
              </div>
            </Phone>
          </div>
        </Stage>
        <Specs rows={[
          ["Photo", "A real, recent photo of you — not the logo"],
          ["Name", "Your real name"],
          ["Title", "Your real job title and “KOLEEX” or “KOLEEX International Group”"],
          ["Link", "The official website"],
        ]} />
      </Section>

      <Section id="problems" title="When something goes wrong">
        <P>
          If a customer complains in public, or a post about KOLEEX worries you, do not reply. Send the link to the
          Marketing Manager — the official account answers, once, calmly (<Ref n={24} />).
        </P>
      </Section>
    </Chapter>
  );
}

/* ── 127 · The Founder's Personal Brand ────────────────────────────────── */

export function FounderBrand() {
  return (
    <Chapter
      n={127}
      lead={
        <p>
          The founder is the most trusted voice KOLEEX has: three generations of the industry in one person. His
          own accounts speak in the first person — personal, but always consistent with the brand.
        </p>
      }
      toc={[
        { id: "identity", title: "Name and image" },
        { id: "voice", title: "Voice and subjects" },
        { id: "founder-post", title: "A post" },
      ]}
    >
      <Section id="identity" title="Name and image">
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed portrait file shown at its own ratio */}
        <img src={FOUNDER_PHOTO} alt="Kamal Shafei, Founder & CEO of KOLEEX" width={720} height={900} className="w-full max-w-[200px] rounded-2xl object-cover grayscale" loading="lazy" />
        <Specs rows={[
            ["Name", "Kamal Shafei"],
            ["Title", "Founder & CEO, KOLEEX International Group"],
            ["Portrait", "One official portrait on black, soft light from above (ch. 66), updated every two years"],
            ["Channels", "LinkedIn first; WeChat for partners in China"],
            ["Profile link", KOLEEX_COMPANY.web],
          ]} />
      </Section>

      <Section id="voice" title="Voice and subjects">
        <Table
          head={["Subject", "Example"]}
          rows={[
            [<B key="a">The industry</B>, "What changes in garment production, and what it means for factories"],
            [<B key="a">The story</B>, "Seventy years from a shop in Cairo to Taizhou — the lessons, not the boasting"],
            [<B key="a">On the road</B>, "Fairs, factories and partners visited — with their consent"],
            [<B key="a">The team</B>, "People at KOLEEX and the work they did"],
          ]}
        />
        <Bullets items={[
          "First person, calm, specific — the brand voice with a name on it (ch. 22).",
          "The same confidential categories as everyone: no prices, customer or supplier names, or unannounced plans (ch. 126).",
          "Personal matters stay personal; no politics or religion.",
        ]} />
      </Section>

      <Section id="founder-post" title="A post">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="w-[280px] rounded-[8px] bg-white p-3 text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- the same portrait, as an avatar */}
              <img src={FOUNDER_PHOTO} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover grayscale" loading="lazy" />
              <div className="min-w-0"><p className="text-[9px] font-bold">Kamal Shafei</p><p className="text-[7px] text-[#6E6E73]">Founder & CEO, KOLEEX International Group</p></div>
            </div>
            <p className="mt-2 text-[8.5px] leading-[1.45]">
              My grandfather opened his shop in Cairo in 1955. What he taught still decides how we work: sell the
              machine the customer needs, not the one on the shelf. Back from four factory visits this week —
              every one of them asked the same question about speed versus stitch quality. Here is what I told them.
            </p>
            <div className="mt-2 h-[90px] rounded-[4px] bg-[#D2D2D7]" />
            <div className="mt-2 flex items-center gap-1.5"><Avatar size={14} /><span className="text-[7px] text-[#6E6E73]">KOLEEX International Group</span></div>
          </div>
        </Stage>
        <Note>This post is an example written to show the voice — not a published post. His posts are his own; when one announces something for the company, the official accounts publish it first and he shares it.</Note>
      </Section>
    </Chapter>
  );
}
