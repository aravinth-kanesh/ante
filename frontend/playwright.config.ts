import { defineConfig, devices } from "@playwright/test";

// End-to-end test of the real app. It launches the backend in its deterministic
// offline mode (no API key or network needed) and the Vite dev server, then drives a
// full journey in a browser.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: "http://localhost:5173", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Locally the backend runs from its virtualenv; CI installs the deps into the
      // job's Python and sets E2E_BACKEND_PYTHON=python.
      command: `${process.env.E2E_BACKEND_PYTHON ?? ".venv/bin/python"} -m uvicorn app.main:app --port 8000`,
      cwd: "../backend",
      env: {
        LLM_FAKE: "1",
        CHECK_BREACHED_PASSWORDS: "0",
        DATABASE_URL: "sqlite:///./e2e.db",
        ENVIRONMENT: "development",
      },
      url: "http://localhost:8000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
