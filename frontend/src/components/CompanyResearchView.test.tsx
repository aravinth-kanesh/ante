import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CompanyResearch } from "../api";
import CompanyResearchView from "./CompanyResearchView";

function research(overrides: Partial<CompanyResearch> = {}): CompanyResearch {
  return {
    overview: "Acme builds climbing gear.",
    interview_process: "",
    technical_skills: [],
    soft_skills: [],
    skills: [],
    tips: [],
    sources: [],
    ...overrides,
  };
}

describe("CompanyResearchView", () => {
  it("lists sources as links when the briefing was grounded", () => {
    render(
      <CompanyResearchView
        company="Acme"
        role="Engineer"
        research={research({ sources: [{ title: "Acme Ltd", url: "https://acme.example" }] })}
      />,
    );
    const link = screen.getByRole("link", { name: "Acme Ltd" });
    expect(link).toHaveAttribute("href", "https://acme.example");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("omits the sources section when there are none", () => {
    render(<CompanyResearchView company="Acme" role="Engineer" research={research()} />);
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();
  });
});
