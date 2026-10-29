import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.ts';

/** Minimal shape of the D1 binding, so this package doesn't depend on workers-types. */
export type D1Binding = Parameters<typeof drizzle>[0];

export function getDb(d1: D1Binding) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof getDb>;
