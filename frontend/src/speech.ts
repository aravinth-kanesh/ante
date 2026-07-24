// Text-to-speech for reading interview questions aloud, using the browser's
// speechSynthesis. Answer capture is handled separately (recorded and transcribed
// server-side). The interviewer voice is user-selectable (see settings.ts).

import { getVoiceURI } from "./settings";

const EN_GB = "en-GB";
// Names that tend to mark a higher-quality (more natural) system voice.
const HIGH_QUALITY = /premium|enhanced|natural|neural/i;

/** English voices available on this device, best-quality and en-GB first. */
export function listEnglishVoices(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  const english = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("en"));
  return english.sort((a, b) => {
    const quality = Number(HIGH_QUALITY.test(b.name)) - Number(HIGH_QUALITY.test(a.name));
    if (quality) return quality;
    const gb = Number(b.lang === EN_GB) - Number(a.lang === EN_GB);
    if (gb) return gb;
    return a.name.localeCompare(b.name);
  });
}

/** Run `cb` when the voice list is ready (and immediately if already loaded). */
export function onVoicesReady(cb: () => void): () => void {
  if (!("speechSynthesis" in window)) return () => undefined;
  if (window.speechSynthesis.getVoices().length > 0) cb();
  const handler = () => cb();
  window.speechSynthesis.addEventListener("voiceschanged", handler);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", handler);
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const saved = getVoiceURI();
  if (saved) {
    const match = voices.find((v) => v.voiceURI === saved);
    if (match) return match;
  }
  const english = listEnglishVoices();
  return english.find((v) => v.lang === EN_GB) ?? english[0] ?? null;
}

interface SpeakOptions {
  voiceURI?: string; // override the saved voice (used by the Settings preview)
  onEnd?: () => void;
}

/** Speak `text` aloud, cancelling anything currently being spoken. */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!("speechSynthesis" in window) || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = EN_GB;
  utterance.rate = 1;
  if (opts.onEnd) {
    // fires on natural end, and on cancel or failure, so callers can reset state
    utterance.onend = opts.onEnd;
    utterance.onerror = opts.onEnd;
  }

  const voice = opts.voiceURI
    ? synth.getVoices().find((v) => v.voiceURI === opts.voiceURI) ?? pickVoice()
    : pickVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  synth.speak(utterance);
}

/** Stop any in-progress speech. */
export function cancelSpeech(): void {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
