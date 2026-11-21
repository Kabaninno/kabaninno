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
 * with real projects and flip `status` to 'published'.
 */
export const projectsData = [
  {
    slug: 'bakery-telegram-orders',
    status: 'draft',
    year: 2026,
    categories: ['telegram', 'web'],
    services: ['telegram/sales-orders', 'web/landing-pages'],
    stack: ['Telegram Bot API', 'Node.js', 'PostgreSQL', 'Next.js'],
    demo: { type: 'mockup', variant: 'telegram-chat' },
  },
  {
    slug: 'dental-clinic-crm',
    status: 'draft',
    year: 2026,
    categories: ['crm', 'automation'],
    services: ['crm/crm-implementation', 'automation/notifications-reminders'],
    stack: ['CRM', 'Make', 'SMS API', 'Google Calendar API'],
    demo: { type: 'mockup', variant: 'dashboard' },
  },
  {
    slug: 'logistics-document-ai',
    status: 'draft',
    year: 2025,
    categories: ['ai', 'automation'],
    services: ['ai/ai-document-processing', 'automation/data-processing'],
    stack: ['Python', 'OCR', 'LLM API', 'REST API'],
    demo: { type: 'mockup', variant: 'dashboard' },
  },
  {
    slug: 'fitness-studio-platform',
    status: 'draft',
    year: 2025,
    categories: ['web', 'telegram', 'crm'],
    services: ['web/corporate-websites', 'telegram/mini-apps', 'crm/custom-crm'],
    stack: ['Next.js', 'Telegram Mini Apps', 'Node.js', 'PostgreSQL'],
    demo: { type: 'mockup', variant: 'booking' },
  },
] satisfies ProjectInput[];
