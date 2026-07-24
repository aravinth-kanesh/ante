import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardTitle, Label, Select, SpeakerIcon } from "../components/ui";
import { getVoiceURI, setVoiceURI } from "../settings";
import { listEnglishVoices, onVoicesReady, speak } from "../speech";

const SAMPLE =
  "Hello, thanks for coming in today. Could you start by telling me a little about yourself?";

export default function Settings() {
  const supported = "speechSynthesis" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    return onVoicesReady(() => {
      const list = listEnglishVoices();
      setVoices(list);
      const saved = getVoiceURI();
      const fallback = list.find((v) => v.lang === "en-GB")?.voiceURI ?? list[0]?.voiceURI ?? "";
      setSelected(saved && list.some((v) => v.voiceURI === saved) ? saved : fallback);
    });
  }, []);

  function choose(uri: string) {
    setSelected(uri);
    setVoiceURI(uri || null);
    if (uri) speak(SAMPLE, { voiceURI: uri });
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
              <Button
                variant="secondary"
                onClick={() => selected && speak(SAMPLE, { voiceURI: selected })}
              >
                <SpeakerIcon className="h-4 w-4" /> Test voice
              </Button>
              <p className="text-xs leading-relaxed text-slate-500">
                Voices are provided by your device and browser, and their names usually indicate
                the speaker (male or female). For the most natural voices, Chrome or Edge on macOS
                or Windows offer higher-quality options. Your choice is saved on this device.
              </p>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
