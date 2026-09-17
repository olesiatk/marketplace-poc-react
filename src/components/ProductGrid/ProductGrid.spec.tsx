import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ProductGrid } from "./ProductGrid";
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
  return render(
    <ProductGrid
      products={products}
      reviews={{} as ReviewsMap}
      matches={new Map() as MatchesMap}
      onSelect={() => {}}
      onClearQuery={() => {}}
    />
  );
}

// Each product card renders exactly one <h3> (the product name) — a
// reliable, structural way to count rendered cards without depending on
// styling classes.
function cardCount(container: HTMLElement): number {
  return container.querySelectorAll("h3").length;
}

describe("ProductGrid pagination", () => {
  it("shows only the first 12 products by default and renders pagination", () => {
    const { container } = setup(makeProducts(20));
    expect(cardCount(container)).toBe(12);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
  });

  it("shows the remaining products on page 2 and hides them from page 1", () => {
    const { container } = setup(makeProducts(20));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(cardCount(container)).toBe(8);
  });

  it("disables Prev on the first page and Next on the last page", () => {
    setup(makeProducts(20));
    expect(screen.getByRole("button", { name: "‹ Prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next ›" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByRole("button", { name: "‹ Prev" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Next ›" })).toBeDisabled();
  });

  it("resets back to page 1 when the product list changes (a new search or filter)", () => {
    const { container, rerender } = setup(makeProducts(20));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(cardCount(container)).toBe(8);

    rerender(
      <ProductGrid
        products={makeProducts(15, "q")}
        reviews={{} as ReviewsMap}
        matches={new Map() as MatchesMap}
        onSelect={() => {}}
        onClearQuery={() => {}}
      />
    );
    expect(cardCount(container)).toBe(12);
    expect(screen.getByRole("button", { name: "‹ Prev" })).toBeDisabled();
  });

  it("shows no pagination when there are 12 or fewer products", () => {
    const { container } = setup(makeProducts(12));
    expect(cardCount(container)).toBe(12);
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  });

  it("collapses many pages into an ellipsis around the current page", () => {
    setup(makeProducts(300));
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(nav).getByText("…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "25" })).toBeInTheDocument();
  });
});
