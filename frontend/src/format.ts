// Shared, human-readable summaries of the measured delivery and nonverbal
// metrics, used by both the live interview and the results page so the wording
// stays identical.

import type { DeliveryMetrics, NonverbalMetrics } from "./api";

export function deliverySummary(m: DeliveryMetrics): string {
  if (m.word_count === 0) return "No speech detected.";
  const parts = [`≈${m.wpm} words/min over ${Math.round(m.duration_sec)}s`];
  if (m.pause_count) {
    parts.push(`${m.pause_count} pause${m.pause_count === 1 ? "" : "s"}`);
  }
  if (m.filler_count) {
    const top = Object.entries(m.fillers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word, count]) => `${word} x${count}`)
      .join(", ");
    parts.push(`${m.filler_count} filler${m.filler_count === 1 ? "" : "s"} (${top})`);
  }
  return parts.join(" · ");
}

export function nonverbalSummary(m: NonverbalMetrics): string {
  if (!m.face_detected) return "No face detected on camera.";
  const parts = [`eye contact ${m.eye_contact_pct}%`, `${m.steadiness_label} head`];
  if (m.posture_pct !== null) parts.push(`level posture ${m.posture_pct}%`);
  if (m.smile_pct !== null) parts.push(`smiled ${m.smile_pct}%`);
  return parts.join(" · ");
}
