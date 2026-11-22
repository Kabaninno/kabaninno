/**
 * M4 "Configurator + Telegram", UI side, for the solution finder (D149).
 *
 * Covers: the five steps and their validation, the goal limit and "not sure
 * yet", the manual mode ("I know what I need"), the recommendation and its
 * edits (remove / add more), budgets by level, persistence across reload,
 * prefill from `?add=` and from the request draft, the message in pl and uk,
 * the Telegram link (encoded, within the budget, leading "@" rule) or the
 * unconfigured state, the Copy fallback, and "Start over".
 */
import type { Page } from '@playwright/test';
import { siteConfig } from '~/site.config';
import { isValidTelegramUsername } from '@/lib/configurator/telegram';
import { expect, test } from '../support/fixtures';
import { sitePath } from '../support/env';
import {
  CONFIGURATOR_KEY,
  DRAFT,
  DRAFT_SERVICES,
  storedConfigurator,
} from '../support/configurator';
import { categoryName, localized, paths, serviceTitle, ui, type TestLocale } from '../support/site';

const REQUEST_KEY = 'kabaninno.request.v1';
const configured = isValidTelegramUsername(siteConfig.telegramUsername.replace(/^@/, ''));
const cfg = ui.pl.configurator;
const goal = <K extends keyof typeof cfg.goals.items>(id: K) => cfg.goals.items[id];

const open = (page: Page, locale: TestLocale = 'pl', query = '') =>
  page.goto(`${sitePath(localized(locale, paths.configurator()))}${query}`);

async function seed(page: Page, step: string, draft: object = DRAFT) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    CONFIGURATOR_KEY,
    JSON.stringify(storedConfigurator(step, draft)),
  ] as const);
}

/** Seeds the stored draft on the first load only (a reload keeps what the page saved). */
async function seedOnce(page: Page, step: string, draft: object = DRAFT) {
  await page.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem('e2e-seeded')) return;
      sessionStorage.setItem('e2e-seeded', '1');
      localStorage.setItem(key, value);
    },
    [CONFIGURATOR_KEY, JSON.stringify(storedConfigurator(step, draft))] as const,
  );
}

const panel = (page: Page) => page.locator('main [data-route-ui]');
const stepTitle = (page: Page) => panel(page).locator('#cfg-step-title');
const next = (page: Page) => panel(page).getByRole('button', { name: cfg.nav.next });
const checkGoal = (page: Page, id: keyof typeof cfg.goals.items) =>
  panel(page)
    .getByRole('checkbox', { name: goal(id).name, exact: true })
    .check();

