import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import ThemeToggle from "./ThemeToggle";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

describe("ThemeToggle", () => {
  it("switches the document theme and remembers the choice", async () => {
    render(<ThemeToggle />);
    // defaults to light, so it offers to switch to dark
    const button = screen.getByRole("button", { name: "Switch to dark theme" });
    await userEvent.click(button);

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("ante-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("ante-theme")).toBe("light");
  });
});
