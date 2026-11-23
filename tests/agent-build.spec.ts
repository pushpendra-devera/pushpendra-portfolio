import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The intro never auto-plays for automated browsers (navigator.webdriver),
// so the rest of the suite sees the normal page. ?build=1 forces it here.

test("intro does not auto-play for automated browsers; Rebuild is offered", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/ab-pending|ab-active/);
  await expect(page.locator("[data-ab]")).toHaveCount(0);
  await expect(page.locator(".ab-root")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Rebuild this view with agents" }),
  ).toBeVisible();
});

test("?build=1 builds the hero, waits for scroll, and Skip reveals everything", async ({
  page,
}) => {
  await page.goto("/?build=1");
  await expect(page.locator('[data-ab="hidden"]').first()).toBeAttached();

  const heading = page.locator("#hero h1");
  await expect(heading).not.toHaveAttribute("data-ab", { timeout: 10_000 });
  await expect(page.locator(".ab-status")).toHaveText(
    "Scroll to keep building",
    { timeout: 12_000 },
  );

  // Skip is the first stop in the tab order.
  await page.keyboard.press("Tab");
  const skip = page.getByRole("button", { name: "Skip the build animation" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator("[data-ab]")).toHaveCount(0);
  await expect(page.locator(".ab-root")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/ab-active/);

  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("?build=1 builds sections as they scroll into view", async ({ page }) => {
  await page.goto("/?build=1");
  await expect(page.locator(".ab-status")).toHaveText(
    "Scroll to keep building",
    { timeout: 12_000 },
  );
  await expect(page.locator("#projects [data-ab]").first()).toBeAttached();

  await page.locator("#projects h2").scrollIntoViewIfNeeded();
  await expect(page.locator("#projects h2")).not.toHaveAttribute("data-ab", {
    timeout: 5_000,
  });
});

test("Esc skips the intro, and keyboard focus reveals hidden content", async ({
  page,
}) => {
  await page.goto("/?build=1");
  await expect(page.locator('[data-ab="hidden"]').first()).toBeAttached();

  // Tab past Skip onto the first nav link: it must not stay invisible.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).not.toHaveAttribute("data-ab", "hidden");

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-ab]")).toHaveCount(0);
  await expect(page.locator(".ab-root")).toHaveCount(0);
});

test("intro never runs under reduced motion, even when forced", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?build=1");
  await expect(page.locator("#hero h1")).toBeVisible();
  await expect(page.locator("[data-ab]")).toHaveCount(0);
  await expect(page.locator(".ab-root")).toHaveCount(0);
  await expect(page.locator(".ab-rebuild")).toBeHidden();
});

test("Rebuild replays the current view and cleans up after itself", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Rebuild this view with agents" })
    .click();
  await expect(page.locator(".ab-root")).toHaveCount(1);
  await expect(page.locator("[data-ab]").first()).toBeAttached();

  await expect(page.locator(".ab-root")).toHaveCount(0, { timeout: 12_000 });
  await expect(page.locator("[data-ab]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Rebuild this view with agents" }),
  ).toBeVisible();
});
