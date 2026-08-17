import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const projects = await getCollection(
    "projects",
    ({ data }) => data.visibility === "public" && data.status !== "draft",
  );

  return rss({
    title: "Pushpendra Singh - Projects",
    description: "Engineering case studies by Pushpendra Singh.",
    site: context.site,
    items: projects.map((project) => ({
      title: project.data.title,
      description: project.data.summary,
      link: `/projects/${project.data.slug}/`,
    })),
  });
}
