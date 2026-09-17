import { localHeuristicSearch, tokenize } from "./search";
import type { AiMode, MatchesMap, Product, ReviewsMap } from "../models/product.model";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = import.meta.env["VITE_GROQ_API_KEY"];
// "llama-3.1-8b-instant"/"llama-3.3-70b-versatile" have been retired from
// Groq's catalog — gpt-oss-20b is a currently-available, JSON-mode-capable
// replacement. Verified live against this project's Groq account.
const MODEL = import.meta.env["VITE_GROQ_MODEL"] || "openai/gpt-oss-20b";

export const isGroqConfigured = Boolean(API_KEY);

// The catalog is up to 300 products — sent in full, that's ~40K+ tokens,
// well past typical free/on-demand Groq rate limits (this project's
// account: 8K TPM), regardless of model. So instead of sending everything,
// pre-rank with the local heuristic (keyword + synonym expansion) and
// send only the top candidates — a standard retrieve-then-rerank split:
// cheap local retrieval narrows the field, the LLM does the expensive
// semantic judgment only on a pool small enough to fit the budget.
const MAX_CANDIDATES = 25;

/**
 * Picks up to MAX_CANDIDATES products to send to the LLM: local-heuristic
 * matches first (best score first), padded with further catalog products
 * (in their original order) if the heuristic found fewer than that — so
 * the model still gets a full-size, if not perfectly pre-filtered, pool
 * to reason over rather than an arbitrarily short list.
 */
function selectCandidates(query: string, products: Product[], reviews: ReviewsMap): Product[] {
  const localMatches = localHeuristicSearch(query, products, reviews);
  const rankedIds = [...localMatches.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .map(([id]) => id);

  const byId = new Map(products.map((p) => [p.id, p]));
  const ranked = rankedIds.map((id) => byId.get(id)!).filter(Boolean);
  if (ranked.length >= MAX_CANDIDATES) return ranked.slice(0, MAX_CANDIDATES);

  const rankedIdSet = new Set(rankedIds);
  const filler = products.filter((p) => !rankedIdSet.has(p.id));
  return [...ranked, ...filler].slice(0, MAX_CANDIDATES);
}

interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  tags: string[];
  material: string;
  room: string;
  style: string;
  dimensions: string;
  description: string;
  reviews: string[];
}

function buildCatalog(products: Product[], reviews: ReviewsMap): CatalogEntry[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    tags: p.tags,
    material: p.material,
    room: p.room,
    style: p.style,
    dimensions: p.dimensions,
    description: p.description,
    reviews: (reviews[p.id] || []).map((r) => r.text),
  }));
}

const SYSTEM_PROMPT = `You are a semantic search engine for a furniture marketplace.
You are given a user's query (typed or transcribed from speech) and a product catalog in JSON format.

Your job: find products that are semantically relevant to the query — not only products that contain its exact words. To do that, expand the query in your head before matching, considering:
1. Core concepts and their lexical synonyms — e.g. "comfortable" also means "comfy", "cosy", "restful", "ergonomic", "ergo".
2. Contextual, multi-word phrases that express the same idea in a product's own words — e.g. "comfortable" can also read as "spine support", "soft padding", "pleasant to sit on", "relaxed seating", "body-conforming", "plush cushions".
3. Related attributes implied by the query, even if unstated — materials, product types, and usage scenarios (e.g. "a reading nook" implies a chair or armchair, soft upholstery, a living room or bedroom setting; "for a home office" implies a desk or an ergonomic chair).
4. Size: each product has a "dimensions" field formatted "WxDxH cm" (e.g. "150x85x80"). If the query mentions measurements or a size like "280x180x90", match products whose dimensions are close in overall size — not just an exact string match, and regardless of which number is width/depth/height. A product listed as "90x180x280" is just as good a match as "280x180x90".

Analyze the product's name, category, attributes (material, room, style, dimensions), description, AND customer reviews — the query's intent may match not only the listed attributes but also what customers wrote in their reviews (e.g. a reviewer calling a chair "cosy" or praising its back support).

Return ONLY valid JSON (no explanations, no markdown) in this exact shape:
{"matches": [{"id": "<product id>", "score": <0-100 relevance>, "keywords": ["<word-or-phrase-1>", "<word-or-phrase-2>"]}]}
Rules:
- "keywords" must be words or short phrases that appear VERBATIM in that product's name, description, attributes (including "dimensions" when size is why it matched), or reviews, and that justify why it's relevant — including synonyms and contextual phrases you matched, not only the user's literal query words. 2-6 keywords per product.
- Only include genuinely relevant products (not all 30), sorted by descending score.
- If nothing is relevant, return {"matches": []}.
- Never invent products or ids that aren't in the catalog.`;

interface RawMatch {
  id?: string;
  score?: number;
  keywords?: unknown;
}

export interface AiSearchResult {
  matches: MatchesMap;
  mode: AiMode;
  error?: string;
}

/**
 * Runs AI-powered relevance search via Groq (Llama 3.1). Falls back to a
 * local client-side keyword heuristic if no API key is configured or the
 * request fails for any reason, so the UI always stays functional.
 */
export async function aiSearch(query: string, products: Product[], reviews: ReviewsMap): Promise<AiSearchResult> {
  if (!isGroqConfigured) {
    return { matches: localHeuristicSearch(query, products, reviews), mode: "local" };
  }

  try {
    const candidates = selectCandidates(query, products, reviews);
    const catalog = buildCatalog(candidates, reviews);
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        // gpt-oss-20b spends a substantial, catalog-size-dependent chunk of
        // this on internal reasoning before the final JSON — 2000 was tuned
        // for the old non-reasoning llama model and isn't enough here.
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({ query, catalog }),
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Groq API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const content: string | undefined = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from Groq");

    const parsed = JSON.parse(content);
    const rawMatches: RawMatch[] = Array.isArray(parsed.matches) ? parsed.matches : [];

    const validIds = new Set(candidates.map((p) => p.id));
    const queryTokens = new Set(tokenize(query));
    const matches: MatchesMap = new Map();
    rawMatches.forEach((m) => {
      if (!m?.id || !validIds.has(m.id)) return;
      const keywords = Array.isArray(m.keywords) ? m.keywords : [];
      const cleanedKeywords = keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean);

      // The model isn't asked to tag each keyword, so classify post-hoc:
      // a keyword identical to a literal query word is an exact match
      // (highlighted yellow); anything else — a synonym or contextual
      // phrase the model matched — is highlighted light green.
      const directTerms = new Set<string>();
      const synonymTerms = new Set<string>();
      cleanedKeywords.forEach((k) => (queryTokens.has(k) ? directTerms : synonymTerms).add(k));

      // Always keep at least the raw query tokens so highlighting has something
      // to work with even if the model returned no keywords for this item.
      if (!directTerms.size && !synonymTerms.size) queryTokens.forEach((t) => directTerms.add(t));

      matches.set(m.id, { score: Number(m.score) || 0, directTerms, synonymTerms });
    });

    return { matches, mode: "groq" };
  } catch (err) {
    console.error("Groq AI search failed, falling back to local heuristic:", err);
    return {
      matches: localHeuristicSearch(query, products, reviews),
      mode: "local",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
