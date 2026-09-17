import { useMemo, useRef } from "react";
import { ProductCard } from "../ProductCard/ProductCard";
import { wordFormProducts } from "../../lib/format";
import type { ProductHit } from "../../models/product.model";

/** Total page-number buttons shown before collapsing the middle into an ellipsis. */
const MAX_VISIBLE_PAGES = 7;

export type PageEntry = number | "ellipsis";

export interface ProductGridProps {
  /** The current page's hits, already paginated server-side by Algolia. */
  products: ProductHit[];
  /** Total matches across all pages — distinct from `products.length`, which is just this page's size. */
  totalCount: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  query?: string;
  isSearching?: boolean;
  onSelect: (product: ProductHit) => void;
  onClearQuery: () => void;
}

function computePageNumbers(total: number, current: number): PageEntry[] {
  if (total <= MAX_VISIBLE_PAGES) return Array.from({ length: total }, (_, i) => i + 1);

  const kept = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...kept].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const entries: PageEntry[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) entries.push("ellipsis");
    entries.push(page);
    previous = page;
  }
  return entries;
}

export function ProductGrid({
  products,
  totalCount,
  currentPage,
  totalPages,
  onPageChange,
  query = "",
  isSearching = false,
  onSelect,
  onClearQuery,
}: ProductGridProps) {
  const sectionRef = useRef<HTMLElement>(null);

  const pageNumbers = useMemo(() => computePageNumbers(totalPages, currentPage), [totalPages, currentPage]);

  function goToPage(page: number): void {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
    // Pagination replaces the visible set rather than appending to it, so
    // bring the grid back into view (jsdom in unit tests has no scrollIntoView).
    sectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  return (
    <section ref={sectionRef} className="mx-auto max-w-6xl px-8 pt-8 pb-20" data-tour="product-grid">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <p className="eyebrow">{totalCount} {wordFormProducts(totalCount)}</p>
        {query && (
          <div className="inline-flex items-center gap-2 bg-[#fff6d9] border border-highlight-line text-[#6b5500] text-[13px] font-semibold px-3 py-1.5">
            Search: <span className="font-bold">"{query}"</span>
            <button type="button" onClick={onClearQuery} aria-label="Clear query" className="text-[#6b5500] hover:text-ink">✕</button>
          </div>
        )}
      </div>

      {isSearching ? (
        <output className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="w-8 h-8 border-4 border-line border-t-brand-dark rounded-full animate-spin"></div>
          <p className="text-sm text-body">Searching…</p>
        </output>
      ) : totalCount === 0 ? (
        <p className="text-center text-body text-sm py-16">Nothing found. Try changing your query or filters.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                dataTour={index === 0 ? "first-product-card" : undefined}
                onSelect={onSelect}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-center flex-wrap gap-1.5 mt-10" aria-label="Pagination">
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2.5 h-8 text-xs font-bold uppercase tracking-wide border border-ink disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:bg-ink hover:enabled:text-white transition-colors"
              >
                ‹ Prev
              </button>
              {pageNumbers.map((page, index) =>
                page === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="px-1.5 text-xs text-body">…</span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => goToPage(page)}
                    aria-current={page === currentPage ? "page" : undefined}
                    className={`w-8 h-8 text-xs font-bold border border-ink hover:bg-ink hover:text-white transition-colors ${page === currentPage ? "bg-ink text-white" : ""}`}
                  >
                    {page}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2.5 h-8 text-xs font-bold uppercase tracking-wide border border-ink disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:bg-ink hover:enabled:text-white transition-colors"
              >
                Next ›
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
