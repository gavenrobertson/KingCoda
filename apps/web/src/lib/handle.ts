import { z } from 'zod';

export const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'about',
  'contest',
  'contests',
  'daily',
  'discuss',
  'help',
  'kingcoda',
  'leaderboard',
  'me',
  'moderator',
  'problems',
  'profile',
  'settings',
  'sign-in',
  'store',
  'support',
  'u',
  'welcome',
]);

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'At least 3 characters.')
  .max(20, 'At most 20 characters.')
  .regex(
    /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/,
    'Letters, numbers, - and _ only, starting and ending with a letter or number.',
  )
  .refine((h) => !RESERVED_HANDLES.has(h), 'That handle is reserved.');

/** Suggests a handle from a display name or email, e.g. "Mara Quinn" → "maraquinn". */
export function suggestHandle(nameOrEmail: string): string {
  const base = nameOrEmail
    .split('@')[0]!
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 16);
  const candidate = base.length >= 3 ? base : `coder${base}`;
  return RESERVED_HANDLES.has(candidate) ? `${candidate}1` : candidate;
}
