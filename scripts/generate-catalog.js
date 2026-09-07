#!/usr/bin/env node
"use strict";

// Grows public/data/products.json and public/data/reviews.json from the
// original 30 hand-written products up to 300, by procedurally generating
// 45 additional products per category. The original 30 are read back in
// and kept byte-for-byte (same ids/content) — only new ids are appended —
// so existing references (eval ground truth, tests) stay valid.
//
// Deterministic: seeded PRNG, so re-running produces the exact same
// catalog rather than reshuffling it on every run.
//
// Run with: node scripts/generate-catalog.js

const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const productsPath = path.join(rootDir, "public/data/products.json");
const reviewsPath = path.join(rootDir, "public/data/reviews.json");

const TARGET_PER_CATEGORY = 50; // 5 existing + 45 generated, x6 categories = 300

// Deterministic PRNG (mulberry32) so the generated catalog is reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(1337);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const pickN = (arr, n) => {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
};
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const roundToStep = (n, step) => Math.round(n / step) * step;

const STYLES = [
  "Scandinavian minimalism", "modern minimalism", "loft / industrial", "mid-century modern",
  "classic", "bohemian", "rustic farmhouse", "coastal",
];
const SIZE_ADJECTIVES = ["compact", "spacious", "cozy", "oversized", "slim", "standard-sized"];

const EXTRA_SENTENCES = {
  soft: [
    "Deep cushions and a soft fabric make it a comfortable spot to unwind after a long day.",
    "Sturdy wooden legs and a well-built frame keep it sturdy for years of everyday use.",
    "A practical choice for small apartments — compact but still roomy enough for guests.",
    "The plush cushions and relaxed seating make it pleasant to sit on for hours.",
  ],
  chair: [
    "Lightweight and easy to move around, it's a practical pick for a busy kitchen or office.",
    "A sturdy, well-built frame keeps it stable even with daily use.",
    "A supportive shape and build make long sitting sessions more pleasant.",
    "Budget-friendly and easy to assemble, it's a solid choice for furnishing on a budget.",
  ],
  table: [
    "Solid construction and a scratch-resistant finish make it built to last.",
    "A versatile, neutral finish that matches almost any interior.",
    "A handy extra surface for everyday use, wherever it's placed.",
    "Easy to assemble and sturdy enough for daily use.",
  ],
  storage: [
    "A practical, functional solution for keeping a small room organized and clutter-free.",
    "Smooth-sliding drawers and a sturdy frame make it both handy and long-lasting.",
    "Its minimalist design doesn't overwhelm the room while adding plenty of hidden storage.",
    "Easy to assemble and versatile enough to fit a bedroom, hallway, or living room.",
  ],
  bedroom: [
    "A soft, upholstered finish creates a cozy atmosphere for rest and sleep.",
    "Built-in storage makes it a practical, space-saving solution for a small bedroom.",
    "Sturdy construction and a quality finish make it a comfortable long-term choice.",
    "Sturdy construction and a smooth, rounded finish make it a solid, worry-free pick for a kids room.",
  ],
  decor: [
    "A stylish accent piece and a genuine focal point for the room.",
    "Adds a fresh, elegant touch to the room and lifts the overall mood.",
    "Lightweight and easy to hang or move, it's a practical decor upgrade.",
    "Easy to install and a handy addition to any home office.",
  ],
};

