"use client";

import { Plus, Trash2 } from "lucide-react";
import type { TranslationFormState } from "@/types/product-form";
import { LOCALES } from "@/types/product-form";

interface Props {
  translations: TranslationFormState[];
  onChange: (t: TranslationFormState[]) => void;
}

export default function TranslationsSection({ translations, onChange }: Props) {
  const usedLocales = translations.map(t => t.locale);
  const availableLocales = LOCALES.filter(l => !usedLocales.includes(l.code));

  const add = () => {
    if (!availableLocales.length) return;
    onChange([...translations, {
      _tempId: crypto.randomUUID(),
      locale: availableLocales[0].code,
      product_name: "",
      description: "",
    }]);
  };

  const update = (tempId: string, updates: Partial<TranslationFormState>) => {
    onChange(translations.map(t => t._tempId === tempId ? { ...t, ...updates } : t));
  };

  const remove = (tempId: string) => {
    onChange(translations.filter(t => t._tempId !== tempId));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <label className="text-[12px] font-medium text-white/50">Product Translations</label>
        <button
          onClick={add}
          disabled={!availableLocales.length}
          className="h-8 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[12px] text-white/60 hover:text-white/80 flex items-center gap-1.5 transition-colors disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" /> Add Translation
        </button>
      </div>
      {translations.length === 0 ? (
        <p className="text-[13px] text-white/20 py-6 text-center border border-dashed border-white/[0.06] rounded-xl">No translations. Add one for each language.</p>
      ) : (
        <div className="space-y-3">
          {translations.map(t => {
            const localeName = LOCALES.find(l => l.code === t.locale)?.name || t.locale;
            return (
              <div key={t._tempId} className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <select
                    value={t.locale}
                    onChange={(e) => update(t._tempId, { locale: e.target.value })}
                    className="h-8 px-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[12px] text-white/70 outline-none"
                  >
                    <option value={t.locale}>{localeName}</option>
                    {availableLocales.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                  <button onClick={() => remove(t._tempId)} className="h-7 w-7 flex items-center justify-center rounded-md text-white/20 hover:text-red-400/70 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-white/40 mb-1">Product Name ({localeName})</label>
                  <input
                    type="text"
                    value={t.product_name}
                    onChange={(e) => update(t._tempId, { product_name: e.target.value })}
                    placeholder={`Product name in ${localeName}`}
                    className="w-full h-10 px-4 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[13px] text-white placeholder:text-white/25 outline-none focus:border-white/20"
                    dir={t.locale === "ar" || t.locale === "ur" ? "rtl" : "ltr"}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-white/40 mb-1">Description ({localeName})</label>
                  <textarea
                    value={t.description}
                    onChange={(e) => update(t._tempId, { description: e.target.value })}
                    placeholder={`Description in ${localeName}`}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[13px] text-white placeholder:text-white/25 outline-none focus:border-white/20 resize-y"
                    dir={t.locale === "ar" || t.locale === "ur" ? "rtl" : "ltr"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
