import { expect, test } from "@playwright/test";

// A full happy-path journey against the real stack (backend in offline mode): sign up,
// add a CV, run a typed interview to feedback, and get a coach summary of progress.
test("sign up, add a CV, complete a typed interview and see progress", async ({ page }) => {
  const email = `e2e+${Date.now()}@example.com`;

  // Sign up
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Str0ng-e2e-pass");
  await page.getByLabel("Confirm password").fill("Str0ng-e2e-pass");
  await page.getByRole("checkbox").check(); // consent
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // Add a CV by pasting text
  await page.goto("/cvs");
  await page.getByLabel("Paste CV text").fill("Experienced graduate with team projects and Python.");
  await page.getByRole("button", { name: "Save pasted CV" }).click();
  await expect(page.getByText("Active")).toBeVisible();

  // Run a typed interview
  await page.goto("/interview");
  // The toggle's checkbox is visually hidden behind its switch, so force the click.
  await page.getByRole("checkbox", { name: /Voice mode/ }).uncheck({ force: true });
  await page.getByRole("button", { name: "Start interview" }).click();
  await expect(page.getByText(/Question 1/)).toBeVisible();

  await page.getByLabel("Your answer").fill("I led a team project where I delivered a working tool and improved our process.");
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText(/Question 2/)).toBeVisible();

  await page.getByRole("button", { name: /Stop . get feedback/ }).click();
  await expect(page.getByRole("heading", { name: "Feedback" })).toBeVisible();

  // A coach summary of progress
  await page.goto("/progress");
  await page.getByRole("button", { name: /Summarise my progress/ }).click();
  await expect(page.getByText(/making steady progress/)).toBeVisible();
});
