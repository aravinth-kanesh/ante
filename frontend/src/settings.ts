// Device-local preferences. Available speech voices differ per device, so the
// chosen interviewer voice is stored in localStorage rather than on the account.

const VOICE_KEY = "interviewCoach.voiceURI";

export function getVoiceURI(): string | null {
  try {
    return localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

export function setVoiceURI(uri: string | null): void {
  try {
    if (uri) localStorage.setItem(VOICE_KEY, uri);
    else localStorage.removeItem(VOICE_KEY);
  } catch {
    // storage unavailable (e.g. private mode); ignore
  }
}
