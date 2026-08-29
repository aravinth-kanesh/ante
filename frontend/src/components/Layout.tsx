import { type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Logo from "./Logo";
import MobileNav from "./MobileNav";
import { Button, cn } from "./ui";

const NAV_LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/cvs", label: "CVs" },
  { to: "/prepare", label: "Prepare" },
  { to: "/interview", label: "Interview" },
  { to: "/progress", label: "Progress" },
  { to: "/history", label: "History" },
  { to: "/settings", label: "Settings" },
];

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100",
        )
      }
    >
      {children}
    </NavLink>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-700 focus:shadow"
      >
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Ante home">
            <Logo />
            <span className="font-semibold tracking-tight text-slate-900">Ante</span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((l) => (
              <NavItem key={l.to} to={l.to}>
                {l.label}
              </NavItem>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 sm:flex">
              <span className="max-w-[12rem] truncate text-sm text-slate-500">{user?.email}</span>
              <Button variant="secondary" size="sm" onClick={logout}>
                Log out
              </Button>
            </div>
            <MobileNav links={NAV_LINKS} email={user?.email} onLogout={logout} />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8 focus:outline-none">
        {children}
      </main>
      <footer className="no-print mx-auto max-w-5xl px-4 pb-10">
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-200 pt-5 text-sm text-slate-500"
        >
          <Link to="/help" className="hover:text-brand-700 hover:underline">
            Help
          </Link>
          <Link to="/privacy" className="hover:text-brand-700 hover:underline">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
}
