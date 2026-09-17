import { liteClient as algoliasearch } from "algoliasearch/lite";

const APP_ID = import.meta.env["VITE_ALGOLIA_APPLICATION_ID"];
const SEARCH_API_KEY = import.meta.env["VITE_ALGOLIA_SEARCH_API_KEY"];

export const isAlgoliaConfigured = Boolean(APP_ID && SEARCH_API_KEY);

// Index built and configured by scripts/index-algolia.ts.
export const ALGOLIA_INDEX_NAME = "marketplace-poc-products";

export const searchClient = algoliasearch(APP_ID ?? "", SEARCH_API_KEY ?? "");
