import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const decisionSchema = z.object({
  decision: z.string(),
  problem: z.string().optional(),
  alternatives: z.string().optional(),
  chosenApproach: z.string().optional(),
  reason: z.string().optional(),
  tradeoff: z.string().optional(),
  evidence: z.string().optional(),
});

const controlSchema = z.object({
  name: z.string(),
  status: z.enum(["implemented", "planned", "not_used"]),
  detail: z.string().optional(),
});

const statSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    status: z.enum([
      "draft",
      "prototype",
      "beta",
      "active",
      "paused",
      "completed",
    ]),
    visibility: z.enum(["public", "private"]),
    noindex: z.boolean().default(false),
    featured: z.boolean().default(false),
    displayOrder: z.number().int().nonnegative().default(999),
    projectType: z.string().optional(),
    role: z.string().optional(),
    teamSize: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    repositoryUrl: z.string().optional(),
    repositoryVisibility: z
      .enum(["public", "private", "mixed", "none"])
      .optional(),
    problem: z.string().optional(),
    constraints: z.array(z.string()).optional(),
    responsibilities: z.array(z.string()).optional(),
    stack: z.array(z.string()).optional(),
    stats: z.array(statSchema).optional(),
    architecture: z.string().optional(),
    workflow: z.array(z.string()).optional(),
    decisions: z.array(decisionSchema).optional(),
    performance: z.array(z.string()).optional(),
    safetyControls: z.array(controlSchema).optional(),
    privacyControls: z.array(controlSchema).optional(),
    testing: z.array(z.string()).optional(),
    observability: z.string().optional(),
    releaseEngineering: z.string().optional(),
    failureHandling: z.string().optional(),
    outcomes: z.array(z.string()).optional(),
    evidence: z.array(z.string()).optional(),
    limitations: z.array(z.string()).optional(),
    lessons: z.array(z.string()).optional(),
    nextSteps: z.array(z.string()).optional(),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/notes" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    publishDate: z.string(),
    tags: z.array(z.string()).optional(),
    status: z.enum(["draft", "published"]),
    visibility: z.enum(["public", "private"]),
    noindex: z.boolean().default(false),
    sourceProject: z.string().optional(),
  }),
});

export const collections = { projects, notes };
