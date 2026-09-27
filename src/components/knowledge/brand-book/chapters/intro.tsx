"use client";

/* Chapters 1–3: Welcome, How to Use This Book, The Brand at a Glance.

   Rebuilt 27/09/2026 on the owner's Apple-style identity: black and white,
   silver as the premium material, Hub Blue for links and buttons only, the
   full logo everywhere (no monogram), Inter / Noto Sans Arabic / Noto Sans
   SC, the machine as the hero, few words and big type. */

import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import { BOOK_PARTS, BOOK_VERSION } from "@/lib/brand-book/chapters";
import { PROPORTIONS, SILVER } from "@/lib/brand-book/tokens";
import {
  AR_FONT, B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Sub, Table, ZH_FONT,
} from "../kit";
import { LogoTile, Wordmark } from "../marks";
import { MachineShot } from "../mockups";

const FOUNDER_PHOTO = "/brand/book/founder-kamal-shafei.webp";

/** A silver headline on black. */
function Silver({ children, size }: { children: string; size: number }) {
  return (
    <span
      className="font-semibold tracking-[-0.03em]"
      style={{ fontSize: size, lineHeight: 1.04, backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
    >
      {children}
    </span>
  );
}

const RULES: Array<[string, string, number]> = [
  ["The logo is a file, not a font.", "Always the official artwork, black or white. Never typed, redrawn, recolored — never silver.", 36],
  ["Black and white. Silver shines. Hub Blue acts.", "Silver is the premium material. Hub Blue is for links and buttons only.", 45],
  ["The machine is the hero.", "Our own studio photographs — black first, white second. Never stock, never borrowed.", 63],
  ["Fewer words. Bigger type.", "One message per piece. Say it in three words if you can.", 51],
  ["Nothing leaves without approval.", "Marketing Manager first, then the Founder & CEO.", 134],
];

/* ── 01 · Welcome ──────────────────────────────────────────────────────── */

export function Welcome() {
  return (
    <Chapter
      n={1}
      lead={<p>How KOLEEX looks, speaks and behaves — for everyone who uses our name, for any job.</p>}
      toc={[
        { id: "one-brand", title: "One brand" },
        { id: "foreword", title: "From the founder" },
        { id: "five-rules", title: "Five rules" },
        { id: "start", title: "Start where you work" },
      ]}
    >
      <Section id="one-brand" title="One brand. Everywhere.">
        <Stage bg="#000000" h="auto" pad={56}>
          <div className="flex w-full flex-col items-center text-center">
            <Wordmark color="#FFFFFF" width={170} />
            <p className="mt-10"><Silver size={64}>Stitch. Perfected.</Silver></p>
            <p className="mx-auto mt-5 max-w-[42ch] text-[19px] leading-[1.45] text-[#A1A1A6]">One logo, one palette, one voice — on a machine in Cairo, a quotation from Taizhou, a post in any language.</p>
            <div className="mt-10 w-full max-w-[440px]"><MachineShot w="100%" /></div>
          </div>
        </Stage>
      </Section>

      <Section id="foreword" title="From the founder">
        <div className="grid grid-cols-1 items-center gap-8 rounded-[28px] bg-[var(--bg-secondary)] p-6 md:grid-cols-[220px_minmax(0,1fr)] md:p-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed portrait file shown at its own ratio */}
          <img src={FOUNDER_PHOTO} alt="Kamal Shafei, Founder & CEO of KOLEEX" width={720} height={900} className="w-full max-w-[220px] rounded-[20px] object-cover grayscale" loading="lazy" />
          <div>
            <p className="text-[26px] md:text-[32px] font-semibold leading-[1.18] tracking-[-0.025em] text-[var(--text-primary)] [text-wrap:balance]">
              “Precise machines. Honest advice. People who stand behind what they sell.”
            </p>
            <p className="mt-5 max-w-[56ch] text-[17px] leading-[1.6] text-[var(--text-secondary)]">
              Since a small shop in Cairo in 1955, that promise has not changed. This book keeps it the same — in every
              country, every language, every piece. Use it, question it, and tell us what is missing.
            </p>
            <p className="mt-6 text-[15px] font-semibold text-[var(--text-primary)]">Kamal Shafei</p>
            <p className="text-[13px] text-[var(--text-dim)]">Founder &amp; CEO, KOLEEX International Group</p>
          </div>
        </div>
      </Section>

      <Section id="five-rules" title="Five rules. No exceptions.">
        <div className="rounded-[28px] bg-[var(--bg-secondary)] px-6 py-4 md:px-10">
          {RULES.map(([t, d, ref], i) => (
            <div key={t} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-[var(--border-faint)] py-6 last:border-0">
              <span className="text-[30px] font-semibold leading-none tabular-nums text-[var(--text-ghost)]">{i + 1}</span>
              <div>
                <p className="text-[19px] md:text-[21px] font-semibold tracking-[-0.015em] text-[var(--text-primary)]">{t}</p>
                <p className="mt-1.5 text-[15px] leading-[1.5] text-[var(--text-dim)]">{d} <Ref n={ref} /></p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="start" title="Start where you work.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {([["Designers", 36], ["Printers", 48], ["Marketing", 22], ["Sales", 94], ["Agents", 128]] as Array<[string, number]>).map(([who, n]) => (
            <div key={who} className="rounded-[20px] bg-[var(--bg-secondary)] px-5 py-4">
              <p className="text-[16px] font-semibold text-[var(--text-primary)]">{who}</p>
              <p className="mt-1 text-[13px]"><Ref n={n} /></p>
            </div>
          ))}
        </div>
        <Specs
          title="Questions and approvals"
          rows={[
            ["First review", "Marketing Manager"],
            ["Final approval", "Founder & CEO"],
            ["Write to", <span key="q" className="font-mono">{KOLEEX_COMPANY.email}</span>],
          ]}
        />
      </Section>
    </Chapter>
  );
}

/* ── 02 · How to Use This Book ─────────────────────────────────────────── */

export function HowToUse() {
  return (
    <Chapter
      n={2}
      lead={<p>Every chapter reads the same way: the rule, the reason, the exact numbers, right and wrong — and the files.</p>}
      toc={[
        { id: "structure", title: "Ten parts" },
        { id: "anatomy", title: "Anatomy of a page" },
        { id: "languages", title: "Languages" },
        { id: "versions", title: "Versions" },
        { id: "not-covered", title: "When your case is not here" },
      ]}
    >
      <Section id="structure" title="Ten parts">
        <Table
          head={["Part", "Chapters", "Covers"]}
          rows={BOOK_PARTS.map((p) => [
            <B key="p">{p.n} · {p.title.en}</B>,
            <span key="c" className="font-mono text-[13px]">{String(p.from).padStart(2, "0")}–{String(p.to).padStart(2, "0")}</span>,
            <span key="d">{p.blurb}</span>,
          ])}
        />
      </Section>

      <Section id="anatomy" title="Anatomy of a page">
        <Sub title="The rule, and why">
          <Rule why="The reason is always given, so that you can apply the rule to a case the book does not show.">
            The rule itself, in one sentence.
          </Rule>
        </Sub>
        <Sub title="The exact numbers">
          <Specs rows={[["Measurement", "The value, in mm, px, pt or HEX"], ["Minimum", "The smallest allowed value"]]} />
        </Sub>
        <Sub title="Right and wrong">
          <Examples cols={2}>
            <Example tone="do" caption="This is how it is done." bg="#000000" h={140}><Wordmark color="#FFFFFF" width="50%" /></Example>
            <Example tone="dont" caption="A mistake — never publish anything like it." bg="#000000" h={140}><Wordmark color="#FFFFFF" width="50%" style={{ transform: "scaleX(1.4)" }} /></Example>
          </Examples>
        </Sub>
        <Sub title="Notes and files">
          <Note>Notes add context; amber notes warn about a common trap. Files are at the end of a chapter and in <Ref n={136} />.</Note>
        </Sub>
      </Section>

      <Section id="languages" title="Languages">
        <Bullets items={[
          <>Menus and chapter titles are in <B>English, 中文 and العربية</B>.</>,
          <>Chapter texts are in <B>English first</B>; Chinese and Arabic versions follow.</>,
          <>Legal names, model codes and file names are never translated.</>,
        ]} />
      </Section>

      <Section id="versions" title="Versions">
        <Specs rows={[
          ["This version", `${BOOK_VERSION.label} — ${BOOK_VERSION.date}`],
          ["What changed", "The Apple-style identity: silver, Hub Blue for action only, the full logo everywhere, new typefaces and type scale"],
        ]} />
        <Note>Where this book and older brand material disagree, <B>this book is the reference</B> (<Ref n={140} />).</Note>
      </Section>

      <Section id="not-covered" title="When your case is not here">
        <Bullets items={[
          <>Find the closest chapter and apply its <B>reason</B>, not just its example.</>,
          <>Never improvise with the logo, the colors or the legal name.</>,
          <>Ask the Marketing Manager before you publish — the answer is added to the book.</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 03 · The Brand at a Glance ────────────────────────────────────────── */

export function AtAGlance() {
  return (
    <Chapter
      n={3}
      lead={<p>The whole identity on one page. If you read only one chapter, read this one.</p>}
      toc={[
        { id: "logo", title: "Logo" },
        { id: "color", title: "Color" },
        { id: "type", title: "Type" },
        { id: "images", title: "Images" },
        { id: "motion-sound", title: "Motion and sound" },
        { id: "words", title: "Words" },
        { id: "details", title: "Details" },
      ]}
    >
      <Section id="logo" title="Logo">
        <Examples cols={2}>
          <Example tone="do" caption="White on black — the primary." bg="#000000" h={170}><Wordmark color="#FFFFFF" width="58%" /></Example>
          <Example tone="do" caption="Black on white." bg="#FFFFFF" h={170}><Wordmark color="#000000" width="58%" /></Example>
        </Examples>
        <div className="flex flex-wrap items-center gap-5">
          <LogoTile size={72} round />
          <LogoTile size={72} />
          <p className="max-w-[52ch] text-[15px] leading-[1.55] text-[var(--text-secondary)]">
            Small spaces use the <B>full logo</B>, fitted to 70% of the tile — there is no monogram. <Ref n={41} />
          </p>
        </div>
      </Section>

      <Section id="color" title="Color">
        <div className="overflow-hidden rounded-[28px] ring-1 ring-black/5 dark:ring-white/15">
          <div className="flex h-[140px]">
            {PROPORTIONS.map((p) => (
              <div key={p.id} className="flex items-end p-4" style={{ flex: p.pct, background: p.id === "base" ? "#000000" : p.id === "neutral" ? "#F5F5F7" : p.id === "silver" ? SILVER.css : "#567FB2" }}>
                {p.pct >= 20 && <span className="text-[13px] font-semibold" style={{ color: p.id === "base" ? "#FFFFFF" : "#1D1D1F" }}>{p.label} {p.pct}%</span>}
              </div>
            ))}
          </div>
        </div>
        <P><B>Black and white</B> carry every piece. <B>Silver</B> is the premium material. <B>Hub Blue</B> is for links and buttons only. Every piece exists in a black and a white version. <Ref n={45} /> <Ref n={47} /></P>
      </Section>

      <Section id="type" title="Type">
        <Stage bg="#FFFFFF" h="auto" pad={36}>
          <div className="w-full space-y-3 text-[#1D1D1F]">
            <p className="text-[44px] font-semibold leading-[1.05] tracking-[-0.03em]">Industrial Garment Machinery</p>
            <p dir="rtl" lang="ar" className="text-[34px] font-semibold" style={AR_FONT}>ماكينات صناعية للملابس</p>
            <p lang="zh-Hans" className="text-[34px] font-semibold" style={ZH_FONT}>工业服装机械</p>
            <p className="font-mono text-[14px] text-[#6E6E73]">XSO-7800-4 · KL-QU-12349 · 27/09/2026</p>
          </div>
        </Stage>
        <P><B>Inter</B>, <B>Noto Sans Arabic</B>, <B>Noto Sans SC</B> — few sizes, big jumps. <Ref n={50} /></P>
      </Section>

      <Section id="images" title="Images">
        <Examples cols={2}>
          <Example tone="do" caption="Black first — heroes, ads, launches." bg="#000000" h={200}><MachineShot w={250} label={false} /></Example>
          <Example tone="do" caption="White second — catalogs and the website." bg="#FFFFFF" h={200}><MachineShot w={250} dark={false} label={false} /></Example>
        </Examples>
        <P>Our own studio photographs; people and factories in cool, calm color; AI only for abstract backgrounds. <Ref n={63} /></P>
      </Section>

      <Section id="motion-sound" title="Motion and sound">
        <Specs rows={[
          ["Motion", "Slow and premium — a slow orbit around the machine, close-ups, one word on screen (ch. 70)"],
          ["Logo animation", "Focus — the logo arrives from a soft blur, 1.8 s (ch. 73)"],
          ["The KOLEEX melody", "Five notes, D E G A → D — the sound of the brand (ch. 74)"],
        ]} />
      </Section>

      <Section id="words" title="Words">
        <Specs rows={[
          ["Brand name", "KOLEEX"],
          ["Group name", "KOLEEX International Group"],
          ["Legal name", <span key="en" className="font-mono text-[13px]">{KOLEEX_COMPANY.en}</span>],
          ["Descriptor", "Industrial Garment Machinery"],
          ["Lockup line", "KOLEEX INTERNATIONAL GROUP — under the logo, light, the logo's width (ch. 43)"],
          ["Tagline", <span key="t">{KOLEEX_COMPANY.tagline} <span className="text-[var(--text-dim)]">— a new one is being chosen (<Ref n={20} />)</span></span>],
          ["Voice", "Confident, precise, modern (ch. 22)"],
        ]} />
      </Section>

      <Section id="details" title="Details">
        <Specs rows={[
          ["Dates", "DD/MM/YYYY — 27/09/2026"],
          ["Corners", "20–28 px on screen; generous space everywhere"],
          ["Documents", "The 210 × 270 mm house sheet from Koleex Hub"],
          ["Contact line", <span key="c" className="font-mono text-[13px]">{KOLEEX_COMPANY.email} · {KOLEEX_COMPANY.web}</span>],
        ]} />
        <Rule why="The book is only useful if everyone uses the same one.">When in doubt, ask — and never improvise with the logo, the colors or the legal name.</Rule>
      </Section>
    </Chapter>
  );
}
