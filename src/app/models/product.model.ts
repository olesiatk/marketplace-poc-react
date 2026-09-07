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

export interface Review {
  author: string;
  rating: number;
  text: string;
}

export type ReviewsMap = Record<string, Review[]>;

export interface MatchInfo {
  score: number;
  /** Terms that are literal query words — highlighted in yellow. */
  directTerms: Set<string>;
  /** Synonyms/contextual phrases pulled in via concept expansion — highlighted in light green. */
  synonymTerms: Set<string>;
}

export type MatchesMap = Map<string, MatchInfo>;

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

export type AiMode = "groq" | "local" | null;
