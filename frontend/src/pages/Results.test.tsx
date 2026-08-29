import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InterviewDetail } from "../api";

const mocks = vi.hoisted(() => ({
  getInterview: vi.fn(),
  regenerateFeedback: vi.fn(),
  saveReflection: vi.fn(),
}));

vi.mock("../api", () => ({
  getInterview: mocks.getInterview,
  regenerateFeedback: mocks.regenerateFeedback,
  saveReflection: mocks.saveReflection,
}));

import Results from "./Results";

const detail: InterviewDetail = {
  status: "finished",
  mode: "text",
  interview_type: "general",
  focus: "balanced",
  company: "Northwind Analytics",
  role: "Graduate Software Engineer",
  feedback: {
    summary: "A solid, well-structured interview.",
    strengths: ["Clear examples"],
    improvements: ["Quantify outcomes"],
    answer_notes: [],
    delivery: "Steady pace, few fillers.",
  },
  reflection: "",
  turns: [
    { role: "assistant", kind: "question", content: "Tell me about yourself.", metrics: null, nonverbal: null },
    { role: "user", kind: "answer", content: "I am a final-year student.", metrics: null, nonverbal: null },
  ],
};

function renderResults() {
  return render(
    <MemoryRouter initialEntries={["/results/1"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/results/:id" element={<Results />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
});

describe("Results", () => {
  it("prints the report when Save as PDF is used", async () => {
    mocks.getInterview.mockResolvedValue(detail);
    const print = vi.fn();
    vi.stubGlobal("print", print);

    renderResults();

    const button = await screen.findByRole("button", { name: "Save as PDF" });
    await userEvent.click(button);
    expect(print).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it("shows a print-only dateline for the record", async () => {
    mocks.getInterview.mockResolvedValue(detail);
    renderResults();
    expect(await screen.findByText(/Report printed on/)).toBeInTheDocument();
  });

  it("points a student with weak answers back to their preparation plan", async () => {
    mocks.getInterview.mockResolvedValue({
      ...detail,
      feedback: {
        ...detail.feedback!,
        answer_notes: [{ question: "Q", verdict: "weak", comment: "Vague.", model_answer: "" }],
      },
    });
    renderResults();
    expect(await screen.findByText(/rated weak or adequate/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review your weak spots" })).toBeInTheDocument();
  });

  it("saves a reflection note", async () => {
    mocks.getInterview.mockResolvedValue(detail);
    mocks.saveReflection.mockResolvedValue({ ok: true });
    renderResults();

    const box = await screen.findByLabelText("Your reflection");
    await userEvent.type(box, "Give a specific example next time.");
    await userEvent.click(screen.getByRole("button", { name: "Save reflection" }));
    expect(mocks.saveReflection).toHaveBeenCalledWith(1, "Give a specific example next time.");
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("congratulates a strong interview instead of flagging gaps", async () => {
    mocks.getInterview.mockResolvedValue({
      ...detail,
      feedback: {
        ...detail.feedback!,
        answer_notes: [{ question: "Q", verdict: "strong", comment: "Great.", model_answer: "" }],
      },
    });
    renderResults();
    expect(await screen.findByText(/Strong across the board/)).toBeInTheDocument();
    expect(screen.queryByText(/rated weak or adequate/)).not.toBeInTheDocument();
  });
});
