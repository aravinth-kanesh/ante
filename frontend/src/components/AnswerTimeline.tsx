import { type DeliveryMetrics } from "../api";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

interface TimelineEvent {
  kind: "pause" | "filler";
  time: number;
  end?: number;
  long?: boolean;
  text?: string;
}

/**
 * A compact, annotated timeline of an answer: pauses shaded and filler words marked
 * along a bar scaled to the answer's length, with a readable list of the same events
 * beneath it. The bar is decorative (hidden from assistive tech); the list is the
 * accessible form and works even when the recording itself is no longer available.
 */
export default function AnswerTimeline({ metrics }: { metrics: DeliveryMetrics }) {
  const { duration_sec, pauses, filler_events } = metrics;
  const events: TimelineEvent[] = [
    ...pauses.map((p) => ({ kind: "pause" as const, time: p.start, end: p.end, long: p.long })),
    ...filler_events.map((f) => ({ kind: "filler" as const, time: f.time, text: f.text })),
  ].sort((a, b) => a.time - b.time);

  if (events.length === 0 || duration_sec <= 0) return null;

  const W = 320;
  const H = 16;
  const x = (t: number) => Math.max(0, Math.min(W, (t / duration_sec) * W));

  return (
    <figure className="m-0 mt-2">
      <figcaption className="text-xs font-medium text-slate-600">Pauses and filler words</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-auto w-full" aria-hidden="true">
        <rect x={0} y={H / 2 - 1.5} width={W} height={3} rx={1.5} className="fill-slate-200" />
        {pauses.map((p, i) => (
          <rect
            key={`p${i}`}
            x={x(p.start)}
            y={H / 2 - 4}
            width={Math.max(2, x(p.end) - x(p.start))}
            height={8}
            rx={2}
            className={p.long ? "fill-slate-500" : "fill-slate-400"}
          />
        ))}
        {filler_events.map((f, i) => (
          <circle key={`f${i}`} cx={x(f.time)} cy={H / 2} r={3.5} className="fill-amber-500" />
        ))}
      </svg>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        {events.map((e, i) =>
          e.kind === "filler" ? (
            <li key={i}>
              <span className="font-medium text-amber-700">{formatTime(e.time)}</span> filler "{e.text}"
            </li>
          ) : (
            <li key={i}>
              <span className="font-medium text-slate-700">{formatTime(e.time)}</span>{" "}
              {e.long ? "long pause" : "pause"} {((e.end ?? e.time) - e.time).toFixed(1)}s
            </li>
          ),
        )}
      </ul>
    </figure>
  );
}
