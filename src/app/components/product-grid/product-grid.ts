import { Component, ElementRef, computed, effect, inject, input, output, signal } from "@angular/core";
import { ProductCardComponent } from "../product-card/product-card";
import { wordFormProducts } from "../../lib/search";
import type { MatchesMap, Product, Review, ReviewsMap } from "../../models/product.model";

const PAGE_SIZE = 12;
/** Total page-number buttons shown before collapsing the middle into an ellipsis. */
const MAX_VISIBLE_PAGES = 7;

export type PageEntry = number | "ellipsis";

@Component({
  selector: "app-product-grid",
  imports: [ProductCardComponent],
  templateUrl: "./product-grid.html",
})
export class ProductGridComponent {
  readonly products = input.required<Product[]>();
  readonly reviews = input.required<ReviewsMap>();
  readonly matches = input.required<MatchesMap>();
  readonly query = input("");
  readonly isSearching = input(false);

  readonly select = output<string>();
  readonly clearQuery = output<void>();

  protected readonly wordFormProducts = wordFormProducts;
  protected readonly currentPage = signal(1);

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.products().length / PAGE_SIZE)));

  protected readonly visibleProducts = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.products().slice(start, start + PAGE_SIZE);
  });

  protected readonly pageNumbers = computed<PageEntry[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
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
  });

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  constructor() {
    // A new search or filter yields a new `products` array — reset back to
    // the first page rather than keeping a stale offset into it.
    effect(() => {
      this.products();
      this.currentPage.set(1);
    });
  }

  protected reviewsFor(id: string): Review[] {
    return this.reviews()[id] || [];
  }

  protected matchFor(id: string) {
    return this.matches().get(id) ?? null;
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.currentPage.set(page);
    // Pagination replaces the visible set rather than appending to it, so
    // bring the grid back into view (jsdom in unit tests has no scrollIntoView).
    this.elementRef.nativeElement.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }
}
