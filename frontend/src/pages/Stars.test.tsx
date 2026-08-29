import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StarStory } from "../api";

const mocks = vi.hoisted(() => ({
  listStarStories: vi.fn(),
  createStarStory: vi.fn(),
  updateStarStory: vi.fn(),
  deleteStarStory: vi.fn(),
}));

vi.mock("../api", () => ({
  listStarStories: mocks.listStarStories,
  createStarStory: mocks.createStarStory,
  updateStarStory: mocks.updateStarStory,
  deleteStarStory: mocks.deleteStarStory,
}));

import Stars from "./Stars";

const story: StarStory = {
  id: 1,
  title: "Leading the group project",
  situation: "Final-year project",
  task: "Deliver in eight weeks",
  action: "I coordinated the plan",
  result: "Delivered on time",
  updated_at: "2026-08-29T10:00:00Z",
};

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
});

describe("Stars", () => {
  it("creates a new STAR story", async () => {
    mocks.listStarStories.mockResolvedValue([]);
    mocks.createStarStory.mockResolvedValue(story);
    render(<Stars />);
    await screen.findByText(/No stories yet/);

    await userEvent.type(screen.getByLabelText("Title"), "Leading the group project");
    await userEvent.type(screen.getByLabelText("Action"), "I coordinated the plan");
    await userEvent.click(screen.getByRole("button", { name: "Save story" }));

    expect(mocks.createStarStory).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Leading the group project", action: "I coordinated the plan" }),
    );
    expect(await screen.findByText("Leading the group project")).toBeInTheDocument();
  });

  it("deletes a story after confirming", async () => {
    mocks.listStarStories.mockResolvedValue([story]);
    mocks.deleteStarStory.mockResolvedValue({ ok: true });
    render(<Stars />);
    await screen.findByText("Leading the group project");

    // the first Delete asks to confirm, the second carries it out
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(mocks.deleteStarStory).toHaveBeenCalledWith(1);
  });
});
