import { expect, test, type Page } from '@playwright/test';
import { signUp } from './helpers';

// Needs the judge Worker and a judge box (Docker): see e2e/serve.ts and judge/README.md.

const solution = (body: string) => `class Solution {
public:
    vector<int> twinCoins(vector<int>& weights, int target) {
${body}
    }
};
`;

/** Correct everywhere, but quadratic: too slow for the largest hidden inputs. */
const QUADRATIC = solution(`        for (int j = 0; j < (int)weights.size(); j++)
            for (int i = 0; i < j; i++)
                if ((long long)weights[i] + weights[j] == target) return {i, j};
        return {-1, -1};`);

const CORRECT = solution(`        unordered_map<long long, int> first;
        for (int j = 0; j < (int)weights.size(); j++) {
            auto it = first.find((long long)target - weights[j]);
            if (it != first.end()) return {it->second, j};
            first.emplace(weights[j], j);
        }
        return {-1, -1};`);

async function onboard(page: Page) {
  await signUp(page);
  await page.goto('/welcome');
  await page.getByLabel('Handle').fill(`solver${Date.now().toString(36)}`);
  await page.getByRole('button', { name: 'Start solving' }).click();
  await expect(page).toHaveURL(/\/problems$/);
}

const result = (page: Page) => page.getByRole('tabpanel', { name: 'Result' });

async function setCode(page: Page, code: string) {
  await page.locator('.monaco-editor').first().waitFor();
  await page.evaluate((c) => {
    const m = (
      window as unknown as {
        monaco: { editor: { getModels(): Array<{ setValue(v: string): void }> } };
      }
    ).monaco;
    m.editor.getModels()[0]!.setValue(c);
  }, code);
}

test.describe('solve a problem', () => {
  test.skip(({ isMobile }) => isMobile, 'the editor is desktop-only');
  test.setTimeout(180_000);

  test('find a problem, fail it, read the diff, fix it, get Accepted', async ({ page }) => {
    await onboard(page);

    // Find it
    await page.getByLabel('Search problems').fill('twin');
    await page.getByLabel('Search problems').press('Enter');
    await expect(page.getByRole('link', { name: /Twin Coins/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Castle Gate Intervals/ })).toHaveCount(0);
    await page.getByRole('link', { name: /Twin Coins/ }).click();
    await expect(page.getByRole('heading', { name: '1. Twin Coins' })).toBeVisible();

    // Run the examples with a wrong answer: the diff shows input, expected and actual
    await setCode(page, solution('        return {0, 0};'));
    await page.getByRole('button', { name: /^Run/ }).click();
    await expect(result(page).getByText('Wrong Answer', { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(result(page).getByText('0 of 3 test cases passed')).toBeVisible();
    await expect(
      result(page).getByText('weights = [4,9,1,6], target = 7', { exact: true }),
    ).toBeVisible();
    await expect(result(page).getByText('[0,0]', { exact: true })).toBeVisible();

    // Submit code that passes the examples but is too slow: a hidden test fails, labelled not shown
    await setCode(page, QUADRATIC);
    await page.getByRole('button', { name: /^Submit/ }).click();
    await expect(result(page).getByText('Time Limit Exceeded')).toBeVisible({ timeout: 90_000 });
    await expect(result(page).getByText(/Failed on hidden test \d+ of \d+/)).toBeVisible();
    await expect(result(page).getByText('largest inputs', { exact: true })).toBeVisible();

    // Fix it and get Accepted
    await setCode(page, CORRECT);
    await page.keyboard.press('Control+Shift+Enter');
    await expect(result(page).getByText('Accepted', { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(result(page).getByText(/(\d+) \/ \1 tests passed/)).toBeVisible();

    // The list shows it solved, and the submission history has both verdicts
    await page.getByRole('tab', { name: 'Submissions' }).click();
    await expect(page.getByRole('cell', { name: 'Accepted' })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Time Limit Exceeded/ })).toBeVisible();
    await page.goto('/problems');
    await expect(page.getByRole('img', { name: 'Solved' })).toBeVisible();
  });

  test('custom input gets expected outputs from the reference solution', async ({ page }) => {
    await onboard(page);
    await page.goto('/problems/twin-coins');
    await setCode(page, CORRECT);
    await page.getByRole('tab', { name: 'Test cases' }).click();
    await page.getByLabel(/One JSON value per line/).fill('[10,20,30]\n50\n');
    await page.keyboard.press('Control+Enter');
    await expect(result(page).getByText('1 of 1 test cases passed')).toBeVisible({
      timeout: 90_000,
    });
    await expect(
      result(page).getByText('weights = [10,20,30], target = 50', { exact: true }),
    ).toBeVisible();
  });

  test('compile errors point at the line', async ({ page }) => {
    await onboard(page);
    await page.goto('/problems/twin-coins');
    await setCode(page, solution('        return {0, 0}'));
    await page.keyboard.press('Control+Enter');
    await expect(result(page).getByText('Compile Error')).toBeVisible({ timeout: 90_000 });
    // The missing semicolon is reported at the next token, on line 5 of the user's code.
    await expect(result(page).getByText(/solution\.cpp:5:\d+: error: expected ‘;’/)).toBeVisible();
  });

  test('the starter runs as-is, and a missing return is a compile error', async ({ page }) => {
    await onboard(page);
    await page.goto('/problems/twin-coins');
    await page.locator('.monaco-editor').first().waitFor();
    await page.keyboard.press('Control+Enter');
    await expect(result(page).getByText('Wrong Answer', { exact: true })).toBeVisible({
      timeout: 90_000,
    });

    await setCode(page, solution(''));
    await page.keyboard.press('Control+Enter');
    await expect(result(page).getByText('Compile Error')).toBeVisible({ timeout: 90_000 });
    await expect(result(page).getByText(/no return statement/)).toBeVisible();
  });

  test('a shortcut pressed right after an edit runs the edited code', async ({ page }) => {
    await onboard(page);
    await page.goto('/problems/twin-coins');
    await page.locator('.monaco-editor').first().waitFor();
    // Same tick, before React re-renders: stale code would be the starter, which fails every example.
    await page.evaluate((code) => {
      const m = (
        window as unknown as {
          monaco: { editor: { getModels(): Array<{ setValue(v: string): void }> } };
        }
      ).monaco;
      m.editor.getModels()[0]!.setValue(code);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
    }, CORRECT);
    await expect(result(page).getByText('3 of 3 test cases passed')).toBeVisible({
      timeout: 90_000,
    });
  });
});

test('phones get the statement and a note about the editor', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout');
  await page.goto('/problems/twin-coins');
  await expect(page.getByRole('heading', { name: '1. Twin Coins' })).toBeVisible();
  await expect(page.getByText('The editor is built for a bigger screen')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Submit/ })).toBeHidden();
});

test('signed-out visitors can browse, filter and pick at random', async ({ page }) => {
  await page.goto('/problems');
  await expect(page.getByText('Showing 1–2 of 2')).toBeVisible();
  await page.getByRole('link', { name: 'Hard', exact: true }).click();
  await expect(page.getByText('No problems match these filters.')).toBeVisible();
  await page.goto('/problems?tag=Hashing');
  await expect(page.getByRole('link', { name: /Twin Coins/ })).toBeVisible();
  await page.getByRole('link', { name: 'Pick one for me' }).click();
  await expect(page).toHaveURL(/\/problems\/twin-coins$/);
});
