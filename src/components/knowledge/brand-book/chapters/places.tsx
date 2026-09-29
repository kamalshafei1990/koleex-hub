"use client";

/* Chapters 114–121: exhibition booth, exhibition kit, the CISMA playbook,
   office signage, showroom, warehouse & factory signage, vehicles, events
   & training days.

   Places are Core, always: black, white and silver. Aurora appears only
   on a screen that shows Koleex Hub itself (ch. 77). */

import type { ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import FlatBedMachineIcon from "@/components/icons/machine-kinds/FlatBedMachineIcon";
import OverlockMachineIcon from "@/components/icons/machine-kinds/OverlockMachineIcon";
import CoverstitchIcon from "@/components/icons/machine-kinds/CoverstitchIcon";
import AutomaticMachineIcon from "@/components/icons/machine-kinds/AutomaticMachineIcon";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { HubMark, Wordmark, GroupLockup } from "../marks";
import { INK, MachineShot, QrBox, Scaled, Slide } from "../mockups";
import { SILVER } from "@/lib/brand-book/tokens";

/* ── Drawings ──────────────────────────────────────────────────────────── */

/** A black plinth with the white KOLEEX machine on it, front view. */
function Plinth({ left, w = 70 }: { left: number; w?: number }) {
  return (
    <div className="absolute bottom-[14px] flex flex-col items-center" style={{ left, width: w }}>
      <MachineShot w={w + 6} label={false} />
      <div className="mt-[2px] h-[42px] w-full rounded-[2px] bg-[#1D1D1F]" style={{ boxShadow: "inset 0 0 0 1px #3A3A3C" }} />
    </div>
  );
}

/** A 3 × 3 m shell-scheme booth, front elevation, designed at 360 × 240. */
function Booth({ wrong = false }: { wrong?: boolean }) {
  return (
    <div className="relative overflow-hidden" style={{ width: 360, height: 240, background: wrong ? "#D2D2D7" : "#1D1D1F" }}>
      {/* fascia */}
      <div className="absolute inset-x-0 top-0 flex h-[30px] items-center justify-center" style={{ background: wrong ? "#FFFFFF" : INK }}>
        {wrong
          ? <span className="text-[13px] font-bold italic" style={{ color: "#1D4ED8", fontFamily: "Georgia, serif" }}>Koleex Sewing Co.</span>
          : <Wordmark color="#FFFFFF" width={96} />}
      </div>
      {/* back wall */}
      <div className="absolute inset-x-[10px] top-[30px] bottom-[14px]" style={{ background: wrong ? "linear-gradient(135deg,#F97316,#8B5CF6)" : INK }}>
        {!wrong && (
          <div className="absolute left-[22px] top-[26px]">
            <p className="text-[7px] font-semibold uppercase tracking-[0.2em] text-[#98989D]">Industrial Garment Machinery</p>
            <p className="mt-1 text-[18px] font-semibold leading-[1.05] tracking-[-0.02em]" style={{ backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Precise machines.<br />Honest advice.</p>
          </div>
        )}
        {wrong && <p className="absolute left-[16px] top-[18px] text-[9px] font-bold text-white">BEST PRICES!!! ALL MACHINES · SPARE PARTS · SERVICE · CALL NOW</p>}
        {/* screen */}
        <div className="absolute right-[20px] top-[22px] flex h-[62px] w-[100px] items-center justify-center rounded-[3px] bg-[#1D1D1F]" style={{ boxShadow: "inset 0 0 0 2px #38383A" }}>
          <HubMark variant="for-dark" style={{ width: 64 }} />
        </div>
      </div>
      {/* side walls */}
      <div className="absolute bottom-[14px] left-0 top-[30px] w-[10px]" style={{ background: wrong ? "#D1D1D6" : "#000000" }} />
      <div className="absolute bottom-[14px] right-0 top-[30px] w-[10px]" style={{ background: wrong ? "#D1D1D6" : "#000000" }} />
      {/* floor */}
      <div className="absolute inset-x-0 bottom-0 h-[14px]" style={{ background: wrong ? "#98989D" : "#000000" }} />
      <Plinth left={30} />
      <Plinth left={116} />
      {/* counter */}
      <div className="absolute bottom-[14px] right-[26px] flex h-[62px] w-[110px] items-center justify-center rounded-[2px]" style={{ background: wrong ? "#FFFFFF" : "#000000", boxShadow: wrong ? "inset 0 0 0 1px #D1D1D6" : "inset 0 0 0 1px #3A3A3C" }}>
        {wrong ? <span className="text-[7px] font-bold text-[#DC2626]">brochures · prices · flyers</span> : <Wordmark color="#FFFFFF" width={64} />}
      </div>
    </div>
  );
}

/** A roll-up banner, 850 × 2000 mm. */
function RollUp({ w = 96 }: { w?: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative overflow-hidden rounded-[2px]" style={{ width: w, aspectRatio: "850 / 2000", background: INK, boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}>
        <div className="absolute inset-x-0 top-[8%] flex justify-center"><Wordmark color="#FFFFFF" width="60%" /></div>
        <div className="absolute inset-x-[10%] top-[26%]">
          <p className="text-[5px] font-semibold uppercase tracking-[0.2em] text-[#98989D]">Overlock</p>
          <p className="mt-[2px] text-[9px] font-bold leading-[1.1] text-white">Clean edges.<br />Every time.</p>
        </div>
        <div className="absolute inset-x-[10%] top-[46%] bottom-[22%] rounded-[2px] bg-[#1D1D1F]" />
        <p className="absolute inset-x-0 bottom-[10%] text-center text-[5px] text-[#98989D]">{KOLEEX_COMPANY.web}</p>
        
        <div className="absolute inset-x-0 bottom-0 h-[5%] bg-[#38383A]" />
      </div>
    </div>
  );
}

/** A room or zone sign. */
function Sign({ w, h, dark = false, children }: { w: number; h: number; dark?: boolean; children: ReactNode }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-[3px]" style={{ width: w, height: h, background: dark ? INK : "#FFFFFF", color: dark ? "#FFFFFF" : INK, boxShadow: dark ? "0 0 0 1px rgba(255,255,255,0.12)" : "0 0 0 1px rgba(0,0,0,0.12)" }}>
      {children}
    </div>
  );
}

/* ── 114 · Exhibition Booth ────────────────────────────────────────────── */

export function ExhibitionBooth() {
  return (
    <Chapter
      n={114}
      lead={
        <p>
          At a fair, a visitor walks past hundreds of booths in an hour. Ours has three seconds to say who we
          are and what we make. It does it the KOLEEX way: black and white, one message, real machines,
          nothing shouting.
        </p>
      }
      toc={[
        { id: "booth", title: "The booth" },
        { id: "zones", title: "Zones" },
        { id: "sizes", title: "Booth sizes" },
        { id: "booth-never", title: "What never to do" },
      ]}
    >
      <Section id="booth" title="The booth">
        <Rule why="A calm booth in a loud hall is the one people notice — and it looks like the machines: precise.">
          All black: one logo, one message, the white machines on black plinths, lit from above. Everything else is space.
        </Rule>
        <Stage bg="#F5F5F7" h="auto" pad={20}>
          <Scaled w={300} base={360} h={240}><Booth /></Scaled>
        </Stage>
        <Specs rows={[
          ["Fascia", "Our logo panel replaces the organizer’s lettering wherever the rules allow; logo height at most 60% of the fascia (ch. 38)"],
          ["Back wall", "Black, one headline in silver or white, the machine lit from above"],
          ["Walls", "All black — back wall, side walls and counter"],
          ["Machines", "Real machines, running, on black plinths 750–800 mm high, 1–2 per 9 m²"],
          ["Screen", "Koleex Hub or product video — this is where Aurora may appear (ch. 77)"],
          ["Light", "Neutral white 4000 K on the machines; no colored lighting"],
          ["Floor", "Black carpet; no printed floors"],
          ["Second version", "All white — white walls and plinths, black halo-lit letters — where the hall or a partner’s space is white (ch. 47)"],
        ]} />
      </Section>

      <Section id="zones" title="Zones">
        <Table
          head={["Zone", "What happens there", "What is there"]}
          rows={[
            [<B key="a">Front edge</B>, "Stop the visitor", "The running machine, at the aisle"],
            [<B key="a">Demo</B>, "Show the machine at work", "Plinths, fabric, a technician"],
            [<B key="a">Talk</B>, "Understand the need", "Counter or small table, tablet with Koleex Hub"],
            [<B key="a">Store</B>, "Keep the booth clean", "Lockable cupboard for bags, brochures, water"],
          ]}
        />
      </Section>

      <Section id="sizes" title="Booth sizes">
        <Table
          head={["Size", "Machines", "Graphics"]}
          rows={[
            ["9 m² (3 × 3 m) shell scheme", "2", "Fascia, back wall, counter front"],
            ["18 m² (6 × 3 m)", "3–4", "Fascia, back wall, one side wall, counter front, roll-up"],
            ["36 m² and up, space only", "One per category", "Built walls, hanging logo sign, meeting corner, storage"],
          ]}
        />
      </Section>

      <Section id="booth-never" title="What never to do">
        <Examples cols={2}>
          <Example tone="do" caption="Black wall, one message, machines to touch." bg="#F5F5F7" h={220}>
            <Scaled w={250} base={360} h={240}><Booth /></Scaled>
          </Example>
          <Example tone="dont" caption="Organizer lettering, gradients, prices and every message at once." bg="#F5F5F7" h={220}>
            <Scaled w={250} base={360} h={240}><Booth wrong /></Scaled>
          </Example>
        </Examples>
        <Bullets items={[
          "Prices, discounts or “best price” on any wall (owner rule: no prices on print).",
          "Photos we do not own, or machine photos from a supplier’s catalog.",
          "Supplier names, factory logos or their brochures on the booth.",
          "Balloons, colored lights, flags of many colors.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 115 · Exhibition Kit ──────────────────────────────────────────────── */

/** A photo backdrop (3 × 2.4 m), drawn at 240 × 190. */
function Backdrop({ kind }: { kind: "solo" | "partner" | "press" }) {
  const rows = [0, 1, 2, 3, 4];
  const cols = [0, 1, 2];
  return (
    <div className="relative shrink-0 overflow-hidden rounded-[4px] bg-black" style={{ width: 240, height: 190 }}>
      {kind !== "press" && rows.map((r) => cols.map((c) => {
        const partner = kind === "partner" && (r + c) % 2 === 1;
        const left = 10 + c * 80 + (r % 2 ? 40 : 0);
        const top = 10 + r * 38;
        return partner
          ? <span key={`${r}-${c}`} className="absolute flex items-center justify-center rounded-[2px] border border-dashed border-[#8E8E93] text-[5px] font-semibold tracking-[0.1em] text-[#8E8E93]" style={{ left, top, width: 44, height: 10 }}>PARTNER</span>
          : <span key={`${r}-${c}`} className="absolute" style={{ left, top }}><Wordmark color="#FFFFFF" width={44} /></span>;
      }))}
      {kind === "partner" && (
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 bg-black px-8 py-6">
          <Wordmark color="#FFFFFF" width={60} /><span className="h-[14px] w-px bg-white" /><span className="flex h-[12px] w-[44px] items-center justify-center rounded-[2px] border border-dashed border-[#8E8E93] text-[5px] font-semibold text-[#8E8E93]">PARTNER</span>
        </div>
      )}
      {kind === "press" && (
        <>
          <svg viewBox="0 0 240 190" className="absolute inset-0 h-full w-full" aria-hidden>
            <path d="M-10 150 C 60 150, 80 70, 140 68 S 220 110, 250 40" fill="none" stroke="#FFFFFF" strokeOpacity="0.14" strokeWidth="8" />
            <path d="M-10 150 C 60 150, 80 70, 140 68 S 220 110, 250 40" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
          </svg>
          <div className="absolute left-1/2 top-[18%] -translate-x-1/2"><GroupLockup color="#FFFFFF" width={120} /></div>
        </>
      )}
    </div>
  );
}

/** The stage: with a screen (the default) or a printed wall. */
function StageSet({ screen }: { screen: boolean }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-[4px] bg-[#1C1C1E]" style={{ width: 280, height: 160 }}>
      {screen ? (
        <>
          <div className="absolute flex items-center justify-center bg-black" style={{ left: 16, top: 12, width: 44, height: 104 }}><Wordmark color="#FFFFFF" width={36} /></div>
          <div className="absolute flex items-center justify-center bg-black" style={{ right: 16, top: 12, width: 44, height: 104 }}><Wordmark color="#FFFFFF" width={36} /></div>
          <div className="absolute bg-[#0A0A0A] ring-1 ring-[#3A3A3C]" style={{ left: 72, top: 12, width: 136, height: 82 }}>
            <div className="flex items-center gap-1 px-2 pt-2"><Wordmark color="#FFFFFF" width={30} /><span className="h-[7px] w-px bg-white" /><span className="text-[5px] text-white">Event name</span></div>
            <p className="px-2 pt-4 text-[10px] font-bold text-white">Slide</p>
          </div>
        </>
      ) : (
        <div className="absolute bg-black" style={{ left: 16, top: 12, width: 248, height: 104 }}>
          <svg viewBox="0 0 248 104" className="absolute inset-0 h-full w-full" aria-hidden><path d="M0 92 C 70 92, 100 64, 150 66 S 220 84, 248 58" fill="none" stroke="#FFFFFF" strokeWidth="1.2" /></svg>
          <div className="absolute left-1/2 top-[16%] -translate-x-1/2"><GroupLockup color="#FFFFFF" width={96} /></div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-[#2C2C2E]" style={{ height: 44 }} />
      <div className="absolute flex items-start justify-center bg-black pt-3 ring-1 ring-[#3A3A3C]" style={{ left: 164, top: 96, width: 32, height: 46 }}><Wordmark color="#FFFFFF" width={24} /></div>
    </div>
  );
}

export function ExhibitionKit() {
  return (
    <Chapter
      n={115}
      lead={
        <p>
          The exhibition kit is everything a team packs for a fair, a visit or a local event. It is the same
          kit every time, so nothing is forgotten and nothing is made in a hurry at the venue.
        </p>
      }
      toc={[
        { id: "rollup", title: "Roll-up and table cover" },
        { id: "entrance-banner", title: "The hanging banner" },
        { id: "backdrop", title: "The photo backdrop" },
        { id: "kit-list", title: "The kit list" },
        { id: "badges", title: "Badges and lanyards" },
      ]}
    >
      <Section id="rollup" title="Roll-up and table cover">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-end justify-center gap-8">
            <RollUp w={96} />
            <div className="flex flex-col items-center">
              <div className="relative w-[200px] overflow-hidden rounded-t-[2px]" style={{ height: 70, background: INK }}>
                <div className="absolute inset-0 flex items-center justify-center"><Wordmark color="#FFFFFF" width={80} /></div>
              </div>
              <div className="flex w-[200px] justify-between"><span className="h-3 w-1 bg-[#98989D]" /><span className="h-3 w-1 bg-[#98989D]" /></div>
            </div>
          </div>
        </Stage>
        <Specs rows={[
          ["Roll-up", "850 × 2000 mm, dark-led; logo 500 mm wide at the top; the lower 200 mm stays empty (hidden by tables and legs)"],
          ["Table cover", "Black fitted cover to the floor, white logo centered on the front, 400–500 mm wide"],
          ["Material", "Matte, non-reflective fabric or film — photographs well under hall lights"],
        ]} />
      </Section>

      <Section id="entrance-banner" title="The hanging banner">
        <Rule why="A banner over the hall entrance is read from the floor, eight metres below, by people walking past. Its only job is to send them to the booth.">
          A hanging banner carries four things: the logo, the booth number — large — one line, and the way to
          the hall. No QR codes, no paragraphs.
        </Rule>
        <Examples cols={2}>
          <Example tone="do" caption="Logo, booth number, one line, the direction." bg="#D1D1D6" h={230}>
            <div className="relative overflow-hidden rounded-[2px] bg-black text-white" style={{ width: 130, height: 190 }}>
              <div className="absolute inset-y-0 left-0 w-[2px] bg-white" />
              <div className="absolute left-[12px] top-[12px]"><Wordmark color="#FFFFFF" width={74} /></div>
              <p className="absolute left-[12px] top-[62px] text-[7px] text-[#98989D]">Booth</p>
              <p className="absolute left-[12px] top-[72px] text-[24px] font-bold leading-none">W5-C42</p>
              <p className="absolute left-[12px] top-[104px] text-[10px] font-bold leading-tight">Built for Change</p>
              <p className="absolute bottom-[14px] left-[12px] text-[10px]">Hall W5 →</p>
            </div>
          </Example>
          <Example tone="dont" caption="QR codes, a paragraph and a small booth number." bg="#D1D1D6" h={230}>
            <div className="relative overflow-hidden rounded-[2px] bg-[#2C2F36] text-white" style={{ width: 130, height: 190 }}>
              <div className="absolute left-[10px] top-[10px]"><Wordmark color="#FFFFFF" width={60} /></div>
              <p className="absolute left-[10px] top-[30px] rounded-[2px] border border-white px-1 text-[6px]">W5-C42</p>
              <div className="absolute left-[10px] right-[10px] top-[96px] space-y-[3px]">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[2px] rounded bg-[#8E8E93]" />)}</div>
              <div className="absolute bottom-[10px] right-[10px] flex gap-1">{[0, 1].map((i) => <span key={i} className="h-5 w-5 bg-white" />)}</div>
            </div>
          </Example>
        </Examples>
        <Specs rows={[
          ["Content", "Logo · booth number (the largest text) · one line · hall and direction"],
          ["Letter size", "About 25 mm for every 3 m of reading distance (ch. 39)"],
          ["Material", "Blockout fabric — daylight behind it turns a thin black fabric grey"],
          ["Black", "Rich black C60 M40 Y40 K100 (ch. 48)"],
          ["Never", "QR codes or small text above head height"],
        ]} />
      </Section>

      <Section id="backdrop" title="The photo backdrop">
        <P>The wall people stand in front of for photos. Three versions, chosen by the occasion.</P>
        <Examples cols={3}>
          <Example tone="do" caption="Our own events: KOLEEX alone, a staggered grid." bg="#F5F5F7" h={200}><Scaled w={170} base={240} h={190}><Backdrop kind="solo" /></Scaled></Example>
          <Example tone="do" caption="With a partner: alternating logos, the co-brand lockup in the middle." bg="#F5F5F7" h={200}><Scaled w={170} base={240} h={190}><Backdrop kind="partner" /></Scaled></Example>
          <Example tone="do" caption="Press and speakers: one big lockup and the light line." bg="#F5F5F7" h={200}><Scaled w={170} base={240} h={190}><Backdrop kind="press" /></Scaled></Example>
        </Examples>
        <Specs rows={[
          ["Size", "3 × 2.4 m, matte fabric — no shine under flash"],
          ["Grid", "Logos about 300 mm wide, staggered, so every head-and-shoulders photo holds one whole logo"],
          ["Partner", "Equal weight, its own colours on a white tile if needed (ch. 44)"],
          ["Press wall", "The group lockup at head height and above, never behind a face"],
        ]} />
      </Section>

      <Section id="kit-list" title="The kit list">
        <Table
          head={["Item", "Small event", "Fair booth"]}
          rows={[
            ["Roll-up banners", "1", "2"],
            ["Black table cover", "1", "1–2"],
            ["Catalogs and spec sheets (ch. 103, 105)", "30", "200+"],
            ["Business cards per person (ch. 91)", "100", "300"],
            ["QR stand to the website and WhatsApp", "1", "2"],
            ["Tablet with Koleex Hub for leads and quotations", "1", "2"],
            ["Uniforms per person (ch. 122)", "1", "2 per day"],
            ["Demo fabric, thread, spare needles", "✓", "✓"],
            ["Power strip, adapter, cable ties, tape, cleaning cloth", "✓", "✓"],
          ]}
        />
        <Note>Leads are entered in Koleex Hub during the event — not on paper — so every visitor gets a reply from the same system (<Ref n={116} />).</Note>
      </Section>

      <Section id="badges" title="Badges and lanyards">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-col items-center">
            <div className="h-10 w-[14px] rounded-t-sm bg-[#000000]" />
            <div className="w-[120px] overflow-hidden rounded-[4px] bg-white text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "86 / 120" }}>
              <div className="flex h-[26%] items-center justify-center bg-[#000000]"><Wordmark color="#FFFFFF" width={56} /></div>
              <div className="px-2 pt-3 text-center">
                <p className="text-[11px] font-bold">Full Name</p>
                <p className="text-[7px] text-[#6E6E73]">Sales Engineer</p>
                <p className="mt-2 text-[6.5px] tracking-[0.12em] text-[#6E6E73]">EN · <span lang="ar">العربية</span> · <span lang="zh-Hans">中文</span></p>
              </div>
            </div>
          </div>
        </Stage>
        <Bullets items={[
          "Black lanyard with the white logo repeated — worn instead of the fair’s own lanyard (ch. 122); badge 86 × 120 mm.",
          "Name large enough to read from 2 m; the languages the person speaks under the title.",
          "No personal phone numbers on badges.",
          "Made in Brand Center → Templates → Event badge: this design and nine more, a status band in the lanyards’ colours (black staff, grey visitors, white VIP), and a back that repeats the front — a badge turns on its lanyard.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 116 · CISMA Playbook ──────────────────────────────────────────────── */

const CISMA_STEPS: Array<[string, string, string[]]> = [
  ["12 weeks before", "Plan", ["Book the space; choose the machines to show", "Set the one message of the booth", "Assign the team and the languages each covers"]],
  ["8 weeks before", "Design", ["Booth graphics from the templates (ch. 114)", "Approval by the Marketing Manager and the Founder & CEO (ch. 134)", "Announce the booth number on every channel"]],
  ["4 weeks before", "Produce", ["Print with physical proofs (ch. 48)", "Catalogs, spec sheets, cards, uniforms", "Test the tablets, Koleex Hub and the demo machines"]],
  ["The fair", "Run", ["Daily: booth clean before opening, photos by 11:00, one post per day", "Every conversation entered as a lead in Koleex Hub", "Evening: 15-minute team review"]],
  ["48 hours after", "Follow up", ["A personal reply to every lead", "Quotations from Koleex Hub", "Thank-you post with our own photos"]],
];

export function CismaPlaybook() {
  return (
    <Chapter
      n={116}
      lead={
        <p>
          CISMA in Shanghai is the most important fair of our industry — the place where customers, agents
          and competitors all meet. This playbook turns it into a routine: the same plan, the same timing,
          the same standard, every time we exhibit.
        </p>
      }
      toc={[
        { id: "timeline", title: "The timeline" },
        { id: "on-site", title: "On site" },
        { id: "posts", title: "Before, during and after on social" },
        { id: "other-fairs", title: "Other fairs" },
      ]}
    >
      <Section id="timeline" title="The timeline">
        <div className="space-y-3">
          {CISMA_STEPS.map(([when, what, items], i) => (
            <div key={when} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: i === 3 ? "#F5F5F7" : "#1D1D1F", color: i === 3 ? "#000000" : "#FFFFFF", boxShadow: "0 0 0 1px rgba(255,255,255,0.14)" }}>{i + 1}</span>
                {i < CISMA_STEPS.length - 1 && <span className="mt-1 w-px flex-1 bg-[var(--border-subtle)]" />}
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">{when}</p>
                <p className="mt-0.5 text-[15px] font-semibold text-[var(--text-primary)]">{what}</p>
                <ul className="mt-1.5 space-y-1">
                  {items.map((it) => <li key={it} className="text-[13.5px] leading-6 text-[var(--text-secondary)]">{it}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <Note>CISMA’s dates and hall plan change from edition to edition. Take them from the organizer’s official site each year — never from last year’s material.</Note>
      </Section>

      <Section id="on-site" title="On site">
        <Rule why="A visitor remembers how they were treated before they remember a machine.">
          Every visitor is greeted within ten seconds, in their language when we can, and leaves with a card and
          a way to reach us on WhatsApp.
        </Rule>
        <Bullets items={[
          "Uniforms every day (ch. 122); badges visible; no eating or phones on the booth.",
          "Machines running and clean; fabric samples ready; nothing stacked on the counter.",
          <>Photos to the standard of <Ref n={68} /> — people photographed only with their consent.</>,
          "Competitors are welcome on the booth; we are polite and give them no prices and no customer names.",
        ]} />
      </Section>

      <Section id="posts" title="Before, during and after on social">
        <Table
          head={["When", "Post", "Channels"]}
          rows={[
            ["4 weeks before", "“Meet us at CISMA” — hall and booth number", "All channels; WeChat Moments by staff"],
            ["1 week before", "The machines we will show", "Instagram, Facebook, LinkedIn, WeChat"],
            ["Each fair day", "One photo of the day, one short video", "Instagram stories, Douyin, WeChat"],
            ["After", "Thank you, with our own photos", "All channels"],
          ]}
        />
        <P>Post templates and captions: <Ref n={80} />.</P>
      </Section>

      <Section id="other-fairs" title="Other fairs">
        <P>
          Every other fair, exhibition and open day uses this same playbook, scaled to its size: the timeline
          shortens, the steps stay.
        </P>
      </Section>
    </Chapter>
  );
}

/* ── 117 · Office Signage ──────────────────────────────────────────────── */

export function OfficeSignage() {
  return (
    <Chapter
      n={117}
      lead={
        <p>
          Our offices are where customers and agents meet us in person. The signage is quiet and exact —
          the logo at the entrance, the legal name where the law asks for it, clear signs for every room.
        </p>
      }
      toc={[
        { id: "entrance", title: "Entrance and reception" },
        { id: "rooms", title: "Room signs" },
        { id: "glass", title: "Glass" },
        { id: "flags", title: "Flags" },
        { id: "office-specs", title: "Specifications" },
      ]}
    >
      <Section id="entrance" title="Entrance and reception">
        <Examples cols={2}>
          <Example tone="do" caption="Entrance plate, Taizhou: logo, legal names in English and Chinese." bg="#D1D1D6" h={200}>
            <Sign w={220} h={130} dark>
              <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
                <Wordmark color="#FFFFFF" width={110} />
                <p className="text-[5.5px] font-semibold tracking-[0.04em] text-[#D1D1D6]">{KOLEEX_COMPANY.en}</p>
                <p lang="zh-Hans" className="text-[7px] text-[#D1D1D6]">{KOLEEX_COMPANY.zh}</p>
              </div>
            </Sign>
          </Example>
          <Example tone="do" caption="Reception wall: black, the logo alone, halo-lit white." bg="#FFFFFF" h={200}>
            <div className="flex h-[130px] w-[240px] items-center justify-center rounded-[2px]" style={{ background: "#000000" }}>
              <div style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.55))" }}><Wordmark color="#FFFFFF" width={140} /></div>
            </div>
          </Example>
        </Examples>
        <Note>
          Local signage rules come first. In mainland China the registered Chinese name appears on the entrance
          sign; in Egypt, add the Arabic name <span lang="ar">كولكس</span> where Arabic is required. The logo itself is never translated (<Ref n={36} />).
        </Note>
      </Section>

      <Section id="rooms" title="Room signs">
        <Stage bg="#D2D2D7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Sign w={150} h={60}>
              <div className="flex h-full flex-col justify-center px-3">
                <p className="text-[11px] font-bold">Meeting Room 1</p>
                <p lang="zh-Hans" className="text-[8px] text-[#6E6E73]">会议室 1</p>
              </div>
              
            </Sign>
            <Sign w={150} h={60}>
              <div className="flex h-full flex-col justify-center px-3">
                <p className="text-[11px] font-bold">Meeting Room 1</p>
                <p dir="rtl" lang="ar" className="text-[9px] text-[#6E6E73]">غرفة الاجتماعات ١</p>
              </div>
              
            </Sign>
          </div>
        </Stage>
        <Bullets items={[
          "English first, then the local language: Chinese in China, Arabic in Egypt.",
          "White plate, black Inter SemiBold — no color.",
          "Pictograms from the icon set (ch. 58) — never clip art.",
        ]} />
      </Section>

      <Section id="glass" title="Glass">
        <P>
          Glass doors and walls carry a frosted band at eye height (about 1400–1600 mm) so no one walks into
          them. The band is the KOLEEX dots — the dotted world map (<Ref n={57} />) — and may carry the logo
          once, frosted. Never a colored print.
        </P>
      </Section>

      <Section id="flags" title="Flags">
        <Examples cols={2}>
          <Example tone="do" caption="A vertical flag: the logo reads level while it hangs." bg="#F5F5F7" h={200}>
            <div className="relative" style={{ width: 90, height: 170 }}>
              <div className="absolute left-[10px] top-0 h-full w-[3px] bg-[#8E8E93]" />
              <div className="absolute left-[13px] top-[6px] bg-black" style={{ width: 56, height: 120 }}><div className="absolute left-[8px] top-[18px]"><Wordmark color="#FFFFFF" width={40} /></div></div>
            </div>
          </Example>
          <Example tone="dont" caption="A landscape flag hanging down: the logo turns on its side." bg="#F5F5F7" h={200}>
            <div className="relative" style={{ width: 90, height: 170 }}>
              <div className="absolute left-[10px] top-0 h-full w-[3px] bg-[#8E8E93]" />
              <div className="absolute left-[13px] top-[6px] bg-black" style={{ width: 50, height: 120 }}><div className="absolute left-[27px] top-[40px] origin-top-left rotate-90"><Wordmark color="#FFFFFF" width={60} /></div></div>
            </div>
          </Example>
        </Examples>
        <Specs rows={[
          ["Indoor flags", "Vertical (portrait), black, the white logo level near the top"],
          ["Why", "A landscape flag on an indoor pole hangs down, and the logo turns on its side (ch. 40)"],
        ]} />
      </Section>

      <Section id="office-specs" title="Specifications">
        <Specs rows={[
          ["Offices", "Black walls where people meet us (reception, meeting rooms), like the showroom; work areas may stay light. White is the second version (ch. 47)"],
          ["Entrance plate", "Black acrylic or black anodized aluminum, logo and names engraved or printed white; about 600 × 360 mm"],
          ["Reception logo", "3D letters, white on the black wall, halo-lit (ch. 39); 1000–1600 mm wide"],
          ["On a white wall", "Black letters — black acrylic or black anodized, never grey — with the group line of ch. 43"],
          ["Room signs", "150 × 60 mm, white acrylic, black print, fixed at 1500 mm to the center"],
          ["Lit signs", "Halo-lit letters, white light only (ch. 39)"],
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 118 · Showroom ────────────────────────────────────────────────────── */

export function Showroom() {
  const zones: Array<[string, ReactNode]> = [
    ["Lockstitch", <FlatBedMachineIcon key="a" size={22} />],
    ["Overlock", <OverlockMachineIcon key="a" size={22} />],
    ["Coverstitch", <CoverstitchIcon key="a" size={22} />],
    ["Automatic", <AutomaticMachineIcon key="a" size={22} />],
  ];
  return (
    <Chapter
      n={118}
      lead={
        <p>
          The showroom is a place to try machines, not to look at posters. Machines stand by category, ready to
          sew, each with its spec card — and a table where the conversation turns into a quotation.
        </p>
      }
      toc={[
        { id: "plan", title: "The plan" },
        { id: "spec-card", title: "The spec card" },
        { id: "showroom-rules", title: "Rules" },
      ]}
    >
      <Section id="plan" title="The plan">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="grid w-[280px] grid-cols-2 gap-2 rounded-[4px] bg-[#000000] p-3 text-[#F5F5F7] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]">
            {zones.map(([name, icon]) => (
              <div key={name} className="flex flex-col items-center justify-center gap-1 rounded-[3px] bg-[#1D1D1F] py-3">
                {icon}
                <span className="text-[8px] font-semibold uppercase tracking-[0.1em]">{name}</span>
              </div>
            ))}
            <div className="col-span-2 flex items-center justify-between rounded-[3px] bg-[#1D1D1F] px-3 py-2 text-white" style={{ boxShadow: "inset 0 0 0 1px #3A3A3C" }}>
              <span className="text-[8px] font-semibold uppercase tracking-[0.1em]">Meeting table · Koleex Hub</span>
              <Wordmark color="#FFFFFF" width={40} />
            </div>
          </div>
        </Stage>
      </Section>

      <Section id="spec-card" title="The spec card">
        <Stage bg="#D2D2D7" h="auto" pad={24}>
          <div className="w-[160px] rounded-[3px] bg-white p-3 text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "148 / 210" }}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between"><Wordmark color="#000000" width={46} /><OverlockMachineIcon size={14} /></div>
              <p className="mt-3 text-[11px] font-bold">Model name</p>
              <p className="text-[6.5px] text-[#6E6E73]">Overlock · 4-thread</p>
              <div className="mt-2 overflow-hidden rounded-[2px] border border-[#D2D2D7] text-[6px]">
                {[["Max speed", "— SPM"], ["Stitch width", "— mm"], ["Motor", "—"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-[#D2D2D7] px-1 py-[2px] last:border-0"><span>{k}</span><span className="font-mono">{v}</span></div>
                ))}
              </div>
              <div className="mt-auto flex items-end justify-between"><span className="text-[5.5px] text-[#6E6E73]">Scan for the full page</span><QrBox size={26} /></div>
            </div>
          </div>
        </Stage>
        <P>The spec card is an A5 spec sheet on a stand (<Ref n={105} />): no price. Prices are given in a quotation.</P>
      </Section>

      <Section id="showroom-rules" title="Rules">
        <Bullets items={[
          "Machines grouped by category, labeled with the machine icons (ch. 59).",
          "Black walls, ceiling and floor; the white machines lit from above (4000 K), on black plinths — the logo once, halo-lit, at the entrance. White is the second version (ch. 47).",
          "Every machine threaded, clean and ready to sew; a fabric tray at each one.",
          "A screen may show the website or Koleex Hub; no TV channels, no music videos.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 119 · Warehouse & Factory Signage ─────────────────────────────────── */

export function WarehouseSignage() {
  return (
    <Chapter
      n={119}
      lead={
        <p>
          In a warehouse, a sign is a tool. It has to be read from a forklift, at a distance, under poor light.
          So it is big, black and white, and it follows the same codes as our stock in Koleex Hub.
        </p>
      }
      toc={[
        { id: "zones-signs", title: "Zone and rack signs" },
        { id: "safety-floor", title: "Safety and floor marking" },
        { id: "wh-specs", title: "Specifications" },
      ]}
    >
      <Section id="zones-signs" title="Zone and rack signs">
        <Stage bg="#D1D1D6" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Sign w={130} h={150} dark>
              <div className="flex h-full flex-col items-center justify-center">
                <p className="text-[64px] font-black leading-none">A</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em]">Machine heads</p>
                <p lang="zh-Hans" className="text-[9px] text-[#98989D]">机头</p>
              </div>
            </Sign>
            <Sign w={130} h={50}>
              <div className="flex h-full items-center justify-between px-3">
                <span className="text-[20px] font-black" style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>A-03-2</span>
                <span className="inline-block h-7 w-7" style={{ background: "repeating-linear-gradient(90deg,#000000 0 1px,transparent 1px 3px)" }} />
              </div>
            </Sign>
          </div>
        </Stage>
        <Bullets items={[
          "Zone letters and rack codes are the same codes as the stock locations in Koleex Hub.",
          "English and the local language; the letter or code is the biggest thing on the sign.",
          "The logo on the building and at the entrance — not on every rack.",
        ]} />
      </Section>

      <Section id="safety-floor" title="Safety and floor marking">
        <Rule why="Forklift lanes and exits must be recognized instantly by anyone, including visitors and drivers from outside.">
          Safety signs, fire equipment signs and floor markings follow the safety standards and local law — yellow,
          red and green included. The brand palette never replaces them.
        </Rule>
      </Section>

      <Section id="wh-specs" title="Specifications">
        <Specs rows={[
          ["Zone signs", "600 × 700 mm hanging, black with white letters, letter height 300 mm"],
          ["Rack labels", "100 × 50 mm, white, black code 20 mm tall, with a barcode"],
          ["Building sign", "Halo-lit 3D letters — black on a light facade, white on a dark one; white light only (ch. 39)"],
          ["Material", "Aluminum composite or rigid PVC; matte, no reflections under high-bay lights"],
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 120 · Vehicles ────────────────────────────────────────────────────── */

function Van({ wrong = false }: { wrong?: boolean }) {
  return (
    <div className="relative" style={{ width: 320, height: 150 }}>
      <div className="absolute left-[10px] top-[24px] h-[96px] w-[230px] rounded-[10px]" style={{ background: wrong ? "#FFFFFF" : "#000000", boxShadow: wrong ? "inset 0 0 0 1.5px #D1D1D6" : "inset 0 0 0 1.5px #1D1D1F" }} />
      <div className="absolute left-[236px] top-[46px] h-[74px] w-[74px] rounded-r-[26px] rounded-tl-[6px]" style={{ background: wrong ? "#FFFFFF" : "#000000", boxShadow: wrong ? "inset 0 0 0 1.5px #D1D1D6" : "inset 0 0 0 1.5px #1D1D1F" }} />
      <div className="absolute left-[252px] top-[54px] h-[26px] w-[40px] rounded-r-[14px] rounded-tl-[3px] bg-[#3A3A3C]" />
      {[52, 250].map((l) => (
        <div key={l} className="absolute top-[106px] h-[36px] w-[36px] rounded-full bg-[#1D1D1F]" style={{ left: l, boxShadow: "inset 0 0 0 9px #1D1D1F, inset 0 0 0 14px #98989D" }} />
      ))}
      {wrong ? (
        <div className="absolute left-[24px] top-[36px] w-[200px] -rotate-3 space-y-0.5">
          <p className="text-[18px] font-black italic" style={{ color: "#DC2626" }}>KOLEEX!!</p>
          <p className="text-[8px] font-bold" style={{ color: "#1D4ED8" }}>Machines · Parts · Service · Best prices</p>
          <p className="text-[8px] font-bold text-[#16A34A]">+20 1xx · +86 1xx · +971 5xx</p>
        </div>
      ) : (
        <div className="absolute left-[30px] top-[48px] flex flex-col gap-2">
          <GroupLockup color="#FFFFFF" width={130} />
          <p className="text-[7px] text-[#F5F5F7]" style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{KOLEEX_COMPANY.web}</p>
        </div>
      )}
    </div>
  );
}

export function Vehicles() {
  return (
    <Chapter
      n={120}
      lead={
        <p>
          A company van is a moving sign. It is seen by more people than any poster — and judged by how it is
          driven and kept. Black body, white logo, one line, one address.
        </p>
      }
      toc={[
        { id: "livery", title: "The livery" },
        { id: "vehicle-rules", title: "Rules" },
      ]}
    >
      <Section id="livery" title="The livery">
        <Examples cols={2}>
          <Example tone="do" caption="Black body; the white group lockup and the website." bg="#F5F5F7" h={180}>
            <Scaled w={260} base={320} h={150}><Van /></Scaled>
          </Example>
          <Example tone="dont" caption="Colors, slogans, a list of services and phone numbers." bg="#F5F5F7" h={180}>
            <Scaled w={260} base={320} h={150}><Van wrong /></Scaled>
          </Example>
        </Examples>
        <Specs rows={[
          ["Vehicle color", "Black — factory black paint, or a matte black wrap where the vehicle is not black"],
          ["Logo", "Both sides, 900–1200 mm wide on a van; the back doors 500 mm"],
          ["Text", "The group lockup (ch. 43) and the website only"],
          ["Material", "Cut matte white vinyl"],
          ["Second version", "White body, black logo — for hot climates, or where the local fleet is white (ch. 47)"],
        ]} />
      </Section>

      <Section id="vehicle-rules" title="Rules">
        <Bullets items={[
          "No personal phone numbers; the website leads to every contact.",
          "Clean vehicles only; a damaged decal is replaced, not patched.",
          "Private cars carry no KOLEEX decals.",
          <>Local rules for commercial vehicle markings come first (<Ref n={132} />).</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 121 · Events & Training Days ──────────────────────────────────────── */

export function EventsTraining() {
  return (
    <Chapter
      n={121}
      lead={
        <p>
          Training days, open days and customer events bring people to us. They run like our machines:
          prepared, on time, and easy to follow — from the invitation to the certificate.
        </p>
      }
      toc={[
        { id: "pieces", title: "The pieces" },
        { id: "stage", title: "Stage and lectern" },
        { id: "consent", title: "Photos and consent" },
        { id: "event-rules", title: "Rules" },
      ]}
    >
      <Section id="pieces" title="The pieces">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <Slide w={240} dark>
              <div className="absolute inset-0 flex flex-col p-4">
                <Wordmark color="#FFFFFF" width={54} />
                <p className="mt-auto text-[6px] font-semibold uppercase tracking-[0.2em] text-[#98989D]">Training day · Overlock</p>
                <p className="mt-1 text-[14px] font-bold leading-tight">Setup, threading<br />and daily care</p>
                
              </div>
            </Slide>
            <div className="w-[150px] rounded-[3px] bg-white p-3 text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]">
              <p className="text-[7px] font-semibold uppercase tracking-[0.14em] text-[#6E6E73]">Agenda</p>
              <div className="mt-1.5 space-y-1 text-[7px]">
                {[["09:30", "Welcome"], ["10:00", "Setup and threading"], ["12:00", "Lunch"], ["13:00", "Practice on the machines"], ["15:30", "Certificates"]].map(([t, l]) => (
                  <div key={t} className="flex gap-2"><span className="w-8 shrink-0 font-mono text-[#6E6E73]">{t}</span><span>{l}</span></div>
                ))}
              </div>
            </div>
          </div>
        </Stage>
        <Table
          head={["Piece", "Where it is defined"]}
          rows={[
            ["Invitation", <Ref key="a" n={100} />],
            ["Slides", <Ref key="a" n={90} />],
            ["Badges", <Ref key="a" n={115} />],
            ["Training certificate", <Ref key="a" n={99} />],
            ["Photos and posts", <Ref key="a" n={68} />],
          ]}
        />
      </Section>

      <Section id="stage" title="Stage and lectern">
        <Examples cols={2}>
          <Example tone="do" caption="With a screen (the usual case): the context header on the screen, logo panels on both sides." bg="#F5F5F7" h={200}><Scaled w={240} base={280} h={160}><StageSet screen /></Scaled></Example>
          <Example tone="do" caption="Without a screen: a black wall, the lockup high and centered, the light line." bg="#F5F5F7" h={200}><Scaled w={240} base={280} h={160}><StageSet screen={false} /></Scaled></Example>
        </Examples>
        <Specs rows={[
          ["Screen", "Every slide opens with the context header: KOLEEX | the event (ch. 43, 90)"],
          ["Side panels", "Black, the white logo at eye height and above — seen in every photo of the speaker"],
          ["Lectern", "Black, the white logo on the front, about 300 mm wide, high enough to clear the microphone"],
          ["Never", "The logo on the floor, on the stage skirt, or behind the speaker's head"],
        ]} />
      </Section>

      <Section id="consent" title="Photos and consent">
        <Rule why="Owner rule: people appear in KOLEEX material only with their consent.">
          Tell every guest that photos are taken, and photograph only those who agree. Anyone who says no is
          never in a published photo.
        </Rule>
        <Stage bg="#D2D2D7" h="auto" pad={24}>
          <Sign w={200} h={110}>
            <div className="flex h-full flex-col justify-center gap-1 px-4">
              <Wordmark color="#000000" width={46} />
              <p className="mt-1 text-[10px] font-bold">Photos are taken at this event.</p>
              <p className="text-[7px] text-[#6E6E73]">If you prefer not to appear, tell our team — we will not photograph you.</p>
            </div>
          </Sign>
        </Stage>
      </Section>

      <Section id="event-rules" title="Rules">
        <Bullets items={[
          "Start on time; the agenda is sent with the invitation.",
          "One trainer per four trainees on the machines.",
          "Every trainee leaves with a numbered certificate, and the number is recorded.",
          "Food and drink away from the machines.",
        ]} />
      </Section>
    </Chapter>
  );
}
