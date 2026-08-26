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

  const experienceCounter = page.locator("[data-experience-counter]");
  await expect(experienceCounter).toHaveAttribute(
    "data-career-start",
    "2022-01-01",
  );

  const expectedExperience = await page.evaluate(() => {
    const start = new Date(2022, 0, 1);
    const today = new Date();
    let months =
      (today.getFullYear() - start.getFullYear()) * 12 +
      today.getMonth() -
      start.getMonth();
    if (today.getDate() < start.getDate()) months -= 1;
    return `${Math.floor(months / 12)}y ${months % 12}m`;
  });

  await expect(experienceCounter).toHaveText(expectedExperience);
  await expect(page.locator("#about")).toContainText("since January 2022");
  await expect(page.locator("body")).not.toContainText("4.6 years");

  await page.screenshot({
    path: `screenshots/homepage-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
