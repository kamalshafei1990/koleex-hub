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
  announceWallpaper, backgroundCss, dimFor, fitStyle, getWallpaper,
  asImage, type Wallpaper, type WallpaperFit, type WallpaperGroup, type WallpaperPref,
} from "@/lib/wallpaper";
import { useWallpaper } from "@/lib/useWallpaper";
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
  const currentName = isPhoto
    ? t("wp.yourPhoto")
    : t(getWallpaper(current.id)?.nameKey ?? "wp.hubLive");

  return (
    <div className="space-y-4">
      <SettingsCard title={t("wp.title")} subtitle={t("wp.subtitle")}>
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <Preview pref={current} theme={theme} className="w-full sm:w-56 h-32 shrink-0" />
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
      <SettingsCard title={t("wp.group.color")}>
        <div className="flex flex-wrap gap-2.5">
          {WALLPAPERS.filter((w) => w.group === "color").map((w) => {
            const on = current.id === w.id;
            return (
              <button
                key={w.id} type="button" onClick={() => pick(w)} title={t(w.nameKey)}
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

function Tile({ selected, label, badge, background, fit, onClick }: {
  selected: boolean; label: string; badge?: string; background: string;
  fit?: WallpaperFit; onClick: () => void;
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
        style={{ backgroundImage: background, ...fitStyle(fit) }}
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

/** The hero. Shows the real thing including its scrim, so what you see is what
 *  the Hub will look like — not the raw gradient with the dimming imagined. */
function Preview({ pref, theme, className = "" }: {
  pref: WallpaperPref; theme: "dark" | "light"; className?: string;
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
