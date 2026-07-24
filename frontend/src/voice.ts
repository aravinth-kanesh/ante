// One way to speak the interviewer's lines.
//
// Preferred path is the server's local neural voice (Kokoro), which sounds far
// more human than the operating system's built-in voices. If the model is not
// installed, synthesis fails, or the user has chosen a browser voice, this falls
// back to speechSynthesis so the app always works.

import { synthesizeSpeech } from "./api";
import { getVoiceId } from "./settings";
import { cancelSpeech, speak as speakInBrowser } from "./speech";

export const SERVER_PREFIX = "server:";
export const BROWSER_PREFIX = "browser:";

let audio: HTMLAudioElement | null = null;
let generation = 0; // bumped on cancel so a slow synthesis cannot play late

export function cancelVoice(): void {
  generation += 1;
  if (audio) {
    audio.pause();
    audio.src = "";
    audio = null;
  }
  cancelSpeech();
}

interface SpeakOptions {
  voiceId?: string; // defaults to the saved preference
  onEnd?: () => void;
}

export async function speakText(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!text.trim()) return;
  cancelVoice();
  const mine = generation;
  const voiceId = opts.voiceId ?? getVoiceId();
  const onEnd = opts.onEnd ?? (() => undefined);

  if (voiceId.startsWith(SERVER_PREFIX)) {
    try {
      const blob = await synthesizeSpeech(text, voiceId.slice(SERVER_PREFIX.length));
      if (mine !== generation) return; // cancelled while we were synthesising
      const url = URL.createObjectURL(blob);
      const element = new Audio(url);
      audio = element;
      const finish = () => {
        URL.revokeObjectURL(url);
        if (audio === element) audio = null;
        onEnd();
      };
      element.onended = finish;
      element.onerror = finish;
      await element.play();
      return;
    } catch {
      if (mine !== generation) return;
      // fall through to the browser voice
    }
  }

  // A bare value is a legacy browser voice URI saved before voices were prefixed.
  const browserVoice = voiceId.startsWith(BROWSER_PREFIX)
    ? voiceId.slice(BROWSER_PREFIX.length)
    : voiceId.startsWith(SERVER_PREFIX)
      ? undefined
      : voiceId || undefined;
  speakInBrowser(text, { voiceURI: browserVoice, onEnd });
}
