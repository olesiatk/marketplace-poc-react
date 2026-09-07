import { signal } from "@angular/core";

// The Web Speech API's SpeechRecognition type isn't in TS's default DOM lib
// in every target, so it's accessed dynamically off `window`, same as the
// original implementation.
const SpeechRecognitionImpl: any =
  typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

export interface VoiceInputCallbacks {
  onInterimResult?: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

/**
 * Wraps the Web Speech API. Calls onFinalResult(transcript) once a phrase
 * is finalized; onInterimResult(transcript) fires live while listening.
 */
export class VoiceInput {
  readonly isSupported = Boolean(SpeechRecognitionImpl);
  readonly isListening = signal(false);

  private recognition: any = null;

  constructor(private readonly callbacks: VoiceInputCallbacks) {
    if (!this.isSupported) return;

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => this.isListening.set(true);
    recognition.onend = () => this.isListening.set(false);
    recognition.onerror = (e: any) => {
      this.isListening.set(false);
      this.callbacks.onError?.(e.error);
    };
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      const isFinal = e.results[e.results.length - 1].isFinal;
      if (isFinal) this.callbacks.onFinalResult?.(transcript);
      else this.callbacks.onInterimResult?.(transcript);
    };

    this.recognition = recognition;
  }

  start(): void {
    if (!this.isSupported) {
      this.callbacks.onError?.("not-supported");
      return;
    }
    try {
      this.recognition?.start();
    } catch {
      // already started — ignore
    }
  }

  stop(): void {
    this.recognition?.stop();
  }

  destroy(): void {
    this.recognition?.abort();
  }
}
