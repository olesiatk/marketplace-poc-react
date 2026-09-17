import { useEffect, useMemo, useRef, useState } from "react";
import type { Driver } from "driver.js";
import { Hero } from "./components/Hero/Hero";
import { FiltersBar, type FilterChangeEvent } from "./components/FiltersBar/FiltersBar";
import { ProductGrid } from "./components/ProductGrid/ProductGrid";
import { ProductModal } from "./components/ProductModal/ProductModal";
import { aiSearch } from "./lib/groq";
import { watchIframeHeight } from "./lib/iframe-resize";
import { isEmbedded, listenToHost, sendFrameReady, sendTourStatus } from "./lib/post-message";
import { wordFormProducts } from "./lib/search";
import { buildVocabulary } from "./lib/suggestions";
import { DEMO_QUERY, createTour } from "./lib/tour";
import type { AiMode, FilterOptions, Filters, MatchesMap, Product, ReviewsMap } from "./models/product.model";

const EMPTY_FILTERS: Filters = { category: "", room: "", material: "", maxPrice: Infinity };

function uniqueSorted(arr: string[]): string[] {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b, "en"));
}

export function App() {
  // Not vh-based when embedded: 100vh inside an <iframe> resolves against
  // the iframe's own rendered height, which the host sets FROM our own
  // reported content height (poc-resize-iframe) — if content is shorter
  // than the iframe's current height, min-h-screen would keep the reported
  // height pinned at the iframe's last height, and the host setting the
  // iframe to that height changes what 100vh means next report, forming a
  // resize feedback loop. Only meaningful in standalone/dev use anyway,
  // where the iframe height isn't externally driven by us.
  const embedded = isEmbedded();

  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ReviewsMap>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchValue, setSearchValue] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MatchesMap>(new Map());
  const [aiMode, setAiMode] = useState<AiMode>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const priceLimit = useMemo(() => (products.length ? Math.max(...products.map((p) => p.price)) : 25000), [products]);

  const searchVocabulary = useMemo(() => buildVocabulary(products), [products]);

  const filterOptions = useMemo<FilterOptions>(() => {
    if (!products.length) return { categories: [], rooms: [], materials: [] };
    return {
      categories: uniqueSorted(products.map((p) => p.category)),
      rooms: uniqueSorted(products.flatMap((p) => p.room.split(",").map((s) => s.trim()))),
      materials: uniqueSorted(
        products.flatMap((p) => p.material.split(/[,()]/).map((s) => s.trim()).filter(Boolean))
      ),
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => {
      if (filters.category && p.category !== filters.category) return false;
      if (filters.room && !p.room.toLowerCase().includes(filters.room.toLowerCase())) return false;
      if (filters.material && !p.material.toLowerCase().includes(filters.material.toLowerCase())) return false;
      if (p.price > filters.maxPrice) return false;
      return true;
    });

    if (query) {
      list = list.filter((p) => matches.has(p.id));
      list = [...list].sort((a, b) => matches.get(b.id)!.score - matches.get(a.id)!.score);
    }

    return list;
  }, [products, filters, query, matches]);

  const selectedProduct = useMemo(
    () => (selectedId ? products.find((p) => p.id === selectedId) ?? null : null),
    [selectedId, products]
  );

  const selectedMatchInfo = useMemo(() => (selectedId ? matches.get(selectedId) ?? null : null), [selectedId, matches]);

  const rootRef = useRef<HTMLDivElement>(null);
  const tourDriverRef = useRef<Driver | null>(null);

  function onFilterChange(event: FilterChangeEvent): void {
    setFilters((f) => ({ ...f, [event.field]: event.value }));
  }

  function onResetFilters(): void {
    setFilters({ ...EMPTY_FILTERS, maxPrice: priceLimit });
    setSearchValue("");
    setQuery("");
    setMatches(new Map());
    setAiMode(null);
    setStatusMessage("");
  }

  async function onSearch(rawQuery: string): Promise<void> {
    const trimmed = rawQuery.trim();
    setQuery(trimmed);
    if (!trimmed) {
      setMatches(new Map());
      setAiMode(null);
      setStatusMessage("");
      return;
    }

    setIsSearching(true);
    setAiMode(null);
    setStatusMessage("AI is analyzing your query…");
    const result = await aiSearch(trimmed, latestRef.current.products, latestRef.current.reviews);
    setMatches(result.matches);
    setAiMode(result.mode);
    setIsSearching(false);

    if (result.matches.size === 0) {
      setStatusMessage("AI didn't find any close matches for this query. Try rephrasing it.");
    } else {
      setStatusMessage(`AI matched ${result.matches.size} ${wordFormProducts(result.matches.size)} to your query.`);
    }
  }

  function onClearQuery(): void {
    setSearchValue("");
    setQuery("");
    setMatches(new Map());
    setAiMode(null);
    setStatusMessage("");
  }

  function resetTourDemo(): void {
    setSelectedId(null);
    onClearQuery();
    sendTourStatus(false);
  }

  // The tour driver and the iframe-embedding effect are both set up once
  // (empty-deps effects) but need to call back into whatever's current at
  // call time (the demo search, the latest product list, the reset logic)
  // — this ref is the React equivalent of Angular's stable `this`.
  const latestRef = useRef({ products, reviews, filteredProducts, onSearch, resetTourDemo });
  latestRef.current = { products, reviews, filteredProducts, onSearch, resetTourDemo };

  function startTour(): void {
    tourDriverRef.current ??= createTour({
      runDemoSearch: async () => {
        setSearchValue(DEMO_QUERY);
        await latestRef.current.onSearch(DEMO_QUERY);
      },
      openFirstResult: () => {
        const first = latestRef.current.filteredProducts[0];
        if (first) setSelectedId(first.id);
      },
      reset: () => latestRef.current.resetTourDemo(),
    });
    sendTourStatus(true);
    tourDriverRef.current.drive();
  }

  useEffect(() => {
    Promise.all([
      fetch("data/products.json").then((r) => r.json()),
      fetch("data/reviews.json").then((r) => r.json()),
    ])
      .then(([loadedProducts, loadedReviews]: [Product[], ReviewsMap]) => {
        setProducts(loadedProducts);
        setReviews(loadedReviews);
        const maxPrice = Math.max(...loadedProducts.map((p) => p.price));
        setFilters((f) => ({ ...f, maxPrice }));
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => {
    if (!rootRef.current) return;

    // No-ops unless this app is actually running inside a host's <iframe>.
    sendFrameReady();
    const heightWatch = watchIframeHeight(rootRef.current);
    const stopHostListener = listenToHost({
      onAskForHeight: () => heightWatch.reportNow(),
      onDismiss: () => {
        // driver.js's public destroy() bypasses onDestroyStarted (it's
        // the "force" path), so the tour's own reset callback would
        // never run from here — reset explicitly first.
        const driver = tourDriverRef.current;
        if (driver?.isActive()) {
          latestRef.current.resetTourDemo();
          driver.destroy();
        }
      },
    });

    return () => {
      tourDriverRef.current?.destroy();
      heightWatch.stop();
      stopHostListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center text-body text-sm p-8 text-center ${!embedded ? "min-h-screen" : ""}`}>
        Failed to load the catalog: {loadError}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={!embedded ? "min-h-screen" : ""}>
      <main>
        <Hero
          value={searchValue}
          onValueChange={setSearchValue}
          isSearching={isSearching}
          statusMessage={statusMessage}
          aiMode={aiMode}
          vocabulary={searchVocabulary}
          onSubmitQuery={onSearch}
          onHowItWorks={startTour}
        />
        <FiltersBar
          options={filterOptions}
          filters={filters}
          priceLimit={priceLimit}
          onFilterChange={onFilterChange}
          onReset={onResetFilters}
        />
        <ProductGrid
          products={filteredProducts}
          reviews={reviews}
          matches={matches}
          query={query}
          isSearching={isSearching}
          onSelect={setSelectedId}
          onClearQuery={onClearQuery}
        />
      </main>
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          reviews={reviews}
          matchInfo={selectedMatchInfo}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
