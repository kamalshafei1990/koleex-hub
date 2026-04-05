"use client";

import { Plus, Trash2 } from "lucide-react";
import type { MarketPriceFormState, ModelFormState } from "@/types/product-form";
import { COUNTRIES } from "@/types/product-form";

interface Props {
  prices: MarketPriceFormState[];
  models: ModelFormState[];
  onChange: (p: MarketPriceFormState[]) => void;
}

export default function MarketPricesSection({ prices, models, onChange }: Props) {
  const add = (modelTempId: string) => {
    const country = COUNTRIES.find(c => !prices.some(p => p._modelTempId === modelTempId && p.country_code === c.code));
    if (!country) return;
    onChange([...prices, {
      _tempId: crypto.randomUUID(),
      _modelTempId: modelTempId,
      country_code: country.code,
      currency: country.currency,
      market_price: "",
      head_only_price: "",
      complete_set_price: "",
    }]);
  };

  const update = (tempId: string, updates: Partial<MarketPriceFormState>) => {
    onChange(prices.map(p => {
      if (p._tempId !== tempId) return p;
      if (updates.country_code) {
        const c = COUNTRIES.find(co => co.code === updates.country_code);
        if (c) updates.currency = c.currency;
      }
      return { ...p, ...updates };
    }));
  };

  const remove = (tempId: string) => {
    onChange(prices.filter(p => p._tempId !== tempId));
  };

  if (models.length === 0) {
    return (
      <div className="py-8 text-center border border-dashed border-white/[0.06] rounded-xl">
        <p className="text-[13px] text-[var(--text-ghost)]">Add models first before setting market prices.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <label className="block text-[12px] font-medium text-[var(--text-subtle)]">Market Prices by Country</label>
      {models.map(model => {
        const modelPrices = prices.filter(p => p._modelTempId === model._tempId);
        return (
          <div key={model._tempId} className="bg-[var(--bg-surface-subtle)] rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-medium text-[var(--text-secondary)]">{model.model_name || "Untitled Model"}</span>
              <button
                onClick={() => add(model._tempId)}
                className="h-7 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-subtle)] hover:text-[var(--text-primary)]/80 flex items-center gap-1 transition-colors"
              >
                <Plus className="h-3 w-3" /> Add Country
              </button>
            </div>
            {modelPrices.length === 0 ? (
              <p className="text-[12px] text-[var(--text-whisper)] py-3 text-center">No country prices set.</p>
            ) : (
              <div className="space-y-2">
                {modelPrices.map(p => (
                  <div key={p._tempId} className="flex items-center gap-2">
                    <select
                      value={p.country_code}
                      onChange={(e) => update(p._tempId, { country_code: e.target.value })}
                      className="w-[140px] h-9 px-2 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] outline-none"
                    >
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    <span className="text-[11px] text-[var(--text-dim)] w-[36px] text-center">{p.currency}</span>
                    <input
                      type="text"
                      value={p.market_price}
                      onChange={(e) => update(p._tempId, { market_price: e.target.value })}
                      placeholder="Price"
                      className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
                    />
                    <input
                      type="text"
                      value={p.head_only_price}
                      onChange={(e) => update(p._tempId, { head_only_price: e.target.value })}
                      placeholder="Head"
                      className="w-[80px] h-9 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
                    />
                    <input
                      type="text"
                      value={p.complete_set_price}
                      onChange={(e) => update(p._tempId, { complete_set_price: e.target.value })}
                      placeholder="Set"
                      className="w-[80px] h-9 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
                    />
                    <button onClick={() => remove(p._tempId)} className="h-9 w-9 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-red-400/70 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
