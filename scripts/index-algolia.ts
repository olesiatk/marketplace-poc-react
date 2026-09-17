// Builds and configures the Algolia index that powers search in src/App.tsx.
//
// Merges the two canonical catalog files (public/data/products.json +
// reviews.json — see CLAUDE.md on scripts/generate-catalog.js) into Algolia
// records, configures faceting/searchable attributes, and pushes the
// furniture concept groups from src/lib/synonyms.ts as Algolia synonyms —
// that's what preserves "cosy" also finding products only ever described as
// "cozy"/"comfortable" without reimplementing query expansion client-side.
//
// Run with: npm run index:products

import { algoliasearch } from "algoliasearch";
import ora from "ora";
import { loadEnv } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CONCEPT_GROUPS } from "../src/lib/synonyms.ts";
import type { Product, Review, ReviewsMap } from "../src/models/product.model.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const env = loadEnv(process.env.MODE ?? "dev", rootDir, "");

const appId = env.VITE_ALGOLIA_APPLICATION_ID;
const writeApiKey = env.ALGOLIA_WRITE_API_KEY;
// Kept in sync by hand with src/lib/algolia.ts's ALGOLIA_INDEX_NAME (that
// module can't be imported here — it reads import.meta.env, a Vite-only
// global this plain tsx script doesn't have).
const ALGOLIA_INDEX_NAME = "marketplace-poc-products";

if (!appId) {
  throw new Error("Missing VITE_ALGOLIA_APPLICATION_ID environment variable.");
}

if (!writeApiKey) {
  throw new Error("Missing ALGOLIA_WRITE_API_KEY environment variable.");
}

const client = algoliasearch(appId, writeApiKey);
const spinner = ora();

/** Same splitting App.tsx used to derive filterOptions from these fields. */
function splitAttr(value: string, separator: RegExp): string[] {
  return value.split(separator).map((s) => s.trim()).filter(Boolean);
}

interface AlgoliaProductRecord extends Product {
  objectID: string;
  reviews: Review[];
  materialFacets: string[];
  roomFacets: string[];
}

function buildRecords(products: Product[], reviews: ReviewsMap): AlgoliaProductRecord[] {
  return products.map((product) => ({
    ...product,
    objectID: product.id,
    reviews: reviews[product.id] || [],
    materialFacets: splitAttr(product.material, /[,()]/),
    roomFacets: splitAttr(product.room, /,/),
  }));
}

async function indexProducts(): Promise<void> {
  spinner.text = "Reading the local product catalog...";

  const products: Product[] = JSON.parse(readFileSync(join(rootDir, "public/data/products.json"), "utf8"));
  const reviews: ReviewsMap = JSON.parse(readFileSync(join(rootDir, "public/data/reviews.json"), "utf8"));
  const records = buildRecords(products, reviews);

  spinner.text = `Indexing ${records.length.toLocaleString()} products into ${ALGOLIA_INDEX_NAME}...`;

  await client.saveObjects({
    indexName: ALGOLIA_INDEX_NAME,
    objects: records,
    waitForTasks: true,
  });
}

async function configureIndex(): Promise<void> {
  spinner.text = `Configuring ${ALGOLIA_INDEX_NAME}...`;

  const { taskID } = await client.setSettings({
    indexName: ALGOLIA_INDEX_NAME,
    indexSettings: {
      searchableAttributes: [
        "unordered(name)",
        "unordered(tags)",
        "unordered(category)",
        "unordered(description)",
        "unordered(reviews.text)",
        "material",
        "room",
        "style",
      ],
      attributesForFaceting: ["category", "materialFacets", "roomFacets", "price"],
      attributesToSnippet: ["description:20"],
    },
  });

  await client.waitForTask({ indexName: ALGOLIA_INDEX_NAME, taskID });
}

async function pushSynonyms(): Promise<void> {
  spinner.text = "Pushing furniture concept groups as synonyms...";

  await client.saveSynonyms({
    indexName: ALGOLIA_INDEX_NAME,
    synonymHit: CONCEPT_GROUPS.map((group, index) => ({
      objectID: `concept-${index}`,
      type: "synonym" as const,
      synonyms: [...group],
    })),
    replaceExistingSynonyms: true,
  });
}

try {
  spinner.start("Beginning index setup...");
  await indexProducts();
  await configureIndex();
  await pushSynonyms();
  spinner.succeed("Successfully indexed and configured products.");
} catch (error) {
  spinner.fail("Indexing failed.");
  console.error(error);
  process.exitCode = 1;
}
