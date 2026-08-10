import { render, screen } from "@testing-library/react";
import { type DeliveryMetrics } from "../api";
import AnswerTimeline from "./AnswerTimeline";

function metrics(overrides: Partial<DeliveryMetrics> = {}): DeliveryMetrics {
  return {
    duration_sec: 120,
    word_count: 200,
    wpm: 100,
    pause_count: 0,
    long_pause_count: 0,
    total_pause_sec: 0,
    filler_count: 0,
    fillers: {},
    pauses: [],
    filler_events: [],
    ...overrides,
  };
}

describe("AnswerTimeline", () => {
  it("lists pauses and fillers at their timestamps", () => {
    render(
      <AnswerTimeline
        metrics={metrics({
          pauses: [{ start: 34, end: 36.1, long: true }],
          filler_events: [{ time: 12, text: "um" }],
        })}
      />,
    );
    // events are ordered by time: the filler at 0:12 comes before the pause at 0:34
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("0:12");
    expect(items[0]).toContain('filler "um"');
    expect(items[1]).toContain("0:34");
    expect(items[1]).toContain("long pause");
  });

  it("hides the decorative bar from assistive tech", () => {
    const { container } = render(
      <AnswerTimeline metrics={metrics({ filler_events: [{ time: 5, text: "like" }] })} />,
    );
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders nothing when there are no events", () => {
    const { container } = render(<AnswerTimeline metrics={metrics()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
