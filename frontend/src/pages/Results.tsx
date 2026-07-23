import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getInterview, type InterviewDetail, type TurnRead } from "../api";
import { deliverySummary, nonverbalSummary } from "../format";

const readoutStyle = {
  margin: "0.25rem 0 0",
  padding: "0.4rem 0.6rem",
  background: "#f2f4f7",
  borderRadius: 4,
  color: "#333",
  fontSize: "0.85rem",
} as const;

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export default function Results() {
  const { id } = useParams();
  const [detail, setDetail] = useState<InterviewDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const sessionId = Number(id);
    if (!Number.isFinite(sessionId)) {
      setError("Invalid interview.");
      return;
    }
    getInterview(sessionId)
      .then(setDetail)
      .catch((err) => setError(message(err)));
  }, [id]);

  const turns = detail?.turns ?? [];
  const feedback = turns.find((t) => t.kind === "feedback");
  const exchanges = turns.filter((t) => t.kind === "question" || t.kind === "answer");

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Interview results</h1>
        <span>
          <Link to="/history">History</Link> · <Link to="/">Dashboard</Link>
        </span>
      </header>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!error && !detail && <p>Loading...</p>}

      {detail && (
        <>
          <p style={{ color: "#666" }}>
            {detail.status === "finished" ? "Completed" : "In progress"} · {detail.mode} interview
          </p>

          <section>
            {exchanges.map((turn: TurnRead, i) =>
              turn.kind === "question" ? (
                <p key={i} style={{ margin: "1rem 0 0.25rem" }}>
                  <strong>Interviewer:</strong> {turn.content}
                </p>
              ) : (
                <div key={i} style={{ marginBottom: "0.5rem" }}>
                  <p style={{ margin: "0.25rem 0", color: "#333" }}>
                    <strong>You:</strong> {turn.content}
                  </p>
                  {turn.metrics && (
                    <p style={readoutStyle}>
                      <strong>Delivery:</strong> {deliverySummary(turn.metrics)}
                    </p>
                  )}
                  {turn.nonverbal && (
                    <p style={readoutStyle}>
                      <strong>Nonverbal:</strong> {nonverbalSummary(turn.nonverbal)}
                    </p>
                  )}
                </div>
              ),
            )}
          </section>

          {feedback ? (
            <section style={{ marginTop: "1.5rem" }}>
              <h2>Feedback</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{feedback.content}</p>
            </section>
          ) : (
            <p style={{ marginTop: "1.5rem", color: "#666" }}>
              This interview has no feedback yet.
            </p>
          )}
        </>
      )}
    </main>
  );
}
