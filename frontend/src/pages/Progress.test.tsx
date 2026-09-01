import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProgressReport, SessionStats } from "../api";

const mocks = vi.hoisted(() => ({
  getProgress: vi.fn(),
  readProgressSummary: vi.fn(),
  generateProgressSummary: vi.fn(),
}));

vi.mock("../api", () => ({
  getProgress: mocks.getProgress,
  readProgressSummary: mocks.readProgressSummary,
  generateProgressSummary: mocks.generateProgressSummary,
}));

import Progress from "./Progress";

function session(daysAgo: number): SessionStats {
  return {
    session_id: daysAgo + 1,
    created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    interview_type: "general",
    title: "General Interview",
    answered_count: 1,
    strong_rate: null,
    verdicts: { strong: 0, adequate: 0, weak: 0 },
    avg_wpm: null,
    filler_per_min: null,
    eye_contact_pct: null,
    head_steadiness: null,
    has_delivery: false,
    has_nonverbal: false,
  confidence_before: null,
  confidence_after: null,
  };
}

function report(sessions: SessionStats[]): ProgressReport {
  return {
    totals: { interviews: sessions.length, questions_answered: sessions.length, minutes_practised: 0 },
    sessions,
    deltas: [],
    focus_areas: [],
    strengths: [],
  };
}

function renderProgress() {
  return render(
    <MemoryRouter>
      <Progress />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.getProgress.mockReset();
  mocks.readProgressSummary.mockReset();
  mocks.generateProgressSummary.mockReset();
  mocks.readProgressSummary.mockResolvedValue({ summary: "" });
  mocks.generateProgressSummary.mockResolvedValue({ summary: "A generated summary." });
});

describe("Progress weekly goal", () => {
  it("counts this week's interviews toward the goal", async () => {
    mocks.getProgress.mockResolvedValue(report([session(0), session(1)]));
    renderProgress();
    expect(await screen.findByText("This week")).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 interviews this week/)).toBeInTheDocument();
  });

  it("celebrates hitting the goal and ignores interviews older than a week", async () => {
    mocks.getProgress.mockResolvedValue(report([session(0), session(1), session(2), session(10)]));
    renderProgress();
    expect(await screen.findByText(/hit your practice goal this week/)).toBeInTheDocument();
  });

  it("has no accessibility violations with data", async () => {
    mocks.getProgress.mockResolvedValue(report([session(0), session(1)]));
    const { container } = renderProgress();
    await screen.findByText("This week");
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("Progress coach summary", () => {
  it("shows the stored summary and does not regenerate it", async () => {
    mocks.getProgress.mockResolvedValue(report([session(0), session(1)]));
    mocks.readProgressSummary.mockResolvedValue({ summary: "Your saved coach summary." });
    renderProgress();
    expect(await screen.findByText("Your saved coach summary.")).toBeInTheDocument();
    expect(mocks.generateProgressSummary).not.toHaveBeenCalled();
  });

  it("auto-generates a summary when none is stored yet", async () => {
    mocks.getProgress.mockResolvedValue(report([session(0), session(1)]));
    mocks.readProgressSummary.mockResolvedValue({ summary: "" });
    renderProgress();
    expect(await screen.findByText("A generated summary.")).toBeInTheDocument();
    expect(mocks.generateProgressSummary).toHaveBeenCalled();
  });
});
