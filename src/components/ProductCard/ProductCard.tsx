import { Icon, type IconName } from "../Icon/Icon";
import { wordFormMatches } from "../../lib/search";
import { formatPrice } from "../../lib/format";
import type { MatchInfo, Product, Review } from "../../models/product.model";

const KNOWN_ICONS = new Set<IconName>(["sofa", "table", "chair", "storage", "bed", "decor"]);

export interface ProductCardProps {
  product: Product;
  reviewList?: Review[];
  matchInfo?: MatchInfo | null;
  dataTour?: string;
  onSelect: (id: string) => void;
}

function matchCount(info: MatchInfo): number {
  return info.directTerms.size + info.synonymTerms.size;
}

export function ProductCard({ product, reviewList = [], matchInfo = null, dataTour, onSelect }: ProductCardProps) {
  const iconName: IconName = KNOWN_ICONS.has(product.icon as IconName) ? (product.icon as IconName) : "decor";
  const avgRating = reviewList.length
    ? (reviewList.reduce((sum, r) => sum + r.rating, 0) / reviewList.length).toFixed(1)
    : "—";

  return (
    <button
      type="button"
      onClick={() => onSelect(product.id)}
      data-tour={dataTour}
      className="bg-surface px-4 py-3.5 flex gap-3.5 text-left w-full cursor-pointer border border-transparent hover:border-transparent hover:[border-image:var(--gradient-brand)_1] hover:-translate-y-0.5 transition-all"
    >
      <Icon name={iconName} size={40} className="text-brand-dark shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col">
        {matchInfo && (
          <span className="self-start mb-1 text-[9px] font-bold uppercase tracking-wide bg-highlight text-ink px-1.5 py-0.5">
            AI match · {matchCount(matchInfo)} {wordFormMatches(matchCount(matchInfo))}
          </span>
        )}
        <p className="text-[10px] font-bold uppercase tracking-wide text-gradient-brand mb-0.5">{product.category}</p>
        <h3 className="text-[13px] font-extrabold uppercase leading-snug mb-1 line-clamp-2 min-h-9">{product.name}</h3>
        <p className="text-xs text-body leading-relaxed mb-2 line-clamp-2 min-h-9.75">{product.description}</p>
        <div className="flex items-center justify-between pt-2 border-t border-line mt-auto">
          <span className="font-extrabold text-sm">{formatPrice(product.price)}</span>
          <span className="flex items-center gap-1 text-xs font-bold text-body">
            <Icon name="star" size={12} className="text-brand-dark" />
            {avgRating} · {reviewList.length}
          </span>
        </div>
      </div>
    </button>
  );
}
