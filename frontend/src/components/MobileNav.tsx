import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Button, CloseIcon, MenuIcon, cn } from "./ui";

interface NavLinkItem {
  to: string;
  label: string;
}

/**
 * The small-screen navigation: a hamburger button that discloses a panel below the
 * header with the nav links, the signed-in email and log out. Keyboard and screen
 * reader friendly - it announces its expanded state, closes on Escape, outside click
 * and navigation, and returns focus to the button when it closes.
 */
export default function MobileNav({
  links,
  email,
  onLogout,
}: {
  links: NavLinkItem[];
  email?: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  // Close when navigating to a new page.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    // Move focus into the panel so keyboard users land on the menu.
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
      >
        {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
      </button>

      {open && (
        <div
          id="mobile-nav"
          ref={panelRef}
          className="absolute left-0 right-0 top-16 z-20 max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-200 bg-white shadow-lift"
        >
          <nav aria-label="Primary" className="mx-auto max-w-5xl px-4 py-3">
            <ul className="flex flex-col">
              {links.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    end={l.to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "block rounded-lg px-3 py-3 text-sm font-medium",
                        isActive ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100",
                      )
                    }
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
              {email && <span className="min-w-0 truncate text-sm text-slate-500">{email}</span>}
              <Button variant="secondary" size="sm" onClick={onLogout}>
                Log out
              </Button>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
