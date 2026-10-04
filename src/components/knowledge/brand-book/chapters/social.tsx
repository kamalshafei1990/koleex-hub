"use client";

/* Chapters 79–88: social profiles, post templates, and one chapter per
   platform — Facebook, Instagram, LinkedIn, TikTok & Douyin, YouTube, X,
   WeChat, WhatsApp Business.

   Known facts used: Instagram (live as @koleexgroup) and the Facebook page
   are live (connected in Odoo); handles follow "@koleex + the market" (owner,
   01/10/2026); the owner wants WhatsApp on both an Egyptian and a
   Chinese number; captions follow the house pattern seen in our own posts
   (a short hook, then the product and its benefit, then hashtags). */

import type { ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import OverlockMachineIcon from "@/components/icons/machine-kinds/OverlockMachineIcon";
import {
  B, Bullets, Chapter, Code, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { GroupLockup, LogoTile, Wordmark } from "../marks";
import { Avatar, INK, MachineShot, Phone, Post, PostBody } from "../mockups";
import { SILVER } from "@/lib/brand-book/tokens";

/* ── Shared ────────────────────────────────────────────────────────────── */

function SizeTable({ rows }: { rows: Array<[string, string, string?]> }) {
  return <Table head={["Item", "Size", "Note"]} rows={rows.map(([a, b, c]) => [<B key="a">{a}</B>, <Code key="b">{b}</Code>, c ?? ""])} />;
}

function ProfileHeader({ name = "KOLEEX Egypt", handle = "@koleexegypt", bio }: { name?: string; handle?: string; bio: ReactNode }) {
  return (
    <div className="px-3 pt-3 text-[#1D1D1F]">
      <div className="flex items-center gap-3">
        <Avatar size={44} />
        <div className="min-w-0">
          <p className="text-[10px] font-bold">{name}</p>
          <p className="text-[8px] text-[#6E6E73]">{handle}</p>
        </div>
      </div>
      <div className="mt-2 text-[7.5px] leading-snug">{bio}</div>
    </div>
  );
}

const BIO_EN = <><p>Industrial garment machinery — selected, checked, delivered.</p><p>Since 1955 · Taizhou · Cairo</p><p className="text-[#3E6796]">www.koleexgroup.com</p></>;

/* ── 79 · Social Media Profiles ────────────────────────────────────────── */

export function SocialProfiles() {
  return (
    <Chapter
      n={79}
      lead={
        <p>
          On every platform KOLEEX is instantly the same company: the same picture, the same name, the same
          handle, the same short description — in the language of that platform’s audience.
        </p>
      }
      toc={[
        { id: "identity", title: "One identity everywhere" },
        { id: "cover", title: "The cover image" },
        { id: "bio", title: "The description" },
        { id: "profile-donts", title: "What never to do" },
      ]}
    >
      <Section id="identity" title="One identity everywhere">
        <div className="flex flex-wrap items-start gap-6">
          <Phone><ProfileHeader bio={BIO_EN} /><div className="mt-3 grid grid-cols-3 gap-[2px] px-[2px]">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-[4/5]" style={{ background: i % 3 === 1 ? "#F5F5F7" : INK }} />)}</div></Phone>
          <div className="min-w-[240px] flex-1">
            <Specs rows={[
              ["Profile picture", "The logo tile — the full white logo on black (ch. 41), uploaded at 1024 × 1024"],
              ["Name", "KOLEEX — for a regional account: KOLEEX Egypt, KOLEEX China"],
              ["Handle", "@koleex + the market — @koleexegypt, @koleexchina (owner, 01/10/2026); never variants with numbers or underscores"],
              ["Link", "The website in the reader's language, or the WhatsApp link"],
              ["Category", "Industrial Equipment / Machinery (the platform's closest category)"],
            ]} />
          </div>
        </div>
      </Section>

      <Section id="cover" title="The cover image">
        <Stage bg="#F5F5F7" h="auto" pad={20}>
          <div className="w-full max-w-[560px] overflow-hidden rounded-[12px] bg-white ring-1 ring-black/10">
            <div className="relative grid grid-cols-2 items-center bg-[#000000] px-8" style={{ aspectRatio: "820 / 312" }}>
              <p className="text-[28px] font-semibold leading-[1.02] tracking-[-0.03em]" style={{ backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Stitch.<br />Perfected.</p>
              <MachineShot w="100%" label={false} />
              <div className="absolute -bottom-7 left-6"><Avatar size={64} /></div>
            </div>
            <div className="h-12 pl-[100px] pt-2 text-[13px] font-semibold text-[#1D1D1F]">KOLEEX</div>
          </div>
        </Stage>
        <Specs rows={[
          ["Look", "Black; the headline in silver on the left, the machine on the right — no logo (the profile picture carries it)"],
          ["Headline", "The current tagline or campaign line, two to four words"],
          ["Safe area", "Keep the headline and the machine inside the middle 70% — every platform crops the edges on phones"],
          ["Sizes", "Facebook 1640 × 624 · LinkedIn 1128 × 191 · YouTube 2560 × 1440 (safe 1546 × 423) · X 1500 × 500"],
          ["Changes", "With each campaign or product launch; the same cover on every platform at the same time"],
        ]} />
      </Section>

      <Section id="bio" title="The description">
        <Table
          head={["Language", "Short description"]}
          rows={[
            ["English", "Industrial garment machinery — selected, checked, delivered. Since 1955 · Taizhou · Cairo"],
            ["العربية", <span key="a" dir="rtl" lang="ar" className="block text-start">ماكينات صناعية للملابس — نختارها ونفحصها ونوصّلها. منذ 1955 · تايتشو · القاهرة</span>],
            ["中文", <span key="z" lang="zh-Hans">工业服装机械——精选、检验、交付。始于 1955 · 台州 · 开罗</span>],
          ]}
        />
        <Note>Translations of the description are drafts until reviewed (<Ref n={30} />). The facts in it — 1955, Taizhou, Cairo — come from our company profile.</Note>
      </Section>

      <Section id="profile-donts" title="What never to do">
        <Bullets items={[
          "The logo squeezed, stretched or cropped to fill the circle — it sits at 70% of the width, whole.",
          "A different picture or name on each platform.",
          "Personal staff accounts named \"KOLEEX\" or using the logo as their picture.",
          "Hashtag lists, emoji rows or phone numbers in the name field.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 80 · Post Templates ───────────────────────────────────────────────── */

/** Event photo post (owner, 27/09/2026): a dark band top and bottom so
 *  the header and the footer always read; no KOLEEX edge on photo posts. */
function EventPhotoPost({ w = 230 }: { w?: number }) {
  const u = w / 230;
  return (
    <div className="relative shrink-0 overflow-hidden rounded-md" style={{ width: w, aspectRatio: "4 / 5", background: "#C7C7CC" }}>
      <div className="absolute rounded-full bg-[#8E8E93]" style={{ left: 70 * u, top: 88 * u, width: 40 * u, height: 40 * u }} />
      <div className="absolute rounded-t-[30px] bg-[#636366]" style={{ left: 54 * u, top: 132 * u, width: 72 * u, height: 170 * u }} />
      <div className="absolute rounded-full bg-[#AEAEB2]" style={{ left: 140 * u, top: 100 * u, width: 36 * u, height: 36 * u }} />
      <div className="absolute rounded-t-[30px] bg-[#8E8E93]" style={{ left: 126 * u, top: 140 * u, width: 66 * u, height: 160 * u }} />
      <div className="absolute inset-x-0 top-0 bg-black/45" style={{ height: "16%" }} />
      <div className="absolute inset-x-0 bottom-0 bg-black/45" style={{ height: "12%" }} />
      <div className="absolute flex items-center gap-1.5 text-white" style={{ left: 12 * u, top: 14 * u, fontSize: 8 * u }}>
        <Wordmark color="#FFFFFF" width={52 * u} /><span className="h-[10px] w-px bg-white/70" /><span className="font-semibold">CISMA 2025</span><span className="h-[10px] w-px bg-white/70" /><span className="font-light">DAY 2</span>
      </div>
      <div className="absolute inset-x-0 flex items-center justify-between text-white" style={{ bottom: 9 * u, paddingLeft: 12 * u, paddingRight: 12 * u, fontSize: 7 * u }}>
        <span className="flex gap-1">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="block rounded-full bg-white/85" style={{ width: 7 * u, height: 7 * u }} />)}</span>
        <span>{KOLEEX_COMPANY.web}</span>
      </div>
    </div>
  );
}

/** The Bento board: a fair announced in five black tiles. */
function BentoBoard() {
  const tile = "rounded-[10px] bg-black text-white p-2.5";
  return (
    <div className="grid w-full max-w-[520px] gap-1.5 rounded-[12px] bg-white p-1.5 shadow-[0_0_0_1px_rgba(0,0,0,0.1)]" style={{ gridTemplateColumns: "1fr 2fr 1fr", gridTemplateRows: "110px 110px" }}>
      <div className={`${tile} row-span-2 flex flex-col gap-2`}><Wordmark color="#FFFFFF" width={60} /><p className="text-[13px] font-bold">Invitation</p><div className="space-y-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[2px] rounded bg-[#636366]" />)}</div></div>
      <div className={`${tile} flex flex-col justify-between`}><div className="flex justify-center"><GroupLockup color="#FFFFFF" width={130} /></div><p className="text-[11px] font-bold leading-tight">24–27 September 2025<br /><span className="font-light">Shanghai</span></p></div>
      <div className={`${tile} flex items-end justify-center`}><MachineShot w={80} label={false} logo={false} /></div>
      <div className={`${tile} flex flex-col justify-center`}><p className="text-[9px] text-[#98989D]">Booth</p><p className="mt-1 self-start rounded-[6px] border-2 border-white px-1.5 text-[18px] font-bold leading-tight">W5-C42</p></div>
      <div className={`${tile} col-span-1 flex items-end`}><p className="text-[10px] font-bold leading-tight">From Design<br /><span className="font-light">to Intelligence</span></p></div>
    </div>
  );
}

const TEMPLATES: Array<{ kind: string; label: string; title: ReactNode; dark: boolean; image?: boolean }> = [
  { kind: "Product", label: "Overlock · Series", title: <>Four threads.<br /><span className="font-light">One pass.</span></>, dark: true },
  { kind: "Detail / feature", label: "Detail", title: <>Direct drive.<br /><span className="font-light">No belt, no noise.</span></>, dark: false },
  { kind: "Tip / how-to", label: "Tip", title: <>Clean the feed dog<br /><span className="font-light">every week.</span></>, dark: true },
  { kind: "Behind the scenes", label: "Inspection", title: <>Every machine is<br /><span className="font-light">tested before it ships.</span></>, dark: true },
  { kind: "Event", label: "CISMA · Shanghai", title: <>Meet us at<br /><span className="font-light">booth 000.</span></>, dark: true, image: false },
  { kind: "Occasion", label: "Eid al-Fitr", title: <>Eid Mubarak<br /><span className="font-light">from all of us.</span></>, dark: false, image: false },
];

export function PostTemplates() {
  return (
    <Chapter
      n={80}
      lead={
        <p>
          Every KOLEEX post is built on the same parts: the KOLEEX edge, the logo top-left, a small label, a
          two-line headline and one image. The content changes; the grammar does not.
        </p>
      }
      toc={[
        { id: "anatomy", title: "Anatomy of a post" },
        { id: "types", title: "Post types" },
        { id: "event-photos", title: "Event photo posts" },
        { id: "bento", title: "The Bento board" },
        { id: "travel", title: "Travel posts" },
        { id: "captions", title: "Captions" },
        { id: "rhythm", title: "Rhythm and languages" },
      ]}
    >
      <Section id="anatomy" title="Anatomy of a post">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center gap-6">
            <Post w={230}><PostBody label="Overlock · Series" title={<>Four threads.<br /><span className="font-light">One pass.</span></>} /></Post>
            <ol className="space-y-2 text-[12px] text-[#1D1D1F]">
              <li><B>1 · Edge</B> — the KOLEEX edge down the left side (ch. 57)</li>
              <li><B>2 · Logo</B> — top-left; top-right when the image needs the left side</li>
              <li><B>3 · Label</B> — category or context, small capitals, gray</li>
              <li><B>4 · Headline</B> — the two-line headline: Bold, then Light (ch. 51)</li>
              <li><B>5 · Image</B> — the machine, our own photograph (ch. 63)</li>
            </ol>
          </div>
        </Stage>
        <Specs rows={[
          ["Feed size", "1080 × 1350 px (4:5); 1080 × 1080 where a platform needs square"],
          ["Margins", "72 px on every side (ch. 55)"],
          ["Logo", "200–240 px wide, top-left (or top-right), the same place across a series"],
          ["Edge", "11 px wide on a 1080 px post, full height, the opposite colour of the ground"],
          ["Occasions", "One white 3D object — the crescent, the tree (ch. 57)"],
          ["Text on the image", "20% of the area at most — the caption carries the detail"],
        ]} />
      </Section>

      <Section id="types" title="Post types">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {TEMPLATES.map((t) => (
            <figure key={t.kind} className="flex flex-col items-center gap-2">
              <Post w={170} bg={t.dark ? INK : "#FFFFFF"}><PostBody label={t.label} title={t.title} dark={t.dark} image={t.image ?? true} /></Post>
              <figcaption className="text-[12px] font-semibold text-[var(--text-primary)]">{t.kind}</figcaption>
            </figure>
          ))}
        </div>
        <Note>Hiring posts follow <Ref n={125} />; customer stories need the customer’s written permission (<Ref n={131} />).</Note>
      </Section>

      <Section id="event-photos" title="Event photo posts">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center gap-6">
            <EventPhotoPost />
            <ol className="space-y-2 text-[12px] text-[#1D1D1F]">
              <li><B>Header</B> — KOLEEX | the event | DAY n, top-left</li>
              <li><B>Photo</B> — our own photo from the booth, the same preset for the whole series</li>
              <li><B>Bands</B> — a dark band at the top and the bottom, so the header and footer always read</li>
              <li><B>Footer</B> — social icons on the left, the website on the right, the same on every post</li>
            </ol>
          </div>
        </Stage>
        <Specs rows={[
          ["Bands", "Black at 45%, about 16% of the height at the top and 12% at the bottom"],
          ["Edge", "No KOLEEX edge on photo posts"],
          ["People", <>Visitors’ badges unreadable, no close-up faces without consent, no competitors’ booths (<Ref n={68} />)</>],
        ]} />
      </Section>

      <Section id="bento" title="The Bento board">
        <P>A fair is announced on one board of black tiles on white — each tile one fact: the invitation, the dates, a machine, the booth number, the line.</P>
        <Stage bg="#F5F5F7" h="auto" pad={24}><BentoBoard /></Stage>
        <Specs rows={[
          ["Tiles", "Five, black, corners about 24 px, 8 px apart, on white"],
          ["Booth number", "The largest text on the board, in an outlined box"],
          ["Event logo", "In its own colours, on a white tab — never directly on black (ch. 44)"],
          ["Edge", "No KOLEEX edge on the Bento board"],
        ]} />
      </Section>

      <Section id="travel" title="Travel posts">
        <Examples cols={2}>
          <Example tone="do" caption="White only; the city and the date." bg="#F5F5F7" h={190}>
            <Post w={140}><PostBody label="Next destination" title={<>Dhaka<br /><span className="font-light">January 2026</span></>} image={false} /></Post>
          </Example>
          <Example tone="dont" caption="Flag colours, or the name of the customer we will visit." bg="#F5F5F7" h={190}>
            <Post w={140}><PostBody label="Next destination" title={<>Dhaka – <span style={{ color: "#16A34A" }}>Bangladesh</span></>} image={false} /></Post>
          </Example>
        </Examples>
        <P>An upcoming visit may be announced before it happens — the city and the date only, never the customers we will meet.</P>
      </Section>

      <Section id="captions" title="Captions">
        <Rule why="People scroll. The first line decides whether the rest is read.">
          Hook first, then the product and what it does for the customer, then one clear next step, then
          hashtags.
        </Rule>
        <Stage bg="#FFFFFF" h="auto" pad={20}>
          <div className="w-full max-w-[420px] space-y-2 text-[12.5px] leading-6 text-[#1D1D1F]">
            <p><B>Quality starts before the first cut.</B></p>
            <p>Our spreading machines lay every layer flat and even, so the cutting room works faster and wastes less fabric.</p>
            <p>Ask us for the spec sheet on WhatsApp.</p>
            <p className="text-[#3E6796]">#KOLEEX #GarmentMachinery #Spreading</p>
          </div>
        </Stage>
        <Specs rows={[
          ["Length", "Two to four short lines; the hook under 80 characters"],
          ["Hashtags", "Three to five: #KOLEEX + category + topic; never lists of 20"],
          ["Emoji", "One or none"],
          ["Claims", "Only true, checkable facts — no \"best\", \"No. 1\" or \"cheapest\""],
        ]} />
      </Section>

      <Section id="rhythm" title="Rhythm and languages">
        <Table
          head={["Platform", "Main languages", "Suggested rhythm"]}
          rows={[
            ["Facebook", "Arabic, English", "3–4 posts a week"],
            ["Instagram", "English, Arabic", "3–4 posts a week + stories"],
            ["LinkedIn", "English", "1–2 posts a week"],
            ["TikTok / Douyin", "English, Arabic / Chinese", "2–3 short videos a week"],
            ["YouTube", "English with subtitles", "1–2 videos a month"],
            ["WeChat", "Chinese", "1 article a week; Moments by staff"],
          ]}
        />
      </Section>
    </Chapter>
  );
}

/* ── Platform chapters ─────────────────────────────────────────────────── */

function PlatformChapter({ n, lead, sizes, profile, content, extra }: {
  n: number; lead: ReactNode; sizes: Array<[string, string, string?]>; profile: Array<[string, ReactNode]>; content: ReactNode[]; extra?: ReactNode;
}) {
  return (
    <Chapter
      n={n}
      lead={<p>{lead}</p>}
      toc={[
        { id: "sizes", title: "Sizes" },
        { id: "profile", title: "Profile" },
        { id: "content", title: "What we post" },
        ...(extra ? [{ id: "more", title: "Platform specifics" }] : []),
      ]}
    >
      <Section id="sizes" title="Sizes"><SizeTable rows={sizes} /></Section>
      <Section id="profile" title="Profile"><Specs rows={profile} /></Section>
      <Section id="content" title="What we post"><Bullets items={content} /></Section>
      {extra && <Section id="more" title="Platform specifics">{extra}</Section>}
    </Chapter>
  );
}

export function Facebook() {
  return (
    <PlatformChapter
      n={81}
      lead="Facebook is where many of our Arabic-speaking customers follow KOLEEX. The page is our shop window in the Middle East and North Africa."
      sizes={[["Profile picture", "1024 × 1024", "The logo tile"], ["Cover", "1640 × 624", "The KOLEEX cover (ch. 79): headline and machine in the central 820 × 312 — phones crop the sides"], ["Feed post", "1080 × 1350", "4:5"], ["Event cover", "1920 × 1005"], ["Story / Reel", "1080 × 1920", "Safe areas: ch. 70"]]}
      profile={[["Page name", "KOLEEX"], ["About", "The short description (ch. 79), Arabic and English"], ["Buttons", "\"WhatsApp\" as the main button"], ["Replies", "Messages answered within one working day"]]}
      content={["Product posts and short machine videos", "Exhibitions and events, with dates DD/MM/YYYY", "Occasions: Ramadan, Eid al-Fitr, Eid al-Adha, national days of our markets", "Captions in Arabic first, English below — or one post per language"]}
    />
  );
}

export function Instagram() {
  return (
    <PlatformChapter
      n={82}
      lead="Instagram is our visual showroom. The grid is seen as a whole, so every post is designed to sit beside the others."
      sizes={[["Profile picture", "1024 × 1024", "Shown as a circle"], ["Feed post", "1080 × 1350", "Shown cropped to 3:4 on the grid — keep the headline inside"], ["Story", "1080 × 1920", "Top 250 px and bottom 340 px stay clear"], ["Reel cover", "1080 × 1920", "The post layout (logo top-left, silver headline, machine), inside the central 1080 × 1440"], ["Highlight cover", "1080 × 1920", "A Hub library icon, white on Ink"]]}
      profile={[["Handle", "@koleex + the market (ch. 79)"], ["Bio", "Short description + one link"], ["Highlights", "Machines · Services · Events · Contact — each with its icon"], ["Link", "The website or WhatsApp"]]}
      content={["Alternate dark-led and light-led posts so the grid breathes", "Reels of machines running — the most watched format", "Stories for events, day-to-day work and quick tips"]}
      extra={
        <Stage bg="#F5F5F7" h="auto" pad={20}>
          <div className="flex flex-wrap items-start gap-6">
            <div className="grid w-[240px] grid-cols-3 gap-[3px]">
              {Array.from({ length: 9 }).map((_, i) => (
                <Post key={i} w={78} ratio="3 / 4" bg={i % 2 ? "#FFFFFF" : INK}>
                  <div className="absolute left-1.5 top-1.5"><Wordmark color={i % 2 ? "#000000" : "#FFFFFF"} width={22} /></div>
                </Post>
              ))}
            </div>
            <p className="max-w-[260px] text-[12px] leading-5 text-[#6E6E73]">The grid alternates dark and light tiles and keeps the logo in the same corner — at a glance it reads as one brand.</p>
          </div>
        </Stage>
      }
    />
  );
}

export function LinkedIn() {
  return (
    <PlatformChapter
      n={83}
      lead="LinkedIn is where distributors, large factories, partners and future colleagues check who we are. The tone is the most formal of our channels."
      sizes={[["Logo", "400 × 400", "The logo tile"], ["Cover", "1128 × 191", "The KOLEEX cover (ch. 79), headline and machine in the middle; phones crop the sides"], ["Post image", "1200 × 627 or 1080 × 1350"], ["Document (carousel)", "1080 × 1350 pages, PDF", "Our house style, 10 pages at most"]]}
      profile={[["Page name", "KOLEEX International Group"], ["Tagline", "Industrial Garment Machinery"], ["Industry", "Industrial Machinery Manufacturing"], ["About", "The 100-word company description (ch. 32)"]]}
      content={["Company news, exhibitions, new partnerships (with permission)", "Knowledge: how to choose a machine, how we inspect", "Hiring (ch. 125) — and staff sharing, not re-posting word for word (ch. 126)", "English; no hashtag lists, no emoji"]}
    />
  );
}

export function TikTokDouyin() {
  return (
    <PlatformChapter
      n={84}
      lead="Short vertical video: a machine running, a tip, a moment from the factory. TikTok reaches our international audience; Douyin (抖音) is its separate Chinese twin, with its own account and content in Chinese."
      sizes={[["Video", "1080 × 1920", "9:16, 15–60 s"], ["Cover", "1080 × 1920", "The post layout: logo top-left, silver headline, the machine (ch. 71)"], ["Profile picture", "1024 × 1024", "The logo tile"], ["Safe areas", "Top 250 · bottom 420 · right 150 px", "Ch. 70"]]}
      profile={[["TikTok", "@koleex + the market (ch. 79), English and Arabic"], ["Douyin", "An enterprise account under our Taizhou company, in Chinese"], ["Link", "Website or WhatsApp (TikTok) · WeChat (Douyin)"]]}
      content={["The machine is the star: real sound of the machine, subtitles, logo in the first or last second", "Music only from the platform's own licensed library", "Never re-upload a TikTok to Douyin (or back) with the other app's watermark — export clean from the edit", "Chinese content follows Chinese advertising rules: no \"best\", \"first\", \"top\" (ch. 29)"]}
    />
  );
}

export function YouTube() {
  return (
    <PlatformChapter
      n={85}
      lead="YouTube holds our longer videos — demonstrations, tutorials, the factory — and is the video library we link to from the website and quotations."
      sizes={[["Channel banner", "2560 × 1440", "Everything important inside the central 1546 × 423"], ["Thumbnail", "1280 × 720", "Ch. 71"], ["Video", "3840 × 2160 or 1920 × 1080", "16:9"], ["Shorts", "1080 × 1920"]]}
      profile={[["Channel name", "KOLEEX"], ["Handle", "@koleex + the market (ch. 79)"], ["Playlists", "One per machine category, plus Tutorials, Factory, Events"], ["Subtitles", "English, Arabic, Chinese uploaded as files (SRT)"]]}
      content={["Titles: what the video shows, under 60 characters — \"Threading an overlock machine in 60 seconds\"", "Descriptions: two lines, then links to the machine page and WhatsApp", "End screen: the outro (ch. 71) with one next video"]}
    />
  );
}

export function XPlatform() {
  return (
    <PlatformChapter
      n={86}
      lead="X is a secondary channel: news, exhibitions and links to our articles, in English."
      sizes={[["Profile picture", "400 × 400", "The logo tile"], ["Header", "1500 × 500", "Logo and descriptor centered"], ["Post image", "1600 × 900", "16:9"]]}
      profile={[["Name", "KOLEEX"], ["Handle", "@koleex + the market (ch. 79)"], ["Bio", "Short description + website"]]}
      content={["Short news with one image or video", "Event updates during exhibitions", "Replies within one working day; no arguments in public"]}
    />
  );
}

export function WeChat() {
  return (
    <PlatformChapter
      n={87}
      lead="WeChat (微信) is how our Chinese customers, suppliers and colleagues reach us — the official account for articles, Channels (视频号) for video, and staff Moments (朋友圈) for everyday presence."
      sizes={[["Account avatar", "1024 × 1024", "The logo tile"], ["Article cover", "900 × 383", "2.35:1 — shown cropped to a square in shares: keep the subject centered"], ["Article second image", "500 × 500"], ["Channels video", "1080 × 1260 or 1080 × 1920", "6:7 or 9:16"]]}
      profile={[["Official account name", "KOLEEX"], ["Verified company", <span key="c" lang="zh-Hans">科莱恪斯国际商业管理（台州）有限公司</span>], ["Introduction", "The Chinese short description (ch. 79)"], ["Menu", "产品 · 服务 · 联系我们"]]}
      content={["Articles: Chinese, 15–16 px body text, 1.75 line height, Hub Blue for links only", "Every article ends with the logo, the QR code of the account and one contact", "Moments by staff: the approved templates, no edited logos, no price lists (ch. 126)"]}
      extra={
        <Stage bg="#F5F5F7" h="auto" pad={20}>
          <Phone>
            <div className="h-full bg-white text-[#1D1D1F]">
              <div className="flex h-[38%] items-center justify-center bg-[#000000]"><Wordmark color="#FFFFFF" width="46%" /></div>
              <div className="space-y-1.5 p-3">
                <p lang="zh-Hans" className="text-[10px] font-bold">拉布机：让每一层都平整</p>
                <p className="text-[7px] text-[#6E6E73]">KOLEEX · 27/09/2026</p>
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[3px] rounded bg-[#D2D2D7]" style={{ width: i === 5 ? "60%" : "100%" }} />)}
              </div>
            </div>
          </Phone>
        </Stage>
      }
    />
  );
}

export function WhatsApp() {
  return (
    <PlatformChapter
      n={88}
      lead="WhatsApp Business is where most conversations with our customers actually happen. It is a brand channel too: the profile, the catalog and every standard reply follow this book."
      sizes={[["Profile photo", "1024 × 1024", "The logo tile"], ["Catalog image", "1080 × 1080", "Our own photo on white"], ["Status", "1080 × 1920", "Like a story"]]}
      profile={[["Numbers", "One Egyptian and one Chinese business number (owner decision)"], ["Business name", "KOLEEX Egypt · KOLEEX China"], ["Description", "The short description in Arabic (Egypt) or English (China)"], ["Hours", "Working hours of that office, in its time zone"], ["Website", KOLEEX_COMPANY.web]]}
      content={["Catalog: our own photos, the machine name and a short description — never prices", "Greeting and away messages from the approved text below", "Quick replies for the common questions: spec sheet, delivery, spare parts, location", "Broadcasts only to customers who agreed to receive them"]}
      extra={
        <div className="space-y-4">
          <Table
            head={["Message", "Approved text"]}
            rows={[
              ["Greeting (EN)", "Hello, and welcome to KOLEEX. How can we help you today?"],
              ["Greeting (AR)", <span key="g" dir="rtl" lang="ar" className="block text-start">أهلًا بك في KOLEEX. كيف يمكننا مساعدتك اليوم؟</span>],
              ["Away (EN)", "Thank you for your message. We are out of office now and will reply in our working hours."],
              ["Away (AR)", <span key="a" dir="rtl" lang="ar" className="block text-start">شكرًا لرسالتك. نحن خارج ساعات العمل الآن، وسنرد عليك في أقرب وقت خلال ساعات العمل.</span>],
            ]}
          />
          <Examples cols={2}>
            <Example tone="do" caption="Catalog item: own photo, name, one line — no price." bg="#F5F5F7" h={170}>
              <div className="flex w-[220px] items-center gap-3 rounded-xl bg-white p-3 text-[#1D1D1F] shadow-[0_0_0_1px_#D2D2D7]">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#F5F5F7]"><OverlockMachineIcon size={30} /></div>
                <div><p className="text-[11px] font-semibold">Overlock machine</p><p className="text-[9px] text-[#6E6E73]">4-thread · direct drive</p><p className="mt-1 flex items-center gap-1 text-[8.5px] text-[#3E6796]">Ask for the spec sheet</p></div>
              </div>
            </Example>
            <Example tone="dont" caption="Price lists, forwarded supplier catalogs, emoji walls." bg="#F5F5F7" h={170}>
              <div className="w-[220px] rounded-xl bg-[#DCF8C6] p-3 text-[10px] text-[#1D1D1F]">🔥🔥 BEST PRICE 🔥🔥<br />Model 123 — USD ???<br />Forwarded: supplier_catalog.pdf</div>
            </Example>
          </Examples>
          <div className="flex items-center gap-3"><LogoTile size={40} round /><span className="text-[13px] text-[var(--text-dim)]">The same logo picture on every number.</span></div>
        </div>
      }
    />
  );
}

