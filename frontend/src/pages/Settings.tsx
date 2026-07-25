import { useEffect, useState } from "react";
import { listServerVoices, type ServerVoice } from "../api";
import { WhyAnteFull } from "../components/WhyAnte";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Label,
  Select,
  SpeakerIcon,
  SpeakingIndicator,
} from "../components/ui";
import { getVoiceId, setVoiceId } from "../settings";
import { listEnglishVoices, onVoicesReady } from "../speech";
import { BROWSER_PREFIX, SERVER_PREFIX, cancelVoice, speakText } from "../voice";

const SAMPLE =
  "Hello, thanks for coming in today. Could you start by telling me a little about yourself?";

export default function Settings() {
  const [serverVoices, setServerVoices] = useState<ServerVoice[]>([]);
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selected, setSelected] = useState("");
  const [speaking, setSpeaking] = useState(false);

  // Stop any preview if the user navigates away.
  useEffect(() => cancelVoice, []);

  useEffect(() => {
    listServerVoices()
      .then((res) => {
        setServerVoices(res.voices);
        setServerAvailable(res.available);
      })
      .catch(() => setServerAvailable(false));
  }, []);

  useEffect(() => onVoicesReady(() => setBrowserVoices(listEnglishVoices())), []);

  // Pick up the saved choice once the options are known, else default to the
  // best available: a server voice if there is one.
  useEffect(() => {
    if (serverAvailable === null) return;
    const saved = getVoiceId();
    if (saved) {
      setSelected(saved);
      return;
    }
    if (serverVoices.length > 0) setSelected(SERVER_PREFIX + serverVoices[0].id);
    else if (browserVoices.length > 0) setSelected(BROWSER_PREFIX + browserVoices[0].voiceURI);
  }, [serverAvailable, serverVoices, browserVoices]);

  function preview(id: string) {
    if (!id) return;
    setSpeaking(true);
    speakText(SAMPLE, { voiceId: id, onEnd: () => setSpeaking(false) });
  }

  function choose(id: string) {
    setSelected(id);
    setVoiceId(id);
    preview(id);
  }

  function stopPreview() {
    cancelVoice();
    setSpeaking(false);
  }

  const hasAnyVoice = serverVoices.length > 0 || browserVoices.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Personalise your interview practice.</p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Interviewer voice</CardTitle>
            {serverAvailable === false && <Badge color="slate">Using your device voices</Badge>}
          </div>
          <p className="text-sm text-slate-500">
            Choose the voice that reads out the interviewer's questions.
          </p>

          {!hasAnyVoice ? (
            <p className="text-sm text-slate-500">No voices were found on this device.</p>
          ) : (
            <>
              <div>
                <Label>Voice</Label>
                <Select value={selected} onChange={(e) => choose(e.target.value)}>
                  {serverVoices.length > 0 && (
                    <optgroup label="Natural voices (recommended)">
                      {serverVoices.map((v) => (
                        <option key={v.id} value={SERVER_PREFIX + v.id}>
                          {v.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {browserVoices.length > 0 && (
                    <optgroup label="Your device's voices">
                      {browserVoices.map((v) => (
                        <option key={v.voiceURI} value={BROWSER_PREFIX + v.voiceURI}>
                          {v.name} - {v.lang}
                        </option>
                      ))}
                    </optgroup>
                  )}
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
                {serverAvailable
                  ? "The natural voices are generated on the server by a local model, so they sound close to a real person and nothing you type is sent to a third party. Your device's own voices are listed as a fallback."
                  : "Your device's voices are being used. For much more natural speech, install the voice model on the server (see the README), which runs locally and free."}{" "}
                Your choice is saved on this device.
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
