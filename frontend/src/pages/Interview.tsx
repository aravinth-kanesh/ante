import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  analyseNonverbal,
  answerInterview,
  answerMediaBundleUrl,
  deleteAnswerMedia,
  finishInterview,
  listAnswerMedia,
  getPreparation,
  getPrepQuestions,
  startInterview,
  transcribeAudio,
  uploadAnswerMedia,
  type DeliveryMetrics,
  type FeedbackReport,
  type Focus,
  type InterviewLength,
  type InterviewType,
  type NonverbalMetrics,
} from "../api";
import { recordingSupported, startCapture, type Capture, type Replay } from "../capture";
import AnswerPlayer from "../components/AnswerPlayer";
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
  const requested = location.state as { focus?: Focus; category?: string } | null;
  const [interviewType, setInterviewType] = useState<InterviewType>("general");
  const [focus, setFocus] = useState<Focus>(requested?.focus ?? "balanced");
  const [category, setCategory] = useState(requested?.category ?? "");
  const [length, setLength] = useState<InterviewLength>(10);
  const [isSample, setIsSample] = useState(false);
  const [hasGaps, setHasGaps] = useState(false);
  const [hasQuestions, setHasQuestions] = useState(false);
  const [voiceMode, setVoiceMode] = useState(supported);
  const [cameraOn, setCameraOn] = useState(false);
  const [saveRecording, setSaveRecording] = useState(false);
  // Whether each answer's recording actually uploaded (by answer number), so a failure
  // is visible rather than silently swallowed.
  const [savedByIndex, setSavedByIndex] = useState<Record<number, boolean>>({});
  const [recordedAnswers, setRecordedAnswers] = useState<number[]>([]);
  const [recordingsDeleted, setRecordingsDeleted] = useState(false);
  // A local object URL for reviewing the just-recorded answer before submitting it.
  const [review, setReview] = useState<{ url: string; hasVideo: boolean } | null>(null);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const captureRef = useRef<Capture | null>(null);
  const replayRef = useRef<Replay | null>(null);
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

  // Start the live preview once it is on screen. Safari on macOS will not begin
  // playing a video element that was still hidden when play() was first called, so
  // the preview stayed black; nudging it here once it is visible fixes that.
  useEffect(() => {
    if (recording) videoRef.current?.play().catch(() => undefined);
  }, [recording]);

  // Free the local review URL when it is replaced or the page unmounts.
  useEffect(() => {
    return () => {
      if (review) URL.revokeObjectURL(review.url);
    };
  }, [review]);

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
    // A fresh take supersedes the previous one: clear its review and derived metrics
    // so a re-record never shows the earlier take's delivery or on-camera overlay.
    setReview(null);
    setMetrics(null);
    setNonverbal(null);
    cancelVoice(); // do not record the interviewer's own voice
    setSpeaking(false);
    try {
      // The capture attaches the stream to the preview element and samples from it.
      captureRef.current = await startCapture({
        video: cameraOn,
        sampleVideo: videoRef.current,
        record: saveRecording,
      });
      setRecording(true);
    } catch (err) {
      // The camera or microphone would not start. If the camera was on, fall back to a
      // voice-only answer so the student is not blocked; only a mic failure is fatal.
      if (cameraOn) {
        setCameraOn(false);
        try {
          captureRef.current = await startCapture({ video: false, record: saveRecording });
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
      const { audioBlob, samples, replay } = await capture.stop();
      replayRef.current = replay; // uploaded on submit, keyed to this question
      if (replay) setReview({ url: URL.createObjectURL(replay.blob), hasVideo: replay.hasVideo });
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

  async function begin(sample = false) {
    setLoading(true);
    setError("");
    setFeedback(null);
    setHistory([]);
    setAnswer("");
    setMetrics(null);
    setNonverbal(null);
    setSavedByIndex({});
    setRecordedAnswers([]);
    setRecordingsDeleted(false);
    setReview(null);
    setIsSample(sample);
    replayRef.current = null;
    try {
      const res = await startInterview(
        voiceMode ? "voice" : "text",
        interviewType,
        sample ? "balanced" : focus,
        length,
        sample ? "" : focus === "questions" ? category : "",
        sample,
      );
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
      const answerIndex = history.length + 1; // this answer's number, 1-based
      const res = await answerInterview(sessionId, answer, metrics, nonverbal);
      setHistory((h) => [...h, { question, answer }]);
      setAnswer("");
      setMetrics(null);
      setNonverbal(null);
      setQuestion(res.done ? null : res.question);
      setReview(null); // the answer is submitted; clear the local review
      const replay = replayRef.current;
      replayRef.current = null;
      if (replay) {
        // Saving the recording is best-effort: a failed upload must not block practice,
        // but the candidate is told so it is not a silent loss.
        try {
          await uploadAnswerMedia(sessionId, answerIndex, replay.blob);
          setSavedByIndex((m) => ({ ...m, [answerIndex]: true }));
        } catch {
          setSavedByIndex((m) => ({ ...m, [answerIndex]: false }));
        }
      }
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecordings() {
    if (sessionId === null) return;
    try {
      await deleteAnswerMedia(sessionId);
      setRecordingsDeleted(true);
    } catch (err) {
      setError(message(err));
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
      // Reflect what actually reached the server, rather than assuming every upload
      // succeeded, so the download panel is accurate.
      if (saveRecording) {
        try {
          const media = await listAnswerMedia(sessionId);
          setRecordedAnswers(media.map((m) => m.index));
        } catch {
          /* the panel simply will not show if the list cannot be fetched */
        }
      }
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || analysing || recording || starting;

  // A soft estimate of the interview's length in questions (roughly one every two and a
  // half minutes), used only to give a sense of progress. The bar is kept just short of
  // full while questions remain, since the real end is decided by the interviewer.
  const estimatedQuestions = Math.max(3, Math.round(length / 2.5));
  const questionNumber = history.length + 1;
  const interviewProgress = Math.min(questionNumber / (estimatedQuestions + 1), 0.9);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Mock interview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Adaptive questions grounded in your CV and the role, with feedback on your answers and
          delivery.
        </p>
      </div>

      {isSample && sessionId !== null && !feedback && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
          This is a sample interview using an example CV and role, so you can see how it works.
        </div>
      )}

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
                onChange={(e) => {
                  const next = e.target.value as Focus;
                  setFocus(next);
                  if (next !== "questions") setCategory("");
                }}
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
              {focus === "questions" && category && (
                <p className="mt-1 text-xs font-medium text-brand-700">
                  Focusing on your {category} questions.
                </p>
              )}
            </div>
            <div>
              <Select
                label="Length"
                value={length}
                onChange={(e) => setLength(Number(e.target.value) as InterviewLength)}
                hint="A guide, not a hard cut-off: you will always finish the question you are on, and you can stop any time."
              >
                {[5, 10, 15, 20, 25, 30].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
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
                      setSaveRecording(false);
                    }
                    setVoiceMode(v);
                  }}
                  label="Voice mode - questions are read aloud and you answer by speaking"
                />
                {voiceMode && (
                  <>
                    <Toggle
                      checked={cameraOn}
                      onChange={setCameraOn}
                      label="Camera - adds eye contact, composure and posture feedback"
                    />
                    <Toggle
                      checked={saveRecording}
                      onChange={setSaveRecording}
                      label="Save my answers so I can review and download them afterwards"
                    />
                    {saveRecording && (
                      <p className="text-xs leading-relaxed text-slate-500">
                        Your recordings are sent to our server only while you are interviewing, so
                        you can play them back and download them at the end. They are permanently
                        deleted when the session ends, and are never kept afterwards or used for
                        anything else.
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                This browser does not support audio recording, so the interview is typed. Voice
                mode works best in Chrome or Edge.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => begin()} loading={loading}>
                Start interview
              </Button>
              <button
                type="button"
                onClick={() => begin(true)}
                disabled={loading}
                className="text-sm font-medium text-brand-700 hover:underline disabled:opacity-50"
              >
                Try a sample interview
              </button>
            </div>
            <p className="text-xs text-slate-500">
              New here? "Try a sample interview" uses an example CV and role, so you can see how it
              works with no setup.
            </p>
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
                {savedByIndex[i + 1] === true && (
                  <p className="mt-1 text-xs text-green-600">Recording saved.</p>
                )}
                {savedByIndex[i + 1] === false && (
                  <p className="mt-1 text-xs text-amber-600">
                    This recording could not be saved, so it will not be available to download.
                  </p>
                )}
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
                  <div className="flex items-center gap-2.5">
                    <Badge color="brand">Question {history.length + 1}</Badge>
                    <span className="text-xs text-slate-500">
                      about {length} min, roughly {estimatedQuestions} questions
                    </span>
                  </div>
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
                {/* A calm sense of how far through the interview is. The length is a soft
                    time target, so the bar grows toward an estimated question count but never
                    fills before feedback, to avoid implying a hard cut-off. */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${Math.round(interviewProgress * 100)}%` }}
                  />
                </div>

                <div aria-live="polite">
                  <p className="sr-only">Interviewer question {history.length + 1}:</p>
                  <p className="text-lg font-medium text-slate-900">{question}</p>
                </div>

                {cameraOn && (
                  <div style={{ display: recording ? "block" : "none" }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-56 rounded-xl border border-slate-200 shadow-sm"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Live camera preview. Nothing is recorded.
                    </p>
                  </div>
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

                {review && metrics && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-slate-700">Review your answer</p>
                    <AnswerPlayer
                      src={review.url}
                      hasVideo={review.hasVideo}
                      metrics={metrics}
                      nonverbal={nonverbal}
                    />
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
                          <MicIcon className="h-4 w-4" /> {review ? "Record again" : "Speak answer"}
                        </>
                      )}
                    </Button>
                  )}
                  <Button onClick={submit} loading={loading} disabled={busy || !answer.trim()}>
                    Submit answer
                  </Button>
                  <Button variant="ghost" onClick={end} disabled={busy}>
                    Stop &amp; get feedback
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  That is the end of the interview. Get your feedback when you are ready.
                </p>
                <Button onClick={end} loading={loading}>
                  Get feedback
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Recordings: available to download for this session only, then deleted */}
      {feedback && sessionId !== null && recordedAnswers.length > 0 && !recordingsDeleted && (
        <Card className="border-brand-200 bg-brand-50/40">
          <CardBody className="space-y-3">
            <CardTitle>Your recordings</CardTitle>
            <p className="text-sm text-slate-600">
              {recordedAnswers.length} of your answers{" "}
              {recordedAnswers.length === 1 ? "was" : "were"} saved on our server for this session
              only. Download them to keep them on your device: we delete them when you leave this
              page, and never keep your audio or video afterwards.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={answerMediaBundleUrl(sessionId)}
                download
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
              >
                Download my recordings
              </a>
              <Button variant="danger" onClick={deleteRecordings}>
                Delete from server now
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
      {feedback && recordingsDeleted && (
        <p role="status" className="text-sm text-green-600">
          Your recordings have been deleted from our server.
        </p>
      )}

      {/* Feedback */}
      {feedback && (
        <Card>
          <CardBody className="space-y-4">
            <CardTitle>Feedback</CardTitle>
            <FeedbackView report={feedback} />
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={() => begin()} loading={loading}>
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
