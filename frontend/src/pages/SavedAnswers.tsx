import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteSavedAnswer, listSavedAnswers, type SavedAnswer } from "../api";
import { Button, Card, CardBody, Loading } from "../components/ui";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export default function SavedAnswers() {
  const [answers, setAnswers] = useState<SavedAnswer[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listSavedAnswers()
      .then(setAnswers)
      .catch((err) => setError(message(err)));
  }, []);

  async function remove(id: number) {
    setError("");
    try {
      await deleteSavedAnswer(id);
      setAnswers((a) => (a ? a.filter((x) => x.id !== id) : a));
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Saved answers</h1>
        <p className="mt-1 text-sm text-slate-500">
          Model answers you bookmarked from your feedback. Revisit them before the real interview,
          then make them your own.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!answers && <Loading label="Loading your saved answers" />}
      {answers && answers.length === 0 && (
        <p className="text-sm text-slate-500">
          Nothing saved yet. When you review feedback, use "Save answer" on any model answer to keep
          it here.
        </p>
      )}

      <div className="space-y-3">
        {answers?.map((a) => (
          <Card key={a.id}>
            <CardBody className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                {a.question && <p className="font-medium text-slate-900">{a.question}</p>}
                <Button variant="ghost" size="sm" onClick={() => remove(a.id)}>
                  Remove
                </Button>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{a.answer}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="text-sm text-slate-500">
        <Link to="/practice" className="font-medium text-brand-700 hover:underline">
          Practise a question
        </Link>{" "}
        to build more.
      </p>
    </div>
  );
}
