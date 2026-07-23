import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  analyseNonverbal,
  answerInterview,
  finishInterview,
  startInterview,
  transcribeAudio,
  type DeliveryMetrics,
  type NonverbalMetrics,
} from "../api";
import { recordingSupported, startCapture, type Capture } from "../capture";
import { cancelSpeech, speak } from "../speech";

interface Exchange {
  question: string;
  answer: string;
}

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function deliverySummary(m: DeliveryMetrics): string {
  if (m.word_count === 0) return "No speech detected.";
  const parts = [`≈${m.wpm} words/min over ${Math.round(m.duration_sec)}s`];
  if (m.pause_count) {
    parts.push(`${m.pause_count} pause${m.pause_count === 1 ? "" : "s"}`);
  }
  if (m.filler_count) {
    const top = Object.entries(m.fillers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word, count]) => `${word} x${count}`)
      .join(", ");
    parts.push(`${m.filler_count} filler${m.filler_count === 1 ? "" : "s"} (${top})`);
  }
  return parts.join(" · ");
}

function nonverbalSummary(m: NonverbalMetrics): string {
  if (!m.face_detected) return "No face detected on camera.";
  const parts = [`eye contact ${m.eye_contact_pct}%`, `${m.steadiness_label} head`];
  if (m.posture_pct !== null) parts.push(`level posture ${m.posture_pct}%`);
  if (m.smile_pct !== null) parts.push(`smiled ${m.smile_pct}%`);
  return parts.join(" · ");
}

const readoutStyle = {
  margin: "0.25rem 0 0",
  padding: "0.4rem 0.6rem",
  background: "#f2f4f7",
  borderRadius: 4,
  color: "#333",
  fontSize: "0.85rem",
} as const;

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
  const [voiceMode, setVoiceMode] = useState(supported);
  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
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
      const res = await startInterview(voiceMode ? "voice" : "text");
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

  const busy = loading || analysing || recording;

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Mock interview</h1>
        <Link to="/">Back to dashboard</Link>
      </header>

      {supported ? (
        <>
          <label style={{ display: "block", margin: "0.5rem 0", color: "#333" }}>
            <input
              type="checkbox"
              checked={voiceMode}
              onChange={(e) => {
                if (!e.target.checked) {
                  stopCapture();
                  setCameraOn(false);
                }
                setVoiceMode(e.target.checked);
              }}
            />{" "}
            Voice mode (questions are read aloud; answer by speaking, with delivery feedback)
          </label>
          {voiceMode && (
            <label style={{ display: "block", margin: "0.25rem 0", color: "#333" }}>
              <input
                type="checkbox"
                checked={cameraOn}
                disabled={recording || analysing}
                onChange={(e) => setCameraOn(e.target.checked)}
              />{" "}
              Camera (adds eye contact, composure and posture feedback; nothing is recorded)
            </label>
          )}
        </>
      ) : (
        <p style={{ color: "#666", fontSize: "0.85rem" }}>
          This browser does not support audio recording, so the interview is typed. Voice mode
          works best in Chrome or Edge.
        </p>
      )}

      {error && (
        <p style={{ color: "crimson" }}>
          {error}
          {error.toLowerCase().includes("cv") && (
            <>
              {" "}
              <Link to="/">Add your CV</Link>.
            </>
          )}
        </p>
      )}

      {sessionId === null && (
        <button onClick={begin} disabled={loading}>
          {loading ? "Starting..." : "Start interview"}
        </button>
      )}

      {history.map((ex, i) => (
        <div key={i} style={{ marginBottom: "1rem" }}>
          <p style={{ margin: "0.25rem 0" }}>
            <strong>Interviewer:</strong> {ex.question}
          </p>
          <p style={{ margin: "0.25rem 0", color: "#333" }}>
            <strong>You:</strong> {ex.answer}
          </p>
        </div>
      ))}

      {sessionId !== null && !feedback && (
        <section>
          {question !== null ? (
            <>
              <p>
                <strong>Interviewer:</strong> {question}
                {voiceMode && (
                  <button
                    onClick={() => speak(question)}
                    style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}
                    title="Replay the question"
                  >
                    Replay
                  </button>
                )}
              </p>
              {cameraOn && (
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  style={{
                    width: 220,
                    borderRadius: 4,
                    margin: "0.5rem 0",
                    display: recording ? "block" : "none",
                    transform: "scaleX(-1)",
                  }}
                />
              )}
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={4}
                placeholder={voiceMode ? "Speak your answer, or type it here..." : "Your answer..."}
                style={{ width: "100%", boxSizing: "border-box", fontSize: "1rem" }}
              />
              {metrics && (
                <p style={readoutStyle}>
                  <strong>Delivery:</strong> {deliverySummary(metrics)}
                </p>
              )}
              {nonverbal && (
                <p style={readoutStyle}>
                  <strong>Nonverbal:</strong> {nonverbalSummary(nonverbal)}
                </p>
              )}
              <div style={{ marginTop: "0.5rem" }}>
                {voiceMode && (
                  <button
                    onClick={recording ? stopAnswer : startAnswer}
                    disabled={loading || analysing}
                    style={{ marginRight: "0.75rem" }}
                  >
                    {recording ? "Stop recording" : analysing ? "Analysing..." : "Speak answer"}
                  </button>
                )}
                <button onClick={submit} disabled={busy || !answer.trim()}>
                  {loading ? "Sending..." : "Submit answer"}
                </button>
                <button onClick={end} disabled={busy} style={{ marginLeft: "0.75rem" }}>
                  Finish and get feedback
                </button>
              </div>
              {recording && (
                <p style={{ color: "#666", fontSize: "0.85rem", margin: "0.5rem 0 0" }}>
                  Recording... press Stop when you have finished your answer.
                </p>
              )}
            </>
          ) : (
            <div>
              <p>You have answered all the questions.</p>
              <button onClick={end} disabled={loading}>
                {loading ? "Preparing feedback..." : "Get feedback"}
              </button>
            </div>
          )}
        </section>
      )}

      {feedback && (
        <section style={{ marginTop: "1rem" }}>
          <h2>Feedback</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{feedback}</p>
          <button onClick={begin} disabled={loading}>
            Start another interview
          </button>
        </section>
      )}
    </main>
  );
}
