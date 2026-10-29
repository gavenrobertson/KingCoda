'use server';
import { cookies } from 'next/headers';
import { THEME_COOKIE, parseTheme } from '@/lib/theme';

export async function setTheme(value: string) {
  (await cookies()).set(THEME_COOKIE, parseTheme(value), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
