import { useEffect, useRef } from "react";
import { Icon, type IconName } from "../Icon/Icon";
import { highlightHtml } from "../../lib/search";
import { formatPrice } from "../../lib/format";
import { listenToHost, sendModal, sendScrollIntoView } from "../../lib/post-message";
import type { MatchInfo, Product, ReviewsMap } from "../../models/product.model";

const KNOWN_ICONS = new Set<IconName>(["sofa", "table", "chair", "storage", "bed", "decor"]);

// Enough viewport for the modal to render comfortably when a host has
// sized the <iframe> to fit shorter content behind it.
const MODAL_MIN_HEIGHT = 640;

export interface ProductModalProps {
  product: Product;
  reviews: ReviewsMap;
  matchInfo?: MatchInfo | null;
  onClose: () => void;
}

export function ProductModal({ product, reviews, matchInfo = null, onClose }: ProductModalProps) {
  const iconName: IconName = KNOWN_ICONS.has(product.icon as IconName) ? (product.icon as IconName) : "decor";
  const reviewList = reviews[product.id] || [];
  const hasMatchedTerms = !!matchInfo && (matchInfo.directTerms.size > 0 || matchInfo.synonymTerms.size > 0);

  const modalBoxRef = useRef<HTMLDivElement>(null);
  // Kept up to date every render so effects that subscribe once on mount
  // still call the latest onClose, without needing to resubscribe.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    sendModal(true, MODAL_MIN_HEIGHT);
    // If embedded, a click/Escape on the host's own dimmed page (outside
    // this iframe) is forwarded here so it closes the modal the same way
    // a click on our own overlay or an in-frame Escape press would.
    const stopHostListener = listenToHost({ onDismiss: () => onCloseRef.current() });

    // Ask the host to scroll this modal into view — if the host has sized
    // the <iframe> to fit shorter page content, the modal box (position:
    // fixed, so anchored to the iframe's own viewport) could otherwise
    // open mostly or fully off the host's visible screen.
    const modalBox = modalBoxRef.current;
    if (modalBox) {
      const rect = modalBox.getBoundingClientRect();
      sendScrollIntoView(rect.top + window.scrollY, rect.height);
    }

    return () => {
      document.body.style.overflow = "";
      sendModal(false);
      stopHostListener();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function onOverlayClick(event: React.MouseEvent): void {
    if (event.target === event.currentTarget) onClose();
  }

  function highlight(text: string): string {
    return highlightHtml(text, matchInfo?.directTerms ?? null, matchInfo?.synonymTerms ?? null);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50" onClick={onOverlayClick}>
      <div ref={modalBoxRef} className="bg-white max-w-2xl w-full max-h-[88vh] overflow-y-auto relative px-8 pb-8 pt-12" data-tour="product-modal">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 bg-surface flex items-center justify-center text-ink hover:bg-neutral-200"
        >
          <Icon name="close" size={20} />
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-7">
          <div className="bg-surface h-40 flex items-center justify-center text-brand-dark">
            <Icon name={iconName} size={96} />
          </div>
          <div>
            <p className="eyebrow mb-1.5" dangerouslySetInnerHTML={{ __html: highlight(product.category) }} />
            <h2 className="text-xl font-extrabold uppercase leading-snug mb-2" dangerouslySetInnerHTML={{ __html: highlight(product.name) }} />
            <p className="text-xl font-extrabold text-gradient-brand mb-3.5">{formatPrice(product.price)}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px] mb-3.5">
              <dt className="font-bold">Material</dt>
              <dd dangerouslySetInnerHTML={{ __html: highlight(product.material) }} />
              <dt className="font-bold">Room</dt>
              <dd dangerouslySetInnerHTML={{ __html: highlight(product.room) }} />
              <dt className="font-bold">Style</dt>
              <dd dangerouslySetInnerHTML={{ __html: highlight(product.style) }} />
              <dt className="font-bold">Dimensions</dt>
              <dd dangerouslySetInnerHTML={{ __html: highlight(product.dimensions) }} />
            </dl>
            <p className="text-sm text-body leading-relaxed" dangerouslySetInnerHTML={{ __html: highlight(product.description) }} />
            {hasMatchedTerms && (
              <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#6b5500] bg-[#fff6d9] border border-highlight-line px-2.5 py-1.5 w-fit">
                <Icon name="search" size={14} />
                <span><mark className="hl">Exact</mark> matches are highlighted in yellow, <mark className="hl-synonym">similar</mark> terms in green</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-7 pt-6 border-t border-line">
          <h3 className="text-sm font-extrabold uppercase mb-3.5">
            Customer reviews <span className="text-gradient-brand">({reviewList.length})</span>
          </h3>
          <div className="flex flex-col gap-3.5">
            {reviewList.map((review, index) => (
              <div key={index} className="bg-surface px-4 py-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-[13px]">{review.author}</span>
                  <span className="flex gap-0.5 text-brand-dark">
                    {Array.from({ length: review.rating }).map((_, starIndex) => (
                      <Icon key={starIndex} name="star" size={12} />
                    ))}
                  </span>
                </div>
                <p className="text-[13px] text-body leading-relaxed" dangerouslySetInnerHTML={{ __html: highlight(review.text) }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
