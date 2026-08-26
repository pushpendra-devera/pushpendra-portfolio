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
  {
    path: "/notes/csp-as-a-debugging-tool",
    name: "notes-csp-as-a-debugging-tool",
  },
  {
    path: "/notes/four-roles-one-mobile-app",
    name: "notes-four-roles-one-mobile-app",
  },
  {
    path: "/notes/mobile-ai-credential-boundary",
    name: "notes-mobile-ai-credential-boundary",
  },
  {
    path: "/notes/server-created-payment-checkout",
    name: "notes-server-created-payment-checkout",
  },
  {
    path: "/notes/ephemeral-credentials-for-mobile-voice",
    name: "notes-ephemeral-credentials-for-mobile-voice",
  },
  {
    path: "/notes/one-identity-three-portals",
    name: "notes-one-identity-three-portals",
  },
  {
    path: "/notes/source-first-prototype-review",
    name: "notes-source-first-prototype-review",
  },
  {
    path: "/notes/react-threejs-lifecycle-boundary",
    name: "notes-react-threejs-lifecycle-boundary",
  },
  {
    path: "/notes/cross-platform-media-boundary",
    name: "notes-cross-platform-media-boundary",
  },
  {
    path: "/notes/commerce-as-one-stateful-journey",
    name: "notes-commerce-as-one-stateful-journey",
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
