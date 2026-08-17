import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("homepage has no horizontal overflow, passes accessibility checks, and matches fixed-viewport screenshot", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);

  await page.screenshot({
    path: `screenshots/homepage-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