const CATEGORIES = [
  {
    slug: "soft", name: "Soft Seating", icon: "sofa", extraKey: "soft",
    types: [
      "Two-Seater Sofa", "Three-Seater Sofa", "Corner Sofa", "Loveseat", "Sofa Bed",
      "Chaise Lounge", "Floor Pouf", "Bean Bag Chair", "Chesterfield Sofa", "Modular Sofa",
    ],
    materials: ["fabric (velour)", "velvet", "linen", "leather", "boucle fabric", "chenille fabric", "corduroy fabric"],
    rooms: ["living room", "studio apartment", "home office", "reading nook"],
    priceRange: [100, 800], // USD
    dims: () => `${randInt(90, 260)}x${randInt(70, 100)}x${randInt(70, 95)} cm`,
  },
  {
    slug: "table", name: "Tables", icon: "table", extraKey: "table",
    types: [
      "Dining Table", "Coffee Table", "Side Table", "Console Table", "Bar Table",
      "Nesting Tables", "Extendable Dining Table", "Kitchen Table",
    ],
    materials: ["oak", "walnut", "pine", "metal and glass", "MDF with veneer", "reclaimed wood", "marble-top"],
    rooms: ["dining room", "kitchen", "living room", "balcony"],
    // Rooms a type can plausibly be used in — narrower than the category's
    // full `rooms` pool so e.g. a "Kitchen Table" can't roll "living room",
    // and a "Coffee Table" (a low lounge table) can't roll "kitchen".
    // Types not listed here draw from the full category pool.
    roomsByType: {
      "Kitchen Table": ["kitchen", "dining room"],
      "Coffee Table": ["living room", "balcony"],
      "Side Table": ["living room", "dining room", "balcony"],
      "Console Table": ["living room", "dining room"],
      "Nesting Tables": ["living room"],
    },
    priceRange: [40, 550], // USD
    dims: () => `${randInt(40, 220)}x${randInt(40, 100)}x${randInt(40, 78)} cm`,
  },
  {
    slug: "chair", name: "Chairs & Seating", icon: "chair", extraKey: "chair",
    types: [
      "Dining Chair", "Office Chair", "Bar Stool", "Folding Chair", "Rocking Chair",
      "Accent Chair", "Kitchen Stool", "Recliner",
    ],
    materials: ["wood", "mesh", "fabric", "metal and wood", "rattan", "plastic and metal"],
    rooms: ["kitchen", "home office", "dining room", "living room"],
    // See the `roomsByType` note on the Tables category above — same idea:
    // an "Office Chair" shouldn't be able to roll "kitchen", etc.
    roomsByType: {
      "Office Chair": ["home office", "living room"],
      "Dining Chair": ["kitchen", "dining room"],
      "Bar Stool": ["kitchen", "dining room"],
      "Kitchen Stool": ["kitchen", "dining room"],
      "Rocking Chair": ["living room", "home office"],
      "Accent Chair": ["living room", "home office"],
      "Recliner": ["living room", "home office"],
    },
    priceRange: [20, 300], // USD
    dims: () => `${randInt(40, 65)}x${randInt(40, 65)}x${randInt(75, 120)} cm`,
  },
  {
    slug: "storage", name: "Storage", icon: "storage", extraKey: "storage",
    types: [
      "Bookcase", "Chest of Drawers", "Wardrobe", "TV Stand", "Wall Shelf",
      "Shoe Cabinet", "Sideboard", "Storage Bench",
    ],
    materials: ["wood", "MDF", "metal and wood", "engineered wood", "rattan and wood"],
    rooms: ["living room", "bedroom", "hallway", "home office"],
    priceRange: [30, 450], // USD
    dims: () => `${randInt(40, 180)}x${randInt(30, 60)}x${randInt(30, 220)} cm`,
  },
  {
    slug: "bedroom", name: "Bedroom", icon: "bed", extraKey: "bedroom",
    types: [
      "Bed Frame", "Bunk Bed", "Nightstand", "Dressing Table", "Storage Bed",
      "Daybed", "Upholstered Bed",
    ],
    materials: ["upholstered fabric", "solid wood", "MDF with veneer", "metal frame", "velvet"],
    rooms: ["bedroom", "kids room", "guest room"],
    priceRange: [35, 650], // USD
    dims: () => `${randInt(90, 200)}x${randInt(140, 220)}x${randInt(30, 130)} cm`,
  },
  {
    slug: "decor", name: "Decor & Lighting", icon: "decor", extraKey: "decor",
    types: [
      "Floor Lamp", "Desk Lamp", "Wall Mirror", "Wall Art", "Indoor Plant",
      "Table Lamp", "Area Rug", "Wall Clock", "Pendant Light",
    ],
    materials: ["metal", "ceramic", "glass", "wood", "woven fiber", "cotton"],
    rooms: ["living room", "home office", "hallway", "bedroom"],
    priceRange: [10, 225], // USD
    dims: () => `${randInt(20, 160)}x${randInt(20, 160)}x${randInt(5, 170)} cm`,
  },
];

const FIRST_NAMES = [
  "Emma", "Max", "Christina", "Mykola", "Olena", "Andriy", "Sofia", "Daniel", "Nadia", "Ivan",
  "Kate", "Tom", "Anna", "Marco", "Julia", "Peter", "Nina", "Oleh", "Vika", "Sam",
  "Laura", "Ben", "Iryna", "Chris", "Maria", "Yuri", "Alice", "Victor", "Zoe", "Denys",
];
const LAST_INITIALS = ["R.", "T.", "L.", "P.", "K.", "M.", "S.", "D.", "B.", "H.", "V.", "N.", "G.", "F.", "W."];

