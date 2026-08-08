import { expect, test } from "@playwright/test";

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

test.describe("authenticated workflow", () => {
  test.skip(!username || !password, "Set E2E_USERNAME and E2E_PASSWORD to run signed-in smoke tests.");

  test("home, meetings, tasks, and topics remain reachable", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username or email").fill(username!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: /good to see you|team dashboard/i })).toBeVisible();

    for (const destination of ["/meetings", "/my-tasks", "/topics"]) {
      await page.goto(destination);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });
});
