import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSummary } from "../api";

const mocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
  getPreparation: vi.fn(),
  getProfile: vi.fn(),
  listCvs: vi.fn(),
  listSessions: vi.fn(),
}));

vi.mock("../api", () => ({
  getHealth: mocks.getHealth,
  getPreparation: mocks.getPreparation,
  getProfile: mocks.getProfile,
  listCvs: mocks.listCvs,
  listSessions: mocks.listSessions,
}));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: { email: "s@example.com" } }) }));

import Dashboard from "./Dashboard";

function summary(daysAgo: number, isSample = false): SessionSummary {
  return {
    id: daysAgo + 1,
    mode: "text",
    interview_type: "general",
    focus: "",
    status: "finished",
    created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    question_count: 3,
    title: "General Interview",
    preview: "Tell me about yourself.",
    is_sample: isSample,
  };
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.getHealth.mockResolvedValue({ model: "demo", status: "ok" });
  mocks.getPreparation.mockResolvedValue({ competencies: [{ name: "x", area: "technical", status: "strong", evidence: "" }] });
  mocks.getProfile.mockResolvedValue({ jd_text: "a role", cv_text: "cv", cv_filename: "" });
  mocks.listCvs.mockResolvedValue([{ id: 1, label: "CV", filename: "", created_at: "", selected: true }]);
  mocks.listSessions.mockReset();
});

describe("Dashboard practice nudge", () => {
  it("nudges when the last real interview was a while ago", async () => {
    mocks.listSessions.mockResolvedValue([summary(9)]);
    renderDashboard();
    expect(await screen.findByText(/9 days since your last mock interview/)).toBeInTheDocument();
  });

  it("does not nudge for a recent interview", async () => {
    mocks.listSessions.mockResolvedValue([summary(1)]);
    renderDashboard();
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(screen.queryByText(/since your last mock interview/)).not.toBeInTheDocument();
  });

  it("ignores sample interviews when deciding to nudge", async () => {
    mocks.listSessions.mockResolvedValue([summary(1, true), summary(20)]);
    renderDashboard();
    // the recent one is a sample; the real one is 20 days old, so it nudges
    expect(await screen.findByText(/20 days since your last mock interview/)).toBeInTheDocument();
  });
});
