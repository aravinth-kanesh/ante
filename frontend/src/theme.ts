// The theme is applied to the document element as data-theme, set before first paint by
// a small script in index.html. This module lets the app read and change it, and keeps it
// in step with the operating system while the user has not made an explicit choice.
export type Theme = "light" | "dark";

const KEY = "ante-theme";

export function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // storage may be unavailable (private mode); the choice still applies for this visit
  }
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

// Follow the OS theme while the user has not chosen one explicitly.
export function watchSystemTheme(): void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", (e) => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      stored = null;
    }
    if (stored !== "dark" && stored !== "light") {
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
    }
  });
}
