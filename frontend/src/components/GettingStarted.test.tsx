import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import GettingStarted, { type OnboardingSteps } from "./GettingStarted";

function renderWith(steps: OnboardingSteps, onHide = () => {}) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <GettingStarted steps={steps} onHide={onHide} />
    </MemoryRouter>,
  );
}

const none: OnboardingSteps = { cv: false, jd: false, plan: false, interview: false };

describe("GettingStarted", () => {
  it("counts the done steps", () => {
    renderWith({ cv: true, jd: true, plan: false, interview: false });
    expect(screen.getByText("2 of 4 done")).toBeInTheDocument();
  });

  it("shows the call-to-action on the first incomplete step only", () => {
    renderWith({ cv: true, jd: false, plan: false, interview: false });
    // cv is done, so the first incomplete is jd: its CTA shows.
    expect(screen.getByRole("button", { name: "Set the role" })).toBeInTheDocument();
    // Later incomplete steps do not surface their CTA yet.
    expect(screen.queryByRole("button", { name: "Generate a plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start an interview" })).not.toBeInTheDocument();
  });

  it("offers a Revisit link on a done step", () => {
    renderWith({ cv: true, jd: false, plan: false, interview: false });
    expect(screen.getByRole("link", { name: "Revisit" })).toBeInTheDocument();
  });

  it("calls onHide when Hide this is clicked", async () => {
    const onHide = vi.fn();
    renderWith(none, onHide);
    await userEvent.click(screen.getByRole("button", { name: "Hide this" }));
    expect(onHide).toHaveBeenCalledOnce();
  });

  it("has no axe violations", async () => {
    const { container } = renderWith(none);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
