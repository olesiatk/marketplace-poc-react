import { driver, type Driver } from "driver.js";
import { sendScrollIntoView } from "./post-message";

/**
 * A query proven to return real results: "armchair" matches directly, and
 * "cosy" matches via the furniture concept groups (src/lib/synonyms.ts)
 * pushed to Algolia as index synonyms by scripts/index-algolia.ts, even
 * though the catalog only ever spells it "cozy"/"comfortable".
 */
export const DEMO_QUERY = "cosy armchair";

export interface TourActions {
  /** Fills the search box with {@link DEMO_QUERY} and runs it for real. */
  runDemoSearch: () => Promise<void>;
  /** Opens the top-ranked result from the just-run demo search. */
  openFirstResult: () => void;
  /** Clears the demo query and closes the modal, however the tour ends. */
  reset: () => void;
}

/**
 * Waits until `selector` matches an element that has actually been laid
 * out (non-zero size), polling via requestAnimationFrame so the check
 * runs after layout/paint rather than racing it. Needed because the demo
 * steps target elements (a product card, the modal) that only exist once
 * a previous step's action has rendered them — driver.js's own
 * `waitForElement` uses a MutationObserver, which can fire the instant an
 * element is inserted but before the browser has laid it out, leaving its
 * bounding rect at zero and the popover pinned to the top-left corner.
 */
function waitForLaidOutElement(selector: string, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    function check() {
      const el = document.querySelector(selector);
      const rect = el?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        resolve();
        return;
      }
      if (performance.now() - start > timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    }
    requestAnimationFrame(check);
  });
}

/**
 * Builds the guided tour: the first three steps introduce the static UI,
 * the last three actually run a search and open a card live, so the
 * highlighted-match colors are demonstrated rather than just described.
 */
export function createTour(actions: TourActions): Driver {
  return driver({
    showProgress: true,
    animate: true,
    overlayColor: "#000",
    overlayOpacity: 0.7,
    popoverClass: "leobit-driver-theme",
    // Not skipMissingElement: with it on, driver.js pre-checks whether the
    // *next* step's target already exists to decide whether to label the
    // button "Next" or "Done" — but step 6's target (the modal) is only
    // created by step 5's own action, so it would always look "missing"
    // one step early and mislabel the button "Done" on step 5.
    onDestroyStarted: (_element, _step, opts) => {
      actions.reset();
      opts.driver.destroy();
    },
    // Reported so a host embedding this app in an <iframe> can scroll its
    // own page to bring the highlighted region into view — driver.js can
    // only scroll within this document, which the host may have sized to
    // fit content exactly, leaving no scrollable overflow of its own.
    onHighlightStarted: (element) => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      sendScrollIntoView(rect.top + window.scrollY, rect.height);
    },
    steps: [
      {
        element: '[data-tour="search-form"]',
        popover: {
          title: "Search with Algolia",
          description:
            "Type what you're looking for in plain language — material, room, mood. Suggestions appear as you type, and Algolia matches products by their attributes and customer reviews — typo-tolerant and synonym-aware, not just exact words.",
        },
      },
      {
        element: '[data-tour="mic-button"]',
        popover: {
          title: "Or just speak",
          description: "No typing needed — click the mic and describe your ideal piece out loud.",
        },
      },
      {
        element: '[data-tour="filters-bar"]',
        popover: {
          title: "Fine-tune with filters",
          description:
            "Narrow the catalog by category, room, material, or price. Filters combine with your search.",
        },
      },
      {
        element: '[data-tour="search-form"]',
        popover: {
          title: "Let's try it",
          description: `Click "Next" and we'll search for "${DEMO_QUERY}" for you, live.`,
          onNextClick: async (_element, _step, opts) => {
            await actions.runDemoSearch();
            await waitForLaidOutElement('[data-tour="first-product-card"]');
            opts.driver.moveNext();
          },
        },
      },
      {
        element: '[data-tour="first-product-card"]',
        waitForElement: 2000,
        popover: {
          title: "Ranked by relevance",
          description:
            'Results are ranked by relevance, with matched words highlighted right in the card. Click "Next" to open this one and see the full match.',
          onNextClick: async (_element, _step, opts) => {
            actions.openFirstResult();
            await waitForLaidOutElement('[data-tour="product-modal"]');
            opts.driver.moveNext();
          },
        },
      },
      {
        element: '[data-tour="product-modal"]',
        waitForElement: 2000,
        popover: {
          title: "Highlighted matches",
          description: "Matched query words are highlighted right on the product's own attributes and reviews.",
        },
      },
    ],
  });
}
