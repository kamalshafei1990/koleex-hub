/* ---------------------------------------------------------------------------
   sounds-preview — the owner's listening page, generated from the catalog.

   `npm run sounds:preview -- <out.html>` writes one self-contained page: every
   cue in src/lib/sounds/catalog.ts, playable, with the same scheduling the
   app uses (a port of voice/tones.ts scheduleTone). The recipes are embedded
   from the catalog at generation time, so the page can never drift from
   what ships — regenerate it after editing the catalog.

   The page keeps the owner's verdict per sound in the browser (keep / change /
   none) and writes them out as one block of text to paste back.
   --------------------------------------------------------------------------- */

import { writeFileSync } from "node:fs";
import { SOUND_CATALOG, SOUND_MAX_SECONDS, soundLength } from "../src/lib/sounds/catalog";
import { TONE_GAIN } from "../src/lib/voice/tones";

const GROUP_TITLES: Record<string, string> = {
  call: "المكالمة الصوتية",
  chat: "الشات المكتوب",
  dictation: "الإملاء الصوتي",
  actions: "الأدوات والإجراءات",
  general: "عام",
};

const data = SOUND_CATALOG.map((s) => ({
  key: s.key,
  group: s.group,
  label: s.label.ar,
  when: s.when.ar,
  en: s.label.en,
  notes: s.notes,
  len: Math.round(soundLength(s.notes) * 1000),
  defaultOn: s.defaultOn,
}));

