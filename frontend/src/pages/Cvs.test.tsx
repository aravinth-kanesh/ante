import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cv } from "../api";

const mocks = vi.hoisted(() => ({
  listCvs: vi.fn(),
  getProfile: vi.fn(),
  selectCv: vi.fn(),
  generateQuestions: vi.fn(),
  generatePreparation: vi.fn(),
}));

vi.mock("../api", () => ({
  listCvs: mocks.listCvs,
  getProfile: mocks.getProfile,
  selectCv: mocks.selectCv,
  generateQuestions: mocks.generateQuestions,
  generatePreparation: mocks.generatePreparation,
  createCv: vi.fn(),
  deleteCv: vi.fn(),
  getCv: vi.fn(),
  renameCv: vi.fn(),
  updateCvText: vi.fn(),
  uploadCvFile: vi.fn(),
}));

import Cvs from "./Cvs";

const inactiveCv: Cv = { id: 1, label: "CV A", filename: "", created_at: "2026-08-31T10:00:00Z", selected: false };

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.listCvs.mockResolvedValue([inactiveCv]);
  mocks.selectCv.mockResolvedValue({});
  mocks.generateQuestions.mockResolvedValue([]);
  mocks.generatePreparation.mockResolvedValue({ summary: "", competencies: [], plan: [] });
});

describe("Cvs eager prepare regeneration", () => {
  it("pre-generates the prepare sections when a CV is made active and a JD is set", async () => {
    mocks.getProfile.mockResolvedValue({ jd_text: "a role", cv_text: "cv", cv_filename: "" });
    render(<Cvs />);
    await userEvent.click(await screen.findByRole("button", { name: "Use this CV" }));
    await waitFor(() => expect(mocks.generateQuestions).toHaveBeenCalled());
    expect(mocks.generatePreparation).toHaveBeenCalled();
  });

  it("does not pre-generate when there is no job description", async () => {
    mocks.getProfile.mockResolvedValue({ jd_text: "", cv_text: "", cv_filename: "" });
    render(<Cvs />);
    await userEvent.click(await screen.findByRole("button", { name: "Use this CV" }));
    await waitFor(() => expect(mocks.selectCv).toHaveBeenCalled());
    expect(mocks.generateQuestions).not.toHaveBeenCalled();
    expect(mocks.generatePreparation).not.toHaveBeenCalled();
  });
});
