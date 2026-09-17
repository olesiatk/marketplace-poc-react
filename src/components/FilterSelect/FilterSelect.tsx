import { useEffect, useMemo, useState } from "react";
import { Icon } from "../Icon/Icon";

const PAGE_SIZE = 10;

export interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onValueChange: (value: string) => void;
}

/**
 * A searchable, incrementally-loaded dropdown — a styled replacement for a
 * plain `<select>`. Typing filters the option list; scrolling near the
 * bottom of the open list reveals the next 10 matches. Kept as a
 * text-input + listbox combo (not a native select) specifically because
 * native selects can't do either of those.
 */
export function FilterSelect({ id, label, value, options, placeholder, onValueChange }: FilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // A fresh options list (new catalog data) shouldn't keep a stale filter/page.
  useEffect(() => {
    setQuery("");
    setVisibleCount(PAGE_SIZE);
  }, [options]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((opt) => opt.toLowerCase().includes(q)) : options;
  }, [query, options]);

  const visibleOptions = filteredOptions.slice(0, visibleCount);
  const hasMore = visibleCount < filteredOptions.length;

  function onFocus(): void {
    setIsOpen(true);
    setQuery("");
    setVisibleCount(PAGE_SIZE);
  }

  function onBlur(): void {
    setIsOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === "Escape") setIsOpen(false);
  }

  function onInput(event: React.ChangeEvent<HTMLInputElement>): void {
    setQuery(event.target.value);
    setVisibleCount(PAGE_SIZE);
  }

  function onScroll(event: React.UIEvent<HTMLUListElement>): void {
    if (!hasMore) return;
    const el = event.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setVisibleCount((n) => n + PAGE_SIZE);
    }
  }

  function select(option: string): void {
    setIsOpen(false);
    setQuery("");
    onValueChange(option);
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-wide mb-2">{label}</label>

      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={`${id}-listbox`}
          autoComplete="off"
          value={isOpen ? query : value}
          placeholder={value || placeholder}
          onChange={onInput}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className="w-full pl-3 pr-8 py-2.5 border border-ink text-[13px] bg-white text-ink placeholder:text-ink outline-none focus:border-brand-dark"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex text-ink pointer-events-none">
          <Icon name="chevron-down" size={14} />
        </span>
      </div>

      {isOpen && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          onScroll={onScroll}
          className="absolute top-full left-0 right-0 mt-1 bg-white shadow-xl z-20 max-h-56 overflow-y-auto"
        >
          <li role="option" aria-selected={!value}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select("")}
              className={`w-full text-left px-3 py-2 text-[13px] hover:bg-surface transition-colors ${!value ? "font-bold" : ""}`}
            >
              {placeholder}
            </button>
          </li>
          {visibleOptions.map((opt) => (
            <li key={opt} role="option" aria-selected={opt === value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(opt)}
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-surface transition-colors ${opt === value ? "font-bold" : ""}`}
              >
                {opt}
              </button>
            </li>
          ))}
          {visibleOptions.length === 0 && <li className="px-3 py-2 text-[13px] text-body">No matches</li>}
        </ul>
      )}
    </div>
  );
}
