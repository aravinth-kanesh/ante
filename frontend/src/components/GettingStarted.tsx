import { Link } from "react-router-dom";
import { Button, Card, CardBody, CardTitle, CheckIcon, cn } from "./ui";

export interface OnboardingSteps {
  cv: boolean;
  jd: boolean;
  plan: boolean;
  interview: boolean;
}

const STEPS = [
  {
    key: "cv",
    label: "Add your CV",
    help: "Upload or paste a CV so everything is tailored to you.",
    to: "/cvs",
    cta: "Add a CV",
  },
  {
    key: "jd",
    label: "Set your target role",
    help: "Paste the job description you are preparing for.",
    to: "/prepare",
    cta: "Set the role",
  },
  {
    key: "plan",
    label: "Generate your plan",
    help: "See where you fit the role and the questions you are likely to face.",
    to: "/prepare",
    cta: "Generate a plan",
  },
  {
    key: "interview",
    label: "Do your first interview",
    help: "Practise with spoken questions and get feedback on your answers.",
    to: "/interview",
    cta: "Start an interview",
  },
] as const;

/**
 * A non-blocking first-run checklist on the Dashboard. Each step's done state is
 * derived from real data, so it stays accurate; the first incomplete step gets the
 * call-to-action. The Dashboard only renders this while the account is incomplete and
 * not dismissed.
 */
export default function GettingStarted({
  steps,
  onHide,
}: {
  steps: OnboardingSteps;
  onHide: () => void;
}) {
  const doneCount = STEPS.filter((s) => steps[s.key]).length;
  const firstIncomplete = STEPS.findIndex((s) => !steps[s.key]);

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Getting started</CardTitle>
          <span className="text-sm text-slate-500">
            {doneCount} of {STEPS.length} done
          </span>
        </div>
        <ol className="mt-4 space-y-3">
          {STEPS.map((s, i) => {
            const done = steps[s.key];
            const active = i === firstIncomplete;
            return (
              <li key={s.key} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done
                      ? "bg-green-100 text-green-700"
                      : active
                        ? "bg-brand-600 text-white"
                        : "bg-slate-100 text-slate-500",
                  )}
                >
                  {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", active ? "text-slate-900" : "text-slate-500")}>
                    {done && <span className="sr-only">Done: </span>}
                    {s.label}
                  </p>
                  {active && (
                    <>
                      <p className="mt-0.5 text-sm text-slate-500">{s.help}</p>
                      <Link to={s.to} className="mt-2 inline-block">
                        <Button size="sm">{s.cta}</Button>
                      </Link>
                    </>
                  )}
                  {done && (
                    <Link to={s.to} className="text-xs font-medium text-brand-700 hover:underline">
                      Revisit
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={onHide}
          className="mt-4 text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
        >
          Hide this
        </button>
      </CardBody>
    </Card>
  );
}
