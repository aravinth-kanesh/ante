import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import MobileNav from "./MobileNav";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/prepare", label: "Prepare" },
  { to: "/interview", label: "Interview" },
];

function renderNav(onLogout = () => {}) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MobileNav links={links} email="a@b.co" onLogout={onLogout} />
    </MemoryRouter>,
  );
}

describe("MobileNav", () => {
  it("is collapsed to start and toggles aria-expanded and the panel", async () => {
    renderNav();
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();

    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toBeInTheDocument();
    for (const l of links) {
      expect(screen.getByRole("link", { name: l.label })).toBeInTheDocument();
    }
  });

  it("closes on Escape and returns focus to the button", async () => {
    renderNav();
    const button = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("closes when a nav link is activated", async () => {
    renderNav();
    const button = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(button);
    await userEvent.click(screen.getByRole("link", { name: "Prepare" }));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("calls onLogout from the panel", async () => {
    const onLogout = vi.fn();
    renderNav(onLogout);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("has no axe violations when open", async () => {
    const { container } = renderNav();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
