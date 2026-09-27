"use client";

/* Chapters 70–74: video, the video kit, motion, logo animation, sound.

   The motion values are the Hub's own tokens (globals.css --kx-dur-* and
   --kx-ease-*), and the sounds are the Hub's own files under public/sounds —
   the book plays the real thing. Every demo respects prefers-reduced-motion. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import PlayIcon from "@/components/icons/ui/PlayIcon";
import PauseIcon from "@/components/icons/ui/PauseIcon";
import {
  B, Bullets, Chapter, Code, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";

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

function Frame({ ratio = "16/9", w = 240, bg = "#0A0A0A", children, label }: { ratio?: string; w?: number; bg?: string; children?: ReactNode; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative overflow-hidden rounded-md shadow-[0_0_0_1px_rgba(255,255,255,0.12)]" style={{ width: w, aspectRatio: ratio, background: bg }}>{children}</div>
      {label && <span className="font-mono text-[10px] text-[#4B5563]">{label}</span>}
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
          Video shows what a photograph cannot: a machine running, a seam forming, a technician at work.
          KOLEEX videos are short, steady, subtitled — and, like our photographs, always real.
        </p>
      }
      toc={[
        { id: "kinds", title: "Kinds of video" },
        { id: "shooting", title: "Shooting" },
        { id: "formats", title: "Formats" },
        { id: "safe", title: "Safe areas for vertical video" },
        { id: "music", title: "Music" },
        { id: "video-donts", title: "What never to do" },
      ]}
    >
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
        <Stage bg="#F5F5F5" h="auto" pad={20}>
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
        <Stage bg="#F5F5F5" h="auto" pad={20}>
          <div className="flex items-center gap-8">
            <div className="relative overflow-hidden rounded-md bg-[#0A0A0A]" style={{ width: 150, aspectRatio: "9/16" }}>
              <div className="absolute inset-x-0 top-0 bg-[#DC2626]/35" style={{ height: `${(250 / 1920) * 100}%` }} />
              <div className="absolute inset-x-0 bottom-0 bg-[#DC2626]/35" style={{ height: `${(420 / 1920) * 100}%` }} />
              <div className="absolute inset-y-0 left-0 bg-[#DC2626]/35" style={{ width: `${(72 / 1080) * 100}%` }} />
              <div className="absolute inset-y-0 right-0 bg-[#DC2626]/35" style={{ width: `${(150 / 1080) * 100}%` }} />
              <div className="absolute left-[8%] top-[16%]"><Wordmark color="#FFFFFF" width={44} /></div>
              <p className="absolute bottom-[26%] left-[8%] right-[16%] text-[9px] font-bold leading-tight text-white">Four threads. One pass.</p>
            </div>
            <div className="space-y-2 text-[12px] text-[var(--text-secondary)]">
              <p><span className="inline-block h-3 w-3 rounded-sm bg-[#DC2626]/50 align-middle" /> Covered by the app&apos;s buttons and captions</p>
              <p>Top 250 px · bottom 420 px · left 72 px · right 150 px (at 1080 × 1920)</p>
              <p>Logo, titles and subtitles stay inside the clear area.</p>
            </div>
          </div>
        </Stage>
      </Section>

      <Section id="music" title="Music">
        <Bullets items={[
          <><B>Licensed music only</B> — from the platform&apos;s own library or bought with a licence that covers our use. Never popular songs.</>,
          "Instrumental, calm and modern; sits 15–20 dB below any voice.",
          "Videos for religious occasions use no music, or only very calm instrumental music.",
          <>The sound rules for the Hub and the logo are in <Ref n={74} />.</>,
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
        <Stage bg="#F5F5F5" h="auto" pad={20}>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Frame label="0.0 s — Ink"><span /></Frame>
            <Frame label="0.6 s — logo revealed"><div className="absolute inset-0 flex items-center justify-center"><Wordmark color="#FFFFFF" width={110} /></div></Frame>
            <Frame label="1.4 s — Hub line"><div className="absolute inset-0 flex flex-col items-center justify-center gap-2"><Wordmark color="#FFFFFF" width={110} /><div className="h-[2px] w-[110px]" style={{ background: "linear-gradient(90deg,#567FB2,#BCD8F0)" }} /></div></Frame>
          </div>
        </Stage>
        <P>The logo movement is the standard sting in <Ref n={73} />. Cut to the first shot after 2–3 seconds.</P>
      </Section>

      <Section id="outro" title="Outro — 3 to 4 seconds">
        <Stage bg="#F5F5F5" h="auto" pad={20}>
          <Frame w={320}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Wordmark color="#FFFFFF" width={150} />
              <span className="text-[7px] font-semibold uppercase tracking-[0.24em] text-[#9CA3AF]">Industrial Garment Machinery</span>
              <span className="mt-2 font-mono text-[8px] text-[#7FA9D6]">www.koleexgroup.com</span>
            </div>
          </Frame>
        </Stage>
        <Specs rows={[
          ["Content", "Logo, descriptor (or tagline), one contact: website or WhatsApp"],
          ["Background", "Ink #0A0A0A"],
          ["Never", "A list of every social account, phone numbers in several countries, or music louder than the rest of the video"],
        ]} />
      </Section>

      <Section id="lower-thirds" title="Name titles">
        <Stage bg="#F5F5F5" h="auto" pad={20}>
          <Frame w={340} bg="#4B5563">
            <div className="absolute bottom-[12%] left-[6%]">
              <p className="text-[11px] font-semibold text-white">Full Name</p>
              <p className="text-[8px] text-[#E5E7EB]">Technical Engineer · KOLEEX</p>
              <div className="mt-1 h-[2px] w-10" style={{ background: "linear-gradient(90deg,#567FB2,#BCD8F0)" }} />
            </div>
          </Frame>
        </Stage>
        <Specs rows={[
          ["Position", "Bottom-left (bottom-right in Arabic), inside the safe area"],
          ["Type", "Name: Inter SemiBold · Title: Inter Regular, 70% size"],
          ["On screen", "4–5 seconds, fade in and out (160 ms)"],
        ]} />
      </Section>

      <Section id="subtitles" title="Subtitles">
        <Stage bg="#F5F5F5" h="auto" pad={20}>
          <Frame w={340} bg="#4B5563">
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
          <Example tone="do" caption="One strong frame, a short title, the logo small." bg="#F5F5F5" h={180}>
            <Frame w={240}>
              <div className="absolute inset-0 flex flex-col justify-between p-3">
                <Wordmark color="#FFFFFF" width={50} />
                <p className="text-[15px] font-bold leading-tight text-white">Threading an<br />overlock in 60 s</p>
              </div>
            </Frame>
          </Example>
          <Example tone="dont" caption="Arrows, red circles, shocked faces, long titles." bg="#F5F5F5" h={180}>
            <Frame w={240} bg="#DC2626">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center">
                <p className="text-[13px] font-black text-[#FDE047]">YOU WON&apos;T BELIEVE THIS MACHINE!!!</p>
                <span className="text-[26px]">😱➡️</span>
              </div>
            </Frame>
          </Example>
        </Examples>
        <Specs rows={[["Size", "1280 × 720 px (YouTube) · 1080 × 1920 cover for vertical"], ["Title", "3–6 words, Inter Bold"]]} />
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
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0A0A0A] px-3 text-[12.5px] font-semibold text-white"
      >
        <PlayIcon size={12} />Play the curves
      </button>
      {EASES.map(([name, curve]) => (
        <div key={name} className="flex items-center gap-3">
          <span className="w-20 shrink-0 font-mono text-[11px] text-[#4B5563]">{name}</span>
          <div className="relative h-6 flex-1 rounded-full bg-[#F5F5F5]">
            <span
              className="absolute top-1 h-4 w-4 rounded-full"
              style={{
                background: "#567FB2",
                left: on ? "calc(100% - 20px)" : 4,
                transition: reduced ? "none" : `left 900ms ${curve}`,
              }}
            />
          </div>
        </div>
      ))}
      <p className="text-[11px] text-[#4B5563]">Slowed to 900 ms so the shape of each curve is visible.{reduced ? " Motion is reduced on this device, so the dots jump." : ""}</p>
    </div>
  );
}

export function Motion() {
  return (
    <Chapter
      n={72}
      lead={
        <p>
          Motion explains what changed: where something came from, where it went. KOLEEX motion is quick,
          quiet and precise — it never performs for its own sake.
        </p>
      }
      toc={[
        { id: "principles", title: "Principles" },
        { id: "durations", title: "Durations" },
        { id: "curves", title: "Curves" },
        { id: "recipes", title: "Recipes" },
        { id: "video-motion", title: "Motion in video and graphics" },
        { id: "reduced", title: "Reduced motion" },
      ]}
    >
      <Section id="principles" title="Principles">
        <Bullets items={[
          <><B>Purposeful</B> — every movement shows a change of place or state.</>,
          <><B>Quick</B> — interface motion is over in less than half a second.</>,
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
          "Cuts and short fades between shots. No wipes, spins, 3D flips or glitch effects.",
          "Text arrives with a fade and a small rise (8–16 px), 240–320 ms.",
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
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative flex h-[200px] w-full items-center justify-center overflow-hidden rounded-xl bg-[#0A0A0A]">
        <div key={run} className="flex flex-col items-center gap-3">
          <div
            style={{
              clipPath: "inset(0 0 0 0)",
              animation: reduced || run === 0 ? undefined : "kxbb-reveal 600ms cubic-bezier(0.16,1,0.3,1) both",
            }}
          >
            <Wordmark color="#FFFFFF" width={240} />
          </div>
          <div
            className="h-[3px] w-[240px] origin-left"
            style={{
              background: "linear-gradient(90deg,#567FB2,#BCD8F0)",
              animation: reduced || run === 0 ? undefined : "kxbb-line 600ms cubic-bezier(0.22,1,0.36,1) 1000ms both",
            }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setRun((r) => r + 1)}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0A0A0A] px-3 text-[12.5px] font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.16)]"
      >
        <PlayIcon size={12} />Play the sting
      </button>
      <style>{`
        @keyframes kxbb-reveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
        @keyframes kxbb-line { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      `}</style>
    </div>
  );
}

export function LogoAnimation() {
  return (
    <Chapter
      n={73}
      lead={
        <p>
          The logo moves as one piece. It is revealed, never assembled: the artwork stays exactly as drawn,
          and only the way it appears is animated.
        </p>
      }
      toc={[
        { id: "sting", title: "The standard sting" },
        { id: "allowed", title: "Allowed movements" },
        { id: "never", title: "Never" },
        { id: "files", title: "Files" },
      ]}
    >
      <Section id="sting" title="The standard sting">
        <Stage bg="#FFFFFF" h="auto" pad={20}><Sting /></Stage>
        <Table
          head={["Time", "What happens"]}
          rows={[
            ["0.0–0.6 s", "The logo is revealed left to right by a mask (expo curve)"],
            ["1.0–1.6 s", "The Hub line grows under it"],
            ["1.6–2.4 s", "Hold; then cut or fade to the video"],
          ]}
        />
      </Section>

      <Section id="allowed" title="Allowed movements">
        <Bullets items={[
          "Fade in or out.",
          "Mask reveal — left to right (right to left in Arabic material).",
          "Slide a short distance with a fade.",
          "Scale from 96% to 100% with a fade.",
        ]} />
      </Section>

      <Section id="never" title="Never">
        <Rule why="An animation that takes the logo apart teaches people that it can be taken apart.">
          Letters never move separately. The logo is never drawn line by line, built from pieces, morphed,
          spun, flipped in 3D, bounced or swept with a glow.
        </Rule>
      </Section>

      <Section id="files" title="Files">
        <P>The sting will be produced as MP4 (1080p and 4K, on Ink and on White) and as a transparent file for editors, and added to <Ref n={136} />.</P>
      </Section>
    </Chapter>
  );
}

/* ── 74 · Sound ────────────────────────────────────────────────────────── */

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
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-start text-[12.5px] transition-colors ${playing ? "border-[#567FB2] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"} bg-[var(--bg-secondary)]`}
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
          KOLEEX sounds are quiet, short and meaningful. Each one tells you something — a message arrived, an
          action finished, something needs attention — and none of them is there to decorate.
        </p>
      }
      toc={[
        { id: "principles", title: "Principles" },
        { id: "grammar", title: "The sound grammar" },
        { id: "tones", title: "Koleex Hub notification tones" },
        { id: "video-sound", title: "Sound in video" },
        { id: "sonic-logo", title: "The sonic logo" },
      ]}
    >
      <Section id="principles" title="Principles">
        <Bullets items={[
          <><B>One family.</B> Soft, glassy tones on one scale, so every sound belongs to KOLEEX.</>,
          <><B>Short.</B> Under half a second for interface cues.</>,
          <><B>Quiet.</B> Never startling; always under the user&apos;s control — every sound can be turned off.</>,
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

      <Section id="sonic-logo" title="The sonic logo">
        <P>A short sound for the logo sting (<Ref n={73} />) — one to two seconds, from the same glass family — is planned. Until it is approved, the sting plays silently or over the video&apos;s own music.</P>
      </Section>
    </Chapter>
  );
}
