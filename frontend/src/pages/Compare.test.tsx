import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProgressReport, SessionStats } from "../api";

const mocks = vi.hoisted(() => ({ getProgress: vi.fn() }));
vi.mock("../api", () => ({ getProgress: mocks.getProgress }));

import Compare from "./Compare";

function session(id: number, strongRate: number, fillers: number): SessionStats {
  return {
    session_id: id,
    created_at: `2026-08-${10 + id}T10:00:00Z`,
    interview_type: "general",
    title: `Interview ${id}`,
    answered_count: 3,
    strong_rate: strongRate,
    verdicts: { strong: 0, adequate: 0, weak: 0 },
    avg_wpm: 130,
    filler_per_min: fillers,
    eye_contact_pct: null,
    head_steadiness: null,
    has_delivery: true,
    has_nonverbal: false,
  confidence_before: null,
  confidence_after: null,
  };
}

function report(sessions: SessionStats[]): ProgressReport {
  return {
    totals: { interviews: sessions.length, questions_answered: 0, minutes_practised: 0 },
    sessions,
    deltas: [],
    focus_areas: [],
    strengths: [],
  };
}

function renderCompare() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Compare />
    </MemoryRouter>,
  );
}

beforeEach(() => mocks.getProgress.mockReset());

describe("Compare", () => {
  it("shows an improvement when the later interview is stronger", async () => {
    // first weaker (0.3 strong, 5 fillers), latest stronger (0.7 strong, 2 fillers)
    mocks.getProgress.mockResolvedValue(report([session(1, 0.3, 5), session(2, 0.7, 2)]));
    renderCompare();

    const strongRow = (await screen.findByText("Answers rated strong")).closest("tr") as HTMLElement;
    expect(within(strongRow).getByText("30%")).toBeInTheDocument();
    expect(within(strongRow).getByText("70%")).toBeInTheDocument();
    expect(within(strongRow).getByText("Improved")).toBeInTheDocument();

    // fewer fillers is also an improvement
    const fillerRow = (await screen.findByText("Filler words")).closest("tr") as HTMLElement;
    expect(within(fillerRow).getByText("Improved")).toBeInTheDocument();
  });

  it("prompts for more interviews when there are fewer than two", async () => {
    mocks.getProgress.mockResolvedValue(report([session(1, 0.5, 3)]));
    renderCompare();
    expect(await screen.findByText(/at least two finished interviews/)).toBeInTheDocument();
  });
});
