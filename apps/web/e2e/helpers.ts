import type { Page } from '@playwright/test';

let counter = 0;

/** Creates a fresh account through the local-only password endpoint; the browser keeps the session cookie. */
export async function signUp(page: Page, name = 'Mara Quinn') {
  const email = `e2e-${Date.now()}-${counter++}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await page.request.post('/api/auth/sign-up/email', {
    data: { name, email, password: 'correct-horse-battery-staple' },
  });
  if (!res.ok()) throw new Error(`sign-up failed: ${res.status()} ${await res.text()}`);
  return { email };
}
