// Text-to-speech for reading interview questions aloud, using the browser's
// speechSynthesis. Answer capture is handled separately in audio.ts (recorded
// and transcribed server-side), so no speech recognition lives here.

const EN_GB = "en-GB";

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
