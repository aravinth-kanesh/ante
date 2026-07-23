import { type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Logo from "./Logo";
import { Button, cn } from "./ui";

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
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-semibold tracking-tight text-slate-900">Interview Coach</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <NavItem to="/">Dashboard</NavItem>
            <NavItem to="/cvs">CVs</NavItem>
            <NavItem to="/interview">Interview</NavItem>
            <NavItem to="/history">History</NavItem>
            <NavItem to="/settings">Settings</NavItem>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[12rem] truncate text-sm text-slate-500 md:inline">
              {user?.email}
            </span>
            <Button variant="secondary" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
