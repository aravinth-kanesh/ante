import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { answerInterview, finishInterview, startInterview } from "../api";
import {
  cancelSpeech,
  createRecognition,
  speak,
  speechSupported,
  transcriptFrom,
  type SpeechRecognition,
} from "../speech";

interface Exchange {
  question: string;
  answer: string;
}

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export default function Interview() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supported = speechSupported();
  const [voiceMode, setVoiceMode] = useState(supported);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Speak each new interviewer question while voice mode is on.
  useEffect(() => {
    if (voiceMode && question) speak(question);
  }, [question, voiceMode]);

  // Stop any speech or listening if the user leaves the page.
  useEffect(() => {
    return () => {
      cancelSpeech();
      recognitionRef.current?.abort();
    };
  }, []);

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function startListening() {
    const recognition = createRecognition();
    if (!recognition) return;
    cancelSpeech(); // do not record the interviewer's own voice
    recognition.onresult = (event) => setAnswer(transcriptFrom(event));
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  async function begin() {
    setLoading(true);
    setError("");
    setFeedback("");
    setHistory([]);
    try {
      const res = await startInterview();
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
    stopListening();
    cancelSpeech();
    setLoading(true);
    setError("");
    try {
      const res = await answerInterview(sessionId, answer);
      setHistory((h) => [...h, { question, answer }]);
      setAnswer("");
      setQuestion(res.done ? null : res.question);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  async function end() {
    if (sessionId === null) return;
    stopListening();
    cancelSpeech();
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

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Mock interview</h1>
        <Link to="/">Back to dashboard</Link>
      </header>

      {supported ? (
        <label style={{ display: "block", margin: "0.5rem 0", color: "#333" }}>
          <input
            type="checkbox"
            checked={voiceMode}
            onChange={(e) => {
              if (!e.target.checked) {
                stopListening();
                cancelSpeech();
              }
              setVoiceMode(e.target.checked);
            }}
          />{" "}
          Voice mode (questions are read aloud; answer by speaking)
        </label>
      ) : (
        <p style={{ color: "#666", fontSize: "0.85rem" }}>
          This browser does not support speech, so the interview is typed. Voice mode works
          best in Chrome or Edge.
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
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={4}
                placeholder={voiceMode ? "Speak your answer, or type it here..." : "Your answer..."}
                style={{ width: "100%", boxSizing: "border-box", fontSize: "1rem" }}
              />
              <div style={{ marginTop: "0.5rem" }}>
                {voiceMode && (
                  <button
                    onClick={listening ? stopListening : startListening}
                    disabled={loading}
                    style={{ marginRight: "0.75rem" }}
                  >
                    {listening ? "Stop recording" : "Speak answer"}
                  </button>
                )}
                <button onClick={submit} disabled={loading || !answer.trim()}>
                  {loading ? "Sending..." : "Submit answer"}
                </button>
                <button onClick={end} disabled={loading} style={{ marginLeft: "0.75rem" }}>
                  Finish and get feedback
                </button>
              </div>
              {listening && (
                <p style={{ color: "#666", fontSize: "0.85rem", margin: "0.5rem 0 0" }}>
                  Listening... the transcript appears above and can be edited before you submit.
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
