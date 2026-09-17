import { useEffect, useMemo, useRef, useState } from "react";
import type { Driver } from "driver.js";
import {
  Configure,
  InstantSearch,
  useClearRefinements,
  useHits,
  useInstantSearch,
  usePagination,
  useRange,
  useRefinementList,
  useSearchBox,
} from "react-instantsearch";
import type { RefinementListItem } from "instantsearch.js/es/connectors/refinement-list/connectRefinementList";
import { Hero } from "./components/Hero/Hero";
import { FiltersBar, type FilterChangeEvent } from "./components/FiltersBar/FiltersBar";
import { ProductGrid } from "./components/ProductGrid/ProductGrid";
import { ProductModal } from "./components/ProductModal/ProductModal";
import { ALGOLIA_INDEX_NAME, isAlgoliaConfigured, searchClient } from "./lib/algolia";
import { wordFormProducts } from "./lib/format";
import { watchIframeHeight } from "./lib/iframe-resize";
import { isEmbedded, listenToHost, sendFrameReady, sendTourStatus } from "./lib/post-message";
import { buildVocabulary } from "./lib/suggestions";
import { DEMO_QUERY, createTour } from "./lib/tour";
import type { FilterOptions, Filters, Product, ProductHit, ProductRecord } from "./models/product.model";

const HITS_PER_PAGE = 12;

/**
 * Single-select helper over an Algolia refinement list: `refine(value)`
 * toggles that value on its own, so replacing the current selection with a
 * different one (or clearing it, for `value === ""`) needs an explicit
 * "un-refine the old one first" step — RefinementList's own UI otherwise
 * supports multi-select, which this app's single dropdown doesn't want.
 */
function selectSingle(items: RefinementListItem[], refine: (value: string) => void, value: string): void {
  const current = items.find((i) => i.isRefined);
  if (current?.value === value) return;
  if (current) refine(current.value);
  if (value) refine(value);
}

