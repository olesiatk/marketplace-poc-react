import { describe, expect, it } from "vitest";
import { EXAMPLE_QUERIES, buildVocabulary, getSuggestions } from "./suggestions";
import type { Product } from "../models/product.model";

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: "p-1",
    name: "Product",
    category: "Chairs & Seating",
    icon: "decor",
    price: 1000,
    material: "wood",
    room: "living room",
    style: "modern",
    dimensions: "10x10x10 cm",
    tags: ["armchair", "cozy"],
    description: "",
    ...overrides,
  };
}

const products = [makeProduct({})];
const vocabulary = buildVocabulary(products);

describe("getSuggestions", () => {
  it("returns the curated example queries when the input is empty", () => {
    const suggestions = getSuggestions("", vocabulary);
    expect(suggestions.map((s) => s.query)).toEqual(EXAMPLE_QUERIES.slice(0, suggestions.length));
    // Clicking one fills the input with exactly that query.
    expect(suggestions[0].completion).toBe(suggestions[0].query);
  });

  it("completes a partial word from the catalog vocabulary", () => {
    const suggestions = getSuggestions("arm", vocabulary);
    const match = suggestions.find((s) => s.query === "armchair");
    expect(match).toBeDefined();
    expect(match!.completion).toBe("chair");
  });

  it("preserves the already-typed prefix when completing the last word", () => {
    const suggestions = getSuggestions("a cozy arm", vocabulary);
    const match = suggestions.find((s) => s.query === "a cozy armchair");
    expect(match).toBeDefined();
    expect(match!.completion).toBe("chair");
  });

  it("suggests a next word once the current word is finished (trailing space)", () => {
    const suggestions = getSuggestions("cozy ", vocabulary);
    expect(suggestions.length).toBeGreaterThan(0);
    suggestions.forEach((s) => {
      expect(s.query.startsWith("cozy ")).toBe(true);
      expect(s.query.length).toBeGreaterThan("cozy ".length);
      // Regression: trailing whitespace on the input must not leak into a
      // double space between the typed word and the suggested next word.
      expect(s.query).not.toContain("  ");
    });
  });

  it("never suggests the query the user already typed verbatim", () => {
    const suggestions = getSuggestions("armchair", vocabulary);
    expect(suggestions.some((s) => s.query.toLowerCase() === "armchair")).toBe(false);
  });

  it("surfaces a matching example query as a suggestion", () => {
    const prefix = EXAMPLE_QUERIES[0].slice(0, 10);
    const suggestions = getSuggestions(prefix, vocabulary);
    expect(suggestions.some((s) => s.query === EXAMPLE_QUERIES[0])).toBe(true);
  });
});

describe("buildVocabulary", () => {
  it("includes catalog attributes in the completion pool", () => {
    const vocab = buildVocabulary(products);
    expect(vocab.terms).toEqual(expect.arrayContaining(["armchair", "cozy", "wood", "modern"]));
  });

  it("includes product categories in the next-word pool", () => {
    const vocab = buildVocabulary(products);
    expect(vocab.nextWordTerms).toContain("chairs & seating");
  });
});
