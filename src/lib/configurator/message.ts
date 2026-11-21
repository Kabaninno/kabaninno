import type { ConfiguratorDraft } from './draft';
import { TELEGRAM_URL_BUDGET, fitTextToTelegramUrl, fitsTelegramBudget } from './telegram';
import { graphemes, normalizeSpaces, truncateGraphemes } from './text';

/**
 * The lead message the visitor sends via Telegram (BRIEF: a tidy message in
 * the interface language that the visitor can review and edit). Pure and
 * locale-agnostic: every word comes from `labels` (ui.json / content texts,
 * resolved by the caller), so the same function serves pl, en and uk. The
 * generator only joins labels and the visitor's own words, so the wording
 * stays gender-neutral as long as the labels are (D14).
 *
 * The generated text is the default for the summary step; the visitor may
 * edit it, and the submitter sends whatever text it is given.
 */

export interface LeadLabels {
  /** First line, e.g. "Zapytanie ze strony KABANINNO". */
  title: string;
  /** Section names. */
  types: string;
  features: string;
  business: string;
  website: string;
  crm: string;
  budget: string;
  timeline: string;
  name: string;
  comment: string;
  yes: string;
  no: string;
  /** Option names by id; ids without a label are printed as they are. */
  categories: Record<string, string>;
  /** By feature id `"<category>/<key>"`. */
  featureNames: Record<string, string>;
  industries: Record<string, string>;
  sizes: Record<string, string>;
  /** By budget id, including "not-sure" (amounts already formatted). */
  budgets: Record<string, string>;
  timelines: Record<string, string>;
}

/**
 * `full`: readable, one item per line, blank lines between blocks.
 * `compact`: one line per section, comma-separated, for long requests.
 */
export type LeadFormat = 'full' | 'compact';

const label = (names: Record<string, string>, id: string) => names[id] ?? id;

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function buildLeadMessage(
  draft: ConfiguratorDraft,
  labels: LeadLabels,
  { format = 'full' }: { format?: LeadFormat } = {},
): string {
  const compact = format === 'compact';
  const types = draft.types.map((id) => label(labels.categories, id));
  const features = draft.features.map((id) => label(labels.featureNames, id));
  const { industry, size, hasWebsite, hasCrm } = draft.business;
  const company = [
    industry !== null ? label(labels.industries, industry) : null,
    size !== null ? label(labels.sizes, size) : null,
  ].filter((part): part is string => part !== null);
  const yesNo = (value: 'yes' | 'no') => (value === 'yes' ? labels.yes : labels.no);
  const presence = [
    hasWebsite !== null ? `${labels.website}: ${yesNo(hasWebsite)}` : null,
    hasCrm !== null ? `${labels.crm}: ${yesNo(hasCrm)}` : null,
  ].filter((part): part is string => part !== null);
  const name = collapse(draft.contact.name);
  const comment = draft.contact.comment.trim();

  const blocks: string[][] = [[labels.title]];
  const details: string[] = [];
  if (types.length > 0) details.push(`${labels.types}: ${types.join(', ')}`);
  if (features.length > 0) {
    if (compact) details.push(`${labels.features}: ${features.join(', ')}`);
    else details.push(`${labels.features}:`, ...features.map((feature) => `• ${feature}`));
  }
  if (company.length > 0 || presence.length > 0) {
    if (compact) {
      details.push(
        [company.length > 0 ? `${labels.business}: ${company.join(', ')}` : null, ...presence]
          .filter(Boolean)
          .join('; '),
      );
    } else {
      if (company.length > 0) details.push(`${labels.business}: ${company.join(', ')}`);
      if (presence.length > 0) details.push(presence.join(' · '));
    }
  }
  const budget =
    draft.budget !== null ? `${labels.budget}: ${label(labels.budgets, draft.budget)}` : null;
  const timeline =
    draft.timeline !== null
      ? `${labels.timeline}: ${label(labels.timelines, draft.timeline)}`
      : null;
  if (compact) {
    const plan = [budget, timeline].filter(Boolean).join(' · ');
    if (plan) details.push(plan);
  } else {
    if (budget) details.push(budget);
    if (timeline) details.push(timeline);
  }
  if (name) details.push(`${labels.name}: ${name}`);

  if (compact) {
    blocks[0]!.push(...details);
    if (comment) blocks[0]!.push(`${labels.comment}: ${collapse(comment)}`);
  } else {
    if (details.length > 0) blocks.push(details);
    if (comment) blocks.push([`${labels.comment}:`, comment]);
  }
  return normalizeSpaces(blocks.map((lines) => lines.join('\n')).join('\n\n'));
}

export interface FittedLeadMessage {
  text: string;
  format: LeadFormat;
  /** The comment (or, as a last resort, the whole text) was shortened. */
  truncated: boolean;
}

/**
 * The default message within the Telegram URL budget: the full format if it
 * fits, otherwise the compact one, otherwise the compact one with the
 * comment shortened (grapheme-safe, with "…"); as a last resort the whole
 * compact text is cut. The visitor can always copy the untruncated full text.
 */
export function fitLeadMessage(
  draft: ConfiguratorDraft,
  labels: LeadLabels,
  { username, maxUrlLength = TELEGRAM_URL_BUDGET }: { username: string; maxUrlLength?: number },
): FittedLeadMessage {
  const full = buildLeadMessage(draft, labels, { format: 'full' });
  if (fitsTelegramBudget(username, full, maxUrlLength)) {
    return { text: full, format: 'full', truncated: false };
  }
  const compact = buildLeadMessage(draft, labels, { format: 'compact' });
  if (fitsTelegramBudget(username, compact, maxUrlLength)) {
    return { text: compact, format: 'compact', truncated: false };
  }
  const comment = draft.contact.comment.trim();
  const withComment = (count: number) =>
    buildLeadMessage(
      {
        ...draft,
        contact: { ...draft.contact, comment: count > 0 ? truncateGraphemes(comment, count) : '' },
      },
      labels,
      { format: 'compact' },
    );
  const units = graphemes(comment).length;
  if (units > 0 && fitsTelegramBudget(username, withComment(0), maxUrlLength)) {
    let low = 0;
    let high = units - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (fitsTelegramBudget(username, withComment(middle), maxUrlLength)) low = middle;
      else high = middle - 1;
    }
    return { text: withComment(low), format: 'compact', truncated: true };
  }
  const fitted = fitTextToTelegramUrl(username, withComment(0), maxUrlLength);
  return { text: fitted.text, format: 'compact', truncated: true };
}
