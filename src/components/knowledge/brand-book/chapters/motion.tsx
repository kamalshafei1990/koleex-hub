"use client";

/* Chapters 70–74: video, the video kit, motion, logo animation, sound.

   Owner decisions (27/09/2026): brand films are SLOW and PREMIUM (a slow
   orbit around the machine, close-ups, one word on screen); the logo
   animation is "Focus" (from a soft blur to sharp, 1.8 s); music depends on
   the video style; the KOLEEX melody is M4 — D E G A → D.

   The interface motion values are the Hub's own tokens (globals.css
   --kx-dur-* and --kx-ease-*), and the Hub sounds are its own files under
   public/sounds. Every demo respects prefers-reduced-motion. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import PlayIcon from "@/components/icons/ui/PlayIcon";
import PauseIcon from "@/components/icons/ui/PauseIcon";
import {
  B, Bullets, Chapter, Code, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark, GroupLockup } from "../marks";
import { MachineShot } from "../mockups";
import { SILVER } from "@/lib/brand-book/tokens";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function Frame({ ratio = "16/9", w = 240, bg = "#000000", children, label }: { ratio?: string; w?: number; bg?: string; children?: ReactNode; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative overflow-hidden rounded-md shadow-[0_0_0_1px_rgba(255,255,255,0.12)]" style={{ width: w, aspectRatio: ratio, background: bg }}>{children}</div>
      {label && <span className="font-mono text-[11px] text-[#6E6E73]">{label}</span>}
    </div>
  );
}

/* ── 70 · Video ────────────────────────────────────────────────────────── */

