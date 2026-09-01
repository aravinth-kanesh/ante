import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  generateProgressSummary,
  getProgress,
  readProgressSummary,
  type MetricDelta,
  type ProgressReport,
  type SessionStats,
  type TrendDirection,
} from "../api";
import TrendChart, { VerdictBars, type TrendPoint } from "../components/TrendChart";
import { Badge, Button, Card, CardBody, CardTitle, ErrorNote, Loading } from "../components/ui";

// What each metric means and its "good" range, in plain language.
const META: Record<string, { what: string; tip: string; format: (v: number) => string }> = {
  strong_rate: {
    what: "The share of your answers the coach rated strong.",
    tip: "Aim for at least half of your answers rated strong.",
    format: (v) => `${Math.round(v * 100)}%`,
  },
  wpm: {
    what: "How fast you speak.",
    tip: "A comfortable pace is about 110 to 160 words a minute.",
    format: (v) => `${Math.round(v)} wpm`,
  },
  filler_per_min: {
    what: "How often filler words like 'um' crept in.",
    tip: "Fewer sounds more confident; aim for under about three a minute.",
    format: (v) => `${v.toFixed(1)} a minute`,
  },
  eye_contact_pct: {
    what: "How often you looked at the camera.",
    tip: "Try to look at the camera most of the time.",
    format: (v) => `${Math.round(v)}%`,
  },
  head_steadiness: {
    what: "How steady and composed you kept your posture.",
    tip: "A steady position reads as confident.",
    format: (v) => `${Math.round(v)} out of 100`,
  },
};

const ATTR: Record<string, keyof SessionStats> = {
  strong_rate: "strong_rate",
  wpm: "avg_wpm",
  filler_per_min: "filler_per_min",
  eye_contact_pct: "eye_contact_pct",
  head_steadiness: "head_steadiness",
};