const REVIEW_TEMPLATES = [
  (attrs) => `Really happy with this ${attrs.typeLower} — it looks even better in person.`,
  (attrs) => `A ${attrs.styleLower}, ${attrs.materialLower} ${attrs.typeLower} that fits our ${attrs.room} perfectly.`,
  (attrs) => `Comfortable and well-built, this ${attrs.typeLower} was easy to put together too.`,
  (attrs) => `Great quality for the price. It's versatile and matches our other furniture.`,
  (attrs) => `Sturdy and practical — exactly what we needed for our ${attrs.room}.`,
  (attrs) => `The ${attrs.typeLower} arrived quickly and assembly took under an hour.`,
];

const SMALL_WORDS = new Set(["and", "with", "of", "in", "a", "the", "for"]);

function toTitleCase(str) {
  return str
    .split(" ")
    .map((word, i) => {
      if (/^[A-Z]{2,}$/.test(word)) return word; // keep acronyms like "MDF" as-is
      if (i > 0 && SMALL_WORDS.has(word.toLowerCase())) return word.toLowerCase();
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function buildProduct(category, index) {
  const type = pick(category.types);
  const material = pick(category.materials);
  const room = pick(category.roomsByType?.[type] ?? category.rooms);
  const style = pick(STYLES);
  const size = pick(SIZE_ADJECTIVES);
  const extra = pick(EXTRA_SENTENCES[category.extraKey]);

  // Product images are generic green category icons, not real photos, so
  // color isn't a meaningful attribute here at all — deliberately absent
  // from both the structured fields and any user-facing text.
  const name = `${toTitleCase(size)} ${type}`;
  const [minPrice, maxPrice] = category.priceRange;
  const price = roundToStep(randInt(minPrice, maxPrice), 5);

  const templateIndex = randInt(0, 2);
  const typeLower = type.toLowerCase();
  const styleLower = style.toLowerCase();
  let description;
  if (templateIndex === 0) {
    description = `A ${size} ${typeLower} made of ${material}, designed for a ${room}. ${extra}`;
  } else if (templateIndex === 1) {
    description = `This ${typeLower} pairs ${material} construction with a ${styleLower} look — perfect for a ${room}. ${extra}`;
  } else {
    description = `${type}. ${toTitleCase(material)} construction suited to a ${room} in a ${styleLower} style. ${extra}`;
  }

  const tags = [
    ...new Set([
      typeLower, size, material.split(/[,()]/)[0].trim().toLowerCase(), room, styleLower,
    ]),
  ];

  const product = {
    id: `${category.slug}-${String(index).padStart(2, "0")}`,
    name,
    category: category.name,
    icon: category.icon,
    price,
    material,
    room,
    style,
    dimensions: category.dims(),
    tags,
    description,
    imagePrompt: `minimalist illustrated ${size} ${typeLower}`,
  };

  return { product, typeLower };
}

function buildReviews(product, typeLower) {
  const count = randInt(1, 3);
  const attrs = {
    typeLower,
    materialLower: product.material.toLowerCase(),
    styleLower: product.style.toLowerCase(),
    room: product.room,
  };
  const templates = pickN(REVIEW_TEMPLATES, count);
  return templates.map((template) => ({
    author: `${pick(FIRST_NAMES)} ${pick(LAST_INITIALS)}`,
    rating: pick([3, 4, 4, 5, 5, 5]),
    text: template(attrs),
  }));
}

// Matches only the original hand-written ids (e.g. "soft-01".."soft-05"),
// regardless of how many generated ones a prior run already appended —
// this keeps the script idempotent: re-running it always regenerates the
// same 270 products from the same 30 originals, rather than treating its
// own previous output as the new baseline.
const ORIGINAL_ID_RE = /-0[1-5]$/;

function main() {
  const fileProducts = JSON.parse(fs.readFileSync(productsPath, "utf8"));
  const fileReviews = JSON.parse(fs.readFileSync(reviewsPath, "utf8"));

  const originalProducts = fileProducts.filter((p) => ORIGINAL_ID_RE.test(p.id));
  const products = [...originalProducts];
  const reviews = {};
  originalProducts.forEach((p) => { reviews[p.id] = fileReviews[p.id] ?? []; });

  for (const category of CATEGORIES) {
    const existingInCategory = originalProducts.filter((p) => p.category === category.name).length;
    const toGenerate = TARGET_PER_CATEGORY - existingInCategory;
    for (let i = 0; i < toGenerate; i++) {
      const index = existingInCategory + i + 1;
      const { product, typeLower } = buildProduct(category, index);
      products.push(product);
      reviews[product.id] = buildReviews(product, typeLower);
    }
  }

  fs.writeFileSync(productsPath, JSON.stringify(products, null, 2) + "\n");
  fs.writeFileSync(reviewsPath, JSON.stringify(reviews, null, 2) + "\n");

  console.log(`Wrote ${products.length} products and reviews for ${Object.keys(reviews).length} of them.`);
}

main();
