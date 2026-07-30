"use client";

/* ---------------------------------------------------------------------------
   FeatureCardsSection — "Main Devices & Functions" photo cards, the catalog
   pattern (Stao/YILI): each card is a photo + title + short description of a
   device, function or part. Universal — every product in every category gets
   this section; the public page renders the cards as a uniform grid.
   Images upload like any product file, including the screenshot-region
   capture so device photos can be clipped straight out of catalog PDFs.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import AngleUpIcon from "@/components/icons/ui/AngleUpIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import { uploadProductFile } from "@/lib/products-admin";
import { ScreenshotCaptureModal } from "@/components/quotations/ScreenshotCaptureModal";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import type { FeatureCard } from "@/types/supabase";

interface Props {
  cards: FeatureCard[];
  onChange: (cards: FeatureCard[]) => void;
}

const inp =
  "w-full px-3 py-2 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]";

export default function FeatureCardsSection({ cards, onChange }: Props) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [shotIdx, setShotIdx] = useState<number | null>(null);

  const update = (i: number, patch: Partial<FeatureCard>) =>
    onChange(cards.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(cards.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cards.length) return;
    const next = [...cards];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...cards, { image_url: "", title: "", description: "" }]);

  const pick = async (i: number, file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploadingIdx(i);
    const res = await uploadProductFile(file);
    setUploadingIdx(null);
    if (res) update(i, { image_url: res.url });
  };

  return (
    <div className="space-y-3">
      {cards.length === 0 && (
        <p className="text-[12px] text-[var(--text-ghost)] py-4 text-center border border-dashed border-[var(--border-subtle)] rounded-xl">
          {t("fc.empty", "No cards yet. Each card is a photo + short explanation of one device, function or part — like the supplier catalogs.")}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 space-y-2.5">
            {/* photo */}
            <div className="relative">
              <label className="group relative block w-full aspect-[16/10] rounded-lg overflow-hidden cursor-pointer border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-ghost)] transition-colors">
                {c.image_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image_url} alt="" className="h-full w-full object-contain p-1.5" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white">
                        <UploadIcon className="h-3.5 w-3.5" /> {t("sup.change", "Change")}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-[var(--text-ghost)]">
                    <PictureIcon className="h-6 w-6" />
                    <span className="text-[10px] font-medium">{t("sup.addPhoto", "Add photo")}</span>
                  </div>
                )}
                {uploadingIdx === i && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-surface)]/85 text-[10px] font-medium text-[var(--text-muted)]">
                    {t("sup.uploading", "Uploading…")}
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingIdx === i}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(i, f); }} />
              </label>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setShotIdx(i); }}
                title={t("sup.screenshotTitle", "Capture part of the screen (or paste a screenshot)")}
                className="absolute bottom-2 right-2 h-7 px-2.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] shadow-sm transition-colors"
              >
                <CameraIcon className="h-3 w-3" /> {t("sup.screenshot", "Screenshot")}
              </button>
            </div>

            <input
              className={inp}
              value={c.title}
              maxLength={60}
              placeholder={t("fc.titlePh", "e.g. Intelligent Cutter")}
              onChange={(e) => update(i, { title: e.target.value })}
            />
            <textarea
              className={`${inp} resize-y`}
              rows={2}
              value={c.description}
              maxLength={300}
              placeholder={t("fc.descPh", "What this device/function does and why it matters…")}
              onChange={(e) => update(i, { description: e.target.value })}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  aria-label={t("fc.moveUp", "Move up")}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-ghost)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors">
                  <AngleUpIcon className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === cards.length - 1}
                  aria-label={t("fc.moveDown", "Move down")}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-ghost)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors">
                  <AngleDownIcon className="h-3 w-3" />
                </button>
              </div>
              <button type="button" onClick={() => remove(i)}
                aria-label={t("fc.removeCard", "Remove card")}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)] hover:border-[var(--state-error,#FF3333)]/40 transition-colors">
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-dashed border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-ghost)] transition-colors"
      >
        <PlusIcon className="h-3.5 w-3.5" /> {t("fc.addCard", "Add card")}
      </button>

      <ScreenshotCaptureModal
        open={shotIdx !== null}
        onCapture={(file) => { if (shotIdx !== null) void pick(shotIdx, file); }}
        onClose={() => setShotIdx(null)}
      />
    </div>
  );
}
