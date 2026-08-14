"use client";

/* Settings → Wallpaper. Organised after macOS System Settings → Wallpaper
   (owner reference, 2026-08-15): a hero showing the current choice, then
   groups of thumbnails, Your Photos, and Colors.
   ---------------------------------------------------------------------------
   WHAT WAS TAKEN FROM THE REFERENCE
     · the hero at the top, so the current choice is a picture and not a word
     · groups of tiles rather than a list of names
     · Your Photos with an "Add photo" tile as the first cell
     · Colors as round swatches, not square tiles — a colour has no composition
       to preview, and a circle stops it competing with the picture tiles
     · a badge on tiles that move, the way the reference marks live ones

   WHAT WAS NOT
     · "Show All (35)". macOS needs it for 81 landscapes. We have four per
       group; a disclosure that reveals nothing is furniture. It goes in when a
       group passes SHOW_ALL_AFTER, not before.
     · Screen Saver / Clock Appearance — there is no such surface here.

   WHAT THE REFERENCE HAS NO EQUIVALENT OF, AND WE NEED
     A readability control. macOS wallpapers sit behind icons; ours sit behind
     52 backdrop-filter surfaces carrying live text, and a bright photo makes
     the Hub unreadable rather than merely busy. Uploads keep a minimum dim
     that the slider cannot go under. */