test.describe('goals and details', () => {
  test('Next without a goal shows the error and focuses the first goal', async ({ page }) => {
    await open(page);
    await expect(stepTitle(page)).toHaveText(cfg.titles.goals);
    await expect(panel(page)).toContainText('Krok 1 z 5');
    await next(page).click();
    await expect(panel(page)).toContainText(cfg.errors.requiredMulti);
    const first = panel(page).locator('#cfg-goals-0');
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute('aria-invalid', 'true');
    await expect(first).toHaveAttribute('aria-describedby', /cfg-goals-error/);

    await checkGoal(page, 'more-clients');
    await next(page).click();
    await expect(stepTitle(page)).toHaveText(cfg.titles.details);
    await expect(stepTitle(page)).toBeFocused();
    await expect(panel(page)).toContainText('Krok 2 z 5');
  });

  test('at most three goals; "not sure yet" replaces them all', async ({ page }) => {
    await open(page);
    await checkGoal(page, 'more-clients');
    await checkGoal(page, 'online-orders');
    await checkGoal(page, 'booking');
    await expect(
      panel(page).getByRole('checkbox', { name: goal('client-order').name, exact: true }),
    ).toBeDisabled();
    await panel(page).getByRole('checkbox', { name: cfg.goals.unsure }).check();
    await expect(
      panel(page).getByRole('checkbox', { name: goal('more-clients').name, exact: true }),
    ).not.toBeChecked();
    await expect(
      panel(page).getByRole('checkbox', { name: goal('client-order').name, exact: true }),
    ).toBeEnabled();
    // Picking a real goal again drops "not sure".
    await checkGoal(page, 'booking');
    await expect(panel(page).getByRole('checkbox', { name: cfg.goals.unsure })).not.toBeChecked();
  });

  test('each goal needs an answer; the shared question is optional', async ({ page }) => {
    await open(page);
    await checkGoal(page, 'booking');
    await checkGoal(page, 'less-routine');
    await next(page).click();
    // One question per goal, then "what do you already have".
    await expect(panel(page).getByRole('group', { name: goal('booking').question })).toBeVisible();
    await expect(panel(page).getByRole('group', { name: cfg.have.legend })).toBeVisible();
    await next(page).click();
    await expect(panel(page)).toContainText(cfg.errors.requiredOne);
    await expect(panel(page).locator('#cfg-answers-booking-0')).toBeFocused();
    await panel(page)
      .getByRole('radio', { name: goal('booking').options.phone, exact: true })
      .check();
    await panel(page)
      .getByRole('radio', { name: goal('less-routine').options.documents, exact: true })
      .check();
    await next(page).click();
    await expect(stepTitle(page)).toHaveText(cfg.titles.solution);
  });

  test('"not sure yet": only the shared question, then a consultation', async ({ page }) => {
    await open(page);
    await panel(page).getByRole('checkbox', { name: cfg.goals.unsure }).check();
    await next(page).click();
    await expect(panel(page)).toContainText(cfg.details.unsureNote);
    await expect(panel(page).getByRole('radio')).toHaveCount(0);
    await panel(page).getByRole('checkbox', { name: cfg.have.items.none }).check();
    await next(page).click();
    await expect(stepTitle(page)).toHaveText(cfg.titles.solution);
    await expect(panel(page)).toContainText(cfg.solution.consultation);
    await expect(panel(page).getByRole('button', { name: cfg.solution.addMore })).toBeVisible();
  });

  test('"nothing of these" excludes the other answers', async ({ page }) => {
    await open(page);
    await checkGoal(page, 'booking');
    await next(page).click();
    const have = (key: keyof typeof cfg.have.items) =>
      panel(page).getByRole('checkbox', { name: cfg.have.items[key], exact: true });
    await have('website').check();
    await have('social').check();
    await have('none').check();
    await expect(have('website')).not.toBeChecked();
    await expect(have('social')).not.toBeChecked();
    await have('social').check();
    await expect(have('none')).not.toBeChecked();
  });
});

test.describe('manual mode', () => {
  test('"I know what I need" skips the details step and starts with the full list', async ({
    page,
  }) => {
    await open(page);
    await panel(page).getByRole('button', { name: cfg.goals.knowIt }).click();
    await expect(stepTitle(page)).toHaveText(cfg.titles.solution);
    await expect(panel(page)).toContainText('Krok 2 z 4');
    await expect(panel(page)).toContainText(cfg.solution.consultation);
    // The list is open while nothing is picked.
    await panel(page)
      .getByRole('checkbox', { name: serviceTitle('pl', 'web', 'landing-pages'), exact: true })
      .check();
    await expect(panel(page)).toContainText(
      cfg.solution.fits.replace('{combo}', categoryName('pl', 'web')),
    );
    await expect(
      panel(page).getByRole('button', { name: cfg.solution.backToGuided }),
    ).toBeVisible();
    // Next goes straight to the plan.
    await next(page).click();
    await expect(stepTitle(page)).toHaveText(cfg.titles.plan);
    await expect(panel(page)).toContainText('Krok 3 z 4');
  });

  test('back to the questions from the manual mode', async ({ page }) => {
    await open(page);
    await panel(page).getByRole('button', { name: cfg.goals.knowIt }).click();
    await panel(page).getByRole('button', { name: cfg.solution.backToGuided }).click();
    await expect(stepTitle(page)).toHaveText(cfg.titles.goals);
    await expect(panel(page)).toContainText('Krok 1 z 5');
  });
});

