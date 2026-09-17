import { CONCEPT_GROUPS } from "./synonyms";
import type { Product } from "../models/product.model";

/** Shown as clickable prompts when the search box is focused and still empty. */
export const EXAMPLE_QUERIES: readonly string[] = [
  "ergonomic office chair with back support",
  "spacious sofa for a big family",
  "modern minimalist wooden table",
];

// The first term of each concept group stands in for the whole group
// (e.g. "comfortable" for the comfort/cosy/ergonomic family) — enough to
// suggest a search direction without flooding the list with every synonym.
const CONCEPT_HEADWORDS: readonly string[] = CONCEPT_GROUPS.map((group) => group[0]);

export interface SearchVocabulary {
  /** Full pool (tags, attributes, every synonym) used to complete a word that's still being typed. */
  terms: string[];
  /** A smaller, curated pool (categories + one headword per concept) suggested once a word is finished. */
  nextWordTerms: string[];
}

function splitAttr(value: string, separator: RegExp): string[] {
  return value.split(separator).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Builds the suggestion vocabulary from the live catalog plus the synonym dictionary. */
export function buildVocabulary(products: Product[]): SearchVocabulary {
  const terms = new Set<string>();
  const categories = new Set<string>();

  products.forEach((p) => {
    const category = p.category.toLowerCase();
    categories.add(category);
    terms.add(category);
    p.tags.forEach((t) => terms.add(t.toLowerCase()));
    splitAttr(p.material, /[,()]/).forEach((t) => terms.add(t));
    splitAttr(p.room, /,/).forEach((t) => terms.add(t));
    terms.add(p.style.toLowerCase());
  });

  CONCEPT_GROUPS.forEach((group) => group.forEach((t) => terms.add(t)));

  return {
    terms: [...terms].sort((a, b) => a.length - b.length || a.localeCompare(b)),
    nextWordTerms: [...new Set([...categories, ...CONCEPT_HEADWORDS])].sort((a, b) => a.localeCompare(b)),
  };
}

export interface Suggestion {
  /** The full query text to fill the input with if this suggestion is picked. */
  query: string;
  /** The newly-added tail of `query`, so the UI can visually emphasize it. */
  completion: string;
}

const MAX_SUGGESTIONS = 6;

/**
 * Google-style suggestions for the search box:
 * - empty input → the curated example queries;
 * - typing a word → completes it from the catalog vocabulary;
 * - just finished a word (trailing space) → suggests what to add next.
 */
export function getSuggestions(query: string, vocabulary: SearchVocabulary): Suggestion[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return EXAMPLE_QUERIES.slice(0, MAX_SUGGESTIONS).map((q) => ({ query: q, completion: q }));
  }

  const lower = trimmed.toLowerCase();
  const results: Suggestion[] = [];
  const seen = new Set<string>();

  const addResult = (fullQuery: string, completion: string) => {
    const key = fullQuery.toLowerCase();
    if (!completion || seen.has(key) || key === lower) return;
    seen.add(key);
    results.push({ query: fullQuery, completion });
  };

  const endsWithSpace = /\s$/.test(query);
  const words = trimmed.split(/\s+/);
  const lastWord = endsWithSpace ? "" : (words.pop() ?? "");
  const prefix = words.join(" ");

  if (lastWord) {
    for (const term of vocabulary.terms) {
      if (results.length >= MAX_SUGGESTIONS) break;
      if (term === lastWord.toLowerCase() || !term.startsWith(lastWord.toLowerCase())) continue;
      addResult(prefix ? `${prefix} ${term}` : term, term.slice(lastWord.length));
    }
  } else {
    for (const term of vocabulary.nextWordTerms) {
      if (results.length >= MAX_SUGGESTIONS) break;
      addResult(`${trimmed} ${term}`, term);
    }
  }

  for (const example of EXAMPLE_QUERIES) {
    if (results.length >= MAX_SUGGESTIONS) break;
    if (example.toLowerCase().startsWith(lower)) addResult(example, example.slice(trimmed.length));
  }

  return results.slice(0, MAX_SUGGESTIONS);
}
