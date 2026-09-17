import type { Hit } from "instantsearch.js";

export interface Review {
  author: string;
  rating: number;
  text: string;
}

export type ReviewsMap = Record<string, Review[]>;

/** The raw catalog shape, as stored in public/data/products.json. */
export interface Product {
  id: string;
  name: string;
  category: string;
  icon: string;
  price: number;
  material: string;
  room: string;
  style: string;
  dimensions: string;
  tags: string[];
  description: string;
  imagePrompt?: string;
}

/**
 * A product as stored in the Algolia index — reviews are embedded at index
 * time (scripts/index-algolia.ts) so the client never fetches reviews.json
 * separately.
 */
export type ProductRecord = Product & { reviews: Review[] };

/** An Algolia search hit for a product — adds _highlightResult/_snippetResult, read by <Highlight>/<Snippet>. */
export type ProductHit = Hit<ProductRecord>;

export interface Filters {
  category: string;
  room: string;
  material: string;
  maxPrice: number;
}

export interface FilterOptions {
  categories: string[];
  rooms: string[];
  materials: string[];
}
