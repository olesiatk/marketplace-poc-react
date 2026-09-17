import { FilterSelect } from "../FilterSelect/FilterSelect";
import { formatPrice } from "../../lib/format";
import type { FilterOptions, Filters } from "../../models/product.model";

export interface FilterChangeEvent {
  field: keyof Filters;
  value: string | number;
}

export interface FiltersBarProps {
  options: FilterOptions;
  filters: Filters;
  priceLimit: number;
  onFilterChange: (event: FilterChangeEvent) => void;
  onReset: () => void;
}

export function FiltersBar({ options, filters, priceLimit, onFilterChange, onReset }: FiltersBarProps) {
  function onSelectChange(field: keyof Filters, value: string): void {
    onFilterChange({ field, value });
  }

  function onPriceChange(event: React.ChangeEvent<HTMLInputElement>): void {
    onFilterChange({ field: "maxPrice", value: Number(event.target.value) });
  }

  return (
    <section className="mx-auto max-w-6xl px-8 pt-6 pb-2" data-tour="filters-bar">
      <p className="eyebrow mb-4">manual filters</p>
      <div className="bg-surface px-7 py-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 items-end">
        <FilterSelect
          id="f-category"
          label="Category"
          value={filters.category}
          options={options.categories}
          placeholder="All categories"
          onValueChange={(value) => onSelectChange("category", value)}
        />
        <FilterSelect
          id="f-room"
          label="Room"
          value={filters.room}
          options={options.rooms}
          placeholder="Any"
          onValueChange={(value) => onSelectChange("room", value)}
        />
        <FilterSelect
          id="f-material"
          label="Material"
          value={filters.material}
          options={options.materials}
          placeholder="Any"
          onValueChange={(value) => onSelectChange("material", value)}
        />
        <div>
          <label htmlFor="f-price" className="block text-[11px] font-bold uppercase tracking-wide mb-2">Max price, $</label>
          <input
            id="f-price"
            type="range"
            min={10}
            max={priceLimit}
            step={5}
            value={filters.maxPrice}
            onChange={onPriceChange}
            className="w-full"
          />
          <output className="block mt-1.5 text-xs font-bold text-gradient-brand">{formatPrice(filters.maxPrice)}</output>
        </div>
        <div>
          <button
            type="button"
            onClick={onReset}
            className="cta-label border-1 text-ink font-bold uppercase text-xs tracking-wide px-5 py-2.5 hover:bg-ink hover:text-white transition-colors"
          >
            Reset all
          </button>
        </div>
      </div>
    </section>
  );
}
