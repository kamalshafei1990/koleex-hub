"use client";

/* Chapters 1–3: Welcome, How to Use This Book, The Brand at a Glance. */

import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import { BOOK_CHAPTERS, BOOK_PARTS, BOOK_VERSION } from "@/lib/brand-book/chapters";
import { BRAND_COLORS, HUB_GRADIENT } from "@/lib/brand-book/tokens";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Sub, Table,
} from "../kit";
import { HubMark, MonogramTile, Wordmark } from "../marks";

/* ── 01 · Welcome ──────────────────────────────────────────────────────── */

export function Welcome() {
  return (
    <Chapter
      n={1}
      lead={
        <p>
          This is the KOLEEX brand book: how our name looks, sounds and behaves — on a machine, a
          quotation, a post, a booth or a screen. If you are using the KOLEEX name for anything, for any
          job, this book is your reference.
        </p>
      }
      toc={[
        { id: "foreword", title: "From the founder" },
        { id: "what-it-covers", title: "What this book covers" },
        { id: "who-its-for", title: "Who it is for" },
        { id: "five-rules", title: "The five rules that never bend" },
        { id: "approvals", title: "Approvals & questions" },
      ]}
    >
      <Section id="foreword" title="From the founder">
        <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-6 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed portrait file shown at its own ratio */}
          <img
            src="/brand/book/founder-kamal-shafei.webp"
            alt="Kamal Shafei, Founder & CEO of KOLEEX"
            width={720}
            height={900}
            className="w-full max-w-[240px] rounded-2xl object-cover grayscale"
            loading="lazy"
          />
          <div className="space-y-4">
            <P>
              Our story began in 1955, in a small sewing-machine shop in Cairo. Three generations later,
              the name on our machines travels to more than seventy countries — but the promise behind it
              has not changed: precise machines, honest advice, and people who stand behind what they sell.
            </P>
            <P>
              A brand is that promise made visible. Every catalog, every quotation, every post and every
              booth either keeps it or spends it. This book exists so that everyone who works with the
              KOLEEX name — our teams in Taizhou and Cairo, our agents, our printers and our designers —
              keeps it the same way, everywhere.
            </P>
            <P>Use it. Question it. And when something is missing, tell us — the book grows with the company.</P>
            <div className="pt-2">
              <p className="text-[15px] font-semibold text-[var(--text-primary)]">Kamal Shafei</p>
              <p className="text-[13px] text-[var(--text-dim)]">Founder & CEO, KOLEEX International Group</p>
            </div>
          </div>
        </div>
      </Section>

      <Section id="what-it-covers" title="What this book covers">
        <P>
          KOLEEX has two visual layers. They share one logo and one set of colors, and they must never be
          confused:
        </P>
        <Examples cols={2}>
          <Example caption={<><B>KOLEEX — the company brand (Core).</B> Flat, black and white, precise. Every document, product, catalog, post, booth and sign.</>} bg="#FFFFFF" h={170}>
            <Wordmark color="#000000" width="62%" />
          </Example>
          <Example caption={<><B>Koleex Hub — our platform.</B> Its own mark and its own interface skin (Aurora). Used for the software and for marketing about it.</>} bg="#0A0A0A" h={170}>
            <HubMark variant="for-dark" style={{ width: "66%" }} />
          </Example>
        </Examples>
        <P>
          The book has {BOOK_PARTS.length} parts and {BOOK_CHAPTERS.length} chapters — from the story and
          the voice, through the logo, color and type, to documents, social media, packaging, exhibitions,
          uniforms, partners and the files you need. Chapters arrive in phases; the contents show which are
          ready.
        </P>
      </Section>

      <Section id="who-its-for" title="Who it is for">
        <Table
          head={["You are…", "Start with"]}
          rows={[
            [<B key="a">A designer or an agency</B>, <span key="b"><Ref n={3} />, then Part 3 (<Ref n={36} /> onwards) and <Ref n={136} /></span>],
            [<B key="a">A printer or a producer</B>, <span key="b"><Ref n={38} />, <Ref n={39} />, <Ref n={48} />, <Ref n={136} /></span>],
            [<B key="a">In marketing</B>, <span key="b"><Ref n={3} />, <Ref n={47} />, then Parts 2 and 4</span>],
            [<B key="a">In sales</B>, <span key="b"><Ref n={3} />, <Ref n={43} />, then Part 5 (documents)</span>],
            [<B key="a">An agent or a distributor</B>, <span key="b"><Ref n={3} />, <Ref n={44} />, then Part 9</span>],
            [<B key="a">Anyone at KOLEEX</B>, <span key="b"><Ref n={3} /> — the whole brand on one page</span>],
          ]}
        />
      </Section>

      <Section id="five-rules" title="The five rules that never bend">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ["1", "The logo is a file, not a font.", "Always the official artwork, in black or white. Never typed, traced, redrawn or recolored.", 36],
            ["2", "Black, white — then Hub Blue.", "Black and white carry the brand. Hub Blue is the accent, used as a touch, never as a flood.", 45],
            ["3", "Inter, with our Arabic and Chinese families.", "One typeface system in every language, on screen and on paper.", 50],
            ["4", "Our own images, flat and real.", "Our own photographs of our own machines and people. 2D graphics — no 3D, no stock, no borrowed product photos.", 63],
            ["5", "Day first. Legal name in full.", "Dates are always DD/MM/YYYY. Legal documents carry the registered company name, exactly.", 26],
          ].map(([num, title, body, ref]) => (
            <div key={num as string} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
              <span className="text-[28px] font-bold leading-none text-[#567FB2] tabular-nums">{num}</span>
              <p className="mt-3 text-[15.5px] font-semibold text-[var(--text-primary)]">{title}</p>
              <p className="mt-1.5 text-[13.5px] leading-6 text-[var(--text-secondary)]">{body}</p>
              <p className="mt-3 text-[12.5px]"><Ref n={ref as number} /></p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="approvals" title="Approvals & questions">
        <Rule why="One person seeing everything is how a brand stays one brand across three countries and three languages.">
          Anything that carries the KOLEEX name and leaves the company — printed, posted, shipped or
          presented — is approved before it goes out.
        </Rule>
        <Specs
          title="Who approves"
          rows={[
            ["First review", "Marketing Manager"],
            ["Final approval", "Founder & CEO"],
            ["Questions", <span key="q" className="font-mono">{KOLEEX_COMPANY.email}</span>],
          ]}
        />
        <P>The full approval workflow — what needs approval, how to send it and how long it takes — is in <Ref n={134} />.</P>
      </Section>
    </Chapter>
  );
}

