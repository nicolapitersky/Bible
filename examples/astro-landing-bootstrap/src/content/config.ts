import { defineCollection, z } from 'astro:content';

/**
 * src/content/config.ts
 * Type-safe content collection schemas.
 * Zod validation runs at build time — malformed frontmatter fails the build.
 */

const blog = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z
        .string()
        .min(10, 'Title too short')
        .max(60, 'Title too long for SEO — keep under 60 chars'),
      description: z
        .string()
        .min(50, 'Description too short')
        .max(160, 'Description too long for SEO — keep under 160 chars'),
      publishedAt: z.date(),
      updatedAt: z.date().optional(),
      author: z.string(),
      authorRole: z.string().optional(),
      /** Hero image. Use astro:assets image() for optimisation. */
      image: image().optional(),
      imageAlt: z.string().optional(),
      tags: z.array(z.string()).default([]),
      /** Draft posts: excluded from production build. */
      draft: z.boolean().default(false),
      /** Featured posts: shown in hero slot on blog index. */
      featured: z.boolean().default(false),
      /** Canonical URL override — for cross-posted content. */
      canonical: z.string().url().optional(),
    }),
});

export const collections = { blog };
