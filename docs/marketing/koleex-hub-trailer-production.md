# Koleex Hub Launch Trailer — Production Bible
**"THE FUTURE WORKS HERE."** · 50s cinematic teaser · Higgsfield pipeline
Status: PLAN — awaiting owner approval before shot generation (credits).

---

## 0. Creative Lock

| Decision | Value |
|---|---|
| Slogan | THE FUTURE WORKS HERE. |
| Duration | ~50s (9 shots) |
| Palette | **Hub Blue family** — deep `#3E6796` · steel `#567FB2` · sky `#7FA9D6` · ice `#BCD8F0` on cinematic black `#050608`. White typography. NO generic cyan, no rainbow. |
| Type | Helvetica Neue (UltraLight for display lines, Medium for labels) |
| Identity anchors | KOLEEX wordmark untouchable · hub gradient script · the AI orb face (dark glass sphere, two white bars, blue aura) as the "digital brain" |
| Feel | Apple/NVIDIA launch film. Luxury technology. No people, no offices, no SaaS clichés. |

**Pipeline per shot:** keyframe still (nano_banana_pro, brand-locked) → image-to-video (kling/veo via Higgsfield `generate_video`) → assemble. Never one-prompt-whole-video.

---

## 1. Asset Preparation Checklist

### 1.1 Brand assets — ✅ HAVE
- `public/brand/hub-logo/` — horizontal + stacked lockups (dark/light, transparent PNG), `hub-script.png`
- KOLEEX wordmark SVG (`KoleexLogo.tsx` path data) — vector-clean
- App icons v2 (512/192/180/maskable)
- AI orb face renders (`idle-face.png` 800×800; can render any emotion/size from code)
- Hub Blue palette + Helvetica Neue

### 1.2 Brand assets — 🔧 GENERATE (Higgsfield stills, logo-as-reference)
- [ ] **Holographic logo** — lockup as translucent blue hologram, scanlines, volumetric glow
- [ ] **Glass logo** — lockup in clear glass, ice-blue refractions on black
- [ ] **Metallic logo** — brushed dark-chrome lockup, steel-blue rim light
> Rule: generate ATMOSPHERE around the real lockup (image reference), never let the model redraw letterforms. Composite real PNG on top where fidelity slips.

### 1.3 UI showcase screens — 🔧 CAPTURE + DRESS
Real app, dark mode, seeded demo data, 2560×1440, no empty states:
Dashboard/Home · Koleex AI (orb + streaming reply) · CRM board · Products catalog · Discuss · Projects · To-do · Calendar · Employees · HR · Inventory · Analytics/Finance · Quotation editor.
Dress pass: perspective-tilt onto glass panels (keyframe prompts handle this — screens supplied as references).

### 1.4 Icon fleet — ✅ HAVE (SVGs in `src/components/icons/ui/` + app icons) → export 15 white icons on transparency for "holographic planets": AI (orb face), CRM, Products, Discuss, Projects, Tasks, Calendar, Planning, Employees, HR, Inventory, Finance, Reports, Analytics, Documents.

### 1.5 Motion textures — 🔧 GENERATE (loopable stills → video)
- [ ] particle field (data dust, steel-blue on black)
- [ ] energy wave (ice-blue ribbon)
- [ ] data streams (light trails)
- [ ] neural mesh (nodes + edges, depth fog)
- [ ] glass panel blank (for UI compositing)

---

## 2. Storyboard — 9 shots / ~50s

> Every Higgsfield video prompt below is final copy-paste form. Camera and light language kept consistent: black void `#050608`, single-source volumetric Hub Blue, shallow depth, slow confident moves. Aspect 16:9, generate 1080p+.

### SHOT 1 — "The Digital Universe" · 5s
- **Camera:** slow dolly forward, 24mm feel, tiny drift.
- **Visual:** infinite black; millions of micro particles (steel-blue, sizes 1-3px) fade in like a star field; faint depth fog.
- **VO:** *"Every company has information."*
- **Sound:** sub-bass heartbeat, airy digital atmosphere.
- **Transition out:** particles accelerate subtly → match-cut.
- **Higgsfield prompt:** `Cinematic 5 second shot, camera dollies slowly forward through infinite black space filled with millions of tiny glowing steel-blue data particles (#567FB2), like a galaxy of information, volumetric haze, shallow depth of field, premium technology film, dark luxury, no text, no people, 16:9`

