import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  createSavedAnswer,
  getPracticeQuestion,
  submitPracticeAnswer,
  type AnswerNote,
} from "../api";
import { Badge, Button, Card, CardBody, CardTitle, ErrorNote, Loading, TextArea } from "../components/ui";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const VERDICTS = {
  strong: { label: "Strong", color: "green" },
  adequate: { label: "Adequate", color: "amber" },
  weak: { label: "Weak", color: "red" },
} as const;

export default function QuickPractice() {
  // A specific question can be handed in (for example "redo this question" from a past
  // interview); otherwise we fetch one.
  const seeded = (useLocation().state as { question?: string } | null)?.question ?? "";
  const [question, setQuestion] = useState(seeded);
  const [loadingQuestion, setLoadingQuestion] = useState(!seeded);
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState<AnswerNote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [savedAnswer, setSavedAnswer] = useState(false);

  async function loadQuestion(exclude = "") {
    setLoadingQuestion(true);
    setError("");
    setNote(null);
    setAnswer("");
    setSavedAnswer(false);
    try {
      const res = await getPracticeQuestion(exclude);
      setQuestion(res.question);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoadingQuestion(false);
    }
  }

  useEffect(() => {
    if (!seeded) loadQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    setSubmitting(true);
    setError("");
    setSavedAnswer(false);
    try {
      setNote(await submitPracticeAnswer(question, answer));
    } catch (err) {
      setError(message(err));
    } finally {
      setSubmitting(false);
    }
  }

  const verdict = note ? (VERDICTS[note.verdict] ?? VERDICTS.adequate) : null;
  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Quick practice</h1>
        <p className="mt-1 text-sm text-slate-500">
          One question, instant feedback, no setup. A good way to practise a single answer between
          lectures. This does not count towards your progress. You can also{" "}
          <Link to="/bank" className="font-medium text-brand-700 hover:underline">
            browse the question bank
          </Link>
          .
        </p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card>
        <CardBody className="space-y-4">
          {loadingQuestion ? (
            <Loading label="Finding a question" />
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Question</p>
                <p className="mt-1 text-lg font-medium text-slate-900">{question}</p>
              </div>

              <TextArea
                aria-label="Your answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={6}
                placeholder="Type your answer, using a specific example..."
                disabled={submitting}
              />
              {wordCount > 0 && (
                <p className="-mt-1 text-xs text-slate-400">
                  {wordCount} {wordCount === 1 ? "word" : "words"}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={submit} loading={submitting} disabled={!answer.trim()}>
                  Get feedback
                </Button>
                <button
                  type="button"
                  onClick={() => loadQuestion(question)}
                  disabled={submitting}
                  className="text-sm font-medium text-brand-700 hover:underline disabled:opacity-50"
                >
                  Try another question
                </button>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {note && verdict && (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Feedback</CardTitle>
              <Badge color={verdict.color}>{verdict.label}</Badge>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{note.comment}</p>
            {note.model_answer && (
              <div className="rounded-lg border border-green-200 bg-green-50/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    How a strong answer might sound
                  </p>
                  {savedAnswer ? (
                    <span className="shrink-0 text-xs font-medium text-green-700">Saved</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        createSavedAnswer(question, note.model_answer).catch((err) => setError(message(err)));
                        setSavedAnswer(true);
                      }}
                      className="shrink-0 text-xs font-medium text-brand-700 hover:underline"
                    >
                      Save answer
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{note.model_answer}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={() => loadQuestion(question)}>Practise another</Button>
              <Link to="/saved" className="text-sm font-medium text-brand-700 hover:underline">
                Saved answers
              </Link>
              <Link to="/interview" className="text-sm font-medium text-brand-700 hover:underline">
                Do a full interview
              </Link>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
