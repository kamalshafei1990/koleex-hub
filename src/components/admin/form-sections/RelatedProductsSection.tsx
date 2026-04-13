"use client";

import { useState } from "react";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import LinkIcon from "@/components/icons/ui/LinkIcon";
import { searchProducts } from "@/lib/products-admin";
import type { RelatedProductFormState } from "@/types/product-form";

interface Props {
  related: RelatedProductFormState[];
  onChange: (r: RelatedProductFormState[]) => void;
  currentProductId?: string;
}

export default function RelatedProductsSection({ related, onChange, currentProductId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; product_name: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const res = await searchProducts(q, currentProductId);
    setResults(res.filter(r => !related.some(rel => rel.related_id === r.id)));
    setSearching(false);
  };

  const add = (product: { id: string; product_name: string }) => {
    onChange([...related, { related_id: product.id, related_name: product.product_name, order: related.length }]);
    setQuery("");
    setResults([]);
  };

  const remove = (relatedId: string) => {
    onChange(related.filter(r => r.related_id !== relatedId));
  };

  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--text-subtle)] mb-3">Related Products</label>

      {/* Search */}
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => doSearch(e.target.value)}
          placeholder="Search products to link..."
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
        />
        {results.length > 0 && (
          <div className="absolute z-20 top-full mt-1 w-full bg-[#1a1a1a] border border-[var(--border-subtle)] rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {results.map(r => (
              <button
                key={r.id}
                onClick={() => add(r)}
                className="w-full text-left px-4 py-2.5 text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
              >
                {r.product_name}
              </button>
            ))}
          </div>
        )}
        {searching && <p className="absolute top-full mt-1 text-[11px] text-[var(--text-ghost)]">Searching...</p>}
      </div>

      {/* List */}
      {related.length === 0 ? (
        <p className="text-[13px] text-[var(--text-ghost)] py-6 text-center border border-dashed border-white/[0.06] rounded-xl">No related products linked.</p>
      ) : (
        <div className="space-y-1.5">
          {related.map(r => (
            <div key={r.related_id} className="flex items-center justify-between h-10 px-4 rounded-lg bg-[var(--bg-surface-subtle)] border border-white/[0.06]">
              <div className="flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
                <LinkIcon className="h-3.5 w-3.5 text-[var(--text-ghost)]" />
                {r.related_name}
              </div>
              <button onClick={() => remove(r.related_id)} className="text-[var(--text-ghost)] hover:text-red-400/70 transition-colors">
                <CrossIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
