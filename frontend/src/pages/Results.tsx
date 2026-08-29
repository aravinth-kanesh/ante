import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getInterview,
  regenerateFeedback,
  saveConfidence,
  saveReflection,
  type InterviewDetail,
} from "../api";
import AnswerTimeline from "../components/AnswerTimeline";
import FeedbackView from "../components/FeedbackView";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  cn,
  Loading,
  MicIcon,
  TextArea,
  VideoIcon,
} from "../components/ui";
import { deliverySummary, nonverbalSummary } from "../format";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function Rating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="mt-1.5 flex gap-1.5" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={cn(
              "h-9 w-9 rounded-lg border text-sm font-medium transition-colors",
              value === n
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-300 text-slate-600 hover:bg-slate-50",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
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
  const navigate = useNavigate();
  const [detail, setDetail] = useState<InterviewDetail | null>(null);
  const [error, setError] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [reflection, setReflection] = useState("");
  const [savedReflection, setSavedReflection] = useState("");
  const [savingReflection, setSavingReflection] = useState(false);
  const [conf, setConf] = useState({ before: 0, after: 0 });
  const [savedConf, setSavedConf] = useState({ before: 0, after: 0 });
  const [savingConf, setSavingConf] = useState(false);

  useEffect(() => {
    const sessionId = Number(id);
    if (!Number.isFinite(sessionId)) {
      setError("Invalid interview.");
      return;
    }
    getInterview(sessionId)
      .then((d) => {
        setDetail(d);
        setReflection(d.reflection);
        setSavedReflection(d.reflection);
        setConf({ before: d.confidence_before, after: d.confidence_after });
        setSavedConf({ before: d.confidence_before, after: d.confidence_after });
      })
      .catch((err) => setError(message(err)));
  }, [id]);

  async function storeConfidence() {
    setSavingConf(true);
    setError("");
    try {
      await saveConfidence(Number(id), conf.before, conf.after);
      setSavedConf(conf);
    } catch (err) {
      setError(message(err));
    } finally {
      setSavingConf(false);
    }
  }

  async function storeReflection() {
    const sessionId = Number(id);
    setSavingReflection(true);
    setError("");
    try {
      await saveReflection(sessionId, reflection);
      setSavedReflection(reflection.trim());
      setReflection(reflection.trim());
    } catch (err) {
      setError(message(err));
    } finally {
      setSavingReflection(false);
    }
  }

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
  // Whether any answer fell short, so we can point the student back to their gap
  // analysis in Prepare rather than leaving the feedback as a dead end.
  const needsWork = !!fb && fb.answer_notes.some((n) => n.verdict !== "strong");

  return (
    <div className="print-report space-y-6">
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
              <p className="print-only mt-1 text-sm text-slate-500">
                Report printed on {new Date().toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </>
          )}
        </div>
        <div className="no-print flex items-center gap-4">
          {detail && (
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              Save as PDF
            </Button>
          )}
          <Link to="/history" className="text-sm font-medium text-brand-700 hover:underline">
            Back to history
          </Link>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!error && !detail && <Loading label="Loading your results" />}

      {detail && (
        <>
          <Card>
            <CardBody className="space-y-5">
              <CardTitle>Transcript</CardTitle>
              {exchanges.map((turn, i) =>
                turn.kind === "question" ? (
                  <div key={i} className="pt-2">
                    <p className="text-sm font-semibold text-slate-900">
                      <span className="text-brand-700">Interviewer.</span> {turn.content}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/practice", { state: { question: turn.content } })}
                      className="no-print mt-1 text-xs font-medium text-brand-700 hover:underline"
                    >
                      Practise this question again
                    </button>
                  </div>
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
                    {turn.metrics && <AnswerTimeline metrics={turn.metrics} />}
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
                  <Button
                    variant="secondary"
                    size="sm"
                    className="no-print"
                    onClick={regenerate}
                    loading={regenerating}
                  >
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

          <Card>
            <CardBody>
              <CardTitle>Your reflection</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                In your own words, what is the one thing you will do differently next time? Writing
                it down makes it far likelier to stick.
              </p>
              {savedReflection && <p className="print-only mt-2 text-sm text-slate-700">{savedReflection}</p>}
              <div className="no-print mt-3 space-y-2">
                <TextArea
                  aria-label="Your reflection"
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={3}
                  placeholder="Next time I will..."
                />
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    onClick={storeReflection}
                    loading={savingReflection}
                    disabled={reflection.trim() === savedReflection}
                  >
                    Save reflection
                  </Button>
                  {reflection.trim() === savedReflection && savedReflection && (
                    <span role="status" className="text-sm text-green-600">
                      Saved
                    </span>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="no-print">
            <CardBody className="space-y-4">
              <CardTitle>Confidence check-in</CardTitle>
              <p className="text-sm text-slate-500">
                Rate how confident you felt, to watch your nerves settle as you practise. 1 is very
                nervous, 5 is very confident.
              </p>
              <Rating
                label="Before this interview"
                value={conf.before}
                onChange={(v) => setConf((c) => ({ ...c, before: v }))}
              />
              <Rating
                label="After it"
                value={conf.after}
                onChange={(v) => setConf((c) => ({ ...c, after: v }))}
              />
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={storeConfidence}
                  loading={savingConf}
                  disabled={conf.before === savedConf.before && conf.after === savedConf.after}
                >
                  Save
                </Button>
                {conf.before === savedConf.before &&
                  conf.after === savedConf.after &&
                  (savedConf.before > 0 || savedConf.after > 0) && (
                    <span role="status" className="text-sm text-green-600">
                      Saved
                    </span>
                  )}
              </div>
            </CardBody>
          </Card>

          {fb && !isLegacyFeedback && (
            <Card className="no-print border-brand-200 bg-brand-50/40">
              <CardBody className="space-y-3">
                <CardTitle>What next</CardTitle>
                {needsWork ? (
                  <>
                    <p className="text-sm text-slate-600">
                      Some answers were rated weak or adequate. Take these back to your preparation
                      plan to see which competencies to shore up, then practise them in a focused
                      mock.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button onClick={() => navigate("/prepare")}>Review your weak spots</Button>
                      <Link
                        to="/interview"
                        className="text-sm font-medium text-brand-700 hover:underline"
                      >
                        Practise again
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">
                      Strong across the board. Keep it sharp with another mock, or move on to your
                      next role in Prepare.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button onClick={() => navigate("/interview")}>Start another interview</Button>
                      <Link
                        to="/prepare"
                        className="text-sm font-medium text-brand-700 hover:underline"
                      >
                        Review your preparation plan
                      </Link>
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
