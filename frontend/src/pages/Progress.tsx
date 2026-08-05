import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getProgress,
  type MetricDelta,
  type ProgressReport,
  type SessionStats,
  type TrendDirection,
} from "../api";
import TrendChart, { VerdictBars, type TrendPoint } from "../components/TrendChart";
import { Badge, Button, Card, CardBody, CardTitle } from "../components/ui";

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
          <TrendChart points={points} format={meta.format} goodLow={delta.good_low} goodHigh={delta.good_high} />
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Do another interview to see this as a trend.</p>
      )}
    </div>
  );
}

export default function Progress() {
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getProgress()
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading your progress...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
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

  const anyDelivery = sessions.some((s) => s.has_delivery);
  const anyNonverbal = sessions.some((s) => s.has_nonverbal);
  const anyVerdicts = sessions.some(
    (s) => s.verdicts.strong + s.verdicts.adequate + s.verdicts.weak > 0,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Progress</h1>
        <p className="mt-1 text-sm text-slate-500">{headline(deltas)}</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
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
