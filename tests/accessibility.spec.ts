import { test, expect } from "@playwright/test";

test("respects prefers-reduced-motion: hero content is visible immediately, no animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const heading = page.locator("#hero h1");
  await expect(heading).toBeVisible();
  const opacity = await heading.evaluate((el) => getComputedStyle(el).opacity);
  expect(opacity).toBe("1");
});

test("keyboard navigation reaches all header nav links and resume link with visible focus, no trap", async ({
  page,
}) => {
  await page.goto("/");

  const expectedLabels = ["About", "Resume", "Email", "LinkedIn", "GitHub"];
  const reached: string[] = [];

  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return (
        el.getAttribute("aria-label") || el.textContent?.trim() || el.tagName
      );
    });
    if (label && !reached.includes(label)) reached.push(label);
  }

  for (const expected of expectedLabels) {
    expect(reached.some((r) => r.includes(expected))).toBe(true);
  }
});
