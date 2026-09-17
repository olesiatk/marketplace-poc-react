import { useEffect, useRef, useState } from "react";

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

export interface VoiceInput {
  isSupported: boolean;
  isListening: boolean;
  start: () => void;
  stop: () => void;
}

/**
 * Wraps the Web Speech API. Calls onFinalResult(transcript) once a phrase
 * is finalized; onInterimResult(transcript) fires live while listening.
 */
export function useVoiceInput(callbacks: VoiceInputCallbacks): VoiceInput {
  const isSupported = Boolean(SpeechRecognitionImpl);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Kept up to date every render so the recognition instance (created once)
  // always calls the latest closures, without needing to recreate it.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!isSupported) return;

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e: any) => {
      setIsListening(false);
      callbacksRef.current.onError?.(e.error);
    };
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      const isFinal = e.results[e.results.length - 1].isFinal;
      if (isFinal) callbacksRef.current.onFinalResult?.(transcript);
      else callbacksRef.current.onInterimResult?.(transcript);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [isSupported]);

  const start = () => {
    if (!isSupported) {
      callbacksRef.current.onError?.("not-supported");
      return;
    }
    try {
      recognitionRef.current?.start();
    } catch {
      // already started — ignore
    }
  };

  const stop = () => {
    recognitionRef.current?.stop();
  };

  return { isSupported, isListening, start, stop };
}
