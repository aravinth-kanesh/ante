import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The interview page pulls in the API client, capture and voice; stub them so the
// component renders in isolation and we can drive the setup-to-question transition and
// the record-and-submit flow.
const mocks = vi.hoisted(() => ({
  startInterview: vi.fn(),
  answerInterview: vi.fn(),
  finishInterview: vi.fn(),
  transcribeAudio: vi.fn(),
  analyseNonverbal: vi.fn(),
  uploadAnswerMedia: vi.fn(),
  listAnswerMedia: vi.fn(),
  deleteAnswerMedia: vi.fn(),
  startCapture: vi.fn(),
}));

vi.mock("../api", () => ({
  startInterview: mocks.startInterview,
  answerInterview: mocks.answerInterview,
  finishInterview: mocks.finishInterview,
  transcribeAudio: mocks.transcribeAudio,
  analyseNonverbal: mocks.analyseNonverbal,
  getPreparation: vi.fn().mockResolvedValue({ competencies: [] }),
  getPrepQuestions: vi.fn().mockResolvedValue([]),
  uploadAnswerMedia: mocks.uploadAnswerMedia,
  listAnswerMedia: mocks.listAnswerMedia,
  deleteAnswerMedia: mocks.deleteAnswerMedia,
  answerMediaBundleUrl: (sid: number) => `/api/interview/${sid}/media/bundle.zip`,
}));
vi.mock("../capture", () => ({ recordingSupported: () => true, startCapture: mocks.startCapture }));
vi.mock("../voice", () => ({ cancelVoice: vi.fn(), speakText: vi.fn() }));

import Interview from "./Interview";

function renderInterview() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Interview />
    </MemoryRouter>,
  );
}

const emptyMetrics = {
  duration_sec: 5,
  word_count: 3,
  wpm: 36,
  pause_count: 0,
  long_pause_count: 0,
  total_pause_sec: 0,
  filler_count: 0,
  fillers: {},
  pauses: [],
  filler_events: [],
};

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.listAnswerMedia.mockResolvedValue([]);
});

describe("Interview setup", () => {
  it("offers the five-minute length increments, defaulting to 10", () => {
    renderInterview();
    const select = screen.getByLabelText("Length") as HTMLSelectElement;
    expect(select.value).toBe("10");
    expect(screen.getByRole("option", { name: "5 minutes" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "30 minutes" })).toBeInTheDocument();
  });

  it("offers saving recordings but leaves it off by default", () => {
    renderInterview();
    expect(screen.getByRole("checkbox", { name: /Save my answers/ })).not.toBeChecked();
  });

  it("starts a sample interview with no setup", async () => {
    mocks.startInterview.mockResolvedValue({
      session_id: 1,
      question: "Tell me about yourself.",
      mode: "voice",
      duration_target_min: 10,
    });
    renderInterview();
    await userEvent.click(screen.getByRole("button", { name: "Try a sample interview" }));
    expect(mocks.startInterview).toHaveBeenCalledWith("voice", "general", "balanced", 10, "", true);
    expect(await screen.findByText(/sample interview using an example CV/)).toBeInTheDocument();
  });

  it("starts the interview with the chosen length and shows the pacing indicator", async () => {
    mocks.startInterview.mockResolvedValue({
      session_id: 1,
      question: "Tell me about yourself.",
      mode: "voice",
      duration_target_min: 15,
    });
    renderInterview();

    await userEvent.selectOptions(screen.getByLabelText("Length"), "15");
    await userEvent.click(screen.getByRole("button", { name: "Start interview" }));

    expect(mocks.startInterview).toHaveBeenCalledWith("voice", "general", "balanced", 15, "", false);
    expect(await screen.findByText(/about 15 min interview/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stop . get feedback/ })).toBeInTheDocument();
  });
});

describe("Interview recording", () => {
  it("tells the candidate when a recording could not be saved", async () => {
    mocks.startInterview.mockResolvedValue({
      session_id: 1,
      question: "Tell me about yourself.",
      mode: "voice",
      duration_target_min: 10,
    });
    mocks.startCapture.mockResolvedValue({
      stream: {},
      stop: vi.fn().mockResolvedValue({
        audioBlob: new Blob(["a"]),
        samples: [],
        replay: { blob: new Blob(["v"]), hasVideo: false },
      }),
      cancel: vi.fn(),
    });
    mocks.transcribeAudio.mockResolvedValue({ transcript: "my spoken answer", metrics: emptyMetrics });
    mocks.answerInterview.mockResolvedValue({ question: null, done: true });
    mocks.uploadAnswerMedia.mockRejectedValue(new Error("too large"));

    renderInterview();
    await userEvent.click(screen.getByRole("checkbox", { name: /Save my answers/ }));
    await userEvent.click(screen.getByRole("button", { name: "Start interview" }));

    await userEvent.click(await screen.findByRole("button", { name: /Speak answer/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Stop recording" }));
    // once the take is captured the control offers a re-record
    await screen.findByRole("button", { name: /Record again/ });
    await userEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    // the failed upload is surfaced rather than silently dropped
    expect(await screen.findByText(/could not be saved/)).toBeInTheDocument();
  });
});
