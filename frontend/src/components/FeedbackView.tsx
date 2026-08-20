import { type FeedbackReport } from "../api";
import { Badge } from "./ui";

const VERDICTS = {
  strong: { label: "Strong", color: "green" },
  adequate: { label: "Adequate", color: "amber" },
  weak: { label: "Weak", color: "red" },
} as const;

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
  return (
    <div className="space-y-6">
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
