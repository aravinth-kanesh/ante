import { useEffect, useState } from "react";
import { WhyAnteFull } from "../components/WhyAnte";
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Label,
  Select,
  SpeakerIcon,
  SpeakingIndicator,
} from "../components/ui";
import { getVoiceURI, setVoiceURI } from "../settings";
import { cancelSpeech, listEnglishVoices, onVoicesReady, speak } from "../speech";

const SAMPLE =
  "Hello, thanks for coming in today. Could you start by telling me a little about yourself?";

export default function Settings() {
  const supported = "speechSynthesis" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selected, setSelected] = useState("");
  const [speaking, setSpeaking] = useState(false);

  // Stop any preview if the user navigates away.
  useEffect(() => cancelSpeech, []);

  useEffect(() => {
    return onVoicesReady(() => {
      const list = listEnglishVoices();
      setVoices(list);
      const saved = getVoiceURI();
      const fallback = list.find((v) => v.lang === "en-GB")?.voiceURI ?? list[0]?.voiceURI ?? "";
      setSelected(saved && list.some((v) => v.voiceURI === saved) ? saved : fallback);
    });
  }, []);

  function preview(uri: string) {
    if (!uri) return;
    setSpeaking(true);
    speak(SAMPLE, { voiceURI: uri, onEnd: () => setSpeaking(false) });
  }

  function choose(uri: string) {
    setSelected(uri);
    setVoiceURI(uri || null);
    preview(uri);
  }

  function stopPreview() {
    cancelSpeech();
    setSpeaking(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Personalise your interview practice.</p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <CardTitle>Interviewer voice</CardTitle>
          <p className="text-sm text-slate-500">
            Choose the voice that reads out the interviewer's questions.
          </p>

          {!supported ? (
            <p className="text-sm text-slate-500">
              Your browser does not support speech synthesis. Chrome or Edge work best.
            </p>
          ) : voices.length === 0 ? (
            <p className="text-sm text-slate-500">No voices were found on this device.</p>
          ) : (
            <>
              <div>
                <Label>Voice</Label>
                <Select value={selected} onChange={(e) => choose(e.target.value)}>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} - {v.lang}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => (speaking ? stopPreview() : preview(selected))}
                >
                  {speaking ? (
                    <>
                      <SpeakingIndicator className="h-4 text-brand-600" /> Stop
                    </>
                  ) : (
                    <>
                      <SpeakerIcon className="h-4 w-4" /> Test voice
                    </>
                  )}
                </Button>
                {speaking && <span className="text-sm text-slate-500">Playing...</span>}
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Voices are provided by your device and browser, and their names usually indicate
                the speaker (male or female). For the most natural voices, Chrome or Edge on macOS
                or Windows offer higher-quality options. Your choice is saved on this device.
              </p>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <CardTitle>Why it is called Ante</CardTitle>
          <WhyAnteFull />
        </CardBody>
      </Card>
    </div>
  );
}
