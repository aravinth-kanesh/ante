import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  analyseNonverbal,
  answerInterview,
  finishInterview,
  getPreparation,
  getPrepQuestions,
  startInterview,
  transcribeAudio,
  type DeliveryMetrics,
  type FeedbackReport,
  type Focus,
  type InterviewType,
  type NonverbalMetrics,
} from "../api";
import { recordingSupported, startCapture, type Capture } from "../capture";
import FeedbackView from "../components/FeedbackView";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  MicIcon,
  Select,
  SpeakerIcon,
  SpeakingIndicator,
  TextArea,
  Toggle,
  VideoIcon,
} from "../components/ui";
import { deliverySummary, nonverbalSummary } from "../format";
import { cancelVoice, speakText } from "../voice";

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
  const [feedback, setFeedback] = useState<FeedbackReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supported = recordingSupported();
  const location = useLocation();
  const requestedFocus = (location.state as { focus?: Focus } | null)?.focus;
  const [interviewType, setInterviewType] = useState<InterviewType>("general");
  const [focus, setFocus] = useState<Focus>(requestedFocus ?? "balanced");
  const [hasGaps, setHasGaps] = useState(false);
  const [hasQuestions, setHasQuestions] = useState(false);
  const [voiceMode, setVoiceMode] = useState(supported);
  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const captureRef = useRef<Capture | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Which focus options have data to draw on (from the Prepare page).
  useEffect(() => {
    getPreparation()
      .then((r) => setHasGaps(r.competencies.some((c) => c.status === "gap" || c.status === "partial")))
      .catch(() => {});
    getPrepQuestions()
      .then((groups) => setHasQuestions(groups.length > 0))
      .catch(() => {});
  }, []);

  // If the chosen focus has no data (for example arriving from a link before
  // generating it), fall back to a balanced interview.
  useEffect(() => {
    if (focus === "gaps" && !hasGaps) setFocus("balanced");
    if (focus === "questions" && !hasQuestions) setFocus("balanced");
  }, [focus, hasGaps, hasQuestions]);

  // Speak each new interviewer question while voice mode is on.
  useEffect(() => {
    if (voiceMode && question) {
      setSpeaking(true);
      speakText(question, { onEnd: () => setSpeaking(false) });
    }
  }, [question, voiceMode]);

  function replayQuestion() {
    if (!question) return;
    setSpeaking(true);
    speakText(question, { onEnd: () => setSpeaking(false) });
  }

  function stopSpeaking() {
    cancelVoice();
    setSpeaking(false);
  }

  // Stop any speech or capture if the user leaves the page.
  useEffect(() => {
    return () => {
      cancelVoice();
      captureRef.current?.cancel();
    };
  }, []);

  function stopCapture() {
    captureRef.current?.cancel();
    captureRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRecording(false);
    cancelVoice();
    setSpeaking(false);
  }

  async function startAnswer() {
    if (starting || recording) return; // guard against a double click during load
    setStarting(true);
    setError("");
    cancelVoice(); // do not record the interviewer's own voice
    setSpeaking(false);
    try {
      // The capture attaches the stream to the preview element and samples from it.
      captureRef.current = await startCapture({ video: cameraOn, sampleVideo: videoRef.current });
      setRecording(true);
    } catch (err) {
      // The camera or microphone would not start. If the camera was on, fall back to a
      // voice-only answer so the student is not blocked; only a mic failure is fatal.
      if (cameraOn) {
        setCameraOn(false);
        try {
          captureRef.current = await startCapture({ video: false });
          setRecording(true);
          setError("The camera could not start, so this answer is audio only.");
        } catch (audioErr) {
          setError(`Could not start the microphone: ${message(audioErr)}`);
        }
      } else {
        setError(`Could not start the microphone: ${message(err)}`);
      }
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
    setFeedback(null);
    setHistory([]);
    setAnswer("");
    setMetrics(null);
    setNonverbal(null);
    try {
      const res = await startInterview(voiceMode ? "voice" : "text", interviewType, focus);
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
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
          <CardBody className="space-y-6">
            <CardTitle>Set up your interview</CardTitle>
            <div>
              <Select
                label="Interview type"
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value as InterviewType)}
                hint={INTERVIEW_TYPE_HINTS[interviewType]}
              >
                <option value="general">General (a realistic mix)</option>
                <option value="behavioural">Behavioural (about you and your fit)</option>
                <option value="competency">Competency-based (tell me about a time when...)</option>
                <option value="technical">Technical (spoken, no coding)</option>
                <option value="strengths">Strengths-based</option>
              </Select>
            </div>
            <div>
              <Select
                label="Focus"
                value={focus}
                onChange={(e) => setFocus(e.target.value as Focus)}
                hint={
                  <>
                    {focus === "gaps"
                      ? "The interviewer will focus on the competencies your CV is thin on."
                      : focus === "questions"
                        ? "The interviewer will draw mainly from your generated likely questions."
                        : "A realistic interview across the usual questions."}{" "}
                    <Link to="/prepare" className="font-medium text-brand-700 hover:underline">
                      Set these up in Prepare
                    </Link>
                    .
                  </>
                }
              >
                <option value="balanced">Balanced (a realistic mix)</option>
                <option value="gaps" disabled={!hasGaps}>
                  My weak spots{hasGaps ? "" : " (generate a plan in Prepare first)"}
                </option>
                <option value="questions" disabled={!hasQuestions}>
                  My likely questions{hasQuestions ? "" : " (generate them in Prepare first)"}
                </option>
              </Select>
            </div>
            {supported ? (
              <div className="space-y-4">
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
          <h2 className="sr-only">Answered so far</h2>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => (speaking ? stopSpeaking() : replayQuestion())}
                      aria-label={speaking ? "Stop the spoken question" : "Replay the spoken question"}
                    >
                      {speaking ? (
                        <>
                          <SpeakingIndicator className="h-4 text-brand-600" /> Stop
                        </>
                      ) : (
                        <>
                          <SpeakerIcon className="h-4 w-4" /> Replay
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div aria-live="polite">
                  <p className="sr-only">Interviewer question {history.length + 1}:</p>
                  <p className="text-lg font-medium text-slate-900">{question}</p>
                </div>

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
                  label="Your answer"
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
            <FeedbackView report={feedback} />
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
