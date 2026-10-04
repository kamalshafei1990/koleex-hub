"use client";

/* Chapters 4–10: our story, timeline, what we do, where we are, KOLEEX
   International Group, mission & vision, values.

   Sources: the owner's company profile (sent 27/09/2026) for the heritage
   and the values, and the owner's questionnaire answers for the business,
   the places and the positioning. Nothing here is invented: where the
   owner has not confirmed a fact yet, the chapter says so. The rule the
   owner set — never public: prices, suppliers, costs, future plans,
   customer names — applies to every line. */

import type { ComponentType, CSSProperties, ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import AutomaticMachineIcon from "@/components/icons/machine-kinds/AutomaticMachineIcon";
import BartackIcon from "@/components/icons/machine-kinds/BartackIcon";
import ButtonAttachIcon from "@/components/icons/machine-kinds/ButtonAttachIcon";
import ButtonholeMachineIcon from "@/components/icons/machine-kinds/ButtonholeMachineIcon";
import ChainstitchIcon from "@/components/icons/machine-kinds/ChainstitchIcon";
import CoverstitchIcon from "@/components/icons/machine-kinds/CoverstitchIcon";
import DoubleNeedleIcon from "@/components/icons/machine-kinds/DoubleNeedleIcon";
import FlatBedMachineIcon from "@/components/icons/machine-kinds/FlatBedMachineIcon";
import HeavyDutyMachineIcon from "@/components/icons/machine-kinds/HeavyDutyMachineIcon";
import MultiNeedleIcon from "@/components/icons/machine-kinds/MultiNeedleIcon";
import OverlockMachineIcon from "@/components/icons/machine-kinds/OverlockMachineIcon";
import PatternSewerIcon from "@/components/icons/machine-kinds/PatternSewerIcon";
import {
  B, Bullets, Chapter, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { LEGAL_NAME_EN } from "@/lib/legal-name";

/* ── Shared facts ──────────────────────────────────────────────────────── */

/** The heritage, from the owner's company profile. One list, used by the
 *  story and the timeline, so the two can never disagree. */
const MILESTONES: Array<{ year: string; title: string; text: string; key?: boolean }> = [
  { year: "1955", title: "A shop in Cairo", text: "Kamal Shafei opens a sewing-machine shop in Cairo: KAS.", key: true },
  { year: "1960", title: "A national first", text: "KAS supports Nefertiti, the first sewing machine made in Egypt." },
  { year: "1975", title: "Across the Arab world", text: "The business grows into the Arab markets." },
  { year: "1980", title: "The second generation", text: "Essmat Shafei joins and brings in machines from Japan and the United Kingdom." },
  { year: "1997", title: "Sole agent", text: "Sole agency for international machine brands." },
  { year: "2002", title: "A new company", text: "KAS becomes Eskn Co." },
  { year: "2005", title: "To China", text: "The first steps into China, where the industry’s machines are made." },
  { year: "2009", title: "The third generation", text: "Kamal Shafei, grandson of the founder, joins the business." },
  { year: "2012", title: "KOLEEX", text: "The KOLEEX brand is launched in Cairo.", key: true },
  { year: "2015", title: "Partnerships in China", text: "Long-term manufacturing partnerships in China." },
  { year: "2017", title: "Taizhou", text: "Headquarters move to Taizhou, Zhejiang — the heart of China’s sewing-machine industry.", key: true },
  { year: "2019", title: "A group", text: "KOLEEX International Group is formed." },
  { year: "2023", title: "70+ countries", text: "KOLEEX machines work in more than 70 countries." },
  { year: "2024", title: "The Taizhou company", text: `${LEGAL_NAME_EN} is registered on 14/03/2024.` },
];

/* ── 04 · Our Story ────────────────────────────────────────────────────── */

export function OurStory() {
  return (
    <Chapter
      n={4}
      lead={
        <p>
          KOLEEX did not start in a boardroom. It started in 1955, in a sewing-machine shop in Cairo — and it
          has been about machines, and the people who run them, for three generations since.
        </p>
      }
      toc={[
        { id: "story", title: "The story" },
        { id: "three", title: "Three generations" },
        { id: "tell", title: "How to tell it" },
        { id: "story-rules", title: "Rules" },
      ]}
    >
      <Section id="story" title="The story">
        <P>
          In 1955 Kamal Shafei opened a small sewing-machine shop in Cairo. He sold machines, and he repaired
          them — so he knew what broke, why, and what a factory lost every hour a machine stood still. That
          knowledge became the family’s trade.
        </P>
        <P>
          The second generation widened it: machines from Japan and the United Kingdom, the Arab markets, and
          in 1997 the sole agency for international brands. The third generation went to the source. After the
          first steps into China in 2005, Kamal Shafei — the founder’s grandson — launched KOLEEX in 2012 and in
          2017 moved its headquarters to Taizhou, at the center of the world’s sewing-machine industry.
        </P>
        <P>
          Today KOLEEX machines work in more than 70 countries. The promise has not changed since the shop in
          Cairo: precise machines, honest advice, and people who stand behind what they sell.
        </P>
      </Section>

      <Section id="three" title="Three generations">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["1955", "The shop", "Selling and repairing machines in Cairo — learning what factories need."],
            ["1980", "The agency", "International brands, the Arab markets, sole agency from 1997."],
            ["2012", "The brand", "KOLEEX — from Cairo to Taizhou, at the source of the industry."],
          ].map(([y, t, d]) => (
            <div key={y} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
              <p className="font-mono text-[13px] text-[var(--text-dim)]">{y}</p>
              <p className="mt-1 text-[17px] font-bold text-[var(--text-primary)]">{t}</p>
              <p className="mt-1.5 text-[13.5px] leading-6 text-[var(--text-secondary)]">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="tell" title="How to tell it">
        <Table
          head={["Length", "Use it for", "Text"]}
          rows={[
            [<B key="a">One line</B>, "Social bios, captions, slides", "Garment machinery since 1955 — from a shop in Cairo to Taizhou, China."],
            [<B key="a">Three lines</B>, "Website, catalogs, profile", "Our story began in 1955 in a sewing-machine shop in Cairo. Three generations later, KOLEEX is headquartered in Taizhou, China, and its machines work in more than 70 countries. The promise is the same: precise machines, honest advice, people who stand behind what they sell."],
            [<B key="a">Full</B>, "Company profile, About page", "The three paragraphs above, unchanged."],
          ]}
        />
      </Section>

      <Section id="story-rules" title="Rules">
        <Rule why="Heritage is only worth something if it is exact. One inflated date and the whole story is doubted.">
          Tell the story with the dates and facts in this chapter — never rounded up, never embellished.
        </Rule>
        <Bullets items={[
          "“Since 1955” refers to the family business; “KOLEEX since 2012” to the brand. Never “KOLEEX since 1955”.",
          "The international brands the family represented are never named.",
          "Heritage supports the message; it never replaces what the machine does today.",
          <>Photos from the family archive only with the owner’s approval (<Ref n={66} />).</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 05 · Timeline ─────────────────────────────────────────────────────── */

export function Timeline() {
  return (
    <Chapter
      n={5}
      lead={<p>Seventy years, fourteen dates. This is the one timeline every profile, slide and About page uses.</p>}
      toc={[
        { id: "dates", title: "The dates" },
        { id: "timeline-use", title: "Using the timeline" },
      ]}
    >
      <Section id="dates" title="The dates">
        <ol className="relative space-y-0">
          {MILESTONES.map((m, i) => (
            <li key={m.year} className="grid grid-cols-[56px_20px_minmax(0,1fr)] gap-3">
              <span className="pt-3 text-end font-mono text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{m.year}</span>
              <span className="relative flex justify-center">
                <span className="absolute inset-y-0 w-px bg-[var(--border-subtle)]" style={i === 0 ? { top: 18 } : i === MILESTONES.length - 1 ? { bottom: "calc(100% - 18px)" } : undefined} />
                <span className="relative mt-[14px] h-2.5 w-2.5 rounded-full" style={{ background: m.key ? "var(--text-primary)" : "var(--text-ghost)", boxShadow: "0 0 0 3px var(--bg-primary, #000000)" }} />
              </span>
              <div className="pb-4 pt-2">
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">{m.title}</p>
                <p className="text-[13.5px] leading-6 text-[var(--text-secondary)]">{m.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="timeline-use" title="Using the timeline">
        <Stage bg="#000000" h="auto" pad={28}>
          <div className="w-full max-w-[560px]">
            <div className="flex items-center justify-between"><Wordmark color="#FFFFFF" width={70} /><span className="text-[8px] tracking-[0.2em] text-[#98989D]">OUR STORY</span></div>
            <div className="relative mt-8">
              <div className="absolute inset-x-0 top-[5px] h-px bg-[#38383A]" />
              <div className="relative grid grid-cols-4 gap-2">
                {MILESTONES.filter((m) => m.key || m.year === "2023").map((m) => (
                  <div key={m.year}>
                    <span className="block h-[11px] w-[11px] rounded-full" style={{ background: m.key ? "#FFFFFF" : "#48484A" }} />
                    <p className="mt-2 font-mono text-[12px] font-semibold text-white">{m.year}</p>
                    <p className="text-[9.5px] leading-snug text-[#98989D]">{m.title}</p>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        </Stage>
        <Bullets items={[
          "On a slide or a page, show four to six dates — 1955, 2012 and 2017 always among them.",
          "Dates as years only; the one full date is the company registration, 14/03/2024.",
          "A new milestone is added here first, then everywhere else.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 06 · What We Do ───────────────────────────────────────────────────── */

type IconC = ComponentType<{ size?: number; className?: string; style?: CSSProperties }>;

const RANGE: Array<[string, IconC]> = [
  ["Lockstitch", FlatBedMachineIcon], ["Overlock", OverlockMachineIcon], ["Coverstitch", CoverstitchIcon],
  ["Chainstitch", ChainstitchIcon], ["Double needle", DoubleNeedleIcon], ["Multi-needle", MultiNeedleIcon],
  ["Bartack", BartackIcon], ["Buttonhole", ButtonholeMachineIcon], ["Button attach", ButtonAttachIcon],
  ["Heavy duty", HeavyDutyMachineIcon], ["Pattern sewer", PatternSewerIcon], ["Automatic", AutomaticMachineIcon],
];

export function WhatWeDo() {
  return (
    <Chapter
      n={6}
      lead={
        <p>
          KOLEEX equips garment factories: the machines, and everything it takes to keep them producing. We do
          not sell a box and disappear — we deliver working lines.
        </p>
      }
      toc={[
        { id: "offer", title: "What we offer" },
        { id: "machines", title: "The machines" },
        { id: "standard", title: "One standard" },
        { id: "say-it", title: "Saying what we do" },
      ]}
    >
      <Section id="offer" title="What we offer">
        <Table
          head={["", "What it means for the customer"]}
          rows={[
            [<B key="a">Machines</B>, "Industrial sewing and garment machines across every category — from single machines to complete lines"],
            [<B key="a">Line planning</B>, "Advice on which machines a product and an output need — and which it does not"],
            [<B key="a">Setup and training</B>, "Machines installed, adjusted and handed over with operators and mechanics trained"],
            [<B key="a">Parts and service</B>, "Genuine spare parts and after-sales support in the customer’s language"],
            [<B key="a">Koleex Hub</B>, "Our own system behind every quotation, document and shipment — fast and consistent"],
          ]}
        />
      </Section>

      <Section id="machines" title="The machines">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {RANGE.map(([name, Icon]) => (
            <div key={name} className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-3 text-center">
              <Icon size={26} className="text-[var(--text-primary)]" />
              <span className="text-[11px] leading-tight text-[var(--text-secondary)]">{name}</span>
            </div>
          ))}
        </div>
        <P>The full set of categories and their icons is in <Ref n={59} />; the product range itself lives in Koleex Hub and on the website.</P>
      </Section>

      <Section id="standard" title="One standard">
        <Rule why="A customer buys one brand, one warranty and one support line — not a collection of factories.">
          Every machine we sell is a KOLEEX machine — built on our own line or made to our specification, and
          checked to the same standard before it ships.
        </Rule>
        <P>How the standard is applied to the machine, its nameplate and its packing: <Ref n={107} />, <Ref n={108} />, <Ref n={110} />.</P>
      </Section>

      <Section id="say-it" title="Saying what we do">
        <Table
          head={["Say", "Not"]}
          rows={[
            ["Industrial garment machinery", "Sewing machines (too narrow), textile equipment (too wide)"],
            ["Complete lines, set up and supported", "One-stop shop, turnkey solutions provider"],
            ["For garment factories and dealers", "For everyone"],
          ]}
        />
      </Section>
    </Chapter>
  );
}

/* ── 07 · Where We Are ─────────────────────────────────────────────────── */

function Place({ city, role, lines, tz }: { city: string; role: string; lines: ReactNode; tz: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">{role}</p>
      <p className="mt-1 text-[20px] font-bold text-[var(--text-primary)]">{city}</p>
      <div className="mt-2 flex-1 text-[13px] leading-6 text-[var(--text-secondary)]">{lines}</div>
      <p className="mt-3 font-mono text-[12px] text-[var(--text-dim)]">{tz}</p>
    </div>
  );
}

export function WhereWeAre() {
  return (
    <Chapter
      n={7}
      lead={
        <p>
          KOLEEX works from two home bases — Taizhou in China and Egypt — with agents in other markets and
          customers in more than 70 countries.
        </p>
      }
      toc={[
        { id: "bases", title: "Our bases" },
        { id: "reach", title: "Our reach" },
        { id: "place-rules", title: "Rules" },
      ]}
    >
      <Section id="bases" title="Our bases">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Place city="Taizhou" role="Headquarters · China" tz="UTC+8" lines={<><p>Zhejiang Province, China</p><p className="mt-1 text-[12px] text-[var(--text-dim)]">{KOLEEX_COMPANY.address}</p></>} />
          <Place city="Cairo" role="Office · Egypt" tz="UTC+2 · UTC+3 in summer" lines={<p>Customers in Egypt, the Middle East and Africa, in Arabic.</p>} />
          <Place city="Agents" role="Abroad" tz="Local time" lines={<p>Authorized agents and distributors in other markets (<Ref n={128} />).</p>} />
        </div>
      </Section>

      <Section id="reach" title="Our reach">
        <Specs rows={[
          ["Countries with KOLEEX machines", "More than 70"],
          ["Languages we work in", "English, Arabic, Chinese"],
          ["Working across time zones", "Taizhou is 5–6 hours ahead of Cairo"],
        ]} />
      </Section>

      <Section id="place-rules" title="Rules">
        <Bullets items={[
          "Show only offices that exist and are staffed today. An office is added here first, then to maps, slides and the website.",
          "One address per place, exactly as in the company record — the Taizhou address above is the one on every document.",
          "Agents are presented as agents, never as KOLEEX offices.",
        ]} />
        <Note>The company profile lists further locations. They are shown here once the owner confirms each one.</Note>
      </Section>
    </Chapter>
  );
}

/* ── 08 · KOLEEX International Group ───────────────────────────────────── */

const GROUP_BRANDS = ["KOLEEX CHINA", "xiatang", "NEXO Technologies", "OSTA", "KALIA NOVUS", "KTEC", "DOMTEX", "Teramac", "lexi", "CTC", "ENZO", "EL SHAFEI GROUP"];

export function KoleexGroup() {
  return (
    <Chapter
      n={8}
      lead={
        <p>
          KOLEEX International Group is the company behind the brand: the group that holds KOLEEX and its sister
          companies. The group speaks in formal settings; KOLEEX speaks to customers.
        </p>
      }
      toc={[
        { id: "group-vs-brand", title: "Group and brand" },
        { id: "companies", title: "Group companies" },
        { id: "group-rules", title: "Rules" },
      ]}
    >
      <Section id="group-vs-brand" title="Group and brand">
        <Table
          head={["", "KOLEEX International Group", "KOLEEX"]}
          rows={[
            [<B key="a">What it is</B>, "The group company", "The brand of our machines and services"],
            [<B key="a">Where it appears</B>, "Company profile, contracts, letters, LinkedIn, investor and partner material", "Machines, catalogs, website, social media, fairs, packaging"],
            [<B key="a">How it is shown</B>, "Logo + “International Group” in text, or the legal lockup (ch. 43)", "The logo alone"],
          ]}
        />
      </Section>

      <Section id="companies" title="Group companies">
        <div className="flex flex-wrap gap-2">
          {GROUP_BRANDS.map((b) => (
            <span key={b} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-primary)]">{b}</span>
          ))}
        </div>
        <Note tone="warn">This list is taken from the 2026 company profile. Each company’s name and logo are confirmed by the Founder & CEO before they appear in public material.</Note>
      </Section>

      <Section id="group-rules" title="Rules">
        <Bullets items={[
          <>Group companies keep their own names and logos; next to KOLEEX they follow the co-branding rules (<Ref n={44} />).</>,
          "A group company is described as “a KOLEEX International Group company” — never as “KOLEEX”.",
          <>How KOLEEX, Koleex Hub and the group relate is set out in <Ref n={16} />.</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 09 · Mission & Vision ─────────────────────────────────────────────── */

export function MissionVision() {
  return (
    <Chapter
      n={9}
      lead={<p>The mission says what we do every day. The vision says where it leads. Both are short enough to remember.</p>}
      toc={[
        { id: "mission", title: "Mission" },
        { id: "vision", title: "Vision" },
        { id: "mv-use", title: "Using them" },
      ]}
    >
      <Section id="mission" title="Mission">
        <Stage bg="#000000" h="auto" pad={32}>
          <div className="w-full max-w-[520px]">
            <p className="text-[8px] font-semibold uppercase tracking-[0.24em] text-[#98989D]">Mission</p>
            <p className="mt-2 text-[22px] font-bold leading-[1.2] text-white">To equip garment factories with precise machines, complete lines and the know-how to keep them producing.</p>
            
          </div>
        </Stage>
      </Section>

      <Section id="vision" title="Vision">
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <div className="w-full max-w-[520px]">
            <p className="text-[8px] font-semibold uppercase tracking-[0.24em] text-[#6E6E73]">Vision</p>
            <p className="mt-2 text-[22px] font-bold leading-[1.2] text-[#1D1D1F]">To be the first name garment factories trust, in every market we serve.</p>
            
          </div>
        </Stage>
      </Section>

      <Section id="mv-use" title="Using them">
        <Bullets items={[
          "Quote them word for word; never paraphrase them into a slogan.",
          "They belong in the company profile, the About page, recruitment and internal material — not in product ads.",
          "Plans and targets behind the vision are never published (owner rule).",
        ]} />
        <Note tone="warn">Proposed wording, for the Founder & CEO’s approval. The company profile’s longer Vision 2035 stays internal.</Note>
      </Section>
    </Chapter>
  );
}

/* ── 10 · Values ───────────────────────────────────────────────────────── */

const VALUES: Array<[string, string, string]> = [
  ["Global Perspective", "We work across countries, languages and cultures — and design for all of them.", "Three languages in every system; the same standard in Cairo and Taizhou."],
  ["Smart Simplicity", "We make the complex easy to use and easy to understand.", "Few colors, clear words, one clear message per piece."],
  ["Human-Centered Innovation", "Technology is worth what it does for the people who use it.", "We show operators and results, not gadgets."],
  ["Integrity & Trust", "We say what is true and do what we say.", "Real photos, real numbers, real permission — every time."],
  ["Legacy & Modernity", "Seventy years of experience, applied with today’s tools.", "Heritage told in a modern voice, never nostalgic."],
  ["Innovation with Purpose", "We change things when it makes them better, not to look new.", "Every new element in the brand has a job."],
];

export function Values() {
  return (
    <Chapter
      n={10}
      lead={
        <p>
          Six values decide how KOLEEX behaves — with customers, with partners and with each other. Behind all six
          is one habit: continuous improvement.
        </p>
      }
      toc={[
        { id: "six", title: "The six values" },
        { id: "habit", title: "The habit behind them" },
      ]}
    >
      <Section id="six" title="The six values">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {VALUES.map(([t, d, b], i) => (
            <div key={t} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
              <p className="font-mono text-[12px] text-[var(--text-dim)]">0{i + 1}</p>
              <p className="mt-1 text-[17px] font-bold text-[var(--text-primary)]">{t}</p>
              <p className="mt-1.5 text-[13.5px] leading-6 text-[var(--text-secondary)]">{d}</p>
              <p className="mt-2 border-t border-[var(--border-faint)] pt-2 text-[12.5px] leading-5 text-[var(--text-dim)]"><span className="font-semibold text-[var(--text-secondary)]">In the brand: </span>{b}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="habit" title="The habit behind them">
        <Rule why="A value no one practices is a poster. Continuous improvement is how the six become daily work.">
          After every job — a fair, a shipment, a campaign — ask what to keep, what to fix and what to stop, and
          write the answer down.
        </Rule>
        <P>When a lesson changes how the brand is used, it is added to this book (<Ref n={140} />).</P>
      </Section>
    </Chapter>
  );
}