const html = `<title>أصوات Koleex AI</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root {
    --bg: #0D0D0D; --surface: #141414; --line: rgba(255,255,255,0.12); --line-strong: rgba(255,255,255,0.24);
    --text: #FFFFFF; --dim: #AAAAAA; --blue: #0066FF; --red: #FF3333; --keep: #2FBF71;
    --font: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif; --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  }
  html { color-scheme: dark; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--font); font-size: 15px; line-height: 1.6; padding-block: 28px 64px; padding-inline: 20px; }
  main { max-width: 760px; margin-inline: auto; display: grid; gap: 28px; }
  header { display: grid; gap: 10px; }
  h1 { font-size: 26px; font-weight: 600; margin: 0; letter-spacing: 0; text-wrap: balance; }
  header p { margin: 0; color: var(--dim); max-width: 60ch; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 22px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
  .bar label { display: flex; align-items: center; gap: 10px; color: var(--dim); font-size: 13px; }
  input[type=range] { accent-color: var(--blue); width: 160px; }
  .btn { font: inherit; font-size: 14px; font-weight: 500; color: var(--text); background: transparent; border: 1px solid var(--line-strong); border-radius: 999px; padding: 8px 16px; cursor: pointer; }
  .btn:hover { border-color: var(--text); }
  .btn.primary { background: var(--text); color: var(--bg); border-color: var(--text); }
  section { display: grid; gap: 10px; }
  h2 { font-size: 12px; font-weight: 600; color: var(--dim); margin: 0; letter-spacing: 0; padding-inline-start: 4px; }
  .row { display: grid; grid-template-columns: 52px 1fr auto; gap: 14px; align-items: center; padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
  .row.off { border-style: dashed; }
  .play { width: 52px; height: 52px; border-radius: 50%; border: 0; background: var(--blue); color: #fff; cursor: pointer; display: grid; place-items: center; transition: transform 120ms; }
  .play:active { transform: scale(0.94); }
  .play.on { box-shadow: 0 0 0 6px rgba(0,102,255,0.28); }
  .play svg { width: 20px; height: 20px; }
  .meta { display: grid; gap: 4px; min-width: 0; }
  .name { font-weight: 600; font-size: 16px; }
  .when { color: var(--dim); font-size: 13px; }
  .tech { display: flex; align-items: center; gap: 10px; color: var(--dim); font-family: var(--mono); font-size: 11.5px; direction: ltr; }
  .tech svg { width: 72px; height: 22px; }
  .tech .badge { border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; }
  .verdict { display: flex; gap: 6px; }
  .verdict button { font: inherit; font-size: 12.5px; color: var(--dim); background: transparent; border: 1px solid var(--line); border-radius: 999px; padding: 6px 11px; cursor: pointer; }
  .verdict button[aria-pressed=true][data-v=keep] { color: var(--keep); border-color: var(--keep); }
  .verdict button[aria-pressed=true][data-v=change] { color: var(--blue); border-color: var(--blue); }
  .verdict button[aria-pressed=true][data-v=none] { color: var(--red); border-color: var(--red); }
  .out { display: grid; gap: 10px; }
  textarea { width: 100%; box-sizing: border-box; min-height: 160px; font-family: var(--mono); font-size: 12.5px; color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px; direction: ltr; }
  :is(button, input, textarea):focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
  .note { color: var(--dim); font-size: 13px; }
  @media (max-width: 520px) { .row { grid-template-columns: 48px 1fr; } .row .verdict { grid-column: 1 / -1; } .tech { display: none; } }
  @media (prefers-reduced-motion: reduce) { .play { transition: none; } }
</style>
<main dir="rtl" lang="ar">
  <header>
    <h1>أصوات Koleex AI</h1>
    <p>كل الأصوات هنا مصنوعة بالكود، نفس المحرك اللي بيشغّل نغمة «جاهز يسمعك» في المكالمة. اسمع كل صوت، وعلّم عليه: <b>تمام</b> يعني يفضل زي ما هو، <b>غيّره</b> يعني عايز بديل، <b>بدون صوت</b> يعني اللحظة دي تفضل صامتة. في الآخر دوس «انسخ اختياراتي» وابعتهالي.</p>
  </header>
  <div class="bar">
    <button class="btn primary" id="playAll" type="button">شغّل الكل بالترتيب</button>
    <label for="vol">مستوى الصوت <input id="vol" type="range" min="0.2" max="2" step="0.1" value="1"></label>
    <span class="note">على الآيفون لازم تدوس مرة الأول عشان الصوت يشتغل.</span>
  </div>
  <div id="groups"></div>
  <div class="out">
    <button class="btn" id="copy" type="button">انسخ اختياراتي</button>
    <textarea id="summary" readonly aria-label="اختياراتي"></textarea>
  </div>
</main>
<script>
  const CATALOG = ${JSON.stringify(data)};
  const GROUPS = ${JSON.stringify(GROUP_TITLES)};
  const BASE_GAIN = ${TONE_GAIN};
  const MAX_S = ${SOUND_MAX_SECONDS};
  const RAMP = 0.012;
  let ctx = null;
  function audio() {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  /* The app's scheduler, note for note (voice/tones.ts scheduleTone). */
  function schedule(notes, gain) {
    const c = audio(); if (!c) return 0;
    const t0 = c.currentTime; let end = t0;
    for (const n of notes) {
      const osc = c.createOscillator(); const g = c.createGain();
      osc.type = n.wave || "sine";
      const start = t0 + n.at, stop = start + n.dur, peak = gain * (n.level == null ? 1 : n.level);
      osc.frequency.setValueAtTime(n.freq, start);
      if (n.glideTo != null) osc.frequency.linearRampToValueAtTime(n.glideTo, stop);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(peak, start + RAMP);
      g.gain.setValueAtTime(peak, Math.max(start + RAMP, stop - RAMP));
      g.gain.linearRampToValueAtTime(0, stop);
      osc.connect(g); g.connect(c.destination); osc.start(start); osc.stop(stop);
      if (stop > end) end = stop;
    }
    return end - t0;
  }
  const vol = document.getElementById("vol");
  const gain = () => BASE_GAIN * Number(vol.value);
  /* The notes as a tiny score: pitch up, time across. */
  function glyph(notes) {
    const W = 72, H = 22, len = Math.max(0.2, notes.reduce((e, n) => Math.max(e, n.at + n.dur), 0));
    const fs = notes.flatMap((n) => [n.freq, n.glideTo == null ? n.freq : n.glideTo]);
    const lo = Math.min(...fs) * 0.9, hi = Math.max(...fs) * 1.1;
    const y = (f) => H - 3 - ((Math.log(f) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (H - 6);
    const x = (t) => 2 + (t / len) * (W - 4);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + notes.map((n) =>
      '<line x1="' + x(n.at).toFixed(1) + '" y1="' + y(n.freq).toFixed(1) + '" x2="' + x(n.at + n.dur).toFixed(1) + '" y2="' + y(n.glideTo == null ? n.freq : n.glideTo).toFixed(1) + '" stroke="' + (n.wave === "triangle" ? "#FF3333" : "#0066FF") + '" stroke-width="3" stroke-linecap="round"/>').join("") + "</svg>";
  }
  const store = { get(k) { try { return localStorage.getItem("kx-sound:" + k) || ""; } catch { return ""; } }, set(k, v) { try { localStorage.setItem("kx-sound:" + k, v); } catch {} } };
  const root = document.getElementById("groups");
  const order = ["call", "chat", "dictation", "actions", "general"];
  for (const g of order) {
    const items = CATALOG.filter((s) => s.group === g); if (!items.length) continue;
    const sec = document.createElement("section");
    sec.innerHTML = "<h2>" + GROUPS[g] + "</h2>";
    for (const s of items) {
      const row = document.createElement("div"); row.className = "row" + (s.defaultOn ? "" : " off"); row.id = "row-" + s.key;
      row.innerHTML =
        '<button class="play" type="button" id="play-' + s.key + '" aria-label="شغّل ' + s.label + '"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>' +
        '<div class="meta"><div class="name">' + s.label + '</div><div class="when">' + s.when + (s.defaultOn ? "" : " · <span style=\\"color:#AAAAAA\\">مقفول افتراضيًا</span>") + '</div>' +
        '<div class="tech">' + glyph(s.notes) + '<span>' + s.key + '</span><span class="badge">' + s.len + ' ms</span></div></div>' +
        '<div class="verdict" role="group" aria-label="رأيك">' +
        ['keep','change','none'].map((v) => '<button type="button" data-v="' + v + '" id="v-' + s.key + '-' + v + '" aria-pressed="' + (store.get(s.key) === v) + '">' + ({keep:'تمام',change:'غيّره',none:'بدون صوت'})[v] + '</button>').join("") + '</div>';
      sec.appendChild(row);
      const play = row.querySelector(".play");
      play.addEventListener("click", () => { const d = schedule(s.notes, gain()); play.classList.add("on"); setTimeout(() => play.classList.remove("on"), Math.max(150, d * 1000)); });
      row.querySelectorAll(".verdict button").forEach((b) => b.addEventListener("click", () => {
        const v = b.dataset.v; const cur = store.get(s.key); const next = cur === v ? "" : v; store.set(s.key, next);
        row.querySelectorAll(".verdict button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === next)));
        summarise();
      }));
    }
    root.appendChild(sec);
  }
  function summarise() {
    const lines = CATALOG.map((s) => { const v = store.get(s.key); return v ? s.key + ": " + ({keep:"keep",change:"CHANGE",none:"no sound"})[v] : null; }).filter(Boolean);
    document.getElementById("summary").value = lines.length ? "Koleex AI sounds — my choices\\n" + lines.join("\\n") : "";
  }
  summarise();
  document.getElementById("copy").addEventListener("click", async () => { summarise(); const t = document.getElementById("summary"); t.select(); try { await navigator.clipboard.writeText(t.value); } catch {} });
  document.getElementById("playAll").addEventListener("click", async () => {
    audio(); let t = 0;
    for (const s of CATALOG) { const btn = document.getElementById("play-" + s.key); setTimeout(() => btn.click(), t * 1000); t += Math.min(MAX_S, s.len / 1000) + 0.7; }
  });
</script>
`;

const out = process.argv[2] || "sounds-preview.html";
writeFileSync(out, html);
console.log(`wrote ${out} (${SOUND_CATALOG.length} sounds)`);
