import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// "the A line" — writing / rants
const writing = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

// "the 7 line" — projects / portfolio
const projects = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    // station status board: in service / under construction / archived
    status: z.enum(['live', 'building', 'archived']).default('building'),
    link: z.url().optional(),
    repo: z.url().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writing, projects };
