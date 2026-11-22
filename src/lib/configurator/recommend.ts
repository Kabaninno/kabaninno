import type { ConfiguratorDraft } from './draft';
import { allServices, findGoal, type ConfiguratorModel } from './model';

/**
 * The recommendation (D149): which services the goals and their answers lead
 * to, and which services the visitor ends up with after dropping some and
 * adding others. Pure functions of the draft and the model.
 */

type RecommendationInput = Pick<ConfiguratorDraft, 'mode' | 'goals' | 'answers'>;

/**
 * Services recommended for the answered goals, at most `model.maxRecommended`.
 * Each goal contributes the services of its chosen option, most important
 * first; they are taken rank by rank across goals (every goal's first service,
 * then every goal's second one…), so with three goals none is cut out by the
 * limit before the others get a second service. Duplicates count once. The
 * "unsure" goal, unanswered goals and manual mode recommend nothing.
 */
export function recommendedServices(
  model: ConfiguratorModel,
  draft: RecommendationInput,
): string[] {
  if (draft.mode === 'manual') return [];
  const lists: string[][] = [];
  for (const goalId of draft.goals) {
    const goal = findGoal(model, goalId);
    const option = goal?.options.find((item) => item.id === draft.answers[goalId]);
    if (option) lists.push(option.services);
  }
  const result: string[] = [];
  const depth = Math.max(0, ...lists.map((list) => list.length));
  for (let rank = 0; rank < depth; rank += 1) {
    for (const list of lists) {
      const id = list[rank];
      if (id !== undefined && !result.includes(id)) result.push(id);
    }
  }
  return result.slice(0, model.maxRecommended);
}

/**
 * The services the request is about: the recommended ones minus those the
 * visitor removed, plus those they added (from a planet page, "Add more" or
 * the manual mode). In content order, so the lists group by category.
 */
export function selectedServices(
  model: ConfiguratorModel,
  draft: RecommendationInput & Pick<ConfiguratorDraft, 'removed' | 'added'>,
): string[] {
  const kept = recommendedServices(model, draft).filter((id) => !draft.removed.includes(id));
  const chosen = new Set([...kept, ...draft.added]);
  return allServices(model)
    .map((service) => service.id)
    .filter((id) => chosen.has(id));
}

/** Categories of the selected services, in content order (the solution's headline). */
export function categoriesOf(model: ConfiguratorModel, services: readonly string[]): string[] {
  const used = new Set(services.map((id) => id.split('/')[0] ?? ''));
  return model.categories.filter((category) => used.has(category));
}
