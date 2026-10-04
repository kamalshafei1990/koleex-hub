"use client";

/* Chapters 107–113: machine branding, nameplates & serial labels, warning
   and control panel labels, cartons & crates, shipping marks & labels,
   spare parts packaging, manuals & warranty cards.

   The owner's rules shape all of Part 6: every machine is sold as KOLEEX,
   the supplier is never shown, and a nameplate goes on every machine
   (questionnaire, 27/09/2026). Machines are shown as photographs with numbered
   parts, not drawings (owner, 27/09/2026) — MachineShot until the studio shoot. */

import type { ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import FlatBedMachineIcon from "@/components/icons/machine-kinds/FlatBedMachineIcon";
import OverlockMachineIcon from "@/components/icons/machine-kinds/OverlockMachineIcon";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { Barcode, INK, Lines, MachineShot, QrBox, Scaled } from "../mockups";
import { LEGAL_NAME_EN } from "@/lib/legal-name";

const MONO = { fontFamily: "ui-monospace,'SF Mono',Menlo,Consolas,monospace" } as const;

/* ── Pictures ──────────────────────────────────────────────────────────── */

/** A numbered part on the machine photo. The numbers match the table below it. */
function Pin({ n, x, y }: { n: number; x: string; y: string }) {
  return (
    <span
      className="absolute flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-[11px] font-semibold text-black shadow-[0_0_0_2px_rgba(0,0,0,0.6)]"
      style={{ left: x, top: y }}
    >
      {n}
    </span>
  );
}

/** A nameplate, drawn at 80 × 50 mm proportions (designed at 240 × 150). */
function Nameplate({ ce = true }: { ce?: boolean }) {
  const rows: Array<[string, string]> = [
    ["Model", "Model name"],
    ["Serial no.", "KL2609N0001"],
    ["Voltage", "220 V ~ 50/60 Hz"],
    ["Power", "550 W"],
    ["Year", "2026"],
  ];
  return (
    <div className="relative rounded-[6px] p-3 text-[#F5F5F7]" style={{ width: 240, height: 150, background: "#1D1D1F", boxShadow: "inset 0 0 0 1px #3A3A3C" }}>
      {[[6, 6], [226, 6], [6, 136], [226, 136]].map(([l, t]) => (
        <span key={`${l}-${t}`} className="absolute h-[8px] w-[8px] rounded-full" style={{ left: l, top: t, background: "#3A3A3C", boxShadow: "inset 0 0 0 1px #48484A" }} />
      ))}
      <div className="flex items-center justify-between px-1">
        <Wordmark color="#FFFFFF" width={72} />
        {ce && <span className="rounded-[2px] border border-dashed border-[#98989D] px-1 text-[7px] font-bold text-[#98989D]">CE</span>}
      </div>
      <div className="mt-2 space-y-[2px] px-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-[#3A3A3C] pb-[1px] text-[7.5px]">
            <span className="font-semibold uppercase tracking-[0.06em] text-[#98989D]">{k}</span>
            <span style={MONO}>{v}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 px-1 text-[5.6px] leading-[1.3] text-[#D1D1D6]">{KOLEEX_COMPANY.en} · Taizhou, Zhejiang, China · MADE IN CHINA</p>
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

/** The three KOLEEX cartons (owner, 27/09/2026): which one a model ships in
 *  depends on the product. Same grammar on all three. */
type CartonTone = "kraft" | "white" | "black";
const CARTON: Record<CartonTone, { bg: string; ink: string; edge: string }> = {
  kraft: { bg: "#C9A67A", ink: "#000000", edge: "rgba(0,0,0,0.18)" },
  white: { bg: "#F5F5F7", ink: "#000000", edge: "rgba(0,0,0,0.14)" },
  black: { bg: "#1D1D1F", ink: "#FFFFFF", edge: "rgba(255,255,255,0.12)" },
};

function Carton({ w = 280, tone = "black", children }: { w?: number; tone?: CartonTone; children: ReactNode }) {
  const c = CARTON[tone];
  return (
    <div className="relative overflow-hidden rounded-[3px] p-3" style={{ width: w, aspectRatio: "60 / 40", background: c.bg, color: c.ink, boxShadow: `inset 0 0 0 1px ${c.edge}` }}>
      <div className="absolute inset-x-0 top-[46%] h-[10px]" style={{ background: "#000000" }} />
      {children}
    </div>
  );
}

/* ── 107 · Machine Branding ────────────────────────────────────────────── */

/** An automatic unit (cabinet, gantry, sewing head) with its three logos. */
function AutoUnit() {
  return (
    <div className="relative" style={{ width: 460, height: 210 }}>
      <div className="absolute rounded-[3px] bg-white ring-1 ring-[#C7C7CC]" style={{ left: 40, top: 96, width: 270, height: 100 }} />
      <div className="absolute rounded-[3px] bg-white ring-1 ring-[#C7C7CC]" style={{ left: 310, top: 126, width: 110, height: 70 }} />
      <div className="absolute rounded-[2px] bg-[#E5E5EA] ring-1 ring-[#C7C7CC]" style={{ left: 30, top: 88, width: 400, height: 9 }} />
      <div className="absolute rounded-[3px] bg-[#3A3A3C]" style={{ left: 90, top: 38, width: 210, height: 18 }} />
      <div className="absolute bg-[#C7C7CC]" style={{ left: 288, top: 18, width: 12, height: 70 }} />
      <div className="absolute rounded-[6px] bg-white ring-1 ring-[#C7C7CC]" style={{ left: 340, top: 52, width: 62, height: 36 }} />
      <div className="absolute" style={{ left: 152, top: 43 }}><Wordmark color="#FFFFFF" width={88} /></div>
      <div className="absolute" style={{ left: 54, top: 108 }}><Wordmark color="#000000" width={96} /></div>
      <div className="absolute" style={{ left: 347, top: 66 }}><Wordmark color="#000000" width={48} /></div>
      <Pin n={1} x="6%" y="54%" />
      <Pin n={2} x="92%" y="22%" />
      <Pin n={3} x="16%" y="14%" />
    </div>
  );
}

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
        { id: "bodies", title: "The KOLEEX white" },
        { id: "automatic", title: "Automatic machines" },
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
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <MachineShot w={420} dark={false} label={false}>
            <Pin n={1} x="46%" y="6%" />
            <Pin n={2} x="13%" y="30%" />
            <Pin n={3} x="71%" y="52%" />
            <Pin n={4} x="27%" y="64%" />
            <Pin n={5} x="87%" y="22%" />
          </MachineShot>
        </Stage>
        <Table
          head={["#", "Mark", "Place"]}
          rows={[
            ["1", <B key="a">KOLEEX logo</B>, "Operator side of the arm, centered between the head and the pillar"],
            ["2", <B key="a">Model name</B>, "Face of the head, or the pillar when the head face is too small"],
            ["3", <B key="a">Nameplate</B>, <>Back or side of the pillar, readable after the machine is installed (<Ref n={108} />)</>],
            ["4", <B key="a">Safety labels</B>, <>Where the hazard is, as the standard requires (<Ref n={109} />)</>],
            ["5", <B key="a">Logo on parts</B>, "The full logo along the long side of the control box and motor cover; small parts carry no mark"],
          ]}
        />
      </Section>

      <Section id="specs" title="Specifications">
        <Specs rows={[
          ["Logo width on the arm", "60–90 mm, by the size of the head; never below 20 mm (ch. 38)"],
          ["Body color", "White, matte, with a fine texture — every KOLEEX machine (proposal: RAL 9016 traffic white, confirmed on a painted sample)"],
          ["Other parts", "Motor cover, panel and thread guides: the supplier's standard grey — the brand rule is the white body"],
          ["Logo color", "Black on the white body — one flat color"],
          ["Method", "Printed black on the arm (pad or screen print) — the default. A raised black badge with the white logo only where the surface is curved, small or textured"],
          ["Durability test", "Rub 20 times with a cloth soaked in sewing-machine oil: the logo must not fade, smear or lift"],
          ["Model name", "Inter SemiBold, capitals, in the same color as the logo, 4–6 mm tall"],
          ["Motor, control box, table", "The KOLEEX logo — or nothing; never a third-party brand facing the operator"],
        ]} />
        <Note>How to name models is set in <Ref n={17} />. Until then, use the model name exactly as it is written in Koleex Hub.</Note>
      </Section>

      <Section id="bodies" title="The KOLEEX white">
        <Rule why="One color across the whole range makes a line of machines on a factory floor read as KOLEEX from the door — before anyone sees a logo.">
          Every KOLEEX machine body is white, with the logo in black. Until a model can be ordered in white, it
          takes the factory’s lightest gray — never a color. A black body is only for special editions (ch. 47).
        </Rule>
        <Examples cols={2}>
          <Example tone="do" caption="White body — black logo." bg="#F5F5F7" h={200}>
            <MachineShot w={260} dark={false} label={false} />
          </Example>
          <Example tone="dont" caption="Colored bodies, or mixed colors in one range." bg="#FFFFFF" h={200}>
            <MachineShot w={260} dark={false} label={false} body="graphite" />
          </Example>
        </Examples>
      </Section>

      <Section id="automatic" title="Automatic machines">
        <P>An automatic unit — a cabinet, a gantry and a sewing head — carries three logos at most, each where it is seen from a different distance.</P>
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <AutoUnit />
        </Stage>
        <Table
          head={["#", "Place", "How"]}
          rows={[
            ["1", <B key="a">Cabinet front</B>, "Black logo, large — the first thing seen from the aisle"],
            ["2", <B key="a">Sewing head</B>, "Black logo on the head, as on a single machine"],
            ["3", <B key="a">Gantry cover</B>, "White logo on the dark cover, about 60% of its length — seen from far away at a fair"],
            ["—", <B key="a">Table top</B>, "No logo: the fabric covers it and the work wears it away"],
          ]}
        />
      </Section>

      <Section id="never" title="What never to do">
        <Examples cols={2}>
          <Example tone="dont" caption="A supplier’s or motor maker’s brand left on the machine." bg="#FFFFFF" h={200}>
            <MachineShot w={260} dark={false} label={false}>
              <span className="absolute rounded-[3px] px-1.5 text-[9px] font-bold italic" style={{ left: "70%", top: "34%", background: "#DC2626", color: "#FFFFFF" }}>SUPPLIER</span>
            </MachineShot>
          </Example>
          <Example tone="dont" caption="The logo in color, gold, chrome or with effects." bg="#FFFFFF" h={200}>
            <MachineShot w={260} dark={false} label={false} logoColor="#B8860B" />
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

/** Service stickers on the machine (60 × 40 mm; the QR one is round). */
function ServiceSticker({ kind }: { kind: "white" | "black" | "qr" }) {
  if (kind === "qr") {
    return (
      <div className="flex h-[112px] w-[112px] flex-col items-center justify-center gap-1.5 rounded-full bg-black text-white">
        <Wordmark color="#FFFFFF" width={54} />
        <QrBox size={30} />
        <span className="text-[7px] font-semibold">Service &amp; parts</span>
        <span className="text-[6px] text-[#AEAEB2]" style={MONO}>KL2609N0001</span>
      </div>
    );
  }
  const black = kind === "black";
  return (
    <div className="overflow-hidden rounded-[6px]" style={{ width: 168, height: 112, background: black ? "#000000" : "#FFFFFF", boxShadow: black ? "none" : "0 0 0 1px rgba(0,0,0,0.12)" }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ background: "#000000" }}>
        <Wordmark color="#FFFFFF" width={54} /><span className="text-[7px] font-semibold tracking-[0.1em] text-white">SERVICE</span>
      </div>
      <div className="space-y-3 px-3 pt-2">
        {["Last service", "Next service", "Technician"].map((l) => (
          <div key={l} className="flex items-end gap-2 text-[7px]" style={{ color: black ? "#AEAEB2" : "#6E6E73" }}>
            <span className="w-[52px] shrink-0">{l}</span><span className="h-px flex-1" style={{ background: black ? "#636366" : "#C7C7CC" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The technician's service report on the house sheet. */
function ServiceReport() {
  return (
    <div className="w-[240px] rounded bg-white p-3 text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "210 / 270" }}>
      <div className="flex items-center justify-between"><Wordmark color="#000000" width={56} /><span className="text-[8px] font-bold tracking-[0.06em]">SERVICE REPORT</span></div>
      <div className="mt-2 h-[8px] rounded-[2px] bg-[#0A0A0A]" />
      <div className="mt-2 grid grid-cols-4 overflow-hidden rounded-[3px] text-[4.5px] text-[#6E6E73] ring-1 ring-[#E5E5EA]">
        {["Report no.", "Date", "Customer", "Machine · serial"].map((l) => <span key={l} className="border-l border-[#E5E5EA] px-1 py-1.5 first:border-l-0">{l}</span>)}
      </div>
      {[["Problem reported", 16], ["Work done", 26]].map(([l, h]) => (
        <div key={l as string} className="mt-2"><p className="text-[5px] font-semibold">{l}</p><div className="mt-0.5 rounded-[2px] bg-[#F2F2F7]" style={{ height: h as number }} /></div>
      ))}
      <p className="mt-2 text-[5px] font-semibold">Parts used</p>
      <div className="mt-0.5 h-[7px] bg-[#0A0A0A]" /><div className="mt-px h-[6px] bg-[#F2F2F7]" /><div className="mt-px h-[6px] bg-[#F2F2F7]" />
      <p className="mt-2 text-[5px] font-semibold">Time on site · next service</p><div className="mt-0.5 h-[10px] rounded-[2px] bg-[#F2F2F7]" />
      <div className="mt-5 grid grid-cols-2 gap-3 text-[4.5px] text-[#6E6E73]"><div className="border-t border-[#C7C7CC] pt-0.5">Technician</div><div className="border-t border-[#C7C7CC] pt-0.5">Customer — work accepted</div></div>
    </div>
  );
}

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
        { id: "service-stickers", title: "Service stickers" },
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
            [<B key="a">Company</B>, `The legal name and city: ${LEGAL_NAME_EN}, Taizhou, Zhejiang, China`],
            [<B key="a">Origin</B>, "MADE IN CHINA"],
            [<B key="a">Marks</B>, <>CE and other marks only when that model is certified (<Ref n={133} />)</>],
          ]}
        />
        <Note>
          The serial number: <span style={MONO}>KL2609N0001</span> — KL · the year and month of completion
          (2609) · N · a four-digit running number. It is written exactly the same on the plate, the barcode
          label and every paper: capitals, no spaces.
        </Note>
      </Section>

      <Section id="serial" title="The serial label">
        <P>
          A second, smaller label repeats the serial number as a barcode, so the warehouse and the service team
          can scan it. It sits next to the nameplate and on the carton (<Ref n={111} />).
        </P>
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex items-center gap-3 rounded-[4px] bg-white px-3 py-2 text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ width: 240 }}>
            <Wordmark color="#000000" width={52} />
            <div className="min-w-0 flex-1">
              <Barcode w={150} h={22} />
              <p className="mt-0.5 text-[8px] tracking-[0.08em]" style={MONO}>KL2609N0001</p>
            </div>
          </div>
        </Stage>
      </Section>

      <Section id="service-stickers" title="Service stickers">
        <Examples cols={3}>
          <Example tone="do" caption="The service sticker: white, a black band — any pen writes on it." bg="#F5F5F7" h={170}><ServiceSticker kind="white" /></Example>
          <Example tone="do" caption="On black machines: the black version (a white marker)." bg="#F5F5F7" h={170}><ServiceSticker kind="black" /></Example>
          <Example tone="do" caption="On every machine: the round QR — scan to ask for service or parts." bg="#F5F5F7" h={170}><ServiceSticker kind="qr" /></Example>
        </Examples>
        <Specs rows={[
          ["Service sticker", "60 × 40 mm matte polyester, beside the nameplate; the technician writes the dates by hand"],
          ["Black version", "Only on black special-edition machines, with a white paint marker"],
          ["QR sticker", "40 mm round, on the operator side of the head; it carries the serial and opens a service request for that machine"],
          ["QR", "The KOLEEX QR code (ch. 104): black on white, the logo in the middle, tested before printing"],
        ]} />
      </Section>

      <Section id="plate-specs" title="Specifications">
        <Specs rows={[
          ["Size", "80 × 50 mm on machine heads; 60 × 40 mm on small machines"],
          ["Material", "Black anodized aluminum, 0.8 mm; logo and text laser-engraved — they read white"],
          ["Fixing", "Four rivets, or bonded with industrial adhesive where rivets are not possible"],
          ["On a black machine", "The second version: white plate, black print (ch. 47)"],
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
            <div className="flex w-[250px] overflow-hidden rounded-[3px] border-2 border-[#000000] bg-white text-[#1D1D1F]">
              <div className="flex w-[70px] shrink-0 items-center justify-center bg-[#FACC15]">
                <svg viewBox="0 0 40 36" width={44} height={40} aria-hidden><path d="M20 2 L38 34 H2 Z" fill="#FACC15" stroke="#000000" strokeWidth="3" strokeLinejoin="round" /><path d="M20 12v11" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" /><circle cx="20" cy="28.5" r="2.2" fill="#000000" /></svg>
              </div>
              <div className="min-w-0 flex-1 p-2">
                <p className="text-[11px] font-black tracking-[0.06em]">WARNING</p>
                <p className="text-[8px] leading-tight">Switch off before threading the needle.</p>
                <p dir="rtl" lang="ar" className="mt-1 text-[8.5px] leading-tight">أطفئ الماكينة قبل لضم الإبرة.</p>
              </div>
            </div>
          </Example>
          <Example tone="dont" caption="A warning recolored to brand black and Hub Blue, with the logo added." bg="#FFFFFF" h={170}>
            <div className="flex w-[250px] items-center gap-2 overflow-hidden rounded-[8px] bg-[#000000] p-2 text-white">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "#567FB2" }}>!</span>
              <div className="min-w-0"><p className="text-[9px] font-semibold">Please be careful</p><Wordmark color="#FFFFFF" width={50} /></div>
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="panel" title="Control panels">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="w-[270px] rounded-[10px] bg-[#1D1D1F] p-3 text-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between">
              <Wordmark color="#FFFFFF" width={46} />
              <span className="text-[7px] tracking-[0.12em] text-[#98989D]" style={MONO}>SPM 3500</span>
            </div>
            <div className="mt-2 rounded-[4px] bg-[#000000] px-2 py-2 text-center text-[16px] font-semibold tabular-nums" style={MONO}>3500</div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[["I/O", "Power"], ["▲", "Speed +"], ["▼", "Speed −"], ["✂", "Trim"]].map(([s, l]) => (
                <div key={l} className="flex flex-col items-center gap-0.5">
                  <span className="flex h-7 w-full items-center justify-center rounded-[4px] bg-[#38383A] text-[10px]">{s}</span>
                  <span className="text-[6.5px] text-[#98989D]">{l}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[6.5px] text-[#98989D]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />Ready
              <span className="ms-2 h-1.5 w-1.5 rounded-full bg-[#DC2626]" />Fault
            </div>
          </div>
        </Stage>
        <Bullets items={[
          "Symbols from IEC 60417 (power, speed, trimming); a short English word under each.",
          "Dark panel, white text, the logo small in a corner or nothing — the panel is a tool, not an advert.",
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
          other people’s hands, so it is simple, strong and clear. KOLEEX has three cartons — one grammar, chosen
          by the product.
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
        <Rule why="Different products travel and are seen differently — a head in a container, a small machine on a dealer’s shelf, a flagship at a fair. One grammar keeps all three KOLEEX.">
          Each product ships in one of three KOLEEX cartons — kraft, white or black. The carton is set per model
          in its packing data in Koleex Hub and never changes between shipments of that model.
        </Rule>
        <Examples cols={3}>
          {([["kraft", "Kraft — black print."], ["white", "White — black print."], ["black", "Black — white print."]] as Array<[CartonTone, string]>).map(([t, cap]) => (
            <Example key={t} tone="do" caption={cap} bg="#F5F5F7" h={170}>
              <Carton w={200} tone={t}>
                <div className="relative flex h-full flex-col justify-between">
                  <Wordmark color={CARTON[t].ink} width={76} />
                  <div className="flex items-end justify-between">
                    <span className="inline-flex items-center gap-1 text-[7px] font-bold uppercase tracking-[0.1em]"><FlatBedMachineIcon size={12} />Machine head</span>
                    <span className="flex gap-0.5"><Handling kind="up" size={16} color={CARTON[t].ink} /><Handling kind="dry" size={16} color={CARTON[t].ink} /><Handling kind="fragile" size={16} color={CARTON[t].ink} /></span>
                  </div>
                </div>
              </Carton>
            </Example>
          ))}
        </Examples>
        <Examples cols={2}>
          <Example tone="do" caption="Short side: the shipping marks (ch. 111)." bg="#F5F5F7" h={220}>
            <div className="relative overflow-hidden rounded-[3px] p-3 text-[#F5F5F7]" style={{ width: 170, aspectRatio: "40 / 40", background: "#1D1D1F", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)" }}>
              <div className="space-y-[1px] text-[9px] font-bold leading-tight" style={MONO}>
                <p>CUSTOMER NAME</p><p>ALEXANDRIA</p><p>KL-IN-12349</p><p>MADE IN CHINA</p>
              </div>
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="crate" title="The crate">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="relative w-[280px] overflow-hidden rounded-[2px] p-3 text-[#1D1D1F]" style={{ aspectRatio: "12 / 7", background: "repeating-linear-gradient(0deg,#D8B98C 0 22px,#C9A67A 22px 24px)", boxShadow: "inset 0 0 0 6px #B38D5E" }}>
            <div className="flex h-full flex-col justify-between p-2">
              <div className="flex items-start justify-between">
                <Wordmark color="#000000" width={110} />
                <span className="rounded-[2px] border border-[#000000] px-1 py-[1px] text-[6.5px] font-bold">ISPM 15 MARK</span>
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
          ["Kraft", "Brown corrugated, black flexo print"],
          ["White", "White-top corrugated, black flexo print"],
          ["Black", "Black kraft liner (or white-top flooded black), white print"],
          ["Strength", "5-ply for machine heads and tables, 3-ply for small items — whichever carton"],
          ["Print", "One color only — no full-color printing on shipping cartons"],
          ["Logo", "On both long sides, about one third of the side’s width, never below 80 mm"],
          ["Handling symbols", "ISO 780: this way up, keep dry, fragile — official artwork, in the print color"],
          ["Crates", "Heat-treated wood with the ISPM 15 stamp; logo stenciled in black, at least 200 mm wide"],
          ["Tape", "KOLEEX tape on all three: black, the white logo repeated"],
          ["Labels", "Shipping labels stay white with black print, so every scanner reads them (ch. 111)"],
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
            [<B key="a">Main mark</B>, "Customer name · port of destination · invoice number", <span key="b" style={MONO}>CUSTOMER NAME · ALEXANDRIA · KL-IN-12349</span>],
            [<B key="a">Side mark</B>, "Description · quantity · N.W. · G.W. · dimensions", <span key="b" style={MONO}>MACHINE HEAD · 1 SET · 38.0 KG · 45.5 KG · 62×32×58 CM</span>],
            [<B key="a">Origin</B>, "Country of origin", <span key="b" style={MONO}>MADE IN CHINA</span>],
            [<B key="a">Handling</B>, "ISO 780 symbols", "This way up, keep dry, fragile"],
          ]}
        />
      </Section>

      <Section id="label" title="The carton label">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="w-[200px] rounded-[3px] bg-white p-3 text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "100 / 150" }}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b-2 border-[#000000] pb-1.5">
                <Wordmark color="#000000" width={58} />
                <span className="text-[8px] font-bold leading-none" style={MONO}>KL-IN-12349</span>
              </div>
              <div className="mt-2 space-y-1 text-[7.5px]" style={MONO}>
                {[["TO", "CUSTOMER NAME"], ["PORT", "ALEXANDRIA, EGYPT"], ["ITEM", "MACHINE HEAD × 1"], ["N.W. / G.W.", "38.0 / 45.5 KG"], ["SIZE", "62 × 32 × 58 CM"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2"><span className="text-[#6E6E73]">{k}</span><span className="font-semibold">{v}</span></div>
                ))}
              </div>
              <div className="mt-auto">
                <Barcode w={170} h={26} />
                <div className="mt-1 flex items-center justify-between text-[6.5px] font-bold"><span>MADE IN CHINA</span><span style={MONO}>KL2609N0001</span></div>
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
        <Rule why="Marks typed by hand drift from the packing list — a wrong weight or port stops a shipment at customs.">
          Every mark and label is printed from the packing list in Koleex Hub, from one template — never typed
          again by hand.
        </Rule>
        <Examples cols={2}>
          <Example tone="do" caption="The crate mark: the black block with the white logo, the customer and the country." bg="#D8B98C" h={170}>
            <div className="flex overflow-hidden rounded-[2px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" style={{ width: 230, height: 90 }}>
              <div className="flex w-[46%] items-center justify-center bg-black"><Wordmark color="#FFFFFF" width={78} /></div>
              <div className="flex flex-1 flex-col items-center justify-center gap-1 text-[#1D1D1F]"><span className="text-[9px]">Customer Name</span><span className="text-[13px] font-bold">Egypt</span></div>
            </div>
          </Example>
        </Examples>
        <Bullets items={[
          <>Weights and sizes are the same as on the packing list (<Ref n={96} />).</>,
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
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="rounded-[6px] p-2" style={{ background: "rgba(255,255,255,0.55)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }}>
              <div className="w-[180px] rounded-[2px] bg-white p-2 text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "60 / 40" }}>
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between"><Wordmark color="#000000" width={40} /><span className="text-[6px] font-semibold tracking-[0.14em] text-[#6E6E73]">GENUINE PART</span></div>
                  <p className="mt-1 text-[9px] font-bold">Presser foot</p>
                  <p className="text-[6.5px] text-[#6E6E73]">Fits: model names</p>
                  <div className="mt-auto flex items-end justify-between">
                    <div><Barcode w={80} h={14} /><p className="text-[6px]" style={MONO}>Part no. —</p></div>
                    <span className="text-[8px] font-bold" style={MONO}>QTY 10</span>
                  </div>
                </div>
              </div>
            </div>
            {([["#000000", "#FFFFFF", "#98989D", "rgba(255,255,255,0.14)"], ["#FFFFFF", "#000000", "#6E6E73", "rgba(0,0,0,0.12)"]] as const).map(([bg, ink, dim, edge]) => (
              <div key={bg} className="flex w-[130px] flex-col items-center justify-center gap-2 rounded-[3px] p-3" style={{ aspectRatio: "1 / 1", background: bg, color: ink, boxShadow: `0 0 0 1px ${edge}` }}>
                <Wordmark color={ink} width={76} />
                <p className="text-[7px] font-semibold uppercase tracking-[0.14em]" style={{ color: dim }}>Service kit</p>
                <OverlockMachineIcon size={24} />
              </div>
            ))}
          </div>
        </Stage>
      </Section>

      <Section id="part-specs" title="Specifications">
        <Specs rows={[
          ["Bags", "Clear PE with a white 60 × 40 mm label"],
          ["Boxes", "Black (white logo) or white (black logo) — set per product in Koleex Hub; the white part label carries the data and the barcode"],
          ["Mark on the label", "The full logo, 30 mm wide across the top of the label (ch. 41)"],
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
          is beautiful: safety first, photographs with numbered parts, short steps, the reader’s language.
        </p>
      }
      toc={[
        { id: "manual", title: "The manual" },
        { id: "warranty", title: "The warranty card" },
        { id: "service-report", title: "The service report" },
        { id: "manual-specs", title: "Specifications" },
      ]}
    >
      <Section id="manual" title="The manual">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-start justify-center gap-5">
            {([["#000000", "#FFFFFF", "#98989D", true], ["#FFFFFF", "#000000", "#6E6E73", false], ["#F5F5F7", "#000000", "#6E6E73", false]] as const).map(([bg, ink, dim, dark]) => (
              <div key={bg} className="relative w-[130px] overflow-hidden rounded-[3px]" style={{ aspectRatio: "148 / 210", background: bg, color: ink, boxShadow: dark ? "0 0 0 1px rgba(255,255,255,0.14)" : "0 0 0 1px rgba(0,0,0,0.12)" }}>
                <div className="absolute inset-3 flex flex-col">
                  <Wordmark color={ink} width={48} />
                  <div className="mt-auto">
                    <MachineShot w="100%" dark={dark} label={false} />
                    <p className="mt-2 text-[11px] font-semibold leading-tight">Model name</p>
                    <p className="text-[7px]" style={{ color: dim }}>Instruction Manual</p>
                    <p className="mt-2 text-[6px] tracking-[0.1em]" style={{ color: dim }}>EN · <span lang="ar">العربية</span> · <span lang="zh-Hans">中文</span></p>
                  </div>
                </div>
              </div>
            ))}
            <div className="relative w-[150px] overflow-hidden rounded-[3px] bg-white text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "148 / 210" }}>
              <div className="absolute inset-3 flex flex-col text-[6px]">
                <p className="text-[9px] font-bold">1 · Safety first</p>
                <div className="mt-1.5 flex items-start gap-1.5 rounded-[2px] border border-[#000000] p-1">
                  <svg viewBox="0 0 40 36" width={14} height={13} aria-hidden><path d="M20 2 L38 34 H2 Z" fill="#FACC15" stroke="#000000" strokeWidth="3" /></svg>
                  <p className="leading-tight">Switch off before threading the needle or changing parts.</p>
                </div>
                <p className="mt-2 text-[9px] font-bold">2 · Threading</p>
                <div className="relative mt-1 flex h-[38%] items-center justify-center rounded-[2px] bg-[#F5F5F7] px-2">
                  <MachineShot w="100%" dark={false} label={false} logo={false} />
                  <span className="absolute left-[22%] top-[18%] flex h-3 w-3 items-center justify-center rounded-full bg-white text-[6px] font-semibold text-black shadow-[0_0_0_1px_rgba(0,0,0,0.5)]">1</span>
                  <span className="absolute left-[58%] top-[30%] flex h-3 w-3 items-center justify-center rounded-full bg-white text-[6px] font-semibold text-black shadow-[0_0_0_1px_rgba(0,0,0,0.5)]">2</span>
                </div>
                <div className="mt-1.5"><Lines n={3} /></div>
                <p className="mt-auto text-end text-[#98989D]">4</p>
              </div>
            </div>
          </div>
        </Stage>
        <Bullets items={[
          <>Photographs, not drawings: the machine with numbered parts, and a close-up for every step (<Ref n={60} />).</>,
          "Safety comes first, in the same words as the labels on the machine (ch. 109).",
          "One step, one sentence, one photograph. Numbers on the photograph match the numbers in the text.",
          "English, plus the language of the market — never a machine translation that has not been checked (ch. 30).",
          "Never a supplier’s manual with our logo pasted over theirs.",
        ]} />
      </Section>

      <Section id="warranty" title="The warranty card">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="w-[280px] rounded-[3px] bg-white p-3 text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "148 / 105" }}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between"><Wordmark color="#000000" width={60} /><span className="text-[7px] font-bold tracking-[0.2em]">WARRANTY</span></div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {["Model", "Serial no.", "Date of sale", "Invoice no."].map((k) => (
                  <div key={k} className="overflow-hidden rounded-[2px] border border-[#D2D2D7]">
                    <div className="bg-[#000000] px-1 py-[1px] text-[5px] font-semibold uppercase tracking-[0.08em] text-white">{k}</div>
                    <div className="h-3" />
                  </div>
                ))}
              </div>
              <div className="mt-auto flex items-end justify-between">
                <p className="max-w-[60%] text-[5.5px] leading-tight text-[#6E6E73]">Keep this card with your invoice. The terms of the warranty are on the back.</p>
                <div className="flex h-9 w-16 items-center justify-center rounded-[2px] border border-dashed border-[#98989D] text-[5px] text-[#98989D]">Dealer stamp</div>
              </div>
            </div>
          </div>
        </Stage>
        <P>
          The warranty terms printed on the card are the terms in the sales contract — word for word. The card
          never promises more than the contract does (<Ref n={95} />).
        </P>
      </Section>

      <Section id="service-report" title="The service report">
        <Stage bg="#F5F5F7" h="auto" pad={24}><ServiceReport /></Stage>
        <Specs rows={[
          ["Sheet", "The house sheet, 210 × 270 mm, like every KOLEEX document (ch. 94)"],
          ["Filled in", "Koleex Hub, on the technician's phone or tablet; the customer signs on the screen and receives the PDF by WhatsApp or e-mail"],
          ["Paper", "The blank form printed from the Hub (Reports → the report → Blank form), one sheet, for places without a connection — entered into the Hub the same day"],
          ["Number", "SR-2026-0001 for a service visit, IR-2026-0001 for an installation — given by the Hub when the report is sent; a revised version keeps it"],
          ["Contents", "Report no., date, customer, machine and serial; the problem, the work done, parts used, time on site, the next service; two signatures"],
        ]} />
        <Note>In Koleex Hub: Reports → Service visit or Installation. Once sent, “Customer copy” prints the PDF the technician sends — without the internal links, the people it went to, its status or the review.</Note>
      </Section>

      <Section id="manual-specs" title="Specifications">
        <Specs rows={[
          ["Manual", "A5 148 × 210 mm, saddle-stitched; cover 250 g/m², uncoated 100 g/m² inside"],
          ["Cover", "Black, white or Cloud gray, with the machine — set per product in Koleex Hub, the same for every manual of that model"],
          ["Digital copy", "PDF with the same pages, linked by a QR code on the cover and on the machine"],
          ["Warranty card", "A6 148 × 105 mm, 300 g/m² uncoated card"],
          ["Type", "Inter 9/13 pt for steps; the Arabic and Chinese faces of ch. 52–53"],
        ]} />
        <div className="flex items-center gap-3"><QrBox size={36} /><span className="text-[13px] text-[var(--text-secondary)]">The QR code opens the manual and the setup video for that exact model.</span></div>
      </Section>
    </Chapter>
  );
}
