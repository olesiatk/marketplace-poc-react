import { Component, computed, input, output } from "@angular/core";
import { IconComponent, type IconName } from "../icon/icon";
import { wordFormMatches } from "../../lib/search";
import { formatPrice } from "../../lib/format";
import type { MatchInfo, Product, Review } from "../../models/product.model";

const KNOWN_ICONS = new Set<IconName>(["sofa", "table", "chair", "storage", "bed", "decor"]);

@Component({
  selector: "app-product-card",
  imports: [IconComponent],
  templateUrl: "./product-card.html",
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly reviewList = input<Review[]>([]);
  readonly matchInfo = input<MatchInfo | null>(null);

  readonly select = output<string>();

  protected readonly wordFormMatches = wordFormMatches;
  protected readonly formatPrice = formatPrice;

  protected readonly iconName = computed<IconName>(() => {
    const icon = this.product().icon;
    return KNOWN_ICONS.has(icon as IconName) ? (icon as IconName) : "decor";
  });

  protected readonly avgRating = computed(() => {
    const list = this.reviewList();
    if (!list.length) return "—";
    return (list.reduce((sum, r) => sum + r.rating, 0) / list.length).toFixed(1);
  });

  protected matchCount(info: MatchInfo): number {
    return info.directTerms.size + info.synonymTerms.size;
  }

  protected onSelect(): void {
    this.select.emit(this.product().id);
  }
}
