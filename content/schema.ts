import { z } from 'zod';

/**
 * Content schemas. Data files in `content/` describe structure and visual DNA;
 * human-readable texts live in next-intl dictionaries (`messages/<locale>/content.json`)
 * and are validated by the text schemas at the bottom of this file.
 */

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase kebab-case slugs');

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use #RRGGBB colors');

const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

/* ------------------------------------------------------------------ */
/* Visual DNA                                                          */
/* ------------------------------------------------------------------ */

/** Shader program used for the glowing core in the centre of a system. */
export const coreStyleSchema = z.enum([
  'prism', // faceted glass core with refraction-like fresnel (Web)
  'strata', // layered data bands scrolling around the core (CRM)
  'forge', // molten metal core with mechanical rim (Automation)
  'neural', // fluid iridescent noise blob (AI)
  'comet', // bright nucleus with streaming tail particles (Telegram)
]);

export const planetShapeSchema = z.enum([
  'sphere',
  'blob', // noise-deformed sphere
  'torus',
  'torus-knot',
  'crystal', // elongated bipyramid
  'icosahedron',
  'octahedron',
  'gear', // notched torus
  'funnel', // lathe-based cone
  'dart', // tetrahedral comet head
  'cube-cluster',
]);

export const planetMaterialSchema = z.enum([
  'glass',
  'liquid-metal',
  'hologram',
  'iridescent',
  'emissive',
]);

export const planetShellSchema = z.enum(['none', 'wireframe', 'hologram']);

export const ringSchema = z.object({
  /** Inner/outer radius as a multiple of the planet size. */
  inner: z.number().positive(),
  outer: z.number().positive(),
  /** Tilt in degrees relative to the planet's equator. */
  tilt: z.number().min(-90).max(90).default(0),
  /** Number of data bands drawn by the ring shader. */
  bands: z.int().min(1).max(32).default(1),
  opacity: z.number().min(0).max(1).default(0.6),
});

export const moonsSchema = z.object({
  count: z.int().min(1).max(16),
  kind: z.enum(['orb', 'cube', 'conveyor', 'shard']),
  /** Orbit radius as a multiple of the planet size. */
  radius: z.number().positive().default(1.8),
  speed: z.number().default(0.6),
});

export const orbitSchema = z.object({
  /** Orbit radius in system units (the core has radius ~1). */
  radius: z.number().min(1.5).max(12),
  /** Orbit plane tilt in degrees. */
  tilt: z.number().min(-60).max(60).default(0),
  /** Angular speed in radians per second; negative = retrograde. */
  speed: z.number().min(-1).max(1),
  /** Starting angle as a fraction of a full turn. */
  phase: z.number().min(0).max(1).default(0),
});

export const planetSchema = z.object({
  shape: planetShapeSchema,
  material: planetMaterialSchema,
  /** Planet radius in system units. */
  size: z.number().min(0.15).max(1.4),
  shell: planetShellSchema.default('none'),
  rings: z.array(ringSchema).max(4).default([]),
  moons: moonsSchema.optional(),
  /** Draws a comet-like trail along the orbit. */
  trail: z.boolean().default(false),
  /** Optional per-planet tint; defaults to the category color. */
  color: hexColorSchema.optional(),
  orbit: orbitSchema,
});

export const categoryDnaSchema = z.object({
  /** Main accent color used across HUD, labels, node glow and core. */
  color: hexColorSchema,
  /** Secondary highlight color (rims, sparks, gradients). */
  glow: hexColorSchema,
  core: coreStyleSchema,
  /** Optional fixed position of the category node in the universe; auto-layout otherwise. */
  universePosition: vec3Schema.optional(),
});

/* ------------------------------------------------------------------ */
/* Categories & services                                               */
/* ------------------------------------------------------------------ */

export const serviceSchema = z.object({
  slug: slugSchema,
  /**
   * Indicative delivery time in days: [min, max], counted from receiving the
   * client's materials. Shown in days up to 10, otherwise in rounded weeks.
   */
  timelineDays: z
    .tuple([z.int().positive(), z.int().positive()])
    .refine(([min, max]) => min <= max, 'timelineDays: min must be <= max'),
  /**
   * Indicative price range in PLN, `[min, max]` (round 3, B2). Feeds the
   * configurator estimate (`src/lib/configurator/estimate.ts`).
   */
  pricePLN: z
    .tuple([z.int().positive(), z.int().positive()])
    .refine(([min, max]) => min <= max, 'pricePLN: min must be <= max'),
  planet: planetSchema,
});

