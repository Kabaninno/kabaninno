/**
 * M4 "Configurator + Telegram", UI side.
 *
 * Covers: step navigation and validation, persistence across reload, prefill
 * from `?add=` and from the request draft, the summary text in pl and uk,
 * the Telegram link (encoded, within the budget, leading "@" rule) or the
 * unconfigured state, the Copy fallback, and "Start over".
 */
import type { Page } from '@playwright/test';
import { siteConfig } from '~/site.config';
import { isValidTelegramUsername } from '@/lib/configurator/telegram';
import { expect, test } from '../support/fixtures';
import { sitePath } from '../support/env';
import { categoryName, localized, paths, serviceTitle, ui, type TestLocale } from '../support/site';

const CONFIGURATOR_KEY = 'kabaninno.configurator.v1';
const REQUEST_KEY = 'kabaninno.request.v1';
const configured = isValidTelegramUsername(siteConfig.telegramUsername.replace(/^@/, ''));

const DRAFT = {
  types: ['web', 'crm'],
  features: ['web/online-stores', 'web/seo', 'crm/custom-crm'],
  business: { industry: 'retail', size: '2-10', hasWebsite: 'yes', hasCrm: 'no' },
  budget: '15k-40k',
  timeline: '1-3-months',
  contact: { name: 'Łucja Żółkiewska', comment: 'Sklep z integracją CRM.' },
};

const open = (page: Page, locale: TestLocale = 'pl', query = '') =>
  page.goto(`${sitePath(localized(locale, paths.configurator()))}${query}`);

async function seed(page: Page, step: string, draft: object = DRAFT) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    CONFIGURATOR_KEY,
    JSON.stringify({ v: 1, step, draft }),
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
    [CONFIGURATOR_KEY, JSON.stringify({ v: 1, step, draft })] as const,
  );
}

const panel = (page: Page) => page.locator('main [data-route-ui]');
const stepTitle = (page: Page) => panel(page).locator('#cfg-step-title');

test.describe('wizard navigation and validation', () => {
  test('Next without an answer shows the error and focuses the field', async ({ page }) => {
    await open(page);
    await expect(stepTitle(page)).toHaveText(ui.pl.configurator.steps.type);
    await expect(panel(page)).toContainText('Krok 1 z 7');
    await panel(page).getByRole('button', { name: ui.pl.configurator.nav.next }).click();
    await expect(panel(page)).toContainText(ui.pl.configurator.errors.requiredMulti);
    const first = panel(page).locator('#cfg-types-0');
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute('aria-invalid', 'true');
    await expect(first).toHaveAttribute('aria-describedby', /cfg-types-error/);

    await panel(page)
      .getByRole('checkbox', { name: categoryName('pl', 'web') })
      .check();
    await panel(page).getByRole('button', { name: ui.pl.configurator.nav.next }).click();
    await expect(stepTitle(page)).toHaveText(ui.pl.configurator.steps.features);
    await expect(stepTitle(page)).toBeFocused();
    await expect(panel(page)).toContainText('Krok 2 z 7');
  });

  test('later steps are disabled until the previous ones are valid; earlier ones stay open', async ({
    page,
  }) => {
    await open(page);
    const steps = panel(page).getByRole('navigation', { name: ui.pl.configurator.stepsNav });
    await expect(
      steps.getByRole('button', { name: ui.pl.configurator.steps.summary }),
    ).toBeDisabled();
    await panel(page)
      .getByRole('checkbox', { name: categoryName('pl', 'crm') })
      .check();
    await panel(page).getByRole('button', { name: ui.pl.configurator.nav.next }).click();
    await expect(steps.getByRole('button', { name: ui.pl.configurator.steps.type })).toBeEnabled();
    await steps.getByRole('button', { name: ui.pl.configurator.steps.type }).click();
    await expect(stepTitle(page)).toHaveText(ui.pl.configurator.steps.type);
  });

  test('the name is validated on Next, not while typing', async ({ page }) => {
    await seed(page, 'contact', { ...DRAFT, contact: { name: '', comment: '' } });
    await open(page);
    // exact: the step form is labelled by its title ("Imię i komentarz"), which contains the field name.
    const name = panel(page).getByLabel(ui.pl.configurator.fields.name, { exact: true });
    await name.fill('A');
    await expect(panel(page)).not.toContainText('Wpisz co najmniej');
    await panel(page).getByRole('button', { name: ui.pl.configurator.nav.toSummary }).click();
    await expect(panel(page)).toContainText('Wpisz co najmniej 2 znaki.');
    await expect(name).toBeFocused();
    await name.fill('Ala');
    await panel(page).getByRole('button', { name: ui.pl.configurator.nav.toSummary }).click();
    await expect(stepTitle(page)).toHaveText(ui.pl.configurator.steps.summary);
  });
});

