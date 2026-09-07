import { Component, input, output } from "@angular/core";
import { FilterSelectComponent } from "../filter-select/filter-select";
import { formatPrice } from "../../lib/format";
import type { FilterOptions, Filters } from "../../models/product.model";

export interface FilterChangeEvent {
  field: keyof Filters;
  value: string | number;
}

@Component({
  selector: "app-filters-bar",
  imports: [FilterSelectComponent],
  templateUrl: "./filters-bar.html",
})
export class FiltersBarComponent {
  readonly options = input.required<FilterOptions>();
  readonly filters = input.required<Filters>();
  readonly priceLimit = input.required<number>();

  readonly filterChange = output<FilterChangeEvent>();
  readonly reset = output<void>();

  protected readonly formatPrice = formatPrice;

  protected onSelectChange(field: keyof Filters, value: string): void {
    this.filterChange.emit({ field, value });
  }

  protected onPriceChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.filterChange.emit({ field: "maxPrice", value });
  }
}
