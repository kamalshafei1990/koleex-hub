"use client";

/* Chapters 89–93: digital advertising, presentations, business cards,
   letterhead & envelopes, email signature. */

import { useState } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import {
  B, Bullets, Chapter, Code, Example, Examples, Note, P, Ref, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { BusinessCard, Lines, MachineShot, Post, PostBody, Slide, Strips } from "../mockups";
import { SILVER } from "@/lib/brand-book/tokens";

const SILVER_TEXT = { backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const;

/* ── 89 · Digital Advertising ──────────────────────────────────────────── */

export function DigitalAds() {
  return (
    <Chapter
      n={89}
      lead={
        <p>
          An ad is a post that has to earn attention it has not been given. It uses the same grammar as our
          posts — one message, one image, the logo — and it always leads somewhere useful.
        </p>
      }
      toc={[
        { id: "formats", title: "Formats" },
        { id: "anatomy", title: "An ad, built right" },
        { id: "copy", title: "Copy rules" },
        { id: "landing", title: "Where the ad leads" },
      ]}
    >
      <Section id="formats" title="Formats">
        <Table
          head={["Platform", "Main sizes"]}
          rows={[
            ["Meta (Facebook, Instagram)", <Code key="a">1080 × 1350 · 1080 × 1920 · 1080 × 1080</Code>],
            ["Google Display", <Code key="a">1200 × 628 · 1200 × 1200 · 300 × 250 · 728 × 90</Code>],
            ["LinkedIn", <Code key="a">1200 × 627 · 1080 × 1350</Code>],
            ["TikTok", <Code key="a">1080 × 1920 video</Code>],
          ]}
        />
      </Section>

      <Section id="anatomy" title="An ad, built right">
        <Examples cols={2}>
          <Example tone="do" caption="One message, one machine, one action, the logo." bg="#F5F5F7" h={290}>
            <Post w={200}><PostBody label="Overlock" title={<>Four threads.<br />One pass.</>} foot={<span className="rounded-full px-2 py-0.5 text-[6.5px] font-medium text-white" style={{ background: "#567FB2" }}>Request a quotation</span>} /></Post>
          </Example>
          <Example tone="dont" caption="Many messages, prices, red bursts, no logo." bg="#F5F5F7" h={290}>
            <Post w={200} bg="#DC2626">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-3 text-center text-white">
                <p className="text-[16px] font-black text-[#FDE047]">MEGA SALE!!!</p>
                <p className="text-[9px]">Best machines · lowest price · free gift · limited time</p>
                <p className="text-[14px] font-black">USD 199 ONLY</p>
              </div>
            </Post>
          </Example>
        </Examples>
      </Section>

      <Section id="copy" title="Copy rules">
        <Bullets items={[
          "One idea per ad; the headline in six words or fewer.",
          <><B>No prices</B> in ads — prices are given in quotations.</>,
          "No \"best\", \"No. 1\", \"cheapest\" or other claims we cannot prove — in China they are also illegal in ads.",
          "The call to action names what happens: \"Request a quotation\", \"Chat on WhatsApp\", \"Download the spec sheet\".",
          "Every ad is in the language of the people it targets, with its own reviewed translation.",
        ]} />
      </Section>

      <Section id="landing" title="Where the ad leads">
        <Specs rows={[
          ["Destination", "The matching machine page, or WhatsApp — never the home page for a product ad"],
          ["Tracking", <span key="u">Every link carries UTM tags: <Code>utm_source=meta&utm_medium=paid&utm_campaign=overlock-2026-10</Code></span>],
          ["Leads", "Forms feed Koleex Hub contacts, so every lead is followed up"],
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 90 · Presentations ────────────────────────────────────────────────── */

export function Presentations() {
  const W = 260;
  return (
    <Chapter
      n={90}
      lead={
        <p>
          A KOLEEX presentation is calm and clear: one idea per slide, big type, real photographs and
          plenty of space. The master has six slide types — together they cover almost every deck.
        </p>
      }
      toc={[
        { id: "types", title: "The six slides" },
        { id: "specs", title: "Specifications" },
        { id: "slide-rules", title: "Rules" },
      ]}
    >
      <Section id="types" title="The six slides">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <figure className="space-y-2"><Slide w={W} dark><div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"><Wordmark color="#FFFFFF" width="30%" /><p className="text-[15px] font-semibold tracking-[-0.02em]" style={SILVER_TEXT}>Stitch. Perfected.</p><div className="w-[34%]"><MachineShot w="100%" label={false} /></div></div></Slide><figcaption className="text-[12px] text-[var(--text-secondary)]"><B>1 · Cover</B> — black: the logo, one line in silver, the machine</figcaption></figure>
          <figure className="space-y-2"><Slide w={W} dark><div className="absolute left-[7%] top-[10%]"><Wordmark color="#FFFFFF" width={50} /></div><div className="absolute bottom-[18%] left-[7%]"><p className="text-[7px] tracking-[0.2em] text-[#98989D]">02</p><p className="text-[18px] font-semibold tracking-[-0.02em]" style={SILVER_TEXT}>Our machines</p></div></Slide><figcaption className="text-[12px] text-[var(--text-secondary)]"><B>2 · Section</B> — black: number and title in silver</figcaption></figure>
          <figure className="space-y-2"><Slide w={W}><div className="absolute left-[7%] top-[10%]"><Wordmark color="#000000" width={50} /></div><div className="absolute left-[7%] top-[26%] w-[40%]"><p className="text-[11px] font-semibold">Inspected before shipping</p><div className="mt-2"><Lines n={4} /></div></div><div className="absolute bottom-[12%] right-[5%] w-[46%]"><MachineShot w="100%" dark={false} label={false} /></div></Slide><figcaption className="text-[12px] text-[var(--text-secondary)]"><B>3 · Content</B> — white: title, short text, the machine</figcaption></figure>
          <figure className="space-y-2"><Slide w={W}><div className="absolute left-[7%] top-[10%]"><Wordmark color="#000000" width={50} /></div><div className="absolute inset-x-[7%] bottom-[14%] flex items-end gap-3">{[40, 58, 51, 74].map((v, i) => <div key={i} className="flex-1 rounded-t" style={{ height: v * 0.8, background: i === 3 ? "#1D1D1F" : "#D1D1D6" }} />)}</div><p className="absolute left-[7%] top-[24%] text-[11px] font-semibold">One chart, one message</p></Slide><figcaption className="text-[12px] text-[var(--text-secondary)]"><B>4 · Data</B> — gray bars, the key value in black (ch. 61)</figcaption></figure>
          <figure className="space-y-2"><Slide w={W}><div className="absolute left-[7%] top-[10%]"><Wordmark color="#000000" width={50} /></div><div className="absolute inset-x-[7%] top-[30%] grid grid-cols-3 gap-2">{["Selected", "Checked", "Delivered"].map((t) => <div key={t} className="rounded-[10px] bg-[#F5F5F7] p-2"><p className="mt-1 text-[8px] font-semibold">{t}</p><div className="mt-1"><Lines n={2} /></div></div>)}</div></Slide><figcaption className="text-[12px] text-[var(--text-secondary)]"><B>5 · Three points</B> — white: three short panels</figcaption></figure>
          <figure className="space-y-2"><Slide w={W} dark><div className="absolute inset-0 flex flex-col items-center justify-center gap-2"><Wordmark color="#FFFFFF" width="36%" /><p className="font-mono text-[7px] text-[#98989D]">{KOLEEX_COMPANY.web} · {KOLEEX_COMPANY.email}</p></div></Slide><figcaption className="text-[12px] text-[var(--text-secondary)]"><B>6 · Close</B> — black: the logo centered and one way to reach us</figcaption></figure>
        </div>
      </Section>

      <Section id="specs" title="Specifications">
        <Specs rows={[
          ["Format", "16:9, 1920 × 1080"],
          ["Look", "Black for cover, section and close; white for content — easy to read in a lit room and to print"],
          ["Grid", "12 columns, 96 px margins (ch. 55)"],
          ["Typeface", "Inter; Arial when the file travels to computers without Inter (set it in the master)"],
          ["Title size", "40–56 px; text no smaller than 20 px"],
          ["Logo", "Centered on cover and close; top-left on every other slide, 200 px"],
          ["Numbers", "Slide number bottom-right on content slides"],
        ]} />
        <P>The PowerPoint and Keynote master files will be added to <Ref n={137} />.</P>
      </Section>

      <Section id="slide-rules" title="Rules">
        <Bullets items={[
          "One idea per slide. If a slide needs a second title, it is two slides.",
          "No more than 30 words on a slide — the speaker says the rest.",
          "Real photographs, charts from real data, dates DD/MM/YYYY.",
          "No animations beyond a simple fade between slides.",
          "Client and partner logos only with their permission (ch. 44).",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 91 · Business Cards ───────────────────────────────────────────────── */

export function BusinessCards() {
  return (
    <Chapter
      n={91}
      lead={
        <p>
          The business card is often the first KOLEEX object a customer holds. Black on both sides, the logo
          raised on the front, silver edges — and on the back exactly what someone needs to reach you.
        </p>
      }
      toc={[
        { id: "card", title: "The card" },
        { id: "card-specs", title: "Specifications" },
        { id: "content", title: "What goes on the back" },
        { id: "card-donts", title: "What never to do" },
      ]}
    >
      <Section id="card" title="The card">
        <Stage bg="#F5F5F7" h="auto" pad={28}>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="space-y-2 text-center"><BusinessCard side="front" w={300} /><p className="text-[11px] text-[#6E6E73]">Front</p></div>
            <div className="space-y-2 text-center"><BusinessCard side="back" w={300} /><p className="text-[11px] text-[#6E6E73]">Back</p></div>
            <div className="space-y-2 text-center"><div className="h-[10px] w-[300px] rounded-[3px]" style={{ background: SILVER.css }} /><p className="text-[11px] text-[#6E6E73]">The edge — painted silver</p></div>
          </div>
        </Stage>
      </Section>

      <Section id="card-specs" title="Specifications">
        <Specs rows={[
          ["Size", "90 × 54 mm (owner decision), 3 mm bleed on every side, 4 mm safe margin"],
          ["Board", "Black board, soft-touch matte, 600–700 g/m² (thick enough for painted edges)"],
          ["Front", "The logo 40 mm wide, centered — white foil and raised (emboss), nothing else"],
          ["Back", "Black; logo white 25 mm top-left; name white Inter SemiBold 9 pt; title gray 7 pt; contacts white 6.5 pt monospace — white foil or white print"],
          ["Edges", "Painted silver (Pantone 877 C) all around"],
          ["Second version", "White both sides — raised black logo, black text, the same silver edges (ch. 47)"],
          ["Never", "Silver or gold foil on the logo, spot gloss, colored edges"],
          ["Language", "English only (owner decision)"],
        ]} />
      </Section>

      <Section id="content" title="What goes on the back">
        <Table
          head={["Line", "Rule"]}
          rows={[
            ["Name", "As in the passport, in Latin letters"],
            ["Title", "The real job title, in English"],
            ["Mobile / WhatsApp", "International format: +86 130 7380 0720"],
            ["Email", "name@koleexgroup.com"],
            ["Website", KOLEEX_COMPANY.web],
            ["Optional", "A QR code that saves your contact (vCard), 15 mm, bottom-right"],
          ]}
        />
      </Section>

      <Section id="card-donts" title="What never to do">
        <Bullets items={[
          "Several phone numbers from different countries on one card.",
          "Slogans, product lists, social icons in a row.",
          "Gold foil, a silver logo, gradients or the Hub gradient as a background.",
          "Printing cards locally in a different size or paper without approval.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 92 · Letterhead & Envelopes ───────────────────────────────────────── */

export function Letterhead() {
  return (
    <Chapter
      n={92}
      lead={
        <p>
          Letters use the same header as every KOLEEX document, so a letter, a quotation and an invoice
          that arrive together look like one company.
        </p>
      }
      toc={[
        { id: "letter", title: "The letterhead" },
        { id: "envelopes", title: "Envelopes" },
      ]}
    >
      <Section id="letter" title="The letterhead">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="w-[260px] overflow-hidden rounded bg-white p-3.5 text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "210 / 270" }}>
            <Wordmark color="#000000" width={64} />
            <Strips />
            <div className="mt-4 space-y-1 text-[5px]"><p className="font-mono">27/09/2026</p><p>To: Customer name · Company · City</p><p className="pt-1 font-semibold">Subject: …</p></div>
            <div className="mt-3"><Lines n={9} /></div>
            <div className="mt-4 text-[5px]"><p>Kind regards,</p><div className="mt-3 h-3 w-16 border-b border-[#000000]" /><p className="mt-0.5 font-semibold">Full Name</p><p className="text-[#6E6E73]">Job Title</p></div>
          </div>
        </Stage>
        <Specs rows={[
          ["Sheet", "The house sheet, 210 × 270 mm — it prints on A4 and US Letter"],
          ["Header", "Logo at the start, 45 mm; the legal line in English and Chinese over the tagline strip"],
          ["Body", "Inter 10 pt, 14 pt leading, start-aligned, 12 mm margins"],
          ["Footer", "Address, website, email, and \"Page N of M\" on every page"],
          ["Date", "DD/MM/YYYY, top-left under the header"],
        ]} />
        <P>Letters with legal force (invitations, certificates) follow <Ref n={100} />.</P>
      </Section>

      <Section id="envelopes" title="Envelopes">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="space-y-2 text-center">
              <div className="relative h-[110px] w-[220px] rounded-sm bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]">
                <div className="absolute left-3 top-3"><Wordmark color="#000000" width={46} /></div>
                <p className="absolute left-3 top-[30px] w-[120px] text-[4.5px] leading-snug text-[#6E6E73]">{KOLEEX_COMPANY.en}</p>
                <div className="absolute bottom-5 left-[52%] space-y-1"><div className="h-[2.5px] w-20 rounded bg-[#D2D2D7]" /><div className="h-[2.5px] w-16 rounded bg-[#D2D2D7]" /><div className="h-[2.5px] w-12 rounded bg-[#D2D2D7]" /></div>
              </div>
              <p className="text-[11px] text-[#6E6E73]">Outside</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="relative h-[110px] w-[220px] overflow-hidden rounded-sm bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]">
                <div className="absolute inset-x-0 top-0 h-0" style={{ borderLeft: "110px solid transparent", borderRight: "110px solid transparent", borderTop: "58px solid #000000" }} />
                <div className="absolute left-1/2 top-3 -translate-x-1/2"><Wordmark color="#FFFFFF" width={40} /></div>
              </div>
              <p className="text-[11px] text-[#6E6E73]">Opened — the black liner</p>
            </div>
          </div>
        </Stage>
        <Specs rows={[
          ["Sizes", "DL 220 × 110 mm for letters; C4 324 × 229 mm for documents flat"],
          ["Front", "Logo top-left 30 mm, the legal name under it; nothing else"],
          ["Outside", "White, uncoated, 120 g/m² — the address reads clearly and the post handles it like any letter"],
          ["Inside", "A black liner; the white logo printed on the flap, seen when it opens"],
          ["Second version", "Black outside, white liner (ch. 47)"],
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 93 · Email Signature ──────────────────────────────────────────────── */

/* Served by Koleex Hub from our own domain — reachable from mainland China. */
const SIGNATURE_LOGO = "https://hub.koleexgroup.com/brand/kit/koleex-logo-black-1000.png";

const SIGNATURE_HTML = `<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;color:#000000;font-size:13px;line-height:1.5">
  <tr><td style="padding-bottom:8px"><strong>Full Name</strong><br><span style="color:#6E6E73">Job Title · KOLEEX</span></td></tr>
  <tr><td style="padding-bottom:8px"><img src="${SIGNATURE_LOGO}" width="120" alt="KOLEEX" style="display:block"></td></tr>
  <tr><td style="color:#6E6E73;font-size:12px">M ${KOLEEX_COMPANY.mobile} (WhatsApp)<br>${KOLEEX_COMPANY.email} · ${KOLEEX_COMPANY.web}</td></tr>
</table>`;

export function EmailSignature() {
  const [copied, setCopied] = useState(false);
  return (
    <Chapter
      n={93}
      lead={
        <p>
          Everyone at KOLEEX signs emails the same way: name, title, logo, one phone, one email, the
          website. Nothing else.
        </p>
      }
      toc={[
        { id: "signature", title: "The signature" },
        { id: "sig-rules", title: "Rules" },
        { id: "sig-code", title: "Copy it" },
      ]}
    >
      <Section id="signature" title="The signature">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="w-full max-w-[360px] text-[13px] leading-[1.5] text-[#1D1D1F]" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
            <p className="text-[#6E6E73]">Kind regards,</p>
            <div className="mt-3"><p className="font-bold">Full Name</p><p className="text-[#6E6E73]">Job Title · KOLEEX</p></div>
            <div className="mt-2"><Wordmark color="#000000" width={120} /></div>
            <div className="mt-2 text-[12px] text-[#6E6E73]"><p>M {KOLEEX_COMPANY.mobile} (WhatsApp)</p><p>{KOLEEX_COMPANY.email} · {KOLEEX_COMPANY.web}</p></div>
          </div>
        </Stage>
      </Section>

      <Section id="sig-rules" title="Rules">
        <Bullets items={[
          "Name and title in English; add the name in your own script on a second line if you wish.",
          "One phone number, in international format, marked WhatsApp if it is.",
          "The logo as an image, 120 px wide, from our own domain.",
          "No quotes, banners, animated images, social icon rows or legal disclaimers longer than one line.",
          "Replies and forwards use a short version: name, title, phone.",
        ]} />
      </Section>

      <Section id="sig-code" title="Copy it">
        <P>Paste this into the signature settings of your email app, then change the name, title and phone.</P>
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">HTML</span>
            <button
              type="button"
              onClick={() => { void navigator.clipboard?.writeText(SIGNATURE_HTML).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
              className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            >
              {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}{copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-5 text-[var(--text-secondary)]">{SIGNATURE_HTML}</pre>
        </div>
        <Note>The logo in the signature loads from our own server, so it works from mainland China.</Note>
      </Section>
    </Chapter>
  );
}

