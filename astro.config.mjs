// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

const site = "https://pushpendra-portfolio-theta.vercel.app";

// https://astro.build/config
export default defineConfig({
  site,
  // No sitemap filter needed: draft/private project entries never get a
  // route generated in the first place (see getStaticPaths in
  // src/pages/projects/[slug].astro), so the sitemap only ever sees pages
  // that actually exist.
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
