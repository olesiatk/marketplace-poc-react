import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductGrid } from "./ProductGrid";
import type { ProductHit } from "../../models/product.model";

function makeHits(count: number, prefix = "p"): ProductHit[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    objectID: `${prefix}-${i}`,
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
    reviews: [],
    __position: i + 1,
  })) as unknown as ProductHit[];
}

function setup(overrides: Partial<React.ComponentProps<typeof ProductGrid>> = {}) {
  const onPageChange = vi.fn();
  const products = overrides.products ?? makeHits(12);
  const utils = render(
    <ProductGrid
      products={products}
      totalCount={products.length}
      currentPage={1}
      totalPages={1}
      onPageChange={onPageChange}
      onSelect={() => {}}
      onClearQuery={() => {}}
      {...overrides}
    />
  );
  return { ...utils, onPageChange };
}

// Each product card renders exactly one <h3> (the product name) — a
// reliable, structural way to count rendered cards without depending on
// styling classes.
function cardCount(container: HTMLElement): number {
  return container.querySelectorAll("h3").length;
}

describe("ProductGrid pagination", () => {
  it("renders the given page's products and a pagination nav when there's more than one page", () => {
    const { container } = setup({ products: makeHits(12), currentPage: 1, totalPages: 2 });
    expect(cardCount(container)).toBe(12);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
  });

  it("marks the current page and calls onPageChange when another page is clicked", () => {
    const { onPageChange } = setup({ products: makeHits(8), currentPage: 2, totalPages: 2 });
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: "1" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables Prev on the first page and Next on the last page", () => {
    const { rerender } = setup({ currentPage: 1, totalPages: 2 });
    expect(screen.getByRole("button", { name: "‹ Prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next ›" })).not.toBeDisabled();

    rerender(
      <ProductGrid
        products={makeHits(8)}
        totalCount={8}
        currentPage={2}
        totalPages={2}
        onPageChange={() => {}}
        onSelect={() => {}}
        onClearQuery={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "‹ Prev" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Next ›" })).toBeDisabled();
  });

  it("shows no pagination nav when there's only one page", () => {
    setup({ totalPages: 1 });
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  });

  it("collapses many pages into an ellipsis around the current page", () => {
    setup({ currentPage: 12, totalPages: 25 });
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav.textContent).toContain("…");
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "25" })).toBeInTheDocument();
  });
});
