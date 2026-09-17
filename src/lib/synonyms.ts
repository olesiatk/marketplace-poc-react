/**
 * Furniture-domain concept groups: each is a set of words and short phrases
 * that express the same underlying concept, e.g. "cosy"/"cozy"/"plush
 * cushions". Two consumers:
 * - scripts/index-algolia.ts pushes each group to Algolia as a synonym set,
 *   so searching "cosy" also surfaces products only ever described as
 *   "cozy" or "comfortable".
 * - suggestions.ts uses the group headwords to seed the search-box
 *   autocomplete's "next word" suggestions.
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
