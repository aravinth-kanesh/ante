import { type Verdicts } from "../api";

export interface TrendPoint {
  label: string; // x-axis label (a date)
  value: number;
}

/**
 * A small, self-contained line chart for one metric across interviews. It shades the
 * "good" range for context, marks each interview, and directly labels only the first
 * and latest points. No charting library: it is plain SVG so the build stays light.
 */
export default function TrendChart({
  points,
  format,
  goodLow,
  goodHigh,
  label,
}: {
  points: TrendPoint[];
  format: (v: number) => string;
  goodLow?: number | null;
  goodHigh?: number | null;
  label: string;
}) {
  if (points.length === 0) return null;
  const W = 320;
  const H = 128;
  const padX = 30;
  const padTop = 16;
  const padBottom = 24;

  const values = points.map((p) => p.value);
  // Scale the axis to the data so the line always uses most of the height and
  // stays the focus. The "good" range may only pull the axis so far: a target far
  // from the current level (say aiming for 50% strong when you are on 20%) never
  // squashes the line into a sliver.
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const maxSpan = (hi - lo) / 0.55; // the data keeps at least this share of the height
  for (const bound of [goodLow, goodHigh]) {
    if (bound == null) continue;
    if (bound > hi) hi = Math.min(bound, lo + maxSpan);
    if (bound < lo) lo = Math.max(bound, hi - maxSpan);
  }
  const pad = (hi - lo) * 0.12 || 1;
  lo -= pad;
  hi += pad;

  const plotTop = padTop;
  const plotBottom = H - padBottom;
  const x = (i: number) =>
    points.length === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (points.length - 1);
  const y = (v: number) => padTop + (H - padTop - padBottom) * (1 - (v - lo) / (hi - lo));
  const inView = (v: number) => v >= lo && v <= hi;
  const clampY = (v: number) => Math.max(plotTop, Math.min(plotBottom, v));

  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  // The good range as a faint band clipped to the plot, with a dashed edge on
  // whichever boundaries are in view. A solid filled block was too heavy and
  // pulled the eye away from the line.
  let band: { top: number; bottom: number } | null = null;
  if (goodLow != null && goodHigh != null) {
    const top = clampY(y(goodHigh));
    const bottom = clampY(y(goodLow));
    if (bottom - top > 1) band = { top, bottom };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const summary =
    points.length > 1
      ? `${label}: from ${format(first.value)} on ${first.label} to ${format(last.value)} on ${last.label}, across ${points.length} interviews.`
      : `${label}: ${format(first.value)} on ${first.label}.`;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true">
      {band && (
        <rect x={0} y={band.top} width={W} height={band.bottom - band.top} className="fill-green-500" opacity={0.08} />
      )}
      {goodLow != null && inView(goodLow) && (
        <line
          x1={0}
          y1={y(goodLow)}
          x2={W}
          y2={y(goodLow)}
          className="stroke-green-500"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.7}
        />
      )}
      {goodHigh != null && inView(goodHigh) && (
        <line
          x1={0}
          y1={y(goodHigh)}
          x2={W}
          y2={y(goodHigh)}
          className="stroke-green-500"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.7}
        />
      )}
      {/* baseline */}
      <line x1={0} y1={H - padBottom} x2={W} y2={H - padBottom} className="stroke-slate-200" strokeWidth={1} />

      {points.length > 1 && (
        <polyline
          points={line}
          fill="none"
          className="stroke-brand-600"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={4} className="fill-brand-600">
          <title>{`${p.label}: ${format(p.value)}`}</title>
        </circle>
      ))}

      {/* Direct-label the first and latest points only, plus their dates. */}
      {points.map((p, i) => {
        const isEnd = i === 0 || i === points.length - 1;
        if (!isEnd && points.length > 1) return null;
        const anchor = i === 0 && points.length > 1 ? "start" : i === points.length - 1 && points.length > 1 ? "end" : "middle";
        return (
          <g key={`lbl-${i}`}>
            <text
              x={x(i)}
              y={y(p.value) - 9}
              textAnchor={anchor}
              className="fill-slate-700 text-[11px] font-medium"
            >
              {format(p.value)}
            </text>
            <text x={x(i)} y={H - 7} textAnchor={anchor} className="fill-slate-500 text-[10px]">
              {p.label}
            </text>
          </g>
        );
      })}
      </svg>
      {goodLow != null && goodHigh != null && (
        <figcaption className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-4 shrink-0 rounded-[3px] border border-dashed border-green-500 bg-green-100"
          />
          Good range: {format(goodLow)} to {format(goodHigh)}
        </figcaption>
      )}
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">Interview</th>
            <th scope="col">{label}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{p.label}</td>
              <td>{format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const VERDICT_STYLE: { key: keyof Verdicts; label: string; fill: string }[] = [
  { key: "strong", label: "Strong", fill: "bg-green-500" },
  { key: "adequate", label: "Adequate", fill: "bg-amber-400" },
  { key: "weak", label: "Weak", fill: "bg-red-500" },
];

/**
 * One stacked bar per interview showing how many answers were strong / adequate /
 * weak. Colour is backed by a labelled legend and per-segment titles, so the meaning
 * never rests on colour alone.
 */
export function VerdictBars({ rows }: { rows: { label: string; verdicts: Verdicts }[] }) {
  const shown = rows.filter((r) => r.verdicts.strong + r.verdicts.adequate + r.verdicts.weak > 0);
  if (shown.length === 0) return null;

  return (
    <div>
      {/* Visual bars, hidden from assistive tech which reads the table below instead. */}
      <div aria-hidden="true">
        <div className="mb-3 flex flex-wrap gap-4">
          {VERDICT_STYLE.map((v) => (
            <span key={v.key} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-sm ${v.fill}`} />
              {v.label}
            </span>
          ))}
        </div>
        <div className="space-y-2">
          {shown.map((row, i) => {
            const total = row.verdicts.strong + row.verdicts.adequate + row.verdicts.weak;
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs text-slate-500">{row.label}</span>
                <div className="flex h-3 flex-1 gap-0.5 overflow-hidden rounded-sm">
                  {VERDICT_STYLE.map((v) => {
                    const count = row.verdicts[v.key];
                    if (count === 0) return null;
                    return (
                      <div
                        key={v.key}
                        className={v.fill}
                        style={{ width: `${(count / total) * 100}%` }}
                        title={`${v.label}: ${count}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <table className="sr-only">
        <caption>Answers rated strong, adequate or weak per interview.</caption>
        <thead>
          <tr>
            <th scope="col">Interview</th>
            {VERDICT_STYLE.map((v) => (
              <th key={v.key} scope="col">
                {v.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              <th scope="row">{row.label}</th>
              <td>{row.verdicts.strong}</td>
              <td>{row.verdicts.adequate}</td>
              <td>{row.verdicts.weak}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
