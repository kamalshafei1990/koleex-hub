"use client";

/* Chapters 58–62: icons, machine icons, technical drawings & illustration,
   infographics & charts, tables & numbers.

   The icons shown are the Hub's own components, imported live — so this
   chapter can never show an icon the library does not have. */

import type { ComponentType, CSSProperties, ReactElement } from "react";
import {
  B, Bullets, Chapter, Code, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { Peak } from "./layout";

/* Solid set (the core interface library) */
import HomeIcon from "@/components/icons/ui/HomeIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import BellIcon from "@/components/icons/ui/BellIcon";
import CalendarCheckIcon from "@/components/icons/ui/CalendarCheckIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import TruckIcon from "@/components/icons/ui/TruckIcon";
import ShipIcon from "@/components/icons/ui/ShipIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import PrinterIcon from "@/components/icons/ui/PrinterIcon";
/* Line set */
import ContainerIcon from "@/components/icons/ui/ContainerIcon";
import CubicMeterIcon from "@/components/icons/ui/CubicMeterIcon";
import RouteIcon from "@/components/icons/ui/RouteIcon";
import PortIcon from "@/components/icons/ui/PortIcon";
import WeightIcon from "@/components/icons/ui/WeightIcon";
import TimelineIcon from "@/components/icons/ui/TimelineIcon";
/* Machine kinds */
import AutomaticMachineIcon from "@/components/icons/machine-kinds/AutomaticMachineIcon";
import BartackIcon from "@/components/icons/machine-kinds/BartackIcon";
import BlindstitchIcon from "@/components/icons/machine-kinds/BlindstitchIcon";
import ButtonAttachIcon from "@/components/icons/machine-kinds/ButtonAttachIcon";
import ButtonholeMachineIcon from "@/components/icons/machine-kinds/ButtonholeMachineIcon";
import ChainstitchIcon from "@/components/icons/machine-kinds/ChainstitchIcon";
import CoverstitchIcon from "@/components/icons/machine-kinds/CoverstitchIcon";
import CylinderBedMachineIcon from "@/components/icons/machine-kinds/CylinderBedMachineIcon";
import DoubleNeedleIcon from "@/components/icons/machine-kinds/DoubleNeedleIcon";
import FeedOffArmMachineIcon from "@/components/icons/machine-kinds/FeedOffArmMachineIcon";
import FlatBedMachineIcon from "@/components/icons/machine-kinds/FlatBedMachineIcon";
import HeavyDutyMachineIcon from "@/components/icons/machine-kinds/HeavyDutyMachineIcon";
import LongArmMachineIcon from "@/components/icons/machine-kinds/LongArmMachineIcon";
import MultiNeedleIcon from "@/components/icons/machine-kinds/MultiNeedleIcon";
import OverlockMachineIcon from "@/components/icons/machine-kinds/OverlockMachineIcon";
import PatternSewerIcon from "@/components/icons/machine-kinds/PatternSewerIcon";
import PostBedMachineIcon from "@/components/icons/machine-kinds/PostBedMachineIcon";
import SafetyStitchIcon from "@/components/icons/machine-kinds/SafetyStitchIcon";
import SpecialMachineIcon from "@/components/icons/machine-kinds/SpecialMachineIcon";
import WalkingFootMachineIcon from "@/components/icons/machine-kinds/WalkingFootMachineIcon";
import ZigzagMachineIcon from "@/components/icons/machine-kinds/ZigzagMachineIcon";

type IconC = ComponentType<{ size?: number; className?: string; style?: CSSProperties }>;

const SOLID: Array<[string, IconC]> = [
  ["Home", HomeIcon], ["Search", SearchIcon], ["Notifications", BellIcon], ["Calendar", CalendarCheckIcon],
  ["Document", DocumentIcon], ["Delivery", TruckIcon], ["Shipping", ShipIcon], ["Markets", GlobeIcon],
  ["Team", UsersIcon], ["Certified", ShieldCheckIcon], ["Download", DownloadIcon], ["Print", PrinterIcon],
];
const LINE: Array<[string, IconC]> = [
  ["Container", ContainerIcon], ["Volume (CBM)", CubicMeterIcon], ["Route", RouteIcon],
  ["Port", PortIcon], ["Weight", WeightIcon], ["Timeline", TimelineIcon],
];
export const MACHINE_ICONS: Array<[string, IconC, string]> = [
  ["Flat bed", FlatBedMachineIcon, "The default industrial silhouette"],
  ["Overlock", OverlockMachineIcon, "Edge trim and overedge stitch"],
  ["Safety stitch", SafetyStitchIcon, "Overlock plus a chainstitch (5-thread)"],
  ["Coverstitch", CoverstitchIcon, "Coverstitch, interlock, flatlock"],
  ["Chainstitch", ChainstitchIcon, "Single-thread chain of loops"],
  ["Double needle", DoubleNeedleIcon, "Two parallel needles"],
  ["Multi-needle", MultiNeedleIcon, "Three or more needles: waistbands, elastics"],
  ["Zigzag", ZigzagMachineIcon, "Side-to-side stitch"],
  ["Blindstitch", BlindstitchIcon, "Blind hem"],
  ["Bartack", BartackIcon, "Reinforcing stitch at stress points"],
  ["Buttonhole", ButtonholeMachineIcon, "Buttonhole machines"],
  ["Button attach", ButtonAttachIcon, "Button sewing"],
  ["Cylinder bed", CylinderBedMachineIcon, "Narrow arm for tubular work"],
  ["Post bed", PostBedMachineIcon, "Head on a vertical post"],
  ["Feed-off-the-arm", FeedOffArmMachineIcon, "Arm toward the operator: inseams, side seams"],
  ["Long arm", LongArmMachineIcon, "Extended reach for large panels"],
  ["Walking foot", WalkingFootMachineIcon, "Compound feed for thick layers"],
  ["Heavy duty", HeavyDutyMachineIcon, "Denim, leather, canvas"],
  ["Pattern sewer", PatternSewerIcon, "Programmed / CNC template machines"],
  ["Automatic", AutomaticMachineIcon, "Automatic and robotic sewing cells"],
  ["Special", SpecialMachineIcon, "Special-purpose machines"],
];

function IconTile({ name, Icon, size = 24 }: { name: string; Icon: IconC; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-2 py-3 text-[#0A0A0A]">
      <Icon size={size} />
      <span className="text-center text-[10.5px] leading-tight text-[#4B5563]">{name}</span>
    </div>
  );
}

/* ── 58 · Icons ────────────────────────────────────────────────────────── */

export function Icons() {
  return (
    <Chapter
      n={58}
      lead={
        <p>
          KOLEEX draws its own icons. The same library runs Koleex Hub, our documents and our marketing:
          one grid, one family, one color at a time. We never borrow icons from icon websites or other
          brands.
        </p>
      }
      toc={[
        { id: "library", title: "Our library" },
        { id: "construction", title: "Construction" },
        { id: "sizes", title: "Sizes" },
        { id: "icon-color", title: "Color" },
        { id: "icon-donts", title: "What never to do" },
      ]}
    >
      <Section id="library" title="Our library">
        <P>Two drawing styles live in the library. Both are ours; each has its place.</P>
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">Solid — the core set, used across the Hub and in documents</p>
        <Stage bg="#F5F5F5" h="auto" pad={16}>
          <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6">{SOLID.map(([n, I]) => <IconTile key={n} name={n} Icon={I} />)}</div>
        </Stage>
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">Line — 2 px rounded strokes, for technical and logistics subjects</p>
        <Stage bg="#F5F5F5" h="auto" pad={16}>
          <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6">{LINE.map(([n, I]) => <IconTile key={n} name={n} Icon={I} />)}</div>
        </Stage>
        <Rule why="Two weights side by side read as a mistake, not a choice.">
          Never mix solid and line icons in the same row, menu or group. Pick the style of the group and
          keep it.
        </Rule>
      </Section>

      <Section id="construction" title="Construction">
        <Specs rows={[
          ["Grid", "24 × 24, with 2 px of safe space on every side (live area 20 × 20)"],
          ["Line icons", "2 px stroke, round caps and round joins"],
          ["Solid icons", "Filled shapes, no outlines added"],
          ["Color", "One color — the color of the text around it (currentColor in code)"],
          ["Corners", "Softly rounded, matching the rounded letters of the logo"],
          ["Where they live", <span key="w">In the Hub library: <Code>src/components/icons/ui/</Code></span>],
        ]} />
        <Note>Need an icon that does not exist? Ask for it: it is drawn in this style and added to the shared library, so everyone gets the same one.</Note>
      </Section>

      <Section id="sizes" title="Sizes">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="flex flex-wrap items-end gap-8 text-[#0A0A0A]">
            {[16, 20, 24, 32, 48].map((s) => (
              <div key={s} className="flex flex-col items-center gap-2"><ShipIcon size={s} /><span className="font-mono text-[10.5px] text-[#4B5563]">{s}</span></div>
            ))}
          </div>
        </Stage>
        <Table
          head={["Size", "Use"]}
          rows={[
            ["16 px", "Inside text, table cells, small buttons"],
            ["20 px", "Menus, list rows, form fields"],
            ["24 px", "The standard size — toolbars, cards"],
            ["32 px", "Feature lists, spec sheet highlights"],
            ["48 px and up", "Category tiles, catalog section openers, signs"],
          ]}
        />
      </Section>

      <Section id="icon-color" title="Color">
        <Examples cols={3}>
          <Example tone="do" caption="The color of the text around it." bg="#FFFFFF" h={110}>
            <span className="flex items-center gap-2 text-[14px] text-[#0A0A0A]"><TruckIcon size={18} />Delivery</span>
          </Example>
          <Example tone="do" caption="Hub Blue for the active or selected item." bg="#FFFFFF" h={110}>
            <span className="flex items-center gap-2 text-[14px] font-semibold text-[#3E6796]"><ShipIcon size={18} />Shipping</span>
          </Example>
          <Example tone="do" caption="Status colors only on status icons." bg="#FFFFFF" h={110}>
            <span className="flex items-center gap-2 text-[14px] text-[#059669]"><ShieldCheckIcon size={18} />Approved</span>
          </Example>
        </Examples>
      </Section>

      <Section id="icon-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="Solid and line icons mixed in one row." bg="#FFFFFF" h={110}>
            <div className="flex items-center gap-4 text-[#0A0A0A]"><TruckIcon size={24} /><RouteIcon size={24} /><DocumentIcon size={24} /><PortIcon size={24} /></div>
          </Example>
          <Example tone="dont" caption="Emoji or icons from other libraries." bg="#FFFFFF" h={110}>
            <div className="flex items-center gap-4 text-[26px]"><span>🚚</span><span>📦</span><span>✅</span></div>
          </Example>
          <Example tone="dont" caption="Colorful, multi-tone or 3D icons." bg="#FFFFFF" h={110}>
            <div className="flex items-center gap-4">
              <span style={{ color: "#F59E0B", filter: "drop-shadow(2px 3px 0 #92400E)" }}><TruckIcon size={28} /></span>
              <span style={{ color: "#10B981", filter: "drop-shadow(2px 3px 0 #065F46)" }}><ShipIcon size={28} /></span>
            </div>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 59 · Machine Icons ────────────────────────────────────────────────── */

export function MachineIcons() {
  return (
    <Chapter
      n={59}
      lead={
        <p>
          One icon for each kind of sewing machine we sell. They label categories in Koleex Hub, in our
          catalogs, on spec sheets and on the website — so a customer learns them once and recognises them
          everywhere.
        </p>
      }
      toc={[
        { id: "set", title: "The set" },
        { id: "rules", title: "Rules" },
        { id: "in-use", title: "In use" },
      ]}
    >
      <Section id="set" title="The set">
        <Stage bg="#F5F5F5" h="auto" pad={16}>
          <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {MACHINE_ICONS.map(([n, I]) => <IconTile key={n} name={n} Icon={I} size={32} />)}
          </div>
        </Stage>
        <Table head={["Icon", "Machine kind"]} rows={MACHINE_ICONS.map(([n, , d]) => [<B key="n">{n}</B>, d])} />
      </Section>

      <Section id="rules" title="Rules">
        <Rule why="If one icon can mean two machines, or one machine has two icons, the icons stop meaning anything.">
          One icon per machine kind, and one machine kind per icon — everywhere.
        </Rule>
        <Bullets items={[
          <>Machine icons are <B>line</B> icons (1.7 px on the 24 grid, round ends). Use them with other line icons, never mixed with solid ones.</>,
          "Show the icon with its name — the icon helps recognition, the word gives the meaning.",
          "A new machine kind gets a new icon, drawn in the same style and added to the set before it is used.",
          "Never replace a machine icon with a product photo cut-out or a clip-art machine.",
        ]} />
      </Section>

      <Section id="in-use" title="In use">
        <Examples cols={2}>
          <Example tone="do" caption="Catalog category tiles." bg="#F5F5F5" h={200}>
            <div className="grid grid-cols-3 gap-2">
              {MACHINE_ICONS.slice(0, 6).map(([n, I]) => (
                <div key={n} className="flex h-[76px] w-[92px] flex-col justify-between rounded-xl bg-white p-2.5 text-[#0A0A0A] shadow-[0_0_0_1px_#E5E7EB]">
                  <I size={22} /><span className="text-[10px] font-semibold">{n}</span>
                </div>
              ))}
            </div>
          </Example>
          <Example tone="do" caption="Spec sheet header." bg="#FFFFFF" h={200}>
            <div className="w-full max-w-[260px] text-[#0A0A0A]">
              <div className="flex items-center justify-between"><Wordmark color="#000000" width={70} /><span className="text-[9px] font-bold tracking-[0.1em]">SPEC SHEET</span></div>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#E5E7EB] p-3"><OverlockMachineIcon size={28} /><div><p className="text-[9px] uppercase tracking-[0.16em] text-[#4B5563]">Category</p><p className="text-[13px] font-semibold">Overlock</p></div></div>
            </div>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 60 · Technical Drawings & Illustration ────────────────────────────── */

export function Illustration() {
  const L = "#0A0A0A";
  const D = "#3E6796";
  return (
    <Chapter
      n={60}
      lead={
        <p>
          When a photograph cannot explain it — a dimension, a part, a process — we draw it. Our drawings
          are flat, precise and quiet: black lines, one blue for what matters, and nothing pretending to be
          3D.
        </p>
      }
      toc={[
        { id: "2d", title: "Flat 2D only" },
        { id: "drawings", title: "Technical drawings" },
        { id: "diagrams", title: "Process diagrams" },
        { id: "maps", title: "Maps" },
        { id: "ill-donts", title: "What never to do" },
      ]}
    >
      <Section id="2d" title="Flat 2D only">
        <Rule why="Flat drawings stay exact at any size, print cleanly on any paper, and age well. 3D renders date quickly and invite comparison with real photographs.">
          Every drawing, diagram and illustration is flat 2D. No 3D renders, perspective effects, metallic
          shading, bevels or reflections.
        </Rule>
      </Section>

      <Section id="drawings" title="Technical drawings">
        <Stage bg="#FFFFFF" h="auto" pad={20}>
          <svg viewBox="0 0 560 260" className="h-auto w-full max-w-[600px]" role="img" aria-label="Example technical drawing: a machine table with dimension lines">
            <rect x="80" y="110" width="360" height="16" rx="3" fill="none" stroke={L} strokeWidth="2" />
            <line x1="100" y1="126" x2="100" y2="220" stroke={L} strokeWidth="2" />
            <line x1="420" y1="126" x2="420" y2="220" stroke={L} strokeWidth="2" />
            <g transform="translate(205 30) scale(3.4)" color={L}><FlatBedMachineIcon size={24} /></g>
            <line x1="80" y1="245" x2="440" y2="245" stroke={D} strokeWidth="1.5" />
            <line x1="80" y1="238" x2="80" y2="252" stroke={D} strokeWidth="1.5" />
            <line x1="440" y1="238" x2="440" y2="252" stroke={D} strokeWidth="1.5" />
            <text x="260" y="240" textAnchor="middle" fontSize="12" fill={D} fontFamily="Inter, sans-serif">1200 mm</text>
            <line x1="470" y1="110" x2="470" y2="220" stroke={D} strokeWidth="1.5" />
            <line x1="463" y1="110" x2="477" y2="110" stroke={D} strokeWidth="1.5" />
            <line x1="463" y1="220" x2="477" y2="220" stroke={D} strokeWidth="1.5" />
            <text x="484" y="170" fontSize="12" fill={D} fontFamily="Inter, sans-serif">760 mm</text>
            <circle cx="60" cy="118" r="10" fill="none" stroke={L} strokeWidth="1.5" />
            <text x="60" y="122" textAnchor="middle" fontSize="11" fill={L} fontFamily="Inter, sans-serif">1</text>
            <line x1="70" y1="118" x2="80" y2="118" stroke={L} strokeWidth="1.5" />
          </svg>
        </Stage>
        <Specs rows={[
          ["Outlines", "Black, 2 px (0.5 mm in print); hidden edges dashed at 1 px"],
          ["Dimensions", "Hub Blue Deep #3E6796, 1.5 px, with end ticks; values in mm"],
          ["Part callouts", "Numbered circles joined by a thin leader line; numbers match the parts list"],
          ["Labels", "Inter 11–12 px / 8–9 pt"],
          ["Views", "Front, side and top — flat, never in perspective"],
        ]} />
        <Note>The drawing above shows the style only; its dimensions are an example.</Note>
      </Section>

      <Section id="diagrams" title="Process diagrams">
        <Stage bg="#FFFFFF" h="auto" pad={20}>
          <div className="flex w-full flex-wrap items-center justify-center gap-2 text-[#0A0A0A]">
            {["Quotation", "Proforma invoice", "Contract", "Production & inspection", "Packing list", "Shipment"].map((s, i, a) => (
              <div key={s} className="flex items-center gap-2">
                <span className={`rounded-xl border px-3 py-2 text-[11.5px] font-medium ${i === 3 ? "border-[#567FB2] bg-[#BCD8F0]/40" : "border-[#E5E7EB]"}`}>{s}</span>
                {i < a.length - 1 && <span className="text-[#9CA3AF]">→</span>}
              </div>
            ))}
          </div>
        </Stage>
        <Bullets items={[
          "Boxes with 12 px corners and a hairline; arrows in Silver.",
          "One step highlighted in Hub Blue — the one the diagram is about.",
          "Left to right in English and Chinese; right to left in Arabic.",
        ]} />
      </Section>

      <Section id="maps" title="Maps">
        <Bullets items={[
          "Flat maps only — no satellite images, no globes with lighting.",
          "Land in Mist #E5E7EB (light) or Graphite #1A1A1A (dark); markers in Hub Blue.",
          <><B>Borders must be correct for the country where the map is published.</B> Maps printed or posted in mainland China must use an officially approved base map.</>,
          "Show only locations that are real and current — offices, warehouses, agents under contract.",
        ]} />
      </Section>

      <Section id="ill-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="3D renders of machines." bg="#FFFFFF" h={130}>
            <div className="h-20 w-28 rounded-lg" style={{ background: "linear-gradient(145deg,#F5F5F5,#9CA3AF 60%,#4B5563)", boxShadow: "10px 12px 18px rgba(0,0,0,0.35), inset -6px -6px 12px rgba(0,0,0,0.3)" }} />
          </Example>
          <Example tone="dont" caption="Cartoon characters and mascots." bg="#FFFFFF" h={130}><span className="text-[44px]">🤖</span></Example>
          <Example tone="dont" caption="AI-generated drawings of our products." bg="#FFFFFF" h={130}>
            <span className="rounded-md border border-dashed border-[#9CA3AF] px-3 py-2 text-[10px] tracking-[0.14em] text-[#4B5563]">AI PRODUCT IMAGE</span>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 61 · Infographics & Charts ─────────────────────────────────────────── */

const SAMPLE_BARS: Array<[string, number]> = [["Q1", 42], ["Q2", 58], ["Q3", 51], ["Q4", 74]];

export function Infographics() {
  const max = 80;
  return (
    <Chapter
      n={61}
      lead={
        <p>
          A KOLEEX chart says one thing, clearly: the numbers are exact, the colors are ours, and the
          message is in the title. The data on this page is sample data, shown for style only.
        </p>
      }
      toc={[
        { id: "palette", title: "Chart colors" },
        { id: "types", title: "Choosing a chart" },
        { id: "style", title: "Chart style" },
        { id: "chart-donts", title: "What never to do" },
      ]}
    >
      <Section id="palette" title="Chart colors">
        <div className="flex overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
          {["#3E6796", "#567FB2", "#7FA9D6", "#BCD8F0", "#9CA3AF", "#E5E7EB"].map((c) => <div key={c} className="h-14 flex-1" style={{ background: c }} />)}
        </div>
        <Bullets items={[
          "Series take the Hub Blue family in order, darkest first, then greys.",
          "To make one point, color that series Hub Blue and every other series grey.",
          "Green, amber and red only for good / watch / bad — never as series colors.",
        ]} />
      </Section>

      <Section id="types" title="Choosing a chart">
        <Examples cols={3}>
          <Example tone="do" caption={<><B>Bars</B> — compare amounts.</>} bg="#FFFFFF" h={210}>
            <svg viewBox="0 0 200 150" className="h-auto w-full" role="img" aria-label="Sample bar chart">
              <text x="0" y="12" fontSize="10" fontWeight="600" fill="#0A0A0A" fontFamily="Inter, sans-serif">Shipments per quarter</text>
              <line x1="0" y1="130" x2="200" y2="130" stroke="#E5E7EB" />
              {SAMPLE_BARS.map(([q, v], i) => {
                const h = (v / max) * 100;
                return (
                  <g key={q}>
                    <rect x={12 + i * 48} y={130 - h} width="30" height={h} rx="3" fill={i === 3 ? "#3E6796" : "#BCD8F0"} />
                    <text x={27 + i * 48} y={126 - h} textAnchor="middle" fontSize="9" fill="#0A0A0A" fontFamily="ui-monospace, monospace">{v}</text>
                    <text x={27 + i * 48} y="143" textAnchor="middle" fontSize="9" fill="#4B5563" fontFamily="Inter, sans-serif">{q}</text>
                  </g>
                );
              })}
            </svg>
          </Example>
          <Example tone="do" caption={<><B>Line</B> — change over time.</>} bg="#FFFFFF" h={210}>
            <svg viewBox="0 0 200 150" className="h-auto w-full" role="img" aria-label="Sample line chart">
              <text x="0" y="12" fontSize="10" fontWeight="600" fill="#0A0A0A" fontFamily="Inter, sans-serif">Orders, last 6 months</text>
              {[40, 70, 100].map((y) => <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="#F5F5F5" />)}
              <line x1="0" y1="130" x2="200" y2="130" stroke="#E5E7EB" />
              <polyline points="10,112 45,100 80,104 115,80 150,70 185,48" fill="none" stroke="#567FB2" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx="185" cy="48" r="4" fill="#3E6796" />
            </svg>
          </Example>
          <Example tone="do" caption={<><B>Donut</B> — share of a whole, five parts at most.</>} bg="#FFFFFF" h={210}>
            <svg viewBox="0 0 120 120" className="h-[150px] w-[150px]" role="img" aria-label="Sample donut chart">
              {[["#3E6796", 0.45], ["#7FA9D6", 0.3], ["#E5E7EB", 0.25]].reduce<{ off: number; els: ReactElement[] }>((acc, [c, f], i) => {
                const r = 44; const C = 2 * Math.PI * r; const len = (f as number) * C;
                acc.els.push(<circle key={i} cx="60" cy="60" r={r} fill="none" stroke={c as string} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc.off} transform="rotate(-90 60 60)" />);
                acc.off += len; return acc;
              }, { off: 0, els: [] }).els}
              <text x="60" y="64" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0A0A0A" fontFamily="Inter, sans-serif">45%</text>
            </svg>
          </Example>
        </Examples>
        <P>Exact values that people will copy — prices, specifications, quantities — go in a table, not a chart (<Ref n={62} />).</P>
      </Section>

      <Section id="style" title="Chart style">
        <Specs rows={[
          ["Title", "Says what the chart shows, in plain words; the key message may be the title"],
          ["Axes", "Start bars at zero; hairline gridlines in Cloud or Mist, or none"],
          ["Labels", "Inter 11 px Slate; values in monospace; label lines directly instead of a legend where possible"],
          ["Source", "A line under every chart: where the data comes from and its date (DD/MM/YYYY)"],
          ["Numbers", "Units always stated; thousands with a comma"],
        ]} />
      </Section>

      <Section id="chart-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="3D or exploded pies." bg="#FFFFFF" h={130}>
            <div className="h-16 w-28 rounded-[50%]" style={{ background: "conic-gradient(#F59E0B 0 30%, #10B981 0 55%, #8B5CF6 0 80%, #EF4444 0)", transform: "rotateX(55deg)", boxShadow: "0 10px 0 #4B5563" }} />
          </Example>
          <Example tone="dont" caption="Rainbow colors." bg="#FFFFFF" h={130}>
            <div className="flex h-20 items-end gap-2">{["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"].map((c, i) => <div key={c} className="w-6 rounded-t" style={{ background: c, height: 30 + i * 10 }} />)}</div>
          </Example>
          <Example tone="dont" caption="A cut axis that exaggerates a difference." bg="#FFFFFF" h={130}>
            <div className="relative flex h-20 items-end gap-4 border-b border-[#E5E7EB] ps-6">
              <span className="absolute -start-0 bottom-0 text-[9px] text-[#4B5563]">95</span>
              <div className="w-8 rounded-t bg-[#BCD8F0]" style={{ height: 14 }} /><div className="w-8 rounded-t bg-[#3E6796]" style={{ height: 76 }} />
            </div>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 62 · Tables & Numbers ─────────────────────────────────────────────── */

export function TablesNumbers() {
  const rows: Array<[string, string, string, string, string]> = [
    ["1/12", "Lockstitch machine head", "1", "38.0", "45.5"],
    ["2/12", "Machine table and stand", "1", "32.5", "36.0"],
    ["3/12", "Servo motor and accessories", "1", "6.8", "8.2"],
  ];
  return (
    <Chapter
      n={62}
      lead={
        <p>
          Our customers copy numbers from our documents into their own systems. Every table and every
          number is set so it can be read — and copied — without a mistake.
        </p>
      }
      toc={[
        { id: "table", title: "The KOLEEX table" },
        { id: "formats", title: "Number formats" },
        { id: "codes", title: "Codes and references" },
      ]}
    >
      <Section id="table" title="The KOLEEX table">
        <Stage bg="#FFFFFF" h="auto" pad={20}>
          <div className="w-full overflow-hidden rounded-xl border border-[#E5E7EB] text-[#0A0A0A]">
            <div className="grid grid-cols-[64px_minmax(0,1fr)_48px_72px_72px] bg-[#0A0A0A] px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white">
              <span>Carton</span><span>Description</span><span className="text-end">Qty</span><span className="text-end">N.W. kg</span><span className="text-end">G.W. kg</span>
            </div>
            {rows.map((r) => (
              <div key={r[0]} className="grid grid-cols-[64px_minmax(0,1fr)_48px_72px_72px] border-t border-[#E5E7EB] px-3 py-2 text-[11.5px]">
                <span className="font-mono">{r[0]}</span><span>{r[1]}</span><span className="text-end font-mono">{r[2]}</span><span className="text-end font-mono">{r[3]}</span><span className="text-end font-mono">{r[4]}</span>
              </div>
            ))}
            <div className="grid grid-cols-[64px_minmax(0,1fr)_48px_72px_72px] bg-[#0A0A0A] px-3 py-2 text-[11.5px] font-semibold text-white">
              <span /><span>Total (sample)</span><span className="text-end font-mono">3</span><span className="text-end font-mono">77.3</span><span className="text-end font-mono">89.7</span>
            </div>
          </div>
        </Stage>
        <Specs rows={[
          ["Header", "Black bar, white capitals, 9–10 px, letter-spacing +0.1 em"],
          ["Rows", "Hairline Mist rules; no zebra stripes, no vertical lines"],
          ["Numbers", "Monospace, aligned to the end of the column, same decimals down a column"],
          ["Totals", "Black bar at the foot, same columns as above"],
          ["Text columns", "Start-aligned"],
        ]} />
      </Section>

      <Section id="formats" title="Number formats">
        <Table
          head={["What", "Write", "Never"]}
          rows={[
            ["Thousands", <Code key="a">12,500</Code>, <Code key="b">12.500 · 12 500</Code>],
            ["Money", <Code key="a">USD 12,500.00</Code>, <Code key="b">$12,500 · 12500 USD</Code>],
            ["Units", <Code key="a">25 mm · 220 V · 550 W</Code>, <Code key="b">25mm · 220v</Code>],
            ["Ranges", <Code key="a">10–20 mm</Code>, <Code key="b">10 to 20mm · 10-20</Code>],
            ["Percent", <Code key="a">15%</Code>, <Code key="b">15 % · 15 percent</Code>],
            ["Dates", <Code key="a">27/09/2026</Code>, <Code key="b">09/27/2026 · 2026-09-27 · Sept 27</Code>],
            ["Time", <Code key="a">14:30</Code>, <Code key="b">2:30pm</Code>],
            ["Phone", <Code key="a">+86 576 8892 7796</Code>, <Code key="b">0576-88927796 · 00862…</Code>],
          ]}
        />
        <Note>Phone numbers are written in international form: country code, then the number without its leading 0.</Note>
      </Section>

      <Section id="codes" title="Codes and references">
        <Specs rows={[
          ["Documents", <span key="d">One deal number shared by all its documents: <Code>KL-QU-12349</Code> quotation · <Code>KL-IN-12349</Code> invoice · <Code>KL-CN-12349</Code> contract · <Code>KL-PL-12349</Code> packing list</span>],
          ["Model codes", "Written exactly as registered, in capitals, never translated"],
          ["In text", "Codes in monospace when they stand alone; in sentences, the same font as the text"],
        ]} />
        <P>The rules for writing numbers in running text are in <Ref n={26} />.</P>
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)]"><Peak size={10} color="#567FB2" />Numbers in this chapter are samples.</div>
      </Section>
    </Chapter>
  );
}
