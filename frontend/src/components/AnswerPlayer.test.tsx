import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type DeliveryMetrics } from "../api";
import AnswerPlayer from "./AnswerPlayer";

function metrics(overrides: Partial<DeliveryMetrics> = {}): DeliveryMetrics {
  return {
    duration_sec: 60,
    word_count: 100,
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

describe("AnswerPlayer", () => {
  it("plays audio and lists seekable events", async () => {
    const { container } = render(
      <AnswerPlayer
        src="blob:answer"
        hasVideo={false}
        metrics={metrics({
          pauses: [{ start: 20, end: 22, long: false }],
          filler_events: [{ time: 8, text: "um" }],
        })}
      />,
    );
    expect(container.querySelector("audio")).toBeInTheDocument();
    // one seek button per event, ordered by time
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("0:08");
    expect(buttons[0]).toHaveTextContent('filler "um"');
    expect(buttons[1]).toHaveTextContent("0:20");
    // clicking seeks the media rather than throwing
    const audio = container.querySelector("audio") as HTMLAudioElement;
    await userEvent.click(buttons[1]);
    expect(audio.currentTime).toBe(20);
  });

  it("uses a video element when the answer has video", () => {
    const { container } = render(<AnswerPlayer src="blob:v" hasVideo metrics={metrics()} />);
    expect(container.querySelector("video")).toBeInTheDocument();
  });
});
