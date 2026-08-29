import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedAnswer } from "../api";

const mocks = vi.hoisted(() => ({
  listSavedAnswers: vi.fn(),
  deleteSavedAnswer: vi.fn(),
}));

vi.mock("../api", () => ({
  listSavedAnswers: mocks.listSavedAnswers,
  deleteSavedAnswer: mocks.deleteSavedAnswer,
}));

import SavedAnswers from "./SavedAnswers";

const saved: SavedAnswer = {
  id: 1,
  question: "Why this role?",
  answer: "Because I have built X and want to do more of it here.",
  created_at: "2026-08-29T10:00:00Z",
};

function renderSaved() {
  return render(
    <MemoryRouter>
      <SavedAnswers />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.listSavedAnswers.mockReset();
  mocks.deleteSavedAnswer.mockReset();
});

describe("SavedAnswers", () => {
  it("lists saved answers and removes one", async () => {
    mocks.listSavedAnswers.mockResolvedValue([saved]);
    mocks.deleteSavedAnswer.mockResolvedValue({ ok: true });
    renderSaved();

    expect(await screen.findByText("Why this role?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(mocks.deleteSavedAnswer).toHaveBeenCalledWith(1);
    expect(screen.queryByText("Why this role?")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing is saved", async () => {
    mocks.listSavedAnswers.mockResolvedValue([]);
    renderSaved();
    expect(await screen.findByText(/Nothing saved yet/)).toBeInTheDocument();
  });
});
