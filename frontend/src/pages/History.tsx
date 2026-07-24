import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteInterview, listSessions, type SessionSummary } from "../api";
import { Badge, Button, Card } from "../components/ui";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("en-GB");
}

const TYPE_LABELS: Record<string, string> = {
  general: "General",
  behavioural: "Behavioural",
  competency: "Competency",
  technical: "Technical",
  strengths: "Strengths",
};

export default function History() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => setError(message(err)));
  }, []);

  async function remove(id: number) {
    setBusyId(id);
    setError("");
    try {
      await deleteInterview(id);
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    } catch (err) {
      setError(message(err));
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Interview history</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review your past mock interviews and feedback. You can delete any of them; this
          permanently removes that interview and its data.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !sessions && <p className="text-sm text-slate-500">Loading...</p>}

      {sessions && sessions.length === 0 && (
        <Card>
          <div className="p-8 text-center text-sm text-slate-500">
            You have no interviews yet.{" "}
            <Link to="/interview" className="font-medium text-brand-700 hover:underline">
              Start a mock interview
            </Link>
            .
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {sessions?.map((s) => (
          <Card key={s.id} className="transition-shadow hover:shadow-lift">
            <div className="flex items-center justify-between gap-4 p-5">
              <Link to={`/results/${s.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{s.preview}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(s.created_at)} · {s.question_count} question
                  {s.question_count === 1 ? "" : "s"}
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Badge color="slate">{TYPE_LABELS[s.interview_type] ?? s.interview_type}</Badge>
                <Badge color={s.mode === "voice" ? "brand" : "slate"}>{s.mode}</Badge>
                <Badge color={s.status === "finished" ? "green" : "amber"}>{s.status}</Badge>
                {confirmId === s.id ? (
                  <>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busyId === s.id}
                      onClick={() => remove(s.id)}
                    >
                      Confirm
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(s.id)}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