test.describe('persistence and prefill', () => {
  test('the draft and the step survive a reload', async ({ page }) => {
    await open(page);
    await panel(page)
      .getByRole('checkbox', { name: categoryName('pl', 'ai') })
      .check();
    await panel(page).getByRole('button', { name: ui.pl.configurator.nav.next }).click();
    await expect(stepTitle(page)).toHaveText(ui.pl.configurator.steps.features);
    await page.waitForTimeout(500); // debounced save
    await page.reload();
    await expect(stepTitle(page)).toHaveText(ui.pl.configurator.steps.features);
    const stored = await page.evaluate((key) => localStorage.getItem(key), CONFIGURATOR_KEY);
    expect(JSON.parse(stored!)).toMatchObject({ v: 1, step: 'features', draft: { types: ['ai'] } });
  });

  test('?add= selects the category and the service, with a notice', async ({ page }) => {
    await open(page, 'pl', '?add=crm%2Fcustom-crm');
    await expect(panel(page).locator('[role="status"]').first()).toHaveText(
      ui.pl.configurator.prefilled,
    );
    await expect(
      panel(page).getByRole('checkbox', { name: categoryName('pl', 'crm') }),
    ).toBeChecked();
    await panel(page).getByRole('button', { name: ui.pl.configurator.nav.next }).click();
    await expect(
      panel(page).getByRole('checkbox', { name: serviceTitle('pl', 'crm', 'custom-crm') }),
    ).toBeChecked();
    // The request draft mirrors it (HUD badge).
    expect(await page.evaluate((key) => localStorage.getItem(key), REQUEST_KEY)).toContain(
      'crm/custom-crm',
    );
  });

  test('?add= is applied once and then dropped from the URL (Q-F3-02)', async ({ page }) => {
    await open(page, 'pl', '?add=crm%2Fcustom-crm&utm_source=e2e#top');
    const crm = panel(page).getByRole('checkbox', { name: categoryName('pl', 'crm') });
    await expect(crm).toBeChecked();
    await expect(page).toHaveURL(/\/pl\/configurator\/\?utm_source=e2e#top$/);

    // Deselecting sticks across a reload: the prefill is not re-applied.
    await crm.uncheck();
    await page.waitForTimeout(500);
    await page.reload();
    await expect(
      panel(page).getByRole('checkbox', { name: categoryName('pl', 'crm') }),
    ).not.toBeChecked();
  });

  test('services added to the request are preselected', async ({ page }) => {
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
      REQUEST_KEY,
      JSON.stringify({ v: 1, items: ['ai/ai-assistants'] }),
    ] as const);
    await open(page);
    await expect(
      panel(page).getByRole('checkbox', { name: categoryName('pl', 'ai') }),
    ).toBeChecked();
  });

  test('Start over asks first, then clears the draft and the request', async ({ page }) => {
    await seed(page, 'budget');
    await open(page);
    await panel(page).getByRole('button', { name: ui.pl.configurator.nav.startOver }).click();
    const cancel = panel(page).getByRole('button', { name: ui.pl.configurator.nav.startOverNo });
    await expect(cancel).toBeFocused();
    await panel(page).getByRole('button', { name: ui.pl.configurator.nav.startOverYes }).click();
    await expect(stepTitle(page)).toHaveText(ui.pl.configurator.steps.type);
    await expect(
      panel(page).getByRole('checkbox', { name: categoryName('pl', 'web') }),
    ).not.toBeChecked();
    await page.waitForTimeout(500);
    const stored = await page.evaluate((key) => localStorage.getItem(key), CONFIGURATOR_KEY);
    expect(JSON.parse(stored!).draft.types).toEqual([]);
  });
});