export function Video() {
  return (
    <Chapter
      n={70}
      lead={
        <p>
          Video shows what a photograph cannot: a machine running, a seam forming. KOLEEX films are slow,
          quiet and premium — the machine turning on black, one word at a time.
        </p>
      }
      toc={[
        { id: "film", title: "The KOLEEX film" },
        { id: "kinds", title: "Kinds of video" },
        { id: "shooting", title: "Shooting" },
        { id: "formats", title: "Formats" },
        { id: "safe", title: "Safe areas for vertical video" },
        { id: "music", title: "Music" },
        { id: "video-donts", title: "What never to do" },
      ]}
    >
      <Section id="film" title="The KOLEEX film">
        <Stage bg="#000000" h="auto" pad={40}>
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
            {[["1", "The machine on black, turning slowly"], ["2", "A close-up: the needle, the stitch"], ["3", "One word on screen — then the logo"]].map(([n, t]) => (
              <div key={n} className="flex flex-col items-center gap-3 text-center">
                <div className="flex aspect-video w-full items-center justify-center rounded-[14px] bg-[#000000] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                  {n === "1" ? <MachineShot w="70%" label={false} /> : n === "2" ? <span className="text-[11px] text-[#6E6E73]">Macro close-up</span> : <span className="text-[26px] font-semibold tracking-[-0.03em]" style={{ backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Precise.</span>}
                </div>
                <p className="text-[13px] text-[#98989D]">{t}</p>
              </div>
            ))}
          </div>
        </Stage>
        <Specs rows={[
          ["Camera", "Slow — a smooth orbit or push-in on a slider or gimbal; never handheld, never fast"],
          ["Shots", "Long holds of 3–6 s; cuts on the beat, short fades"],
          ["Set", "The machine on pure black, one top light (ch. 64)"],
          ["Words", "One to three words on screen at a time, Inter SemiBold, silver or white"],
          ["End", "The logo animation and the KOLEEX melody (ch. 73, 74)"],
        ]} />
      </Section>

      <Section id="kinds" title="Kinds of video">
        <Table
          head={["Video", "Length", "Main format"]}
          rows={[
            [<B key="a">Product demonstration</B>, "60–120 s", "16:9, plus a 9:16 cut"],
            [<B key="a">Short</B>, "15–30 s", "9:16"],
            [<B key="a">How-to / tutorial</B>, "1–5 min", "16:9"],
            [<B key="a">Factory and process</B>, "60–90 s", "16:9, plus a 9:16 cut"],
            [<B key="a">Event recap</B>, "30–60 s", "9:16 and 16:9"],
            [<B key="a">Customer story</B>, "2–3 min, with written permission", "16:9"],
            [<B key="a">Message from the founder</B>, "1–2 min", "16:9 and 9:16"],
          ]}
        />
      </Section>

      <Section id="shooting" title="Shooting">
        <Specs rows={[
          ["Resolution", "4K (3840 × 2160) where possible; 1080p minimum"],
          ["Frame rate", "25 fps for everything; 50 fps for slow motion"],
          ["Stability", "Tripod or gimbal — never handheld walking shots"],
          ["Sound", "A clip-on microphone for anyone speaking; record 10 s of room silence"],
          ["Light and background", <span key="r">The same rules as photography (<Ref n={63} />)</span>],
          ["Orientation", "Shoot horizontal in 4K and keep the subject centered, so a vertical cut can be taken from it — or shoot both"],
        ]} />
      </Section>

      <Section id="formats" title="Formats">
        <Stage bg="#F5F5F7" h="auto" pad={20}>
          <div className="flex flex-wrap items-end justify-center gap-6">
            <Frame ratio="16/9" w={220} label="16:9 · 1920×1080" />
            <Frame ratio="1/1" w={124} label="1:1 · 1080×1080" />
            <Frame ratio="4/5" w={112} label="4:5 · 1080×1350" />
            <Frame ratio="9/16" w={100} label="9:16 · 1080×1920" />
          </div>
        </Stage>
        <Table
          head={["Format", "Where"]}
          rows={[
            ["16:9", "YouTube, website, presentations, exhibition screens"],
            ["9:16", "TikTok, Douyin, Instagram Reels and Stories, WeChat Channels, WhatsApp Status"],
            ["1:1 and 4:5", "Facebook, Instagram and LinkedIn feeds"],
          ]}
        />
      </Section>

      <Section id="safe" title="Safe areas for vertical video">
        <Stage bg="#F5F5F7" h="auto" pad={20}>
          <div className="flex items-center gap-8">
            <div className="relative overflow-hidden rounded-md bg-[#000000]" style={{ width: 150, aspectRatio: "9/16" }}>
              <div className="absolute inset-x-0 top-0 bg-[#DC2626]/35" style={{ height: `${(250 / 1920) * 100}%` }} />
              <div className="absolute inset-x-0 bottom-0 bg-[#DC2626]/35" style={{ height: `${(420 / 1920) * 100}%` }} />
              <div className="absolute inset-y-0 left-0 bg-[#DC2626]/35" style={{ width: `${(72 / 1080) * 100}%` }} />
              <div className="absolute inset-y-0 right-0 bg-[#DC2626]/35" style={{ width: `${(150 / 1080) * 100}%` }} />
              <div className="absolute left-[8%] top-[16%]"><Wordmark color="#FFFFFF" width={44} /></div>
              <p className="absolute bottom-[26%] left-[8%] right-[16%] text-[9px] font-bold leading-tight text-white">Four threads. One pass.</p>
            </div>
            <div className="space-y-2 text-[12px] text-[var(--text-secondary)]">
              <p><span className="inline-block h-3 w-3 rounded-sm bg-[#DC2626]/50 align-middle" /> Covered by the app’s buttons and captions</p>
              <p>Top 250 px · bottom 420 px · left 72 px · right 150 px (at 1080 × 1920)</p>
              <p>Logo, titles and subtitles stay inside the clear area.</p>
            </div>
          </div>
        </Stage>
      </Section>

      <Section id="music" title="Music — by video style">
        <Table
          head={["Video", "Music"]}
          rows={[
            [<B key="a">Product film</B>, "Calm electronic, with the machine’s stitch rhythm inside it"],
            [<B key="a">Factory and process</B>, "The machine’s own sound — little or no music"],
            [<B key="a">Launch, fair, big moment</B>, "Cinematic — deep hits and a rising pad"],
            [<B key="a">How-to and tutorial</B>, "Very quiet background music, or none"],
            [<B key="a">Founder and customer stories</B>, "Soft piano or none — the voice leads"],
            [<B key="a">Religious occasions</B>, "No music, or very calm instrumental only"],
          ]}
        />
        <Bullets items={[
          <><B>Licensed music only</B> — never popular songs.</>,
          "Music sits 15–20 dB below any voice.",
          <>Every film ends with the KOLEEX melody (<Ref n={74} />).</>,
        ]} />
      </Section>

      <Section id="video-donts" title="What never to do">
        <Bullets items={[
          "Stock footage, or AI-generated video of machines, people or places.",
          "Shaky handheld shots, or vertical video with black bars in a horizontal frame.",
          "Videos without subtitles — most are watched with the sound off.",
          <>Flashy transitions: spins, 3D flips, glitch effects (<Ref n={72} />).</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 71 · Video Kit ────────────────────────────────────────────────────── */

export function VideoKit() {
  return (
    <Chapter
      n={71}
      lead={
        <p>
          Every KOLEEX video opens and closes the same way and speaks with the same captions. The kit below
          is the frame; the content inside it changes.
        </p>
      }
      toc={[
        { id: "intro", title: "Intro" },
        { id: "outro", title: "Outro" },
        { id: "lower-thirds", title: "Name titles" },
        { id: "subtitles", title: "Subtitles" },
        { id: "thumbnail", title: "Thumbnails" },
      ]}
    >
      <Section id="intro" title="Intro — 2 to 3 seconds">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Frame label="0.0 s — black"><span /></Frame>
            <Frame label="0.3–2.1 s — the logo comes into focus"><div className="absolute inset-0 flex items-center justify-center" style={{ filter: "blur(3px)", opacity: 0.6 }}><Wordmark color="#FFFFFF" width={110} /></div></Frame>
            <Frame label="2.1 s — sharp, hold"><div className="absolute inset-0 flex items-center justify-center"><Wordmark color="#FFFFFF" width={110} /></div></Frame>
          </div>
        </Stage>
        <P>The logo movement is Focus (<Ref n={73} />), with the short melody (<Ref n={74} />). Cut to the first shot after 2–3 seconds.</P>
      </Section>

      <Section id="outro" title="Outro — 3 to 4 seconds">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <Frame w={340}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <GroupLockup color="#FFFFFF" width={150} />
              <span className="mt-2 font-mono text-[9px] text-[#D1D1D6]">www.koleexgroup.com</span>
            </div>
          </Frame>
        </Stage>
        <Specs rows={[
          ["Content", "The group lockup (ch. 43), one contact: the website or WhatsApp"],
          ["Background", "Black #000000"],
          ["Sound", "The KOLEEX melody, outro version"],
          ["Never", "A list of every social account, phone numbers in several countries"],
        ]} />
      </Section>

      <Section id="lower-thirds" title="Name titles">
        <Stage bg="#F5F5F7" h="auto" pad={20}>
          <Frame w={340} bg="#3A3A3C">
            <div className="absolute bottom-[12%] left-[6%]">
              <p className="text-[11px] font-semibold text-white">Full Name</p>
              <p className="text-[8px] text-[#D1D1D6]">Technical Engineer · KOLEEX</p>
            </div>
          </Frame>
        </Stage>
        <Specs rows={[
          ["Position", "Bottom-left (bottom-right in Arabic), inside the safe area"],
          ["Type", "Name: Inter SemiBold · Title: Inter Regular, 70% size"],
          ["On screen", "4–5 seconds, a slow fade in and out (400 ms)"],
        ]} />
      </Section>

      <Section id="subtitles" title="Subtitles">
        <Stage bg="#F5F5F7" h="auto" pad={20}>
          <Frame w={340} bg="#3A3A3C">
            <div className="absolute inset-x-0 bottom-[10%] flex justify-center">
              <span className="rounded bg-black/60 px-2 py-1 text-center text-[10px] font-semibold leading-tight text-white">Every machine is tested before it ships.</span>
            </div>
          </Frame>
        </Stage>
        <Specs rows={[
          ["Always", "Every video has subtitles — burned in for social media, an SRT file for YouTube and the website"],
          ["Type", "Inter SemiBold; Arabic and Chinese in their families (Part 3)"],
          ["Size", "48 px on 1920 × 1080 · 42 px on 1080 × 1920"],
          ["Box", "White text on black at 60%, 8 px padding"],
          ["Lines", "Two at most, about 42 characters each"],
          ["Languages", "English plus the language of the market the video is for"],
        ]} />
      </Section>

      <Section id="thumbnail" title="Thumbnails">
        <Examples cols={2}>
          <Example tone="do" caption="The logo top-left, the title in silver on the left, the machine on the right." bg="#F5F5F7" h={180}>
            <Frame w={240}>
              <div className="absolute left-3 top-3"><Wordmark color="#FFFFFF" width={44} /></div>
              <p className="absolute left-3 top-[34%] w-[46%] text-[14px] font-semibold leading-[1.05] tracking-[-0.02em]" style={{ backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Threading an overlock in 60 s</p>
              <div className="absolute bottom-[10%] right-2 w-[50%]"><MachineShot w="100%" label={false} /></div>
            </Frame>
          </Example>
          <Example tone="dont" caption="Arrows, red circles, shocked faces, long titles." bg="#F5F5F7" h={180}>
            <Frame w={240} bg="#DC2626">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center">
                <p className="text-[13px] font-black text-[#FDE047]">YOU WON’T BELIEVE THIS MACHINE!!!</p>
                <span className="text-[26px]">😱➡️</span>
              </div>
            </Frame>
          </Example>
        </Examples>
        <Specs rows={[
          ["Horizontal (YouTube)", "1280 × 720 px: the logo top-left, the title in silver on the left half, the machine on the right — like the page covers (ch. 79)"],
          ["Vertical (Reels, TikTok, Douyin, Stories)", "1080 × 1920 px: the post layout — the logo top-left, the silver headline, the machine (ch. 80)"],
          ["Title", "3–6 words, Inter SemiBold, silver or white"],
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 72 · Motion ───────────────────────────────────────────────────────── */

const DURATIONS: Array<[string, number, string]> = [
  ["press", 80, "A button pressed down"],
  ["fast", 160, "Hovers, color changes, fades of small content"],
  ["base", 240, "Menus and popovers opening, small entrances"],
  ["slow", 320, "Tabs, sheets, drawers"],
  ["flight", 460, "The big moments: an app opening, the sign-in card"],
];
const EASES: Array<[string, string, string]> = [
  ["out", "cubic-bezier(0.22, 1, 0.36, 1)", "General purpose: things arriving"],
  ["expo", "cubic-bezier(0.16, 1, 0.3, 1)", "Entrances and flights"],
  ["glide", "cubic-bezier(0.32, 0.72, 0, 1)", "Tab switching — the smoothest curve"],
  ["standard", "cubic-bezier(0.4, 0, 0.2, 1)", "Position and size changes"],
  ["pop", "cubic-bezier(0.34, 1.3, 0.5, 1)", "Menus — a faint spring, never a bounce"],
  ["exit", "cubic-bezier(0.4, 0, 1, 1)", "Leaving: accelerate away"],
];

function EaseDemo() {
  const reduced = useReducedMotion();
  const [on, setOn] = useState(false);
  return (
    <div className="w-full space-y-3">
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-medium text-white"
        style={{ background: "#567FB2" }}
      >
        <PlayIcon size={12} />Play the curves
      </button>
      {EASES.map(([name, curve]) => (
        <div key={name} className="flex items-center gap-3">
          <span className="w-20 shrink-0 font-mono text-[11px] text-[#6E6E73]">{name}</span>
          <div className="relative h-6 flex-1 rounded-full bg-[#F5F5F7]">
            <span
              className="absolute top-1 h-4 w-4 rounded-full"
              style={{
                background: "#1D1D1F",
                left: on ? "calc(100% - 20px)" : 4,
                transition: reduced ? "none" : `left 900ms ${curve}`,
              }}
            />
          </div>
        </div>
      ))}
      <p className="text-[11px] text-[#6E6E73]">Slowed to 900 ms so the shape of each curve is visible.{reduced ? " Motion is reduced on this device, so the dots jump." : ""}</p>
    </div>
  );
}

export function Motion() {
  return (
    <Chapter
      n={72}
      lead={
        <p>
          KOLEEX moves at two speeds. Brand films and marketing are slow and premium. The Koleex Hub
          interface is quick and precise. Neither ever performs for its own sake.
        </p>
      }
      toc={[
        { id: "two-speeds", title: "Two speeds" },
        { id: "principles", title: "Principles" },
        { id: "durations", title: "Durations" },
        { id: "curves", title: "Curves" },
        { id: "recipes", title: "Recipes" },
        { id: "video-motion", title: "Motion in video and graphics" },
        { id: "reduced", title: "Reduced motion" },
      ]}
    >
      <Section id="two-speeds" title="Two speeds">
        <Table
          head={["", "Brand — films, ads, the website hero", "Interface — Koleex Hub"]}
          rows={[
            [<B key="a">Feel</B>, "Slow, calm, premium", "Quick, quiet, precise"],
            [<B key="a">Durations</B>, "1.2–2.4 s for an entrance; holds of 3–6 s", "80–460 ms (the tokens below)"],
            [<B key="a">Curve</B>, "Expo out — cubic-bezier(0.16, 1, 0.3, 1)", "By token"],
            [<B key="a">Moves</B>, "Slow push-ins, focus pulls, fades, a gentle rise", "Fade, slide, scale"],
          ]}
        />
      </Section>

      <Section id="principles" title="Principles">
        <Bullets items={[
          <><B>Purposeful</B> — every movement shows a change of place or state.</>,
          <><B>The right speed</B> — slow in films, quick in the interface. Never in between.</>,
          <><B>2D</B> — slide, fade and scale. No 3D turns, no spins.</>,
          <><B>Light</B> — only position, scale and opacity animate, so motion stays smooth on any phone.</>,
        ]} />
      </Section>

      <Section id="durations" title="Durations">
        <Table head={["Token", "Duration", "Use"]} rows={DURATIONS.map(([n, d, u]) => [<Code key="n">{`--kx-dur-${n}`}</Code>, `${d} ms`, u])} />
      </Section>

      <Section id="curves" title="Curves">
        <Stage bg="#FFFFFF" h="auto" pad={20}><EaseDemo /></Stage>
        <Table head={["Token", "Curve", "Use"]} rows={EASES.map(([n, c, u]) => [<Code key="n">{`--kx-ease-${n}`}</Code>, <span key="c" className="font-mono text-[11.5px]">{c}</span>, u])} />
      </Section>

      <Section id="recipes" title="Recipes">
        <Table
          head={["Moment", "Motion"]}
          rows={[
            ["Button press", "Scale to 0.97, 80 ms"],
            ["Menu open", "Scale from 0.96 + fade, 240 ms, pop curve"],
            ["Menu close", "About 60% of the opening time, exit curve"],
            ["Tab change", "Slide 24 px + fade, 320 ms, glide — the direction flips in Arabic"],
            ["Page change", "Push with a slight parallax, about 360 ms"],
            ["Content appearing", "Fade in, 160–240 ms"],
          ]}
        />
      </Section>

      <Section id="video-motion" title="Motion in video and graphics">
        <Bullets items={[
          "Long holds, slow camera moves, cuts on the beat and soft fades. No wipes, spins, 3D flips or glitch effects.",
          "Words arrive with a slow fade and a small rise (16–24 px), 800–1200 ms.",
          "Numbers may count up once; charts may grow once. Nothing loops.",
        ]} />
      </Section>

      <Section id="reduced" title="Reduced motion">
        <Rule why="For some people motion causes discomfort. Their device setting is a request we always honour.">
          When a device asks for reduced motion, movement is replaced by simple fades or by no animation at
          all.
        </Rule>
      </Section>
    </Chapter>
  );
}

/* ── 73 · Logo Animation ───────────────────────────────────────────────── */

function Sting() {
  const reduced = useReducedMotion();
  const [run, setRun] = useState(0);
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="relative flex h-[240px] w-full items-center justify-center overflow-hidden rounded-[20px] bg-black">
        <div
          key={run}
          style={{ animation: reduced || run === 0 ? undefined : "kxbb-focus 1800ms cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <Wordmark color="#FFFFFF" width={260} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setRun((r) => r + 1)}
        className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-medium text-white"
        style={{ background: "#567FB2" }}
      >
        <PlayIcon size={12} />Play Focus
      </button>
      <style>{`
        @keyframes kxbb-focus { from { opacity: 0; filter: blur(14px); transform: scale(1.1); } to { opacity: 1; filter: blur(0); transform: scale(1); } }
      `}</style>
    </div>
  );
}

export function LogoAnimation() {
  return (
    <Chapter
      n={73}
      lead={<p>The logo arrives the way a camera finds focus: out of a soft blur, into sharp detail. One movement, slow and calm — that is Focus.</p>}
      toc={[
        { id: "sting", title: "Focus" },
        { id: "timing", title: "Timing" },
        { id: "allowed", title: "Allowed movements" },
        { id: "never", title: "Never" },
        { id: "files", title: "Files" },
      ]}
    >
      <Section id="sting" title="Focus">
        <Stage bg="#000000" h="auto" pad={24} border={false}><Sting /></Stage>
      </Section>

      <Section id="timing" title="Timing">
        <Table
          head={["Time", "What happens"]}
          rows={[
            ["0.0 s", "Black"],
            ["0.3–2.1 s", "The white logo comes from blur 14 px and scale 110% to sharp and 100%, while it fades in — expo curve"],
            ["2.1–3.5 s", "Hold, with the last note of the KOLEEX melody (ch. 74)"],
            ["3.5 s", "Cut or slow fade to the film"],
          ]}
        />
        <Specs rows={[
          ["Duration", "1.8 s for the focus; 3–4 s with the hold"],
          ["Curve", "cubic-bezier(0.16, 1, 0.3, 1)"],
          ["Background", "Black #000000 — on white, the same move with the black logo"],
        ]} />
      </Section>

      <Section id="allowed" title="Allowed movements">
        <Bullets items={[
          "Focus — the standard, for every film, ad and presentation opening or closing.",
          "A plain fade in or out, where Focus is too slow (short social clips).",
        ]} />
      </Section>

      <Section id="never" title="Never">
        <Rule why="An animation that takes the logo apart teaches people that it can be taken apart.">
          Letters never move separately. The logo is never drawn, assembled, morphed, spun, flipped, bounced,
          colored or given a glow — and never turned silver.
        </Rule>
      </Section>

      <Section id="files" title="Files">
        <P>Focus will be delivered as MP4 (1080p and 4K, on black and on white) with the melody, and as a transparent file for editors — then added to <Ref n={136} />.</P>
      </Section>
    </Chapter>
  );
}

/* ── 74 · Sound ────────────────────────────────────────────────────────── */

/* The KOLEEX melody (owner, 27/09/2026: "M4"). [note, start s, length s, bar height px] */
const MELODY: Array<[string, number, number, number]> = [["D4", 0, 0.13, 40], ["E4", 0.14, 0.13, 52], ["G4", 0.28, 0.13, 72], ["A4", 0.42, 0.16, 84], ["D5", 0.62, 2.2, 120]];

const SAMPLES = "https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/MusyngKite/";

type Voice = { inst: string; notes: string[] };
type Version = { id: string; name: string; use: string; voices: Voice[]; play: (ctx: AudioContext, out: AudioNode, b: Record<string, Record<string, AudioBuffer>>, t: number) => void };

function note(ctx: AudioContext, out: AudioNode, buf: AudioBuffer | undefined, t: number, gain: number, attack: number, dur: number, release: number) {
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.setTargetAtTime(0, t + dur, release / 3);
  src.connect(g);
  g.connect(out);
  src.start(t);
  src.stop(t + dur + release + 0.5);
}

/* A soft hall: decaying noise, made once per audio context. */
function hallImpulse(ctx: AudioContext) {
  const len = ctx.sampleRate * 3;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.3);
  }
  return ir;
}

const NOTES = MELODY.map(([n]) => n);
const VERSIONS: Version[] = [
  { id: "signature", name: "Signature", use: "The master — choir and piano", voices: [{ inst: "choir_aahs", notes: [...NOTES, "D3", "A3"] }, { inst: "acoustic_grand_piano", notes: [...NOTES, "D2", "A2"] }],
    play: (ctx, out, b, t) => {
      MELODY.forEach(([n, s, d], i) => { const long = i === 4; note(ctx, out, b.acoustic_grand_piano[n], t + s, 0.42, 0.004, long ? 2.2 : 0.3, long ? 1.6 : 0.4); note(ctx, out, b.choir_aahs[n], t + s, long ? 0.34 : 0.24, 0.03, long ? d : 0.14, long ? 1.3 : 0.12); });
      ["D2", "A2"].forEach((n) => note(ctx, out, b.acoustic_grand_piano[n], t + 0.62, 0.3, 0.004, 2.2, 1.6));
      ["D3", "A3"].forEach((n) => note(ctx, out, b.choir_aahs[n], t + 0.62, 0.2, 0.25, 2.2, 1.3));
    } },
  { id: "outro", name: "Outro", use: "The end of every film — celesta, under 2 s", voices: [{ inst: "celesta", notes: NOTES }],
    play: (ctx, out, b, t) => { [0, 0.1, 0.2, 0.3, 0.44].forEach((s, i) => note(ctx, out, b.celesta[NOTES[i]], t + s, i === 4 ? 0.5 : 0.4, 0.003, i === 4 ? 1.3 : 0.2, i === 4 ? 1 : 0.3)); } },
  { id: "grand", name: "Grand", use: "Ads, fairs, launches — choir, strings, timpani", voices: [{ inst: "choir_aahs", notes: [...NOTES, "D3", "A3"] }, { inst: "string_ensemble_1", notes: ["D3", "A3", "D4", "Gb4"] }, { inst: "timpani", notes: ["D2"] }],
    play: (ctx, out, b, t) => {
      [0, 0.26, 0.52, 0.78, 1.12].forEach((s, i) => note(ctx, out, b.choir_aahs[NOTES[i]], t + s, i === 4 ? 0.38 : 0.3, 0.06, i === 4 ? 2.6 : 0.24, i === 4 ? 1.5 : 0.2));
      Object.values(b.string_ensemble_1).forEach((x) => note(ctx, out, x, t, 0.18, 1.0, 3.4, 1.5));
      ["D3", "A3"].forEach((n) => note(ctx, out, b.choir_aahs[n], t + 1.12, 0.22, 0.3, 2.6, 1.5));
      note(ctx, out, b.timpani.D2, t + 0.96, 0.4, 0.003, 1.5, 1.2);
      note(ctx, out, b.timpani.D2, t + 1.12, 0.65, 0.003, 2, 1.5);
    } },
  { id: "notification", name: "Notification", use: "Koleex Hub — the last three notes, quick", voices: [{ inst: "vibraphone", notes: ["G4", "A4", "D5"] }],
    play: (ctx, out, b, t) => { [["G4", 0], ["A4", 0.08], ["D5", 0.17]].forEach(([n, s], i) => note(ctx, out, b.vibraphone[n as string], t + (s as number), i === 2 ? 0.5 : 0.4, 0.003, i === 2 ? 0.9 : 0.12, i === 2 ? 0.8 : 0.2)); } },
  { id: "hold", name: "Hold and ringtone", use: "Phone hold, showroom — a gentle piano loop", voices: [{ inst: "acoustic_grand_piano", notes: [...NOTES, "D3", "A3", "G3", "B3"] }],
    play: (ctx, out, b, t) => {
      for (let r = 0; r < 2; r++) {
        const o = t + r * 3.2;
        [0, 0.28, 0.56, 0.84, 1.24].forEach((s, i) => note(ctx, out, b.acoustic_grand_piano[NOTES[i]], o + s, 0.32, 0.004, i === 4 ? 1.8 : 0.5, 1));
        (r === 0 ? ["D3", "A3"] : ["G3", "B3"]).forEach((n) => note(ctx, out, b.acoustic_grand_piano[n], o + 1.24, 0.2, 0.004, 1.8, 1.2));
      }
    } },
];

function MelodyPlayer() {
  const ctxRef = useRef<{ ctx: AudioContext; verb: ConvolverNode; out: GainNode | null } | null>(null);
  const cache = useRef<Record<string, AudioBuffer>>({});
  const [state, setState] = useState<{ id: string | null; msg: string }>({ id: null, msg: "" });

  useEffect(() => () => { void ctxRef.current?.ctx.close(); }, []);

  function audio() {
    if (!ctxRef.current) {
      const ctx = new AudioContext();
      const verb = ctx.createConvolver();
      verb.buffer = hallImpulse(ctx);
      ctxRef.current = { ctx, verb, out: null };
    }
    const a = ctxRef.current;
    if (a.out) { const old = a.out; old.gain.setTargetAtTime(0, a.ctx.currentTime, 0.06); window.setTimeout(() => old.disconnect(), 500); }
    const out = a.ctx.createGain();
    out.gain.value = 0.6;
    const comp = a.ctx.createDynamicsCompressor();
    out.connect(comp); comp.connect(a.ctx.destination);
    const wet = a.ctx.createGain(); wet.gain.value = 0.34;
    out.connect(a.verb); a.verb.connect(wet); wet.connect(comp);
    a.out = out;
    return a;
  }

  async function play(v: Version) {
    const a = audio();
    await a.ctx.resume();
    setState({ id: v.id, msg: "Loading…" });
    try {
      const bufs: Record<string, Record<string, AudioBuffer>> = {};
      for (const voice of v.voices) {
        bufs[voice.inst] = {};
        await Promise.all(voice.notes.map(async (n) => {
          const url = `${SAMPLES}${voice.inst}-mp3/${n}.mp3`;
          if (!cache.current[url]) cache.current[url] = await a.ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
          bufs[voice.inst][n] = cache.current[url];
        }));
      }
      setState({ id: v.id, msg: "" });
      v.play(a.ctx, a.out as GainNode, bufs, a.ctx.currentTime + 0.08);
    } catch {
      setState({ id: null, msg: "The samples could not be loaded. Check the connection and try again." });
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[24px] bg-[var(--bg-secondary)] divide-y divide-[var(--border-faint)]">
        {VERSIONS.map((v) => (
          <div key={v.id} className="flex items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold text-[var(--text-primary)]">{v.name}</p>
              <p className="text-[14px] text-[var(--text-dim)]">{v.use}</p>
            </div>
            <button
              type="button"
              onClick={() => void play(v)}
              aria-label={`Play ${v.name}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: "#567FB2" }}
            >
              <PlayIcon size={13} />
            </button>
          </div>
        ))}
      </div>
      {state.msg && <p className="text-[13px] text-[var(--text-dim)]">{state.msg}</p>}
    </div>
  );
}

const NOTIFICATION_TONES = [
  "alert", "announce", "arrive", "beacon", "bloom", "bounce",
  "bright", "confirm", "depart", "galaxy", "inbox", "lantern",
  "mail", "marker", "message", "note", "ping", "prompt",
  "signal", "sparkle", "success", "surface", "tap", "task",
] as const;

const AI_CUES: Array<[string, string, string]> = [
  ["Rising", "action-done", "Something began, or is yours: done, sent, ready"],
  ["Falling", "action-cancelled", "Something ended or was taken away: cancelled, deleted"],
  ["Low, doubled", "error", "Attention: an error, a refusal, a failure"],
  ["Single tick", "copied", "Acknowledged: copied, thinking"],
];

function useOneAudio() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => { ref.current?.pause(); }, []);
  const play = (src: string) => {
    ref.current?.pause();
    if (playing === src) { setPlaying(null); return; }
    const a = new Audio(src);
    a.volume = 0.6;
    ref.current = a;
    setPlaying(src);
    a.onended = () => setPlaying(null);
    void a.play().catch(() => setPlaying(null));
  };
  return { playing, play };
}

function SoundButton({ label, src, playing, onPlay }: { label: string; src: string; playing: boolean; onPlay: (s: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPlay(src)}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-start text-[12.5px] transition-colors ${playing ? "border-[var(--text-primary)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"} bg-[var(--bg-secondary)]`}
    >
      {playing ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
      <span>{label}</span>
    </button>
  );
}

export function Sound() {
  const { playing, play } = useOneAudio();
  return (
    <Chapter
      n={74}
      lead={
        <p>
          KOLEEX has a melody: five notes that anyone can learn to recognise. Around it, the Koleex Hub
          sounds are quiet, short and meaningful — none of them is there to decorate.
        </p>
      }
      toc={[
        { id: "melody", title: "The KOLEEX melody" },
        { id: "versions", title: "One melody, five versions" },
        { id: "principles", title: "Principles" },
        { id: "grammar", title: "The sound grammar" },
        { id: "tones", title: "Koleex Hub notification tones" },
        { id: "video-sound", title: "Sound in video" },
      ]}
    >
      <Section id="melody" title="The KOLEEX melody">
        <Stage bg="#000000" h="auto" pad={40}>
          <div className="w-full text-center">
            <div className="flex items-end justify-center gap-3">
              {MELODY.map(([note, , , h], i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <span className="w-10 rounded-full md:w-14" style={{ height: h, background: i === MELODY.length - 1 ? SILVER.css : "#3A3A3C" }} />
                  <span className="text-[15px] font-semibold text-[#F5F5F7]">{note.replace(/[0-9]/g, "")}</span>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-[44ch] text-[17px] leading-[1.5] text-[#A1A1A6]">Five notes on a five-note scale heard from Cairo to Taizhou — rising, then landing on one open note.</p>
          </div>
        </Stage>
        <Specs rows={[
          ["Notes", "D4 · E4 · G4 · A4 → D5 (held), over an open fifth D3–A3"],
          ["Rhythm", "Four short notes, then the long one"],
          ["Rule", "The melody never changes. The instrument, tempo and length change with the use."],
        ]} />
      </Section>

      <Section id="versions" title="One melody, five versions">
        <MelodyPlayer />
        <Note>Sketches played in the browser with recorded instrument samples (MusyngKite General MIDI soundfont, CC BY-SA 3.0). The final versions are recorded with real musicians and a choir and delivered as files (<Ref n={136} />).</Note>
      </Section>

      <Section id="principles" title="Principles">
        <Bullets items={[
          <><B>One family.</B> Soft, glassy tones on one scale, so every sound belongs to KOLEEX.</>,
          <><B>Short.</B> Under half a second for interface cues.</>,
          <><B>Quiet.</B> Never startling; always under the user’s control — every sound can be turned off.</>,
          <><B>Meaningful.</B> A sound always matches an event; the same event always makes the same sound.</>,
        ]} />
      </Section>

      <Section id="grammar" title="The sound grammar">
        <P>Koleex AI speaks in four kinds of sound. Press to listen:</P>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {AI_CUES.map(([kind, file, meaning]) => (
            <div key={file} className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
              <SoundButton label={kind} src={`/sounds/ai/${file}.mp3`} playing={playing === `/sounds/ai/${file}.mp3`} onPlay={play} />
              <span className="text-[12.5px] leading-5 text-[var(--text-secondary)]">{meaning}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="tones" title="Koleex Hub notification tones">
        <P>The 24 tones people can choose for notifications, messages and calls in Koleex Hub (Settings › Sounds):</P>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {NOTIFICATION_TONES.map((t) => (
            <SoundButton key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} src={`/sounds/${t}.mp3`} playing={playing === `/sounds/${t}.mp3`} onPlay={play} />
          ))}
        </div>
        <Note>The Koleex AI cues come from a public-domain (CC0) sound pack; the source is recorded in the Hub next to the files.</Note>
      </Section>

      <Section id="video-sound" title="Sound in video">
        <Specs rows={[
          ["Voice", "Clear and in front: normalised to about −16 LUFS for social media and YouTube"],
          ["Music", "Licensed, instrumental, 15–20 dB below the voice"],
          ["Effects", "Few and soft — the machine's own sound is often the best one"],
        ]} />
      </Section>

    </Chapter>
  );
}
