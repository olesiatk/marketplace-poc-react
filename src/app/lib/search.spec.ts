import { describe, expect, it } from "vitest";
import { expandQueryTerms, highlightHtml, localHeuristicSearch, parseDimensions, tokenize } from "./search";
import type { Product, ReviewsMap } from "../models/product.model";

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: "p-1",
    name: "Product",
    category: "Category",
    icon: "decor",
    price: 1000,
    material: "wood",
    room: "living room",
    style: "modern",
    dimensions: "10x10x10 cm",
    tags: [],
    description: "",
    ...overrides,
  };
}

describe("expandQueryTerms", () => {
  it("keeps the literal tokens untouched", () => {
    const { tokens } = expandQueryTerms("a cosy yellow armchair");
    expect(tokens).toEqual(["cosy", "yellow", "armchair"]);
  });

  it("expands a single-word concept to its synonyms and contextual phrases", () => {
    const { expansions } = expandQueryTerms("cosy armchair");
    expect(expansions).toEqual(
      expect.arrayContaining(["comfortable", "comfy", "cozy", "ergonomic", "spine support", "plush cushions"])
    );
    // The literal token itself shouldn't be duplicated into the expansion list.
    expect(expansions).not.toContain("cosy");
  });

  it("expands a multi-word phrase in the raw query even though it isn't a single token", () => {
    const { expansions } = expandQueryTerms("looking for spine support");
    expect(expansions).toEqual(expect.arrayContaining(["comfortable", "cozy", "ergonomic"]));
  });

  it("only expands concepts the query actually touches", () => {
    const { expansions } = expandQueryTerms("a wooden dining table");
    // "wooden" is already a literal token, so only its siblings are added.
    expect(expansions).toEqual(expect.arrayContaining(["wood", "solid wood", "natural material"]));
    expect(expansions).not.toEqual(expect.arrayContaining(["comfortable", "storage", "budget-friendly"]));
  });
});

describe("localHeuristicSearch — synonym & contextual recall", () => {
  const cozyChair = makeProduct({
    id: "chair-04",
    name: "Comfortable Upholstered Armchair with Arms",
    category: "Chairs & Seating",
    tags: ["armchair", "upholstered", "with arms", "for relaxing", "cozy", "beige"],
    description: "A soft armchair with wide armrests for comfortable relaxing. Ideal for reading or watching TV.",
  });
  const diningTable = makeProduct({
    id: "table-05",
    name: "Expandable Oak Dining Table",
    category: "Tables",
    tags: ["dining table", "oak", "solid wood", "expandable"],
    description: "An expandable solid oak dining table that easily transforms to host guests.",
  });
  const products = [cozyChair, diningTable];
  const reviews: ReviewsMap = {};

  it("finds nothing for a British-spelling synonym without expansion (sanity baseline)", () => {
    // The catalog text only ever uses "cozy" — plain substring matching on
    // the literal token "cosy" alone would hit nothing.
    const rawTokenHits = products.filter((p) =>
      `${p.name} ${p.tags.join(" ")} ${p.description}`.toLowerCase().includes("cosy")
    );
    expect(rawTokenHits).toHaveLength(0);
  });

  it("matches a product via synonym expansion even when the literal query word never appears in the catalog", () => {
    const matches = localHeuristicSearch("cosy chair", products, reviews);
    expect(matches.has("chair-04")).toBe(true);
    expect(matches.has("table-05")).toBe(false);
  });

  it("matches a product via a contextual multi-word phrase", () => {
    const matches = localHeuristicSearch("something with plush cushions", products, reviews);
    expect(matches.has("chair-04")).toBe(true);
  });

  it("ranks a literal keyword match above a synonym-only match", () => {
    const literalOnly = makeProduct({
      id: "chair-literal",
      name: "Comfortable Reading Chair",
      tags: ["comfortable"],
      description: "A comfortable chair.",
    });
    const synonymOnly = makeProduct({
      id: "chair-synonym",
      name: "Cozy Reading Chair",
      tags: ["cozy"],
      description: "A cozy chair.",
    });
    const matches = localHeuristicSearch("comfortable", [literalOnly, synonymOnly], reviews);
    expect(matches.get("chair-literal")!.score).toBeGreaterThan(matches.get("chair-synonym")!.score);
  });

  it("records the matched synonym term (not the original query word) as a synonym term, not a direct term", () => {
    // Neither "cosy" nor "chair" appears verbatim as a whole word anywhere in
    // chair-04's text (only "armchair", which doesn't word-boundary-match
    // "chair"), so this match comes entirely through synonym expansion.
    const matches = localHeuristicSearch("cosy chair", products, reviews);
    const info = matches.get("chair-04")!;
    expect(info.synonymTerms.has("cozy")).toBe(true);
    expect(info.directTerms.size).toBe(0);
    expect(info.directTerms.has("cosy")).toBe(false);
  });

  it("uses whole-word matching, not raw substring containment", () => {
    // "table" is a substring of "comfortable" — a naive `.includes()` check
    // would wrongly count a "table" query as matching this armchair.
    const matches = localHeuristicSearch("table", [cozyChair], reviews);
    expect(matches.has("chair-04")).toBe(false);
  });
});

