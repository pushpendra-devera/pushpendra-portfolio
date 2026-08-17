import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  { path: "/notes", name: "notes-index" },
  {
    path: "/notes/jwt-refresh-token-retry",
    name: "notes-jwt-refresh-token-retry",
  },
  {
    path: "/notes/incoming-calls-app-states",
    name: "notes-incoming-calls-app-states",
  },
  {
    path: "/notes/deterministic-vs-llm-judgment",
    name: "notes-deterministic-vs-llm-judgment",
  },
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
