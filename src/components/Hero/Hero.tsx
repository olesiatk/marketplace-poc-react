import { useMemo, useState } from "react";
import { Icon } from "../Icon/Icon";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import { getSuggestions, type SearchVocabulary, type Suggestion } from "../../lib/suggestions";
import type { AiMode } from "../../models/product.model";
import "./Hero.css";

export interface HeroProps {
  value: string;
  onValueChange: (value: string) => void;
  isSearching: boolean;
  statusMessage: string;
  aiMode: AiMode;
  vocabulary: SearchVocabulary;
  onSubmitQuery: (query: string) => void;
  onHowItWorks: () => void;
}

/** The part of the suggestion the user already typed, for display styling. */
function typedPart(suggestion: Suggestion): string {
  return suggestion.query.slice(0, suggestion.query.length - suggestion.completion.length);
}

export function Hero({ value, onValueChange, isSearching, statusMessage, aiMode, vocabulary, onSubmitQuery, onHowItWorks }: HeroProps) {
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [emptyQueryError, setEmptyQueryError] = useState(false);

  const voice = useVoiceInput({
    onInterimResult: (transcript) => {
      onValueChange(transcript);
      setEmptyQueryError(false);
    },
    onFinalResult: (transcript) => {
      onValueChange(transcript);
      setEmptyQueryError(false);
      onSubmitQuery(transcript);
    },
    onError: (err) => setVoiceError(err),
  });

  const suggestions = useMemo<Suggestion[]>(
    () => (showSuggestions ? getSuggestions(value, vocabulary) : []),
    [showSuggestions, value, vocabulary]
  );

  // Deliberately no specific model name here — Groq's catalog changes
  // over time (VITE_GROQ_MODEL can be swapped independently), so a
  // hardcoded name here would just go stale again.
  const modeLabel = aiMode === "groq" ? "AI: Groq" : aiMode === "local" ? "Local AI mode" : null;

  function onMicClick(): void {
    setVoiceError(null);
    if (!voice.isSupported) {
      setVoiceError("not-supported");
      return;
    }
    voice.isListening ? voice.stop() : voice.start();
  }

  function onInput(event: React.ChangeEvent<HTMLInputElement>): void {
    onValueChange(event.target.value);
    setEmptyQueryError(false);
    // Typing always implies interacting with the field — not just a
    // preceding "focus" DOM event, which won't refire if focus never
    // actually left the input (e.g. right after picking a suggestion).
    setShowSuggestions(true);
  }

  function onSubmit(event: React.FormEvent): void {
    event.preventDefault();
    setShowSuggestions(false);
    if (!value.trim()) {
      setEmptyQueryError(true);
      return;
    }
    setEmptyQueryError(false);
    onSubmitQuery(value);
  }

  function onFocus(): void {
    setEmptyQueryError(false);
    setShowSuggestions(true);
  }

  function onBlur(): void {
    setShowSuggestions(false);
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === "Escape") setShowSuggestions(false);
  }

  function selectSuggestion(suggestion: Suggestion): void {
    setShowSuggestions(false);
    setEmptyQueryError(false);
    onValueChange(suggestion.query);
    onSubmitQuery(suggestion.query);
  }

  return (
    <section className="mx-auto max-w-6xl px-8 pt-16 pb-10 text-center">
      <h1 className="text-3xl sm:text-5xl font-black uppercase leading-tight mb-5 inline-flex items-center gap-3 flex-wrap justify-center">
        <span>Marketplace filter <span className="text-gradient-brand">with AI</span></span>
        <button
          type="button"
          onClick={onHowItWorks}
          aria-label="How it works"
          title="How it works"
          className="how-it-works-trigger inline-flex items-center justify-center w-4 h-4 border border-brand-dark text-brand-dark text-sm font-normal leading-none normal-case hover:bg-brand-dark hover:text-white transition-colors align-middle"
        >
          ?
        </button>
      </h1>
      <p className="max-w-xl mx-auto text-body text-sm sm:text-[15px] leading-relaxed mb-8">
        Describe what you need, by text or by voice — and AI will match products from the catalog based on their
        attributes and customer reviews.
      </p>

      <form
        onSubmit={onSubmit}
        data-tour="search-form"
        className={`glass-panel relative z-30 max-w-2xl mx-auto flex items-center gap-2.5 pl-5 pr-2 py-2 ${emptyQueryError ? "glass-panel--error" : ""}`}
      >
        <Icon name="search" size={20} className="text-body shrink-0" />
        <input
          type="text"
          value={value}
          onChange={onInput}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          autoComplete="off"
          placeholder='e.g. "an outdoor table for the balcony"'
          aria-invalid={emptyQueryError || undefined}
          className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] placeholder:text-neutral-400"
        />
        <button
          type="button"
          onClick={onMicClick}
          title="Voice search"
          aria-label="Voice search"
          data-tour="mic-button"
          className={`shrink-0 w-10 h-10 flex items-center justify-center transition-colors ${voice.isListening ? "bg-[#e0442e] text-white animate-mic-pulse" : "bg-surface text-ink hover:bg-neutral-200"}`}
        >
          <Icon name="mic" size={18} />
        </button>
        <button
          type="submit"
          disabled={isSearching}
          className="cta-label shrink-0 bg-gradient-brand transition-color disabled:opacity-60 text-white hover:text-ink uppercase text-xs tracking-wide"
        >
          {isSearching ? "Searching…" : "AI Search"}
        </button>

        {suggestions.length > 0 && (
          <ul className="glass-panel glass-panel--opaque absolute top-full left-0 right-0 mt-1.5 text-left z-10 max-h-80 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <li key={suggestion.query}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(suggestion)}
                  className="w-full flex items-center gap-2.5 px-5 py-2.5 text-[14px] text-left hover:bg-surface transition-colors"
                >
                  <Icon name="search" size={14} className="text-body shrink-0" />
                  <span className="truncate">
                    {typedPart(suggestion)}
                    <strong className="text-ink font-bold">{suggestion.completion}</strong>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="max-w-2xl mx-auto mt-3.5 min-h-[18px] text-[13px] font-semibold flex items-center justify-center gap-3 flex-wrap">
        {emptyQueryError && <span className="text-[#b3441f]">Type something to search for — the field is empty.</span>}
        {statusMessage && <span className="text-gradient-brand">{statusMessage}</span>}
        {voiceError === "not-supported" && (
          <span className="text-[#b3441f]">
            Voice input isn't supported in this browser. Try Chrome, or type your query instead.
          </span>
        )}
        {voiceError && voiceError !== "not-supported" && (
          <span className="text-[#b3441f]">Voice input error: {voiceError}</span>
        )}
        {modeLabel && (
          <span className="text-[11px] font-bold uppercase tracking-wide bg-surface text-ink px-2.5 py-1">
            {modeLabel}
          </span>
        )}
      </div>
    </section>
  );
}