test.describe('summary and hand-off', () => {
  test('the message is complete in Polish and editable with "Restore default"', async ({
    page,
  }) => {
    await seed(page, 'summary');
    await open(page);
    const message = panel(page).getByLabel(ui.pl.configurator.summary.message);
    const text = await message.inputValue();
    expect(text.split('\n')[0]).toBe('Zapytanie ze strony KABANINNO');
    expect(text).toContain(categoryName('pl', 'web'));
    expect(text).toContain(serviceTitle('pl', 'crm', 'custom-crm'));
    expect(text).toContain(ui.pl.configurator.extras.seo);
    expect(text).toContain('Łucja Żółkiewska');
    expect(text).not.toMatch(/[\u00A0\u202F]/);

    await message.fill('Dzień dobry, proszę o kontakt.');
    await panel(page)
      .getByRole('button', { name: ui.pl.configurator.summary.restoreDefault })
      .click();
    await expect(message).toHaveValue(text);
  });

  test('an edit made before an answer changed is flagged, then updated or kept (Q-F3-01)', async ({
    page,
  }) => {
    await seedOnce(page, 'summary', { ...DRAFT, budget: 'up-to-5k' });
    await open(page);
    const summary = ui.pl.configurator.summary;
    const message = panel(page).getByLabel(summary.message, { exact: true });
    const original = await message.inputValue();
    await message.fill(`${original}\nPS. Proszę o telefon.`);

    // Change the budget through «Zmień» and come back.
    await panel(page)
      .getByRole('button', {
        name: `${ui.pl.configurator.nav.edit}: ${ui.pl.configurator.steps.budget}`,
      })
      .click();
    await expect(stepTitle(page)).toHaveText(ui.pl.configurator.steps.budget);
    await panel(page).locator('#cfg-budget-3').check();
    await panel(page)
      .getByRole('button', { name: ui.pl.configurator.steps.summary, exact: false })
      .first()
      .click();
    await expect(stepTitle(page)).toHaveText(ui.pl.configurator.steps.summary);

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
    await seedOnce(page, 'summary', { ...DRAFT, budget: 'up-to-5k' });
    await open(page);
    const summary = ui.pl.configurator.summary;
    const message = panel(page).getByLabel(summary.message, { exact: true });
    await message.fill('Mój własny tekst');
    await panel(page)
      .getByRole('button', {
        name: `${ui.pl.configurator.nav.edit}: ${ui.pl.configurator.steps.budget}`,
      })
      .click();
    await panel(page).locator('#cfg-budget-3').check();
    await panel(page)
      .getByRole('button', { name: ui.pl.configurator.steps.summary, exact: false })
      .first()
      .click();
    await panel(page).getByRole('button', { name: summary.staleUpdate }).click();
    await expect(panel(page)).not.toContainText(summary.staleNotice);
    const text = await message.inputValue();
    expect(text).not.toContain('Mój własny tekst');
    expect(text.split('\n')[0]).toBe('Zapytanie ze strony KABANINNO');
  });

  test('the message is in Ukrainian on /uk/', async ({ page }) => {
    await seed(page, 'summary');
    await open(page, 'uk');
    const text = await panel(page).getByLabel(ui.uk.configurator.summary.message).inputValue();
    expect(text.split('\n')[0]).toBe('Запит із сайту KABANINNO');
    expect(text).toContain(ui.uk.configurator.industries.retail);
    expect(text).toContain(ui.uk.configurator.timelines['1-3-months']);
  });

  test('Copy puts the full text on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seed(page, 'summary');
    await open(page);
    const text = await panel(page).getByLabel(ui.pl.configurator.summary.message).inputValue();
    await panel(page).getByRole('button', { name: ui.pl.configurator.summary.copy }).click();
    await expect(panel(page)).toContainText(ui.pl.configurator.summary.copied);
    // The OS clipboard may store CRLF line breaks (Windows); compare the text, not the line endings.
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replace(/\r\n/g, '\n')).toBe(text);
  });

  test('Telegram link: encoded, within the budget, "@" rule', async ({ page }) => {
    test.skip(!configured, 'siteConfig.telegramUsername is still the placeholder in this build');
    await seed(page, 'summary');
    await open(page);
    const send = panel(page).getByRole('link', {
      name: new RegExp(ui.pl.configurator.summary.send),
    });
    const href = (await send.getAttribute('href'))!;
    expect(
      href.startsWith(`https://t.me/${siteConfig.telegramUsername.replace(/^@/, '')}?text=`),
    ).toBe(true);
    expect(href.length).toBeLessThanOrEqual(2000);
    expect(decodeURIComponent(href.split('text=')[1]!)).toContain('Łucja Żółkiewska');
    await expect(send).toHaveAttribute('target', '_blank');
    await expect(send).toHaveAttribute('rel', /noopener/);

    await panel(page).getByLabel(ui.pl.configurator.summary.message).fill('@studio cześć');
    await expect(send).toHaveAttribute('href', /\?text=%20%40studio%20cze%C5%9B%C4%87$/);
    await expect(
      panel(page).getByRole('link', { name: new RegExp(ui.pl.configurator.summary.openChat) }),
    ).toHaveAttribute('href', `https://t.me/${siteConfig.telegramUsername.replace(/^@/, '')}`);
  });

  test('unconfigured Telegram: no send link, a notice, Copy stays', async ({ page }) => {
    test.skip(configured, 'a real Telegram username is configured in this build');
    await seed(page, 'summary');
    await open(page);
    await expect(panel(page)).toContainText(ui.pl.configurator.summary.unconfigured);
    await expect(
      panel(page).getByRole('link', { name: new RegExp(ui.pl.configurator.summary.send) }),
    ).toHaveCount(0);
    await expect(
      panel(page).getByRole('button', { name: ui.pl.configurator.summary.copy }),
    ).toBeVisible();
  });
});
