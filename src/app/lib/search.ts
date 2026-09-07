import { CONCEPT_GROUPS, expandConcepts } from "./synonyms";
import type { MatchesMap, Product, ReviewsMap } from "../models/product.model";

// Words that also belong to a synonym/concept family (e.g. "storage",
// "office", "kitchen" are both a furniture type *and* a concept-group
// member) are excluded from the type-word gate below — they should keep
// matching anywhere via their synonyms, same as any other concept word,
// rather than being pinned to a literal name/category/tags hit.
const CONCEPT_WORDS = new Set(CONCEPT_GROUPS.flat());

const STOPWORDS = new Set([
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "want", "wants", "wanted", "need", "needs", "needed", "looking", "look", "for",
  "the", "a", "an", "and", "or", "but", "that", "this", "these", "those",
  "in", "on", "at", "to", "from", "by", "with", "without", "about", "into",
  "my", "your", "our", "their", "his", "its", "some", "any", "very", "really",
  "please", "would", "like", "something", "someone", "just", "can", "could",
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/gi) || []).filter(
    (t) => t.length >= 3 && !STOPWORDS.has(t)
  );
}

function reviewsBlob(reviews: ReviewsMap, id: string): string {
  return (reviews[id] || []).map((r) => r.text).join(" ").toLowerCase();
}

export interface ExpandedQuery {
  /** Literal tokens extracted from the query itself. */
  tokens: string[];
  /**
   * Synonyms and contextual phrases pulled in via concept expansion (e.g.
   * "cosy" → "comfortable", "plush cushions") that aren't already literal
   * query tokens.
   */
  expansions: string[];
}

/**
 * Expands a raw query into its literal tokens plus any related synonyms and
 * contextual phrases from the furniture concept dictionary, so matching
 * isn't limited to exact lexical strings.
 */
export function expandQueryTerms(query: string): ExpandedQuery {
  const tokens = tokenize(query);
  const expansions = expandConcepts(new Set(tokens), query.toLowerCase());
  return { tokens, expansions: [...expansions] };
}

interface FieldWeights {
  tags: number;
  name: number;
  category: number;
  attr: number;
  desc: number;
  review: number;
}

// Full weight for a term the user actually typed.
const DIRECT_WEIGHTS: FieldWeights = { tags: 4, name: 3, category: 2, attr: 2, desc: 1, review: 1 };
// Reduced weight for a term pulled in via synonym/phrase expansion, so
// exact matches still rank above inferred ones.
const SYNONYM_WEIGHTS: FieldWeights = { tags: 2, name: 2, category: 1, attr: 1, desc: 1, review: 1 };

type Dimensions = readonly [number, number, number];

const DIMENSION_PATTERN = /(\d{1,5}(?:\.\d{1,2})?)\s*[x×]\s*(\d{1,5}(?:\.\d{1,2})?)\s*[x×]\s*(\d{1,5}(?:\.\d{1,2})?)/i;

/** Extracts a W×D×H triple from text like "150x85x80 cm" or a query like "280x180x90". */
export function parseDimensions(text: string): Dimensions | null {
  const match = DIMENSION_PATTERN.exec(text);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * How far apart two W×D×H triples are, as the WORST-axis relative
 * difference (0 = identical on every axis, 1 = some axis is off by 100%).
 * Triples are sorted before comparing so axis order doesn't matter — a
 * user searching "280x180x90" should also find a product listed as
 * "90x180x280".
 *
 * Deliberately the max, not the average: two axes matching almost exactly
 * can otherwise mask a third that's way off (e.g. 90≈88 and 180≈179 but
 * 280 vs 210 — a 70cm/25% gap) and still average out to "close enough".
 */
function dimensionDistance(a: Dimensions, b: Dimensions): number {
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  let maxRelativeDiff = 0;
  for (let i = 0; i < 3; i++) {
    const scale = Math.max(sortedA[i], sortedB[i], 1);
    maxRelativeDiff = Math.max(maxRelativeDiff, Math.abs(sortedA[i] - sortedB[i]) / scale);
  }
  return maxRelativeDiff;
}

// Products where every axis is within this relative size difference count as a dimension match.
const DIMENSION_MATCH_THRESHOLD = 0.2;
// Score for an exact size match, tapering to 0 at the threshold — comparable to a strong tag hit.
const DIMENSION_MAX_SCORE = 5;

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word/phrase containment check — unlike a raw substring test, this
 * won't count "table" as a hit inside "comfortable". Uses the same
 * Unicode-aware word-boundary rule as {@link highlightHtml}, so anything
 * that scores a hit here is guaranteed to actually be highlightable.
 */
function containsTerm(blob: string, term: string): boolean {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "u");
  return re.test(blob);
}

/**
 * Words that identify a specific furniture *type* — collected from every
 * product's category and primary tag (`tags[0]`, always the type name for
 * generated products, e.g. "office chair" → "office"/"chair"), so it's
 * derived from the live catalog rather than a hardcoded list.
 */
function buildTypeVocabulary(products: Product[]): Set<string> {
  const vocab = new Set<string>();
  products.forEach((p) => {
    tokenize(p.category).forEach((w) => vocab.add(w));
    if (p.tags[0]) tokenize(p.tags[0]).forEach((w) => vocab.add(w));
  });
  return vocab;
}

/**
 * Client-side relevance heuristic — used when no Groq API key is
 * configured, or as a fallback if the Groq request fails. Combines exact
 * keyword matching (sparse/BM25-style field weighting) with synonym and
 * contextual-phrase expansion for a lightweight semantic-ish recall boost,
 * without requiring a vector index.
 */
