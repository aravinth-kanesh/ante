import { expect, test } from "@playwright/test";

// Emulate a narrow phone. This is not a hardware test (camera and microphone paths still
// need a real device), but it objectively catches the most common mobile defect: a page
// that scrolls sideways because something does not wrap or fit.
test.use({ viewport: { width: 390, height: 844 } });

const PUBLIC = ["/login", "/signup", "/help", "/privacy"];
const PROTECTED = [
  "/",
  "/cvs",
  "/prepare",
  "/interview",
  "/progress",
  "/history",
  "/settings",
  "/practice",
  "/bank",
  "/stars",
  "/saved",
  "/compare",
];

async function overflow(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test("no page scrolls sideways on a narrow phone viewport", async ({ page }) => {
  for (const path of PUBLIC) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await overflow(page), `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }

  // Sign up, then walk every protected page.
  const email = `mobile+${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Str0ng-e2e-pass");
  await page.getByLabel("Confirm password").fill("Str0ng-e2e-pass");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  for (const path of PROTECTED) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await overflow(page), `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }

  // The desktop nav is hidden on a phone; the hamburger menu must open the links.
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  const panel = page.locator("#mobile-nav");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: "Interview" })).toBeVisible();
});
