import { useEffect, useState } from "react";
import { currentTheme, toggleTheme, watchSystemTheme, type Theme } from "../theme";
import { MoonIcon, SunIcon } from "./ui";

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(currentTheme());

  useEffect(() => {
    watchSystemTheme();
    // Reflect a system change that happened before this mounted.
    setThemeState(currentTheme());
  }, []);

  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setThemeState(toggleTheme())}
      className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
