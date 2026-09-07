import { Component, ElementRef, OnDestroy, computed, inject, signal } from "@angular/core";
import type { Driver } from "driver.js";
import { HeroComponent } from "./components/hero/hero";
import { FiltersBarComponent, type FilterChangeEvent } from "./components/filters-bar/filters-bar";
import { ProductGridComponent } from "./components/product-grid/product-grid";
import { ProductModalComponent } from "./components/product-modal/product-modal";
import { aiSearch } from "./lib/groq";
import { watchIframeHeight } from "./lib/iframe-resize";
import { isEmbedded, listenToHost, sendFrameReady, sendTourStatus } from "./lib/post-message";
import { wordFormProducts } from "./lib/search";
import { buildVocabulary } from "./lib/suggestions";
import { DEMO_QUERY, createTour } from "./lib/tour";
import type { AiMode, Filters, MatchesMap, Product, ReviewsMap } from "./models/product.model";

const EMPTY_FILTERS: Filters = { category: "", room: "", material: "", maxPrice: Infinity };

function uniqueSorted(arr: string[]): string[] {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b, "en"));
}

@Component({
  selector: "app-root",
  imports: [HeroComponent, FiltersBarComponent, ProductGridComponent, ProductModalComponent],
  templateUrl: "./app.html",
})
export class App implements OnDestroy {
  // Not vh-based when embedded: 100vh inside an <iframe> resolves against
  // the iframe's own rendered height, which the host sets FROM our own
  // reported content height (poc-resize-iframe) — if content is shorter
  // than the iframe's current height, min-h-screen would keep the reported
  // height pinned at the iframe's last height, and the host setting the
  // iframe to that height changes what 100vh means next report, forming a
  // resize feedback loop. Only meaningful in standalone/dev use anyway,
  // where the iframe height isn't externally driven by us.
  protected readonly embedded = isEmbedded();

  protected readonly products = signal<Product[]>([]);
  protected readonly reviews = signal<ReviewsMap>({});
  protected readonly loadError = signal<string | null>(null);

  protected readonly filters = signal<Filters>(EMPTY_FILTERS);
  protected readonly searchValue = signal("");
  protected readonly query = signal("");
  protected readonly matches = signal<MatchesMap>(new Map());
  protected readonly aiMode = signal<AiMode>(null);
  protected readonly isSearching = signal(false);
  protected readonly statusMessage = signal("");
  protected readonly selectedId = signal<string | null>(null);

  protected readonly priceLimit = computed(() => {
    const list = this.products();
    return list.length ? Math.max(...list.map((p) => p.price)) : 25000;
  });

  protected readonly searchVocabulary = computed(() => buildVocabulary(this.products()));

  protected readonly filterOptions = computed(() => {
    const list = this.products();
    if (!list.length) return { categories: [], rooms: [], materials: [] };
    return {
      categories: uniqueSorted(list.map((p) => p.category)),
      rooms: uniqueSorted(list.flatMap((p) => p.room.split(",").map((s) => s.trim()))),
      materials: uniqueSorted(
        list.flatMap((p) => p.material.split(/[,()]/).map((s) => s.trim()).filter(Boolean))
      ),
    };
  });

  protected readonly filteredProducts = computed(() => {
    const filters = this.filters();
    const query = this.query();
    const matches = this.matches();

    let list = this.products().filter((p) => {
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
  });

  protected readonly selectedProduct = computed(() => {
    const id = this.selectedId();
    return id ? this.products().find((p) => p.id === id) ?? null : null;
  });

  protected readonly selectedMatchInfo = computed(() => {
    const id = this.selectedId();
    return id ? this.matches().get(id) ?? null : null;
  });

  private tourDriver: Driver | null = null;
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly stopHeightWatch: () => void;
  private readonly stopHostListener: () => void;

  constructor() {
    Promise.all([
      fetch("data/products.json").then((r) => r.json()),
      fetch("data/reviews.json").then((r) => r.json()),
    ])
      .then(([products, reviews]: [Product[], ReviewsMap]) => {
        this.products.set(products);
        this.reviews.set(reviews);
        const maxPrice = Math.max(...products.map((p) => p.price));
        this.filters.update((f) => ({ ...f, maxPrice }));
      })
      .catch((err) => this.loadError.set(err.message));

    // No-ops unless this app is actually running inside a host's <iframe>.
    sendFrameReady();
    const heightWatch = watchIframeHeight(this.elementRef.nativeElement);
    this.stopHeightWatch = heightWatch.stop;
    this.stopHostListener = listenToHost({
      onAskForHeight: () => heightWatch.reportNow(),
      onDismiss: () => {
        // driver.js's public destroy() bypasses onDestroyStarted (it's
        // the "force" path), so the tour's own reset callback would
        // never run from here — reset explicitly first.
        if (this.tourDriver?.isActive()) {
          this.resetTourDemo();
          this.tourDriver.destroy();
        }
      },
    });
  }

  private resetTourDemo(): void {
    this.selectedId.set(null);
    this.onClearQuery();
    sendTourStatus(false);
  }

  protected onFilterChange(event: FilterChangeEvent): void {
    this.filters.update((f) => ({ ...f, [event.field]: event.value }));
  }

  protected onResetFilters(): void {
    this.filters.set({ ...EMPTY_FILTERS, maxPrice: this.priceLimit() });
    this.searchValue.set("");
    this.query.set("");
    this.matches.set(new Map());
    this.aiMode.set(null);
    this.statusMessage.set("");
  }

  protected async onSearch(rawQuery: string): Promise<void> {
    const trimmed = rawQuery.trim();
    this.query.set(trimmed);
    if (!trimmed) {
      this.matches.set(new Map());
      this.aiMode.set(null);
      this.statusMessage.set("");
      return;
    }

    this.isSearching.set(true);
    this.aiMode.set(null);
    this.statusMessage.set("AI is analyzing your query…");
    const result = await aiSearch(trimmed, this.products(), this.reviews());
    this.matches.set(result.matches);
    this.aiMode.set(result.mode);
    this.isSearching.set(false);

    if (result.matches.size === 0) {
      this.statusMessage.set("AI didn't find any close matches for this query. Try rephrasing it.");
    } else {
      this.statusMessage.set(`AI matched ${result.matches.size} ${wordFormProducts(result.matches.size)} to your query.`);
    }
  }

  protected onClearQuery(): void {
    this.searchValue.set("");
    this.query.set("");
    this.matches.set(new Map());
    this.aiMode.set(null);
    this.statusMessage.set("");
  }

  ngOnDestroy(): void {
    this.tourDriver?.destroy();
    this.stopHeightWatch();
    this.stopHostListener();
  }

  protected startTour(): void {
    this.tourDriver ??= createTour({
      runDemoSearch: async () => {
        this.searchValue.set(DEMO_QUERY);
        await this.onSearch(DEMO_QUERY);
      },
      openFirstResult: () => {
        const first = this.filteredProducts()[0];
        if (first) this.selectedId.set(first.id);
      },
      reset: () => this.resetTourDemo(),
    });
    sendTourStatus(true);
    this.tourDriver.drive();
  }
}
