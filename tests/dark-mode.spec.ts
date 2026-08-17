import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("dark mode toggle switches theme and persists across reload", async ({
  page,
}) => {
  await page.goto("/");

  const html = page.locator("html");
  const initiallyDark = (await html.getAttribute("class"))?.includes("dark");

  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  const afterClick = (await html.getAttribute("class"))?.includes("dark");
  expect(afterClick).toBe(!initiallyDark);

  await page.reload();
  const afterReload = (await html.getAttribute("class"))?.includes("dark");
  expect(afterReload).toBe(afterClick);
});

const pages = [
  "/",
  "/projects",
  "/projects/dallal-real-estate-marketplace",
  "/projects/ai-job-agent",
];

for (const path of pages) {
  test(`${path} in dark mode has no horizontal overflow and passes accessibility checks`, async ({
    page,
  }, testInfo) => {
    await page.goto(path);
    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
    });
    await page.reload();

    await expect(page.locator("html")).toHaveClass(/dark/);

    const hasOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    const name =
      path === "/" ? "homepage" : path.split("/").filter(Boolean).pop();
    await page.screenshot({
      path: `screenshots/dark-${name}-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
}