/* ── 02 · How to Use This Book ─────────────────────────────────────────── */

export function HowToUse() {
  return (
    <Chapter
      n={2}
      lead={
        <p>
          Every chapter follows the same pattern, so you always know where to look: the rule, the reason,
          the exact numbers, examples of right and wrong — and the file to download.
        </p>
      }
      toc={[
        { id: "structure", title: "How the book is organized" },
        { id: "anatomy", title: "Anatomy of a page" },
        { id: "symbols", title: "Signs used in this book" },
        { id: "languages", title: "Languages" },
        { id: "versions", title: "Versions" },
        { id: "not-covered", title: "When your case is not here" },
      ]}
    >
      <Section id="structure" title="How the book is organized">
        <P>Ten parts, in the order a brand is built — from what we stand for, to how it looks, to every place it appears.</P>
        <Table
          head={["Part", "Chapters", "Covers"]}
          rows={BOOK_PARTS.map((p) => [
            <B key="p">{p.n} · {p.title.en}</B>,
            <span key="c" className="font-mono text-[12.5px]">{String(p.from).padStart(2, "0")}–{String(p.to).padStart(2, "0")}</span>,
            <span key="d">{PART_BLURB[p.id]}</span>,
          ])}
        />
      </Section>

      <Section id="anatomy" title="Anatomy of a page">
        <P>Each section of a chapter is built from the same five parts. Here they are, live:</P>
        <Sub title="1 · The rule, and why">
          <Rule why="The reason is always given, so that you can apply the rule to a case the book does not show.">
            The rule itself, in one sentence.
          </Rule>
        </Sub>
        <Sub title="2 · The exact numbers">
          <Specs rows={[["Measurement", "The value, in mm, px, pt or HEX"], ["Minimum", "The smallest allowed value"]]} />
        </Sub>
        <Sub title="3 · Right and wrong">
          <Examples cols={2}>
            <Example tone="do" caption="Green: this is how it is done." bg="#FFFFFF" h={120}>
              <Wordmark color="#000000" width="55%" />
            </Example>
            <Example tone="dont" caption="Red: a mistake we have seen — do not repeat it." bg="#FFFFFF" h={120}>
              <Wordmark color="#000000" width="55%" style={{ transform: "scaleX(1.4)" }} />
            </Example>
          </Examples>
        </Sub>
        <Sub title="4 · Notes">
          <Note>Blue notes add context. <B>Amber notes</B> warn about a common trap.</Note>
        </Sub>
        <Sub title="5 · Downloads">
          <P>Where a chapter has files, the download list is at the end of the chapter and in <Ref n={136} />.</P>
        </Sub>
      </Section>

      <Section id="symbols" title="Signs used in this book">
        <Table
          head={["Sign", "Meaning"]}
          rows={[
            [<span key="s" className="rounded-full px-2 py-[1px] text-[11px] font-semibold text-white" style={{ background: "#059669" }}>Do</span>, "The correct way. Copy it."],
            [<span key="s" className="rounded-full px-2 py-[1px] text-[11px] font-semibold text-white" style={{ background: "#DC2626" }}>Don’t</span>, "A mistake. Never publish anything that looks like this."],
            [<B key="s">x</B>, "The height of the logo — the unit every logo measurement is made from."],
            [<span key="s" className="text-[var(--text-ghost)]">Soon</span>, "In the contents: a chapter that is planned but not written yet."],
            [<span key="s" className="font-mono">DD/MM/YYYY</span>, "Every date in this book, and in everything KOLEEX publishes."],
          ]}
        />
      </Section>

      <Section id="languages" title="Languages">
        <Bullets items={[
          <>The menus and chapter titles are in <B>English, 中文 and العربية</B>.</>,
          <>Chapter texts are in <B>English first</B>; Chinese and Arabic versions follow in a later phase.</>,
          <>Legal names, model codes and file names are never translated — they are copied exactly as written.</>,
        ]} />
      </Section>

      <Section id="versions" title="Versions">
        <Specs rows={[
          ["This version", `${BOOK_VERSION.label} — ${BOOK_VERSION.date}`],
          ["In this phase", "Welcome, how to use, the brand at a glance, the logo, the K monogram, the Koleex Hub mark, lockups, co-branding, color, typography and downloads"],
          ["Next", "Grid, graphics, icons, photography, video and motion; then documents, marketing, product, places, people and partners"],
        ]} />
        <Note>Where this book and older brand material disagree, <B>this book is the reference</B>.</Note>
      </Section>

      <Section id="not-covered" title="When your case is not here">
        <Bullets items={[
          <>Look for the closest chapter and apply its <B>reason</B>, not just its example.</>,
          <>Never improvise with the logo, the colors or the legal name — those rules have no exceptions.</>,
          <>Ask before you publish: the Marketing Manager answers, and the answer is added to the book.</>,
        ]} />
      </Section>
    </Chapter>
  );
}