test.describe('the recommendation', () => {
  test('shows the combination, one line per service, and lets the visitor remove and add', async ({
    page,
  }) => {
    await open(page);
    await checkGoal(page, 'online-orders');
    await checkGoal(page, 'booking');
    await next(page).click();
    await panel(page)
      .getByRole('radio', { name: goal('online-orders').options['20-200'], exact: true })
      .check();
    await panel(page)
      .getByRole('radio', { name: goal('booking').options.messengers, exact: true })
      .check();
    await next(page).click();

    const combo = `${categoryName('pl', 'web')} + ${categoryName('pl', 'telegram')}`;
    await expect(panel(page)).toContainText(cfg.solution.fits.replace('{combo}', combo));
    const store = serviceTitle('pl', 'web', 'online-stores');
    const booking = serviceTitle('pl', 'telegram', 'booking');
    await expect(panel(page)).toContainText(store);
    await expect(panel(page)).toContainText(booking);

    // Remove one service; its category leaves the headline.
    await panel(page)
      .getByRole('button', { name: cfg.solution.removeNamed.replace('{service}', booking) })
      .click();
    await expect(panel(page)).toContainText(
      cfg.solution.fits.replace('{combo}', categoryName('pl', 'web')),
    );

    // Add another from the full list.
    await panel(page).getByRole('button', { name: cfg.solution.addMore }).click();
    await panel(page)
      .getByRole('checkbox', { name: serviceTitle('pl', 'crm', 'custom-crm'), exact: true })
      .check();
    await expect(panel(page)).toContainText(serviceTitle('pl', 'crm', 'custom-crm'));
    // The request draft mirrors what the visitor picked, not what was recommended.
    const request = await page.evaluate((key) => localStorage.getItem(key), REQUEST_KEY);
    expect(request).toContain('crm/custom-crm');
    expect(request).not.toContain('web/online-stores');
  });

  test('removing every service leaves the consultation text; the plan still works', async ({
    page,
  }) => {
    await seed(page, 'solution', {
      ...DRAFT,
      goals: ['booking'],
      answers: { booking: 'messengers' },
    });
    await open(page);
    await panel(page)
      .getByRole('button', {
        name: cfg.solution.removeNamed.replace(
          '{service}',
          serviceTitle('pl', 'telegram', 'booking'),
        ),
      })
      .click();
    await expect(panel(page)).toContainText(cfg.solution.consultation);
    await next(page).click();
    await expect(stepTitle(page)).toHaveText(cfg.titles.plan);
  });
});

test.describe('budget and timing', () => {
  test('budgets follow the highest complexity level of the services (D138)', async ({ page }) => {
    await seed(page, 'plan', {
      ...DRAFT,
      mode: 'manual',
      goals: [],
      answers: {},
      added: ['web/landing-pages'],
      budget: null,
    });
    await open(page);
    const options = panel(page).locator('input[name="cfg-budget"]');
    await expect(options).toHaveCount(4);
    await expect(
      panel(page)
        .locator('label', { hasText: /1\s?500/ })
        .first(),
    ).toBeVisible();
    await expect(panel(page)).toContainText(cfg.budget.notSure);
    await expect(panel(page)).not.toContainText(/10\s?000/);
  });

  test('industry is optional; "other" asks for a few words', async ({ page }) => {
    await seed(page, 'plan', { ...DRAFT, industry: null });
    await open(page);
    await next(page).click();
    await expect(stepTitle(page)).toHaveText(cfg.titles.contact);
    await panel(page).getByRole('button', { name: cfg.nav.back }).click();
    const other = panel(page).getByRole('button', { name: cfg.industries.other, exact: true });
    await other.click();
    await expect(other).toHaveAttribute('aria-pressed', 'true');
    await panel(page).getByLabel(cfg.plan.industryOther).fill('Stolarnia artystyczna');
    await other.click();
    await expect(other).toHaveAttribute('aria-pressed', 'false');
    await expect(panel(page).getByLabel(cfg.plan.industryOther)).toHaveCount(0);
  });

  test('a changed selection clears a budget that no longer fits and says so', async ({ page }) => {
    await seed(page, 'solution', {
      ...DRAFT,
      mode: 'manual',
      goals: [],
      answers: {},
      added: ['web/landing-pages'],
      budget: 'up-to-1500',
    });
    await open(page);
    await panel(page).getByRole('button', { name: cfg.solution.addMore }).click();
    await panel(page)
      .getByRole('checkbox', { name: serviceTitle('pl', 'crm', 'custom-crm'), exact: true })
      .check();
    await next(page).click();
    await expect(panel(page)).toContainText(cfg.budget.reset);
    await expect(panel(page).locator('input[name="cfg-budget"]:checked')).toHaveCount(0);
  });
});

