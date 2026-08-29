import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPrepQuestions: vi.fn(), navigate: vi.fn() }));

vi.mock("../api", () => ({ getPrepQuestions: mocks.getPrepQuestions }));
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

import QuestionBank from "./QuestionBank";

function renderBank() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QuestionBank />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.getPrepQuestions.mockReset();
  mocks.navigate.mockReset();
});

describe("QuestionBank", () => {
  it("practises a curated question, seeding it into quick practice", async () => {
    mocks.getPrepQuestions.mockResolvedValue([]);
    renderBank();

    const row = (await screen.findByText("Tell me about yourself.")).closest("li") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Practise" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/practice", {
      state: { question: "Tell me about yourself." },
    });
  });

  it("shows the student's own likely questions when they have them", async () => {
    mocks.getPrepQuestions.mockResolvedValue([
      { category: "Teamwork", questions: [{ question: "Tell me about a team you led.", rationale: "" }] },
    ]);
    renderBank();
    expect(await screen.findByText("Your likely questions")).toBeInTheDocument();
    expect(screen.getByText("Tell me about a team you led.")).toBeInTheDocument();
  });
});
