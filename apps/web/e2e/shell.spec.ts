import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

test('signed-out visitor sees the shell and an empty problem bank', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/problems$/);
  await expect(page.getByRole('heading', { name: 'Problems', level: 1 })).toBeVisible();
  await expect(page.getByText('No problems yet')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('new user picks a handle and sees level, gold and streak in the header', async ({ page }) => {
  await signUp(page);
  await page.goto('/problems');
  await expect(page).toHaveURL(/\/welcome$/);

  const handle = `mara${Date.now().toString(36)}`;
  await page.getByLabel('Handle').fill(handle);
  await page.getByRole('button', { name: 'Start solving' }).click();

  await expect(page).toHaveURL(/\/problems$/);
  await expect(page.getByLabel('No streak yet')).toBeVisible();
  await expect(page.getByRole('button', { name: /Account menu for Mara Quinn/ })).toBeVisible();
});

test('handle validation explains what went wrong', async ({ page }) => {
  await signUp(page, 'Ada');
  await page.goto('/welcome');
  await page.getByLabel('Handle').fill('admin');
  await page.getByRole('button', { name: 'Start solving' }).click();
  await expect(page.locator('#handle-error')).toHaveText('That handle is reserved.');
});

test('theme toggle persists across reloads', async ({ page, context }) => {
  await page.goto('/problems');
  await page.getByRole('button', { name: /Theme: Dark/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  // The cookie is written by a server action; wait for it before reloading.
  await expect
    .poll(async () => (await context.cookies()).find((c) => c.name === 'kc-theme')?.value)
    .toBe('light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: /Theme: Light/ })).toBeVisible();
});

test('unknown routes get the designed 404', async ({ page }) => {
  const res = await page.goto('/definitely-not-here');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('Nothing on this throne')).toBeVisible();
});

for (const theme of ['dark', 'light'] as const) {
  test(`no axe violations on core pages (${theme})`, async ({ page, context }) => {
    await context.addCookies([{ name: 'kc-theme', value: theme, url: 'http://localhost:3100' }]);
    for (const path of ['/problems', '/sign-in']) {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations, `${path} (${theme})`).toEqual([]);
    }
  });
}
