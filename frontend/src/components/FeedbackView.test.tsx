import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type AnswerNote, type FeedbackReport } from "../api";
import FeedbackView from "./FeedbackView";

function report(notes: AnswerNote[]): FeedbackReport {
  return { summary: "Overall ok.", strengths: [], improvements: [], answer_notes: notes, delivery: "" };
}

describe("FeedbackView", () => {
  it("shows the model answer for a weak answer", () => {
    render(
      <FeedbackView
        report={report([
          {
            question: "About you",
            verdict: "weak",
            comment: "Too vague.",
            model_answer: "In my final-year project I led a team of four and delivered on time.",
          },
        ])}
      />,
    );
    expect(screen.getByText("How a strong answer might sound")).toBeInTheDocument();
    expect(screen.getByText(/led a team of four/)).toBeInTheDocument();
  });

  it("omits the model-answer box when there is none", () => {
    render(
      <FeedbackView
        report={report([{ question: "About you", verdict: "strong", comment: "Great.", model_answer: "" }])}
      />,
    );
    expect(screen.queryByText("How a strong answer might sound")).not.toBeInTheDocument();
  });

  it("summarises the interview at a glance from the answer verdicts", () => {
    const note = (verdict: AnswerNote["verdict"]): AnswerNote => ({
      question: "Q",
      verdict,
      comment: "c",
      model_answer: "",
    });
    const r = report([note("strong"), note("strong"), note("adequate")]);
    r.improvements = ["Quantify your outcomes with numbers."];
    render(<FeedbackView report={r} />);
    expect(screen.getByText("Strong overall")).toBeInTheDocument();
    expect(screen.getByText(/2 strong, 1 adequate, 0 weak across 3 answers/)).toBeInTheDocument();
    // the single most important next step is surfaced up top as well as in the list below
    expect(screen.getByText("Focus next on:")).toBeInTheDocument();
    expect(screen.getAllByText(/Quantify your outcomes/).length).toBeGreaterThan(0);
  });

  it("flags an interview that needs more work", () => {
    const weak: AnswerNote = { question: "Q", verdict: "weak", comment: "c", model_answer: "" };
    render(<FeedbackView report={report([weak, weak])} />);
    expect(screen.getByText("Needs more work")).toBeInTheDocument();
  });
});
