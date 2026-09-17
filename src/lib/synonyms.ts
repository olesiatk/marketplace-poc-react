/**
 * Furniture-domain concept groups for query expansion. Each group is a set
 * of words and short phrases that express the same underlying concept —
 * used to expand a user's query beyond its literal tokens so that e.g.
 * searching "cosy" also surfaces products described as "cozy" or "plush
 * cushions", without needing a vector index.
 *
 * This is a lightweight, deterministic stand-in for semantic recall: it
 * catches synonym and contextual-phrase matches within the fixed catalog
 * vocabulary, but — unlike real embeddings — it can only find an expansion
 * term that appears verbatim somewhere in a product's text.
 */
export const CONCEPT_GROUPS: readonly (readonly string[])[] = [
  [
    "comfortable", "comfy", "cosy", "cozy", "restful", "ergonomic", "ergo",
    "spine support", "soft padding", "pleasant to sit on", "relaxed seating",
    "body-conforming", "plush cushions",
  ],
  ["modern", "contemporary", "sleek", "minimalist", "clean lines", "streamlined", "loft", "industrial"],
  ["small", "compact", "space-saving", "small apartment", "studio apartment", "tight spaces"],
  ["large", "spacious", "oversized", "roomy"],
  ["storage", "organization", "organized", "clutter-free", "tidy", "extra storage", "hidden storage"],
  [
    "durable", "sturdy", "solid", "long-lasting", "hard-wearing", "robust", "well-built",
    "quality", "high-quality", "well-made", "worth it",
  ],
  ["affordable", "budget-friendly", "cheap", "inexpensive", "low-cost", "economical"],
  ["stylish", "elegant", "chic", "fashionable", "statement piece", "eye-catching", "focal point", "centerpiece"],
  ["wood", "wooden", "solid wood", "natural material"],
  ["bright", "colorful", "vibrant", "vivid", "bold accent", "bold color"],
  [
    "kids", "kid", "children", "child-friendly", "kids room", "nursery", "baby",
    "safe", "safety rails", "guardrails", "child-safe", "family", "big family", "for the family",
  ],
  ["office", "workspace", "work from home", "home office", "desk setup"],
  // Evidence-based additions from reviewing every product/review in the
  // catalog (see the "cosy"/"pleasant to sit on" pattern above): each of
  // these recurs across several products' descriptions and reviews.
  ["practical", "functional", "convenient", "handy", "useful"],
  ["assembly", "easy to assemble", "easy to install", "quick to set up", "self-assembly"],
  ["lightweight", "portable", "easy to move", "easy to carry"],
  ["guests", "extra seating", "for visitors", "host guests"],
  ["versatile", "neutral", "matches any interior", "goes with anything"],
  ["outdoor", "balcony", "terrace", "patio", "weather-resistant", "moisture-resistant"],
  ["kitchen", "dining room", "dining area", "family meals"],
  ["smooth", "slides easily", "glides", "opens easily"],
];

/**
 * Given a set of literal query tokens and the raw (lowercased) query text,
 * returns every other term from any concept group the query touches —
 * whether by an exact token match (single-word terms) or a substring match
 * (multi-word phrases, which never survive tokenization intact).
 */
export function expandConcepts(tokens: ReadonlySet<string>, lowerQuery: string): Set<string> {
  const expansions = new Set<string>();

  for (const group of CONCEPT_GROUPS) {
    const queryTouchesGroup = group.some((term) =>
      term.includes(" ") ? lowerQuery.includes(term) : tokens.has(term)
    );
    if (!queryTouchesGroup) continue;

    for (const term of group) {
      if (term.includes(" ") ? !lowerQuery.includes(term) : !tokens.has(term)) {
        expansions.add(term);
      }
    }
  }

  return expansions;
}
