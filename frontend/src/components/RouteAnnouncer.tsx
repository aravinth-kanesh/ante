import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// Human-readable name for each route, used for the page title and the spoken
// announcement when navigating.
const NAMES: Record<string, string> = {
  "/": "Dashboard",
  "/cvs": "CVs",
  "/prepare": "Prepare",
  "/interview": "Interview",
  "/progress": "Progress",
  "/history": "History",
  "/settings": "Settings",
  "/login": "Log in",
  "/signup": "Sign up",
  "/verify": "Verify email",
  "/forgot-password": "Forgot password",
  "/reset-password": "Reset password",
  "/privacy": "Privacy",
};

function pageName(pathname: string): string {
  if (pathname.startsWith("/results/")) return "Interview results";
  return NAMES[pathname] ?? "Ante";
}

/**
 * On each route change: set the document title, move keyboard focus to the main
 * content, and announce the new page in a visually-hidden live region, so keyboard
 * and screen-reader users are oriented rather than left at the top of the nav.
 */
export default function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const firstRender = useRef(true);

  useEffect(() => {
    const name = pageName(pathname);
    document.title = `${name} - Ante`;

    // Do not steal focus or announce on the very first page load.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setMessage(`${name} page`);
    document.getElementById("main")?.focus();
  }, [pathname]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
