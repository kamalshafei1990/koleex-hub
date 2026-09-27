"use client";

/* Chapters 107–113: machine branding, nameplates & serial labels, warning
   and control panel labels, cartons & crates, shipping marks & labels,
   spare parts packaging, manuals & warranty cards.

   The owner's rules shape all of Part 6: every machine is sold as KOLEEX,
   the supplier is never shown, and a nameplate goes on every machine
   (questionnaire, 27/09/2026). Drawings are flat 2D and to proportion. */

import type { ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import FlatBedMachineIcon from "@/components/icons/machine-kinds/FlatBedMachineIcon";
import OverlockMachineIcon from "@/components/icons/machine-kinds/OverlockMachineIcon";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Monogram, Wordmark } from "../marks";
import { Barcode, INK, Lines, QrBox, Scaled } from "../mockups";

const MONO = { fontFamily: "ui-monospace,'SF Mono',Menlo,Consolas,monospace" } as const;

/* ── Drawings ──────────────────────────────────────────────────────────── */

/** A numbered marker. The numbers match the table under the drawing. */
function Pin({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <span
      className="absolute flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ left: x, top: y, background: "#3E6796", boxShadow: "0 0 0 2px #FFFFFF" }}
    >
      {n}
    </span>
  );
}

/** An industrial flat-bed machine head, side view, designed at 320 × 190. */
function MachineHead({ body = "#F3F4F6", line = "#C9CED6", logo = "#000000", pins = false, foreign = false }: {
  body?: string; line?: string; logo?: string | null; pins?: boolean; foreign?: boolean;
}) {
  const part = (l: number, t: number, w: number, h: number, r = 4, bg = body) => (
    <div className="absolute" style={{ left: l, top: t, width: w, height: h, borderRadius: r, background: bg, boxShadow: `inset 0 0 0 1.5px ${line}` }} />
  );
  return (
    <div className="relative" style={{ width: 320, height: 190 }}>
      {part(16, 142, 288, 22, 3)}
      {part(226, 46, 58, 100, 6)}
      {part(58, 38, 226, 40, 12)}
      {part(44, 38, 50, 78, 8)}
      {part(282, 54, 26, 58, 6, line)}
      <div className="absolute" style={{ left: 64, top: 116, width: 2, height: 24, background: "#9CA3AF" }} />
      <div className="absolute" style={{ left: 57, top: 136, width: 16, height: 5, borderRadius: 1, background: "#9CA3AF" }} />
      {logo && <div className="absolute" style={{ left: 118, top: 50 }}><Wordmark color={logo} width={84} /></div>}
      {foreign && (
        <span className="absolute rounded-[2px] px-1 text-[7px] font-bold italic" style={{ left: 232, top: 60, background: "#DC2626", color: "#FFFFFF" }}>SUPPLIER</span>
      )}
      <span className="absolute text-[6.5px] font-bold tracking-[0.04em]" style={{ left: 50, top: 46, color: logo ?? INK }}>MODEL</span>
      <div className="absolute rounded-[2px]" style={{ left: 236, top: 108, width: 38, height: 22, background: "#E5E7EB", boxShadow: "inset 0 0 0 1px #9CA3AF" }}>
        <div className="mx-[3px] mt-[3px]"><Lines n={3} /></div>
      </div>
      <div className="absolute flex items-center justify-center" style={{ left: 76, top: 118, width: 14, height: 12 }}>
        <svg viewBox="0 0 14 12" width={14} height={12} aria-hidden><path d="M7 0.8 L13.4 11.4 H0.6 Z" fill="#FACC15" stroke="#0A0A0A" strokeWidth="1" /></svg>
      </div>
      {pins && (
        <>
          <Pin n={1} x={150} y={20} />
          <Pin n={2} x={26} y={36} />
          <Pin n={3} x={276} y={124} />
          <Pin n={4} x={92} y={128} />
          <Pin n={5} x={300} y={32} />
        </>
      )}
    </div>
  );
}

