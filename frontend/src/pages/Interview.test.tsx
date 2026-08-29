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
  getActiveInterview: vi.fn(),
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
  getActiveInterview: mocks.getActiveInterview,
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
  mocks.getActiveInterview.mockResolvedValue(null);
  sessionStorage.clear();
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

  it("shows approach tips that follow the chosen interview type", async () => {
    renderInterview();
    expect(screen.getByText("How to approach this interview")).toBeInTheDocument();
    // the general default advises having a few adaptable stories ready
    expect(screen.getByText(/two or three strong stories/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Interview type"), "competency");
    expect(screen.getByText(/centre the Action on what you personally did/)).toBeInTheDocument();
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

  it("offers to resume an unfinished interview and rehydrates it", async () => {
    mocks.getActiveInterview.mockResolvedValue({
      session_id: 7,
      mode: "text",
      interview_type: "general",
      duration_target_min: 10,
      is_sample: false,
      question: "Where do you see yourself in five years?",
      history: [{ question: "Tell me about yourself.", answer: "I am a final-year student." }],
    });
    renderInterview();
    await userEvent.click(await screen.findByRole("button", { name: "Resume interview" }));
    // the current question and the already-answered exchange are both restored
    expect(await screen.findByText("Where do you see yourself in five years?")).toBeInTheDocument();
    expect(screen.getByText("Tell me about yourself.")).toBeInTheDocument();
    expect(mocks.startInterview).not.toHaveBeenCalled();
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
    expect(await screen.findByText(/about 15 min, roughly 6 questions/)).toBeInTheDocument();
    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stop . get feedback/ })).toBeInTheDocument();
  });
});

describe("Interview answering", () => {
  it("offers a STAR structure reminder during the interview", async () => {
    mocks.startInterview.mockResolvedValue({
      session_id: 1,
      question: "Tell me about a time you led a team.",
      mode: "voice",
      duration_target_min: 10,
    });
    renderInterview();
    await userEvent.click(screen.getByRole("button", { name: "Start interview" }));
    expect(await screen.findByText("Structure your answer (STAR)")).toBeInTheDocument();
  });

  it("submits a typed answer with ctrl+enter", async () => {
    mocks.startInterview.mockResolvedValue({
      session_id: 1,
      question: "Q1",
      mode: "voice",
      duration_target_min: 10,
    });
    mocks.answerInterview.mockResolvedValue({ question: "Q2", done: false });
    renderInterview();
    await userEvent.click(screen.getByRole("button", { name: "Start interview" }));

    const box = await screen.findByLabelText("Your answer");
    await userEvent.type(box, "My structured answer.");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");

    expect(mocks.answerInterview).toHaveBeenCalledWith(1, "My structured answer.", null, null);
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
