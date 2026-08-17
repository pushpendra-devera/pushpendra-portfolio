import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const projects = await getCollection(
    "projects",
    ({ data }) => data.visibility === "public" && data.status !== "draft",
  );
  const notes = await getCollection(
    "notes",
    ({ data }) => data.visibility === "public" && data.status !== "draft",
  );

  const projectItems = projects.map((project) => ({
    title: project.data.title,
    description: project.data.summary,
    link: `/projects/${project.data.slug}/`,
  }));

  const noteItems = notes
    .map((note) => ({
      title: note.data.title,
      description: note.data.summary,
      link: `/notes/${note.data.slug}/`,
      pubDate: new Date(note.data.publishDate),
    }))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: "Pushpendra Singh - Writing",
    description: "Engineering case studies and notes by Pushpendra Singh.",
    site: context.site,
    items: [...noteItems, ...projectItems],
  });
}
