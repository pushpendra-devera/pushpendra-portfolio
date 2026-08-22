import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  { path: "/projects", name: "projects-index" },
  {
    path: "/projects/dallal-real-estate-marketplace",
    name: "projects-dallal",
  },
  { path: "/projects/ai-job-agent", name: "projects-ai-job-agent" },
  { path: "/projects/rm-fitness-club", name: "projects-rm-fitness-club" },
];

for (const { path, name } of pages) {
  test(`${path} has no horizontal overflow, passes accessibility checks, and matches fixed-viewport screenshot`, async ({
    page,
  }, testInfo) => {
    await page.goto(path);

    const hasOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    await page.screenshot({
      path: `screenshots/${name}-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
}