export const categorySchema = z.object({
  id: slugSchema,
  order: z.int().nonnegative(),
  dna: categoryDnaSchema,
  /** Each category is rendered as a planetary system with 3-5 planets. */
  services: z.array(serviceSchema).min(3).max(5),
});

export const categoriesSchema = z
  .array(categorySchema)
  .min(1)
  .superRefine((categories, ctx) => {
    const ids = new Set<string>();
    for (const category of categories) {
      if (ids.has(category.id)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate category id "${category.id}"` });
      }
      ids.add(category.id);
      const slugs = new Set<string>();
      for (const service of category.services) {
        if (slugs.has(service.slug)) {
          ctx.addIssue({
            code: 'custom',
            message: `Duplicate service slug "${service.slug}" in "${category.id}"`,
          });
        }
        slugs.add(service.slug);
      }
    }
  });

/* ------------------------------------------------------------------ */
/* Portfolio                                                           */
/* ------------------------------------------------------------------ */

/** Reference to a service as "<categoryId>/<serviceSlug>". */
export const serviceRefSchema = z
  .string()
  .regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'Use "category/service"');

export const galleryItemSchema = z.object({
  /** Root-relative path inside /public (base path is added at render time). */
  src: z.string().startsWith('/'),
  width: z.int().positive(),
  height: z.int().positive(),
});

export const projectDemoSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('iframe'),
    url: z.url(),
    /** Width / height. */
    aspectRatio: z
      .number()
      .positive()
      .default(16 / 10),
  }),
  z.object({
    type: z.literal('video'),
    src: z.string().startsWith('/'),
    poster: z.string().startsWith('/').optional(),
  }),
  z.object({
    type: z.literal('mockup'),
    /** Interactive mockup component key, resolved by the portfolio UI. */
    variant: z.enum(['telegram-chat', 'dashboard', 'storefront', 'booking']),
  }),
]);

export const projectSchema = z.object({
  slug: slugSchema,
  status: z.enum(['draft', 'published']),
  year: z.int().min(2000).max(2100),
  categories: z.array(slugSchema).min(1),
  services: z.array(serviceRefSchema).default([]),
  stack: z.array(z.string().min(1)).min(1),
  gallery: z.array(galleryItemSchema).default([]),
  demo: projectDemoSchema.optional(),
  liveUrl: z.url().optional(),
});

export const projectsSchema = z.array(projectSchema);

/* ------------------------------------------------------------------ */
/* Localized texts (next-intl dictionaries)                            */
/* ------------------------------------------------------------------ */

export const categoryTextSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().min(1).max(70),
  /** Very short line on the home category cards (two columns on phones). */
  caption: z.string().min(1).max(28),
  description: z.string().min(1),
  seoDescription: z.string().min(1).max(155),
});

export const serviceTextSchema = z.object({
  title: z.string().min(1).max(32),
  summary: z.string().min(1).max(200),
  /**
   * One line in plain words: what this service gives the client. Shown next to
   * each recommended service in the configurator (D149).
   */
  benefit: z.string().min(1).max(90),
  audience: z.string().min(1),
  features: z.array(z.string().min(1).max(60)).min(3).max(5),
  example: z.string().min(1),
  seoDescription: z.string().min(1).max(155),
});

export const projectTextSchema = z.object({
  title: z.string().min(1),
  client: z.string().min(1),
  industry: z.string().min(1),
  summary: z.string().min(1),
  task: z.string().min(1),
  solution: z.string().min(1),
  result: z.string().min(1),
});

export const contentTextsSchema = z.object({
  categories: z.record(z.string(), categoryTextSchema),
  services: z.record(z.string(), z.record(z.string(), serviceTextSchema)),
  projects: z.record(z.string(), projectTextSchema),
});

export type Category = z.infer<typeof categorySchema>;
export type CategoryDna = z.infer<typeof categoryDnaSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type Planet = z.infer<typeof planetSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectDemo = z.infer<typeof projectDemoSchema>;
export type CategoryText = z.infer<typeof categoryTextSchema>;
export type ServiceText = z.infer<typeof serviceTextSchema>;
export type ProjectText = z.infer<typeof projectTextSchema>;
export type ContentTexts = z.infer<typeof contentTextsSchema>;

/** Input types (before defaults are applied) for authoring data files. */
export type CategoryInput = z.input<typeof categorySchema>;
export type ProjectInput = z.input<typeof projectSchema>;