test.describe('contact and summary', () => {
  test('Send needs a name: pressing it shows the error and focuses the field', async ({ page }) => {
    await seed(page, 'contact', { ...DRAFT, contact: { name: '', comment: '' } });
    await open(page);
    const name = panel(page).getByLabel(cfg.fields.name, { exact: true });
    await name.fill('A');
    await expect(panel(page)).not.toContainText('Wpisz co najmniej');
    await panel(page).getByRole('button', { name: cfg.summary.send }).click();
    await expect(panel(page)).toContainText('Wpisz co najmniej 2 znaki.');
    await expect(name).toBeFocused();
    await name.fill('Ala');
    // With a valid name Send is the real Telegram link (or Copy, when Telegram is not configured).
    if (configured) {
      await expect(
        panel(page).getByRole('link', { name: new RegExp(cfg.summary.send) }),
      ).toBeVisible();
    }
  });
});

test.describe('persistence and prefill', () => {
  test('the draft and the step survive a reload', async ({ page }) => {
    await open(page);
    await checkGoal(page, 'less-routine');
    await next(page).click();
    await expect(stepTitle(page)).toHaveText(cfg.titles.details);
    await page.waitForTimeout(500); // debounced save
    await page.reload();
    await expect(stepTitle(page)).toHaveText(cfg.titles.details);
    const stored = await page.evaluate((key) => localStorage.getItem(key), CONFIGURATOR_KEY);
    expect(JSON.parse(stored!)).toMatchObject({
      v: 2,
      step: 'details',
      draft: { goals: ['less-routine'] },
    });
  });

  test('?add= picks the service, continues in the manual mode with a notice', async ({ page }) => {
    await open(page, 'pl', '?add=crm%2Fcustom-crm');
    await expect(stepTitle(page)).toHaveText(cfg.titles.solution);
    await expect(panel(page).locator('[role="status"]').first()).toHaveText(cfg.prefilled);
    await expect(panel(page)).toContainText(serviceTitle('pl', 'crm', 'custom-crm'));
    await expect(panel(page)).toContainText('Krok 2 z 4');
    // The request draft mirrors it (HUD badge).
    expect(await page.evaluate((key) => localStorage.getItem(key), REQUEST_KEY)).toContain(
      'crm/custom-crm',
    );
  });

  test('?add= is applied once and then dropped from the URL (Q-F3-02)', async ({ page }) => {
    await open(page, 'pl', '?add=crm%2Fcustom-crm&utm_source=e2e#top');
    const title = serviceTitle('pl', 'crm', 'custom-crm');
    await expect(panel(page)).toContainText(title);
    await expect(page).toHaveURL(/\/pl\/configurator\/\?utm_source=e2e#top$/);

    // Removing sticks across a reload: the prefill is not re-applied.
    await panel(page)
      .getByRole('button', { name: cfg.solution.removeNamed.replace('{service}', title) })
      .click();
    await page.waitForTimeout(500);
    await page.reload();
    // Nothing is picked: the consultation text shows, and the open full list has it unchecked.
    await expect(panel(page)).toContainText(cfg.solution.consultation);
    await expect(panel(page).getByRole('checkbox', { name: title, exact: true })).not.toBeChecked();
  });

  test('services added to the request are picked on entry', async ({ page }) => {
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
      REQUEST_KEY,
      JSON.stringify({ v: 1, items: ['ai/ai-assistants'] }),
    ] as const);
    await open(page);
    await expect(stepTitle(page)).toHaveText(cfg.titles.solution);
    await expect(panel(page)).toContainText(serviceTitle('pl', 'ai', 'ai-assistants'));
  });

  test('Start over asks first, then clears the draft and the request', async ({ page }) => {
    await seed(page, 'plan');
    await open(page);
    await panel(page).getByRole('button', { name: cfg.nav.startOver }).click();
    const cancel = panel(page).getByRole('button', { name: cfg.nav.startOverNo });
    await expect(cancel).toBeFocused();
    await panel(page).getByRole('button', { name: cfg.nav.startOverYes }).click();
    await expect(stepTitle(page)).toHaveText(cfg.titles.goals);
    await expect(
      panel(page).getByRole('checkbox', { name: goal('online-orders').name, exact: true }),
    ).not.toBeChecked();
    await page.waitForTimeout(500);
    const stored = await page.evaluate((key) => localStorage.getItem(key), CONFIGURATOR_KEY);
    expect(JSON.parse(stored!).draft.goals).toEqual([]);
  });
});

