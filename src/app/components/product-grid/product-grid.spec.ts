import { describe, expect, it } from "vitest";
import { TestBed } from "@angular/core/testing";
import { ProductGridComponent } from "./product-grid";
import type { MatchesMap, Product, ReviewsMap } from "../../models/product.model";

function makeProducts(count: number, prefix = "p"): Product[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    name: `Product ${i}`,
    category: "Category",
    icon: "decor",
    price: 1000,
    material: "wood",
    room: "living room",
    style: "modern",
    dimensions: "10x10x10 cm",
    tags: [],
    description: "",
  }));
}

function setup(products: Product[]) {
  const fixture = TestBed.createComponent(ProductGridComponent);
  fixture.componentRef.setInput("products", products);
  fixture.componentRef.setInput("reviews", {} as ReviewsMap);
  fixture.componentRef.setInput("matches", new Map() as MatchesMap);
  fixture.detectChanges();
  return fixture;
}

function cardCount(fixture: ReturnType<typeof setup>): number {
  return fixture.nativeElement.querySelectorAll("app-product-card").length;
}

function findPaginationNav(fixture: ReturnType<typeof setup>): HTMLElement | null {
  return fixture.nativeElement.querySelector("nav[aria-label='Pagination']");
}

function findButton(fixture: ReturnType<typeof setup>, text: string): HTMLButtonElement | null {
  const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll("button"));
  return buttons.find((b) => b.textContent?.trim() === text) ?? null;
}

describe("ProductGridComponent pagination", () => {
  it("shows only the first 12 products by default and renders pagination", () => {
    const fixture = setup(makeProducts(20));
    expect(cardCount(fixture)).toBe(12);
    expect(findPaginationNav(fixture)).not.toBeNull();
    expect(findButton(fixture, "2")).not.toBeNull();
  });

  it("shows the remaining products on page 2 and hides them from page 1", () => {
    const fixture = setup(makeProducts(20));
    findButton(fixture, "2")!.click();
    fixture.detectChanges();
    expect(cardCount(fixture)).toBe(8);
  });

  it("disables Prev on the first page and Next on the last page", () => {
    const fixture = setup(makeProducts(20));
    expect(findButton(fixture, "‹ Prev")!.disabled).toBe(true);
    expect(findButton(fixture, "Next ›")!.disabled).toBe(false);

    findButton(fixture, "2")!.click();
    fixture.detectChanges();
    expect(findButton(fixture, "‹ Prev")!.disabled).toBe(false);
    expect(findButton(fixture, "Next ›")!.disabled).toBe(true);
  });

  it("resets back to page 1 when the product list changes (a new search or filter)", () => {
    const fixture = setup(makeProducts(20));
    findButton(fixture, "2")!.click();
    fixture.detectChanges();
    expect(cardCount(fixture)).toBe(8);

    fixture.componentRef.setInput("products", makeProducts(15, "q"));
    fixture.detectChanges();
    expect(cardCount(fixture)).toBe(12);
    expect(findButton(fixture, "‹ Prev")!.disabled).toBe(true);
  });

  it("shows no pagination when there are 12 or fewer products", () => {
    const fixture = setup(makeProducts(12));
    expect(cardCount(fixture)).toBe(12);
    expect(findPaginationNav(fixture)).toBeNull();
  });

  it("collapses many pages into an ellipsis around the current page", () => {
    const fixture = setup(makeProducts(300));
    const nav = findPaginationNav(fixture)!;
    expect(nav.textContent).toContain("…");
    expect(findButton(fixture, "1")).not.toBeNull();
    expect(findButton(fixture, "25")).not.toBeNull();
  });
});
