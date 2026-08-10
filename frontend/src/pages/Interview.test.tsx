import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The interview page pulls in the API client, capture and voice; stub them so the
// component renders in isolation and we can drive the setup-to-question transition.
const startInterview = vi.fn();
vi.mock("../api", () => ({
  startInterview: (...args: unknown[]) => startInterview(...args),
  answerInterview: vi.fn(),
  finishInterview: vi.fn(),
  transcribeAudio: vi.fn(),
  analyseNonverbal: vi.fn(),
  getPreparation: vi.fn().mockResolvedValue({ competencies: [] }),
  getPrepQuestions: vi.fn().mockResolvedValue([]),
  uploadAnswerMedia: vi.fn(),
  deleteAnswerMedia: vi.fn(),
  answerMediaBundleUrl: (sid: number) => `/api/interview/${sid}/media/bundle.zip`,
}));
vi.mock("../capture", () => ({
  recordingSupported: () => true,
  startCapture: vi.fn(),
}));
vi.mock("../voice", () => ({ cancelVoice: vi.fn(), speakText: vi.fn() }));

import Interview from "./Interview";

function renderInterview() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Interview />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  startInterview.mockReset();
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
    const save = screen.getByRole("checkbox", { name: /Save my answers/ });
    expect(save).not.toBeChecked();
  });

  it("starts the interview with the chosen length and shows the pacing indicator", async () => {
    startInterview.mockResolvedValue({
      session_id: 1,
      question: "Tell me about yourself.",
      mode: "voice",
      duration_target_min: 15,
    });
    renderInterview();

    await userEvent.selectOptions(screen.getByLabelText("Length"), "15");
    await userEvent.click(screen.getByRole("button", { name: "Start interview" }));

    // the length is passed through as the fourth argument, with no category focus
    expect(startInterview).toHaveBeenCalledWith("voice", "general", "balanced", 15, "");
    // the active question shows the subtle "about N min" indicator and the stop control
    expect(await screen.findByText(/about 15 min interview/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stop . get feedback/ })).toBeInTheDocument();
  });
});