test.describe('summary and hand-off', () => {
  test('the message is complete in Polish and editable with "Restore default"', async ({
    page,
  }) => {
    await seed(page, 'contact');
    await open(page);
    const message = panel(page).getByLabel(cfg.summary.message, { exact: true });
    const text = await message.inputValue();
    expect(text.split('\n')[0]).toBe('Zapytanie ze strony KABANINNO');
    expect(text).toContain(goal('online-orders').name);
    expect(text).toContain(categoryName('pl', 'web'));
    for (const id of DRAFT_SERVICES) {
      const [category, slug] = id.split('/') as [string, string];
      expect(text).toContain(serviceTitle('pl', category, slug));
    }
    expect(text).toContain('Łucja Żółkiewska');
    expect(text).not.toMatch(/[  ]/);

    await message.fill('Dzień dobry, proszę o kontakt.');
    await panel(page).getByRole('button', { name: cfg.summary.restoreDefault }).click();
    await expect(message).toHaveValue(text);
  });

  test('an edit made before an answer changed is flagged, then updated or kept (Q-F3-01)', async ({
    page,
  }) => {
    await seedOnce(page, 'contact', { ...DRAFT, budget: 'up-to-5000' });
    await open(page);
    const summary = cfg.summary;
    const message = panel(page).getByLabel(summary.message, { exact: true });
    const original = await message.inputValue();
    await message.fill(`${original}\nPS. Proszę o telefon.`);

    // Change the budget through «Zmień» and come back.
    await panel(page)
      .getByRole('button', { name: `${cfg.nav.edit}: ${summary.rowBudget}` })
      .click();
    await expect(stepTitle(page)).toHaveText(cfg.titles.plan);
    await panel(page).locator('#cfg-budget-3').check();
    await next(page).click();
    await expect(stepTitle(page)).toHaveText(cfg.titles.contact);

    // The edit is stale: the notice says so, and the text still has the old budget.
    await expect(panel(page)).toContainText(summary.staleNotice);
    expect(await message.inputValue()).toContain('PS. Proszę o telefon.');

    // The edit (and its base) survives a reload (Q-F3-05).
    await page.waitForTimeout(500);
    await page.reload();
    await expect(panel(page)).toContainText(summary.staleNotice);

    // "Keep my text" keeps it and the notice goes.
    await panel(page).getByRole('button', { name: summary.staleKeep }).click();
    await expect(panel(page)).not.toContainText(summary.staleNotice);
    expect(await message.inputValue()).toContain('PS. Proszę o telefon.');
  });

  test('"Update the message" regenerates it from the changed answers (Q-F3-01)', async ({
    page,
  }) => {
    await seedOnce(page, 'contact', { ...DRAFT, budget: 'up-to-5000' });
    await open(page);
    const summary = cfg.summary;
    const message = panel(page).getByLabel(summary.message, { exact: true });
    await message.fill('Mój własny tekst');
    await panel(page)
      .getByRole('button', { name: `${cfg.nav.edit}: ${summary.rowBudget}` })
      .click();
    await panel(page).locator('#cfg-budget-3').check();
    await next(page).click();
    await panel(page).getByRole('button', { name: summary.staleUpdate }).click();
    await expect(panel(page)).not.toContainText(summary.staleNotice);
    const text = await message.inputValue();
    expect(text).not.toContain('Mój własny tekst');
    expect(text.split('\n')[0]).toBe('Zapytanie ze strony KABANINNO');
  });

  test('the message is in Ukrainian on /uk/', async ({ page }) => {
    await seed(page, 'contact');
    await open(page, 'uk');
    const text = await panel(page)
      .getByLabel(ui.uk.configurator.summary.message, { exact: true })
      .inputValue();
    expect(text.split('\n')[0]).toBe('Запит із сайту KABANINNO');
    expect(text).toContain(ui.uk.configurator.goals.items['online-orders'].name);
    expect(text).toContain(ui.uk.configurator.industries.retail);
    expect(text).toContain(ui.uk.configurator.timelines['1-3-months']);
  });

  test('Copy puts the full text on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seed(page, 'contact');
    await open(page);
    const text = await panel(page).getByLabel(cfg.summary.message, { exact: true }).inputValue();
    await panel(page).getByRole('button', { name: cfg.summary.copy }).click();
    await expect(panel(page)).toContainText(cfg.summary.copied);
    // The OS clipboard may store CRLF line breaks (Windows); compare the text, not the line endings.
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replace(/\r\n/g, '\n')).toBe(text);
  });

  test('Telegram link: encoded, within the budget, "@" rule', async ({ page }) => {
    test.skip(!configured, 'siteConfig.telegramUsername is still the placeholder in this build');
    await seed(page, 'contact');
    await open(page);
    const send = panel(page).getByRole('link', { name: new RegExp(cfg.summary.send) });
    const href = (await send.getAttribute('href'))!;
    expect(
      href.startsWith(`https://t.me/${siteConfig.telegramUsername.replace(/^@/, '')}?text=`),
    ).toBe(true);
    expect(href.length).toBeLessThanOrEqual(2000);
    expect(decodeURIComponent(href.split('text=')[1]!)).toContain('Łucja Żółkiewska');
    await expect(send).toHaveAttribute('target', '_blank');
    await expect(send).toHaveAttribute('rel', /noopener/);

    await panel(page).getByLabel(cfg.summary.message, { exact: true }).fill('@studio cześć');
    await expect(send).toHaveAttribute('href', /\?text=%20%40studio%20cze%C5%9B%C4%87$/);
    // One Telegram action (D135): no separate "open chat" link; the hint describes the button.
    await expect(panel(page).getByRole('link', { name: /t\.me|Telegram/ })).toHaveCount(1);
    await expect(send).toHaveAccessibleDescription(cfg.summary.sendHint);
  });

  test('"Send via Telegram" copies the full text and opens t.me in a new tab', async ({
    page,
    context,
  }) => {
    test.skip(!configured, 'siteConfig.telegramUsername is still the placeholder in this build');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    // Keep the test offline: answer the t.me tab locally.
    await context.route('https://t.me/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>t.me</title>' }),
    );
    await seed(page, 'contact');
    await open(page);
    const text = await panel(page).getByLabel(cfg.summary.message, { exact: true }).inputValue();
    const send = panel(page).getByRole('link', { name: new RegExp(cfg.summary.send) });
    const [tab] = await Promise.all([context.waitForEvent('page'), send.click()]);
    expect(tab.url()).toMatch(/^https:\/\/t\.me\/[^?]+\?text=/);
    await expect(panel(page)).toContainText(cfg.summary.copied);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replace(/\r\n/g, '\n')).toBe(text);
    await tab.close();
  });

  test('unconfigured Telegram: no send link, a notice, Copy stays', async ({ page }) => {
    test.skip(configured, 'a real Telegram username is configured in this build');
    await seed(page, 'contact');
    await open(page);
    await expect(panel(page)).toContainText(cfg.summary.unconfigured);
    await expect(panel(page).getByRole('link', { name: new RegExp(cfg.summary.send) })).toHaveCount(
      0,
    );
    await expect(panel(page).getByRole('button', { name: cfg.summary.copy })).toBeVisible();
  });
});
