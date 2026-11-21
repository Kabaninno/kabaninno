import type { ProjectInput } from './schema';

/**
 * Portfolio cases. Texts live in `messages/<locale>/content.json` under
 * `projects.<slug>`.
 *
 * `status: 'draft'` cases are visible only in `npm run dev` or when building
 * with `SHOW_DRAFTS=true`. Production builds (GitHub Pages) include only
 * `published` cases.
 *
 * TODO(content): all four cases below are fictional placeholders. Replace them
 * with real projects and flip `status` to 'published'. Their galleries are
 * generated placeholders (`node scripts/portfolio-placeholders.mjs`); demos
 * cover the mockup variants and one live iframe. A `video` demo is supported
 * too: `{ type: 'video', src: '/portfolio/<slug>/demo.mp4', poster: '…' }`.
 */
export const projectsData = [
  {
    slug: 'bakery-telegram-orders',
    status: 'draft',
    year: 2026,
    categories: ['telegram', 'web'],
    services: ['telegram/sales-orders', 'web/landing-pages'],
    stack: ['Telegram Bot API', 'Node.js', 'PostgreSQL', 'Next.js'],
    gallery: [
      { src: '/portfolio/bakery-telegram-orders/1.svg', width: 1200, height: 750 },
      { src: '/portfolio/bakery-telegram-orders/2.svg', width: 1200, height: 750 },
      { src: '/portfolio/bakery-telegram-orders/3.svg', width: 1200, height: 750 },
    ],
    demo: { type: 'mockup', variant: 'telegram-chat' },
  },
  {
    slug: 'dental-clinic-crm',
    status: 'draft',
    year: 2026,
    categories: ['crm', 'automation'],
    services: ['crm/crm-implementation', 'automation/notifications-reminders'],
    stack: ['CRM', 'Make', 'SMS API', 'Google Calendar API'],
    gallery: [
      { src: '/portfolio/dental-clinic-crm/1.svg', width: 1200, height: 750 },
      { src: '/portfolio/dental-clinic-crm/2.svg', width: 1200, height: 750 },
    ],
    demo: { type: 'mockup', variant: 'dashboard' },
  },
  {
    slug: 'logistics-document-ai',
    status: 'draft',
    year: 2025,
    categories: ['ai', 'automation'],
    services: ['ai/ai-document-processing', 'automation/data-processing'],
    stack: ['Python', 'OCR', 'LLM API', 'REST API'],
    gallery: [
      { src: '/portfolio/logistics-document-ai/1.svg', width: 1200, height: 750 },
      { src: '/portfolio/logistics-document-ai/2.svg', width: 1200, height: 750 },
    ],
    // Exercises the live-iframe demo path in dev / SHOW_DRAFTS builds (harmless public page).
    demo: { type: 'iframe', url: 'https://example.com/' },
  },
  {
    slug: 'fitness-studio-platform',
    status: 'draft',
    year: 2025,
    categories: ['web', 'telegram', 'crm'],
    services: ['web/corporate-websites', 'telegram/mini-apps', 'crm/custom-crm'],
    stack: ['Next.js', 'Telegram Mini Apps', 'Node.js', 'PostgreSQL'],
    gallery: [
      { src: '/portfolio/fitness-studio-platform/1.svg', width: 1200, height: 750 },
      { src: '/portfolio/fitness-studio-platform/2.svg', width: 1200, height: 750 },
      { src: '/portfolio/fitness-studio-platform/3.svg', width: 1200, height: 750 },
    ],
    demo: { type: 'mockup', variant: 'booking' },
  },
] satisfies ProjectInput[];
