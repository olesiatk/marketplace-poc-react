import { useEffect, useMemo, useRef, useState } from "react";
import { ProductCard } from "../ProductCard/ProductCard";
import { wordFormProducts } from "../../lib/search";
import type { MatchesMap, Product, ReviewsMap } from "../../models/product.model";

const PAGE_SIZE = 12;
/** Total page-number buttons shown before collapsing the middle into an ellipsis. */
const MAX_VISIBLE_PAGES = 7;

export type PageEntry = number | "ellipsis";

export interface ProductGridProps {
  products: Product[];
  reviews: ReviewsMap;
  matches: MatchesMap;
  query?: string;
  isSearching?: boolean;
  onSelect: (id: string) => void;
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

export function ProductGrid({ products, reviews, matches, query = "", isSearching = false, onSelect, onClearQuery }: ProductGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const sectionRef = useRef<HTMLElement>(null);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));

  const visibleProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return products.slice(start, start + PAGE_SIZE);
  }, [products, currentPage]);

  const pageNumbers = useMemo(() => computePageNumbers(totalPages, currentPage), [totalPages, currentPage]);

  // A new search or filter yields a new `products` array — reset back to
  // the first page rather than keeping a stale offset into it.
  useEffect(() => {
    setCurrentPage(1);
  }, [products]);

  function reviewsFor(id: string) {
    return reviews[id] || [];
  }

  function matchFor(id: string) {
    return matches.get(id) ?? null;
  }

  function goToPage(page: number): void {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    // Pagination replaces the visible set rather than appending to it, so
    // bring the grid back into view (jsdom in unit tests has no scrollIntoView).
    sectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  return (
    <section ref={sectionRef} className="mx-auto max-w-6xl px-8 pt-8 pb-20" data-tour="product-grid">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <p className="eyebrow">{products.length} {wordFormProducts(products.length)}</p>
        {query && (
          <div className="inline-flex items-center gap-2 bg-[#fff6d9] border border-highlight-line text-[#6b5500] text-[13px] font-semibold px-3 py-1.5">
            AI query: <span className="font-bold">"{query}"</span>
            <button type="button" onClick={onClearQuery} aria-label="Clear query" className="text-[#6b5500] hover:text-ink">✕</button>
          </div>
        )}
      </div>

      {isSearching ? (
        <output className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="w-8 h-8 border-4 border-line border-t-brand-dark rounded-full animate-spin"></div>
          <p className="text-sm text-body">Searching…</p>
        </output>
      ) : products.length === 0 ? (
        <p className="text-center text-body text-sm py-16">Nothing found. Try changing your query or filters.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                reviewList={reviewsFor(product.id)}
                matchInfo={matchFor(product.id)}
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
