import { useState } from "react";
import { Link } from "react-router-dom";
import { answerInterview, finishInterview, startInterview } from "../api";

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
              </p>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={4}
                placeholder="Your answer..."
                style={{ width: "100%", boxSizing: "border-box", fontSize: "1rem" }}
              />
              <div style={{ marginTop: "0.5rem" }}>
                <button onClick={submit} disabled={loading || !answer.trim()}>
                  {loading ? "Sending..." : "Submit answer"}
                </button>
                <button onClick={end} disabled={loading} style={{ marginLeft: "0.75rem" }}>
                  Finish and get feedback
                </button>
              </div>
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
