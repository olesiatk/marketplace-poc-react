// Retrieval-accuracy evaluation for the local (no-API-key) search heuristic.
//
// Runs a small hand-labeled set of queries — built from products/reviews
// that use a *different* wording than the query (e.g. querying "cosy" for
// products only ever described as "cozy") — against the real catalog, and
// checks that synonym/phrase-expanded search still finds every known-good
// match, comparing against a literal-keyword-only baseline to make the
// recall lift from concept expansion measurable rather than anecdotal.
//
// Note on methodology: with a 300-product catalog (270 of them procedurally
// generated, deliberately reusing this domain's vocabulary), exhaustively
// hand-labeling *every* relevant product per query isn't practical, so this
// grades recall of a small trusted set of known-positive ids — not
// precision against an exhaustively-labeled set. The known positives are
// only drawn from the 30 original hand-written products, so this remains
// valid regardless of how the generated 270 are (re)shuffled.
//
// Run with: npm run eval:search

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { localHeuristicSearch, tokenize } from "../src/app/lib/search.ts";
import type { MatchesMap, Product, ReviewsMap } from "../src/app/models/product.model.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const products: Product[] = JSON.parse(readFileSync(join(rootDir, "public/data/products.json"), "utf8"));
const reviews: ReviewsMap = JSON.parse(readFileSync(join(rootDir, "public/data/reviews.json"), "utf8"));

interface EvalCase {
  query: string;
  /** Known-good ids (from the original 30 products) that must appear in the results. */
  expectedIds: string[];
  note: string;
  /** When true, graded on set-equality with the baseline instead of recall of expectedIds. */
  expectNoExpansionDrift?: boolean;
}

const EVAL_CASES: EvalCase[] = [
  {
    query: "cosy",
    expectedIds: ["soft-01", "soft-03", "chair-04", "bedroom-01"],
    note: "British-spelling synonym — catalog text only ever uses \"cozy\"",
  },
  {
    query: "pleasant to sit on",
    expectedIds: ["soft-01", "soft-03", "soft-04", "soft-05", "chair-01", "chair-02", "chair-04", "bedroom-01"],
    note: "multi-word contextual phrase (no single word of it is a concept-group member on its own) — every expected id independently contains a literal comfort-family term (comfortable/cozy/ergonomic)",
  },
  {
    query: "an expandable oak dining table",
    expectedIds: ["table-01", "table-02", "table-04", "table-05", "bedroom-02", "bedroom-03"],
    note: "no concept group applies — expanded search must equal the keyword-only baseline exactly (no noise introduced)",
    expectNoExpansionDrift: true,
  },
  {
    query: "nursery furniture for a baby",
    expectedIds: ["soft-03", "soft-04", "bedroom-04"],
    note: "\"baby\" literally matches soft-03/soft-04, and pulls in \"children\" via the kids/nursery concept group to also surface bedroom-04",
  },
  {
    query: "clutter-free storage",
    expectedIds: ["storage-01", "storage-02", "storage-03", "storage-04", "storage-05", "bedroom-05"],
    note: "\"clutter-free\" never appears literally; relies on the storage concept group",
  },
];

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Same whole-word/phrase boundary rule as the library's `containsTerm`, kept local so this baseline has no dependency on the implementation it's compared against. */
function containsWord(blob: string, term: string): boolean {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "u");
  return re.test(blob);
}

/** A literal-keyword-only baseline (no synonym/phrase expansion), for comparison. */
function keywordOnlySearch(query: string, items: Product[], reviewsMap: ReviewsMap): Set<string> {
  const tokens = tokenize(query);
  const hits = new Set<string>();
  items.forEach((p) => {
    const blob = [
      p.name, p.category, p.tags.join(" "), p.material, p.room, p.style, p.description,
      (reviewsMap[p.id] || []).map((r) => r.text).join(" "),
    ].join(" ").toLowerCase();
    if (tokens.some((t) => containsWord(blob, t))) hits.add(p.id);
  });
  return hits;
}

function idsOf(matches: MatchesMap): Set<string> {
  return new Set(matches.keys());
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id));
}

interface RecallResult {
  found: number;
  total: number;
  missing: string[];
}

function recallOf(predicted: Set<string>, expected: string[]): RecallResult {
  const missing = expected.filter((id) => !predicted.has(id));
  return { found: expected.length - missing.length, total: expected.length, missing };
}

console.log(`Evaluating retrieval accuracy over ${products.length} products, ${EVAL_CASES.length} queries.\n`);

let failures = 0;
let totalExpected = 0;
let totalFoundExpanded = 0;
let totalFoundBaseline = 0;

for (const { query, expectedIds, note, expectNoExpansionDrift } of EVAL_CASES) {
  const expanded = idsOf(localHeuristicSearch(query, products, reviews));
  const baseline = keywordOnlySearch(query, products, reviews);

  if (expectNoExpansionDrift) {
    const pass = setsEqual(expanded, baseline);
    if (!pass) failures++;
    console.log(`${pass ? "PASS" : "FAIL"}  "${query}"  [no-expansion-drift check]`);
    console.log(`      ${note}`);
    console.log(`      expanded result count: ${expanded.size}, baseline result count: ${baseline.size}`);
    console.log();
    continue;
  }

  const expandedRecall = recallOf(expanded, expectedIds);
  const baselineRecall = recallOf(baseline, expectedIds);
  totalExpected += expandedRecall.total;
  totalFoundExpanded += expandedRecall.found;
  totalFoundBaseline += baselineRecall.found;

  const pass = expandedRecall.missing.length === 0;
  if (!pass) failures++;

  console.log(`${pass ? "PASS" : "FAIL"}  "${query}"`);
  console.log(`      ${note}`);
  console.log(`      must-find (known positives): [${expectedIds.join(", ")}]`);
  console.log(
    `      expanded search:  found ${expandedRecall.found}/${expandedRecall.total}` +
      ` (${expanded.size} results total)` +
      (expandedRecall.missing.length ? `; MISSING: [${expandedRecall.missing.join(", ")}]` : "")
  );
  console.log(
    `      keyword baseline: found ${baselineRecall.found}/${baselineRecall.total}` +
      ` (${baseline.size} results total)` +
      (baselineRecall.missing.length ? `; missing: [${baselineRecall.missing.join(", ")}]` : "")
  );
  console.log();
}

console.log("─".repeat(60));
console.log(`Known-positive recall — expanded search:  ${totalFoundExpanded}/${totalExpected}`);
console.log(`Known-positive recall — keyword baseline: ${totalFoundBaseline}/${totalExpected}`);
console.log(`${failures} / ${EVAL_CASES.length} queries failed`);

if (failures > 0) {
  console.error(`\nFAILED: ${failures} quer${failures === 1 ? "y" : "ies"} missed a known-positive match or drifted from baseline.`);
  process.exit(1);
}

console.log("\nOK");
