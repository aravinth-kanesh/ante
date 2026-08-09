import { render, screen } from "@testing-library/react";
import { Input, TextArea } from "./Field";

describe("Field controls", () => {
  it("associates a real <label> with the input", () => {
    render(<Input label="Email" defaultValue="" />);
    const input = screen.getByLabelText("Email");
    expect(input.tagName).toBe("INPUT");
  });

  it("marks the control invalid and links the error message", () => {
    render(<Input label="Password" error="Too short" defaultValue="" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent("Too short");
  });

  it("links a hint via aria-describedby", () => {
    render(<TextArea label="Job description" hint="Paste it here" defaultValue="" />);
    const control = screen.getByLabelText("Job description");
    const describedby = control.getAttribute("aria-describedby");
    expect(describedby).toBeTruthy();
    expect(document.getElementById(describedby!)).toHaveTextContent("Paste it here");
  });

  it("renders a bare control when given no label, hint or error", () => {
    render(<Input placeholder="search" defaultValue="" />);
    expect(screen.getByPlaceholderText("search")).toBeInTheDocument();
  });
});
