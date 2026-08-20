import { render, screen } from "@testing-library/react";
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
});
