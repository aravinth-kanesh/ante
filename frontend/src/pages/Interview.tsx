import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  analyseNonverbal,
  answerInterview,
  finishInterview,
  startInterview,
  transcribeAudio,
  type DeliveryMetrics,
  type InterviewType,
  type NonverbalMetrics,
} from "../api";
import { recordingSupported, startCapture, type Capture } from "../capture";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Label,
  MicIcon,
  Select,
  SpeakerIcon,
  TextArea,
  Toggle,
  VideoIcon,
} from "../components/ui";
import { deliverySummary, nonverbalSummary } from "../format";
import { cancelSpeech, speak } from "../speech";

interface Exchange {
  question: string;
  answer: string;
}

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const INTERVIEW_TYPE_HINTS: Record<InterviewType, string> = {
  general: "A realistic blend: an opener, then behavioural, competency and role-specific questions.",
  behavioural: "Questions about you, your motivation and your fit, like why this role and company.",
  competency: "Structured 'tell me about a time when you...' questions that probe specific competencies.",
  technical: "Spoken role knowledge and problem-solving, discussed out loud. No coding exercises.",
  strengths: "What you enjoy, what you are good at, and how your strengths fit the role.",
};

export default function Interview() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [metrics, setMetrics] = useState<DeliveryMetrics | null>(null);
  const [nonverbal, setNonverbal] = useState<NonverbalMetrics | null>(null);
  const [history, setHistory] = useState<Exchange[]>([]);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supported = recordingSupported();
  const [interviewType, setInterviewType] = useState<InterviewType>("general");
  const [voiceMode, setVoiceMode] = useState(supported);
  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const captureRef = useRef<Capture | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Speak each new interviewer question while voice mode is on.
  useEffect(() => {
    if (voiceMode && question) speak(question);
  }, [question, voiceMode]);

  // Stop any speech or capture if the user leaves the page.
  useEffect(() => {
    return () => {
      cancelSpeech();
      captureRef.current?.cancel();
    };
  }, []);

  function stopCapture() {
    captureRef.current?.cancel();
    captureRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRecording(false);
    cancelSpeech();
  }

  async function startAnswer() {
    if (starting || recording) return; // guard against a double click during load
    setStarting(true);
    setError("");
    cancelSpeech(); // do not record the interviewer's own voice
    try {
      const capture = await startCapture({ video: cameraOn });
      captureRef.current = capture;
      if (cameraOn && videoRef.current) {
        videoRef.current.srcObject = capture.stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setRecording(true);
    } catch (err) {
      setError(`Could not start the camera or microphone: ${message(err)}`);
      setCameraOn(false);
    } finally {
      setStarting(false);
    }
  }

  async function stopAnswer() {
    const capture = captureRef.current;
    if (!capture) return;
    captureRef.current = null;
    setRecording(false);
    setAnalysing(true);
    setError("");
    try {
      const { audioBlob, samples } = await capture.stop();
      if (videoRef.current) videoRef.current.srcObject = null;
      const res = await transcribeAudio(audioBlob);
      setAnswer(res.transcript);
      setMetrics(res.metrics);
      if (samples.length > 0) setNonverbal(await analyseNonverbal(samples));
    } catch (err) {
      setError(`Could not analyse your answer: ${message(err)}`);
    } finally {
      setAnalysing(false);
    }
  }

  async function begin() {
    setLoading(true);
    setError("");
    setFeedback("");
    setHistory([]);
    setAnswer("");
    setMetrics(null);
    setNonverbal(null);
    try {
      const res = await startInterview(voiceMode ? "voice" : "text", interviewType);
      setSessionId(res.session_id);
      setQuestion(res.question);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (sessionId === null || question === null) return;
    stopCapture();
    setLoading(true);
    setError("");
    try {
      const res = await answerInterview(sessionId, answer, metrics, nonverbal);
      setHistory((h) => [...h, { question, answer }]);
      setAnswer("");
      setMetrics(null);
      setNonverbal(null);
      setQuestion(res.done ? null : res.question);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  async function end() {
    if (sessionId === null) return;
    stopCapture();
    setLoading(true);
    setError("");
    try {
      const res = await finishInterview(sessionId);
      setFeedback(res.feedback);
      setQuestion(null);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || analysing || recording || starting;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Mock interview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Adaptive questions grounded in your CV and the role, with feedback on your answers and
          delivery.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          {error.toLowerCase().includes("cv") && (
            <>
              {" "}
              <Link to="/cvs" className="font-medium underline">
                Add your CV
              </Link>
              .
            </>
          )}
        </div>
      )}

      {/* Setup / start */}
      {sessionId === null && (
        <Card>
          <CardBody className="space-y-4">
            <CardTitle>Set up your interview</CardTitle>
            <div>
              <Label>Interview type</Label>
              <Select
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value as InterviewType)}
              >
                <option value="general">General (a realistic mix)</option>
                <option value="behavioural">Behavioural (about you and your fit)</option>
                <option value="competency">Competency-based (tell me about a time when...)</option>
                <option value="technical">Technical (spoken, no coding)</option>
                <option value="strengths">Strengths-based</option>
              </Select>
              <p className="mt-1.5 text-xs text-slate-500">
                {INTERVIEW_TYPE_HINTS[interviewType]}
              </p>
            </div>
            {supported ? (
              <div className="space-y-3">
                <Toggle
                  checked={voiceMode}
                  onChange={(v) => {
                    if (!v) {
                      stopCapture();
                      setCameraOn(false);
                    }
                    setVoiceMode(v);
                  }}
                  label="Voice mode - questions are read aloud and you answer by speaking"
                />
                {voiceMode && (
                  <Toggle
                    checked={cameraOn}
                    onChange={setCameraOn}
                    label="Camera - adds eye contact, composure and posture feedback (nothing is recorded)"
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                This browser does not support audio recording, so the interview is typed. Voice
                mode works best in Chrome or Edge.
              </p>
            )}
            <Button onClick={begin} loading={loading}>
              Start interview
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Answered so far */}
      {history.length > 0 && !feedback && (
        <div className="space-y-3">
          {history.map((ex, i) => (
            <Card key={i} className="bg-slate-50/60">
              <CardBody className="py-4">
                <p className="text-sm font-medium text-slate-800">{ex.question}</p>
                <p className="mt-1 text-sm text-slate-500">{ex.answer}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Active question */}
      {sessionId !== null && !feedback && (
        <Card>
          <CardBody className="space-y-4">
            {question !== null ? (
              <>
                <div className="flex items-center justify-between">
                  <Badge color="brand">Question {history.length + 1}</Badge>
                  {voiceMode && (
                    <Button variant="ghost" size="sm" onClick={() => speak(question)}>
                      <SpeakerIcon className="h-4 w-4" /> Replay
                    </Button>
                  )}
                </div>
                <p className="text-lg font-medium text-slate-900">{question}</p>

                {cameraOn && (
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="w-56 rounded-xl border border-slate-200 shadow-sm"
                    style={{ display: recording ? "block" : "none", transform: "scaleX(-1)" }}
                  />
                )}

                <TextArea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={5}
                  placeholder={voiceMode ? "Speak your answer, or type it here..." : "Your answer..."}
                />

                {(metrics || nonverbal) && (
                  <div className="flex flex-wrap gap-2">
                    {metrics && (
                      <Badge color="brand">
                        <MicIcon className="h-3.5 w-3.5" /> {deliverySummary(metrics)}
                      </Badge>
                    )}
                    {nonverbal && (
                      <Badge color="slate">
                        <VideoIcon className="h-3.5 w-3.5" /> {nonverbalSummary(nonverbal)}
                      </Badge>
                    )}
                  </div>
                )}

                {recording && (
                  <p className="text-sm text-slate-500">
                    <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500 align-middle" />
                    Recording... press Stop when you have finished your answer.
                  </p>
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                  {voiceMode && (
                    <Button
                      variant={recording ? "danger" : "secondary"}
                      onClick={recording ? stopAnswer : startAnswer}
                      loading={analysing || starting}
                      disabled={loading}
                    >
                      {recording ? (
                        "Stop recording"
                      ) : analysing ? (
                        "Analysing..."
                      ) : (
                        <>
                          <MicIcon className="h-4 w-4" /> Speak answer
                        </>
                      )}
                    </Button>
                  )}
                  <Button onClick={submit} loading={loading} disabled={busy || !answer.trim()}>
                    Submit answer
                  </Button>
                  <Button variant="ghost" onClick={end} disabled={busy}>
                    Finish &amp; get feedback
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">You have answered all the questions.</p>
                <Button onClick={end} loading={loading}>
                  Get feedback
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Feedback */}
      {feedback && (
        <Card>
          <CardBody className="space-y-4">
            <CardTitle>Feedback</CardTitle>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{feedback}</p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={begin} loading={loading}>
                Start another interview
              </Button>
              {sessionId !== null && (
                <Link
                  to={`/results/${sessionId}`}
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  View full results
                </Link>
              )}
              <Link to="/history" className="text-sm font-medium text-brand-700 hover:underline">
                Interview history
              </Link>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
