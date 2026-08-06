import { type Competency, type PlanItem, type PreparationReport } from "../api";
import { Badge } from "./ui";

const STATUS = {
  gap: { label: "Gap", color: "red", order: 0 },
  partial: { label: "Partial", color: "amber", order: 1 },
  strong: { label: "Strong", color: "green", order: 2 },
} as const;

const PRIORITY = {
  high: { label: "High", color: "red", order: 0 },
  medium: { label: "Medium", color: "amber", order: 1 },
  low: { label: "Low", color: "slate", order: 2 },
} as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function PreparationView({ report }: { report: PreparationReport }) {
  // Show weaknesses first so a student sees where to focus.
  const competencies = [...report.competencies].sort(
    (a: Competency, b: Competency) => STATUS[a.status].order - STATUS[b.status].order,
  );
  const plan = [...report.plan].sort(
    (a: PlanItem, b: PlanItem) => PRIORITY[a.priority].order - PRIORITY[b.priority].order,
  );

  return (
    <div className="space-y-6">
      {report.summary && (
        <p className="text-sm leading-relaxed text-slate-700">{report.summary}</p>
      )}

      {competencies.length > 0 && (
        <Section title="Competency analysis">
          <ul className="space-y-2">
            {competencies.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-slate-200 p-3"
              >
                <Badge color={STATUS[c.status].color}>{STATUS[c.status].label}</Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {c.name} <span className="text-xs font-normal text-slate-500">· {c.area}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">{c.evidence}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {plan.length > 0 && (
        <Section title="Your preparation plan">
          <ol className="space-y-3">
            {plan.map((p, i) => (
              <li key={i} className="flex items-start gap-3">
                <Badge color={PRIORITY[p.priority].color}>{PRIORITY[p.priority].label}</Badge>
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">{p.action}</p>
                  {p.focus && (
                    <p className="mt-0.5 text-xs text-slate-500">Addresses: {p.focus}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}