const GROUPS: { title: string; note: string; metrics: string[]; needs?: "delivery" | "nonverbal" }[] = [
  {
    title: "Answer quality",
    note: "How strong your answers were. This is measured for every interview, including typed ones.",
    metrics: ["strong_rate"],
  },
  {
    title: "Delivery",
    note: "How you spoke. Measured when you answer out loud.",
    metrics: ["wpm", "filler_per_min"],
    needs: "delivery",
  },
  {
    title: "On camera",
    note: "How you came across on webcam. Measured when the camera was on.",
    metrics: ["eye_contact_pct", "head_steadiness"],
    needs: "nonverbal",
  },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function DirectionBadge({ direction }: { direction: TrendDirection }) {
  if (direction === "improved") return <Badge color="green">Improving</Badge>;
  if (direction === "slipped") return <Badge color="amber">Slipped</Badge>;
  if (direction === "steady") return <Badge color="slate">About the same</Badge>;
  return <Badge color="slate">Not enough data yet</Badge>;
}

function headline(deltas: MetricDelta[]): string {
  const strong = deltas.find((d) => d.metric === "strong_rate");
  if (strong?.direction === "improved") {
    return "You are giving more strong answers than when you started. Keep it up.";
  }
  const improved = deltas.filter((d) => d.direction === "improved").map((d) => d.label.toLowerCase());
  if (improved.length) return `You are improving on ${improved.slice(0, 2).join(" and ")}. Keep it up.`;
  if (deltas.some((d) => d.direction === "slipped")) {
    return "A few things dipped recently. A little focused practice will bring them back.";
  }
  return "Keep practising to build a clearer picture of your progress.";
}

function MetricRow({ delta, points }: { delta: MetricDelta; points: TrendPoint[] }) {
  const meta = META[delta.metric];
  return (
    <div className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="font-medium text-slate-900">{delta.label}</span>
          <DirectionBadge direction={delta.direction} />
        </div>
        {delta.latest != null && (
          <span className="text-sm text-slate-500">
            Latest <span className="font-semibold text-slate-800">{meta.format(delta.latest)}</span>
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {meta.what} {meta.tip}
      </p>
      {points.length >= 2 ? (
        <div className="mt-3">
          <TrendChart
            label={delta.label}
            points={points}
            format={meta.format}
            goodLow={delta.good_low}
            goodHigh={delta.good_high}
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Do another interview to see this as a trend.</p>
      )}
    </div>
  );
}

export default function Progress() {
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [summarising, setSummarising] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    (async () => {
      const [rep, stored] = await Promise.all([
        getProgress().catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          return null;
        }),
        readProgressSummary().catch(() => ({ summary: "" })),
      ]);
      if (rep) setReport(rep);
      setLoading(false);
      // Show the saved summary if there is one, so it persists across logins. If it is
      // empty (never generated, or cleared because the interview history changed), generate
      // a fresh one now so the page stays current without a manual click.
      if (stored.summary) setSummary(stored.summary);
      else if (rep && rep.totals.interviews > 0) summarise();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function summarise() {
    setSummarising(true);
    setSummaryError("");
    try {
      setSummary((await generateProgressSummary()).summary);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : String(err));
    } finally {
      setSummarising(false);
    }
  }

  if (loading) return <Loading label="Loading your progress" />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!report) return null;

  if (report.totals.interviews === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Progress</h1>
        <Card className="mt-6">
          <CardBody className="text-center">
            <p className="text-slate-700">You have not done any interviews yet.</p>
            <p className="mt-1 text-sm text-slate-500">
              Do your first mock interview and your progress will start to build here.
            </p>
            <div className="mt-5 flex justify-center">
              <Link to="/interview">
                <Button>Start a mock interview</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const { totals, sessions, deltas } = report;
  const deltaFor = (metric: string) => deltas.find((d) => d.metric === metric);
  const pointsFor = (metric: string): TrendPoint[] =>
    sessions
      .map((s) => ({ label: formatDate(s.created_at), value: s[ATTR[metric]] as number | null }))
      .filter((p): p is TrendPoint => p.value != null);

  // A gentle weekly practice goal for momentum. Sample runs are already excluded from
  // the report, so only real interviews count here.
  const WEEKLY_GOAL = 3;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = sessions.filter((s) => new Date(s.created_at).getTime() >= weekAgo).length;

  const anyDelivery = sessions.some((s) => s.has_delivery);
  const anyNonverbal = sessions.some((s) => s.has_nonverbal);

  // Self-rated confidence, averaged across the interviews the student rated.
  const avgOf = (get: (s: SessionStats) => number | null): number | null => {
    const vals = sessions.map(get).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const avgConfidenceBefore = avgOf((s) => s.confidence_before);
  const avgConfidenceAfter = avgOf((s) => s.confidence_after);
  const anyVerdicts = sessions.some(
    (s) => s.verdicts.strong + s.verdicts.adequate + s.verdicts.weak > 0,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Progress</h1>
        <p className="mt-1 text-sm text-slate-500">{headline(deltas)}</p>
      </div>

      {/* On-demand coach summary of the trends below */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Coach summary</CardTitle>
            <Button variant="secondary" size="sm" onClick={summarise} loading={summarising}>
              {summary ? "Regenerate" : "Summarise my progress"}
            </Button>
          </div>
          {summaryError && <p role="alert" className="mt-3 text-sm text-red-600">{summaryError}</p>}
          {summary ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{summary}</p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Get a short, plain-language read of how your practice is going and what to focus on next.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "Interviews", value: totals.interviews },
          { label: "Questions answered", value: totals.questions_answered },
          { label: "Minutes practised", value: totals.minutes_practised },
        ].map((t) => (
          <Card key={t.label}>
            <CardBody className="text-center">
              <p className="text-2xl font-semibold text-slate-900">{t.value}</p>
              <p className="mt-1 text-xs text-slate-500">{t.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* A light weekly goal for momentum */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>This week</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {thisWeek >= WEEKLY_GOAL
                  ? "You have hit your practice goal this week. Nicely done."
                  : `${thisWeek} of ${WEEKLY_GOAL} interviews this week. ${
                      WEEKLY_GOAL - thisWeek
                    } to go.`}
              </p>
            </div>
            <span className="text-sm font-semibold text-slate-800">
              {Math.min(thisWeek, WEEKLY_GOAL)}/{WEEKLY_GOAL}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${Math.min(thisWeek / WEEKLY_GOAL, 1) * 100}%` }}
            />
          </div>
        </CardBody>
      </Card>

      {avgConfidenceAfter != null && (
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-2.5">
              <CardTitle>Confidence</CardTitle>
              {avgConfidenceBefore != null && (
                <DirectionBadge
                  direction={
                    avgConfidenceAfter > avgConfidenceBefore + 0.1
                      ? "improved"
                      : avgConfidenceAfter < avgConfidenceBefore - 0.1
                        ? "slipped"
                        : "steady"
                  }
                />
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              How confident you have felt, self-rated out of 5. Nerves usually settle with practice.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-10">
              {avgConfidenceBefore != null && (
                <div>
                  <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                    {avgConfidenceBefore.toFixed(1)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">before, on average</p>
                </div>
              )}
              <div>
                <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                  {avgConfidenceAfter.toFixed(1)}
                </p>
                <p className="mt-1 text-xs text-slate-500">after, on average</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {GROUPS.map((group) => {
        if (group.needs === "delivery" && !anyDelivery) return null;
        if (group.needs === "nonverbal" && !anyNonverbal) return null;
        const rows = group.metrics.map(deltaFor).filter((d): d is MetricDelta => Boolean(d));
        const isAnswerQuality = group.title === "Answer quality";
        if (rows.length === 0 && !isAnswerQuality) return null;

        return (
          <Card key={group.title}>
            <CardBody>
              <CardTitle>{group.title}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">{group.note}</p>
              <div className="mt-4 space-y-4">
                {rows.map((delta) => (
                  <MetricRow key={delta.metric} delta={delta} points={pointsFor(delta.metric)} />
                ))}
                {isAnswerQuality && anyVerdicts && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-3 text-sm font-medium text-slate-700">Answers per interview</p>
                    <VerdictBars
                      rows={sessions.map((s) => ({ label: formatDate(s.created_at), verdicts: s.verdicts }))}
                    />
                  </div>
                )}
                {isAnswerQuality && !anyVerdicts && (
                  <p className="text-sm text-slate-500">
                    Finish an interview to see how your answers were rated.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        );
      })}

      {/* Focus areas and strengths, with a loop back into practice */}
      {(report.focus_areas.length > 0 || report.strengths.length > 0) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {report.focus_areas.length > 0 && (
            <Card>
              <CardBody>
                <CardTitle>Keep working on</CardTitle>
                <ul className="mt-3 space-y-2">
                  {report.focus_areas.map((item, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center gap-3">
                  <Link to="/interview" state={{ focus: "gaps" }}>
                    <Button size="sm">Practise these</Button>
                  </Link>
                  <Link to="/prepare" className="text-sm font-medium text-brand-700 hover:underline">
                    Revisit Prepare
                  </Link>
                </div>
              </CardBody>
            </Card>
          )}
          {report.strengths.length > 0 && (
            <Card>
              <CardBody>
                <CardTitle>You do this well</CardTitle>
                <ul className="mt-3 space-y-2">
                  {report.strengths.map((item, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