### SHOT 2 — "Information Chaos" · 6s
- **Camera:** handheld-nervous orbit, speed ramps.
- **Visual:** the particles condense into thousands of chaotic floating objects — glass documents, spreadsheets, mail envelopes, chat bubbles, charts — colliding, overlapping, notification pings flashing; frame gets crowded and uncomfortable.
- **VO:** *"But information…"* (beat) *"…isn't intelligence."*
- **Sound:** rising cluster of UI pings detuning into noise; tension riser.
- **Higgsfield prompt:** `Cinematic 6 second shot, chaotic swarm of hundreds of translucent glass UI objects — documents, spreadsheets, email envelopes, chat bubbles, charts — tumbling and colliding in dark space, cold steel-blue monochrome lighting, nervous orbiting camera with speed ramps, overwhelming digital chaos, premium dark tech film, no text, 16:9`

### SHOT 3 — "Silence" · 3s
- **Camera:** static.
- **Visual:** hard freeze → all objects dissolve to black in 12 frames; one small ice-blue light breathes at center (the orb's aura being born).
- **VO:** none. **Sound:** total cut to silence; one deep sub pulse.
- **Higgsfield prompt:** `Cinematic 3 second shot, all floating debris freezes and dissolves into pure black, empty darkness, then one single soft ice-blue point of light (#BCD8F0) fades in at center and gently breathes, absolute minimalism, volumetric glow, premium, no text, 16:9`

### SHOT 4 — "The Beginning" · 5s
- **Camera:** slow push-in on the light.
- **Visual:** the light blooms into the **real Koleex Hub lockup** (holographic treatment); a single radial pulse of Hub Blue energy travels outward; distant debris begins drifting TOWARD camera/logo.
- **Keyframe:** holographic-logo still (asset 1.2) → image-to-video.
- **Sound:** first melodic note; pulse whoosh.
- **Higgsfield prompt (i2v on holo-logo still):** `Slow cinematic push-in, the holographic KOLEEX hub logo glows and emits one expanding circular pulse of steel-blue energy, distant glass debris in the darkness begins drifting toward it, gravitational, volumetric light rays, premium product launch film, 5 seconds, 16:9`

### SHOT 5 — "The Ecosystem" · 6s
- **Camera:** slow heroic orbit (30°).
- **Visual:** 8 module icons as glass "planets" (real SVG icons on glass discs) fall into clean orbits around the glowing lockup; orbit trails = thin ice lines.
- **VO:** *"Imagine everything connected."*
- **Sound:** melody opens; soft harmonic per planet lock-in.
- **Higgsfield prompt (i2v on composed still of icons orbiting logo):** `Cinematic 6 second orbit shot, eight glowing glass discs with white minimal app icons orbit a radiant central logo like planets, thin ice-blue orbital light trails, deep black space, steel-blue volumetric lighting, elegant, precise, premium technology, 16:9`

### SHOT 6 — "The Assembly" · 6s
- **Camera:** fast push through assembling layers, ends locked.
- **Visual:** planets shatter into glass panels that fly and SNAP into one floating dashboard (real Home screen as reference dressed on glass) — Iron-Man-armor assembly energy.
- **VO:** *"One platform. One workflow. One intelligence."* (three beats)
- **Sound:** three mechanical-glass impacts on the three lines.
- **Higgsfield prompt (i2v, dashboard keyframe):** `Cinematic 6 second shot, dozens of translucent glass UI panels fly in from all directions and assemble with precise mechanical snaps into one floating premium dark dashboard interface, ice-blue edge lighting, sparks of light at each connection, futuristic assembly like high-tech armor, black void, 16:9`

### SHOT 7 — "Inside Koleex Hub" · 8s
- **Camera:** one continuous fly-through (speed-ramped), through 5 "rooms".
- **Visual:** camera dives INTO the dashboard glass → flies past living UI walls: Koleex AI orb answering (typing glow) → project cards flipping to done → calendar events snapping into place → product cards streaming by → analytics lines climbing. Each wall = dressed real screen.
- **Sound:** pulse locked to cuts; rising.
- **Higgsfield prompt:** `Cinematic 8 second continuous fly-through inside a digital glass universe of dark premium UI walls, passing a glowing dark glass AI sphere with two white eyes answering in light, project cards flipping, a calendar grid assembling, product cards streaming past, analytics curves rising, steel-blue and ice lighting, motion blur, speed ramps, luxury technology, no text, 16:9`

### SHOT 8 — "The Neural Company" · 6s
- **Camera:** pull-back reveal, rising crane.
- **Visual:** exit the glass → the whole system seen from above: a neural brain of thousands of Hub Blue connections, modules as bright nodes, **the AI orb face glowing at the center**.
- **VO:** *"Your company…"* (beat) *"…finally thinks…"* (beat) *"…as one."*
- **Sound:** orchestra swells; connections light in waves with each phrase.
- **Higgsfield prompt (i2v on neural-brain still w/ orb center):** `Cinematic 6 second pull-back reveal, a vast glowing neural network shaped like a digital brain floating in black space, thousands of steel-blue connections firing in waves, a small dark glass sphere with two white vertical eyes glowing at the very center, god-ray volumetric light, epic scale, premium, 16:9`

### SHOT 9 — "Final Reveal" · 5s
- **Camera:** static, breathing scale only.
- **Visual:** cut to black (0.5s hold) → real lockup fades in (glass treatment, subtle aura) → type on, line by line, UltraLight tracking-wide: `KOLEEX HUB` → `THE FUTURE` / `WORKS HERE.` Final frame holds 1.5s.
- **Sound:** massive single impact → clean silence with soft aura shimmer.
- **Build:** this shot is pure post (real assets + type) — NO generation, guaranteeing perfect letterforms.

---

## 3. Voice-Over Script (final)

> Male, deep, calm, unhurried. Documentary gravity, not ad energy. ~55 words.

```
Every company has information.
But information… isn't intelligence.

(silence)

Imagine everything connected.
One platform. One workflow. One intelligence.

Your company… finally thinks… as one.

Koleex Hub. The future works here.
```
(Generate via Higgsfield `generate_audio` / voice library; EN master, AR + ZH variants later.)

## 4. Sound Design Map
| Zone | Shots | Direction |
|---|---|---|
| Chaos | 1-2 | heartbeat sub, digital air, detuned ping cluster, riser |
| Void | 3 | hard silence + one sub pulse |
| Birth | 4-5 | first melody, pulse whoosh, harmonic lock-ins |
| Power | 6-7 | glass impacts ×3, driving pulse, speed-ramp whooshes |
| Apotheosis | 8-9 | orchestral swell → single massive impact → shimmer out |

## 5. Editing Timeline
| t | Shot | Audio event |
|---|---|---|
| 0:00-0:05 | 1 | VO line 1 |
| 0:05-0:11 | 2 | VO line 2 (split) |
| 0:11-0:14 | 3 | silence |
| 0:14-0:19 | 4 | melody starts |
| 0:19-0:25 | 5 | VO line 3 |
| 0:25-0:31 | 6 | VO 3 beats + impacts |
| 0:31-0:39 | 7 | pulse build |
| 0:39-0:45 | 8 | VO final triplet |
| 0:45-0:50 | 9 | impact → logo hold |

## 6. Execution Order
1. ✅ This plan approved
2. Generate 3 logo treatments (holo/glass/metal) → owner picks the hero treatment
3. Capture + dress 13 UI screens (needs a signed-in session for screenshots)
4. Generate keyframe stills for shots 1-8 → owner review contact sheet
5. Animate approved keyframes (image-to-video) shot by shot
6. VO + assemble + sound
