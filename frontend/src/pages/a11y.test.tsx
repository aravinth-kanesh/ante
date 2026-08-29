import { act, render, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";

import Compare from "./Compare";
import Cvs from "./Cvs";
import Dashboard from "./Dashboard";
import ForgotPassword from "./ForgotPassword";
import Help from "./Help";
import History from "./History";
import Interview from "./Interview";
import Login from "./Login";
import Prepare from "./Prepare";
import Privacy from "./Privacy";
import Progress from "./Progress";
import QuestionBank from "./QuestionBank";
import QuickPractice from "./QuickPractice";
import ResetPassword from "./ResetPassword";
import Results from "./Results";
import Settings from "./Settings";
import Signup from "./Signup";
import Stars from "./Stars";
import Verify from "./Verify";

// Well-shaped empty payloads keyed by request path, so each page renders its real
// markup (empty states included) rather than crashing on missing fields.
const ROUTES: Record<string, unknown> = {
  "/api/health": { status: "ok", model: "demo" },
  "/api/auth/config": { verification_required: false },
  "/api/profile": { jd_text: "", cv_text: "", company: "", role: "" },
  "/api/cv": [],
  "/api/profile/research": { research: null, company: "", role: "" },
  "/api/prepare/questions": { groups: [] },
  "/api/prepare/plan": { competencies: [], plan: [] },
  "/api/speech/voices": { available: false, voices: [] },
  "/api/interview": [],
  "/api/practice/question": { question: "Tell me about yourself." },
  "/api/stars": [],
  "/api/progress": {
    totals: { interviews: 0, questions_answered: 0, minutes_practised: 0 },
    sessions: [],
    deltas: [],
    focus_areas: [],
    strengths: [],
  },
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const fetchStub = vi.fn(async (input: unknown) => {
  const path = String(input).split("?")[0];
  if (path === "/api/interview/active") return jsonResponse(null); // nothing to resume
  if (/^\/api\/interview\/\d+$/.test(path)) {
    return jsonResponse({
      status: "finished",
      mode: "voice",
      interview_type: "general",
      focus: "",
      company: "Acme",
      role: "Analyst",
      feedback: null,
      reflection: "",
      turns: [],
    });
  }
  return jsonResponse(ROUTES[path] ?? {});
});

beforeEach(() => vi.stubGlobal("fetch", fetchStub));
afterEach(() => vi.unstubAllGlobals());

async function axeClean(element: React.ReactNode, initialPath = "/") {
  const { container } = render(
    <MemoryRouter
      initialEntries={[initialPath]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <Routes>
          <Route path="/results/:id" element={element as React.ReactElement} />
          <Route path="*" element={element as React.ReactElement} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  // Let the on-mount fetches and their state updates settle before auditing.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(container.querySelector("h1, form, [role='alert']")).toBeTruthy());
  const results = await axe(container);
  expect(results.violations).toEqual([]);
}

describe("page accessibility (axe)", () => {
  it("Login has no violations", () => axeClean(<Login />));
  it("Signup has no violations", () => axeClean(<Signup />));
  it("ForgotPassword has no violations", () => axeClean(<ForgotPassword />));
  it("ResetPassword has no violations", () => axeClean(<ResetPassword />, "/reset?token=x"));
  it("Verify has no violations", () => axeClean(<Verify />, "/verify?token=x"));
  it("Privacy has no violations", () => axeClean(<Privacy />));
  it("Help has no violations", () => axeClean(<Help />));
  it("Dashboard has no violations", () => axeClean(<Dashboard />));
  it("Prepare has no violations", () => axeClean(<Prepare />));
  it("Progress has no violations", () => axeClean(<Progress />));
  it("History has no violations", () => axeClean(<History />));
  it("Compare has no violations", () => axeClean(<Compare />));
  it("Cvs has no violations", () => axeClean(<Cvs />));
  it("Settings has no violations", () => axeClean(<Settings />));
  it("Interview has no violations", () => axeClean(<Interview />));
  it("QuickPractice has no violations", () => axeClean(<QuickPractice />));
  it("QuestionBank has no violations", () => axeClean(<QuestionBank />));
  it("Stars has no violations", () => axeClean(<Stars />));
  it("Results has no violations", () => axeClean(<Results />, "/results/1"));
});
