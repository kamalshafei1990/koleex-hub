"use client";

/* Chapters 58–62: icons, machine icons, product photos & callouts,
   infographics & charts, tables & numbers.

   Owner decisions (27/09/2026): icons are LINE icons from the Visual Library
   in Koleex Hub; no drawings of machines at all — manuals and spec sheets
   use our photos with numbered parts and close-ups; charts have NO blue —
   gray, with the key value black on white or silver on black.

   The icons shown are the Hub's own components, imported live — so this
   chapter can never show an icon the library does not have. */

import type { ComponentType, CSSProperties } from "react";
import {
  B, Bullets, Chapter, Code, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { MachineShot } from "../mockups";

/* Solid icons — shown only as the "mixed styles" mistake */
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import TruckIcon from "@/components/icons/ui/TruckIcon";
import ShipIcon from "@/components/icons/ui/ShipIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
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
    <div className="flex flex-col items-center gap-2 rounded-xl border border-[#D2D2D7] bg-white px-2 py-3 text-[#1D1D1F]">
      <Icon size={size} />
      <span className="text-center text-[10.5px] leading-tight text-[#6E6E73]">{name}</span>
    </div>
  );
}

/* ── 58 · Icons ────────────────────────────────────────────────────────── */

export function Icons() {
  return (
    <Chapter
      n={58}
      lead={<p>KOLEEX icons are line icons — thin, rounded, calm. Every one comes from our own library in Koleex Hub; nothing is borrowed.</p>}
      toc={[
        { id: "style", title: "The style" },
        { id: "library", title: "The Visual Library" },
        { id: "sizes", title: "Sizes" },
        { id: "areas", title: "The business-area set" },
        { id: "icon-color", title: "Color" },
        { id: "icon-donts", title: "What never to do" },
      ]}
    >
      <Section id="style" title="The style">
        <Stage bg="#FFFFFF" h="auto" pad={40}>
          <div className="grid w-full grid-cols-3 gap-6 text-[#1D1D1F] sm:grid-cols-6">
            {[...LINE, ...MACHINE_ICONS.slice(0, 6).map(([n, I]) => [n, I] as [string, IconC])].map(([n, I]) => (
              <div key={n} className="flex flex-col items-center gap-2"><I size={32} /><span className="text-center text-[11px] text-[#6E6E73]">{n}</span></div>
            ))}
          </div>
        </Stage>
        <Specs rows={[
          ["Drawing", "Line — 1.5–2 px strokes, round caps and round joins"],
          ["Grid", "24 × 24 with 2 px of safe space (live area 20 × 20)"],
          ["Corners", "Softly rounded, like the letters of the logo"],
          ["Color", "One color — the color of the text around it"],
        ]} />
      </Section>

      <Section id="library" title="The Visual Library">
        <Rule why="One library means one answer: the same icon for the same thing, in the Hub, in documents and in marketing.">
          Every icon is taken from the Visual Library in Koleex Hub — Database › Visual Library. Never drawn new
          for one job, never downloaded from an icon website.
        </Rule>
        <P>Need an icon that does not exist? Ask for it: it is drawn in this style and added to the Visual Library, so everyone gets the same one.</P>
      </Section>

      <Section id="sizes" title="Sizes">
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <div className="flex flex-wrap items-end gap-10 text-[#1D1D1F]">
            {[16, 20, 24, 32, 48].map((sz) => (
              <div key={sz} className="flex flex-col items-center gap-2"><RouteIcon size={sz} /><span className="font-mono text-[12px] text-[#6E6E73]">{sz}</span></div>
            ))}
          </div>
        </Stage>
        <Table
          head={["Size", "Use"]}
          rows={[
            ["16 px", "Inside text, table cells"],
            ["20–24 px", "Menus, lists, cards — the standard"],
            ["32 px", "Feature lists, spec sheet highlights"],
            ["48 px and up", "Category tiles, catalog openers, signs"],
          ]}
        />
      </Section>

      <Section id="areas" title="The business-area set">
        <P>Six icons stand for what KOLEEX covers. They appear together — on covers, the company profile and the website — each in a rounded frame.</P>
        <Table
          head={["Area", "Icon"]}
          rows={[
            [<B key="a">Sewing</B>, "The sewing machine"],
            [<B key="a">Garments</B>, "The T-shirt"],
            [<B key="a">Cutting</B>, "The scissors"],
            [<B key="a">Pressing and finishing</B>, "The iron"],
            [<B key="a">Pattern and sampling</B>, "The dress form"],
            [<B key="a">Parts and accessories</B>, "The needle and thread"],
          ]}
        />
        <Specs rows={[
          ["One set", "The same stroke, the same 24 × 24 grid and the same optical size — a detailed icon is simplified to match the others"],
          ["Frame", "A rounded square, corner 28% of its side, a 1 px line in the icon's colour; the icon fills about 60% of it"],
          ["Order", "Always the order above, in one row"],
          ["Colour", "White on black, black on white — one colour"],
        ]} />
        <Note>The six icons on the current cover differ in stroke and size. They are redrawn as one set and added to the Visual Library.</Note>
      </Section>

      <Section id="icon-color" title="Color">
        <Examples cols={3}>
          <Example tone="do" caption="The color of the text around it." bg="#FFFFFF" h={120}>
            <span className="flex items-center gap-2 text-[15px] text-[#1D1D1F]"><RouteIcon size={20} />Route</span>
          </Example>
          <Example tone="do" caption="Inside a link or button, the link color." bg="#FFFFFF" h={120}>
            <span className="flex items-center gap-2 text-[15px] font-medium text-[#3E6796]"><PortIcon size={20} />Track shipment ›</span>
          </Example>
          <Example tone="do" caption="Status colors only on status icons." bg="#FFFFFF" h={120}>
            <span className="flex items-center gap-2 text-[15px] text-[#059669]"><ShieldCheckIcon size={20} />Approved</span>
          </Example>
        </Examples>
      </Section>

      <Section id="icon-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="Solid and line icons mixed." bg="#FFFFFF" h={120}>
            <div className="flex items-center gap-4 text-[#1D1D1F]"><TruckIcon size={26} /><RouteIcon size={26} /><DocumentIcon size={26} /><PortIcon size={26} /></div>
          </Example>
          <Example tone="dont" caption="Emoji or icons from other libraries." bg="#FFFFFF" h={120}>
            <div className="flex items-center gap-4 text-[28px]"><span>🚚</span><span>📦</span><span>✅</span></div>
          </Example>
          <Example tone="dont" caption="Colorful, multi-tone or 3D icons." bg="#FFFFFF" h={120}>
            <div className="flex items-center gap-4">
              <span style={{ color: "#F59E0B", filter: "drop-shadow(2px 3px 0 #92400E)" }}><TruckIcon size={30} /></span>
              <span style={{ color: "#10B981", filter: "drop-shadow(2px 3px 0 #065F46)" }}><ShipIcon size={30} /></span>
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
        <Stage bg="#F5F5F7" h="auto" pad={16}>
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
          <Example tone="do" caption="Catalog category tiles." bg="#F5F5F7" h={200}>
            <div className="grid grid-cols-3 gap-2">
              {MACHINE_ICONS.slice(0, 6).map(([n, I]) => (
                <div key={n} className="flex h-[76px] w-[92px] flex-col justify-between rounded-xl bg-white p-2.5 text-[#1D1D1F] shadow-[0_0_0_1px_#D2D2D7]">
                  <I size={22} /><span className="text-[10px] font-semibold">{n}</span>
                </div>
              ))}
            </div>
          </Example>
          <Example tone="do" caption="Spec sheet header." bg="#FFFFFF" h={200}>
            <div className="w-full max-w-[260px] text-[#1D1D1F]">
              <div className="flex items-center justify-between"><Wordmark color="#000000" width={70} /><span className="text-[9px] font-bold tracking-[0.1em]">SPEC SHEET</span></div>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#D2D2D7] p-3"><OverlockMachineIcon size={28} /><div><p className="text-[9px] uppercase tracking-[0.16em] text-[#6E6E73]">Category</p><p className="text-[13px] font-semibold">Overlock</p></div></div>
            </div>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 60 · Product Photos & Callouts ────────────────────────────────────── */

/** A numbered marker on a photograph. */
function Callout({ n, x, y }: { n: number; x: string; y: string }) {
  return (
    <span className="absolute flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-[11px] font-semibold text-black shadow-[0_0_0_2px_rgba(0,0,0,0.6)]" style={{ left: x, top: y }}>{n}</span>
  );
}

export function PhotoCallouts() {
  return (
    <Chapter
      n={60}
      lead={<p>KOLEEX explains its machines with photographs, not drawings. A studio photo with numbered parts, and a close-up for every step.</p>}
      toc={[
        { id: "no-drawings", title: "Photos, not drawings" },
        { id: "callouts", title: "Numbered parts" },
        { id: "steps", title: "Step by step" },
        { id: "diagrams", title: "Process diagrams" },
        { id: "maps", title: "Maps" },
        { id: "ill-donts", title: "What never to do" },
      ]}
    >
      <Section id="no-drawings" title="Photos, not drawings">
        <Rule why="A customer recognises the machine in front of them, not a drawing of it. Real photos also prove the product is real.">
          Manuals, spec sheets and training material show our own photographs — never line drawings, silver
          drawings or 3D renders.
        </Rule>
      </Section>

      <Section id="callouts" title="Numbered parts">
        <Stage bg="#000000" h="auto" pad={40}>
          <div className="relative w-full max-w-[520px]">
            <MachineShot w="100%" label={false} />
            <Callout n={1} x="18%" y="12%" />
            <Callout n={2} x="45%" y="4%" />
            <Callout n={3} x="78%" y="44%" />
            <Callout n={4} x="23%" y="70%" />
          </div>
        </Stage>
        <Specs rows={[
          ["Markers", "White circles, 22 px, black number — or black on white photos"],
          ["Placement", "On the part itself, never on a leader line across the photo"],
          ["The list", "Numbers match a list beside the photo: 1 Needle bar · 2 Arm · 3 Handwheel · 4 Presser foot"],
          ["Photo", "The studio photo of that exact model (ch. 64)"],
        ]} />
      </Section>

      <Section id="steps" title="Step by step">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {["Thread the needle", "Set the stitch length", "Lower the presser foot", "Start the machine"].map((t, i) => (
            <div key={t} className="overflow-hidden rounded-[20px] bg-[var(--bg-secondary)]">
              <div className="flex aspect-square items-end bg-[#1D1D1F] p-3"><span className="text-[11px] text-[#6E6E73]">Close-up photo</span></div>
              <p className="px-4 py-3 text-[14px] text-[var(--text-primary)]"><span className="font-semibold">{i + 1}.</span> {t}</p>
            </div>
          ))}
        </div>
        <P>One step, one close-up, one short sentence. Photographed in the studio with the same light every time (<Ref n={64} />).</P>
      </Section>

      <Section id="diagrams" title="Process diagrams">
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <div className="flex w-full flex-wrap items-center justify-center gap-2 text-[#1D1D1F]">
            {["Quotation", "Proforma invoice", "Contract", "Production & inspection", "Packing list", "Shipment"].map((st, i, arr) => (
              <div key={st} className="flex items-center gap-2">
                <span className={`rounded-full px-4 py-2 text-[13px] font-medium ${i === 3 ? "bg-[#1D1D1F] text-white" : "bg-[#F5F5F7]"}`}>{st}</span>
                {i < arr.length - 1 && <span className="text-[#AEAEB2]">›</span>}
              </div>
            ))}
          </div>
        </Stage>
        <Bullets items={[
          "Steps as pills on Cloud; the step the diagram is about in Graphite with white text.",
          "No colors, no icons in every box — the words carry it.",
          "Left to right in English and Chinese; right to left in Arabic.",
        ]} />
      </Section>

      <Section id="maps" title="Maps">
        <Bullets items={[
          "Flat maps only — land in Cloud on white, Graphite on black; markers in black or white.",
          <><B>Borders must be correct for the country where the map is published.</B> In mainland China, only an officially approved base map.</>,
          "Show only real, current locations — offices, warehouses, agents under contract.",
        ]} />
      </Section>

      <Section id="ill-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="Line drawings of the machine." bg="#FFFFFF" h={140}>
            <svg viewBox="0 0 200 100" style={{ width: 160 }} aria-hidden><g fill="none" stroke="#1D1D1F" strokeWidth="1.6"><rect x="10" y="80" width="180" height="12" rx="3" /><rect x="130" y="28" width="40" height="54" rx="7" /><rect x="42" y="22" width="130" height="24" rx="12" /><rect x="28" y="22" width="36" height="50" rx="8" /></g></svg>
          </Example>
          <Example tone="dont" caption="3D renders." bg="#FFFFFF" h={140}>
            <div className="h-20 w-28 rounded-lg" style={{ background: "linear-gradient(145deg,#F5F5F7,#98989D 60%,#6E6E73)", boxShadow: "10px 12px 18px rgba(0,0,0,0.35), inset -6px -6px 12px rgba(0,0,0,0.3)" }} />
          </Example>
          <Example tone="dont" caption="AI-generated images of our products." bg="#FFFFFF" h={140}>
            <span className="rounded-full border border-dashed border-[#AEAEB2] px-4 py-2 text-[11px] text-[#6E6E73]">AI product image</span>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 61 · Infographics & Charts ─────────────────────────────────────────── */

const SAMPLE_BARS: Array<[string, number]> = [["Q1", 42], ["Q2", 58], ["Q3", 51], ["Q4", 74]];

function Bars({ dark }: { dark: boolean }) {
  const max = 80;
  const base = dark ? "#3A3A3C" : "#D2D2D7";
  const ink = dark ? "#F5F5F7" : "#1D1D1F";
  return (
    <svg viewBox="0 0 200 150" className="h-auto w-full" role="img" aria-label="Sample bar chart">
      <defs><linearGradient id={dark ? "kx-bar-silver" : "kx-bar-x"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C7C7CC" /><stop offset=".35" stopColor="#FFFFFF" /><stop offset=".6" stopColor="#D1D1D6" /><stop offset="1" stopColor="#8E8E93" /></linearGradient></defs>
      <text x="0" y="12" fontSize="10" fontWeight="600" fill={ink} fontFamily="Inter, sans-serif">Shipments per quarter</text>
      {SAMPLE_BARS.map(([q, v], i) => {
        const h = (v / max) * 100;
        const key = i === 3;
        return (
          <g key={q}>
            <rect x={12 + i * 48} y={130 - h} width="30" height={h} rx="6" fill={key ? (dark ? "url(#kx-bar-silver)" : "#1D1D1F") : base} />
            <text x={27 + i * 48} y={126 - h} textAnchor="middle" fontSize="9" fill={ink} fontFamily="ui-monospace, monospace">{v}</text>
            <text x={27 + i * 48} y="143" textAnchor="middle" fontSize="9" fill={dark ? "#98989D" : "#6E6E73"} fontFamily="Inter, sans-serif">{q}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Infographics() {
  return (
    <Chapter
      n={61}
      lead={<p>A KOLEEX chart says one thing. Everything is gray — except the number that matters. Sample data, for style only.</p>}
      toc={[
        { id: "palette", title: "Chart colors" },
        { id: "types", title: "Choosing a chart" },
        { id: "big-number", title: "One big number" },
        { id: "style", title: "Chart style" },
        { id: "chart-donts", title: "What never to do" },
      ]}
    >
      <Section id="palette" title="Chart colors">
        <Examples cols={2}>
          <Example tone="do" caption="On white — reports and documents: gray, the key value black." bg="#FFFFFF" h={220}><div className="w-[240px]"><Bars dark={false} /></div></Example>
          <Example tone="do" caption="On black — marketing and presentations: gray, the key value silver." bg="#000000" h={220}><div className="w-[240px]"><Bars dark /></div></Example>
        </Examples>
        <Rule why="If every series has a color, none of them stands out.">
          No Hub Blue and no series colors in charts. Gray for everything, one highlight for the point being made.
        </Rule>
      </Section>

      <Section id="types" title="Choosing a chart">
        <Table
          head={["To show", "Use"]}
          rows={[
            ["Amounts side by side", "Bars — start at zero"],
            ["Change over time", "A line, the last point marked"],
            ["Share of a whole", "A donut, three parts at most — or just the number"],
            ["Exact values people will copy", "A table (ch. 62)"],
          ]}
        />
      </Section>

      <Section id="big-number" title="One big number">
        <Stage bg="#000000" h="auto" pad={48}>
          <div className="text-center">
            <p className="text-[72px] font-semibold leading-none tracking-[-0.04em]" style={{ backgroundImage: "linear-gradient(170deg, #C7C7CC 0%, #FFFFFF 35%, #D1D1D6 60%, #8E8E93 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>+42%</p>
            <p className="mt-3 text-[15px] text-[#98989D]">more pieces per operator per hour</p>
          </div>
        </Stage>
        <P>When one number is the message, show only that number. A source line sits under it (<Ref n={132} />).</P>
      </Section>

      <Section id="style" title="Chart style">
        <Specs rows={[
          ["Title", "Says what the chart shows, in plain words"],
          ["Axes", "Bars start at zero; hairline gridlines or none"],
          ["Labels", "Inter 11–12 px Gray; values in monospace; label directly, no legend"],
          ["Source", "Where the data comes from and its date (DD/MM/YYYY)"],
        ]} />
      </Section>

      <Section id="chart-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="3D or exploded pies." bg="#FFFFFF" h={140}>
            <div className="h-16 w-28 rounded-[50%]" style={{ background: "conic-gradient(#F59E0B 0 30%, #10B981 0 55%, #8B5CF6 0 80%, #EF4444 0)", transform: "rotateX(55deg)", boxShadow: "0 10px 0 #6E6E73" }} />
          </Example>
          <Example tone="dont" caption="Rainbow — or blue — series colors." bg="#FFFFFF" h={140}>
            <div className="flex h-20 items-end gap-2">{["#EF4444", "#F59E0B", "#10B981", "#567FB2", "#8B5CF6"].map((c, i) => <div key={c} className="w-6 rounded-t" style={{ background: c, height: 30 + i * 10 }} />)}</div>
          </Example>
          <Example tone="dont" caption="A cut axis that exaggerates a difference." bg="#FFFFFF" h={140}>
            <div className="relative flex h-20 items-end gap-4 border-b border-[#D2D2D7] ps-6">
              <span className="absolute -start-0 bottom-0 text-[9px] text-[#6E6E73]">95</span>
              <div className="w-8 rounded-t bg-[#D2D2D7]" style={{ height: 14 }} /><div className="w-8 rounded-t bg-[#1D1D1F]" style={{ height: 76 }} />
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
          <div className="w-full overflow-hidden rounded-xl border border-[#D2D2D7] text-[#1D1D1F]">
            <div className="grid grid-cols-[64px_minmax(0,1fr)_48px_72px_72px] bg-[#000000] px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white">
              <span>Carton</span><span>Description</span><span className="text-end">Qty</span><span className="text-end">N.W. kg</span><span className="text-end">G.W. kg</span>
            </div>
            {rows.map((r) => (
              <div key={r[0]} className="grid grid-cols-[64px_minmax(0,1fr)_48px_72px_72px] border-t border-[#D2D2D7] px-3 py-2 text-[11.5px]">
                <span className="font-mono">{r[0]}</span><span>{r[1]}</span><span className="text-end font-mono">{r[2]}</span><span className="text-end font-mono">{r[3]}</span><span className="text-end font-mono">{r[4]}</span>
              </div>
            ))}
            <div className="grid grid-cols-[64px_minmax(0,1fr)_48px_72px_72px] bg-[#000000] px-3 py-2 text-[11.5px] font-semibold text-white">
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
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)]">Numbers in this chapter are samples.</div>
      </Section>
    </Chapter>
  );
}
