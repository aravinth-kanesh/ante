import { type FeedbackReport } from "../api";
import { Badge } from "./ui";

const VERDICTS = {
  strong: { label: "Strong", color: "green" },
  adequate: { label: "Adequate", color: "amber" },
  weak: { label: "Weak", color: "red" },
} as const;

// A one-line read of the whole interview, derived from the per-answer verdicts so it
// stays honest to the detail below rather than a separate LLM judgement. Strong counts
// double, adequate once, weak nothing; the average places the interview on a three-band
// scale a student can act on at a glance.
function overallVerdict(counts: { strong: number; adequate: number; weak: number }, total: number) {
  if (total === 0) return null;
  const average = (counts.strong * 2 + counts.adequate) / total;
  if (average >= 1.5) return { label: "Strong overall", dot: "bg-green-500" };
  if (average >= 0.8) return { label: "On the right track", dot: "bg-amber-500" };
  return { label: "Needs more work", dot: "bg-red-500" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Bullets({ items, marker }: { items: string[]; marker: string }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
          <span className={marker} aria-hidden>
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function FeedbackView({ report }: { report: FeedbackReport }) {
  const counts = { strong: 0, adequate: 0, weak: 0 };
  for (const note of report.answer_notes) counts[note.verdict] += 1;
  const total = report.answer_notes.length;
  const glance = overallVerdict(counts, total);
  const focusNext = report.improvements[0] ?? "";

  return (
    <div className="space-y-6">
      {(glance || focusNext) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          {glance && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${glance.dot}`} aria-hidden />
              <span className="text-base font-semibold text-slate-900">{glance.label}</span>
              <span className="text-xs text-slate-500">
                {counts.strong} strong, {counts.adequate} adequate, {counts.weak} weak across{" "}
                {total} answer{total > 1 ? "s" : ""}
              </span>
            </div>
          )}
          {focusNext && (
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              <span className="font-medium text-slate-900">Focus next on:</span> {focusNext}
            </p>
          )}
        </div>
      )}

      <p className="text-sm leading-relaxed text-slate-700">{report.summary}</p>

      {report.strengths.length > 0 && (
        <Section title="What went well">
          <Bullets items={report.strengths} marker="text-green-600" />
        </Section>
      )}

      {report.improvements.length > 0 && (
        <Section title="How to improve">
          <Bullets items={report.improvements} marker="text-brand-600" />
        </Section>
      )}

      {report.answer_notes.length > 0 && (
        <Section title="Answer by answer">
          <ul className="space-y-3">
            {report.answer_notes.map((note, i) => {
              const verdict = VERDICTS[note.verdict] ?? VERDICTS.adequate;
              return (
                <li key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={verdict.color}>{verdict.label}</Badge>
                    <span className="text-sm font-medium text-slate-800">{note.question}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{note.comment}</p>
                  {note.model_answer && (
                    <div className="mt-2 rounded-lg border border-green-200 bg-green-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                        How a strong answer might sound
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">{note.model_answer}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {report.delivery && (
        <Section title="Delivery">
          <p className="text-sm leading-relaxed text-slate-700">{report.delivery}</p>
        </Section>
      )}
    </div>
  );
}