function AppShell() {
  // Not vh-based when embedded: 100vh inside an <iframe> resolves against
  // the iframe's own rendered height, which the host sets FROM our own
  // reported content height (poc-resize-iframe) — if content is shorter
  // than the iframe's current height, min-h-screen would keep the reported
  // height pinned at the iframe's last height, and the host setting the
  // iframe to that height changes what 100vh means next report, forming a
  // resize feedback loop. Only meaningful in standalone/dev use anyway,
  // where the iframe height isn't externally driven by us.
  const embedded = isEmbedded();

  // Fetched once, only to build the search-box autocomplete vocabulary
  // (src/lib/suggestions.ts) — unrelated to the Algolia-backed search/filter
  // results below, so a failure here shouldn't block the rest of the app.
  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    fetch("data/products.json")
      .then((r) => r.json())
      .then(setCatalog)
      .catch((err) => console.warn("Failed to load catalog for search suggestions:", err));
  }, []);
  const searchVocabulary = useMemo(() => buildVocabulary(catalog), [catalog]);

  const [searchValue, setSearchValue] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductHit | null>(null);

  const { query, refine: refineQuery } = useSearchBox();
  const { status } = useInstantSearch();
  const { items: hits, results } = useHits<ProductRecord>();
  const { refine: refinePage, currentRefinement: currentPageIndex, nbPages } = usePagination();
  const { refine: refineClearAll } = useClearRefinements();

  const categoryList = useRefinementList({ attribute: "category", limit: 100, sortBy: ["name:asc"] });
  const roomList = useRefinementList({ attribute: "roomFacets", limit: 100, sortBy: ["name:asc"] });
  const materialList = useRefinementList({ attribute: "materialFacets", limit: 100, sortBy: ["name:asc"] });
  const priceRange = useRange({ attribute: "price" });

  const isSearching = status === "loading" || status === "stalled";

  const filterOptions: FilterOptions = {
    categories: categoryList.items.map((i) => i.value),
    rooms: roomList.items.map((i) => i.value),
    materials: materialList.items.map((i) => i.value),
  };

  const priceLimit = Number.isFinite(priceRange.range.max) ? (priceRange.range.max as number) : 25000;
  const filters: Filters = {
    category: categoryList.items.find((i) => i.isRefined)?.value ?? "",
    room: roomList.items.find((i) => i.isRefined)?.value ?? "",
    material: materialList.items.find((i) => i.isRefined)?.value ?? "",
    // Algolia's unrefined start defaults to [-Infinity, Infinity], not
    // undefined, so a nullish check alone wouldn't fall back to priceLimit.
    maxPrice: Number.isFinite(priceRange.start[1]) ? (priceRange.start[1] as number) : priceLimit,
  };

  const statusMessage = useMemo(() => {
    if (!query || isSearching) return "";
    const n = results?.nbHits ?? 0;
    return n === 0
      ? "No products matched your search. Try rephrasing it."
      : `Found ${n} ${wordFormProducts(n)} for your search.`;
  }, [query, isSearching, results]);

  const rootRef = useRef<HTMLDivElement>(null);
  const tourDriverRef = useRef<Driver | null>(null);

  function onFilterChange(event: FilterChangeEvent): void {
    if (event.field === "maxPrice") {
      priceRange.refine([undefined, Number(event.value)]);
      return;
    }
    const value = String(event.value);
    if (event.field === "category") selectSingle(categoryList.items, categoryList.refine, value);
    else if (event.field === "room") selectSingle(roomList.items, roomList.refine, value);
    else if (event.field === "material") selectSingle(materialList.items, materialList.refine, value);
  }

  function onResetFilters(): void {
    refineClearAll();
    setSearchValue("");
    refineQuery("");
  }

  function onSearch(rawQuery: string): void {
    const trimmed = rawQuery.trim();
    refineQuery(trimmed);
  }

  function onClearQuery(): void {
    setSearchValue("");
    refineQuery("");
  }

  function resetTourDemo(): void {
    setSelectedProduct(null);
    onClearQuery();
    sendTourStatus(false);
  }

  // The tour driver and the iframe-embedding effect are both set up once
  // (empty-deps effects) but need to call back into whatever's current at
  // call time (the demo search, the latest hits, the reset logic) — this
  // ref is the React equivalent of Angular's stable `this`.
  const latestRef = useRef({ hits, onSearch, resetTourDemo });
  latestRef.current = { hits, onSearch, resetTourDemo };

  function startTour(): void {
    tourDriverRef.current ??= createTour({
      runDemoSearch: async () => {
        setSearchValue(DEMO_QUERY);
        latestRef.current.onSearch(DEMO_QUERY);
      },
      openFirstResult: () => {
        const first = latestRef.current.hits[0];
        if (first) setSelectedProduct(first);
      },
      reset: () => latestRef.current.resetTourDemo(),
    });
    sendTourStatus(true);
    tourDriverRef.current.drive();
  }

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

  return (
    <div ref={rootRef} className={!embedded ? "min-h-screen" : ""}>
      <main>
        <Hero
          value={searchValue}
          onValueChange={setSearchValue}
          isSearching={isSearching}
          statusMessage={statusMessage}
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
          products={hits}
          totalCount={results?.nbHits ?? hits.length}
          currentPage={currentPageIndex + 1}
          totalPages={Math.max(1, nbPages)}
          onPageChange={(page) => refinePage(page - 1)}
          query={query}
          isSearching={isSearching}
          onSelect={setSelectedProduct}
          onClearQuery={onClearQuery}
        />
      </main>
      {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
    </div>
  );
}

export function App() {
  if (!isAlgoliaConfigured) {
    return (
      <div className="flex items-center justify-center text-body text-sm p-8 text-center min-h-screen">
        Search isn't configured: missing VITE_ALGOLIA_APPLICATION_ID / VITE_ALGOLIA_SEARCH_API_KEY. Copy
        .env.example to .env and fill them in.
      </div>
    );
  }

  return (
    <InstantSearch searchClient={searchClient} indexName={ALGOLIA_INDEX_NAME}>
      <Configure hitsPerPage={HITS_PER_PAGE} />
      <AppShell />
    </InstantSearch>
  );
}
