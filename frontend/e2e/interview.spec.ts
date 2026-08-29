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

// The sample interview needs no setup, so a first-time visitor can see the whole loop,
// and the results page carries the reflection box and the save-as-pdf action.
test("a sample interview runs with no setup and the report can be reflected on", async ({ page }) => {
  const email = `e2e-sample+${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Str0ng-e2e-pass");
  await page.getByLabel("Confirm password").fill("Str0ng-e2e-pass");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // Start a sample interview straight away, with no CV or job description
  await page.goto("/interview");
  await page.getByRole("button", { name: "Try a sample interview" }).click();
  await expect(page.getByText(/sample interview using an example CV/)).toBeVisible();
  await expect(page.getByText(/Question 1/)).toBeVisible();

  await page.getByLabel("Your answer").fill("At Northwind I would draw on my final-year team project.");
  await page.getByRole("button", { name: /Stop . get feedback/ }).click();
  await expect(page.getByRole("heading", { name: "Feedback" })).toBeVisible();

  // The full results page offers a reflection note and a save-as-pdf action
  await page.getByRole("link", { name: "View full results" }).click();
  await expect(page.getByRole("button", { name: "Save as PDF" })).toBeVisible();
  await page.getByLabel("Your reflection").fill("Next time I will lead with a specific result.");
  await page.getByRole("button", { name: "Save reflection" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
});