/** A nameplate, drawn at 80 × 50 mm proportions (designed at 240 × 150). */
function Nameplate({ ce = true }: { ce?: boolean }) {
  const rows: Array<[string, string]> = [
    ["Model", "Model name"],
    ["Serial no.", "KX-2609-00123"],
    ["Voltage", "220 V ~ 50/60 Hz"],
    ["Power", "550 W"],
    ["Year", "2026"],
  ];
  return (
    <div className="relative rounded-[6px] p-3 text-[#0A0A0A]" style={{ width: 240, height: 150, background: "#E5E7EB", boxShadow: "inset 0 0 0 1px #9CA3AF" }}>
      {[[6, 6], [226, 6], [6, 136], [226, 136]].map(([l, t]) => (
        <span key={`${l}-${t}`} className="absolute h-[8px] w-[8px] rounded-full" style={{ left: l, top: t, background: "#C9CED6", boxShadow: "inset 0 0 0 1px #9CA3AF" }} />
      ))}
      <div className="flex items-center justify-between px-1">
        <Wordmark color="#000000" width={72} />
        {ce && <span className="rounded-[2px] border border-dashed border-[#4B5563] px-1 text-[7px] font-bold text-[#4B5563]">CE</span>}
      </div>
      <div className="mt-2 space-y-[2px] px-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-[#C9CED6] pb-[1px] text-[7.5px]">
            <span className="font-semibold uppercase tracking-[0.06em] text-[#4B5563]">{k}</span>
            <span style={MONO}>{v}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 px-1 text-[5.6px] leading-[1.3] text-[#1A1A1A]">{KOLEEX_COMPANY.en} · Taizhou, Zhejiang, China · MADE IN CHINA</p>
    </div>
  );
}

/** ISO 780 handling symbols, simplified — the printer uses the official artwork. */
function Handling({ kind, size = 22, color = INK }: { kind: "up" | "dry" | "fragile"; size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {kind === "up" && <><path d="M8 20V5M5 8l3-3 3 3M16 20V5M13 8l3-3 3 3M4 21h16" /></>}
      {kind === "dry" && <><path d="M3 11a9 7 0 0 1 18 0Z" /><path d="M12 11v7a2 2 0 0 1-4 0" /><path d="M6 2v2M12 1v2M18 2v2" /></>}
      {kind === "fragile" && <><path d="M7 3h10l-1 7a4 4 0 0 1-8 0Z" /><path d="M12 14v6M8.5 21h7" /></>}
    </svg>
  );
}

function Carton({ w = 280, children }: { w?: number; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[3px] p-3 text-[#0A0A0A]" style={{ width: w, aspectRatio: "60 / 40", background: "#C9A67A", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)" }}>
      <div className="absolute inset-x-0 top-[46%] h-[10px]" style={{ background: "rgba(0,0,0,0.06)" }} />
      {children}
    </div>
  );
}

/* ── 107 · Machine Branding ────────────────────────────────────────────── */

export function MachineBranding() {
  return (
    <Chapter
      n={107}
      lead={
        <p>
          The machine is the most important thing that carries our name. It sits in a customer’s factory for
          years, in front of everyone who works there. It says KOLEEX — and nothing else.
        </p>
      }
      toc={[
        { id: "rule", title: "The rule" },
        { id: "where", title: "Where the brand goes" },
        { id: "specs", title: "Specifications" },
        { id: "bodies", title: "Light and dark bodies" },
        { id: "never", title: "What never to do" },
      ]}
    >
      <Section id="rule" title="The rule">
        <Rule why="A customer who finds another name on the machine loses the reason to buy it from us — and a supplier’s name tells every competitor where to buy it.">
          Every machine leaves as a KOLEEX machine: our logo, our model name, our nameplate — and no other brand
          anywhere a customer can see.
        </Rule>
      </Section>

      <Section id="where" title="Where the brand goes">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <Scaled w={300} base={320} h={190}><MachineHead pins /></Scaled>
        </Stage>
        <Table
          head={["#", "Mark", "Place"]}
          rows={[
            ["1", <B key="a">KOLEEX logo</B>, "Operator side of the arm, centered between the head and the pillar"],
            ["2", <B key="a">Model name</B>, "Face of the head, or the pillar when the head face is too small"],
            ["3", <B key="a">Nameplate</B>, <>Back or side of the pillar, readable after the machine is installed (<Ref n={108} />)</>],
            ["4", <B key="a">Safety labels</B>, <>Where the hazard is, as the standard requires (<Ref n={109} />)</>],
            ["5", <B key="a">K monogram</B>, "Small parts below the logo’s minimum size: handwheel cap, control box, motor cover, tools"],
          ]}
        />
      </Section>

      <Section id="specs" title="Specifications">
        <Specs rows={[
          ["Logo width on the arm", "60–90 mm, by the size of the head; never below 20 mm (ch. 38)"],
          ["Logo color", "Black on light bodies, white on dark bodies — one flat color"],
          ["Method", "Pad print or screen print on the casting; a durable decal only where printing is not possible"],
          ["Durability test", "Rub 20 times with a cloth soaked in sewing-machine oil: the logo must not fade, smear or lift"],
          ["Model name", "Inter Bold, capitals, in the same color as the logo, 4–6 mm tall"],
          ["Motor, control box, table", "KOLEEX logo or K monogram — or nothing; never a third-party brand facing the operator"],
        ]} />
        <Note>How to name models is set in <Ref n={17} />. Until then, use the model name exactly as it is written in Koleex Hub.</Note>
      </Section>

      <Section id="bodies" title="Light and dark bodies">
        <Examples cols={2}>
          <Example tone="do" caption="Light body — black logo." bg="#FFFFFF" h={200}>
            <Scaled w={260} base={320} h={190}><MachineHead /></Scaled>
          </Example>
          <Example tone="do" caption="Dark body — white logo." bg="#FFFFFF" h={200}>
            <Scaled w={260} base={320} h={190}><MachineHead body="#1A1A1A" line="#3F3F46" logo="#FFFFFF" /></Scaled>
          </Example>
        </Examples>
      </Section>

      <Section id="never" title="What never to do">
        <Examples cols={2}>
          <Example tone="dont" caption="A supplier’s or motor maker’s brand left on the machine." bg="#FFFFFF" h={200}>
            <Scaled w={260} base={320} h={190}><MachineHead foreign /></Scaled>
          </Example>
          <Example tone="dont" caption="The logo in color, gold, chrome or with effects." bg="#FFFFFF" h={200}>
            <Scaled w={260} base={320} h={190}><MachineHead logo="#B8860B" /></Scaled>
          </Example>
        </Examples>
        <Bullets items={[
          "Slogans, website addresses, phone numbers or social icons on the machine body.",
          "Two logos on one side of the arm, or a logo on the bed where fabric wears it away.",
          "Stickers placed by hand, crooked, or covering a safety label.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 108 · Nameplates & Serial Labels ──────────────────────────────────── */

export function Nameplates() {
  return (
    <Chapter
      n={108}
      lead={
        <p>
          The nameplate is the machine’s identity card. A technician reads it to order parts, a customs
          officer to check the goods, a customer to claim the warranty. It goes on every machine, it is
          always the same design, and it is always true.
        </p>
      }
      toc={[
        { id: "plate", title: "The nameplate" },
        { id: "contents", title: "What it says" },
        { id: "serial", title: "The serial label" },
        { id: "plate-specs", title: "Specifications" },
      ]}
    >
      <Section id="plate" title="The nameplate">
        <Stage bg="#FFFFFF" h="auto" pad={28}>
          <Scaled w={264} base={240} h={150}><Nameplate /></Scaled>
        </Stage>
      </Section>

      <Section id="contents" title="What it says">
        <Rule why="These are the lines the European Machinery Directive asks for, and the lines every other market understands. One plate works everywhere.">
          Every nameplate carries the same lines, in the same order, in English.
        </Rule>
        <Table
          head={["Line", "Content"]}
          rows={[
            [<B key="a">Brand</B>, "The KOLEEX logo — the master file, never retyped"],
            [<B key="a">Model</B>, "The model name as written in Koleex Hub"],
            [<B key="a">Serial no.</B>, "Unique for every machine, never reused"],
            [<B key="a">Electrical data</B>, "Voltage, frequency and power, exactly as tested"],
            [<B key="a">Year</B>, "The year the machine was completed"],
            [<B key="a">Company</B>, "The legal name and city: KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD., Taizhou, Zhejiang, China"],
            [<B key="a">Origin</B>, "MADE IN CHINA"],
            [<B key="a">Marks</B>, <>CE and other marks only when that model is certified (<Ref n={133} />)</>],
          ]}
        />
        <Note tone="warn">
          The serial number format shown here (<span style={MONO}>KX-2609-00123</span> = KX · year and month of
          completion · running number) is a proposal. It is used only after the owner approves it.
        </Note>
      </Section>

      <Section id="serial" title="The serial label">
        <P>
          A second, smaller label repeats the serial number as a barcode, so the warehouse and the service team
          can scan it. It sits next to the nameplate and on the carton (<Ref n={111} />).
        </P>
        <Stage bg="#F5F5F5" h="auto" pad={24}>
          <div className="flex items-center gap-3 rounded-[4px] bg-white px-3 py-2 text-[#0A0A0A] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ width: 240 }}>
            <Monogram color="#000000" style={{ width: 18 }} />
            <div className="min-w-0 flex-1">
              <Barcode w={150} h={22} />
              <p className="mt-0.5 text-[8px] tracking-[0.08em]" style={MONO}>KX-2609-00123</p>
            </div>
          </div>
        </Stage>
      </Section>

      <Section id="plate-specs" title="Specifications">
        <Specs rows={[
          ["Size", "80 × 50 mm on machine heads; 60 × 40 mm on small machines"],
          ["Material", "Aluminum 0.5 mm, black print or etching; riveted, or bonded with industrial adhesive"],
          ["Serial label", "50 × 20 mm polyester, thermal-transfer print, Code 128 barcode"],
          ["Type", "Inter; the logo from the master file (ch. 136)"],
          ["Position", "Back or side of the pillar; readable when the machine stands on its table"],
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 109 · Warning & Control Panel Labels ──────────────────────────────── */

export function WarningLabels() {
  return (
    <Chapter
      n={109}
      lead={
        <p>
          Safety labels are the one place where the brand steps aside. Their shapes, colors and symbols are
          set by international standards so that anyone, anywhere, understands them in a second.
        </p>
      }
      toc={[
        { id: "safety", title: "Safety labels" },
        { id: "panel", title: "Control panels" },
        { id: "label-specs", title: "Specifications" },
      ]}
    >
      <Section id="safety" title="Safety labels">
        <Rule why="A worker’s hand is worth more than a consistent palette. Standard safety colors are recognized before they are read.">
          Safety labels follow ISO 7010 and ISO 3864: their yellow, red and blue, and their symbols, are never
          changed to brand colors, restyled, or replaced with the logo.
        </Rule>
        <Examples cols={2}>
          <Example tone="do" caption="Standard warning: symbol, signal word, short text — English and the market’s language." bg="#FFFFFF" h={170}>
            <div className="flex w-[250px] overflow-hidden rounded-[3px] border-2 border-[#0A0A0A] bg-white text-[#0A0A0A]">
              <div className="flex w-[70px] shrink-0 items-center justify-center bg-[#FACC15]">
                <svg viewBox="0 0 40 36" width={44} height={40} aria-hidden><path d="M20 2 L38 34 H2 Z" fill="#FACC15" stroke="#0A0A0A" strokeWidth="3" strokeLinejoin="round" /><path d="M20 12v11" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" /><circle cx="20" cy="28.5" r="2.2" fill="#0A0A0A" /></svg>
              </div>
              <div className="min-w-0 flex-1 p-2">
                <p className="text-[11px] font-black tracking-[0.06em]">WARNING</p>
                <p className="text-[8px] leading-tight">Switch off before threading the needle.</p>
                <p dir="rtl" lang="ar" className="mt-1 text-[8.5px] leading-tight">أطفئ الماكينة قبل لضم الإبرة.</p>
              </div>
            </div>
          </Example>
          <Example tone="dont" caption="A warning recolored to brand black and Hub Blue, with the logo added." bg="#FFFFFF" h={170}>
            <div className="flex w-[250px] items-center gap-2 overflow-hidden rounded-[8px] bg-[#0A0A0A] p-2 text-white">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "#567FB2" }}>!</span>
              <div className="min-w-0"><p className="text-[9px] font-semibold">Please be careful</p><Wordmark color="#FFFFFF" width={50} /></div>
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="panel" title="Control panels">
        <Stage bg="#F5F5F5" h="auto" pad={24}>
          <div className="w-[270px] rounded-[10px] bg-[#1A1A1A] p-3 text-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between">
              <Monogram color="#FFFFFF" style={{ width: 12 }} />
              <span className="text-[7px] tracking-[0.12em] text-[#9CA3AF]" style={MONO}>SPM 3500</span>
            </div>
            <div className="mt-2 rounded-[4px] bg-[#0A0A0A] px-2 py-2 text-center text-[16px] font-semibold tabular-nums" style={MONO}>3500</div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[["I/O", "Power"], ["▲", "Speed +"], ["▼", "Speed −"], ["✂", "Trim"]].map(([s, l]) => (
                <div key={l} className="flex flex-col items-center gap-0.5">
                  <span className="flex h-7 w-full items-center justify-center rounded-[4px] bg-[#2E2E2E] text-[10px]">{s}</span>
                  <span className="text-[6.5px] text-[#9CA3AF]">{l}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[6.5px] text-[#9CA3AF]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />Ready
              <span className="ms-2 h-1.5 w-1.5 rounded-full bg-[#DC2626]" />Fault
            </div>
          </div>
        </Stage>
        <Bullets items={[
          "Symbols from IEC 60417 (power, speed, trimming); a short English word under each.",
          "Dark panel, white text, the K monogram or nothing — the panel is a tool, not an advert.",
          "Status lights mean one thing each: green ready, red fault, amber attention (ch. 45).",
          "Units always shown: SPM, mm, stitches.",
        ]} />
      </Section>

      <Section id="label-specs" title="Specifications">
        <Table
          head={["Label", "Standard", "Languages"]}
          rows={[
            ["Warning, prohibition, mandatory action", "ISO 7010 symbols, ISO 3864 layout and colors", "English + the language of the market"],
            ["Electrical hazard", "ISO 7010 W012", "English + the language of the market"],
            ["Panel symbols", "IEC 60417", "English words under the symbols"],
            ["Direction of rotation", "An arrow on the handwheel", "No words"],
          ]}
        />
        <Note>Labels are polyester or vinyl, oil- and abrasion-resistant, and are placed before the machine is photographed for the pre-shipment check (<Ref n={65} />).</Note>
      </Section>
    </Chapter>
  );
}

/* ── 110 · Cartons & Crates ────────────────────────────────────────────── */

export function Cartons() {
  return (
    <Chapter
      n={110}
      lead={
        <p>
          A carton is the first KOLEEX object a customer’s warehouse sees. It travels through ports, trucks and
          other people’s hands, so it is simple, strong and honest: brown board, black print, clear marks.
        </p>
      }
      toc={[
        { id: "carton", title: "The carton" },
        { id: "crate", title: "The crate" },
        { id: "carton-specs", title: "Specifications" },
        { id: "carton-never", title: "What never to do" },
      ]}
    >
      <Section id="carton" title="The carton">
        <Examples cols={2}>
          <Example tone="do" caption="Long side: the logo, the machine kind, handling symbols." bg="#F5F5F5" h={220}>
            <Carton w={260}>
              <div className="relative flex h-full flex-col justify-between">
                <Wordmark color="#000000" width={96} />
                <div className="flex items-end justify-between">
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em]"><FlatBedMachineIcon size={16} />Machine head</span>
                  <span className="flex gap-1"><Handling kind="up" /><Handling kind="dry" /><Handling kind="fragile" /></span>
                </div>
              </div>
            </Carton>
          </Example>
          <Example tone="do" caption="Short side: the shipping marks (ch. 111)." bg="#F5F5F5" h={220}>
            <div className="relative overflow-hidden rounded-[3px] p-3 text-[#0A0A0A]" style={{ width: 170, aspectRatio: "40 / 40", background: "#C9A67A", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)" }}>
              <div className="space-y-[1px] text-[9px] font-bold leading-tight" style={MONO}>
                <p>ABC</p><p>ALEXANDRIA</p><p>KL-IN-12349</p><p>C/NO. 3/12</p><p>MADE IN CHINA</p>
              </div>
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="crate" title="The crate">
        <Stage bg="#F5F5F5" h="auto" pad={24}>
          <div className="relative w-[280px] overflow-hidden rounded-[2px] p-3 text-[#0A0A0A]" style={{ aspectRatio: "12 / 7", background: "repeating-linear-gradient(0deg,#D8B98C 0 22px,#C9A67A 22px 24px)", boxShadow: "inset 0 0 0 6px #B38D5E" }}>
            <div className="flex h-full flex-col justify-between p-2">
              <div className="flex items-start justify-between">
                <Wordmark color="#000000" width={110} />
                <span className="rounded-[2px] border border-[#0A0A0A] px-1 py-[1px] text-[6.5px] font-bold">ISPM 15 MARK</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-[9px] font-black tracking-[0.1em]">THIS SIDE UP</span>
                <span className="flex gap-1"><Handling kind="up" /><Handling kind="dry" /></span>
              </div>
            </div>
          </div>
        </Stage>
        <P>
          Heavy and automatic machines travel in wooden crates. The wood must be heat-treated and stamped under
          ISPM 15 — without the stamp, customs can refuse the whole shipment.
        </P>
      </Section>

      <Section id="carton-specs" title="Specifications">
        <Specs rows={[
          ["Board", "Brown corrugated, 5-ply for machine heads and tables, 3-ply for small items"],
          ["Print", "One color, black flexo — no full-color printing on shipping cartons"],
          ["Logo", "On both long sides, about one third of the side’s width, never below 80 mm"],
          ["Handling symbols", "ISO 780: this way up, keep dry, fragile — official artwork, black"],
          ["Crates", "Heat-treated wood with the ISPM 15 stamp; logo stenciled in black, at least 200 mm wide"],
          ["Tape", "Plain brown or clear — or KOLEEX tape: the black logo repeated on white"],
        ]} />
      </Section>

      <Section id="carton-never" title="What never to do">
        <Bullets items={[
          "Cartons printed with a supplier’s or a factory’s name, logo, phone number or website.",
          "Another company’s printed tape, or old cartons re-used with their marks showing.",
          "Marks written by hand where printed marks are possible.",
          "Taping over the logo or the shipping marks.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 111 · Shipping Marks & Labels ─────────────────────────────────────── */

export function ShippingMarks() {
  return (
    <Chapter
      n={111}
      lead={
        <p>
          Shipping marks let a forwarder, a customs officer and a warehouse find the right carton without
          opening it. They match the packing list line for line, so a shipment can be checked in minutes.
        </p>
      }
      toc={[
        { id: "marks", title: "The marks" },
        { id: "label", title: "The carton label" },
        { id: "mark-rules", title: "Rules" },
      ]}
    >
      <Section id="marks" title="The marks">
        <Table
          head={["Mark", "Content", "Example"]}
          rows={[
            [<B key="a">Main mark</B>, "Customer code · port of destination · invoice number · carton n/N", <span key="b" style={MONO}>ABC · ALEXANDRIA · KL-IN-12349 · C/NO. 3/12</span>],
            [<B key="a">Side mark</B>, "Description · quantity · N.W. · G.W. · dimensions", <span key="b" style={MONO}>MACHINE HEAD · 1 SET · 38.0 KG · 45.5 KG · 62×32×58 CM</span>],
            [<B key="a">Origin</B>, "Country of origin", <span key="b" style={MONO}>MADE IN CHINA</span>],
            [<B key="a">Handling</B>, "ISO 780 symbols", "This way up, keep dry, fragile"],
          ]}
        />
      </Section>

      <Section id="label" title="The carton label">
        <Stage bg="#F5F5F5" h="auto" pad={24}>
          <div className="w-[200px] rounded-[3px] bg-white p-3 text-[#0A0A0A] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "100 / 150" }}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b-2 border-[#0A0A0A] pb-1.5">
                <Wordmark color="#000000" width={58} />
                <span className="text-[16px] font-black leading-none" style={MONO}>3/12</span>
              </div>
              <div className="mt-2 space-y-1 text-[7.5px]" style={MONO}>
                {[["TO", "ABC · ALEXANDRIA"], ["INVOICE", "KL-IN-12349"], ["ITEM", "MACHINE HEAD × 1"], ["N.W. / G.W.", "38.0 / 45.5 KG"], ["SIZE", "62 × 32 × 58 CM"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2"><span className="text-[#4B5563]">{k}</span><span className="font-semibold">{v}</span></div>
                ))}
              </div>
              <div className="mt-auto">
                <Barcode w={170} h={26} />
                <div className="mt-1 flex items-center justify-between text-[6.5px] font-bold"><span>MADE IN CHINA</span><span style={MONO}>KX-2609-00123</span></div>
              </div>
            </div>
          </div>
        </Stage>
        <Specs rows={[
          ["Size", "100 × 150 mm thermal label, on the short side of the carton"],
          ["Source", "Printed from the packing list in Koleex Hub — never typed again by hand"],
          ["Type", "Monospace for codes and numbers, capitals, black"],
        ]} />
      </Section>

      <Section id="mark-rules" title="Rules">
        <Rule why="A carton passes through dozens of hands. Our customer list is confidential; a code is enough for the warehouse.">
          The customer is shown as a short code — never the customer’s full name.
        </Rule>
        <Bullets items={[
          <>Carton numbers, weights and sizes are the same as on the packing list (<Ref n={96} />).</>,
          "Marks in English, capitals, on two opposite sides of every carton.",
          "The supplier’s name, address or codes never appear on marks or labels.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 112 · Spare Parts Packaging ───────────────────────────────────────── */

export function SparePartsPackaging() {
  return (
    <Chapter
      n={112}
      lead={
        <p>
          Spare parts are small, many and easy to mix up. Their packaging does one job: tell a technician, in a
          glance, which part this is and which machines it fits — and that it is a genuine KOLEEX part.
        </p>
      }
      toc={[
        { id: "part-label", title: "The part label" },
        { id: "part-specs", title: "Specifications" },
      ]}
    >
      <Section id="part-label" title="The part label">
        <Stage bg="#F5F5F5" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="rounded-[6px] p-2" style={{ background: "rgba(255,255,255,0.55)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }}>
              <div className="w-[180px] rounded-[2px] bg-white p-2 text-[#0A0A0A] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "60 / 40" }}>
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between"><Monogram color="#000000" style={{ width: 12 }} /><span className="text-[6px] font-semibold tracking-[0.14em] text-[#4B5563]">GENUINE PART</span></div>
                  <p className="mt-1 text-[9px] font-bold">Presser foot</p>
                  <p className="text-[6.5px] text-[#4B5563]">Fits: model names</p>
                  <div className="mt-auto flex items-end justify-between">
                    <div><Barcode w={80} h={14} /><p className="text-[6px]" style={MONO}>Part no. —</p></div>
                    <span className="text-[8px] font-bold" style={MONO}>QTY 10</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex w-[140px] flex-col items-center justify-center gap-2 rounded-[3px] bg-white p-3 text-[#0A0A0A] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "1 / 1" }}>
              <Wordmark color="#000000" width={80} />
              <p className="text-[7px] font-semibold uppercase tracking-[0.14em] text-[#4B5563]">Service kit</p>
              <OverlockMachineIcon size={26} />
            </div>
          </div>
        </Stage>
      </Section>

      <Section id="part-specs" title="Specifications">
        <Specs rows={[
          ["Bags", "Clear PE with a white 60 × 40 mm label"],
          ["Boxes", "White or brown board, one-color black print, the full logo"],
          ["Mark on the label", "K monogram — the label is below the logo’s minimum size (ch. 41)"],
          ["Part number", "The KOLEEX part number from Koleex Hub; never a supplier’s code on the outside"],
          ["Fits", "The KOLEEX models the part fits, by their names in Koleex Hub"],
          ["Barcode", "Code 128 of the part number"],
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 113 · Manuals & Warranty Cards ────────────────────────────────────── */

export function Manuals() {
  return (
    <Chapter
      n={113}
      lead={
        <p>
          The manual is read when something needs doing — setting up, threading, fixing. It is clear before it
          is beautiful: safety first, flat technical drawings, short steps, the reader’s language.
        </p>
      }
      toc={[
        { id: "manual", title: "The manual" },
        { id: "warranty", title: "The warranty card" },
        { id: "manual-specs", title: "Specifications" },
      ]}
    >
      <Section id="manual" title="The manual">
        <Stage bg="#F5F5F5" h="auto" pad={24}>
          <div className="flex flex-wrap items-start justify-center gap-5">
            <div className="relative w-[150px] overflow-hidden rounded-[3px] bg-white text-[#0A0A0A] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "148 / 210" }}>
              <div className="absolute inset-3 flex flex-col">
                <Wordmark color="#000000" width={52} />
                <div className="mt-auto">
                  <FlatBedMachineIcon size={34} />
                  <p className="mt-2 text-[12px] font-bold leading-tight">Model name</p>
                  <p className="text-[7px] text-[#4B5563]">Instruction Manual</p>
                  <p className="mt-2 text-[6px] tracking-[0.1em] text-[#4B5563]">EN · <span lang="ar">العربية</span> · <span lang="zh-Hans">中文</span></p>
                </div>
              </div>
            </div>
            <div className="relative w-[150px] overflow-hidden rounded-[3px] bg-white text-[#0A0A0A] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "148 / 210" }}>
              <div className="absolute inset-3 flex flex-col text-[6px]">
                <p className="text-[9px] font-bold">1 · Safety first</p>
                <div className="mt-1.5 flex items-start gap-1.5 rounded-[2px] border border-[#0A0A0A] p-1">
                  <svg viewBox="0 0 40 36" width={14} height={13} aria-hidden><path d="M20 2 L38 34 H2 Z" fill="#FACC15" stroke="#0A0A0A" strokeWidth="3" /></svg>
                  <p className="leading-tight">Switch off before threading the needle or changing parts.</p>
                </div>
                <p className="mt-2 text-[9px] font-bold">2 · Threading</p>
                <div className="mt-1 flex h-[38%] items-center justify-center rounded-[2px] bg-[#F5F5F5]"><FlatBedMachineIcon size={46} /></div>
                <div className="mt-1.5"><Lines n={3} /></div>
                <p className="mt-auto text-end text-[#9CA3AF]">4</p>
              </div>
            </div>
          </div>
        </Stage>
        <Bullets items={[
          <>Drawings are flat line drawings (<Ref n={60} />); photographs only where a drawing cannot show it.</>,
          "Safety comes first, in the same words as the labels on the machine (ch. 109).",
          "One step, one sentence, one drawing. Numbers on the drawing match the numbers in the text.",
          "English, plus the language of the market — never a machine translation that has not been checked (ch. 30).",
          "Never a supplier’s manual with our logo pasted over theirs.",
        ]} />
      </Section>

      <Section id="warranty" title="The warranty card">
        <Stage bg="#F5F5F5" h="auto" pad={24}>
          <div className="w-[280px] rounded-[3px] bg-white p-3 text-[#0A0A0A] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "148 / 105" }}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between"><Wordmark color="#000000" width={60} /><span className="text-[7px] font-bold tracking-[0.2em]">WARRANTY</span></div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {["Model", "Serial no.", "Date of sale", "Invoice no."].map((k) => (
                  <div key={k} className="overflow-hidden rounded-[2px] border border-[#E5E7EB]">
                    <div className="bg-[#0A0A0A] px-1 py-[1px] text-[5px] font-semibold uppercase tracking-[0.08em] text-white">{k}</div>
                    <div className="h-3" />
                  </div>
                ))}
              </div>
              <div className="mt-auto flex items-end justify-between">
                <p className="max-w-[60%] text-[5.5px] leading-tight text-[#4B5563]">Keep this card with your invoice. The terms of the warranty are on the back.</p>
                <div className="flex h-9 w-16 items-center justify-center rounded-[2px] border border-dashed border-[#9CA3AF] text-[5px] text-[#9CA3AF]">Dealer stamp</div>
              </div>
            </div>
          </div>
        </Stage>
        <P>
          The warranty terms printed on the card are the terms in the sales contract — word for word. The card
          never promises more than the contract does (<Ref n={95} />).
        </P>
      </Section>

      <Section id="manual-specs" title="Specifications">
        <Specs rows={[
          ["Manual", "A5 148 × 210 mm, saddle-stitched, uncoated 100 g/m² inside, 250 g/m² cover, black print"],
          ["Digital copy", "PDF with the same pages, linked by a QR code on the cover and on the machine"],
          ["Warranty card", "A6 148 × 105 mm, 300 g/m² uncoated card"],
          ["Type", "Inter 9/13 pt for steps; the Arabic and Chinese faces of ch. 52–53"],
        ]} />
        <div className="flex items-center gap-3"><QrBox size={36} /><span className="text-[13px] text-[var(--text-secondary)]">The QR code opens the manual and the setup video for that exact model.</span></div>
      </Section>
    </Chapter>
  );
}
