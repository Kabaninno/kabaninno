import type { ConfiguratorDraft } from './draft';
import { GOAL_UNSURE } from './model';
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
 * The generated text is the default for the last step; the visitor may edit
 * it, and the submitter sends whatever text it is given.
 */

export interface LeadLabels {
  /** First line, e.g. "Zapytanie ze strony KABANINNO". */
  title: string;
  /** Section names. */
  goals: string;
  have: string;
  solution: string;
  services: string;
  industry: string;
  budget: string;
  timeline: string;
  name: string;
  comment: string;
  /** The goal line of "I don't know yet, advise me". */
  unsure: string;
  /** In place of the services when there are none: to be chosen on a consultation. */
  consultation: string;
  /** Option names by id; ids without a label are printed as they are. */
  goalNames: Record<string, string>;
  /** The chosen answer's wording, by goal id and option id. */
  answers: Record<string, Record<string, string>>;
  haveNames: Record<string, string>;
  categories: Record<string, string>;
  /** By service id `"<category>/<slug>"`. */
  serviceNames: Record<string, string>;
  industries: Record<string, string>;
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

/** The services a lead is about (`servicesOf`), resolved by the caller. */
export function buildLeadMessage(
  draft: ConfiguratorDraft,
  services: readonly string[],
  labels: LeadLabels,
  { format = 'full' }: { format?: LeadFormat } = {},
): string {
  const compact = format === 'compact';
  const goals = draft.goals.map((id) => {
    if (id === GOAL_UNSURE) return labels.unsure;
    const answer = draft.answers[id];
    const name = label(labels.goalNames, id);
    return answer !== undefined ? `${name} (${label(labels.answers[id] ?? {}, answer)})` : name;
  });
  const have = draft.have.map((id) => label(labels.haveNames, id));
  const categories = [
    ...new Set(services.map((id) => label(labels.categories, id.split('/')[0] ?? ''))),
  ];
  const names = services.map((id) => label(labels.serviceNames, id));
  const industryOther = collapse(draft.industryOther);
  const industry =
    draft.industry === null
      ? null
      : draft.industry === 'other' && industryOther
        ? industryOther
        : label(labels.industries, draft.industry);
  const name = collapse(draft.contact.name);
  const comment = draft.contact.comment.trim();

  const blocks: string[][] = [[labels.title]];
  const details: string[] = [];
  if (goals.length > 0) {
    if (compact) details.push(`${labels.goals}: ${goals.join('; ')}`);
    else details.push(`${labels.goals}:`, ...goals.map((goal) => `• ${goal}`));
  }
  if (have.length > 0) details.push(`${labels.have}: ${have.join(', ')}`);
  if (names.length > 0) {
    details.push(`${labels.solution}: ${categories.join(' + ')}`);
    if (compact) details.push(`${labels.services}: ${names.join(', ')}`);
    else details.push(`${labels.services}:`, ...names.map((service) => `• ${service}`));
  } else {
    details.push(`${labels.solution}: ${labels.consultation}`);
  }
  if (industry) details.push(`${labels.industry}: ${industry}`);
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
  services: readonly string[],
  labels: LeadLabels,
  { username, maxUrlLength = TELEGRAM_URL_BUDGET }: { username: string; maxUrlLength?: number },
): FittedLeadMessage {
  const full = buildLeadMessage(draft, services, labels, { format: 'full' });
  if (fitsTelegramBudget(username, full, maxUrlLength)) {
    return { text: full, format: 'full', truncated: false };
  }
  const compact = buildLeadMessage(draft, services, labels, { format: 'compact' });
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
      services,
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
