import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ pattern: '**/[^_]*.mdx', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /* The one real grouping split on the homepage: paid professional work
         vs. personal/game projects. Everything else (discipline, context)
         stays free text on purpose — this is the single field that changes
         which list a row renders in. */
      category: z.enum(['professional', 'personal']).default('personal'),
      /* Discipline and context are the structural device for the work rows.
         They encode something true about each project — unlike an index
         number, which would imply a sequence these four don't have. */
      discipline: z.string(),
      context: z.string(),
      tagline: z.string(),
      /* One sentence on what it is, shown in the work row. */
      thesis: z.string(),
      /* The single fact worth remembering about this project. */
      outcome: z.string(),
      role: z.string(),
      cover: image(),
      coverAlt: z.string(),
      stack: z.array(z.string()),
      systems: z.array(z.string()).default([]),
      tags: z.array(z.string()),
      order: z.number(),
    }),
});

export const collections = { projects };
