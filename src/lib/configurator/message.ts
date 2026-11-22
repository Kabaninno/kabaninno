import type { ConfiguratorDraft } from './draft';
import { GOAL_UNSURE, HAVE_NONE } from './model';
import { TELEGRAM_URL_BUDGET, fitTextToUrl } from './telegram';
import { graphemes, normalizeSpaces, truncateGraphemes } from './text';

/**
 * The lead message the visitor sends via Telegram or WhatsApp, written as the
 * client's own request in the first person (round 3, B3, D158):
 *
 *   Доброго дня!
 *   Мене звати {name}. Хочу скористатися послугами KABANINNO.
 *
 *   Мій бізнес: {industry}.
 *   Хочу покращити: {goals}.
 *   {one short sentence per answered question}
 *   Що вже є: {have}.
 *
 *   На сайті мені підібрали: {Category + Category} — {services}.
 *   Орієнтовно: {price}, {timeline}.
 *
 *   {comment}
 *
 *   Чи можемо обговорити деталі?
 *
 * Lines without data are left out. Without services ("not sure yet" picks
 * none) one consultation sentence replaces the two solution lines. Pure and
 * locale-agnostic: every word comes from `labels` (ui.json, resolved on the
 * server), so the same function serves pl, en and uk; the wording is
 * gender-neutral as long as the labels are (D14).
 *
 * The generated text is the default for the last step; the visitor may edit
 * it, and the hand-off sends whatever text it is given.
 */

export interface LeadLabels {
  /** The interface locale (lower-casing list items). */
  locale: string;
  /** "Доброго дня!" */
  greeting: string;
  /** "Мене звати {name}." */
  introName: string;
  /** "Хочу скористатися послугами KABANINNO." */
  intro: string;
  /** "Мій бізнес: {industry}." */
  business: string;
  /** "Хочу покращити: {goals}." */
  improve: string;
  /** "Що вже є: {items}." */
  have: string;
  /** "Nothing of these" as a sentence. */
  haveNone: string;
  /** "На сайті мені підібрали: {combo} — {services}." */
  picked: string;
  /** "Орієнтовно: {price}, {timeline}." */
  estimate: string;
  /** Instead of the solution lines: "not sure yet, I'd like a consultation". */
  consultation: string;
  /** "Чи можемо обговорити деталі?" */
  closing: string;
  /** The goal as it reads after "I want to improve:", by goal id. */
  goalPhrases: Record<string, string>;
  /** One sentence per answer, by goal id and option id ("don't know" has none). */
  answers: Record<string, Record<string, string>>;
  haveNames: Record<string, string>;
  categories: Record<string, string>;
  /** By service id `"<category>/<slug>"`. */
  serviceNames: Record<string, string>;
  industries: Record<string, string>;
}

/** The estimate, already formatted ("1 800–4 000 zł", "1–2 тижні"), or null for none. */
export interface LeadEstimate {
  price: string;
  timeline: string;
}

/**
 * `full`: the template above, paragraphs separated by blank lines.
 * `compact`: for a link that has to stay short (Ukrainian text takes six URL
 * characters per letter): no blank lines, and the answer sentences and "what we
 * already have" are left out.
 */
export type LeadFormat = 'full' | 'compact';