import { useRef, useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import { withDefaults } from "@/lib/access-control";
import { updateAccountPreferences } from "@/lib/accounts-admin";
import { uploadToStorage } from "@/lib/storage-client";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";
import { getTheme } from "@/lib/display-prefs";
import {
  DEFAULT_WALLPAPER_ID, MAX_UPLOAD_EDGE, PHOTO_ID, PHOTO_MIN_DIM, WALLPAPERS,
  announceWallpaper, backgroundCss, dimFor, fitStyle, getWallpaper, nameKeyFor,
  asImage, isShader, type Wallpaper, type WallpaperFit, type WallpaperGroup, type WallpaperPref,
} from "@/lib/wallpaper";
import { useWallpaper } from "@/lib/useWallpaper";
import { SHADER_WALLPAPERS } from "@/lib/wallpaper-shaders";
import { SettingsCard, ControlRow, SelectControl } from "./ui";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";

/* A group only earns a disclosure once it has more tiles than fit two rows. */
const SHOW_ALL_AFTER = 8;

const GROUPS: { id: WallpaperGroup; labelKey: string; footerKey?: string }[] = [
  { id: "koleex", labelKey: "wp.group.koleex", footerKey: "wp.group.koleex.footer" },
  { id: "dynamic", labelKey: "wp.group.dynamic", footerKey: "wp.group.dynamic.footer" },
  { id: "still", labelKey: "wp.group.still" },
];

export default function WallpaperTab(
  { account, onChanged }: { account: AccountWithLinks; onChanged?: () => void },
) {
  const { t } = useTranslation(settingsT);
  const current = useWallpaper();
  const theme = getTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Applied immediately and saved in the background — the whole app is the
     preview, so a Save button would mean choosing a wallpaper you cannot see.
     Same contract as Display & accessibility. */
  const choose = (next: WallpaperPref) => {
    announceWallpaper(next);
    const prefs = withDefaults(account.preferences);
    /* REFRESH AFTER THE SAVE, and it is not politeness — it is the second half
       of a bug. Every settings writer sends `withDefaults(account.preferences)`
       WHOLESALE, so a writer holding a stale account re-saves the wallpaper it
       was loaded with and undoes a newer choice. Measured: pick Ember, switch
       language, reload — the ground came back Tide. Telling identity the
       account moved keeps the next writer's copy current. */
    void updateAccountPreferences(account.id, { ...prefs, wallpaper: next })
      .then(() => onChanged?.());
  };

  const pick = (w: Wallpaper) => choose({
    id: w.id,
    /* The photo is deliberately CARRIED, not dropped. Someone trying the
       colours should not lose the picture they uploaded — it stays in Your
       photos, one tap away. */
    photoUrl: current.photoUrl, photoPath: current.photoPath,
    fit: current.fit,
  });

  const onFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) { setError(t("wp.notAnImage")); return; }
    setBusy(true);
    try {
      /* Resized BEFORE upload, not after. A 24MP phone photo is 92MB of GPU
         memory and several MB across a link that is often Shanghai-to-Europe;
         at MAX_UPLOAD_EDGE it is roughly 12MB and a few hundred KB. Doing it
         here also means the bytes never leave the device at full size. */
      const blob = await downscale(file, MAX_UPLOAD_EDGE);
      const path = `wallpapers/${account.id}/${Date.now()}.jpg`;
      const res = await uploadToStorage("media", path, blob, {
        contentType: "image/jpeg", cacheControl: "31536000", upsert: true,
      });
      if (!res.ok || !res.data.publicUrl) { setError(t("wp.uploadFailed")); return; }
      const prev = current.photoPath;
      choose({ id: PHOTO_ID, photoUrl: res.data.publicUrl, photoPath: path, fit: current.fit ?? "fill" });
      /* Replace, don't accumulate. Best-effort: a failed cleanup must never
         fail the change the user actually asked for. */
      if (prev && prev !== path) {
        void import("@/lib/storage-client").then((m) => m.removeFromStorage("media", [prev]).catch(() => {}));
      }
    } catch {
      setError(t("wp.uploadFailed"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = () => {
    const path = current.photoPath;
    choose({ id: DEFAULT_WALLPAPER_ID });
    if (path) void import("@/lib/storage-client").then((m) => m.removeFromStorage("media", [path]).catch(() => {}));
  };

  const isPhoto = current.id === PHOTO_ID && !!current.photoUrl;
  const currentName = isPhoto ? t("wp.yourPhoto") : t(nameKeyFor(current));

  return (
    <div className="space-y-4">
      <SettingsCard title={t("wp.title")} subtitle={t("wp.subtitle")}>
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <Preview pref={current} theme={theme} name={currentName} className="w-full sm:w-56 h-32 shrink-0" />
          <div className="flex-1 min-w-0 w-full space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">{t("wp.current")}</div>
              <div className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{currentName}</div>
            </div>

            {/* Fill style is a photo question. A gradient has no aspect ratio
                to preserve, so offering the control would be a dead input. */}
            {isPhoto && (
              <ControlRow label={t("wp.fit")} last>
                <SelectControl<WallpaperFit>
                  value={current.fit ?? "fill"}
                  onChange={(fit) => choose({ ...current, fit })}
                  options={[
                    { value: "fill", label: t("wp.fit.fill") },
                    { value: "fit", label: t("wp.fit.fit") },
                    { value: "stretch", label: t("wp.fit.stretch") },
                    { value: "center", label: t("wp.fit.center") },
                  ]}
                />
              </ControlRow>
            )}

            {/* Readability. Hidden for the wave field, which owns its own
                contrast floor and has been signed off with it. */}
            {current.id !== DEFAULT_WALLPAPER_ID && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-[var(--text-primary)]">{t("wp.dim")}</span>
                  <span className="text-[12px] text-[var(--text-dim)] tabular-nums">{dimFor(current)}%</span>
                </div>
                <input
                  type="range" min={isPhoto ? PHOTO_MIN_DIM : 0} max={90} step={2}
                  value={dimFor(current)}
                  onChange={(e) => choose({ ...current, dim: Number(e.target.value) })}
                  className="kx-range w-full mt-1.5"
                  aria-label={t("wp.dim")}
                />
                <p className="text-[11px] text-[var(--text-dim)] mt-1">
                  {isPhoto ? t("wp.dim.photoFloor") : t("wp.dim.hint")}
                </p>
              </div>
            )}
          </div>
        </div>
      </SettingsCard>

      {/* ── Built-in groups ─────────────────────────────────────────────── */}
      {GROUPS.map((g) => (
        <TileGroup
          key={g.id}
          title={t(g.labelKey)}
          footer={g.footerKey ? t(g.footerKey) : undefined}
          items={WALLPAPERS.filter((w) => w.group === g.id)}
          current={current} theme={theme} onPick={pick} t={t}
        />
      ))}

      {/* ── Live patterns ───────────────────────────────────────────────── */}
      <SettingsCard title={t("wp.group.shader")} subtitle={t("wp.group.shader.footer")}>
        <div className="flex flex-wrap gap-3">
          {SHADER_WALLPAPERS.map((sw) => (
            <Tile
              key={sw.id}
              selected={current.id === sw.id}
              label={t(sw.nameKey)}
              badge={t("wp.live.badge")}
              sprite={sw.sprite}
              onClick={() => choose({ ...current, id: sw.id })}
            />
          ))}
        </div>
      </SettingsCard>

      {/* ── Your photos ─────────────────────────────────────────────────── */}
      <SettingsCard title={t("wp.group.photo")} subtitle={t("wp.group.photo.footer")}>
        <div className="flex flex-wrap gap-3">
          <button
            type="button" disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="w-[104px] h-[68px] rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-1 text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-60"
          >
            {busy ? <SpinnerIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
            <span className="text-[10px]">{busy ? t("wp.uploading") : t("wp.addPhoto")}</span>
          </button>

          {isPhoto && (
            <div className="relative">
              <Tile
                selected label={t("wp.yourPhoto")}
                background={backgroundCss(current, theme, 12) ?? ""}
                fit={current.fit} onClick={() => { /* already active */ }}
              />
              <button
                type="button" onClick={removePhoto} title={t("wp.removePhoto")}
                className="absolute -top-1.5 -end-1.5 w-6 h-6 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-red-400 flex items-center justify-center"
              >
                <TrashIcon className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        {error && <p className="text-[12px] text-red-400 mt-2">{error}</p>}
        <input
          ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
        />
      </SettingsCard>

      {/* ── Colors ──────────────────────────────────────────────────────── */}
      {/* The colours do two jobs, and which one is obvious from what is
          selected: with a still wallpaper they ARE the wallpaper; with a live
          pattern they colour it. That is the owner's ask — "when I select a
          colour the wallpaper colour changes" — and it needs no second row of
          swatches to say so, only a line of text that changes with it. */}
      <SettingsCard
        title={t("wp.group.color")}
        subtitle={isShader(current) ? t("wp.tintNote") : undefined}
      >
        <div className="flex flex-wrap gap-2.5">
          {WALLPAPERS.filter((w) => w.group === "color").map((w) => {
            const tinting = isShader(current);
            const swatch = theme === "light" ? w.light : w.dark;
            const on = tinting ? current.tint === swatch : current.id === w.id;
            return (
              <button
                key={w.id} type="button" title={t(w.nameKey)}
                onClick={() => (tinting ? choose({ ...current, tint: swatch }) : pick(w))}
                aria-label={t(w.nameKey)} aria-pressed={on}
                className={`w-9 h-9 rounded-full border transition-shadow flex items-center justify-center ${
                  on ? "border-[var(--border-focus)] shadow-[0_0_0_2px_var(--border-focus)]"
                     : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]"}`}
                style={{ backgroundImage: asImage(theme === "light" ? w.light : w.dark) }}
              >
                {on && <CheckIcon className="h-3.5 w-3.5 text-white mix-blend-difference" />}
              </button>
            );
          })}
        </div>
      </SettingsCard>
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

function TileGroup({ title, footer, items, current, theme, onPick, t }: {
  title: string; footer?: string; items: Wallpaper[];
  current: WallpaperPref; theme: "dark" | "light";
  onPick: (w: Wallpaper) => void; t: (k: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const overflows = items.length > SHOW_ALL_AFTER;
  const shown = overflows && !expanded ? items.slice(0, SHOW_ALL_AFTER) : items;
  return (
    <SettingsCard title={title} subtitle={footer}>
      <div className="flex flex-wrap gap-3">
        {shown.map((w) => (
          <Tile
            key={w.id}
            selected={current.id === w.id}
            label={t(w.nameKey)}
            badge={w.kind === "live" ? t("wp.live.badge") : w.kind === "dynamic" ? t("wp.dynamic.badge") : undefined}
            background={asImage(theme === "light" ? w.light : w.dark)}
            onClick={() => onPick(w)}
          />
        ))}
      </div>
      {overflows && (
        <button
          type="button" onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          {expanded ? "−" : `+${items.length - SHOW_ALL_AFTER}`}
        </button>
      )}
    </SettingsCard>
  );
}

/* One sheet, one request, twenty-three real pictures.
   ---------------------------------------------------------------------------
   The first version drew every live tile with the same derived gradient, so
   all twenty-five looked IDENTICAL and the picker could not be picked from —
   the owner spotted it immediately, and they were right: a chooser whose
   options are indistinguishable is not a chooser.

   The reason for the shortcut was real — twenty-five live tiles means
   twenty-five WebGL contexts, and browsers cap them around sixteen, so the
   grid would start losing contexts. The answer is neither: each shader was
   rendered ONCE offscreen at 208x136 and packed into a single sprite sheet.
   One request (our measured law is round-trips, not bytes), no contexts, and
   every tile shows the thing it actually is. */
const SHEET = "/wallpapers/shader-thumbs.webp";
const SHEET_COLS = 5;
const TILE_W = 104, TILE_H = 68;

function spriteStyle(index: number): React.CSSProperties {
  const col = index % SHEET_COLS, row = Math.floor(index / SHEET_COLS);
  return {
    backgroundImage: `url("${SHEET}")`,
    backgroundSize: `${SHEET_COLS * TILE_W}px auto`,
    backgroundPosition: `-${col * TILE_W}px -${row * TILE_H}px`,
    backgroundRepeat: "no-repeat",
  };
}

function Tile({ selected, label, badge, background, sprite, fit, onClick }: {
  selected: boolean; label: string; badge?: string; background?: string;
  sprite?: number; fit?: WallpaperFit; onClick: () => void;
}) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={selected}
      className="group w-[104px] text-start"
    >
      <span
        className={`block w-full h-[68px] rounded-xl border overflow-hidden relative transition-shadow ${
          selected ? "border-[var(--border-focus)] shadow-[0_0_0_2px_var(--border-focus)]"
                   : "border-[var(--border-subtle)] group-hover:border-[var(--border-strong)]"}`}
        style={sprite !== undefined
          ? spriteStyle(sprite)
          : { backgroundImage: background, ...fitStyle(fit) }}
      >
        {badge && (
          <span className="absolute top-1 start-1 px-1.5 py-[1px] rounded-full text-[9px] font-medium bg-black/45 text-white backdrop-blur-[2px]">
            {badge}
          </span>
        )}
        {selected && (
          <span className="absolute bottom-1 end-1 w-4 h-4 rounded-full bg-[var(--border-focus)] flex items-center justify-center">
            <CheckIcon className="h-2.5 w-2.5 text-white" />
          </span>
        )}
      </span>
      <span className={`block mt-1 text-[11px] truncate ${selected ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}`}>
        {label}
      </span>
    </button>
  );
}

/** The hero — a miniature Hub, not a swatch.
 *
 *  It began as wallpaper + scrim and nothing else, and the owner caught it
 *  immediately: with Graphite on a light theme the box looked EMPTY. Nothing
 *  was broken. Graphite's light face is #F2F4F7 → #D9DDE3, the scrim whitens
 *  it further, and the card behind is #f8f8f8 — pale on pale on pale, with a
 *  hairline border for evidence.
 *
 *  The deeper mistake was next to it: the control beside this box is called
 *  READABILITY, and the box contained nothing to read. A preview that cannot
 *  demonstrate the one thing its slider changes is decoration.
 *
 *  So it now carries real text over real glass. Drag the slider and you watch
 *  the words win or lose against the ground, which is the actual question.
 *  The strings are the brand and the wallpaper's own name — real copy at real
 *  contrast, and no new translation keys to drift. */
function Preview({ pref, theme, name, className = "" }: {
  pref: WallpaperPref; theme: "dark" | "light"; name: string; className?: string;
}) {
  const bg = backgroundCss(pref, theme, new Date().getHours());
  const w = getWallpaper(pref.id);
  const raw = bg ?? (theme === "light" ? w?.light : w?.dark) ?? "";
  const fallback = raw ? asImage(raw) : "";
  return (
    <div
      className={`rounded-2xl border border-[var(--border-subtle)] overflow-hidden relative ${className}`}
      style={{ backgroundImage: fallback, ...fitStyle(pref.fit) }}
    >
      <div className="absolute inset-0" style={{ background: scrim(theme, dimFor(pref)) }} />
      {/* The miniature. Proportions echo the Hub — a header strip, a card
          carrying type, a row of app tiles — so the eye reads it as "this is
          my screen" rather than "this is a colour". */}
      <div className="absolute inset-0 p-2.5 flex flex-col gap-1.5 pointer-events-none select-none">
        <div className="flex items-center gap-1">
          <span className="h-1 w-6 rounded-full bg-[var(--text-primary)] opacity-45" />
          <span className="ms-auto h-1 w-3 rounded-full bg-[var(--text-primary)] opacity-25" />
        </div>
        <div className="kx-glass rounded-lg border border-[var(--border-subtle)] px-2 py-1.5 flex-1 flex flex-col justify-center">
          <span className="text-[10px] font-semibold leading-tight text-[var(--text-primary)] truncate">
            KOLEEX hub
          </span>
          <span className="text-[9px] leading-tight text-[var(--text-dim)] truncate">{name}</span>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="kx-glass h-3.5 flex-1 rounded-md border border-[var(--border-subtle)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* The hero is small, so the ground's full radial floor would read as a vignette
   rather than as dimming. A flat wash at the same strength is the honest
   preview at this size. */
function scrim(theme: "dark" | "light", dim: number): string {
  const rgb = theme === "light" ? "247,249,252" : "5,7,12";
  return `rgba(${rgb},${(Math.min(100, Math.max(0, dim)) / 100 * 0.72).toFixed(3)})`;
}

/* ── image downscale ────────────────────────────────────────────────────── */

/** Longest edge to `max`, re-encoded as JPEG. Uses createImageBitmap where it
 *  exists so a large file is decoded off the main thread and the Settings
 *  screen does not freeze while someone's 24MP photo is read. */
async function downscale(file: File, max: number): Promise<Blob> {
  const src: ImageBitmap | HTMLImageElement =
    typeof createImageBitmap === "function"
      ? await createImageBitmap(file)
      : await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = URL.createObjectURL(file);
        });

  const sw = "width" in src ? src.width : 0;
  const sh = "height" in src ? src.height : 0;
  const scale = Math.min(1, max / Math.max(sw, sh));
  const w = Math.round(sw * scale), h = Math.round(sh * scale);

  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
  if ("close" in src) src.close();

  return new Promise<Blob>((resolve, reject) =>
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.86));
}
