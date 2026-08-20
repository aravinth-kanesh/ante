import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Loading from "./Loading";

describe("Loading", () => {
  it("announces its status with a default label", () => {
    render(<Loading />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading");
  });

  it("uses a custom label when given one", () => {
    render(<Loading label="Loading your results" />);
    expect(screen.getByText("Loading your results")).toBeInTheDocument();
  });
});
