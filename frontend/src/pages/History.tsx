import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSessions, type SessionSummary } from "../api";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("en-GB");
}

export default function History() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => setError(message(err)));
  }, []);

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Interview history</h1>
        <Link to="/">Back to dashboard</Link>
      </header>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!error && !sessions && <p>Loading...</p>}
      {sessions && sessions.length === 0 && (
        <p style={{ color: "#666" }}>
          You have no interviews yet. <Link to="/interview">Start a mock interview</Link>.
        </p>
      )}

      {sessions?.map((s) => (
        <Link
          key={s.id}
          to={`/results/${s.id}`}
          style={{
            display: "block",
            textDecoration: "none",
            color: "inherit",
            border: "1px solid #e2e5ea",
            borderRadius: 6,
            padding: "0.75rem 1rem",
            margin: "0.6rem 0",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>{s.preview}</p>
          <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "0.85rem" }}>
            {formatDate(s.created_at)} · {s.mode} · {s.question_count} question
            {s.question_count === 1 ? "" : "s"} · {s.status}
          </p>
        </Link>
      ))}
    </main>
  );
}
