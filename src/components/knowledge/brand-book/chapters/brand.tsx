"use client";

/* Chapters 11–17: promise & positioning, why KOLEEX, competitive
   landscape, audiences & personas, brand personality, brand architecture,
   product lines & model naming.

   Owner's answers (27/09/2026): integrated solutions, premium, measured
   against Juki, Brother and Jack; customers are large factories and
   dealers; personality confident / precise / modern. Model codes follow
   the governed Product Coding system (Knowledge → Product Coding System);
   this book shows how to WRITE them, it never redefines them. Chapter 13
   is internal, like chapter 130. */

import type { ReactNode } from "react";
import {
  B, Bullets, Chapter, Code, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { HubMark, Wordmark } from "../marks";
import { INK } from "../mockups";

/* ── 11 · Promise & Positioning ────────────────────────────────────────── */

export function PromisePositioning() {
  return (
    <Chapter
      n={11}
      lead={
        <p>
          The promise is what every customer can hold us to. The positioning is where we stand among the names
          a factory compares us with. Everything we make and say should prove both.
        </p>
      }
      toc={[
        { id: "promise", title: "The promise" },
        { id: "positioning", title: "The positioning" },
        { id: "proof", title: "How we prove it" },
      ]}
    >
      <Section id="promise" title="The promise">
        <Stage bg="#000000" h="auto" pad={36}>
          <div className="w-full max-w-[560px] text-center">
            <p className="text-[26px] font-bold leading-[1.15] text-white">Precise machines.<br />Honest advice.<br />People who stand behind what they sell.</p>
            
          </div>
        </Stage>
        <P>It is the line the founder wrote in the foreword of this book (<Ref n={1} />), and the standard every chapter serves.</P>
      </Section>

      <Section id="positioning" title="The positioning">
        <Rule why="A factory does not buy a machine; it buys output. We are chosen when we deliver the whole working line, not the cheapest head.">
          For garment factories and dealers who cannot afford a stopped line, KOLEEX is the industrial garment
          machinery partner that delivers complete, premium lines — set up, trained and supported — from the
          source of the industry in China.
        </Rule>
        <Table
          head={["Part", "Our answer"]}
          rows={[
            [<B key="a">For</B>, "Large garment factories and machine dealers"],
            [<B key="a">Who need</B>, "Production that runs, with one partner responsible for it"],
            [<B key="a">KOLEEX is</B>, "Industrial garment machinery — complete lines, not single boxes"],
            [<B key="a">That</B>, "Plans, supplies, sets up, trains and supports"],
            [<B key="a">Unlike</B>, "Suppliers who sell a machine and leave the rest to the customer"],
            [<B key="a">Because</B>, "Seventy years of the trade, a base at the source in Taizhou, and our own system behind every order"],
          ]}
        />
      </Section>

      <Section id="proof" title="How we prove it">
        <Bullets items={[
          <>A premium brand looks premium everywhere: every chapter of this book is part of the proof.</>,
          "Our own photographs of real machines at real customers (with permission).",
          "Quotations and documents that are exact, fast and in the customer’s language.",
          "Machines that arrive set up, with trained people — and a reply when something goes wrong.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 12 · Why KOLEEX ───────────────────────────────────────────────────── */

const REASONS: Array<[string, string, string]> = [
  ["Seventy years of the trade", "A family in garment machinery since 1955 — selling, repairing, advising.", "Since 1955 (ch. 4)"],
  ["At the source", "Headquarters in Taizhou, at the center of China’s sewing-machine industry.", "Taizhou since 2017 (ch. 7)"],
  ["One standard", "Every machine is a KOLEEX machine, checked the same way before it ships.", "Nameplate and checks (ch. 107–108)"],
  ["Complete lines", "Every category of machine, planned together for the product and the output.", "All categories (ch. 6)"],
  ["In your language", "A team that works in English, Arabic and Chinese — with customers, agents and factories.", "Our languages (ch. 7)"],
  ["Our own system", "Koleex Hub runs every quotation, contract and shipment — fast and consistent.", "Koleex Hub (ch. 42)"],
];

export function WhyKoleex() {
  return (
    <Chapter
      n={12}
      lead={<p>Six reasons a factory chooses KOLEEX — each one true, each one with its proof. Use them; never add a seventh that cannot be proved.</p>}
      toc={[
        { id: "reasons", title: "Six reasons" },
        { id: "reasons-use", title: "Using them" },
      ]}
    >
      <Section id="reasons" title="Six reasons">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {REASONS.map(([t, d, p]) => (
            <div key={t} className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
              <p className="text-[16px] font-bold text-[var(--text-primary)]">{t}</p>
              <p className="mt-1.5 flex-1 text-[13.5px] leading-6 text-[var(--text-secondary)]">{d}</p>
              <p className="mt-3 text-[12px] font-semibold text-[var(--text-dim)]">Proof · {p}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="reasons-use" title="Using them">
        <Bullets items={[
          "Choose the two or three that matter to this customer — never list all six in one ad.",
          "Lead with the reason, follow with the proof: “Since 1955. Three generations in garment machinery.”",
          <>Numbers only as they stand in this book, with their source (<Ref n={132} />).</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 13 · Competitive Landscape ────────────────────────────────────────── */

export function Competition() {
  return (
    <Chapter
      n={13}
      lead={
        <p>
          Our customers compare us with the best-known names in industrial sewing. This chapter tells our teams
          how to stand beside them — calmly, factually, and without ever naming them in public.
        </p>
      }
      toc={[
        { id: "internal-13", title: "Who this chapter is for" },
        { id: "compared", title: "Who we are compared with" },
        { id: "criteria", title: "What customers compare" },
        { id: "comp-rules", title: "Rules" },
      ]}
    >
      <Section id="internal-13" title="Who this chapter is for">
        <Note tone="warn">Internal chapter — for KOLEEX staff and agents. It is not part of the public copy of this book.</Note>
      </Section>

      <Section id="compared" title="Who we are compared with">
        <P>
          The owner sets our benchmark at the top of the market: <B>Juki</B> and <B>Brother</B> from Japan, and{" "}
          <B>Jack</B> from China. We position KOLEEX in their class — premium — and answer the comparison with the
          whole line, not with a price.
        </P>
      </Section>

      <Section id="criteria" title="What customers compare">
        <Table
          head={["Customer asks about", "How we answer"]}
          rows={[
            ["Price", "Not in public. In a quotation, as the cost of a working line — machines, setup, training and parts together"],
            ["Speed and specifications", "Our exact figures from Koleex Hub, on the spec sheet — never theirs"],
            ["Reliability", "The pre-shipment check, the nameplate, the warranty in the contract"],
            ["Parts and service", "Genuine parts by KOLEEX part number; support in the customer’s language"],
            ["Brand reputation", "Seventy years in the trade; customers who agreed to speak for us (ch. 131)"],
          ]}
        />
      </Section>

      <Section id="comp-rules" title="Rules">
        <Bullets items={[
          <>Competitors are never named in ads, posts, catalogs or on the booth (<Ref n={132} />).</>,
          "Never say anything negative about a competitor — to a customer, in writing or in a meeting.",
          "Comparisons are with our own machines: “20% quieter than our previous model”.",
          "Never use a competitor’s photos, model numbers or brochure text.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 14 · Audiences & Personas ─────────────────────────────────────────── */

const PERSONAS: Array<{ who: string; role: string; wants: string; say: string; where: string }> = [
  { who: "The factory owner", role: "Decides and pays", wants: "Output, reliability, a partner who answers the phone", say: "Complete lines that keep producing, backed by seventy years in the trade", where: "Meetings, LinkedIn, WhatsApp, the company profile" },
  { who: "The production manager", role: "Runs the lines", wants: "Machines that fit the product and the target, set up right", say: "The right machine for each operation, installed and adjusted", where: "Spec sheets, catalogs, fairs, videos" },
  { who: "The chief mechanic", role: "Keeps machines running", wants: "Parts, manuals, clear adjustments, quick answers", say: "Genuine parts, clear manuals, support in your language", where: "Manuals, WhatsApp, training days" },
  { who: "The dealer", role: "Resells to smaller factories", wants: "A brand that sells itself, stock, material, margins", say: "A premium brand with the material and support to sell it", where: "Agent material, WeChat, WhatsApp, fairs" },
  { who: "The buyer", role: "Compares offers", wants: "Exact quotations, terms and documents", say: "Exact quotations and documents, fast", where: "Quotations, email, documents" },
];

export function Audiences() {
  return (
    <Chapter
      n={14}
      lead={<p>We write for five people. Before any piece, decide which one it is for — the words, the channel and the proof follow from that choice.</p>}
      toc={[
        { id: "who", title: "Who we serve" },
        { id: "personas", title: "The five personas" },
        { id: "markets", title: "Markets and languages" },
      ]}
    >
      <Section id="who" title="Who we serve">
        <P>Our customers are <B>large garment factories</B> and <B>machine dealers</B>. Behind each account are several people with different needs — the personas below.</P>
      </Section>

      <Section id="personas" title="The five personas">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PERSONAS.map((p) => (
            <div key={p.who} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
              <p className="text-[16px] font-bold text-[var(--text-primary)]">{p.who}</p>
              <p className="text-[12px] text-[var(--text-dim)]">{p.role}</p>
              <dl className="mt-3 space-y-2 text-[13px] leading-5">
                {([["Wants", p.wants], ["We say", p.say], ["Reached through", p.where]] as Array<[string, string]>).map(([k, v]) => (
                  <div key={k}><dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)]">{k}</dt><dd className="text-[var(--text-secondary)]">{v}</dd></div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Section>

      <Section id="markets" title="Markets and languages">
        <Table
          head={["Market", "Language", "Register"]}
          rows={[
            ["Egypt", "Arabic, English", "Clear Modern Standard Arabic; Egyptian Arabic in chats and social (ch. 28)"],
            ["The Gulf and the Middle East", "Arabic, English", "Modern Standard Arabic, a little more formal"],
            ["China", "Chinese", "Simplified Chinese, professional (ch. 29)"],
            ["Everywhere else", "English", "International English (ch. 27)"],
          ]}
        />
      </Section>
    </Chapter>
  );
}

/* ── 15 · Brand Personality ────────────────────────────────────────────── */

function Scale({ trait, from, to, at, note }: { trait: string; from: string; to: string; at: number; note: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
      <p className="text-[17px] font-bold text-[var(--text-primary)]">{trait}</p>
      <div className="mt-4">
        <div className="relative h-[6px] rounded-full bg-[var(--bg-surface)]">
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${at}%`, background: "var(--text-primary)" }} />
          <span className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `calc(${at}% - 8px)`, background: "var(--text-primary)", boxShadow: "0 0 0 1px rgba(0,0,0,0.2)" }} />
        </div>
        <div className="mt-2 flex justify-between text-[11.5px] text-[var(--text-dim)]"><span>{from}</span><span>{to}</span></div>
      </div>
      <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">{note}</p>
    </div>
  );
}

export function Personality() {
  return (
    <Chapter
      n={15}
      lead={
        <p>
          If KOLEEX were a person, it would be an engineer who has run factories: confident without raising its
          voice, precise without being cold, modern without chasing trends.
        </p>
      }
      toc={[
        { id: "traits", title: "Three traits" },
        { id: "sliders", title: "Where we sit" },
        { id: "is-not", title: "Is and is not" },
      ]}
    >
      <Section id="traits" title="Three traits">
        <Specs rows={[
          ["Confident", "We know the trade and say so plainly. We never shout, boast or beg."],
          ["Precise", "Exact models, figures, dates and words — every time."],
          ["Modern", "Clean, current, digital — seventy years of experience in today’s form."],
        ]} />
      </Section>

      <Section id="sliders" title="Where we sit">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Scale trait="Voice" from="Quiet" to="Loud" at={30} note="Calm and sure. Never shouting, never whispering." />
          <Scale trait="Formality" from="Casual" to="Formal" at={62} note="Professional and warm; a little more formal in documents, a little lighter in chats." />
          <Scale trait="Detail" from="Vague" to="Technical" at={70} note="Specific and exact, then explained in plain words." />
          <Scale trait="Style" from="Classic" to="Trendy" at={48} note="Modern and lasting — no fashions that date in a year." />
        </div>
      </Section>

      <Section id="is-not" title="Is and is not">
        <Table
          head={["KOLEEX is", "KOLEEX is not"]}
          rows={[
            ["Confident", "Arrogant or loud"],
            ["Precise", "Cold or robotic"],
            ["Modern", "Trendy or gimmicky"],
            ["Premium", "Luxury or flashy"],
            ["Industrial", "Rough or careless"],
            ["Helpful", "Pushy"],
          ]}
        />
        <P>How the personality sounds in words is in <Ref n={22} />.</P>
      </Section>
    </Chapter>
  );
}

/* ── 16 · Brand Architecture ───────────────────────────────────────────── */

function Node({ title, sub, children, dark = false }: { title: ReactNode; sub: string; children?: ReactNode; dark?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex min-w-[150px] flex-col items-center gap-1 rounded-[6px] px-4 py-3 text-center" style={{ background: dark ? INK : "#FFFFFF", color: dark ? "#FFFFFF" : INK, boxShadow: dark ? "0 0 0 1px rgba(255,255,255,0.14)" : "0 0 0 1px rgba(0,0,0,0.14)" }}>
        {title}
        <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: dark ? "#98989D" : "#6E6E73" }}>{sub}</span>
      </div>
      {children}
    </div>
  );
}

export function BrandArchitecture() {
  return (
    <Chapter
      n={16}
      lead={
        <p>
          One group, one master brand, one product system. KOLEEX is a branded house: everything we sell and
          build carries the KOLEEX name first.
        </p>
      }
      toc={[
        { id: "structure", title: "The structure" },
        { id: "levels", title: "The levels" },
        { id: "arch-rules", title: "Rules" },
      ]}
    >
      <Section id="structure" title="The structure">
        <Stage bg="#F5F5F7" h="auto" pad={28}>
          <div className="flex w-full max-w-[600px] flex-col items-center">
            <Node dark title={<span className="text-[12px] font-bold tracking-[0.04em]">KOLEEX International Group</span>} sub="The group" />
            <span className="h-5 w-px bg-[#98989D]" />
            <div className="h-px w-[80%] bg-[#98989D]" />
            <div className="grid w-full grid-cols-3 gap-2">
              {[
                <Node key="k" title={<Wordmark color="#000000" width={76} />} sub="Master brand" />,
                <Node key="h" title={<HubMark variant="for-light" style={{ width: 96 }} />} sub="Our system" />,
                <Node key="g" title={<span className="text-[11px] font-semibold">Group companies</span>} sub="Own names" />,
              ].map((n, i) => <div key={i} className="flex flex-col items-center"><span className="h-5 w-px bg-[#98989D]" />{n}</div>)}
            </div>
            <div className="mt-2 grid w-full grid-cols-3 gap-2 text-center text-[10px] text-[#6E6E73]">
              <span>Machines · parts · service</span><span>Software for the business</span><span>Endorsed by the group</span>
            </div>
          </div>
        </Stage>
      </Section>

      <Section id="levels" title="The levels">
        <Table
          head={["Level", "Example", "How it is written"]}
          rows={[
            [<B key="a">Group</B>, "KOLEEX International Group", "Formal and corporate material (ch. 8)"],
            [<B key="a">Master brand</B>, "KOLEEX", "The logo; “KOLEEX” in text"],
            [<B key="a">Product type</B>, "Overlock machine", "Plain words, never a brand name"],
            [<B key="a">Series</B>, "KOLEEX XSO-7800", "Only when two or more models share it (ch. 17)"],
            [<B key="a">Named series</B>, "KOLEEX | NEXO", "An approved series name with its own mark and colours — NEXO, the LS lockstitch series"],
            [<B key="a">Model</B>, "KOLEEX XSO-7800-4", "The model code from Koleex Hub"],
            [<B key="a">Software</B>, "Koleex Hub", "Its own mark (ch. 42)"],
          ]}
        />
      </Section>

      <Section id="arch-rules" title="Rules">
        <Rule why="Every product that carries the KOLEEX name first adds to one brand. A product with its own name builds a brand we then have to pay for twice.">
          KOLEEX comes first: “KOLEEX XSO-7800-4”, never “XSO-7800-4 by KOLEEX”. A product gets a name of its own
          only as an approved series — today, NEXO.
        </Rule>
        <Bullets items={[
          "New sub-brands and series names are not created without the Founder & CEO’s approval.",
          <>A named series is always shown after KOLEEX, in the context header: <B>KOLEEX | NEXO</B> (<Ref n={43} />).</>,
          "A named series keeps its own colours. KOLEEX next to it stays black or white — the series colour never touches the KOLEEX logo.",
          "Koleex Hub is the one product with its own mark, because it is software and has its own interface.",
          <>Group companies keep their names; they are endorsed, never merged into KOLEEX (<Ref n={8} />).</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 17 · Product Lines & Model Naming ─────────────────────────────────── */

function CodePart({ seg, label, tone }: { seg: string; label: string; tone: "type" | "series" | "feature" }) {
  const bg = tone === "type" ? "#FFFFFF" : tone === "series" ? "#1D1D1F" : "#38383A";
  const fg = tone === "type" ? INK : "#FFFFFF";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="rounded-[6px] px-2.5 py-1 font-mono text-[18px] font-semibold" style={{ background: bg, color: fg, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.16)" }}>{seg}</span>
      <span className="text-[10px] text-[#98989D]">{label}</span>
    </div>
  );
}

export function ProductNaming() {
  return (
    <Chapter
      n={17}
      lead={
        <p>
          Every KOLEEX machine has one model code, made by Koleex Hub from our product coding system. The code is
          the name. This chapter shows how to read it and how to write it — everywhere the same.
        </p>
      }
      toc={[
        { id: "anatomy", title: "Anatomy of a model code" },
        { id: "writing", title: "Writing it" },
        { id: "naming-examples", title: "Right and wrong" },
        { id: "naming-rules", title: "Rules" },
      ]}
    >
      <Section id="anatomy" title="Anatomy of a model code">
        <Stage bg="#000000" h="auto" pad={28}>
          <div className="flex flex-wrap items-start justify-center gap-1.5">
            <CodePart seg="XSO" label="Type: overlock" tone="type" />
            <span className="pt-1.5 font-mono text-[18px] text-[#6E6E73]">-</span>
            <CodePart seg="7800" label="Series" tone="series" />
            <span className="pt-1.5 font-mono text-[18px] text-[#6E6E73]">-</span>
            <CodePart seg="4" label="Model: 4-thread" tone="feature" />
          </div>
        </Stage>
        <Table
          head={["Part", "What it is", "Examples"]}
          rows={[
            [<B key="a">Type</B>, "The product type, from the coding system", <span key="b" className="font-mono">XSL lockstitch · XSO overlock · XSI interlock · XSC chainstitch · XA automatic systems</span>],
            [<B key="a">Series</B>, "A platform shared by two or more models", <span key="b" className="font-mono">XSO-7800</span>],
            [<B key="a">Model</B>, "The buyable model — its series plus feature tokens", <span key="b" className="font-mono">XSO-7800-4 · XSL-L9 · XSL-L9-T</span>],
          ]}
        />
        <P>
          The codes, prefixes and tokens are governed in Koleex Hub: Knowledge → Product Coding System. This book never
          changes them; it only shows how to write them.
        </P>
      </Section>

      <Section id="writing" title="Writing it">
        <Specs rows={[
          ["In headlines", "KOLEEX + model code: “KOLEEX XSO-7800-4”"],
          ["In text", "Model code + plain description: “the XSO-7800-4 4-thread overlock”"],
          ["Type", "Capitals and hyphens exactly as in Koleex Hub; monospace in tables and documents"],
          ["Arabic and Chinese", "The code stays in Latin letters, isolated left-to-right inside Arabic text (ch. 54)"],
        ]} />
      </Section>

      <Section id="naming-examples" title="Right and wrong">
        <Examples cols={2}>
          <Example tone="do" caption="Brand, code, plain description." bg="#FFFFFF" h={130}>
            <div className="text-[#1D1D1F]">
              <p className="text-[20px] font-bold">KOLEEX <span className="font-mono">XSO-7800-4</span></p>
              <p className="text-[12px] text-[#6E6E73]">4-thread overlock</p>
            </div>
          </Example>
          <Example tone="dont" caption="Invented names, lower case, spaces, a supplier’s code." bg="#FFFFFF" h={130}>
            <div className="space-y-1 text-[#1D1D1F]">
              <p className="text-[15px] font-bold italic">SuperLock Pro 4000 by Koleex</p>
              <p className="font-mono text-[12px]">xso 7800 4 · “same as model 747”</p>
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="naming-rules" title="Rules">
        <Bullets items={[
          "The model code comes from Koleex Hub — never typed from memory, never made up.",
          "No marketing names for machines (“SuperLock”, “Pro”, “Max”) — the code and a plain description are enough.",
          "Never a supplier’s model number, even in brackets or as “equivalent to”.",
          <>A trimmer or feature variant is its own model (<Code>XSL-L9-T</Code>), not a footnote to another.</>,
        ]} />
      </Section>
    </Chapter>
  );
}
