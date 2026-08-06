import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getInterview, regenerateFeedback, type InterviewDetail } from "../api";
import FeedbackView from "../components/FeedbackView";
import { Badge, Button, Card, CardBody, CardTitle, MicIcon, VideoIcon } from "../components/ui";
import { deliverySummary, nonverbalSummary } from "../format";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const TYPE_LABELS: Record<string, string> = {
  general: "General",
  behavioural: "Behavioural",
  competency: "Competency-based",
  technical: "Technical",
  strengths: "Strengths-based",
};

// Mirrors the session title the backend builds for the history list.
function describeSession(detail: InterviewDetail): string {
  const label = TYPE_LABELS[detail.interview_type] ?? "General";
  let title = detail.company ? `${detail.company} - ${label} Interview` : `${label} Interview`;
  if (detail.role) title += ` for ${detail.role}`;
  if (detail.focus === "gaps") title += " (weak spots)";
  else if (detail.focus === "questions") title += " (likely questions)";
  return title;
}

export default function Results() {
  const { id } = useParams();
  const [detail, setDetail] = useState<InterviewDetail | null>(null);
  const [error, setError] = useState("");
  const [regenerating, setRegenerating] = useState(false);

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

  async function regenerate() {
    const sessionId = Number(id);
    setRegenerating(true);
    setError("");
    try {
      const res = await regenerateFeedback(sessionId);
      setDetail((d) => (d ? { ...d, feedback: res.feedback } : d));
    } catch (err) {
      setError(message(err));
    } finally {
      setRegenerating(false);
    }
  }

  const turns = detail?.turns ?? [];
  const exchanges = turns.filter((t) => t.kind === "question" || t.kind === "answer");
  const fb = detail?.feedback;
  // Feedback from before the structured format has only a summary.
  const isLegacyFeedback =
    !!fb && fb.strengths.length === 0 && fb.improvements.length === 0 && fb.answer_notes.length === 0;
  const hasAnswers = exchanges.some((t) => t.kind === "answer");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Interview results</h1>
          {detail && (
            <>
              <p className="mt-1 font-medium text-slate-700">{describeSession(detail)}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {detail.status === "finished" ? "Completed" : "In progress"} · {detail.mode}{" "}
                interview
              </p>
            </>
          )}
        </div>
        <Link to="/history" className="text-sm font-medium text-brand-700 hover:underline">
          Back to history
        </Link>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!error && !detail && <p className="text-sm text-slate-500">Loading...</p>}

      {detail && (
        <>
          <Card>
            <CardBody className="space-y-5">
              <CardTitle>Transcript</CardTitle>
              {exchanges.map((turn, i) =>
                turn.kind === "question" ? (
                  <p key={i} className="pt-2 text-sm font-semibold text-slate-900">
                    <span className="text-brand-700">Interviewer.</span> {turn.content}
                  </p>
                ) : (
                  <div key={i} className="border-l-2 border-slate-200 pl-4">
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">You.</span> {turn.content}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {turn.metrics && (
                        <Badge color="brand">
                          <MicIcon className="h-3.5 w-3.5" /> {deliverySummary(turn.metrics)}
                        </Badge>
                      )}
                      {turn.nonverbal && (
                        <Badge color="slate">
                          <VideoIcon className="h-3.5 w-3.5" /> {nonverbalSummary(turn.nonverbal)}
                        </Badge>
                      )}
                    </div>
                  </div>
                ),
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Feedback</CardTitle>
                {hasAnswers && (
                  <Button variant="secondary" size="sm" onClick={regenerate} loading={regenerating}>
                    {fb ? "Regenerate feedback" : "Generate feedback"}
                  </Button>
                )}
              </div>

              {isLegacyFeedback && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  This interview predates the structured feedback. Regenerate it for the full
                  breakdown of strengths, improvements and per-answer notes.
                </p>
              )}

              <div className="mt-3">
                {fb ? (
                  <FeedbackView report={fb} />
                ) : (
                  <p className="text-sm text-slate-500">This interview has no feedback yet.</p>
                )}
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