export interface LeadOptions {
  format?: LeadFormat;
  estimate?: LeadEstimate | null;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** Lower-cases the first letter of a list item, unless it starts an acronym ("CRM", "AI"). */
function lowerFirst(text: string, locale: string): string {
  const [first = '', second = ''] = Array.from(text);
  if (second && second !== second.toLocaleLowerCase(locale)) return text;
  return first.toLocaleLowerCase(locale) + text.slice(first.length);
}

/** The services a lead is about (`servicesOf`), resolved by the caller. */
export function buildLeadMessage(
  draft: ConfiguratorDraft,
  services: readonly string[],
  labels: LeadLabels,
  { format = 'full', estimate = null }: LeadOptions = {},
): string {
  const compact = format === 'compact';
  const name = collapse(draft.contact.name);
  const comment = draft.contact.comment.trim();
  const industryOther = collapse(draft.industryOther);
  const industry =
    draft.industry === null || draft.industry === 'other'
      ? industryOther
      : lowerFirst(labels.industries[draft.industry] ?? draft.industry, labels.locale);
  const goals = draft.goals
    .filter((id) => id !== GOAL_UNSURE)
    .map((id) => labels.goalPhrases[id] ?? id);
  const answers = draft.goals.flatMap((id) => {
    const answer = draft.answers[id];
    const sentence = answer === undefined ? undefined : labels.answers[id]?.[answer];
    return sentence ? [sentence] : [];
  });
  const have = draft.have.includes(HAVE_NONE)
    ? labels.haveNone
    : draft.have.length > 0
      ? fill(labels.have, {
          items: draft.have
            .map((id) => lowerFirst(labels.haveNames[id] ?? id, labels.locale))
            .join(', '),
        })
      : '';

  const opening = [labels.greeting, [name && fill(labels.introName, { name }), labels.intro]];
  const about = [
    industry && fill(labels.business, { industry }),
    goals.length > 0 && fill(labels.improve, { goals: goals.join(', ') }),
    ...(compact ? [] : [answers.join(' '), have]),
  ];
  const solution: (string | false)[] = [];
  if (services.length === 0) solution.push(labels.consultation);
  else {
    const combo = [
      ...new Set(services.map((id) => labels.categories[id.split('/')[0] ?? ''] ?? id)),
    ].join(' + ');
    const names = services.map((id) => labels.serviceNames[id] ?? id).join(', ');
    solution.push(fill(labels.picked, { combo, services: names }));
    if (estimate) solution.push(fill(labels.estimate, { ...estimate }));
  }
  const paragraphs: (string | false | (string | false)[])[][] = [
    opening,
    about,
    solution,
    [compact ? collapse(comment) : comment],
    [labels.closing],
  ];
  const lines = (paragraph: (typeof paragraphs)[number]) =>
    paragraph
      .map((line) => (Array.isArray(line) ? line.filter(Boolean).join(' ') : line))
      .filter((line): line is string => Boolean(line));
  const blocks = paragraphs.map(lines).filter((block) => block.length > 0);
  return normalizeSpaces(blocks.map((block) => block.join('\n')).join(compact ? '\n' : '\n\n'));
}

export interface FittedLeadMessage {
  text: string;
  format: LeadFormat;
  /** The comment (or, as a last resort, the whole text) was shortened. */
  truncated: boolean;
}

/**
 * The default message within a link budget (`toUrl` builds the Telegram or
 * WhatsApp link): the full format if it fits, otherwise the compact one,
 * otherwise the compact one with the comment shortened (grapheme-safe, with
 * "…"); as a last resort the whole compact text is cut. The visitor can always
 * copy the untruncated full text.
 */
export function fitLeadMessage(
  draft: ConfiguratorDraft,
  services: readonly string[],
  labels: LeadLabels,
  {
    toUrl,
    estimate = null,
    maxUrlLength = TELEGRAM_URL_BUDGET,
  }: { toUrl: (text: string) => string; estimate?: LeadEstimate | null; maxUrlLength?: number },
): FittedLeadMessage {
  const fits = (text: string) => toUrl(text).length <= maxUrlLength;
  const full = buildLeadMessage(draft, services, labels, { format: 'full', estimate });
  if (fits(full)) return { text: full, format: 'full', truncated: false };
  const compact = buildLeadMessage(draft, services, labels, { format: 'compact', estimate });
  if (fits(compact)) return { text: compact, format: 'compact', truncated: false };
  const comment = draft.contact.comment.trim();
  const withComment = (count: number) =>
    buildLeadMessage(
      {
        ...draft,
        contact: { ...draft.contact, comment: count > 0 ? truncateGraphemes(comment, count) : '' },
      },
      services,
      labels,
      { format: 'compact', estimate },
    );
  const units = graphemes(comment).length;
  if (units > 0 && fits(withComment(0))) {
    let low = 0;
    let high = units - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (fits(withComment(middle))) low = middle;
      else high = middle - 1;
    }
    return { text: withComment(low), format: 'compact', truncated: true };
  }
  const fitted = fitTextToUrl(withComment(0), toUrl, maxUrlLength);
  return { text: fitted.text, format: 'compact', truncated: true };
}