export function localHeuristicSearch(query: string, products: Product[], reviews: ReviewsMap): MatchesMap {
  const { tokens, expansions } = expandQueryTerms(query);
  const queryDimensions = parseDimensions(query);
  const matches: MatchesMap = new Map();
  if (!tokens.length && !queryDimensions) return matches;

  const matchers = [
    ...tokens.map((term) => ({ term, weights: DIRECT_WEIGHTS, isSynonym: false })),
    ...expansions.map((term) => ({ term, weights: SYNONYM_WEIGHTS, isSynonym: true })),
  ];

  // A type word (e.g. "chair") in the query is a strong signal the user
  // wants that kind of furniture specifically — without this, a broad,
  // widely-matching term like "cozy" (a big synonym family that shows up
  // across every category) is enough on its own to pull in completely
  // unrelated products ("cozy" tables, wardrobes...) that never actually
  // match "chair" anywhere. Every product must contain at least one of the
  // query's type words somewhere in its own name/category/tags — plain
  // non-type terms (materials, moods, rooms...) are unaffected and keep
  // matching anywhere, same as before.
  const typeVocabulary = buildTypeVocabulary(products);
  const queryTypeWords = tokens.filter((t) => typeVocabulary.has(t) && !CONCEPT_WORDS.has(t));

  products.forEach((product) => {
    const nameBlob = product.name.toLowerCase();
    const categoryBlob = product.category.toLowerCase();
    const tagsBlob = product.tags.join(" ").toLowerCase();

    if (queryTypeWords.length > 0) {
      const identityBlob = `${nameBlob} ${categoryBlob} ${tagsBlob}`;
      // Primary tag checked with plain substring too (not just word-boundary)
      // so a single-word compound like "armchair" still counts as containing
      // "chair" — containsTerm alone would miss it (no boundary between "arm"
      // and "chair"), same reason it correctly misses "table" in "comfortable".
      const primaryType = (product.tags[0] ?? "").toLowerCase();
      const typeMatched = queryTypeWords.some(
        (w) => containsTerm(identityBlob, w) || primaryType.includes(w)
      );
      if (!typeMatched) return;
    }

    const attrBlob = `${product.material} ${product.room} ${product.style} ${product.dimensions}`.toLowerCase();
    const descBlob = product.description.toLowerCase();
    const revBlob = reviewsBlob(reviews, product.id);

    let score = 0;
    const directTerms = new Set<string>();
    const synonymTerms = new Set<string>();

    matchers.forEach(({ term, weights, isSynonym }) => {
      let hit = false;
      if (containsTerm(tagsBlob, term)) { score += weights.tags; hit = true; }
      if (containsTerm(nameBlob, term)) { score += weights.name; hit = true; }
      if (containsTerm(categoryBlob, term)) { score += weights.category; hit = true; }
      if (containsTerm(attrBlob, term)) { score += weights.attr; hit = true; }
      if (containsTerm(descBlob, term)) { score += weights.desc; hit = true; }
      if (containsTerm(revBlob, term)) { score += weights.review; hit = true; }
      if (hit) (isSynonym ? synonymTerms : directTerms).add(term);
    });

    if (queryDimensions) {
      const productDimensions = parseDimensions(product.dimensions);
      if (productDimensions) {
        const distance = dimensionDistance(queryDimensions, productDimensions);
        if (distance < DIMENSION_MATCH_THRESHOLD) {
          score += DIMENSION_MAX_SCORE * (1 - distance / DIMENSION_MATCH_THRESHOLD);
          // Adding the product's own dimensions string verbatim lets the
          // existing highlighter pick it up automatically once the
          // Dimensions row is rendered through it. A truly identical size
          // (after sorting axes) is an exact match — yellow — same as any
          // other literal query hit; merely within tolerance is only a
          // similar/inferred one — green.
          const dimensionText = product.dimensions.toLowerCase();
          (distance < 1e-9 ? directTerms : synonymTerms).add(dimensionText);
        }
      }
    }

    if (score > 0) matches.set(product.id, { score, directTerms, synonymTerms });
  });

  return matches;
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c] as string);
}

const HIGHLIGHT_CLASS = {
  exact: "hl",
  synonym: "hl-synonym",
} as const;

/**
 * Escapes `text` and wraps any occurrence of a term from `directTerms` or
 * `synonymTerms` (Unicode-aware word boundaries) in a <mark>: yellow
 * (`hl`) for an exact query-word match, light green (`hl-synonym`) for a
 * term pulled in via synonym/phrase expansion. Returns an HTML string
 * suitable for [innerHTML].
 */
export function highlightHtml(
  text: string | null | undefined,
  directTerms: Set<string> | null | undefined,
  synonymTerms: Set<string> | null | undefined
): string {
  const escaped = escapeHtml(text ?? "");

  const classByTerm = new Map<string, keyof typeof HIGHLIGHT_CLASS>();
  (directTerms ?? []).forEach((t) => t && classByTerm.set(t.toLowerCase(), "exact"));
  (synonymTerms ?? []).forEach((t) => {
    // A term is never in both sets by construction, but favor "exact" defensively.
    if (t && !classByTerm.has(t.toLowerCase())) classByTerm.set(t.toLowerCase(), "synonym");
  });
  if (!classByTerm.size) return escaped;

  const pattern = [...classByTerm.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  if (!pattern) return escaped;

  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, "giu");
  return escaped.replace(re, (match) => {
    const kind = classByTerm.get(match.toLowerCase()) ?? "exact";
    return `<mark class="${HIGHLIGHT_CLASS[kind]}">${match}</mark>`;
  });
}

export function wordFormProducts(n: number): string {
  return n === 1 ? "product" : "products";
}

export function wordFormMatches(n: number): string {
  return n === 1 ? "match" : "matches";
}
