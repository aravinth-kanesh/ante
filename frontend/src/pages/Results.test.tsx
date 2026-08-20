import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InterviewDetail } from "../api";

const mocks = vi.hoisted(() => ({
  getInterview: vi.fn(),
  regenerateFeedback: vi.fn(),
}));

vi.mock("../api", () => ({
  getInterview: mocks.getInterview,
  regenerateFeedback: mocks.regenerateFeedback,
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
});
