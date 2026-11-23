import { test, expect } from "@playwright/test";

// Regression: the fixed header used left: 50% + translate(-50%), which made
// the browser size it within half the viewport, so the primary nav wrapped
// onto two or three rows at common tablet and laptop widths (640 to ~1340)
// and covered the title on the projects and notes pages.

const widths = [640, 700, 768, 1024, 1280, 1366, 1440, 1920];

for (const width of widths) {
  test(`primary nav is one centered row with side margins at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    const layout = await page.evaluate(() => {
      const header = document.getElementById("header");
      const items = Array.from(header?.querySelectorAll("nav li") ?? []);
      // Items are vertically centered in a row, so one distinct center = one row.
      const centers = new Set(
        items.map((li) => {
          const r = li.getBoundingClientRect();
          return Math.round(r.top + r.height / 2);
        }),
      );
      const r = header?.getBoundingClientRect();
      return {
        rows: centers.size,
        leftGap: r ? r.left : 0,
        rightGap: r ? window.innerWidth - r.right : 0,
      };
    });

    expect(layout.rows).toBe(1);
    expect(layout.leftGap).toBeGreaterThanOrEqual(15);
    expect(Math.abs(layout.leftGap - layout.rightGap)).toBeLessThanOrEqual(1);
  });
}

const pages = [
  { path: "/?build=0", first: "#hero p" },
  { path: "/projects", first: "main h1" },
  { path: "/projects/ai-job-agent", first: "main a, main h1" },
  { path: "/notes", first: "main h1" },
  { path: "/notes/jwt-refresh-token-retry", first: "main a, main h1" },
];

for (const { path, first } of pages) {
  for (const width of [390, 640, 1024, 1280]) {
    test(`${path} content starts below the fixed nav at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);

      const gap = await page.evaluate((selector) => {
        const header = document.getElementById("header");
        const content = document.querySelector(selector);
        if (!header || !content) return null;
        return (
          content.getBoundingClientRect().top -
          header.getBoundingClientRect().bottom
        );
      }, first);

      expect(gap).not.toBeNull();
      expect(gap ?? -1).toBeGreaterThanOrEqual(4);
    });
  }
}
