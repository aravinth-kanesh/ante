// Device-local preferences. Which voices exist depends on the device and on
// whether the server's voice model is installed, so the choice is stored in
// localStorage rather than on the account.
//
// A voice id is "server:<id>" for a server voice or "browser:<voiceURI>" for one
// of the operating system's voices. Values saved before this scheme are bare
// browser voice URIs and are still understood.

const VOICE_KEY = "interviewCoach.voiceURI";

export function getVoiceId(): string {
  try {
    return localStorage.getItem(VOICE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setVoiceId(id: string): void {
  try {
    if (id) localStorage.setItem(VOICE_KEY, id);
    else localStorage.removeItem(VOICE_KEY);
  } catch {
    // storage unavailable (e.g. private mode); ignore
  }
}
