import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const PROJECT_CATEGORIES = ['electrical', 'cctv', 'it', 'solar', 'smarthome', 'lighting'] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

const projects = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(PROJECT_CATEGORIES),
    categoryLabel: z.string(),
    image: z.string(),
    order: z.number().int().nonnegative().default(0),
  }),
});

export const collections = { projects };
