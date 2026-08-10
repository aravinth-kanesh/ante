import { useRef, useState } from "react";
import { type DeliveryMetrics } from "../api";
import { cn } from "./ui";

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
 * Play back a saved answer with its delivery highlighted: pauses shaded and filler
 * words marked on a timeline under the video or audio, a playhead that tracks the
 * media, and a list of the moments you can click to jump straight to them. The bar is
 * decorative; the buttons are the accessible way to seek.
 */
export default function AnswerPlayer({
  src,
  hasVideo,
  metrics,
}: {
  src: string;
  hasVideo: boolean;
  metrics: DeliveryMetrics;
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [current, setCurrent] = useState(0);

  const duration = metrics.duration_sec || 0;
  const events: TimelineEvent[] = [
    ...metrics.pauses.map((p) => ({ kind: "pause" as const, time: p.start, end: p.end, long: p.long })),
    ...metrics.filler_events.map((f) => ({ kind: "filler" as const, time: f.time, text: f.text })),
  ].sort((a, b) => a.time - b.time);

  const W = 320;
  const H = 16;
  const x = (t: number) => (duration > 0 ? Math.max(0, Math.min(W, (t / duration) * W)) : 0);

  function seek(time: number) {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = time;
    try {
      void media.play?.();
    } catch {
      /* play may be blocked or unimplemented; seeking is enough */
    }
  }

  function isActive(event: TimelineEvent): boolean {
    if (event.kind === "pause") return current >= event.time && current <= (event.end ?? event.time);
    return current >= event.time && current < event.time + 0.8;
  }

  const setMedia = (el: HTMLVideoElement | HTMLAudioElement | null) => {
    mediaRef.current = el;
  };
  const onTimeUpdate = (e: { currentTarget: HTMLMediaElement }) => setCurrent(e.currentTarget.currentTime);
  const mediaClass = hasVideo
    ? "w-full max-w-sm rounded-xl border border-slate-200 bg-black"
    : "w-full";

  return (
    <figure className="m-0">
      {hasVideo ? (
        <video ref={setMedia} src={src} controls playsInline onTimeUpdate={onTimeUpdate} className={mediaClass} />
      ) : (
        <audio ref={setMedia} src={src} controls onTimeUpdate={onTimeUpdate} className={mediaClass} />
      )}

      {events.length > 0 && duration > 0 && (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-2 h-auto w-full cursor-pointer"
            aria-hidden="true"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - rect.left) / rect.width) * duration);
            }}
          >
            <rect x={0} y={H / 2 - 1.5} width={W} height={3} rx={1.5} className="fill-slate-200" />
            {metrics.pauses.map((p, i) => (
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
            {metrics.filler_events.map((f, i) => (
              <circle key={`f${i}`} cx={x(f.time)} cy={H / 2} r={3.5} className="fill-amber-500" />
            ))}
            <line
              x1={x(current)}
              y1={0}
              x2={x(current)}
              y2={H}
              className="stroke-brand-600"
              strokeWidth={1.5}
            />
          </svg>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {events.map((e, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => seek(e.time)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs transition-colors",
                    isActive(e) ? "ring-2 ring-brand-400" : "",
                    e.kind === "filler"
                      ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  <span className="font-medium">{formatTime(e.time)}</span>{" "}
                  {e.kind === "filler"
                    ? `filler "${e.text}"`
                    : `${e.long ? "long pause" : "pause"} ${((e.end ?? e.time) - e.time).toFixed(1)}s`}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </figure>
  );
}
