import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getInterview, type InterviewDetail } from "../api";
import { Badge, Card, CardBody, CardTitle, MicIcon, VideoIcon } from "../components/ui";
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
  return title;
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

      {error && <p className="text-sm text-red-600">{error}</p>}
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
              <CardTitle>Feedback</CardTitle>
              {feedback ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {feedback.content}
                </p>
              ) : (
                <p className="mt-3 text-sm text-slate-500">This interview has no feedback yet.</p>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
