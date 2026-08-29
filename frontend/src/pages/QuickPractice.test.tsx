import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPracticeQuestion: vi.fn(),
  submitPracticeAnswer: vi.fn(),
}));

vi.mock("../api", () => ({
  getPracticeQuestion: mocks.getPracticeQuestion,
  submitPracticeAnswer: mocks.submitPracticeAnswer,
}));

import QuickPractice from "./QuickPractice";

function renderPractice(state?: { question: string }) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/practice", state }]}
    >
      <QuickPractice />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.getPracticeQuestion.mockReset();
  mocks.submitPracticeAnswer.mockReset();
});

describe("QuickPractice", () => {
  it("shows a question and returns instant feedback on an answer", async () => {
    mocks.getPracticeQuestion.mockResolvedValue({ question: "Why do you want this role?" });
    mocks.submitPracticeAnswer.mockResolvedValue({
      question: "Why do you want this role?",
      verdict: "weak",
      comment: "Too generic; give a concrete reason.",
      model_answer: "I want this role because I have built X and want to do more of it here.",
    });

    renderPractice();
    expect(await screen.findByText("Why do you want this role?")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Your answer"), "Because it sounds interesting.");
    await userEvent.click(screen.getByRole("button", { name: "Get feedback" }));

    expect(mocks.submitPracticeAnswer).toHaveBeenCalledWith(
      "Why do you want this role?",
      "Because it sounds interesting.",
    );
    expect(await screen.findByText("Weak")).toBeInTheDocument();
    expect(screen.getByText(/give a concrete reason/)).toBeInTheDocument();
    expect(screen.getByText("How a strong answer might sound")).toBeInTheDocument();
  });

  it("loads a fresh question, excluding the current one", async () => {
    mocks.getPracticeQuestion.mockResolvedValue({ question: "Tell me about yourself." });
    renderPractice();
    await screen.findByText("Tell me about yourself.");
    await userEvent.click(screen.getByRole("button", { name: "Try another question" }));
    expect(mocks.getPracticeQuestion).toHaveBeenLastCalledWith("Tell me about yourself.");
  });

  it("redoes a specific question handed in from a past interview", async () => {
    renderPractice({ question: "Tell me about a time you led a team." });
    // it uses the seeded question without fetching a new one
    expect(await screen.findByText("Tell me about a time you led a team.")).toBeInTheDocument();
    expect(mocks.getPracticeQuestion).not.toHaveBeenCalled();
  });
});
