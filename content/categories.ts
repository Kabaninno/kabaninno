import type { CategoryInput } from './schema';

/**
 * Service categories, their services (planets) and visual DNA.
 *
 * To add a category or a service: add an entry here and add its texts to
 * `messages/<locale>/content.json` (categories.<id>, services.<id>.<slug>) for
 * every locale. No scene code changes are needed as long as you reuse existing
 * `core`, `shape`, `material` and `moons.kind` values.
 */
export const categoriesData = [
  {
    id: 'web',
    order: 1,
    dna: { color: '#4FF0D2', glow: '#B8FFF2', core: 'prism' },
    services: [
      {
        slug: 'corporate-websites',
        timelineDays: [7, 14],
        planet: {
          shape: 'icosahedron',
          material: 'glass',
          size: 0.63,
          shell: 'wireframe',
          orbit: { radius: 2.7, tilt: 6, speed: 0.16, phase: 0.1 },
        },
      },
      {
        slug: 'online-stores',
        timelineDays: [14, 28],
        planet: {
          shape: 'torus-knot',
          material: 'glass',
          size: 0.52,
          moons: { count: 3, kind: 'cube' },
          orbit: { radius: 3.8, tilt: -10, speed: 0.11, phase: 0.73 },
        },
      },
      {
        slug: 'landing-pages',
        timelineDays: [3, 7],
        planet: {
          shape: 'octahedron',
          material: 'hologram',
          size: 0.48,
          rings: [{ inner: 1.5, outer: 1.9, tilt: 20 }],
          orbit: { radius: 4.9, tilt: 14, speed: 0.085, phase: 0.36 },
        },
      },
      {
        slug: 'web-apps',
        timelineDays: [21, 42],
        planet: {
          shape: 'sphere',
          material: 'glass',
          size: 0.69,
          shell: 'wireframe',
          moons: { count: 2, kind: 'shard' },
          orbit: { radius: 6.1, tilt: -6, speed: 0.06, phase: 0.99 },
        },
      },
    ],
  },
  {
    id: 'crm',
    order: 2,
    dna: { color: '#FF6B8B', glow: '#FFC2D0', core: 'strata' },
    services: [
      {
        slug: 'crm-implementation',
        timelineDays: [7, 14],
        planet: {
          shape: 'sphere',
          material: 'hologram',
          size: 0.63,
          rings: [{ inner: 1.4, outer: 2.2, bands: 6 }],
          orbit: { radius: 2.8, tilt: -8, speed: 0.14, phase: 0.1 },
        },
      },
      {
        slug: 'custom-crm',
        timelineDays: [21, 35],
        planet: {
          shape: 'sphere',
          material: 'liquid-metal',
          size: 0.57,
          rings: [
            { inner: 1.3, outer: 1.7, tilt: 30, bands: 4 },
            { inner: 1.9, outer: 2.5, tilt: -20, bands: 8 },
          ],
          orbit: { radius: 3.9, tilt: 12, speed: 0.1, phase: 0.73 },
        },
      },
      {
        slug: 'sales-funnels',
        timelineDays: [3, 7],
        planet: {
          shape: 'funnel',
          material: 'glass',
          size: 0.63,
          moons: { count: 5, kind: 'orb', radius: 1.6, speed: 0.9 },
          orbit: { radius: 5, tilt: -14, speed: 0.075, phase: 0.36 },
        },
      },
      {
        slug: 'reports-dashboards',
        timelineDays: [7, 14],
        planet: {
          shape: 'cube-cluster',
          material: 'hologram',
          size: 0.57,
          rings: [{ inner: 1.6, outer: 2, tilt: 10, bands: 12 }],
          orbit: { radius: 6.2, tilt: 5, speed: 0.055, phase: 0.99 },
        },
      },
    ],
  },
  {
    id: 'automation',
    order: 3,
    dna: { color: '#FFA53B', glow: '#FFE0A8', core: 'forge' },
    services: [
      {
        slug: 'api-integrations',
        timelineDays: [3, 10],
        planet: {
          shape: 'gear',
          material: 'liquid-metal',
          size: 0.63,
          moons: { count: 6, kind: 'conveyor', radius: 2, speed: 0.8 },
          orbit: { radius: 2.9, tilt: 4, speed: 0.15, phase: 0.22 },
        },
      },
      {
        slug: 'document-automation',
        timelineDays: [7, 14],
        planet: {
          shape: 'cube-cluster',
          material: 'liquid-metal',
          size: 0.57,
          moons: { count: 4, kind: 'cube' },
          orbit: { radius: 4, tilt: -12, speed: 0.1, phase: 0.85 },
        },
      },
      {
        slug: 'notifications-reminders',
        timelineDays: [2, 5],
        planet: {
          shape: 'torus',
          material: 'emissive',
          size: 0.52,
          moons: { count: 3, kind: 'orb', speed: 1.2 },
          orbit: { radius: 5.1, tilt: 16, speed: 0.08, phase: 0.49 },
        },
      },
      {
        slug: 'data-processing',
        timelineDays: [7, 14],
        planet: {
          shape: 'sphere',
          material: 'liquid-metal',
          size: 0.69,
          shell: 'wireframe',
          moons: { count: 8, kind: 'conveyor', radius: 1.7 },
          orbit: { radius: 6.3, tilt: -4, speed: 0.058, phase: 0.12 },
        },
      },
    ],
  },
  {
    id: 'ai',
    order: 4,
    dna: { color: '#B57BFF', glow: '#F3B8FF', core: 'neural' },
    services: [
      {
        slug: 'ai-assistants',
        timelineDays: [7, 14],
        planet: {
          shape: 'blob',
          material: 'iridescent',
          size: 0.69,
          orbit: { radius: 2.8, tilt: 10, speed: 0.13, phase: 0.37 },
        },
      },
      {
        slug: 'ai-document-processing',
        timelineDays: [14, 21],
        planet: {
          shape: 'crystal',
          material: 'iridescent',
          size: 0.57,
          shell: 'hologram',
          orbit: { radius: 3.9, tilt: -14, speed: 0.095, phase: 1.0 },
        },
      },
      {
        slug: 'content-generation',
        timelineDays: [3, 7],
        planet: {
          shape: 'blob',
          material: 'iridescent',
          size: 0.55,
          rings: [{ inner: 1.5, outer: 2.1, tilt: 25, bands: 3 }],
          moons: { count: 3, kind: 'shard' },
          orbit: { radius: 5, tilt: 8, speed: 0.075, phase: 0.63 },
        },
      },
      {
        slug: 'ai-analytics',
        timelineDays: [14, 21],
        planet: {
          shape: 'torus-knot',
          material: 'hologram',
          size: 0.52,
          orbit: { radius: 6.1, tilt: -8, speed: 0.055, phase: 0.26 },
        },
      },
    ],
  },
  {
    id: 'telegram',
    order: 5,
    dna: { color: '#4AA8FF', glow: '#BFE3FF', core: 'comet' },
    services: [
      {
        slug: 'sales-orders',
        timelineDays: [7, 14],
        planet: {
          shape: 'dart',
          material: 'glass',
          size: 0.52,
          trail: true,
          orbit: { radius: 2.9, tilt: 12, speed: 0.2, phase: 0.03 },
        },
      },
      {
        slug: 'booking',
        timelineDays: [7, 14],
        planet: {
          shape: 'sphere',
          material: 'hologram',
          size: 0.57,
          rings: [{ inner: 1.4, outer: 1.8, tilt: -15, bands: 7 }],
          orbit: { radius: 3.9, tilt: -6, speed: 0.12, phase: 0.66 },
        },
      },
      {
        slug: 'customer-support',
        timelineDays: [5, 10],
        planet: {
          shape: 'dart',
          material: 'emissive',
          size: 0.46,
          trail: true,
          moons: { count: 2, kind: 'orb' },
          orbit: { radius: 5, tilt: 18, speed: 0.09, phase: 0.3 },
        },
      },
      {
        slug: 'mini-apps',
        timelineDays: [14, 28],
        planet: {
          shape: 'cube-cluster',
          material: 'glass',
          size: 0.57,
          shell: 'wireframe',
          orbit: { radius: 6.1, tilt: -10, speed: 0.065, phase: 0.93 },
        },
      },
    ],
  },
] satisfies CategoryInput[];
