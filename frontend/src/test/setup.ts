import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount the rendered tree between tests so they do not bleed into each other.
afterEach(() => cleanup());

// jsdom does not implement media playback; provide no-ops so players can be tested.
if (typeof HTMLMediaElement !== "undefined") {
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
}

// jsdom does not implement object URLs; stub them so recording review can be tested.
if (typeof URL !== "undefined") {
  URL.createObjectURL = () => "blob:mock";
  URL.revokeObjectURL = () => {};
}

// jsdom does not implement the Web Speech API; provide a no-op so the voice settings
// can be rendered in tests.
if (typeof window !== "undefined" && !window.speechSynthesis) {
  window.speechSynthesis = {
    getVoices: () => [],
    speak: () => {},
    cancel: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as SpeechSynthesis;
}

// jsdom does not implement matchMedia; provide a no-op so components can query it.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
