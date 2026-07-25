import { type CompanyResearch } from "../api";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export default function CompanyResearchView({
  company,
  role,
  research,
}: {
  company: string;
  role: string;
  research: CompanyResearch;
}) {
  return (
    <div className="space-y-5">
      {(company || role) && (
        <p className="font-medium text-slate-900">
          {company || "Company"}
          {role && <span className="text-slate-500"> · {role}</span>}
        </p>
      )}

      {research.overview && (
        <Section title="Overview">
          <p className="text-sm leading-relaxed text-slate-700">{research.overview}</p>
        </Section>
      )}

      {research.interview_process && (
        <Section title="Interview process">
          <p className="text-sm leading-relaxed text-slate-700">{research.interview_process}</p>
        </Section>
      )}

      {research.skills.length > 0 && (
        <Section title="Skills they look for">
          <div className="flex flex-wrap gap-2">
            {research.skills.map((skill, i) => (
              <span
                key={i}
                className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </Section>
      )}

      {research.tips.length > 0 && (
        <Section title="How to prepare">
          <ul className="space-y-1.5">
            {research.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                <span className="text-brand-600" aria-hidden>
                  •
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