describe("localHeuristicSearch — type-word gate", () => {
  // Regression: "cozy chair" was matching a "cozy" wardrobe and a "cozy"
  // table too — a broad mood word like "cozy" (large synonym family) was
  // enough on its own to admit any product, even ones with no relation to
  // "chair" at all. A query that names a specific furniture type should
  // stay scoped to that type; only the mood/attribute part should roam.
  const cozyChair = makeProduct({
    id: "chair-01",
    name: "Cozy Reading Armchair",
    category: "Chairs & Seating",
    tags: ["armchair", "cozy"],
    description: "A cozy chair for the living room.",
  });
  // Only here so the catalog's own type vocabulary (built from every
  // product's tags[0]) actually contains the bare word "chair" — without
  // this, nothing in the fixture would ever split into "chair" and the
  // gate below would never engage, since cozyChair's own tags[0]
  // ("armchair") is a single, unsplittable compound word.
  const diningChair = makeProduct({
    id: "chair-02",
    name: "Wooden Dining Chair",
    category: "Chairs & Seating",
    tags: ["dining chair", "wood"],
    description: "A simple wooden dining chair.",
  });
  const cozyWardrobe = makeProduct({
    id: "storage-01",
    name: "Cozy Style Wardrobe",
    category: "Storage",
    tags: ["wardrobe", "cozy"],
    description: "A cozy-looking wardrobe with sliding doors.",
  });
  const cozyTable = makeProduct({
    id: "table-01",
    name: "Cozy Corner Table",
    category: "Tables",
    tags: ["side table", "cozy"],
    description: "A cozy little side table.",
  });
  const products = [cozyChair, diningChair, cozyWardrobe, cozyTable];
  const reviews: ReviewsMap = {};

  it("excludes products of an unrelated type even when they match the mood word", () => {
    const matches = localHeuristicSearch("cozy chair", products, reviews);
    expect(matches.has("chair-01")).toBe(true);
    expect(matches.has("storage-01")).toBe(false);
    expect(matches.has("table-01")).toBe(false);
  });

  it("still matches the requested type via a compound word (\"armchair\" contains \"chair\")", () => {
    const matches = localHeuristicSearch("cozy chair", products, reviews);
    expect(matches.get("chair-01")!.directTerms.has("cozy")).toBe(true);
  });

  it("doesn't gate on a mood word alone (no type word in the query)", () => {
    const matches = localHeuristicSearch("cozy", products, reviews);
    expect(matches.has("chair-01")).toBe(true);
    expect(matches.has("storage-01")).toBe(true);
    expect(matches.has("table-01")).toBe(true);
  });
});

describe("parseDimensions", () => {
  it("extracts a W×D×H triple from a product dimensions string", () => {
    expect(parseDimensions("150x85x80 cm")).toEqual([150, 85, 80]);
  });

  it("extracts a triple from a bare query with no unit", () => {
    expect(parseDimensions("280x180x90")).toEqual([280, 180, 90]);
  });

  it("accepts the × multiplication sign and decimals", () => {
    expect(parseDimensions("45.5×45×40 cm")).toEqual([45.5, 45, 40]);
  });

  it("returns null when there's no dimension-like pattern", () => {
    expect(parseDimensions("a cozy armchair")).toBeNull();
  });
});

