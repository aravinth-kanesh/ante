import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getProgress, type SessionStats } from "../api";
import { Badge, Card, CardBody, CardTitle, ErrorNote, Loading, Select } from "../components/ui";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type Direction = "higher" | "lower" | "none";

const METRICS: {
  key: keyof SessionStats;
  label: string;
  better: Direction;
  format: (v: number) => string;
}[] = [
  { key: "strong_rate", label: "Answers rated strong", better: "higher", format: (v) => `${Math.round(v * 100)}%` },
  { key: "avg_wpm", label: "Speaking pace", better: "none", format: (v) => `${Math.round(v)} wpm` },
  { key: "filler_per_min", label: "Filler words", better: "lower", format: (v) => `${v.toFixed(1)} a min` },
  { key: "eye_contact_pct", label: "Eye contact", better: "higher", format: (v) => `${Math.round(v)}%` },
  { key: "head_steadiness", label: "Composure", better: "higher", format: (v) => `${Math.round(v)}/100` },
];

function Change({ a, b, better }: { a: number; b: number; better: Direction }) {
  if (better === "none" || a === b) return <Badge color="slate">No change</Badge>;
  const up = b > a;
  const improved = better === "higher" ? up : !up;
  return improved ? <Badge color="green">Improved</Badge> : <Badge color="amber">Slipped</Badge>;
}

export default function Compare() {
  const [sessions, setSessions] = useState<SessionStats[] | null>(null);
  const [error, setError] = useState("");
  const [aId, setAId] = useState<number | null>(null);
  const [bId, setBId] = useState<number | null>(null);

  useEffect(() => {
    getProgress()
      .then((report) => {
        setSessions(report.sessions);
        if (report.sessions.length >= 2) {
          // Default to the first and most recent, to show change over time.
          setAId(report.sessions[0].session_id);
          setBId(report.sessions[report.sessions.length - 1].session_id);
        }
      })
      .catch((err) => setError(message(err)));
  }, []);

  const a = useMemo(() => sessions?.find((s) => s.session_id === aId) ?? null, [sessions, aId]);
  const b = useMemo(() => sessions?.find((s) => s.session_id === bId) ?? null, [sessions, bId]);

  const label = (s: SessionStats) => `${s.title} (${formatDate(s.created_at)})`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Compare interviews</h1>
          <p className="mt-1 text-sm text-slate-500">See how two of your interviews stack up.</p>
        </div>
        <Link to="/history" className="text-sm font-medium text-brand-700 hover:underline">
          Interview history
        </Link>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {!error && !sessions && <Loading label="Loading your interviews" />}

      {sessions && sessions.length < 2 && (
        <Card>
          <CardBody className="text-center">
            <p className="text-slate-700">You need at least two finished interviews to compare.</p>
            <p className="mt-1 text-sm text-slate-500">
              Do another <Link to="/interview" className="font-medium text-brand-700 hover:underline">mock interview</Link> and come back.
            </p>
          </CardBody>
        </Card>
      )}

      {sessions && sessions.length >= 2 && a && b && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="First interview" value={aId ?? ""} onChange={(e) => setAId(Number(e.target.value))}>
              {sessions.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {label(s)}
                </option>
              ))}
            </Select>
            <Select label="Second interview" value={bId ?? ""} onChange={(e) => setBId(Number(e.target.value))}>
              {sessions.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {label(s)}
                </option>
              ))}
            </Select>
          </div>

          <Card>
            <CardBody>
              <CardTitle>How they compare</CardTitle>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-2 font-medium">Measure</th>
                      <th className="pb-2 font-medium">First</th>
                      <th className="pb-2 font-medium">Second</th>
                      <th className="pb-2 font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map((m) => {
                      const av = a[m.key] as number | null;
                      const bv = b[m.key] as number | null;
                      if (av == null && bv == null) return null;
                      return (
                        <tr key={m.key} className="border-t border-slate-100">
                          <td className="py-2.5 pr-4 font-medium text-slate-800">{m.label}</td>
                          <td className="py-2.5 pr-4 tabular-nums text-slate-700">
                            {av == null ? "-" : m.format(av)}
                          </td>
                          <td className="py-2.5 pr-4 tabular-nums text-slate-700">
                            {bv == null ? "-" : m.format(bv)}
                          </td>
                          <td className="py-2.5">
                            {av == null || bv == null ? (
                              <span className="text-slate-400">-</span>
                            ) : (
                              <Change a={av} b={bv} better={m.better} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Speaking pace has no better or worse direction; a comfortable range is about 110 to
                160 words a minute.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
