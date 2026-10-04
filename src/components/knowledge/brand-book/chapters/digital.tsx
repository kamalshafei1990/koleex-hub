"use client";

/* Chapters 75–78: website, Koleex Hub UI (Core and Aurora), email. */

import type { CSSProperties } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import OverlockMachineIcon from "@/components/icons/machine-kinds/OverlockMachineIcon";
import FlatBedMachineIcon from "@/components/icons/machine-kinds/FlatBedMachineIcon";
import CoverstitchIcon from "@/components/icons/machine-kinds/CoverstitchIcon";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { HubMark, Wordmark } from "../marks";
import { Browser, MachineShot } from "../mockups";
import { HUB_GRADIENT, SILVER } from "@/lib/brand-book/tokens";

const SILVER_TEXT = { backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const;

/* ── 75 · Website ──────────────────────────────────────────────────────── */

export function Website() {
  return (
    <Chapter
      n={75}
      lead={
        <p>
          The website is where most customers meet KOLEEX first. It has three jobs: be found, explain our
          machines and services clearly, and make it easy to ask us for a quotation — in English, Arabic or
          Chinese.
        </p>
      }
      toc={[
        { id: "structure", title: "Structure" },
        { id: "header", title: "Header and home" },
        { id: "product-page", title: "The machine page" },
        { id: "actions", title: "Calls to action" },
        { id: "web-rules", title: "Rules" },
      ]}
    >
      <Section id="structure" title="Structure">
        <Table
          head={["Page", "Purpose"]}
          rows={[
            [<B key="a">Home</B>, "Who we are in one screen, the machine categories, one call to action"],
            [<B key="a">Machines</B>, "Every category with its machine icon, then every machine"],
            [<B key="a">Machine page</B>, "Photos, key features, specifications, downloads, request a quotation"],
            [<B key="a">Services</B>, "Inspection before shipping, shipping and documents, installation and training, spare parts"],
            [<B key="a">About</B>, "The story since 1955, the group, where we are"],
            [<B key="a">Become a distributor</B>, "What we offer partners, and a form"],
            [<B key="a">News</B>, "Exhibitions, new machines, knowledge articles"],
            [<B key="a">Contact</B>, "Offices, WhatsApp, form, map"],
          ]}
        />
        <P>Each language has its own address — <B>/en</B>, <B>/ar</B>, <B>/zh</B> — so a customer can be sent a link in their language. Arabic pages mirror right to left (<Ref n={54} />).</P>
      </Section>

      <Section id="header" title="Header and home">
        <Stage bg="#F5F5F7" h="auto" pad={20}>
          <Browser w={560}>
            <div className="flex items-center gap-4 border-b border-[#D2D2D7] px-4 py-2.5" style={{ background: "rgba(245,245,247,0.86)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)" }}>
              <Wordmark color="#000000" width={72} />
              <nav className="flex flex-1 gap-3 text-[9px] text-[#424245]"><span>Machines</span><span>Services</span><span>About</span><span>News</span><span>Contact</span></nav>
              <span className="text-[8.5px] text-[#6E6E73]">EN · 中文 · عربي</span>
              <span className="rounded-full px-2.5 py-1 text-[8.5px] font-medium text-white" style={{ background: "#567FB2" }}>Request a quotation</span>
            </div>
            <div className="bg-[#000000] px-6 pb-4 pt-9 text-center">
              <p className="text-[30px] font-semibold leading-none tracking-[-0.03em]" style={SILVER_TEXT}>Stitch. Perfected.</p>
              <p className="mt-2 text-[10px] text-[#A1A1A6]">Industrial garment machinery — selected, checked, delivered.</p>
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="rounded-full px-3 py-1 text-[8.5px] font-medium text-white" style={{ background: "#567FB2" }}>See the machines</span>
                <span className="text-[8.5px] text-[#7FA9D6]">Chat on WhatsApp ›</span>
              </div>
              <div className="mx-auto mt-6 w-[62%]"><MachineShot w="100%" label={false} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2 bg-[#F5F5F7] p-4">
              {[["Flat bed", FlatBedMachineIcon], ["Overlock", OverlockMachineIcon], ["Coverstitch", CoverstitchIcon]].map(([n, I]) => {
                const Icon = I as typeof FlatBedMachineIcon;
                return <div key={n as string} className="flex flex-col items-center gap-1.5 rounded-[14px] bg-white px-2.5 py-3 text-[9px] font-medium text-[#1D1D1F]"><Icon size={22} />{n as string}</div>;
              })}
            </div>
          </Browser>
        </Stage>
        <Specs rows={[
          ["Header", "Light and translucent (Cloud #F5F5F7 at 86%, blurred), the black logo top-left, gray menu, the language switch, one Hub Blue button"],
          ["Home hero", "Black, centered: the headline in silver, one line under it, one button and one link — the machine below"],
          ["Below the hero", "The machine categories on Cloud, each with its line icon (ch. 58)"],
          ["Buttons and links", "Hub Blue only — Steel pill buttons, Sky links on black, Deep links on white (ch. 46)"],
        ]} />
      </Section>

      <Section id="product-page" title="The machine page">
        <Rule why="A factory owner decides with his eyes first and his spreadsheet second. The machine, big and sharp, sells before the numbers do.">
          Every machine page tells a short story from the top down: the machine on black, three key numbers,
          close-ups, then the full specifications and the downloads.
        </Rule>
        <Stage bg="#F5F5F7" h="auto" pad={20}>
          <Browser url="www.koleexgroup.com/en/machines/overlock/model" w={420}>
            <div className="bg-[#000000] px-6 pb-4 pt-7 text-center">
              <p className="text-[7px] font-medium uppercase tracking-[0.2em] text-[#98989D]">Overlock</p>
              <p className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.03em]" style={SILVER_TEXT}>Model name</p>
              <p className="mt-1.5 text-[9.5px] text-[#A1A1A6]">Four threads. One pass.</p>
              <span className="mt-2.5 inline-block rounded-full px-3 py-1 text-[8.5px] font-medium text-white" style={{ background: "#567FB2" }}>Request a quotation</span>
              <div className="mx-auto mt-5 w-[74%]"><MachineShot w="100%" label={false} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2 bg-white px-4 py-5 text-center">
              {[["6,000", "stitches per minute"], ["4", "threads"], ["550 W", "servo motor"]].map(([v, l]) => (
                <div key={l}><p className="text-[18px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">{v}</p><p className="text-[8px] text-[#6E6E73]">{l}</p></div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 bg-white px-4 pb-4">
              {["Needle", "Stitch", "Panel"].map((c) => (
                <div key={c} className="flex aspect-square items-end rounded-[12px] bg-[#F5F5F7] p-2 text-[7.5px] text-[#6E6E73]">Close-up · {c}</div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-[#E8E8ED] bg-white px-4 py-3 text-[8.5px]">
              <span className="text-[#1D1D1F]">Full specifications</span>
              <span className="text-[#3E6796]">Download the spec sheet (PDF) ›</span>
            </div>
          </Browser>
        </Stage>
        <Table
          head={["Order", "Section", "On"]}
          rows={[
            ["1", "Category, model name in silver, one line, Request a quotation, the machine", "Black"],
            ["2", "Three key numbers, big", "White"],
            ["3", "Close-ups: needle, stitch, control panel", "White"],
            ["4", "Full specifications table, downloads, related machines", "White"],
          ]}
        />
        <Bullets items={[
          <>Photos: our own — the hero on black, close-ups and details on white (<Ref n={64} />).</>,
          <><B>No prices</B> on the website — prices are given in quotations.</>,
          "Never a supplier's name, factory code or catalog.",
        ]} />
      </Section>

      <Section id="actions" title="Calls to action">
        <Table
          head={["Say", "Never"]}
          rows={[
            ["Request a quotation", "Buy now · Add to cart"],
            ["Chat on WhatsApp", "Contact us now!!!"],
            ["Download the spec sheet", "Click here"],
            ["Become a distributor", "Get started · Sign up free"],
          ]}
        />
      </Section>

      <Section id="web-rules" title="Rules">
        <Bullets items={[
          <><B>Fast from China:</B> fonts and scripts hosted on our own domain — never loaded from Google Fonts or public CDNs, which are blocked or slow in mainland China.</>,
          <><B>Every form goes to Koleex Hub</B>, where it becomes a contact that someone follows up.</>,
          "Every page has a title and description in its own language, and links to its other language versions.",
          "Readable: body text 16 px, contrast AA (ch. 49), every image has alternative text.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── UI control mockups ────────────────────────────────────────────────── */

function CoreControls({ dark }: { dark: boolean }) {
  const fg = dark ? "#FFFFFF" : "#000000";
  const surf = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const border = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const dim = dark ? "rgba(255,255,255,0.70)" : "rgba(0,0,0,0.82)";
  return (
    <div className="w-full space-y-3 rounded-xl p-4" style={{ background: dark ? "#000000" : "#FFFFFF", color: fg, boxShadow: `0 0 0 1px ${border}` }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg px-3 py-1.5 text-[11px] font-semibold" style={{ background: fg, color: dark ? "#000000" : "#FFFFFF" }}>Save</span>
        <span className="rounded-lg px-3 py-1.5 text-[11px] font-medium" style={{ background: surf, boxShadow: `inset 0 0 0 1px ${border}` }}>Cancel</span>
        <span className="text-[11px]" style={{ color: dark ? "#7FA9D6" : "#3E6796" }}>View details</span>
      </div>
      <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: surf, boxShadow: `inset 0 0 0 1px ${border}`, color: dim }}>Customer name</div>
      <div className="flex items-center gap-4">
        <span className="relative inline-block h-5 w-9 rounded-full" style={{ background: "#059669" }}><span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white" /></span>
        <span className="relative h-1.5 flex-1 rounded-full" style={{ background: border }}><span className="absolute inset-y-0 left-0 w-3/5 rounded-full" style={{ background: "#0066FF" }} /><span className="absolute -top-[5px] h-4 w-4 rounded-full bg-white shadow" style={{ left: "calc(60% - 8px)" }} /></span>
      </div>
      <div className="flex gap-1 rounded-lg p-1 text-[10.5px]" style={{ background: surf }}>
        <span className="rounded-md px-2 py-1 font-semibold" style={{ background: fg, color: dark ? "#000000" : "#FFFFFF" }}>Details</span><span className="px-2 py-1" style={{ color: dim }}>Specs</span><span className="px-2 py-1" style={{ color: dim }}>Files</span>
      </div>
    </div>
  );
}

function AuroraControls() {
  const glass: CSSProperties = { background: "rgba(255,255,255,0.07)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" };
  return (
    <div className="relative w-full overflow-hidden rounded-xl p-4 text-white" style={{ minHeight: 220, background: "radial-gradient(140% 60% at 10% 100%, rgba(62,103,150,0.95), transparent 62%), radial-gradient(120% 55% at 100% 0%, rgba(86,127,178,0.75), transparent 60%), radial-gradient(80% 40% at 60% 55%, rgba(127,169,214,0.35), transparent 70%), #000000" }}>
      <div className="relative space-y-3 rounded-2xl p-3" style={glass}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1D1D1F]" style={{ boxShadow: "0 0 0 3px rgba(86,127,178,0.35), 0 0 18px rgba(127,169,214,0.45)" }}>Save</span>
          <span className="rounded-lg px-3 py-1.5 text-[11px]" style={glass}>Cancel</span>
          <span className="rounded-lg px-3 py-1.5 text-[11px]" style={{ background: "rgba(86,127,178,0.10)", boxShadow: "inset 0 0 0 1px #567FB2" }}>Selected</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="relative inline-block h-5 w-9 rounded-full" style={{ background: "linear-gradient(90deg,#567FB2,#BCD8F0)" }}><span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white" /></span>
          <span className="relative h-1.5 flex-1 rounded-full bg-white/10"><span className="absolute inset-y-0 left-0 w-3/5 rounded-full" style={{ background: HUB_GRADIENT.cssHorizontal }} /><span className="absolute -top-[5px] h-4 w-4 rounded-full bg-white" style={{ left: "calc(60% - 8px)" }} /></span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: "rgba(10,10,10,0.6)", boxShadow: "0 0 0 1px rgba(127,169,214,0.6), 0 0 16px rgba(86,127,178,0.6)" }}>✦ Ask Koleex AI</span>
      </div>
    </div>
  );
}

/* ── 76 · Koleex Hub UI: Core ──────────────────────────────────────────── */

export function HubCore() {
  return (
    <Chapter
      n={76}
      lead={
        <p>
          Koleex Hub has two skins. <B>Core</B> is the flat one: the company’s black-and-white identity
          applied to software — solid surfaces, hairlines, and color only where it means something.
        </p>
      }
      toc={[
        { id: "core-look", title: "The Core look" },
        { id: "core-tokens", title: "Tokens" },
        { id: "core-rules", title: "Rules for every new screen" },
      ]}
    >
      <Section id="core-look" title="The Core look">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2"><CoreControls dark /><p className="text-[12px] text-[var(--text-dim)]">Dark</p></div>
          <div className="space-y-2"><CoreControls dark={false} /><p className="text-[12px] text-[var(--text-dim)]">Light</p></div>
        </div>
      </Section>

      <Section id="core-tokens" title="Tokens">
        <Table
          head={["Token", "Dark", "Light"]}
          rows={[
            ["Background", "#000000", "#FFFFFF"],
            ["Surface", "White 5%", "Black 4%"],
            ["Border", "White 8%", "Black 8%"],
            ["Text", "White · 70% secondary", "Black · 82% secondary"],
            ["Primary button", "White, black text", "Black, white text"],
            ["Toggle on", "Status green #059669, white knob", "Same"],
            ["Slider fill", "#0066FF, white knob", "Same"],
            ["Links and selection", "Hub Blue Sky #7FA9D6", "Hub Blue Deep #3E6796"],
          ]}
        />
      </Section>

      <Section id="core-rules" title="Rules for every new screen">
        <Bullets items={[
          <><B>Both skins from the first day</B> — every new screen ships in Core and in Aurora.</>,
          <><B>Three languages from the first day</B> — English, Chinese and Arabic, with right-to-left layout for Arabic.</>,
          "Icons from the Hub library only; dates DD/MM/YYYY; numbers in tabular figures.",
          "Status colors only for status. No decorative color.",
          "The screen fills the window: content up to 1500 px wide, never a narrow column on a wide screen.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 77 · Koleex Hub UI: Aurora ────────────────────────────────────────── */

export function HubAurora() {
  return (
    <Chapter
      n={77}
      lead={
        <p>
          <B>Aurora</B> is Koleex Hub’s signature skin: a slow, deep wave behind frosted glass, with Hub
          Blue as the light that marks what is selected, active or intelligent. It belongs to the software
          alone.
        </p>
      }
      toc={[
        { id: "aurora-look", title: "The Aurora look" },
        { id: "aurora-parts", title: "What makes Aurora" },
        { id: "aurora-where", title: "Where Aurora lives — and where it never does" },
      ]}
    >
      <Section id="aurora-look" title="The Aurora look">
        <AuroraControls />
      </Section>

      <Section id="aurora-parts" title="What makes Aurora">
        <Table
          head={["Element", "Aurora"]}
          rows={[
            ["The ground", "A slow animated wave behind everything, in deep blues on black"],
            ["Surfaces", "Frosted glass: translucent, blurred — one blurred edge at a time, never stacked blur"],
            ["Popups", "Glass islands with 16 px corners, floating above the ground"],
            ["Selection", "A 1 px Hub Blue ring with a 10% Hub Blue wash"],
            ["Toggles and sliders", "Hub gradient track, white knob"],
            ["Primary button", "Solid, with a soft Hub Blue halo on hover"],
            ["AI features", "An orbiting Hub Blue glow — the one place a glow is allowed"],
          ]}
        />
      </Section>

      <Section id="aurora-where" title="Where Aurora lives — and where it never does">
        <Rule why="Aurora is how the product feels. Company material has to print, fax, photocopy and last — it stays Core.">
          Aurora appears only inside Koleex Hub and in material that shows the Hub itself. Documents,
          print, packaging, signage and brand marketing are always Core.
        </Rule>
        <Examples cols={2}>
          <Example tone="do" caption="A screenshot of the Hub in an announcement about the Hub." bg="#000000" h={150}>
            <HubMark variant="for-dark" style={{ width: 170 }} />
          </Example>
          <Example tone="dont" caption="Glass, glow and the wave on a quotation or a catalog." bg="#F5F5F7" h={150}>
            <div className="flex h-[110px] w-[90px] items-start justify-center rounded bg-white p-2" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.1), 0 0 22px rgba(86,127,178,0.8)" }}>
              <Wordmark color="#000000" width={50} />
            </div>
          </Example>
        </Examples>
        <Note>The detailed Aurora canon for developers — tokens, the ground, popups and the conversion playbook — lives with the Hub’s code.</Note>
      </Section>
    </Chapter>
  );
}

/* ── 78 · Email & Newsletters ──────────────────────────────────────────── */

export function Email() {
  return (
    <Chapter
      n={78}
      lead={
        <p>
          Every email from KOLEEX — a newsletter, a quotation from the Hub or a reply from a colleague —
          looks and sounds like the same company, and is sent only to people who asked to hear from us.
        </p>
      }
      toc={[
        { id: "newsletter", title: "The newsletter" },
        { id: "email-specs", title: "Build specifications" },
        { id: "sending", title: "Sending rules" },
      ]}
    >
      <Section id="newsletter" title="The newsletter">
        <Stage bg="#F5F5F7" h="auto" pad={20}>
          <div className="w-[300px] overflow-hidden rounded-md bg-white text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]">
            <div className="flex items-center justify-between px-4 py-3"><Wordmark color="#000000" width={70} /><span className="text-[7.5px] text-[#6E6E73]">September 2026</span></div>
            <div className="bg-[#000000] px-4 pb-4 pt-6 text-center">
              <p className="text-[6.5px] font-medium uppercase tracking-[0.2em] text-[#98989D]">New · Spreading</p>
              <p className="mt-1 text-[17px] font-semibold leading-[1.05] tracking-[-0.02em]" style={SILVER_TEXT}>Lay it flat.<br />Cut it right.</p>
              <span className="mt-2.5 inline-block rounded-full px-3 py-1 text-[8px] font-medium text-white" style={{ background: "#567FB2" }}>See the machine</span>
              <div className="mx-auto mt-4 w-[78%]"><MachineShot w="100%" label={false} /></div>
            </div>
            <div className="space-y-2 px-4 py-3">
              <div className="h-[3px] w-full rounded bg-[#D2D2D7]" /><div className="h-[3px] w-5/6 rounded bg-[#D2D2D7]" />
              <div className="grid grid-cols-2 gap-2 pt-1">{[0, 1].map((i) => <div key={i} className="rounded-[10px] bg-[#F5F5F7] p-2"><MachineShot w="100%" dark={false} label={false} /></div>)}</div>
            </div>
            <div className="space-y-0.5 bg-[#F5F5F7] px-4 py-3 text-[6px] leading-snug text-[#6E6E73]">
              <p className="font-semibold text-[#1D1D1F]">{KOLEEX_COMPANY.en}</p>
              <p lang="zh-Hans">{KOLEEX_COMPANY.zh}</p>
              <p>{KOLEEX_COMPANY.web} · {KOLEEX_COMPANY.email}</p>
              <p className="underline">Unsubscribe</p>
            </div>
          </div>
        </Stage>
      </Section>

      <Section id="email-specs" title="Build specifications">
        <Specs rows={[
          ["Width", "600 px, single column; two columns only for product cards"],
          ["Fonts", "Arial / Helvetica for Latin, Tahoma for Arabic, Microsoft YaHei / PingFang for Chinese — email apps do not load Inter"],
          ["Logo", "PNG from our domain, on a white header so it survives dark mode"],
          ["Images", "Hosted on our own domain, each with alternative text; the email must still make sense with images off"],
          ["Layout", "White email, the black logo top-left in a white header, then a black hero: the headline, one button, the machine"],
          ["Silver headlines", "Sent as images (PNG with alternative text) — email apps cannot draw the silver gradient"],
          ["Buttons", "Hub Blue Steel #567FB2 pill, white text, at least 44 px tall"],
          ["Footer", "Legal name in English and Chinese, website, email, unsubscribe link"],
        ]} />
      </Section>

      <Section id="sending" title="Sending rules">
        <Bullets items={[
          <><B>Only to people who agreed</B> to receive it — and every marketing email has a one-click unsubscribe.</>,
          <>From a <B>@koleexgroup.com</B> address only. Sender name: “KOLEEX” for newsletters, “Full Name · KOLEEX” for people.</>,
          "Subject lines under 50 characters, sentence case, no \"!!!\", no all-caps, at most one emoji.",
          <>Personal emails end with the standard signature (<Ref n={93} />).</>,
        ]} />
        <Note>Data protection laws in China, Egypt and the Gulf all require consent for marketing email. When in doubt, do not send.</Note>
      </Section>
    </Chapter>
  );
}

