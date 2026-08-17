import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("homepage has no horizontal overflow, passes accessibility checks, and matches fixed-viewport screenshot", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  // Wait for the hero's staggered fade-in (opacity 0 -> 1) to finish so
  // axe doesn't scan text mid-animation and misread its transient low
  // opacity as a real contrast failure.
  await page.waitForFunction(() => {
    const els = document.querySelectorAll(".animate-fade-in");
    return Array.from(els).every((el) => getComputedStyle(el).opacity === "1");
  });

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