const PART_BLURB: Record<string, string> = {
  foundation: "Story, mission, values, positioning, personality, brand architecture",
  verbal: "The name, tagline, voice, writing rules in three languages, key messages, glossary",
  visual: "Logo, K monogram, Hub mark, color, typography, grid, icons, photography, video, motion",
  digital: "Website, the Hub interface, email, every social platform, ads, presentations",
  print: "Business cards, letterhead, every business document, catalogs, brochures, posters",
  product: "Machine branding, nameplates, labels, cartons, shipping marks, manuals",
  places: "Exhibition booths, CISMA, offices, showroom, warehouse, vehicles, events",
  people: "Uniforms, merchandise, seasonal gifts, hiring, staff and founder on social media",
  partners: "Agents and distributors, dealer signage, suppliers, testimonials",
  governance: "Legal and claims, certification marks, approvals, file naming, downloads, templates",
};

/* ── 03 · The Brand at a Glance ────────────────────────────────────────── */

export function AtAGlance() {
  const hub = BRAND_COLORS.filter((c) => c.group === "hub");
  return (
    <Chapter
      n={3}
      lead={<p>The whole identity on one page. If you only read one chapter, read this one.</p>}
      toc={[
        { id: "logo", title: "Logo" },
        { id: "color", title: "Color" },
        { id: "type", title: "Typography" },
        { id: "voice", title: "Voice" },
        { id: "words", title: "Name, descriptor, tagline" },
        { id: "images", title: "Images" },
        { id: "details", title: "Details that matter" },
      ]}
    >
      <Section id="logo" title="Logo">
        <Examples cols={2}>
          <Example tone="do" caption="Black logo on light backgrounds." bg="#FFFFFF" h={150}><Wordmark color="#000000" width="60%" /></Example>
          <Example tone="do" caption="White logo on dark backgrounds." bg="#0A0A0A" h={150}><Wordmark color="#FFFFFF" width="60%" /></Example>
        </Examples>
        <div className="flex flex-wrap items-center gap-4">
          <MonogramTile size={64} />
          <MonogramTile size={64} dark={false} border />
          <p className="text-[13.5px] leading-6 text-[var(--text-secondary)] max-w-[52ch]">
            The <B>K monogram</B> — the K of the logo — for avatars, favicons and spaces too small for the
            full logo. <Ref n={41} />
          </p>
        </div>
        <P>Clear space on every side: the height of the logo. Minimum width: 100 px on screen, 25 mm in print. <Ref n={37} /> · <Ref n={38} /></P>
      </Section>

      <Section id="color" title="Color">
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
          <div className="grid grid-cols-3" style={{ height: 96 }}>
            <div style={{ background: "#000000" }} />
            <div style={{ background: "#FFFFFF" }} />
            <div style={{ background: HUB_GRADIENT.css }} />
          </div>
          <div className="grid grid-cols-4">
            {hub.map((c) => <div key={c.id} style={{ background: c.hex, height: 28 }} />)}
          </div>
        </div>
        <P>
          <B>Black → white → Hub Blue.</B> Black and white carry the brand; Hub Blue is the accent —
          about 5% of any layout. Status green, amber and red appear only to show a state. <Ref n={45} /> · <Ref n={47} />
        </P>
      </Section>

      <Section id="type" title="Typography">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="w-full space-y-2 text-[#0A0A0A]">
            <p className="text-[30px] font-bold tracking-tight leading-tight">Industrial Garment Machinery</p>
            <p dir="rtl" lang="ar" className="text-[24px] font-bold" style={{ fontFamily: "'Helvetica Neue','Geeza Pro','Noto Naskh Arabic','Segoe UI',Tahoma,sans-serif" }}>ماكينات صناعية للملابس</p>
            <p lang="zh-Hans" className="text-[24px] font-semibold" style={{ fontFamily: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC',sans-serif" }}>工业服装机械</p>
            <p className="font-mono text-[13px] text-[#4B5563]">KL-QU-12349 · USD 12,500.00 · 27/09/2026</p>
          </div>
        </Stage>
        <P><B>Inter</B> for Latin text, our Arabic and Chinese families beside it, and a monospace for numbers and codes. <Ref n={50} /></P>
      </Section>

      <Section id="voice" title="Voice">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ["Confident", "We say what the machine does and stand behind it. No hype, no superlatives."],
            ["Precise", "Numbers, specs, models and dates — right the first time, in the same format every time."],
            ["Modern", "Clean, current, digital-first. Seventy years of heritage, told without nostalgia."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
              <p className="text-[17px] font-bold text-[var(--text-primary)]">{t}</p>
              <p className="mt-1.5 text-[13.5px] leading-6 text-[var(--text-secondary)]">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="words" title="Name, descriptor, tagline">
        <Specs rows={[
          ["Brand name", "KOLEEX"],
          ["Group name", "KOLEEX International Group"],
          ["Legal name (EN)", <span key="en" className="font-mono text-[12.5px]">{KOLEEX_COMPANY.en}</span>],
          ["Legal name (中文)", <span key="zh" lang="zh-Hans">{KOLEEX_COMPANY.zh}</span>],
          ["Descriptor", "INDUSTRIAL GARMENT MACHINERY"],
          ["Tagline (current)", <span key="t">{KOLEEX_COMPANY.tagline} <span className="text-[var(--text-dim)]">— a new tagline is in preparation (<Ref n={20} />)</span></span>],
        ]} />
      </Section>

      <Section id="images" title="Images">
        <Bullets items={[
          <><B>Our own photographs</B> of our own machines, factories, teams and events.</>,
          <><B>Flat 2D graphics.</B> No 3D renders, no bevels, no metallic effects.</>,
          <><B>No stock photos</B> presented as KOLEEX, and never another company’s products as ours.</>,
          <>AI images only for abstract backgrounds — never for machines or people. <Ref n={69} /></>,
        ]} />
      </Section>

      <Section id="details" title="Details that matter">
        <Specs rows={[
          ["Dates", "DD/MM/YYYY — 27/09/2026"],
          ["Numbers & codes", "Monospace, tabular: KL-QU-12349 · USD 12,500.00"],
          ["Documents", "The 210 × 270 mm house sheet — fits A4 and US Letter"],
          ["Contact line", <span key="c" className="font-mono text-[12.5px]">{KOLEEX_COMPANY.email} · {KOLEEX_COMPANY.web}</span>],
        ]} />
      </Section>
    </Chapter>
  );
}
