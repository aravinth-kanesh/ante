import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteInterview, listSessions, type SessionSummary } from "../api";
import { Badge, Button, Card, Input, Loading, cn } from "../components/ui";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("en-GB");
}

const TYPES = [
  { value: "all", label: "All types" },
  { value: "general", label: "General" },
  { value: "behavioural", label: "Behavioural" },
  { value: "competency", label: "Competency" },
  { value: "technical", label: "Technical" },
  { value: "strengths", label: "Strengths" },
] as const;

// Buckets are mutually exclusive and ordered newest-first, so the labels say
// "earlier this week/month" to make clear each one sits below the ones above it.
const BUCKETS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Earlier this week" },
  { key: "month", label: "Earlier this month" },
  { key: "earlier", label: "Older" },
] as const;

function bucketOf(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (now.getDay() + 6) % 7; // 0 = Monday
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - mondayOffset);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (d >= startOfToday) return "today";
  if (d >= startOfWeek) return "week";
  if (d >= startOfMonth) return "month";
  return "earlier";
}

export default function History() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sessions ?? []).filter(
      (s) =>
        (type === "all" || s.interview_type === type) &&
        (q === "" || s.title.toLowerCase().includes(q)),
    );
  }, [sessions, query, type]);

  const groups = BUCKETS.map((b) => ({
    ...b,
    items: filtered.filter((s) => bucketOf(s.created_at) === b.key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Interview history</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review your past mock interviews and feedback. Deleting one permanently removes that
          interview and its data.
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {sessions && sessions.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by company, role or type..."
            className="sm:max-w-xs"
          />
          <div role="group" aria-label="Filter by interview type" className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={type === t.value}
                onClick={() => setType(t.value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  type === t.value
                    ? "bg-brand-600 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!error && !sessions && <Loading label="Loading your interviews" />}

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

      {sessions && sessions.length > 0 && groups.length === 0 && (
        <p className="text-sm text-slate-500">No interviews match your search.</p>
      )}

      {groups.map((group) => (
        <section key={group.key} className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500">
            {group.label}{" "}
            <span className="font-normal text-slate-500">({group.items.length})</span>
          </h2>
          {group.items.map((s) => (
            <Card key={s.id} className="transition-shadow hover:shadow-lift">
              <div className="flex items-center justify-between gap-4 p-5">
                <Link to={`/results/${s.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{s.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(s.created_at)} · {s.question_count} question
                    {s.question_count === 1 ? "" : "s"}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge color={s.mode === "voice" ? "brand" : "slate"}>{s.mode}</Badge>
                  <Badge color={s.status === "finished" ? "green" : "amber"}>{s.status}</Badge>
                  {s.focus === "gaps" && <Badge color="slate">weak spots</Badge>}
                  {s.focus === "questions" && <Badge color="slate">likely questions</Badge>}
                  {confirmId === s.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="destructive"
                        loading={busyId === s.id}
                        onClick={() => remove(s.id)}
                      >
                        Delete permanently
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => setConfirmId(s.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}