describe("localHeuristicSearch — dimension matching", () => {
  const wardrobe = makeProduct({
    id: "storage-03",
    name: "Large Wardrobe with Sliding Doors",
    category: "Storage",
    tags: ["wardrobe", "large"],
    description: "A spacious wardrobe with sliding doors.",
    dimensions: "270x175x88 cm",
  });
  const tinyShelf = makeProduct({
    id: "storage-05",
    name: "Minimalist Floating Wall Shelf",
    category: "Storage",
    tags: ["shelf"],
    description: "A light wall shelf.",
    dimensions: "45x20x10 cm",
  });
  const products = [wardrobe, tinyShelf];
  const reviews: ReviewsMap = {};

  it("matches a product whose dimensions are close to the queried size", () => {
    const matches = localHeuristicSearch("280x180x90", products, reviews);
    expect(matches.has("storage-03")).toBe(true);
    expect(matches.has("storage-05")).toBe(false);
  });

  it("matches regardless of axis order", () => {
    const matches = localHeuristicSearch("90x180x280", products, reviews);
    expect(matches.has("storage-03")).toBe(true);
  });

  it("records the product's own dimensions string as a synonym term when it's only within tolerance", () => {
    const matches = localHeuristicSearch("280x180x90", products, reviews);
    expect(matches.get("storage-03")!.synonymTerms.has("270x175x88 cm")).toBe(true);
    expect(matches.get("storage-03")!.directTerms.size).toBe(0);
  });

  it("records the dimensions as a direct/exact term when the size matches exactly", () => {
    // Regression: an identical size (query "280x180x90" vs a product
    // literally "280x180x90 cm") was always filed as a synonym match
    // (green highlight) even though it's a literal match — should be
    // treated the same as any other exact hit (yellow highlight).
    const exactSizeSofa = makeProduct({
      id: "soft-02",
      name: "Large Corner Sofa",
      dimensions: "280x180x90 cm",
    });
    const matches = localHeuristicSearch("280x180x90", [exactSizeSofa], reviews);
    const info = matches.get("soft-02")!;
    expect(info.directTerms.has("280x180x90 cm")).toBe(true);
    expect(info.synonymTerms.has("280x180x90 cm")).toBe(false);
  });

  it("combines with a word match and ranks higher than either signal alone", () => {
    const wordOnlyMatches = localHeuristicSearch("wardrobe", products, reviews);
    const bothMatches = localHeuristicSearch("wardrobe 280x180x90", products, reviews);
    expect(bothMatches.get("storage-03")!.score).toBeGreaterThan(wordOnlyMatches.get("storage-03")!.score);
  });

  it("does not match when one axis is far off, even if the other two are near-exact", () => {
    // Regression: averaging relative differences let two near-identical
    // axes (90≈88, 180≈179) mask a third that's 70cm/25% off (280 vs 210),
    // wrongly flagging it "similar". The worst axis must now govern.
    const daybed = makeProduct({
      id: "bedroom-40",
      name: "Cozy Daybed",
      dimensions: "179x210x88 cm",
    });
    const matches = localHeuristicSearch("280x180x90", [daybed], reviews);
    expect(matches.has("bedroom-40")).toBe(false);
  });

  it("does not match a query with no dimension pattern via size alone", () => {
    const matches = localHeuristicSearch("elegant", products, reviews);
    expect(matches.has("storage-03")).toBe(false);
    expect(matches.has("storage-05")).toBe(false);
  });
});

describe("tokenize", () => {
  it("drops stopwords and short tokens", () => {
    expect(tokenize("I want a comfortable armchair for the living room")).toEqual([
      "comfortable", "armchair", "living", "room",
    ]);
  });
});

describe("highlightHtml", () => {
  it("highlights an exact/direct term in yellow (class \"hl\")", () => {
    const html = highlightHtml("A comfortable chair.", new Set(["comfortable"]), null);
    expect(html).toBe('A <mark class="hl">comfortable</mark> chair.');
  });

  it("highlights a synonym/expanded term in light green (class \"hl-synonym\")", () => {
    const html = highlightHtml("A cozy chair with plush cushions.", null, new Set(["cozy", "plush cushions"]));
    expect(html).toBe(
      'A <mark class="hl-synonym">cozy</mark> chair with <mark class="hl-synonym">plush cushions</mark>.'
    );
  });

  it("highlights direct and synonym terms differently within the same text", () => {
    const html = highlightHtml(
      "A comfortable and cozy chair.",
      new Set(["comfortable"]),
      new Set(["cozy"])
    );
    expect(html).toBe('A <mark class="hl">comfortable</mark> and <mark class="hl-synonym">cozy</mark> chair.');
  });

  it("escapes HTML in the source text", () => {
    const html = highlightHtml("<script>alert(1)</script>", new Set(["alert"]), null);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("returns escaped text unchanged when there are no terms", () => {
    expect(highlightHtml("Plain text", null, null)).toBe("Plain text");
  });
});
