// A small typed wrapper around the browser Web Speech API.
//
// The DOM lib ships types for speechSynthesis but not for SpeechRecognition
// (which most browsers still expose only as webkitSpeechRecognition), so the
// recognition side is declared here. Everything is feature-detected: callers
// fall back to typing where the API is missing (best support is Chrome/Edge).

const EN_GB = "en-GB";

// --- Recognition types (not in the standard DOM lib) ---------------------

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

export interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((event: Event) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function recognitionCtor(): SpeechRecognitionConstructor | undefined {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

// --- Public API ----------------------------------------------------------

/** Both speaking and listening are available in this browser. */
export function speechSupported(): boolean {
  return "speechSynthesis" in window && recognitionCtor() !== undefined;
}

/** Pick a British English voice if the browser offers one. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === EN_GB) ?? voices.find((v) => v.lang.startsWith("en-GB")) ?? null;
}

interface SpeakOptions {
  onEnd?: () => void;
}

/**
 * Speak `text` aloud, cancelling anything currently being spoken. Prefers an
 * explicit en-GB voice when the browser has loaded its voice list; otherwise
 * the utterance's `lang` still steers the browser towards a British voice.
 */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!("speechSynthesis" in window) || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = EN_GB;
  utterance.rate = 1;
  if (opts.onEnd) utterance.onend = opts.onEnd;

  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

/** Stop any in-progress speech. */
export function cancelSpeech(): void {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/**
 * Create a recognition instance configured for a single British English
 * answer, or null if the browser has no Speech Recognition support.
 */
export function createRecognition(): SpeechRecognition | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = EN_GB;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

/**
 * Join a recognition event's results into a single transcript string. Both
 * final and interim results are included so the answer box updates live.
 */
export function transcriptFrom(event: SpeechRecognitionEvent): string {
  let transcript = "";
  for (let i = 0; i < event.results.length; i += 1) {
    transcript += event.results[i][0].transcript;
  }
  return transcript.trim();
}
